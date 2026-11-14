import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('../scripts/refresh-source-catalog.mjs', import.meta.url));
const git = (repo, ...args) => {
  const run = spawnSync('git', ['-C', repo, ...args], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
};
function fixture(callback) {
  const root = mkdtempSync(join(tmpdir(), 'astro-refresh-cli-'));
  const repo = join(root, 'virgo-stars');
  const bytes = join(repo, 'public', 'assets', 'img', 'simboli', 'segni');
  mkdirSync(bytes, { recursive: true });
  writeFileSync(join(bytes, '01.png'), 'test fixture only');
  git(repo, 'init');
  git(repo, 'add', '.');
  git(repo, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-m', 'Synthetic candidate');
  const run = (...args) => spawnSync(process.execPath, [script, '--repo', repo, ...args], {
    encoding: 'utf8', cwd: root,
  });
  try { return callback({ root, repo, run }); }
  finally { rmSync(root, { recursive: true, force: true }); }
}

test('dry run inspects a real local Git tree but never writes', () => fixture(({ root, run }) => {
  const result = run();
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Candidate paths: 1 bytes: 17/);
  assert.equal(run('--out', join(root, 'out.local.json')).status, 1);
}));

test('explicit write creates only a new local snapshot', () => fixture(({ root, run }) => {
  const target = join(root, 'out.local.json');
  const first = run('--write', '--out', target);
  assert.equal(first.status, 0, first.stderr);
  const result = JSON.parse(readFileSync(target, 'utf8'));
  assert.equal(result.rightsStatus, 'unreviewed');
  assert.equal(result.fileCount, 1);
  assert.equal(result.files[0].path, 'img/simboli/segni/01.png');
  const second = run('--write', '--out', target);
  assert.equal(second.status, 1);
  assert.match(second.stderr, /EEXIST/);
}));

test('rejects writes to source checkout and canonical-looking filenames', () => fixture(({ root, repo, run }) => {
  const inside = run('--write', '--out', join(repo, 'new.local.json'));
  assert.equal(inside.status, 1);
  assert.match(inside.stderr, /source repository/);
  const notLocal = run('--write', '--out', join(root, 'upstream-candidates.json'));
  assert.equal(notLocal.status, 1);
  assert.match(notLocal.stderr, /\.local\.json/);
}));

test('rejects missing, repeated or malformed command flags', () => fixture(({ root, run }) => {
  for (const args of [['--write'], ['--write', '--out'], ['--write', '--write', '--out', join(root, 'out.local.json')], ['--repo'], ['--unknown']]) {
    const result=run(...args);
    assert.equal(result.status,1,JSON.stringify(args));
  }
}));
