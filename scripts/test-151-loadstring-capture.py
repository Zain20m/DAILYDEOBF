#!/usr/bin/env python3
"""Regression checks for Luraph 15.1 loadstring-backed VM functions."""

from pathlib import Path
from types import SimpleNamespace
import sys

ROOT = Path(__file__).resolve().parents[1]
CORE = ROOT / "luraph-v15.1-engine" / "core"
sys.path.insert(0, str(CORE))

from ir import Opaque
from obfuscators.luraph_v15.devirt import Dump, OpaqueFn, ProtoLifter, SharedFn, Stepper
from obfuscators.luraph_v15.vmmap import ctor_assignments
from luasym import RegFile


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
    assert lifted.src == "function(...)\n" + source + "\nend"

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
    assert dump.shared_meta[2]["lfid"] == 9

    # Dotted table writes, named-function statements, and local function
    # aliases must all bind back to their source AST function.
    fn_node = {"type": "AstExprFunction", "args": [], "body": {"body": []}}
    root = {
        "type": "AstStatBlock",
        "body": [
            {
                "type": "AstStatLocal",
                "vars": [{"name": "helpers", "location": "helpers@1"}],
                "values": [],
            },
            {
                "type": "AstStatLocal",
                "vars": [{"name": "build", "location": "build@1"}],
                "values": [fn_node],
            },
            {
                "type": "AstStatLocal",
                "vars": [{"name": "helperTableAlias", "location": "table-alias@1"}],
                "values": [{
                    "type": "AstExprLocal",
                    "local": {"name": "helpers", "location": "helpers@1"},
                }],
            },
            {
                "type": "AstStatLocal",
                "vars": [{"name": "helperAlias", "location": "alias@1"}],
                "values": [{
                    "type": "AstExprLocal",
                    "local": {"name": "build", "location": "build@1"},
                }],
            },
            {
                "type": "AstStatAssign",
                "vars": [{
                    "type": "AstExprIndexName",
                    "expr": {
                        "type": "AstExprLocal",
                        "local": {"name": "helpers", "location": "helpers@1"},
                    },
                    "index": {"name": "create"},
                }],
                "values": [{
                    "type": "AstExprLocal",
                    "local": {"name": "build", "location": "build@1"},
                }],
            },
            {
                "type": "AstStatAssign",
                "vars": [{
                    "type": "AstExprIndexExpr",
                    "expr": {
                        "type": "AstExprLocal",
                        "local": {"name": "helpers", "location": "helpers@1"},
                    },
                    "index": {"type": "AstExprConstantNumber", "value": 17},
                }],
                "values": [{
                    "type": "AstExprLocal",
                    "local": {"name": "helperAlias", "location": "alias@1"},
                }],
            },
            {
                "type": "AstStatAssign",
                "vars": [{
                    "type": "AstExprIndexExpr",
                    "expr": {
                        "type": "AstExprLocal",
                        "local": {"name": "helperTableAlias", "location": "table-alias@1"},
                    },
                    "index": {"type": "AstExprConstantNumber", "value": 19},
                }],
                "values": [fn_node],
            },
            {
                "type": "AstStatFunction",
                "name": {
                    "type": "AstExprIndexName",
                    "expr": {
                        "type": "AstExprLocal",
                        "local": {"name": "helpers", "location": "helpers@1"},
                    },
                    "index": {"name": "run"},
                },
                "func": fn_node,
            },
        ],
    }
    ctor_map = ctor_assignments(root)
    assert ctor_map[(b"helpers", b"create")] is fn_node
    assert ctor_map[(b"helpers", 17)] is fn_node
    assert ctor_map[(b"helpers", 19)] is fn_node
    assert ctor_map[(b"helpers", b"run")] is fn_node

    # A v15.1 allocator call can evaluate to None when its callee is an
    # opaque VM helper. Static call/store evidence should still identify the
    # register file, including when the AST wraps its base in parentheses.
    def local_expr(name, location):
        return {
            "type": "AstExprLocal",
            "local": {"name": name, "location": location},
        }

    def index_expr(base, key):
        return {"type": "AstExprIndexExpr", "expr": base, "index": key}

    registers = "registers@1"
    indexer = "indexer@1"
    allocator_call = {
        "type": "AstExprCall",
        "func": local_expr("allocator", "allocator@1"),
        "args": [],
    }
    initializer = {
        "type": "AstStatLocal",
        "vars": [{"name": "registers", "location": registers}],
        "values": [allocator_call],
    }
    dispatch_call = {
        "type": "AstExprCall",
        "func": index_expr(
            {"type": "AstExprGroup", "expr": local_expr("registers", registers)},
            {"type": "AstExprGroup", "expr": local_expr("indexer", indexer)},
        ),
        "args": [{"type": "AstExprConstantNumber", "value": 1}],
    }
    dispatch_store = {
        "type": "AstStatAssign",
        "vars": [index_expr(
            {"type": "AstExprGroup", "expr": local_expr("registers", registers)},
            {"type": "AstExprConstantNumber", "value": 1},
        )],
        "values": [{"type": "AstExprConstantNumber", "value": 42}],
    }
    fake_stepper = SimpleNamespace(
        cs=SimpleNamespace(vars={registers: None}),
        vm=SimpleNamespace(inner_body=[initializer]),
        first_inner=1,
        loops=[(0, None, {
            "type": "AstStatWhile",
            "body": {"body": [dispatch_call, dispatch_store]},
        })],
    )
    Stepper._detect_regfile(fake_stepper)
    assert isinstance(fake_stepper.cs.vars[registers], RegFile)

    # A nil local without a call initializer is not promoted just because it
    # happens to be indexed and written in a loop.
    non_allocator = {
        "type": "AstStatLocal",
        "vars": [{"name": "notRegisters", "location": "not-registers@1"}],
        "values": [{"type": "AstExprConstantNil"}],
    }
    no_call_stepper = SimpleNamespace(
        cs=SimpleNamespace(vars={"not-registers@1": None}),
        vm=SimpleNamespace(inner_body=[non_allocator]),
        first_inner=1,
        loops=[(0, None, {
            "type": "AstStatWhile",
            "body": {"body": [
                {
                    "type": "AstExprCall",
                    "func": index_expr(local_expr("notRegisters", "not-registers@1"),
                                       local_expr("indexer", indexer)),
                    "args": [],
                },
                {
                    "type": "AstStatAssign",
                    "vars": [index_expr(local_expr("notRegisters", "not-registers@1"),
                                        {"type": "AstExprConstantNumber", "value": 1})],
                    "values": [{"type": "AstExprConstantNumber", "value": 42}],
                },
            ]},
        })],
    )
    Stepper._detect_regfile(no_call_stepper)
    assert no_call_stepper.cs.vars["not-registers@1"] is None

    # Ambiguous call-initialized candidates must not be guessed.
    ambiguous = {
        "type": "AstStatBlock",
        "body": [
            {
                "type": "AstStatLocal",
                "vars": [
                    {"name": "first", "location": "first@1"},
                    {"name": "second", "location": "second@1"},
                ],
                "values": [allocator_call, allocator_call],
            },
        ],
    }
    ambiguous_stepper = SimpleNamespace(
        cs=SimpleNamespace(vars={"first@1": None, "second@1": None}),
        vm=SimpleNamespace(inner_body=ambiguous["body"]),
        first_inner=1,
        loops=[(0, None, {
            "type": "AstStatWhile",
            "body": {"body": [
                {
                    "type": "AstExprCall",
                    "func": index_expr(local_expr("first", "first@1"),
                                       local_expr("indexer", indexer)),
                    "args": [],
                },
                {
                    "type": "AstExprCall",
                    "func": index_expr(local_expr("second", "second@1"),
                                       local_expr("indexer", indexer)),
                    "args": [],
                },
                {
                    "type": "AstStatAssign",
                    "vars": [
                        index_expr(local_expr("first", "first@1"),
                                   {"type": "AstExprConstantNumber", "value": 1}),
                        index_expr(local_expr("second", "second@1"),
                                   {"type": "AstExprConstantNumber", "value": 1}),
                    ],
                    "values": [
                        {"type": "AstExprConstantNumber", "value": 1},
                        {"type": "AstExprConstantNumber", "value": 2},
                    ],
                },
            ]},
        })],
    )
    Stepper._detect_regfile(ambiguous_stepper)
    assert ambiguous_stepper.cs.vars == {"first@1": None, "second@1": None}

    runtime = (ROOT / "luraph-v15.1-engine" / "runtime" / "envlog.luau").read_text(
        encoding="utf-8"
    )
    assert 'CHAIN.__LSRC = R.setmetatable({}, {__mode = "k"})' in runtime
    assert "CHAIN.__LSRC[f] = src" in runtime
    assert 'R.rawget(CHAIN.__LSRC, v)' in runtime

    print("LURAPH_151_LOADSTRING_CAPTURE_OK")


if __name__ == "__main__":
    main()
