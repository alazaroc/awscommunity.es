import type { UserGroup } from '../../src/lib/types';
import type { BackfillState } from '../persistence/types';
import { conditionalFetch } from './http';
import { meetupEventReference, meetupGroupSlug, MeetupReviewError, parseMeetupEventPage, type MeetupEventReference } from './public-page';
import type { RawEvent, ReviewCandidate } from './types';

const MAX_LISTING_EVENTS = 100;
const FETCH_CONCURRENCY = 3;

const decodeAttribute = (value: string) => value
  .replaceAll('&amp;', '&')
  .replaceAll('&#x2F;', '/')
  .replaceAll('&#47;', '/');

export function meetupPastEventsUrl(group: UserGroup): string {
  return `https://www.meetup.com/${meetupGroupSlug(group)}/events/?type=past`;
}

export function parseMeetupListing(html: string, group: UserGroup): MeetupEventReference[] {
  const listingUrl = meetupPastEventsUrl(group);
  const references = new Map<string, MeetupEventReference>();
  const pattern = /<a\b[^>]*?\shref\s*=\s*["']([^"']+)["'][^>]*>/gi;
  for (const match of html.matchAll(pattern)) {
    try {
      const absolute = new URL(decodeAttribute(match[1]), listingUrl).toString();
      const reference = meetupEventReference(absolute, group);
      references.set(reference.sourceId, reference);
    } catch {
      // Navigation, account, other groups and unsafe URLs are intentionally ignored.
    }
  }
  if (references.size > MAX_LISTING_EVENTS) {
    throw new Error(`Public Meetup listing for ${group.id} exceeds the ${MAX_LISTING_EVENTS}-event safety limit`);
  }
  return [...references.values()];
}

async function inBatches<T>(items: T[], task: (item: T) => Promise<void>): Promise<void> {
  for (let index = 0; index < items.length; index += FETCH_CONCURRENCY) {
    await Promise.all(items.slice(index, index + FETCH_CONCURRENCY).map(task));
  }
}

const localDate = (value: string, timezone: string): string => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((candidate) => candidate.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
};

export interface MeetupBackfillResult {
  events: RawEvent[];
  reviewCandidates: ReviewCandidate[];
  state: BackfillState;
}

export async function discoverMeetupHistory(
  group: UserGroup,
  from: string,
  now = new Date(),
): Promise<MeetupBackfillResult> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from)) throw new Error('Backfill start must use YYYY-MM-DD');
  const cutoff = new Date(`${from}T00:00:00.000Z`);
  if (Number.isNaN(cutoff.valueOf()) || cutoff.toISOString().slice(0, 10) !== from) {
    throw new Error(`Invalid backfill start ${from}`);
  }

  const listingUrl = meetupPastEventsUrl(group);
  const listing = await conditionalFetch(listingUrl, {});
  if (!listing.body) throw new Error(`Public Meetup listing returned no content for ${group.id}`);
  const references = parseMeetupListing(listing.body, group);
  const events: RawEvent[] = [];
  const reviewCandidates: ReviewCandidate[] = [];
  const failedUrls: string[] = [];
  let ignoredBeforeCutoff = 0;

  await inBatches(references, async (reference) => {
    let body: string;
    try {
      const page = await conditionalFetch(reference.url, {});
      if (!page.body) throw new Error(`Public Meetup event page returned no content for ${reference.eventId}`);
      body = page.body;
    } catch (error) {
      console.error('Meetup backfill fetch failed', {
        userGroupId: group.id,
        sourceId: reference.sourceId,
        message: error instanceof Error ? error.message : String(error),
      });
      failedUrls.push(reference.url);
      return;
    }

    try {
      const event = parseMeetupEventPage(body, group, reference.url);
      if (localDate(event.startDate, group.timezone ?? 'Europe/Madrid') < from) {
        ignoredBeforeCutoff += 1;
        return;
      }
      events.push(event);
    } catch (error) {
      reviewCandidates.push({
        sourceId: reference.sourceId,
        source: 'meetup-public-page',
        userGroupId: group.id,
        title: reference.title ?? reference.sourceId,
        url: reference.url,
        reason: error instanceof Error ? error.message : String(error),
        ...(error instanceof MeetupReviewError && error.draft ? { draft: error.draft } : {}),
      });
    }
  });

  return {
    events,
    reviewCandidates,
    state: {
      year: Number(from.slice(0, 4)),
      from,
      userGroupId: group.id,
      status: failedUrls.length
        ? 'PARTIAL'
        : reviewCandidates.length ? 'COMPLETED_WITH_REVIEWS' : 'COMPLETED',
      listingUrl,
      sourceIds: references.map((reference) => reference.sourceId),
      visibleUrls: references.length,
      imported: events.length,
      ignoredBeforeCutoff,
      reviewRequired: reviewCandidates.length,
      failedUrls,
      completedAt: now.toISOString(),
    },
  };
}
