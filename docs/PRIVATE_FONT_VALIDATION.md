# VirgoStars Astro — private font build validation

**Status:** working read-only QA tool for **future** independently drawn font builds. This does **not** create, distribute, license or approve a font. The 22 glyph outlines are still to be designed.

This public repository contains only the machine-readable, **geometry-free** character contract and generic validators. The original Astro-SemiBold font and future proprietary VirgoStars Astro source/binaries must remain in an access-controlled workspace **outside this public Git checkout**.

## Validation contracts

The existing **Node.js** contract validates the planned `specs/virgostars-astro.v0.json` against the exact 22 characters, traditional iconographic variant identifiers, legacy-reference labels and initial proposed metrics:

```bash
npm run check:astro-spec
npm test
```

The new **Python/fontTools** tool reads a privately created TTF or WOFF2 to check the actual resulting font. Run it only against font files that you have rights to inspect:

```bash
python -m pip install "fonttools[woff]"
python scripts/validate-private-font.py --font ../private-font-work/build/VirgoStarsAstro.ttf
python scripts/validate-private-font.py --font ../private-font-work/build/VirgoStarsAstro.woff2

# Optional, synthetic-only validator tests (not part of npm test):
python -m unittest discover -s tests -p "test_private_font_validator.py" -v
```

The validator checks:

- Input is **outside the public repository directory** (also resolves symlinks before this check).
- Parsable TTF/WOFF2 and required OpenType tables.
- Exact family name `VirgoStars Astro` and initial metric contract (1000 UPM, ascender 800, descender -200).
- The complete **22-codepoint Unicode cmap** using canonical U+26xx values, with only an optional U+0020 space. **No A–L/Q–Z legacy ASCII aliases** in the new font.
- 22 distinct, present, nonempty glyph outlines, with reasonable positive horizontal advances.
- An existing `.notdef` glyph.
- OS/2 restricted-embedding bit is not set. This is **only a technical flag**, not a proof of a valid legal embedding license.
- Prints a JSON summary without copying the font, writing any font contents, or making network calls.

**Exit status:** 0 for technical success; 2 for invalid inputs/fonts. A passing validation **does not** establish that curves are original, that commercial/redistribution rights have been obtained, or that the resulting outlines visually resemble the user's desired traditional symbol variants.

## Provenance and release precautions

1. Do not use, trace, copy, convert, alter, vectorize, extract or modify contours from `ASTRO-SE.TTF` as a shortcut to the new font. The historical typeface is an **iconographic reference for traditional symbol families only**.
2. All actual new vectors must have independently documented authorship and rights.
3. Do not commit proprietary TTF, WOFF2 or editable outline files to `astrological-assets` while it is public.
4. The font still needs owner-approved copyright, proprietary license terms and explicit permissions for embedding/bundling in open-source web/Desktop clients.
5. Validate actual design and visual quality at 16–64 px, compare appearance in light/dark themes, test fallback, browser export, and downstream chart integration. Passing an OpenType table check is not visual QA.
6. Keep the pre-existing 1,013 raster files and their separate font-related rights issue ([#2](https://github.com/Cesare-ml/astrological-assets/issues/2)) unchanged unless a separately reviewed migration is approved.

### Testing strategy

`tests/test_private_font_validator.py` creates **synthetic rectangle glyphs** in temporary files to exercise the validator. These test fonts have no design resemblance or shared glyph geometry with Astro-SemiBold. Their tests cover valid TTF, valid WOFF2, missing Unicode mappings, empty outlines, incorrect family names, unauthorized specification changes and a font accidentally stored inside the public checkout.

These synthetic fixtures are **not** drafts or deliverables for the real VirgoStars font.

## Private visual QA companion

Use [`create-private-font-specimen.py`](../scripts/create-private-font-specimen.py) to generate a **private, offline HTML** page showing all 22 glyphs at 16/20/24/32/64 px in both themes and zodiac-wheel approximations. See [PRIVATE_FONT_VISUAL_QA.md](PRIVATE_FONT_VISUAL_QA.md) for usage and confidentiality restrictions. **The output contains embedded private font bytes and must never be committed or shared publicly.** This complements, but does not replace, actual chart/browser/export and human visual QA.

## Next design milestone

Continue with the [VirgoStars Astro font specification](VIRGOSTARS_ASTRO_FONT_PLAN.md), [iconography choices](VIRGOSTARS_ASTRO_ICONOGRAPHY.md), [roadmap](ROADMAP.md) and [issue #8](https://github.com/Cesare-ml/astrological-assets/issues/8). The remaining F0 tasks, original vectors in F1, human rights approval and actual integration are not completed by this validator.
