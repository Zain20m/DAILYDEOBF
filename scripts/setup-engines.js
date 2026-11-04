'use strict';

const fs = require('node:fs');
const path = require('node:path');
const AdmZip = require('adm-zip');

const root = path.resolve(__dirname, '..');
const vendorDir = path.join(root, 'vendor');
const engineDir = path.join(root, 'luraph-v15.1-engine');
const archivePath = path.join(root, 'luraph-v15.1-engine.zip');

const chunkNames = Array.from({ length: 7 }, (_, index) =>
  'luraph-engine.part' + String(index).padStart(2, '0') + '.b64'
).concat([
  'luraph-engine.part07a.b64',
  'luraph-engine.part07b.b64',
  'luraph-engine.part07c.b64',
  'luraph-engine.part08.b64',
]);

const missing = chunkNames.filter((name) => !fs.existsSync(path.join(vendorDir, name)));
if (missing.length) {
  throw new Error('Missing Luraph 15.1 bundle parts: ' + missing.join(', '));
}

const encoded = chunkNames
  .map((name) => fs.readFileSync(path.join(vendorDir, name), 'utf8').trim())
  .join('');

if (encoded.length !== 49_200) {
  throw new Error('Luraph 15.1 bundle size mismatch: ' + encoded.length + ' base64 characters.');
}

fs.writeFileSync(archivePath, Buffer.from(encoded, 'base64'));
fs.rmSync(engineDir, { recursive: true, force: true });
fs.mkdirSync(engineDir, { recursive: true });

try {
  new AdmZip(archivePath).extractAllTo(engineDir, true);
} finally {
  fs.rmSync(archivePath, { force: true });
}

const cli = path.join(engineDir, 'bin', 'luraph-deobf.js');
if (!fs.existsSync(cli)) {
  throw new Error('Luraph 15.1 CLI was not found after extraction.');
}

console.log('Prepared separate Luraph 15.1 engine.');
