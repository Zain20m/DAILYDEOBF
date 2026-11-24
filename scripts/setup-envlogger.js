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

if (fs.existsSync(integration)) console.log('[envlogger] discord-integration ok');
else console.error('[envlogger] CRITICAL: discord-integration missing');

if (!fs.existsSync(indexPath) || !fs.existsSync(hook)) {
  console.error('[envlogger] CRITICAL: index.js or hook missing');
  process.exit(0);
}

console.log('[envlogger] applying/refreshing index.js .l hook...');
const r = spawnSync(process.execPath, [hook], { stdio: 'inherit', cwd: repoRoot });
if (r.status !== 0) {
  console.error('[envlogger] hook exited', r.status);
}

const src = fs.readFileSync(indexPath, 'utf8');
const hasRoute = src.includes("command === '.l'") || src.includes('ENVLOGGER early route');
const hasWorkflow = src.includes("envlogger/discord-integration");
console.log('[envlogger] route=' + hasRoute + ' workflow=' + hasWorkflow);
if (!hasRoute) console.error('[envlogger] CRITICAL: .l route still missing after hook');
else console.log('[envlogger] .l route confirmed — bot will reply to .l / .envlog');
