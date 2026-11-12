import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const projectFile = (relative) => readFileSync(new URL('../' + relative, import.meta.url));
const policy = JSON.parse(projectFile('catalog/artwork-license-decision.json').toString('utf8'));
const authorship = JSON.parse(projectFile('catalog/owner-authorship.json').toString('utf8'));
const rawManifest = projectFile('manifests/approved-assets.json');
const manifest = JSON.parse(rawManifest.toString('utf8'));
const gitBlobSha = createHash('sha1')
  .update('blob ' + rawManifest.length + '\0')
  .update(rawManifest).digest('hex');

test('owner artwork licensing choice remains pinned to exact manifest bytes and count', () => {
  assert.equal(policy.schemaVersion, 1);
  assert.equal(policy.decisionStatus, 'owner-selected-policy');
  assert.equal(policy.licenseId, 'CC-BY-4.0');
  assert.equal(policy.licenseUrl, 'https://creativecommons.org/licenses/by/4.0/');
  assert.equal(policy.requiresPerFileClearance, true);
  assert.equal(policy.scope.manifest, 'manifests/approved-assets.json');
  assert.equal(policy.scope.manifestGitBlobSha, gitBlobSha);
  assert.equal(policy.scope.expectedAssetCount, manifest.assets.length);
  assert.equal(authorship.scope.gitBlobSha, gitBlobSha);
  assert.equal(authorship.scope.expectedImageCount, manifest.assets.length);
});

test('software CPAL attribution and artwork CC BY license are separate', () => {
  const licenseText = projectFile('LICENSE').toString('utf8');
  assert.match(licenseText, /Common Public Attribution License Version 1\.0/);
  assert.match(licenseText, /Powered by VirgoStars/);
  assert.match(policy.licenseScope, /third-party|separately owned/i);
});

test('unreviewed public-rights register cannot imply automatic image clearance', () => {
  const publication = JSON.parse(projectFile('catalog/publication-approvals.json').toString('utf8'));
  assert.equal(publication.schemaVersion, 1);
  assert.ok(Array.isArray(publication.assets));
  const permitted = new Set(manifest.assets.map(a => a.path));
  for (const a of publication.assets) {
    assert.ok(permitted.has(a.path), 'Unlisted image license: ' + a.path);
    assert.equal(a.licenseId, policy.licenseId);
    assert.equal(a.status, 'approved');
    assert.equal(a.permissionScope, 'public-redistribution');
    assert.equal(a.thirdPartyStatus, 'cleared');
    assert.ok(typeof a.thirdPartyReview === 'string' && a.thirdPartyReview.trim());
  }
});
