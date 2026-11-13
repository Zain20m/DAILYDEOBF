"""Stage 5: recover structured control flow from the basic-block graph.

Fulcrum's output comes from ordinary structured Luau, so the recovered CFG is
reducible.  We rebuild `if` / `while` / `break` / `continue` from the
dominator and post-dominator trees.  Anything that genuinely does not nest is
reported, never silently dropped.
"""
from luau_ast import KEYWORDS
from ssa import Phi


class StructError(Exception):
    pass


class Loop:
    def __init__(self, header):
        self.header = header
        self.body = set()
        self.follow = None


def post_order(entry):
    seen = set()
    order = []
    st = [(entry, iter(entry.succs()))]
    seen.add(entry.id)
    while st:
        b, it = st[-1]
        for s in it:
            if s.id not in seen:
                seen.add(s.id)
                st.append((s, iter(s.succs())))
                break
        else:
            order.append(b)
            st.pop()
    return order


class Structurer:
    def __init__(self, unit):
        self.unit = unit
        self.entry = unit.entry
        self.labels = 0
        self.flag_id = 0

    # ---- graph facts
    def analyse(self):
        self.blocks = post_order(self.entry)[::-1]
        ids = {b.id for b in self.blocks}
        for b in self.blocks:
            b.preds = [p for p in getattr(b, 'preds', []) if p.id in ids]
        for b in self.blocks:
            b.preds = []
        for b in self.blocks:
            for s in b.succs():
                s.preds.append(b)
        for i, b in enumerate(self.blocks):
            b.rpo = i
        self._dom()
        self._postdom()
        self._loops()

    def _dom(self):
        entry = self.entry
        idom = {entry.id: entry}
        order = self.blocks[1:]
        changed = True
        while changed:
            changed = False
            for b in order:
                new = None
                for p in b.preds:
                    if p.id in idom:
                        new = p if new is None else self._inter(p, new, idom)
                if new and idom.get(b.id) is not new:
                    idom[b.id] = new
                    changed = True
        self.idom = idom

    def _inter(self, a, b, idom):
        while a is not b:
            while a.rpo > b.rpo:
                a = idom[a.id]
            while b.rpo > a.rpo:
                b = idom[b.id]
        return a

    def _postdom(self):
        # Cooper-Harvey-Kennedy on the reverse graph with a virtual exit.
        EXIT = object()
        blocks = self.blocks
        succ = {b.id: b.succs() for b in blocks}
        exits = [b for b in blocks if not succ[b.id] or b.term[0] in ('ret', 'dead')]
        # reverse-graph successors = forward preds; reverse-graph of EXIT = exits
        rsucc = {b.id: list(b.preds) for b in blocks}
        # reverse postorder of the reverse graph from EXIT
        order = []
        seen = set()
        st = [(EXIT, iter(exits))]
        seen.add(id(EXIT))
        while st:
            n, it = st[-1]
            for m in it:
                if id(m) not in seen:
                    seen.add(id(m))
                    st.append((m, iter(rsucc[m.id])))
                    break
            else:
                order.append(n)
                st.pop()
        rpo = order[::-1]
        num = {id(n): i for i, n in enumerate(rpo)}
        ipdom = {id(EXIT): EXIT}

        def inter(a, b):
            while a is not b:
                while num[id(a)] > num[id(b)]:
                    a = ipdom[id(a)]
                while num[id(b)] > num[id(a)]:
                    b = ipdom[id(b)]
            return a
        # predecessors in reverse graph = forward successors; EXIT's are exits
        rpreds = {b.id: list(succ[b.id]) for b in blocks}
        for e in exits:
            rpreds[e.id].append(EXIT)
        changed = True
        while changed:
            changed = False
            for n in rpo:
                if n is EXIT:
                    continue
                newidom = None
                for p in rpreds[n.id]:
                    if id(p) in ipdom:
                        newidom = p if newidom is None else inter(p, newidom)
                if newidom is not None and ipdom.get(id(n)) is not newidom:
                    ipdom[id(n)] = newidom
                    changed = True
        self.ipdom = {k: (None if v is EXIT else v) for k, v in ipdom.items()}

    def ipdom_of(self, b):
        return self.ipdom.get(id(b))

    def _loops(self):
        self.loops = {}
        self.loop_of = {}
        idom = self.idom
        for b in self.blocks:
            for s in b.succs():
                if self._dominates(s, b):
                    lp = self.loops.get(s.id)
                    if lp is None:
                        lp = self.loops[s.id] = Loop(s)
                    self._add_natural(lp, b, s)
        # nesting: assign each node to innermost loop
        for hid, lp in self.loops.items():
            for n in lp.body:
                cur = self.loop_of.get(n.id)
                if cur is None or lp.header in cur.body or cur.header not in lp.body:
                    pass
            lp.follow = self._loop_follow(lp)
        # innermost owner
        order = sorted(self.loops.values(), key=lambda l: len(l.body))
        for lp in order:
            for n in lp.body:
                self.loop_of.setdefault(n.id, lp)

    def _dominates(self, a, b):
        x = b
        while x is not None:
            if x is a:
                return True
            nx = self.idom.get(x.id)
            if nx is x:
                return False
            x = nx
        return False

    def _add_natural(self, lp, tail, head):
        lp.body.add(head)
        stack = [tail]
        while stack:
            n = stack.pop()
            if n in lp.body:
                continue
            lp.body.add(n)
            stack.extend(n.preds)

    def _loop_follow(self, lp):
        exits = []
        for n in lp.body:
            for s in n.succs():
                if s not in lp.body:
                    exits.append(s)
        if not exits:
            return None
        # most common / earliest
        uniq = []
        for e in exits:
            if e not in uniq:
                uniq.append(e)
        uniq.sort(key=lambda b: b.rpo)
        return uniq[0]


