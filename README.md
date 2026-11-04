# DAILY DEOBF

Discord bot for analyzing Luau scripts protected by Luraph v15.

- Prefix command: .deobf
- Inputs: .lua, .luau, .txt, or a direct HTTP/HTTPS script URL
- Output: reconstructed deobfuscated.luau
- Input limit: 2 MB
- Processing limit: 15 minutes

The bot uses the newest bundled Luraph v15 engine in luraph-v15-engine/. It includes a sandboxed Luau runtime and Python analysis backend. Some protected scripts may still contain paths the engine cannot reconstruct; the engine reports those rather than guaranteeing perfect recovery.

## Railway

Deploy this repository from the main branch, set DISCORD_TOKEN, and use npm start. The runtime requires Node.js 20.11+ and Python 3.10+.
