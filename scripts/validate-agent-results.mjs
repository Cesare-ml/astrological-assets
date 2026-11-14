#!/usr/bin/env node
/**
 * Validate self-reported, read-only asset-review results against exact shard worklists.
 * This is NOT a claim/lock service, proof of asset integrity, or rights clearance.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { planReviewShards } from './plan-review-shards.mjs';

const SHA256 = /^[a-f0-9]{64}$/;
const OPAQUE_ID = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/;
const FINDINGS = new Set(['inspected', 'flagged', 'not-checked']);

function requireKeys(value, expected, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).some(key => !expected.includes(key)) ||
      expected.some(key => !Object.hasOwn(value, key)))
    throw new Error('Invalid fields in ' + label);
}

/**
 * Only complete individual shard submissions are accepted. The collection may be
 * partial, so agents can submit their assigned shards at different times.
 */
export function validateAgentResults(manifest, manifestSha256, batch) {
  if (typeof manifestSha256 !== 'string' || !SHA256.test(manifestSha256))
    throw new Error('Missing or invalid exact manifest fingerprint');
  requireKeys(batch, ['schemaVersion', 'purpose', 'source', 'manifestSha256', 'shardCount', 'submissions'], 'results batch');
  if (batch.schemaVersion !== 1 || batch.purpose !== 'asset-agent-review-results' ||
      batch.manifestSha256 !== manifestSha256 || !Array.isArray(batch.submissions))
    throw new Error('Invalid result schema or stale manifest fingerprint');

  const plan = planReviewShards(manifest, { shardCount: batch.shardCount, manifestSha256 });
  requireKeys(batch.source, ['repository', 'commit', 'assetRoot'], 'source');
  for (const key of ['repository', 'commit', 'assetRoot'])
    if (batch.source[key] !== plan.source[key]) throw new Error('Stale or mismatched source provenance: ' + key);
  if (batch.submissions.length > batch.shardCount)
    throw new Error('More submissions than expected shards');

  const seenShards = new Set(), seenAssignments = new Set();
  let inspected = 0, flagged = 0, notChecked = 0;
  for (const report of batch.submissions) {
    requireKeys(report, ['shardIndex', 'assignmentId', 'agentId', 'results'], 'submission');
    if (!Number.isSafeInteger(report.shardIndex) || report.shardIndex < 1 || report.shardIndex > batch.shardCount)
      throw new Error('Invalid submission shard index');
    if (typeof report.assignmentId !== 'string' || typeof report.agentId !== 'string' ||
        !OPAQUE_ID.test(report.assignmentId) || !OPAQUE_ID.test(report.agentId))
      throw new Error('Expected opaque nonempty assignment and agent IDs');
    if (seenShards.has(report.shardIndex)) throw new Error('Conflicting duplicate submission for shard ' + report.shardIndex);
    if (seenAssignments.has(report.assignmentId)) throw new Error('Repeated assignment ID across shards');
    seenShards.add(report.shardIndex);
    seenAssignments.add(report.assignmentId);
    if (!Array.isArray(report.results)) throw new Error('Expected an array of findings');
    const shard = planReviewShards(manifest, {
      shardCount: batch.shardCount, shardIndex: report.shardIndex, manifestSha256,
    });
    const expected = new Map(shard.assets.map(asset => [asset.path, asset.sha256]));
    if (report.results.length !== expected.size)
      throw new Error('Incomplete or oversized shard ' + report.shardIndex);
    const seenPaths = new Set();
    for (const finding of report.results) {
      requireKeys(finding, ['path', 'sha256', 'finding'], 'asset finding');
      if (typeof finding.path !== 'string' || !expected.has(finding.path))
        throw new Error('Finding outside assigned shard ' + report.shardIndex);
      if (seenPaths.has(finding.path)) throw new Error('Duplicate asset finding: ' + finding.path);
      seenPaths.add(finding.path);
      if (finding.sha256 !== expected.get(finding.path))
        throw new Error('Stale asset digest in shard ' + report.shardIndex);
      if (!FINDINGS.has(finding.finding)) throw new Error('Invalid self-reported finding');
      if (finding.finding === 'inspected') inspected++;
      else if (finding.finding === 'flagged') flagged++;
      else notChecked++;
    }
  }

  const missingShards = plan.shards.map(x => x.index).filter(index => !seenShards.has(index));
  const requiresFollowUp = missingShards.length > 0 || flagged > 0 || notChecked > 0;
  return {
    schemaVersion: 1,
    manifestSha256,
    shardCount: batch.shardCount,
    totalAssets: plan.totalAssets,
    submittedShards: seenShards.size,
    missingShards,
    findings: { inspected, flagged, notChecked },
    requiresFollowUp,
    note: 'Agent assertions only; no task claim ownership, binary checksum or public rights verified.',
  };
}

function parseArgs(argv) {
  if (argv.length !== 4) throw new Error('Usage: node scripts/validate-agent-results.mjs --manifest file.json --results file.json');
  const values = new Map();
  for (let i = 0; i < 4; i += 2) {
    if (!['--manifest', '--results'].includes(argv[i]) || values.has(argv[i]) || !argv[i + 1])
      throw new Error('Duplicate or invalid CLI option');
    values.set(argv[i], argv[i + 1]);
  }
  if (!values.has('--manifest') || !values.has('--results')) throw new Error('Both inputs are required');
  return values;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const rawManifest = readFileSync(args.get('--manifest'));
  const manifest = JSON.parse(rawManifest.toString('utf8'));
  const results = JSON.parse(readFileSync(args.get('--results'), 'utf8'));
  const digest = createHash('sha256').update(rawManifest).digest('hex');
  const report = validateAgentResults(manifest, digest, results);
  console.log(JSON.stringify(report, null, 2));
  if (report.requiresFollowUp) process.exitCode = 2;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  try { main(); }
  catch (error) { console.error('AGENT REVIEW RESULT ERROR:', error.message); process.exitCode = 1; }
}
