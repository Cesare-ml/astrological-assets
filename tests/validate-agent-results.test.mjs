import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateAgentResults } from '../scripts/validate-agent-results.mjs';

const source = { repository: 'owner/private', commit: 'e'.repeat(40), assetRoot: 'public/assets' };
const assets = Array.from({ length: 1013 }, (_, i) => ({
  path: 'img/grafici/light/' + String(i).padStart(4, '0') + '.png',
  bytes: i + 10,
  sha256: createHash('sha256').update('asset:' + i).digest('hex'),
  rightsHolder: 'private-owner', approvalEvidence: 'sensitive-evidence', permissionBasis: 'private-only',
}));
const manifest = { schemaVersion: 1, source, assets };
const fingerprint = createHash('sha256').update(JSON.stringify(manifest)).digest('hex');
const canonical = [...assets].sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
function submission(shardCount, shardIndex, finding = 'inspected') {
  return {
    shardIndex, agentId: 'agent-' + shardIndex, assignmentId: 'task-' + shardIndex,
    results: canonical.filter((_, i) => i % shardCount === shardIndex - 1)
      .map(a => ({ path: a.path, sha256: a.sha256, finding })),
  };
}
const batch = (shardCount, submissions) => ({
  schemaVersion: 1, purpose: 'asset-agent-review-results', source,
  manifestSha256: fingerprint, shardCount, submissions,
});

test('2, 20, 40 and 100 complete shards produce exact, distinct coverage', () => {
  for (const count of [2, 20, 40, 100]) {
    const reports = Array.from({ length: count }, (_, i) => submission(count, i + 1));
    const result = validateAgentResults(manifest, fingerprint, batch(count, reports));
    assert.equal(result.requiresFollowUp, false);
    assert.equal(result.submittedShards, count);
    assert.deepEqual(result.missingShards, []);
    assert.deepEqual(result.findings, { inspected: 1013, flagged: 0, notChecked: 0 });
  }
});
test('partial submissions are valid but never reported complete', () => {
  const result = validateAgentResults(manifest, fingerprint, batch(20, [submission(20, 2)]));
  assert.equal(result.requiresFollowUp, true);
  assert.equal(result.missingShards.length, 19);
  assert.equal(result.findings.inspected, 51);
});
test('flagged and not-checked statuses always require follow-up', () => {
  const reports = [submission(2, 1, 'flagged'), submission(2, 2, 'not-checked')];
  const result = validateAgentResults(manifest, fingerprint, batch(2, reports));
  assert.equal(result.requiresFollowUp, true);
  assert.equal(result.findings.flagged, 507);
  assert.equal(result.findings.notChecked, 506);
});
test('rejects duplicate shard even when different agents claim it', () => {
  const reports = [submission(20, 1), { ...submission(20, 1), agentId: 'another-agent', assignmentId: 'other-task' }];
  assert.throws(() => validateAgentResults(manifest, fingerprint, batch(20, reports)), /duplicate/);
});
test('rejects repeated assignment IDs across different shards', () => {
  const reports = [submission(20, 1), { ...submission(20, 2), assignmentId: 'task-1' }];
  assert.throws(() => validateAgentResults(manifest, fingerprint, batch(20, reports)), /Repeated assignment/);
});
test('rejects out-of-shard path and mismatched asset SHA', () => {
  const out = submission(20, 1);
  out.results[0] = { ...out.results[0], path: submission(20, 2).results[0].path };
  assert.throws(() => validateAgentResults(manifest, fingerprint, batch(20, [out])), /outside/);
  const stale = submission(20, 1);
  stale.results[0] = { ...stale.results[0], sha256: 'f'.repeat(64) };
  assert.throws(() => validateAgentResults(manifest, fingerprint, batch(20, [stale])), /Stale/);
});
test('rejects incomplete, duplicated or extraneous findings for a shard', () => {
  const missing = submission(20, 1); missing.results.pop();
  assert.throws(() => validateAgentResults(manifest, fingerprint, batch(20, [missing])), /Incomplete/);
  const duplicate = submission(20, 1); duplicate.results[1] = { ...duplicate.results[0] };
  assert.throws(() => validateAgentResults(manifest, fingerprint, batch(20, [duplicate])), /Duplicate asset/);
  const leak = submission(20, 1); leak.results[0].secretEvidence = 'private';
  assert.throws(() => validateAgentResults(manifest, fingerprint, batch(20, [leak])), /Invalid fields/);
});
test('rejects stale manifest fingerprint, source commit and schema', () => {
  assert.throws(() => validateAgentResults(manifest, 'a'.repeat(64), batch(2, [])), /stale/i);
  assert.throws(() => validateAgentResults(manifest, fingerprint, { ...batch(2, []), source: { ...source, commit: '0'.repeat(40) } }), /provenance/);
  assert.throws(() => validateAgentResults(manifest, fingerprint, { ...batch(2, []), schemaVersion: 2 }), /schema/);
  assert.throws(() => validateAgentResults(manifest, fingerprint, { ...batch(2, []), extraKey: 42 }), /Invalid fields/);
});
test('rejects malformed identities, status values and duplicate structure', () => {
  const invalid = submission(20, 1); invalid.agentId = 'agent with spaces';
  assert.throws(() => validateAgentResults(manifest, fingerprint, batch(20, [invalid])), /opaque/);
  const numeric = submission(20, 1); numeric.agentId = 123;
  assert.throws(() => validateAgentResults(manifest, fingerprint, batch(20, [numeric])), /opaque/);
  const invalidFinding = submission(20, 1); invalidFinding.results[0].finding = 'publicly-approved';
  assert.throws(() => validateAgentResults(manifest, fingerprint, batch(20, [invalidFinding])), /Invalid self-reported/);
  const tooMany = Array.from({ length: 3 }, () => submission(2, 1));
  assert.throws(() => validateAgentResults(manifest, fingerprint, batch(2, tooMany)), /More submissions/);
});
test('output does not echo agent IDs, assignment IDs or review evidence', () => {
  const result = validateAgentResults(manifest, fingerprint, batch(20, [submission(20, 1)]));
  assert.doesNotMatch(JSON.stringify(result), /agent-1|task-1|private-owner|sensitive-evidence/);
  assert.match(result.note, /Agent assertions only/);
});
function cli(reports) {
  const dir = mkdtempSync(join(tmpdir(), 'agent-review-results-'));
  try {
    const manifestFile = join(dir, 'manifest.json');
    const reportsFile = join(dir, 'results.json');
    writeFileSync(manifestFile, JSON.stringify(manifest));
    writeFileSync(reportsFile, JSON.stringify(reports));
    return spawnSync(process.execPath, [resolve(fileURLToPath(new URL('../scripts/validate-agent-results.mjs', import.meta.url))), '--manifest', manifestFile, '--results', reportsFile], { encoding: 'utf8' });
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
test('CLI exit 0 for complete clean, 2 for follow-up and 1 for invalid', () => {
  const complete = cli(batch(2, [submission(2, 1), submission(2, 2)]));
  assert.equal(complete.status, 0, complete.stderr);
  const partial = cli(batch(2, [submission(2, 1)]));
  assert.equal(partial.status, 2, partial.stderr);
  const invalid = cli({ ...batch(2, []), manifestSha256: 'bad' });
  assert.equal(invalid.status, 1);
  assert.match(invalid.stderr, /AGENT REVIEW RESULT ERROR/);
});
