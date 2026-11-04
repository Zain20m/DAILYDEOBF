'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  extractInlineLoadstringSources,
  extractLoadstringHttpGetUrls,
  extractStaticFetchUrls,
  resolveLoadstringSources,
  resolveStaticSources,
} = require('./idx-resolver');

test('extracts only literal loadstring(game:HttpGet(url)) calls', () => {
  const source = [
    '-- loadstring(game:HttpGet("https://ignored-comment.example/a"))',
    'local example = "loadstring(game:HttpGet(\'https://ignored-string.example/b\'))"',
    'loadstring(game:HttpGet("https://example.com/one.lua"))()',
    "loadstring ( game : HttpGet ( 'https://example.com/two.lua' ) )",
    'loadstring(game:HttpGet(dynamicUrl))',
  ].join('\n');

  assert.deepEqual(extractLoadstringHttpGetUrls(source), [
    'https://example.com/one.lua',
    'https://example.com/two.lua',
  ]);
});

test('follows nested literal loadstring URLs and returns numbered source files', async () => {
  const pages = new Map([
    ['https://example.com/a.lua', 'loadstring(game:HttpGet("https://example.com/b.lua"))()'],
    ['https://example.com/b.lua', 'loadstring(game:HttpGet("https://example.com/c.lua"))()'],
    ['https://example.com/c.lua', 'print("done")'],
  ]);
  const fetched = [];
  const result = await resolveLoadstringSources(
    'loadstring(game:HttpGet("https://example.com/a.lua"))()',
    {
      fetchText: async (url) => {
        fetched.push(url);
        if (!pages.has(url)) throw new Error('not found');
        return pages.get(url);
      },
    }
  );

  assert.deepEqual(fetched, [
    'https://example.com/a.lua',
    'https://example.com/b.lua',
    'https://example.com/c.lua',
  ]);
  assert.deepEqual(result.captures.map((item) => item.name), [
    'loadstring1.txt',
    'loadstring2.txt',
    'loadstring3.txt',
  ]);
  assert.equal(result.failures.length, 0);
  assert.equal(result.discovered, 3);
});

test('does not fetch duplicate URLs and records failures without losing other chunks', async () => {
  const result = await resolveLoadstringSources(
    [
      'loadstring(game:HttpGet("https://example.com/a.lua"))()',
      'loadstring(game:HttpGet("https://example.com/bad.lua"))()',
      'loadstring(game:HttpGet("https://example.com/a.lua"))()',
    ].join('\n'),
    {
      fetchText: async (url) => {
        if (url.endsWith('/bad.lua')) throw new Error('HTTP 404');
        return 'print("ok")';
      },
    }
  );

  assert.equal(result.captures.length, 1);
  assert.equal(result.failures.length, 1);
  assert.match(result.failures[0].message, /404/);
});

test('honours the output count limit', async () => {
  const source = Array.from({ length: 12 }, (_, i) =>
    'loadstring(game:HttpGet("https://example.com/' + i + '.lua"))()'
  ).join('\n');
  const result = await resolveLoadstringSources(source, {
    maxFiles: 4,
    fetchText: async (url) => 'print(' + JSON.stringify(url) + ')',
  });

  assert.equal(result.captures.length, 4);
  assert.equal(result.truncated, true);
});

test('caps total fetch attempts even when URLs fail', async () => {
  const source = Array.from({ length: 12 }, (_, i) =>
    'loadstring(game:HttpGet("https://example.com/fail-' + i + '.lua"))()'
  ).join('\n');
  let attempts = 0;
  const result = await resolveLoadstringSources(source, {
    maxFiles: 4,
    fetchText: async () => {
      attempts++;
      throw new Error('offline');
    },
  });

  assert.equal(attempts, 4);
  assert.equal(result.attempts, 4);
  assert.equal(result.truncated, true);
});