def new_flag(st):
    st.flag_id += 1
    return 'cf_%d' % st.flag_id


# --------------------------------------------------------------- out of SSA

def split_critical_edges(st):
    from ssa import Phi
    blocks = list(st.blocks)
    for b in list(blocks):
        if b.term[0] != 'br':
            continue
        for idx, sc in ((2, b.term[2]), (3, b.term[3])):
            if len(sc.preds) > 1:
                nb = _new_block()
                nb.stmts = []
                nb.phis = []
                nb.term = ('goto', sc)
                lst = list(b.term)
                lst[idx] = nb
                b.term = tuple(lst)
                for ph in sc.phis:
                    if b.id in ph.args:
                        ph.args[nb.id] = ph.args.pop(b.id)
                nb.preds = [b]
    st.analyse()


_BLOCK_COUNTER = [10 ** 7]


def _new_block():
    from lift import Block
    b = Block()
    return b


def phi_to_copies(st):
    """Classic out-of-SSA: place `dest = arg` at the end of each predecessor.
    Critical edges must already be split."""
    st._byid = {b.id: b for b in st.blocks}
    for b in st.blocks:
        for ph in b.phis:
            for pid, val in ph.args.items():
                pred = _by_id(st, pid)
                if pred is None:
                    continue
                pred._copies = getattr(pred, '_copies', [])
                pred._copies.append((ph.dest, val))
        b.phis = []
    for b in st.blocks:
        copies = getattr(b, '_copies', [])
        if copies:
            b.stmts.extend(_sequentialise(copies))
            b._copies = []


