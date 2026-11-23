# ENVLOGGER (DAILYDEOBF)

Powers the Discord **`.l`** command.

## Setup on deploy

```bash
node envlogger/scripts/install-runtime.js   # writes runtime/envlogger.luau
node envlogger/scripts/apply-index-hook.js  # wires .l to ENVLOGGER (if not already)
# Ensure ENVLOGGER_LUAU or DEOB_LUAU points at a luau binary
```

## Usage

```
.l
.l <url>
.l ```lua ... ```
# attach a .lua file
.l studio   # still the Studio diagnostic helper
```
