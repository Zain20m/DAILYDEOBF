'use strict';

const fs = require('node:fs');
const path = require('node:path');
const AdmZip = require('adm-zip');

const root = path.resolve(__dirname, '..');
const encodedPath = path.join(root, 'vendor', 'luraph-engine.zip.b64');
const archivePath = path.join(root, 'vendor', 'luraph-engine.zip');
const engineDir = path.join(root, 'engine');

if (!fs.existsSync(encodedPath)) throw new Error('Missing bundled Luraph engine archive.');
fs.mkdirSync(path.dirname(archivePath), { recursive: true });
fs.writeFileSync(archivePath, Buffer.from(fs.readFileSync(encodedPath, 'utf8').trim(), 'base64'));
fs.rmSync(engineDir, { recursive: true, force: true });
fs.mkdirSync(engineDir, { recursive: true });
new AdmZip(archivePath).extractAllTo(engineDir, true);
fs.rmSync(archivePath, { force: true });

const cli = path.join(engineDir, 'bin', 'luraph-deobf.js');
if (!fs.existsSync(cli)) throw new Error('The Luraph engine archive is incomplete.');
console.log('Prepared bundled Luraph 15.1 engine.');
