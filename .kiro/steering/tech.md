---
inclusion: always
---

# Stack and commands

## Frontend

- **Static Astro** (`output: 'static'`, `build.format: 'directory'`). No React or component
  framework. Static HTML and **minimal client-side JavaScript**.
- **Strict TypeScript.**
- **Custom CSS**, no libraries. All styling is centralized in:
  - `src/styles/tokens.css`: custom properties (colors, radii, shadows, typography).
  - `src/styles/global.css`: app styles; imports `tokens.css`.
  - `BaseLayout.astro` imports `global.css` once for the whole site.
- Accessibility built in: skip link, `:focus-visible`, `prefers-reduced-motion`, `:target`.
  **Keep this bar in every change.**

## Backend (AWS)

- Discovery Lambda Node.js 22 (arm64): `backend/handlers/discover.ts`.
- Private admin Lambda, invocable through IAM: `backend/handlers/admin.ts`.
- EventBridge Scheduler (21:00 `Europe/Madrid`) → adapters → normalization/dedup → DynamoDB
  (history, reviews and overrides) → S3 `events.json` → SNS.
- Initial verifiable backfill since 2026 through public Meetup pages.
- Declared with **AWS SAM** in `infrastructure/template.yaml`; hosting in `infrastructure/site.yaml` (CloudFront domain by default, custom domain optional).
- Deployment configuration lives in SSM under `/community-spain/prod/` (SSM names cannot start
  with `aws`).
- AWS SDK v3. Conditional HTTP with `If-None-Match` / `If-Modified-Since` / SHA-256 hash.
- **Closed-fail** parsers: if title, explicit date or URL is missing, they fail; they never guess.

## Commands

```bash
npm install
npm run dev            # http://localhost:4321
npm test               # vitest (unit)
npm run check          # types + Astro templates
npm run build          # astro check && astro build -> dist/
npm run preview        # preview dist/
npm run test:sources   # optional live feed validation (LIVE_SOURCE_TESTS=1)
npm run backend:build  # sam build
bash scripts/deploy.sh all --dry-run
npm run events:admin -- reviews list
```

**Minimum validation before finishing a change:** `npm test && npm run build`.
For backend or deployment changes, also review `.github/workflows/pipeline.yml`.

Requires Node.js 22.
