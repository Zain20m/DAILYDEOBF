# Uploaded Luraph archive inspection

## DiscordDeobBot-VIP-Smart-Deob.zip

- Size: 4,041,524 bytes
- SHA-256: `52a6155e858006ebf6fd2385f88c95c4fa9315533b5dc8e8fa42fc2a2bfaa2f6`

- Files: 71

### File listing

- `.env.example` (47 bytes)
- `.gitignore` (31 bytes)
- `backend.py` (5,206 bytes)
- `bot.py` (40,651 bytes)
- `build_luau.py` (4,114 bytes)
- `cli.py` (12,326 bytes)
- `codegen.py` (72,270 bytes)
- `datatypes.luau` (27,867 bytes)
- `deob.py` (8,318 bytes)
- `envlog.luau` (170,513 bytes)
- `fold.py` (38,493 bytes)
- `gen_roblox.py` (2,387 bytes)
- `gen_unicode.py` (1,869 bytes)
- `harness.py` (22,911 bytes)
- `HOSTING.txt` (1,797 bytes)
- `host_start.py` (1,724 bytes)
- `idioms.py` (35,141 bytes)
- `ir.py` (6,313 bytes)
- `lexer.py` (4,725 bytes)
- `localfuncs.py` (2,310 bytes)
- `loops.py` (15,278 bytes)
- `luasym.py` (32,498 bytes)
- `luauast.py` (10,252 bytes)
- `names.py` (27,660 bytes)
- `obfuscators-folder.zip` (256,693 bytes)
- `README.md` (2,855 bytes)
- `requirements.txt` (41 bytes)
- `roblox_api.luau` (258,935 bytes)
- `setup.bat` (637 bytes)
- `setup_luau_linux.sh` (544 bytes)
- `spacing.py` (2,648 bytes)
- `start.bat` (629 bytes)
- `START_HERE.txt` (1,638 bytes)
- `structure.py` (46,534 bytes)
- `tidy.py` (18,687 bytes)
- `traceout.py` (1,962 bytes)
- `unicode_data.luau` (43,818 bytes)
- `variables.py` (38,758 bytes)
- `bin/cli.py` (10,952 bytes)
- `bin/luau-analyze.exe` (3,660,288 bytes)
- `bin/luau-ast.exe` (589,824 bytes)
- `bin/luau-compile.exe` (1,391,616 bytes)
- `bin/luau.exe` (1,657,344 bytes)
- `bin/readme.txt` (34 bytes)
- `obfuscators/base.py` (3,224 bytes)
- `obfuscators/__init__.py` (1,004 bytes)
- `obfuscators/luraph_v14_7/devirt.py` (168,769 bytes)
- `obfuscators/luraph_v14_7/driver.py` (24,465 bytes)
- `obfuscators/luraph_v14_7/optrace.py` (3,284 bytes)
- `obfuscators/luraph_v14_7/vmmap.py` (24,449 bytes)
- `obfuscators/luraph_v14_7/__init__.py` (2,318 bytes)
- `obfuscators/luraph_v14_8/devirt.py` (168,769 bytes)
- `obfuscators/luraph_v14_8/driver.py` (24,465 bytes)
- `obfuscators/luraph_v14_8/optrace.py` (3,284 bytes)
- `obfuscators/luraph_v14_8/vmmap.py` (24,449 bytes)
- `obfuscators/luraph_v14_8/__init__.py` (2,321 bytes)
- `obfuscators/luraph_v14_9/devirt.py` (168,769 bytes)
- `obfuscators/luraph_v14_9/driver.py` (24,465 bytes)
- `obfuscators/luraph_v14_9/optrace.py` (3,284 bytes)
- `obfuscators/luraph_v14_9/vmmap.py` (24,449 bytes)
- `obfuscators/luraph_v14_9/__init__.py` (2,321 bytes)
- `obfuscators/luraph_v15/devirt.py` (154,434 bytes)
- `obfuscators/luraph_v15/driver.py` (18,772 bytes)
- `obfuscators/luraph_v15/options.txt` (1,278 bytes)
- `obfuscators/luraph_v15/optrace.py` (3,273 bytes)
- `obfuscators/luraph_v15/vmmap.py` (19,143 bytes)
- `obfuscators/luraph_v15/__init__.py` (2,617 bytes)
- `obfuscators/luraph_v15/probes/_flip.py` (1,884 bytes)
- `obfuscators/luraph_v15/probes/_probe.py` (2,833 bytes)
- `obfuscators/luraph_v15/probes/_probe_all.py` (728 bytes)
- `obfuscators/luraph_v15/probes/_probe_inline.py` (2,130 bytes)

