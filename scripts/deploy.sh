#!/usr/bin/env bash
set -euo pipefail

APP="awscommunity-es"
ENVIRONMENT="${ENVIRONMENT:-prod}"
# Optional custom domain. Empty = serve only from the CloudFront domain.
DOMAIN="${DOMAIN:-}"
# SSM cannot store empty strings, so "no custom domain" is persisted as this marker.
NO_DOMAIN="none"
BACKEND_REGION="${AWS_REGION:-eu-west-1}"
SITE_REGION="${SITE_REGION:-us-east-1}"
# SSM names must not start with "aws" (reserved prefix), so the app name is not reused here.
SSM_NAMESPACE="community-spain"
PREFIX="/${SSM_NAMESPACE}/${ENVIRONMENT}"
BACKEND_STACK="${APP}-events"
SITE_STACK="${APP}-site"
DRY_RUN=false
FORCE_BACKFILL=false
ALERT_EMAIL=""
GITHUB_REPOSITORY=""

usage() {
  cat <<'USAGE'
Usage: bash scripts/deploy.sh <command> [options]

Commands:
  configure       Persist deployment configuration in SSM (set DOMAIN=example.com to add a custom domain)
  infrastructure  Deploy S3 and CloudFront (plus ACM and Route 53 with a custom domain)
  backend         Build and deploy the SAM backend
  backfill        Import publicly visible Meetup events from 2026
  daily           Invoke the daily discovery immediately
  site            Build and publish the Astro website
  github-bootstrap  Create the restricted GitHub OIDC role and Environment
  all             Validate, deploy everything, backfill, ingest and publish

Options:
  --alert-email EMAIL          Add an SNS recipient (maximum five)
  --github-repository OWNER/REPO  Repository allowed to assume the OIDC role
  --force                      Repeat completed backfills (backfill/all only)
  --dry-run                    Print the selected operation without changing AWS
USAGE
}

