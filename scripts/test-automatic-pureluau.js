'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createAutomaticPureLuauResult } = require('./automatic-pureluau');

test('creates a readable Luau attachment and a rename report', () => {
  const source = [
    'local function fn22(arg)',
    '  local flag2 = arg and true or false',
    '  return flag2',
    'end',
  ].join('\n');

  const result = createAutomaticPureLuauResult(source, 'IronBrew1_devirtualized.lua');
  assert.equal(result.status, 'complete');
  assert.equal(result.outputName, 'pureluau-IronBrew1_devirtualized.luau');
  assert.equal(result.reportName, 'pureluau-report-IronBrew1_devirtualized.txt');
  assert.ok(result.outputBuffer.length > 0);
  assert.match(result.reportBuffer.toString('utf8'), /Automatic PureLuau readability report/);
  assert.match(result.reportBuffer.toString('utf8'), /Formatting engine:/);
});

test('skips empty input and binary-looking source', () => {
  assert.equal(createAutomaticPureLuauResult('   ').status, 'skipped');
  assert.equal(createAutomaticPureLuauResult('local x = 1\0local y = 2').status, 'skipped');
});

test('skips inputs above the configured complete-processing limit without truncating', () => {
  const oversized = 'a'.repeat(4_000_001);
  const result = createAutomaticPureLuauResult(oversized, 'large.lua');
  assert.equal(result.status, 'skipped');
  assert.match(result.reason, /exceeds PureLuau limits/);
});
