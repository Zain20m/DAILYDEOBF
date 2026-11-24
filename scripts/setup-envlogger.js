#!/usr/bin/env node
'use strict';
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const repoRoot = path.join(__dirname, '..');
const envloggerRoot = path.join(repoRoot, 'envlogger');
const runtime = path.join(envloggerRoot, 'runtime', 'envlogger.luau');
const integration = path.join(envloggerRoot, 'discord-integration.js');
const hook = path.join(envloggerRoot, 'scripts', 'apply-index-hook.js');
const indexPath = path.join(repoRoot, 'index.js');
console.log('[envlogger] ENVLOGGER-BUILD-v4-behavior');
if (fs.existsSync(runtime)) console.log('[envlogger] runtime ok (' + fs.statSync(runtime).size + ' bytes)');
else console.error('[envlogger] CRITICAL: runtime missing');
if (fs.existsSync(integration) && fs.readFileSync(integration, 'utf8').includes('Behavior script')) {
  console.log('[envlogger] discord-integration ok');
} else {
  console.error('[envlogger] CRITICAL: discord-integration missing/stale');
}
// Always re-run the hook so .l route is present even if a prior inject only added the function
if (fs.existsSync(indexPath) && fs.existsSync(hook)) {
  console.log('[envlogger] applying/refreshing index.js .l hook...');
  const r = spawnSync(process.execPath, [hook], { stdio: 'inherit', cwd: repoRoot });
  if (r.status !== 0) console.error('[envlogger] hook exited', r.status);
  const src = fs.readFileSync(indexPath, 'utf8');
  if (!src.includes("command === '.l'") && !src.includes('command === ".l"')) {
    console.error('[envlogger] CRITICAL: .l route still missing after hook');
  } else {
    console.log('[envlogger] .l route confirmed in index.js');
  }
}
