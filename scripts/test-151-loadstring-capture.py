#!/usr/bin/env python3
"""Regression checks for the integrated Luraph 15.1 loadstring capture path."""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ENGINE = ROOT / "luraph-v15.1-engine"
runtime = (ENGINE / "runtime" / "envlog.luau").read_text(encoding="utf-8")
driver = (ENGINE / "src" / "driver.js").read_text(encoding="utf-8")
harness = (ENGINE / "src" / "harness.js").read_text(encoding="utf-8")

required_runtime = (
    'CHAIN.__LSRC = R.setmetatable({}, {__mode = "k"})',
    "CHAIN.__LSRC[f] = src",
    "R.rawget(CHAIN.__LSRC, v)",
)
for marker in required_runtime:
    if marker not in runtime:
        raise SystemExit("Missing runtime loadstring source capture: " + marker)

required_driver = (
    "const { chunks: found, incomplete = [], body: cleanBody } = harness.takeChunks(body);",
    "job.write(job.path(`.chunk_${key}.luau`), src, 'latin1');",
    "process.stderr.write(`[!] dynamic VM chunk ${item.key} was not reconstructed:",
    "const chunkPaths = Object.keys(rawChunks).map((k) =>",
)
for marker in required_driver:
    if marker not in driver:
        raise SystemExit("Missing driver chunk recovery step: " + marker)

if "CHUNKDATA" not in harness or "incomplete" not in harness:
    raise SystemExit("Segmented child-chunk parser or incomplete-capture reporting is missing")

print("LURAPH_151_LOADSTRING_CAPTURE_OK")
