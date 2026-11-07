"""Regression test for the offline TweenService:SmoothDamp tuple model."""
from pathlib import Path
import sys
import tempfile

ENGINE = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ENGINE))

import harness  # noqa: E402


SOURCE = r"""
local TweenService = game:GetService("TweenService")
local smoothValue, smoothVelocity = TweenService:SmoothDamp(3, 17, 2, 0.5, 100, 0.125)
assert(type(smoothValue) == "number", "SmoothDamp value was not numeric")
assert(type(smoothVelocity) == "number", "SmoothDamp velocity was not numeric")
local derived = smoothVelocity * 0.5
print("SMOOTHDAMP_OK", smoothValue, derived)
"""


def main():
    luau = ENGINE / "bin" / "luau"
    if not luau.is_file():
        raise SystemExit("Missing Luau runtime: " + str(luau))

    with tempfile.TemporaryDirectory(prefix="daily-deobf-smoothdamp-") as temp:
        harness_path = str(Path(temp) / "smoothdamp.luau")
        body, error = harness.run_once(
            str(luau),
            SOURCE,
            {"heartbeat": False, "time_budget": 10},
            harness_path,
            20,
            False,
        )

    if error:
        raise SystemExit("SmoothDamp harness failed: " + error)
    if body is None or "SMOOTHDAMP_OK" not in body:
        raise SystemExit("SmoothDamp tuple regression marker was not recorded:\\n" + str(body)[-2000:])

    print("IRONBREW_SMOOTHDAMP_TUPLE_OK")


if __name__ == "__main__":
    main()
