#!/usr/bin/env node
/** One-shot: rewrite startEnvLogWorkflow in index.js to use ENVLOGGER */
const fs = require('fs');
const path = require('path');
const indexPath = path.join(__dirname, '..', '..', 'index.js');
let src = fs.readFileSync(indexPath, 'utf8');
const start = src.indexOf('async function startEnvLogWorkflow(message, inlineText = null) {');
if (start < 0) {
  console.error('startEnvLogWorkflow not found');
  process.exit(1);
}
const end = src.indexOf('\nasync function ', start + 10);
if (end < 0) {
  console.error('could not find end of startEnvLogWorkflow');
  process.exit(1);
}
const newFn = `async function startEnvLogWorkflow(message, inlineText = null) {
  // ENVLOGGER (replaces old v15 --no-devirt envlog path)
  return require('./envlogger/discord-integration').startEnvLogWorkflow(message, inlineText, {
    dailyEmbed,
    DAILY_COLORS,
    inputFromAttachment,
    inputFromUrlText,
    collectInput,
    formatBytes,
    formatDuration,
    sha256Hex,
    splitUtf8Buffer,
    AttachmentBuilder,
    MAX_ATTACHMENT_PART_BYTES,
  });
}
`;
src = src.slice(0, start) + newFn + src.slice(end);
src = src.replace(
  '.l [URL/file/code] - environment log: run the script in the offline sandbox and log what it does',
  '.l [URL/file/code] - ENVLOGGER: offline sandbox behaviour log (services, HTTP, remotes, loadstring, ANTIVM)'
);
fs.writeFileSync(indexPath, src);
console.log('patched', indexPath, 'bytes', src.length);
