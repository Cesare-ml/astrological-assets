import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { analyzePrIntegration, comparePrSnapshots } from '../scripts/analyze-pr-integration.mjs';

const sample = () => ({
  schemaVersion:1, defaultBranch:'main', mainSha:'a'.repeat(40),
  capturedDate:'2026-11-14',
  prs:[
    {number:1,base:'main',head:'feat/parent',headSha:'1'.repeat(40),files:['README.md','package.json'],draft:false},
    {number:2,base:'feat/parent',head:'feat/child',headSha:'2'.repeat(40),files:['package.json','scripts/a.mjs'],draft:true},
    {number:3,base:'main',head:'fix/unrelated',headSha:'3'.repeat(40),files:['README.md','package.json'],draft:true},
    {number:4,base:'main',head:'fix/disjoint',headSha:'4'.repeat(40),files:['scripts/z.mjs'],draft:false},
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
  input.prs.splice(2,2, {number:3,base:'feat/child',head:'feat/grandchild',headSha:'3'.repeat(40),
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

test('pins each PR to an exact lowercase SHA-1 head commit', () => {
  const result = analyzePrIntegration(sample());
  assert.deepEqual(result.pinnedHeads, [
    {pr:1,sha:'1'.repeat(40)}, {pr:2,sha:'2'.repeat(40)},
    {pr:3,sha:'3'.repeat(40)}, {pr:4,sha:'4'.repeat(40)},
  ]);
  for (const value of [undefined, 'not-a-hash', 'A'.repeat(40), 'a'.repeat(64)]) {
    const input=sample(); input.prs[0].headSha=value;
    assert.throws(()=>analyzePrIntegration(input),/Invalid PR metadata/);
  }
});

test('same snapshot compares fresh regardless of PR/file array ordering', () => {
  const before=sample(), after=structuredClone(before);
  after.prs.reverse(); after.prs[2].files.reverse(); after.capturedDate='2026-11-15';
  const result=comparePrSnapshots(before,after);
  assert.equal(result.readyForReview,true);
  assert.deepEqual(result.changes,[]);
});

test('detects main and head SHA drift instead of claiming the snapshot current', () => {
  const before=sample(), after=structuredClone(before);
  after.mainSha='b'.repeat(40);
  after.prs[1].headSha='f'.repeat(40);
  const result=comparePrSnapshots(before,after);
  assert.equal(result.readyForReview,false);
  assert.deepEqual(result.changes.map(item=>item.kind),[
    'main-advanced','pr-headSha-changed',
  ]);
});

test('detects added, removed and changed PR metadata including files', () => {
  const before=sample(), after=structuredClone(before);
  after.prs=after.prs.filter(pr=>pr.number!==4);
  // The new PR is independent; it has valid branch and path metadata.
  after.prs.push({
    number:5,base:'main',head:'feat/new',headSha:'5'.repeat(40),
    files:['scripts/new.mjs'],draft:true,
  });
  after.prs[0].draft=true;
  after.prs[1].files=['scripts/a.mjs','scripts/new.js'];
  after.prs[2].head='fix/renamed';
  const result=comparePrSnapshots(before,after);
  assert.equal(result.readyForReview,false);
  assert.deepEqual(result.changes.map(item=>item.kind),[
    'pr-draft-changed','pr-files-changed','pr-head-changed',
    'pr-removed','pr-added',
  ]);
});

test('refuses invalid current snapshots before comparing two PR plans', () => {
  const before=sample(), after=structuredClone(before);
  delete after.prs[0].headSha;
  assert.throws(()=>comparePrSnapshots(before,after),/Invalid PR metadata/);
  assert.throws(()=>comparePrSnapshots({...before,mainSha:'broken'},sample()),
    /Invalid integration snapshot header/);
});

test('CLI exits 0 for a matching fresh snapshot and 2 when main/head changed', () => {
  const dir=mkdtempSync(join(tmpdir(),'astro-pr-drift-'));
  try {
    const before=join(dir,'baseline.json'),after=join(dir,'current.json');
    const baseline=sample(),current=structuredClone(baseline);
    writeFileSync(before,JSON.stringify(baseline));
    writeFileSync(after,JSON.stringify(current));
    const cli=fileURLToPath(new URL('../scripts/analyze-pr-integration.mjs',import.meta.url));
    const run=()=>spawnSync(process.execPath,[cli,before,'--current',after],
      {cwd:dir,encoding:'utf8'});
    const same=run();
    assert.equal(same.status,0,same.stderr);
    assert.equal(JSON.parse(same.stdout).freshness.readyForReview,true);
    current.prs[0].headSha='f'.repeat(40);
    writeFileSync(after,JSON.stringify(current));
    const stale=run();
    assert.equal(stale.status,2,stale.stderr);
    assert.deepEqual(JSON.parse(stale.stdout).freshness.changes.map(x=>x.kind),
      ['pr-headSha-changed']);
  } finally {rmSync(dir,{recursive:true,force:true});}
});

test('the committed 2026-11-14 snapshot pins all recorded PR head commits', () => {
  const snapshot = JSON.parse(readFileSync(
    new URL('../docs/pr-integration-snapshot-2026-11-14.json', import.meta.url), 'utf8'));
  const result = analyzePrIntegration(snapshot);
  assert.equal(result.prCount, 22);
  assert.equal(result.pinnedHeads.length, 22);
  assert.ok(result.pinnedHeads.every(item => /^[a-f0-9]{40}$/.test(item.sha)));
  assert.deepEqual(result.chains, [
    {pr:11, requires:9}, {pr:17, requires:14}, {pr:25, requires:22},
    {pr:27, requires:25}, {pr:28, requires:27}, {pr:29, requires:28},
  ]);
  assert.equal(result.potentialOverlaps.length, 110);
});

test('stale pinned snapshot detects a newly stacked child PR', () => {
  const baseline=JSON.parse(readFileSync(
    new URL('../docs/pr-integration-snapshot-2026-11-14.json', import.meta.url),'utf8'));
  const current=structuredClone(baseline);
  current.prs.push({
    number:30,
    base:'feat/agent-review-interop-schemas-20261114',
    head:'feat/review-progress-census-20261114',
    headSha:'c2c94fadfcf33c664aaf86e58bf0767a64584304',
    draft:true,
    files:['README.md','docs/AGENT_REVIEW_PROGRESS_CENSUS.md','package.json',
      'scripts/review-progress-census.mjs','tests/review-progress-census.test.mjs'],
  });
  const result=comparePrSnapshots(baseline,current);
  assert.equal(result.readyForReview,false);
  assert.deepEqual(result.changes,[{kind:'pr-added',pr:30}]);
  assert.ok(analyzePrIntegration(current).chains.some(x=>x.pr===30 && x.requires===29));
});
