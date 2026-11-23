'use strict';
/**
 * ENVLOGGER Discord integration for DAILYDEOBF (.l command)
 * Always produces a rich static report. Dynamic luau is best-effort.
 */
const { spawn } = require('node:child_process');
const fs = require('node:fs/promises');
const fssync = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

const OBFUSCATOR_RULES = [
  { name: 'ObscuraLua', re: /ObscuraLua|obscura\.lua/i, weight: 10 },
  { name: 'Luraph', re: /LPH[_-]?|Luraph|LPH-Z|\bpGo\b|\bRyn\b/i, weight: 10 },
  { name: 'Luarmor', re: /luarmor\.net|script_key\s*=|LRM_|Luarmor/i, weight: 10 },
  { name: 'IronBrew', re: /IronBrew|IB2|Wrapf|IronBrew2/i, weight: 9 },
  { name: 'Centurion', re: /Centurion|CENTURION/i, weight: 9 },
  { name: 'Moonsec', re: /Moonsec|MoonSec/i, weight: 9 },
  { name: 'Prometheus', re: /Prometheus/i, weight: 8 },
  { name: 'PSU', re: /PSU\s*Obfuscator|psu\.dev/i, weight: 8 },
  { name: 'Vantarmor', re: /vantarmor|Vantarmor/i, weight: 8 },
  { name: 'Polsec/Fulcrum', re: /polsec\.net|Fulcrum|fulcrum/i, weight: 8 },
  { name: 'JNKIE', re: /JNKIE|jnkie\.com/i, weight: 8 },
  { name: 'LuaProtect', re: /luaprotect|LuaProtect/i, weight: 8 },
  { name: 'Voltfuscator', re: /Voltfuscator|voltfuscator/i, weight: 8 },
  { name: 'Luavify', re: /luavify|Luavify/i, weight: 8 },
  { name: 'Synapse Xen', re: /Xen\s*Obfuscator/i, weight: 7 },
  { name: 'VM bytecode blob', re: /string\.char\s*\(\s*[\d,\s]{40,}/i, weight: 3 },
  { name: 'Heavy minification', re: /\b_[lLI1]{3,}\d*\b/, weight: 2 },
];

function countRe(src, re) {
  const m = src.match(re);
  return m ? m.length : 0;
}

function analyze(source) {
  const hits = [];
  for (const r of OBFUSCATOR_RULES) {
    if (r.re.test(source)) hits.push(r);
  }
  hits.sort((a, b) => b.weight - a.weight);
  const primary = hits[0] ? hits[0].name : 'unknown / plain or custom';
  const signatures = hits.map((h) => h.name);

  const urls = [];
  const urlRe = /https?:\/\/[^\s"'`\)\]\}>]+/gi;
  let m;
  const urlSet = new Set();
  while ((m = urlRe.exec(source))) {
    const u = m[0].replace(/[.,;:]+$/, '');
    if (u.length > 12 && u.length < 500) urlSet.add(u);
  }
  for (const u of urlSet) urls.push(u);

  const keys = [];
  const keyRe = /(?:script_key|SCRIPT_KEY)\s*=\s*["']([^"']+)["']/gi;
  while ((m = keyRe.exec(source))) keys.push(m[1]);

  const services = [];
  const svcRe = /GetService\s*\(\s*["']([^"']+)["']\s*\)/g;
  const svcSet = new Set();
  while ((m = svcRe.exec(source))) svcSet.add(m[1]);
  for (const s of svcSet) services.push(s);

  const antivm = [];
  if (/typeof\s*\(\s*game\s*\)/i.test(source)) antivm.push('typeof(game) fingerprint');
  if (/_VERSION\s*[=~]=?\s*["']Luau["']/i.test(source)) antivm.push('_VERSION Luau check');
  if (/debug\.(getinfo|gethook|getupvalue)/i.test(source)) antivm.push('debug library probe');
  if (/__PID|__ENT|__venv|envlog/i.test(source)) antivm.push('envlogger marker scan');
  if (/identifyexecutor|getexecutorname/i.test(source)) antivm.push('executor identity probe');
  if (/newcclosure|hookfunction|hookmetamethod/i.test(source)) antivm.push('executor hook APIs');

  const stats = {
    bytes: source.length,
    lines: source.split(/\r?\n/).length,
    loadstring: countRe(source, /\bloadstring\b/gi) + countRe(source, /\bload\s*\(/g),
    http: countRe(source, /\bHttpGet\b/g) + countRe(source, /\brequest\b/g),
    getgenv: countRe(source, /\bgetgenv\b/g),
    bit32: countRe(source, /\bbit32\b/g),
    stringChar: countRe(source, /string\.char/g),
    stringByte: countRe(source, /string\.byte/g),
    buffer: countRe(source, /\bbuffer\./g),
    debug: countRe(source, /\bdebug\.(?:getinfo|getupvalue|setupvalue|sethook|gethook)/g),
    hooks: countRe(source, /\bnewcclosure\b|\bhookfunction\b|\bhookmetamethod\b/g),
    pcall: countRe(source, /\bpcall\b/g),
    longStrings: countRe(source, /\[=*\[/g),
  };

  return { primary, signatures, urls: urls.slice(0, 40), keys: keys.slice(0, 10), services, antivm, stats };
}

function buildTextReport(label, source, analysis, dynamicLog) {
  const sha = crypto.createHash('sha256').update(source).digest('hex').slice(0, 16);
  const lines = [];
  lines.push('ENVLOGGER');
  lines.push('source: ' + label);
  lines.push('bytes: ' + analysis.stats.bytes);
  lines.push('obfuscator: ' + analysis.primary);
  lines.push('sha256: ' + sha);
  lines.push('---');
  lines.push('-- ENVLOGGER static report');
  lines.push('-- obfuscator: ' + analysis.primary);
  if (analysis.signatures.length) lines.push('-- signatures: ' + analysis.signatures.join(', '));
  lines.push('-- lines: ' + analysis.stats.lines);
  lines.push('-- counts:');
  const s = analysis.stats;
  lines.push('--   loadstring/load=' + s.loadstring + '  HttpGet/request=' + s.http + '  getgenv=' + s.getgenv + '  bit32=' + s.bit32);
  lines.push('--   string.char=' + s.stringChar + '  string.byte=' + s.stringByte + '  buffer=' + s.buffer + '  pcall=' + s.pcall);
  lines.push('--   debug=' + s.debug + '  hooks=' + s.hooks + '  long_strings=' + s.longStrings);
  if (analysis.keys.length) {
    lines.push('-- keys/script_key:');
    for (const k of analysis.keys) lines.push('--   ' + k);
  }
  if (analysis.urls.length) {
    lines.push('-- urls:');
    for (const u of analysis.urls) lines.push('--   ' + u);
  } else lines.push('-- urls: (none literal)');
  if (analysis.services.length) {
    lines.push('-- services (literal):');
    for (const x of analysis.services) lines.push('--   ' + x);
  }
  if (analysis.antivm.length) {
    lines.push('-- antivm / probes:');
    for (const a of analysis.antivm) lines.push('--   ' + a);
  } else lines.push('-- antivm / probes: (none obvious)');

  if (dynamicLog && dynamicLog.trim()) {
    lines.push('');
    lines.push('-- ==== dynamic sandbox ====');
    lines.push(dynamicLog.trim());
  } else {
    lines.push('');
    lines.push('-- ==== dynamic sandbox ====');
    lines.push('-- not available (luau failed or skipped); static report above is complete');
  }
  lines.push('');
  return lines.join('\n');
}

function brief(items, empty, limit = 900) {
  if (!items || !items.length) return empty;
  const value = items.slice(0, 12).map((x) => '• ' + String(x).slice(0, 140)).join('\n');
  return (value + (items.length > 12 ? '\n… +' + (items.length - 12) + ' more' : '')).slice(0, limit);
}

async function tryDynamic(root, inputPath, outputPath, budget) {
  const runner = path.join(root, 'src', 'run.js');
  try { await fs.access(runner); } catch { return { log: '', note: 'run.js missing' }; }

  const candidates = [
    process.env.ENVLOGGER_LUAU,
    process.env.DEOB_LUAU,
    process.env.LUAU_BIN,
    path.join(root, '..', 'luraph-v15.1-engine', 'bin', 'luau.linux'),
    path.join(root, '..', 'luraph-v15.1-engine', 'bin', 'luau'),
    path.join(root, '..', 'bin', 'luau.linux'),
    path.join(root, '..', 'bin', 'luau'),
    path.join(root, 'bin', 'luau.linux'),
    path.join(root, 'bin', 'luau'),
    '/tmp/luau',
    path.join(root, '..', 'luraph-v15-engine', 'bin', 'luau'),
  ].filter(Boolean);

  let luauBin = '';
  for (const c of candidates) {
    try {
      if (c === 'luau') { luauBin = 'luau'; break; }
      await fs.access(c);
      const st = fssync.statSync(c);
      if (st.size < 1000) continue;
      luauBin = c;
      break;
    } catch (_) {}
  }

  const env = { ...process.env, ENVLOGGER_ROOT: root };
  if (luauBin) env.ENVLOGGER_LUAU = luauBin;

  let stdout = '';
  let stderr = '';
  await new Promise((resolve) => {
    const child = spawn(process.execPath, [runner, inputPath, '-o', outputPath, '--budget', String(budget)], {
      cwd: root,
      env,
      timeout: (budget + 25) * 1000,
    });
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });
    child.on('error', (err) => { stderr += String(err.message || err); resolve(); });
    child.on('close', () => resolve());
  });

  let log = '';
  try { log = await fs.readFile(outputPath, 'utf8'); } catch { log = stdout || ''; }
  if (/exit:\s*null\s*signal:\s*SIGILL/i.test(log) && /\(no output\)/i.test(log)) {
    return { log: '', note: 'luau SIGILL — static only', stderr };
  }
  if (!log.trim()) return { log: '', note: 'dynamic empty', stderr };
  return { log, note: 'dynamic ok', stderr };
}

async function startEnvLogWorkflow(message, inlineText, deps) {
  const {
    dailyEmbed, DAILY_COLORS, inputFromAttachment, inputFromUrlText, collectInput,
    formatBytes, formatDuration, sha256Hex, splitUtf8Buffer, AttachmentBuilder,
    MAX_ATTACHMENT_PART_BYTES,
  } = deps;
  const root = path.join(__dirname);

  const prompt = await message.reply({
    embeds: [dailyEmbed('Environment log', 'Analyzing…', DAILY_COLORS.primary)],
    allowedMentions: { repliedUser: false },
  });

  let input;
  try {
    const attachment = message.attachments.first();
    if (attachment) {
      input = await inputFromAttachment(attachment);
    } else if (inlineText && /https?:\/\//i.test(inlineText) && !/[\r\n]/.test(inlineText.trim()) &&
        !inlineText.includes('```') && inlineText.length < 600) {
      input = await inputFromUrlText(inlineText);
    } else if (inlineText) {
      const code = inlineText.replace(/^```(?:lua|luau)?\s*/i, '').replace(/```\s*$/, '');
      input = { source: code, filename: 'pasted.lua' };
    } else {
      input = await collectInput(message, prompt);
    }
  } catch (error) {
    await prompt.edit({ embeds: [dailyEmbed('Environment log', String(error.message || error).slice(0, 1500), DAILY_COLORS.danger)] }).catch(() => {});
    return;
  }

  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'daily-envlog-'));
  const base = (input.filename || 'script.lua').replace(/[^A-Za-z0-9_.-]/g, '_').replace(/\.(?:lua|luau|pureluau|txt)$/i, '') || 'script';
  const inputPath = path.join(tempRoot, base + '.lua');
  const outputPath = path.join(tempRoot, base + '_envlog.txt');
  const started = Date.now();

  try {
    const source = String(input.source || '');
    await fs.writeFile(inputPath, source, 'utf8');

    const analysis = analyze(source);

    await prompt.edit({
      embeds: [dailyEmbed(
        'Environment log',
        '**' + analysis.primary + '** · ' + formatBytes(Buffer.byteLength(source, 'utf8')) + '\nRunning sandbox (best-effort)…',
        DAILY_COLORS.primary
      )],
    }).catch(() => {});

    const budget = Number(process.env.ENVLOGGER_BUDGET || 30);
    let dynamic = { log: '', note: 'skipped' };
    try {
      dynamic = await tryDynamic(root, inputPath, outputPath, budget);
    } catch (e) {
      dynamic = { log: '', note: 'dynamic error: ' + String(e.message || e).slice(0, 120) };
    }

    const dynLog = dynamic.log || '';
    const fullReport = buildTextReport(base + '.lua', source, analysis, dynLog);

    const section = (name) => {
      const re = new RegExp('-- ' + name + ':\\n([\\s\\S]*?)(?=\\n-- |\\n\\[|$)', 'i');
      const m = dynLog.match(re);
      if (!m) return [];
      return m[1].split(/\r?\n/).map((l) => l.replace(/^--\s+/, '').trim()).filter((l) => l && !l.startsWith('---'));
    };
    const dynUrls = section('urls');
    const dynServices = section('services');
    const dynRemotes = section('remotes');
    const dynLoadstrings = section('loadstring captures');
    const dynErrors = section('errors');
    const dynAntivm = (dynLog.match(/ANTIVM[^\n]*/g) || []).map((l) => l.replace(/^\[[^\]]*\]\s*#\d+\s*/g, '').trim());

    const allUrls = [...new Set([...analysis.urls, ...dynUrls])];
    const allServices = [...new Set([...analysis.services, ...dynServices])];
    const allAntivm = [...new Set([...analysis.antivm, ...dynAntivm])];

    const stmtsMatch = dynLog.match(/stmts=(\d+)/i);
    const stmts = stmtsMatch ? Number(stmtsMatch[1]) : 0;
    const dynOk = /-- ENVLOGGER report/i.test(dynLog) && !/signal:\s*SIGILL/i.test(dynLog);

    const elapsedMs = Date.now() - started;
    const tick = String.fromCharCode(96);
    const color = dynOk ? DAILY_COLORS.success
      : (allAntivm.length || analysis.keys.length ? DAILY_COLORS.warning : DAILY_COLORS.primary);

    const description = [
      '**Obfuscator:** ' + analysis.primary,
      analysis.signatures.length > 1 ? '**Signatures:** ' + analysis.signatures.slice(0, 6).join(', ') : null,
      '**Input:** ' + formatBytes(Buffer.byteLength(source, 'utf8')) +
        ' · SHA-256 ' + tick + sha256Hex(source).slice(0, 16) + tick,
      '**Dynamic:** ' + (dynOk ? ('ok · ' + (stmts ? stmts + ' stmts' : 'ran')) : ('static only · ' + (dynamic.note || 'luau unavailable'))),
      '**Elapsed:** ' + formatDuration(elapsedMs),
    ].filter(Boolean).join('\n');

    const embed = dailyEmbed('Environment log · ' + base, description, color);
    embed.addFields(
      {
        name: 'API surface',
        value: [
          'loadstring/load: **' + analysis.stats.loadstring + '**',
          'HttpGet/request: **' + analysis.stats.http + '**',
          'getgenv: **' + analysis.stats.getgenv + '**',
          'bit32: **' + analysis.stats.bit32 + '** · char/byte: **' + analysis.stats.stringChar + '/' + analysis.stats.stringByte + '**',
          'hooks: **' + analysis.stats.hooks + '** · debug: **' + analysis.stats.debug + '**',
        ].join('\n'),
        inline: false,
      },
      { name: 'URLs · ' + allUrls.length, value: brief(allUrls, 'None literal.'), inline: true },
      { name: 'Services · ' + allServices.length, value: brief(allServices, 'None literal.'), inline: true },
      { name: 'Remotes · ' + dynRemotes.length, value: brief(dynRemotes, 'None recorded.'), inline: true },
      { name: 'Keys', value: brief(analysis.keys, 'None literal.'), inline: true },
      { name: 'ANTIVM / probes · ' + allAntivm.length, value: brief(allAntivm, 'None flagged.'), inline: true },
      { name: 'Loadstring captures · ' + dynLoadstrings.length, value: brief(dynLoadstrings, dynOk ? 'None.' : 'Need dynamic run.'), inline: false },
      { name: 'Dynamic errors', value: brief(dynErrors, dynOk ? 'None.' : (dynamic.note || 'Sandbox not run.')), inline: false }
    );

    const files = [];
    const addParts = (data, filename) => {
      const parts = splitUtf8Buffer(Buffer.from(data, 'utf8'), MAX_ATTACHMENT_PART_BYTES || 8 * 1024 * 1024);
      if (parts.length === 1) {
        files.push(new AttachmentBuilder(parts[0], { name: filename }));
        return;
      }
      const extension = path.extname(filename) || '.txt';
      const stem = path.basename(filename, extension);
      parts.forEach((part, index) => files.push(new AttachmentBuilder(part, {
        name: stem + '.part' + String(index + 1).padStart(3, '0') + extension,
      })));
    };
    addParts(fullReport, base + '_envlog.txt');
    if (files.length > 10) throw new Error('Trace requires ' + files.length + ' attachments; Discord allows at most 10.');

    await prompt.edit({ embeds: [embed], files });
  } catch (error) {
    await prompt.edit({ embeds: [dailyEmbed('Environment log', String(error.message || error).slice(0, 1500), DAILY_COLORS.danger)] }).catch(() => {});
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true }).catch(() => {});
  }
}

module.exports = { startEnvLogWorkflow, analyze, buildTextReport };
