# Luraph Deobfuscator Discord Bot

This build contains Luraph deobfuscation engines for **v14.6, v14.7, v14.8, v14.9, v15, and v15.1**. The v14.6 adapter shares the v14.x VM mapper/lifter and handles the v14.6 version banner explicitly.

## Commands

- `/deob` — upload a Lua/Luau file, paste source, or provide a loader URL. Choose public Luraph v14.6, v14.7, v14.8, v14.9, or v15. Results are posted publicly as `.lua` files.
- `/vipdeob` — run Luraph v15.1. Requires role `1387797482607739010`.
- `/detect` — identifies a Luraph version when its header or source shape makes that possible. Other formats are reported as unsupported.
- `/get` — fetches source from a public HTTP/HTTPS URL.
- `/supported` — lists public engines and the VIP-only v15.1 engine.
- `/help` — explains the commands.

Commands are limited to channels `1560018065112965150` and `1560787704537419776` (and threads under those channels). Commands other than `/help` require this custom status: `Luraph v15.1 deobf https://discord.gg/w8ggDtsqe6`. User `1350114888940523635` and members with role `1387797482607739010` bypass that check.

## Windows setup

1. Install Python 3.10 or newer.
2. Run `setup.bat` once.
3. Put your Discord bot token in `.env` after `DISCORD_TOKEN=`.
4. Enable Presence Intent and Server Members Intent in the Discord Developer Portal.
5. Run `start.bat`.

## Linux host setup

Upload this ZIP and extract it at the host's main server folder. In the host startup settings, set the Python/app file to `host_start.py` and the requirements file to `requirements.txt`. Set `DISCORD_TOKEN` in the host's environment variables. Enable Presence Intent and Server Members Intent.

`host_start.py` tries to build Linux Luau executables if missing. This requires `git`, CMake, `g++`, Python, and GitHub network access. The bot needs `bin/luau` and `bin/luau-ast` on Linux; Windows `.exe` files cannot run there. If the host cannot build them, the provider must supply those Linux tools. Startup logs report clearly if they are missing.

## Limits

- Input limit: 25 MiB by default. Set `MAX_SOURCE_MB` in the host environment to a value from 1 to 100 if you need a different limit; the hoster's own upload cap still applies.
- Engine time limit: 14 minutes. Larger jobs need more CPU/RAM, and a host that kills long-running processes may stop them sooner.
- The engine may use up to 48 trace runs and 2,000 devirtualization rounds, stopping early when it reaches a fixed point.
- Runtime errors such as `script error` are reported with a **Deobfuscation Failed.** embed instead of being presented as successful output.
- Luraph v14 engines are selected with the version buttons. v15 uses the included v15 engine; v15.1 is VIP-only through `/vipdeob`.
- A loader URL may need authentication or game/runtime state; plain HTTP fetching cannot supply that context.

Only use this bot on code you are authorized to inspect. Keep `.env` and your bot token private.

