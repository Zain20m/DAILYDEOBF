"""Drop Luraph's own runtime / anti-tamper code from a lifted v14.x result.

The lifted root proto of a Luraph v14 file is Luraph's bootstrap, not the
script: it caches the globals it trusts (rawget, setfenv, string.*, ...),
hooks `tostring`/`rawset` on them to detect tampering, checks the debug
library and loadstring (`LPH_NO_UPVALUES`), and only then calls the script.
The script itself ends up in the functions lifted on their own
(`recovered_proto_*`).  That bootstrap is the long `tbl5[n] = v(x, "tostring")
v9(x, "tostring", fn)` noise at the top of every result.

This pass removes, at top level only:
  * the root body (everything between the constants/stubs and the first
    `recovered_proto_*`) when it carries Luraph's markers and makes no
    Roblox API call -- i.e. it is only the bootstrap;
  * `recovered_proto_*` functions that are likewise Luraph-only (markers,
    no API call) or are Luraph's huge-arity internal helpers, when nothing
    kept refers to them;
  * `luraph_constants` entries and stubs nothing kept refers to any more.

It never touches the inside of kept code, and if the stripped text does not
parse, or nothing script-like would be left, the input is returned
unchanged.  DEOB_KEEP_LURAPH_RUNTIME=1 turns the pass off.
"""

import json
import os
import re
import subprocess
import tempfile

# strings / names only Luraph's runtime uses
MARKERS = re.compile(
    r"Luraph|LPH_|lura\.ph|support ticket|short_src|linedefined|"
    r"debug library|setfenv\(function|:\(%d\+\)\[:|\"__metatable\"|"
    r"\"tostring\"|luraph_undecrypted_function\(\)")
# the script doing something in the game. Only a USAGE position counts (a
# method call, a member access, Instance.new, require, ...): a bare global as
# a table value (`[97] = workspace`, `[47] = Instance`) is Luraph's constant
# pool, not the script using the API.
API = re.compile(
    r"[:.](?:GetService|WaitForChild|FindFirstChild\w*|GetChildren|GetDescendants|GetPlayers|"
    r"Kick|Connect|Once|Fire\w*|Invoke\w*|Create|Clone|Destroy|GetMouse|HttpGet|PivotTo|"
    r"LoadAnimation|SetAttribute|GetAttribute|JSONE\w+|JSOND\w+)\(|"
    r"\bInstance\.new\(|\bgame[:.]|workspace[.:\[]|\.Parent\b|\.LocalPlayer\b|\brequire\(|"
    r"\bEnum\.[A-Z]|\bDrawing\.new\(|\bhttp_?request\(|\bloadstring\(game")
# Luraph's LPH_ENCSTR byte decryptor: an LCG keystream xored with the bytes.
DECODER = re.compile(r"bit32\.bxor")
# a function whose body is mostly a numeric-keyed table (Luraph's constant pool)
CONST_ENTRY = re.compile(r"(?m)^\s*\[\d+\]\s*=\s*")
PROTO = re.compile(r"^local function (recovered_proto_\w+)\(([^)]*)\)")
PREAMBLE = re.compile(r"^local function (luraph_runtime\d+|luraph_undecrypted_function)\(|"
                      r"^local luraph_constants = ")
HUGE_ARITY = 64


def _loc(s):
    a, b = s.split(" - ")
    l0, _ = a.split(",")
    l1, _ = b.split(",")
    return int(l0), int(l1)


def _parse(text, exe):
    with tempfile.NamedTemporaryFile("w", suffix=".luau", delete=False, encoding="utf-8", newline="\n") as f:
        f.write(text)
        path = f.name
    try:
        r = subprocess.run([exe, path], capture_output=True)
        if r.returncode != 0:
            return None
        return json.loads(r.stdout.decode("latin-1"))["root"]
    finally:
        os.remove(path)


def _comment_start(lines, first):
    """First line of the comment block directly above line `first`."""
    i = first
    while i > 0 and lines[i - 1].startswith("--"):
        i -= 1
    return i


def _refs(name, text):
    return len(re.findall(r"\b%s\b" % re.escape(name), text))


