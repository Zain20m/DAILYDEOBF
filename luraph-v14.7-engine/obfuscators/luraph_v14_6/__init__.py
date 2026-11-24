"""Luraph v14.6 adapter for the shared 14.x VM analysis pipeline.

The v14.6 corpus includes both direct function-table layouts and packed
loadstring wrappers. The v14.x driver instruments dynamically-created chunks
and uses the shared VM mapper/lifter; this adapter keeps version detection and
selection explicit without copying the large shared implementation.
"""
import re

from obfuscators.luraph_v14_7 import LuraphV147

_HEADER = re.compile(
    r"This file was protected using Luraph Obfuscator v(14\\.(?:6|7|8|9))\\b",
    re.I,
)


class LuraphV146(LuraphV147):
    name = "luraph_v14_6"
    label = "Luraph v14.6"

    def detect(self, source):
        match = _HEADER.search(source[:500])
        if not match:
            return 0.0
        version = match.group(1)
        return 1.0 if version == "14.6" else 0.0

    def add_arguments(self, ap):
        group = ap.add_argument_group("Luraph v14.6")
        group.add_argument(
            "--no-hooks",
            action="store_true",
            help="do not instrument VM functions (no trap attribution or lifting)",
        )
        group.add_argument(
            "--max-runs",
            type=int,
            default=12,
            help="maximum number of trace runs (trap reruns)",
        )
        group.add_argument(
            "--devirt-rounds",
            type=int,
            default=200,
            help="maximum lift and constant-request rounds",
        )
