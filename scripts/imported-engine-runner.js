'use strict';

const path = require('node:path');
const { spawn } = require('node:child_process');

const engines = {
  clyde: require('../deobfuscators/clyde_static_deob'),
  hercules: require('../deobfuscators/hercules_deob'),
  fuscator77: require('../deobfuscators/77fuscator_deob'),
  moonsec: require('../deobfuscators/moonsec_deob'),
  goofyscator: require('../deobfuscators/goofyscator_deob'),
  psu: require('../deobfuscators/psu_deob'),
  luaobf: require('../deobfuscators/LuaObf-Deobf/deobf'),
};

const ROOT = path.resolve(__dirname, '..');
const PYTHON = process.env.PYTHON_BIN || (process.platform === 'win32' ? 'python' : 'python3');

function run(command, args, cwd, timeoutMs = 300000) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: process.env,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    const max = 2 * 1024 * 1024;
    child.stdout.on('data', (chunk) => { if (stdout.length < max) stdout += chunk.toString('utf8').slice(0, max - stdout.length); });
    child.stderr.on('data', (chunk) => { if (stderr.length < max) stderr += chunk.toString('utf8').slice(0, max - stderr.length); });
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      const error = new Error('Engine timed out after ' + Math.round(timeoutMs / 1000) + ' seconds.');
      error.stdout = stdout; error.stderr = stderr;
      reject(error);
    }, timeoutMs);
    child.once('error', (error) => { clearTimeout(timer); reject(error); });
    child.once('close', (code, signal) => {
      clearTimeout(timer);
      if (code === 0) return resolve({ stdout, stderr });
      const error = new Error('Engine exited with code ' + code + (signal ? ' (' + signal + ')' : '') + '.');
      error.stdout = stdout; error.stderr = stderr; error.code = code;
      reject(error);
    });
  });
}

async function execute(engineId, source, filename) {
  const src = String(source || '');
  if (!src.trim()) throw new Error('Input source is empty.');
  let result;

  if (engineId === 'clyde') result = engines.clyde.deobfuscateClyde(src);
  else if (engineId === 'hercules') result = await engines.hercules.deobfuscateHercules(src);
  else if (engineId === 'fuscator77') result = await engines.fuscator77.deobfuscate77fuscator(src);
  else if (engineId === 'moonsec') result = await engines.moonsec.deobfuscateMoonsec(src);
  else if (engineId === 'goofyscator') result = await engines.goofyscator.deobfuscateGoofyscator(src);
  else if (engineId === 'moonveil') {
    const strings = [];
    const pattern = /\bl\s*"((?:[^"\\]|\\.)*)"/g;
    let match;
    while ((match = pattern.exec(src)) !== null && strings.length < 300) {
      const value = match[1].replace(/\\n/g, '\n').replace(/\\r/g, '\r')
        .replace(/\\t/g, '\t').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
      if (value.length >= 2 && !strings.includes(value)) strings.push(value);
    }
    if (!strings.length) throw new Error('The MoonVeil file has no statically recoverable inline string envelope. Hosted/key-only stubs need the actual payload file.');
    result = {
      success: true,
      output: '-- MoonVeil static envelope report\n-- Partial analysis only. This does not reconstruct the runtime VM.\n\n' +
        strings.map((value, index) => '-- [' + (index + 1) + '] ' + JSON.stringify(value)).join('\n'),
      stats: { type: 'MoonVeil static envelope', recoveredStrings: strings.length, completeDeobfuscation: false },
    };
  }
  else if (engineId === 'psu') result = await engines.psu.deobfuscatePsu(src);
  else if (engineId === 'luaobf') {
    const decoded = engines.luaobf.deobf(src, { log: false });
    result = { success: true, output: decoded.reconstructed || decoded.lua || decoded.lifted, stats: { type: 'LuaObfuscator.com' } };
  } else if (engineId === 'prostone' || engineId === 'luast') {
    const os = require('node:os');
    const fs = require('node:fs/promises');
    const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'daily-imported-' + engineId + '-'));
    const input = path.join(temp, 'input.lua');
    const output = path.join(temp, 'output.luau');
    try {
      await fs.writeFile(input, src, { encoding: 'utf8', mode: 0o600 });
      if (engineId === 'prostone') {
        await run(process.execPath, [
          path.join(ROOT, 'deobfuscators', 'ProstoneDeobf', 'bin', 'pdeobf.js'),
          input, '-o', output, '-q',
        ], path.join(ROOT, 'deobfuscators', 'ProstoneDeobf'), 300000);
      } else {
        await run(PYTHON, [
          path.join(ROOT, 'luast-engine', 'deobfuscate.py'),
          input, '-o', output,
        ], path.join(ROOT, 'luast-engine'), 300000);
      }
      const outputText = await fs.readFile(output, 'utf8').catch(() => '');
      result = { success: Boolean(outputText.trim()), output: outputText, stats: { type: engineId === 'prostone' ? 'Prometheus / Prostone' : 'LUAST v1.0.1' } };
      if (!result.success) throw new Error('The ' + engineId + ' engine did not produce an output file.');
    } finally {
      await fs.rm(temp, { recursive: true, force: true }).catch(() => {});
    }
  } else {
    throw new Error('Unknown imported engine: ' + engineId);
  }

  if (!result || !result.success) {
    throw new Error(String(result && result.error || 'The selected engine could not reconstruct this input.'));
  }
  const output = String(result.output || '').trim();
  if (!output) throw new Error('The selected engine returned empty output.');
  return { output, stats: result.stats || null };
}

module.exports = { execute };
