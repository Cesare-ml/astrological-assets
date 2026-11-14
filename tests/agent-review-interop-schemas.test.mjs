import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { planReviewShards } from '../scripts/plan-review-shards.mjs';
import { validateAgentResults } from '../scripts/validate-agent-results.mjs';
import { reconcileAgentAssignments } from '../scripts/reconcile-agent-assignments.mjs';

const load = name => JSON.parse(readFileSync(new URL('../schemas/' + name, import.meta.url), 'utf8'));
const resultSchema = load('asset-agent-review-results-v1.schema.json');
const snapshotSchema = load('asset-agent-review-assignment-snapshot-v1.schema.json');

// Minimal test-only evaluator for the deliberately limited JSON Schema keywords
// used by these contracts. This is NOT a production JSON Schema engine.
function check(value, schema, root) {
  if (schema.$ref) {
    assert.match(schema.$ref, /^#\/\$defs\/[A-Za-z0-9]+$/);
    const target = root.$defs[schema.$ref.slice('#/$defs/'.length)];
    assert.ok(target, 'Missing internal schema definition: ' + schema.$ref);
    return check(value, target, root);
  }
  if (Object.hasOwn(schema, 'const')) assert.deepEqual(value, schema.const);
  if (schema.enum) assert.ok(schema.enum.includes(value), 'Not an allowed enum value');
  if (schema.type === 'object') {
    assert.ok(value !== null && typeof value === 'object' && !Array.isArray(value), 'Expected object');
    for (const key of schema.required || []) assert.ok(Object.hasOwn(value, key), 'Missing required ' + key);
    for (const [key, member] of Object.entries(value)) {
      if (!Object.hasOwn(schema.properties || {}, key)) {
        assert.notEqual(schema.additionalProperties, false, 'Unexpected field ' + key);
        continue;
      }
      check(member, schema.properties[key], root);
    }
  } else if (schema.type === 'array') {
    assert.ok(Array.isArray(value), 'Expected array');
    if (schema.minItems !== undefined) assert.ok(value.length >= schema.minItems, 'Too few items');
    value.forEach(item => check(item, schema.items, root));
  } else if (schema.type === 'string') {
    assert.equal(typeof value, 'string', 'Expected string');
    if (schema.minLength !== undefined) assert.ok(value.length >= schema.minLength, 'String too short');
    if (schema.pattern !== undefined) assert.match(value, new RegExp(schema.pattern));
  } else if (schema.type === 'integer') {
    assert.ok(Number.isSafeInteger(value), 'Expected safe integer');
    if (schema.minimum !== undefined) assert.ok(value >= schema.minimum, 'Integer too low');
    if (schema.maximum !== undefined) assert.ok(value <= schema.maximum, 'Integer too high');
  }
}

const fixture = () => {
  const source = { repository: 'example/private-source', commit: 'a'.repeat(40), assetRoot: 'public/assets' };
  const assets = ['img/symbols/a.png', 'img/symbols/b.png'].map((path, i) => ({
    path, bytes: 100 + i,
    sha256: createHash('sha256').update(path).digest('hex'),
    rightsHolder: 'synthetic test owner',
    permissionBasis: 'synthetic private test permission',
    approvalEvidence: 'synthetic test evidence',
  }));
  const manifest = { schemaVersion: 1, source, assets };
  const manifestSha256 = createHash('sha256').update(JSON.stringify(manifest)).digest('hex');
  const ledgerCommitSha = 'b'.repeat(40);
  const assignments = [1, 2].map(shardIndex => ({
    shardIndex, agentId: 'agent-' + shardIndex,
    assignmentId: 'assignment-' + shardIndex,
    state: 'submitted',
  }));
  const submissions = assignments.map(assignment => ({
    shardIndex: assignment.shardIndex, agentId: assignment.agentId,
    assignmentId: assignment.assignmentId,
    results: planReviewShards(manifest, { shardCount: 2, shardIndex: assignment.shardIndex }).assets
      .map(asset => ({ path: asset.path, sha256: asset.sha256, finding: 'inspected' })),
  }));
  return {
    manifest, manifestSha256, ledgerCommitSha,
    batch: { schemaVersion: 1, purpose: 'asset-agent-review-results', source, manifestSha256, shardCount: 2, submissions },
    snapshot: { schemaVersion: 1, purpose: 'asset-review-assignment-snapshot', source, manifestSha256, shardCount: 2, ledgerCommitSha, assignments },
  };
};

test('both contracts use JSON Schema 2020-12 with pinned v1 purposes', () => {
  for (const [schema, purpose] of [
    [resultSchema, 'asset-agent-review-results'],
    [snapshotSchema, 'asset-review-assignment-snapshot'],
  ]) {
    assert.equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema');
    assert.equal(schema.type, 'object');
    assert.equal(schema.additionalProperties, false);
    assert.equal(schema.properties.schemaVersion.const, 1);
    assert.equal(schema.properties.purpose.const, purpose);
    assert.equal(schema.$defs.source.properties.assetRoot.const, 'public/assets');
  }
});

test('all object definitions reject unknown properties and require their fields', () => {
  for (const schema of [resultSchema, snapshotSchema]) {
    assert.deepEqual([...schema.required].sort(), Object.keys(schema.properties).sort());
    for (const value of Object.values(schema.$defs)) {
      if (value.type !== 'object') continue;
      assert.equal(value.additionalProperties, false);
      assert.deepEqual([...value.required].sort(), Object.keys(value.properties).sort());
    }
  }
});

test('all references stay inside the current document and resolve', () => {
  for (const schema of [resultSchema, snapshotSchema]) {
    const walk = obj => {
      if (obj === null || typeof obj !== 'object') return;
      if (obj.$ref) {
        assert.match(obj.$ref, /^#\/\$defs\/[A-Za-z0-9]+$/);
        assert.ok(Object.hasOwn(schema.$defs, obj.$ref.slice('#/$defs/'.length)));
      }
      for (const val of Object.values(obj)) walk(val);
    };
    walk(schema);
  }
});

test('public schemas preserve only the approved, minimal status sets', () => {
  assert.deepEqual(resultSchema.$defs.finding.properties.finding.enum,
    ['inspected', 'flagged', 'not-checked']);
  assert.deepEqual(snapshotSchema.$defs.assignment.properties.state.enum,
    ['claimed', 'in_progress', 'submitted', 'cancelled']);
});

test('valid synthetic exchange satisfies both schemas and the real runtime validators', () => {
  const { manifest, manifestSha256, ledgerCommitSha, batch, snapshot } = fixture();
  check(batch, resultSchema, resultSchema);
  check(snapshot, snapshotSchema, snapshotSchema);
  assert.equal(validateAgentResults(manifest, manifestSha256, batch).requiresFollowUp, false);
  const summary = reconcileAgentAssignments(manifest, manifestSha256, batch, snapshot, ledgerCommitSha);
  assert.equal(summary.requiresFollowUp, false);
  assert.equal(summary.acceptedSubmissions, 2);
  assert.equal(summary.findings.inspected, 2);
});

test('schema rejects unexpected private data fields at all nesting levels', () => {
  const { batch, snapshot } = fixture();
  assert.throws(() => check({ ...snapshot, privateLedgerUrl: 'private' }, snapshotSchema, snapshotSchema));
  assert.throws(() => check({ ...snapshot, assignments: [{ ...snapshot.assignments[0], sessionToken: 'secret' }] },
    snapshotSchema, snapshotSchema));
  assert.throws(() => check({ ...batch, source: { ...batch.source, privateSession: 'hidden' } }, resultSchema, resultSchema));
  assert.throws(() => check({ ...batch, submissions: [
    { ...batch.submissions[0], results: [{ ...batch.submissions[0].results[0], rightsEvidence: 'private' }] },
  ] }, resultSchema, resultSchema));
});

test('schema rejects invalid status, digest, opaque identity, shard number and missing required keys', () => {
  const { batch, snapshot } = fixture();
  assert.throws(() => check({ ...batch, manifestSha256: 'bad' }, resultSchema, resultSchema));
  assert.throws(() => check({ ...batch, shardCount: 0 }, resultSchema, resultSchema));
  assert.throws(() => check({ ...batch, submissions: [{
    ...batch.submissions[0], agentId: 'personal name', results: batch.submissions[0].results,
  }] }, resultSchema, resultSchema));
  assert.throws(() => check({ ...batch, submissions: [{
    ...batch.submissions[0], results: [{ ...batch.submissions[0].results[0], finding: 'publicly-approved' }],
  }] }, resultSchema, resultSchema));
  assert.throws(() => check({ ...snapshot, ledgerCommitSha: 'not-a-commit' }, snapshotSchema, snapshotSchema));
  assert.throws(() => check({ ...snapshot, assignments: [{
    ...snapshot.assignments[0], state: 'expired',
  }] }, snapshotSchema, snapshotSchema));
  const missingPurpose = { ...batch };
  delete missingPurpose.purpose;
  assert.throws(() => check(missingPurpose, resultSchema, resultSchema));
});

test('cross-record uniqueness and identity rules remain enforced by runtime, not just schema', () => {
  const { manifest, manifestSha256, ledgerCommitSha, batch, snapshot } = fixture();
  const duplicate = { ...snapshot, assignments: [
    snapshot.assignments[0], { ...snapshot.assignments[0], agentId: 'another' },
  ] };
  check(duplicate, snapshotSchema, snapshotSchema); // JSON Schema cannot express distinct shardIndex values.
  assert.throws(() => reconcileAgentAssignments(manifest, manifestSha256, batch, duplicate, ledgerCommitSha),
    /Duplicate assignment shard/);
  const stale = { ...snapshot, ledgerCommitSha: 'f'.repeat(40) };
  check(stale, snapshotSchema, snapshotSchema); // Well-formed is not authenticated.
  assert.throws(() => reconcileAgentAssignments(manifest, manifestSha256, batch, stale, ledgerCommitSha),
    /independently pinned/);
});

test('contract files contain no real identifiers or credentials', () => {
  for (const schema of [resultSchema, snapshotSchema]) {
    const text = JSON.stringify(schema);
    assert.doesNotMatch(text, /session_id|oauth|access_token|password|personal_access_token|private\\.git/i);
    assert.doesNotMatch(text, /claims\\/[a-z0-9]|submissions\\/[a-z0-9]/i);
  }
});
