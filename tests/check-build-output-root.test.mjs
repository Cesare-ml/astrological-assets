import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectBuildOutput } from '../scripts/check-build-output.mjs';

const script = fileURLToPath(new URL('../scripts/check-build-output.mjs', import.meta.url));
const assetPath = 'img/simboli/segni/aries.png';

function fixture(callback) {
  const sandbox = mkdtempSync(join(tmpdir(), 'astro-build-root-'));
  const buildRoot = join(sandbox, 'real', 'dist');
  const bytes = Buffer.from('synthetic build asset');
  const manifest = {
    schemaVersion: 1,
    assets: [{
      path: assetPath, bytes: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      rightsHolder: 'fixture', permissionBasis: 'synthetic test',
      approvalEvidence: 'fixture only',
    }],
  };
  const target = join(buildRoot, 'assets', ...assetPath.split('/'));
  mkdirSync(join(buildRoot, 'assets', 'img', 'simboli', 'segni'), { recursive: true });
  writeFileSync(target, bytes);
  const manifestPath = join(sandbox, 'manifest.json');
  writeFileSync(manifestPath, JSON.stringify(manifest));
  const run = root => spawnSync(process.execPath, [
    script, '--build', root, '--manifest', manifestPath,
  ], { encoding: 'utf8' });
  try { return callback({ sandbox, buildRoot, manifest, run }); }
  finally { rmSync(sandbox, { recursive: true, force: true }); }
}

function directoryLink(t, from, to) {
  try { symlinkSync(from, to, process.platform === 'win32' ? 'junction' : 'dir'); }
  catch (error) {
    if (process.platform === 'win32' && ['EPERM', 'EACCES'].includes(error.code)) {
      t.skip('Junction unavailable');
      return false;
    }
    throw error;
  }
  return true;
}

test('direct canonical output root is accepted by library and CLI', () =>
  fixture(({ buildRoot, manifest, run }) => {
    assert.equal(inspectBuildOutput({ buildRoot, manifest }).verdict, 'verified');
    const output = run(buildRoot);
    assert.equal(output.status, 0, output.stderr);
    assert.equal(JSON.parse(output.stdout).verdict, 'verified');
  }));

test('a symlinked parent is rejected even if the final directory is real', t =>
  fixture(({ sandbox, manifest, run }) => {
    const alias = join(sandbox, 'alias');
    if (!directoryLink(t, join(sandbox, 'real'), alias)) return;
    const throughAlias = join(alias, 'dist');
    assert.throws(() => inspectBuildOutput({ buildRoot: throughAlias, manifest }),
      /Symlink in build root path/);
    const output = run(throughAlias);
    assert.equal(output.status, 1);
    assert.match(output.stderr, /Symlink in build root path/);
  }));

test('a symlinked build root itself is rejected', t =>
  fixture(({ sandbox, buildRoot, manifest }) => {
    const alias = join(sandbox, 'dist-alias');
    if (!directoryLink(t, buildRoot, alias)) return;
    assert.throws(() => inspectBuildOutput({ buildRoot: alias, manifest }),
      /Symlink in build root path/);
  }));

test('missing build root cannot be interpreted as a successful empty output', () =>
  fixture(({ sandbox, manifest, run }) => {
    const missing = join(sandbox, 'missing');
    assert.throws(() => inspectBuildOutput({ buildRoot: missing, manifest }));
    const output = run(missing);
    assert.equal(output.status, 1);
  }));
