'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { runLuauTask } = require('./roblox-execution');

function response(status, payload) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() { return JSON.stringify(payload); },
  };
}

const baseOptions = {
  apiKey: 'test-secret',
  universeId: '123',
  placeId: '456',
  script: 'return game.Name',
  timeoutSeconds: 12,
};

test('creates a Roblox Open Cloud task, polls it, and collects logs', async () => {
  const calls = [];
  const result = await runLuauTask({
    ...baseOptions,
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      if (options.method === 'POST') {
        return response(200, {
          path: 'universes/123/places/456/versions/7/luau-execution-sessions/s1/tasks/t1',
          state: 'PROCESSING',
        });
      }
      if (url.endsWith('/logs')) {
        return response(200, {
          luauExecutionSessionTaskLogs: [{ messages: ['hello from Roblox'] }],
        });
      }
      return response(200, {
        state: 'COMPLETE',
        output: { results: ['Baseplate'] },
      });
    },
    sleep: async () => {},
  });

  assert.equal(calls.length, 3);
  assert.equal(calls[0].options.method, 'POST');
  assert.equal(calls[0].options.headers['x-api-key'], 'test-secret');
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    script: 'return game.Name',
    timeout: '12s',
  });
  assert.equal(result.task.state, 'COMPLETE');
  assert.deepEqual(result.logs, ['hello from Roblox']);
  assert.equal(result.taskPath, 'universes/123/places/456/versions/7/luau-execution-sessions/s1/tasks/t1');
});

test('returns immediately when the create response is already terminal', async () => {
  let calls = 0;
  const result = await runLuauTask({
    ...baseOptions,
    fetchImpl: async (url) => {
      calls++;
      if (url.endsWith('/logs')) {
        return response(200, { luauExecutionSessionTaskLogs: [] });
      }
      return response(200, {
        path: 'universes/123/places/456/versions/7/luau-execution-sessions/s1/tasks/t1',
        state: 'COMPLETE',
        output: { results: [42] },
      });
    },
  });

  assert.equal(calls, 2);
  assert.equal(result.task.state, 'COMPLETE');
  assert.equal(result.polls, 0);
});

test('reports Roblox API errors without exposing request secrets', async () => {
  await assert.rejects(
    runLuauTask({
      ...baseOptions,
      fetchImpl: async () => response(403, { message: 'API key lacks required permission' }),
    }),
    /HTTP 403: API key lacks required permission/
  );
});

test('validates identifiers, script and timeout before making a request', async () => {
  let called = false;
  const fetchImpl = async () => { called = true; return response(200, {}); };

  await assert.rejects(
    runLuauTask({ ...baseOptions, universeId: 'abc', fetchImpl }),
    /ROBLOX_EXEC_UNIVERSE_ID/
  );
  await assert.rejects(
    runLuauTask({ ...baseOptions, script: ' ', fetchImpl }),
    /No Luau source/
  );
  await assert.rejects(
    runLuauTask({ ...baseOptions, timeoutSeconds: 301, fetchImpl }),
    /between 1 and 300/
  );
  assert.equal(called, false);
});
