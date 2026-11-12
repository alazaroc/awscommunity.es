# Design — Seasonal Themes

## Overview

Seasonal theming system as a **presentation layer** on top of the static Astro website. A single
`data-theme` attribute on `<html>` switches the atmosphere; all color/atmosphere lives in CSS
custom properties. Date-based selection is resolved **on the client** (no redeploy), with a
top-priority query string override and session persistence for demos and judging.

The `halloween` theme (URL alias `kiroween`) is the only expressive one: it reuses the existing
map of Spain as a "night map" with beacons that intensify in cities with real upcoming events.
The remaining themes are palettes only.

It fits the current architecture without breaking steering principles:
- `tokens.css` already centralizes all visual variables in `:root`.
- `BaseLayout.astro` is the single `<head>` and the only point that imports `global.css`.
- `SpainMap.astro` already renders nodes with `data-group-id`, `.pulse`, `.node-dot`, `.node-ring`.
- `EventsList.astro` already filters publishable future events from `src/data/events.json`.

## Architecture

```
Date (Europe/Madrid) ──┐
?theme= (query) ───────┼─> resolveTheme()  ──> data-theme on <html>  ──> CSS [data-theme="..."]
remote (future, off) ──┘        │                                           token overrides
                                └─ persistence in sessionStorage

Real data:
events.json ──> activeGroupIds (groups with an upcoming event) ──> SpainMap (.has-event class)
```

### Resolution priority (deterministic)
`query string (incl. alias)` > `remote (future, today undefined)` > `date Europe/Madrid` > `default`.

Among date-based themes, the bounded-event ones (`halloween`, `christmas`) take priority over the
broad seasonal ones (`spring`/`summer`/`autumn`/`winter`) in case windows overlap.

## Components and Interfaces

### 1. `config/themes.ts` (new) — source of truth for the calendar
Consistent with "data outside components". Only calendar and metadata; **no CSS**.

```ts
export type ThemeName =
  | 'default' | 'winter' | 'spring' | 'summer' | 'autumn'
  | 'halloween' | 'christmas' | 'reinvent' | 'community-day';

export interface ThemeWindow {
  // Annual window in Europe/Madrid, inclusive. Format MM-DD.
  start: string; // '10-18'
  end: string;   // '11-02'  (may cross the year end: end < start, e.g. christmas)
}

export interface ThemeDefinition {
  name: ThemeName;
  // Source of the window:
  //  - 'fixed'   : uses `window` (annual MM-DD).
  //  - 'dynamic' : the window is derived at runtime (e.g. community-day from communityDay.date).
  //  - absent    : theme only reachable via override (e.g. 'default' is not activated by date).
  windowKind?: 'fixed' | 'dynamic';
  window?: ThemeWindow;      // required if windowKind === 'fixed'
  priority: number;          // higher wins on overlap; bounded events > seasonal
  hasMotion: boolean;        // has animations wrapped in prefers-reduced-motion
  hasExtraAssets: boolean;   // loads its own assets only when active (halloween, christmas, ...)
}

export const DEFAULT_THEME: ThemeName = 'default'; // NOT themed: fallback and no-JS state

// URL alias -> real theme
export const THEME_ALIASES: Record<string, ThemeName> = { kiroween: 'halloween' };

export const THEMES: ThemeDefinition[];       // default has NO window (fallback/override only)
export const THEME_NAMES: Set<string>;        // names + aliases, to validate overrides
```

Proposed fixed windows (adjustable): halloween `10-18`→`11-02`; christmas `12-08`→`01-06`;
reinvent `11-28`→`12-07`; winter `12-21`→`03-19`; spring `03-20`→`06-20`; summer `06-21`→`09-21`;
autumn `09-22`→`10-17`. `community-day` is `windowKind: 'dynamic'`. `default` has no window:
it is only used as a fallback when no window applies, and as the base state without JavaScript.

