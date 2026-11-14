import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compareReviewProgress } from '../scripts/compare-review-progress.mjs';

const manifestSha256 = 'a'.repeat(64);
const counts = (inspected, flagged, notChecked, pending) => ({
  total: inspected + flagged + notChecked + pending,
  inspected, flagged, notChecked, pending,
});
function census(families) {
  const totals = counts(0, 0, 0, 0);
  for (const family of families) for (const key of Object.keys(totals)) totals[key] += family[key];
  return {
    schemaVersion: 1, purpose: 'asset-review-progress-census', manifestSha256,
    totalAssets: totals.total,
    reviewedAssertions: totals.inspected + totals.flagged + totals.notChecked,
    inspectedAssertions: totals.inspected,
    needingFollowUp: totals.flagged + totals.notChecked + totals.pending,
    totals, families, missingShardCount: totals.pending > 0 ? 1 : 0,
    requiresFollowUp: totals.flagged + totals.notChecked + totals.pending > 0,
    note: 'Private agent source: DO-NOT-ECHO',
  };
}
const family = (name, inspected, flagged, notChecked, pending) => ({
  family: name, ...counts(inspected, flagged, notChecked, pending),
});
const before = () => census([
  family('chart-graphics', 3, 0, 0, 2),
  family('zodiac-and-symbols', 1, 1, 0, 3),
  family('solar-resonator', 0, 0, 1, 0),
]);
const after = () => census([
  family('chart-graphics', 5, 0, 0, 0),
  family('zodiac-and-symbols', 3, 0, 1, 1),
  family('solar-resonator', 1, 0, 0, 0),
]);

test('accepts improving counts and reports exact deltas without asset paths', () => {
  const comparison = compareReviewProgress(before(), after());
  assert.equal(comparison.totalAssets, 11);
  assert.equal(comparison.changed, true);
  assert.equal(comparison.regressed, false);
  assert.deepEqual(comparison.delta, { inspected: 5, flagged: -1, notChecked: 0, pending: -4 });
  assert.deepEqual(comparison.families.map(x => x.family),
    ['chart-graphics', 'zodiac-and-symbols', 'solar-resonator']);
  assert.doesNotMatch(JSON.stringify(comparison), /DO-NOT-ECHO|agentId|assignmentId|ledgerCommit/);
});

test('identical reports are unchanged, independently of family order', () => {
  const original = before();
  const reversed = { ...original, families: [...original.families].reverse() };
  const comparison = compareReviewProgress(original, reversed);
  assert.equal(comparison.changed, false);
  assert.equal(comparison.regressed, false);
  assert.deepEqual(comparison.families, []);
});

test('regression is detected when inspected falls or pending rises', () => {
  const comparison = compareReviewProgress(after(), before());
  assert.equal(comparison.changed, true);
  assert.equal(comparison.regressed, true);
  assert.equal(comparison.delta.inspected, -5);
  assert.equal(comparison.delta.pending, 4);
  assert.ok(comparison.families.every(x => x.regressed));
});

test('a flagged-to-inspected transition is counted without falsely approving publication', () => {
  const output = compareReviewProgress(before(), after());
  assert.equal(output.delta.flagged, -1);
  assert.match(output.note, /no approval/);
  assert.equal(Object.hasOwn(output, 'approved'), false);
});

test('rejects a different manifest fingerprint or total', () => {
  assert.throws(() => compareReviewProgress(before(), { ...after(), manifestSha256: 'b'.repeat(64) }), /different manifest/);
  const changedTotal = after();
  changedTotal.families[0].total++;
  assert.throws(() => compareReviewProgress(before(), changedTotal));
});

test('rejects changed family roster, even when global total matches', () => {
  const changed = after();
  changed.families = changed.families.map(x => x.family === 'solar-resonator'
    ? { ...x, family: 'textures' } : x);
  assert.throws(() => compareReviewProgress(before(), changed), /families changed/);
});

test('rejects unknown/duplicate family and private unexpected fields', () => {
  const unknown = before();
  unknown.families[0].family = 'private-agent-name';
  assert.throws(() => compareReviewProgress(unknown, after()), /Unknown or duplicate family/);
  const duplicate = before();
  duplicate.families[1].family = 'chart-graphics';
  assert.throws(() => compareReviewProgress(duplicate, after()));
  assert.throws(() => compareReviewProgress({ ...before(), secretSession: 'sensitive' }, after()), /Invalid fields/);
  assert.throws(() => compareReviewProgress(before(), { ...after(), families: [{ ...after().families[0], credentials: 'redacted' }, ...after().families.slice(1)] }), /Invalid fields/);
});

test('rejects invalid, inconsistent and unsafe-integer counters', () => {
  for (const input of [
    { ...before(), totalAssets: -1 },
    { ...before(), inspectedAssertions: 200 },
    { ...before(), missingShardCount: 999 },
    { ...before(), requiresFollowUp: false },
    { ...before(), totals: { ...before().totals, pending: Number.MAX_SAFE_INTEGER } },
    { ...before(), totals: { ...before().totals, pending: NaN } },
  ]) assert.throws(() => compareReviewProgress(input, after()));
});

function cli(old, next, extra = []) {
  const dir = mkdtempSync(join(tmpdir(), 'astro-census-delta-'));
  try {
    const oldFile = join(dir, 'old.json'), newFile = join(dir, 'new.json');
    writeFileSync(oldFile, JSON.stringify(old));
    writeFileSync(newFile, JSON.stringify(next));
    return spawnSync(process.execPath, [new URL('../scripts/compare-review-progress.mjs', import.meta.url).pathname,
      '--before', oldFile, '--after', newFile, ...extra], { encoding: 'utf8' });
  } finally { rmSync(dir, { force: true, recursive: true }); }
}

test('native CLI exits 0 for improving, 2 for regression, 1 for invalid files/options', () => {
  const improved = cli(before(), after());
  assert.equal(improved.status, 0, improved.stderr);
  assert.equal(JSON.parse(improved.stdout).regressed, false);
  const reversed = cli(after(), before());
  assert.equal(reversed.status, 2, reversed.stderr);
  assert.equal(JSON.parse(reversed.stdout).regressed, true);
  const malformed = cli(before(), { ...after(), manifestSha256: 'bad' });
  assert.equal(malformed.status, 1);
  assert.match(malformed.stderr, /REVIEW PROGRESS COMPARISON ERROR/);
  const duplicate = cli(before(), after(), ['--before', 'other.json']);
  assert.equal(duplicate.status, 1);
});
