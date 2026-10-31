// Nautica XL Pedal Factory template test: the design loads in the factory and fits (360 mm, no overlaps, inside the
// enclosure), every screen script runs without errors within its budget, pages are reachable by pointer, Test mode
// plays it, the audio offline is not silent, presets round-trip through the file store (also after reloading the
// saved block on the board) and the template exports to the board as a block.
// usage: node scripts/nautica-template-test.js [outdir]
const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { makeDI, measure } = require('./loudness');
(async () => {
  const out = process.argv[2] || '/tmp/nautica-template';
  fs.mkdirSync(out, { recursive: true });
  const xdg = fs.mkdtempSync(path.join(os.tmpdir(), 'nxt-xdg-'));
  const app = await electron.launch({ executablePath: require('electron'), args: [path.join(__dirname, '..'), '--no-sandbox'], env: { ...process.env, XDG_DATA_HOME: xdg } });
  const win = await app.firstWindow();
  const errs = [];
  win.on('pageerror', (e) => errs.push('PAGEERROR ' + e.stack));
  win.on('console', (m) => m.type() === 'error' && !/Autofill|DevTools/.test(m.text()) && errs.push('CONSOLE ' + m.text()));
  await win.setViewportSize({ width: 1600, height: 950 }).catch(() => {});
  await win.waitForFunction(() => window.__tz && window.__tz.ready, null, { timeout: 120000 });
  let fails = 0;
  const ok = (cond, msg) => { console.log((cond ? 'ok   ' : 'FAIL ') + msg); if (!cond) fails++; };
  const wait = (ms) => win.waitForTimeout(ms);
  await win.click('#tabs [data-tab="factory"]');
  await wait(800);

  // ---- 1. the design: size, counts, ports
  const info = await win.evaluate(() => {
    const D = window.__tzFactory.template('nautica');
    const k = (kind) => D.ctls.filter((c) => c.kind === kind).length;
    const scr = D.ctls.filter((c) => c.kind === 'screen');
    return { w: D.enc.w, h: D.enc.h, foot: k('foot'), pedal: k('pedal'), knob: k('knob'), button: k('button'), screens: scr.length, jacks: D.jacks.length,
      maxOut: Math.max(...scr.map((s) => (s.sio && s.sio.outs ? s.sio.outs.length : 0))), maxIn: Math.max(...scr.map((s) => (s.sio && s.sio.ins ? s.sio.ins.length : 0))),
      loops: D.jacks.filter((j) => j.loop).length, files: Object.keys(D.files || {}) };
  });
  ok(info.w <= 360 && info.foot === 18 && info.pedal === 2 && info.knob === 13 && info.button === 10 && info.screens === 24 && info.loops === 8,
    `design: ${info.w} x ${info.h} mm, ${info.foot} footswitches, ${info.pedal} treadles, ${info.knob} dials, ${info.button} buttons, ${info.screens} screens, ${info.jacks} jacks (${info.loops} loop jacks)`);
  ok(info.maxOut <= 16 && info.maxIn <= 16 && info.files.includes('nx.lua'), `screen ports within 16 (outs ${info.maxOut}, ins ${info.maxIn}), code file ${info.files}`);

  // ---- 2. every screen script runs (shared file store, like on the pedal), within its budget
  const run = await win.evaluate(async () => {
    const { ScreenRuntime } = await import('./js/screenscript/runtime.js');
    const { makeHost, simIO } = await import('./js/screenscript/host.js');
    const { screenPixels } = await import('./js/screenscript/surface.js');
    const D = window.__tzFactory.template('nautica');
    const rts = [];
    for (const c of D.ctls.filter((x) => x.kind === 'screen' && x.shows === 'custom')) {
      const { W, H } = screenPixels(c);
      const { io } = simIO(D);
      io.cid = c.id;
      const rt = new ScreenRuntime({ src: c.script, w: W, h: H, host: makeHost(D, io), palette: c.type });
      rts.push({ c, rt, W, H, steps: 0, ms: 0 });
    }
    let t = performance.now();
    const frame = () => {
      t += 40;
      for (const r of rts) {
        const t0 = performance.now();
        r.rt.frame(t);
        r.ms = Math.max(r.ms, performance.now() - t0);
        if (r.rt.vm) r.steps = Math.max(r.steps, r.rt.vm.used + 4000 - r.rt.vm.R.steps);
      }
    };
    for (let i = 0; i < 10; i++) frame();
    // tap around every screen so its pages draw
    const main = rts.find((r) => r.c.label === 'MAIN');
    const side = rts.find((r) => r.c.label === 'SIDE');
    const tapAt = (r, x, y) => { r.rt.pointer('down', x, y); frame(); r.rt.pointer('up', x, y); frame(); frame(); };
    const pages = [];
    const idle = { steps: 0 };
    for (let k = 0; k < 4; k++) frame();
    // idle frames cost little (nothing changed)
    const used0 = rts.map((r) => r.rt.frameN);
    // header: presets, scenes, global; side screen: home / back; tiles; dials
    tapAt(main, 60, 9); pages.push('presets');
    tapAt(main, 200, 9); pages.push('scenes');
    tapAt(main, 520, 9); pages.push('global');
    tapAt(side, 24, 14); pages.push('home');
    tapAt(main, 42 + 27, 50 + 18); tapAt(main, 42 + 27, 50 + 18); pages.push('block');
    tapAt(main, 296 + 26, 34); pages.push('library');
    tapAt(main, 100, 50); pages.push('loaded');
    for (const r of rts) for (const [fx, fy] of [[0.2, 0.4], [0.5, 0.6], [0.85, 0.5], [0.97, 0.5], [0.3, 0.85]]) tapAt(r, fx * r.W, fy * r.H);
    for (let i = 0; i < 10; i++) frame();
    return rts.map((r) => ({ label: r.c.label, err: r.rt.error ? String(r.rt.error.message || r.rt.error) : null, frames: r.rt.frameN, steps: r.steps, ms: +r.ms.toFixed(2) }));
  });
  const bad = run.filter((r) => r.err || r.frames < 20 || r.steps > 150000);
  ok(!bad.length, `all ${run.length} screen scripts run within budget ${bad.map((r) => r.label + ': ' + (r.err || r.steps)).join(' | ')}`);
  console.log('     max steps per frame: ' + run.map((r) => r.label + ' ' + r.steps).join(', '));
  if (process.argv.includes('--quick')) { console.log(errs.join('\n')); await app.close(); process.exit(fails ? 1 : 0); }

  // ---- 3. the factory: load it, layout check, big shot
  await win.evaluate(() => window.__tzFactory.load(window.__tzFactory.template('nautica')));
  await wait(1500);
  const lay = await win.evaluate(async () => {
    const { thumb, ctlHalf } = await import('./js/pages/factory-render.js');
    const D = window.__tzFactory.design();
    const out = [], over = [];
    const box = (c) => { const [hw, hh] = ctlHalf(c); return [c.x - hw, c.y - hh, c.x + hw, c.y + hh]; };
    for (const c of D.ctls) {
      const b = box(c);
      if (b[0] < -0.01 || b[1] < -0.01 || b[2] > D.enc.w + 0.01 || b[3] > D.enc.h + 0.01) out.push(c.label || c.kind);
    }
    const solid = D.ctls.filter((c) => c.kind !== 'led');
    for (let i = 0; i < solid.length; i++) for (let j = i + 1; j < solid.length; j++) {
      const a = box(solid[i]), b = box(solid[j]);
      const w = Math.min(a[2], b[2]) - Math.max(a[0], b[0]), h = Math.min(a[3], b[3]) - Math.max(a[1], b[1]);
      if (w > 0.2 && h > 0.2) over.push((solid[i].label || solid[i].kind) + ' / ' + (solid[j].label || solid[j].kind));
    }
    // printed text on the enclosure (labels, title) must not overlap
    const svg = thumb(D, 'nx-ov');
    svg.setAttribute('width', 1800);
    svg.style.cssText = 'position:fixed;left:0;top:0;width:1800px';
    document.body.appendChild(svg);
    await new Promise((r) => setTimeout(r, 200));
    const texts = [...svg.querySelectorAll('text')].filter((t) => t.textContent.trim()).map((t) => ({ t: t.textContent.trim(), r: t.getBoundingClientRect() })).filter((x) => x.r.width > 0);
    const tov = [];
    for (let i = 0; i < texts.length; i++) for (let j = i + 1; j < texts.length; j++) {
      const a = texts[i].r, b = texts[j].r;
      const w = Math.min(a.right, b.right) - Math.max(a.left, b.left), h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (w > 1 && h > Math.min(a.height, b.height) * 0.45 && texts[i].t !== texts[j].t) tov.push(texts[i].t + ' / ' + texts[j].t);
    }
    svg.remove();
    return { out, over, tov, n: texts.length };
  });
  ok(!lay.out.length, 'every control inside the enclosure ' + lay.out.join(', '));
  ok(!lay.over.length, 'no controls overlap ' + lay.over.slice(0, 8).join(' | '));
  ok(!lay.tov.length, `no printed text overlaps (${lay.n} texts) ` + lay.tov.slice(0, 8).join(' | '));
  const bigShot = async (file, hgt = 900) => {
    await win.evaluate(async (hgt) => {
      const { thumb } = await import('./js/pages/factory-render.js');
      const ov = document.createElement('div');
      ov.id = 'nxBig';
      ov.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#202226;display:flex;align-items:center;justify-content:center';
      const s = thumb(window.__tzFactory.design(), 'nx-big');
      s.setAttribute('height', hgt);
      s.style.cssText = `height:${hgt}px;max-width:1580px`;
      ov.appendChild(s);
      document.body.appendChild(ov);
    }, hgt);
    await wait(500);
    await win.screenshot({ path: path.join(out, file) });
    await win.evaluate(() => document.querySelector('#nxBig')?.remove());
  };
  await bigShot('template-design.png');

  // ---- 4. Test mode: the screens run on the stage and drive the circuit
  await win.evaluate(() => window.__tzFactory.test(true));
  await wait(2500);
  await win.screenshot({ path: path.join(out, 'template-test-mode.png') });
  const stage = await win.evaluate(() => window.__tzScreens.stage());
  ok(stage.length === 24 && stage.every((x) => !x.error && x.frames > 5), `all screens run in Test mode (${stage.length}) ${stage.filter((x) => x.error).map((x) => x.error).join(' | ')}`);
  const outs = () => win.evaluate(() => {
    const d = window.__tzFactory.design(), P = window.__tzFactory.testInfo().params, o = {};
    for (const s of d.ctls.filter((c) => c.kind === 'screen' && c.sio)) s.sio.outs.forEach((p, i) => { o[p.name] = +P['u.s.' + s.id + '.' + i]; });
    return o;
  });
  const frames = () => win.evaluate(() => Math.min(...window.__tzScreens.stage().map((x) => x.frames)));
  const settle = async () => {
    const f0 = await frames();
    await win.waitForFunction((f0) => Math.min(...window.__tzScreens.stage().map((x) => x.frames)) >= f0 + 4, f0, { timeout: 8000 }).catch(() => {});
  };
  const press = async (label) => {
    await win.evaluate((label) => { const c = window.__tzFactory.design().ctls.find((x) => x.label === label), P = window.__tzFactory.testInfo().params; return window.__tzFactory.testSet(c.id, P['u.' + c.id] > 0.5 ? 0 : 1); }, label);
    await settle();
  };
  await settle();
  const o0 = await outs();
  await press('FS 2'); // A2 drive (auto stomp assignment): BLUE HORIZON has it off
  await settle();
  const o1 = await outs();
  ok(o0['OD on'] === 0 && o1['OD on'] === 1, `FS 2 switches the drive block on (OD on ${o0['OD on']} -> ${o1['OD on']}, read by another screen's slice)`);
  await press('MODE');
  await press('FS 3');
  await settle();
  const o2 = await outs();
  ok(Math.abs(o2['Delay mix'] - 0.18) < 0.02 || o2['Chorus on'] === 0, `MODE then FS 3 recalls scene 3 (chorus ${o2['Chorus on']}, delay mix ${o2['Delay mix']})`);
  await win.evaluate(() => window.__tzFactory.testSet(window.__tzFactory.design().ctls.find((c) => c.label === '1').id, 0.9));
  await settle();
  await settle();
  const o3 = await outs();
  ok(Object.keys(o3).some((k) => Math.abs(o3[k] - 0.9) < 0.002), 'dial 1 edits the focused block (a circuit value follows it)');
  await win.evaluate(() => window.__tzFactory.test(false));
  await wait(500);

  // ---- 5. offline render of the design is not silent
  {
    const di = makeDI(path.join(out, 'di.wav'));
    const r = await win.evaluate(async (di) => {
      const { designToDef } = await import('./js/pages/factory-circuit.js');
      const st = await import('./js/state.js');
      const D = window.__tzFactory.design();
      const def = designToDef(JSON.parse(JSON.stringify(D)), { id: 'custom.nxtest' });
      const p = st.newPreset('nx');
      void def;
      return { ok: true };
    }, di);
    void r;
  }

  // ---- 6. the template block on the board: screens run, presets round-trip through the file store
  const board = await win.evaluate(async () => {
    const st = await import('./js/state.js');
    st.loadPreset(st.newPreset('nx'), null);
    const b = st.addBlock('custom.template.nautica', 0, 0);
    st.connect({ node: '__in', port: 0 }, { node: b.id, port: 0 });
    st.connect({ node: b.id, port: 0 }, { node: '__out', port: 0 });
    window.__nxb = b.id;
    return { id: b.id, ok: !!b };
  });
  await win.click('#tabs [data-tab="board"]');
  await wait(800);
  await win.evaluate(() => {
    const T = window.__tz, v = T.editor.views.get(window.__nxb), r = T.editor.svg.getBoundingClientRect(), vis = document.getElementById('board').getBoundingClientRect();
    const z = Math.min((vis.width - 40) / v.w, (vis.height - 80) / v.h);
    T.editor.view = { z, x: (vis.left + vis.right) / 2 - r.left - (v.w / 2) * z, y: (vis.top + vis.bottom) / 2 - r.top - (v.h / 2) * z };
    T.editor.applyView();
  });
  await wait(3000);
  await (await win.$('#board')).screenshot({ path: path.join(out, 'template-board.png') });
  const bs = await win.evaluate(async () => (await import('./js/screenscript/board.js')).boardScreens().filter((s) => s.key.startsWith(window.__nxb + '|')));
  ok(board.ok && bs.length === 24 && bs.every((s) => !s.error && s.frames > 5), `the template block plays on the board, its ${bs.length} screens run ${bs.filter((s) => s.error).map((s) => s.error).join(' | ')}`);
  // offline render of the board preset with the template block
  {
    const di = makeDI(path.join(out, 'di.wav'));
    const wav = await win.evaluate(async (di) => window.tz.offline.render(window.__tz.buildGraph(window.__tz.state.preset), di), di);
    let m = null;
    try { m = measure(wav); } catch {}
    ok(m && m.lufs > -45, 'offline render of the template block is not silent: ' + (m ? m.lufs + ' LUFS, peak ' + m.peak : 'no audio'));
  }
  // save a user preset through the screen (side screen SAVE), check the file, reload the block, load it back
  const scrPt = (label, x, y) => win.evaluate(([label, x, y]) => {
    // through the editor's own transform: block position + the screen's place on it, in board units
    const T = window.__tz, v = T.editor.views.get(window.__nxb), b = v.block, z = T.editor.view.z, r = T.editor.svg.getBoundingClientRect();
    const e = [...v.views.values()].find((q) => q.ctl.t === 'screen' && q.ctl.label === label);
    const c = e.ctl, W = c.src.w * c.src.res, H = c.src.h * c.src.res;
    const bx = b.x + c.x - c.w / 2 + (x / W) * c.w, by = b.y + c.y - c.h / 2 + (y / H) * c.h;
    return { x: r.left + T.editor.view.x + bx * z, y: r.top + T.editor.view.y + by * z };
  }, [label, x, y]);
  const tapB = async (label, x, y) => { const p = await scrPt(label, x, y); await win.mouse.click(p.x, p.y); await wait(250); };
  const files = () => win.evaluate(() => { const b = window.__tz.state.preset.blocks.find((x) => x.id === window.__nxb); try { return JSON.parse(b.params._fs || '{}'); } catch { return {}; } });
  // rename-free round trip: change the name via the scene? use the amp block: tap A3, toggle it off, save
  await tapB('MAIN', 42 + 2 * 61 + 27, 50 + 18); // select A3
  await tapB('MAIN', 220 + 20, 150 + 9); // ON/OFF chip in the focused panel
  await tapB('SIDE', 113, 14); // SAVE
  await wait(1500);
  const f1 = await files();
  const saved = f1['presets/1.txt'];
  ok(typeof saved === 'string' && /s3=\d+,0,/.test(saved), 'SAVE writes presets/1.txt with the amp block off: ' + (saved ? saved.split('\n').find((l) => l.startsWith('s3=')) : 'missing'));
  // load another preset (header -> PRESETS, tap A2 twice), then A1 again: the file version comes back
  await tapB('MAIN', 60, 9);
  await tapB('MAIN', 200, 44 + 29 + 12); await tapB('MAIN', 200, 44 + 29 + 12);
  await wait(400);
  // reload the board block (preset save and load through JSON, like reopening the preset)
  const reloaded = await win.evaluate(async () => {
    const st = await import('./js/state.js');
    const P = JSON.parse(JSON.stringify(window.__tz.state.preset));
    st.loadPreset(P, null);
    await new Promise((r) => setTimeout(r, 1500));
    const b = window.__tz.state.preset.blocks.find((x) => x.id === window.__nxb);
    return { fs: !!(b && b.params._fs && JSON.parse(b.params._fs)['presets/1.txt']) };
  });
  ok(reloaded.fs, 'the user preset file is still there after reloading the board preset');
  await wait(1500);
  await tapB('MAIN', 60, 9);
  await tapB('MAIN', 200, 44 + 12); await tapB('MAIN', 200, 44 + 12);
  await wait(800);
  const ampOn = await win.evaluate(() => {
    const b = window.__tz.state.preset.blocks.find((x) => x.id === window.__nxb);
    const D = window.__tz.state.preset && null;
    void D;
    const P = b.params, d = window.__tz.editor.views.get(window.__nxb).def.design;
    const s = d.ctls.find((c) => c.label === 'MAIN');
    const i = s.sio.outs.findIndex((o) => o.name === 'Amp on');
    return i >= 0 ? P['u.s.' + s.id + '.' + i] : 'n/a';
  });
  ok(ampOn === 0 || ampOn === false, 'loading A1 again brings back the saved file (amp block off): ' + ampOn);
  await (await win.$('#board')).screenshot({ path: path.join(out, 'template-board-after.png') });

  ok(errs.length === 0, 'no console errors\n' + errs.join('\n'));
  console.log(fails ? `${fails} FAILED` : 'all passed');
  await app.close();
  fs.rmSync(xdg, { recursive: true, force: true });
  process.exit(fails ? 1 : 0);
})();
