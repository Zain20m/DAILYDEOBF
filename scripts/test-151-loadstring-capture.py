#!/usr/bin/env python3
"""Regression checks for Luraph 15.1 loadstring-backed VM functions."""

from pathlib import Path
import sys
from types import SimpleNamespace

ROOT = Path(__file__).resolve().parents[1]
CORE = ROOT / "luraph-v15.1-engine" / "core"
sys.path.insert(0, str(CORE))

from ir import Opaque
from obfuscators.luraph_v15.devirt import Dump, OpaqueFn, ProtoLifter, SharedFn


def make_dump():
    dump = object.__new__(Dump)
    dump.lfs = {}
    dump.shared = {}
    dump.shared_meta = {}
    return dump


def main():
    dump = make_dump()
    source = "return function(value) return value + 1 end"
    fn = dump.val({"lf": 7, "src": source.encode("utf-8").hex()})

    assert isinstance(fn, OpaqueFn)
    assert fn.source == source

    lifter = object.__new__(ProtoLifter)
    lifter.dump = dump
    lifted = lifter.as_expr(fn)
    assert isinstance(lifted, Opaque)
    assert lifted.kind == "function"
    assert lifted.src == "function(...)\\n" + source + "\\nend"

    # A proto-backed function must continue through the normal proto closure
    # path, even if a source field is also present.
    proto_fn = dump.val({
        "lf": 8,
        "pf": {"t": 42},
        "src": source.encode("utf-8").hex(),
    })
    proto_expr = lifter.as_expr(proto_fn)
    assert isinstance(proto_expr, SharedFn)
    assert proto_expr.fn.pf_tid == 42

    # Truly unresolved functions remain explicit, but their diagnostic now
    # records the original function id and whether a proto/source was found.
    unresolved = dump.val({"lf": 9})
    unresolved_expr = lifter.as_expr(unresolved)
    assert isinstance(unresolved_expr, SharedFn)
    assert dump.shared_meta[unresolved_expr.fn.lfid and 2]["lfid"] == 9

    runtime = (ROOT / "luraph-v15.1-engine" / "runtime" / "envlog.luau").read_text(
        encoding="utf-8"
    )
    assert 'E.__LSRC = R.setmetatable({}, {__mode = "k"})' in runtime
    assert "E.__LSRC[f] = src" in runtime
    assert 'R.rawget(E.__LSRC, v)' in runtime

    print("LURAPH_151_LOADSTRING_CAPTURE_OK")


if __name__ == "__main__":
    main()
