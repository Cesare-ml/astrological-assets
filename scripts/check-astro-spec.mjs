#!/usr/bin/env node
// Validate only the Unicode/design contract. No Astro-SemiBold font data is loaded.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const EXPECTED = Object.freeze([
  ['aries', 'Aries', 'zodiac', 0x2648, 'A', 'paired-horns'],
  ['taurus', 'Taurus', 'zodiac', 0x2649, 'B', 'horns-above-circle'],
  ['gemini', 'Gemini', 'zodiac', 0x264a, 'C', 'paired-pillars'],
  ['cancer', 'Cancer', 'zodiac', 0x264b, 'D', 'opposed-curls'],
  ['leo', 'Leo', 'zodiac', 0x264c, 'E', 'loop-and-tail'],
  ['virgo', 'Virgo', 'zodiac', 0x264d, 'F', 'inward-tail'],
  ['libra', 'Libra', 'zodiac', 0x264e, 'G', 'arch-and-line'],
  ['scorpio', 'Scorpio', 'zodiac', 0x264f, 'H', 'outward-arrow-tail'],
  ['sagittarius', 'Sagittarius', 'zodiac', 0x2650, 'I', 'diagonal-arrow'],
  ['capricorn', 'Capricorn', 'zodiac', 0x2651, 'J', 'angular-curl'],
  ['aquarius', 'Aquarius', 'zodiac', 0x2652, 'K', 'parallel-waves'],
  ['pisces', 'Pisces', 'zodiac', 0x2653, 'L', 'linked-opposed-curves'],
  ['sun', 'Sun', 'body', 0x2609, 'Q', 'circle-dot'],
  ['moon', 'Moon', 'body', 0x263d, 'R', 'crescent'],
  ['mercury', 'Mercury', 'body', 0x263f, 'S', 'crescent-circle-cross'],
  ['venus', 'Venus', 'body', 0x2640, 'T', 'circle-cross'],
  ['mars', 'Mars', 'body', 0x2642, 'U', 'circle-arrow'],
  ['jupiter', 'Jupiter', 'body', 0x2643, 'V', 'curl-cross'],
  ['saturn', 'Saturn', 'body', 0x2644, 'W', 'cross-hook'],
  ['uranus', 'Uranus', 'body', 0x2645, 'X', 'h-and-circle'],
  ['neptune', 'Neptune', 'body', 0x2646, 'Y', 'trident-cross'],
  ['pluto', 'Pluto', 'body', 0x2647, 'Z', 'circle-crescent-cross'],
]);

function isRecord(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function hasOnlyKeys(obj, allowed, label) {
  const expected = new Set(allowed);
  for (const key of Object.keys(obj)) {
    if (!expected.has(key)) throw new Error(label + ' includes forbidden key: ' + key);
  }
  for (const key of allowed) {
    if (!Object.hasOwn(obj, key)) throw new Error(label + ' is missing key: ' + key);
  }
}

export function validateAstroSpec(spec) {
  if (!isRecord(spec)) throw new Error('Astro spec must be an object');
  hasOnlyKeys(spec, [
    'schemaVersion', 'family', 'version', 'status', 'provenancePolicy',
    'licenseStatus', 'geometryIncluded', 'metrics', 'glyphs',
  ], 'Astro spec');
  if (spec.schemaVersion !== 1 || spec.family !== 'VirgoStars Astro' ||
      spec.version !== '0.0.0-planning' || spec.status !== 'planning') {
    throw new Error('Expected VirgoStars Astro planning contract v1');
  }
  if (spec.provenancePolicy !== 'independent-original-outlines-only' ||
      spec.licenseStatus !== 'not-selected' || spec.geometryIncluded !== false) {
    throw new Error('Unapproved outline, provenance or font licensing status');
  }
  if (!isRecord(spec.metrics)) throw new Error('Missing design metrics');
  hasOnlyKeys(spec.metrics, [
    'unitsPerEm', 'ascender', 'descender', 'defaultAdvance',
  ], 'Metrics');
  const { unitsPerEm, ascender, descender, defaultAdvance } = spec.metrics;
  if (![unitsPerEm, ascender, descender, defaultAdvance].every(Number.isInteger) ||
      unitsPerEm !== 1000 || ascender <= 0 || descender >= 0 ||
      ascender - descender !== unitsPerEm ||
      defaultAdvance <= 0 || defaultAdvance > 2 * unitsPerEm) {
    throw new Error('Invalid proposed metrics');
  }
  if (!Array.isArray(spec.glyphs) || spec.glyphs.length !== EXPECTED.length) {
    throw new Error('Expected exactly 22 Unicode glyph entries');
  }
  const expectedById = new Map(EXPECTED.map(x => [x[0], x]));
  const usedIds = new Set();
  const usedUnicode = new Set();
  const usedLegacy = new Set();
  for (const glyph of spec.glyphs) {
    if (!isRecord(glyph)) throw new Error('Glyph entry must be an object');
    hasOnlyKeys(glyph, [
      'id', 'category', 'name', 'unicode', 'character', 'legacyReferenceKey',
      'traditionalForm', 'status',
    ], 'Glyph');
    const expected = expectedById.get(glyph.id);
    if (!expected) throw new Error('Unexpected glyph id: ' + glyph.id);
    if (usedIds.has(glyph.id)) throw new Error('Duplicate glyph id: ' + glyph.id);
    usedIds.add(glyph.id);
    const [id, name, category, cp, legacyKey, form] = expected;
    const unicode = 'U+' + cp.toString(16).toUpperCase().padStart(4, '0');
    if (glyph.id !== id || glyph.name !== name || glyph.category !== category ||
        glyph.unicode !== unicode || glyph.character !== String.fromCodePoint(cp) ||
        glyph.legacyReferenceKey !== legacyKey || glyph.traditionalForm !== form ||
        glyph.status !== 'planned') {
      throw new Error('Invalid character, Unicode mapping or traditional variant: ' + id);
    }
    if (usedUnicode.has(glyph.unicode) || usedLegacy.has(glyph.legacyReferenceKey)) {
      throw new Error('Duplicate Unicode or historical reference key: ' + id);
    }
    usedUnicode.add(glyph.unicode);
    usedLegacy.add(glyph.legacyReferenceKey);
  }
  return {
    family: spec.family,
    glyphs: usedIds.size,
    zodiac: spec.glyphs.filter(g => g.category === 'zodiac').length,
    bodies: spec.glyphs.filter(g => g.category === 'body').length,
    plannedOnly: true,
  };
}

function main() {
  const path = new URL('../specs/virgostars-astro.v0.json', import.meta.url);
  const report = validateAstroSpec(JSON.parse(readFileSync(path, 'utf8')));
  console.log(JSON.stringify(report, null, 2));
}

if (process.argv[1] && fileURLToPath(import.meta.url) ===
    resolve(process.argv[1])) {
  try {
    main();
  } catch (error) {
    console.error('ASTRO SPEC ERROR:', error.message);
    process.exitCode = 1;
  }
}
