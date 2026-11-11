'use strict';

const assert = require('assert');
const { isBootstrapFailureBeforePayload } = require('../src/driver');
const { tidy, stripPreamble, stripAnnotations } = require('../src/tidy');
const harness = require('../src/harness');

// The child-chunk protocol uses bounded stdout records. Test byte-exact
// reconstruction, backward compatibility, and explicit incomplete-capture reporting.
harness.buildHarness('return nil', {});
const chunkMark = harness.mark;
const payload = 'local payload = "' + 'x'.repeat(5000) + '"\nreturn payload';
const payloadBytes = Buffer.from(payload, 'latin1');
const partSize = 2048;
const partCount = Math.ceil(payloadBytes.length / partSize);
const key = payloadBytes.length + '_testhash';
const records = [chunkMark('CHUNK ' + key + ' ' + payloadBytes.length + ' ' + partCount)];
for (let i = 0; i < partCount; i++) {
  const part = payloadBytes.subarray(i * partSize, Math.min((i + 1) * partSize, payloadBytes.length));
  records.push(chunkMark('CHUNKDATA ' + key + ' ' + (i + 1) + ' ' + part.toString('hex')));
}
records.push('trace line after captured chunk');
const parsedChunks = harness.takeChunks(records.join('\n'));
assert.strictEqual(parsedChunks.chunks.length, 1, 'segmented child chunk must be reconstructed');
assert.strictEqual(parsedChunks.chunks[0][0], key, 'segmented child chunk key must be preserved');
assert.deepStrictEqual(Buffer.from(parsedChunks.chunks[0][1], 'latin1'), payloadBytes,
  'segmented child chunk must be byte-exact');
assert.deepStrictEqual(parsedChunks.incomplete, [], 'complete segmented child chunk must not report errors');
assert.strictEqual(parsedChunks.body, 'trace line after captured chunk', 'chunk protocol records must be removed from trace');

const legacySource = 'return "legacy chunk"';
const legacyKey = '21_legacy';
const legacyHex = Buffer.from(legacySource, 'latin1').toString('hex');
const legacyParsed = harness.takeChunks([
  chunkMark('CHUNK ' + legacyKey),
  legacyHex,
  'legacy trace line',
].join('\n'));
assert.strictEqual(legacyParsed.chunks[0][1], legacySource, 'previous single-line chunk protocol must remain supported');

const incompleteParsed = harness.takeChunks([
  chunkMark('CHUNK ' + key + ' ' + payloadBytes.length + ' ' + partCount),
  records[1],
  records[3],
].join('\n'));
assert.strictEqual(incompleteParsed.chunks.length, 0, 'incomplete child chunks must not be used');
assert.strictEqual(incompleteParsed.incomplete.length, 1, 'incomplete child chunks must be reported');



const pcR01Failure = [
  '-- run status: script error: [string "Luraph"]:1: attempt to get length of a number value',
  'warn("JNKIE: Environment compatibility check failed (PC-R01).")',
].join('\\n');
assert.strictEqual(isBootstrapFailureBeforePayload(pcR01Failure), true,
  'PC-R01 plus the known bootstrap length error must stop before expensive VM lifting');
assert.strictEqual(isBootstrapFailureBeforePayload('-- run status: script error: attempt to get length of a number value'),
  false, 'a length error without PC-R01 must not be classified as this bootstrap failure');
assert.strictEqual(isBootstrapFailureBeforePayload('warn("Environment compatibility check failed (PC-R01)")'),
  false, 'PC-R01 without the matching length error must not skip lifting');

const trace = [
  '-- run status: script error: JNKIE: Environment compatibility check failed (PC-R01).',
  '--   Script:44: attempt to index nil with \'Parent\'',
  '--   traceback:',
  '-- 15 statements recorded in 0.01s',
  'local Players = game:GetService("Players")',
  'Path2D2:GetTangentOnCurveArcLength(...)',
  'ScreenGui2:Destroy()',
  'warn("JNKIE: Environment compatibility check failed (PC-R01).")',
  '-- [envlog] error: callback failed: missing method',
  '-- condition: game:GetService("Path2D") ~= nil (false)',
  '-- identifyexecutor() -- "Wave"',
  '-- isfolder("workspace")',
  '-- loadstring() of 520 bytes',
].join('\n');

const cleaned = tidy(trace);
assert(cleaned.includes('-- run status: script error: JNKIE:'), 'runtime status must remain visible');
assert(cleaned.includes("--   Script:44: attempt to index nil with 'Parent'"), 'runtime error detail must remain visible');
assert(cleaned.includes('--   traceback:'), 'traceback header must remain visible');
assert(cleaned.includes('-- 15 statements recorded in 0.01s'), 'statement summary must remain visible');
assert(!cleaned.includes('Path2D2:GetTangentOnCurveArcLength'), 'probe preamble should still be removed');
assert(!cleaned.includes('ScreenGui2:Destroy()'), 'probe preamble should still be removed');
assert(cleaned.includes('warn("JNKIE: Environment compatibility check failed (PC-R01).")'), 'PC-R01 warning must remain visible');
assert(cleaned.includes('-- [envlog] error: callback failed: missing method'), 'callback errors must remain visible');

const diagnosticMode = tidy(trace, {
  preamble: false,
  preserveDiagnostics: true,
});
assert(diagnosticMode.includes('-- condition: game:GetService("Path2D") ~= nil (false)'), 'PC-R01 mode must retain branch conditions');
assert(diagnosticMode.includes('-- identifyexecutor() -- "Wave"'), 'PC-R01 mode must retain executor checks');
assert(diagnosticMode.includes('-- isfolder("workspace")'), 'PC-R01 mode must retain filesystem checks');
assert(diagnosticMode.includes('-- loadstring() of 520 bytes'), 'PC-R01 mode must retain dynamic chunk notes');
assert(diagnosticMode.includes('Path2D2:GetTangentOnCurveArcLength'), 'PC-R01 mode must retain the complete probe sequence');

const noPreamble = tidy(trace, { preamble: false });
assert(noPreamble.includes('Path2D2:GetTangentOnCurveArcLength'), 'preamble=false must keep the raw trace');
assert(noPreamble.includes('-- run status: script error:'), 'preamble=false must keep runtime status');

const annotations = stripAnnotations('-- run status: script error: example\n-- [envlog] error: example\n-- condition: noisy');
assert(annotations.includes('-- run status: script error: example'), 'annotation cleanup must not drop runtime status');
assert(annotations.includes('-- [envlog] error: example'), 'annotation cleanup must not drop harness errors');
assert(!annotations.includes('-- condition: noisy'), 'non-diagnostic annotations should still be removed');

const preambleOnly = stripPreamble([
  '-- run status: script error: example',
  '--   stack frame',
  '-- 3 statements recorded in 0.01s',
  'Path2D2:GetTangentOnCurveArcLength(...)',
  'warn("PC-R01")',
].join('\n'));
assert(preambleOnly.startsWith('-- run status: script error: example'), 'stripPreamble must preserve status prefix');
assert(preambleOnly.includes('warn("PC-R01")'), 'stripPreamble must preserve trace body after the probe');

process.stdout.write('tidy diagnostics tests passed\\n');
