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
const { detectFlowAuthLuraphVersion } = require('./scripts/flowauth-version');
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
const ENGINE_CENT_DIR = path.join(__dirname, 'centurion-engine');
const ENGINE_CENT_CLI = path.join(ENGINE_CENT_DIR, 'centurion.py');
const activeUsers = new Set();
const commandGuildId = process.env.GUILD_ID || '';

const slashCommands = ['purelua'].map((name) => new SlashCommandBuilder()
  .setName(name)
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

    const headers = {
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      accept: 'text/plain, text/*, application/luau, application/javascript, application/octet-stream, application/json, */*;q=0.8',
      'accept-language': 'en-US,en;q=0.9',
      'cache-control': 'no-cache',
      pragma: 'no-cache',
      'accept-encoding': options.compressed ? 'gzip, deflate, br' : 'identity',
      connection: 'close',
      ...(method === 'PROPFIND' ? { depth: '0' } : {}),
      ...(options.headers || {}),
    };

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

function looksLikeViewerPageOrJavaScript(source) {
  const text = String(source || '').replace(/^\uFEFF/, '').trim();
  if (!text) return false;
  return /\bfunction\s+(?:escapeHTML|highlightLua)\s*\(/i.test(text) ||
    /\b(?:document\.(?:getElementById|querySelector|querySelectorAll|createElement)|window\.document|navigator\.clipboard)\b/i.test(text) ||
    /\b(?:const|let|var)\s+[A-Za-z_$][\w$]*\s*=/.test(text) ||
    /=>|\.addEventListener\s*\(|\binnerHTML\b|\btextContent\b/.test(text) ||
    /<\/?(?:!doctype|html|head|body|script)\b/i.test(text);
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
  await prompt.edit({
    content: '✅ No supported obfuscation signature was detected. Returned the original source unchanged as **' + outputName + '**.',
    components: [],
  }).catch(() => {});
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

function createAnalysisProgress(prompt, filename, inputBytes, label, options = {}) {
  const startedAt = Date.now();
  const displayLabel = /^Luraph\b/i.test(label) ? 'Luraph' : label;
  const payloadLabel = /^Luraph\b/i.test(label)
    ? 'Decrypting the Luraph payload'
    : 'Decrypting the protected payload';
  const stages = [
    payloadLabel,
    'Lifting VM functions',
    'Preparing download',
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

  function stageFor(value) {
    const text = String(value || '').toLowerCase();
    if (/checking|packaging|validat|preparing download|collecting .*artifacts|attaching/.test(text)) return 2;
    if (/lift|devirt|function|constant|reconstruct|coverage|unlifted|walk/.test(text)) return 1;
    if (/trace|decrypt|initializ|prepar|fingerprint|runtime|captur|instrument|execut/.test(text)) return 0;
    return null;
  }

  function advance(nextPhase, nextDetail) {
    if (nextPhase) {
      phase = String(nextPhase);
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
    if (failed && detail) lines.push('', '-# ' + detail.slice(0, 240));
    if (!failed && !completed) {
      lines.push('', '-# Stage: ' + phase.slice(0, 140));
      const silentForMs = Date.now() - lastEngineOutputAt;
      if (silentForMs >= 20_000) {
        lines.push('-# ⏳ No new engine diagnostics for ' + formatDuration(silentForMs) + '. The process is still running; the 25-minute engine limit remains active.');
      } else if (detail) {
        lines.push('-# ' + detail.slice(0, 220));
      }
    }
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
    } catch {}
    editing = false;
  }

  function onLine(rawLine) {
    const line = String(rawLine || '').replace(/\x1b\[[0-9;]*m/g, '').trim();
    if (!line) return;
    lastEngineOutputAt = Date.now();
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

  for (let index = 0; index < candidateParts.length; index++) {
    const part = candidateParts[index];
    await message.reply({
      content: '📄 Output part ' + (index + 1) + '/' + candidateParts.length +
        ' · ' + part.name + '\nJoin these files in numeric order. No source bytes were discarded.',
      files: [new AttachmentBuilder(part.data, { name: part.name })],
      allowedMentions: { repliedUser: false },
    });
  }

  // Keep the original large protected input downloadable beside the recovered
  // result. These are sent separately so the input cannot consume the output
  // attachment budget and prevent the reconstructed Luau from being delivered.
  if (Array.isArray(config.extraArtifacts) && config.extraArtifacts.length) {
    const extraFiles = [];
    let extraBytes = 0;
    for (const artifact of config.extraArtifacts) {
      const artifactPath = path.join(outputDir, artifact.path);
      const bytes = await fileSize(artifactPath);
      if (!bytes || bytes > MAX_OUTPUT_BYTES || extraBytes + bytes > MAX_OUTPUT_BYTES) continue;
      extraFiles.push(new AttachmentBuilder(await fs.readFile(artifactPath), {
        name: artifact.name || path.basename(artifactPath),
      }));
      extraBytes += bytes;
    }
    if (extraFiles.length) {
      await message.reply({
        content: '📎 Original protected input and reconstruction support files:',
        files: extraFiles,
        allowedMentions: { repliedUser: false },
      });
    }
  }

  return { hasLiftedSource, hasLiftCandidate, prototypeCount, chunks: chunkFiles.length, validation };
}



async function processLuraphV15(message, prompt, input, displayLabel = 'Luraph v15', gameId = null) {
  return processLuraph151(message, prompt, input, gameId, '15');
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
    await progress.complete('IronBrew analysis finished and its result files were attached.');
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

  const dedicated = await prepare('dedicated-v' + version);
  const compatible = await prepare('v15-compatibility');
  const inputBytes = Buffer.byteLength(input.source, 'utf8');
  const progress = createAnalysisProgress(prompt, input.filename, inputBytes, 'Luraph v' + version);
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
      'Running the dedicated Luraph v' + version + ' engine',
      'The Luraph v' + version + ' engine gets the first full reconstruction pass. Its output is checked for unresolved VM values and Luau syntax.'
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
          ...(gameId ? ['--cfg-json', JSON.stringify({ __superz_game_id: Number(gameId) })] : []),
        ],
        {
          env: {
            DEOB_FAST: '1',
            DEVIRT_LOADERS: '1',
            DEVIRT_FULL_ROUNDS: '1',
            DEVIRT_TIMING: '1',
            DEVIRT_ERRS: '1',
            DEVIRT_TB: '1',
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
      'Checking the dedicated Luraph v' + version + ' candidate',
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
            ...(gameId ? ['--cfg', '__superz_game_id=' + gameId] : []),
          ],
          {
            env: {
              DEVIRT_LOADERS: '1',
              DEVIRT_FULL_ROUNDS: '1',
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
      if (compatibilityValidation.candidate &&
          (!dedicatedValidation.candidate || compatibilityScore > dedicatedScore)) {
        chosen = compatible;
        chosenEngineDir = ENGINE_V15_DIR;
      }
    }

    if (!(await hasArtifacts(chosen.base))) {
      const errors = [
        dedicatedError && ('Dedicated Luraph v' + version + ': ' + String(dedicatedError.message || dedicatedError)),
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
        ? 'Luraph v' + version + ' · dedicated engine'
        : 'Luraph v' + version + ' · v15 compatibility engine',
      engineName: chosen === dedicated ? 'Dedicated Luraph v' + version + ' engine' : 'v15 compatibility engine',
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
        ...(gameId ? ['Target Universe/GameId supplied to the sandbox: ' + gameId + '.'] : ['No target Universe/GameId was supplied; game-locked builds may stop in their bootstrap layer.']),
        ...((/buffer access out of bounds|size out of range/i).test(dedicatedLogs + '\n' + compatibilityLogs)
          ? ['Runtime stopped during bootstrap with a buffer bounds/size error. This is not a recovered source result.', 'For a game-locked script, retry with its correct public Roblox Universe/GameId. A FlowAuth key-gated loader that requires a live authorization handshake will only expose its offline loader behaviour; the bot does not emulate or bypass that handshake.']
          : []),
      ],
    });

    await progress.complete(summary.hasLiftedSource
      ? 'A Luau candidate passed structural checks and syntax validation.'
      : (summary.hasLiftCandidate
        ? 'Both engines were checked. The best source candidate remains partial and is labelled as such.'
        : 'Neither engine completed the VM lift. Trace and diagnostic artifacts are attached.'));

    const bootstrapBoundsError = /buffer access out of bounds|size out of range/i.test(dedicatedLogs + '\n' + compatibilityLogs);
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
    error.stdout = [dedicatedLogs, compatibilityLogs].filter(Boolean).join('\n\n');
    error.stderr = error.stdout;
    if (input && input.source) {
      const originalData = Buffer.from(input.source, 'utf8');
      if (originalData.length > 0 && originalData.length <= MAX_OUTPUT_BYTES) {
        error.originalInput = {
          name: path.basename(String(input.filename || 'original-obfuscated.lua')).replace(/[^A-Za-z0-9._-]/g, '_'),
          data: originalData,
        };
      }
    }
    await capturePartialArtifact(error, [chosen.base + '.devirt.luau', chosen.base + '.trace.luau', chosen.base + '.luau', dedicated.base + '.devirt.luau', compatible.base + '.devirt.luau']);
    await progress.fail(error);
    throw error;
  } finally {
    progress.stop();
    await fs.rm(tempRoot, { recursive: true, force: true }).catch(() => {});
  }
}




async function collectFlowAuthGameId(message, prompt) {
  await prompt.edit({
    content: '🎮 **FlowAuth · target game**\nSend the Roblox **Universe/GameId** for the game this script belongs to, or type **skip** if it is not game-locked.\n\nUse the universe ID, not the place ID. The ID is only used as sandbox context.',
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
      reject(new Error('GameId prompt timed out. Run .deobf and choose FlowAuth again.'));
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
        reject(new Error('GameId prompt timed out. Run .deobf and choose FlowAuth again.'));
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

  const gameId = await collectFlowAuthGameId(message, prompt);
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
        const direct = value.match(/^https?:\/\/\S+$/i);
        if (direct) {
          const rawUrl = direct[0].replace(/[)\]},.;]+$/g, '');
          const parsed = new URL(rawUrl);
          resolve({
            source: '',
            filename: path.basename(parsed.pathname) || 'remote-url.lua',
            url: parsed.toString(),
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
    input = await collectGetInput(message, prompt);
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
    'Only public HTTP/HTTPS GET downloads are attempted. The script is never executed.',
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
      ? 'Every discovered URL failed to download. The attached report lists the exact HTTP, DNS, TLS or content error for each URL.'
      : 'URLs were found, but no readable source files were returned. The attached report lists every discovery record.';
    await message.reply({
      embeds: [dailyEmbed('Source scan complete', resolution.discovered + ' URL(s) found, but no source files downloaded.\n' + reason, DAILY_COLORS.warning)],
      files: [new AttachmentBuilder(reportBuffer, { name: 'get_report.txt' }), ...(runtimeSpyFile ? [runtimeSpyFile] : [])],
      allowedMentions: { repliedUser: false },
    });
  } else {
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      await message.reply({
        embeds: [dailyEmbed(batchIndex === 0 ? 'Source files recovered' : 'Source files · Batch ' + (batchIndex + 1) + '/' + batches.length,
          batchIndex === 0
            ? attachments.length + ' source file(s) recovered. ' + resolution.discovered + ' URL(s) discovered; ' + resolution.failures.length + ' failed.'
            : 'Additional recovered source files.', DAILY_COLORS.success)],
        files: batch.map((item) => new AttachmentBuilder(item.data, { name: item.name })),
        allowedMentions: { repliedUser: false },
      });
    }

    await message.reply({
      embeds: [dailyEmbed('Source scan report', resolution.discovered + ' URL(s) · ' + resolution.attempts + ' fetch attempt(s) · ' + resolution.failures.length + ' failed.', DAILY_COLORS.primary)],
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

function helpText() {
  return [
    'DAILY DEOBF',
    '',
    'COMMANDS',
    '.deobf [URL/file] - analyze protected Lua/Luau; direct HTTP/HTTPS links are supported',
    '.get [URL/file] - scan source and fetch discovered links; direct HTTP/HTTPS links are supported',
    '.purelua',
    '.help',
    '',
    'SLASH COMMANDS',
    '/purelua',
  ].join('\n');
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
    await prompt.edit({
      content: '✅ Loader fetched. HTTP method report and returned response files are attached.',
      components: [],
    }).catch(() => {});
    return;
  }

  const hash = loaderUrl.pathname.match(/^\/files\/v1\/loaders\/(.+)\.lua$/i)[1];
  const keyMatch = combinedInput.match(/(?:getgenv\(\)\.script_key|script_key)\s*=\s*["']([^"']+)["']/i);
  if (!keyMatch) {
    throw new Error('No script_key was found. Include script_key = "YOUR_KEY" with the Vantarmor loader URL.');
  }

  const params = new URLSearchParams({ s: hash, key: keyMatch[1].trim() });
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
    if (!response.ok) throw new Error('Vantarmor returned HTTP ' + response.status + '.');
    const errorLine = body.trim().match(/^!VANTARMOR:([A-Z0-9_]+)$/);
    if (errorLine) throw new Error('Vantarmor rejected the request: ' + errorLine[1] + '.');

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
    if (payloadError) throw new Error('Vantarmor rejected the payload: ' + payloadError[1] + '.');
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
    await prompt.edit({ content: '✅ Vantarmor returned the Lua source. Attached as **vantarmor_recovered.lua**.', components: [] }).catch(() => {});
  } finally {
    clearTimeout(timeout);
    await fs.rm(outputPath, { force: true }).catch(() => {});
  }
}

async function startWorkflow(message, inlineText = null) {
  const prompt = await message.reply({
    embeds: [dailyEmbed('New deobfuscation', 'Upload a **.lua**, **.luau**, **.pureluau** or **.txt** file, paste source, or send a direct HTTP/HTTPS script URL.\n\n**Maximum input:** 18 MB', DAILY_COLORS.primary)],
    allowedMentions: { repliedUser: false },
  });
  // Accept an attachment, a URL / HttpGet expression on the command,
  // or a URL / HttpGet expression in the follow-up message.
  const firstAttachment = message.attachments.first();
  const input = firstAttachment
    ? await inputFromAttachment(firstAttachment)
    : (inlineText ? await inputFromUrlText(inlineText) : await collectInput(message, prompt));

  if (isClearlyPlainLuau(input.source) && !/\/files\/v1\/loaders\//i.test(input.source)) {
    await sendOriginalLua(
      message,
      prompt,
      input,
      'The source looks like ordinary Lua/Luau rather than a protected VM payload. No deobfuscation pass was run.'
    );
    return;
  }

  const chooseRows = [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`deobf-flowauth:${message.author.id}`)
        .setLabel('FlowAuth')
        .setStyle(ButtonStyle.Success),
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
      new ButtonBuilder()
        .setCustomId(`deobf-ironbrew1:${message.author.id}`)
        .setLabel('IronBrew 1')
        .setStyle(ButtonStyle.Success),
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`deobf-vantarmor:${message.author.id}`)
        .setLabel('Vantarmor and Universal Loader Fetcher')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`deobf-cancel:${message.author.id}`)
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Secondary),
    ),
  ];
  await prompt.edit({
    content: null,
    embeds: [dailyEmbed('Choose an engine', 'Select the analysis engine for this file.', DAILY_COLORS.primary)],
    components: chooseRows,
  });

  const componentCollector = prompt.createMessageComponentCollector({
    time: PICKER_WAIT_MS,
    filter: (interaction) => interaction.user.id === message.author.id,
  });
  componentCollector.on('collect', async (interaction) => {
    if (interaction.customId === `deobf-vantarmor:${message.author.id}`) {
      await interaction.deferUpdate();
      componentCollector.stop('selected');
      try {
        await processVantarmorFetcher(message, prompt, input);
      } catch (error) {
        await showDeobfFailure(message, prompt, 'Universal Loader Fetcher failed', error);
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
        await processFlowAuth(message, prompt, input);
      } catch (error) {
        await showDeobfFailure(message, prompt, 'FlowAuth analysis failed', error);
      }
      return;
    }
    if (interaction.customId === `deobf-ironbrew1:${message.author.id}`) {
      await interaction.deferUpdate();
      componentCollector.stop('selected');
      try {
        await processIronbrew1(message, prompt, input);
      } catch (error) {
        await showDeobfFailure(message, prompt, 'IronBrew 1 failed', error);
      }
      return;
    }
    if (interaction.customId === `deobf-centurion:${message.author.id}`) {
      await interaction.deferUpdate();
      componentCollector.stop('selected');
      try {
        await processCenturion(message, prompt, input);
      } catch (error) {
        await showDeobfFailure(message, prompt, 'Centurion failed', error);
      }
      return;
    }
    if (interaction.customId === `deobf-151:${message.author.id}`) {
      await interaction.deferUpdate();
      componentCollector.stop('selected');
      try {
        await processLuraph151(message, prompt, input);
      } catch (error) {
        await showDeobfFailure(message, prompt, 'Luraph 15.1 failed', error);
      }
      return;
    }
    if (interaction.customId === `deobf-luraph-v15:${message.author.id}`) {
      await interaction.deferUpdate();
      componentCollector.stop('selected');
      try {
        await processLuraphV15(message, prompt, input);
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
    console.log('Registered /purelua slash command.');
  } catch (error) {
    console.error('Slash-command registration failed:', error.message);
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName === 'purelua') {
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
