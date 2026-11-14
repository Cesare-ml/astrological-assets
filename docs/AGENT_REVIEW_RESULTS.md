# Agent review result gate (stacked on parallel review worklists)

The VirgoStars Orchestrator may give one ChatGPT session each shard produced by `plan:review-shards` (PR #22). This **read-only validator** checks the self-reported result files returned from those sessions. It does **not** claim jobs, lock them across concurrent agents, authenticate agents, inspect image bytes, or authorize public artwork redistribution.

## CLI

```sh
npm run validate:agent-results -- --manifest ./manifests/approved-assets.json --results ./agent-results.local.json
```

The manifest must be the **exact file** used during planning: the tool recomputes SHA-256 of its raw bytes and rejects stale submissions. It validates shard allocation using the planner's canonical, original-case asset paths and SHA-256 values.

### Input JSON (illustrative synthetic example)

```json
{
  "schemaVersion": 1,
  "purpose": "asset-agent-review-results",
  "source": {
    "repository": "Example/private-source",
    "commit": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "assetRoot": "public/assets"
  },
  "manifestSha256": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  "shardCount": 2,
  "submissions": [
    {
      "shardIndex": 1,
      "assignmentId": "task-0001",
      "agentId": "agent-0001",
      "results": [
        {
          "path": "img/grafici/light/example.png",
          "sha256": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
          "finding": "inspected"
        }
      ]
    }
  ]
}
```

The illustrative records above are **not real approved asset metadata**; actual submissions must exactly match the planner's assigned assets (both path and SHA-256). Every submitted shard must contain exactly one record for **each** of its assigned paths. Shards not yet submitted may be omitted from the batch, producing `missingShards` and a follow-up status. Repeated shard submissions (even from different agents), duplicate assignments, paths belonging to other shards, stale hashes, unknown fields, missing findings, and malformed agent identifiers cause validation failure.

Permitted `finding` values: `inspected`, `flagged`, `not-checked`. They are **agent assertions**, not a cryptographic, legal or visual verification. `assignmentId` and `agentId` are opaque tokens provided by the Orchestrator; do not use names, emails, credentials or sensitive information. The validator checks their syntax and uniqueness for assignment IDs but **cannot prove** that a caller owns a task.

## Machine-readable output and exit codes

The JSON summary includes `submittedShards`, sorted `missingShards`, and totals for `inspected`, `flagged`, `notChecked`. It omits opaque IDs, underlying review evidence and the individual asset records.

- **0:** structurally valid results covering every shard, all self-reported as `inspected`. **This is not release permission**.
- **2:** structurally valid but with outstanding shards, `flagged` or `not-checked` findings; stop automatic progress and follow up.
- **1:** invalid syntax/schema, stale provenance, conflicting results or other errors; stop and investigate.

## Ownership and concurrency boundaries

- **Astrological Assets:** provides a deterministic plan and validates submitted reports. It has no shared database, no HTTP endpoint, and no durable lock.
- **VirgoStars Orchestrator:** must own atomic `claim -> in_progress -> submitted -> accepted/retry` transitions, TTL/lease fencing, authenticated agent identity, idempotent ingestion and assignment-to-agent binding. It must disallow a second active claim while the first lease remains valid. **Do not infer collision prevention merely from this validator rejecting duplicate reports.**
- **Human reviewer:** verifies source art, font dependencies, underlying rights and any flags. Never automatically fill `catalog/publication-approvals.json` from agent findings.
- **Consumers:** independently verify actual local pack contents, run private consumer preflights and browser/offline checks before version-pinned deployment.

A changed manifest fingerprint or shard count invalidates previous report batches, even when some per-asset paths are unchanged. No production site, local computer setup, GitHub Actions, external dependencies or asset binaries are required for the synthetic test suite.

Run `node --test tests/validate-agent-results.test.mjs` on the stacked branch, or `npm test` after the dependent planner PR is merged.
