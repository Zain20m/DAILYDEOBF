"""A deliberately tiny Lua evaluator.

It exists to run Fulcrum's *string decoder* functions (pure arithmetic over
byte tables) without ever executing the protected script itself.  Only
numbers, strings, tables and a handful of whitelisted builtins exist here;
there is no I/O, no environment access and a hard step limit.
"""
import math


class LuaError(Exception):
    pass


class _Return(Exception):
    def __init__(self, vals):
        self.vals = vals


class _Break(Exception):
    pass


class _Continue(Exception):
    pass


class Table:
    __slots__ = ('h',)

    def __init__(self, h=None):
        self.h = h if h is not None else {}

    def length(self):
        n = 0
        h = self.h
        while (n + 1) in h:
            n += 1
        return n


def norm(v):
    if isinstance(v, float) and v == v and abs(v) != float('inf') and v == int(v):
        return int(v)
    return v


def b_char(*a):
    return bytes(int(x) & 255 for x in a)


def b_unpack(t, i=1, j=None):
    if j is None:
        j = t.length()
    return tuple(t.h.get(k) for k in range(int(i), int(j) + 1))


def b_concat(t, sep=b''):
    return sep.join(t.h[k] for k in range(1, t.length() + 1))


def builtin_env():
    string = Table({b'char': b_char,
                    b'byte': lambda s, i=1, j=None: tuple(s[int(i) - 1:int(j if j is not None else i)]),
                    b'sub': lambda s, i=1, j=-1: _sub(s, int(i), int(j)),
                    b'len': lambda s: len(s),
                    b'rep': lambda s, n: s * int(n),
                    b'reverse': lambda s: s[::-1]})
    table = Table({b'concat': b_concat, b'unpack': b_unpack,
                   b'insert': _insert})
    mth = Table({b'floor': lambda x: math.floor(x), b'abs': abs,
                 b'max': max, b'min': min, b'huge': float('inf')})
    bit32 = Table({b'bxor': lambda *a: _fold(a, lambda x, y: x ^ y),
                   b'band': lambda *a: _fold(a, lambda x, y: x & y),
                   b'bor': lambda *a: _fold(a, lambda x, y: x | y),
                   b'lshift': lambda x, n: (int(x) << int(n)) & 0xFFFFFFFF,
                   b'rshift': lambda x, n: (int(x) & 0xFFFFFFFF) >> int(n),
                   b'bnot': lambda x: (~int(x)) & 0xFFFFFFFF})
    return {'string': string, 'table': table, 'math': mth, 'bit32': bit32,
            'unpack': b_unpack, 'tostring': _tostring, 'tonumber': _tonumber}


def _fold(a, f):
    r = int(a[0]) & 0xFFFFFFFF
    for x in a[1:]:
        r = f(r, int(x) & 0xFFFFFFFF)
    return r & 0xFFFFFFFF


def _insert(t, *a):
    if len(a) == 1:
        t.h[t.length() + 1] = a[0]
    else:
        n = t.length()
        pos = int(a[0])
        for k in range(n, pos - 1, -1):
            t.h[k + 1] = t.h[k]
        t.h[pos] = a[1]


def _sub(s, i, j):
    n = len(s)
    if i < 0:
        i = max(n + i + 1, 1)
    elif i == 0:
        i = 1
    if j < 0:
        j = n + j + 1
    elif j > n:
        j = n
    return s[i - 1:j] if i <= j else b''


def _tostring(v):
    if v is None:
        return b'nil'
    if v is True:
        return b'true'
    if v is False:
        return b'false'
    if isinstance(v, bytes):
        return v
    if isinstance(v, (int, float)):
        v = norm(v)
        return (str(v) if isinstance(v, int) else repr(v)).encode()
    raise LuaError('tostring')


def _tonumber(v):
    try:
        return norm(float(v))
    except (TypeError, ValueError):
        return None


class Closure:
    __slots__ = ('func', 'scope', 'interp')

    def __init__(self, func, scope, interp):
        self.func = func; self.scope = scope; self.interp = interp

    def __call__(self, *args):
        return self.interp.call_function(self, args)


class Scope:
    __slots__ = ('vars', 'parent')

    def __init__(self, parent=None):
        self.vars = {}
        self.parent = parent

    def find(self, name):
        s = self
        while s is not None:
            if name in s.vars:
                return s
            s = s.parent
        return None


