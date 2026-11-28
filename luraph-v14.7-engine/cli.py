#!/usr/bin/env python3
from __future__ import annotations

import argparse
import importlib
import os
import re
import shutil
import sys
import tempfile
import zipfile
from pathlib import Path, PurePosixPath

VERSION_RE = re.compile(
    r"This file was protected using Luraph Obfuscator v(14\.(?:6|7|8|9))\b",
    re.I,
)

ENGINE_MODULES = {
    "14.6": "obfuscators.luraph_v14_6",
    "14.7": "obfuscators.luraph_v14_7",
    "14.8": "obfuscators.luraph_v14_8",
    "14.9": "obfuscators.luraph_v14_9",
}


def eprint(*args, **kwargs):
    print(*args, file=sys.stderr, **kwargs)


def find_project_root() -> Path:
    here = Path(__file__).resolve().parent
    candidates = [here, here.parent, Path.cwd(), Path.cwd().parent]
    for root in candidates:
        has_obfuscators = (
            (root / "obfuscators").is_dir()
            or (root / "obfuscators-folder.zip").is_file()
        )
        if has_obfuscators and (root / "harness.py").is_file():
            return root
    return here


def prepare_obfuscators(root: Path) -> None:
    """Unpack the Python engine package when the host only has its ZIP."""
    module_files = (
        root / "obfuscators" / "luraph_v14_6" / "__init__.py",
        root / "obfuscators" / "luraph_v14_7" / "__init__.py",
        root / "obfuscators" / "luraph_v14_8" / "__init__.py",
        root / "obfuscators" / "luraph_v14_9" / "__init__.py",
    )
    if all(path.is_file() for path in module_files):
        return
    archive = root / "obfuscators-folder.zip"
    if not archive.is_file():
        return
    root_resolved = root.resolve()
    with zipfile.ZipFile(archive) as package:
        for member in package.infolist():
            name = PurePosixPath(member.filename)
            if name.is_absolute() or ".." in name.parts:
                raise SystemExit(f"[!] Unsafe path in {archive.name}: {member.filename}")
            target = (root / Path(*name.parts)).resolve()
            if target != root_resolved and root_resolved not in target.parents:
                raise SystemExit(f"[!] Unsafe path in {archive.name}: {member.filename}")
        package.extractall(root)
    if not (root / "obfuscators").is_dir():
        raise SystemExit(f"[!] {archive.name} did not contain the obfuscators/ folder")


ROOT = find_project_root()
prepare_obfuscators(ROOT)
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


def read_source(path: Path) -> str:
    data = path.read_bytes()
    for enc in ("utf-8-sig", "utf-8", "latin-1"):
        try:
            return data.decode(enc)
        except UnicodeDecodeError:
            pass
    return data.decode("latin-1", errors="replace")


def detect_version(source: str) -> str | None:
    m = VERSION_RE.search(source[:4096])
    if m:
        return m.group(1)

    head = source.lstrip()[:20000]

    # Common v14.8 layout seen in protected samples.
    if head.startswith("local init = (function(...") and "return({" in head:
        return "14.8"

    # 14.7/14.8/14.9 can all start directly with return({ ... }); without
    # a banner that shape is intentionally ambiguous, so require --engine.

    return None


def load_engine(version: str):
    module_name = ENGINE_MODULES[version]
    try:
        mod = importlib.import_module(module_name)
    except ModuleNotFoundError as exc:
        if exc.name == module_name or exc.name.startswith(module_name + "."):
            raise SystemExit(
                f"[!] {module_name} was not found. Put luraph_v14_6, luraph_v14_7, "
                f"luraph_v14_8 and luraph_v14_9 inside {ROOT / 'obfuscators'}"
            ) from exc
        raise

    wanted = {"14.6": "LuraphV146", "14.7": "LuraphV147", "14.8": "LuraphV148", "14.9": "LuraphV149"}[version]
    cls = getattr(mod, wanted, None)
    if cls is None:
        # Be tolerant of class renames: choose the first class that looks like
        # an obfuscator and has a deobfuscate() method.
        for value in vars(mod).values():
            if isinstance(value, type) and hasattr(value, "deobfuscate"):
                cls = value
                break
    if cls is None:
        raise SystemExit(f"[!] could not find an engine class in {module_name}")
    return cls()


