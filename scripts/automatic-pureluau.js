'use strict';

const path = require('node:path');
const { convertToPureLuau } = require('../pureluau');

const MAX_INPUT_CHARS = 4_000_000;
const MAX_INPUT_BYTES = 8 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 18 * 1024 * 1024;
const MAX_RENAME_LINES = 1_500;

function safeBaseName(filename) {
  const cleanName = path.basename(String(filename || 'script.lua').replace(/\\/g, '/'));
  const extension = path.extname(cleanName);
  return path.basename(cleanName, extension).replace(/[^A-Za-z0-9._-]/g, '_') || 'script';
}

function createAutomaticPureLuauResult(source, originalName = 'script.lua') {
  const sourceText = String(source ?? '');
  if (!sourceText.trim()) {
    return { status: 'skipped', reason: 'No readable source text was produced.' };
  }
  if (sourceText.includes('\\0')) {
    return { status: 'skipped', reason: 'The recovered output contains binary NUL bytes, so it was not sent to the Luau text pass.' };
  }

  const inputBytes = Buffer.byteLength(sourceText, 'utf8');
  if (sourceText.length > MAX_INPUT_CHARS || inputBytes > MAX_INPUT_BYTES) {
    return {
      status: 'skipped',
      reason: 'The recovered source exceeds PureLuau limits (4,000,000 characters / 8 MB). The original engine output is preserved.',
    };
  }

  const result = convertToPureLuau(sourceText);
  const outputBuffer = Buffer.from(result.output, 'utf8');
  if (!outputBuffer.length) {
    return { status: 'skipped', reason: 'PureLuau returned an empty result. The original engine output is preserved.' };
  }
  if (outputBuffer.length > MAX_OUTPUT_BYTES) {
    return { status: 'skipped', reason: 'The PureLuau output exceeds the 18 MB attachment limit. The original engine output is preserved.' };
  }

  const baseName = safeBaseName(originalName);
  const outputName = 'pureluau-' + baseName + '.luau';
  const reportName = 'pureluau-report-' + baseName + '.txt';
  const renamed = Array.isArray(result.renamedIdentifiers) ? result.renamedIdentifiers : [];
  const reportLines = [
    'DAILY DEOBF · Automatic PureLuau readability report',
    'Original source: ' + path.basename(String(originalName || 'script.lua')),
    'Converted source: ' + outputName,
    'Input size: ' + inputBytes.toLocaleString() + ' bytes',
    'Output size: ' + outputBuffer.length.toLocaleString() + ' bytes',
    'Lines processed: ' + Number(result.linesProcessed || 0).toLocaleString(),
    'Identifiers renamed: ' + Number(result.identifiersRenamed || 0).toLocaleString(),
    'Context-based readability names: ' + Number(result.readabilityRenamedIdentifiers || 0).toLocaleString(),
    'Renamed identifiers:',
    ...(renamed.length
      ? renamed.slice(0, MAX_RENAME_LINES).map((entry) => '- ' + String(entry))
      : ['- None detected']),
    ...(renamed.length > MAX_RENAME_LINES
      ? ['- Rename list truncated in this report; ' + (renamed.length - MAX_RENAME_LINES) + ' additional rename(s) were applied.']
      : []),
    '',
    'Formatting engine: ' + String(result.formatterUsed || 'conservative fallback'),
    'Formatter syntax check: ' + (result.formatterSyntaxValidated ? 'PASS' : 'NOT VALIDATED'),
    'Lexical validation: ' + (result.lexicalValidationPassed ? 'PASS' : 'REVIEW REQUIRED'),
    'Structural validation: ' + (result.structuralValidationPassed ? 'PASS' : 'REVIEW REQUIRED'),
    'Structural findings: ' + (result.structuralDiagnostics && result.structuralDiagnostics.length
      ? result.structuralDiagnostics.slice(0, 12).join(' | ').slice(0, 1_200)
      : 'None detected'),
    'Static strings decoded: ' + (result.decodedStaticStrings || []).length,
    'Static decoder loops simplified: ' + Number(result.decodedStateMachines || 0),
    'Executor-only API occurrences preserved: ' + Number(result.executorApisFound || 0),
    'Remaining API names: ' + ((result.unsupportedNames || []).join(', ') || 'None detected'),
    '',
    'This is a static readability pass. It does not execute the source, prove behavioral equivalence, or recreate VM behavior that the deobfuscator did not recover.',
    'The raw engine result is kept separately. Review both files before relying on the transformed output.',
  ];

  return {
    status: 'complete',
    outputName,
    reportName,
    outputBuffer,
    reportBuffer: Buffer.from(reportLines.join('\\n'), 'utf8'),
    identifiersRenamed: Number(result.identifiersRenamed || 0),
    formatterSyntaxValidated: Boolean(result.formatterSyntaxValidated),
    structuralValidationPassed: Boolean(result.structuralValidationPassed),
  };
}

module.exports = { createAutomaticPureLuauResult };
