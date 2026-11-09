---
inclusion: always
---

# Product: AWS Community Spain

Permanent website of the AWS community in Spain (`awscommunity.es`), independent from the yearly
Community Day sites (`YYYY.awscommunity.es`).

- Public identity: **AWS Community Spain**.
- Legal entity: **Asociación Cloud Community Spain**, mentioned ONLY on `/about`. It is not the
  public brand; do not use it as the community name outside that page.

## What it solves

Show the living activity of the community (events and User Groups) all year round, with minimal
manual upkeep and without ever publishing doubtful data.

## Audience

People in the AWS community in Spain: meetup attendees, User Group organizers, the curious.
Professional and approachable tone; the website itself is in Spanish.

## Product principles (non-negotiable)

- **Activity before institutional content.**
- **No ambiguous event is auto-published.** When in doubt, do not publish.
- **Never invent data.** Never fabricate dates, locations, organizer names, emails, member counts
  or agendas. If a piece of data is not confirmed, it is omitted.
- **No public rankings** between User Groups. The UI never labels a group as inactive.
- **The yearly Community Day sites remain independent.** Do not copy an edition's agenda, speakers
  or tickets here.
- **V1 uses no LLMs or silent heuristics** to repair content.

## Data sources of truth (outside components)

- `config/user-groups.ts`: User Groups, their sources and coordinates.
- `config/community-day.ts`: the single Community Day configuration and previous editions.
- DynamoDB: automatic events, history, reviews and administrative corrections.
- `src/data/events.json`: versioned snapshot used as a static fallback.

When touching any of these, respect the principles above and run `npm test && npm run build`.
