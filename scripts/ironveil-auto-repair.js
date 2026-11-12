'use strict';

// Conservative, semantics-preserving normalizations for syntax IronVeil's Lua 5.3
// parser does not accept. Only simple local/global identifier compound assignments
// are rewritten. Complex l-values and ambiguous lines are deliberately left alone.
function repairIronVeilSource(source) {
  const lines = String(source).split(/\\r?\\n/);
  const changes = [];
  const operators = {
    '+=': '+',
    '-=': '-',
    '*=': '*',
    '/=': '/',
    '%=': '%',
    '^=': '^',
    '..=': '..',
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const match = /^(\\s*)([A-Za-z_][A-Za-z0-9_]*)\\s*(\\+=|-=|\\*=|\\/=|%=|\\^=|\\.\\.=)\\s*(.+?)\\s*$/.exec(line);
    if (!match) continue;

    const [, indent, identifier, operator, expression] = match;
    // Avoid changing strings, comments, or lines with a trailing statement separator.
    if (!expression || expression.startsWith('--') || /[;]\\s*$/.test(expression)) continue;
    const arithmetic = operators[operator];
    lines[index] = indent + identifier + ' = ' + identifier + ' ' + arithmetic + ' (' + expression + ')';
    changes.push({ line: index + 1, from: operator, to: arithmetic });
  }

  return {
    source: lines.join('\\n'),
    changes,
    changed: changes.length > 0,
  };
}

module.exports = { repairIronVeilSource };
