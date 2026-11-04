const test = require('node:test');
const assert = require('node:assert/strict');
const { convertToPureLuau } = require('../pureluau.js');

const decoderSource = [
  'local _l, _O, _P, _R =',
  '  { [1] = string.char, [2] = bit32.bxor, [3] = bit32.rshift, [4] = bit32.band }, {',
  '    [0] = 0xEE, [1] = 0x50, [2] = 0x72, [3] = 0x69, [4] = 0x6E, [5] = 0x74,',
  '  }, { 21, 23, 3, 25, 17, 157, 25, 47, 157, 61, 57, 15, 1, 53, 23, 21 }, {}',
  'local _pc, _st = 1, 10',
  'while _st do',
  '  if _st == 10 then',
  '    if _pc > #_P then',
  '      _st = 20',
  '    else',
  '      local _x = _P[_pc]',
  '      _R[_pc] = _l[1](_l[2](_l[3](_x, 1) + (_x % 2) * 128, _O[0]))',
  '      _pc = _pc + 1',
  '    end',
  '  elseif _st == 20 then',
  '    local _fn = _l[1](_O[1] + 32, _O[2], _O[3], _O[4], _O[5])',
  '    local _env = (getgenv and getgenv()) or (getfenv and getfenv()) or _G',
  '    (_env[_fn] or print)(table.concat(_R))',
  '    break',
  '  end',
  'end'
].join('\n');

const namingSource = [
  'local tbl11 = {}',
  'local function fn13(descendant)',
  '  if descendant and descendant:IsA("Accessory") then',
  '    pcall(function() descendant:Destroy() end)',
  '  end',
  'end',
  'local function fn14(arg, arg2)',
  '  local v10 = tbl11[arg]',
  '  if not v10 then return end',
  '  if v10.descendant then v10.descendant:Disconnect(); v10.descendant = nil end',
  '  for _, descendant in ipairs(arg2:GetDescendants()) do fn13(descendant) end',
  '  v10.descendant = arg2.DescendantAdded:Connect(fn13)',
  'end',
  'local function fn15(player)',
  '  if player == localPlayer or tbl11[player] then return end',
  '  local tbl12 = {}',
  '  tbl11[player] = tbl12',
  '  tbl12.character = player.CharacterAdded:Connect(function(character)',
  '    fn14(player, character)',
  '  end)',
  '  if player.Character then fn14(player, player.Character) end',
  'end',
  'local function fn16(player)',
  '  local v10 = tbl11[player]',
  '  if not v10 then return end',
  '  if v10.character then v10.character:Disconnect() end',
  '  if v10.descendant then v10.descendant:Disconnect() end',
  'end'
].join('\n');

const serviceSource = [
  'local a, b, c = game:GetService("Players"), game:GetService("RunService"), game:GetService("TweenService")'
].join('\n');

test('statically decodes the known shift/XOR string loop', () => {
  const result = convertToPureLuau(decoderSource);
  assert.equal(result.decodedStateMachines, 1);
  assert.deepEqual(result.decodedStaticStrings, ['deobf by printed']);
  assert.match(result.output, /local decodedText\s*=\s*"deobf by printed"/);
  assert.match(result.output, /local decodedFunctionName\s*=\s*"print"/);
  assert.doesNotMatch(result.output, /while _st do/);
});

test('infers useful names for accessory tracking functions and tables', () => {
  const result = convertToPureLuau(namingSource);
  for (const expected of [
    'fn13 -> removeAccessory',
    'fn14 -> monitorCharacterAccessories',
    'fn15 -> trackPlayer',
    'fn16 -> untrackPlayer',
    'tbl11 -> playerConnections',
    'tbl12 -> connections',
    'arg -> player (1 scopes)',
    'arg2 -> character (1 scopes)',
    'v10 -> connections (2 scopes)'
  ]) {
    assert.ok(result.renamedIdentifiers.includes(expected), 'Missing rename: ' + expected);
  }
});

test('maps parallel local aliases from GetService expressions', () => {
  const result = convertToPureLuau(serviceSource);
  for (const expected of ['a -> Players', 'b -> RunService', 'c -> TweenService']) {
    assert.ok(result.renamedIdentifiers.includes(expected), 'Missing service mapping: ' + expected);
  }
});


test('recognizes Luau/Lua numeric formats and fixes safe constant folding', () => {
  const source = [
    'local hex = (0x10 + 0b10)',
    'local octal = 0o17',
    'local scientific = 1.5e-3',
    'local shifted = (4 << 2)',
    'local joined = string.char(0x50, 0x72, 0x69)'
  ].join('\n');
  const result = convertToPureLuau(source);
  assert.match(result.output, /local hex = 18/);
  assert.match(result.output, /local octal = 0o17/);
  assert.match(result.output, /local scientific = 1\.5e-3/);
  assert.match(result.output, /local shifted = 16/);
  assert.match(result.output, /"Pri"/);
  assert.equal(result.coverage.numericFormats.hexadecimal, 4);
  assert.equal(result.coverage.numericFormats.binary, 1);
  assert.equal(result.coverage.numericFormats.octal, 1);
  assert.equal(result.coverage.numericFormats.scientific, 1);
});

test('statically evaluates safe literal bit32 and string calls', () => {
  const source = [
    'local xorValue = bit32.bxor(0x50, 0x20)',
    'local reversed = string.reverse("stressed")',
    'local slice = string.sub("abcdef", 2, 4)',
    'local unicode = utf8.char(0x1F642)'
  ].join('\n');
  const result = convertToPureLuau(source);
  assert.match(result.output, /local xorValue = 112/);
  assert.match(result.output, /local reversed = "desserts"/);
  assert.match(result.output, /local slice = "bcd"/);
  assert.match(result.output, /local unicode = "🙂"/);
  assert.equal(result.foldedBit32Calls, 1);
  assert.equal(result.foldedStringCalls, 2);
  assert.equal(result.foldedStringCharCalls, 1);
});

