'use strict';

const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const { Worker } = require('node:worker_threads');
const ts = require('typescript');

const ARCHIVE_PATH = path.join(__dirname, '..', 'upload', 'grok-workspace-3.zip');
const EXPECTED_SHA256 = '69b25c4215222703686ddbb6c668b596edccf03f335be45ec7c3f1e942324e2c';
const SOURCE_PREFIX = 'src/lib/dailyfuscator/';
const REQUIRED_SOURCES = [
  'ast.ts', 'codec.ts', 'controlflow.ts', 'desugar.ts', 'emit.ts',
  'lexer.ts', 'macros.ts', 'parser.ts', 'payload.ts', 'pipeline.ts',
  'protect.ts', 'rename.ts', 'rng.ts', 'runtime.ts', 'vm.ts',
];

let enginePromise = null;

function needRange(buffer, offset, length, label) {
  if (!Number.isInteger(offset) || !Number.isInteger(length) ||
      offset < 0 || length < 0 || offset + length > buffer.length) {
    throw new Error('Dailyfuscator archive is truncated (' + label + ').');
  }
}

function extractTypeScriptSources(zip) {
  const minOffset = Math.max(0, zip.length - 22 - 0xffff);
  let eocd = -1;
  for (let i = zip.length - 22; i >= minOffset; i--) {
    if (zip.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('Dailyfuscator source archive has no ZIP directory.');
  needRange(zip, eocd, 22, 'end record');
  if (zip.readUInt16LE(eocd + 4) !== 0 || zip.readUInt16LE(eocd + 6) !== 0) {
    throw new Error('Multi-disk Dailyfuscator archives are not supported.');
  }

  const entryCount = zip.readUInt16LE(eocd + 10);
  const directorySize = zip.readUInt32LE(eocd + 12);
  const directoryOffset = zip.readUInt32LE(eocd + 16);
  needRange(zip, directoryOffset, directorySize, 'central directory');
  const sources = new Map();
  let position = directoryOffset;
  let extractedBytes = 0;

  for (let index = 0; index < entryCount; index++) {
    needRange(zip, position, 46, 'central directory entry');
    if (zip.readUInt32LE(position) !== 0x02014b50) {
      throw new Error('Dailyfuscator archive contains an invalid directory entry.');
    }
    const flags = zip.readUInt16LE(position + 8);
    const method = zip.readUInt16LE(position + 10);
    const compressedSize = zip.readUInt32LE(position + 20);
    const uncompressedSize = zip.readUInt32LE(position + 24);
    const nameLength = zip.readUInt16LE(position + 28);
    const extraLength = zip.readUInt16LE(position + 30);
    const commentLength = zip.readUInt16LE(position + 32);
    const localOffset = zip.readUInt32LE(position + 42);
    needRange(zip, position + 46, nameLength + extraLength + commentLength, 'entry metadata');
    const name = zip.subarray(position + 46, position + 46 + nameLength).toString('utf8');
    position += 46 + nameLength + extraLength + commentLength;

    if (!name.startsWith(SOURCE_PREFIX) || !name.endsWith('.ts') || name.endsWith('.test.ts')) continue;
    if (flags & 0x0001) throw new Error('Encrypted files are not valid Dailyfuscator source files.');
    if (uncompressedSize > 256 * 1024) throw new Error('A Dailyfuscator engine module is unexpectedly large.');
    extractedBytes += uncompressedSize;
    if (extractedBytes > 1024 * 1024) throw new Error('Dailyfuscator source archive exceeds the module size limit.');

    needRange(zip, localOffset, 30, 'local file header');
    if (zip.readUInt32LE(localOffset) !== 0x04034b50) {
      throw new Error('Dailyfuscator archive contains an invalid local file header.');
    }
    const localNameLength = zip.readUInt16LE(localOffset + 26);
    const localExtraLength = zip.readUInt16LE(localOffset + 28);
    const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
    needRange(zip, dataOffset, compressedSize, 'compressed module data');
    const compressed = zip.subarray(dataOffset, dataOffset + compressedSize);
    let data;
    if (method === 0) data = Buffer.from(compressed);
    else if (method === 8) data = zlib.inflateRawSync(compressed, { maxOutputLength: 256 * 1024 });
    else throw new Error('Unsupported ZIP compression method in Dailyfuscator archive.');
    if (data.length !== uncompressedSize) throw new Error('Dailyfuscator module size did not match its archive entry.');
    sources.set(name.slice(SOURCE_PREFIX.length), data.toString('utf8'));
  }

  const missing = REQUIRED_SOURCES.filter((name) => !sources.has(name));
  if (missing.length) throw new Error('Dailyfuscator archive is missing required modules: ' + missing.join(', '));
  return sources;
}

async function buildEngine() {
  const archive = await fs.readFile(ARCHIVE_PATH);
  if (archive.length > 8 * 1024 * 1024) throw new Error('Dailyfuscator source archive exceeds the 8 MB safety limit.');
  const digest = crypto.createHash('sha256').update(archive).digest('hex');
  if (digest !== EXPECTED_SHA256) {
    throw new Error('Dailyfuscator source archive hash mismatch. Update the approved archive hash before deploying a new engine build.');
  }

  const sources = extractTypeScriptSources(archive);
  const buildDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dailyfuscator-v3-'));
  try {
    for (const fileName of REQUIRED_SOURCES) {
      const result = ts.transpileModule(sources.get(fileName), {
        fileName,
        reportDiagnostics: true,
        compilerOptions: {
          target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.CommonJS,
          removeComments: true,
          esModuleInterop: true,
        },
      });
      const errors = (result.diagnostics || []).filter((item) => item.category === ts.DiagnosticCategory.Error);
      if (errors.length) {
        const message = ts.flattenDiagnosticMessageText(errors[0].messageText, '\n');
        throw new Error('Dailyfuscator TypeScript compile failed in ' + fileName + ': ' + message);
      }
      const javascript = result.outputText.replace(/\.ts(["'])/g, '.js$1');
      await fs.writeFile(path.join(buildDir, fileName.replace(/\.ts$/, '.js')), javascript, { mode: 0o600 });
    }
    const pipeline = require(path.join(buildDir, 'pipeline.js'));
    if (!pipeline || typeof pipeline.obfuscate !== 'function') {
      throw new Error('Dailyfuscator pipeline did not export its obfuscate function.');
    }
    return pipeline;
  } catch (error) {
    await fs.rm(buildDir, { recursive: true, force: true }).catch(() => {});
    throw error;
  }
}

async function loadDailyfuscator() {
  if (!enginePromise) {
    enginePromise = buildEngine().catch((error) => {
      enginePromise = null;
      throw error;
    });
  }
  return enginePromise;
}

// Keep CPU-heavy obfuscation off Discord's main event loop. This prevents one
// large input from freezing command handling, heartbeats, and other users.
function obfuscateDailyfuscatorInWorker(source, options = {}, timeoutMs = 180_000, onHeartbeat = null) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(path.join(__dirname, 'dailyfuscator-worker.js'), {
      workerData: { source, options },
      resourceLimits: { maxOldGenerationSizeMb: 512 },
    });
    let settled = false;
    const startedAt = Date.now();
    let heartbeatTimer = null;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      callback(value);
    };
    const timer = setTimeout(() => {
      finish(reject, new Error('Dailyfuscator exceeded its ' + Math.round(timeoutMs / 1000) + '-second processing limit. The bot remains responsive.'));
      worker.terminate().catch(() => {});
    }, timeoutMs);
    if (typeof onHeartbeat === 'function') {
      heartbeatTimer = setInterval(() => {
        if (settled) return;
        try {
          onHeartbeat(Date.now() - startedAt);
        } catch {
          // Progress reporting must never interrupt an obfuscation job.
        }
      }, 15_000);
      heartbeatTimer.unref?.();
    }

    worker.once('message', (message) => {
      if (!message || message.ok !== true) {
        finish(reject, new Error(message && message.error || 'Dailyfuscator worker returned no result.'));
        return;
      }
      finish(resolve, message.result);
    });
    worker.once('error', (error) => finish(reject, error));
    worker.once('exit', (code) => {
      if (!settled && code !== 0) {
        finish(reject, new Error('Dailyfuscator worker exited unexpectedly with code ' + code + '.'));
      } else if (!settled) {
        finish(reject, new Error('Dailyfuscator worker exited without returning a result.'));
      }
    });
  });
}

module.exports = { loadDailyfuscator, obfuscateDailyfuscatorInWorker };
