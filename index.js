'use strict';

// Separate Python v15 and beta 15.1 pipelines with live analysis progress.

const {
  ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle,
  Client, Events, GatewayIntentBits, Partials,
  REST, Routes, SlashCommandBuilder,
} = require('discord.js');
const { spawn } = require('node:child_process');
const dns = require('node:dns').promises;
const net = require('node:net');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { inspectLiftText } = require('./scripts/lift-validation');
const { convertToPureLuau } = require('./pureluau');
const { resolveLoadstringSources, resolveStaticSources } = require('./scripts/idx-resolver');
const { buildIdxBundle } = require('./scripts/idx-output');
const { runLuauTask } = require('./scripts/roblox-execution');

const TOKEN = process.env.DISCORD_TOKEN;
const PREFIX = '.deobf';
const MAX_INPUT_BYTES = 2 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 18 * 1024 * 1024;
const MAX_PURELUA_CHARS = 1_500_000;
const MAX_IDX_CAPTURE_FILES = 50;
const MAX_GET_FILES = 50;
const MAX_GET_URLS = 250;
const MAX_GET_ATTEMPTS = 250;
const INPUT_WAIT_MS = 180_000;
const PICKER_WAIT_MS = 120_000;
const ENGINE_TIMEOUT_MS = 25 * 60_000;
const ENGINE_V14_DIR = path.join(__dirname, 'luraph-v14-engine');
const ENGINE_V14_CLI = path.join(ENGINE_V14_DIR, 'cli.py');
const ENGINE_V15_DIR = path.join(__dirname, 'luraph-v15-engine');
const ENGINE_V15_CLI = path.join(ENGINE_V15_DIR, 'deob.py');
const ENGINE_151_DIR = path.join(__dirname, 'luraph-v15.1-engine');
const ENGINE_151_CLI = path.join(ENGINE_151_DIR, 'deob.js');
const ENGINE_CENT_DIR = path.join(__dirname, 'centurion-engine');
const ENGINE_CENT_CLI = path.join(ENGINE_CENT_DIR, 'centurion.py');
const activeUsers = new Set();
const commandGuildId = process.env.GUILD_ID || '';

const slashCommands = ['purelua', 'pureluau'].map((name) => new SlashCommandBuilder()
  .setName(name)
  .setDescription('Convert Lua/Luau source with the static PureLuau readability pass')
  .addAttachmentOption((option) => option
    .setName('file')
    .setDescription('Upload a .lua, .luau, or .txt source file')
    .setRequired(false))
  .addStringOption((option) => option
    .setName('source')
    .setDescription('Paste Lua/Luau source text (up to 6000 characters)')
    .setMaxLength(6000)
    .setRequired(false))
  .toJSON());

if (!TOKEN) {
  console.error('Missing DISCORD_TOKEN environment variable.');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel],
});

function isPrivateAddress(address) {
  const version = net.isIP(address);
  if (version === 4) {
    const p = address.split('.').map(Number);
    return p[0] === 0 || p[0] === 10 || p[0] === 127 ||
      (p[0] === 100 && p[1] >= 64 && p[1] <= 127) ||
      (p[0] === 169 && p[1] === 254) ||
      (p[0] === 172 && p[1] >= 16 && p[1] <= 31) ||
      (p[0] === 192 && (p[1] === 168 || (p[1] === 0 && (p[2] === 0 || p[2] === 2)))) ||
      (p[0] === 198 && (p[1] === 18 || p[1] === 19 || (p[1] === 51 && p[2] === 100))) ||
      (p[0] === 203 && p[1] === 0 && p[2] === 113) || p[0] >= 224;
  }
  if (version === 6) {
    const value = address.toLowerCase();
    if (value.startsWith('::ffff:')) return isPrivateAddress(value.slice(7));
    return !(value.startsWith('2') || value.startsWith('3')) ||
      value === '::1' || value === '::' || value.startsWith('2001:db8:');
  }
  return true;
}

async function assertPublicUrl(url) {
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Only HTTP and HTTPS URLs are supported.');
  if (url.username || url.password) throw new Error('URLs containing credentials are not allowed.');
  const hostname = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (!hostname || hostname === 'localhost' || hostname.endsWith('.localhost') ||
      hostname.endsWith('.local') || hostname.endsWith('.internal')) {
    throw new Error('That URL host is not allowed.');
  }
  const literalVersion = net.isIP(hostname);
  const addresses = literalVersion
    ? [{ address: hostname }]
    : await dns.lookup(hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some((entry) => isPrivateAddress(entry.address))) {
    throw new Error('That URL does not point to a public address.');
  }
}

async function readResponseLimited(response, limit) {
  const declared = Number(response.headers.get('content-length') || 0);
  if (declared > limit) throw new Error(`The file is too large. Maximum size is ${Math.round(limit / 1024)} KB.`);
  const chunks = [];
  let total = 0;
  if (!response.body) return Buffer.alloc(0);
  for await (const chunk of response.body) {
    total += chunk.length;
    if (total > limit) {
      await response.body.cancel().catch(() => {});
      throw new Error(`The file is too large. Maximum size is ${Math.round(limit / 1024)} KB.`);
    }
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks, total);
}

async function fetchPublicText(rawUrl) {
  let current = new URL(rawUrl);
  current.hash = '';

  // GitHub blob pages are HTML. Convert the standard blob URL to its raw
  // counterpart before requesting it so .get receives source text.
  if (current.hostname.toLowerCase() === 'github.com') {
    const match = current.pathname.match(/^\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+)$/);
    if (match) {
      current = new URL(
        'https://raw.githubusercontent.com/' + match[1] + '/' + match[2] + '/' +
        match[3] + '/' + match[4]
      );
    }
  }

  const maxRedirects = 8;
  for (let redirect = 0; redirect <= maxRedirects; redirect++) {
    try {
      await assertPublicUrl(current);
    } catch (error) {
      throw new Error('URL safety/DNS check failed for ' + current.hostname + ': ' +
        String(error && (error.message || error) || 'unknown error'));
    }

    let response;
    try {
      response = await fetch(current, {
        redirect: 'manual',
        signal: AbortSignal.timeout(30_000),
        headers: {
          'user-agent': 'Mozilla/5.0 (compatible; DAILY-DEOBF/1.0)',
          accept: 'text/plain, text/*, application/luau, application/javascript, application/octet-stream, application/json, */*;q=0.8',
        },
      });
    } catch (error) {
      const reason = error && (
        error.cause && (error.cause.code || error.cause.message) ||
        error.code || error.message
      ) || 'unknown network error';
      throw new Error('Network/TLS request failed for ' + current.hostname + ': ' + String(reason));
    }

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location) {
        throw new Error('HTTP ' + response.status + ' redirect did not include a Location header.');
      }
      if (redirect === maxRedirects) {
        throw new Error('The URL exceeded the ' + maxRedirects + '-redirect limit.');
      }
      try {
        current = new URL(location, current);
        current.hash = '';
      } catch {
        throw new Error('The server returned an invalid redirect URL.');
      }
      continue;
    }

    if (!response.ok) {
      const retryAfter = response.headers.get('retry-after');
      throw new Error(
        'HTTP ' + response.status + ' ' + (response.statusText || '') +
        ' while downloading from ' + current.hostname +
        (retryAfter ? '. Retry-After: ' + retryAfter : '')
      );
    }

    // Do not reject a response only because the host labelled it text/html.
    // Some script hosts mislabel plain Luau. decodeSource checks the body itself.
    const bytes = await readResponseLimited(response, MAX_INPUT_BYTES);
    const contentType = String(response.headers.get('content-type') || 'unknown')
      .split(';')[0].trim().toLowerCase();

    return {
      bytes,
      filename: path.basename(current.pathname) || 'script.lua',
      finalUrl: current.toString(),
      contentType,
      status: response.status,
    };
  }
  throw new Error('Could not download the URL after following redirects.');
}

function decodeSource(bytes) {
  let source;
  try {
    source = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new Error('The file is not valid UTF-8 text.');
  }
  if (!source.trim() || source.includes('\0')) throw new Error('The file is empty or is not a text script.');
  if (/^\s*<(?:!doctype\s+html|html)\b/i.test(source)) throw new Error('That URL returned HTML, not a script.');
  return source;
}

async function inputFromAttachment(attachment) {
  const filename = attachment.name || 'script.txt';
  if (!/\.(lua|luau|txt)$/i.test(filename)) {
    throw new Error('Upload a `.lua`, `.luau`, or `.txt` file.');
  }
  if (attachment.size > MAX_INPUT_BYTES) {
    throw new Error('The file is too large. Maximum size is 2 MB.');
  }

  // Discord CDN attachments are trusted HTTPS URLs; download them directly.
  const response = await fetch(attachment.url, {
    redirect: 'error',
    signal: AbortSignal.timeout(15_000),
    headers: { 'user-agent': 'DAILY-DEOBF/1.0' },
  });
  if (!response.ok) throw new Error(`Could not download the Discord attachment (HTTP ${response.status}).`);
  const bytes = await readResponseLimited(response, MAX_INPUT_BYTES);
  return { source: decodeSource(bytes), filename };
}

async function inputFromUrlText(text) {
  const match = String(text || '').match(/https?:\/\/[^\s"'<>]+/i);
  if (!match) {
    throw new Error('Send a direct script URL or a loadstring(game:HttpGet("URL"))() expression.');
  }
  const rawUrl = match[0].replace(/[)\]},.;]+$/g, '');
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('The URL in that message is invalid.');
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Only HTTP and HTTPS URLs are supported.');
  }
  const result = await fetchPublicText(parsed.toString());
  const filename = /\.(lua|luau|txt)$/i.test(path.extname(result.filename))
    ? result.filename
    : 'downloaded-script.lua';
  return { source: decodeSource(result.bytes), filename, url: parsed.toString() };
}

async function collectInput(message, prompt) {
  const collector = message.channel.createMessageCollector({
    filter: (msg) => msg.author.id === message.author.id && msg.channelId === message.channelId,
    time: INPUT_WAIT_MS,
    max: 1,
  });

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error('Input timed out. Type `.deobf` to start again.')),
      INPUT_WAIT_MS + 1000,
    );
    collector.on('collect', async (reply) => {
      clearTimeout(timeout);
      collector.stop('received');
      try {
        if (reply.content.trim().toLowerCase() === '.cancel') throw new Error('Cancelled.');
        const attachment = reply.attachments.first();
        if (attachment) {
          resolve(await inputFromAttachment(attachment));
          return;
        }

        const result = await inputFromUrlText(reply.content);
        resolve(result);
      } catch (error) {
        reject(error);
      }
    });
    collector.on('end', (_collected, reason) => {
      clearTimeout(timeout);
      if (reason === 'time' && collector.collected.size === 0) {
        reject(new Error('Input timed out. Type `.deobf` to start again.'));
      }
    });
    prompt.edit({
      content: 'Send one `.lua`, `.luau`, or `.txt` file, or paste a direct script URL. Type `.cancel` to stop.',
    }).catch(() => {});
  });
}

function formatDuration(milliseconds) {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remaining = seconds % 60;
  if (hours) return hours + 'h ' + minutes + 'm';
  if (minutes) return minutes + 'm ' + String(remaining).padStart(2, '0') + 's';
  return remaining + 's';
}

function formatBytes(bytes) {
  if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  if (bytes >= 1024) return Math.round(bytes / 1024) + ' KB';
  return bytes + ' bytes';
}

const DAILY_DEOBF_HEADER = '--deobf by daily deobf';

async function prependDailyDeobfHeader(filePath) {
  const source = (await fs.readFile(filePath, 'utf8')).replace(/^\uFEFF/, '');
  if (source.split(/\r?\n/, 1)[0].trim().toLowerCase() === DAILY_DEOBF_HEADER) return;
  await fs.writeFile(filePath, DAILY_DEOBF_HEADER + '\n' + source.replace(/^(?:\r?\n)+/, ''), 'utf8');
}

