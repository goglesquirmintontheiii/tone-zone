// I/O panel regression test: opening Audio In must not loop port requests; + opens the picker; settings routing too.
const { _electron: electron } = require('playwright');
const path = require('path');
(async () => {
  const app = await electron.launch({ executablePath: require('electron'), args: [path.join(__dirname, '..'), '--no-sandbox'] });
  const win = await app.firstWindow();
  const errs = [];
  win.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
  await win.setViewportSize({ width: 1600, height: 950 }).catch(() => {});
  await win.waitForFunction(() => window.__tz && window.__tz.ready, null, { timeout: 90000 });
  await win.evaluate(async () => {
    const { bus } = await import('./js/util.js');
    window.__portsN = 0;
    bus.on('ports', () => window.__portsN++);
    window.__tz.editor.select(['__in']);
  });
  await win.waitForTimeout(3000);
  console.log('ports events in 3 s with Audio In open:', await win.evaluate(() => window.__portsN));
  const plus = await win.$('#inspector .port-add');
  console.log('plus button', !!plus);
  if (plus) { await plus.evaluate((b) => b.click()); await win.waitForTimeout(300); console.log('picker open', !!(await win.$('.port-picker'))); await win.screenshot({ path: process.argv[2] + '/io-picker.png' }); await win.mouse.click(5, 900); }
  await win.evaluate(() => document.querySelector('[data-tab="settings"]').click());
  await win.waitForTimeout(1500);
  const p2 = await win.$('#portsBox .port-add');
  if (p2) { await p2.evaluate((b) => b.click()); await win.waitForTimeout(300); console.log('settings picker open', !!(await win.$('.port-picker'))); }
  console.log('ports events total:', await win.evaluate(() => window.__portsN));
  console.log(errs.join('\n') || 'no errors');
  await app.close();
})();
