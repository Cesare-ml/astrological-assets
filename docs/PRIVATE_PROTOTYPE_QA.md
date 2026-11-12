# VirgoStars Astro — privately generated v0.1 prototype QA

**Status: private working prototype exists; NOT approved, released or committed to GitHub.**

The project owner requested concrete progress toward a VirgoStars-owned font that contains only the 12 zodiac signs and 10 primary celestial bodies. A **local-only geometric prototype** was created on 2026-11-12, without using outlines or source data from the owner-supplied historical `ASTRO-SE.TTF`.

## Prototype delivered privately to owner

The model authored an independent parametric vector source with traditional astrological component compositions: curves, arcs, circles and polygon strokes. This is a **new experimental drawing**, not a font generated from, converted from, traced from or derived by modifying Astro-SemiBold font data.

The owner received the prototype files privately in the conversation, not from GitHub. The actual original source, build outputs and PNG specimens remain outside this public repository.

| Artifact | Private result |
| --- | --- |
| Prototype family | `VirgoStars Astro` |
| Planned Unicode glyphs implemented | **22/22** |
| Formats generated | TTF and WOFF2 |
| Font units per em | 1000 |
| Hhea ascent / descent | +800 / -200 |
| Additional supported character | U+0020 space; plus required `.notdef` |
| Old ASCII font aliases | **None** |
| Proprietary source/binaries committed to Git | **None** |
| Technical rights certification | **Not performed** |
| Production adoption | **Not authorized** |

### Private prototype artifact fingerprints

These hashes are reference identifiers only and **do not authorize distribution** of the corresponding font files:

- `VirgoStarsAstro-Prototype.ttf` SHA-256: `c99a08240d728287f49ebd6499cb4e54ba6c745eb27fc5581d79d2c8016c8502` **(earlier intermediate draft; superseded)**
- **Current local prototype v0.1**: use the SHA-256 values from the owner's private package `build/build-report.json`. Do **not** assume the intermediate hash above identifies the final private artifact.

## Actual technical validation

- A local read-only fontTools validator accepted **both the final private TTF and WOFF2**, with 22 distinct Unicode glyph mappings, nonempty outlines, expected name and metric tables, and expected optional space.
- Seven synthetic validator regression tests were also executed locally and passed. Their fixtures are synthetic test data, not source glyphs for the real font.
- Light and dark specimen sheets were rendered to inspect legibility. This is **exploratory visual QA** and is not an approved baseline.
- No full browser integration, font origin legal audit, production chart tests or release tests have been completed.

## Required design review — still open

- [ ] Obtain **owner visual approval** of the initial 22 glyphs against the **traditional iconographic variants** identified in [iconography](VIRGOSTARS_ASTRO_ICONOGRAPHY.md). Review conventional identity, not contour similarity to the old font.
- [ ] Refine geometric details and optical balance of **Virgo, Scorpio, Capricorn, Cancer and Leo**, as needed. Confirm Uranus's H-and-circle and Pluto's circle–crescent–cross forms remain legible.
- [ ] Test at **16, 20, 24, 32, 64 px**, especially in dense natal/transit chart contexts, before declaring visual readiness.
- [ ] Keep author/provenance documentation with the privately maintained geometry and record who approves it.
- [ ] Decide and approve ownership and the **explicit proprietary embedding/bundling/redistribution license** before publishing the TTF/WOFF2 or including it in an open-source client.
- [ ] Test glyph fallback, browser cache, export and light/dark variants with a separate reversible consumer integration.
- [ ] Continue the independent existing-image rights audit in [issue #2](https://github.com/Cesare-ml/astrological-assets/issues/2).

## What is NOT completed

The **F1 original glyph design milestone is not complete**: although a functioning private prototype exists, it still requires visual signoff, possible redesign, final authorship/licensing approval and real downstream validation. The presence of a private prototype is **not a reason to mark F1 done** or to publish unreviewed proprietary font binaries.

See [roadmap](ROADMAP.md), [font plan](VIRGOSTARS_ASTRO_FONT_PLAN.md), [private font validation](PRIVATE_FONT_VALIDATION.md) and [issue #8](https://github.com/Cesare-ml/astrological-assets/issues/8).
