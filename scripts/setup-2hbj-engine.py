#!/usr/bin/env python3
"""Prepare the imported 2HBJ decompiler tools from the repository archive."""
from pathlib import Path
import os
import shlex
import subprocess
import sys
import tempfile
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parent.parent
ARCHIVE = ROOT / "upload" / "2hbj-deobf-tools.zip"
DEST = ROOT / "2hbj-engine" / "tools"
VENDOR = ROOT / "vendor" / "python"
REQUIRED = {
    "dump.py", "stage2.js", "run.sh", "beautify.js", "handlers.js",
    "shim.lua", "instr.py", "decomp.py", "disasm.py", "emit.py",
    "gen.js", "luaparse_luau.js", "pre.js",
}

def ensure_lupa():
    VENDOR.mkdir(parents=True, exist_ok=True)
    pip_vendor = VENDOR / "_pip_bootstrap"
    if VENDOR.is_dir():
        sys.path.insert(0, str(VENDOR))

    try:
        from lupa.luajit21 import LuaRuntime  # noqa: F401
        print("2HBJ LuaJIT bridge is already available.")
        return True
    except Exception:
        print("Preparing pip and installing Lupa 2.8 for the 2HBJ LuaJIT dump stage...")

    pip_env = os.environ.copy()
    inherited_pythonpath = pip_env.get("PYTHONPATH", "")
    pip_paths = [str(pip_vendor)]
    if inherited_pythonpath:
        pip_paths.append(inherited_pythonpath)
    pip_env["PYTHONPATH"] = os.pathsep.join(pip_paths)

    def pip_works():
        check = subprocess.run(
            [sys.executable, "-m", "pip", "--version"],
            env=pip_env,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            check=False,
        )
        return check.returncode == 0

    if not pip_works():
        # Prefer Python's bundled ensurepip when the host provides it.
        bootstrap = subprocess.run(
            [sys.executable, "-m", "ensurepip", "--upgrade", "--default-pip"],
            env=pip_env,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            check=False,
        )
        if bootstrap.returncode or not pip_works():
            print("ensurepip did not provide a usable pip; bootstrapping pip into the project directory.")
            pip_vendor.mkdir(parents=True, exist_ok=True)
            with tempfile.TemporaryDirectory(prefix="daily-deobf-get-pip-") as temp_dir:
                get_pip = Path(temp_dir) / "get-pip.py"
                request = urllib.request.Request(
                    "https://bootstrap.pypa.io/get-pip.py",
                    headers={"User-Agent": "DAILY-DEOBF-2HBJ-setup/1.0"},
                )
                with urllib.request.urlopen(request, timeout=45) as response:
                    if response.status != 200:
                        raise RuntimeError("Could not download pip bootstrap: HTTP " + str(response.status))
                    payload = response.read(10 * 1024 * 1024 + 1)
                if not payload or len(payload) > 10 * 1024 * 1024:
                    raise RuntimeError("Pip bootstrap download is empty or exceeds 10 MB.")
                get_pip.write_bytes(payload)
                bootstrap = subprocess.run(
                    [
                        sys.executable, str(get_pip),
                        "--disable-pip-version-check",
                        "--no-warn-script-location",
                        "--target", str(pip_vendor),
                    ],
                    env=pip_env,
                    text=True,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    check=False,
                )
            if bootstrap.returncode:
                raise RuntimeError(
                    "Could not bootstrap pip for Python " + sys.version.split()[0] + ". Output:\n"
                    + bootstrap.stdout[-4000:]
                )
        if not pip_works():
            raise RuntimeError(
                "Pip bootstrap completed but Python still cannot import pip. "
                "Bootstrap output:\n" + bootstrap.stdout[-3000:]
            )

    result = subprocess.run(
        [
            sys.executable, "-m", "pip", "install",
            "--disable-pip-version-check", "--no-input",
            "--only-binary=:all:", "--upgrade", "--target", str(VENDOR),
            "lupa==2.8",
        ],
        env=pip_env,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        check=False,
    )
    if result.returncode:
        raise RuntimeError(
            "Could not install a prebuilt Lupa 2.8 wheel for Python "
            + sys.version.split()[0] + ". pip output:\n" + result.stdout[-5000:]
        )

    sys.path.insert(0, str(VENDOR))
    try:
        from lupa.luajit21 import LuaRuntime  # noqa: F401
    except Exception as error:
        raise RuntimeError(
            "Lupa 2.8 was installed but lupa.luajit21 could not load: " + str(error)
            + "\n" + result.stdout[-3000:]
        ) from error
    print("Installed and verified Lupa 2.8 in the project-local vendor/python directory.")
    return True

def install_python_wrappers():
    # Make both command names load packages from the project-local vendor directory.
    interpreter = shlex.quote(sys.executable)
    vendor = shlex.quote(str(VENDOR.resolve()))
    wrapper = (
        "#!/bin/sh\n"
        + "PYTHONPATH=" + vendor + '${PYTHONPATH:+":$PYTHONPATH"}\n'
        + "export PYTHONPATH\n"
        + "exec " + interpreter + ' "$@"\n'
    )
    for command in ("python", "python3"):
        target = DEST / command
        target.write_text(wrapper, encoding="utf-8")
        target.chmod(0o755)
    print("Installed local python/python3 launchers with the Lupa vendor path.")

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
    install_python_wrappers()
    print("Prepared 2HBJ tools, verified LuaJIT and installed Python launchers.")
    return 0

if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print("2HBJ setup failed: " + str(error), file=sys.stderr)
        raise SystemExit(1)
