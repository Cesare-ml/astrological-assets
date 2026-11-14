# PR integration plan — 2026-11-14 snapshot

**Status:** read-only review artifact, **not merge approval**. The snapshot records
public GitHub metadata for **22 open pull requests** against the unchanged main
commit `8d310f71d399f656d9baa511aec7c0a1fca2acbd`. It includes **14 draft
PRs**. No pull request, artwork, approval or deployment is changed by the
analyzer. GitHub metadata and the owners' decisions must be refreshed before
any integration.

## Generate the dependency/overlap report

```sh
# Analyze the pinned snapshot (metadata only):
node scripts/analyze-pr-integration.mjs docs/pr-integration-snapshot-2026-11-14.json

# Compare with a *separately collected* fresh snapshot using the same schema:
node scripts/analyze-pr-integration.mjs docs/pr-integration-snapshot-2026-11-14.json --current ./pr-snapshot-fresh.local.json

node --test tests/analyze-pr-integration.test.mjs
```

The input JSON is an audited **point-in-time metadata copy**, *not a live
GitHub API response*. The CLI uses local files only: it performs no GitHub
calls, merge, branch mutation, writes or publishing. A malformed snapshot, wrong `repositoryFullName` (only
`Cesare-ml/astrological-assets` is accepted), inconsistent
`openPrCount`, invalid Gregorian `capturedDate`, unknown parent branch,
dependency cycle, duplicate entry, unsafe path or missing file list fails
closed (exit 1). Both compared snapshots must independently pass these
checks. The recorded count must be obtained from a separate **complete**
GitHub open-PR listing; a self-consistent but incomplete list could still
pass if its count was fabricated. Valid snapshots produce a JSON
report including ordered PRs, **exact lowercase 40-digit head Git SHAs**, direct
dependencies and filename overlaps (exit 0). When passed `--current`, it
compares main and individual PR head SHAs, base/head branch names, draft
status, changed-file sets, and PR additions/removals. It exits **2 on
detected drift**, **1 on invalid snapshot/input**, **0 on a matching
comparison**. Differences in file-list order or capture date alone do not
mark a snapshot stale. The `--current` file must be captured independently
from fresh GitHub data; merely copying the baseline proves nothing.

**Exit 0 means only that the supplied metadata is internally consistent
(and, if compared, matches the second supplied snapshot), not that
either file is live or a merge is safe.** Do not treat the printed order
as authorization to merge.

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
conflicts. The analyzer also reports **`caseVariantOverlaps`** separately:
independent PRs touching paths such as `img/Icon.png` and `img/icon.png`
may collide in case-insensitive Windows/offline deployments even when Git
considers the paths different. The snapshot of the original 22 PRs has **0**
case-variant pairs; nine real Node.js regressions exercise synthetic examples,
including NFC Unicode. A single PR containing two case-folded path aliases
is rejected as invalid input. Neither report proves a merge conflict.
The most common shared files are:

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
cannot prove semantic compatibility, detect cross-file side effects,
resolve merge conflicts, **authenticate the supplied head SHAs against
live GitHub**, or evaluate third-party rights.

## Required review gates before any authorized integration

1. Refresh the **complete** live PR listing (including pagination if
   necessary), independently confirm the number of open PRs, repository
   identity, base/head branch names, exact head SHAs, draft statuses and
   changed-file lists from GitHub. Capture a new version-1
   JSON snapshot with `headSha` on every PR, then run the `--current`
   comparison and review its result. Rebuild the JSON deliberately;
   do not copy the baseline into the current file. Never rely on this
   static snapshot after another agent pushes or merges.
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

## Post-snapshot drift observed on 2026-11-14

A subsequent GitHub lookup found **24** open PRs, rather than the **22**
captured in the committed baseline. The independent two-snapshot comparison
correctly returned `readyForReview: false` with `pr-added` for
**#30** and **#31**. No older PR branch pin was found to differ in this
specific comparison. The newly observed #30 builds upon #29, extending
the agent-review chain to `#22 → #25 → #27 → #28 → #29 → #30`.
The snapshot has deliberately **not** been silently changed to conceal this
drift. A newly authenticated, independently collected full snapshot of all
current open PRs is required for any fresh integration review.

The two-snapshot detector observed **121** independent pairs with matching
changed filenames in this expanded synthetic-current comparison; this
is still not a count of actual Git textual conflicts.

The code's CPAL attribution remains **Powered by VirgoStars**
(https://www.virgostars.it/). Private collaboration approvals do not
grant public image redistribution rights.
