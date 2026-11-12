import { describe, expect, it } from 'vitest';
import { normalizeEvent } from '../backend/normalization/events';
import { applyOverrides } from '../backend/persistence/publish';

const base = normalizeEvent({
  sourceId: 'meetup:123',
  source: 'meetup-public-page',
  userGroupId: 'zaragoza',
  title: 'Automatic title',
  startDate: '2027-02-01T18:00:00+01:00',
  endDate: '2027-02-01T20:00:00+01:00',
  timezone: 'Europe/Madrid',
  city: 'Zaragoza',
  url: 'https://www.meetup.com/awszgz/events/123/',
  status: 'AUTO_PUBLISHED',
}, new Date('2026-11-01T00:00:00Z'));

describe('DynamoDB event overrides', () => {
  it('replaces an automatic event with the administrative version by stable id', () => {
    const manual = normalizeEvent({
      sourceId: 'meetup:123',
      source: 'manual',
      userGroupId: 'zaragoza',
      title: 'Verified title',
      startDate: '2027-02-01T18:00:00+01:00',
      endDate: '2027-02-01T20:00:00+01:00',
      timezone: 'Europe/Madrid',
      city: 'Zaragoza',
      url: 'https://www.meetup.com/awszgz/events/123/',
      status: 'MANUAL',
    }, new Date('2026-11-02T00:00:00Z'));

    const result = applyOverrides([base], [{
      event: manual,
      createdAt: '2026-11-02T00:00:00.000Z',
      updatedAt: '2026-11-02T00:00:00.000Z',
    }]);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: base.id, title: 'Verified title', status: 'MANUAL' });
  });

  it('keeps a manual-only event even when discovery has no base record', () => {
    const manual = { ...base, id: 'manual-only', source: 'manual' as const, status: 'MANUAL' as const };
    expect(applyOverrides([], [{ event: manual, createdAt: base.firstSeen, updatedAt: base.lastSeen }])).toEqual([manual]);
  });
});