### 2. `src/lib/theme.ts` (new) — pure, testable logic
```ts
export interface ResolveInput {
  now: Date;
  override?: string | null;      // raw value of ?theme= or sessionStorage
  remote?: ThemeName | null;     // FUTURE: always null today (Requirement 9)
  communityDayDate?: string | null; // date of the current edition (for the dynamic window)
}
export function normalizeOverride(raw?: string | null): ThemeName | null; // applies THEME_ALIASES + validation
export function themeForDate(now: Date, communityDayDate?: string | null): ThemeName;
export function resolveTheme(input: ResolveInput): ThemeName;
```
- `themeForDate` obtains MM-DD in `Europe/Madrid` with `Intl.DateTimeFormat` (same pattern already
  used by the backend/normalization and `EventsList`), evaluates all applicable windows and, on
  overlap, chooses by `priority`.
- **`community-day` dynamic window**: if `communityDayDate` is defined, a window
  `[date - N days, date + M days]` is computed (N/M configurable; e.g. 10/2) and evaluated as one
  more window. If `communityDayDate` is `null`/absent (`preparing` status), the theme is not
  activated by date (it is by override). The date comes from `config/community-day.ts`, so the
  theme moves on its own every year when the edition is updated.
- Pure functions => tests with boundary dates (Oct 18, Nov 2, Dec 31, Jan 6, reinvent's Nov 28/Dec
  7, overlaps winter/christmas/reinvent/community-day, and community-day with date present and
  absent).

### 3. `BaseLayout.astro` — injection point (minimal changes)
- `<html lang="es" data-theme="default">` (default value for SSR/static → no layout FOUC).
- **Blocking inline script** at the start of `<head>`, before any CSS that depends on the theme:
  1. reads `?theme=` from `location.search`; if absent, reads `sessionStorage`;
  2. `normalizeOverride` (alias + validation); if valid, sets and persists it in `sessionStorage`;
  3. if there is no override, computes `themeForDate(new Date(), communityDayDate)`;
  4. `document.documentElement.dataset.theme = result`.
  - It is tiny and dependency-free; it is inlined to run before the first paint.
  - `communityDayDate` is injected from `config/community-day.ts` at build time as a serialized
    constant inside the script (static string, no fetch). If `preparing`, it is empty.
  - Documented reset: `?theme=default` (or `?theme=auto`, which clears sessionStorage and goes
    back to date-based).
- The `<meta name="theme-color">` may optionally be updated per theme (not critical).

### 4. `src/styles/tokens.css` — new neutral custom properties
Add with default values (light today) so that themes only override them:
`--sky`, `--land`, `--beacon`, `--beacon-strong`, `--fog`, `--glow`. It does not change the
current appearance.

### 5. Theme CSS — `[data-theme="..."]` in `global.css` (or `themes.css` imported once)
- Soft themes: a compact block that redefines the existing palette (`--surface`, `--ink`, `--accent`…).
- `[data-theme="halloween"]`: night palette + specific rules for the map and decorations.
- New animations ALWAYS inside `@media (prefers-reduced-motion: no-preference)`.
- The static state of each theme must be attractive and with AA contrast.

### 6. `SpainMap.astro` — data, not aesthetics
- New optional prop: `activeGroupIds?: string[]` (groups with an upcoming event).
- Each `<a class="map-node">` whose `node.id ∈ activeGroupIds` gets `has-event`
  (`class:list={['map-node', { 'has-event': active }]}`).
- Outside `halloween`, `.has-event` defines no style → zero impact on other themes.
- The "night map" treatment is purely CSS under `[data-theme="halloween"] .spain-map …`,
  reusing the already existing `.map-land`, `.node-dot`, `.node-ring`, `.pulse`, `.connections`.

### 7. Computing `activeGroupIds` (real data, no invention)
- In `index.astro` (and wherever the map is shown), derive from the same `src/data/events.json`
  that `EventsList` uses: groups with ≥1 `AUTO_PUBLISHED|MANUAL` event with a future date.
- To avoid duplicating logic, extract a helper `src/lib/events.ts` with
  `upcomingGroupIds(snapshot, now): string[]` reusable by `EventsList` and the map.
- Consistency note: the per-event highlight reflects the snapshot at build time; the existing
  client-side refresh of `EventsList` could, in a later iteration, also update the map. No new
  real-time behavior is added in this delivery.

