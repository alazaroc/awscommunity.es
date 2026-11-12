// Presentation helpers for event history, shared by the static HTML and the
// browser refresh so both always render the same values.

import type { CommunityEvent } from './types';
import { eventYear } from './events';

import type { Locale } from './i18n';

export const SITE_TIMEZONE = 'Europe/Madrid';
export const TIMELINE_MONTHS = 12;

/** Current calendar year in the site's time zone. */
export function currentYear(now: Date = new Date()): number {
  return Number(new Intl.DateTimeFormat('en', { year: 'numeric', timeZone: SITE_TIMEZONE }).format(now));
}

/** Start of the recent-activity window: the same instant `months` months ago. */
export function timelineStart(now: Date = new Date(), months = TIMELINE_MONTHS): Date {
  const start = new Date(now);
  start.setMonth(start.getMonth() - months);
  return start;
}

/** Splits a newest-first history into years, preserving order. */
export function historyByYear(events: CommunityEvent[]): { year: number; events: CommunityEvent[] }[] {
  const years: { year: number; events: CommunityEvent[] }[] = [];
  for (const event of events) {
    const year = eventYear(event);
    const current = years.at(-1);
    if (current?.year === year) current.events.push(event);
    else years.push({ year, events: [event] });
  }
  return years;
}

export const yearCaption = (year: number, count: number, locale: Locale = 'es') => {
  if (locale === 'en') return `${year} · ${count} ${count === 1 ? 'event' : 'events'}`;
  return `${year} · ${count} ${count === 1 ? 'evento' : 'eventos'}`;
};

export const shortDate = (event: CommunityEvent, locale: Locale = 'es') => new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'es-ES', {
  day: 'numeric', month: 'short', timeZone: event.timezone,
}).format(new Date(event.startDate)).replace('.', '');

export const dayOfMonth = (event: CommunityEvent, locale: Locale = 'es') => new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'es-ES', {
  day: '2-digit', timeZone: event.timezone,
}).format(new Date(event.startDate));

export const eventPlace = (event: CommunityEvent) => [event.venue, event.city].filter(Boolean).join(' · ');

/** Speaker names as published; empty when the source provided none (never inferred). */
export const speakerNames = (event: CommunityEvent) => event.speakers?.map((speaker) => speaker.name).join(', ') ?? '';
