#!/usr/bin/env python3
"""Safely extract the bundled IronVeil TypeScript source needed for the CLI build."""
from pathlib import Path, PurePosixPath
import stat
import zipfile

ROOT = Path(__file__).resolve().parent.parent
ARCHIVE = ROOT / "upload" / "ironveil-main 2.zip"
DEST = ROOT / "ironveil-engine"
MAX_FILE = 200_000
MAX_TOTAL = 600_000
ALLOWED_ROOT_FILES = {"tsconfig.json"}
ALLOWED_SOURCE_FILES = {
    "cli.ts", "compiler.ts", "index.ts", "obfuscator.ts", "pack.ts",
    "profile.ts", "runtime.ts", "shared.ts", "transforms.ts", "types.ts",
    "util.ts", "vmify.ts",
}

if not ARCHIVE.is_file():
    raise SystemExit(f"IronVeil archive is missing: {ARCHIVE}")

DEST.mkdir(parents=True, exist_ok=True)
total = 0
written = 0
with zipfile.ZipFile(ARCHIVE) as archive:
    bad = archive.testzip()
    if bad:
        raise SystemExit(f"IronVeil archive failed CRC validation: {bad}")
    for info in archive.infolist():
        member = PurePosixPath(info.filename)
        if info.is_dir():
            continue
        if member.is_absolute() or ".." in member.parts:
            raise SystemExit(f"Unsafe path in IronVeil archive: {info.filename}")
        if stat.S_ISLNK(info.external_attr >> 16):
            raise SystemExit(f"Symlinks are not allowed in IronVeil archive: {info.filename}")
        if len(member.parts) == 2 and member.parts[0] == "ironveil-main" and member.parts[1] in ALLOWED_ROOT_FILES:
            relative = Path(member.parts[1])
        elif len(member.parts) == 3 and member.parts[0] == "ironveil-main" and member.parts[1] == "src" and member.parts[2] in ALLOWED_SOURCE_FILES:
            relative = Path("src") / member.parts[2]
        else:
            continue
        if info.file_size > MAX_FILE:
            raise SystemExit(f"IronVeil source file exceeds extraction limit: {info.filename}")
        total += info.file_size
        if total > MAX_TOTAL:
            raise SystemExit("IronVeil source exceeds the total extraction limit.")
        data = archive.read(info)
        if len(data) != info.file_size:
            raise SystemExit(f"IronVeil source size mismatch: {info.filename}")
        target = DEST / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
        written += 1

required = [DEST / "tsconfig.json"] + [DEST / "src" / name for name in sorted(ALLOWED_SOURCE_FILES)]
missing = [str(path.relative_to(ROOT)) for path in required if not path.is_file()]
if missing:
    raise SystemExit("IronVeil archive is missing required source files: " + ", ".join(missing))
print(f"Extracted {written} bounded IronVeil source/config files ({total} bytes).")
