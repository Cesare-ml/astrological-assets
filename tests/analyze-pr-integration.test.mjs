import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { analyzePrIntegration } from '../scripts/analyze-pr-integration.mjs';

const sample = () => ({
  schemaVersion:1, defaultBranch:'main', mainSha:'a'.repeat(40),
  capturedDate:'2026-11-14',
  prs:[
    {number:1,base:'main',head:'feat/parent',files:['README.md','package.json'],draft:false},
    {number:2,base:'feat/parent',head:'feat/child',files:['package.json','scripts/a.mjs'],draft:true},
    {number:3,base:'main',head:'fix/unrelated',files:['README.md','package.json'],draft:true},
    {number:4,base:'main',head:'fix/disjoint',files:['scripts/z.mjs'],draft:false},
  ],
});

test('orders parent before child and distinguishes independent filename overlaps', () => {
  const result = analyzePrIntegration(sample());
  assert.deepEqual(result.order, [1,2,3,4]);
  assert.deepEqual(result.chains, [{pr:2, requires:1}]);
  assert.deepEqual(result.draftPrs, [2,3]);
  assert.deepEqual(result.potentialOverlaps, [
    {left:1,right:3,shared:['README.md','package.json']},
    {left:2,right:3,shared:['package.json']},
  ]);
});

test('excludes overlaps inherited through any length of dependency chain', () => {
  const input = sample();
  input.prs.splice(2,2, {number:3,base:'feat/child',head:'feat/grandchild',
    files:['README.md','package.json'],draft:true});
  assert.deepEqual(analyzePrIntegration(input).potentialOverlaps, []);
  assert.deepEqual(analyzePrIntegration(input).chains,
    [{pr:2,requires:1},{pr:3,requires:2}]);
});

test('rejects unknown bases and circular PR dependencies', () => {
  const input = sample();
  input.prs[1].base = 'feat/absent';
  assert.throws(() => analyzePrIntegration(input), /Unknown parent PR branch/);
  input.prs[1].base = 'feat/parent';
  input.prs[0].base = 'feat/child';
  assert.throws(() => analyzePrIntegration(input), /dependency cycle/);
});

test('rejects duplicate PR number, duplicate head and self-references', () => {
  const input = sample();
  input.prs[1].number = 1;
  assert.throws(() => analyzePrIntegration(input), /Duplicate PR/);
  input.prs[1].number = 2;
  input.prs[1].head = 'feat/parent';
  assert.throws(() => analyzePrIntegration(input), /Duplicate PR/);
  input.prs[1].head = 'feat/child';
  input.prs[1].base = 'feat/child';
  assert.throws(() => analyzePrIntegration(input), /Self-dependent/);
});

test('fails closed for invalid snapshot integrity and unsafe file paths', () => {
  const input = sample();
  for (const bad of [
    {...input,schemaVersion:0},
    {...input,mainSha:'not-a-commit'},
    {...input,prs:[]},
    {...input,defaultBranch:'develop'},
  ]) assert.throws(() => analyzePrIntegration(bad), /Invalid integration snapshot header/);
  for (const file of ['../secrets', '/etc/passwd', 'a//b', 'a/./b', 'a\\b', 'caf\u0065\u0301.png']) {
    const changed = sample(); changed.prs[0].files=[file];
    assert.throws(() => analyzePrIntegration(changed), /Invalid PR metadata/);
  }
});

test('requires distinct file records, stable branch tokens and boolean draft', () => {
  for (const change of [
    {files:['README.md','README.md']},
    {base:'feature;rm -rf'},
    {head:'../invalid'},
    {draft:'false'},
    {number:0},
  ]) {
    const input=sample();
    Object.assign(input.prs[0],change);
    assert.throws(() => analyzePrIntegration(input), /Invalid PR metadata/);
  }
});

test('CLI reads local snapshot without changing its contents', () => {
  const dir=mkdtempSync(join(tmpdir(),'astro-pr-plan-'));
  try {
    const path=join(dir,'snapshot.json');
    const raw=JSON.stringify(sample(),null,2)+'\n';
    writeFileSync(path,raw);
    const cli=fileURLToPath(new URL('../scripts/analyze-pr-integration.mjs',import.meta.url));
    const run=spawnSync(process.execPath,[cli,path],{cwd:dir,encoding:'utf8'});
    assert.equal(run.status,0,run.stderr);
    assert.deepEqual(JSON.parse(run.stdout).order,[1,2,3,4]);
    assert.equal(readFileSync(path,'utf8'),raw);
    const bad=spawnSync(process.execPath,[cli,'--unsafe'],{cwd:dir,encoding:'utf8'});
    assert.equal(bad.status,1);
    assert.match(bad.stderr,/PR INTEGRATION PLAN BLOCKED/);
  } finally {rmSync(dir,{recursive:true,force:true});}
});
