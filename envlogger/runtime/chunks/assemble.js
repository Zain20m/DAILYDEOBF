#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const dir = __dirname;
const dest = path.join(__dirname, '..', 'envlogger.luau');

// Prefer an already-complete runtime next to this script's parent.
if (fs.existsSync(dest)) {
  const cur = fs.readFileSync(dest, 'utf8');
  if (cur.length > 1000 && !cur.includes('PLACEHOLDER')) {
    console.log('[envlogger] runtime already present', dest, cur.length);
    process.exit(0);
  }
}

// Accept p00.txt / p01.txt / part000 etc.
const parts = fs.readdirSync(dir)
  .filter((f) => /^(p|part)\d+/i.test(f) && f.endsWith('.txt'))
  .sort();
if (!parts.length) {
  console.error('[envlogger] no chunks to assemble and runtime missing/placeholder');
  process.exit(1);
}
let out = '';
for (const p of parts) out += fs.readFileSync(path.join(dir, p), 'utf8');
if (out.length < 1000 || out.includes('PLACEHOLDER')) {
  console.error('[envlogger] assembled runtime looks incomplete', out.length);
  process.exit(1);
}
fs.writeFileSync(dest, out);
console.log('[envlogger] assembled', dest, out.length);
