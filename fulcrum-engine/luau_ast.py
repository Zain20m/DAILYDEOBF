"""Minimal Luau lexer / parser / printer used by the Fulcrum recovery pipeline.

AST nodes are plain Python lists: [tag, ...fields].  Lists (not tuples) so
passes can rewrite in place.

Expressions
  ['num', float|int]         ['str', bytes]        ['nil'] ['true'] ['false'] ['vararg']
  ['name', ident]            ['index', obj, key]   ['call', fn, [args]]
  ['mcall', obj, name, [args]]
  ['func', [params], is_vararg, body]
  ['bin', op, a, b]          ['un', op, a]         ['paren', e]
  ['table', [[kind, key, val]]]   kind in 'pos','name','expr'
  ['ifexp', cond, a, b]
Statements
  ['local', [names], [exprs]]        ['assign', [targets], [exprs]]
  ['callstat', expr]                 ['do', body]
  ['while', cond, body]              ['repeat', body, cond]
  ['if', [[cond, body], ...], elsebody|None]
  ['fornum', var, a, b, c|None, body]
  ['forin', [names], [exprs], body]
  ['function', nameexpr, func]       ['localfunction', name, func]
  ['return', [exprs]]                ['break'] ['continue']
"""
import re
import sys
import threading

KEYWORDS = {
    'and', 'break', 'do', 'else', 'elseif', 'end', 'false', 'for', 'function',
    'if', 'in', 'local', 'nil', 'not', 'or', 'repeat', 'return', 'then',
    'true', 'until', 'while',
}

TOKEN_RE = re.compile(r'''
    (?P<ws>\s+)
  | (?P<comment>--(?:\[(?P<ceq>=*)\[[\s\S]*?\](?P=ceq)\]|[^\n]*))
  | (?P<name>[A-Za-z_][A-Za-z0-9_]*)
  | (?P<num>0[xX][0-9a-fA-F_]+|0[bB][01_]+|(?:\d[\d_]*\.?[\d_]*|\.\d[\d_]*)(?:[eE][+-]?\d+)?)
  | (?P<lstr>\[(?P<seq>=*)\[[\s\S]*?\](?P=seq)\])
  | (?P<str>"(?:\\[\s\S]|[^"\\\n])*"|'(?:\\[\s\S]|[^'\\\n])*')
  | (?P<op>\.\.\.|\.\.=|\.\.|==|~=|<=|>=|//=|//|\+=|-=|\*=|/=|%=|\^=|::|->|[-+*/%^\#<>=(){}\[\];:,.])
''', re.X)


class LuaSyntaxError(Exception):
    pass


def unescape(body):
    out = bytearray()
    i, n = 0, len(body)
    simple = {'n': 10, 't': 9, 'r': 13, 'a': 7, 'b': 8, 'f': 12, 'v': 11,
              '\\': 92, '"': 34, "'": 39, '\n': 10}
    while i < n:
        c = body[i]
        if c != '\\':
            out += c.encode('utf-8', 'surrogateescape')
            i += 1
            continue
        i += 1
        c = body[i]
        if c in simple:
            out.append(simple[c]); i += 1
        elif c == 'x':
            out.append(int(body[i + 1:i + 3], 16)); i += 3
        elif c == 'z':
            i += 1
            while i < n and body[i].isspace():
                i += 1
        elif c == 'u':
            j = body.index('}', i)
            out += chr(int(body[i + 2:j], 16)).encode('utf-8'); i = j + 1
        elif c.isdigit():
            j = i
            while j < n and j < i + 3 and body[j].isdigit():
                j += 1
            out.append(int(body[i:j]) & 255); i = j
        else:
            out += c.encode('utf-8'); i += 1
    return bytes(out)


