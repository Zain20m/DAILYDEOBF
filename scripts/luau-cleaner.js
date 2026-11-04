'use strict';
const fs = require('node:fs/promises');

function scan(source) {
  const tokens = []; let i = 0; let lineBreak = false;
  while (i < source.length) {
    const ch = source[i];
    if (ch === '\r' || ch === '\n') { if (ch === '\r' && source[i + 1] === '\n') i++; i++; lineBreak = true; continue; }
    if (/\s/.test(ch)) { i++; continue; }
    const start = i; let type = 'word';
    if (ch === '"' || ch === "'") { type = 'string'; const q = ch; i++; while (i < source.length) { if (source[i] === '\\') { i += 2; continue; } if (source[i++] === q) break; } }
    else if (ch === '[' && /^\[(=*)\[/.test(source.slice(i))) { const m = source.slice(i).match(/^\[(=*)\[/); type = 'longstring'; const close = ']' + m[1] + ']'; i += m[0].length; const end = source.indexOf(close, i); i = end < 0 ? source.length : end + close.length; }
    else if (ch === '-' && source[i + 1] === '-') { type = 'comment'; const m = source.slice(i + 2).match(/^\[(=*)\[/); if (m) { const close = ']' + m[1] + ']'; i += 2 + m[0].length; const end = source.indexOf(close, i); i = end < 0 ? source.length : end + close.length; } else { i += 2; while (i < source.length && source[i] !== '\n' && source[i] !== '\r') i++; } }
    else if (/[A-Za-z_]/.test(ch)) { i++; while (i < source.length && /[A-Za-z0-9_]/.test(source[i])) i++; }
    else if (/[0-9]/.test(ch)) { i++; while (i < source.length && /[A-Za-z0-9_.]/.test(source[i])) i++; }
    else { const ops = ['...', '..', '==', '~=', '<=', '>=', '+=', '-=', '*=', '/=', '//', '::']; const op = ops.find(x => source.startsWith(x, i)); i += op ? op.length : 1; }
    tokens.push({ value: source.slice(start, i), type, lineBreak }); lineBreak = false;
  }
  return tokens;
}

function format(source) {
  const tokens = scan(String(source || '').replace(/^\uFEFF/, ''));
  const lines = []; let line = ''; let indent = 0; let previous = null;
  const pad = () => '  '.repeat(Math.max(0, indent));
  const flush = () => { const s = line.trim(); if (s) lines.push(pad() + s); line = ''; };
  const append = (v, spaced = true) => { if (!v) return; if (spaced && line && !/[([{.:]$/.test(line) && !/^[)\]},.;:]/.test(v)) line += ' '; line += v; };
  for (const token of tokens) {
    const v = token.value;
    if (token.type === 'comment') { if (line.trim()) flush(); lines.push(pad() + v); previous = token; continue; }
    if (v === ';') { flush(); previous = token; continue; }
    if (v === 'end' || v === 'until' || v === 'else' || v === 'elseif') {
      if (line.trim()) flush(); indent = Math.max(0, indent - 1); append(v, false);
      if (v !== 'until') flush(); if (v === 'else') indent++; previous = token; continue;
    }
    if (token.lineBreak && line.trim()) flush();
    if ([',', '.', ':', '[', '(', ')', ']', '}'].includes(v)) append(v, false);
    else append(v, true);
    if (v === 'then' || v === 'do' || v === 'else' || v === 'repeat') { flush(); indent++; }
    previous = token;
  }
  if (line.trim()) flush();
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

async function main() {
  const [inputPath, outputPath] = process.argv.slice(2);
  if (!inputPath || !outputPath) throw new Error('Usage: node luau-cleaner.js input.luau output.luau');
  const source = await fs.readFile(inputPath, 'utf8');
  const result = format(source); await fs.writeFile(outputPath, result, 'utf8');
  process.stdout.write('Formatted ' + Buffer.byteLength(source) + ' -> ' + Buffer.byteLength(result) + ' bytes\n');
}
if (require.main === module) main().catch(e => { console.error(e.message || e); process.exitCode = 1; });
module.exports = { format, scan };