const { _electron: electron } = require('playwright');
const path = require('path');
(async () => {
  const app = await electron.launch({ executablePath: path.join(__dirname, '..', 'dist', 'linux-unpacked', 'tone-zone'), args: ['--no-sandbox'] });
  const win = await app.firstWindow();
  const errs = [];
  win.on('pageerror', (e) => errs.push('PAGEERROR ' + e.stack));
  await win.waitForFunction(() => window.__tz && window.__tz.ready, null, { timeout: 90000 });
  await win.waitForTimeout(1500);
  const info = await win.evaluate(async () => ({ preset: window.__tz.state.preset.name, running: window.__tz.state.status.running, load: window.__tz.state.status.load, engine: await window.tz.engine.info(), presets: (await window.tz.presets.list()).length, plugins: (await window.tz.plugins.list()).filter((p) => p.enabled && !p.error).length, blocks: (await import('./js/catalog/index.js')).allDefs().length, render: await window.tz.offline.render(window.__tz.buildGraph(window.__tz.state.preset), null).then((p) => window.tz.offline.features([p], 0, Infinity)).then((f) => f && f.level).catch((e) => String(e)) }));
  console.log(JSON.stringify(info));
  await win.screenshot({ path: process.argv[2] });
  console.log(errs.join('\n') || 'no errors');
  await app.close();
})();
