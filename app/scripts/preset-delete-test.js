// Factory preset update + delete / multi-delete / restore in the presets tab.
const { _electron: electron } = require('playwright');
const path = require('path');
const S = process.argv[2] || '/tmp';
(async () => {
  const app = await electron.launch({ executablePath: require('electron'), args: [path.join(__dirname, '..'), '--no-sandbox'] });
  const win = await app.firstWindow();
  const errs = []; win.on('pageerror', (e) => errs.push(e.message)); win.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  await win.setViewportSize({ width: 1600, height: 950 }).catch(() => {});
  await win.waitForFunction(() => window.__tz && window.__tz.ready, null, { timeout: 120000 });
  const L = () => win.evaluate(async () => window.tz.presets.list());
  let list = await L();
  const oldTags = list.filter((p) => (p.tags || []).some((t) => t === 'simple' || t === 'complex')).length;
  console.log('presets', list.length, 'with simple/complex tags', oldTags);
  await win.click('#tabs [data-tab="presets"]');
  await win.waitForTimeout(1500);
  // single delete via the hover trash button
  const card = win.locator('.preset-card').nth(2);
  const name = await card.locator('.pc-name').textContent();
  await card.hover();
  await card.locator('.pc-del').click();
  await win.waitForTimeout(300);
  await win.click('.modal footer .btn-danger, .modal footer .btn-accent');
  await win.waitForTimeout(800);
  list = await L();
  console.log('after single delete', list.length, 'still has it:', list.some((p) => p.name === name));
  // multi-select delete: ctrl-click two cards
  await win.locator('.preset-card').nth(0).click({ modifiers: ['Control'] });
  await win.locator('.preset-card').nth(1).click();
  await win.waitForTimeout(300);
  await win.screenshot({ path: S + '/presets-select.png' });
  await win.locator('.pp-selbar .btn-danger').click();
  await win.waitForTimeout(300);
  await win.click('.modal footer .btn-danger, .modal footer .btn-accent');
  await win.waitForTimeout(800);
  list = await L();
  console.log('after multi delete', list.length, 'deleted factory:', (await win.evaluate(() => window.tz.presets.deletedFactory())).length);
  // restore
  await win.locator('.page-actions .btn', { hasText: 'Restore built-in' }).click();
  await win.waitForTimeout(300);
  await win.click('.modal footer .btn-accent, .modal footer .btn-danger');
  await win.waitForTimeout(1000);
  list = await L();
  console.log('after restore', list.length);
  await win.screenshot({ path: S + '/presets-after.png' });
  console.log(errs.length ? errs.join('\n') : 'no errors');
  await app.close();
})();
