import { describe, expect, it } from 'vitest';
import { generateSnapshot } from '../backend/normalization/snapshot';
import { normalizeEvent } from '../backend/normalization/events';
import type { RawEvent } from '../backend/sources/types';

const event = (id: string, startDate: string, status: RawEvent['status'] = 'AUTO_PUBLISHED') => normalizeEvent({
  sourceId: id, source: status === 'MANUAL' ? 'manual' : 'meetup-rss', userGroupId: 'madrid',
  title: `Event ${id}`, startDate, timezone: 'Europe/Madrid', city: 'Madrid',
  url: `https://example.com/${id}`, status,
}, new Date('2026-10-28T00:00:00Z'));

describe('public snapshot', () => {
  it('contains publishable and past events in chronological order, never reviews or cancellations', () => {
    const snapshot = generateSnapshot([
      event('later', '2027-03-01T18:00:00Z'),
      event('past', '2026-01-01T18:00:00Z'),
      event('review', '2027-01-01T18:00:00Z', 'PENDING_REVIEW'),
      event('past-review', '2026-02-01T18:00:00Z', 'PENDING_REVIEW'),
      event('cancelled', '2027-01-15T18:00:00Z', 'CANCELLED'),
      event('manual', '2027-02-01T18:00:00Z', 'MANUAL'),
    ], new Date('2026-10-28T00:00:00Z'));
    expect(snapshot.events.map((item) => [item.sourceId, item.status])).toEqual([
      ['past', 'PAST'],
      ['manual', 'MANUAL'],
      ['later', 'AUTO_PUBLISHED'],
    ]);
    expect(snapshot.generatedAt).toBe('2026-10-28T00:00:00.000Z');
  });
});
