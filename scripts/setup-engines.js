'use strict';

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const base = path.join(root, 'luraph-v15-engine', 'deobf');
const required = [
  'deob.py',
  'harness.py',
  'envlog.luau',
  'roblox_api.luau',
  'unicode_data.luau',
  'datatypes.luau',
  'obfuscators/__init__.py',
  'obfuscators/luraph_v15/__init__.py',
  'obfuscators/luraph_v15/driver.py',
  'obfuscators/luraph_v15/devirt.py',
  'bin/luau',
  'bin/luau-ast',
];

for (const relative of required) {
  const fullPath = path.join(base, relative);
  if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) {
    throw new Error('Original Luraph v15/15.1 engine is missing ' + relative);
  }
}

function cleanPythonCache(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory() && entry.name === '__pycache__') {
      fs.rmSync(fullPath, { recursive: true, force: true });
      continue;
    }
    if (entry.isDirectory()) cleanPythonCache(fullPath);
    else if (entry.isFile() && /\.(?:pyc|pyo)$/.test(entry.name)) {
      fs.rmSync(fullPath, { force: true });
    }
  }
}

cleanPythonCache(base);
if (process.platform !== 'win32') {
  fs.chmodSync(path.join(base, 'bin', 'luau'), 0o755);
  fs.chmodSync(path.join(base, 'bin', 'luau-ast'), 0o755);
}

console.log('Validated shared full-analysis Luraph v15 and 15.1 engine.');
