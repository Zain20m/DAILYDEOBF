#!/usr/bin/env node
'use strict';
/**
 * Aggressive deobf speed profile.
 * Target: 150KB Luraph finishes in a few seconds, hard wall ~45s.
 * Kills the 137k-state / 113-function full walk that was burning ~70s+.
 */
const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, '..', 'index.js');
if (!fs.existsSync(indexPath)) {
  console.warn('[speed] index.js missing');
  process.exit(0);
}

let src = fs.readFileSync(indexPath, 'utf8');
const before = src;

function rep(re, to, label) {
  const n = (src.match(re) || []).length;
  if (n) {
    src = src.replace(re, to);
    console.log('[speed]', label, '(' + n + ')');
  }
}

// ---- hard walls ----
rep(/const ENGINE_TIMEOUT_MS = [^;]+;/, 'const ENGINE_TIMEOUT_MS = 45_000; // speed-100x',
  'ENGINE_TIMEOUT_MS=45s');

// 14.x tier tables
rep(/const largeFileRuntimeSeconds = \[[^\]]+\]\[largeFileTier\];/,
  'const largeFileRuntimeSeconds = [12, 18, 25, 35][largeFileTier];',
  '14.x runtime seconds');
rep(/const largeFileSpinChecks = \[[^\]]+\]\[largeFileTier\];/,
  'const largeFileSpinChecks = [3, 6, 10, 14][largeFileTier];',
  'spin checks');

// 14.x CLI knobs (any previous tune)
rep(/'--max-runs', options\.fast \? '[^']+' : '[^']+',/,
  "'--max-runs', options.fast ? '1' : '2',", '14.x max-runs');
rep(/'--devirt-rounds', options\.fast \? '[^']+' : '[^']+',/,
  "'--devirt-rounds', options.fast ? '2' : '4',", '14.x devirt-rounds');
rep(/'--budget', options\.fast \? '[^']+' : String\(\[[^\]]+\]\[largeFileTier\]\),/,
  "'--budget', options.fast ? '5' : String([8, 12, 16, 22][largeFileTier]),", '14.x budget');
rep(/'--timeout', options\.fast \? '[^']+' : String\(largeFileRuntimeSeconds\),/,
  "'--timeout', options.fast ? '12' : String(largeFileRuntimeSeconds),", '14.x timeout');

// 15 / 15.1 CLI knobs (literal forms)
rep(/'--max-runs', '\d+',/g, "'--max-runs', '1',", 'literal max-runs→1');
rep(/'--devirt-rounds', '\d+',/g, "'--devirt-rounds', '2',", 'literal devirt-rounds→2');
rep(/'--budget', '\d+',/g, "'--budget', '6',", 'literal budget→6');
rep(/'--timeout', '\d+',/g, "'--timeout', '15',", 'literal timeout→15');

// 15.1 wall clocks on runEngine / runCommand
rep(/12 \* 60_000/g, '45_000', '12min→45s hard');
rep(/stallTimeoutMs:\s*\d[_\d]*/g, 'stallTimeoutMs: 12_000', 'stall→12s');

// Candidate timeouts (was 5 min)
rep(/DEOB_CANDIDATE_TIMEOUT_MS:\s*'\d+'/g, "DEOB_CANDIDATE_TIMEOUT_MS: '20000'", 'candidate 20s');
rep(/DEOB_CANDIDATE_IDLE_TIMEOUT_MS:\s*'\d+'/g, "DEOB_CANDIDATE_IDLE_TIMEOUT_MS: '8000'", 'idle 8s');

// THE BIG ONE — state walker was doing 137k+ states
rep(/DEVIRT_WALK_LIMIT:\s*'\d+'/g, "DEVIRT_WALK_LIMIT: '12000'", 'WALK_LIMIT 12k');
rep(/DEVIRT_MERGE_BUDGET:\s*'\d+'/g, "DEVIRT_MERGE_BUDGET: '2'", 'merge budget 2');
rep(/DEVIRT_BISECT_BUDGET:\s*'\d+'/g, "DEVIRT_BISECT_BUDGET: '1'", 'bisect budget 1');

// Debug traceback / per-block errors are expensive — kill them
rep(/DEVIRT_ERRS:\s*'1'/g, "DEVIRT_ERRS: ''", 'disable DEVIRT_ERRS');
rep(/DEVIRT_TB:\s*'1'/g, "DEVIRT_TB: ''", 'disable DEVIRT_TB');
rep(/DEVIRT_TIMING:\s*'1'/g, "DEVIRT_TIMING: ''", 'disable DEVIRT_TIMING');
rep(/DEVIRT_PROGRESS:\s*'1'/g, "DEVIRT_PROGRESS: '1'", 'keep progress');

// Force DEOB_FAST
rep(/DEOB_FAST:\s*'[^']*'/g, "DEOB_FAST: '1'", 'DEOB_FAST=1');
rep(/DEOB_PY_CANDIDATES:\s*'[^']*'/g, "DEOB_PY_CANDIDATES: 'python:1'", 'one python candidate');

// 14.9 sized tables
rep(
  /runtimeTimeoutSeconds:\s*bytes[\s\S]*?:\s*\d+,\s*\n\s*hardTimeoutMs:\s*bytes[\s\S]*?:\s*[\d_]+,\s*\n\s*stallTimeoutMs:\s*bytes[\s\S]*?:\s*[\d_]+,/,
  'runtimeTimeoutSeconds: bytes >= 5 * 1024 * 1024 ? 35 : bytes >= 2 * 1024 * 1024 ? 28 : bytes >= 500 * 1024 ? 20 : 12,\n    hardTimeoutMs: bytes >= 5 * 1024 * 1024 ? 45_000 : bytes >= 2 * 1024 * 1024 ? 40_000 : bytes >= 500 * 1024 ? 30_000 : 25_000,\n    stallTimeoutMs: bytes >= 2 * 1024 * 1024 ? 15_000 : bytes >= 500 * 1024 ? 12_000 : 10_000,',
  '14.9 size tiers'
);

// Stall floor in runCommand
rep(/Math\.max\(\s*[\d_]+\s*,\s*options\.stallTimeoutMs\s*\)/,
  'Math.max(5_000, options.stallTimeoutMs)', 'min stall 5s');

// Auto-fast for <1MB on 14.x
if (!src.includes('/* speed-100x auto-fast */')) {
  const needle = 'async function processLuraph14x(message, prompt, input, version, options = {}) {\n  const startedAt = Date.now();\n  const inputBytes = Buffer.byteLength(input.source, \'utf8\');';
  if (src.includes(needle)) {
    src = src.replace(
      needle,
      needle + '\n  /* speed-100x auto-fast */\n  if (options.fast == null && inputBytes < 1024 * 1024) options = { ...options, fast: true };'
    );
    console.log('[speed] auto-fast <1MB on 14.x');
  }
}

// Inject ultra-fast env defaults into runLuraph151Engine if still high
if (src.includes("DEVIRT_WALK_LIMIT: '750000'") || src.includes('DEVIRT_WALK_LIMIT: "750000"')) {
  console.log('[speed] WARN: walk limit still 750k after replace');
}

if (src === before) {
  console.log('[speed] no index.js changes (already extreme or patterns moved)');
} else {
  fs.writeFileSync(indexPath, src);
  console.log('[speed] applied 100x profile → walk≤12k, 1 run, 2 rounds, ≤45s wall');
}