test('extracts common static HTTP fetch patterns for .get', () => {
  const source = [
    '-- request({Url = "https://ignored.example/comment"})',
    'local text = "HttpGet(\'https://ignored.example/string\')"',
    'local a = game:HttpGet("https://example.com/colon.lua")',
    'local b = game.HttpGet(game, "https://example.com/dot.lua")',
    'local c = game:GetService("HttpService"):GetAsync("https://example.com/getasync.lua")',
    'request({Url = "https://example.com/request.lua", Method = "GET"})',
    'syn.request({["Url"] = "https://ignored.example/bracket.lua"})',
    'http_request({url = "https://example.com/http-request.lua"})',
    'loadstring("https://example.com/loadstring-url.lua")()',
  ].join('\n');

  assert.deepEqual(extractStaticFetchUrls(source), [
    'https://example.com/colon.lua',
    'https://example.com/dot.lua',
    'https://example.com/getasync.lua',
    'https://example.com/request.lua',
    'https://example.com/http-request.lua',
    'https://example.com/loadstring-url.lua',
  ]);
});

test('.get recursively follows request-table and HttpGet links', async () => {
  const pages = new Map([
    ['https://example.com/a.lua', 'request({Url = "https://example.com/b.lua"})'],
    ['https://example.com/b.lua', 'game:HttpGet("https://example.com/c.lua")'],
    ['https://example.com/c.lua', 'print("complete")'],
  ]);
  const result = await resolveStaticSources(
    'loadstring(game:HttpGet("https://example.com/a.lua"))()',
    {
      maxFiles: 5,
      maxDepth: 4,
      fetchText: async (url) => {
        assert.ok(pages.has(url), 'unexpected URL: ' + url);
        return pages.get(url);
      },
    }
  );

  assert.deepEqual(result.captures.map((item) => item.name), [
    'get1.lua',
    'get2.lua',
    'get3.lua',
  ]);
  assert.equal(result.failures.length, 0);
  assert.equal(result.discovered, 3);
});

test('.idx keeps its original loadstringN.txt names after resolver sharing', async () => {
  const result = await resolveLoadstringSources(
    'loadstring(game:HttpGet("https://example.com/a.lua"))()',
    { fetchText: async () => 'print("ok")' }
  );
  assert.equal(result.captures[0].name, 'loadstring1.txt');
});

test('.get supports a supplied direct URL seed', async () => {
  const result = await resolveStaticSources('', {
    initialUrls: ['https://example.com/direct.lua'],
    fetchText: async () => 'print("downloaded")',
  });
  assert.equal(result.captures[0].name, 'get1.lua');
  assert.equal(result.captures[0].source, 'print("downloaded")');
});


test('captures literal source passed directly to loadstring', () => {
  const source = ['loadstring("print(1)")()', 'loadstring([=[print(2)]=])()'].join('\n');
  assert.deepEqual(extractInlineLoadstringSources(source), ['print(1)', 'print(2)']);
});

test('finds remote URLs stored in variables and request aliases', () => {
  const source = [
    'local firstUrl = "https://example.com/first.lua"',
    'loadstring(game:HttpGet(firstUrl))()',
    'local fetcher = syn.request',
    'fetcher({Url = "https://example.com/second.lua"})',
    'request({["Url"] = "https://example.com/third.lua"})',
  ].join('\\n');
  assert.deepEqual(extractStaticFetchUrls(source), [
    'https://example.com/first.lua',
    'https://example.com/second.lua',
    'https://example.com/third.lua',
  ]);
});

test('returns more than ten chunks when the configured limit allows it', async () => {
  const source = Array.from({ length: 24 }, (_, i) =>
    'loadstring(game:HttpGet("https://example.com/chunk-' + i + '.lua"))()'
  ).join('\\n');
  const result = await resolveLoadstringSources(source, {
    maxFiles: 40,
    fetchText: async () => 'print("chunk")',
  });
  assert.equal(result.captures.length, 24);
  assert.equal(result.captures[23].name, 'loadstring24.txt');
});