### Selected text files

#### cli.py

```text
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
    r"This file was protected using Luraph Obfuscator v(14\.(?:7|8|9))\b",
    re.I,
)

ENGINE_MODULES = {
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
                f"[!] {module_name} was not found. Put luraph_v14_7, luraph_v14_8 and "
                f"luraph_v14_9 inside {ROOT / 'obfuscators'}"
            ) from exc
        raise

    wanted = {"14.7": "LuraphV147", "14.8": "LuraphV148", "14.9": "LuraphV149"}[version]
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
        return "-- Deobfuscated in https://discord.gg/Be9adB2dCn\n\n"


def parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="cli.py",
        description="Luraph v14.7 / v14.8 / v14.9 deobfuscator frontend",
    )
    p.add_argument("input", help="protected .lua/.luau file")
    p.add_argument("-o", "--output", help="output file (default: deobfuscated.lua beside input)")
    p.add_argument(
        "--engine",
        choices=("auto", "14.7", "14.8", "14.9", "v14.7", "v14.8", "v14.9"),
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
            eprint("[!] could not determine whether this is Luraph v14.7 or v14.8")
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
       
```

#### deob.py

```text
"""
deobf: dynamic deobfuscator for Roblox Luau scripts.

Usage:
    python deob.py <input>                one input -> one output file:
                                          <input folder>/output/<input name>
    python deob.py <input> --no-devirt    faster: only the behaviour trace
    python deob.py <input> --debug        every intermediate file in output/
    python deob.py <input> --detect       only print which obfuscator it is

The input's obfuscator is detected (obfuscators/: one plugin per
obfuscator; --obfuscator NAME forces one) and its plugin runs the pipeline.
Unrecognized inputs get the generic behaviour trace: the script runs in the
real Luau VM against a fake Roblox/executor environment (envlog.luau) and
everything it does is rendered back as Luau. Nothing touches the network or
Roblox (--studio optionally runs the harness inside Roblox Studio).

Exit status: 0 with a result file, 1 on failure, 2 on bad usage.
"""
import argparse
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path:
    sys.path.insert(0, HERE)

import obfuscators  # noqa: E402
from obfuscators.base import Job  # noqa: E402

# Lifting is pure Python (luasym's symbolic interpreter): PyPy runs it ~2x
# faster once its JIT has warmed up, which costs a few seconds. Worth it only
# for big scripts; the obfuscated file's size is a good proxy (Luraph's VM
# alone is ~230 KB).
PYPY_MIN_SIZE = 350_000


def find_pypy():
    import glob
    import shutil
    p = shutil.which("pypy3")
    if p:
        return p
    # winget installs it here; PATH may not be refreshed yet
    pat = os.path.join(os.environ.get("LOCALAPPDATA", ""), "Microsoft", "WinGet", "Packages",
                       "PyPy.PyPy.3*", "*", "pypy3.exe")
    found = sorted(glob.glob(pat))
    return found[-1] if found else None


def maybe_reexec_pypy(args):
    """Run this whole command under PyPy instead (see PYPY_MIN_SIZE)."""
    import platform
    if platform.python_implementation() == "PyPy" or args.no_pypy or args.no_devirt or args.detect:
        return
    if not args.pypy and os.path.getsize(args.input) < PYPY_MIN_SIZE:
        return
    pypy = find_pypy()
    if not pypy:
        if args.pypy:
            print("[!] --pypy: PyPy not found (winget install PyPy.PyPy.3.11); using this Python",
                  file=sys.stderr)
        return
    print("[*] big script: running under PyPy (%s; --no-pypy to turn off)" % pypy, file=sys.stderr)
    sys.stderr.flush()
    sys.exit(subprocess.call([pypy, os.path.abspath(__file__)] + sys.argv[1:]))


def parser():
    ap = argparse.ArgumentParser(description="Deobfuscate a protected Roblox Luau script.")
    ap.add_argument("input")
    ap.add_argument("-o", "--output", help="result file (default: <input folder>/output/<input name>)")
    ap.add_argument("--obfuscator", metavar="NAME",
                    help="skip detection and use this plugin (%s)" % ", ".join(p.name for p in obfuscators.PLUGINS))
    ap.add_argument("--detect", action="store_true",
                    help="only print the detected obfuscator (NAME<tab>confidence<tab>label) and exit")
    ap.add_argument("--timeout", type=int, default=90, help="hard timeout per run in seconds")
    ap.add_argument("--budget", type=int, default=30, help="soft time budget for the traced script")
    ap.add_argument("--executor", default="Wave", help="name returned by identifyexecutor()")
    ap.add_argument("--keep-harness", action="store_true", help="keep the generated harness file")
    ap.add_argument("--input-text", help="text that TextBoxes contain when event handlers are traced "
                                         "(exercises e.g. key-check branches)")
    ap.add_argument("--cfg", action="append", default=[], metavar="KEY=VALUE",
                    help="extra runtime option for envlog.luau, e.g. --cfg prelude=... (see CLAUDE.md)")
    ap.add_argument("--strings", action="store_true", help="also dump every string the script builds")
    ap.add_argument("--no-tidy", action="store_true",
                    help="write the raw trace (skip the readability pass in tidy.py)")
    ap.add_argument("--no-fold", action="store_true",
                    help="do not fold repeated helper calls and unrolled loops back into functions/loops")
    ap.add_argument("--keep-preamble", action="store_true",
                    help="keep the obfuscator's own environment/anti-tamper probes at the top of the trace")
    ap.add_argument("--raw", help="also save the complete raw runtime output of the last run here")
    ap.add_argument("--studio", action="store_true",
                    help="optional: run inside Roblox Studio so engine objects (Path2D, UDim2, ...) are real; "
                         "serves the harness on 127.0.0.1 and waits for the loader written next to the output")
    ap.add_argument("--port", type=int, default=34889, help="local port for --studio")
    ap.add_argument("--studio-wait", type=int, default=600, help="seconds to wait for Studio per run")
    ap.add_argument("--no-devirt", action="store_true",
                    help="fast: skip lifting VM bytecode; the output is the behaviour trace only")
    # Compatibility with older Discord bot.py builds. The v15 engine does not
    # implement the v14 CLI's trace-fallback switch, but accepting it avoids
    # an argparse failure when a host has not replaced its bot.py yet.
    ap.add_argument("--trace-fallback", action="store_true", help=argparse.SUPPRESS)
    ap.add_argument("--devirt", action="store_true", help=argparse.SUPPRESS)   # the default now
    ap.add_argument("--debug", action="store_true",
                    help="write every intermediate file to the output folder (trace *.deobf.luau, "
                         "*.devirt.luau, ...) instead of one result file")
    ap.add_argument("--pypy", action="store_true",
                    help="run under PyPy even for a small script (default: only above %d bytes)" % PYPY_MIN_SIZE)
    ap.add_argument("--no-pypy", action="store_true", help="never switch to PyPy")
    for p in obfuscators.PLUGINS:
        p.add_arguments(ap)
    return ap


def main():
    args = parser().parse_args()
    with open(args.input, "rb") as f:
        source = f.read().decode("latin-1")
    if args.obfuscator:
        try:
            plugin, conf = obfuscators.by_name(args.obfuscator), None
        except KeyError as e:
            sys.exit("[!] %s" % e.args[0])
    else:
        plugin, conf = obfuscators.detect(source)
        if conf < obfuscators.MIN_CONFIDENCE:
            sys.exit("[!] no supported Luraph v15 format was detected")
    if args.detect:
        print("%s\t%s\t%s" % (plugin.name, "forced" if conf is None else "%.2f" % conf, plugin.label))
        return
    maybe_reexec_pypy(args)
    print("[*] obfuscator: %s%s" % (plugin.label, "" if conf is None else " (detected, %.2f)" % conf),
          file=sys.stderr)

    outdir = os.path.join(os.path.dirname(os.path.abspath(args.input)), "output")
    tracename = re.sub(r"(\.luau?|\.txt)?$", ".deobf.luau", os.path.basename(args.input), count=1)
    workdir = None
    if args.debug:
        # every file: <input folder>/output/<name>.deobf.luau, .devirt.luau, ...
        trace_path = args.output or os.path.join(outdir, tracename)
        final = None
    else:
        # one input -> one output file (<input folder>/output/<input file name>);
        # intermediate files live in a temporary folder
        import tempfile
        workdir = tempfile.mkdtemp(prefix="deobf_")
        trace_path = os.path.join(workdir, tracename)
        final = args.output or os.path.join(outdir, os.path.basename(args.input))
    os.makedirs(os.path.dirname(os.path.abspath(final or trace_path)), exist_ok=True)
    try:
        result = plugin.deobfuscate(Job(args.input, source, args, trace_path, args.debug, plugin.label))
        if final:
            if not result or not os.path.exists(result):
                sys.exit("[!] no result")
            import shutil
            shutil.copyfile(result, final)
            print("[+] result: " + final, file=sys.stderr)
    finally:
        if workdir:
            import shutil
            shutil.rmtree(workdir, ignore_errors=True)


if __name__ == "__main__":
    main()

```

