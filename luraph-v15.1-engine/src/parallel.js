'use strict';

// Runs the Python devirtualization stage as several candidates at once.
// Each candidate has a hard wall-clock limit and an inactivity limit. The
// first complete lift wins; otherwise the best completed partial lift is kept.

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { StringDecoder } = require('string_decoder');
const { getPythonBin } = require('./pyenv');

const ROOT = path.join(__dirname, '..');
const PYPY = process.env.DEOB_PYPY ||
  [path.join(ROOT, 'pypy', 'pypy3.exe'), path.join(ROOT, 'pypy', 'bin', 'pypy3'),
   path.join(ROOT, '..', 'pypy', 'bin', 'pypy3')].find(p => fs.existsSync(p)) ||
  path.join(ROOT, 'pypy', 'pypy3.exe');

function readLimit(name, fallback, min = 10000, max = 600000) {
  const value = Number(process.env[name]);
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return Math.max(min, Math.min(Math.floor(value), max));
}

function candidateList() {
  let spec = process.env.DEOB_PY_CANDIDATES;
  if (!spec) spec = fs.existsSync(PYPY) ? 'pypy,python:1,python:2' : 'python:1,python:2,python:3';
  let list = spec.split(',').map(s => s.trim()).filter(Boolean).map(s => {
    const [kind, seed] = s.split(':');
    if (kind === 'pypy') return { label: 'pypy', exe: PYPY, seed: seed || '0' };
    return { label: seed ? `python:${seed}` : 'python', exe: getPythonBin(), seed: seed || null };
  });
  list = list.filter(c => c.label !== 'pypy' || fs.existsSync(PYPY));
  if (process.env.DEOB_FAST) list = list.slice(0, 1);
  return list.length ? list : [{ label: 'python', exe: getPythonBin(), seed: null }];
}

function parseStats(text) {
  const all = [...text.matchAll(/\[\*\]\s+(\d+) functions, (\d+) unlifted blocks/g)];
  const kept = /keeping the full lift of round \d+ \((\d+) unlifted blocks, (\d+) functions\)/.exec(text);
  if (kept) return { errors: +kept[1], functions: +kept[2] };
  if (!all.length) return null;
  const m = all[all.length - 1];
  return { functions: +m[1], errors: +m[2] };
}

