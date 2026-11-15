# Manifest comparison gate (read-only)

This tool compares two **private-use** approved-asset manifests before an asset update is considered by Astrological Charts, VirgoStars, or offline Astrolabio. It does not inspect image bytes, download assets, grant publication rights, edit any approval record, or migrate production.

## Usage

Keep a locally reviewed baseline manifest and compare it with a candidate:

```sh
npm run compare:manifests -- --before /path/to/baseline.json --after ./manifests/approved-assets.json
```

Both input files must be nonempty version-1 manifests with valid source provenance and each asset's path, byte count, SHA-256 and private approval metadata. Input order does not matter. The script rejects invalid hashes, unsafe paths, case/Unicode collisions, malformed provenance, unapproved records and missing private-use fields.

The JSON report is sorted by exact asset path and includes:

- `added` and `removed` canonical paths. A case-only rename appears in **both**, never silently normalized.
- `modified` path entries with change categories: `sha256`, `bytes` and/or `metadata`. Sensitive permission metadata values are not printed.
- `summary.topLevelChanged` if the source commit or any other top-level manifest metadata differs. Only changing the source commit is still a material manifest change.

Exit codes: **0** for semantically identical manifests, **2** for any differences, **1** for invalid inputs or execution errors. JSON property and asset-array order are ignored. No automatic acceptance or override flag exists: a changed manifest needs manual inspection.

## Review workflow

1. Pin an exact baseline and candidate commit. Keep permission evidence outside logs.
2. Run this comparison. A difference stops automatic acceptance.
3. Review every changed path, SHA-256, source provenance, font/glyph dependency and the relevant human rights records.
4. Separately run `npm test`, `npm run verify:pack` and the required renderer/Angular or offline tests against real checked-out assets.
5. Keep `npm run check:public-release` blocked until independently authorized public redistribution records exist. This comparison never substitutes for it.

**Important:** Both manifests may refer to images that are already visible in this public repository, but **private sharing approval is not a public license**. The comparison checks metadata structure and differences only, not bytes, legality, visual correctness, deployment readiness, or Git history.
