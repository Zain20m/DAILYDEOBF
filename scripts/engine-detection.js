'use strict';

// Obfuscator / engine detector for the .deobf picker.
//
// The old detector only matched a "Luraph vX.Y" banner anywhere in the file
// (so a stripped header gave no suggestion, unsupported versions gave none,
// and any string mentioning "Luraph 3" or a variable named ib2 produced a
// confident wrong answer). This one:
//   * reads banners only from the file header (leading comments / the first
//     obfuscator="..." string), not from arbitrary code or string data,
//   * falls back to structural fingerprints of each VM layout when the banner
//     was stripped,
//   * maps unsupported versions to the nearest engine with lower confidence,
//   * recognises every obfuscator that has an engine button (Fulcrum, 2HBJ,
//     Centurion, IronBrew, JNKIE, LuaProtect, Vantarmor) and names common
//     ones the bot has no engine for, and
//   * recognises files that are already deobfuscated output.
//
// Result: null, or { engine, label, confidence, reason, alternatives }.
// `engine` is the picker id (null when no engine fits); `alternatives` lists
// other engine ids worth trying, best first.

const { detectIronBrewSuggestion } = require('./ironbrew-detection');

const LURAPH_ENGINES = {
  '14.3': ['luraph-v143', 'Luraph 14.3'],
  '14.7': ['luraph-v147', 'Luraph 14.7'],
  '14.8': ['luraph-v148', 'Luraph 14.8'],
  '14.9': ['luraph-v149', 'Luraph 14.9'],
  '15': ['luraph-v15', 'Luraph v15'],
  '15.1': ['luraph-151', 'Luraph 15.1'],
  '15.2': ['luraph-152', 'Luraph 15.2'],
};

const LURAPH_14_FAMILY = ['luraph-v149', 'luraph-v148', 'luraph-v147'];

function result(engine, label, confidence, reason, alternatives = []) {
  return { engine, label, confidence, reason, alternatives: alternatives.filter((id) => id && id !== engine) };
}

// The header: leading blank lines and comments, plus the first statement
// (2HBJ stores its banner in an obfuscator="..." string there).
function headerOf(text) {
  const m = /^(?:\s*(?:--\[(=*)\[[\s\S]*?\]\1\]|--[^\n]*))*/.exec(text);
  const comments = m ? m[0] : '';
  return comments + text.slice(comments.length, comments.length + 600);
}

function count(text, re) {
  const m = text.match(re);
  return m ? m.length : 0;
}

function luraphFromVersion(version) {
  const v = String(version).replace(/\.0$/, '');
  if (LURAPH_ENGINES[v]) {
    const [engine, label] = LURAPH_ENGINES[v];
    const alts = v.startsWith('14.') && v !== '14.3' ? LURAPH_14_FAMILY
      : (v === '15' ? ['luraph-151'] : v === '15.1' ? ['luraph-v15'] : v === '15.2' ? ['luraph-151', 'luraph-v15'] : []);
    return result(engine, label, 'high', 'The file header names Luraph v' + v + '.', alts);
  }
  const [major, minor] = v.split('.').map(Number);
  if (major === 14 && minor >= 4 && minor <= 6) {
    return result('luraph-v147', 'Luraph 14.7', 'medium',
      'The header names Luraph v' + v + ', which has no dedicated engine; v14.7 is the closest VM layout.',
      ['luraph-v148', 'luraph-v149', 'luraph-v143']);
  }
  if (major === 14 && minor < 4) {
    return result('luraph-v143', 'Luraph 14.3', 'medium',
      'The header names Luraph v' + v + ', which has no dedicated engine; v14.3 is the closest.', ['luraph-v147']);
  }
  if (major === 15 || (major === 14 && minor > 9)) {
    return result('luraph-152', 'Luraph 15.2', 'medium',
      'The header names Luraph v' + v + ', which has no dedicated engine; it shares the v15.1 VM family.', ['luraph-151', 'luraph-v15']);
  }
  if (major > 15) {
    return result('luraph-152', 'Luraph 15.2', 'low',
      'The header names Luraph v' + v + ', newer than any engine here; the v15.2 route is the closest and may not work.', ['luraph-151', 'luraph-v15']);
  }
  return result(null, 'Luraph v' + v, 'medium', 'The header names Luraph v' + v + ', which no engine here supports.');
}

