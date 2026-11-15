# Upstream catalog audit contract

The candidate catalog is a **metadata snapshot**, not an artwork license, a
redistribution approval or an integrity check of image bytes. Its source is an
authorized local Git checkout of `Cesare-ml/virgo-stars`.

## Required metadata

`npm run audit:catalog` is a read-only, fail-closed inspection of the input
snapshot. It now requires:

- `schemaVersion: 1` and a nonempty `files` array.
- A positive, safe-integer `fileCount` exactly matching that array.
- `source.repository: "Cesare-ml/virgo-stars"`,
  `source.assetRoot: "public/assets"` and a lowercase 40-character Git commit SHA-1.
- `rightsStatus: "unreviewed"`; never `approved` or a publication claim.
- For each record: a safe canonical relative asset path, a nonnegative safe
  integer byte size, a lowercase 40-character Git blob SHA-1 and a Boolean
  `legacy` flag.
- No repeated or Unicode-normalized case-folded path collisions and no
  aggregate byte total exceeding JavaScript's safe integer range.

The audit still warns about the historical `risuonatore-solare-bianco.png`
filename mismatch, where applicable.

## Safe local workflow

```sh
npm run audit:catalog

# With a separately generated, unreviewed local snapshot:
npm run audit:catalog -- ./upstream-candidates.local.json
```

The command prints metadata totals and warnings only when all structural
requirements pass, and returns a nonzero exit status for invalid inputs.
Investigate failures rather than removing fields or changing the rights marker
to force a successful run. The separately proposed safe `catalog:refresh`
snapshot workflow can generate new `.local.json` candidates for human review;
this audit does not update the tracked catalog.

Passing does **not** prove the referenced Git commit is authentic, that the
Git blobs match local bytes, that the owner has third-party rights, or that
assets may be distributed publicly. Preserve the independent private-pack
integrity tests, human rights review and public-release gate described in
[RIGHTS_AND_REVIEW.md](RIGHTS_AND_REVIEW.md) and
[PUBLIC_RELEASE_CHECKLIST.md](PUBLIC_RELEASE_CHECKLIST.md).

**Powered by VirgoStars** · https://www.virgostars.it/
