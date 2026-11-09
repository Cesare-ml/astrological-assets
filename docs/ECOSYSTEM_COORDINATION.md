# VirgoStars graphics ecosystem — operating contract

**Updated 2026-11-09.** This file is the cross-repository design and release contract. It describes implemented work and explicitly identifies what is still pending; it does not approve asset licenses or authorize production deployment.

## 1. Ownership and boundaries

| Repository | Visibility | Owns | Does **not** own |
|---|---|---|---|
| [virgo-stars](https://github.com/Cesare-ml/virgo-stars) | Private | Live Angular website, business/backend, account data, Astrolabio software, deployment and currently deployed `public/assets` | Independent development access for graphics contributors |
| [astrological-charts](https://github.com/Cesare-ml/astrological-charts) | Private | Angular 20 + Three.js renderer source, API, skins, URL resolver, graphics tests and a development-only read-only asset server | Real asset binaries, data/calculation backend, deployments |
| [astrological-assets](https://github.com/Cesare-ml/astrological-assets) | Private | Candidate inventories, rights review and eventually **one authoritative Git source** of the approved chart images/fonts | Source renderer, private user charts, general site media, production deployment |

The independent renderer can *compile* without graphics. To visually render the original artwork it **must have reachable assets**. An invited contributor does **not** need access to `virgo-stars` if granted access to this repo **after assets are reviewed and imported**; alternatively, synthetic licensed fixtures can be used for limited tests. URL access and Git repository access are distinct.

## 2. Source-of-truth and delivery

**Current, deployed:** `virgo-stars/public/assets` is authoritative. `astrological-charts` contains no production images. This repository currently contains **no copied production binary images**.

**Target, subject to approvals:** `astrological-assets/public/assets/{img,fonts}` becomes authoritative for the curated chart asset subset. A VirgoStars build pins an *exact approved commit* of this repository, for example as a Git submodule or a verified vendored checkout.

Maintain the existing browser URLs `/assets/img/...` for **both** regular Angular HTML/CSS and Three.js textures. The Angular build must output each path **once**, never from both this repository and the legacy `public/assets` tree. The remaining website resources stay in VirgoStars. A common URL may reuse browser HTTP cache; it does **not** guarantee a shared Three.js GPU texture object.

An offline Astrolabio must keep its own local subset; it cannot use website files while offline. Version the device's renderer commit, approved asset manifest checksum and installed subset together.

## 3. Current PR dependency order (draft, no merge)

1. `astrological-charts` [#1](https://github.com/Cesare-ml/astrological-charts/pull/1) — source extraction, Angular workspace, initial documentation.
2. `astrological-charts` [#8](https://github.com/Cesare-ml/astrological-charts/pull/8) — host-owned canonical asset URLs; based on #1 branch.
3. `astrological-charts` [#9](https://github.com/Cesare-ml/astrological-charts/pull/9) — path/bytes/SHA-256 manifest and comparison; based on #8 branch.
4. `astrological-charts` [#10](https://github.com/Cesare-ml/astrological-charts/pull/10) — conservative source-driven chart asset selection; based on #9 branch.
5. `astrological-charts` [#11](https://github.com/Cesare-ml/astrological-charts/pull/11) — localhost read-only development asset server and separate repository workflow; based on #10 branch.
6. `astrological-assets` [#1](https://github.com/Cesare-ml/astrological-assets/pull/1) — this repository bootstrap, candidate catalog, guarded importer, manifest verifier, documentation; **independent** of code PR merges.

Do not merge stacked PRs in random order. Once #1 passes, merge the downstream graphics PRs oldest-first, updating the base branches as necessary and verifying the diff at every stage. This does not affect production until a separate explicit `virgo-stars` PR is approved.

## 4. Inventory, provenance and rights

Source catalog: `catalog/upstream-candidates.json`, pinned to `virgo-stars` commit `9900c36acc309bc2a6e87009f554b2e4141e4864`, 1,078 candidate paths, 80.30 MiB summed sizes, 550 distinct Git blobs. The file contains **metadata only**, not bytes, and may include old graphics or fonts not needed in production. The 78 `simboli-bianchi` files are the first proposed review group, **not yet licensed/approved**.

`catalog/approvals.json` initially has an empty `assets` array. Only the owner/rightsholder's explicit review may set `status: approved` with verifiable `rightsHolder`, `permissionBasis`, and `approvalEvidence`. Inviting a collaborator does not convey a right to redistribute publicly. Public open-source release requires a separate asset-by-asset or defensible-family licensing decision.

Known unresolved path: the skins reference `risuonatore-solare-bianco.png` whereas the inspected `public/assets/img` tree includes `risuonatore-solare-bn.png`. No automatic alias/rename without checking the intended appearance.

## 5. Release gates

### Gate A — private asset review and transfer
- [ ] `npm test`, `npm run audit:catalog` on a fresh checkout of this branch.
- [ ] Review the 78 records in `catalog/reviews/simboli-bianchi.pending.json`; every entry starts as `pending` and conveys no rights.
- [ ] Rights and provenance verified, approved paths explicitly recorded.
- [ ] `scripts/import-approved-assets.mjs` dry-run succeeds against pinned local clone, then the approved-only import is reviewed.
- [ ] `scripts/verify-pack.mjs` validates every imported file; binaries arrive via a reviewed PR (not pasted or auto-downloaded).
- [ ] Actual dependency resolution for all active skin/preload references is checked; investigate the Risuonatore filename mismatch.

### Gate B — independent graphics development
- [ ] `astrological-charts` clean `npm install`, TypeScript build, standalone Angular build, and tests succeed.
- [ ] Contributor can clone `astrological-charts` and `astrological-assets` (but **cannot** access `virgo-stars`) and render synthetic natal/transits/synastry/latitude fixtures.
- [ ] Verify all seven skins, PNG export and missing-asset diagnostics; compare against baseline screenshots.
- [ ] Verify local server CORS/network and GPU texture lifecycle. No live customer data.

### Gate C — safe integration into VirgoStars
- [ ] Pin exact graphics and asset commits.
- [ ] Run `scripts/check-web-asset-collisions.mjs`: treat exit `3` (same-byte legacy copies) as a migration exclusion requirement, exit `2` (divergent/missing) as a hard block, and exit `0` as clean/disjoint.
- [ ] Staging build emits each shared URL exactly once, with checksum parity to the baseline.
- [ ] Angular HTML/CSS and Three.js use identical canonical URLs, preserving browser cache and existing paths.
- [ ] Full site smoke checks, saved natal chart compatibility and regression tests; no backend schema or API change.
- [ ] Manual owner approval, reversible deploy and rollback rehearsal.

### Gate D — Astrolabio
- [ ] Test local `file://` or equivalent headless adapter with a manifest-pinned subset.
- [ ] Verify e-ink output, PNG conversion, resource disposal, offline start, and recovery after reboot.
- [ ] Test incremental updates and version rollback before touching shipped devices.

## 6. Contributor permissions and safety

All three repositories are currently private. On GitHub **personal-account** repositories, invitations to private repos do not necessarily offer a strict read-only role. For actual permission separation consider an organization with `read`/`write` roles; otherwise assume code/assets collaborators may have write rights and protect review branches accordingly.

No GitHub Actions, AWS deploys, scheduled jobs or automatic PR merges have been configured. There is no open-source license on the private renderer or asset pack. The public site and sold Astrolabi remain untouched by this work.

## 7. Quick commands for owner (no network side effects)

From an authorized local `astrological-assets` checkout, adjacent to a clone of `virgo-stars`:

```powershell
npm test
npm run audit:catalog
node scripts/prepare-review.mjs --family img/simboli-bianchi/segni/ --out ./segni-review.local.json
# Inspect all pending rights; do not auto-approve.
node scripts/import-approved-assets.mjs --source ../virgo-stars/public/assets --target ./public/assets --approvals ./catalog/approvals.json
# Dry-run only. Explicit --apply and a manifest path are required to copy approved files.
```

For an invited renderer collaborator **after** a licensed/approved pack has been committed, in `astrological-charts`:

```powershell
npm install
npm run test:assets
node scripts/serve-local-assets.mjs --root ../astrological-assets/public/assets
```

A dedicated Angular demo remains to be developed. These commands do not imply current graphics build readiness.

## 8. Cross-project documentation

- Assets: `docs/RIGHTS_AND_REVIEW.md`, `docs/ASSET_SCOPE.md`, `docs/MIGRATION_PLAN.md`.
- Charts: `docs/SHARED_ASSET_ARCHITECTURE.md`, `docs/ASSET_MANIFEST.md`, `docs/ASSET_SELECTION_AUTOMATION.md`, `docs/INDEPENDENT_ASSETS_REPOSITORY.md`.
- VirgoStars: `docs/graphics/SKINS_ASSETS_AND_HEADLESS.md`; no changes to the running monorepo in this workstream.
