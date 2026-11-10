import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inspectWebAssetCollisions } from '../scripts/check-web-asset-collisions.mjs';

const digest = x => createHash('sha256').update(x).digest('hex');
const path = 'img/simboli-bianchi/segni/01.png';
function fixture(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'astro-collisions-'));
  const legacy = join(dir, 'legacy'), pack = join(dir, 'pack');
  const content = Buffer.from('approved synthetic bytes');
  for (const root of [legacy, pack])
    mkdirSync(join(root, 'img', 'simboli-bianchi', 'segni'), { recursive: true });
  writeFileSync(join(pack, path), content);
  const manifest = { schemaVersion: 1, assets: [{ path, bytes: content.length, sha256: digest(content),
    rightsHolder:'fixture',permissionBasis:'synthetic data',approvalEvidence:'test' }] };
  try { return fn({ legacy, pack, content, manifest }); }
  finally { rmSync(dir, { force: true, recursive: true }); }
}
test('pack-only file passes one-copy build gate', () => {
  fixture(x => {
    const r = inspectWebAssetCollisions({ legacyRoot: x.legacy, packRoot: x.pack, manifest: x.manifest });
    assert.equal(r.verdict, 'disjoint');
    assert.deepEqual(r.packOnly, [path]);
  });
});
test('identical legacy file is still a duplicate and requires excluding source', () => {
  fixture(x => {
    writeFileSync(join(x.legacy, path), x.content);
    const r = inspectWebAssetCollisions({ legacyRoot: x.legacy, packRoot: x.pack, manifest: x.manifest });
    assert.equal(r.verdict, 'needs-exclusion');
    assert.deepEqual(r.legacySame, [path]);
  });
});
test('different legacy bytes block migration', () => {
  fixture(x => {
    writeFileSync(join(x.legacy, path), 'legacy differs');
    const r = inspectWebAssetCollisions({ legacyRoot: x.legacy, packRoot: x.pack, manifest: x.manifest });
    assert.equal(r.verdict, 'blocked');
    assert.deepEqual(r.legacyDifferent, [path]);
  });
});
test('tampered pack or missing pack blocks migration', () => {
  fixture(x => {
    writeFileSync(join(x.pack, path), 'tampered');
    assert.deepEqual(inspectWebAssetCollisions({ legacyRoot: x.legacy, packRoot: x.pack, manifest: x.manifest }).packMismatches, [path]);
    rmSync(join(x.pack, path));
    assert.deepEqual(inspectWebAssetCollisions({ legacyRoot: x.legacy, packRoot: x.pack, manifest: x.manifest }).missingPack, [path]);
  });
});
test('path traversal and case collision refused', () => {
  fixture(x => {
    assert.throws(() => inspectWebAssetCollisions({ legacyRoot: x.legacy, packRoot: x.pack,
      manifest: { schemaVersion: 1, assets: [{ ...x.manifest.assets[0], path: 'img/../../secret.png' }] } }), /Unsafe/);
    assert.throws(() => inspectWebAssetCollisions({ legacyRoot: x.legacy, packRoot: x.pack,
      manifest: { schemaVersion: 1, assets: [x.manifest.assets[0], { ...x.manifest.assets[0], path: 'img/simboli-bianchi/segni/01.PNG' }] } }), /Duplicate/);
  });
});
test('empty manifest cannot pass the one-copy gate', () => {
  fixture(x => assert.throws(() => inspectWebAssetCollisions({legacyRoot:x.legacy,packRoot:x.pack,
    manifest:{schemaVersion:1,assets:[]}}), /empty/));
});
test('pending or undocumented manifest records cannot pass the one-copy gate', () => fixture(x => {
  for(const patch of [{status:'pending'},{approvalEvidence:''}]) {
    const manifest={schemaVersion:1,assets:[{...x.manifest.assets[0],...patch}]};
    assert.throws(()=>inspectWebAssetCollisions({legacyRoot:x.legacy,packRoot:x.pack,manifest}),/not approved|approvalEvidence/);
  }
}));
test('symlinks are not followed', t => {
  fixture(x => {
    rmSync(join(x.pack, path));
    try { symlinkSync(join(x.legacy, 'not-existent.png'), join(x.pack, path)); }
    catch (e) {
      if (process.platform === 'win32' && ['EPERM', 'EACCES'].includes(e.code))
        return t.skip('Symlink unavailable');
      throw e;
    }
    assert.throws(() => inspectWebAssetCollisions({ legacyRoot: x.legacy, packRoot: x.pack, manifest: x.manifest }), /Symlink/);
  });
});
