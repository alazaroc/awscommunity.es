import { XMLParser } from 'fast-xml-parser';
import type { SourceDefinition, UserGroup } from '../../src/lib/types';
import { conditionalFetch } from './http';
import { meetupEventReference, MeetupReviewError, parseMeetupEventPage, type MeetupEventReference } from './public-page';
import type { EventSource, RawEvent, ReviewCandidate, SourceResult, SourceState, TrackedMeetupEvent } from './types';

const parser = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true, trimValues: true });
const MAX_TRACKED_EVENTS = 50;
const UNRESOLVED_RETENTION_MS = 30 * 24 * 60 * 60 * 1_000;
const COMPLETED_RETENTION_MS = 2 * 24 * 60 * 60 * 1_000;
const FETCH_CONCURRENCY = 3;

const array = <T>(value: T | T[] | undefined): T[] => value === undefined ? [] : Array.isArray(value) ? value : [value];
const text = (value: unknown): string | undefined => {
  if (typeof value === 'string' || typeof value === 'number') return String(value).trim().slice(0, 10_000);
  if (value && typeof value === 'object' && '#text' in value) return text((value as Record<string, unknown>)['#text']);
  return undefined;
};

const explicitDate = (value: unknown): string | undefined => {
  const candidate = text(value);
  if (!candidate || !/(?:Z|[+-]\d{2}:?\d{2}|GMT|UTC)$/i.test(candidate)) return undefined;
  const parsed = new Date(candidate);
  return Number.isNaN(parsed.valueOf()) ? undefined : parsed.toISOString();
};

function parseStartDate(item: Record<string, any>): string | undefined {
  // Meetup currently exposes only pubDate, which is the announcement publication
  // time, not the event start. It is intentionally excluded from these candidates.
  const candidates = [item.date, item.startDate, item.start_time, item.when?.['@_start'], item.when?.start];
  for (const candidate of candidates) {
    const parsed = explicitDate(candidate);
    if (parsed) return parsed;
  }
  return undefined;
}

export interface ParsedMeetupFeed {
  events: RawEvent[];
  reviewCandidates: ReviewCandidate[];
  references: MeetupEventReference[];
  sourceIds: string[];
}

export function parseMeetupRss(xml: string, group: UserGroup): ParsedMeetupFeed {
  const document = parser.parse(xml);
  if (!document?.rss?.channel && !document?.feed) throw new Error('Response is not a valid RSS or Atom feed');
  const items = array(document?.rss?.channel?.item ?? document?.feed?.entry);
  const events: RawEvent[] = [];
  const reviewCandidates: ReviewCandidate[] = [];
  const references: MeetupEventReference[] = [];
  const sourceIds: string[] = [];

  items.forEach((item: Record<string, any>, index) => {
    const title = text(item.title);
    const url = text(item.link?.['@_href'] ?? item.link);
    const sourceId = text(item.guid) ?? text(item.id) ?? url;
    if (!title || !url || !sourceId) throw new Error(`RSS item ${index + 1} for ${group.id} is missing title, URL, or source ID`);
    sourceIds.push(sourceId);
    references.push({ ...meetupEventReference(url, group), title });

    const startDate = parseStartDate(item);
    if (!startDate) {
      reviewCandidates.push({
        sourceId,
        source: 'meetup-rss',
        userGroupId: group.id,
        title,
        url,
        reason: 'Meetup RSS provides pubDate only; the public event page must supply a validated event date',
      });
      return;
    }

    const rawEndDate = item.endDate ?? item.end_time;
    const endDate = rawEndDate ? explicitDate(rawEndDate) : undefined;
    if (rawEndDate && !endDate) throw new Error(`RSS item ${index + 1} for ${group.id} has an ambiguous end date`);
    events.push({
      sourceId,
      source: 'meetup-rss',
      userGroupId: group.id,
      title,
      description: text(item.description ?? item.summary ?? item.content),
      startDate,
      endDate,
      timezone: group.timezone ?? 'Europe/Madrid',
      city: text(item.city) ?? group.city,
      venue: text(item.venue?.name ?? item.venue),
      url,
      status: 'AUTO_PUBLISHED',
    });
  });

  return { events, reviewCandidates, references, sourceIds };
}

