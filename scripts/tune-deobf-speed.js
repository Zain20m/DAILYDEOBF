#!/usr/bin/env node
'use strict';
/**
 * Force fast+quality Luraph settings into index.js.
 * The previous regex-only tune could miss blocks; this replaces the whole
 * 15 / 15.1 engine runners so a 5m09s candidate wait cannot come back.
 */
const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, '..', 'index.js');
if (!fs.existsSync(indexPath)) {
  console.warn('[speed] index.js missing');
  process.exit(0);
}

let src = fs.readFileSync(indexPath, 'utf8');
let hits = 0;

function once(label, find, replace) {
  if (typeof find === 'string' && !src.includes(find)) {
    console.log('[speed] skip (not found):', label);
    return;
  }
  const next = src.replace(find, replace);
  if (next === src) {
    console.log('[speed] skip (no change):', label);
    return;
  }
  src = next;
  hits += 1;
  console.log('[speed]', label);
}

// ---- inject process.env defaults right after dotenv ----
const ENV_INJECT = `
// [speed-quality] forced defaults — override with real env if needed
(() => {
  const d = {
    DEOB_FAST: '1',
    DEOB_PY_CANDIDATES: 'python:1',
    DEOB_CANDIDATE_TIMEOUT_MS: '35000',
    DEOB_CANDIDATE_IDLE_TIMEOUT_MS: '12000',
    DEVIRT_WALK_LIMIT: '80000',
    DEVIRT_MERGE_BUDGET: '8',
    DEVIRT_BISECT_BUDGET: '4',
    DEVIRT_ALLOW_PARTIAL: '1',
    DEVIRT_FULL_ROUNDS: '',
    DEVIRT_ERRS: '',
    DEVIRT_TB: '',
    DEVIRT_TIMING: '',
  };
  for (const [k, v] of Object.entries(d)) {
    if (process.env[k] === undefined || process.env[k] === '') process.env[k] = v;
  }
})();
`;

if (!src.includes('[speed-quality] forced defaults')) {
  if (src.includes("require('dotenv').config();")) {
    once('env inject after dotenv', "require('dotenv').config();", "require('dotenv').config();\n" + ENV_INJECT);
  } else if (src.startsWith("'use strict';")) {
    once('env inject after use strict', "'use strict';\n", "'use strict';\n" + ENV_INJECT);
  }
}

// Preserve the engine's configured timeout. Do not inject a global 60-second cap.

// ---- replace entire v15 engine runner ----
const V15_OLD_START = '  function runLuraphV15Engine(target) {';
const V15_NEW = `  function runLuraphV15Engine(target) {
    const python = process.env.PYTHON_BIN || (process.platform === 'win32' ? 'python' : 'python3');
    return runCommand(
      python,
      [
        ENGINE_V15_CLI,
        target.inputPath,
        '-o', target.outputPath,
        '--obfuscator', 'luraph_v15',
        '--strings',
        '--max-runs', '2',
        '--devirt-rounds', '10',
        '--budget', '15',
        '--timeout', '25',
      ],
      ENGINE_V15_DIR,
      55_000,
      {
        stallTimeoutMs: 18_000,
        onProgress: progress.onLine,
        env: {
          DEOB_FAST: '1',
          DEOB_PY_CANDIDATES: 'python:1',
          DEOB_CANDIDATE_TIMEOUT_MS: '35000',
          DEOB_CANDIDATE_IDLE_TIMEOUT_MS: '12000',
          DEVIRT_WALK_LIMIT: '80000',
          DEVIRT_MERGE_BUDGET: '8',
          DEVIRT_BISECT_BUDGET: '4',
          DEVIRT_ALLOW_PARTIAL: '1',
          DEVIRT_FULL_ROUNDS: '',
          DEVIRT_ERRS: '',
          DEVIRT_TB: '',
        },
      },
    );
  }`;

