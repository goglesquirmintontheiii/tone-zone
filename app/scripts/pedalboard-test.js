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
    const a = E.addAt('ib.ts9', pb.x + 380, pb.y + 180, true);
    const b = E.addAt('bx.ds1', pb.x + 900, pb.y + 180, true);
    const va = E.views.get(a.id), vb = E.views.get(b.id);
    const PB = await import('./js/catalog/pedalboards.js');
    const inSlot = (v) => bv.slots.some((s) => { const p = PB.slotPos(bv.def.pedalboard, s.r, s.c, 1, v.w, v.h, E.boardFoot(v)); return v.block.x === pb.x + p.x && v.block.y === pb.y + p.y; });
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
  // XL Max: three rows (10 + 9 + 9); a level meter (a bit taller than a row) still fits; glass takes no screws
  const xl = await win.evaluate(async () => {
    const st = await import('./js/state.js');
    const M = await import('./js/gfx/materials.js');
    st.loadPreset(st.newPreset('xlmax'), null);
    const E = window.__tz.editor;
    E.rebuild();
    const pb = E.addAt('pb.xlmax', 0, 0, false);
    const bv = E.views.get(pb.id);
    const m = E.addAt('tz.meter', bv.block.x + 500, bv.block.y + bv.h - 150, true);
    const mv = E.views.get(m.id);
    const onBoard = E.boardMembers(pb.id).includes(m.id);
    const b = window.__tz.state.preset.blocks.find((x) => x.id === pb.id);
    Object.assign(b.params, M.toParams({ m: 'glass', s: 'clear', f: 'clear' }, 'frame'));
    st.setParam(pb.id, 'style', 2);
    await new Promise((r) => setTimeout(r, 200));
    const screws = document.querySelectorAll(`[data-node="${pb.id}"] path[d*="M"][stroke-linecap="round"]`).length;
    E.fit(false);
    return { slots: bv.slots.length, rails: 0, onBoard, mh: mv.h, bottom: Math.round(bv.block.y + bv.h - (mv.block.y + mv.h)), style: b.params.style };
  });
  ok(xl.slots === 28, `XL Max has ${xl.slots} spots`);
  ok(xl.onBoard, `level meter (${xl.mh} tall) sits on the board, ${xl.bottom} from the bottom edge`);
  ok(xl.style === 0, 'glass board switched off the screw mounting');
  await win.waitForTimeout(800);
  await win.screenshot({ path: S + '/pedalboard-xlmax.png' });
  // mounting UI: velcro shows the strips toggle and velcro colour, screws the messy toggle, blank neither
  const mount = await win.evaluate(async () => {
    const st = await import('./js/state.js');
    st.loadPreset(st.newPreset('mount'), null);
    const E = window.__tz.editor;
    E.rebuild();
    const pb = E.addAt('pb.small', 0, 0, false);
    E.select([pb.id]);
    await new Promise((r) => setTimeout(r, 300));
    const insp = document.getElementById('inspector');
    const has = (c) => !!insp.querySelector('.pb-mounting .' + c);
    const shown = () => ({ strips: has('pb-strips'), velcro: has('pb-velcro'), messy: has('pb-messy') });
    const selects = [...insp.querySelectorAll('.prow select')].map((s) => s.closest('.prow').querySelector('label').textContent);
    const style = () => window.__tz.state.preset.blocks.find((b) => b.id === pb.id).params.style || 0;
    const set = async (cls, v) => {
      const el = insp.querySelector('.pb-mounting .' + cls + ' ' + (cls === 'pb-mount' ? 'select' : 'input'));
      if (cls === 'pb-mount') el.value = v; else el.checked = !!v;
      el.dispatchEvent(new Event('change'));
      await new Promise((r) => setTimeout(r, 200));
    };
    const out = { selects, velcro0: shown() };
    await set('pb-strips', 1); out.strips = style();
    await set('pb-strips', 0); out.full = style();
    await set('pb-mount', 1); out.screws = style(); out.screwUI = shown();
    await set('pb-messy', 1); out.messy = style();
    await set('pb-mount', 2); out.blank = style(); out.blankUI = shown();
    await set('pb-mount', 1); out.messyKept = style();
    await set('pb-mount', 0); out.velcroBack = style(); out.velcroUI = shown();
    return out;
  });
  ok(!mount.selects.includes('VELCRO') && !mount.selects.includes('MOUNTING'), `old dropdowns gone (${mount.selects.join(', ')})`);
  ok(mount.velcro0.strips && mount.velcro0.velcro && !mount.velcro0.messy, 'velcro: strips toggle and velcro colour shown');
  ok(mount.strips === 1 && mount.full === 0, `strips toggle sets style ${mount.strips}, off ${mount.full}`);
  ok(mount.screws === 2 && mount.screwUI.messy && !mount.screwUI.velcro && !mount.screwUI.strips, 'screws: only the messy toggle');
  ok(mount.messy === 3, `messy toggle sets style ${mount.messy}`);
  ok(mount.blank === 4 && !mount.blankUI.messy && !mount.blankUI.velcro && !mount.blankUI.strips, 'blank: no toggles');
  ok(mount.messyKept === 3 && mount.velcroBack === 0 && mount.velcroUI.velcro, `toggles remembered (screws ${mount.messyKept}, velcro ${mount.velcroBack})`);
  for (const [i, m] of [[0, 0], [1, 1], [2, 2]]) {
    await win.evaluate(async (m) => {
      const s = document.querySelector('#inspector .pb-mounting .pb-mount select');
      s.value = m; s.dispatchEvent(new Event('change'));
    }, m);
    await win.waitForTimeout(400);
    const box = await win.evaluate(() => { const r = document.getElementById('inspector').getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: Math.min(r.height, 700) }; });
    await win.screenshot({ path: S + '/pedalboard-mount' + i + '.png', clip: box });
  }

  // spacing: wide pedals with cables keep a clear gap, plugs included (the Spruce + Featherweight case)
  const sp = await win.evaluate(async () => {
    const st = await import('./js/state.js');
    st.loadPreset(st.newPreset('spacing'), null);
    const E = window.__tz.editor;
    E.rebuild();
    const pb = E.addAt('pb.medium', 0, 0, false);
    const bv = E.views.get(pb.id);
    const add = (t, x, y) => E.addAt(t, bv.block.x + x, bv.block.y + y, true);
    // dropped close together, as in the bug report
    const sprc = add('tz.spruce', 600, 180), fw = add('tz.featherweight', 760, 180);
    const w1 = add('tz.vaulted', 300, 180), w2 = add('tz.lumen', 470, 180);
    st.connect({ node: fw.id, port: 0 }, { node: sprc.id, port: 0 });
    st.connect({ node: w2.id, port: 0 }, { node: w1.id, port: 0 });
    E.drawCables();
    const ids = [sprc.id, fw.id, w1.id, w2.id];
    // body plus plugs of every pedal
    const box = (id) => {
      const v = E.views.get(id), f = E.boardFoot(v);
      return { id, x0: v.block.x - f.l, x1: v.block.x + v.w + f.r, y0: v.block.y - f.t, y1: v.block.y + v.h + f.b, onBoard: E.boardMembers(pb.id).includes(id) };
    };
    const boxes = ids.map(box);
    let worst = 1e9;
    for (const a of boxes) for (const b of boxes) if (a !== b && a.y0 < b.y1 && b.y0 < a.y1) worst = Math.min(worst, Math.max(b.x0 - a.x1, a.x0 - b.x1));
    // the plugs drawn on screen don't reach into a neighbour's body
    const bodies = ids.map((id) => document.querySelector(`[data-node="${id}"]`).getBoundingClientRect());
    const plugs = [...document.querySelectorAll('#layerPlugs > g')].map((g) => g.getBoundingClientRect());
    let plugHits = 0;
    for (const p of plugs) for (const b of bodies) {
      const ix = Math.min(p.right, b.right) - Math.max(p.left, b.left), iy = Math.min(p.bottom, b.bottom) - Math.max(p.top, b.top);
      if (ix > 3 && iy > 3) plugHits++;
    }
    E.view = { x: 80, y: 120, z: 0.75 }; E.applyView();
    return { worst, all: boxes.every((b) => b.onBoard), plugs: plugs.length, plugHits };
  });
  ok(sp.all, 'all four pedals on the board');
  ok(sp.worst >= 0, `pedals and their plugs keep a gap (closest ${Math.round(sp.worst)} px)`);
  ok(sp.plugs > 0 && sp.plugHits === 0, `no plug sits on another pedal (${sp.plugHits} of ${sp.plugs})`);
  await win.waitForTimeout(500);
  await win.screenshot({ path: S + '/pedalboard-spacing.png' });

  // routing: a cable from one row to the other runs along the gaps and stays off the pedals
  const rt = await win.evaluate(async () => {
    const st = await import('./js/state.js');
    st.loadPreset(st.newPreset('routing'), null);
    const E = window.__tz.editor;
    E.rebuild();
    const pb = E.addAt('pb.medium', 0, 0, false);
    const bv = E.views.get(pb.id);
    const add = (t, x, y) => E.addAt(t, bv.block.x + x, bv.block.y + y, true);
    const row0 = ['bx.ds1', 'ib.ts9', 'bx.ch1', 'mx.m169', 'tz.klone', 'bx.dd8'].map((t, i) => add(t, 1300 - i * 240, 180));
    const row1 = ['bx.rv6', 'tz.spring', 'sy.cloudburst'].map((t, i) => add(t, 1300 - i * 240, 480));
    // left end of the top row into the right end of the bottom row, a skip along the top row, a top jack pedal
    const pairs = [[row0[5], row1[0]], [row0[0], row0[3]], [row1[1], row1[2]], [row0[1], row0[2]]];
    for (const [a, b] of pairs) st.connect({ node: a.id, port: 0 }, { node: b.id, port: 0 });
    E.drawCables();
    const rects = [...row0, ...row1].map((b) => { const v = E.views.get(b.id); return { id: b.id, x0: v.block.x, y0: v.block.y, x1: v.block.x + v.w, y1: v.block.y + v.h }; });
    const res = [];
    for (const c of window.__tz.state.preset.cables) {
      const path = document.querySelector(`[data-cable="${c.id}"] path`);
      const L = path.getTotalLength();
      let hits = 0;
      for (let s = 0; s <= L; s += 4) {
        const p = path.getPointAtLength(s);
        for (const r of rects) if (p.x > r.x0 + 1 && p.x < r.x1 - 1 && p.y > r.y0 + 1 && p.y < r.y1 - 1) hits++;
      }
      res.push({ from: c.from.node, to: c.to.node, hits, len: Math.round(L), d: path.getAttribute('d').length });
    }
    E.fit(false);
    return { res, onBoard: E.boardMembers(pb.id).length };
  });
  ok(rt.onBoard === 9, `9 pedals on the medium board (${rt.onBoard})`);
  for (const r of rt.res) ok(r.hits === 0, `cable ${r.from} > ${r.to} stays off the pedals (${r.hits} points on a pedal, ${r.len} long)`);
  await win.waitForTimeout(800);
  await win.screenshot({ path: S + '/pedalboard-routing.png' });

  // factory presets with 3 or more board pedals come on a board of the right size
  const pr = await win.evaluate(async () => {
    const out = {};
    for (const f of ['g184-acoustic-lead-pro.json', '01-welcome.json', '06-looper-jam.json']) {
      const p = await window.tz.presets.load(f).catch(() => null);
      if (!p) { out[f] = null; continue; }
      window.__tz.loadPreset(p, f);
      await new Promise((r) => setTimeout(r, 600));
      const E = window.__tz.editor;
      const pbb = p.blocks.find((b) => b.type.startsWith('pb.'));
      const pedals = p.blocks.filter((b) => !b.type.startsWith('__') && !b.type.startsWith('pb.') && !/^(amp|cab)/.test(E.views.get(b.id).def.baseForm || ''));
      out[f] = { board: pbb && pbb.type, members: pbb ? E.boardMembers(pbb.id).length : 0, pedals: pedals.length };
    }
    return out;
  });
  const alp = pr['g184-acoustic-lead-pro.json'];
  ok(alp && alp.board === 'pb.medium' && alp.members === alp.pedals, `Acoustic Lead Pro on a ${alp && alp.board} with ${alp && alp.members} of ${alp && alp.pedals} pedals`);
  ok(pr['01-welcome.json'] && pr['01-welcome.json'].board === 'pb.tiny', `Welcome on a ${pr['01-welcome.json'] && pr['01-welcome.json'].board}`);
  ok(pr['06-looper-jam.json'] && pr['06-looper-jam.json'].board === 'pb.small', `Looper Jam on a ${pr['06-looper-jam.json'] && pr['06-looper-jam.json'].board}`);
  for (const f of ['g184-acoustic-lead-pro', 't01-sweet-child-o-mine', 'g234-blues-lead-pro']) {
    await win.evaluate(async (f) => { const p = await window.tz.presets.load(f + '.json').catch(() => null); if (p) window.__tz.loadPreset(p, f + '.json'); }, f);
    await win.waitForTimeout(1200);
    await win.evaluate(() => window.__tz.editor.fit(false));
    await win.waitForTimeout(1500);
    await win.screenshot({ path: S + '/preset-' + f + '.png' });
  }

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
