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
    entry, blocks = ST.build_cfg(entry_key, order, D, link)
    if not os.environ.get("DEVIRT_NO_MERGE"):
        entry, _ = ST.merge_equivalent(entry, blocks, D)
    entry = ST.thread_empty(entry, blocks)
    LP.recognize(entry, blocks, D)

    entry = ST.thread_empty(entry, blocks)
    CG.simplify_blocks(blocks, D)
    own = set(VR.rename(entry, blocks, prefix, set()).values())
    names = {("up", i): nm for i, nm in (upnames or {}).items()}

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
    body = IDI.while_cond(body)     
    body = IDI.strip_trailing_continue(body)
    body = IDI.loop_vars(body)
    body = IDI.strip_trailing_return(body)
    if getattr(D, "INLINE_CONST_LOCALS", False):
        body = IDI.inline_const_locals(body)
        body = IDI.fold_single_use(body)    
    body = VR.declare(body, (), own)
    body = VR.limit_locals(body)
    body = VR.merge_local_assign(body)
    params = VR.extract_params(body)
    rend = CG.Renderer(names)
    return rend.block(body, ""), params, nerr, sr.fallbacks

def _paren_nil_prefix(text):
    """`nil.x` / `nil:m()` / `nil[k]` (a value the lift resolved to nil used
    as an object) is not valid Luau; `(nil).x` is, and keeps the meaning.
    Outside string literals only, and only kept if the file then parses."""
    import re
    if not re.search(r"(?<![\w.:'\"\]])nil\s*[.:\[]", text):
        return text
    out = []
    for line in text.split("\n"):
        if "nil" in line:
            def fix(m, line=line):
                before = line[:m.start()]
                if before.count('"') % 2 or before.count("'") % 2 or "--" in before:
                    return m.group(0)
                # a statement starting with `(` after a call is ambiguous: `;` first
                return (";(nil)" if not before.strip() else "(nil)") + m.group(1)
            line = re.sub(r"(?<![\w.:'\"\]])nil(\s*[.:\[])", fix, line)
        out.append(line)
    new = "\n".join(out)
    try:
        import tempfile, subprocess
        import harness
        with tempfile.NamedTemporaryFile("w", suffix=".luau", delete=False, encoding="utf-8", newline="\n") as f:
            f.write(new)
            path = f.name
        try:
            ok = subprocess.run([harness.luau_ast(), path], capture_output=True).returncode == 0
        finally:
            os.remove(path)
    except Exception:  # noqa: BLE001
        ok = False
    return new if ok else text


def polish(text):
    """Whole-program text passes: local names from use (names.py, unless
    DEVIRT_NO_NAMES), `local function` (localfuncs.py). Each is skipped
    with a warning if it fails."""
    import codegen
    text = text.replace(codegen.LONG_NL, "\n")     
    text = _paren_nil_prefix(text)
    if not os.environ.get("DEVIRT_NO_NAMES"):
        import names
        try:
            text = names.rename_text(text)
        except Exception as ex:  
            print("[!] naming pass failed: %s" % ex, file=sys.stderr)
    import localfuncs
    try:
        text = localfuncs.rewrite(text)
    except Exception as ex:  
        print("[!] local function pass failed: %s" % ex, file=sys.stderr)
    return text

def finish_text(text):
    """Blank lines between blocks (only for the final output, not every round),
    then a second naming pass over the finished code: names still generic
    (v12, arg, tbl3, fn20) from what the code does (names_refine.py)."""
    import spacing
    text = spacing.space(text)
    if os.environ.get("DEVIRT_NO_NAMES") or len(text) > int(os.environ.get("DEOB_REFINE_MAX", "600000")):
        return text
    try:
        import names_refine
        new = text
        for _ in range(3):
            nxt = names_refine.refine_text(new)
            if nxt == new:
                break
            new = nxt
        if new != text:
            import tempfile
            import harness
            with tempfile.NamedTemporaryFile("w", suffix=".luau", delete=False, encoding="utf-8",
                                             newline="\n") as f:
                f.write(new)
                tmp = f.name
            try:
                if harness.run_luau_ast(tmp).returncode != 0:
                    return text     # (renamed text that does not parse: keep the first names)
            finally:
                os.remove(tmp)
        return new
    except Exception as ex:  # noqa: BLE001 - keep the first pass's names
        print("[!] second naming pass failed: %s" % ex, file=sys.stderr)
        return text

def run_big_stack(fn, *a):
    """Deeply nested scripts need deep recursion: run in a thread with a big stack."""
    sys.setrecursionlimit(200000)
    threading.stack_size(256 * 1024 * 1024 - 4096)
    res = {}

    def target():
        try:
            res["v"] = fn(*a)
        except BaseException as ex:  
            res["e"] = ex
    t = threading.Thread(target=target)
    t.start()
    t.join()
    if "e" in res:
        raise res["e"]
    return res.get("v")
