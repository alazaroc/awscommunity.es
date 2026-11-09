#!/usr/bin/env node
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const region = process.env.AWS_REGION ?? 'eu-west-1';
const prefix = process.env.COMMUNITY_SSM_PREFIX ?? '/community-spain/prod';

function aws(parameters, options = {}) {
  const result = spawnSync('aws', [...parameters, '--region', region], {
    encoding: 'utf8',
    stdio: options.stdio ?? ['ignore', 'pipe', 'pipe'],
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr.trim() || `aws exited with ${result.status}`);
  return result.stdout.trim();
}

function parameter(name) {
  return aws([
    'ssm', 'get-parameter',
    '--name', `${prefix}/outputs/${name}`,
    '--query', 'Parameter.Value',
    '--output', 'text',
  ]);
}

function requestFromArguments() {
  const [resource, action, ...rest] = args;
  if (resource === 'reviews' && action === 'list') return { action: 'reviews.list' };
  if (resource === 'reviews' && action === 'approve') return { action: 'reviews.approve', id: rest[0] };
  if (resource === 'reviews' && action === 'dismiss') return { action: 'reviews.dismiss', id: rest[0] };
  if (resource === 'events' && action === 'import-url') {
    return { action: 'events.import-url', groupId: rest[0], url: rest[1] };
  }
  if (resource === 'events' && action === 'upsert' && rest[0] === '--stdin') {
    const input = readFileSync(0, 'utf8');
    return { action: 'events.upsert', event: JSON.parse(input) };
  }
  if (resource === 'overrides' && action === 'clear') return { action: 'overrides.clear', eventId: rest[0] };
  throw new Error(`Usage:
  events-admin reviews list
  events-admin reviews approve <review-id>
  events-admin reviews dismiss <review-id>
  events-admin events import-url <group-id> <public-meetup-url>
  events-admin events upsert --stdin
  events-admin overrides clear <event-id>`);
}

const directory = mkdtempSync(join(tmpdir(), 'awscommunity-admin-'));
try {
  const output = join(directory, 'response.json');
  const payload = JSON.stringify(requestFromArguments());
  const functionName = parameter('admin-function');
  const metadata = JSON.parse(aws([
    'lambda', 'invoke',
    '--function-name', functionName,
    '--cli-binary-format', 'raw-in-base64-out',
    '--payload', payload,
    output,
  ]));
  const response = JSON.parse(readFileSync(output, 'utf8'));
  if (metadata.FunctionError) throw new Error(response.errorMessage ?? JSON.stringify(response));
  process.stdout.write(`${JSON.stringify(response, null, 2)}\n`);
} finally {
  rmSync(directory, { recursive: true, force: true });
}
