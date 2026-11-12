# VirgoStars Astro v0.2 — owner-approved generated image shapes

**Updated 2026-11-12 · Visual direction: approved by owner · Private technical package: built · Production integration: pending**

## What changed

The owner **rejected** the first simplified geometric font v0.1 and then explicitly approved **two newly generated image sheets** as the visual source for the replacement font: 12 zodiac signs and 10 celestial bodies. The owner instructed the project to **use these images**.

These are **newly generated images**, not extracted outlines or bitmaps from the historical `ASTRO-SE.TTF` font. That historical font remains a reference for which *traditional iconographic variants* to depict, without copying its digital drawing.

**The approved image art is the authoritative shape reference.** No need to mechanically redraw the 22 signs using the earlier rejected primitive/buffered-path method.

## Private v0.2 implementation checkpoint

A private image-derived package has been prepared and delivered directly to the owner, **outside this public repository**. It contains:

| Output | Quantity | Details |
| --- | ---: | --- |
| Source approved sprite sheets | 2 | zodiac 4×3 + planetary/body 5×2 |
| Individual source-faithful transparent PNG | **22** | 512×512 RGBA; original antialiasing retained |
| Individual editable-format vector SVG | **22** | traced from the *approved newly generated raster*, not Astro-SemiBold |
| TTF | **1** | `VirgoStarsAstro-v0.2.ttf`; source derived only from approved generated images |
| WOFF2 | **1** | `VirgoStarsAstro-v0.2.woff2` |
| Browser test | 1 | `preview.html`, local-only interactive sheet displaying Unicode font and original image |
| QA | 4 images + technical report | light/dark image overview and font-vs-source comparisons |

The package includes the private input image files, manifest with per-glyph source coordinates and SHA-256, and locally runnable conversion scripts. **No font, SVG, image source or generated binary was committed to GitHub.**

### Source sheet fingerprints

- Zodiac sheet SHA-256: `1d5ee184543b69b716b5f2854941d859fad778bba452e9d8caa1c2e7cd949806`.
- Celestial bodies sheet SHA-256: `eebb60863ce3fa5ebdd4e65c922ae4e1b7dd2ae1de5335c3d19ff8663588b330`.

These hashes are **provenance references**, not public download links or open font licenses. The owner retains the approved package outside public Git.

### Actual technical checks

- **22/22** expected Unicode characters, **23 cmap entries** including optional space, 22 unique nonempty glyph outlines.
- OpenType family: `VirgoStars Astro`; metrics: 1000 units/em, ascender +800, descender −200.
- The TTF and WOFF2 parse successfully and retain the correct character map.
- Checksums for both final font binaries are kept in the **private package's manifest**; the conversion scripts use fixed OpenType timestamps to build reproducible binaries.
- The *font-vs-approved-image* visual comparison shows high silhouette correspondence at review scale. **This is not the same as an actual chart/browser regression test**.
- The generation does **not** rely on `ASTRO-SE.TTF` or any original font contours.

## Remaining release and integration gates

- [x] Owner **approved the newly generated zodiac and planetary glyph image design** in the conversation.
- [x] Separate all approved shapes into 22 transparent PNG and vectorized SVG files.
- [x] Build private Unicode-mapped TTF and WOFF2 from those new images and verify basic OpenType validity.
- [ ] Get final owner signoff on **actual TTF/WOFF2 rendering at small chart sizes**, not just the approved images.
- [ ] Compare glyphs at 16, 20, 24, 32, and 64 px on light/dark natal/transit chart contexts and export to PNG/JPEG.
- [ ] Decide a concrete VirgoStars-owned **font binary embedding/redistribution license**, including permissions for website and open-source Desktop clients.
- [ ] Integrate into `astrological-charts` on a **separate, reversible branch** without changing chart IDs or pointer/aspect interactions.
- [ ] Verify chart/desktop smoke tests and rollback; release or deploy only with explicit authorization.
- [ ] Separately complete the historical-image rights review tracked in [issue #2](https://github.com/Cesare-ml/astrological-assets/issues/2).

## Usage strategy for client applications

**First preference:** use individual **PNG images** to reproduce the owner's approved designs faithfully, with accessible names for every planet/sign. The SVGs are an optional scalable alternative, but their contours should be visually checked before replacing PNGs.

**Second preference:** use the privately generated **WOFF2** for Unicode text-based rendering in a chart. The conversion from PNG to outlines introduces potential differences at very small and very large sizes; do not swap all existing raster paths based only on a passing font validator.

The initial font API is **Unicode**, not legacy Astro-SemiBold ASCII letter aliases. For example, `♈` (Aries) is U+2648 and `♇` (Pluto) is U+2647. This preserves portability and avoids referencing the historical source font.

No binaries are in this public repository because the project owner requested a **VirgoStars-controlled/proprietary** font, and embedding, downstream redistribution and license text still need a separate decision. A visually approved generated image is **not automatically authorization** to publish all proprietary font source files on a public GitHub repository.

The v0.1 rejection remains recorded in [visual rejection review](PROTO_V01_VISUAL_REJECTION.md) and must not be mistaken for a rejection of the newly approved v0.2 image design. See also [roadmap](ROADMAP.md), [font plan](VIRGOSTARS_ASTRO_FONT_PLAN.md), and [issue #8](https://github.com/Cesare-ml/astrological-assets/issues/8).
