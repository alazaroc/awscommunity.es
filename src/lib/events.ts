// Shared event-selection and validation helpers, usable from Astro and browser refreshes.

import type { CommunityEvent, EventsSnapshot } from './types';
import type { Locale } from './i18n';
const PUBLISHABLE = new Set(['AUTO_PUBLISHED', 'MANUAL']);

export function isSafeHttpsUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch {
    return false;
  }
}

export function isCommunityEvent(value: unknown): value is CommunityEvent {
  if (!value || typeof value !== 'object') return false;
  const event = value as Record<string, unknown>;
  if (
    typeof event.id !== 'string' ||
    typeof event.sourceId !== 'string' ||
    typeof event.source !== 'string' ||
    typeof event.userGroupId !== 'string' ||
    typeof event.title !== 'string' ||
    typeof event.startDate !== 'string' ||
    typeof event.timezone !== 'string' ||
    typeof event.city !== 'string' ||
    typeof event.status !== 'string' ||
    !isSafeHttpsUrl(event.url) ||
    Number.isNaN(new Date(event.startDate).valueOf())
  ) return false;
  if (event.endDate !== undefined && (typeof event.endDate !== 'string' || Number.isNaN(new Date(event.endDate).valueOf()))) return false;
  const start = new Date(event.startDate);
  const end = event.endDate === undefined ? undefined : new Date(event.endDate);
  if (end && end < start) return false;
  try { new Intl.DateTimeFormat('es-ES', { timeZone: event.timezone as string }).format(start); }
  catch { return false; }
  if (event.imageUrl !== undefined && !isSafeHttpsUrl(event.imageUrl)) return false;
  if (event.description !== undefined && typeof event.description !== 'string') return false;
  if (event.speakers !== undefined) {
    if (!Array.isArray(event.speakers) || event.speakers.length > 8) return false;
    if (event.speakers.some((speaker) => {
      if (!speaker || typeof speaker !== 'object') return true;
      const candidate = speaker as Record<string, unknown>;
      return typeof candidate.name !== 'string' || (candidate.url !== undefined && !isSafeHttpsUrl(candidate.url));
    })) return false;
  }
  return true;
}

export function parseEventsSnapshot(value: unknown): EventsSnapshot | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const snapshot = value as Record<string, unknown>;
  if (typeof snapshot.generatedAt !== 'string' || Number.isNaN(new Date(snapshot.generatedAt).valueOf()) || !Array.isArray(snapshot.events)) return undefined;
  const events = snapshot.events.filter(isCommunityEvent);
  if (events.length !== snapshot.events.length) return undefined;
  return { generatedAt: snapshot.generatedAt, events };
}

/** Publishable events that have not ended, sorted ascending. Optional group filter. */
export function upcomingEvents(
  snapshot: Pick<EventsSnapshot, 'events'>,
  now: Date = new Date(),
  groupId?: string,
): CommunityEvent[] {
  return snapshot.events
    .filter((event) =>
      PUBLISHABLE.has(event.status) &&
      new Date(event.endDate ?? event.startDate) >= now &&
      (!groupId || event.userGroupId === groupId),
    )
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
}

/** Calendar month key in the event's own time zone, used by the month filter. */
export function eventMonthKey(event: CommunityEvent): string {
  const parts = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', timeZone: event.timezone }).formatToParts(new Date(event.startDate));
  const year = parts.find((part) => part.type === 'year')?.value ?? '';
  const month = parts.find((part) => part.type === 'month')?.value ?? '';
  return `${year}-${month}`;
}

export interface EventFilterOptions {
  userGroupId?: string;
  city?: string;
  month?: string;
  query?: string;
  groupNames?: Record<string, string>;
}

function searchValue(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase();
}

/** Applies the event-page filters without depending on DOM state. */
export function filterEvents(events: CommunityEvent[], options: EventFilterOptions = {}): CommunityEvent[] {
  const query = searchValue(options.query?.trim() ?? '');
  return events.filter((event) => {
    if (options.userGroupId && event.userGroupId !== options.userGroupId) return false;
    if (options.city && event.city !== options.city) return false;
    if (options.month && eventMonthKey(event) !== options.month) return false;
    if (!query) return true;
    const haystack = searchValue([
      event.title,
      event.description ?? '',
      event.city,
      event.venue ?? '',
      options.groupNames?.[event.userGroupId] ?? event.userGroupId,
    ].join(' '));
    return haystack.includes(query);
  });
}


