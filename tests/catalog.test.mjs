import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { auditCatalog } from '../scripts/audit-catalog.mjs';
import { parseGitTreeOutput } from '../scripts/refresh-source-catalog.mjs';
import { prepareReview } from '../scripts/prepare-review.mjs';

test('pinned upstream catalog is internally consistent and has no path collisions',()=>{
  const catalog=JSON.parse(readFileSync(new URL('../catalog/upstream-candidates.json',import.meta.url),'utf8'));
  const report=auditCatalog(catalog);
  assert.equal(report.fileCount,catalog.fileCount);
  assert.equal(typeof report.bytes,'number');
  assert.ok(report.distinctGitBlobs>0);
  assert.ok(report.fileCount>report.distinctGitBlobs);
});

test('Git tree parser preserves spaces and excludes unrelated images or symlinks',()=>{
  const sha='a'.repeat(40);
  const tree=[
    '100644 blob '+sha+' 9\tpublic/assets/img/simboli/elementi-celesti/dark/875x605/mean Node.png',
    '100644 blob '+sha+' 3\tpublic/assets/img/logo.png',
    '100644 blob '+sha+'    4\tpublic/assets/img/symbols/planets/dark/_circle/Sun.png',
    '100644 blob '+sha+' 4\tpublic/assets/img/symbols/planets/dark/Sun.png',
    '120000 blob '+sha+' 30\tpublic/assets/img/simboli-bianchi/segni/01.png',
    '100644 blob '+sha+' 5\tpublic/assets/fonts/Zodiac S_Regular.typeface.json',
  ].join('\0')+'\0';
  const files=parseGitTreeOutput(tree);
  assert.deepEqual(files.map(x=>x.path),[
    'fonts/Zodiac S_Regular.typeface.json',
    'img/simboli/elementi-celesti/dark/875x605/mean Node.png',
    'img/symbols/planets/dark/_circle/Sun.png',
  ]);
});
test('catalog audit rejects unknown content hashes and case-colliding paths',()=>{
  const a={path:'img/simboli-bianchi/segni/01.png',bytes:2,gitBlobSha:'b'.repeat(40),legacy:false};
  const source={assetRoot:'public/assets',commit:'c'.repeat(40),repository:'test'};
  assert.throws(()=>auditCatalog({schemaVersion:1,fileCount:1,source,files:[{...a,gitBlobSha:'invalid'}]}),/Invalid source blob/);
  assert.throws(()=>auditCatalog({schemaVersion:1,fileCount:2,source,files:[a,{...a,path:'img/simboli-bianchi/segni/01.PNG'}]}),/collision/);
});

test('family review generator creates only pending permissions for known astrology symbols',()=>{
  const catalog=JSON.parse(readFileSync(new URL('../catalog/upstream-candidates.json',import.meta.url),'utf8'));
  const review=prepareReview(catalog,'img/simboli-bianchi/segni/');
  assert.equal(review.assets.length,12);
  assert.ok(review.assets.every(a=>a.status==='pending' && !a.permissionBasis && a.upstreamGitBlobSha));
  assert.throws(()=>prepareReview(catalog,'../../private/'),/safe/);
});
