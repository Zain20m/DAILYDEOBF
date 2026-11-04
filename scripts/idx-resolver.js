'use strict';

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
      if (source[i] === '[' && source[i + 1] === '[') {
        i += 2;
        const end = source.indexOf(']]', i);
        i = end === -1 ? source.length : end + 2;
      } else {
        while (i < source.length && source[i] !== '\n') i++;
      }
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

function extractLoadstringHttpGetUrls(source) {
  const tokens = tokenizeLua(String(source || ''));
  const urls = [];
  const seen = new Set();

  for (let i = 0; i + 6 < tokens.length; i++) {
    if (
      tokens[i].type !== 'identifier' || tokens[i].value !== 'loadstring' ||
      tokens[i + 1].value !== '(' ||
      tokens[i + 2].type !== 'identifier' || tokens[i + 2].value !== 'game' ||
      tokens[i + 3].value !== ':' ||
      tokens[i + 4].type !== 'identifier' || tokens[i + 4].value !== 'HttpGet' ||
      tokens[i + 5].value !== '(' ||
      tokens[i + 6].type !== 'string'
    ) {
      continue;
    }

    const url = tokens[i + 6].value.trim();
    if (!/^https?:\/\//i.test(url) || seen.has(url)) continue;
    seen.add(url);
    urls.push(url);
  }

  return urls;
}

async function resolveLoadstringSources(source, options = {}) {
  const fetchText = options.fetchText;
  if (typeof fetchText !== 'function') {
    throw new TypeError('resolveLoadstringSources requires a fetchText function.');
  }

  const maxFiles = Number.isInteger(options.maxFiles) ? Math.max(1, options.maxFiles) : 10;
  const maxDepth = Number.isInteger(options.maxDepth) ? Math.max(0, options.maxDepth) : 4;
  const initialUrls = extractLoadstringHttpGetUrls(source);
  const queue = initialUrls.slice(0, maxFiles).map((url) => ({ url, depth: 0 }));
  const queued = new Set(queue.map((item) => item.url));
  const visited = new Set();
  const captures = [];
  const failures = [];
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

      const index = captures.length + 1;
      captures.push({
        name: 'loadstring' + index + '.txt',
        source: text,
        url: item.url,
        depth: item.depth,
      });

      if (item.depth < maxDepth && captures.length + queue.length < maxFiles) {
        for (const childUrl of extractLoadstringHttpGetUrls(text)) {
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
    truncated: queue.length > 0 || discovered > visited.size,
    attempts,
    maxFiles,
    maxDepth,
  };
}

module.exports = {
  extractLoadstringHttpGetUrls,
  resolveLoadstringSources,
};