def tokenize(src):
    toks = []
    pos, n = 0, len(src)
    while pos < n:
        m = TOKEN_RE.match(src, pos)
        if not m:
            raise LuaSyntaxError('bad token at offset %d: %r' % (pos, src[pos:pos + 30]))
        kind = m.lastgroup
        text = m.group()
        if kind in ('ws', 'comment'):
            pass
        elif m.group('name') is not None:
            toks.append(('kw' if text in KEYWORDS else 'name', text, pos))
        elif m.group('num') is not None:
            t = text.replace('_', '')
            if t[:2] in ('0x', '0X'):
                v = int(t, 16)
            elif t[:2] in ('0b', '0B'):
                v = int(t[2:], 2)
            else:
                v = float(t)
                if v == int(v) and abs(v) < 2 ** 53:
                    v = int(v)
            toks.append(('num', v, pos))
        elif m.group('lstr') is not None:
            eq = len(m.group('seq'))
            body = text[eq + 2:-(eq + 2)]
            if body.startswith('\r\n'):
                body = body[2:]
            elif body.startswith('\n'):
                body = body[1:]
            toks.append(('str', body.encode('utf-8', 'surrogateescape'), pos))
        elif m.group('str') is not None:
            toks.append(('str', unescape(text[1:-1]), pos))
        else:
            toks.append(('op', text, pos))
        pos = m.end()
    toks.append(('eof', None, n))
    return toks


BINPRI = {
    'or': (1, 1), 'and': (2, 2),
    '<': (3, 3), '>': (3, 3), '<=': (3, 3), '>=': (3, 3), '~=': (3, 3), '==': (3, 3),
    '..': (9, 8),
    '+': (10, 10), '-': (10, 10),
    '*': (11, 11), '/': (11, 11), '//': (11, 11), '%': (11, 11),
    '^': (14, 13),
}
UNARY_PRI = 12


