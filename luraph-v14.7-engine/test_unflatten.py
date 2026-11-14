"""Equivalence tests for the control-flow de-flattener.

Each case builds a flattened dispatch loop, de-flattens it, and runs BOTH the
original and the rebuilt version under the real luau interpreter on several
inputs, asserting identical output.  This proves behaviour is preserved, not
merely that the result parses.  Skips (exit 0) when the luau binaries are not
available, like the other engine tests.
"""

import os
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import unflatten  # noqa: E402


def _bin(name):
    for d in (os.path.join(HERE, "bin"),
              os.path.join(HERE, "..", "luraph-v15-engine", "bin"),
              os.path.join(HERE, "..", "luraph-v15.1-engine", "bin")):
        p = os.path.join(d, name)
        if os.path.isfile(p):
            return os.path.abspath(p)
    return None


def _run(luau, src, harness):
    with tempfile.NamedTemporaryFile("w", suffix=".luau", delete=False, encoding="utf-8", newline="\n") as f:
        f.write(src + "\n" + harness)
        p = f.name
    try:
        r = subprocess.run([luau, p], capture_output=True, text=True, timeout=30)
        return (r.returncode, r.stdout.strip(), r.stderr.strip())
    finally:
        os.remove(p)


LINEAR = """
local function run(a, b)
	local state = 1
	local n
	local acc = 0
	while true do
		if state == 1 then
			acc = a + b
			n = 5
			state = 2
		elseif state == 2 then
			if n ~= 5 then state = 9 else state = 3 end
		elseif state == 3 then
			acc = acc * 2
			state = 4
		elseif state == 4 then
			return acc
		end
	end
end
"""

BRANCH = """
local function run(a, b)
	local state = 1
	local acc = 0
	while true do
		if state == 1 then
			acc = a + b
			if a > b then state = 2 else state = 3 end
		elseif state == 2 then
			acc = acc + 100
			state = 4
		elseif state == 3 then
			acc = acc - 100
			state = 4
		elseif state == 4 then
			return acc
		end
	end
end
"""

NESTED = """
local function run(a, b)
	local state = 1
	local acc = 0
	local helper
	while true do
		if state == 1 then
			helper = function(x)
				local state = 1
				local r = 0
				while true do
					if state == 1 then
						r = x * 3
						state = 2
					elseif state == 2 then
						return r
					end
				end
			end
			acc = helper(a) + b
			state = 2
		elseif state == 2 then
			return acc
		end
	end
end
"""

HARNESS = "for _,p in ipairs({{1,2},{5,3},{3,3},{-4,9},{10,10},{0,0}}) do print(run(p[1],p[2])) end"


def main():
    luau = _bin("luau")
    astexe = _bin("luau-ast" if os.name != "nt" else "luau-ast.exe")
    if not luau or not astexe:
        print("SKIP: luau / luau-ast binaries not available")
        return 0
    failures = 0
    for name, src in (("linear", LINEAR), ("branch", BRANCH), ("nested-function", NESTED)):
        defl = unflatten.deflatten_text(src, astexe)
        if defl == src:
            print("FAIL %s: de-flattener made no change" % name)
            failures += 1
            continue
        if "while true do" in defl:
            print("FAIL %s: a dispatch loop survived" % name)
            failures += 1
        o1 = _run(luau, src, HARNESS)
        o2 = _run(luau, defl, HARNESS)
        if o1 != o2:
            print("FAIL %s: behaviour differs\n flat : %r\n defl : %r" % (name, o1, o2))
            failures += 1
        else:
            print("ok   %s: identical output on %d inputs" % (name, HARNESS.count("{", 1)))
    # a dispatcher that is a real loop must be left untouched (not corrupted)
    loopy = """
local function run(a)
	local state = 1
	local i = 0
	while true do
		if state == 1 then
			i = i + 1
			if i < a then state = 1 else state = 2 end
		elseif state == 2 then
			return i
		end
	end
end
"""
    defl = unflatten.deflatten_text(loopy, astexe)
    o1 = _run(luau, loopy, "print(run(5)) print(run(0))")
    o2 = _run(luau, defl, "print(run(5)) print(run(0))")
    if o1 != o2:
        print("FAIL real-loop: behaviour differs %r %r" % (o1, o2))
        failures += 1
    else:
        print("ok   real-loop: left equivalent (de-flattened=%s)" % (defl != loopy))
    if failures:
        print("%d FAILURE(S)" % failures)
        return 1
    print("all de-flatten equivalence checks passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
