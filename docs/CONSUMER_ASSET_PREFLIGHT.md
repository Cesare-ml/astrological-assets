# Private consumer asset preflight

Use this read-only tool when a renderer, a standalone chart demo, or an offline Astrolabio device needs an **explicitly enumerated subset** of the canonical asset pack. This is a preflight for an authorized local checkout, **not** a pack exporter or a publication tool.

It checks the requested asset paths against the exact manifest in manifests/approved-assets.json and verifies the corresponding local file bytes and SHA-256. It never copies, deletes, rewrites, downloads, or publishes any asset. It does not scan application code to discover asset dependencies; maintain the requirements list explicitly.

## Requirements file

Create a local JSON document such as astrolabio-assets.local.json:

~~~json
{
  "schemaVersion": 1,
  "consumer": "Astrolabio",
  "assets": [
    "img/grafici/dark/cartaastrale-segni.png",
    "img/grafici/light/cartaastrale-segni.png"
  ]
}
~~~

Paths are **case-sensitive relative paths** under public/assets/ and must match the canonical manifest exactly. Do not add a leading assets/ or / prefix. The example selects two existing files; it does not represent the full requirements of any renderer or device.

## Run locally

From this repository root:

~~~sh
npm run check:consumer-assets -- \
  --root ./public/assets \
  --manifest ./manifests/approved-assets.json \
  --requirements ./astrolabio-assets.local.json
~~~

## Direct Astrological Charts integration

The Charts repository already emits a conservative selection as a **JSON array of paths** via `scripts/derive-chart-asset-selection.mjs`. This tool accepts that array directly, without a manual JSON conversion or writing a second requirements file.

With the `astrological-charts` and `astrological-assets` checkouts as siblings (and Charts' Node dependencies installed):

~~~sh
cd ../astrological-charts
node scripts/derive-chart-asset-selection.mjs \
  --root ../astrological-assets/public/assets \
  --out ../chart-assets.selection.local.json \
  --report ../chart-assets.selection.report.local.json

# Continue only when the selection command exits 0 and unresolved is empty.
cd ../astrological-assets
npm run check:consumer-assets -- \
  --root ./public/assets \
  --manifest ./manifests/approved-assets.json \
  --selection ../chart-assets.selection.local.json \
  --consumer AstrologicalCharts
~~~

The `--selection` input must be a nonempty JSON array of canonical paths, and `--consumer` is mandatory in this mode. The `--requirements` mode above remains available, but the two input modes **must not** be combined. Invalid or ambiguous invocations return exit code 1. Filenames must match on-disk casing exactly, even on Windows.

**Important:** Charts does not write a new selection when it finds unresolved references. Remove or rename any stale selection file before rerunning its generator; never run this check against a previous output after a failed selection. The selection is a conservative candidate list, not proof of complete runtime coverage. Browser rendering, export and license gates remain separate.

The command prints a stable JSON report to stdout. If you want to archive the local report, redirect stdout to a file **outside** the public repository. No output file is created by default.

| Exit | Meaning |
| --- | --- |
| 0 | Every requested asset is listed in the approved **private** manifest and the local bytes match. |
| 2 | One or more requested files are missing from the manifest or the local pack, or their bytes differ. Do not package the subset. |
| 1 | Invalid input/metadata, non-directory roots, unsafe paths, symlinks, or other I/O failures. Fix the environment or requirements before proceeding. |

The report includes the consumer name, source commit recorded by the manifest, requested/verified counts, total **verified** bytes, selected paths with hashes, and three blocker lists: missingFromManifest, missingFromPack and mismatched. Files are verified in sorted order, independent of requirements-file ordering. This tool only hashes requested files; use npm run verify:pack for a separate check of the full pack.

## Release and rights constraints

- The current manifest reflects a project-owner **private-sharing authorization**, not clearance for public redistribution. A successful preflight **does not grant a font license or public artwork rights**.
- Do not commit local consumer requirements that reveal unannounced product plans or private paths. Review the intended consumer's licensed use separately.
- Before any public asset release, complete the per-file third-party rights review and run the distinct npm run check:public-release gate; do not replace or bypass that gate with this preflight.
- Before shipping an offline device, test that its renderer references **only** required canonical URLs, pin the exact manifest/renderer versions, and verify its actual on-device files and rollback path.
- For a future VirgoStars web migration, also use check:web-collisions and check:build-output; selecting a subset cannot prove absence of duplicate emitted URLs.

See [Migration plan](MIGRATION_PLAN.md), [Public release checklist](PUBLIC_RELEASE_CHECKLIST.md), and [Asset rights and review](RIGHTS_AND_REVIEW.md).
