import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

// All purported permissions below are synthetic test fixtures, not real artwork licenses.
const cli = fileURLToPath(new URL('../scripts/check-public-release.mjs', import.meta.url));
const assetPath = 'img/simboli-bianchi/segni/01.png';
const data = Buffer.from('SYNTHETIC fixture bytes; not redistributable artwork');
const digest = (algorithm, body) => createHash(algorithm).update(body).digest('hex');
const gitBlob = body => createHash('sha1').update('blob ' + body.length + '\0').update(body).digest('hex');

function fixture(callback) {
  const root = mkdtempSync(join(tmpdir(), 'astro-public-cli-'));
  const leaf = join(root, 'public', 'assets', 'img', 'simboli-bianchi', 'segni');
  mkdirSync(leaf, {recursive:true});
  mkdirSync(join(root, 'catalog'));
  mkdirSync(join(root, 'manifests'));
  const assetFile = join(leaf, '01.png');
  writeFileSync(assetFile, data);
  const asset = {
    path:assetPath, bytes:data.length, sha256:digest('sha256', data),
    rightsHolder:'Synthetic private fixture', permissionBasis:'Synthetic private-use fixture',
    approvalEvidence:'Test data, not actual authorization',
  };
  const manifestRaw = JSON.stringify({schemaVersion:1, assets:[asset]}, null, 2) + '\n';
  const publicRecord = {
    path:assetPath, sha256:asset.sha256, status:'approved',
    permissionScope:'public-redistribution', licenseId:'CC-BY-4.0',
    rightsHolder:'Synthetic test fixture',
    publicApprovalEvidence:'Synthetic schema test, not a real public grant',
    thirdPartyStatus:'cleared',
    thirdPartyReview:'Synthetic fixture with no third-party content',
  };
  const policy = {
    schemaVersion:1, decisionStatus:'owner-selected-policy',
    licenseId:'CC-BY-4.0', requiresPerFileClearance:true,
    scope:{
      manifest:'manifests/approved-assets.json',
      manifestGitBlobSha:gitBlob(Buffer.from(manifestRaw)),
      expectedAssetCount:1,
    },
  };
  const writeJson = (name, object) =>
    writeFileSync(join(root, name), JSON.stringify(object, null, 2) + '\n');
  writeFileSync(join(root, 'manifests', 'approved-assets.json'), manifestRaw);
  writeJson('catalog/publication-approvals.json', {schemaVersion:1, assets:[]});
  writeJson('catalog/artwork-license-decision.json', policy);
  const run = () => spawnSync(process.execPath, [cli], {cwd:root, encoding:'utf8'});
  try { callback({root, leaf, assetFile, asset, publicRecord, writeJson, run}); }
  finally { rmSync(root, {recursive:true, force:true}); }
}

test('full CLI returns 2 on an intact synthetic pack lacking public approvals', () =>
  fixture(({run}) => {
    const result = run();
    assert.equal(result.status, 2, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.manifestImages, 1);
    assert.equal(report.explicitPublicApprovals, 0);
    assert.equal(report.imagesStillBlocked, 1);
    assert.equal(report.verifiedPackFiles, 1);
  }));

test('full CLI succeeds with entirely synthetic approvals and verified SHA-256', () =>
  fixture(({run, publicRecord, writeJson}) => {
    writeJson('catalog/publication-approvals.json', {schemaVersion:1, assets:[publicRecord]});
    const result = run();
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.ready, true);
    assert.equal(report.verifiedPackFiles, 1);
    assert.equal(report.explicitPublicApprovals, 1);
  }));

test('full CLI blocks altered asset bytes regardless of purported approval', () =>
  fixture(({run, publicRecord, writeJson, assetFile}) => {
    writeJson('catalog/publication-approvals.json', {schemaVersion:1, assets:[publicRecord]});
    writeFileSync(assetFile, 'different bytes');
    const result = run();
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Checksum mismatch/);
  }));

test('full CLI blocks case-mismatched asset on any filesystem', () =>
  fixture(({run, publicRecord, writeJson, leaf, assetFile}) => {
    writeJson('catalog/publication-approvals.json', {schemaVersion:1, assets:[publicRecord]});
    const unchangedBytes = readFileSync(assetFile);
    rmSync(assetFile);
    writeFileSync(join(leaf, '01.PNG'), unchangedBytes);
    const result = run();
    assert.notEqual(result.status, 0, result.stdout);
    assert.match(result.stdout + result.stderr, /canonical manifest spelling|Missing image\/font/);
  }));

test('full CLI rejects a symlink ancestor above the pack root', t =>
  fixture(({root, run}) => {
    const actual = join(root, 'public');
    const moved = join(root, 'real-public');
    renameSync(actual, moved);
    try { symlinkSync(moved, actual, process.platform === 'win32' ? 'junction' : 'dir'); }
    catch (error) {
      if (process.platform === 'win32' && ['EPERM','EACCES'].includes(error.code))
        return t.skip('Junction creation unavailable');
      throw error;
    }
    const result = run();
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Symlink in public pack root path/);
  }));