#### README.md

```text
# Luraph Deobfuscator Discord Bot

This build contains only the Luraph deobfuscation engines: **v14.7, v14.8, v14.9, v15, and v15.1**.

## Commands

- `/deob` — upload a Lua/Luau file, paste source, or provide a loader URL. Choose public Luraph v14.7, v14.8, v14.9, or v15. Results are posted publicly as `.lua` files.
- `/vipdeob` — run Luraph v15.1. Requires role `1387797482607739010`.
- `/detect` — identifies a Luraph version when its header or source shape makes that possible. Other formats are reported as unsupported.
- `/get` — fetches source from a public HTTP/HTTPS URL.
- `/supported` — lists public engines and the VIP-only v15.1 engine.
- `/help` — explains the commands.

Commands are limited to channels `1560018065112965150` and `1560787704537419776` (and threads under those channels). Commands other than `/help` require this custom status: `Luraph v15.1 deobf https://discord.gg/w8ggDtsqe6`. User `1350114888940523635` and members with role `1387797482607739010` bypass that check.

## Windows setup

1. Install Python 3.10 or newer.
2. Run `setup.bat` once.
3. Put your Discord bot token in `.env` after `DISCORD_TOKEN=`.
4. Enable Presence Intent and Server Members Intent in the Discord Developer Portal.
5. Run `start.bat`.

