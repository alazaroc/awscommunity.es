import { afterEach, describe, expect, it, vi } from 'vitest';
import { userGroups } from '../config/user-groups';
import { discoverMeetupHistory, parseMeetupListing } from '../backend/sources/meetup-listing';

const group = userGroups.find((candidate) => candidate.id === 'zaragoza')!;
const listing = `
  <a href="https://www.meetup.com/awszgz/events/316949236/">valid</a>
  <a href="/awszgz/events/316949236/?source=duplicate">duplicate</a>
  <a href="https://www.meetup.com/awszgz/events/316900000/">older</a>
  <a href="https://www.meetup.com/other-group/events/316949236/">other group</a>
  <a href="https://example.com/awszgz/events/316949236/">unsafe host</a>
  <a href="javascript:alert(1)">unsafe protocol</a>
  <link href="https://www.meetup.com/awszgz/events/316800001/">
  <div data-href="https://www.meetup.com/awszgz/events/316800002/">not an anchor</div>
`;

function page(id: string, startDate: string) {
  return `<script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: `Event ${id}`,
    url: `https://www.meetup.com/awszgz/events/${id}/`,
    startDate,
    endDate: startDate.replace('18:00:00', '20:00:00'),
    eventStatus: 'https://schema.org/EventScheduled',
    location: { '@type': 'Place', name: 'Venue', address: { addressLocality: 'Zaragoza' } },
    organizer: { '@type': 'Organization', name: 'AWS Zaragoza', url: 'https://www.meetup.com/awszgz/' },
  })}</script>`;
}

afterEach(() => vi.unstubAllGlobals());

describe('public Meetup history discovery', () => {
  it('extracts unique canonical links for the configured group only', () => {
    expect(parseMeetupListing(listing, group)).toEqual([
      expect.objectContaining({ sourceId: 'meetup:316949236' }),
      expect.objectContaining({ sourceId: 'meetup:316900000' }),
    ]);
  });

  it('imports only events at or after the configured cutoff', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(listing, { status: 200 }))
      .mockResolvedValueOnce(new Response(page('316949236', '2026-10-26T18:00:00+01:00'), { status: 200 }))
      .mockResolvedValueOnce(new Response(page('316900000', '2025-12-10T18:00:00+01:00'), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await discoverMeetupHistory(group, '2026-01-01', new Date('2026-11-01T00:00:00Z'));

    expect(result.events).toEqual([expect.objectContaining({ sourceId: 'meetup:316949236' })]);
    expect(result.reviewCandidates).toEqual([]);
    expect(result.state).toMatchObject({
      from: '2026-01-01',
      status: 'COMPLETED',
      visibleUrls: 2,
      imported: 1,
      ignoredBeforeCutoff: 1,
      reviewRequired: 0,
      failedUrls: [],
    });
  });

  it('completes with a persisted review when a visible page is ambiguous', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('<a href="/awszgz/events/316949236/">event</a>', { status: 200 }))
      .mockResolvedValueOnce(new Response('<html>missing structured event</html>', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await discoverMeetupHistory(group, '2026-01-01');

    expect(result.events).toEqual([]);
    expect(result.reviewCandidates).toEqual([
      expect.objectContaining({ sourceId: 'meetup:316949236', userGroupId: 'zaragoza' }),
    ]);
    expect(result.state.status).toBe('COMPLETED_WITH_REVIEWS');
    expect(result.state.failedUrls).toEqual([]);
  });

  it('marks transient event-page failures as partial instead of moderation work', async () => {
    const eventUrl = 'https://www.meetup.com/awszgz/events/316949236/';
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(`<a href="${eventUrl}">event</a>`, { status: 200 }))
      .mockResolvedValueOnce(new Response('temporarily unavailable', { status: 503 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await discoverMeetupHistory(group, '2026-01-01');

    expect(result.events).toEqual([]);
    expect(result.reviewCandidates).toEqual([]);
    expect(result.state.status).toBe('PARTIAL');
    expect(result.state.failedUrls).toEqual([eventUrl]);
  });

  it('rejects impossible calendar cutoff dates', async () => {
    await expect(discoverMeetupHistory(group, '2026-02-31')).rejects.toThrow('Invalid backfill start');
  });
});
