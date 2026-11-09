#!/usr/bin/env node
// Audit candidate METADATA only. An inventory never grants an asset license.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateAssetPath } from './import-approved-assets.mjs';

const defaultCatalog=resolve(fileURLToPath(new URL('../catalog/upstream-candidates.json',import.meta.url)));

export function auditCatalog(catalog) {
  if(!catalog || catalog.schemaVersion!==1 || !Array.isArray(catalog.files) ||
     catalog.source?.assetRoot!=='public/assets')
    throw new Error('Invalid upstream catalog schema');
  const paths=new Set(), folded=new Map(), blobs=new Set();
  const groups={}, warnings=[];
  let totalBytes=0,legacyCount=0;
  for(const file of catalog.files) {
    validateAssetPath(file.path);
    if(!Number.isSafeInteger(file.bytes)||file.bytes<0||!/^[a-f0-9]{40}$/.test(file.gitBlobSha))
      throw new Error('Invalid source blob record: '+file.path);
    if(paths.has(file.path)) throw new Error('Repeated asset path: '+file.path);
    paths.add(file.path);
    const foldedPath=file.path.normalize('NFC').toLowerCase();
    if(folded.has(foldedPath)) throw new Error('Cross-platform filename collision: '+file.path+' / '+folded.get(foldedPath));
    folded.set(foldedPath,file.path);
    blobs.add(file.gitBlobSha);
    totalBytes+=file.bytes;
    if(file.legacy) legacyCount++;
    const family=file.path.startsWith('img/risuonatore-solare')?'img/risuonatore-solare':
      file.path.split('/').slice(0,2).join('/');
    groups[family]=(groups[family]||0)+1;
  }
  if(catalog.fileCount!==catalog.files.length) throw new Error('Catalog fileCount inconsistent');
  if(!paths.has('img/risuonatore-solare-bianco.png') && paths.has('img/risuonatore-solare-bn.png'))
    warnings.push('Some skins refer to risuonatore-solare-bianco.png; only risuonatore-solare-bn.png appears in candidate snapshot');
  if(catalog.rightsStatus!=='unreviewed') warnings.push('Catalog candidate metadata is not a license; review each asset or family');
  return {
    sourceCommit:catalog.source.commit,
    fileCount:paths.size,
    distinctGitBlobs:blobs.size,
    bytes:totalBytes,
    legacyCandidates:legacyCount,
    groups,
    warnings,
    caveat:'No artwork moved and no redistribution rights asserted',
  };
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(fileURLToPath(import.meta.url))) {
  try {
    const result=auditCatalog(JSON.parse(readFileSync(process.argv[2]||defaultCatalog,'utf8')));
    console.log(JSON.stringify(result,null,2));
  } catch(e) {
    console.error('CATALOG AUDIT FAILED:',e.message);
    process.exitCode=1;
  }
}
