# DAILY DEOBF

Discord bot for analyzing Luau scripts with two independent Luraph engines.

- Prefix command: `.deobf`
- Inputs: `.lua`, `.luau`, `.txt`, or a direct HTTP/HTTPS script URL
- Engine choices: **Luraph v15** (new engine) and **Luraph 15.1** (legacy engine)
- Each engine has a separate runner, directory, timeout, and output format
- Input limit: 2 MB

The Luraph 15.1 bundle is restored from the preserved files in `vendor/` at startup. The newer v15 engine remains in `luraph-v15-engine/`.

## Railway

Set `DISCORD_TOKEN` and use `npm start`. The runtime requires Node.js 20.11+ and Python 3.10+.
