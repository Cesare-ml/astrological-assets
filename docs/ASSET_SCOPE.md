# Asset scope and upstream catalog

The source snapshot in `catalog/upstream-candidates.json` was collected from `Cesare-ml/virgo-stars` at commit `9900c36acc309bc2a6e87009f554b2e4141e4864`.

**Snapshot:** 1,124 candidate file records, approximately 80.44 MiB summed file sizes (552 distinct Git content blobs, including 29 paths flagged as legacy). These are names, sizes and **Git SHA-1 blob identifiers**, **not actual binary files**, **not SHA-256 release hashes**, and **not permissions to redistribute them**. The `_circle` family was added after the initial 1,078-file inventory.

| Family | Number of candidates | Notes |
|---|---:|---|
| `img/simboli` | 895 | Skin-specific signs, planetary bodies, houses, elements, chakrams and variations |
| `img/simboli-bianchi` | 78 | 12 signs, 12 houses, 50 celestial-body images, 4 elements |
| `img/symbols/planets/{dark,light}/_circle` | 46 | Circular planet symbols used for latitude charts |
| `img/grafici` | 81 | Ring overlays, background images, alternate/legacy images; includes old artifacts |
| `img/textures` | 4 | Texture images; may have third-party rights restrictions |
| `img/risuonatore-solare*.png` | 4 | Check artist ownership and permitted private collaborator sharing |
| `fonts` | 16 | Font license review is essential |

*Group counts are derived from metadata. Do not interpret the full catalog as the minimal set needed for charts, nor import every file.*

## Scope choices

**Include after approval:** canonical zodiac, planet, house and element symbols, raster skins and textures referenced by maintained renderers, plus explicitly authorized branded artwork. The current owner-authorized pack contains 1,013 images; retain their complete original paths within `public/assets/`.

**Exclude by default:** user data, account images, logos for unrelated site sections, portraits, scraped photos, tarocchi, deprecated assets, unlicensed stock textures and fonts not needed for rendering.

The original `public/assets` folder also supports the site's non-chart pages. That remainder **stays with VirgoStars**; do not move it into this repository.

## Known mismatch

The upstream renderer references `img/risuonatore-solare-bianco.png`, but the snapshot contains `img/risuonatore-solare-bn.png` instead. The owner authorized using the existing `bn` file in the independent Charts repository. Both source filenames and the imported file are preserved; the live upstream renderer is unchanged and visual parity still requires review.

## File size and duplicates

Some skins reuse identical binary files at different paths. Git stores identical content blobs efficiently, but those distinct paths can still be necessary for existing runtime URL compatibility. Do not collapse paths unless renderer/frontend references are deliberately migrated and tested.

The new repository is **not yet the deployed source of truth**.
