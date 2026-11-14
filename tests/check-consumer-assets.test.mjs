import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { inspectConsumerAssets } from '../scripts/check-consumer-assets.mjs';

const asset = 'img/grafici/light/cartaastrale-segni.png';
function fixture(callback) {
  const folder = mkdtempSync(join(tmpdir(), 'astro-consumer-'));
  const root = join(folder, 'assets');
  const bytes = Buffer.from('synthetic-only chart bytes');
  mkdirSync(join(root, 'img/grafici/light'), { recursive: true });
  writeFileSync(join(root, asset), bytes);
  const record = { path: asset, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'),
    rightsHolder: 'test fixture', permissionBasis: 'synthetic data', approvalEvidence: 'not a license' };
  const manifest = { schemaVersion: 1, source: { commit: 'test-commit' }, assets: [record] };
  const requirements = { schemaVersion: 1, consumer: 'Astrolabio', assets: [asset] };
  const run = () => inspectConsumerAssets({ assetRoot: root, manifest, requirements });
  try { return callback({ folder, root, bytes, record, manifest, requirements, run }); }
  finally { rmSync(folder, { recursive: true, force: true }); }
}

test('verifies exact private consumer subset with deterministic report', () => fixture(({ record, run }) => {
  const result = run();
  assert.equal(result.verdict, 'verified');
  assert.equal(result.consumer, 'Astrolabio');
  assert.equal(result.verifiedCount, 1);
  assert.equal(result.totalVerifiedBytes, record.bytes);
  assert.deepEqual(result.verified, [{ path: asset, bytes: record.bytes, sha256: record.sha256 }]);
  assert.equal(result.manifestSourceCommit, 'test-commit');
}));

test('reports an asset absent from the manifest without treating it as approved', () => fixture(({ requirements, run }) => {
  requirements.assets.push('img/grafici/dark/missing.png');
  const result = run();
  assert.equal(result.verdict, 'blocked');
  assert.deepEqual(result.missingFromManifest, ['img/grafici/dark/missing.png']);
}));

test('reports missing and tampered local files', () => fixture(({ root, run }) => {
  writeFileSync(join(root, asset), 'tampered');
  assert.deepEqual(run().mismatched, [asset]);
  rmSync(join(root, asset));
  assert.deepEqual(run().missingFromPack, [asset]);
}));

test('rejects traversal, control characters, duplicate and case-colliding request paths', () => fixture(({ requirements, run }) => {
  for (const path of ['img/../secret.png', 'img/evil\\x.png', 'img/bad\nname.png', '/img/root.png']) {
    requirements.assets = [path];
    assert.throws(run, /Unsafe/);
  }
  requirements.assets = [asset, asset.toUpperCase().replace(/^IMG\//, 'img/')];
  assert.throws(run, /Duplicate or case-colliding/);
}));

test('refuses invalid manifest approval, colliding paths, and empty requests', () => fixture(({ record, manifest, requirements, run }) => {
  manifest.assets[0] = { ...record, approvalEvidence: '' };
  assert.throws(run, /approvalEvidence/);
  manifest.assets[0] = record;
  manifest.assets.push({ ...record, path: asset.toUpperCase().replace(/^IMG\//, 'img/') });
  assert.throws(run, /Duplicate or case-colliding/);
  manifest.assets.pop();
  requirements.assets = [];
  assert.throws(run, /nonempty/);
}));

test('never follows a symlink inside a requested asset path', t => fixture(({ root, run }) => {
  rmSync(join(root, asset));
  try { symlinkSync(join(root, 'missing.png'), join(root, asset)); }
  catch (error) { if (process.platform === 'win32' && ['EPERM', 'EACCES'].includes(error.code)) return t.skip('Symlink unavailable'); throw error; }
  assert.throws(run, /Symlink/);
}));

test('CLI uses exit 0 verified, 2 blocked, and 1 invalid', () => fixture(({ folder, root, manifest, requirements }) => {
  const script = fileURLToPath(new URL('../scripts/check-consumer-assets.mjs', import.meta.url));
  const manifestFile = join(folder, 'manifest.json'), requestsFile = join(folder, 'requests.json');
  writeFileSync(manifestFile, JSON.stringify(manifest));
  const exec = () => spawnSync(process.execPath, [script, '--root', root, '--manifest', manifestFile, '--requirements', requestsFile], { encoding: 'utf8' });
  writeFileSync(requestsFile, JSON.stringify(requirements));
  assert.equal(exec().status, 0);
  requirements.assets.push('img/none.png');
  writeFileSync(requestsFile, JSON.stringify(requirements));
  const blocked = exec();
  assert.equal(blocked.status, 2);
  assert.equal(JSON.parse(blocked.stdout).verdict, 'blocked');
  writeFileSync(requestsFile, '{bad json');
  assert.equal(exec().status, 1);
}));
