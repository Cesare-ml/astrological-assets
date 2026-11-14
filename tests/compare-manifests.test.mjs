import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compareAssetManifests } from '../scripts/compare-manifests.mjs';

const path = 'img/simboli/segni/aries.png';
const baseAsset = { path, bytes: 4, sha256: 'a'.repeat(64), gitBlobSha: 'b'.repeat(40),
  rightsHolder: 'Synthetic fixture', permissionBasis: 'private-only test', approvalEvidence: 'fixture' };
const source = { repository: 'Example/private', commit: 'c'.repeat(40), assetRoot: 'public/assets' };
const pack = (...assets) => ({ schemaVersion: 1, source, assets });
const extra = { ...baseAsset, path: 'img/simboli/segni/taurus.png', sha256: 'd'.repeat(64) };

function runCLI(before, after, args = ['--before', 'before.json', '--after', 'after.json']) {
  const dir = mkdtempSync(join(tmpdir(), 'astro-manifest-diff-'));
  try {
    writeFileSync(join(dir, 'before.json'), JSON.stringify(before));
    writeFileSync(join(dir, 'after.json'), JSON.stringify(after));
    const script = resolve(fileURLToPath(new URL('../scripts/compare-manifests.mjs', import.meta.url)));
    return spawnSync(process.execPath, [script, ...args], { cwd: dir, encoding: 'utf8' });
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

test('unchanged record order and JSON key order are ignored', () => {
  const reordered = { approvalEvidence: extra.approvalEvidence, ...extra };
  const result = compareAssetManifests(pack(baseAsset, extra), pack(reordered, baseAsset));
  assert.equal(result.changed, false);
  assert.deepEqual(result.summary, { before: 2, after: 2, added: 0, removed: 0, modified: 0, topLevelChanged: false });
});

test('added and removed paths reported in deterministic order', () => {
  const result = compareAssetManifests(pack(baseAsset), pack(extra));
  assert.deepEqual(result.added, [extra.path]);
  assert.deepEqual(result.removed, [path]);
  assert.equal(result.changed, true);
});

test('digest, size and metadata changes are explicit but values are not leaked', () => {
  const result = compareAssetManifests(pack(baseAsset), pack({ ...baseAsset, bytes: 99,
    sha256: 'f'.repeat(64), approvalEvidence: 'secret evidence' }));
  assert.deepEqual(result.modified, [{ path, changes: ['sha256', 'bytes', 'metadata'] }]);
  assert.doesNotMatch(JSON.stringify(result), /secret evidence|private-only test/);
});

test('case-only path changes are changes, not an implicit rename', () => {
  const result = compareAssetManifests(pack(baseAsset), pack({ ...baseAsset, path: path.toUpperCase().replace('IMG/', 'img/') }));
  assert.equal(result.added.length, 1);
  assert.equal(result.removed.length, 1);
});

test('source commit update is detected even when bytes are identical', () => {
  const result = compareAssetManifests(pack(baseAsset), { ...pack(baseAsset), source: { ...source, commit: 'd'.repeat(40) } });
  assert.equal(result.summary.topLevelChanged, true);
  assert.equal(result.changed, true);
});

test('invalid, empty, colliding or unapproved manifests fail closed', () => {
  const bad = [
    pack(),
    pack({ ...baseAsset, path: '../unsafe.png' }),
    pack(baseAsset, { ...baseAsset, path: path.toUpperCase().replace('IMG/', 'img/') }),
    pack({ ...baseAsset, sha256: 'xyz' }),
    pack({ ...baseAsset, bytes: -1 }),
    pack({ ...baseAsset, approvalEvidence: '' }),
    pack({ ...baseAsset, status: 'pending' }),
    pack({ ...baseAsset, gitBlobSha: 'broken' }),
    { ...pack(baseAsset), source: { ...source, commit: 'invalid' } },
  ];
  for (const candidate of bad) assert.throws(() => compareAssetManifests(pack(baseAsset), candidate));
});

test('CLI exit 0 on unchanged manifests, exit 2 on differences, exit 1 on invalid input', () => {
  const same = runCLI(pack(baseAsset), pack(baseAsset));
  assert.equal(same.status, 0, same.stderr);
  assert.equal(JSON.parse(same.stdout).changed, false);
  const diff = runCLI(pack(baseAsset), pack(extra));
  assert.equal(diff.status, 2, diff.stderr);
  assert.equal(JSON.parse(diff.stdout).summary.added, 1);
  const invalid = runCLI(pack(baseAsset), pack());
  assert.equal(invalid.status, 1);
  assert.match(invalid.stderr, /ERROR:/);
});

test('CLI rejects duplicate or unknown flags instead of choosing an input silently', () => {
  const result = runCLI(pack(baseAsset), pack(baseAsset), ['--before', 'before.json', '--before', 'after.json']);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Usage:/);
});
