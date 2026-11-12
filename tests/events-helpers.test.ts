import { describe, expect, it } from 'vitest';
import { eventMonthKey, filterEvents, upcomingEvents, upcomingGroupIds, freshlyDiscoveredGroupIds } from '../src/lib/events';
import type { CommunityEvent } from '../src/lib/types';

const now = new Date('2026-06-01T00:00:00Z');

const event = (over: Partial<CommunityEvent>): CommunityEvent => ({
  id: over.id ?? Math.random().toString(36).slice(2),
  sourceId: 'sid',
  source: 'manual',
  userGroupId: over.userGroupId ?? 'madrid',
  title: 'Evento',
  startDate: over.startDate ?? '2026-07-01T18:00:00+02:00',
  timezone: 'Europe/Madrid',
  city: 'Madrid',
  url: 'https://example.com',
  status: over.status ?? 'MANUAL',
  firstSeen: '2026-05-01T00:00:00Z',
  lastSeen: '2026-05-01T00:00:00Z',
  contentHash: 'h',
  ...over,
});

describe('upcomingEvents', () => {
  it('keeps only publishable future events, sorted', () => {
    const snapshot = { events: [
      event({ id: 'b', startDate: '2026-08-01T18:00:00+02:00' }),
      event({ id: 'a', startDate: '2026-07-01T18:00:00+02:00' }),
      event({ id: 'past', startDate: '2026-01-01T18:00:00+01:00' }),
      event({ id: 'pending', status: 'PENDING_REVIEW' }),
      event({ id: 'cancelled', status: 'CANCELLED' }),
    ] };
    const result = upcomingEvents(snapshot, now).map((e) => e.id);
    expect(result).toEqual(['a', 'b']);
  });

  it('filters by group when requested', () => {
    const snapshot = { events: [
      event({ id: 'm', userGroupId: 'madrid' }),
      event({ id: 'b', userGroupId: 'barcelona' }),
    ] };
    expect(upcomingEvents(snapshot, now, 'barcelona').map((e) => e.id)).toEqual(['b']);
  });
});

describe('event filters', () => {
  const events = [
    event({ id: 'madrid', title: 'Serverless Madrid', description: 'Arquitectura cloud', venue: 'Campus Madrid' }),
    event({ id: 'malaga', userGroupId: 'malaga', city: 'Málaga', title: 'AWS Málaga', startDate: '2026-08-01T18:00:00+02:00' }),
    event({ id: 'barcelona', userGroupId: 'barcelona', city: 'Barcelona', title: 'Community night', startDate: '2026-09-01T18:00:00+02:00' }),
  ];
  const groups = { madrid: 'AWS User Group Madrid', malaga: 'AWS User Group Málaga', barcelona: 'AWS User Group Barcelona' };

  it('matches search text across title, description, venue and group names', () => {
    expect(filterEvents(events, { query: 'arquitectura' }).map((item) => item.id)).toEqual(['madrid']);
    expect(filterEvents(events, { query: 'malaga' }).map((item) => item.id)).toEqual(['malaga']);
    expect(filterEvents(events, { query: 'CAMPUS' }).map((item) => item.id)).toEqual(['madrid']);
  });

  it('combines group, city and local month filters', () => {
    expect(eventMonthKey(events[1])).toBe('2026-08');
    expect(filterEvents(events, { userGroupId: 'malaga', city: 'Málaga', month: '2026-08', groupNames: groups }).map((item) => item.id)).toEqual(['malaga']);
    expect(filterEvents(events, { userGroupId: 'malaga', month: '2026-09', groupNames: groups })).toEqual([]);
  });

  it('returns all events when filters are cleared', () => {
    expect(filterEvents(events, { groupNames: groups })).toEqual(events);
  });
});

describe('upcomingGroupIds', () => {
  it('returns unique group ids with upcoming events', () => {
    const snapshot = { events: [
      event({ userGroupId: 'madrid' }),
      event({ userGroupId: 'madrid', startDate: '2026-09-01T18:00:00+02:00' }),
      event({ userGroupId: 'barcelona' }),
      event({ userGroupId: 'sevilla', status: 'PENDING_REVIEW' }),
      event({ userGroupId: 'bilbao', startDate: '2026-01-01T00:00:00Z' }),
    ] };
    expect(upcomingGroupIds(snapshot, now).sort()).toEqual(['barcelona', 'madrid']);
  });

  it('returns empty array when nothing qualifies', () => {
    expect(upcomingGroupIds({ events: [] }, now)).toEqual([]);
  });
});

describe('freshlyDiscoveredGroupIds', () => {
  const generatedAt = '2026-06-01T00:00:00Z'; // same as `now`

  it('flags groups whose upcoming event was first seen within the window', () => {
    const snapshot = {
      generatedAt,
      events: [
        // Discovered 2 days before the snapshot -> fresh.
        event({ userGroupId: 'madrid', firstSeen: '2026-05-30T00:00:00Z' }),
        // Discovered 30 days ago -> not fresh.
        event({ userGroupId: 'barcelona', firstSeen: '2026-05-02T00:00:00Z' }),
      ],
    };
    expect(freshlyDiscoveredGroupIds(snapshot, 7, now)).toEqual(['madrid']);
  });

  it('ignores past or non-publishable events even if freshly seen', () => {
    const snapshot = {
      generatedAt,
      events: [
        event({ userGroupId: 'past', startDate: '2026-01-01T00:00:00Z', firstSeen: '2026-05-31T00:00:00Z' }),
        event({ userGroupId: 'pending', status: 'PENDING_REVIEW', firstSeen: '2026-05-31T00:00:00Z' }),
      ],
    };
    expect(freshlyDiscoveredGroupIds(snapshot, 7, now)).toEqual([]);
  });

  it('does not count events with a missing or unparseable firstSeen', () => {
    const snapshot = {
      generatedAt,
      events: [
        event({ userGroupId: 'broken', firstSeen: 'not-a-date' }),
      ],
    };
    expect(freshlyDiscoveredGroupIds(snapshot, 7, now)).toEqual([]);
  });

  it('respects a custom window length', () => {
    const snapshot = {
      generatedAt,
      events: [event({ userGroupId: 'madrid', firstSeen: '2026-05-20T00:00:00Z' })], // 12 days old
    };
    expect(freshlyDiscoveredGroupIds(snapshot, 7, now)).toEqual([]);
    expect(freshlyDiscoveredGroupIds(snapshot, 14, now)).toEqual(['madrid']);
  });
});
