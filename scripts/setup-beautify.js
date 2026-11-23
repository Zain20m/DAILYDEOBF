'use strict';

const { spawnSync } = require('node:child_process');
const path = require('node:path');

const python = process.env.PYTHON_BIN || (process.platform === 'win32' ? 'python' : 'python3');
const root = path.join(__dirname, '..');
const requirements = path.join(root, 'beautify-requirements.txt');

function run(args, label) {
  console.log('[Beautify] ' + label);
  return spawnSync(python, args, {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
  });
}

function dependenciesReady() {
  const result = run(['-c', 'import tree_sitter, tree_sitter_luau'], 'Checking Tree-sitter dependencies...');
  return result.status === 0;
}

if (dependenciesReady()) {
  console.log('[Beautify] Tree-sitter dependencies are ready.');
  process.exit(0);
}

// Some minimal Python images ship without pip. Try Python's bundled pip
// bootstrap before attempting to install the pinned requirements.
const ensurePip = run(['-m', 'ensurepip', '--upgrade'], 'Bootstrapping pip with ensurepip...');
if (ensurePip.error) {
  console.warn('[Beautify] ensurepip could not start:', ensurePip.error.message);
} else if (ensurePip.status !== 0) {
  console.warn('[Beautify] ensurepip is unavailable in this Python installation.');
}

let install = run(
  ['-m', 'pip', 'install', '--disable-pip-version-check', '-r', requirements],
  'Installing Tree-sitter requirements...'
);

// Debian/Ubuntu Python images may enforce PEP 668. Retry explicitly if pip
// reports that the system environment is externally managed.
if (install.status !== 0) {
  install = run(
    ['-m', 'pip', 'install', '--disable-pip-version-check', '--break-system-packages', '-r', requirements],
    'Retrying dependency installation for an externally managed Python...'
  );
}

if (install.status !== 0) {
  console.error('[Beautify] Tree-sitter dependencies could not be installed. The formatter fallback remains available.');
  process.exit(0);
}

if (!dependenciesReady()) {
  console.error('[Beautify] Installation finished, but Python still cannot import Tree-sitter. The formatter fallback remains available.');
  process.exit(0);
}

console.log('[Beautify] Tree-sitter dependencies installed and verified.');
