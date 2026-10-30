// Zoomed out (blocks drawn as bitmaps): pedals can still be dragged and cables connected.
const { _electron: electron } = require('playwright');
const path = require('path');
(async () => {
  const app = await electron.launch({ executablePath: require('electron'), args: [path.join(__dirname, '..'), '--no-sandbox'] });
  const win = await app.firstWindow();
  const errs = []; win.on('pageerror', (e) => errs.push(e.message));
  await win.setViewportSize({ width: 1600, height: 950 }).catch(() => {});
  await win.waitForFunction(() => window.__tz && window.__tz.ready, null, { timeout: 120000 });
  const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) errs.push(m); };
  const ids = await win.evaluate(async () => {
    const st = await import('./js/state.js');
    st.loadPreset(st.newPreset('lod'), null);
    const E = window.__tz.editor;
    const a = st.addBlock('ib.ts9', 300, 200), b = st.addBlock('bx.ds1', 800, 200);
    E.rebuild(); E.view = { x: 100, y: 100, z: 0.4 }; E.applyView();
    return { a: a.id, b: b.id };
  });
  await win.waitForFunction(() => [...window.__tz.editor.views.values()].filter((v) => v.lodOn).length >= 2, null, { timeout: 20000 });
  const scr = (id, fx, fy) => win.evaluate(({ id, fx, fy }) => { const E = window.__tz.editor, v = E.views.get(id), r = E.board.getBoundingClientRect(); return { x: r.left + E.view.x + (v.block.x + v.w * fx) * E.view.z, y: r.top + E.view.y + (v.block.y + v.h * fy) * E.view.z }; }, { id, fx, fy });
  // drag the TS9 by its middle
  const p = await scr(ids.a, 0.5, 0.6);
  const x0 = await win.evaluate((id) => window.__tz.state.preset.blocks.find((b) => b.id === id).x, ids.a);
  await win.mouse.move(p.x, p.y); await win.mouse.down(); await win.mouse.move(p.x + 40, p.y + 20, { steps: 8 }); await win.mouse.up();
  await win.waitForTimeout(200);
  const x1 = await win.evaluate((id) => window.__tz.state.preset.blocks.find((b) => b.id === id).x, ids.a);
  ok(Math.abs(x1 - x0 - 100) < 15, `pedal dragged while zoomed out (${x1 - x0})`);
  // cable from the DS-1 output (left side) to the TS9 input (right side)
  const jp = (id, key) => win.evaluate(({ id, key }) => { const E = window.__tz.editor, v = E.views.get(id), j = v.jack(key), r = E.board.getBoundingClientRect(); return { x: r.left + E.view.x + (v.block.x + j.x) * E.view.z, y: r.top + E.view.y + (v.block.y + j.y) * E.view.z }; }, { id, key });
  const o = await jp(ids.b, 'o0'), i = await jp(ids.a, 'i0');
  await win.mouse.move(o.x, o.y); await win.mouse.down(); await win.mouse.move(i.x, i.y, { steps: 12 }); await win.mouse.up();
  await win.waitForTimeout(200);
  const n = await win.evaluate(() => window.__tz.state.preset.cables.length);
  ok(n === 1, `cable connected while zoomed out (${n})`);
  // a click on empty board clears the selection
  await win.mouse.click(1200, 800);
  ok(await win.evaluate(() => window.__tz.state.selection.size === 0), 'selection cleared');
  console.log(errs.length ? errs.join('\n') : 'no errors');
  await app.close();
})();
