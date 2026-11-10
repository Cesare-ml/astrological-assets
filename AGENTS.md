# Astrological Assets — instructions for human and AI contributors

This is a **private resource repository**, intended to hold a carefully approved subset of the graphics used by VirgoStars and Astrological Charts.

## Hard rules

1. The authoritative production files still live at `Cesare-ml/virgo-stars/public/assets` until the upstream migration has passed tests. No production write/deploy from here.
2. **Never automatically copy all files** from `virgo-stars` into this repository. Candidate metadata is not proof of ownership or permission.
3. Only the owner/rightsholder's explicit review may turn `catalog/approvals.json` entries to `status: "approved"`. An AI agent must not approve its own generated or scraped assets.
4. Keep `catalog/upstream-candidates.json` as metadata only. Check `gitBlobSha`, size, owner and permission evidence before any migration.
5. The importer defaults to **dry-run**; `--apply` is only for an explicitly authorized, reviewed selection.
6. Do not bring in user natal charts, account records, credentials, backend files, AWS keys, website content unrelated to chart rendering or copyrighted third-party graphics without sufficient rights.
7. Retain relative paths under `public/assets/img` or `public/assets/fonts`, exact casing and file format. Do not silently rename references, including the unresolved `risuonatore-solare-bianco.png` candidate.
8. Use PRs and targeted reviews. Do not merge, release, distribute, publish, deploy, or change repository visibility without owner approval.
9. Do not create GitHub Actions or background jobs for this repository without express authorization.
10. Before any future web asset migration, run `scripts/check-web-asset-collisions.mjs`; never regard a matching legacy file as safe for double inclusion. The 78 starter review records remain pending until the owner approves each permitted family/file.
11. Once assets are approved, run import integrity and `npm test`, and document expected consumers and compatibility (Angular, Three.js, offline Astrolabio).

## Architecture

This repository owns **binary asset files** after migration. `astrological-charts` owns renderer code. `virgo-stars` owns the website, API and deployments. A verified build should produce **one copy per file in the frontend output**, and the Astrolabio gets a separately versioned minimal offline subset.

Read `README.md`, `docs/ASSET_SCOPE.md`, `docs/RIGHTS_AND_REVIEW.md` and `docs/MIGRATION_PLAN.md` before working.
