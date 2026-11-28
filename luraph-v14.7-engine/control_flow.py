"""Conservative control-flow report for flattened Luraph state dispatchers.

This emits analysis text, never rewritten Lua. It identifies state branches,
source spans, state writes and statically visible edges. Original branch bodies
are retained verbatim so recovered game/UI logic is not discarded.
"""
from __future__ import annotations

import re
from pathlib import Path

_TOKEN = re.compile(
    r'--\[\[.*?\]\]|--[^\n]*|'
    r'"(?:\\.|[^"\\])*"|\'(?:\\.|[^\'\\])*\'|'
    r'\[(=*)\[.*?\]\1\]|'
    r'[A-Za-z_]\w*|-?\d+(?:\.\d+)?|==|~=|<=|>=|::|\.{2,3}|[^\s]',
    re.S,
)
_BRANCH = re.compile(r'\bif\s+([A-Za-z_]\w*)\s*==\s*(-?\d+)\s+then\b')


def _tokens(source: str):
    for match in _TOKEN.finditer(source):
        token = match.group()
        if token.startswith("--") or token[:1] in ("'", '"', "["):
            continue
        yield token, match.start(), match.end()


def _matching_end(source: str, body_start: int) -> int | None:
    tokens = list(_tokens(source[body_start:]))
    stack = ["if"]
    pending_do = 0
    for token, start, end in tokens:
        if token in ("if", "function", "repeat"):
            stack.append(token)
        elif token in ("for", "while"):
            pending_do += 1
        elif token == "do":
            if pending_do:
                pending_do -= 1
            stack.append("do")
        elif token == "end":
            if stack:
                stack.pop()
            if not stack:
                return body_start + start
        elif token == "until":
            if stack and stack[-1] == "repeat":
                stack.pop()
            if not stack:
                return body_start + start
    return None


def _line(source: str, offset: int) -> int:
    return source.count("\n", 0, offset) + 1


def _branches(source: str):
    found = []
    for match in _BRANCH.finditer(source):
        variable, state = match.group(1), match.group(2)
        end_pos = _matching_end(source, match.end())
        if end_pos is None:
            continue
        body = source[match.end():end_pos]
        writes = sorted(set(re.findall(
            rf'(?<![\w.]){re.escape(variable)}\s*=\s*(-?\d+)\b', body
        )))
        conditions = [
            re.sub(r'\s+', ' ', item).strip()
            for item in re.findall(r'\bif\s+(.{1,180}?)\s+then\b', body, re.S)
        ]
        found.append({
            "state": state, "variable": variable, "start": match.start(),
            "end": end_pos + 3, "body_start": match.end(),
            "body_end": end_pos, "writes": writes, "conditions": conditions,
        })
    outer = []
    for item in sorted(found, key=lambda value: (value["start"], -value["end"])):
        if any(parent["start"] < item["start"] < parent["end"] for parent in outer):
            continue
        outer.append(item)
    return outer


def recover_control_flow(source: str, source_name: str = "input.lua") -> str:
    branches = _branches(source)
    if not branches:
        return (
            "LURAPH CONTROL-FLOW ANALYSIS\n"
            f"Input: {source_name}\n"
            "No safely recognizable numeric state branches were found.\n"
            "No source was removed or rewritten.\n"
        )

    variables = {item["variable"] for item in branches}
    if len(variables) != 1:
        return (
            "LURAPH CONTROL-FLOW ANALYSIS\n"
            f"Input: {source_name}\n"
            "Multiple candidate state variables found; automatic ordering skipped.\n"
            "No source was removed or rewritten.\n"
        )

    variable = next(iter(variables))
    by_state = {item["state"]: item for item in branches}
    initial = re.findall(
        rf'(?<![\w.]){re.escape(variable)}\s*=\s*(-?\d+)\b',
        source[:branches[0]["start"]]
    )
    entry = initial[-1] if initial else branches[0]["state"]

    order, queue, seen = [], [entry], set()
    while queue:
        state = queue.pop(0)
        if state in seen or state not in by_state:
            continue
        seen.add(state)
        order.append(state)
        for target in by_state[state]["writes"]:
            if target not in seen and target not in queue:
                queue.append(target)
    order.extend(state for state in by_state if state not in seen)

    out = [
        "LURAPH CONTROL-FLOW RECOVERY REPORT",
        "=" * 72,
        f"Input: {source_name}",
        f"Dispatcher variable: {variable}",
        f"Entry state (static guess): {entry}",
        f"Recovered state blocks: {len(branches)}",
        "",
        "RECOVERED FLOW",
        "--------------",
        "Blocks are listed in reachable transition order where statically known.",
        "Conditional branches and computed transitions remain uncertain.",
        "",
    ]

    for index, state in enumerate(order, 1):
        block = by_state[state]
        first_line = _line(source, block["start"])
        last_line = _line(source, block["end"])
        targets = ", ".join(block["writes"]) if block["writes"] else "no literal state write found"
        out.extend([
            f"BLOCK {index:03d} | state {state} | original lines {first_line}-{last_line}",
            f"  visible next-state assignments: {targets}",
        ])
        if block["conditions"]:
            out.append("  nested conditions:")
            out.extend(f"    - {condition}" for condition in block["conditions"][:40])
        out.append("  original branch body (verbatim report text):")
        body = source[block["body_start"]:block["body_end"]].splitlines()
        first_body_line = _line(source, block["body_start"])
        out.extend(
            f"    {line_no:06d} | {line}"
            for line_no, line in enumerate(body, start=first_body_line)
        )
        out.append("")

    out.extend([
        "RECOVERY LIMITS",
        "---------------",
        "- Static CFG approximation; not a proof of semantic equivalence.",
        "- Computed state values and indirect jumps may remain unresolved.",
        "- Original statements are preserved in this report.",
        "- No executable Lua file is generated by this pass.",
        "- GUI, Roblox API, remote and gameplay statements are not deleted.",
        "",
    ])
    return "\n".join(out)


def write_control_flow(source_path: Path, report_path: Path):
    source = source_path.read_text(encoding="utf-8", errors="replace")
    report = recover_control_flow(source, source_path.name)
    report_path.write_text(report, encoding="utf-8", newline="")
    return len(source.splitlines()), len(_branches(source))
