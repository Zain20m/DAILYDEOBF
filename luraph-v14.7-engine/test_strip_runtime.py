#!/usr/bin/env python3
"""Regression test for removing Luraph-only output scaffolding."""

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

from strip_runtime import strip
from obfuscators.luraph_v14_9.vmmap import luau_ast_executable


def main():
    source = '''local runtime_banner = "Luraph runtime support ticket"
local runtime_probe = game:GetService("RunService")

local function recovered_proto_game()
    local Players = game:GetService("Players")
    return Players.LocalPlayer
end

local function recovered_proto_debug_check()
    error("The debug library is required on Luau platforms. Please open a support ticket.")
end
'''
    cleaned, report = strip(source, luau_ast_executable())

    assert report is not None, "expected the Luraph scaffolding to be detected"
    assert "game:GetService(\"Players\")" in cleaned, cleaned
    assert "runtime_banner" not in cleaned, cleaned
    assert "runtime_probe" in cleaned, cleaned
    assert report["bootstrap_lines"] > 0, report
    assert "recovered_proto_debug_check" not in cleaned, cleaned
    assert "debug library is required" not in cleaned, cleaned

    print("Luraph runtime cleanup regression passed.")
    print("Kept actual Roblox API code and removed the debug-ticket bootstrap.")


if __name__ == "__main__":
    main()
