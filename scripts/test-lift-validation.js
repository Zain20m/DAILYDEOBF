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
assert.equal(clean.categories.syntax.status, 'not_checked');
assert.equal(clean.categories.behavioralConsistency.status, 'not_checked');

const literalNoise = inspectLiftText([
  'local message = "nil + 4 bit32.band(nil, 2) data[nil]"',
  'local longMessage = [=[(nil)(3) nil + 8]=]',
  '-- nil + 5 and bit32.band(nil, 255)',
  'print(message, longMessage)',
].join('\n'));
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
  '  error("devirt: invalid register index 443960945")',
  '  error("devirt: unexplored successor proto=7")',
  'end',
].join('\n'));
assert.equal(broken.complete, false);
assert.ok(broken.metrics.devirtErrors > 0);
assert.ok(broken.metrics.registerErrors > 0);
assert.ok(broken.metrics.controlFlowStubs > 0);
assert.equal(broken.categories.registerRecovery.status, 'incomplete');
assert.equal(broken.categories.devirtualizationStubs.status, 'incomplete');
assert.equal(broken.categories.controlFlow.status, 'incomplete');
assert.equal(broken.categories.behavioralConsistency.status, 'not_checked');
assert.ok(broken.metrics.nilCalls > 0);
assert.ok(broken.metrics.nilIndexes > 0);
assert.ok(broken.metrics.nilArithmetic > 0);
assert.ok(broken.metrics.nilBit32Calls > 0);
assert.ok(broken.metrics.unresolvedRuntimeCalls > 0);
assert.ok(broken.details.some((line) => line.startsWith('devirt stub line ')));
assert.ok(broken.details.some((line) => line.startsWith('nil bit32 input line ')));
assert.ok(broken.details.some((line) => line.startsWith('runtime placeholder line ')));
assert.equal(literalNoise.details.length, 0);

const inertStub = inspectLiftText([
  'local function luraph_runtime1(...)',
  '  error("Luraph runtime function, not devirtualized")',
  'end',
  'print("runtime helper never referenced")',
].join('\n'));
assert.equal(inertStub.complete, false);
assert.ok(inertStub.metrics.runtimeStubDefinitions > 0);

console.log('lift-validation tests passed');