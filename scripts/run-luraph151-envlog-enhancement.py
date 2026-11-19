#!/usr/bin/env python3
"""Load and run the reviewed, compressed Luraph 15.1 env logger patch."""
from __future__ import annotations

import base64
import gzip
import hashlib
from pathlib import Path

HERE = Path(__file__).resolve().parent
PAYLOAD = HERE / "enhance-luraph151-envlog.py.gz.b64"
EXPECTED_SHA256 = "43018adf89e304f9fb901b931e9f24a8a102d062882c2cca8e2a9d28ad38be59"

def main() -> None:
    if not PAYLOAD.is_file():
        raise SystemExit(f"[Luraph 15.1] missing enhancement payload: {PAYLOAD}")
    try:
        compressed = base64.b64decode(PAYLOAD.read_text(encoding="ascii").strip(), validate=True)
        source = gzip.decompress(compressed)
    except Exception as exc:
        raise SystemExit(f"[Luraph 15.1] invalid enhancement payload: {exc}") from exc

    digest = hashlib.sha256(source).hexdigest()
    if digest != EXPECTED_SHA256:
        raise SystemExit("[Luraph 15.1] enhancement payload checksum mismatch; refusing to patch.")

    virtual_file = HERE / "enhance-luraph151-envlog.py"
    namespace = {"__name__": "__main__", "__file__": str(virtual_file)}
    exec(compile(source, str(virtual_file), "exec"), namespace)

if __name__ == "__main__":
    main()
