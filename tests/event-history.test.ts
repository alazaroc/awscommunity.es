import { describe, expect, it } from 'vitest';
import { groupByMonth, pastEvents, yearActivity } from '../src/lib/events';
import { eventPlace, historyByYear, speakerNames, timelineStart, yearCaption } from '../src/lib/history';
import type { CommunityEvent } from '../src/lib/types';

const event = (id: string, startDate: string, overrides: Partial<CommunityEvent> = {}): CommunityEvent => ({
  id,
  sourceId: `meetup:${id}`,
  source: 'meetup-public-page',
  userGroupId: 'zaragoza',
  title: `Event ${id}`,
  startDate,
  timezone: 'Europe/Madrid',
  city: 'Zaragoza',
  url: `https://www.meetup.com/awszgz/events/${id}/`,
  status: 'PAST',
  firstSeen: '2026-01-01T00:00:00.000Z',
  lastSeen: '2026-01-01T00:00:00.000Z',
  contentHash: 'hash',
  ...overrides,
});

const now = new Date('2026-11-10T12:00:00.000Z');

describe('event history', () => {
  it('lists held events newest first and excludes cancelled, pending and upcoming ones', () => {
    const snapshot = {
      events: [
        event('old', '2026-02-10T17:00:00.000Z'),
        event('recent', '2026-10-20T17:00:00.000Z'),
        event('cancelled', '2026-09-01T17:00:00.000Z', { status: 'CANCELLED' }),
        event('pending', '2026-09-02T17:00:00.000Z', { status: 'PENDING_REVIEW' }),
        event('upcoming', '2026-12-01T17:00:00.000Z', { status: 'AUTO_PUBLISHED' }),
      ],
    };
    expect(pastEvents(snapshot, now).map((item) => item.id)).toEqual(['recent', 'old']);
  });

  it('treats a published event that ended after the snapshot was built as past', () => {
    const ended = event('ended', '2026-11-09T17:00:00.000Z', { status: 'AUTO_PUBLISHED' });
    expect(pastEvents({ events: [ended] }, now).map((item) => item.id)).toEqual(['ended']);
  });

  it('filters by group and by start date', () => {
    const snapshot = {
      events: [
        event('a', '2025-06-10T17:00:00.000Z'),
        event('b', '2026-06-10T17:00:00.000Z'),
        event('c', '2026-07-10T17:00:00.000Z', { userGroupId: 'madrid' }),
      ],
    };
    expect(pastEvents(snapshot, now, { groupId: 'zaragoza' }).map((item) => item.id)).toEqual(['b', 'a']);
    expect(pastEvents(snapshot, now, { since: new Date('2026-01-01T00:00:00.000Z') }).map((item) => item.id)).toEqual(['c', 'b']);
  });

  it('summarizes one year for the whole community, using the event time zone', () => {
    const snapshot = {
      events: [
        // 23:30 UTC on 31 Dec 2025 is already 2026 in Madrid.
        event('new-year', '2025-12-31T23:30:00.000Z'),
        event('held', '2026-05-10T17:00:00.000Z', { userGroupId: 'madrid' }),
        event('previous-year', '2025-05-10T17:00:00.000Z'),
        event('announced', '2026-12-01T17:00:00.000Z', { status: 'AUTO_PUBLISHED', userGroupId: 'galicia' }),
        event('next-year', '2027-01-20T17:00:00.000Z', { status: 'AUTO_PUBLISHED' }),
        event('cancelled', '2026-06-01T17:00:00.000Z', { status: 'CANCELLED', userGroupId: 'bilbao' }),
      ],
    };
    expect(yearActivity(snapshot, 2026, now)).toEqual({ year: 2026, held: 2, upcoming: 1, groups: 3 });
  });

  it('groups consecutive events by Spanish month label', () => {
    const months = groupByMonth([
      event('a', '2026-10-20T17:00:00.000Z'),
      event('b', '2026-10-02T17:00:00.000Z'),
      event('c', '2026-09-15T17:00:00.000Z'),
    ]);
    expect(months.map((month) => [month.label, month.events.length])).toEqual([
      ['octubre de 2026', 2],
      ['septiembre de 2026', 1],
    ]);
  });
});

describe('history presentation helpers', () => {
  it('splits a newest-first history into years in the event time zone', () => {
    const years = historyByYear([
      event('a', '2026-03-01T17:00:00.000Z'),
      // 23:30 UTC on 31 Dec 2025 is already 2026 in Madrid.
      event('b', '2025-12-31T23:30:00.000Z'),
      event('c', '2025-06-01T17:00:00.000Z'),
    ]);
    expect(years.map((year) => [year.year, year.events.map((item) => item.id)])).toEqual([
      [2026, ['a', 'b']],
      [2025, ['c']],
    ]);
  });

  it('formats captions, places and speakers without inventing data', () => {
    expect(yearCaption(2026, 1)).toBe('2026 · 1 evento');
    expect(yearCaption(2026, 7)).toBe('2026 · 7 eventos');
    expect(eventPlace(event('a', '2026-03-01T17:00:00.000Z', { venue: 'Impact Hub' }))).toBe('Impact Hub · Zaragoza');
    expect(eventPlace(event('a', '2026-03-01T17:00:00.000Z'))).toBe('Zaragoza');
    expect(speakerNames(event('a', '2026-03-01T17:00:00.000Z'))).toBe('');
  });

  it('opens the timeline window the given number of months back', () => {
    expect(timelineStart(new Date('2026-11-10T12:00:00.000Z'), 12).toISOString()).toBe('2025-11-10T12:00:00.000Z');
  });
});
