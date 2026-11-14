import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { planReviewShards } from '../scripts/plan-review-shards.mjs';
import { classifyReviewAsset, summarizeAssetReviewProgress } from '../scripts/review-progress-census.mjs';

const source = { repository: 'example/private', commit: 'a'.repeat(40), assetRoot: 'public/assets' };
const familyPaths = [
  'img/grafici/light/ring.png',
  'img/simboli/sign/aries.png',
  'img/simboli-bianchi/sign/aries.png',
  'img/symbols/planets/light/sun.png',
  'img/textures/paper.png',
  'img/risuonatore-solare.png',
  'img/risuonatore-solare-bianco.png',
  'fonts/astro.ttf',
  'img/misc/other.png',
  'img/grafici/dark/ring.png',
];
const paths = [...familyPaths, ...Array.from({ length: 1003 }, (_, i) => 'img/simboli/fixture/' + String(i).padStart(4, '0') + '.png')];
const assets = paths.map((path, i) => ({
  path, bytes: i + 10, sha256: createHash('sha256').update(path).digest('hex'),
  rightsHolder: 'synthetic owner', permissionBasis: 'private only',
  approvalEvidence: 'secret synthetic evidence',
}));
const manifest = { schemaVersion: 1, source, assets };
const fingerprint = createHash('sha256').update(JSON.stringify(manifest)).digest('hex');
const ledgerPin = 'b'.repeat(40);
const fixture = (shardCount, selected = Array.from({ length: shardCount }, (_, i) => i + 1)) => {
  const submissions = selected.map(index => ({
    shardIndex: index, agentId: 'agent-' + index, assignmentId: 'task-' + index,
    results: planReviewShards(manifest, { shardCount, shardIndex: index }).assets
      .map(a => ({ path: a.path, sha256: a.sha256, finding: 'inspected' })),
  }));
  const batch = {
    schemaVersion: 1, purpose: 'asset-agent-review-results',
    source, manifestSha256: fingerprint, shardCount, submissions,
  };
  const snapshot = {
    schemaVersion: 1, purpose: 'asset-review-assignment-snapshot',
    source, manifestSha256: fingerprint, shardCount, ledgerCommitSha: ledgerPin,
    assignments: selected.map(index => ({
      shardIndex: index, agentId: 'agent-' + index, assignmentId: 'task-' + index,
      state: 'submitted',
    })),
  };
  return { batch, snapshot };
};
const report = (count, selected) => {
  const { batch, snapshot } = fixture(count, selected);
  return summarizeAssetReviewProgress(manifest, fingerprint, batch, snapshot, ledgerPin);
};

test('asset family classification handles exact approved categories and safe fallback', () => {
  const expected = [
    'chart-graphics', 'zodiac-and-symbols', 'white-symbols', 'planet-icons',
    'textures', 'solar-resonator', 'solar-resonator', 'fonts', 'other', 'chart-graphics',
  ];
  assert.deepEqual(familyPaths.map(classifyReviewAsset), expected);
});

test('full 2/20/40/100 agent reviews sum to 1013 with no pending entries', () => {
  for (const count of [2, 20, 40, 100]) {
    const r = report(count);
    assert.equal(r.requiresFollowUp, false);
    assert.equal(r.totalAssets, 1013);
    assert.equal(r.reviewedAssertions, 1013);
    assert.equal(r.inspectedAssertions, 1013);
    assert.equal(r.needingFollowUp, 0);
    assert.equal(r.missingShardCount, 0);
    assert.equal(r.families.reduce((acc, f) => acc + f.total, 0), 1013);
    assert.equal(r.totals.pending, 0);
  }
});

test('partial shard reports are safe and keep all unreviewed assets pending', () => {
  const r = report(20, [1]);
  assert.equal(r.requiresFollowUp, true);
  assert.equal(r.reviewedAssertions, 51);
  assert.equal(r.totals.pending, 962);
  assert.equal(r.missingShardCount, 19);
  assert.equal(r.needingFollowUp, 962);
  assert.equal(r.families.reduce((a, x) => a + x.pending, 0), 962);
});

