#!/usr/bin/env python3
"""Prepare the imported 2HBJ decompiler tools from the repository archive."""
from pathlib import Path
import subprocess
import sys
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parent.parent
ARCHIVE = ROOT / "upload" / "2hbj-deobf-tools.zip"
DEST = ROOT / "2hbj-engine" / "tools"
REQUIRED = {
    "dump.py", "stage2.js", "run.sh", "beautify.js", "handlers.js",
    "shim.lua", "instr.py", "decomp.py", "disasm.py", "emit.py",
    "gen.js", "luaparse_luau.js", "pre.js",
}

def ensure_lupa():
    try:
        from lupa.luajit21 import LuaRuntime  # noqa: F401
        print("2HBJ LuaJIT bridge is available.")
        return True
    except Exception:
        print("Installing Lupa 2.8 for the 2HBJ LuaJIT dump stage...")
    result = subprocess.run(
        [sys.executable, "-m", "pip", "install", "--disable-pip-version-check", "--no-input", "lupa==2.8"],
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        check=False,
    )
    if result.returncode == 0:
        try:
            from lupa.luajit21 import LuaRuntime  # noqa: F401
            print("Installed Lupa 2.8.")
            return True
        except Exception as error:
            print("2HBJ warning: Lupa installed but LuaJIT import failed: " + str(error), file=sys.stderr)
    else:
        print("2HBJ warning: automatic Lupa install failed. The 2HBJ option will report the missing dependency.", file=sys.stderr)
        print(result.stdout[-2000:], file=sys.stderr)
    return False

def main():
    if not ARCHIVE.is_file() or ARCHIVE.stat().st_size == 0:
        ARCHIVE.parent.mkdir(parents=True, exist_ok=True)
        url = "https://raw.githubusercontent.com/Zain20m/DAILYDEOBF/main/upload/2hbj-deobf-tools.zip"
        print("2HBJ archive is absent from the deployment; fetching the committed repository copy...")
        request = urllib.request.Request(url, headers={"User-Agent": "DAILY-DEOBF-engine-setup/1.0"})
        with urllib.request.urlopen(request, timeout=45) as response:
            if response.status != 200:
                raise RuntimeError("Could not fetch the 2HBJ archive: HTTP " + str(response.status))
            payload = response.read(20 * 1024 * 1024 + 1)
        if not payload or len(payload) > 20 * 1024 * 1024:
            raise RuntimeError("Downloaded 2HBJ archive is empty or exceeds 20 MB.")
        ARCHIVE.write_bytes(payload)

    if not zipfile.is_zipfile(ARCHIVE):
        raise RuntimeError("2HBJ archive path exists but is not a valid ZIP: " + str(ARCHIVE))

    DEST.mkdir(parents=True, exist_ok=True)
    extracted = set()
    with zipfile.ZipFile(ARCHIVE) as archive:
        for info in archive.infolist():
            name = info.filename
            if not name.startswith("tools/") or info.is_dir():
                continue
            relative = Path(name).relative_to("tools")
            if relative.is_absolute() or ".." in relative.parts:
                raise RuntimeError("Unsafe archive path rejected: " + name)
            if "__pycache__" in relative.parts or relative.suffix in {".pyc", ".pyo"}:
                continue
            if info.file_size > 2 * 1024 * 1024:
                raise RuntimeError("Refusing unexpectedly large tool file: " + name)
            target = DEST / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            payload = archive.read(info)
            if relative.as_posix() == 'run.sh':
                payload = payload.replace(b'python3 ', b'\"${PYTHON_BIN:-python3}\" ')
            target.write_bytes(payload)
            extracted.add(relative.as_posix())

    missing = sorted(REQUIRED - extracted)
    if missing:
        raise RuntimeError("2HBJ archive is incomplete. Missing: " + ", ".join(missing))

    ensure_lupa()
    print("Prepared 2HBJ tools from upload/2hbj-deobf-tools.zip.")
    return 0

if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print("2HBJ setup failed: " + str(error), file=sys.stderr)
        raise SystemExit(1)
