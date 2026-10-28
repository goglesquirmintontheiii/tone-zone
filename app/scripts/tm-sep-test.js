// Tone Match: AI separation + track panel test. Needs TZ data dir with ai/venv (point it at a test venv) and
// TZ_SEPARATE_TEST_RANDOM=1 to use an untrained model. usage: node scripts/tm-sep-test.js outdir wav
const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');
(async () => {
  const out = process.argv[2] || '/tmp/tmsep';
  const wav = process.argv[3];
  fs.mkdirSync(out, { recursive: true });
  const app = await electron.launch({ executablePath: require('electron'), args: [path.join(__dirname, '..'), '--no-sandbox'], env: { ...process.env } });
  const win = await app.firstWindow();
  const logs = [];
  win.on('console', (m) => m.type() === 'error' && logs.push(m.type() + ': ' + m.text()));
  win.on('pageerror', (e) => logs.push('PAGEERROR: ' + e.stack));
  await win.setViewportSize({ width: 1600, height: 950 }).catch(() => {});
  await win.waitForFunction(() => window.__tz && window.__tz.ready, null, { timeout: 90000 });
  console.log('ai status', JSON.stringify(await win.evaluate(() => window.tz.tm.aiStatus())));
  await win.evaluate(() => document.querySelector('[data-tab="tonematch"]').click());
  await win.waitForTimeout(800);
  await win.evaluate(async (p) => {
    const m = await window.tz.tm.importPath(p);
    m.title = 'Separation test';
    await window.tz.tm.save(m);
    const mod = await import('./js/pages/tonematch.js');
    await mod.afterImport(m);
  }, wav);
  await win.waitForTimeout(2500);
  await win.evaluate(() => [...document.querySelectorAll('.tm-card .btn')].find((b) => /Separate/.test(b.textContent)).click());
  await win.waitForTimeout(4000);
  await win.evaluate(() => document.querySelector('[data-role="iso"]').scrollIntoView());
  await win.screenshot({ path: out + '/sep-running.png' });
  await win.waitForFunction(() => !document.querySelector('[data-bar="sepBusy"]'), null, { timeout: 600000 });
  await win.waitForTimeout(2500);
  const tracks = await win.evaluate(() => [...document.querySelectorAll('.tm-track b')].map((b) => b.textContent));
  console.log('tracks', tracks.join(', '));
  // listen to two tracks, solo one
  await win.evaluate(() => {
    const rows = [...document.querySelectorAll('.tm-track')];
    rows[2].querySelector('.tm-ear').click();
  });
  await win.waitForTimeout(300);
  await win.evaluate(() => document.querySelector('[data-role="tracks"]').scrollIntoView());
  await win.screenshot({ path: out + '/sep-tracks.png' });
  // quick split too
  await win.evaluate(() => [...document.querySelectorAll('.tm-card .btn')].find((b) => /Quick stereo split/.test(b.textContent)).click());
  await win.waitForTimeout(2500);
  console.log('tracks after quick split', await win.evaluate(() => [...document.querySelectorAll('.tm-track b')].map((b) => b.textContent).join(', ')));
  // play / pause
  await win.evaluate(() => [...document.querySelectorAll('.tm-transport .btn')][0].click());
  await win.waitForTimeout(1200);
  console.log('playing', await win.evaluate(() => document.querySelector('.tm-clock').textContent));
  await win.evaluate(() => [...document.querySelectorAll('.tm-transport .btn')][0].click());
  console.log(logs.join('\n'));
  await app.close();
})();
