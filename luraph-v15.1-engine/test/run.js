'use strict';

const assert = require('assert');
const { tidy, stripPreamble, stripAnnotations } = require('../src/tidy');

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
