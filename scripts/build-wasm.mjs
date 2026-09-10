import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { delimiter, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const binary = (name) => (process.platform === 'win32' ? `${name}.exe` : name);

// Reuse a compatible installed tool, including wasm-pack's existing cache.
// Do not open cache lock files: a preprovisioned cache may be read-only.
function findBindgen(version) {
  const candidates = process.env.WASM_BINDGEN_PATH
    ? [resolve(process.env.WASM_BINDGEN_PATH)]
    : (process.env.PATH ?? '').split(delimiter).map((dir) => join(dir, binary('wasm-bindgen')));
  if (!process.env.WASM_BINDGEN_PATH) {
    const cacheRoots = [
      join(process.env.XDG_CACHE_HOME || join(homedir(), '.cache'), '.wasm-pack'),
      join(homedir(), 'Library', 'Caches', '.wasm-pack'),
      ...(process.env.LOCALAPPDATA ? [join(process.env.LOCALAPPDATA, '.wasm-pack')] : []),
    ];
    for (const cache of cacheRoots) {
      if (!existsSync(cache)) continue;
      for (const entry of readdirSync(cache).sort()) {
        if (entry.startsWith('wasm-bindgen-'))
          candidates.push(join(cache, entry, binary('wasm-bindgen')));
      }
    }
  }
  for (const candidate of candidates) {
    if (!existsSync(candidate)) continue;
    const result = spawnSync(candidate, ['--version'], { encoding: 'utf8' });
    if (result.status === 0 && result.stdout.trim() === `wasm-bindgen ${version}`) return candidate;
  }
  if (process.env.WASM_BINDGEN_PATH)
    throw new Error(`WASM_BINDGEN_PATH must point to wasm-bindgen ${version}`);
  return null;
}

function main() {
  const lock = readFileSync(join(root, 'dsp/Cargo.lock'), 'utf8');
  const version = lock.match(/name = "wasm-bindgen"\r?\nversion = "([^"]+)"/)?.[1];
  if (!version) throw new Error('Cannot find wasm-bindgen version in dsp/Cargo.lock');
  const bindgen = findBindgen(version);
  const staging = mkdtempSync(join(tmpdir(), 'cords-box-wasm-'));
  try {
    const args = ['build', 'dsp/', '--target', 'web', '--out-dir', staging];
    const env = { ...process.env };
    if (bindgen) {
      args.push('--mode', 'no-install');
      env.PATH = `${dirname(bindgen)}${delimiter}${env.PATH ?? ''}`;
      const cache = dirname(dirname(bindgen));
      for (const entry of readdirSync(cache).sort()) {
        if (!entry.startsWith('wasm-opt-')) continue;
        const toolDir = join(cache, entry, 'bin');
        if (existsSync(join(toolDir, binary('wasm-opt'))))
          env.PATH = `${env.PATH}${delimiter}${toolDir}`;
      }
      console.log(`Using ${bindgen} (${version})`);
    }
    // Cargo.lock is the source of truth; never update dependencies during a build.
    args.push('--', '--locked');
    const result = spawnSync(process.env.WASM_PACK_BIN || 'wasm-pack', args, {
      cwd: root,
      env,
      stdio: 'inherit',
    });
    if (result.error) throw result.error;
    if (result.status !== 0)
      throw new Error(`wasm-pack failed (${result.status ?? result.signal})`);
    for (const name of ['dsp.js', 'dsp_bg.wasm', 'dsp.d.ts', 'package.json']) {
      if (!existsSync(join(staging, name))) throw new Error(`Missing generated artifact: ${name}`);
    }
    // Packaging failures must not delete the checked-in, last working package.
    cpSync(staging, join(root, 'src/audio/wasm-pkg'), { recursive: true });
  } finally {
    rmSync(staging, { recursive: true, force: true });
  }
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
