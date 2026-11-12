# Public release checklist — Astrological Assets

**Status as of 2026-11-12: REPOSITORY PUBLIC, ARTWORK CLEARANCE INCOMPLETE.** The owner has changed GitHub visibility to public, and 1,013 image files and accessible Git history are exposed. Source tooling has a CPAL-1.0 license; original owner-created artwork is subject to an owner-selected CC BY 4.0 policy, but no per-file third-party clearance has been recorded. Visibility does not prove all images can lawfully be redistributed.

## Release gates

- [x] Repository content and contributor instructions use English.
- [x] CPAL-1.0 for the original software, with completed Exhibits A/B and VirgoStars attribution in `LICENSE` and `NOTICE`.
- [x] Public rights recorded separately from private approvals, with an independent, fail-closed preflight.
- [x] **Project owner asserts direct authorship of the images** — owner declaration recorded 2026-11-12; see [owner-authored artwork](OWNER_AUTHORSHIP_AND_ARTWORK.md).
- [x] **Git tree filename audit** of 51 main-branch commit snapshots (not a complete secret or legal audit); see [audit record](HISTORY_FILE_AUDIT_2026-11-12.md).
- [x] **Owner selected CC BY 4.0** for the original artistic contributions. See [artwork licensing policy](ARTWORK_LICENSING_POLICY.md).
- [ ] **Human reviewer clears each complete image file** for public redistribution, including underlying third-party material. Check any third-party fonts, glyphs, maps, textures, marks, and generated images for source restrictions.
- [ ] Populate `catalog/publication-approvals.json` with exact image paths and SHA-256s, CC-BY-4.0, rights holder and evidence, plus `thirdPartyStatus: "cleared"` and a specific third-party review. No automatic approval.
- [ ] Verify every current binary: `npm run verify:pack` and `npm run check:public-release` both succeed (exit 0). Review unexpected/unlisted files manually.
- [ ] Audit contents and metadata of ALL historical Git blobs and earlier commits for non-public asset files, personal information, credentials, third-party content, restricted materials, and other unpublished work. A clean HEAD does **not** mean safe history.
- [ ] If rights-restricted material is found in publicly reachable history, promptly assess mitigation with the owner. Removing it from the current tree or moving to a clean-history export does **not** reverse prior public access, clones, caches or forks.
- [ ] Run `npm test` and `npm run audit:catalog`. Run renderer integration and compatibility tests where meaningful.
- [ ] Check downstream paths and attribution in actual Angular/Three.js applications, websites and offline artifacts; keep the canonical `/assets/img/` URLs.
- [ ] Owner verifies the final repository tree/history, license records, README, badges, external links, and GitHub settings.
- [x] Owner made the repository public on 2026-11-12. PR #5 was merged into `main` at their explicit request.
- [ ] Obtain **explicit owner approval** before any new release/tag/deployment. Finish historical content audits and per-file artwork rights reviews without implying public access equals legal clearance.

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
      "licenseId": "CC-BY-4.0",
      "rightsHolder": "<verified name or role>",
      "publicApprovalEvidence": "<reference to authorization kept securely>",
      "thirdPartyStatus": "cleared",
      "thirdPartyReview": "<specific review of font, glyph, source art and other dependencies>"
    }
  ]
}
```

The approval must match the owner's selected license and the pinned manifest in `catalog/artwork-license-decision.json`. The path and SHA-256 must match the corresponding record in `manifests/approved-assets.json`. All non-empty legal fields require a **real human decision**. Do not include contract scans, personal contact information or secrets in Git history.

## Publication sequence

1. Audit the **already-public** repository history and current tree. If non-distributable historical files are found, escalate to the owner promptly; neither a force-push nor a clean-history export can undo copies already obtained.
2. Have the rights holder supply and sign off on asset permissions; remove/replace any asset that cannot be lawfully made public from the **future public export**.
3. Rebuild the manifest from the reviewed asset pack and run integrity, license and consumer checks. Inspect the exact commit.
4. Do not claim all image files are cleared for public reuse until the review and clearance records actually pass. Preserve `Powered by VirgoStars` attribution and CPAL notices, plus per-asset licensing terms.
5. Keep website and offline-Astrolabio deployments separate, version-pinned, tested and reversible. No automatic production migration.

## Non-goals

The repository is already public as of 2026-11-12. These review and validation tools do **not** settle third-party licensing, run GitHub Actions, modify the VirgoStars production site or deploy releases.
