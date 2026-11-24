#!/usr/bin/env node
'use strict';
/**
 * Rewrite index.js deobf budgets so small samples finish in seconds,
 * and nothing casual waits past ~60s.
 *
 * Previous defaults for a 150 KB file:
 *   runtime 180s, hardTimeout 240s, stall 120s, candidate 300s
 * That made a "fast" server's 2s job look like 5 minutes here.
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

// Global engine wall clock: 25 min -> 90s (large files can still use per-call hardTimeoutMs)
src = src.replace(
  /const ENGINE_TIMEOUT_MS = 25 \* 60_000;/,
  'const ENGINE_TIMEOUT_MS = 90_000; // speed-tuned: was 25min'
);

// Tier runtime seconds for 14.x: was [180,240,360,480] -> [20,35,50,60]
src = src.replace(
  /const largeFileRuntimeSeconds = \[180, 240, 360, 480\]\[largeFileTier\];/,
  'const largeFileRuntimeSeconds = [20, 35, 50, 60][largeFileTier]; // speed-tuned'
);

// Spin checks: fewer idle iterations before spin detect on small files
src = src.replace(
  /const largeFileSpinChecks = \[8, 32, 64, 128\]\[largeFileTier\];/,
  'const largeFileSpinChecks = [4, 8, 16, 24][largeFileTier]; // speed-tuned'
);

// 14.x max-runs / devirt-rounds / budget
src = src.replace(
  /'--max-runs', options\.fast \? '6' : '16',/,
  "'--max-runs', options.fast ? '3' : '6',"
);
src = src.replace(
  /'--devirt-rounds', options\.fast \? '120' : '200',/,
  "'--devirt-rounds', options.fast ? '40' : '80',"
);
src = src.replace(
  /'--budget', options\.fast \? '30' : String\(\[60, 90, 120, 150\]\[largeFileTier\]\),/,
  "'--budget', options.fast ? '8' : String([12, 18, 25, 35][largeFileTier]),"
);
src = src.replace(
  /'--timeout', options\.fast \? '60' : String\(largeFileRuntimeSeconds\),/,
  "'--timeout', options.fast ? '20' : String(largeFileRuntimeSeconds),"
);

// DEOB_TRACE_STALL_SECONDS tiers
src = src.replace(
  /DEOB_TRACE_STALL_SECONDS: String\(\[60, 90, 120, 150\]\[largeFileTier\]\)/,
  'DEOB_TRACE_STALL_SECONDS: String([12, 18, 25, 35][largeFileTier])'
);

// 14.9 sized timeouts (was up to 480s / 240s stall for mid sizes)
src = src.replace(
  /runtimeTimeoutSeconds: bytes >= 5 \* 1024 \* 1024 \? 480\s*:\s*bytes >= 2 \* 1024 \* 1024 \? 360\s*:\s*bytes >= 500 \* 1024 \? 240 : 180,/,
  'runtimeTimeoutSeconds: bytes >= 5 * 1024 * 1024 ? 60 : bytes >= 2 * 1024 * 1024 ? 50 : bytes >= 500 * 1024 ? 35 : 20,'
);
src = src.replace(
  /hardTimeoutMs: bytes >= 5 \* 1024 \* 1024 \? ENGINE_TIMEOUT_MS\s*:\s*bytes >= 2 \* 1024 \* 1024 \? 900_000\s*:\s*bytes >= 500 \* 1024 \? 600_000 : 240_000,/,
  'hardTimeoutMs: bytes >= 5 * 1024 * 1024 ? ENGINE_TIMEOUT_MS : bytes >= 2 * 1024 * 1024 ? 75_000 : bytes >= 500 * 1024 ? 55_000 : 40_000,'
);
src = src.replace(
  /stallTimeoutMs: bytes >= 2 \* 1024 \* 1024 \? 240_000\s*:\s*bytes >= 500 \* 1024 \? 180_000 : 120_000,/,
  'stallTimeoutMs: bytes >= 2 * 1024 * 1024 ? 40_000 : bytes >= 500 * 1024 ? 30_000 : 20_000,'
);

// 14.3 hard/stall
src = src.replace(
  /hardTimeoutMs: 170_000,\s*stallTimeoutMs: 120_000,/,
  'hardTimeoutMs: 50_000,\n    stallTimeoutMs: 25_000,'
);

// 15.1 candidate timeouts (the classic 5-minute wait)
src = src.replace(
  /DEOB_CANDIDATE_TIMEOUT_MS: '300000',/g,
  "DEOB_CANDIDATE_TIMEOUT_MS: '45000',"
);
src = src.replace(
  /DEOB_CANDIDATE_IDLE_TIMEOUT_MS: '180000',/g,
  "DEOB_CANDIDATE_IDLE_TIMEOUT_MS: '15000',"
);

// Generic 15.x style max-runs blocks
src = src.replace(/'--max-runs', '12',/g, "'--max-runs', '5',");
src = src.replace(/'--devirt-rounds', '200',/g, "'--devirt-rounds', '60',");
src = src.replace(/'--budget', '45',/g, "'--budget', '12',");
src = src.replace(/'--timeout', '120',/g, "'--timeout', '30',");

// Common stallTimeoutMs: 180_000 literals in process functions
src = src.replace(/stallTimeoutMs: 180_000/g, 'stallTimeoutMs: 30_000');
src = src.replace(/stallTimeoutMs: 120_000/g, 'stallTimeoutMs: 25_000');

// Minimum stall floor in runCommand (was 30s)
src = src.replace(
  /Math\.max\(30_000, options\.stallTimeoutMs\)/,
  'Math.max(8_000, options.stallTimeoutMs)'
);

// Auto-fast path: treat sub-400KB inputs as fast in processLuraph14x
if (!src.includes('/* speed-tuned auto-fast */')) {
  src = src.replace(
    'async function processLuraph14x(message, prompt, input, version, options = {}) {\n  const startedAt = Date.now();\n  const inputBytes = Buffer.byteLength(input.source, \'utf8\');',
    'async function processLuraph14x(message, prompt, input, version, options = {}) {\n  const startedAt = Date.now();\n  const inputBytes = Buffer.byteLength(input.source, \'utf8\');\n  /* speed-tuned auto-fast */\n  if (options.fast == null && inputBytes < 400 * 1024) options = { ...options, fast: true };'
  );
}

if (src === before) {
  console.log('[speed] index.js already tuned or patterns shifted');
} else {
  fs.writeFileSync(indexPath, src);
  console.log('[speed] index.js deobf budgets tightened (target ≤60s for ≤500KB samples)');
}
