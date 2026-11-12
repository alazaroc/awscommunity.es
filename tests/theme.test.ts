import { describe, expect, it } from 'vitest';
import { normalizeOverride, resolveTheme, themeForDate } from '../src/lib/theme';

// Helper: a Date whose Europe/Madrid calendar day is (y, m, d) at noon, to avoid
// DST/edge-of-day ambiguity in the tests.
const madrid = (y: number, m: number, d: number) => new Date(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}T12:00:00+01:00`);

describe('normalizeOverride', () => {
  it('accepts Halloween and its legacy internal alias without exposing the alias', () => {
    expect(normalizeOverride('halloween')).toBe('halloween');
    expect(normalizeOverride('kiroween')).toBe('halloween');
  });

  it('is case- and whitespace-insensitive', () => {
    expect(normalizeOverride('  KIROWEEN ')).toBe('halloween');
    expect(normalizeOverride('Summer')).toBe('summer');
  });

  it('returns null for junk, empty, or unknown values', () => {
    expect(normalizeOverride('')).toBeNull();
    expect(normalizeOverride(null)).toBeNull();
    expect(normalizeOverride(undefined)).toBeNull();
    expect(normalizeOverride('spooky')).toBeNull();
    expect(normalizeOverride('kiro')).toBeNull();
  });

  it('accepts every valid canonical theme', () => {
    for (const name of ['default', 'winter', 'summer', 'autumn', 'halloween', 'christmas', 'reinvent', 'community-day']) {
      expect(normalizeOverride(name)).toBe(name);
    }
  });
});

describe('themeForDate (Europe/Madrid)', () => {
  it('returns default outside any window', () => {
    // 2026-11-20 is between halloween (ends 11-02) and reinvent (starts 11-28).
    expect(themeForDate(madrid(2026, 11, 20))).toBe('default');
  });

  it('applies halloween inside its window including boundaries', () => {
    expect(themeForDate(madrid(2026, 10, 18))).toBe('halloween');
    expect(themeForDate(madrid(2026, 10, 31))).toBe('halloween');
    expect(themeForDate(madrid(2026, 11, 2))).toBe('halloween');
  });

  it('autumn applies the day before halloween starts', () => {
    expect(themeForDate(madrid(2026, 10, 17))).toBe('autumn');
  });

  it('christmas overrides winter during the festive overlap', () => {
    expect(themeForDate(madrid(2026, 12, 21))).toBe('christmas');
    expect(themeForDate(madrid(2027, 1, 6))).toBe('christmas');
  });

  it('winter covers the quiet season around christmas', () => {
    expect(themeForDate(madrid(2027, 1, 7))).toBe('winter');
    expect(themeForDate(madrid(2027, 3, 19))).toBe('winter');
    expect(themeForDate(madrid(2027, 3, 20))).toBe('default');
  });


  it('reinvent wins over christmas during its window', () => {
    // 11-28..12-07; christmas starts 12-08, so reinvent owns this window.
    expect(themeForDate(madrid(2026, 11, 28))).toBe('reinvent');
    expect(themeForDate(madrid(2026, 12, 7))).toBe('reinvent');
    expect(themeForDate(madrid(2026, 12, 8))).toBe('christmas');
  });

  it('reinvent boundaries and the gap before it', () => {
    expect(themeForDate(madrid(2026, 11, 27))).toBe('default'); // between halloween and reinvent
    expect(themeForDate(madrid(2026, 11, 28))).toBe('reinvent');
    expect(themeForDate(madrid(2026, 12, 7))).toBe('reinvent');
  });

  it('uses the neutral theme outside curated seasonal windows', () => {
    expect(themeForDate(madrid(2026, 12, 20))).toBe('christmas');
    expect(themeForDate(madrid(2027, 3, 19))).toBe('winter');
    expect(themeForDate(madrid(2027, 3, 20))).toBe('default');
  });

  it('community-day dynamic window wins when a date is present', () => {
    const eventDate = '2026-05-15T09:00:00+02:00';
    // Within -10/+2 of May 15 -> community-day (priority 70 beats the neutral theme).
    expect(themeForDate(madrid(2026, 5, 10), eventDate)).toBe('community-day');
    expect(themeForDate(madrid(2026, 5, 15), eventDate)).toBe('community-day');
    expect(themeForDate(madrid(2026, 5, 17), eventDate)).toBe('community-day');
    // Outside the window -> falls back to the neutral theme.
    expect(themeForDate(madrid(2026, 5, 1), eventDate)).toBe('default');
    expect(themeForDate(madrid(2026, 5, 18), eventDate)).toBe('default');
  });

  it('community-day stays inactive when no date (preparing)', () => {
    expect(themeForDate(madrid(2026, 5, 15), null)).toBe('default');
    expect(themeForDate(madrid(2026, 5, 15), undefined)).toBe('default');
  });

  it('community-day outranks other themes on overlap (priority 70)', () => {
    // An edition on 2026-11-30 overlaps reinvent (11-28..12-07). community-day wins.
    const eventDate = '2026-11-30T09:00:00+01:00';
    expect(themeForDate(madrid(2026, 11, 30), eventDate)).toBe('community-day');
    // One day past the +2 margin -> back to reinvent.
    expect(themeForDate(madrid(2026, 12, 3), eventDate)).toBe('reinvent');
  });
});

describe('resolveTheme precedence', () => {
  it('override beats date', () => {
    expect(resolveTheme({ now: madrid(2026, 7, 1), override: 'halloween' })).toBe('halloween');
  });

  it('invalid override is ignored and falls back to date', () => {
    expect(resolveTheme({ now: madrid(2026, 7, 1), override: 'nonsense' })).toBe('summer');
  });

  it('remote is used only when no valid override (future hook; null today)', () => {
    expect(resolveTheme({ now: madrid(2026, 11, 20), remote: 'christmas' })).toBe('christmas');
    expect(resolveTheme({ now: madrid(2026, 11, 20), remote: null })).toBe('default');
  });

  it('falls back to default when nothing applies', () => {
    expect(resolveTheme({ now: madrid(2026, 11, 20) })).toBe('default');
  });
});
