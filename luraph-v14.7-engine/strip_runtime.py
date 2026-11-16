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
# reading Luraph's constant pool through an upvalue (`upvalue1[110]`) or the
# pool's `[0]` slot: the lifter resolves the script's own constants in place,
# so only Luraph's runtime code (env checks, hooks) is left doing this
POOL_USE = re.compile(r"\b(?:__orphan_)?upvalue_?\d+\[\d{2,3}\]|\w\[0\]\[")
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
        luraph_only = POOL_USE.search(body) or not API.search(body) and (
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
        new = _drop_lift_notes(_refine_names(_merge_ifs(_fold_iterators(_unwrap_main(text, exe), exe), exe), exe))
        if new == text:
            return text, None
        return new, report

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
            # (Luraph's bootstrap goes without a note: the file starts with
            # the script; the log says how much was removed)
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
    return _drop_lift_notes(_refine_names(_merge_ifs(_fold_iterators(_unwrap_main(new, exe), exe), exe), exe)), report


_LIFT_NOTES = re.compile(
    r"(?m)^-- captured proto \S+: created at run time by a Luraph runtime helper, so it is\n"
    r"-- lifted on its own \(upvalues it uses come first in the parameter list\)\n"
    r"|^-- a function Luraph never decrypted: it did not run while the script was\n"
    r"-- analysed \(Luraph decrypts a function's code on its first call\)\n"
    r"|^-- unresolved Luraph runtime helper; preserved as a safe stub\n")


def _drop_lift_notes(text):
    """The lifter's notes about how a function was found: the file should
    start with code (a file preview shows its first lines). Comments only:
    the code is the same."""
    return _LIFT_NOTES.sub("", text).lstrip("\n")


def _refine_names(text, exe):
    """Name what is still generic (v12, arg, tbl3, fn20) from the finished
    code; a few rounds, since a name found in one (findKey) names more in the
    next (`local key = findKey(...)`). DEVIRT_NO_NAMES=1: off."""
    if os.environ.get("DEVIRT_NO_NAMES") or len(text) > int(os.environ.get("DEOB_REFINE_MAX", "600000")):
        return text     # (a very big file: its syntax tree costs a lot of memory, three times)
    try:
        import names
        new = text
        for _ in range(3):
            nxt = names.refine_text(new)
            if nxt == new:
                break
            new = nxt
    except Exception:  # noqa: BLE001 - keep the names as they are
        return text
    return new if _parse(new, exe) is not None else text


_IF = re.compile(r"^(\t*)(if|elseif) (.+) then$")
_IF_ONLY = re.compile(r"^(\t*)if (.+) then$")


def _cond(c):
    # `and` binds tighter than `or`: an operand with `or` in it gets parentheses
    return "(%s)" % c if re.search(r"\bor\b", c) else c


def _merge_ifs(text, exe):
    """`if a then if b then ... end end` (no else at either level, nothing
    else in the outer body) -> `if a and b then ... end`."""
    lines = text.split("\n")
    changed = True
    while changed:
        changed = False
        i = 0
        while i < len(lines):
            m = _IF.match(lines[i])
            if not m:
                i += 1
                continue
            ind = m.group(1)
            j = i + 1
            while j < len(lines) and not lines[j].strip():
                j += 1
            m2 = _IF_ONLY.match(lines[j]) if j < len(lines) else None
            if not m2 or m2.group(1) != ind + "\t":
                i += 1
                continue
            inner = ind + "\t"
            # the inner if's end, with no else/elseif of its own on the way
            k = j + 1
            while k < len(lines) and lines[k] != inner + "end":
                if lines[k].startswith(inner + "else") or lines[k].startswith(inner + "elseif") or \
                        (lines[k].strip() and not lines[k].startswith(inner + "\t") and not lines[k].startswith(inner + "end")):
                    k = None
                    break
                k += 1
            if k is None or k >= len(lines):
                i += 1
                continue
            e = k + 1
            while e < len(lines) and not lines[e].strip():
                e += 1
            if e >= len(lines) or lines[e] != ind + "end":
                i += 1
                continue
            body = [ln[1:] if ln.startswith("\t") else ln for ln in lines[j + 1:k]]
            # (an `elseif` merges only as the last branch: with an `else`
            # after it, `a and not b` would now run that else)
            head = "%s%s %s and %s then" % (ind, m.group(2), _cond(m.group(3)), _cond(m2.group(2)))
            lines[i:e + 1] = [head] + body + [ind + "end"]
            changed = True
            i += 1
    new = "\n".join(lines)
    if new == text:
        return text
    return new if _parse(new, exe) is not None else text


_ITER = re.compile(r"(?m)^(\t*)local (\w+), (\w+), (\w+) = (i?pairs)\((.+)\)\n(?:\n)?\1for (\w+(?:, \w+)?) in \3, \4 do$")


_LUA_WORDS = {"and", "break", "do", "else", "elseif", "end", "false", "for", "function", "if", "in",
              "local", "nil", "not", "or", "repeat", "return", "then", "true", "until", "while",
              "continue", "type", "string", "table", "next", "select", "game", "workspace"}


def _loop_value_name(expr, loopvars, block):
    """(old, new): a name for a loop's value variable from what the loop
    goes through (`pairs(x.neon_parts)` -> neonPart), when the value has a
    generated name and the new one is free in the block."""
    vs = [v.strip() for v in loopvars.split(",")]
    if len(vs) != 2 or not re.match(r"^v\d+$", vs[1]):
        return None
    m = re.search(r":Get(\w+)\(\)$", expr.strip()) or re.search(r"(?:^|[.:])([A-Za-z_]\w*)$", expr.strip())
    if not m:
        return None
    try:
        import names
        word = names.singular(m.group(1))
        if word:
            word = re.sub(r"_+([a-z0-9])", lambda x: x.group(1).upper(), word)
            word = word[:1].lower() + word[1:]
    except Exception:  # noqa: BLE001
        return None
    if not word or word in _LUA_WORDS or not re.match(r"^[a-z]\w*$", word) or \
            re.search(r"\b%s\b" % word, block) or word == vs[0]:
        return None
    return vs[1], word


def _fold_iterators(text, exe):
    """`local a, b, c = pairs(x)` + `for k, v in b, c do` (how the VM's
    generic-for setup lifts) -> `for k, v in pairs(x) do`, when a, b and c
    are used nowhere else in that block."""
    out = []
    pos = 0
    for m in _ITER.finditer(text):
        ind, a, b, c = m.group(1), m.group(2), m.group(3), m.group(4)
        # the rest of the enclosing block: up to the first line indented less
        rest = text[m.end():]
        end = re.search(r"(?m)^(?!%s)(?=\t{0,%d}\S)" % (re.escape(ind), max(len(ind) - 1, 0)), rest) if ind else None
        block = rest[:end.start()] if end else rest
        if any(re.search(r"\b%s\b" % n, block) for n in (a, b, c)):
            continue
        out.append(text[pos:m.start()])
        loopvars = m.group(7)
        body_end = re.search(r"(?m)^%send$" % re.escape(ind), rest)
        named = _loop_value_name(m.group(6), loopvars, block)
        if named and body_end:
            old_v, nv = named
            loopvars = re.sub(r"\b%s\b" % old_v, nv, loopvars)
            body = re.sub(r"\b%s\b" % old_v, nv, rest[:body_end.start()])
            out.append("%sfor %s in %s(%s) do" % (ind, loopvars, m.group(5), m.group(6)))
            out.append(body)
            pos = m.end() + body_end.start()
            continue
        out.append("%sfor %s in %s(%s) do" % (ind, loopvars, m.group(5), m.group(6)))
        pos = m.end()
    if not out:
        return text
    out.append(text[pos:])
    new = "".join(out)
    return new if _parse(new, exe) is not None else text


def _unwrap_main(text, exe):
    """When all that is left of the script is one parameterless function that
    nothing calls (Luraph started it from its runtime), show its body at top
    level, as the script was written."""
    root = _parse(text, exe)
    if root is None:
        return text
    lines = text.split("\n")
    stmts = [_loc(s["location"]) for s in root.get("body", [])]
    protos = [(a, b, m) for a, b in stmts for m in [PROTO.match(lines[a])] if m]
    if len(protos) != 1:
        return text
    a, b, m = protos[0]
    if m.group(2).strip() or (a, b) != stmts[-1] or _refs(m.group(1), text) != 1:
        return text
    body = [ln[1:] if ln.startswith("\t") else ln for ln in lines[a + 1:b]]
    new = "\n".join(lines[:_comment_start(lines, a)] + body + lines[b + 1:])
    new = re.sub(r"\n{3,}", "\n\n", new)
    return new if _parse(new, exe) is not None else text


def strip_quiet(text):
    """strip() for side outputs (the per-round partial lift): never raises,
    returns the text unchanged on any problem."""
    try:
        from obfuscators.luraph_v14_9.vmmap import luau_ast_executable
        return strip(text, luau_ast_executable())[0]
    except Exception:  # noqa: BLE001 - keep the partial as it is
        return text


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
