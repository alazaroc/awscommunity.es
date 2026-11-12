<div align="center">

# AWS Community Spain

**The living activity of the AWS community in Spain, all year round.** Events and User Groups on a static website, with minimal manual upkeep and no doubtful data ever published.

🌐 [awscommunity.es](https://awscommunity.es) · 🚀 [Deployment](.github/DEPLOYMENT.md) · 🤝 [Contributing](CONTRIBUTING.md)

[![CI/CD Pipeline](https://github.com/alazaroc/awscommunity.es/actions/workflows/pipeline.yml/badge.svg)](https://github.com/alazaroc/awscommunity.es/actions/workflows/pipeline.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
![Node](https://img.shields.io/badge/node-%E2%89%A522-brightgreen)
![Astro](https://img.shields.io/badge/Astro-static-BC52EE?logo=astro&logoColor=white)
![AWS Serverless](https://img.shields.io/badge/AWS-serverless-FF9900?logo=amazonaws&logoColor=white)
![Built with Kiro](https://img.shields.io/badge/built%20with-Kiro-5A3FFF)

</div>

## What it is

The permanent website of [AWS Community Spain](https://awscommunity.es), independent from the yearly AWS Community Day Spain sites:

- `awscommunity.es`: community, activity and User Groups all year round.
- `YYYY.awscommunity.es`: an independent site for each Community Day edition.

The website UI is available in Spanish and English, with Spanish as the default. Code and documentation are in English.

## Why

User Groups publish on different channels (Meetup and their own sites), which makes it hard to see at a glance what is happening in Spain. This project gathers that activity in a single place, keeps it up to date automatically, and **prefers publishing nothing over publishing something doubtful**.

## What's inside

- **Upcoming events** discovered daily from public sources, with history since 2026.
- **Interactive map and cards for the 12 User Groups**, keyboard accessible and working without JavaScript.
- **Event history**: a page per User Group (`/user-groups/<id>/`) with its past events by year, plus the current year's community-wide totals and a 12-month timeline on `/events/`. Like the upcoming agenda, they are refreshed in the browser from the live S3 snapshot (the static HTML is only the no-JavaScript fallback), so events move into the history as soon as they end, with no rebuild.
- **Private moderation**: anything ambiguous is not published; it goes to a review queue managed with a CLI.
- **Configurable AWS Community Day promotion**, without copying content from the yearly sites.
- **Seasonal themes** (including Halloween) through a theme system that never alters layout or accessibility. Try `?theme=halloween`.

## Architecture

```text
EventBridge Scheduler → Discovery Lambda → DynamoDB → S3 events.json → SNS
                                                          ↓
            Static Astro site (private S3 + CloudFront [+ optional custom domain])
```

Full details in [Automatic discovery](#automatic-discovery).

## Stack

- Static Astro + strict TypeScript.
- Custom CSS, no React or component framework.
- Two Node.js 22 (arm64) Lambdas: scheduled discovery and private administration through IAM.
- EventBridge Scheduler, DynamoDB, S3 and SNS declared with AWS SAM.
- Vitest for event and configuration logic.

## Local development

Requires Node.js 22.

```bash
npm install
npm run dev
```

The site runs at `http://localhost:4321`. Main routes:

- `http://localhost:4321/`
- `http://localhost:4321/events/`
- `http://localhost:4321/user-groups/`
- `http://localhost:4321/community-day/`
- `http://localhost:4321/about/`

Full validation before pushing changes:

```bash
npm test
npm run build
npm run test:sources
npm audit
```

Each check can also be run separately:

```bash
npm test             # unit tests
npm run test:sources # optional live validation of public RSS feeds
npm run check        # types and Astro templates
npm run build        # validation + static build into dist/
npm run preview      # preview dist/
```

If a deployed snapshot exists, copy `.env.example` to `.env` and set:

```dotenv
PUBLIC_EVENTS_SNAPSHOT_URL=https://<bucket>.s3.<region>.amazonaws.com/events.json
```

The page ships the versioned snapshot in `src/data/events.json` as a static fallback and refreshes it in the browser only when a newer remote version is available. While there is no deployed snapshot and no confirmed manual events, the UI correctly shows «No hay próximos eventos anunciados» (no upcoming events announced); that is not a loading error.

## User Groups

The 12 groups live in [`config/user-groups.ts`](config/user-groups.ts), outside the visual components. To add or modify one:

1. Update name, city, region and links.
2. Define one or more `eventSources`.
3. Add coordinates to place it on the interactive map.
4. Add the optional `description`, `organizers` and `contact` fields only if verified.
5. Check `description` against the public «About this group» section on Meetup or, if there is no Meetup, the official website. Keep it short and faithful; do not add claims that are not in the source.
6. Run `npm test && npm run build`.

`organizers` accepts `{ name, url? }` items and `contact` uses `{ label, url }` (for example, a website or a `mailto:` link). The UI omits those blocks entirely when they are not configured; names, emails, member counts or schedules must never be inferred. Configured descriptions are based on the public channels linked on each card and must be re-verified when updated.

`active` controls whether the backend queries the group. The UI never labels a group as inactive in public.

Map points link to `/user-groups#<id>`. Hovering or keyboard-focusing a point shows the group name. The hash scrolls to and highlights its card, shows the «Grupo activo» label and keeps the map marker in sync, including on back/forward navigation; for example, `/user-groups#asturias`. Without JavaScript, `:target` keeps the card highlighted. Each card offers a description, official links and an expandable activity and contact panel. The geographic outline is simplified from public-domain [Natural Earth](https://www.naturalearthdata.com/) data.

## Moderation and manual events

Reviews, exceptions and corrections live in DynamoDB; the backend never modifies Git. The table holds automatic events (`EVENT#`), reviews (`REVIEW#`), administrative corrections (`OVERRIDE#`) and source/backfill state. A correction takes priority when generating `events.json`, while the latest automatic version is still kept for audit.

The private CLI uses AWS credentials and invokes a Lambda with no public URL:

```bash
npm run events:admin -- reviews list
npm run events:admin -- reviews approve <review-id>
npm run events:admin -- reviews dismiss <review-id>
npm run events:admin -- events import-url zaragoza https://www.meetup.com/awszgz/events/316949236/
cat /tmp/verified-event.json | npm run events:admin -- events upsert --stdin
npm run events:admin -- overrides clear <event-id>
```

The `events upsert` JSON is read from stdin and is not stored in the repository. It must include `sourceId`, `userGroupId`, title, dates with time zone, city and an HTTPS URL. To correct a Meetup event keep `sourceId: "meetup:<numeric-id>"`, so the override replaces the same event instead of creating another. Never invent dates or locations: if they cannot be verified, leave the review open or dismiss it.

## Automatic discovery

```text
EventBridge Scheduler (21:00 Europe/Madrid, once a day)
  → Discovery Lambda
  → RSS + public JSON-LD pages
  → validation + normalization + deduplication
  → DynamoDB (events, history and reviews)
  → S3 events.json (upcoming and past public events)
  → SNS (new, changed and cancelled events, reviews and errors)
```

DynamoDB keeps past events. `events.json` contains upcoming events with `AUTO_PUBLISHED` or `MANUAL` status plus `PAST` events, which power the event history. Only `AUTO_PUBLISHED` and `MANUAL` events ever become `PAST`, so an event that was pending review is never published just because its date has gone by. Ambiguous, cancelled or pending-review events are not published. The stable identity made of User Group and Meetup ID means a new run updates the same record without duplicating it and preserves `firstSeen`.

HTTP sources use `If-None-Match`, `If-Modified-Since` and a SHA-256 hash. A parser that does not find a title, official URL, explicit date with offset, valid end or consistent organizer fails closed. Already-known future pages are re-queried to detect changes and cancellations; transient failures keep the last valid data and raise alerts.

### Meetup

No GraphQL, OAuth consumers, `__NEXT_DATA__`, internal endpoints or private Meetup APIs are used.

1. `MeetupRssSource` uses the public feed only to discover URLs. `pubDate` is treated as the announcement date and never as the event date.
2. The Lambda visits the canonical public page and processes only its Schema.org `Event` JSON-LD.
3. An event is marked `AUTO_PUBLISHED` only if its ID and slug belong to the configured group, the organizer matches, the dates include a time zone and `eventStatus` is `EventScheduled`. `EventCancelled` removes it from the snapshot.
4. The image stays as an HTTPS URL on a supported public CDN. Speakers are shown only when JSON-LD provides them as `performer` or `speaker`; they are never inferred from free text.
5. Tracked pages are re-validated daily until they finish. Finished records remain in DynamoDB even when they are no longer queried.
6. On first deployment, the backfill walks the visible links on the public past-events page and stores only events since `2026-01-01`. The stored summary reports visible public coverage; it does not claim that Meetup exposed its whole history. Download failures are recorded as `PARTIAL` and retried on the next `backfill` run; only structured information that was downloaded but is ambiguous goes to moderation.

The current configuration enables this flow for all 12 active groups with public Meetup sources. Sevilla was added after its public Meetup feed and canonical event pages were verified; run the normal backfill/discovery workflow before expecting its events in the published snapshot.

### Adding an adapter

1. Implement `EventSource` from [`backend/sources/types.ts`](backend/sources/types.ts).
2. Return `RawEvent[]`, optional review candidates and a `SourceState`.
3. Add the type to the model and register it in `backend/handlers/discover.ts`.
4. Explicitly decide whether its results are `AUTO_PUBLISHED` or require review.
5. Add parser fixtures and tests, including incomplete input.

Never repair ambiguous content with silent heuristics. V1 does not use LLMs.

## AWS deployment

The full local deployment is orchestrated by a single script. It requires Node.js 22, AWS CLI, SAM CLI and a valid AWS session:

```bash
bash scripts/deploy.sh all --alert-email your-email@example.com
# Optional: also prepares OIDC and the GitHub Environment
bash scripts/deploy.sh all --alert-email your-email@example.com --github-repository owner/repository
```

The script:

1. Stores reusable configuration under `/community-spain/prod/` in SSM Parameter Store.
2. Deploys private S3 and CloudFront through `infrastructure/site.yaml` in `us-east-1`. The site is served from the CloudFront domain; a custom domain is optional (see [Custom domain](.github/DEPLOYMENT.md#custom-domain-optional)).
3. With a custom domain, also discovers its Route 53 Hosted Zone and creates the ACM certificate and DNS records.
4. Deploys DynamoDB, the snapshots S3 bucket, SNS and the Lambdas through SAM.
5. Runs the public 2026 backfill per User Group and a first daily ingestion.
6. Builds Astro, publishes to S3 and invalidates CloudFront.

Partial, resumable commands:

```bash
bash scripts/deploy.sh configure --alert-email other-email@example.com
bash scripts/deploy.sh infrastructure
bash scripts/deploy.sh backend
bash scripts/deploy.sh backfill
bash scripts/deploy.sh backfill --force  # also repeats groups already completed
bash scripts/deploy.sh daily
bash scripts/deploy.sh site
bash scripts/deploy.sh all --dry-run
```

Up to five SNS recipients are supported. Each address must confirm once through the email sent by AWS; that anti-spam step cannot be automated. SES is not required.

The Scheduler uses `cron(0 21 * * ? *)` with the `Europe/Madrid` time zone, so it runs once a day at 21:00 even across daylight-saving changes. The backfill is not part of that daily run.

## Community Day promotion mode

[`config/community-day.ts`](config/community-day.ts) is the single configuration source:

```ts
promotionMode: 'none' | 'banner' | 'hero'
status: 'preparing' | 'announced' | 'cfp' | 'tickets' | 'agenda' | 'completed'
```

- `none`: regular community hero; Community Day appears in its own block.
- `banner`: compact notice under the header, regular hero and the full block further down.
- `hero`: Community Day temporarily takes over the hero; community content follows right after.

`preparing` lets you say the next edition is in the works without publishing a date, city or yearly site yet. The mode **never changes automatically by date**. `status` adapts the message and `ctaUrls` can lead straight to the permanent page, CFP, tickets or agenda. The home page also links all previous editions from the Community Day block.

### Adding an edition

1. Update `communityDay` with year, place, date, URL and status.
2. Add the edition to `communityDayEditions`, in descending order.
3. Do not copy agenda, speakers or tickets into this site.
4. Run the configuration test and the build.

## Continuous deployment

The `pipeline.yml` workflow (lint, tests, build and production deploy) is included. Detailed configuration is in [`.github/DEPLOYMENT.md`](.github/DEPLOYMENT.md).

The workflow assumes the AWS role through GitHub OIDC and then reuses the configuration stored in SSM. The `production` Environment only needs the `AWS_ROLE_FOR_GITHUB_DEPLOYMENTS` variable (role ARN). The region (`eu-west-1`) is pinned in the workflow.

There is no need to duplicate the email, bucket, snapshot URL or CloudFront ID in GitHub. The permanent frontend and its AWS resources are independent from `2026.awscommunity.es` and every future edition.

## Product principles

- Activity before institutional content.
- Data stays out of components.
- Static HTML and minimal JavaScript.
- No ambiguous event is auto-published; no data is invented.
- No public rankings between User Groups.
- The yearly Community Day sites remain independent.
- V1 uses no LLMs or silent heuristics.

## Contributing

Contributions are welcome: read [CONTRIBUTING.md](CONTRIBUTING.md) and the [Code of Conduct](CODE_OF_CONDUCT.md). To report a vulnerability, see [SECURITY.md](SECURITY.md).

## Author

Created and maintained by **[Alejandro Lázaro Chueca](https://github.com/alazaroc)**.

## License

Code released under the [MIT license](LICENSE) © 2026 Alejandro Lázaro Chueca.

AWS, Amazon Web Services and related logos are trademarks of Amazon.com, Inc. or its affiliates. This project is a community initiative and is not affiliated with or endorsed by AWS. Names and brands of the User Groups belong to their respective organizers. The map outline comes from public-domain [Natural Earth](https://www.naturalearthdata.com/) data.
