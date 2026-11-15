"""
Luraph v14.8 pipeline (see LURAPH.md).

The protected script runs in the fake environment with every VM closure
instrumented (patch_entries). Checks that cannot be emulated exactly end in
a trap that corrupts the bytecode; the runtime reports which function made
that call and the script runs again with that function turned into a no-op.
Loadstring'd VM chunks are instrumented the same way and passed back.
Then the captured protos are lifted (devirt.py), with constant rounds for
code that never ran.
"""
import os
import re
import sys
import time

import harness
import traceout as trace

HERE = os.path.dirname(os.path.abspath(__file__))
MAX_RERUNS = 12
SPIN_CHECKS = 24    # watchdog checks (2^20 VM steps each) without environment access = endless loop


def patch_spin(src):
    """Spin watchdog (envlog's --cfg spin): every VM dispatch loop head counts
    steps in __SPIN.n and calls __SPIN.f() every __SPIN.step of them. Table
    operations only, plus that rare call (no locals: see patch_entries)."""
    return re.sub(r"while true do (?:local )?[A-Za-z_]+(?:,[A-Za-z_]+)*=\s*\(?[A-Za-z_]+\[[A-Za-z_]+\]\)?;",
                  lambda m: m.group(0) + "__SPIN.n=__SPIN.n+1;if __SPIN.n>=__SPIN.step then __SPIN.f()end;", src)


def patch_chunk(src, tmpdir):
    """Instrument a loadstring'd VM chunk like the main script."""
    path = os.path.join(tmpdir, "_chunk_%s.luau" % harness.chunk_key(src))
    with open(path, "w", encoding="utf-8", newline="") as f:
        f.write(src)
    try:
        return patch_entries(src, path)
    except Exception as e:  # not parseable by luau-ast: run it as is
        print("[!] could not instrument chunk (%s)" % e, file=sys.stderr)
        return src
    finally:
        os.remove(path)


def patch_entries(source, path):
    """Give every VM closure an entry hook. It only uses table operations (no
    calls, no locals), so the stack looks exactly as it would without it: it numbers
    protos in first-entry order, logs recent entries and returns early for the
    protos listed in __SKIPP."""
    from obfuscators.luraph_v14_8 import vmmap
    root = vmmap.load_ast(path)
    lines = source.split("\n")
    edits = []
    for l1, c1, pv in vmmap.closure_entries(root):
        # no locals: they would enlarge every VM frame, and Luraph mixes the
        # depth its stack-overflow probe reaches into its decryption keys.
        # __PLAST[pid] = entry number of the latest entry of that proto (it
        # tells invocations apart when statements are attributed to protos)
        k = "(%s or __PID)" % pv
        edits.append((l1, c1, ("if not __PID[{k}] then __PID.n=__PID.n+1;__PID[{k}]=__PID.n;end;"
                               "__ENT.n=__ENT.n+1;__ENT[__ENT.n%64]=__PID[{k}];__PLAST[__PID[{k}]]=__ENT.n;"
                               "if __SKIPP[__PID[{k}]] then return end;").format(k=k)))
    # closure -> proto, recorded where the closure is made (not per call), so
    # the runtime can map the functions on the Lua stack back to protos
    tag = harness.chunk_key(source)
    makers = vmmap.maker_info(root)
    if os.environ.get("DEVIRT_DEBUG"):
        print("[*] v14.x mapper: %d dispatcher(s), %d entry hook(s), %d maker(s)" %
              (len(vmmap.find_dispatchers(root)), len(vmmap.closure_entries(root)), len(makers)), file=sys.stderr)
    if not makers:
        print("[!] v14.x mapper found dispatch code but no closure makers; devirtualization capture may be incomplete",
              file=sys.stderr)
    for info in makers:
        (l2, c2), var, pv = info["at"], info["var"], info["proto"]
        code = " __PF[%s]=%s " % (var, info.get("pf_key", pv))
        # devirtualizer capture: once per proto, the maker-level values the VM
        # closure uses (operand arrays, constants, helpers). Table operations
        # only, like the entry hook; runs where the closure is made, not per call.
        cap = "".join("__PA[%s].%s=%s;" % (pv, nm, nm) for nm in info["captures"])
        # v14.x factories may close over locals from the surrounding initializer.
        # Capture those too so devirt can reconstruct the maker's parent Scope.
        cap += "".join("__PA[%s].%s=%s;" % (pv, env["field"], env["name"])
                       for env in info.get("outer_env", ()))
        # __PK: one closure per proto, for calls the devirtualizer asks the
        # runtime to evaluate (LPH_ENCSTR-style string decryptors)
        code += ("if __PA and not __PA[%s] then __PA[%s]={};__PA.n=__PA.n+1;__PA[%s].__seq=__PA.n;"
                 "__PA[%s].__maker=\"%s@%d,%d\";__PK[%s]=%s;%s end "
                 % (pv, pv, pv, pv, tag, l2, c2, info.get("pf_key", pv), var, cap))
        edits.append((l2, c2, code))
    for l, c, code in sorted(edits, reverse=True):
        lines[l] = lines[l][:c] + code + lines[l][c:]
    return "\n".join(lines)


