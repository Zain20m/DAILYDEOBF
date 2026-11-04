'use strict';

const crypto = require('node:crypto');
const zlib = require('node:zlib');

const CRC_TABLE = new Uint32Array(256);
for (let index = 0; index < 256; index++) {
  let value = index;
  for (let bit = 0; bit < 8; bit++) {
    value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
  }
  CRC_TABLE[index] = value >>> 0;
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date) {
  const year = Math.max(1980, date.getFullYear());
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

function safeArchiveName(value) {
  const name = String(value || 'file.txt').replace(/\\/g, '/').replace(/^\/+/, '');
  const parts = name.split('/').filter((part) => part && part !== '.' && part !== '..');
  if (!parts.length || parts.some((part) => /[\x00-\x1f]/.test(part))) {
    throw new Error('Invalid archive entry name.');
  }
  const result = parts.join('/');
  if (Buffer.byteLength(result, 'utf8') > 65535) throw new Error('Archive entry name is too long.');
  return result;
}

function createZip(entries, now = new Date()) {
  if (!Array.isArray(entries) || entries.length > 65535) throw new Error('Invalid ZIP entry list.');
  const localParts = [];
  const centralParts = [];
  const stamp = dosDateTime(now);
  let offset = 0;

  for (const entry of entries) {
    const name = safeArchiveName(entry.name);
    const nameBytes = Buffer.from(name, 'utf8');
    const data = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(String(entry.data ?? ''), 'utf8');
    const compressed = zlib.deflateRawSync(data, { level: 6 });
    const checksum = crc32(data);

    if (data.length > 0xffffffff || compressed.length > 0xffffffff || offset > 0xffffffff) {
      throw new Error('The ZIP archive exceeds the supported size.');
    }

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt16LE(stamp.time, 10);
    local.writeUInt16LE(stamp.date, 12);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    local.writeUInt16LE(0, 28);
    localParts.push(local, nameBytes, compressed);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(0x0314, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(stamp.time, 12);
    central.writeUInt16LE(stamp.date, 14);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, nameBytes);

    offset += local.length + nameBytes.length + compressed.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...localParts, centralDirectory, end]);
}

function safeDisplayUrl(rawUrl) {
  try {
    const url = new URL(String(rawUrl));
    url.username = '';
    url.password = '';
    url.search = '';
    url.hash = '';
    return url.origin + url.pathname + (String(rawUrl).includes('?') ? '?[query redacted]' : '');
  } catch {
    return 'remote URL';
  }
}

