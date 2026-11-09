#!/usr/bin/env node
/**
 * Import ONLY explicitly rights-approved assets from a local VirgoStars checkout.
 * Default is dry-run. No network access, deployments, or unreviewed copies.
 */
import {
  constants, copyFileSync, existsSync, lstatSync, mkdirSync,
  readFileSync, realpathSync, writeFileSync
} from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot=resolve(dirname(fileURLToPath(import.meta.url)), '..');
const EXT=new Set(['.png','.jpg','.jpeg','.webp','.svg','.gif','.avif','.bmp','.ico','.woff','.woff2','.ttf','.otf','.json']);

export function validateAssetPath(path) {
  if(typeof path!=='string' || !path || path.startsWith('/') || path.includes('\\') || path.includes('\0'))
    throw new Error('Unsafe asset path: '+String(path));
  const parts=path.split('/');
  if(parts.length<2 || !['img','fonts'].includes(parts[0]) ||
     parts.some(x=>!x || x==='.' || x==='..' || x.includes(':')))
    throw new Error('Unsafe asset path: '+path);
  const extension=extname(path).toLowerCase();
  if(!EXT.has(extension) || (extension==='.json' && parts[0]!=='fonts'))
    throw new Error('Unsupported asset type: '+path);
  return path;
}

export function gitBlobSha(buffer) {
  const hash=createHash('sha1');
  hash.update('blob '+buffer.length+'\0');
  hash.update(buffer);
  return hash.digest('hex');
}

function checkNoLinks(root, path, mustExist) {
  const parts=path.split('/');
  let current=root;
  for(let i=0;i<parts.length;i++) {
    current=join(current,parts[i]);
    if(!existsSync(current)) {
      if(mustExist) throw new Error('Source file missing: '+path);
      continue;
    }
    const st=lstatSync(current);
    if(st.isSymbolicLink()) throw new Error('Symlink not allowed: '+path);
    if(i<parts.length-1 && !st.isDirectory()) throw new Error('Parent is not a directory: '+path);
    if(i===parts.length-1 && !st.isFile()) throw new Error('Asset path is not a regular file: '+path);
  }
  return current;
}

export function planImport({sourceRoot, targetRoot, catalog, approvals, replace=false}) {
  if(!catalog || catalog.schemaVersion!==1 || !Array.isArray(catalog.files)
     || catalog.source?.assetRoot!=='public/assets') throw new Error('Invalid source catalog');
  if(!approvals || approvals.schemaVersion!==1 || !Array.isArray(approvals.assets))
    throw new Error('Invalid approval list');
  if(!sourceRoot || !targetRoot) throw new Error('Both --source and --target are required');
  const source=realpathSync(resolve(sourceRoot));
  if(!lstatSync(source).isDirectory()) throw new Error('Source is not a directory');
  const target=resolve(targetRoot);
  if(source===target || target.startsWith(source+sep))
    throw new Error('Source and target must be separate');
  if(existsSync(target) && lstatSync(target).isSymbolicLink())
    throw new Error('Target may not be a symlink');

  const candidate=new Map();
  for(const item of catalog.files) {
    validateAssetPath(item.path);
    if(candidate.has(item.path)) throw new Error('Duplicate catalog entry: '+item.path);
    if(!/^[a-f0-9]{40}$/.test(item.gitBlobSha) || !Number.isSafeInteger(item.bytes) || item.bytes<0)
      throw new Error('Invalid upstream blob metadata: '+item.path);
    candidate.set(item.path,item);
  }
  const seen=new Set(),folded=new Set(),actions=[];
  for(const entry of approvals.assets) {
    const path=validateAssetPath(entry.path);
    if(seen.has(path)) throw new Error('Duplicate approval: '+path);
    seen.add(path);
    const key=path.normalize('NFC').toLowerCase();
    if(folded.has(key)) throw new Error('Case-insensitive path collision: '+path);
    folded.add(key);
    if(entry.status!=='approved') continue;
    for(const field of ['rightsHolder','permissionBasis','approvalEvidence']) {
      if(typeof entry[field]!=='string' || !entry[field].trim())
        throw new Error('Approved asset lacks '+field+': '+path);
    }
    const upstream=candidate.get(path);
    if(!upstream) throw new Error('Approved file not in upstream catalog: '+path);
    const src=checkNoLinks(source,path,true);
    const bytes=readFileSync(src);
    const gitSha=gitBlobSha(bytes);
    if(bytes.length!==upstream.bytes || gitSha!==upstream.gitBlobSha)
      throw new Error('File differs from audited upstream catalog: '+path);
    const sha256=createHash('sha256').update(bytes).digest('hex');
    const dst=checkNoLinks(target,path,false);
    let action='copy';
    if(existsSync(dst)) {
      const existing=readFileSync(dst);
      if(existing.length===bytes.length && createHash('sha256').update(existing).digest('hex')===sha256)
        action='unchanged';
      else if(!replace) throw new Error('Target file differs; refusing overwrite: '+path);
      else action='replace';
    }
    actions.push({
      path,src,dst,action,bytes:bytes.length,gitBlobSha:gitSha,sha256,
      rightsHolder:entry.rightsHolder.trim(),
      permissionBasis:entry.permissionBasis.trim(),
      approvalEvidence:entry.approvalEvidence.trim(),
    });
  }
  actions.sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
  if(actions.length===0) throw new Error('No rights-approved assets selected; nothing imported');
  return {catalogSource:catalog.source,sourceRoot:source,targetRoot:target,actions};
}

