#!/usr/bin/env python3
"""Extract only the IronBrew 2 runtime files from the uploaded archive."""
from pathlib import Path
import platform
import sys
import zipfile

ROOT = Path(__file__).resolve().parent.parent
ARCHIVE = ROOT / "upload" / "ib2-deobf.zip"
DEST = ROOT / "ib2deobf"

REQUIRED = {
    "KeraLua.dll",
    "Loretta.CodeAnalysis.dll",
    "Loretta.CodeAnalysis.Lua.dll",
    "Loretta.CodeAnalysis.Lua.Experimental.dll",
    "LuaAnalysis.Common.dll",
    "LuaAnalysis.Ironbrew2.deps.json",
    "LuaAnalysis.Ironbrew2.dll",
    "LuaAnalysis.Ironbrew2.runtimeconfig.json",
    "NLua.dll",
    "Tsu.dll",
}

def runtime_folder():
    system = platform.system().lower()
    machine = platform.machine().lower()
    if system == "linux":
        return "linux-arm64" if machine in ("aarch64", "arm64") else "linux-x64"
    if system == "windows":
        return "win-arm64" if machine in ("aarch64", "arm64") else "win-x64"
    raise RuntimeError("The bundled IronBrew 2 native runtime supports Linux and Windows only.")

def main():
    if not ARCHIVE.is_file():
        print("IronBrew 2 archive not present; its engine option will report unavailable.")
        return 0

    native = runtime_folder() + "/native/"
    prefix = "ib2bot-main/ib2deobf/"
    DEST.mkdir(parents=True, exist_ok=True)
    extracted = set()

    with zipfile.ZipFile(ARCHIVE) as archive:
        for info in archive.infolist():
            if info.is_dir() or not info.filename.startswith(prefix):
                continue
            relative = info.filename[len(prefix):]
            allowed = relative in REQUIRED or relative.startswith(native)
            if not allowed:
                continue
            if info.file_size > 2 * 1024 * 1024:
                raise RuntimeError("Refusing unexpectedly large IronBrew runtime file: " + relative)
            target = DEST / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            with archive.open(info) as source, target.open("wb") as output:
                remaining = info.file_size
                while remaining:
                    chunk = source.read(min(65536, remaining))
                    if not chunk:
                        raise RuntimeError("Unexpected end of archive member: " + relative)
                    output.write(chunk)
                    remaining -= len(chunk)
            extracted.add(relative)

    missing = sorted(REQUIRED - extracted)
    native_path = DEST / native / "liblua54.so" if platform.system().lower() == "linux" else DEST / native / "lua54.dll"
    if missing or not native_path.is_file():
        raise RuntimeError(
            "IronBrew 2 archive is incomplete. Missing: " +
            (", ".join(missing) if missing else str(native_path.relative_to(DEST)))
        )

    print("Prepared IronBrew 2 runtime (" + runtime_folder() + ").")
    return 0

if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print("IronBrew 2 setup warning: " + str(error), file=sys.stderr)
        raise SystemExit(1)
