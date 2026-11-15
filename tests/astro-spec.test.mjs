import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { validateAstroSpec } from '../scripts/check-astro-spec.mjs';

const fixture = JSON.parse(readFileSync(new URL('../specs/virgostars-astro.v0.json', import.meta.url), 'utf8'));
const clone = () => structuredClone(fixture);
const fail = (change, pattern) => {
  const bad = clone();
  change(bad);
  assert.throws(() => validateAstroSpec(bad), pattern);
};

test('canonical 22-glyph registry has complete zodiac and body coverage', () => {
  const r = validateAstroSpec(fixture);
  assert.deepEqual(r, {
    family: 'VirgoStars Astro',
    glyphs: 22,
    zodiac: 12,
    bodies: 10,
    plannedOnly: true,
  });
  assert.equal(fixture.glyphs.find(g => g.id === 'uranus').traditionalForm, 'h-and-circle');
  assert.equal(fixture.glyphs.find(g => g.id === 'pluto').traditionalForm, 'circle-crescent-cross');
});

test('reject missing, duplicate and additional glyphs', () => {
  fail(s => { s.glyphs.pop(); }, /exactly 22/);
  fail(s => { s.glyphs[1] = s.glyphs[0]; }, /Duplicate glyph id/);
  fail(s => { s.glyphs[0].id = 'chiron'; }, /Unexpected glyph/);
});

test('reject Unicode, historical key, name or traditional variant changes', () => {
  fail(s => { s.glyphs[0].unicode = 'U+0041'; }, /mapping or traditional variant/);
  fail(s => { s.glyphs[0].character = 'A'; }, /mapping or traditional variant/);
  fail(s => { s.glyphs[0].legacyReferenceKey = 'Q'; }, /mapping or traditional variant/);
  fail(s => { s.glyphs.find(g => g.id === 'uranus').traditionalForm = 'alternative'; }, /mapping or traditional variant/);
  fail(s => { s.glyphs.find(g => g.id === 'pluto').name = 'PL'; }, /mapping or traditional variant/);
});

test('reject glyph geometry, paths, embedded font data and unapproved licensing', () => {
  fail(s => { s.glyphs[0].outline = 'M0 0 L1 1'; }, /forbidden key/);
  fail(s => { s.fontBinaryBase64 = 'AA=='; }, /forbidden key/);
  fail(s => { s.geometryIncluded = true; }, /Unapproved outline/);
  fail(s => { s.licenseStatus = 'SIL-OFL-1.1'; }, /Unapproved outline/);
  fail(s => { s.provenancePolicy = 'copied-source-outlines'; }, /Unapproved outline/);
});

test('reject malformed design metrics and incomplete contracts', () => {
  fail(s => { s.metrics.unitsPerEm = 2048; }, /Invalid proposed metrics/);
  fail(s => { s.metrics.descender = 200; }, /Invalid proposed metrics/);
  fail(s => { s.metrics.filePath = 'ASTRO-SE.TTF'; }, /forbidden key/);
  fail(s => { delete s.glyphs[0].status; }, /missing key/);
  fail(s => { s.version = '1.0.0'; }, /planning contract/);
});
