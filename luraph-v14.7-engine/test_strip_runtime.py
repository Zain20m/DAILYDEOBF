#!/usr/bin/env python3
"""Regression tests for removal-only Luraph scaffolding cleanup."""

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

from strip_runtime import strip


def main():
    source = '''local luraph_constants = {
    [1] = "close",
    [2] = Instance,
}
local function luraph_runtime1(...)
    return nil
end
local function recovered_proto_p_27(player)
    local gui = Instance.new("ScreenGui")
    gui.Name = "Test GUI"
    return gui
end
local function recovered_proto_p_28(...)
    -- Luraph marker in a comment should not cause this function to vanish.
    local text = "ordinary recovered content"
    return text
end
'''
    cleaned, report = strip(source)
    assert report is not None
    assert "luraph_constants" not in cleaned, cleaned
    assert "luraph_runtime1" not in cleaned, cleaned
    assert "recovered_proto_p_27" in cleaned, cleaned
    assert 'Instance.new("ScreenGui")' in cleaned, cleaned
    assert "recovered_proto_p_28" in cleaned, cleaned
    assert "ordinary recovered content" in cleaned, cleaned

    # Explicit pool references are removed, not inlined or substituted.
    refs = '''local recovered_value = luraph_constants[2]
local function recovered_proto_p_1()
    return "still recovered"
end
'''
    cleaned, _ = strip(refs)
    assert "luraph_constants" not in cleaned
    assert "Instance" not in cleaned
    assert "still recovered" in cleaned

    # Ambiguous VM/control-flow code is retained rather than guessed away.
    vm = '''local state = 10
while true do
    if state == 10 then
        state = 20
    else
        break
    end
end
'''
    cleaned, report = strip(vm)
    assert cleaned == vm
    assert report is None

    print("Luraph removal-only cleanup tests passed.")


if __name__ == "__main__":
    main()