class Parser:
    def __init__(self, src):
        self.toks = tokenize(src)
        self.i = 0

    # -- helpers
    def peek(self):
        return self.toks[self.i]

    def check(self, kind, val=None):
        t = self.toks[self.i]
        return t[0] == kind and (val is None or t[1] == val)

    def accept(self, kind, val=None):
        if self.check(kind, val):
            self.i += 1
            return True
        return False

    def expect(self, kind, val=None):
        t = self.toks[self.i]
        if not self.check(kind, val):
            raise LuaSyntaxError('expected %s %r, got %r at offset %d' % (kind, val, t[:2], t[2]))
        self.i += 1
        return t[1]

    # -- statements
    def block(self):
        body = []
        while True:
            t = self.peek()
            if t[0] == 'eof' or (t[0] == 'kw' and t[1] in ('end', 'else', 'elseif', 'until')):
                break
            if t[0] == 'kw' and t[1] == 'return':
                self.i += 1
                exprs = []
                t = self.peek()
                if not (t[0] == 'eof' or (t[0] == 'kw' and t[1] in ('end', 'else', 'elseif', 'until'))
                        or (t[0] == 'op' and t[1] == ';')):
                    exprs = self.exprlist()
                self.accept('op', ';')
                body.append(['return', exprs])
                break
            s = self.statement()
            if s is not None:
                body.append(s)
        return body

    def statement(self):
        t = self.peek()
        if t[0] == 'op' and t[1] == ';':
            self.i += 1
            return None
        if t[0] == 'kw':
            k = t[1]
            if k == 'if':
                self.i += 1
                clauses = []
                cond = self.expr(); self.expect('kw', 'then')
                clauses.append([cond, self.block()])
                els = None
                while True:
                    if self.accept('kw', 'elseif'):
                        cond = self.expr(); self.expect('kw', 'then')
                        clauses.append([cond, self.block()])
                    elif self.accept('kw', 'else'):
                        els = self.block(); self.expect('kw', 'end'); break
                    else:
                        self.expect('kw', 'end'); break
                return ['if', clauses, els]
            if k == 'while':
                self.i += 1
                cond = self.expr(); self.expect('kw', 'do')
                body = self.block(); self.expect('kw', 'end')
                return ['while', cond, body]
            if k == 'do':
                self.i += 1
                body = self.block(); self.expect('kw', 'end')
                return ['do', body]
            if k == 'for':
                self.i += 1
                n1 = self.expect('name')
                if self.accept('op', '='):
                    a = self.expr(); self.expect('op', ',')
                    b = self.expr()
                    c = self.expr() if self.accept('op', ',') else None
                    self.expect('kw', 'do')
                    body = self.block(); self.expect('kw', 'end')
                    return ['fornum', n1, a, b, c, body]
                names = [n1]
                while self.accept('op', ','):
                    names.append(self.expect('name'))
                self.expect('kw', 'in')
                exprs = self.exprlist(); self.expect('kw', 'do')
                body = self.block(); self.expect('kw', 'end')
                return ['forin', names, exprs, body]
            if k == 'repeat':
                self.i += 1
                body = self.block(); self.expect('kw', 'until')
                return ['repeat', body, self.expr()]
            if k == 'function':
                self.i += 1
                nm = ['name', self.expect('name')]
                is_method = False
                while True:
                    if self.accept('op', '.'):
                        nm = ['index', nm, ['str', self.expect('name').encode()]]
                    elif self.accept('op', ':'):
                        nm = ['index', nm, ['str', self.expect('name').encode()]]
                        is_method = True
                        break
                    else:
                        break
                f = self.funcbody()
                if is_method:
                    f[1].insert(0, 'self')
                return ['function', nm, f]
            if k == 'local':
                self.i += 1
                if self.accept('kw', 'function'):
                    name = self.expect('name')
                    return ['localfunction', name, self.funcbody()]
                names = [self.expect('name')]
                while self.accept('op', ','):
                    names.append(self.expect('name'))
                exprs = self.exprlist() if self.accept('op', '=') else []
                return ['local', names, exprs]
            if k == 'break':
                self.i += 1
                return ['break']
        if t[0] == 'name' and t[1] == 'continue':
            nt = self.toks[self.i + 1]
            if not (nt[0] == 'op' and nt[1] in ('=', '.', '[', '(', ':', ',', '{')) and nt[0] != 'str':
                self.i += 1
                return ['continue']
        e = self.suffixedexp()
        if self.check('op', '=') or self.check('op', ','):
            targets = [e]
            while self.accept('op', ','):
                targets.append(self.suffixedexp())
            self.expect('op', '=')
            return ['assign', targets, self.exprlist()]
        t = self.peek()
        if t[0] == 'op' and t[1] in ('+=', '-=', '*=', '/=', '//=', '%=', '^=', '..='):
            self.i += 1
            return ['assign', [e], [['bin', t[1][:-1], e, self.expr()]]]
        if e[0] not in ('call', 'mcall'):
            raise LuaSyntaxError('expression used as statement at offset %d' % t[2])
        return ['callstat', e]

    def funcbody(self):
        self.expect('op', '(')
        params, va = [], False
        if not self.check('op', ')'):
            while True:
                if self.accept('op', '...'):
                    va = True
                    break
                params.append(self.expect('name'))
                if not self.accept('op', ','):
                    break
        self.expect('op', ')')
        body = self.block()
        self.expect('kw', 'end')
        return ['func', params, va, body]

    # -- expressions
    def exprlist(self):
        out = [self.expr()]
        while self.accept('op', ','):
            out.append(self.expr())
        return out

    def primaryexp(self):
        t = self.peek()
        if t[0] == 'name':
            self.i += 1
            return ['name', t[1]]
        if t[0] == 'op' and t[1] == '(':
            self.i += 1
            e = self.expr()
            self.expect('op', ')')
            return ['paren', e]
        raise LuaSyntaxError('unexpected %r at offset %d' % (t[:2], t[2]))

    def callargs(self):
        t = self.peek()
        if t[0] == 'str':
            self.i += 1
            return [['str', t[1]]]
        if t[0] == 'op' and t[1] == '{':
            return [self.tablecons()]
        self.expect('op', '(')
        if self.accept('op', ')'):
            return []
        args = self.exprlist()
        self.expect('op', ')')
        return args

    def suffixedexp(self):
        e = self.primaryexp()
        while True:
            t = self.peek()
            if t[0] == 'op':
                if t[1] == '.':
                    self.i += 1
                    e = ['index', e, ['str', self.expect('name').encode()]]
                    continue
                if t[1] == '[':
                    self.i += 1
                    k = self.expr(); self.expect('op', ']')
                    e = ['index', e, k]
                    continue
                if t[1] == ':':
                    self.i += 1
                    name = self.expect('name')
                    e = ['mcall', e, name, self.callargs()]
                    continue
                if t[1] in ('(', '{'):
                    e = ['call', e, self.callargs()]
                    continue
            elif t[0] == 'str':
                e = ['call', e, self.callargs()]
                continue
            return e

    def tablecons(self):
        self.expect('op', '{')
        items = []
        while not self.check('op', '}'):
            t = self.peek()
            if t[0] == 'op' and t[1] == '[':
                self.i += 1
                k = self.expr(); self.expect('op', ']'); self.expect('op', '=')
                items.append(['expr', k, self.expr()])
            elif t[0] == 'name' and self.toks[self.i + 1][:2] == ('op', '='):
                self.i += 2
                items.append(['name', t[1], self.expr()])
            else:
                items.append(['pos', None, self.expr()])
            if not (self.accept('op', ',') or self.accept('op', ';')):
                break
        self.expect('op', '}')
        return ['table', items]

    def simpleexp(self):
        t = self.peek()
        if t[0] == 'num':
            self.i += 1; return ['num', t[1]]
        if t[0] == 'str':
            self.i += 1; return ['str', t[1]]
        if t[0] == 'kw':
            if t[1] == 'nil':
                self.i += 1; return ['nil']
            if t[1] == 'true':
                self.i += 1; return ['true']
            if t[1] == 'false':
                self.i += 1; return ['false']
            if t[1] == 'function':
                self.i += 1; return self.funcbody()
            if t[1] == 'if':
                self.i += 1
                cond = self.expr(); self.expect('kw', 'then')
                a = self.expr()
                if self.check('kw', 'elseif'):
                    # treat `elseif` as `else if`
                    self.toks[self.i] = ('kw', 'if', self.toks[self.i][2])
                    b = self.simpleexp()
                else:
                    self.expect('kw', 'else')
                    b = self.expr()
                return ['ifexp', cond, a, b]
        if t[0] == 'op':
            if t[1] == '...':
                self.i += 1; return ['vararg']
            if t[1] == '{':
                return self.tablecons()
        return self.suffixedexp()

    def expr(self, limit=0):
        t = self.peek()
        if (t[0] == 'kw' and t[1] == 'not') or (t[0] == 'op' and t[1] in ('-', '#')):
            self.i += 1
            a = self.expr(UNARY_PRI)
            if t[1] == '-' and a[0] == 'num':
                e = ['num', -a[1]]
            else:
                e = ['un', t[1], a]
        else:
            e = self.simpleexp()
        while True:
            t = self.peek()
            op = t[1] if t[0] in ('op', 'kw') else None
            pri = BINPRI.get(op)
            if pri is None or pri[0] <= limit:
                break
            self.i += 1
            rhs = self.expr(pri[1])
            e = ['bin', op, e, rhs]
        return e


