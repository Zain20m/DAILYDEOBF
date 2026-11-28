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



def _code_mask(source):
    """True for source characters outside Lua strings and comments."""
    mask = [True] * len(source)
    i, n = 0, len(source)
    while i < n:
        if source.startswith("--", i):
            # Lua line comment or long comment.
            j = i + 2
            if j < n and source[j] == "[":
                m = re.match(r"\[(=*)\[", source[j:])
                if m:
                    close = "]" + m.group(1) + "]"
                    end = source.find(close, j + len(m.group(0)))
                    end = n if end < 0 else end + len(close)
                    for k in range(i, end):
                        mask[k] = False
                    i = end
                    continue
            end = source.find("\n", i)
            end = n if end < 0 else end
            for k in range(i, end):
                mask[k] = False
            i = end
            continue
        if source[i] in ("'", '"'):
            quote = source[i]
            j = i + 1
            while j < n:
                if source[j] == "\\":
                    j += 2
                    continue
                if source[j] == quote:
                    j += 1
                    break
                j += 1
            for k in range(i, min(j, n)):
                mask[k] = False
            i = j
            continue
        if source[i] == "[":
            m = re.match(r"\[(=*)\[", source[i:])
            if m:
                close = "]" + m.group(1) + "]"
                end = source.find(close, i + len(m.group(0)))
                end = n if end < 0 else end + len(close)
                for k in range(i, end):
                    mask[k] = False
                i = end
                continue
        i += 1
    return mask


def _inline_constant_pool(text):
    """Inline only literal/global constant slots; retain the pool if it escapes.

    This is deliberately conservative: computed indexes, table escapes and
    non-atomic values are left intact. Replacements are made only in Lua code,
    never inside strings or comments.
    """
    table = re.search(
        r"(?m)^local luraph_constants = \{\n(.*?)\n\}\n", text, re.S
    )
    if not table:
        return text, 0

    values = {}
    for line in table.group(1).splitlines():
        entry = re.match(r"^\s*\[(\d+)\]\s*=\s*(.*?)\s*,\s*(?:--.*)?$", line)
        if not entry:
            return text, 0
        index, value = entry.groups()
        value = re.sub(r"\s+--\[\[.*?\]\]\s*$", "", value).strip()
        # Only expressions that are atomic and have no side effects.
        if not (
            value in ("nil", "true", "false")
            or re.fullmatch(r"-?\d+(?:\.\d+)?", value)
            or (len(value) >= 2 and value[0] == value[-1] and value[0] in ("'", '"'))
        ):
            continue
        values[index] = value

    if not values:
        return text, 0

    mask = _code_mask(text)
    pattern = re.compile(r"\bluraph_constants\s*\[\s*(\d+)\s*\]")
    edits = []
    for match in pattern.finditer(text):
        if match.group(1) not in values:
            continue
        if not all(mask[match.start():match.end()]):
            continue
        edits.append((match.start(), match.end(), values[match.group(1)]))

    if not edits:
        return text, 0
    out = text
    for start, end, value in reversed(edits):
        out = out[:start] + value + out[end:]
    return out, len(edits)

def strip(text, exe=None):
    """Remove explicitly identifiable Luraph scaffolding without rewriting recovered code.

    This is intentionally removal-only: recovered_proto_* bodies are never
    transformed, renamed, folded, or discarded. Ambiguous VM/control-flow code
    is retained because it may contain recovered script behavior.
    """
    if os.environ.get("DEOB_KEEP_LURAPH_RUNTIME"):
        return text, None

    lines = text.splitlines(keepends=True)
    removed = set()
    report = {
        "bootstrap_lines": 0,
        "functions": [],
        "constant_entries_inlined": 0,
        "removed_luraph_lines": 0,
    }

    # Remove explicit Luraph constant-pool declarations as a whole table.
    i = 0
    while i < len(lines):
        if re.match(r"^\s*local\s+luraph_constants\s*=\s*\{", lines[i]):
            depth = 0
            j = i
            while j < len(lines):
                code = re.sub(r"--.*$", "", lines[j])
                depth += code.count("{") - code.count("}")
                removed.update(range(i, j + 1))
                if depth <= 0:
                    break
                j += 1
            i = j + 1
            continue
        i += 1

    # Remove clearly named Luraph-only top-level helpers using parser ranges.
    if exe:
        root = _parse(text, exe)
        if root:
            for stmt in root.get("body", []):
                try:
                    first, last = _loc(stmt["location"])
                except Exception:
                    continue
                head = lines[first].strip() if first < len(lines) else ""
                if re.match(
                    r"local\s+function\s+(?:luraph_runtime\w*|luraph_undecrypted_function)\s*\(",
                    head,
                ):
                    removed.update(range(first, last + 1))
                    report["functions"].append(head.split("(")[0].replace("local function ", ""))

    # Remove remaining standalone Luraph references/checks, not arbitrary
    # statements merely because they occur in a flattened VM dispatcher.
    explicit = re.compile(
        r"\b(?:luraph_constants|luraph_runtime\w*|luraph_undecrypted_function|LPH_[A-Z0-9_]+)\b"
    )
    for idx, line in enumerate(lines):
        if idx in removed:
            continue
        code = re.sub(r"--.*$", "", line)
        if explicit.search(code):
            removed.add(idx)

    # Drop Luraph-only comments/metadata, leaving ordinary comments untouched.
    for idx, line in enumerate(lines):
        if idx in removed:
            continue
        if re.match(r"^\s*--.*(?:Luraph|LPH_)", line, re.I):
            removed.add(idx)

    if not removed:
        return text, None

    output = "".join(line for idx, line in enumerate(lines) if idx not in removed)
    report["removed_luraph_lines"] = len(removed)
    report["bootstrap_lines"] = len(removed)
    return output, report


