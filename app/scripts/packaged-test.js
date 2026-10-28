const { _electron: electron } = require('playwright');
const path = require('path');
(async () => {
  const app = await electron.launch({ executablePath: path.join(__dirname, '..', 'dist', 'linux-unpacked', 'tone-zone'), args: ['--no-sandbox'] });
  const win = await app.firstWindow();
  const errs = [];
  win.on('pageerror', (e) => errs.push('PAGEERROR ' + e.stack));
  await win.waitForTimeout(5000);
  const info = await win.evaluate(async () => ({ preset: window.__tz.state.preset.name, running: window.__tz.state.status.running, load: window.__tz.state.status.load, engine: await window.tz.engine.info(), presets: (await window.tz.presets.list()).length }));
  console.log(JSON.stringify(info));
  await win.screenshot({ path: process.argv[2] });
  console.log(errs.join('\n') || 'no errors');
  await app.close();
})();