class Job:
    """Small compatibility job object used by the v14 drivers.

    The v14 engines were derived from the v15 framework and only require the
    fields/methods implemented here. Shared runtime work is still performed by
    harness.py / traceout.py from the parent project.
    """

    def __init__(self, args, input_path: Path, source: str, workdir: Path):
        self.args = args
        self.input = str(input_path)
        self.source = source
        self.debug = bool(args.debug)
        self.outdir = str(workdir)
        self._input_path = input_path
        self._requested_output = Path(args.output).resolve() if args.output else None

        self.source_path = self.write(self.path(".src.lua"), source, encoding="latin-1")
        self.trace_path = self.path(".trace.luau")

    def path(self, suffix: str) -> str:
        stem = self._input_path.stem
        return str(Path(self.outdir) / f"{stem}{suffix}")

    def write(self, path: str, data, encoding: str = "utf-8") -> str:
        p = Path(path)
        p.parent.mkdir(parents=True, exist_ok=True)
        if isinstance(data, bytes):
            p.write_bytes(data)
        else:
            # latin-1 is used for original protected source so byte values are
            # preserved 1:1. Fall back safely if a codepoint does not fit.
            try:
                p.write_text(str(data), encoding=encoding, newline="")
            except UnicodeEncodeError:
                p.write_text(str(data), encoding="utf-8", newline="")
        return str(p)

    def credit_header(self) -> str:
        if self.args.no_credit:
            return ""
        # (no banner on top: the first lines are the code, which is what a
        # file preview shows; the bot adds its own line at the end)
        return ""


def parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="cli.py",
        description="Luraph v14.6 / v14.7 / v14.8 / v14.9 deobfuscator frontend",
    )
    p.add_argument("input", help="protected .lua/.luau file")
    p.add_argument("-o", "--output", help="output file (default: deobfuscated.lua beside input)")
    p.add_argument(
        "--engine",
        choices=("auto", "14.6", "14.7", "14.8", "14.9", "v14.6", "v14.7", "v14.8", "v14.9"),
        default="auto",
        help="force a Luraph engine (default: auto)",
    )

    run = p.add_argument_group("runtime")
    run.add_argument("--timeout", type=float, default=120.0, help="runtime timeout in seconds")
    run.add_argument("--budget", type=float, default=30.0, help="emulated script time budget")
    run.add_argument("--executor", default="roblox", help="executor/environment profile")
    run.add_argument("--studio", action="store_true", help="use Studio/API cache mode")
    run.add_argument("--input-text", default=None, help="text returned to emulated input calls")
    run.add_argument("--strings", action="store_true", help="dump recovered strings")
    run.add_argument("--raw", action="store_true", help="save raw harness output")
    run.add_argument("--no-fold", action="store_true", help="disable trace constant folding")
    run.add_argument("--keep-harness", action="store_true", default=False,
                     help="keep generated runtime harness files")
    run.add_argument("--no-tidy", action="store_true", default=False,
                     help="disable trace tidying in compatible harness revisions")

    devirt = p.add_argument_group("devirtualization")
    devirt.add_argument("--no-devirt", action="store_true", help="only produce the behavior trace")
    devirt.add_argument("--no-hooks", action="store_true", help="disable VM closure instrumentation")
    devirt.add_argument("--max-runs", type=int, default=12, help="maximum trap reruns")
    devirt.add_argument("--devirt-rounds", type=int, default=200, help="maximum constant/lift rounds")

    out = p.add_argument_group("output/debug")
    out.add_argument("--debug", action="store_true", help="keep intermediate files")
    out.add_argument("--keep-luraph-runtime", action="store_true",
                     help="keep Luraph bootstrap/anti-tamper scaffolding in the output")
    out.add_argument("--keep-work", action="store_true", help="keep the temporary work directory")
    out.add_argument("--no-credit", action="store_true", help="omit the generated-file header")
    out.add_argument("--keep-preamble", action="store_true", default=False,
                     help="keep trace preamble when trace rendering is requested")
    out.add_argument("--trace-fallback", action="store_true", default=False,
                     help="return the behavior trace if devirtualization and loadstring recovery both fail")

    # Compatibility options used by some revisions of the shared harness.
    compat = p.add_argument_group("harness compatibility")
    compat.add_argument("--luau", default=None, help="path to luau/lune runtime if your harness accepts it")
    compat.add_argument("--bridge", default=None, help=argparse.SUPPRESS)
    compat.add_argument("--cfg", action="append", default=[], help=argparse.SUPPRESS)

    return p