async function runCandidates(cfgData, job) {
  const cands = candidateList();
  const bridgePy = path.join(__dirname, 'devirt_bridge.py');
  const coreDir = path.join(ROOT, 'core');
  const hardTimeoutMs = readLimit('DEOB_CANDIDATE_TIMEOUT_MS', 120000);
  const idleTimeoutMs = readLimit('DEOB_CANDIDATE_IDLE_TIMEOUT_MS', 75000);
  process.stderr.write(
    '[*] starting ' + cands.length + ' candidate(s); per-candidate limit ' +
    Math.round(hardTimeoutMs / 1000) + 's, idle limit ' +
    Math.round(idleTimeoutMs / 1000) + 's\n'
  );

  const runs = cands.map((c, i) => {
    const tag = cands.length > 1 ? `.c${i}` : '';
    const own = Object.assign({}, cfgData, {
      trace_path: cfgData.trace_path + tag,
      ppath: cfgData.ppath + tag,
      dpath: cfgData.dpath + tag,
    });
    if (tag) fs.copyFileSync(cfgData.ppath, own.ppath);
    const cfgPath = job.path(`.cfg${tag}.json`);
    fs.writeFileSync(cfgPath, JSON.stringify(own), 'utf8');
    const env = Object.assign({}, process.env, { PYTHONPATH: coreDir });
    if (c.seed !== null) env.PYTHONHASHSEED = c.seed;

    const t0 = Date.now();
    const proc = spawn(c.exe, [bridgePy, 'pipeline', cfgPath], {
      env,
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    const decoder = new StringDecoder('utf8');
    const run = {
      c, own, cfgPath, proc,
      log: '',
      lineBuffer: '',
      done: false,
      t0,
      lastOutputAt: t0,
      timedOutReason: null,
      cancelReason: null,
      stats: null,
    };

    function emit(line) {
      process.stderr.write('[candidate ' + c.label + '] ' + line + '\n');
    }

    function terminate(reason) {
      if (run.done || run.timedOutReason || run.cancelReason) return;
      run.timedOutReason = reason;
      emit('TIME LIMIT: ' + reason + '; terminating this candidate.');
      try { proc.kill('SIGTERM'); } catch {}
      run.forceKillTimer = setTimeout(() => {
        if (!run.done) {
          try { proc.kill('SIGKILL'); } catch {}
        }
      }, 2500);
      if (run.forceKillTimer.unref) run.forceKillTimer.unref();
    }

    function resetIdleTimer() {
      if (run.idleTimer) clearTimeout(run.idleTimer);
      run.idleTimer = setTimeout(() => {
        const idleFor = Date.now() - run.lastOutputAt;
        terminate('no diagnostics for ' + Math.round(idleFor / 1000) + 's');
      }, idleTimeoutMs);
      if (run.idleTimer.unref) run.idleTimer.unref();
    }

    function forwardDiagnostics(chunk, final = false) {
      if (chunk) run.lineBuffer += decoder.write(chunk);
      if (final) run.lineBuffer += decoder.end();
      let newline;
      while ((newline = run.lineBuffer.indexOf('\n')) !== -1) {
        const line = run.lineBuffer.slice(0, newline).replace(/\r$/, '');
        run.lineBuffer = run.lineBuffer.slice(newline + 1);
        run.log += line + '\n';
        emit(line);
      }
      if (final && run.lineBuffer) {
        const line = run.lineBuffer.replace(/\r$/, '');
        run.lineBuffer = '';
        run.log += line;
        emit(line);
      }
    }

    emit('started (seed ' + (c.seed === null ? 'default' : c.seed) +
      '; hard limit ' + Math.round(hardTimeoutMs / 1000) +
      's; idle limit ' + Math.round(idleTimeoutMs / 1000) + 's).');

    proc.stderr.on('data', chunk => {
      run.lastOutputAt = Date.now();
      if (!run.timedOutReason && !run.cancelReason) resetIdleTimer();
      forwardDiagnostics(chunk);
    });

    run.hardTimer = setTimeout(() => {
      terminate('hard limit of ' + Math.round(hardTimeoutMs / 1000) + 's reached');
    }, hardTimeoutMs);
    if (run.hardTimer.unref) run.hardTimer.unref();
    resetIdleTimer();

    proc.once('error', error => {
      run.spawnError = String(error && error.message || error);
      emit('spawn error: ' + run.spawnError.slice(0, 200));
    });

    run.promise = new Promise(resolve => proc.once('close', (code, signal) => {
      forwardDiagnostics(null, true);
      run.done = true;
      clearTimeout(run.hardTimer);
      if (run.idleTimer) clearTimeout(run.idleTimer);
      if (run.forceKillTimer) clearTimeout(run.forceKillTimer);
      run.code = code;
      run.signal = signal || null;
      run.secs = (Date.now() - t0) / 1000;
      run.stats = fs.existsSync(own.dpath) ? parseStats(run.log) : null;

      if (run.timedOutReason) {
        emit('stopped by limit after ' + run.secs.toFixed(1) + 's; ' +
          (run.stats ? run.stats.functions + ' functions, ' + run.stats.errors + ' unlifted blocks retained as a candidate' : 'no complete lift statistics'));
      } else if (run.cancelReason) {
        emit('cancelled after ' + run.secs.toFixed(1) + 's: ' + run.cancelReason);
      } else {
        const status = run.stats
          ? run.stats.functions + ' functions, ' + run.stats.errors + ' unlifted blocks'
          : 'no lift statistics (exit ' + code + ')';
        emit('finished in ' + run.secs.toFixed(1) + 's: ' + status);
      }
      resolve(run);
    }));

    return run;
  });

  const pending = new Set(runs);
  let winner = null;
  while (pending.size && !winner) {
    const run = await Promise.race([...pending].map(item => item.promise));
    pending.delete(run);
    if (run.stats && run.stats.errors === 0) winner = run;
  }

  if (winner) {
    for (const run of pending) {
      run.cancelReason = 'another candidate produced a complete lift';
      try { run.proc.kill('SIGTERM'); } catch {}
      run.forceKillTimer = setTimeout(() => {
        if (!run.done) {
          try { run.proc.kill('SIGKILL'); } catch {}
        }
      }, 2500);
      if (run.forceKillTimer.unref) run.forceKillTimer.unref();
    }
  }
  await Promise.all([...pending].map(run => run.promise));

  if (!winner) {
    const completed = runs.filter(run => run.stats);
    completed.sort((a, b) =>
      (a.stats.errors - b.stats.errors) ||
      (b.stats.functions - a.stats.functions) ||
      (runs.indexOf(a) - runs.indexOf(b))
    );
    winner = completed[0] || null;
  }
  if (!winner) {
    const reasons = runs.map(run =>
      run.c.label + ': ' + (run.timedOutReason || run.spawnError || ('exit ' + run.code))
    ).join('; ');
    for (const run of runs) {
      if (run.log) process.stderr.write(run.log.slice(-1200));
    }
    throw new Error('every devirtualization candidate failed. ' + reasons);
  }

  if (cands.length > 1) {
    process.stderr.write(
      '[*] keeping candidate ' + winner.c.label + ' (' +
      winner.stats.errors + ' unlifted blocks, ' + winner.stats.functions + ' functions).\n'
    );
    fs.copyFileSync(winner.own.dpath, cfgData.dpath);
  }

  for (const run of runs) {
    if (cands.length > 1) {
      for (const file of [run.own.dpath, run.own.ppath]) {
        try { fs.unlinkSync(file); } catch {}
      }
    }
    if (!process.env.DEOB_KEEP_CFG) {
      try { fs.unlinkSync(run.cfgPath); } catch {}
    }
  }
  return winner;
}

module.exports = { runCandidates, candidateList, parseStats };
