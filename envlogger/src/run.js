#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');
const https = require('https');
const http = require('http');

const ROOT = path.resolve(__dirname, '..');
const RUNTIME = path.join(ROOT, 'runtime', 'envlogger.luau');

function findLuauCandidates() {
  const list = [
    process.env.ENVLOGGER_LUAU,
    process.env.DEOB_LUAU,
    process.env.LUAU_BIN,
    '/tmp/luau',
    path.join(ROOT, '..', 'luraph-v15.1-engine', 'bin', 'luau.linux'),
    path.join(ROOT, '..', 'luraph-v15.1-engine', 'bin', 'luau'),
    path.join(ROOT, '..', 'bin', 'luau.linux'),
    path.join(ROOT, '..', 'bin', 'luau'),
    path.join(ROOT, 'bin', 'luau.linux'),
    path.join(ROOT, 'bin', 'luau'),
    // often SIGILL on Wispbyte — last resort
    path.join(ROOT, '..', 'luraph-v15-engine', 'bin', 'luau'),
    'luau',
  ].filter(Boolean);
  const out = [];
  for (const c of list) {
    try {
      if (c === 'luau') {
        const r = spawnSync('luau', ['--help'], { encoding: 'utf8', timeout: 3000 });
        if (r.status === 0 || (r.stderr || r.stdout || '').includes('Usage')) out.push('luau');
        continue;
      }
      if (!fs.existsSync(c)) continue;
      const smoke = path.join(os.tmpdir(), 'envlogger-smoke-' + process.pid + '.luau');
      fs.writeFileSync(smoke, 'print(1)\n');
      const r = spawnSync(c, [smoke], { encoding: 'utf8', timeout: 5000 });
      try { fs.unlinkSync(smoke); } catch (_) {}
      if (r.error) continue;
      if (r.signal === 'SIGILL' || r.signal === 'SIGSEGV') continue;
      if (r.status === 0 || (r.stdout || '').includes('1')) out.push(c);
    } catch (_) {}
  }
  return [...new Set(out)];
}

function fetchUrl(url, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, { headers: { 'User-Agent': 'EnvLogger/1.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(fetchUrl(res.headers.location, timeoutMs));
      }
      const chunks = [];
      res.on('data', (d) => chunks.push(d));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        if (res.statusCode !== 200) reject(new Error('HTTP ' + res.statusCode + ' for ' + url));
        else resolve(buf.toString('utf8'));
      });
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

function parseArgs(argv) {
  const args = { input: null, url: null, out: null, budget: 25, maxStmts: 8000, json: false, help: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-o' || a === '--out') args.out = argv[++i];
    else if (a === '--url') args.url = argv[++i];
    else if (a === '--budget') args.budget = Number(argv[++i]) || 25;
    else if (a === '--max-stmts') args.maxStmts = Number(argv[++i]) || 8000;
    else if (a === '--json') args.json = true;
    else if (a === '-h' || a === '--help') args.help = true;
    else if (!a.startsWith('-') && !args.input) args.input = a;
  }
  return args;
}

function longString(s) {
  let eq = 0;
  while (s.includes(']' + '='.repeat(eq) + ']')) eq += 1;
  return '[' + '='.repeat(eq) + '[' + s + ']' + '='.repeat(eq) + ']';
}

function embedSource(source) {
  const CHUNK = 32 * 1024;
  if (source.length <= CHUNK) {
    return 'local __ENVLOGGER_SOURCE = ' + longString(source) + '\n';
  }
  const parts = [];
  for (let i = 0; i < source.length; i += CHUNK) {
    parts.push(longString(source.slice(i, i + CHUNK)));
  }
  return 'local __ENVLOGGER_SOURCE = table.concat({\n  ' + parts.join(',\n  ') + '\n})\n';
}

