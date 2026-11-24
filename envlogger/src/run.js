#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const RUNTIME = path.join(ROOT, 'runtime', 'envlogger.luau');

function findLuau() {
  const list = [
    process.env.ENVLOGGER_LUAU, process.env.DEOB_LUAU, process.env.LUAU_BIN,
    path.join(ROOT, '..', 'luraph-v15.1-engine', 'bin', 'luau.linux'),
    path.join(ROOT, '..', 'luraph-v15.1-engine', 'bin', 'luau'),
    path.join(ROOT, '..', 'bin', 'luau'), path.join(ROOT, '..', 'luraph-v15-engine', 'bin', 'luau'),
    path.join(ROOT, '..', 'luraph-v14.7-engine', 'bin', 'luau'), '/tmp/luau', 'luau',
  ].filter(Boolean);
  const smoke = path.join(os.tmpdir(), 'el-smoke-' + process.pid + '.luau');
  fs.writeFileSync(smoke, 'print(1)\n');
  for (const c of list) {
    try {
      if (c !== 'luau' && !fs.existsSync(c)) continue;
      const r = spawnSync(c, [smoke], { encoding: 'utf8', timeout: 5000 });
      if (!r.error && r.status === 0 && (r.stdout || '').includes('1')) {
        try { fs.unlinkSync(smoke); } catch (_) {}
        return c;
      }
    } catch (_) {}
  }
  try { fs.unlinkSync(smoke); } catch (_) {}
  return null;
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

const RULES = [
  [/ObscuraLua|obscura\.lua/i, 'ObscuraLua'],
  [/LPH[_-]?|Luraph|LPH-Z/i, 'Luraph'],
  [/luarmor\.net|script_key\s*=/i, 'Luarmor'],
  [/IronBrew|IB2/i, 'IronBrew'],
  [/Centurion/i, 'Centurion'],
  [/Moonsec|MoonSec/i, 'Moonsec'],
  [/vantarmor/i, 'Vantarmor'],
  [/polsec\.net|Fulcrum/i, 'Polsec/Fulcrum'],
  [/JNKIE|jnkie/i, 'JNKIE'],
  [/Voltfuscator/i, 'Voltfuscator'],
  [/luavify/i, 'Luavify'],
];

function fingerprint(src) {
  const hits = [];
  for (const [re, name] of RULES) if (re.test(src)) hits.push(name);
  return hits[0] || 'unknown / custom';
}

function staticBlock(src, label) {
  const urls = [...new Set((src.match(/https?:\/\/[^\s"'`\)\]\}>]+/gi) || []).map(u => u.replace(/[.,;:]+$/, '')))].slice(0, 30);
  const keys = [...src.matchAll(/(?:script_key|SCRIPT_KEY)\s*=\s*["']([^"']+)["']/gi)].map(m => m[1]);
  const services = [...new Set([...src.matchAll(/GetService\s*\(\s*["']([^"']+)["']\s*\)/g)].map(m => m[1]))];
  const count = (re) => (src.match(re) || []).length;
  const obf = fingerprint(src);
  return [
    '-- ENVLOGGER static report',
    '-- source: ' + label,
    '-- bytes: ' + src.length,
    '-- obfuscator: ' + obf,
    '-- sha256: ' + crypto.createHash('sha256').update(src).digest('hex').slice(0, 16),
    '-- counts:',
    `--   loadstring=${count(/\bloadstring\b/gi)} HttpGet=${count(/\bHttpGet\b/g)} getgenv=${count(/\bgetgenv\b/g)} bit32=${count(/\bbit32\b/g)}`,
    `--   string.char=${count(/string\.char/g)} hooks=${count(/\bhookfunction\b|\bnewcclosure\b/g)} long_strings=${count(/\[=*\[/g)}`,
    keys.length ? '-- keys:\n' + keys.map(k => '--   ' + k).join('\n') : '-- keys: (none)',
    urls.length ? '-- urls:\n' + urls.map(u => '--   ' + u).join('\n') : '-- urls: (none)',
    services.length ? '-- services:\n' + services.map(s => '--   ' + s).join('\n') : '-- services: (none literal)',
  ].join('\n');
}

function tryDecodeObscura(source) {
  if (!/ObscuraLua/i.test(source)) return null;
  let N = (source.match(/\bN\s*=\s*"([^"]{8,64})"/) || [])[1];
  if (!N && source.includes('mGhzTqKpJrLvNwXd')) N = 'mGhzTqKpJrLvNwXd';
  if (!N) return null;
  const zMatch = source.match(/\bz\s*=\s*\[(=*)\[([\s\S]*?)\]\1\]/);
  if (!zMatch) return null;
  const encoded = zMatch[2];
  const fMatches = [...source.matchAll(/local\s+F\s*=\s*\{([0-9,\s]+)\}/g)];
  if (!fMatches.length) return null;
  const F = fMatches[fMatches.length - 1][1].split(',').map(x => Number(x.trim())).filter(Number.isFinite);
  if (F.length < 8) return null;
  const zmap = Object.create(null);
  for (let i = 0; i < N.length; i++) zmap[N[i]] = i;
  let out = '', T = 0;
  for (let n = 0; n < encoded.length; n += 2) {
    const a = zmap[encoded[n]] || 0;
    const b = n + 1 < encoded.length ? (zmap[encoded[n + 1]] || 0) : 0;
    out += String.fromCharCode(((a * 16 + b) ^ F[T % F.length]) & 255);
    T++;
  }
  if (out.length < 20) return null;
  return { note: `Obscura decoded ${encoded.length}→${out.length}`, source: out };
}

function wrap(source, cfg) {
  let runtime = fs.readFileSync(RUNTIME, 'utf8');
  return (
    `local __ENVLOGGER_CFG = { max_stmts = ${cfg.maxStmts}, time_budget = ${cfg.budget}, capture_loadstring = true }\n` +
    embedSource(source) + runtime + '\n'
  );
}

function extract(stdout, stderr) {
  const text = (stdout || '') + '\n' + (stderr || '');
  const b = text.indexOf('EL|BEGIN');
  const e = text.indexOf('EL|END');
  if (b >= 0 && e > b) return text.slice(b + 8, e).trim();
  return text.trim();
}

function parseArgs(argv) {
  const args = { input: null, out: null, budget: 25, maxStmts: 12000 };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '-o') args.out = argv[++i];
    else if (argv[i] === '--budget') args.budget = Number(argv[++i]) || 25;
    else if (!argv[i].startsWith('-') && !args.input) args.input = argv[i];
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv);
  if (!args.input) { console.error('usage: run.js <file> -o out'); process.exit(1); }
  let source = fs.readFileSync(path.resolve(args.input), 'utf8').replace(/^\uFEFF/, '').replace(/\0/g, '');
  const label = path.resolve(args.input);
  const original = source.length;
  const notes = [];
  const staticR = staticBlock(source, label);
  const decoded = tryDecodeObscura(source);
  if (decoded) { notes.push(decoded.note); source = decoded.source; }

  let dyn = '-- (dynamic not run)';
  let luau = 'none';
  let exitLine = 'exit: skipped';
  let wrapped = 0;
  const bin = findLuau();
  if (bin && source.length <= 250000 && fs.existsSync(RUNTIME)) {
    luau = bin;
    const w = wrap(source, args);
    wrapped = w.length;
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'envlogger-'));
    const script = path.join(dir, 'run.luau');
    fs.writeFileSync(script, w);
    const res = spawnSync(bin, [script], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: (args.budget + 20) * 1000 });
    exitLine = 'exit: ' + res.status + (res.signal ? ' signal: ' + res.signal : '');
    dyn = extract(res.stdout, res.stderr) || '-- empty dynamic';
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {}
  } else if (!bin) notes.push('no healthy luau');
  else if (source.length > 250000) notes.push('payload too large for dynamic');

  const full = [
    'ENVLOGGER',
    'source: ' + label,
    'bytes: ' + original,
    source.length !== original ? 'decoded_bytes: ' + source.length : null,
    'obfuscator: ' + fingerprint(fs.readFileSync(path.resolve(args.input), 'utf8')),
    'luau: ' + luau,
    exitLine,
    'wrapped: ' + wrapped,
    'notes: ' + (notes.join(' | ') || 'none'),
    '---',
    staticR,
    '',
    '-- ==== dynamic sandbox ====',
    dyn,
    '',
  ].filter(x => x != null).join('\n');

  if (args.out) {
    fs.mkdirSync(path.dirname(path.resolve(args.out)), { recursive: true });
    fs.writeFileSync(args.out, full);
  }
  process.stdout.write(full);
  process.exit(0);
}
main();