[[ $# -gt 0 ]] || { usage; exit 2; }
COMMAND="$1"
shift
while [[ $# -gt 0 ]]; do
  case "$1" in
    --alert-email)
      [[ $# -ge 2 ]] || { echo "--alert-email requires a value" >&2; exit 2; }
      ALERT_EMAIL="$2"
      shift 2
      ;;
    --github-repository)
      [[ $# -ge 2 ]] || { echo "--github-repository requires owner/repository" >&2; exit 2; }
      GITHUB_REPOSITORY="$2"
      shift 2
      ;;
    --force)
      FORCE_BACKFILL=true
      shift
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage
      exit 2
      ;;
  esac
done

case "$COMMAND" in
  configure|infrastructure|backend|backfill|daily|site|github-bootstrap|all) ;;
  *) usage; exit 2 ;;
esac
if [[ "$FORCE_BACKFILL" == true && "$COMMAND" != "backfill" && "$COMMAND" != "all" ]]; then
  echo "--force is only valid with backfill or all" >&2
  exit 2
fi

if [[ "$DRY_RUN" == true ]]; then
  printf 'Dry run: command=%s backend-region=%s site-region=%s domain=%s ssm-prefix=%s\n' \
    "$COMMAND" "$BACKEND_REGION" "$SITE_REGION" "${DOMAIN:-stored}" "$PREFIX"
  exit 0
fi

for tool in aws node npm; do
  command -v "$tool" >/dev/null || { echo "Required command not found: $tool" >&2; exit 1; }
done
if [[ "$COMMAND" == "backend" || "$COMMAND" == "all" ]]; then
  command -v sam >/dev/null || { echo "Required command not found: sam" >&2; exit 1; }
fi
aws sts get-caller-identity --region "$BACKEND_REGION" >/dev/null

ssm_get() {
  aws ssm get-parameter \
    --name "$PREFIX/$1" \
    --with-decryption \
    --query 'Parameter.Value' \
    --output text \
    --region "$BACKEND_REGION" 2>/dev/null
}

ssm_put() {
  local name="$1" value="$2" type="${3:-String}"
  aws ssm put-parameter \
    --name "$PREFIX/$name" \
    --value "$value" \
    --type "$type" \
    --overwrite \
    --region "$BACKEND_REGION" >/dev/null
}

stack_output() {
  local stack="$1" region="$2" key="$3"
  aws cloudformation describe-stacks \
    --stack-name "$stack" \
    --query "Stacks[0].Outputs[?OutputKey=='$key'].OutputValue | [0]" \
    --output text \
    --region "$region"
}

# A stack whose first creation failed stays in ROLLBACK_COMPLETE, holds no resources
# and cannot be updated: delete it so the next deploy can create it again.
remove_failed_first_stack() {
  local stack="$1" region="$2" status
  status=$(aws cloudformation describe-stacks --stack-name "$stack" --region "$region" \
    --query 'Stacks[0].StackStatus' --output text 2>/dev/null || true)
  if [[ "$status" == "ROLLBACK_COMPLETE" ]]; then
    echo "Stack $stack is in ROLLBACK_COMPLETE after a failed first creation; deleting it before redeploying."
    aws cloudformation delete-stack --stack-name "$stack" --region "$region"
    aws cloudformation wait stack-delete-complete --stack-name "$stack" --region "$region"
  fi
}

find_hosted_zone() {
  local zone_id
  zone_id=$(aws route53 list-hosted-zones-by-name \
    --dns-name "$DOMAIN" \
    --query "HostedZones[?Name=='${DOMAIN}.' && Config.PrivateZone==\`false\`] | [0].Id" \
    --output text \
    --region "$BACKEND_REGION")
  zone_id="${zone_id#/hostedzone/}"
  if [[ -z "$zone_id" || "$zone_id" == "None" ]]; then
    echo "No exact Route 53 hosted zone found for $DOMAIN in this account" >&2
    exit 1
  fi
  printf '%s' "$zone_id"
}

# Reads an optional config value; prints nothing when it is unset or the "none" marker.
optional_config() {
  local value
  value=$(ssm_get "$1" || true)
  [[ "$value" == "$NO_DOMAIN" ]] || printf '%s' "$value"
}

configure() {
  local zone_id="$NO_DOMAIN" emails existing
  # Unset DOMAIN keeps the stored domain; DOMAIN=none removes it.
  [[ -n "$DOMAIN" ]] || DOMAIN=$(optional_config config/domain)
  [[ "$DOMAIN" != "$NO_DOMAIN" ]] || DOMAIN=""
  if [[ -n "$DOMAIN" ]]; then
    zone_id=$(find_hosted_zone)
  fi

  ssm_put config/domain "${DOMAIN:-$NO_DOMAIN}"
  ssm_put config/backend-region "$BACKEND_REGION"
  ssm_put config/site-region "$SITE_REGION"
  ssm_put config/hosted-zone-id "$zone_id"
  ssm_put config/backfill-from "2026-01-01"

  existing=$(ssm_get config/alert-emails || true)
  emails="$existing"
  if [[ -n "$ALERT_EMAIL" ]] && ! printf ',%s,' "$emails" | grep -Fq ",$ALERT_EMAIL,"; then
    emails="${emails:+$emails,}$ALERT_EMAIL"
  fi
  if [[ -z "$emails" ]]; then
    echo "Configure at least one recipient with --alert-email" >&2
    exit 1
  fi
  if [[ $(awk -F, '{ print NF }' <<<"$emails") -gt 5 ]]; then
    echo "A maximum of five SNS recipients is supported" >&2
    exit 1
  fi
  ssm_put config/alert-emails "$emails" SecureString
  echo "Configuration stored under $PREFIX (custom domain: ${DOMAIN:-$NO_DOMAIN}; email values hidden)."
}

require_configuration() {
  local key
  for key in config/domain config/alert-emails; do
    if ! ssm_get "$key" >/dev/null; then
      echo "Missing SSM parameter $PREFIX/$key. Run once: bash scripts/deploy.sh configure --alert-email <email>" >&2
      exit 1
    fi
  done
}

deploy_infrastructure() {
  local domain zone_id
  domain=$(optional_config config/domain)
  zone_id=$(optional_config config/hosted-zone-id)
  remove_failed_first_stack "$SITE_STACK" "$SITE_REGION"
  aws cloudformation deploy \
    --stack-name "$SITE_STACK" \
    --template-file infrastructure/site.yaml \
    --parameter-overrides DomainName="$domain" HostedZoneId="$zone_id" \
    --no-fail-on-empty-changeset \
    --region "$SITE_REGION"

  ssm_put outputs/site-bucket "$(stack_output "$SITE_STACK" "$SITE_REGION" SiteBucketName)"
  ssm_put outputs/cloudfront-distribution-id "$(stack_output "$SITE_STACK" "$SITE_REGION" CloudFrontDistributionId)"
  ssm_put outputs/site-url "$(stack_output "$SITE_STACK" "$SITE_REGION" SiteUrl)"
}

deploy_backend() {
  local emails from site_url index
  local -a recipients overrides
  emails=$(ssm_get config/alert-emails)
  from=$(ssm_get config/backfill-from)
  site_url=$(ssm_get outputs/site-url) || {
    echo "Missing $PREFIX/outputs/site-url. Run 'bash scripts/deploy.sh infrastructure' first." >&2
    exit 1
  }
  IFS=',' read -r -a recipients <<<"$emails"
  # The schedule is not overridden: SAM splits overrides on spaces and the cron
  # expression has them. Its single source of truth is the template default.
  overrides=(
    "SiteOrigin=$site_url"
    "BackfillFrom=$from"
  )
  # SAM rejects empty "Key=" overrides; unused AlertEmailN slots keep their '' template default.
  for index in "${!recipients[@]}"; do
    if [[ -n "${recipients[$index]}" ]]; then
      overrides+=("AlertEmail$((index + 1))=${recipients[$index]}")
    fi
  done

  remove_failed_first_stack "$BACKEND_STACK" "$BACKEND_REGION"
  sam build --template-file infrastructure/template.yaml
  sam deploy \
    --stack-name "$BACKEND_STACK" \
    --resolve-s3 \
    --capabilities CAPABILITY_IAM \
    --no-confirm-changeset \
    --no-fail-on-empty-changeset \
    --parameter-overrides "${overrides[@]}" \
    --region "$BACKEND_REGION"

  ssm_put outputs/events-table "$(stack_output "$BACKEND_STACK" "$BACKEND_REGION" EventsTableName)"
  ssm_put outputs/discovery-function "$(stack_output "$BACKEND_STACK" "$BACKEND_REGION" DiscoveryFunctionName)"
  ssm_put outputs/admin-function "$(stack_output "$BACKEND_STACK" "$BACKEND_REGION" AdminFunctionName)"
  ssm_put outputs/snapshot-url "$(stack_output "$BACKEND_STACK" "$BACKEND_REGION" SnapshotUrl)"
  ssm_put outputs/snapshot-bucket "$(stack_output "$BACKEND_STACK" "$BACKEND_REGION" SnapshotBucketName)"
  ssm_put outputs/alerts-topic-arn "$(stack_output "$BACKEND_STACK" "$BACKEND_REGION" AlertsTopicArn)"
}

invoke_discovery() {
  local payload="$1" output
  output=$(mktemp)
  aws lambda invoke \
    --function-name "$(ssm_get outputs/discovery-function)" \
    --cli-binary-format raw-in-base64-out \
    --payload "$payload" \
    --region "$BACKEND_REGION" \
    "$output" >/dev/null
  node -e 'const fs=require("node:fs"); const value=JSON.parse(fs.readFileSync(process.argv[1], "utf8")); if (value.errorMessage) { console.error(value.errorMessage); process.exit(1) } console.log(JSON.stringify(value))' "$output"
  rm -f "$output"
}

run_backfill() {
  local from metadata groups group force
  from=$(ssm_get config/backfill-from)
  metadata=$(invoke_discovery '{"mode":"groups"}')
  groups=$(node -e 'const value=JSON.parse(process.argv[1]); console.log(value.groups.join(" "))' "$metadata")
  force=false
  [[ "$FORCE_BACKFILL" == true ]] && force=true
  for group in $groups; do
    echo "Backfilling $group from $from"
    invoke_discovery "{\"mode\":\"backfill\",\"groupId\":\"$group\",\"from\":\"$from\",\"force\":$force}"
  done
}

run_daily() {
  invoke_discovery '{"mode":"daily"}'
}

deploy_site() {
  local snapshot_url bucket distribution site_url
  snapshot_url=$(ssm_get outputs/snapshot-url)
  bucket=$(ssm_get outputs/site-bucket)
  distribution=$(ssm_get outputs/cloudfront-distribution-id)
  site_url=$(ssm_get outputs/site-url)

  PUBLIC_EVENTS_SNAPSHOT_URL="$snapshot_url" npm run events:download
  SITE_URL="$site_url" PUBLIC_EVENTS_SNAPSHOT_URL="$snapshot_url" npm run build
  aws s3 sync dist "s3://$bucket" --delete --cache-control 'public,max-age=0,must-revalidate' --region "$SITE_REGION"
  aws s3 cp dist/_astro "s3://$bucket/_astro" --recursive --cache-control 'public,max-age=31536000,immutable' --region "$SITE_REGION"
  aws cloudfront create-invalidation --distribution-id "$distribution" --paths '/*' --region "$SITE_REGION" >/dev/null
}

bootstrap_github() {
  [[ -n "$GITHUB_REPOSITORY" ]] || { echo "Use --github-repository owner/repository" >&2; exit 2; }
  local account provider_arn role_arn
  account=$(aws sts get-caller-identity --query Account --output text --region "$BACKEND_REGION")
  provider_arn="arn:aws:iam::${account}:oidc-provider/token.actions.githubusercontent.com"
  if aws cloudformation describe-stack-resource \
    --stack-name "${APP}-github-oidc" \
    --logical-resource-id GitHubOidcProvider \
    --region "$BACKEND_REGION" >/dev/null 2>&1; then
    provider_arn=""
  elif ! aws iam get-open-id-connect-provider --open-id-connect-provider-arn "$provider_arn" >/dev/null 2>&1; then
    provider_arn=""
  fi
  aws cloudformation deploy \
    --stack-name "${APP}-github-oidc" \
    --template-file infrastructure/github-oidc.yaml \
    --capabilities CAPABILITY_NAMED_IAM \
    --parameter-overrides \
      GitHubRepository="$GITHUB_REPOSITORY" \
      GitHubEnvironment=production \
      ExistingOidcProviderArn="$provider_arn" \
    --no-fail-on-empty-changeset \
    --region "$BACKEND_REGION"
  role_arn=$(stack_output "${APP}-github-oidc" "$BACKEND_REGION" DeployRoleArn)
  ssm_put outputs/github-deploy-role-arn "$role_arn"

  if command -v gh >/dev/null && gh auth status >/dev/null 2>&1; then
    gh api --method PUT "repos/$GITHUB_REPOSITORY/environments/production" >/dev/null
    gh variable set AWS_ROLE_FOR_GITHUB_DEPLOYMENTS --env production --repo "$GITHUB_REPOSITORY" --body "$role_arn"
    echo "GitHub Environment production configured."
  else
    echo "OIDC role created: $role_arn"
    echo "Install/authenticate gh to configure the GitHub Environment automatically."
  fi
}

case "$COMMAND" in
  configure)
    configure
    ;;
  infrastructure)
    [[ -n "$ALERT_EMAIL" ]] && configure
    require_configuration
    deploy_infrastructure
    ;;
  backend)
    [[ -n "$ALERT_EMAIL" ]] && configure
    require_configuration
    deploy_backend
    ;;
  backfill)
    require_configuration
    run_backfill
    ;;
  daily)
    require_configuration
    run_daily
    ;;
  site)
    require_configuration
    deploy_site
    ;;
  github-bootstrap)
    bootstrap_github
    ;;
  all)
    npm ci
    npm test
    npm run check
    configure
    [[ -n "$GITHUB_REPOSITORY" ]] && bootstrap_github
    deploy_infrastructure
    deploy_backend
    run_backfill
    run_daily
    deploy_site
    echo "Deployment complete at $(ssm_get outputs/site-url). Confirm each pending SNS subscription email."
    ;;
  *)
    usage
    exit 2
    ;;
esac
