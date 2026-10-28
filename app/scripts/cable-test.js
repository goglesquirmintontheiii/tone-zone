const { _electron: electron } = require('playwright');
const path = require('path');
const S = process.env.SHOTS || '/tmp';
(async () => {
  const app = await electron.launch({ executablePath: require('electron'), args: [path.join(__dirname, '..'), '--no-sandbox'] });
  const win = await app.firstWindow();
  const errs = [];
  win.on('pageerror', (e) => errs.push('PAGEERROR ' + e.stack));
  await win.waitForTimeout(2500);
  await win.evaluate(() => import('./js/state.js').then((m) => { const p = m.newPreset('Cable test'); p.blocks[0].x = 500; p.blocks[0].y = 100; p.blocks[1].x = -200; p.blocks[1].y = 100; m.loadPreset(p, null); }));
  await win.waitForTimeout(500);
  const id = await win.evaluate(() => window.__tz.editor.addAt('bx.ds1', 250, 230, true).id);
  await win.evaluate(() => window.__tz.editor.fit(false));
  await win.waitForTimeout(600);
  const drag = async (a, b) => {
    const ab = await (await win.$(a)).boundingBox(), bb = await (await win.$(b)).boundingBox();
    await win.mouse.move(ab.x + ab.width / 2, ab.y + ab.height / 2);
    await win.mouse.down();
    await win.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2, { steps: 15 });
    await win.mouse.up();
    await win.waitForTimeout(300);
  };
  await drag('[data-node="__in"] [data-jack="o0"]', `[data-node="${id}"] [data-jack="i0"]`);
  await drag(`[data-node="${id}"] [data-jack="o0"]`, '[data-node="__out"] [data-jack="i0"]');
  await drag(`[data-node="${id}"] [data-jack="o0"]`, '[data-node="__out"] [data-jack="i1"]');
  console.log('cables', await win.evaluate(() => JSON.stringify(window.__tz.state.preset.cables.map((c) => c.from.node + ':' + c.from.port + '->' + c.to.node + ':' + c.to.port))));
  await win.waitForTimeout(800);
  await win.screenshot({ path: S + '/cable.png' });
  // unplug by dragging the DS-1 input plug away
  await drag(`[data-node="${id}"] [data-jack="i0"]`, '#boardToolbar');
  console.log('after unplug', await win.evaluate(() => window.__tz.state.preset.cables.length));
  console.log(errs.join('\n') || 'no errors');
  await app.close();
})();
