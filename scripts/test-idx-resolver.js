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
    'https://ignored.example/string',
    'https://example.com/colon.lua',
    'https://example.com/dot.lua',
    'https://example.com/getasync.lua',
    'https://example.com/request.lua',
    'https://ignored.example/bracket.lua',
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


test('follows URLs inside inline literal loadstring code', async () => {
  const source = 'loadstring([=[loadstring(game:HttpGet("https://example.com/inner.lua"))()]=])()';
  const result = await resolveLoadstringSources(source, {
    maxFiles: 10,
    fetchText: async (url) => {
      assert.equal(url, 'https://example.com/inner.lua');
      return 'print("inner source")';
    },
  });

  assert.equal(result.captures.length, 2);
  assert.equal(result.captures[0].inline, true);
  assert.equal(result.captures[1].source, 'print("inner source")');
});

test('marks the result truncated when inline chunks exceed the cap', async () => {
  const source = Array.from({ length: 14 }, (_, i) =>
    'loadstring("print(' + i + ')")()'
  ).join('\n');
  const result = await resolveLoadstringSources(source, { maxFiles: 10, fetchText: async () => '' });
  assert.equal(result.captures.length, 10);
  assert.equal(result.truncated, true);
});


test('recovers inline loadstring source assigned to a literal variable', () => {
  const source = [
    'local firstChunk = "print(123)"',
    'loadstring(firstChunk)()',
    'local secondChunk = [[warn("hello")]]',
    'loadstring(secondChunk)()',
    'secondChunk = buildAtRuntime()',
    'loadstring(secondChunk)()',
  ].join('\n');

  assert.deepEqual(extractInlineLoadstringSources(source), [
    'print(123)',
    'warn("hello")',
  ]);
});


test('.get detects HttpGetAsync, PostAsync, RequestAsync and URL table variants', () => {
  const source = [
    'local service = game:GetService("HttpService")',
    'service:GetAsync("https://example.com/get-async.lua")',
    'service:PostAsync("https://example.com/post-async.lua", "body")',
    'service:RequestAsync({Url = "https://example.com/request-async.lua", Method = "GET"})',
    'service:RequestAsync({["URL"] = "https://example.com/bracket-url.lua"})',
    'local endpoint = "https://example.com/endpoint.lua"',
    'request({Uri = endpoint})',
    'local getter = game.HttpGetAsync',
    'getter(game, "https://example.com/aliased-get.lua")',
  ].join('\\n');

  assert.deepEqual(extractStaticFetchUrls(source), [
    'https://example.com/get-async.lua',
    'https://example.com/post-async.lua',
    'https://example.com/request-async.lua',
    'https://example.com/bracket-url.lua',
    'https://example.com/endpoint.lua',
    'https://example.com/aliased-get.lua',
  ]);
});

test('.get scans URLs inside nested literal loadstring source', async () => {
  const source = [
    'loadstring([=[',
    '  loadstring([=[',
    '    request({Url = "https://example.com/nested.lua"})',
    '  ]=])()',
    ']=])()',
  ].join('\\n');

  const result = await resolveStaticSources(source, {
    maxFiles: 5,
    maxUrls: 20,
    maxAttempts: 20,
    maxDepth: 4,
    fetchText: async (url) => {
      assert.equal(url, 'https://example.com/nested.lua');
      return 'print("nested")';
    },
  });

  assert.equal(result.captures.length, 1);
  assert.equal(result.captures[0].name, 'get1.lua');
  assert.equal(result.captures[0].source, 'print("nested")');
});

test('.get keeps scanning after failed URLs instead of treating failures as output slots', async () => {
  const source = Array.from({ length: 8 }, (_, i) =>
    'request({Url = "https://example.com/item-' + i + '.lua"})'
  ).join('\\n');
  const result = await resolveStaticSources(source, {
    maxFiles: 2,
    maxUrls: 20,
    maxAttempts: 20,
    fetchText: async (url) => {
      if (/item-[0-4]/.test(url)) throw new Error('HTTP 404');
      return 'print("ok")';
    },
  });

  assert.equal(result.attempts, 7);
  assert.equal(result.failures.length, 5);
  assert.equal(result.captures.length, 2);
  assert.equal(result.discoveries.filter((item) => item.status === 'downloaded').length, 2);
  assert.equal(result.discoveries.filter((item) => item.status === 'failed').length, 5);
  assert.equal(result.truncated, true);
});

test('.get returns every URL discovery with queued/downloaded/failed state', async () => {
  const result = await resolveStaticSources(
    'request({Url = "https://example.com/ok.lua"})\\nrequest({Url = "https://example.com/no.lua"})',
    {
      maxFiles: 5,
      maxUrls: 10,
      maxAttempts: 10,
      fetchText: async (url) => {
        if (url.endsWith('/no.lua')) throw new Error('HTTP 503');
        return { source: 'print("ok")', finalUrl: 'https://cdn.example.com/ok.lua', status: 200, contentType: 'text/plain' };
      },
    }
  );

  assert.equal(result.discovered, 2);
  assert.equal(result.discoveries.length, 2);
  assert.deepEqual(result.discoveries.map((item) => item.status), ['downloaded', 'failed']);
  assert.equal(result.captures[0].finalUrl, 'https://cdn.example.com/ok.lua');
  assert.equal(result.captures[0].statusCode, 200);
  assert.equal(result.failures[0].message, 'HTTP 503');
});


test('.get resolves literal URL concatenation with string constants', () => {
  const source = [
    'local base = "https://example.com/"',
    'local resource = "script.lua"',
    'local target = base .. resource',
    'request({Url = target})',
  ].join('\\n');

  assert.deepEqual(extractStaticFetchUrls(source), [
    'https://example.com/',
    'https://example.com/script.lua',
  ]);
});

test('.get records URLs found beyond the configured chain depth', async () => {
  const result = await resolveStaticSources(
    'request({Url = "https://example.com/root.lua"})',
    {
      maxFiles: 5,
      maxUrls: 10,
      maxAttempts: 10,
      maxDepth: 0,
      fetchText: async () => 'request({Url = "https://example.com/child.lua"})',
    }
  );

  assert.equal(result.captures.length, 1);
  assert.equal(result.discovered, 2);
  assert.equal(result.discoveries.length, 2);
  assert.equal(result.discoveries[1].url, 'https://example.com/child.lua');
  assert.equal(result.discoveries[1].status, 'depth-limit');
  assert.equal(result.truncated, true);
});
