import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from luau_ast import *
from structure import Structurer, split_critical_edges, phi_to_copies, build_ast
import re


def collect_names(stmts, acc):
    def ex(e):
        if not isinstance(e, list) or not e or not isinstance(e[0], str):
            return
        t = e[0]
        if t == 'name':
            acc.add(e[1])
        elif t == '__closure':
            return
        elif t == 'func':
            return
        else:
            for x in e[1:]:
                if isinstance(x, list):
                    if x and isinstance(x[0], str):
                        ex(x)
                    else:
                        for y in x:
                            ex(y)
    def st(s):
        t = s[0]
        if t == 'assign':
            for x in s[1]: ex(x)
            for x in s[2]: ex(x)
        elif t == 'local':
            for n in s[1]: acc.add(n)
            for x in s[2]: ex(x)
        elif t == 'callstat':
            ex(s[1])
        elif t == 'return':
            for x in s[1]: ex(x)
        elif t == 'if':
            for c in s[1]:
                ex(c[0]); 
                for ss in c[1]: st(ss)
            if s[2]:
                for ss in s[2]: st(ss)
        elif t in ('while',):
            ex(s[1])
            for ss in s[2]: st(ss)
        elif t == 'repeat':
            for ss in s[1]: st(ss)
            ex(s[2])
        elif t == 'do':
            for ss in s[1]: st(ss)
        elif t == 'fornum':
            acc.add(s[1])
            for ss in s[5]: st(ss)
    for s in stmts:
        st(s)


def substitute_closures(stmts, emit_unit):
    def ex(e):
        if not isinstance(e, list) or not e or not isinstance(e[0], str):
            return e
        if e[0] == '__closure':
            return emit_unit(e[1][1])
        return [ex(x) if isinstance(x, list) and x and isinstance(x[0], str)
                else ([ex(y) for y in x] if isinstance(x, list) else x) for x in e]
    def st(s):
        t = s[0]
        if t == 'assign':
            s[1] = [ex(x) for x in s[1]]; s[2] = [ex(x) for x in s[2]]
        elif t == 'local':
            s[2] = [ex(x) for x in s[2]]
        elif t == 'callstat':
            s[1] = ex(s[1])
        elif t == 'return':
            s[1] = [ex(x) for x in s[1]]
        elif t == 'if':
            for c in s[1]:
                c[0] = ex(c[0])
                for ss in c[1]: st(ss)
            if s[2]:
                for ss in s[2]: st(ss)
        elif t == 'while':
            s[1] = ex(s[1])
            for ss in s[2]: st(ss)
        elif t == 'repeat':
            for ss in s[1]: st(ss)
            s[2] = ex(s[2])
        elif t == 'do':
            for ss in s[1]: st(ss)
        elif t == 'fornum':
            for ss in s[5]: st(ss)
    for s in stmts:
        st(s)


def emit_unit(u):
    st = Structurer(u)
    u.used_closures = []
    st.analyse()
    split_critical_edges(st)
    phi_to_copies(st)
    st.analyse()
    body = build_ast(st)
    u.fallback = st.fallback
    u._body = body
    u._struct = st
    return body
