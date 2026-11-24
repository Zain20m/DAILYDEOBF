#!/usr/bin/env node
'use strict';
/**
 * Balanced FAST + QUALITY deobf profile.
 *
 * Goal: good readable lifts in ~5–20s for typical samples, hard wall ~60s.
 * Not the old 5–12 minute full walk, and not the ultra-stripped 12k-state mode
 * that left half the script unlifted.
 *
 * What we cut (waste):
 *   - per-block DEVIRT_TB / DEVIRT_ERRS spam
 *   - 12 parallel-minute candidate waits
 *   - 200 devirt rounds / 16 max-runs
 *   - 750k state walks that rarely add code after the first good pass
 *
 * What we keep (quality):
 *   - enough walk states for real function bodies
 *   - several devirt rounds so constants resolve
 *   - DEVIRT_ALLOW_PARTIAL so output is emitted even if a few blocks stick
 *   - merge/bisect still on (small budgets)
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
    console.log('[speed]', label, '×' + n);
  }
}

// ---- walls: finish or emit partial within a minute ----
rep(/const ENGINE_TIMEOUT_MS = [^;]+;/, 'const ENGINE_TIMEOUT_MS = 60_000; // fast+quality',
  'ENGINE_TIMEOUT_MS=60s');

// 14.x tiers — enough time for a real lift, not multi-minute spins
rep(/const largeFileRuntimeSeconds = \[[^\]]+\]\[largeFileTier\];/,
  'const largeFileRuntimeSeconds = [25, 35, 45, 55][largeFileTier];',
  '14.x runtime');
rep(/const largeFileSpinChecks = \[[^\]]+\]\[largeFileTier\];/,
  'const largeFileSpinChecks = [4, 8, 12, 16][largeFileTier];',
  'spin checks');

// 14.x CLI — 2–3 runs and enough rounds for constant folding
rep(/'--max-runs', options\.fast \? '[^']+' : '[^']+',/,
  "'--max-runs', options.fast ? '2' : '3',", '14.x max-runs');
rep(/'--devirt-rounds', options\.fast \? '[^']+' : '[^']+',/,
  "'--devirt-rounds', options.fast ? '8' : '12',", '14.x rounds');
rep(/'--budget', options\.fast \? '[^']+' : String\(\[[^\]]+\]\[largeFileTier\]\),/,
  "'--budget', options.fast ? '12' : String([18, 24, 30, 40][largeFileTier]),", '14.x budget');
rep(/'--timeout', options\.fast \? '[^']+' : String\(largeFileRuntimeSeconds\),/,
  "'--timeout', options.fast ? '20' : String(largeFileRuntimeSeconds),", '14.x timeout');

// 15 / 15.1 literals — quality-capable but not 200 rounds
rep(/'--max-runs', '\d+',/g, "'--max-runs', '2',", 'max-runs→2');
rep(/'--devirt-rounds', '\d+',/g, "'--devirt-rounds', '10',", 'rounds→10');
rep(/'--budget', '\d+',/g, "'--budget', '15',", 'budget→15');
rep(/'--timeout', '\d+',/g, "'--timeout', '25',", 'timeout→25');

// Hard walls on 15.x runners (was 12 minutes)
rep(/12 \* 60_000/g, '55_000', 'hard 55s');
rep(/stallTimeoutMs:\s*\d[_\d]*/g, 'stallTimeoutMs: 18_000', 'stall 18s');

// Candidate timeouts — fail fast if a worker is stuck, not 5 minutes
rep(/DEOB_CANDIDATE_TIMEOUT_MS:\s*'\d+'/g, "DEOB_CANDIDATE_TIMEOUT_MS: '35000'", 'candidate 35s');
rep(/DEOB_CANDIDATE_IDLE_TIMEOUT_MS:\s*'\d+'/g, "DEOB_CANDIDATE_IDLE_TIMEOUT_MS: '12000'", 'idle 12s');

