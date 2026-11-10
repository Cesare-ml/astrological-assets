# Asset rights and review protocol

**Assets in the initial catalog are not presumed licensed or approved.** A private GitHub repository is not a blanket redistribution permission, even if the images are visible on the VirgoStars site. The separate approvals file records explicit owner attestations; it does not authorize public redistribution.

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

At apply time the importer rechecks every selected source and destination against the plan before the first write, rejects symlink/junction ancestors of the target, and writes the bytes it just verified. A changed input or destination blocks the import. This is not a filesystem transaction or a defence against a concurrently hostile process changing paths during the operation: an I/O error can leave a partial import and the previous manifest. Work in an isolated directory, inspect any partial result and restore it before retrying.

**Do not enter personal data, private contract text, credentials or other secrets in the public-facing evidence field.** Use short opaque references to material stored securely elsewhere.

Only the project owner or a reviewer explicitly authorized by the owner should sign off; an automated coding assistant cannot perform legal rights approval.

An approved-pack record with an explicit `status` other than `approved` is rejected by the pack verifier and build gates, even if its textual fields are filled. Existing importer-generated manifests omit `status` and remain supported; their evidence fields still require human review and are not independently authenticated by these scripts.

## Revisione rapida per famiglia, senza approvare automaticamente

Per preparare 12 schede dei segni senza compilarle manualmente una a una:

```powershell
node scripts/prepare-review.mjs --family img/simboli-bianchi/segni/ --out ./segni-review.local.json
```

Tutte le voci escono con `status: "pending"`, insieme a hash Git e dimensione per controllo. Solo il titolare dei diritti può confermare le autorizzazioni con documentazione verificabile. Il file locale non viene caricato automaticamente su GitHub e non copia nessuna immagine.

## Prima scheda pronta alla verifica umana

Il file [`catalog/reviews/simboli-bianchi.pending.json`](../catalog/reviews/simboli-bianchi.pending.json) è la scheda storica iniziale delle **78** immagini. Il 10 novembre 2026 il proprietario ha dichiarato di aver creato le immagini e di poter condividere privatamente anche quelle derivate dal font dalla licenza sconosciuta. Le autorizzazioni correnti, con il riferimento a tale attestazione, sono in `catalog/approvals.json`; gli hash delle immagini importate sono nel manifest. I file del font non sono inclusi e non è stata affermata alcuna autorizzazione alla distribuzione pubblica.
