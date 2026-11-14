#!/usr/bin/env node
/**
 * Read-only reconciliation of agent result batches with a trusted, exported
 * assignment snapshot. This is NOT a lease/lock manager or authentication.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateAgentResults } from './validate-agent-results.mjs';

const SHA256 = /^[a-f0-9]{64}$/;
const SHA1 = /^[a-f0-9]{40}$/;
const OPAQUE_ID = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/;
const STATES = new Set(['claimed', 'in_progress', 'submitted', 'cancelled']);

function requireKeys(value, keys, label) {
  if (value === null || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).length !== keys.length ||
      !keys.every(key => Object.hasOwn(value, key)))
    throw new Error('Invalid fields in ' + label);
}

/**
 * Results must be checked against a fresh, independently trusted private-ledger
 * snapshot. A syntactically valid snapshot alone is NOT proof of authenticity.
 * Assignment IDs must never be reused when the coordinator reassigns a shard.
 */
export function reconcileAgentAssignments(manifest, manifestSha256, batch, snapshot, expectedLedgerCommitSha) {
  if (typeof expectedLedgerCommitSha !== 'string' || !SHA1.test(expectedLedgerCommitSha))
    throw new Error('An independently verified ledger commit SHA is required');
  // First apply the existing full, fail-closed manifest and worklist checks.
  const results = validateAgentResults(manifest, manifestSha256, batch);
  requireKeys(snapshot, [
    'schemaVersion', 'purpose', 'source', 'manifestSha256',
    'shardCount', 'ledgerCommitSha', 'assignments'
  ], 'assignment snapshot');
  if (snapshot.schemaVersion !== 1 ||
      snapshot.purpose !== 'asset-review-assignment-snapshot' ||
      !SHA256.test(snapshot.manifestSha256 || '') ||
      snapshot.manifestSha256 !== manifestSha256 ||
      snapshot.shardCount !== results.shardCount ||
      !SHA1.test(snapshot.ledgerCommitSha || '') ||
      !Array.isArray(snapshot.assignments))
    throw new Error('Stale or invalid assignment snapshot');
  if (snapshot.ledgerCommitSha !== expectedLedgerCommitSha)
    throw new Error('Assignment snapshot differs from independently pinned ledger commit');
  requireKeys(snapshot.source, ['repository', 'commit', 'assetRoot'], 'snapshot source');
  for (const key of ['repository', 'commit', 'assetRoot'])
    if (snapshot.source[key] !== manifest.source[key])
      throw new Error('Assignment snapshot source mismatch: ' + key);
  if (snapshot.assignments.length > results.shardCount)
    throw new Error('More assignments than available shards');

  const byShard = new Map(), assignments = new Set();
  for (const item of snapshot.assignments) {
    requireKeys(item, ['shardIndex', 'assignmentId', 'agentId', 'state'], 'assignment');
    if (!Number.isSafeInteger(item.shardIndex) ||
        item.shardIndex < 1 || item.shardIndex > results.shardCount)
      throw new Error('Invalid assignment shard index');
    if (typeof item.assignmentId !== 'string' || !OPAQUE_ID.test(item.assignmentId) ||
        typeof item.agentId !== 'string' || !OPAQUE_ID.test(item.agentId) ||
        !STATES.has(item.state))
      throw new Error('Invalid assignment identity or state');
    if (byShard.has(item.shardIndex)) throw new Error('Duplicate assignment shard: ' + item.shardIndex);
    if (assignments.has(item.assignmentId)) throw new Error('Duplicate assignment ID in snapshot');
    byShard.set(item.shardIndex, item);
    assignments.add(item.assignmentId);
  }

  const submitted = new Set();
  for (const report of batch.submissions) {
    const assigned = byShard.get(report.shardIndex);
    if (!assigned) throw new Error('Unregistered result shard: ' + report.shardIndex);
    if (assigned.assignmentId !== report.assignmentId ||
        assigned.agentId !== report.agentId)
      throw new Error('Stale or unauthorized assignment identity for shard ' + report.shardIndex);
    if (assigned.state !== 'submitted')
      throw new Error('Result is not marked submitted in snapshot for shard ' + report.shardIndex);
    submitted.add(report.shardIndex);
  }

  const missingAssignments = [], pendingAssignments = [], missingSubmittedReports = [], cancelledAssignments = [];
  for (let shard = 1; shard <= results.shardCount; shard++) {
    const assigned = byShard.get(shard);
    if (!assigned) missingAssignments.push(shard);
    else if (assigned.state === 'cancelled') cancelledAssignments.push(shard);
    else if (assigned.state === 'submitted' && !submitted.has(shard)) missingSubmittedReports.push(shard);
    else if (assigned.state !== 'submitted') pendingAssignments.push(shard);
  }
  const requiresFollowUp = results.requiresFollowUp ||
    missingAssignments.length > 0 || pendingAssignments.length > 0 ||
    missingSubmittedReports.length > 0 || cancelledAssignments.length > 0;
  return {
    schemaVersion: 1,
    manifestSha256,
    shardCount: results.shardCount,
    acceptedSubmissions: submitted.size,
    missingAssignments,
    pendingAssignments,
    missingSubmittedReports,
    cancelledAssignments,
    missingResultShards: results.missingShards,
    findings: results.findings,
    requiresFollowUp,
    note: 'Snapshot and reports checked structurally only; private-ledger authenticity, live claim ownership, asset bytes and artwork rights are NOT verified.',
  };
}

function parseArgs(args) {
  if (args.length !== 8)
    throw new Error('Usage: node scripts/reconcile-agent-assignments.mjs --manifest manifest.json --results results.json --assignments assignments.json --expected-ledger-commit SHA1');
  const opts = new Map();
  for (let i = 0; i < args.length; i += 2) {
    if (!['--manifest', '--results', '--assignments', '--expected-ledger-commit'].includes(args[i]) ||
        opts.has(args[i]) || !args[i + 1])
      throw new Error('Duplicate, unknown or missing CLI option');
    opts.set(args[i], args[i + 1]);
  }
  if (opts.size !== 4) throw new Error('All three input files and a trusted ledger commit pin are required');
  return opts;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const rawManifest = readFileSync(opts.get('--manifest'));
  const manifestSha256 = createHash('sha256').update(rawManifest).digest('hex');
  const manifest = JSON.parse(rawManifest.toString('utf8'));
  const batch = JSON.parse(readFileSync(opts.get('--results'), 'utf8'));
  const snapshot = JSON.parse(readFileSync(opts.get('--assignments'), 'utf8'));
  const report = reconcileAgentAssignments(manifest, manifestSha256, batch, snapshot, opts.get('--expected-ledger-commit'));
  console.log(JSON.stringify(report, null, 2));
  if (report.requiresFollowUp) process.exitCode = 2;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  try { main(); }
  catch (error) {
    console.error('AGENT ASSIGNMENT RECONCILIATION FAILED:', error.message);
    process.exitCode = 1;
  }
}
