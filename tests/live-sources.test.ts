import { describe, expect, it } from 'vitest';
import { userGroups } from '../config/user-groups';
import { MeetupRssSource } from '../backend/sources/meetup-rss';

const live = process.env.LIVE_SOURCE_TESTS === '1';

describe.runIf(live)('live public Meetup RSS sources', () => {
  it('return a public RSS/Atom document without private APIs', async () => {
    const source = new MeetupRssSource();
    const checks = userGroups.flatMap((group) => group.eventSources
      .filter((definition) => definition.type === 'meetup-rss' && definition.enabled !== false)
      .map(async (definition) => {
        const result = await source.discover(group, definition, {});
        return { group: group.id, events: result.events.length };
      }));
    const results = await Promise.all(checks);
    expect(results).toHaveLength(12);
  }, 30_000);
});
