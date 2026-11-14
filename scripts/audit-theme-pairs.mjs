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
    for (const family of FAMILIES) {
      for (const theme of THEMES) {
        const prefix = family.prefix + theme + '/';
        if (path.startsWith(prefix)) {
          const relativePath = checkedPath(path.slice(prefix.length));
          byFamily.get(family.id)[theme].add(relativePath);
        }
      }
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
  for (const family of FAMILIES) {
    const modes = byFamily.get(family.id);
    let pairedCount = 0;
    for (const relativePath of sorted(new Set([...modes.light, ...modes.dark]))) {
      const hasLight = modes.light.has(relativePath), hasDark = modes.dark.has(relativePath);
      if (hasLight && hasDark) { pairedCount++; continue; }
      const only = hasLight ? 'light' : 'dark';
      const missingTheme = hasLight ? 'dark' : 'light';
      const entry = { family: family.id, relativePath, only, missingTheme };
      const key = family.id + '\0' + relativePath.normalize('NFC').toLowerCase();
      const exception = exceptions.get(key);
      if (exception && exception.only === only) {
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
  const verdict = missingCounterparts.length || staleExceptions.length ? 'blocked' : 'verified';
  return { schemaVersion: 1, families, approvedExceptions, missingCounterparts, staleExceptions, verdict };
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
