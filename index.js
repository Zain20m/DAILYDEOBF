'use strict';

// Load credentials from the project .env file before reading process.env.
require('dotenv').config();

// Separate Python v15 and beta 15.1 pipelines with live analysis progress.

const {
  ActionRowBuilder, AttachmentBuilder: DiscordAttachmentBuilder, ButtonBuilder, ButtonStyle, ChannelType, EmbedBuilder,
  Client, Events, GatewayIntentBits, Partials, PermissionFlagsBits,
  REST, Routes, SlashCommandBuilder,
} = require('discord.js');

// Every Lua/Luau result the bot sends is named .lua (easier to open and run):
// `x.luau`, `x.pureluau` and `x.part001.luau` all become `.lua`.
function luaFileName(name) {
  return typeof name === 'string' ? name.replace(/\.(?:pure)?luau$/i, '.lua') : name;
}
class AttachmentBuilder extends DiscordAttachmentBuilder {
  constructor(attachment, data = {}) {
    super(attachment, data && data.name ? { ...data, name: luaFileName(data.name) } : data);
  }

  setName(name) {
    return super.setName(luaFileName(name));
  }
}
const { spawn } = require('node:child_process');
const dns = require('node:dns').promises;
const net = require('node:net');
const http = require('node:http');
const https = require('node:https');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const zlib = require('node:zlib');
const crypto = require('node:crypto');
const { inspectLiftText } = require('./scripts/lift-validation');
const { convertToPureLuau } = require('./pureluau');
const { createAutomaticPureLuauResult } = require('./scripts/automatic-pureluau');
const { detectFlowAuthLuraphVersion } = require('./scripts/flowauth-version');
const { detectEngineSuggestion } = require('./scripts/engine-detection');
const { repairIronVeilSource } = require('./scripts/ironveil-auto-repair');
const {
  resolveStaticSources,
  suggestLoadstringHttpGetCorrection,
} = require('./scripts/idx-resolver');

const TOKEN = process.env.DISCORD_TOKEN;
const PREFIX = '.deobf';
const MAX_OUTPUT_BYTES = 18 * 1024 * 1024;
const MAX_INPUT_BYTES = 18 * 1024 * 1024;
const MAX_DAILYFUSCATOR_INPUT_BYTES = 1 * 1024 * 1024;
const MAX_PURELUA_CHARS = 4_000_000;
const MAX_PURELUA_BYTES = 8 * 1024 * 1024;
const MAX_GET_FILES = 50;
const MAX_GET_URLS = 250;
const MAX_GET_OUTPUT_BYTES = 64 * 1024 * 1024;
const MAX_ATTACHMENT_PART_BYTES = 16 * 1024 * 1024;
const MAX_GET_ATTEMPTS = 250;
const INPUT_WAIT_MS = 180_000;
const PICKER_WAIT_MS = 120_000;
const ENGINE_TIMEOUT_MS = 25 * 60_000;
const ENGINE_V15_DIR = path.join(__dirname, 'luraph-v15-engine');
const ENGINE_V15_CLI = path.join(ENGINE_V15_DIR, 'deob.py');
const ENGINE_151_DIR = path.join(__dirname, 'luraph-v15.1-engine');
const ENGINE_151_CLI = path.join(ENGINE_151_DIR, 'deob.js');
const ENGINE_V147_DIR = path.join(__dirname, 'luraph-v14.7-engine');
const ENGINE_V147_CLI = path.join(ENGINE_V147_DIR, 'cli.py');
const ENGINE_V143_DIR = path.join(__dirname, 'luraph-v14.3-engine');
const ENGINE_V143_CLI = path.join(ENGINE_V143_DIR, 'daily_cli.py');
const ENGINE_CENT_DIR = path.join(__dirname, 'centurion-engine');
const ENGINE_FULCRUM_DIR = path.join(__dirname, 'fulcrum-engine');
const ENGINE_FULCRUM_CLI = path.join(ENGINE_FULCRUM_DIR, 'fulcrum_deobf.py');
const ENGINE_CENT_CLI = path.join(ENGINE_CENT_DIR, 'centurion.py');
const ENGINE_IB2_DIR = path.join(__dirname, 'ib2deobf');
const ENGINE_IB2_DLL = path.join(ENGINE_IB2_DIR, 'LuaAnalysis.Ironbrew2.dll');
const ENGINE_IRONVEIL_DIR = path.join(__dirname, 'ironveil-engine');
const ENGINE_IRONVEIL_CLI = path.join(ENGINE_IRONVEIL_DIR, 'dist', 'cli.js');
const ENGINE_2HBJ_DIR = path.join(__dirname, '2hbj-engine');
const ENGINE_2HBJ_TOOLS = path.join(ENGINE_2HBJ_DIR, 'tools');
const ENGINE_2HBJ_RUN = path.join(ENGINE_2HBJ_TOOLS, 'run.sh');
const activeUsers = new Set();
const pendingMsgReplies = new Map();
const commandGuildId = process.env.GUILD_ID || '';

const slashCommands = [
  new SlashCommandBuilder()
    .setName('purelua')
    .setDescription('Convert Lua/Luau source with the static PureLuau readability pass')
    .addAttachmentOption((option) => option
      .setName('file')
      .setDescription('Upload a .lua, .luau, .pureluau or .txt source file')
      .setRequired(false))
    .addStringOption((option) => option
      .setName('source')
      .setDescription('Paste Lua/Luau source text (up to 6000 characters)')
      .setMaxLength(6000)
      .setRequired(false))
    .toJSON(),
  new SlashCommandBuilder()
    .setName('obf')
    .setDescription('Obfuscate a Lua source file')
    .addStringOption((option) => option
      .setName('obfuscator')
      .setDescription('Choose an obfuscator')
      .setRequired(true)
      .addChoices(
        { name: 'IronVeil', value: 'ironveil' },
        { name: 'Dailyfuscator v3', value: 'dailyfuscator' },
        { name: 'Cryon API', value: 'cryon' },
      ))
    .addAttachmentOption((option) => option
      .setName('file')
      .setDescription('Upload the source file to obfuscate')
      .setRequired(true))
    .addStringOption((option) => option
      .setName('profile')
      .setDescription('Dailyfuscator protection profile')
      .addChoices(
        { name: 'Light', value: 'light' },
        { name: 'Standard', value: 'standard' },
        { name: 'Hard', value: 'hard' },
      )
      .setRequired(false))
    .addStringOption((option) => option
      .setName('seed')
      .setDescription('Optional build seed (up to 128 characters)')
      .setMaxLength(128)
      .setRequired(false))
    .addStringOption((option) => option
      .setName('optimize')
      .setDescription('Cryon build optimization level')
      .addChoices(
        { name: '1 · Default', value: '1' },
        { name: '2 · Balanced', value: '2' },
        { name: '3 · Maximum', value: '3' },
      )
      .setRequired(false))
    .addBooleanOption((option) => option
      .setName('compress')
      .setDescription('Enable Cryon output compression')
      .setRequired(false))
    .toJSON(),
];

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
  let addresses;
  try {
    addresses = literalVersion
      ? [{ address: hostname, family: literalVersion }]
      : await dns.lookup(hostname, { all: true, verbatim: true });
  } catch (error) {
    const code = error && (error.code || error.message) || 'unknown DNS error';
    throw new Error('DNS lookup failed for ' + hostname + ': ' + String(code));
  }

  if (!addresses.length || addresses.some((entry) => isPrivateAddress(entry.address))) {
    throw new Error('That URL does not point exclusively to public addresses.');
  }
  return addresses;
}

async function requestPinnedAddress(url, address, options = {}) {
  const method = String(options.method || 'GET').toUpperCase();
  const allowedMethods = new Set(['GET', 'HEAD', 'OPTIONS', 'POST', 'PROPFIND', 'SEARCH', 'REPORT', 'QUERY', 'TRACE']);
  if (!allowedMethods.has(method)) {
    throw new Error('That HTTP method is not enabled in the universal fetcher.');
  }

  return new Promise((resolve, reject) => {
    const transport = url.protocol === 'https:' ? https : http;
    const family = net.isIP(address.address);
    const lookup = (_hostname, lookupOptions, callback) => {
      if (lookupOptions && lookupOptions.all) {
        callback(null, [{ address: address.address, family }]);
      } else {
        callback(null, address.address, family);
      }
    };

    const host = String(url && url.hostname || '').toLowerCase();
    const needsRobloxUA = Boolean(options.forceRobloxUserAgent) ||
      host === 'cdn.luaprotect.dev' ||
      host === 'exec.luaprotect.dev' ||
      host.endsWith('.luaprotect.dev') ||
      host === 'jnkie.com' ||
      host.endsWith('.jnkie.com') ||
      host === 'api.polsec.net' ||
      host.endsWith('.polsec.net') ||
      host.includes('luarmor') ||
      host.includes('vantarmor') ||
      host.includes('luavify');

    const headers = {
      'user-agent': needsRobloxUA
        ? 'Roblox/WinInet'
        : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      accept: needsRobloxUA
        ? '*/*'
        : 'text/plain, text/*, application/luau, application/javascript, application/octet-stream, application/json, */*;q=0.8',
      'accept-language': 'en-US,en;q=0.9',
      'cache-control': 'no-cache',
      pragma: 'no-cache',
      'accept-encoding': options.compressed ? 'gzip, deflate, br' : 'identity',
      connection: 'close',
      ...(method === 'PROPFIND' ? { depth: '0' } : {}),
      ...(options.headers || {}),
    };

    // MUST be last — curl -A / options.headers must not force Chrome onto LuaProtect
    if (needsRobloxUA) {
      headers['user-agent'] = 'Roblox/WinInet';
      headers['User-Agent'] = 'Roblox/WinInet'; // some stacks are case-sensitive on merge
    }

    // Debug once if you still see 403 (remove later):
    // console.log('[fetch]', method, host, 'ua=', headers['user-agent'] || headers['User-Agent']);

    const request = transport.request(url, {
      method,
      agent: false,
      autoSelectFamily: false,
      lookup,
      signal: AbortSignal.timeout(Math.min(30, Math.max(1, Number(options.maxTime) || 15)) * 1000),
      headers,
    }, (response) => {
      const status = Number(response.statusCode || 0);
      const responseHeaders = response.headers || {};
      resolve({
        status,
        statusText: response.statusMessage || '',
        ok: status >= 200 && status < 300,
        headers: {
          get(name) {
            const value = responseHeaders[String(name).toLowerCase()];
            return Array.isArray(value) ? value.join(', ') : (value ?? null);
          },
          entries() {
            return Object.entries(responseHeaders).map(([name, value]) => [
              name,
              Array.isArray(value) ? value.join(', ') : String(value ?? ''),
            ]);
          },
        },
        body: {
          [Symbol.asyncIterator]: () => response[Symbol.asyncIterator](),
          cancel: async () => { response.destroy(); },
        },
      });
    });

    request.once('error', reject);
    if (options.connectTimeout) {
      request.once('socket', (socket) => {
        if (!socket.connecting) return;
        const timer = setTimeout(() => request.destroy(new Error('Connection timed out after ' + options.connectTimeout + ' seconds.')), options.connectTimeout * 1000);
        const clear = () => clearTimeout(timer);
        socket.once('connect', clear);
        socket.once('secureConnect', clear);
        socket.once('error', clear);
        request.once('close', clear);
      });
    }
    if (options.body !== undefined && options.body !== null) request.write(options.body);
    request.end();
  });
}

async function readResponse(response, maxBytes = Infinity) {
  const chunks = [];
  let total = 0;
  if (!response.body) return Buffer.alloc(0);
  for await (const chunk of response.body) {
    total += chunk.length;
    if (total > maxBytes) {
      throw new Error('The source file exceeds the ' + (maxBytes / 1024 / 1024).toFixed(1) +
        ' MB upload limit. Split the source into smaller files; no partial conversion was produced.');
    }
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks, total);
}

