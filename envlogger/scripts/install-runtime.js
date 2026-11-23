#!/usr/bin/env node
'use strict';
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const runtime = path.join(root, 'runtime', 'envlogger.luau');
const assemble = path.join(root, 'runtime', 'chunks', 'assemble.js');

function okRuntime() {
  try {
    const t = fs.readFileSync(runtime, 'utf8');
    return t.length > 1000 && !t.includes('PLACEHOLDER');
  } catch {
    return false;
  }
}

if (okRuntime()) {
  console.log('[envlogger] runtime ok', fs.statSync(runtime).size);
  process.exit(0);
}

if (fs.existsSync(assemble)) {
  const r = spawnSync(process.execPath, [assemble], { stdio: 'inherit' });
  if (okRuntime()) process.exit(0);
  process.exit(r.status || 1);
}
console.error('[envlogger] missing runtime/envlogger.luau');
process.exit(1);
