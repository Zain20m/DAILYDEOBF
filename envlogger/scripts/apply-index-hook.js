#!/usr/bin/env node
'use strict';
/**
 * Wire ENVLOGGER into index.js so `.l` always gets a Discord reply.
 */
const fs = require('fs');
const path = require('path');
const indexPath = path.join(__dirname, '..', '..', 'index.js');
let src = fs.readFileSync(indexPath, 'utf8');
let changed = false;

const WORKFLOW_FN = `async function startEnvLogWorkflow(message, inlineText = null) {
  try {
    return await require('./envlogger/discord-integration').startEnvLogWorkflow(message, inlineText, {
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
  } catch (error) {
    const msg = String(error && error.message || error).slice(0, 1500);
    try {
      await message.reply({ content: '❌ ENVLOGGER failed: ' + msg, allowedMentions: { repliedUser: false } });
    } catch (_) {
      try { await message.channel.send('❌ ENVLOGGER failed: ' + msg); } catch (__) {}
    }
  }
}
`;

// 1) Workflow function
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
  console.log('[envlogger] startEnvLogWorkflow wired');
} else {
  console.log('[envlogger] workflow already wired');
}

// 2) EARLY route — right after `const command = parts[0].toLowerCase();`
//    so nothing else can swallow `.l` in silence.
const EARLY = `
  // --- ENVLOGGER early route (must reply) ---
  if (command === '.l' || command === '.envlog' || command === '.envlogger') {
    try {
      if (typeof startEnvLogWorkflow !== 'function') {
        await message.reply({ content: 'ENVLOGGER is not wired (startEnvLogWorkflow missing). Restart the bot.', allowedMentions: { repliedUser: false } });
        return;
      }
      if (activeUsers.has(message.author.id)) {
        await message.reply({ content: 'You already have an active job. Finish it or wait for it to expire.', allowedMentions: { repliedUser: false } });
        return;
      }
      activeUsers.add(message.author.id);
      try {
        const inline = content.slice(command.length).trim() || null;
        await startEnvLogWorkflow(message, inline);
      } finally {
        activeUsers.delete(message.author.id);
      }
    } catch (error) {
      const msg = String(error && error.message || error).slice(0, 1500);
      try {
        await message.reply({ content: '❌ ENVLOGGER failed: ' + msg, allowedMentions: { repliedUser: false } });
      } catch (_) {
        try { await message.channel.send('❌ ENVLOGGER failed: ' + msg); } catch (__) {}
      }
    }
    return;
  }
  // --- end ENVLOGGER early route ---
`;

// Remove older injected routes to avoid double-handling
if (src.includes('ENVLOGGER early route')) {
  console.log('[envlogger] early route already present');
} else {
  const anchors = [
    "  const command = parts[0].toLowerCase();\n  const subcommand = (parts[1] || '').toLowerCase();\n",
    "  const command = parts[0].toLowerCase();\n",
  ];
  let inserted = false;
  for (const a of anchors) {
    if (src.includes(a)) {
      src = src.replace(a, a + '\n' + EARLY + '\n');
      inserted = true;
      changed = true;
      console.log('[envlogger] inserted EARLY .l route');
      break;
    }
  }
  if (!inserted) {
    // fallback: before .help / .fetch
    const markers = [
      "if (command === '.help')",
      "if (command === '.fetch' || command === '.beautify')",
      "if (command === '.get')",
      'if (command !== PREFIX)',
    ];
    for (const m of markers) {
      const idx = src.indexOf(m);
      if (idx >= 0) {
        src = src.slice(0, idx) + EARLY + '\n' + src.slice(idx);
        inserted = true;
        changed = true;
        console.log('[envlogger] inserted .l route before', m.slice(0, 40));
        break;
      }
    }
  }
  if (!inserted) {
    console.error('[envlogger] CRITICAL: could not insert .l route');
    process.exit(1);
  }
}

// Strip duplicate older route blocks that only matched mid-handler
src = src.replace(
  /\n  if \(command === '\.l' \|\| command === '\.envlog' \|\| command === '\.envlogger'\) \{[\s\S]*?\n    return;\n  \}\n/,
  (m) => (m.includes('ENVLOGGER early route') ? m : '\n')
);

// 3) Prefix log
const NEW_PREFIX_LOG = "console.log('Prefix commands: .deobf, .get, .fetch, .beautify, .l, .help');";
if (src.includes('Prefix commands:') && !src.includes('.l, .help')) {
  src = src.replace(/console\.log\('Prefix commands:[^']*'\);/, NEW_PREFIX_LOG);
  changed = true;
  console.log('[envlogger] prefix log lists .l');
}

// 4) help
if (!src.includes(".l [URL/file/code]")) {
  const helpNeedle = "'.beautify [file/code] - format and semantically clean Luau with Beautify'";
  if (src.includes(helpNeedle)) {
    src = src.replace(
      helpNeedle,
      helpNeedle + ",\n    '.l [URL/file/code] - ENVLOGGER: offline sandbox log + reconstructed behavior .lua'"
    );
    changed = true;
    console.log('[envlogger] help lists .l');
  }
}

fs.writeFileSync(indexPath, src);
console.log('[envlogger] wrote index.js (' + src.length + ' bytes) changed=' + changed);

// Verify
const check = fs.readFileSync(indexPath, 'utf8');
if (!check.includes("command === '.l'")) {
  console.error('[envlogger] VERIFY FAILED: .l still missing');
  process.exit(1);
}
console.log('[envlogger] VERIFY ok: .l route present');