function createAnalysisProgress(prompt, filename, inputBytes, label) {
  const startedAt = Date.now();
  const safeName = String(filename || 'script.lua').replaceAll(String.fromCharCode(96), '').replace(/[\r\n]/g, ' ');
  let phase = 'Queued engine startup';
  let detail = 'Input accepted. Waiting for the selected engine to initialize.';
  let percent = 1;
  let lastEdit = 0;
  let editing = false;
  let stopped = false;
  const activity = [];
  const MAX_ACTIVITY = 4;

  function recordActivity(message) {
    const clean = String(message || '').replace(/[\r\n]+/g, ' ').trim().slice(0, 150);
    if (!clean || (activity.length && activity[activity.length - 1].text === clean)) return;
    activity.push({ at: Date.now(), text: clean });
    while (activity.length > MAX_ACTIVITY) activity.shift();
  }

  function advance(nextPercent, nextPhase, nextDetail, activityText) {
    if (Number.isFinite(nextPercent)) percent = Math.max(percent, Math.min(100, Math.floor(nextPercent)));
    if (nextPhase) phase = nextPhase;
    if (nextDetail) detail = nextDetail;
    if (activityText) recordActivity(activityText);
  }

  function render() {
    const elapsed = Date.now() - startedAt;
    const barSize = 16;
    const filled = Math.floor((percent / 100) * barSize);
    const bar = '▰'.repeat(filled) + '▱'.repeat(barSize - filled);
    const recent = activity.slice(-3).map((item) => {
      const age = formatDuration(Date.now() - item.at);
      return '• ' + item.text + ' · ' + age + ' ago';
    });
    return [
      '🧠 **' + label + ' · live engine report**',
      '**Progress:** ' + percent + '% ' + bar,
      '**Now:** ' + phase,
      '**Input:** ' + safeName + ' · ' + formatBytes(inputBytes),
      '**Elapsed:** ' + formatDuration(elapsed),
      '',
      '**Engine activity**',
      ...(recent.length ? recent : ['• Waiting for the engine to report its first operation.']),
      '',
      detail,
    ].join('\n');
  }

  async function publish(force = false) {
    if (stopped && !force) return;
    const now = Date.now();
    if (!force && now - lastEdit < 3500) return;
    if (editing) return;
    editing = true;
    lastEdit = now;
    try { await prompt.edit({ content: render(), components: [] }); } catch {}
    editing = false;
  }

  function onLine(rawLine) {
    const line = String(rawLine || '').replace(/\x1b\[[0-9;]*m/g, '').trim();
    if (!line) return;
    let match;

    if ((match = line.match(/obfuscator:\s*(.+)/i))) {
      advance(4, 'Fingerprinting the input', 'Engine identified the obfuscator family: ' + match[1].slice(0, 100), 'Obfuscator fingerprint matched: ' + match[1]);
    } else if ((match = line.match(/tracing .*?\(run\s+(\d+)\)/i))) {
      const pass = Number(match[1]);
      advance(5 + Math.min(20, pass / 16 * 20), 'Executing VM trace pass ' + pass, 'Observing runtime-created functions, constants, branches and VM state from this pass.', 'Runtime trace pass ' + pass + ' started; collecting VM behaviour.');
    } else if ((match = line.match(/([\d,]+) Path2D answers computed by the offline engine model/i))) {
      advance(27, 'Resolving Roblox API-dependent values', match[1] + ' Path2D answers were computed by the offline engine model.', 'Resolved ' + match[1] + ' offline Path2D model answers.');
    } else if ((match = line.match(/script loadstring.d\s+(\d+)\s+new VM chunk/i))) {
      advance(28, 'Capturing dynamically loaded chunks', 'The runtime exposed ' + match[1] + ' new VM chunk(s); the engine is adding them to the analysis set.', 'Captured ' + match[1] + ' new VM chunk(s) from dynamic loading.');
    } else if (/anti-tamper trap|anti-tamper trigger|LPH_CRASH/i.test(line)) {
      advance(29, 'Mapping protected execution paths', 'The engine reported an anti-tamper-related branch. Recording the event as an observed runtime condition.', 'Observed a protected branch / anti-tamper event in the trace.');
    } else if ((match = line.match(/devirt round\s+(\d+):\s*([\d,]+) functions\s*\(([\d,]+) walked\),\s*([\d,]+) unlifted blocks,\s*([\d,]+) new constant requests/i))) {
      const round = Number(match[1]);
      const p = 30 + Math.min(54, (round / 200) * 54);
      advance(p, 'Lifting VM functions · round ' + round + '/200', match[2] + ' functions discovered · ' + match[3] + ' walked · ' + match[4] + ' blocks still unlifted · ' + match[5] + ' new constant requests.', 'Round ' + round + ': ' + match[2] + ' functions discovered, ' + match[3] + ' walked, ' + match[4] + ' blocks still unlifted.');
    } else if ((match = line.match(/devirtualizing\s+\(round\s+(\d+)\)/i))) {
      const round = Number(match[1]);
      advance(30 + Math.min(54, (round / 200) * 54), 'Reconstructing Luau control flow · round ' + round, 'The VM lifter is processing this round. Progress is based on the engine round counter, not elapsed time.', 'Started devirtualization round ' + round + '.');
    } else if ((match = line.match(/([\d,]+) functions,\s*([\d,]+) unlifted blocks,\s*([\d,]+) unstructured jumps/i))) {
      advance(86, 'Measuring lift coverage', match[1] + ' functions · ' + match[2] + ' unlifted blocks · ' + match[3] + ' unstructured jumps.', 'Lift coverage report: ' + match[1] + ' functions; ' + match[2] + ' unlifted blocks; ' + match[3] + ' unstructured jumps.');
    } else if (/constants decoded on request|constant request run/i.test(line)) {
      advance(87, 'Resolving deferred constants', line.replace(/^\[\*\]\s*/, '').slice(0, 150), 'Engine requested another constant-resolution pass.');
    } else if (/corrupt\/encrypted register|symbolic value store|unlifted block|unstructured jump/i.test(line)) {
      advance(88, 'Recording unresolved VM operations', line.replace(/^\[!\]\s*/, '').slice(0, 150), 'The engine reported an unresolved VM operation; it will be reflected in validation.');
    } else if (/devirtualization failed|devirtualization produced no output|devirtualized output is broken/i.test(line)) {
      advance(89, 'Reviewing incomplete reconstruction', line.replace(/^\[!\]\s*/, '').slice(0, 150), 'The engine reported a reconstruction issue; the candidate will not be assumed complete.');
    } else if (/result:|run status: finished|done:.*succeeded/i.test(line)) {
      advance(90, 'Engine pass returned', line.replace(/^\[\*\]\s*/, '').slice(0, 150), 'An engine pass returned; artifact validation is next.');
    } else if (/^\[!\]|\bwarning\b|\berror\b/i.test(line)) {
      advance(percent, 'Inspecting engine diagnostic', line.slice(0, 150), line.slice(0, 150));
    }

    void publish(false);
  }

  const timer = setInterval(() => { void publish(false); }, 4000);

  return {
    start: () => {
      advance(2, 'Initializing selected engine', 'Preparing the engine process and analysis workspace.', 'Analysis workspace prepared; engine startup requested.');
      return publish(true);
    },
    onLine,
    setPhase: async (nextPhase, nextDetail) => {
      const normalized = String(nextPhase || '');
      let floor = percent;
      if (/prepar/i.test(normalized)) floor = Math.max(floor, 3);
      else if (/compatibility pass/i.test(normalized)) floor = Math.max(floor, 30);
      else if (/validat|checking|packaging|finaliz/i.test(normalized)) floor = Math.max(floor, 91);
      advance(floor, normalized, nextDetail || '', normalized + (nextDetail ? ': ' + nextDetail : ''));
      await publish(true);
    },
    complete: async (nextDetail) => {
      advance(100, 'Finished', nextDetail || 'Engine run and output handling completed.', 'Run finished; final status is based on the output validation result.');
      stopped = true;
      clearInterval(timer);
      await publish(true);
    },
    fail: async (error) => {
      advance(percent, 'Stopped with an error', String(error && (error.message || error) || 'Unknown engine error').slice(0, 220), 'Run stopped before completion.');
      stopped = true;
      clearInterval(timer);
      await publish(true);
    },
    stop: () => { stopped = true; clearInterval(timer); },
  };
}

function runCommand(command, args, cwd, timeoutMs, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
      windowsHide: true,
      env: { ...process.env, ...(options.env || {}) },
    });

    let stdout = '';
    let stderr = '';
    let pendingStderr = '';
    let timedOut = false;

    child.stdout.on('data', (chunk) => {
      if (stdout.length < 48_000) stdout += chunk.toString().slice(0, 48_000 - stdout.length);
    });

    child.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      if (stderr.length < 64_000) stderr += text.slice(0, 64_000 - stderr.length);
      pendingStderr += text;
      let newline;
      while ((newline = pendingStderr.indexOf('\n')) !== -1) {
        const line = pendingStderr.slice(0, newline).trim();
        pendingStderr = pendingStderr.slice(newline + 1);
        if (line && options.onProgress) options.onProgress(line);
      }
    });

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, timeoutMs);

    child.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });

    child.once('close', (code, signal) => {
      clearTimeout(timer);
      if (pendingStderr.trim() && options.onProgress) options.onProgress(pendingStderr.trim());
      if (timedOut || signal === 'SIGKILL') {
        return reject(new Error('The engine exceeded its ' + formatDuration(timeoutMs) + ' processing limit.'));
      }
      if (code !== 0) {
        const raw = (stderr || stdout).trim();
        const lines = raw.split('\n').filter(Boolean);
        const detail = lines.length > 18 ? [...lines.slice(0, 12), '…', ...lines.slice(-6)].join('\n') : lines.join('\n');
        return reject(new Error(detail || ('Deobfuscator exited with code ' + code + '.')));
      }
      resolve({ stdout, stderr });
    });
  });
}

function runEngine(engineDir, engineCli, inputPath, outputPath, timeoutMs, legacy = false, extraArgs = [], options = {}) {
  const args = [
    legacy ? '--max-old-space-size=512' : '--max-old-space-size=1024',
    engineCli,
    inputPath,
    '-o',
    outputPath,
    ...(legacy ? ['--steps', '180000'] : ['--timeout', '180']),
    ...extraArgs,
  ];
  return runCommand(process.execPath, args, engineDir, timeoutMs, options);
}

function runPythonEngine(engineDir, engineCli, inputPath, outputPath, timeoutMs, extraArgs = [], options = {}) {
  const python = process.env.PYTHON_BIN || (process.platform === 'win32' ? 'python' : 'python3');
  return runCommand(python, [engineCli, inputPath, '-o', outputPath, ...extraArgs], engineDir, timeoutMs, options);
}


async function cleanLuraph151Candidate(filePath, engineDir) {
  const rawPath = filePath.replace(/\.luau$/i, '.raw.luau');
  let backupMade = false;
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    if (!raw.trim()) return { cleaned: false, reason: 'empty' };
    await fs.copyFile(filePath, rawPath);
    backupMade = true;

    const cleaner = path.join(__dirname, 'scripts', 'luau-cleaner.js');
    await runCommand(process.execPath, [cleaner, rawPath, filePath], __dirname, 120_000);
    const cleaned = await fs.readFile(filePath, 'utf8');
    if (!cleaned.trim()) throw new Error('cleaner produced an empty file');

    // The formatter is intentionally conservative, but still verify its output.
    // Keep the raw lifter output if formatting damaged Luau syntax.
    const parser = path.join(engineDir, 'bin', 'luau-ast');
    await runCommand(parser, [filePath], engineDir, 120_000);

    return {
      cleaned: true,
      beforeBytes: Buffer.byteLength(raw),
      afterBytes: Buffer.byteLength(cleaned),
      syntaxChecked: true,
    };
  } catch (error) {
    if (backupMade) await fs.copyFile(rawPath, filePath).catch(() => {});
    return {
      cleaned: false,
      reason: String(error.message || error).slice(0, 180),
      restoredRaw: backupMade,
    };
  }
}

