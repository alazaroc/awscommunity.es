import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const deployScript = resolve(root, 'scripts/deploy.sh');
const adminScript = resolve(root, 'scripts/events-admin.mjs');

describe('operational scripts', () => {
  it('parses as Bash and supports a side-effect-free dry run', () => {
    execFileSync('bash', ['-n', deployScript]);
    const output = execFileSync('bash', [deployScript, 'all', '--dry-run'], { encoding: 'utf8' });
    expect(output).toContain('Dry run: command=all');
    expect(output).toContain('ssm-prefix=/community-spain/prod');
    expect(output).toContain('domain=stored');

    const withDomain = execFileSync('bash', [deployScript, 'configure', '--dry-run'], {
      encoding: 'utf8',
      env: { ...process.env, DOMAIN: 'example.com' },
    });
    expect(withDomain).toContain('domain=example.com');

    const forced = execFileSync(
      'bash',
      [deployScript, 'backfill', '--force', '--dry-run'],
      { encoding: 'utf8' },
    );
    expect(forced).toContain('Dry run: command=backfill');
  });

  it('parses the administrative CLI as JavaScript', () => {
    execFileSync(process.execPath, ['--check', adminScript]);
  });
});
