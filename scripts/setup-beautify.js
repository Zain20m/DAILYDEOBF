'use strict';

const { spawnSync } = require('node:child_process');
const path = require('node:path');

const python = process.env.PYTHON_BIN || (process.platform === 'win32' ? 'python' : 'python3');
const root = path.join(__dirname, '..');
const requirements = path.join(root, 'beautify-requirements.txt');

const check = spawnSync(python, ['-c', 'import tree_sitter, tree_sitter_luau'], {
  cwd: root,
  stdio: 'inherit',
});
if (check.status !== 0) {
  const install = spawnSync(python, ['-m', 'pip', 'install', '--disable-pip-version-check', '-r', requirements], {
    cwd: root,
    stdio: 'inherit',
  });
  if (install.status !== 0) {
    console.error('[Beautify] Python AST dependencies could not be installed. The formatter fallback remains available.');
  }
} else {
  console.log('[Beautify] AST dependencies are ready.');
}
