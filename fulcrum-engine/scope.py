"""Scope resolution: rename every local binding to a unique name (name_N) so
later passes can ignore shadowing.  Globals keep their names."""
from luau_ast import *

class Resolver:
    def __init__(self):
        self.counter = {}
        self.scopes = [{}]
        self.globals_read = set()
        self.globals_written = set()
        self.func_stack = []          # list of dicts: binding -> depth info
        self.binding_func = {}        # unique name -> function node id (owner)
        self.free = {}                # id(func node) -> set(unique names captured)
        self.decl_order = []

    def declare(self, name):
        n = self.counter.get(name, 0)
        self.counter[name] = n + 1
        u = name if n == 0 else '%s_%d' % (name, n)
        # ensure no clash with other generated names
        while u in self.binding_func:
            n += 1; self.counter[name] = n + 1
            u = '%s_%d' % (name, n)
        self.scopes[-1][name] = u
        self.binding_func[u] = self.func_stack[-1] if self.func_stack else None
        return u

    def lookup(self, name):
        for sc in reversed(self.scopes):
            if name in sc:
                u = sc[name]
                owner = self.binding_func[u]
                # record capture for all enclosing functions between use and owner
                for f in reversed(self.func_stack):
                    if f == owner:
                        break
                    self.free.setdefault(f, set()).add(u)
                return u
        return None

    def block(self, body, newscope=True):
        if newscope:
            self.scopes.append({})
        for s in body:
            self.stat(s)
        if newscope:
            self.scopes.pop()

    def func(self, f):
        fid = id(f)
        self.func_stack.append(fid)
        self.free.setdefault(fid, set())
        self.scopes.append({})
        f[1] = [self.declare(p) for p in f[1]]
        self.block(f[3], False)
        self.scopes.pop()
        self.func_stack.pop()

    def expr(self, e):
        t = e[0]
        if t == 'name':
            u = self.lookup(e[1])
            if u is None:
                self.globals_read.add(e[1])
                e[0] = 'global'
            else:
                e[1] = u
        elif t in ('index',):
            self.expr(e[1]); self.expr(e[2])
        elif t == 'call':
            self.expr(e[1])
            for a in e[2]: self.expr(a)
        elif t == 'mcall':
            self.expr(e[1])
            for a in e[3]: self.expr(a)
        elif t == 'func':
            self.func(e)
        elif t == 'bin':
            self.expr(e[2]); self.expr(e[3])
        elif t in ('un', 'paren'):
            self.expr(e[-1])
        elif t == 'table':
            for it in e[1]:
                if it[0] == 'expr': self.expr(it[1])
                self.expr(it[2])
        elif t == 'ifexp':
            self.expr(e[1]); self.expr(e[2]); self.expr(e[3])

    def stat(self, s):
        t = s[0]
        if t == 'local':
            for e in s[2]: self.expr(e)
            s[1] = [self.declare(n) for n in s[1]]
        elif t == 'assign':
            for e in s[2]: self.expr(e)
            for e in s[1]:
                self.expr(e)
                if e[0] == 'global': self.globals_written.add(e[1])
        elif t == 'callstat':
            self.expr(s[1])
        elif t == 'do':
            self.block(s[1])
        elif t == 'while':
            self.expr(s[1]); self.block(s[2])
        elif t == 'repeat':
            self.scopes.append({})
            self.block(s[1], False); self.expr(s[2])
            self.scopes.pop()
        elif t == 'if':
            for c in s[1]:
                self.expr(c[0]); self.block(c[1])
            if s[2] is not None: self.block(s[2])
        elif t == 'fornum':
            self.expr(s[2]); self.expr(s[3])
            if s[4] is not None: self.expr(s[4])
            self.scopes.append({})
            s[1] = self.declare(s[1])
            self.block(s[5], False)
            self.scopes.pop()
        elif t == 'forin':
            for e in s[2]: self.expr(e)
            self.scopes.append({})
            s[1] = [self.declare(n) for n in s[1]]
            self.block(s[3], False)
            self.scopes.pop()
        elif t == 'function':
            self.expr(s[1]); self.func(s[2])
        elif t == 'localfunction':
            s[1] = self.declare(s[1]); self.func(s[2])
        elif t == 'return':
            for e in s[1]: self.expr(e)

def resolve(ast):
    r = Resolver()
    r.block(ast, False)
    return r
