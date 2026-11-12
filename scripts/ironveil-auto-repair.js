'use strict';

// Conservative normalizations for simple Luau compound assignments.
// Complex l-values and ambiguous lines are deliberately left unchanged.
function repairIronVeilSource(source) {
  const lines = String(source).split(/\r?\n/);
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
    const match = /^(\s*)([A-Za-z_][A-Za-z0-9_]*)\s*(\+=|-=|\*=|\/=|%=|\^=|\.\.=)\s*(.+?)\s*$/.exec(line);
    if (!match) continue;

    const [, indent, identifier, operator, expression] = match;
    // Avoid comments, statement separators, and expressions that cannot be
    // safely normalized by this line-based compatibility pass.
    if (!expression || expression.includes('--') || /;\s*$/.test(expression)) continue;
    const arithmetic = operators[operator];
    lines[index] = indent + identifier + ' = ' + identifier + ' ' + arithmetic + ' (' + expression + ')';
    changes.push({ line: index + 1, from: operator, to: arithmetic });
  }

  return {
    source: lines.join('\n'),
    changes,
    changed: changes.length > 0,
  };
}

module.exports = { repairIronVeilSource };
