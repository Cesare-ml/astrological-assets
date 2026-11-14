#!/usr/bin/env node
/** Metadata-only, read-only check of light/dark chart asset inventory. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const FAMILIES = [
  { id: 'chart-overlays', prefix: 'img/grafici/' },
  { id: 'planet-circles', prefix: 'img/symbols/planets/' },
];
const THEMES = ['light', 'dark'];
const sorted = items => [...items].sort();

function checkedPath(path) {
  if (typeof path !== 'string' || !path || path.startsWith('/') || path.includes('\\') ||
      /[\x00-\x1f\x7f]/.test(path) || path.split('/').some(part => !part || part === '.' || part === '..' || part.includes(':')))
    throw new Error('Unsafe asset path: ' + String(path));
  for (const segment of path.split('/')) {
    if (/[<>:"|?*]/.test(segment) || /[. ]$/.test(segment) ||
        /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(segment))
      throw new Error('Windows-incompatible asset path: ' + path);
  }
  return path;
}

export function auditThemePairs(manifest, register) {
  if (manifest?.schemaVersion !== 1 || !Array.isArray(manifest.assets) || !manifest.assets.length)
    throw new Error('Expected a nonempty version-1 asset manifest');
  if (register?.schemaVersion !== 1 || !Array.isArray(register.exceptions))
    throw new Error('Expected a version-1 theme exception register');

  const byFamily = new Map(FAMILIES.map(f => [f.id, { light: new Set(), dark: new Set() }]));
  const foldedPaths = new Set();
  for (const record of manifest.assets) {
    const path = checkedPath(record?.path);
    const folded = path.normalize('NFC').toLowerCase();
    if (foldedPaths.has(folded)) throw new Error('Duplicate or case-colliding manifest path: ' + path);
    foldedPaths.add(folded);
    if (record.status !== undefined && record.status !== 'approved')
      throw new Error('Asset is not approved: ' + path);
    if (!Number.isSafeInteger(record.bytes) || record.bytes < 0 ||
        typeof record.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(record.sha256))
      throw new Error('Invalid manifest hash or size: ' + path);
    for (const field of ['rightsHolder', 'permissionBasis', 'approvalEvidence']) {
      if (typeof record[field] !== 'string' || !record[field].trim())
        throw new Error('Missing private approval metadata ' + field + ': ' + path);
    }
    for (const family of FAMILIES) {
      if (folded.startsWith(family.prefix.toLowerCase()) && !path.startsWith(family.prefix))
        throw new Error('Chart family path casing mismatch: ' + path);
      if (!path.startsWith(family.prefix)) continue;
      const remainder = path.slice(family.prefix.length);
      const slashIndex = remainder.indexOf('/');
      if (slashIndex < 1 || slashIndex === remainder.length - 1)
        throw new Error('Unexpected chart theme path: ' + path);
      const theme = remainder.slice(0, slashIndex);
      if (!THEMES.includes(theme))
        throw new Error('Unexpected chart theme directory: ' + path);
      const relativePath = checkedPath(remainder.slice(slashIndex + 1));
      byFamily.get(family.id)[theme].add(relativePath);
    }
  }

  const exceptions = new Map();
  for (const item of register.exceptions) {
    if (!item || !FAMILIES.some(f => f.id === item.family) || !THEMES.includes(item.only) ||
        typeof item.reason !== 'string' || !item.reason.trim())
      throw new Error('Invalid theme exception record');
    const family = FAMILIES.find(f => f.id === item.family);
    const relativePath = checkedPath(item.relativePath);
    checkedPath(family.prefix + item.only + '/' + relativePath);
    const key = item.family + '\0' + relativePath.normalize('NFC').toLowerCase();
    if (exceptions.has(key)) throw new Error('Duplicate theme exception: ' + relativePath);
    exceptions.set(key, item);
  }

  const used = new Set();
  const missingCounterparts = [];
  const approvedExceptions = [];
  const families = [];
  const emptyFamilies = [];
  for (const family of FAMILIES) {
    const modes = byFamily.get(family.id);
    if (!modes.light.size || !modes.dark.size) emptyFamilies.push(family.id);
    let pairedCount = 0;
    for (const relativePath of sorted(new Set([...modes.light, ...modes.dark]))) {
      const hasLight = modes.light.has(relativePath), hasDark = modes.dark.has(relativePath);
      if (hasLight && hasDark) { pairedCount++; continue; }
      const only = hasLight ? 'light' : 'dark';
      const missingTheme = hasLight ? 'dark' : 'light';
      const entry = { family: family.id, relativePath, only, missingTheme };
      const key = family.id + '\0' + relativePath.normalize('NFC').toLowerCase();
      const exception = exceptions.get(key);
      if (exception && exception.only === only && exception.relativePath === relativePath) {
        used.add(key);
        approvedExceptions.push({ ...entry, reason: exception.reason });
      } else {
        missingCounterparts.push(entry);
      }
    }
    families.push({ family: family.id, lightCount: modes.light.size, darkCount: modes.dark.size, pairedCount });
  }
  const staleExceptions = sorted([...exceptions.keys()].filter(key => !used.has(key))).map(key => {
    const entry = exceptions.get(key);
    return { family: entry.family, relativePath: entry.relativePath, only: entry.only };
  });
  const verdict = emptyFamilies.length || missingCounterparts.length || staleExceptions.length ? 'blocked' : 'verified';
  return { schemaVersion: 1, families, emptyFamilies, approvedExceptions, missingCounterparts, staleExceptions, verdict };
}

function main(args) {
  if (args.length !== 4 || args[0] !== '--manifest' || args[2] !== '--exceptions')
    throw new Error('Usage: node scripts/audit-theme-pairs.mjs --manifest <approved-assets.json> --exceptions <theme-pair-exceptions.json>');
  const manifest = JSON.parse(readFileSync(args[1], 'utf8'));
  const register = JSON.parse(readFileSync(args[3], 'utf8'));
  const result = auditThemePairs(manifest, register);
  console.log(JSON.stringify(result, null, 2));
  if (result.verdict !== 'verified') process.exitCode = 2;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  try { main(process.argv.slice(2)); }
  catch (error) { console.error('THEME PAIR AUDIT FAILED:', error.message); process.exitCode = 1; }
}
