import { createHash } from 'node:crypto';
import type { CommunityEvent } from '../../src/lib/types';
import type { RawEvent } from '../sources/types';

const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const clean = (value?: unknown, maxLength = 10_000) => typeof value === 'string'
  ? value.replace(/<[^>]*>/g, ' ').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').replace(/\s+/g, ' ').trim().slice(0, maxLength) || undefined
  : undefined;
const canonicalTitle = (value: string) => value.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

function secureUrl(value: unknown, label: string, title: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') throw new Error(`${label} must be a URL for ${title}`);
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error(`${label} must use HTTPS for ${title}`);
  return url.toString();
}

function normalizeSpeakers(raw: RawEvent['speakers'], title: string) {
  if (!raw?.length) return undefined;
  const speakers = raw.slice(0, 8).flatMap((speaker) => {
    const name = clean(speaker.name, 120);
    if (!name) return [];
    const url = secureUrl(speaker.url, 'Speaker URL', title);
    return [{ name, ...(url ? { url } : {}) }];
  });
  return speakers.length ? speakers : undefined;
}

export function normalizeEvent(raw: RawEvent, now = new Date()): CommunityEvent {
  const title = clean(raw.title);
  if (!title) throw new Error('Event title is required');
  if (typeof raw.sourceId !== 'string' || !raw.sourceId.trim()) throw new Error(`Event sourceId is required for ${title}`);
  if (typeof raw.userGroupId !== 'string' || !raw.userGroupId.trim()) throw new Error(`Event userGroupId is required for ${title}`);
  if (typeof raw.startDate !== 'string' || !/(?:Z|[+-]\d{2}:?\d{2}|GMT|UTC)$/i.test(raw.startDate)) throw new Error(`Event startDate must include a timezone for ${title}`);
  const start = new Date(raw.startDate);
  if (Number.isNaN(start.valueOf())) throw new Error(`Invalid start date for ${title}`);
  if (raw.endDate !== undefined && (typeof raw.endDate !== 'string' || !/(?:Z|[+-]\d{2}:?\d{2}|GMT|UTC)$/i.test(raw.endDate))) throw new Error(`Event endDate must include a timezone for ${title}`);
  const end = raw.endDate ? new Date(raw.endDate) : undefined;
  if (end && (Number.isNaN(end.valueOf()) || end < start)) throw new Error(`Invalid end date for ${title}`);
  const city = clean(raw.city);
  if (!city) throw new Error(`Event city is required for ${title}`);
  const timezone = raw.timezone || 'Europe/Madrid';
  try { new Intl.DateTimeFormat('en', { timeZone: timezone }).format(start); }
  catch { throw new Error(`Invalid timezone for ${title}`); }
  const url = secureUrl(raw.url, 'Event URL', title);
  if (!url) throw new Error(`Event URL is required for ${title}`);
  const imageUrl = secureUrl(raw.imageUrl, 'Image URL', title);
  const speakers = normalizeSpeakers(raw.speakers, title);

  const startDate = start.toISOString();
  const status = raw.status ?? 'PENDING_REVIEW';
  const identity = `${raw.userGroupId}|${raw.sourceId}`;
  const relevant = JSON.stringify({
    title,
    description: clean(raw.description),
    imageUrl,
    speakers,
    startDate,
    endDate: end?.toISOString(),
    city: clean(raw.city),
    venue: clean(raw.venue),
    url,
    status,
  });
  const seenAt = now.toISOString();
  return {
    id: digest(identity).slice(0, 24),
    sourceId: raw.sourceId,
    source: raw.source,
    userGroupId: raw.userGroupId,
    title,
    description: clean(raw.description),
    imageUrl,
    speakers,
    startDate,
    endDate: end?.toISOString(),
    timezone,
    city,
    venue: clean(raw.venue),
    url,
    status,
    firstSeen: seenAt,
    lastSeen: seenAt,
    contentHash: digest(relevant),
  };
}

const sourceTrust: Record<CommunityEvent['source'], number> = {
  manual: 4,
  'meetup-public-page': 3,
  'meetup-rss': 2,
  'custom-website': 1,
};

function trust(event: CommunityEvent): number {
  if (event.status === 'PENDING_REVIEW') return 0;
  return sourceTrust[event.source];
}

export function deduplicationKey(event: CommunityEvent): string {
  return `${event.userGroupId}|${canonicalTitle(event.title)}|${event.startDate.slice(0, 16)}`;
}

export function deduplicateEvents(events: CommunityEvent[]): CommunityEvent[] {
  const unique = new Map<string, CommunityEvent>();
  for (const event of events) {
    const key = deduplicationKey(event);
    const current = unique.get(key);
    if (!current || trust(event) > trust(current)) unique.set(key, event);
  }
  return [...unique.values()].sort((a, b) => a.startDate.localeCompare(b.startDate));
}

const PUBLISHABLE_STATUSES = new Set<CommunityEvent['status']>(['AUTO_PUBLISHED', 'MANUAL']);

/**
 * Marks a finished publishable event as PAST. Only AUTO_PUBLISHED and MANUAL events
 * transition, so PAST always means "was publishable": an event still pending review
 * never becomes public just because its date has gone by.
 */
export function transitionPast(event: CommunityEvent, now = new Date()): CommunityEvent {
  if (!PUBLISHABLE_STATUSES.has(event.status)) return event;
  const boundary = new Date(event.endDate ?? event.startDate);
  return boundary < now ? { ...event, status: 'PAST' } : event;
}
