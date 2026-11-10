#!/usr/bin/env node
/**
 * Refresh metadata from an authorized LOCAL VirgoStars Git checkout.
 * Reads the HEAD Git tree, not untracked working-tree files.
 * Never reads/copies image bytes or calls GitHub/AWS.
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const EXTS=new Set(['.png','.jpg','.jpeg','.webp','.svg','.gif','.avif','.bmp','.ico','.woff','.woff2','.ttf','.otf','.json']);
const LEGACY=/(?:^|\/)(?:_old|old[^/]*|.*-old[^/]*)/i;

function isCandidate(ref) {
  const family=/^img\/(?:simboli(?:-bianchi)?\/|grafici\/|textures\/|risuonatore-solare[^/]*\.(?:png|jpg|webp)$)/i.test(ref)
    || /^img\/symbols\/planets\/(?:dark|light)\/_circle\//.test(ref)
    || /^fonts\//.test(ref);
  if(!family) return false;
  const ext=ref.slice(ref.lastIndexOf('.')).toLowerCase();
  return EXTS.has(ext) && (ext!=='.json' || ref.startsWith('fonts/'));
}

export function parseGitTreeOutput(content) {
  const entries=[];
  for(const record of content.split('\0')) {
    if(!record) continue;
    const match=/^(\d+) blob ([a-f\d]{40}) +(\d+)\t(.+)$/s.exec(record);
    if(!match) continue;
    const [,mode,sha,size,full]=match;
    if(!['100644','100755'].includes(mode) || !full.startsWith('public/assets/')) continue;
    const path=full.slice('public/assets/'.length);
    if(!isCandidate(path)) continue;
    entries.push({path,bytes:Number(size),gitBlobSha:sha,legacy:LEGACY.test(path)});
  }
  return entries.sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
}

export function refreshCatalog(repoPath) {
  const cwd=resolve(repoPath);
  const commit=execFileSync('git',['-C',cwd,'rev-parse','HEAD'],{encoding:'utf8'}).trim();
  if(!/^[a-f0-9]{40}$/.test(commit)) throw new Error('Unable to resolve a SHA-1 Git commit');
  const raw=execFileSync('git',['-C',cwd,'ls-tree','-r','-l','-z','HEAD','--','public/assets'],{
    encoding:'utf8',maxBuffer:32*1024*1024
  });
  const files=parseGitTreeOutput(raw);
  if(files.length===0) throw new Error('No chart asset candidates found in the source Git tree; refusing an empty catalog');
  return {
    schemaVersion:1,
    source:{repository:'Cesare-ml/virgo-stars',commit,assetRoot:'public/assets'},
    fileCount:files.length,
    rightsStatus:'unreviewed',
    files
  };
}

function cli(args) {
  let repo, out, write=false;
  for(let i=0;i<args.length;i++) {
    const flag=args[i];
    if(flag==='--write') write=true;
    else if(flag==='--repo') repo=args[++i];
    else if(flag==='--out') out=args[++i];
    else throw new Error('Usage: --repo ../virgo-stars [--out catalog/upstream-candidates.json --write]');
  }
  if(!repo) throw new Error('Missing --repo');
  const catalog=refreshCatalog(repo);
  const total=catalog.files.reduce((sum,f)=>sum+f.bytes,0);
  console.log('Source commit:',catalog.source.commit);
  console.log('Candidate paths:',catalog.fileCount,'bytes:',total);
  console.log('Catalog entries are metadata, not permissions; consult approvals separately. No binary files copied.');
  if(!write) return;
  if(!out) throw new Error('--write requires --out');
  writeFileSync(resolve(out),JSON.stringify(catalog,null,2)+'\n');
  console.log('Wrote catalog metadata only:',resolve(out));
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(fileURLToPath(import.meta.url))) {
  try{cli(process.argv.slice(2));}
  catch(err){console.error('CATALOG REFRESH FAILED:',err.message);process.exitCode=1;}
}
