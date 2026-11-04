'use strict';

const assert = require('node:assert/strict');
const { inspectLiftText } = require('./lift-validation');

const clean = inspectLiftText([
  'local Players = game:GetService("Players")',
  'local player = Players.LocalPlayer',
  'print(player.Name)',
].join('\n'));
assert.equal(clean.complete, true);
assert.deepEqual(clean.issues, []);

const literalNoise = inspectLiftText([
  'local message = "nil + 4 bit32.band(nil, 2) data[nil]"',
  'local longMessage = [=[(nil)(3) nil + 8]=]',
  '-- nil + 5 and bit32.band(nil, 255)',
  'print(message, longMessage)',
].join('\\n'));
assert.equal(literalNoise.complete, true);
assert.deepEqual(literalNoise.issues, []);

const broken = inspectLiftText([
  'local function luraph_runtime1(...)',
  '  error("Luraph runtime function, not devirtualized")',
  'end',
  'local function main()',
  '  (nil)(42)',
  '  local value = data[nil]',
  '  local other = nil + 4',
  '  bit32.band(nil, 255)',
  '  luraph_runtime1(nil)',
  '  error("devirt: corrupt/encrypted register index 2066")',
  'end',
].join('\n'));
assert.equal(broken.complete, false);
assert.ok(broken.metrics.devirtErrors > 0);
assert.ok(broken.metrics.nilCalls > 0);
assert.ok(broken.metrics.nilIndexes > 0);
assert.ok(broken.metrics.nilArithmetic > 0);
assert.ok(broken.metrics.nilBit32Calls > 0);
assert.ok(broken.metrics.unresolvedRuntimeCalls > 0);

const inertStub = inspectLiftText([
  'local function luraph_runtime1(...)',
  '  error("Luraph runtime function, not devirtualized")',
  'end',
  'print("runtime helper never referenced")',
].join('\n'));
assert.equal(inertStub.complete, false);
assert.ok(inertStub.metrics.runtimeStubDefinitions > 0);

console.log('lift-validation tests passed');