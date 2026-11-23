'use strict';
/**
 * ENVLOGGER Discord integration for DAILYDEOBF (.l command).
 * startEnvLogWorkflow(message, inlineText, deps)
 */
const { spawn } = require('node:child_process');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

async function startEnvLogWorkflow(message, inlineText, deps) {
  const {
    dailyEmbed, DAILY_COLORS, inputFromAttachment, inputFromUrlText, collectInput,
    formatBytes, formatDuration, sha256Hex, splitUtf8Buffer, AttachmentBuilder,
    MAX_ATTACHMENT_PART_BYTES,
  } = deps;
  const root = path.join(__dirname);

  const prompt = await message.reply({
    embeds: [dailyEmbed('Environment log', 'Preparing...', DAILY_COLORS.primary)],
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
    await fs.writeFile(inputPath, input.source, 'utf8');
    await prompt.edit({
      embeds: [dailyEmbed(
        'Environment log',
        'Running **' + base + '** in ENVLOGGER sandbox (' + formatBytes(Buffer.byteLength(input.source, 'utf8')) + ')...',
        DAILY_COLORS.primary
      )],
    }).catch(() => {});

    const runner = path.join(root, 'src', 'run.js');
    const runtime = path.join(root, 'runtime', 'envlogger.luau');
    try {
      await fs.access(runner);
      await fs.access(runtime);
    } catch {
      throw new Error('ENVLOGGER missing (envlogger/src/run.js or runtime). Pull latest DAILYDEOBF.');
    }

    const budget = Number(process.env.ENVLOGGER_BUDGET || 30);
    const env = {
      ...process.env,
      ENVLOGGER_LUAU: process.env.ENVLOGGER_LUAU || process.env.DEOB_LUAU || process.env.LUAU_BIN || '',
      ENVLOGGER_ROOT: root,
    };
    if (!env.ENVLOGGER_LUAU) {
      const candidates = [
        path.join(root, '..', 'bin', 'luau'),
        path.join(root, '..', 'bin', 'luau.linux'),
        path.join(root, '..', 'luraph-v15.1-engine', 'bin', 'luau.linux'),
        path.join(root, '..', 'luraph-v15-engine', 'bin', 'luau'),
        '/tmp/luau',
        'luau',
      ];
      for (const c of candidates) {
        try {
          if (c === 'luau') { env.ENVLOGGER_LUAU = 'luau'; break; }
          await fs.access(c);
          env.ENVLOGGER_LUAU = c;
          break;
        } catch (_) {}
      }
    }
    if (!env.ENVLOGGER_LUAU) {
      throw new Error('No luau binary. Set ENVLOGGER_LUAU or DEOB_LUAU.');
    }

    let stdout = '';
    let stderr = '';
    let exitCode = 0;
    await new Promise((resolve) => {
      const child = spawn(process.execPath, [runner, inputPath, '-o', outputPath, '--budget', String(budget)], {
        cwd: root,
        env,
        timeout: (budget + 20) * 1000,
      });
      child.stdout.on('data', (d) => { stdout += d; });
      child.stderr.on('data', (d) => { stderr += d; });
      child.on('error', (err) => { stderr += String(err.message || err); exitCode = 1; resolve(); });
      child.on('close', (code) => { exitCode = code == null ? 1 : code; resolve(); });
    });

    let log = '';
    try {
      log = await fs.readFile(outputPath, 'utf8');
    } catch {
      log = (stdout || stderr || '').trim() || 'ENVLOGGER produced no report.';
    }

    const statusMatch = log.match(/-- status:\s*(.+)/i);
    const stmtsMatch = log.match(/stmts=(\d+)/i);
    const status = statusMatch ? statusMatch[1].trim() : (exitCode === 0 ? 'finished' : 'failed');
    const stmts = stmtsMatch ? Number(stmtsMatch[1]) : 0;

    const section = (name) => {
      const re = new RegExp('-- ' + name + ':\\n([\\s\\S]*?)(?=\\n-- |\\n\\[|$)', 'i');
      const m = log.match(re);
      if (!m) return [];
      return m[1].split(/\r?\n/).map((l) => l.replace(/^--\s+/, '').trim()).filter((l) => l && !l.startsWith('---'));
    };
    const services = section('services');
    const urls = section('urls');
    const remotes = section('remotes');
    const loadstrings = section('loadstring captures');
    const errors = section('errors');
    const unknownGlobals = section('unknown globals');
    const antivm = (log.match(/ANTIVM[^\n]*/g) || []).map((l) => l.replace(/^\[[^\]]*\]\s*#\d+\s*/g, '').trim());

    const brief = (items, empty, limit = 900) => {
      if (!items || !items.length) return empty;
      const value = items.slice(0, 12).map((x) => '• ' + String(x).slice(0, 120)).join('\n');
      return (value + (items.length > 12 ? '\n… and ' + (items.length - 12) + ' more' : '')).slice(0, limit);
    };

    const elapsedMs = Date.now() - started;
    const tick = String.fromCharCode(96);
    const description = [
      '**Result:** ' + status,
      '**Engine:** ENVLOGGER',
      '**Input:** ' + formatBytes(Buffer.byteLength(input.source, 'utf8')) +
        ' · SHA-256 ' + tick + sha256Hex(String(input.source)).slice(0, 16) + tick,
      '**Trace:** ' + (stmts ? stmts.toLocaleString() + ' statements' : 'statement count unavailable'),
      '**Elapsed:** ' + formatDuration(elapsedMs),
      '',
      'HTTP is stubbed offline. Nested loadstring bodies and ANTIVM probes are in the report attachment.',
    ].join('\n');

    const embed = dailyEmbed(
      'Environment log · ' + base,
      description,
      /^finished\b/i.test(status) ? DAILY_COLORS.success : (errors.length || antivm.length ? DAILY_COLORS.warning : DAILY_COLORS.primary)
    );
    embed.addFields(
      { name: 'Services · ' + services.length, value: brief(services, 'None recorded.'), inline: true },
      { name: 'Network · ' + urls.length, value: brief(urls, 'None recorded.'), inline: true },
      { name: 'Remotes · ' + remotes.length, value: brief(remotes, 'None recorded.'), inline: true },
      { name: 'Loadstring captures · ' + loadstrings.length, value: brief(loadstrings, 'None recorded.'), inline: false },
      { name: 'Unknown globals', value: brief(unknownGlobals, 'None.'), inline: true },
      { name: 'ANTIVM / probes', value: brief(antivm, 'None flagged.'), inline: true },
      { name: 'Errors', value: brief(errors, 'None.'), inline: false }
    );

    const files = [];
    const addParts = (data, filename) => {
      const parts = splitUtf8Buffer(Buffer.from(data), MAX_ATTACHMENT_PART_BYTES);
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
    addParts(log, base + '_envlog.txt');
    if (files.length > 10) throw new Error('Trace requires ' + files.length + ' attachments; Discord allows at most 10.');
    await prompt.edit({ embeds: [embed], files });
  } catch (error) {
    await prompt.edit({ embeds: [dailyEmbed('Environment log', String(error.message || error).slice(0, 1500), DAILY_COLORS.danger)] }).catch(() => {});
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true }).catch(() => {});
  }
}

module.exports = { startEnvLogWorkflow };
