import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { planReviewShards } from '../scripts/plan-review-shards.mjs';

const assets = Array.from({ length: 1013 }, (_, i) => ({
  path: 'img/simboli/segni/' + String(i).padStart(4, '0') + '.png',
  bytes: i + 1,
  sha256: createHash('sha256').update(String(i)).digest('hex'),
  rightsHolder: 'synthetic fixture rights holder',
  permissionBasis: 'synthetic private-use test permission',
  approvalEvidence: 'sensitive synthetic evidence',
}));
const source = { repository: 'Example/private-source', commit: 'a'.repeat(40), assetRoot: 'public/assets' };
const fixture = (items = assets) => ({ schemaVersion: 1, source, assets: items });

function runCLI(manifest, args) {
  const dir = mkdtempSync(join(tmpdir(), 'astro-asset-shards-'));
  try {
    const file = join(dir, 'manifest.json');
    const raw = JSON.stringify(manifest);
    writeFileSync(file, raw);
    const script = resolve(fileURLToPath(new URL('../scripts/plan-review-shards.mjs', import.meta.url)));
    const res = spawnSync(process.execPath, [script, ...args.map(x => x === '@FILE@' ? file : x)], { encoding: 'utf8' });
    return { ...res, files: readdirSync(dir), raw };
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

test('2, 20, 40 and 100 agents receive balanced, complete, disjoint paths', () => {
  for (const count of [2, 20, 40, 100]) {
    const summary = planReviewShards(fixture(), { shardCount: count });
    assert.equal(summary.totalAssets, 1013);
    assert.equal(summary.shards.length, count);
    assert.ok(Math.max(...summary.shards.map(s => s.count)) - Math.min(...summary.shards.map(s => s.count)) <= 1);
    const all = summary.shards.flatMap(s => {
      const result = planReviewShards(fixture(), { shardCount: count, shardIndex: s.index });
      assert.equal(result.assets.length, s.count);
      assert.equal(result.assets.reduce((sum, x) => sum + x.bytes, 0), s.bytes);
      return result.assets.map(a => a.path);
    });
    assert.equal(new Set(all).size, 1013);
    assert.deepEqual(new Set(all), new Set(assets.map(a => a.path)));
  }
});

test('manifest input order does not affect assignment', () => {
  const a = planReviewShards(fixture(), { shardCount: 40, shardIndex: 17 });
  const b = planReviewShards(fixture([...assets].reverse()), { shardCount: 40, shardIndex: 17 });
  assert.deepEqual(a, b);
});

test('worklist never exposes private approval evidence or owner names', () => {
  const output = JSON.stringify(planReviewShards(fixture(), { shardCount: 100, shardIndex: 1 }));
  assert.doesNotMatch(output, /sensitive synthetic evidence|synthetic fixture rights holder|synthetic private-use test permission/);
  assert.match(output, /metadata-only/i);
  const injected = { ...fixture(), source: { ...source, secretEvidence: 'unpublished-evidence' } };
  assert.doesNotMatch(JSON.stringify(planReviewShards(injected, { shardCount: 2 })), /unpublished-evidence/);
});

test('reject invalid count, excessive agents, shard selection and fingerprint', () => {
  for (const count of [-1, 0, 1.3, NaN, 1014, 9007199254740991])
    assert.throws(() => planReviewShards(fixture(), { shardCount: count }));
  for (const selected of [-1, 0, 101, 1.25])
    assert.throws(() => planReviewShards(fixture(), { shardCount: 100, shardIndex: selected }));
  assert.throws(() => planReviewShards(fixture(), { shardCount: 2, manifestSha256: 'wrong' }));
});

test('manifest parser rejects unsafe path, case collision, invalid hashes and missing private-use metadata', () => {
  const first = assets[0];
  const broken = [
    [],
    [{ ...first, path: 'img/../secret.png' }],
    [first, { ...first, path: first.path.toUpperCase().replace('IMG/', 'img/') }],
    [{ ...first, bytes: -1 }],
    [{ ...first, sha256: '123' }],
    [{ ...first, gitBlobSha: 'broken' }],
    [{ ...first, status: 'pending' }],
    [{ ...first, approvalEvidence: '' }],
  ];
  for (const list of broken) assert.throws(() => planReviewShards(fixture(list), { shardCount: 1 }));
  assert.throws(() => planReviewShards({ ...fixture([first]), source: { ...source, assetRoot: 'wrong' } }, { shardCount: 1 }));
});

test('CLI produces pinned, deterministic summary and selected agent shard', () => {
  const selection = fixture(assets.slice(0, 23));
  const argv = ['--manifest', '@FILE@', '--shards', '7'];
  const summary = runCLI(selection, argv);
  assert.equal(summary.status, 0, summary.stderr);
  assert.deepEqual(summary.files, ['manifest.json']);
  const parsed = JSON.parse(summary.stdout);
  assert.equal(parsed.shards.length, 7);
  assert.equal(parsed.totalAssets, 23);
  assert.equal(parsed.manifestSha256, createHash('sha256').update(summary.raw).digest('hex'));
  const chosen = runCLI(selection, [...argv, '--shard', '4']);
  assert.equal(chosen.status, 0, chosen.stderr);
  const report = JSON.parse(chosen.stdout);
  assert.equal(report.shardIndex, 4);
  assert.equal(report.assets.length, parsed.shards[3].count);
  assert.equal(report.manifestSha256, parsed.manifestSha256);
});

test('CLI fails closed on invalid and duplicated argument flags', () => {
  const f = fixture(assets.slice(0, 3));
  for (const flags of [
    ['--manifest', '@FILE@', '--shards', '0'],
    ['--manifest', '@FILE@', '--shards', '2', '--shard', '3'],
    ['--manifest', '@FILE@', '--shards', '1', '--shards', '1'],
    ['--manifest', '@FILE@', '--unknown', '2'],
    ['--manifest', '@FILE@'],
    ['--manifest', '@FILE@', '--shards', '1.2'],
  ]) {
    const result = runCLI(f, flags);
    assert.equal(result.status, 1, JSON.stringify(flags));
    assert.match(result.stderr, /FAILED:/);
    assert.equal(result.stdout, '');
  }
});

test('a valid source change does not affect order but changes fingerprint', () => {
  const first = fixture(assets.slice(0, 12));
  const second = { ...first, source: { ...source, commit: 'b'.repeat(40) } };
  const a = runCLI(first, ['--manifest', '@FILE@', '--shards', '3', '--shard', '2']);
  const b = runCLI(second, ['--manifest', '@FILE@', '--shards', '3', '--shard', '2']);
  assert.deepEqual(JSON.parse(a.stdout).assets, JSON.parse(b.stdout).assets);
  assert.notEqual(JSON.parse(a.stdout).manifestSha256, JSON.parse(b.stdout).manifestSha256);
});
