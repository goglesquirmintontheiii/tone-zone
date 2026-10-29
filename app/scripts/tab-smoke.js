// Click every top-bar tab and report errors.
const { _electron: electron } = require('playwright');
const path = require('path');
(async () => {
  const app = await electron.launch({ executablePath: require('electron'), args: [path.join(__dirname, '..'), '--no-sandbox'] });
  const win = await app.firstWindow();
  const errs = []; win.on('pageerror', (e) => errs.push(e.message)); win.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  await win.setViewportSize({ width: 1600, height: 950 }).catch(() => {});
  await win.waitForFunction(() => window.__tz && window.__tz.ready, null, { timeout: 120000 });
  const tabs = await win.evaluate(() => [...document.querySelectorAll('#tabs [data-tab]')].map((b) => b.dataset.tab));
  console.log('tabs', tabs.join(' '));
  for (const t of tabs) { await win.click(`#tabs [data-tab="${t}"]`); await win.waitForTimeout(1200); }
  // tabs that build their page on first open
  if (!tabs.includes('factory')) errs.push('factory tab missing');
  else if (!(await win.evaluate(() => !!document.querySelector('#view-factory .fz-stage [data-body]')))) errs.push('factory tab did not render a pedal');
  await win.click('#tabs [data-tab="board"]');
  console.log(errs.length ? errs.join('\n') : 'no errors');
  await app.close();
})();
