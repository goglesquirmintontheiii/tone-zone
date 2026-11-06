// Helix links: drag a Helix footswitch / EXP pedal onto a pedal on the board (real pointer events), overlays,
// on-screen and hardware presses, pedal links, save and reload, undo, removal, duplicate and delete rules.
// usage: node scripts/helix-link-test.js [screenshot dir]
const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');
const S = process.argv[2] || '/tmp/helix11';
fs.mkdirSync(S, { recursive: true });
let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };

(async () => {
  const app = await electron.launch({ executablePath: require('electron'), args: [path.join(__dirname, '..'), '--no-sandbox'] });
  const win = await app.firstWindow();
  const errs = [];
  win.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
  win.on('console', (m) => m.type() === 'error' && errs.push('console: ' + m.text()));
  await win.setViewportSize({ width: 1600, height: 950 }).catch(() => {});
  await win.waitForFunction(() => window.__tz && window.__tz.ready, null, { timeout: 90000 });
  await win.waitForTimeout(600);

  const ids = await win.evaluate(async () => {
    const st = await import('./js/state.js');
    st.loadPreset(st.newPreset('links'), null);
    await new Promise((r) => setTimeout(r, 300));
    const hx = st.addBlock('l6x.helix', 0, 0);
    const ts = st.addBlock('ib.ts9', 740, -20);
    const wah = st.addBlock('dn.gcb95', 740, 200);
    await new Promise((r) => setTimeout(r, 400));
    const E = window.__tz.editor;
    E.select([]);
    // live SVG (bitmaps below 50% zoom), everything in view
    const r = E.board.getBoundingClientRect();
    Object.assign(E.view, { z: 0.8, x: r.width / 2 - 470 * 0.8, y: r.height / 2 - 200 * 0.8 });
    E.applyView();
    await new Promise((r) => setTimeout(r, 600));
    const C = await import('./js/catalog/index.js');
    const hd = C.getDef('l6x.helix');
    return {
      hx: hx.id, ts: ts.id, wah: wah.id,
      fs1: hd.controls.filter((c) => c.t === 'foot')[0].cid,
      fs2: hd.controls.filter((c) => c.t === 'foot')[1].cid,
      exp: hd.controls.find((c) => c.t === 'treadle').cid,
      tsFoot: C.getDef('ib.ts9').controls.find((c) => c.t === 'foot').cid,
      wahTr: C.getDef('dn.gcb95').controls.find((c) => c.t === 'treadle').cid,
      z: E.view.z,
    };
  });
  console.log('zoom', ids.z.toFixed(2));
  const frame = () => { const E = window.__tz.editor, r = E.board.getBoundingClientRect(); Object.assign(E.view, { z: 0.8, x: r.width / 2 - 470 * 0.8, y: r.height / 2 - 200 * 0.8 }); E.applyView(); };
  const center = (node, cid) => win.evaluate(([n, c]) => {
    const el = document.querySelector(`[data-node="${n}"] [data-ctl="${c}"]`);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }, [node, cid]);
  const get = () => win.evaluate(async (I) => {
    const st = await import('./js/state.js');
    const hx = st.blockById(I.hx), ts = st.blockById(I.ts), wah = st.blockById(I.wah);
    return {
      binds: hx ? (hx.bindings || []).map((b) => ({ src: b.src, msg: b.msg, target: b.target, link: b.link })) : null,
      tsBypass: ts && ts.bypass, wahPos: wah && st.uiParams(wah).pos, fs0: hx && st.uiParams(hx)._fs0,
      ovTs: !!document.querySelector(`[data-node="${I.ts}"] .hxl-ring`), ovWah: !!document.querySelector(`[data-node="${I.wah}"] .hxl-ring`),
      marks: document.querySelectorAll(`[data-node="${I.hx}"] .hxl-mark`).length,
      dirty: st.state.dirty,
    };
  }, ids);
  const dragPath = async (a, b, { shotAt, steps = 14 } = {}) => {
    await win.mouse.move(a.x, a.y);
    await win.mouse.down();
    for (let i = 1; i <= steps; i++) {
      await win.mouse.move(a.x + ((b.x - a.x) * i) / steps, a.y + ((b.y - a.y) * i) / steps);
      await win.waitForTimeout(16);
    }
    if (shotAt) { await win.waitForTimeout(120); await win.screenshot({ path: shotAt }); }
    await win.mouse.up();
    await win.waitForTimeout(250);
  };

  // 1. a normal click on a Helix footswitch presses it and makes no link
  const f1 = await center(ids.hx, ids.fs1);
  let s0 = await get();
  await win.mouse.click(f1.x, f1.y);
  await win.waitForTimeout(200);
  let s = await get();
  ok(s.binds.length === 0, 'a normal click makes no link');
  ok((s.fs0 ?? 0) !== (s0.fs0 ?? 0), `the click still presses FS 1 (LED ${s0.fs0 ?? 0} -> ${s.fs0})`);
  // a small wobble (under the threshold) is still a click
  await win.mouse.move(f1.x, f1.y); await win.mouse.down(); await win.mouse.move(f1.x + 3, f1.y + 2); await win.mouse.up();
  await win.waitForTimeout(150);
  s = await get();
  ok(s.binds.length === 0 && (s.fs0 ?? 0) === (s0.fs0 ?? 0), 'a 3 px wobble is still a click (FS 1 back off, no link)');

  // 2. drag FS 1 onto the Tube Screamer's footswitch
  const tsF = await center(ids.ts, ids.tsFoot);
  await dragPath(f1, tsF, { shotAt: S + '/link-drag.png' });
  s = await get();
  ok(s.binds.length === 1 && s.binds[0].src === 'FS 1' && s.binds[0].target.block === ids.ts && s.binds[0].target.cid === ids.tsFoot, 'drag FS 1 -> TS footswitch makes a link');
  ok(s.binds[0] && s.binds[0].msg && s.binds[0].msg.t === 'cc' && s.binds[0].msg.n === 49, `link uses the factory CC (${JSON.stringify(s.binds[0] && s.binds[0].msg)})`);
  ok(s.ovTs && s.marks === 1, `overlay on the TS footswitch and a marker on the Helix (${s.ovTs}, ${s.marks})`);
  ok(s.fs0 === s0.fs0 || (s.fs0 ?? 0) === (s0.fs0 ?? 0), 'the link drag did not press FS 1');
  ok(s.dirty, 'preset marked as changed');

  // 3. clicking the Helix switch on screen presses the TS
  const b0 = s.tsBypass;
  await win.mouse.click(f1.x, f1.y);
  await win.waitForTimeout(250);
  s = await get();
  ok(s.tsBypass === !b0, `clicking Helix FS 1 toggles the TS (${b0} -> ${s.tsBypass})`);
  // 4. the hardware path (CC 49 from the unit)
  await win.evaluate(() => window.__hxInject([0xb0, 49, 127]));
  await win.waitForTimeout(250);
  s = await get();
  ok(s.tsBypass === b0, `CC 49 from the Helix toggles the TS back (${s.tsBypass})`);

  // 5. treadle: vertical drag still sweeps, sideways drag links to the wah treadle
  const ex = await center(ids.hx, ids.exp);
  const exp0 = await win.evaluate(async (I) => (await import('./js/state.js')).uiParams((await import('./js/state.js')).blockById(I.hx)).exp ?? 0, ids);
  await dragPath(ex, { x: ex.x, y: ex.y - 60 }, { steps: 6 });
  const exp1 = await win.evaluate(async (I) => (await import('./js/state.js')).uiParams((await import('./js/state.js')).blockById(I.hx)).exp ?? 0, ids);
  s = await get();
  ok(exp1 > exp0 + 0.05 && s.binds.length === 1, `dragging the Helix treadle up still moves it (${exp0.toFixed(2)} -> ${exp1.toFixed(2)}), no link`);
  const wt = await center(ids.wah, ids.wahTr);
  await dragPath(ex, wt);
  s = await get();
  const pl = s.binds.find((b) => b.src === 'EXP 1');
  ok(pl && pl.target.block === ids.wah && pl.target.cid === ids.wahTr && pl.msg && pl.msg.n === 1, 'drag EXP -> wah treadle makes a pedal link (CC 1)');
  ok(s.ovWah && s.marks === 2, `overlay on the wah treadle, 2 markers on the Helix (${s.ovWah}, ${s.marks})`);
  // undo / redo right after making the link
  await win.evaluate(async () => { const st = await import('./js/state.js'); st.undo(); });
  await win.waitForTimeout(400);
  s = await get();
  ok(s.binds.length === 1 && !s.ovWah && s.ovTs, `undo removes the pedal link and its overlay (${s.binds.length}, wah ${s.ovWah})`);
  await win.evaluate(async () => { const st = await import('./js/state.js'); st.redo(); });
  await win.waitForTimeout(400);
  s = await get();
  ok(s.binds.length === 2 && s.ovWah, 'redo brings it back');

  await win.evaluate(() => window.__hxInject([0xb0, 1, 100]));
  await win.waitForTimeout(150);
  s = await get();
  ok(Math.abs(s.wahPos - 100 / 127) < 0.02, `CC 1 from the Helix moves the wah (${s.wahPos && s.wahPos.toFixed(3)})`);
  await win.evaluate(async (I) => (await import('./js/state.js')).setParam(I.hx, 'exp', 0.3), ids);
  await win.waitForTimeout(150);
  s = await get();
  ok(Math.abs(s.wahPos - 0.3) < 0.02, `moving the on-screen Helix EXP moves the wah (${s.wahPos && s.wahPos.toFixed(3)})`);

  // 6. a mismatch (footswitch onto a treadle) is refused
  const f2 = await center(ids.hx, ids.fs2);
  await dragPath(f2, wt);
  s = await get();
  const toastTxt = await win.evaluate(() => [...document.querySelectorAll('.toast')].map((t) => t.textContent).join(' | '));
  ok(s.binds.length === 2 && /link to footswitches/.test(toastTxt), `FS 2 onto a treadle is refused with a hint (${toastTxt.slice(0, 90)})`);
  // dropping on empty board makes nothing
  await dragPath(f2, { x: f2.x, y: f2.y + 120 });
  s = await get();
  ok(s.binds.length === 2, 'dropping on empty board makes nothing');

  await win.mouse.move(5, 5);
  await win.waitForTimeout(300);
  await win.screenshot({ path: S + '/link-overlays.png' });
  // close-up of the overlays
  await win.evaluate(async (I) => {
    const E = window.__tz.editor;
    E.view.z = 1.6;
    const v = E.views.get(I.ts);
    const r = E.board.getBoundingClientRect();
    E.view.x = r.width / 2 - (v.block.x + v.w / 2) * 1.6;
    E.view.y = r.height / 2 - (v.block.y + 120) * 1.6;
    E.applyView();
  }, ids);
  await win.waitForTimeout(700);
  await win.screenshot({ path: S + '/link-overlays-zoom.png' });
  await win.evaluate(frame);
  await win.waitForTimeout(700);

  // 8. save and reload
  const re = await win.evaluate(async (I) => {
    const st = await import('./js/state.js');
    const p = st.serialize();
    p.name = 'helix link test';
    const file = await window.tz.presets.save(p, null);
    st.loadPreset(st.newPreset('other'), null);
    await new Promise((r) => setTimeout(r, 300));
    const p2 = await window.tz.presets.load(file);
    st.loadPreset(p2, file);
    await new Promise((r) => setTimeout(r, 900));
    const hx = st.blockById(I.hx);
    await window.tz.presets.remove(file);
    return { n: (hx && hx.bindings || []).length, ov: !!document.querySelector(`[data-node="${I.ts}"] .hxl-ring`) && !!document.querySelector(`[data-node="${I.wah}"] .hxl-ring`) };
  }, ids);
  ok(re.n === 2 && re.ov, `links and overlays survive save and reload (${re.n}, ${re.ov})`);
  await win.evaluate(frame);
  await win.waitForTimeout(600);
  // and still work after the reload
  s0 = await get();
  await win.evaluate(() => window.__hxInject([0xb0, 49, 127]));
  await win.waitForTimeout(200);
  s = await get();
  ok(s.tsBypass === !s0.tsBypass, 'reloaded link still works from the hardware path');

  // 9. right-click the overlay -> Remove link
  const badge = await win.evaluate((I) => { const r = document.querySelector(`[data-node="${I.ts}"] .hxl-badge`).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, ids);
  await win.mouse.click(badge.x, badge.y, { button: 'right' });
  await win.waitForTimeout(250);
  const menu = await win.evaluate(() => [...document.querySelectorAll('#menuLayer .ctx button')].map((b) => b.textContent));
  await win.screenshot({ path: S + '/link-menu.png' });
  ok(menu.some((t) => /Remove link from FS 1/.test(t)), `right-click on the overlay offers Remove link (${menu.join(', ')})`);
  await win.evaluate(() => [...document.querySelectorAll('#menuLayer .ctx button')].find((b) => /Remove link/.test(b.textContent)).click());
  await win.waitForTimeout(300);
  s = await get();
  ok(s.binds.length === 1 && s.binds[0].src === 'EXP 1' && !s.ovTs && s.marks === 1, 'Remove link removes it and its overlay');
  await win.evaluate(async () => (await import('./js/state.js')).undo());
  await win.waitForTimeout(400);
  s = await get();
  ok(s.binds.length === 2 && s.ovTs, 'undo brings the removed link back');

  // 10. inspector lists the links
  await win.evaluate((I) => window.__tz.editor.select([I.hx]), ids);
  await win.waitForTimeout(400);
  const insp = await win.evaluate(() => document.querySelectorAll('.hx-bind').length);
  ok(insp === 2, `inspector lists ${insp} links with remove buttons`);
  await win.evaluate(() => document.querySelector('.hx-bind').scrollIntoView());
  await win.waitForTimeout(200);
  await win.screenshot({ path: S + '/link-inspector.png' });

  // 11. duplicating keeps links with the original; deleting a pedal drops its link
  const dup = await win.evaluate(async (I) => {
    const st = await import('./js/state.js');
    const [nb] = st.duplicateBlocks([I.hx]);
    await new Promise((r) => setTimeout(r, 300));
    const out = { copy: (nb.bindings || []).length, orig: st.blockById(I.hx).bindings.length };
    st.removeBlocks([nb.id]);
    await new Promise((r) => setTimeout(r, 200));
    const [nt] = st.duplicateBlocks([I.ts]);
    await new Promise((r) => setTimeout(r, 300));
    out.tsCopyOv = !!document.querySelector(`[data-node="${nt.id}"] .hxl-ring`);
    st.removeBlocks([nt.id]);
    await new Promise((r) => setTimeout(r, 200));
    st.removeBlocks([I.wah]);
    await new Promise((r) => setTimeout(r, 300));
    out.afterDel = st.blockById(I.hx).bindings.map((b) => b.src);
    out.marks = document.querySelectorAll(`[data-node="${I.hx}"] .hxl-mark`).length;
    st.undo();
    await new Promise((r) => setTimeout(r, 400));
    out.afterUndo = st.blockById(I.hx).bindings.length;
    st.removeBlocks([I.hx]);
    await new Promise((r) => setTimeout(r, 300));
    out.tsOvAfterHxDel = !!document.querySelector(`[data-node="${I.ts}"] .hxl-ring`);
    st.undo();
    await new Promise((r) => setTimeout(r, 400));
    return out;
  }, ids);
  ok(dup.copy === 0 && dup.orig === 2, `a duplicated Helix starts without links, the original keeps them (${dup.copy}, ${dup.orig})`);
  ok(!dup.tsCopyOv, 'a duplicated pedal is not linked');
  ok(dup.afterDel.length === 1 && dup.afterDel[0] === 'FS 1' && dup.marks === 1, `deleting the wah removes its link (${dup.afterDel})`);
  ok(dup.afterUndo === 2, 'undo of the delete brings the link back');
  ok(!dup.tsOvAfterHxDel, 'deleting the Helix removes the overlays');

  // 12. block and cable dragging still work
  const mv = await win.evaluate(async (I) => {
    const v = window.__tz.editor.views.get(I.ts);
    const r = v.content.getBoundingClientRect();
    // a spot on the pedal body that is not a control or a jack
    for (let fy = 0.3; fy < 0.95; fy += 0.05) for (let fx = 0.2; fx < 0.8; fx += 0.1) {
      const x = r.left + r.width * fx, y = r.top + r.height * fy;
      const el = document.elementFromPoint(x, y);
      if (el && el.closest('[data-node]') === v.g && !el.closest('[data-ctl],[data-jack],.hxl')) return { x, y, bx: v.block.x, by: v.block.y };
    }
    return null;
  }, ids);
  await dragPath(mv, { x: mv.x + 60, y: mv.y + 30 }, { steps: 6 });
  const moved = await win.evaluate((I) => { const b = window.__tz.editor.views.get(I.ts).block; return { x: b.x, y: b.y }; }, ids);
  s = await get();
  ok(moved.x !== mv.bx && s.binds.length === 2, `the TS still drags as a block (${mv.bx},${mv.by} -> ${moved.x},${moved.y})`);
  await win.waitForTimeout(800);
  s = await get();
  ok(s.ovTs, 'its overlay follows the block');

  console.log(errs.join('\n') || 'no errors');
  console.log(fails ? `${fails} FAILED` : 'all passed');
  await app.close();
  process.exit(fails ? 1 : 0);
})();