if (src.includes(V15_OLD_START)) {
  const start = src.indexOf(V15_OLD_START);
  // find matching close: next "  function runLuraph151Engine"
  const endMarker = '  // The dedicated v15.1 engine run';
  const endAlt = '  function runLuraph151Engine(target) {';
  let end = src.indexOf(endMarker, start);
  if (end < 0) end = src.indexOf(endAlt, start);
  if (end > start) {
    src = src.slice(0, start) + V15_NEW + '\n\n' + src.slice(end);
    hits += 1;
    console.log('[speed] replaced runLuraphV15Engine');
  }
}

// ---- replace entire v15.1 engine runner ----
const V151_NEW = `  function runLuraph151Engine(target) {
    return runEngine(
      ENGINE_151_DIR,
      ENGINE_151_CLI,
      target.inputPath,
      target.outputPath,
      55_000, // hard wall — was 12 minutes / 5m candidate hang
      false,
      [
        '--plugin', 'luraph_v15',
        '--strings',
        '--max-runs', '2',
        '--devirt-rounds', '10',
        '--budget', '15',
        '--timeout', '25',
        ...(gameId ? ['--cfg-json', JSON.stringify({ __superz_game_id: Number(gameId) })] : []),
      ],
      {
        stallTimeoutMs: 18_000,
        env: {
          DEOB_FAST: '1',
          DEOB_PY_CANDIDATES: 'python:1',
          DEOB_CANDIDATE_TIMEOUT_MS: '35000',
          DEOB_CANDIDATE_IDLE_TIMEOUT_MS: '12000',
          DEVIRT_FULL_ROUNDS: '',
          DEVIRT_ALLOW_PARTIAL: '1',
          DEVIRT_WALK_LIMIT: '80000',
          DEVIRT_MERGE: '1',
          DEVIRT_MERGE_BUDGET: '8',
          DEVIRT_BISECT: '1',
          DEVIRT_BISECT_BUDGET: '4',
          DEVIRT_ERRS: '',
          DEVIRT_TB: '',
          DEVIRT_TIMING: '',
        },
        onProgress: progress.onLine,
      },
    );
  }`;

const v151Start = src.indexOf('  function runLuraph151Engine(target) {');
if (v151Start >= 0) {
  // end at the closing before "const dedicated = await prepare"
  const endAt = src.indexOf('  const dedicated = await prepare', v151Start);
  if (endAt > v151Start) {
    src = src.slice(0, v151Start) + V151_NEW + '\n\n' + src.slice(endAt);
    hits += 1;
    console.log('[speed] replaced runLuraph151Engine (no more 5min candidate)');
  }
}

// Blanket kill any remaining 5-minute / 12-minute constants in deobf paths
once('candidate 300000', /DEOB_CANDIDATE_TIMEOUT_MS:\s*'300000'/g, "DEOB_CANDIDATE_TIMEOUT_MS: '35000'");
once('idle 180000', /DEOB_CANDIDATE_IDLE_TIMEOUT_MS:\s*'180000'/g, "DEOB_CANDIDATE_IDLE_TIMEOUT_MS: '12000'");
once('walk 750000', /DEVIRT_WALK_LIMIT:\s*'750000'/g, "DEVIRT_WALK_LIMIT: '80000'");
once('12*60_000', /12 \* 60_000/g, '55_000');
once('stall 180k', /stallTimeoutMs:\s*180_000/g, 'stallTimeoutMs: 18_000');
once('stall 120k', /stallTimeoutMs:\s*120_000/g, 'stallTimeoutMs: 18_000');

// Preserve the 14.x engine's size-based runtime timeout configuration.
once('14.x max-runs', /'--max-runs', options\.fast \? '[^']+' : '[^']+',/,
  "'--max-runs', options.fast ? '2' : '3',");
once('14.x rounds', /'--devirt-rounds', options\.fast \? '[^']+' : '[^']+',/,
  "'--devirt-rounds', options.fast ? '8' : '12',");

// No global runCommand timeout clamp: each engine uses its own configured timeout.

fs.writeFileSync(indexPath, src);
console.log('[speed] done, changes:', hits);
if (hits === 0) console.log('[speed] WARNING: nothing applied — index.js layout may have changed');
