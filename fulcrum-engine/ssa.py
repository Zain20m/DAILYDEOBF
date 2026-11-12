"""Stage 4: SSA form over a unit's control-flow graph.

Fulcrum permutes values between register slots at the end of every block.
In SSA form those permutations are plain copies, so copy propagation makes
them disappear and what is left are the real definitions and uses.
"""
from luau_ast import *
from lift import as_const, lit, arith, compare, truthy, Lin, reachable, Unsupported
from units import map_expr, map_block_exprs
import minilua


class Phi:
    __slots__ = ('dest', 'args', 'var')

    def __init__(self, dest, var):
        self.dest = dest; self.var = var; self.args = {}


def clone(e):
    """Deep copy of an expression; function bodies are shared (immutable)."""
    if not e:
        return []
    if e[0] in ('func', 'closure'):
        return e
    out = []
    for x in e:
        if isinstance(x, list):
            if x and isinstance(x[0], str):
                out.append(clone(x))
            else:
                out.append([clone(y) if isinstance(y, list) else y for y in x])
        else:
            out.append(x)
    return out


def is_literal(e):
    return e[0] in ('num', 'str', 'true', 'false', 'nil')


IDENT = re.compile(r'^[A-Za-z_][A-Za-z0-9_]*$')


def env_pure(e):
    """Expressions the obfuscator itself stores in table slots: the global
    environment and members of it."""
    t = e[0]
    if t == 'global':
        return True
    if t == 'call':
        return e[1] == ['global', 'getfenv'] and not e[2]
    if t == 'index':
        return env_pure(e[1]) and e[2][0] == 'str'
    return False


def is_pure(e):
    t = e[0]
    if t in ('num', 'str', 'true', 'false', 'nil', 'ssa', 'name', 'global', 'func', 'closure', 'vararg'):
        return True
    if t in ('call', 'mcall'):
        return env_pure(e)
    if t == 'index':
        return is_pure(e[1]) and is_pure(e[2])
    if t == 'bin':
        return is_pure(e[2]) and is_pure(e[3])
    if t in ('un', 'paren'):
        return is_pure(e[-1])
    if t == 'table':
        return all((it[0] != 'expr' or is_pure(it[1])) and is_pure(it[2]) for it in e[1])
    if t == 'ifexp':
        return is_pure(e[1]) and is_pure(e[2]) and is_pure(e[3])
    return False


