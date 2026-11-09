import { describe, expect, it } from 'vitest';
import { userGroups } from '../config/user-groups';
import { projectMapCoordinates } from '../src/lib/map';

describe('Spain map projection', () => {
  it('places every configured User Group inside the SVG viewbox', () => {
    const groupsWithCoordinates = userGroups.filter((group) => group.coordinates);

    expect(groupsWithCoordinates).toHaveLength(userGroups.length);
    for (const group of groupsWithCoordinates) {
      const point = projectMapCoordinates(group.coordinates!);
      expect(point.x, group.id).toBeGreaterThanOrEqual(0);
      expect(point.x, group.id).toBeLessThanOrEqual(680);
      expect(point.y, group.id).toBeGreaterThanOrEqual(0);
      expect(point.y, group.id).toBeLessThanOrEqual(500);
    }
  });

  it('uses the Canary Islands inset for Las Palmas', () => {
    const lasPalmas = userGroups.find((group) => group.id === 'las-palmas');
    const point = projectMapCoordinates(lasPalmas!.coordinates!);

    expect(point.x).toBeGreaterThan(48);
    expect(point.x).toBeLessThan(268);
    expect(point.y).toBeGreaterThan(390);
    expect(point.y).toBeLessThan(475);
  });

  it('preserves the west-to-east order of mainland groups', () => {
    const galicia = userGroups.find((group) => group.id === 'galicia');
    const barcelona = userGroups.find((group) => group.id === 'barcelona');

    expect(projectMapCoordinates(galicia!.coordinates!).x)
      .toBeLessThan(projectMapCoordinates(barcelona!.coordinates!).x);
  });

  it('scales longitude for Spain latitude instead of stretching it', () => {
    const origin = projectMapCoordinates({ latitude: 40, longitude: 0 });
    const oneDegreeEast = projectMapCoordinates({ latitude: 40, longitude: 1 });
    const oneDegreeNorth = projectMapCoordinates({ latitude: 41, longitude: 0 });
    const horizontalScale = oneDegreeEast.x - origin.x;
    const verticalScale = origin.y - oneDegreeNorth.y;

    expect(horizontalScale / verticalScale).toBeCloseTo(Math.cos(40 * Math.PI / 180), 2);
  });

  it('keeps the mainland projection narrower than it is tall per raw degree', () => {
    const northWest = projectMapCoordinates({ latitude: 44.2, longitude: -9.5 });
    const southEast = projectMapCoordinates({ latitude: 35.5, longitude: 4.5 });

    expect(southEast.x - northWest.x).toBeCloseTo(370, 8);
    expect(southEast.y - northWest.y).toBeCloseTo(300, 8);
  });
});
