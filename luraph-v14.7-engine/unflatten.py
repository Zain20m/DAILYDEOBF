"""Undo Luraph's control-flow flattening in the recovered Luau.

Luraph rewrites a function's control flow into a dispatch loop before it
compiles the script, so the faithfully-lifted output looks like

    local state = 1
    while true do
        if state == 1 then
            <real statements>
            n = 67
            state = 2
        elseif state == 2 then
            if n ~= 70 then state = 4 else state = 3 end
        elseif state == 3 then
            <real statements>
            state = 2
        ...
    end

The dispatch variables (`state`, `n`, ...) only ever hold integer constants,
so the loop has ONE statically-determined path.  This pass replays that path
with the dispatch variables constant-folded and emits each real statement by
slicing its ORIGINAL source text (never re-serialised), so the recovered
logic itself can never be altered -- only re-ordered into the order it runs.

It is deliberately conservative: anything it cannot prove (a dispatch
variable set to a non-constant, a state revisited = a real loop, a real
branch that writes a dispatch variable, a break/continue of the dispatch
loop, a condition it cannot decide) makes it leave that whole dispatcher
exactly as it was.  The caller re-checks that the whole file still parses.
"""

import json
import os
import re
import subprocess
import tempfile

_CMP = {"CompareEq", "CompareNe", "CompareLt", "CompareLe", "CompareGt", "CompareGe"}
_MAXSTEPS = 200000


def _loc(s):
    a, b = s.split(" - ")
    l0, c0 = a.split(","); l1, c1 = b.split(",")
    return int(l0), int(c0), int(l1), int(c1)


def _within(inner, outer):
    """True if span `inner` lies inside span `outer`."""
    return (outer[0], outer[1]) <= (inner[0], inner[1]) and (inner[2], inner[3]) <= (outer[2], outer[3])


class _Src:
    """Byte-accurate slicing of the source (luau-ast columns are byte offsets)."""

    def __init__(self, text):
        self.blines = [ln.encode("utf-8") for ln in text.split("\n")]

    def slice(self, loc):
        l0, c0, l1, c1 = loc
        if l0 == l1:
            return self.blines[l0][c0:c1].decode("utf-8")
        parts = [self.blines[l0][c0:]]
        parts += self.blines[l0 + 1:l1]
        parts.append(self.blines[l1][:c1])
        return b"\n".join(p if isinstance(p, bytes) else p for p in parts).decode("utf-8")


class _Bail(Exception):
    pass


class _Revisit(_Bail):
    """The replay came back to a state already on the current path: that
    state heads a real loop.  Caught by the frame that entered it."""

    def __init__(self, key):
        _Bail.__init__(self, "state revisited")
        self.key = key


FUNCS = ("AstStatLocalFunction", "AstStatFunction", "AstExprFunction", "AstExprAnonymousFunction")
LOOPS = ("AstStatWhile", "AstStatRepeat", "AstStatFor", "AstStatForIn")
SKIPKEYS = ("type", "location", "op", "local", "name")


def _children(node):
    for k, v in node.items():
        if k in SKIPKEYS:
            continue
        if isinstance(v, dict):
            yield v
        elif isinstance(v, list):
            for x in v:
                if isinstance(x, dict):
                    yield x


