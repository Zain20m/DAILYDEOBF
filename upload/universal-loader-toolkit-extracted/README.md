# Universal Loader Toolkit

Maximum working fetch pack for:

| Provider | What you get | Needs |
|----------|--------------|--------|
| **Vantarmor** | Server-delivered **source** | `script_key` |
| **LuaProtect** | **Obfuscated** Voltfuscator package (stub + runner) | CDN URL only |
| **JNKIE** | Stage-1 loader; full payload if delivery allows | `SCRIPT_KEY` (+ HWID sometimes) |

## One command

```bash
python3 fetch.py --paste-file paste.txt -o out
```

Auto-detects provider from the URL.

## Examples

### Vantarmor
```lua
script_key = "YOUR_KEY"
loadstring(game:HttpGet("https://vantarmor.up.railway.app/files/v1/loaders/HASH.lua"))()
```

### LuaProtect
```lua
loadstring(game:HttpGet("https://cdn.luaprotect.dev/u/USER/ID"))()
```

### JNKIE
```lua
getgenv().SCRIPT_KEY = "uuid-key"
loadstring(game:HttpGet("https://api.jnkie.com/api/v1/luascripts/public/HASH/download"))()
```

## Critical: User-Agent

For LuaProtect + JNKIE always use **`Roblox/WinInet`**.

Chrome / browser UA → 403 or HTML trap pages.

This toolkit always sends `Roblox/WinInet`.

## Discord bot fix

See `discord_bot_fixes/`:

1. Force Roblox UA for `*.luaprotect.dev`, `api.jnkie.com`, `cdn.jnkie.com`, Vantarmor hosts
2. Paste `FIX_REQUEST_PINNED_ADDRESS.js` into `requestPinnedAddress`
3. Restart the bot process

## Safety

**Some scripts are unsafe** (stealers, lag, account harm).  
Always read the full recovered/obfuscated output before running in any game or executor.  
This toolkit only downloads what the public APIs return; it does not certify safety.

## Limits (honest)

- Vantarmor: best cleartext fetch when key is valid
- LuaProtect: returns **obfuscated** runner (Voltfuscator) — needs a second deob engine
- JNKIE: delivery may return `LDR-DENIED:HWID_REQUIRED` outside Roblox
- No tool here bypasses Cloudflare interactive JS challenges on unrelated sites

## AI helper

Give an AI `AI_INSTRUCTIONS.md` + the user paste. It should run the same HTTP steps (or this script).
