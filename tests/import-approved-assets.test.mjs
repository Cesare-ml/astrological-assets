import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { applyImport, gitBlobSha, planImport, validateAssetPath } from '../scripts/import-approved-assets.mjs';
import { verifyPack } from '../scripts/verify-pack.mjs';

function withFixture(callback) {
  const dir=mkdtempSync(join(tmpdir(),'astro-assets-import-'));
  const source=join(dir,'source'),target=join(dir,'target');
  const path='img/simboli-bianchi/segni/01.png';
  mkdirSync(join(source,'img','simboli-bianchi','segni'),{recursive:true});
  const payload=Buffer.from('synthetic fixture—not production artwork');
  writeFileSync(join(source,...path.split('/')),payload);
  const catalog={
    schemaVersion:1,
    source:{repository:'test/fixture',commit:'example',assetRoot:'public/assets'},
    files:[{path,bytes:payload.length,gitBlobSha:gitBlobSha(payload)}],
  };
  const approved={
    schemaVersion:1,
    assets:[{path,status:'approved',rightsHolder:'fixture author',
      permissionBasis:'original synthetic test data',approvalEvidence:'test fixture'}],
  };
  try {return callback({dir,source,target,path,payload,catalog,approved});}
  finally {rmSync(dir,{recursive:true,force:true});}
}

test('imports exactly the approved file with verified Git/SHA-256 metadata',()=>{
  withFixture(({dir,source,target,path,payload,catalog,approved})=>{
    const planned=planImport({sourceRoot:source,targetRoot:target,catalog,approvals:approved});
    assert.deepEqual(planned.actions.map(x=>x.action),['copy']);
    const manifest=applyImport(planned,join(dir,'manifest.json'));
    assert.equal(manifest.assets.length,1);
    assert.equal(manifest.assets[0].sha256,createHash('sha256').update(payload).digest('hex'));
    assert.deepEqual(readFileSync(join(target,...path.split('/'))),payload);
    assert.deepEqual(verifyPack(target,manifest),{verified:1,bytes:payload.length});
    const repeated=planImport({sourceRoot:source,targetRoot:target,catalog,approvals:approved});
    assert.deepEqual(repeated.actions.map(x=>x.action),['unchanged']);
  });
});

test('skips pending assets and rejects an empty set of approvals',()=>{
  withFixture(({source,target,catalog,approved})=>{
    approved.assets[0].status='pending';
    assert.throws(()=>planImport({sourceRoot:source,targetRoot:target,catalog,approvals:approved}),/No rights-approved/);
  });
});

test('blocks approvals without traceable permission and outdated upstream bytes',()=>{
  withFixture(({source,target,path,catalog,approved})=>{
    approved.assets[0].permissionBasis='';
    assert.throws(()=>planImport({sourceRoot:source,targetRoot:target,catalog,approvals:approved}),/permissionBasis/);
    approved.assets[0].permissionBasis='synthetic fixture rights';
    writeFileSync(join(source,...path.split('/')),'modified fixture');
    assert.throws(()=>planImport({sourceRoot:source,targetRoot:target,catalog,approvals:approved}),/differs from audited/);
  });
});

test('refuses traversal, duplicate approvals and an overwrite without explicit consent',()=>{
  withFixture(({source,target,path,catalog,approved})=>{
    assert.throws(()=>validateAssetPath('../.env'),/Unsafe/);
    assert.throws(()=>validateAssetPath('img/../../password.png'),/Unsafe/);
    approved.assets.push({...approved.assets[0]});
    assert.throws(()=>planImport({sourceRoot:source,targetRoot:target,catalog,approvals:approved}),/Duplicate approval/);
    approved.assets.pop();
    mkdirSync(join(target,'img','simboli-bianchi','segni'),{recursive:true});
    writeFileSync(join(target,...path.split('/')),'different contents');
    assert.throws(()=>planImport({sourceRoot:source,targetRoot:target,catalog,approvals:approved}),/refusing overwrite/);
    const planned=planImport({sourceRoot:source,targetRoot:target,catalog,approvals:approved,replace:true});
    assert.equal(planned.actions[0].action,'replace');
  });
});

test('rejects source symlinks (where supported by host permissions)',t=>{
  withFixture(({dir,source,target,path,catalog,approved})=>{
    const dest=join(source,...path.split('/'));
    // Replace the file with a symbolic link, preserving the original expected contents.
    writeFileSync(join(dir,'outside.png'),'synthetic fixture—not production artwork');
    rmSync(dest);
    try {symlinkSync(join(dir,'outside.png'),dest);}
    catch(error) {
      if(process.platform==='win32' && ['EPERM','EACCES'].includes(error.code)) {
        t.skip('Symlink creation requires a Windows permission');
        return;
      }
      throw error;
    }
    assert.throws(()=>planImport({sourceRoot:source,targetRoot:target,catalog,approvals:approved}),/Symlink not allowed/);
  });
});


