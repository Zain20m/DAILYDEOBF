'use strict';

function countMatches(source, expression) {
  return [...source.matchAll(expression)].length;
}

function inspectLiftText(source) {
  const text = String(source || '');
  const nonCommentLines = text.split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('--')).length;

  const runtimeNames = new Set(
    [...text.matchAll(/\blocal\s+function\s+(luraph_runtime\d+)\s*\(/g)].map((match) => match[1])
  );
  let unresolvedRuntimeCalls = 0;
  for (const name of runtimeNames) {
    const calls = countMatches(text, new RegExp('\\b' + name + '\\s*\\(', 'g'));
    const definitions = countMatches(text, new RegExp('\\blocal\\s+function\\s+' + name + '\\s*\\(', 'g'));
    unresolvedRuntimeCalls += Math.max(0, calls - definitions);
  }

  const metrics = {
    nonCommentLines,
    devirtErrors: countMatches(text, /error\s*\(\s*(['"])devirt:/gi),
    nilCalls: countMatches(text, /\(\s*nil\s*\)\s*\(/g) + countMatches(text, /(?:^|[;,\s])nil\s*\(/g),
    nilIndexes: countMatches(text, /\[\s*nil\s*\]/g),
    nilArithmetic: countMatches(text, /\bnil\s*(?:\+|-|\*|\/|\/\/|%)/g) +
      countMatches(text, /(?:\+|-|\*|\/|\/\/|%)\s*nil\b/g),
    nilBit32Calls: countMatches(text, /\bbit32\.\w+\s*\(\s*nil\s*(?:,|\))/gi),
    nilComparisons: countMatches(text, /\bnil\s*(?:==|~=|<=|>=|<|>)\s*-?\d|\d\s*(?:==|~=|<=|>=|<|>)\s*nil\b/g),
    runtimeStubDefinitions: countMatches(text, /error\s*\(\s*(['"])Luraph runtime function, not devirtualized\1\s*\)/g),
    unresolvedRuntimeCalls,
  };

  const issues = [];
  if (!metrics.nonCommentLines) issues.push('No executable source statements were generated.');
  if (metrics.devirtErrors) issues.push(metrics.devirtErrors + ' explicit devirtualization error stub(s) remain.');
  if (metrics.nilCalls) issues.push(metrics.nilCalls + ' call(s) have a nil function target.');
  if (metrics.nilIndexes) issues.push(metrics.nilIndexes + ' table index(es) use nil as the key.');
  if (metrics.nilArithmetic) issues.push(metrics.nilArithmetic + ' arithmetic operation(s) use nil as an operand.');
  if (metrics.nilBit32Calls) issues.push(metrics.nilBit32Calls + ' bit32 call(s) use nil as the first argument.');
  if (metrics.nilComparisons) issues.push(metrics.nilComparisons + ' numeric comparison(s) use nil.');
  if (metrics.unresolvedRuntimeCalls) {
    issues.push(metrics.unresolvedRuntimeCalls + ' call(s) target unlifted Luraph runtime placeholder(s).');
  }

  const complete = metrics.nonCommentLines > 0 && issues.length === 0;
  const penalty =
    metrics.devirtErrors * 5000 +
    metrics.nilCalls * 250 +
    metrics.nilIndexes * 150 +
    metrics.nilArithmetic * 300 +
    metrics.nilBit32Calls * 300 +
    metrics.nilComparisons * 200 +
    metrics.unresolvedRuntimeCalls * 1000;
  const score = metrics.nonCommentLines
    ? 100000 - penalty + Math.min(10000, Math.floor(Buffer.byteLength(text, 'utf8') / 100))
    : -1;

  return { candidate: metrics.nonCommentLines > 0, complete, issues, metrics, score };
}

module.exports = { inspectLiftText };