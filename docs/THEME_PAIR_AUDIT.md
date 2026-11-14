# Light/dark chart asset parity audit

The existing approved pack has **26 matching overlay pairs** under `img/grafici/{light,dark}/`, and **23 matching circular planet-symbol pairs** under `img/symbols/planets/{light,dark}/`. The light skin additionally contains `texture-carta-panna.png`, a paper background with **no existing dark counterpart**. This intentional difference is recorded in `manifests/theme-pair-exceptions.json`.

Before changing the chart themes or handing a versioned asset subset to Astrological Charts or an offline Astrolabio, run:

```sh
npm run audit:theme-pairs
# Equivalent explicit invocation:
node scripts/audit-theme-pairs.mjs --manifest manifests/approved-assets.json --exceptions manifests/theme-pair-exceptions.json --required manifests/required-theme-pairs.json
node --test tests/audit-theme-pairs.test.mjs
```

The tool reads the approved manifest, the exception register, and an optional baseline file. When supplied via `--required` (included in `npm run audit:theme-pairs`), `manifests/required-theme-pairs.json` requires **all 49 historically present chart overlay and planetary symbol pairs** to remain present in both skins. This detects silent removal of both variants, which a symmetry-only check cannot find. Intentional removals require an independently reviewed baseline update; newly added complete pairs remain allowed. Omitting `--required` performs only symmetry checks for lightweight synthetic fixtures. The baseline records path names, not image bytes, SHA-256 validation, or a legal permission to release.\n\nThe tool reads only local JSON files. It checks the version-1 manifest records for nonnegative safe integer lengths, canonical lowercase SHA-256 and Git blob SHA-1 metadata, and nonempty private-approval fields (a structurally valid record is **not** public clearance). It checks exact-case chart family names and exception filenames, requires canonical Unicode NFC spelling, applies the repository's existing importer path/type validator to each manifest record, detects case/Unicode-colliding paths and Windows-incompatible filenames (reserved device names, forbidden characters, and trailing dots/spaces). To match Astrological Charts' host-owned URL contract, it rejects percent escapes (`%`) and fragments (`#`) in literal paths. It also rejects unknown or incorrectly cased theme directories, blocks manifests with either chart theme family absent, reports unmatched light/dark asset names within both families, and requires every exceptional missing counterpart to be explicitly documented. An exception automatically becomes stale if its source asset disappears or its counterpart is added. Results and ordering are deterministic.

- **Exit 0:** paired assets and current documented exceptions match the inventory.
- **Exit 2:** unexpected unmatched assets, missing required pairs, missing theme families, or stale exception records; review the source artwork before any consumer integration.
- **Exit 1:** invalid or incomplete manifest/exception/required-inventory input, unsafe paths, or command usage.

The audit is **metadata-only**: checking the SHA-1 field's format does not compare it to Git's object tree. It does not read or compare PNG bytes, assess visual equivalence, check SHA-256, validate third-party font/artwork rights, approve distribution, or touch production applications. Continue to run `npm run verify:pack` and the independent public-rights review before any release. `catalog/publication-approvals.json` is not modified or inferred. The canonical consumer URLs retain their existing `/assets/img/...` paths and case. **Powered by VirgoStars** · https://www.virgostars.it/.