test('pack verifier detects tampered or missing deployed images',()=>{
  withFixture(({dir,source,target,path,catalog,approved})=>{
    const planned=planImport({sourceRoot:source,targetRoot:target,catalog,approvals:approved});
    const manifest=applyImport(planned,join(dir,'manifest.json'));
    writeFileSync(join(target,...path.split('/')),'tampered');
    assert.throws(()=>verifyPack(target,manifest),/Checksum mismatch/);
    rmSync(join(target,...path.split('/')));
    assert.throws(()=>verifyPack(target,manifest),/Missing image/);
  });
});

test('pack verifier rejects empty manifests and records without approval evidence',()=>{
  withFixture(({dir,source,target,catalog,approved})=>{
    assert.throws(()=>verifyPack(target,{schemaVersion:1,assets:[]}),/empty/);
    const manifest=applyImport(planImport({sourceRoot:source,targetRoot:target,catalog,approvals:approved}),join(dir,'manifest.json'));
    for(const field of ['rightsHolder','permissionBasis','approvalEvidence']) {
      const invalid=structuredClone(manifest);
      invalid.assets[0][field]='  ';
      assert.throws(()=>verifyPack(target,invalid),new RegExp(field));
    }
  });
});

test('apply refuses changed source bytes before copying any selected file',()=>{
  withFixture(({dir,source,target,path,catalog,approved})=>{
    const second='img/simboli-bianchi/segni/02.png';
    const body=Buffer.from('second synthetic asset');
    writeFileSync(join(source,...second.split('/')),body);
    catalog.files.push({path:second,bytes:body.length,gitBlobSha:gitBlobSha(body)});
    approved.assets.push({...approved.assets[0],path:second});
    const plan=planImport({sourceRoot:source,targetRoot:target,catalog,approvals:approved});
    writeFileSync(join(source,...second.split('/')),'changed after planning');
    assert.throws(()=>applyImport(plan,join(dir,'manifest.json')),/changed since planning/);
    assert.equal(existsSync(join(target,...path.split('/'))),false);
    assert.equal(existsSync(join(dir,'manifest.json')),false);
  });
});

test('apply refuses a target that changed after an unchanged plan',()=>{
  withFixture(({dir,source,target,path,catalog,approved})=>{
    applyImport(planImport({sourceRoot:source,targetRoot:target,catalog,approvals:approved}),join(dir,'first.json'));
    const plan=planImport({sourceRoot:source,targetRoot:target,catalog,approvals:approved});
    assert.equal(plan.actions[0].action,'unchanged');
    writeFileSync(join(target,...path.split('/')),'changed after planning');
    assert.throws(()=>applyImport(plan,join(dir,'second.json')),/changed since planning/);
    assert.equal(existsSync(join(dir,'second.json')),false);
  });
});

test('rejects target paths through a symlinked parent',t=>{
  withFixture(({dir,source,catalog,approved})=>{
    const alias=join(dir,'alias');
    try { symlinkSync(source,alias,'junction'); }
    catch(error) {
      if(process.platform==='win32' && ['EPERM','EACCES'].includes(error.code)) return t.skip('Junction creation unavailable');
      throw error;
    }
    assert.throws(()=>planImport({sourceRoot:source,targetRoot:join(alias,'nested'),catalog,approvals:approved}),/symlink/i);
  });
});

test('rejects overlapping source, target and manifest paths',()=>{
  withFixture(({dir,source,target,path,catalog,approved})=>{
    assert.throws(()=>planImport({sourceRoot:source,targetRoot:join(source,'nested'),catalog,approvals:approved}),/separate/);
    assert.throws(()=>planImport({sourceRoot:source,targetRoot:dir,catalog,approvals:approved}),/separate/);
    const plan=planImport({sourceRoot:source,targetRoot:target,catalog,approvals:approved});
    assert.throws(()=>applyImport(plan,join(source,'manifest.json')),/inside the source/);
    assert.throws(()=>applyImport(plan,join(target,...path.split('/'))),/overwrite a selected asset/);
    assert.equal(existsSync(target),false);
  });
});

test('replace refuses a destination changed after approval of the plan',()=>{
  withFixture(({dir,source,target,path,catalog,approved})=>{
    mkdirSync(join(target,'img','simboli-bianchi','segni'),{recursive:true});
    const dest=join(target,...path.split('/'));
    writeFileSync(dest,'old data');
    const plan=planImport({sourceRoot:source,targetRoot:target,catalog,approvals:approved,replace:true});
    writeFileSync(dest,'newer data');
    assert.throws(()=>applyImport(plan,join(dir,'manifest.json')),/Target changed since planning/);
    assert.equal(readFileSync(dest,'utf8'),'newer data');
  });
});
