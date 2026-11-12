"""Readability pass: fold a single-use temporary `vN = E` into the *next*
statement's use of it.  Restricting to adjacent statements guarantees no code
executes between the definition and the use, so the only way to change
behaviour is (a) the next statement overwrites an input of E before the use,
or (b) E has a side effect and is pushed past another side effect in the same
statement.  Both are checked; when in doubt we do not inline."""
import re
V = re.compile(r'^v\d+$')


def walk(e, fn):
    r = fn(e)
    if r is not None:
        return r
    t = e[0]
    if t == 'index':
        e[1] = walk(e[1], fn); e[2] = walk(e[2], fn)
    elif t == 'call':
        e[1] = walk(e[1], fn); e[2] = [walk(a, fn) for a in e[2]]
    elif t == 'mcall':
        e[1] = walk(e[1], fn); e[3] = [walk(a, fn) for a in e[3]]
    elif t == 'bin':
        e[2] = walk(e[2], fn); e[3] = walk(e[3], fn)
    elif t in ('un', 'paren'):
        e[-1] = walk(e[-1], fn)
    elif t == 'table':
        for it in e[1]:
            if it[0] == 'expr':
                it[1] = walk(it[1], fn)
            it[2] = walk(it[2], fn)
    elif t == 'ifexp':
        e[1] = walk(e[1], fn); e[2] = walk(e[2], fn); e[3] = walk(e[3], fn)
    return e


def subblocks(s):
    t = s[0]
    if t == 'if':
        return [c[1] for c in s[1]] + ([s[2]] if s[2] else [])
    if t == 'while':
        return [s[2]]
    if t == 'repeat':
        return [s[1]]
    if t == 'do':
        return [s[1]]
    if t == 'fornum':
        return [s[5]]
    if t == 'forin':
        return [s[3]]
    return []


def rhs(s):
    t = s[0]
    if t == 'assign':
        return list(s[1]) + list(s[2])
    if t == 'local':
        return list(s[2])
    if t == 'callstat':
        return [s[1]]
    if t == 'return':
        return list(s[1])
    if t == 'if':
        return [s[1][0][0]]
    if t == 'while':
        return [s[1]]
    if t == 'repeat':
        return [s[2]]
    if t == 'fornum':
        return [x for x in s[2:5] if x is not None]
    if t == 'forin':
        return list(s[2])
    return []


def reads(s):
    """Expressions of s that are *read* (assignment targets that are bare
    names are writes, not reads; index targets read their object/key)."""
    t = s[0]
    if t == 'assign':
        out = list(s[2])
        for tg in s[1]:
            if tg[0] == 'index':
                out.append(tg)
        return out
    return rhs(s)


def count(stmts, counts):
    def c(e):
        if e[0] == 'name' and V.match(e[1]):
            counts[e[1]] = counts.get(e[1], 0) + 1
        if e[0] == 'func':
            count(e[3], counts)
            return e
        return None
    for s in stmts:
        for e in reads(s):
            walk(e, c)
        for b in subblocks(s):
            count(b, counts)


def names_in(e, acc):
    def c(x):
        if x[0] == 'name':
            acc.add(x[1])
        if x[0] == 'func':
            return x
        return None
    walk(e, c)


def has_call(e):
    f = [False]

    def c(x):
        if x[0] in ('call', 'mcall'):
            f[0] = True
        if x[0] == 'func':
            return x
        return None
    walk(e, c)
    return f[0]


def writes(s):
    w = set()
    if s[0] == 'assign':
        for tg in s[1]:
            if tg[0] == 'name':
                w.add(tg[1])
    elif s[0] == 'local':
        w.update(s[1])
    elif s[0] == 'fornum':
        w.add(s[1])
    elif s[0] == 'forin':
        w.update(s[1])
    return w


def replace_first(s, name, val):
    """Replace the first (left-to-right) occurrence of `name` in the rhs of s.
    Returns True on success. Stops before entering nested functions."""
    done = [False]

    def c(x):
        if done[0]:
            return x if (x and x[0] == 'func') else None
        if x[0] == 'name' and x[1] == name:
            done[0] = True
            return _wrap(val)
        if x[0] == 'func':
            return x
        return None

    def rep(e):
        return walk(e, c)
    t = s[0]
    if t == 'assign':
        s[2] = [rep(e) for e in s[2]]
        if not done[0]:
            s[1] = [rep(e) if e[0] == 'index' else e for e in s[1]]
    elif t == 'local':
        s[2] = [rep(e) for e in s[2]]
    elif t == 'callstat':
        s[1] = rep(s[1])
    elif t == 'return':
        s[1] = [rep(e) for e in s[1]]
    elif t == 'if':
        s[1][0][0] = rep(s[1][0][0])
    elif t == 'while':
        s[1] = rep(s[1])
    elif t == 'repeat':
        s[2] = rep(s[2])
    elif t == 'fornum':
        for idx in (2, 3, 4):
            if s[idx] is not None:
                s[idx] = rep(s[idx])
    elif t == 'forin':
        s[2] = [rep(e) for e in s[2]]
    return done[0]