MAX_FULL_LIFTS = int(os.environ.get("DEVIRT_MAX_FULL_LIFTS", "4"))


def devirtualize(job, ppath, dpath, cfg, rerun, chunk_paths=(), live=None):
    """Lift the captured protos; constants that only Luraph's lazy decoder can
    produce (code that never ran) are requested from further runs. With a
    live harness (`live()` -> fetch function, while the long-lived harness
    made the current dump) the walks ask for them right away (a chain of
    constants, each needed to find the next, then takes one round instead
    of one round per link)."""
    from obfuscators.luraph_v14_8 import devirt
    args = job.args
    requested = set()
    last_bufs = ""
    text = None
    rounds = args.devirt_rounds
    # Intermediate rounds only need the constant requests and decrypted
    # strings, which come from walking each function: they skip the
    # structuring/codegen/naming and reuse the walks of functions that asked
    # for nothing (devirt.collect_requests). The text comes from one full lift
    # at the fixed point; if that lift still asks for something new, the
    # remaining rounds are full lifts (the old way).
    quick = not os.environ.get("DEVIRT_FULL_ROUNDS")
    cache = devirt.WalkCache()
    t0 = time.time()
    full_lifts = 0
    for rnd in range(1, rounds + 1):
        t1 = time.time()
        full = not quick
        if quick:
            stats, reqs, bufs = devirt.run_big_stack(devirt.collect_requests, job.source_path, ppath, chunk_paths, cache,
                                                     live and live())
            new = reqs - requested
            print("[*] devirt round %d: %d functions (%d walked), %d unlifted blocks, %d new constant requests%s "
                  "(%.1fs)" % (rnd, stats["functions"], stats["walked"], stats["errors"], len(new),
                               " (%d decoded live)" % stats["fetched"] if stats.get("fetched") else "",
                               time.time() - t1), file=sys.stderr)
            if os.environ.get("DEVIRT_REQS"):
                for rq in sorted(new):
                    print("[*]     request %s" % rq, file=sys.stderr)
            if (not new and devirt.same_patches(last_bufs, bufs)) or rnd == rounds:
                full = True
        if full:
            print("[*] devirtualizing (round %d)..." % rnd, file=sys.stderr)
            t1 = time.time()
            text, stats, reqs, bufs = devirt.run_big_stack(devirt.lift_program, job.source_path, ppath, chunk_paths,
                                                           live and live())
            new = reqs - requested
            print("[*]   %d functions, %d unlifted blocks, %d unstructured jumps, %d new constant requests (%.1fs)"
                  % (stats["functions"], stats["errors"], stats["fallbacks"], len(new), time.time() - t1),
                  file=sys.stderr)
            full_lifts += 1
            # keep this lift on disk: if a later round is killed (memory, time),
            # it is still there for the bot to send
            try:
                job.write(job.path(".devirt.partial.luau"),
                          "-- partial result: saved after full lift %d (the run may not have finished)\n"
                          % full_lifts + devirt.finish_text(text or ""))
            except Exception as _ex:  # noqa: BLE001
                print("[!] could not save the partial lift: %s" % _ex, file=sys.stderr)
            if (not new and devirt.same_patches(last_bufs, bufs)) or rnd == rounds:
                break
            if full_lifts >= MAX_FULL_LIFTS:
                # a long chain of constants the walks only meet in the full
                # lift (14.3 functions that never ran): keep this result
                print("[*]   the full lift still asks for %d constants; keeping it (%d full lifts)"
                      % (len(new), full_lifts), file=sys.stderr)
                break
            if quick:
                # back to the walk-only rounds: they are much cheaper, and the
                # next full lift happens at their fixed point again
                print("[*]   the full lift needs more constants: more walk rounds", file=sys.stderr)
        requested |= reqs
        last_bufs = bufs
        c = dict(cfg)
        c["force_req"] = ";".join(sorted(requested))
        # strings decrypted in place by lifted code the runtime never ran
        c["force_buf"] = bufs
        t1 = time.time()
        body, err = rerun(c)
        if os.environ.get("DEVIRT_TIMING"):
            print("[*]   constant run %.1fs (total %.0fs)" % (time.time() - t1, time.time() - t0), file=sys.stderr)
        if body is None:
            print("[!] constant request run failed: " + err[-500:], file=sys.stderr)
            break
        m = re.search(r"\x00PROTOS ([^\n]*)\n", body)
        if not m or m.group(1).startswith("error:"):
            print("[!] constant request run gave no protos", file=sys.stderr)
            break
        with open(ppath, "w", encoding="utf-8", newline="\n") as f:
            f.write(m.group(1))
    finished = devirt.finish_text(text or "").strip()
    # Avoid duplicate/stale credit headers when the same output path is reused.
    finished = re.sub(r"^(?:-- Devirtualized with Luraph v14\.[789] engine\s*)+", "", finished).lstrip()
    if not finished:
        print("[!] v14.x lifter captured no liftable VM functions; falling back to the behavior trace",
              file=sys.stderr)
        return False

    # Reject output that contains known holes in the recovered VM graph.
    # Partial output is available only through the explicit DEVIRT_ALLOW_PARTIAL=1
    # debugging override. A large output file is not evidence of real logic.
    partial_allowed = os.environ.get("DEVIRT_ALLOW_PARTIAL") == "1"
    unresolved_states = int((stats or {}).get("unresolved_states", 0))
    unlifted = int((stats or {}).get("errors", 0))
    symbolic_markers = (
        "MISSING[" in finished
        or "unresolved Luraph runtime helper" in finished
        or bool(re.search(r'^\s*error\(["\']devirt:', finished, re.M))
    )
    if not partial_allowed and (unresolved_states or unlifted or symbolic_markers):
        print(
            "[!] refusing incomplete Luraph v14 output: "
            "%d unresolved state(s), %d unlifted block(s), symbolic markers=%s; "
            "using an intercepted payload or diagnostic trace instead"
            % (unresolved_states, unlifted, symbolic_markers),
            file=sys.stderr,
        )
        return False

    # backend.lower() leaves blocks it could not lift as error("devirt: ...")
    # lines: say so at the top instead of letting the file pass as complete
    unlifted = int((stats or {}).get("errors", 0))
    note = ""
    if unlifted:
        note = ("-- NOTE: partial lift: %d VM block(s) could not be lifted; each one is an\n"
                "-- error(\"devirt: ...\") line below. Everything else is recovered code.\n\n" % unlifted)
        print("[!] %d VM block(s) could not be lifted (marked in the output)" % unlifted, file=sys.stderr)
    try:
        import summary
        recovery = summary.build(finished, stats)
    except Exception as _ex:  # noqa: BLE001 - a summary must never break output
        print("[!] recovery summary failed: %s" % _ex, file=sys.stderr)
        recovery = ""
    header = job.credit_header()
    job.write(dpath, header + recovery + note + finished + "\n")
    return True


