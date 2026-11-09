# Migration plan: one asset source, no double import

## Current production behavior

The VirgoStars Angular workspace presently copies the monorepo `public/` directory into the web build. This already supplies `/assets/img/...` used by normal frontend components and `grafici-astrologici` Three.js. An Astrolabio device separately maintains an offline subset.

**Do not change production until the newly separated charts library compiles and every required asset has been reviewed and tested.**

## Phase A — private asset pack (this repo)

1. Review `catalog/upstream-candidates.json` and select active graphics only.
2. Record **explicit** rights approvals in `catalog/approvals.json`, by path.
3. On the owner’s machine with an authorized checkout of `virgo-stars`, run the dry-run import with the pinned catalog and check the plan.
4. Run `--apply` only for the approved selections. Each file is checked against its upstream Git blob/size and SHA-256; exact files retain their original relative paths.
5. Run the read-only pack verifier and `npm test`. Inspect staged files before committing a PR.
6. Invite collaborators to **astrological-charts + astrological-assets only** as required. They must not need the private VirgoStars monorepo.

## Phase B — independent chart demo

Clone the two private repositories as siblings. Use `astrological-charts/scripts/serve-local-assets.mjs` pointed to `../astrological-assets/public/assets`. Load the URL `http://127.0.0.1:4177/assets/` through the charts library's host-owned asset resolver. Confirm correct rendering for natal, transits, synastry, latitudes, different skins, browser and mobile.

The demo should not require access to production APIs, AWS, user themes, or the private VirgoStars source.

## Phase C — migrate the VirgoStars web build (separate reviewed PR)

After the first two phases pass, pin an exact version/commit of `astrological-assets` as a read-only dependency of the VirgoStars build (e.g. submodule or explicit vendored checkout).

**Avoid double output:** do not copy `public/assets/img/... ` from both the original `public/` tree and the versioned asset pack. Remove or exclude the corresponding original source paths only when the version-pinned pack is in place. Set a single Angular asset copy rule to produce each URL once. Keep unrelated `public` assets under VirgoStars.

### Collision preflight before changing the Angular build

Use `scripts/check-web-asset-collisions.mjs` with `--legacy ../virgo-stars/public/assets`, `--pack ./public/assets` and `--manifest ./manifests/approved-assets.json`. Exit code `3` means the old asset files are still present with **identical bytes** and would be duplicated by a naive two-source copy. Exit code `2` means the pack is missing/altered or the old files differ: **stop and investigate**. Exit code `0` means approved pack files are disjoint from the legacy tree.

**Important:** while VirgoStars is still the authoritative source, exit `3` is expected after an approved pack import. It is not permission to delete original files; a separate tested migration must explicitly exclude their legacy copy in the target web build, and only then re-check. Never overwrite the Angular build output from two conflicting sources.

For every existing URL ensure the resulting site build has **exactly one emitted file** with the same bytes and path; compare manifests/checksums and check the browser network/cache. Then test deploy in staging, preserving rollback to the original build.

**No integration in production has been made by this repository.**

## Phase D — offline Astrolabio

Produce a per-device versioned subset by manifest and hash; package one local copy per required asset. Pin the device's renderer version and its asset version, and deploy with rollback only after actual browser/headless/e-ink tests. No implicit device updates from the GitHub repository.

## Rollback

Until Phase C is approved, VirgoStars continues using its current `public/assets` and original graphics library. A PR or bad asset pack update here cannot impact users or shipped devices.

## Collaborator permissions caveat

The repository is under a GitHub **personal account**. GitHub's permission documentation says private personal-account collaborators may receive write-level rights; do not assume invites are read-only. For enforceable read-only access, consider an organization with separate repository roles or distribute only the minimal approved asset pack. Never invite collaborators to `virgo-stars` merely to access artwork.

## Approved-manifest-gated collaborator preview

The Charts development server now has a candidate implementation that requires the actual approved pack `manifests/approved-assets.json` as well as the `public/assets` root; it checks each file SHA-256 before serving and rejects unlisted files. A separate synthetic 78-PNG pack can be generated locally for smoke tests without artwork rights assumptions. Reference: [Charts local preview candidate](https://github.com/Cesare-ml/astrological-charts/blob/feat/verified-asset-preview/docs/LOCAL_ASSET_PREVIEW.md). The image gallery does **not** replace the future Angular chart rendering demo.
