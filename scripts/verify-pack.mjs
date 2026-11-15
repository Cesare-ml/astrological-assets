#!/usr/bin/env node
// Verifies a checked-out approved asset pack without the private VirgoStars repository.
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateAssetPath } from './import-approved-assets.mjs';

export function verifyPack(root, manifest, { strict = false } = {}) {
  if (typeof strict !== 'boolean') throw new Error('strict must be a boolean');
  const rootPath = resolve(root);
  const rootInfo = lstatSync(rootPath);
  if (rootInfo.isSymbolicLink() || !rootInfo.isDirectory())
    throw new Error('Unsafe pack root: ' + rootPath);
  if(!manifest || manifest.schemaVersion!==1 || !Array.isArray(manifest.assets) || manifest.assets.length===0)
    throw new Error('Invalid or empty approved assets manifest');
  const seen=new Set(), listedPaths=new Set();
  const result={verified:0,bytes:0};
  for(const item of manifest.assets) {
    validateAssetPath(item.path);
    if(item.status!==undefined && item.status!=='approved') throw new Error('Asset is not approved: '+item.path);
    const lower=item.path.normalize('NFC').toLowerCase();
    if(seen.has(lower)) throw new Error('Duplicate or case-colliding asset: '+item.path);
    seen.add(lower);
    listedPaths.add(item.path);
    if(!Number.isSafeInteger(item.bytes)||item.bytes<0||!/^[a-f0-9]{64}$/.test(item.sha256))
      throw new Error('Invalid hash or size for '+item.path);
    for(const field of ['rightsHolder','permissionBasis','approvalEvidence'])
      if(typeof item[field]!=='string' || !item[field].trim())
        throw new Error('Missing approval metadata '+field+' for '+item.path);
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
  if (strict) {
    // Unlike a manifest-only hash check, this closes the entire distribution
    // root. Extra files, dangling links and cross-platform path collisions
    // must not pass unnoticed when preparing an asset pack.
    const encountered = new Set(), extras = [];
    function walk(directory) {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const absolute = join(directory, entry.name);
        const path = relative(rootPath, absolute).split(sep).join('/');
        const key = path.normalize('NFC').toLowerCase();
        if (encountered.has(key)) throw new Error('Case-colliding pack path: ' + path);
        encountered.add(key);
        const info = lstatSync(absolute);
        if (info.isSymbolicLink()) throw new Error('Symlink forbidden in pack: ' + path);
        if (info.isDirectory()) walk(absolute);
        else if (!info.isFile()) throw new Error('Non-regular pack entry: ' + path);
        else if (!listedPaths.has(path)) extras.push(path);
      }
    }
    walk(rootPath);
    if (extras.length) {
      extras.sort();
      throw new Error('Unlisted files in pack (' + extras.length + '): ' + extras.slice(0, 10).join(', '));
    }
  }
  return result;
}

function main() {
  const rawArgs = process.argv.slice(2);
  const strictCount = rawArgs.filter(arg => arg === '--strict').length;
  const args = rawArgs.filter(arg => arg !== '--strict');
  if(strictCount>1 || args.length!==4 || args[0]!=='--root' || args[2]!=='--manifest')
    throw new Error('Usage: node scripts/verify-pack.mjs --root public/assets --manifest manifests/approved-assets.json [--strict]');
  const manifest=JSON.parse(readFileSync(args[3],'utf8'));
  const result=verifyPack(args[1],manifest,{strict:strictCount===1});
  console.log('Verified '+result.verified+' approved assets ('+result.bytes+' bytes).'
    +(strictCount ? ' Strict closure verified.' : '')+' No uploads or copies.');
}
if(process.argv[1] && resolve(process.argv[1])===resolve(fileURLToPath(import.meta.url))) {
  try{main();}catch(err){console.error('VERIFICATION FAILED:',err.message);process.exitCode=1;}
}