def run(job):
    """The whole Luraph pipeline; returns the result file's path."""
    args = job.args
    devirt_on = not args.no_devirt
    source = job.source
    try:
        patched = source if args.no_hooks else patch_entries(source, job.source_path)
    except SyntaxError as e:
        sys.exit("[!] the input is %s: the file is damaged (truncated, or mangled by a paste/upload); "
                 "nothing to run" % e)
    cache_path = harness.load_p2d_cache(job.input, args.studio)
    runner = harness.Runner(job)
    bridge = runner.bridge

    skip = []
    # spin watchdog from the first run: a script ending in a pure-VM endless
    # loop (tamper response, wait for remote code) then stops after a few
    # seconds instead of running into the timeout. DEOB_SPIN_LATE=1: only
    # after a timeout (the old way)
    spin = not os.environ.get("DEOB_SPIN_LATE")
    if spin:
        patched = patch_spin(patched)
    chunks = {}
    raw_chunks = {}     # key -> original source of a loadstring'd VM chunk (for devirt)
    body = None
    trapped = None      # (body, raw output) of the run that hit the last trap
    cfg = None
    for attempt in range(1, args.max_runs + 1):
        # (same keys as harness.base_cfg, in the order the harness always had)
        cfg = {"time_budget": args.budget, "dump_strings": args.strings, "executor": args.executor,
               "skip_protos": skip}
        if args.input_text is not None:
            cfg["input_text"] = args.input_text
        if args.no_fold:
            cfg["fold"] = False
        if devirt_on:
            cfg["devirt"] = True
        harness.user_cfg(args, cfg)
        if spin:
            cfg["spin"] = SPIN_CHECKS
        print("[*] tracing %s (run %d)..." % (job.input, attempt), file=sys.stderr)
        body, err = runner.run(patched, cfg, chunks)
        if body is None and not spin and err.startswith("timed out") and not bridge:
            # stuck in the script's own code (no environment access, so the
            # runtime never regains control): rerun with a spin watchdog
            print("[*] the script never finished; re-running with a spin watchdog", file=sys.stderr)
            spin = True
            patched = patch_spin(patched)
            chunks = {k: patch_spin(v) for k, v in chunks.items()}
            cfg["spin"] = SPIN_CHECKS
            body, err = runner.run(patched, cfg, chunks)
        if body is None:
            harness.save_raw(args.raw)
            runner.finish()
            sys.exit("[!] " + err)
        body = harness.take_p2d(body, cache_path, bridge is not None)
        found, body = harness.take_chunks(body)
        added = 0
        for key, src in found:
            if key not in chunks and args.no_hooks:
                chunks[key] = src
            elif key not in chunks:
                raw_chunks[key] = src
                chunks[key] = patch_chunk(src, job.outdir)
                if spin:
                    chunks[key] = patch_spin(chunks[key])
                added += 1
        if added:
            print("[*] script loadstring'd %d new VM chunk(s); instrumenting and re-running" % added, file=sys.stderr)
            continue
        trig = re.search(r"\x00TRIGGER (\d+)", body)
        if trapped is not None and trace.stmt_count(body) < trace.stmt_count(trapped[0]):
            # disabling that function made the script stop earlier: the trap
            # is the script's own check (e.g. LPH_CRASH() after a failed
            # license check), not an environment divergence. Keep that run.
            print("[*] disabling function #%d made the script stop earlier: it is the script's own "
                  "crash check; keeping run %d" % (skip[-1], attempt - 1), file=sys.stderr)
            body, harness.LAST_RAW[0] = trapped
            skip.pop()
            break
        if not trig:
            break
        trapped = (body, harness.LAST_RAW[0])
        pid = int(trig.group(1))
        if pid in skip:
            print("[!] anti-tamper trigger %d fired again; giving up on reruns" % pid, file=sys.stderr)
            break
        print("[*] anti-tamper trap reached through function #%d; disabling it and re-running" % pid,
              file=sys.stderr)
        skip.append(pid)

    run_text = harness.trace_text(body)     # the run the constant rounds must repeat
    body = harness.p2d_miss(body, cache_path)
    if not devirt_on:
        runner.finish()
    harness.save_raw(args.raw)
    body = re.sub(r"\x00TRIGGER \d+\n?", "", body)
    protos_json, body = trace.take_line(body, "PROTOS")
    force, body = trace.take_line(body, "FORCE")
    if force is not None and devirt_on:
        print("[*] constants decoded on request: " + force, file=sys.stderr)
    unscrambled, body = trace.take_line(body, "UNSCRAMBLED")
    if unscrambled is not None and devirt_on:
        print("[*] %s function(s) scrambled by the script's LPH_CRASH(): dumped as they were "
              "when first created" % unscrambled, file=sys.stderr)
    body, strings = trace.take_strings(body)

    notes = ["anti-tamper trap functions disabled: %s" % ", ".join("#%d" % p for p in skip)] if skip else []
    text = trace.header(job.input, notes) + body

    def write_trace():
        job.write(job.trace_path, trace.render(text, args))

    def semantic_trace_candidate():
        """Return a compact source-like runtime reconstruction for tiny, fully
        observed payloads.

        This is deliberately conservative.  It exists for cases such as a one-
        statement `print(...)` payload where the static v14 lifter accidentally
        follows the Luraph bootstrap/runtime instead of the payload.  We never
        use it for long/looping traces, intercepted loadstrings, or traces with
        envlog diagnostics.
        """
        try:
            if trace.stmt_count(body) > 16:
                return None
            rendered = trace.render(text, args)
        except Exception:
            return None
        bad = (
            "[envlog]", "loadstring() of", "repeat forever",
            "stopped in an endless loop", "script error:",
            "[deobf] removed",
        )
        low = rendered.lower()
        if any(x.lower() in low for x in bad):
            return None
        lines = rendered.splitlines()
        # trace.header() is a leading comment block.  Strip only that prefix;
        # keep comments that belong to the recovered payload itself.
        while lines and (not lines[0].strip() or lines[0].lstrip().startswith("--")):
            lines.pop(0)
        candidate = "\n".join(lines).strip()
        if not candidate or len(candidate.encode("utf-8", "replace")) > 12000:
            return None
        code_lines = [ln for ln in lines if ln.strip() and not ln.lstrip().startswith("--")]
        if not code_lines or len(code_lines) > 80:
            return None
        return candidate + "\n"

    def write_semantic_candidate(candidate):
        spath = job.path(".semantic.luau")
        job.write(spath, job.credit_header() + candidate)
        print("[*] static v14 lift resolved to bootstrap/runtime scaffolding; "
              "using compact trace-assisted payload reconstruction", file=sys.stderr)
        return spath

    def write_recovered_loadstring():
        """Return the deepest runtime-intercepted loadstring body as source.

        The runtime trace is diagnostic output, not deobfuscated source.  When
        Luraph hands execution to a loadstring payload and the VM lifter later
        fails, that intercepted payload is a strictly better recovery result
        than a statement-by-statement envlog trace (which may just follow a
        decoy/endless-loop path).
        """
        if not raw_chunks:
            return None

        # Dicts preserve insertion order.  The newest chunk is normally the
        # deepest stage reached by nested loadstring calls.  Walk backwards so
        # empty/whitespace-only chunks do not win.
        for key, src in reversed(list(raw_chunks.items())):
            if not isinstance(src, str) or not src.strip():
                continue
            rpath = job.path(".loadstring_recovered.lua")
            banner = (
                "-- Recovered from runtime-intercepted loadstring()\n"
                "-- source: %s | chunk: %s | bytes: %d\n\n"
                % (job.input, key, len(src.encode("latin-1", errors="replace")))
            )
            job.write(rpath, banner + src, encoding="utf-8")
            print(
                "[*] using intercepted loadstring payload as recovery output "
                "(%d bytes, chunk %s)" % (len(src.encode("latin-1", errors="replace")), key),
                file=sys.stderr,
            )
            return rpath
        return None

    # the trace is the result only without devirtualization or when lifting
    # fails: otherwise skip its readability pass (minutes on a 250k-statement trace)
    if not (devirt_on and not job.debug):
        write_trace()
    else:
        # Lifting a big script can run out of memory or time on a small host.
        # Save the behaviour trace first, so a killed run still leaves a
        # result behind (skipped for huge traces: their readability pass is slow)
        try:
            if trace.stmt_count(body) <= int(os.environ.get("DEOB_EARLY_TRACE_MAX", "20000")):
                job.write(job.path(".trace.luau"), trace.render(text, args))
        except Exception as _ex:  # noqa: BLE001 - only a safety net
            print("[!] early trace failed: %s" % _ex, file=sys.stderr)
    if strings is not None:
        job.write(job.path(".strings.txt"), strings)
    dpath = job.path(".devirt.luau")
    if protos_json is not None:
        ppath = job.path(".protos.json")
        if protos_json.startswith("error:"):
            print("[!] proto capture failed: " + protos_json, file=sys.stderr)
        else:
            job.write(ppath, protos_json)
            if devirt_on:
                # the lifter needs the original source of every VM chunk
                chunk_paths = [job.write(job.path(".chunk_%s.luau" % key), src, encoding="utf-8")
                               for key, src in raw_chunks.items()]
                lift(job, runner, patched, cfg, chunks, run_text, ppath, dpath, chunk_paths)
    runner.finish()
    trace.status_line(body)
    semantic = semantic_trace_candidate() if devirt_on else None
    if devirt_on and os.path.exists(dpath):
        # A lift full of calls to nil means the VM was misread.  Prefer a
        # directly intercepted loadstring body over the behavior trace.
        with open(dpath, encoding="utf-8", errors="replace") as f:
            lifted = f.read()

        # A one/few-statement payload must not turn into thousands of lines of
        # Luraph bootstrap code.  More importantly, a lift containing unresolved
        # runtime stubs or interpreter error sentinels is not recovered source:
        # those stubs return nil and the error sentinels stand in for VM states
        # whose semantics were lost.  Never return such a file as a successful
        # devirtualization merely because it contains fewer than 50 nil calls.
        unresolved = ("luraph_runtime" in lifted or
                      "unresolved Luraph runtime helper" in lifted or
                      "devirt:" in lifted)
        # code the runtime created through an unresolved helper and that was
        # lifted on its own (the payload, in v14.8 builds) is recovered source
        if unresolved and "local function recovered_proto_" in lifted:
            unresolved = False
        if unresolved:
            if semantic is not None:
                return write_semantic_candidate(semantic)
            print("[!] Luraph lift is incomplete: unresolved runtime helpers or "
                  "unsupported VM operations remain", file=sys.stderr)
            if not job.debug:
                # keep it for inspection (the bot attaches it), never as the result
                os.replace(dpath, job.path(".devirt.partial.luau"))
            recovered = write_recovered_loadstring()
            if recovered is not None:
                return recovered
            if getattr(args, "trace_fallback", False):
                if not os.path.exists(job.trace_path):
                    write_trace()
                return job.trace_path
            raise RuntimeError(
                "Luraph devirtualization was incomplete (unresolved runtime helper "
                "or unsupported VM operation); no verified loadstring payload was captured"
            )

        if semantic is not None:
            llines = max(1, lifted.count("\n"))
            slines = max(1, semantic.count("\n"))
            if llines > 200 and llines > slines * 10:
                return write_semantic_candidate(semantic)

        nil_calls = lifted.count("(nil)(")
        # (reject only a lift where calls of nil are a real share of the code:
        # the old 1%-of-lines bar was calibrated against output padded with
        # thousands of lines of inline bytecode tables, which are now
        # collapsed, so the same lift started failing it)
        if nil_calls < 50 or nil_calls * 25 < lifted.count("\n"):
            return dpath
        print("[!] the devirtualized output is broken (%d calls of nil)" % nil_calls, file=sys.stderr)
        if not job.debug:
            os.remove(dpath)
        recovered = write_recovered_loadstring()
        if recovered is not None:
            return recovered
        if getattr(args, "trace_fallback", False):
            if not os.path.exists(job.trace_path):
                write_trace()
            return job.trace_path
        raise RuntimeError("devirtualized output was invalid and no intercepted loadstring payload was available")

    if devirt_on:
        if semantic is not None:
            return write_semantic_candidate(semantic)
        recovered = write_recovered_loadstring()
        if recovered is not None:
            return recovered
        if getattr(args, "trace_fallback", False):
            print("[!] devirtualization produced no source; returning behaviour trace because --trace-fallback was requested",
                  file=sys.stderr)
            if not os.path.exists(job.trace_path):
                write_trace()
            return job.trace_path
        raise RuntimeError(
            "devirtualization produced no source and no intercepted loadstring payload; "
            "rerun with --debug for diagnostics or --trace-fallback if you explicitly want the behavior trace"
        )

    # --no-devirt intentionally asks for the behavior trace.
    if not os.path.exists(job.trace_path):
        write_trace()
    return job.trace_path


