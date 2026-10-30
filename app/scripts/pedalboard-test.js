// Pedalboards: pedals dropped on a board snap into slots, dragging the board moves its pedals, name and colours.
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

  const r = await win.evaluate(async () => {
    const st = await import('./js/state.js');
    st.loadPreset(st.newPreset('boards'), null);
    const E = window.__tz.editor;
    E.rebuild();
    const pb = E.addAt('pb.small', 0, 0, false);
    const bv = E.views.get(pb.id);
    // drop two pedals roughly over slots 1 and 6
    const a = E.addAt('ib.ts9', pb.x + 260, pb.y + 150, true);
    const b = E.addAt('bx.ds1', pb.x + 640, pb.y + 150, true);
    const va = E.views.get(a.id), vb = E.views.get(b.id);
    const inSlot = (v) => bv.slots.some((s) => Math.abs(v.block.x + v.w / 2 - (pb.x + s.x + 80)) < 1 && Math.abs(v.block.y + v.h / 2 - (pb.y + s.y + 135)) < 1);
    E.view = { x: 60, y: 80, z: 0.8 }; E.applyView();
    return { pb: pb.id, a: a.id, b: b.id, aSlot: inSlot(va), bSlot: inSlot(vb), members: E.boardMembers(pb.id).length, w: bv.w, h: bv.h, ax: a.x, ay: a.y };
  });
  ok(r.aSlot && r.bSlot, 'dropped pedals snapped into slots');
  ok(r.members === 2, `board has ${r.members} pedals`);
  await win.waitForTimeout(300);
  // drag the board by its frame edge
  const p = await win.evaluate((id) => {
    const E = window.__tz.editor, v = E.views.get(id), br = E.board.getBoundingClientRect();
    return { x: br.left + E.view.x + (v.block.x + 12) * E.view.z, y: br.top + E.view.y + (v.block.y + v.h / 2) * E.view.z };
  }, r.pb);
  await win.waitForTimeout(600); // let the drop animation finish
  await win.mouse.move(p.x, p.y); await win.mouse.down(); await win.mouse.move(p.x + 120, p.y + 60, { steps: 10 }); await win.mouse.up();
  await win.waitForTimeout(300);
  const moved = await win.evaluate(({ a }) => { const b = window.__tz.state.preset.blocks.find((x) => x.id === a); return { x: b.x, y: b.y }; }, r);
  ok(Math.abs(moved.x - r.ax - 150) < 15 && Math.abs(moved.y - r.ay - 75) < 15, `pedal moved with the board (${moved.x - r.ax}, ${moved.y - r.ay})`);
  // floor units don't go on boards
  const big = await win.evaluate(({ pb }) => {
    const E = window.__tz.editor, bv = E.views.get(pb);
    const a = E.addAt('tz.atlas', bv.block.x + bv.w / 2, bv.block.y + bv.h / 2, true);
    return E.boardMembers(pb).includes(a.id);
  }, r);
  ok(!big, 'Atlas Floor kept off the board');
  // name and colours
  await win.evaluate(async (id) => {
    const st = await import('./js/state.js');
    st.setParam(id, 'name', 'Main Board');
    st.setParam(id, 'velcro', 2);
    st.setParam(id, 'jacket', '#9aa0a8');
  }, r.pb);
  await win.waitForTimeout(400);
  const nameShown = await win.evaluate((id) => [...document.querySelectorAll(`[data-node="${id}"] text`)].some((t) => t.textContent === 'MAIN BOARD'), r.pb);
  ok(nameShown, 'name shown above the board');
  await win.screenshot({ path: S + '/pedalboard.png' });
  for (const st of [1, 2, 3, 4]) {
    await win.evaluate(async ({ id, st }) => { (await import('./js/state.js')).setParam(id, 'style', st); }, { id: r.pb, st });
    await win.waitForTimeout(300);
    await win.screenshot({ path: S + '/pedalboard-style' + st + '.png' });
  }
  // materials: frame, rails and screws; older jacket colours still work
  const mat = await win.evaluate(async (id) => {
    const st = await import('./js/state.js');
    const M = await import('./js/gfx/materials.js');
    const node = () => document.querySelector(`[data-node="${id}"]`);
    const used = () => [...node().querySelectorAll('[fill^="url(#mt-"]')].map((e) => e.getAttribute('fill').slice(5, -1));
    const legacy = used().some((u) => u.startsWith('mt-metal-aluminium-anodized-9aa0a8'));
    const b = window.__tz.state.preset.blocks.find((x) => x.id === id);
    st.setParam(id, 'style', 3);
    Object.assign(b.params, M.toParams({ m: 'wood', s: 'ebony', f: 'nitro' }, 'frame'), M.toParams({ m: 'metal', s: 'brass', f: 'polished' }, 'screw'));
    st.setParam(id, 'railMat', 'frame');
    await new Promise((r) => setTimeout(r, 300));
    const u = used();
    const defsOk = u.every((x) => document.getElementById(x) && document.querySelector('#globalDefs #' + x));
    const img = document.querySelector('#globalDefs #' + u.find((x) => x.startsWith('mt-wood')) + ' image');
    // messy screws are the same on every redraw
    const crosses = () => [...node().querySelectorAll('path[transform^="rotate"]')].map((e) => e.getAttribute('transform')).join('|');
    const c1 = crosses();
    window.__tz.editor.rerenderNode(id);
    const c2 = crosses();
    return { legacy, wood: u.some((x) => x.startsWith('mt-wood-ebony-nitro')), brass: u.some((x) => x.startsWith('mt-metal-brass-polished')), defsOk, dataImg: !!img && /^data:image\//.test(img.getAttribute('href')), stable: c1 && c1 === c2 };
  }, r.pb);
  ok(mat.legacy, 'old jacket colour still drawn as the frame');
  ok(mat.wood && mat.brass, 'frame and screw materials drawn');
  ok(mat.defsOk && mat.dataImg, 'material defs live in #globalDefs with image tiles');
  ok(mat.stable, 'messy screws keep their look between redraws');
  await win.screenshot({ path: S + '/pedalboard-materials.png' });
  // all six sizes
  await win.evaluate(async () => {
    const st = await import('./js/state.js');
    st.loadPreset(st.newPreset('sizes'), null);
    const E = window.__tz.editor;
    E.rebuild();
    let y = 0;
    for (const k of ['tiny', 'small', 'medium', 'large', 'xl', 'xlmax']) { const b = E.addAt('pb.' + k, 0, y, false); y += E.views.get(b.id).h + 80; }
    E.fit(false);
  });
  await win.waitForTimeout(2500);
  await win.screenshot({ path: S + '/pedalboard-sizes.png' });
  console.log(errs.length ? errs.join('\n') : 'no errors');
  await app.close();
})();
