# AI Instructions — Universal Loader Toolkit

Detect provider from paste URL, then:

## Vantarmor
1. Extract script_key and /files/v1/loaders/HASH.lua
2. GET {base}/v1/a?s=HASH&key=KEY&hwid=x&rbxid=1  (UA Roblox/WinInet)
3. If TOKEN → POST {base}/v1/p body=token
4. Expect !VANTARMOR:CODE\n + source
5. Return full source; warn user to review before execute

## LuaProtect
1. GET cdn.luaprotect.dev/u/USER/ID with UA Roblox/WinInet (Chrome = 403)
2. Parse _h,_n from stub
3. GET {HOST}/api/runner-body/{_h}
4. Return combined OBFUSCATED package — not cleartext
5. Tell user next step is Voltfuscator deob

## JNKIE
1. GET public/.../download with Roblox UA
2. POST delivery/HASH body=SCRIPT_KEY
3. If CDN URL, GET it; if LDR-DENIED, report code
4. Do not invent payload

Always: safety warning before any in-game run.
