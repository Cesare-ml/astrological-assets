# Asset rights and review protocol

**No assets in the initial catalog are presumed licensed or approved.** A private GitHub repository is not a blanket redistribution permission, even if the images are visible on the VirgoStars site.

## Before marking any asset as approved

Establish who created/owns the artwork, whether the permission covers sharing with invited contractors, commercial VirgoStars use, modification, hosting, and potential future open-source/public redistribution. Preserve any required attribution and the evidence in records controlled by the owner (avoid placing personal contacts or contract scans in the repository).

- **Original graphics:** verify authorship and original source files.
- **Third-party artwork/textures:** check the actual license and redistribution restrictions.
- **Fonts:** check embedding, modification and redistribution permissions separately.
- **Risuonatore Solare branded designs:** treat as a distinct category requiring explicit rights review.
- **Old asset variants:** generally omit unless the active renderer or rollback explicitly needs them.

## Approvals file

Edit `catalog/approvals.json` only after review:

```json
{
  "schemaVersion": 1,
  "assets": [
    {
      "path": "img/simboli-bianchi/segni/01.png",
      "status": "pending",
      "rightsHolder": "",
      "permissionBasis": "",
      "approvalEvidence": ""
    }
  ]
}
```

This example is intentionally **pending**. When the rights holder authorizes a given file, set `status` to `approved` and fill all three textual fields with a genuine reference. Other statuses must not trigger import.

The importer checks that the approved bytes still match the source catalog's Git blob ID and size; it then records SHA-256 in `manifests/approved-assets.json`.

**Do not enter personal data, private contract text, credentials or other secrets in the public-facing evidence field.** Use short opaque references to material stored securely elsewhere.

Only the project owner or a reviewer explicitly authorized by the owner should sign off; an automated coding assistant cannot perform legal rights approval.
