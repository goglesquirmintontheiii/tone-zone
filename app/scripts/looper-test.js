const { _electron: electron } = require('playwright');
const path = require('path');
const S = process.env.SHOTS || '/tmp';
(async () => {
  const app = await electron.launch({ executablePath: require('electron'), args: [path.join(__dirname, '..'), '--no-sandbox'] });
  const win = await app.firstWindow();
  const errs = [];
  win.on('pageerror', (e) => errs.push('PAGEERROR ' + e.stack));
  await win.waitForTimeout(2500);
  await win.evaluate(() => import('./js/presets.js').then((m) => m.openPreset('06-looper-jam.json')));
  await win.waitForTimeout(1500);
  const id = await win.evaluate(() => window.__tz.state.preset.blocks.find((b) => b.type === 'bx.rc500').id);
  const tu = await win.evaluate(() => window.__tz.state.preset.blocks.find((b) => b.type === 'bx.tu3')?.id);
  const zoom = (bid, z) => win.evaluate(([bid, z]) => { const ed = window.__tz.editor; const b = window.__tz.state.preset.blocks.find(x=>x.id===bid); const v = ed.views.get(bid); const r = ed.svg.getBoundingClientRect(); ed.view.z = z; ed.view.x = r.width/2 - (b.x + v.w/2) * z; ed.view.y = r.height/2 - (b.y + v.h/2) * z; ed.applyView(); }, [bid, z]);
  await zoom(id, 1.9);
  await win.waitForTimeout(300);
  const foots = await win.$$(`[data-node="${id}"] .foot-wrap`);
  const fb = await foots[0].boundingBox();
  const press = async (b) => { await win.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await win.mouse.down(); await win.waitForTimeout(80); await win.mouse.up(); };
  await press(fb);           // record
  await win.waitForTimeout(2200);
  await win.screenshot({ path: S + '/lp-rec.png' });
  await press(fb);           // -> overdub
  await win.waitForTimeout(700);
  await press(fb);           // -> play
  await win.waitForTimeout(1500);
  await win.screenshot({ path: S + '/lp-play.png' });
  const st = await win.evaluate((id) => JSON.stringify(window.__tz.state.status.blocks[id]), id);
  console.log('looper status', st);
  // tap the DD-8 three times in tempo mode is hold; just check delay LED
  console.log(errs.join('\n') || 'no errors');
  await app.close();
})();
