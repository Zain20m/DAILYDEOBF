'use strict';

// Safely adapts direct legacy game:HttpGet(...) calls for Roblox server Luau.
// Strings and comments are masked before matching so their contents are untouched.
function maskStringsAndComments(source) {
  return source.replace(
    /--\[(=*)\[[\s\S]*?\]\1\]|--[^\r\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\[(=*)\[[\s\S]*?\]\2/g,
    (match) => match.replace(/[^\r\n]/g, ' ')
  );
}

function adaptLegacyHttpGet(source) {
  const original = String(source || '');
  const masked = maskStringsAndComments(original);
  const pattern = /\bgame\s*([:.])\s*HttpGet\s*\(/g;
  const matches = [...masked.matchAll(pattern)];
  if (!matches.length) {
    return { source: original, replacements: 0 };
  }

  let output = original;
  for (let i = matches.length - 1; i >= 0; i--) {
    const match = matches[i];
    const start = match.index;
    const end = start + match[0].length;
    output = output.slice(0, start) +
      'game:GetService("HttpService"):GetAsync(' +
      output.slice(end);
  }
  return { source: output, replacements: matches.length };
}

module.exports = { adaptLegacyHttpGet };