async function inspectLiftFile(filePath, engineDir) {
  let content = '';
  try {
    content = await fs.readFile(filePath, 'utf8');
  } catch {
    return {
      candidate: false,
      complete: false,
      issues: ['The VM lifter did not produce a source candidate.'],
      metrics: {},
      categories: {
        syntax: { status: 'not_checked' },
        vmReconstruction: { status: 'incomplete' },
        registerRecovery: { status: 'not_proven' },
        functionReferences: { status: 'not_proven' },
        runtimeOperations: { status: 'not_proven' },
        devirtualizationStubs: { status: 'not_proven' },
        controlFlow: { status: 'not_proven' },
        behavioralConsistency: { status: 'not_checked' },
      },
      score: -1,
      bytes: 0,
      syntaxChecked: false,
      syntaxValid: false,
    };
  }

  const assessment = inspectLiftText(content);
  assessment.bytes = Buffer.byteLength(content, 'utf8');
  assessment.syntaxChecked = false;
  assessment.syntaxValid = null;

  if (assessment.candidate) {
    const parser = path.join(engineDir, 'bin', 'luau-ast');
    try {
      await runCommand(parser, [filePath], engineDir, 120_000);
      assessment.syntaxChecked = true;
      assessment.syntaxValid = true;
      assessment.categories = assessment.categories || {};
      assessment.categories.syntax = { status: 'valid' };
      assessment.score += assessment.complete ? 10_000 : 1_000;
    } catch (error) {
      assessment.syntaxChecked = true;
      assessment.syntaxValid = false;
      assessment.categories = assessment.categories || {};
      assessment.categories.syntax = { status: 'invalid' };
      assessment.complete = false;
      assessment.score -= 50_000;
      assessment.issues.push(
        'Luau AST syntax validation failed: ' + String(error.message || error).slice(0, 260)
      );
    }
  }

  return assessment;
}

function validationIssueText(assessment) {
  if (!assessment || assessment.complete) return 'No structural or syntax issues were detected.';
  return assessment.issues.length
    ? assessment.issues.map((issue) => '- ' + issue).join('\n')
    : '- No complete source candidate was produced.';
}

async function sendAnalysisOutput(message, input, config) {
  const base = config.base;
  const outputDir = config.outputDir;
  const liftedPath = base + '.devirt.luau';
  const defaultTracePath = base + '.luau';
  const preservedTracePath = base + '.trace.luau';
  const protoPath = base + '.protos.json';
  const stringsPath = base + '.strings.txt';
  const reportPath = path.join(outputDir, 'analysis-report.txt');

  async function fileSize(filePath) {
    try {
      return (await fs.stat(filePath)).size;
    } catch {
      return 0;
    }
  }

  const liftedBytes = await fileSize(liftedPath);
  const validation = await inspectLiftFile(
    liftedPath,
    config.engineDir || ENGINE_V15_DIR
  );
  const hasLiftCandidate = validation.candidate && liftedBytes > 0;
  const hasLiftedSource = validation.complete && hasLiftCandidate;
  const preservedTraceBytes = await fileSize(preservedTracePath);
  const preferredTracePath = preservedTraceBytes > 0
    ? preservedTracePath
    : (!hasLiftedSource ? defaultTracePath : null);
  const traceBytes = preferredTracePath ? await fileSize(preferredTracePath) : 0;
  const protoBytes = await fileSize(protoPath);
  const stringBytes = await fileSize(stringsPath);
  const directoryEntries = await fs.readdir(outputDir);
  const chunkFiles = directoryEntries
    .filter((name) => name.startsWith(path.basename(base) + '.chunk_') && name.endsWith('.luau'))
    .sort();

  let prototypeCount = 0;
  if (protoBytes > 0 && protoBytes <= 12 * 1024 * 1024) {
    try {
      const parsed = JSON.parse(await fs.readFile(protoPath, 'utf8'));
      const collection = parsed && parsed.protos && typeof parsed.protos === 'object'
        ? parsed.protos
        : parsed;
      if (Array.isArray(collection)) prototypeCount = collection.length;
      else if (collection && typeof collection === 'object') prototypeCount = Object.keys(collection).length;
    } catch {}
  }

  const engineLog = String(config.stderr || '');
  const otherEngineLog = String(config.otherEngineStderr || '');
  const isNotableEngineLog = (line) =>
    line.startsWith('[!]') ||
    ['[fn-bind-summary]', '[fn-stub-summary]', '[register-summary]', '[regfile]', '[sp]', '[sp-value]', '[walk]', '[walk-failed]', '[proto-edges]'].some((prefix) => line.startsWith(prefix)) ||
    /devirt round|devirtualizing \(round|loadstring.d .*VM chunk|anti-tamper/i.test(line);
  const notableLogs = engineLog.split('\n')
    .map((line) => line.trim())
    .filter(isNotableEngineLog)
    .slice(-18);
  const otherNotableLogs = otherEngineLog.split('\n')
    .map((line) => line.trim())
    .filter(isNotableEngineLog)
    .slice(-12);
  const liftMatches = [...engineLog.matchAll(/([\d,]+) functions,\s*([\d,]+) unlifted blocks,\s*([\d,]+) unstructured jumps/g)];
  const liftStats = liftMatches.length ? liftMatches[liftMatches.length - 1] : null;
  const liftedFunctions = liftStats ? Number(liftStats[1].replaceAll(',', '')) : null;
  const unliftedBlocks = liftStats ? Number(liftStats[2].replaceAll(',', '')) : null;
  const unstructuredJumps = liftStats ? Number(liftStats[3].replaceAll(',', '')) : null;

  const resultLabel = hasLiftedSource
    ? 'FULL VM LIFT VERIFIED'
    : (hasLiftCandidate ? 'PARTIAL VM LIFT · VALIDATION FAILED' : 'BEHAVIOUR TRACE ONLY · VM LIFT NOT COMPLETED');

  const reportLines = [
    'DAILY DEOBF · ' + config.label + ' analysis report',
    'Result: ' + resultLabel,
    'Input: ' + String(input.filename || 'script.lua'),
    'Input size: ' + formatBytes(Buffer.byteLength(input.source, 'utf8')),
    'Elapsed: ' + formatDuration(config.elapsedMs || 0),
    'Engine: ' + String(config.engineName || 'Luraph analysis engine'),
    'Analysis mode: full VM capture with debug artifacts retained',
    'Maximum VM execution passes: ' + config.maxRuns,
    'Maximum devirtualization rounds: ' + config.devirtRounds,
    'Loader VM analysis: ' + (config.loaderAnalysis ? 'enabled' : 'disabled'),
    'Lifter functions processed: ' + (liftedFunctions === null ? 'not reported' : liftedFunctions),
    'Unlifted blocks: ' + (unliftedBlocks === null ? 'not reported' : unliftedBlocks),
    'Unstructured jumps: ' + (unstructuredJumps === null ? 'not reported' : unstructuredJumps),
    'Captured prototypes: ' + (prototypeCount || (protoBytes ? 'present, count unavailable' : 'not captured')),
    'Dynamic VM chunks: ' + chunkFiles.length,
    'String dump: ' + (stringBytes ? formatBytes(stringBytes) : 'not produced'),
    'Source candidate: ' + (hasLiftCandidate ? formatBytes(liftedBytes) : 'not produced'),
    'Lift validation: ' + (hasLiftedSource ? 'passed' : 'failed'),
    'Luau syntax check: ' + (validation.syntaxChecked ? (validation.syntaxValid ? 'passed' : 'failed') : 'not available because no source candidate was produced'),
    'Behaviour trace: ' + (traceBytes ? formatBytes(traceBytes) : 'not produced'),
    '',
    'Validation categories:',
    ...Object.entries(validation.categories || {}).map(([name, category]) =>
      '- ' + name + ': ' + category.status +
      (Number.isFinite(category.unresolved) ? ' (' + category.unresolved + ' unresolved)' : '')
    ),
    '',
    'Validation diagnostics:',
    ...validationIssueText(validation).split('\n'),
    '',
    'Validation detail samples:',
    ...(validation.details && validation.details.length
      ? validation.details.slice(0, 24).map((line) => '- ' + line)
      : ['- No source-level diagnostic samples were found.']),
    '',
    'Other engine diagnostics:',
    ...(otherNotableLogs.length
      ? otherNotableLogs
      : ['No additional diagnostics from the comparison engine.']),
    '',
    'Important:',
    hasLiftedSource
      ? 'The Luau source candidate passed structural checks and the Luau AST syntax parser. This verifies output integrity, not perfect equivalence to the original source.'
      : (hasLiftCandidate
        ? 'The source candidate is incomplete and is attached only for inspection. Do not treat it as recovered source. The separate behaviour trace records observed runtime behaviour.'
        : 'The attached trace records observed runtime behaviour. It is not the original source or a complete devirtualization.'),
    '',
    'Engine diagnostics:',
    ...(notableLogs.length ? notableLogs : ['No additional engine warnings were reported.']),
  ];
  if (Array.isArray(config.extraReportLines) && config.extraReportLines.length) {
    reportLines.push('', 'Additional reconstruction evidence:', ...config.extraReportLines.map((line) => '- ' + line));
  }
  await fs.writeFile(reportPath, reportLines.join('\n'), 'utf8');

  const attachments = [];
  const candidatePath = hasLiftCandidate
    ? liftedPath
    : (traceBytes ? preferredTracePath : defaultTracePath);
  if (await fileSize(candidatePath) > 0) await prependDailyDeobfHeader(candidatePath);
  const candidateBytes = await fileSize(candidatePath);
  if (candidateBytes > 0 && candidateBytes <= MAX_OUTPUT_BYTES) {
    const candidateName = hasLiftedSource
      ? 'deobfuscated.luau'
      : (hasLiftCandidate ? 'partial_result.luau' : 'runtime_trace.luau');
    attachments.push(new AttachmentBuilder(await fs.readFile(candidatePath), { name: candidateName }));
  }
  if (!attachments.length) throw new Error('The engine did not produce a Luau output file.');

  const safeName = String(input.filename || 'script.lua').replaceAll(String.fromCharCode(96), '');
  let summary;
  if (hasLiftedSource) {
    summary = '**DAILY DEOBF · ' + config.label + '**\n✅ Luau candidate passed structural checks and syntax validation.\nProcessed: ' + safeName +
      '\nFunctions lifted: ' + (liftedFunctions === null ? 'see report' : liftedFunctions) +
      ' · Unlifted blocks: ' + (unliftedBlocks === null ? 'see report' : unliftedBlocks) +
      '\nCaptured prototypes: ' + (prototypeCount || 'see report') + ' · Dynamic VM chunks: ' + chunkFiles.length +
      '\nAttached: deobfuscated.luau';
  } else if (hasLiftCandidate) {
    summary = '**DAILY DEOBF · ' + config.label + '**\n⚠️ Partial VM lift only. Validation found unresolved VM output, so it is not labelled as recovered source.\nProcessed: ' + safeName +
      '\nAttached: partial_result.luau';
  } else {
    summary = '**DAILY DEOBF · ' + config.label + '**\n⚠️ Trace-only result. The full VM lift did not complete.\nProcessed: ' + safeName +
      '\nAttached: runtime_trace.luau (trace only, not reconstructed source).';
  }

  await message.reply({
    content: summary,
    files: attachments,
    allowedMentions: { repliedUser: false },
  });
  return { hasLiftedSource, hasLiftCandidate, prototypeCount, chunks: chunkFiles.length, validation };
}



async function processLuraphV14(message, prompt, input, version) {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'daily-deobf-v14-'));
  const inputPath = path.join(tempRoot, 'input.lua');
  const outputPath = path.join(tempRoot, 'deobfuscated.luau');
  const inputBytes = Buffer.byteLength(input.source, 'utf8');
  const progress = createAnalysisProgress(prompt, input.filename, inputBytes, 'Luraph v' + version);
  const startedAt = Date.now();

  try {
    await fs.writeFile(inputPath, input.source, { encoding: 'utf8', mode: 0o600 });
    await progress.setPhase(
      'Preparing the dedicated v' + version + ' engine',
      'Using the isolated v14.x VM frontend and shared Luau runtime.'
    );

    const result = await runPythonEngine(
      ENGINE_V14_DIR,
      ENGINE_V14_CLI,
      inputPath,
      outputPath,
      ENGINE_TIMEOUT_MS,
      [
        '--engine', version,
        '--debug',
        '--strings',
        '--trace-fallback',
        '--max-runs', '12',
        '--devirt-rounds', '200',
        '--timeout', '600',
        '--budget', '600',
      ],
      { onProgress: progress.onLine },
    );

    await progress.setPhase(
      'Checking the reconstructed Luau',
      'Separating a VM-lifted result from a behaviour trace before sending the file.'
    );

    const output = await fs.readFile(outputPath, 'utf8');
    if (!output.trim()) throw new Error('The v' + version + ' engine produced an empty result.');
    const isLifted = /^\s*--\s*Devirtualized with Luraph v14\./m.test(output.slice(0, 2500));
    const elapsedMs = Date.now() - startedAt;
    const report = [
      'DAILY DEOBF · Luraph v' + version + ' analysis report',
      'Result: ' + (isLifted ? 'STATIC VM LIFT GENERATED' : 'TRACE / PARTIAL RECOVERY'),
      'Input: ' + String(input.filename || 'script.lua'),
      'Input size: ' + formatBytes(inputBytes),
      'Elapsed: ' + formatDuration(elapsedMs),
      'Engine: dedicated Luraph v' + version + ' frontend',
      'VM lift: ' + (isLifted ? 'devirtualized-source header detected' : 'no devirtualized-source header detected'),
      '',
      'Engine progress log:',
      String(result.stderr || 'No diagnostic output was returned.').slice(-14000),
    ].join('\n');

    const resultName = 'Luraph_v' + version.replace('.', '_') +
      (isLifted ? '_devirtualized.luau' : '_partial_result.luau');
    await prependDailyDeobfHeader(outputPath);

    await message.reply({
      content: isLifted
        ? '**DAILY DEOBF · Luraph v' + version + '**\n✅ Static VM-lifted Luau generated.'
        : '**DAILY DEOBF · Luraph v' + version + '**\n⚠️ Partial result only. The attached file is not confirmed as fully reconstructed source.',
      files: [
        new AttachmentBuilder(outputPath, { name: resultName }),
      ],
      allowedMentions: { repliedUser: false },
    });

    await progress.complete(isLifted
      ? 'The Luau output file was attached.'
      : 'The partial Luau output file was attached and clearly labelled.');
    await prompt.edit({
      content: isLifted
        ? '✅ Luraph v' + version + ' analysis finished. Static VM-lifted Luau was generated.'
        : '⚠️ Luraph v' + version + ' analysis finished. The result is labelled as partial recovery.',
      components: [],
    });
  } catch (error) {
    await progress.fail(error);
    throw error;
  } finally {
    progress.stop();
    await fs.rm(tempRoot, { recursive: true, force: true }).catch(() => {});
  }
}