/** Node-side ObscuraLua outer decoder. */
function tryDecodeObscura(source) {
  if (!/ObscuraLua/i.test(source)) return null;

  let N = null;
  let nMatch = source.match(/\bN\s*=\s*"([^"]{8,64})"/);
  if (nMatch) N = nMatch[1];
  if (!N) {
    nMatch = source.match(/local\s+N\s*=\s*"([^"]{8,64})"/);
    if (nMatch) N = nMatch[1];
  }
  if (!N && source.includes('mGhzTqKpJrLvNwXd')) N = 'mGhzTqKpJrLvNwXd';
  if (!N) return null;

  let encoded = null;
  const zMatch = source.match(/\bz\s*=\s*\[(=*)\[([\s\S]*?)\]\1\]/);
  if (zMatch && zMatch[2].length >= 32) encoded = zMatch[2];
  if (!encoded) {
    let best = null;
    const re = /\[(=*)\[([\s\S]*?)\]\1\]/g;
    let m;
    while ((m = re.exec(source))) {
      if (!best || m[2].length > best.length) best = m[2];
    }
    if (best && best.length >= 32) encoded = best;
  }
  if (!encoded) return null;

  let F = null;
  const fMatches = [...source.matchAll(/local\s+F\s*=\s*\{([0-9,\s]+)\}/g)];
  if (fMatches.length) {
    const raw = fMatches[fMatches.length - 1][1];
    F = raw.split(',').map((x) => Number(x.trim())).filter((n) => Number.isFinite(n));
  }
  if (!F || F.length < 8) {
    const any = source.match(/\bF\s*=\s*\{([0-9,\s]{20,})\}/);
    if (any) F = any[1].split(',').map((x) => Number(x.trim())).filter((n) => Number.isFinite(n));
  }
  if (!F || F.length < 8) return null;

  const zmap = Object.create(null);
  for (let i = 0; i < N.length; i++) zmap[N[i]] = i;
  const out = [];
  let T = 0;
  for (let n = 0; n < encoded.length; n += 2) {
    const a = zmap[encoded[n]] || 0;
    const b = n + 1 < encoded.length ? (zmap[encoded[n + 1]] || 0) : 0;
    out.push(String.fromCharCode(((a * 16 + b) ^ F[T % F.length]) & 255));
    T += 1;
  }
  const decoded = out.join('');
  if (decoded.length < 20) return null;
  if (!/function|_G|game|loadstring|local\s+/.test(decoded)) return null;
  return {
    note: 'ObscuraLua outer decoded in Node (alphabet=' + N.length + ' key=' + F.length + ' ' + encoded.length + '→' + decoded.length + ' bytes)',
    source: decoded,
  };
}

function wrapSource(source, cfg) {
  let runtime = fs.readFileSync(RUNTIME, 'utf8');
  if (!runtime.includes('local MARK = "EL|"')) {
    runtime = runtime.replace(/local MARK = [^\n]+/, 'local MARK = "EL|"');
  }
  runtime = runtime.replace(
    'local CFG = rawget(_G, "__ENVLOGGER_CFG") or {}',
    'local CFG = __ENVLOGGER_CFG or {}'
  );
  runtime = runtime.replace(
    'local source = rawget(_G, "__ENVLOGGER_SOURCE")',
    'local source = __ENVLOGGER_SOURCE'
  );
  const inject =
    'local __ENVLOGGER_CFG = { max_stmts = ' + cfg.maxStmts +
    ', time_budget = ' + cfg.budget +
    ', capture_loadstring = true, soft_errors = true }\n' +
    embedSource(source);
  return inject + runtime + '\n';
}

function extractReport(stdout, stderr) {
  const text = (stdout || '') + '\n' + (stderr || '');
  for (const beginTok of ['EL|BEGIN', '\0EL BEGIN']) {
    const endTok = beginTok.includes('\0') ? '\0EL END' : 'EL|END';
    const begin = text.indexOf(beginTok);
    const end = text.indexOf(endTok);
    if (begin >= 0 && end > begin) {
      return text.slice(begin + beginTok.length, end).trim();
    }
  }
  return text.trim() || '(no output)';
}

function runLuau(luau, tmpScript, budget) {
  return spawnSync(luau, [tmpScript], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    timeout: (budget + 20) * 1000,
    env: { ...process.env },
    killSignal: 'SIGKILL',
  });
}