def normalize_compat_args(args):
    # Different v15 framework revisions look for slightly different optional
    # Namespace members. Supplying harmless defaults keeps this wrapper usable
    # across those revisions without changing the engines.
    defaults = {
        "verbose": False,
        "quiet": False,
        "dump": False,
        "profile": False,
        "seed": None,
        "place_id": None,
        "game_id": None,
        "raw_path": None,
        "backend": None,
        "cache": True,
        "no_cache": False,
        "cfg": [],
        "keep_harness": False,
        "no_tidy": False,
        "keep_preamble": False,
        "trace_fallback": False,
        "tidy": True,
        "trace": False,
        "json": False,
        "color": True,
        "no_color": False,
        "keep_temp": False,
        "strict": False,
        "force": False,
        "interactive": False,
        "api_dump": None,
        "api_cache": None,
        "runtime": None,
        "config": None,
    }
    for name, value in defaults.items():
        if not hasattr(args, name):
            setattr(args, name, value)



def strip_luraph_runtime(output: Path) -> None:
    """Remove the proven root bootstrap, then reconstruct recovered dispatchers.

    The deflattener follows only statically-proven numeric control variables
    and slices original statements into their execution order. It runs after
    the root bootstrap is removed, so it is focused on recovered functions.
    """
    try:
        from strip_runtime import strip
        from unflatten import deflatten_text
        from obfuscators.luraph_v14_9.vmmap import luau_ast_executable

        original = read_source(output)
        ast_exe = luau_ast_executable()

        # First remove the structurally identified Luraph root bootstrap.
        cleaned, report = strip(original, ast_exe)
        if cleaned != original:
            output.write_text(cleaned, encoding="utf-8", newline="")

        # Then de-flatten only what remains: the recovered prototypes and their
        # nested closures. This never guesses symbolic branches or rewrites
        # recovered statements; it reorders source slices only when proven.
        recovered = cleaned
        flattened = deflatten_text(recovered, ast_exe)
        if flattened != recovered:
            output.write_text(flattened, encoding="utf-8", newline="")
            recovered = flattened

        if report or flattened != cleaned:
            removed = (report or {}).get("removed_luraph_lines", 0)
            helpers = len((report or {}).get("functions", []))
            before_states = len(re.findall(r"\bstate\s*==\s*\d+\b", cleaned))
            after_states = len(re.findall(r"\bstate\s*==\s*\d+\b", recovered))
            dispatch_removed = max(0, before_states - after_states)
            constants_left = len(re.findall(r"\bluraph_constant\w*\b", recovered))
            unresolved = len(re.findall(r"""error\(["']devirt:""", recovered))
            eprint("[+] Luraph cleanup: "
                   f"{removed} bootstrap lines and {helpers} named runtime helpers removed; "
                   f"{dispatch_removed} state checks eliminated by proven deflattening")
            if constants_left or unresolved:
                eprint("[!] Kept mixed recovered content intact: "
                       f"{constants_left} Luraph-named register references, "
                       f"{unresolved} unresolved devirt blocks remain")
    except Exception as exc:  # cleanup must never break deobfuscation
        eprint(f"[!] Luraph post-processing skipped (current output preserved): {exc}")


