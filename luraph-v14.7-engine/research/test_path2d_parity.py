"""Path2D offline model vs the real engine (bit-exact lines).

The expected lines are what Roblox Studio 0.747.0.7471481 (headless playing
client, captured 2026-11-14) printed for the same curves, transcribed from the
public parity data of github.com/Anime-Vanguards/roblox-engine-emulator
(tools/parity/expected/path2d.txt, lines 367-386). The Luau below is our own
test that rebuilds those curves; it runs in this engine's sandbox with
--cfg p2d_unlaid=true (frames outside the DataModel have no size there).

    python research/test_path2d_parity.py
"""
import os
import re
import ast
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
import harness  # noqa: E402
from obfuscators.luraph_v14_9.vmmap import luau_ast_executable  # noqa: E402

CASES = r"""-- own test: offset-only and scale points under a Frame outside the DataModel
local Point, Offset = Path2DControlPoint.new, UDim2.fromOffset
local holder = Instance.new("Frame")
local c = Instance.new("Path2D")
c.Parent = holder
local function u(v) return string.format("UDim2(%.9g %.9g %.9g %.9g)", v.X.Scale, v.X.Offset, v.Y.Scale, v.Y.Offset) end
local function v2(v) return string.format("Vector2(%.9g %.9g)", v.X, v.Y) end
local function arc(label, times)
	for _, t in times do
		print(label .. " arc t=" .. t .. " -> " .. u(c:GetPositionOnCurveArcLength(t)) .. " | " .. v2(c:GetTangentOnCurveArcLength(t)))
	end
end
c:SetControlPoints({ Point(Offset(0, 0), Offset(0, 0), Offset(80, 140)), Point(Offset(220, 30)) })
arc("quadratic", { 0.2, 0.425, 0.9 })
c:SetControlPoints({ Point(Offset(0, 0)), Point(Offset(130, 20), Offset(0, 0), Offset(40, 90)), Point(Offset(300, 70), Offset(-90, -10), Offset(0, 0)), Point(Offset(310, 200)) })
arc("mixed", { 0.1, 0.325, 0.6, 0.825, 1 })
c:SetControlPoints({ Point(Offset(197, 91), Offset(0, 0), Offset(108, 104)), Point(Offset(190, 299), Offset(-197, 230), Offset(0, 0)) })
print("tight length -> " .. string.format("%.9g", c:GetLength()))
arc("tight", { 0.5, 0.75, 0.9, 1 })
c:SetControlPoints({ Point(Offset(13, -16), Offset(0, 0), Offset(0, -36)), Point(Offset(13, -34)) })
print("turn back -> " .. string.format("%.9g", c:GetLength()))
c:SetControlPoints({ Point(Offset(0, 0)), Point(UDim2.new(0.5, 10, 2, 0)) })
print("fraction and scale -> " .. string.format("%.9g", c:GetLength()) .. " | " .. u(c:GetPositionOnCurve(1)))
"""

EXPECTED = """quadratic arc t=0.2 -> UDim2(0 31 0 42) | Vector2(181.812561 189.114349)
quadratic arc t=0.425 -> UDim2(0 80 0 74) | Vector2(211.996368 63.3484955)
quadratic arc t=0.9 -> UDim2(0 198 0 45) | Vector2(270.687653 -181.198578)
mixed arc t=0.1 -> UDim2(0 45 0 6) | Vector2(130 20)
mixed arc t=0.325 -> UDim2(0 137 0 35) | Vector2(120.615822 218.641174)
mixed arc t=0.6 -> UDim2(0 247 0 69) | Vector2(211.06218 -20.2407837)
mixed arc t=0.825 -> UDim2(0 303 0 120) | Vector2(10 130)
mixed arc t=1 -> UDim2(0 310 0 199) | Vector2(10 130)
tight length -> 420.165405
tight arc t=0.5 -> UDim2(0 178 0 287) | Vector2(-243.589233 468.289124)
tight arc t=0.75 -> UDim2(0 123 0 376) | Vector2(-46.3157043 71.7278595)
tight arc t=0.9 -> UDim2(0 163 0 330) | Vector2(439.150848 -519.818176)
tight arc t=1 -> UDim2(0 195 0 292) | Vector2(618.936646 -720.897217)
turn back -> 29.9999962
fraction and scale -> 10 | UDim2(0 10 0 0)
"""


def main():
    luau = re.sub(r"luau-ast(\.exe)?$", lambda m: "luau" + (m.group(1) or ""), luau_ast_executable())
    with tempfile.TemporaryDirectory() as tmp:
        body, err = harness.run_once(luau, CASES, {"time_budget": 60, "executor": "Wave", "p2d_unlaid": True},
                                     os.path.join(tmp, "h.luau"), 120, False)
    if body is None:
        print("FAIL: harness error: " + err[:500])
        return 1
    got = [ast.literal_eval(m.group(1)) for m in re.finditer(r'print\(("(?:[^"\\]|\\.)*")\)', body)]
    want = EXPECTED.strip().split("\n")
    bad = [(w, g) for w, g in zip(want, got) if w != g]
    if len(got) != len(want) or bad:
        for w, g in bad:
            print("- real : " + w)
            print("+ model: " + g)
        print("FAIL: %d of %d lines differ" % (len(bad) + abs(len(want) - len(got)), len(want)))
        return 1
    print("ok: %d Path2D lines match the real engine" % len(want))
    return 0


if __name__ == "__main__":
    sys.exit(main())
