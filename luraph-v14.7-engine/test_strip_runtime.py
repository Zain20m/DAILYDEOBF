#!/usr/bin/env python3
"""Regression tests for removal-only cleanup of real v14.7 output structure."""

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

from strip_runtime import strip
from obfuscators.luraph_v14_9.vmmap import luau_ast_executable


def main():
    exe = luau_ast_executable()

    source = '''local state = 1
local v, luraph_constant, n
do
    while true do
        if state == 1 then
            v = getfenv
            state = 2
        elseif state == 2 then
            if string.find("The debug library is required", "debug") then
                state = 3
            else
                break
            end
        elseif state == 3 then
            n = 4
            state = 4
        elseif state == 4 then
            n = 5
            state = 5
        elseif state == 5 then
            n = 6
            state = 6
        elseif state == 6 then
            n = 7
            state = 7
        elseif state == 7 then
            n = 8
            state = 8
        elseif state == 8 then
            n = 9
            state = 9
        elseif state == 9 then
            n = 10
            state = 10
        elseif state == 10 then
            n = 11
            state = 11
        elseif state == 11 then
            n = 12
            state = 12
        elseif state == 12 then
            n = 13
            state = 13
        elseif state == 13 then
            n = 14
            state = 14
        elseif state == 14 then
            n = 15
            state = 15
        elseif state == 15 then
            n = 16
            state = 16
        elseif state == 16 then
            n = 17
            state = 17
        elseif state == 17 then
            n = 18
            state = 18
        elseif state == 18 then
            n = 19
            state = 19
        elseif state == 19 then
            n = 20
            state = 20
        elseif state == 20 then
            n = 21
            state = 21
        elseif state == 21 then
            n = 22
            state = 22
        elseif state == 22 then
            n = 23
            state = 23
        elseif state == 23 then
            n = 24
            state = 24
        elseif state == 24 then
            n = 25
            state = 25
        end
    end
end

local function recovered_proto_p_27(...)
    local value = "kept"
    return value
end

local function recovered_proto_p_1(...)
    local luraph_constant4 = "register"
    local ScreenGui = Instance.new("ScreenGui")
    return ScreenGui, luraph_constant4
end
'''
    cleaned, report = strip(source, exe)
    assert report is not None, "expected the Luraph root bootstrap to be removed"
    assert "local state = 1" not in cleaned
    assert "The debug library is required" not in cleaned
    assert "recovered_proto_p_27" in cleaned
    assert "recovered_proto_p_1" in cleaned
    assert 'Instance.new("ScreenGui")' in cleaned
    assert 'local luraph_constant4 = "register"' in cleaned
    assert "recovered_proto_p_1" in report["mixed_recovered_functions"]

    simple = '''local luraph_constants = {
    [1] = "close",
}
local function luraph_runtime1(...)
    return nil
end
local function recovered_proto_p_2()
    return "keep me"
end
'''
    cleaned, report = strip(simple, exe)
    assert report is not None
    assert "luraph_constants" not in cleaned
    assert "luraph_runtime1" not in cleaned
    assert "recovered_proto_p_2" in cleaned

    ordinary = '''local state = 1
while true do
    if state == 1 then
        state = 2
    elseif state == 2 then
        break
    end
end
local function recovered_proto_user()
    return "ok"
end
'''
    cleaned, report = strip(ordinary, exe)
    assert "while true do" in cleaned
    assert report is None or report["bootstrap_lines"] == 0

    # An orphaned recovered prototype that only returns Luraph's large
    # numeric constant pool is runtime scaffolding, not a user function.
    pool_entries = [
        '[0] = function() return "runtime" end,',
        '[1] = "Luraph",',
        '[2] = "The debug library is required on Luau platforms",',
        '[3] = "Please open a support ticket",',
        '[4] = "short_src",',
        '[5] = "linedefined",',
        '[6] = "lastlinedefined",',
        '[7] = "setfenv",',
        '[8] = "getfenv",',
    ] + [f'[{i}] = "pool{i}",' for i in range(9, 42)]
    pool_source = (
        "local function recovered_proto_p_1(...)\\n"
        "    return ({\\n        " + "\\n        ".join(pool_entries) + "\\n    })\\n"
        "end\\n\\n"
        "-- lifted on its own (upvalues it uses come first in the parameter list)\\n"
        "local function recovered_proto_p_27(...)\\n"
        "    local Players = game:GetService(\\"Players\\")\\n"
        "    local gui = Instance.new(\\"ScreenGui\\")\\n"
        "    return Players, gui\\n"
        "end\\n"
        "-- ============================================================\\n"
        "--  recovered functions : 2\\n"
        "--  unlifted VM blocks   : 0\\n"
        "--deobf by daily deobf\\n"
    )
    cleaned, report = strip(pool_source, exe)
    assert report is not None
    assert report["pool_prototypes_removed"] == ["recovered_proto_p_1"]
    assert report["main_function_renamed"] == "recovered_proto_p_27"
    assert "recovered_proto_p_1" not in cleaned
    assert "local function recovered_main(...)" in cleaned
    assert 'game:GetService("Players")' in cleaned
    assert 'Instance.new("ScreenGui")' in cleaned
    assert "Luraph" not in cleaned
    assert "recovered functions :" not in cleaned
    assert "--deobf by daily deobf" in cleaned

    # A pool prototype referenced by another function is not considered dead.
    referenced_pool = pool_source.replace(
        "local function recovered_proto_p_27(...)",
        "local function recovered_proto_p_27(...)\\n    local pool = recovered_proto_p_1()",
    )
    referenced, _ = strip(referenced_pool, exe)
    assert "recovered_proto_p_1" in referenced

    print("Luraph v14.7 removal-only regression tests passed.")


if __name__ == "__main__":
    main()