function parseCurlStyleOptions(rawText) {
  const tokens = String(rawText || '').match(/"[^"]*"|'[^']*'|\S+/g) || [];
  const args = tokens.map((token) => token.replace(/^["']|["']$/g, ''));
  const options = { headers: {}, flags: [], followRedirects: true, compressed: false };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = () => args[++i] || '';
    if (arg === '-H' || arg === '--header') {
      const value = next(); const split = value.indexOf(':');
      if (split > 0) options.headers[value.slice(0, split).trim().toLowerCase()] = value.slice(split + 1).trim();
    } else if (arg === '-A' || arg === '--user-agent') options.headers['user-agent'] = next();
    else if (arg === '-e' || arg === '--referer') options.headers.referer = next();
    else if (arg === '-r' || arg === '--range') {
      const value = next(); options.headers.range = /^bytes=/i.test(value) ? value : 'bytes=' + value;
    } else if (arg === '-X' || arg === '--request') {
      const method = next().toUpperCase();
      if (!['GET', 'HEAD', 'OPTIONS', 'POST'].includes(method)) throw new Error('Custom curl methods are limited to GET, HEAD, OPTIONS and POST.');
      options.method = method;
    } else if (arg === '-d' || arg === '--data' || arg === '--data-raw') {
      options.body = next(); options.method = options.method || 'POST';
      if (options.method !== 'POST') throw new Error('Curl --data is only enabled with POST.');
      options.headers['content-type'] = options.headers['content-type'] || 'application/x-www-form-urlencoded';
    } else if (arg === '-G' || arg === '--get') options.getMode = true;
    else if (arg === '--compressed') options.compressed = true;
    else if (arg === '-L' || arg === '--location') options.followRedirects = true;
    else if (arg === '--max-time') options.maxTime = Math.min(30, Math.max(1, Number(next()) || 15));
    else if (arg === '--connect-timeout') options.connectTimeout = Math.min(15, Math.max(1, Number(next()) || 10));
    else if (arg === '-o' || arg === '--output') {
      options.outputName = path.basename(next()).replace(/[^A-Za-z0-9._-]/g, '_');
      options.flags.push(arg);
    } else if (arg === '-O' || arg === '--remote-name') {
      options.remoteName = true; options.flags.push(arg);
    } else if (arg === '-C' || arg === '--continue-at') {
      const offset = next();
      if (/^\d+$/.test(offset)) options.headers.range = 'bytes=' + offset + '-';
      options.flags.push(arg);
    } else if (['-i','--include','-I','--head','-v','--verbose','-w','--write-out','-D','--dump-header'].includes(arg)) {
      options.flags.push(arg);
      if (['-w','--write-out','-D','--dump-header'].includes(arg)) next();
    }
  }
  if (options.getMode && options.body) {
    options.queryData = options.body; delete options.body; options.method = 'GET';
  }
  return options;
}

async function fetchPublicText(rawUrl, curlOptions = {}) {
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
    let addresses;
    try {
      addresses = await assertPublicUrl(current);
    } catch (error) {
      throw new Error('URL safety/DNS check failed for ' + current.hostname + ': ' +
        String(error && (error.message || error) || 'unknown error'));
    }

    let response;
    const connectionErrors = [];
    const requestHeaders = { ...(curlOptions.headers || {}) };

    // A server-side token may exempt only this bot's own loader endpoint.
    // Never attach it to other hosts or unrelated paths, including redirects.
    if (
      current.hostname.toLowerCase() === 'jnkie.com' &&
      current.pathname.startsWith('/files/v4/loaders/') &&
      process.env.JNKIE_FETCH_TOKEN
    ) {
      requestHeaders['x-dailydeobf-token'] = process.env.JNKIE_FETCH_TOKEN;
    }

    for (const address of addresses) {
      try {
        response = await requestPinnedAddress(current, address, { method: curlOptions.method || 'GET', headers: requestHeaders, body: curlOptions.body, compressed: curlOptions.compressed, maxTime: curlOptions.maxTime, connectTimeout: curlOptions.connectTimeout, forceRobloxUserAgent: curlOptions.forceRobloxUserAgent });
        break;
      } catch (error) {
        const reason = error && (
          error.cause && (error.cause.code || error.cause.message) ||
          error.code || error.message
        ) || 'unknown network error';
        connectionErrors.push(address.address + ': ' + String(reason));
      }
    }
    if (!response) {
      throw new Error(
        'Network/TLS connection failed for ' + current.hostname +
        ' across ' + addresses.length + ' public address(es): ' +
        connectionErrors.join(' | ').slice(0, 900)
      );
    }

    if (curlOptions.followRedirects !== false && [301, 302, 303, 307, 308].includes(response.status)) {
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
      if (response.body && typeof response.body.cancel === 'function') {
        await response.body.cancel().catch(() => {});
      }
      continue;
    }

    if (!response.ok) {
      const retryAfter = response.headers.get('retry-after');
      const server = response.headers.get('server');
      const requestId = response.headers.get('cf-ray') ||
        response.headers.get('x-request-id') ||
        response.headers.get('x-amz-cf-id');
      let rawErrorBody = '';
      let errorBody = '';
      try {
        rawErrorBody = (await readResponse(response, 8 * 1024)).toString('utf8');
        errorBody = rawErrorBody
          .replace(/<script[\s\S]*?<\/script>/gi, ' ')
          .replace(/<style[\s\S]*?<\/style>/gi, ' ')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 280);
      } catch {
        if (response.body && typeof response.body.cancel === 'function') {
          await response.body.cancel().catch(() => {});
        }
      }
      const cfMitigated = String(response.headers.get('cf-mitigated') || '').toLowerCase();
      const cloudflareChallenge = response.status === 403 && (
        cfMitigated === 'challenge' ||
        /cloudflare/i.test(server || '') && /__cf_chl|challenge-platform|cf-chl-|just a moment|verify you are human|enable javascript and cookies/i.test(rawErrorBody)
      );
      const cloudflareAccess = response.status === 403 && (
        /cloudflare access/i.test(rawErrorBody) ||
        /cloudflareaccess\.com/i.test(rawErrorBody)
      );
      const blockType = cloudflareChallenge
        ? 'Cloudflare browser challenge detected. This HTTP downloader cannot complete the interactive challenge. If you own the zone, inspect Security Events for this Ray ID and configure an authenticated download route or narrowly scoped policy.'
        : cloudflareAccess
          ? 'Cloudflare Access denied this request. Check the Access application policy and use an approved service authentication method.'
          : response.status === 403
            ? 'HTTP 403 access denied. The origin or an edge security rule rejected this request. Check authentication, permissions, WAF events and the request ID.'
            : '';
      const details = [
        'HTTP ' + response.status + ' ' + (response.statusText || ''),
        'while downloading from ' + current.hostname,
        server ? 'Server: ' + server : '',
        requestId ? 'Request ID: ' + requestId : '',
        retryAfter ? 'Retry-After: ' + retryAfter : '',
        blockType,
        errorBody ? 'Response: ' + errorBody : '',
      ].filter(Boolean);
      throw new Error(details.join('. '));
    }

    // Do not reject a response only because the host labelled it text/html.
    // Some script hosts mislabel plain Luau. decodeSource checks the body itself.
    let bytes = await readResponse(response, MAX_INPUT_BYTES);
    const encoding = String(response.headers.get('content-encoding') || '').toLowerCase();
    if (encoding === 'gzip') bytes = zlib.gunzipSync(bytes);
    else if (encoding === 'deflate') bytes = zlib.inflateSync(bytes);
    else if (encoding === 'br') bytes = zlib.brotliDecompressSync(bytes);
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

async function probePublicHttpMethods(rawUrl, curlOptions = {}) {
  const url = new URL(rawUrl);
  url.hash = '';
  const addresses = await assertPublicUrl(url);
  const results = [];

  async function runProbe(label, method, headers = {}, body = undefined) {
    let response = null;
    let lastError = null;
    for (const address of addresses) {
      try {
        response = await requestPinnedAddress(url, address, { method, headers: { ...(curlOptions.headers || {}), ...headers }, body, compressed: curlOptions.compressed, maxTime: curlOptions.maxTime, connectTimeout: curlOptions.connectTimeout, forceRobloxUserAgent: curlOptions.forceRobloxUserAgent });
        break;
      } catch (error) {
        lastError = error;
      }
    }
    if (!response) {
      results.push({ method: label, error: String(lastError && (lastError.message || lastError) || 'Request failed') });
      return null;
    }
    const responseHeaders = response.headers.entries()
      .filter(([name]) => /^(allow|accept|accept-patch|accept-post|content-type|content-length|content-disposition|content-range|etag|last-modified|dav|location|server|www-authenticate|vary)$/i.test(name));
    let responseBody = Buffer.alloc(0);
    let bodyError = null;
    try {
      responseBody = await readResponse(response, 512 * 1024);
    } catch (error) {
      bodyError = String(error && (error.message || error) || 'Response body could not be read');
      if (response.body && typeof response.body.cancel === 'function') await response.body.cancel().catch(() => {});
    }
    const result = { method: label, status: response.status, statusText: response.statusText, headers: responseHeaders, body: responseBody, bodyError };
    results.push(result);
    return result;
  }

  await runProbe('HEAD (-I/--head)', 'HEAD');
  await runProbe('OPTIONS', 'OPTIONS');
  await runProbe('POST (empty body)', 'POST');
  await runProbe('PROPFIND', 'PROPFIND');
  await runProbe('SEARCH', 'SEARCH');
  await runProbe('REPORT', 'REPORT');
  await runProbe('QUERY', 'QUERY');
  await runProbe('TRACE', 'TRACE');

  const headResult = results.find((item) => item.method === 'HEAD');
  const headerValue = (result, name) => {
    const item = (result && result.headers || []).find(([key]) => key.toLowerCase() === name);
    return item ? item[1] : null;
  };
  await runProbe('GET Range bytes=0-262143', 'GET', { range: 'bytes=0-262143' });
  const etag = headerValue(headResult, 'etag');
  const lastModified = headerValue(headResult, 'last-modified');
  if (etag) {
    await runProbe('GET If-None-Match', 'GET', { 'if-none-match': etag });
  } else if (lastModified) {
    await runProbe('GET If-Modified-Since', 'GET', { 'if-modified-since': lastModified });
  } else {
    results.push({ method: 'Conditional GET', skipped: 'HEAD did not provide ETag or Last-Modified.' });
  }
  await runProbe('GET Accept: application/json', 'GET', { accept: 'application/json, */*;q=0.5' });
  await runProbe('GET Accept: text/plain', 'GET', { accept: 'text/plain, */*;q=0.5' });
  if (curlOptions.method && curlOptions.method !== 'GET') {
    await runProbe('Custom curl -X ' + curlOptions.method, curlOptions.method, {}, curlOptions.body);
  }
  return results;
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
  if (!/\.(?:lua|luau|pureluau|txt)$/i.test(filename)) {
    throw new Error('Upload a `.lua`, `.luau`, `.pureluau` or `.txt` source file.');
  }
  // Discord CDN attachments are trusted HTTPS URLs; download them directly.
  const response = await fetch(attachment.url, {
    redirect: 'error',
    signal: AbortSignal.timeout(15_000),
    headers: { 'user-agent': 'DAILY-DEOBF/1.0' },
  });
  if (!response.ok) throw new Error(`Could not download the Discord attachment (HTTP ${response.status}).`);
  const bytes = await readResponse(response, MAX_INPUT_BYTES);
  return { source: decodeSource(bytes), filename };
}

async function inputFromUrlText(text, options = {}) {
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
  const curlOptions = parseCurlStyleOptions(text);
  if (curlOptions.queryData) for (const [key, value] of new URLSearchParams(curlOptions.queryData)) parsed.searchParams.append(key, value);
  const result = await fetchPublicText(parsed.toString(), { headers: curlOptions.headers, compressed: curlOptions.compressed, maxTime: curlOptions.maxTime, forceRobloxUserAgent: Boolean(options.robloxUserAgent) });
  const filename = /\.(?:lua|luau|pureluau|txt)$/i.test(path.extname(result.filename))
    ? result.filename
    : 'downloaded-script.lua';
  return {
    source: decodeSource(result.bytes),
    filename,
    url: parsed.toString(),
    originalText: String(text || ''),
    responseStatus: result.status,
    responseContentType: result.contentType,
    finalUrl: result.finalUrl,
    curlOptions,
  };
}

function looksLikeViewerPageOrJavaScript(source, contentType = '') {
  const text = String(source || '').replace(/^\uFEFF/, '').trim();
  if (!text) return false;

  // Content-Type is supporting evidence only: script hosts often mislabel Lua.
  const type = String(contentType || '').toLowerCase();
  const htmlType = /(?:text\/html|application\/xhtml\+xml)/.test(type);
  const htmlMarkup = /^(?:<!doctype\s+html|<html\b|<head\b|<body\b)/i.test(text) ||
    /<html\b[^>]*>[\s\S]{0,2000}<\/html\s*>/i.test(text);
  if (htmlMarkup) return true;

  // These signatures are specific to the viewer page used by this project.
  if (/\bfunction\s+(?:escapeHTML|highlightLua)\s*\(/i.test(text)) return true;

  // Do not reject obfuscated Luau merely because it contains words such as
  // "const", "innerHTML", or an arrow inside a string. Require a coherent
  // JavaScript/browser signature, and let Lua syntax take priority.
  const hasLuaSyntax = /\b(?:local|return|then|elseif|end|repeat|until|function)\b/.test(text) ||
    /\b(?:game|workspace|script|Instance|Enum|Vector3|CFrame|bit32)\b/.test(text) ||
    /\b(?:loadstring|getfenv|setfenv)\s*\(/.test(text);
  if (hasLuaSyntax) return false;

  const browserApi = /\b(?:document\.(?:getElementById|querySelector|querySelectorAll|createElement)|window\.document|navigator\.clipboard)\b/i.test(text);
  const jsDeclaration = /\b(?:const|let|var)\s+[A-Za-z_$][\w$]*\s*=/.test(text);
  const jsStructure = /=>/.test(text) && /\.addEventListener\s*\(|\b(?:innerHTML|textContent)\b/.test(text);
  const htmlish = /<\/?(?:!doctype|html|head|body|script)\b/i.test(text);
  return htmlType && (jsDeclaration || browserApi || jsStructure) ||
    browserApi && (jsDeclaration || jsStructure) ||
    jsDeclaration && jsStructure && !hasLuaSyntax ||
    htmlish && /\b(?:document|window|script)\b/i.test(text);
}

function isClearlyPlainLuau(source) {
  const text = String(source || '').replace(/^\uFEFF/, '').trim();
  if (!text) return false;

  // A URL may return a webpage or JavaScript bundle instead of Lua source.
  // Never classify those as plain Luau, because that would skip the engine picker.
  if (/<\/?(?:!doctype|html|head|body|script)\b/i.test(text) ||
      /\b(?:document\.(?:getElementById|querySelector|querySelectorAll|createElement)|window\.(?:location|document)|navigator\.clipboard)\b/i.test(text) ||
      /\b(?:const|let|var)\s+[A-Za-z_$][\w$]*\s*=|=>|\.addEventListener\s*\(/.test(text) ||
      /\b(?:innerHTML|textContent|createElement|querySelector)\b/.test(text)) {
    return false;
  }

  // Strong signatures always stay on the selected deobfuscation path.
  if (/This file was protected using Luraph|Luraph Obfuscator|IronBrew|MoonSec|Prometheus Obfuscator|LPH_CRASH|return\s+setmetatable\s*\(\s*\{/i.test(text)) {
    return false;
  }

  const signals = [
    /\bbit32\.(?:bxor|band|bor|bnot)\s*\(/i,
    /\bstring\.char\s*\([^)]{30,}\)/i,
    /\b(?:loadstring|load)\s*\(/i,
    /\bgetfenv\s*\(|\bsetfenv\s*\(/i,
    /\bwhile\s+true\s+do\b/i,
    /(?:\\x[0-9a-f]{2}){8,}/i,
    /(?:\\\d{3}){8,}/,
    /[A-Za-z0-9+/]{1200,}={0,2}/,
  ];
  let signalCount = 0;
  for (const pattern of signals) if (pattern.test(text)) signalCount++;

  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  const identifiers = text.match(/\b[A-Za-z_]\w*\b/g) || [];
  const shortIdentifiers = identifiers.filter((name) => name.length <= 2).length;
  const mostlyShortNames = identifiers.length >= 80 &&
    shortIdentifiers / identifiers.length > 0.62;
  const heavilyMinified = lines.length <= 3 && text.length > 1800;
  const giantString = /(["'])[^\\\r\n]{5000,}\1/.test(text);

  return signalCount < 2 && !mostlyShortNames && !heavilyMinified && !giantString;
}

function splitUtf8Buffer(buffer, maxBytes = MAX_ATTACHMENT_PART_BYTES) {
  const data = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  const parts = [];
  let offset = 0;
  while (offset < data.length) {
    let end = Math.min(data.length, offset + maxBytes);
    if (end < data.length) {
      while (end > offset && (data[end] & 0xc0) === 0x80) end--;
      if (end === offset) throw new Error('Could not find a UTF-8 boundary while splitting the output.');
    }
    parts.push(data.subarray(offset, end));
    offset = end;
  }
  return parts;
}

function makeSourceParts(buffer, filename) {
  const data = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  if (data.length <= MAX_OUTPUT_BYTES) return [{ name: filename, data }];
  const extension = path.extname(filename) || '.lua';
  const base = path.basename(filename, extension);
  return splitUtf8Buffer(data).map((part, index) => ({
    name: base + '.part' + String(index + 1).padStart(3, '0') + extension,
    data: part,
  }));
}

async function sendOriginalLua(message, prompt, input, reason) {
  const source = String(input.source || '');
  const data = Buffer.from(source, 'utf8');
  if (!data.length) throw new Error('The input did not contain readable Lua/Luau source.');
  if (data.length > MAX_OUTPUT_BYTES) {
    throw new Error('The unchanged source exceeds the 18 MB Discord output limit.');
  }

  const original = path.basename(String(input.filename || 'script.lua'));
  const extension = path.extname(original);
  const base = path.basename(original, extension).replace(/[^A-Za-z0-9._-]/g, '_') || 'script';
  const outputName = /\.(?:lua|luau)$/i.test(original)
    ? base + extension.toLowerCase()
    : base + '.lua';

  await message.reply({
    embeds: [dailyEmbed('Lua source returned unchanged', reason, DAILY_COLORS.success)],
    files: [new AttachmentBuilder(data, { name: outputName })],
    allowedMentions: { repliedUser: false },
  });
  await sendAutomaticPureLuau(message, source, outputName, 'the .deobf plain-source return path');
  await prompt.edit({
    content: '✅ No supported obfuscation signature was detected. Returned the original source unchanged as **' + outputName + '**.',
    components: [],
  }).catch(() => {});
}

async function collectInputAfterUrlFailure(message, prompt, originalError) {
  const collector = message.channel.createMessageCollector({
    filter: (msg) => msg.author.id === message.author.id && msg.channelId === message.channelId,
    time: INPUT_WAIT_MS,
    max: 1,
  });

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error('Input timed out. Attach the downloaded .lua/.luau file or paste its source, then run .deobf again.')),
      INPUT_WAIT_MS + 1000,
    );

    collector.on('collect', async (reply) => {
      clearTimeout(timeout);
      collector.stop('received');
      try {
        if (reply.content.trim().toLowerCase() === '.cancel') {
          throw new Error('Cancelled.');
        }

        const attachment = reply.attachments.first();
        if (attachment) {
          resolve(await inputFromAttachment(attachment));
          return;
        }

        const content = reply.content.trim();
        if (!content) throw new Error('Attach a Lua file or paste its source.');

        if (/https?:\/\//i.test(content)) {
          resolve(await inputFromUrlText(content));
          return;
        }

        resolve({
          source: content,
          filename: 'pasted-script.lua',
          originalText: content,
        });
      } catch (error) {
        reject(error);
      }
    });

    collector.on('end', (_collected, reason) => {
      clearTimeout(timeout);
      if (reason === 'time' && collector.collected.size === 0) {
        reject(new Error('Input timed out. Type .deobf to start again.'));
      }
    });

    prompt.edit({
      content: null,
      embeds: [dailyEmbed(
        'URL download blocked',
        'Cloudflare rejected the direct HTTP download. The deobfuscator picker is still available: attach the Lua/Luau file you downloaded in your browser, or paste its source here. The picker will appear immediately after the source is received.\n\nOriginal error: ' + String(originalError && originalError.message || originalError).slice(0, 900),
        DAILY_COLORS.warning
      )],
      components: [],
    }).catch(() => {});
  });
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
      content: null,
      embeds: [dailyEmbed('Waiting for input', 'Attach a **.lua**, **.luau**, **.pureluau** or **.txt** file, or paste a direct script URL.\n\nType `.cancel` to stop.', DAILY_COLORS.primary)],
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
  if (bytes >= 1024) return (bytes / 1024).toFixed(2) + ' KB';
  return bytes + ' bytes';
}

function sha256Hex(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

const DAILY_COLORS = {
  primary: 0x8B5CF6,
  success: 0x22C55E,
  warning: 0xF59E0B,
  danger: 0xEF4444,
  muted: 0x64748B,
};

function dailyEmbed(title, description, color = DAILY_COLORS.primary) {
  return new EmbedBuilder()
    .setColor(color)
    .setAuthor({
      name: 'D A I L Y   D E O B F  /  LUAU ANALYSIS',
      iconURL: 'https://cdn.discordapp.com/embed/avatars/5.png',
    })
    .setTitle('◆  ' + String(title || 'DAILY DEOBF').slice(0, 250))
    .setDescription(String(description || ' ').slice(0, 4000))
    .setFooter({ text: 'DAILY DEOBF  •  STATIC + DYNAMIC ANALYSIS  •  SYSTEM ONLINE' })
    .setTimestamp();
}

function buildDeobfPreview(source, elapsedMs = 0, maxLines = 5) {
  const lines = String(source || '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split('\n');
  const isNoise = (line) => {
    const value = String(line || '').trim();
    return !value ||
      /^--(?:deobf by daily deobf|deobfuscated in )/i.test(value) ||
      /^if\s+[^\n]+\s+then\s*$/.test(value) ||
      /^end\s*[,;)]?\s*$/.test(value) ||
      /^local\s+function\s+(?:fn|recovered_proto|proto_)[\w]*\s*\(/i.test(value) ||
      /^return\s+(?:false|nil)\s*$/.test(value);
  };
  const payloadStart = lines.findIndex((line) =>
    /\b(?:game\s*[:.]\s*GetService|GetService\s*\(|Players\.LocalPlayer|LocalPlayer\s*=|Instance\.new|script\.Parent|workspace\b|Workspace\b)/i.test(line)
  );
  const start = payloadStart >= 0 ? payloadStart : lines.findIndex((line) => !isNoise(line));
  const useful = [];
  let lastIndex = Math.max(0, start);
  if (start >= 0) {
    for (let i = start; i < lines.length && useful.length < maxLines; i++) {
      if (isNoise(lines[i])) continue;
      useful.push(String(lines[i]).trim().replace(/\s+/g, ' '));
      lastIndex = i;
    }
  }
  if (!useful.length) return '';
  const remaining = lines.slice(lastIndex + 1).filter((line) => !isNoise(line)).length;
  const preview = useful.join(' ').replace(/\x60/g, "'");
  const clipped = preview.length > 820 ? preview.slice(0, 817) + '...' : preview;
  const duration = (Math.max(0, Number(elapsedMs) || 0) / 1000).toFixed(2);
  return '**Preview (first ' + maxLines + ' lines):**\n\n`' +
    clipped + (remaining > 0 ? ' ... and ' + remaining + ' more!' : '') + '`\n\nThis file was generated in ' + duration + 's.';
}

const DAILY_DEOBF_HEADER = '--deobf by daily deobf';

// The credit goes on the LAST line: Discord's file preview shows the first
// lines, which should be the recovered code, not banners.
async function prependDailyDeobfHeader(filePath) {
  let source = (await fs.readFile(filePath, 'utf8')).replace(/^\uFEFF/, '');
  // (an older top-of-file credit, if any: moved to the end)
  const lines = source.split(/\r?\n/);
  while (lines.length && (lines[0].trim().toLowerCase() === DAILY_DEOBF_HEADER || !lines[0].trim()
      || /^--\s*Deobfuscated in https:\/\/discord\.gg\//i.test(lines[0]))) lines.shift();
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  if (lines.length && lines[lines.length - 1].trim().toLowerCase() === DAILY_DEOBF_HEADER) lines.pop();
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  source = lines.join('\n');
  await fs.writeFile(filePath, (source ? source + '\n\n' : '') + DAILY_DEOBF_HEADER + '\n', 'utf8');
}

async function sendAutomaticPureLuau(message, sourceText, originalName, contextLabel) {
  // One result file per run: the automatic PureLuau copy (and its report) is
  // only sent when the host asks for every file (DEOB_SEND_ALL=1); /pureluau
  // still converts a file on request.
  if (!SEND_ALL_FILES) {
    return { status: 'skipped', reason: 'One-file mode: the automatic PureLuau copy is not sent (DEOB_SEND_ALL=1 sends it).' };
  }
  let result;
  try {
    result = createAutomaticPureLuauResult(sourceText, originalName);
  } catch (error) {
    console.error('Automatic PureLuau conversion failed:', error);
    return {
      status: 'failed',
      reason: String(error && error.message || error).slice(0, 300),
    };
  }

  if (result.status !== 'complete') return result;

  try {
    await message.reply({
      embeds: [dailyEmbed(
        'PureLuau · Automatic readability pass',
        'PureLuau ran automatically after ' + String(contextLabel || 'deobfuscation') + '. The raw engine output remains attached separately.\n\nConverted: **' + result.outputName + '**\nIdentifiers renamed: ' + result.identifiersRenamed + '\nFormatter syntax check: ' + (result.formatterSyntaxValidated ? 'passed' : 'not validated') + '\nStructural check: ' + (result.structuralValidationPassed ? 'passed' : 'review required'),
        DAILY_COLORS.success
      )],
      files: [
        new AttachmentBuilder(result.outputBuffer, { name: result.outputName }),
        new AttachmentBuilder(result.reportBuffer, { name: result.reportName }),
      ],
      allowedMentions: { repliedUser: false },
    });
    return { ...result, note: 'PureLuau output attached as ' + result.outputName + '.' };
  } catch (error) {
    console.error('Automatic PureLuau upload failed:', error);
    return {
      status: 'failed',
      reason: 'The conversion completed, but Discord could not upload the PureLuau files: ' + String(error && error.message || error).slice(0, 220),
    };
  }
}

function createAnalysisProgress(prompt, filename, inputBytes, label, options = {}) {
  const startedAt = Date.now();
  const displayLabel = options.displayLabel || (/^Luraph\b/i.test(label) ? 'Luraph' : label);
  const payloadLabel = /^Luraph\b/i.test(label)
    ? 'Decrypting the Luraph payload'
    : 'Decrypting the protected payload';
  const stages = [
    payloadLabel,
    'Lifting VM functions',
    'Validating and packaging output',
  ];
  const loadingEmoji = options.loadingEmoji || '🔄';
  const doneEmoji = '✅';
  const maxDevirtRounds = Number.isFinite(options.maxDevirtRounds)
    ? Math.max(1, options.maxDevirtRounds)
    : 200;
  let stageIndex = 0;
  let workCount = null;
  let workLabel = 'VM functions processed';
  let phase = 'Queued engine startup';
  let detail = 'Waiting for the selected engine to initialize.';
  let lastEdit = 0;
  let editing = false;
  let stopped = false;
  let completed = false;
  let failed = false;
  let lastEngineOutputAt = Date.now();
  let lastMeaningfulProgressAt = Date.now();
  let phaseStartedAt = Date.now();
  let lastDiagnosticLine = '';
  let lastErrorLine = '';
  let statusEditError = '';
  const candidateProgress = new Map();

  function stageFor(value) {
    const text = String(value || '').toLowerCase();
    if (/checking|packaging|validat|preparing download|collecting .*artifacts|attaching/.test(text)) return 2;
    if (/lift|devirt|function|constant|reconstruct|coverage|unlifted|walk/.test(text)) return 1;
    if (/trace|decrypt|initializ|prepar|fingerprint|runtime|captur|instrument|execut/.test(text)) return 0;
    return null;
  }

  function advance(nextPhase, nextDetail) {
    let changed = false;
    if (nextPhase) {
      const next = String(nextPhase);
      if (next !== phase) {
        phaseStartedAt = Date.now();
        changed = true;
      }
      phase = next;
      const nextStage = stageFor(phase);
      if (nextStage !== null) stageIndex = Math.max(stageIndex, nextStage);
    }
    if (nextDetail) {
      const next = String(nextDetail);
      if (next !== detail) changed = true;
      detail = next;
    }
    if (changed) lastMeaningfulProgressAt = Date.now();
  }

  function updateCount(value, unit) {
    const count = Number(String(value).replaceAll(',', ''));
    if (!Number.isFinite(count) || count < 0) return;
    const nextCount = Math.floor(count);
    const nextLabel = unit || 'VM functions processed';
    if (nextCount !== workCount || nextLabel !== workLabel) lastMeaningfulProgressAt = Date.now();
    workCount = nextCount;
    workLabel = nextLabel;
  }

  // Compact status card: an embed (grey while running, green when done,
  // red on failure) instead of a big markdown heading plus a stack of
  // diagnostic lines.
  function render() {
    const elapsed = Date.now() - startedAt;
    const heading = failed
      ? '❌ **' + displayLabel + ' stopped**'
      : (completed
        ? doneEmoji + ' **' + displayLabel + ' finished**'
        : (options.activeHeading
          ? String(options.activeHeading).replace(/^#+\s*/, '').replace(/^(\S+)\s+(.*)$/, '$1 **$2**')
          : loadingEmoji + ' **Running ' + displayLabel + '**'));
    const lines = [heading, ''];

    for (let i = 0; i < stages.length; i++) {
      const marker = completed || i < stageIndex
        ? doneEmoji
        : (i === stageIndex ? (failed ? '❌' : loadingEmoji) : '▫️');
      lines.push(marker + ' ' + (i === stageIndex && !completed ? '**' + stages[i] + '**' : stages[i]));
    }

    // one status line: time · work done (only once there is some) · stage
    const now = Date.now();
    const status = [formatDuration(elapsed)];
    if (workCount) status.push(workCount.toLocaleString('en-US') + ' ' + workLabel);
    if (!failed && !completed && phase && phase.toLowerCase() !== String(stages[stageIndex]).toLowerCase()) {
      status.push(phase.slice(0, 60) + ' (' + formatDuration(now - phaseStartedAt) + ')');
    }
    lines.push('', '-# ' + status.join(' · '));

    if (failed && detail) {
      lines.push('-# ' + detail.slice(0, 200));
    } else if (!completed) {
      if (detail) lines.push('-# ' + detail.slice(0, 140));
      if (lastErrorLine) lines.push('-# ⚠️ ' + lastErrorLine.slice(0, 140));
      const silentForMs = now - lastEngineOutputAt;
      if (silentForMs >= 20_000) lines.push('-# ⏳ quiet for ' + formatDuration(silentForMs) + ' (still running)');
    }
    if (statusEditError) lines.push('-# ⚠️ status update: ' + statusEditError.slice(0, 100));

    return new EmbedBuilder()
      .setColor(failed ? DAILY_COLORS.danger : (completed ? DAILY_COLORS.success : DAILY_COLORS.muted))
      .setDescription(lines.join('\n').slice(0, 4000));
  }

  async function publish(force = false) {
    if (stopped && !force) return;
    const now = Date.now();
    if (!force && now - lastEdit < 2500) return;
    if (editing) return;
    editing = true;
    lastEdit = now;
    try {
      await prompt.edit({ content: '', embeds: [render()], components: [] });
      statusEditError = '';
    } catch (error) {
      statusEditError = String(error && (error.message || error) || 'Discord message edit failed');
    }
    editing = false;
  }

  function onLine(rawLine) {
    const receivedLine = String(rawLine || '').replace(/\x1b\[[0-9;]*m/g, '').trim();
    const candidateMatch = receivedLine.match(/^\[candidate ([^\]]+)\]\s*(.*)$/);
    const line = (candidateMatch ? candidateMatch[2] : receivedLine).trim();
    if (!line) return;
    const candidatePrefix = candidateMatch ? '[' + candidateMatch[1] + '] ' : '';
    if (candidateMatch) {
      candidateProgress.set(candidateMatch[1], line.slice(0, 150));
      while (candidateProgress.size > 4) {
        candidateProgress.delete(candidateProgress.keys().next().value);
      }
    }
    lastEngineOutputAt = Date.now();
    // Per-block lifter debug output (DEVIRT_ERRS / DEVIRT_TB): tracebacks,
    // `luasym.Unsupported: compare None 109`, `-- at 0:167 op (0, 22)`, VM
    // register dumps. These are expected while round 1 meets constants that are
    // decoded and retried in later rounds; shown as "Engine warning/error" they
    // made every normal run look like a crash. Keep them out of the status.
    const liftNoise = /^(?:Traceback \(most recent call last\)|File "|[\w.]*(?:Unsupported|WalkIncomplete|VMCrash)\b:?|--\s*at\s+\d+:\d+|arr#\d|[~^]{3,}|raise\b|\w[\w.]*\(.*\)$)/.test(line) ||
      (!/^\[[*+!]\]/.test(line) && /^\s*(?:self\.|it\.|st\.|node\b|return\b|[A-Za-z_][\w.]*\s*=)/.test(line));
    if (liftNoise) return;
    lastDiagnosticLine = (candidatePrefix + line).slice(0, 220);
    if (/^\[!\]/.test(line) || /\b(fatal|killed|out of memory)\b/i.test(line) || /^(?:RuntimeError|MemoryError|SystemExit)\b/.test(line)) {
      lastErrorLine = (candidatePrefix + line).slice(0, 220);
    }
    let match;

    if ((match = line.match(/walk progress: proto ([^,]+), ([\d,]+) states visited \(([\d,]+) pending\)(?:, ([\d,]+) steps processed)?/i))) {
      advance('Reconstructing Luau control flow',
        'Proto ' + match[1] + ' · ' + match[2] + ' states visited · ' + match[3] + ' queued' +
        (match[4] ? ' · ' + match[4] + ' steps processed' : '') + '.');
    } else if ((match = line.match(/walk start: proto ([^,]+), ([\d,]+) functions started/i))) {
      updateCount(match[2], 'VM functions started');
      advance('Lifting VM functions',
        'Started walking proto ' + match[1] + '. Completed walks are reported separately at the end of each round.');
    } else if ((match = line.match(/obfuscator:\s*(.+)/i))) {
      advance('Fingerprinting the input', 'Matched engine: ' + match[1].slice(0, 100));
    } else if ((match = line.match(/tracing .*?\(run\s+(\d+)\)/i))) {
      advance('Executing VM trace pass ' + match[1], 'Tracing the protected payload and recording VM behavior.');
    } else if ((match = line.match(/([\d,]+) Path2D answers computed by the offline engine model/i))) {
      advance('Resolving Roblox API-dependent values', match[1] + ' Path2D answers resolved.');
    } else if ((match = line.match(/script loadstring.d\s+(\d+)\s+new VM chunk/i))) {
      advance('Capturing dynamically loaded chunks', 'Captured ' + match[1] + ' new VM chunk(s).');
    } else if (/anti-tamper trap|anti-tamper trigger|LPH_CRASH/i.test(line)) {
      advance('Mapping protected execution paths', 'The engine observed an anti-tamper-related branch.');
    } else if ((match = line.match(/devirt round\s+(\d+):\s*([\d,]+) functions\s*\(([\d,]+) walked\),\s*([\d,]+) unlifted blocks,\s*([\d,]+) new constant requests/i))) {
      updateCount(match[3], 'VM functions walked');
      advance('Lifting VM functions · round ' + match[1],
        match[2] + ' functions discovered · ' + match[3] + ' walked · ' + match[4] + ' unlifted blocks.');
    } else if ((match = line.match(/devirtualizing\s+\(round\s+(\d+)\)/i))) {
      advance('Reconstructing Luau control flow · round ' + match[1],
        'The lifter is processing round ' + match[1] + ' of the configured limit ' + maxDevirtRounds + '.');
    } else if ((match = line.match(/([\d,]+) functions,\s*([\d,]+) unlifted blocks,\s*([\d,]+) unstructured jumps/i))) {
      updateCount(match[1], 'VM functions lifted');
      advance('Measuring lift coverage',
        match[1] + ' functions · ' + match[2] + ' unlifted blocks · ' + match[3] + ' unstructured jumps.');
    } else if ((match = line.match(/([\d,]+)\s+(?:VM )?closures?\s+(?:made|created|discovered|walked)/i))) {
      updateCount(match[1], /made|created/i.test(line) ? 'closures made' : 'closures discovered');
      advance('Lifting VM functions', 'The engine reported ' + match[1] + ' closures.');
    } else if ((match = line.match(/constants decoded on request:\s*calls=(\d+)\s+decoded=(\d+).*?(\d+(?:\.\d+)?)s,\s*(\d+) buffer patches/i))) {
      advance('Resolving deferred constants',
        'Latest pass: ' + match[1] + ' calls, ' + match[2] + ' decoded, ' + match[4] + ' buffer patches.');
    } else if (/constants decoded on request|constant request run/i.test(line)) {
      advance('Resolving deferred constants', line.replace(/^\[\*\]\s*/, '').slice(0, 180));
    } else if (/corrupt\/encrypted register|symbolic value store|unlifted block|unstructured jump/i.test(line)) {
      advance('Recording unresolved VM operations', line.replace(/^\[!\]\s*/, '').slice(0, 180));
    } else if (/devirtualization failed|devirtualization produced no output|devirtualized output is broken/i.test(line)) {
      advance('Reviewing incomplete reconstruction', line.replace(/^\[!\]\s*/, '').slice(0, 180));
    } else if (/result:|run status: finished|done:.*succeeded/i.test(line)) {
      advance('Checking reconstructed output', line.replace(/^\[\*\]\s*/, '').slice(0, 180));
    } else if (/^\[!\]|\bwarning\b|\berror\b/i.test(line)) {
      advance(phase, line.slice(0, 180));
    }

    void publish(false);
  }

  onLine.isStalled = (timeoutMs) => Date.now() - lastMeaningfulProgressAt >= timeoutMs;
  const timer = setInterval(() => { void publish(false); }, 1800);

  return {
    start: () => {
      advance('Initializing selected engine', 'Preparing the engine process and analysis workspace.');
      return publish(true);
    },
    onLine,
    setPhase: async (nextPhase, nextDetail) => {
      advance(nextPhase, nextDetail);
      await publish(true);
    },
    complete: async (nextDetail) => {
      if (nextDetail) detail = String(nextDetail);
      stageIndex = stages.length - 1;
      stopped = true;
      completed = true;
      clearInterval(timer);
      await publish(true);
    },
    fail: async (error) => {
      failed = true;
      advance(phase, String(error && (error.message || error) || 'Unknown engine error').slice(0, 240));
      stopped = true;
      clearInterval(timer);
      await publish(true);
    },
    stop: () => { stopped = true; clearInterval(timer); },
  };
}

async function capturePartialArtifact(error, candidatePaths = []) {
  if (!error || error.partialArtifact) return;
  for (const candidatePath of candidatePaths) {
    try {
      const stat = await fs.stat(candidatePath);
      if (!stat.isFile() || stat.size <= 0 || stat.size > MAX_OUTPUT_BYTES) continue;
      const data = await fs.readFile(candidatePath);
      error.partialArtifact = {
        name: path.basename(candidatePath).replace(/[^A-Za-z0-9._-]/g, '_') || 'partial-result.luau',
        data,
      };
      return;
    } catch {}
  }
}

function fullErrorText(error) {
  const stack = error && error.stack ? String(error.stack) : String(error && (error.message || error) || 'Unknown error');
  const stdout = error && error.stdout ? String(error.stdout) : '';
  const stderr = error && error.stderr ? String(error.stderr) : '';
  return [
    stack,
    error && Number.isInteger(error.exitCode) ? 'Exit code: ' + error.exitCode : '',
    error && error.signal ? 'Signal: ' + error.signal : '',
    stdout ? '\n--- STDOUT ---\n' + stdout : '',
    stderr ? '\n--- STDERR ---\n' + stderr : '',
  ].filter(Boolean).join('\n').slice(0, 900_000);
}

async function showDeobfFailure(message, prompt, title, error) {
  const reportText = fullErrorText(error);
  const errorBuffer = Buffer.from(reportText, 'utf8');
  const logs = [error && error.stdout, error && error.stderr].filter(Boolean).join('\n\n');
  const files = [
    new AttachmentBuilder(errorBuffer, { name: 'error-details.txt' }),
  ];
  if (logs) files.push(new AttachmentBuilder(Buffer.from(String(logs).slice(0, 900_000), 'utf8'), { name: 'engine-logs.txt' }));
  if (error && error.partialArtifact && error.partialArtifact.data) {
    files.push(new AttachmentBuilder(error.partialArtifact.data, { name: 'partial-' + error.partialArtifact.name }));
  }

  const shortMessage = String(error && (error.message || error) || 'Unknown error').slice(0, 1100);
  await prompt.edit({
    content: '❌ **' + title + '**\n' + shortMessage.replace(/`/g, "'") +
      '\n\nFull diagnostic attached as `error-details.txt`.' +
      (error && error.partialArtifact ? '\nA partial output was recovered and attached.' : ''),
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('deobf-error-copy:' + message.author.id)
          .setLabel('View / copy error')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('deobf-error-report:' + message.author.id)
          .setLabel('Report error')
          .setStyle(ButtonStyle.Danger),
      ),
    ],
  }).catch(() => {});
  await message.reply({
    content: 'Diagnostic files for **' + title + '**:',
    files,
    allowedMentions: { repliedUser: false },
  }).catch(() => {});

  if (error && error.originalInput && error.originalInput.data) {
    await message.reply({
      content: '📎 Original protected input, unchanged:',
      files: [new AttachmentBuilder(error.originalInput.data, {
        name: error.originalInput.name || 'original-obfuscated.lua',
      })],
      allowedMentions: { repliedUser: false },
    }).catch(() => {});
  }

  const collector = prompt.createMessageComponentCollector({
    time: 15 * 60_000,
    filter: (interaction) =>
      interaction.user.id === message.author.id &&
      (interaction.customId === 'deobf-error-copy:' + message.author.id ||
       interaction.customId === 'deobf-error-report:' + message.author.id),
  });

  collector.on('collect', async (interaction) => {
    if (interaction.customId === 'deobf-error-copy:' + message.author.id) {
      const preview = reportText.length > 1500
        ? reportText.slice(0, 1450) + '\n...[truncated; full text is in error-details.txt]'
        : reportText;
      await interaction.reply({
        content: 'Copy the diagnostic text below. The complete error is attached as `error-details.txt`.\n```text\n' +
          preview.replace(/```/g, "'''") + '\n```',
        ephemeral: true,
      }).catch(() => {});
      return;
    }

    if (!message.guild) {
      await interaction.reply({
        content: 'Error reports can only be sent from a server channel.',
        ephemeral: true,
      }).catch(() => {});
      return;
    }

    await interaction.deferReply({ ephemeral: true }).catch(() => {});
    try {
      const channelName = 'deobf-error-' + message.author.id.slice(-5) + '-' + Date.now().toString(36).slice(-5);
      const reportChannel = await message.guild.channels.create({
        name: channelName.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 90),
        type: ChannelType.GuildText,
        topic: 'Private DAILY DEOBF error report. Reporter: ' + message.author.id,
        permissionOverwrites: [
          {
            id: message.guild.roles.everyone.id,
            deny: [PermissionFlagsBits.ViewChannel],
          },
          {
            id: client.user.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.AttachFiles,
            ],
          },
          {
            id: message.author.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.ReadMessageHistory,
            ],
          },
        ],
        reason: 'User requested a private DAILY DEOBF error report',
      });
      const reportHeader = [
        'DAILY DEOBF error report',
        'Engine: ' + title,
        'Reporter: ' + message.author.tag + ' (' + message.author.id + ')',
        'Server: ' + message.guild.name + ' (' + message.guild.id + ')',
        'Original channel: ' + message.channelId,
        'Timestamp: ' + new Date().toISOString(),
        '',
        reportText,
      ].join('\n');
      const reportFiles = [
        new AttachmentBuilder(Buffer.from(reportHeader.slice(0, 900_000), 'utf8'), { name: 'error-report.txt' }),
      ];
      if (error && error.partialArtifact && error.partialArtifact.data) {
        reportFiles.push(new AttachmentBuilder(error.partialArtifact.data, {
          name: 'partial-' + error.partialArtifact.name,
        }));
      }
      await reportChannel.send({
        content: 'Private error report submitted by <@' + message.author.id + '>.',
        files: reportFiles,
        allowedMentions: { users: [message.author.id] },
      });
      await interaction.editReply('Report sent to private channel <#' + reportChannel.id + '>. The channel is visible to you, the bot, and server administrators.');
    } catch (reportError) {
      await interaction.editReply(
        'Could not create/send the private report channel. The bot needs Manage Channels, View Channel, Send Messages and Attach Files permissions. Error: ' +
        String(reportError.message || reportError).slice(0, 700)
      ).catch(() => {});
    }
  });
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
    let stalled = false;
    let lastDistinctProgress = '';
    let lastDistinctProgressAt = Date.now();
    const STALL_TIMEOUT_MS = Number.isFinite(options.stallTimeoutMs)
      ? Math.max(30_000, options.stallTimeoutMs)
      : 180_000;
    const outputArgIndex = args.findIndex((arg, index) =>
      (arg === '-o' || arg === '--output') && typeof args[index + 1] === 'string'
    );
    const expectedOutputPath = outputArgIndex >= 0 ? path.resolve(cwd || process.cwd(), args[outputArgIndex + 1]) : null;

    child.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      if (stdout.length < 512_000) stdout += text.slice(0, 512_000 - stdout.length);
      // Some engines report progress on stdout instead of stderr.
      const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
      for (const line of lines) {
        if (line !== lastDistinctProgress) {
          lastDistinctProgress = line;
          lastDistinctProgressAt = Date.now();
        }
      }
    });

    child.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      if (stderr.length < 512_000) stderr += text.slice(0, 512_000 - stderr.length);
      pendingStderr += text;
      let newline;
      while ((newline = pendingStderr.indexOf('\n')) !== -1) {
        const line = pendingStderr.slice(0, newline).trim();
        pendingStderr = pendingStderr.slice(newline + 1);
        if (line) {
          if (line !== lastDistinctProgress) {
            lastDistinctProgress = line;
            lastDistinctProgressAt = Date.now();
          }
          if (options.onProgress) options.onProgress(line);
        }
      }
    });

    const stallTimer = setInterval(() => {
      const progressStale = typeof options.onProgress?.isStalled === 'function'
        ? options.onProgress.isStalled(STALL_TIMEOUT_MS)
        : Date.now() - lastDistinctProgressAt >= STALL_TIMEOUT_MS;
      if (stalled || timedOut || !progressStale) return;
      stalled = true;
      child.kill('SIGKILL');
    }, 5_000);

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, timeoutMs);

    child.once('error', (error) => {
      clearTimeout(timer);
      clearInterval(stallTimer);
      error.stdout = stdout;
      error.stderr = stderr;
      reject(error);
    });

    child.once('close', async (code, signal) => {
      clearTimeout(timer);
      clearInterval(stallTimer);
      if (pendingStderr.trim()) {
        const finalLine = pendingStderr.trim();
        if (finalLine !== lastDistinctProgress) {
          lastDistinctProgress = finalLine;
          lastDistinctProgressAt = Date.now();
        }
        if (options.onProgress) options.onProgress(finalLine);
      }
      if (stalled && expectedOutputPath) {
        const partial = await fs.stat(expectedOutputPath).catch(() => null);
        if (partial && partial.isFile() && partial.size > 0) {
          const marker = '\n[!] Engine stopped after ' + formatDuration(STALL_TIMEOUT_MS) +
            ' without new progress; returning the output file already written.';
          return resolve({ stdout, stderr: stderr + marker, stalled: true, partialOutput: true });
        }
      }
      if (timedOut || signal === 'SIGKILL') {
        // Only report a timeout when OUR timer fired. A SIGKILL we did not
        // send comes from the host (almost always the out-of-memory killer),
        // and calling that a "25m limit" after one minute was misleading.
        const error = new Error(timedOut
          ? 'The engine exceeded its ' + formatDuration(timeoutMs) + ' processing limit.'
          : 'The engine was killed by the host system (signal ' + (signal || 'SIGKILL') + ') before finishing; this is almost always the server running out of memory on a large input, not a timeout.');
        error.killedByHost = !timedOut;
        error.stdout = stdout;
        error.stderr = stderr;
        error.signal = signal || 'SIGKILL';
        return reject(error);
      }
      if (code !== 0) {
        const raw = (stderr || stdout).trim();
        const lines = raw.split('\n').filter(Boolean);
        const detail = lines.length > 18 ? [...lines.slice(0, 12), '…', ...lines.slice(-6)].join('\n') : lines.join('\n');
        const error = new Error(detail || ('Deobfuscator exited with code ' + code + '.'));
        error.stdout = stdout;
        error.stderr = stderr;
        error.exitCode = code;
        error.signal = signal || null;
        return reject(error);
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

// One result file per run unless the host asks for everything (DEOB_SEND_ALL=1).
const SEND_ALL_FILES = process.env.DEOB_SEND_ALL === '1';

// The few engine lines worth showing in the message (what the one file is).
function engineSummaryLines(log) {
  const keep = [];
  for (const line of String(log || '').split('\n')) {
    if (/^\[\*\] (removed Luraph runtime code|named \d+ function|run status)/.test(line)
      || /^\[!\] \d+ VM block\(s\) could not be lifted/.test(line)) {
      keep.push(line.replace(/^\[[*!]\] /, '').slice(0, 300));
    }
  }
  return keep.length ? '\n' + keep.slice(0, 5).map((l) => '• ' + l).join('\n') : '';
}

function runPythonEngine(engineDir, engineCli, inputPath, outputPath, timeoutMs, extraArgs = [], options = {}) {
  const python = process.env.PYTHON_BIN || (process.platform === 'win32' ? 'python' : 'python3');
  return runCommand(python, [engineCli, inputPath, '-o', outputPath, ...extraArgs], engineDir, timeoutMs, options);
}


function parsePolsecLoaderPaste(text) {
  const src = String(text || '');
  const urlMatch = src.match(/https?:\/\/api\.polsec\.net\/loader\/([a-f0-9]+)\/([a-f0-9]+)/i);
  if (!urlMatch) return null;
  const keyMatch = src.match(/(?:getgenv\(\)\.)?script_key\s*=\s*["']([^"']+)["']/i)
    || src.match(/SCRIPT_KEY\s*=\s*["']([^"']+)["']/i);
  return {
    loaderUrl: urlMatch[0],
    id1: urlMatch[1],
    id2: urlMatch[2],
    scriptKey: keyMatch ? keyMatch[1].trim() : null,
  };
}

async function polsecRequestJson(url, options = {}) {
  const method = String(options.method || 'GET').toUpperCase();
  const body = options.body !== undefined && options.body !== null
    ? (Buffer.isBuffer(options.body) ? options.body : Buffer.from(String(options.body), 'utf8'))
    : undefined;
  const headers = {
    'user-agent': 'Roblox/WinInet',
    accept: '*/*',
    ...(options.headers || {}),
  };
  if (body && !headers['content-type'] && !headers['Content-Type']) {
    headers['content-type'] = 'application/json';
  }
  const parsed = new URL(url);
  const addresses = await assertPublicUrl(parsed);
  let response = null;
  const errors = [];
  for (const address of addresses) {
    try {
      response = await requestPinnedAddress(parsed, address, {
        method,
        headers,
        body,
        compressed: false,
        maxTime: options.maxTime || 20,
        connectTimeout: options.connectTimeout || 10,
      });
      break;
    } catch (error) {
      errors.push(String(error && error.message || error));
    }
  }
  if (!response) {
    throw new Error('Polsec request failed: ' + (errors.join(' | ') || 'no response'));
  }
  const bytes = await readResponse(response, 8 * 1024 * 1024);
  const text = bytes.toString('utf8');
  return {
    status: response.status,
    ok: response.ok,
    text,
    json: (() => {
      try { return JSON.parse(text); } catch { return null; }
    })(),
  };
}

/**
 * Authorized Polsec flow for a known script_key:
 * 1) GET /loader/session/id1/id2?socket=1
 * 2) POST /runtime/socket/http type-2 auth
 * 3) On d===200, return e.d payload string
 */
async function fetchPolsecPayloadWithKey(id1, id2, scriptKey) {
  if (!scriptKey || String(scriptKey).length < 8) {
    throw new Error('SCRIPT_KEY is required for the Polsec session/socket flow.');
  }
  const sessionUrl = 'https://api.polsec.net/loader/session/' + id1 + '/' + id2 + '?socket=1';
  const session = await polsecRequestJson(sessionUrl, { method: 'GET' });
  if (!session.ok || !session.json || session.json.a === undefined || !session.json.b) {
    const detail = session.text ? session.text.slice(0, 200) : ('HTTP ' + session.status);
    throw new Error('Polsec session failed (' + session.status + '): ' + detail);
  }
  const sessionId = String(session.json.a);
  const token = String(session.json.b);

  const bodyObj = {
    a: sessionId,
    b: token,
    c: [2],
    d: {
      a: 0,
      c: 1,
      b: 3,
      d: 2,
      e: {
        a: ['Unknown', '0'],
        b: ['5', '1', '5342'],
        d: String(scriptKey),
        f: sessionId,
      },
    },
  };
  const socket = await polsecRequestJson('https://api.polsec.net/runtime/socket/http', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(bodyObj),
  });

  if (socket.text && socket.text.trim() === '1003') {
    throw new Error('Polsec session rejected (1003). Session expired or invalid for this client.');
  }
  const payload = socket.json;
  if (!payload || typeof payload !== 'object') {
    throw new Error('Polsec socket returned non-JSON: ' + String(socket.text || '').slice(0, 200));
  }
  if (Number(payload.d) !== 200) {
    const code = payload.d === undefined ? 'unknown' : String(payload.d);
    const detail = typeof payload.e === 'string'
      ? payload.e
      : (payload.e && typeof payload.e === 'object' ? JSON.stringify(payload.e).slice(0, 200) : '');
    throw new Error('Polsec socket auth failed (' + code + ')' + (detail ? ': ' + detail : ''));
  }
  if (!payload.e || typeof payload.e.d !== 'string' || !payload.e.d.trim()) {
    throw new Error('Polsec returned d=200 but e.d was missing or empty.');
  }
  return {
    source: payload.e.d,
    sessionId,
    rawResponse: payload,
  };
}


async function startFulcrumWorkflow(message, inlineSource = null) {
  const attachment = message.attachments.first() || null;
  if (inlineSource && attachment) {
    await message.reply({ content: 'Use either a loader URL or a source-file attachment, not both.', allowedMentions: { repliedUser: false } });
    return;
  }
  if (!attachment && !inlineSource) {
    await message.reply({
      embeds: [dailyEmbed(
        'Fulcrum · How to use',
        [
          '**1. Provide the loader or source**',
          'Attach `.lua`, `.luau` or `.txt` source, a `.json` file containing an authorized Polsec response, or provide a direct static source URL.',
          '',
          '**2. Run the analysis**',
          'Fulcrum statically analyzes the source it receives. It does not execute the protected program.',
          '',
          '**Polsec loader + key**',
          '`.fulcrum script_key="KEY" https://api.polsec.net/loader/ID1/ID2`',
          'Runs session (`?socket=1`) then socket type-2 auth and analyzes `e.d` when `d=200`.',
          '',
          '**Or** attach a captured Polsec JSON (`d:200`, string at `e.d`), or a Fulcrum `.lua` file.',
          '',
          '**4. Get your results**',
          'The bot returns the recovered Luau candidate and a Markdown analysis report. Static reconstruction may not preserve every runtime behavior.'
        ].join('\n'),
        DAILY_COLORS.primary
      )],
      allowedMentions: { repliedUser: false },
    });
    return;
  }
  if (attachment && !/\.(?:lua|luau|txt|json)$/i.test(String(attachment.name || ''))) {
    await message.reply({
      content: 'Fulcrum accepts .lua, .luau, .txt source files or a captured .json response.',
      allowedMentions: { repliedUser: false },
    });
    return;
  }

  const prompt = await message.reply({
    embeds: [dailyEmbed(
      'Fulcrum · Processing',
      inlineSource
        ? 'Downloading the supplied static source URL and running static Fulcrum analysis. The protected program is not executed.'
        : 'Running static Fulcrum analysis on the attached Luau source. The protected program is not executed.',
      DAILY_COLORS.primary
    )],
    allowedMentions: { repliedUser: false },
  });
  let workDir = null;
  try {
    let input;
    if (inlineSource) {
      const polsec = parsePolsecLoaderPaste(inlineSource);
      if (polsec && polsec.scriptKey) {
        // Full authorized flow: session -> socket type-2 -> e.d payload
        const got = await fetchPolsecPayloadWithKey(polsec.id1, polsec.id2, polsec.scriptKey);
        input = {
          source: got.source,
          filename: 'polsec-payload-' + polsec.id1.slice(0, 8) + '.lua',
          polsecMeta: { sessionId: got.sessionId, id1: polsec.id1, id2: polsec.id2 },
        };
      } else {
        const match = inlineSource.match(/https?:\/\/[^\s"'<>]+/i);
        if (!match) throw new Error('Provide a valid HTTP/HTTPS loader URL. Example: .fulcrum https://api.polsec.net/loader/ID1/ID2 script_key=\"YOUR_KEY\"');
        const rawUrl = match[0].replace(/[)\]},.;]+$/g, '');
        const parsed = new URL(rawUrl);
        if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Only HTTP/HTTPS loader URLs are supported.');
        const fetched = await fetchPublicText(parsed.toString());
        input = {
          source: decodeSource(fetched.bytes),
          filename: path.basename(parsed.pathname) || 'remote-loader.lua',
        };
        if (!input.source.trim()) throw new Error('The loader URL returned an empty response.');
        if (polsec && !polsec.scriptKey) {
          // Polsec loader without key: analyze the public Fulcrum client only
          input.filename = 'polsec-loader-client.lua';
        }
      }
    } else {
      input = await inputFromAttachment(attachment);
      if (/\.json$/i.test(String(attachment.name || ''))) {
        let captured;
        if (String(input.source).trim() === '1003') {
          throw new Error('Polsec session expired (1003). Start a new authorized session and capture a fresh response.');
        }
        try {
          captured = JSON.parse(input.source);
        } catch {
          throw new Error('The attached JSON is not valid JSON.');
        }
        if (!captured || typeof captured !== 'object' || Array.isArray(captured)) {
          throw new Error('Expected a Polsec response object.');
        }
        if (Number(captured.d) !== 200) {
          const code = captured.d === undefined ? 'unknown' : String(captured.d);
          const detail = typeof captured.e === 'string'
            ? captured.e
            : (captured.e && typeof captured.e.message === 'string' ? captured.e.message : '');
          throw new Error('Polsec returned ' + code + (detail ? ': ' + detail : ''));
        }
        if (!captured.e || typeof captured.e.d !== 'string' || !captured.e.d.trim()) {
          throw new Error('Polsec reported success (d=200), but e.d was missing or empty.');
        }
        input = {
          source: captured.e.d,
          filename: path.basename(String(attachment.name || 'polsec-response.json')).replace(/\.json$/i, '') + '.lua',
        };
      }
    }
    workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'daily-fulcrum-'));
    const inputPath = path.join(workDir, 'input.lua');
    const outputDir = path.join(workDir, 'out');
    await fs.writeFile(inputPath, input.source, { encoding: 'utf8', mode: 0o600 });

    await runPythonEngine(
      ENGINE_FULCRUM_DIR,
      ENGINE_FULCRUM_CLI,
      inputPath,
      outputDir,
      150_000,
      [],
      { stallTimeoutMs: 120_000 }
    );

    const recoveredPath = path.join(outputDir, 'recovered.lua');
    const reportPath = path.join(outputDir, 'REPORT.md');
    const stringsPath = path.join(outputDir, 'strings.txt');
    const recoveredStat = await fs.stat(recoveredPath);
    const reportStat = await fs.stat(reportPath);
    const stringsStat = await fs.stat(stringsPath).catch(() => null);
    if (!recoveredStat.size) throw new Error('Fulcrum produced an empty recovered source file.');
    if (recoveredStat.size > MAX_OUTPUT_BYTES || reportStat.size > 2 * 1024 * 1024) {
      throw new Error('Fulcrum source or report exceeded the configured attachment size limit.');
    }
    const recovered = await fs.readFile(recoveredPath);
    const report = await fs.readFile(reportPath);
    const strings = stringsStat && stringsStat.size <= MAX_OUTPUT_BYTES
      ? await fs.readFile(stringsPath)
      : null;

    const originalName = input.filename || 'script.lua';
    const originalBase = path.basename(originalName, path.extname(originalName));
    const safeBase = originalBase.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 70) || 'script';
    const recoveredName = safeBase + '.fulcrum-recovered.lua';
    const reportName = safeBase + '.fulcrum-report.md';
    const recoveredParts = makeSourceParts(recovered, recoveredName);
    const files = recoveredParts.map((part) => new AttachmentBuilder(part.data, { name: part.name }));
    files.push(new AttachmentBuilder(report, { name: reportName }));

    await prompt.edit({
      embeds: [dailyEmbed(
        'Fulcrum · Recovery complete',
        'Recovered source and analysis report are attached. This is a static reconstruction; original variable names and runtime-only values may not be recoverable.',
        DAILY_COLORS.success
      )],
      files,
      components: [],
    });

    if (strings && strings.length) {
      const stringParts = makeSourceParts(strings, safeBase + '.fulcrum-strings.txt');
      await message.reply({
        content: 'Decoded string table:',
        files: stringParts.map((part) => new AttachmentBuilder(part.data, { name: part.name })),
        allowedMentions: { repliedUser: false },
      }).catch(() => {});
    } else if (stringsStat && stringsStat.size > MAX_OUTPUT_BYTES) {
      await message.reply({
        content: 'The recovered source and report were sent. The decoded string table was too large to attach.',
        allowedMentions: { repliedUser: false },
      }).catch(() => {});
    }
  } catch (error) {
    const details = String(error && error.message || error).slice(0, 1100);
    await prompt.edit({
      content: 'Fulcrum could not recover this file: ' + details,
      embeds: [],
      components: [],
    }).catch(() => {});
    if (error && error.stderr) {
      await message.reply({
        content: 'Fulcrum diagnostic output:',
        files: [new AttachmentBuilder(Buffer.from(String(error.stderr).slice(0, 800_000), 'utf8'), {
          name: 'fulcrum-error.log',
        })],
        allowedMentions: { repliedUser: false },
      }).catch(() => {});
    }
    console.error('Fulcrum deobfuscation failed:', error);
  } finally {
    if (workDir) await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
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
  const traceValidation = traceBytes > 0
    ? inspectLiftText(await fs.readFile(preferredTracePath, 'utf8'))
    : null;
  const environmentProbeOnly = Boolean(
    validation.metrics.environmentProbeOnly ||
    (traceValidation && traceValidation.metrics.environmentProbeOnly)
  );
  if (environmentProbeOnly && !validation.metrics.environmentProbeOnly) {
    validation.metrics.environmentProbeOnly = true;
    validation.issues.push(
      'The runtime trace hit an explicit environment compatibility failure (PC-R01) before payload recovery.'
    );
    validation.categories.behavioralConsistency = { status: 'failed_before_payload' };
    if ((!validation.details || !validation.details.length) &&
        traceValidation && Array.isArray(traceValidation.details)) {
      validation.details = traceValidation.details.slice(0, 8);
    }
  }
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

  const resultLabel = environmentProbeOnly
    ? 'ENVIRONMENT CHECK FAILED · PAYLOAD NOT REACHED'
    : (hasLiftedSource
      ? 'FULL VM LIFT VERIFIED'
      : (hasLiftCandidate ? 'PARTIAL VM LIFT · VALIDATION FAILED' : 'BEHAVIOUR TRACE ONLY · VM LIFT NOT COMPLETED'));

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
    'Dynamic VM chunks captured: ' + chunkFiles.length,
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
    environmentProbeOnly
      ? 'The runtime reached an explicit environment compatibility failure (PC-R01) after executing scheduler, Path2D, instance and event probes. The payload was not reached in this run. The attached candidate is diagnostic probe output, not recovered source.'
      : (hasLiftedSource
        ? 'The Luau source candidate passed structural checks and the Luau AST syntax parser. This verifies output integrity, not perfect equivalence to the original source.'
        : (hasLiftCandidate
          ? 'The source candidate is incomplete and is attached only for inspection. Do not treat it as recovered source. The separate behaviour trace records observed runtime behaviour.'
          : 'The attached trace records observed runtime behaviour. It is not the original source or a complete devirtualization.')),
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
  const candidateOutputName = hasLiftedSource
    ? 'deobfuscated.luau'
    : (environmentProbeOnly
      ? 'environment_probe_partial.txt'
      : (hasLiftCandidate ? 'partial_result.luau' : 'runtime_trace.luau'));
  let attachedCandidateName = null;
  let candidateParts = [];
  if (candidateBytes > 0) {
    if (candidateBytes <= MAX_OUTPUT_BYTES) {
      attachedCandidateName = candidateOutputName;
      attachments.push(new AttachmentBuilder(await fs.readFile(candidatePath), { name: attachedCandidateName }));
    } else {
      const candidateBuffer = await fs.readFile(candidatePath);
      candidateParts = makeSourceParts(candidateBuffer, candidateOutputName);
      attachedCandidateName = candidateParts.length + ' output parts';
    }
  }

  // The report is part of the result, not merely a file written and left behind.
  // Keep the diagnostic bundle within one Discord upload; oversized source is
  // sent separately as ordered parts so it is never silently dropped.
  let attachmentBytes = candidateBytes > 0 && candidateBytes <= MAX_OUTPUT_BYTES ? candidateBytes : 0;
  const reportBytes = await fileSize(reportPath);
  // one file: the result (the report only when there is no result, or with DEOB_SEND_ALL=1)
  if (reportBytes > 0 && attachmentBytes + reportBytes <= MAX_OUTPUT_BYTES
    && (SEND_ALL_FILES || (!attachedCandidateName && !candidateParts.length))) {
    attachments.push(new AttachmentBuilder(reportPath, { name: 'analysis-report.txt' }));
    attachmentBytes += reportBytes;
  }

  // Attach the largest captured dynamic chunks first. The short/small Luraph
  // child chunk is now captured too; larger nested chunks are often the useful
  // context when the VM fails before it can write a prototype dump.
  const chunkCandidates = [];
  for (const name of chunkFiles) {
    const chunkPath = path.join(outputDir, name);
    const bytes = await fileSize(chunkPath);
    if (bytes > 0 && bytes <= MAX_OUTPUT_BYTES) chunkCandidates.push({ name, path: chunkPath, bytes });
  }
  chunkCandidates.sort((a, b) => b.bytes - a.bytes);
  let attachedChunkCount = 0;
  for (const chunk of chunkCandidates) {
    if (!SEND_ALL_FILES || attachedChunkCount >= 8) break;
    if (attachmentBytes + chunk.bytes > MAX_OUTPUT_BYTES) continue;
    attachments.push(new AttachmentBuilder(chunk.path, { name: chunk.name }));
    attachmentBytes += chunk.bytes;
    attachedChunkCount++;
  }

  if (!attachments.length) throw new Error('The engine did not produce a Luau output file.');

  const safeName = String(input.filename || 'script.lua').replaceAll(String.fromCharCode(96), '');
  let summary;
  if (environmentProbeOnly) {
    summary = '**DAILY DEOBF · ' + config.label + '**\n⚠️ Environment compatibility check failed (PC-R01) before payload execution.\nThis is probe output, not deobfuscated source.\nAttached: environment_probe_partial.txt' + (SEND_ALL_FILES ? ', analysis-report.txt and ' + attachedChunkCount + ' dynamic VM chunk(s).' : '.');
  } else if (hasLiftedSource) {
    summary = '**DAILY DEOBF · ' + config.label + '**\n✅ Luau candidate passed structural checks and syntax validation.\nProcessed: ' + safeName +
      '\nFunctions lifted: ' + (liftedFunctions === null ? 'see report' : liftedFunctions) +
      ' · Unlifted blocks: ' + (unliftedBlocks === null ? 'see report' : unliftedBlocks) +
      '\nCaptured prototypes: ' + (prototypeCount || 'see report') + ' · Dynamic VM chunks: ' + chunkFiles.length +
      '\nAttached: deobfuscated.lua';
  } else if (hasLiftCandidate) {
    summary = '**DAILY DEOBF · ' + config.label + '**\n⚠️ Partial VM lift only. Validation found unresolved VM output, so it is not labelled as recovered source.\nProcessed: ' + safeName +
      '\nAttached: partial_result.lua';
  } else {
    summary = '**DAILY DEOBF · ' + config.label + '**\n⚠️ Trace-only result. The full VM lift did not complete.\nProcessed: ' + safeName +
      '\nAttached: runtime_trace.lua (trace only, not reconstructed source)' +
      (SEND_ALL_FILES ? ', analysis-report.txt, and ' + attachedChunkCount + ' dynamic VM chunk(s).' : '.');
  }

  if (candidateParts.length) {
    summary = summary.replace(/Attached: .*$/, 'Attached: ' + candidateParts.length +
      ' ordered parts of ' + candidateOutputName + '.');
    summary += '\nThe file exceeded one attachment. Join the parts in numeric order to rebuild it.';
  }

  const previewSource = hasLiftCandidate && !environmentProbeOnly
    ? await fs.readFile(candidatePath, 'utf8').catch(() => '')
    : '';
  const previewBlock = previewSource ? buildDeobfPreview(previewSource, config.elapsedMs || 0) : '';
  if (previewBlock) summary = '## ' + String(config.label || 'Script') + ' Deobfuscated!\n\n' + previewBlock + '\n\n' + summary;

  await message.reply({
    embeds: [dailyEmbed(config.label + ' · Analysis result', summary.replace(/\*\*/g, ''), hasLiftedSource ? DAILY_COLORS.success : DAILY_COLORS.warning)],
    files: attachments,
    allowedMentions: { repliedUser: false },
  });

  let pureLuauResult = {
    status: 'skipped',
    reason: environmentProbeOnly
      ? 'Only environment-probe output was produced; no recovered source was available.'
      : 'No Luau source candidate was produced by this engine run.',
  };
  if (hasLiftCandidate && !environmentProbeOnly && candidateBytes > 0) {
    pureLuauResult = await sendAutomaticPureLuau(
      message,
      await fs.readFile(candidatePath, 'utf8'),
      candidateOutputName,
      config.label + ' VM lift'
    );
  }

  for (let index = 0; index < candidateParts.length; index++) {
    const part = candidateParts[index];
    await message.reply({
      content: '📄 Output part ' + (index + 1) + '/' + candidateParts.length +
        ' · ' + part.name + '\nJoin these files in numeric order. No source bytes were discarded.',
      files: [new AttachmentBuilder(part.data, { name: part.name })],
      allowedMentions: { repliedUser: false },
    });
  }

  // Do not send the protected input or intermediate reconstruction artifacts to the user.

  return { hasLiftedSource, hasLiftCandidate, prototypeCount, chunks: chunkFiles.length, validation, pureLuau: pureLuauResult };
}



async function processLuraphV15(message, prompt, input, displayLabel = 'Luraph v15', gameId = null) {
  return processLuraph151(message, prompt, input, gameId, '15');
}

async function processLuraph14x(message, prompt, input, version, options = {}) {
  const startedAt = Date.now();
  const inputBytes = Buffer.byteLength(input.source, 'utf8');
  // Large-file tiers: keep 500 KB+, 2 MB+ and 5 MB+ samples from inheriting
  // the short-sample runtime and VM-spin limits. These remain bounded so a
  // genuinely infinite/tamper loop cannot occupy a worker forever.
  const largeFileTier = inputBytes >= 5 * 1024 * 1024 ? 3
    : inputBytes >= 2 * 1024 * 1024 ? 2
    : inputBytes >= 500 * 1024 ? 1 : 0;
  const largeFileRuntimeSeconds = [180, 240, 360, 480][largeFileTier];
  const largeFileSpinChecks = [8, 32, 64, 128][largeFileTier];
  const versionTag = version.replace('.', '');
  // 14.3 runs through the 14.7 devirtualizer (same VM family); see processLuraph143
  const engineVersion = options.engineVersion || version;
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'daily-deobf-luraph' + versionTag + '-'));
  const inputPath = path.join(tempRoot, 'input.lua');
  const outputPath = path.join(tempRoot, 'Luraph' + versionTag + '_deobfuscated.luau');
  const reportPath = path.join(tempRoot, 'Luraph' + versionTag + '_report.txt');
  const progress = createAnalysisProgress(
    prompt, input.filename, Buffer.byteLength(input.source, 'utf8'), 'Luraph v' + version
  );

  try {
    await fs.writeFile(inputPath, input.source, { encoding: 'utf8', mode: 0o600 });
    await progress.start();
    await progress.setPhase(
      'Loading the dedicated Luraph v' + version + ' engine',
      'Using the separate v' + version + ' VM mapper, runtime harness and devirtualizer.'
    );

    let engineError = null;
    const result = await runPythonEngine(
      ENGINE_V147_DIR,
      ENGINE_V147_CLI,
      inputPath,
      outputPath,
      options.fast
        ? 210_000
        : (Number.isFinite(options.hardTimeoutMs) ? options.hardTimeoutMs : ENGINE_TIMEOUT_MS),
      [
        '--engine', engineVersion,
        '--strings',
        // When the VM lift is incomplete, return the behaviour trace instead of
        // failing, and keep the work files so the other result can be attached.
        '--trace-fallback',
        '--keep-work',
        '--timeout', String(Number.isFinite(options.runtimeTimeoutSeconds) ? options.runtimeTimeoutSeconds : 120),
        // Balanced v14.7 profile: enough trap retries to capture more VM chunks,
        // with a bounded runtime instead of the old 10+ minute worst case.
        '--max-runs', options.fast ? '6' : '16',
        '--devirt-rounds', options.fast ? '120' : '200',
        // Give large protected payloads more trace time without removing the
        // watchdog. 5 MB+ files receive the longest bounded runtime window.
        '--budget', options.fast ? '30' : String([60, 90, 120, 150][largeFileTier]),
        '--timeout', options.fast ? '60' : String(largeFileRuntimeSeconds),
      ],
      {
        env: {
          // The 14.x engines refuse ALL output when even one VM state is unresolved;
          // that turned a 95%-recovered script into nothing. Emit the lift with the
          // few unresolved spots marked as error("devirt: ...") lines instead.
          DEVIRT_ALLOW_PARTIAL: '1',
          // Empty overrides any host-level setting that might force full lifts.
          DEVIRT_FULL_ROUNDS: '',
          // Keep the request-collection fast path enabled. Forcing a full
          // control-flow lift on every constant round repeats the most
          // expensive work and can leave large samples silent for many minutes.
          DEVIRT_TIMING: '1',
          DEVIRT_PROGRESS: '1',
          DEVIRT_ERRS: '1',
          DEVIRT_TB: '1',
          // Keep variable-count copy modelling enabled for fast v14.7 runs:
          // turning it off on every >400 KB input was saving time but losing code.
          // Respect an explicit low-memory setting; other versions retain the
          // previous size-based safeguard.
          ...(options.fast && process.env.DEOB_LOW_MEMORY !== '1'
            ? { DEVIRT_SYMBOLIC_FOR: '1' }
            : (process.env.DEOB_LOW_MEMORY === '1' ||
               (!options.fast && Buffer.byteLength(input.source, 'utf8') > 400_000)
              ? { DEVIRT_SYMBOLIC_FOR: '0' } : {})),
          // The VM can execute long decoder loops without touching the fake
          // environment. Raise the consecutive-idle threshold for large input
          // tiers so legitimate constant decoding is not mistaken for a spin.
          // The watchdog stays enabled and still catches truly endless loops.
          ...(options.env || {}),
          DEOB_SPIN_CHECKS: String(largeFileSpinChecks),
          // The Luau harness heartbeat can pause during expensive VM dispatch
          // or closure discovery. Give larger samples a longer no-heartbeat
          // window before classifying the run as an invisible infinite loop.
          DEOB_TRACE_STALL_SECONDS: String([60, 90, 120, 150][largeFileTier]),
        },
        onProgress: progress.onLine,
        ...(Number.isFinite(options.stallTimeoutMs) ? { stallTimeoutMs: options.stallTimeoutMs } : {}),
      },
    ).catch(async (error) => {
      // Killed (out of memory / time) or crashed: send whatever the engine
      // already saved instead of nothing. The engine writes the behaviour trace
      // before lifting and the lift after every full round (see driver.py).
      const saved = await findSavedEngineOutput(tempRoot);
      if (!saved) throw error;
      engineError = error;
      await fs.copyFile(saved.path, outputPath);
      return { stdout: error.stdout || '', stderr: (error.stderr || '') + '\n[!] engine stopped early: ' + String(error.message || error) + '\n[*] sending its saved ' + saved.kind };
    });

    const stat = await fs.stat(outputPath).catch(() => null);
    if (!stat || !stat.isFile() || !stat.size) {
      throw new Error(
        'Luraph v' + version + ' finished without producing a deobfuscated file.' +
        '\n' + String(result.stderr || result.stdout || '').slice(-1400)
      );
    }
    if (stat.size > MAX_OUTPUT_BYTES) {
      throw new Error('Luraph v' + version + ' output exceeds the 18 MB Discord attachment limit.');
    }

    const outputHead = (await fs.readFile(outputPath, 'utf8').catch(() => '')).slice(0, 400);
    const isTrace = /^\s*--\s*Deobfuscated by deobf \(dynamic trace\)/.test(outputHead);
    // The other result of the run (partial VM lift / behaviour trace), attached
    // as well: one of them often holds source the other does not.
    const extraFiles = [];
    for (const entry of await fs.readdir(tempRoot, { withFileTypes: true }).catch(() => [])) {
      if (!entry.isDirectory() || !entry.name.endsWith('_work')) continue;
      const workDir = path.join(tempRoot, entry.name);
      for (const name of await fs.readdir(workDir).catch(() => [])) {
        let label = null;
        if ((name.endsWith('.devirt.partial.luau') && !engineError) || (isTrace && name.endsWith('.devirt.luau'))) {
          label = 'Luraph' + versionTag + '_partial_vm_lift.luau';
        } else if (!isTrace && name.endsWith('.trace.luau')) {
          label = 'Luraph' + versionTag + '_behaviour_trace.luau';
        }
        if (!label || extraFiles.some((f) => f.name === label)) continue;
        const full = path.join(workDir, name);
        const st = await fs.stat(full).catch(() => null);
        if (st && st.isFile() && st.size > 0 && st.size <= MAX_OUTPUT_BYTES) extraFiles.push({ path: full, name: label });
      }
    }

    await prependDailyDeobfHeader(outputPath);
    const diagnostic = String(result.stderr || result.stdout || '').slice(-10000);
    const report = [
      'DAILY DEOBF · Luraph v' + version,
      'Input: ' + input.filename,
      'Result: ' + (isTrace
        ? 'behaviour trace (the v' + version + ' VM lift was incomplete; what the script did when run in the sandbox)'
        : 'dedicated v' + version + ' VM devirtualization'),
      ...extraFiles.map((f) => 'Also attached: ' + f.name),
      'Output bytes: ' + stat.size,
      '',
      'Engine diagnostics:',
      diagnostic || '(No diagnostic output was emitted.)',
      '',
      'The recovered Luau is a best-effort reconstruction. VM paths or constants that were not captured may remain incomplete.',
    ].join('\n');
    await fs.writeFile(reportPath, report, 'utf8');

    const previewText = buildDeobfPreview(await fs.readFile(outputPath, 'utf8'), Date.now() - startedAt);
    await message.reply({
      content: '## Luraph v' + version + ' Deobfuscated!\n\n' + previewText + '\n\n' +
        (isTrace || engineError ? '⚠️' : '✅') + ' **DAILY DEOBF · Luraph v' + version + '**\n' +
        (engineError
          ? 'The engine stopped before finishing (' + (/SIGKILL|memory/i.test(String(engineError.message)) ? 'the server ran out of memory' : String(engineError.message || engineError).split('\n')[0].slice(0, 160)) +
            '), so this is what it had recovered by then' + (isTrace ? ' (a behaviour trace).' : ' (a partial VM lift).')
          : isTrace
          ? 'The VM lift was incomplete, so the main file is a behaviour trace (what the script did in the sandbox).'
          : 'Dedicated v' + version + ' engine finished.') +
        '\nOutput size: ' + formatBytes(stat.size) + '\nAttached: Luraph' + versionTag + '_deobfuscated.lua' +
        (SEND_ALL_FILES ? extraFiles.map((f) => ', ' + luaFileName(f.name)).join('') + ' and engine report.' : '') +
        engineSummaryLines(result.stderr || result.stdout || ''),
      // One file: the result. DEOB_SEND_ALL=1 (host) adds the other result of
      // the run, the engine report and the PureLuau copy for debugging.
      files: SEND_ALL_FILES
        ? [
          new AttachmentBuilder(outputPath, { name: 'Luraph' + versionTag + '_deobfuscated.luau' }),
          ...extraFiles.map((f) => new AttachmentBuilder(f.path, { name: f.name })),
          new AttachmentBuilder(reportPath, { name: 'Luraph' + versionTag + '_report.txt' }),
        ]
        : [new AttachmentBuilder(outputPath, { name: 'Luraph' + versionTag + '_deobfuscated.luau' })],
      allowedMentions: { repliedUser: false },
    });
    if (SEND_ALL_FILES) {
      await sendAutomaticPureLuau(
        message,
        await fs.readFile(outputPath, 'utf8'),
        'Luraph' + versionTag + '_deobfuscated.luau',
        'Luraph v' + version + ' deobfuscation'
      );
    }
    await progress.complete('The Luraph v' + version + ' reconstruction, engine report and automatic PureLuau pass finished.');
    await prompt.edit({
      content: '✅ Luraph v' + version + ' analysis finished. The reconstructed Luau file is attached above.',
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


// The newest result a killed 14.x engine run left in its work folder.
async function findSavedEngineOutput(tempRoot) {
  for (const entry of await fs.readdir(tempRoot, { withFileTypes: true }).catch(() => [])) {
    if (!entry.isDirectory() || !entry.name.endsWith('_work')) continue;
    const workDir = path.join(tempRoot, entry.name);
    const names = await fs.readdir(workDir).catch(() => []);
    for (const [suffix, kind] of [['.devirt.luau', 'VM lift'], ['.devirt.partial.luau', 'partial VM lift'], ['.trace.luau', 'behaviour trace']]) {
      const name = names.find((n) => n.endsWith(suffix));
      if (!name) continue;
      const full = path.join(workDir, name);
      const st = await fs.stat(full).catch(() => null);
      if (st && st.isFile() && st.size > 0) return { path: full, kind };
    }
  }
  return null;
}

async function processLuraph147(message, prompt, input) {
  return processLuraph14x(message, prompt, input, '14.7');
}

async function processLuraph148(message, prompt, input) {
  return processLuraph14x(message, prompt, input, '14.8');
}

async function processLuraph149(message, prompt, input) {
  const bytes = Buffer.byteLength(input.source, 'utf8');
  // Keep the v14.9 watchdog, but scale its bounded runtime/stall windows for
  // large files just like v14.7 and v14.8. The shared 14.x runner selects the
  // matching spin-check tier from the actual input size.
  return processLuraph14x(message, prompt, input, '14.9', {
    runtimeTimeoutSeconds: bytes >= 5 * 1024 * 1024 ? 480
      : bytes >= 2 * 1024 * 1024 ? 360
      : bytes >= 500 * 1024 ? 240 : 180,
    hardTimeoutMs: bytes >= 5 * 1024 * 1024 ? ENGINE_TIMEOUT_MS
      : bytes >= 2 * 1024 * 1024 ? 900_000
      : bytes >= 500 * 1024 ? 600_000 : 240_000,
    stallTimeoutMs: bytes >= 2 * 1024 * 1024 ? 240_000
      : bytes >= 500 * 1024 ? 180_000 : 120_000,
  });
}

async function processLuraph143(message, prompt, input) {
  // Full devirtualization: the 14.x engine handles the 14.3 VM. 14.3 does not
  // encrypt functions until their first call, so functions that never ran in
  // the sandbox are lifted too (DEVIRT_LIFT_UNRUN).
  return processLuraph14x(message, prompt, input, '14.3', {
    engineVersion: '14.7',
    // 14.3 can spend many minutes inside one VM-lift round. Stop stalled
    // runs early and let processLuraph14x return the last saved trace/lift.
    hardTimeoutMs: 170_000,
    stallTimeoutMs: 120_000,
    env: { DEVIRT_LIFT_UNRUN: '1' },
  });
}

async function processLuraph143Static(message, prompt, input) {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'daily-deobf-luraph143-'));
  const inputPath = path.join(tempRoot, 'input.lua');
  const reportPath = path.join(tempRoot, 'Luraph143_static_report.txt');
  const binaryPath = reportPath + '.decoded.bin';
  const progress = createAnalysisProgress(
    prompt, input.filename, Buffer.byteLength(input.source, 'utf8'), 'Luraph v14.3 static analysis'
  );

  try {
    await fs.writeFile(inputPath, input.source, { encoding: 'utf8', mode: 0o600 });
    await progress.start();
    await progress.setPhase(
      'Decoding the Luraph v14.3 payload',
      'Extracting the embedded payload and preparing a static VM/prototype report.'
    );

    const result = await runCommand(
      process.env.PYTHON_BIN || (process.platform === 'win32' ? 'python' : 'python3'),
      [ENGINE_V143_CLI, inputPath, '-o', reportPath, '--max-report-mb', '12'],
      ENGINE_V143_DIR,
      ENGINE_TIMEOUT_MS,
      { onProgress: progress.onLine },
    );

    const reportStat = await fs.stat(reportPath).catch(() => null);
    if (!reportStat || !reportStat.size || reportStat.size > MAX_OUTPUT_BYTES) {
      throw new Error(
        'Luraph v14.3 did not produce a valid static report.' +
        '\n' + String(result.stderr || result.stdout || '').slice(-1200)
      );
    }
    const files = [
      new AttachmentBuilder(reportPath, { name: 'Luraph143_static_report.txt' }),
    ];
    const binaryStat = await fs.stat(binaryPath).catch(() => null);
    if (binaryStat && binaryStat.size > 0 && binaryStat.size <= MAX_OUTPUT_BYTES) {
      files.push(new AttachmentBuilder(binaryPath, { name: 'Luraph143_decoded_payload.bin' }));
    }

    await message.reply({
      content: '✅ **DAILY DEOBF · Luraph v14.3 (Static)**\nPayload decoding and static analysis finished.\n' +
        (binaryStat && binaryStat.size > 0
          ? 'Decoded payload: ' + formatBytes(binaryStat.size) + '\n'
          : '') +
        'Attached: static report' +
        (files.length > 1 ? ' and decoded binary' : '') +
        '.\n\nThis v14.3 package produces bytecode/prototype analysis, not complete runnable Luau source.',
      files,
      allowedMentions: { repliedUser: false },
    });
    await progress.complete('The v14.3 static report and any decoded payload were attached.');
    await prompt.edit({
      content: '✅ Luraph v14.3 static analysis finished. Check the attached report for parser coverage and limitations.',
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

async function processIronbrew1(message, prompt, input) {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'daily-deobf-ironbrew1-'));
  const inputPath = path.join(tempRoot, 'input.lua');
  const outputDir = path.join(tempRoot, 'output');
  const tracePath = path.join(outputDir, 'ironbrew1.deobf.luau');
  const liftedPath = path.join(outputDir, 'ironbrew1.devirt.luau');
  const stringsPath = path.join(outputDir, 'ironbrew1.strings.txt');
  const python = process.env.PYTHON_BIN || (process.platform === 'win32' ? 'python' : 'python3');
  const progress = createAnalysisProgress(
    prompt, input.filename, Buffer.byteLength(input.source, 'utf8'), 'IronBrew 1'
  );

  try {
    await fs.mkdir(outputDir, { recursive: true });
    await fs.writeFile(inputPath, input.source, { encoding: 'utf8', mode: 0o600 });
    await progress.start();
    await progress.setPhase(
      'Checking the IronBrew signature',
      'Running the bundled detector before starting the VM trace.'
    );

    const detected = await runCommand(
      python,
      [ENGINE_V15_CLI, inputPath, '--detect'],
      ENGINE_V15_DIR,
      60_000
    );
    const detection = String(detected.stdout || '').trim().split(/\r?\n/).pop() || '';
    const detectedName = detection.trim().split(/\s+/)[0] || '';
    if (detectedName !== 'ironbrew1') {
      throw new Error(
        'The IronBrew detector did not recognize this input. Detected: ' +
        (detectedName || 'unknown') + '.'
      );
    }

    await progress.setPhase(
      'Instrumenting and tracing the IronBrew VM',
      'Capturing VM-created functions and runtime constants in the isolated Luau harness.'
    );
    const result = await runCommand(
      python,
      [
        ENGINE_V15_CLI, inputPath, '--obfuscator', 'ironbrew1',
        '--debug', '--strings', ...(process.env.DEOB_USE_PYPY === '1' ? [] : ['--no-pypy']), '--timeout', '120',
        '-o', tracePath,
      ],
      ENGINE_V15_DIR,
      ENGINE_TIMEOUT_MS,
      { onProgress: progress.onLine }
    );

    await progress.setPhase(
      'Lifting captured bytecode',
      'Reconstructing Luau functions from the captured IronBrew prototypes and preparing the trace fallback.'
    );

    async function sizeOf(filePath) {
      try { return (await fs.stat(filePath)).size; } catch { return 0; }
    }
    const liftedBytes = await sizeOf(liftedPath);
    const traceBytes = await sizeOf(tracePath);
    if (!liftedBytes && !traceBytes) {
      const diagnostic = String(result.stderr || result.stdout || '').slice(-1400);
      throw new Error(
        'IronBrew finished without producing a Luau result.' +
        (diagnostic ? '\n' + diagnostic : '')
      );
    }

    const useLift = liftedBytes > 0;
    const selectedPath = useLift ? liftedPath : tracePath;
    const selectedBytes = useLift ? liftedBytes : traceBytes;
    if (selectedBytes > MAX_OUTPUT_BYTES || traceBytes > MAX_OUTPUT_BYTES) {
      throw new Error('IronBrew output exceeds the 18 MB attachment limit.');
    }

    await prependDailyDeobfHeader(selectedPath);
    if (traceBytes > 0 && useLift) await prependDailyDeobfHeader(tracePath);

    const reportPath = path.join(outputDir, 'ironbrew1-report.txt');
    const stats = String(result.stderr || '').match(/(\d+) functions, (\d+) unlifted blocks, (\d+) unstructured jumps/);
    const report = [
      'DAILY DEOBF · IronBrew 1',
      'Input: ' + input.filename,
      'Detection: ironbrew1',
      'Result: ' + (useLift ? 'VM bytecode lift produced a Luau candidate' : 'behaviour trace fallback'),
      stats ? 'Lift statistics: ' + stats[1] + ' functions, ' + stats[2] + ' unlifted blocks, ' + stats[3] + ' unstructured jumps' : '',
      '',
      'Important: reconstructed output may be partial. Local names are inferred, and VM paths that were not captured may be missing.',
    ].filter(Boolean).join('\n');
    await fs.writeFile(reportPath, report, 'utf8');

    const files = [
      new AttachmentBuilder(selectedPath, {
        name: useLift ? 'IronBrew1_devirtualized.luau' : 'IronBrew1_trace.luau',
      }),
      new AttachmentBuilder(reportPath, { name: 'IronBrew1_report.txt' }),
    ];
    if (useLift && traceBytes > 0 && tracePath !== selectedPath) {
      files.push(new AttachmentBuilder(tracePath, { name: 'IronBrew1_trace.luau' }));
    }
    const stringsBytes = await sizeOf(stringsPath);
    if (stringsBytes > 0 && stringsBytes <= 7 * 1024 * 1024) {
      files.push(new AttachmentBuilder(stringsPath, { name: 'IronBrew1_strings.txt' }));
    }

    await message.reply({
      content: '✅ **DAILY DEOBF · IronBrew 1**\nDetected: IronBrew 1' +
        '\nResult: ' + (useLift ? 'VM bytecode lift' : 'behaviour trace fallback') +
        '\nOutput size: ' + formatBytes(selectedBytes) +
        (stats ? '\nLifted functions: ' + stats[1] + ' · Unlifted blocks: ' + stats[2] : '') +
        '\nAttached: ' + (useLift ? 'IronBrew1_devirtualized.luau' : 'IronBrew1_trace.luau') +
        '\n\nReconstruction is not guaranteed to be complete; check the report and trace.',
      files,
      allowedMentions: { repliedUser: false },
    });
    await sendAutomaticPureLuau(
      message,
      await fs.readFile(selectedPath, 'utf8'),
      useLift ? 'IronBrew1_devirtualized.luau' : 'IronBrew1_trace.luau',
      useLift ? 'the IronBrew 1 VM lift' : 'the IronBrew 1 trace fallback'
    );
    await progress.complete('IronBrew analysis and its automatic PureLuau readability pass finished.');
    await prompt.edit({
      content: '✅ IronBrew 1 analysis finished. ' +
        (useLift ? 'The VM lift was attached.' : 'Only the behaviour trace was available.'),
      components: [],
    }).catch(() => {});
  } catch (error) {
    await progress.fail(error);
    throw error;
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true }).catch(() => {});
  }
}


async function processIronbrew2(message, prompt, input) {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'daily-deobf-ironbrew2-'));
  const inputPath = path.join(tempRoot, 'input.lua');
  const bytecodePath = path.join(tempRoot, 'output.luac');
  const dotnet = process.env.DOTNET_BIN || 'dotnet';
  const oracleKey = String(process.env.IRONBREW2_ORACLE_KEY || '').trim();
  const progress = createAnalysisProgress(
    prompt, input.filename, Buffer.byteLength(input.source, 'utf8'), 'IronBrew 2'
  );

  try {
    if (!await fs.stat(ENGINE_IB2_DLL).then(() => true).catch(() => false)) {
      throw new Error('The IronBrew 2 runtime files are missing. Restart the bot so scripts/setup-engines.js can extract upload/ib2-deobf.zip.');
    }

    await fs.writeFile(inputPath, input.source, { encoding: 'utf8', mode: 0o600 });
    await progress.start();
    await progress.setPhase(
      'Checking the .NET 9 runtime',
      'The uploaded IronBrew 2 engine targets .NET 9.'
    );

    const runtimes = await runCommand(dotnet, ['--list-runtimes'], ENGINE_IB2_DIR, 30_000);
    if (!/Microsoft\.NETCore\.App\s+9\./.test(runtimes.stdout || '')) {
      throw new Error('IronBrew 2 requires the Microsoft .NET 9 runtime. Install .NET 9 on the bot host and restart it.');
    }

    await progress.setPhase(
      'Running the IronBrew 2 bytecode decoder',
      'Processing the source in a temporary directory with a fixed execution timeout.'
    );
    await runCommand(
      dotnet,
      [ENGINE_IB2_DLL, inputPath, bytecodePath],
      ENGINE_IB2_DIR,
      ENGINE_TIMEOUT_MS,
      { onProgress: progress.onLine }
    );

    const bytecode = await fs.readFile(bytecodePath).catch(() => null);
    if (!bytecode || !bytecode.length) {
      throw new Error('IronBrew 2 exited without producing a bytecode file.');
    }
    if (bytecode.length > MAX_OUTPUT_BYTES) {
      throw new Error('IronBrew 2 bytecode exceeds the 18 MB attachment limit.');
    }

    const files = [
      new AttachmentBuilder(bytecode, { name: 'IronBrew2_bytecode.luac' }),
    ];
    let resultLabel = 'Bytecode recovered';
    let oracleNote = 'No external service was contacted. Set IRONBREW2_ORACLE_KEY to opt in to the optional Oracle source-decompilation step.';
    let recoveredSourceText = null;

    if (oracleKey) {
      await progress.setPhase(
        'Converting bytecode to readable Lua',
        'Sending the generated bytecode to Oracle because IRONBREW2_ORACLE_KEY is configured.'
      );
      try {
        const url = new URL('https://oracle.mshq.dev/decompile');
        url.searchParams.set('key', oracleKey);
        url.searchParams.set('version', '2');
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            script: bytecode.toString('base64'),
            decompilerOptions: {},
          }),
          signal: AbortSignal.timeout(120_000),
        });
        const responseText = await response.text();
        if (!response.ok) {
          throw new Error('Oracle returned HTTP ' + response.status + ': ' + responseText.slice(0, 500));
        }

        let sourceText = responseText;
        try {
          const parsed = JSON.parse(responseText);
          sourceText = parsed.source || parsed.code || parsed.output || responseText;
        } catch {
          // The uploaded bot's Oracle client expects a plain-text source response.
        }
        if (!String(sourceText || '').trim()) {
          throw new Error('Oracle returned an empty decompilation.');
        }
        recoveredSourceText = String(sourceText);
        const sourceBuffer = Buffer.from(recoveredSourceText, 'utf8');
        if (sourceBuffer.length > MAX_OUTPUT_BYTES) {
          throw new Error('Oracle source output exceeds the 18 MB attachment limit.');
        }
        files.unshift(new AttachmentBuilder(sourceBuffer, { name: 'IronBrew2_deobfuscated.lua' }));
        resultLabel = 'Readable Lua source recovered';
        oracleNote = 'Oracle source conversion completed.';
      } catch (error) {
        const messageText = String(error && error.message || error).replaceAll(oracleKey, '[redacted]').slice(0, 700);
        oracleNote = 'Oracle source conversion failed: ' + messageText + '. The recovered bytecode is attached.';
      }
    }

    const report = [
      'DAILY DEOBF · IronBrew 2',
      'Input: ' + input.filename,
      'Detection: IronBrew 2',
      'Result: ' + resultLabel,
      'Bytecode size: ' + formatBytes(bytecode.length),
      oracleNote,
      '',
      'The recovered bytecode and any source conversion are best-effort outputs; verify behavior before relying on them.',
    ].join('\n');

    files.push(new AttachmentBuilder(Buffer.from(report, 'utf8'), { name: 'IronBrew2_report.txt' }));
    await message.reply({
      content: '✅ **DAILY DEOBF · IronBrew 2**\n' + resultLabel +
        '\nBytecode size: ' + formatBytes(bytecode.length) +
        '\n' + oracleNote,
      files,
      allowedMentions: { repliedUser: false },
    });
    if (recoveredSourceText) {
      await sendAutomaticPureLuau(message, recoveredSourceText, 'IronBrew2_deobfuscated.lua', 'IronBrew 2 source conversion');
    }
    await progress.complete(recoveredSourceText
      ? 'IronBrew 2 source conversion and automatic PureLuau readability pass finished.'
      : 'IronBrew 2 bytecode-only analysis finished; no Luau source was available for PureLuau.');
    await prompt.edit({
      content: '✅ IronBrew 2 analysis finished. ' + resultLabel + '.',
      components: [],
    }).catch(() => {});
  } catch (error) {
    await progress.fail(error);
    throw error;
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true }).catch(() => {});
  }
}

