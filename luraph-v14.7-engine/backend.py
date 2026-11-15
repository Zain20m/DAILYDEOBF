"""
Lifter back end, shared by every devirtualizer front end.

A front end walks one VM function and produces its instruction graph as
`order`: [(state key, ir.Node)], where a state key is a tuple starting
(mode, pc, ...) and ir.Next(state).state.key(link) names the successor.
lower() turns that into Luau lines: CFG (structure.build_cfg), loops,
simplification, variables, structuring (goto elimination), idioms, render.
The text passes (polish, finish) run once on the whole program.
"""
import os
import sys
import threading


def lower(entry_key, order, D, link, prefix, upnames, closure):
    """Luau lines of one function.

    D        the IR module (ir.py, or a front end that re-exports it)
    link     passed to state.key() for successor keys (the front end's loop-stack link)
    prefix   register name prefix for this nesting depth
    upnames  {upvalue index: name} of the function's upvalues
    closure  closure(ClosureExpr, names) -> codegen.FuncE: lifts a child
             function once its captured variables have names

    Returns (lines, params, unlifted block count, unstructured jump count)."""
    import structure as ST
    import codegen as CG
    import loops as LP
    import variables as VR
    import idioms as IDI
    from luasym import ClosureExpr, Pseudo
    def cfg(loops):
        entry, blocks = ST.build_cfg(entry_key, order, D, link)
        _drop_dead_temps(blocks, D)
        if not os.environ.get("DEVIRT_NO_MERGE"):
            entry, _ = ST.merge_equivalent(entry, blocks, D)
        entry = ST.thread_empty(entry, blocks)
        if loops:
            LP.recognize(entry, blocks, D)
            # dropping the VM's loop bookkeeping leaves empty hops (e.g. `break` paths)
            entry = ST.thread_empty(entry, blocks)
        CG.simplify_blocks(blocks, D)
        return entry, blocks

    entry, blocks = cfg(True)
    pseudo_names = set()
    if any(b.kind in ("for", "forin") for b in blocks.values()) and _needs_fallback(entry, blocks, ST):
        # A recovered `for` the structurer cannot place would come out as
        # error("devirt: unstructured jump") lines, and the always-correct
        # state machine cannot hold a `for`: lift this function without loop
        # recognition instead, keeping the VM's loop state as plain locals.
        entry, blocks = cfg(False)
        pseudo_names = _pseudo_to_locals(blocks, CG, Pseudo)
    own = set(VR.rename(entry, blocks, prefix, set()).values()) | pseudo_names
    names = {("up", i): nm for i, nm in (upnames or {}).items()}

    # child closures, now that the captured variables have names
    def conv(x):
        return closure(x, names) if isinstance(x, ClosureExpr) else None
    for b in blocks.values():
        for i, s_ in enumerate(b.stmts):
            if isinstance(s_, CG.AssignS):
                s_.values = CG.map_multi(s_.values, conv)
                s_.targets = [t if isinstance(t, (CG.LocalName, Pseudo)) else CG.map_expr(t, conv)
                              for t in s_.targets]
            elif isinstance(s_, (CG.CallS, CG.TempDef, CG.SetListS, CG.ForPrepS)):
                b.stmts[i] = CG.map_stmt(s_, lambda e: CG.map_expr(e, conv), lambda m: CG.map_multi(m, conv))
        if b.kind == "cond":
            b.cond = CG.map_expr(b.cond, conv)
        elif b.kind == "ret" and b.values is not None:
            b.values = CG.map_multi(b.values, conv)

    nerr = sum(1 for b in blocks.values() if b.kind == "error")
    entry, body, sr = ST.structure(entry, blocks, own)
    body = ST.cleanup(body)
    body = IDI.drop_blank_branches(body)
    body = IDI.and_or(body)
    body = IDI.fold_single_use(body)
    body = IDI.while_cond(body)
    body = IDI.strip_trailing_continue(body)
    body = IDI.conditions(body)
    body = IDI.while_cond(body)     # (again: `conditions` joins nested ifs into one `and` test)
    body = IDI.strip_trailing_continue(body)
    body = IDI.loop_vars(body)
    body = IDI.strip_trailing_return(body)
    if getattr(D, "INLINE_CONST_LOCALS", False):
        body = IDI.inline_const_locals(body)
        body = IDI.fold_single_use(body)    # (literals no longer stand between a temp and its use)
    body = VR.declare(body, (), own)
    body = VR.limit_locals(body)
    body = VR.merge_local_assign(body)
    params = VR.extract_params(body)
    rend = CG.Renderer(names)
    return rend.block(body, ""), params, nerr, sr.fallbacks


