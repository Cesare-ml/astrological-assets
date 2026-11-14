import assert from 'node:assert/strict';
import { test } from 'node:test';
import { prepareReview } from '../scripts/prepare-review.mjs';

const file = (path, legacy = false) => ({
  path, legacy, bytes: 9, gitBlobSha: 'a'.repeat(40),
});
const catalog = {
  schemaVersion: 1,
  files: [
    file('img/simboli/segni/aries.png'),
    file('img/simboli/segni/variants/aries.png'),
    file('img/simboli/segni/old.png', true),
    file('img/simboli/segni-v2/aries.png'),
    file('img/simboli/segniother/aries.png'),
  ],
};

test('directory family without trailing slash excludes similarly named siblings', () => {
  const review = prepareReview(catalog, 'img/simboli/segni');
  assert.deepEqual(review.assets.map(x => x.path), [
    'img/simboli/segni/aries.png',
    'img/simboli/segni/variants/aries.png',
  ]);
  assert.ok(review.assets.every(x => x.status === 'pending' && x.permissionBasis === ''));
});

test('trailing slash has the same exact directory semantics', () => {
  assert.deepEqual(
    prepareReview(catalog, 'img/simboli/segni/'),
    prepareReview(catalog, 'img/simboli/segni'),
  );
});

test('legacy assets require explicit opt-in without including sibling families', () => {
  const review = prepareReview(catalog, 'img/simboli/segni', { includeLegacy: true });
  assert.deepEqual(review.assets.map(x => x.path), [
    'img/simboli/segni/aries.png',
    'img/simboli/segni/variants/aries.png',
    'img/simboli/segni/old.png',
  ]);
});

test('a sibling-only selection remains empty instead of silently widening scope', () => {
  assert.throws(() => prepareReview({
    schemaVersion: 1,
    files: [file('img/simboli/segni-other/aries.png')],
  }, 'img/simboli/segni'), /No candidate images\/fonts/);
});
