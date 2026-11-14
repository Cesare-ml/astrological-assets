# Read-only raster header preflight

The asset manifest currently lists 1,013 raster files: 1,009 PNG, 3 JPEG and 1 WebP. The SHA-256 verification gate detects changed bytes, but it does not tell a reviewer whether an accidentally replaced file still has the expected image format.

Run this additional **local** integrity check against an authorized checkout:

```sh
npm run check:raster-headers
```

The command reads `public/assets` and `manifests/approved-assets.json` and rejects:

- Any manifest path that is unsafe, duplicated under Unicode normalization/case folding, unapproved, or missing.
- Symlinks in the pack root, its ancestors, or any manifest-listed asset path.
- A manifest size or SHA-256 that does not match the actual file.
- Incorrect PNG magic bytes or basic IHDR structure and dimensions.
- Incorrect JPEG SOI/initial marker bytes.
- Incorrect WebP RIFF/WEBP/VP8-family chunk headers and declared sizes.
- Any other raster extension until a separate validation policy is added.

Successful output includes the verified asset count, byte count and format counts. The script does not copy, modify, repack, export or publish files. It is read-only, works without a browser or third-party packages, and is covered by synthetic-only regression tests.

**Important limitations:** this is a signature and minimal-header check, **not full image decoding** or visual QA. It does not validate PNG CRC, every JPEG segment, compressed pixel streams, color profiles, image accessibility, source originality or any legal license. A valid-looking header can still contain a damaged image. Continue running `npm run verify:pack`, `npm test`, chart/browser smoke tests and the separate human artwork-rights clearance. **An integrity pass is not permission to redistribute images.**

No GitHub Actions, network access or production change is required.
