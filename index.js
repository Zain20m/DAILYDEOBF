'use strict';

// Separate Python v15 and beta 15.1 pipelines with live analysis progress.

const {
  ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle, ChannelType, EmbedBuilder,
  Client, Events, GatewayIntentBits, Partials, PermissionFlagsBits,
  REST, Routes, SlashCommandBuilder,
} = require('discord.js');
const { spawn } = require('node:child_process');
const dns = require('node:dns').promises;
const net = require('node:net');
const http = require('node:http');
const https = require('node:https');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const zlib = require('node:zlib');
const { inspectLiftText } = require('./scripts/lift-validation');
const { convertToPureLuau } = require('./pureluau');
const { createAutomaticPureLuauResult } = require('./scripts/automatic-pureluau');
const { detectFlowAuthLuraphVersion } = require('./scripts/flowauth-version');
const { detectIronBrewSuggestion } = require('./scripts/ironbrew-detection');
const { repairIronVeilSource } = require('./scripts/ironveil-auto-repair');
const {
  resolveStaticSources,
  suggestLoadstringHttpGetCorrection,
} = require('./scripts/idx-resolver');

const TOKEN = process.env.DISCORD_TOKEN;
const PREFIX = '.deobf';
const MAX_OUTPUT_BYTES = 18 * 1024 * 1024;
const MAX_INPUT_BYTES = 18 * 1024 * 1024;
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
const activeUsers = new Set();
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
      .addChoices({ name: 'IronVeil', value: 'ironveil' }))
    .addAttachmentOption((option) => option
      .setName('file')
      .setDescription('Upload the source file to obfuscate')
      .setRequired(true))
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
    const needsRobloxUA =
      host === 'cdn.luaprotect.dev' ||
      host === 'exec.luaprotect.dev' ||
      host.endsWith('.luaprotect.dev') ||
      host === 'jnkie.com' ||
      host.endsWith('.jnkie.com') ||
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
        response = await requestPinnedAddress(current, address, { method: curlOptions.method || 'GET', headers: requestHeaders, body: curlOptions.body, compressed: curlOptions.compressed, maxTime: curlOptions.maxTime, connectTimeout: curlOptions.connectTimeout });
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
        response = await requestPinnedAddress(url, address, { method, headers: { ...(curlOptions.headers || {}), ...headers }, body, compressed: curlOptions.compressed, maxTime: curlOptions.maxTime, connectTimeout: curlOptions.connectTimeout });
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
  const curlOptions = parseCurlStyleOptions(text);
  if (curlOptions.queryData) for (const [key, value] of new URLSearchParams(curlOptions.queryData)) parsed.searchParams.append(key, value);
  const result = await fetchPublicText(parsed.toString(), { headers: curlOptions.headers, compressed: curlOptions.compressed, maxTime: curlOptions.maxTime });
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

