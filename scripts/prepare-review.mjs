#!/usr/bin/env node
// Prepare a PENDING review checklist; NEVER approves rights automatically.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const defaultCatalog=new URL('../catalog/upstream-candidates.json',import.meta.url);

export function prepareReview(catalog,family,{includeLegacy=false}={}) {
  if(!catalog || catalog.schemaVersion!==1 || !Array.isArray(catalog.files))
    throw new Error('Invalid candidate catalog');
  if(typeof family!=='string' || !/^(?:img|fonts)\/[a-zA-Z0-9_\-./ ]+\/?$/.test(family)
    || family.includes('..') || family.includes('\\'))
    throw new Error('Specify a safe non-root --family prefix');
  const records=catalog.files.filter(x=>x.path.startsWith(family) && (includeLegacy || !x.legacy));
  if(!records.length) throw new Error('No candidate images/fonts match that family');
  return {
    schemaVersion:1,
    assets:records.map(f=>({
      path:f.path,
      status:'pending',
      rightsHolder:'',
      permissionBasis:'',
      approvalEvidence:'',
      upstreamGitBlobSha:f.gitBlobSha,
      upstreamBytes:f.bytes,
    })),
  };
}

function cli() {
  const args=process.argv.slice(2), opts={};
  for(let i=0;i<args.length;i++) {
    if(args[i]==='--include-legacy') opts.includeLegacy=true;
    else if(['--family','--out','--catalog'].includes(args[i])&&args[i+1]) opts[args[i]]=args[++i];
    else throw new Error('Usage: --family img/simboli-bianchi/segni/ --out segni-review.local.json [--include-legacy]');
  }
  if(!opts['--family'] || !opts['--out']) throw new Error('Missing family or output');
  // Worksheets are local scratch files, never authoritative approval registers.
  if(!opts['--out'].endsWith('.local.json'))
    throw new Error('Review --out must end with .local.json (never an approvals register)');
  const catalog=JSON.parse(readFileSync(opts['--catalog']||defaultCatalog,'utf8'));
  const list=prepareReview(catalog,opts['--family'],opts);
  writeFileSync(resolve(opts['--out']),JSON.stringify(list,null,2)+'\n',{flag:'wx'});
  console.log('Prepared',list.assets.length,'PENDING review records; NO rights approved, NO binaries copied.');
}
if(process.argv[1] && resolve(process.argv[1])===resolve(fileURLToPath(import.meta.url))) {
  try{cli();}catch(e){console.error('REVIEW PREPARATION FAILED:',e.message);process.exitCode=1;}
}
