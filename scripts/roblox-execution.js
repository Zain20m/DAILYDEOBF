'use strict';

const API_ROOT = 'https://apis.roblox.com/cloud/v2';
const MAX_LOCAL_CONCURRENT_TASKS = 2;
let activeLocalTasks = 0;

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function readJsonResponse(response, label) {
  const text = await response.text();
  let value = {};
  try {
    value = text ? JSON.parse(text) : {};
  } catch {
    value = { raw: text.slice(0, 1500) };
  }

  if (!response.ok) {
    const detail = value && (value.message || value.detail || value.error);
    throw new Error(
      label + ' failed with HTTP ' + response.status +
      (detail ? ': ' + String(detail).slice(0, 900) : '')
    );
  }
  return value;
}

function validateConfig({ apiKey, universeId, placeId, script, timeoutSeconds }) {
  if (typeof apiKey !== 'string' || !apiKey.trim()) {
    throw new Error('ROBLOX_OPEN_CLOUD_API_KEY is not configured.');
  }
  if (!/^\d+$/.test(String(universeId || ''))) {
    throw new Error('ROBLOX_EXEC_UNIVERSE_ID must contain only digits.');
  }
  if (!/^\d+$/.test(String(placeId || ''))) {
    throw new Error('ROBLOX_EXEC_PLACE_ID must contain only digits.');
  }
  if (typeof script !== 'string' || !script.trim()) {
    throw new Error('No Luau source was supplied.');
  }
  if (!Number.isInteger(timeoutSeconds) || timeoutSeconds < 1 || timeoutSeconds > 300) {
    throw new Error('Execution timeout must be between 1 and 300 seconds.');
  }
}

async function runLuauTask(options) {
  const {
    apiKey,
    universeId,
    placeId,
    script,
    timeoutSeconds = 30,
    fetchImpl = globalThis.fetch,
    sleep = delay,
    onStatus,
  } = options || {};

  validateConfig({ apiKey, universeId, placeId, script, timeoutSeconds });
  if (typeof fetchImpl !== 'function') {
    throw new Error('This Node.js runtime does not provide fetch().');
  }

  const basePath = '/universes/' + universeId + '/places/' + placeId;
  const createUrl = API_ROOT + basePath + '/luau-execution-session-tasks';

  const createResponse = await fetchImpl(createUrl, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({ script, timeout: timeoutSeconds + 's' }),
    signal: AbortSignal.timeout(20_000),
  });
  const created = await readJsonResponse(createResponse, 'Roblox task creation');

  if (
    typeof created.path !== 'string' ||
    !/^universes\/\d+\/places\/\d+\/(?:versions\/\d+\/)?luau-execution-sessions\/[A-Za-z0-9-]+\/tasks\/[A-Za-z0-9-]+$/.test(created.path)
  ) {
    throw new Error('Roblox created a task but did not return a valid task path.');
  }

  if (activeLocalTasks >= MAX_LOCAL_CONCURRENT_TASKS) {
    throw new Error('The local Roblox execution queue is full. Try again after another task finishes.');
  }
  activeLocalTasks++;

  try {
  const taskUrl = API_ROOT + '/' + created.path;
  const startedAt = Date.now();
  const maxWaitMs = timeoutSeconds * 1000 + 45_000;
  let task = created;
  let polls = 0;

  while (String(task.state || '').toUpperCase() === 'PROCESSING') {
    if (Date.now() - startedAt > maxWaitMs) {
      throw new Error('The Roblox task is still processing after the local wait limit. Task path: ' + created.path);
    }

    await sleep(2000);
    polls++;

    const pollResponse = await fetchImpl(taskUrl, {
      method: 'GET',
      headers: {
        'x-api-key': apiKey,
        accept: 'application/json',
      },
      signal: AbortSignal.timeout(20_000),
    });
    task = await readJsonResponse(pollResponse, 'Roblox task status');

    if (typeof onStatus === 'function') {
      onStatus({
        state: String(task.state || 'UNKNOWN'),
        polls,
        elapsedMs: Date.now() - startedAt,
      });
    }
  }

  let logs = [];
  try {
    const logsResponse = await fetchImpl(taskUrl + '/logs', {
      method: 'GET',
      headers: {
        'x-api-key': apiKey,
        accept: 'application/json',
      },
      signal: AbortSignal.timeout(20_000),
    });
    const logPayload = await readJsonResponse(logsResponse, 'Roblox task logs');
    const rows = Array.isArray(logPayload.luauExecutionSessionTaskLogs)
      ? logPayload.luauExecutionSessionTaskLogs
      : [];
    logs = rows.flatMap((row) => Array.isArray(row.messages) ? row.messages : []);
    if (!logs.length) {
      logs = rows.flatMap((row) =>
        Array.isArray(row.structuredMessages)
          ? row.structuredMessages.map((entry) => entry.message).filter(Boolean)
          : []
      );
    }
  } catch (error) {
    logs = ['[log retrieval] ' + String(error.message || error)];
  }

  return {
    task,
    logs,
    taskPath: created.path,
    polls,
    elapsedMs: Date.now() - startedAt,
  };
  } finally {
    activeLocalTasks--;
  }
}

module.exports = { runLuauTask };
