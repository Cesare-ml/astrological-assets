# Parallel agent asset-review worklists

This script partitions an **already approved-for-private-use** asset manifest into deterministic, non-overlapping, read-only metadata worklists. It helps the VirgoStars Orchestrator distribute **review/checking tasks** across independent ChatGPT agents without copying original images or changing any rights records.

## Commands

Show a summary of all shard sizes:

```sh
npm run plan:review-shards -- --manifest ./manifests/approved-assets.json --shards 2
npm run plan:review-shards -- --manifest ./manifests/approved-assets.json --shards 20
npm run plan:review-shards -- --manifest ./manifests/approved-assets.json --shards 40
npm run plan:review-shards -- --manifest ./manifests/approved-assets.json --shards 100
```

Get the exact worklist for agent 7 of 100 (**1-based**):

```sh
npm run plan:review-shards -- --manifest ./manifests/approved-assets.json --shards 100 --shard 7
```

Every command emits **JSON to stdout**, including `source.repository`, `source.commit`, and `manifestSha256` (SHA-256 of the exact manifest **file bytes**). A summary has `shards: [{index,count,bytes}]`; a selected shard contains `shardIndex`, `shard`, and `assets: [{path,bytes,sha256}]`. It excludes private approvals, rights-holder names, evidence and arbitrary source fields.

## Deterministic partitioning

1. Validate the nonempty version-1 manifest, source provenance, path safety, SHA-256/size and private-approval record completeness. Reject Unicode/case collisions, pending records and invalid paths.
2. Sort by **exact original asset paths** using locale-independent JavaScript string order. No path is renamed or normalized for output.
3. Place sorted asset at index `i` into shard `(i % shardCount) + 1`. Each path is assigned **exactly once**; the biggest and smallest shard counts differ by at most one.
4. Reject more shards than assets and more than 1,000 shards. A caller may request exactly one shard at a time.

With the **current 1,013-file** manifest, the planned ranges are 506–507 assets per agent for 2 agents, 50–51 for 20, 25–26 for 40, and 10–11 for 100. The script does **not** create 100 ChatGPT sessions, schedule execution or claim tasks: the Orchestrator must separately perform enrollment, claiming, conflict control and status tracking.

### Operational contract for Orchestrator

- Pin both the source commit and `manifestSha256` in every assigned task. A changed raw manifest requires a **new planning run**, even when the sorted worklist happens to be identical.
- Do not mix shard outputs generated using different manifest fingerprints or `shardCount` values.
- Treat `assets[].sha256` as expected metadata, **not** a verified checksum of files in this command. The agent must separately run the real pack integrity preflight in a valid checkout.
- Collect review results separately; **never** automatically write permissions into `catalog/publication-approvals.json` or treat private approval as permission to redistribute.
- For real browser/Angular/offline QA, integrate the separately tested consumer checks and follow the asset migration plan. This planner is safe to call locally; it never writes a file or opens the network.

## Test and limitations

Run `node --test tests/plan-review-shards.test.mjs` or `npm test`. Synthetic fixtures exercise 1,013 entries distributed among 2/20/40/100 agents, collision/error handling, deterministic assignments, confidential metadata redaction and CLI exit behavior.

This planner does **not** automatically perform rights review, read raster bytes, inspect historical Git objects, verify rendering, create claims/locks or publish anything. The public redistribution gate remains blocked until independently reviewed permission evidence exists. See [asset rights](RIGHTS_AND_REVIEW.md) and [public release checklist](PUBLIC_RELEASE_CHECKLIST.md).
