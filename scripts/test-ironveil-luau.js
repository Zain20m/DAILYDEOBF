'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { Parser } = require('../ironveil-engine/dist/parser.js');

const source = [
  'export type Profile = { Name: string, Count: number }',
  'type Mapper<T> = (value: T) -> T',
  'local count: number = 1',
  'local function identity<T>(value: T): T',
  '  return value',
  'end',
  'count += 2',
  'local profile: Profile = { Name = "test", Count = count }',
  'profile.Count += 1',
  'local label = \`Count: {profile.Count}\`',
  'local state = if profile.Count > 1 then "ready" else "idle"',
  'local values = { 1, 2, 3 }',
  'values[1] += 4',
  'for index = 1, 2 do',
  '  count += index',
  'end',
  'print(label, state, identity(count))',
].join('\n');

const program = new Parser(source).parse();
assert.equal(program.type, 'Program');
assert.ok(Array.isArray(program.body));
assert.ok(program.body.length > 0);

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ironveil-luau-test-'));
try {
  const inputPath = path.join(tempDir, 'input.luau');
  const outputPath = path.join(tempDir, 'output.lua');
  fs.writeFileSync(inputPath, source, 'utf8');

  const cliPath = path.resolve(__dirname, '../ironveil-engine/dist/cli.js');
  const engineDir = path.dirname(path.dirname(cliPath));
  const result = spawnSync(process.execPath, [cliPath, inputPath, outputPath], {
    cwd: engineDir,
    encoding: 'utf8',
    timeout: 90_000,
    maxBuffer: 4 * 1024 * 1024,
  });

  assert.equal(
    result.status,
    0,
    'IronVeil failed on Luau input.\n' +
      String(result.stdout || '') + '\n' + String(result.stderr || '')
  );
  assert.ok(fs.existsSync(outputPath), 'IronVeil did not create its output file.');
  const output = fs.readFileSync(outputPath, 'utf8');
  assert.ok(output.trim().length > 0, 'IronVeil created an empty output file.');
  require('luaparse').parse(output, { luaVersion: '5.3' });
  console.log('IronVeil Luau parser and end-to-end smoke test passed.');
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
