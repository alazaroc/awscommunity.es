---
inclusion: always
---

# Project structure

```
config/                  Public configuration outside components
  community-day.ts         Community Day + editions + copy + validation
  themes.ts                Seasonal theme calendar and metadata
  user-groups.ts           User Groups, public sources and coordinates

backend/
  handlers/discover.ts     Daily ingestion and per-group backfill
  handlers/admin.ts        Private moderation invoked through IAM
  sources/
    types.ts               EventSource, RawEvent, ReviewCandidate and HTTP state
    http.ts                conditionalFetch (ETag/Last-Modified/SHA-256)
    meetup-rss.ts          Incremental discovery through RSS
    meetup-listing.ts      Backfill from public past-event anchors
    public-page.ts         Strict validation of public JSON-LD
  normalization/
    events.ts              Normalization, identity, deduplication and PAST transition
    snapshot.ts            Public snapshot of AUTO_PUBLISHED, MANUAL and PAST
  persistence/
    repository.ts          EVENT#, REVIEW#, OVERRIDE#, SOURCE# and BACKFILL# in DynamoDB
    publish.ts             Override composition, S3 events.json and SNS
    types.ts               Persisted review, override and backfill types

infrastructure/
  template.yaml           SAM: DynamoDB, S3 snapshot, SNS, Lambdas and Scheduler
  site.yaml               Private S3, CloudFront, ACM and Route 53
  github-oidc.yaml        OIDC role restricted to the production Environment

scripts/
  deploy.sh               Idempotent orchestrator backed by SSM
  events-admin.mjs        CLI for reviews and corrections in DynamoDB
  download-snapshot.mjs   Downloads/validates the snapshot for the build

src/                     Astro website
  layouts/BaseLayout.astro
  components/            Header, Footer, EventsList, EventHistory, RecentEvents, YearActivity, SpainMap, CommunityDayPromo, ThemeSelector
  pages/                 index, events, user-groups (+ user-groups/[id] history), community-day, about, 404
  lib/                   Shared model and utilities
  styles/                Tokens, global styles and themes
  data/events.json       Versioned fallback snapshot

tests/                   Vitest for frontend, sources, backfill and snapshots
docs/                    Kiroween 2026 analysis and submission
```

## Conventions

- **Operational data does not live in Git.** Manual events, reviews and overrides are stored in DynamoDB through the admin Lambda.
- **The shared model** lives in `src/lib/types.ts` and is used by both frontend and backend.
- **Adding an adapter**: implement `EventSource`, validate closed, register the type and add fixtures for valid and incomplete input.
- **Publishing**: only `AUTO_PUBLISHED` and `MANUAL` (and `PAST`, which only those two can become); ambiguity creates a `REVIEW#`, never silent heuristics.
- **History**: per-group pages and yearly totals are community-wide or per-group, never a comparison between groups.
- **Styles**: every new visual variable is first added as a custom property in `tokens.css`.
