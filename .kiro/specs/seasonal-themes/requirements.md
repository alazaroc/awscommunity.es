# Requirements — Seasonal Themes

## Introduction

AWS Community Spain gains a permanent **seasonal themes** system that changes only the visual
atmosphere of the site according to the time of year, without altering the information
architecture, navigation or usability. The system debuts an expressive `halloween` theme
(haunted, elegant, not childish) which is also the entry for the **Costume Contest** category of
Kiroween 2026.

The website remains serious, professional, accessible and community-focused. Themes are a
presentation layer: colors, atmosphere and micro-animations; never content or structure.

### Planned themes
- `default`: **non-themed** (the current template, serious and professional). It is the fallback
  for any gap in the calendar and the base state without JavaScript. It carries NO seasonal
  decoration.
- Seasonal themed themes: `winter` (snow), `spring`, `summer`, `autumn`.
- Bounded-event themed themes (higher priority): `halloween`, `reinvent` (phase 4),
  `community-day` (phase 5, dynamic window based on the edition date).
- `christmas` (themed).

### Proposed calendar (Europe/Madrid, to be confirmed in tasks)
| Theme | Window | Priority | Phase |
|---|---|---|---|
| `default` | — (fallback / no JS) | — | 1 |
| `winter` | 12-21 → 03-19 | low | 1-2 |
| `spring` | 03-20 → 06-20 | low | 1-2 |
| `summer` | 06-21 → 09-21 | low | 1-2 |
| `autumn` | 09-22 → 10-17 | low | 1-2 |
| `halloween` | 10-18 → 11-02 (~2.5 weeks) | high | 1-3 |
| `christmas` | 12-08 → 01-06 | medium | 1-2 |
| `reinvent` | 11-28 → 12-07 | high | 4 |
| `community-day` | **dynamic**: ±N days around `communityDay.date` | high | 5 |

In winter, `winter`, `christmas`, `reinvent` and `community-day` coexist: the priority order
decides which theme prevails each day. `default` only appears in uncovered gaps or without JS.

### Non-negotiable principles (inherited from steering)
- Data lives outside components; the theme neither invents nor hides information.
- Accessibility by default: skip-link, visible focus, `prefers-reduced-motion`, `:target`.
- Minimal client-side JavaScript; pure SSG; no component framework.
- Do not modify or caricature AWS or Kiro logos/brands.
- Every new visual variable is a custom property in `tokens.css`.

---

## Requirement 1 — Automatic selection by date

**User story:** As a visitor, I want the website to show the atmosphere of the time of year in
which I visit it, so that the experience is timely without any intervention.

#### Acceptance Criteria
1. WHEN a visitor loads any page without an override THEN the system SHALL resolve the active
   theme from the current date interpreted in the `Europe/Madrid` time zone.
2. WHEN the date falls within the defined window of a themed theme THEN the system SHALL apply
   that theme.
3. WHEN the date does not fall within the window of any themed theme THEN the system SHALL apply
   the **non-themed** `default` theme (no seasonal decoration).
4. IF the windows of two themes overlap THEN the system SHALL apply a deterministic, documented
   priority order (bounded-event themes —`halloween`, `reinvent`, `community-day`,
   `christmas`— take priority over the broad seasonal ones `winter`, `spring`, `summer`,
   `autumn`).
5. WHEN the day changes and therefore the applicable theme changes THEN the system SHALL reflect
   the change **without requiring a new deployment** of the static site.
6. The `default` theme SHALL preserve the current appearance of the site (non-themed) and SHALL
   NOT introduce seasonal elements; the `winter` theme is a themed theme **distinct** from
   `default`.

## Requirement 2 — Query string override (dev, screenshots, demos, judging)

**User story:** As a developer or judge, I want to force any theme via URL, for development,
screenshots and to review the contest theme even if the actual date is different.

#### Acceptance Criteria
1. WHEN the URL includes `?theme=<name>` with a valid theme THEN the system SHALL apply that
   theme with priority over the date-based selection.
2. The system SHALL accept `?theme=halloween` and the alias `?theme=kiroween` as equivalent,
   resolving both to the same `halloween` theme.