### 8. Community hero illustration (phase 3)
- **Original** SVG (community silhouettes + night sky with beacons, cloud/serverless motifs),
  `aria-hidden` since it is decorative for the hero.
- Included only under `[data-theme="halloween"]`; in SSG, the `<svg>` may be in the DOM but
  hidden by CSS in other themes, or injected conditionally. A lightweight inline SVG is preferable
  to avoid an extra request and layout shift. No official logos.

## Data Models

No changes to the domain model (`src/lib/types.ts`). Theming does not touch events or groups.
New types live in `config/themes.ts` and `src/lib/theme.ts` (see interfaces above).

## Theme `halloween`: concept → effect mapping (Costume Contest criterion)

| Product concept | Effect | Source |
|---|---|---|
| Distributed community | Night map (deep sky, dark land, subtle fog) | existing map |
| User Groups | Illuminated beacons (warm halo) | existing nodes |
| Cities with upcoming events | Intensified beacon + reinforced pulse | real `activeGroupIds` |
| Connections | Faint energy threads between beacons | existing `.connections` |
| Activity discovery | Sequential lighting-up of beacons with events (once, subtle) | CSS delays |
| Cloud/serverless | Ephemeral floating points of light (decorative, original) | new, `aria-hidden` |
| Kiro | Textual nod "Construido con Kiro para Kiroween 2026" ("Built with Kiro for Kiroween 2026") | footer/about, no logos |

## Error Handling
- Invalid or unknown override → silently ignored; falls back to date/default (R2.3).
- `sessionStorage` unavailable (private mode, blocking) → the theme keeps working by date and by
  query on each navigation; persistence is an enhancement, not a functional requirement.
- JS disabled → the site is served with `data-theme="default"`; no functional regression, there is
  just no seasonal atmosphere (acceptable degradation).
- The date-based theme never fails: `themeForDate` always returns a `ThemeName` (worst case `default`).

## Testing Strategy
- **Unit (Vitest)** on `src/lib/theme.ts`:
  - `normalizeOverride`: `halloween`/`kiroween` → `halloween`; uppercase/whitespace; garbage values → null.
  - `themeForDate`: boundary dates and overlaps; `Europe/Madrid` verification (e.g. DST changes).
  - `resolveTheme`: priority query > remote(null) > date > default.
- **Unit** on `src/lib/events.ts`: `upcomingGroupIds` with past/future events, non-publishable
  statuses and groups without events.
- **Build/accessibility (manual + `npm run build`)**: absence of layout shift when switching theme;
  AA contrast in night-time themes; behavior with `prefers-reduced-motion`.
- Keep `npm test && npm run build` green (steering).

## Phased rollout (to be detailed in tasks.md)
1. **Theme engine** (config + `theme.ts` + script in BaseLayout + neutral tokens + non-themed
   `default`). Permanent product; foundation of all themes. Includes `theme.ts` tests.
2. **Seasonal themes + christmas** (palettes only: `winter`, `spring`, `summer`, `autumn`,
   `christmas`) and **expressive halloween theme** (night CSS + beacons + `activeGroupIds` +
   `events.ts`). Halloween is the Costume Contest piece.
3. **Community hero illustration** (original SVG, conditional loading) in halloween.
4. **`reinvent` theme** (Requirement 10): new entry in `config/themes.ts` + CSS block. No
   structural changes in the engine.
5. **`community-day` theme** (Requirement 11): **dynamic** window derived from
   `communityDay.date`, new entry in `config/themes.ts` + CSS block. Moves on its own every year.

## Decisions and open notes
- `default` is **non-themed** (current appearance) and acts as the fallback and no-JS state;
  `winter` is a distinct themed theme (snow).
- Spooky theme name: `halloween`; accepted URL aliases: `halloween` and `kiroween`.
- Halloween lasts ~2.5 weeks (`10-18`→`11-02`), to be confirmed in tasks.
- `reinvent` and `community-day` are planned as phases 4 and 5 (outside the Costume Contest
  MVP). `community-day` uses a dynamic window so it does not need reconfiguring every year.
- Concrete fixed windows: proposed above, to be confirmed in the tasks phase.
