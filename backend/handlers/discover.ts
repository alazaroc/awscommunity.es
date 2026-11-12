import { createHash } from 'node:crypto';
import { userGroups } from '../../config/user-groups';
import type { SourceDefinition, UserGroup } from '../../src/lib/types';
import { deduplicateEvents, deduplicationKey, normalizeEvent, transitionPast } from '../normalization/events';
import { generateSnapshot } from '../normalization/snapshot';
import { EventRepository } from '../persistence/repository';
import { applyOverrides, notify, publishSnapshot } from '../persistence/publish';
import type { BackfillState } from '../persistence/types';
import { discoverMeetupHistory } from '../sources/meetup-listing';
import { MeetupRssSource } from '../sources/meetup-rss';
import { CustomWebsiteSource, MeetupPublicPageSource } from '../sources/public-page';
import type { EventSource, RawEvent, ReviewCandidate, SourceState } from '../sources/types';

const sources: Record<SourceDefinition['type'], EventSource> = {
  'meetup-rss': new MeetupRssSource(),
  'meetup-public-page': new MeetupPublicPageSource(),
  'custom-website': new CustomWebsiteSource(),
};

export interface DiscoveryRequest {
  mode?: 'daily' | 'backfill' | 'groups';
  groupId?: string;
  from?: string;
  force?: boolean;
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}

const sourceKey = (groupId: string, type: string, url = '') => createHash('sha256')
  .update(`${groupId}|${type}|${url}`)
  .digest('hex')
  .slice(0, 24);

function selectedGroups(groupId?: string): UserGroup[] {
  const active = userGroups.filter((candidate) => candidate.active);
  if (!groupId) return active;
  const group = active.find((candidate) => candidate.id === groupId);
  if (!group) throw new Error(`Unknown or inactive user group ${groupId}`);
  return [group];
}

