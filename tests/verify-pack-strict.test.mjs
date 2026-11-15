import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { verifyPack } from '../scripts/verify-pack.mjs';

function fixture(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'astro-pack-closure-'));
  const root = join(dir, 'pack');
  const path = 'img/segni/01.png';
  const body = Buffer.from('original synthetic pack fixture');
  mkdirSync(join(root, 'img', 'segni'), { recursive: true });
  writeFileSync(join(root, path), body);
  const manifest = { schemaVersion: 1, assets: [{
    path, bytes: body.length,
    sha256: createHash('sha256').update(body).digest('hex'),
    rightsHolder: 'synthetic author',
    permissionBasis: 'test-only synthetic bytes',
    approvalEvidence: 'local test fixture',
  }] };
  try { return fn({ dir, root, path, body, manifest }); }
  finally { rmSync(dir, { recursive: true, force: true }); }
}

test('strict closure verifies a manifest-only synthetic pack', () => fixture(x => {
  assert.deepEqual(verifyPack(x.root, x.manifest, { strict: true }),
    { verified: 1, bytes: x.body.length });
}));

test('default preserves manifest-only behavior but strict blocks unlisted files', () => fixture(x => {
  writeFileSync(join(x.root, 'img', 'segni', 'unreviewed.png'), 'not authorized');
  assert.equal(verifyPack(x.root, x.manifest).verified, 1);
  assert.throws(() => verifyPack(x.root, x.manifest, { strict: true }),
    /Unlisted files in pack \(1\): img\/segni\/unreviewed\.png/);
}));

test('strict traverses nested directories and rejects extra text or hidden files', () => fixture(x => {
  mkdirSync(join(x.root, 'img', 'nested'), { recursive: true });
  writeFileSync(join(x.root, 'img', 'nested', '.DS_Store'), 'foreign bytes');
  assert.throws(() => verifyPack(x.root, x.manifest, { strict: true }),
    /Unlisted files in pack \(1\): img\/nested\/\.DS_Store/);
}));

test('strict rejects symlinks, including dangling unlisted entries', t => fixture(x => {
  const link = join(x.root, 'img', 'segni', 'missing.png');
  try { symlinkSync(join(x.dir, 'not-present.png'), link); }
  catch (error) {
    if (process.platform === 'win32' && ['EPERM', 'EACCES'].includes(error.code))
      return t.skip('Windows symlinks require additional permissions');
    throw error;
  }
  assert.throws(() => verifyPack(x.root, x.manifest, { strict: true }), /Symlink forbidden in pack/);
}));

test('pack root itself cannot be a symlink, even without strict mode', t => fixture(x => {
  const alias = join(x.dir, 'alias');
  try { symlinkSync(x.root, alias, 'junction'); }
  catch (error) {
    if (process.platform === 'win32' && ['EPERM', 'EACCES'].includes(error.code))
      return t.skip('Windows junction unavailable');
    throw error;
  }
  assert.throws(() => verifyPack(alias, x.manifest), /Unsafe pack root/);
}));

test('strict rejects case-colliding paths on case-sensitive filesystems', t => fixture(x => {
  if (process.platform === 'win32') return t.skip('Windows is normally case-insensitive');
  writeFileSync(join(x.root, 'img', 'segni', '01.PNG'), 'conflicting spelling');
  assert.throws(() => verifyPack(x.root, x.manifest, { strict: true }),
    /Case-colliding pack path/);
}));

test('strict never weakens manifest hash or review-metadata validation', () => fixture(x => {
  const bad = structuredClone(x.manifest);
  bad.assets[0].approvalEvidence = ' ';
  assert.throws(() => verifyPack(x.root, bad, { strict: true }), /approvalEvidence/);
  writeFileSync(join(x.root, x.path), 'tampered synthetic bytes');
  assert.throws(() => verifyPack(x.root, x.manifest, { strict: true }), /Checksum mismatch/);
  assert.throws(() => verifyPack(x.root, x.manifest, { strict: 'yes' }), /strict must be a boolean/);
}));
