#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const indexPath = path.join(__dirname, '..', '..', 'index.js');
let src = fs.readFileSync(indexPath, 'utf8');
if (src.includes("require('./envlogger/discord-integration')") || src.includes('require("./envlogger/discord-integration")')) {
  console.log('[envlogger] index.js already hooked');
  process.exit(0);
}
const start = src.indexOf('async function startEnvLogWorkflow(');
if (start < 0) {
  const inject = `
async function startEnvLogWorkflow(message, inlineText = null) {
  return require('./envlogger/discord-integration').startEnvLogWorkflow(message, inlineText, {
    dailyEmbed, DAILY_COLORS, inputFromAttachment, inputFromUrlText, collectInput,
    formatBytes, formatDuration, sha256Hex, splitUtf8Buffer, AttachmentBuilder, MAX_ATTACHMENT_PART_BYTES,
  });
}
`;
  const anchor = src.indexOf('async function startDeobfWorkflow');
  if (anchor > 0) src = src.slice(0, anchor) + inject + '\n' + src.slice(anchor);
  else src = inject + '\n' + src;
  fs.writeFileSync(indexPath, src);
  console.log('[envlogger] injected startEnvLogWorkflow');
  process.exit(0);
}
const end = src.indexOf('\nasync function ', start + 10);
if (end < 0) { console.error('could not find end of startEnvLogWorkflow'); process.exit(1); }
const newFn = `async function startEnvLogWorkflow(message, inlineText = null) {
  return require('./envlogger/discord-integration').startEnvLogWorkflow(message, inlineText, {
    dailyEmbed, DAILY_COLORS, inputFromAttachment, inputFromUrlText, collectInput,
    formatBytes, formatDuration, sha256Hex, splitUtf8Buffer, AttachmentBuilder, MAX_ATTACHMENT_PART_BYTES,
  });
}
`;
src = src.slice(0, start) + newFn + src.slice(end);
fs.writeFileSync(indexPath, src);
console.log('[envlogger] patched startEnvLogWorkflow -> discord-integration');
