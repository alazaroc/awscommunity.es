import { afterEach, describe, expect, it, vi } from 'vitest';
import { conditionalFetch } from '../backend/sources/http';
import type { HttpState } from '../backend/sources/types';

afterEach(() => vi.unstubAllGlobals());

describe('conditional HTTP fetching', () => {
  it('sends validators and handles 304 without downloading content', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 304 }));
    vi.stubGlobal('fetch', fetchMock);
    const result = await conditionalFetch('https://example.com/feed.xml', {
      etag: '"abc"', lastModified: 'Wed, 28 Oct 2026 10:00:00 GMT', consecutiveFailures: 2,
      trackedMeetupEvents: [{
        sourceId: 'meetup:123', url: 'https://www.meetup.com/awszgz/events/123/',
        discoveredAt: '2026-10-28T10:00:00Z', http: {},
      }],
    });
    const headers = fetchMock.mock.calls[0][1].headers as Headers;
    expect(headers.get('if-none-match')).toBe('"abc"');
    expect(headers.get('if-modified-since')).toBe('Wed, 28 Oct 2026 10:00:00 GMT');
    expect(result.notModified).toBe(true);
    expect(result.state.consecutiveFailures).toBe(0);
    expect(result.state.trackedMeetupEvents).toHaveLength(1);
  });

  it('uses content hashing when validators are absent', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => new Response('<rss/>', { status: 200 })));
    const first = await conditionalFetch('https://example.com/feed.xml', {} as HttpState);
    const second = await conditionalFetch('https://example.com/feed.xml', { contentHash: first.state.contentHash });
    expect(first.notModified).toBe(false);
    expect(second.notModified).toBe(true);
  });
});
