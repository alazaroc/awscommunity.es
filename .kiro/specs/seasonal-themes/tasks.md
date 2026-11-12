# Tasks — Seasonal Themes

Incremental implementation plan. Each task leaves the project compiling and with
`npm test && npm run build` green (steering). Phases 4 and 5 are planned but outside the
Costume Contest MVP (phases 1-3).

Confirmed decisions: `default` non-themed; `winter` themed and separate; halloween
`10-18→11-02`; reinvent `11-28→12-07`; community-day dynamic window with a margin of **-10 / +2
days** relative to `communityDay.date`; seasonal winter `12-21→03-19`, spring `03-20→06-20`,
summer `06-21→09-21`, autumn `09-22→10-17`; christmas `12-08→01-06`.

---

## Phase 1 — Theme engine

- [x] 1. Create `config/themes.ts` with the calendar and metadata
  - Define `ThemeName`, `ThemeWindow`, `ThemeDefinition` (`windowKind: 'fixed' | 'dynamic'`).
  - Declare `THEMES` with confirmed fixed windows and priorities (bounded events > seasonal).
  - `community-day` as `windowKind: 'dynamic'`; `default` without a window (fallback/override).
  - Export `DEFAULT_THEME`, `THEME_ALIASES` (`kiroween → halloween`), `THEME_NAMES` (names+aliases).
  - _Requirements: 1.2, 1.3, 1.4, 1.6, 2.2, 2.3, 10.1, 11.1_

- [x] 2. Create `src/lib/theme.ts` with the pure resolution logic
  - `normalizeOverride(raw)`: applies the alias and validates against `THEME_NAMES`; returns `ThemeName | null`.
  - `themeForDate(now, communityDayDate?)`: computes MM-DD in `Europe/Madrid` with `Intl`, evaluates
    fixed windows + the dynamic community-day window (margin -10/+2), resolves overlaps by
    `priority`; worst case returns `default`.
  - `resolveTheme({ now, override, remote, communityDayDate })`: priority
    `override > remote(null) > date > default`.
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 9.1, 11.1, 11.2_

- [x] 3. Unit tests for `src/lib/theme.ts` (Vitest)
  - `normalizeOverride`: `halloween`/`kiroween`→`halloween`; uppercase/whitespace; garbage→null.
  - `themeForDate`: boundaries (Oct 18, Nov 2, Dec 20/Dec 21, Jan 6/Jan 7), overlaps
    winter/christmas/reinvent, and community-day with date present and absent (`preparing`).
  - `resolveTheme`: precedence query > remote(null) > date > default; an invalid override is ignored.
  - _Requirements: 1.1, 1.3, 1.4, 2.1, 2.3, 9.1, 11.2, 11.3_

- [x] 4. Add neutral custom properties in `src/styles/tokens.css`
  - Introduce `--sky`, `--land`, `--beacon`, `--beacon-strong`, `--fog`, `--glow` with default
    values that do NOT alter the current appearance (non-themed `default`).
  - _Requirements: 3.4, 1.6_

- [x] 5. Inject the theme resolution in `BaseLayout.astro`
  - `<html lang="es" data-theme="default">`.
  - Blocking inline script at the start of `<head>`: reads `?theme=` → `sessionStorage` →
    `normalizeOverride`; if valid, sets and persists it; otherwise, `themeForDate(now, communityDayDate)`;
    writes `document.documentElement.dataset.theme` before the first paint.
  - Inject `communityDayDate` as a serialized constant from `config/community-day.ts` (empty
    if `preparing`). Reset via `?theme=default` / `?theme=auto` (clears `sessionStorage`).
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 4.3, 4.4, 8.1, 8.2_

- [x] 6. Phase 1 verification
  - `npm test && npm run build` green; manually check that `default` is identical to the current one
    and that `?theme=` switches `data-theme` without layout shift or FOUC.
  - _Requirements: 3.2, 3.3, 4.3_

---

## Phase 2 — Seasonal themes + christmas, and expressive halloween

- [x] 7. CSS blocks for "soft" themes (palettes only)
  - In `global.css` (or a new `themes.css` imported once in `BaseLayout`): `[data-theme="winter"]`,
    `spring`, `summer`, `autumn`, `christmas` redefining only existing custom properties.
  - No additional assets; keep AA contrast and typographic metrics.
  - _Requirements: 3.1, 3.3, 3.4, 4.1, 5.3_

