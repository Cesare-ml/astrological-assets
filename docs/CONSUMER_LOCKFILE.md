# Versioned private consumer asset lockfiles

A consumer lockfile records exactly which **already-verified local** asset bytes a chart renderer, offline Astrolabio build, or other authorized consumer intends to use. This workflow creates **metadata only**: no PNG, fonts, textures, ZIP archive, deployment, or public redistribution permission.

This tool depends on the read-only consumer asset preflight introduced in PR #14. Its current implementation and this guide belong to a **stacked PR**; integrate PR #14 first.

## Input options

Choose one (not both):

1. A private requirements object: {"schemaVersion":1,"consumer":"Astrolabio","assets":["img/grafici/light/cartaastrale-segni.png"]}.
2. A **JSON array of canonical asset paths** produced by astrological-charts/scripts/derive-chart-asset-selection.mjs; supply --selection and --consumer AstrologicalCharts.

Paths are case-sensitive relative to public/assets/. Requirements are never converted into file-copy operations.

## Commands

Use sibling checkouts. Generate the Charts selection first, and continue **only if the Charts generator exits 0** and its diagnostic report has no unresolved references; it can leave an old selection file behind on failure.

~~~sh
# From astrological-charts:
node scripts/derive-chart-asset-selection.mjs \
  --root ../astrological-assets/public/assets \
  --out ../charts.selection.local.json \
  --report ../charts.selection.report.local.json

# From astrological-assets (after the first command succeeds):
npm run lock:consumer-assets -- \
  --root ./public/assets \
  --manifest ./manifests/approved-assets.json \
  --selection ../charts.selection.local.json \
  --consumer AstrologicalCharts \
  --out ../charts-asset-lock.local.json
~~~

Or supply your own local device requirements file:

~~~sh
npm run lock:consumer-assets -- \
  --root ./public/assets \
  --manifest ./manifests/approved-assets.json \
  --requirements ../astrolabio-requirements.local.json \
  --out ../astrolabio-assets.lock.local.json
~~~

Omitting --out prints the lock JSON on stdout without writing a file.

For --out, the destination must end in .json, have an existing non-symlink parent directory, and live **outside both this public Git checkout and the asset tree**. The tool creates it exclusively; it will **never overwrite** an existing file or follow a pre-existing output link. Use a new filename for every approved candidate revision.

## Stable lock contract

Each generated lock contains:

- schemaVersion: 1 and format: virgostars.consumer-assets.lock;
- consumer and the exact source.repository, source.commit, and source.assetRoot from the input manifest;
- alphabetically sorted assets records containing only path, bytes, and sha256;
- assetCount, totalBytes, and an immutable revision of the form sha256: followed by 64 hex characters;
- distribution: private-integrity-only.

The revision is SHA-256 of the compact JSON representation of the five-field identity {schemaVersion, format, consumer, source, assets} in that field order. The identity excludes timestamps and local absolute paths, so changing output location or requirements-file order cannot alter the revision. Changing the source Git commit or a selected asset record changes it. This is a **lock identifier**, not a signature or artwork license.

## Failure behavior

| Exit | Meaning |
| --- | --- |
| 0 | All selected local bytes were verified and the metadata-only lock was printed or safely written. |
| 2 | At least one selected path is missing from the private manifest, is absent on disk, or differs by size/hash. No lock is written. |
| 1 | Malformed input, missing source commit, duplicate path, dangerous filesystem path, existing output file, or other error. No valid lock is produced. |

When blocked, diagnostics go to stderr and stdout remains empty. No partial asset subset is packaged.

## What this DOES NOT prove

The chart generator produces a conservative **candidate superset**; dynamic runtime asset references may still be missing. Run actual render/browser export and file:// offline-device checks separately, and verify the final device bytes before releasing a firmware or installer. A lock is **not** an installer, packer, synchronization command, or backup.

The existing public artwork rights review is still incomplete. Private pack manifest approval is **not** public redistribution clearance, and this lock cannot replace the check:public-release gate. Do not commit private device requirements or private lockfiles to the public repository.

Related: [Consumer preflight](CONSUMER_ASSET_PREFLIGHT.md), [Migration plan](MIGRATION_PLAN.md), [Public release checklist](PUBLIC_RELEASE_CHECKLIST.md).
