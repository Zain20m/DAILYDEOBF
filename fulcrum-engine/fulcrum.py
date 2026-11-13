"""Fulcrum (polsec.net) Luau deobfuscator -- library entry point.

Pipeline
    parse      -> luau_ast        (tolerant Luau parser/printer)
    scope      -> scope           (unique-rename every local binding)
    extract    -> units           (walk the chunk/closure wrappers; find units)
    lift       -> lift            (partial-evaluate each flattened dispatcher
                                    into a basic-block control-flow graph)
    decode     -> minilua         (run the sample's own string decoders in a
                                    sandbox; fold the results in)
    simplify   -> ssa             (SSA, const/copy propagation, DCE, folding)
    structure  -> structure/emit  (rebuild if/while/break/continue; correct
                                    state-machine fallback for irreducible loops)
    coalesce   -> coalesce        (fold single-use temporaries, re-sugar methods)

Nothing from the sample is executed in a real Lua runtime; only the pure
string-decoder functions run, and only inside the restricted evaluator.
"""
import os
import re
import hashlib
from luau_ast import parse, to_source
from scope import resolve
from lift import reachable
from units import (Context, find_cache_vars, build_unit, map_expr)
from ssa import SSA
import emit as EM
import coalesce
import structure


class Result:
    pass


def _apply_exprs(stmts, fn):
    def E(e):
        return map_expr(e, fn)
    for s in stmts:
        t = s[0]
        if t == 'assign':
            s[1] = [E(x) for x in s[1]]; s[2] = [E(x) for x in s[2]]
        elif t == 'local':
            s[2] = [E(x) for x in s[2]]
        elif t == 'callstat':
            s[1] = E(s[1])
        elif t == 'return':
            s[1] = [E(x) for x in s[1]]
        elif t == 'if':
            for c in s[1]:
                c[0] = E(c[0]); _apply_exprs(c[1], fn)
            if s[2]:
                _apply_exprs(s[2], fn)
        elif t == 'while':
            s[1] = E(s[1]); _apply_exprs(s[2], fn)
        elif t == 'repeat':
            _apply_exprs(s[1], fn); s[2] = E(s[2])
        elif t == 'do':
            _apply_exprs(s[1], fn)
        elif t == 'fornum':
            s[2] = E(s[2]); s[3] = E(s[3])
            if s[4] is not None:
                s[4] = E(s[4])
            _apply_exprs(s[5], fn)
        elif t == 'forin':
            s[2] = [E(x) for x in s[2]]; _apply_exprs(s[3], fn)
        elif t in ('function', 'localfunction'):
            _apply_exprs(s[2][3], fn)
    return stmts


def _slot_re(tname):
    return re.compile(re.escape(tname) + r'__\d+$')


