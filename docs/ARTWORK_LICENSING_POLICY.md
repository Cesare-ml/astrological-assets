# Artwork licensing policy — CC BY 4.0

**Owner selection recorded on 2026-11-12.** The project owner confirmed proceeding with the proposal to use [Creative Commons Attribution 4.0 International (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/) for original images, as recorded in [catalog/artwork-license-decision.json](../catalog/artwork-license-decision.json). The chosen policy is anchored to the 1,013-image SHA-256 manifest.

| Material | Intended license | Publication clearance |
| --- | --- | --- |
| Original tooling, scripts, tests and accompanying source documentation | [CPAL-1.0](../LICENSE), including VirgoStars attribution | Public repository; retain CPAL obligations |
| Original artistic contributions for which the owner has the necessary rights | **CC BY 4.0** | Owner decision recorded; **individual file clearances pending** |
| Separately licensed fonts, glyphs, textures, maps and artwork | Their respective owners' terms | Must be reviewed or excluded |
| Logos, trademarks and trade dress | Separate trademark rules | Not licensed by CC BY |

CC BY 4.0 permits sharing and adaptations, including commercial use, with appropriate attribution, a license link and an indication of modifications. Once applied, its license grants are irrevocable as long as the user complies with the terms. [Official license text](https://creativecommons.org/licenses/by/4.0/legalcode).

**Proposed artwork attribution:**

> VirgoStars — Astrological Assets (original artwork by the project owner) · CC BY 4.0 · https://creativecommons.org/licenses/by/4.0/

The **Powered by VirgoStars** attribution under the software CPAL license is independent of the artwork attribution above.

## Important limitation

The owner has affirmed authorship of the images and identified the font used in some artwork as **Astro-SemiBold (`ASTRO-SE.TTF`)**. Its metadata, fingerprints and third-party provenance are documented in [font research](FONT_RIGHTS_RESEARCH.md), but its relevant license and glyph-output rights remain unverified. No font binary is present in this repository. That does not prove that every image made using that font can be redistributed under CC BY 4.0. Images containing unreviewed third-party content must be excluded from a public release or the underlying rights must first be cleared.

**Do not interpret this owner-level license choice as a blanket technical approval of all 1,013 image binaries.** `catalog/publication-approvals.json` remains the authority for file-specific public redistribution clearance. That register is still empty. The preflight must remain blocked until each exact image hash has a specific third-party clearance record, or any non-clearable images have been removed from a separately audited public export.

The publication must also pass a Git history and content audit; public repository visibility must not be changed automatically.
