// Nautica XL (tz.nautica) test: loads the block, checks layout (no overflow, no text overlap on its screens), clicks
// every control, walks the screen pages by pointer, checks footswitch LCD labels follow assignments, treadles move
// params, I/O LEDs follow levels, renders a preset offline (not silent) and takes screenshots.
// usage: node scripts/nautica-test.js [outdir]
const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');
const { makeDI, measure } = require('./loudness');
(async () => {
  const out = process.argv[2] || '/tmp/nautica-test';
  fs.mkdirSync(out, { recursive: true });
  const app = await electron.launch({ executablePath: require('electron'), args: [path.join(__dirname, '..'), '--no-sandbox'] });
  const win = await app.firstWindow();
  const errs = [];
  win.on('pageerror', (e) => errs.push('PAGEERROR ' + e.stack));
  win.on('console', (m) => m.type() === 'error' && !/Autofill|DevTools/.test(m.text()) && errs.push('CONSOLE ' + m.text()));
  await win.setViewportSize({ width: 1600, height: 950 }).catch(() => {});
  await win.waitForFunction(() => window.__tz && window.__tz.ready, null, { timeout: 120000 });
  let fails = 0;
  const ok = (cond, msg) => { console.log((cond ? 'ok   ' : 'FAIL ') + msg); if (!cond) fails++; };
  const wait = (ms) => win.waitForTimeout(ms);

  // ---- 1. load the block on a fresh board, wired in -> GUITAR IN, OUT 1 L/R -> main out
  const id = await win.evaluate(async () => {
    const st = await import('./js/state.js');
    st.loadPreset(st.newPreset('nautica'), null);
    const b = st.addBlock('tz.nautica', 0, 0);
    st.connect({ node: '__in', port: 0 }, { node: b.id, port: 0 });
    st.connect({ node: b.id, port: 2 }, { node: '__out', port: 0 });
    st.connect({ node: b.id, port: 3 }, { node: '__out', port: 1 });
    window.__nx = b.id;
    return b.id;
  });
  ok(!!id, 'block loads');
  const zoomTo = (z, cx = 0.5, cy = 0.5) => win.evaluate(([z, cx, cy]) => {
    const T = window.__tz, v = T.editor.views.get(window.__nx), r = T.editor.svg.getBoundingClientRect();
    const vis = document.getElementById('board').getBoundingClientRect();
    // centre on the visible part of the board (the docks cover the sides of the svg)
    const mx = (vis.left + vis.right) / 2 - r.left, my = (Math.max(vis.top, r.top) + Math.min(vis.bottom, r.bottom)) / 2 - r.top;
    const b = T.state.preset.blocks.find((x) => x.id === window.__nx);
    T.editor.view = { z, x: mx - (b.x + v.w * cx) * z, y: my - (b.y + v.h * cy) * z };
    T.editor.applyView();
  }, [z, cx, cy]);
  await zoomTo(0.76);
  await wait(1500);
  await (await win.$('#board')).screenshot({ path: path.join(out, 'unit.png') });

  // ---- 2. layout: every control inside the enclosure, screen texts inside their screens and not overlapping
  const layout = await win.evaluate(() => {
    const T = window.__tz, v = T.editor.views.get(window.__nx);
    const body = v.content.getBoundingClientRect();
    const res = { outside: [], textOut: [], overlaps: [], count: v.views.size };
    for (const [, { ctl, view }] of v.views) {
      if (!view || !view.g) continue;
      const r = view.g.getBoundingClientRect();
      if (r.width === 0) continue;
      if (r.left < body.left - 2 || r.right > body.right + 2 || r.top < body.top - 2 || r.bottom > body.bottom + 2) res.outside.push(ctl.role || ctl.p);
    }
    for (const s of v.screens) {
      if (!s.view || !s.view.content || s.ctl.kind === 'nxl-io') continue;
      const clip = s.view.content.parentNode.querySelector('rect').getBoundingClientRect();
      const texts = [...s.view.content.querySelectorAll('text')].filter((t) => t.textContent.trim() && t.getAttribute('display') !== 'none' && !t.closest('[display="none"]'));
      const boxes = texts.map((t) => ({ t: t.textContent, r: t.getBoundingClientRect() })).filter((x) => x.r.width > 0);
      for (const b of boxes) if (b.r.left < clip.left - 1 || b.r.right > clip.right + 1 || b.r.top < clip.top - 1 || b.r.bottom > clip.bottom + 1) res.textOut.push(s.ctl.role + ': ' + b.t);
      for (let i = 0; i < boxes.length; i++)
        for (let j = i + 1; j < boxes.length; j++) {
          const a = boxes[i].r, c = boxes[j].r;
          const w = Math.min(a.right, c.right) - Math.max(a.left, c.left), h = Math.min(a.bottom, c.bottom) - Math.max(a.top, c.top);
          // line boxes are taller than the glyphs: count real overlaps only
          if (w > 1 && h > Math.min(a.height, c.height) * 0.45) res.overlaps.push(s.ctl.role + ': ' + boxes[i].t + ' / ' + boxes[j].t);
        }
    }
    return res;
  });
  ok(layout.outside.length === 0, `${layout.count} controls inside the enclosure ${layout.outside.join(',')}`);
  ok(layout.textOut.length === 0, 'screen texts inside their screens ' + layout.textOut.slice(0, 8).join(' | '));
  ok(layout.overlaps.length === 0, 'no text overlap on the screens ' + layout.overlaps.slice(0, 8).join(' | '));

  // helpers: client point of a control / of a screen-local point
  const ctlPt = (role) => win.evaluate((role) => {
    const v = window.__tz.editor.views.get(window.__nx);
    for (const [, { ctl, view }] of v.views) if (ctl.role === role) { const r = view.g.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height }; }
    return null;
  }, role);
  const scrPt = (role, x, y) => win.evaluate(([role, x, y]) => {
    const v = window.__tz.editor.views.get(window.__nx);
    const s = v.screens.find((q) => q.ctl.role === role);
    const r = s.view.content.parentNode.querySelector('rect').getBoundingClientRect();
    return { x: r.left + (x * r.width) / s.ctl.w, y: r.top + (y * r.height) / s.ctl.h };
  }, [role, x, y]);
  const tapScr = async (role, x, y) => { const p = await scrPt(role, x, y); await win.mouse.click(p.x, p.y); await wait(160); };
  const ui = (k) => win.evaluate((k) => { const b = window.__tz.state.preset.blocks.find((x) => x.id === window.__nx); return b.params[k]; }, k);
  const nx = () => win.evaluate(() => window.__tz.state.ui[window.__nx].nx.page);
  const st = () => win.evaluate(() => JSON.parse(window.__tz.state.preset.blocks.find((x) => x.id === window.__nx).params._st || 'null'));
  const shotScreen = async (role, file) => {
    const p0 = await scrPt(role, 0, 0);
    const v = await win.evaluate((role) => { const s = window.__tz.editor.views.get(window.__nx).screens.find((q) => q.ctl.role === role); return [s.ctl.w, s.ctl.h]; }, role);
    const p1 = await scrPt(role, v[0], v[1]);
    await win.screenshot({ path: path.join(out, file), clip: { x: p0.x - 4, y: p0.y - 4, width: p1.x - p0.x + 8, height: p1.y - p0.y + 8 } });
  };

  // ---- 3. every control is interactive (cables hidden: the input cable hangs over the left panel)
  await win.evaluate(() => (document.getElementById('layerCables').style.display = 'none'));
  await zoomTo(1.6, 0.45, 0.62);
  await wait(1200);
  const roles = await win.evaluate(() => [...window.__tz.editor.views.get(window.__nx).views.values()].map((e) => ({ role: e.ctl.role, t: e.ctl.t, p: e.ctl.p, interactive: !!e.ctl.interactive })).filter((c) => c.t !== 'led'));
  let interacted = 0, missing = [];
  for (const c of roles) {
    if (c.t === 'screen') {
      if (!c.interactive) continue;
      const has = await win.evaluate((role) => { const v = window.__tz.editor.views.get(window.__nx); const e = [...v.views.values()].find((x) => x.ctl.role === role); return e.view.g.classList.contains('ctl'); }, c.role);
      if (has) interacted++; else missing.push(c.role);
      continue;
    }
    const role = c.role;
    // bring the control into view
    const where = await win.evaluate((role) => { const v = window.__tz.editor.views.get(window.__nx); const e = [...v.views.values()].find((x) => x.ctl.role === role); return { x: e.ctl.x / v.w, y: e.ctl.y / v.h }; }, role);
    await zoomTo(1.6, where.x, where.y);
    await wait(120);
    // re-measure until the point really hits the control (the view can still be settling)
    let p = null;
    for (let k = 0; k < 5 && !p; k++) {
      const q = await ctlPt(role);
      const hitOk = q && (await win.evaluate(([x, y, role]) => { const v = window.__tz.editor.views.get(window.__nx); const e = [...v.views.values()].find((z) => z.ctl.role === role); const el = document.elementFromPoint(x, y); return !!el && el.closest('[data-ctl]') && el.closest('[data-ctl]').dataset.ctl === e.ctl.cid; }, [q.x, q.y, role]));
      if (hitOk) p = q; else await wait(250);
    }
    if (!p) {
      const q = await ctlPt(role);
      const what = q && (await win.evaluate(([x, y]) => { const el = document.elementFromPoint(x, y); return el ? el.tagName + '.' + (el.getAttribute('class') || el.id || '') + ' ' + (el.outerHTML || '').slice(0, 120) : 'none'; }, [q.x, q.y]));
      missing.push(role + ' (not hit: ' + what + ')'); continue;
    }
    const before = await ui(c.p);
    if (c.t === 'knob' || c.t === 'treadle') {
      const dy = (before ?? 0.5) < 0.5 ? -40 : 40;
      await win.mouse.move(p.x, p.y); await win.mouse.down(); await win.mouse.move(p.x, p.y + dy, { steps: 5 }); await win.mouse.up();
    } else {
      await win.mouse.click(p.x, p.y);
    }
    await wait(120);
    const after = await ui(c.p);
    if (after !== before && after !== undefined) interacted++; else missing.push(role + ' (' + c.p + ' ' + before + ' -> ' + after + ')');
    // undo side effects of page buttons / mute
    if (c.p === '_mute' && after) await win.mouse.click(p.x, p.y);
  }
  await win.evaluate(async () => { const st = await import('./js/state.js'); st.setParam(window.__nx, '_tuner', 0, { silent: true }); const n = window.__tz.state.ui[window.__nx].nx; n.page = 'rig'; });
  await win.evaluate(() => (document.getElementById('layerCables').style.display = ''));
  ok(missing.length === 0, `${interacted} controls respond ${missing.slice(0, 10).join(', ')}`);

  // ---- 4. screen pages by pointer
  await zoomTo(1.7, 0.37, 0.35);
  await wait(500);
  const pages = [];
  const onSide = async () => { await zoomTo(1.7, 0.66, 0.32); await wait(250); };
  const onMain = async () => { await zoomTo(1.7, 0.37, 0.35); await wait(250); };
  // side screen HOME
  await onSide();
  await tapScr('side', 24, 14); await wait(200);
  await onMain();
  ok((await nx()) === 'rig', 'side HOME -> signal chain');
  await shotScreen('main', 'page-rig.png'); pages.push('rig');
  // tap A2 tile (select), tap again (open block page)
  const tile = (k) => [42 + (+k.slice(1) - 1) * 61 + 27, (k[0] === 'A' ? 50 : 104) + 18];
  await tapScr('main', ...tile('A2')); await wait(250);
  ok(await win.evaluate(() => window.__tz.state.ui[window.__nx].nx.cur) === 'A2', 'tap a block selects it');
  await tapScr('main', ...tile('A2')); await wait(250);
  ok((await nx()) === 'blk', 'tap again opens the block page');
  await shotScreen('main', 'page-block.png'); pages.push('blk');
  // drag a touch dial up
  const s0 = await st();
  const p0 = await scrPt('main', 8 + 54, 54 + 50);
  await win.mouse.move(p0.x, p0.y); await win.mouse.down(); await win.mouse.move(p0.x, p0.y - 30, { steps: 6 }); await win.mouse.up();
  await wait(250);
  const s1 = await st();
  ok(JSON.stringify(s0.slots.A2.v) !== JSON.stringify(s1.slots.A2.v), 'touch dial drag changes the parameter');
  // MODEL chip -> library, pick a model
  await tapScr('main', 296 + 26, 26 + 8); await wait(250);
  ok((await nx()) === 'lib', 'MODEL opens the library');
  await shotScreen('main', 'page-library.png'); pages.push('lib');
  await tapScr('main', 60, 22 + 1 * 16 + 8); await wait(250); // AMP category
  await tapScr('main', 128 + 70, 40 + 15); await wait(300); // first amp
  const s2 = await st();
  ok(s2.slots.A2.m.startsWith('amp.'), 'library loads a model into the slot: ' + s2.slots.A2.m);
  // hardware buttons open their pages
  for (const [btn, pg, file] of [['b_scn', 'scn', 'page-scenes.png'], ['b_pre', 'pre', 'page-presets.png'], ['b_lpr', 'lpr', 'page-looper.png'], ['b_asg', 'asg', 'page-assign.png'], ['b_io', 'io', 'page-io.png'], ['b_glb', 'glb', 'page-global.png'], ['b_tun', 'tun', 'page-tuner.png']]) {
    await zoomTo(1.4, 0.07, 0.5); await wait(80);
    const p = await ctlPt(btn);
    await win.mouse.click(p.x, p.y); await wait(250);
    ok((await nx()) === pg, `${btn} opens ${pg}`);
    await zoomTo(1.7, 0.37, 0.35); await wait(350);
    await shotScreen('main', file); pages.push(pg);
  }
  // BACK from the tuner switches it off
  await onSide();
  await tapScr('side', 69, 14); await wait(250);
  await onMain();
  ok((await nx()) !== 'tun' && !(await ui('_tuner')), 'side BACK leaves the tuner');
  // header taps: preset name -> presets, scene -> scenes
  await tapScr('main', 60, 9); await wait(200);
  ok((await nx()) === 'pre', 'header preset name opens presets');
  await tapScr('main', 200, 9); await wait(200);
  ok((await nx()) === 'scn', 'header scene opens scenes');
  // recall scene 2 by tapping its card
  await tapScr('main', 6 + 137 + 60, 42 + 20); await wait(200);
  ok((await st()).sc === 1, 'scene card recalls scene 2');
  // presets: double tap A3 loads it
  await tapScr('main', 60, 9); await wait(200);
  await tapScr('main', 200, 44 + 2 * 29 + 12); await tapScr('main', 200, 44 + 2 * 29 + 12); await wait(400);
  ok((await st()).pi === 2, 'preset row loads preset A3');
  // side encoder: wheel moves the cursor, push = enter
  await onSide();
  await tapScr('side', 24, 14); await wait(150);
  const curA = await win.evaluate(() => window.__tz.state.ui[window.__nx].nx.cur);
  const ep = await scrPt('side', 100, 248);
  await win.mouse.move(ep.x, ep.y); await win.mouse.wheel(0, 120); await wait(250);
  const curB = await win.evaluate(() => window.__tz.state.ui[window.__nx].nx.cur);
  ok(curA !== curB, `select encoder moves the cursor ${curA} -> ${curB}`);
  // XY pad
  const sx0 = await st();
  await tapScr('side', 30, 140); await wait(250);
  ok(JSON.stringify(sx0.slots) !== JSON.stringify((await st()).slots), 'XY pad edits the focused block');
  await shotScreen('side', 'side-screen.png');
  await onMain();
  // strips: open the settings menu and pick LEVELS for strip 1
  await tapScr('strip0', 548, 11); await wait(200);
  await shotScreen('strip0', 'strip-menu.png');
  await tapScr('strip0', 3 + 4 * ((560 - 30) / 6) + 30, 11); await wait(250);
  ok(((await st()).g.strip || [])[0] === 4, 'strip menu sets the strip content');
  await shotScreen('strip0', 'strip-pedals.png');
  await shotScreen('strip1', 'strip-levels.png');

  // ---- 5. footswitch LCD labels follow assignments (ASSIGN page, by pointer); stomp assignments show in STOMP mode
  await win.evaluate(async () => { const st = await import('./js/state.js'); const b = window.__tz.state.preset.blocks.find((x) => x.id === window.__nx); const s = JSON.parse(b.params._st); s.mode = 0; st.setParam(b.id, '_st', JSON.stringify(s), { silent: true }); });
  await onSide();
  await tapScr('side', 24, 14);
  await zoomTo(1.4, 0.07, 0.5); await wait(80);
  { const p = await ctlPt('b_asg'); await win.mouse.click(p.x, p.y); await wait(250); }
  await zoomTo(1.7, 0.37, 0.35); await wait(300);
  await tapScr('main', 8 + 30, 34 + 12); await wait(250); // FS 1 cell
  ok((await nx()) === 'asgl', 'FS 1 cell opens the picker');
  await shotScreen('main', 'page-assign-list.png');
  const want = await win.evaluate(async () => {
    const N = await import('./js/catalog/nautica.js');
    const S = await import('./js/state.js');
    const st = N.nxState(S.uiParams(window.__tz.state.preset.blocks.find((x) => x.id === window.__nx)));
    return N.nxFsChoices(st, 0).findIndex((c) => c.a.t === 'tap');
  });
  // the picker shows 14 rows per column: scroll there with the wheel if needed, then tap the TAP TEMPO row
  const rowOf = async (idx) => { const top = await win.evaluate(() => window.__tz.state.ui[window.__nx].nx.lscr2 | 0); const rel = idx - top; return { c: Math.floor(rel / 14), r: rel % 14 }; };
  let rc = await rowOf(want);
  if (rc.c > 1 || rc.c < 0) { const p = await scrPt('main', 280, 120); await win.mouse.move(p.x, p.y); await win.mouse.wheel(0, 300); await wait(200); rc = await rowOf(want); }
  await tapScr('main', 8 + rc.c * 272 + 60, 40 + rc.r * 14.6 + 6); await wait(400);
  const lcd0 = await win.evaluate(() => { const s = window.__tz.editor.views.get(window.__nx).screens.find((q) => q.ctl.role === 'lcd0'); return s.t.textContent; });
  ok(lcd0 === 'TAP', 'FS 1 LCD shows its new assignment: ' + lcd0);
  // mode change: SCENE mode puts scenes on FS 1-8
  await win.evaluate(async () => { const st = await import('./js/state.js'); const N = await import('./js/catalog/nautica.js'); const b = window.__tz.state.preset.blocks.find((x) => x.id === window.__nx); const s = JSON.parse(b.params._st); s.mode = 1; st.setParam(b.id, '_st', JSON.stringify(s), { silent: true }); void N; });
  await wait(300);
  const lcd3 = await win.evaluate(() => { const s = window.__tz.editor.views.get(window.__nx).screens.find((q) => q.ctl.role === 'lcd3'); return s.sub.textContent + ' ' + s.t.textContent; });
  ok(/^SCENE 4/.test(lcd3), 'SCENE mode: FS 4 LCD shows scene 4: ' + lcd3);
  await zoomTo(1.6, 0.4, 0.86); await wait(400);
  await win.screenshot({ path: path.join(out, 'footswitch-lcds.png') });
  await win.evaluate(async () => { const st = await import('./js/state.js'); const b = window.__tz.state.preset.blocks.find((x) => x.id === window.__nx); const s = JSON.parse(b.params._st); s.mode = 0; st.setParam(b.id, '_st', JSON.stringify(s), { silent: true }); });
  // pressing a stomp footswitch toggles its block and the LCD follows
  {
    const s3 = await st();
    const k = Object.keys(s3.slots).sort()[1];
    await zoomTo(1.6, 0.4, 0.86); await wait(200);
    const p = await ctlPt('fs1');
    await win.mouse.click(p.x, p.y); await wait(300);
    const s4 = await st();
    ok(s4.slots[k].on !== s3.slots[k].on, `FS 2 toggles block ${k}`);
  }

  // ---- 6. treadles move their parameters
  {
    await win.evaluate(async () => { const st = await import('./js/state.js'); const b = window.__tz.state.preset.blocks.find((x) => x.id === window.__nx); const s = JSON.parse(b.params._st); s.mode = 0; st.setParam(b.id, '_st', JSON.stringify(s), { silent: true }); });
    await zoomTo(1.3, 0.87, 0.7); await wait(300);
    const before = await win.evaluate(async () => { const st = await import('./js/state.js'); const N = await import('./js/catalog/nautica.js'); const b = window.__tz.state.preset.blocks.find((x) => x.id === window.__nx); const t = N.nxExpTarget(N.nxState(st.uiParams(b)), 1); const e = st.engineParamsFor(b); return { t, v: t && t.tg ? e[t.tg[0].s + '.' + N.nxModel(JSON.parse(b.params._st).slots[t.tg[0].s].m).knobs[t.tg[0].i].p] : null }; });
    const p = await ctlPt('exp2');
    await win.mouse.move(p.x, p.y + p.h * 0.3); await win.mouse.down(); await win.mouse.move(p.x, p.y - p.h * 0.3, { steps: 8 }); await win.mouse.up();
    await wait(300);
    const after = await win.evaluate(async () => { const st = await import('./js/state.js'); const N = await import('./js/catalog/nautica.js'); const b = window.__tz.state.preset.blocks.find((x) => x.id === window.__nx); const t = N.nxExpTarget(N.nxState(st.uiParams(b)), 1); const e = st.engineParamsFor(b); return { exp2: b.params.exp2, v: t && t.tg ? e[t.tg[0].s + '.' + N.nxModel(JSON.parse(b.params._st).slots[t.tg[0].s].m).knobs[t.tg[0].i].p] : null }; });
    ok(before.t && after.v !== before.v, `EXP 2 moves ${before.t && before.t.name}: ${before.v} -> ${after.v} (pedal ${after.exp2})`);
    const xl = await win.evaluate(() => window.__tz.editor.views.get(window.__nx).screens.find((q) => q.ctl.role === 'xlcd1').v.textContent);
    ok(xl === Math.round((await ui('exp2')) * 100) + '%', 'pedal LCD shows the pedal value ' + xl);
    // EXP 1 (volume pedal on a preset without wah) changes the volume stage
    const v1 = await win.evaluate(async () => { const st = await import('./js/state.js'); const b = window.__tz.state.preset.blocks.find((x) => x.id === window.__nx); st.setParam(b.id, 'exp1', 0.3); const e = st.engineParamsFor(b); return e['pv.pos']; });
    ok(Math.abs(v1 - 0.3) < 1e-6, 'EXP 1 drives the volume pedal: ' + v1);
    await win.evaluate(async () => { const st = await import('./js/state.js'); st.setParam(window.__nx, 'exp1', 1); });
    await win.screenshot({ path: path.join(out, 'treadles.png') });
  }

  // ---- 7. I/O LEDs respond to level
  {
    const r = await win.evaluate(() => {
      const T = window.__tz, v = T.editor.views.get(window.__nx), s = v.screens.find((q) => q.ctl.role === 'io');
      const read = () => s.bars.map((b) => b.rects.map((x) => +(x.getAttribute('fill-opacity') || 0)));
      T.state.status.blocks[window.__nx] = Object.assign({}, T.state.status.blocks[window.__nx], { io: { in: [0, 0, 0, 0, 0, 0, 0], out: new Array(19).fill(0) } });
      v.updateStatus(performance.now());
      const lo = read();
      T.state.status.blocks[window.__nx].io = { in: [0.5, 0, 0, 0, 0, 0, 0], out: [0.4, 0.4].concat(new Array(17).fill(0.001)) };
      v.updateStatus(performance.now());
      const hi = read();
      const gi = s.bars.findIndex((b) => b.key === 'i0'), oi = s.bars.findIndex((b) => b.key === 'o0'), si = s.bars.findIndex((b) => b.key === 'o12');
      return { gLo: lo[gi][0], gHi: hi[gi][0], oLo: lo[oi][0], oHi: hi[oi][0], sHi: hi[si][0] };
    });
    ok(r.gHi > r.gLo + 0.3 && r.oHi > r.oLo + 0.3 && r.sHi < r.oHi, `I/O LEDs follow levels: guitar ${r.gLo} -> ${r.gHi}, stereo 1 ${r.oLo} -> ${r.oHi}, send 1 ${r.sHi}`);
  }
  // LOD bitmap
  {
    const lod = await win.evaluate(async () => { const v = window.__tz.editor.views.get(window.__nx); return await v.makeLOD(0.35); });
    ok(lod, 'LOD bitmap renders');
  }

  // ---- 8. offline render: not silent, and the engine reports per-jack levels
  {
    const di = makeDI(path.join(out, 'di.wav'));
    const r = await win.evaluate(async (di) => {
      const st = await import('./js/state.js');
      const b = window.__tz.state.preset.blocks.find((x) => x.id === window.__nx);
      const s = JSON.parse(b.params._st); s.mode = 0;
      st.setParam(b.id, '_st', JSON.stringify(s), { silent: true });
      const g = window.__tz.buildGraph(window.__tz.state.preset);
      const wav = await window.tz.offline.render(g, di);
      return { wav, g };
    }, path.join(out, 'di.wav'));
    let m = null;
    try { m = measure(r.wav); } catch (e) { console.log('measure', e.message); }
    ok(m && m.lufs > -40, 'offline render is not silent: ' + (m ? m.lufs + ' LUFS, peak ' + m.peak : 'no audio'));
    fs.writeFileSync(path.join(out, 'graph.json'), JSON.stringify(r.g));
    const bin = ['v3', 'v2'].map((v) => path.join(__dirname, '..', '..', 'engine', 'dist', 'tonezone-engine-' + v)).find((p) => fs.existsSync(p));
    const rr = spawnSync(bin, ['--offline', path.join(out, 'graph.json'), di, path.join(out, 'eng.wav')], { encoding: 'utf8' });
    const txt = (rr.stdout || '') + '\n' + (rr.stderr || '');
    const line = txt.split('\n').find((l) => l.startsWith('status:'));
    const io = line && JSON.parse(line.slice(7))[id] && JSON.parse(line.slice(7))[id].io;
    ok(io && io.in[0] > 0.01 && io.out[4] > 0.001, 'engine status reports jack levels: in ' + (io && io.in[0]) + ' out 1 L ' + (io && io.out[4]));
    void di;
  }
  ok(errs.length === 0, 'no console errors\n' + errs.join('\n'));
  console.log(fails ? `${fails} FAILED` : 'all passed', ' pages shot:', pages.join(' '));
  await app.close();
  process.exit(fails ? 1 : 0);
})();
