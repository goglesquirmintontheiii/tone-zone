const { _electron: electron } = require('playwright');
const path = require('path');
const S = process.env.SHOTS || '/tmp';
(async () => {
  const app = await electron.launch({ executablePath: require('electron'), args: [path.join(__dirname, '..'), '--no-sandbox'] });
  const win = await app.firstWindow();
  const errs = [];
  win.on('pageerror', (e) => errs.push('PAGEERROR ' + e.stack));
  await win.waitForFunction(() => window.__tz && window.__tz.ready, null, { timeout: 120000 });
  await win.waitForTimeout(500);
  // import the NAM test models as one pack via the IPC path (same as the dialog)
  const info = await win.evaluate(async (files) => window.tz.lib.inspectPaths(files, 'file'), process.argv.slice(2));
  console.log('inspect items', info.items.length, info.errors);
  await win.evaluate((info) => import('./js/pages/library.js').then((m) => { m.importDialog(info); }), info);
  await win.waitForTimeout(600);
  await win.screenshot({ path: S + '/t-import.png' });
  await win.click('.modal footer .btn-accent');
  await win.waitForTimeout(1200);
  await win.click('#tabs [data-tab="library"]');
  await win.waitForTimeout(800);
  await win.screenshot({ path: S + '/t-library.png' });
  await win.click('#tabs [data-tab="settings"]');
  await win.waitForTimeout(1200);
  await win.screenshot({ path: S + '/t-settings.png' });
  await win.click('#tabs [data-tab="capture"]');
  await win.waitForTimeout(600);
  await win.screenshot({ path: S + '/t-capture.png' });
  for (const t of ['presets', 'factory', 'pi', 'plugins']) {
    await win.click(`#tabs [data-tab="${t}"]`);
    await win.waitForTimeout(1200);
    await win.screenshot({ path: S + '/t-' + t + '.png' });
  }
  // add the pack to the board
  await win.click('#tabs [data-tab="board"]');
  await win.waitForTimeout(500);
  await win.evaluate(() => { const d = window.__tz.state; });
  const id = await win.evaluate(() => import('./js/catalog/index.js').then((m) => m.getPackDefs()[0]?.id));
  await win.evaluate((id) => window.__tz.editor.addNear(id), id);
  await win.waitForTimeout(2500);
  const sel = await win.evaluate(() => [...window.__tz.state.selection][0]);
  await win.evaluate((id) => { const ed = window.__tz.editor; const b = window.__tz.state.preset.blocks.find(x=>x.id===id); const v = ed.views.get(id); const r = ed.svg.getBoundingClientRect(); ed.view.z = 1.2; ed.view.x = r.width/2 - (b.x + v.w/2) * 1.2; ed.view.y = r.height/2 - (b.y + v.h/2) * 1.2; ed.applyView(); }, sel);
  await win.waitForTimeout(800);
  await win.screenshot({ path: S + '/t-nampack.png' });
  console.log(errs.join('\n') || 'no errors');
  await app.close();
})();