def parse(src):
    p = Parser(src)
    body = p.block()
    if p.peek()[0] != 'eof':
        t = p.peek()
        raise LuaSyntaxError('unexpected %r at offset %d' % (t[:2], t[2]))
    return body


# ---------------------------------------------------------------- printer

def fmt_num(v):
    if isinstance(v, float):
        if v != v:
            return '(0/0)'
        if v in (float('inf'), float('-inf')):
            return '(1/0)' if v > 0 else '(-1/0)'
        if v == int(v) and abs(v) < 2 ** 53:
            return str(int(v))
        return repr(v)
    return str(v)


def fmt_str(b):
    out = ['"']
    for i, c in enumerate(b):
        if c == 34:
            out.append('\\"')
        elif c == 92:
            out.append('\\\\')
        elif c == 10:
            out.append('\\n')
        elif c == 13:
            out.append('\\r')
        elif c == 9:
            out.append('\\t')
        elif 32 <= c < 127:
            out.append(chr(c))
        else:
            out.append('\\%03d' % c)
    out.append('"')
    s = ''.join(out)
    # keep valid UTF-8 text readable
    try:
        txt = b.decode('utf-8')
        if all(ch.isprintable() or ch in '\n\r\t' for ch in txt) and any(c >= 128 for c in b):
            s = '"' + txt.replace('\\', '\\\\').replace('"', '\\"').replace('\n', '\\n') \
                .replace('\r', '\\r').replace('\t', '\\t') + '"'
    except UnicodeDecodeError:
        pass
    return s