def strip(text, exe):
    """-> (text, report) ; report is None when nothing was removed."""
    if os.environ.get("DEOB_KEEP_LURAPH_RUNTIME"):
        return text, None
    root = _parse(text, exe)
    if root is None:
        return text, None
    lines = text.split("\n")
    stmts = []
    for s in root.get("body", []):
        l0, l1 = _loc(s["location"])
        stmts.append((l0, l1, lines[l0]))
    if not stmts:
        return text, None

    def body_of(l0, l1):
        return "\n".join(lines[l0:l1 + 1])

    protos = [(l0, l1, m) for l0, l1, first in stmts for m in [PROTO.match(first)] if m]
    if not protos:
        return text, None
    first_proto = protos[0][0]
    # the root body: top-level statements before the first lifted-alone
    # function that are not the constants table / stubs
    main = [(l0, l1) for l0, l1, first in stmts if l0 < first_proto and not PREAMBLE.match(first)
            and not (first.startswith("local ") and first.rstrip().endswith("= ...") and l0 == l1)]
    drop = []          # (first line, last line, what)
    report = {"bootstrap_lines": 0, "functions": []}
    if main:
        mtext = "\n".join(body_of(a, b) for a, b in main)
        if MARKERS.search(mtext) and not API.search(mtext):
            a = main[0][0]
            b = main[-1][1]
            # whole span: blank lines/comments between its statements too
            drop.append((a, b, "bootstrap"))
            report["bootstrap_lines"] = b - a + 1

    kept_protos = []
    for l0, l1, m in protos:
        body = body_of(l0, l1)
        nparams = len([p for p in m.group(2).split(",") if p.strip()])
        nlines = l1 - l0 + 1
        # a quoted string that looks like a Roblox member or a word of game
        # text (PascalCase or a phrase) marks real script code
        game_str = re.search(r'"[A-Z][a-z]\w+|"[a-z]+_[a-z]', body)
        luraph_only = not API.search(body) and (
            MARKERS.search(body)                        # Luraph text markers
            or nparams >= HUGE_ARITY                    # VM-internal arity
            or (DECODER.search(body) and "% 256" in body)  # LPH_ENCSTR decryptor
            or len(CONST_ENTRY.findall(body)) >= 24     # the constant pool
            # a large function that touches the game in no way and carries no
            # game text: a Luraph numeric unpacker / VM helper
            or (nlines >= 40 and not game_str))
        if luraph_only:
            drop.append((l0, l1, m.group(1)))
        else:
            kept_protos.append(m.group(1))
    if not kept_protos:
        # nothing script-like would be left: better the full output
        return text, None

    # never drop a function something kept still calls
    def kept_text(dropset):
        out = []
        cut = sorted((a, b) for a, b, _ in dropset)
        i = 0
        for a, b in cut:
            out.extend(lines[i:a])
            i = b + 1
        out.extend(lines[i:])
        return "\n".join(out)

    changed = True
    while changed:
        changed = False
        kt = kept_text(drop)
        for d in list(drop):
            if d[2] != "bootstrap" and _refs(d[2], kt):
                drop.remove(d)
                changed = True
    if not drop:
        return text, None

    # cut, taking each function's describing comment with it
    marks = {}
    for a, b, what in drop:
        a2 = _comment_start(lines, a) if what != "bootstrap" else a
        marks[a2] = (b, what)
        if what != "bootstrap":
            report["functions"].append(what)
    out = []
    i = 0
    while i < len(lines):
        if i in marks:
            b, what = marks[i]
            if what == "bootstrap":
                out.append("-- [Luraph bootstrap removed: %d lines of Luraph's own start-up code" % report["bootstrap_lines"])
                out.append("--  (global caching, tostring/rawset tamper hooks, debug-library and")
                out.append("--  loadstring checks). It is not part of the script; the script's")
                out.append("--  code is in the recovered functions below.]")
            i = b + 1
            continue
        out.append(lines[i])
        i += 1
    new = "\n".join(out)
    # "-- captured proto N: K parameters, not script code (not shown)" notes
    new = re.sub(r"(?m)^-- captured proto \S+: \d+ parameters, not script code \(not shown\)\n\n?", "", new)
    new = _prune_preamble(new)
    new = re.sub(r"\n{3,}", "\n\n", new)
    if _parse(new, exe) is None:
        return text, None
    return new, report


def _prune_preamble(text):
    """Stubs nobody calls and luraph_constants entries nobody indexes."""
    for name in ("luraph_undecrypted_function",) + tuple(sorted(set(re.findall(r"\bluraph_runtime\d+\b", text)))):
        if _refs(name, text) == 1:
            text = re.sub(r"(?m)^(?:--[^\n]*\n)*local function %s\(\.\.\.\)\n\treturn nil\nend\n\n?" % re.escape(name),
                          "", text)
    m = re.search(r"(?m)^local luraph_constants = \{\n(.*?)\n\}\n", text, re.S)
    if not m:
        return text
    rest = text[:m.start()] + text[m.end():]
    uses = re.findall(r"\bluraph_constants\b(\s*\[\s*(\d+)\s*\])?", rest)
    if not uses:
        # (the comment line above the table goes too)
        start = m.start()
        pre = text[:start]
        pre = re.sub(r"(?:--[^\n]*\n)+$", "", pre)
        return pre + text[m.end():]
    if any(not idx for _, idx in uses):
        return text      # indexed by a computed key / passed whole: keep all
    body = m.group(1).split("\n")
    if not all(re.match(r"\t\[\d+\] = .*,$", ln) for ln in body):
        return text      # an entry spans lines: leave the table alone
    used = {idx for _, idx in uses}
    kept = [ln for ln in body if re.match(r"\t\[(\d+)\] = ", ln).group(1) in used]
    return text[:m.start()] + "local luraph_constants = {\n" + "\n".join(kept) + "\n}\n" + text[m.end():]
