#!/usr/bin/env python3
"""Generate an offline visual QA page for a privately owned VirgoStars Astro font.

The source font and the generated HTML (which embeds its bytes) MUST remain
outside the public astrological-assets checkout. Nothing is uploaded or served.
"""
from __future__ import annotations

import argparse
import base64
from html import escape
import importlib.util
import json
import math
from pathlib import Path
import sys


class SpecimenError(ValueError):
    """Unsafe path or invalid preview request."""


def _load_validator(repo_root: Path):
    source = repo_root / 'scripts' / 'validate-private-font.py'
    module_spec = importlib.util.spec_from_file_location('vs_private_font_validation', source)
    if module_spec is None or module_spec.loader is None:
        raise SpecimenError('Cannot load private-font validator')
    module = importlib.util.module_from_spec(module_spec)
    module_spec.loader.exec_module(module)
    return module


def _assert_private_output(path: Path, repo_root: Path, force: bool) -> Path:
    if path.suffix.lower() != '.html':
        raise SpecimenError('Output filename must end with .html')
    if path.is_symlink():
        raise SpecimenError('Output may not be a symbolic link')
    # Require an existing, resolved parent so symlinks cannot lead into Git.
    parent = path.parent.resolve(strict=True)
    destination = parent / path.name
    if destination.is_relative_to(repo_root):
        raise SpecimenError('HTML containing private font bytes must remain outside the public repository')
    if destination.exists() and not force:
        raise SpecimenError('Output already exists; use --force to replace an existing private specimen')
    return destination


def _wheel(glyphs: list[dict], theme: str) -> str:
    markers = []
    for index, g in enumerate(glyphs):
        angle = math.radians(index * 30 - 90)
        x = 50 + 38 * math.cos(angle)
        y = 50 + 38 * math.sin(angle)
        name = escape(g['name'], quote=True)
        character = escape(g['character'])
        markers.append(
            f'<span class="wheel-symbol astro-font" title="{name}" '
            f'style="left:{x:.3f}%;top:{y:.3f}%">{character}</span>'
        )
    return f'<div class="wheel {theme}" role="img" aria-label="{theme} zodiac wheel">' + ''.join(markers) + '</div>'


def _glyph_card(g: dict) -> str:
    name = escape(g['name'])
    code = escape(g['unicode'])
    symbol = escape(g['character'])
    samples = ''.join(
        f'<span class="sample"><span class="astro-font" style="font-size:{size}px" '
        f'aria-label="{name} at {size} pixels">{symbol}</span>'
        f'<small>{size}px</small></span>'
        for size in (16, 20, 24, 32, 64)
    )
    return f'<article class="glyph"><div class="glyph-name">{name} <code>{code}</code></div><div class="sizes">{samples}</div></article>'


def build_specimen(font_path: Path, output_path: Path, spec_path: Path, repo_root: Path, *, force: bool = False) -> dict:
    """Validate private TTF/WOFF2 and write an offline HTML specimen, outside Git."""
    repo_root = repo_root.resolve(strict=True)
    output = _assert_private_output(output_path, repo_root, force)
    validator = _load_validator(repo_root)
    result = validator.validate_font(font_path, spec_path, repo_root)
    font_path = font_path.resolve(strict=True)
    # Inlining avoids file:// CORS and makes the preview fully offline, but the
    # output now contains the whole proprietary font and must remain private.
    encoded_font = base64.b64encode(font_path.read_bytes()).decode('ascii')
    mime = 'font/woff2' if font_path.suffix.lower() == '.woff2' else 'font/ttf'
    spec = json.loads(spec_path.read_text(encoding='utf-8'))
    glyphs = spec['glyphs']
    zodiac = [g for g in glyphs if g['category'] == 'zodiac']
    bodies = [g for g in glyphs if g['category'] == 'body']
    cards = ''.join(_glyph_card(g) for g in glyphs)
    wheels = _wheel(zodiac, 'light') + _wheel(zodiac, 'dark')
    body_row = ''.join(
        f'<span class="body astro-font" title="{escape(g["name"], quote=True)}">'
        f'{escape(g["character"])}</span>' for g in bodies
    )
    html = f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; font-src data:; img-src data:">
