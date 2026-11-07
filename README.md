# DAILY DEOBF

Discord bot for Luau script analysis with two independently selectable Luraph engines.

- **Luraph v15** uses the newest imported engine in `luraph-v15-engine/`.
- **Luraph 15.1** uses the original bundled engine, extracted separately to `luraph-v15.1-engine/` during install.\n- **IronBrew 1** uses the bundled dynamic VM capture and bytecode lifter in `luraph-v15-engine/obfuscators/ironbrew1/`.

Run `.deobf`, provide a `.lua`, `.luau`, or `.txt` file (or a direct HTTP/HTTPS script URL), then choose the engine button. Each engine runs independently and produces its own output. IronBrew 1 returns a lifted Luau candidate when capture succeeds, with a behaviour trace fallback when it does not.

Some protected paths may not be reconstructable. Results are not guaranteed to be complete.

## Railway

Set `DISCORD_TOKEN` and deploy with `npm start`. Install runs the 15.1 engine setup automatically. Requires Node.js 20.11+ and Python 3.10+.
