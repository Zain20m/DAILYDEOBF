"""Name the functions a Luraph 14.x lift recovered on its own
(`recovered_proto_*`) from evidence in their own bodies.

A name is given only when the body shows what the function does:

    builds GUI objects and sets Name = "Window"      -> buildWindow
    returns { Window = function ... } (a UI API)      -> createLibrary
    InputBegan + InputChanged + sets .Position         -> makeDraggable
    TweenInfo.new + :Play() (in a loop: tweenAll)      -> tween / tweenAll
    Instance.new, sets properties in a loop, returns it -> createInstance

and a parameter the body calls as f("TextButton", { ...props }) is named
createElement. Upvalues the lifter could not bind keep their meaning but
get a shorter name (__orphan_upvalue_3 -> upvalue3). A function without
such evidence keeps its neutral name: nothing is guessed, and no string,
number or statement is changed. If the renamed text does not parse, the
input is returned unchanged. DEOB_NO_NAMING=1 turns the pass off.
"""

import json
import os
import re
import subprocess
import tempfile

HEADER = re.compile(r"^(\t*)local function (recovered_proto_\w+|fn\d*)\(([^)]*)\)$")
GUI_CLASS = re.compile(
    r"\b(?:Instance\.new\(|\w+\()\s*\"(Frame|TextButton|TextLabel|TextBox|ImageLabel|ImageButton|"
    r"ScrollingFrame|ScreenGui|UICorner|UIStroke|UIListLayout|UIPadding|UIGridLayout|UIGradient|"
    r"CanvasGroup|ViewportFrame|UIAspectRatioConstraint|UISizeConstraint|UIScale)\"")


def _parses(text, exe):
    with tempfile.NamedTemporaryFile("w", suffix=".luau", delete=False, encoding="utf-8", newline="\n") as f:
        f.write(text)
        path = f.name
    try:
        r = subprocess.run([exe, path], capture_output=True)
        if r.returncode != 0:
            return False
        json.loads(r.stdout.decode("latin-1"))
        return True
    except ValueError:
        return False
    finally:
        os.remove(path)


def _blocks(lines):
    """[(indent, name, params, first, last)] of every `local function` the
    namer can rename (recovered_proto_*, fnN), as line ranges."""
    out = []
    for i, ln in enumerate(lines):
        m = HEADER.match(ln)
        if not m:
            continue
        close = m.group(1) + "end"
        for j in range(i + 1, len(lines)):
            if lines[j] == close:
                out.append((m.group(1), m.group(2), m.group(3), i, j))
                break
    return out


def _own_body(lines, blk, blocks):
    """The block's body without the nested local functions (they are named
    on their own); callbacks passed inline stay part of it."""
    ind, _, _, a, b = blk
    skip = set()
    for ind2, _, _, a2, b2 in blocks:
        if a < a2 and b2 < b and len(ind2) > len(ind):
            skip.update(range(a2, b2 + 1))
    return "\n".join(lines[k] for k in range(a + 1, b) if k not in skip)


def _ident(name):
    return r"(?<![\w.:])%s\b" % re.escape(name)


def name_for(body):
    """The evidence-based name of one function body, or None."""
    gui = len(GUI_CLASS.findall(body))
    nlines = body.count("\n") + 1
    win = re.search(r"\bName\s*=\s*\"([A-Z][A-Za-z]{2,30})\"", body)
    if re.search(r"\breturn\s*\{\s*(?:Window|Tab|Section|Library|Ui|UI)\s*=\s*function\b", body):
        return "createLibrary"
    if gui >= 3 and win and win.group(1) == "Window":
        return "buildWindow"
    if (re.search(r"\bInputBegan\b", body) and re.search(r"\bInputChanged\b", body)
            and re.search(r"\.Position\s*=", body) and gui == 0):
        return "makeDraggable"
    if (nlines <= 20 and gui == 0 and "Instance.new(" not in body and re.search(r":Create\(", body)
            and re.search(r"\bTweenInfo\.new\(", body) and re.search(r":Play\(\)", body)):
        return "tweenAll" if re.search(r"\bfor\b|\bwhile\b", body) else "tween"
    inst = re.search(r"\blocal (\w+) = Instance\.new\(", body)
    if inst and nlines <= 20 and re.search(r"\b%s\[.+\]\s*=" % re.escape(inst.group(1)), body) \
            and re.search(r"^\s*return %s\s*$" % re.escape(inst.group(1)), body, re.M):
        return "createInstance"
    if gui >= 3 and win:
        return "build" + win.group(1)
    return None


