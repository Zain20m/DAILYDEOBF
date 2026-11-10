'use strict';

function countMatches(source, expression) {
  return [...source.matchAll(expression)].length;
}

function maskLuaSource(source, maskStrings = true) {
  const text = String(source || '');
  const out = text.split('');
  const blank = (start, end) => {
    for (let i = start; i < end; i++) {
      if (out[i] !== '\n' && out[i] !== '\r') out[i] = ' ';
    }
  };
  const longBracketEnd = (start) => {
    const opener = text.slice(start).match(/^\[(=*)\[/);
    if (!opener) return null;
    const close = ']' + opener[1] + ']';
    const bodyStart = start + opener[0].length;
    const found = text.indexOf(close, bodyStart);
    return found < 0 ? text.length : found + close.length;
  };

  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === '"' || ch === "'") {
      const quote = ch;
      let end = i + 1;
      while (end < text.length) {
        if (text[end] === '\\') { end += 2; continue; }
        if (text[end] === quote) { end++; break; }
        end++;
      }
      if (maskStrings) blank(i, end);
      i = end;
      continue;
    }
    if (text.startsWith('--', i)) {
      let end = longBracketEnd(i + 2);
      if (end === null) {
        end = i + 2;
        while (end < text.length && text[end] !== '\n' && text[end] !== '\r') end++;
      }
      blank(i, end);
      i = end;
      continue;
    }
    if (ch === '[') {
      const end = longBracketEnd(i);
      if (end !== null) {
        if (maskStrings) blank(i, end);
        i = end;
        continue;
      }
    }
    i++;
  }
  return out.join('');
}

