# Critical analysis: fit of `awscommunity.es` for Kiroween 2026

> ⚠️ **HISTORICAL DOCUMENT — SUPERSEDED (November 2026).**
> This analysis dates from 31 Oct 2026 and reflects the state of the repo **before** the
> Kiroween theme was built. Its two central conclusions are **no longer** valid:
>
> 1. *"Kiro usage: none"* → No longer true. The seasonal theme was designed and
>    implemented with Kiro (specs in `.kiro/specs/seasonal-themes/`).
> 2. *"The UI is not spooky, Costume Contest does not fit except on a separate surface"*
>    → Superseded. The **kiroween** theme (alias of `halloween`) now exists and meets the four
>    Costume Contest principles **without** touching the institutional website, because it is a
>    seasonal theme that can be switched on, not a permanent redesign.
>
> The actual, current Costume Contest submission is in
> **[`kiroween-2026-submission.md`](./kiroween-2026-submission.md)**. This document is kept
> only as a record of the product decision and of the starting point.

---

## (Original historical content)

> Analysis document. It does not imply code changes. Date: 31 Oct 2026.
>
> **Later note:** the inventory reflects the state as of that date. Since then, event operations moved to a daily run at 21:00, reviews/overrides in DynamoDB, a public backfill from 2026 and a full deployment through SSM/CloudFormation; the references to `manual-events.json` and six hours are historical.

## What the project really is (verified inventory)

Reading of frontend, backend, infrastructure and configuration:

- **Frontend**: static Astro 7 (`output: 'static'`), strict TypeScript, custom CSS with no
  component framework (no React). Light/professional palette (`--surface: #f2f4f7`, light
  background, AWS orange accent `#ff9900`), Inter + Space Grotesk typefaces, interactive SVG map
  of Spain with pulsing nodes. Accessible (skip-link, `:focus-visible`, `prefers-reduced-motion`,
  `:target`).
- **Planned backend**: a Node.js 22 (arm64) orchestrator Lambda every 6 h via EventBridge
  Scheduler. Source adapters → normalization/dedup → DynamoDB (history) → S3
  `events.json` (public snapshot) → SNS (alerts). Declared with AWS SAM.
- **Real integrations/sources**: Meetup RSS/Atom (`fast-xml-parser`), JSON-LD from public
  pages (disabled by default, requires explicit permission), manual events via JSON in
  Git, conditional HTTP (`If-None-Match`/`If-Modified-Since`/SHA-256).
- **Kiro usage**: **none**. There is no `.kiro/`, nor specs, steering or hooks.

