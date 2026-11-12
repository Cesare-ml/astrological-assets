#!/usr/bin/env node
// Fail-closed, read-only preflight for a future public image release.
// Private-use approvals do not count. Metadata checks do not certify legal rights.
import { readFileSync, readdirSync, lstatSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateAssetPath } from './import-approved-assets.mjs';
import { verifyPack } from './verify-pack.mjs';

function checkedPath(value) {
  if (typeof value !== 'string') throw new Error('Invalid asset path');
  validateAssetPath(value);
  return value.normalize('NFC').toLowerCase();
}

export function assessPublicRelease(manifest, publication, assetPaths = [], licenseDecision, manifestGitBlobSha) {
  if (manifest?.schemaVersion !== 1 || !Array.isArray(manifest.assets) || !manifest.assets.length) {
    throw new Error('Expected a nonempty version 1 asset manifest');
  }
  if (publication?.schemaVersion !== 1 || !Array.isArray(publication.assets)) {
    throw new Error('Expected a version 1 public publication approvals file');
  }
  if (!Array.isArray(assetPaths)) throw new Error('Expected a list of pack file paths');
  // Owner-level license choice is necessary, but cannot by itself clear a complete image.
  if (licenseDecision?.schemaVersion !== 1 ||
      licenseDecision.decisionStatus !== 'owner-selected-policy' ||
      licenseDecision.licenseId !== 'CC-BY-4.0' ||
      licenseDecision.requiresPerFileClearance !== true ||
      licenseDecision.scope?.manifest !== 'manifests/approved-assets.json') {
    throw new Error('Missing or inconsistent owner-selected artwork license policy');
  }
  if (!/^[a-f0-9]{40}$/.test(manifestGitBlobSha || '') ||
      licenseDecision.scope.manifestGitBlobSha !== manifestGitBlobSha ||
      licenseDecision.scope.expectedAssetCount !== manifest.assets.length) {
    throw new Error('Owner artwork license policy is not pinned to the current manifest');
  }

  const manifestByPath = new Map();
  for (const asset of manifest.assets) {
    const key = checkedPath(asset.path);
    if (manifestByPath.has(key)) throw new Error('Duplicate/case-colliding manifest path: ' + asset.path);
    if (!/^[0-9a-f]{64}$/.test(asset.sha256 || '')) throw new Error('Invalid manifest SHA-256: ' + asset.path);
    manifestByPath.set(key, asset);
  }

  const publicByPath = new Map();
  for (const asset of publication.assets) {
    const key = checkedPath(asset.path);
    if (publicByPath.has(key)) throw new Error('Duplicate/case-colliding public approval: ' + asset.path);
    publicByPath.set(key, asset);
  }

  const issues = [];
  let cleared = 0;
  for (const [key, item] of manifestByPath) {
    const record = publicByPath.get(key);
    if (!record) {
      issues.push('Missing explicit public approval: ' + item.path);
      continue;
    }
    const requiredText = ['licenseId', 'rightsHolder', 'publicApprovalEvidence', 'thirdPartyReview'];
    const valid = record.path === item.path &&
      record.sha256 === item.sha256 &&
      record.status === 'approved' &&
      record.permissionScope === 'public-redistribution' &&
      record.licenseId === licenseDecision.licenseId &&
      record.thirdPartyStatus === 'cleared' &&
      requiredText.every(field => typeof record[field] === 'string' && record[field].trim() !== '') &&
      /^[a-zA-Z0-9.+-]+$/.test(record.licenseId || '');
    if (!valid) {
      issues.push('Invalid/mismatched public license evidence: ' + item.path);
      continue;
    }
    cleared++;
  }

  for (const [key, record] of publicByPath) {
    if (!manifestByPath.has(key)) issues.push('Stale approval for unlisted asset: ' + record.path);
  }
  const packPaths = new Set();
  for (const path of assetPaths) {
    const key = checkedPath(path);
    if (packPaths.has(key)) issues.push('Case-colliding pack file: ' + path);
    packPaths.add(key);
    if (!manifestByPath.has(key)) issues.push('Pack file missing from manifest: ' + path);
  }
  for (const [key, asset] of manifestByPath) {
    if (!packPaths.has(key)) issues.push('Manifest file not present in pack: ' + asset.path);
  }

  return {
    ready: issues.length === 0,
    totalAssets: manifestByPath.size,
    publicApprovals: cleared,
    blockedAssets: manifestByPath.size - cleared,
    totalIssues: issues.length,
    issues,
  };
}

export function listPackFiles(root) {
  const result = [];
  function visit(dir, prefix) {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      const stat = lstatSync(full);
      if (stat.isSymbolicLink()) throw new Error('Symlinks forbidden in public pack: ' + full);
      const rel = prefix ? prefix + '/' + name : name;
      if (stat.isDirectory()) visit(full, rel);
      else if (stat.isFile()) result.push(rel);
      else throw new Error('Unsupported file in public pack: ' + full);
    }
  }
  if (lstatSync(root).isSymbolicLink()) throw new Error('Symlink pack root forbidden');
  visit(root, '');
  return result.sort();
}

function main() {
  const root = resolve(process.cwd(), 'public/assets');
  const manifestPath = resolve(process.cwd(), 'manifests/approved-assets.json');
  const publicPath = resolve(process.cwd(), 'catalog/publication-approvals.json');
  const rawManifest = readFileSync(manifestPath);
  const manifest = JSON.parse(rawManifest.toString('utf8'));
  // Git's blob SHA anchors the owner's decision to exact checked manifest bytes.
  const manifestGitBlobSha = createHash('sha1')
    .update('blob ' + rawManifest.length + '\0').update(rawManifest).digest('hex');
  const publicApprovals = JSON.parse(readFileSync(publicPath, 'utf8'));
  const licenseDecision = JSON.parse(readFileSync(resolve(process.cwd(), 'catalog/artwork-license-decision.json'), 'utf8'));
  const result = assessPublicRelease(manifest, publicApprovals, listPackFiles(root), licenseDecision, manifestGitBlobSha);
  // Integrity is necessary but not sufficient: does not certify license ownership.
  const pack = verifyPack(root, manifest);
  console.log(JSON.stringify({
    ready: result.ready,
    manifestImages: result.totalAssets,
    explicitPublicApprovals: result.publicApprovals,
    imagesStillBlocked: result.blockedAssets,
    issueCount: result.totalIssues,
    firstIssues: result.issues.slice(0, 12),
    verifiedPackFiles: pack.verified,
    artworkLicense: licenseDecision.licenseId,
    note: 'Current files only. Review historical Git objects and actual legal evidence separately.',
  }, null, 2));
  if (!result.ready) process.exitCode = 2;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  try { main(); }
  catch (err) { console.error('PUBLIC RELEASE PREFLIGHT ERROR:', err.message); process.exitCode = 1; }
}
