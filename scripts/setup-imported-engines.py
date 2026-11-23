#!/usr/bin/env python3
"""Install the curated legacy-engine bundle and the supplied Luraph 15.2 replacement."""
from __future__ import annotations
import hashlib
import os
from pathlib import Path
import shutil
import zipfile

ROOT = Path(__file__).resolve().parent.parent
UPLOAD = ROOT / "upload"
IMPORT_ZIP = UPLOAD / "DAILYDEOBF_Engine_Import.zip"
LURAPH_ZIP = UPLOAD / "deobf-luraph-15.2.zip"

def digest(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()

def safe_members(zf: zipfile.ZipFile, prefixes: tuple[str, ...]):
    for info in zf.infolist():
        name = info.filename.replace("\\", "/")
        if not name or name.startswith("/") or any(part == ".." for part in name.split("/")):
            continue
        if prefixes and not name.startswith(prefixes):
            continue
        yield info

def extract_selected(archive: Path, destination: Path, prefixes: tuple[str, ...]):
    with zipfile.ZipFile(archive) as zf:
        for info in safe_members(zf, prefixes):
            name = info.filename.replace("\\", "/")
            target = (destination / name).resolve()
            if ROOT.resolve() not in target.parents and target != ROOT.resolve():
                raise RuntimeError("Blocked archive path outside repository: " + name)
            if info.is_dir():
                target.mkdir(parents=True, exist_ok=True)
                continue
            target.parent.mkdir(parents=True, exist_ok=True)
            with zf.open(info) as src, target.open("wb") as dst:
                shutil.copyfileobj(src, dst)

def install_legacy_bundle():
    if not IMPORT_ZIP.is_file():
        raise RuntimeError("Missing " + str(IMPORT_ZIP))
    marker = ROOT / "deobfuscators" / ".dailydeobf-import-sha256"
    wanted = digest(IMPORT_ZIP)
    if marker.is_file() and marker.read_text().strip() == wanted:
        print("[engine-import] curated engines already installed")
        return
    with zipfile.ZipFile(IMPORT_ZIP) as zf:
        extract_selected(IMPORT_ZIP, ROOT, ("deobfuscators/", "luast-engine/"))
    marker.parent.mkdir(parents=True, exist_ok=True)
    marker.write_text(wanted + "\n")
    print("[engine-import] installed unique legacy engines and LUAST")

def install_luraph_152():
    if not LURAPH_ZIP.is_file():
        raise RuntimeError("Missing " + str(LURAPH_ZIP))
    target = ROOT / "luraph-v15.2-engine"
    marker = target / ".dailydeobf-source-sha256"
    wanted = digest(LURAPH_ZIP)
    if marker.is_file() and marker.read_text().strip() == wanted:
        print("[engine-import] Luraph 15.2 replacement already installed")
        return
    temp = ROOT / ".luraph-152-import-tmp"
    shutil.rmtree(temp, ignore_errors=True)
    temp.mkdir(parents=True, exist_ok=True)
    try:
        # Archives may contain a wrapper folder (for example,
        # deobf-luraph-15.2/deob/...) instead of placing "deob/" at ZIP root.
        # Extract safe members first, then locate the actual Node project by
        # its entry-point pair rather than assuming one exact archive layout.
        with zipfile.ZipFile(LURAPH_ZIP) as zf:
            extract_selected(LURAPH_ZIP, temp, ())
        candidates = [
            entry.parent
            for entry in temp.rglob("deob.js")
            if (entry.parent / "src" / "driver.js").is_file()
        ]
        if not candidates:
            discovered = [
                str(path.relative_to(temp))
                for path in temp.rglob("*.js")
            ][:20]
            detail = ", ".join(discovered) if discovered else "no JavaScript files found"
            raise RuntimeError(
                "Uploaded Luraph 15.2 archive does not contain a folder with "
                "both deob.js and src/driver.js. Discovered: " + detail
            )
        source = min(candidates, key=lambda path: len(path.parts))
        shutil.rmtree(target, ignore_errors=True)
        shutil.copytree(source, target)
        (target / ".dailydeobf-source-sha256").write_text(wanted + "\n")
    finally:
        shutil.rmtree(temp, ignore_errors=True)
    print("[engine-import] replaced Luraph 15.2 engine from uploaded archive")

def main():
    install_legacy_bundle()
    install_luraph_152()
    required = [
        ROOT / "deobfuscators" / "clyde_static_deob.js",
        ROOT / "deobfuscators" / "hercules_deob.js",
        ROOT / "deobfuscators" / "77fuscator_deob.js",
        ROOT / "deobfuscators" / "77fuscatorDeobf" / "deobfuscator.dll",
        ROOT / "deobfuscators" / "goofyscator_deob.js",
        ROOT / "deobfuscators" / "goofyscator" / "decompiler.py",
        ROOT / "deobfuscators" / "moonsec_deob.js",
        ROOT / "deobfuscators" / "MoonsecDeobf" / "bin" / "Release" / "net8.0" / "MoonsecDeobfuscator.dll",
        ROOT / "deobfuscators" / "moonveil_deob.js",
        ROOT / "deobfuscators" / "psu_deob.js",
        ROOT / "deobfuscators" / "PSU-Deobfuscator" / "src" / "deobfuscator.js",
        ROOT / "deobfuscators" / "LuaObf-Deobf" / "deobf.js",
        ROOT / "deobfuscators" / "ProstoneDeobf" / "bin" / "pdeobf.js",
        ROOT / "luast-engine" / "deobfuscate.py",
        ROOT / "luraph-v15.2-engine" / "deob.js",
    ]
    missing = [str(p.relative_to(ROOT)) for p in required if not p.is_file()]
    if missing:
        raise RuntimeError("Engine import incomplete: " + ", ".join(missing))
    print("[engine-import] source validation passed")

if __name__ == "__main__":
    main()
