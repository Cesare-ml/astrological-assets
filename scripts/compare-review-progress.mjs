#!/usr/bin/env node
/** Compare two privacy-conservative, pinned review censuses without reading agent or image data. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const FAMILIES = [
  'chart-graphics', 'zodiac-and-symbols', 'white-symbols', 'planet-icons',
  'textures', 'solar-resonator', 'fonts', 'other',
];
const COUNTS = ['total', 'inspected', 'flagged', 'notChecked', 'pending'];
const CENSUS_KEYS = [
  'schemaVersion', 'purpose', 'manifestSha256', 'totalAssets', 'reviewedAssertions',
  'inspectedAssertions', 'needingFollowUp', 'totals', 'families',
  'missingShardCount', 'requiresFollowUp', 'note',
];
const FAMILY_KEYS = ['family', ...COUNTS];
const SHA256 = /^[a-f0-9]{64}$/;

function exactKeys(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).length !== keys.length ||
      !keys.every(key => Object.hasOwn(value, key)))
    throw new Error('Invalid fields in ' + label);
}

function safeCount(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error('Invalid nonnegative integer: ' + label);
  return value;
}

function safeSum(values, label) {
  let sum = 0;
  for (const value of values) {
    sum += value;
    if (!Number.isSafeInteger(sum)) throw new Error('Integer overflow in ' + label);
  }
  return sum;
}

function checkCounters(value, label) {
  exactKeys(value, COUNTS, label);
  for (const key of COUNTS) safeCount(value[key], label + '.' + key);
  if (safeSum(COUNTS.slice(1).map(key => value[key]), label) !== value.total)
    throw new Error('Inconsistent totals in ' + label);
}

function parseCensus(input, label) {
  exactKeys(input, CENSUS_KEYS, label);
  if (input.schemaVersion !== 1 || input.purpose !== 'asset-review-progress-census' ||
      typeof input.manifestSha256 !== 'string' || !SHA256.test(input.manifestSha256) ||
      !Array.isArray(input.families) || input.families.length === 0 ||
      input.families.length > FAMILIES.length ||
      typeof input.requiresFollowUp !== 'boolean' ||
      typeof input.note !== 'string' || !input.note.trim())
    throw new Error('Invalid progress census envelope: ' + label);
  for (const key of ['totalAssets', 'reviewedAssertions', 'inspectedAssertions', 'needingFollowUp', 'missingShardCount'])
    safeCount(input[key], label + '.' + key);
  if (input.totalAssets === 0) throw new Error('Empty progress census: ' + label);
  checkCounters(input.totals, label + '.totals');
  if (input.totalAssets !== input.totals.total ||
      input.inspectedAssertions !== input.totals.inspected ||
      input.reviewedAssertions !== safeSum([
        input.totals.inspected, input.totals.flagged, input.totals.notChecked,
      ], label + '.reviewedAssertions') ||
      input.needingFollowUp !== safeSum([
        input.totals.flagged, input.totals.notChecked, input.totals.pending,
      ], label + '.needingFollowUp') ||
      input.missingShardCount > input.totals.pending ||
      input.requiresFollowUp !== (input.needingFollowUp > 0))
    throw new Error('Inconsistent progress summary: ' + label);

  const byFamily = new Map();
  for (const family of input.families) {
    exactKeys(family, FAMILY_KEYS, label + '.family');
    if (!FAMILIES.includes(family.family) || byFamily.has(family.family))
      throw new Error('Unknown or duplicate family in ' + label);
    checkCounters(Object.fromEntries(COUNTS.map(key => [key, family[key]])), label + '.family');
    if (family.total === 0) throw new Error('Empty family entry in ' + label);
    byFamily.set(family.family, family);
  }
  for (const key of COUNTS)
    if (safeSum([...byFamily.values()].map(family => family[key]), label + '.families') !== input.totals[key])
      throw new Error('Family totals do not match census: ' + label);
  return byFamily;
}

const countDelta = (before, after) => Object.fromEntries(
  COUNTS.slice(1).map(key => [key, after[key] - before[key]]),
);

/** Read-only comparison. Both censuses must refer to the exact same manifest bytes. */
export function compareReviewProgress(before, after) {
  const older = parseCensus(before, 'before');
  const newer = parseCensus(after, 'after');
  if (before.manifestSha256 !== after.manifestSha256 || before.totalAssets !== after.totalAssets)
    throw new Error('Cannot compare different manifest revisions');
  if (older.size !== newer.size || [...older.keys()].some(name =>
      !newer.has(name) || older.get(name).total !== newer.get(name).total))
    throw new Error('Census families changed despite identical manifest');

  const families = [];
  for (const family of FAMILIES) {
    if (!older.has(family)) continue;
    const delta = countDelta(older.get(family), newer.get(family));
    if (Object.values(delta).every(value => value === 0)) continue;
    families.push({ family, delta, regressed: delta.inspected < 0 || delta.pending > 0 });
  }
  const delta = countDelta(before.totals, after.totals);
  const regressed = families.some(family => family.regressed);
  return {
    schemaVersion: 1,
    purpose: 'asset-review-progress-comparison',
    manifestSha256: before.manifestSha256,
    totalAssets: before.totalAssets,
    changed: families.length > 0,
    regressed,
    delta,
    families,
    note: 'Aggregate changes in agent assertions only; no approval of task completion, artwork licensing or publication.',
  };
}

function parseArgs(argv) {
  if (argv.length !== 4) throw new Error('Usage: node scripts/compare-review-progress.mjs --before old-census.json --after new-census.json');
  const opts = new Map();
  for (let i = 0; i < argv.length; i += 2) {
    if (!['--before', '--after'].includes(argv[i]) || opts.has(argv[i]) || !argv[i + 1])
      throw new Error('Unknown, missing or duplicate input');
    opts.set(argv[i], argv[i + 1]);
  }
  if (opts.size !== 2) throw new Error('Two input censuses required');
  return opts;
}

function main(argv) {
  const opts = parseArgs(argv);
  const before = JSON.parse(readFileSync(opts.get('--before'), 'utf8'));
  const after = JSON.parse(readFileSync(opts.get('--after'), 'utf8'));
  const comparison = compareReviewProgress(before, after);
  console.log(JSON.stringify(comparison, null, 2));
  if (comparison.regressed) process.exitCode = 2;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  try { main(process.argv.slice(2)); }
  catch (error) { console.error('REVIEW PROGRESS COMPARISON ERROR:', error.message); process.exitCode = 1; }
}
