// Plugins tab: cards, detail panel, sandbox knob turn, remove + restore a built-in plugin. usage: node plugins-page-test.js out-dir
const { _electron: electron } = require('playwright');
const path = require('path');
const S = process.argv[2] || '/tmp';
(async () => {
  const app = await electron.launch({ executablePath: require('electron'), args: [path.join(__dirname, '..'), '--no-sandbox'] });
  const win = await app.firstWindow();
  const errs = []; win.on('pageerror', (e) => errs.push(e.message));
  await win.setViewportSize({ width: 1600, height: 950 }).catch(() => {});
  await win.waitForFunction(() => window.__tz && window.__tz.ready, null, { timeout: 120000 });
  await win.click('#tabs [data-tab="plugins"]');
  await win.waitForTimeout(5000);
  console.log('cards', await win.locator('.plugin-card').count());
  await win.screenshot({ path: S + '/plugins-grid.png' });
  await win.locator('.plugin-card', { hasText: 'Chase Bliss' }).first().click();
  await win.waitForTimeout(2500);
  await win.screenshot({ path: S + '/plugins-detail.png' });
  console.log('blocks in detail', await win.locator('.pd-block').count());
  await win.locator('.pd-block').nth(0).click();
  await win.waitForTimeout(1200);
  // turn the first knob up
  const knob = win.locator('.sb-svg .ctl.knob').first();
  const kb = await knob.boundingBox();
  await win.mouse.move(kb.x + kb.width / 2, kb.y + kb.height / 2); await win.mouse.down(); await win.mouse.move(kb.x + kb.width / 2, kb.y - 60, { steps: 6 }); await win.mouse.up();
  await win.waitForTimeout(300);
  await win.screenshot({ path: S + '/plugins-sandbox.png' });
  await win.keyboard.press('Escape'); await win.waitForTimeout(200); await win.keyboard.press('Escape'); await win.waitForTimeout(300);
  // remove a built-in plugin, then restore it
  const before = await win.evaluate(() => [...window.__tz ? [] : []].length);
  await win.locator('.plugin-card', { hasText: 'Dwarfcraft' }).first().click();
  await win.waitForTimeout(600);
  await win.locator('.pd-acts .btn-danger').click();
  await win.waitForTimeout(300);
  await win.click('.modal footer .btn-danger, .modal footer .btn-accent');
  await win.waitForTimeout(3000);
  const gone = await win.locator('.plugin-card', { hasText: 'Dwarfcraft' }).count();
  const hasDef = await win.evaluate(async () => !!(await import('./js/catalog/index.js')).getDef('dwc.destroyer')?.plugin);
  console.log('after remove: card', gone, 'def loaded', hasDef);
  await win.locator('.page-actions .btn', { hasText: 'Restore removed' }).click();
  await win.waitForTimeout(300);
  await win.click('.modal footer .btn-accent, .modal footer .btn-danger');
  await win.waitForTimeout(3000);
  console.log('after restore: card', await win.locator('.plugin-card', { hasText: 'Dwarfcraft' }).count());
  console.log(errs.length ? errs.join('\n') : 'no errors');
  await app.close();
})();