function detectEngineSuggestion(source) {
  const text = String(source || '');
  const ironbrewSuggestion = detectIronBrewSuggestion(text);
  if (ironbrewSuggestion) return ironbrewSuggestion;

  const banner = text.match(/(?:This file was protected using|Protected by)\s*[:\-]?\s*Luraph(?:\s+Obfuscator)?\s+v?(\d+(?:\.\d+)?)/i) ||
    text.match(/\bLuraph(?:\s+Obfuscator)?\s+v?(\d+(?:\.\d+)?)/i);

  if (banner) {
    const version = banner[1];
    if (version === '15' || version === '15.0') {
      return { engine: 'luraph-v15', label: 'Luraph v15', confidence: 'high', reason: 'The source contains an explicit Luraph v15 version banner.' };
    }
    if (version === '15.1') {
      return { engine: 'luraph-151', label: 'Luraph 15.1', confidence: 'high', reason: 'The source contains an explicit Luraph 15.1 version banner.' };
    }
    if (version === '14.7') {
      return { engine: 'luraph-v147', label: 'Luraph 14.7', confidence: 'high', reason: 'The source contains an explicit Luraph v14.7 version banner.' };
    }
    if (version === '14.8') {
      return { engine: 'luraph-v148', label: 'Luraph 14.8', confidence: 'high', reason: 'The source contains an explicit Luraph v14.8 version banner.' };
    }
    if (version === '14.9') {
      return { engine: 'luraph-v149', label: 'Luraph 14.9', confidence: 'high', reason: 'The source contains an explicit Luraph v14.9 version banner.' };
    }
    if (version === '14.3') {
      return { engine: 'luraph-v143', label: 'Luraph 14.3 static analysis', confidence: 'high', reason: 'The source contains an explicit Luraph v14.3 version banner. The available archive provides static payload decoding.' };
    }
  }

  if (/\b(?:LPH_ATTRIBUTES|LPH_PRECHECK|LPH_ASSUME|LPH_ENCBUF)\b/.test(text)) {
    return { engine: 'luraph-151', label: 'Luraph 15.1', confidence: 'medium', reason: 'The source contains Luraph 15.1 macro markers.' };
  }

  if (/\bThis file was protected using Luraph\b|\bLuraph Obfuscator\b/i.test(text)) {
    return { engine: null, label: 'Luraph', confidence: 'medium', reason: 'A Luraph marker was found, but the exact version could not be identified.' };
  }

  return null;
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
  if (bytes >= 1024) return Math.round(bytes / 1024) + ' KB';
  return bytes + ' bytes';
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

const DAILY_DEOBF_HEADER = '--deobf by daily deobf';

async function prependDailyDeobfHeader(filePath) {
  const source = (await fs.readFile(filePath, 'utf8')).replace(/^\uFEFF/, '');
  if (source.split(/\r?\n/, 1)[0].trim().toLowerCase() === DAILY_DEOBF_HEADER) return;
  await fs.writeFile(filePath, DAILY_DEOBF_HEADER + '\n' + source.replace(/^(?:\r?\n)+/, ''), 'utf8');
}

async function sendAutomaticPureLuau(message, sourceText, originalName, contextLabel) {
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
  const displayLabel = /^Luraph\b/i.test(label) ? 'Luraph' : label;
  const payloadLabel = /^Luraph\b/i.test(label)
    ? 'Decrypting the Luraph payload'
    : 'Decrypting the protected payload';
  const stages = [
    payloadLabel,
    'Lifting VM functions',
    'Validating and packaging output',
  ];
  const loadingEmoji = '🔄';
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
    if (nextPhase) {
      const next = String(nextPhase);
      if (next !== phase) phaseStartedAt = Date.now();
      phase = next;
      const nextStage = stageFor(phase);
      if (nextStage !== null) stageIndex = Math.max(stageIndex, nextStage);
    }
    if (nextDetail) detail = String(nextDetail);
  }

  function updateCount(value, unit) {
    const count = Number(String(value).replaceAll(',', ''));
    if (!Number.isFinite(count) || count < 0) return;
    workCount = Math.floor(count);
    workLabel = unit || 'VM functions processed';
  }

  function render() {
    const elapsed = Date.now() - startedAt;
    const heading = failed
      ? '## ❌ ' + displayLabel + ' Deobfuscator stopped'
      : (completed
        ? '## ' + doneEmoji + ' ' + displayLabel + ' Deobfuscator finished'
        : '## ' + loadingEmoji + ' Running ' + displayLabel + ' Deobfuscator');
    const lines = [heading, 'Working on your sample.', ''];

    for (let i = 0; i < stages.length; i++) {
      const marker = completed || i < stageIndex
        ? doneEmoji
        : (i === stageIndex ? (failed ? '❌' : loadingEmoji) : '▫');
      const title = i === stageIndex && !completed
        ? '**' + stages[i] + '**'
        : stages[i];
      lines.push(marker + ' ' + title);
    }

    lines.push('');
    const elapsedText = (elapsed / 1000).toFixed(1) + 's elapsed';
    lines.push('-# ' + (workCount === null
      ? elapsedText
      : workCount.toLocaleString('en-US') + ' ' + workLabel + ' • ' + elapsedText));
    if (failed && detail) lines.push('', '-# Error: ' + detail.slice(0, 240));
    if (!failed && !completed) {
      const now = Date.now();
      const silentForMs = now - lastEngineOutputAt;
      const phaseForMs = now - phaseStartedAt;
      lines.push('', '-# Stage: ' + phase.slice(0, 140));
      lines.push('-# Time in this stage: ' + formatDuration(phaseForMs));
      if (detail) lines.push('-# ' + detail.slice(0, 220));
      if (lastDiagnosticLine) lines.push('-# Last diagnostic: ' + lastDiagnosticLine.slice(0, 180));
      if (lastErrorLine) lines.push('-# Engine warning/error: ' + lastErrorLine.slice(0, 180));
      if (silentForMs >= 20_000) {
        lines.push('-# ⏳ No new engine output for ' + formatDuration(silentForMs) + '. The subprocess has not reported completion; its configured timeout is still active.');
      }
    }
    if (candidateProgress.size) {
      lines.push('', '-# Candidate activity:');
      for (const [name, status] of candidateProgress) {
        lines.push('-# ' + name + ': ' + status.slice(0, 150));
      }
    }
    if (statusEditError) lines.push('-# Status update warning: ' + statusEditError.slice(0, 140));
    return lines.join('\n');
  }

  async function publish(force = false) {
    if (stopped && !force) return;
    const now = Date.now();
    if (!force && now - lastEdit < 2500) return;
    if (editing) return;
    editing = true;
    lastEdit = now;
    try {
      await prompt.edit({ content: render(), embeds: [], components: [] });
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
    lastDiagnosticLine = (candidatePrefix + line).slice(0, 220);
    if (/\b(error|exception|traceback|failed|fatal)\b/i.test(line)) {
      lastErrorLine = (candidatePrefix + line).slice(0, 220);
    }
    let match;

    if ((match = line.match(/obfuscator:\s*(.+)/i))) {
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

    child.stdout.on('data', (chunk) => {
      if (stdout.length < 512_000) stdout += chunk.toString().slice(0, 512_000 - stdout.length);
    });

    child.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      if (stderr.length < 512_000) stderr += text.slice(0, 512_000 - stderr.length);
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
      error.stdout = stdout;
      error.stderr = stderr;
      reject(error);
    });

    child.once('close', (code, signal) => {
      clearTimeout(timer);
      if (pendingStderr.trim() && options.onProgress) options.onProgress(pendingStderr.trim());
      if (timedOut || signal === 'SIGKILL') {
        const error = new Error('The engine exceeded its ' + formatDuration(timeoutMs) + ' processing limit.');
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

function runPythonEngine(engineDir, engineCli, inputPath, outputPath, timeoutMs, extraArgs = [], options = {}) {
  const python = process.env.PYTHON_BIN || (process.platform === 'win32' ? 'python' : 'python3');
  return runCommand(python, [engineCli, inputPath, '-o', outputPath, ...extraArgs], engineDir, timeoutMs, options);
}

async function startFulcrumWorkflow(message) {
  const attachment = message.attachments.first() || null;
  if (!attachment) {
    await message.reply({
      content: 'Usage: attach one Lua/Luau source file and send .fulcrum.',
      allowedMentions: { repliedUser: false },
    });
    return;
  }
  if (!/\.(?:lua|luau|txt)$/i.test(String(attachment.name || ''))) {
    await message.reply({
      content: 'Fulcrum accepts .lua, .luau and .txt source files only.',
      allowedMentions: { repliedUser: false },
    });
    return;
  }

  const prompt = await message.reply({
    embeds: [dailyEmbed(
      'Fulcrum · Processing',
      'Running static Fulcrum analysis on the attached Luau source. The protected program is not executed.',
      DAILY_COLORS.primary
    )],
    allowedMentions: { repliedUser: false },
  });
  let workDir = null;
  try {
    const input = await inputFromAttachment(attachment);
    workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'daily-fulcrum-'));
    const inputPath = path.join(workDir, 'input.lua');
    const outputDir = path.join(workDir, 'out');
    await fs.writeFile(inputPath, input.source, { encoding: 'utf8', mode: 0o600 });

    await runPythonEngine(
      ENGINE_FULCRUM_DIR,
      ENGINE_FULCRUM_CLI,
      inputPath,
      outputDir,
      5 * 60_000
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
  if (reportBytes > 0 && attachmentBytes + reportBytes <= MAX_OUTPUT_BYTES) {
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
    if (attachedChunkCount >= 8) break;
    if (attachmentBytes + chunk.bytes > MAX_OUTPUT_BYTES) continue;
    attachments.push(new AttachmentBuilder(chunk.path, { name: chunk.name }));
    attachmentBytes += chunk.bytes;
    attachedChunkCount++;
  }

  if (!attachments.length) throw new Error('The engine did not produce a Luau output file.');

  const safeName = String(input.filename || 'script.lua').replaceAll(String.fromCharCode(96), '');
  let summary;
  if (environmentProbeOnly) {
    summary = '**DAILY DEOBF · ' + config.label + '**\n⚠️ Environment compatibility check failed (PC-R01) before payload execution.\nThis is probe output, not deobfuscated source.\nDynamic VM chunks attached: ' + attachedChunkCount + '.\nAttached: environment_probe_partial.txt and analysis-report.txt.';
  } else if (hasLiftedSource) {
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
      '\nAttached: runtime_trace.luau (trace only, not reconstructed source), analysis-report.txt, and ' +
      attachedChunkCount + ' dynamic VM chunk(s).';
  }

  if (candidateParts.length) {
    summary = summary.replace(/Attached: .*$/, 'Attached: ' + candidateParts.length +
      ' ordered parts of ' + candidateOutputName + '.');
    summary += '\nThe file exceeded one attachment. Join the parts in numeric order to rebuild it.';
  }

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

async function processLuraph14x(message, prompt, input, version) {
  const versionTag = version.replace('.', '');
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

    const result = await runPythonEngine(
      ENGINE_V147_DIR,
      ENGINE_V147_CLI,
      inputPath,
      outputPath,
      ENGINE_TIMEOUT_MS,
      [
        '--engine', version,
        '--strings',
        '--max-runs', '16',
        '--devirt-rounds', '200',
        '--budget', '60',
        '--timeout', '180',
      ],
      {
        env: {
          DEVIRT_FULL_ROUNDS: '1',
          DEVIRT_TIMING: '1',
          DEVIRT_ERRS: '1',
          DEVIRT_TB: '1',
          DEVIRT_WALK_LIMIT: '750000',
        },
        onProgress: progress.onLine,
      },
    );

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

    await prependDailyDeobfHeader(outputPath);
    const diagnostic = String(result.stderr || result.stdout || '').slice(-10000);
    const report = [
      'DAILY DEOBF · Luraph v' + version,
      'Input: ' + input.filename,
      'Result: dedicated v' + version + ' VM devirtualization',
      'Output bytes: ' + stat.size,
      '',
      'Engine diagnostics:',
      diagnostic || '(No diagnostic output was emitted.)',
      '',
      'The recovered Luau is a best-effort reconstruction. VM paths or constants that were not captured may remain incomplete.',
    ].join('\n');
    await fs.writeFile(reportPath, report, 'utf8');

    await message.reply({
      content: '✅ **DAILY DEOBF · Luraph v' + version + '**\nDedicated v' + version + ' engine finished.\nOutput size: ' +
        formatBytes(stat.size) + '\nAttached: Luraph' + versionTag + '_deobfuscated.luau and engine report.',
      files: [
        new AttachmentBuilder(outputPath, { name: 'Luraph' + versionTag + '_deobfuscated.luau' }),
        new AttachmentBuilder(reportPath, { name: 'Luraph' + versionTag + '_report.txt' }),
      ],
      allowedMentions: { repliedUser: false },
    });
    await sendAutomaticPureLuau(
      message,
      await fs.readFile(outputPath, 'utf8'),
      'Luraph' + versionTag + '_deobfuscated.luau',
      'Luraph v' + version + ' deobfuscation'
    );
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


async function processLuraph147(message, prompt, input) {
  return processLuraph14x(message, prompt, input, '14.7');
}

async function processLuraph148(message, prompt, input) {
  return processLuraph14x(message, prompt, input, '14.8');
}

async function processLuraph149(message, prompt, input) {
  return processLuraph14x(message, prompt, input, '14.9');
}

async function processLuraph143(message, prompt, input) {
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
        '--debug', '--strings', '--no-pypy', '--timeout', '120',
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
        (diagnostic ? '\\n' + diagnostic : '')
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
    const stats = String(result.stderr || '').match(/(\\d+) functions, (\\d+) unlifted blocks, (\\d+) unstructured jumps/);
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
      content: '✅ **DAILY DEOBF · IronBrew 1**\\nDetected: IronBrew 1' +
        '\\nResult: ' + (useLift ? 'VM bytecode lift' : 'behaviour trace fallback') +
        '\\nOutput size: ' + formatBytes(selectedBytes) +
        (stats ? '\\nLifted functions: ' + stats[1] + ' · Unlifted blocks: ' + stats[2] : '') +
        '\\nAttached: ' + (useLift ? 'IronBrew1_devirtualized.luau' : 'IronBrew1_trace.luau') +
        '\\n\\nReconstruction is not guaranteed to be complete; check the report and trace.',
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

  const dedicated = await prepare('selected-v' + version);
  const selectedEngineDir = version === '15' ? ENGINE_V15_DIR : ENGINE_151_DIR;
  const inputBytes = Buffer.byteLength(input.source, 'utf8');
  const progress = createAnalysisProgress(prompt, input.filename, inputBytes, 'Luraph v' + version);
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
      let result;
      if (version === '15') {
        // The legacy v15 button runs the legacy Python engine directly.
        // It is no longer silently used as a fallback for a 15.1 selection.
        result = await runPythonEngine(
          selectedEngineDir,
          ENGINE_V15_CLI,
          dedicated.inputPath,
          dedicated.outputPath,
          420_000,
          [
            '--obfuscator', 'luraph_v15',
            '--debug',
            '--strings',
            '--max-runs', '16',
            '--devirt-rounds', '200',
            '--budget', '60',
            '--timeout', '120',
            '--no-pypy',
            ...(gameId ? ['--cfg', '__superz_game_id=' + gameId] : []),
          ],
          {
            env: {
              DEVIRT_LOADERS: '1',
              DEVIRT_ALL_PROTOS: '1',
              DEVIRT_FULL_ROUNDS: '1',
              DEVIRT_TIMING: '1',
              DEVIRT_ERRS: '1',
              DEVIRT_TB: '1',
              DEVIRT_WALK_LIMIT: '750000',
              DEVIRT_WALK_RESTARTS: '96',
              DEVIRT_MAX_STACK_DEPTHS: '12',
              DEVIRT_STACK_WALK_MAX: '60000',
            },
            onProgress: progress.onLine,
          },
        );
      } else {
        result = await runEngine(
          selectedEngineDir,
          ENGINE_151_CLI,
          dedicated.inputPath,
          dedicated.outputPath,
          180_000,
          false,
          [
            '--plugin', 'luraph_v15',
            '--debug',
            '--strings',
            '--max-runs', '16',
            '--devirt-rounds', '200',
            '--budget', '60',
            '--timeout', '180',
            ...(gameId ? ['--cfg-json', JSON.stringify({ __superz_game_id: Number(gameId) })] : []),
          ],
          {
            env: {
              // Keep the seed search enabled, but bound every parallel candidate.
              DEOB_FAST: '',
              DEOB_CANDIDATE_TIMEOUT_MS: '120000',
              DEOB_CANDIDATE_IDLE_TIMEOUT_MS: '75000',
              DEVIRT_LOADERS: '1',
              DEVIRT_FULL_ROUNDS: '1',
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
        version === '15.1'
          ? 'Only the dedicated v15.1 engine was run. To try legacy v15, select Luraph v15 from the engine picker; it is now an explicit separate run.'
          : 'Only the legacy v15 engine was run, because Luraph v15 was selected explicitly.',
        'The checklist is an instruction for a separate reconstruction pass, not proof that every item was automatically completed.',
        ...(gameId ? ['Target Universe/GameId supplied to the sandbox: ' + gameId + '.'] : ['No target Universe/GameId was supplied; game-locked builds may stop in their bootstrap layer.']),
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
    { name: 'Size', value: formatBytes(attachment.data.length), inline: true },
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
      const credentialText = String(input.originalText || '') + '\\n' + String(input.source || '');
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
    if (totalBytes + data.length > MAX_GET_OUTPUT_BYTES) {
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
    if (item.correctedFrom) {
      details.push('auto-fixed=' + reportUrl(item.correctedFrom) + ' -> ' + reportUrl(item.url));
    }
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
    'Malformed URL candidates auto-corrected: ' + ((resolution.normalizations || []).length),
    'Remaining queued URLs: ' + (resolution.remaining || 0),
    'Additional URLs omitted by discovery cap: ' + (resolution.omittedDiscoveries || 0),
    'URLs found at maximum depth (not fetched): ' + (resolution.discoveries || []).filter((item) => item.status === 'depth-limit').length,
    'Output files attached: ' + attachments.length,
    'Output data attached: ' + formatBytes(totalBytes),
    'Output files omitted by combined size limit: ' + omittedNames.length,
    'Truncated by configured safety limits: ' + (resolution.truncated ? 'YES' : 'NO'),
    'Limits: max files=' + resolution.maxFiles +
      ', max discovered URLs=' + resolution.maxUrls +
      ', max attempts=' + resolution.maxAttempts +
      ', max depth=' + resolution.maxDepth,
    '',
    'HTTP SPY · STATIC CALL SITES',
    'Calls found: ' + uniqueSpyEntries.length,
    ...(httpSpyLines.length ? httpSpyLines : ['No recognizable HTTP call sites found.']),
    'Static mode does not execute the script; dynamic URLs are shown as <dynamic URL>.',
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
    'The universal fetcher is used for public HTTP/HTTPS GET downloads. .get accepts curl-style -H/--header, -A/--user-agent, -e/--referer, -r/--range, --compressed, -L/--location, --max-time and --connect-timeout options for the root URL.',
    'Use -G with -d/--data to append query parameters. .get does not replay POST, PUT, DELETE, TRACE or other request methods found in source; it only retrieves source with GET. The script is never executed.',
    'Unmatched source-call punctuation such as ))(), ))(, or dangling brackets is removed from URL candidates before validation and fetching; the cleaned URL is the one actually requested.',
    'POST/PUT/DELETE request bodies are not replayed. A URL found inside such request configuration is treated as a URL candidate and GET is attempted only.',
    'Redirect destinations are rechecked for public-address safety. Common GitHub blob links are converted to raw file links.',
    'Query strings and credentials are redacted in this report to avoid leaking tokens.',
    'Static scanning cannot evaluate encrypted URLs, runtime concatenation dependent on values, generated signatures, game state or dynamically returned URLs.',
    '',
  ];

  const reportBuffer = Buffer.from(reportLines.join('\n'), 'utf8');
  const runtimeSpyPath = path.join(__dirname, 'examples', 'http-spy.luau');
  const runtimeSpyBuffer = await fs.readFile(runtimeSpyPath).catch(() => null);
  const runtimeSpyFile = runtimeSpyBuffer
    ? new AttachmentBuilder(runtimeSpyBuffer, { name: 'http-spy-runtime.luau' })
    : null;
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
    const reason = resolution.failures.length
      ? 'Every discovered URL failed to download. The attached report contains the exact HTTP, DNS, TLS or content error for each URL.'
      : 'URLs were found, but no readable source files were returned. The attached report lists the discovery results.';
    const failureEmbed = dailyEmbed(
      'No script fetched',
      reason + '\n\n**Detection complete**\nThe static scan finished without a downloadable source file.',
      DAILY_COLORS.warning
    ).addFields(
      { name: 'URLs found', value: String(resolution.discovered), inline: true },
      { name: 'Fetch attempts', value: String(resolution.attempts), inline: true },
      { name: 'Failed URLs', value: String(resolution.failures.length), inline: true }
    );
    await message.reply({
      embeds: [failureEmbed],
      files: [new AttachmentBuilder(reportBuffer, { name: 'get_report.txt' }), ...(runtimeSpyFile ? [runtimeSpyFile] : [])],
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

    await message.reply({
      embeds: [dailyEmbed(
        'Fetch report',
        'The complete URL-by-URL scan report is attached separately.',
        DAILY_COLORS.primary
      ).addFields(
        { name: 'URLs discovered', value: String(resolution.discovered), inline: true },
        { name: 'Fetch attempts', value: String(resolution.attempts), inline: true },
        { name: 'Failed URLs', value: String(resolution.failures.length), inline: true },
        { name: 'Source files', value: String(attachments.length), inline: true },
        { name: 'Downloaded data', value: formatBytes(totalBytes), inline: true }
      )],
      files: [new AttachmentBuilder(reportBuffer, { name: 'get_report.txt' }), ...(runtimeSpyFile ? [runtimeSpyFile] : [])],
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

async function handleObfuscatorCommand(interaction) {
  const engine = interaction.options.getString('obfuscator');
  const attachment = interaction.options.getAttachment('file');
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
    '.l - generate a Roblox Studio environment diagnostic script',
    '.help',
    '',
    'SLASH COMMANDS',
    '/purelua',
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
      ? '🔄 **LuaProtect Fetcher**\\nDownloading the supplied LuaProtect CDN runner link with Roblox/WinInet...'
      : '🔄 **LuaProtect Fetcher**\\nExtracted the runner hash. Downloading the matching runner body with Roblox/WinInet...',
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
    if (!hwid || hwid.length > 512 || /[\\r\\n]/.test(hwid)) {
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
      const fetched = await fetchPublicText(rawUrl, {});
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
  const prompt = await message.reply({
    embeds: [dailyEmbed('New deobfuscation', 'Upload a **.lua**, **.luau**, **.pureluau** or **.txt** file, paste source, or send a direct HTTP/HTTPS script URL.\n\n**Maximum input:** 18 MB', DAILY_COLORS.primary)],
    allowedMentions: { repliedUser: false },
  });
  // Accept an attachment, a URL / HttpGet expression on the command,
  // or a URL / HttpGet expression in the follow-up message.
  const firstAttachment = message.attachments.first();
  let input;
  try {
    input = firstAttachment
      ? await inputFromAttachment(firstAttachment)
      : (inlineText ? await inputFromUrlText(inlineText) : await collectInput(message, prompt));
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

  if (input.source && isClearlyPlainLuau(input.source) && !/\/files\/v1\/loaders\//i.test(input.source)) {
    await sendOriginalLua(
      message,
      prompt,
      input,
      'The source looks like ordinary Lua/Luau rather than a protected VM payload. No deobfuscation pass was run.'
    );
    return;
  }

  const engineSuggestion = detectEngineSuggestion(input.source);
  const chooseRows = [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`deobf-flowauth:${message.author.id}`)
        .setLabel('FlowAuth')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`deobf-luraph-v15:${message.author.id}`)
        .setLabel(engineSuggestion && engineSuggestion.engine === 'luraph-v15' ? 'Recommended: Luraph v15' : 'Luraph v15')
        .setStyle(engineSuggestion && engineSuggestion.engine === 'luraph-v15' ? ButtonStyle.Success : ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`deobf-151:${message.author.id}`)
        .setLabel(engineSuggestion && engineSuggestion.engine === 'luraph-151' ? 'Recommended: Luraph 15.1' : 'Luraph 15.1')
        .setStyle(engineSuggestion && engineSuggestion.engine === 'luraph-151' ? ButtonStyle.Success : ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`deobf-centurion:${message.author.id}`)
        .setLabel('Centurion')
        .setStyle(ButtonStyle.Secondary),
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`deobf-ironbrew1:${message.author.id}`)
        .setLabel(engineSuggestion && engineSuggestion.engine === 'ironbrew1' ? 'Recommended: IronBrew 1' : 'IronBrew 1')
        .setStyle(engineSuggestion && engineSuggestion.engine === 'ironbrew1' ? ButtonStyle.Success : ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`deobf-ironbrew2:${message.author.id}`)
        .setLabel(engineSuggestion && engineSuggestion.engine === 'ironbrew2' ? 'Recommended: IronBrew 2' : 'IronBrew 2')
        .setStyle(engineSuggestion && engineSuggestion.engine === 'ironbrew2' ? ButtonStyle.Success : ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`deobf-vantarmor:${message.author.id}`)
        .setLabel('Vantarmor / Universal')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`deobf-luaprotect:${message.author.id}`)
        .setLabel('LuaProtect Fetcher')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`deobf-jnkie:${message.author.id}`)
        .setLabel('JNKIE Fetcher')
        .setStyle(ButtonStyle.Secondary),
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`deobf-luraph-v147:${message.author.id}`)
        .setLabel(engineSuggestion && engineSuggestion.engine === 'luraph-v147' ? 'Recommended: Luraph 14.7' : 'Luraph 14.7 (VIP)')
        .setStyle(engineSuggestion && engineSuggestion.engine === 'luraph-v147' ? ButtonStyle.Success : ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`deobf-luraph-v148:${message.author.id}`)
        .setLabel(engineSuggestion && engineSuggestion.engine === 'luraph-v148' ? 'Recommended: Luraph 14.8' : 'Luraph 14.8')
        .setStyle(engineSuggestion && engineSuggestion.engine === 'luraph-v148' ? ButtonStyle.Success : ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`deobf-luraph-v149:${message.author.id}`)
        .setLabel(engineSuggestion && engineSuggestion.engine === 'luraph-v149' ? 'Recommended: Luraph 14.9' : 'Luraph 14.9')
        .setStyle(engineSuggestion && engineSuggestion.engine === 'luraph-v149' ? ButtonStyle.Success : ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`deobf-luraph-v143:${message.author.id}`)
        .setLabel(engineSuggestion && engineSuggestion.engine === 'luraph-v143' ? 'Recommended: Luraph 14.3' : 'Luraph 14.3 (Static)')
        .setStyle(engineSuggestion && engineSuggestion.engine === 'luraph-v143' ? ButtonStyle.Success : ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`deobf-cancel:${message.author.id}`)
        .setLabel('Cancel')
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
      ? '**Detector suggestion:** Dvx thinks this file is ' + engineSuggestion.label +
        (engineSuggestion.engine ? '. Would you like to choose ' + engineSuggestion.label + '?' : ', but could not identify the exact version.') +
        '\\n' + engineSuggestion.reason + ' This is a suggestion, not an automatic engine selection.'
      : null,
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
        await showDeobfFailure(message, prompt, 'Luraph v14.3 static analysis failed', error);
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
  const content = message.content.trim();
  if (!content) return;
  const parts = content.split(/\s+/);
  const command = parts[0].toLowerCase();
  const subcommand = (parts[1] || '').toLowerCase();


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
    if (parts.length !== 1) {
      await message.reply({
        content: 'Usage: attach one Lua/Luau source file and send .fulcrum.',
        allowedMentions: { repliedUser: false },
      });
      return;
    }
    if (activeUsers.has(message.author.id)) {
      await message.reply('You already have an active job. Finish it or wait for it to expire.');
      return;
    }
    activeUsers.add(message.author.id);
    try {
      await startFulcrumWorkflow(message);
    } finally {
      activeUsers.delete(message.author.id);
    }
    return;
  }

  if (command === '.l') {
    if (parts.length > 1) {
      await message.reply('Usage: .l');
      return;
    }
    try {
      await sendRobloxEnvironmentLogger(message);
    } catch (error) {
      await message.reply('Roblox environment logger failed: ' + String(error && error.message || error).slice(0, 500))
        .catch(() => {});
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
