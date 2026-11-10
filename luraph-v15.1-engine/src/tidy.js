'use strict';

const KEYWORDS = new Set([
  'and', 'break', 'do', 'else', 'elseif', 'end', 'false', 'for', 'function', 'if', 'in',
  'local', 'nil', 'not', 'or', 'repeat', 'return', 'then', 'true', 'until', 'while', 'continue'
]);

function stripMarkers(text) {

  return text.replace(/--@\S*\n?/g, '');
}

function diagnosticPrefixLength(lines) {
  let i = 0;

  // The runtime puts the execution status and traceback before the trace body.
  // Keep the whole multi-line status block even when the probe preamble is cut.
  if (/^\s*-- run status:/.test(lines[i] || '')) {
    i++;
    while (i < lines.length && /^\s*--\s{2,}\S/.test(lines[i])) i++;
  }

  // This summary is useful when diagnosing early exits and budget exhaustion.
  if (/^\s*--\s*\d+\s+statements recorded\b/.test(lines[i] || '')) i++;
  return i;
}

function stripPreamble(text) {
  const lines = text.split('\n');
  const prefixLength = diagnosticPrefixLength(lines);
  let cut = prefixLength;

  for (let i = prefixLength; i < Math.min(lines.length, prefixLength + 120); i++) {
    const l = lines[i];
    // VM lifting may suffix locals (Path2D2, ScreenGui2, etc.).
    // Match the API operation rather than one exact temporary variable name.
    if (/\bPath2D\w*:GetTangentOnCurveArcLength\b/.test(l) ||
        /\bScreenGui\w*:Destroy\(\)/.test(l)) {
      cut = i + 1;
    }
  }
  if (cut > prefixLength) {
    return lines.slice(0, prefixLength)
      .concat(lines.slice(cut))
      .join('\n')
      .replace(/^\n+/, '');
  }
  return text;
}

function space(text) {

  const lines = text.split('\n');
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const prev = out[out.length - 1] || '';
    const isBlockStart = /^\t*(local function|function |if |for |while )/.test(l);
    const prevIsBlank = prev.trim() === '';
    const prevIsBlockStart = /^\t*(local function|function |if |for |while |local )/.test(prev);
    if (isBlockStart && !prevIsBlank && !prevIsBlockStart && i > 0) {

    }
    out.push(l);
  }
  return out.join('\n');
}

function stripAnnotations(text) {
  const lines = text.split('\n');
  const clean = [];
  let inUrlList = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('-- URLs requested:') ||
        trimmed.startsWith('-- remotes fired/invoked:') ||
        trimmed.startsWith('-- non-standard globals touched:') ||
        trimmed.startsWith('-- anti-tamper trap')) {
      inUrlList = true;
      continue;
    }
    if (inUrlList) {
      if (trimmed.startsWith('--   ') || trimmed === '--') continue;
      inUrlList = false;
    }
    if (trimmed.startsWith('-- isfolder(') ||
        trimmed.startsWith('-- isfile(') ||
        trimmed.startsWith('-- identifyexecutor(') ||
        trimmed.startsWith('-- condition:') ||
        trimmed.startsWith('-- loadstring() of')) {
      continue;
    }
    clean.push(line);
  }
  return clean.join('\n').replace(/^\n+/, '');
}

function tidy(text, options = {}) {
  let res = stripMarkers(text);
  res = stripAnnotations(res);
  if (options.preamble !== false) {
    res = stripPreamble(res);
  }
  return space(res);
}

module.exports = { tidy, stripMarkers, stripPreamble, stripAnnotations, space };