class Interp:
    def __init__(self, free_lookup=None, max_steps=20000000):
        self.globals = builtin_env()
        self.free_lookup = free_lookup or (lambda name: (False, None))
        self.steps = 0
        self.max_steps = max_steps

    # -- values
    def to_value(self, v):
        """python list/number/bytes -> Lua value"""
        if isinstance(v, list):
            return Table({i + 1: self.to_value(x) for i, x in enumerate(v)})
        return v

    def call(self, func_node, args):
        self.steps = 0
        r = self.call_function(Closure(func_node, Scope(), self), tuple(args))
        return r[0] if r else None

    def call_function(self, clo, args):
        f = clo.func
        sc = Scope(clo.scope)
        for i, p in enumerate(f[1]):
            sc.vars[p] = args[i] if i < len(args) else None
        va = tuple(args[len(f[1]):]) if f[2] else ()
        try:
            self.block(f[3], sc, va)
        except _Return as r:
            return r.vals
        return ()

    def tick(self):
        self.steps += 1
        if self.steps > self.max_steps:
            raise LuaError('step limit exceeded')

    # -- statements
    def block(self, body, sc, va):
        for s in body:
            self.stat(s, sc, va)

    def stat(self, s, sc, va):
        self.tick()
        t = s[0]
        if t == 'local':
            vals = self.explist(s[2], sc, va)
            for i, n in enumerate(s[1]):
                sc.vars[n] = vals[i] if i < len(vals) else None
        elif t == 'assign':
            vals = self.explist(s[2], sc, va)
            for i, tg in enumerate(s[1]):
                v = vals[i] if i < len(vals) else None
                if tg[0] in ('name', 'global'):
                    owner = sc.find(tg[1])
                    if owner is None:
                        raise LuaError('write to free variable ' + tg[1])
                    owner.vars[tg[1]] = v
                elif tg[0] == 'index':
                    o = self.expr(tg[1], sc, va)
                    k = self.expr(tg[2], sc, va)
                    if not isinstance(o, Table):
                        raise LuaError('index write on non-table')
                    k = norm(k)
                    if v is None:
                        o.h.pop(k, None)
                    else:
                        o.h[k] = v
                else:
                    raise LuaError('assign target')
        elif t == 'callstat':
            self.multi(s[1], sc, va)
        elif t == 'do':
            self.block(s[1], Scope(sc), va)
        elif t == 'if':
            for cond, b in s[1]:
                c = self.expr(cond, sc, va)
                if not (c is None or c is False):
                    self.block(b, Scope(sc), va)
                    return
            if s[2] is not None:
                self.block(s[2], Scope(sc), va)
        elif t == 'while':
            while True:
                c = self.expr(s[1], sc, va)
                if c is None or c is False:
                    break
                try:
                    self.block(s[2], Scope(sc), va)
                except _Break:
                    break
                except _Continue:
                    pass
        elif t == 'repeat':
            while True:
                inner = Scope(sc)
                try:
                    self.block(s[1], inner, va)
                except _Break:
                    break
                except _Continue:
                    pass
                c = self.expr(s[2], inner, va)
                if not (c is None or c is False):
                    break
        elif t == 'fornum':
            a = self.expr(s[2], sc, va); b = self.expr(s[3], sc, va)
            c = self.expr(s[4], sc, va) if s[4] is not None else 1
            if c == 0:
                raise LuaError('for step 0')
            i = a
            while (c > 0 and i <= b) or (c < 0 and i >= b):
                inner = Scope(sc)
                inner.vars[s[1]] = i
                try:
                    self.block(s[5], inner, va)
                except _Break:
                    break
                except _Continue:
                    pass
                i = norm(i + c)
        elif t == 'return':
            raise _Return(self.explist(s[1], sc, va))
        elif t == 'break':
            raise _Break()
        elif t == 'continue':
            raise _Continue()
        elif t == 'localfunction':
            sc.vars[s[1]] = None
            sc.vars[s[1]] = Closure(s[2], sc, self)
        else:
            raise LuaError('statement ' + t)

    # -- expressions
    def explist(self, exprs, sc, va):
        out = []
        for i, e in enumerate(exprs):
            if i == len(exprs) - 1:
                out.extend(self.multi(e, sc, va))
            else:
                out.append(self.expr(e, sc, va))
        return tuple(out)

    def multi(self, e, sc, va):
        t = e[0]
        if t == 'call':
            f = self.expr(e[1], sc, va)
            args = self.explist(e[2], sc, va)
            if not callable(f):
                raise LuaError('call of non-function')
            r = f(*args)
            if isinstance(r, tuple):
                return r
            return (r,)
        if t == 'vararg':
            return va
        return (self.expr(e, sc, va),)

    def expr(self, e, sc, va):
        self.tick()
        t = e[0]
        if t == 'num':
            return e[1]
        if t == 'str':
            return e[1]
        if t == 'nil':
            return None
        if t == 'true':
            return True
        if t == 'false':
            return False
        if t in ('name', 'global'):
            owner = sc.find(e[1])
            if owner is not None:
                return owner.vars[e[1]]
            ok, v = self.free_lookup(e[1])
            if ok:
                return v
            if e[1] in self.globals:
                return self.globals[e[1]]
            raise LuaError('unknown variable ' + e[1])
        if t == 'paren':
            return self.expr(e[1], sc, va)
        if t in ('call', 'vararg'):
            r = self.multi(e, sc, va)
            return r[0] if r else None
        if t == 'index':
            o = self.expr(e[1], sc, va)
            k = norm(self.expr(e[2], sc, va))
            if isinstance(o, Table):
                return o.h.get(k)
            if isinstance(o, bytes):
                return self.globals['string'].h.get(k)
            raise LuaError('index of non-table')
        if t == 'func':
            return Closure(e, sc, self)
        if t == 'table':
            tb = Table()
            n = 0
            for i, (kind, k, v) in enumerate(e[1]):
                if kind == 'pos':
                    if i == len(e[1]) - 1:
                        for x in self.multi(v, sc, va):
                            n += 1
                            if x is not None:
                                tb.h[n] = x
                    else:
                        n += 1
                        x = self.expr(v, sc, va)
                        if x is not None:
                            tb.h[n] = x
                elif kind == 'name':
                    tb.h[k.encode()] = self.expr(v, sc, va)
                else:
                    tb.h[norm(self.expr(k, sc, va))] = self.expr(v, sc, va)
            return tb
        if t == 'un':
            v = self.expr(e[2], sc, va)
            if e[1] == 'not':
                return v is None or v is False
            if e[1] == '-':
                return norm(-v)
            if e[1] == '#':
                if isinstance(v, bytes):
                    return len(v)
                if isinstance(v, Table):
                    return v.length()
                raise LuaError('length of non-table')
        if t == 'bin':
            op = e[1]
            a = self.expr(e[2], sc, va)
            if op == 'and':
                return self.expr(e[3], sc, va) if not (a is None or a is False) else a
            if op == 'or':
                return a if not (a is None or a is False) else self.expr(e[3], sc, va)
            b = self.expr(e[3], sc, va)
            if op == '==':
                return a == b and type(a) in (type(b), int, float) or (a is b)
            if op == '~=':
                return not (a == b and type(a) in (type(b), int, float) or (a is b))
            if op == '..':
                return _tostring(a) + _tostring(b)
            if isinstance(a, bool) or isinstance(b, bool) or a is None or b is None:
                raise LuaError('arithmetic on non-number')
            if op in ('<', '<=', '>', '>='):
                return {'<': a < b, '<=': a <= b, '>': a > b, '>=': a >= b}[op]
            if isinstance(a, bytes) or isinstance(b, bytes) or isinstance(a, Table) or isinstance(b, Table):
                raise LuaError('arithmetic on non-number')
            if op == '+':
                return norm(a + b)
            if op == '-':
                return norm(a - b)
            if op == '*':
                return norm(a * b)
            if op == '/':
                return norm(a / b) if b != 0 else float('inf') * (1 if a > 0 else -1)
            if op == '//':
                return norm(math.floor(a / b)) if isinstance(a, float) or isinstance(b, float) else a // b
            if op == '%':
                return norm(a - math.floor(a / b) * b)
            if op == '^':
                return norm(float(a) ** float(b))
        if t == 'ifexp':
            c = self.expr(e[1], sc, va)
            return self.expr(e[2], sc, va) if not (c is None or c is False) else self.expr(e[3], sc, va)
        raise LuaError('expression ' + t)
