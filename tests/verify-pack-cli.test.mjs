import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
  mkdtempSync, mkdirSync, readFileSync, realpathSync,
  renameSync, rmSync, symlinkSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const cli = fileURLToPath(new URL('../scripts/verify-pack.mjs', import.meta.url));
const assetPath = 'img/segni/01.png';
const fixtureBytes = Buffer.from('original synthetic fixture; never VirgoStars artwork');

function fixture(callback) {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'astro-pack-cli-')));
  const root = join(dir, 'pack');
  mkdirSync(join(root, dirname(assetPath)), { recursive: true });
  writeFileSync(join(root, assetPath), fixtureBytes);
  const manifest = {
    schemaVersion: 1,
    assets: [{
      path: assetPath,
      bytes: fixtureBytes.length,
      sha256: createHash('sha256').update(fixtureBytes).digest('hex'),
      rightsHolder: 'Synthetic test author',
      permissionBasis: 'Original fixture, not a publication permission',
      approvalEvidence: 'Local synthetic test fixture',
    }],
  };
  const manifestPath = join(dir, 'manifest.json');
  writeFileSync(manifestPath, JSON.stringify(manifest));
  const run = (...extra) => spawnSync(process.execPath,
    [cli, '--root', root, '--manifest', manifestPath, ...extra],
    { encoding: 'utf8' });
  try { return callback({ dir, root, manifestPath, run }); }
  finally { rmSync(dir, { recursive: true, force: true }); }
}

test('CLI default and --strict both verify a clean pack without rewriting it', () => fixture(({ root, manifestPath, run }) => {
  const before = readFileSync(join(root, assetPath));
  const manifestBefore = readFileSync(manifestPath);
  const ordinary = run();
  assert.equal(ordinary.status, 0, ordinary.stderr);
  assert.match(ordinary.stdout, /Verified 1 approved assets/);
  assert.doesNotMatch(ordinary.stdout, /Strict closure verified/);
  const strict = run('--strict');
  assert.equal(strict.status, 0, strict.stderr);
  assert.match(strict.stdout, /Strict closure verified/);
  assert.deepEqual(readFileSync(join(root, assetPath)), before);
  assert.deepEqual(readFileSync(manifestPath), manifestBefore);
}));

test('CLI strict mode rejects unlisted and hidden files, while default remains manifest-only', () => fixture(({ root, run }) => {
  writeFileSync(join(root, 'img', '.unlisted'), 'not a reviewed asset');
  assert.equal(run().status, 0);
  const strict = run('--strict');
  assert.equal(strict.status, 1);
  assert.match(strict.stderr, /Unlisted files in pack \(1\): img\/\.unlisted/);
  assert.doesNotMatch(strict.stdout, /Strict closure verified/);
}));

test('CLI strict rejects unlisted dangling symlinks while default stays compatible', t => fixture(({ dir, root, run }) => {
  const link = join(root, 'img', 'unlisted.png');
  try { symlinkSync(join(dir, 'missing.png'), link); }
  catch (error) {
    if (process.platform === 'win32' && ['EPERM', 'EACCES', 'ENOTSUP'].includes(error.code))
      return t.skip('File symlink unavailable on this Windows host');
    throw error;
  }
  assert.equal(run().status, 0);
  const strict = run('--strict');
  assert.equal(strict.status, 1);
  assert.match(strict.stderr, /Symlink forbidden in pack/);
}));

test('CLI rejects a symlinked pack-root ancestor in both modes', t => fixture(({ dir, root, manifestPath }) => {
  const alias = join(dir, 'parent-alias');
  try { symlinkSync(dir, alias, process.platform === 'win32' ? 'junction' : 'dir'); }
  catch (error) {
    if (process.platform === 'win32' && ['EPERM', 'EACCES', 'ENOTSUP'].includes(error.code))
      return t.skip('Junction unavailable on this Windows host');
    throw error;
  }
  const run = (...extra) => spawnSync(process.execPath,
    [cli, '--root', join(alias, 'pack'), '--manifest', manifestPath, ...extra],
    { encoding: 'utf8' });
  for (const flags of [[], ['--strict']]) {
    const result = run(...flags);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Unsafe pack root: Symlink forbidden/);
  }
  assert.equal(readFileSync(join(root, assetPath)).length, fixtureBytes.length);
}));

test('CLI rejects wrong physical directory case in default and strict modes', () => fixture(({ root, run }) => {
  renameSync(join(root, 'img', 'segni'), join(root, 'img', 'SEGNI'));
  for (const flags of [[], ['--strict']]) {
    const result = run(...flags);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Non-canonical asset path spelling|Missing image\/font/);
  }
}));

test('CLI rejects checksum tampering in both modes', () => fixture(({ root, run }) => {
  writeFileSync(join(root, assetPath), 'tampered bytes');
  for (const flags of [[], ['--strict']]) {
    const result = run(...flags);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Checksum mismatch/);
    assert.doesNotMatch(result.stdout, /Verified 1 approved assets/);
  }
}));

test('CLI accepts --strict at the start and rejects duplicate or unknown flags', () => fixture(({ root, manifestPath, run }) => {
  const front = spawnSync(process.execPath,
    [cli, '--strict', '--root', root, '--manifest', manifestPath],
    { encoding: 'utf8' });
  assert.equal(front.status, 0, front.stderr);
  assert.match(front.stdout, /Strict closure verified/);
  for (const args of [['--strict', '--strict'], ['--unexpected'], ['--strict', '--unexpected']]) {
    const result = run(...args);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Usage: node scripts\/verify-pack/);
  }
}));

test('CLI rejects invalid manifest JSON without modifying original pack bytes', () => fixture(({ root, manifestPath, run }) => {
  writeFileSync(manifestPath, '{not valid json');
  const result = run('--strict');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /VERIFICATION FAILED/);
  assert.deepEqual(readFileSync(join(root, assetPath)), fixtureBytes);
}));
