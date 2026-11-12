import { describe, expect, it } from 'vitest';
import { isCommunityEvent, parseEventsSnapshot, upcomingEvents } from '../src/lib/events';
import type { CommunityEvent } from '../src/lib/types';

const event = (overrides: Partial<CommunityEvent> = {}): CommunityEvent => ({
  id: 'event-1',
  sourceId: 'meetup:1',
  source: 'meetup-public-page',
  userGroupId: 'zaragoza',
  title: 'AWS Builders',
  startDate: '2027-02-10T17:00:00.000Z',
  endDate: '2027-02-10T20:00:00.000Z',
  timezone: 'Europe/Madrid',
  city: 'Zaragoza',
  url: 'https://www.meetup.com/awszgz/events/1/',
  status: 'AUTO_PUBLISHED',
  firstSeen: '2027-01-01T00:00:00.000Z',
  lastSeen: '2027-01-01T00:00:00.000Z',
  contentHash: 'hash',
  ...overrides,
});

describe('frontend event selection', () => {
  it('keeps an event visible while it is in progress', () => {
    expect(upcomingEvents({ events: [event()] }, new Date('2027-02-10T18:00:00.000Z'))).toHaveLength(1);
    expect(upcomingEvents({ events: [event()] }, new Date('2027-02-10T20:00:01.000Z'))).toHaveLength(0);
  });

  it('accepts optional safe image and speaker metadata', () => {
    expect(isCommunityEvent(event({
      imageUrl: 'https://secure-content.meetupstatic.com/images/event/676x380.jpg',
      speakers: [{ name: 'Ada Builder', url: 'https://example.com/ada' }],
    }))).toBe(true);
  });

  it('rejects unsafe remote URLs instead of rendering them', () => {
    expect(isCommunityEvent(event({ imageUrl: 'javascript:alert(1)' }))).toBe(false);
    expect(parseEventsSnapshot({
      generatedAt: '2027-01-01T00:00:00.000Z',
      events: [event({ url: 'http://example.com/event' })],
    })).toBeUndefined();
  });
});