// The bundled 2HBJ parser predates Luau's binary integer literal syntax.
 // Normalize only numeric tokens; leave quoted strings and both Lua comment forms untouched.
function normalize2HBJBinaryLiterals(source) {
  const text = String(source || '');
  let output = '';
  let i = 0;

  function longBracketAt(index) {
    if (text[index] !== '[') return null;
    let cursor = index + 1;
    while (text[cursor] === '=') cursor += 1;
    if (text[cursor] !== '[') return null;
    const equals = text.slice(index + 1, cursor);
    return { end: cursor + 1, close: ']' + equals + ']' };
  }

  function copyLongBracket(index, opener) {
    const closeAt = text.indexOf(opener.close, opener.end);
    const end = closeAt < 0 ? text.length : closeAt + opener.close.length;
    output += text.slice(index, end);
    return end;
  }

  while (i < text.length) {
    const char = text[i];

    if (char === "'" || char === '"') {
      const quote = char;
      const start = i++;
      while (i < text.length) {
        if (text[i] === '\\') {
          i = Math.min(text.length, i + 2);
          continue;
        }
        if (text[i++] === quote) break;
      }
      output += text.slice(start, i);
      continue;
    }

    if (char === '-' && text[i + 1] === '-') {
      const opener = longBracketAt(i + 2);
      if (opener) {
        i = copyLongBracket(i, opener);
      } else {
        const newline = text.indexOf('\n', i + 2);
        const end = newline < 0 ? text.length : newline;
        output += text.slice(i, end);
        i = end;
      }
      continue;
    }

    if (char === '[') {
      const opener = longBracketAt(i);
      if (opener) {
        i = copyLongBracket(i, opener);
        continue;
      }
    }

    const previous = i > 0 ? text[i - 1] : '';
    if (char === '0' && (text[i + 1] === 'b' || text[i + 1] === 'B') &&
        !/[A-Za-z0-9_.]/.test(previous)) {
      let end = i + 2;
      while (/[01_]/.test(text[end] || '')) end += 1;
      const rawDigits = text.slice(i + 2, end);
      const digits = rawDigits.replace(/_/g, '');
      const next = text[end] || '';
      const validSeparators = rawDigits.length > 0 &&
        !rawDigits.endsWith('_') && !rawDigits.includes('__');
      if (/[01]/.test(digits) && validSeparators && !/[A-Za-z0-9_]/.test(next)) {
        const decimal = Number('0b' + digits);
        if (Number.isFinite(decimal)) {
          output += String(decimal);
          i = end;
          continue;
        }
      }
    }

    output += char;
    i += 1;
  }

  return output;
}

