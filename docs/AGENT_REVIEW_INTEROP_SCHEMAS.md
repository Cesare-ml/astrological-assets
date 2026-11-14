# Agent review interoperability schemas (v1)

These vendor-neutral JSON Schema Draft 2020-12 documents define the **public wire format** for a future authorized data bridge between VirgoStars Astrological Assets and the VirgoStars Development Orchestrator:

- [Review result batch](../schemas/asset-agent-review-results-v1.schema.json)
- [Private-ledger assignment snapshot](../schemas/asset-agent-review-assignment-snapshot-v1.schema.json)

The schemas contain **no actual owner-only claims, task queue, private repository identity, session credentials, backup references, or user data**. They define required field names, types, bounds, explicit allowed statuses and `additionalProperties: false` throughout. They are not generated from, and are not copies of, a real private ledger.

## Example exchange

1. An authorized operator pins an exact asset manifest, then obtains the metadata-only assignments with `npm run plan:review-shards -- --manifest manifests/approved-assets.json --shards 20` (PR #22).
2. The **Orchestrator**, in its **PRIVATE** ledger context, authenticates the caller, atomically claims work, records a fresh non-reused opaque `assignmentId` per generation, and eventually records `submitted` under its own approved policies. These schemas do **not** implement those operations.
3. A trusted exporter reads an independently pinned commit of the private ledger using authorized credentials and produces a **minimal** snapshot adhering to the assignment schema. The exporter must not publish its input records or reveal private ledger URLs, credentials, task catalogs or user session data.
4. An agent supplies a complete per-shard report adhering to the results schema, with exactly one finding per assigned asset. It includes the same manifest SHA-256, shard count, assignment ID and agent ID.
5. On an authorized **local** machine, invoke the offline structural reconciler with the three local input files **and a separately authenticated ledger commit pin**:

```sh
npm run reconcile:agent-assignments -- \
  --manifest manifests/approved-assets.json \
  --results /private/path/review-results.local.json \
  --assignments /private/path/assignment-snapshot.local.json \
  --expected-ledger-commit "$LEDGER_COMMIT_SHA"
```

The example uses POSIX shell variables; in Windows PowerShell use `$env:LEDGER_COMMIT_SHA`. The expected SHA must be independently observed via trusted access to the PRIVATE ledger; copying the value from an untrusted snapshot defeats the pin.

## Schema-vs-runtime boundaries

The schemas do **not** express all constraints enforced by the real Node.js validators. In particular, interoperable implementations must additionally enforce:

- **Exact asset scope:** each result path belongs to precisely the shard assigned by the pinned manifest, with the original filename casing and expected SHA-256; no duplicate paths and no missing paths in a submitted shard.
- **Exclusive assignment identity:** within a snapshot, a shard and an assignment ID appear at most once. Result and snapshot identities must match exactly. A new generation must never reuse the old assignment ID.
- **Provenance:** use the SHA-256 of the actual raw manifest bytes, pin the source repository/commit, and require the externally verified `--expected-ledger-commit` argument. A well-formed SHA is not authentication.
- **Privacy:** never commit output containing real assignment IDs, private session IDs, or a real snapshot into the public repository. These are schemas, not consent to publish records.
- **Rights:** `inspected` is self-reported; `state: submitted` is workflow status; neither is independent evidence of an image license. Public artwork clearance remains a separately reviewed gate.

The documents are **static contracts**. JSON Schema validation alone cannot verify private GitHub commit authenticity, active claim ownership, cross-record uniqueness or authorization. The Orchestrator's current owner-operated alpha has **no automatic safe TTL reclaim** and must not reinterpret a stale/expired record as an unlocked task.

## Testing and dependencies

`node --test tests/agent-review-interop-schemas.test.mjs` checks document invariants, discriminators, field allowlists, reference closure and synthetic roundtrip compatibility with the actual local validators when run in a complete checkout. No external JSON Schema validator is bundled or claimed; the tests check the **contract structure**, not a general-purpose JSON Schema interpreter. Use an independently chosen Draft 2020-12 validator for consumer implementations.

Integration order (draft stacked PRs): **#22 worklist planner → #25 report validator → #27 snapshot reconciler → #28 independent ledger pin → this schema contract**. The real private exporter should be implemented **only in an independently authorized Orchestrator task**, never by copying owner-only ledger data into the public Astrological Assets checkout.

No GitHub Actions, deployment, GitHub mutation, rights change or image binary is required for these metadata-only contracts.