- [x] 8. Helper `src/lib/events.ts` with `upcomingGroupIds(snapshot, now)`
  - Extract the "groups with ≥1 publishable future event" logic so it can be reused by `EventsList` and the
    map; minimal refactor of `EventsList.astro` to consume it (without changing its behavior).
  - _Requirements: 6.3_

- [x] 9. Tests for `src/lib/events.ts`
  - Past/future events, non-publishable statuses, groups without events, several groups.
  - _Requirements: 6.3_

- [x] 10. `SpainMap.astro`: `activeGroupIds` prop and `has-event` class
  - Add optional prop `activeGroupIds?: string[]`; mark `has-event` on the corresponding
    nodes. No styling outside halloween (zero impact on other themes).
  - Pass `activeGroupIds` from `index.astro` (and wherever applicable) using `upcomingGroupIds`.
  - _Requirements: 6.2, 6.3, 3.2_

- [x] 11. CSS for the `halloween` theme (night map + beacons)
  - `[data-theme="halloween"]`: night palette (uses `--sky`/`--land`/`--fog`), beacons with halo
    (`--beacon`), `.has-event` emphasis (intensity + reinforced pulse over `.pulse`), connections
    as energy threads.
  - Sequential lighting-up (animation-delay) and ephemeral decorative points of light (`aria-hidden`).
  - All animation inside `@media (prefers-reduced-motion: no-preference)`; attractive static
    state with AA contrast.
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 5.1, 5.2, 5.3, 5.5_

- [x] 12. Nod to Kiro (text, no logos)
  - Add in footer/about a discreet text "Construido con Kiro para Kiroween 2026" ("Built with Kiro
    for Kiroween 2026"; visible at least in the halloween theme). Do not modify or caricature AWS/Kiro logos.
  - _Requirements: 6.5, 6.6_

- [x] 13. Phase 2 verification
  - `npm test && npm run build`; review halloween with `?theme=kiroween` and `?theme=halloween`,
    with and without `prefers-reduced-motion`, and check that the other themes do not change structure.
  - _Requirements: 2.2, 3.2, 3.3, 5.1, 5.2, 8.1_

---

## Phase 3 — Community hero illustration (halloween)

- [x] 14. Original night-time community SVG
  - Create an original vector illustration (community silhouettes + night sky with beacons,
    cloud/serverless motifs), inline and lightweight, `aria-hidden`. No official logos.
  - _Requirements: 7.1, 7.4, 6.6_

- [x] 15. Conditional integration in the hero
  - Show the illustration only under `[data-theme="halloween"]`; conditional loading of assets if
    there are any; no layout shift and no impact on other themes.
  - _Requirements: 7.2, 7.3, 4.2, 3.3_

- [x] 16. Phase 3 verification
  - `npm test && npm run build`; check performance (assets only with halloween) and accessibility.
  - _Requirements: 4.2, 5.2, 7.3_

---

## Phase 4 — `reinvent` theme (post-MVP)

- [x] 17. `reinvent` entry in `config/themes.ts` (`11-28→12-07`, high priority) + boundary/overlap tests.
  - _Requirements: 10.1, 10.3, 1.4_

- [x] 18. Sober `[data-theme="reinvent"]` CSS block (AWS nod, no logos) + verification.
  - _Requirements: 10.2, 5.3, 3.2_

---

## Phase 5 — `community-day` theme with dynamic window (post-MVP)

- [x] 19. Activate `community-day` (dynamic) consuming `communityDay.date`; inactive if `preparing`; tests with date present/absent and winter overlaps.
  - _Requirements: 11.1, 11.2, 11.3, 1.4_

- [x] 20. `[data-theme="community-day"]` CSS block + verification; respect the independence of the annual websites.
  - _Requirements: 11.4, 11.5, 3.2_

---

## Execution notes
- Respect steering: strict TypeScript, data outside components, minimal client-side JS,
  accessibility intact, do not auto-publish or invent data.
- Do not create commits unless explicitly requested; do not deploy without confirmation.
- At the close of each phase, leave `npm test && npm run build` green and clean up temporary files.
