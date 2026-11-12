import { describe, expect, it } from 'vitest';
import { userGroups } from '../config/user-groups';
import { MeetupReviewError, meetupEventReference, parseMeetupEventPage } from '../backend/sources/public-page';

const group = userGroups.find((candidate) => candidate.id === 'zaragoza')!;
const eventUrl = 'https://www.meetup.com/es-ES/awszgz/events/316949236/';

const eventHtml = (overrides: Record<string, unknown> = {}) => `<!doctype html>
<script type="application/ld+json">
${JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'Event',
  name: 'Agentic SDLC en AWS',
  url: 'https://www.meetup.com/awszgz/events/316949236/',
  description: 'Un encuentro práctico de la comunidad.',
  startDate: '2027-10-26T18:00:00+01:00',
  endDate: '2027-10-26T21:00:00+01:00',
  eventStatus: 'https://schema.org/EventScheduled',
  image: [
    'https://secure-content.meetupstatic.com/images/classic-events/123/676x676.jpg',
    'https://secure-content.meetupstatic.com/images/classic-events/123/676x380.jpg',
  ],
  performer: [
    { '@type': 'Person', name: 'Ada Builder', url: 'https://example.com/ada' },
    { '@type': 'Person', name: 'Lin Cloud' },
  ],
  location: {
    '@type': 'Place',
    name: 'Centro Empresarial El Trovador',
    address: { '@type': 'PostalAddress', addressLocality: 'Zaragoza' },
  },
  organizer: {
    '@type': 'Organization',
    name: 'AWS Zaragoza User Group',
    url: 'https://www.meetup.com/awszgz/',
  },
  ...overrides,
})}
</script>`;

describe('public Meetup event pages', () => {
  it('canonicalizes public event URLs and creates a stable Meetup identity', () => {
    expect(meetupEventReference(eventUrl, group)).toEqual({
      sourceId: 'meetup:316949236',
      eventId: '316949236',
      url: 'https://www.meetup.com/awszgz/events/316949236/',
    });
  });

  it('extracts validated event data, a landscape image and structured speakers', () => {
    expect(parseMeetupEventPage(eventHtml(), group, eventUrl)).toMatchObject({
      sourceId: 'meetup:316949236',
      source: 'meetup-public-page',
      userGroupId: 'zaragoza',
      title: 'Agentic SDLC en AWS',
      startDate: '2027-10-26T17:00:00.000Z',
      endDate: '2027-10-26T20:00:00.000Z',
      city: 'Zaragoza',
      venue: 'Centro Empresarial El Trovador',
      imageUrl: 'https://secure-content.meetupstatic.com/images/classic-events/123/676x380.jpg',
      speakers: [
        { name: 'Ada Builder', url: 'https://example.com/ada' },
        { name: 'Lin Cloud' },
      ],
      status: 'AUTO_PUBLISHED',
    });
  });

  it('maps an explicit Schema.org cancellation without guessing', () => {
    const event = parseMeetupEventPage(eventHtml({ eventStatus: 'https://schema.org/EventCancelled' }), group, eventUrl);
    expect(event.status).toBe('CANCELLED');
  });

  it('retains a safe draft when the Schema.org status needs review', () => {
    try {
      parseMeetupEventPage(eventHtml({ eventStatus: 'https://schema.org/EventPostponed' }), group, eventUrl);
      throw new Error('Expected parser to require review');
    } catch (error) {
      expect(error).toBeInstanceOf(MeetupReviewError);
      expect((error as MeetupReviewError).draft).toMatchObject({
        sourceId: 'meetup:316949236',
        status: 'PENDING_REVIEW',
      });
    }
  });

  it('rejects dates without an explicit offset', () => {
    expect(() => parseMeetupEventPage(eventHtml({ startDate: '2027-10-26T18:00:00' }), group, eventUrl))
      .toThrow('incomplete or ambiguous dates');
  });

  it('rejects an organizer from another Meetup group', () => {
    expect(() => parseMeetupEventPage(eventHtml({
      organizer: { '@type': 'Organization', name: 'Another group', url: 'https://www.meetup.com/another-group/' },
    }), group, eventUrl)).toThrow('unexpected organizer');
  });

  it('rejects event links that do not belong to the configured group', () => {
    expect(() => meetupEventReference('https://www.meetup.com/another-group/events/316949236/', group))
      .toThrow('does not belong');
    expect(() => meetupEventReference('https://example.com/awszgz/events/316949236/', group))
      .toThrow('Unsafe Meetup event URL');
  });
});
