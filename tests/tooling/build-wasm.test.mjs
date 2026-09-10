import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));

test('failed WASM packaging preserves the existing production package', () => {
  const files = ['package.json', 'dsp.js', 'dsp_bg.wasm', 'dsp.d.ts'];
  const before = files.map((file) => readFileSync(`${root}src/audio/wasm-pkg/${file}`));
  const result = spawnSync(process.execPath, ['scripts/build-wasm.mjs'], {
    cwd: root,
    env: { ...process.env, WASM_PACK_BIN: process.execPath },
    encoding: 'utf8',
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /wasm-pack failed/);
  for (const [index, file] of files.entries()) {
    assert.deepEqual(readFileSync(`${root}src/audio/wasm-pkg/${file}`), before[index]);
  }
});

test('explicit incompatible bindgen is rejected before packaging', () => {
  const result = spawnSync(process.execPath, ['scripts/build-wasm.mjs'], {
    cwd: root,
    env: { ...process.env, WASM_BINDGEN_PATH: process.execPath },
    encoding: 'utf8',
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /WASM_BINDGEN_PATH must point to wasm-bindgen/);
});
