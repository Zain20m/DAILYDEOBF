# Fulcrum (polsec.net) Luau deobfuscator

A static reverse-engineering pipeline for Luau scripts protected by **Fulcrum**
(the obfuscator behind `polsec.net`, whose banner reads
`-- This file was obfuscated by Fulcrum [ https://polsec.net ]`).

It recovers behaviour, not the original source text. It removes Fulcrum's
control-flow flattening, decrypts its strings using the sample's own decoders
(run in a sandbox, never in a real Lua VM), lifts its register machine to SSA,
and rebuilds structured `if` / `while` / `break` / `continue`. Anything that
cannot be recovered is reported, not invented.

## What's in this archive

```
fulcrum_deobf.py      CLI entry point
verify_decoders.py    independent differential test of the string decoders
fulcrum.py            library entry point: recover(text) -> Result
luau_ast.py           tolerant Luau lexer / parser / printer
scope.py              unique-renames every local binding
units.py              finds the function tree (chunk + closure wrappers)
lift.py               removes control-flow flattening (partial evaluation)
minilua.py            tiny sandboxed Lua evaluator (runs ONLY the decoders)
ssa.py                SSA form, constant/copy propagation, DCE, const folding
structure.py          control-flow structuring (+ state-machine fallback)
emit.py, coalesce.py  AST assembly and single-use temp folding
out/                  recovered output for the bundled sample
  recovered.lua         behaviour-preserving reconstruction
  strings.txt           every decoded string and its cache slot
  REPORT.md             coverage, verification, and unresolved items
input.lua             the analysed sample (kept for reproducibility)
```

## Usage

Requires Python 3.8+ only (no third-party packages).

```sh
# deobfuscate
python3 fulcrum_deobf.py input.lua -o out

# reproduce the independent decoder verification
python3 verify_decoders.py input.lua
```

Run it on any Fulcrum-obfuscated Luau file by passing that file as the input.
The tool keys off Fulcrum's structural patterns (the constant-unpacking loop,
the dispatcher shape, and the four `cb`/`cc`/`cd`/`ce` decoder variants), not
off this one sample.

## How it works — the four layers

1. **Constant unpacking.** Each function opens with
   `for i = a, b, step do <if-tree on i> ... end`, an obfuscated switch that
   fills one table `T` with integer and boolean constants. The lifter executes
   this loop concretely (`lift.interp_chunk`).

2. **Control-flow flattening.** Every function body is a `while` dispatcher:
   a rolling key and several state variables select which basic block runs
   next. `lift.UnitLifter` partially evaluates the dispatcher — the state is
   compile-time, so every transition is resolved — producing a real basic-block
   graph. The rolling key is tracked symbolically so loops terminate.

3. **String encryption.** Strings are stored as byte tables and decoded on
   first use by an LCG stream cipher with four sign/order variants. The tool
   runs the sample's *own* decoder functions inside `minilua` (a restricted
   evaluator with no I/O, environment access or unbounded loops) and folds the
   plaintext back in. `verify_decoders.py` re-implements the cipher from
   scratch and checks the two agree on every call.

4. **Register machine.** Values are shuffled between locals, one-element boxes
   `r[1]` and shared table slots `T[k][i][1]`. Converting to SSA (`ssa.py`)
   turns the shuffles into copies, which propagate away, exposing the real
   data flow. `structure.py` then rebuilds structured control flow from the
   dominator / post-dominator trees.

## Honesty about limits

- Original identifier names are destroyed by obfuscation and are **not**
  reconstructed; recovered variables are SSA temporaries (`vN`) or the
  obfuscated short names.
- Functions with irreducible control flow (e.g. Fulcrum's
  `continue`-to-recheck loops) are emitted as a **correct explicit state
  machine** rather than being force-fit into nested loops or having paths
  dropped. The `REPORT.md` counts these.
- The recovered program is **not executed end-to-end** — the sample is a
  remote whitelist loader doing network I/O on the Roblox runtime. Confidence
  comes from the static round-trip and the independent decoder differential,
  which the report states explicitly.

## Scope / ethics

Only analyse software you have the right to examine. This is a static analysis
tool for understanding a protected program; it does not execute the sample and
is not a license bypass. Treat any obfuscated sample as untrusted.