_TEMP = re.compile(r"^(\t*)local ([A-Za-z_]\w*) = ([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)+)$")


def _inline_temps(text, exe):
    """`local name = localPlayer.Name` used once, on the next line ->
    that line reads `localPlayer.Name` itself (the VM loads every operand
    into a register first; the script wrote it inline)."""
    lines = text.split("\n")
    i = 0
    changed = False
    while i < len(lines):
        m = _TEMP.match(lines[i])
        if not m:
            i += 1
            continue
        ind, name, path = m.groups()
        j = i + 1
        while j < len(lines) and not lines[j].strip():
            j += 1
        if j >= len(lines) or not lines[j].startswith(ind) or lines[j][len(ind):len(ind) + 1] == "\t":
            i += 1
            continue
        word = re.compile(r"(?<![\w.:])%s\b" % re.escape(name))
        # the rest of the declaring block: the name must occur exactly once there
        k = j
        while k < len(lines) and (not lines[k].strip() or lines[k].startswith(ind)):
            if k > j and lines[k].strip() and not lines[k].startswith(ind + "\t") and \
                    re.match(r"^%s(?:end|else|elseif|until)\b" % re.escape(ind[:-1]), lines[k]) if ind else False:
                break
            k += 1
        block = "\n".join(lines[j:k])
        if len(word.findall(block)) != 1 or len(word.findall(lines[j])) != 1 \
                or re.search(r"(?<![\w.:])%s\s*=[^=]" % re.escape(name), lines[j]) \
                or path.split(".")[0] == name:
            i += 1
            continue
        lines[j] = word.sub(path, lines[j], count=1)
        del lines[i:j]          # the declaration (and a blank line after it)
        changed = True
    if not changed:
        return text
    new = "\n".join(lines)
    return new if _parse(new, exe) is not None else text


# built-in libraries / datatypes: `local x = Color3.fromHex` only caches them
_BUILTIN_ROOTS = ("Color3|Vector3|Vector2|CFrame|UDim2|UDim|Instance|math|string|table|Enum|TweenInfo|"
                  "ColorSequence|ColorSequenceKeypoint|NumberSequence|NumberSequenceKeypoint|NumberRange|"
                  "BrickColor|Ray|Random|Rect|Region3|task|os|coroutine|bit32|utf8|buffer|Font|PhysicalProperties")
_ALIAS = re.compile(r"(?m)^(\t*)local ([A-Za-z_]\w*) = ((?:%s)\.[A-Za-z_]\w*)\n" % _BUILTIN_ROOTS)


def _inline_aliases(text, exe):
    """`local color = Color3.fromHex` ... `color("F89B29")` -> `Color3.fromHex("F89B29")`
    (how the VM loads a library function, not how the script was written), when
    within the declaring block the name is never assigned again or declared
    again, and is only ever called."""
    out = text
    # last first: earlier offsets stay valid
    for m in reversed(list(_ALIAS.finditer(text))):
        ind, name, path = m.group(1), m.group(2), m.group(3)
        if name in path.split("."):
            continue
        rest = out[m.end():]
        # the declaring block: up to the first line indented less
        end = re.search(r"(?m)^\t{0,%d}(?=\S)" % (len(ind) - 1), rest) if ind else None
        block = rest[:end.start()] if end else rest
        # declared again in the block (a sibling local of the same name): stop there
        again = re.search(r"(?m)^\s*local (?:function )?(?:[\w, ]*\b)?%s\b" % re.escape(name), block)
        if again:
            block = block[:again.start()]
        uses = list(re.finditer(r"(?<![\w.:])%s\b" % re.escape(name), block))
        if not uses or any(not block[u.end():].startswith("(") for u in uses):
            continue
        body = re.sub(r"(?<![\w.:])%s(?=\()" % re.escape(name), path, block)
        start = m.start()
        tail = rest[len(block):]
        if body.startswith("\n") and (not out[:start] or out[:start].endswith("\n\n")):
            body = body[1:]
        out = out[:start] + body + tail
    if out == text:
        return text
    return out if _parse(out, exe) is not None else text


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
