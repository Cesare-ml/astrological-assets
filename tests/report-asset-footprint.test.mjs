import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { reportAssetFootprint } from '../scripts/report-asset-footprint.mjs';

const HASH_A = 'a'.repeat(64), HASH_B = 'b'.repeat(64), HASH_C = 'c'.repeat(64);
const asset = (path, sha256, bytes) => ({
  path, sha256, bytes,
  rightsHolder: 'Owner', permissionBasis: 'private sharing only', approvalEvidence: 'test fixture'
});
const fixture = () => ({
  schemaVersion: 1,
  source: { repository: 'example/private-source', commit: 'd'.repeat(40), assetRoot: 'public/assets' },
  assets: [
    asset('img/grafici/light/chart.png', HASH_A, 10),
    asset('img/grafici/dark/chart.png', HASH_A, 10),
    asset('img/simboli/segni/01.png', HASH_B, 25),
    asset('img/simboli/segni/02.png', HASH_C, 5)
  ]
});

test('reports logical bytes and potential dedup only for matching hash bytes', () => {
  const report = reportAssetFootprint(fixture());
  assert.deepEqual(report.totals, { assetCount: 4, logicalBytes: 50, uniqueBlobCount: 3,
    uniqueBytes: 40, potentialDedupBytes: 10 });
  assert.deepEqual(report.families.map(v => v.family), [
    'img/grafici/dark', 'img/grafici/light', 'img/simboli'
  ]);
  assert.equal(report.families[0].uniqueBytes, 10);
  assert.equal(report.families[1].uniqueBytes, 10);
});

test('path prefix is a directory boundary and trailing slash is normalized', () => {
  const report = reportAssetFootprint(fixture(), { prefix: 'img/grafici/' });
  assert.equal(report.selection.prefix, 'img/grafici');
  assert.equal(report.totals.assetCount, 2);
  assert.equal(report.totals.uniqueBytes, 10);
  assert.throws(() => reportAssetFootprint(fixture(), { prefix: 'img/missing' }), /No assets match/);
  assert.throws(() => reportAssetFootprint(fixture(), { prefix: 'img/graf' }), /No assets match/);
});

test('blocks unsafe prefixes, traversal, missing manifests, and duplicate paths', () => {
  for (const prefix of ['../img', '/img', 'img/../private', 'img\\bad', 'img//family'])
    assert.throws(() => reportAssetFootprint(fixture(), { prefix }), /Unsafe|Unsupported/);
  assert.throws(() => reportAssetFootprint({ assets: [] }), /Invalid or empty/);
  const m = fixture(); m.assets.push(asset('img/simboli/segni/01.PNG', HASH_C, 5));
  assert.throws(() => reportAssetFootprint(m), /colliding/);
});

test('checks all entries, even outside the selected prefix', () => {
  const m = fixture(); m.assets[3].bytes = -1;
  assert.throws(() => reportAssetFootprint(m, { prefix: 'img/grafici' }), /Invalid hash or size/);
});

test('blocks altered hashes, private approval status, and incomplete provenance', () => {
  const m = fixture(); m.assets[0].sha256 = 'not-a-hash';
  assert.throws(() => reportAssetFootprint(m), /Invalid hash or size/);
  m.assets[0].sha256 = HASH_A; m.assets[0].status = 'pending';
  assert.throws(() => reportAssetFootprint(m), /not private-approved/);
  m.assets[0].status = 'approved'; delete m.assets[0].approvalEvidence;
  assert.throws(() => reportAssetFootprint(m), /Missing private approval metadata/);
});

test('rejects impossible metadata where the same digest has different byte sizes', () => {
  const m = fixture(); m.assets[1].bytes = 11;
  assert.throws(() => reportAssetFootprint(m), /Conflicting byte sizes/);
});

test('rejects integer totals beyond safe precision', () => {
  const m = fixture(); m.assets[0].bytes = Number.MAX_SAFE_INTEGER;
  m.assets[1].sha256 = HASH_B; m.assets[1].bytes = 10;
  m.assets[2].sha256 = HASH_C; m.assets[2].bytes = 25;
  m.assets[3].sha256 = 'd'.repeat(64);
  assert.throws(() => reportAssetFootprint(m), /safe integer/);
});

test('CLI reads JSON but never writes assets or output files', () => {
  const dir = mkdtempSync(join(tmpdir(), 'footprint-'));
  try {
    const input = join(dir, 'manifest.json');
    writeFileSync(input, JSON.stringify(fixture()));
    const script = fileURLToPath(new URL('../scripts/report-asset-footprint.mjs', import.meta.url));
    const ok = spawnSync(process.execPath, [script, '--manifest', input, '--prefix', 'img/simboli/'], { encoding: 'utf8' });
    assert.equal(ok.status, 0, ok.stderr);
    const parsed = JSON.parse(ok.stdout);
    assert.equal(parsed.totals.logicalBytes, 30);
    assert.equal(parsed.totals.assetCount, 2);
    const error = spawnSync(process.execPath, [script, '--manifest', input, '--manifest', input], { encoding: 'utf8' });
    assert.equal(error.status, 1);
    assert.match(error.stderr, /Usage:/);
    assert.equal(readFileSync(input, 'utf8'), JSON.stringify(fixture()));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
