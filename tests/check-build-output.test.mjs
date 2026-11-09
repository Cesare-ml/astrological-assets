import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { inspectBuildOutput } from '../scripts/check-build-output.mjs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

function fixture(callback) {
  const root=mkdtempSync(join(tmpdir(),'astro-web-output-'));
  const bytes=Buffer.from('synthetic approved asset');
  const path='img/simboli-bianchi/segni/01.png';
  const asset={path,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),
    rightsHolder:'fixture',permissionBasis:'synthetic data',approvalEvidence:'test'};
  const manifest={schemaVersion:1,assets:[asset]};
  mkdirSync(join(root,'assets','img','simboli-bianchi','segni'),{recursive:true});
  writeFileSync(join(root,'assets',...path.split('/')),bytes);
  try { return callback({root,bytes,path,asset,manifest}); }
  finally { rmSync(root,{recursive:true,force:true}); }
}

test('verifies one emitted copy at the canonical URL',()=>fixture(({root,manifest})=>{
  const report=inspectBuildOutput({buildRoot:root,manifest});
  assert.equal(report.verdict,'verified');
  assert.deepEqual(report.missing,[]); assert.deepEqual(report.duplicates,[]);
}));

test('blocks missing, changed and duplicate outputs',()=>fixture(({root,bytes,path,manifest})=>{
  const canonical=join(root,'assets',...path.split('/'));
  writeFileSync(canonical,'altered');
  assert.deepEqual(inspectBuildOutput({buildRoot:root,manifest}).mismatched,['assets/'+path]);
  rmSync(canonical);
  assert.deepEqual(inspectBuildOutput({buildRoot:root,manifest}).missing,['assets/'+path]);
  writeFileSync(canonical,bytes);
  mkdirSync(join(root,'other'),{recursive:true});
  writeFileSync(join(root,'other','copy.png'),bytes);
  const report=inspectBuildOutput({buildRoot:root,manifest});
  assert.equal(report.verdict,'blocked');
  assert.deepEqual(report.unexpectedCopies,['other/copy.png']);
  assert.deepEqual(report.duplicates[0].paths,['assets/'+path,'other/copy.png']);
}));

test('blocks identical content emitted under two approved canonical names',()=>fixture(({root,bytes,asset,manifest})=>{
  const second='img/simboli-bianchi/segni/02.png';
  writeFileSync(join(root,'assets',...second.split('/')),bytes);
  manifest.assets.push({...asset,path:second});
  const report=inspectBuildOutput({buildRoot:root,manifest});
  assert.equal(report.verdict,'blocked'); assert.equal(report.duplicates.length,1);
  assert.deepEqual(report.unexpectedCopies,[]);
}));

test('rejects empty, unapproved, unsafe or case-colliding manifests',()=>fixture(({root,asset})=>{
  assert.throws(()=>inspectBuildOutput({buildRoot:root,manifest:{schemaVersion:1,assets:[]}}),/nonempty/);
  assert.throws(()=>inspectBuildOutput({buildRoot:root,manifest:{schemaVersion:1,assets:[{...asset,approvalEvidence:''}]}}),/approvalEvidence/);
  assert.throws(()=>inspectBuildOutput({buildRoot:root,manifest:{schemaVersion:1,assets:[{...asset,status:'pending'}]}}),/not approved/);
  assert.throws(()=>inspectBuildOutput({buildRoot:root,manifest:{schemaVersion:1,assets:[{...asset,path:'img/../../x.png'}]}}),/Unsafe/);
  assert.throws(()=>inspectBuildOutput({buildRoot:root,manifest:{schemaVersion:1,assets:[asset,{...asset,path:asset.path.toUpperCase()}]}}),/case-colliding|Unsafe/);
}));

test('rejects symlinks in emitted output where supported',t=>fixture(({root,manifest})=>{
  try { symlinkSync(join(root,'assets'),join(root,'alias'),'junction'); }
  catch(error) { if(process.platform==='win32' && ['EPERM','EACCES'].includes(error.code)) return t.skip('Junction unavailable'); throw error; }
  assert.throws(()=>inspectBuildOutput({buildRoot:root,manifest}),/Symlink/);
}));

test('CLI returns zero for a valid output and two for a duplicate',()=>fixture(({root,bytes,manifest})=>{
  const manifestFile=join(root,'manifest.json');
  writeFileSync(manifestFile,JSON.stringify(manifest));
  const script=fileURLToPath(new URL('../scripts/check-build-output.mjs',import.meta.url));
  const run=()=>spawnSync(process.execPath,[script,'--build',root,'--manifest',manifestFile],{encoding:'utf8'});
  assert.equal(run().status,0);
  writeFileSync(join(root,'extra.png'),bytes);
  const failed=run(); assert.equal(failed.status,2);
  assert.equal(JSON.parse(failed.stdout).verdict,'blocked');
}));