def _sequentialise(copies):
    """Emit parallel copies [(dest_valnum, srcexpr)] in an order that never
    clobbers a value still needed; break cycles with one temporary."""
    dests = {d for d, _ in copies}
    out = []
    pending = list(copies)
    # stage any source that is itself a destination through a temp
    staged = {}
    tmpn = [0]
    for d, srm in pending:
        if srm[0] == 'ssa' and srm[1] in dests and srm[1] != d and srm[1] not in staged:
            tmpn[0] += 1
            tnm = '__phi%d_%d' % (d, tmpn[0])
            out.append(['assign', [['name', tnm]], [['ssa', srm[1]]]])
            staged[srm[1]] = tnm
    for d, srm in pending:
        src = srm
        if srm[0] == 'ssa' and srm[1] in staged:
            src = ['name', staged[srm[1]]]
        out.append(['assign', [['ssa', d]], [src]])
    return out


def _valnum(e):
    return e[1] if e[0] == 'ssa' else None


def _by_id(st, bid):
    return st._byid.get(bid)


# ------------------------------------------------------------- structuring

def merge_linear(st):
    """Fuse a block that ends in an unconditional goto into its target when
    that target has exactly one predecessor and is not a loop header. Pure
    CFG simplification; preserves behaviour."""
    changed = True
    while changed:
        changed = False
        st.analyse()
        for b in list(st.blocks):
            if b.term[0] != 'goto':
                continue
            c = b.term[1]
            if c is b:
                continue
            if len(c.preds) == 1 and c.preds[0] is b and c.id in {x.id for x in st.blocks}:
                b.stmts = b.stmts + c.stmts
                b.term = c.term
                changed = True
                break
    st.analyse()


def build_ast(st):
    merge_linear(st)
    st.placed = set()
    try:
        body = emit_region(st, st.entry, frozenset(), None)
        st.fallback = False
    except StructError as ex:
        st.placed = set()
        st.struct_note = str(ex)
        st.fallback = True
        body = emit_dispatch(st)
    return body


def emit_region(st, head, stop, loop):
    out = []
    b = head
    while b is not None and b not in stop:
        lp = st.loops.get(b.id)
        if lp is not None and (loop is None or loop.header is not b):
            if b.id in st.placed:
                raise StructError('loop header B%d re-entered' % b.id)
            out.append(['while', ['true'], emit_loop(st, lp, stop, loop)])
            nb = lp.follow
            j = edge(st, nb, stop, loop) if nb is not None else []
            if nb is None or j is not None:
                out.extend(j or [])
                b = None
            else:
                b = nb
            continue
        if b.id in st.placed:
            raise StructError('block B%d placed twice' % b.id)
        st.placed.add(b.id)
        out.extend(convert_stmts(st, b))
        term = b.term
        if term[0] in ('ret', 'dead'):
            if term[0] == 'ret':
                out.append(['return', [convert_expr(st, x) for x in term[1]]])
            b = None
        elif term[0] == 'goto':
            nb = term[1]
            j = edge(st, nb, stop, loop)
            if j is not None:
                out.extend(j)
                b = None
            else:
                b = nb
        elif term[0] == 'br':
            follow = st.ipdom_of(b)
            inner_stop = stop if follow is None else (stop | {follow})
            out.append(emit_if(st, b, inner_stop, loop))
            if follow is not None and follow not in stop and follow.id not in st.placed and \
                    not (loop is not None and (follow is loop.header or follow is loop.follow)):
                b = follow
            else:
                if follow is not None:
                    j = edge(st, follow, stop, loop)
                    out.extend(j or [])
                b = None
    return out


def emit_loop(st, lp, outer_stop, outer_loop):
    body = emit_region(st, lp.header, frozenset(), lp)
    # the header's own back-edge produced `continue`; tidy a trailing one
    while body and body[-1] == ['continue']:
        body.pop()
    return body


def emit_if(st, b, stop, loop):
    cond, tb, fb = b.term[1], b.term[2], b.term[3]
    tj = edge(st, tb, stop, loop)
    fj = edge(st, fb, stop, loop)
    tbody = tj if tj is not None else emit_region(st, tb, stop, loop)
    fbody = fj if fj is not None else emit_region(st, fb, stop, loop)
    cexpr = convert_expr(st, cond)
    if not fbody:
        return ['if', [[cexpr, tbody]], None]
    if not tbody:
        return ['if', [[['un', 'not', _paren(cexpr)], fbody]], None]
    return ['if', [[cexpr, tbody]], fbody]


