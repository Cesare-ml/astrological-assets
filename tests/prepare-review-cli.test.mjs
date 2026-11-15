import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('../scripts/prepare-review.mjs', import.meta.url));
const family = 'img/simboli-bianchi/segni/';

function withCatalog(runTest) {
  const dir = mkdtempSync(join(tmpdir(), 'astro-private-review-'));
  const catalogPath = join(dir, 'catalog.json');
  writeFileSync(catalogPath, JSON.stringify({
    schemaVersion: 1,
    files: [{ path: family + '01.png', bytes: 4, gitBlobSha: 'a'.repeat(40), legacy: false }],
  }));
  const run = output => spawnSync(process.execPath, [
    script, '--catalog', catalogPath, '--family', family, '--out', output,
  ], { encoding: 'utf8' });
  try { return runTest({ dir, run }); }
  finally { rmSync(dir, { recursive: true, force: true }); }
}

test('CLI generates a new ignored local worksheet with pending rights only', () => withCatalog(({ dir, run }) => {
  const output = join(dir, 'review.local.json');
  const result = run(output);
  assert.equal(result.status, 0, result.stderr);
  const review = JSON.parse(readFileSync(output, 'utf8'));
  assert.equal(review.assets.length, 1);
  assert.equal(review.assets[0].status, 'pending');
  assert.equal(review.assets[0].permissionBasis, '');
  assert.equal(review.assets[0].approvalEvidence, '');
}));

test('CLI does not overwrite completed local review work', () => withCatalog(({ dir, run }) => {
  const output = join(dir, 'review.local.json');
  const humanReview = '{"assets":[{"status":"approved","approvalEvidence":"human decision"}]}\n';
  writeFileSync(output, humanReview);
  const result = run(output);
  assert.notEqual(result.status, 0);
  assert.equal(readFileSync(output, 'utf8'), humanReview);
}));

test('CLI refuses an authoritative approvals JSON output', () => withCatalog(({ dir, run }) => {
  const output = join(dir, 'approvals.json');
  const result = run(output);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /must end with \.local\.json/);
  assert.equal(existsSync(output), false);
}));

test('CLI refuses to follow a worksheet symlink onto an approvals file', t => withCatalog(({ dir, run }) => {
  const approvals = join(dir, 'approvals.json');
  const output = join(dir, 'review.local.json');
  writeFileSync(approvals, 'owner-approved content\n');
  try { symlinkSync(approvals, output); }
  catch (error) {
    if (process.platform === 'win32' && ['EPERM', 'EACCES'].includes(error.code))
      return t.skip('Symlink unavailable');
    throw error;
  }
  const result = run(output);
  assert.notEqual(result.status, 0);
  assert.equal(readFileSync(approvals, 'utf8'), 'owner-approved content\n');
}));