// Structural fingerprints for a Luraph VM whose banner was removed.
function luraphShape(text, bodyStart) {
  const head = bodyStart.slice(0, 4000);
  // v15 / 15.1: return setmetatable({[24]=buffer.writeu8,[97]=string.sub,...
  if (/^return\s*setmetatable\s*\(\s*\{/.test(head)) {
    const libSlots = count(head, /\[\d+\]\s*=\s*(?:bit32|buffer|string|table|math|utf8|coroutine)\.\w+/g);
    if (libSlots >= 3 || /\bLPH_/.test(text.slice(0, 200000))) {
      const lph = /\bLPH_(?:ENCFUNC|ENCNUM|ENCSTR|JIT|NO_VIRTUALIZE|CRASH|ATTRIBUTES|PRECHECK|ASSUME|ENCBUF)\b/.test(text);
      return result('luraph-151', 'Luraph 15.x', 'medium',
        'No version header, but the file has the Luraph v15 VM layout (return setmetatable({...}) with ' +
        libSlots + ' numeric library slots' + (lph ? ' and LPH_ macros' : '') + '). Try 15.1 first, then v15.',
        ['luraph-v15']);
    }
  }
  // v14.x: return({Ab=function(...)...,Cd=function(...)...}) with hex/binary
  // literals, digit separators and continue.
  if (/^return\s*\(\s*\{/.test(head)) {
    const sample = text.slice(0, 300000);
    const keyFns = count(sample, /[,{]\s*[A-Za-z_]\w{0,3}\s*=\s*function\s*\(/g);
    const hexBin = count(sample, /\b0[xXbB][0-9a-fA-F_]+/g);
    const cont = count(sample, /\bcontinue\b/g);
    if (keyFns >= 20 && hexBin >= 50) {
      return result('luraph-v149', 'Luraph 14.x', cont >= 5 ? 'medium' : 'low',
        'No version header, but the file has the Luraph v14 VM layout (return({...}) with ' + keyFns +
        ' method entries and ' + hexBin + ' hex/binary literals). The exact 14.x version cannot be read ' +
        'from the layout: try 14.9, then 14.8, then 14.7.',
        ['luraph-v148', 'luraph-v147']);
    }
  }
  if (/^local\s+init\s*=\s*\(\s*function\s*\(\.\.\.\)/.test(head) && head.includes('return({')) {
    return result('luraph-v148', 'Luraph 14.8', 'medium', 'The file has the init-wrapper layout seen in Luraph v14.8 builds.', LURAPH_14_FAMILY);
  }
  return null;
}

function alreadyDeobfuscated(text) {
  const head = text.slice(0, 20000);
  if (/^--\s*Devirtualized with Luraph|Luraph runtime function \(from the VM object|^--\s*Recovered by DAILY/m.test(head) ||
      count(text, /error\(["']devirt: /g) >= 1 && /\bpayload_fn_\d+|\bupv\d+\b/.test(head)) {
    return result(null, 'already-deobfuscated output', 'high',
      'This looks like output from one of the deobfuscators here (devirtualizer headers / devirt markers), not a protected script. Running it through an engine again will not recover more.');
  }
  return null;
}

function detectEngineSuggestion(source) {
  const raw = String(source || '').replace(/^﻿/, '');
  if (!raw.trim()) return null;
  const text = raw.length > 4 * 1024 * 1024 ? raw.slice(0, 4 * 1024 * 1024) : raw;
  const header = headerOf(text);
  const bodyStart = (() => {
    const m = /^(?:\s*(?:--\[(=*)\[[\s\S]*?\]\1\]|--[^\n]*))*\s*/.exec(text);
    return text.slice(m ? m[0].length : 0);
  })();

  // Obfuscators write their banners as leading comments; only trust them there.
  const commentHeader = (/^(?:\s*(?:--\[(=*)\[[\s\S]*?\]\1\]|--[^\n]*))*/.exec(text) || [''])[0];

  const done = alreadyDeobfuscated(text);
  if (done) return done;

  // ---- explicit banners in the header -----------------------------------
  const luraph = commentHeader.match(/protected\s+(?:by|using|with)\s+Luraph(?:\s+Obfuscator)?\s*(?:version\s*)?v?\s*(\d+(?:\.\d+)?)/i) ||
    commentHeader.match(/\bLuraph(?:\s+Obfuscator)?\s+v(?:ersion\s*)?\s*(\d+(?:\.\d+)?)/i);
  if (luraph) return luraphFromVersion(luraph[1]);

  if (/obfuscated\s+(?:by|with|using)\s+Fulcrum|\bpolsec\.net\b/i.test(header)) {
    return result('fulcrum', 'Fulcrum / Polsec', 'high', 'The file header names Fulcrum (polsec.net).');
  }
  if (/2hbj'?s?\s+obfuscator/i.test(header)) {
    return result('2hbj', '2HBJ', 'high', 'The file declares obfuscator="...2hbj\'s obfuscator...".');
  }
  const centurion = header.match(/\bCenturion\s+(v[\d.]+)/i) || text.slice(0, 50000).match(/\bCenturion\s+(v[\d.]+)/i);
  if (centurion) {
    return result('centurion', 'Centurion ' + centurion[1], /6\.1/.test(centurion[1]) ? 'medium' : 'high',
      'The file names Centurion ' + centurion[1] + '.' + (/6\.1/.test(centurion[1]) ? ' v6.1 needs a runtime sandbox the static route may not have.' : ''));
  }

  // IronBrew: banner/marker logic lives in its own module; only trust it
  // when it found a header banner or several macro markers, never a bare
  // identifier somewhere in the code.
  const ib = (commentHeader.trim() ? detectIronBrewSuggestion(commentHeader) : null) || (() => {
    const s = detectIronBrewSuggestion(text);
    return s && s.confidence === 'medium' ? s : null;
  })();
  if (ib && ib.engine) return result(ib.engine, ib.label, ib.confidence, ib.reason, [ib.engine === 'ironbrew1' ? 'ironbrew2' : 'ironbrew1']);
  if (/--\s*this file was generated using ironbrew1\b/i.test(header) ||
      /^return\s*\(\s*function\s*\((?:[a-z]{1,2},){20,}\.\.\.\)\s*local [a-z]{1,3}(?:=\{-?\d+,|(?:,[a-z]{1,3}){10,})/.test(bodyStart.slice(0, 800))) {
    return result('ironbrew1', 'IronBrew 1', 'medium', 'The file has the IronBrew 1 wrapper layout (return(function(a,b,...,...) local ...).', ['ironbrew2']);
  }

  // Loader stubs for hosted scripts.
  const small = text.length < 20000;
  if (/jnkie\.com/i.test(text.slice(0, 20000))) {
    return result('jnkie', 'JNKIE loader', 'high', 'The script fetches its payload from jnkie.com; the JNKIE fetcher downloads the real script.');
  }
  if (/luaprotect\.dev/i.test(text.slice(0, 20000))) {
    return result('luaprotect', 'LuaProtect loader', 'high', 'The script loads from luaprotect.dev; the LuaProtect fetcher downloads the real script.');
  }
  if (/vantarmor/i.test(text.slice(0, 20000))) {
    return result('vantarmor', 'Vantarmor', 'medium', 'The script references Vantarmor.');
  }
  if (small && /\bapi\.luarmor\.net\b|\bluarmor\b.*\bscript_key\b|\bscript_key\s*=.*\bluarmor/i.test(text)) {
    return result(null, 'Luarmor loader', 'high',
      'This is a Luarmor key-system loader. The protected script is only served by Luarmor for a valid key, so there is nothing to deobfuscate in this file.');
  }

  // ---- structural fingerprints (banner stripped) --------------------------
  const shape = luraphShape(text, bodyStart);
  if (shape) return shape;

  if (count(text.slice(0, 400000), /\bc3\[/g) >= 50 && count(text.slice(0, 400000), /=function\(Z\)/g) > 20) {
    return result('centurion', 'Centurion v6', 'medium', 'No header, but the file has the Centurion v6 c3[...] factory layout.');
  }
  if (/^return\s*\(\s*function\s*\(\.\.\.\)\s*obfuscator\s*=/.test(bodyStart)) {
    return result('2hbj', '2HBJ', 'medium', 'The file has the 2HBJ wrapper layout (return(function(...) obfuscator=...).');
  }
  {
    // Fulcrum: every function opens with a numeric-for "constant unpacking"
    // switch filling one table, then a flattened while-dispatcher.
    const sample = text.slice(0, 400000);
    const unpack = count(sample, /for\s+\w+\s*=\s*-?\d+\s*,\s*-?\d+\s*,\s*-?\d+\s+do\s+if\s+\w+\s*[<>=~]=?/g);
    const dispatch = count(sample, /while\s+\w+\s+do\s+if\s+\w+\s*[<>]=?\s*-?\d+/g);
    if (unpack >= 5 && dispatch >= 5 && !/^return\s*\(?\s*(?:setmetatable\s*\()?\{/.test(bodyStart)) {
      return result('fulcrum', 'Fulcrum / Polsec', 'low',
        'No header, but most functions use constant-unpacking for-loops followed by flattened while-dispatchers, the Fulcrum layout.');
    }
  }

  // ---- obfuscators without an engine here --------------------------------
  const unsupported = [
    [/MoonSec\s*V?\s*(\d)?/i, 'MoonSec'],
    [/Prometheus\s+Obfuscator|protected\s+using\s+Prometheus/i, 'Prometheus'],
    [/wearedevs\.net|WeAreDevs/i, 'WeAreDevs'],
    [/PSU\s*(?:Obfuscator)?|Perth'?s?\s+Superior/i, 'PSU'],
    [/LuaObfuscator\.com|luaobfuscator/i, 'LuaObfuscator.com'],
  ];
  for (const [re, name] of unsupported) {
    if (re.test(header)) {
      return result(null, name, 'high', 'The header names ' + name + ', which has no dedicated engine here. Vantarmor / Universal may still dump a loadstring payload.', ['vantarmor']);
    }
  }

  // Bare "Luraph" mention in the header without a parsable version.
  if (/\bLuraph\b/i.test(commentHeader) || /\bLPH_(?:ENCFUNC|ENCNUM|ENCSTR|JIT|NO_VIRTUALIZE|CRASH)\b/.test(text.slice(0, 200000))) {
    return result(null, 'Luraph', 'low', 'A Luraph marker was found, but neither the version nor the VM layout could be identified.',
      ['luraph-151', 'luraph-v149']);
  }

  return null;
}

module.exports = { detectEngineSuggestion, headerOf };
