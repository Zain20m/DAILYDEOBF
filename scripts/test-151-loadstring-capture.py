#!/usr/bin/env python3
"""Regression checks for the integrated Luraph 15.1 child-loadstring capture path.

The uploaded 15.1 engine captures large child scripts through E.loadstring and
emits them as segmented CHUNK/CHUNKDATA records. This intentionally tests that
engine's protocol instead of the older CHAIN.__LSRC mechanism.
"""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ENGINE = ROOT / "luraph-v15.1-engine"
runtime = (ENGINE / "runtime" / "envlog.luau").read_text(encoding="utf-8")
driver = (ENGINE / "src" / "driver.js").read_text(encoding="utf-8")
harness = (ENGINE / "src" / "harness.js").read_text(encoding="utf-8")

required_runtime = (
    "local NEWCHUNKS = {}",
    "E.loadstring = function(src, chunkname)",
    "if R.type(src) == \"string\" and #src >= PROTO.chunk_min then",
    "NEWCHUNKS[key] = src",
    'R.print(MARK .. "CHUNK " .. key .. " " .. sourceBytes .. " " .. partCount)',
    'R.print(MARK .. "CHUNKDATA " .. key .. " " .. part .. " " .. hex)',
)
for marker in required_runtime:
    if marker not in runtime:
        raise SystemExit("Missing runtime child-loadstring capture: " + marker)

required_driver = (
    "const { chunks: found, incomplete = [], body: cleanBody } = harness.takeChunks(body);",
    "job.write(job.path(`.chunk_${key}.luau`), src, 'latin1');",
    "const chunkPaths = Object.keys(rawChunks).map((k) =>",
)
for marker in required_driver:
    if marker not in driver:
        raise SystemExit("Missing driver child-chunk recovery step: " + marker)

if "CHUNKDATA " not in harness or "incomplete.push" not in harness:
    raise SystemExit("Segmented child-chunk parser or incomplete-capture reporting is missing")

print("LURAPH_151_LOADSTRING_CAPTURE_OK")
