"""Synthetic-only tests: never access or distribute the historical Astro-SemiBold font."""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[1]
module_spec = importlib.util.spec_from_file_location(
    'vs_private_font_validator', ROOT / 'scripts/validate-private-font.py'
)
module = importlib.util.module_from_spec(module_spec)
module_spec.loader.exec_module(module)
validate_font = module.validate_font
FontValidationError = module.FontValidationError
CPS = list(range(0x2648, 0x2654)) + [
    0x2609, 0x263D, 0x263F, 0x2640, 0x2642,
    0x2643, 0x2644, 0x2645, 0x2646, 0x2647,
]


def build_synthetic_font(path, corrupt=None):
    """Squares are temporary test geometry, not VirgoStars glyph designs."""
    builder = FontBuilder(1000, isTTF=True)
    names = ['.notdef'] + [f'uni{codepoint:04X}' for codepoint in CPS]
    builder.setupGlyphOrder(names)
    cmap = {cp: name for cp, name in zip(CPS, names[1:])}
    if corrupt == 'cmap':
        cmap.pop(CPS[0])
    builder.setupCharacterMap(cmap)
    glyphs = {}
    for index, name in enumerate(names):
        pen = TTGlyphPen(None)
        if index and not (corrupt == 'empty' and index == 1):
            left = 100 + index
            pen.moveTo((left, 50))
            pen.lineTo((left + 480, 50))
            pen.lineTo((left + 480, 620))
            pen.lineTo((left, 620))
            pen.closePath()
        glyphs[name] = pen.glyph()
    builder.setupGlyf(glyphs)
    builder.setupHorizontalMetrics({name: (1000, 0) for name in names})
    builder.setupHorizontalHeader(ascent=800, descent=-200)
    builder.setupNameTable({
        'familyName': 'VirgoStars Astro' if corrupt != 'family' else 'Wrong Astro',
        'styleName': 'Regular',
        'uniqueFontIdentifier': 'synthetic-validator-fixture-only',
        'fullName': 'VirgoStars Astro',
        'psName': 'VirgoStarsAstro-Regular',
        'version': 'Version 0.001',
    })
    builder.setupOS2(sTypoAscender=800, sTypoDescender=-200,
                     usWinAscent=800, usWinDescent=200)
    builder.setupPost()
    builder.setupMaxp()
    builder.save(str(path))


class PrivateFontValidationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.work = Path(self.temp.name)
        self.spec = self.work / 'spec.json'
        self.spec.write_text(json.dumps({
            'schemaVersion': 1,
            'family': 'VirgoStars Astro',
            'status': 'planning',
            'geometryIncluded': False,
            'metrics': {'unitsPerEm': 1000, 'ascender': 800, 'descender': -200},
            'glyphs': [
                {
                    'unicode': f'U+{cp:04X}',
                    'character': chr(cp),
                    'category': 'zodiac' if index < 12 else 'body',
                }
                for index, cp in enumerate(CPS)
            ],
        }), encoding='utf-8')
        self.public_repo = self.work / 'public_repo'
        self.public_repo.mkdir()

    def font(self, variant=None):
        path = self.work / 'synthetic.ttf'
        build_synthetic_font(path, variant)
        return path

    def test_accepts_synthetic_22_symbol_ttf(self):
        summary = validate_font(self.font(), self.spec, self.public_repo)
        self.assertEqual(summary['verifiedGlyphs'], 22)
        self.assertEqual(summary['zodiac'], 12)
        self.assertEqual(summary['bodies'], 10)
        self.assertFalse(summary['fontLicenseReviewed'])

    def test_accepts_synthetic_woff2(self):
        source = self.font()
        font = TTFont(source)
        font.flavor = 'woff2'
        target = self.work / 'synthetic.woff2'
        font.save(target)
        font.close()
        self.assertEqual(validate_font(target, self.spec, self.public_repo)['format'], 'woff2')

    def test_rejects_missing_character(self):
        with self.assertRaisesRegex(FontValidationError, 'Incorrect cmap'):
            validate_font(self.font('cmap'), self.spec, self.public_repo)

    def test_rejects_empty_outline(self):
        with self.assertRaisesRegex(FontValidationError, 'Empty/flat'):
            validate_font(self.font('empty'), self.spec, self.public_repo)

    def test_rejects_wrong_font_family(self):
        with self.assertRaisesRegex(FontValidationError, 'Expected font family'):
            validate_font(self.font('family'), self.spec, self.public_repo)

    def test_rejects_modified_planning_unicode(self):
        spec = json.loads(self.spec.read_text(encoding='utf-8'))
        spec['glyphs'][0]['unicode'] = 'U+0041'
        spec['glyphs'][0]['character'] = 'A'
        self.spec.write_text(json.dumps(spec), encoding='utf-8')
        with self.assertRaisesRegex(FontValidationError, 'Invalid codepoint/character specification'):
            validate_font(self.font(), self.spec, self.public_repo)

    def test_rejects_font_inside_public_checkout(self):
        source = self.font()
        exposed = self.public_repo / 'must-not-be-published.ttf'
        exposed.write_bytes(source.read_bytes())
        with self.assertRaisesRegex(FontValidationError, 'outside this public repository'):
            validate_font(exposed, self.spec, self.public_repo)


if __name__ == '__main__':
    unittest.main()
