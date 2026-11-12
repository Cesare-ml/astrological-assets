# Roadmap and development backlog

This roadmap describes the current development priorities of **Astrological Assets**, the public asset repository used by the VirgoStars ecosystem. It is **not** a statement that all published image files have completed third-party licensing review.

## Priority overview

| Priority | Workstream | Status | Tracking |
| --- | --- | --- | --- |
| P0 | Audit the rights of existing public artwork, including its legacy glyph sources, and inspect public Git history | **Open / blocking full pack clearance** | [#2](https://github.com/Cesare-ml/astrological-assets/issues/2) |
| P1 | Design and build **VirgoStars Astro**, a new font owned by VirgoStars for zodiac signs and planetary bodies | **Planned / design specified** | [#8](https://github.com/Cesare-ml/astrological-assets/issues/8) |
| P1 | Verify canonical asset manifest, renderer compatibility and build-output collisions | **Existing tools; full production integration pending** | [migration plan](MIGRATION_PLAN.md) |
| P2 | Ship independent, tested integration with the VirgoStars web and Desktop clients | **Pending separate integration PRs** | [ecosystem contract](ECOSYSTEM_COORDINATION.md) |
| P2 | Review an independently pinned, offline Astrolabio asset subset | **Pending hardware tests** | [migration plan](MIGRATION_PLAN.md) |

Priority 1 work is **not** permission to bypass Priority 0 rights checks. The project owner selected **CC BY 4.0** for their own original image contributions, while the tools and source documentation use **CPAL-1.0**. A separate future font license and permission to bundle a font with open-source clients must be selected explicitly.

## P1 — VirgoStars Astro: new original font

**Tracking:** [Issue #8 — Build VirgoStars Astro](https://github.com/Cesare-ml/astrological-assets/issues/8)  
**Specification:** [font plan](VIRGOSTARS_ASTRO_FONT_PLAN.md) and [symbol mapping and iconography](VIRGOSTARS_ASTRO_ICONOGRAPHY.md)  
**Current phase:** planning. No new font binaries or independently constructed contours have been completed.

The owner specifically wants the **traditional iconographic symbol variants appearing in Astro-SemiBold** (`ASTRO-SE.TTF`), not only a similar font weight. Use these traditional forms to define **which components a symbol contains**, not to copy the old font's actual glyph geometry.

### Milestone F0 — Originality and technical baseline

- [x] Implement the **planning-only Unicode registry** (`specs/virgostars-astro.v0.json`) and offline validator (`npm run check:astro-spec`) with regression tests. The registry defines identity/variant metadata, **not drawings**, and does not constitute author approval or full F0 completion.

- [ ] Freeze a reviewed **22-glyph** Unicode map: 12 zodiac signs (U+2648–U+2653); Sun, Moon, Mercury, Venus, Mars, Jupiter, Saturn, Uranus, Neptune and Pluto.
- [ ] Record the legacy *reference* mapping (Astro-SemiBold uppercase `A–L` and `Q–Z`) for human comparison only; never make ASCII letters the new production code points.
- [ ] Specify an independent, reproducible design system: 1,000 units/em, proportions, optical stroke weight, metrics, baseline and SVG outline conventions.
- [ ] Record authorship and provenance for every original vector symbol; do **not** extract, convert, trace or adapt Astro-SemiBold font outlines or their bitmaps.
- [ ] Select an appropriate **private working location** for draft/source font files, since the current public repository is not an approved location for unpublished proprietary font sources.

**Done when:** 22-icon plan, metrics and original source provenance are reviewed; no third-party font files have been committed.

### Milestone F1 — 22 original glyphs and font generation

**Private MVP checkpoint (2026-11-12):** The independent 22-glyph geometric prototype passed TTF/WOFF2 technical checks but **was explicitly rejected by the owner for inadequate visual quality**. Its outlines are not an approved master, and F1 remains blocked. See [the rejection and redesigned process](PROTO_V01_VISUAL_REJECTION.md) and [technical QA history](PRIVATE_PROTOTYPE_QA.md).

- [x] Provide a **read-only TTF/WOFF2 QA tool** for future independently authored font files (`scripts/validate-private-font.py`) with synthetic-only regression tests; no glyph outlines or font binaries are released. See [private font validation](PRIVATE_FONT_VALIDATION.md).

- [ ] Independently draw the zodiac symbols and celestial bodies using traditional component arrangements from the approved iconography specification.
- [ ] Preserve the owner's preferred traditional forms, especially Uranus **H-with-circle** and Pluto **circle–crescent–cross**, without reusing the reference font's vectors.
- [ ] Define canonical Unicode `cmap` entries and valid OpenType naming/metrics; test all symbols and missing glyph fallback.
- [ ] Build **TTF** and **WOFF2** reproducibly from the same newly created vectors and record file checksums.
- [ ] Decide copyright, the proprietary font license and precise bundling, embedding, caching, installation and redistribution permissions **before publishing the font**.

**Done when:** original sources, reproducible binaries and font validator results are documented, with explicit rights/embedding permission.

### Milestone F2 — Visual and accessibility quality

- [ ] Compare legibility at 16, 20, 24, 32 and 64 pixels and in high-DPI/PNG/SVG exports.
- [ ] Verify alignment, glyph bounds and visual consistency between zodiac and planetary families.
- [ ] Test light/dark palettes using the **same** outline set and CSS-driven colors.
- [ ] Provide accessible sign/body names in the user interface rather than relying on decorative glyphs.

**Done when:** reference samples and visual regression results demonstrate readable, original symbols at all target sizes.

### Milestone F3 — Downstream integration and migration

- [ ] Prototype the font in [astrological-charts](https://github.com/Cesare-ml/astrological-charts) behind a configurable, reversible feature flag or isolated development branch.
- [ ] Use **Unicode** glyph lookup and preserve natal/transit chart object IDs, selection, hover and aspect event behavior.
- [ ] Validate fallback for missing/unavailable font files and export to PNG/JPEG/SVG as supported by the renderer.
- [ ] Review bundling/redistribution permissions for the open-source VirgoStars Desktop and website releases.
- [ ] Prepare an explicit migration plan for existing raster symbols and keep old asset paths stable until consumer tests pass.
- [ ] Do not assume replacing runtime glyphs retrospectively resolves any legacy font-derived raster artwork rights tracked in issue #2.

**Done when:** chart and Desktop/frontend consumers pass their own tests, licensing terms are approved, and production rollout/rollback are separately authorized.

## Maintenance rules

- Keep GitHub issues and milestone checkboxes synchronized; do not mark a task completed solely because it appears in a document.
- For major scope changes, update [the font specification](VIRGOSTARS_ASTRO_FONT_PLAN.md), [iconography](VIRGOSTARS_ASTRO_ICONOGRAPHY.md) and [ecosystem coordination](ECOSYSTEM_COORDINATION.md) together.
- Keep the original `ASTRO-SE.TTF` **outside** public Git history. Its identity and provenance research are documented in [font research](FONT_RIGHTS_RESEARCH.md).
- Use branches and reviewed PRs; no GitHub Actions, automatic production deploys, or unapproved main-branch merges.
