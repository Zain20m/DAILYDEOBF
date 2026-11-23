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

function findLuau() {
  const candidates = [
    process.env.ENVLOGGER_LUAU,
    process.env.DEOB_LUAU,
    path.join(ROOT, '..', 'luraph-v15-engine', 'bin', 'luau'),
    path.join(ROOT, '..', 'luraph-v15.1-engine', 'bin', 'luau.linux'),
    path.join(ROOT, '..', 'luraph-v15.1-engine', 'bin', 'luau'),
    path.join(ROOT, '..', 'bin', 'luau'),
    path.join(ROOT, 'bin', 'luau'),
    path.join(ROOT, 'bin', 'luau.linux'),
    '/tmp/luau',
    'luau',
  ].filter(Boolean);
  for (const c of candidates) {
    try {
      if (c === 'luau') {
        const r = spawnSync('luau', ['--help'], { encoding: 'utf8' });
        if (r.status === 0 || (r.stderr || r.stdout || '').includes('Usage')) return 'luau';
      } else if (fs.existsSync(c)) {
        try { fs.accessSync(c, fs.constants.X_OK); } catch { continue; }
        return c;
      }
    } catch (_) {}
  }
  return null;
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

/** Split large sources into concatenated long-strings to avoid one huge parse node / OOM. */
function embedSource(source) {
  const CHUNK = 48 * 1024;
  if (source.length <= CHUNK) {
    return 'local __ENVLOGGER_SOURCE = ' + longString(source) + '\n';
  }
  const parts = [];
  for (let i = 0; i < source.length; i += CHUNK) {
    parts.push(longString(source.slice(i, i + CHUNK)));
  }
  return 'local __ENVLOGGER_SOURCE = table.concat({\n  ' + parts.join(',\n  ') + '\n})\n';
}

function wrapSource(source, cfg) {
  let runtime = fs.readFileSync(RUNTIME, 'utf8');
  // Prefer ASCII markers (null bytes can break some pipes / binaries)
  runtime = runtime.replace(/local MARK = "\\0EL "/g, 'local MARK = "EL|"');
  runtime = runtime.replace(/\0EL /g, 'EL|');
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

function summarize(reportText) {
  const summary = { stmts: 0, status: 'unknown', services: [], urls: [], remotes: [], loadstrings: [], errors: [], unknownGlobals: [] };
  let sec = null;
  for (const line of reportText.split(/\r?\n/)) {
    if (line.startsWith('-- ENVLOGGER report')) {
      const m = line.match(/stmts=(\d+)/);
      if (m) summary.stmts = Number(m[1]);
    } else if (line.startsWith('-- status:')) summary.status = line.slice(11).trim();
    else if (line.startsWith('-- urls:')) sec = 'urls';
    else if (line.startsWith('-- services:')) sec = 'services';
    else if (line.startsWith('-- remotes:')) sec = 'remotes';
    else if (line.startsWith('-- loadstring')) sec = 'loadstrings';
    else if (line.startsWith('-- errors:')) sec = 'errors';
    else if (line.startsWith('-- unknown')) sec = 'unknownGlobals';
    else if (line.startsWith('--   ') && sec && Array.isArray(summary[sec])) {
      summary[sec].push(line.replace(/^--\s+/, '').trim());
    } else if (line.startsWith('-- ')) sec = null;
  }
  return summary;
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

async function main() {
  const args = parseArgs(process.argv);
  if (args.help || (!args.input && !args.url)) {
    console.log('ENVLOGGER\n  node src/run.js <file.lua> [-o out.txt] [--budget 25]\n  node src/run.js --url <raw-url>');
    process.exit(args.help ? 0 : 1);
  }
  const luau = findLuau();
  if (!luau) { console.error('[envlogger] luau binary not found'); process.exit(2); }
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

  const wrapped = wrapSource(source, args);
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'envlogger-'));
  const tmpScript = path.join(tmpDir, 'run.luau');
  fs.writeFileSync(tmpScript, wrapped, 'utf8');
  console.error('[envlogger] wrapped', wrapped.length, 'bytes ->', tmpScript);

  const res = spawnSync(luau, [tmpScript], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    timeout: (args.budget + 20) * 1000,
    env: { ...process.env },
    killSignal: 'SIGKILL',
  });

  const report = extractReport(res.stdout, res.stderr);
  const exitLine = 'exit: ' + res.status +
    (res.signal ? (' signal: ' + res.signal) : '') +
    (res.error ? (' error: ' + res.error.message) : '');

  const full = 'ENVLOGGER\nsource: ' + label + '\nbytes: ' + source.length + '\nluau: ' + luau +
    '\n' + exitLine + '\nwrapped: ' + wrapped.length + '\n---\n' + report + '\n';

  if (args.out) {
    fs.mkdirSync(path.dirname(path.resolve(args.out)), { recursive: true });
    fs.writeFileSync(args.out, full, 'utf8');
    console.error('[envlogger] wrote', args.out);
  }
  if (args.json) {
    const summary = summarize(report);
    summary.source = label;
    summary.bytes = source.length;
    summary.exit = res.status;
    summary.signal = res.signal || null;
    console.log(JSON.stringify(summary, null, 2));
  } else process.stdout.write(full);

  try {
    fs.unlinkSync(tmpScript);
    fs.rmdirSync(tmpDir);
  } catch (_) {}

  const ok = report.includes('-- ENVLOGGER report') || res.status === 0;
  process.exit(ok ? 0 : 1);
}

main().catch((e) => { console.error('[envlogger] fatal', e); process.exit(1); });