## Linux host setup

Upload this ZIP and extract it at the host's main server folder. In the host startup settings, set the Python/app file to `host_start.py` and the requirements file to `requirements.txt`. Set `DISCORD_TOKEN` in the host's environment variables. Enable Presence Intent and Server Members Intent.

`host_start.py` tries to build Linux Luau executables if missing. This requires `git`, CMake, `g++`, Python, and GitHub network access. The bot needs `bin/luau` and `bin/luau-ast` on Linux; Windows `.exe` files cannot run there. If the host cannot build them, the provider must supply those Linux tools. Startup logs report clearly if they are missing.

## Limits

- Input limit: 25 MiB by default. Set `MAX_SOURCE_MB` in the host environment to a value from 1 to 100 if you need a different limit; the hoster's own upload cap still applies.
- Engine time limit: 14 minutes. Larger jobs need more CPU/RAM, and a host that kills long-running processes may stop them sooner.
- The engine may use up to 48 trace runs and 2,000 devirtualization rounds, stopping early when it reaches a fixed point.
- Runtime errors such as `script error` are reported with a **Deobfuscation Failed.** embed instead of being presented as successful output.
- Luraph v14 engines are selected with the version buttons. v15 uses the included v15 engine; v15.1 is VIP-only through `/vipdeob`.
- A loader URL may need authentication or game/runtime state; plain HTTP fetching cannot supply that context.

Only use this bot on code you are authorized to inspect. Keep `.env` and your bot token private.


```

#### requirements.txt

```text
discord.py>=2.4,<3
python-dotenv>=1.0,<2