Key cross-cutting trait: a very strong, explicit **anti-gimmick** philosophy ("no ambiguous
event is auto-published", "never repair ambiguous content with silent heuristics", "V1
does not use LLMs", "do not invent dates or locations"). It is real, conservative,
production software. Any change "for the hackathon" clashes with the project's DNA.

## ⚠️ Blocker before anything else (not a category, but it rules)

Kiro hackathons require the project to be **built using Kiro** and that this be documented
(specs, steering, vibe coding). This repo has nothing from Kiro. It is the most important change and
applies equally to all four categories.

> Note: the 2026 landing page states that the full rules and submission requirements were published on
> 30 Oct 2026. The categories are the same as 2025; re-read the final 2026 rules to
> confirm Kiro and submission requirements before deciding.

## Category by category

### 1. Resurrection — reviving obsolete/dead technology with modern approaches

- **Meets**: almost nothing. Closest: it uses RSS/Atom (an old format) alongside modern JSON-LD.
  But RSS is not dead and is not "revived": it is consumed as just another source.
- **Does not meet**: no obsolete technology is rescued. The whole stack is current.
- **Change for a strong fit**: invent a dead-technology layer (90s portal, gopher/WAP…).
- **Does it improve the product?** No. Pure gimmick. **Discard.**

### 2. Frankenstein — combining seemingly incompatible technologies

Full inventory of technologies/protocols/formats/sources the app uses:

- Language/build: strict TypeScript, static Astro, esbuild, Vitest.
- Input: conditional HTTP (ETag/Last-Modified/SHA-256), RSS 2.0 and Atom, JSON-LD / schema.org
  Event extracted from HTML, manual JSON versioned in Git.
- AWS: Lambda (Node 22, arm64), EventBridge Scheduler, DynamoDB, S3, SNS, SAM/CloudFormation,
  CloudFront/ACM/OIDC in deployment.
- Output: static `events.json` in S3 consumed by a static website, with a versioned fallback.

- **Genuinely unusual/incompatible combination?** No. It is an **idiomatic and standard**
  serverless ingestion-normalization-publication architecture. Everything fits by design; there is no
  friction or clash of paradigms.
- **Does not meet**: there is no pair of incompatible technologies nor an architectural "monster".
- **Change for a strong fit**: force a real incompatibility (esoteric runtime, COBOL stitched
  to the modern pipeline…).
- **Does it improve the product?** No. It adds complexity/fragility. Gimmick.

### 3. Skeleton Crew — lean reusable template, demonstrated with two distinct applications

- **Meets (genuine signal)**:
  - The backend is already an **adapter framework**: `EventSource` interface
    (`backend/sources/types.ts`), registration in `discover.ts`, the "Adding an adapter" guide.
  - **Data outside components** (`config/user-groups.ts`, `config/community-day.ts`,
    `manual-events.json`): designed for reconfiguration.
  - "Scheduler → ingestion → normalize/dedup → S3 snapshot → static website" architecture,
    reusable for any event aggregator.
- **Does not meet**:
  - Today it is **a single concrete application**, not an extracted/packaged template.
  - The **second distinct application** the category requires does not exist.
  - Branding/texts/config are coupled to the AWS Spain case; no core/instance separation.
- **Change for a strong fit**: extract the core (pipeline + adapters + snapshot + web theme)
  into a **parameterizable template** and demonstrate it with two instances: (a) AWS Community Spain and
  (b) another community/different topic reusing only config and adapters.
- **Does it improve the product?** **Yes, genuinely.** Separating core/instance improves maintainability,
  documents the extension contract and lets other communities reuse the project. It is the
  only fit where the change is real product, not a costume.

### 4. Costume Contest — haunting, polished, memorable UI where the spooky enhances the function

- **Is the current UI haunting/spooky?** **No.** It is modern, clean and *light* (not even dark by
  default: background `#f2f4f7`). Careful details (subtle 2.5% noise, SVG map with pulsing nodes,
  orange gradients, microinteractions with `prefers-reduced-motion`) but in a
  **corporate/editorial AWS** register, not horror.
- **Meets**: the bar for "polished" and "memorable" is high; the map is a differentiator.
- **Does not meet**: the central requirement of "haunting/spooky design elements".
- **Change for a strong fit**: a full spooky skin of tokens + animations.
- **Does it improve the product?** Not for the permanent website (it would go against the association's identity).
  It would only make real sense as a **separate surface** (themed `YYYY` edition/promo), never on
  the main website.

## Recommendations

1. **Best fit NOW**: none is *strong* today and the cross-cutting requirement of using Kiro is missing.
   The least forced is **Skeleton Crew** (adapter architecture + data outside
   components), but *as is* it does not qualify: the second app and the core extraction are missing.
   Frankenstein/Resurrection require artifice; Costume Contest does not fit because the UI is not spooky.

2. **Best fit with small-to-medium changes**: **Skeleton Crew.** The only category where the
   changes coincide with real improvements and with the project's open philosophy.
   - Secondary alternative: **Costume Contest**, only on a **separate surface**
     (`halloween.awscommunity.es` or promo mode), never on the institutional website.

3. **Minimal changes that improve the fit without harming the real product**:
   - **Unavoidable prerequisite**: continue part of the development **with Kiro** and leave a record:
     `.kiro/steering/` with the principles already written in the README (anti-heuristic, do not
     auto-publish ambiguous events, data outside components) and specs for the tasks.
   - **Skeleton Crew**: extract the pipeline into a parameterizable `core`; `awscommunity.es` as
     *instance 1*; create a distinct *instance 2* reusing only config + a new adapter.
   - **Without touching the good parts**: keep strict TypeScript, closed-fail parsers, dedup by
     source confidence and accessibility. Do not introduce LLMs or heuristics.

## Conclusion

Today the project is **not naturally** a Kiroween project: it is serious, conservative community
software. The honest fit is **Skeleton Crew** with a refactor the project would welcome anyway.
Any other category requires costumes that contradict its principles. And without documented use of
Kiro, no category is viable to submit.
