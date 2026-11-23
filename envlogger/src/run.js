#!/usr/bin/env node
'use strict';
/**
 * ENVLOGGER runner — static fingerprint + dynamic sandbox for any obfuscator.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');
const https = require('https');
const http = require('http');
const crypto = require('crypto');

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
      if (r.error || r.signal === 'SIGILL' || r.signal === 'SIGSEGV') continue;
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
  if (source.length <= CHUNK) return 'local __ENVLOGGER_SOURCE = ' + longString(source) + '\n';
  const parts = [];
  for (let i = 0; i < source.length; i += CHUNK) parts.push(longString(source.slice(i, i + CHUNK)));
  return 'local __ENVLOGGER_SOURCE = table.concat({\n  ' + parts.join(',\n  ') + '\n})\n';
}

const OBFUSCATOR_RULES = [
  { name: 'ObscuraLua', re: /ObscuraLua|obscura\.lua/i, weight: 10 },
  { name: 'Luraph', re: /LPH[_-]?|Luraph|LPH-Z|pGo\s*=|Ryn\s*=/i, weight: 10 },
  { name: 'Luarmor', re: /luarmor\.net|script_key\s*=|LRM_|Luarmor/i, weight: 10 },
  { name: 'IronBrew', re: /IronBrew|IB2|Wrapf|IronBrew2/i, weight: 9 },
  { name: 'Centurion', re: /Centurion|CENTURION/i, weight: 9 },
  { name: 'Moonsec', re: /Moonsec|MoonSec/i, weight: 9 },
  { name: 'Prometheus', re: /Prometheus|prometheus/i, weight: 8 },
  { name: 'PSU', re: /PSU\s*Obfuscator|psu\.dev/i, weight: 8 },
  { name: 'Synapse Xen', re: /Xen\s*Obfuscator|SYNAPSE/i, weight: 7 },
  { name: 'Shadow', re: /Shadow\s*Obfuscator/i, weight: 7 },
  { name: 'Aqua', re: /Aqua\s*Obfuscator/i, weight: 7 },
  { name: 'Vantarmor', re: /vantarmor|Vantarmor/i, weight: 8 },
  { name: 'Polsec/Fulcrum', re: /polsec\.net|Fulcrum|fulcrum/i, weight: 8 },
  { name: 'JNKIE', re: /JNKIE|jnkie\.com/i, weight: 8 },
  { name: 'LuaProtect', re: /luaprotect|LuaProtect/i, weight: 8 },
  { name: 'Voltfuscator', re: /Voltfuscator|voltfuscator/i, weight: 8 },
  { name: 'Luavify', re: /luavify|Luavify/i, weight: 8 },
  { name: 'VM bytecode blob', re: /string\.char\s*\(\s*[\d,\s]{40,}/i, weight: 3 },
  { name: 'Heavy minification', re: /\b_[lLI1]{3,}\d*\b/, weight: 2 },
];

function fingerprint(source) {
  const hits = [];
  for (const rule of OBFUSCATOR_RULES) {
    if (rule.re.test(source)) hits.push({ name: rule.name, weight: rule.weight });
  }
  hits.sort((a, b) => b.weight - a.weight);
  const primary = hits[0] ? hits[0].name : 'unknown / plain or custom';
  return { primary, hits: hits.map((h) => h.name) };
}

function extractUrls(source) {
  const urls = new Set();
  const re = /https?:\/\/[^\s"'`\)\]\}>]+/gi;
  let m;
  while ((m = re.exec(source))) {
    let u = m[0].replace(/[.,;:]+$/, '');
    if (u.length > 12 && u.length < 500) urls.add(u);
  }
  return [...urls].slice(0, 40);
}

function extractKeys(source) {
  const keys = new Set();
  const patterns = [
    /script_key\s*=\s*["']([^"']+)["']/gi,
    /SCRIPT_KEY\s*=\s*["']([^"']+)["']/gi,
    /getgenv\(\)\.script_key\s*=\s*["']([^"']+)["']/gi,
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(source))) keys.add(m[1]);
  }
  return [...keys].slice(0, 10);
}

function countMatches(source, re) {
  const m = source.match(re);
  return m ? m.length : 0;
}

function staticAnalyze(source) {
  const fp = fingerprint(source);
  const urls = extractUrls(source);
  const keys = extractKeys(source);
  const stats = {
    bytes: source.length,
    lines: source.split(/\r?\n/).length,
    loadstring: countMatches(source, /\bloadstring\b/gi) + countMatches(source, /\bload\s*\(/g),
    getfenv: countMatches(source, /\bgetfenv\b/g),
    setfenv: countMatches(source, /\bsetfenv\b/g),
    getgenv: countMatches(source, /\bgetgenv\b/g),
    HttpGet: countMatches(source, /\bHttpGet\b/g) + countMatches(source, /\brequest\b/g),
    bit32: countMatches(source, /\bbit32\b/g),
    string_char: countMatches(source, /string\.char/g),
    string_byte: countMatches(source, /string\.byte/g),
    buffer: countMatches(source, /\bbuffer\./g),
    debug_lib: countMatches(source, /\bdebug\.(?:getinfo|getupvalue|setupvalue|sethook|gethook)/g),
    newcclosure: countMatches(source, /\bnewcclosure\b/g),
    hookfunction: countMatches(source, /\bhookfunction\b|\bhookmetamethod\b/g),
    pcall: countMatches(source, /\bpcall\b/g),
    long_strings: countMatches(source, /\[=*\[/g),
  };

  const antivm = [];
  if (/typeof\s*\(\s*game\s*\)/i.test(source)) antivm.push('typeof(game) fingerprint');
  if (/_VERSION\s*[=~]=?\s*["']Luau["']/i.test(source)) antivm.push('_VERSION == Luau check');
  if (/debug\.getinfo|debug\.gethook/i.test(source)) antivm.push('debug library probe');
  if (/__PID|__ENT|__venv|envlog/i.test(source)) antivm.push('envlogger/sandbox marker scan');
  if (/identifyexecutor|getexecutorname/i.test(source)) antivm.push('executor identity probe');
  if (/newcclosure|hookfunction|hookmetamethod/i.test(source)) antivm.push('executor API / hook usage');

  const services = [];
  const svcRe = /GetService\s*\(\s*["']([^"']+)["']\s*\)/g;
  let sm;
  const svcSet = new Set();
  while ((sm = svcRe.exec(source))) svcSet.add(sm[1]);
  for (const s of svcSet) services.push(s);

  return { fp, urls, keys, stats, antivm, services };
}

function formatStaticReport(analysis, label) {
  const lines = [];
  lines.push('-- ENVLOGGER static report');
  lines.push('-- source: ' + label);
  lines.push('-- bytes: ' + analysis.stats.bytes);
  lines.push('-- lines: ' + analysis.stats.lines);
  lines.push('-- obfuscator: ' + analysis.fp.primary);
  if (analysis.fp.hits.length) lines.push('-- signatures: ' + analysis.fp.hits.join(', '));
  lines.push('-- sha256: ' + crypto.createHash('sha256').update(analysis._source || '').digest('hex').slice(0, 16));
  lines.push('-- counts:');
  const c = analysis.stats;
  lines.push('--   loadstring/load=' + c.loadstring + '  HttpGet/request=' + c.HttpGet + '  getgenv=' + c.getgenv + '  bit32=' + c.bit32);
  lines.push('--   string.char=' + c.string_char + '  string.byte=' + c.string_byte + '  buffer=' + c.buffer + '  pcall=' + c.pcall);
  lines.push('--   debug=' + c.debug_lib + '  newcclosure=' + c.newcclosure + '  hooks=' + c.hookfunction + '  long_strings=' + c.long_strings);
  if (analysis.keys.length) {
    lines.push('-- keys/script_key:');
    for (const k of analysis.keys) lines.push('--   ' + k);
  }
  if (analysis.urls.length) {
    lines.push('-- urls:');
    for (const u of analysis.urls) lines.push('--   ' + u);
  } else {
    lines.push('-- urls: (none literal)');
  }
  if (analysis.services.length) {
    lines.push('-- services (literal GetService):');
    for (const s of analysis.services) lines.push('--   ' + s);
  }
  if (analysis.antivm.length) {
    lines.push('-- antivm / sandbox probes:');
    for (const a of analysis.antivm) lines.push('--   ' + a);
  } else {
    lines.push('-- antivm / sandbox probes: (none obvious)');
  }
  return lines.join('\n');
}

function tryDecodeObscura(source) {
  if (!/ObscuraLua/i.test(source)) return null;
  let N = null;
  let nMatch = source.match(/\bN\s*=\s*"([^"]{8,64})"/);
  if (nMatch) N = nMatch[1];
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
    F = fMatches[fMatches.length - 1][1].split(',').map((x) => Number(x.trim())).filter(Number.isFinite);
  }
  if (!F || F.length < 8) {
    const any = source.match(/\bF\s*=\s*\{([0-9,\s]{20,})\}/);
    if (any) F = any[1].split(',').map((x) => Number(x.trim())).filter(Number.isFinite);
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
    T++;
  }
  const decoded = out.join('');
  if (decoded.length < 20 || !/function|_G|game|loadstring|local\s+/.test(decoded)) return null;
  return { note: 'ObscuraLua outer decoded (' + encoded.length + '→' + decoded.length + ')', source: decoded };
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
  return (
    'local __ENVLOGGER_CFG = { max_stmts = ' + cfg.maxStmts +
    ', time_budget = ' + cfg.budget +
    ', capture_loadstring = true, soft_errors = true }\n' +
    embedSource(source) +
    runtime + '\n'
  );
}

function extractReport(stdout, stderr) {
  const text = (stdout || '') + '\n' + (stderr || '');
  for (const beginTok of ['EL|BEGIN', '\0EL BEGIN']) {
    const endTok = beginTok.includes('\0') ? '\0EL END' : 'EL|END';
    const begin = text.indexOf(beginTok);
    const end = text.indexOf(endTok);
    if (begin >= 0 && end > begin) return text.slice(begin + beginTok.length, end).trim();
  }
  return '';
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

async function main() {
  const args = parseArgs(process.argv);
  if (args.help || (!args.input && !args.url)) {
    console.log('ENVLOGGER\n  node src/run.js <file.lua> [-o out.txt] [--budget 25]');
    process.exit(args.help ? 0 : 1);
  }

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

  const analysis = staticAnalyze(source);
  analysis._source = source;
  const staticReport = formatStaticReport(analysis, label);
  console.error('[envlogger] obfuscator:', analysis.fp.primary, 'bytes:', originalBytes);

  let dynSource = source;
  const decoded = tryDecodeObscura(source);
  if (decoded) {
    notes.push(decoded.note);
    dynSource = decoded.source;
    const inner = staticAnalyze(dynSource);
    notes.push('inner_obfuscator=' + inner.fp.primary);
  }

  let dynamicReport = '';
  let usedLuau = 'none';
  let exitLine = 'exit: skipped';
  let wrappedLen = 0;

  const candidates = findLuauCandidates();
  const canDynamic = dynSource.length <= 200000 && candidates.length > 0 && fs.existsSync(RUNTIME);

  if (!canDynamic) {
    if (dynSource.length > 200000) notes.push('dynamic skipped: payload too large (' + dynSource.length + ')');
    if (!candidates.length) notes.push('dynamic skipped: no working luau binary');
  } else {
    const wrapped = wrapSource(dynSource, args);
    wrappedLen = wrapped.length;
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'envlogger-'));
    const tmpScript = path.join(tmpDir, 'run.luau');
    fs.writeFileSync(tmpScript, wrapped, 'utf8');

    let res = null;
    const attempts = [];
    for (const luau of candidates) {
      usedLuau = luau;
      res = runLuau(luau, tmpScript, args.budget);
      attempts.push(path.basename(luau) + ':' + (res.signal || res.status));
      if (res.status === 0 || (res.stdout && res.stdout.includes('EL|'))) break;
      if (res.signal === 'SIGILL' || res.signal === 'SIGSEGV' || res.signal === 'SIGBUS' ||
          (res.status == null && !(res.stdout || '').trim())) {
        continue;
      }
      break;
    }
    notes.push('luau_attempts=' + attempts.join(','));
    exitLine = 'exit: ' + res.status + (res.signal ? ' signal: ' + res.signal : '');
    dynamicReport = extractReport(res.stdout, res.stderr);
    if (!dynamicReport) {
      dynamicReport = '-- dynamic: no EL markers (luau crashed or empty)\n-- stderr: ' +
        String(res.stderr || '').slice(0, 400);
    }
    try { fs.unlinkSync(tmpScript); fs.rmdirSync(tmpDir); } catch (_) {}
  }

  const full = [
    'ENVLOGGER',
    'source: ' + label,
    'bytes: ' + originalBytes,
    (dynSource.length !== originalBytes ? 'decoded_bytes: ' + dynSource.length : null),
    'obfuscator: ' + analysis.fp.primary,
    'luau: ' + usedLuau,
    exitLine,
    'wrapped: ' + wrappedLen,
    'notes: ' + (notes.join(' | ') || 'none'),
    '---',
    staticReport,
    dynamicReport ? '\n-- ==== dynamic sandbox ====\n' + dynamicReport : '\n-- ==== dynamic sandbox ====\n-- (not run)',
    '',
  ].filter((x) => x != null).join('\n');

  if (args.out) {
    fs.mkdirSync(path.dirname(path.resolve(args.out)), { recursive: true });
    fs.writeFileSync(args.out, full, 'utf8');
    console.error('[envlogger] wrote', args.out);
  }
  process.stdout.write(full);
  process.exit(0);
}

main().catch((e) => { console.error('[envlogger] fatal', e); process.exit(1); });
