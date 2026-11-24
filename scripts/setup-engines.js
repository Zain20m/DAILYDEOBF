'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');

const importedSetup = spawnSync(process.env.PYTHON_BIN || (process.platform === 'win32' ? 'python' : 'python3'), [
  path.join(__dirname, 'setup-imported-engines.py'),
], { cwd: root, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
if (importedSetup.stdout) process.stdout.write(importedSetup.stdout);
if (importedSetup.stderr) process.stderr.write(importedSetup.stderr);
if (importedSetup.error || importedSetup.status !== 0) {
  throw new Error('Imported deobfuscator engine setup failed: ' +
    (importedSetup.error ? importedSetup.error.message : 'setup script exited with code ' + importedSetup.status));
}

const python = process.env.PYTHON_BIN || (process.platform === 'win32' ? 'python' : 'python3');

const luraph151Setup = spawnSync(python, [path.join(__dirname, 'setup-luraph151-engine.py')], {
  cwd: root,
  encoding: 'utf8',
  maxBuffer: 2 * 1024 * 1024,
});
if (luraph151Setup.stdout) process.stdout.write(luraph151Setup.stdout);
if (luraph151Setup.stderr) process.stderr.write(luraph151Setup.stderr);
if (luraph151Setup.error || luraph151Setup.status !== 0) {
  throw new Error('Luraph 15.1 engine extraction failed: ' +
    (luraph151Setup.error ? luraph151Setup.error.message : 'setup script exited with code ' + luraph151Setup.status));
}
const ib2Setup = spawnSync(python, [path.join(__dirname, 'setup-ib2-engine.py')], {
  cwd: root,
  encoding: 'utf8',
  maxBuffer: 2 * 1024 * 1024,
});
if (ib2Setup.stdout) process.stdout.write(ib2Setup.stdout);
if (ib2Setup.stderr) process.stderr.write(ib2Setup.stderr);
if (ib2Setup.error || ib2Setup.status !== 0) {
  throw new Error('IronBrew 2 runtime extraction failed: ' +
    (ib2Setup.error ? ib2Setup.error.message : 'setup script exited with code ' + ib2Setup.status));
}

const ironveilArchive = path.join(root, 'upload', 'ironveil-main 2.zip');
if (!fs.existsSync(ironveilArchive)) {
  console.log('IronVeil archive not present; its engine option will report unavailable.');
} else {
  const ironveilSetup = spawnSync(python, [path.join(__dirname, 'setup-ironveil.py')], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 2 * 1024 * 1024,
  });
  if (ironveilSetup.stdout) process.stdout.write(ironveilSetup.stdout);
  if (ironveilSetup.stderr) process.stderr.write(ironveilSetup.stderr);
  if (ironveilSetup.error || ironveilSetup.status !== 0) {
    console.warn('IronVeil setup warning: ' +
      (ironveilSetup.error ? ironveilSetup.error.message : 'setup script exited with code ' + ironveilSetup.status) +
      '. Its engine option may be unavailable.');
  } else {
    const ironveilCompiler = path.join(root, 'node_modules', 'typescript', 'bin', 'tsc');
    if (!fs.existsSync(ironveilCompiler)) {
      console.warn('IronVeil requires TypeScript; skipping its build.');
    } else {
      const ironveilBuild = spawnSync(process.execPath, [
        ironveilCompiler,
        '-p',
        path.join(root, 'ironveil-engine', 'tsconfig.json'),
      ], {
        cwd: path.join(root, 'ironveil-engine'),
        encoding: 'utf8',
        maxBuffer: 4 * 1024 * 1024,
      });
      if (ironveilBuild.stdout) process.stdout.write(ironveilBuild.stdout);
      if (ironveilBuild.stderr) process.stderr.write(ironveilBuild.stderr);
      if (ironveilBuild.error || ironveilBuild.status !== 0) {
        console.warn('IronVeil TypeScript build warning: ' +
          (ironveilBuild.error ? ironveilBuild.error.message : 'tsc exited with code ' + ironveilBuild.status) +
          '. Its engine option may be unavailable.');
      }
    }
  }
}


// Verify the shared Linux Luau binary on this host before any engine uses it.
// A binary built with -march=native on a different CPU can terminate with SIGILL
// (Node reports signal SIGILL / shell status 132; Python may report -4).
if (process.platform !== 'win32') {
  const sharedBin = path.join(root, 'luraph-v15-engine', 'bin');
  const luau = path.join(sharedBin, 'luau');
  const smokePath = path.join(root, '.luau-runtime-smoke.luau');
  fs.writeFileSync(smokePath, 'print("LUAU_RUNTIME_OK")\\n');
  const testRuntime = () => {
    if (!fs.existsSync(luau)) return { status: 1, error: new Error('Luau binary is missing') };
    return spawnSync(luau, [smokePath], { encoding: 'utf8', timeout: 10000 });
  };
  let smoke;
  try { smoke = testRuntime(); } finally { fs.rmSync(smokePath, { force: true }); }
  const healthy = !smoke.error && smoke.status === 0 &&
    String(smoke.stdout || '').includes('LUAU_RUNTIME_OK');
  if (!healthy) {
    console.warn('[!] Shared Luau runtime failed its startup test; rebuilding portable binaries for this host.');
    const build = spawnSync(python, [
      path.join(root, 'luraph-v14.7-engine', 'build_luau.py'), '--portable',
    ], { cwd: root, encoding: 'utf8', timeout: 15 * 60 * 1000, maxBuffer: 8 * 1024 * 1024 });
    if (build.stdout) process.stdout.write(build.stdout);
    if (build.stderr) process.stderr.write(build.stderr);
    if (build.error || build.status !== 0) {
      throw new Error('Portable Luau rebuild failed. Install git, cmake, g++, and Python, then restart. ' +
        (build.error ? build.error.message : 'build exited with code ' + build.status));
    }
    for (const binary of ['luau', 'luau-ast']) {
      const built = path.join(root, 'luraph-v14.7-engine', 'bin', binary);
      const destination = path.join(sharedBin, binary);
      if (!fs.existsSync(built)) throw new Error('Portable Luau build did not create ' + built);
      fs.copyFileSync(built, destination);
      fs.chmodSync(destination, 0o755);
    }
    fs.writeFileSync(smokePath, 'print("LUAU_RUNTIME_OK")\\n');
    let verify;
    try { verify = testRuntime(); } finally { fs.rmSync(smokePath, { force: true }); }
    if (verify.error || verify.status !== 0 || !String(verify.stdout || '').includes('LUAU_RUNTIME_OK')) {
      throw new Error('Portable Luau runtime still fails its startup test: ' +
        (verify.error ? verify.error.message : String(verify.stderr || verify.stdout || verify.status)));
    }
    console.log('[+] Portable Luau runtime passed startup test.');
  }
}

// The imported Luraph v14.7 package shares the patched Luau runtime build.
// Copy the already provisioned binaries instead of compiling another Luau VM.
const v147Bin = path.join(root, 'luraph-v14.7-engine', 'bin');
const sharedLuauBin = path.join(root, 'luraph-v15-engine', 'bin');
fs.mkdirSync(v147Bin, { recursive: true });
for (const binary of ['luau', 'luau-ast']) {
  const source = path.join(sharedLuauBin, binary);
  const destination = path.join(v147Bin, binary);
  if (!fs.existsSync(destination) && fs.existsSync(source)) {
    fs.copyFileSync(source, destination);
  }
  if (process.platform !== 'win32' && fs.existsSync(destination)) {
    fs.chmodSync(destination, 0o755);
  }
}


const engines = [
  {
    label: 'Luraph v14.7',
    directory: 'luraph-v14.7-engine',
    required: [
      'cli.py',
      'harness.py',
      'traceout.py',
      'backend.py',
      'envlog.luau',
      'roblox_api.luau',
      'unicode_data.luau',
      'datatypes.luau',
      'zstd.luau',
      'obfuscators/base.py',
      'obfuscators/luraph_v14_7/__init__.py',
      'obfuscators/luraph_v14_7/driver.py',
      'obfuscators/luraph_v14_7/devirt.py',
      'obfuscators/luraph_v14_7/vmmap.py',
      'obfuscators/luraph_v14_7/optrace.py',
      'obfuscators/luraph_v14_8/__init__.py',
      'obfuscators/luraph_v14_8/driver.py',
      'obfuscators/luraph_v14_8/devirt.py',
      'obfuscators/luraph_v14_8/vmmap.py',
      'obfuscators/luraph_v14_8/optrace.py',
      'obfuscators/luraph_v14_9/__init__.py',
      'obfuscators/luraph_v14_9/driver.py',
      'obfuscators/luraph_v14_9/devirt.py',
      'obfuscators/luraph_v14_9/vmmap.py',
      'obfuscators/luraph_v14_9/optrace.py',
      'bin/luau',
      'bin/luau-ast',
    ],
  },
  {
    label: 'Luraph v14.3 static analyzer',
    directory: 'luraph-v14.3-engine',
    required: [
      'daily_cli.py',
      'luraph_decoder.py',
      'proto_deserializer.py',
      'translate_proto.py',
      'vm_opcode_table.py',
    ],
  },
  {
    label: 'Luraph v15',
    directory: 'luraph-v15-engine',
    required: [
      'deob.py',
      'harness.py',
      'envlog.luau',
      'roblox_api.luau',
      'unicode_data.luau',
      'datatypes.luau',
      'zstd.luau',
      'obfuscators/luraph_v15/__init__.py',
      'obfuscators/luraph_v15/driver.py',
      'obfuscators/luraph_v15/devirt.py',
      'obfuscators/ironbrew1/__init__.py',
      'obfuscators/ironbrew1/capture.luau',
      'obfuscators/ironbrew1/deflatten.py',
      'obfuscators/ironbrew1/devirt.py',
      'obfuscators/ironbrew1/forloops.py',
      'obfuscators/ironbrew1/instrument.py',
      'obfuscators/ironbrew1/listing.py',
      'bin/luau',
      'bin/luau-ast',
    ],
  },
  {
    label: 'Luraph 15.1',
    directory: 'luraph-v15.1-engine',
    required: [
      'deob.js',
      'src/detect.js',
      'src/driver.js',
      'src/harness.js',
      'core/obfuscators/luraph_v15/__init__.py',
      'core/obfuscators/luraph_v14/__init__.py',
      'core/obfuscators/luraph_v14/driver.py',
      'core/obfuscators/luraph_v14/vmmap.py',
      'core/obfuscators/luraph_v14/devirt.py',
      'runtime/envlog.luau',
      'bin/luau',
      'bin/luau-ast',
    ],
  },
  {
    label: 'IronBrew 2',
    directory: 'ib2deobf',
    required: [
      'KeraLua.dll',
      'Loretta.CodeAnalysis.dll',
      'Loretta.CodeAnalysis.Lua.dll',
      'Loretta.CodeAnalysis.Lua.Experimental.dll',
      'LuaAnalysis.Common.dll',
      'LuaAnalysis.Ironbrew2.deps.json',
      'LuaAnalysis.Ironbrew2.dll',
      'LuaAnalysis.Ironbrew2.runtimeconfig.json',
      'NLua.dll',
      'Tsu.dll',
    ],
  },
  {
    label: 'Centurion v6 / v6.1',
    directory: 'centurion-engine',
    required: [
      'centurion.py',
      'p2d_errors.json',
      'callerr_rules.json',
      'enumprops.json',
      'httpresps.json',
      'guessed_p2d.json',
    ],
  },
];

function cleanPythonCache(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory() && entry.name === '__pycache__') {
      fs.rmSync(fullPath, { recursive: true, force: true });
      continue;
    }
    if (entry.isDirectory()) {
      cleanPythonCache(fullPath);
      continue;
    }
    if (entry.isFile() && /\.(?:pyc|pyo)$/.test(entry.name)) {
      fs.rmSync(fullPath, { force: true });
    }
  }
}


