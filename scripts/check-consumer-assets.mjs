#!/usr/bin/env node
/**
 * Read-only preflight for an explicitly enumerated consumer/offline asset subset.
 * A private pack manifest is NOT evidence of public redistribution rights.
 */
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ALLOWED_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.svg', '.gif', '.avif', '.bmp', '.ico', '.woff', '.woff2', '.ttf', '.otf', '.json']);
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

function checkedPath(value) {
  if (typeof value !== 'string' || !value || value.startsWith('/') || value.includes('\\') || /[\x00-\x1f\x7f]/.test(value))
    throw new Error('Unsafe asset path: ' + String(value));
  const parts = value.split('/');
  if (parts.length < 2 || !['img', 'fonts'].includes(parts[0]) || parts.some(part => !part || part === '.' || part === '..' || part.includes(':')))
    throw new Error('Unsafe asset path: ' + value);
  const ext = extname(value).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext) || (ext === '.json' && parts[0] !== 'fonts'))
    throw new Error('Unsupported asset type: ' + value);
  return value;
}

function foldedPath(path) { return path.normalize('NFC').toLowerCase(); }

function assertRealDirectory(root) {
  let current = root;
  while (true) {
    const info = lstatSync(current);
    if (info.isSymbolicLink()) throw new Error('Symlink in pack root: ' + current);
    if (current === root && !info.isDirectory()) throw new Error('Pack root is not a directory: ' + root);
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
}

function readCheckedAsset(root, relativePath) {
  let current = root;
  const segments = relativePath.split('/');
  for (let i = 0; i < segments.length; i++) {
    current = join(current, segments[i]);
    let info;
    try { info = lstatSync(current); }
    catch (error) { if (error.code === 'ENOENT') return null; throw error; }
    if (info.isSymbolicLink()) throw new Error('Symlink in requested asset: ' + relativePath);
    if (i < segments.length - 1 && !info.isDirectory()) throw new Error('Non-directory ancestor of asset: ' + relativePath);
    if (i === segments.length - 1 && !info.isFile()) throw new Error('Non-regular requested asset: ' + relativePath);
  }
  return readFileSync(current);
}

export function inspectConsumerAssets({ assetRoot, manifest, requirements }) {
  if (!assetRoot || !manifest || manifest.schemaVersion !== 1 || !Array.isArray(manifest.assets) || !manifest.assets.length)
    throw new Error('Pack root and nonempty approved manifest are required');
  if (!requirements || requirements.schemaVersion !== 1 || typeof requirements.consumer !== 'string' ||
      !requirements.consumer.trim() || requirements.consumer.length > 128 || /[\x00-\x1f\x7f]/.test(requirements.consumer) ||
      !Array.isArray(requirements.assets) || !requirements.assets.length)
    throw new Error('Requirements must specify a consumer and nonempty asset path list');

  const root = resolve(assetRoot);
  assertRealDirectory(root);
  const approved = new Map(), manifestFolded = new Set();
  for (const entry of manifest.assets) {
    const path = checkedPath(entry?.path), key = foldedPath(path);
    if (manifestFolded.has(key)) throw new Error('Duplicate or case-colliding manifest asset: ' + path);
    manifestFolded.add(key);
    if (entry.status !== undefined && entry.status !== 'approved') throw new Error('Unapproved manifest asset: ' + path);
    if (!Number.isSafeInteger(entry.bytes) || entry.bytes < 0 || !/^[a-f0-9]{64}$/.test(entry.sha256))
      throw new Error('Invalid manifest size or hash: ' + path);
    for (const field of ['rightsHolder', 'permissionBasis', 'approvalEvidence']) {
      if (typeof entry[field] !== 'string' || !entry[field].trim())
        throw new Error('Missing private approval metadata ' + field + ': ' + path);
    }
    approved.set(path, entry);
  }

  const requested = new Set(), seenFolded = new Set();
  for (const value of requirements.assets) {
    const path = checkedPath(value), key = foldedPath(path);
    if (seenFolded.has(key)) throw new Error('Duplicate or case-colliding requested asset: ' + path);
    seenFolded.add(key);
    requested.add(path);
  }

  const verified = [], missingFromManifest = [], missingFromPack = [], mismatched = [];
  let totalBytes = 0;
  for (const path of [...requested].sort()) {
    const record = approved.get(path);
    if (!record) { missingFromManifest.push(path); continue; }
    const bytes = readCheckedAsset(root, path);
    if (bytes === null) { missingFromPack.push(path); continue; }
    if (bytes.length !== record.bytes || sha256(bytes) !== record.sha256) {
      mismatched.push(path); continue;
    }
    if (!Number.isSafeInteger(totalBytes + bytes.length)) throw new Error('Selected asset byte count exceeds safe integer range');
    totalBytes += bytes.length;
    verified.push({ path, bytes: record.bytes, sha256: record.sha256 });
  }
  return {
    schemaVersion: 1,
    consumer: requirements.consumer.trim(),
    manifestSourceCommit: manifest.source?.commit ?? null,
    requestedCount: requested.size,
    verifiedCount: verified.length,
    totalVerifiedBytes: totalBytes,
    verified,
    missingFromManifest,
    missingFromPack,
    mismatched,
    verdict: missingFromManifest.length || missingFromPack.length || mismatched.length ? 'blocked' : 'verified',
    caveat: 'Integrity of the requested local files only; no public artwork or font redistribution authorization is implied.',
  };
}

function main(args) {
  if (args.length !== 6 || args[0] !== '--root' || args[2] !== '--manifest' || args[4] !== '--requirements')
    throw new Error('Usage: node scripts/check-consumer-assets.mjs --root public/assets --manifest manifests/approved-assets.json --requirements private-requirements.json');
  const report = inspectConsumerAssets({
    assetRoot: args[1],
    manifest: JSON.parse(readFileSync(args[3], 'utf8')),
    requirements: JSON.parse(readFileSync(args[5], 'utf8')),
  });
  console.log(JSON.stringify(report, null, 2));
  if (report.verdict === 'blocked') process.exitCode = 2;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  try { main(process.argv.slice(2)); }
  catch (error) { console.error('CONSUMER ASSET PREFLIGHT FAILED:', error.message); process.exitCode = 1; }
}
