# Compare two privacy-safe asset-review progress reports

This read-only tool compares **two aggregate census JSON reports** produced by `npm run census:agent-reviews`. It counts changes by fixed asset family and detects drops in self-reported inspections or increases in pending work. It never reads the original artwork, the detailed agent findings or a PRIVATE Orchestrator ledger.

## Command

```sh
npm run compare:review-progress -- \
  --before /private/path/census-earlier.local.json \
  --after /private/path/census-later.local.json
```

The input files must have **the exact same `manifestSha256`** and the same asset-family membership and inventory totals. For an updated asset manifest, generate new censuses instead of comparing unrelated snapshots. The `before` and `after` labels are supplied by the operator: the tool **does not authenticate chronological order**, issuer identity, or whether the aggregate counts came from an authorized, verified private-ledger run.

## Result

A JSON object with `changed`, `regressed`, `delta` and a `families` array of changed categories. For the global totals and each changed family:

- `inspected`: after minus before of self-reported inspected assets
- `flagged`: change in assets needing a follow-up check
- `notChecked`: change in explicitly uninspected assets
- `pending`: change in assets without a submitted result

The checker marks a family `regressed: true` when inspected decreases or pending increases. A flagged/notChecked increase without either condition is still visible in the delta but is **not** classified as a regression. Treat all flagged and notChecked counts as outstanding work regardless.

Exit status:

- **0**: both reports are internally consistent, comparable, and no per-family regression is detected
- **2**: reports are comparable but at least one family regressed
- **1**: invalid input, stale/different manifest, impossible counters, unauthorized extra fields or other errors

The output intentionally excludes paths, rights records, agent identities, task/assignment identifiers, private-ledger commits and source notes. It contains only fixed family labels, counts, and the pinned public asset manifest fingerprint. An exit status of 0 **never** approves public redistribution, PR integration, a sale or agent task closure.

## Validation

The CLI rejects unknown fields, missing counters, incorrect `schemaVersion`/`purpose`, invalid SHA-256, invalid or duplicate family labels, negative/non-safe-integer values, contradictory summary totals, nonconserved family totals and incompatible manifests. It is deliberately independent of production Angular/Three.js, GitHub, other npm packages and the original images.

Run:

```sh
node --test tests/compare-review-progress.test.mjs
```

Tests cover improvement, unchanged reports, review regressions, family reorder, malformed or confidential fields, conflicting inventories, invalid numbers and **real Node subprocess** exit codes. The examples use synthetic, nonprivate data; there are no genuine agent results embedded in the repository.

This comparer runs **after** the prior authorization and structural validation chain. For a real environment first create the census with a trusted privately pinned snapshot using [the agent review census guide](AGENT_REVIEW_PROGRESS_CENSUS.md); do not treat these public tools as proof that the snapshot came from the real coordinator. The current owner-run Orchestrator alpha still requires exclusive, approved private tasks and independent review.

Dependencies (stacked draft PRs): **#22 → #25 → #27 → #28 → #29 → #30 → this comparison feature**. No GitHub Actions, private snapshots, new artwork approvals, image binaries, licensing changes, or deployments are introduced.