class _Deflattener:
    """One pass: find statically-traceable dispatch loops and rebuild them.

    Variables are identified by their DECLARATION (luau-ast gives every local
    reference the location of the declaration it binds to), never by name,
    so a reused short name in another scope can never be confused with a
    dispatch variable."""

    def __init__(self, text, exe):
        self.text = text
        self.src = _Src(text)
        with tempfile.NamedTemporaryFile("w", suffix=".luau", delete=False, encoding="utf-8", newline="\n") as f:
            f.write(text)
            path = f.name
        try:
            r = subprocess.run([exe, path], capture_output=True)
            if r.returncode != 0:
                raise _Bail("parse failed")
            self.root = json.loads(r.stdout.decode("latin-1"))["root"]
        finally:
            os.remove(path)
        # declaration id -> spans of every reference to it, for the
        # "used outside the loop" check
        self.refs = {}
        stack = [self.root]
        while stack:
            n = stack.pop()
            if n.get("type") == "AstExprLocal":
                self.refs.setdefault(self._lid(n), []).append(_loc(n["location"]))
            stack.extend(_children(n))

    # ---- small AST helpers ------------------------------------------------
    @staticmethod
    def _num(e):
        return e if isinstance(e, dict) and e.get("type") == "AstExprConstantNumber" else None

    @staticmethod
    def _lid(e):
        """Declaration id of a local reference, else None."""
        if isinstance(e, dict) and e.get("type") == "AstExprLocal":
            return (e.get("local") or {}).get("location")
        return None

    @staticmethod
    def _is_true(cond):
        return isinstance(cond, dict) and cond.get("type") == "AstExprConstantBool" and cond.get("value") is True

    @staticmethod
    def _else_stmts(st):
        """Statements of an if's else part. An `elseif` is stored as a nested
        AstStatIf (not a block): it is one statement of the else part."""
        e = st.get("elsebody")
        if not e:
            return []
        if e.get("type") == "AstStatBlock":
            return e.get("body", [])
        return [e]

    def _is_ctrl_cond(self, e, ctrl):
        """A boolean expression over control vars and numeric constants only
        (each comparison: both sides a control var or a number, at least one
        a control var). The expression's shape is summarised once per node, so
        the control-var fixpoint re-checks it with set lookups only."""
        summ = self._cond_summary(e)
        if summ is None:
            return False
        for l, r in summ:
            lc = l[0] == "L" and l[1] in ctrl
            rc = r[0] == "L" and r[1] in ctrl
            if not (lc or rc):
                return False
            if not (lc or l[0] == "N") or not (rc or r[0] == "N"):
                return False
        return True

    def _cond_summary(self, e):
        """[(left kind, right kind)] for every comparison of a condition made
        only of comparisons, not/and/or and parentheses, else None. A kind is
        ("L", declaration id), ("N",) for a number, or ("X",) otherwise."""
        cache = self.__dict__.setdefault("_summary_cache", {})
        key = id(e)
        if key in cache:
            return cache[key]
        out = None
        if isinstance(e, dict):
            t = e.get("type")
            if t == "AstExprGroup":
                out = self._cond_summary(e["expr"])
            elif t == "AstExprUnary" and e.get("op") == "Not":
                out = self._cond_summary(e["expr"])
            elif t == "AstExprBinary":
                op = e.get("op")
                if op in ("And", "Or"):
                    a, b = self._cond_summary(e["left"]), self._cond_summary(e["right"])
                    out = None if a is None or b is None else a + b
                elif op in _CMP:
                    out = [(self._side_kind(e["left"]), self._side_kind(e["right"]))]
        cache[key] = out
        return out

    def _side_kind(self, e):
        e = self._ungroup(e)
        lid = self._lid(e)
        if lid is not None:
            return ("L", lid)
        if self._num(e) is not None:
            return ("N",)
        return ("X",)

    @staticmethod
    def _ungroup(e):
        while isinstance(e, dict) and e.get("type") == "AstExprGroup":
            e = e["expr"]
        return e

    def _cmp_side(self, e, ctrl):
        e = self._ungroup(e)
        return self._lid(e) in ctrl or self._num(e) is not None

    # ---- control variables -------------------------------------------------
    def _control_vars(self, while_node, setup_spans):
        """Declaration ids that (a) are only ever assigned numeric constants in
        the loop, (b) are only read inside pure control conditions, (c) are not
        captured by a nested function, and (d) are not referenced anywhere
        outside the loop except its setup statements."""
        body = while_node["body"]["body"]
        assigned = {}       # id -> {"const", "other"}
        reads = []          # (id, condition node or None)

        def walk(node, cond):
            if isinstance(node, list):
                for x in node:
                    walk(x, cond)
                return
            if not isinstance(node, dict):
                return
            t = node.get("type")
            if t in FUNCS:
                return
            if t == "AstStatAssign":
                vals = node.get("values", [])
                for i, tgt in enumerate(node.get("vars", [])):
                    lid = self._lid(tgt)
                    v = vals[i] if i < len(vals) else None
                    if lid is not None:
                        assigned.setdefault(lid, set()).add("const" if self._num(v) is not None and len(vals) == len(node["vars"]) else "other")
                    else:
                        walk(tgt, None)
                for v in vals:
                    walk(v, None)
                return
            if t == "AstStatLocal":
                vals = node.get("values", [])
                for i, l in enumerate(node.get("vars", [])):
                    v = vals[i] if i < len(vals) else None
                    assigned.setdefault(l.get("location"), set()).add("const" if self._num(v) is not None else "other")
                for v in vals:
                    walk(v, None)
                return
            if t == "AstStatCompoundAssign":
                lid = self._lid(node.get("var"))
                if lid is not None:
                    assigned.setdefault(lid, set()).add("other")
                else:
                    walk(node.get("var"), None)
                walk(node.get("value"), None)
                return
            if t in ("AstStatFor", "AstStatForIn"):
                for v in node.get("vars", []) or ([node["var"]] if node.get("var") else []):
                    if isinstance(v, dict):
                        assigned.setdefault(v.get("location"), set()).add("other")
            if t == "AstExprLocal":
                reads.append((self._lid(node), cond))
                return
            if t == "AstStatIf":
                walk(node.get("condition"), node.get("condition"))
                walk(node.get("thenbody"), None)
                walk(node.get("elsebody"), None)
                return
            for c in _children(node):
                walk(c, cond)

        walk(body, None)
        cand = {lid for lid, kinds in assigned.items() if lid and kinds == {"const"}}

        # (c) captured by a nested function
        def captures(node, fnspan):
            if node.get("type") == "AstExprLocal" and fnspan is not None:
                d = self._lid(node)
                if d is not None and not _within(_loc(d), fnspan):
                    cand.discard(d)
            span = _loc(node["location"]) if node.get("type") in FUNCS else fnspan
            for c in _children(node):
                captures(c, span)

        for st in body:
            captures(st, None)

        # (d) referenced outside the loop (other than its setup statements)
        wspan = _loc(while_node["location"])
        for lid in list(cand):
            for sp in self.refs.get(lid, ()):
                if not _within(sp, wspan) and not any(_within(sp, s) for s in setup_spans):
                    cand.discard(lid)
                    break

        # (b) fixpoint: a read outside a pure control condition disqualifies
        changed = True
        while changed:
            changed = False
            for lid, cond in reads:
                if lid in cand and (cond is None or not self._is_ctrl_cond(cond, cand)):
                    cand.discard(lid)
                    changed = True
        return cand

    def _writes_ctrl(self, node, ctrl):
        if isinstance(node, list):
            return any(self._writes_ctrl(x, ctrl) for x in node)
        if not isinstance(node, dict):
            return False
        t = node.get("type")
        if t in FUNCS:
            return False
        if t == "AstStatAssign" and any(self._lid(v) in ctrl for v in node.get("vars", [])):
            return True
        if t == "AstStatCompoundAssign" and self._lid(node.get("var")) in ctrl:
            return True
        if t == "AstStatLocal" and any(v.get("location") in ctrl for v in node.get("vars", [])):
            return True
        return any(self._writes_ctrl(c, ctrl) for c in _children(node))

    def _has_loop_jump(self, node):
        """A break/continue that targets the dispatch loop itself."""
        if not isinstance(node, dict):
            return False
        t = node.get("type")
        if t in ("AstStatBreak", "AstStatContinue"):
            return True
        if t in LOOPS or t in FUNCS:
            return False
        return any(self._has_loop_jump(c) for c in _children(node))

    # ---- evaluation -------------------------------------------------------
    def _eval(self, e, vals):
        if not isinstance(e, dict):
            raise _Bail("eval")
        t = e.get("type")
        if t == "AstExprGroup":
            return self._eval(e["expr"], vals)
        if t == "AstExprConstantNumber":
            return e["value"]
        if t == "AstExprConstantBool":
            return e["value"]
        if t == "AstExprConstantNil":
            return None
        if t == "AstExprLocal":
            lid = self._lid(e)
            if lid not in vals:
                raise _Bail("control var read before it is set")
            return vals[lid]
        if t == "AstExprUnary" and e.get("op") == "Not":
            return not self._truth(self._eval(e["expr"], vals))
        if t == "AstExprBinary":
            op = e["op"]
            if op == "And":
                a = self._eval(e["left"], vals)
                return self._eval(e["right"], vals) if self._truth(a) else a
            if op == "Or":
                a = self._eval(e["left"], vals)
                return a if self._truth(a) else self._eval(e["right"], vals)
            l = self._eval(e["left"], vals)
            r = self._eval(e["right"], vals)
            if op == "CompareEq":
                return l == r and type(l) is not bool and type(r) is not bool or (l is r)
            if op == "CompareNe":
                return not (l == r and type(l) is not bool and type(r) is not bool or (l is r))
            if not (isinstance(l, (int, float)) and isinstance(r, (int, float))) or isinstance(l, bool) or isinstance(r, bool):
                raise _Bail("ordered comparison on a non-number")   # Lua would raise here
            return {"CompareLt": l < r, "CompareLe": l <= r, "CompareGt": l > r, "CompareGe": l >= r}[op]
        raise _Bail("eval op")

    @staticmethod
    def _truth(v):
        return v is not False and v is not None

    def _apply_ctrl_assign(self, st, vals, ctrl):
        """Apply a pure control-var assignment; True if `st` was one."""
        t = st.get("type")
        if t == "AstStatAssign":
            tgts = st.get("vars", [])
            vs = st.get("values", [])
            ids = [self._lid(x) for x in tgts]
            if ids and all(i in ctrl for i in ids) and len(vs) == len(tgts):
                new = [self._eval(v, vals) for v in vs]
                for i, v in zip(ids, new):
                    vals[i] = v
                return True
        if t == "AstStatLocal":
            locs = st.get("vars", [])
            vs = st.get("values", [])
            ids = [l.get("location") for l in locs]
            if ids and all(i in ctrl for i in ids) and len(vs) == len(locs):
                new = [self._eval(v, vals) for v in vs]
                for i, v in zip(ids, new):
                    vals[i] = v
                return True
        return False

    def _is_terminal_call(self, st):
        """`error(...)` used as a statement (incl. the lifter's
        error(\"devirt: ...\") traps): it raises, nothing after it runs."""
        if st.get("type") != "AstStatExpr":
            return False
        call = st.get("expr") or {}
        fn = call.get("func") or {}
        return call.get("type") == "AstExprCall" and fn.get("type") == "AstExprGlobal" and fn.get("global") == "error"

    # ---- replay -----------------------------------------------------------
    def _iter(self, frames, vals, items, onpath, budget, loops, scope):
        """Run statements of ONE loop iteration (frames: a stack of
        [statements, next index]) with the control vars concrete. Real
        statements are appended to items. Returns 'end' (iteration finished,
        or `continue`), 'break', 'stop' (return / error) or 'fork' (a runtime
        branch: both continuations are already structured into an if-item)."""
        ctrl = self._ctrl
        while frames:
            stmts, idx = frames[-1]
            if idx >= len(stmts):
                frames.pop()
                continue
            frames[-1][1] = idx + 1
            st = stmts[idx]
            t = st.get("type")
            if t == "AstStatBreak":
                return "break"
            if t == "AstStatContinue":
                return "end"
            if self._apply_ctrl_assign(st, vals, ctrl):
                continue
            if t == "AstStatIf" and self._is_ctrl_cond(st.get("condition"), ctrl):
                # a dispatch test: decided, so run exactly one arm inline
                arm = st["thenbody"]["body"] if self._truth(self._eval(st["condition"], vals)) else self._else_stmts(st)
                frames.append([arm, 0])
                continue
            if t == "AstStatIf" and (self._writes_ctrl(st, ctrl) or self._has_loop_jump(st)):
                # a runtime branch that steers the machine: a real if/else,
                # each arm followed by the rest of its own path
                self._check_refs(st["condition"], scope)
                outs = []
                for arm in (st["thenbody"]["body"], self._else_stmts(st)):
                    av = dict(vals)
                    asc = dict(scope)
                    ai = []
                    cont = [[s, i] for s, i in frames] + [[arm, 0]]
                    r = self._iter(cont, av, ai, onpath, budget, loops, asc)
                    self._finish(r, av, ai, onpath, budget, loops, asc)
                    outs.append(ai)
                items.append(("if", _loc(st["condition"]["location"]), outs[0], outs[1]))
                return "fork"
            if self._writes_ctrl(st, ctrl) or self._has_loop_jump(st):
                raise _Bail("a statement mixes real code with dispatch state")
            self._check_refs(st, scope)
            if t == "AstStatLocal":
                for l in st.get("vars", []):
                    scope[l.get("name")] = l.get("location")
            elif t == "AstStatLocalFunction" and isinstance(st.get("name"), dict):
                scope[st["name"].get("name")] = st["name"].get("location")
            items.append(("s", _loc(st["location"])))
            budget[0] -= 1
            if budget[0] < 0:
                raise _Bail("budget")
            if t == "AstStatReturn" or self._is_terminal_call(st):
                return "stop"
        return "end"

    def _free_refs(self, node):
        """(name, declaration id) of local references in `node` bound to a
        declaration outside it (cached)."""
        key = id(node)
        got = self._free_cache.get(key)
        if got is None:
            span = _loc(node["location"])
            got = []
            stack = [node]
            while stack:
                n = stack.pop()
                if n.get("type") == "AstExprLocal":
                    d = self._lid(n)
                    if d is not None and not _within(_loc(d), span):
                        got.append((n["local"].get("name"), d))
                stack.extend(_children(n))
            self._free_cache[key] = got
        return got

    def _check_refs(self, node, scope):
        """Every name the statement uses must still bind to the same
        declaration once the arms are laid out in sequence. A local of the
        same name hoisted earlier on this path would capture it: refuse."""
        for nm, d in self._free_refs(node):
            if nm in scope and scope[nm] != d:
                raise _Bail("a hoisted local would capture a reference")

    def _finish(self, r, vals, items, onpath, budget, loops, scope):
        if r == "end":
            items += self._structure(vals, onpath, budget, loops, scope=scope)
        elif r == "break":
            items += self._exit(loops)

    @staticmethod
    def _exit(loops):
        """Leaving the dispatch loop: nothing more here (the code after the
        replaced loop runs next); inside one rebuilt loop that is a `break`."""
        if not loops:
            return []
        if len(loops) > 1:
            raise _Bail("break out of two rebuilt loops")
        return [("break",)]

    def _structure(self, vals, onpath, budget, loops=(), enter_header=None, scope=None):
        """Emit-tree for the machine from the current control values.

        A control state revisited on the path is a real loop: the frame that
        first entered it rebuilds it as `while true do ... end`, where coming
        back is `continue`. A jump to an OUTER rebuilt loop would need goto
        (Luau has none): _Bail, and the dispatcher stays as it was."""
        items = []
        entered = {}
        first = True
        scope = dict(scope or {})
        while True:
            key = tuple(sorted((k, vals[k]) for k in self._ctrl if k in vals))
            header_entry = first and enter_header == key
            first = False
            if loops and key == loops[-1] and not header_entry:
                items.append(("continue",))
                return items
            if key in loops and not header_entry:
                raise _Bail("jump to an outer loop header")
            budget[0] -= 1
            if budget[0] < 0:
                raise _Bail("budget")
            try:
                if key in onpath:
                    raise _Revisit(key)
                entered[key] = (len(items), dict(vals), onpath, dict(scope))
                onpath = onpath | {key}
                r = self._iter([[self._body, 0]], vals, items, onpath, budget, loops, scope)
            except _Revisit as rv:
                if rv.key not in entered:
                    raise
                pos, snap, before, sc = entered[rv.key]
                del items[pos:]
                # a loop body is a fresh block each iteration: start from
                # the locals in scope where the loop is entered
                body = self._structure(dict(snap), before, budget, loops + (rv.key,), enter_header=rv.key, scope=sc)
                items.append(("loop", body))
                return items
            if r == "end":
                continue
            if r == "break":
                items += self._exit(loops)
            return items

    # ---- discovery --------------------------------------------------------
    def _setup(self, body, i):
        """Indices of the statements right before the loop that only set up
        locals with constants (`local state = 1`, `local n`, `local i = 0`,
        `state = 1`). Their constant values seed the replay."""
        j = i - 1
        idxs = []
        while j >= 0:
            st = body[j]
            t = st.get("type")
            vals = st.get("values", [])
            if t == "AstStatLocal" and all(self._num(v) is not None or (v or {}).get("type") == "AstExprConstantNil" for v in vals):
                idxs.append(j)
            elif t == "AstStatAssign" and len(st.get("vars", [])) == len(vals) and \
                    all(self._lid(x) is not None for x in st["vars"]) and all(self._num(v) is not None for v in vals):
                idxs.append(j)
            else:
                break
            j -= 1
        return sorted(idxs)

    def _try_loop(self, body, i, edits):
        w = body[i]
        b = w["body"]["body"]
        if not b or b[0].get("type") != "AstStatIf":
            return False
        setup = self._setup(body, i)
        spans = [_loc(body[j]["location"]) for j in setup]
        self._ctrl = self._control_vars(w, spans)
        if not self._ctrl or not self._is_ctrl_cond(b[0].get("condition"), self._ctrl):
            return False            # not a dispatcher
        self._free_cache = {}
        # seed values from the setup statements
        vals = {}
        for j in setup:
            st = body[j]
            if st.get("type") == "AstStatLocal":
                vs = st.get("values", [])
                for k, l in enumerate(st.get("vars", [])):
                    if l.get("location") in self._ctrl:
                        v = vs[k] if k < len(vs) else None
                        vals[l["location"]] = None if v is None or v.get("type") == "AstExprConstantNil" else v["value"]
            else:
                for x, v in zip(st["vars"], st["values"]):
                    if self._lid(x) in self._ctrl:
                        vals[self._lid(x)] = v["value"]
        self._body = b
        # Budget proportional to the loop's own size: the rebuilt code is
        # rejected anyway once it is clearly longer than the loop, so a replay
        # that copies branches far past that point is stopped early instead of
        # running to completion first (that was most of the pass's time).
        nstmts = 0
        stack = list(b)
        while stack:
            n = stack.pop()
            if n.get("type", "").startswith("AstStat"):
                nstmts += 1
            stack.extend(_children(n))
        items = self._structure(vals, frozenset(), [min(_MAXSTEPS, 1000 + 8 * nstmts)])
        wl = _loc(w["location"])
        indent = re.match(r"[\t ]*", self.text.split("\n")[wl[0]]).group(0)
        lines = self._render_items(items, indent)
        if self._max_block_locals(items) > 120:
            raise _Bail("too many locals in one block")      # Luau allows 200 per function
        top_locals = any(it[0] == "s" and self._is_local_decl(it[1]) for it in items)
        if top_locals:
            # the arms' locals were scoped inside the loop: keep them there
            lines = [indent + "do"] + ["\t" + ln for ln in lines] + [indent + "end"]
        rep = "\n".join(lines) if lines else indent + "-- (flattened block with no observable statements)"
        # Branches that later meet are laid out once per path. When that
        # copying makes the rebuilt code clearly LONGER than the loop it
        # replaces, it is less readable, not more: leave this loop alone.
        orig = self.src.slice(wl)
        if len(rep) > 1.25 * len(orig) + 200:
            raise _Bail("rebuilt code would duplicate too much")
        edits.append((wl[0], wl[1], wl[2], wl[3], rep.lstrip("\t ")))
        # drop setup statements that only initialise dispatch variables
        for j in setup:
            st = body[j]
            ids = [l.get("location") for l in st.get("vars", [])] if st.get("type") == "AstStatLocal" \
                else [self._lid(x) for x in st.get("vars", [])]
            if ids and all(x in self._ctrl for x in ids):
                sl = _loc(st["location"])
                edits.append((sl[0], sl[1], sl[2], sl[3], ""))
        return True

    def _frame_decls(self, stmts, out):
        """name -> declaration ids of locals declared DIRECTLY in the
        statement lists the replay lays out in sequence (the dispatch arms and
        runtime-branch arms). Locals inside statements copied verbatim keep
        their own block and cannot clash."""
        for st in stmts:
            t = st.get("type")
            if t == "AstStatLocal":
                for l in st.get("vars", []):
                    out.setdefault(l.get("name"), set()).add(l.get("location"))
            elif t == "AstStatLocalFunction":
                nm = st.get("name") or {}
                if isinstance(nm, dict):
                    out.setdefault(nm.get("name"), set()).add(nm.get("location"))
            elif t == "AstStatIf" and (self._is_ctrl_cond(st.get("condition"), self._ctrl)
                                      or self._writes_ctrl(st, self._ctrl) or self._has_loop_jump(st)):
                self._frame_decls(st["thenbody"]["body"], out)
                self._frame_decls(self._else_stmts(st), out)

    def _no_shadowing(self, body):
        """Laying arms out in sequence puts their locals in one block, so a
        reference could start binding to a different variable of the same
        name. Allow it only when every such hoisted name has exactly one
        declaration among all bindings of that name in the loop."""
        hoisted = {}
        self._frame_decls(body, hoisted)
        if not hoisted:
            return True
        binds = {}
        stack = list(body)
        while stack:
            n = stack.pop()
            t = n.get("type")
            if t == "AstExprLocal":
                binds.setdefault(n["local"].get("name"), set()).add(self._lid(n))
            elif t == "AstStatLocal":
                for l in n.get("vars", []):
                    binds.setdefault(l.get("name"), set()).add(l.get("location"))
            elif t == "AstStatLocalFunction" and isinstance(n.get("name"), dict):
                binds.setdefault(n["name"].get("name"), set()).add(n["name"].get("location"))
            for k in ("vars", "args"):
                for l in n.get(k, []) if t in ("AstStatFor", "AstStatForIn", "AstExprFunction") else []:
                    if isinstance(l, dict) and l.get("type") == "AstLocal":
                        binds.setdefault(l.get("name"), set()).add(l.get("location"))
            if t == "AstStatFor" and isinstance(n.get("var"), dict):
                binds.setdefault(n["var"].get("name"), set()).add(n["var"].get("location"))
            stack.extend(_children(n))
        for nm, ids in hoisted.items():
            if len(ids | binds.get(nm, set())) > 1:
                return False
        return True

    def _max_block_locals(self, items):
        n = sum(1 for it in items if it[0] == "s" and self._is_local_decl(it[1]))
        for it in items:
            if it[0] == "loop":
                n = max(n, self._max_block_locals(it[1]))
            elif it[0] == "if":
                n = max(n, self._max_block_locals(it[2]), self._max_block_locals(it[3]))
        return n

    def _is_local_decl(self, loc):
        txt = self.src.slice(loc).lstrip()
        return txt.startswith("local ")

    def _scan(self, body, edits):
        for i, st in enumerate(body):
            done = False
            if st.get("type") == "AstStatWhile" and self._is_true(st.get("condition")):
                try:
                    done = self._try_loop(body, i, edits)
                except _Bail:
                    done = False
                except RecursionError:
                    done = False
            if not done:
                self._recurse(st, edits)

    def _recurse(self, node, edits):
        for c in _children(node):
            if c.get("type") == "AstStatBlock":
                self._scan(c.get("body", []), edits)
            else:
                self._recurse(c, edits)

    def run(self):
        edits = []
        self._scan(self.root.get("body", []), edits)
        if not edits:
            return self.text
        # keep only outermost edits (a nested dispatcher sliced verbatim by
        # its rebuilt parent is reached on the next fixpoint pass)
        edits.sort(key=lambda e: (e[0], e[1], -e[2], -e[3]))
        kept = []
        for e in edits:
            if kept and (e[0], e[1]) >= (kept[-1][0], kept[-1][1]) and (e[2], e[3]) <= (kept[-1][2], kept[-1][3]):
                continue
            kept.append(e)
        lines = self.text.split("\n")
        for l0, c0, l1, c1, rep in sorted(kept, key=lambda e: (e[0], e[1]), reverse=True):
            blines = [ln.encode("utf-8") for ln in lines]
            head = blines[l0][:c0].decode("utf-8")
            tail = blines[l1][c1:].decode("utf-8")
            new = head + rep + tail
            if not new.strip():
                del lines[l0:l1 + 1]
            else:
                lines[l0:l1 + 1] = new.split("\n")
        return "\n".join(lines)

    # ---- rendering --------------------------------------------------------
    def _render_items(self, items, indent):
        out = []
        for it in items:
            kind = it[0]
            if kind == "s":
                txt = self.src.slice(it[1])
                first = True
                for ln in txt.split("\n"):
                    out.append(indent + ln if first else ln)
                    first = False
            elif kind == "loop":
                out.append(indent + "while true do")
                out += self._render_items(it[1], indent + "\t")
                out.append(indent + "end")
            elif kind == "continue":
                out.append(indent + "continue")
            elif kind == "break":
                out.append(indent + "break")
            elif kind == "if":
                _, cond_loc, then_items, else_items = it
                out.append(indent + "if " + self.src.slice(cond_loc) + " then")
                out += self._render_items(then_items, indent + "\t")
                if else_items:
                    out.append(indent + "else")
                    out += self._render_items(else_items, indent + "\t")
                out.append(indent + "end")
        return out


def deflatten_text(text, exe, max_passes=8):
    """Return text with statically-traceable dispatch loops rebuilt into real
    control flow, or the original text unchanged if nothing could be proven or
    the exe is missing. Runs to a fixpoint so nested functions (sliced verbatim
    by the pass that de-flattens their parent) are reached on a later pass."""
    import sys
    import threading
    result = [text]

    def work():
        cur = text
        try:
            for _ in range(max_passes):
                out = _Deflattener(cur, exe).run()
                if out == cur:
                    break
                cur = out
                result[0] = cur     # keep every completed pass
        except Exception:  # noqa: BLE001 - _Bail and anything unexpected
            return

    # long state chains recurse deeply: run on a big stack, like the lifter
    old_limit = sys.getrecursionlimit()
    sys.setrecursionlimit(max(old_limit, 200000))
    old_size = threading.stack_size()
    try:
        threading.stack_size(256 * 1024 * 1024 - 4096)
        th = threading.Thread(target=work)
        th.start()
        th.join()
    finally:
        threading.stack_size(old_size)
        sys.setrecursionlimit(old_limit)
    return result[0]