export const handler = async (request: DiscoveryRequest = {}): Promise<Record<string, unknown>> => {
  const mode = request.mode ?? 'daily';
  if (mode === 'groups') {
    return {
      groups: userGroups
        .filter((group) => group.active && group.meetupUrl)
        .map((group) => group.id),
    };
  }
  const repository = new EventRepository(required('EVENTS_TABLE'));
  const groups = selectedGroups(request.groupId);
  const alerts: string[] = [];
  const rawEvents: RawEvent[] = [];
  const reviewCandidates: ReviewCandidate[] = [];
  const stateUpdates: Array<{ key: string; state: SourceState }> = [];
  const backfillUpdates: BackfillState[] = [];
  const skippedBackfills: string[] = [];

  if (mode === 'backfill') {
    const from = request.from ?? process.env.BACKFILL_FROM ?? '2026-01-01';
    const year = Number(from.slice(0, 4));
    for (const group of groups) {
      if (!group.meetupUrl) {
        skippedBackfills.push(group.id);
        continue;
      }
      const previous = await repository.getBackfillState(year, group.id);
      if (previous?.from === from && previous.status.startsWith('COMPLETED') && !request.force) {
        skippedBackfills.push(group.id);
        continue;
      }
      const result = await discoverMeetupHistory(group, from);
      rawEvents.push(...result.events);
      reviewCandidates.push(...result.reviewCandidates);
      backfillUpdates.push(result.state);
      if (result.state.status !== 'COMPLETED') {
        alerts.push(
          `[BACKFILL ${result.state.status}] ${group.name}: `
          + `${result.state.imported}/${result.state.visibleUrls} visible URLs imported; `
          + `${result.state.ignoredBeforeCutoff} before cutoff; `
          + `${result.state.reviewRequired} require review; `
          + `${result.state.failedUrls.length} fetches failed`,
        );
      }
    }
  } else {
    for (const group of groups) {
      for (const definition of group.eventSources.filter((candidate) => candidate.enabled !== false)) {
        const key = sourceKey(group.id, definition.type, definition.url);
        const state = await repository.getSourceState(key);
        try {
          const source = sources[definition.type];
          if (!source) throw new Error(`Unsupported automatic event source ${definition.type}`);
          const result = await source.discover(group, definition, state);
          rawEvents.push(...result.events);
          reviewCandidates.push(...(result.reviewCandidates ?? []));
          stateUpdates.push({ key, state: result.state });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          const failures = (state.consecutiveFailures ?? 0) + 1;
          stateUpdates.push({ key, state: { ...state, consecutiveFailures: failures, lastCheckedAt: new Date().toISOString() } });
          console.error('Event source failed', { groupId: group.id, source: definition.type, failures, message });
          if (failures === 1 || failures === 3) {
            alerts.push(`[SOURCE ERROR] ${group.name} / ${definition.type} (${failures} consecutive): ${message}`);
          }
        }
      }
    }
  }

  for (const candidate of reviewCandidates) {
    const review = await repository.recordReview(candidate);
    if (review.status === 'OPEN' && (review.occurrences === 1 || review.occurrences === 3)) {
      alerts.push(`[REVIEW REQUIRED ${review.id}] ${candidate.userGroupId}: ${candidate.title}\n${candidate.reason}\n${candidate.url}`);
    }
  }

  const now = new Date();
  const existing = await repository.loadEvents();
  const byId = new Map(existing.map((event) => [event.id, event]));
  const byDedupeKey = new Map(existing.map((event) => [deduplicationKey(event), event.id]));
  const normalized = rawEvents.flatMap((event) => {
    try { return [normalizeEvent(event, now)]; }
    catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('Event normalization failed', { sourceId: event.sourceId, message });
      alerts.push(`[NORMALIZATION ERROR] ${event.userGroupId} / ${event.sourceId}: ${message}`);
      return [];
    }
  });
  const discovered = deduplicateEvents(normalized);

  for (const event of discovered) {
    const matchingId = byDedupeKey.get(deduplicationKey(event));
    const previous = byId.get(event.id) ?? (matchingId ? byId.get(matchingId) : undefined);
    const next = previous
      ? { ...event, id: previous.id, firstSeen: previous.firstSeen, lastSeen: now.toISOString() }
      : event;
    if (!previous && mode === 'daily') {
      alerts.push(`[NEW ${next.status}] ${next.title} · ${next.city} · ${next.startDate}\n${next.url}`);
    } else if (previous && previous.contentHash !== next.contentHash && mode === 'daily') {
      alerts.push(`[CHANGED ${next.status}] ${next.title}\n${next.url}`);
    }
    byId.set(next.id, next);
    byDedupeKey.set(deduplicationKey(next), next.id);
    await repository.putEvent(next);
    await repository.resolveReview(next.userGroupId, next.sourceId);
  }

  for (const [id, event] of byId) {
    const transitioned = transitionPast(event, now);
    if (transitioned.status !== event.status) {
      byId.set(id, transitioned);
      await repository.putEvent(transitioned);
    }
  }

  const overrides = await repository.loadOverrides();
  const snapshot = generateSnapshot(applyOverrides([...byId.values()], overrides), now);
  await publishSnapshot(required('SNAPSHOT_BUCKET'), snapshot);
  await Promise.all(stateUpdates.map(({ key, state }) => repository.putSourceState(key, state)));
  await Promise.all(backfillUpdates.map((state) => repository.putBackfillState(state)));
  await notify(required('ALERT_TOPIC_ARN'), 'AWS Community Spain · event discovery', alerts);

  const result = {
    mode,
    groups: groups.map((group) => group.id),
    discovered: discovered.length,
    published: snapshot.events.length,
    reviews: reviewCandidates.length,
    skippedBackfills,
    backfills: backfillUpdates.map((state) => ({
      groupId: state.userGroupId,
      status: state.status,
      visibleUrls: state.visibleUrls,
      imported: state.imported,
      ignoredBeforeCutoff: state.ignoredBeforeCutoff,
      reviewRequired: state.reviewRequired,
      failed: state.failedUrls.length,
    })),
  };
  console.info('Event discovery complete', result);
  return result;
};
