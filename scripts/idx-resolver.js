'use strict';

const REQUEST_FUNCTIONS = new Set([
  'httpget', 'httpgetasync', 'getasync',
  'request', 'http_request', 'httprequest',
  'get', 'fetch', 'loadstring',
]);
const URL_FIELDS = new Set(['url', 'uri', 'urlstring']);

function extractInlineLoadstringSources(source) {
  const tokens = tokenizeLua(String(source || ''));
  const chunks = [];
  const knownStrings = new Map();

  for (let i = 0; i + 2 < tokens.length; i++) {
    if (tokens[i].type === 'identifier' && tokens[i + 1].value === '=') {
      if (tokens[i + 2].type === 'string') {
        knownStrings.set(tokens[i].value, tokens[i + 2].value);
      } else {
        knownStrings.delete(tokens[i].value);
      }
    }

    if (
      tokens[i].type !== 'identifier' || tokens[i].value.toLowerCase() !== 'loadstring' ||
      tokens[i + 1].value !== '('
    ) continue;

    const argument = tokens[i + 2];
    const chunk = argument && argument.type === 'string'
      ? argument.value
      : (argument && argument.type === 'identifier' ? knownStrings.get(argument.value) : null);
    if (typeof chunk === 'string' && chunk.trim() && !isHttpUrl(chunk)) {
      chunks.push(chunk);
    }
  }
  return chunks;
}

