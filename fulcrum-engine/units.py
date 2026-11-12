"""Stage 3: discover the tree of functions ("units") and turn Fulcrum's
register slots (plain locals, one-element boxes `r[1]`, table slots
`T[k][i][1]`, `T[k]`) into ordinary named variables."""
from luau_ast import *
from lift import (UnitLifter, interp_chunk, is_chunk_body, reachable, Unsupported,
                  stmt_exprs, fold_pure, Lin, Block)


class Unit:
    _n = 0

    def __init__(self):
        Unit._n += 1
        self.id = Unit._n
        self.parent = None
        self.children = []
        self.upvals = []        # outer variable names, in the order the unit receives them
        self.params = []
        self.vararg = False
        self.entry = None
        self.captured = set()   # variables shared with closures (never SSA)
        self.locals = set()     # every variable name owned by this unit
        self.warnings = []
        self.decoders = {}
        self.tname = None
        self.table_env = {}     # slot var -> raw rhs (for decoder evaluation)


class Context:
    """Whole-file information shared by all units."""

    def __init__(self, resolver, log):
        self.cap = set().union(*resolver.free.values()) if resolver.free else set()
        self.cachevars = set()
        self.log = log
        self.units = []
        self.decoders = {}      # name -> (func node, owning unit)
        self.strings = {}       # cache var -> bytes
        self.problems = []
        self.ndecoded = 0
        self.debug = False
        self._dec_env = {}

    def run_decoder(self, func, owner, vals):
        """Evaluate one of the script's own string decoders in the sandboxed
        mini evaluator (never in a real Lua runtime)."""
        import minilua
        env = self._dec_env.get(owner.id)
        if env is None:
            it = minilua.Interp()
            tb = minilua.Table()
            for name, rhs in owner.table_env.items():
                try:
                    tb.h[int(name.rsplit('_', 1)[1])] = it.expr(rhs, minilua.Scope(), ())
                except (minilua.LuaError, ValueError, TypeError, KeyError):
                    pass
            env = self._dec_env[owner.id] = tb
        tname = owner.tname
        it = minilua.Interp(lambda n: (True, env) if n == tname else (False, None))
        return it.call(func, [it.to_value(v) for v in vals])


def find_cache_vars(ast, ctx):
    """Cache variables: `if X == nil then ...; X = <tmp> end`."""
    found = set()

    def visit_block(body):
        for s in body:
            t = s[0]
            if t == 'if':
                if len(s[1]) == 1 and s[2] is None:
                    c, b = s[1][0]
                    if c[0] == 'bin' and c[1] == '==' and c[2][0] == 'name' and c[3][0] == 'nil' and b:
                        last = b[-1]
                        if last[0] == 'assign' and len(last[1]) == 1 and last[1][0] == c[2] and \
                                last[2][0][0] in ('name', 'index'):
                            found.add(c[2][1])
                for c in s[1]:
                    visit_block(c[1])
                if s[2] is not None:
                    visit_block(s[2])
            elif t in ('do',):
                visit_block(s[1])
            elif t == 'while':
                visit_block(s[2])
            elif t == 'repeat':
                visit_block(s[1])
            elif t == 'fornum':
                visit_block(s[5])
            elif t == 'forin':
                visit_block(s[3])
            for e in stmt_exprs(s):
                visit_expr(e)
            if t in ('function', 'localfunction'):
                visit_block(s[2][3])

    def visit_expr(e):
        t = e[0]
        if t == 'func':
            visit_block(e[3])
        elif t == 'index':
            visit_expr(e[1]); visit_expr(e[2])
        elif t == 'call':
            visit_expr(e[1])
            for a in e[2]:
                visit_expr(a)
        elif t == 'mcall':
            visit_expr(e[1])
            for a in e[3]:
                visit_expr(a)
        elif t == 'bin':
            visit_expr(e[2]); visit_expr(e[3])
        elif t in ('un', 'paren'):
            visit_expr(e[-1])
        elif t == 'table':
            for it in e[1]:
                if it[0] == 'expr':
                    visit_expr(it[1])
                visit_expr(it[2])
        elif t == 'ifexp':
            visit_expr(e[1]); visit_expr(e[2]); visit_expr(e[3])
    visit_block(ast)
    ctx.cachevars = found


# -- closure wrapper patterns ------------------------------------------------

