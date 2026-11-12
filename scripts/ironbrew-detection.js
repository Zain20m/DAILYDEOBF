'use strict';

function detectIronBrewSuggestion(source) {
  const text = String(source || '').slice(0, 2 * 1024 * 1024);
  if (!text.trim()) return null;

  const ib2Banner = /\bIronBrew\s*(?:Obfuscator\s*)?(?:v(?:ersion)?\s*)?2(?:\.0)?\b|\bIronBrew2\b|\bIB2\b/i;
  const ib1Banner = /\bIronBrew\s*(?:Obfuscator\s*)?(?:v(?:ersion)?\s*)?1(?:\.0)?\b|\bIronBrew1\b|\bIB1\b/i;

  if (ib2Banner.test(text)) {
    return {
      engine: 'ironbrew2',
      label: 'IronBrew 2',
      confidence: 'high',
      reason: 'The source contains an explicit IronBrew 2 / IB2 marker.',
    };
  }

  if (ib1Banner.test(text)) {
    return {
      engine: 'ironbrew1',
      label: 'IronBrew 1',
      confidence: 'high',
      reason: 'The source contains an explicit IronBrew 1 / IB1 marker.',
    };
  }

  const ib2Markers = [
    /\bIB_INLINING_START\s*\(/i,
    /\bIB_INLINING_END\b/i,
    /\bIRONBREW_STR_DEC_GENERIC\b/i,
    /\bIRONBREW_STR_ENCRYPT(?:_IMPORTANT)?\b/i,
  ];
  const markerCount = ib2Markers.reduce((count, marker) => count + (marker.test(text) ? 1 : 0), 0);
  if (markerCount >= 2) {
    return {
      engine: 'ironbrew2',
      label: 'IronBrew 2',
      confidence: 'medium',
      reason: 'Multiple IronBrew 2 constant-encryption / inlining markers were found.',
    };
  }

  if (/\bIronBrew\b|\bIB_INLINING_/i.test(text)) {
    return {
      engine: null,
      label: 'IronBrew (version unclear)',
      confidence: 'low',
      reason: 'An IronBrew marker was found, but it is not enough to distinguish IB1 from IB2.',
    };
  }

  return null;
}

module.exports = { detectIronBrewSuggestion };