<title>VirgoStars Astro — private visual QA (NOT FOR DISTRIBUTION)</title>
<style>
@font-face {{ font-family:'VirgoStars Astro QA'; src:url(data:{mime};base64,{encoded_font}) format('{ 'woff2' if mime == 'font/woff2' else 'truetype' }'); font-display:block; }}
* {{ box-sizing:border-box; }}
body {{ margin:0; padding:24px; background:#e8edf5; color:#142337; font:15px system-ui,sans-serif; }}
h1 {{ margin:0 0 8px; }}
p {{ max-width:70ch; line-height:1.5; }}
.astro-font {{ font-family:'VirgoStars Astro QA' !important; font-weight:normal; font-style:normal; }}
.grid {{ display:grid; grid-template-columns:repeat(auto-fit,minmax(260px,1fr)); gap:12px; }}
.glyph {{ background:white; padding:12px; border:1px solid #b8c6d7; border-radius:8px; min-width:0; }}
.glyph-name {{ font-weight:600; display:flex; justify-content:space-between; }}
code {{ font-weight:400; font-size:12px; }}
.sizes {{ display:flex; flex-wrap:wrap; gap:12px; align-items:end; padding-top:8px; }}
.sample {{ display:flex; flex-direction:column; align-items:center; min-width:30px; }}
.sample small {{ font:11px system-ui,sans-serif; margin-top:6px; }}
.samples-dark {{ background:#0f1e31; color:#f4f6ff; padding:16px; border-radius:10px; margin:20px 0; }}
.samples-dark .glyph {{ background:#162942; color:#f4f6ff; border-color:#52647b; }}
.wheels {{ display:flex; flex-wrap:wrap; gap:24px; margin:20px 0; }}
.wheel {{ width:min(360px,100%); aspect-ratio:1; position:relative; border-radius:50%; border:2px solid currentColor; flex:none;
  background:repeating-conic-gradient(from -15deg,transparent 0deg 29.7deg,currentColor 29.7deg 30deg); }}
.wheel::after {{ content:''; position:absolute; inset:23%; border:1px solid currentColor; border-radius:50%; }}
.wheel.light {{ color:#213752; background-color:#fafbfd; }}
.wheel.dark {{ color:#f1f4ff; background-color:#142338; }}
.wheel-symbol {{ position:absolute; transform:translate(-50%,-50%); font-size:24px; line-height:1; z-index:1;
  border-radius:50%; padding:3px; }}
.wheel.light .wheel-symbol {{ background:#fafbfd; }}
.wheel.dark .wheel-symbol {{ background:#142338; }}
.body-strip {{ display:flex; flex-wrap:wrap; gap:20px; padding:16px; border:1px solid currentColor; border-radius:8px; }}
.body {{ font-size:24px; line-height:1.4; }}
@media print {{ body {{ background:white; }} .glyph {{ break-inside:avoid; }} }}
</style></head>
<body>
<h1>VirgoStars Astro · private glyph QA</h1>
<p><strong>CONFIDENTIAL:</strong> This HTML contains the entire private font in a data URI. Keep this file outside public repositories, issue attachments and shared websites. Visual inspection is manual; this page does not prove licensing or production readiness.</p>
<h2>All 22 glyphs · light · 16 / 20 / 24 / 32 / 64 px</h2>
<section class="grid">{cards}</section>
<h2>All 22 glyphs · dark · 16 / 20 / 24 / 32 / 64 px</h2>
<section class="samples-dark"><div class="grid">{cards}</div></section>
<h2>Zodiac chart context · 24 px</h2>
<section class="wheels">{wheels}</section>
<h2>Planetary bodies · 24 px</h2>
<section class="samples-dark"><div class="body-strip">{body_row}</div></section>
<p>Inspect tails and joins (Virgo, Scorpio, Capricorn), optical centering, symbol collisions, strokes at 16 px, color parity, and fallback/export behavior in the actual chart renderer separately.</p>
</body></html>'''
    with output.open('w' if force else 'x', encoding='utf-8') as handle:
        handle.write(html)
    output.chmod(0o600)
    return {'output': str(output), 'glyphs': result['verifiedGlyphs'], 'sizes': [16, 20, 24, 32, 64],
            'themes': ['light', 'dark'], 'privateFontEmbedded': True,
            'note': 'Manual visual QA only; confidential HTML, no redistribution authorization.'}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--font', type=Path, required=True, help='Private TTF/WOFF2 outside this checkout')
    parser.add_argument('--out', type=Path, required=True, help='Private output .html outside this checkout')
    parser.add_argument('--spec', type=Path, default=Path(__file__).resolve().parents[1] / 'specs/virgostars-astro.v0.json')
    parser.add_argument('--force', action='store_true', help='Replace an existing non-symlink private HTML')
    args = parser.parse_args()
    try:
        result = build_specimen(args.font, args.out, args.spec, Path(__file__).resolve().parents[1], force=args.force)
    except (SpecimenError, OSError, ValueError, KeyError) as exc:
        print('PRIVATE SPECIMEN ERROR: ' + str(exc), file=sys.stderr)
        return 2
    print(json.dumps(result, indent=2))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
