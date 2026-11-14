#!/usr/bin/env node
/**
 * Deterministic, metadata-only review worklists for independent VirgoStars agents.
 * Worklist generation never grants public distribution rights or reads asset bytes.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateAssetPath } from './import-approved-assets.mjs';

const pathOrder = (a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0;

function positiveInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 1) throw new Error(label + ' must be a positive safe integer');
  return value;
}

function checkManifest(manifest) {
  if (manifest?.schemaVersion !== 1 || !Array.isArray(manifest.assets) || manifest.assets.length === 0)
    throw new Error('Expected a nonempty version 1 approved asset manifest');
  if (typeof manifest.source?.repository !== 'string' || !manifest.source.repository.trim() ||
      !/^[a-f0-9]{40}$/.test(manifest.source.commit || '') ||
      manifest.source.assetRoot !== 'public/assets')
    throw new Error('Missing or invalid manifest source provenance');
  const seen = new Set();
  const assets = [];
  for (const asset of manifest.assets) {
    validateAssetPath(asset?.path);
    const folded = asset.path.normalize('NFC').toLowerCase();
    if (seen.has(folded)) throw new Error('Duplicate/case-colliding asset path: ' + asset.path);
    seen.add(folded);
    if (!Number.isSafeInteger(asset.bytes) || asset.bytes < 0 ||
        !/^[a-f0-9]{64}$/.test(asset.sha256 || '') ||
        (asset.gitBlobSha !== undefined && !/^[a-f0-9]{40}$/.test(asset.gitBlobSha)))
      throw new Error('Invalid asset size or digest: ' + asset.path);
    if (asset.status !== undefined && asset.status !== 'approved')
      throw new Error('Private-use approval missing: ' + asset.path);
    for (const field of ['rightsHolder', 'permissionBasis', 'approvalEvidence'])
      if (typeof asset[field] !== 'string' || !asset[field].trim())
        throw new Error('Missing private approval metadata ' + field + ': ' + asset.path);
    assets.push({ path: asset.path, bytes: asset.bytes, sha256: asset.sha256 });
  }
  return assets.sort(pathOrder);
}

/**
 * Shards are 1-based. Sorting followed by round-robin placement makes workloads
 * balanced (difference <= 1), independent of manifest array order, and disjoint.
 * Recompute against exactly the same pinned manifest whenever count changes.
 */
export function planReviewShards(manifest, { shardCount, shardIndex = null, manifestSha256 = null }) {
  const assets = checkManifest(manifest);
  positiveInteger(shardCount, 'shardCount');
  if (shardCount > assets.length) throw new Error('shardCount exceeds the number of assets');
  if (shardCount > 1000) throw new Error('shardCount may not exceed 1000');
  if (shardIndex !== null && ( !Number.isSafeInteger(shardIndex) || shardIndex < 1 || shardIndex > shardCount ))
    throw new Error('shardIndex must be in the range 1..shardCount');
  if (manifestSha256 !== null && !/^[a-f0-9]{64}$/.test(manifestSha256))
    throw new Error('Invalid manifestSha256');
  const shards = Array.from({ length: shardCount }, (_, index) => ({
    index: index + 1, count: 0, bytes: 0,
  }));
  for (let i = 0; i < assets.length; i++) {
    const shard = shards[i % shardCount];
    shard.count++;
    shard.bytes += assets[i].bytes;
    if (!Number.isSafeInteger(shard.bytes)) throw new Error('Shard byte total exceeds safe integer range');
  }
  const totalBytes = shards.reduce((sum, shard) => sum + shard.bytes, 0);
  if (!Number.isSafeInteger(totalBytes)) throw new Error('Asset byte total exceeds safe integer range');
  const report = {
    schemaVersion: 1,
    purpose: 'manual-review-worklist',
    source: { repository: manifest.source.repository, commit: manifest.source.commit, assetRoot: manifest.source.assetRoot },
    manifestSha256,
    shardCount,
    totalAssets: assets.length,
    totalBytes,
    note: 'Metadata-only worklist; no artwork bytes checked and no public redistribution approved.',
  };
  if (shardIndex === null) return { ...report, shards };
  return {
    ...report,
    shardIndex,
    shard: shards[shardIndex - 1],
    assets: assets.filter((_, index) => index % shardCount === shardIndex - 1),
  };
}

function parseOptions(args) {
  if (args.length !== 4 && args.length !== 6)
    throw new Error('Usage: node scripts/plan-review-shards.mjs --manifest file.json --shards N [--shard K]');
  const values = new Map();
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i];
    if (!['--manifest', '--shards', '--shard'].includes(key) || values.has(key) || !args[i+1])
      throw new Error('Unknown, duplicate or missing option: ' + key);
    values.set(key, args[i + 1]);
  }
  if (!values.has('--manifest') || !values.has('--shards') || (args.length === 6 && !values.has('--shard')))
    throw new Error('Must specify --manifest and --shards, with optional --shard');
  const parseNumber = (value, name) => {
    if (!/^[1-9][0-9]*$/.test(value)) throw new Error('Invalid ' + name + ': ' + value);
    const numeric = Number(value);
    return positiveInteger(numeric, name);
  };
  return {
    file: values.get('--manifest'),
    shardCount: parseNumber(values.get('--shards'), '--shards'),
    shardIndex: values.has('--shard') ? parseNumber(values.get('--shard'), '--shard') : null,
  };
}

function main() {
  const options = parseOptions(process.argv.slice(2));
  const raw = readFileSync(options.file);
  const manifest = JSON.parse(raw.toString('utf8'));
  const manifestSha256 = createHash('sha256').update(raw).digest('hex');
  const report = planReviewShards(manifest, { ...options, manifestSha256 });
  console.log(JSON.stringify(report, null, 2));
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  try { main(); }
  catch (error) { console.error('REVIEW SHARD PLANNING FAILED:', error.message); process.exitCode = 1; }
}
