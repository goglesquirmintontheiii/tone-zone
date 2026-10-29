// Male coupler snapping: drag a pedal near each open end, check direct links + audio graph; female coupler look.
const { _electron: electron } = require('playwright');
const path = require('path');
const S = process.argv[2] || '/tmp';
(async () => {
  const app = await electron.launch({ executablePath: require('electron'), args: [path.join(__dirname, '..'), '--no-sandbox'] });
  const win = await app.firstWindow();
  const errs = []; win.on('pageerror', (e) => errs.push(e.message)); win.on('console', (m) => m.type() === 'error' && !/plugin /.test(m.text()) && errs.push(m.text()));
  await win.setViewportSize({ width: 1600, height: 950 }).catch(() => {});
  await win.waitForFunction(() => window.__tz && window.__tz.ready, null, { timeout: 120000 });
  const ids = await win.evaluate(async () => {
    const st = await import('./js/state.js');
    st.loadPreset(st.newPreset('couple'), null);
    const E = window.__tz.editor;
    const a = st.addBlock('ib.ts9', 600, 200), c = st.addBlock('tz.dmale', 420, 290), b = st.addBlock('bx.ds1', 150, 200), f = st.addBlock('tz.dfemale', 400, 500);
    E.rebuild(); E.view = { x: 80, y: 40, z: 1.4 }; E.applyView();
    return { a: a.id, b: b.id, c: c.id, f: f.id };
  });
  await win.waitForTimeout(500);
  const drag = async (id, dx, dy) => {
    const r = await win.evaluate((id) => {
      const g = document.querySelector(`[data-node="${id}"]`).getBoundingClientRect();
      for (let fy = 0.3; fy < 0.95; fy += 0.04) for (let fx = 0.08; fx < 0.95; fx += 0.06) {
        const x = g.x + g.width * fx, y = g.y + g.height * fy, e = document.elementFromPoint(x, y);
        if (e && e.closest('[data-node]')?.dataset.node === id && !e.closest('[data-ctl]') && !e.closest('[data-jack]')) return { x, y };
      }
      return { x: g.x + 4, y: g.y + g.height / 2 };
    }, id);
    console.log('grab', id, JSON.stringify(r), await win.evaluate(({ x, y }) => { const e = document.elementFromPoint(x, y); return e ? e.tagName + ' ' + (e.closest('[data-node]')?.dataset.node || '-') + ' ' + (e.closest('[data-ctl]') ? 'CTL' : '') : 'none'; }, r));
    await win.mouse.move(r.x, r.y); await win.mouse.down(); await win.mouse.move(r.x + dx, r.y + dy, { steps: 10 }); await win.mouse.up(); await win.waitForTimeout(300);
  };
  // move the TS9 so its output jack (left side) lands near the coupler's right (input) end
  const near = await win.evaluate(({ a, c }) => {
    const E = window.__tz.editor, va = E.views.get(a), vc = E.views.get(c);
    const jo = va.jack('o0'), ce = vc.jack('i0');
    const z = E.view.z;
    return { dx: ((vc.block.x + ce.x + 6 + 9) - (va.block.x + jo.x)) * z, dy: ((vc.block.y + ce.y + 7) - (va.block.y + jo.y)) * z };
  }, ids);
  await drag(ids.a, near.dx, near.dy);
  // and the DS-1's input jack (right side) near the coupler's left (output) end
  const near2 = await win.evaluate(({ b, c }) => {
    const E = window.__tz.editor, vb = E.views.get(b), vc = E.views.get(c);
    const ji = vb.jack('i0'), ce = vc.jack('o0');
    const z = E.view.z;
    return { dx: ((vc.block.x + ce.x - 6 - 10) - (vb.block.x + ji.x)) * z, dy: ((vc.block.y + ce.y - 9) - (vb.block.y + ji.y)) * z };
  }, ids);
  await drag(ids.b, near2.dx, near2.dy);
  const res = await win.evaluate(({ a, b, c }) => {
    const p = window.__tz.state.preset;
    const direct = p.cables.filter((x) => x.direct).map((x) => `${x.from.node}->${x.to.node}`);
    const g = window.__tz.buildGraph(p);
    return { direct, graphCables: g.cables.filter((x) => [a, b, c].includes(x.from.node)).length };
  }, ids);
  console.log('direct links', JSON.stringify(res));
  console.log('dbg', JSON.stringify(await win.evaluate(({ a, b, c }) => { const E = window.__tz.editor; const pos = (i) => { const v = E.views.get(i); return [v.block.x, v.block.y, v.w, v.h, v.jacks.map((j) => j.key + '@' + j.x + ',' + j.y + ',' + j.side + (j.male ? 'M' : ''))]; }; return { a: pos(a), b: pos(b), c: pos(c), pairs: E.couplePairs(new Set()).map((p) => [p.e.j.key, p.k.v.block.type, p.k.j.key, Math.round(p.dx), Math.round(p.dy)]) }; }, ids)));
  await win.evaluate(() => { const E = window.__tz.editor; E.view = { x: -300, y: -150, z: 2.6 }; E.applyView(); });
  await win.waitForTimeout(300);
  await win.screenshot({ path: S + '/coupler-linked.png' });
  // pull the DS-1 away: link should break
  await win.evaluate(() => { const E = window.__tz.editor; E.view = { x: 80, y: 40, z: 1.4 }; E.applyView(); });
  await drag(ids.b, -200, 0);
  console.log('after pulling apart', await win.evaluate(() => window.__tz.state.preset.cables.filter((x) => x.direct).length));
  // recolour the female coupler
  await win.evaluate(async (f) => { (await import('./js/state.js')).setParam(f, 'jacket', '#e8473d'); }, ids.f);
  await win.evaluate(() => { const E = window.__tz.editor; E.view = { x: -300, y: -150, z: 2.6 }; E.applyView(); });
  await win.waitForTimeout(300);
  await win.screenshot({ path: S + '/coupler-apart.png' });
  console.log(errs.length ? errs.join('\n') : 'no errors');
  await app.close();
})();
