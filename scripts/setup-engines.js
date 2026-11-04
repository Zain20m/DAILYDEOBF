'use strict';

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const engines = [
  { label: 'Luraph v15', directory: 'luraph-v15-engine' },
  { label: 'Luraph 15.1', directory: 'luraph-v15.1-engine' },
];

for (const engine of engines) {
  const base = path.join(root, engine.directory);
  const required = [
    'deob.js',
    'src/detect.js',
    'src/driver.js',
    'src/harness.js',
    'core/obfuscators/luraph_v15/__init__.py',
    'runtime/envlog.luau',
    'bin/luau',
    'bin/luau-ast',
  ];
  for (const relative of required) {
    const fullPath = path.join(base, relative);
    if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) {
      throw new Error(engine.label + ' engine is missing ' + relative);
    }
  }
  if (process.platform !== 'win32') {
    fs.chmodSync(path.join(base, 'bin/luau'), 0o755);
    fs.chmodSync(path.join(base, 'bin/luau-ast'), 0o755);
  }
}

console.log('Validated independent Luraph v15 and 15.1 engines.');