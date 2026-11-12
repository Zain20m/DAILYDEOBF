'use strict';

const assert = require('node:assert/strict');
const { repairIronVeilSource } = require('./ironveil-auto-repair');

const input = [
  'local count = 1',
  'count += 2',
  'count -= 1',
  'local text = "keep"',
  'text ..= "!"',
].join('\n');

const repaired = repairIronVeilSource(input);
assert.equal(repaired.changed, true);
assert.equal(repaired.changes.length, 3);
assert.match(repaired.source, /count = count \+ \(2\)/);
assert.match(repaired.source, /count = count - \(1\)/);
assert.match(repaired.source, /text = text \.\. \("!"\)/);

const unchanged = repairIronVeilSource('object.value += 1\nlocal x = 2 -- comment');
assert.equal(unchanged.changed, false);
assert.equal(unchanged.source, 'object.value += 1\nlocal x = 2 -- comment');

console.log('IronVeil auto-repair tests passed.');
