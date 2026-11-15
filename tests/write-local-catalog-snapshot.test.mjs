import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeLocalCatalogSnapshot } from '../scripts/write-local-catalog-snapshot.mjs';

const catalog = {
  schemaVersion: 1,
  source: { repository: 'Cesare-ml/virgo-stars', assetRoot: 'public/assets', commit: 'a'.repeat(40) },
  fileCount: 1,
  rightsStatus: 'unreviewed',
  files: [{ path: 'img/simboli/segni/01.png', bytes: 2, gitBlobSha: 'b'.repeat(40), legacy: false }],
};
function fixture(callback) {
  const root = mkdtempSync(join(tmpdir(), 'astro-catalog-refresh-'));
  const source = join(root, 'virgo-stars');
  const workspace = join(root, 'astrological-assets');
  mkdirSync(source); mkdirSync(workspace);
  for (const path of ['.git', 'catalog', 'docs', 'manifests', 'public', 'scripts', 'tests', '.tmp'])
    mkdirSync(join(workspace, path));
  try { return callback({ root, source, workspace }); }
  finally { rmSync(root, { recursive: true, force: true }); }
}
const write = (ctx, output, data = catalog) => writeLocalCatalogSnapshot({
  output, catalog: data, repositoryRoot: ctx.workspace, sourceRepoRoot: ctx.source,
});

test('new local snapshot is exclusive and metadata-only', () => fixture(ctx => {
  const target = join(ctx.workspace, 'catalog-snapshot.local.json');
  assert.equal(write(ctx, target), target);
  assert.deepEqual(JSON.parse(readFileSync(target, 'utf8')), catalog);
  assert.throws(() => write(ctx, target), /EEXIST/);
  if (process.platform !== 'win32') assert.equal(statSync(target).mode & 0o777, 0o600);
}));

test('ignored temporary directory is a valid output', () => fixture(ctx => {
  const target = join(ctx.workspace, '.tmp', 'snapshot.local.json');
  assert.equal(write(ctx, target), target);
}));

test('never overwrites canonical or other tracked files', () => fixture(ctx => {
  const target = join(ctx.workspace, 'catalog', 'upstream-candidates.json');
  writeFileSync(target, 'do not overwrite');
  assert.throws(() => write(ctx, target), /\.local\.json/);
  assert.equal(readFileSync(target, 'utf8'), 'do not overwrite');
  assert.throws(() => write(ctx, join(ctx.workspace, 'catalog', 'candidate.local.json')), /protected/);
}));

test('protects every authoritative repository directory', () => fixture(ctx => {
  for (const name of ['.git', 'catalog', 'docs', 'manifests', 'public', 'scripts', 'tests'])
    assert.throws(() => write(ctx, join(ctx.workspace, name, 'candidate.local.json')), /protected/);
}));

test('refuses to write inside source VirgoStars checkout', () => fixture(ctx => {
  assert.throws(() => write(ctx, join(ctx.source, 'candidate.local.json')), /source repository/);
}));

test('refuses approved or inconsistent catalog metadata', () => fixture(ctx => {
  const target = join(ctx.workspace, 'candidate.local.json');
  for (const changed of [
    { ...catalog, rightsStatus: 'approved' },
    { ...catalog, files: [] },
    { ...catalog, fileCount: 2 },
    { ...catalog, source: { ...catalog.source, commit: 'not-a-commit' } },
  ]) assert.throws(() => write(ctx, target, changed), /unreviewed/);
}));

test('rejects missing or symlinked parent directories', t => fixture(ctx => {
  assert.throws(() => write(ctx, join(ctx.workspace, 'missing', 'candidate.local.json')), /ENOENT/);
  const alias = join(ctx.workspace, 'alias');
  try { symlinkSync(join(ctx.workspace, '.tmp'), alias, process.platform === 'win32' ? 'junction' : 'dir'); }
  catch (error) {
    if (process.platform === 'win32' && ['EPERM', 'EACCES'].includes(error.code)) return t.skip('Junctions unavailable');
    throw error;
  }
  assert.throws(() => write(ctx, join(alias, 'candidate.local.json')), /Unsafe snapshot output parent/);
}));

test('refuses an existing symlink destination without changing target', t => fixture(ctx => {
  const existing = join(ctx.workspace, '.tmp', 'existing.local.json');
  writeFileSync(existing, 'untouched');
  try { symlinkSync(existing, join(ctx.workspace, 'candidate.local.json')); }
  catch (error) {
    if (process.platform === 'win32' && ['EPERM', 'EACCES'].includes(error.code)) return t.skip('Symlinks unavailable');
    throw error;
  }
  assert.throws(() => write(ctx, join(ctx.workspace, 'candidate.local.json')), /EEXIST/);
  assert.equal(readFileSync(existing, 'utf8'), 'untouched');
}));
