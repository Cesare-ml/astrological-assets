import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { assertRasterHeader, inspectRasterHeaders } from '../scripts/check-raster-headers.mjs';

const png = () => {
  const b = Buffer.alloc(33);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(b);
  b.writeUInt32BE(13, 8); b.write('IHDR', 12, 'ascii');
  b.writeUInt32BE(1, 16); b.writeUInt32BE(1, 20);
  b[24] = 8; b[25] = 6;
  return b; // Synthetic valid header only; no pixel data or real artwork.
};
const jpeg = () => Buffer.from([255, 216, 255, 224, 0, 2, 255, 217]);
const webp = () => {
  const b = Buffer.alloc(22);
  b.write('RIFF', 0); b.writeUInt32LE(14, 4); b.write('WEBP', 8);
  b.write('VP8L', 12); b.writeUInt32LE(2, 16);
  b[20] = 0x2f;
  return b;
};
const manifestRecord = (path, data) => ({
  path, bytes: data.length, sha256: createHash('sha256').update(data).digest('hex'),
});

function fixture(callback) {
  const root = mkdtempSync(join(tmpdir(), 'astro-raster-'));
  const pack = join(root, 'assets');
  mkdirSync(join(pack, 'img'), { recursive: true });
  const add = (path, bytes) => {
    const full = join(pack, ...path.split('/'));
    writeFileSync(full, bytes);
    return manifestRecord(path, bytes);
  };
  try { return callback({ root, pack, add }); }
  finally { rmSync(root, { recursive: true, force: true }); }
}

test('recognizes PNG, JPEG and WebP signatures with synthetic headers', () => {
  assert.equal(assertRasterHeader(png(), 'img/one.png'), 'png');
  assert.equal(assertRasterHeader(jpeg(), 'img/two.jpg'), 'jpeg');
  assert.equal(assertRasterHeader(jpeg(), 'img/two.jpeg'), 'jpeg');
  assert.equal(assertRasterHeader(webp(), 'img/three.webp'), 'webp');
});

test('rejects mismatched extensions, incomplete payloads and unsupported types', () => {
  assert.throws(() => assertRasterHeader(jpeg(), 'img/picture.png'), /PNG/);
  assert.throws(() => assertRasterHeader(png(), 'img/picture.jpg'), /JPEG/);
  assert.throws(() => assertRasterHeader(Buffer.alloc(2), 'img/picture.webp'), /WebP/);
  assert.throws(() => assertRasterHeader(png(), 'img/picture.gif'), /Unsupported/);
});

test('rejects malformed PNG IHDR and invalid color/bit-depth combinations', () => {
  const wrongLength = png(); wrongLength.writeUInt32BE(12, 8);
  assert.throws(() => assertRasterHeader(wrongLength, 'img/x.png'), /PNG/);
  const zeroWidth = png(); zeroWidth.writeUInt32BE(0, 16);
  assert.throws(() => assertRasterHeader(zeroWidth, 'img/x.png'), /PNG/);
  const badColor = png(); badColor[24] = 1;
  assert.throws(() => assertRasterHeader(badColor, 'img/x.png'), /PNG/);
});

test('rejects inconsistent WebP RIFF/chunk sizes', () => {
  const wrongSize = webp(); wrongSize.writeUInt32LE(9, 4);
  assert.throws(() => assertRasterHeader(wrongSize, 'img/x.webp'), /WebP/);
  const overrun = webp(); overrun.writeUInt32LE(500, 16);
  assert.throws(() => assertRasterHeader(overrun, 'img/x.webp'), /WebP/);
});

test('verifies hashes and format counts for a local synthetic pack', () => fixture(x => {
  const assets = [
    x.add('img/one.png', png()), x.add('img/two.jpg', jpeg()), x.add('img/three.webp', webp()),
  ];
  const result = inspectRasterHeaders({ root: x.pack, manifest: { schemaVersion: 1, assets } });
  assert.equal(result.assetsChecked, 3);
  assert.deepEqual(result.formats, { png: 1, jpeg: 1, webp: 1 });
  assert.equal(result.verdict, 'verified');
  writeFileSync(join(x.pack, 'img', 'one.png'), jpeg());
  assert.throws(() => inspectRasterHeaders({root:x.pack,manifest:{schemaVersion:1,assets}}), /mismatch/);
}));

test('rejects duplicate, pending and traversal manifest entries', () => fixture(x => {
  const item = x.add('img/one.png', png());
  const inspect = assets => inspectRasterHeaders({ root:x.pack, manifest:{schemaVersion:1,assets} });
  assert.throws(() => inspect([item, {...item, path:'img/ONE.PNG'}]), /case-colliding/);
  assert.throws(() => inspect([{...item,status:'pending'}]), /not approved/);
  assert.throws(() => inspect([{...item,path:'img/../../secrets.png'}]), /Unsafe/);
  assert.throws(() => inspect([]), /nonempty/);
}));

test('rejects symlink paths without reading a linked image where supported', t => fixture(x => {
  const item = x.add('img/one.png', png());
  rmSync(join(x.pack, 'img', 'one.png'));
  try { symlinkSync(join(x.root, 'not-an-image.png'), join(x.pack,'img','one.png')); }
  catch (error) {
    if (process.platform === 'win32' && ['EPERM','EACCES'].includes(error.code))
      return t.skip('Symlinks unavailable');
    throw error;
  }
  assert.throws(() => inspectRasterHeaders({root:x.pack,manifest:{schemaVersion:1,assets:[item]}}), /Symlink/);
}));

test('CLI produces read-only JSON and exits nonzero on tampering', () => fixture(x => {
  const item = x.add('img/one.png', png());
  const manifestFile = join(x.root, 'manifest.json');
  writeFileSync(manifestFile, JSON.stringify({ schemaVersion:1, assets:[item] }));
  const script = fileURLToPath(new URL('../scripts/check-raster-headers.mjs', import.meta.url));
  const run = () => spawnSync(process.execPath,[script,'--root',x.pack,'--manifest',manifestFile],{encoding:'utf8'});
  assert.equal(run().status, 0);
  assert.equal(JSON.parse(run().stdout).assetsChecked,1);
  writeFileSync(join(x.pack,'img','one.png'),jpeg());
  const failed = run();
  assert.equal(failed.status,1);
  assert.match(failed.stderr,/RASTER HEADER PREFLIGHT FAILED/);
}));