function writeOut(args, full) {
  if (args.out) {
    fs.mkdirSync(path.dirname(path.resolve(args.out)), { recursive: true });
    fs.writeFileSync(args.out, full, 'utf8');
    console.error('[envlogger] wrote', args.out);
  }
  process.stdout.write(full);
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help || (!args.input && !args.url)) {
    console.log('ENVLOGGER\n  node src/run.js <file.lua> [-o out.txt] [--budget 25]');
    process.exit(args.help ? 0 : 1);
  }
  const candidates = findLuauCandidates();
  if (!candidates.length) { console.error('[envlogger] luau binary not found'); process.exit(2); }
  if (!fs.existsSync(RUNTIME)) { console.error('[envlogger] missing runtime at', RUNTIME); process.exit(2); }

  let source, label;
  if (args.url) {
    console.error('[envlogger] fetching', args.url);
    source = await fetchUrl(args.url);
    label = args.url;
  } else {
    const p = path.resolve(args.input);
    source = fs.readFileSync(p, 'utf8');
    label = p;
  }

  if (source.charCodeAt(0) === 0xFEFF) source = source.slice(1);
  source = source.replace(/\0/g, '');
  const originalBytes = source.length;
  const notes = [];

  const decoded = tryDecodeObscura(source);
  if (decoded) {
    notes.push(decoded.note);
    source = decoded.source;
    console.error('[envlogger]', decoded.note);
  } else if (/ObscuraLua/i.test(source)) {
    notes.push('ObscuraLua detected but outer decode failed (alphabet/key/blob mismatch)');
  }

  // Never feed 200KB+ into host luau (SIGILL/OOM on Wispbyte)
  if (source.length > 200000) {
    notes.push('skipped luau: payload ' + source.length + ' bytes too large for host');
    const full = 'ENVLOGGER\nsource: ' + label +
      '\nbytes: ' + originalBytes +
      '\nluau: skipped\nexit: skipped\nwrapped: 0' +
      '\nnotes: ' + notes.join(' | ') +
      '\n---\n-- ENVLOGGER report  stmts=0  source=' + originalBytes + ' bytes\n-- status: skipped_large_payload\n-- errors:\n--   payload too large; predecode did not shrink it\n';
    writeOut(args, full);
    process.exit(1);
  }

  const wrapped = wrapSource(source, args);
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'envlogger-'));
  const tmpScript = path.join(tmpDir, 'run.luau');
  fs.writeFileSync(tmpScript, wrapped, 'utf8');
  console.error('[envlogger] wrapped', wrapped.length, 'bytes source', source.length);

  let res = null;
  let usedLuau = candidates[0];
  const attempts = [];
  for (const luau of candidates) {
    usedLuau = luau;
    res = runLuau(luau, tmpScript, args.budget);
    attempts.push(path.basename(luau) + ':status=' + res.status + ':signal=' + (res.signal || '-') + ':err=' + ((res.error && res.error.code) || '-'));
    if (res.status === 0 || (res.stdout && (res.stdout.includes('EL|') || res.stdout.includes('ENVLOGGER report')))) break;
    if (res.signal === 'SIGILL' || res.signal === 'SIGSEGV' || res.signal === 'SIGBUS' ||
        (res.status == null && !(res.stdout || '').trim())) {
      console.error('[envlogger] luau', luau, 'signal=' + res.signal, 'trying next');
      continue;
    }
    break;
  }
  notes.push('luau_attempts=' + attempts.join(','));

  const report = extractReport(res.stdout, res.stderr);
  const exitLine = 'exit: ' + res.status +
    (res.signal ? (' signal: ' + res.signal) : '') +
    (res.error ? (' error: ' + res.error.message) : '');

  const full = 'ENVLOGGER\nsource: ' + label +
    '\nbytes: ' + originalBytes +
    (source.length !== originalBytes ? ('\ndecoded_bytes: ' + source.length) : '') +
    '\nluau: ' + usedLuau +
    '\n' + exitLine +
    '\nwrapped: ' + wrapped.length +
    '\nnotes: ' + notes.join(' | ') +
    '\n---\n' + report + '\n';

  writeOut(args, full);
  try { fs.unlinkSync(tmpScript); fs.rmdirSync(tmpDir); } catch (_) {}
  process.exit((report.includes('-- ENVLOGGER report') || res.status === 0) ? 0 : 1);
}

main().catch((e) => { console.error('[envlogger] fatal', e); process.exit(1); });
