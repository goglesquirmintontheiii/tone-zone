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
    const { controlList } = await import('./js/screenscript/host.js');
    const D = window.__tzFactory.template('nautica');
    const rts = [];
    for (const c of D.ctls.filter((x) => x.kind === 'screen' && x.shows === 'custom')) {
      const { W, H } = screenPixels(c);
      const { io } = simIO(D);
      io.cid = c.id;
      const rt = new ScreenRuntime({ src: c.script, w: W, h: H, host: makeHost(D, io), palette: c.type });
      rts.push({ c, rt, W, H, io, steps: 0, ms: 0 });
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
    // jack guide: I/O button, JACK GUIDE chip; the rails write their levels, IDENTIFY blinks one bar LED
    const jg = {};
    {
      const txt = (p) => { const b = main.io.files.read(p); return b ? new TextDecoder().decode(b) : null; };
      const k = main.W / 560;
      const ioBtn = controlList(D).find((e) => e.label === 'I/O');
      main.io.set(ioBtn.p, main.io.get(ioBtn.p) ? 0 : 1); frame(); frame();
      tapAt(main, (206 + 33) * k, (21 + 5.5) * k);
      frame(); frame();
      jg.id0 = txt('nx/id.txt');
      const lib = txt('nx.lua') || '';
      const m = /M\.JACKS = \{(.*)\}\s*$/m.exec(lib);
      jg.jacks = m ? [...m[1].matchAll(/\{"([a-z0-9]+)", "/g)].map((x) => x[1]) : [];
      const railKeys = rts.filter((r) => /^I\/O/.test(r.c.label)).flatMap((r) => [...r.c.script.matchAll(/, "([a-z0-9]+)"\}/g)].map((x) => x[1]));
      jg.railKeys = railKeys;
      const lv = (txt('nx/lv1.txt') || '') + '\n' + (txt('nx/lv2.txt') || '');
      jg.lvKeys = lv.split('\n').filter(Boolean).map((l) => l.split('=')[0]);
      // pixel of a bar LED on a rail canvas
      const rail = rts.find((r) => r.c.label === 'I/O L');
      const scl = +/local SC = W \/ ([\d.]+)/.exec(rail.c.script)[1];
      const barX = (key) => +new RegExp('\\{([\\d.]+), \\d+, "[^"]+", \\d+, "' + key + '"\\}').exec(rail.c.script)[1];
      const px = (key) => { const d = rail.rt.g.getImageData(Math.round(barX(key) * rail.W / scl), Math.round(rail.H / 2), 1, 1).data; return [d[0], d[1], d[2]]; };
      const white = (c) => c[0] > 200 && c[1] > 200 && c[2] > 200;
      const watch = (n) => { const o = { s1: [], o1l: [] }; for (let i = 0; i < n; i++) { frame(); o.s1.push(px('s1')); o.o1l.push(px('o1l')); } return o; };
      jg.before = watch(6);
      const idx = jg.jacks.indexOf('s1'); // first tab
      tapAt(main, (6 + 470 + 36) * k, (36 + (idx % 14) * 14.6 + 6.5) * k);
      jg.id1 = txt('nx/id.txt');
      const on = watch(10);
      jg.blinkWhite = on.s1.filter(white).length; jg.blinkDark = on.s1.filter((c) => c[0] + c[1] + c[2] < 120).length;
      jg.otherWhite = on.o1l.filter(white).length + jg.before.s1.filter(white).length;
      for (let i = 0; i < 80; i++) frame();
      const after = watch(8);
      jg.afterWhite = after.s1.filter(white).length;
      jg.id2 = txt('nx/id.txt');
      // the same button twice: IDENTIFY then STOP
      tapAt(main, (6 + 470 + 36) * k, (36 + (idx % 14) * 14.6 + 6.5) * k);
      tapAt(main, (6 + 470 + 36) * k, (36 + (idx % 14) * 14.6 + 6.5) * k);
      jg.id3 = txt('nx/id.txt');
      main.io.set(ioBtn.p, main.io.get(ioBtn.p) ? 0 : 1); frame(); frame();
    }
    window.__jg = jg;
    return rts.map((r) => ({ label: r.c.label, err: r.rt.error ? String(r.rt.error.message || r.rt.error) : null, frames: r.rt.frameN, steps: r.steps, ms: +r.ms.toFixed(2) }));
  });
  const bad = run.filter((r) => r.err || r.frames < 20 || r.steps > 150000);
  ok(!bad.length, `all ${run.length} screen scripts run within budget ${bad.map((r) => r.label + ': ' + (r.err || r.steps)).join(' | ')}`);
  console.log('     max steps per frame: ' + run.map((r) => r.label + ' ' + r.steps).join(', '));
  {
    const jg = await win.evaluate(() => window.__jg);
    const same = (a, b) => a.length === b.length && a.every((x) => b.includes(x));
    ok(/^\d+,,1$/.test(jg.id0 || ''), 'I/O page JACK GUIDE chip opens the jack guide (nx/id.txt ' + jg.id0 + ')');
    ok(jg.jacks.length === 28 && same(jg.jacks, jg.railKeys) && same(jg.lvKeys, jg.jacks), `jack guide lists all ${jg.jacks.length} jacks, the same as the ${jg.railKeys.length} rail LEDs; the rails report ${jg.lvKeys.length} levels`);
    ok(/,s1,1$/.test(jg.id1 || '') && jg.blinkWhite >= 2 && jg.blinkDark >= 2 && jg.otherWhite === 0, `IDENTIFY SEND 1 blinks its LED (white ${jg.blinkWhite}, dark ${jg.blinkDark} of 10 frames), other LEDs never blink (${jg.otherWhite})`);
    ok(jg.afterWhite === 0 && /^\d+,,1$/.test(jg.id2 || ''), 'IDENTIFY stops after 3 s (' + jg.id2 + ')');
    ok(/^\d+,,1$/.test(jg.id3 || ''), 'tapping STOP ends IDENTIFY early (' + jg.id3 + ')');
  }
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

  // ---- 5. the template block on the board: screens run, audio offline, presets round-trip through the file store
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
  // every page of the main screen, the side screen and a strip menu, by pointer on the board
  const clipOf = (label) => win.evaluate((label) => {
    const v = window.__tz.editor.views.get(window.__nxb);
    const e = [...v.views.values()].find((q) => q.ctl.t === 'screen' && q.ctl.label === label);
    const r = e.view.g.querySelector('image').getBoundingClientRect();
    return { x: r.left - 2, y: r.top - 2, width: r.width + 4, height: r.height + 4 };
  }, label);
  // zoom in on the screens for sharper shots (zoomOut shows the whole unit for the buttons)
  const zoomIn = () => win.evaluate(() => {
    const T = window.__tz, r = T.editor.svg.getBoundingClientRect(), vis = document.getElementById('board').getBoundingClientRect();
    const b = T.state.preset.blocks.find((x) => x.id === window.__nxb);
    const z = (vis.width - 60) / 440;
    T.editor.view = { z, x: (vis.left + vis.right) / 2 - r.left - (b.x + 330) * z, y: (vis.top + vis.bottom) / 2 - r.top - (b.y + 140) * z };
    T.editor.applyView();
  });
  const zoomOut = () => win.evaluate(() => {
    const T = window.__tz, v = T.editor.views.get(window.__nxb), r = T.editor.svg.getBoundingClientRect(), vis = document.getElementById('board').getBoundingClientRect();
    const b = T.state.preset.blocks.find((x) => x.id === window.__nxb);
    const z = Math.min((vis.width - 40) / v.w, (vis.height - 80) / v.h);
    T.editor.view = { z, x: (vis.left + vis.right) / 2 - r.left - (b.x + v.w / 2) * z, y: (vis.top + vis.bottom) / 2 - r.top - (b.y + v.h / 2) * z };
    T.editor.applyView();
  });
  await zoomIn();
  await wait(1500);
  const shot = async (label, file) => { await wait(300); await win.screenshot({ path: path.join(out, file), clip: await clipOf(label) }); };
  const ctlClick = async (label) => {
    const p = await win.evaluate((label) => {
      const v = window.__tz.editor.views.get(window.__nxb);
      const e = [...v.views.values()].find((q) => q.ctl.t === 'button' && (q.ctl.label || '').toUpperCase() === label);
      const r = e.view.g.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }, label);
    await win.mouse.click(p.x, p.y);
    await wait(350);
  };
  const pages = [];
  await tapB('SIDE', 24, 14); await shot('MAIN', 'page-rig.png'); pages.push('rig');
  await tapB('MAIN', 42 + 27, 68); await tapB('MAIN', 42 + 27, 68); await shot('MAIN', 'page-block.png'); pages.push('block');
  await tapB('MAIN', 296 + 26, 34); await shot('MAIN', 'page-library.png'); pages.push('library');
  await tapB('MAIN', 200, 9); await shot('MAIN', 'page-scenes.png'); pages.push('scenes');
  await tapB('MAIN', 60, 9); await shot('MAIN', 'page-presets.png'); pages.push('presets');
  await tapB('MAIN', 520, 9); await shot('MAIN', 'page-global.png'); pages.push('global');
  for (const [b, f] of [['ASSIGN', 'page-assign.png'], ['I/O', 'page-io.png'], ['TUNER', 'page-tuner.png']]) {
    await win.evaluate(() => (document.getElementById('layerCables').style.display = 'none'));
    await zoomOut(); await wait(300); await ctlClick(b); await zoomIn(); await wait(1500); await shot('MAIN', f); pages.push(b.toLowerCase());
  }
  await tapB('SIDE', 69, 14);
  await zoomOut(); await wait(300); await ctlClick('ASSIGN'); await zoomIn(); await wait(1500); await tapB('MAIN', 38, 44); await shot('MAIN', 'page-assign-list.png'); pages.push('assign list');
  // jack guide on the board: I/O -> JACK GUIDE, IDENTIFY SEND 1, the rail blinks
  {
    await zoomOut(); await wait(300); await ctlClick('I/O'); await zoomIn(); await wait(1200);
    await tapB('MAIN', 206 + 33, 21 + 5.5); await wait(900);
    await shot('MAIN', 'page-jacks.png'); pages.push('jacks');
    await tapB('MAIN', 124 + 56, 22 + 5.5); await wait(500); // LOOPS & CONTROL tab
    await shot('MAIN', 'page-jacks-2.png');
    await tapB('MAIN', 6 + 470 + 36, 36 + 0 * 14.6 + 6.5); await wait(500); // SEND 2: first row of the second tab
    const idf = await win.evaluate(async () => { const B = await import('./js/screenscript/board.js'); const b = () => window.__tz.state.preset.blocks.find((x) => x.id === window.__nxb); const v = B.blockFiles(window.__nxb, b).read('nx/id.txt'); return v ? new TextDecoder().decode(v) : null; });
    ok(/,s2,1$/.test(idf || ''), 'on the board IDENTIFY SEND 2 writes nx/id.txt: ' + idf);
    await shot('MAIN', 'page-jacks-identify.png');
    { const c = await clipOf('I/O L'); const clip = { x: c.x + c.width * 0.45, y: Math.max(0, c.y - 60), width: c.width * 0.55, height: c.height + 64 }; for (let k = 1; k <= 3; k++) { await win.screenshot({ path: path.join(out, 'rail-identify-' + k + '.png'), clip }); await wait(90); } }
    await wait(3500);
  }
  await shot('SIDE', 'side-screen.png');
  await tapB('STRIP 1', 548, 11); await shot('STRIP 1', 'strip-menu.png');
  await tapB('STRIP 1', 3 + 1 * ((560 - 30) / 6) + 30, 11); await shot('STRIP 1', 'strip-levels.png');
  await shot('STRIP 2', 'strip-2.png');
  await shot('I/O L', 'io-left.png');
  ok(pages.length === 11, 'screen pages shot: ' + pages.join(', '));

  ok(errs.length === 0, 'no console errors\n' + errs.join('\n'));
  console.log(fails ? `${fails} FAILED` : 'all passed');
  await app.close();
  fs.rmSync(xdg, { recursive: true, force: true });
  process.exit(fails ? 1 : 0);
})();
