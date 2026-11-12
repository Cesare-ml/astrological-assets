# Astrological Assets

**Curated graphics and integrity tooling for the [VirgoStars](https://www.virgostars.it/) ecosystem.**

**Status: PUBLIC since 2026-11-12 — artwork clearance incomplete.** Original project tooling is offered under the [Common Public Attribution License 1.0 (CPAL-1.0)](LICENSE), with the same **Powered by VirgoStars** attribution as [VirgoStars-Ephemeris](https://github.com/Cesare-ml/VirgoStars-Ephemeris). **The image files are not automatically licensed under CPAL.** The owner selected **CC BY 4.0** for original artwork, but each complete image still requires review of any third-party rights before public distribution.

## What is here?

- **1,013 owner-created image files (owner attestation recorded 2026-11-12)**, with private sharing approval under `public/assets/img/`, and a SHA-256 integrity manifest at `manifests/approved-assets.json`.
- **1,124 upstream candidate records** in `catalog/upstream-candidates.json` (about 80.44 MiB, metadata only; this is not a publication approval).
- Owner-selected CC BY 4.0 artwork policy in `catalog/artwork-license-decision.json`, separate from private-use permissions and the still **pending** file-level public clearances.
- Node.js tools for selective import, catalog auditing, manifest validation, migration collision checks, and a *fail-closed* public-release gate.
- **No fonts**, user chart data, backend code, credentials, or production deployment tools.

The source-of-truth for currently deployed website images remains the private `Cesare-ml/virgo-stars/public/assets` checkout. This repository is not a deployment mechanism.

## License and attribution

The original **software tooling and supporting source documentation** are licensed under [CPAL-1.0](LICENSE) (Exhibits A and B), with attribution:

> Copyright (c) 2026 Cesare-ml (VirgoStars project)  
> Powered by VirgoStars  
> https://www.virgostars.it/

CPAL can require a prominent notice on launch/session start of a covered graphical application, and covered-source availability for certain network deployments. A Credits/About screen is encouraged, but is not by itself a guarantee of full Section 14 compliance. See [licensing and credits](docs/LICENSING_AND_CREDITS.md).

**Image binaries:** the owner selected CC BY 4.0 for their own creative contributions. The software's CPAL license does not itself cover the images; exact-file public rights records and third-party clearance are still required. Do not treat screenshots, font-derived glyphs, branded artwork, textures, or metadata as freely reusable without that review.

## Quick start

Requirements: Node.js **20.19+**. No remote calls or GitHub Actions are required for the local checks.

```sh
npm test
npm run audit:catalog
npm run verify:pack
npm run check:public-release
npm run review:public -- --out ./artwork-review.local.json
```

`check:public-release` currently **must fail with exit code 2**: the owner selected CC BY 4.0, but the per-image third-party clearance register is still empty. This is the expected safe result, not a broken test. A passing `npm test` verifies tooling, not legal authorship or release approval.

For a local copy with the authorized upstream repository checked out as a sibling, preview an import without copying anything:

```sh
node scripts/import-approved-assets.mjs --source ../virgo-stars/public/assets --target ./public/assets --approvals ./catalog/approvals.json
```

Only after explicit owner approval and path/hash review, use the importer with `--apply` and `--manifest ./manifests/approved-assets.json`. It verifies bytes and rejects unsafe paths; a batch import is not an atomic filesystem transaction.

## Using these graphics in Astrological Charts

The renderer source belongs to [astrological-charts](https://github.com/Cesare-ml/astrological-charts), not this repo. With the two repositories checked out side by side, a developer with **authorized asset access** may run the renderer's local read-only asset server:

```sh
cd ../astrological-charts
node scripts/serve-local-assets.mjs --root ../astrological-assets/public/assets --manifest ../astrological-assets/manifests/approved-assets.json
```

The development server serves only manifest-listed assets and checks file hashes. Original browser paths such as `/assets/img/...` are preserved. The independent Charts demo can also use synthetic fixtures without requiring private artwork or a VirgoStars backend.

## Post-publication rights and quality checklist

1. Read the [public release checklist](docs/PUBLIC_RELEASE_CHECKLIST.md). This repository is already public: its files and accessible Git history can be copied or cloned, including earlier commits.
2. Have the actual rights holder review every included binary, including any symbols generated from fonts with unclear license terms. Record a real, explicit public license and evidence in `catalog/publication-approvals.json`. This must be done manually; scripts and AI agents cannot grant rights.
3. Run `npm test`, `npm run audit:catalog`, `npm run verify:pack`, and `npm run check:public-release`; investigate every failure.
4. Independently review the entire Git history and all publication-bound files for private data, artwork and licenses. Use a **clean-history public export** if previous private objects cannot be cleared.
5. Confirm any future software releases, licensing changes, merges or production migrations separately. Do not run GitHub Actions or deploy automatically.

## Documentation

- [Artwork licensing policy — CC BY 4.0](docs/ARTWORK_LICENSING_POLICY.md)
- [Owner authorship statement and artwork licensing](docs/OWNER_AUTHORSHIP_AND_ARTWORK.md)
- [Git history file-inventory audit](docs/HISTORY_FILE_AUDIT_2026-11-12.md)
- [Font rights research](docs/FONT_RIGHTS_RESEARCH.md)
- [Rights, artwork and review](docs/RIGHTS_AND_REVIEW.md)
- [Public release checklist](docs/PUBLIC_RELEASE_CHECKLIST.md)
- [Licensing and required credits](docs/LICENSING_AND_CREDITS.md)
- [Asset scope and upstream inventory](docs/ASSET_SCOPE.md)
- [Migration without duplicated assets](docs/MIGRATION_PLAN.md)
- [Ecosystem coordination](docs/ECOSYSTEM_COORDINATION.md)
- [Contributing](CONTRIBUTING.md) and [agent instructions](AGENTS.md)

The repository is publicly visible; code is licensed under CPAL-1.0 and owner-created original artistic contributions are subject to the selected CC BY 4.0 policy. Complete-file artwork rights and third-party dependencies still need per-file review before the repository can describe the entire asset pack as cleared.
