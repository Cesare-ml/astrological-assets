import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assessPublicRelease } from '../scripts/check-public-release.mjs';

const path = 'img/simboli-bianchi/segni/01.png';
const sha256 = 'a'.repeat(64);
const manifest = {
  schemaVersion: 1,
  assets: [{ path, sha256, bytes: 42, rightsHolder: 'Private owner',
    permissionBasis: 'Private collaboration only', approvalEvidence: 'Private attestation' }],
};
const publicRecord = {
  path, sha256, status: 'approved', permissionScope: 'public-redistribution',
  licenseId: 'CC-BY-4.0', rightsHolder: 'Verified author',
  publicApprovalEvidence: 'Owner-signed public reuse record #42',
  thirdPartyReview: 'Original drawing; no external font or artwork',
};

test('empty public-rights register blocks privately approved images', () => {
  const r = assessPublicRelease(manifest, { schemaVersion: 1, assets: [] }, [path]);
  assert.equal(r.ready, false);
  assert.equal(r.blockedAssets, 1);
  assert.match(r.issues[0], /Missing explicit public approval/);
});

test('one explicit matching public license can pass the metadata gate', () => {
  const r = assessPublicRelease(manifest, { schemaVersion: 1, assets: [publicRecord] }, [path]);
  assert.equal(r.ready, true);
  assert.equal(r.publicApprovals, 1);
  assert.equal(r.totalIssues, 0);
});

test('private-only scope, stale hash and missing third-party review are blocked', () => {
  for (const record of [
    { ...publicRecord, permissionScope: 'private-sharing' },
    { ...publicRecord, sha256: 'b'.repeat(64) },
    { ...publicRecord, thirdPartyReview: '' },
    { ...publicRecord, status: 'pending' },
  ]) {
    const r = assessPublicRelease(manifest, { schemaVersion: 1, assets: [record] }, [path]);
    assert.equal(r.ready, false);
    assert.equal(r.blockedAssets, 1);
  }
});

test('unlisted binaries and stale publication approvals fail closed', () => {
  const r = assessPublicRelease(manifest, { schemaVersion: 1, assets: [publicRecord,
    { ...publicRecord, path: 'img/other.png' }] }, [path, 'img/unlisted.png']);
  assert.equal(r.ready, false);
  assert.ok(r.issues.some(x => x.includes('unlisted')));
  assert.ok(r.issues.some(x => x.includes('Stale approval')));
});

test('case collisions, malformed ledger and missing pack files are rejected', () => {
  assert.throws(() => assessPublicRelease(manifest, { schemaVersion: 0, assets: [] }, [path]), /version 1/);
  assert.throws(() => assessPublicRelease(manifest, { schemaVersion: 1, assets: [publicRecord,
    { ...publicRecord, path: path.toUpperCase() }] }, [path]), /case-colliding public approval/);
  const r = assessPublicRelease(manifest, { schemaVersion: 1, assets: [publicRecord] }, []);
  assert.equal(r.ready, false);
  assert.match(r.issues[0], /Manifest file not present/);
});