// Walk limit: 750k was the 137k-state slog; 12k starved quality.
// ~80k is enough for most 100–300KB scripts without multi-minute walks.
rep(/DEVIRT_WALK_LIMIT:\s*'\d+'/g, "DEVIRT_WALK_LIMIT: '80000'", 'walk≤80k');
rep(/DEVIRT_MERGE_BUDGET:\s*'\d+'/g, "DEVIRT_MERGE_BUDGET: '8'", 'merge 8');
rep(/DEVIRT_BISECT_BUDGET:\s*'\d+'/g, "DEVIRT_BISECT_BUDGET: '4'", 'bisect 4');

// Debug overhead only — does not improve lift quality for Discord output
rep(/DEVIRT_ERRS:\s*'1'/g, "DEVIRT_ERRS: ''", 'no DEVIRT_ERRS');
rep(/DEVIRT_TB:\s*'1'/g, "DEVIRT_TB: ''", 'no DEVIRT_TB');
// Keep light timing off; progress stays for Discord UI
rep(/DEVIRT_TIMING:\s*'1'/g, "DEVIRT_TIMING: ''", 'no DEVIRT_TIMING');

// Always allow partial emission + fast mode + single python worker
rep(/DEOB_FAST:\s*'[^']*'/g, "DEOB_FAST: '1'", 'DEOB_FAST');
rep(/DEOB_PY_CANDIDATES:\s*'[^']*'/g, "DEOB_PY_CANDIDATES: 'python:1'", '1 candidate');

// Ensure ALLOW_PARTIAL is set in 14.x env blocks
if (!src.includes("DEVIRT_ALLOW_PARTIAL: '1'") && src.includes('DEVIRT_ALLOW_PARTIAL')) {
  rep(/DEVIRT_ALLOW_PARTIAL:\s*'[^']*'/g, "DEVIRT_ALLOW_PARTIAL: '1'", 'ALLOW_PARTIAL');
}
if (src.includes('DEVIRT_FULL_ROUNDS')) {
  // empty = walk-only intermediate rounds, one full lift at end (faster, same quality)
  rep(/DEVIRT_FULL_ROUNDS:\s*'[^']*'/g, "DEVIRT_FULL_ROUNDS: ''", 'FULL_ROUNDS empty');
}

// 14.9 size-scaled timeouts
rep(
  /runtimeTimeoutSeconds:\s*bytes[\s\S]{0,200}?:\s*\d+,\s*\n\s*hardTimeoutMs:\s*bytes[\s\S]{0,200}?:\s*[\d_]+,\s*\n\s*stallTimeoutMs:\s*bytes[\s\S]{0,200}?:\s*[\d_]+,/,
  'runtimeTimeoutSeconds: bytes >= 5 * 1024 * 1024 ? 50 : bytes >= 2 * 1024 * 1024 ? 40 : bytes >= 500 * 1024 ? 30 : 22,\n    hardTimeoutMs: bytes >= 5 * 1024 * 1024 ? 60_000 : bytes >= 2 * 1024 * 1024 ? 55_000 : bytes >= 500 * 1024 ? 45_000 : 40_000,\n    stallTimeoutMs: bytes >= 2 * 1024 * 1024 ? 22_000 : bytes >= 500 * 1024 ? 18_000 : 15_000,',
  '14.9 tiers'
);

rep(/Math\.max\(\s*[\d_]+\s*,\s*options\.stallTimeoutMs\s*\)/,
  'Math.max(8_000, options.stallTimeoutMs)', 'min stall 8s');

// Auto-fast for samples under 1MB on 14.x
if (!src.includes('/* speed-quality auto-fast */')) {
  const needle = 'async function processLuraph14x(message, prompt, input, version, options = {}) {\n  const startedAt = Date.now();\n  const inputBytes = Buffer.byteLength(input.source, \'utf8\');';
  if (src.includes(needle)) {
    src = src.replace(
      needle,
      needle + '\n  /* speed-quality auto-fast */\n  if (options.fast == null && inputBytes < 1024 * 1024) options = { ...options, fast: true };'
    );
    console.log('[speed] auto-fast <1MB');
  }
}

if (src === before) {
  console.log('[speed] no changes (already applied or patterns moved)');
} else {
  fs.writeFileSync(indexPath, src);
  console.log('[speed] fast+quality: walk≤80k, 2 runs, 10 rounds, partial OK, wall≤60s');
}
