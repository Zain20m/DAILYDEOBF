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

function redactUrl(value) {
  return String(value)
    .replace(/([?&][^=&]*(?:token|key|auth|secret|password|session|signature|code)[^=&]*=)[^&#\\s]*/gi, '$1[REDACTED]')
    .replace(/(discord(?:app)?\\.com\\/api\\/webhooks\\/\\d+\\/)[^/\\s?#]+/gi, '$1[REDACTED]');
}

function analyze(source) {
  const hits = [];
  for (const [re, name] of RULES) if (re.test(source)) hits.push(name);
  const urls = [...new Set((source.match(/https?:\/\/[^\s"'`\)\]\}>]+/gi) || []).map(u => redactUrl(u.replace(/[.,;:]+$/, ''))))].slice(0, 40);
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
      taskWait: count(/\btask\.wait\s*\(|\bwait\s*\(/gi),
      requests: count(/\brequest\s*\(|\bhttp_request\s*\(/gi),
      getgc: count(/\bgetgc\s*\(/gi),
      getconnections: count(/\bgetconnections\s*\(/gi),
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
  } = deps || {};

  // ALWAYS ack immediately so Discord is never silent
  let prompt;
  try {
    if (dailyEmbed && DAILY_COLORS) {
      prompt = await message.reply({
        embeds: [dailyEmbed('Environment log', 'Starting ENVLOGGER…', DAILY_COLORS.primary)],
        allowedMentions: { repliedUser: false },
      });
    } else {
      prompt = await message.reply({ content: '🔍 ENVLOGGER starting…', allowedMentions: { repliedUser: false } });
    }
  } catch (e) {
    try {
      prompt = await message.channel.send('🔍 ENVLOGGER starting…');
    } catch (e2) {
      console.error('[envlogger] cannot send ack:', e2);
      throw e2;
    }
  }

  let input;
  try {
    const attachment = message.attachments && message.attachments.first && message.attachments.first();
    if (attachment && inputFromAttachment) input = await inputFromAttachment(attachment);
    else if (inlineText && /https?:\/\//i.test(inlineText) && !/[\r\n]/.test(inlineText.trim()) && inlineText.length < 600 && inputFromUrlText) {
      input = await inputFromUrlText(inlineText);
    } else if (inlineText) {
      const code = String(inlineText).replace(/^```(?:lua|luau)?\s*/i, '').replace(/```\s*$/, '');
      input = { source: code, filename: 'pasted.lua' };
    } else if (collectInput) {
      input = await collectInput(message, prompt);
    } else {
      await prompt.edit({ content: 'Attach a `.lua` file, paste code, or pass a URL after `.l`', embeds: [] }).catch(() => {});
      return;
    }
  } catch (error) {
    const msg = String(error.message || error).slice(0, 1500);
    if (prompt && prompt.edit) {
      if (dailyEmbed && DAILY_COLORS) {
        await prompt.edit({ embeds: [dailyEmbed('Environment log', msg, DAILY_COLORS.danger)] }).catch(() => {});
      } else {
        await prompt.edit({ content: '❌ ' + msg }).catch(() => {});
      }
    }
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

    if (prompt.edit && dailyEmbed && DAILY_COLORS && formatBytes) {
      await prompt.edit({
        embeds: [dailyEmbed('Environment log', `**${analysis.primary}** · ${formatBytes(Buffer.byteLength(source, 'utf8'))}\nSandbox + behavior reconstruction…`, DAILY_COLORS.primary)],
      }).catch(() => {});
    }

    const root = path.join(__dirname);
    const runner = path.join(root, 'src', 'run.js');
    const budget = Math.min(45, Math.max(10, Number(process.env.ENVLOGGER_BUDGET || 35)));
    const minDurationMs = Math.min(15000, Math.max(6000, Number(process.env.ENVLOGGER_MIN_DURATION_MS || 8000)));
    let log = '';

    if (fssync.existsSync(runner)) {
      await new Promise((resolve) => {
        const child = spawn(process.execPath, [runner, inputPath, '-o', outputPath, '--budget', String(budget)], {
          cwd: root,
          env: { ...process.env },
        });
        let stdout = '';
        let stderr = '';
        let progressStage = 'Sandbox pass running';
        let settled = false;
        const runStarted = Date.now();
        child.stdout.on('data', (d) => { stdout += d; });
        child.stderr.on('data', (d) => { stderr += d; });

        const progressTimer = setInterval(() => {
          const elapsedSeconds = Math.floor((Date.now() - runStarted) / 1000);
          const byteLabel = formatBytes ? formatBytes(Buffer.byteLength(source, 'utf8')) : (source.length + ' B');
          const detail = '**' + analysis.primary + '** · ' + byteLabel + '\n' +
            progressStage + ' · ' + elapsedSeconds + 's elapsed\n' +
            'Budget: ' + budget + 's · collecting API, service, task, and behavior traces…';
          if (dailyEmbed && DAILY_COLORS && prompt.edit) {
            prompt.edit({ embeds: [dailyEmbed('Environment log', detail, DAILY_COLORS.primary)] }).catch(() => {});
          } else if (prompt.edit) {
            prompt.edit({ content: '🔍 ENVLOGGER\n' + detail }).catch(() => {});
          }
        }, 3000);

        let killTimer;
        const complete = async () => {
          if (settled) return;
          settled = true;
          if (killTimer) clearTimeout(killTimer);
          try { log = await fs.readFile(outputPath, 'utf8'); } catch { log = stdout || stderr; }

          // Keep the user-facing run staged long enough to show that the trace pass happened.
          const remaining = Math.max(0, minDurationMs - (Date.now() - runStarted));
          if (remaining > 0) {
            progressStage = 'Reviewing captured trace and formatting report';
            await new Promise((done) => setTimeout(done, remaining));
          }
          clearInterval(progressTimer);
          resolve();
        };

        killTimer = setTimeout(() => {
          progressStage = 'Stopping sandbox at the configured time limit';
          try { child.kill('SIGKILL'); } catch (_) {}
        }, (budget + 10) * 1000);

        child.on('close', () => { complete().catch((error) => { clearInterval(progressTimer); console.error('[envlogger] finish error:', error); resolve(); }); });
        child.on('error', () => { complete().catch(() => { clearInterval(progressTimer); resolve(); }); });
      });
    }

    if (!log) {
      log = [
        'ENVLOGGER',
        'source: ' + base + '.lua',
        'bytes: ' + source.length,
        'obfuscator: ' + analysis.primary,
        '---',
        '-- static only (runner missing or failed)',
        '-- urls:',
        ...analysis.urls.map((u) => '--   ' + u),
      ].join('\n');
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
    const dynMembers = section('member accesses');
    const simulatedWait = Number((log.match(/simulated_wait=([0-9.]+)/i) || [])[1] || 0);
    const stmts = Number((log.match(/stmts=(\d+)/i) || [])[1] || 0);
    const dynOk = /-- ENVLOGGER report/i.test(log) && !/signal:\s*SIGILL/i.test(log);
    const elapsedMs = Date.now() - started;
    const tick = String.fromCharCode(96);
    const sha = typeof sha256Hex === 'function' ? sha256Hex(source).slice(0, 16) : 'n/a';
    const elapsed = typeof formatDuration === 'function' ? formatDuration(elapsedMs) : (Math.round(elapsedMs / 1000) + 's');
    const bytes = typeof formatBytes === 'function' ? formatBytes(Buffer.byteLength(source, 'utf8')) : (source.length + ' B');

    const description = [
      '**Obfuscator:** ' + analysis.primary,
      '**Input:** ' + bytes + ' · SHA-256 ' + tick + sha + tick,
      '**Dynamic:** ' + (dynOk ? ('ok · ' + stmts + ' stmts') : 'static + partial'),
      '**Behavior script:** ' + (behavior ? (behavior.split('\n').length + ' lines') : 'not produced'),
      '**Elapsed:** ' + elapsed,
      '',
      'Attachments: full log + reconstructed behavior `.lua` (sandbox observation, **not** original source).',
    ].join('\n');

    const files = [];
    if (AttachmentBuilder && typeof splitUtf8Buffer === 'function') {
      const add = (data, name) => {
        const parts = splitUtf8Buffer(Buffer.from(data, 'utf8'), MAX_ATTACHMENT_PART_BYTES || 8 * 1024 * 1024);
        if (parts.length === 1) files.push(new AttachmentBuilder(parts[0], { name }));
        else parts.forEach((p, i) => files.push(new AttachmentBuilder(p, { name: name.replace(/\.txt$/, '') + '.part' + String(i + 1).padStart(2, '0') + '.txt' })));
      };
      add(log, base + '_envlog.txt');
      if (behavior) {
        add('-- Reconstructed from ENVLOGGER sandbox observations.\n-- NOT the original source.\n\n' + behavior + '\n', base + '_behavior.lua');
      }
    }

    if (dailyEmbed && DAILY_COLORS && prompt.edit) {
      const embed = dailyEmbed('Environment log · ' + base, description, dynOk ? DAILY_COLORS.success : DAILY_COLORS.warning);
      if (embed.addFields) {
        embed.addFields(
          { name: 'API surface', value: ['loadstring: **' + analysis.stats.loadstring + '**', 'HttpGet: **' + analysis.stats.http + '**', 'getgenv: **' + analysis.stats.getgenv + '** · bit32: **' + analysis.stats.bit32 + '**', 'hooks: **' + analysis.stats.hooks + '**', 'task.wait: **' + analysis.stats.taskWait + '**', 'request: **' + analysis.stats.requests + '**', 'getgc: **' + analysis.stats.getgc + '** · getconnections: **' + analysis.stats.getconnections + '**'].join('\n'), inline: false },
          { name: 'URLs · ' + allUrls.length, value: brief(allUrls, 'None.'), inline: true },
          { name: 'Services · ' + allServices.length, value: brief(allServices, 'None.'), inline: true },
          { name: 'Remotes · ' + dynRemotes.length, value: brief(dynRemotes, 'None.'), inline: true },
          { name: 'Prints · ' + dynPrints.length, value: brief(dynPrints, 'None captured.'), inline: false },
          { name: 'Loadstring · ' + dynLoadstrings.length, value: brief(dynLoadstrings, 'None.'), inline: false },
          { name: 'Member access · ' + dynMembers.length, value: brief(dynMembers, 'None captured.'), inline: true },
          { name: 'Simulated waits', value: simulatedWait.toFixed(2) + 's total', inline: true },
          { name: 'Errors', value: brief(dynErrors, 'None.'), inline: false }
        );
      }
      await prompt.edit({ embeds: [embed], files: files.length ? files : undefined });
    } else {
      await prompt.edit({ content: description.slice(0, 1800), files: files.length ? files : undefined }).catch(() => {});
    }
  } catch (error) {
    const msg = String(error.message || error).slice(0, 1500);
    if (prompt && prompt.edit) {
      if (dailyEmbed && DAILY_COLORS) {
        await prompt.edit({ embeds: [dailyEmbed('Environment log', msg, DAILY_COLORS.danger)] }).catch(() => {});
      } else {
        await prompt.edit({ content: '❌ ' + msg }).catch(() => {});
      }
    }
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true }).catch(() => {});
  }
}

module.exports = { startEnvLogWorkflow, analyze };
