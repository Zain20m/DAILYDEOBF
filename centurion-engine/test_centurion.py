import os
import tempfile
import threading
import time
import unittest
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

import centurion


class CenturionRegressionTests(unittest.TestCase):
    def fingerprint_for(self, source):
        with tempfile.TemporaryDirectory(prefix="centurion-test-") as directory:
            sample = Path(directory) / "sample.lua"
            sample.write_text(source, encoding="latin-1")
            return centurion.fingerprint(str(sample))

    def test_v61_is_detected_by_exact_version_tag(self):
        result = self.fingerprint_for("-- Centurion v6.1\n")
        self.assertEqual(result["route"], "v6.1-sandbox")

    def test_other_v6_minor_versions_are_not_mislabelled_v61(self):
        result = self.fingerprint_for("-- Centurion v6.2\n")
        self.assertEqual(result["route"], "unknown")

    def test_v6_static_shape_is_detected(self):
        factories = "\n".join(
            "c3[%d]=function(Z) return Z end" % index
            for index in range(51)
        )
        result = self.fingerprint_for("-- Centurion v6\n" + factories)
        self.assertEqual(result["route"], "v6-static")

    def test_v6_returned_table_layout_is_detected(self):
        source = """-- This file was obfuscated using Centurion v6
return({getfenv(),function(a) return a end,function(b) return b end})
"""
        result = self.fingerprint_for(source)
        self.assertEqual(result["route"], "v6-static-return-table")
        self.assertTrue(result["returned_table"])
        self.assertGreater(result["inline_functions"], 0)

    def test_v60_tag_is_supported_for_returned_table_layout(self):
        source = "-- Centurion v6.0\nreturn({getfenv(),function(a) return a end})"
        result = self.fingerprint_for(source)
        self.assertEqual(result["route"], "v6-static-return-table")

    def test_returned_table_function_spans_are_harvested(self):
        function_one = {"type": "AstExprFunction", "location": "1, 10 - 1, 25"}
        function_two = {"type": "AstExprFunction", "location": "1, 30 - 1, 45"}
        ast = {
            "type": "AstStatBlock",
            "body": [{
                "type": "AstStatReturn",
                "list": [{
                    "type": "AstExprGroup",
                    "expression": {
                        "type": "AstExprTable",
                        "items": [
                            {"type": "AstExprTableItem", "value": {"type": "AstExprCall"}},
                            {"type": "AstExprTableItem", "value": function_one},
                            {"type": "AstExprTableItem", "value": function_two},
                        ],
                    },
                }],
            }],
        }
        with patch.object(centurion, "parse_ast", return_value=ast):
            spans = centurion.harvest_return_table_spans_ast("x" * 60)
        self.assertEqual(spans, [(2, 10, 25), (3, 30, 45)])

    def test_returned_table_harvest_unwraps_function_values(self):
        wrapped_function = {
            "type": "AstExprGroup",
            "expression": {
                "type": "AstExprTypeAssertion",
                "expression": {"type": "AstExprFunction", "location": "1, 20 - 1, 40"},
            },
        }
        ast = {
            "type": "AstStatBlock",
            "body": [{
                "type": "AstStatReturn",
                "list": [{
                    "type": "AstExprGroup",
                    "expression": {
                        "type": "AstExprTable",
                        "items": [
                            {"type": "AstExprTableItem", "value": wrapped_function},
                        ],
                    },
                }],
            }],
        }
        with patch.object(centurion, "parse_ast", return_value=ast):
            spans = centurion.harvest_return_table_spans_ast("x" * 60)
        self.assertEqual(spans, [(1, 20, 40)])

    def test_v6_tag_does_not_require_large_hardcoded_counts(self):
        source = "-- Centurion v6\nc3[1] = function ( Z ) return Z end\n"
        result = self.fingerprint_for(source)
        self.assertEqual(result["route"], "v6-static")

    def test_v6_structural_fallback_allows_whitespace_and_missing_tag(self):
        factories = "\n".join(
            "c3 [%d] = function ( Z ) return Z end" % index
            for index in range(8)
        )
        result = self.fingerprint_for(factories)
        self.assertEqual(result["route"], "v6-static")

    def test_fingerprint_explains_unknown_route(self):
        result = self.fingerprint_for("local ordinary = true\n")
        self.assertEqual(result["route"], "unknown")
        self.assertIn("route_reason", result)

    def test_escape_decoder_does_not_modify_comments_or_long_strings(self):
        source = r'''local a = "\x41"
-- keep "\x42" in this comment
local b = [==["\x43"]==]
'''
        expected = '''local a = "A"
-- keep "\\x42" in this comment
local b = [==["\\x43"]==]
'''
        self.assertEqual(centurion.clean_escapes(source), expected)

    def test_concurrent_ast_runs_use_distinct_temporary_files(self):
        captured = []
        lock = threading.Lock()
        samples = [
            "local marker = 'sample-%d'" % index
            for index in range(8)
        ]

        def fake_run(arguments, **_kwargs):
            temporary_path = arguments[1]
            time.sleep(0.02)
            contents = Path(temporary_path).read_text(encoding="latin-1")
            with lock:
                captured.append((temporary_path, contents))
            return SimpleNamespace(stdout=b"{}", stderr=b"")

        with patch.object(centurion, "find_luau_ast", return_value="luau-ast"):
            with patch.object(centurion.subprocess, "run", side_effect=fake_run):
                with ThreadPoolExecutor(max_workers=8) as executor:
                    outputs = list(executor.map(
                        lambda source: centurion.harvest_table_spans_ast(source, "c3"),
                        samples,
                    ))

        self.assertEqual(outputs, [[] for _ in samples])
        paths = [item[0] for item in captured]
        contents = [item[1] for item in captured]
        self.assertEqual(len(set(paths)), len(samples))
        self.assertCountEqual(contents, samples)
        self.assertTrue(all(not os.path.exists(path) for path in paths))


if __name__ == "__main__":
    unittest.main()
