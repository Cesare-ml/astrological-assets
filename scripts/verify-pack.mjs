#!/usr/bin/env node
// Verifies a checked-out approved asset pack without the private VirgoStars repository.
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateAssetPath } from './import-approved-assets.mjs';

export function verifyPack(root, manifest) {
  if(!manifest || manifest.schemaVersion!==1 || !Array.isArray(manifest.assets))
    throw new Error('Invalid approved assets manifest');
  const seen=new Set();
  const result={verified:0,bytes:0};
  for(const item of manifest.assets) {
    validateAssetPath(item.path);
    const lower=item.path.normalize('NFC').toLowerCase();
    if(seen.has(lower)) throw new Error('Duplicate or case-colliding asset: '+item.path);
    seen.add(lower);
    if(!Number.isSafeInteger(item.bytes)||item.bytes<0||!/^[a-f0-9]{64}$/.test(item.sha256))
      throw new Error('Invalid hash or size for '+item.path);
    const parts=item.path.split('/');
    let file=resolve(root);
    for(const part of parts) {
      file=join(file,part);
      if(!existsSync(file)) throw new Error('Missing image/font: '+item.path);
      if(lstatSync(file).isSymbolicLink()) throw new Error('Symlink forbidden: '+item.path);
    }
    if(!lstatSync(file).isFile()) throw new Error('Not a file: '+item.path);
    const body=readFileSync(file);
    if(body.length!==item.bytes || createHash('sha256').update(body).digest('hex')!==item.sha256)
      throw new Error('Checksum mismatch: '+item.path);
    result.verified++;
    result.bytes+=body.length;
  }
  return result;
}

function main() {
  const args=process.argv.slice(2);
  if(args.length!==4||args[0]!=='--root'||args[2]!=='--manifest')
    throw new Error('Usage: node scripts/verify-pack.mjs --root public/assets --manifest manifests/approved-assets.json');
  const manifest=JSON.parse(readFileSync(args[3],'utf8'));
  const result=verifyPack(args[1],manifest);
  console.log('Verified '+result.verified+' approved assets ('+result.bytes+' bytes). No uploads or copies.');
}
if(process.argv[1] && resolve(process.argv[1])===resolve(fileURLToPath(import.meta.url))) {
  try{main();}catch(err){console.error('VERIFICATION FAILED:',err.message);process.exitCode=1;}
}
