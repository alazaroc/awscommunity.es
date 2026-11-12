// Pure theme-resolution logic. No DOM, no side effects: safe to unit test and to
// inline into a tiny client script. Timezone handling mirrors the rest of the
// project (Intl with timeZone 'Europe/Madrid').

import {
  COMMUNITY_DAY_MARGIN_AFTER,
  COMMUNITY_DAY_MARGIN_BEFORE,
  DEFAULT_THEME,
  THEME_ALIASES,
  THEME_NAMES,
  THEMES,
  type ThemeDefinition,
  type ThemeName,
} from '../../config/themes';

export interface ResolveInput {
  now: Date;
  /** Raw value from ?theme= or sessionStorage (may be mixed case or junk). */
  override?: string | null;
  /** FUTURE (Requirement 9): remote override. Always null in this release. */
  remote?: ThemeName | null;
  /** communityDay.date for the dynamic window; null/undefined when unannounced. */
  communityDayDate?: string | null;
}

const TIME_ZONE = 'Europe/Madrid';

const madridParts = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Returns {year, month, day} as numbers for `date` interpreted in Europe/Madrid. */
function madridYmd(date: Date): { year: number; month: number; day: number } {
  const parts = madridParts.formatToParts(date);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return { year: get('year'), month: get('month'), day: get('day') };
}

/** Day-of-year-ish ordinal (month*100 + day) for comparing against MM-DD windows. */
function monthDayOrdinal(month: number, day: number): number {
  return month * 100 + day;
}

function parseMonthDay(value: string): number {
  const [month, day] = value.split('-').map(Number);
  return monthDayOrdinal(month, day);
}

/** True when `ordinal` falls inside a fixed MM-DD window, handling year-wrap (end < start). */
function inFixedWindow(ordinal: number, startMd: number, endMd: number): boolean {
  if (startMd <= endMd) return ordinal >= startMd && ordinal <= endMd;
  // Wraps year-end, e.g. christmas 12-08 -> 01-06.
  return ordinal >= startMd || ordinal <= endMd;
}

/**
 * Normalize a raw override value to a canonical ThemeName.
 * Legacy aliases are accepted for existing links but are never rendered as labels.
 */
export function normalizeOverride(raw?: string | null): ThemeName | null {
  if (!raw) return null;
  const token = raw.trim().toLowerCase();
  if (!token || !THEME_NAMES.has(token)) return null;
  return (THEME_ALIASES[token] ?? token) as ThemeName;
}

/** UTC-based difference in whole days between two Y/M/D tuples (sign: a - b). */
function dayDiff(
  a: { year: number; month: number; day: number },
  b: { year: number; month: number; day: number },
): number {
  const ms = Date.UTC(a.year, a.month - 1, a.day) - Date.UTC(b.year, b.month - 1, b.day);
  return Math.round(ms / 86_400_000);
}

/** True when `now` falls within [date - before, date + after] days (Europe/Madrid). */
function inDynamicWindow(now: Date, communityDayDate: string, before: number, after: number): boolean {
  const parsed = new Date(communityDayDate);
  if (Number.isNaN(parsed.valueOf())) return false;
  const nowYmd = madridYmd(now);
  const eventYmd = madridYmd(parsed);
  const delta = dayDiff(nowYmd, eventYmd);
  return delta >= -before && delta <= after;
}

/**
 * Resolve the theme that applies to `now` by date alone (Europe/Madrid).
 * Evaluates every applicable window and picks the highest priority. Worst case: 'default'.
 */
export function themeForDate(now: Date, communityDayDate?: string | null): ThemeName {
  const { month, day } = madridYmd(now);
  const ordinal = monthDayOrdinal(month, day);

  let best: ThemeDefinition | undefined;
  for (const theme of THEMES) {
    let active = false;
    if (theme.windowKind === 'fixed' && theme.window) {
      active = inFixedWindow(ordinal, parseMonthDay(theme.window.start), parseMonthDay(theme.window.end));
    } else if (theme.windowKind === 'dynamic' && communityDayDate) {
      active = inDynamicWindow(now, communityDayDate, COMMUNITY_DAY_MARGIN_BEFORE, COMMUNITY_DAY_MARGIN_AFTER);
    }
    if (active && (!best || theme.priority > best.priority)) best = theme;
  }
  return best?.name ?? DEFAULT_THEME;
}

/**
 * Resolve the active theme. Priority:
 *   override (query/storage) > remote (future, null) > date > default.
 */
export function resolveTheme(input: ResolveInput): ThemeName {
  const override = normalizeOverride(input.override);
  if (override) return override;
  if (input.remote) return input.remote;
  return themeForDate(input.now, input.communityDayDate);
}
