# Read-only reconciliation with Orchestrator assignment snapshots

This is a **structural, offline audit** intended for a future authorized integration between VirgoStars Astrological Assets and the VirgoStars Development Orchestrator. It does **not** create claims, manage leases/TTLs, contact GitHub, authenticate an agent, or make a public image legally reusable.

## Inputs and command

Run only on an operator-authorized local machine, keeping private coordination snapshots **outside this public repository**. First set `LEDGER_COMMIT_SHA` from an independently authenticated PRIVATE ledger read (the example uses POSIX shell expansion; in PowerShell use `$env:LEDGER_COMMIT_SHA`):

```sh
npm run reconcile:agent-assignments -- \
  --manifest ./manifests/approved-assets.json \
  --results /private/path/review-results.local.json \
  --assignments /private/path/assignment-snapshot.local.json \
  --expected-ledger-commit "$LEDGER_COMMIT_SHA"
```

The results file follows [Agent review results](AGENT_REVIEW_RESULTS.md), and the manifest is the *same exact file bytes* used for the worklists in [PR #22](https://github.com/Cesare-ml/astrological-assets/pull/22).

A future trusted, **PRIVATE** Orchestrator exporter may provide this explicit, deliberately minimal snapshot schema:

```json
{
  "schemaVersion": 1,
  "purpose": "asset-review-assignment-snapshot",
  "source": {
    "repository": "example/private-source",
    "commit": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "assetRoot": "public/assets"
  },
  "manifestSha256": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  "shardCount": 2,
  "ledgerCommitSha": "cccccccccccccccccccccccccccccccccccccccc",
  "assignments": [
    {
      "shardIndex": 1,
      "assignmentId": "task-1-unique-generation",
      "agentId": "agent-1",
      "state": "submitted"
    }
  ]
}
```

These are **synthetic placeholders**, not genuine ownership evidence. Keep the private ledger's repository identity, session IDs, and source claim records outside this repository and all public PRs. The required `ledgerCommitSha` is an opaque 40-character source revision marker. The tool now **requires an independently supplied `--expected-ledger-commit` value** and refuses any mismatch. Obtain the expected SHA from a separately authenticated, permission-scoped read of the PRIVATE ledger's pinned commit; **never trust an expected SHA copied from the snapshot under examination**. The comparator checks equality only: it cannot authenticate the live ledger, prove freshness against new commits, verify a signature, or detect maliciously paired inputs. It does not open GitHub or fetch the live private ledger.

## Validation behavior

1. Recompute SHA-256 of the **raw manifest bytes** and run the full path/SHA-256/shard membership validator from the dependent PR #25.
2. Require the snapshot to match the manifest fingerprint, source repository/commit/root, shard count and **independently pinned private-ledger commit**. Reject unknown fields, invalid IDs, invalid states, duplicate shard assignments and duplicate assignment IDs.
3. For each result submitted, require **exactly matching** `assignmentId`, `agentId`, shard number and assignment state `submitted`. A `claimed`, `in_progress` or `cancelled` assignment cannot report a completed result.
4. Summarize never-assigned shards, still-active shards, cancelled shards, previously submitted shards missing their report, and missing report shards, without exposing agent IDs or sensitive approval evidence.

Valid assignment states are: `claimed`, `in_progress`, `submitted`, and `cancelled`. A future coordinator MUST issue a **new, never-reused assignmentId** on every reassignment. Old reports are then rejected when the current snapshot identifies the new assignment. Reusing IDs or supplying a forged/stale snapshot defeats this structural check.

### Exit codes

- **0:** all shards present with current matching `submitted` assignments and each asset self-reported as inspected.
- **2:** structurally consistent partial work, missing assignments, nonfinal states, or flagged/not-checked findings.
- **1:** malformed inputs, missing/invalid/mismatched independent ledger pin, stale identities, conflicting assignments/results, wrong manifest or schema.

A zero result means **structural reconciliation only**; it is neither completion approval nor evidence that any image's real bytes, appearance, provenance, third-party rights or downstream consumer have been validated.

## Separation of responsibilities

**Astrological Assets** owns deterministic local worklists, result/snapshot format checks, and no mutable coordination state.

**VirgoStars Orchestrator** is the *sole* potential authority for authenticated agent sessions, atomic exclusive claims, resource locks, secure PRIVATE GitHub ledger snapshots, fencing generations, reassignment, and optional future TTL/lease recovery. Its current owner-operated pilot does **not** implement safe automatic TTL reclamation. A timestamp or expired timer is not enough to seize someone else's task. Do not store or reconstruct owner-only claims in the public astrological-assets repository.

**Human reviewers** still approve any rights clearance and source-specific publication evidence. This script never edits or signs `catalog/publication-approvals.json`.

## Verification and integration

This feature is **stacked on PR #25**, which itself depends on PR #22. Merge/rebase in dependency order and test a real, authorized exporter and actual private claim records before production integration. Run `node --test tests/reconcile-agent-assignments.test.mjs` for synthetic cases, then the complete checkout tests. This tool does not deploy, schedule chats or introduce GitHub Actions.