async function processLuraphV15(message, prompt, input) {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'daily-deobf-v15-'));
  const inputPath = path.join(tempRoot, 'input.lua');
  const outputDir = path.join(tempRoot, 'output');
  const outputPath = path.join(outputDir, 'deobfuscated.luau');
  const base = path.join(outputDir, 'deobfuscated');
  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(inputPath, input.source, { encoding: 'utf8', mode: 0o600 });
  const progress = createAnalysisProgress(prompt, input.filename, Buffer.byteLength(input.source, 'utf8'), 'Luraph v15');
  const startedAt = Date.now();

  try {
    await progress.start();
    const result = await runPythonEngine(
      ENGINE_V15_DIR, ENGINE_V15_CLI, inputPath, outputPath, ENGINE_TIMEOUT_MS,
      [
        '--obfuscator', 'luraph_v15', '--debug', '--strings',
        '--max-runs', '16', '--devirt-rounds', '200',
        '--budget', '60', '--timeout', '180', '--no-pypy',
      ],
      {
        env: {
          DEVIRT_FULL_ROUNDS: '1', DEVIRT_LOADERS: '1',
          DEVIRT_TIMING: '1', DEVIRT_ERRS: '1', DEVIRT_TB: '1',
          DEVIRT_WALK_LIMIT: '750000',
        },
        onProgress: progress.onLine,
      },
    );

    await progress.setPhase('Packaging v15 analysis artifacts', 'Collecting reconstructed Luau, the trace, strings and VM metadata.');
    const summary = await sendAnalysisOutput(message, input, {
      label: 'Luraph v15', engineName: 'Luraph v15 Python engine', engineDir: ENGINE_V15_DIR, base, outputDir,
      elapsedMs: Date.now() - startedAt, stderr: result.stderr,
      maxRuns: 16, devirtRounds: 200, loaderAnalysis: true,
    });
    await progress.complete(summary.hasLiftedSource
      ? 'A reconstructed Luau file and supporting analysis artifacts were attached.'
      : 'The trace and diagnostic artifacts were attached; the engine did not finish a full lift.');
    await prompt.edit({
      content: summary.hasLiftedSource
        ? '✅ Luraph v15 analysis finished. The Luau candidate passed validation.'
        : (summary.hasLiftCandidate
          ? '⚠️ Luraph v15 analysis finished with a partial VM lift. It is not marked as recovered source.'
          : '⚠️ Luraph v15 analysis finished without a full VM lift. Check the trace and analysis report.'),
      components: [],
    });
  } catch (error) {
    await progress.fail(error);
    throw error;
  } finally {
    progress.stop();
    await fs.rm(tempRoot, { recursive: true, force: true }).catch(() => {});
  }
}


async function processCenturion(message, prompt, input) {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'daily-deobf-centurion-'));
  const inputPath = path.join(tempRoot, 'input.lua');
  const outputDir = path.join(tempRoot, 'output');
  const python = process.env.PYTHON_BIN || (process.platform === 'win32' ? 'python' : 'python3');
  const luauBin = path.join(ENGINE_V15_DIR, 'bin');
  const centEnv = {
    CENT_LUAU_EXE: path.join(luauBin, process.platform === 'win32' ? 'luau.exe' : 'luau'),
    CENT_LUAU_AST: path.join(luauBin, process.platform === 'win32' ? 'luau-ast.exe' : 'luau-ast'),
  };
  const progress = createAnalysisProgress(
    prompt, input.filename, Buffer.byteLength(input.source, 'utf8'), 'Centurion'
  );

  try {
    await fs.mkdir(outputDir, { recursive: true });
    await fs.writeFile(inputPath, input.source, { encoding: 'utf8', mode: 0o600 });
    await progress.start();
    await progress.setPhase(
      'Fingerprinting the Centurion build',
      'Checking for the supported v6 static route. The separate v6.1 runtime is not bundled in this deployment.'
    );

    const fingerprintResult = await runCommand(
      python,
      [ENGINE_CENT_CLI, 'fingerprint', inputPath],
      ENGINE_CENT_DIR,
      60_000,
      { env: centEnv }
    );
    let fingerprint;
    try {
      fingerprint = JSON.parse(fingerprintResult.stdout);
    } catch {
      throw new Error('Centurion returned an unreadable fingerprint result.');
    }

    if (fingerprint.route === 'v6.1-sandbox') {
      throw new Error(
        'This is a Centurion v6.1 build, but this bot currently contains only the v6 static adapter. ' +
        'The original v6.1 path expects sandbox-copy-luraph/harness.py, and its runtime code is not wired into this adapter. ' +
        'Adding placeholder files will not enable v6.1.'
      );
    } else if (fingerprint.route !== 'v6-static') {
      throw new Error(
        'Centurion did not recognize this script as a supported v6/v6.1 build. ' +
        'Detected route: ' + String(fingerprint.route || 'unknown') + '.'
      );
    }

    await progress.setPhase(
      'Extracting Centurion v6 factories',
      'The static route extracts payload factory functions and decodes string escapes. This is a stage-one result, not a complete runnable reconstruction.'
    );

    const result = await runCommand(
      python,
      [ENGINE_CENT_CLI, 'deobfuscate', inputPath, '--out-dir', outputDir],
      ENGINE_CENT_DIR,
      ENGINE_TIMEOUT_MS,
      { env: centEnv, onProgress: progress.onLine }
    );

    const entries = await fs.readdir(outputDir);
    const preferred = fingerprint.route === 'v6-static'
      ? entries.find((name) => name.endsWith('_deobf_stage1.lua'))
      : (entries.find((name) => name.endsWith('_deobf_clean.lua')) ||
         entries.find((name) => name.endsWith('_maximal.lua')) ||
         entries.find((name) => name.endsWith('_deobf_stage1.lua')));
    if (!preferred) {
      const diagnostic = String(result.stdout || result.stderr || '').slice(-1200);
      throw new Error(
        'Centurion finished without producing a recovered Luau file.' +
        (diagnostic ? '\\n' + diagnostic : '')
      );
    }

    const outputPath = path.join(outputDir, preferred);
    const stat = await fs.stat(outputPath);
    if (!stat.size || stat.size > MAX_OUTPUT_BYTES) {
      throw new Error('Centurion output is empty or exceeds the 18 MB output limit.');
    }
    await prependDailyDeobfHeader(outputPath);
    const outputName = fingerprint.route === 'v6-static'
      ? 'Centurion_v6_stage1.luau'
      : 'Centurion_v6_1_result.luau';
    const factoryMatch = String(result.stdout || '').match(/"factories"\s*:\s*(\d+)/);
    const detail = fingerprint.route === 'v6-static'
      ? '\nExtracted payload factories: ' + (factoryMatch ? factoryMatch[1] : 'see file') +
        '\n⚠️ Stage-one static extraction only. It is not represented as complete runnable source.'
      : '\nCenturion v6.1 offline analysis produced a Luau candidate. Review it before treating it as complete.';

    await message.reply({
      content: '✅ **DAILY DEOBF · Centurion**\nDetected: ' + fingerprint.tag +
        '\nRoute: ' + fingerprint.route + detail +
        '\nAttached: ' + outputName,
      files: [new AttachmentBuilder(outputPath, { name: outputName })],
      allowedMentions: { repliedUser: false },
    });
    await progress.complete('The Centurion Luau output was attached.');
    await prompt.edit({
      content: '✅ Centurion analysis finished. Output: ' + outputName + '.',
      components: [],
    }).catch(() => {});
  } catch (error) {
    await progress.fail(error);
    throw error;
  } finally {
    progress.stop();
    await fs.rm(tempRoot, { recursive: true, force: true }).catch(() => {});
  }
}

function normalizeLuraph151Source(source) {
  const marker = '):Qg()(...);';
  const first = source.indexOf(marker);
  if (first < 0) return { source, removedBytes: 0 };

  const cleanEnd = first + marker.length;
  const duplicateTail = source.slice(cleanEnd);

  // Some copies of this sample have a 468-byte duplicate tail which starts
  // halfway through the word "function" ("unction(") and repeats the final
  // Qg() call. It is malformed appended data, not part of the first script.
  // Only trim this very specific, short, terminal pattern.
  const second = source.indexOf(marker, cleanEnd);
  const isDuplicateTail =
    duplicateTail.startsWith('unction(') &&
    duplicateTail.endsWith(marker) &&
    duplicateTail.lastIndexOf(marker) === duplicateTail.length - marker.length &&
    duplicateTail.length <= 4096 &&
    second === source.length - marker.length;

  if (!isDuplicateTail) return { source, removedBytes: 0 };
  const cleaned = source.slice(0, cleanEnd);
  return {
    source: cleaned,
    removedBytes: Buffer.byteLength(duplicateTail, 'utf8'),
  };
}

