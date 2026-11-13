# VirgoStars Astro — private offline font specimen

**Status:** developer-only, locally generated QA evidence. **No fonts or preview files are published.** This supplements the technical font validator; it is **not** final glyph approval, font licensing, browser export testing or a chart integration.

The owner-approved v0.2 source images are documented in [APPROVED_GLYPH_IMAGES_V02.md](APPROVED_GLYPH_IMAGES_V02.md). The v0.1 geometric font was rejected; this tool does not recreate or promote it.

## Requirements

- Python 3.10+ and the optional fontTools/WOFF2 dependency, installed **outside** the public repository as needed:

  `python -m pip install "fonttools[woff]"`

- A privately stored **TTF or WOFF2** built from the approved new images or independently authorized original outlines, with the exact 22 Unicode mappings and expected metrics.
- An **existing private output directory**, both the input font and output HTML outside this public checkout.

## Generate a specimen locally

From the root of `astrological-assets`:

```bash
# Create the private output directory yourself, OUTSIDE this repository.
python scripts/create-private-font-specimen.py \
  --font ../private-font-work/build/VirgoStarsAstro-v0.2.woff2 \
  --out ../private-font-work/qa/virgostars-astro-v02-review.html

# Safe by default: existing HTML will not be overwritten.
# Add --force only when intentionally replacing an existing private specimen.
```

Open the resulting local HTML file manually in a browser; no server, network, account or GitHub Actions are required. The page renders:

1. All **22 Unicode glyphs** at **16, 20, 24, 32 and 64 px**, in both light and dark palettes.
2. Twelve zodiac glyphs in a **360 px chart-wheel approximation**, separately in light and dark themes.
3. Ten planetary glyphs in a 24 px dark-theme strip.

Check Virgo, Scorpio and Capricorn particularly for contour quality, tails and joins, then check every glyph for optical centering, smallest-size legibility, line overlap, consistent apparent weight and contrast. Save any review notes **privately**; the output file itself contains the font bytes.

## Important confidentiality boundary

**The HTML embeds the entire proprietary font as a base64 data URI. Treat it like a private font binary.** Never commit, attach to public issues/PRs, publish, upload to shared previews or host this HTML. The generator rejects font files and output destinations inside this public checkout, including output-directory symlinks resolving into it. It refuses to overwrite existing files without `--force` and refuses symbolic-link output files even with `--force`.

The generated page includes a restrictive Content Security Policy and requires no external assets. These safeguards **do not make the output public, prove ownership, prevent intentional copying, or replace a font licensing decision**.

The **existing** `scripts/validate-private-font.py` runs before writing any output, and a failure stops specimen generation. Passing does not mean visual quality or embedding rights are approved. Actual browser chart size, DPI, PNG/JPEG exports, hover/focus semantics, and downstream fallback still require separate tests in [astrological-charts](https://github.com/Cesare-ml/astrological-charts).

## Tests

Synthetic rectangle glyphs only; the actual proprietary font, approved image files and reference `ASTRO-SE.TTF` are not test fixtures:

```bash
python -m unittest discover -s tests -p "test_private_font_specimen.py" -v
python -m unittest discover -s tests -p "test_private_font_validator.py" -v
```

The specimen tests cover complete light/dark coverage, all sizes, Unicode, offline HTML, output path protection, symlink protection, no implicit overwrites and input font location checks. Browser rendering itself is **not** automatically verified by these unit tests.

Tracking: [issue #8](https://github.com/Cesare-ml/astrological-assets/issues/8), [roadmap](ROADMAP.md) and [private-font technical validation](PRIVATE_FONT_VALIDATION.md). Existing raster rights clearance ([issue #2](https://github.com/Cesare-ml/astrological-assets/issues/2)) is unaffected.