def _factory_params(params, body):
    """Parameters the body calls as f("ClassName", { props })."""
    out = []
    for p in [x.strip() for x in params.split(",")]:
        if not p or p == "...":
            continue
        calls = re.findall(r"(?<![\w.:])%s\(\s*\"([A-Z][A-Za-z]+)\"\s*,\s*\{" % re.escape(p), body)
        if len(calls) >= 2:
            out.append(p)
    return out


def rename(text, exe):
    """-> (text, [(old, new)])"""
    if os.environ.get("DEOB_NO_NAMING"):
        return text, []
    lines = text.split("\n")
    blocks = _blocks(lines)
    if not blocks:
        return text, []
    used = set(re.findall(r"\b[A-Za-z_]\w*\b", text))

    def unique(base):
        n = base
        k = 2
        while n in used:
            n = "%s%d" % (base, k)
            k += 1
        used.add(n)
        return n

    renames = []
    top = {}            # recovered_proto_* -> new name (file-wide)
    # inner blocks first (they are later in the list when nested? no: sort by depth)
    for blk in sorted(blocks, key=lambda x: -len(x[0])):
        ind, name, params, a, b = blk
        body = _own_body(lines, blk, blocks)
        # parameters: scoped to this function's lines
        local = {}
        for p in _factory_params(params, body):
            if "createElement" not in local.values():
                local[p] = "createElement"
        for p in re.findall(r"\b__orphan_upvalue_(\w+)\b", params):
            old = "__orphan_upvalue_" + p
            # only TweenService has :Create(instance, TweenInfo, goal)
            if re.search(r"(?<![\w.:])%s:Create\([^()]*,\s*TweenInfo\.new\(" % re.escape(old), body) \
                    and "TweenService" not in local.values():
                local.setdefault(old, "TweenService")
            local.setdefault(old, "upvalue" + p)
        seg = "\n".join(lines[a:b + 1])
        for old, new in local.items():
            if not re.search(_ident(new), seg):
                seg = re.sub(_ident(old), new, seg)
        lines[a:b + 1] = seg.split("\n")
        new = name_for(body)
        if not new:
            continue
        if name.startswith("recovered_proto_"):
            top[name] = new
            continue
        # fnN: rename within the enclosing function only, if declared once there
        parent = None
        for ind2, _, _, a2, b2 in blocks:
            if a2 < a and b < b2 and len(ind2) < len(ind) and (parent is None or a2 > parent[0]):
                parent = (a2, b2)
        lo, hi = parent if parent else (0, len(lines) - 1)
        seg = "\n".join(lines[lo:hi + 1])
        if len(re.findall(r"\blocal function %s\(" % re.escape(name), seg)) != 1 or \
                re.search(r"\blocal %s\b(?! *=)|\blocal function %s\(" % (name, name), "\n".join(lines[a + 1:b])):
            continue
        nn = unique(new)
        seg = re.sub(_ident(name), nn, seg)
        lines[lo:hi + 1] = seg.split("\n")
        renames.append((name, nn))
    out = "\n".join(lines)
    for old, base in top.items():
        nn = unique(base)
        out = re.sub(_ident(old), nn, out)
        renames.append((old, nn))
    if out != text and not _parses(out, exe):
        return text, []
    return out, renames
