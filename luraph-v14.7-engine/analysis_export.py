"""Create a non-executable analysis companion for flattened Luraph v14.7 lifts.

A v14.7 lift can be one large state-machine dispatcher. Its branches contain
recovered program logic as well as VM control flow, so deleting the dispatcher
would also delete in-game behavior. This exporter builds an index while keeping
the complete recovered text, line-for-line, in a clearly non-executable report.
"""

from __future__ import annotations

import re
from pathlib import Path

URL_RE = re.compile(r"""https?://[^\s"'<>]+""", re.I)
STATE_BRANCH_RE = re.compile(
    r"""\bif\s+([A-Za-z_]\w*)\s*==\s*(-?\d+)\s+then\b"""
)
API_PATTERNS = {
    "Roblox services / instances": r"\b(?:GetService|WaitForChild|FindFirstChild|GetChildren|GetDescendants|Instance\.new)\b",
    "Player / character": r"\b(?:Players|LocalPlayer|Character|Humanoid|PlayerGui)\b",
    "Events / remotes": r"\b(?:RemoteEvent|RemoteFunction|FireServer|InvokeServer|OnClientEvent|OnServerEvent)\b",
    "GUI": r"\b(?:ScreenGui|TextLabel|TextButton|Frame|UICorner|UIStroke|TweenService)\b",
    "Network / dynamic loading": r"\b(?:request|http_request|HttpGet|loadstring|WebSocket)\b",
    "Filesystem": r"\b(?:writefile|readfile|makefolder|isfile|isfolder|delfile)\b",
    "Hooks / environment": r"\b(?:hookfunction|hookmetamethod|getgenv|getrenv|newcclosure|checkcaller)\b",
}


def build_analysis(source: str, source_name: str) -> str:
    lines = source.splitlines()
    state_hits: list[tuple[int, str, str]] = []
    for line_no, line in enumerate(lines, 1):
        match = STATE_BRANCH_RE.search(line)
        if match:
            state_hits.append((line_no, match.group(1), match.group(2)))

    urls = sorted(set(URL_RE.findall(source)))
    sections: list[str] = [
        "DAILYDEOBF | LURAPH STATIC ANALYSIS",
        "=" * 72,
        f"Input: {source_name}",
        f"Recovered source lines: {len(lines)}",
        "",
        "IMPORTANT",
        "This is a non-executable analysis report. The complete recovered source",
        "is included below as line-numbered text. Do not execute this report.",
        "A flattened state dispatcher mixes VM control flow with recovered game",
        "logic. Removing it wholesale would destroy real script behavior.",
        "",
        "DISPATCHER INDEX",
        "---------------",
    ]

    if state_hits:
        state_var = state_hits[0][1]
        state_ids = sorted({state for _, var, state in state_hits if var == state_var}, key=int)
        sections.append(f"Detected state variable: {state_var}")
        sections.append(f"Detected state branches: {len(state_hits)}")
        sections.append("State IDs: " + ", ".join(state_ids))
        sections.append("")
        sections.append("Branch locations:")
        sections.extend(f"  line {line_no}: {var} == {state}" for line_no, var, state in state_hits)
    else:
        sections.append("No simple numeric state == N branch pattern detected.")
        sections.append("The source is preserved below; no statements were removed.")

    sections.extend(["", "EXTERNAL URLS", "-------------"])
    sections.extend(f"  {url}" for url in urls) if urls else sections.append("  None found")

    sections.extend(["", "API / BEHAVIOR INDICATORS", "------------------------"])
    for label, pattern in API_PATTERNS.items():
        hits = [i for i, line in enumerate(lines, 1) if re.search(pattern, line)]
        if hits:
            preview = ", ".join(str(n) for n in hits[:30])
            suffix = f" (+{len(hits) - 30} more)" if len(hits) > 30 else ""
            sections.append(f"{label}: {len(hits)} matching lines")
            sections.append(f"  Lines: {preview}{suffix}")

    sections.extend([
        "",
        "COMPLETE RECOVERED SOURCE (NON-EXECUTABLE TEXT)",
        "------------------------------------------------",
        "Every source line is prefixed with a line number and ' | '.",
        "The source is intentionally represented as report text, not a .lua file.",
        "",
    ])
    sections.extend(f"{i:06d} | {line}" for i, line in enumerate(lines, 1))
    return "\n".join(sections) + "\n"


def write_analysis(source_path: Path, report_path: Path) -> tuple[int, int]:
    source = source_path.read_text(encoding="utf-8", errors="replace")
    report = build_analysis(source, source_path.name)
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(report, encoding="utf-8", newline="")
    state_count = len(STATE_BRANCH_RE.findall(source))
    return len(source.splitlines()), state_count
