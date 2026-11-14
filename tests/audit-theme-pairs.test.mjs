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
const approved = path => ({
  path, bytes: 1, sha256: 'a'.repeat(64), gitBlobSha: 'b'.repeat(40), rightsHolder: 'test author',
  permissionBasis: 'synthetic private test asset', approvalEvidence: 'fixture only',
});
const manifest = assets => ({ schemaVersion: 1, assets: assets.map(approved) });
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
  assert.throws(() => auditThemePairs(manifest([...paths, overlay + 'light/te\u0301st.png', overlay + 'light/t\u00e9st.png']), register), /Non-canonical Unicode/);
});

test('noncanonical Unicode paths, unsupported types and asset roots are rejected', () => {
  const decomposed = overlay + 'light/te\u0301st.png';
  assert.throws(() => auditThemePairs(manifest([...paths, decomposed]), register), /Non-canonical Unicode/);
  assert.throws(() => auditThemePairs(manifest([...paths, 'fonts/te\u0301st.woff2']), register), /Non-canonical Unicode/);
  assert.throws(() => auditThemePairs(manifest([...paths, 'img/unknown/new.exe']), register), /Unsupported asset type/);
  assert.throws(() => auditThemePairs(manifest([...paths, 'private/account.png']), register), /Unsafe asset path/);
  assert.throws(() => auditThemePairs(manifest([...paths, 'img/not-an-asset']), register), /Unsupported asset type/);
});

test('noncanonical Unicode exception names cannot silently authorize differences', () => {
  const exceptions = { schemaVersion: 1, exceptions: [{
    ...register.exceptions[0], relativePath: 'te\u0301xture-carta-panna.png',
  }] };
  assert.throws(() => auditThemePairs(manifest(paths), exceptions), /Non-canonical Unicode/);
});

test('URL-ambiguous manifest paths and exception filenames fail closed for Charts consumers', () => {
  for (const bad of ['planet%20glyph.png', 'planet%2fMoon.png', 'planet#dark.png']) {
    assert.throws(
      () => auditThemePairs(manifest([...paths, overlay + 'light/' + bad]), register),
      /URL-ambiguous asset path/,
    );
    assert.throws(
      () => auditThemePairs(manifest(paths), {
        schemaVersion: 1,
        exceptions: [{ ...register.exceptions[0], relativePath: bad }],
      }),
      /URL-ambiguous asset path/,
    );
  }
});

test('Windows-incompatible asset names are rejected before offline integration', () => {
  for (const name of ['CON.png', 'aux.png', 'COM1.png', 'Lpt9.png',
    'planet?.png', 'planet*.png', 'planet|x.png', 'planet .png.']) {
    const attempted = manifest([...paths, overlay + 'light/' + name]);
    assert.throws(() => auditThemePairs(attempted, register), /Windows-incompatible/);
  }
});

test('wrongly cased chart family paths are never silently ignored', () => {
  for (const path of [
    'img/Grafici/light/extra.png',
    'IMG/grafici/light/extra.png',
    'img/Symbols/planets/light/_circle/extra.png',
  ]) {
    const expected = path.startsWith('IMG/') ? /Unsafe asset path/ : /Chart family path casing mismatch/;
    assert.throws(() => auditThemePairs(manifest([...paths, path]), register), expected);
  }
});

test('exception spelling and case must exactly match a manifest filename', () => {
  const wrongCase = { schemaVersion: 1, exceptions: [{
    ...register.exceptions[0], relativePath: 'Texture-carta-panna.png',
  }] };
  const result = auditThemePairs(manifest(paths), wrongCase);
  assert.equal(result.verdict, 'blocked');
  assert.equal(result.approvedExceptions.length, 0);
  assert.equal(result.missingCounterparts.length, 1);
  assert.equal(result.staleExceptions.length, 1);
});

test('pending and incomplete approved-manifest metadata cannot pass', () => {
  const baseline = manifest(paths);
  for (const patch of [
    { status: 'pending' }, { bytes: -1 }, { bytes: 1.5 }, { sha256: 'bad' },
    { gitBlobSha: undefined }, { gitBlobSha: 'BAD' }, { gitBlobSha: 'C'.repeat(40) },
    { rightsHolder: '' }, { permissionBasis: '' }, { approvalEvidence: '' },
  ]) {
    const changed = { ...baseline, assets: [{ ...baseline.assets[0], ...patch }, ...baseline.assets.slice(1)] };
    assert.throws(() => auditThemePairs(changed, register), /not approved|hash or size|Git blob SHA-1|approval metadata/);
  }
});

test('source Git blob metadata must have a canonical lowercase SHA-1 format', () => {
  const base = manifest(paths);
  for (const value of [null, undefined, '', 'a'.repeat(39), 'A'.repeat(40), 'z'.repeat(40)]) {
    const modified = { ...base, assets: [{ ...base.assets[0], gitBlobSha: value }, ...base.assets.slice(1)] };
    assert.throws(() => auditThemePairs(modified, register), /Invalid manifest Git blob SHA-1/);
  }
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

test('unknown, wrongly cased or incomplete theme directories are rejected', () => {
  for (const path of [
    overlay + 'LIGHT/new.png', overlay + 'Dark/new.png', overlay + 'sepia/new.png',
    overlay + 'light', planets + 'BLUE/_circle/Neptune.png',
  ]) {
    const expected = path === overlay + 'light' ? /Unsupported asset type/ : /Unexpected chart theme/;
    assert.throws(() => auditThemePairs(manifest([...paths, path]), register), expected);
  }
});

test('the audit cannot pass if an entire chart theme family disappears', () => {
  for (const prefix of [overlay, planets]) {
    const result = auditThemePairs(manifest(paths.filter(p => !p.startsWith(prefix))), register);
    assert.equal(result.verdict, 'blocked');
    assert.equal(result.emptyFamilies.length, 1);
  }
});

test('committed manifest has 26 overlay pairs, 23 planet pairs, one documented exception', () => {
  const realManifest = JSON.parse(readFileSync(join(repo, 'manifests/approved-assets.json'), 'utf8'));
  const realExceptions = JSON.parse(readFileSync(join(repo, 'manifests/theme-pair-exceptions.json'), 'utf8'));
  const result = auditThemePairs(realManifest, realExceptions);
  assert.equal(result.verdict, 'verified');
  assert.deepEqual(result.families.map(f => [f.lightCount, f.darkCount, f.pairedCount]), [[27, 26, 26], [23, 23, 23]]);
  assert.equal(result.approvedExceptions.length, 1);
});
