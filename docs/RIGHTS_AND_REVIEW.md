# Asset rights and human review protocol

## Private approval is not public distribution permission

The initial inventory and approved image pack are **not automatically public-domain or open-source artwork**. `catalog/approvals.json` contains a project-owner attestation dated 2026-11-10 authorizing the existing 1,013 images for private collaborators only. That attestation includes images generated with a font whose licensing is unknown. The font files themselves are not in the pack. This does **not** establish public redistribution rights for the images or rights in the font.

On 2026-11-12, the project owner also explicitly affirmed personal authorship of the images; see [owner-authored artwork declaration](OWNER_AUTHORSHIP_AND_ARTWORK.md). This resolves the authorship claim at the attestation level, but it does not license third-party font glyphs or itself select a public artwork license.

The owner selected **CC BY 4.0** for their own creative contributions on 2026-11-12; see [artwork licensing policy](ARTWORK_LICENSING_POLICY.md). This choice does not clear underlying font or other third-party rights. The separate `catalog/publication-approvals.json` starts empty and is the only public authorization input for the release preflight. It is not populated by import scripts or by a coding assistant.

## Human rights check for each file or defensible family

Before issuing a public authorization:

1. Verify the origin and owner of the actual image, including source files and any commissioned work.
2. Check underlying fonts/glyphs, maps, textures, external images, AI-generated content and trademarked/branded designs. In particular, do not assume that excluding a font file resolves the licensing of images made from its glyphs.
3. Confirm that the rights holder can explicitly authorize public copying, distribution, modification and downstream use, and select a precise license suitable for the artwork.
4. Record the actual filename, SHA-256, rights holder and public approval evidence. Keep signed agreements or sensitive documents in secure storage, not in Git.
5. Have the project owner or an independently authorized human reviewer approve the record. Automated scripts and AI agents **must not** declare assets approved.

For public authorization record format and release commands, see [PUBLIC_RELEASE_CHECKLIST.md](PUBLIC_RELEASE_CHECKLIST.md).

## Existing private approvals

`catalog/approvals.json` is used by the selective private importer. Records in this file have `status: "approved"` and fields `rightsHolder`, `permissionBasis` and `approvalEvidence`. That status means **approved for the currently recorded private purpose**, not publicly licensed. The importer verifies the source Git blob hash, size and paths, and writes a SHA-256 manifest.

`catalog/reviews/simboli-bianchi.pending.json` is an older, historical 78-image review worksheet, not authoritative evidence of current or public rights.

To prepare a new private rights worksheet without approving anything:

```sh
node scripts/prepare-review.mjs --family img/simboli-bianchi/segni/ --out ./segni-review.local.json
```

The generated entries are **pending**; humans must evaluate them. The generator neither copies files nor sends data anywhere.

## Import safety and integrity

`scripts/import-approved-assets.mjs` operates in dry-run mode unless explicitly passed `--apply`. Before writing, it rechecks reviewed source assets and destinations, rejects unsafe paths and symlink/junction ancestors, and uses verified bytes. A batch import is **not atomic**: an I/O error may leave partial files without an updated manifest. Use an isolated folder, inspect partial results and restore a known state before retrying.

`scripts/verify-pack.mjs` confirms paths, recorded approval metadata, sizes and SHA-256 of the checked-out pack. It does **not** prove authorship or public licensing.

`scripts/check-public-release.mjs` checks for explicit public-permission records that match **exact current-pack SHA-256s** and reports missing or inconsistent entries. It also detects unlisted files in the asset tree. A passing check is a necessary technical gate but cannot establish legal rights by itself.

**Crucial:** GitHub's public visibility exposes repository history; even removing a questionable image from the latest tree does not make past commits safe to publish. Use a fresh, audited public history when necessary.
