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
    fs.chmodSync(path.join(base, 'bin', 'luau'), 0o755);
    fs.chmodSync(path.join(base, 'bin', 'luau-ast'), 0o755);
  }
}

console.log('Validated independent Luraph v15 and Luraph 15.1 engines.');
