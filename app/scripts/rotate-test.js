// Block rotation, couplers turning to fit vertical jacks, and group moves keeping couplers linked.
const { _electron: electron } = require('playwright');
const path = require('path');
const S = process.argv[2] || '/tmp';
(async () => {
  const app = await electron.launch({ executablePath: require('electron'), args: [path.join(__dirname, '..'), '--no-sandbox'] });
  const win = await app.firstWindow();
  const errs = []; win.on('pageerror', (e) => errs.push(e.message)); win.on('console', (m) => m.type() === 'error' && !/plugin /.test(m.text()) && errs.push(m.text()));
  await win.setViewportSize({ width: 1600, height: 950 }).catch(() => {});
  await win.waitForFunction(() => window.__tz && window.__tz.ready, null, { timeout: 120000 });
  const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) errs.push(m); };

  // 1. rotate a pedal: size swaps, jacks change side, cables follow
  const r1 = await win.evaluate(async () => {
    const st = await import('./js/state.js');
    st.loadPreset(st.newPreset('rot'), null);
    const E = window.__tz.editor;
    const a = st.addBlock('ib.ts9', 300, 200), b = st.addBlock('bx.ds1', 600, 200);
    st.connect({ node: b.id, port: 0 }, { node: a.id, port: 0 });
    E.rebuild(); E.view = { x: 60, y: 60, z: 1 }; E.applyView();
    const v = E.views.get(a.id), w0 = v.w, h0 = v.h, s0 = v.jack('i0').side;
    E.rotateBlocks([a.id], 90);
    const v2 = E.views.get(a.id);
    return { id: a.id, b: b.id, w0, h0, w1: v2.w, h1: v2.h, s0, s1: v2.jack('i0').side, rot: v2.block.rot, cable: !!document.querySelector('#boardSvg .cable, #boardSvg [data-cable]') };
  });
  ok(r1.w1 === r1.h0 && r1.h1 === r1.w0, `size swapped ${r1.w0}x${r1.h0} -> ${r1.w1}x${r1.h1}`);
  ok(r1.s0 !== r1.s1, `input jack side ${r1.s0} -> ${r1.s1}`);
  ok(r1.rot === 90, 'rot saved as 90');
  await win.waitForTimeout(300);
  await win.screenshot({ path: S + '/rotate.png' });
  // rotate back to 0 with four turns
  const back = await win.evaluate((id) => { const E = window.__tz.editor; for (let i = 0; i < 3; i++) E.rotateBlocks([id], 90); return E.views.get(id).block.rot; }, r1.id);
  ok(back === undefined, 'four turns back to 0');

  // 2. coupler next to a vertical jack: it should turn to fit and link
  const r2 = await win.evaluate(async () => {
    const st = await import('./js/state.js');
    st.loadPreset(st.newPreset('rot2'), null);
    const E = window.__tz.editor;
    const a = st.addBlock('ib.ts9', 300, 300);
    a.rot = 90; // TS9 input/output jacks now on top and bottom
    const c = st.addBlock('tz.dmale', 100, 100);
    E.rebuild(); E.view = { x: 60, y: 0, z: 1.3 }; E.applyView();
    const va = E.views.get(a.id), j = va.jack('i0');
    const vc = E.views.get(c.id);
    // put the coupler's output end a little off the TS9 input jack
    const ce = vc.jack('o0');
    vc.setPosition(Math.round(a.x + j.x - ce.x + 9), Math.round(a.y + j.y - ce.y - 14));
    E.coupleAfterMove([c.id]);
    const cv = E.views.get(c.id);
    return { side: j.side, crot: cv.block.rot || 0, linked: st.state.preset.cables.filter((x) => x.direct).length };
  });
  ok(r2.crot !== 0, `coupler turned ${r2.crot} to face a ${r2.side} jack`);
  ok(r2.linked === 1, 'coupler linked to the vertical jack');
  await win.evaluate(() => {
    const E = window.__tz.editor, c = [...E.views.values()].find((v) => v.def.coupler), r = E.board.getBoundingClientRect();
    E.view = { z: 3, x: r.width / 2 - (c.block.x + c.w / 2) * 3, y: r.height / 2 - (c.block.y + c.h / 2) * 3 }; E.applyView();
  });
  await win.waitForTimeout(300);
  await win.screenshot({ path: S + '/rotate-coupler.png' });

  // 3. group move with a coupler between two pedals: links survive an off-grid drag
  const r3 = await win.evaluate(async () => {
    const st = await import('./js/state.js');
    st.loadPreset(st.newPreset('rot3'), null);
    const E = window.__tz.editor;
    const a = st.addBlock('ib.ts9', 500, 200), b = st.addBlock('bx.ds1', 100, 200), c = st.addBlock('tz.dmale', 403, 287);
    E.rebuild(); E.view = { x: 40, y: 40, z: 1 }; E.applyView();
    // seat both pedals on the coupler
    const vc = E.views.get(c.id), va = E.views.get(a.id), vb = E.views.get(b.id);
    const ci = vc.jack('i0'), co = vc.jack('o0'), ao = va.jack('o0'), bi = vb.jack('i0');
    va.setPosition(c.x + ci.x - ao.x + 3, c.y + ci.y - ao.y);
    E.coupleLinks(new Set([a.id]));
    vb.setPosition(c.x + co.x - bi.x - 3, c.y + co.y - bi.y);
    E.coupleLinks(new Set([b.id]));
    E.select([a.id, b.id, c.id]);
    return { a: a.id, links: st.state.preset.cables.filter((x) => x.direct).length };
  });
  ok(r3.links === 2, 'both pedals linked to the coupler');
  const box = await win.evaluate((id) => { const r = document.querySelector(`[data-node="${id}"]`).getBoundingClientRect(); return { x: r.x + r.width * 0.5, y: r.y + r.height * 0.55 }; }, r3.a);
  await win.mouse.move(box.x, box.y); await win.mouse.down(); await win.mouse.move(box.x + 137, box.y + 73, { steps: 12 }); await win.mouse.up();
  await win.waitForTimeout(300);
  const after = await win.evaluate(() => window.__tz.state.preset.cables.filter((x) => x.direct).length);
  ok(after === 2, `links after group drag: ${after}`);
  console.log(errs.length ? errs.join('\n') : 'no errors');
  await app.close();
})();
