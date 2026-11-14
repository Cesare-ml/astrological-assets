import assert from 'node:assert/strict';
import { test } from 'node:test';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const script = fileURLToPath(new URL('../scripts/prepare-publication-review.mjs', import.meta.url));
const run = output => spawnSync(process.execPath, [script, '--out', output], {
  cwd: repoRoot, encoding: 'utf8',
});

test('public review CLI writes only pending records and never overwrites', () => {
  const dir = mkdtempSync(join(tmpdir(), 'astro-public-worksheet-cli-'));
  try {
    const output = join(dir, 'pending.local.json');
    const first = run(output);
    assert.equal(first.status, 0, first.stderr);
    const worksheet = JSON.parse(readFileSync(output, 'utf8'));
    assert.ok(worksheet.assets.length > 0);
    assert.ok(worksheet.assets.every(record =>
      record.status === 'pending' && record.permissionScope === 'not-yet-granted'));
    const second = run(output);
    assert.equal(second.status, 1);
    assert.match(second.stderr, /EEXIST/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('public review CLI never writes within the authoritative catalog', () => {
  const output = join(repoRoot, 'catalog', 'never-write-rights-gate-test.local.json');
  assert.equal(existsSync(output), false);
  const attempt = run(output);
  assert.equal(attempt.status, 1);
  assert.match(attempt.stderr, /forbidden/);
  assert.equal(existsSync(output), false);
});
