#!/usr/bin/env node
/**
 * Read-only, family-level counts of self-reported asset reviews.
 * This cannot authenticate a private ledger or grant public artwork rights.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { reconcileAgentAssignments } from './reconcile-agent-assignments.mjs';

const FAMILIES = Object.freeze([
  ['chart-graphics', 'img/grafici/'],
  ['zodiac-and-symbols', 'img/simboli/'],
  ['white-symbols', 'img/simboli-bianchi/'],
  ['planet-icons', 'img/symbols/planets/'],
  ['textures', 'img/textures/'],
  ['solar-resonator', 'img/risuonatore-solare'],
  ['fonts', 'fonts/'],
]);

export function classifyReviewAsset(path) {
  for (const [family, prefix] of FAMILIES)
    if (path.startsWith(prefix)) return family;
  return 'other';
}

const counters = () => ({ total: 0, inspected: 0, flagged: 0, notChecked: 0, pending: 0 });

/**
 * Aggregate by fixed, non-sensitive asset families. All report paths and claims
 * have already been checked by the delegated fail-closed reconciler.
 */
export function summarizeAssetReviewProgress(manifest, manifestSha256, batch, snapshot, expectedLedgerCommitSha) {
  const audit = reconcileAgentAssignments(manifest, manifestSha256, batch, snapshot, expectedLedgerCommitSha);
  const results = new Map();
  for (const submission of batch.submissions)
    for (const item of submission.results) results.set(item.path, item.finding);

  const familyStats = new Map();
  const totals = counters();
  for (const asset of manifest.assets) {
    const family = classifyReviewAsset(asset.path);
    if (!familyStats.has(family)) familyStats.set(family, counters());
    const group = familyStats.get(family);
    const finding = results.get(asset.path) || 'pending';
    if (!Object.hasOwn(group, finding)) throw new Error('Unsupported review finding');
    group.total++;
    group[finding]++;
    totals.total++;
    totals[finding]++;
  }
  const known = new Set(FAMILIES.map(([name]) => name));
  const families = [...FAMILIES.map(([name]) => name), 'other']
    .filter(name => familyStats.has(name))
    .map(name => ({ family: name, ...familyStats.get(name) }));
  const allFindings = totals.inspected + totals.flagged + totals.notChecked;
  if (totals.total !== audit.totalAssets && audit.totalAssets !== undefined)
    throw new Error('Manifest asset count changed during progress computation');
  if (allFindings !== audit.findings.inspected + audit.findings.flagged + audit.findings.notChecked)
    throw new Error('Review findings changed during progress computation');
  if (totals.total !== allFindings + totals.pending)
    throw new Error('Incomplete asset census');
  return {
    schemaVersion: 1,
    purpose: 'asset-review-progress-census',
    manifestSha256,
    totalAssets: totals.total,
    reviewedAssertions: allFindings,
    inspectedAssertions: totals.inspected,
    needingFollowUp: totals.flagged + totals.notChecked + totals.pending,
    totals,
    families,
    missingShardCount: audit.missingResultShards.length,
    requiresFollowUp: audit.requiresFollowUp,
    note: 'Self-reported progress only. No private identities, source image bytes, visual verification or public redistribution rights checked.',
  };
}

function options(args) {
  if (args.length !== 8)
    throw new Error('Usage: node scripts/review-progress-census.mjs --manifest FILE --results FILE --assignments FILE --expected-ledger-commit SHA1');
  const values = new Map();
  for (let i = 0; i < args.length; i += 2) {
    if (!['--manifest', '--results', '--assignments', '--expected-ledger-commit'].includes(args[i]) ||
        values.has(args[i]) || !args[i + 1])
      throw new Error('Invalid or duplicate option');
    values.set(args[i], args[i + 1]);
  }
  if (values.size !== 4) throw new Error('All four options are required');
  return values;
}

function main(args) {
  const flags = options(args);
  const raw = readFileSync(flags.get('--manifest'));
  const manifest = JSON.parse(raw.toString('utf8'));
  const batch = JSON.parse(readFileSync(flags.get('--results'), 'utf8'));
  const snapshot = JSON.parse(readFileSync(flags.get('--assignments'), 'utf8'));
  const manifestSha256 = createHash('sha256').update(raw).digest('hex');
  const report = summarizeAssetReviewProgress(
    manifest, manifestSha256, batch, snapshot, flags.get('--expected-ledger-commit'),
  );
  console.log(JSON.stringify(report, null, 2));
  if (report.requiresFollowUp) process.exitCode = 2;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  try { main(process.argv.slice(2)); }
  catch (error) { console.error('REVIEW PROGRESS CENSUS ERROR:', error.message); process.exitCode = 1; }
}
