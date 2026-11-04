#!/usr/bin/env python3
"""Switch DAILY DEOBF from the legacy bundle to the newest Luraph v15 engine."""
from pathlib import Path
import json

root = Path(__file__).resolve().parents[1]
index_path = root / "index.js"
source = index_path.read_text(encoding="utf-8")

old_constants = """const ENGINE_TIMEOUT_MS = 90_000;
const MAX_VM_STEPS = 180_000;
const ENGINE_DIR = path.join(__dirname, 'engine');
const ENGINE_CLI = path.join(ENGINE_DIR, 'bin', 'luraph-deobf.js');"""
new_constants = """const ENGINE_TIMEOUT_MS = 15 * 60_000;
const ENGINE_DIR = path.join(__dirname, 'luraph-v15-engine');
const ENGINE_CLI = path.join(ENGINE_DIR, 'deob.js');"""
if old_constants not in source:
    raise SystemExit("Could not find the expected legacy engine constants in index.js")
source = source.replace(old_constants, new_constants, 1)

start = source.index("function runEngine(inputPath, outDir) {")
end = source.index("\nasync function processLuraph151", start)
new_runner = r'''function runEngine(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [
      '--max-old-space-size=1024',
      ENGINE_CLI,
      inputPath,
      '-o',
      outputPath,
      '--timeout',
      '120',
    ], {
      cwd: ENGINE_DIR,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
      windowsHide: true,
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      if (stdout.length < 24_000) stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      if (stderr.length < 12_000) stderr += chunk.toString();
    });
    const timer = setTimeout(() => child.kill('SIGKILL'), ENGINE_TIMEOUT_MS);
    child.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once('close', (code, signal) => {
      clearTimeout(timer);
      if (signal === 'SIGKILL') {
        return reject(new Error('This script exceeded the 15-minute processing limit.'));
      }
      if (code !== 0) {
        const raw = (stderr || stdout).trim();
        const lines = raw.split('\n').filter(Boolean);
        const detail = lines.length > 18
          ? [...lines.slice(0, 12), '…', ...lines.slice(-6)].join('\n')
          : lines.join('\n');
        return reject(new Error(detail || ('Deobfuscator exited with code ' + code + '.')));
      }
      resolve(stdout);
    });
  });
}'''
source = source[:start] + new_runner + source[end:]

start = source.index("async function processLuraph151(message, prompt, input) {")
end = source.index("\nasync function startWorkflow", start)
new_process = r'''async function processLuraph151(message, prompt, input) {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'daily-deobf-'));
  const inputPath = path.join(tempRoot, 'input.lua');
  const outDir = path.join(tempRoot, 'output');
  const outputPath = path.join(outDir, 'deobfuscated.luau');
  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(inputPath, input.source, { encoding: 'utf8', mode: 0o600 });

  try {
    await prompt.edit({ content: 'Running the newest Luraph v15 engine…', components: [] });
    await runEngine(inputPath, outputPath);
    const data = await fs.readFile(outputPath);
    if (!data.length) throw new Error('The engine returned an empty output file.');
    if (data.length > MAX_OUTPUT_BYTES) {
      throw new Error('The deobfuscated output is larger than Discord attachment limit.');
    }

    const safeName = input.filename.replaceAll(String.fromCharCode(96), '');
    await message.reply({
      content: '**DAILY DEOBF · Luraph v15 (new engine)**\nProcessed: ' + safeName +
        '\n\nThe engine reconstructs code from VM paths it can analyze. Unsupported or protected paths may remain incomplete.',
      files: [new AttachmentBuilder(data, { name: 'deobfuscated.luau' })],
      allowedMentions: { repliedUser: false },
    });
    await prompt.edit({ content: '✅ Deobfuscation finished. The .luau output is attached above.', components: [] });
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true }).catch(() => {});
  }
}'''
source = source[:start] + new_process + source[end:]
index_path.write_text(source, encoding="utf-8")

pkg_path = root / "package.json"
pkg = json.loads(pkg_path.read_text(encoding="utf-8"))
pkg["scripts"]["check"] = "node --check index.js && node --check luraph-v15-engine/deob.js"
pkg["scripts"].pop("postinstall", None)
pkg_path.write_text(json.dumps(pkg, indent=2) + "\n", encoding="utf-8")

readme = """# DAILY DEOBF

Discord bot for analyzing Luau scripts protected by Luraph v15.

- Prefix command: .deobf
- Inputs: .lua, .luau, .txt, or a direct HTTP/HTTPS script URL
- Output: reconstructed deobfuscated.luau
- Input limit: 2 MB
- Processing limit: 15 minutes

The bot uses the newest bundled Luraph v15 engine in luraph-v15-engine/. It includes a sandboxed Luau runtime and Python analysis backend. Some protected scripts may still contain paths the engine cannot reconstruct; the engine reports those rather than guaranteeing perfect recovery.

## Railway

Deploy this repository from the main branch, set DISCORD_TOKEN, and use npm start. The runtime requires Node.js 20.11+ and Python 3.10+.
"""
(root / "README.md").write_text(readme, encoding="utf-8")