def recover(text, log=lambda *a: None):
    r = Result()
    r.sha256 = hashlib.sha256(text.encode('utf-8', 'surrogateescape')).hexdigest()
    r.size = len(text)
    ast = parse(text)
    res = resolve(ast)
    ctx = Context(res, log)
    find_cache_vars(ast, ctx)
    build_unit(ast, [], None, ctx)
    r.ctx = ctx

    # SSA + decode + simplify
    for u in ctx.units:
        u.ssa = SSA(u, ctx)
        srx = _slot_re(u.tname)
        u.ssa.table_slot = set(n for n in u.ssa_vars if srx.match(n))
        u.ssa.build()
        u.ssa.optimize()
        for b in u.ssa.blocks:
            for s in b.stmts:
                if s[0] == 'assign' and len(s[1]) == 1 and s[1][0][0] == 'name' \
                        and s[1][0][1] in ctx.cachevars:
                    if s[2][0][0] == 'str':
                        old = ctx.strings.get(s[1][0][1])
                        if old is not None and old != s[2][0][1]:
                            ctx.problems.append('cache var %s decodes inconsistently' % s[1][0][1])
                        ctx.strings[s[1][0][1]] = s[2][0][1]

    # inline constant cache strings everywhere (never a bare assignment target)
    const_str = {}
    for u in ctx.units:
        for b in u.ssa.blocks:
            keep = []
            for s in b.stmts:
                if s[0] == 'assign' and len(s[1]) == 1 and s[1][0][0] == 'name' \
                        and s[1][0][1] in ctx.strings and len(s[2]) == 1 and s[2][0][0] == 'str':
                    const_str[s[1][0][1]] = s[2][0][1]
                    continue
                keep.append(s)
            b.stmts = keep

    def sub(e):
        if e[0] == 'name' and e[1] in const_str:
            return ['str', const_str[e[1]]]
        return None
    for u in ctx.units:
        for b in u.ssa.blocks:
            for s in b.stmts:
                if s[0] == 'assign':
                    s[2] = [map_expr(x, sub) for x in s[2]]
                    s[1] = [x if x[0] == 'name' else map_expr(x, sub) for x in s[1]]
                elif s[0] == 'local':
                    s[2] = [map_expr(x, sub) for x in s[2]]
                elif s[0] == 'callstat':
                    s[1] = map_expr(s[1], sub)
            for ph in b.phis:
                for k in list(ph.args):
                    ph.args[k] = map_expr(ph.args[k], sub)
            t = b.term
            if t[0] == 'br':
                b.term = ('br', map_expr(t[1], sub), t[2], t[3])
            elif t[0] == 'ret':
                b.term = ('ret', [map_expr(x, sub) for x in t[1]])
        u.ssa.optimize()
    ctx.unresolved_cache = sorted(set(ctx.strings) - set(const_str))

    # structure + emit + coalesce
    r.structured = r.fallback_units = 0
    for u in ctx.units:
        EM.emit_unit(u)
        coalesce.run(u._body)
        if getattr(u, 'fallback', False):
            r.fallback_units += 1
        else:
            r.structured += 1

    # assemble: hoist locals, splice child closures by value
    funcs = {}
    declared = {}
    spilled = {}
    for u in ctx.units:
        acc = set()
        EM.collect_names(u._body, acc)
        # parameters and variables inherited from the enclosing function
        # (upvalues) must not be redeclared: a new local would shadow them
        params = set(u.params) | set(u.upvals)
        locals_ = [n for n in sorted(acc)
                   if n not in params and n.isidentifier() and not n.startswith('__')]
        declared[u.id] = set(locals_) | set(u.params)
        head = []
        if len(locals_) > _MAX_LOCALS:
            # Luau allows 200 locals / 255 registers per function: keep the
            # most used variables as locals, the rest become fields of one table
            loopv = set()
            _loop_vars(u._body, loopv)
            uses = {}
            _count_names(u._body, uses)
            order = sorted((n for n in locals_ if n not in loopv), key=lambda n: (-uses.get(n, 0), n))
            keep_n = _MAX_LOCALS - 1 - len([n for n in locals_ if n in loopv])
            spill = set(order[max(keep_n, 0):])
            tname = '__vars%d' % u.id
            spilled[u.id] = (spill, tname)
            locals_ = [n for n in locals_ if n not in spill]
            head.append(['local', [tname], [['table', []]]])
        for i in range(0, len(locals_), 50):
            head.insert(i // 50, ['local', locals_[i:i + 50], []])
        funcs[u.id] = ['func', list(u.params), u.vararg, head + u._body]
    for u in ctx.units:
        if u.id in spilled:
            spill, tname = spilled[u.id]
            _spill_rename(u, spill, tname, funcs, declared)
    for u in ctx.units:
        EM.substitute_closures(funcs[u.id][3], lambda c: funcs[c.id])

    # decoded cache strings inside plain nested functions (which the per-unit
    # pass above does not enter); names are unique after scope resolution
    _deep_const(funcs[ctx.units[0].id][3], const_str)
    _simplify_bool(funcs[ctx.units[0].id][3])
    _apply_exprs(funcs[ctx.units[0].id][3], _make_resugar())
    r.program = funcs[ctx.units[0].id][3]
    r.funcs = funcs
    return r


_MAX_LOCALS = 150


def _loop_vars(stmts, out):
    for s in stmts:
        if s[0] == 'fornum':
            out.add(s[1]); _loop_vars(s[5], out)
        elif s[0] == 'forin':
            out.update(s[1]); _loop_vars(s[3], out)
        elif s[0] == 'if':
            for c in s[1]:
                _loop_vars(c[1], out)
            if s[2]:
                _loop_vars(s[2], out)
        elif s[0] == 'while':
            _loop_vars(s[2], out)
        elif s[0] in ('repeat', 'do'):
            _loop_vars(s[1], out)


def _count_names(node, acc):
    if isinstance(node, list):
        if node and node[0] == '__closure':
            return
        if len(node) == 2 and node[0] == 'name' and isinstance(node[1], str):
            acc[node[1]] = acc.get(node[1], 0) + 1
            return
        for x in node:
            _count_names(x, acc)


def _rename_to_field(node, names, tname):
    """['name', n] -> tname.n for n in names; stops at child-unit placeholders"""
    if not isinstance(node, list) or not node:
        return node
    if node[0] == '__closure':
        return node
    if len(node) == 2 and node[0] == 'name' and node[1] in names:
        return ['index', ['name', tname], ['str', node[1].encode()]]
    if node[0] == 'local' and len(node) == 3 and isinstance(node[1], list):
        # a declaration of a spilled name (never emitted for hoisted ones) stays as is
        node[2] = [_rename_to_field(x, names, tname) for x in node[2]]
        return node
    for i, x in enumerate(node):
        if isinstance(x, list):
            node[i] = _rename_to_field(x, names, tname)
    return node


def _spill_rename(u, names, tname, funcs, declared):
    _rename_to_field(funcs[u.id][3], names, tname)
    # nested functions see the same variables (as upvalues) unless they declare their own
    for c in u.children:
        _spill_rename(c, names - declared[c.id], tname, funcs, declared)


def _deep_const(node, const_str):
    """Replace reads of constant cache variables everywhere, including inside
    raw function expressions. Bare assignment targets are left alone."""
    if not isinstance(node, list):
        return node
    if node and node[0] == 'name' and len(node) == 2 and isinstance(node[1], str):
        v = const_str.get(node[1])
        return ['str', v] if v is not None else node
    if node and node[0] == 'assign' and len(node) == 3:
        node[1] = [t if t[0] == 'name' else _deep_const(t, const_str) for t in node[1]]
        node[2] = [_deep_const(x, const_str) for x in node[2]]
        return node
    for i, x in enumerate(node):
        if isinstance(x, list):
            node[i] = _deep_const(x, const_str)
    return node


_CMP = ('==', '~=', '<', '<=', '>', '>=')


def _unparen(e):
    while e[0] == 'paren':
        e = e[1]
    return e


def _is_not(e):
    return e[0] == 'un' and e[1] == 'not'


def _bool_expr(e):
    """simplify `not` chains; every rewrite holds for all Lua values"""
    if not isinstance(e, list) or not e or not isinstance(e[0], str):
        return e
    e = [_bool_expr(x) if isinstance(x, list) and x and isinstance(x[0], str)
         else ([_bool_expr(y) for y in x] if isinstance(x, list) else x) for x in e]
    if _is_not(e):
        a = _unparen(e[2])
        if _is_not(a) and _is_not(_unparen(a[2])):
            return _bool_expr(['un', 'not', _unparen(a[2])[2]])     # not not not x -> not x
        if _is_not(a) and _unparen(a[2])[0] == 'bin' and _unparen(a[2])[1] in _CMP:
            return a[2]                                             # not not (a < b) -> (a < b)
        if a[0] == 'bin' and a[1] in ('==', '~='):
            return ['paren', ['bin', '~=' if a[1] == '==' else '==', a[2], a[3]]]
    return e


def _cond(e):
    """in a condition only truthiness matters: not not x -> x"""
    e = _bool_expr(e)
    while _is_not(e) and _is_not(_unparen(e[2])):
        e = _unparen(e[2])[2]
    u = _unparen(e)
    return u if u[0] == 'bin' else e


def _simplify_bool(stmts):
    def E(e):
        e = _bool_expr(e)
        funcs(e)
        return e

    def funcs(e):
        if isinstance(e, list) and e and isinstance(e[0], str):
            if e[0] == 'func':
                _simplify_bool(e[3])
                return
            for x in e[1:]:
                if isinstance(x, list):
                    if x and isinstance(x[0], str):
                        funcs(x)
                    else:
                        for y in x:
                            funcs(y)

    for s in stmts:
        t = s[0]
        if t == 'assign':
            s[1] = [E(x) for x in s[1]]
            s[2] = [E(x) for x in s[2]]
        elif t == 'local':
            s[2] = [E(x) for x in s[2]]
        elif t == 'callstat':
            s[1] = E(s[1])
        elif t == 'return':
            s[1] = [E(x) for x in s[1]]
        elif t == 'if':
            for c in s[1]:
                c[0] = _cond(c[0])
                funcs(c[0])
                _simplify_bool(c[1])
            if s[2]:
                _simplify_bool(s[2])
        elif t == 'while':
            s[1] = _cond(s[1])
            funcs(s[1])
            _simplify_bool(s[2])
        elif t == 'repeat':
            _simplify_bool(s[1])
            s[2] = _cond(s[2])
            funcs(s[2])
        elif t == 'do':
            _simplify_bool(s[1])
        elif t == 'fornum':
            s[2], s[3] = E(s[2]), E(s[3])
            if s[4] is not None:
                s[4] = E(s[4])
            _simplify_bool(s[5])
        elif t == 'forin':
            s[2] = [E(x) for x in s[2]]
            _simplify_bool(s[3])
        elif t in ('function', 'localfunction'):
            _simplify_bool(s[2][3])


def _make_resugar():
    def simple(e):
        return e[0] in ('name', 'global') or (e[0] == 'index' and simple(e[1]) and e[2][0] == 'str')

    def eq(a, b):
        if a[0] != b[0]:
            return False
        if a[0] in ('name', 'global', 'str'):
            return a[1] == b[1]
        if a[0] == 'index':
            return eq(a[1], b[1]) and eq(a[2], b[2])
        return False

    def resugar(e):
        if not isinstance(e, list) or not e or not isinstance(e[0], str):
            return e
        e = [resugar(x) if isinstance(x, list) and x and isinstance(x[0], str)
             else ([resugar(y) for y in x] if isinstance(x, list) else x) for x in e]
        if e[0] == 'call' and e[1][0] == 'index' and e[1][2][0] == 'str' \
                and simple(e[1][1]) and e[2] and eq(e[2][0], e[1][1]):
            try:
                ident = e[1][2][1].decode('ascii')
            except UnicodeDecodeError:
                ident = None
            if ident and re.match(r'^[A-Za-z_]\w*$', ident):
                return ['mcall', e[1][1], ident, e[2][1:]]
        return e
    return resugar


def recovered_source(r, banner=True):
    out = []
    if banner:
        out.append('-- Recovered from a Fulcrum (polsec.net) obfuscated Luau script.')
        out.append('-- SHA-256 of input: %s' % r.sha256)
        out.append('-- Behaviour-preserving reconstruction. %d/%d functions structured; '
                   '%d use an explicit state machine (irreducible control flow).'
                   % (r.structured, r.structured + r.fallback_units, r.fallback_units))
        out.append('-- See REPORT.md for coverage and unresolved items.')
        out.append('')
    out.append(to_source(r.program))
    return '\n'.join(out)
