'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  lauxlib,
  lua,
  lualib,
  to_jsstring,
  to_luastring,
} = require('fengari');
const { obfuscateDailyfuscatorInWorker } = require('./dailyfuscator-runtime');

function runLua(code) {
  const state = lauxlib.luaL_newstate();
  lualib.luaL_openlibs(state);
  const status = lauxlib.luaL_dostring(state, to_luastring(code));
  if (status !== lua.LUA_OK) {
    const error = lua.lua_type(state, -1) === lua.LUA_TSTRING
      ? to_jsstring(lua.lua_tostring(state, -1))
      : 'Lua execution failed';
    return { ok: false, error };
  }

  const values = [];
  const count = lua.lua_gettop(state);
  for (let index = 1; index <= count; index++) {
    const type = lua.lua_type(state, index);
    if (type === lua.LUA_TSTRING || type === lua.LUA_TNUMBER) {
      values.push(to_jsstring(lua.lua_tostring(state, index)));
    } else if (type === lua.LUA_TBOOLEAN) {
      values.push(lua.lua_toboolean(state, index) ? 'true' : 'false');
    } else if (type === lua.LUA_TNIL) {
      values.push('nil');
    } else {
      values.push(lua.lua_typename(state, type));
    }
  }
  return { ok: true, values };
}

test('Dailyfuscator v3 preserves a simple function across all profiles', async () => {
  const source = [
    'local function greet(name)',
    '  local message = "hello, " .. name',
    '  if #name > 0 then return message end',
    '  return "hello"',
    'end',
    'return greet("world")',
  ].join('\n');

  for (const profile of ['light', 'standard', 'hard']) {
    const result = await obfuscateDailyfuscatorInWorker(source, {
      profile,
      seed: 'dailyfuscator-test-' + profile,
      minBytes: 4096,
      notice: false,
    }, 60_000);
    assert.equal(result.ok, true, result.ok ? '' : result.error);
    const executed = runLua(result.code);
    assert.equal(executed.ok, true, executed.ok ? '' : profile + ': ' + executed.error);
    assert.deepEqual(executed.values, ['hello, world'], profile + ' output changed behavior');
  }
});
