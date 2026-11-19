#!/usr/bin/env python3
"""Install the bundled Luraph 15.1 engine archive before the bot starts."""
from __future__ import annotations

import hashlib
import os
from pathlib import Path, PurePosixPath
import shutil
import tempfile
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parent.parent
ARCHIVE = ROOT / "upload" / "Luraph_v15.1_Deobfuscator.zip"
DESTINATION = ROOT / "luraph-v15.1-engine"
MARKER = ".dailydeobf-archive.sha256"
REQUIRED = (
    "deob.js",
    "package.json",
    "protocol.json",
    "src/driver.js",
    "src/harness.js",
    "core/obfuscators/luraph_v15/devirt.py",
    "core/obfuscators/luraph_v15/driver.py",
    "runtime/envlog.luau",
    "runtime/roblox_api.luau",
    "bin/luau",
    "bin/luau-ast",
)

def fail(message: str) -> None:
    raise SystemExit("[Luraph 15.1] " + message)

def main() -> None:
    if not ARCHIVE.is_file():
        fail(f"uploaded archive is missing: {ARCHIVE.relative_to(ROOT)}")

    archive_hash = hashlib.sha256(ARCHIVE.read_bytes()).hexdigest()
    marker_path = DESTINATION / MARKER
    if marker_path.is_file() and marker_path.read_text(encoding="ascii").strip() == archive_hash:
        print("[Luraph 15.1] uploaded engine archive is already installed.")
        return

    stage = ROOT / ".luraph-v15.1-engine-staging"
    backup = ROOT / ".luraph-v15.1-engine-backup"
    shutil.rmtree(stage, ignore_errors=True)
    shutil.rmtree(backup, ignore_errors=True)
    stage.mkdir(parents=True, exist_ok=True)

    try:
        with ZipFile(ARCHIVE) as archive:
            bad = archive.testzip()
            if bad:
                fail(f"ZIP integrity check failed at {bad}")
            entries = [entry for entry in archive.infolist() if not entry.is_dir()]
            if len(entries) > 5000:
                fail(f"archive contains too many files ({len(entries)})")
            total_size = sum(entry.file_size for entry in entries)
            if total_size > 256 * 1024 * 1024:
                fail(f"archive expands to an unsafe size ({total_size} bytes)")

            for entry in entries:
                normalized = entry.filename.replace("\\", "/")
                relative = PurePosixPath(normalized)
                if relative.is_absolute() or ".." in relative.parts:
                    fail(f"unsafe ZIP path: {entry.filename}")
                target = stage.joinpath(*relative.parts)
                target.parent.mkdir(parents=True, exist_ok=True)
                with archive.open(entry) as source, target.open("wb") as output:
                    shutil.copyfileobj(source, output)

        engine_root = None
        for deob in stage.rglob("deob.js"):
            candidate = deob.parent
            if all((candidate / item).is_file() for item in REQUIRED):
                engine_root = candidate
                break
        if engine_root is None:
            fail("ZIP does not contain a complete Luraph 15.1 engine.")

        prepared = ROOT / ".luraph-v15.1-engine-prepared"
        shutil.rmtree(prepared, ignore_errors=True)
        shutil.copytree(
            engine_root,
            prepared,
            ignore=shutil.ignore_patterns("__pycache__", "*.pyc", "*.pyo", "*.exe", ".DS_Store"),
        )
        for binary in (prepared / "bin" / "luau", prepared / "bin" / "luau-ast"):
            binary.chmod(binary.stat().st_mode | 0o111)
        (prepared / MARKER).write_text(archive_hash + "\n", encoding="ascii")

        if DESTINATION.exists():
            os.replace(DESTINATION, backup)
        os.replace(prepared, DESTINATION)
        shutil.rmtree(backup, ignore_errors=True)
        print(f"[Luraph 15.1] installed replacement engine from {ARCHIVE.relative_to(ROOT)}.")
    except Exception:
        if backup.exists() and not DESTINATION.exists():
            os.replace(backup, DESTINATION)
        raise
    finally:
        shutil.rmtree(stage, ignore_errors=True)
        shutil.rmtree(ROOT / ".luraph-v15.1-engine-prepared", ignore_errors=True)
        shutil.rmtree(backup, ignore_errors=True)

if __name__ == "__main__":
    main()
