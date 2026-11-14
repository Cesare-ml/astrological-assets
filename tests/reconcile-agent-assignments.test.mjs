import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { reconcileAgentAssignments as reconcileWithPin } from '../scripts/reconcile-agent-assignments.mjs';
const trustedPin = 'b'.repeat(40);
const reconcileAgentAssignments = (manifest, fingerprint, reports, claims) =>
  reconcileWithPin(manifest, fingerprint, reports, claims, trustedPin);

const source = { repository: 'owner/source', commit: 'a'.repeat(40), assetRoot: 'public/assets' };
const assets = Array.from({ length: 1013 }, (_, i) => ({
  path: 'img/grafici/light/' + String(i).padStart(4, '0') + '.png',
  bytes: i + 1,
  sha256: createHash('sha256').update('synthetic:' + i).digest('hex'),
  rightsHolder: 'synthetic fixture owner', permissionBasis: 'private use only',
  approvalEvidence: 'confidential fixture evidence',
}));
const manifest = { schemaVersion: 1, source, assets };
const fingerprint = createHash('sha256').update(JSON.stringify(manifest)).digest('hex');
const ordered = [...assets].sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
const reportFor = (count, index, finding = 'inspected') => ({
  shardIndex: index, agentId: 'agent-' + index, assignmentId: 'task-' + index,
  results: ordered.filter((_, i) => i % count === index - 1)
    .map(asset => ({ path: asset.path, sha256: asset.sha256, finding })),
});
const batch = (count, submissions) => ({
  schemaVersion: 1, purpose: 'asset-agent-review-results',
  source, manifestSha256: fingerprint, shardCount: count, submissions,
});
const snapshot = (count, assignments) => ({
  schemaVersion: 1, purpose: 'asset-review-assignment-snapshot',
  source, manifestSha256: fingerprint,
  shardCount: count, ledgerCommitSha: 'b'.repeat(40), assignments,
});
const assignmentFor = (index, state = 'submitted') => ({
  shardIndex: index, agentId: 'agent-' + index, assignmentId: 'task-' + index, state,
});
const full = count => {
  const reports = Array.from({ length: count }, (_, i) => reportFor(count, i + 1));
  const claims = Array.from({ length: count }, (_, i) => assignmentFor(i + 1));
  return { reports: batch(count, reports), claims: snapshot(count, claims) };
};

test('2/20/40/100-agent full, clean reconciliations are complete', () => {
  for (const count of [2, 20, 40, 100]) {
    const { reports, claims } = full(count);
    const result = reconcileAgentAssignments(manifest, fingerprint, reports, claims);
    assert.equal(result.acceptedSubmissions, count);
    assert.equal(result.requiresFollowUp, false);
    assert.equal(result.findings.inspected, 1013);
    assert.deepEqual(result.missingAssignments, []);
    assert.deepEqual(result.missingResultShards, []);
  }
});

test('partial snapshot distinguishes never assigned, in progress, submitted without report and cancelled', () => {
  const claims = snapshot(20, [
    assignmentFor(1, 'submitted'), assignmentFor(2, 'in_progress'),
    assignmentFor(3, 'claimed'), assignmentFor(4, 'submitted'),
    assignmentFor(5, 'cancelled'),
  ]);
  const result = reconcileAgentAssignments(manifest, fingerprint, batch(20, [reportFor(20, 1)]), claims);
  assert.equal(result.requiresFollowUp, true);
  assert.deepEqual(result.pendingAssignments, [2, 3]);
  assert.deepEqual(result.missingSubmittedReports, [4]);
  assert.deepEqual(result.cancelledAssignments, [5]);
  assert.deepEqual(result.missingAssignments, Array.from({ length: 15 }, (_, i) => i + 6));
});

test('old assignment identifier cannot submit after reissue to another agent', () => {
  const claims = snapshot(2, [
    { ...assignmentFor(1), assignmentId: 'task-reissued', agentId: 'agent-new' },
    assignmentFor(2),
  ]);
  assert.throws(() => reconcileAgentAssignments(manifest, fingerprint, batch(2, [reportFor(2, 1)]), claims),
    /Stale or unauthorized/);
});

test('claims must match exact agent even with matching assignment ID', () => {
  const claims = snapshot(2, [
    { ...assignmentFor(1), agentId: 'different-agent' }, assignmentFor(2),
  ]);
  assert.throws(() => reconcileAgentAssignments(manifest, fingerprint, batch(2, [reportFor(2, 1)]), claims),
    /Stale or unauthorized/);
});

test('an active claim cannot be accepted as a completed submission', () => {
  for (const state of ['claimed', 'in_progress', 'cancelled']) {
    const claims = snapshot(2, [assignmentFor(1, state), assignmentFor(2)]);
    assert.throws(() => reconcileAgentAssignments(manifest, fingerprint, batch(2, [reportFor(2, 1)]), claims),
      /not marked submitted/);
  }
});

test('duplicate shard entries or assignment IDs are refused', () => {
  assert.throws(() => reconcileAgentAssignments(manifest, fingerprint, batch(2, []),
    snapshot(2, [assignmentFor(1), assignmentFor(1)])), /Duplicate assignment shard/);
  assert.throws(() => reconcileAgentAssignments(manifest, fingerprint, batch(2, []),
    snapshot(2, [assignmentFor(1), { ...assignmentFor(2), assignmentId: 'task-1' }])), /Duplicate assignment ID/);
});

