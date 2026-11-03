# DAILY DEOBF

Discord bot that accepts Luau source as a `.lua`, `.luau`, or `.txt` upload, or as a direct HTTP/HTTPS script URL. Users type `.deobf`, submit the input, choose **15.1**, and the bot runs the bundled Luraph v15.1 analysis engine.

## Features

- Message command: `.deobf` (not a slash command)
- Input: `.lua`, `.luau`, `.txt`, or a direct script URL
- Deobfuscator picker button: **15.1**
- Outputs: lifted listing, readable/renamed bootstrap, extraction report, and string list
- 400 KB input limit, URL redirect validation, private-network URL blocking, temporary per-job directories, time limit, and a separate Node child process for analysis

## Run locally

1. Create a Discord application and bot in the Discord Developer Portal.
2. Enable **Message Content Intent** for the bot.
3. Copy `.env.example` to `.env` and set `DISCORD_TOKEN`.
4. Install dependencies with `npm install`.
5. Start with `npm start`.

For Railway, deploy this repository as a Node.js service and set `DISCORD_TOKEN` in the service variables. The start command is `npm start`.

## Important engine limitation

The bundled engine targets Luraph v15.1 Luau. It unpacks and analyzes the bootstrap and emits a **dynamic lifted instruction listing** based on the code observed during analysis. The engine's own documentation notes that this is not yet a complete static reconstruction of every protected program. Some builds may only produce partial output or fail when their layout differs from the tested sample. Output files include a structure report so users can see what was recovered.

## Bot configuration

The Discord bot's visible name is configured in the Discord Developer Portal. Set it to **DAILY DEOBF**. The bot needs View Channels, Send Messages, Read Message History, Attach Files, and Message Content Intent.

## Supported engine

- Luraph 15.1 (Luau): enabled as the **15.1** button.