3. WHEN the value of `?theme=` does not correspond to any valid theme or alias THEN the system
   SHALL ignore it and continue with the date-based selection (no visible error).
4. WHEN a valid override is applied THEN the system SHALL **persist it for the browsing session**
   (e.g. `sessionStorage`), so that the override is kept when navigating between pages without
   the parameter.
5. The system SHALL allow clearing/resetting the override by starting a new session or through a
   documented reset value, so that the visitor is not left trapped.

## Requirement 3 — Visual application without altering structure

**User story:** As the product owner, I want a theme to change only the atmosphere, so that the
website remains serious, usable and carries the same information in any theme.

#### Acceptance Criteria
1. The system SHALL apply the theme through a `data-theme` attribute on the root element
   (`<html>`) and CSS custom property overrides.
2. The system SHALL NOT change the information architecture, content order, navigation or the
   behavior of any component when switching themes.
3. The system SHALL keep the same typographic metrics and the same structural spacing across
   themes, so that no layout shift occurs when resolving or changing the theme.
4. The system SHALL define any new visual variable as a custom property in
   `src/styles/tokens.css` with a default value, and themes SHALL be limited to overriding those
   properties (plus optional decorative elements marked `aria-hidden`).

## Requirement 4 — Performance and asset loading

**User story:** As a visitor, I want the theme system not to penalize the speed of the site
during most of the year.

#### Acceptance Criteria
1. The system SHALL implement the "soft" themes (`default`/`winter`, `spring`, `summer`,
   `autumn`) using only CSS variables, with no additional assets.
2. WHEN a theme with additional assets or animations (`halloween`, `christmas`) is NOT active
   THEN the system SHALL NOT download its specific assets.
3. The system SHALL avoid flashing the wrong theme (FOUC) by resolving and applying the
   `data-theme` before the first render.
4. The system SHALL keep the current SSG model: date-based selection SHALL NOT require a
   scheduled build or a daily rebuild.

## Requirement 5 — Accessibility and motion

**User story:** As a visitor sensitive to motion or using assistive technology, I want the
atmosphere not to harm accessibility.

#### Acceptance Criteria
1. The system SHALL wrap every animation introduced by a theme in
   `@media (prefers-reduced-motion: no-preference)`.
2. WHEN the user prefers reduced motion THEN each theme SHALL remain legible and appealing in its
   static state, with no loss of information or contrast.
3. The system SHALL preserve sufficient text contrast (WCAG AA) in all themes, including the
   night-time ones.
4. The system SHALL preserve the skip-link, visible focus (`:focus-visible`) and the `:target`
   highlight in all themes.
5. Purely decorative elements of a theme SHALL be `aria-hidden` and SHALL NOT be announced by
   screen readers.

## Requirement 6 — Expressive `halloween` theme (Costume Contest)

**User story:** As a community entering the Costume Contest, I want a polished, memorable and
spooky Halloween theme whose elements reinforce real concepts of the product.

#### Acceptance Criteria
1. The system SHALL present in `halloween` a **night map of Spain** reusing the existing map,
   with the land and sky given a night treatment.
2. The system SHALL represent the User Groups as **illuminated beacons** on the night map.
3. WHEN a User Group has at least one published upcoming event (`AUTO_PUBLISHED` or `MANUAL`,
   future date) THEN its beacon SHALL receive an **additional visual emphasis** (greater
   intensity and pulse), using real data from the snapshot and WITHOUT inventing activity.
4. The system SHALL include **subtle and elegant** spooky details, avoiding childish aesthetics
   and avoiding generic pumpkins/clip-art.
5. The system SHALL include a discreet nod to **Kiro** as a build tool (footer/about text such as
   "Construido con Kiro para Kiroween 2026" — "Built with Kiro for Kiroween 2026"), WITHOUT
   modifying or caricaturing the Kiro or AWS logo.
6. IF illustrations are used THEN they SHALL be **original** with cloud/serverless/dev concepts,
   and SHALL NOT alter official logos or brands.

## Requirement 7 — Community hero illustration (phase 3)

**User story:** As a community, I want an original hero illustration that conveys community and
distributed activity, to make the theme more memorable.