function collectDetails(source, code, withoutComments, maxPerKind = 4) {
  const lines = String(source || '').split(/\r?\n/);
  const details = [];
  const add = (label, match, start = match.index, end = start + match[0].length) => {
    if (details.filter((item) => item.startsWith(label + ' ')).length >= maxPerKind) return;
    const line = source.slice(0, start).split('\n').length;
    const rawLine = lines[line - 1] || '';
    const from = Math.max(0, start - (rawLine.length > 220 ? 80 : 0));
    const to = Math.min(source.length, Math.max(end, start + 120));
    const snippet = source.slice(from, to).replace(/\s+/g, ' ').trim().slice(0, 200);
    details.push(label + ' line ' + line + ': ' + snippet);
  };

  const patterns = [
    ['devirt stub', withoutComments, /\berror\s*\(\s*["']devirt:[^"'\r\n]*["']/gi],
    ['nil call target', code, /\(\s*nil\s*\)\s*\(/g],
    ['nil table index', code, /\[\s*nil\s*\]/g],
    ['nil arithmetic', code, /\bnil\s*(?:\+|-|\*|\/|\/\/|%)|(?:\+|-|\*|\/|\/\/|%)\s*nil\b/g],
    ['nil bit32 input', code, /\bbit32\.\w+\s*\(\s*nil\s*(?:,|\))/gi],
    ['nil comparison', code, /\bnil\s*(?:==|~=|<=|>=|<|>)\s*-?\d|\d\s*(?:==|~=|<=|>=|<|>)\s*nil\b/g],
    ['runtime placeholder', withoutComments, /\blocal\s+function\s+(luraph_runtime\d+)\s*\(/g],
    ['environment compatibility failure', withoutComments, /Environment compatibility check failed[^\r\n]*/gi],
  ];
  for (const [label, input, pattern] of patterns) {
    for (const match of input.matchAll(pattern)) add(label, match);
  }
  return details;
}

function inspectLiftText(source) {
  const text = String(source || '');
  const code = maskLuaSource(text, true);
  const withoutComments = maskLuaSource(text, false);
  const nonCommentLines = withoutComments.split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean).length;

  // Syntactically valid VM output can still be only an environment self-test.
  // Require both an explicit compatibility failure and multiple independent
  // probe signatures before classifying it as probe-only.
  const probeSignals = [
    countMatches(withoutComments, /\btask\.(?:spawn|defer|delay)\s*\(/g) >= 2,
    countMatches(withoutComments, /\bPath2D\w*:(?:GetLength|GetPositionOnCurve|GetTangentOnCurve)(?:ArcLength)?\s*\(/g) >= 3,
    countMatches(withoutComments, /\b[A-Za-z_]\w*\.ChildAdded\s*:\s*Connect\s*\(/g) >= 2,
    countMatches(withoutComments, /\b[A-Za-z_]\w*:Disconnect\s*\(/g) >= 2,
    countMatches(withoutComments, /\b(?:ScreenGui|Frame|Folder)\w*\s*=\s*Instance\.new\s*\(/g) >= 2,
  ].filter(Boolean).length;
  const explicitCompatibilityFailure =
    /warn\s*\(\s*(['"])[^'"]*Environment compatibility check failed[^'"]*\1\s*\)\s*;?\s*$/i.test(withoutComments) &&
    /\b(?:PC-R01|JNKIE)\b/i.test(withoutComments);
  const environmentProbeOnly = explicitCompatibilityFailure && probeSignals >= 2;

  const runtimeNames = new Set(
    [...code.matchAll(/\blocal\s+function\s+(luraph_runtime\d+)\s*\(/g)].map((match) => match[1])
  );
  let unresolvedRuntimeCalls = 0;
  for (const name of runtimeNames) {
    const calls = countMatches(code, new RegExp('\\b' + name + '\\s*\\(', 'g'));
    const definitions = countMatches(code, new RegExp('\\blocal\\s+function\\s+' + name + '\\s*\\(', 'g'));
    unresolvedRuntimeCalls += Math.max(0, calls - definitions);
  }

  const metrics = {
    nonCommentLines,
    devirtErrors: countMatches(withoutComments, /error\s*\(\s*(['"])devirt:/gi),
    registerErrors: countMatches(withoutComments, /(?:invalid register (?:index|store)|corrupt.?encrypted register index)/gi),
    controlFlowStubs: countMatches(withoutComments, /(?:unexplored successor|unstructured jump|could not reconstruct control flow)/gi),
    nilCalls: countMatches(code, /\(\s*nil\s*\)\s*\(/g) + countMatches(code, /(?:^|[;,\s])nil\s*\(/g),
    nilIndexes: countMatches(code, /\[\s*nil\s*\]/g),
    nilArithmetic: countMatches(code, /\bnil\s*(?:\+|-|\*|\/|\/\/|%)/g) +
      countMatches(code, /(?:\+|-|\*|\/|\/\/|%)\s*nil\b/g),
    nilBit32Calls: countMatches(code, /\bbit32\.\w+\s*\(\s*nil\s*(?:,|\))/gi),
    nilComparisons: countMatches(code, /\bnil\s*(?:==|~=|<=|>=|<|>)\s*-?\d|\d\s*(?:==|~=|<=|>=|<|>)\s*nil\b/g),
    runtimeStubDefinitions: countMatches(withoutComments, /error\s*\(\s*(['"])Luraph runtime function, not devirtualized\1\s*\)/g),
    unresolvedRuntimeCalls,
    explicitCompatibilityFailure: explicitCompatibilityFailure ? 1 : 0,
    environmentProbeSignals: probeSignals,
    environmentProbeOnly,
  };

  const issues = [];
  if (!metrics.nonCommentLines) issues.push('No executable source statements were generated.');
  if (metrics.environmentProbeOnly) {
    issues.push('The runtime hit an explicit environment compatibility failure (PC-R01). This output is a compatibility-probe trace, not recovered payload logic.');
  }
  if (metrics.devirtErrors) issues.push(metrics.devirtErrors + ' explicit devirtualization error stub(s) remain.');
  if (metrics.registerErrors) issues.push(metrics.registerErrors + ' invalid or encrypted register index error(s) remain.');
  if (metrics.controlFlowStubs) issues.push(metrics.controlFlowStubs + ' unresolved control-flow marker(s) remain.');
  if (metrics.nilCalls) issues.push(metrics.nilCalls + ' call(s) have a nil function target.');
  if (metrics.nilIndexes) issues.push(metrics.nilIndexes + ' table index(es) use nil as the key.');
  if (metrics.nilArithmetic) issues.push(metrics.nilArithmetic + ' arithmetic operation(s) use nil.');
  if (metrics.nilBit32Calls) issues.push(metrics.nilBit32Calls + ' bit32 call(s) use nil as the first argument.');
  if (metrics.nilComparisons) issues.push(metrics.nilComparisons + ' numeric comparison(s) use nil.');
  if (metrics.runtimeStubDefinitions) {
    issues.push(metrics.runtimeStubDefinitions + ' unlifted Luraph runtime placeholder definition(s) remain.');
  }
  if (metrics.unresolvedRuntimeCalls) {
    issues.push(metrics.unresolvedRuntimeCalls + ' call(s) target unlifted Luraph runtime placeholder(s).');
  }

  const complete = metrics.nonCommentLines > 0 && issues.length === 0;
  const penalty =
    (metrics.environmentProbeOnly ? 30000 : 0) +
    metrics.devirtErrors * 5000 +
    metrics.registerErrors * 4000 +
    metrics.controlFlowStubs * 2500 +
    metrics.nilCalls * 250 +
    metrics.nilIndexes * 150 +
    metrics.nilArithmetic * 300 +
    metrics.nilBit32Calls * 300 +
    metrics.nilComparisons * 200 +
    metrics.unresolvedRuntimeCalls * 1000;
  const score = metrics.nonCommentLines
    ? 100000 - penalty + Math.min(10000, Math.floor(Buffer.byteLength(text, 'utf8') / 100))
    : -1;

  const details = collectDetails(text, code, withoutComments);
  const categories = {
    syntax: { status: 'not_checked' },
    vmReconstruction: { status: complete ? 'no_static_failures_detected' : 'incomplete' },
    registerRecovery: {
      status: metrics.registerErrors ? 'incomplete' : 'not_proven',
      unresolved: metrics.registerErrors,
    },
    functionReferences: {
      status: (metrics.nilCalls || metrics.unresolvedRuntimeCalls) ? 'incomplete' : 'not_proven',
      unresolved: metrics.nilCalls + metrics.unresolvedRuntimeCalls,
    },
    runtimeOperations: {
      status: (metrics.runtimeStubDefinitions || metrics.unresolvedRuntimeCalls) ? 'incomplete' : 'not_proven',
      unresolved: metrics.runtimeStubDefinitions + metrics.unresolvedRuntimeCalls,
    },
    devirtualizationStubs: {
      status: metrics.devirtErrors ? 'incomplete' : 'none_detected',
      unresolved: metrics.devirtErrors,
    },
    controlFlow: {
      status: metrics.controlFlowStubs ? 'incomplete' : 'not_proven',
      unresolved: metrics.controlFlowStubs,
    },
    behavioralConsistency: { status: environmentProbeOnly ? 'failed_before_payload' : 'not_checked' },
  };
  return { candidate: metrics.nonCommentLines > 0, complete, issues, metrics, categories, score, details };
}

module.exports = { inspectLiftText };
