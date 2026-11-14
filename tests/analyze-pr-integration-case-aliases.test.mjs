import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { analyzePrIntegration, comparePrSnapshots } from '../scripts/analyze-pr-integration.mjs';

const snapshot = () => ({
  schemaVersion:1, defaultBranch:'main', capturedDate:'2026-11-14', mainSha:'a'.repeat(40),
  prs:[
    {number:1,base:'main',head:'feat/first',headSha:'1'.repeat(40),draft:false,files:['img/Icon.png']},
    {number:2,base:'main',head:'feat/second',headSha:'2'.repeat(40),draft:true,files:['img/icon.png']},
  ],
});

test('independent case-folded aliases produce their own warning without exact overlaps', () => {
  const report=analyzePrIntegration(snapshot());
  assert.deepEqual(report.potentialOverlaps, []);
  assert.deepEqual(report.caseVariantOverlaps, [
    {left:1,right:2,aliases:[{leftPath:'img/Icon.png',rightPath:'img/icon.png'}]},
  ]);
});

test('identical filenames still report only existing exact overlap shape', () => {
  const s=snapshot();
  s.prs[1].files=['img/Icon.png'];
  const report=analyzePrIntegration(s);
  assert.deepEqual(report.potentialOverlaps,[{left:1,right:2,shared:['img/Icon.png']}]);
  assert.deepEqual(report.caseVariantOverlaps,[]);
});

test('parents and stacked children are excluded from case-variant warnings', () => {
  const s=snapshot();
  s.prs[1].base='feat/first';
  const report=analyzePrIntegration(s);
  assert.deepEqual(report.chains,[{pr:2,requires:1}]);
  assert.deepEqual(report.caseVariantOverlaps,[]);
});

test('case aliases in different directories are not conflated', () => {
  const s=snapshot();
  s.prs[1].files=['assets/icon.png'];
  assert.deepEqual(analyzePrIntegration(s).caseVariantOverlaps,[]);
});

test('one PR cannot silently contain colliding filenames on Windows', () => {
  const s=snapshot();
  s.prs[0].files=['img/Icon.png','img/icon.png'];
  assert.throws(()=>analyzePrIntegration(s),/Invalid PR metadata: 1/);
});

test('NFC Unicode casing also identifies portable filename aliases', () => {
  const s=snapshot();
  s.prs[0].files=['img/Étoile.png'];
  s.prs[1].files=['img/étoile.png'];
  assert.deepEqual(analyzePrIntegration(s).caseVariantOverlaps,[
    {left:1,right:2,aliases:[{leftPath:'img/Étoile.png',rightPath:'img/étoile.png'}]},
  ]);
});

test('warnings are deterministic regardless of incoming PR or file array order', () => {
  const s=snapshot();
  s.prs[0].files=['img/Beta.png','img/Alpha.png'];
  s.prs[1].files=['img/alpha.png','img/beta.png'];
  const r1=analyzePrIntegration(s).caseVariantOverlaps;
  s.prs.reverse();
  s.prs[0].files.reverse();
  assert.deepEqual(analyzePrIntegration(s).caseVariantOverlaps,r1);
});

test('snapshot comparison remains hash-pinned and unaffected by added warnings', () => {
  const s=snapshot();
  const current=structuredClone(s);
  assert.equal(comparePrSnapshots(s,current).readyForReview,true);
  current.prs[0].headSha='f'.repeat(40);
  assert.deepEqual(comparePrSnapshots(s,current).changes.map(item=>item.kind),['pr-headSha-changed']);
});

test('actual Node CLI reports case aliases while preserving local snapshot bytes', () => {
  const dir=mkdtempSync(join(tmpdir(),'astro-case-alias-'));
  try {
    const filepath=join(dir,'snapshot.json');
    const raw=JSON.stringify(snapshot(),null,2)+'\n';
    writeFileSync(filepath,raw);
    const cli=fileURLToPath(new URL('../scripts/analyze-pr-integration.mjs',import.meta.url));
    const run=spawnSync(process.execPath,[cli,filepath],{cwd:dir,encoding:'utf8'});
    assert.equal(run.status,0,run.stderr);
    assert.equal(JSON.parse(run.stdout).caseVariantOverlaps.length,1);
    assert.equal(readFileSync(filepath,'utf8'),raw);
  } finally {rmSync(dir,{recursive:true,force:true});}
});
