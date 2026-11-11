'use strict';

function detectFlowAuthLuraphVersion(source) {
  const text = String(source || '');
  const banner = text.match(/Luraph(?:\s+Obfuscator)?\s+v?(\d+(?:\.\d+)*)/i);
  if (banner) {
    const version = banner[1];
    const supported = new Set(['15', '15.1']);
    if (!supported.has(version)) {
      return { version, detectedBy: 'unsupported Luraph version banner', explicit: true, unsupported: true };
    }
    return { version, detectedBy: 'Luraph version banner', explicit: true, unsupported: false };
  }

  // FlowAuth's documented macro families identify the pinned Luraph version
  // when the original macro names are still visible in the supplied source.
  if (/\b(?:LPH_NO_VIRTUALIZE|LPH_JIT_MAX)\b/.test(text)) {
    return { version: '14.9', detectedBy: 'unsupported v14 macro markers', explicit: true, unsupported: true };
  }
  if (/\b(?:LPH_ATTRIBUTES|LPH_PRECHECK|LPH_ASSUME|LPH_ENCBUF)\b/.test(text)) {
    return { version: '15.1', detectedBy: 'v15 macro markers', explicit: true };
  }

  return { version: '15.1', detectedBy: 'FlowAuth current-version default', explicit: false };
}

module.exports = { detectFlowAuthLuraphVersion };
