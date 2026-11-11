'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { detectFlowAuthLuraphVersion } = require('./flowauth-version');

test('routes explicit FlowAuth Luraph banners to the exact supported version', () => {
  for (const version of ['15', '15.1']) {
    assert.deepEqual(
      detectFlowAuthLuraphVersion('-- This file was protected using Luraph Obfuscator v' + version),
      { version, detectedBy: 'Luraph version banner', explicit: true, unsupported: false },
      'version ' + version
    );
  }
});

test('rejects explicit unsupported Luraph versions instead of defaulting to v15.1', () => {
  for (const version of ['14.10', '14.10.1', '15.2', '15.10']) {
    const result = detectFlowAuthLuraphVersion('-- This file was protected using Luraph Obfuscator v' + version);
    assert.equal(result.explicit, true, version);
    assert.equal(result.unsupported, true, version);
    assert.equal(result.version, version, version);
  }
});

test('uses documented FlowAuth macro markers when the version banner is absent', () => {
  assert.deepEqual(
    detectFlowAuthLuraphVersion('LPH_NO_VIRTUALIZE(function() end)'),
    { version: '14.9', detectedBy: 'unsupported v14 macro markers', explicit: true, unsupported: true }
  );
  assert.deepEqual(
    detectFlowAuthLuraphVersion('LPH_ATTRIBUTES(function() end)'),
    { version: '15.1', detectedBy: 'v15 macro markers', explicit: true }
  );
});

test('uses the current 15.1 fallback only when no supported marker exists', () => {
  assert.deepEqual(
    detectFlowAuthLuraphVersion('local value = 42'),
    { version: '15.1', detectedBy: 'FlowAuth current-version default', explicit: false }
  );
});
