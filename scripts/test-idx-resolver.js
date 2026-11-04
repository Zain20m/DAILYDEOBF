'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  extractLoadstringHttpGetUrls,
  resolveLoadstringSources,
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