async function process2HBJ(message, prompt, input) {
  const startedAt = Date.now();
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'daily-deobf-2hbj-'));
  const inputPath = path.join(tempRoot, 'input.lua');
  const outputDir = path.join(tempRoot, 'output');
  const outputPath = path.join(outputDir, 'out.lua');
  const python = process.env.PYTHON_BIN || (process.platform === 'win32' ? 'python' : 'python3');
  const vendorPython = path.join(__dirname, 'vendor', 'python');
  const pythonPath = [vendorPython, process.env.PYTHONPATH].filter(Boolean).join(path.delimiter);
  const pythonEnv = { PYTHONPATH: pythonPath };
  const progress = createAnalysisProgress(
    prompt, input.filename, Buffer.byteLength(input.source || '', 'utf8'), '2HBJ (Experimental)'
  );

  try {
    if (!String(input.source || '').trim()) throw new Error('The 2HBJ engine needs a Lua/Luau source file.');
    // Do not use the vendor directory's existence as proof that Lupa installed:
    // a failed earlier pip attempt can leave that directory empty.
    const toolsReady = await fs.stat(ENGINE_2HBJ_RUN).then((value) => value.isFile()).catch(() => false);
    const pythonWrapperReady = await Promise.all(['python', 'python3'].map((name) =>
      fs.stat(path.join(ENGINE_2HBJ_TOOLS, name)).then((value) => value.isFile()).catch(() => false)
    )).then((values) => values.every(Boolean));
    let lupaReady = false;
    try {
      await runCommand(
        python, ['-c', 'import lupa.luajit21'],
        ENGINE_2HBJ_DIR, 30_000, { env: pythonEnv }
      );
      lupaReady = true;
    } catch (error) {
      console.warn('[2HBJ setup] LuaJIT import check failed; rerunning setup: ' +
        String(error.message || error).slice(0, 500));
    }

    if (!toolsReady || !pythonWrapperReady || !lupaReady) {
      // Some hosts start index.js directly and skip the npm start setup hook.
      // Prepare the bundled engine whenever either the tools or actual import is missing.
      const setupPath = path.join(__dirname, 'scripts', 'setup-2hbj-engine.py');
      let setup;
      try {
        setup = await runCommand(
          python, [setupPath], __dirname, 180_000, { env: pythonEnv }
        );
      } catch (error) {
        throw new Error('2HBJ automatic setup failed: ' +
          String(error.message || error).slice(0, 2200));
      }
      if (setup.stdout) console.log('[2HBJ setup] ' + String(setup.stdout).trim());
      if (setup.stderr) console.warn('[2HBJ setup] ' + String(setup.stderr).trim());
      if (!await fs.stat(ENGINE_2HBJ_RUN).then((value) => value.isFile()).catch(() => false)) {
        throw new Error('2HBJ setup ran but tools/run.sh is still missing. Setup output: ' +
          String(setup.stderr || setup.stdout || '(no output)').slice(-1800));
      }
    }
    await fs.mkdir(outputDir, { recursive: true });
    const normalizedSource = normalize2HBJBinaryLiterals(input.source);
    await fs.writeFile(inputPath, normalizedSource, { encoding: 'utf8', mode: 0o600 });
    await progress.start();
    await progress.setPhase(
      'Checking the 2HBJ LuaJIT dependency',
      'Verifying the bundled LuaJIT bridge before starting the imported decompiler.'
    );
    try {
      await runCommand(python, ['-c', 'import lupa.luajit21'], ENGINE_2HBJ_DIR, 30_000, { env: pythonEnv });
    } catch (error) {
      throw new Error('2HBJ could not load the project-local Lupa LuaJIT 2.1 package. Check the deployment log for the setup installer output. ' + String(error.message || error).slice(0, 700));
    }

    await progress.setPhase(
      'Running the 2HBJ VM analysis pipeline',
      'Preparing the wrapper, dumping VM prototypes, mapping handlers and rebuilding Lua control flow.'
    );
    let result;
    try {
      result = await runCommand(
        'bash', [ENGINE_2HBJ_RUN, inputPath, outputDir], ENGINE_2HBJ_DIR, ENGINE_TIMEOUT_MS,
        { env: { PYTHON_BIN: 'python3', PATH: [ENGINE_2HBJ_TOOLS, process.env.PATH || ''].filter(Boolean).join(path.delimiter), ...pythonEnv }, onProgress: progress.onLine }
      );
    } catch (engineError) {
      // Preserve the generated code that instr.py failed to instrument.
      const intermediatePath = path.join(outputDir, 'stage2_jit.lua');
      try {
        const intermediateStat = await fs.stat(intermediatePath);
        if (intermediateStat.isFile() && intermediateStat.size > 0 &&
            intermediateStat.size <= MAX_OUTPUT_BYTES) {
          await message.reply({
            content: '⚠️ 2HBJ diagnostic attached\nThe VM wrapper was generated, but this 2HBJ build did not match the bundled instrumentation. This is the generated stage2_jit.lua, not recovered source.',
            files: [new AttachmentBuilder(await fs.readFile(intermediatePath), {
              name: '2hbj-stage2_jit.lua',
            })],
            allowedMentions: { repliedUser: false },
          });
        } else {
          console.warn('[2HBJ diagnostic] stage2_jit.lua is empty or exceeds the attachment limit.');
        }
      } catch (diagnosticError) {
        console.warn('[2HBJ diagnostic] Could not attach stage2_jit.lua: ' +
          String(diagnosticError.message || diagnosticError).slice(0, 500));
      }
      throw engineError;
    }
    const stat = await fs.stat(outputPath).catch(() => null);
    if (!stat || !stat.isFile() || !stat.size) {
      throw new Error('2HBJ finished without producing out.lua. ' + String(result.stderr || result.stdout || '').slice(-1400));
    }
    if (stat.size > MAX_OUTPUT_BYTES) throw new Error('2HBJ output exceeds the 18 MB attachment limit.');
    await prependDailyDeobfHeader(outputPath);

    const reportPath = path.join(outputDir, '2hbj-report.txt');
    const report = [
      'DAILY DEOBF · 2HBJ (experimental)',
      'Input: ' + input.filename,
      'Result: imported 2HBJ VM decompilation pipeline',
      'Output bytes: ' + stat.size,
      '',
      'The included tool bundle says the protected script itself is not executed by its dump stage; it inspects the VM loader and reconstructs source from dumped prototypes.',
      'Important limitation: the supplied bundle is tuned to its included 2HBJ sample. Its instructions say stage2.js string/alphabet mappings, instr.py instrumentation patterns and the disasm.py opcode table may need manual changes for other builds. Treat this output as experimental, not guaranteed complete source.',
      'The 2HBJ input is normalized for binary integer literals before parsing because the bundled parser does not recognize Luau 0b/0B numeric syntax.',
      'The included README notes that anti-tamper code may remain above the recovered script in out.lua.',
      '',
      'Engine diagnostics:',
      String(result.stdout || result.stderr || '').slice(-7000) || '(No diagnostics emitted.)',
    ].join('\n');
    await fs.writeFile(reportPath, report, 'utf8');

    const files = [
      new AttachmentBuilder(outputPath, { name: '2HBJ_deobfuscated.luau' }),
      new AttachmentBuilder(reportPath, { name: '2HBJ_report.txt' }),
    ];
    for (const [filename, attachmentName] of [
      ['stage2.lua', '2HBJ_vm_wrapper.lua'],
      ['disasm.txt', '2HBJ_vm_disassembly.txt'],
      ['handlers_used.txt', '2HBJ_handlers_used.txt'],
    ]) {
      const filePath = path.join(outputDir, filename);
      const size = await fs.stat(filePath).then((value) => value.size).catch(() => 0);
      if (size > 0 && size <= 7 * 1024 * 1024) files.push(new AttachmentBuilder(filePath, { name: attachmentName }));
    }

    const previewText = buildDeobfPreview(await fs.readFile(outputPath, 'utf8'), Date.now() - startedAt);
    await message.reply({
      content: '## 2HBJ Deobfuscated!\n\n' + previewText + '\n\n' +
        '✅ **DAILY DEOBF · 2HBJ (Experimental)**\nThe imported 2HBJ pipeline finished.\nOutput size: ' + formatBytes(stat.size) + '\nAttached: reconstructed Luau, VM wrapper, disassembly and limitations report.\n\nThis tool bundle is sample-tuned; other 2HBJ builds may need manual mapping updates.',
      files,
      allowedMentions: { repliedUser: false },
    });
    await progress.complete('The 2HBJ reconstruction and supporting analysis files were attached.');
    await prompt.edit({
      content: '✅ 2HBJ analysis finished. Review the report for the sample-specific limitations.',
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

    const isCenturionV6Static = ['v6-static', 'v6-static-return-table'].includes(fingerprint.route);

    if (fingerprint.route === 'v6.1-sandbox') {
      throw new Error(
        'This is a Centurion v6.1 build, but this bot currently contains only the v6 static adapter. ' +
        'The original v6.1 path expects sandbox-copy-luraph/harness.py, and its runtime code is not wired into this adapter. ' +
        'Adding placeholder files will not enable v6.1.'
      );
    } else if (!isCenturionV6Static) {
      const details = [
        'tag=' + String(fingerprint.tag || 'unknown'),
        'c3_refs=' + String(fingerprint.c3_refs ?? 0),
        'factory_functions=' + String(fingerprint.func_z ?? 0),
        'inline_functions=' + String(fingerprint.inline_functions ?? 0),
        'returned_table=' + String(Boolean(fingerprint.returned_table)),
        'HA_refs=' + String(fingerprint.ha_refs ?? 0),
        'getfenv=' + String(fingerprint.getfenv ?? 0),
        String(fingerprint.route_reason || ''),
      ].filter(Boolean).join('; ');
      throw new Error(
        'Centurion fingerprint did not match a supported route. ' +
        'Detected route: ' + String(fingerprint.route || 'unknown') +
        '. Diagnostics: ' + details + '.'
      );
    }

    await progress.setPhase(
      'Extracting Centurion v6 payload functions',
      'The static route extracts function bodies from the detected v6 layout and decodes string escapes. This is a stage-one result, not a complete runnable reconstruction.'
    );

    const result = await runCommand(
      python,
      [ENGINE_CENT_CLI, 'deobfuscate', inputPath, '--out-dir', outputDir],
      ENGINE_CENT_DIR,
      ENGINE_TIMEOUT_MS,
      { env: centEnv, onProgress: progress.onLine }
    );

    const entries = await fs.readdir(outputDir);
    const preferred = isCenturionV6Static
      ? entries.find((name) => name.endsWith('_deobf_stage1.lua'))
      : (entries.find((name) => name.endsWith('_deobf_clean.lua')) ||
         entries.find((name) => name.endsWith('_maximal.lua')) ||
         entries.find((name) => name.endsWith('_deobf_stage1.lua')));
    if (!preferred) {
      const diagnostic = String(result.stdout || result.stderr || '').slice(-1200);
      throw new Error(
        'Centurion finished without producing a recovered Luau file.' +
        (diagnostic ? '\n' + diagnostic : '')
      );
    }

    const outputPath = path.join(outputDir, preferred);
    const stat = await fs.stat(outputPath);
    if (!stat.size || stat.size > MAX_OUTPUT_BYTES) {
      throw new Error('Centurion output is empty or exceeds the 18 MB output limit.');
    }
    await prependDailyDeobfHeader(outputPath);
    const outputName = isCenturionV6Static
      ? 'Centurion_v6_stage1.luau'
      : 'Centurion_v6_1_result.luau';
    const factoryMatch = String(result.stdout || '').match(/"factories"\s*:\s*(\d+)/);
    const detail = isCenturionV6Static
      ? '\nExtracted payload functions: ' + (factoryMatch ? factoryMatch[1] : 'see file') +
        '\n⚠️ Stage-one static extraction only. It is not represented as complete runnable source.'
      : '\nCenturion v6.1 offline analysis produced a Luau candidate. Review it before treating it as complete.';

    await message.reply({
      content: '✅ **DAILY DEOBF · Centurion**\nDetected: ' + fingerprint.tag +
        '\nRoute: ' + fingerprint.route + detail +
        '\nAttached: ' + outputName,
      files: [new AttachmentBuilder(outputPath, { name: outputName })],
      allowedMentions: { repliedUser: false },
    });
    await sendAutomaticPureLuau(
      message,
      await fs.readFile(outputPath, 'utf8'),
      outputName,
      'Centurion source extraction'
    );
    await progress.complete('The Centurion Luau output and automatic PureLuau readability pass were attached.');
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

async function processLuraph151(message, prompt, input, gameId = null, version = '15.1') {
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

  // Luraph v15 uses its own Python engine. Keep v15.1 on its separate
  // Node/Python merged engine so the two version paths cannot cross.
  function runLuraphV15Engine(target) {
    const python = process.env.PYTHON_BIN || (process.platform === 'win32' ? 'python' : 'python3');
    return runCommand(
      python,
      [
        ENGINE_V15_CLI,
        target.inputPath,
        '-o', target.outputPath,
        '--obfuscator', 'luraph_v15',
        '--debug',
        '--strings',
        '--max-runs', '12',
        '--devirt-rounds', '200',
        '--budget', '45',
        '--timeout', '120',
      ],
      ENGINE_V15_DIR,
      12 * 60_000,
      {
        stallTimeoutMs: 180_000,
        onProgress: progress.onLine,
      },
    );
  }

  // The dedicated v15.1 engine run remains unchanged.
  function runLuraph151Engine(target) {
    return runEngine(
      ENGINE_151_DIR,
      ENGINE_151_CLI,
      target.inputPath,
      target.outputPath,
      // Discord-pack profile: allow the full v15.1 lift several minutes,
      // while keeping one Python candidate to avoid multiplying peak RAM.
      12 * 60_000,
      false,
      [
        '--plugin', 'luraph_v15',
        '--debug',
        '--strings',
        '--max-runs', '12',
        '--devirt-rounds', '200',
        '--budget', '45',
        '--timeout', '120',
        ...(gameId ? ['--cfg-json', JSON.stringify({ __superz_game_id: Number(gameId) })] : []),
      ],
      {
        stallTimeoutMs: 180_000,
        env: {
          // The ZIP's Discord runner uses one candidate by default. Keep that
          // memory-safe behavior, but give a candidate time to finish a real lift.
          DEOB_FAST: '1',
          DEOB_PY_CANDIDATES: 'python:1',
          DEOB_CANDIDATE_TIMEOUT_MS: '300000',
          DEOB_CANDIDATE_IDLE_TIMEOUT_MS: '180000',
          // (no DEVIRT_LOADERS: it lifts Luraph's own loader VMs too, which
          // buried the script in thousands of lines of runtime code)
          DEVIRT_FULL_ROUNDS: '', // fast rounds: walk only, one full lift at the end (same result, ~2x faster)
          DEVIRT_TIMING: '1',
          DEVIRT_ERRS: '1',
          DEVIRT_TB: '1',
          DEVIRT_WALK_LIMIT: '750000',
          DEVIRT_MERGE: '1',
          DEVIRT_MERGE_BUDGET: '32',
          DEVIRT_BISECT: '1',
          DEVIRT_BISECT_BUDGET: '16',
        },
        onProgress: progress.onLine,
      },
    );
  }

  const dedicated = await prepare('selected-v' + version);
  // Each selection uses its matching engine directory.
  const selectedEngineDir = version === '15' ? ENGINE_V15_DIR : ENGINE_151_DIR;
  const inputBytes = Buffer.byteLength(input.source, 'utf8');
  const progress = createAnalysisProgress(
    prompt, input.filename, inputBytes, 'Luraph v' + version,
    version === '15' ? {
      displayLabel: 'Luraph v15',
      loadingEmoji: '<a:emoji_4:1571169316345479350>',
      activeHeading: '## <a:emoji_4:1571169316345479350> Processing Luraph v15',
    } : {},
  );
  const startedAt = Date.now();
  let dedicatedLogs = '';
  let dedicatedError = null;
  let chosen = dedicated;
  let chosenEngineDir = selectedEngineDir;
  let dedicatedValidation = null;

  try {
    if (normalized.removedBytes > 0) {
      await progress.setPhase(
        'Removed malformed duplicate tail',
        'Removed ' + normalized.removedBytes + ' trailing bytes that repeated the final Qg() call and began mid-token.'
      );
    }

    await progress.setPhase(
      'Running the dedicated Luraph v' + version + ' engine',
      'The Luraph v' + version + ' engine gets the first full reconstruction pass. Its output is checked for unresolved VM values and Luau syntax.'
    );

    try {
      // Route v15 to the uploaded standalone Python engine, and v15.1
      // exclusively to its existing dedicated engine.
      const result = version === '15'
        ? await runLuraphV15Engine(dedicated)
        : await runLuraph151Engine(dedicated);
      dedicatedLogs += result.stderr || '';
    } catch (error) {
      dedicatedError = error;
      dedicatedLogs += '\n[!] selected Luraph v' + version + ' engine: ' + String(error.message || error) + '\n';
    }

    await progress.setPhase(
      'Checking the selected Luraph v' + version + ' candidate',
      'The selected engine returned. Inspecting its output for unresolved VM values, placeholder functions and Luau syntax.'
    );

    await cleanLuraph151Candidate(dedicated.base + '.devirt.luau', selectedEngineDir);

    dedicatedValidation = await inspectLiftFile(
      dedicated.base + '.devirt.luau',
      selectedEngineDir
    );

    // v15 and v15.1 both use the merged engine directly. Do not rerun it
    // as a fallback or replace its output with the legacy v15 lifter.

    await progress.setPhase(
      dedicatedValidation.complete ? 'Selected candidate passed validation' : 'Selected candidate has unresolved output',
      dedicatedValidation.complete
        ? 'Structural checks and Luau AST validation passed.'
        : 'Validation found: ' + (dedicatedValidation.issues || []).slice(0, 3).join('; ')
    );

    if (!(await hasArtifacts(chosen.base))) {
        throw new Error(
        String(dedicatedError && dedicatedError.message || '') ||
        'The selected Luraph v' + version + ' engine produced no diagnostic artifacts.'
      );
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
      'Validating and packaging the selected candidate',
      'Checking structural errors, placeholder functions, unresolved nil values and Luau AST validity for the selected engine output.'
    );

    const summary = await sendAnalysisOutput(message, input, {
      label: 'Luraph v' + version + ' · selected engine',
      engineName: 'Selected Luraph v' + version + ' engine',
      engineDir: chosenEngineDir,
      base: chosen.base,
      outputDir: chosen.outputDir,
      elapsedMs: Date.now() - startedAt,
      stderr: dedicatedLogs,
      otherEngineStderr: '',
      maxRuns: 12,
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
        version === '15'
          ? 'The standalone luraph-v15-engine Python engine was used. The v15.1 engine was not invoked.'
          : 'The dedicated luraph-v15.1-engine was used.',
        'The checklist is an instruction for a separate reconstruction pass, not proof that every item was automatically completed.',
        ...(version === '15'
          ? ['The standalone v15 engine used its bundled offline environment; the supplied GameId is not passed to this engine.']
          : (gameId ? ['Target Universe/GameId supplied to the sandbox: ' + gameId + '.'] : ['No target Universe/GameId was supplied; game-locked builds may stop in their bootstrap layer.'])),
        ...((/buffer access out of bounds|size out of range/i).test(dedicatedLogs)
          ? ['Runtime stopped during bootstrap with a buffer bounds/size error. This is not a recovered source result.', 'For a game-locked script, retry with its correct public Roblox Universe/GameId. A FlowAuth key-gated loader that requires a live authorization handshake will only expose its offline loader behaviour; the bot does not emulate or bypass that handshake.']
          : []),
      ],
    });

    await progress.complete(summary.hasLiftedSource
      ? 'A Luau candidate passed structural checks and syntax validation.'
      : (summary.hasLiftCandidate
        ? 'The selected Luraph v' + version + ' engine produced a partial candidate; no alternate engine was started.'
        : 'The selected engine did not complete the VM lift. Trace and diagnostic artifacts are attached.'));

    const bootstrapBoundsError = /buffer access out of bounds|size out of range/i.test(dedicatedLogs);
    await prompt.edit({
      content: summary.hasLiftedSource
        ? '✅ Luraph v' + version + ' finished. The best Luau candidate passed validation.'
        : (summary.hasLiftCandidate
          ? '⚠️ Luraph v' + version + ' finished with a partial VM lift. It is not marked as recovered source.'
          : (bootstrapBoundsError
            ? '⚠️ The sandbox stopped before VM capture (buffer bounds/size error). This is not deobfuscated source. For game-locked scripts, retry with the correct Universe/GameId; a live FlowAuth auth handshake cannot be reconstructed offline.'
            : '⚠️ Luraph v' + version + ' finished without a full VM lift. Check the trace and analysis report.')),
      components: [],
    });
  } catch (error) {
    error.stdout = dedicatedLogs;
    error.stderr = dedicatedLogs;
    if (input && input.source) {
      const originalData = Buffer.from(input.source, 'utf8');
      if (originalData.length > 0 && originalData.length <= MAX_OUTPUT_BYTES) {
        error.originalInput = {
          name: path.basename(String(input.filename || 'original-obfuscated.lua')).replace(/[^A-Za-z0-9._-]/g, '_'),
          data: originalData,
        };
      }
    }
    await capturePartialArtifact(error, [chosen.base + '.devirt.luau', chosen.base + '.trace.luau', chosen.base + '.luau', dedicated.base + '.devirt.luau']);
    await progress.fail(error);
    throw error;
  } finally {
    progress.stop();
    await fs.rm(tempRoot, { recursive: true, force: true }).catch(() => {});
  }
}




async function collectLuraphGameId(message, prompt, label = 'Luraph') {
  await prompt.edit({
    content: '🎮 **' + label + ' · target game**\nSend the Roblox **Universe/GameId** for the game this script belongs to, or type **skip** if it is not game-locked.\n\nUse the universe ID, not the place ID. The ID is only used as sandbox context.',
    components: [],
  });

  const collector = message.channel.createMessageCollector({
    filter: (reply) => reply.author.id === message.author.id && reply.channelId === message.channelId,
    time: PICKER_WAIT_MS,
    max: 1,
  });

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      collector.stop('timeout');
      reject(new Error('GameId prompt timed out. Run .deobf and choose ' + label + ' again.'));
    }, PICKER_WAIT_MS + 1000);

    collector.once('collect', (reply) => {
      clearTimeout(timeout);
      collector.stop('received');
      const value = String(reply.content || '').trim();
      if (/^(?:skip|none|n)$/i.test(value)) {
        resolve(null);
        return;
      }
      if (!/^\d{1,16}$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) <= 0) {
        reject(new Error('That is not a valid Universe/GameId. Send a positive numeric universe ID, or type skip.'));
        return;
      }
      resolve(value);
    });

    collector.once('end', (_collected, reason) => {
      if (reason === 'time' && collector.collected.size === 0) {
        clearTimeout(timeout);
        reject(new Error('GameId prompt timed out. Run .deobf and choose ' + label + ' again.'));
      }
    });
  });
}

