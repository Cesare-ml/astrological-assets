# PR integration plan — 2026-11-14 snapshot

**Status:** read-only review artifact, **not merge approval**. The snapshot records
public GitHub metadata for **22 open pull requests** against the unchanged main
commit `8d310f71d399f656d9baa511aec7c0a1fca2acbd`. It includes **14 draft
PRs**. No pull request, artwork, approval or deployment is changed by the
analyzer. GitHub metadata and the owners' decisions must be refreshed before
any integration.

## Generate the dependency/overlap report

```sh
node scripts/analyze-pr-integration.mjs docs/pr-integration-snapshot-2026-11-14.json
node --test tests/analyze-pr-integration.test.mjs
```

The input JSON is an audited **point-in-time metadata copy**, *not a live
GitHub API response*. The CLI uses local files only: it performs no GitHub
calls, merge, branch mutation, writes or publishing. A malformed snapshot,
unknown parent branch, dependency cycle, duplicate entry, unsafe path or
missing file list fails closed (exit 1). Valid snapshots produce a JSON
report including ordered PRs, direct dependencies and filename overlaps
(exit 0). **Exit 0 means the metadata is internally consistent, not that
a merge is safe.** Do not treat the printed order as authorization to merge.

## Exact dependency chains

| Required merge/review order | Relationship |
| --- | --- |
| #9 → #11 | VirgoStars Astro font design and private visual QA |
| #14 → #17 | Consumer subset preflight → versioned lockfile |
| #22 → #25 → #27 → #28 → #29 | Agent worklists → result validation → assignment reconciliation → independent ledger pin → JSON schema contracts |

The direct relations are `11→9`, `17→14`, `25→22`,
`27→25`, `28→27` and `29→28`. These are **GitHub base-branch
dependencies**, not merely similar subject matter. Before proposing an
approved integration, verify each upstream parent is actually present in
the chosen target branch and **retarget child PRs** as necessary.
Never merge a stacked child directly into `main` ahead of its parent.

## Independent PRs: shared-file review hotspots

The snapshot analyzer reports **110 independent PR pairs with one or more
matching paths**. These are *potential overlap warnings*, not Git textual
conflicts. The most common shared files are:

- `README.md` and `package.json`: numerous independently developed
  commands and installation instructions. Compare combined script entries
  and command semantics carefully; do not replace one branch's command map
  with a stale copy from another.
- `docs/RIGHTS_AND_REVIEW.md`: #7, #12 and #20.
- `docs/MIGRATION_PLAN.md`: #9, #13 and #16.
- `docs/PUBLIC_RELEASE_CHECKLIST.md`: #10 and #26.
- `docs/ASSET_SCOPE.md` is changed by #23, while #24 changes the related
  catalog auditor and `tests/catalog.test.mjs`; review the refresh/audit
  workflow together even though the main implementation files differ.

Important: this tool looks only at **identical changed filenames**. It
cannot prove semantic compatibility, detect cross-file side effects, resolve
merge conflicts, compare exact HEAD SHAs or evaluate third-party rights.

## Required review gates before any authorized integration

1. Refresh the live PR listing, base/head branch names, head SHAs, draft
   statuses and **changed file lists** from GitHub. Rebuild the JSON snapshot
   deliberately and review the diff. Never rely on this static snapshot after
   another agent pushes or merges.
2. Select one parent PR at a time, review its entire patch and run its focused
   tests. Where multiple PRs touch the same files, construct a **separate
   temporary integration branch** and reconcile the changes with human
   review, rather than force-pushing over other collaborators' work.
3. Run `npm test`, `npm run audit:catalog` and
   `npm run verify:pack` in a complete checkout. Record versions and
   results. `npm run check:public-release` is **expected to remain blocked**
   until independent per-file third-party rights evidence exists; do not
   bypass it for convenience.
4. Check the actual Angular/Three.js asset URL/output collision gates and
   the private VirgoStars Desktop/Astrolabio subset; this metadata-only
   analyzer does not test consumer builds.
5. Keep publication, tags, repository visibility changes, GitHub Actions
   and production changes outside this review. Obtain **explicit owner
   authorization** before any actual merge or release.

The code's CPAL attribution remains **Powered by VirgoStars**
(https://www.virgostars.it/). Private collaboration approvals do not
grant public image redistribution rights.
