#!/usr/bin/env python3
"""Regression test for readable naming of Luraph v15 state-machine artifacts."""
from pathlib import Path
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]
NAMER = ROOT / "luraph-v15-engine" / "names.py"

SAMPLE = r'''
local function recovered()
    local r12 = 1
    local r17 = {}
    local r14 = 0
    local r15 = 0
    local r19 = {}
    local r20 = 0
    local __orphan_upvalue_1 = 0
    local __orphan_upvalue_2 = {}
    local __orphan_upvalue_5 = 7

    while true do
        if r12 <= 60 then
            r14 = bit32.band(r14 + 1, 255)
            r15 = bit32.band(r15 + r17[r14], 255)
            local r2_7 = r17[r14]
            r17[r14] = r17[r15]
            r17[r15] = r2_7
            r19[r20] = r17[bit32.band(r17[r14] + r17[r15], 255)]
            r12 = 35
        elseif r12 <= 61 then
            __orphan_upvalue_1 += 1
            __orphan_upvalue_2[__orphan_upvalue_1] = 4
            r12 = 49
        else
            r12 = 62
        end
        if r12 == 62 then
            return r19
        end
    end
end
return recovered
'''


def main():
    with tempfile.TemporaryDirectory() as tmp:
        source = Path(tmp) / "input.luau"
        output = Path(tmp) / "output.luau"
        source.write_text(SAMPLE, encoding="utf-8")
        subprocess.run(
            [sys.executable, str(NAMER), str(source), "-o", str(output)],
            check=True,
            cwd=ROOT,
        )
        result = output.read_text(encoding="utf-8")

    expected = (
        "dispatchState",
        "permutation",
        "permutationIndex",
        "swapIndex",
        "outputBuffer",
        "outputIndex",
        "captureIndex",
        "capturedTable",
        "capturedValue",
    )
    missing = [name for name in expected if name not in result]
    if missing:
        raise SystemExit("Readable-name regression failed; missing: " + ", ".join(missing))
    for old in ("r12", "r17", "r14", "r15", "r19", "r20", "__orphan_upvalue_1", "__orphan_upvalue_2", "__orphan_upvalue_5"):
        if old in result:
            raise SystemExit("Generated identifier survived readable pass: " + old)
    print("V15 READABLE OUTPUT OK: dispatcher, byte permutation, output buffer and captured upvalues named")


if __name__ == "__main__":
    main()
