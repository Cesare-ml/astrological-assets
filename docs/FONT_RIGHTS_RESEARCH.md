# Font provenance and artwork rights — Astro-SemiBold

**Updated 2026-11-12 · Status: exact font identified, redistribution rights still unverified.**

The project owner provided the actual TrueType file used to create artwork for this project: **`ASTRO-SE.TTF`**. This supersedes the earlier speculative identification of the typeface as "Zodiac S". The file itself was **not uploaded to this GitHub repository**.

## Locally verified identity (owner-supplied font)

| Field | Result |
| --- | --- |
| Supplied filename | `ASTRO-SE.TTF` |
| Internal family and full name | **Astro-SemiBold** |
| Font subfamily | Regular |
| Size | 33,688 bytes |
| SHA-256 fingerprint | `5e702cccaa22bf7c6ef46c48ffeb3624b1886e679cf6893945da5ac198b81942` |
| Glyph count / mapped characters | **399 / 394** |
| Internal copyright/name field | `Converted by ALLTYPE` |
| Internal conversion metadata | `Converted from D:\\JUNK\\ASTRO-SE.TF1 by ALLTYPE` |
| Explicit embedded license text or URL (name IDs 13 and 14) | **Absent** |
| TrueType `OS/2.fsType` flags | `0` — embedding restriction bits only, **not an open-source or redistribution license** |

This fingerprint helps identify the exact file the owner supplied without distributing the font. Internal metadata are not independent proof of authorship or terms of use.

## Historical provenance and evidence

1. [Astrolog 5.40 documentation hosted in Debian Sources](https://sources.debian.org/src/astrolog/5.40-1/Helpfile.540) explicitly calls **`astro-se.ttf`** the **Astro-SemiBold** font, credits its design to **Kenneth Hirst**, and describes its use for planetary and aspect glyphs. This is a strong name-and-filename identification, but not a license grant.
2. [Astrolog 8 documentation](https://www.magitech.com/astrolog/ftp/astrolog.htm) continues to credit the Astro font to Kenneth Hirst. Merely including a font in software downloads does not necessarily authorize independent redistribution or sublicensing.
3. [Delphic Oracle release notes](https://www.astrology-x-files.com/delphicoracle-readme.html) say the **related Astro typeface family** was designed by Kenneth Hirst, originally used in Astrology World, and is **proprietary**, with a Cosmorama Enterprises copyright notice. The exact legal terms and file-version correspondence to the supplied Astro-SemiBold TTF have not been independently established.
4. [Pickafont's Astro-SemiBold listing](https://www.pickafont.com/fonts/Astro-Semibold.html) reports **399 glyphs / 394 characters** and an **unknown license**, consistent with the supplied font's metadata. "Free download" is not the same as an open license.

**Finding:** We have identified the source font reliably. We have **not** found an explicit permission allowing the **TTF file itself** to be distributed under CPAL-1.0 or CC BY 4.0, or allowing all glyph-derived imagery to be relicensed without further examination.

## Distinguish three separate rights questions

- **Original artwork:** the VirgoStars owner states they created the final image compositions and selected CC BY 4.0 for their own creative contributions.
- **Font software:** ASTRO-SE.TTF remains a third-party file whose redistribution/license is unverified. It must **not** be committed, mirrored, bundled or publicly shared as an open-source dependency based solely on this review.
- **Rendered glyphs in raster art:** permission to render/output shapes from a font is not automatically the same as permission to redistribute the font program or sublicense a separately protected glyph design. The actual rights depend on the source license, the work and the jurisdiction. No universal conclusion about all 1,013 images follows from the font identity alone.

## Required targeted review

1. Identify the specific `public/assets/img/` families and files whose glyph shapes were rendered from **ASTRO-SE.TTF**, instead of assuming the entire 1,013-image pack is affected. Ask for source-project details if needed.
2. Locate an original rightsholder-approved license or written permission for using the relevant glyphs in distributable, possibly commercial raster graphics; if no reliable terms can be established, seek qualified legal advice or independently redraw these shapes from genuinely license-compatible sources.
3. Mark only **human-reviewed** SHA-256-pinned images as `thirdPartyStatus: "cleared"` in `catalog/publication-approvals.json`. Keep unresolved items pending.
4. Preserve the original code CPAL and original artwork CC BY 4.0 as distinct policies. No automated license grants or production asset changes.

## Earlier Zodiac S hypothesis

`catalog/upstream-candidates.json` includes an entry for `fonts/Zodiac S_Regular.typeface.json`. This was the source of an *earlier inference* that Zodiac S might be the relevant typeface. **That inference should not be used for the images the owner has now identified as made with Astro-SemiBold.** The existence of another font candidate in the old upstream inventory is a separate fact, not evidence that it was used in these particular images.

No font binary has been added to Git. This page documents provenance and remaining rights questions; it is not legal advice or a certification of commercial licensing.