def _paren(e):
    if e[0] in ('bin', 'ifexp', 'un'):
        return ['paren', e]
    return e


def edge(st, target, stop, loop):
    """Return the statements for a jump to `target`, or None if `target`
    should be inlined here."""
    if loop is not None and target is loop.header:
        return [['continue']]
    if loop is not None and loop.follow is not None and target is loop.follow:
        return [['break']]
    if target in stop:
        return []
    if target.id in st.placed:
        raise StructError('edge to already-placed B%d (needs label)' % target.id)
    return None


# ---- fallback: explicit state machine (always correct)

def emit_dispatch(st):
    order = st.blocks
    idx = {b.id: i for i, b in enumerate(order)}
    body = []
    clauses = []
    for b in order:
        stmts = list(convert_stmts(st, b))
        term = b.term
        if term[0] == 'ret':
            stmts.append(['return', [convert_expr(st, x) for x in term[1]]])
        elif term[0] == 'dead':
            stmts.append(['return', []])
        elif term[0] == 'goto':
            stmts.append(['assign', [['name', '__state']], [['num', idx[term[1].id]]]])
        elif term[0] == 'br':
            stmts.append(['if', [[convert_expr(st, term[1]),
                                  [['assign', [['name', '__state']], [['num', idx[term[2].id]]]]]]],
                          [['assign', [['name', '__state']], [['num', idx[term[3].id]]]]]])
        clauses.append([['bin', '==', ['name', '__state'], ['num', idx[b.id]]], stmts])
    inner = ['if', clauses, None]
    return [['local', ['__state'], [['num', 0]]],
            ['while', ['true'], [inner]]]


def convert_stmts(st, b):
    out = []
    for s in b.stmts:
        out.append(_conv_stmt(st, s))
    return out


def _conv_stmt(st, s):
    t = s[0]
    if t == 'assign':
        return ['assign', [convert_expr(st, x) for x in s[1]], [convert_expr(st, x) for x in s[2]]]
    if t == 'local':
        return ['local', list(s[1]), [convert_expr(st, x) for x in s[2]]]
    if t == 'callstat':
        return ['callstat', convert_expr(st, s[1])]
    return s


def convert_expr(st, e):
    t = e[0]
    if t == 'ssa':
        # the incoming value of a parameter keeps the parameter's name
        p = getattr(getattr(st.unit, 'ssa', None), 'params', {}).get(e[1])
        if p is not None:
            return ['name', p]
        return ['name', 'v%d' % e[1]]
    if t == 'ssa_tmp':
        return ['name', 't%d' % e[1]]
    if t == 'closure':
        st.unit.used_closures.append(e)
        return ['__closure', e]
    if t in ('num', 'str', 'true', 'false', 'nil', 'name', 'global', 'vararg', 'func'):
        return e
    if t == 'index':
        return ['index', convert_expr(st, e[1]), convert_expr(st, e[2])]
    if t == 'call':
        return ['call', convert_expr(st, e[1]), [convert_expr(st, a) for a in e[2]]]
    if t == 'mcall':
        return ['mcall', convert_expr(st, e[1]), e[2], [convert_expr(st, a) for a in e[3]]]
    if t == 'bin':
        return ['bin', e[1], convert_expr(st, e[2]), convert_expr(st, e[3])]
    if t in ('un', 'paren'):
        return [t] + ([e[1]] if t == 'un' else []) + [convert_expr(st, e[-1])]
    if t == 'table':
        return ['table', [[it[0], convert_expr(st, it[1]) if it[0] == 'expr' else it[1],
                           convert_expr(st, it[2])] for it in e[1]]]
    if t == 'ifexp':
        return ['ifexp', convert_expr(st, e[1]), convert_expr(st, e[2]), convert_expr(st, e[3])]
    return e