async function processLuraph151(message, prompt, input) {
  const normalized = normalizeLuraph151Source(input.source);
  const source = normalized.source;
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'daily-deobf-151-'));

  async function prepare(name) {
    const root = path.join(tempRoot, name);
    const inputPath = path.join(root, 'input.lua');
    const outputDir = path.join(root, 'output');
    const outputPath = path.join(outputDir, 'deobfuscated.luau');
    await fs.mkdir(outputDir, { recursive: true });
    await fs.writeFile(inputPath, source, { encoding: 'utf8', mode: 0o600 });
    return { root, inputPath, outputDir, outputPath, base: path.join(outputDir, 'deobfuscated') };
  }

  async function hasArtifacts(base) {
    for (const suffix of ['.protos.json', '.strings.txt', '.trace.luau', '.luau', '.devirt.luau']) {
      try {
        if ((await fs.stat(base + suffix)).size > 0) return true;
      } catch {}
    }
    return false;
  }

  const dedicated = await prepare('dedicated-15.1');
  const compatible = await prepare('v15-compatibility');
  const inputBytes = Buffer.byteLength(input.source, 'utf8');
  const progress = createAnalysisProgress(prompt, input.filename, inputBytes, 'Luraph 15.1');
  const startedAt = Date.now();
  let dedicatedLogs = '';
  let compatibilityLogs = '';
  let dedicatedError = null;
  let compatibilityError = null;
  let chosen = dedicated;
  let chosenEngineDir = ENGINE_151_DIR;
  let dedicatedValidation = null;
  let compatibilityValidation = null;

  try {
    if (normalized.removedBytes > 0) {
      await progress.setPhase(
        'Removed malformed duplicate tail',
        'Removed ' + normalized.removedBytes + ' trailing bytes that repeated the final Qg() call and began mid-token.'
      );
    }

    await progress.setPhase(
      'Running the dedicated 15.1 engine',
      'The 15.1 engine gets the first full reconstruction pass. Its output is checked for unresolved VM values and Luau syntax.'
    );

    try {
      const result = await runEngine(
        ENGINE_151_DIR,
        ENGINE_151_CLI,
        dedicated.inputPath,
        dedicated.outputPath,
        ENGINE_TIMEOUT_MS,
        false,
        [
          '--plugin', 'luraph_v15',
          '--debug',
          '--strings',
          '--max-runs', '16',
          '--devirt-rounds', '200',
          '--budget', '60',
          '--timeout', '180',
        ],
        {
          env: {
            DEVIRT_LOADERS: '1',
            DEVIRT_TIMING: '1',
            DEVIRT_ERRS: '1',
            DEVIRT_TB: '1',
            DEVIRT_FULL_ROUNDS: '1',
            DEVIRT_WALK_LIMIT: '750000',
          },
          onProgress: progress.onLine,
        },
      );
      dedicatedLogs += result.stderr || '';
    } catch (error) {
      dedicatedError = error;
      dedicatedLogs += '\n[!] dedicated 15.1 engine: ' + String(error.message || error) + '\n';
    }

    await progress.setPhase(
      'Checking the dedicated 15.1 candidate',
      'The dedicated pass returned. Inspecting its actual output for unresolved VM values, placeholder functions and Luau syntax before deciding whether to run the compatibility engine.'
    );

    await cleanLuraph151Candidate(dedicated.base + '.devirt.luau', ENGINE_151_DIR);

    dedicatedValidation = await inspectLiftFile(
      dedicated.base + '.devirt.luau',
      ENGINE_151_DIR
    );

    await progress.setPhase(
      dedicatedValidation.complete ? 'Dedicated candidate passed validation' : 'Dedicated candidate has unresolved output',
      dedicatedValidation.complete
        ? 'Structural checks and Luau AST validation passed for the dedicated candidate.'
        : 'Validation found: ' + (dedicatedValidation.issues || []).slice(0, 3).join('; ')
    );

    if (!dedicatedValidation.complete) {
      await progress.setPhase(
        'Running the v15 compatibility pass',
        'The dedicated 15.1 output did not pass validation. Running the independent v15 compatibility engine and comparing both candidates.'
      );

      try {
        const result = await runPythonEngine(
          ENGINE_V15_DIR,
          ENGINE_V15_CLI,
          compatible.inputPath,
          compatible.outputPath,
          ENGINE_TIMEOUT_MS,
          [
            '--obfuscator', 'luraph_v15',
            '--debug',
            '--strings',
            '--max-runs', '16',
            '--devirt-rounds', '200',
            '--budget', '60',
            '--timeout', '180',
            '--no-pypy',
          ],
          {
            env: {
              DEVIRT_FULL_ROUNDS: '1',
              DEVIRT_LOADERS: '1',
              DEVIRT_TIMING: '1',
              DEVIRT_ERRS: '1',
              DEVIRT_TB: '1',
              DEVIRT_WALK_LIMIT: '750000',
            },
            onProgress: progress.onLine,
          },
        );
        compatibilityLogs += result.stderr || '';
      } catch (error) {
        compatibilityError = error;
        compatibilityLogs += '\n[!] v15 compatibility pass: ' + String(error.message || error) + '\n';
      }

      await progress.setPhase(
        'Checking the v15 compatibility candidate',
        'The compatibility pass returned. Measuring its reconstruction quality and syntax independently from the dedicated 15.1 result.'
      );

      await cleanLuraph151Candidate(compatible.base + '.devirt.luau', ENGINE_V15_DIR);

      compatibilityValidation = await inspectLiftFile(
        compatible.base + '.devirt.luau',
        ENGINE_V15_DIR
      );

      await progress.setPhase(
        'Comparing both reconstruction candidates',
        'Dedicated candidate: ' + (dedicatedValidation.complete ? 'validated' : 'partial / failed validation') +
        '. Compatibility candidate: ' + (compatibilityValidation.complete ? 'validated' : 'partial / failed validation') + '.'
      );

      const dedicatedScore = dedicatedValidation.score ?? -1;
      const compatibilityScore = compatibilityValidation.score ?? -1;
      if (compatibilityScore > dedicatedScore || (!dedicatedValidation.candidate && compatibilityValidation.candidate)) {
        chosen = compatible;
        chosenEngineDir = ENGINE_V15_DIR;
      }
    }

    if (!(await hasArtifacts(chosen.base))) {
      const errors = [
        dedicatedError && ('Dedicated 15.1: ' + String(dedicatedError.message || dedicatedError)),
        compatibilityError && ('v15 compatibility: ' + String(compatibilityError.message || compatibilityError)),
      ].filter(Boolean);
      throw new Error(errors.join('\n') || 'Neither 15.1 analysis engine produced any diagnostic artifacts.');
    }

    const deepPrompt = await fs.readFile(
      path.join(__dirname, 'scripts', 'deep-reconstruction-prompt.txt'),
      'utf8'
    );
    await fs.writeFile(
      path.join(chosen.outputDir, 'analysis_input_original.lua'),
      input.source,
      { encoding: 'utf8', mode: 0o600 }
    );
    const extraArtifacts = [
      { path: 'analysis_input_original.lua', name: 'analysis_input_original.lua' },
    ];
    if (normalized.removedBytes > 0) {
      await fs.writeFile(
        path.join(chosen.outputDir, 'engine_input_normalized.lua'),
        source,
        { encoding: 'utf8', mode: 0o600 }
      );
      extraArtifacts.push({
        path: 'engine_input_normalized.lua',
        name: 'engine_input_normalized.lua',
      });
    }
    await fs.writeFile(
      path.join(chosen.outputDir, 'deep_reconstruction_instructions.txt'),
      deepPrompt,
      { encoding: 'utf8', mode: 0o600 }
    );
    extraArtifacts.push({
      path: 'deep_reconstruction_instructions.txt',
      name: 'deep_reconstruction_instructions.txt',
    });

    await progress.setPhase(
      'Validating and packaging the best candidate',
      'Comparing structural errors, placeholder functions, unresolved nil values and Luau AST validity.'
    );

    const summary = await sendAnalysisOutput(message, input, {
      label: chosen === dedicated
        ? 'Luraph 15.1 · dedicated engine'
        : 'Luraph 15.1 · v15 compatibility engine',
      engineName: chosen === dedicated ? 'Dedicated 15.1 engine' : 'v15 compatibility engine',
      engineDir: chosenEngineDir,
      base: chosen.base,
      outputDir: chosen.outputDir,
      elapsedMs: Date.now() - startedAt,
      stderr: chosen === dedicated ? dedicatedLogs : compatibilityLogs,
      otherEngineStderr: chosen === dedicated ? compatibilityLogs : dedicatedLogs,
      maxRuns: 16,
      devirtRounds: 200,
      loaderAnalysis: true,
      extraArtifacts,
      extraReportLines: [
        'analysis_input_original.lua is the unmodified source supplied to the bot.',
        ...(normalized.removedBytes > 0
          ? ['engine_input_normalized.lua is the exact source used by the engine; ' +
             normalized.removedBytes + ' malformed trailing bytes were removed.']
          : []),
        'deep_reconstruction_instructions.txt contains the requested behavior-preserving follow-up checklist.',
        'The checklist is an instruction for a separate reconstruction pass, not proof that every item was automatically completed.',
      ],
    });

    await progress.complete(summary.hasLiftedSource
      ? 'A Luau candidate passed structural checks and syntax validation.'
      : (summary.hasLiftCandidate
        ? 'Both engines were checked. The best source candidate remains partial and is labelled as such.'
        : 'Neither engine completed the VM lift. Trace and diagnostic artifacts are attached.'));

    await prompt.edit({
      content: summary.hasLiftedSource
        ? '✅ Luraph 15.1 finished. The best Luau candidate passed validation.'
        : (summary.hasLiftCandidate
          ? '⚠️ Luraph 15.1 finished with a partial VM lift. It is not marked as recovered source.'
          : '⚠️ Luraph 15.1 finished without a full VM lift. Check the trace and analysis report.'),
      components: [],
    });
  } catch (error) {
    await progress.fail(error);
    throw error;
  } finally {
    progress.stop();
    await fs.rm(tempRoot, { recursive: true, force: true }).catch(() => {});
  }
}



function buildIdxCaptureRunner(source) {
  const prelude = [
    '-- DAILY DEOBF .idx capture runner',
    '-- Captures string chunks passed to loadstring and saves them locally.',
    '-- The original source is appended below without being rewritten.',
    '',
    'local idx = 0',
    'local old = loadstring',
    'local environment = getgenv()',
    '',
    'assert(type(old) == "function", "loadstring is not available in this environment")',
    'assert(type(environment) == "table", "getgenv() did not return an environment table")',
    '',
    'environment.loadstring = newcclosure(function(chunk, ...)',
    '    if typeof(chunk) == "string" then',
    '        idx += 1',
    '        local filename = "loadstring" .. tostring(idx) .. ".txt"',
    '        local ok, err = pcall(writefile, filename, chunk)',
    '        if not ok then',
    '            warn("[DAILY DEOBF .idx] Could not save " .. filename .. ": " .. tostring(err))',
    '        end',
    '    end',
    '    return old(chunk, ...)',
    'end)',
    '',
    '-- Original input starts here.',
    '',
  ].join('\n');
  return prelude + source + (source.endsWith('\n') ? '' : '\n');
}

async function collectIdxFiles(message) {
  let attachments = [...message.attachments.values()];
  if (!attachments.length) {
    const prompt = await message.reply({
      content: 'Upload the generated loadstring1.txt, loadstring2.txt, and any other loadstringN.txt files in one message. I will return them as downloadable attachments.',
      allowedMentions: { repliedUser: false },
    });
    const collector = message.channel.createMessageCollector({
      filter: (reply) => reply.author.id === message.author.id && reply.channelId === message.channelId,
      time: INPUT_WAIT_MS,
      max: 1,
    });
    attachments = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        collector.stop('timeout');
        reject(new Error('Capture upload timed out. Run .idx files again.'));
      }, INPUT_WAIT_MS + 1000);
      collector.once('collect', (reply) => {
        clearTimeout(timer);
        collector.stop('received');
        const received = [...reply.attachments.values()];
        if (!received.length) reject(new Error('No capture files were attached.'));
        else resolve(received);
      });
      collector.once('end', (_collected, reason) => {
        if (reason === 'time' && collector.collected.size === 0) {
          clearTimeout(timer);
          reject(new Error('Capture upload timed out. Run .idx files again.'));
        }
      });
    });
    await prompt.edit({ content: 'Capture files received. Validating the filenames and contents...' }).catch(() => {});
  }

  if (attachments.length > MAX_IDX_CAPTURE_FILES) {
    throw new Error('Upload up to ' + MAX_IDX_CAPTURE_FILES + ' capture files per .idx files request.');
  }

  const names = new Set();
  const captures = [];
  let totalBytes = 0;
  for (const attachment of attachments) {
    const name = path.basename(String(attachment.name || ''));
    const match = /^loadstring(\d+)\.txt$/i.exec(name);
    if (!match) {
      throw new Error('Unexpected filename: ' + (name || '(unnamed)') +
        '. Capture files must be named loadstringN.txt.');
    }
    if (names.has(name.toLowerCase())) throw new Error('Duplicate capture filename: ' + name);
    names.add(name.toLowerCase());
    if (Number(attachment.size || 0) > MAX_INPUT_BYTES) {
      throw new Error(name + ' is larger than the 2 MB per-file limit.');
    }

    const response = await fetch(attachment.url, {
      redirect: 'error',
      signal: AbortSignal.timeout(15_000),
      headers: { 'user-agent': 'DAILY-DEOBF/1.0' },
    });
    if (!response.ok) throw new Error('Could not download ' + name + ' (HTTP ' + response.status + ').');
    const data = await readResponseLimited(response, MAX_INPUT_BYTES);
    decodeSource(data);
    totalBytes += data.length;
    if (totalBytes > MAX_OUTPUT_BYTES) {
      throw new Error('The combined capture files exceed the 18 MB response limit.');
    }
    captures.push({ name, data, index: Number(match[1]) });
  }

  captures.sort((a, b) => a.index - b.index || a.name.localeCompare(b.name));
  return captures;
}

