# VirgoStars Astro — original symbol font proposal

**Status: design proposal / not a released font.** Target: 22 original astrological glyphs for VirgoStars charts, authored independently and controlled by the VirgoStars project. This proposal creates **no font files**, licenses, third-party glyph reproductions, or replacements of existing assets.

## Goal and boundaries

Create a coherent and legible display font for the **twelve zodiac signs** and **ten major planetary bodies** currently needed by the application. **The owner has clarified that the traditional astrological *symbol forms* in Astro-SemiBold (`ASTRO-SE.TTF`) are the desired iconographic reference**, not merely its visual weight. Keep the same recognizable conventional symbol variants (especially Uranus and Pluto), but construct original, independently authored geometry. Its provenance/license remains uncertain (see [font research](FONT_RIGHTS_RESEARCH.md) and [iconography reference](VIRGOSTARS_ASTRO_ICONOGRAPHY.md)).

**Clean-room rule:** never import, extract, trace, vectorize, reprocess, distort, adapt, convert or copy an Astro-SemiBold outline, glyph bitmap, control point or font file. Do not use that font as a starting template, training sample or source in any generated assets. Define new glyphs from traditional astrological *concepts* and the publicly specified Unicode characters, using a uniform original design system. Do not claim changing a few points would create a legally independent font.

## Initial Unicode character coverage

Unicode characters are the primary identifiers, not private custom ASCII substitutions.

| Category | Symbol | Name | Code point |
| --- | :---: | --- | --- |
| Zodiac | ♈ | Aries | U+2648 |
| Zodiac | ♉ | Taurus | U+2649 |
| Zodiac | ♊ | Gemini | U+264A |
| Zodiac | ♋ | Cancer | U+264B |
| Zodiac | ♌ | Leo | U+264C |
| Zodiac | ♍ | Virgo | U+264D |
| Zodiac | ♎ | Libra | U+264E |
| Zodiac | ♏ | Scorpio | U+264F |
| Zodiac | ♐ | Sagittarius | U+2650 |
| Zodiac | ♑ | Capricorn | U+2651 |
| Zodiac | ♒ | Aquarius | U+2652 |
| Zodiac | ♓ | Pisces | U+2653 |
| Body | ☉ | Sun | U+2609 |
| Body | ☽ | Moon | U+263D |
| Body | ☿ | Mercury | U+263F |
| Body | ♀ | Venus | U+2640 |
| Body | ♂ | Mars | U+2642 |
| Body | ♃ | Jupiter | U+2643 |
| Body | ♄ | Saturn | U+2644 |
| Body | ♅ | Uranus | U+2645 |
| Body | ♆ | Neptune | U+2646 |
| Body | ♇ | Pluto | U+2647 |