test('reports duplicate fragments and incomplete/broken structure without deleting code', () => {
  const fragment = [
    'for i, value in ipairs(items) do',
    '  process(value)',
    'end',
    'local function reset()',
    '  Config.mode = "Normal"',
    'end',
    'for i, value in ipairs(items) do',
    '  process(value)',
    'end',
    'local first, second ='
  ].join('\n');
  const result = convertToPureLuau(fragment);
  assert.ok(result.structuralDiagnostics.some(item => /duplicated/.test(item)));
  assert.ok(result.structuralDiagnostics.some(item => /ends with "="/.test(item)));
  assert.equal(result.duplicateBlocks.length > 0, true);
  assert.equal((result.output.match(/for i, value in ipairs\(items\) do/g) || []).length, 2);
});

test('reports orphan and missing block endings', () => {
  const result = convertToPureLuau('end\nlocal function unfinished()\n  print("still open")');
  assert.ok(result.structuralDiagnostics.some(item => /Orphan "end"/.test(item)));
  assert.ok(result.structuralDiagnostics.some(item => /missing "end"/.test(item)));
});

test('infers a setter name from a single clear Config assignment', () => {
  const result = convertToPureLuau('local function fn14()\n  Config.batAimbotVersion = "Normal"\nend');
  assert.match(result.output, /local function setBatAimbotVersion\(\)/);
  assert.ok(result.renamedIdentifiers.includes('fn14 -> setBatAimbotVersion'));
});


test('folds table.concat and keeps byte-oriented string behavior', () => {
  const source = [
    'local joined = table.concat({"red", "green", "blue"}, "-")',
    'local defaultBit = bit32.extract(0xF0, 4)',
    'local defaultReplace = bit32.replace(0, 1, 4)',
    'local escapedReverse = string.reverse("a\\nb")',
    'local emojiReverse = string.reverse("🙂")'
  ].join('\n');
  const result = convertToPureLuau(source);
  assert.match(result.output, /local joined = "red-green-blue"/);
  assert.match(result.output, /local defaultBit = 1/);
  assert.match(result.output, /local defaultReplace = 16/);
  assert.match(result.output, /local escapedReverse = "b\\na"/);
  assert.match(result.output, /local emojiReverse = string.reverse/);
  assert.equal(result.foldedTableConcatCalls, 1);
  assert.equal(result.foldedBit32Calls, 2);
  assert.ok(result.coverage.tableApis.includes('concat'));
  assert.ok(result.coverage.escapeStyles.includes('decimal string escapes') === false);
});


test('adds semantic readability names for GUI callbacks, layout data, and tracked instances', () => {
  const source = [
    'local function fn2(child)',
    '  if child:IsA("ScreenGui") then',
    '    child.Enabled = true',
    '  end',
    'end',
    'PlayerGui.ChildAdded:Connect(fn2)',
    'CoreGui.ChildAdded:Connect(fn2)',
    'local function fn3(arg, arg2, arg3, arg4)',
    '       local kind = type(arg)',
    '  if kind ~= "table" then return arg2 end',
    '  local sx, ox = tonumber(arg.sx), tonumber(arg.ox)',
    '  local sy, oy = tonumber(arg.sy), tonumber(arg.oy)',
    '  if not sx or not ox or not sy or not oy then return arg2 end',
    '  return UDim2.new(sx, ox, sy, oy)',
    'end',
    'local function clearTracked(scale)',
    '  for i = #tbl6, 1, -1 do',
    '    local v9 = tbl6[i]',
    '    if v9 and v9.Parent then v9:Destroy() end',
    '  end',
    'end'
  ].join('\n');
  const result = convertToPureLuau(source);
  assert.match(result.output, /local function handleGuiChildAdded\(child\)/);
  assert.match(result.output, /local function resolveUDim2\(layoutData, fallbackValue, arg3, arg4\)/);
  assert.match(result.output, /local trackedInstance = tbl6\[i\]/);
  assert.ok(result.readabilityRenamedIdentifiers >= 3);
  assert.ok(result.formattedLines > 0);
});

test('infers the skin preview state table from its distinctive fields and marker', () => {
  const source = [
    'if type(_G.__VX7_SKIN_PREVIEW_MODELS) ~= "table" then',
    '  _G.__VX7_SKIN_PREVIEW_MODELS = {}',
    'end',
    'local tbl3, skinGalaxyCache, handlers =',
    '  { cache = {}, addConn = nil, remConn = nil, start = nil, stop = nil, setToggle = nil },',
    '  {},',
    '  {}'
  ].join('\n');
  const result = convertToPureLuau(source);
  assert.match(result.output, /local skinPreviewState, skinGalaxyCache, handlers =/);
  assert.ok(result.renamedIdentifiers.includes('tbl3 -> skinPreviewState'));
});


test('uses the StyLua Luau parser/formatter for valid source', () => {
  const result = convertToPureLuau([
    'local function example(arg)',
    'if arg then',
    'print(arg)',
    'end',
    'end'
  ].join('\n'));
  assert.equal(result.formatterUsed, 'StyLua 2.6.0 (Luau)');
  assert.equal(result.formatterSyntaxValidated, true);
  assert.match(result.output, /local function example\(arg\)/);
  assert.match(result.output, /\n  if arg then\n/);
});
