// The Advanced Command Center template: it loads in the Pedal Factory with every part the brief asks for, the
// layout keeps every control and label inside the enclosure with nothing overlapping, every control is wired
// (to the circuits, the screens or the screen code), both screens run their multi-file code without errors,
// presets save and recall through the pedal's files (offstage, and on the board across a preset reload and a
// fresh copy of the block), the circuits pass audio offline and the controls change the sound, and the design
// exports as a block that plays on the board.
// usage: node scripts/acc-test.js   (SHOTS=<dir> for the screenshots)
const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { makeDI, measure } = require('./loudness');
const { readWav } = require('../main/offline');
const S = process.env.SHOTS || '/tmp';
(async () => {
  const data = fs.mkdtempSync(path.join(os.tmpdir(), 'tz-acc-'));
  const app = await electron.launch({ executablePath: require('electron'), args: [path.join(__dirname, '..'), '--no-sandbox'], env: { ...process.env, XDG_DATA_HOME: data } });
  const win = await app.firstWindow();
  const errs = [];
  win.on('pageerror', (e) => errs.push('PAGEERROR ' + e.stack));
  win.on('console', (m) => (m.type() === 'error' ? errs.push('CONSOLE ' + m.text()) : process.env.FZ_LOG && console.log('page: ' + m.text())));
  await win.setViewportSize({ width: 1600, height: 950 }).catch(() => {});
  await win.waitForFunction(() => window.__tz && window.__tz.ready, null, { timeout: 120000 });
  let fails = 0;
  const ok = (cond, msg) => {
    console.log((cond ? 'ok   ' : 'FAIL ') + msg);
    if (!cond) fails++;
  };
  const D = () => win.evaluate(() => JSON.parse(JSON.stringify(window.__tzFactory.design())));

  // 1. the template loads from the gallery, with everything the brief asks for
  await win.click('#tabs [data-tab="factory"]');
  await win.waitForSelector('.fz-stage');
  await win.click('#fzTemplates');
  await win.click('[data-template="acc"]');
  await win.waitForTimeout(800);
  const d = await D();
  const n = (f) => d.ctls.filter(f).length;
  const kinds = {
    pedal: n((c) => c.kind === 'pedal'),
    ringEnc: n((c) => c.part === 'encoder' && c.ring),
    enc: n((c) => c.part === 'encoder' && !c.ring),
    foot: n((c) => c.kind === 'foot'),
    rgb: n((c) => c.kind === 'led' && c.look === 'rgb'),
    screens: n((c) => c.kind === 'screen' && c.shows === 'custom'),
    dips: d.ctls.filter((c) => c.kind === 'dip').reduce((a, c) => a + c.n, 0),
    xy: n((c) => c.kind === 'xy'),
    trim: n((c) => c.kind === 'trim'),
    knob: n((c) => c.kind === 'knob' && !c.part),
    led: n((c) => c.kind === 'led' && !['rgb', 'meter'].includes(c.look)),
    steps: n((c) => c.part === 'steps'),
    button: n((c) => c.kind === 'button'),
    slider: n((c) => c.kind === 'slider'),
    toggle3: n((c) => c.kind === 'toggle' && c.ways === 3),
    meter: n((c) => c.kind === 'led' && c.look === 'meter'),
  };
  const want = { pedal: 1, ringEnc: 2, enc: 4, foot: 6, rgb: 3, screens: 2, dips: 6, xy: 1, trim: 2, knob: 6, led: 6, steps: 1, button: 2, slider: 4, toggle3: 2, meter: 3 };
  const exact = ['pedal', 'ringEnc', 'enc', 'screens', 'xy', 'trim', 'button', 'slider', 'toggle3'];
  const short = Object.keys(want).filter((k) => (exact.includes(k) ? kinds[k] !== want[k] : kinds[k] < want[k]));
  ok(d.name === 'Advanced Command Center' && !short.length, `the template has every part: ${JSON.stringify(kinds)}${short.length ? ' short of ' + short.join(' ') : ''}`);
  ok(d.enc.w <= 360 && d.enc.h <= 260, `the enclosure is ${d.enc.w} x ${d.enc.h} mm (factory limit 360 mm)`);
  const fx = new Set(), STAGES = await win.evaluate(() => window.__tzFactory.stages());
  for (const i of d.circuit.insts) for (const nd of i.graph.nodes) if (STAGES.includes(nd.t) && nd.t !== 'level' && nd.t !== 'volume') fx.add(nd.t);
  ok(d.circuit.insts.length === 4 && fx.size >= 15, `four circuits (${d.circuit.insts.map((i) => i.name).join(', ')}) with ${fx.size} different effects: ${[...fx].join(' ')}`);
  const rings = d.ctls.filter((c) => c.part === 'encoder' && c.ring);
  ok(rings.every((c) => c.ringRgb && c.ringFrom && c.ringLeds && c.ringLeds.r && c.encSteps >= 4) && d.ctls.filter((c) => c.part === 'encoder').every((c) => c.encSteps >= 4), 'the LED ring encoders use RGB rings driven by the screens, every encoder clicks in steps');
  const files = Object.keys(d.files || {});
  ok(['lib/acc.lua', 'lib/bank.lua', 'lib/ui.lua', 'presets/factory.txt'].every((f) => files.includes(f)), `the pedal has its own files: ${files.join(', ')}`);

  // 2. layout: every control and label inside the enclosure, nothing overlapping
  const lay = await win.evaluate(async () => {
    const { thumb, ctlHalf } = await import('./js/pages/factory-render.js');
    const d = window.__tzFactory.design();
    await document.fonts.ready;
    const s = thumb(d, 'acc-measure');
    s.setAttribute('width', 1440);
    s.style.cssText = 'position:fixed;left:-4000px;top:0';
    document.body.appendChild(s);
    const boxes = [];
    for (const g of s.querySelectorAll('.fz-ctl')) {
      const c = d.ctls.find((x) => x.id === g.dataset.sel);
      if (!c) continue;
      const [hw, hh] = ctlHalf(c);
      boxes.push({ id: c.id, what: (c.label || c.kind) + ' (' + c.kind + ')', t: 'ctl', x0: c.x - hw, y0: c.y - hh, x1: c.x + hw, y1: c.y + hh });
      for (const t of g.querySelectorAll('text')) {
        if (!t.textContent.trim()) continue;
        // text drawn inside the part (a toggle's positions, step names) moves with its own transforms: measure on screen
        const r = t.getBoundingClientRect(), sr = s.getBoundingClientRect(), vb = s.viewBox.baseVal, k = vb.width / sr.width;
        boxes.push({ id: c.id, what: '"' + t.textContent + '" of ' + (c.label || c.kind), t: 'label', x0: vb.x + (r.left - sr.left) * k, y0: vb.y + (r.top - sr.top) * k, x1: vb.x + (r.right - sr.left) * k, y1: vb.y + (r.bottom - sr.top) * k });
      }
    }
    // the title
    for (const t of [d.title, d.sub]) if (!t.hidden && t.text) {
      const el = [...s.querySelectorAll('text')].find((x) => x.textContent === t.text);
      if (!el) continue;
      const r = el.getBoundingClientRect(), sr = s.getBoundingClientRect(), vb = s.viewBox.baseVal, k = vb.width / sr.width;
      boxes.push({ id: t.id, what: 'title', t: 'label', x0: vb.x + (r.left - sr.left) * k, y0: vb.y + (r.top - sr.top) * k, x1: vb.x + (r.right - sr.left) * k, y1: vb.y + (r.bottom - sr.top) * k });
    }
    s.remove();
    const W = d.enc.w, H = d.enc.h;
    const outside = boxes.filter((b) => b.x0 < -0.2 || b.y0 < -0.2 || b.x1 > W + 0.2 || b.y1 > H + 0.2).map((b) => b.what);
    const over = [];
    for (let i = 0; i < boxes.length; i++)
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i], b = boxes[j];
        if (a.id === b.id) continue;
        const ox = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0), oy = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
        if (ox > 0.15 && oy > 0.15) over.push(a.what + ' / ' + b.what + ' (' + ox.toFixed(1) + ' x ' + oy.toFixed(1) + ')');
      }
    return { n: boxes.length, labels: boxes.filter((b) => b.t === 'label').length, outside, over };
  });
  ok(lay.n > 80 && !lay.outside.length, `all ${lay.n} controls and labels are inside the enclosure${lay.outside.length ? ': outside ' + lay.outside.join(', ') : ''}`);
  ok(!lay.over.length, `no control or label overlaps another (${lay.labels} labels checked)${lay.over.length ? ': ' + lay.over.slice(0, 8).join('; ') : ''}`);

  // 3. wiring: every control drives a circuit input, a circuit's on / off, tap or bypass, or the screen code reads it
  const wiring = await win.evaluate(async () => {
    const F = await import('./js/pages/factory-circuit.js');
    const d = window.__tzFactory.design();
    const ins = new Set(d.circuit.insts.flatMap((i) => i.graph.nodes.filter((nd) => nd.t === 'analog' || nd.t === 'binary').map((nd) => i.id + '.' + nd.id)));
    const ons = new Set(d.circuit.insts.flatMap((i) => [i.id + '.on', i.id + '.tap']));
    const code = [...d.ctls.filter((c) => c.kind === 'screen').map((c) => c.script), ...Object.values(d.files || {}).filter((v) => typeof v === 'string')].join('\n');
    const used = (c) => !!c.label && code.includes('"' + c.label + '"');
    const goes = (m) => !!m && !!m.to && (m.to === 'bypass' || ins.has(m.to) || ons.has(m.to));
    // circuit inputs that drive nothing are not wiring: count each input's wires inside its circuit
    const live = (m) => {
      if (!m || !m.to || m.to === 'bypass' || ons.has(m.to)) return true;
      const [iid, nid] = m.to.split('.');
      const inst = d.circuit.insts.find((i) => i.id === iid);
      return !!inst && inst.graph.wires.some((w) => w.a.n === nid);
    };
    const bad = [];
    for (const c of d.ctls) {
      if (['led', 'screen'].includes(c.kind)) continue;
      const maps = [c.map, ...(c.maps || []), ...(c.more || [])].filter(Boolean);
      const wired = maps.length && maps.every(goes) && maps.some(live);
      // footswitches the screen code listens to are wired to an input of their own
      if (!(wired && (maps.some(live) || used(c))) && !used(c)) bad.push(c.label || c.kind);
      if (c.kind === 'dip' && !(c.maps || []).every((m) => goes(m) && live(m))) bad.push(c.label + ' (a switch)');
    }
    const outs = new Set(F.circuitOutputs(d).map((o) => o.key));
    const scr = d.ctls.filter((c) => c.kind === 'screen');
    const scrIds = new Set(scr.map((c) => c.id));
    const refOk = (r) => !!r && ((r.n && outs.has(r.n + '.' + r.p)) || (r.scr && scrIds.has(r.scr)) || !!r.ctl);
    const leds = d.ctls.filter((c) => c.kind === 'led');
    const ledBad = leds.filter((c) => {
      if (c.chans) return !Object.values(c.chans).every(refOk);
      if (c.bind === 'src') return !refOk(c.src);
      return !/^(on|ctl:|tap:)/.test(c.bind || '');
    }).map((c) => c.label || c.id);
    // screen outputs drive circuit inputs, or the rings, LEDs and the other screen read them
    const reads = new Set();
    for (const c of d.ctls) {
      for (const r of [c.src, c.ringFrom, ...Object.values(c.chans || {}), ...Object.values(c.ringLeds || {}), ...((c.sio && c.sio.ins) || []).map((p) => p.from)]) if (r && r.scr) reads.add(r.scr + ':' + r.o);
    }
    const outBad = scr.flatMap((c) => c.sio.outs.map((o, i) => ((o.maps || []).some((m) => ins.has(m.to)) || reads.has(c.id + ':' + i) ? null : c.label + ' ' + o.name))).filter(Boolean);
    const inBad = scr.flatMap((c) => c.sio.ins.filter((p) => !refOk(p.from)).map((p) => c.label + ' ' + p.name));
    let def = null;
    try {
      def = F.designToDef(d, { id: 'custom.acccheck' });
    } catch (e) {
      def = { err: e.message };
    }
    return { bad, ledBad, outBad, inBad, leds: leds.length, outs: scr.reduce((a, c) => a + c.sio.outs.length, 0), def: !!(def && def.controls), err: def && def.err };
  });
  ok(!wiring.bad.length, `every control is wired to the circuits or read by the screen code${wiring.bad.length ? ': not ' + wiring.bad.join(', ') : ''}`);
  ok(!wiring.ledBad.length && !wiring.inBad.length, `all ${wiring.leds} LEDs and every screen input have a source${wiring.ledBad.concat(wiring.inBad).length ? ': ' + wiring.ledBad.concat(wiring.inBad).join(', ') : ''}`);
  ok(!wiring.outBad.length, `all ${wiring.outs} screen outputs drive the circuits, the rings or the LEDs${wiring.outBad.length ? ': not ' + wiring.outBad.join(', ') : ''}`);
  ok(wiring.def, 'the design compiles to a block ' + (wiring.err || ''));

  // 4. both screens offstage, sharing one file store: they run within budget, and presets round trip through fs
  const off = await win.evaluate(async () => {
    const { ScreenRuntime } = await import('./js/screenscript/runtime.js');
    const { makeHost, simIO } = await import('./js/screenscript/host.js');
    const { screenPixels } = await import('./js/screenscript/surface.js');
    const { FileStore, mainBytes, storedText: st0 } = await import('./js/screenscript/files.js');
    const storedText = (v) => st0(v) || '';
    const D = window.__tzFactory.template('acc');
    const store = new FileStore({ base: () => D.files, fixed: () => mainBytes(D) });
    const { io } = simIO(D, { files: store });
    const scr = D.ctls.filter((x) => x.kind === 'screen');
    const rts = scr.map((c) => {
      const { W, H } = screenPixels(c);
      const io2 = {};
      Object.defineProperties(io2, Object.getOwnPropertyDescriptors(io));
      io2.cid = c.id;
      // the EDIT screen's Slot and Recall inputs read the PRESETS screen's outputs, as on the board
      if (c.label === 'EDIT') io2.screenIn = (i) => (i < 2 ? rts[0].rt.host.screenOutputValue(i + 5) : undefined);
      return { c, W, H, rt: new ScreenRuntime({ src: c.script, w: W, h: H, host: makeHost(D, io2), palette: c.type }), steps: 0 };
    });
    const [A, B] = rts;
    // the EDIT screen's Slot and Recall inputs read the PRESETS screen's outputs, as on the board
    let t = performance.now();
    const step = (k = 1) => {
      for (let q = 0; q < k; q++) {
        t += 50;
        for (const r of rts) {
          r.rt.frame(t);
          r.steps = Math.max(r.steps, r.rt.vm.used + 4000 - r.rt.vm.R.steps);
        }
      }
    };
    const ctl = (label, kind) => D.ctls.find((c) => c.label === label && (kind ? c.kind === kind : c.kind !== 'led'));
    const get = (label, kind) => io.get('u.' + ctl(label, kind).id);
    const set = (label, v, kind) => io.set('u.' + ctl(label, kind).id, v);
    const flip = (label) => set(label, get(label) > 0.5 ? 0 : 1);
    step(12);
    // tap around every page of both screens
    for (let k = 0; k < 5; k++) {
      for (const r of rts) {
        for (const [fx, fy] of [[(k + 0.5) / 5, 0.04], [0.2, 0.4], [0.5, 0.6], [0.85, 0.5], [0.3, 0.9]]) {
          r.rt.pointer('down', fx * r.W, fy * r.H); step(); r.rt.pointer('up', fx * r.W, fy * r.H); step();
        }
      }
    }
    const errors = rts.map((r) => r.rt.error || r.rt.handlerError);
    // close the keyboard (OK) and any dialog the taps opened
    for (const r of rts) if (r.rt.focus) r.rt.blur(false);
    step(2);
    flip('RECALL'); step(3);
    const res = { errors, frames: rts.map((r) => r.rt.frameN) };
    res.seeded = store.list('presets').includes('bank.bin');
    // store: turn some knobs and an EDIT value, then STORE twice into slot 12
    set('GAIN', 0.9); set('ECHO', 0.66); set('VOICE', 2);
    B.rt.pointer('down', B.W * 0.5, 8); step(); B.rt.pointer('up', B.W * 0.5, 8); step(2); // the DRIVE page
    const e1 = ctl('EDIT 1', 'knob');
    io.set('u.' + e1.id, 10 / 24); step(4); // AMP GAIN up ten detents
    const deepAmp = B.rt.host.screenOutputValue(4);
    // pick a slot by tapping it on the PRESETS screen (its ring output says which one is picked)
    const tap = (fx, fy) => { A.rt.pointer('down', fx, fy); step(); A.rt.pointer('up', fx, fy); step(2); };
    const pick = (i) => {
      const cw = (A.W - 12) / 2, col = (i - 1) >> 3, row = (i - 1) % 8;
      if (Math.abs(A.rt.host.screenOutputValue(1) - (i - 1) / 15) > 1e-3) tap(4 + col * (cw + 4) + cw / 2, 20 + row * 15 + 6);
      return Math.round(A.rt.host.screenOutputValue(1) * 15) + 1;
    };
    res.picked = pick(12);
    flip('STORE'); step(3);
    flip('STORE'); step(8);
    res.names = storedText(store.stored('presets/names.txt')).split('\n');
    res.bankBytes = store.size('presets/bank.bin');
    res.used = store.used();
    // change everything, recall slot 12
    set('GAIN', 0.1); set('ECHO', 0.1); set('VOICE', 0);
    io.set('u.' + e1.id, 0); step(4);
    const deepMoved = B.rt.host.screenOutputValue(4);
    pick(1);
    pick(12);
    flip('RECALL'); step(10);
    res.after = { gain: get('GAIN'), echo: get('ECHO'), voice: get('VOICE'), deep: B.rt.host.screenOutputValue(4), deepAmp, deepMoved, slot: A.rt.host.screenOutputValue(5) };
    // the footswitches step through the presets
    flip('PRESET +'); step(8);
    res.next = A.rt.host.screenOutputValue(5);
    // delete slot 12 again from the touch screen: pick it, DELETE, then confirm
    pick(12);
    tap(4 + 2 * 56 + 26, A.H - 11); // DELETE
    tap(56 + 40, 50 + 74 - 16); // DELETE in the dialog
    res.afterDelete = storedText(store.stored('presets/names.txt')).split('\n')[11];
    res.steps = rts.map((r) => r.steps);
    res.errors2 = rts.map((r) => r.rt.error || r.rt.handlerError);
    res.shots = Object.fromEntries(rts.map((r) => [r.c.label, r.rt.canvas.toDataURL('image/png')]));
    return res;
  });
  for (const [k, v] of Object.entries(off.shots)) fs.writeFileSync(path.join(S, `acc-offstage-${k.toLowerCase()}.png`), Buffer.from(v.split(',')[1], 'base64'));
  ok(off.errors.every((e) => !e) && off.errors2.every((e) => !e) && off.frames.every((f) => f > 60), `both screens run their code files without errors ${JSON.stringify(off.errors.concat(off.errors2))}`);
  ok(off.steps.every((s) => s < 150000), `the screens stay within the frame budget (${off.steps.join(', ')} steps)`);
  ok(off.seeded && off.names[0] === 'CLEAN SPARKLE', `the bank starts with the factory presets (${off.names.slice(0, 3).join(', ')} ...)`);
  ok(off.picked === 12 && off.names[11] === 'USER 12' && off.bankBytes > 100, `STORE twice saves slot 12 into presets/bank.bin (${off.bankBytes} bytes) and names.txt`);
  ok(Math.abs(off.after.gain - 0.9) < 0.01 && Math.abs(off.after.echo - 0.66) < 0.01 && off.after.voice === 2, `RECALL brings the knobs back (gain ${off.after.gain}, echo ${off.after.echo}, voice ${off.after.voice})`);
  ok(off.after.deepAmp > 0.45 && off.after.deepMoved < off.after.deepAmp && Math.abs(off.after.deep - off.after.deepAmp) < 0.01 && off.after.slot === 12, `the EDIT screen follows the recall (amp gain ${off.after.deepMoved} back to ${off.after.deep}, slot ${off.after.slot})`);
  ok(off.next === 1, `PRESET + loads the next preset (slot ${off.next})`);
  ok(off.afterDelete === '', 'DELETE on the touch screen empties the slot');
  ok(off.used < 200 * 1024, `the pedal's files use ${(off.used / 1024).toFixed(1)} KB of the 1 MB`);

  // 5. Test mode in the factory: the circuits play, the screens run and drive them
  await win.evaluate(() => window.__tzFactory.test(true));
  await win.waitForTimeout(2500);
  const tm = await win.evaluate(() => {
    const st = window.__tz.state.status.blocks.fztest;
    const d = window.__tzFactory.design();
    const P = window.__tzFactory.testInfo().params;
    const scr = d.ctls.filter((c) => c.kind === 'screen');
    return { cv: st && st.cv, stage: window.__tzScreens.stage(), outs: scr.map((c) => c.sio.outs.map((o, i) => P['u.s.' + c.id + '.' + i])) };
  });
  ok(Array.isArray(tm.cv) && tm.cv.length >= 8 && tm.stage.length === 2 && tm.stage.every((x) => !x.error && x.frames > 10), `Test mode plays it: ${tm.cv && tm.cv.length} circuit outputs, screens ${JSON.stringify(tm.stage.map((x) => x.error || x.frames))}`);
  ok(tm.outs.every((o) => o.filter((v) => typeof v === 'number').length >= 3), `the screens drive their outputs in Test mode ${JSON.stringify(tm.outs.map((o) => o.map((v) => (typeof v === 'number' ? +v.toFixed(2) : null))))}`);
  await win.screenshot({ path: path.join(S, 'acc-test-mode.png') });
  await win.evaluate(() => window.__tzFactory.test(false));
  await win.waitForTimeout(500);

  // 6. export as a block and put it on the board
  await win.click('#fzSaveBlock');
  await win.waitForFunction(() => !!window.__tzFactory.design().blockId, null, { timeout: 10000 });
  const blockType = (await D()).blockId;
  await win.click('#tabs [data-tab="board"]');
  await win.waitForTimeout(400);
  const placed = await win.evaluate(async (type) => {
    const m = await import('./js/state.js');
    const b = m.addBlock(type, 6400, 900);
    await new Promise((r) => setTimeout(r, 800));
    const ed = window.__tz.editor;
    ed.view.z = 1.1;
    ed.view.x = -b.x * 1.1 + 60;
    ed.view.y = -b.y * 1.1 + 60;
    ed.applyView && ed.applyView();
    const v = ed.views.get(b.id);
    return { id: b.id, ok: !!v, ctl: v ? v.g.querySelectorAll('[data-ctl]').length : 0 };
  }, blockType);
  await win.waitForTimeout(2500);
  const boardRun = await win.evaluate(async (id) => {
    const { boardScreens } = await import('./js/screenscript/board.js');
    return boardScreens().filter((x) => x.key.startsWith(id + '|'));
  }, placed.id);
  ok(placed.ok && placed.ctl > 50 && boardRun.length === 2 && boardRun.every((x) => !x.error && x.frames > 5), `the saved block is on the board (${placed.ctl} controls) and both screens run there ${JSON.stringify(boardRun.map((x) => x.error || x.frames))}`);
  await win.screenshot({ path: path.join(S, 'acc-board.png') });

  // 7. on the board: STORE saves into the block's files (with the preset), a preset reload and a fresh copy recall it
  const B = (expr, arg) => win.evaluate(expr, arg);
  const ids = await B(async (id) => {
    const { getDef } = await import('./js/catalog/index.js');
    const m = await import('./js/state.js');
    const d = getDef(m.blockById(id).type).design;
    const f = (l, k) => d.ctls.find((c) => c.label === l && (k ? c.kind === k : c.kind !== 'led')).id;
    return { gain: f('GAIN'), store: f('STORE'), recall: f('RECALL'), preset: f('PRESET', 'knob'), echo: f('ECHO'), A: f('PRESETS', 'screen'), B: f('EDIT', 'screen') };
  }, placed.id);
  const setP = (id, k, v) => B(async ([id, k, v]) => (await import('./js/state.js')).setParam(id, k, v), [id, k, v]);
  const param = (id, k) => B(async ([id, k]) => (await import('./js/state.js')).blockById(id).params[k], [id, k]);
  const flipP = async (id, k) => setP(id, k, (await param(id, k)) > 0.5 ? 0 : 1);
  await setP(placed.id, 'u.' + ids.gain, 0.83);
  await setP(placed.id, 'u.' + ids.echo, 0.61);
  await setP(placed.id, 'u.' + ids.preset, 13 / 16);
  await win.waitForTimeout(700);
  await flipP(placed.id, 'u.' + ids.store);
  await win.waitForTimeout(700);
  await win.screenshot({ path: path.join(S, 'acc-board-save.png') });
  await flipP(placed.id, 'u.' + ids.store);
  await win.waitForTimeout(1800);
  const fsRaw = await param(placed.id, '_fs');
  let saved = {};
  try {
    saved = JSON.parse(fsRaw || '{}');
  } catch (_) {
    /* checked below */
  }
  const names = typeof saved['presets/names.txt'] === 'string' ? saved['presets/names.txt'].split('\n') : [];
  ok(!!saved['presets/bank.bin'] && names[13] === 'USER 14', `STORE on the board writes the bank into the block's files (_fs: ${Object.keys(saved).join(', ')})`);
  // reload the board preset, turn the knobs away, recall slot 14
  await B(async () => {
    const m = await import('./js/state.js');
    m.loadPreset(m.serialize());
  });
  await win.waitForTimeout(2500);
  await setP(placed.id, 'u.' + ids.gain, 0.2);
  await setP(placed.id, 'u.' + ids.echo, 0.2);
  await setP(placed.id, 'u.' + ids.preset, 0);
  await win.waitForTimeout(600);
  await setP(placed.id, 'u.' + ids.preset, 13 / 16);
  await win.waitForTimeout(600);
  await flipP(placed.id, 'u.' + ids.recall);
  await win.waitForTimeout(1500);
  const r1 = { gain: await param(placed.id, 'u.' + ids.gain), echo: await param(placed.id, 'u.' + ids.echo), slot: await param(placed.id, 'u.s.' + ids.A + '.4') };
  ok(Math.abs(r1.gain - 0.83) < 0.01 && Math.abs(r1.echo - 0.61) < 0.01 && r1.slot === 14, `after a preset reload, RECALL on the board brings slot 14 back (gain ${r1.gain}, echo ${r1.echo})`);
  // a fresh copy of the block with the same params (its own file store from _fs)
  const copy = await B(async ([id, gain]) => {
    const m = await import('./js/state.js');
    const src = m.blockById(id);
    const b = m.addBlock(src.type, src.x, src.y + 900, { params: JSON.parse(JSON.stringify(src.params)) });
    m.removeBlocks([id]);
    b.params['u.' + gain] = 0.3;
    const ed = window.__tz.editor;
    ed.view.x = -b.x * 1.1 + 60;
    ed.view.y = -b.y * 1.1 + 60;
    ed.applyView && ed.applyView();
    return b.id;
  }, [placed.id, ids.gain]);
  await win.waitForTimeout(2500);
  await setP(copy, 'u.' + ids.preset, 0);
  await win.waitForTimeout(600);
  await setP(copy, 'u.' + ids.preset, 13 / 16);
  await win.waitForTimeout(600);
  await flipP(copy, 'u.' + ids.recall);
  await win.waitForTimeout(1500);
  const r2 = await param(copy, 'u.' + ids.gain);
  ok(Math.abs(r2 - 0.83) < 0.01, `a fresh copy of the block recalls the saved preset from its files (gain ${r2})`);
  await win.screenshot({ path: path.join(S, 'acc-board-recall.png') });

  // 8. offline: the circuits pass audio, and the controls change the sound
  const di = makeDI(path.join(data, 'di.wav'));
  const ids2 = await B(async (type) => {
    const { getDef } = await import('./js/catalog/index.js');
    const d = getDef(type).design;
    const f = (l) => 'u.' + d.ctls.find((c) => c.label === l && c.kind !== 'led').id;
    return { gain: f('GAIN'), voice: f('VOICE'), boost: f('BOOST'), type: f('MOD TYPE'), depth: f('DEPTH'), echo: f('ECHO'), reps: f('REPEATS'), oct: f('OCTAVE') };
  }, blockType);
  const render = async (params) => {
    const file = await win.evaluate(async ([type, di, params]) => {
      const preset = {
        version: 1, name: 'acc check',
        blocks: [{ id: '__in', type: '__in', x: 0, y: 0, params: {} }, { id: '__out', type: '__out', x: 0, y: 0, params: {} }, { id: 'c1', type, x: 0, y: 0, params, variant: 'mono' }],
        cables: [{ id: 'a', from: { node: '__in', port: 0 }, to: { node: 'c1', port: 0 } }, { id: 'b', from: { node: 'c1', port: 0 }, to: { node: '__out', port: 0 } }],
      };
      return window.tz.offline.render(window.__tz.buildGraph(preset), di);
    }, [blockType, di, params]);
    const lv = measure(file);
    const w = readWav(file).chans[0];
    fs.rmSync(file, { force: true });
    return { lv, w };
  };
  const diff = (a, b) => {
    let num = 0, den = 0;
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
      num += (a[i] - b[i]) ** 2;
      den += a[i] * a[i];
    }
    return num / (den || 1);
  };
  const base = await render({});
  ok(base.lv && base.lv.lufs > -45 && base.lv.peak < 0, `the four circuits pass audio offline (${base.lv && base.lv.lufs.toFixed(1)} LUFS)`);
  const tries = [
    ['DRIVE: fuzz voice, full gain and boost', { [ids2.voice]: 2, [ids2.gain]: 1, [ids2.boost]: 0.9 }],
    ['MOD: tremolo at full depth', { [ids2.type]: 3, [ids2.depth]: 1 }],
    ['SPACE: loud echoes', { [ids2.echo]: 1, [ids2.reps]: 0.8 }],
    ['FRONT: octave down', { [ids2.oct]: 1 }],
  ];
  for (const [what, p] of tries) {
    const r = await render(p);
    const k = diff(base.w, r.w);
    ok(r.lv && r.lv.lufs > -45 && k > 0.02, `${what} changes the sound (difference ${k.toFixed(2)}, ${r.lv && r.lv.lufs.toFixed(1)} LUFS)`);
  }

  ok(errs.length === 0, 'no console errors');
  if (errs.length) console.log(errs.join('\n'));
  console.log(fails ? `${fails} failed` : 'all passed');
  await app.close();
  fs.rmSync(data, { recursive: true, force: true });
  process.exit(fails ? 1 : 0);
})();
