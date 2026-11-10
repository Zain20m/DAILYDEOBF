import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from cli import detect_version


class LuraphV14DetectionTests(unittest.TestCase):
    def test_exact_supported_headers(self):
        for version in ("14.7", "14.8", "14.9"):
            with self.subTest(version=version):
                source = (
                    "-- This file was protected using Luraph Obfuscator v"
                    + version
                    + " [https://lura.ph/]\nreturn({})"
                )
                self.assertEqual(detect_version(source), version)

    def test_does_not_claim_other_minor_versions(self):
        self.assertIsNone(detect_version(
            "-- This file was protected using Luraph Obfuscator v14.10 [https://lura.ph/]"
        ))
        self.assertIsNone(detect_version(
            "-- This file was protected using Luraph Obfuscator v15.1 [https://lura.ph/]"
        ))

    def test_headerless_v14_8_initializer_shape(self):
        self.assertEqual(
            detect_version("local init = (function(...)\nreturn({})"),
            "14.8",
        )

    def test_ambiguous_cli_error_lists_all_supported_versions(self):
        cli = Path(__file__).resolve().parent / "cli.py"
        with tempfile.TemporaryDirectory(prefix="v14-detect-") as directory:
            source = Path(directory) / "ambiguous.lua"
            source.write_text("return({[1] = bit32.bxor})", encoding="utf-8")
            result = subprocess.run(
                [sys.executable, str(cli), str(source)],
                capture_output=True,
                text=True,
                check=False,
            )
        self.assertEqual(result.returncode, 2)
        self.assertIn("v14.7, v14.8, or v14.9", result.stderr)
        self.assertIn("--engine 14.9", result.stderr)

    def test_ambiguous_headerless_return_table_requires_explicit_engine(self):
        self.assertIsNone(detect_version("return({[1] = bit32.bxor})"))


if __name__ == "__main__":
    unittest.main()