async function processFlowAuth(message, prompt, input) {
  const detected = detectFlowAuthLuraphVersion(input.source);
  if (detected.unsupported) {
    await prompt.edit({
      content: 'FlowAuth detected Luraph v' + detected.version + ', but this bot now supports only Luraph v15 and v15.1.',
      components: [],
    });
    return;
  }
  const displayVersion = 'Luraph v' + detected.version;
  const versionNote = detected.explicit
    ? 'Version identified by ' + detected.detectedBy + '.'
    : 'No Luraph version marker was found. Trying the current v15.1 engine.';

  await prompt.edit({
    content: '🧬 **FlowAuth selected**\n' + versionNote +
      '\nUsing the matching Luraph analysis engine: **' + displayVersion + '**.',
    components: [],
  });

  const gameId = await collectLuraphGameId(message, prompt, 'FlowAuth');
  if (detected.version === '15') {
    return processLuraphV15(message, prompt, input, 'FlowAuth · Luraph v15', gameId);
  }
  return processLuraph151(message, prompt, input, gameId);
}

async function collectGetInput(message, prompt) {
  const collector = message.channel.createMessageCollector({
    filter: (reply) => reply.author.id === message.author.id && reply.channelId === message.channelId,
    time: INPUT_WAIT_MS,
    max: 1,
  });

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      collector.stop('timeout');
      reject(new Error('Input timed out. Run .get again.'));
    }, INPUT_WAIT_MS + 1000);

    collector.on('collect', async (reply) => {
      clearTimeout(timer);
      collector.stop('received');
      try {
        if (reply.content.trim().toLowerCase() === '.cancel') {
          throw new Error('Cancelled.');
        }

        const attachment = reply.attachments.first();
        if (attachment) {
          resolve(await inputFromAttachment(attachment));
          return;
        }

        const value = reply.content.trim();
        const direct = value.match(/https?:\/\/[^\s"'<>]+/i);
        if (direct) {
          const rawUrl = direct[0].replace(/[)\]},.;]+$/g, '');
          const parsed = new URL(rawUrl);
          const curlOptions = parseCurlStyleOptions(value);
          if ((curlOptions.method && curlOptions.method !== 'GET') || curlOptions.body) {
            throw new Error('.get downloads source files with GET only. Use -G with -d/--data to add query parameters; it will not replay POST or other state-changing requests from a script.');
          }
          if (curlOptions.queryData) {
            for (const [key, item] of new URLSearchParams(curlOptions.queryData)) parsed.searchParams.append(key, item);
          }
          resolve({
            source: '',
            filename: path.basename(parsed.pathname) || 'remote-url.lua',
            url: parsed.toString(),
            originalText: value,
            curlOptions,
          });
          return;
        }

        if (!value) throw new Error('Send a script, a direct URL, or an attachment.');
        resolve({ source: value, filename: 'get-input.lua' });
      } catch (error) {
        reject(error);
      }
    });

    collector.on('end', (_collected, reason) => {
      clearTimeout(timer);
      if (reason === 'time' && collector.collected.size === 0) {
        reject(new Error('Input timed out. Run .get again.'));
      }
    });

    prompt.edit({
      content: 'Send a Lua/Luau/TXT file, paste a direct HTTP/HTTPS URL, or paste source text. Type .cancel to stop.',
    }).catch(() => {});
  });
}


function extractHttpSpyEntries(source, filename = 'input.lua') {
  const text = String(source || '');
  const patterns = [
    [/\b(?:game\s*[:.]\s*)?HttpGetAsync\s*\(/gi, 'GET'],
    [/\b(?:game\s*[:.]\s*)?HttpGet\s*\(/gi, 'GET'],
    [/\b(?:HttpService\s*[:.]\s*)?GetAsync\s*\(/gi, 'GET'],
    [/\b(?:HttpService\s*[:.]\s*)?PostAsync\s*\(/gi, 'POST'],
    [/\b(?:HttpService\s*[:.]\s*)?RequestAsync\s*\(/gi, 'REQUEST'],
    [/\b(?:syn\s*\.\s*request|http_request|http\s*\.\s*request|request)\s*\(/gi, 'REQUEST'],
    [/\b(?:fetch|http_fetch)\s*\(/gi, 'FETCH'],
  ];
  const entries = [];
  const seen = new Set();
  for (const [re, method] of patterns) {
    re.lastIndex = 0;
    let match;
    while ((match = re.exec(text))) {
      const start = match.index;
      const callText = text.slice(start, Math.min(text.length, start + 1200)).split(/[\n;]/, 1)[0];
      const literal = callText.match(/["'](https?:\/\/[^"'\s]+)["']/i);
      const url = literal ? literal[1] : '<dynamic URL>';
      const line = text.slice(0, start).split('\n').length;
      const key = [filename, line, method, url].join('|');
      if (!seen.has(key)) { seen.add(key); entries.push({ filename, line, method, url }); }
    }
  }
  return entries;
}

function redactSpyUrl(raw) {
  try {
    const url = new URL(raw);
    url.username = ''; url.password = ''; url.hash = '';
    url.search = url.search ? '?[query redacted]' : '';
    return url.toString();
  } catch { return String(raw || '<dynamic URL>').slice(0, 500); }
}


async function fetchLuaProtectLoaderSource(rawUrl) {
  const loaderUrl = new URL(rawUrl);
  const host = loaderUrl.hostname.toLowerCase();
  const isRunnerBody = loaderUrl.protocol === 'https:' &&
    host === 'exec.luaprotect.dev' &&
    /^\/api\/runner-body\/[A-Za-z0-9_-]+\/?$/i.test(loaderUrl.pathname);
  // LuaProtect also publishes user runner links on its CDN in the form
  // /u/{public-id}/{runner-token}. Treat this as a separate public URL
  // format; do not rewrite it into an exec runner-body endpoint.
  const isCdnRunner = loaderUrl.protocol === 'https:' &&
    host === 'cdn.luaprotect.dev' &&
    /^\/u\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+\/?$/i.test(loaderUrl.pathname);
  if (!isRunnerBody && !isCdnRunner) return null;

  const fetched = await fetchPublicText(loaderUrl.toString(), {
    headers: {
      'user-agent': 'Roblox/WinInet',
      accept: 'text/plain, application/octet-stream, application/json, */*',
    },
    maxTime: 25,
  });
  if (fetched.status < 200 || fetched.status >= 300) {
    if (fetched.status === 401 || fetched.status === 403) {
      throw new Error('LuaProtect denied the source request (HTTP ' + fetched.status + '). The link may require authorization or may no longer be valid.');
    }
    throw new Error('LuaProtect returned HTTP ' + fetched.status + '.');
  }
  const body = decodeSource(fetched.bytes).replace(/\r\n/g, '\n');
  if (!body.trim()) throw new Error('LuaProtect returned an empty source response.');
  if (/^(<!doctype html|<html|\s*<\?xml)/i.test(body)) {
    throw new Error('LuaProtect returned a webpage instead of Lua source.');
  }
  return body;
}

async function fetchVantarmorLoaderSource(rawUrl, credentialText = '') {
  const loaderUrl = new URL(rawUrl);
  const isVantarmor = loaderUrl.protocol === 'https:' &&
    loaderUrl.hostname.toLowerCase() === 'vantarmor.up.railway.app' &&
    /^\/files\/v1\/loaders\/[^/]+\.lua$/i.test(loaderUrl.pathname);
  if (!isVantarmor) return null;

  const keyMatch = String(credentialText || '').match(/(?:getgenv\(\)\.script_key|script_key)\s*=\s*["']([^"']+)["']/i);
  const hash = loaderUrl.pathname.match(/^\/files\/v1\/loaders\/(.+)\.lua$/i)[1];
  const params = new URLSearchParams({ s: hash });
  if (keyMatch && keyMatch[1].trim()) params.set('key', keyMatch[1].trim());
  const hwidMatch = String(credentialText || '').match(/\bhwid\s*=\s*["']([^"']+)["']/i);
  const rbxidMatch = String(credentialText || '').match(/\brbxid\s*=\s*["']([^"']+)["']/i);
  if (hwidMatch) params.set('hwid', hwidMatch[1]);
  if (rbxidMatch) params.set('rbxid', rbxidMatch[1]);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 40000);
  try {
    const headers = { 'User-Agent': 'Roblox/WinInet', Accept: '*/*' };
    const first = await fetch(loaderUrl.origin + '/v1/a?' + params.toString(), {
      headers, signal: controller.signal, redirect: 'error',
    });
    let body = (await first.text()).replace(/\r\n/g, '\n');
    if (!first.ok) {
      if (!keyMatch && (first.status === 401 || first.status === 403)) {
        throw new Error('Vantarmor denied a keyless request. This loader requires a script_key unless its owner enables public access.');
      }
      throw new Error('Vantarmor returned HTTP ' + first.status + '.');
    }
    let errorLine = body.trim().match(/^!VANTARMOR:([A-Z0-9_]+)$/);
    if (errorLine) {
      if (!keyMatch && /KEY|AUTH|TOKEN/.test(errorLine[1])) {
        throw new Error('Vantarmor requires a script_key for this loader. Keyless fetching works only when the owner has enabled public access.');
      }
      throw new Error('Vantarmor rejected the request: ' + errorLine[1] + '.');
    }

    if (body.startsWith('!VANTARMOR:TOKEN\n')) {
      const token = body.slice('!VANTARMOR:TOKEN\n'.length).trim();
      const second = await fetch(loaderUrl.origin + '/v1/p', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'text/plain' },
        body: token,
        signal: controller.signal,
        redirect: 'error',
      });
      body = (await second.text()).replace(/\r\n/g, '\n');
      if (!second.ok) throw new Error('Vantarmor payload request returned HTTP ' + second.status + '.');
    }

    errorLine = body.trim().match(/^!VANTARMOR:([A-Z0-9_]+)$/);
    if (errorLine) {
      if (!keyMatch && /KEY|AUTH|TOKEN/.test(errorLine[1])) {
        throw new Error('Vantarmor requires a script_key for this loader. Keyless fetching works only when the owner has enabled public access.');
      }
      throw new Error('Vantarmor rejected the payload: ' + errorLine[1] + '.');
    }
    if (!body.startsWith('!VANTARMOR:CODE\n')) {
      throw new Error('Unexpected Vantarmor response. Expected a CODE or TOKEN response.');
    }
    const source = body.slice('!VANTARMOR:CODE\n'.length).replace(/\r\n/g, '\n');
    if (!source.trim()) throw new Error('Vantarmor returned an empty source file.');
    return source;
  } finally {
    clearTimeout(timeout);
  }
}


function extractJnkIeDownloadUrl(sourceText) {
  const match = String(sourceText || '').match(
    /https:\/\/api\.jnkie\.com\/api\/v1\/luascripts\/public\/([a-f0-9]{32,128})\/download(?:\?[^\s"'<>]*)?/i
  );
  return match ? match[0].replace(/[)\]},.;]+$/g, '') : null;
}

async function fetchJnkIeLoaderSource(rawUrl, credentialText = '', existingStage1 = '', suppliedHwid = '') {
  const loaderUrl = new URL(rawUrl);
  const match = loaderUrl.pathname.match(
    /^\/api\/v1\/luascripts\/public\/([a-f0-9]{32,128})\/download\/?$/i
  );
  if (loaderUrl.protocol !== 'https:' ||
      loaderUrl.hostname.toLowerCase() !== 'api.jnkie.com' ||
      !match) return null;

  const hash = match[1].toLowerCase();
  let stage1 = String(existingStage1 || '').replace(/\r\n/g, '\n');
  if (!stage1.trim()) {
    const first = await fetchPublicText(loaderUrl.toString(), {
      headers: { 'user-agent': 'Roblox/WinInet', accept: '*/*' },
      maxTime: 25,
    });
    stage1 = decodeSource(first.bytes).replace(/\r\n/g, '\n');
  }
  if (!stage1.trim()) throw new Error('JNKIE returned an empty stage-one loader.');
  if (/^\s*(?:<!doctype html|<html\b)/i.test(stage1)) {
    throw new Error('JNKIE returned an HTML page instead of its stage-one loader.');
  }

  const keyMatch = String(credentialText || '').match(
    /(?:getgenv\(\)\s*\.\s*)?SCRIPT_KEY\s*=\s*["']([^"']+)["']/i
  );
  if (!keyMatch || !keyMatch[1].trim()) {
    return {
      source: stage1,
      complete: false,
      reason: 'Missing SCRIPT_KEY. Returned the stage-one loader only.',
      finalUrl: loaderUrl.toString(),
    };
  }

  // The toolkit treats HWID as optional input. It does not fabricate one or
  // stop before delivery when none is supplied.
  const hwid = String(suppliedHwid || process.env.JNKIE_HWID || '').trim();
  const deliveryUrl = new URL('/api/v1/luascripts/delivery/' + hash, loaderUrl.origin);
  deliveryUrl.searchParams.set('v', '2');
  deliveryUrl.searchParams.set('errors', 'text');
  if (hwid) deliveryUrl.searchParams.set('hwid', hwid);

  const addresses = await assertPublicUrl(deliveryUrl);
  let response = null;
  const connectionErrors = [];
  const headers = {
    'user-agent': 'Roblox/WinInet',
    accept: '*/*',
    'content-type': 'text/plain',
    ...(hwid ? { 'x-hwid': hwid } : {}),
  };
  for (const address of addresses) {
    try {
      response = await requestPinnedAddress(deliveryUrl, address, {
        method: 'POST',
        headers,
        body: keyMatch[1].trim(),
        maxTime: 25,
      });
      break;
    } catch (error) {
      connectionErrors.push(String(error && (error.message || error) || 'connection failed'));
    }
  }
  if (!response) {
    throw new Error('JNKIE delivery connection failed: ' + connectionErrors.join(' | ').slice(0, 600));
  }

  const location = response.headers.get('location');
  const responseBytes = await readResponse(response, MAX_INPUT_BYTES);
  const responseText = responseBytes.toString('utf8').replace(/\r\n/g, '\n').trim();

  if (/^LDR-DENIED:/i.test(responseText)) {
    return {
      source: stage1,
      complete: false,
      reason: responseText.slice(0, 400),
      deliveryError: responseText.slice(0, 400),
      finalUrl: loaderUrl.toString(),
    };
  }

  if ([400, 401, 403].includes(response.status)) {
    return {
      source: stage1,
      complete: false,
      reason: 'JNKIE delivery HTTP ' + response.status + (responseText ? ': ' + responseText.slice(0, 300) : ''),
      deliveryError: responseText || ('HTTP ' + response.status),
      finalUrl: loaderUrl.toString(),
    };
  }

  let payloadBytes = responseBytes;
  let payloadUrl = deliveryUrl.toString();
  const redirectStatus = [301, 302, 303, 307, 308].includes(response.status);
  const cdnUrlText = responseText.match(/^https:\/\/cdn\.jnkie\.com\/[^\s"'<>]+$/i);
  if (redirectStatus || cdnUrlText) {
    const targetText = location || (cdnUrlText && cdnUrlText[0]);
    if (!targetText) {
      return {
        source: stage1,
        complete: false,
        reason: 'JNKIE delivery redirected without a Location URL. Returned stage-one loader only.',
        finalUrl: loaderUrl.toString(),
      };
    }
    let target;
    try { target = new URL(targetText, deliveryUrl); }
    catch { throw new Error('JNKIE returned an invalid CDN URL.'); }
    if (target.protocol !== 'https:' || target.hostname.toLowerCase() !== 'cdn.jnkie.com' ||
        target.username || target.password) {
      throw new Error('JNKIE delivery returned a CDN URL outside the approved cdn.jnkie.com host.');
    }
    const downloaded = await fetchPublicText(target.toString(), {
      headers: { 'user-agent': 'Roblox/WinInet', accept: '*/*' },
      maxTime: 30,
    });
    payloadBytes = downloaded.bytes;
    payloadUrl = downloaded.finalUrl || target.toString();
  } else if (response.status < 200 || response.status >= 300) {
    return {
      source: stage1,
      complete: false,
      reason: 'JNKIE delivery returned HTTP ' + response.status + (responseText ? ': ' + responseText.slice(0, 250) : ''),
      deliveryError: responseText || ('HTTP ' + response.status),
      finalUrl: loaderUrl.toString(),
    };
  }

  const payload = decodeSource(payloadBytes).replace(/\r\n/g, '\n');
  if (/^\s*(?:<!doctype html|<html\b)/i.test(payload)) {
    throw new Error('JNKIE delivery returned HTML instead of a Lua payload.');
  }
  if (!payload.trim()) throw new Error('JNKIE returned an empty delivery payload.');
  if (/^LDR-DENIED:/i.test(payload.trim())) {
    return {
      source: stage1,
      complete: false,
      reason: payload.trim().slice(0, 400),
      deliveryError: payload.trim().slice(0, 400),
      finalUrl: loaderUrl.toString(),
    };
  }
  return { source: payload, complete: true, reason: '', finalUrl: payloadUrl };
}

function buildScriptFetchedEmbed(attachment, batchIndex, batchCount, totalFiles, totalUrls, failedUrls) {
  const capture = attachment && attachment.capture || {};
  const source = String(capture.source || '');
  const codeMark = String.fromCharCode(96);
  const filename = String(attachment && attachment.name || capture.name || 'fetched.lua')
    .replace(/[\r\n*_~|]/g, '')
    .slice(0, 100);
  let host = 'uploaded or inline source';
  const rawUrl = capture.finalUrl || capture.url || null;
  if (rawUrl) {
    try { host = new URL(rawUrl).host; } catch {}
  }
  let preview = source.replace(/\r\n?/g, '\n').split('\n').slice(0, 5).join('\n');
  preview = preview.replace(/\x60\x60\x60/g, "'''");
  if (preview.length > 850) preview = preview.slice(0, 847) + '...';
  if (!preview.trim()) preview = '-- No readable preview available';

  const description = [
    'Downloaded from **' + host + '**.',
    '',
    '**Preview (first 5 lines):**',
    codeMark.repeat(3) + 'lua',
    preview,
    codeMark.repeat(3),
    '',
    '━━━━━━━━━━━━━━━━━━━━',
    '',
    '**Fetch complete**',
    'The source was fetched successfully. Use .deobf to choose an analysis engine for this file.',
  ].join('\n');

  return dailyEmbed(
    batchIndex === 0 ? 'Script fetched' : 'Additional scripts fetched',
    description,
    DAILY_COLORS.success
  ).addFields(
    { name: 'File', value: codeMark + (filename || 'fetched.lua') + codeMark, inline: true },
    { name: 'Exact size', value: attachment.data.length.toLocaleString('en-US') + ' bytes (' + formatBytes(attachment.data.length) + ')', inline: true },
    { name: 'SHA-256', value: codeMark + sha256Hex(attachment.data).slice(0, 16) + codeMark, inline: true },
    { name: 'Fetch results', value: totalFiles + ' file(s) · ' + totalUrls + ' URL(s) · ' + failedUrls + ' failed', inline: true },
    ...(batchIndex > 0 ? [{ name: 'Batch', value: (batchIndex + 1) + ' / ' + batchCount, inline: true }] : [])
  );
}

async function startGetWorkflow(message, inlineSource = null) {
  const prompt = await message.reply({
    embeds: [dailyEmbed(
      'Universal loader fetcher',
      inlineSource
        ? 'Scanning the supplied source for static HTTP URLs and retrieving readable Lua/Luau files...'
        : 'Attach a script or send a URL. The fetcher scans Roblox HTTP methods, request wrappers, URL fields, aliases and embedded loader strings.',
      DAILY_COLORS.primary
    )],
    allowedMentions: { repliedUser: false },
  });

  const firstAttachment = message.attachments.first();
  if (inlineSource && firstAttachment) {
    throw new Error('Use either an inline URL/expression or a file attachment, not both.');
  }

  let input;
  if (inlineSource) {
    const direct = inlineSource.match(/https?:\/\/[^\s"'<>]+/i);
    if (direct) {
      const rawUrl = direct[0].replace(/[)\]},.;]+$/g, '');
      const parsed = new URL(rawUrl);
      const curlOptions = parseCurlStyleOptions(inlineSource);
      if ((curlOptions.method && curlOptions.method !== 'GET') || curlOptions.body) {
        throw new Error('.get downloads source files with GET only. Use -G with -d/--data to add query parameters; it will not replay POST or other state-changing requests from a script.');
      }
      if (curlOptions.queryData) {
        for (const [key, item] of new URLSearchParams(curlOptions.queryData)) parsed.searchParams.append(key, item);
      }
      input = {
        source: '',
        filename: path.basename(parsed.pathname) || 'remote-url.lua',
        url: parsed.toString(),
        originalText: inlineSource,
        curlOptions,
      };
    } else {
      input = { source: inlineSource, filename: 'get-input.lua' };
    }
  } else if (firstAttachment) {
    input = await inputFromAttachment(firstAttachment);
  } else {
    input = await collectGetInput(message, prompt);
  }

  const luaProtectStub = extractLuaProtectRunnerUrl(String(input.source || '') + '\n' + String(input.originalText || ''));
  if (luaProtectStub) {
    await sendLuaProtectRunnerBody(message, prompt, input.source || input.originalText || '', luaProtectStub);
    return;
  }

  let sourceToScan = input.source;
  const correction = !firstAttachment
    ? suggestLoadstringHttpGetCorrection(sourceToScan)
    : null;

  if (correction) {
    const confirmRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('get-url-fix-yes:' + message.author.id)
        .setLabel('Yes, fix it')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('get-url-fix-no:' + message.author.id)
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Secondary),
    );
    await prompt.edit({
      content: '⚠️ **The URL looks malformed. Did you mean this?**\n' +
        '**.get ' + correction.expression + '**\n' +
        'I found ))() inside the URL text. The corrected version moves it outside the URL quotes.',
      components: [confirmRow],
    });

    let confirmation;
    try {
      confirmation = await prompt.awaitMessageComponent({
        time: PICKER_WAIT_MS,
        filter: (interaction) =>
          interaction.user.id === message.author.id &&
          (interaction.customId === 'get-url-fix-yes:' + message.author.id ||
           interaction.customId === 'get-url-fix-no:' + message.author.id),
      });
    } catch {
      await prompt.edit({ content: '⌛ URL correction confirmation timed out. Run .get again.', components: [] }).catch(() => {});
      throw new Error('URL correction confirmation timed out.');
    }

    if (confirmation.customId !== 'get-url-fix-yes:' + message.author.id) {
      await confirmation.update({ content: 'Cancelled. No URL was downloaded.', components: [] });
      throw new Error('Cancelled.');
    }

    await confirmation.update({
      content: '✅ Using the corrected loadstring URL. Starting .get...',
      components: [],
    });
    sourceToScan = correction.expression;
  }

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
      if (input.url && rawUrl === input.url && input.source.trim()) {
        return {
          source: input.source,
          finalUrl: input.url,
          contentType: 'input source',
          status: 200,
        };
      }
      const credentialText = String(input.originalText || '') + '\n' + String(input.source || '');
      const luaProtectSource = await fetchLuaProtectLoaderSource(rawUrl);
      if (luaProtectSource !== null) return { source: luaProtectSource, finalUrl: rawUrl, contentType: 'application/lua', status: 200 };
      const vantarmorSource = await fetchVantarmorLoaderSource(rawUrl, credentialText);
      if (vantarmorSource !== null) {
        return {
          source: vantarmorSource,
          finalUrl: rawUrl,
          contentType: 'application/lua',
          status: 200,
        };
      }
      const jnkieResult = await fetchJnkIeLoaderSource(rawUrl, credentialText);
      if (jnkieResult !== null) {
        return {
          source: jnkieResult.source,
          finalUrl: jnkieResult.finalUrl || rawUrl,
          contentType: jnkieResult.complete ? 'application/lua' : 'application/lua; JNKIE stage-one only',
          status: jnkieResult.complete ? 200 : 206,
        };
      }
      const rootOptions = input.url && rawUrl === input.url ? (input.curlOptions || {}) : {};
      const fetched = await fetchPublicText(rawUrl, {
        headers: rootOptions.headers,
        compressed: rootOptions.compressed,
        maxTime: rootOptions.maxTime,
        connectTimeout: rootOptions.connectTimeout,
        forceRobloxUserAgent: true,
      });
      const fetchedSource = decodeSource(fetched.bytes);
      const nestedLuaProtectUrl = extractLuaProtectRunnerUrl(fetchedSource);
      if (nestedLuaProtectUrl) {
        const runnerSource = await fetchLuaProtectLoaderSource(nestedLuaProtectUrl);
        if (runnerSource !== null) {
          return {
            source: runnerSource,
            finalUrl: nestedLuaProtectUrl,
            contentType: 'application/lua',
            status: 200,
          };
        }
      }
      return {
        source: fetchedSource,
        finalUrl: fetched.finalUrl || rawUrl,
        contentType: fetched.contentType || 'unknown',
        status: fetched.status || null,
      };
    },
  });

  if (!resolution.discovered) {
    if (input.source && input.source.trim()) {
      await sendOriginalLua(
        message,
        prompt,
        input,
        'No static HTTP/HTTPS source links were found. The submitted Lua/Luau file is attached unchanged.'
      );
      return;
    }
    throw new Error(
      'No literal HTTP/HTTPS URL was found in the source. .get scans HttpGet/HttpGetAsync, ' +
      'HttpService GetAsync/PostAsync/RequestAsync, request/http_request and common aliases, ' +
      'Url/Uri/Endpoint table fields, URL string constants, and nested literal loadstring text. ' +
      'URLs built only at runtime (for example from encrypted pieces, game state or computed values) ' +
      'cannot be known by static inspection.'
    );
  }

  const attachments = [];
  let totalBytes = 0;
  const omittedNames = [];
  const contentHashes = new Map();
  for (const capture of resolution.captures) {
    const data = Buffer.from(capture.source, 'utf8');
    const sha256 = sha256Hex(data);
    const previous = contentHashes.get(sha256);
    capture.sha256 = sha256;
    capture.exactBytes = data.length;
    capture.duplicateOf = previous ? previous.name : null;
    if (!previous) contentHashes.set(sha256, { name: capture.name, url: capture.url || null });
    if (totalBytes + data.length > MAX_GET_OUTPUT_BYTES) {
      omittedNames.push(capture.name);
      continue;
    }
    const extension = path.extname(capture.name) || '.lua';
    const base = path.basename(capture.name, extension);
    attachments.push({
      name: base + '_' + sha256.slice(0, 8) + extension,
      data,
      capture,
    });
    totalBytes += data.length;
  }
  const duplicateGroups = [...contentHashes.entries()].filter(([, item]) => item && item.name)
    .map(([hash, first]) => ({
      hash,
      first,
      matches: resolution.captures.filter((capture) => capture.sha256 === hash),
    }))
    .filter((group) => group.matches.length > 1);

  const discoveryLines = (resolution.discoveries || []).map((item, index) => {
    const details = [
      String(index + 1).padStart(3, '0') + '.',
      reportUrl(item.url),
      'depth=' + item.depth,
      'status=' + item.status,
    ];
    if (item.filename) details.push('file=' + item.filename);
    if (item.correctedFrom) {
      details.push('auto-fixed=' + reportUrl(item.correctedFrom) + ' -> ' + reportUrl(item.url));
    }
    if (item.error) details.push('error=' + item.error.replace(/[\r\n]+/g, ' ').slice(0, 500));
    return details.join(' | ');
  });

  const captureLines = resolution.captures.map((capture) => [
    capture.name,
    'depth=' + capture.depth,
    'exact-bytes=' + (capture.exactBytes ?? Buffer.byteLength(capture.source, 'utf8')),
    'display-size=' + formatBytes(capture.exactBytes ?? Buffer.byteLength(capture.source, 'utf8')),
    'sha256=' + (capture.sha256 || sha256Hex(Buffer.from(capture.source, 'utf8'))),
    capture.duplicateOf ? 'identical-content-to=' + capture.duplicateOf : 'unique-content-in-this-run',
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

  const httpSpyEntries = extractHttpSpyEntries(input.source, input.filename || 'input.lua');
  for (const capture of resolution.captures) {
    if (capture.source) httpSpyEntries.push(...extractHttpSpyEntries(capture.source, capture.name));
  }
  const uniqueSpyEntries = [...new Map(httpSpyEntries.map((entry) =>
    [[entry.filename, entry.line, entry.method, entry.url].join('|'), entry]
  )).values()];
  const httpSpyLines = uniqueSpyEntries.map((entry, index) =>
    String(index + 1).padStart(3, '0') + '. ' + entry.filename +
    ':' + entry.line + ' | ' + entry.method + ' | ' + redactSpyUrl(entry.url)
  );

  if (input.source && input.source.trim() && !/^https?:\/\/\S+$/i.test(input.source.trim())) {
    const originalBytes = Buffer.from(input.source, 'utf8');
    if (originalBytes.length <= MAX_OUTPUT_BYTES) {
      const originalName = path.basename(String(input.filename || 'get-input.lua'));
      const originalBase = path.basename(originalName, path.extname(originalName))
        .replace(/[^A-Za-z0-9._-]/g, '_') || 'get-input';
      await message.reply({
        content: '📎 Original .get input:',
        files: [new AttachmentBuilder(originalBytes, { name: originalBase + '.lua' })],
        allowedMentions: { repliedUser: false },
      });
    }
  }

  const batches = [];
  let currentBatch = [];
  let currentBatchBytes = 0;
  for (const attachment of attachments) {
    if (currentBatch.length >= 10 ||
        currentBatchBytes + attachment.data.length > MAX_OUTPUT_BYTES) {
      if (currentBatch.length) batches.push(currentBatch);
      currentBatch = [];
      currentBatchBytes = 0;
    }
    currentBatch.push(attachment);
    currentBatchBytes += attachment.data.length;
  }
  if (currentBatch.length) batches.push(currentBatch);

  if (!batches.length) {
    const failureEmbed = dailyEmbed(
      'No script fetched',
      'The scan finished, but no downloadable source files were returned.',
      DAILY_COLORS.warning
    );
    await message.reply({
      embeds: [failureEmbed],
      allowedMentions: { repliedUser: false },
    });
  } else {
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      const firstAttachment = batch[0];
      await message.reply({
        embeds: [buildScriptFetchedEmbed(
          firstAttachment,
          batchIndex,
          batches.length,
          attachments.length,
          resolution.discovered,
          resolution.failures.length
        )],
        files: batch.map((item) => new AttachmentBuilder(item.data, { name: item.name })),
        allowedMentions: { repliedUser: false },
      });
    }
  }

  await prompt.edit({
    content: attachments.length
      ? '✅ .get completed. Sent ' + attachments.length + ' downloaded source file(s).'
      : '⚠️ .get completed. No source files were downloaded.',
    components: [],
  }).catch(() => {});
}


