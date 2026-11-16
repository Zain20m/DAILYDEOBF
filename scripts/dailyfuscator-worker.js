'use strict';

const { parentPort, workerData } = require('node:worker_threads');
const { loadDailyfuscator } = require('./dailyfuscator-runtime');

(async () => {
  try {
    const engine = await loadDailyfuscator();
    const result = engine.obfuscate(workerData.source, workerData.options || {});
    parentPort.postMessage({ ok: true, result });
  } catch (error) {
    parentPort.postMessage({
      ok: false,
      error: String(error && error.message || error).slice(0, 1500),
    });
  }
})();