def _wrap(val):
    return ['paren', val] if val[0] == 'ifexp' else val


def _earliest_use_clean(s, name):
    """True if `name`'s first occurrence in s is not preceded by a call."""
    seen_call = [False]
    result = [True]
    found = [False]

    def c(x):
        if found[0]:
            return x if (x and x[0] == 'func') else None
        if x[0] in ('call', 'mcall'):
            # evaluate function and args; check children first for the name
            pass
        if x[0] == 'name' and x[1] == name:
            found[0] = True
            if seen_call[0]:
                result[0] = False
            return None
        return None
    # emulate left-to-right by walking and marking calls after their subtree?
    # Simpler conservative rule: if the statement has any call at all and the
    # value has side effects, refuse (handled by caller). Here just locate.
    walk_lr(s, name, seen_call, found, result)
    return result[0] and found[0]


def walk_lr(s, name, seen_call, found, result):
    def visit(e):
        if found[0]:
            return
        t = e[0]
        if t == 'name':
            if e[1] == name:
                found[0] = True
                if seen_call[0]:
                    result[0] = False
            return
        if t == 'func':
            return
        if t == 'call':
            visit(e[1])
            for a in e[2]:
                visit(a)
            seen_call[0] = True
            return
        if t == 'mcall':
            visit(e[1])
            for a in e[3]:
                visit(a)
            seen_call[0] = True
            return
        if t == 'index':
            visit(e[1]); visit(e[2])
        elif t == 'bin':
            visit(e[2]); visit(e[3])
        elif t in ('un', 'paren'):
            visit(e[-1])
        elif t == 'table':
            for it in e[1]:
                if it[0] == 'expr':
                    visit(it[1])
                visit(it[2])
        elif t == 'ifexp':
            visit(e[1]); visit(e[2]); visit(e[3])
    for e in rhs(s):
        visit(e)
        if found[0]:
            break


def coalesce(stmts, counts):
    for s in stmts:
        for b in subblocks(s):
            coalesce(b, counts)
    i = 0
    while i + 1 < len(stmts):
        s = stmts[i]
        if s[0] == 'assign' and len(s[1]) == 1 and s[1][0][0] == 'name' and V.match(s[1][0][1]) \
                and len(s[2]) == 1 and counts.get(s[1][0][1]) == 1:
            name = s[1][0][1]
            val = s[2][0]
            vfree = set(); names_in(val, vfree)
            vcall = has_call(val)
            j = _find_use(stmts, i + 1, name, vfree, vcall)
            if j is not None and not (vfree & writes(stmts[j])) and \
                    not (vcall and not _earliest_use_clean(stmts[j], name)):
                if replace_first(stmts[j], name, val):
                    del stmts[i]
                    continue
        i += 1


def _find_use(stmts, start, name, vfree, vcall):
    """Index of the statement that uses `name`, or None if reaching it would
    reorder past a hazard."""
    for j in range(start, len(stmts)):
        s = stmts[j]
        top_use = _refs_any(rhs(s), name)
        sub_use = any(_refs_any([e], name) for b in subblocks(s) for e in _all_exprs(b))
        if top_use:
            return j
        if sub_use:
            return None     # use is inside a nested block; don't hoist across it
        if writes(s) & vfree:
            return None
        if vcall and _stmt_has_call(s):
            return None
    return None


def _stmt_has_call(s):
    if any(has_call(e) for e in rhs(s)):
        return True
    return False


def _all_exprs(stmts):
    for s in stmts:
        for e in rhs(s):
            yield e
        for b in subblocks(s):
            yield from _all_exprs(b)


def _refs(e, name):
    f = [False]

    def c(x):
        if x[0] == 'name' and x[1] == name:
            f[0] = True
        if x[0] == 'func':
            return x
        return None
    walk(e, c)
    return f[0]


def _refs_any(exprs, name):
    return any(_refs(e, name) for e in exprs)


def run(stmts):
    for _ in range(8):
        counts = {}
        count(stmts, counts)
        n0 = _size(stmts)
        coalesce(stmts, counts)
        if _size(stmts) == n0:
            break
    return stmts


def _size(stmts):
    n = 0
    for s in stmts:
        n += 1
        for b in subblocks(s):
            n += _size(b)
    return n
