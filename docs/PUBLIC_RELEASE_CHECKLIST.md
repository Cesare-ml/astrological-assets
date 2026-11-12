# Public release checklist — Astrological Assets

**Status as of 2026-11-12: NOT CLEARED FOR PUBLICATION.** The repo is private. The original source tooling has a proposed CPAL-1.0 license; **1,013 committed images have private-only permission records**. A public release requires the project owner's explicit rights decisions, not simply a new `LICENSE` file.

## Release gates

- [x] Repository content and contributor instructions use English.
- [x] CPAL-1.0 for the original software, with completed Exhibits A/B and VirgoStars attribution in `LICENSE` and `NOTICE`.
- [x] Public rights recorded separately from private approvals, with an independent, fail-closed preflight.
- [x] **Project owner asserts direct authorship of the images** — owner declaration recorded 2026-11-12; see [owner-authored artwork](OWNER_AUTHORSHIP_AND_ARTWORK.md).
- [x] **Git tree filename audit** of 51 main-branch commit snapshots (not a complete secret or legal audit); see [audit record](HISTORY_FILE_AUDIT_2026-11-12.md).
- [ ] **Rights holder approves each image for public redistribution**, including derivative use, and selects a legally appropriate license. Check any third-party fonts, glyphs, maps, textures, marks, and generated images for source restrictions.
- [ ] Populate `catalog/publication-approvals.json` with the real image path, SHA-256, license, rights holder, evidence and third-party review. No automatic approval.
- [ ] Verify every current binary: `npm run verify:pack` and `npm run check:public-release` both succeed (exit 0). Review unexpected/unlisted files manually.
- [ ] Audit contents and metadata of ALL historical Git blobs and earlier commits for non-public asset files, personal information, credentials, third-party content, restricted materials, and other unpublished work. A clean HEAD does **not** mean safe history.
- [ ] If some historical material cannot be published, **do not switch this repository to public**. Prepare a fresh public repo/export from a rights-cleared tree, with a **new root commit and no connection to private Git history**, then review that export.
- [ ] Run `npm test` and `npm run audit:catalog`. Run renderer integration and compatibility tests where meaningful.
- [ ] Check downstream paths and attribution in actual Angular/Three.js applications, websites and offline artifacts; keep the canonical `/assets/img/` URLs.
- [ ] Owner verifies the final repository tree/history, license records, README, badges, external links, and GitHub settings.
- [ ] Obtain **explicit owner approval** before changing GitHub visibility, merging the publication PR, tagging a release or shipping assets.

## Public-release preflight

```sh
npm test
npm run audit:catalog
npm run verify:pack
npm run check:public-release
npm run review:public -- --out ./artwork-review.local.json
```

The last command returns **exit code 2** when any image is missing explicit public approval, a record is inconsistent, or the current pack includes an unlisted binary; it returns **exit code 0** only if the *current pack* meets the recorded metadata checks. The script does **not** authenticate legal ownership, discover unknown third-party rights, or scan historical Git objects. This is a technical guardrail, **not legal certification**.

### Public authorization record format (illustrative only)

This is an example of the *shape* of a future, independently documented approval. **Do not commit a fabricated example as a real approval.**

```json
{
  "schemaVersion": 1,
  "assets": [
    {
      "path": "img/example.png",
      "sha256": "<actual 64-character SHA-256 of reviewed bytes>",
      "status": "approved",
      "permissionScope": "public-redistribution",
      "licenseId": "<explicitly chosen license SPDX identifier>",
      "rightsHolder": "<verified name or role>",
      "publicApprovalEvidence": "<reference to authorization kept securely>",
      "thirdPartyReview": "<review of font, glyph, source art and other dependencies>"
    }
  ]
}
```

The path and SHA-256 must match the corresponding record in `manifests/approved-assets.json`. All non-empty legal fields require a **real human decision**. Do not include contract scans, personal contact information or secrets in Git history.

## Publication sequence

1. Decide if **this existing repository's entire history** is releasable. If not, choose a clean-history export, not a force-push that could leave private objects accessible.
2. Have the rights holder supply and sign off on asset permissions; remove/replace any asset that cannot be lawfully made public from the **future public export**.
3. Rebuild the manifest from the reviewed asset pack and run integrity, license and consumer checks. Inspect the exact commit.
4. Publish only following the owner's explicit approval. Preserve `Powered by VirgoStars` attribution and CPAL notices, plus per-asset licensing terms.
5. Keep website and offline-Astrolabio deployments separate, version-pinned, tested and reversible. No automatic production migration.

## Non-goals

This PR does **not** change repository visibility, publish images, relicense third-party material, run GitHub Actions, modify the VirgoStars production site or merge changes automatically.
