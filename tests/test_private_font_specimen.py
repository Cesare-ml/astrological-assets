"""Offline specimen tests: synthetic squares only, never private production font data."""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

from test_private_font_validator import build_synthetic_font

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location(
    'vs_private_font_specimen', ROOT / 'scripts/create-private-font-specimen.py'
)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class PrivateSpecimenTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.work = Path(self.temp.name)
        self.font = self.work / 'synthetic.ttf'
        build_synthetic_font(self.font)
        self.out = self.work / 'review.html'
        self.spec_path = ROOT / 'specs/virgostars-astro.v0.json'

    def test_offline_html_contains_22_glyphs_all_sizes_both_themes_and_font(self):
        result = module.build_specimen(self.font, self.out, self.spec_path, ROOT)
        html = self.out.read_text(encoding='utf-8')
        self.assertEqual(result['glyphs'], 22)
        self.assertEqual(result['sizes'], [16, 20, 24, 32, 64])
        self.assertIn('Content-Security-Policy', html)
        self.assertIn("default-src 'none'", html)
        self.assertIn('data:font/ttf;base64,', html)
        self.assertIn('zodiac wheel', html)
        self.assertIn('samples-dark', html)
        self.assertIn('Virgo', html)
        self.assertIn('Scorpio', html)
        self.assertIn('Capricorn', html)
        for glyph in json.loads(self.spec_path.read_text(encoding='utf-8'))['glyphs']:
            self.assertIn(glyph['unicode'], html)
        for size in (16, 20, 24, 32, 64):
            self.assertIn(f'font-size:{size}px', html)
        self.assertNotIn('https://', html)
        self.assertNotIn('http://', html)

    def test_refuses_to_write_font_bytes_inside_public_checkout(self):
        with self.assertRaisesRegex(module.SpecimenError, 'outside the public repository'):
            module.build_specimen(self.font, ROOT / 'leak.html', self.spec_path, ROOT)
        self.assertFalse((ROOT / 'leak.html').exists())

    def test_refuses_overwrite_unless_explicit(self):
        self.out.write_text('previous', encoding='utf-8')
        with self.assertRaisesRegex(module.SpecimenError, 'already exists'):
            module.build_specimen(self.font, self.out, self.spec_path, ROOT)
        self.assertEqual(self.out.read_text(encoding='utf-8'), 'previous')
        module.build_specimen(self.font, self.out, self.spec_path, ROOT, force=True)
        self.assertIn('private glyph QA', self.out.read_text(encoding='utf-8'))

    def test_refuses_symlink_output_even_with_force(self):
        target = self.work / 'target.html'
        target.write_text('untouched', encoding='utf-8')
        self.out.symlink_to(target)
        with self.assertRaisesRegex(module.SpecimenError, 'symbolic link'):
            module.build_specimen(self.font, self.out, self.spec_path, ROOT, force=True)
        self.assertEqual(target.read_text(encoding='utf-8'), 'untouched')

    def test_rejects_font_inside_public_checkout(self):
        exposed = ROOT / 'synthetic-leak.ttf'
        exposed.write_bytes(self.font.read_bytes())
        try:
            with self.assertRaisesRegex(ValueError, 'outside this public repository'):
                module.build_specimen(exposed, self.out, self.spec_path, ROOT)
            self.assertFalse(self.out.exists())
        finally:
            exposed.unlink()


if __name__ == '__main__':
    unittest.main()