async function handleIdxFiles(message) {
  const captures = await collectIdxFiles(message);
  const files = captures.map((capture) =>
    new AttachmentBuilder(capture.data, { name: capture.name })
  );
  await message.reply({
    content: '✅ Returned ' + captures.length + ' capture file(s): ' +
      captures.map((capture) => capture.name).join(', '),
    files,
    allowedMentions: { repliedUser: false },
  });
}

async function startIdxWorkflow(message, inlineSource = null) {
  const prompt = await message.reply({
    content: inlineSource
      ? '⚙️ DAILY DEOBF · .idx\nScanning for recoverable loadstring sources...'
      : '📄 DAILY DEOBF · .idx\nAttach a script or send a direct URL. Recovered sources will be packaged into one organized ZIP.',
    allowedMentions: { repliedUser: false },
  });
  const firstAttachment = message.attachments.first();
  if (inlineSource && firstAttachment) {
    throw new Error('Use either an inline loadstring expression or a file attachment, not both.');
  }

  let input;
  if (inlineSource) {
    input = { source: inlineSource, filename: 'inline-loadstring.lua' };
  } else if (firstAttachment) {
    input = await inputFromAttachment(firstAttachment);
  } else {
    input = await collectInput(message, prompt);
  }

  let sourceToScan = input.source;
  const trimmed = sourceToScan.trim();
  if (/^https?:\/\/\S+$/i.test(trimmed)) {
    sourceToScan = 'loadstring(game:HttpGet(' + JSON.stringify(trimmed) + '))()';
  }

  const resolution = await resolveLoadstringSources(sourceToScan, {
    maxFiles: MAX_IDX_CAPTURE_FILES,
    maxDepth: 8,
    fetchText: async (rawUrl) => {
      const fetched = await fetchPublicText(rawUrl);
      return { source: decodeSource(fetched.bytes), filename: fetched.filename };
    },
  });

  if (!resolution.discovered && !resolution.captures.length) {
    throw new Error(
      'No statically recoverable loadstring source was found. .idx supports literal loadstring strings, ' +
      'game:HttpGet(...), HttpGetAsync, HttpService:GetAsync, request({Url=...}), and literal URL variables. ' +
      'Dynamically generated URLs or runtime-only chunks cannot be recovered by static inspection.'
    );
  }

  // Reserve space for the ZIP directory, report and manifest so the final attachment
  // stays under the bot's response limit even when the source files are incompressible.
  const outputCaptures = [];
  let sourceBytes = 0;
  const omittedNames = [];
  const sourceByteLimit = MAX_OUTPUT_BYTES - (256 * 1024);
  for (const capture of resolution.captures) {
    const bytes = Buffer.byteLength(capture.source, 'utf8');
    if (sourceBytes + bytes > sourceByteLimit) {
      omittedNames.push(capture.name);
      continue;
    }
    outputCaptures.push(capture);
    sourceBytes += bytes;
  }

  const bundleDetails = {
    input: {
      filename: input.filename || 'inline-loadstring.lua',
      bytes: Buffer.byteLength(input.source, 'utf8'),
      url: input.url || null,
    },
    resolution,
    omittedNames,
  };
  let bundle = buildIdxBundle(outputCaptures, bundleDetails);

  // Compression can expand random-looking text slightly. Drop trailing files until
  // the archive is guaranteed to fit, while recording every omitted filename.
  while (bundle.buffer.length + bundle.reportBuffer.length > MAX_OUTPUT_BYTES && outputCaptures.length) {
    const removed = outputCaptures.pop();
    omittedNames.push(removed.name);
    bundle = buildIdxBundle(outputCaptures, { ...bundleDetails, omittedNames });
  }

  if (bundle.buffer.length + bundle.reportBuffer.length > MAX_OUTPUT_BYTES) {
    throw new Error('The IDX report bundle exceeded the output size limit. Please try a smaller input file.');
  }

  const remoteRecovered = bundle.remoteCount;
  const summary = [
    '✅ **.idx collection finished**',
    '',
    '**Recovered:** ' + bundle.recovered + ' source(s)  ·  ' +
      bundle.inlineCount + ' inline  ·  ' + remoteRecovered + ' downloaded',
    '**URL scan:** ' + resolution.discovered + ' discovered  ·  ' +
      resolution.attempts + ' attempted  ·  ' + resolution.failures.length + ' failed',
    '**Nested depth:** ' + bundle.maxDepthFound + '  ·  **Source data:** ' + formatBytes(bundle.totalBytes),
    '',
    '📦 idx_bundle.zip contains every included loadstringN.txt separately, plus a readable report, manifest, SHA-256 hashes and file previews.',
    '📄 idx_report.txt is attached separately for a quick overview. Extract the ZIP to access the source files.',
    ...(omittedNames.length
      ? ['', '⚠️ ' + omittedNames.length + ' file(s) were left out to stay under the output size limit. Their names are listed in the report.']
      : []),
    ...(resolution.truncated
      ? ['', '⚠️ The configured ' + resolution.maxFiles + '-source / ' + resolution.maxDepth + '-depth scan limit was reached.']
      : []),
    '',
    'Downloaded source is not executed. URL query strings are redacted in the report and manifest.',
  ].join('\n');

  await message.reply({
    content: summary,
    files: [
      new AttachmentBuilder(bundle.buffer, { name: 'idx_bundle.zip' }),
      new AttachmentBuilder(bundle.reportBuffer, { name: 'idx_report.txt' }),
    ],
    allowedMentions: { repliedUser: false },
  });

  await prompt.edit({
    content: '✅ .idx finished. Packaged ' + bundle.recovered + ' recovered source(s) into idx_bundle.zip.',
    components: [],
  }).catch(() => {});
}

async function startGetWorkflow(message, inlineSource = null) {
  const prompt = await message.reply({
    content: inlineSource
      ? '🔎 DAILY DEOBF · .get\nFinding static HTTP URLs and downloading readable source text...'
      : '🔎 DAILY DEOBF · .get\nAttach a script or send a URL. I will scan Roblox HTTP methods, request wrappers, URL fields, aliases and embedded loader strings.',
    allowedMentions: { repliedUser: false },
  });

  const firstAttachment = message.attachments.first();
  if (inlineSource && firstAttachment) {
    throw new Error('Use either an inline URL/expression or a file attachment, not both.');
  }

  let input;
  if (inlineSource) {
    input = { source: inlineSource, filename: 'get-input.lua' };
  } else if (firstAttachment) {
    input = await inputFromAttachment(firstAttachment);
  } else {
    input = await collectInput(message, prompt);
  }

  let sourceToScan = input.source;
  const trimmed = sourceToScan.trim();
  const initialUrls = [];
  if (/^https?:\/\/\S+$/i.test(trimmed)) {
    initialUrls.push(trimmed);
    sourceToScan = '';
  } else if (input.url) {
    initialUrls.push(input.url);
  }

  const resolution = await resolveStaticSources(sourceToScan, {
    initialUrls,
    maxFiles: MAX_GET_FILES,
    maxUrls: MAX_GET_URLS,
    maxAttempts: MAX_GET_ATTEMPTS,
    maxDepth: 8,
    fetchText: async (rawUrl) => {
      if (input.url && rawUrl === input.url) {
        return {
          source: input.source,
          finalUrl: input.url,
          contentType: 'input source',
          status: 200,
        };
      }
      const fetched = await fetchPublicText(rawUrl);
      return {
        source: decodeSource(fetched.bytes),
        finalUrl: fetched.finalUrl || rawUrl,
        contentType: fetched.contentType || 'unknown',
        status: fetched.status || null,
      };
    },
  });

  if (!resolution.discovered) {
    throw new Error(
      'No literal HTTP/HTTPS URL was found in the source. .get scans HttpGet/HttpGetAsync, ' +
      'HttpService GetAsync/PostAsync/RequestAsync, request/http_request and common aliases, ' +
      'Url/Uri/Endpoint table fields, URL string constants, and nested literal loadstring text. ' +
      'URLs built only at runtime (for example from encrypted pieces, game state or computed values) ' +
      'cannot be known by static inspection.'
    );
  }

  function reportUrl(raw) {
    try {
      const url = new URL(raw);
      url.username = '';
      url.password = '';
      url.hash = '';
      const query = url.search ? '?[query redacted]' : '';
      return url.origin + url.pathname + query;
    } catch {
      return String(raw || 'unknown URL').slice(0, 500);
    }
  }

  const attachments = [];
  let totalBytes = 0;
  const omittedNames = [];
  for (const capture of resolution.captures) {
    const data = Buffer.from(capture.source, 'utf8');
    if (totalBytes + data.length > MAX_OUTPUT_BYTES - 128 * 1024) {
      omittedNames.push(capture.name);
      continue;
    }
    attachments.push({
      name: capture.name,
      data,
      capture,
    });
    totalBytes += data.length;
  }

  const discoveryLines = (resolution.discoveries || []).map((item, index) => {
    const details = [
      String(index + 1).padStart(3, '0') + '.',
      reportUrl(item.url),
      'depth=' + item.depth,
      'status=' + item.status,
    ];
    if (item.filename) details.push('file=' + item.filename);
    if (item.error) details.push('error=' + item.error.replace(/[\r\n]+/g, ' ').slice(0, 500));
    return details.join(' | ');
  });

  const captureLines = resolution.captures.map((capture) => [
    capture.name,
    'depth=' + capture.depth,
    'bytes=' + Buffer.byteLength(capture.source, 'utf8'),
    'origin=' + reportUrl(capture.url || ''),
    'final=' + reportUrl(capture.finalUrl || capture.url || ''),
    'http=' + (capture.statusCode || 'n/a'),
    'content-type=' + (capture.contentType || 'unknown'),
    capture.inline ? 'inline source' : 'downloaded source',
  ].join(' | '));

  const failureLines = resolution.failures.map((failure, index) =>
    String(index + 1).padStart(3, '0') + '. ' + reportUrl(failure.url) +
    ' | depth=' + (failure.depth ?? 0) +
    ' | ' + String(failure.message || 'Unknown error').replace(/[\r\n]+/g, ' ').slice(0, 700)
  );

  const reportLines = [
    'DAILY DEOBF · .get COMPLETE STATIC DISCOVERY REPORT',
    'Input: ' + String(input.filename || 'get-input.lua'),
    'Input bytes: ' + Buffer.byteLength(input.source, 'utf8'),
    'Generated: ' + new Date().toISOString(),
    '',
    'SUMMARY',
    'Discovered URLs: ' + resolution.discovered,
    'Discovery records retained: ' + (resolution.discoveries || []).length,
    'Fetch attempts: ' + resolution.attempts,
    'Visited URLs: ' + resolution.visited,
    'Downloaded source files: ' + resolution.captures.length,
    'Failed URLs: ' + resolution.failures.length,
    'Remaining queued URLs: ' + (resolution.remaining || 0),
    'Output files attached: ' + attachments.length,
    'Output data attached: ' + formatBytes(totalBytes),
    'Output files omitted by combined size limit: ' + omittedNames.length,
    'Truncated by configured safety limits: ' + (resolution.truncated ? 'YES' : 'NO'),
    'Limits: max files=' + resolution.maxFiles +
      ', max discovered URLs=' + resolution.maxUrls +
      ', max attempts=' + resolution.maxAttempts +
      ', max depth=' + resolution.maxDepth,
    '',
    'DISCOVERED URLS (including queued and failed URLs)',
    ...(discoveryLines.length ? discoveryLines : ['None.']),
    '',
    'DOWNLOADED FILE DETAILS',
    ...(captureLines.length ? captureLines : ['No source files were downloaded.']),
    '',
    'FAILED FETCHES',
    ...(failureLines.length ? failureLines : ['None.']),
    ...(omittedNames.length
      ? ['', 'OMITTED OUTPUT FILES (combined output-size limit)', ...omittedNames]
      : []),
    '',
    'DISCOVERY COVERAGE',
    'Roblox methods: game:HttpGet, game.HttpGet(game, url), HttpGetAsync, HttpService:GetAsync, PostAsync, RequestAsync.',
    'Request wrappers: request, syn.request, http_request, http.request and statically aliased forms.',
    'Other patterns: get/fetch-style URL arguments, Url/URI/Endpoint/BaseUrl table keys, bracket-key fields, literal URL strings and URL variables.',
    'Embedded code: recursively scans literal source passed to loadstring, including long-bracket strings.',
    '',
    'DOWNLOAD BEHAVIOUR',
    'Only public HTTP/HTTPS GET downloads are attempted. The script is never executed.',
    'POST/PUT/DELETE request bodies are not replayed. A URL found inside such request configuration is treated as a URL candidate and GET is attempted only.',
    'Redirect destinations are rechecked for public-address safety. Common GitHub blob links are converted to raw file links.',
    'Query strings and credentials are redacted in this report to avoid leaking tokens.',
    'Static scanning cannot evaluate encrypted URLs, runtime concatenation dependent on values, generated signatures, game state or dynamically returned URLs.',
    '',
  ];

  const reportBuffer = Buffer.from(reportLines.join('\n'), 'utf8');
  const batches = [];
  for (let i = 0; i < attachments.length; i += 10) {
    batches.push(attachments.slice(i, i + 10));
  }

  if (!batches.length) {
    const reason = resolution.failures.length
      ? 'Every discovered URL failed to download. The attached report lists the exact HTTP, DNS, TLS or content error for each URL.'
      : 'URLs were found, but no readable source files were returned. The attached report lists every discovery record.';
    await message.reply({
      content: '⚠️ **.get found ' + resolution.discovered + ' URL(s), but downloaded 0 source files.** ' + reason,
      files: [new AttachmentBuilder(reportBuffer, { name: 'get_report.txt' })],
      allowedMentions: { repliedUser: false },
    });
  } else {
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      await message.reply({
        content: batchIndex === 0
          ? '✅ **.get downloaded ' + attachments.length + ' source file(s).** Sending individual getN.lua attachments in ' +
            batches.length + ' batch(es). Discovered ' + resolution.discovered +
            ' URL(s); ' + resolution.failures.length + ' failed.'
          : '**.get files · batch ' + (batchIndex + 1) + '/' + batches.length + '**',
        files: batch.map((item) =>
          new AttachmentBuilder(item.data, { name: item.name })
        ),
        allowedMentions: { repliedUser: false },
      });
    }

    await message.reply({
      content: '📋 **.get complete report** · ' + resolution.discovered +
        ' URL(s), ' + resolution.attempts + ' fetch attempt(s), ' +
        resolution.failures.length + ' failed.',
      files: [new AttachmentBuilder(reportBuffer, { name: 'get_report.txt' })],
      allowedMentions: { repliedUser: false },
    });
  }

  await prompt.edit({
    content: attachments.length
      ? '✅ .get completed. Sent ' + attachments.length +
        ' individual getN.lua file(s). The full URL-by-URL report is attached separately.'
      : '⚠️ .get completed. No source files downloaded; get_report.txt contains per-URL failure details.',
    components: [],
  }).catch(() => {});
}


