# ENVLOGGER v4

Discord command: **`.l`** (aliases: `.envlog`, `.envlogger`)

## Combined release (main)

This package was landed across these commits and is complete at the current tip:

| Commit | What |
|--------|------|
| `812404e` | Index hook wiring |
| `3bea85f` | `src/run.js` runner |
| `ffa6954` | Discord integration + `_behavior.lua` attachment |
| `097d7f6` | Runtime (print / GetService / remotes) |
| `af2a333` | **Register `.l` route** + help + prefix log |

## Layout

```
envlogger/
  runtime/envlogger.luau     # sandbox + behavior reconstruction
  src/run.js                 # static fingerprint + dynamic run
  discord-integration.js     # Discord embed + attachments
  scripts/apply-index-hook.js
scripts/setup-envlogger.js   # runs on `npm start`
```

## Boot checklist

```
[envlogger] ENVLOGGER-BUILD-v4-behavior
[envlogger] runtime ok
[envlogger] discord-integration ok
[envlogger] .l route confirmed in index.js
Prefix commands: .deobf, .get, .fetch, .beautify, .l, .help
```

## Output

- Embed: obfuscator, API surface, URLs, services, prints, remotes
- `*_envlog.txt` full report
- `*_behavior.lua` reconstructed sandbox observation (not original source)
