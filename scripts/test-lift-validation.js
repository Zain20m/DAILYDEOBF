'use strict';

const assert = require('node:assert/strict');
const { inspectLiftText } = require('./lift-validation');
const { stripPreamble } = require('../luraph-v15.1-engine/src/tidy');

const clean = inspectLiftText([
  'local Players = game:GetService("Players")',
  'local player = Players.LocalPlayer',
  'print(player.Name)',
].join('\n'));
assert.equal(clean.complete, true);
assert.deepEqual(clean.issues, []);
assert.equal(clean.categories.syntax.status, 'not_checked');
assert.equal(clean.categories.behavioralConsistency.status, 'not_checked');


const environmentProbe = inspectLiftText([
  'task.spawn(function(...) task.wait(0) end)',
  'task.defer(function(...) end)',
  'task.delay(441, function(...) end)',
  'local ScreenGui2 = Instance.new("ScreenGui")',
  'local Frame2 = Instance.new("Frame")',
  'local Path2D2 = Instance.new("Path2D")',
  'Path2D2:GetLength()',
  'Path2D2:GetPositionOnCurve(0.6)',
  'Path2D2:GetTangentOnCurve(0.3)',
  'local connection = game.ChildAdded:Connect(function(child) end)',
  'connection:Disconnect()',
  'local connection2 = workspace.ChildAdded:Connect(function(child) end)',
  'connection2:Disconnect()',
  'warn("JNKIE: Environment compatibility check failed (PC-R01).")',
].join('\n'));
assert.equal(environmentProbe.candidate, true);
assert.equal(environmentProbe.complete, false);
assert.equal(environmentProbe.metrics.environmentProbeOnly, true);
assert.equal(environmentProbe.categories.behavioralConsistency.status, 'failed_before_payload');
assert.ok(environmentProbe.issues.some((issue) => /compatibility failure.*not recovered payload logic/i.test(issue)));


const prefixedProbe = stripPreamble([
  'task.spawn(function(...) end)',
  'local Path2D2 = Instance.new("Path2D")',
  'Path2D2:GetTangentOnCurveArcLength(0.8)',
  'local ScreenGui2 = Instance.new("ScreenGui")',
  'ScreenGui2:Destroy()',
  'local Folder = Instance.new("Folder")',
  'local Folder2 = Instance.new("Folder", Folder)',
  'local connection = game.ChildAdded:Connect(function(child) end)',
  'connection:Disconnect()',
  'local connection2 = workspace.ChildAdded:Connect(function(child) end)',
  'connection2:Disconnect()',
  'warn("JNKIE: Environment compatibility check failed (PC-R01).")',
].join('\n'));
assert.ok(!prefixedProbe.includes('Path2D2:'));
assert.ok(prefixedProbe.startsWith('local Folder'));
const postPreambleProbe = inspectLiftText(prefixedProbe);
assert.equal(postPreambleProbe.metrics.environmentProbeOnly, true);
assert.equal(postPreambleProbe.complete, false);

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