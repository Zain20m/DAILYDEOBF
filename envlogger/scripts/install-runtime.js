#!/usr/bin/env node
const fs = require("fs");
const zlib = require("zlib");
const path = require("path");
const b64 = "placeholder_will_replace";
const out = path.join(__dirname, "..", "runtime", "envlogger.luau");
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, zlib.inflateSync(Buffer.from(b64, "base64")));
console.log("wrote", out, fs.statSync(out).size);
