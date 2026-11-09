import { afterEach, describe, expect, it, vi } from 'vitest';
import { userGroups } from '../config/user-groups';
import { MeetupRssSource } from '../backend/sources/meetup-rss';

const group = userGroups.find((candidate) => candidate.id === 'zaragoza')!;
const definition = group.eventSources.find((source) => source.type === 'meetup-rss')!;
const feed = `<?xml version="1.0"?><rss version="2.0"><channel><item>
  <guid>https://www.meetup.com/awszgz/events/316949236/</guid>
  <title>Agentic SDLC en AWS</title>
  <link>https://www.meetup.com/awszgz/events/316949236/</link>
  <pubDate>Tue, 20 Oct 2027 10:00:00 GMT</pubDate>
</item></channel></rss>`;
const page = (status = 'EventScheduled') => `<script type="application/ld+json">${JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'Event',
  name: 'Agentic SDLC en AWS',
  url: 'https://www.meetup.com/awszgz/events/316949236/',
  startDate: '2027-10-26T18:00:00+02:00',
  endDate: '2027-10-26T21:00:00+02:00',
  eventStatus: `https://schema.org/${status}`,
  location: { '@type': 'Place', name: 'El Trovador', address: { addressLocality: 'Zaragoza' } },
  organizer: { '@type': 'Organization', name: 'AWS Zaragoza User Group', url: 'https://www.meetup.com/awszgz/' },
})}</script>`;

afterEach(() => vi.unstubAllGlobals());

describe('Meetup RSS discovery with public event pages', () => {
  it('publishes a validated page and retains it for conditional revalidation', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(feed, { status: 200, headers: { etag: '"feed-1"' } }))
      .mockResolvedValueOnce(new Response(page(), { status: 200, headers: { etag: '"page-1"' } }));
    vi.stubGlobal('fetch', fetchMock);

    const source = new MeetupRssSource();
    const first = await source.discover(group, definition, {});
    expect(first.events).toEqual([expect.objectContaining({
      sourceId: 'meetup:316949236',
      source: 'meetup-public-page',
      status: 'AUTO_PUBLISHED',
    })]);
    expect(first.reviewCandidates).toEqual([]);
    expect(first.state.trackedMeetupEvents).toEqual([expect.objectContaining({
      sourceId: 'meetup:316949236',
      endDate: '2027-10-26T19:00:00.000Z',
      http: expect.objectContaining({ etag: '"page-1"' }),
    })]);

    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 304 }))
      .mockResolvedValueOnce(new Response(null, { status: 304 }));
    const unchanged = await source.discover(group, definition, first.state);
    expect(unchanged.events).toEqual([]);
    expect(unchanged.state.trackedMeetupEvents).toHaveLength(1);
  });

  it('retries an invalid page instead of caching its validators', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(feed, { status: 200 }))
      .mockResolvedValueOnce(new Response('<html>not an event</html>', { status: 200, headers: { etag: '"invalid"' } }));
    vi.stubGlobal('fetch', fetchMock);
    const source = new MeetupRssSource();
    const failed = await source.discover(group, definition, {});
    expect(failed.events).toEqual([]);
    expect(failed.reviewCandidates).toHaveLength(1);
    expect(failed.state.trackedMeetupEvents?.[0].http).toMatchObject({ consecutiveFailures: 1 });
    expect(failed.state.trackedMeetupEvents?.[0].http.etag).toBeUndefined();

    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 304 }))
      .mockResolvedValueOnce(new Response(page(), { status: 200 }));
    const recovered = await source.discover(group, definition, failed.state);
    expect(recovered.events).toEqual([expect.objectContaining({ status: 'AUTO_PUBLISHED' })]);
  });

  it('detects an explicit cancellation on a tracked page', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(feed, { status: 200 }))
      .mockResolvedValueOnce(new Response(page(), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const source = new MeetupRssSource();
    const first = await source.discover(group, definition, {});

    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 304 }))
      .mockResolvedValueOnce(new Response(page('EventCancelled'), { status: 200 }));
    const changed = await source.discover(group, definition, first.state);
    expect(changed.events).toEqual([expect.objectContaining({ status: 'CANCELLED' })]);
  });
});
