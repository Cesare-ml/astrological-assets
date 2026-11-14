import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writePendingWorksheet } from '../scripts/write-pending-worksheet.mjs';

const worksheet = {
  schemaVersion: 1,
  purpose: 'PENDING review only',
  assets: [{ path: 'img/example.png', status: 'pending', permissionScope: 'not-yet-granted' }],
};

function withFixture(run) {
  const root = mkdtempSync(join(tmpdir(), 'astro-public-review-'));
  mkdirSync(join(root, 'catalog'));
  mkdirSync(join(root, 'public'));
  mkdirSync(join(root, 'private-reports'));
  try { return run(root); }
  finally { rmSync(root, { recursive: true, force: true }); }
}

const save = (root, destination, doc = worksheet) =>
  writePendingWorksheet({ repositoryRoot: root, destination, worksheet: doc });

test('writes a root-level pending worksheet, exclusive and private', () => withFixture(root => {
  const output = join(root, 'review.local.json');
  assert.equal(save(root, output), output);
  assert.deepEqual(JSON.parse(readFileSync(output, 'utf8')), worksheet);
  assert.throws(() => save(root, output), /EEXIST/);
  if (process.platform !== 'win32') assert.equal(statSync(output).mode & 0o777, 0o600);
}));

test('allows a new file in an existing private output directory', () => withFixture(root => {
  const output = join(root, 'private-reports', 'review.local.json');
  assert.equal(save(root, output), output);
}));

test('rejects outputs in asset and authoritative register directories', () => withFixture(root => {
  for (const folder of ['catalog', 'public']) {
    assert.throws(() => save(root, join(root, folder, 'review.local.json')), /forbidden/);
  }
}));

test('rejects unsafe extensions and approval-like worksheet records before writing', () => withFixture(root => {
  const output = join(root, 'review.local.json');
  assert.throws(() => save(root, join(root, 'review.json')), /\.local\.json/);
  assert.throws(() => save(root, output, { ...worksheet, assets: [{ status: 'approved', permissionScope: 'public-redistribution' }] }), /Only pending/);
  assert.throws(() => save(root, output, { ...worksheet, assets: [{ status: 'pending', permissionScope: 'public-redistribution' }] }), /Only pending/);
  assert.throws(() => save(root, output, { schemaVersion: 0, assets: [] }), /Only pending/);
}));

test('rejects missing output parents', () => withFixture(root => {
  assert.throws(() => save(root, join(root, 'missing', 'review.local.json')), /ENOENT/);
}));

test('rejects symlink destination without changing its target', t => withFixture(root => {
  const destination = join(root, 'review.local.json');
  const target = join(root, 'private-reports', 'existing.local.json');
  writeFileSync(target, 'untouched');
  try { symlinkSync(target, destination, 'file'); }
  catch (error) { if (process.platform === 'win32' && ['EPERM', 'EACCES'].includes(error.code)) return t.skip('Symlinks unavailable'); throw error; }
  assert.throws(() => save(root, destination), /EEXIST/);
  assert.equal(readFileSync(target, 'utf8'), 'untouched');
}));

test('rejects symlinked output ancestors', t => withFixture(root => {
  const alias = join(root, 'alias');
  try { symlinkSync(join(root, 'private-reports'), alias, process.platform === 'win32' ? 'junction' : 'dir'); }
  catch (error) { if (process.platform === 'win32' && ['EPERM', 'EACCES'].includes(error.code)) return t.skip('Junctions unavailable'); throw error; }
  assert.throws(() => save(root, join(alias, 'review.local.json')), /Unsafe worksheet output parent/);
}));
