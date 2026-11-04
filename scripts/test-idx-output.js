'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const zlib = require('node:zlib');
const { buildIdxBundle, safeDisplayUrl } = require('./idx-output');

function readZipEntries(buffer) {
  const entries = new Map();
  let offset = 0;
  while (offset + 4 <= buffer.length && buffer.readUInt32LE(offset) === 0x04034b50) {
    const method = buffer.readUInt16LE(offset + 8);
    const compressedSize = buffer.readUInt32LE(offset + 18);
    const nameLength = buffer.readUInt16LE(offset + 26);
    const extraLength = buffer.readUInt16LE(offset + 28);
    const nameStart = offset + 30;
    const name = buffer.toString('utf8', nameStart, nameStart + nameLength);
    const dataStart = nameStart + nameLength + extraLength;
    const compressed = buffer.subarray(dataStart, dataStart + compressedSize);
    const data = method === 8 ? zlib.inflateRawSync(compressed) : compressed;
    entries.set(name, data);
    offset = dataStart + compressedSize;
  }
  return entries;
}

test('creates a ZIP bundle with individual sources, report, README and manifest', () => {
  const bundle = buildIdxBundle([
    { name: 'loadstring1.txt', source: 'print("one")', inline: true, depth: 0 },
    { name: 'loadstring2.txt', source: 'warn("two")', inline: false, depth: 2, url: 'https://example.com/two.lua?token=secret' },
  ], {
    input: { filename: 'input.lua', bytes: 120 },
    resolution: { discovered: 1, attempts: 1, maxDepth: 8, failures: [], truncated: false },
    generatedAt: new Date('2026-01-02T03:04:06Z'),
  });

  assert.equal(bundle.buffer.readUInt32LE(0), 0x04034b50);
  assert.equal(bundle.buffer.readUInt32LE(bundle.buffer.length - 22), 0x06054b50);
  const files = readZipEntries(bundle.buffer);
  assert.equal(files.get('sources/loadstring1.txt').toString(), 'print("one")');
  assert.equal(files.get('sources/loadstring2.txt').toString(), 'warn("two")');
  assert.ok(files.has('README.txt'));
  assert.ok(files.has('idx_report.txt'));
  assert.ok(files.has('manifest.json'));
  const manifest = JSON.parse(files.get('manifest.json').toString());
  assert.equal(manifest.summary.recovered, 2);
  assert.equal(manifest.sources[1].depth, 2);
  assert.equal(manifest.sources[1].url, 'https://example.com/two.lua?[query redacted]');
  assert.match(files.get('idx_report.txt').toString(), /RECOVERED FILES/);
});

test('redacts URL credentials, query and fragments in provenance', () => {
  assert.equal(
    safeDisplayUrl('https://user:pass@example.com/a.lua?key=secret#part'),
    'https://example.com/a.lua?[query redacted]',
  );
});

test('supports empty result bundles while retaining failure diagnostics', () => {
  const bundle = buildIdxBundle([], {
    resolution: {
      discovered: 2,
      attempts: 2,
      maxDepth: 8,
      failures: [{ url: 'https://example.com/no.lua?token=x', message: 'HTTP 404' }],
    },
  });
  const files = readZipEntries(bundle.buffer);
  const report = files.get('idx_report.txt').toString();
  assert.match(report, /No source files were recovered/);
  assert.match(report, /HTTP 404/);
  assert.equal(bundle.recovered, 0);
});
