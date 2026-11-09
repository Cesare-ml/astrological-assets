#!/usr/bin/env node
/**
 * Read-only preflight: ensure a future VirgoStars build will not copy the same
 * chart files twice from legacy public/ and the approved asset pack.
 * This tool never deletes or copies any image.
 */
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const hash = data => createHash('sha256').update(data).digest('hex');

function checkedFile(root, assetPath) {
  if (typeof assetPath !== 'string' || !/^(img|fonts)\//.test(assetPath)
    || assetPath.includes('\\') || assetPath.includes('\0')
    || assetPath.split('/').some(x => !x || x === '.' || x === '..' || x.includes(':')))
    throw new Error('Unsafe asset path: ' + assetPath);
  let current = resolve(root);
  let rootInfo;
  try { rootInfo = lstatSync(current); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
  if (rootInfo.isSymbolicLink() || !rootInfo.isDirectory())
    throw new Error('Unsafe asset root: ' + current);
  for (const part of assetPath.split('/')) {
    current = join(current, part);
    let info;
    try { info = lstatSync(current); }
    catch (error) { if (error.code === 'ENOENT') return null; throw error; }
    if (info.isSymbolicLink()) throw new Error('Symlink forbidden: ' + assetPath);
  }
  if (!lstatSync(current).isFile()) throw new Error('Not a regular asset: ' + assetPath);
  return readFileSync(current);
}

export function inspectWebAssetCollisions({ legacyRoot, packRoot, manifest }) {
  if (!legacyRoot || !packRoot || !manifest || manifest.schemaVersion !== 1
    || !Array.isArray(manifest.assets) || manifest.assets.length === 0) throw new Error('Missing roots or invalid or empty approved manifest');
  const report = {
    schemaVersion: 1,
    approvedCount: manifest.assets.length,
    missingPack: [],
    packMismatches: [],
    legacySame: [],
    legacyDifferent: [],
    packOnly: [],
    verdict: 'blocked',
  };
  const seen = new Set();
  for (const asset of manifest.assets) {
    const path = asset.path;
    if (typeof path !== 'string') throw new Error('Invalid manifest path');
    const folded = path.normalize('NFC').toLowerCase();
    if (seen.has(folded)) throw new Error('Duplicate asset path in manifest: ' + path);
    seen.add(folded);
    if (!/^[0-9a-f]{64}$/.test(asset.sha256) || !Number.isSafeInteger(asset.bytes) || asset.bytes < 0)
      throw new Error('Invalid manifest SHA-256 or size: ' + path);
    if(asset.status!==undefined && asset.status!=='approved') throw new Error('Asset is not approved: '+path);
    for(const field of ['rightsHolder','permissionBasis','approvalEvidence'])
      if(typeof asset[field]!=='string' || !asset[field].trim()) throw new Error('Missing approval metadata '+field+': '+path);
    const pack = checkedFile(packRoot, path);
    if (!pack) { report.missingPack.push(path); continue; }
    if (pack.length !== asset.bytes || hash(pack) !== asset.sha256) {
      report.packMismatches.push(path); continue;
    }
    const legacy = checkedFile(legacyRoot, path);
    if (!legacy) report.packOnly.push(path);
    else if (hash(legacy) === asset.sha256 && legacy.length === asset.bytes)
      report.legacySame.push(path);
    else report.legacyDifferent.push(path);
  }
  report.verdict = report.missingPack.length || report.packMismatches.length || report.legacyDifferent.length
    ? 'blocked' : report.legacySame.length ? 'needs-exclusion' : 'disjoint';
  return report;
}

function main(args) {
  const flags = {};
  for (let i = 0; i < args.length; i += 2) {
    const name = args[i], value = args[i + 1];
    if (!['--legacy', '--pack', '--manifest', '--out'].includes(name) || !value || flags[name])
      throw new Error('Usage: --legacy ../virgo-stars/public/assets --pack public/assets --manifest manifests/approved-assets.json [--out report.local.json]');
    flags[name] = value;
  }
  if (!flags['--legacy'] || !flags['--pack'] || !flags['--manifest'])
    throw new Error('Missing --legacy, --pack or --manifest');
  const manifest = JSON.parse(readFileSync(flags['--manifest'], 'utf8'));
  const report = inspectWebAssetCollisions({
    legacyRoot: flags['--legacy'], packRoot: flags['--pack'], manifest,
  });
  const output = JSON.stringify(report, null, 2) + '\n';
  if (flags['--out']) writeFileSync(flags['--out'], output);
  console.log(output);
  if (report.verdict === 'blocked') process.exitCode = 2;
  else if (report.verdict === 'needs-exclusion') process.exitCode = 3;
}
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  try { main(process.argv.slice(2)); }
  catch (error) { console.error('ASSET COLLISION GUARD FAILED:', error.message); process.exitCode = 1; }
}
