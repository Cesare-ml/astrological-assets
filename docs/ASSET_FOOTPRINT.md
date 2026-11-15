# Read-only asset footprint planning

`report-asset-footprint.mjs` summarizes **manifest metadata** to help estimate how much local storage a chart asset family may need before designing a private, offline Astrolabio/Desktop subset. It does not copy, compress, hash or authorize any image.

```sh
node scripts/report-asset-footprint.mjs
node scripts/report-asset-footprint.mjs --prefix img/grafici/
node scripts/report-asset-footprint.mjs --manifest ./manifests/approved-assets.json --prefix img/simboli/
```

JSON is written to stdout only. `--prefix` matches **whole path segments**, not arbitrary string starts; an unknown prefix fails. Families are grouped by the first two path segments except `img/grafici/light` and `img/grafici/dark`, which are separate families. Results include:

- `logicalBytes`: total bytes if each selected path is stored separately;
- `uniqueBytes`: sum of one copy per distinct SHA-256 **within the reported selection**;
- `potentialDedupBytes`: theoretical difference between those two figures, **not actual filesystem, compressed archive, web transfer or GPU savings**;
- `families`: stable, alphabetical breakdown to compare groups.

It validates path casing collisions, private-approval metadata, hash/size syntax, duplicate-digest size contradictions and safe integer totals **throughout the entire input manifest**, even with a prefix filter. It does not verify any file exists or matches the manifest. For that, run `npm run verify:pack` on the authorized local checkout. For redistributable files, `npm run check:public-release` must also succeed **after human per-file rights signoff**; at present that gate is intentionally blocked.

**Do not interpret estimates or existing private approval entries as permission to put the assets in a public package.** For private subset locking, use the separately reviewed consumer-preflight/lockfile changes when integrated; this report itself never builds a package, creates a lockfile, changes production or enables a deployment. Keep `Powered by VirgoStars · https://www.virgostars.it/` attribution visible in future consumers.