async function ensureIronVeilBuilt() {
  const existing = await fs.stat(ENGINE_IRONVEIL_CLI).catch(() => null);
  if (existing && existing.isFile()) return;

  const python = process.env.PYTHON_BIN ||
    (process.platform === 'win32' ? 'python' : 'python3');
  const setupScript = path.join(__dirname, 'scripts', 'setup-ironveil.py');
  const compiler = path.join(__dirname, 'node_modules', 'typescript', 'bin', 'tsc');

  await runCommand(python, [setupScript], __dirname, 120_000);
  const compilerStat = await fs.stat(compiler).catch(() => null);
  if (!compilerStat || !compilerStat.isFile()) {
    throw new Error('IronVeil build dependency is missing: TypeScript. Run npm install and restart the bot.');
  }
  await runCommand(process.execPath, [
    compiler, '-p', path.join(ENGINE_IRONVEIL_DIR, 'tsconfig.json'),
  ], ENGINE_IRONVEIL_DIR, 120_000);

  const built = await fs.stat(ENGINE_IRONVEIL_CLI).catch(() => null);
  if (!built || !built.isFile()) {
    throw new Error('IronVeil build completed without creating dist/cli.js.');
  }
}

async function ensurePrivateObfuscationLogChannel(guild) {
  if (!guild) return null;
  await guild.roles.fetch().catch(() => {});
  const everyone = guild.roles.everyone;
  const privilegedRoles = guild.roles.cache.filter((role) =>
    role.permissions.has(PermissionFlagsBits.Administrator) ||
    role.permissions.has(PermissionFlagsBits.ManageGuild)
  );
  const overwrites = [
    { id: everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    {
      id: client.user.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.EmbedLinks,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.ReadMessageHistory,
      ],
    },
    {
      id: guild.ownerId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
      ],
    },
    ...privilegedRoles.map((role) => ({
      id: role.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
      ],
    })),
  ];
  const configuredId = process.env.OBFUSCATION_LOG_CHANNEL_ID;
  let channel = configuredId
    ? await guild.channels.fetch(configuredId).catch(() => null)
    : guild.channels.cache.find((entry) =>
        entry.type === ChannelType.GuildText && entry.name === 'obfuscation-logs'
      );
  if (channel && channel.type !== ChannelType.GuildText) channel = null;
  if (!channel) {
    channel = await guild.channels.create({
      name: 'obfuscation-logs',
      type: ChannelType.GuildText,
      topic: 'Private audit log for DAILY DEOBF obfuscation jobs.',
      permissionOverwrites: overwrites,
    });
  } else {
    await channel.permissionOverwrites.set(overwrites);
  }
  return channel;
}

async function writeObfuscationLog(interaction, details) {
  if (!interaction.guild) return;
  try {
    const channel = await ensurePrivateObfuscationLogChannel(interaction.guild);
    if (!channel) return;
    await channel.send({
      embeds: [dailyEmbed(
        details.success ? 'Obfuscation completed' : 'Obfuscation failed',
        [
          '**User:** ' + interaction.user.tag + ' (' + interaction.user.id + ')',
          '**Engine:** ' + details.engine,
          '**File:** ' + String(details.filename || 'unknown').slice(0, 180),
          '**Result:** ' + (details.success ? 'Success' : 'Failed'),
          '**Duration:** ' + Math.max(0, Math.round(details.durationMs / 1000)) + 's',
          details.error ? '**Error:** ' + String(details.error).slice(0, 700) : '',
          '**Time:** <t:' + Math.floor(Date.now() / 1000) + ':F>',
        ].filter(Boolean).join('\n'),
        details.success ? DAILY_COLORS.success : DAILY_COLORS.danger
      )],
      allowedMentions: { parse: [] },
    });
  } catch (error) {
    console.error('Could not write private obfuscation log:', error);
  }
}

async function handleDailyfuscatorCommand(interaction, attachment) {
  const startedAt = Date.now();
  const originalName = path.basename(String(attachment && attachment.name || 'script.lua').replace(/\\/g, '/'));
  let completed = false;
  let failure = '';

  await interaction.deferReply({ ephemeral: true });
  try {
    const extension = path.extname(originalName).toLowerCase();
    if (!['.lua', '.luau', '.txt'].includes(extension)) {
      throw new Error('Dailyfuscator accepts .lua, .luau and .txt source files.');
    }
    if (Number.isFinite(attachment && attachment.size) && attachment.size > MAX_DAILYFUSCATOR_INPUT_BYTES) {
      throw new Error('Dailyfuscator input is limited to 1 MB per file.');
    }

    await interaction.editReply('**[1/4]** Downloading your Lua/Luau source...');
    const response = await fetch(attachment.url, {
      redirect: 'error',
      signal: AbortSignal.timeout(20_000),
      headers: { 'user-agent': 'DAILY-DEOBF/1.0' },
    });
    if (!response.ok) throw new Error('Discord file download returned HTTP ' + response.status + '.');
    const inputBuffer = await readResponse(response, MAX_DAILYFUSCATOR_INPUT_BYTES);
    if (!inputBuffer.length) throw new Error('The uploaded source file is empty.');
    const source = decodeSource(inputBuffer);
    if (!source.trim()) throw new Error('The uploaded source file contains no Lua/Luau code.');

    await interaction.editReply('**[2/4]** Preparing the approved Dailyfuscator v3 engine in an isolated worker...');
    const { obfuscateDailyfuscatorInWorker } = require('./scripts/dailyfuscator-runtime');

    const requestedProfile = interaction.options.getString('profile') || 'standard';
    const profile = ['light', 'standard', 'hard'].includes(requestedProfile) ? requestedProfile : 'standard';
    const seed = interaction.options.getString('seed') || undefined;

    await interaction.editReply('**[3/4]** Running Dailyfuscator v3 (' + profile + ')...');
    const result = await obfuscateDailyfuscatorInWorker(source, {
      profile,
      seed,
      // Keep the minimum aligned with the engine's tested configuration.
      // A 512 KB floor caused unnecessary output expansion on every build.
      minBytes: 4096,
    }, 180_000, (elapsedMs) => {
      const elapsedSeconds = Math.floor(elapsedMs / 1000);
      interaction.editReply(
        '**[3/4]** Running Dailyfuscator v3 (' + profile + ')...\n' +
        'Worker is still processing in isolation · ' + elapsedSeconds + 's elapsed.'
      ).catch(() => {});
    });
    if (!result || !result.ok) {
      throw new Error(result && result.error || 'Dailyfuscator did not produce an output.');
    }

    const outputBuffer = Buffer.from(result.code, 'utf8');
    if (!outputBuffer.length) throw new Error('Dailyfuscator returned an empty output.');
    if (outputBuffer.length > MAX_OUTPUT_BYTES) {
      throw new Error('The obfuscated output exceeds the 18 MB Discord attachment limit.');
    }

    const baseName = path.basename(originalName, extension)
      .replace(/[^A-Za-z0-9._-]/g, '_') || 'script';
    const outputName = 'dailyfuscator-' + baseName + '.lua';
    const profileLabel = profile.charAt(0).toUpperCase() + profile.slice(1);
    const report = result.report || {};
    const warnings = Array.isArray(report.warnings) ? report.warnings : [];
    const skipped = Object.entries(report.skipped || {})
      .filter((entry) => Number(entry[1]) > 0)
      .map((entry) => entry[0] + ': ' + entry[1]);
    const reportLines = [
      'DAILYFUSCATOR v3 · BUILD REPORT',
      'Original file: ' + originalName,
      'Output file: ' + outputName,
      'Profile: ' + profileLabel,
      'Input bytes: ' + inputBuffer.length.toLocaleString('en-US'),
      'Output bytes: ' + outputBuffer.length.toLocaleString('en-US'),
      'Seed: ' + String(report.seed ?? 'not reported'),
      'Virtualized functions: ' + Number(report.virtualized || 0),
      'Skipped VM constructs: ' + (skipped.join(', ') || 'None reported'),
      'Flattened control-flow blocks: ' + Number(report.flattened || 0),
      'Protected strings: ' + Number(report.strings || 0),
      'Protected numbers: ' + Number(report.numbers || 0),
      'Renamed identifiers: ' + Number(report.renamed || 0),
      'Checksum: ' + String(report.checksum ?? 'not reported'),
      '',
      'WARNINGS',
      ...(warnings.length ? warnings.slice(0, 40).map((warning) => '- ' + String(warning).slice(0, 300)) : ['None']),
      '',
      'The source was transformed statically and was not executed by the bot.',
      'Unsupported or runtime-specific constructs may remain outside the VM. Test the output in your own controlled environment.',
    ];
    const reportBuffer = Buffer.from(reportLines.join('\n'), 'utf8');
    const reportName = 'dailyfuscator-' + baseName + '-report.txt';

    await interaction.editReply('**[4/4]** Obfuscation complete. Uploading the protected file and report...');
    await interaction.editReply({
      content: [
        '✅ **Dailyfuscator v3 finished.**',
        'Profile: **' + profileLabel + '**',
        'Input: ' + inputBuffer.length.toLocaleString('en-US') + ' bytes',
        'Output: ' + outputBuffer.length.toLocaleString('en-US') + ' bytes',
        'Virtualized functions: ' + Number(report.virtualized || 0),
        'Warnings: ' + warnings.length,
        'Your original upload was not modified. The bot did not execute the input script.',
      ].join('\n'),
      files: [
        new AttachmentBuilder(outputBuffer, { name: outputName }),
        new AttachmentBuilder(reportBuffer, { name: reportName }),
      ],
      allowedMentions: { parse: [] },
    });
    completed = true;
  } catch (error) {
    failure = String(error && error.message || error);
    console.error('Dailyfuscator v3 failed:', error);
    await interaction.editReply(
      'Dailyfuscator v3 could not process that file: ' + failure.slice(0, 900) +
      '. Your original file was left unchanged.'
    ).catch(() => {});
  } finally {
    await writeObfuscationLog(interaction, {
      engine: 'Dailyfuscator v3',
      filename: originalName,
      success: completed,
      error: failure,
      durationMs: Date.now() - startedAt,
    });
  }
}

