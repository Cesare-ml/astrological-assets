#!/usr/bin/env node
// Prepare a PENDING worksheet only. The owner must make actual licensing decisions.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateAssetPath } from './import-approved-assets.mjs';

export function preparePublicationReview(manifest) {
  if (manifest?.schemaVersion !== 1 || !Array.isArray(manifest.assets) || manifest.assets.length === 0)
    throw new Error('Expected a nonempty version 1 approved asset manifest');
  const keys = new Set();
  const assets = manifest.assets.map(a => {
    validateAssetPath(a.path);
    const key = a.path.normalize('NFC').toLowerCase();
    if (keys.has(key)) throw new Error('Duplicate/case-colliding asset path: ' + a.path);
    keys.add(key);
    if (!/^[a-f0-9]{64}$/.test(a.sha256 || '')) throw new Error('Invalid SHA-256: ' + a.path);
    return {
      path: a.path,
      sha256: a.sha256,
      status: 'pending',
      permissionScope: 'not-yet-granted',
      licenseId: '',
      rightsHolder: '',
      publicApprovalEvidence: '',
      thirdPartyReview: '',
      authorClaimReference: 'catalog/owner-authorship.json',
    };
  });
  assets.sort((a,b) => a.path.localeCompare(b.path));
  return {
    schemaVersion: 1,
    purpose: 'Human review worksheet only — this is NOT a public license grant.',
    sourceManifest: 'manifests/approved-assets.json',
    assets
  };
}

function main() {
  const args = process.argv.slice(2);
  if (args.length !== 2 || args[0] !== '--out' || !args[1].endsWith('.local.json'))
    throw new Error('Usage: node scripts/prepare-publication-review.mjs --out ./artwork-review.local.json');
  const manifest = JSON.parse(readFileSync(resolve(process.cwd(), 'manifests/approved-assets.json'), 'utf8'));
  const result = preparePublicationReview(manifest);
  const path = resolve(args[1]);
  writeFileSync(path, JSON.stringify(result,null,2) + '\n', {flag:'wx'});
  console.log('Wrote ' + result.assets.length + ' PENDING records to ' + path + '. No public rights granted.');
}
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  try { main(); } catch (e) { console.error('REVIEW GENERATION FAILED:',e.message); process.exitCode=1; }
}
