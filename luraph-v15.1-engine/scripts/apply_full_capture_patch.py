"""Idempotent patch: enable full_capture recording in runtime/envlog.luau"""
from pathlib import Path
import sys
p = Path(__file__).resolve().parents[1] / "runtime" / "envlog.luau"
t = p.read_text(encoding="utf-8", errors="replace")
if "CFG.full_capture ~= false" in t and "full_capture extras" in t:
    print("already patched")
    sys.exit(0)
needle = "local MAX_STMTS = CFG.max_stmts or 250000\nlocal MAX_BLOCK = CFG.max_block or 25000\nlocal MAX_WAITS = CFG.max_waits or 50\nlocal MAX_DEPTH = CFG.max_depth or 24\nlocal TIME_BUDGET = CFG.time_budget or 30\n"
insert = """local MAX_STMTS = CFG.max_stmts or 250000
local MAX_BLOCK = CFG.max_block or 25000
local MAX_WAITS = CFG.max_waits or 50
local MAX_DEPTH = CFG.max_depth or 24
local TIME_BUDGET = CFG.time_budget or 30

-- full_capture: record as much runtime evidence as possible (default ON unless CFG.full_capture == false)
if CFG.full_capture ~= false then
        CFG.full_capture = true
        CFG.call_log = true
        if CFG.call_log_full == nil then CFG.call_log_full = true end
        if CFG.dump_strings == nil then CFG.dump_strings = true end
        if CFG.devirt == nil then CFG.devirt = true end
        MAX_STMTS = CFG.max_stmts or 500000
        MAX_BLOCK = CFG.max_block or 100000
        MAX_WAITS = CFG.max_waits or 200
        MAX_DEPTH = CFG.max_depth or 48
end
"""
if needle not in t:
    print("needle missing", file=sys.stderr)
    sys.exit(1)
t = t.replace(needle, insert, 1)
extra = """
-- full_capture extras: emit map, prints, unknown globals (all), call-ring already dumped via call_log
if CFG.full_capture then
        if CHAIN.emit then
                local em = {}
                for pid, n in R.pairs(CHAIN.emit) do
                        R.insert(em, R.tostring(pid) .. "=" .. R.tostring(n))
                end
                R.sort(em)
                R.print(MARK .. "EMIT " .. R.concat(em, ","))
        end
        if CHAIN.rootCallee ~= nil then
                R.print(MARK .. "ROOT_CALLEE " .. R.tostring(CHAIN.rootCallee))
        end
        if CHAIN.seen then
                local seen = {}
                for pid, tag in R.pairs(CHAIN.seen) do
                        R.insert(seen, R.tostring(pid) .. ":" .. R.tostring(tag))
                end
                R.sort(seen)
                R.print(MARK .. "SEEN " .. R.concat(seen, ","))
        end
        if #unknownGlobals > 0 then
                R.print(MARK .. "UNK_GLOBALS " .. R.concat(unknownGlobals, ","))
        end
        if NATIVE and #OUTBUF > 0 then
                R.print(MARK .. "PRINTS_BEGIN")
                local start = 1
                if #OUTBUF > 5000 then start = #OUTBUF - 4999 end
                for i = start, #OUTBUF do
                        R.print(OUTBUF[i])
                end
                R.print(MARK .. "PRINTS_END")
        end
        if E.__OPDUMP then
                R.print(MARK .. "OPRING_BEGIN")
                R.pcall(E.__OPDUMP)
                R.print(MARK .. "OPRING_END")
        end
end
R.print(MARK .. "ENVLOG-END")
"""
if 'R.print(MARK .. "ENVLOG-END")' not in t:
    print("ENVLOG-END missing", file=sys.stderr)
    sys.exit(1)
t = t.replace('R.print(MARK .. "ENVLOG-END")', extra, 1)
p.write_text(t, encoding="utf-8")
print("patched", p)