def match_closure(e):
    """Returns (chunk_body, upvalue_arg_exprs) or None.

    A:  (function(p1..pn) return function(...) return (function(...) CHUNK end)(pa, pb, ..., ...) end end)(a1..an)
    B:  function(...) return (function(...) CHUNK end)(...) end
    """
    def middle(m):
        if m[0] != 'func' or m[1] or not m[2] or len(m[3]) != 1:
            return None
        r = m[3][0]
        if r[0] != 'return' or len(r[1]) != 1 or r[1][0][0] != 'call':
            return None
        c = r[1][0]
        f = c[1]
        if f[0] != 'paren' or f[1][0] != 'func':
            return None
        f = f[1]
        if f[1] or not f[2] or not is_chunk_body(f[3]):
            return None
        if not c[2] or c[2][-1][0] != 'vararg':
            return None
        return f[3], c[2][:-1]

    if e[0] == 'func':
        m = middle(e)
        if m:
            return m[0], m[1]      # upvalue boxes captured lexically
        return None
    if e[0] == 'call' and (e[1][0] == 'func' or (e[1][0] == 'paren' and e[1][1][0] == 'func')):
        w = e[1] if e[1][0] == 'func' else e[1][1]
        if w[2] or len(w[3]) != 1 or w[3][0][0] != 'return' or len(w[3][0][1]) != 1:
            return None
        m = middle(w[3][0][1][0])
        if not m:
            return None
        body, inner_args = m
        if len(e[2]) != len(w[1]):
            return None
        ups = []
        for a in inner_args:
            if a[0] != 'name' or a[1] not in w[1]:
                return None
            ups.append(e[2][w[1].index(a[1])])
        return body, ups
    return None


def map_expr(e, fn):
    """Post-order rewrite; fn(node) returns replacement or None. Does not
    enter raw functions or closures."""
    t = e[0]
    if t == 'index':
        e[1] = map_expr(e[1], fn); e[2] = map_expr(e[2], fn)
    elif t == 'call':
        e[1] = map_expr(e[1], fn)
        e[2] = [map_expr(a, fn) for a in e[2]]
    elif t == 'mcall':
        e[1] = map_expr(e[1], fn)
        e[3] = [map_expr(a, fn) for a in e[3]]
    elif t == 'bin':
        e[2] = map_expr(e[2], fn); e[3] = map_expr(e[3], fn)
    elif t in ('un', 'paren'):
        e[-1] = map_expr(e[-1], fn)
    elif t == 'table':
        for it in e[1]:
            if it[0] == 'expr':
                it[1] = map_expr(it[1], fn)
            it[2] = map_expr(it[2], fn)
    elif t == 'ifexp':
        e[1] = map_expr(e[1], fn); e[2] = map_expr(e[2], fn); e[3] = map_expr(e[3], fn)
    r = fn(e)
    return e if r is None else r


def map_block_exprs(b, fn):
    for s in b.stmts:
        if s[0] == 'assign':
            s[1] = [map_expr(x, fn) for x in s[1]]
            s[2] = [map_expr(x, fn) for x in s[2]]
        elif s[0] == 'local':
            s[2] = [map_expr(x, fn) for x in s[2]]
        elif s[0] == 'callstat':
            s[1] = map_expr(s[1], fn)
    t = b.term
    if t[0] == 'br':
        b.term = ('br', map_expr(t[1], fn), t[2], t[3])
    elif t[0] == 'ret':
        b.term = ('ret', [map_expr(x, fn) for x in t[1]])


def num_key(e):
    return e[1] if e[0] == 'num' else None


