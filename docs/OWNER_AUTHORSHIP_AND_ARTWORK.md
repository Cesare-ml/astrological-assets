# Owner declaration and artwork licensing status

**Recorded 2026-11-12.** The project owner explicitly stated that they personally created the images in this repository, in the same conversation requesting preparation of Astrological Assets for a public open-source release. The provenance reference and pinned scope are recorded in [catalog/owner-authorship.json](../catalog/owner-authorship.json): the existing 1,013-file SHA-256 manifest.

This statement is meaningful: the initial rights review no longer needs to assume the owner is unknown or that the images were sourced wholesale from other creators. It is **not** independent verification and does **not automatically clear any third-party components** used in the images. In particular, an earlier attestation notes that some glyphs were rendered from a font with an unknown license. The repository does not include the font itself.

## Distinct questions

- **Authorship of finished images:** owner claims direct authorship for the manifest's 1,013 images.
- **Underlying material:** establish whether each artwork incorporates fonts/glyphs, textures, maps, third-party imagery or branding subject to separate restrictions. A copyrighted font program is not necessarily the same thing as a rasterized glyph output, but its actual license and any downstream restrictions must be checked.
- **Public license for the artwork:** choose a specific license and record an actual public redistribution grant from the rights holder. The repository's CPAL-1.0 code license applies to software and documentation, not automatically to images. No artwork license has been selected yet.
- **Historic content:** verify that any public repository history contains only distributable material; do not assume changing the latest tree removes older material.

## Practical next step

Use `npm run review:public -- --out ./artwork-review.local.json` to generate a manifest-pinned, **pending-only** worksheet of every image and its hash. The generator cannot grant any permissions. Review families together where genuinely appropriate, including font-derived variants, and then approve individual public license records with real evidence through the existing `catalog/publication-approvals.json` process.

A common open-content choice for standalone images would be **CC BY 4.0** (reuse with attribution) or **CC BY-SA 4.0** (reuse with attribution and share-alike); the owner must choose the actual terms. These are examples, **not** a grant. VirgoStars branding/trademarks are distinct from copyright permission.

The release gate is kept fail-closed until those choices and third-party checks are complete.