async function handleCryonCommand(interaction, attachment) {
  const startedAt = Date.now();
  const originalName = path.basename(String(attachment && attachment.name || 'script.lua').replace(/\\/g, '/'));
  let completed = false;
  let failure = '';

  await interaction.deferReply({ ephemeral: true });
  try {
    const token = String(process.env.CRYON_API_TOKEN || '').trim();
    if (!token) {
      throw new Error('Cryon is not configured. Add CRYON_API_TOKEN to the bot environment variables.');
    }
    const extension = path.extname(originalName).toLowerCase();
    if (!['.lua', '.luau', '.txt'].includes(extension)) {
      throw new Error('Cryon accepts .lua, .luau and .txt source files.');
    }
    if (Number.isFinite(attachment && attachment.size) && attachment.size > 150 * 1024) {
      throw new Error('Cryon has a strict 150 KB source limit.');
    }

    await interaction.editReply('**[1/4]** Downloading your Lua/Luau source...');
    const download = await fetch(attachment.url, {
      redirect: 'error',
      signal: AbortSignal.timeout(20_000),
      headers: { 'user-agent': 'DAILY-DEOBF/1.0' },
    });
    if (!download.ok) throw new Error('Discord file download returned HTTP ' + download.status + '.');
    const inputBuffer = await readResponse(download, 150 * 1024);
    if (!inputBuffer.length) throw new Error('The uploaded source file is empty.');
    const source = decodeSource(inputBuffer);
    if (!source.trim()) throw new Error('The uploaded source file contains no Lua/Luau code.');

    const optimize = Number(interaction.options.getString('optimize') || '1');
    if (![1, 2, 3].includes(optimize)) throw new Error('Cryon optimize must be 1, 2 or 3.');
    const compress = interaction.options.getBoolean('compress') ?? true;

    await interaction.editReply('**[2/4]** Sending source to Cryon...');
    const apiResponse = await fetch('https://cryon.cpsnetwork.xyz/api/obfuscate', {
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(90_000),
      headers: {
        authorization: 'Bearer ' + token,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({ source, optimize, compress }),
    });

    const raw = await apiResponse.text();
    let payload = null;
    try { payload = JSON.parse(raw); } catch {}
    if (!apiResponse.ok) {
      const message = payload && (payload.error || payload.message) || raw.slice(0, 500) || 'No error details returned.';
      const statusHelp = {
        400: ' Check the source and options.',
        401: ' The Cryon token is missing, invalid or revoked.',
        403: ' The token may not have Premium API access.',
        413: ' The source exceeds Cryon’s 150 KB limit.',
        429: ' Cryon rate limit reached. Wait before retrying.',
      }[apiResponse.status] || '';
      throw new Error('Cryon API returned HTTP ' + apiResponse.status + ': ' + String(message).slice(0, 500) + statusHelp);
    }
    if (!payload || typeof payload.code !== 'string' || !payload.code.trim()) {
      throw new Error('Cryon returned HTTP success but no usable code field.');
    }

    const outputBuffer = Buffer.from(payload.code, 'utf8');
    if (outputBuffer.length > MAX_OUTPUT_BYTES) {
      throw new Error('Cryon output exceeds the 18 MB Discord attachment limit.');
    }
    const baseName = path.basename(originalName, extension)
      .replace(/[^A-Za-z0-9._-]/g, '_') || 'script';
    const outputName = 'cryon-' + baseName + '.lua';
    await interaction.editReply('**[3/4]** Cryon finished. Preparing the sealed output...');
    await interaction.editReply({
      content: [
        'Cryon API finished successfully.',
        'Optimization: **' + optimize + '**',
        'Compression: **' + (compress ? 'Enabled' : 'Disabled') + '**',
        'Input: ' + inputBuffer.length.toLocaleString('en-US') + ' bytes',
        'Output: ' + outputBuffer.length.toLocaleString('en-US') + ' bytes',
        'Your original upload was not modified. The bot sent the source to Cryon and did not execute it.',
      ].join('\n'),
      files: [new AttachmentBuilder(outputBuffer, { name: outputName })],
      allowedMentions: { parse: [] },
    });
    completed = true;
  } catch (error) {
    failure = String(error && error.message || error);
    console.error('Cryon API obfuscation failed:', failure);
    await interaction.editReply('Cryon could not process that file: ' + failure.slice(0, 900)).catch(() => {});
  } finally {
    await writeObfuscationLog(interaction, {
      engine: 'Cryon API',
      filename: originalName,
      success: completed,
      error: failure,
      durationMs: Date.now() - startedAt,
    });
  }
}

async function handleObfuscatorCommand(interaction) {
  const engine = interaction.options.getString('obfuscator');
  const attachment = interaction.options.getAttachment('file');
  if (engine === 'cryon') {
    await handleCryonCommand(interaction, attachment);
    return;
  }
  if (engine === 'dailyfuscator') {
    await handleDailyfuscatorCommand(interaction, attachment);
    return;
  }
  if (engine !== 'ironveil') {
    await interaction.reply({ content: 'That obfuscator is not available.', ephemeral: true });
    return;
  }
  if (!attachment) {
    await interaction.reply({ content: 'Upload a .lua, .luau or .txt file.', ephemeral: true });
    return;
  }

  await interaction.deferReply({ ephemeral: true });
  const startedAt = Date.now();
  const originalName = path.basename(String(attachment.name || 'script.lua').replace(/\\/g, '/'));
  let workDir = null;
  let completed = false;
  let failure = '';
  try {
    await interaction.editReply('**[1/5]** Preparing IronVeil engine...');
    await ensureIronVeilBuilt();

    const extension = path.extname(originalName).toLowerCase();
    if (!['.lua', '.luau', '.txt'].includes(extension)) {
      throw new Error('IronVeil accepts .lua, .luau and .txt source files.');
    }
    if (Number.isFinite(attachment.size) && attachment.size > MAX_INPUT_BYTES) {
      throw new Error('The uploaded file exceeds the 18 MB input limit.');
    }

    await interaction.editReply('**[2/5]** Downloading your source file...');
    const response = await fetch(attachment.url, {
      redirect: 'error',
      signal: AbortSignal.timeout(20_000),
      headers: { 'user-agent': 'DAILY-DEOBF/1.0' },
    });
    if (!response.ok) throw new Error('Discord file download returned HTTP ' + response.status + '.');
    const inputBuffer = await readResponse(response, MAX_INPUT_BYTES);

    await interaction.editReply('**[3/5]** Reading and validating source (' + formatBytes(inputBuffer.length) + ')...');
    const source = decodeSource(inputBuffer);
    workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dailydeobf-ironveil-'));
    const inputPath = path.join(workDir, 'input.lua');
    const outputPath = path.join(workDir, 'output.lua');
    let workingSource = source;
    await fs.writeFile(inputPath, workingSource, { encoding: 'utf8', mode: 0o600 });

    await interaction.editReply('**[4/6]** Running IronVeil obfuscation...');
    let repairChanges = [];
    try {
      await runCommand(process.execPath, [ENGINE_IRONVEIL_CLI, inputPath, outputPath],
        ENGINE_IRONVEIL_DIR, 5 * 60_000);
    } catch (firstError) {
      const repaired = repairIronVeilSource(workingSource);
      if (!repaired.changed) throw firstError;

      repairChanges = repaired.changes;
      workingSource = repaired.source;
      await interaction.editReply(
        '**[5/6]** IronVeil reported a syntax error. Applying ' +
        repairChanges.length + ' safe syntax correction(s), then retrying...'
      );
      await fs.writeFile(inputPath, workingSource, { encoding: 'utf8', mode: 0o600 });
      await fs.rm(outputPath, { force: true }).catch(() => {});
      await runCommand(process.execPath, [ENGINE_IRONVEIL_CLI, inputPath, outputPath],
        ENGINE_IRONVEIL_DIR, 5 * 60_000);
    }

    const outputStat = await fs.stat(outputPath).catch(() => null);
    if (!outputStat || !outputStat.isFile() || outputStat.size === 0) {
      throw new Error('IronVeil finished without producing an output file.');
    }
    if (outputStat.size > MAX_OUTPUT_BYTES) {
      throw new Error('The obfuscated output exceeds the 18 MB attachment limit.');
    }

    const outputBuffer = await fs.readFile(outputPath);
    const baseName = path.basename(originalName, extension)
      .replace(/[^A-Za-z0-9._-]/g, '_') || 'script';
    const outputName = 'ironveil-' + baseName + '.lua';
    await interaction.editReply('**[6/6]** Obfuscation complete. Uploading the result...');
    await interaction.editReply({
      content: 'IronVeil finished. Your original upload was not modified.' +
        (repairChanges.length
          ? ' Applied ' + repairChanges.length + ' conservative syntax correction(s) before retrying.'
          : '') +
        ' Luau syntax and type annotations are normalized before the IronVeil compiler; some advanced control-flow and runtime-specific constructs may still be unsupported by the engine.',
      files: [new AttachmentBuilder(outputBuffer, { name: outputName })],
    });
    completed = true;
  } catch (error) {
    failure = String(error && error.message || error);
    console.error('IronVeil obfuscation failed:', error);
    await interaction.editReply(
      'IronVeil could not process that file: ' + failure.slice(0, 700) +
      '. Your original file was left unchanged.'
    ).catch(() => {});
  } finally {
    await writeObfuscationLog(interaction, {
      engine: 'IronVeil',
      filename: originalName,
      success: completed,
      error: failure,
      durationMs: Date.now() - startedAt,
    });
    if (workDir) await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}
async function handlePureLuauCommand(interaction) {
  const attachment = interaction.options.getAttachment('file');
  const pastedSource = interaction.options.getString('source');
  if (!attachment && !pastedSource) {
    await interaction.reply({
      content: 'Upload a .lua, .luau, .pureluau or .txt file or paste source text in the source option.',
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
      if (!/\.(?:lua|luau|pureluau|txt)$/i.test(originalName)) {
        await interaction.editReply('Only .lua, .luau, .pureluau and .txt source files are supported.');
        return;
      }
      if (Number.isFinite(attachment.size) && attachment.size > MAX_PURELUA_BYTES) {
        throw new Error('This source file exceeds the 8 MB PureLuau input limit.');
      }
      const response = await fetch(attachment.url, {
        redirect: 'error',
        signal: AbortSignal.timeout(15_000),
        headers: { 'user-agent': 'DAILY-DEOBF/1.0' },
      });
      if (!response.ok) throw new Error('Discord file download returned HTTP ' + response.status + '.');
      const buffer = await readResponse(response, MAX_PURELUA_BYTES);
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
    const originalBufferBytes = Buffer.byteLength(source, 'utf8');
    const convertedBuffer = Buffer.from(result.output, 'utf8');
    const byteDelta = convertedBuffer.length - originalBufferBytes;
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
      'Input size: ' + originalBufferBytes.toLocaleString() + ' bytes',
      'Output size: ' + convertedBuffer.length.toLocaleString() + ' bytes',
      'Output size change: ' + (byteDelta > 0 ? '+' : '') + byteDelta.toLocaleString() + ' bytes',
      'Input limit: 4,000,000 characters / 8 MB',
      'Input handling: UTF-8 source text; filename extension is checked separately from source content',
      ...(result.partialRecovery?.nilConditionBranches ? [
        'Unresolved nil-condition branches: ' + result.partialRecovery.nilConditionBranches,
      ] : []),
      ...(result.partialRecovery?.isLuraphPartial ? [
        'Input classification: Partial Luraph recovery output',
        'Unlifted Luraph runtime stubs: ' + result.partialRecovery.runtimeStubs,
        'Symbolic proto-array lifting failures: ' + result.partialRecovery.symbolicLiftFailures,
        'Generated payload-function labels: ' + result.partialRecovery.generatedPayloadFunctions,
        'Distinct unresolved upvalue placeholders: ' + result.partialRecovery.unresolvedUpvalueReferences,
        'Recovery status: readability conversion only; missing VM behavior was not reconstructed',
      ] : []),
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
      'Boolean gating chains simplified: ' + result.simplifiedBooleanChains,
      'Nested bit32 XOR identities simplified: ' + result.simplifiedBit32Expressions,
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


async function handlePureLuauPrefixCommand(message, pastedSource = null) {
  let responseMessage = null;
  const attachment = message.attachments.first() || null;
  const adapter = {
    options: {
      getAttachment: () => attachment,
      getString: () => pastedSource,
    },
    reply: async (payload) => message.reply({
      content: payload.content,
      allowedMentions: { repliedUser: false },
    }),
    deferReply: async () => {
      responseMessage = await message.reply({
        embeds: [dailyEmbed('PureLuau · Processing', 'Converting the supplied source...', DAILY_COLORS.primary)],
        allowedMentions: { repliedUser: false },
      });
    },
    editReply: async (payload) => {
      if (!responseMessage) {
        responseMessage = await message.reply(payload);
        return responseMessage;
      }
      return responseMessage.edit(payload);
    },
  };
  await handlePureLuauCommand(adapter);
}

// .l - environment log: run the script in the offline sandbox (the v15
// engine's envlog.luau model of Roblox; nothing touches the network or a real
// game) and send back what it did: services, instances, remotes fired, URLs
// requested, values printed. No devirtualization, so it is fast.
async function startEnvLogWorkflow(message, inlineText = null) {
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
      // a link, or a loadstring(game:HttpGet("URL"))() one-liner: fetch it
      input = await inputFromUrlText(inlineText);
    } else if (inlineText) {
      // pasted source (``` code blocks are unwrapped)
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
  const outputPath = path.join(tempRoot, base + '.envlog.lua');
  const started = Date.now();
  try {
    await fs.writeFile(inputPath, input.source, 'utf8');
    await prompt.edit({
      embeds: [dailyEmbed('Environment log', 'Running **' + base + '** in the offline sandbox (' + formatBytes(Buffer.byteLength(input.source, 'utf8')) + ')...', DAILY_COLORS.primary)],
    }).catch(() => {});
    let result;
    try {
      result = await runPythonEngine(ENGINE_V15_DIR, ENGINE_V15_CLI, inputPath, outputPath, 240_000, [
        '--debug',           // write the trace itself to the output path (also
                             // when the run stops in an endless loop)
        '--no-devirt',       // behaviour only: fast
        '--strings',
        '--budget', '30',
        '--timeout', '120',
        ...(process.env.DEOB_USE_PYPY === '1' ? [] : ['--no-pypy']),
      ]);
    } catch (error) {
      result = { failed: error };
    }
    let log = '';
    try {
      log = await fs.readFile(outputPath, 'utf8');
    } catch {
      const why = result && result.failed ? String(result.failed.message || result.failed) : 'the sandbox produced no log';
      throw new Error('Environment log failed: ' + why.slice(0, 800));
    }
    const header = log.split(/\r?\n/).slice(0, 100);
    const headerLine = (re) => header.find((line) => re.test(line)) || '';
    const statusLine = headerLine(/^--\s*run status:/);
    const status = statusLine.replace(/^--\s*run status:\s*/i, '') || 'unknown';
    const statsLine = headerLine(/^--\s*\d+\s+statements recorded/i);
    const statsMatch = statsLine.match(/(\d+)\s+statements recorded in\s+(.+)$/i);
    const listAfter = (title) => {
      const index = header.findIndex((line) =>
        line.replace(/^--\s*/, '').trim().toLowerCase() === title.toLowerCase() + ':'
      );
      if (index < 0) return [];
      const values = [];
      for (let i = index + 1; i < header.length && /^--\s{2,}/.test(header[i]); i++) {
        const value = header[i].replace(/^--\s+/, '').trim();
        if (value) values.push(value);
      }
      return [...new Set(values)];
    };
    const urls = listAfter('URLs requested').map((raw) => {
      try {
        const parsed = new URL(raw);
        return parsed.host + parsed.pathname;
      } catch {
        return raw.slice(0, 160);
      }
    });
    const remotes = listAfter('remotes fired/invoked');
    const uniqueCalls = (regex) => [...new Set([...log.matchAll(regex)].map((match) => match[1]).filter(Boolean))];
    const services = uniqueCalls(/\bgame\s*:\s*GetService\s*\(\s*['"]([^'"]+)['"]/gi);
    const instances = uniqueCalls(/\bInstance\s*\.\s*new\s*\(\s*['"]([^'"]+)['"]/gi);
    const countCall = (name) => [...log.matchAll(new RegExp('\\b' + name.replace(/\./g, '\\.') + '\\b', 'g'))].length;
    const apiNames = [
      'getgenv', 'getrenv', 'gethui', 'identifyexecutor', 'getrawmetatable',
      'setrawmetatable', 'hookfunction', 'hookmetamethod', 'newcclosure',
      'checkcaller', 'getgc', 'getreg', 'getconnections', 'firesignal',
      'fireclickdetector', 'fireproximityprompt', 'setclipboard',
      'queue_on_teleport', 'request', 'http_request', 'readfile', 'writefile',
      'appendfile', 'delfile', 'isfile', 'isfolder', 'makefolder', 'listfiles',
      'loadfile', 'dofile', 'loadstring', 'cloneref',
    ];
    const apiCalls = apiNames.map((name) => ({ name, count: countCall(name) })).filter((item) => item.count > 0);
    const remoteCalls = ['FireServer', 'InvokeServer', 'FireClient', 'FireAllClients', 'OnClientEvent', 'OnServerEvent']
      .map((name) => ({ name, count: countCall(name) })).filter((item) => item.count > 0);
    const warnings = header.filter((line) =>
      /warning:|non-standard globals|anti-tamper|aborted:|stopped in an endless loop|script error:/i.test(line)
    ).map((line) => line.replace(/^--\s*/, '').trim());
    if (statusLine && !/^--\s*run status:\s*finished\b/i.test(statusLine)) warnings.unshift(statusLine.replace(/^--\s*/, ''));
    const brief = (items, empty, limit = 650) => {
      if (!items.length) return empty;
      const value = items.slice(0, 10).map((item) =>
        typeof item === 'string' ? item : item.name + ' ×' + item.count
      ).join('\n');
      return (value + (items.length > 10 ? '\n… and ' + (items.length - 10) + ' more' : '')).slice(0, limit);
    };
    const elapsedMs = Date.now() - started;
    const tick = String.fromCharCode(96);
    const description = [
      '**Result:** ' + status,
      '**Input:** ' + formatBytes(Buffer.byteLength(input.source, 'utf8')) +
        ' · SHA-256 ' + tick + sha256Hex(String(input.source)).slice(0, 16) + tick,
      '**Trace:** ' + (statsMatch ? Number(statsMatch[1]).toLocaleString() + ' statements · engine ' + statsMatch[2] : 'statement count unavailable'),
      '**Elapsed:** ' + formatDuration(elapsedMs),
      '',
      'HTTP calls are simulated in the offline sandbox, not sent. A source URL may be downloaded before execution. Only branches reached in this run are shown.',
    ].join('\n');
    const embed = dailyEmbed(
      'Environment log · ' + base,
      description,
      /^finished\b/i.test(status) ? DAILY_COLORS.success : (warnings.length ? DAILY_COLORS.warning : DAILY_COLORS.primary)
    );
    embed.addFields(
      { name: 'Network requests · ' + urls.length, value: brief(urls, 'None recorded.'), inline: true },
      { name: 'Remotes · ' + remotes.length, value: brief(remotes, 'None recorded.'), inline: true },
      {
        name: 'Roblox objects',
        value: ('**Services:** ' + (services.join(', ') || 'none') +
          '\n**Instances:** ' + (instances.join(', ') || 'none')).slice(0, 800),
        inline: false,
      },
      { name: 'Executor / filesystem APIs', value: brief(apiCalls, 'None found.'), inline: true },
      { name: 'Remote method references', value: brief(remoteCalls, 'None found.'), inline: true },
      {
        name: 'Warnings / engine notes',
        value: brief(warnings.concat(result && result.failed
          ? ['Engine note: ' + String(result.failed.message || result.failed).split('\n')[0]]
          : []), 'No warnings recorded.'),
        inline: false,
      }
    );

    const files = [];
    const addParts = (data, filename) => {
      const parts = splitUtf8Buffer(data, MAX_ATTACHMENT_PART_BYTES);
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
    addParts(Buffer.from(log, 'utf8'), base + '_envlog.lua');
    let stringCount = 0;
    try {
      const strings = await fs.readFile(outputPath + '.strings.txt');
      if (strings.length > 0) {
        stringCount = strings.toString('utf8').split(/\r?\n/).filter(Boolean).length;
        addParts(strings, base + '_strings.txt');
      }
    } catch {
      // The strings file is optional; the complete main trace is still attached.
    }
    if (stringCount) embed.addFields({ name: 'Recovered strings', value: stringCount.toLocaleString(), inline: true });
    if (files.length > 10) throw new Error('Trace requires ' + files.length + ' attachments; Discord allows at most 10.');
    await prompt.edit({ embeds: [embed], files });

  } catch (error) {
    await prompt.edit({ embeds: [dailyEmbed('Environment log', String(error.message || error).slice(0, 1500), DAILY_COLORS.danger)] }).catch(() => {});
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true }).catch(() => {});
  }
}

async function sendRobloxEnvironmentLogger(message) {
  const loggerPath = path.join(__dirname, 'scripts', 'roblox-environment-logger.lua');
  const file = await fs.readFile(loggerPath);
  await message.reply({
    embeds: [dailyEmbed(
      'Roblox environment logger',
      'Attached a read-only Luau diagnostic script for Roblox Studio. Run it in a place you own or are authorized to test; results print to the local Output window and are not transmitted.',
      DAILY_COLORS.success
    )],
    files: [new AttachmentBuilder(file, { name: 'roblox_environment_logger.lua' })],
    allowedMentions: { repliedUser: false },
  });
}

function helpText() {
  return [
    'DAILY DEOBF',
    '',
    'COMMANDS',
    '.deobf [URL/file] - analyze protected Lua/Luau; direct HTTP/HTTPS links are supported',
    '.get [URL/file] - scan source and fetch discovered links; direct HTTP/HTTPS links are supported',
    '.purelua',
    '.l [URL/file/code] - environment log: run the script in the offline sandbox and log what it does',
    '.l studio - Roblox Studio environment diagnostic script',
    '.help',
    '',
    'SLASH COMMANDS',
    '/purelua',
    '/obf - choose IronVeil or Dailyfuscator v3; Dailyfuscator supports Light, Standard and Hard profiles',
  ].join('\n');
}



function extractLuaProtectRunnerUrl(sourceText) {
  const text = String(sourceText || '');
  const match = text.match(/(?:local\s+)?_h\s*,\s*_n\s*=\s*["']([a-f0-9]{16,64})["']\s*,\s*\d+/i)
    || text.match(/(?:local\s+)?_h\s*=\s*["']([a-f0-9]{16,64})["']/i);
  if (!match) return null;
  return 'https://exec.luaprotect.dev/api/runner-body/' + match[1];
}

async function sendLuaProtectRunnerBody(message, prompt, sourceText, directUrl = null) {
  const detectedUrl = directUrl || extractLuaProtectRunnerUrl(sourceText);
  if (!detectedUrl) throw new Error('No LuaProtect runner hash or runner-body URL was found in the supplied source.');
  const loaderUrl = new URL(detectedUrl.replace(/[)\]},.;]+$/g, ''));
  const host = loaderUrl.hostname.toLowerCase();
  const isRunnerBody = loaderUrl.protocol === 'https:' &&
    host === 'exec.luaprotect.dev' &&
    /^\/api\/runner-body\/[A-Za-z0-9_-]+\/?$/i.test(loaderUrl.pathname);
  const isCdnRunner = loaderUrl.protocol === 'https:' &&
    host === 'cdn.luaprotect.dev' &&
    /^\/u\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+\/?$/i.test(loaderUrl.pathname);
  if (!isRunnerBody && !isCdnRunner) {
    throw new Error('LuaProtect Fetcher accepts https://cdn.luaprotect.dev/u/{id}/{token} and https://exec.luaprotect.dev/api/runner-body/{hash} URLs.');
  }

  await prompt.edit({
    content: isCdnRunner
      ? '🔄 **LuaProtect Fetcher**\nDownloading the supplied LuaProtect CDN runner link with Roblox/WinInet...'
      : '🔄 **LuaProtect Fetcher**\nExtracted the runner hash. Downloading the matching runner body with Roblox/WinInet...',
    embeds: [],
    components: [],
  });
  const recovered = await fetchLuaProtectLoaderSource(loaderUrl.toString());
  if (recovered === null) throw new Error('This is not a supported LuaProtect runner-body URL.');
  const data = Buffer.from(recovered.endsWith('\n') ? recovered : recovered + '\n', 'utf8');
  if (data.length > MAX_OUTPUT_BYTES) throw new Error('Recovered source exceeds the 18 MB Discord output limit.');

  const outputPath = path.join(os.tmpdir(), 'daily-luaprotect-' + message.id + '.lua');
  try {
    await fs.writeFile(outputPath, data, { mode: 0o600 });
    await message.reply({
      embeds: [dailyEmbed(
        'LuaProtect source downloaded',
        (isCdnRunner ? 'Retrieved the supplied CDN runner link.' : 'Retrieved runner body **' + loaderUrl.pathname.split('/').pop() + '**.') + ' Downloaded ' + formatBytes(data.length) + ' of source.',
        DAILY_COLORS.success
      )],
      files: [new AttachmentBuilder(outputPath, { name: 'luaprotect_runner.lua' })],
      allowedMentions: { repliedUser: false },
    });
    await sendAutomaticPureLuau(message, recovered, 'luaprotect_runner.lua', 'LuaProtect runner fetch');
    await prompt.edit({ content: '✅ LuaProtect source downloaded. The automatic PureLuau pass was also attempted.', components: [] }).catch(() => {});
  } finally {
    await fs.rm(outputPath, { force: true }).catch(() => {});
  }
}

async function processLuaProtectFetcher(message, prompt, input) {
  const combined = String(input.originalText || '') + '\n' + String(input.source || '');
  const rawUrl = input.url || (combined.match(/https?:\/\/[^\s"'<>]+/i) || [])[0];
  return sendLuaProtectRunnerBody(message, prompt, combined, rawUrl || null);
}


async function processJnkIeFetcher(message, prompt, input) {
  const combined = String(input.originalText || '') + '\n' + String(input.source || '');
  const rawUrl = input.url || extractJnkIeDownloadUrl(combined);
  if (!rawUrl) throw new Error('No supported JNKIE public download URL was found in the supplied source.');

  const existingStage1 = input.url && input.responseStatus
    ? String(input.source || '')
    : '';
  await prompt.edit({
    content: '🔄 **JNKIE Fetcher**\nFetching stage one, then posting SCRIPT_KEY to the JNKIE delivery endpoint...',
    embeds: [],
    components: [],
  });

  // Match the toolkit: attempt delivery first without an HWID. If JNKIE
  // explicitly requires one, collect the user's supplied value in DM and retry.
  let result = await fetchJnkIeLoaderSource(rawUrl, combined, existingStage1);
  if (!result) throw new Error('This is not a supported JNKIE public download URL.');

  if (/LDR-DENIED:HWID_REQUIRED/i.test(String(result.deliveryError || result.reason || ''))) {
    let dm;
    try {
      dm = await message.author.send(
        'JNKIE requires an HWID for this loader. Reply to this DM with the HWID supplied by the script provider. ' +
        'Your reply will be used only for this fetch attempt and deleted after it is received. ' +
        'You have 2 minutes. Do not send your Discord password or other account credentials.'
      );
    } catch {
      throw new Error('JNKIE requires an HWID, but I could not DM you. Enable DMs from this server and run .deobf again.');
    }

    const collector = dm.channel.createMessageCollector({
      time: 120_000,
      max: 1,
      filter: (reply) => reply.author.id === message.author.id && !reply.author.bot,
    });
    const supplied = await new Promise((resolve) => {
      collector.on('collect', (reply) => resolve(reply));
      collector.on('end', (collected) => {
        if (!collected.size) resolve(null);
      });
    });
    if (!supplied) throw new Error('Timed out waiting for the HWID DM. Run .deobf again to retry.');

    const hwid = supplied.content.trim();
    await supplied.delete().catch(() => {});
    if (!hwid || hwid.length > 512 || /[\r\n]/.test(hwid)) {
      throw new Error('The supplied HWID was empty or invalid. Run .deobf again.');
    }

    await dm.channel.send('HWID received. Retrying JNKIE delivery now.');
    result = await fetchJnkIeLoaderSource(rawUrl, combined, existingStage1, hwid);
    if (!result) throw new Error('This is not a supported JNKIE public download URL.');
  }

  const data = Buffer.from(result.source.endsWith('\n') ? result.source : result.source + '\n', 'utf8');
  if (data.length > MAX_OUTPUT_BYTES) throw new Error('JNKIE output exceeds the 18 MB Discord output limit.');

  const complete = Boolean(result.complete);
  const filename = complete ? 'jnkie_payload.lua' : 'stage1_loader.lua';
  const files = [new AttachmentBuilder(data, { name: filename })];
  if (result.deliveryError) {
    const errorData = Buffer.from(String(result.deliveryError).slice(0, 4000) + '\n', 'utf8');
    files.push(new AttachmentBuilder(errorData, { name: 'delivery_error.txt' }));
  }

  await message.reply({
    embeds: [dailyEmbed(
      complete ? 'JNKIE payload fetched' : 'JNKIE stage-one loader saved',
      complete
        ? 'Retrieved ' + formatBytes(data.length) + ' from JNKIE delivery. The payload is attached for inspection; review it before running.'
        : 'Saved the stage-one loader. ' + String(result.reason || 'Delivery did not return a payload.') +
          (result.deliveryError ? '\nThe exact delivery response is attached as **delivery_error.txt**.' : ''),
      complete ? DAILY_COLORS.success : DAILY_COLORS.warning
    )],
    files,
    allowedMentions: { repliedUser: false },
  });
  await sendAutomaticPureLuau(
    message,
    result.source,
    filename,
    complete ? 'JNKIE payload fetch' : 'JNKIE stage-one loader fetch'
  );
  await prompt.edit({
    content: complete
      ? '✅ JNKIE payload attached as **' + filename + '**. Automatic PureLuau readability processing was also attempted.'
      : '⚠️ JNKIE stage one attached as **' + filename + '**. Automatic PureLuau readability processing was also attempted; see the delivery response if one was returned.',
    components: [],
  }).catch(() => {});
}

async function processVantarmorFetcher(message, prompt, input) {
  const source = String(input.source || '');
  const originalText = String(input.originalText || '');
  const combinedInput = originalText + '\n' + source;
  const loaderUrlText = input.url || (combinedInput.match(/https?:\/\/[^\s"'<>]+/i) || [])[0];
  let loaderUrl = null;
  if (loaderUrlText) {
    try {
      loaderUrl = new URL(loaderUrlText.replace(/[)\]},.;]+$/g, ''));
    } catch {
      throw new Error('The loader URL is invalid.');
    }
    if (loaderUrl.username || loaderUrl.password || !['https:', 'http:'].includes(loaderUrl.protocol)) {
      throw new Error('The loader URL must be a valid HTTP or HTTPS URL.');
    }
  }

  const isVantarmor = Boolean(loaderUrl && loaderUrl.protocol === 'https:' &&
    loaderUrl.hostname.toLowerCase() === 'vantarmor.up.railway.app' &&
    /^\/files\/v1\/loaders\/[^/]+\.lua$/i.test(loaderUrl.pathname));

  // For other hosts, return exactly what the public loader URL served.
  // Generic loaders do not share a standard API, so never guess vendor endpoints
  // or execute the downloaded script to try to resolve it.
  if (!isVantarmor) {
    const recovered = source.replace(/\r\n/g, '\n');
    if (!recovered.trim()) {
      throw new Error('The loader URL returned an empty response.');
    }
    if (looksLikeViewerPageOrJavaScript(recovered)) {
      throw new Error(
        'That URL returned a website page or its JavaScript viewer (for example, escapeHTML/highlightLua), not the Lua script. Use the raw/direct download URL for the script instead of the webpage URL.'
      );
    }
    if (!loaderUrl) {
      throw new Error('Send a direct HTTP/HTTPS loader URL so the fetcher can test its request methods.');
    }

    await prompt.edit({
      content: '🔄 **Vantarmor and Universal Loader Fetcher**\nFetching the loader and checking supported HTTP request methods...',
      embeds: [],
      components: [],
    });

    const data = Buffer.from(recovered.endsWith('\n') ? recovered : recovered + '\n', 'utf8');
    if (data.length > MAX_OUTPUT_BYTES) {
      throw new Error('Fetched source exceeds the 18 MB Discord output limit.');
    }

    const curlOptions = input.curlOptions || {};
    const results = await probePublicHttpMethods(loaderUrl.toString(), curlOptions);
    const report = [
      'DAILY DEOBF - UNIVERSAL LOADER FETCH REPORT',
      'URL: ' + loaderUrl.toString(),
      'Initial GET: HTTP ' + String(input.responseStatus || 'unknown') + ' (' + String(input.responseContentType || 'unknown') + ')',
      '',
      'Curl-style flags: ' + ((curlOptions.flags || []).join(', ') || 'defaults'),
      'Custom method: ' + String(curlOptions.method || 'GET'),
      'Custom headers: ' + Object.keys(curlOptions.headers || {}).join(', '),
      'Compressed responses: ' + (curlOptions.compressed ? 'enabled (gzip/deflate/br)' : 'disabled'),
      'Timeout: ' + String(curlOptions.maxTime || 15) + ' seconds (connect timeout option: ' + String(curlOptions.connectTimeout || 'default') + ')',
      'Verbose/header/write-out details: included in http_method_report.txt and response attachments.',
      'Redirect following: ' + (curlOptions.followRedirects ? 'enabled' : 'disabled'),
      'HTTP method results:',
      ...results.map((result) => {
        if (result.error) return result.method + ': ERROR - ' + result.error;
        if (result.skipped) return result.method + ': SKIPPED - ' + result.skipped;
        const lines = [result.method + ': HTTP ' + result.status + ' ' + result.statusText];
        for (const [name, value] of result.headers || []) lines.push('  ' + name + ': ' + value);
        if (result.bodyError) lines.push('  Body: ' + result.bodyError);
        else lines.push('  Body bytes: ' + (result.body ? result.body.length : 0));
        return lines.join('\n');
      }),
      '',
      'Curl-style support: -I/--head, -i/--include, -L/--location, -v/--verbose, -X/--request, -H/--header, -d/--data (explicit POST body), -G/--get, -r/--range, -A/--user-agent, -e/--referer, -w/--write-out, -D/--dump-header, -o/--output, -O/--remote-name, --compressed, --max-time and --connect-timeout. -C/--continue-at applies a numeric byte-range offset when supplied.',
      'IANA HTTP method registry inventory (not all are sent): ACL, BASELINE-CONTROL, BIND, CHECKIN, CHECKOUT, CONNECT, COPY, DELETE, GET, HEAD, LABEL, LINK, LOCK, MERGE, MKACTIVITY, MKCALENDAR, MKCOL, MKREDIRECTREF, MKWORKSPACE, MOVE, OPTIONS, ORDERPATCH, PATCH, POST, PRI, PROPFIND, PROPPATCH, PUT, QUERY, REBIND, REPORT, SEARCH, TRACE, UNBIND, UNCHECKOUT, UNLINK, UNLOCK, UPDATE, UPDATEREDIRECTREF, VERSION-CONTROL.',
      'State-changing methods and tunnel/connection methods are listed for reference but not automatically sent.',
      'GraphQL is an API format usually carried over HTTP, not a method; it needs a specific query and endpoint. FTP, SFTP, SMTP, WebSocket and MQTT are separate protocols and are not HTTP methods.',
    ].join('\n');

    const requestedOutputName = curlOptions.outputName || (curlOptions.remoteName ? path.basename(loaderUrl.pathname) : 'fetched_loader.lua');
    const safeOutputName = /^[A-Za-z0-9._-]+$/.test(requestedOutputName) ? requestedOutputName : 'fetched_loader.lua';
    const files = [new AttachmentBuilder(data, { name: safeOutputName })];
    const reportBuffer = Buffer.from(report + '\n', 'utf8');
    files.push(new AttachmentBuilder(reportBuffer, { name: 'http_method_report.txt' }));

    for (const result of results) {
      if (!result.body || !result.body.length || result.bodyError) continue;
      const contentType = String((result.headers || []).find(([name]) => name.toLowerCase() === 'content-type')?.[1] || '');
      const extension = /(?:json|text|xml|javascript|luau|lua)/i.test(contentType) ? 'txt' : 'bin';
      files.push(new AttachmentBuilder(result.body, { name: 'response_' + result.method.toLowerCase() + '.' + extension }));
    }

    await message.reply({
      embeds: [dailyEmbed(
        'Universal loader fetch complete',
        'Fetched ' + formatBytes(data.length) + ' from the loader URL and tested ' + (results.length + 1) +
          ' HTTP methods. The report includes response statuses and useful headers; response bodies are attached when present.',
        DAILY_COLORS.success
      )],
      files: files.slice(0, 10),
      allowedMentions: { repliedUser: false },
    });
    await sendAutomaticPureLuau(message, recovered, safeOutputName, 'universal loader fetch');
    await prompt.edit({
      content: '✅ Loader fetched. HTTP method report, returned response files and the automatic PureLuau result are attached.',
      components: [],
    }).catch(() => {});
    return;
  }

  const hash = loaderUrl.pathname.match(/^\/files\/v1\/loaders\/(.+)\.lua$/i)[1];
  const keyMatch = combinedInput.match(/(?:getgenv\(\)\.script_key|script_key)\s*=\s*["']([^"']+)["']/i);
  const params = new URLSearchParams({ s: hash });
  if (keyMatch && keyMatch[1].trim()) params.set('key', keyMatch[1].trim());
  const hwidMatch = combinedInput.match(/\bhwid\s*=\s*["']([^"']+)["']/i);
  const rbxidMatch = combinedInput.match(/\brbxid\s*=\s*["']([^"']+)["']/i);
  if (hwidMatch) params.set('hwid', hwidMatch[1]);
  if (rbxidMatch) params.set('rbxid', rbxidMatch[1]);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 40000);
  const outputPath = path.join(os.tmpdir(), 'daily-vantarmor-' + message.id + '.lua');

  try {
    await prompt.edit({
      content: '🔄 **Universal Loader Fetcher**\nRetrieving the source returned by the supplied loader URL.',
      embeds: [],
      components: [],
    });
    const response = await fetch(loaderUrl.origin + '/v1/a?' + params.toString(), {
      headers: { 'User-Agent': 'Roblox/WinInet', Accept: '*/*' },
      signal: controller.signal,
    });
    let body = (await response.text()).replace(/\r\n/g, '\n');
    if (!response.ok) {
      if (!keyMatch && (response.status === 401 || response.status === 403)) {
        throw new Error('Vantarmor denied a keyless request. This loader requires a script_key unless its owner enables public access.');
      }
      throw new Error('Vantarmor returned HTTP ' + response.status + '.');
    }
    const errorLine = body.trim().match(/^!VANTARMOR:([A-Z0-9_]+)$/);
    if (errorLine) {
      if (!keyMatch && /KEY|AUTH|TOKEN/.test(errorLine[1])) {
        throw new Error('Vantarmor requires a script_key for this loader. Keyless fetching works only when the owner has enabled public access.');
      }
      throw new Error('Vantarmor rejected the request: ' + errorLine[1] + '.');
    }

    if (body.startsWith('!VANTARMOR:TOKEN\n')) {
      const token = body.slice('!VANTARMOR:TOKEN\n'.length).trim();
      const postResponse = await fetch(loaderUrl.origin + '/v1/p', {
        method: 'POST',
        headers: {
          'User-Agent': 'Roblox/WinInet',
          'Content-Type': 'text/plain',
          Accept: '*/*',
        },
        body: token,
        signal: controller.signal,
      });
      body = (await postResponse.text()).replace(/\r\n/g, '\n');
      if (!postResponse.ok) throw new Error('Vantarmor payload request returned HTTP ' + postResponse.status + '.');
    }

    const payloadError = body.trim().match(/^!VANTARMOR:([A-Z0-9_]+)$/);
    if (payloadError) {
      if (!keyMatch && /KEY|AUTH|TOKEN/.test(payloadError[1])) {
        throw new Error('Vantarmor requires a script_key for this loader. Keyless fetching works only when the owner has enabled public access.');
      }
      throw new Error('Vantarmor rejected the payload: ' + payloadError[1] + '.');
    }
    if (!body.startsWith('!VANTARMOR:CODE\n')) {
      throw new Error('Unexpected Vantarmor response. Expected a CODE or TOKEN response.');
    }

    let recovered = body.slice('!VANTARMOR:CODE\n'.length).replace(/\r\n/g, '\n');
    if (!recovered.trim()) throw new Error('Vantarmor returned an empty source file.');
    if (recovered.startsWith('-- deob by prince')) {
      recovered = '-- Recovered from Vantarmor delivery\n' + recovered.slice('-- deob by prince'.length).replace(/^\n+/, '');
    }
    if (!recovered.endsWith('\n')) recovered += '\n';
    const data = Buffer.from(recovered, 'utf8');
    if (data.length > MAX_OUTPUT_BYTES) throw new Error('Recovered source exceeds the 18 MB Discord output limit.');
    await fs.writeFile(outputPath, data, { mode: 0o600 });
    await message.reply({
      embeds: [dailyEmbed(
        'Vantarmor source fetched',
        'Retrieved ' + formatBytes(data.length) + ' of server-delivered Lua source. This fetches the source returned by Vantarmor; it does not unpack an inner obfuscator or VM.',
        DAILY_COLORS.success
      )],
      files: [new AttachmentBuilder(outputPath, { name: 'vantarmor_recovered.lua' })],
      allowedMentions: { repliedUser: false },
    });
    await sendAutomaticPureLuau(message, recovered, 'vantarmor_recovered.lua', 'Vantarmor source fetch');
    await prompt.edit({ content: '✅ Vantarmor returned the Lua source. The automatic PureLuau readability pass was also attempted.', components: [] }).catch(() => {});
  } finally {
    clearTimeout(timeout);
    await fs.rm(outputPath, { force: true }).catch(() => {});
  }
}

async function resolveDeobfTargetSource(input) {
  const rootSource = String(input && input.source || '');
  if (!rootSource.trim() && !input.url) return null;
  if (/^https?:\/\/\S+$/i.test(rootSource.trim())) return null;

  // Mirror .get: seed the scan with the original URL as well as URLs found
  // inside the downloaded bootstrap. This catches URL chains whose first
  // reference is only represented by the input URL.
  const initialUrls = input.url ? [input.url] : [];
  const resolution = await resolveStaticSources(rootSource, {
    initialUrls,
    maxFiles: MAX_GET_FILES,
    maxUrls: MAX_GET_URLS,
    maxAttempts: MAX_GET_ATTEMPTS,
    maxDepth: 8,
    fetchText: async (rawUrl) => {
      if (input.url && rawUrl === input.url && rootSource.trim()) {
        return {
          source: rootSource,
          finalUrl: input.finalUrl || input.url,
          contentType: input.responseContentType || 'input source',
          status: input.responseStatus || 200,
        };
      }
      const credentialText = String(input.originalText || '') + '\n' + rootSource;
      const luaProtectSource = await fetchLuaProtectLoaderSource(rawUrl);
      if (luaProtectSource !== null) return { source: luaProtectSource, finalUrl: rawUrl, contentType: 'application/lua', status: 200 };
      const vantarmorSource = await fetchVantarmorLoaderSource(rawUrl, credentialText);
      if (vantarmorSource !== null) {
        return {
          source: vantarmorSource,
          finalUrl: rawUrl,
          contentType: 'application/lua',
          status: 200,
        };
      }
      const jnkieResult = await fetchJnkIeLoaderSource(rawUrl, credentialText);
      if (jnkieResult !== null) {
        return {
          source: jnkieResult.source,
          finalUrl: jnkieResult.finalUrl || rawUrl,
          contentType: jnkieResult.complete ? 'application/lua' : 'application/lua; JNKIE stage-one only',
          status: jnkieResult.complete ? 200 : 206,
        };
      }
      const fetched = await fetchPublicText(rawUrl, { forceRobloxUserAgent: true });
      return {
        source: decodeSource(fetched.bytes),
        finalUrl: fetched.finalUrl || rawUrl,
        contentType: fetched.contentType || 'unknown',
        status: fetched.status || null,
      };
    },
  });

  const captureDetails = (resolution.captures || []).map((capture) => {
    const source = String(capture && capture.source || '');
    const bytes = Buffer.byteLength(source, 'utf8');
    const empty = !source.trim();
    const viewerLike = !empty && looksLikeViewerPageOrJavaScript(source, capture && capture.contentType);
    const rootUrl = Boolean(capture && capture.url && input.url && capture.url === input.url && !capture.inline);
    return {
      name: capture && capture.name || 'unnamed',
      bytes,
      depth: Number(capture && capture.depth || 0),
      inline: Boolean(capture && capture.inline),
      url: capture && capture.url || null,
      finalUrl: capture && capture.finalUrl || null,
      contentType: capture && capture.contentType || 'unknown',
      excluded: empty ? 'empty response' : viewerLike ? 'classified as webpage/JavaScript' : rootUrl ? 'original input URL' : null,
    };
  });

  const candidates = (resolution.captures || [])
    .filter((capture) => capture && typeof capture.source === 'string' && capture.source.trim())
    // Some loader endpoints return short control/status bodies (for example
    // "STOP") with HTTP 200. Never mistake those for the actual script.
    .filter((capture) => {
      const body = String(capture.source || '').trim();
      const bytes = Buffer.byteLength(body, 'utf8');
      if (bytes < 32) return false;
      if (/^(?:STOP|WAIT|PENDING|DENIED|ERROR|NOT[_ -]?FOUND|UNAUTHORIZED|FORBIDDEN)$/i.test(body)) return false;
      if (/^(?:LDR-DENIED:|ACCESS_DENIED$|SCRIPT_NOT_FOUND$)/i.test(body)) return false;
      return true;
    })
    .filter((capture) => !looksLikeViewerPageOrJavaScript(capture.source, capture.contentType))
    .map((capture) => {
      const bytes = Buffer.byteLength(capture.source, 'utf8');
      const protectedSource = !isClearlyPlainLuau(capture.source);
      const hasProtectionMarkers = /Luraph|LPH_|IronBrew|MoonSec|Centurion|Prometheus|bit32\.(?:bxor|band|bor)|loadstring\s*\(/i.test(capture.source);
      return { ...capture, bytes, protectedSource, hasProtectionMarkers };
    })
    .sort((left, right) =>
      right.bytes - left.bytes ||
      Number(right.hasProtectionMarkers) - Number(left.hasProtectionMarkers) ||
      Number(right.protectedSource) - Number(left.protectedSource) ||
      right.depth - left.depth
    );

  if (!candidates.length) {
    return {
      selected: null,
      discovered: resolution.discovered || 0,
      fetched: (resolution.captures || []).length,
      failures: (resolution.failures || []).length,
      truncated: Boolean(resolution.truncated),
      failureDetails: (resolution.failures || []).slice(0, 5).map((item) => ({
        url: item.url,
        message: item.message,
      })),
      captureDetails,
    };
  }

  // Prefer a downloaded child over the original root bootstrap. If there are
  // no child captures, keep the root as the fallback and report that fact.
  // Inline loadstring chunks inherit their parent's URL in the resolver,
  // but they are separate source payloads, not the bootstrap itself. Keep
  // those eligible even when their source URL equals the original URL.
  const childCandidates = candidates.filter((capture) =>
    capture.inline || (capture.url && (!input.url || capture.url !== input.url))
  );
  const selected = childCandidates[0] || null;
  if (!selected) {
    return {
      selected: null,
      discovered: resolution.discovered || 0,
      fetched: (resolution.captures || []).length,
      failures: (resolution.failures || []).length,
      truncated: Boolean(resolution.truncated),
      failureDetails: (resolution.failures || []).slice(0, 5).map((item) => ({
        url: item.url,
        message: item.message,
      })),
      captureDetails,
    };
  }

  let filename = selected.name || 'deobf-target.lua';
  try {
    const url = selected.finalUrl || selected.url;
    if (url) filename = path.basename(new URL(url).pathname) || filename;
  } catch {}
  if (!/\.(?:lua|luau|pureluau|txt)$/i.test(filename)) filename += '.lua';

  return {
    selected: {
      source: selected.source,
      filename,
      url: selected.finalUrl || selected.url || null,
      bytes: selected.bytes,
      depth: selected.depth,
    },
    discovered: resolution.discovered || 0,
    fetched: (resolution.captures || []).length,
    failures: (resolution.failures || []).length,
    truncated: Boolean(resolution.truncated),
  };
}

async function startWorkflow(message, inlineText = null) {
  const hasInlineUrl = Boolean(inlineText && /https?:\/\//i.test(inlineText));
  const hasInlineAttachment = Boolean(message.attachments.first());
  const initialDescription = hasInlineUrl
    ? 'Direct URL detected. Downloading the supplied script now...'
    : hasInlineAttachment
      ? 'File received. Reading and validating the uploaded script...'
      : 'Upload a **.lua**, **.luau**, **.pureluau** or **.txt** file, paste source, or send a direct HTTP/HTTPS script URL.\n\n**Maximum input:** 18 MB';
  const prompt = await message.reply({
    embeds: [dailyEmbed('New deobfuscation', initialDescription, DAILY_COLORS.primary)],
    allowedMentions: { repliedUser: false },
  });
  // Accept an attachment, a URL / HttpGet expression on the command,
  // or a URL / HttpGet expression in the follow-up message.
  const firstAttachment = message.attachments.first();
  let repliedMessage = null;
  if (!firstAttachment && message.reference && message.reference.messageId) {
    try {
      repliedMessage = await message.channel.messages.fetch(message.reference.messageId);
    } catch {
      throw new Error('I could not read the message you replied to. Make sure it is still available in this channel.');
    }
  }
  const repliedAttachment = repliedMessage && repliedMessage.attachments
    ? repliedMessage.attachments.first()
    : null;
  const repliedText = repliedMessage ? String(repliedMessage.content || '').trim() : '';
  if (!hasInlineUrl && (repliedAttachment || /https?:\/\//i.test(repliedText))) {
    await prompt.edit({
      embeds: [dailyEmbed(
        repliedAttachment ? 'File received' : 'URL detected',
        repliedAttachment
          ? 'Reading and validating the attached script...'
          : 'Direct URL detected in the message you replied to. Downloading it now...',
        DAILY_COLORS.primary
      )],
      components: [],
    });
  }
  let input;
  try {
    if (firstAttachment) {
      input = await inputFromAttachment(firstAttachment);
    } else if (repliedAttachment) {
      input = await inputFromAttachment(repliedAttachment);
    } else if (repliedText && /https?:\/\//i.test(repliedText)) {
      // Parse the replied message itself, never the ".deobf" command text.
      input = await inputFromUrlText(repliedText, { robloxUserAgent: true });
    } else if (repliedText) {
      input = { source: repliedText, filename: 'replied-script.lua', originalText: repliedText };
    } else {
      input = inlineText ? await inputFromUrlText(inlineText, { robloxUserAgent: true }) : await collectInput(message, prompt);
    }
  } catch (error) {
    const errorText = String(error && error.message || error);
    // Keep the engine picker visible even when URL download fails. The selected
    // engine will request an upload/pasted source only after the user chooses it.
    if (/HTTP 403|Cloudflare browser challenge|Cloudflare Access denied/i.test(errorText)) {
      input = {
        source: '',
        filename: 'pending-script.lua',
        downloadError: errorText,
        pendingUrlFailure: true,
      };
    } else {
      throw error;
    }
  }

  // Send the exact source received (for example get1.lua) before any
  // payload scanning or engine selection. Keep the analysis input unchanged.
  if (input.source && !input.pendingUrlFailure && input.url) {
    const originalName = String(input.filename || 'original-input.lua')
      .replace(/[\\/\\\\]/g, '_')
      .replace(/[\r\n]/g, '')
      .slice(0, 100) || 'original-input.lua';
    try {
      await message.reply({
        content: '**Original file received:** ' + originalName,
        files: [{
          attachment: Buffer.from(String(input.source), 'utf8'),
          name: originalName,
        }],
        allowedMentions: { repliedUser: false },
      });
    } catch (error) {
      await message.reply({
        content: '⚠️ I downloaded the original file, but Discord would not accept the attachment: ' +
          String(error && error.message || error).slice(0, 500),
        allowedMentions: { repliedUser: false },
      }).catch(() => {});
    }
  }

  // LuaProtect stubs are launchers, not the protected payload. Resolve the
  // embedded runner hash before plain-Lua detection or engine selection.
  if (input.source && !input.pendingUrlFailure) {
    const luaProtectRunnerUrl = extractLuaProtectRunnerUrl(input.source);
    if (luaProtectRunnerUrl) {
      await prompt.edit({
        embeds: [dailyEmbed(
          'LuaProtect bootstrap detected',
          'Extracted the runner hash from the stub. Downloading the actual runner body before analysis...',
          DAILY_COLORS.primary
        )],
      });
      const runnerSource = await fetchLuaProtectLoaderSource(luaProtectRunnerUrl);
      if (runnerSource === null) throw new Error('LuaProtect runner URL could not be resolved.');
      input = {
        ...input,
        source: runnerSource,
        filename: 'luaprotect_runner.lua',
        url: luaProtectRunnerUrl,
        originalInput: {
          source: input.source,
          filename: input.filename,
          url: input.url || null,
        },
        selectedTarget: {
          source: runnerSource,
          filename: 'luaprotect_runner.lua',
          url: luaProtectRunnerUrl,
          bytes: Buffer.byteLength(runnerSource, 'utf8'),
          depth: 1,
        },
      };
    }
  }

  let targetResolution = null;
  if (input.source && !input.pendingUrlFailure) {
    try {
      targetResolution = await resolveDeobfTargetSource(input);
      if (targetResolution && targetResolution.selected) {
        const original = {
          source: input.source,
          filename: input.filename,
          url: input.url || null,
        };
        input = {
          ...input,
          source: targetResolution.selected.source,
          filename: targetResolution.selected.filename,
          selectedTarget: targetResolution.selected,
          originalInput: original,
        };
        await prompt.edit({
          embeds: [dailyEmbed(
            'Payload target selected',
            'Found the largest protected Lua payload in the static loader chain at depth ' + targetResolution.selected.depth +
              ' (' + formatBytes(targetResolution.selected.bytes) + '). Using **' +
              targetResolution.selected.filename + '** for the selected deobfuscation engine.',
            DAILY_COLORS.success
          )],
        });
      }
    } catch (error) {
      targetResolution = {
        selected: null,
        error: String(error && error.message || error).slice(0, 500),
      };
    }
  }

  const engineSuggestion = detectEngineSuggestion(input.source);
  const isLuraphSuggestion = Boolean(engineSuggestion && (/^luraph/i.test(engineSuggestion.engine || '') ||
    (!engineSuggestion.engine && (engineSuggestion.alternatives || []).some((id) => /^luraph/.test(id)))));
  const suggestedAlternatives = new Set((engineSuggestion && engineSuggestion.alternatives) || []);
  // Label/style for one engine button: green "Recommended" for the detector's
  // pick, a hint for the runner-up engines, plain otherwise.
  const engineButton = (button, engineId, label) => {
    if (engineSuggestion && engineSuggestion.engine === engineId) return button.setLabel(('Recommended: ' + label).slice(0, 80)).setStyle(ButtonStyle.Success);
    if (suggestedAlternatives.has(engineId)) return button.setLabel(('Also try: ' + label).slice(0, 80)).setStyle(ButtonStyle.Primary);
    return button.setLabel(label).setStyle(ButtonStyle.Secondary);
  };
  const chooseRows = [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`deobf-flowauth:${message.author.id}`)
        .setLabel('FlowAuth')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`deobf-luraph-menu:${message.author.id}`)
        .setLabel(isLuraphSuggestion ? 'Recommended: Luraph' : 'Luraph')
        .setStyle(isLuraphSuggestion ? ButtonStyle.Success : ButtonStyle.Secondary),
      engineButton(new ButtonBuilder()
        .setCustomId(`deobf-centurion:${message.author.id}`), 'centurion', 'Centurion'),
      engineButton(new ButtonBuilder()
        .setCustomId(`deobf-ironbrew1:${message.author.id}`), 'ironbrew1', 'IronBrew 1'),
      engineButton(new ButtonBuilder()
        .setCustomId(`deobf-ironbrew2:${message.author.id}`), 'ironbrew2', 'IronBrew 2'),
    ),
    new ActionRowBuilder().addComponents(
      engineButton(new ButtonBuilder()
        .setCustomId(`deobf-vantarmor:${message.author.id}`), 'vantarmor', 'Vantarmor / Universal'),
      engineButton(new ButtonBuilder()
        .setCustomId(`deobf-luaprotect:${message.author.id}`), 'luaprotect', 'LuaProtect Fetcher'),
      engineButton(new ButtonBuilder()
        .setCustomId(`deobf-jnkie:${message.author.id}`), 'jnkie', 'JNKIE Fetcher'),
      engineButton(new ButtonBuilder()
        .setCustomId(`deobf-fulcrum:${message.author.id}`), 'fulcrum', 'Fulcrum / Polsec'),
      new ButtonBuilder()
        .setCustomId(`deobf-cancel:${message.author.id}`)
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Secondary),
    ),
    new ActionRowBuilder().addComponents(
      engineButton(new ButtonBuilder()
        .setCustomId(`deobf-2hbj:${message.author.id}`), '2hbj', '2HBJ (Experimental)'),
    ),
  ];
  const luraphVersionRows = [
    new ActionRowBuilder().addComponents(
      ...[
        ['14.3', 'luraph-v143', 'Luraph 14.3'],
        ['14.3s', 'luraph-v143-static', 'Luraph 14.3 (Static)'],
        ['14.7', 'luraph-v147', 'Luraph 14.7 (VIP)'],
        ['14.8', 'luraph-v148', 'Luraph 14.8'],
      ].map(([version, engine, label]) => engineButton(new ButtonBuilder()
        .setCustomId(`deobf-luraph-version:${version}:${message.author.id}`), engine, label))
    ),
    new ActionRowBuilder().addComponents(
      ...[
        ['14.9', 'luraph-v149', 'Luraph 14.9'],
        ['15', 'luraph-v15', 'Luraph 15'],
        ['15.1', 'luraph-151', 'Luraph 15.1'],
        ['15.2', 'luraph-152', 'Luraph 15.2'],
      ].map(([version, engine, label]) => engineButton(new ButtonBuilder()
        .setCustomId(`deobf-luraph-version:${version}:${message.author.id}`), engine, label))
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`deobf-luraph-back:${message.author.id}`)
        .setLabel('Back')
        .setStyle(ButtonStyle.Secondary),
    ),
  ];
  const codeMark = String.fromCharCode(96);
  let sourcePreview = String(input.source || '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .slice(0, 5)
    .join('\n');
  sourcePreview = sourcePreview.replace(/\x60\x60\x60/g, "'''");
  if (sourcePreview.length > 900) sourcePreview = sourcePreview.slice(0, 897) + '...';
  if (!sourcePreview.trim()) sourcePreview = '-- No readable preview available';

  const pickerDescription = [
    input.downloadError
      ? '⚠️ **Original URL download error**\n' + input.downloadError.slice(0, 900)
      : null,
    input.pendingUrlFailure
      ? 'The original URL could not be downloaded automatically. Choose an engine, then attach the Lua/Luau file or paste its source.'
      : 'Select a deobfuscator below to analyze the supplied Lua/Luau source.',
    engineSuggestion
      ? '**Detector (' + engineSuggestion.confidence + ' confidence):** ' + engineSuggestion.label +
        (engineSuggestion.engine ? ' → green button is the recommended engine' : ' → no engine here fits this file') +
        ((engineSuggestion.alternatives || []).length ? '; blue buttons are worth trying next' : '') + '.\n' + engineSuggestion.reason
      : '**Detector:** no known obfuscator signature or VM layout was found.',
    '**2HBJ option:** Experimental imported VM decompiler. The bundled mappings are tuned to the supplied sample and may not match every 2HBJ build.',
    '',
    input.pendingUrlFailure ? '**Input ready**' : '**Payload scan complete**',
    input.selectedTarget
      ? 'A larger child payload was selected from the static loader chain.'
      : (targetResolution
        ? 'The static payload scan finished. No child payload was selected automatically, so the original input is kept.'
        : 'The input is ready for engine selection.'),
    input.source ? '' : null,
    input.source ? '**Preview (first 5 lines):**' : null,
    input.source ? codeMark.repeat(3) + 'lua\n' + sourcePreview + '\n' + codeMark.repeat(3) : null,
    targetResolution && targetResolution.error
      ? '**Scan note:** ' + targetResolution.error.slice(0, 300)
      : null,
    targetResolution && targetResolution.captureDetails && targetResolution.captureDetails.length
      ? '**Fetched files:**\n' + targetResolution.captureDetails.slice(0, 4).map((item) =>
          '• ' + String(item.name || 'unnamed').slice(0, 65) + ' · ' + formatBytes(item.bytes) +
          (item.excluded ? ' · ' + item.excluded : '')
        ).join('\n')
      : null,
  ].filter(Boolean).join('\n');

  const pickerEmbed = dailyEmbed('Choose a deobfuscator', pickerDescription, input.downloadError
    ? DAILY_COLORS.warning
    : DAILY_COLORS.primary);
  if (input.filename || input.source) {
    pickerEmbed.addFields({
      name: 'Input file',
      value: codeMark + String(input.filename || 'pasted-script.lua').replace(/[\r\n]/g, '').slice(0, 90) +
        codeMark + ' · ' + formatBytes(Buffer.byteLength(String(input.source || ''), 'utf8')),
      inline: true,
    });
  }
  if (targetResolution) {
    pickerEmbed.addFields({
      name: 'Payload scan',
      value: targetResolution.discovered + ' URL(s) · ' + targetResolution.fetched +
        ' file(s) · ' + targetResolution.failures + ' failed',
      inline: true,
    });
  }
  if (input.selectedTarget) {
    pickerEmbed.addFields({
      name: 'Selected payload',
      value: codeMark + String(input.selectedTarget.filename || 'payload.lua').replace(/[\r\n]/g, '').slice(0, 90) +
        codeMark + ' · ' + formatBytes(input.selectedTarget.bytes) + ' · depth ' + input.selectedTarget.depth,
      inline: false,
    });
  }

  await prompt.edit({
    content: null,
    embeds: [pickerEmbed],
    components: chooseRows,
  });

  const getWorkflowInput = async () => {
    if (input.pendingUrlFailure) {
      const originalError = input.downloadError;
      const supplied = await collectInputAfterUrlFailure(message, prompt, new Error(originalError));
      input = { ...supplied, downloadError: originalError };
    }
    return input;
  };

  const componentCollector = prompt.createMessageComponentCollector({
    time: PICKER_WAIT_MS,
    filter: (interaction) => interaction.user.id === message.author.id,
  });
  componentCollector.on('collect', async (interaction) => {
    if (interaction.customId === `deobf-luraph-menu:${message.author.id}`) {
      const detectedVersion = engineSuggestion && engineSuggestion.label || 'No exact version detected';
      await interaction.update({
        embeds: [dailyEmbed(
          'Choose a Luraph version',
          'Select the version to run. ' + (isLuraphSuggestion ? 'Detector: **' + detectedVersion + '**.' : 'No exact Luraph version was detected; choose the version manually.'),
          DAILY_COLORS.info
        )],
        components: luraphVersionRows,
      });
      return;
    }
    if (interaction.customId === `deobf-luraph-back:${message.author.id}`) {
      await interaction.update({ embeds: [pickerEmbed], components: chooseRows });
      return;
    }
    const luraphVersionMatch = interaction.customId.match(
      new RegExp('^deobf-luraph-version:(14\\.3s|14\\.3|14\\.7|14\\.8|14\\.9|15|15\\.1|15\\.2):' + message.author.id + '$')
    );
    if (luraphVersionMatch) {
      await interaction.deferUpdate();
      componentCollector.stop('selected');
      const version = luraphVersionMatch[1];
      try {
        const selectedInput = await getWorkflowInput();
        if (version === '14.3') await processLuraph143(message, prompt, selectedInput);
        else if (version === '14.3s') await processLuraph143Static(message, prompt, selectedInput);
        else if (version === '14.7') await processLuraph147(message, prompt, selectedInput);
        else if (version === '14.8') await processLuraph148(message, prompt, selectedInput);
        else if (version === '14.9') await processLuraph149(message, prompt, selectedInput);
        else if (version === '15') await processLuraphV15(message, prompt, selectedInput);
        else if (version === '15.2') {
          // v15.2 shares the v15.1 engine's VM family (newest dedicated engine).
          // Its closure/upvalue layout differs, so the lift is best-effort.
          const gameId = await collectLuraphGameId(message, prompt, 'Luraph 15.2');
          await processLuraph151(message, prompt, selectedInput, gameId, '15.2');
        }
        else {
          const gameId = await collectLuraphGameId(message, prompt, 'Luraph 15.1');
          await processLuraph151(message, prompt, selectedInput, gameId);
        }
      } catch (error) {
        await showDeobfFailure(message, prompt, 'Luraph v' + version + ' failed', error);
      }
      return;
    }
    if (interaction.customId === `deobf-vantarmor:${message.author.id}`) {
      await interaction.deferUpdate();
      componentCollector.stop('selected');
      try {
        await processVantarmorFetcher(message, prompt, await getWorkflowInput());
      } catch (error) {
        await showDeobfFailure(message, prompt, 'Universal Loader Fetcher failed', error);
      }
      return;
    }
    if (interaction.customId === 'deobf-luaprotect:' + message.author.id) {
      await interaction.deferUpdate();
      componentCollector.stop('selected');
      try {
        await processLuaProtectFetcher(message, prompt, await getWorkflowInput());
      } catch (error) {
        await showDeobfFailure(message, prompt, 'LuaProtect Fetcher failed', error);
      }
      return;
    }
    if (interaction.customId === `deobf-jnkie:${message.author.id}`) {
      await interaction.deferUpdate();
      componentCollector.stop('selected');
      try {
        await processJnkIeFetcher(message, prompt, await getWorkflowInput());
      } catch (error) {
        await showDeobfFailure(message, prompt, 'JNKIE Fetcher failed', error);
      }
      return;
    }
    if (interaction.customId === `deobf-fulcrum:${message.author.id}`) {
      await interaction.deferUpdate();
      componentCollector.stop('selected');
      try {
        const selected = await getWorkflowInput();
        // Prefer pasted polsec loader+key from original message content when present
        const fromMsg = parsePolsecLoaderPaste(message.content || '');
        const blob = [selected && selected.source, message.content].filter(Boolean).join('\n');
        const polsec = parsePolsecLoaderPaste(blob) || fromMsg;
        if (polsec && polsec.scriptKey) {
          const got = await fetchPolsecPayloadWithKey(polsec.id1, polsec.id2, polsec.scriptKey);
          selected.source = got.source;
          selected.filename = 'polsec-payload.lua';
        }
        // Run through .fulcrum path by writing temp and calling workflow pieces
        const fakeInline = polsec && polsec.scriptKey
          ? ('script_key = "' + polsec.scriptKey + '"\n' + polsec.loaderUrl)
          : null;
        if (fakeInline) {
          await startFulcrumWorkflow(message, fakeInline);
        } else {
          // Analyze provided source as Fulcrum input via attachment-like path
          await startFulcrumWorkflow(message, null);
          // If no attachment, use selected source through a synthetic reply path:
          // fall back: write source and run engine inline
          if (!(message.attachments && message.attachments.size)) {
            const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'daily-fulcrum-btn-'));
            try {
              const inputPath = path.join(workDir, 'input.lua');
              const outputDir = path.join(workDir, 'out');
              await fs.writeFile(inputPath, String(selected.source || ''), 'utf8');
              await runPythonEngine(ENGINE_FULCRUM_DIR, ENGINE_FULCRUM_CLI, inputPath, outputDir, 5 * 60_000);
              const recovered = await fs.readFile(path.join(outputDir, 'recovered.lua'));
              const report = await fs.readFile(path.join(outputDir, 'REPORT.md'));
              await prompt.edit({
                embeds: [dailyEmbed('Fulcrum · Recovery complete', 'Recovered source attached.', DAILY_COLORS.success)],
                files: [
                  new AttachmentBuilder(recovered, { name: 'fulcrum-recovered.lua' }),
                  new AttachmentBuilder(report, { name: 'fulcrum-report.md' }),
                ],
                components: [],
              });
            } finally {
              await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
            }
          }
        }
      } catch (error) {
        await showDeobfFailure(message, prompt, 'Fulcrum / Polsec failed', error);
      }
      return;
    }
    if (interaction.customId === `deobf-luraph-v147:${message.author.id}`) {
      await interaction.deferUpdate();
      componentCollector.stop('selected');
      try {
        await processLuraph147(message, prompt, await getWorkflowInput());
      } catch (error) {
        await showDeobfFailure(message, prompt, 'Luraph v14.7 failed', error);
      }
      return;
    }
    if (interaction.customId === `deobf-luraph-v148:${message.author.id}`) {
      await interaction.deferUpdate();
      componentCollector.stop('selected');
      try {
        await processLuraph148(message, prompt, await getWorkflowInput());
      } catch (error) {
        await showDeobfFailure(message, prompt, 'Luraph v14.8 failed', error);
      }
      return;
    }
    if (interaction.customId === `deobf-luraph-v149:${message.author.id}`) {
      await interaction.deferUpdate();
      componentCollector.stop('selected');
      try {
        await processLuraph149(message, prompt, await getWorkflowInput());
      } catch (error) {
        await showDeobfFailure(message, prompt, 'Luraph v14.9 failed', error);
      }
      return;
    }
    if (interaction.customId === `deobf-luraph-v143:${message.author.id}`) {
      await interaction.deferUpdate();
      componentCollector.stop('selected');
      try {
        await processLuraph143(message, prompt, await getWorkflowInput());
      } catch (error) {
        await showDeobfFailure(message, prompt, 'Luraph v14.3 failed', error);
      }
      return;
    }
    if (interaction.customId === `deobf-cancel:${message.author.id}`) {
      await interaction.update({ content: 'Cancelled.', components: [] });
      componentCollector.stop('cancelled');
      return;
    }
    if (interaction.customId === `deobf-flowauth:${message.author.id}`) {
      await interaction.deferUpdate();
      componentCollector.stop('selected');
      try {
        await processFlowAuth(message, prompt, await getWorkflowInput());
      } catch (error) {
        await showDeobfFailure(message, prompt, 'FlowAuth analysis failed', error);
      }
      return;
    }
    if (interaction.customId === `deobf-ironbrew1:${message.author.id}`) {
      await interaction.deferUpdate();
      componentCollector.stop('selected');
      try {
        await processIronbrew1(message, prompt, await getWorkflowInput());
      } catch (error) {
        await showDeobfFailure(message, prompt, 'IronBrew 1 failed', error);
      }
      return;
    }
    if (interaction.customId === `deobf-ironbrew2:${message.author.id}`) {
      await interaction.deferUpdate();
      componentCollector.stop('selected');
      try {
        await processIronbrew2(message, prompt, await getWorkflowInput());
      } catch (error) {
        await showDeobfFailure(message, prompt, 'IronBrew 2 failed', error);
      }
      return;
    }
    if (interaction.customId === `deobf-2hbj:${message.author.id}`) {
      await interaction.deferUpdate();
      componentCollector.stop('selected');
      try {
        await process2HBJ(message, prompt, await getWorkflowInput());
      } catch (error) {
        await showDeobfFailure(message, prompt, '2HBJ (Experimental) failed', error);
      }
      return;
    }
    if (interaction.customId === `deobf-centurion:${message.author.id}`) {
      await interaction.deferUpdate();
      componentCollector.stop('selected');
      try {
        await processCenturion(message, prompt, await getWorkflowInput());
      } catch (error) {
        await showDeobfFailure(message, prompt, 'Centurion failed', error);
      }
      return;
    }
    if (interaction.customId === `deobf-151:${message.author.id}`) {
      await interaction.deferUpdate();
      componentCollector.stop('selected');
      try {
        const selectedInput = await getWorkflowInput();
        const gameId = await collectLuraphGameId(message, prompt, 'Luraph 15.1');
        await processLuraph151(message, prompt, selectedInput, gameId);
      } catch (error) {
        await showDeobfFailure(message, prompt, 'Luraph 15.1 failed', error);
      }
      return;
    }
    if (interaction.customId === `deobf-luraph-v15:${message.author.id}`) {
      await interaction.deferUpdate();
      componentCollector.stop('selected');
      try {
        await processLuraphV15(message, prompt, await getWorkflowInput());
      } catch (error) {
        await showDeobfFailure(message, prompt, 'Luraph v15 failed', error);
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
  console.log('Prefix commands: .deobf, .get, .help');
  const rest = new REST({ version: '10' }).setToken(TOKEN);
  try {
    const route = commandGuildId
      ? Routes.applicationGuildCommands(readyClient.user.id, commandGuildId)
      : Routes.applicationCommands(readyClient.user.id);
    await rest.put(route, { body: slashCommands });
    console.log('Registered /purelua and /obf slash commands.');
  } catch (error) {
    console.error('Slash-command registration failed:', error.message);
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName === 'purelua') {
    await handlePureLuauCommand(interaction);
    return;
  }
  if (interaction.commandName === 'obf') {
    if (activeUsers.has(interaction.user.id)) {
      await interaction.reply({ content: 'You already have an active job. Finish it or wait for it to expire.', ephemeral: true });
      return;
    }
    activeUsers.add(interaction.user.id);
    try {
      await handleObfuscatorCommand(interaction);
    } finally {
      activeUsers.delete(interaction.user.id);
    }
  }
});

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;

  // Forward replies from users who were contacted through .msg to the command author.
  if (!message.guild && pendingMsgReplies.has(message.author.id)) {
    const requesterId = pendingMsgReplies.get(message.author.id);
    try {
      const requester = await client.users.fetch(requesterId);
      const attachmentLines = [...message.attachments.values()].map((file) => file.url);
      const replyText = String(message.content || '').slice(0, 1500);
      const body = [
        '**Reply received from ' + message.author.username + ':**',
        replyText || (attachmentLines.length ? '(attachment)' : '(empty message)'),
        ...attachmentLines,
      ].join('\n');
      await requester.send({
        content: body.slice(0, 1900),
        allowedMentions: { parse: [] },
      });
    } catch (error) {
      console.error('Could not forward .msg reply:', error.message || error);
    }
    return;
  }
  const content = message.content.trim();
  if (!content) return;
  const parts = content.split(/\s+/);
  const command = parts[0].toLowerCase();
  const subcommand = (parts[1] || '').toLowerCase();


  if (command === '.msg') {
    const recipient = message.mentions.users.first();
    const mentionToken = parts[1] || '';
    const dmText = content.slice(command.length + mentionToken.length + 1).trim();

    if (!recipient || !/^<@!?\d+>$/.test(mentionToken) || !dmText) {
      await message.reply({
        content: 'Usage: .msg @user <message>',
        allowedMentions: { repliedUser: false },
      });
      return;
    }
    if (recipient.id === client.user.id || recipient.bot) {
      await message.reply('Choose a human user to receive the DM.');
      return;
    }
    if (dmText.length > 1800) {
      await message.reply('Message is too long. Keep it under 1800 characters.');
      return;
    }

    try {
      await recipient.send({
        content: dmText + '\n\n— automated message',
        allowedMentions: { parse: [] },
      });
      pendingMsgReplies.set(recipient.id, message.author.id);
      await message.reply({
        content: 'DM sent to **' + recipient.username + '**.',
        allowedMentions: { repliedUser: false },
      });
    } catch (error) {
      await message.reply({
        content: 'Could not DM that user. They may have DMs disabled or may not share a server with the bot.',
        allowedMentions: { repliedUser: false },
      });
    }
    return;
  }

  if (command === '.fulcrum') {
    if (!message.guild || !message.guild.ownerId) {
      await message.reply({
        content: '.fulcrum is available only inside a Discord server.',
        allowedMentions: { repliedUser: false },
      });
      return;
    }
    if (message.author.id !== message.guild.ownerId) {
      await message.reply({
        content: 'Only this Discord server owner can use .fulcrum.',
        allowedMentions: { repliedUser: false },
      });
      return;
    }
    const inlineInput = content.slice(parts[0].length).trim() || null;
    if (activeUsers.has(message.author.id)) {
      await message.reply('You already have an active job. Finish it or wait for it to expire.');
      return;
    }
    activeUsers.add(message.author.id);
    try {
      await startFulcrumWorkflow(message, inlineInput);
    } finally {
      activeUsers.delete(message.author.id);
    }
    return;
  }

  if (command === '.l') {
    if (subcommand === 'studio') {
      // the old .l: a read-only Studio diagnostic script
      try {
        await sendRobloxEnvironmentLogger(message);
      } catch (error) {
        await message.reply('Roblox environment logger failed: ' + String(error && error.message || error).slice(0, 500))
          .catch(() => {});
      }
      return;
    }
    if (activeUsers.has(message.author.id)) {
      await message.reply('You already have an active job. Finish it or wait for it to expire.');
      return;
    }
    activeUsers.add(message.author.id);
    try {
      await startEnvLogWorkflow(message, content.slice(parts[0].length).trim() || null);
    } catch (error) {
      await message.reply('Environment log failed: ' + String(error && error.message || error).slice(0, 500)).catch(() => {});
    } finally {
      activeUsers.delete(message.author.id);
    }
    return;
  }

  if (command === '.help') {
    if (parts.length > 1) {
      await message.reply('Use .help by itself.');
      return;
    }
    await message.reply({ embeds: [dailyEmbed('Command list', helpText(), DAILY_COLORS.primary)], allowedMentions: { repliedUser: false } });
    return;
  }

  if (command === '.purelua' || command === '.pureluau') {
    if (activeUsers.has(message.author.id)) {
      await message.reply('You already have an active job. Finish it or wait for it to expire.');
      return;
    }
    activeUsers.add(message.author.id);
    try {
      const pastedSource = content.slice(command.length).trim() || null;
      await handlePureLuauPrefixCommand(message, pastedSource);
    } catch (error) {
      await message.reply('PureLuau failed: ' + String(error.message || error).slice(0, 1200)).catch(() => {});
    } finally {
      activeUsers.delete(message.author.id);
    }
    return;
  }

  if (command === '.get') {
    const inlineSource = content.slice(command.length).trim();
    if (activeUsers.has(message.author.id)) {
      await message.reply('You already have an active .deobf or .get job. Finish it or wait for it to expire.');
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

  if (command !== PREFIX) return;
  const inlineInput = content.slice(command.length).trim();
  if (activeUsers.has(message.author.id)) {
    await message.reply('You already have an active .deobf or .get job. Finish it or wait for it to expire.');
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
