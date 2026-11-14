import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { prepareConsumerLock, writeNewLock } from '../scripts/create-consumer-lock.mjs';

function fixture(run) {
  const folder = mkdtempSync(join(tmpdir(), 'astrological-lock-'));
  const root = join(folder, 'assets');
  const paths = ['img/grafici/dark/sky.png', 'img/grafici/light/sky.png'];
  mkdirSync(join(root, 'img/grafici/dark'), { recursive: true });
  mkdirSync(join(root, 'img/grafici/light'), { recursive: true });
  const assets = paths.map((path, i) => {
    const data = Buffer.from('synthetic-chart-' + i);
    writeFileSync(join(root, ...path.split('/')), data);
    return { path, bytes: data.length, sha256: createHash('sha256').update(data).digest('hex'),
      rightsHolder: 'synthetic', permissionBasis: 'test', approvalEvidence: 'fixture only' };
  });
  const manifest = { schemaVersion: 1,
    source: { repository: 'example/virgo-stars', commit: 'a'.repeat(40), assetRoot: 'public/assets' },
    assets };
  const requirements = { schemaVersion: 1, consumer: 'Astrolabio', assets: [...paths].reverse() };
  const prepare = () => prepareConsumerLock({ assetRoot: root, manifest, requirements });
  try { return run({ folder, root, paths, assets, manifest, requirements, prepare }); }
  finally { rmSync(folder, { recursive: true, force: true }); }
}

test('stable lock from the same selected verified bytes regardless of request order', () => fixture(({ prepare, requirements, paths }) => {
  const first = prepare();
  assert.equal(first.report.verdict, 'verified');
  assert.equal(first.lock.format, 'virgostars.consumer-assets.lock');
  assert.equal(first.lock.assetCount, 2);
  assert.deepEqual(first.lock.assets.map(x => x.path), paths);
  assert.match(first.lock.revision, /^sha256:[a-f0-9]{64}$/);
  requirements.assets.reverse();
  assert.deepEqual(prepare().lock, first.lock);
}));

test('revision is pinned to source commit and verified selected bytes', () => fixture(({ prepare, manifest, requirements }) => {
  const first = prepare().lock.revision;
  manifest.source.commit = 'b'.repeat(40);
  const second = prepare().lock.revision;
  assert.notEqual(first, second);
  requirements.assets.pop();
  assert.notEqual(second, prepare().lock.revision);
}));

test('never produces a lock when a requested asset is missing or has changed', () => fixture(({ prepare, requirements, root, paths }) => {
  requirements.assets.push('img/grafici/light/not-in-manifest.png');
  let result = prepare();
  assert.equal(result.lock, null);
  assert.deepEqual(result.report.missingFromManifest, ['img/grafici/light/not-in-manifest.png']);
  requirements.assets.pop();
  writeFileSync(join(root, ...paths[0].split('/')), 'tampered');
  result = prepare();
  assert.equal(result.lock, null);
  assert.deepEqual(result.report.mismatched, [paths[0]]);
}));

test('rejects incomplete source provenance metadata instead of inventing a version', () => fixture(({ prepare, manifest }) => {
  manifest.source.commit = 'not-a-real-sha';
  assert.throws(prepare, /exact source repository/);
  manifest.source.commit = 'a'.repeat(40);
  delete manifest.source.repository;
  assert.throws(prepare, /exact source repository/);
}));

test('writes a private lock only once and never overwrites it', () => fixture(({ prepare, folder, root }) => {
  const path = join(folder, 'consumer.local.json');
  const lock = prepare().lock;
  writeNewLock(path, lock, { assetRoot: root });
  assert.deepEqual(JSON.parse(readFileSync(path, 'utf8')), lock);
  assert.throws(() => writeNewLock(path, lock, { assetRoot: root }), /EEXIST/);
  assert.throws(() => writeNewLock(join(root, 'asset-lock.json'), lock, { assetRoot: root }), /outside/);
}));

test('rejects output symlink ancestors', t => fixture(({ prepare, folder, root }) => {
  const target = join(folder, 'actual'), link = join(folder, 'link');
  mkdirSync(target);
  try { symlinkSync(target, link, process.platform === 'win32' ? 'junction' : 'dir'); }
  catch (error) {
    if (process.platform === 'win32' && ['EPERM', 'EACCES'].includes(error.code))
      return t.skip('Junction unavailable');
    throw error;
  }
  assert.throws(() => writeNewLock(join(link, 'lock.json'), prepare().lock, { assetRoot: root }), /parent|Symlink/);
}));

test('CLI can produce a versioned lock for a Charts JSON-array selection', () => fixture(({ prepare, folder, root, manifest, paths }) => {
  const script = fileURLToPath(new URL('../scripts/create-consumer-lock.mjs', import.meta.url));
  const manifestFile = join(folder, 'manifest.json'), selection = join(folder, 'selection.json'), output = join(folder, 'charts-lock.json');
  writeFileSync(manifestFile, JSON.stringify(manifest));
  writeFileSync(selection, JSON.stringify(paths));
  const args = [script, '--root', root, '--manifest', manifestFile,
    '--selection', selection, '--consumer', 'AstrologicalCharts', '--out', output];
  const run = () => spawnSync(process.execPath, args, { encoding: 'utf8' });
  let result = run();
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Created private metadata-only/);
  const lock = JSON.parse(readFileSync(output, 'utf8'));
  assert.equal(lock.consumer, 'AstrologicalCharts');
  assert.equal(lock.assetCount, paths.length);
  result = run();
  assert.equal(result.status, 1, 'must not overwrite an existing lock');
}));

test('CLI refuses blocked selections before creating any output', () => fixture(({ folder, root, manifest, requirements }) => {
  const script = fileURLToPath(new URL('../scripts/create-consumer-lock.mjs', import.meta.url));
  const manifestFile = join(folder, 'manifest.json'), req = join(folder, 'requirements.json'), out = join(folder, 'blocked-lock.json');
  requirements.assets.push('img/grafici/unknown.png');
  writeFileSync(manifestFile, JSON.stringify(manifest));
  writeFileSync(req, JSON.stringify(requirements));
  const result = spawnSync(process.execPath,
    [script, '--root', root, '--manifest', manifestFile, '--requirements', req, '--out', out],
    { encoding: 'utf8' });
  assert.equal(result.status, 2, result.stderr);
  assert.equal(existsSync(out), false);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /missingFromManifest/);
}));

test('CLI stdout format and invalid parameter combinations', () => fixture(({ folder, root, manifest, requirements }) => {
  const script = fileURLToPath(new URL('../scripts/create-consumer-lock.mjs', import.meta.url));
  const manifestFile = join(folder, 'manifest.json'), req = join(folder, 'requirements.json');
  writeFileSync(manifestFile, JSON.stringify(manifest));
  writeFileSync(req, JSON.stringify(requirements));
  const base = [script, '--root', root, '--manifest', manifestFile, '--requirements', req];
  const exec = (...rest) => spawnSync(process.execPath, [...base, ...rest], { encoding: 'utf8' });
  const success = exec();
  assert.equal(success.status, 0, success.stderr);
  assert.equal(JSON.parse(success.stdout).consumer, 'Astrolabio');
  assert.equal(exec('--consumer', 'Ambiguous').status, 1);
  assert.equal(exec('--requirements', req).status, 1);
}));