function keepTracked(event: TrackedMeetupEvent, now: Date): boolean {
  if (event.endDate) return new Date(event.endDate).valueOf() >= now.valueOf() - COMPLETED_RETENTION_MS;
  return new Date(event.discoveredAt).valueOf() >= now.valueOf() - UNRESOLVED_RETENTION_MS;
}

async function inBatches<T>(items: T[], task: (item: T) => Promise<void>): Promise<void> {
  for (let index = 0; index < items.length; index += FETCH_CONCURRENCY) {
    await Promise.all(items.slice(index, index + FETCH_CONCURRENCY).map(task));
  }
}

export class MeetupRssSource implements EventSource {
  readonly type = 'meetup-rss' as const;

  async discover(group: UserGroup, definition: SourceDefinition, state: SourceState): Promise<SourceResult> {
    if (!definition.url) throw new Error(`RSS URL missing for ${group.id}`);
    const response = await conditionalFetch(definition.url, state);
    const parsed = response.body && !response.notModified
      ? parseMeetupRss(response.body, group)
      : { events: [], reviewCandidates: [], references: [], sourceIds: [] } satisfies ParsedMeetupFeed;

    if (!definition.allowAutomatedFetch) {
      const seen = new Set(state.seenSourceIds ?? []);
      return {
        events: parsed.events,
        reviewCandidates: parsed.reviewCandidates.filter((candidate) => !seen.has(candidate.sourceId)),
        state: {
          ...response.state,
          seenSourceIds: [...new Set([...(state.seenSourceIds ?? []), ...parsed.sourceIds])].slice(-500),
        },
        notModified: response.notModified,
      };
    }

    const now = new Date();
    const tracked = new Map((state.trackedMeetupEvents ?? [])
      .filter((event) => keepTracked(event, now))
      .map((event) => [event.sourceId, event]));
    for (const reference of parsed.references) {
      const current = tracked.get(reference.sourceId);
      tracked.set(reference.sourceId, current ? {
        ...current,
        title: reference.title ?? current.title,
        url: reference.url,
      } : {
        sourceId: reference.sourceId,
        title: reference.title,
        url: reference.url,
        discoveredAt: now.toISOString(),
        http: {},
      });
    }

    const candidates = [...tracked.values()]
      .sort((a, b) => b.discoveredAt.localeCompare(a.discoveredAt))
      .slice(0, MAX_TRACKED_EVENTS);
    const events: RawEvent[] = [];
    const reviewCandidates: ReviewCandidate[] = [];

    await inBatches(candidates, async (trackedEvent) => {
      const previousHttp = trackedEvent.http;
      try {
        const page = await conditionalFetch(trackedEvent.url, previousHttp);
        if (page.notModified || !page.body) {
          trackedEvent.http = page.state;
          return;
        }
        const event = parseMeetupEventPage(page.body, group, trackedEvent.url);
        trackedEvent.http = page.state;
        trackedEvent.endDate = event.endDate;
        trackedEvent.status = event.status;
        events.push(event);
      } catch (error) {
        const failures = (previousHttp.consecutiveFailures ?? 0) + 1;
        trackedEvent.http = {
          ...previousHttp,
          consecutiveFailures: failures,
          lastCheckedAt: now.toISOString(),
        };
        if (failures === 1 || failures === 3) {
          reviewCandidates.push({
            sourceId: trackedEvent.sourceId,
            source: 'meetup-public-page',
            userGroupId: group.id,
            title: trackedEvent.title ?? trackedEvent.sourceId,
            url: trackedEvent.url,
            reason: error instanceof Error ? error.message : String(error),
            ...(error instanceof MeetupReviewError && error.draft ? { draft: error.draft } : {}),
          });
        }
      }
    });

    return {
      events: [...parsed.events, ...events],
      reviewCandidates,
      state: {
        ...response.state,
        seenSourceIds: [...new Set([...(state.seenSourceIds ?? []), ...parsed.sourceIds])].slice(-500),
        trackedMeetupEvents: candidates.filter((event) => keepTracked(event, now)),
      },
      notModified: response.notModified && events.length === 0,
    };
  }
}
