"""Independent differential check of Fulcrum's string decoders.

`reference_decode` is a clean re-derivation of the LCG-style stream cipher,
written only from reading the four handler variants.  We run it against the
sample's *own* decoder functions (executed in the sandboxed mini evaluator)
on every (table, coeffs, key) triple the pipeline actually used.  Agreement of
two independent implementations is the evidence that the decode stage is
correct -- not the fact that one of them produced printable text.
"""
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from luau_ast import *
from scope import resolve
from lift import run_big_stack
from units import *
from ssa import *
import minilua

M = 16777216


def reference_decode(variant, G, H, J):
    H1, H2, H3, H4, H5 = (H + [0, 0, 0, 0, 0])[:5]
    if variant == 'cb':
        P, Q = H1, H2
        byte = lambda g, L: ((g - L) * H3) % 256
    elif variant == 'cc':
        P, Q = H1, H2 * H1
        byte = lambda g, L: (g * H3 - L) % 256
    elif variant == 'cd':
        P, Q = H1, -H2
        byte = lambda g, L: ((g + L) * H3) % 256
    elif variant == 'ce':
        P, Q = H1, -H2 * H1
        byte = lambda g, L: (g * H3 + L) % 256
    else:
        raise ValueError(variant)
    out = bytearray()
    for g in G:
        J = (J * P + Q) % M
        L = J + (J // 256) * H4 + (J // 65536) * H5
        out.append(byte(g, L) & 255)
    return bytes(out)


def main():
    ast = parse(open(sys.argv[1], encoding='utf-8', errors='surrogateescape').read())
    r = resolve(ast)
    ctx = Context(r, lambda *a: None)
    find_cache_vars(ast, ctx)
    log = []
    orig_run = ctx.run_decoder
    name_of = {}

    top = build_unit(ast, [], None, ctx)
    for name, (func, owner) in ctx.decoders.items():
        name_of[id(func)] = name

    def logged(func, owner, vals):
        res = orig_run(func, owner, vals)
        if len(vals) == 3 and isinstance(vals[0], list) and isinstance(vals[1], list):
            log.append((name_of.get(id(func), '?'), list(vals[0]), list(vals[1]), vals[2], res))
        return res
    ctx.run_decoder = logged

    for u in ctx.units:
        u.ssa = SSA(u, ctx)
        u.ssa.table_slot = set(n for n in u.ssa_vars if re.match(re.escape(u.tname) + r'__\d+$', n))
        u.ssa.build(); u.ssa.optimize()

    ok = bad = 0
    mism = []
    for variant, G, H, J, res in log:
        if not isinstance(res, bytes):
            continue
        ref = reference_decode(variant, G, H, J if not isinstance(J, float) else int(J))
        if ref == res:
            ok += 1
        else:
            bad += 1
            if len(mism) < 5:
                mism.append((variant, len(G), res[:20], ref[:20]))
    print('decoder differential: %d agree, %d disagree (of %d calls)' % (ok, bad, ok + bad))
    for m in mism:
        print('  MISMATCH', m)
    # printability of decoded cache strings
    printable = sum(1 for _, _, _, _, res in log if isinstance(res, bytes)
                    and all(32 <= c < 127 or c in (9, 10, 13) for c in res))
    print('printable results: %d / %d' % (printable, sum(1 for x in log if isinstance(x[4], bytes))))


run_big_stack(main)
