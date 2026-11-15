#!/usr/bin/env node
// Read-only raster header and manifest integrity preflight. Not an image decoder or rights review.
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateAssetPath } from './import-approved-assets.mjs';

const PNG_MAGIC = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const BIT_DEPTHS = new Map([
  [0, [1, 2, 4, 8, 16]], [2, [8, 16]], [3, [1, 2, 4, 8]],
  [4, [8, 16]], [6, [8, 16]],
]);

export function assertRasterHeader(bytes, assetPath) {
  if (!Buffer.isBuffer(bytes)) throw new Error('Expected image bytes');
  const extension = assetPath.toLowerCase().split('.').pop();
  if (extension === 'png') {
    if (bytes.length < 33 || !bytes.subarray(0, 8).equals(PNG_MAGIC) ||
        bytes.readUInt32BE(8) !== 13 || bytes.toString('ascii', 12, 16) !== 'IHDR' ||
        bytes.readUInt32BE(16) === 0 || bytes.readUInt32BE(20) === 0 ||
        !BIT_DEPTHS.get(bytes[25])?.includes(bytes[24]) ||
        bytes[26] !== 0 || bytes[27] !== 0 || bytes[28] > 1)
      throw new Error('Invalid PNG signature/IHDR: ' + assetPath);
    return 'png';
  }
  if (extension === 'jpg' || extension === 'jpeg') {
    if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8 ||
        bytes[2] !== 0xff || bytes[3] === 0x00 || bytes[3] === 0xd8)
      throw new Error('Invalid JPEG SOI/marker: ' + assetPath);
    return 'jpeg';
  }
  if (extension === 'webp') {
    if (bytes.length < 21 || bytes.toString('ascii', 0, 4) !== 'RIFF' ||
        bytes.toString('ascii', 8, 12) !== 'WEBP' ||
        !['VP8 ', 'VP8L', 'VP8X'].includes(bytes.toString('ascii', 12, 16)) ||
        bytes.readUInt32LE(4) + 8 !== bytes.length ||
        bytes.readUInt32LE(16) === 0 ||
        bytes.readUInt32LE(16) + 20 > bytes.length)
      throw new Error('Invalid WebP RIFF/chunk header: ' + assetPath);
    return 'webp';
  }
  throw new Error('Unsupported raster extension: ' + assetPath);
}

function rejectSymlinkAncestors(path) {
  let current = resolve(path);
  for (;;) {
    let stat;
    try { stat = lstatSync(current); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (stat?.isSymbolicLink()) throw new Error('Symlink in asset root: ' + current);
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
}

export function inspectRasterHeaders({ root, manifest }) {
  if (!root || manifest?.schemaVersion !== 1 ||
      !Array.isArray(manifest.assets) || manifest.assets.length === 0)
    throw new Error('Asset root and a nonempty version 1 manifest are required');

  const base = resolve(root);
  rejectSymlinkAncestors(base);
  if (!lstatSync(base).isDirectory()) throw new Error('Asset root is not a directory');

  const seen = new Set(), formats = { png: 0, jpeg: 0, webp: 0 };
  let bytesChecked = 0;
  for (const record of manifest.assets) {
    const path = validateAssetPath(record?.path);
    const folded = path.normalize('NFC').toLowerCase();
    if (seen.has(folded)) throw new Error('Duplicate/case-colliding asset path: ' + path);
    seen.add(folded);
    if (record.status !== undefined && record.status !== 'approved')
      throw new Error('Asset is not approved for the manifest purpose: ' + path);
    if (!Number.isSafeInteger(record.bytes) || record.bytes < 0 ||
        !/^[a-f0-9]{64}$/.test(record.sha256))
      throw new Error('Invalid manifest size or SHA-256: ' + path);

    const parts = path.split('/');
    let file = base;
    for (const [index, part] of parts.entries()) {
      file = join(file, part);
      const stat = lstatSync(file);
      if (stat.isSymbolicLink()) throw new Error('Symlink forbidden in asset path: ' + path);
      if (index < parts.length - 1 && !stat.isDirectory())
        throw new Error('Non-directory asset ancestor: ' + path);
      if (index === parts.length - 1 && (!stat.isFile() || stat.size !== record.bytes))
        throw new Error('Asset file/size mismatch: ' + path);
    }
    const bytes = readFileSync(file);
    if (bytes.length !== record.bytes ||
        createHash('sha256').update(bytes).digest('hex') !== record.sha256)
      throw new Error('Asset checksum mismatch: ' + path);
    formats[assertRasterHeader(bytes, path)]++;
    bytesChecked += bytes.length;
  }
  return { schemaVersion: 1, verdict: 'verified', assetsChecked: seen.size, bytesChecked, formats,
    note: 'Only signatures and basic headers are checked, not full image decoding or redistribution rights.' };
}

function main(args) {
  if (args.length !== 4 || args[0] !== '--root' || args[2] !== '--manifest')
    throw new Error('Usage: node scripts/check-raster-headers.mjs --root public/assets --manifest manifests/approved-assets.json');
  const manifest = JSON.parse(readFileSync(args[3], 'utf8'));
  console.log(JSON.stringify(inspectRasterHeaders({ root: args[1], manifest }), null, 2));
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  try { main(process.argv.slice(2)); }
  catch (error) { console.error('RASTER HEADER PREFLIGHT FAILED:', error.message); process.exitCode = 1; }
}
