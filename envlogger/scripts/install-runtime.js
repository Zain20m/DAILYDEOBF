#!/usr/bin/env node
const { spawnSync } = require("child_process");
const path = require("path");
const r = spawnSync(process.execPath, [path.join(__dirname, "..", "runtime", "chunks", "assemble.js")], { stdio: "inherit" });
process.exit(r.status || 0);