test('flagged and not-checked findings are never marked as inspected', () => {
  const { batch, snapshot } = fixture(2);
  batch.submissions[0].results[0].finding = 'flagged';
  batch.submissions[1].results[0].finding = 'not-checked';
  const r = summarizeAssetReviewProgress(manifest, fingerprint, batch, snapshot, ledgerPin);
  assert.equal(r.totals.inspected, 1011);
  assert.equal(r.totals.flagged, 1);
  assert.equal(r.totals.notChecked, 1);
  assert.equal(r.needingFollowUp, 2);
  assert.equal(r.requiresFollowUp, true);
});

test('all family groups have stable, fixed semantic labels', () => {
  const r = report(2);
  const counts = Object.fromEntries(r.families.map(x => [x.family, x.total]));
  assert.deepEqual(counts, {
    'chart-graphics': 2,
    'zodiac-and-symbols': 1004,
    'white-symbols': 1,
    'planet-icons': 1,
    textures: 1,
    'solar-resonator': 2,
    fonts: 1,
    other: 1,
  });
});

test('output excludes individual paths, SHA pin and private agent/rights metadata', () => {
  const output = JSON.stringify(report(20, [1]));
  assert.doesNotMatch(output, /img\/|fonts\/|task-1|agent-1|synthetic owner|secret synthetic evidence/);
  assert.doesNotMatch(output, new RegExp(ledgerPin));
  assert.match(output, /Self-reported progress only/);
});

test('invalid private-ledger pin is rejected before any progress is produced', () => {
  const { batch, snapshot } = fixture(2);
  assert.throws(() => summarizeAssetReviewProgress(manifest, fingerprint, batch, snapshot), /independently verified/);
  assert.throws(() => summarizeAssetReviewProgress(manifest, fingerprint, batch, snapshot, 'c'.repeat(40)), /independently pinned/);
});

test('duplicated assignment and out-of-shard result are rejected by delegated gates', () => {
  const { batch, snapshot } = fixture(20, [1, 2]);
  snapshot.assignments[1].assignmentId = snapshot.assignments[0].assignmentId;
  assert.throws(() => summarizeAssetReviewProgress(manifest, fingerprint, batch, snapshot, ledgerPin));
  const fresh = fixture(20, [1]);
  fresh.batch.submissions[0].results[0].sha256 = 'f'.repeat(64);
  assert.throws(() => summarizeAssetReviewProgress(manifest, fingerprint, fresh.batch, fresh.snapshot, ledgerPin), /Stale asset digest/);
});

function cli(input, extra = []) {
  const dir = mkdtempSync(join(tmpdir(), 'astro-review-census-'));
  try {
    const f = {};
    for (const [name, value] of [['manifest', manifest], ['results', input.batch], ['assignments', input.snapshot]]) {
      f[name] = join(dir, name + '.json');
      writeFileSync(f[name], JSON.stringify(value));
    }
    const script = resolve(fileURLToPath(new URL('../scripts/review-progress-census.mjs', import.meta.url)));
    const args = [
      '--manifest', f.manifest, '--results', f.results,
      '--assignments', f.assignments, '--expected-ledger-commit', ledgerPin,
      ...extra,
    ];
    return spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' });
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

test('CLI returns exit 0 complete, 2 incomplete, 1 invalid without writing reports', () => {
  const complete = cli(fixture(2));
  assert.equal(complete.status, 0, complete.stderr);
  assert.equal(JSON.parse(complete.stdout).totalAssets, 1013);
  const partial = cli(fixture(20, [1]));
  assert.equal(partial.status, 2, partial.stderr);
  const invalid = cli(fixture(2), ['--results', 'duplicate.json']);
  assert.equal(invalid.status, 1);
  assert.match(invalid.stderr, /REVIEW PROGRESS CENSUS ERROR/);
});
