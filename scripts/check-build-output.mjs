#!/usr/bin/env node
// Read-only check of the actual emitted web files against an approved manifest.
import { createHash } from 'node:crypto';
import { lstatSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateAssetPath } from './import-approved-assets.mjs';

const digest = bytes => createHash('sha256').update(bytes).digest('hex');

// A symlinked parent can redirect a seemingly ordinary build directory to a
// different tree. Refuse it before reading any emitted assets.
function assertSafeBuildRoot(root) {
  let current = root;
  while (true) {
    const info = lstatSync(current);
    if (info.isSymbolicLink()) throw new Error('Symlink in build root path: ' + current);
    if (!info.isDirectory()) throw new Error('Non-directory build root path: ' + current);
    const parent = dirname(current);
    if (parent === current) return;
    current = parent;
  }
}

export function inspectBuildOutput({buildRoot, manifest}) {
  if (!buildRoot || !manifest || manifest.schemaVersion !== 1 || !Array.isArray(manifest.assets) || !manifest.assets.length)
    throw new Error('Build root and nonempty approved manifest are required');
  const root=resolve(buildRoot);
  assertSafeBuildRoot(root);
  const expected=new Map(), sizes=new Set(), hashes=new Set(), folded=new Set();
  for(const record of manifest.assets) {
    const path=validateAssetPath(record?.path), key=path.normalize('NFC').toLowerCase();
    if(record.status!==undefined && record.status!=='approved') throw new Error('Asset is not approved: '+path);
    if(folded.has(key)) throw new Error('Duplicate or case-colliding manifest path: '+path);
    folded.add(key);
    if(!Number.isSafeInteger(record.bytes) || record.bytes<0 || !/^[a-f0-9]{64}$/.test(record.sha256))
      throw new Error('Invalid manifest size or hash: '+path);
    for(const field of ['rightsHolder','permissionBasis','approvalEvidence'])
      if(typeof record[field]!=='string' || !record[field].trim()) throw new Error('Missing approval metadata '+field+': '+path);
    expected.set('assets/'+path, record);
    sizes.add(record.bytes); hashes.add(record.sha256);
  }
  const found=new Map(), matchingHashes=new Map(), seenPaths=new Set();
  function walk(directory) {
    for(const entry of readdirSync(directory,{withFileTypes:true})) {
      const file=join(directory,entry.name), name=relative(root,file).split(sep).join('/');
      const info=lstatSync(file);
      if(info.isSymbolicLink()) throw new Error('Symlink in build output: '+name);
      const foldedPath=name.normalize('NFC').toLowerCase();
      if(seenPaths.has(foldedPath)) throw new Error('Case-colliding build output path: '+name);
      seenPaths.add(foldedPath);
      if(info.isDirectory()) { walk(file); continue; }
      if(!info.isFile()) throw new Error('Non-regular build output: '+name);
      if(!sizes.has(info.size) && !expected.has(name)) continue;
      const bytes=readFileSync(file), sha256=digest(bytes);
      if(expected.has(name)) found.set(name,{bytes:bytes.length,sha256});
      if(hashes.has(sha256)) {
        const paths=matchingHashes.get(sha256) ?? [];
        paths.push(name); matchingHashes.set(sha256,paths);
      }
    }
  }
  walk(root);
  const missing=[], mismatched=[];
  for(const [path,record] of expected) {
    const item=found.get(path);
    if(!item) missing.push(path);
    else if(item.bytes!==record.bytes || item.sha256!==record.sha256) mismatched.push(path);
  }
  const duplicates=[...matchingHashes].filter(([,paths])=>paths.length>1)
    .map(([sha256,paths])=>({sha256,paths:paths.sort()})).sort((a,b)=>a.sha256.localeCompare(b.sha256));
  const unexpectedCopies=[...matchingHashes.values()].flat().filter(path=>!expected.has(path)).sort();
  return {schemaVersion:1,approvedCount:expected.size,missing:missing.sort(),mismatched:mismatched.sort(),
    duplicates,unexpectedCopies,verdict:missing.length||mismatched.length||duplicates.length||unexpectedCopies.length?'blocked':'verified'};
}

function main(args) {
  if(args.length!==4 || args[0]!=='--build' || args[2]!=='--manifest')
    throw new Error('Usage: node scripts/check-build-output.mjs --build <web-output-root> --manifest manifests/approved-assets.json');
  const manifest=JSON.parse(readFileSync(args[3],'utf8'));
  const result=inspectBuildOutput({buildRoot:args[1],manifest});
  console.log(JSON.stringify(result,null,2));
  if(result.verdict!=='verified') process.exitCode=2;
}
if(process.argv[1] && resolve(process.argv[1])===resolve(fileURLToPath(import.meta.url))) {
  try{main(process.argv.slice(2));}catch(error){console.error('BUILD OUTPUT CHECK FAILED:',error.message);process.exitCode=1;}
}
