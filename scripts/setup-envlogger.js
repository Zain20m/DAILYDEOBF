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
if (fs.existsSync(integration) && fs.readFileSync(integration,'utf8').includes('Behavior script')) console.log('[envlogger] discord-integration ok');
else console.error('[envlogger] CRITICAL: discord-integration missing/stale');
if (fs.existsSync(indexPath)) {
  const src = fs.readFileSync(indexPath, 'utf8');
  if (!src.includes('envlogger/discord-integration')) {
    if (fs.existsSync(hook)) {
      console.log('[envlogger] applying index.js .l hook...');
      spawnSync(process.execPath, [hook], { stdio: 'inherit', cwd: repoRoot });
    }
  } else console.log('[envlogger] index.js already wired');
}
