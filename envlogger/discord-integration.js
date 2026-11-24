'use strict';
const { spawn } = require('node:child_process');
const fs = require('node:fs/promises');
const fssync = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const RULES = [
  [/ObscuraLua|obscura\.lua/i, 'ObscuraLua'],
  [/LPH[_-]?|Luraph|LPH-Z/i, 'Luraph'],
  [/luarmor\.net|script_key\s*=/i, 'Luarmor'],
  [/IronBrew|IB2/i, 'IronBrew'],
  [/Centurion/i, 'Centurion'],
  [/Moonsec/i, 'Moonsec'],
  [/vantarmor/i, 'Vantarmor'],
  [/polsec\.net|Fulcrum/i, 'Polsec/Fulcrum'],
  [/JNKIE|jnkie/i, 'JNKIE'],
  [/Voltfuscator/i, 'Voltfuscator'],
  [/luavify/i, 'Luavify'],
];

function analyze(source) {
  const hits = [];
  for (const [re, name] of RULES) if (re.test(source)) hits.push(name);
  const urls = [...new Set((source.match(/https?:\/\/[^\s"'`\)\]\}>]+/gi) || []).map(u => u.replace(/[.,;:]+$/, ''))].slice(0, 40);
  const keys = [...source.matchAll(/(?:script_key|SCRIPT_KEY)\s*=\s*["']([^"']+)["']/gi)].map(m => m[1]);
  const services = [...new Set([...source.matchAll(/GetService\s*\(\s*["']([^"']+)["']\s*\)/g)].map(m => m[1]))];
  const count = (re) => (source.match(re) || []).length;
  return {
    primary: hits[0] || 'unknown / custom',
    signatures: hits,
    urls, keys, services,
    stats: {
      bytes: source.length,
      loadstring: count(/\bloadstring\b/gi),
      http: count(/\bHttpGet\b/g),
      getgenv: count(/\bgetgenv\b/g),
      bit32: count(/\bbit32\b/g),
      hooks: count(/\bhookfunction\b|\bnewcclosure\b/g),
    },
  };
}

function extractBehavior(log) {
  const a = log.indexOf('-- ===BEGIN_BEHAVIOR_LUA===');
  const b = log.indexOf('-- ===END_BEHAVIOR_LUA===');
  if (a >= 0 && b > a) return log.slice(a + '-- ===BEGIN_BEHAVIOR_LUA==='.length, b).trim();
  return '';
}

function brief(items, empty, limit = 900) {
  if (!items || !items.length) return empty;
  const value = items.slice(0, 12).map((x) => '• ' + String(x).slice(0, 140)).join('\n');
  return (value + (items.length > 12 ? '\n… +' + (items.length - 12) + ' more' : '')).slice(0, limit);
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
    if (attachment) input = await inputFromAttachment(attachment);
    else if (inlineText && /https?:\/\//i.test(inlineText) && !/[\r\n]/.test(inlineText.trim()) && inlineText.length < 600) {
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
  const base = (input.filename || 'script.lua').replace(/[^A-Za-z0-9_.-]/g, '_').replace(/\.(?:lua|luau|txt)$/i, '') || 'script';
  const inputPath = path.join(tempRoot, base + '.lua');
  const outputPath = path.join(tempRoot, base + '_envlog.txt');
  const started = Date.now();

  try {
    const source = String(input.source || '');
    await fs.writeFile(inputPath, source, 'utf8');
    const analysis = analyze(source);

    await prompt.edit({
      embeds: [dailyEmbed('Environment log', `**${analysis.primary}** · ${formatBytes(Buffer.byteLength(source, 'utf8'))}\nSandbox + behavior reconstruction…`, DAILY_COLORS.primary)],
    }).catch(() => {});

    const runner = path.join(root, 'src', 'run.js');
    const budget = Number(process.env.ENVLOGGER_BUDGET || 30);
    let log = '';
    if (fssync.existsSync(runner)) {
      await new Promise((resolve) => {
        const child = spawn(process.execPath, [runner, inputPath, '-o', outputPath, '--budget', String(budget)], {
          cwd: root,
          env: { ...process.env },
          timeout: (budget + 25) * 1000,
        });
        let stdout = '';
        child.stdout.on('data', (d) => { stdout += d; });
        child.on('close', async () => {
          try { log = await fs.readFile(outputPath, 'utf8'); } catch { log = stdout; }
          resolve();
        });
        child.on('error', () => resolve());
      });
    }

    if (!log) {
      log = ['ENVLOGGER', 'source: ' + base + '.lua', 'bytes: ' + source.length, 'obfuscator: ' + analysis.primary, '---', '-- static only',
        '-- urls:', ...analysis.urls.map(u => '--   ' + u)].join('\n');
    }

    const behavior = extractBehavior(log);
    const section = (name) => {
      const re = new RegExp('-- ' + name + ':\\n([\\s\\S]*?)(?=\\n-- |\\n\\[|$)', 'i');
      const m = log.match(re);
      if (!m) return [];
      return m[1].split(/\r?\n/).map((l) => l.replace(/^--\s+/, '').trim()).filter((l) => l && !l.startsWith('---') && !l.startsWith('==='));
    };
    const allUrls = [...new Set([...analysis.urls, ...section('urls')])];
    const allServices = [...new Set([...analysis.services, ...section('services')])];
    const dynRemotes = section('remotes');
    const dynPrints = section('prints');
    const dynLoadstrings = section('loadstring captures');
    const dynErrors = section('errors');
    const stmts = Number((log.match(/stmts=(\d+)/i) || [])[1] || 0);
    const dynOk = /-- ENVLOGGER report/i.test(log) && !/signal:\s*SIGILL/i.test(log);
    const elapsedMs = Date.now() - started;
    const tick = String.fromCharCode(96);

    const description = [
      '**Obfuscator:** ' + analysis.primary,
      '**Input:** ' + formatBytes(Buffer.byteLength(source, 'utf8')) + ' · SHA-256 ' + tick + sha256Hex(source).slice(0, 16) + tick,
      '**Dynamic:** ' + (dynOk ? ('ok · ' + stmts + ' stmts') : 'static + partial'),
      '**Behavior script:** ' + (behavior ? (behavior.split('\n').length + ' lines') : 'not produced'),
      '**Elapsed:** ' + formatDuration(elapsedMs),
      '',
      'Attachments: full log + reconstructed behavior `.lua` (sandbox observation, **not** original source).',
    ].join('\n');

    const embed = dailyEmbed('Environment log · ' + base, description, dynOk ? DAILY_COLORS.success : DAILY_COLORS.warning);
    embed.addFields(
      { name: 'API surface', value: ['loadstring: **' + analysis.stats.loadstring + '**', 'HttpGet: **' + analysis.stats.http + '**', 'getgenv: **' + analysis.stats.getgenv + '** · bit32: **' + analysis.stats.bit32 + '**', 'hooks: **' + analysis.stats.hooks + '**'].join('\n'), inline: false },
      { name: 'URLs · ' + allUrls.length, value: brief(allUrls, 'None.'), inline: true },
      { name: 'Services · ' + allServices.length, value: brief(allServices, 'None.'), inline: true },
      { name: 'Remotes · ' + dynRemotes.length, value: brief(dynRemotes, 'None.'), inline: true },
      { name: 'Prints · ' + dynPrints.length, value: brief(dynPrints, 'None captured.'), inline: false },
      { name: 'Loadstring · ' + dynLoadstrings.length, value: brief(dynLoadstrings, 'None.'), inline: false },
      { name: 'Errors', value: brief(dynErrors, 'None.'), inline: false }
    );

    const files = [];
    const add = (data, name) => {
      const parts = splitUtf8Buffer(Buffer.from(data, 'utf8'), MAX_ATTACHMENT_PART_BYTES || 8 * 1024 * 1024);
      if (parts.length === 1) files.push(new AttachmentBuilder(parts[0], { name }));
      else parts.forEach((p, i) => files.push(new AttachmentBuilder(p, { name: name.replace(/\.txt$/, '') + '.part' + String(i + 1).padStart(2, '0') + '.txt' })));
    };
    add(log, base + '_envlog.txt');
    if (behavior) {
      add('-- Reconstructed from ENVLOGGER sandbox observations.\n-- NOT the original source.\n\n' + behavior + '\n', base + '_behavior.lua');
    }
    await prompt.edit({ embeds: [embed], files });
  } catch (error) {
    await prompt.edit({ embeds: [dailyEmbed('Environment log', String(error.message || error).slice(0, 1500), DAILY_COLORS.danger)] }).catch(() => {});
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true }).catch(() => {});
  }
}

module.exports = { startEnvLogWorkflow, analyze };
