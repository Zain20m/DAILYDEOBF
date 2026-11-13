"""Stage 2: remove Fulcrum's control-flow flattening.

A Fulcrum "chunk" is
    local <slots>, T, ...            -- T is the opaque-constant table
    for i = a, b, step do <if-tree on i> end
whose iterations fill T with constants, define the real function ("unit")
and finally `return unit(...)`.

A "unit" is a function whose body is a dispatcher loop driven by a rolling
key and several state variables.  We partially evaluate the unit: everything
that only depends on dispatcher state is executed here, everything else is
emitted into basic blocks of a control-flow graph.
"""
from luau_ast import *

MAX_NODES = 20000
DEBUG_VARS = set()


class Unsupported(Exception):
    pass


class Lin:
    """Number of the form coef*K + c, K = symbolic initial rolling key."""
    __slots__ = ('a', 'c')

    def __init__(self, a, c):
        self.a = a; self.c = c

    def __eq__(self, o):
        return isinstance(o, Lin) and o.a == self.a and o.c == self.c

    def __hash__(self):
        return hash((self.a, self.c))

    def __repr__(self):
        return 'Lin(%r,%r)' % (self.a, self.c)


def num(v):
    return Lin(0, v)


def lit(v):
    """Constant value -> AST literal."""
    if v is None:
        return ['nil']
    if v is True:
        return ['true']
    if v is False:
        return ['false']
    if isinstance(v, Lin):
        if v.a != 0:
            raise Unsupported('dispatcher key leaks into program data')
        return ['num', v.c]
    if isinstance(v, bytes):
        return ['str', v]
    raise Unsupported('cannot materialise %r' % (v,))


def as_const(e):
    """AST literal -> (True, value) or (False, None)."""
    t = e[0]
    if t == 'num':
        return True, Lin(0, e[1])
    if t == 'true':
        return True, True
    if t == 'false':
        return True, False
    if t == 'nil':
        return True, None
    if t == 'str':
        return True, e[1]
    return False, None


def truthy(v):
    return not (v is None or v is False)


def norm_num(x):
    if isinstance(x, float) and x == x and x not in (float('inf'), float('-inf')) \
            and x == int(x) and abs(x) < 2 ** 53:
        return int(x)
    return x


