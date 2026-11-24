#!/usr/bin/env node
'use strict';
/**
 * Find a Luau binary that actually runs on this host (not SIGILL / status -4).
 * Writes the path to process.env and copies into engine bin/ folders.
 */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const smokePath = path.join(root, '.luau-smoke-ensure.luau');

function candidates() {
  return [
    process.env.DEOB_LUAU,
    process.env.ENVLOGGER_LUAU,
    process.env.LUAU_BIN,
    path.join(root, 'luraph-v15.1-engine', 'bin', 'luau.linux'),
    path.join(root, 'luraph-v15.1-engine', 'bin', 'luau'),
    path.join(root, 'bin', 'luau.linux'),
    path.join(root, 'bin', 'luau'),
    path.join(root, 'luraph-v14.7-engine', 'bin', 'luau'),
    path.join(root, 'luraph-v15-engine', 'bin', 'luau'),
    '/tmp/luau',
    'luau',
  ].filter(Boolean);
}

function smoke(bin) {
  try {
    fs.writeFileSync(smokePath, 'print("LUAU_RUNTIME_OK")\n');
    const r = spawnSync(bin, [smokePath], { encoding: 'utf8', timeout: 8000 });
    if (r.error) return false;
    // status -4 / null / SIGILL => bad
    if (r.status === null || r.signal === 'SIGILL' || r.signal === 'SIGSEGV') return false;
    if (r.status !== 0) return false;
    return String(r.stdout || '').includes('LUAU_RUNTIME_OK');
  } catch {
    return false;
  } finally {
    try { fs.rmSync(smokePath, { force: true }); } catch (_) {}
  }
}

function main() {
  let good = null;
  for (const c of candidates()) {
    if (c !== 'luau' && !fs.existsSync(c)) continue;
    if (smoke(c)) {
      good = c === 'luau' ? 'luau' : path.resolve(c);
      console.log('[luau] healthy binary:', good);
      break;
    }
    console.warn('[luau] rejected (SIGILL/fail):', c);
  }
  if (!good) {
    console.warn('[luau] NO healthy Luau binary on this host. Luraph dynamic trace will fail with status -4 / ENVLOG markers.');
    process.exitCode = 0; // do not block bot start
    return;
  }

  // Propagate for child processes started from same shell profile files if any
  const envSnippet = path.join(root, '.luau-path');
  fs.writeFileSync(envSnippet, good + '\n');

  // Install into shared locations engines look for
  const targets = [
    path.join(root, 'luraph-v15-engine', 'bin', 'luau'),
    path.join(root, 'luraph-v14.7-engine', 'bin', 'luau'),
    path.join(root, 'luraph-v15.1-engine', 'bin', 'luau'),
  ];
  if (good !== 'luau') {
    for (const dest of targets) {
      try {
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        if (path.resolve(good) === path.resolve(dest)) continue;
        fs.copyFileSync(good, dest);
        fs.chmodSync(dest, 0o755);
        console.log('[luau] installed ->', dest);
      } catch (e) {
        console.warn('[luau] could not install to', dest, e.message);
      }
    }
  }
}

main();
