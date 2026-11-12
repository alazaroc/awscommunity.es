import { describe, expect, it } from 'vitest';
import { deduplicateEvents, normalizeEvent, transitionPast } from '../backend/normalization/events';
import type { RawEvent } from '../backend/sources/types';

const raw = (overrides: Partial<RawEvent> = {}): RawEvent => ({
  sourceId: 'source-1', source: 'meetup-rss', userGroupId: 'madrid', title: 'Serverless Night',
  startDate: '2027-01-15T18:00:00+01:00', timezone: 'Europe/Madrid', city: 'Madrid',
  url: 'https://example.com/events/1', status: 'AUTO_PUBLISHED', ...overrides,
});

describe('event normalization', () => {
  it('creates stable IDs and hashes relevant content', () => {
    const first = normalizeEvent(raw(), new Date('2026-10-28T00:00:00Z'));
    const second = normalizeEvent(raw(), new Date('2026-10-29T00:00:00Z'));
    expect(first.id).toBe(second.id);
    expect(first.contentHash).toBe(second.contentHash);
    expect(first.firstSeen).not.toBe(second.firstSeen);
  });

  it('detects relevant modifications while preserving source identity', () => {
    const first = normalizeEvent(raw(), new Date('2026-10-28T00:00:00Z'));
    const changed = normalizeEvent(raw({ venue: 'New venue', startDate: '2027-01-15T19:00:00+01:00' }), new Date('2026-10-28T00:00:00Z'));
    expect(changed.id).toBe(first.id);
    expect(changed.contentHash).not.toBe(first.contentHash);
  });

  it('rejects invalid date ranges', () => {
    expect(() => normalizeEvent(raw({ endDate: '2027-01-14T18:00:00Z' }))).toThrow('Invalid end date');
  });
});

describe('deduplication', () => {
  it('keeps an auto-published RSS event over an unapproved page candidate', () => {
    const rss = normalizeEvent(raw());
    const page = normalizeEvent(raw({ source: 'meetup-public-page', sourceId: 'page-1', status: 'PENDING_REVIEW' }));
    expect(deduplicateEvents([page, rss])).toEqual([rss]);
  });

  it('prefers a validated public page because it contains richer metadata', () => {
    const rss = normalizeEvent(raw());
    const page = normalizeEvent(raw({
      source: 'meetup-public-page',
      sourceId: 'meetup:1',
      imageUrl: 'https://secure-content.meetupstatic.com/images/event/676x380.jpg',
      status: 'AUTO_PUBLISHED',
    }));
    expect(deduplicateEvents([rss, page])).toEqual([page]);
  });

  it('lets an explicit page cancellation override RSS data', () => {
    const rss = normalizeEvent(raw());
    const cancelled = normalizeEvent(raw({
      source: 'meetup-public-page', sourceId: 'meetup:1', status: 'CANCELLED',
    }));
    expect(deduplicateEvents([rss, cancelled])).toEqual([cancelled]);
  });
});

describe('past transition', () => {
  it('moves an event to PAST after its end without deleting it', () => {
    const event = normalizeEvent(raw({ endDate: '2027-01-15T20:00:00+01:00' }));
    expect(transitionPast(event, new Date('2027-01-15T19:30:00Z')).status).toBe('PAST');
    expect(transitionPast(event, new Date('2027-01-15T17:30:00Z')).status).toBe('AUTO_PUBLISHED');
  });

  it('never turns a pending-review or cancelled event into a public PAST event', () => {
    const later = new Date('2028-01-01T00:00:00Z');
    const pending = normalizeEvent(raw({ status: 'PENDING_REVIEW' }));
    const cancelled = normalizeEvent(raw({ status: 'CANCELLED' }));
    expect(transitionPast(pending, later).status).toBe('PENDING_REVIEW');
    expect(transitionPast(cancelled, later).status).toBe('CANCELLED');
  });
});
