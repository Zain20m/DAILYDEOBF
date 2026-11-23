#!/usr/bin/env node
'use strict';
/**
 * Ensures ENVLOGGER runtime is present and index.js .l command is hooked.
 * Invoked from package.json "start" before index.js.
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const repoRoot = path.join(__dirname, '..');
const envloggerRoot = path.join(repoRoot, 'envlogger');
const runtime = path.join(envloggerRoot, 'runtime', 'envlogger.luau');
const install = path.join(envloggerRoot, 'scripts', 'install-runtime.js');
const hook = path.join(envloggerRoot, 'scripts', 'apply-index-hook.js');
const indexPath = path.join(repoRoot, 'index.js');

function runtimeOk() {
  try {
    const t = fs.readFileSync(runtime, 'utf8');
    return t.length > 1000 && !t.includes('PLACEHOLDER');
  } catch {
    return false;
  }
}

if (!runtimeOk() && fs.existsSync(install)) {
  console.log('[envlogger] assembling/installing runtime...');
  spawnSync(process.execPath, [install], { stdio: 'inherit', cwd: envloggerRoot });
}

if (runtimeOk()) {
  console.log('[envlogger] runtime ok (' + fs.statSync(runtime).size + ' bytes)');
} else {
  console.warn('[envlogger] WARNING: runtime/envlogger.luau missing or PLACEHOLDER — .l will fail until fixed');
}

if (fs.existsSync(indexPath)) {
  const src = fs.readFileSync(indexPath, 'utf8');
  if (!src.includes('envlogger/discord-integration')) {
    if (fs.existsSync(hook)) {
      console.log('[envlogger] applying index.js .l hook...');
      spawnSync(process.execPath, [hook], { stdio: 'inherit', cwd: repoRoot });
    } else {
      console.warn('[envlogger] apply-index-hook.js missing');
    }
  } else {
    console.log('[envlogger] index.js already wired to discord-integration');
  }
}