def polish(text):
    """Whole-program text passes: control-flow de-flattening (unflatten.py,
    unless DEVIRT_NO_UNFLATTEN), local names from use (names.py, unless
    DEVIRT_NO_NAMES), `local function` (localfuncs.py). Each is skipped
    with a warning if it fails."""
    import codegen
    text = text.replace(codegen.LONG_NL, "\n")     # long strings' newlines, kept out of re-indenting
    # De-flatten first, so the naming pass sees the recovered structure.
    if not os.environ.get("DEVIRT_NO_UNFLATTEN"):
        try:
            import unflatten
            from obfuscators.luraph_v14_9.vmmap import luau_ast_executable
            before = text
            text = unflatten.deflatten_text(text, luau_ast_executable())
            # the pass verifies internally, but re-parse the whole file as a
            # final backstop: if anything is off, keep the un-touched text
            if text is not before and text != before:
                import tempfile
                import subprocess
                with tempfile.NamedTemporaryFile("w", suffix=".luau", delete=False, encoding="utf-8", newline="\n") as f:
                    f.write(text)
                    p = f.name
                try:
                    if subprocess.run([luau_ast_executable(), p], capture_output=True).returncode != 0:
                        print("[!] de-flatten produced invalid Luau; kept the flattened form", file=sys.stderr)
                        text = before
                finally:
                    os.remove(p)
        except Exception as ex:  # noqa: BLE001 - keep the flattened form
            print("[!] de-flatten pass failed: %s" % ex, file=sys.stderr)
    if not os.environ.get("DEVIRT_NO_NAMES"):
        import names
        try:
            text = names.rename_text(text)
        except Exception as ex:  # noqa: BLE001 - keep the register names
            print("[!] naming pass failed: %s" % ex, file=sys.stderr)
    import localfuncs
    try:
        text = localfuncs.rewrite(text)
    except Exception as ex:  # noqa: BLE001
        print("[!] local function pass failed: %s" % ex, file=sys.stderr)
    return text


def finish_text(text):
    """Blank lines between blocks (only for the final output, not every round)."""
    import spacing
    return spacing.space(text)


def run_big_stack(fn, *a):
    """Deeply nested scripts need deep recursion: run in a thread with a big stack."""
    sys.setrecursionlimit(200000)
    threading.stack_size(256 * 1024 * 1024 - 4096)
    res = {}

    def target():
        try:
            res["v"] = fn(*a)
        except BaseException as ex:  # noqa: BLE001
            res["e"] = ex
    t = threading.Thread(target=target)
    t.start()
    t.join()
    if "e" in res:
        raise res["e"]
    return res.get("v")


def _drop_dead_temps(blocks, D):
    """Drop stores to micro-instruction temp registers (devirt
    TEMP_REG_BASE and up) that nothing reads: the VM's scratch values left
    over at the end of an instruction (FORLOOP's `g = d >= o`). Left in,
    they hide Luraph's for-loop protocol from loops.py."""
    base = getattr(D, "TEMP_REG_BASE", None)
    if base is None:
        return
    from luasym import Reg

    def is_temp(e):
        return isinstance(e, Reg) and isinstance(e.n, int) and e.n >= base

    while True:
        read = set()
        for b in blocks.values():
            todo = [getattr(b, "cond", None), getattr(b, "values", None)]
            for s_ in b.stmts:
                todo.append(s_.value if isinstance(s_, D.Assign) and is_temp(s_.target) else s_)
            seen = set()
            while todo:
                x = todo.pop()
                if x is None or isinstance(x, (str, bytes, int, float, bool)) or id(x) in seen:
                    continue
                seen.add(id(x))
                if is_temp(x):
                    read.add(x.n)
                elif isinstance(x, (list, tuple)):
                    todo.extend(x)
                elif isinstance(x, dict):
                    todo.extend(x.values())
                elif hasattr(x, "__dict__") and not isinstance(x, type):
                    todo.extend(x.__dict__.values())
        dropped = False
        for b in blocks.values():
            keep = [s_ for s_ in b.stmts if not (isinstance(s_, D.Assign) and is_temp(s_.target)
                                                 and s_.target.n not in read)]
            if len(keep) != len(b.stmts):
                b.stmts = keep
                dropped = True
        if not dropped:
            return


PROBE_ROUNDS = int(os.environ.get("DEVIRT_PROBE_ROUNDS", "60"))


def _shallow_copy(blocks, ST):
    out = {}
    for k, b in blocks.items():
        c = ST.Block(b.id)
        for a in ST.Block.__slots__:
            v = getattr(b, a)
            setattr(c, a, list(v) if isinstance(v, list) else v)
        out[k] = c
    return out


def _needs_fallback(entry, blocks, ST):
    """Whether structuring this graph leaves gotos (on a copy)."""
    try:
        _, _, sr = ST.structure(entry, _shallow_copy(blocks, ST), set(), rounds=PROBE_ROUNDS)
    except Exception:  # noqa: BLE001 - treat as unstructurable
        return True
    return bool(sr.fallbacks)


def _pseudo_to_locals(blocks, CG, Pseudo):
    """VM loop slots (Pseudo) as locals named like them (`Z_1`)."""
    names = set()

    def fn(x):
        if isinstance(x, Pseudo):
            nm = "%s_%d" % (x.name, x.depth)
            names.add(nm)
            return CG.LocalName(nm)
        return None
    for b in blocks.values():
        for i, s_ in enumerate(b.stmts):
            if isinstance(s_, CG.AssignS):
                s_.values = CG.map_multi(s_.values, fn)
                s_.targets = [fn(t) or CG.map_expr(t, fn) for t in s_.targets]
            else:
                b.stmts[i] = CG.map_stmt(s_, lambda e: CG.map_expr(e, fn), lambda m: CG.map_multi(m, fn))
        if b.cond is not None:
            b.cond = CG.map_expr(b.cond, fn)
        if b.kind == "ret" and b.values is not None:
            b.values = CG.map_multi(b.values, fn)
    return names
