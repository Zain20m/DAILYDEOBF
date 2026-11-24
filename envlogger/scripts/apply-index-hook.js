#!/usr/bin/env node
'use strict';
/**
 * Wire ENVLOGGER into index.js:
 * 1) startEnvLogWorkflow -> discord-integration
 * 2) .l message route
 * 3) help + prefix log lines
 */
const fs = require('fs');
const path = require('path');
const indexPath = path.join(__dirname, '..', '..', 'index.js');
let src = fs.readFileSync(indexPath, 'utf8');
let changed = false;

const WORKFLOW_FN = `async function startEnvLogWorkflow(message, inlineText = null) {
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

// 1) Ensure workflow function exists / points at envlogger
if (!src.includes("require('./envlogger/discord-integration')") &&
    !src.includes('require("./envlogger/discord-integration")')) {
  const start = src.indexOf('async function startEnvLogWorkflow(');
  if (start >= 0) {
    const end = src.indexOf('\nasync function ', start + 10);
    if (end < 0) {
      console.error('[envlogger] could not find end of startEnvLogWorkflow');
      process.exit(1);
    }
    src = src.slice(0, start) + WORKFLOW_FN + src.slice(end);
  } else {
    const anchor = src.indexOf('async function startWorkflow(');
    if (anchor > 0) src = src.slice(0, anchor) + WORKFLOW_FN + '\n' + src.slice(anchor);
    else src = WORKFLOW_FN + '\n' + src;
  }
  changed = true;
  console.log('[envlogger] startEnvLogWorkflow wired to discord-integration');
} else {
  console.log('[envlogger] startEnvLogWorkflow already points at discord-integration');
}

// 2) Message route for .l
const ROUTE = `
  if (command === '.l' || command === '.envlog' || command === '.envlogger') {
    if (activeUsers.has(message.author.id)) {
      await message.reply('You already have an active job. Finish it or wait for it to expire.');
      return;
    }
    activeUsers.add(message.author.id);
    try {
      const inline = content.slice(command.length).trim() || null;
      await startEnvLogWorkflow(message, inline);
    } catch (error) {
      await message.reply('\u274c ENVLOGGER failed: ' + String(error.message || error).slice(0, 1500)).catch(() => {});
    } finally {
      activeUsers.delete(message.author.id);
    }
    return;
  }

`;

if (!src.includes("command === '.l'") && !src.includes('command === ".l"')) {
  // Prefer insert just before .fetch / .beautify block
  const markers = [
    "if (command === '.fetch' || command === '.beautify')",
    'if (command === ".fetch" || command === ".beautify")',
    "if (command === '.get')",
    'if (command === ".get")',
    'if (command !== PREFIX)',
  ];
  let inserted = false;
  for (const m of markers) {
    const idx = src.indexOf(m);
    if (idx >= 0) {
      src = src.slice(0, idx) + ROUTE + src.slice(idx);
      inserted = true;
      changed = true;
      console.log('[envlogger] inserted .l route before:', m.slice(0, 40));
      break;
    }
  }
  if (!inserted) {
    console.error('[envlogger] CRITICAL: could not find a place to insert .l route');
    process.exit(1);
  }
} else {
  console.log('[envlogger] .l route already present');
}

// 3) Prefix log line
const OLD_PREFIX_LOG = "console.log('Prefix commands: .deobf, .get, .fetch, .beautify, .help');";
const NEW_PREFIX_LOG = "console.log('Prefix commands: .deobf, .get, .fetch, .beautify, .l, .help');";
if (src.includes(OLD_PREFIX_LOG)) {
  src = src.replace(OLD_PREFIX_LOG, NEW_PREFIX_LOG);
  changed = true;
  console.log('[envlogger] updated Prefix commands log');
} else if (src.includes(".l, .help") || src.includes('.l, .help')) {
  console.log('[envlogger] Prefix commands log already lists .l');
} else if (src.includes('Prefix commands:')) {
  src = src.replace(
    /console\.log\('Prefix commands:[^']*'\);/,
    NEW_PREFIX_LOG
  );
  changed = true;
  console.log('[envlogger] replaced Prefix commands log line');
}

// 4) helpText entries
if (!src.includes(".l [URL/file/code]")) {
  const helpNeedle = "'.beautify [file/code] - format and semantically clean Luau with Beautify'";
  if (src.includes(helpNeedle)) {
    src = src.replace(
      helpNeedle,
      helpNeedle +
        ",\n    '.l [URL/file/code] - ENVLOGGER: offline sandbox log + reconstructed behavior .lua'"
    );
    changed = true;
    console.log('[envlogger] added .l to helpText');
  } else {
    console.warn('[envlogger] helpText needle not found; .help may not list .l');
  }
}

if (changed) {
  fs.writeFileSync(indexPath, src);
  console.log('[envlogger] wrote', indexPath, 'bytes', src.length);
} else {
  console.log('[envlogger] index.js already fully wired');
}