def lift(job, runner, patched, cfg, chunks, run_text, ppath, dpath, chunk_paths):
    """devirtualize() with its constant rounds answered by one long-lived
    harness (started now, so the script runs while round 1 walks); a fresh
    run per round if it fails or behaves differently."""
    args = job.args
    bridge = runner.bridge
    server = [None]
    synced = [False]    # the long-lived harness made the current dump
    if not bridge and not os.environ.get("DEOB_NO_SERVE"):
        server[0] = harness.HarnessServer(runner.luau, patched, cfg, chunks)
        server.append(False)    # its first run not checked yet

    def live():
        hs = server[0]
        if hs is None or not synced[0] or os.environ.get("DEOB_NO_FETCH"):
            return None
        return lambda paths, bufs: hs.fetch(paths, bufs, args.timeout)

    def rerun(c):
        synced[0] = False
        if bridge:
            return runner.run(patched, c, chunks)
        hs = server[0]
        if hs is not None and not server[1]:
            server[1] = True
            first, err = hs.reply(args.timeout)
            if os.environ.get("DEOB_SERVE_DIFF") and first is not None:
                for nm, tx in (("run", run_text), ("served", harness.trace_text(first))):
                    with open(job.path(".serve_%s.txt" % nm), "w", encoding="utf-8") as f:
                        f.write(tx)
            if first is None or not harness.same_trace(harness.trace_text(first), run_text):
                print("[!] the long-lived harness %s; running the script once per round instead"
                      % ("failed: " + err[-300:] if first is None else "traced differently"),
                      file=sys.stderr)
                hs.close()
                hs = server[0] = None
        if hs is not None:
            res = hs.request(c, args.timeout)
            if res[0] is not None:
                synced[0] = True
                return res
            print("[!] the long-lived harness failed: %s; running the script once per round "
                  "instead" % res[1][-300:], file=sys.stderr)
            hs.close()
            server[0] = None
        return runner.run(patched, c, chunks)
    try:
        devirtualize(job, ppath, dpath, cfg, rerun, chunk_paths, live)
    except Exception as e:
        # never lose the run over a lifter bug: the trace is still a result
        print("[!] devirtualization failed: %s: %s" % (type(e).__name__, e), file=sys.stderr)
        if os.environ.get("DEVIRT_TB"):
            import traceback
            traceback.print_exc()
    finally:
        if server[0] is not None:
            server[0].close()
