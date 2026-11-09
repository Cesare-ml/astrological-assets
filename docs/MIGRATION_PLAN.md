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

For every existing URL ensure the resulting site build has **exactly one emitted file** with the same bytes and path; compare manifests/checksums and check the browser network/cache. Then test deploy in staging, preserving rollback to the original build.

**No integration in production has been made by this repository.**

## Phase D — offline Astrolabio

Produce a per-device versioned subset by manifest and hash; package one local copy per required asset. Pin the device's renderer version and its asset version, and deploy with rollback only after actual browser/headless/e-ink tests. No implicit device updates from the GitHub repository.

## Rollback

Until Phase C is approved, VirgoStars continues using its current `public/assets` and original graphics library. A PR or bad asset pack update here cannot impact users or shipped devices.
