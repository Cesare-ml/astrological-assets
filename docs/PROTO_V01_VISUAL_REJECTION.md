# VirgoStars Astro v0.1 — visual rejection and redesign gate

**Review date:** 2026-11-12  
**Decision:** **REJECTED FOR VISUAL QUALITY BY THE OWNER.**  
**Scope:** privately delivered geometric TTF/WOFF2 v0.1 only. The machine-readable Unicode registry, its validators and the independent source-provenance rules remain valid.

Do not merge this prototype as a production asset, install it into a client, describe its glyph outlines as approved, or treat the successful OpenType validation as visual acceptance.

## Review of the actual 22-glyph specimen

The previous v0.1 uses single-weight buffered strokes and simplified line/arc constructions. The glyphs are *technically parsable* but do not meet the owner's request for carefully drawn traditional astrological forms associated with the **iconographic tradition shown in Astro-SemiBold**. The issue is **not** missing Unicode support; it is poor letterform design.

| Priority | Symbols | Observed failure mode | Redesign target |
| --- | --- | --- | --- |
| Critical | **Virgo**, **Scorpio**, **Capricorn** | Rough approximations, awkward tails/curls, confused silhouette and joins; poorly recognizable at small size | Redraw each as a deliberate, integrated high-quality traditional sign with continuous strokes and carefully designed terminals |
| High | **Cancer**, **Leo** | Oversimplified circular swirls; unconvincing proportions and stroke transitions | Restore recognizable paired rotating curls / single calligraphic spiral-tail structure, with optical balancing |
| High | **Mercury** | The crescent, circle and cross collide awkwardly; result is crowded | Separate components optically and create a coherent central axis |
| Medium | **Taurus**, **Gemini**, **Libra**, **Jupiter**, **Saturn**, **Neptune** | Stiff mechanical outlines or overly literal primitives | Refine weight contrast, joins, spacing and typographic rhythm |
| Medium | **Moon**, **Aries**, **Aquarius**, **Pisces**, **Uranus**, **Pluto**, **Sun**, **Venus**, **Mars**, **Sagittarius** | May be recognizable but still look like inconsistent icons rather than a designed typeface | Rebalance proportions, stroke endings, optical size, visual family consistency |

These are **design critiques** of the rejected private prototype, not permission to trace or clone the reference font. Traditional symbols may be represented through independently authored new curves.

## Corrected development methodology

1. **Stop shipping full-font batches before visual approval.** Do not rerun the current v0.1 `build_original_font.py` geometry and call it a new design. Its outlines are a rejected experiment, not an approved master.
2. Work from a **semantic/form reference sheet** for traditional Virgo, Scorpio and Capricorn first, followed by Cancer, Leo and Mercury. The old font can establish *which conventional variant* the owner wants; never extract, trace, auto-vectorize, transform, morph or reuse its contours/control points.
3. Design candidate glyphs **manually as original Bézier outlines**, with a coherent type system (contrasting thick/thin strokes where appropriate, deliberate joints, curves, terminals, optical centering). Do not use single-width buffered skeletal paths as the final design method.
4. Compare each design at **16, 24, 48 and 96 px**, on light/dark backgrounds and inside a realistic chart wheel. Do not rely on a 200 px isolated card preview.
5. Require owner review of **three difficult symbols** (Virgo, Scorpio, Capricorn) *before* producing or packaging the full set. Record each accepted symbol explicitly; absence of approval means still pending.
6. Complete the next three challenging symbols (Cancer, Leo, Mercury) only after the first style review. Then redraw the remaining 16 within the approved stroke, scale and spacing system.
7. Build TTF/WOFF2 *after* accepted outlines, run the existing technical validators, and verify at small sizes and in actual `astrological-charts` renderings.
8. Keep all private font sources/binaries outside public Git; define approved embedding and redistribution terms independently before any release or integration.

## Acceptance gates (none passed for v0.1)

- [ ] 3 difficult zodiac signs redesigned, shown together at multiple sizes, and explicitly approved by the owner
- [ ] Style/weight/terminal system agreed
- [ ] All 22 original glyph outlines individually reviewed
- [ ] Small-size and light/dark chart-wheel legibility verified
- [ ] Correct Unicode, nonempty outline and TTF/WOFF2 validator passes on **approved** new shapes
- [ ] Font origin, ownership, embedding and binary redistribution terms settled
- [ ] Downstream integration tested with rollback

## Relationship to earlier reports

The [private prototype QA](PRIVATE_PROTOTYPE_QA.md) describes the earlier **technical** validation of v0.1. Those results are historical and remain true, **but visual approval explicitly failed**. This rejection supersedes any language that suggests the earlier experiment is an acceptable font or suitable starting point.

See [font plan](VIRGOSTARS_ASTRO_FONT_PLAN.md), [iconography](VIRGOSTARS_ASTRO_ICONOGRAPHY.md), [roadmap](ROADMAP.md), and [issue #8](https://github.com/Cesare-ml/astrological-assets/issues/8). No existing third-party asset rights under [issue #2](https://github.com/Cesare-ml/astrological-assets/issues/2) are cleared by this review.
