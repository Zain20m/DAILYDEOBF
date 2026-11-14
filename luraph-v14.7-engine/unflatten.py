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


class _Deflattener:
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

    # ---- small AST helpers ------------------------------------------------
    @staticmethod
    def _num(e):
        return e if isinstance(e, dict) and e.get("type") == "AstExprConstantNumber" else None

    @staticmethod
    def _local_ref(e):
        # a reference to a local variable -> its name, else None
        if isinstance(e, dict) and e.get("type") == "AstExprLocal":
            return (e.get("local") or {}).get("name")
        return None

    def _is_ctrl_cond(self, e, ctrl):
        """A boolean expression over control vars and numeric constants only."""
        if not isinstance(e, dict):
            return False
        t = e.get("type")
        if t == "AstExprGroup":
            return self._is_ctrl_cond(e["expr"], ctrl)
        if t == "AstExprUnary" and e.get("op") == "Not":
            return self._is_ctrl_cond(e["expr"], ctrl)
        if t == "AstExprBinary":
            op = e.get("op")
            if op in ("And", "Or"):
                return self._is_ctrl_cond(e["left"], ctrl) and self._is_ctrl_cond(e["right"], ctrl)
            if op in _CMP:
                return self._cmp_side(e["left"], ctrl) and self._cmp_side(e["right"], ctrl)
        return False

    def _cmp_side(self, e, ctrl):
        if isinstance(e, dict) and e.get("type") == "AstExprGroup":
            return self._cmp_side(e["expr"], ctrl)
        return self._local_ref(e) in ctrl or self._num(e) is not None

    # ---- discovery --------------------------------------------------------
    def _dispatch_cases(self, while_node, var):
        """{const: [statements]} if the while body is a pure `if var == C` chain, else None."""
        body = while_node["body"]["body"]
        if len(body) != 1 or body[0].get("type") != "AstStatIf":
            return None
        cases = {}
        node = body[0]
        while True:
            cond = node.get("condition")
            c = self._eq_const(cond, var)
            if c is None:
                return None
            if c in cases:
                return None
            cases[c] = node["thenbody"]["body"]
            els = node.get("elsebody")
            if els is None:
                break
            if els.get("type") == "AstStatIf":
                node = els
            elif els.get("type") == "AstStatBlock":
                inner = els["body"]
                if len(inner) == 1 and inner[0].get("type") == "AstStatIf":
                    node = inner[0]
                else:
                    # a trailing `else` that is not another dispatch arm
                    return None
            else:
                return None
        return cases

    def _eq_const(self, cond, var):
        """`var == C` -> C (int), else None."""
        if not isinstance(cond, dict):
            return None
        if cond.get("type") == "AstExprGroup":
            return self._eq_const(cond["expr"], var)
        if cond.get("type") != "AstExprBinary" or cond.get("op") != "CompareEq":
            return None
        l, r = cond["left"], cond["right"]
        if self._local_ref(l) == var and self._num(r) is not None:
            return int(self._num(r)["value"])
        if self._local_ref(r) == var and self._num(l) is not None:
            return int(self._num(l)["value"])
        return None

    def _control_vars(self, cases, seed):
        """Locals that only ever hold numeric constants and are only read in
        control conditions.  Grown to a fixpoint from the dispatch var."""
        assigned = {}           # name -> set of RHS kinds ("const"/"other")
        read_noncond = set()

        def walk(node, in_cond):
            if isinstance(node, list):
                for x in node:
                    walk(x, in_cond)
                return
            if not isinstance(node, dict):
                return
            t = node.get("type")
            if t == "AstStatAssign":
                vals = node.get("values", [])
                for i, tgt in enumerate(node.get("vars", [])):
                    nm = self._local_ref(tgt)
                    v = vals[i] if i < len(vals) else None
                    if nm is not None:
                        assigned.setdefault(nm, set()).add("const" if self._num(v) is not None else "other")
                    else:
                        walk(tgt, False)
                    if v is not None:
                        walk(v, in_cond)
                return
            if t == "AstStatLocal":
                vals = node.get("values", [])
                for i, loc in enumerate(node.get("vars", [])):
                    nm = loc.get("name")
                    v = vals[i] if i < len(vals) else None
                    assigned.setdefault(nm, set()).add("const" if self._num(v) is not None else "other")
                    if v is not None:
                        walk(v, in_cond)
                return
            if t == "AstStatCompoundAssign":
                nm = self._local_ref(node.get("var"))
                if nm is not None:
                    assigned.setdefault(nm, set()).add("other")
                walk(node.get("value"), in_cond)
                return
            if t == "AstExprLocal":
                if not in_cond:
                    read_noncond.add(self._local_ref(node))
                return
            if t in ("AstStatLocalFunction", "AstStatFunction", "AstExprFunction", "AstExprAnonymousFunction"):
                return      # a nested function has its own control vars
            if t == "AstStatIf":
                # condition reads do not disqualify a control var only when the
                # whole condition is itself a control expression; approximate by
                # marking simple comparisons as cond-context.
                walk(node.get("condition"), True)
                walk(node.get("thenbody"), in_cond)
                if node.get("elsebody"):
                    walk(node["elsebody"], in_cond)
                return
            for k, v in node.items():
                if k in ("type", "location", "op", "local", "name"):
                    continue
                walk(v, in_cond)

        walk([s for body in cases.values() for s in body], False)

        # A closure that *captures* an outer dispatch variable would break
        # constant-folding, so disqualify any name a nested function captures
        # from the outer scope.  A function's OWN locals (declared inside it)
        # are different variables -- even when they reuse a short name like
        # `n` -- so they must not disqualify the outer control var; we tell
        # them apart by the local's declaration location.
        in_func = set()
        FUNCS = ("AstStatLocalFunction", "AstStatFunction", "AstExprFunction", "AstExprAnonymousFunction")

        def captures(node, fnspan):
            if isinstance(node, list):
                for x in node:
                    captures(x, fnspan)
                return
            if not isinstance(node, dict):
                return
            t = node.get("type")
            if t == "AstExprGlobal" and fnspan is not None:
                in_func.add(node.get("global"))
            if t == "AstExprLocal" and fnspan is not None:
                decl = (node.get("local") or {}).get("location")
                if decl is not None and not _within(_loc(decl), fnspan):
                    in_func.add((node.get("local") or {}).get("name"))
            span = fnspan
            if t in FUNCS:
                span = _loc(node["location"])
            for k, v in node.items():
                if k in ("type", "location", "op", "local", "name"):
                    continue
                captures(v, span)

        captures([s for body in cases.values() for s in body], None)

        ctrl = set()
        for nm, kinds in assigned.items():
            if nm and kinds == {"const"} and nm not in read_noncond and nm not in in_func:
                ctrl.add(nm)
        if seed in in_func:
            return set()        # the dispatch var itself is captured: do not touch
        ctrl.add(seed)
        return ctrl

    def _writes_ctrl(self, node, ctrl):
        if isinstance(node, list):
            return any(self._writes_ctrl(x, ctrl) for x in node)
        if not isinstance(node, dict):
            return False
        t = node.get("type")
        if t == "AstStatAssign":
            if any(self._local_ref(v) in ctrl for v in node.get("vars", [])):
                return True
        if t == "AstStatCompoundAssign" and self._local_ref(node.get("var")) in ctrl:
            return True
        if t == "AstStatLocal":
            if any((v.get("name") in ctrl) for v in node.get("vars", [])):
                return True
        if t in ("AstStatLocalFunction", "AstStatFunction", "AstExprFunction", "AstExprAnonymousFunction"):
            return False     # a nested function's writes are its own
        for k, v in node.items():
            if k in ("type", "location", "op", "local", "name"):
                continue
            if self._writes_ctrl(v, ctrl):
                return True
        return False

    def _has_loop_jump(self, node):
        """A break/continue that would target the dispatch loop."""
        if isinstance(node, list):
            return any(self._has_loop_jump(x) for x in node)
        if not isinstance(node, dict):
            return False
        t = node.get("type")
        if t in ("AstStatBreak", "AstStatContinue"):
            return True
        if t in ("AstStatWhile", "AstStatRepeat", "AstStatFor", "AstStatForIn"):
            return False        # a nested loop captures its own break/continue
        if t in ("AstStatLocalFunction", "AstStatFunction", "AstExprFunction", "AstExprAnonymousFunction"):
            return False        # a nested function cannot break the outer loop
        for k, v in node.items():
            if k in ("type", "location", "op", "local", "name"):
                continue
            if self._has_loop_jump(v):
                return True
        return False

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
        if t == "AstExprLocal":
            nm = self._local_ref(e)
            if nm not in vals:
                raise _Bail("ctrl var read before set: %s" % nm)
            return vals[nm]
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
                return l == r
            if op == "CompareNe":
                return l != r
            if op == "CompareLt":
                return l < r
            if op == "CompareLe":
                return l <= r
            if op == "CompareGt":
                return l > r
            if op == "CompareGe":
                return l >= r
        raise _Bail("eval op")

    @staticmethod
    def _truth(v):
        return v is not False and v is not None

    def _apply_ctrl_assign(self, node, vals, ctrl):
        """Apply a pure control-var assignment to vals; True if it was one."""
        t = node.get("type")
        if t == "AstStatAssign":
            tgts = node.get("vars", [])
            vs = node.get("values", [])
            names = [self._local_ref(x) for x in tgts]
            if all(n in ctrl for n in names) and len(vs) == len(tgts):
                newv = [self._eval(v, vals) for v in vs]
                for n, v in zip(names, newv):
                    vals[n] = v
                return True
        if t == "AstStatLocal":
            locs = node.get("vars", [])
            vs = node.get("values", [])
            names = [l.get("name") for l in locs]
            if all(n in ctrl for n in names) and len(vs) == len(locs):
                newv = [self._eval(v, vals) for v in vs]
                for n, v in zip(names, newv):
                    vals[n] = v
                return True
        return False

    def _emit_case(self, stmts, vals, items, onpath, budget):
        """Execute one case body, appending emit-tree items. Returns:
        'stop' (a return ended this path), 'fork' (a real branch set the next
        state; its continuations are already structured into an if-item), or
        'fall' (control-var transition decides the next state at vals[var])."""
        ctrl = self._ctrl
        for idx, st in enumerate(stmts):
            t = st.get("type")
            if self._apply_ctrl_assign(st, vals, ctrl):
                continue
            if t == "AstStatIf" and self._is_ctrl_cond(st.get("condition"), ctrl) \
                    and not self._writes_ctrl_realonly(st):
                # pure control-dispatch if: concrete, so take exactly one arm
                arm = st["thenbody"]["body"] if self._truth(self._eval(st["condition"], vals)) \
                    else (st.get("elsebody") or {}).get("body", [])
                r = self._emit_case(arm, vals, items, onpath, budget)
                if r in ("stop", "fork"):
                    return r
                continue
            if self._has_loop_jump(st):
                raise _Bail("break/continue of the dispatch loop")
            if t == "AstStatIf" and self._writes_ctrl(st, ctrl):
                # a REAL branch (runtime condition) that sets the next state:
                # emit it as a genuine if/else and structure each continuation.
                # Require it to be the last statement of the case (Luraph's
                # shape); anything else is too tangled to prove.
                if idx != len(stmts) - 1:
                    raise _Bail("real fork is not the case terminator")
                if not self._is_ctrl_cond_free(st["condition"]):
                    pass  # condition may read real values; that is fine, it is emitted verbatim
                then_vals = dict(vals)
                else_vals = dict(vals)
                then_items = []
                else_items = []
                r1 = self._emit_case(st["thenbody"]["body"], then_vals, then_items, onpath, budget)
                els = (st.get("elsebody") or {}).get("body", [])
                r2 = self._emit_case(els, else_vals, else_items, onpath, budget)
                if r1 == "fall":
                    then_items += self._structure(then_vals, onpath, budget)
                if r2 == "fall":
                    else_items += self._structure(else_vals, onpath, budget)
                items.append(("if", _loc(st["condition"]["location"]), then_items, else_items))
                return "fork"
            if self._writes_ctrl(st, ctrl):
                raise _Bail("real statement writes a control var")
            # an ordinary statement (incl. a real if/loop that never touches a
            # control var): keep it verbatim by slicing its source.
            items.append(("s", _loc(st["location"])))
            budget[0] -= 1
            if budget[0] < 0:
                raise _Bail("budget")
            if t == "AstStatReturn" or self._is_terminal_call(st):
                # a return, or error("devirt: ...") / error(...) -- an unlifted
                # block or explicit trap halts this path, like a return.
                return "stop"
        return "fall"

    def _is_terminal_call(self, st):
        """True for `error(...)` (incl. the lifter's error(\"devirt: ...\")
        traps) used as a statement: it raises, so nothing after it runs."""
        if st.get("type") != "AstStatExpr":
            return False
        call = st.get("expr") or {}
        if call.get("type") != "AstExprCall":
            return False
        fn = call.get("func") or {}
        return (fn.get("type") == "AstExprGlobal" and fn.get("global") == "error")

    def _is_ctrl_cond_free(self, e):
        return True

    def _structure(self, vals, onpath, budget):
        """Structure the machine starting from the current state. Returns an
        emit-tree (list of items). Raises _Bail on a real loop or anything it
        cannot prove."""
        items = []
        var = self._var
        while True:
            state = vals[var]
            if state not in self._cases:
                return items                    # falls out of the dispatch loop
            key = (state,) + tuple(sorted((k, vals[k]) for k in self._ctrl if k in vals and k != var))
            if key in onpath:
                raise _Bail("state revisited (real loop)")
            onpath = onpath | {key}
            before = vals[var]
            r = self._emit_case(self._cases[state], vals, items, onpath, budget)
            if r in ("stop", "fork"):
                return items
            if vals[var] == before:
                raise _Bail("no progress")
        return items

    def _writes_ctrl_realonly(self, if_node):
        # a control-dispatch if whose arms are themselves only control
        # statements/dispatch; if an arm holds a real statement, treat the
        # whole if as real (handled by the real-statement path).
        def only_ctrl(stmts):
            for s in stmts:
                tt = s.get("type")
                if tt in ("AstStatAssign", "AstStatLocal"):
                    continue
                if tt == "AstStatIf" and self._is_ctrl_cond(s.get("condition"), self._ctrl):
                    if not only_ctrl(s["thenbody"]["body"]):
                        return False
                    if s.get("elsebody") and not only_ctrl(s["elsebody"]["body"]):
                        return False
                    continue
                return False
            return True
        return not only_ctrl(if_node["thenbody"]["body"]) or (
            if_node.get("elsebody") and not only_ctrl(if_node["elsebody"]["body"]))

    def _linearize(self, var, init, cases):
        self._var = var
        self._cases = cases
        self._ctrl = self._control_vars(cases, var)
        budget = [_MAXSTEPS]
        return self._structure({var: init}, frozenset(), budget)

    def run(self):
        edits = []              # (l0,c0,l1,c1, replacement_text)
        self._scan(self.root.get("body", []), edits)
        if not edits:
            return self.text
        # Keep only outermost edits: an outer dispatcher that de-flattens
        # slices any nested (still-flattened) function verbatim, so a nested
        # edit inside another edit's span must wait for the next fixpoint pass.
        edits.sort(key=lambda e: (e[0], e[1], -e[2], -e[3]))
        kept = []
        for e in edits:
            if kept and (e[0], e[1]) >= (kept[-1][0], kept[-1][1]) and (e[2], e[3]) <= (kept[-1][2], kept[-1][3]):
                continue        # contained in the previous (outer) edit
            kept.append(e)
        lines = self.text.split("\n")
        # apply from the bottom so earlier offsets stay valid
        for l0, c0, l1, c1, rep in sorted(kept, key=lambda e: (e[0], e[1]), reverse=True):
            blines = [ln.encode("utf-8") for ln in lines]
            head = blines[l0][:c0].decode("utf-8")
            tail = blines[l1][c1:].decode("utf-8")
            new_block = head + rep + tail
            lines[l0:l1 + 1] = new_block.split("\n")
        return "\n".join(lines)

    def _init_of(self, body, upto, var):
        """The constant `var` is set to by the nearest preceding sibling, and
        the index of that statement, or (None, None).  Only `local var = C` or
        `var = C` count, and nothing real may sit between it and the loop."""
        for j in range(upto - 1, -1, -1):
            st = body[j]
            t = st.get("type")
            if t == "AstStatLocal" and len(st.get("vars", [])) == 1 \
                    and st["vars"][0]["name"] == var:
                v = (st.get("values") or [None])[0]
                return (int(self._num(v)["value"]) if self._num(v) is not None else None), j
            if t == "AstStatAssign" and len(st.get("vars", [])) == 1 \
                    and self._local_ref(st["vars"][0]) == var:
                v = (st.get("values") or [None])[0]
                return (int(self._num(v)["value"]) if self._num(v) is not None else None), j
            # intervening bare `local x` / `local x = const` declarations are
            # fine (Luraph predeclares the control/temp locals); a real
            # statement before the loop means we cannot fold from a clean start
            if t == "AstStatLocal" and not st.get("values"):
                continue
            if t == "AstStatLocal" and all(self._num(v) is not None for v in st.get("values", [])):
                continue
            return None, None
        return None, None

    def _scan(self, body, edits):
        for i, st in enumerate(body):
            did = False
            if st.get("type") == "AstStatWhile" and self._is_true(st.get("condition")):
                try:
                    var = self._dispatch_var(st)
                    if var is not None:
                        cases = self._dispatch_cases(st, var)
                        if cases:
                            init, idx = self._init_of(body, i, var)
                            if init is not None:
                                emit = self._linearize(var, init, cases)
                                wl = _loc(st["location"])
                                startline = self.text.split("\n")[wl[0]]
                                rep = self._render(emit, wl)
                                # replace from the init statement through the loop
                                il = _loc(body[idx]["location"])
                                edits.append((il[0], il[1], wl[2], wl[3], rep))
                                did = True
                except _Bail:
                    pass
            if not did:
                self._recurse(st, edits)

    def _dispatch_var(self, while_node):
        """The variable a `while true do if V == C ... elseif V == C2 ...`
        chain dispatches on, or None."""
        b = while_node["body"]["body"]
        if len(b) != 1 or b[0].get("type") != "AstStatIf":
            return None
        cond = b[0].get("condition")
        if not isinstance(cond, dict) or cond.get("type") != "AstExprBinary" or cond.get("op") != "CompareEq":
            return None
        for side in (cond["left"], cond["right"]):
            nm = self._local_ref(side)
            if nm is not None:
                other = cond["right"] if side is cond["left"] else cond["left"]
                if self._num(other) is not None:
                    return nm
        return None

    def _render(self, emit, startloc):
        indent = re.match(r"[\t ]*", self.text.split("\n")[startloc[0]]).group(0)
        out = self._render_items(emit, indent)
        return "\n".join(out) if out else indent + "-- (control-flow-flattened block had no observable statements)"

    def _render_items(self, items, indent):
        out = []
        for it in items:
            if it[0] == "s":
                txt = self.src.slice(it[1])
                first = True
                for ln in txt.split("\n"):
                    out.append(indent + ln if first else ln)
                    first = False
            elif it[0] == "if":
                _, cond_loc, then_items, else_items = it
                cond = self.src.slice(cond_loc)
                out.append(indent + "if " + cond + " then")
                out += self._render_items(then_items, indent + "\t") or [indent + "\t-- (no statements)"]
                if else_items:
                    out.append(indent + "else")
                    out += self._render_items(else_items, indent + "\t")
                out.append(indent + "end")
        return out

    def _recurse(self, node, edits):
        if not isinstance(node, dict):
            return
        for k in ("body",):
            pass
        # function bodies, loop bodies, if arms
        for key, v in node.items():
            if key in ("type", "location", "op", "local", "name"):
                continue
            if isinstance(v, dict) and v.get("type") == "AstStatBlock":
                self._scan(v.get("body", []), edits)
            elif isinstance(v, dict):
                self._recurse(v, edits)
            elif isinstance(v, list):
                for x in v:
                    self._recurse(x, edits)

    @staticmethod
    def _is_true(cond):
        return isinstance(cond, dict) and cond.get("type") == "AstExprConstantBool" and cond.get("value") is True


def deflatten_text(text, exe, max_passes=8):
    """Return text with statically-traceable dispatch loops rebuilt into real
    control flow, or the original text unchanged if nothing could be proven or
    the exe is missing. Runs to a fixpoint so nested functions (sliced verbatim
    by the pass that de-flattens their parent) are reached on a later pass."""
    try:
        for _ in range(max_passes):
            out = _Deflattener(text, exe).run()
            if out == text:
                break
            text = out
        return text
    except _Bail:
        return text
    except Exception:
        return text
