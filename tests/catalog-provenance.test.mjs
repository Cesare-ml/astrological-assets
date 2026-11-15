import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { auditCatalog } from '../scripts/audit-catalog.mjs';

const entry = { path:'img/simboli/segni/01.png',bytes:12,gitBlobSha:'a'.repeat(40),legacy:false };
const source = {repository:'Cesare-ml/virgo-stars',assetRoot:'public/assets',commit:'b'.repeat(40)};
const catalog = {schemaVersion:1,source,rightsStatus:'unreviewed',fileCount:1,files:[entry]};
const audit = c => auditCatalog(c);

test('valid pinned upstream metadata remains auditable without granting rights',()=>{
  const report=audit(catalog);
  assert.equal(report.fileCount,1);
  assert.equal(report.sourceCommit,source.commit);
  assert.equal(report.bytes,12);
  assert.equal(report.legacyCandidates,0);
});

test('blocks absent, altered or malformed source provenance',()=>{
  for (const changed of [
    {source:undefined}, {source:{...source,repository:'another/owner'}},
    {source:{...source,assetRoot:'different'}}, {source:{...source,commit:'not-a-sha'}},
    {source:{...source,commit:source.commit.toUpperCase()}},
  ]) assert.throws(()=>audit({...catalog,...changed}),/provenance/);
});

test('rejects candidate catalogs that claim anything beyond unreviewed',()=>{
  for (const rightsStatus of ['approved','cleared','private-only','',undefined])
    assert.throws(()=>audit({...catalog,rightsStatus}),/rights status/);
});

test('requires a nonempty exact and safe file count',()=>{
  for (const changed of [{files:[],fileCount:0},{fileCount:0},{fileCount:2},{fileCount:1.5},{fileCount:undefined}])
    assert.throws(()=>audit({...catalog,...changed}),/catalog schema/);
});

test('rejects missing or non-boolean legacy indicators',()=>{
  for (const legacy of ['false',1,null,undefined])
    assert.throws(()=>audit({...catalog,files:[{...entry,legacy}]}),/legacy marker/);
});

test('rejects aggregate byte totals beyond safe integers',()=>{
  const huge={...entry,bytes:Number.MAX_SAFE_INTEGER};
  assert.throws(()=>audit({...catalog,fileCount:2,files:[huge,{...entry,path:'img/simboli/segni/02.png',bytes:1}]}),/byte total/);
});

test('retains collision detection and deliberate missing-filename warning',()=>{
  const same={...entry,path:'img/simboli/segni/01.PNG'};
  assert.throws(()=>audit({...catalog,fileCount:2,files:[entry,same]}),/collision/);
  const bn={...entry,path:'img/risuonatore-solare-bn.png',legacy:true};
  const report=audit({...catalog,files:[bn]});
  assert.equal(report.legacyCandidates,1);
  assert.match(report.warnings[0],/bianco/);
});

test('CLI blocks false rights status with a nonzero exit',()=>{
  const temp=mkdtempSync(join(tmpdir(),'astro-catalog-audit-'));
  try {
    const file=join(temp,'candidate.json');
    writeFileSync(file,JSON.stringify({...catalog,rightsStatus:'approved'}));
    const script=fileURLToPath(new URL('../scripts/audit-catalog.mjs',import.meta.url));
    const result=spawnSync(process.execPath,[script,file],{encoding:'utf8'});
    assert.equal(result.status,1);
    assert.match(result.stderr,/CATALOG AUDIT FAILED/);
    writeFileSync(file,JSON.stringify(catalog));
    const ok=spawnSync(process.execPath,[script,file],{encoding:'utf8'});
    assert.equal(ok.status,0,ok.stderr);
    assert.equal(JSON.parse(ok.stdout).bytes,12);
  } finally { rmSync(temp,{recursive:true,force:true}); }
});