#### Acceptance Criteria
1. The system SHALL be able to display, in the `halloween` theme, an **original** hero
   illustration evoking several members of the community under a night sky with beacons.
2. The illustration SHALL be vector/lightweight and SHALL be loaded only when the `halloween`
   theme is active.
3. The illustration SHALL be `aria-hidden` or have suitable alternative text according to its
   role, and SHALL NOT introduce layout shift or harm the performance of the other themes.
4. The illustration SHALL avoid childish aesthetics and SHALL NOT use official logos or brands.

## Requirement 8 — Theme availability during judging

**User story:** As a Kiroween judge, I want to be able to review the full Halloween theme during
the evaluation period even if the actual date has moved on to Christmas/Winter.

#### Acceptance Criteria
1. WHEN accessed with `?theme=kiroween` or `?theme=halloween` THEN the system SHALL apply the
   Halloween theme regardless of the current date.
2. WHEN the judge navigates between pages during the session THEN the override SHALL be kept
   without needing to repeat the parameter in every URL (see Requirement 2.4).

## Requirement 9 — Preparation for a future remote override (not implemented)

**User story:** As a maintainer, I want to prepare for a future global override without redeploy,
without introducing that functionality now.

#### Acceptance Criteria
1. The system SHALL design the theme resolution function with an **optional** `remote` source
   contemplated in its signature but NOT implemented in this delivery (value always absent for
   now).
2. The system SHALL document that, in the future, this override could be fed from the snapshot
   already published to S3 (e.g. a field or sibling file), without requiring a rebuild.
3. The system SHALL NOT add in this delivery any real remote read or new dependency for this
   purpose.

## Requirement 10 — `reinvent` theme (phase 4)

**User story:** As an AWS community, I want a sober theme with a nod to AWS re:Invent during its
week, to reflect the most relevant moment of the year for the community.

#### Acceptance Criteria
1. The system SHALL define a `reinvent` theme with a bounded window (proposed: 11-28 → 12-07,
   Europe/Madrid) and high priority, so that it prevails over `winter` and `christmas` on those
   days.
2. The `reinvent` theme SHALL be elegant and professional (recognizable nod, not a parody), and
   SHALL NOT modify or caricature AWS or re:Invent logos or official brands.
3. The `reinvent` theme SHALL be implemented as a later phase (phase 4), reusing the theme
   engine without structural changes.

## Requirement 11 — `community-day` theme with dynamic window (phase 5)

**User story:** As a community, I want a theme around the date of AWS Community Day Spain, which
moves automatically every year when the edition changes, without reconfiguring the calendar.

#### Acceptance Criteria
1. The system SHALL derive the window of the `community-day` theme **dynamically** from
   `communityDay.date` in `config/community-day.ts` (e.g. from N days before to M days after the
   event), instead of a fixed annual window.
2. WHEN `communityDay.date` is not defined (e.g. `preparing` status) THEN the `community-day`
   theme SHALL remain inactive by date (it will still be available via URL override).
3. WHEN the Community Day edition is updated each year THEN the theme SHALL move with the new
   date WITHOUT changes to `config/themes.ts`.
4. The `community-day` theme SHALL have high priority in its window and SHALL NOT alter the
   principle of independence of the annual websites (do not copy agenda/speakers/tickets).
5. The `community-day` theme SHALL be implemented as a later phase (phase 5).

---

## Out of scope (for now)
- Real remote override (only the slot in the signature is left; Requirement 9).
- Changes to the event discovery backend.
- A manual theme selector visible to the end user (not requested).
- New themes beyond those listed.

## Phases
1. **Theme engine**: `default` (non-themed) + resolution by date/override + persistence.
2. **Seasonal themes + christmas** (palettes only) and **expressive halloween** (Costume Contest).
3. **Community hero illustration** (halloween).
4. **`reinvent` theme** (Requirement 10).
5. **`community-day` theme** with dynamic window (Requirement 11).

> Phases 4 and 5 are planned but **outside the immediate scope**; they are tackled after the MVP
> (phases 1-3), which is what matters for the Costume Contest.
