#!/usr/bin/env node
'use strict';
/**
 * Ensures ENVLOGGER runtime + discord integration are present.
 * Invoked from package.json "start" before index.js.
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const BUILD = 'ENVLOGGER-BUILD-2026-11-23-v3-static';
const repoRoot = path.join(__dirname, '..');
const envloggerRoot = path.join(repoRoot, 'envlogger');
const runtime = path.join(envloggerRoot, 'runtime', 'envlogger.luau');
const integration = path.join(envloggerRoot, 'discord-integration.js');
const runner = path.join(envloggerRoot, 'src', 'run.js');
const install = path.join(envloggerRoot, 'scripts', 'install-runtime.js');
const hook = path.join(envloggerRoot, 'scripts', 'apply-index-hook.js');
const indexPath = path.join(repoRoot, 'index.js');

console.log('[envlogger]', BUILD);

function runtimeOk() {
  try {
    const t = fs.readFileSync(runtime, 'utf8');
    return t.length > 1000 && !t.includes('PLACEHOLDER');
  } catch {
    return false;
  }
}

function integrationOk() {
  try {
    const t = fs.readFileSync(integration, 'utf8');
    // v3 markers
    return t.includes('API surface') && t.includes('function analyze(') && t.includes('Obfuscator');
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
  console.warn('[envlogger] WARNING: runtime/envlogger.luau missing or PLACEHOLDER');
}

if (integrationOk()) {
  console.log('[envlogger] discord-integration v3 OK (' + fs.statSync(integration).size + ' bytes)');
} else {
  console.error('[envlogger] CRITICAL: discord-integration.js is STALE or missing.');
  console.error('[envlogger] Run on host:  git fetch origin && git reset --hard origin/main');
  console.error('[envlogger] Then restart. File must contain "API surface".');
}

if (fs.existsSync(runner)) {
  const rt = fs.readFileSync(runner, 'utf8');
  if (rt.includes('staticAnalyze') || rt.includes('OBFUSCATOR_RULES')) {
    console.log('[envlogger] run.js has static analyzer');
  } else {
    console.warn('[envlogger] run.js looks old (no static analyzer) — git pull needed');
  }
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