IDENT_RE = re.compile(r'^[A-Za-z_][A-Za-z0-9_]*$')


def is_ident(b):
    try:
        s = b.decode('ascii')
    except UnicodeDecodeError:
        return False
    return bool(IDENT_RE.match(s)) and s not in KEYWORDS


class Printer:
    def __init__(self, indent='\t'):
        self.ind = indent
        self.out = []

    def expr(self, e, pri=0):
        t = e[0]
        if t == 'num':
            s = fmt_num(e[1])
            return '(' + s + ')' if s.startswith('-') and pri > 10 else s
        if t == 'str':
            return fmt_str(e[1])
        if t == 'nil':
            return 'nil'
        if t == 'true':
            return 'true'
        if t == 'false':
            return 'false'
        if t == 'vararg':
            return '...'
        if t == 'name' or t == 'global':
            return e[1]
        if t == 'closure':
            return '<closure unit %s upvalues %s>' % (getattr(e[1], 'id', '?'), ','.join(e[2]))
        if t == 'ssa':
            return 'v%d' % e[1]
        if t == 'paren':
            return '(' + self.expr(e[1]) + ')'
        if t == 'index':
            o = self.prefix(e[1])
            k = e[2]
            if k[0] == 'str' and is_ident(k[1]):
                return o + '.' + k[1].decode()
            return o + '[' + self.expr(k) + ']'
        if t == 'call':
            return self.prefix(e[1]) + '(' + ', '.join(self.expr(a) for a in e[2]) + ')'
        if t == 'mcall':
            return self.prefix(e[1]) + ':' + e[2] + '(' + ', '.join(self.expr(a) for a in e[3]) + ')'
        if t == 'func':
            return self.func(e, '')
        if t == 'bin':
            lp, rp = BINPRI[e[1]]
            s = self.expr(e[2], lp - (1 if lp == rp else 0) if lp >= rp else lp) + ' ' + e[1] + ' ' + \
                self.expr(e[3], rp)
            # left operand needs parens when its priority < lp (left assoc) ;
            return '(' + s + ')' if lp <= pri else s
        if t == 'un':
            op = 'not ' if e[1] == 'not' else e[1]
            inner = self.expr(e[2], UNARY_PRI)
            if op == '-' and inner.startswith('-'):
                inner = '(' + inner + ')'
            s = op + inner
            return '(' + s + ')' if pri > UNARY_PRI else s
        if t == 'table':
            parts = []
            for kind, k, v in e[1]:
                if kind == 'pos':
                    parts.append(self.expr(v))
                elif kind == 'name':
                    parts.append(k + ' = ' + self.expr(v))
                else:
                    parts.append('[' + self.expr(k) + '] = ' + self.expr(v))
            return '{' + ', '.join(parts) + '}'
        if t == 'ifexp':
            s = 'if ' + self.expr(e[1]) + ' then ' + self.expr(e[2]) + ' else ' + self.expr(e[3])
            return '(' + s + ')' if pri > 0 else s
        raise ValueError('unknown expr ' + repr(t))

    def prefix(self, e):
        s = self.expr(e)
        if e[0] in ('name', 'global', 'ssa', 'index', 'call', 'mcall', 'paren'):
            return s
        return '(' + s + ')'

    def func(self, f, name):
        params = list(f[1]) + (['...'] if f[2] else [])
        depth = self.depth
        save = self.out
        self.out = []
        self.depth = depth + 1
        self.block(f[3])
        body = ''.join(self.out)
        self.out = save
        self.depth = depth
        return 'function' + (' ' + name if name else '') + '(' + ', '.join(params) + ')\n' + body + \
            self.ind * depth + 'end'

    def line(self, s):
        self.out.append(self.ind * self.depth + s + '\n')

    def block(self, body):
        for s in body:
            self.stat(s)

    def stat(self, s):
        t = s[0]
        if t == 'local':
            self.line('local ' + ', '.join(s[1]) +
                      (' = ' + ', '.join(self.expr(e) for e in s[2]) if s[2] else ''))
        elif t == 'assign':
            x = ', '.join(self.expr(e) for e in s[1]) + ' = ' + ', '.join(self.expr(e) for e in s[2])
            self.line((';' if x.startswith('(') else '') + x)
        elif t == 'callstat':
            x = self.expr(s[1])
            self.line((';' if x.startswith('(') else '') + x)
        elif t == 'do':
            self.line('do'); self.depth += 1; self.block(s[1]); self.depth -= 1; self.line('end')
        elif t == 'while':
            self.line('while ' + self.expr(s[1]) + ' do')
            self.depth += 1; self.block(s[2]); self.depth -= 1; self.line('end')
        elif t == 'repeat':
            self.line('repeat'); self.depth += 1; self.block(s[1]); self.depth -= 1
            self.line('until ' + self.expr(s[2]))
        elif t == 'if':
            for n, (cond, body) in enumerate(s[1]):
                self.line(('if ' if n == 0 else 'elseif ') + self.expr(cond) + ' then')
                self.depth += 1; self.block(body); self.depth -= 1
            if s[2] is not None:
                self.line('else'); self.depth += 1; self.block(s[2]); self.depth -= 1
            self.line('end')
        elif t == 'fornum':
            self.line('for ' + s[1] + ' = ' + self.expr(s[2]) + ', ' + self.expr(s[3]) +
                      (', ' + self.expr(s[4]) if s[4] is not None else '') + ' do')
            self.depth += 1; self.block(s[5]); self.depth -= 1; self.line('end')
        elif t == 'forin':
            self.line('for ' + ', '.join(s[1]) + ' in ' + ', '.join(self.expr(e) for e in s[2]) + ' do')
            self.depth += 1; self.block(s[3]); self.depth -= 1; self.line('end')
        elif t == 'function':
            self.line(self.func(s[2], self.expr(s[1])))
        elif t == 'localfunction':
            self.line('local ' + self.func(s[2], s[1]))
        elif t == 'return':
            self.line('return' + (' ' + ', '.join(self.expr(e) for e in s[1]) if s[1] else ''))
        elif t == 'break':
            self.line('break')
        elif t == 'continue':
            self.line('continue')
        elif t == 'comment':
            for ln in s[1].split('\n'):
                self.line('-- ' + ln)
        else:
            raise ValueError('unknown stat ' + repr(t))

    depth = 0


def to_source(body, indent='\t'):
    p = Printer(indent)
    p.block(body)
    return ''.join(p.out)


def run_big_stack(fn, *args):
    """Run fn in a thread with a large stack (deeply nested obfuscated input)."""
    sys.setrecursionlimit(1000000)
    threading.stack_size(1024 * 1024 * 1024)
    box = {}

    def target():
        try:
            box['r'] = fn(*args)
        except BaseException as ex:  # noqa
            box['e'] = ex
    th = threading.Thread(target=target)
    th.start(); th.join()
    if 'e' in box:
        raise box['e']
    return box.get('r')
