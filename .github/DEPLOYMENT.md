# Deploying AWS Community Spain

Infrastructure and application are deployed independently from any yearly `YYYY.awscommunity.es` site.

## First deployment

Local requirements:

- Node.js 22, npm, AWS CLI and AWS SAM CLI.
- An AWS session with permissions for CloudFormation, IAM, S3, CloudFront, Lambda, DynamoDB, EventBridge Scheduler, SNS and SSM (plus ACM and Route 53 if you use a custom domain).

No domain is required: by default the site is served from its CloudFront domain (`https://dxxxxxxxx.cloudfront.net`).

The full deployment is:

```bash
bash scripts/deploy.sh all --alert-email your-email@example.com
```

The script validates the AWS identity, stores configuration in SSM, runs the tests, deploys both stacks, imports the publicly visible history since 2026, runs the first ingestion and publishes the Astro site.

You can inspect the operation without touching AWS:

```bash
bash scripts/deploy.sh all --dry-run
```

AWS sends a confirmation email for each SNS subscription. You must accept them; AWS does not allow automating that confirmation.

## SSM Parameter Store

Configuration and reusable outputs are stored under `/community-spain/prod/` in the main region:

```text
config/domain
config/backend-region
config/site-region
config/hosted-zone-id
config/backfill-from
config/alert-emails
outputs/events-table
outputs/discovery-function
outputs/admin-function
outputs/snapshot-url
outputs/snapshot-bucket
outputs/alerts-topic-arn
outputs/site-bucket
outputs/cloudfront-distribution-id
outputs/site-url
```

`config/alert-emails` is a `SecureString`. To add an address and update the subscriptions declared in CloudFormation:

```bash
bash scripts/deploy.sh configure --alert-email another-person@example.com
bash scripts/deploy.sh backend
```

Up to five recipients are supported. Later deployments reuse the stored configuration; there is no need to copy outputs between steps.

## Resumable commands

```bash
bash scripts/deploy.sh configure --alert-email your-email@example.com
bash scripts/deploy.sh infrastructure  # private S3 and CloudFront (+ ACM and Route 53 with a domain)
bash scripts/deploy.sh backend         # DynamoDB, S3 snapshot, SNS and Lambdas
bash scripts/deploy.sh backfill        # publicly visible links since 2026-01-01
bash scripts/deploy.sh backfill --force # also repeats completed groups
bash scripts/deploy.sh daily           # forces an incremental ingestion now
bash scripts/deploy.sh site            # build, S3 and CloudFront invalidation
```

The backend is deployed to `AWS_REGION` (default `eu-west-1`). The frontend stack is deployed to `us-east-1` because CloudFront requires its ACM certificate to live there.

`infrastructure` must run before `backend`: the backend allows the website URL (`outputs/site-url`) to fetch the snapshot through CORS.

## Custom domain (optional)

The website works without a domain. To add one later, the domain's public Hosted Zone must be in the same AWS account:

```bash
DOMAIN=awscommunity.es bash scripts/deploy.sh configure
bash scripts/deploy.sh infrastructure   # ACM certificate, CloudFront alias and Route 53 records
bash scripts/deploy.sh backend          # allows the new origin in the snapshot CORS
bash scripts/deploy.sh site             # rebuilds canonical URLs with the new domain
```

Or run `configure` locally and then push to `main` to let the pipeline do the rest. Running `configure` without `DOMAIN` keeps the stored domain; `DOMAIN=none` removes it and goes back to the CloudFront domain.

The backfill invokes the Lambda once per User Group and is idempotent. DynamoDB keeps its coverage summary. Meetup may limit the events shown on its public page: the system imports every visible, verifiable link, but never claims that listing is a complete archive. A transient HTTP failure leaves the group as `PARTIAL`, lists the failed URLs in the summary and can be retried with the same command; it does not create a false editorial review.

## Moderation

Reviews and corrections live in DynamoDB, not in Git:

```bash
npm run events:admin -- reviews list
npm run events:admin -- reviews approve <review-id>
npm run events:admin -- reviews dismiss <review-id>
npm run events:admin -- events import-url <group-id> <public-url>
cat event.json | npm run events:admin -- events upsert --stdin
npm run events:admin -- overrides clear <event-id>
```

The CLI reads `outputs/admin-function` from SSM and invokes a private Lambda through IAM. Every administrative change regenerates `events.json` immediately.

## GitHub Actions

A single workflow, `pipeline.yml`:

- `lint`, `test` and `build` on pull requests and `main`.
- `deploy-prod` on every push to `main` (or manually via `workflow_dispatch`): infrastructure → backend → backfill → daily discovery → website. It is skipped when a push only touches `*.md` or `docs/`.

A force push does not trigger the workflow; run it manually with `gh workflow run pipeline.yml`.

The OIDC role and the Environment can be prepared from a privileged local session:

```bash
bash scripts/deploy.sh github-bootstrap --github-repository owner/repository
```

The script reuses the GitHub OIDC provider if it already exists, deploys a role restricted to `production` and, when `gh` is authenticated, creates and configures the Environment automatically.

Create the `production` Environment with just this:

### Variable

| Name | Value |
| --- | --- |
| `AWS_ROLE_FOR_GITHUB_DEPLOYMENTS` | ARN of the role assumable through GitHub OIDC |

The region (`eu-west-1`) is pinned in `pipeline.yml`. No secrets are used.

After assuming the role, the workflow reads buckets, distribution, email and snapshot from SSM. It needs no long-lived access keys and no duplicated configuration in GitHub.

The OIDC trust policy must restrict `sub` to:

```text
repo:<owner>/<repository>:environment:production
```

The role needs permission to read `/community-spain/prod/*` and to deploy both stacks. Protect `main`, require CI and, if appropriate, require review for the `production` Environment.
