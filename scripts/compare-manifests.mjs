#!/usr/bin/env node
/**
 * Read-only, fail-closed comparison of two *private-use* approved-asset manifests.
 * A matching manifest does NOT grant public redistribution permission.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateAssetPath } from './import-approved-assets.mjs';

function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object')
    return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
  return JSON.stringify(value);
}

function indexManifest(manifest, label) {
  if (manifest?.schemaVersion !== 1 || !Array.isArray(manifest.assets) || manifest.assets.length === 0)
    throw new Error(label + ': expected nonempty version 1 asset manifest');
  if (typeof manifest.source?.repository !== 'string' || !manifest.source.repository.trim() ||
      !/^[a-f0-9]{40}$/.test(manifest.source.commit || '') ||
      manifest.source.assetRoot !== 'public/assets')
    throw new Error(label + ': invalid source provenance');

  const paths = new Map();
  const folded = new Set();
  for (const asset of manifest.assets) {
    validateAssetPath(asset?.path);
    const key = asset.path.normalize('NFC').toLowerCase();
    if (folded.has(key)) throw new Error(label + ': duplicate or case/Unicode-colliding asset: ' + asset.path);
    folded.add(key);
    if (!Number.isSafeInteger(asset.bytes) || asset.bytes < 0 || !/^[a-f0-9]{64}$/.test(asset.sha256 || ''))
      throw new Error(label + ': invalid size or SHA-256: ' + asset.path);
    if (asset.gitBlobSha !== undefined && !/^[a-f0-9]{40}$/.test(asset.gitBlobSha))
      throw new Error(label + ': invalid source Git blob: ' + asset.path);
    if (asset.status !== undefined && asset.status !== 'approved')
      throw new Error(label + ': unapproved private-use record: ' + asset.path);
    for (const field of ['rightsHolder', 'permissionBasis', 'approvalEvidence'])
      if (typeof asset[field] !== 'string' || !asset[field].trim())
        throw new Error(label + ': missing ' + field + ': ' + asset.path);
    paths.set(asset.path, asset);
  }
  const { assets: _ignored, ...header } = manifest;
  return { paths, header: canonical(header) };
}

const byPath = (a, b) => a < b ? -1 : a > b ? 1 : 0;

/**
 * Metadata-only diff: no filesystem, image, or permission mutations.
 * The report intentionally excludes approval evidence and other metadata values.
 */
export function compareAssetManifests(before, after) {
  const old = indexManifest(before, 'before');
  const next = indexManifest(after, 'after');
  const added = [...next.paths.keys()].filter(path => !old.paths.has(path)).sort(byPath);
  const removed = [...old.paths.keys()].filter(path => !next.paths.has(path)).sort(byPath);
  const modified = [];
  for (const path of [...old.paths.keys()].filter(path => next.paths.has(path)).sort(byPath)) {
    const a = old.paths.get(path), b = next.paths.get(path);
    const changes = [];
    if (a.sha256 !== b.sha256) changes.push('sha256');
    if (a.bytes !== b.bytes) changes.push('bytes');
    const { path: _ap, sha256: _ah, bytes: _ab, ...aMetadata } = a;
    const { path: _bp, sha256: _bh, bytes: _bb, ...bMetadata } = b;
    if (canonical(aMetadata) !== canonical(bMetadata)) changes.push('metadata');
    if (changes.length) modified.push({ path, changes });
  }
  const topLevelChanged = old.header !== next.header;
  const changed = topLevelChanged || added.length > 0 || removed.length > 0 || modified.length > 0;
  return {
    schemaVersion: 1,
    changed,
    summary: {
      before: old.paths.size, after: next.paths.size,
      added: added.length, removed: removed.length, modified: modified.length,
      topLevelChanged,
    },
    added, removed, modified,
    note: 'Metadata diff only; no asset bytes checked and no public redistribution rights implied.',
  };
}

function main(argv) {
  if (argv.length !== 4 || !['--before', '--after'].includes(argv[0]) ||
      !['--before', '--after'].includes(argv[2]) || argv[0] === argv[2] || !argv[1] || !argv[3])
    throw new Error('Usage: node scripts/compare-manifests.mjs --before old.json --after new.json');
  const opts = { [argv[0]]: argv[1], [argv[2]]: argv[3] };
  const before = JSON.parse(readFileSync(opts['--before'], 'utf8'));
  const after = JSON.parse(readFileSync(opts['--after'], 'utf8'));
  const report = compareAssetManifests(before, after);
  console.log(JSON.stringify(report, null, 2));
  if (report.changed) process.exitCode = 2;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  try { main(process.argv.slice(2)); }
  catch (error) { console.error('MANIFEST COMPARISON ERROR:', error.message); process.exitCode = 1; }
}
