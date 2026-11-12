#!/usr/bin/env python3
"""
Universal Loader Toolkit
------------------------
One command for Vantarmor / LuaProtect / JNKIE public fetch flows.

  python3 fetch.py --paste-file paste.txt -o out
  python3 fetch.py --paste 'loadstring(game:HttpGet("URL"))()' -o out

Providers:
  vantarmor  - key + loader -> server-delivered source (best case)
  luaprotect - CDN stub + runner-body -> Voltfuscator OBF package
  jnkie      - stage-1 loader; delivery may need HWID/executor

Safety: Review every recovered file before running in any game/executor.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROBLOX_UA = "Roblox/WinInet"
BROWSER_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
)


def http(method: str, url: str, data: bytes | None = None, headers: dict | None = None,
         timeout: float = 60.0, ua: str = ROBLOX_UA):
    hdrs = {"User-Agent": ua, "Accept": "*/*"}
    if headers:
        hdrs.update(headers)
    req = urllib.request.Request(url, data=data, method=method, headers=hdrs)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.status, dict(resp.headers.items()), resp.read(), resp.geturl()
    except urllib.error.HTTPError as e:
        body = e.read() if e.fp else b""
        return e.code, dict(e.headers.items() if e.headers else {}), body, url


def detect(paste: str) -> str:
    p = paste.lower()
    if "vantarmor" in p or "/files/v1/loaders/" in p:
        return "vantarmor"
    if "luaprotect" in p or "cdn.luaprotect.dev" in p:
        return "luaprotect"
    if "jnkie" in p or "api.jnkie.com" in p:
        return "jnkie"
    # generic loader patterns
    if re.search(r"https?://[^\s\"']+/files/v1/loaders/[a-f0-9]+\.lua", paste, re.I):
        return "vantarmor"
    raise SystemExit(
        "Could not detect provider. Supported: Vantarmor, LuaProtect, JNKIE.\n"
        "Paste the full loadstring line (and script_key / SCRIPT_KEY if any)."
    )


# ----- Vantarmor -----
def fetch_vantarmor(paste: str, out: Path) -> int:
    m = re.search(
        r"https?://[^\s\"']+/files/v1/loaders/([a-fA-F0-9]{32,64})\.lua",
        paste, re.I,
    )
    if not m:
        print("error: no Vantarmor loader URL", file=sys.stderr)
        return 2
    full = m.group(0)
    h = m.group(1).lower()
    base = full[: full.lower().find("/files/v1/loaders/")]
    km = re.search(r"""script_key\s*=\s*["']([^"']+)["']""", paste, re.I)
    if not km:
        print("error: missing script_key = \"...\"", file=sys.stderr)
        return 2
    key = km.group(1).strip()
    q = urllib.parse.urlencode(
        {"s": h, "key": key, "hwid": "toolkit-hwid-0001", "rbxid": "1"}
    )
    auth_url = f"{base}/v1/a?{q}"
    print("[vantarmor] GET", auth_url.split("?")[0], "...")
    st, _, body, _ = http("GET", auth_url)
    text = body.decode("utf-8", "replace").replace("\r\n", "\n")
    if re.fullmatch(r"!VANTARMOR:([A-Z0-9_]+)\n?", text.strip()):
        print("error: auth", text.strip(), file=sys.stderr)
        return 1
    if text.startswith("!VANTARMOR:TOKEN\n"):
        token = text[len("!VANTARMOR:TOKEN\n"):].strip()
        print("[vantarmor] POST /v1/p")
        st, _, body, _ = http(
            "POST", f"{base}/v1/p",
            data=token.encode(),
            headers={"Content-Type": "text/plain"},
        )
        text = body.decode("utf-8", "replace").replace("\r\n", "\n")
    if re.fullmatch(r"!VANTARMOR:([A-Z0-9_]+)\n?", text.strip()):
        print("error: payload", text.strip(), file=sys.stderr)
        return 1
    if not text.startswith("!VANTARMOR:CODE\n"):
        print("error: unexpected response", text[:100], file=sys.stderr)
        return 1
    src = text[len("!VANTARMOR:CODE\n"):]
    if src.startswith("-- deob by prince"):
        src = "-- Recovered from Vantarmor\n" + src[len("-- deob by prince"):].lstrip("\n")
    path = out / "vantarmor_recovered.lua"
    path.write_text(src if src.endswith("\n") else src + "\n", encoding="utf-8")
    print(f"[vantarmor] OK -> {path} ({path.stat().st_size} bytes)  [SOURCE]")
    print("WARNING: Review before running in-game.")
    return 0


# ----- LuaProtect -----
def fetch_luaprotect(paste: str, out: Path) -> int:
    m = re.search(
        r"https?://cdn\.luaprotect\.dev/u/([A-Za-z0-9_-]+)/([A-Za-z0-9_-]+)",
        paste, re.I,
    )
    if not m:
        print("error: no LuaProtect CDN URL", file=sys.stderr)
        return 2
    cdn, user, sid = m.group(0), m.group(1), m.group(2)
    print("[luaprotect] GET stub", cdn)
    st, _, body, _ = http("GET", cdn)
    if st != 200:
        # retry message
        msg = body.decode("utf-8", "replace")
        print(f"error: stub HTTP {st}: {msg[:120]}", file=sys.stderr)
        print("hint: must use Roblox/WinInet (Chrome gets 403)", file=sys.stderr)
        return 1
    stub = body.decode("utf-8", "replace")
    (out / "stub.lua").write_text(stub, encoding="utf-8")
    cfg = {}
    for key in ("HOST_URL", "WS_URL", "SCRIPT_ID", "SCRIPT_NAME", "RUNNER_ID", "RUNNER_KEY"):
        mm = re.search(rf'{key}\s*=\s*"([^"]*)"', stub)
        if mm:
            cfg[key] = mm.group(1)
    mm = re.search(r'local _h,\s*_n\s*=\s*"([a-f0-9]+)"\s*,\s*(\d+)', stub)
    if not mm:
        print("error: no runner hash in stub", file=sys.stderr)
        return 1
    rh, rs = mm.group(1), int(mm.group(2))
    cfg["RUNNER_BODY_HASH"] = rh
    cfg["RUNNER_BODY_SIZE"] = rs
    (out / "stub_config.json").write_text(json.dumps(cfg, indent=2), encoding="utf-8")
    host = (cfg.get("HOST_URL") or "https://exec.luaprotect.dev").rstrip("/")
    rurl = f"{host}/api/runner-body/{rh}"
    print("[luaprotect] GET runner-body", rurl)
    st, _, runner, _ = http("GET", rurl, timeout=120.0)
    if st != 200:
        print(f"error: runner HTTP {st}", file=sys.stderr)
        return 1
    (out / "runner_body.lua").write_bytes(runner)
    # combined
    def j(k, d=""):
        return json.dumps(cfg.get(k, d))
    pre = "\n".join([
        "-- LuaProtect OBFUSCATED package (not cleartext source)",
        "local _LP_CONFIG = {",
        f"  HOST_URL = {j('HOST_URL', host)},",
        f"  WS_URL = {j('WS_URL', 'wss://exec.luaprotect.dev/ws')},",
        f"  SCRIPT_ID = {j('SCRIPT_ID', sid)},",
        f"  SCRIPT_NAME = {j('SCRIPT_NAME', '')},",
        f"  RUNNER_ID = {j('RUNNER_ID', '')},",
        f"  RUNNER_KEY = {j('RUNNER_KEY', '')},",
        "  NESTED_IMPORT = \"0\", DISABLE_NOTIFICATIONS = 0,",
        "  THEME_BG = \"\", THEME_ACCENT = \"\", THEME_TEXT = \"\",",
        "  RUNNER_KEY_PROMPT = \"0\", KEY_FLOW_URL = \"\", DISCORD_INVITE = \"\",",
        "  CONTINUOUS_SESSION = \"0\", CONTINUOUS_RECONNECT = \"0\",",
        "  HANDOFF_RUNNER_ID = \"\", HANDOFF_KEY = \"\", HANDOFF_RUN_ID = \"\", HANDOFF_SESSION_ID = \"\"",
        "}",
        "_LP_CONFIG = _LP_CONFIG",
        "_LP_RUNNER_CONFIG = _LP_CONFIG",
        "if typeof(getgenv) == \"function\" then pcall(function() getgenv()._LP_RUNNER_CONFIG = _LP_CONFIG end) end",
        f"-- runner /api/runner-body/{rh}",
        "",
    ])
    combined = pre.encode() + runner
    (out / "obfuscated_combined.lua").write_bytes(combined)
    print(f"[luaprotect] OK stub={len(stub)} runner={len(runner)} combined={len(combined)}")
    print("            -> obfuscated_combined.lua  [OBFUSCATED / Voltfuscator]")
    print("Next: feed combined/runner into a Voltfuscator deobfuscator.")
    return 0


# ----- JNKIE -----
def fetch_jnkie(paste: str, out: Path, hwid: str | None = None) -> int:
    m = re.search(
        r"https?://api\.jnkie\.com/api/v1/luascripts/public/([a-f0-9]{32,128})/download",
        paste, re.I,
    )
    if not m:
        print("error: no JNKIE download URL", file=sys.stderr)
        return 2
    url, h = m.group(0), m.group(1).lower()
    km = re.search(r"""(?:getgenv\(\)\.)?SCRIPT_KEY\s*=\s*["']([^"']+)["']""", paste, re.I)
    if not km:
        print("error: missing SCRIPT_KEY", file=sys.stderr)
        return 2
    key = km.group(1).strip()
    print("[jnkie] GET", url)
    st, _, body, final = http("GET", url)
    if st != 200:
        print(f"error: stage1 HTTP {st} {body[:120]!r}", file=sys.stderr)
        return 1
    stage1 = body.decode("utf-8", "replace")
    if stage1.lstrip().startswith("<!"):
        print("error: got HTML (use Roblox UA, not Chrome)", file=sys.stderr)
        return 1
    (out / "stage1_loader.lua").write_text(stage1, encoding="utf-8")
    print(f"[jnkie] stage1 {len(stage1)} bytes -> {final}")

    del_url = f"https://api.jnkie.com/api/v1/luascripts/delivery/{h}?v=2&errors=text"
    if hwid:
        del_url += "&hwid=" + urllib.parse.quote(hwid)
    hdrs = {"Content-Type": "text/plain"}
    if hwid:
        hdrs["X-HWID"] = hwid
    print("[jnkie] POST delivery")
    st, _, raw, _ = http("POST", del_url, data=key.encode(), headers=hdrs)
    text = raw.decode("utf-8", "replace")
    if st in (400, 401, 403) or text.startswith("LDR-DENIED"):
        (out / "delivery_error.txt").write_text(text, encoding="utf-8")
        print("[jnkie] delivery denied:\n" + text[:400])
        print("Saved stage1 only. HWID_REQUIRED => redeem key in a Roblox executor.")
        return 0
    stripped = text.strip()
    if stripped.startswith("https://cdn.jnkie.com/"):
        st2, _, payload, _ = http("GET", stripped)
        if st2 != 200:
            print("error: CDN GET", st2, file=sys.stderr)
            return 1
        (out / "payload.lua").write_bytes(payload)
        print(f"[jnkie] OK payload {len(payload)} bytes  [check if source or still protected]")
        return 0
    if st == 200 and raw:
        (out / "payload.lua").write_bytes(raw)
        print(f"[jnkie] OK payload {len(raw)} bytes")
        return 0
    print("error: unexpected delivery response", text[:150], file=sys.stderr)
    return 1


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="Universal loader fetch toolkit")
    ap.add_argument("--paste", default="")
    ap.add_argument("--paste-file")
    ap.add_argument("--provider", choices=["auto", "vantarmor", "luaprotect", "jnkie"], default="auto")
    ap.add_argument("--hwid", default=None)
    ap.add_argument("-o", "--outdir", default="fetch_out")
    args = ap.parse_args(argv)

    paste = args.paste
    if args.paste_file:
        paste = Path(args.paste_file).read_text(encoding="utf-8", errors="replace")
    if not paste.strip():
        print("error: empty paste", file=sys.stderr)
        return 2

    provider = args.provider if args.provider != "auto" else detect(paste)
    out = Path(args.outdir)
    out.mkdir(parents=True, exist_ok=True)
    print("provider =", provider)
    print("outdir   =", out)

    if provider == "vantarmor":
        return fetch_vantarmor(paste, out)
    if provider == "luaprotect":
        return fetch_luaprotect(paste, out)
    if provider == "jnkie":
        return fetch_jnkie(paste, out, args.hwid)
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
