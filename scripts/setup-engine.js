'use strict';

const fs = require('node:fs');
const path = require('node:path');
const AdmZip = require('adm-zip');

const root = path.resolve(__dirname, '..');
const vendorDir = path.join(root, 'vendor');
const archivePath = path.join(vendorDir, 'luraph-15.1-engine.zip');
const engineDir = path.join(root, 'luraph-v15.1-engine');

const chunkNames = [
  ...Array.from({ length: 7 }, (_, index) => `luraph-engine.part${String(index).padStart(2, '0')}.b64`),
  'luraph-engine.part07a.b64',
  'luraph-engine.part07b.b64',
  'luraph-engine.part07c.b64',
  'luraph-engine.part08.b64',
];

const missing = chunkNames.filter((name) => !fs.existsSync(path.join(vendorDir, name)));
if (missing.length) throw new Error(`Missing bundled Luraph 15.1 archive parts: ${missing.join(', ')}`);

const encoded = chunkNames.map((name) => fs.readFileSync(path.join(vendorDir, name), 'utf8').trim()).join('');
if (encoded.length !== 49_200) {
  throw new Error(`Luraph 15.1 archive size mismatch: expected 49200 base64 characters, got ${encoded.length}.`);
}

fs.writeFileSync(archivePath, Buffer.from(encoded, 'base64'));
fs.rmSync(engineDir, { recursive: true, force: true });
fs.mkdirSync(engineDir, { recursive: true });
try {
  new AdmZip(archivePath).extractAllTo(engineDir, true);
} finally {
  fs.rmSync(archivePath, { force: true });
}

if (!fs.existsSync(path.join(engineDir, 'bin', 'luraph-deobf.js'))) {
  throw new Error('Luraph 15.1 archive is incomplete: CLI entry point not found.');
}
console.log('Prepared separate Luraph 15.1 engine.');
