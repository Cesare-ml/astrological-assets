import assert from 'node:assert/strict';
import {test} from 'node:test';
import {preparePublicationReview} from '../scripts/prepare-publication-review.mjs';

const item={path:'img/simboli/segni/01.png',sha256:'a'.repeat(64)};
test('publication review emits only pending, empty public licenses',()=>{
  const r=preparePublicationReview({schemaVersion:1,assets:[item]});
  assert.equal(r.assets.length,1);
  assert.equal(r.assets[0].status,'pending');
  assert.equal(r.assets[0].permissionScope,'not-yet-granted');
  assert.equal(r.assets[0].licenseId,'');
  assert.equal(r.assets[0].thirdPartyStatus,'pending');
  assert.equal(r.assets[0].publicApprovalEvidence,'');
  assert.equal(r.assets[0].authorClaimReference,'catalog/owner-authorship.json');
});
test('publication review blocks invalid schema, duplicate paths and hashes',()=>{
  assert.throws(()=>preparePublicationReview({schemaVersion:1,assets:[]}),/nonempty/);
  assert.throws(()=>preparePublicationReview({schemaVersion:1,assets:[item,{...item,path:item.path.toUpperCase()}]}),/case-colliding/);
  assert.throws(()=>preparePublicationReview({schemaVersion:1,assets:[{...item,sha256:'bad'}]}),/SHA-256/);
});
