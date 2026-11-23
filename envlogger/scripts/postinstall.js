#!/usr/bin/env node
// postinstall / deploy helper for ENVLOGGER
const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const root = path.join(__dirname, '..');
function run(rel) {
  const p = path.join(root, rel);
  if (!fs.existsSync(p)) return;
  console.log('[envlogger]', rel);
  spawnSync(process.execPath, [p], { stdio: 'inherit', cwd: root });
}
run('scripts/install-runtime.js');
const index = path.join(root, '..', 'index.js');
if (fs.existsSync(index) && !fs.readFileSync(index, 'utf8').includes('envlogger/discord-integration')) {
  run('scripts/apply-index-hook.js');
}