```

#### bin/cli.py

```text
#!/usr/bin/env python3
from __future__ import annotations

import argparse
import importlib
import os
import re
import shutil
import sys
import tempfile
from pathlib import Path

VERSION_RE = re.compile(
    r"This file was protected using Luraph Obfuscator v(14\.(?:7|8|9))\b",
    re.I,
)

ENGINE_MODULES = {
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
        if (root / "obfuscators").is_dir() and (root / "harness.py").is_file():
            return root
    return here


ROOT = find_project_root()
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
                f"[!] {module_name} was not found. Put luraph_v14_7, luraph_v14_8 and "
                f"luraph_v14_9 inside {ROOT / 'obfuscators'}"
            ) from exc
        raise

    wanted = {"14.7": "LuraphV147", "14.8": "LuraphV148", "14.9": "LuraphV149"}[version]
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
        return f"-- Devirtualized with Luraph v{self.args.engine_resolved} engine\n\n"


def parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="cli.py",
        description="Luraph v14.7 / v14.8 / v14.9 deobfuscator frontend",
    )
    p.add_argument("input", help="protected .lua/.luau file")
    p.add_argument("-o", "--output", help="output file (default: deobfuscated.lua beside input)")
    p.add_argument(
        "--engine",
        choices=("auto", "14.7", "14.8", "14.9", "v14.7", "v14.8", "v14.9"),
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
            eprint("[!] could not determine whether this is Luraph v14.7 or v14.8")
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

        print(str(output))
        eprint(f"[+] wrote: {output}")
        return 0
    finally:
        if cleanup:
            shutil.rmtree(workdir, ignore_errors=True)


if __name__ == "__main__":
    raise SystemExit(main())

```

#### bin/readme.txt

```text
Put luau.exe and luau-ast.exe here
```

## Luraph-v14.3-deobfuscator-main.zip

- Size: 340,971 bytes
- SHA-256: `9ceeef07b31004456f9c99965a05d04b202c7b43fc5d0ae3f0e20fb239debf66`

- Files: 28

### File listing

- `Luraph-v14.3-deobfuscator-main/LICENSE` (11,345 bytes)
- `Luraph-v14.3-deobfuscator-main/Luraph ASCII-art.txt` (2,741 bytes)
- `Luraph-v14.3-deobfuscator-main/README.md` (74 bytes)
- `Luraph-v14.3-deobfuscator-main/batch_structure.py` (4,971 bytes)
- `Luraph-v14.3-deobfuscator-main/cfg_builder.py` (3,990 bytes)
- `Luraph-v14.3-deobfuscator-main/condition_table.py` (2,520 bytes)
- `Luraph-v14.3-deobfuscator-main/const_parser.py` (1,604 bytes)
- `Luraph-v14.3-deobfuscator-main/const_parser_v2.py` (2,304 bytes)
- `Luraph-v14.3-deobfuscator-main/const_parser_v3.py` (3,462 bytes)
- `Luraph-v14.3-deobfuscator-main/const_parser_v4.py` (3,386 bytes)
- `Luraph-v14.3-deobfuscator-main/expr_table.py` (4,899 bytes)
- `Luraph-v14.3-deobfuscator-main/extract_all_opcodes.py` (2,134 bytes)
- `Luraph-v14.3-deobfuscator-main/extract_dispatch.py` (3,347 bytes)
- `Luraph-v14.3-deobfuscator-main/extract_vm_handlers.py` (3,861 bytes)
- `Luraph-v14.3-deobfuscator-main/extract_vm_opcodes.py` (2,488 bytes)
- `Luraph-v14.3-deobfuscator-main/find_bias.py` (3,973 bytes)
- `Luraph-v14.3-deobfuscator-main/full_dispatch_walker.py` (5,884 bytes)
- `Luraph-v14.3-deobfuscator-main/gap_analysis.py` (2,081 bytes)
- `Luraph-v14.3-deobfuscator-main/instr_analysis.py` (1,525 bytes)
- `Luraph-v14.3-deobfuscator-main/lua_lexer.py` (1,852 bytes)
- `Luraph-v14.3-deobfuscator-main/luraph_decoder.py` (3,001 bytes)
- `Luraph-v14.3-deobfuscator-main/lzma_decoder.py` (5,889 bytes)
- `Luraph-v14.3-deobfuscator-main/proto_deserializer.py` (7,990 bytes)
- `Luraph-v14.3-deobfuscator-main/structure_cfg.py` (16,631 bytes)
- `Luraph-v14.3-deobfuscator-main/sunjingwoo.lua` (514,503 bytes)
- `Luraph-v14.3-deobfuscator-main/translate_proto.py` (2,262 bytes)
- `Luraph-v14.3-deobfuscator-main/vm_opcode_table.py` (3,008 bytes)
- `Luraph-v14.3-deobfuscator-main/vm_structure_notes.py` (2,337 bytes)

### Selected text files

#### Luraph-v14.3-deobfuscator-main/README.md

```text
# Luraph-v14.3-deobfuscator
Lol
# Created by: Melodie's husband (Meloten)

```

#### Luraph-v14.3-deobfuscator-main/luraph_decoder.py

```text
import re
import struct
import sys


def lua_unescape(s):
    out = bytearray()
    i = 0
    while i < len(s):
        ch = s[i]
        if ch == '\\':
            i += 1
            nxt = s[i]
            if nxt == 'x':
                out.append(int(s[i+1:i+3], 16))
                i += 3
            elif nxt.isdigit():
                j = i
                while j < len(s) and j < i + 3 and s[j].isdigit():
                    j += 1
                out.append(int(s[i:j]))
                i = j
            elif nxt == 'z':
                i += 1
                while i < len(s) and s[i] in ' \t\r\n':
                    i += 1
            elif nxt == '\\':
                out.append(0x5c)
                i += 1
            elif nxt == '"':
                out.append(0x22)
                i += 1
            elif nxt == 'n':
                out.append(0x0a)
                i += 1
            elif nxt == 't':
                out.append(0x09)
                i += 1
            elif nxt == 'r':
                out.append(0x0d)
                i += 1
            else:
                out.append(ord(nxt))
                i += 1
        else:
            out.append(ord(ch))
            i += 1
    return bytes(out)


def extract_blob(source_text):
    m = re.search(r'x\("((?:[^"\\]|\\.)*)",\s*0[xX]5\)', source_text)
    if m:
        return lua_unescape(m.group(1))

    lph_start = source_text.find('"LPH')
    if lph_start != -1:
        pos = lph_start + 1
        n = len(source_text)
        while pos < n:
            ch = source_text[pos]
            if ch == chr(92):
                pos += 2
                continue
            if ch == '"':
                candidate = source_text[lph_start + 1:pos]
                return lua_unescape(candidate)
            pos += 1

    for m in re.finditer(r'\[(=*)\[(LPH.*?)\]\1\]', source_text, re.DOTALL):
        return m.group(2).encode('latin-1', errors='ignore')

    raise ValueError("blob literal not found")


def decode_b85_chunk(chunk):
    w, l, M, p, K = chunk[0], chunk[1], chunk[2], chunk[3], chunk[4]
    val = (K - 0x21) + (p - 0x21) * 85 + (M - 0x21) * 85 ** 2 + (l - 0x21) * 85 ** 3 + (w - 0x21) * 85 ** 4
    return val & 0xFFFFFFFF


def decode_payload(blob_bytes):
    sub = blob_bytes[4:]
    sub = sub.replace(b'z', b'!' * 5)
    n = len(sub) - (len(sub) % 5)
    out = bytearray()
    for i in range(0, n, 5):
        val = decode_b85_chunk(sub[i:i + 5])
        out += struct.pack('>I', val)
    return bytes(out)


def decode_from_source(path):
    with open(path, 'r', encoding='utf-8', errors='surrogateescape') as f:
        text = f.read()
    blob = extract_blob(text)
    return decode_payload(blob)


if __name__ == '__main__':
    src_path = sys.argv[1] if len(sys.argv) > 1 else 'sample.lua'
    out_path = sys.argv[2] if len(sys.argv) > 2 else 'decoded.bin'
    data = decode_from_source(src_path)
    with open(out_path, 'wb') as f:
        f.write(data)
    print(len(data), 'bytes ->', out_path)

```