def write_flattened_analysis(output: Path) -> None:
    """Write a non-executable index when the lift is a flattened state machine."""
    try:
        from analysis_export import write_analysis
        source = read_source(output)
        # Avoid generating a duplicate companion for ordinary structured lifts.
        if not re.search(r"\\bwhile\\s+true\\s+do\\b", source) or not re.search(
            r"\\bif\\s+[A-Za-z_]\\w*\\s*==\\s*-?\\d+\\s+then\\b", source
        ):
            return
        report = output.with_suffix(".analysis.txt")
        line_count, branch_count = write_analysis(output, report)
        eprint(f"[+] wrote non-executable analysis: {report} "
               f"({line_count} source lines, {branch_count} state branches)")
    except Exception as exc:  # analysis companion must never break the main output
        eprint(f"[!] analysis export skipped (deobfuscated output preserved): {exc}")


def write_control_flow_report(output: Path) -> None:
    """Create a static CFG report for flattened state-machine lifts."""
    try:
        from control_flow import write_control_flow
        source = read_source(output)
        if not re.search(r"\\bwhile\\s+true\\s+do\\b", source):
            return
        report = output.with_suffix(".controlflow.txt")
        lines, blocks = write_control_flow(output, report)
        if blocks:
            eprint(f"[+] wrote control-flow report: {report} "
                   f"({blocks} state blocks, {lines} source lines)")
        else:
            report.unlink(missing_ok=True)
    except Exception as exc:  # report generation must never break the deobfuscation
        eprint(f"[!] control-flow recovery skipped (original output preserved): {exc}")


def main(argv=None) -> int:
    args = parser().parse_args(argv)
    normalize_compat_args(args)
    if args.cfg is None:
        args.cfg = []

    inp = Path(args.input).expanduser().resolve()
    if not inp.is_file():
        eprint(f"[!] input file not found: {inp}")
        return 2

    source = read_source(inp)

    chosen = args.engine.removeprefix("v")
    if chosen == "auto":
        chosen = detect_version(source)
        if chosen is None:
            eprint("[!] could not determine whether this is Luraph v14.6, v14.7, v14.8 or v14.9")
            eprint("    retry with --engine 14.7 or --engine 14.8")
            return 2

    args.engine_resolved = chosen
    engine = load_engine(chosen)

    # Strong check when a version banner exists, so forcing the wrong engine is
    # visible instead of silently producing garbage.
    banner = VERSION_RE.search(source[:4096])
    if banner and banner.group(1) != chosen:
        eprint(f"[!] warning: file says v{banner.group(1)}, but --engine selected v{chosen}")

    output = Path(args.output).expanduser().resolve() if args.output else inp.with_name("deobfuscated.lua")

    if args.keep_work or args.debug:
        workdir = inp.parent / f".{inp.stem}.luraph_v{chosen.replace('.', '_')}_work"
        workdir.mkdir(parents=True, exist_ok=True)
        cleanup = False
    else:
        workdir = Path(tempfile.mkdtemp(prefix=f"luraph_v{chosen.replace('.', '_')}_"))
        cleanup = True

    eprint(f"[*] engine: Luraph v{chosen}")
    eprint(f"[*] input : {inp}")

    try:
        job = Job(args, inp, source, workdir)
        result = engine.deobfuscate(job)
        if not result:
            eprint("[!] engine returned no output path")
            return 1

        result_path = Path(result)
        if not result_path.is_file():
            eprint(f"[!] engine output does not exist: {result_path}")
            return 1

        output.parent.mkdir(parents=True, exist_ok=True)
        if result_path.resolve() != output.resolve():
            shutil.copyfile(result_path, output)

        if not args.keep_luraph_runtime:
            strip_luraph_runtime(output)

        write_flattened_analysis(output)
        write_control_flow_report(output)

        print(str(output))
        eprint(f"[+] wrote: {output}")
        return 0
    finally:
        if cleanup:
            shutil.rmtree(workdir, ignore_errors=True)


if __name__ == "__main__":
    raise SystemExit(main())
