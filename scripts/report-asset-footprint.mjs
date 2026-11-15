#!/usr/bin/env node
// Read-only capacity planning from private-approved asset MANIFEST METADATA.
// No file bytes are read: this is not a hash, rights, or publication verification.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateAssetPath } from './import-approved-assets.mjs';

const DEFAULT_MANIFEST = fileURLToPath(new URL('../manifests/approved-assets.json', import.meta.url));

function checkedAdd(a, b) {
  const sum = a + b;
  if (!Number.isSafeInteger(sum)) throw new Error('Asset byte totals exceed safe integer precision');
  return sum;
}

function normalizedPrefix(prefix) {
  if (prefix === null || prefix === undefined) return null;
  if (typeof prefix !== 'string' || !prefix || prefix.endsWith('//')) throw new Error('Unsafe asset prefix');
  const clean = prefix.endsWith('/') ? prefix.slice(0, -1) : prefix;
  // Reuse the importer path contract; a prefix must be a complete directory boundary.
  validateAssetPath(`${clean}/placeholder.png`);
  return clean;
}

function familyFor(path) {
  const parts = path.split('/');
  if (parts[0] === 'img' && parts[1] === 'grafici' && parts.length >= 4)
    return parts.slice(0, 3).join('/');
  return parts.length >= 3 ? parts.slice(0, 2).join('/') : parts[0];
}

function collect(entries) {
  const blobs = new Map();
  let logicalBytes = 0;
  for (const entry of entries) {
    logicalBytes = checkedAdd(logicalBytes, entry.bytes);
    if (!blobs.has(entry.sha256)) blobs.set(entry.sha256, entry.bytes);
  }
  let uniqueBytes = 0;
  for (const size of blobs.values()) uniqueBytes = checkedAdd(uniqueBytes, size);
  return {
    assetCount: entries.length,
    logicalBytes,
    uniqueBlobCount: blobs.size,
    uniqueBytes,
    potentialDedupBytes: logicalBytes - uniqueBytes
  };
}

/** Report metadata-only storage footprint. Does NOT certify file bytes or usage rights. */
export function reportAssetFootprint(manifest, { prefix = null } = {}) {
  if (!manifest || manifest.schemaVersion !== 1 || !Array.isArray(manifest.assets) ||
      manifest.assets.length === 0 || manifest.source?.assetRoot !== 'public/assets')
    throw new Error('Invalid or empty approved assets manifest');
  const selectedPrefix = normalizedPrefix(prefix);
  const seenPaths = new Set();
  const shaSizes = new Map();
  const selected = [];
  for (const item of manifest.assets) {
    if (!item || typeof item !== 'object') throw new Error('Invalid asset record');
    validateAssetPath(item.path);
    const folded = item.path.normalize('NFC').toLowerCase();
    if (seenPaths.has(folded)) throw new Error('Duplicate or case-colliding asset: ' + item.path);
    seenPaths.add(folded);
    if (!Number.isSafeInteger(item.bytes) || item.bytes < 0 || !/^[a-f0-9]{64}$/.test(item.sha256))
      throw new Error('Invalid hash or size for ' + item.path);
    if (item.status !== undefined && item.status !== 'approved')
      throw new Error('Asset is not private-approved: ' + item.path);
    for (const field of ['rightsHolder', 'permissionBasis', 'approvalEvidence']) {
      if (typeof item[field] !== 'string' || !item[field].trim())
        throw new Error('Missing private approval metadata ' + field + ' for ' + item.path);
    }
    if (shaSizes.has(item.sha256) && shaSizes.get(item.sha256) !== item.bytes)
      throw new Error('Conflicting byte sizes for identical SHA-256');
    shaSizes.set(item.sha256, item.bytes);
    if (selectedPrefix === null || item.path.startsWith(`${selectedPrefix}/`)) selected.push(item);
  }
  if (selected.length === 0) throw new Error('No assets match the requested prefix');
  const grouped = new Map();
  for (const asset of selected) {
    const family = familyFor(asset.path);
    if (!grouped.has(family)) grouped.set(family, []);
    grouped.get(family).push(asset);
  }
  return {
    schemaVersion: 1,
    source: { repository: manifest.source.repository, commit: manifest.source.commit },
    selection: { prefix: selectedPrefix },
    totals: collect(selected),
    families: [...grouped].sort(([a], [b]) => a.localeCompare(b, 'en')).map(([family, assets]) => ({
      family, ...collect(assets)
    })),
    notice: 'Manifest metadata only; potential deduplication assumes content-addressed storage. Verify actual bytes and licensing separately before packaging or release.'
  };
}

function main(args) {
  let manifestPath = DEFAULT_MANIFEST, prefix = null;
  const used = new Set();
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i], value = args[i + 1];
    if (!['--manifest', '--prefix'].includes(key) || used.has(key) || !value || value.startsWith('--'))
      throw new Error('Usage: node scripts/report-asset-footprint.mjs [--manifest file.json] [--prefix img/family/]');
    used.add(key);
    if (key === '--manifest') manifestPath = value;
    else prefix = value;
  }
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  console.log(JSON.stringify(reportAssetFootprint(manifest, { prefix }), null, 2));
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  try { main(process.argv.slice(2)); }
  catch (error) { console.error('ASSET FOOTPRINT FAILED:', error.message); process.exitCode = 1; }
}