def arith(op, x, y):
    """Lua arithmetic on Lin values; returns Lin or None when not foldable."""
    if op == '+':
        return Lin(x.a + y.a, norm_num(x.c + y.c))
    if op == '-':
        return Lin(x.a - y.a, norm_num(x.c - y.c))
    if op == '*':
        if x.a == 0:
            return Lin(norm_num(x.c * y.a), norm_num(x.c * y.c)) if y.a == 0 or x.c == int(x.c) else None
        if y.a == 0:
            return Lin(norm_num(y.c * x.a), norm_num(x.c * y.c))
        return None
    if x.a or y.a:
        return None
    a, b = x.c, y.c
    try:
        if op == '/':
            return Lin(0, norm_num(a / b))
        if op == '//':
            return Lin(0, norm_num(float(a // b) if isinstance(a, float) or isinstance(b, float) else a // b))
        if op == '%':
            return Lin(0, norm_num(a - (a // b) * b))
        if op == '^':
            return Lin(0, norm_num(float(a) ** float(b)))
    except (ZeroDivisionError, OverflowError):
        return None
    return None


def compare(op, x, y):
    """Returns bool or None (unknown)."""
    if isinstance(x, Lin) and isinstance(y, Lin):
        if x.a != y.a:
            if op in ('==', '~='):
                return None
            return None
        a, b = x.c, y.c
        return {'==': a == b, '~=': a != b, '<': a < b, '<=': a <= b, '>': a > b, '>=': a >= b}[op]
    if op in ('==', '~='):
        if isinstance(x, Lin) or isinstance(y, Lin):
            eq = False
        elif isinstance(x, bytes) or isinstance(y, bytes):
            eq = isinstance(x, bytes) and isinstance(y, bytes) and x == y
        else:
            eq = x is y
        return eq if op == '==' else not eq
    return None


class Block:
    _n = 0

    def __init__(self):
        Block._n += 1
        self.id = Block._n
        self.stmts = []
        self.term = None      # ('goto', B) | ('br', cond, Bt, Bf) | ('ret', exprs) | ('dead',)

    def succs(self):
        t = self.term
        if t is None or t[0] in ('ret', 'dead'):
            return []
        if t[0] == 'goto':
            return [t[1]]
        return [t[2], t[3]]


class State:
    __slots__ = ('env', 'node', 'writes')

    def __init__(self, env, node=None, writes=None):
        self.env = env; self.node = node; self.writes = writes if writes is not None else set()

    def copy(self):
        return State(dict(self.env), self.node, set(self.writes))


class Ctx:
    __slots__ = ('brk', 'cont')

    def __init__(self, brk, cont):
        self.brk = brk; self.cont = cont


class Node:
    __slots__ = ('key', 'leaf', 'reads', 'keyvars', 'block')


# ------------------------------------------------------------------ chunks

def fold_pure(e, env=None):
    """Evaluate an expression made of literals (and env names). Returns value
    or raises Unsupported."""
    t = e[0]
    k, v = as_const(e)
    if k:
        return v
    if t == 'name':
        if env is not None and e[1] in env:
            v = env[e[1]]
            if isinstance(v, (Lin, bool)) or v is None:
                return v
        raise Unsupported('unknown name %s in constant expression' % e[1])
    if t == 'paren':
        return fold_pure(e[1], env)
    if t == 'un':
        v = fold_pure(e[2], env)
        if e[1] == 'not':
            return not truthy(v)
        if e[1] == '-' and isinstance(v, Lin):
            return Lin(-v.a, -v.c)
        raise Unsupported('unary')
    if t == 'bin':
        op = e[1]
        a = fold_pure(e[2], env)
        if op == 'and':
            return fold_pure(e[3], env) if truthy(a) else a
        if op == 'or':
            return a if truthy(a) else fold_pure(e[3], env)
        b = fold_pure(e[3], env)
        if op in ('==', '~=', '<', '<=', '>', '>='):
            r = compare(op, a, b)
            if r is None:
                raise Unsupported('compare')
            return r
        if isinstance(a, Lin) and isinstance(b, Lin):
            r = arith(op, a, b)
            if r is not None:
                return r
        raise Unsupported('arith')
    if t == 'ifexp':
        return fold_pure(e[2], env) if truthy(fold_pure(e[1], env)) else fold_pure(e[3], env)
    raise Unsupported('not a constant expression: %s' % t)


class Chunk:
    """Result of interpreting a chunk prologue."""

    def __init__(self):
        self.tname = None       # unique name of the opaque-constant table
        self.consts = {}        # key -> python value
        self.main = None        # func node of the real unit
        self.funcs = []         # all function nodes assigned in the chunk


def interp_chunk(body):
    ch = Chunk()
    env = {}
    tables = {}

    def exec_list(stmts):
        for s in stmts:
            r = exec_stmt(s)
            if r is not None:
                return r
        return None

    def exec_stmt(s):
        t = s[0]
        if t == 'local':
            if s[2]:
                raise Unsupported('chunk: local with initialiser')
            for n in s[1]:
                env[n] = None
            return None
        if t == 'if':
            for cond, b in s[1]:
                if truthy(fold_pure(cond, env)):
                    return exec_list(b)
            if s[2] is not None:
                return exec_list(s[2])
            return None
        if t == 'fornum':
            a = fold_pure(s[2], env); b = fold_pure(s[3], env)
            c = fold_pure(s[4], env) if s[4] is not None else Lin(0, 1)
            i = a.c
            if c.c == 0 or abs((b.c - a.c) / c.c) > 100000:
                raise Unsupported('chunk: loop bounds')
            while (c.c > 0 and i <= b.c) or (c.c < 0 and i >= b.c):
                env[s[1]] = Lin(0, i)
                r = exec_list(s[5])
                if r is not None:
                    return r
                i += c.c
            return None
        if t == 'do':
            return exec_list(s[1])
        if t == 'assign' and len(s[1]) == 1 and len(s[2]) == 1:
            tg, e = s[1][0], s[2][0]
            if tg[0] == 'name':
                if e[0] == 'table' and not e[1]:
                    d = {}
                    tables[tg[1]] = d
                    env[tg[1]] = d
                elif e[0] == 'func':
                    env[tg[1]] = e
                    ch.funcs.append(e)
                elif e[0] == 'name' and isinstance(env.get(e[1]), list):
                    env[tg[1]] = env[e[1]]
                else:
                    env[tg[1]] = fold_pure(e, env)
                return None
            if tg[0] == 'index' and tg[1][0] == 'name' and tg[1][1] in tables:
                k = fold_pure(tg[2], env)
                tables[tg[1][1]][k.c if isinstance(k, Lin) else k] = fold_pure(e, env)
                return None
        if t == 'return' and len(s[1]) == 1 and s[1][0][0] == 'call':
            c = s[1][0]
            if c[1][0] == 'name' and len(c[2]) == 1 and c[2][0][0] == 'vararg':
                f = env.get(c[1][1])
                if isinstance(f, list) and f[0] == 'func':
                    return f
        raise Unsupported('chunk: unexpected statement %s' % t)

    main = exec_list(body)
    if main is None:
        raise Unsupported('chunk does not return a unit')
    if len(tables) != 1:
        raise Unsupported('chunk: expected exactly one constant table, got %d' % len(tables))
    ch.tname, ch.consts = next(iter(tables.items()))
    ch.main = main
    return ch


def is_chunk_body(body):
    return len(body) >= 2 and body[0][0] == 'local' and not body[0][2] and \
        any(s[0] == 'fornum' for s in body[1:3])


# ------------------------------------------------------------------- units

def walk_stmts(body, fn):
    """Call fn(stmt) for every statement, not descending into functions."""
    for s in body:
        fn(s)
        t = s[0]
        if t == 'do':
            walk_stmts(s[1], fn)
        elif t == 'while':
            walk_stmts(s[2], fn)
        elif t == 'repeat':
            walk_stmts(s[1], fn)
        elif t == 'if':
            for c in s[1]:
                walk_stmts(c[1], fn)
            if s[2] is not None:
                walk_stmts(s[2], fn)
        elif t == 'fornum':
            walk_stmts(s[5], fn)
        elif t == 'forin':
            walk_stmts(s[3], fn)


def stmt_exprs(s):
    """Expressions directly owned by a statement (not nested statements)."""
    t = s[0]
    if t == 'local':
        return list(s[2])
    if t == 'assign':
        return list(s[1]) + list(s[2])
    if t == 'callstat':
        return [s[1]]
    if t == 'while':
        return [s[1]]
    if t == 'repeat':
        return [s[2]]
    if t == 'if':
        return [c[0] for c in s[1]]
    if t == 'fornum':
        return [e for e in s[2:5] if e is not None]
    if t == 'forin':
        return list(s[2])
    if t == 'return':
        return list(s[1])
    return []


def walk_expr(e, fn, role=None):
    """fn(expr, role) for every sub-expression; does not enter functions."""
    fn(e, role)
    t = e[0]
    if t == 'index':
        walk_expr(e[1], fn); walk_expr(e[2], fn)
    elif t == 'call':
        walk_expr(e[1], fn)
        for a in e[2]:
            walk_expr(a, fn)
    elif t == 'mcall':
        walk_expr(e[1], fn)
        for a in e[3]:
            walk_expr(a, fn)
    elif t == 'bin':
        walk_expr(e[2], fn); walk_expr(e[3], fn)
    elif t in ('un', 'paren'):
        walk_expr(e[-1], fn)
    elif t == 'table':
        for it in e[1]:
            if it[0] == 'expr':
                walk_expr(it[1], fn)
            walk_expr(it[2], fn)
    elif t == 'ifexp':
        walk_expr(e[1], fn, 'cond'); walk_expr(e[2], fn); walk_expr(e[3], fn)


class UnitLifter:
    def __init__(self, func, chunk, log=None, captured=(), cachevars=()):
        self.captured = captured
        self.cachevars = cachevars
        self.func = func
        self.chunk = chunk
        self.tname = chunk.tname
        self.log = log or (lambda *a: None)
        self.extra = {}          # leaf id -> extra key vars
        self.cur_stmt = None
        self.find_table_writes()
        self.find_control_vars()

    # -- analysis ---------------------------------------------------------
    def find_table_writes(self):
        written = set()
        tname = self.tname

        def visit(s):
            if s[0] == 'assign':
                for tg in s[1]:
                    if tg[0] == 'index' and tg[1][0] == 'name' and tg[1][1] == tname:
                        try:
                            k = fold_pure(tg[2])
                        except Unsupported:
                            raise Unsupported('constant table written with a computed key')
                        written.add(k.c if isinstance(k, Lin) else k)
        walk_stmts(self.func[3], visit)
        self.twritten = written
        self.stable = {k: v for k, v in self.chunk.consts.items() if k not in written}

    def table_const(self, e):
        """e = index(name T, key) -> (True, value) if it is a stable constant
        or a never-assigned key (nil)."""
        if e[0] == 'index' and e[1][0] == 'name' and e[1][1] == self.tname:
            try:
                k = fold_pure(e[2])
            except Unsupported:
                return False, None
            k = k.c if isinstance(k, Lin) else k
            if k in self.stable:
                return True, self.stable[k]
            if k not in self.twritten and k not in self.chunk.consts:
                return True, None
        return False, None

    def find_control_vars(self):
        decls = set()
        sites = {}      # name -> list of expr or None(unknown)

        def add(name, e):
            sites.setdefault(name, []).append(e)

        def pair(names, exprs, is_local):
            multi = bool(exprs) and exprs[-1][0] in ('call', 'mcall', 'vararg')
            for i, n in enumerate(names):
                if i < len(exprs) - (1 if multi else 0):
                    add(n, exprs[i])
                elif multi:
                    add(n, None)
                elif is_local:
                    add(n, ['nil'])
                else:
                    add(n, ['nil'])

        def visit(s):
            t = s[0]
            if t == 'local':
                decls.update(s[1])
                pair(s[1], s[2], True)
            elif t == 'assign':
                names = []
                ok = True
                for tg in s[1]:
                    names.append(tg[1] if tg[0] == 'name' else None)
                multi = bool(s[2]) and s[2][-1][0] in ('call', 'mcall', 'vararg')
                for i, n in enumerate(names):
                    if n is None:
                        continue
                    if i < len(s[2]) - (1 if multi else 0):
                        add(n, s[2][i])
                    elif multi:
                        add(n, None)
                    else:
                        add(n, ['nil'])
            elif t == 'fornum':
                decls.add(s[1]); add(s[1], None)
            elif t == 'forin':
                for n in s[1]:
                    decls.add(n); add(n, None)
            elif t == 'localfunction':
                decls.add(s[1]); add(s[1], None)
        walk_stmts(self.func[3], visit)
        for p in self.func[1]:
            decls.add(p); add(p, None)

        # selectors: `local sel = <runtime cond>` used only as the condition of
        # if-expressions (branch-free conditional transitions)
        cond_use, other_use = {}, {}

        def count(e, role):
            if e[0] == 'name':
                d = cond_use if role == 'cond' else other_use
                d[e[1]] = d.get(e[1], 0) + 1

        def visit0(s):
            for e in stmt_exprs(s):
                if s[0] == 'assign' and e[0] == 'name' and any(e is x for x in s[1]):
                    other_use[e[1]] = other_use.get(e[1], 0) + 1
                elif s[0] == 'if':
                    walk_expr(e, count, 'cond')
                else:
                    walk_expr(e, count)
        walk_stmts(self.func[3], visit0)
        self.selectors = set(n for n in cond_use
                             if n in decls and n not in other_use and len(sites.get(n, [])) == 1
                             and n not in self.captured)
        C = set(n for n in decls if n not in self.captured)

        def pure(e):
            t = e[0]
            if t in ('num', 'true', 'false', 'nil'):
                return True
            if t == 'name':
                return e[1] in C
            if t == 'paren':
                return pure(e[1])
            if t == 'un':
                return e[1] in ('-', 'not') and pure(e[2])
            if t == 'bin':
                return e[1] != '..' and pure(e[2]) and pure(e[3])
            if t == 'ifexp':
                return pure(e[1]) and pure(e[2]) and pure(e[3])
            if t == 'index':
                return self.table_const(e)[0]
            return False

        changed = True
        while changed:
            changed = False
            for n in list(C):
                if n in self.selectors:
                    continue
                for e in sites.get(n, []):
                    if e is None or not pure(e):
                        C.discard(n); changed = True
                        if n in DEBUG_VARS:
                            print('TAINT', n, to_source([['return', [e]]])[:300] if e else None)
                        break
        # the rolling key: control var with the most self-increments
        incs = {}

        def visit2(s):
            if s[0] == 'assign' and len(s[1]) == 1 and len(s[2]) == 1 and s[1][0][0] == 'name':
                n = s[1][0][1]
                e = s[2][0]
                while e[0] == 'paren':
                    e = e[1]
                if n in C and e[0] == 'bin' and e[1] == '+':
                    for a, b in ((e[2], e[3]), (e[3], e[2])):
                        if a[0] == 'name' and a[1] == n and b[0] == 'num':
                            incs[n] = incs.get(n, 0) + 1
        walk_stmts(self.func[3], visit2)
        self.control = C
        self.keyvar = max(incs, key=incs.get) if incs else None

    # -- evaluation -------------------------------------------------------
    def read(self, name, st):
        v = st.env[name]
        if st.node is not None and name not in st.writes:
            st.node.reads.add(name)
        return v

    def ev(self, e, st):
        """-> (True, value) or (False, residual AST)."""
        t = e[0]
        if t in ('num', 'true', 'false', 'nil', 'str'):
            return as_const(e)
        if t == 'name':
            if e[1] in st.env:
                return True, self.read(e[1], st)
            return False, ['name', e[1]]
        if t == 'paren':
            k, v = self.ev(e[1], st)
            if k:
                return True, v
            if v[0] in ('call', 'mcall', 'vararg'):
                return False, ['paren', v]
            return False, v
        if t == 'index':
            k, v = self.table_const(e)
            if k:
                return True, v
            ko, o = self.ev(e[1], st)
            kk, key = self.ev(e[2], st)
            return False, ['index', lit(o) if ko else o, lit(key) if kk else key]
        if t == 'un':
            k, v = self.ev(e[2], st)
            if k:
                if e[1] == 'not':
                    return True, not truthy(v)
                if e[1] == '-' and isinstance(v, Lin):
                    return True, Lin(-v.a, -v.c)
                if e[1] == '#' and isinstance(v, bytes):
                    return True, Lin(0, len(v))
                return False, ['un', e[1], lit(v)]
            return False, ['un', e[1], v]
        if t == 'bin':
            op = e[1]
            ka, a = self.ev(e[2], st)
            if op == 'and':
                if ka:
                    return self.ev(e[3], st) if truthy(a) else (True, a)
                kb, b = self.ev(e[3], st)
                return False, ['bin', op, a, lit(b) if kb else b]
            if op == 'or':
                if ka:
                    return (True, a) if truthy(a) else self.ev(e[3], st)
                kb, b = self.ev(e[3], st)
                return False, ['bin', op, a, lit(b) if kb else b]
            kb, b = self.ev(e[3], st)
            if op == '==' and not ka and kb and b is None and a[0] == 'name' and a[1] in self.cachevars:
                # string-cache guard: always take the "decode it" path, the
                # decode is deterministic so this preserves behaviour
                return True, True
            if ka and kb:
                if op in ('==', '~=', '<', '<=', '>', '>='):
                    r = compare(op, a, b)
                    if r is not None:
                        return True, r
                elif isinstance(a, Lin) and isinstance(b, Lin):
                    r = arith(op, a, b)
                    if r is not None:
                        return True, r
                elif op == '..' and isinstance(a, bytes) and isinstance(b, bytes):
                    return True, a + b
            return False, ['bin', op, lit(a) if ka else a, lit(b) if kb else b]
        if t == 'ifexp':
            k, c = self.ev(e[1], st)
            if k:
                return self.ev(e[2], st) if truthy(c) else self.ev(e[3], st)
            ka, a = self.ev(e[2], st)
            kb, b = self.ev(e[3], st)
            return False, ['ifexp', c, lit(a) if ka else a, lit(b) if kb else b]
        if t == 'call':
            return False, ['call', self.rw(e[1], st), [self.rw(a, st) for a in e[2]]]
        if t == 'mcall':
            return False, ['mcall', self.rw(e[1], st), e[2], [self.rw(a, st) for a in e[3]]]
        if t == 'table':
            items = []
            for kind, k, v in e[1]:
                items.append([kind, self.rw(k, st) if kind == 'expr' else k, self.rw(v, st)])
            return False, ['table', items]
        if t in ('func', 'vararg', 'global'):
            return False, e
        raise Unsupported('expr ' + t)

    def ev_cond(self, e, st):
        """Evaluate a loop condition; a bare dispatcher variable is only
        tested for truthiness, which does not depend on its numeric value."""
        if e[0] == 'name' and e[1] in st.env and isinstance(st.env[e[1]], Lin):
            return True, True
        return self.ev(e, st)

    def rw(self, e, st):
        k, v = self.ev(e, st)
        return lit(v) if k else v

    # -- execution --------------------------------------------------------
    def lift(self):
        while True:
            self.dirty = False
            self.memo = {}
            self.nodes = []
            Block._n = 0
            entry = Block()
            st = State({})

            def fin(st, cur):
                cur.term = ('ret', [])
            ctx = Ctx(None, None)
            self.run(self.func[3], 0, st, entry, fin, ctx)
            for nd in self.nodes:
                missing = nd.reads - nd.keyvars - {self.keyvar}
                if missing:
                    self.extra.setdefault(nd.leaf, set()).update(missing)
                    self.dirty = True
            if not self.dirty:
                break
            self.log('  re-running unit with widened state key')
        return entry

    def norm(self, st, name):
        v = st.env[name]
        if isinstance(v, Lin) and v.a == 1 and self.keyvar is not None:
            kv = st.env.get(self.keyvar)
            if isinstance(kv, Lin) and kv.a == 1:
                return ('rel', v.c - kv.c)
        return v

    def find_leaf(self, body, st):
        """Follow the dispatcher's if-tree as far as control state decides.
        Returns (leaf id, set of control vars read)."""
        probe = State(st.env, Node(), set())
        probe.node.reads = set()
        lst = body
        while True:
            if not lst:
                return ('empty', id(lst)), probe.node.reads
            s = lst[0]
            if s[0] != 'if':
                return ('list', id(lst)), probe.node.reads
            taken = None
            for cond, b in s[1]:
                k, v = self.ev(cond, probe)
                if not k:
                    return ('list', id(lst)), probe.node.reads
                if truthy(v):
                    taken = b
                    break
            if taken is None:
                if s[2] is None:
                    return ('skip', id(s)), probe.node.reads
                taken = s[2]
            lst = taken

    def loop_body(self, s, body, st, cur, k, ctx):
        leaf, reads = self.find_leaf(body, st)
        keyvars = set(reads) | self.extra.get(leaf, set())
        keyvars.discard(self.keyvar)
        key = (id(s), leaf,
               tuple(sorted(((n, self.norm(st, n)) for n in keyvars if n in st.env), key=repr)))
        nd = self.memo.get(key)
        if nd is not None:
            cur.term = ('goto', nd.block)
            return
        if len(self.nodes) > MAX_NODES:
            import collections
            c = collections.Counter(nd.key[:2] for nd in self.nodes)
            top = c.most_common(1)[0][0]
            ex = [nd.key for nd in self.nodes if nd.key[:2] == top][:4]
            raise Unsupported('dispatcher state space does not converge; control=%s key=%s sample keys: %s'
                              % (sorted(self.control), self.keyvar, ex))
        nd = Node()
        nd.key = key; nd.leaf = leaf; nd.reads = set(); nd.keyvars = keyvars
        nd.block = Block()
        self.memo[key] = nd
        self.nodes.append(nd)
        cur.term = ('goto', nd.block)
        st.node = nd
        st.writes = set()
        return self.run(body, 0, st, nd.block, k, ctx)

    def run(self, stmts, i, st, cur, k, ctx):
        try:
            return self.run_(stmts, i, st, cur, k, ctx)
        except Unsupported as ex:
            if not getattr(ex, 'where', None) and self.cur_stmt is not None:
                ex.where = to_source([self.cur_stmt], ' ')[:400]
                ex.args = (ex.args[0] + ' | near: ' + ex.where,)
            raise

    def run_(self, stmts, i, st, cur, k, ctx):
        n = len(stmts)
        C = self.control
        while i < n:
            s = stmts[i]
            self.cur_stmt = s
            t = s[0]
            if t == 'assign':
                tg, ex = s[1], s[2]
                if all(x[0] == 'name' and x[1] in C for x in tg):
                    vals = []
                    for j in range(len(tg)):
                        if j < len(ex):
                            kk, v = self.ev(ex[j], st)
                            if not kk:
                                raise Unsupported('dispatcher variable %s receives a runtime value' % tg[j][1])
                        else:
                            v = None
                        vals.append(v)
                    for x, v in zip(tg, vals):
                        st.env[x[1]] = v
                        st.writes.add(x[1])
                else:
                    control_targets = [
                        j for j, x in enumerate(tg)
                        if x[0] == 'name' and x[1] in C
                    ]
                    if control_targets:
                        # Mixed assignments are safe to split only when every
                        # RHS is a single, independently foldable value. This
                        # covers dispatcher idioms such as:
                        #   state_table[1], dispatcher_state = nil, nil
                        # Keep runtime/multi-return assignments unsupported.
                        if len(ex) != len(tg):
                            raise Unsupported('mixed dispatcher/data assignment with non-matching arity')
                        values = [self.ev(e, st) for e in ex]
                        if not all(known for known, _ in values):
                            raise Unsupported('mixed dispatcher/data assignment with runtime value')
                        data_targets = [j for j in range(len(tg)) if j not in control_targets]
                        rewritten_targets = [self.rw_target(tg[j], st) for j in data_targets]
                        rewritten_values = [lit(values[j][1]) for j in data_targets]
                        if rewritten_targets:
                            cur.stmts.append(['assign', rewritten_targets, rewritten_values])
                        for j in control_targets:
                            name = tg[j][1]
                            st.env[name] = values[j][1]
                            st.writes.add(name)
                    else:
                        cur.stmts.append(['assign', [self.rw_target(x, st) for x in tg],
                                          [self.rw(e, st) for e in ex]])
                i += 1
            elif t == 'local' and len(s[1]) == 1 and s[1][0] in self.selectors:
                nm = s[1][0]
                kk, v = self.ev(s[2][0], st) if s[2] else (True, None)
                if kk:
                    st.env[nm] = truthy(v); st.writes.add(nm)
                    i += 1
                else:
                    bt, bf = Block(), Block()
                    cur.term = ('br', v, bt, bf)
                    for blk, val in ((bt, True), (bf, False)):
                        st2 = st.copy()
                        st2.env[nm] = val; st2.writes.add(nm)
                        self.run(stmts, i + 1, st2, blk, k, ctx)
                    return
            elif t == 'local':
                names, ex = s[1], s[2]
                multi = bool(ex) and ex[-1][0] in ('call', 'mcall', 'vararg')
                if multi or not all(nm in C for nm in names):
                    if any(nm in C for nm in names):
                        # split: control names must have plain initialisers
                        if multi:
                            raise Unsupported('mixed local declaration')
                        vals = [self.ev(e, st) for e in ex]
                        rn, re = [], []
                        for j, nm in enumerate(names):
                            kv = vals[j] if j < len(vals) else (True, None)
                            if nm in C:
                                if not kv[0]:
                                    raise Unsupported('dispatcher local with runtime value')
                                st.env[nm] = kv[1]; st.writes.add(nm)
                            else:
                                rn.append(nm); re.append(lit(kv[1]) if kv[0] else kv[1])
                        if rn:
                            cur.stmts.append(['local', rn, re])
                    else:
                        cur.stmts.append(['local', list(names), [self.rw(e, st) for e in ex]])
                else:
                    vals = []
                    for j, nm in enumerate(names):
                        if j < len(ex):
                            kk, v = self.ev(ex[j], st)
                            if not kk:
                                raise Unsupported('dispatcher local with runtime value')
                        else:
                            v = None
                        vals.append(v)
                    for nm, v in zip(names, vals):
                        if nm == self.keyvar and isinstance(v, Lin) and v.a == 0:
                            v = Lin(1, v.c)     # rolling key: symbolic base + offset
                        st.env[nm] = v; st.writes.add(nm)
                i += 1
            elif t == 'callstat':
                cur.stmts.append(['callstat', self.rw(s[1], st)])
                i += 1
            elif t == 'return':
                cur.term = ('ret', [self.rw(e, st) for e in s[1]])
                return
            elif t == 'break':
                if ctx.brk is None:
                    raise Unsupported('break outside loop')
                return ctx.brk(st, cur)
            elif t == 'continue':
                if ctx.cont is None:
                    raise Unsupported('continue outside loop')
                return ctx.cont(st, cur)
            elif t == 'do':
                return self.run(s[1], 0, st, cur,
                                lambda st2, cur2: self.run(stmts, i + 1, st2, cur2, k, ctx), ctx)
            elif t == 'if':
                return self.do_if(s, stmts, i, st, cur, k, ctx)
            elif t == 'while':
                return self.do_while(s, stmts, i, st, cur, k, ctx)
            elif t == 'repeat':
                return self.do_repeat(s, stmts, i, st, cur, k, ctx)
            elif t == 'fornum':
                return self.do_fornum(s, stmts, i, st, cur, k, ctx)
            elif t in ('function', 'localfunction'):
                cur.stmts.append(s)
                i += 1
            else:
                raise Unsupported('statement %s inside a unit' % t)
        return k(st, cur)

    def rw_target(self, x, st):
        if x[0] == 'name':
            return ['name', x[1]]
        if x[0] == 'index':
            ko, o = self.ev(x[1], st)
            kk, key = self.ev(x[2], st)
            return ['index', lit(o) if ko else o, lit(key) if kk else key]
        raise Unsupported('assignment target')

    def do_if(self, s, stmts, i, st, cur, k, ctx):
        clauses, els = s[1], s[2]

        def rest(st2, cur2):
            return self.run(stmts, i + 1, st2, cur2, k, ctx)

        def clause(j, st, cur):
            if j == len(clauses):
                if els is not None:
                    return self.run(els, 0, st, cur, rest, ctx)
                return rest(st, cur)
            kk, v = self.ev(clauses[j][0], st)
            if kk:
                if truthy(v):
                    return self.run(clauses[j][1], 0, st, cur, rest, ctx)
                return clause(j + 1, st, cur)
            bt, bf = Block(), Block()
            cur.term = ('br', v, bt, bf)
            self.run(clauses[j][1], 0, st.copy(), bt, rest, ctx)
            return clause(j + 1, st.copy(), bf)
        return clause(0, st, cur)

    def do_while(self, s, stmts, i, st, cur, k, ctx):
        def rest(st2, cur2):
            return self.run(stmts, i + 1, st2, cur2, k, ctx)

        def it(st, cur):
            kk, v = self.ev_cond(s[1], st)
            if not kk:
                raise Unsupported('loop with runtime condition inside a dispatcher block')
            if not truthy(v):
                return rest(st, cur)
            return self.loop_body(s, s[2], st, cur, it, Ctx(rest, it))
        return it(st, cur)

    def do_repeat(self, s, stmts, i, st, cur, k, ctx):
        def rest(st2, cur2):
            return self.run(stmts, i + 1, st2, cur2, k, ctx)

        def after(st, cur):
            kk, v = self.ev_cond(s[2], st)
            if not kk:
                raise Unsupported('repeat with runtime condition inside a dispatcher block')
            if truthy(v):
                return rest(st, cur)
            return start(st, cur)

        def start(st, cur):
            try:
                kk, v = self.ev_cond(s[2], State(st.env))
            except KeyError:
                kk = False
            c = Ctx(rest, after)
            if kk and truthy(v):
                return self.run(s[1], 0, st, cur, after, c)     # one-shot wrapper
            return self.loop_body(s, s[1], st, cur, after, c)
        return start(st, cur)

    def do_fornum(self, s, stmts, i, st, cur, k, ctx):
        def rest(st2, cur2):
            return self.run(stmts, i + 1, st2, cur2, k, ctx)
        ka, a = self.ev(s[2], st)
        kb, b = self.ev(s[3], st)
        kc, c = self.ev(s[4], st) if s[4] is not None else (True, Lin(0, 1))
        if not (ka and kb and kc and isinstance(a, Lin) and isinstance(b, Lin) and isinstance(c, Lin)
                and a.a == 0 and b.a == 0 and c.a == 0 and c.c != 0 and abs((b.c - a.c) / c.c) < 100000):
            raise Unsupported('numeric for with runtime bounds inside a dispatcher block')
        var = s[1]

        def it(val, st, cur):
            if (c.c > 0 and val > b.c) or (c.c < 0 and val < b.c):
                st.env.pop(var, None)
                return rest(st, cur)
            st.env[var] = Lin(0, val)
            st.writes.add(var)

            def nxt(st2, cur2):
                return it(val + c.c, st2, cur2)
            return self.run(s[5], 0, st, cur, nxt, Ctx(rest, nxt))
        return it(a.c, st, cur)


def reachable(entry):
    seen = {}
    order = []
    stack = [entry]
    while stack:
        b = stack.pop()
        if b.id in seen:
            continue
        seen[b.id] = b
        order.append(b)
        for x in reversed(b.succs()):
            stack.append(x)
    return order