test('unregistered result shard and invalid snapshot state are refused', () => {
  assert.throws(() => reconcileAgentAssignments(manifest, fingerprint, batch(2, [reportFor(2, 1)]),
    snapshot(2, [assignmentFor(2)])), /Unregistered result/);
  assert.throws(() => reconcileAgentAssignments(manifest, fingerprint, batch(2, []),
    snapshot(2, [assignmentFor(1, 'publicly-cleared')])), /Invalid assignment identity or state/);
});

test('tampered provenance, extra fields and ledger SHA are refused', () => {
  const { reports, claims } = full(2);
  for (const mutated of [
    { ...claims, manifestSha256: 'f'.repeat(64) },
    { ...claims, source: { ...source, commit: 'c'.repeat(40) } },
    { ...claims, ledgerCommitSha: 'invalid' },
    { ...claims, shardCount: 40 },
    { ...claims, confidential: 'leak' },
    { ...claims, assignments: [{ ...assignmentFor(1), hidden: 'test' }, assignmentFor(2)] },
  ]) assert.throws(() => reconcileAgentAssignments(manifest, fingerprint, reports, mutated));
});

test('flagged findings still require follow-up even with every assignment submitted', () => {
  const { reports, claims } = full(2);
  reports.submissions[0].results[0].finding = 'flagged';
  const result = reconcileAgentAssignments(manifest, fingerprint, reports, claims);
  assert.equal(result.requiresFollowUp, true);
  assert.equal(result.findings.flagged, 1);
});

test('output excludes private ledger metadata and opaque task/agent identities', () => {
  const { reports, claims } = full(2);
  const output = JSON.stringify(reconcileAgentAssignments(manifest, fingerprint, reports, claims));
  assert.doesNotMatch(output, /agent-1|task-1|confidential fixture evidence|synthetic fixture owner/);
  assert.doesNotMatch(output, new RegExp(claims.ledgerCommitSha));
  assert.match(output, /authenticity/);
});

function cli(reports, claims, args = null) {
  const dir = mkdtempSync(join(tmpdir(), 'astro-agent-reconcile-'));
  try {
    for (const [filename, value] of [['manifest.json', manifest], ['results.json', reports], ['assignments.json', claims]])
      writeFileSync(join(dir, filename), JSON.stringify(value));
    const script = resolve(fileURLToPath(new URL('../scripts/reconcile-agent-assignments.mjs', import.meta.url)));
    return spawnSync(process.execPath, [script, ...(args || [
      '--manifest', join(dir, 'manifest.json'),
      '--results', join(dir, 'results.json'),
      '--assignments', join(dir, 'assignments.json'),
      '--expected-ledger-commit', trustedPin,
    ])], { encoding: 'utf8' });
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

test('CLI exit codes: 0 complete, 2 follow-up, 1 invalid, and duplicate flags fail', () => {
  const { reports, claims } = full(2);
  const complete = cli(reports, claims);
  assert.equal(complete.status, 0, complete.stderr);
  assert.equal(JSON.parse(complete.stdout).requiresFollowUp, false);
  const partial = cli(batch(2, [reportFor(2, 1)]), snapshot(2, [assignmentFor(1)]));
  assert.equal(partial.status, 2, partial.stderr);
  const invalid = cli(reports, { ...claims, ledgerCommitSha: 'invalid' });
  assert.equal(invalid.status, 1);
  assert.match(invalid.stderr, /RECONCILIATION FAILED/);
  const wrongArgs = cli(reports, claims, [
    '--manifest', 'anything', '--results', 'anything', '--results', 'anything',
  ]);
  assert.equal(wrongArgs.status, 1);
});

test('results are checked against the manifest before snapshot inspection', () => {
  const { reports, claims } = full(2);
  reports.submissions[0].results[0].sha256 = 'f'.repeat(64);
  assert.throws(() => reconcileAgentAssignments(manifest, fingerprint, reports, claims), /Stale asset digest/);
});

test('independent ledger pin must be supplied and match exact snapshot revision', () => {
  const { reports, claims } = full(2);
  assert.throws(() => reconcileWithPin(manifest, fingerprint, reports, claims), /independently verified/);
  assert.throws(() => reconcileWithPin(manifest, fingerprint, reports, claims, 'invalid'), /independently verified/);
  assert.throws(() => reconcileWithPin(manifest, fingerprint, reports, claims, 'c'.repeat(40)), /independently pinned/);
  assert.equal(reconcileWithPin(manifest, fingerprint, reports, claims, trustedPin).requiresFollowUp, false);
});

test('CLI refuses incorrect or missing independent ledger pin', () => {
  const { reports, claims } = full(2);
  const missing = cli(reports, claims, ['--manifest', 'manifest.json', '--results', 'results.json',
    '--assignments', 'assignments.json']);
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /Usage:/);
  const invalid = cli(reports, claims, [
    '--manifest', 'manifest.json', '--results', 'results.json',
    '--assignments', 'assignments.json', '--expected-ledger-commit', 'invalid',
  ]);
  assert.equal(invalid.status, 1);
  assert.match(invalid.stderr, /RECONCILIATION FAILED/);
});
