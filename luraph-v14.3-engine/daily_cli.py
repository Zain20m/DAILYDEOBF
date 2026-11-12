#!/usr/bin/env python3
"""Static Luraph v14.3 payload decoder and prototype disassembler.

This archive does not contain a complete source decompiler. The output is a
bytecode/constant report, not reconstructed runnable Luau.
"""
from __future__ import annotations

import argparse
import contextlib
import io
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
if str(HERE) not in sys.path:
    sys.path.insert(0, str(HERE))

from luraph_decoder import decode_from_source
from proto_deserializer import Deserializer, dump_pool
from translate_proto import render_proto


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", help="protected Luraph v14.3 Lua/Luau source")
    parser.add_argument("-o", "--output", required=True, help="text report output path")
    parser.add_argument("--max-report-mb", type=int, default=12)
    args = parser.parse_args()

    source = Path(args.input)
    output = Path(args.output)
    if not source.is_file():
        raise SystemExit(f"Input file not found: {source}")
    if args.max_report_mb < 1 or args.max_report_mb > 16:
        raise SystemExit("--max-report-mb must be between 1 and 16")

    payload = decode_from_source(source)
    if not payload:
        raise SystemExit("The v14.3 decoder returned an empty payload.")

    binary_path = output.with_suffix(output.suffix + ".decoded.bin")
    binary_path.parent.mkdir(parents=True, exist_ok=True)
    binary_path.write_bytes(payload)

    decoder = Deserializer(payload)
    pool, wrap_mode, constant_count = decoder.read_constant_pool()
    proto_count = decoder.read_upvalue_section()
    if proto_count > 100000:
        raise SystemExit(f"Implausible prototype count: {proto_count}")

    protos = []
    for index in range(proto_count):
        protos.append(decoder.read_proto())
    patches = decoder.apply_patches()

    report = io.StringIO()
    report.write("DAILY DEOBF · Luraph v14.3 static analysis\n")
    report.write("Input: " + source.name + "\n")
    report.write("Decoded payload bytes: " + str(len(payload)) + "\n")
    report.write("Constant count: " + str(constant_count) + "\n")
    report.write("Wrap mode: " + str(wrap_mode) + "\n")
    report.write("Top-level prototypes: " + str(len(protos)) + "\n")
    report.write("Constant references patched: " + str(patches) + "\n")
    report.write("Total instructions: " + str(sum(len(p["opcodes"]) for p in protos)) + "\n")
    report.write("\nCONSTANT POOL\n")
    report.write("--------------\n")
    pool_buffer = io.StringIO()
    with contextlib.redirect_stdout(pool_buffer):
        dump_pool(pool)
    report.write(pool_buffer.getvalue())
    report.write("\nPROTOTYPE DISASSEMBLY\n")
    report.write("---------------------\n")

    truncated = False
    max_chars = args.max_report_mb * 1024 * 1024
    for index, proto in enumerate(protos):
        rendered = render_proto(proto, index) + "\n\n"
        current = report.tell()
        if current + len(rendered) > max_chars:
            remaining = max(0, max_chars - current)
            report.write(rendered[:remaining])
            report.write("\n[Report truncated at configured output limit.]\n")
            truncated = True
            break
        report.write(rendered)

    report.write("\nLIMITATIONS\n")
    report.write("-----------\n")
    report.write(
        "This archive provides static payload decoding and VM instruction "
        "disassembly only. It does not reconstruct complete runnable Luau source. "
        "Unknown opcodes and unresolved operands may remain.\n"
    )
    if truncated:
        report.write("The instruction report was truncated to stay within the output limit.\n")

    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(report.getvalue(), encoding="utf-8")
    print(f"Decoded {len(payload)} bytes; parsed {len(protos)} prototypes.")
    print(str(output))
    print(str(binary_path))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"[!] Luraph v14.3 static analysis failed: {type(exc).__name__}: {exc}", file=sys.stderr)
        raise SystemExit(1)