function getExecAllowedUsers() {
  return new Set(
    String(process.env.ROBLOX_EXEC_ALLOWED_USERS || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
  );
}

function cleanLuauInput(source) {
  return String(source || '').trim();
}

async function collectExecInput(message, prompt) {
  const collector = message.channel.createMessageCollector({
    filter: (reply) => reply.author.id === message.author.id && reply.channelId === message.channelId,
    time: INPUT_WAIT_MS,
    max: 1,
  });

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      collector.stop('timeout');
      reject(new Error('Input timed out. Run .exec again.'));
    }, INPUT_WAIT_MS + 1000);

    collector.once('collect', async (reply) => {
      clearTimeout(timer);
      collector.stop('received');
      try {
        if (reply.content.trim().toLowerCase() === '.cancel') {
          throw new Error('Cancelled.');
        }
        const attachment = reply.attachments.first();
        if (attachment) {
          const input = await inputFromAttachment(attachment);
          resolve(input.source);
          return;
        }
        const source = cleanLuauInput(reply.content);
        if (!source) throw new Error('Send Luau source or attach a .lua/.luau/.txt file.');
        resolve(source);
      } catch (error) {
        reject(error);
      }
    });

    collector.once('end', (_collected, reason) => {
      if (reason === 'time' && collector.collected.size === 0) {
        clearTimeout(timer);
        reject(new Error('Input timed out. Run .exec again.'));
      }
    });

    prompt.edit({
      content: 'Send Luau source as a message or attach a .lua, .luau, or .txt file. Type .cancel to stop.',
    }).catch(() => {});
  });
}

function formatExecResult(result) {
  const task = result.task || {};
  const lines = [
    'DAILY DEOBF · Roblox Open Cloud Luau execution',
    'State: ' + String(task.state || 'UNKNOWN'),
    'Elapsed: ' + formatDuration(result.elapsedMs || 0),
    'Polls: ' + String(result.polls || 0),
    'Task: ' + String(result.taskPath || 'not supplied'),
    '',
  ];

  if (task.error) {
    lines.push(
      'Execution error:',
      typeof task.error === 'string' ? task.error : JSON.stringify(task.error, null, 2),
      ''
    );
  }

  const returnValues = task.output && task.output.results;
  if (returnValues !== undefined) {
    lines.push('Return values:', JSON.stringify(returnValues, null, 2), '');
  }

  lines.push(
    'Logs:',
    ...(result.logs && result.logs.length ? result.logs.map((line) => String(line)) : ['(No log messages returned.)'])
  );

  return lines.join('\n');
}

async function startExecWorkflow(message, inlineSource = null) {
  const allowedUsers = getExecAllowedUsers();
  if (!allowedUsers.has('*') && !allowedUsers.has(message.author.id)) {
    throw new Error(
      allowedUsers.size
        ? 'You are not on the .exec allowlist.'
        : '.exec is disabled. Configure ROBLOX_EXEC_ALLOWED_USERS in Railway first.'
    );
  }

  const apiKey = process.env.ROBLOX_OPEN_CLOUD_API_KEY;
  const universeId = process.env.ROBLOX_EXEC_UNIVERSE_ID;
  const placeId = process.env.ROBLOX_EXEC_PLACE_ID;
  if (!apiKey || !universeId || !placeId) {
    throw new Error(
      'Missing Railway variables. Set ROBLOX_OPEN_CLOUD_API_KEY, ROBLOX_EXEC_UNIVERSE_ID, and ROBLOX_EXEC_PLACE_ID.'
    );
  }

  const prompt = await message.reply({
    content: '🧪 DAILY DEOBF · .exec\nPreparing an Open Cloud Luau task for your configured Roblox test place...',
    allowedMentions: { repliedUser: false },
  });

  const attachment = message.attachments.first();
  if (inlineSource && attachment) {
    throw new Error('Use inline Luau or an attached file, not both.');
  }

  let source = inlineSource;
  if (!source && attachment) {
    const input = await inputFromAttachment(attachment);
    source = input.source;
  } else if (!source) {
    source = await collectExecInput(message, prompt);
  }

  source = cleanLuauInput(source);
  if (!source) throw new Error('The Luau source is empty.');
  if (Buffer.byteLength(source, 'utf8') > MAX_INPUT_BYTES) {
    throw new Error('The Luau source exceeds the 2 MB input limit.');
  }

  const configuredTimeout = Number(process.env.ROBLOX_EXEC_TIMEOUT_SECONDS || 30);
  const timeoutSeconds = Number.isInteger(configuredTimeout)
    ? Math.max(1, Math.min(300, configuredTimeout))
    : 30;

  await prompt.edit({
    content: '🚀 DAILY DEOBF · .exec\nSubmitting Luau to Roblox Open Cloud...\nTarget: configured Roblox test place\nTimeout: ' + timeoutSeconds + ' seconds',
    components: [],
  });

  let result;
  try {
    result = await runLuauTask({
      apiKey,
      universeId,
      placeId,
      script: source,
      timeoutSeconds,
      onStatus: (status) => {
        if (status.polls === 1 || status.polls % 5 === 0) {
          prompt.edit({
            content: '⏳ DAILY DEOBF · .exec\nRoblox task state: ' + status.state +
              '\nElapsed: ' + formatDuration(status.elapsedMs) +
              '\nWaiting for the Roblox runtime to finish...',
            components: [],
          }).catch(() => {});
        }
      },
    });
  } catch (error) {
    await prompt.edit({
      content: '❌ .exec stopped: ' + String(error.message || error).slice(0, 1200),
      components: [],
    }).catch(() => {});
    throw error;
  }

  const output = formatExecResult(result);
  let outputBuffer = Buffer.from(output, 'utf8');
  if (outputBuffer.length > MAX_OUTPUT_BYTES) {
    outputBuffer = Buffer.from(
      output.slice(0, MAX_OUTPUT_BYTES - 500) +
        '\n\n[Output shortened by DAILY DEOBF size limit.]',
      'utf8'
    );
  }
  const state = String(result.task.state || 'UNKNOWN').toUpperCase();
  const succeeded = !result.task.error && ['COMPLETE', 'COMPLETED', 'SUCCESS', 'SUCCEEDED'].includes(state);

  await message.reply({
    content: (succeeded ? '✅' : '⚠️') + ' Roblox execution ' +
      (succeeded ? 'finished.' : 'returned ' + state + '.') +
      '\nElapsed: ' + formatDuration(result.elapsedMs) +
      '\nFull result and logs are attached.',
    files: [new AttachmentBuilder(outputBuffer, { name: 'roblox-execution-result.txt' })],
    allowedMentions: { repliedUser: false },
  });

  await prompt.edit({
    content: (succeeded ? '✅' : '⚠️') + ' .exec finished. Roblox task state: ' + state + '.',
    components: [],
  }).catch(() => {});
}

