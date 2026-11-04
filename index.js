'use strict';

// Separate Python v15 and beta 15.1 pipelines with live analysis progress.

const {
  ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle,
  Client, Events, GatewayIntentBits, Partials,
} = require('discord.js');
const { spawn } = require('node:child_process');
const dns = require('node:dns').promises;
const net = require('node:net');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { inspectLiftText } = require('./scripts/lift-validation');

const TOKEN = process.env.DISCORD_TOKEN;
const PREFIX = '.deobf';
const MAX_INPUT_BYTES = 2 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 18 * 1024 * 1024;
const INPUT_WAIT_MS = 180_000;
const PICKER_WAIT_MS = 120_000;
const ENGINE_TIMEOUT_MS = 25 * 60_000;
const ENGINE_V14_DIR = path.join(__dirname, 'luraph-v14-engine');
const ENGINE_V14_CLI = path.join(ENGINE_V14_DIR, 'cli.py');
const ENGINE_V15_DIR = path.join(__dirname, 'luraph-v15-engine');
const ENGINE_V15_CLI = path.join(ENGINE_V15_DIR, 'deob.py');
const ENGINE_151_DIR = path.join(__dirname, 'luraph-v15.1-engine');
const ENGINE_151_CLI = path.join(ENGINE_151_DIR, 'deob.js');
const activeUsers = new Set();

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
  for (let redirect = 0; redirect <= 3; redirect++) {
    await assertPublicUrl(current);
    const response = await fetch(current, {
      redirect: 'manual',
      signal: AbortSignal.timeout(15_000),
      headers: {
        'user-agent': 'DAILY-DEOBF/1.0',
        accept: 'text/plain, text/*, application/octet-stream;q=0.9, */*;q=0.1',
      },
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location || redirect === 3) throw new Error('The URL redirected too many times.');
      current = new URL(location, current);
      continue;
    }
    if (!response.ok) throw new Error(`Could not download that URL (HTTP ${response.status}).`);
    const type = (response.headers.get('content-type') || '').toLowerCase();
    if (type.includes('text/html')) throw new Error('That URL returned a webpage. Please use a direct script URL.');
    const bytes = await readResponseLimited(response, MAX_INPUT_BYTES);
    return { bytes, filename: path.basename(current.pathname) || 'script.lua' };
  }
  throw new Error('Could not download that URL.');
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

        const candidate = reply.content.trim().replace(/^<|>$/g, '');
        let parsed;
        try {
          parsed = new URL(candidate);
        } catch {
          throw new Error('Send one direct HTTP/HTTPS script URL, or attach a `.lua`, `.luau`, or `.txt` file.');
        }
        if (!['http:', 'https:'].includes(parsed.protocol)) {
          throw new Error('Only HTTP and HTTPS URLs are supported.');
        }
        const result = await fetchPublicText(parsed.toString());
        resolve({ source: decodeSource(result.bytes), filename: result.filename });
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
  const rawPath = filePath.replace(/\\.luau$/i, '.raw.luau');
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

  if (assessment.complete) {
    const parser = path.join(engineDir, 'bin', 'luau-ast');
    try {
      await runCommand(parser, [filePath], engineDir, 120_000);
      assessment.syntaxChecked = true;
      assessment.syntaxValid = true;
      assessment.score += assessment.complete ? 10_000 : 1_000;
    } catch (error) {
      assessment.syntaxChecked = true;
      assessment.syntaxValid = false;
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
  const notableLogs = engineLog.split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('[!]') || /devirt round|devirtualizing \(round|loadstring.d .*VM chunk|anti-tamper/i.test(line))
    .slice(-18);
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
    'Full lifted functions: ' + (liftedFunctions === null ? 'not reported' : liftedFunctions),
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
    'Validation diagnostics:',
    ...validationIssueText(validation).split('\n'),
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
  await fs.writeFile(reportPath, reportLines.join('\n'), 'utf8');

  const attachments = [];
  let totalBytes = 0;
  async function addArtifact(filePath, fileName) {
    if (attachments.length >= 10) return;
    try {
      const data = await fs.readFile(filePath);
      if (!data.length || data.length > MAX_OUTPUT_BYTES || totalBytes + data.length > MAX_OUTPUT_BYTES) return;
      attachments.push(new AttachmentBuilder(data, { name: fileName }));
      totalBytes += data.length;
    } catch {}
  }

  if (hasLiftedSource) {
    await addArtifact(liftedPath, 'deobfuscated.luau');
  } else if (hasLiftCandidate) {
    await addArtifact(liftedPath, 'partial_vm_lift_candidate.luau');
  }
  if (traceBytes) await addArtifact(preferredTracePath, 'analysis_trace.luau');
  if (protoBytes) await addArtifact(protoPath, 'captured_prototypes.json');
  if (stringBytes) await addArtifact(stringsPath, 'extracted_strings.txt');
  for (const chunkName of chunkFiles.slice(0, 3)) {
    await addArtifact(path.join(outputDir, chunkName), chunkName.replace(path.basename(base) + '.', ''));
  }
  await addArtifact(reportPath, 'analysis_report.txt');

  if (!attachments.length) throw new Error('The engine finished without producing an attachable result or analysis report.');

  const safeName = String(input.filename || 'script.lua').replaceAll(String.fromCharCode(96), '');
  let summary;
  if (hasLiftedSource) {
    summary = '**DAILY DEOBF · ' + config.label + '**\n✅ Luau candidate passed structural checks and syntax validation.\nProcessed: ' + safeName +
      '\nFunctions lifted: ' + (liftedFunctions === null ? 'see report' : liftedFunctions) +
      ' · Unlifted blocks: ' + (unliftedBlocks === null ? 'see report' : unliftedBlocks) +
      '\nCaptured prototypes: ' + (prototypeCount || 'see report') + ' · Dynamic VM chunks: ' + chunkFiles.length +
      '\nAttached: reconstructed Luau and supporting analysis artifacts.';
  } else if (hasLiftCandidate) {
    summary = '**DAILY DEOBF · ' + config.label + '**\n⚠️ Partial VM lift only. Validation found unresolved VM output, so it is not labelled as recovered source.\nProcessed: ' + safeName +
      '\nAttached: partial candidate, behaviour trace and analysis report.';
  } else {
    summary = '**DAILY DEOBF · ' + config.label + '**\n⚠️ Trace-only result. The full VM lift did not complete.\nProcessed: ' + safeName +
      '\nThe trace is labelled separately so it is not mistaken for reconstructed source. See the attached report and prototype data for diagnostics.';
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
  const inputBytes = Buffer.byteLength(source, 'utf8');
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

    await message.reply({
      content: isLifted
        ? '**DAILY DEOBF · Luraph v' + version + '**\n✅ Static VM-lifted Luau generated. The analysis report is attached too.'
        : '**DAILY DEOBF · Luraph v' + version + '**\\n⚠️ The engine did not confirm a full VM lift. This may be a partial recovery or behaviour trace, not complete source.',
      files: [
        new AttachmentBuilder(outputPath, { name: resultName }),
        new AttachmentBuilder(Buffer.from(report, 'utf8'), { name: 'analysis_report_v' + version.replace('.', '_') + '.txt' }),
      ],
      allowedMentions: { repliedUser: false },
    });

    await progress.complete(isLifted
      ? 'The VM-lifted Luau result and analysis report were attached.'
      : 'The partial result and analysis report were attached and clearly labelled.');
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
  let combinedLogs = '';
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
      combinedLogs += result.stderr || '';
    } catch (error) {
      dedicatedError = error;
      combinedLogs += '\n[!] dedicated 15.1 engine: ' + String(error.message || error) + '\n';
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
        combinedLogs += result.stderr || '';
      } catch (error) {
        compatibilityError = error;
        combinedLogs += '\n[!] v15 compatibility pass: ' + String(error.message || error) + '\n';
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
      stderr: combinedLogs,
      maxRuns: 16,
      devirtRounds: 200,
      loaderAnalysis: true,
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



async function startWorkflow(message) {
  const prompt = await message.reply({
    content: '📄 **DAILY DEOBF**\nSend a `.lua`, `.luau`, or `.txt` file, or paste a direct URL to your Luau script.\n\nMaximum input size: 2 MB.',
    allowedMentions: { repliedUser: false },
  });
  // Accept attachments on the original command message too.
  const firstAttachment = message.attachments.first();
  const input = firstAttachment
    ? await inputFromAttachment(firstAttachment)
    : await collectInput(message, prompt);
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
        .setCustomId(`deobf-v14.7:${message.author.id}`)
        .setLabel('Luraph 14.7')
        .setStyle(ButtonStyle.Secondary),
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`deobf-v14.8:${message.author.id}`)
        .setLabel('Luraph 14.8')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`deobf-v14.9:${message.author.id}`)
        .setLabel('Luraph 14.9')
        .setStyle(ButtonStyle.Secondary),
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

client.once(Events.ClientReady, (readyClient) => {
  console.log(`DAILY DEOBF is online as ${readyClient.user.tag}`);
  console.log('Command: .deobf');
});

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot || !message.content.trim().toLowerCase().startsWith(PREFIX)) return;
  if (message.content.trim().toLowerCase() !== PREFIX) {
    await message.reply('Use `.deobf` by itself, then upload a `.lua`, `.luau`, or `.txt` file or send a direct URL.');
    return;
  }
  if (activeUsers.has(message.author.id)) {
    await message.reply('You already have a `.deobf` job open. Finish it or wait for it to expire.');
    return;
  }
  activeUsers.add(message.author.id);
  try {
    await startWorkflow(message);
  } catch (error) {
    await message.reply(`❌ ${String(error.message || error).slice(0, 1500)}`).catch(() => {});
  } finally {
    activeUsers.delete(message.author.id);
  }
});

client.login(TOKEN);
