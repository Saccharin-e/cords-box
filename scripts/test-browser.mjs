import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { build, createServer, preview } from 'vite';
import puppeteer from 'puppeteer';

const artifacts = resolve('artifacts/browser');
await mkdir(artifacts, { recursive: true });
const report = {
  timestamp: new Date().toISOString(),
  node: process.version,
  results: [],
  errors: [],
};
let server;
let browser;
let previewServer;
try {
  report.commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  report.dirty = !!execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim();
  report.wasmSha256 = createHash('sha256')
    .update(await readFile('src/audio/wasm-pkg/dsp_bg.wasm'))
    .digest('hex');
  server = await createServer({ server: { host: '127.0.0.1', port: 0, open: false } });
  await server.listen();
  browser = await puppeteer.launch({
    headless: true,
    args: process.env.BROWSER_NO_SANDBOX === '1' ? ['--no-sandbox'] : [],
  });
  report.browser = await browser.version();
  const page = await browser.newPage();
  page.setDefaultTimeout(20000);
  page.on('pageerror', (error) => report.errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') report.errors.push(message.text());
  });
  page.on('requestfailed', (request) =>
    report.errors.push(`${request.url()}: ${request.failure()?.errorText}`),
  );
  async function runAt(baseUrl, mode) {
    await page.goto(`${baseUrl}tests/browser/audio.html`);
    await page.waitForFunction(() => typeof window.runAudioAcceptance === 'function');
    const results = await page.evaluate(async () => {
      let timeout;
      try {
        return await Promise.race([
          window.runAudioAcceptance(),
          new Promise((_, reject) => {
            timeout = setTimeout(() => reject(new Error('Audio acceptance timed out')), 45000);
          }),
        ]);
      } finally {
        clearTimeout(timeout);
      }
    });
    for (const result of results) {
      if (result.samples) {
        const pcm = Float32Array.from(result.samples);
        await writeFile(
          resolve(artifacts, `${mode}-${result.kind}-${result.sampleRate}.f32`),
          Buffer.from(pcm.buffer),
        );
        delete result.samples;
      }
      report.results.push({ mode, ...result });
    }
  }
  await runAt(server.resolvedUrls.local[0], 'development');
  const outDir = resolve(artifacts, 'site');
  await build({
    build: {
      outDir,
      emptyOutDir: true,
      rolldownOptions: { input: resolve('tests/browser/audio.html') },
    },
  });
  previewServer = await preview({
    build: { outDir },
    preview: { host: '127.0.0.1', port: 0, open: false },
  });
  await runAt(previewServer.resolvedUrls.local[0], 'production');
  if (report.errors.length) throw new Error(report.errors.join('\n'));
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  report.errors.push(error.stack || error.message);
  console.error(error);
  process.exitCode = 1;
} finally {
  await writeFile(resolve(artifacts, 'report.json'), JSON.stringify(report, null, 2));
  await browser?.close();
  if (previewServer)
    await new Promise((resolve, reject) =>
      previewServer.httpServer.close((error) => (error ? reject(error) : resolve())),
    );
  await server?.close();
}
