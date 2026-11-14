import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, realpathSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { verifyPack } from '../scripts/verify-pack.mjs';

function withSyntheticPack(callback) {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'astro-verify-root-')));
  const root = join(dir, 'real', 'assets');
  const path = 'img/simboli-bianchi/segni/01.png';
  const bytes = Buffer.from('synthetic fixture: no production artwork');
  mkdirSync(join(root, dirname(path)), { recursive: true });
  writeFileSync(join(root, ...path.split('/')), bytes);
  const manifest = {
    schemaVersion: 1,
    assets: [{
      path,
      bytes: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      rightsHolder: 'Synthetic test author',
      permissionBasis: 'Original test fixture',
      approvalEvidence: 'Local test only',
    }],
  };
  try {
    return callback({ dir, root, manifest, bytes });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function makeDirectoryLink(t, target, link) {
  try {
    symlinkSync(target, link, process.platform === 'win32' ? 'junction' : 'dir');
    return true;
  } catch (error) {
    if (process.platform === 'win32' && ['EPERM', 'EACCES', 'ENOTSUP'].includes(error.code)) {
      t.skip('Directory links require local Windows permissions');
      return false;
    }
    throw error;
  }
}

test('verifies ordinary, canonical asset directories', () => withSyntheticPack(({ root, manifest, bytes }) => {
  assert.deepEqual(verifyPack(root, manifest), { verified: 1, bytes: bytes.length });
}));

test('blocks a symlinked pack root even when every image hash matches', t => withSyntheticPack(({ dir, root, manifest }) => {
  const alias = join(dir, 'alias');
  if (!makeDirectoryLink(t, root, alias)) return;
  assert.throws(() => verifyPack(alias, manifest), /Symlink forbidden in asset pack root/);
}));

test('blocks a symlinked ancestor above an otherwise regular pack directory', t => withSyntheticPack(({ dir, manifest }) => {
  const alias = join(dir, 'alias-parent');
  if (!makeDirectoryLink(t, join(dir, 'real'), alias)) return;
  assert.throws(() => verifyPack(join(alias, 'assets'), manifest), /Symlink forbidden in asset pack root/);
}));

test('blocks invalid or non-directory roots before reading assets', () => withSyntheticPack(({ dir, manifest }) => {
  assert.throws(() => verifyPack('', manifest), /Invalid asset pack root/);
  const file = join(dir, 'regular-file');
  writeFileSync(file, 'not an asset directory');
  assert.throws(() => verifyPack(file, manifest), /not a directory/);
}));

test('CLI refuses a symlinked asset root without modifying its contents', t => withSyntheticPack(({ dir, root, manifest }) => {
  const alias = join(dir, 'cli-alias');
  if (!makeDirectoryLink(t, root, alias)) return;
  const manifestPath = join(dir, 'manifest.json');
  writeFileSync(manifestPath, JSON.stringify(manifest));
  const script = fileURLToPath(new URL('../scripts/verify-pack.mjs', import.meta.url));
  const run = spawnSync(process.execPath, [script, '--root', alias, '--manifest', manifestPath], { encoding: 'utf8' });
  assert.equal(run.status, 1);
  assert.match(run.stderr, /Symlink forbidden in asset pack root/);
  assert.equal(verifyPack(root, manifest).verified, 1);
}));

test('rejects dangling links at a manifest-listed file instead of treating them as missing', t => withSyntheticPack(({ root, manifest }) => {
  const target = join(root, ...manifest.assets[0].path.split('/'));
  rmSync(target);
  try { symlinkSync(join(root, 'absent.png'), target); }
  catch(error) {
    if(process.platform==='win32' && ['EPERM','EACCES','ENOTSUP'].includes(error.code)) return t.skip('File links unavailable');
    throw error;
  }
  assert.throws(() => verifyPack(root, manifest), /Symlink forbidden/);
}));

test('rejects regular files in ancestor positions before attempting the final asset', () => withSyntheticPack(({ root, manifest }) => {
  const path = 'img/simboli-bianchi/segni/01.png';
  rmSync(join(root, 'img'), { recursive: true });
  writeFileSync(join(root, 'img'), 'not a directory');
  assert.throws(() => verifyPack(root, manifest), /Parent is not a directory/);
}));

test('reports genuinely missing manifest files without hiding link errors', () => withSyntheticPack(({ root, manifest }) => {
  rmSync(join(root, ...manifest.assets[0].path.split('/')));
  assert.throws(() => verifyPack(root, manifest), /Missing image\/font/);
}));

test('rejects a differently-cased filename even when the bytes and hash match', () => withSyntheticPack(({ root, manifest }) => {
  manifest.assets[0].path = 'img/simboli-bianchi/segni/01.PNG';
  assert.throws(() => verifyPack(root, manifest), /Non-canonical asset path spelling|Missing image\/font/);
}));

test('rejects a differently-cased directory component of a manifest path', () => withSyntheticPack(({ root, manifest }) => {
  manifest.assets[0].path = 'img/SIMBOLI-BIANCHI/segni/01.png';
  assert.throws(() => verifyPack(root, manifest), /Non-canonical asset path spelling|Missing image\/font/);
}));

test('accepts a mixed-case physical filename when the manifest uses its exact spelling', () => withSyntheticPack(({ root, manifest, bytes }) => {
  const original = join(root, ...manifest.assets[0].path.split('/'));
  const physical = 'img/simboli-bianchi/segni/01.MixedCase.PNG';
  renameSync(original, join(root, ...physical.split('/')));
  manifest.assets[0].path = physical;
  assert.deepEqual(verifyPack(root, manifest), { verified: 1, bytes: bytes.length });
}));
