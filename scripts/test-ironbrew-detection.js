'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { detectIronBrewSuggestion } = require('./ironbrew-detection');

test('detects an explicit IronBrew 2 banner', () => {
  const result = detectIronBrewSuggestion('-- IronBrew 2 protected file\nreturn {}');
  assert.equal(result.engine, 'ironbrew2');
  assert.equal(result.confidence, 'high');
});

test('detects IronBrew 2 encryption markers without a banner', () => {
  const result = detectIronBrewSuggestion([
    'local x = IB_INLINING_START(true)',
    'local y = IRONBREW_STR_DEC_GENERIC',
  ].join('\n'));
  assert.equal(result.engine, 'ironbrew2');
  assert.equal(result.confidence, 'medium');
});

test('detects an explicit IronBrew 1 banner separately', () => {
  const result = detectIronBrewSuggestion('-- IronBrew 1 protected file');
  assert.equal(result.engine, 'ironbrew1');
});

test('does not guess when only a generic IronBrew marker exists', () => {
  const result = detectIronBrewSuggestion('-- IronBrew protected file');
  assert.equal(result.engine, null);
  assert.match(result.label, /version unclear/i);
});

test('does not flag ordinary Lua', () => {
  assert.equal(detectIronBrewSuggestion('print("hello")'), null);
});
