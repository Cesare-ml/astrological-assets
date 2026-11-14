# Offline asset-review progress census

This read-only diagnostic summarizes **self-reported review findings** across a pinned manifest without exposing individual agent IDs, task IDs, rights evidence or image paths in its output. It is **not** a license approval, artwork validation, source-integrity check, task scheduler, or authentication layer.

## Command

From a private, authorized machine after producing a valid result batch and a private-ledger snapshot:

```sh
npm run census:agent-reviews -- \
  --manifest ./manifests/approved-assets.json \
  --results /private/path/review-results.local.json \
  --assignments /private/path/assignment-snapshot.local.json \
  --expected-ledger-commit "$LEDGER_COMMIT_SHA"
```

In PowerShell, use `$env:LEDGER_COMMIT_SHA`. Obtain the commit SHA by an **independently authenticated read of the approved PRIVATE ledger**. Never take the expected SHA directly from an untrusted snapshot. No private ledger records, snapshots or actual agent results should be committed to this public GitHub repository.

The command invokes the full structural reconciler from PR #27 plus independent ledger pin enforcement from PR #28. It rejects stale manifest fingerprints, wrong assignment IDs, cross-shard paths, duplicated or wrong-agent submissions and mismatched ledger pins **before** counting any results. It operates entirely offline on local files.

## Output

The JSON summary provides counts only, grouped into fixed families: `chart-graphics`, `zodiac-and-symbols`, `white-symbols`, `planet-icons`, `textures`, `solar-resonator`, `fonts` and `other`. Families with no assets are omitted. Every asset falls into exactly one family.

Counters:

- `inspected`: an agent self-reported the asset was inspected.
- `flagged`: an agent self-reported the asset needs follow-up.
- `notChecked`: an agent self-reported `not-checked`; explicitly **not inspected**.
- `pending`: no validated result for the asset's shard.
- `total`: sum of all four classifications.

`reviewedAssertions` counts all submitted assertions (including flags and not-checked), while `inspectedAssertions` counts inspected only. `needingFollowUp` is the sum of flagged, notChecked and pending assets. `missingShardCount` counts shards not yet represented by a submitted result bundle.

Exit status: **0** = structurally complete and every asset self-reported inspected, **2** = incomplete or flagged/review-needed, **1** = invalid or stale inputs. Even status 0 **never** authorizes public redistribution, a release, or automatic task closure.

## Example family census for the current manifest

The **current main-branch 1,013-asset manifest** (14 November 2026) contains 828 zodiac/symbol assets, 78 white symbols, 53 chart graphics, 46 planet icons, 4 textures and 4 Solar Resonator images. These are inventory counts, **not reviewed assets** or actual review progress; all test result batches use invented fixtures.

## Boundaries and integration

The tool does not read raster bytes, perform visual checks, authenticate private GitHub commit ancestry, validate artwork ownership or update any manifest or approval file. A malicious source capable of controlling both the private snapshot and the claimed trusted pin defeats a structural comparison. The VirgoStars Orchestrator must independently authenticate the private ledger and agent sessions, use non-reused assignment IDs on reassignment, and manage exclusive claims/recovery on its own authorized private infrastructure.

Integration order: PR **#22 → #25 → #27 → #28 → #29 → this feature**. The census only consumes the reviewed contracts; it does not modify Orchestrator code or grant new agent enrollment.

Run `node --test tests/review-progress-census.test.mjs` or the complete checkout `npm test` for native verification. No GitHub Actions, asset binaries, image rights or production code changed.