function formatBytes(bytes) {
  if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  if (bytes >= 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return bytes + ' B';
}

function makePreview(source, maxChars = 180) {
  const clean = String(source || '').replace(/\0/g, '').replace(/[\r\n\t]+/g, ' ').trim();
  if (!clean) return '(empty source)';
  return clean.length > maxChars ? clean.slice(0, maxChars - 1) + '…' : clean;
}

function buildIdxBundle(captures, details = {}) {
  const rows = (Array.isArray(captures) ? captures : []).map((capture, index) => {
    const source = String(capture.source ?? '');
    const bytes = Buffer.from(source, 'utf8');
    const filename = safeArchiveName(capture.name || ('loadstring' + (index + 1) + '.txt')).split('/').pop();
    return {
      filename,
      archivePath: 'sources/' + filename,
      kind: capture.inline ? 'inline loadstring' : 'downloaded source',
      depth: Number.isInteger(capture.depth) ? capture.depth : 0,
      url: capture.url ? safeDisplayUrl(capture.url) : null,
      bytes: bytes.length,
      sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
      preview: makePreview(source),
      data: bytes,
    };
  });

  const resolution = details.resolution || {};
  const inlineCount = rows.filter((row) => row.kind === 'inline loadstring').length;
  const remoteCount = rows.length - inlineCount;
  const totalBytes = rows.reduce((sum, row) => sum + row.bytes, 0);
  const failures = Array.isArray(resolution.failures) ? resolution.failures.map((failure) => ({
    url: safeDisplayUrl(failure.url),
    message: String(failure.message || 'Unknown fetch error').replace(/[\r\n]+/g, ' ').slice(0, 300),
  })) : [];
  const omitted = Array.isArray(details.omittedNames) ? details.omittedNames.map(String) : [];
  const maxDepthFound = rows.reduce((max, row) => Math.max(max, row.depth), 0);

  const manifest = {
    format: 'DAILY DEOBF IDX bundle',
    formatVersion: 1,
    generatedAt: (details.generatedAt instanceof Date ? details.generatedAt : new Date()).toISOString(),
    input: {
      filename: String(details.input && details.input.filename || 'inline-loadstring.lua'),
      bytes: Number(details.input && details.input.bytes) || 0,
      url: details.input && details.input.url ? safeDisplayUrl(details.input.url) : null,
    },
    summary: {
      recovered: rows.length,
      inline: inlineCount,
      remote: remoteCount,
      sourceBytes: totalBytes,
      discoveredUrls: Number(resolution.discovered) || 0,
      fetchAttempts: Number(resolution.attempts) || 0,
      fetchFailures: failures.length,
      truncated: Boolean(resolution.truncated),
      maxDepthConfigured: Number(resolution.maxDepth) || 0,
      maxDepthFound,
    },
    sources: rows.map(({ data, preview, ...row }) => row),
    failures,
    omitted,
    notes: [
      'This bundle contains statically recovered source text.',
      'Downloaded Luau was not executed by the .idx command.',
      'URLs in this manifest have query strings redacted to avoid exposing URL tokens.',
      'Files are stored separately under sources/ and retain loadstringN.txt names for .idx files compatibility.',
    ],
  };

  const reportLines = [
    '╔══════════════════════════════════════════════════════════════╗',
    '║                 DAILY DEOBF · .IDX REPORT                    ║',
    '╚══════════════════════════════════════════════════════════════╝',
    '',
    'COLLECTION SUMMARY',
    '  Input:             ' + manifest.input.filename,
    '  Recovered:         ' + rows.length + ' source(s)',
    '  Inline loadstring: ' + inlineCount,
    '  Remote downloads:  ' + remoteCount,
    '  Total source data: ' + formatBytes(totalBytes),
    '  URLs discovered:   ' + manifest.summary.discoveredUrls,
    '  Fetch attempts:    ' + manifest.summary.fetchAttempts,
    '  Fetch failures:    ' + failures.length,
    '  Deepest source:    ' + maxDepthFound,
    '  Truncated:         ' + (manifest.summary.truncated ? 'YES' : 'NO'),
    '',
    'RECOVERED FILES',
  ];

  if (!rows.length) reportLines.push('  No source files were recovered.');
  for (let index = 0; index < rows.length; index++) {
    const row = rows[index];
    reportLines.push(
      '',
      String(index + 1).padStart(2, '0') + '. ' + row.filename,
      '    Type:   ' + row.kind,
      '    Depth:  ' + row.depth,
      '    Size:   ' + formatBytes(row.bytes),
      '    SHA256: ' + row.sha256,
      '    Origin: ' + (row.url || 'inline input'),
      '    Start:  ' + row.preview,
    );
  }

  reportLines.push('', 'FETCH FAILURES');
  if (!failures.length) reportLines.push('  None.');
  for (const failure of failures) reportLines.push('  - ' + failure.url + '\n    ' + failure.message);

  if (omitted.length) {
    reportLines.push('', 'NOT INCLUDED (combined output-size limit)', ...omitted.map((name) => '  - ' + name));
  }

  reportLines.push(
    '',
    'BUNDLE CONTENTS',
    '  idx_bundle.zip',
    '  ├─ sources/          Individual recovered loadstringN.txt files',
    '  ├─ manifest.json     Source origin, depth, byte size and SHA-256',
    '  ├─ idx_report.txt    This human-readable report',
    '  └─ README.txt        Quick usage notes',
    '',
    'LIMITATIONS',
    '  .idx performs static extraction only. It does not execute downloaded code.',
    '  Computed, encrypted, or runtime-generated URLs/chunks are not represented as recovered.',
    '  URL query strings are hidden in the report and manifest to avoid exposing tokens.',
    '',
  );

  const report = reportLines.join('\n');
  const readme = [
    'DAILY DEOBF · .idx bundle',
    '',
    'Start with idx_report.txt for the collection summary and file previews.',
    'Open sources/ to find each recovered source as a separate loadstringN.txt file.',
    'manifest.json contains provenance, nesting depth, sizes and SHA-256 hashes.',
    '',
    'To use the recovered files with the bot, extract the archive and send up to 10',
    'loadstringN.txt files with the .idx files command.',
    '',
    '.idx is static extraction. Downloaded source is not executed by the bot.',
  ].join('\n');

  const zipEntries = [
    { name: 'README.txt', data: readme },
    { name: 'idx_report.txt', data: report },
    { name: 'manifest.json', data: JSON.stringify(manifest, null, 2) + '\n' },
    ...rows.map((row) => ({ name: row.archivePath, data: row.data })),
  ];

  return {
    buffer: createZip(zipEntries, details.generatedAt instanceof Date ? details.generatedAt : new Date()),
    reportBuffer: Buffer.from(report, 'utf8'),
    manifest,
    totalBytes,
    recovered: rows.length,
    inlineCount,
    remoteCount,
    maxDepthFound,
  };
}

module.exports = { buildIdxBundle, createZip, crc32, safeDisplayUrl };
