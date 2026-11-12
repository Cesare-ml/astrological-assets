# Git history file-inventory audit — 2026-11-12

**Scope:** file-path and file-type inspection of the repository's current reachable `main` commit history (51 commits), plus the current preparation branch, via GitHub's Git tree API with recursive trees. This is a *technical file-inventory audit*, **not** a full secret scan or a legal rights clearance. Private repository visibility has not been changed.

## Findings

- The 51 `main` commit snapshots were inspected. The 49 snapshots preceding the 2026-11-10 asset import contain **no files under `public/assets/`** and no image/font/PDF/ZIP/database binaries in their enumerated trees.
- The 2026-11-10 import commit `da12b92782c0ca9c5c913e2ae0d6167abe2ca4de` and merge commit `80e7b5fa30e2edd952eff13add48abe5480bd87e` contain the current **1,013** committed raster assets. The current assets tree contains PNG, JPG and WebP, not font binaries.
- No filenames matching the examined common credential patterns (e.g. `.env`, `secret`, `credential`, `token`, `.pem`, `.p12`) appeared in those tree snapshots.
- Five branch heads were listed: `main`, `codex/ecosystem-status`, `codex/import-chart-artwork`, `feat/approved-assets-import`, and `feat/public-open-source-readiness`. The first three feature branches point to commits also reachable from `main`; the preparation branch adds licensing/docs and validation tooling.
- Candidate font **names** in `catalog/upstream-candidates.json` are metadata only; this audit did not download third-party font files.

## Unresolved before changing repository visibility

- Review the **contents** of historical text files and commit metadata, not just file names, for sensitive data and rights-restricted content. Consider independent secret and license scanning in a trusted local checkout.
- Review Git tags, other Git references and any newly added branches/commits immediately before publication; the branch listing is a point-in-time observation.
- The author has claimed original creation of the artwork, but external font/glyph license status and an explicit **public artwork license** are unresolved. Those are separate from this Git inventory.
- Run all local Node tests, SHA-256 pack verification, public license preflight, and a charts demo against actual authorized artwork.
- If any historic asset or confidential content cannot be cleared, **publish a fresh-history export** instead of switching this private repository to public.

## Audit method and limits

The GitHub `/repos/Cesare-ml/astrological-assets/commits?per_page=100` inventory returned 51 `main` commits. Recursive tree snapshots were checked for `public/assets/` entries, potentially sensitive names, and image/font/PDF/archive/database extensions. This method does **not** examine image pixels, metadata inside image binaries, private contract text, hidden secrets in code, ownership of glyphs or published release tags. All conclusions are limited to the inspected Git tree snapshots.

No GitHub Actions, deployment, release, permissions changes or public visibility change occurred.