function tokenizeLua(source) {
  const tokens = [];
  let i = 0;
  while (i < source.length) {
    const ch = source[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    if (ch === '-' && source[i + 1] === '-') {
      i += 2;
      const longComment = source.slice(i).match(/^\[(=*)\[/);
      if (longComment) {
        const close = ']' + longComment[1] + ']';
        i += longComment[0].length;
        const end = source.indexOf(close, i);
        i = end === -1 ? source.length : end + close.length;
      } else {
        while (i < source.length && source[i] !== '\n') i++;
      }
      continue;
    }

    const longString = source.slice(i).match(/^\[(=*)\[/);
    if (longString) {
      const close = ']' + longString[1] + ']';
      i += longString[0].length;
      const end = source.indexOf(close, i);
      const value = end === -1 ? source.slice(i) : source.slice(i, end);
      i = end === -1 ? source.length : end + close.length;
      tokens.push({ type: 'string', value });
      continue;
    }

    if (ch === '"' || ch === "'") {
      const quote = ch;
      i++;
      let value = '';
      while (i < source.length && source[i] !== quote) {
        if (source[i] !== '\\') {
          value += source[i++];
          continue;
        }
        i++;
        if (i >= source.length) break;
        const escaped = source[i++];
        const simple = { n: '\n', r: '\r', t: '\t', '\\': '\\', '"': '"', "'": "'" };
        if (Object.prototype.hasOwnProperty.call(simple, escaped)) {
          value += simple[escaped];
        } else if (/[0-9]/.test(escaped)) {
          let digits = escaped;
          while (digits.length < 3 && i < source.length && /[0-9]/.test(source[i])) {
            digits += source[i++];
          }
          value += String.fromCharCode(Number(digits) & 0xff);
        } else {
          value += escaped;
        }
      }
      if (source[i] === quote) i++;
      tokens.push({ type: 'string', value });
      continue;
    }

    if (/[A-Za-z_]/.test(ch)) {
      const start = i++;
      while (i < source.length && /[A-Za-z0-9_]/.test(source[i])) i++;
      tokens.push({ type: 'identifier', value: source.slice(start, i) });
      continue;
    }

    tokens.push({ type: 'punctuation', value: ch });
    i++;
  }
  return tokens;
}

function isHttpUrl(value) {
  return typeof value === 'string' &&
    /^https?:\/\/[^\s"'<>]+$/i.test(value.trim());
}

function uniqueUrls(values) {
  const seen = new Set();
  const urls = [];
  for (const value of values) {
    const url = String(value || '').trim();
    if (!isHttpUrl(url) || seen.has(url)) continue;
    seen.add(url);
    urls.push(url);
  }
  return urls;
}

function extractLoadstringHttpGetUrls(source) {
  const tokens = tokenizeLua(String(source || ''));
  const urls = [];
  for (let i = 0; i + 6 < tokens.length; i++) {
    if (
      tokens[i].type === 'identifier' && tokens[i].value.toLowerCase() === 'loadstring' &&
      tokens[i + 1].value === '(' &&
      tokens[i + 2].type === 'identifier' && tokens[i + 2].value.toLowerCase() === 'game' &&
      (tokens[i + 3].value === ':' || tokens[i + 3].value === '.') &&
      tokens[i + 4].type === 'identifier' && tokens[i + 4].value.toLowerCase() === 'httpget' &&
      tokens[i + 5].value === '(' &&
      tokens[i + 6].type === 'string'
    ) {
      urls.push(tokens[i + 6].value);
    }
  }
  return uniqueUrls(urls);
}

function extractStaticFetchUrls(source) {
  const tokens = tokenizeLua(String(source || ''));
  const urls = [];
  const literalStrings = new Map();
  const requestAliases = new Set(REQUEST_FUNCTIONS);

  for (let i = 0; i + 2 < tokens.length; i++) {
    if (tokens[i].type === 'identifier' && tokens[i + 1].value === '=' && tokens[i + 2].type === 'string') {
      literalStrings.set(tokens[i].value, tokens[i + 2].value);
    }
    if (tokens[i].type === 'identifier' && tokens[i + 1].value === '=') {
      const target = tokens.slice(i + 2, i + 7)
        .find((part) => part.type === 'identifier' && REQUEST_FUNCTIONS.has(part.value.toLowerCase()));
      if (target) requestAliases.add(tokens[i].value.toLowerCase());
    }
  }

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const literalUrl = token.type === 'string'
      ? token.value
      : (token.type === 'identifier' ? literalStrings.get(token.value) : null);
    if (!isHttpUrl(literalUrl)) continue;

    const previous = tokens[i - 1];
    const beforePrevious = tokens[i - 2];
    const apiName = beforePrevious && beforePrevious.type === 'identifier'
      ? beforePrevious.value.toLowerCase()
      : '';

    // HttpGet/GetAsync/request("https://...") and dotted equivalents.
    if (
      previous && previous.value === '(' &&
      requestAliases.has(apiName)
    ) {
      urls.push(literalUrl);
      continue;
    }

    // game.HttpGet(game, "https://...") passes the receiver explicitly.
    const apiBeforeExplicitReceiver = tokens[i - 4];
    if (
      previous && previous.value === ',' &&
      tokens[i - 3] && tokens[i - 3].value === '(' &&
      apiBeforeExplicitReceiver && apiBeforeExplicitReceiver.type === 'identifier' &&
      requestAliases.has(apiBeforeExplicitReceiver.value.toLowerCase())
    ) {
      urls.push(literalUrl);
      continue;
    }

    // request({ Url = "https://..." }) and similar options-table forms.
    if (
      previous && previous.value === '=' &&
      beforePrevious && beforePrevious.type === 'identifier' &&
      URL_FIELDS.has(beforePrevious.value.toLowerCase())
    ) {
      urls.push(literalUrl);
      continue;
    }

    // request({ ["Url"] = "https://..." }) and bracket-key variants.
    const bracketField = tokens[i - 3];
    if (
      previous && previous.value === '=' &&
      tokens[i - 2] && tokens[i - 2].value === ']' &&
      bracketField && bracketField.type === 'string' &&
      URL_FIELDS.has(bracketField.value.toLowerCase())
    ) {
      urls.push(literalUrl);
    }
  }

  return uniqueUrls(urls);
}

async function resolveWithExtractor(source, options, extractor) {
  const fetchText = options.fetchText;
  if (typeof fetchText !== 'function') {
    throw new TypeError('A fetchText function is required.');
  }

  const maxFiles = Number.isInteger(options.maxFiles) ? Math.max(1, options.maxFiles) : 10;
  const maxDepth = Number.isInteger(options.maxDepth) ? Math.max(0, options.maxDepth) : 4;
  const namePrefix = String(options.namePrefix || 'source').replace(/[^A-Za-z0-9_-]/g, '') || 'source';
  const extension = String(options.extension || 'lua').replace(/[^A-Za-z0-9]/g, '') || 'lua';
  const initialUrls = uniqueUrls([
    ...(Array.isArray(options.initialUrls) ? options.initialUrls : []),
    ...extractor(source),
  ]);
  const queue = initialUrls.slice(0, maxFiles).map((url) => ({ url, depth: 0 }));
  const queued = new Set(queue.map((item) => item.url));
  const visited = new Set();
  const captures = [];
  const failures = [];
  const inlineSeen = new Set();
  const inlineExtractor = typeof options.inlineExtractor === 'function' ? options.inlineExtractor : null;
  let inlineTruncated = false;
  const addInlineChunks = (text, depth, sourceUrl) => {
    if (!inlineExtractor) return;
    for (const chunk of inlineExtractor(text)) {
      const key = chunk;
      if (inlineSeen.has(key)) continue;
      if (captures.length >= maxFiles) { inlineTruncated = true; continue; }
      inlineSeen.add(key);
      captures.push({
        name: namePrefix + (captures.length + 1) + '.' + extension,
        source: chunk,
        url: sourceUrl || null,
        depth,
        inline: true,
      });
    }
  };
  addInlineChunks(source, 0, null);
  let discovered = initialUrls.length;
  let attempts = 0;

  while (queue.length && captures.length < maxFiles && attempts < maxFiles) {
    const item = queue.shift();
    if (visited.has(item.url)) continue;
    visited.add(item.url);
    attempts++;

    try {
      const fetched = await fetchText(item.url);
      const text = typeof fetched === 'string' ? fetched : fetched && fetched.source;
      if (typeof text !== 'string' || !text.trim()) {
        throw new Error('The URL returned an empty or non-text response.');
      }

      captures.push({
        name: namePrefix + (captures.length + 1) + '.' + extension,
        source: text,
        url: item.url,
        depth: item.depth,
        inline: false,
      });
      addInlineChunks(text, item.depth, item.url);

      if (item.depth < maxDepth && captures.length + queue.length < maxFiles) {
        for (const childUrl of extractor(text)) {
          if (visited.has(childUrl) || queued.has(childUrl)) continue;
          if (captures.length + queue.length >= maxFiles) break;
          queue.push({ url: childUrl, depth: item.depth + 1 });
          queued.add(childUrl);
          discovered++;
        }
      }
    } catch (error) {
      failures.push({
        url: item.url,
        message: String(error && (error.message || error) || 'Unknown fetch error').slice(0, 240),
      });
    }
  }

  return {
    captures,
    failures,
    discovered,
    visited: visited.size,
    truncated: inlineTruncated || queue.length > 0 || discovered > visited.size,
    attempts,
    maxFiles,
    maxDepth,
  };
}

async function resolveLoadstringSources(source, options = {}) {
  const extractAllLoadstringUrls = (text) => {
    const inlineChunks = extractInlineLoadstringSources(text);
    return uniqueUrls([
      ...extractLoadstringHttpGetUrls(text),
      ...extractStaticFetchUrls(text),
      ...inlineChunks.flatMap((chunk) => [
        ...extractLoadstringHttpGetUrls(chunk),
        ...extractStaticFetchUrls(chunk),
      ]),
    ]);
  };
  return resolveWithExtractor(source, {
    ...options,
    namePrefix: 'loadstring',
    extension: 'txt',
    inlineExtractor: extractInlineLoadstringSources,
  }, extractAllLoadstringUrls);
}

async function resolveStaticSources(source, options = {}) {
  return resolveWithExtractor(source, { ...options, namePrefix: 'get', extension: 'lua' }, extractStaticFetchUrls);
}

module.exports = {
  extractInlineLoadstringSources,
  extractLoadstringHttpGetUrls,
  extractStaticFetchUrls,
  resolveLoadstringSources,
  resolveStaticSources,
  tokenizeLua,
};
