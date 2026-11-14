'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { detectEngineSuggestion: detect } = require('./engine-detection');

const v14Body = 'return({' + Array.from({ length: 30 }, (_, i) =>
  'K' + i + '=function(a,b)if a==0X1f then for l=0x38,77,0B101 do continue end end return 0X2_0 end').join(',') + '})';
const v15Body = 'return setmetatable({[24]=buffer.writeu8,[97]=string.sub,[112]=bit32.lshift,[36]=buffer.readu8,T=function(Y)return Y end},{})';

test('explicit Luraph banners map to the exact engine', () => {
  for (const [v, id] of [['14.7', 'luraph-v147'], ['14.8', 'luraph-v148'], ['14.9', 'luraph-v149'], ['15', 'luraph-v15'], ['15.1', 'luraph-151'], ['14.3', 'luraph-v143']]) {
    const r = detect('-- This file was protected using Luraph Obfuscator v' + v + ' [https://lura.ph/]\n' + v14Body);
    assert.equal(r.engine, id, v);
    assert.equal(r.confidence, 'high');
  }
});

test('unsupported Luraph versions get the closest engine at lower confidence', () => {
  const r = detect('-- This file was protected using Luraph Obfuscator v14.5\n' + v14Body);
  assert.equal(r.engine, 'luraph-v147');
  assert.equal(r.confidence, 'medium');
});

test('stripped banners fall back to the VM layout', () => {
  assert.equal(detect(v14Body).engine, 'luraph-v149');
  assert.deepEqual(detect(v14Body).alternatives, ['luraph-v148', 'luraph-v147']);
  assert.equal(detect(v15Body).engine, 'luraph-151');
  assert.deepEqual(detect(v15Body).alternatives, ['luraph-v15']);
});

test('a Luraph mention inside code or strings is not a banner', () => {
  assert.equal(detect('local msg = "Luraph v15 sucks"\nprint(msg)\n'), null);
  assert.equal(detect('local ib2 = 5\nprint(ib2)\n'), null);
});

test('other obfuscators with engine buttons are recognised', () => {
  assert.equal(detect('-- This file was obfuscated by Fulcrum [ https://polsec.net ]\nlocal a=1').engine, 'fulcrum');
  assert.equal(detect('return(function(...)obfuscator="this file was protected with 2hbj\'s obfuscator | x"local NE=1 end)(...)').engine, '2hbj');
  assert.equal(detect('-- Centurion v6\nlocal a=1').engine, 'centurion');
  assert.equal(detect('-- this file was generated using ironbrew1\nreturn 1').engine, 'ironbrew1');
  assert.equal(detect('loadstring(game:HttpGet("https://api.jnkie.com/api/v1/luascripts/public/abc"))()').engine, 'jnkie');
});

test('already-deobfuscated output and key loaders are not sent to an engine', () => {
  const out = detect('-- Devirtualized with Luraph v14.9 engine\nlocal function payload_fn_1() error("devirt: x") end');
  assert.equal(out.engine, null);
  assert.match(out.label, /already-deobfuscated/);
  const loader = detect('script_key="abc";\nloadstring(game:HttpGet("https://api.luarmor.net/files/v3/loaders/x.lua"))()');
  assert.equal(loader.engine, null);
  assert.equal(loader.label, 'Luarmor loader');
});

test('plain Lua gives no suggestion', () => {
  assert.equal(detect('local Players = game:GetService("Players")\nprint(Players.LocalPlayer.Name)\n'), null);
});
