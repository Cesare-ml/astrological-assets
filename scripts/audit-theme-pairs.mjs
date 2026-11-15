#!/usr/bin/env node
/** Metadata-only, read-only check of light/dark chart asset inventory. */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateAssetPath } from './import-approved-assets.mjs';

const FAMILIES = [
  { id: 'chart-overlays', prefix: 'img/grafici/' },
  { id: 'planet-circles', prefix: 'img/symbols/planets/' },
];
const THEMES = ['light', 'dark'];
// Theme families are renderer imagery, never font or data payloads.
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.avif']);

function validateThemeImage(relativePath) {
  const extension = relativePath.slice(relativePath.lastIndexOf('.')).toLowerCase();
  if (!IMAGE_EXTENSIONS.has(extension))
    throw new Error('Non-image chart theme asset: ' + relativePath);
}

// Independently pinned SHA-256 of the initial 49 family<TAB>relativePath<LF> pairs.
// This locks the release-facing CLI against a modified required-baseline file.
const PINNED_PAIR_COUNT = 49;
const PINNED_PAIR_SHA256 = '6c96873cf4caaa83ace3a6709d1307c6778e2e146d1f971c78d3694e47d516e8';
const sorted = items => [...items].sort();

function checkedPath(path) {
  if (typeof path !== 'string' || !path || path.startsWith('/') || path.includes('\\') ||
      /[\x00-\x1f\x7f]/.test(path) || path.split('/').some(part => !part || part === '.' || part === '..' || part.includes(':')))
    throw new Error('Unsafe asset path: ' + String(path));
  if (path !== path.normalize('NFC'))
    throw new Error('Non-canonical Unicode asset path: ' + path);
  // Astrological Charts rejects encoded URL references and fragments.
  // Keep manifest paths literal and unambiguous in web and offline hosts.
  if (/[#%]/.test(path))
    throw new Error('URL-ambiguous asset path: ' + path);
  for (const segment of path.split('/')) {
    if (/[<>:"|?*]/.test(segment) || /[. ]$/.test(segment) ||
        /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(segment))
      throw new Error('Windows-incompatible asset path: ' + path);
  }
  return path;
}

export function auditThemePairs(manifest, register, requiredPairs = null) {
  if (manifest?.schemaVersion !== 1 || !Array.isArray(manifest.assets) || !manifest.assets.length)
    throw new Error('Expected a nonempty version-1 asset manifest');
  if (register?.schemaVersion !== 1 || !Array.isArray(register.exceptions))
    throw new Error('Expected a version-1 theme exception register');

  const byFamily = new Map(FAMILIES.map(f => [f.id, { light: new Set(), dark: new Set() }]));
  const foldedPaths = new Set();
  for (const record of manifest.assets) {
    const path = validateAssetPath(checkedPath(record?.path));
    const folded = path.normalize('NFC').toLowerCase();
    if (foldedPaths.has(folded)) throw new Error('Duplicate or case-colliding manifest path: ' + path);
    foldedPaths.add(folded);
    if (record.status !== undefined && record.status !== 'approved')
      throw new Error('Asset is not approved: ' + path);
    if (!Number.isSafeInteger(record.bytes) || record.bytes < 0 ||
        typeof record.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(record.sha256))
      throw new Error('Invalid manifest hash or size: ' + path);
    if (typeof record.gitBlobSha !== 'string' || !/^[a-f0-9]{40}$/.test(record.gitBlobSha))
      throw new Error('Invalid manifest Git blob SHA-1 metadata: ' + path);
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
      validateThemeImage(relativePath);
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
    validateThemeImage(relativePath);
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
  const missingRequiredPairs = [];
  if (requiredPairs !== null) {
    if (requiredPairs?.schemaVersion !== 1 || !Array.isArray(requiredPairs.pairs) || !requiredPairs.pairs.length)
      throw new Error('Expected a nonempty version-1 required theme pair inventory');
    const seenRequired = new Set();
    for (const entry of requiredPairs.pairs) {
      const family = FAMILIES.find(f => f.id === entry?.family);
      if (!family) throw new Error('Unknown required theme family: ' + String(entry?.family));
      const relativePath = checkedPath(entry?.relativePath);
      // Reuse importer type/path rules for both canonical consumer URLs.
      validateAssetPath(family.prefix + 'light/' + relativePath);
      validateAssetPath(family.prefix + 'dark/' + relativePath);
      validateThemeImage(relativePath);
      const key = family.id + '\0' + relativePath.toLowerCase();
      if (seenRequired.has(key)) throw new Error('Duplicate or case-colliding required theme pair: ' + relativePath);
      seenRequired.add(key);
      const modes = byFamily.get(family.id);
      const missingThemes = THEMES.filter(theme => !modes[theme].has(relativePath));
      if (missingThemes.length) missingRequiredPairs.push({ family: family.id, relativePath, missingThemes });
    }
    missingRequiredPairs.sort((a, b) =>
      a.family.localeCompare(b.family) || a.relativePath.localeCompare(b.relativePath));
  }
  const verdict = emptyFamilies.length || missingCounterparts.length || staleExceptions.length ||
    missingRequiredPairs.length ? 'blocked' : 'verified';
  return { schemaVersion: 1, auditMode: requiredPairs === null ? 'parity-only' : 'required-baseline',
    families, emptyFamilies, approvedExceptions, missingCounterparts,
    staleExceptions, missingRequiredPairs, verdict };
}

function main(args) {
  const usage = 'Usage: node scripts/audit-theme-pairs.mjs --manifest <approved-assets.json> --exceptions <theme-pair-exceptions.json> (--required <pinned-baseline.json> | --fixture-required <test-baseline.json> | --parity-only yes)';
  if (args.length < 6 || args.length % 2) throw new Error(usage);
  const flags = new Map();
  for (let index = 0; index < args.length; index += 2) {
    const name = args[index], value = args[index + 1];
    if (!['--manifest', '--exceptions', '--required', '--fixture-required', '--parity-only'].includes(name) ||
        !value || value.startsWith('--') || flags.has(name)) throw new Error(usage);
    flags.set(name, value);
  }
  const modes = ['--required', '--fixture-required', '--parity-only'].filter(key => flags.has(key));
  if (!flags.has('--manifest') || !flags.has('--exceptions') || modes.length !== 1 ||
      (flags.has('--parity-only') && flags.get('--parity-only') !== 'yes')) throw new Error(usage);
  const manifest = JSON.parse(readFileSync(flags.get('--manifest'), 'utf8'));
  const register = JSON.parse(readFileSync(flags.get('--exceptions'), 'utf8'));
  const requiredPath = flags.get('--required') ?? flags.get('--fixture-required');
  const required = requiredPath ? JSON.parse(readFileSync(requiredPath, 'utf8')) : null;
  const result = auditThemePairs(manifest, register, required);
  const auditMode = flags.has('--required') ? 'required-baseline' :
    flags.has('--fixture-required') ? 'fixture-baseline' : 'parity-only';
  if (auditMode === 'required-baseline') {
    // Every expected pair must match the independent pin, not just the number of pairs.
    const canonical = required.pairs.map(({ family, relativePath }) =>
      family + '\t' + relativePath).sort().join('\n') + '\n';
    const digest = createHash('sha256').update(canonical, 'utf8').digest('hex');
    if (required.pairs.length !== PINNED_PAIR_COUNT || digest !== PINNED_PAIR_SHA256)
      throw new Error('Pinned theme baseline mismatch: expected 49 exact canonical pairs');
  }
  console.log(JSON.stringify({ ...result, auditMode }, null, 2));
  if (result.verdict !== 'verified') process.exitCode = 2;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  try { main(process.argv.slice(2)); }
  catch (error) { console.error('THEME PAIR AUDIT FAILED:', error.message); process.exitCode = 1; }
}
