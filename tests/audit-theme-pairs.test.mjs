import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditThemePairs } from '../scripts/audit-theme-pairs.mjs';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..');
const overlay = 'img/grafici/';
const planets = 'img/symbols/planets/';
const paths = [
  overlay + 'light/cartaastrale-case.png', overlay + 'dark/cartaastrale-case.png',
  overlay + 'light/texture-carta-panna.png',
  planets + 'light/_circle/Sun.png', planets + 'dark/_circle/Sun.png',
  'img/simboli/segni/01.png',
];
const manifest = assets => ({ schemaVersion: 1, assets: assets.map(path => ({ path })) });
const register = { schemaVersion: 1, exceptions: [{ family: 'chart-overlays', relativePath: 'texture-carta-panna.png', only: 'light', reason: 'Light-only' }] };

test('known light-only texture is an explicit exception, and both families are paired', () => {
  const result = auditThemePairs(manifest(paths), register);
  assert.equal(result.verdict, 'verified');
  assert.deepEqual(result.families.map(f => f.pairedCount), [1, 1]);
  assert.equal(result.approvedExceptions.length, 1);
  assert.deepEqual(result.missingCounterparts, []);
});

test('new missing dark artwork blocks the audit', () => {
  const result = auditThemePairs(manifest([...paths, overlay + 'light/new.png']), register);
  assert.equal(result.verdict, 'blocked');
  assert.deepEqual(result.missingCounterparts, [{ family: 'chart-overlays', relativePath: 'new.png', only: 'light', missingTheme: 'dark' }]);
});

test('missing light circle glyph blocks the audit', () => {
  const result = auditThemePairs(manifest(paths.filter(p => p !== planets + 'light/_circle/Sun.png')), register);
  assert.equal(result.verdict, 'blocked');
  assert.equal(result.missingCounterparts[0].missingTheme, 'light');
});

test('exceptions become stale if their asset disappears or gains a counterpart', () => {
  for (const list of [paths.filter(p => !p.endsWith('texture-carta-panna.png')),
    [...paths, overlay + 'dark/texture-carta-panna.png']]) {
    const result = auditThemePairs(manifest(list), register);
    assert.equal(result.verdict, 'blocked');
    assert.equal(result.staleExceptions.length, 1);
  }
});

test('unsafe manifest paths and cross-platform path collisions fail closed', () => {
  assert.throws(() => auditThemePairs(manifest([...paths, '../secret.png']), register), /Unsafe/);
  assert.throws(() => auditThemePairs(manifest([...paths, overlay + 'LIGHT/cartaastrale-case.png']), register), /case-colliding/);
  assert.throws(() => auditThemePairs(manifest([...paths, overlay + 'light/te\u0301st.png', overlay + 'light/t\u00e9st.png']), register), /case-colliding/);
});

test('invalid, repeated, or dangerous exceptions fail closed', () => {
  assert.throws(() => auditThemePairs(manifest(paths), { schemaVersion: 1, exceptions: [{ ...register.exceptions[0], relativePath: '../oops.png' }] }), /Unsafe/);
  assert.throws(() => auditThemePairs(manifest(paths), { schemaVersion: 1, exceptions: [...register.exceptions, ...register.exceptions] }), /Duplicate/);
  assert.throws(() => auditThemePairs(manifest(paths), { schemaVersion: 1, exceptions: [{ ...register.exceptions[0], reason: ' ' }] }), /Invalid/);
});

test('CLI uses distinct success, parity-block, and invalid-input exit codes without writing', () => {
  const dir = mkdtempSync(join(tmpdir(), 'theme-parity-'));
  const file = join(dir, 'manifest.json'), exceptionFile = join(dir, 'exceptions.json');
  const run = () => spawnSync(process.execPath, [join(repo, 'scripts/audit-theme-pairs.mjs'), '--manifest', file, '--exceptions', exceptionFile], { encoding: 'utf8' });
  try {
    writeFileSync(exceptionFile, JSON.stringify(register));
    writeFileSync(file, JSON.stringify(manifest(paths)));
    assert.equal(run().status, 0);
    writeFileSync(file, JSON.stringify(manifest([...paths, overlay + 'dark/unpaired.png'])));
    assert.equal(run().status, 2);
    writeFileSync(file, '{invalid');
    assert.equal(run().status, 1);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('committed manifest has 26 overlay pairs, 23 planet pairs, one documented exception', () => {
  const realManifest = JSON.parse(readFileSync(join(repo, 'manifests/approved-assets.json'), 'utf8'));
  const realExceptions = JSON.parse(readFileSync(join(repo, 'manifests/theme-pair-exceptions.json'), 'utf8'));
  const result = auditThemePairs(realManifest, realExceptions);
  assert.equal(result.verdict, 'verified');
  assert.deepEqual(result.families.map(f => [f.lightCount, f.darkCount, f.pairedCount]), [[27, 26, 26], [23, 23, 23]]);
  assert.equal(result.approvedExceptions.length, 1);
});