**Total: 22 glyphs**, plus `.notdef` and optionally `space` for normal font operation. Additional alternate Moon/Uranus/Pluto glyphs, nodes, asteroids, Chiron, angles, aspect symbols and house symbols are explicitly **out of scope for v0**. Names/codes above follow the [Unicode Miscellaneous Symbols chart](https://www.unicode.org/charts/PDF/U2600.pdf).

## Visual design system to evaluate

- **Working family name:** `VirgoStars Astro` (verify branding and name availability before release).
- **Direction:** geometric, restrained, semi-bold strokes, rounded terminals, optically centered, readable at **16–24 px** in dense natal and transit wheels, without depending on extra detail.
- **Construction:** begin with an original common 1,000-units-per-em grid; consistent stem weight and circle/arc proportions; tune optical sizes per individual symbol rather than mechanically scaling them.
- **Single canonical outline set:** derive light/dark presentation from UI colors; do **not** make distinct fonts for colors.
- **Clear baseline and advance-width metrics:** avoid layout jumps on chart interaction, hover, focus or export.
- **Reproducibility:** author vector drawing source with editable parameters; generate binary font artefacts from source only after review. Source files and checksum receipts must be retained privately or under an explicitly selected license.
- **Accessibility:** symbols should have accessible body/sign names in surrounding markup rather than relying on glyph shape alone.

Astro-SemiBold is an **iconographic reference for traditional *which-form* choices** (for example the circle-and-dot Sun, the specific traditional Uranus variant, and the circle–crescent–cross Pluto) **and a general design-character reference**, not a license or an outline template. Match the identity and arrangement of conventional components, but not its exact curves, control points, distinctive details, metrics, or contours. See [symbol reference](VIRGOSTARS_ASTRO_ICONOGRAPHY.md).

## Planned implementation stages

1. **Originality/provenance:** create independent design sketches from Unicode character meanings and geometric primitives. Record who drew each glyph and the source of any reference material. No copied outlines from ASTRO-SE.TTF or from other protected fonts.
2. **MVP:** build 22 original vector glyphs and assign standard Unicode code points. Test glyph generation and font naming; keep drafts off the public repository until release rights are chosen.
3. **Build:** produce `TTF` and `WOFF2` from the **same original outlines** using a deterministic build procedure. Record the resulting file hashes, licensing metadata and version. Do not commit copies of ASTRO-SE.TTF.
4. **Visual QA:** measure glyphs at 16, 20, 24, 32 and 64 px, assess collisions, apparent weight, legibility with chart lines/planet bodies, visual parity across dark/light themes and hi-DPI export.
5. **Integration:** prototype a `@font-face` stack inside [astrological-charts](https://github.com/Cesare-ml/astrological-charts) on a separate branch; map labels by Unicode code point, with fallback. Preserve planet/sign IDs and interaction events independent of font rendering.
6. **Rights and distribution:** obtain explicit author signoff, chosen font license, redistribution/embedding terms, and a release decision before any font file enters an **open** repo or a production build.
7. **Migration:** only replace older font-based output after tests and human review. Changing the new runtime font does **not** retroactively clear existing raster images if their glyphs derive from a different font.

## Proprietary ownership vs open-source distribution

The user wants **VirgoStars to own its original font**. Ownership of an independently created design is compatible with either proprietary distribution or a public open-font license: **licensing does not transfer ownership**.

There are two different strategies:

- **Preferred direction — proprietary `VirgoStars Astro`:** retain original font source and binaries in a private rights-controlled workspace. Define an explicit license for bundling, installation, web embedding and redistribution in VirgoStars Desktop/site (including downstream users of the open-source client). A custom license and distribution terms need a separate decision; `All rights reserved` alone is **not a clear embedding grant**.
- **Open-source font owned by VirgoStars:** license the original font under **SIL OFL 1.1**, with copyright attribution and an optional **Reserved Font Name** for `VirgoStars Astro`. This supports community redistribution/modification subject to OFL and preserves the owner’s copyright and reserved font naming, but **does not make the font exclusive**. See [SIL OFL FAQ](https://software.sil.org/OFL-FAQ_web).

**VirgoStars ownership and proprietary control are the preferred outcome stated by the owner; the concrete license and distribution permissions still need to be drafted and approved.** Avoid treating CPAL-1.0 (tooling) or CC BY 4.0 (original artwork) as the automatic license of the future font.

## Acceptance criteria for an initial original-font PR

- [ ] 22 original outlines with documented authorship/provenance (not derived from the supplied font)
- [ ] All 22 exact Unicode mappings and valid `cmap`
- [ ] Original editable vector sources and reproducible binary generation
- [ ] Independent review of distinct contours and consistent stroke/metrics
- [ ] Font renders legibly at 16–64 px across light/dark and SVG/PNG exports
- [ ] Validated TTF/WOFF2 build and explicit font license/embedding/redistribution terms
- [ ] Browser-based chart integration demonstration and rollback plan
- [ ] No original Astro-SemiBold data/binaries or unauthorized fonts in the public repo

## Relationship to existing assets

The existing 1,013 raster images remain unchanged. The new font project is **not** a substitute for completing [the historical-artwork rights review](https://github.com/Cesare-ml/astrological-assets/issues/2), nor is it a claim that every past image was derived from the same old font.