async function handlePureLuauCommand(interaction) {
  const attachment = interaction.options.getAttachment('file');
  const pastedSource = interaction.options.getString('source');
  if (!attachment && !pastedSource) {
    await interaction.reply({
      content: 'Upload a .lua/.luau file or paste source text in the source option.',
      ephemeral: true,
    });
    return;
  }
  if (attachment && pastedSource) {
    await interaction.reply({
      content: 'Provide either a file or pasted source, not both.',
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply({ ephemeral: true });
  try {
    let source;
    let originalName = 'pasted-source.lua';
    if (attachment) {
      originalName = path.basename(String(attachment.name || 'uploaded.lua').replace(/\\/g, '/'));
      if (!/\.(?:lua|luau|txt)$/i.test(originalName)) {
        await interaction.editReply('Only .lua, .luau, or .txt files are supported.');
        return;
      }
      if (Number(attachment.size || 0) > MAX_INPUT_BYTES) {
        await interaction.editReply('The file exceeds the 2 MB input limit. Nothing was processed.');
        return;
      }
      const response = await fetch(attachment.url, {
        redirect: 'error',
        signal: AbortSignal.timeout(15_000),
        headers: { 'user-agent': 'DAILY-DEOBF/1.0' },
      });
      if (!response.ok) throw new Error('Discord file download returned HTTP ' + response.status + '.');
      const buffer = await readResponseLimited(response, MAX_INPUT_BYTES);
      source = decodeSource(buffer);
    } else {
      source = pastedSource;
    }

    if (source.length > MAX_PURELUA_CHARS) {
      await interaction.editReply(
        'This source contains ' + source.length.toLocaleString() +
        ' characters, above the complete-processing limit of ' + MAX_PURELUA_CHARS.toLocaleString() +
        '. I did not truncate or partially convert it.'
      );
      return;
    }

    const result = convertToPureLuau(source);
    const convertedBuffer = Buffer.from(result.output, 'utf8');
    if (convertedBuffer.length > MAX_OUTPUT_BYTES) {
      await interaction.editReply('The converted file exceeds the 18 MB output limit. The original was left unchanged.');
      return;
    }

    const extension = path.extname(originalName);
    const baseName = path.basename(originalName, extension).replace(/[^A-Za-z0-9._-]/g, '_') || 'converted';
    const convertedName = 'pureluau-' + baseName + '.lua';
    const reportLines = [
      'DAILY DEOBF · PureLuau static conversion report',
      'Original: ' + originalName,
      'Converted: ' + convertedName,
      'Lines processed: ' + result.linesProcessed.toLocaleString(),
      'Identifiers renamed: ' + result.identifiersRenamed,
      'Context-based readability names: ' + result.readabilityRenamedIdentifiers,
      'Lines reformatted: ' + result.formattedLines,
      'Formatting engine: ' + result.formatterUsed,
      'Formatter parse check: ' + (result.formatterSyntaxValidated ? 'PASS' : 'NOT VALIDATED'),
      ...(result.formatterError ? ['Formatter note: ' + result.formatterError.slice(0, 300)] : []),
      'Executor API occurrences found: ' + result.executorApisFound,
      'Executor API calls removed: ' + result.executorApisReplaced,
      'Unsupported dependencies remaining: ' + result.unsupportedDependenciesRemaining,
      'Remaining API names: ' + (result.unsupportedNames.length ? result.unsupportedNames.join(', ') : 'None detected'),
      'Legacy calls modernized: ' + result.legacyCallsReplaced,
      'Escaped strings decoded: ' + result.decodedEscapedStrings,
      'Numeric expressions folded: ' + result.foldedNumericExpressions,
      'Static string calls folded: ' + result.foldedStringCharCalls + result.foldedStringCalls,
      'Static table/bit32/base64 calls folded: ' +
        (result.foldedTableConcatCalls + result.foldedBit32Calls + result.foldedBase64Calls),
      'Static decoder loops simplified: ' + result.decodedStateMachines,
      'Recovered static strings: ' + (result.decodedStaticStrings.length
        ? result.decodedStaticStrings.map((value) => JSON.stringify(value.slice(0, 120))).join(' | ')
        : 'None'),
      'Lexical validation: ' + (result.lexicalValidationPassed ? 'PASS' : 'CHECK FAILED'),
      'Structural validation: ' + (result.structuralValidationPassed ? 'PASS' : 'REVIEW REQUIRED'),
      'Structural findings: ' + (result.structuralDiagnostics.length
        ? result.structuralDiagnostics.slice(0, 6).join(' | ').slice(0, 900)
        : 'None'),
      'Recognized VM markers: ' + (result.coverage.vmIndicators.join(', ') || 'None'),
      'Detected syntax markers: ' + (result.coverage.luauSyntax.join(', ') || 'None'),
      'Full syntax status: ' + result.syntaxValidation,
      '',
      'Static conversion only. No source was executed. Executor-only APIs were preserved, not silently deleted.',
      'This readability pass does not establish full VM/control-flow reconstruction or prove behavioral equivalence.',
    ];
    await interaction.editReply({
      content: '✅ PureLuau conversion complete.\nConverted file: ' + convertedName +
        '\nThe full static analysis report is attached separately.',
      files: [
        new AttachmentBuilder(convertedBuffer, { name: convertedName }),
        new AttachmentBuilder(Buffer.from(reportLines.join('\n'), 'utf8'), {
          name: 'pureluau-report-' + baseName + '.txt',
        }),
      ],
    });
  } catch (error) {
    console.error('PureLuau conversion failed:', error);
    await interaction.editReply(
      'I could not complete this conversion: ' + String(error.message || error).slice(0, 700) +
      '. The original file was not modified.'
    ).catch(() => {});
  }
}

function helpText() {
  return [
    'DAILY DEOBF commands',
    '',
    '.deobf - upload a script or paste a direct URL, then choose Luraph 14.x/15/15.1 or Centurion.',
    '.idx <loadstring expression> - recover inline and nested sources into one ZIP with numbered files, a readable report, manifest, previews and SHA-256 hashes (up to 50 sources).',
    '.idx - attach a script or paste a direct URL; results arrive as idx_bundle.zip plus idx_report.txt.',
    '.idx files - re-send up to 10 extracted loadstringN.txt files as individual attachments.',
    '.get <URL or script/expression> - fetch remote scripts using HttpGet, GetAsync and request({Url=...}) patterns, following nested static links.',
    '.exec <Luau source> - execute Luau through Roblox Open Cloud in your configured test place (allowlist only).',
    '.help - show this command list.',
    '/purelua or /pureluau - run the static PureLuau readability/conversion pass and return the source plus a report.',
    '',
    '.idx collects inline literal loadstrings and nested remote sources; .get discovers broader static HTTP fetches. Neither command executes Luau on the bot.'
  ].join('\n');
}

async function startWorkflow(message, inlineText = null) {
  const prompt = await message.reply({
    content: '📄 **DAILY DEOBF**\nSend a `.lua`, `.luau`, or `.txt` file, or paste a direct URL to your Luau script.\n\nMaximum input size: 2 MB.',
    allowedMentions: { repliedUser: false },
  });
  // Accept an attachment, a URL / HttpGet expression on the command,
  // or a URL / HttpGet expression in the follow-up message.
  const firstAttachment = message.attachments.first();
  const input = firstAttachment
    ? await inputFromAttachment(firstAttachment)
    : (inlineText ? await inputFromUrlText(inlineText) : await collectInput(message, prompt));
  const chooseRows = [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`deobf-luraph-v15:${message.author.id}`)
        .setLabel('Luraph v15')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`deobf-151:${message.author.id}`)
        .setLabel('Luraph 15.1')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`deobf-centurion:${message.author.id}`)
        .setLabel('Centurion')
        .setStyle(ButtonStyle.Primary),
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`deobf-v14.7:${message.author.id}`)
        .setLabel('Luraph 14.7')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`deobf-v14.8:${message.author.id}`)
        .setLabel('Luraph 14.8')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`deobf-v14.9:${message.author.id}`)
        .setLabel('Luraph 14.9')
        .setStyle(ButtonStyle.Secondary),
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`deobf-cancel:${message.author.id}`)
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Secondary),
    ),
  ];
  await prompt.edit({
    content: '⚙️ **Choose a deobfuscator**\nSelect the engine you want to use:',
    components: chooseRows,
  });

  const componentCollector = prompt.createMessageComponentCollector({
    time: PICKER_WAIT_MS,
    filter: (interaction) => interaction.user.id === message.author.id,
  });
  componentCollector.on('collect', async (interaction) => {
    if (interaction.customId === `deobf-cancel:${message.author.id}`) {
      await interaction.update({ content: 'Cancelled.', components: [] });
      componentCollector.stop('cancelled');
      return;
    }
    const v14Match = interaction.customId.match(/^deobf-v(14\.[789]):/);
    if (v14Match) {
      await interaction.deferUpdate();
      componentCollector.stop('selected');
      try {
        await processLuraphV14(message, prompt, input, v14Match[1]);
      } catch (error) {
        const messageText = String(error.message || error).slice(0, 1500);
        await prompt.edit({
          content: '**Luraph v' + v14Match[1] + ' failed**\n' + messageText.replace(/`/g, "'"),
          components: [],
        }).catch(() => {});
      }
      return;
    }
    if (interaction.customId === `deobf-centurion:${message.author.id}`) {
      await interaction.deferUpdate();
      componentCollector.stop('selected');
      try {
        await processCenturion(message, prompt, input);
      } catch (error) {
        const messageText = String(error.message || error).slice(0, 1500);
        await prompt.edit({ content: '❌ **Centurion failed**\n' + messageText, components: [] }).catch(() => {});
      }
      return;
    }
    if (interaction.customId === `deobf-151:${message.author.id}`) {
      await interaction.deferUpdate();
      componentCollector.stop('selected');
      try {
        await processLuraph151(message, prompt, input);
      } catch (error) {
        const messageText = String(error.message || error).slice(0, 1500);
        await prompt.edit({ content: `❌ **Luraph 15.1 failed**\\n${messageText.replace(/\\`/g, "'")}`, components: [] }).catch(() => {});
      }
      return;
    }
    if (interaction.customId === `deobf-luraph-v15:${message.author.id}`) {
      await interaction.deferUpdate();
      componentCollector.stop('selected');
      try {
        await processLuraphV15(message, prompt, input);
      } catch (error) {
        const messageText = String(error.message || error).slice(0, 1500);
        await prompt.edit({
          content: `❌ **Deobfuscation failed**\n${messageText.replace(/\`/g, "'")}`,
          components: [],
        }).catch(() => {});
      }
    }
  });
  componentCollector.on('end', (_collected, reason) => {
    if (reason === 'time') {
      prompt.edit({ content: 'Selection expired. Type `.deobf` to start again.', components: [] }).catch(() => {});
    }
  });
}

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`DAILY DEOBF is online as ${readyClient.user.tag}`);
  console.log('Prefix commands: .deobf, .idx, .idx files, .get, .exec, .help');
  const rest = new REST({ version: '10' }).setToken(TOKEN);
  try {
    const route = commandGuildId
      ? Routes.applicationGuildCommands(readyClient.user.id, commandGuildId)
      : Routes.applicationCommands(readyClient.user.id);
    await rest.put(route, { body: slashCommands });
    console.log('Registered /purelua and /pureluau slash commands.');
  } catch (error) {
    console.error('Slash-command registration failed:', error.message);
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName === 'purelua' || interaction.commandName === 'pureluau') {
    await handlePureLuauCommand(interaction);
  }
});

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;
  const content = message.content.trim();
  if (!content) return;
  const parts = content.split(/\s+/);
  const command = parts[0].toLowerCase();
  const subcommand = (parts[1] || '').toLowerCase();

  if (command === '.help') {
    if (parts.length > 1) {
      await message.reply('Use .help by itself.');
      return;
    }
    await message.reply({ content: helpText(), allowedMentions: { repliedUser: false } });
    return;
  }

  if (command === '.exec') {
    const inlineSource = content.slice(command.length).trim();
    if (inlineSource.length > MAX_INPUT_BYTES) {
      await message.reply('❌ The .exec source exceeds the 2 MB input limit.');
      return;
    }
    if (activeUsers.has(message.author.id)) {
      await message.reply('You already have an active .deobf, .idx, .get or .exec job.');
      return;
    }
    activeUsers.add(message.author.id);
    try {
      await startExecWorkflow(message, inlineSource || null);
    } catch (error) {
      await message.reply('❌ .exec failed: ' + String(error.message || error).slice(0, 1500)).catch(() => {});
    } finally {
      activeUsers.delete(message.author.id);
    }
    return;
  }

  if (command === '.get') {
    const inlineSource = content.slice(command.length).trim();
    if (inlineSource.length > MAX_INPUT_BYTES) {
      await message.reply('❌ The .get input is too large. Maximum size is 2 MB.');
      return;
    }
    if (activeUsers.has(message.author.id)) {
      await message.reply('You already have an active .deobf, .idx or .get job. Finish it or wait for it to expire.');
      return;
    }
    activeUsers.add(message.author.id);
    try {
      await startGetWorkflow(message, inlineSource || null);
    } catch (error) {
      await message.reply('❌ ' + String(error.message || error).slice(0, 1500)).catch(() => {});
    } finally {
      activeUsers.delete(message.author.id);
    }
    return;
  }

  if (command === '.idx') {
    if (subcommand === 'files') {
      if (parts.length > 2) {
        await message.reply('Use .idx files and attach up to 10 loadstringN.txt files.');
        return;
      }
      try {
        await handleIdxFiles(message);
      } catch (error) {
        await message.reply('❌ ' + String(error.message || error).slice(0, 1200)).catch(() => {});
      }
      return;
    }
    const inlineSource = content.slice(command.length).trim();
    if (inlineSource.length > MAX_INPUT_BYTES) {
      await message.reply('❌ The inline expression is too large. Maximum size is 2 MB.');
      return;
    }
    if (activeUsers.has(message.author.id)) {
      await message.reply('You already have an active .deobf or .idx job. Finish it or wait for it to expire.');
      return;
    }
    activeUsers.add(message.author.id);
    try {
      await startIdxWorkflow(message, inlineSource || null);
    } catch (error) {
      await message.reply('❌ ' + String(error.message || error).slice(0, 1500)).catch(() => {});
    } finally {
      activeUsers.delete(message.author.id);
    }
    return;
  }

  if (command !== PREFIX) return;
  const inlineInput = content.slice(command.length).trim();
  if (inlineInput.length > MAX_INPUT_BYTES) {
    await message.reply('❌ The .deobf input is too large. Maximum size is 2 MB.');
    return;
  }
  if (activeUsers.has(message.author.id)) {
    await message.reply('You already have an active .deobf or .idx job. Finish it or wait for it to expire.');
    return;
  }
  activeUsers.add(message.author.id);
  try {
    await startWorkflow(message, inlineInput || null);
  } catch (error) {
    await message.reply(`❌ ${String(error.message || error).slice(0, 1500)}`).catch(() => {});
  } finally {
    activeUsers.delete(message.author.id);
  }
});

client.login(TOKEN);
