import { describe, expect, it } from 'vitest';
import { userGroups } from '../config/user-groups';

describe('User Group configuration', () => {
  it('uses unique stable identifiers', () => {
    const ids = userGroups.map((group) => group.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('provides a verified description for every group', () => {
    for (const group of userGroups) {
      expect(group.description?.trim(), `${group.id} description`).toBeTruthy();
      expect(group.description).not.toContain('Consulta sus canales oficiales');
    }
  });

  it('uses Sevilla Meetup as its event channel', () => {
    const sevilla = userGroups.find((group) => group.id === 'sevilla');
    expect(sevilla?.meetupUrl).toBe('https://www.meetup.com/aws-user-group-sevilla/');
    expect(sevilla?.eventSources).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'meetup-rss', enabled: true }),
    ]));
  });

  it('links every description to a valid public channel', () => {
    for (const group of userGroups) {
      expect(() => new URL(group.meetupUrl ?? group.website)).not.toThrow();
    }
  });
});
