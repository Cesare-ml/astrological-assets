import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeCollisionReport } from '../scripts/write-collision-report.mjs';

function fixture(fn) {
  const root = mkdtempSync(join(tmpdir(), 'astro-report-safety-'));
  const legacyRoot = join(root, 'legacy'), packRoot = join(root, 'pack');
  mkdirSync(legacyRoot); mkdirSync(packRoot);
  const manifestPath = join(root, 'manifest.json');
  writeFileSync(manifestPath, '{"safe":true}\n');
  try { return fn({ root, legacyRoot, packRoot, manifestPath }); }
  finally { rmSync(root, { recursive: true, force: true }); }
}

test('writes an exclusive report outside asset inputs', () => fixture(inputs => {
  const target = join(inputs.root, 'report.local.json');
  assert.equal(writeCollisionReport(target, '{"verdict":"disjoint"}\n', inputs), target);
  assert.equal(readFileSync(target, 'utf8'), '{"verdict":"disjoint"}\n');
}));

test('refuses to overwrite a pre-existing report or manifest', () => fixture(inputs => {
  const output = join(inputs.root, 'report.local.json');
  writeFileSync(output, 'keep');
  assert.throws(() => writeCollisionReport(output, 'replace', inputs), /EEXIST/);
  assert.equal(readFileSync(output, 'utf8'), 'keep');
  assert.throws(() => writeCollisionReport(inputs.manifestPath, 'replace', inputs), /must not/);
  assert.equal(readFileSync(inputs.manifestPath, 'utf8'), '{"safe":true}\n');
}));

test('refuses outputs inside either asset tree', () => fixture(inputs => {
  for (const root of [inputs.packRoot, inputs.legacyRoot]) {
    const target = join(root, 'report.local.json');
    assert.throws(() => writeCollisionReport(target, 'x', inputs), /must not/);
    assert.throws(() => writeCollisionReport(root, 'x', inputs), /must not/);
  }
}));

test('refuses symlink ancestor and final symlink', t => fixture(inputs => {
  const actual = join(inputs.root, 'actual');
  const alias = join(inputs.root, 'alias');
  mkdirSync(actual);
  try { symlinkSync(actual, alias, process.platform === 'win32' ? 'junction' : 'dir'); }
  catch (error) {
    if (process.platform === 'win32' && ['EPERM', 'EACCES'].includes(error.code))
      return t.skip('Symlink permissions unavailable');
    throw error;
  }
  assert.throws(() => writeCollisionReport(join(alias, 'report.json'), 'x', inputs), /Symlink/);
  const dest = join(inputs.root, 'link.json');
  symlinkSync(inputs.manifestPath, dest);
  assert.throws(() => writeCollisionReport(dest, 'x', inputs), /Symlink/);
}));

test('rejects empty destination and missing source boundaries', () => fixture(inputs => {
  assert.throws(() => writeCollisionReport('', '{}', inputs), /Invalid/);
  assert.throws(() => writeCollisionReport(join(inputs.root, 'x'), '{}', { packRoot: inputs.packRoot }), /Invalid/);
}));