export function upcomingGroupIds(
  snapshot: Pick<EventsSnapshot, 'events'>,
  now: Date = new Date(),
): string[] {
  const ids = new Set<string>();
  for (const event of upcomingEvents(snapshot, now)) ids.add(event.userGroupId);
  return [...ids];
}

/**
 * IDs of user groups whose upcoming activity was *recently discovered* by the
 * pipeline — i.e. at least one upcoming publishable event was first seen within
 * `withinDays` of the snapshot's `generatedAt`. Uses the real `firstSeen`
 * timestamp written by the discovery backend; never fabricates recency. Events
 * without a parseable `firstSeen` are simply not counted as fresh.
 */
export function freshlyDiscoveredGroupIds(
  snapshot: Pick<EventsSnapshot, 'events' | 'generatedAt'>,
  withinDays = 7,
  now: Date = new Date(),
): string[] {
  const reference = new Date(snapshot.generatedAt);
  const anchor = Number.isNaN(reference.valueOf()) ? now : reference;
  const cutoff = anchor.getTime() - withinDays * 86_400_000;
  const ids = new Set<string>();
  for (const event of upcomingEvents(snapshot, now)) {
    const firstSeen = new Date(event.firstSeen);
    if (Number.isNaN(firstSeen.valueOf())) continue;
    if (firstSeen.getTime() >= cutoff) ids.add(event.userGroupId);
  }
  return [...ids];
}

const hasEnded = (event: CommunityEvent, now: Date) => new Date(event.endDate ?? event.startDate) < now;

/**
 * Events that already took place, newest first. Includes PAST events and publishable
 * events that ended after the snapshot was generated; cancelled and pending-review
 * events are never part of the history.
 */
export function pastEvents(
  snapshot: Pick<EventsSnapshot, 'events'>,
  now: Date = new Date(),
  options: { groupId?: string; since?: Date } = {},
): CommunityEvent[] {
  const { groupId, since } = options;
  return snapshot.events
    .filter((event) =>
      (event.status === 'PAST' || (PUBLISHABLE.has(event.status) && hasEnded(event, now))) &&
      (!groupId || event.userGroupId === groupId) &&
      (!since || new Date(event.startDate) >= since),
    )
    .sort((a, b) => b.startDate.localeCompare(a.startDate));
}

/** Calendar year of an event's start, in the event's own time zone. */
export function eventYear(event: CommunityEvent): number {
  return Number(new Intl.DateTimeFormat('en', { year: 'numeric', timeZone: event.timezone }).format(new Date(event.startDate)));
}

export interface YearActivity {
  year: number;
  held: number;
  upcoming: number;
  groups: number;
}

/**
 * Aggregate community activity for one calendar year: events already held, upcoming
 * events announced for that year, and how many User Groups organized them. It is a
 * community-wide total; it never breaks the figures down per group.
 */
export function yearActivity(
  snapshot: Pick<EventsSnapshot, 'events'>,
  year: number,
  now: Date = new Date(),
): YearActivity {
  const held = pastEvents(snapshot, now).filter((event) => eventYear(event) === year);
  const upcoming = upcomingEvents(snapshot, now).filter((event) => eventYear(event) === year);
  const groups = new Set([...held, ...upcoming].map((event) => event.userGroupId));
  return { year, held: held.length, upcoming: upcoming.length, groups: groups.size };
}

/** Groups events by localized "month year" label, preserving the input order. */
export function groupByMonth(events: CommunityEvent[], locale: Locale = 'es'): { label: string; events: CommunityEvent[] }[] {
  const months: { label: string; events: CommunityEvent[] }[] = [];
  for (const event of events) {
    const label = new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'es-ES', { month: 'long', year: 'numeric', timeZone: event.timezone })
      .format(new Date(event.startDate));
    const current = months.at(-1);
    if (current?.label === label) current.events.push(event);
    else months.push({ label, events: [event] });
  }
  return months;
}
