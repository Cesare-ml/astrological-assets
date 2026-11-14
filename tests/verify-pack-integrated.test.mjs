import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { verifyPack } from '../scripts/verify-pack.mjs';

function fixture(fn) {
  const dir=mkdtempSync(join(tmpdir(),'astro-combined-pack-'));
  const root=join(dir,'pack'), path='img/segni/01.png';
  const data=Buffer.from('synthetic fixture for local tests');
  mkdirSync(join(root,'img','segni'),{recursive:true});
  writeFileSync(join(root,path),data);
  const manifest={schemaVersion:1,assets:[{path,bytes:data.length,
    sha256:createHash('sha256').update(data).digest('hex'),
    rightsHolder:'Synthetic author',permissionBasis:'Private fixture',
    approvalEvidence:'Synthetic only, not an artwork permission'}]};
  try { fn({dir,root,path,manifest}); }
  finally { rmSync(dir,{recursive:true,force:true}); }
}

function linkOrSkip(t,target,alias) {
  try { symlinkSync(target,alias,process.platform==='win32'?'junction':'dir'); }
  catch(error) {
    if(process.platform==='win32' && ['EPERM','EACCES','ENOTSUP'].includes(error.code)) {
      t.skip('Junction unavailable'); return false;
    }
    throw error;
  }
  return true;
}

test('both modes reject symlinked roots', t=>fixture(x=>{
  const alias=join(x.dir,'alias');
  if(!linkOrSkip(t,x.root,alias)) return;
  for(const strict of [false,true])
    assert.throws(()=>verifyPack(alias,x.manifest,{strict}),/Unsafe pack root: Symlink forbidden/);
}));

test('both modes reject symlinked parent even with a regular asset folder', t=>fixture(x=>{
  const moved=join(x.dir,'original'); renameSync(x.root,moved);
  const alias=join(x.dir,'alias');
  if(!linkOrSkip(t,moved,alias)) return;
  for(const strict of [false,true])
    assert.throws(()=>verifyPack(alias,x.manifest,{strict}),/Unsafe pack root: Symlink forbidden/);
}));

test('strict mode still rejects extra files but default remains compatible', ()=>fixture(x=>{
  writeFileSync(join(x.root,'img','segni','extra.png'),'not reviewed');
  assert.equal(verifyPack(x.root,x.manifest).verified,1);
  assert.throws(()=>verifyPack(x.root,x.manifest,{strict:true}),/Unlisted files in pack/);
}));

test('strict and default modes reject manifest-listed dangling symlinks', t=>fixture(x=>{
  const asset=join(x.root,x.path); rmSync(asset);
  try { symlinkSync(join(x.dir,'absent'),asset); }
  catch(error) {
    if(process.platform==='win32' && ['EPERM','EACCES','ENOTSUP'].includes(error.code))
      return t.skip('File symlink unavailable');
    throw error;
  }
  for(const strict of [false,true])
    assert.throws(()=>verifyPack(x.root,x.manifest,{strict}),/Symlink forbidden:/);
}));
