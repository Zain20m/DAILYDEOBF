#!/usr/bin/env python3
"""Extract the IronVeil project and install the local parser compatibility layer."""
from pathlib import Path, PurePosixPath
import shutil
import stat
import zipfile

ROOT = Path(__file__).resolve().parent.parent
ARCHIVE = ROOT / "upload" / "ironveil-main 2.zip"
DEST = ROOT / "ironveil-engine"
SUPPORT = ROOT / "scripts" / "ironveil-support"
ALLOWED_ROOT = {"tsconfig.json"}
ALLOWED_SRC = {
    "cli.ts", "compiler.ts", "index.ts", "obfuscator.ts", "pack.ts",
    "profile.ts", "runtime.ts", "shared.ts", "transforms.ts", "types.ts",
    "util.ts", "vmify.ts",
}
PATCHED_SRC = {"ast.ts", "lexer.ts", "parser.ts", "scope.ts", "shared.ts"}
MAX_FILE = 200_000
MAX_TOTAL = 600_000

if not ARCHIVE.is_file():
    raise SystemExit("IronVeil archive is missing: " + str(ARCHIVE))

DEST.mkdir(parents=True, exist_ok=True)
total = 0
written = 0

with zipfile.ZipFile(ARCHIVE) as archive:
    bad = archive.testzip()
    if bad:
        raise SystemExit("IronVeil archive failed CRC validation: " + bad)

    for info in archive.infolist():
        member = PurePosixPath(info.filename)
        if info.is_dir():
            continue
        if member.is_absolute() or ".." in member.parts:
            raise SystemExit("Unsafe path in IronVeil archive: " + info.filename)
        if stat.S_ISLNK(info.external_attr >> 16):
            raise SystemExit("Symlinks are not allowed in the IronVeil archive: " + info.filename)

        if len(member.parts) == 2 and member.parts[0] == "ironveil-main" and member.parts[1] in ALLOWED_ROOT:
            relative = Path(member.parts[1])
        elif len(member.parts) == 3 and member.parts[0] == "ironveil-main" and member.parts[1] == "src" and member.parts[2] in ALLOWED_SRC:
            relative = Path("src") / member.parts[2]
        else:
            continue

        if info.file_size > MAX_FILE:
            raise SystemExit("IronVeil source file exceeds extraction limit: " + info.filename)
        total += info.file_size
        if total > MAX_TOTAL:
            raise SystemExit("IronVeil source exceeds the total extraction limit.")
        data = archive.read(info)
        if len(data) != info.file_size:
            raise SystemExit("IronVeil source size mismatch: " + info.filename)
        target = DEST / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
        written += 1

required = [DEST / "tsconfig.json"] + [DEST / "src" / name for name in sorted(ALLOWED_SRC)]
missing = [str(path.relative_to(ROOT)) for path in required if not path.is_file()]
if missing:
    raise SystemExit("IronVeil archive is missing required source files: " + ", ".join(missing))

for name in PATCHED_SRC:
    source = SUPPORT / name
    if not source.is_file():
        raise SystemExit("IronVeil parser support file is missing: " + str(source))
    shutil.copy2(source, DEST / "src" / name)

print("Extracted " + str(written) + " IronVeil project files and installed parser/scope compatibility modules.")