for (const engine of engines) {
  const base = path.join(root, engine.directory);
  if (!fs.existsSync(base) || !fs.statSync(base).isDirectory()) {
    if (engine.label === 'IronBrew 2') {
      console.log('IronBrew 2 engine directory is missing; its engine option will report unavailable.');
      continue;
    }
    throw new Error(engine.label + ' engine directory is missing.');
  }

  for (const relative of engine.required) {
    const fullPath = path.join(base, relative);
    if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) {
      throw new Error(engine.label + ' engine is missing ' + relative);
    }
  }

  cleanPythonCache(base);

  if (process.platform !== 'win32') {
    for (const binary of ['luau', 'luau-ast']) {
      const runtimeBinary = path.join(base, 'bin', binary);
      if (fs.existsSync(runtimeBinary)) fs.chmodSync(runtimeBinary, 0o755);
    }
  }
}

const ib2Runtime = process.platform === 'win32'
  ? (process.arch === 'arm64' ? 'runtimes/win-arm64/native/lua54.dll' : 'runtimes/win-x64/native/lua54.dll')
  : (process.arch === 'arm64' ? 'runtimes/linux-arm64/native/liblua54.so' : 'runtimes/linux-x64/native/liblua54.so');
if (fs.existsSync(path.join(root, 'ib2deobf')) &&
    !fs.existsSync(path.join(root, 'ib2deobf', ib2Runtime))) {
  throw new Error('IronBrew 2 is missing its platform runtime: ' + ib2Runtime);
}

console.log('Validated Luraph v14.7, v14.8, v14.9, v14.3 static analyzer, v15, 15.1, IronBrew 1, IronBrew 2, Centurion');
