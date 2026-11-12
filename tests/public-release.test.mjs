import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assessPublicRelease } from '../scripts/check-public-release.mjs';

const path = 'img/simboli-bianchi/segni/01.png';
const sha256 = 'a'.repeat(64);
const manifestSha = 'b'.repeat(40);
const manifest = {
  schemaVersion: 1,
  assets: [{ path, sha256, bytes: 42, rightsHolder: 'Private owner',
    permissionBasis: 'Private collaboration only', approvalEvidence: 'Private attestation' }],
};
const policy = {
  schemaVersion: 1, decisionStatus: 'owner-selected-policy',
  licenseId: 'CC-BY-4.0', requiresPerFileClearance: true,
  scope: {
    manifest: 'manifests/approved-assets.json',
    manifestGitBlobSha: manifestSha,
    expectedAssetCount: 1,
  },
};
const publicRecord = {
  path, sha256, status: 'approved', permissionScope: 'public-redistribution',
  licenseId: 'CC-BY-4.0', rightsHolder: 'Verified author',
  publicApprovalEvidence: 'Owner-reviewed public redistribution authorization',
  thirdPartyStatus: 'cleared',
  thirdPartyReview: 'Original drawing, no external font, textures or source artwork',
};
const assess = (m, p, files) => assessPublicRelease(m, p, files, policy, manifestSha);

test('owner policy does not automatically clear private artwork', () => {
  const r = assess(manifest, { schemaVersion: 1, assets: [] }, [path]);
  assert.equal(r.ready, false);
  assert.equal(r.blockedAssets, 1);
  assert.match(r.issues[0], /Missing explicit public approval/);
});

test('explicit matching CC BY 4.0 and cleared third-party rights pass the metadata gate', () => {
  const r = assess(manifest, { schemaVersion: 1, assets: [publicRecord] }, [path]);
  assert.equal(r.ready, true);
  assert.equal(r.publicApprovals, 1);
  assert.equal(r.totalIssues, 0);
});

test('wrong license, unreviewed third-party inputs and stale SHA-256 fail closed', () => {
  const variants = [
    { ...publicRecord, licenseId: 'CC0-1.0' },
    { ...publicRecord, thirdPartyStatus: 'pending' },
    { ...publicRecord, thirdPartyStatus: undefined },
    { ...publicRecord, thirdPartyReview: '' },
    { ...publicRecord, permissionScope: 'private-sharing' },
    { ...publicRecord, sha256: 'c'.repeat(64) },
    { ...publicRecord, status: 'pending' },
  ];
  for (const record of variants) {
    const r = assess(manifest, { schemaVersion: 1, assets: [record] }, [path]);
    assert.equal(r.ready, false, JSON.stringify(record));
    assert.equal(r.blockedAssets, 1);
  }
});

test('missing, modified or unpinned owner policy fails closed', () => {
  const pub = { schemaVersion: 1, assets: [publicRecord] };
  assert.throws(() => assessPublicRelease(manifest, pub, [path]), /owner-selected artwork license policy/);
  assert.throws(() => assessPublicRelease(manifest, pub, [path],
    { ...policy, licenseId: 'CC-BY-SA-4.0' }, manifestSha), /owner-selected artwork license policy/);
  assert.throws(() => assessPublicRelease(manifest, pub, [path],
    policy, 'c'.repeat(40)), /not pinned/);
  assert.throws(() => assessPublicRelease(manifest, pub, [path],
    { ...policy, scope: { ...policy.scope, expectedAssetCount: 2 } }, manifestSha), /not pinned/);
});

test('unlisted binaries and stale publication approvals fail closed', () => {
  const r = assess(manifest, { schemaVersion: 1, assets: [publicRecord,
    { ...publicRecord, path: 'img/other.png' }] }, [path, 'img/unlisted.png']);
  assert.equal(r.ready, false);
  assert.ok(r.issues.some(x => x.includes('unlisted')));
  assert.ok(r.issues.some(x => x.includes('Stale approval')));
});

test('case collisions, malformed register and missing pack files are rejected', () => {
  assert.throws(() => assess(manifest, { schemaVersion: 0, assets: [] }, [path]), /version 1/);
  assert.throws(() => assess(manifest, { schemaVersion: 1, assets: [publicRecord,
    { ...publicRecord, path: path.toUpperCase() }] }, [path]), /case-colliding public approval/);
  const r = assess(manifest, { schemaVersion: 1, assets: [publicRecord] }, []);
  assert.equal(r.ready, false);
  assert.match(r.issues[0], /Manifest file not present/);
});