def build_unit(chunk_body, upnames, parent, ctx):
    u = Unit()
    u.parent = parent
    u.upvals = list(upnames)
    ctx.units.append(u)
    if parent is not None:
        parent.children.append(u)
    ch = interp_chunk(chunk_body)
    u.tname = ch.tname
    u.decoys = len(ch.funcs) - 1
    lifter = UnitLifter(ch.main, ch, ctx.log, ctx.cap, ctx.cachevars)
    u.entry = lifter.lift()
    blocks = reachable(u.entry)
    tname = ch.tname

    # ---- pass 1: prologue patterns
    boxes = set()
    regtables = set()
    tboxes = set()
    upmap = {}
    declared = set()
    for b in blocks:
        keep = []
        for s in b.stmts:
            t = s[0]
            if t == 'local':
                declared.update(s[1])
                if len(s[2]) == 1 and s[2][0][0] == 'vararg':
                    names = s[1]
                    if len(names) < len(u.upvals):
                        raise Unsupported('unit receives fewer values than it has upvalues')
                    for n, outer in zip(names, u.upvals):
                        upmap[n] = outer
                    u.params = list(names[len(u.upvals):])
                    continue
                if not s[2]:
                    continue
                if all(e[0] == 'nil' or (e[0] == 'table' and not e[1]) for e in s[2]) and len(s[2]) <= len(s[1]):
                    for n, e in zip(s[1], s[2]):
                        if e[0] == 'table':
                            boxes.add(n)
                    continue
                keep.append(['assign', [['name', n] for n in s[1]], s[2]])
                continue
            if t == 'assign' and len(s[1]) == 1 and len(s[2]) == 1 and s[2][0][0] == 'table' and not s[2][0][1]:
                tg = s[1][0]
                if tg[0] == 'index' and tg[1] == ['name', tname] and num_key(tg[2]) is not None:
                    regtables.add(tg[2][1]); continue
                if tg[0] == 'index' and tg[1][0] == 'index' and tg[1][1] == ['name', tname] and \
                        num_key(tg[1][2]) in regtables and num_key(tg[2]) is not None:
                    tboxes.add((tg[1][2][1], tg[2][1])); continue
            if t in ('function', 'localfunction'):
                raise Unsupported('function statement in unit')
            keep.append(s)
        b.stmts = keep
    if u.upvals and not upmap and u.upvals:
        raise Unsupported('unit with upvalues but no parameter prologue')

    def box_name(e):
        """bare box reference -> variable name, else None"""
        if e[0] == 'name':
            if e[1] in upmap:
                return upmap[e[1]]
            if e[1] in boxes:
                return e[1]
        if e[0] == 'index' and e[1][0] == 'index' and e[1][1] == ['name', tname] and \
                (num_key(e[1][2]), num_key(e[2])) in tboxes:
            return '%s__%d_%d' % (tname, e[1][2][1], e[2][1])
        return None

    # ---- pass 2: closures (need raw box references)
    pending = []
    built = {}

    def closures(e):
        m = match_closure(e)
        if m is None:
            return None
        body, ups = m
        names = []
        for a in ups:
            n = box_name(a)
            if n is None:
                raise Unsupported('closure captures something that is not a register box')
            names.append(n)
            u.captured.add(n)
        node = ['closure', None, names]
        pending.append((node, body, names))
        return node
    for b in blocks:
        map_block_exprs(b, closures)
    u.captured.update(upmap.values())

    # ---- pass 3: slot expressions -> variables
    bare = []

    def slots(e):
        if e[0] == 'index' and num_key(e[2]) == 1:
            n = box_name(e[1])
            if n is not None:
                return ['slot', n]
        if e[0] == 'index' and e[1] == ['name', tname] and num_key(e[2]) is not None \
                and e[2][1] not in regtables:
            return ['slot', '%s__%d' % (tname, e[2][1])]
        return None

    def unslot(e):
        if e[0] == 'slot':
            return ['name', e[1]]
        return None

    def check(e):
        if e[0] == 'name' and (e[1] in boxes or e[1] in upmap or e[1] == tname):
            bare.append(e[1])
            return ['name', e[1] + '_ESCAPED']
        return None
    for b in blocks:
        map_block_exprs(b, slots)
        map_block_exprs(b, check)
        map_block_exprs(b, unslot)
    if bare and ctx.debug:
        for b in blocks:
            for s_ in b.stmts:
                src = to_source([s_], ' ')
                if '_ESCAPED' in src:
                    ctx.log('ESC B%d: %s' % (b.id, src[:900]))
    if bare:
        u.warnings.append('register containers used as values: %s' % sorted(set(bare))[:8])

    # ---- variables
    names = set()

    def collect(e):
        if e[0] == 'name':
            names.add(e[1])
        return None
    for b in blocks:
        map_block_exprs(b, collect)
    u.locals = set(n for n in names if n not in ctx.cap or n in u.captured)
    u.ssa_vars = set(n for n in names
                     if n not in u.captured and n not in ctx.cap and not n.endswith('_ESCAPED'))

    # vararg usage
    def va(e):
        if e[0] == 'vararg':
            u.vararg = True
        return None
    for b in blocks:
        map_block_exprs(b, va)

    # decoders: `name = function(a, b, c) ... end` where name is shared with closures
    for b in blocks:
        keep = []
        for s in b.stmts:
            if s[0] == 'assign' and len(s[1]) == 1 and len(s[2]) == 1 and s[1][0][0] == 'name' \
                    and s[1][0][1] in ctx.cap and s[2][0][0] == 'func' and len(s[2][0][1]) == 3:
                ctx.decoders[s[1][0][1]] = (s[2][0], u)
                continue
            if s[0] == 'assign' and len(s[1]) == 1 and len(s[2]) == 1 and s[1][0][0] == 'name' \
                    and re.match(re.escape(tname) + r'__\d+$', s[1][0][1]):
                if s[2][0][0] != 'nil':
                    u.table_env.setdefault(s[1][0][1], s[2][0])
            keep.append(s)
        b.stmts = keep

    split_unexposed(u, blocks, set(upmap.values()))

    for node, body, names_ in pending:
        key = (id(body), tuple(names_))
        child = built.get(key)
        if child is None:
            child = built[key] = build_unit(body, names_, u, ctx)
        node[1] = child
    return u


