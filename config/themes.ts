// Seasonal theme calendar and metadata.
// Source of truth for WHICH theme applies and WHEN. Contains no CSS: the visual
// treatment lives in src/styles. Keeping this out of components follows the
// project principle "data stays out of components".

export type ThemeName =
  | 'default'
  | 'winter'
  | 'summer'
  | 'autumn'
  | 'halloween'
  | 'christmas'
  | 'reinvent'
  | 'community-day';

export interface ThemeWindow {
  /** Inclusive annual window in Europe/Madrid, formatted MM-DD. May wrap year-end (end < start). */
  start: string;
  end: string;
}

export interface ThemeDefinition {
  name: ThemeName;
  /**
   * How the active window is determined:
   *  - 'fixed'   : uses `window` (annual MM-DD range).
   *  - 'dynamic' : derived at runtime (community-day, from communityDay.date).
   *  - undefined : theme is only reachable via URL override (e.g. 'default').
   */
  windowKind?: 'fixed' | 'dynamic';
  /** Required when windowKind === 'fixed'. */
  window?: ThemeWindow;
  /** Higher wins on overlap. Bounded-event themes outrank broad seasonal ones. */
  priority: number;
  /** Whether the theme introduces animations (always wrapped in prefers-reduced-motion). */
  hasMotion: boolean;
  /** Whether the theme loads its own assets (only when active). */
  hasExtraAssets: boolean;
}

/** Non-thematic fallback: current look, and the state when JavaScript is unavailable. */
export const DEFAULT_THEME: ThemeName = 'default';

/** URL alias kept for existing challenge links; it is never shown in the public UI. */
export const THEME_ALIASES: Record<string, ThemeName> = {
  kiroween: 'halloween',
};

/** Margin (in days) around communityDay.date that defines the dynamic window. */
export const COMMUNITY_DAY_MARGIN_BEFORE = 10;
export const COMMUNITY_DAY_MARGIN_AFTER = 2;

/**
 * All themes. `default` has no window (fallback/override only). `community-day` is dynamic.
 * Priorities: bounded events (halloween/reinvent/community-day/christmas) outrank the broad seasonal themes.
 */
export const THEMES: ThemeDefinition[] = [
  { name: 'default', priority: 0, hasMotion: false, hasExtraAssets: false },

  // Broad seasonal themes (low priority).
  { name: 'winter', windowKind: 'fixed', window: { start: '12-21', end: '03-19' }, priority: 10, hasMotion: true, hasExtraAssets: false },
  { name: 'summer', windowKind: 'fixed', window: { start: '06-21', end: '09-21' }, priority: 10, hasMotion: false, hasExtraAssets: false },
  { name: 'autumn', windowKind: 'fixed', window: { start: '09-22', end: '10-17' }, priority: 10, hasMotion: false, hasExtraAssets: false },

  // Bounded-event themes (high priority; win over seasons on overlap).
  { name: 'halloween', windowKind: 'fixed', window: { start: '10-18', end: '11-02' }, priority: 50, hasMotion: true, hasExtraAssets: true },
  { name: 'christmas', windowKind: 'fixed', window: { start: '12-08', end: '01-06' }, priority: 40, hasMotion: true, hasExtraAssets: true },
  { name: 'reinvent', windowKind: 'fixed', window: { start: '11-28', end: '12-07' }, priority: 60, hasMotion: false, hasExtraAssets: false },
  { name: 'community-day', windowKind: 'dynamic', priority: 70, hasMotion: false, hasExtraAssets: false },
];

/** Valid override tokens: canonical theme names and legacy aliases. */
export const THEME_NAMES: Set<string> = new Set<string>([
  ...THEMES.map((theme) => theme.name),
  ...Object.keys(THEME_ALIASES),
]);

export function getThemeDefinition(name: ThemeName): ThemeDefinition | undefined {
  return THEMES.find((theme) => theme.name === name);
}
