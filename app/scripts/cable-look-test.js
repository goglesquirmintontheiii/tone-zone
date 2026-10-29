// Board with 1/4", XLR and headphone cables + a cable being dragged from an XLR jack. usage: node cable-look-test.js out-dir
const { _electron: electron } = require('playwright');
const path = require('path');
const S = process.argv[2] || '/tmp';
(async () => {
  const app = await electron.launch({ executablePath: require('electron'), args: [path.join(__dirname, '..'), '--no-sandbox'] });
  const win = await app.firstWindow();
  const errs = []; win.on('pageerror', (e) => errs.push(e.message));
  await win.setViewportSize({ width: 1600, height: 950 }).catch(() => {});
  await win.waitForFunction(() => window.__tz && window.__tz.ready, null, { timeout: 120000 });
  await win.evaluate(async () => {
    const st = await import('./js/state.js');
    st.loadPreset(st.newPreset('cables'), null);
    const T = window.__tz;
    const di = st.addBlock('tz.di', 900, 160);
    const hp = st.addBlock('tz.hpamp', 600, 400);
    const ts = st.addBlock('ib.ts9', 1200, 160);
    const p = st.state.preset;
    const add = (fn, fp, tn, tp) => p.cables.push({ id: 'c' + Math.random(), from: { node: fn, port: fp }, to: { node: tn, port: tp }, color: '#e8473d' });
    add('__in', 0, ts.id, 0); add(ts.id, 0, di.id, 0); add(di.id, 0, '__out', 5); add(di.id, 1, hp.id, 0); add(hp.id, 0, '__out', 4);
    p.cables[2].color = '#3f8cff'; p.cables[4].color = '#b18cff';
    T.editor.rebuild(); T.editor.fit(false);
  });
  await win.waitForTimeout(800);
  await win.screenshot({ path: S + '/cables.png' });
  // close-up of the Audio Out panel (all plug kinds)
  await win.evaluate(() => { const E = window.__tz.editor; const v = E.views.get('__out'); const r = E.board.getBoundingClientRect(); const z = 2.2; E.view = { z, x: r.width / 2 - (v.block.x + v.w + 20) * z, y: r.height / 2 - (v.block.y + v.h * 0.6) * z }; E.applyView(); });
  await win.waitForTimeout(400);
  await win.screenshot({ path: S + '/cables-zoom.png' });
  await win.evaluate(() => { const E = window.__tz.editor; const v = E.views.get('__in'); const r = E.board.getBoundingClientRect(); const z = 2.2; E.view = { z, x: r.width / 2 - (v.block.x - 60) * z, y: r.height / 2 - (v.block.y + v.h * 0.6) * z }; E.applyView(); });
  await win.waitForTimeout(400);
  // start dragging from the XLR IN 1 jack of Audio In and hold mid-air
  const box = await win.evaluate(() => { const j = document.querySelector('[data-node="__in"] [data-jack="o4"]'); const r = j.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await win.mouse.move(box.x, box.y); await win.mouse.down(); await win.mouse.move(box.x - 160, box.y + 90, { steps: 8 });
  await win.waitForTimeout(200);
  await win.screenshot({ path: S + '/cable-drag.png' });
  await win.mouse.up();
  console.log(errs.length ? errs.join('\n') : 'no errors');
  await app.close();
})();
