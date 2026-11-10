'use strict';

function detectFlowAuthLuraphVersion(source) {
  const text = String(source || '');
  const banner = text.match(/Luraph(?:\\s+Obfuscator)?\\s+v?(14\\.7|14\\.8|14\\.9|15\\.1|15)(?![\\d.])/i);
  if (banner) {
    return { version: banner[1], detectedBy: 'Luraph version banner', explicit: true };
  }

  // FlowAuth's documented macro families identify the pinned Luraph version
  // when the original macro names are still visible in the supplied source.
  if (/\\b(?:LPH_NO_VIRTUALIZE|LPH_JIT_MAX)\\b/.test(text)) {
    return { version: '14.9', detectedBy: 'v14.9 macro markers', explicit: true };
  }
  if (/\\b(?:LPH_ATTRIBUTES|LPH_PRECHECK|LPH_ASSUME|LPH_ENCBUF)\\b/.test(text)) {
    return { version: '15.1', detectedBy: 'v15 macro markers', explicit: true };
  }

  return { version: '15.1', detectedBy: 'FlowAuth current-version default', explicit: false };
}

module.exports = { detectFlowAuthLuraphVersion };
