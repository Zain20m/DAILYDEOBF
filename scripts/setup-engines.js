'use strict';

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

const engines = [
  {
    label: 'Luraph v15',
    directory: 'luraph-v15-engine',
    required: [
      'deob.py',
      'harness.py',
      'envlog.luau',
      'roblox_api.luau',
      'unicode_data.luau',
      'datatypes.luau',
      'obfuscators/luraph_v15/__init__.py',
      'obfuscators/luraph_v15/driver.py',
      'obfuscators/luraph_v15/devirt.py',
      'obfuscators/ironbrew1/__init__.py',
      'obfuscators/ironbrew1/capture.luau',
      'obfuscators/ironbrew1/deflatten.py',
      'obfuscators/ironbrew1/devirt.py',
      'obfuscators/ironbrew1/forloops.py',
      'obfuscators/ironbrew1/instrument.py',
      'obfuscators/ironbrew1/listing.py',
      'bin/luau',
      'bin/luau-ast',
    ],
  },
  {
    label: 'Luraph v14.7 / v14.8 / v14.9',
    directory: 'luraph-v14-engine',
    required: [
      'cli.py',
      'harness.py',
      'envlog.luau',
      'roblox_api.luau',
      'unicode_data.luau',
      'datatypes.luau',
      'backend.py',
      'ir.py',
      'luasym.py',
      'localfuncs.py',
      'idioms.py',
      'names.py',
      'spacing.py',
      'lexer.py',
      'luauast.py',
      'gen_roblox.py',
      'gen_unicode.py',
      'build_luau.py',
      'codegen.py',
      'structure.py',
      'variables.py',
      'loops.py',
      'fold.py',
      'tidy.py',
      'traceout.py',
      'obfuscators/base.py',
      'obfuscators/luraph_v14_7/__init__.py',
      'obfuscators/luraph_v14_7/driver.py',
      'obfuscators/luraph_v14_7/devirt.py',
      'obfuscators/luraph_v14_7/vmmap.py',
      'obfuscators/luraph_v14_8/__init__.py',
      'obfuscators/luraph_v14_8/driver.py',
      'obfuscators/luraph_v14_8/devirt.py',
      'obfuscators/luraph_v14_8/vmmap.py',
      'obfuscators/luraph_v14_9/__init__.py',
      'obfuscators/luraph_v14_9/driver.py',
      'obfuscators/luraph_v14_9/devirt.py',
      'obfuscators/luraph_v14_9/vmmap.py',
      'bin/luau',
      'bin/luau-ast',
    ],
  },
  {
    label: 'Luraph 15.1',
    directory: 'luraph-v15.1-engine',
    required: [
      'deob.js',
      'src/detect.js',
      'src/driver.js',
      'src/harness.js',
      'core/obfuscators/luraph_v15/__init__.py',
      'runtime/envlog.luau',
      'bin/luau',
      'bin/luau-ast',
    ],
  },
  {
    label: 'Centurion v6 / v6.1',
    directory: 'centurion-engine',
    required: [
      'centurion.py',
      'p2d_errors.json',
      'callerr_rules.json',
      'enumprops.json',
      'httpresps.json',
      'guessed_p2d.json',
    ],
  },
];

function cleanPythonCache(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory() && entry.name === '__pycache__') {
      fs.rmSync(fullPath, { recursive: true, force: true });
      continue;
    }
    if (entry.isDirectory()) {
      cleanPythonCache(fullPath);
      continue;
    }
    if (entry.isFile() && /\.(?:pyc|pyo)$/.test(entry.name)) {
      fs.rmSync(fullPath, { force: true });
    }
  }
}


const v14Directory = path.join(root, 'luraph-v14-engine');
const v14Bin = path.join(v14Directory, 'bin');
const sharedV15Bin = path.join(root, 'luraph-v15-engine', 'bin');
fs.mkdirSync(v14Bin, { recursive: true });
for (const binary of ['luau', 'luau-ast']) {
  const source = path.join(sharedV15Bin, binary);
  const destination = path.join(v14Bin, binary);
  if (!fs.existsSync(source)) {
    throw new Error('Shared Luau runtime is missing: ' + source);
  }
  fs.copyFileSync(source, destination);
}

for (const engine of engines) {
  const base = path.join(root, engine.directory);
  if (!fs.existsSync(base) || !fs.statSync(base).isDirectory()) {
    throw new Error(engine.label + ' engine directory is missing.');
  }

  for (const relative of engine.required) {
    const fullPath = path.join(base, relative);
    if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) {
      throw new Error(engine.label + ' engine is missing ' + relative);
    }
  }

  cleanPythonCache(base);

  if (process.platform !== 'win32') {
    for (const binary of ['luau', 'luau-ast']) {
      const runtimeBinary = path.join(base, 'bin', binary);
      if (fs.existsSync(runtimeBinary)) fs.chmodSync(runtimeBinary, 0o755);
    }
  }
}

console.log('Validated separate Luraph v14.7/v14.8/v14.9, v15, 15.1, IronBrew 1 and Centurion engines.');
