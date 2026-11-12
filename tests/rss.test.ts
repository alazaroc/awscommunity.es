import { describe, expect, it } from 'vitest';
import { userGroups } from '../config/user-groups';
import { parseMeetupRss } from '../backend/sources/meetup-rss';

const feed = `<?xml version="1.0"?>
<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:meetup="https://www.meetup.com/">
  <channel>
    <item>
      <guid>event-123</guid>
      <title>Building with AWS</title>
      <link>https://www.meetup.com/awszgz/events/123/</link>
      <description><![CDATA[<p>A practical session.</p>]]></description>
      <dc:date>2027-02-10T18:30:00+01:00</dc:date>
      <meetup:city>Zaragoza</meetup:city>
      <meetup:venue>Etopia</meetup:venue>
    </item>
  </channel>
</rss>`;

describe('Meetup RSS parsing', () => {
  it('extracts structured public event data', () => {
    const group = userGroups.find((candidate) => candidate.id === 'zaragoza')!;
    const [event] = parseMeetupRss(feed, group).events;
    expect(event).toMatchObject({
      sourceId: 'event-123', source: 'meetup-rss', userGroupId: 'zaragoza',
      title: 'Building with AWS', city: 'Zaragoza', venue: 'Etopia', status: 'AUTO_PUBLISHED',
    });
    expect(event.startDate).toBe('2027-02-10T17:30:00.000Z');
  });

  it('creates a review candidate instead of using pubDate as the event date', () => {
    const group = userGroups.find((candidate) => candidate.id === 'zaragoza')!;
    const ambiguous = feed.replace('<dc:date>2027-02-10T18:30:00+01:00</dc:date>', '<pubDate>Tue, 01 Feb 2027 10:00:00 GMT</pubDate>');
    const parsed = parseMeetupRss(ambiguous, group);
    expect(parsed.events).toEqual([]);
    expect(parsed.reviewCandidates).toEqual([expect.objectContaining({
      sourceId: 'event-123',
      userGroupId: group.id,
      reason: expect.stringContaining('public event page must supply a validated event date'),
    })]);
  });
});