class SSA:
    def __init__(self, unit, ctx):
        self.unit = unit
        self.ctx = ctx
        self.entry = unit.entry
        self.vars = unit.ssa_vars
        self.nval = 0
        self.vname = {}         # value id -> source variable
        self.params = {}        # value id -> param name
        self.table_slot = set()

    # ---------------------------------------------------------------- cfg
    def compute_cfg(self):
        self.blocks = reachable(self.entry)
        for b in self.blocks:
            b.preds = []
            if not hasattr(b, 'phis'):
                b.phis = []
        for b in self.blocks:
            for s in b.succs():
                s.preds.append(b)
        # reverse postorder
        seen = set()
        post = []
        stack = [(self.entry, iter(self.entry.succs()))]
        seen.add(self.entry.id)
        while stack:
            b, it = stack[-1]
            adv = False
            for s in it:
                if s.id not in seen:
                    seen.add(s.id)
                    stack.append((s, iter(s.succs())))
                    adv = True
                    break
            if not adv:
                post.append(b)
                stack.pop()
        self.rpo = post[::-1]
        for i, b in enumerate(self.rpo):
            b.rpo = i

    def compute_dom(self):
        idom = {self.entry.id: self.entry}
        changed = True
        while changed:
            changed = False
            for b in self.rpo[1:]:
                new = None
                for p in b.preds:
                    if p.id in idom:
                        if new is None:
                            new = p
                        else:
                            x, y = p, new
                            while x is not y:
                                while x.rpo > y.rpo:
                                    x = idom[x.id]
                                while y.rpo > x.rpo:
                                    y = idom[y.id]
                            new = x
                if idom.get(b.id) is not new:
                    idom[b.id] = new
                    changed = True
        self.idom = idom
        self.domkids = {b.id: [] for b in self.blocks}
        for b in self.rpo[1:]:
            self.domkids[idom[b.id].id].append(b)
        self.df = {b.id: set() for b in self.blocks}
        for b in self.blocks:
            if len(b.preds) >= 2:
                for p in b.preds:
                    r = p
                    while r is not idom[b.id]:
                        self.df[r.id].add(b)
                        r = idom[r.id]

    # -------------------------------------------------------------- build
    def new_value(self, var):
        self.nval += 1
        self.vname[self.nval] = var
        return self.nval

    def build(self):
        self.compute_cfg()
        self.compute_dom()
        V = self.vars
        defblocks = {}
        for b in self.blocks:
            for s in b.stmts:
                if s[0] == 'assign':
                    for tg in s[1]:
                        if tg[0] == 'name' and tg[1] in V:
                            defblocks.setdefault(tg[1], set()).add(b)
        byid = {b.id: b for b in self.blocks}
        for var, dbs in defblocks.items():
            work = list(dbs)
            has = set()
            while work:
                b = work.pop()
                for d in self.df[b.id]:
                    if d.id not in has:
                        has.add(d.id)
                        d.phis.append(Phi(None, var))
                        if d not in dbs:
                            work.append(d)
        # rename
        stacks = {}
        for p in self.unit.params:
            if p in V:
                n = self.new_value(p)
                self.params[n] = p
                stacks[p] = [n]

        def use(e):
            if e[0] == 'name' and e[1] in V:
                st = stacks.get(e[1])
                if st:
                    return ['ssa', st[-1]]
                return ['nil']
            return None

        todo = [('enter', self.entry)]
        while todo:
            kind, b = todo.pop()
            if kind == 'leave':
                for var, cnt in b._pushed.items():
                    del stacks[var][-cnt:]
                del b._pushed
                continue
            pushed = {}

            def push(var):
                n = self.new_value(var)
                stacks.setdefault(var, []).append(n)
                pushed[var] = pushed.get(var, 0) + 1
                return n
            for ph in b.phis:
                ph.dest = push(ph.var)
            for s in b.stmts:
                if s[0] == 'assign':
                    s[2] = [map_expr(x, use) for x in s[2]]
                    newt = []
                    for tg in s[1]:
                        if tg[0] == 'name' and tg[1] in V:
                            newt.append(tg)
                        else:
                            newt.append(map_expr(tg, use))
                    for i, tg in enumerate(newt):
                        if tg[0] == 'name' and tg[1] in V:
                            newt[i] = ['ssa', push(tg[1])]
                    s[1] = newt
                elif s[0] == 'callstat':
                    s[1] = map_expr(s[1], use)
            t = b.term
            if t[0] == 'br':
                b.term = ('br', map_expr(t[1], use), t[2], t[3])
            elif t[0] == 'ret':
                b.term = ('ret', [map_expr(x, use) for x in t[1]])
            for sc in b.succs():
                for ph in sc.phis:
                    st = stacks.get(ph.var)
                    ph.args[b.id] = ['ssa', st[-1]] if st else ['nil']
            b._pushed = pushed
            todo.append(('leave', b))
            for kid in reversed(self.domkids[b.id]):
                todo.append(('enter', kid))
        # split parallel assignments whose targets are all SSA values
        for b in self.blocks:
            out = []
            for s in b.stmts:
                if s[0] == 'assign' and len(s[1]) > 1 and len(s[1]) == len(s[2]) and \
                        all(tg[0] == 'ssa' for tg in s[1]) and s[2][-1][0] not in ('call', 'mcall', 'vararg'):
                    for tg, e in zip(s[1], s[2]):
                        out.append(['assign', [tg], [e]])
                else:
                    out.append(s)
            b.stmts = out

    # ---------------------------------------------------------- utilities
    def collect(self):
        uses = {}
        defs = {}

        def visit(e):
            if e[0] == 'ssa':
                uses.setdefault(e[1], []).append(e)
            return None
        for b in self.blocks:
            for ph in b.phis:
                defs[ph.dest] = ('phi', b, ph)
                for a in ph.args.values():
                    map_expr(a, visit)
            for s in b.stmts:
                if s[0] == 'assign':
                    for tg in s[1]:
                        if tg[0] == 'ssa':
                            defs[tg[1]] = ('stmt', b, s)
                        else:
                            map_expr(tg, visit)
                    for x in s[2]:
                        map_expr(x, visit)
                elif s[0] == 'callstat':
                    map_expr(s[1], visit)
            t = b.term
            if t[0] == 'br':
                map_expr(t[1], visit)
            elif t[0] == 'ret':
                for x in t[1]:
                    map_expr(x, visit)
        self.uses = uses
        self.defs = defs

    # ----------------------------------------------------------- folding
    def const_table(self, e):
        """expr -> python list of numbers if it is (or is defined as) a table
        constructor of numeric literals."""
        if e[0] == 'ssa':
            d = self.defs.get(e[1])
            if d and d[0] == 'stmt' and len(d[2][1]) == 1 and len(d[2][2]) == 1:
                e = d[2][2][0]
        if e[0] == 'table' and all(it[0] == 'pos' and it[2][0] == 'num' for it in e[1]):
            return [it[2][1] for it in e[1]]
        return None

    def decode(self, name, args):
        func, owner = self.ctx.decoders[name]
        vals = []
        for a in args:
            if a[0] == 'num':
                vals.append(a[1])
            else:
                t = self.const_table(a)
                if t is None:
                    return None
                vals.append(t)
        try:
            r = self.ctx.run_decoder(func, owner, vals)
        except minilua.LuaError as ex:
            self.ctx.problems.append('decoder %s failed: %s' % (name, ex))
            return None
        return r if isinstance(r, bytes) else None

    def fold_node(self, e):
        t = e[0]
        if t == 'paren':
            if e[1][0] not in ('call', 'mcall', 'vararg'):
                return e[1]
            return None
        if t == 'bin':
            op = e[1]
            ka, a = as_const(e[2])
            if op == 'and' and ka:
                return e[3] if truthy(a) else e[2]
            if op == 'or' and ka:
                return e[2] if truthy(a) else e[3]
            kb, b = as_const(e[3])
            if ka and kb:
                if op in ('==', '~=', '<', '<=', '>', '>='):
                    r = compare(op, a, b)
                    if r is not None:
                        return lit(r)
                elif op == '..':
                    if isinstance(a, bytes) and isinstance(b, bytes):
                        return ['str', a + b]
                elif isinstance(a, Lin) and isinstance(b, Lin):
                    r = arith(op, a, b)
                    if r is not None:
                        return lit(r)
            return None
        if t == 'un':
            k, v = as_const(e[2])
            if k:
                if e[1] == 'not':
                    return lit(not truthy(v))
                if e[1] == '-' and isinstance(v, Lin):
                    return ['num', -v.c]
                if e[1] == '#' and isinstance(v, bytes):
                    return ['num', len(v)]
            if e[1] == 'not' and e[2][0] == 'un' and e[2][1] == 'not':
                inner = e[2][2]
                if (inner[0] == 'bin' and inner[1] in ('==','~=','<','<=','>','>=')) or \
                        (inner[0] == 'un' and inner[1] == 'not'):
                    return inner       # not not <boolean> == <boolean>
            return None
        if t == 'ifexp':
            k, v = as_const(e[1])
            if k:
                return e[2] if truthy(v) else e[3]
            boolean = (e[1][0] == 'bin' and e[1][1] in ('==', '~=', '<', '<=', '>', '>=')) or \
                      (e[1][0] == 'un' and e[1][1] == 'not')
            if e[2][0] == 'true' and e[3][0] == 'false':
                return e[1] if boolean else ['un', 'not', ['un', 'not', e[1]]]
            if e[2][0] == 'false' and e[3][0] == 'true':
                return ['un', 'not', e[1]]
            return None
        if t == 'index':
            if e[1] == ['call', ['global', 'getfenv'], []] and e[2][0] == 'str':
                try:
                    s = e[2][1].decode('ascii')
                except UnicodeDecodeError:
                    return None
                if IDENT.match(s) and s not in KEYWORDS:
                    return ['global', s]
            return None
        if t == 'call':
            f = e[1]
            if f == ['index', ['global', 'string'], ['str', b'char']] and e[2] and \
                    all(a[0] == 'num' for a in e[2]):
                try:
                    return ['str', bytes(int(a[1]) for a in e[2])]
                except ValueError:
                    return None
            if f[0] == 'name' and f[1] in self.ctx.decoders and len(e[2]) == 3:
                r = self.decode(f[1], e[2])
                if r is not None:
                    self.ctx.ndecoded += 1
                    return ['str', r]
            return None
        return None

    def fold_all(self):
        changed = [False]

        def fn(e):
            r = self.fold_node(e)
            if r is not None:
                changed[0] = True
            return r
        for b in self.blocks:
            map_block_exprs(b, fn)
            for ph in b.phis:
                for k in list(ph.args):
                    ph.args[k] = map_expr(ph.args[k], fn)
            t = b.term
            if t[0] == 'br':
                cnd = t[1]
                while cnd[0] == 'un' and cnd[1] == 'not' and cnd[2][0] == 'un' and cnd[2][1] == 'not':
                    cnd = cnd[2][2]; changed[0] = True
                if cnd is not t[1]:
                    t = ('br', cnd, t[2], t[3]); b.term = t
                k, v = as_const(t[1])
                if k:
                    b.term = ('goto', t[2] if truthy(v) else t[3])
                    changed[0] = True
                elif t[2] is t[3]:
                    b.term = ('goto', t[2])
                    changed[0] = True
        return changed[0]

    def prune(self):
        """Drop unreachable blocks and the phi arguments coming from them."""
        old = set(b.id for b in self.blocks)
        self.compute_cfg()
        live = set(b.id for b in self.blocks)
        for b in self.blocks:
            pids = set(p.id for p in b.preds)
            for ph in b.phis:
                for k in list(ph.args):
                    if k not in pids:
                        del ph.args[k]
        return old != live

    # ------------------------------------------------------- propagation
    def propagate(self):
        self.collect()
        repl = {}
        for b in self.blocks:
            keep = []
            for s in b.stmts:
                if s[0] == 'assign' and len(s[1]) == 1 and len(s[2]) == 1 and s[1][0][0] == 'ssa':
                    n = s[1][0][1]
                    e = s[2][0]
                    if e[0] == 'ssa' or is_literal(e) or \
                            (e[0] == 'call' and e[1] == ['global', 'getfenv'] and not e[2]) or \
                            (self.vname[n] in self.table_slot and env_pure(e)):
                        repl[n] = e
                        continue
                keep.append(s)
            b.stmts = keep
            keepp = []
            for ph in b.phis:
                vals = [a for a in ph.args.values() if not (a[0] == 'ssa' and a[1] == ph.dest)]
                if vals and all(v == vals[0] for v in vals) and (vals[0][0] == 'ssa' or is_literal(vals[0])):
                    repl[ph.dest] = vals[0]
                    continue
                if not vals:
                    repl[ph.dest] = ['nil']
                    continue
                keepp.append(ph)
            b.phis = keepp
        if not repl:
            return False

        def resolve(n, depth=0):
            e = repl[n]
            seen = set()
            while e[0] == 'ssa' and e[1] in repl:
                if e[1] in seen:
                    return ['nil']
                seen.add(e[1])
                e = repl[e[1]]
            return e
        for n in list(repl):
            repl[n] = resolve(n)
        for n, e in repl.items():
            for node in self.uses.get(n, ()):
                node[:] = clone(e)
        return True

    def dce(self):
        self.collect()
        changed = False
        uses = self.uses
        for b in self.blocks:
            keep = []
            for s in b.stmts:
                if s[0] == 'assign' and all(tg[0] == 'ssa' for tg in s[1]) and \
                        not any(uses.get(tg[1]) for tg in s[1]):
                    if all(is_pure(x) for x in s[2]):
                        changed = True
                        continue
                    if len(s[2]) == 1 and s[2][0][0] in ('call', 'mcall'):
                        keep.append(['callstat', s[2][0]])
                        changed = True
                        continue
                keep.append(s)
            b.stmts = keep
            n = len(b.phis)
            b.phis = [ph for ph in b.phis
                      if any(not self._self_use(ph, node) for node in uses.get(ph.dest, ()))]
            if len(b.phis) != n:
                changed = True
        return changed

    def _self_use(self, ph, node):
        return any(a is node for a in ph.args.values())

    def optimize(self):
        for _ in range(200):
            c = self.propagate()
            c = self.fold_all() or c
            c = self.prune() or c
            c = self.dce() or c
            if not c:
                break
        self.collect()
