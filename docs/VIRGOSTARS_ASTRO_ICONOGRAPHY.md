# VirgoStars Astro — iconographic reference and character mapping

**Scope: 22 symbols · Documentation only · No outlines copied or font distributed**

The project owner clarified that the intended *traditional visual variants* for zodiac signs and planets are the ones visible in the supplied **Astro-SemiBold** file (`ASTRO-SE.TTF`). The old font is therefore a reference for **which conventional astrological form to depict**, as well as general semi-bold legibility. This is **not** permission to reuse its specific digital drawings or font program.

The font file was examined locally (without publishing its binary): the older encoding uses **uppercase A–L for twelve zodiac symbols** and **uppercase Q–Z for ten celestial-body symbols**. Most of those glyphs do **not** have standard astrological Unicode character mappings in the supplied legacy font; the future **VirgoStars Astro** font should assign them proper Unicode characters instead.

## Zodiac signs

| Sign | Legacy key in Astro-SemiBold | New Unicode mapping | Form to preserve |
| --- | :---: | :---: | --- |
| Aries | `A` | ♈ U+2648 | Two curled horns descending into a common stem |
| Taurus | `B` | ♉ U+2649 | Circle below an upturned horn crescent |
| Gemini | `C` | ♊ U+264A | Paired vertical pillars joined at top and bottom |
| Cancer | `D` | ♋ U+264B | Opposed curls / twin spiral-like forms |
| Leo | `E` | ♌ U+264C | Curled loop and descending tail |
| Virgo | `F` | ♍ U+264D | M-shaped form with a closed/inward tail |
| Libra | `G` | ♎ U+264E | Arched dome over a horizontal baseline |
| Scorpio | `H` | ♏ U+264F | M-shaped form with a pointed outward tail |
| Sagittarius | `I` | ♐ U+2650 | Diagonal arrow and crossing bar |
| Capricorn | `J` | ♑ U+2651 | Conventional angular–curled Capricorn form |
| Aquarius | `K` | ♒ U+2652 | Two parallel wave/zigzag rows |
| Pisces | `L` | ♓ U+2653 | Two opposed curved strokes joined through the center |

## Ten celestial bodies

| Body | Legacy key in Astro-SemiBold | New Unicode mapping | Form to preserve |
| --- | :---: | :---: | --- |
| Sun | `Q` | ☉ U+2609 | Solar circle with a central dot |
| Moon | `R` | ☽ U+263D | Curved crescent, with an emphasized double-contour treatment |
| Mercury | `S` | ☿ U+263F | Circle, upward crescent and cross |
| Venus | `T` | ♀ U+2640 | Circle over a cross |
| Mars | `U` | ♂ U+2642 | Circle with diagonal upper-right arrow |
| Jupiter | `V` | ♃ U+2643 | Traditional open curl and crossbar/cross form |
| Saturn | `W` | ♄ U+2644 | Traditional crossed upper stem and descending hook |
| Uranus | `X` | ♅ U+2645 | **H-like lateral elements with a circle below** (not the alternate orb/arrow variant) |
| Neptune | `Y` | ♆ U+2646 | Trident and cross-like lower stem |
| Pluto | `Z` | ♇ U+2647 | **Circle over crescent over cross** (not a simple 'PL' monogram) |

These are **descriptions of historical astrological iconography**, not geometric instructions to reproduce the exact proportions, terminal cuts, curvature or outline of any glyph from the reference font.

### Important variant notes

- The legacy font also uses a lowercase alternate family of many of these signs and bodies (`a`–`l`, `q`–`z`). For **v0**, the uppercase forms above define the **semantic/variant choices**, not a promise of matching their exact outlines.
- Keep **Uranus U+2645** and **Pluto U+2647** as the initial default variants, even though different astrological traditions sometimes depict these bodies differently.
- Source encoding is a description of the existing reference font only; **never map ASCII letters to chart planets in new application code**. For new text labels and font builds, use Unicode `cmap` plus the application's stable celestial-body IDs.

## Clean-room reconstruction protocol

1. Analyze only which **traditional components** identify each symbol. Document that choice in prose.
2. Build all glyphs from independently authored constructions: new grids, stroke joins, arcs, optical corrections, metrics and vector control points.
3. Do not import, trace, auto-vectorize, convert, overlay, morph, copy or adapt the original font's contours, glyph bitmaps, instructions or binary.
4. Review glyphs for **recognizability and alignment with the reference's *traditional type***, not pixel-for-pixel matching or geometric outline similarity.
5. Retain authorship/provenance of every new vector drawing and agree explicit rights/embedding and distribution terms before shipping a proprietary font.
6. Keep the supplied Astro-SemiBold binary **outside the public repository** and preserve its SHA-256 identification only in the separate [font provenance note](FONT_RIGHTS_RESEARCH.md).

## Proposed distribution model

The owner intends the new font to be **owned by VirgoStars**, preferably under proprietary terms. The original source and master font files should be kept under the owner's control. Before distributing the font with an otherwise open-source VirgoStars client, define explicit permission to bundle the binary, cache it, embed it in pages, ship it in Desktop installers and redistribute unmodified application packages.

The open-source status of chart source code **does not automatically make the separately licensed font open source**. Conversely, if the font needs to be freely redistributable in open forks, that requires an explicit licensing decision, not an assumption. Details and acceptance criteria are in [the main font plan](VIRGOSTARS_ASTRO_FONT_PLAN.md).
