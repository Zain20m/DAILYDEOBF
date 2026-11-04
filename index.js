'use strict';

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

const TOKEN = process.env.DISCORD_TOKEN;
const PREFIX = '.deobf';
const MAX_INPUT_BYTES = 2 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 18 * 1024 * 1024;
const INPUT_WAIT_MS = 180_000;
const PICKER_WAIT_MS = 120_000;
const ENGINE_TIMEOUT_MS = 15 * 60_000;
const ENGINE_V15_DIR = path.join(__dirname, 'luraph-v15-engine');
const ENGINE_V15_CLI = path.join(ENGINE_V15_DIR, 'deob.js');
const ENGINE_151_DIR = path.join(__dirname, 'luraph-v15.1-engine');
const ENGINE_151_CLI = path.join(ENGINE_151_DIR, 'bin', 'luraph-deobf.js');
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

function runEngine(engineDir, engineCli, inputPath, outputPath, timeoutMs, legacy = false) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [
      legacy ? '--max-old-space-size=512' : '--max-old-space-size=1024',
      engineCli,
      inputPath,
      '-o',
      outputPath,
      ...(legacy ? ['--steps', '180000'] : ['--timeout', '120']),
    ], {
      cwd: engineDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
      windowsHide: true,
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      if (stdout.length < 24_000) stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      if (stderr.length < 12_000) stderr += chunk.toString();
    });
    const timer = setTimeout(() => child.kill('SIGKILL'), timeoutMs);
    child.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once('close', (code, signal) => {
      clearTimeout(timer);
      if (signal === 'SIGKILL') {
        return reject(new Error('This script exceeded the engine processing time limit.'));
      }
      if (code !== 0) {
        const raw = (stderr || stdout).trim();
        const lines = raw.split('\n').filter(Boolean);
        const detail = lines.length > 18
          ? [...lines.slice(0, 12), '…', ...lines.slice(-6)].join('\n')
          : lines.join('\n');
        return reject(new Error(detail || ('Deobfuscator exited with code ' + code + '.')));
      }
      resolve(stdout);
    });
  });
}
async function processLuraphV15(message, prompt, input) {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'daily-deobf-'));
  const inputPath = path.join(tempRoot, 'input.lua');
  const outDir = path.join(tempRoot, 'output');
  const outputPath = path.join(outDir, 'deobfuscated.luau');
  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(inputPath, input.source, { encoding: 'utf8', mode: 0o600 });

  try {
    await prompt.edit({ content: 'Running the newest Luraph v15 engine…', components: [] });
    await runEngine(ENGINE_V15_DIR, ENGINE_V15_CLI, inputPath, outputPath, ENGINE_TIMEOUT_MS, false);
    const data = await fs.readFile(outputPath);
    if (!data.length) throw new Error('The engine returned an empty output file.');
    if (data.length > MAX_OUTPUT_BYTES) {
      throw new Error('The deobfuscated output is larger than Discord attachment limit.');
    }

    const safeName = input.filename.replaceAll(String.fromCharCode(96), '');
    await message.reply({
      content: '**DAILY DEOBF · Luraph v15 (new engine)**\nProcessed: ' + safeName +
        '\n\nThe engine reconstructs code from VM paths it can analyze. Unsupported or protected paths may remain incomplete.',
      files: [new AttachmentBuilder(data, { name: 'deobfuscated.luau' })],
      allowedMentions: { repliedUser: false },
    });
    await prompt.edit({ content: '✅ Deobfuscation finished. The .luau output is attached above.', components: [] });
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true }).catch(() => {});
  }
}

async function processLuraph151(message, prompt, input) {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'daily-deobf-151-'));
  const inputPath = path.join(tempRoot, 'input.lua');
  const outDir = path.join(tempRoot, 'output');
  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(inputPath, input.source, { encoding: 'utf8', mode: 0o600 });

  try {
    await prompt.edit({ content: 'Running **Luraph 15.1**…', components: [] });
    await runEngine(ENGINE_151_DIR, ENGINE_151_CLI, inputPath, outDir, 90_000, true);
    const names = [
      '06_lifted_listing.lua',
      '01_bootstrap_readable.lua',
      '07_STRUCTURE_REPORT.md',
      '00_extract_info.json',
      '06_strings_seen.txt',
    ];
    const files = [];
    let total = 0;
    for (const name of names) {
      try {
        const data = await fs.readFile(path.join(outDir, name));
        total += data.length;
        if (total <= MAX_OUTPUT_BYTES && data.length <= 8 * 1024 * 1024) {
          files.push(new AttachmentBuilder(data, { name }));
        }
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
    }
    if (!files.length) throw new Error('Luraph 15.1 completed but did not produce its expected output files.');
    await message.reply({
      content: '**DAILY DEOBF · Luraph 15.1**\\nProcessed: ' + input.filename.replace(/\\`/g, '') +
        '\\n\\nThe lifted listing shows instructions observed during analysis. Some protected scripts may not expose every function in one run.',
      files,
      allowedMentions: { repliedUser: false },
    });
    await prompt.edit({ content: '✅ Luraph 15.1 finished. Its output files are attached above.', components: [] });
  } finally {
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
  const chooseRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`deobf-luraph-v15:${message.author.id}`)
      .setLabel('Luraph v15')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`deobf-151:${message.author.id}`)
      .setLabel('Luraph 15.1')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`deobf-cancel:${message.author.id}`)
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Secondary),
  );
  await prompt.edit({
    content: '⚙️ **Choose a deobfuscator**\nSelect the engine you want to use:',
    components: [chooseRow],
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
