import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { analyzePrIntegration, comparePrSnapshots } from '../scripts/analyze-pr-integration.mjs';

const fixture = () => ({
  schemaVersion: 1,
  repositoryFullName: 'Cesare-ml/astrological-assets',
  defaultBranch: 'main', mainSha: 'a'.repeat(40),
  capturedDate: '2026-11-14', openPrCount: 2,
  prs: [
    {number: 1, base: 'main', head: 'feat/one', headSha: '1'.repeat(40), draft: false,
      files: ['README.md']},
    {number: 2, base: 'feat/one', head: 'feat/two', headSha: '2'.repeat(40), draft: true,
      files: ['package.json']},
  ],
});
const clone = data => structuredClone(data);

test('valid pinned snapshot exposes its repository and exact open PR count', () => {
  const report = analyzePrIntegration(fixture());
  assert.equal(report.repositoryFullName, 'Cesare-ml/astrological-assets');
  assert.equal(report.prCount, 2);
  assert.deepEqual(report.chains, [{pr: 2, requires: 1}]);
});

test('rejects unknown or omitted repository provenance', () => {
  for (const value of [undefined, '', 'someone-else/astrological-assets',
    'Cesare-ml/other-project', 'cesare-ml/astrological-assets']) {
    const input = fixture(); input.repositoryFullName = value;
    assert.throws(() => analyzePrIntegration(input), /Invalid integration snapshot header/);
  }
});

test('rejects truncated or falsified open-PR totals', () => {
  for (const count of [undefined, 0, 1, 3, 2.5, '2', -1]) {
    const input = fixture(); input.openPrCount = count;
    assert.throws(() => analyzePrIntegration(input), /Invalid integration snapshot header/);
  }
  const truncated = fixture(); truncated.prs.pop();
  assert.throws(() => analyzePrIntegration(truncated), /Invalid integration snapshot header/);
});

test('requires a real Gregorian capture date rather than only regex shape', () => {
  for (const date of ['2026-02-30', '2026-13-01', '2026-00-12', '2026-11-31',
    '2025-02-29', '2026-2-4', 'not-a-date']) {
    const input = fixture(); input.capturedDate = date;
    assert.throws(() => analyzePrIntegration(input), /Invalid integration snapshot header/);
  }
  const leap = fixture(); leap.capturedDate = '2028-02-29';
  assert.equal(analyzePrIntegration(leap).prCount, 2);
});

test('rejects a different repository even when other PR identifiers match', () => {
  const current = clone(fixture());
  current.repositoryFullName = 'unknown/another-repo';
  assert.throws(() => comparePrSnapshots(fixture(), current),
    /Invalid integration snapshot header/);
});

test('rejects a current snapshot missing one PR even if the recorded count stays 2', () => {
  const current = clone(fixture());
  current.prs.pop();
  assert.throws(() => comparePrSnapshots(fixture(), current),
    /Invalid integration snapshot header/);
});

test('detects a real added PR when the current total is updated consistently', () => {
  const current = clone(fixture());
  current.prs.push({number: 3, base: 'main', head: 'feat/three',
    headSha: '3'.repeat(40), draft: true, files: ['docs/new.md']});
  current.openPrCount = 3;
  assert.deepEqual(comparePrSnapshots(fixture(), current).changes, [
    {kind: 'pr-added', pr: 3},
  ]);
});

test('CLI fails closed for wrong repository, not just unit-test API', () => {
  const dir = mkdtempSync(join(tmpdir(), 'astro-snapshot-identity-'));
  try {
    const path = join(dir, 'snapshot.json');
    const before = fixture(); before.repositoryFullName = 'other/project';
    const raw = JSON.stringify(before, null, 2) + '\n';
    writeFileSync(path, raw);
    const cli = fileURLToPath(new URL('../scripts/analyze-pr-integration.mjs', import.meta.url));
    const run = spawnSync(process.execPath, [cli, path], {cwd: dir, encoding: 'utf8'});
    assert.equal(run.status, 1);
    assert.match(run.stderr, /PR INTEGRATION PLAN BLOCKED/);
    assert.equal(readFileSync(path, 'utf8'), raw);
  } finally {rmSync(dir, {recursive: true, force: true});}
});
