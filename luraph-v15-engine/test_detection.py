import unittest

from obfuscators import detect


class LuraphV15EngineDetectionTests(unittest.TestCase):
    def test_luraph_v15_family_header_routes_to_v15_plugin(self):
        source = (
            "-- This file was protected using Luraph Obfuscator v15.1 "
            "[https://lura.ph/]\nreturn setmetatable({}, {})"
        )
        plugin, confidence = detect(source)
        self.assertEqual(plugin.name, "luraph_v15")
        self.assertEqual(confidence, 1.0)

    def test_headerless_luraph_vm_shape_routes_to_v15_plugin(self):
        source = "return setmetatable({[75]=bit32.rrotate}, {})"
        plugin, confidence = detect(source)
        self.assertEqual(plugin.name, "luraph_v15")
        self.assertGreaterEqual(confidence, 0.8)

    def test_ironbrew_banner_routes_to_ironbrew_plugin(self):
        plugin, confidence = detect("-- this file was generated using ironbrew1\nreturn(function(...) end)")
        self.assertEqual(plugin.name, "ironbrew1")
        self.assertEqual(confidence, 1.0)

    def test_v14_banner_does_not_get_misclassified_as_v15(self):
        plugin, _ = detect(
            "-- This file was protected using Luraph Obfuscator v14.9 [https://lura.ph/]"
        )
        self.assertEqual(plugin.name, "generic")

    def test_unknown_source_uses_explicit_generic_fallback(self):
        plugin, _ = detect("local answer = 42\nreturn answer")
        self.assertEqual(plugin.name, "generic")


if __name__ == "__main__":
    unittest.main()