def map_stmts_deep(body, fn):
    """Apply fn to every expression of a raw statement list, entering nested
    raw functions too."""
    def deep(e):
        if e[0] == 'func':
            map_stmts_deep(e[3], fn)
        return fn(e)

    def mexpr(e):
        return map_expr(e, deep)
    for s in body:
        t = s[0]
        if t == 'local':
            s[2] = [mexpr(x) for x in s[2]]
        elif t == 'assign':
            s[1] = [mexpr(x) for x in s[1]]
            s[2] = [mexpr(x) for x in s[2]]
        elif t == 'callstat':
            s[1] = mexpr(s[1])
        elif t == 'do':
            map_stmts_deep(s[1], fn)
        elif t == 'while':
            s[1] = mexpr(s[1]); map_stmts_deep(s[2], fn)
        elif t == 'repeat':
            map_stmts_deep(s[1], fn); s[2] = mexpr(s[2])
        elif t == 'if':
            for c in s[1]:
                c[0] = mexpr(c[0]); map_stmts_deep(c[1], fn)
            if s[2] is not None:
                map_stmts_deep(s[2], fn)
        elif t == 'fornum':
            s[2] = mexpr(s[2]); s[3] = mexpr(s[3])
            if s[4] is not None:
                s[4] = mexpr(s[4])
            map_stmts_deep(s[5], fn)
        elif t == 'forin':
            s[2] = [mexpr(x) for x in s[2]]
            map_stmts_deep(s[3], fn)
        elif t in ('function', 'localfunction'):
            map_stmts_deep(s[2][3], fn)
        elif t == 'return':
            s[1] = [mexpr(x) for x in s[1]]


def split_unexposed(u, blocks, inherited):
    """A register that is captured by a closure is shared memory only from
    the point where the first capturing closure is created.  Before that it
    is an ordinary local, so give that part of its life a separate name
    (`X__pre`) which can be put into SSA form."""
    own = [x for x in u.captured if x not in inherited]
    if not own:
        return
    own_set = set(own)

    def captures(stmt_or_exprs):
        found = set()

        def fn(e):
            if e[0] == 'closure':
                found.update(n for n in e[2] if n in own_set)
            return None
        for e in stmt_or_exprs:
            map_expr(e, fn)
        return found

    def exprs_of(s):
        if s[0] == 'assign':
            return s[1] + s[2]
        if s[0] == 'callstat':
            return [s[1]]
        return []

    gen = {}
    for b in blocks:
        g = set()
        for s in b.stmts:
            g |= captures(exprs_of(s))
        gen[b.id] = g
    preds = {b.id: [] for b in blocks}
    for b in blocks:
        for sc in b.succs():
            preds[sc.id].append(b)
    ein = {b.id: set() for b in blocks}
    eout = {b.id: set(gen[b.id]) for b in blocks}
    work = list(blocks)
    while work:
        b = work.pop()
        i = set()
        for p in preds[b.id]:
            i |= eout[p.id]
        o = i | gen[b.id]
        if i != ein[b.id] or o != eout[b.id]:
            ein[b.id] = i; eout[b.id] = o
            work.extend(b.succs())
    used_pre = set()
    for b in blocks:
        exp = set(ein[b.id])

        def ren(e):
            if e[0] == 'name' and e[1] in own_set and e[1] not in exp:
                used_pre.add(e[1])
                return ['name', e[1] + '__pre']
            return None
        out = []
        for s in b.stmts:
            new = captures(exprs_of(s)) - exp
            for x in sorted(new):
                out.append(['assign', [['name', x]], [['name', x + '__pre']]])
                used_pre.add(x)
            exp |= new
            if s[0] == 'assign':
                s[1] = [map_expr(x, ren) for x in s[1]]
                s[2] = [map_expr(x, ren) for x in s[2]]
            elif s[0] == 'callstat':
                s[1] = map_expr(s[1], ren)
            out.append(s)
        b.stmts = out
        t = b.term
        if t[0] == 'br':
            b.term = ('br', map_expr(t[1], ren), t[2], t[3])
        elif t[0] == 'ret':
            b.term = ('ret', [map_expr(x, ren) for x in t[1]])
    # materialise on edges that go from "not yet shared" to "shared"
    for b in list(blocks):
        t = b.term
        succs = b.succs()
        for idx, sc in enumerate(succs):
            need = sorted(ein[sc.id] - eout[b.id])
            if not need:
                continue
            nb = Block()
            nb.stmts = [['assign', [['name', x]], [['name', x + '__pre']]] for x in need]
            nb.term = ('goto', sc)
            used_pre.update(need)
            if t[0] == 'goto':
                b.term = ('goto', nb)
            else:
                lst = list(b.term)
                lst[2 + idx] = nb
                b.term = tuple(lst)
            t = b.term
    for x in used_pre:
        u.ssa_vars.add(x + '__pre')
        u.locals.add(x + '__pre')
