# Light/dark chart asset parity audit

The existing approved pack has **26 matching overlay pairs** under `img/grafici/{light,dark}/`, and **23 matching circular planet-symbol pairs** under `img/symbols/planets/{light,dark}/`. The light skin additionally contains `texture-carta-panna.png`, a paper background with **no existing dark counterpart**. This intentional difference is recorded in `manifests/theme-pair-exceptions.json`.

Before changing the chart themes or handing a versioned asset subset to Astrological Charts or an offline Astrolabio, run:

```sh
node scripts/audit-theme-pairs.mjs --manifest manifests/approved-assets.json --exceptions manifests/theme-pair-exceptions.json
node --test tests/audit-theme-pairs.test.mjs
```

The tool reads only the two JSON files. It checks the version-1 manifest records for nonnegative safe integer lengths, lowercase SHA-256 metadata, and nonempty private-approval fields (a structurally valid record is **not** public clearance). It checks exact-case chart family names and exception filenames, requires canonical Unicode NFC spelling, applies the repository's existing importer path/type validator to each manifest record, detects case/Unicode-colliding paths and Windows-incompatible filenames (reserved device names, forbidden characters, and trailing dots/spaces), rejects unknown or incorrectly cased theme directories, blocks manifests with either chart theme family absent, reports unmatched light/dark asset names within both families, and requires every exceptional missing counterpart to be explicitly documented. An exception automatically becomes stale if its source asset disappears or its counterpart is added. Results and ordering are deterministic.

- **Exit 0:** paired assets and current documented exceptions match the inventory.
- **Exit 2:** unexpected unmatched assets, missing theme families, or stale exception records; review the source artwork before any consumer integration.
- **Exit 1:** invalid or incomplete manifest/exception input, unsafe paths, or command usage.

The audit is **metadata-only**: it does not read or compare PNG bytes, assess visual equivalence, check SHA-256, validate third-party font/artwork rights, approve distribution, or touch production applications. Continue to run `npm run verify:pack` and the independent public-rights review before any release. `catalog/publication-approvals.json` is not modified or inferred. The canonical consumer URLs retain their existing `/assets/img/...` paths and case. **Powered by VirgoStars** · https://www.virgostars.it/.
