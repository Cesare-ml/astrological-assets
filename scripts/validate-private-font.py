#!/usr/bin/env python3
"""Read-only verification of a privately built VirgoStars Astro font.

Never embeds, copies or modifies the font. Requires fontTools (brotli for WOFF2).
The future font must be built from independently authored outlines.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys

try:
    from fontTools.pens.boundsPen import BoundsPen
    from fontTools.ttLib import TTFont
except ImportError as exc:
    raise SystemExit('Install the validation-only dependency: python -m pip install "fonttools[woff]"') from exc


class FontValidationError(ValueError):
    """Font does not satisfy the documented original VirgoStars Astro contract."""


def validate_font(font_path: Path, spec_path: Path, public_repo_root: Path) -> dict:
    font_path = font_path.resolve(strict=True)
    spec_path = spec_path.resolve(strict=True)
    public_repo_root = public_repo_root.resolve(strict=True)
    if font_path.is_relative_to(public_repo_root):
        raise FontValidationError('Proprietary font binaries must remain outside this public repository')
    if font_path.suffix.lower() not in ('.ttf', '.woff2'):
        raise FontValidationError('Expected an independently authored TTF or WOFF2 file')

    spec = json.loads(spec_path.read_text(encoding='utf-8'))
    if spec.get('schemaVersion') != 1 or spec.get('family') != 'VirgoStars Astro':
        raise FontValidationError('Unsupported VirgoStars Astro specification')
    if spec.get('status') != 'planning' or spec.get('geometryIncluded') is not False:
        raise FontValidationError('The public specification must stay geometry-free and in planning status')
    expected_codepoints = set(range(0x2648, 0x2654)) | {
        0x2609, 0x263D, 0x263F, 0x2640, 0x2642, 0x2643,
        0x2644, 0x2645, 0x2646, 0x2647,
    }
    planned = spec.get('glyphs')
    if not isinstance(planned, list) or len(planned) != 22:
        raise FontValidationError('Exactly 22 planned Unicode glyphs are required')
    try:
        codepoints = {int(g['unicode'].removeprefix('U+'), 16) for g in planned}
        if codepoints != expected_codepoints or any(chr(int(g['unicode'][2:], 16)) != g['character'] for g in planned):
            raise ValueError('Glyph codepoint/character mismatch')
    except (KeyError, ValueError, TypeError) as exc:
        raise FontValidationError('Invalid codepoint/character specification') from exc

    try:
        font = TTFont(font_path, lazy=False, recalcBBoxes=False)
    except Exception as exc:
        raise FontValidationError('Unable to parse font: ' + str(exc)) from exc
    try:
        required_tables = ('head', 'hhea', 'hmtx', 'maxp', 'cmap', 'name', 'OS/2')
        missing = [name for name in required_tables if name not in font]
        if missing:
            raise FontValidationError('Missing OpenType tables: ' + ', '.join(missing))

        family = font['name'].getDebugName(1)
        if family != 'VirgoStars Astro':
            raise FontValidationError(f'Expected font family VirgoStars Astro, got {family!r}')
        if font['head'].unitsPerEm != spec['metrics']['unitsPerEm']:
            raise FontValidationError('Unexpected units per em')
        if (font['hhea'].ascent, font['hhea'].descent) != (
            spec['metrics']['ascender'], spec['metrics']['descender']
        ):
            raise FontValidationError('Unexpected ascent or descent')
        if font['maxp'].numGlyphs < 23 or '.notdef' not in font.getGlyphOrder():
            raise FontValidationError('Missing .notdef or insufficient glyph slots')

        cmap = font.getBestCmap()
        if not cmap:
            raise FontValidationError('No Unicode cmap present')
        actual = set(cmap)
        extra = actual - codepoints - {0x20}
        missing = codepoints - actual
        if extra or missing:
            fmt = lambda values: ', '.join('U+%04X' % c for c in sorted(values)[:12])
            raise FontValidationError(
                'Incorrect cmap; missing: [' + fmt(missing) + '], unexpected: [' + fmt(extra) + ']'
            )
        glyph_names = [cmap[cp] for cp in sorted(codepoints)]
        if '.notdef' in glyph_names or len(set(glyph_names)) != 22:
            raise FontValidationError('Each Unicode character must resolve to a distinct non-.notdef glyph')
        glyph_set = font.getGlyphSet()
        empty = []
        for cp in sorted(codepoints):
            glyph_name = cmap[cp]
            if glyph_name not in glyph_set:
                raise FontValidationError('Missing glyph outline: ' + glyph_name)
            pen = BoundsPen(glyph_set)
            glyph_set[glyph_name].draw(pen)
            bounds = pen.bounds
            if bounds is None or bounds[2] <= bounds[0] or bounds[3] <= bounds[1]:
                empty.append('U+%04X' % cp)
            width = font['hmtx'].metrics[glyph_name][0]
            if not 0 < width <= 2 * spec['metrics']['unitsPerEm']:
                raise FontValidationError('Unexpected advance width for ' + glyph_name)
        if empty:
            raise FontValidationError('Empty/flat outlines: ' + ', '.join(empty))

        fs_type = font['OS/2'].fsType
        if fs_type & 0x0002:
            raise FontValidationError('Font has restricted-license embedding flag (OS/2.fsType bit 1)')
        return {
            'family': family,
            'format': font_path.suffix.lower().lstrip('.'),
            'unitsPerEm': font['head'].unitsPerEm,
            'zodiac': sum(g['category'] == 'zodiac' for g in planned),
            'bodies': sum(g['category'] == 'body' for g in planned),
            'verifiedGlyphs': len(codepoints),
            'optionalSpace': 0x20 in cmap,
            'embeddingFlags': fs_type,
            'fontLicenseReviewed': False,
            'note': 'Technical validation only. Does not prove authorship, licensing or permission to publish.',
        }
    finally:
        font.close()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--font', required=True, type=Path, help='Private TTF or WOFF2 file OUTSIDE public repo')
    parser.add_argument('--spec', type=Path, default=Path(__file__).resolve().parents[1] / 'specs/virgostars-astro.v0.json')
    args = parser.parse_args()
    try:
        result = validate_font(args.font, args.spec, Path(__file__).resolve().parents[1])
    except (FontValidationError, OSError, KeyError) as exc:
        print('PRIVATE FONT VALIDATION ERROR: ' + str(exc), file=sys.stderr)
        return 2
    print(json.dumps(result, indent=2))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
