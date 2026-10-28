// Interaction test for the parametric EQ screen: drag a band, wheel Q, toggle listen, click PRE/POST.
const { _electron: electron } = require('playwright');
const path = require('path');
(async () => {
  const S = process.argv[2];
  const app = await electron.launch({ executablePath: require('electron'), args: [path.join(__dirname, '..'), '--no-sandbox'] });
  const win = await app.firstWindow();
  const errs = [];
  win.on('pageerror', (e) => errs.push(e.stack));
  await win.setViewportSize({ width: 1600, height: 950 }).catch(() => {});
  await win.waitForTimeout(3000);
  const id = await win.evaluate(async () => {
    const st = await import('./js/state.js');
    st.loadPreset(st.newPreset('eq'), null);
    const b = st.addBlock('tz.paraeq', 0, 0);
    st.connect({ node: '__in', port: 0 }, { node: b.id, port: 0 });
    st.connect({ node: b.id, port: 0 }, { node: '__out', port: 0 });
    const T = window.__tz, v = T.editor.views.get(b.id), r = T.editor.svg.getBoundingClientRect();
    T.editor.view = { z: 1.8, x: r.width / 2 - (v.w / 2) * 1.8, y: r.height / 2 - (v.h / 2) * 1.8 };
    T.editor.applyView();
    return b.id;
  });
  await win.waitForTimeout(500);
  const p = (k) => win.evaluate(([id, k]) => window.__tz.state.preset.blocks.find((b) => b.id === id).params[k], [id, k]);
  // find band 3 handle on screen
  const h3 = await win.evaluate((id) => { const v = window.__tz.editor.views.get(id); const s = v.screens[0]; const r = s.handles[2].dot.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, id);
  const f0 = await p('b3f'), g0 = await p('b3g');
  await win.mouse.move(h3.x, h3.y); await win.mouse.down(); await win.mouse.move(h3.x + 60, h3.y - 40, { steps: 8 }); await win.mouse.up();
  console.log('band3 f', f0, '->', await p('b3f'), ' g', g0, '->', await p('b3g'));
  const h3b = await win.evaluate((id) => { const s = window.__tz.editor.views.get(id).screens[0]; const r = s.handles[2].dot.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, id);
  const q0 = await p('b3q'); await win.mouse.move(h3b.x, h3b.y); await win.mouse.wheel(0, -200); await win.waitForTimeout(200);
  console.log('band3 q', q0, '->', await p('b3q'));
  // LISTEN footswitch
  const lf = await win.evaluate((id) => { const v = window.__tz.editor.views.get(id); const e = [...v.views.values()].find((x) => x.ctl.p === 'listen' && x.ctl.t === 'foot'); const r = e.view.g.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, id);
  await win.mouse.click(lf.x, lf.y);
  await win.waitForTimeout(300);
  console.log('listen', await p('listen'));
  await win.screenshot({ path: S + '/eq-listen.png' });
  console.log(errs.join('\n') || 'no errors');
  await app.close();
})();
