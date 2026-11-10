import unittest

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

    def test_ambiguous_headerless_return_table_requires_explicit_engine(self):
        self.assertIsNone(detect_version("return({[1] = bit32.bxor})"))


if __name__ == "__main__":
    unittest.main()