export function applyImport(plan,manifestPath) {
  if(!manifestPath) throw new Error('An explicit --manifest output path is required');
  if(!existsSync(plan.targetRoot)) mkdirSync(plan.targetRoot,{recursive:true});
  if(lstatSync(plan.targetRoot).isSymbolicLink()) throw new Error('Target root symlink rejected');
  for(const item of plan.actions) {
    checkNoLinks(plan.targetRoot,item.path,false);
    if(item.action==='unchanged') continue;
    mkdirSync(dirname(item.dst),{recursive:true});
    copyFileSync(item.src,item.dst,item.action==='copy'?constants.COPYFILE_EXCL:0);
    const copied=readFileSync(item.dst);
    if(createHash('sha256').update(copied).digest('hex')!==item.sha256)
      throw new Error('Copied file hash mismatch: '+item.path);
  }
  const manifest={
    schemaVersion:1,
    source:plan.catalogSource,
    assets:plan.actions.map(({path,bytes,sha256,gitBlobSha,rightsHolder,permissionBasis,approvalEvidence})=>({
      path,bytes,sha256,gitBlobSha,rightsHolder,permissionBasis,approvalEvidence
    })),
  };
  // The manifest is metadata, never a replacement for the actual license documents.
  mkdirSync(dirname(resolve(manifestPath)),{recursive:true});
  writeFileSync(resolve(manifestPath),JSON.stringify(manifest,null,2)+'\n');
  return manifest;
}

function argsMap(args) {
  const out={};
  for(let i=0;i<args.length;i++) {
    const key=args[i];
    if(key==='--apply'||key==='--replace') {
      if(out[key]) throw new Error('Duplicate option: '+key);
      out[key]=true;
    } else if(key.startsWith('--') && args[i+1] && !args[i+1].startsWith('--') && !out[key]) {
      out[key]=args[++i];
    } else throw new Error('Invalid option: '+String(key));
  }
  for(const required of ['--source','--target','--approvals']) if(!out[required]) throw new Error('Missing '+required);
  if(out['--replace']&&!out['--apply']) throw new Error('--replace requires --apply');
  return out;
}

function main() {
  const args=argsMap(process.argv.slice(2));
  const catalog=JSON.parse(readFileSync(args['--catalog']||join(repoRoot,'catalog/upstream-candidates.json'),'utf8'));
  const approvals=JSON.parse(readFileSync(args['--approvals'],'utf8'));
  const plan=planImport({
    sourceRoot:args['--source'],targetRoot:args['--target'],
    catalog,approvals,replace:Boolean(args['--replace'])
  });
  const counts=plan.actions.reduce((result,x)=>(result[x.action]=(result[x.action]||0)+1,result),{});
  console.log('Validated',plan.actions.length,'approved files; actions:',JSON.stringify(counts));
  if(!args['--apply']) {
    console.log('DRY RUN: no files copied. Add --apply --manifest manifests/approved-assets.json to import.');
    return;
  }
  const result=applyImport(plan,args['--manifest']);
  console.log('Imported and verified',result.assets.length,'files. Review manifest and changes before committing a PR.');
}
if(process.argv[1] && resolve(process.argv[1])===resolve(fileURLToPath(import.meta.url))) {
  try{main();}catch(e){console.error('IMPORT BLOCKED:',e.message);process.exitCode=1;}
}
