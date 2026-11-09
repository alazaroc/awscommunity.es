# Kiroween 2026 — Costume Contest · AWS Community Spain

> Submission for the Kiroween 2026 **Costume Contest**. Current document.
> Replaces the earlier analysis `kiroween-2026-analysis.md` (kept as a historical record).

## What we are submitting

`awscommunity.es` is the permanent website of the AWS community in Spain: it shows the living
activity of the community (events and User Groups spread across the country) all year round, with
minimal manual maintenance and without ever publishing doubtful data.

For Kiroween we have not redesigned the website nor disguised it as something it is not. We added
a **seasonal "kiroween" theme** inside the site's theme system: an elegant Halloween night that
lights up on top of the real platform without altering its layout, its content or its
accessibility. The "costume" is, literally, a switchable theme.

## How to see it (important for the judges)

The theme can be forced via URL at any time, **even if the automatic calendar has already
switched to another season** (e.g. Christmas/Winter in December):

- **Enable Kiroween:** add `?theme=kiroween` to any URL — for example
  `https://awscommunity.es/?theme=kiroween`.
- The override is pinned for the session (stored in `sessionStorage`), so you can
  navigate between pages and the theme persists.
- **Return to automatic:** `?theme=auto`.

`kiroween` is an alias of the internal `halloween` theme; both work in the URL.

## The four Costume Contest principles

### 1. Polished
- The layout does not change: when switching the theme only CSS *custom properties* change, so there
  is no reflow or *layout shift*. The theme resolver runs in an inline script **before the first
  paint**, so there is no FOUC.
- Typography, grid and hierarchy remain intact compared with the everyday professional website.
- Careful contrast: large headlines get `text-shadow` to stay legible over the
  night scene; surfaces that were light in the base design are rewritten as translucent dark
  panels that stay legible (including the `:target` state of the group cards).

### 2. Memorable
- A real night sky across the whole page: moon with halo, star field, drifting fog
  banks and vignette.
- Graveyard props with nods to the community: a tombstone with the engraved epitaph
  **"R.I.P. us-east-1"** (an inside joke about the AWS region that always goes down), a dead tree, a
  pumpkin, a hanging spider and bats flapping across the sky.

### 3. Spooky (tasteful, not childish)
- An elegant "haunted night" register, not cartoonish: violet/amber palette, fog, spectral
  glow. Nothing flashes garishly or makes the brand look childish.
- The map of Spain becomes a night map from which the country seems to **emerge from the fog**.

### 4. The visuals communicate the product's function
Each effect maps to a real product concept. This is what sets the entry apart from random
decoration:

| Product concept | Visual translation in Kiroween |
|---|---|
| Community distributed across Spain | Full-screen night map of Spain |
| User Groups | Each group is an **illuminated amber beacon** on the map |
| Cities with upcoming events | Beacons in **spectral violet**, brighter — "alive tonight" |
| **Discovery of new activity** | When the pipeline recently discovers an event, its city **lights up white and emits a spectral shockwave**, as if it had just awakened |
| AWS / cloud / region | The "R.I.P. us-east-1" gag engraved on the tombstone |

The "new activity" highlight uses the **real** `firstSeen` field that the discovery backend
writes for each event: a city only lights up as "new" if its activity was genuinely discovered
within the recent window. Faithful to the project's principle of **not inventing data**.

## Design decisions and self-imposed limits

- **We do not touch logos or trademarks.** All artwork is original and generic Halloween (moon,
  bats, ghost, pumpkin, spider, cobweb, tree, tombstone). There is no reinterpretation of AWS or
  Kiro logos. The footer declares independence: *"Comunidad independiente · No afiliada a Amazon
  Web Services"* (Independent community · Not affiliated with Amazon Web Services).
- **It is neither permanent nor institutional.** The theme lives inside the seasonal system; the
  association's everyday identity is not affected.
- **Accessibility maintained:**
  - All decoration is `aria-hidden` and purely visual.
  - **All** animations are wrapped in `@media (prefers-reduced-motion: no-preference)`;
    with reduced motion, elements remain at a visible resting state.
  - Skip-link, `:focus-visible`, map roles/labels and `alt=""` on decorative images are preserved.
  - The map fog does not capture the pointer (`pointer-events: none`): all beacons remain
    clickable links.

## The role of Kiro

The seasonal theme system (including Kiroween) was designed and implemented with Kiro through a
spec in `.kiro/specs/seasonal-themes/` (requirements → design → tasks). The theme resolution
logic and the event selection helpers are covered by unit tests
(`tests/theme.test.ts`, `tests/events-helpers.test.ts`).

## Where it lives in code

- Calendar, priorities and `kiroween → halloween` alias: `config/themes.ts`.
- Theme resolution (date + URL/session override) and precedence: `src/lib/theme.ts`,
  applied before paint in `src/layouts/BaseLayout.astro`.
- Theme aesthetics (tokens, UI coverage, map, atmosphere, animations):
  `src/styles/themes.css`.
- Decorative night scene: `src/components/HalloweenAtmosphere.astro`
  (+ PNGs in `public/halloween/`).
- Map, beacons and `has-event` / `is-fresh` highlights: `src/components/SpainMap.astro`.
- Event selection and "recently discovered activity": `src/lib/events.ts`
  (`upcomingGroupIds`, `freshlyDiscoveredGroupIds`).

## Verification

`npm test && npm run build` passes green (including the theme resolution tests and the
event helper tests).
