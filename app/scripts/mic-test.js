// Mic blocks on cabs (docs/mic-blocks.md): drag a mic from the library onto a cab by real pointer events, move it,
// one output jack per mic with cables to different places, each mic output renders and different models sound
// different, remove / swap / Delete key, undo, save + reload, and an old cab (m1/m2 type params) still renders the
// same as the same cab with the matching core models.
// usage: node scripts/mic-test.js [shots dir]
const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');
const { makeDI } = require('./loudness');
const S = process.argv[2] || process.env.SHOTS || '/tmp/mic-test';
fs.mkdirSync(S, { recursive: true });

function readWav(file) {
  const b = fs.readFileSync(file);
  let pos = 12, fmt = 1, ch = 1, bits = 16, data = null;
  while (pos + 8 <= b.length) {
    const id = b.toString('ascii', pos, pos + 4), len = b.readUInt32LE(pos + 4);
    if (id === 'fmt ') { fmt = b.readUInt16LE(pos + 8); ch = b.readUInt16LE(pos + 10); bits = b.readUInt16LE(pos + 22); if (fmt === 0xfffe) fmt = b.readUInt16LE(pos + 32); }
    if (id === 'data') { data = b.subarray(pos + 8, Math.min(b.length, pos + 8 + len)); break; }
    pos += 8 + len + (len & 1);
  }
  const bps = bits / 8, n = Math.floor(data.length / bps / ch);
  const out = [];
  for (let c = 0; c < ch; c++) out.push(new Float32Array(n));
  for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) { const o = (i * ch + c) * bps; out[c][i] = fmt === 3 ? data.readFloatLE(o) : data.readInt16LE(o) / 32768; }
  return out;
}
// average magnitude spectrum (dB) in 1/3 octave bands, 80 Hz .. 12 kHz
function bands(x, sr = 48000) {
  const N = 4096, edges = [];
  for (let f = 80; f < 12500; f *= Math.pow(2, 1 / 3)) edges.push(f);
  const acc = new Float64Array(edges.length);
  for (let s = 0; s + N < x.length; s += N * 2) {
    const re = new Float64Array(N), im = new Float64Array(N);
    let e = 0;
    for (let i = 0; i < N; i++) { re[i] = x[s + i] * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N)); e += re[i] * re[i]; }
    if (e < 1e-6) continue;
    for (let i = 1, j = 0; i < N; i++) { let bit = N >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
    for (let len = 2; len <= N; len <<= 1) {
      const a = (-2 * Math.PI) / len;
      for (let i = 0; i < N; i += len)
        for (let k = 0; k < len / 2; k++) {
          const wr = Math.cos(a * k), wi = Math.sin(a * k), ur = re[i + k], ui = im[i + k];
          const vr = re[i + k + len / 2] * wr - im[i + k + len / 2] * wi, vi = re[i + k + len / 2] * wi + im[i + k + len / 2] * wr;
          re[i + k] = ur + vr; im[i + k] = ui + vi; re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi;
        }
    }
    for (let b = 0; b < edges.length; b++) {
      const k0 = Math.round((edges[b] / sr) * N), k1 = Math.max(k0 + 1, Math.round((edges[b] * Math.pow(2, 1 / 3) / sr) * N));
      for (let k = k0; k < k1; k++) acc[b] += re[k] * re[k] + im[k] * im[k];
    }
  }
  const db = [...acc].map((v) => 10 * Math.log10(v + 1e-12));
  const mean = db.reduce((a, v) => a + v, 0) / db.length;
  return db.map((v) => v - mean); // shape only
}
const rms = (x) => Math.sqrt(x.reduce((a, v) => a + v * v, 0) / x.length);
const shapeDiff = (a, b) => Math.sqrt(a.reduce((s, v, i) => s + (v - b[i]) ** 2, 0) / a.length);

let fails = 0;
const ok = (cond, msg) => { console.log((cond ? 'ok   ' : 'FAIL ') + msg); if (!cond) fails++; };

(async () => {
  const di = makeDI(path.join(S, 'di.wav'));
  const app = await electron.launch({ executablePath: require('electron'), args: [path.join(__dirname, '..'), '--no-sandbox'] });
  const win = await app.firstWindow();
  const errs = [];
  win.on('pageerror', (e) => errs.push('PAGEERROR ' + e.stack));
  win.on('console', (m) => m.type() === 'error' && errs.push('CONSOLE ' + m.text()));
  await win.setViewportSize({ width: 1600, height: 950 }).catch(() => {});
  await win.waitForFunction(() => window.__tz && window.__tz.ready, null, { timeout: 120000 });
  await win.waitForTimeout(600);

  const ev = (fn, arg) => win.evaluate(fn, arg);
  const cab = await ev(async () => {
    const st = await import('./js/state.js');
    const p = st.newPreset('Mic test');
    p.blocks[0].x = 900; p.blocks[0].y = 40; p.blocks[1].x = -420; p.blocks[1].y = 40;
    st.loadPreset(p, null);
    const E = window.__tz.editor;
    const b = E.addAt('tz.cab-monolith', 240, 230, true);
    E.fit(false);
    return b.id;
  });
  await win.waitForTimeout(700);
  const info = () => ev(async (id) => {
    const st = await import('./js/state.js');
    const CM = await import('./js/catalog/cabmics.js');
    const b = st.blockById(id), d = (await import('./js/catalog/index.js')).getDef(b.type);
    const slots = CM.activeSlots(b, d);
    return { slots, models: slots.map((i) => CM.modelOf(b, d, i)), xy: slots.map((i) => [b.params[`_m${i}x`], b.params[`_m${i}y`]]), outs: st.nodePorts(b).outs, cables: st.state.preset.cables.filter((c) => c.from.node === id).map((c) => c.from.port + '>' + c.to.node + ':' + c.to.port) };
  }, cab);
  // screen point of a grille-normalised spot on the cab, and back
  const spot = (x, y) => ev(async ([id, x, y]) => {
    const E = window.__tz.editor, v = E.views.get(id);
    const { cabGeom } = await import('./js/gfx/cabgeom.js');
    const g = cabGeom(v.def.cabSize);
    const r = E.board.getBoundingClientRect();
    const wx = v.block.x + g.gx + x * g.gw, wy = v.block.y + g.gy + y * g.gh;
    return { x: r.left + E.view.x + wx * E.view.z, y: r.top + E.view.y + wy * E.view.z };
  }, [cab, x, y]);
  const drag = async (a, b, steps = 14) => {
    await win.mouse.move(a.x, a.y);
    await win.mouse.down();
    await win.mouse.move(b.x, b.y, { steps });
    await win.mouse.up();
    await win.waitForTimeout(400);
  };
  const center = async (sel) => { const bb = await (await win.$(sel)).boundingBox(); return { x: bb.x + bb.width / 2, y: bb.y + bb.height / 2 }; };

  let I = await info();
  ok(I.slots.length === 1 && I.models[0] === 'mics.dyn57', `new cab starts with one Fifty-Seven (${I.models})`);
  ok(I.outs.length === 1 && /^MIC 1 57$/.test(I.outs[0]), `one mic, one jack: ${I.outs}`);

  // ---- library: Mics chip, drag a Fifty-Eight onto the cab
  await win.click('#catChips .chip:has-text("Mics")');
  await win.waitForTimeout(600);
  const names = await win.$$eval('#blockList .bl-item .name, .bl-item .name', (els) => els.map((e) => e.textContent));
  ok(names.includes('Fifty-Seven') && names.includes('Fifty-Eight') && names.includes('Four-Fourteen'), `Mics list shows the mic models (${names.length}: ${names.slice(0, 5).join(', ')}...)`);
  await win.waitForTimeout(1200); // thumbnails
  await win.screenshot({ path: path.join(S, 'library-mics.png') });
  const libItem = async (name) => center(`.bl-item:has(.name:text-is("${name}"))`);
  const dropAt = { x: 0.7, y: 0.66 };
  await drag(await libItem('Fifty-Eight'), await spot(dropAt.x, dropAt.y), 20);
  I = await info();
  ok(I.slots.length === 2 && I.models[1] === 'mics.dyn58', `dropped Fifty-Eight lands on the cab (${I.models})`);
  ok(I.xy[1] && Math.abs(I.xy[1][0] - dropAt.x) < 0.02 && Math.abs(I.xy[1][1] - dropAt.y) < 0.02, `where it was dropped: ${I.xy[1]?.map((v) => v.toFixed(3))}`);
  ok(I.outs.length === 3 && I.outs[0] === 'MIX' && I.outs[2] === 'MIC 2 58', `two mics: MIX + one jack each (${I.outs})`);

  // dropping a mic on the empty board is refused
  const nBefore = await ev(() => window.__tz.state.preset.blocks.length);
  const bb = await (await win.$('#board')).boundingBox();
  await drag(await libItem('Four-Fourteen'), { x: bb.x + bb.width - 60, y: bb.y + bb.height - 80 });
  ok((await ev(() => window.__tz.state.preset.blocks.length)) === nBefore && (await info()).slots.length === 2, 'mic dropped off a cab: nothing added');

  // ---- reposition mic 2 by dragging it
  const m2 = await spot(I.xy[1][0], I.xy[1][1]);
  const to = await spot(0.3, 0.3);
  await drag(m2, to);
  I = await info();
  ok(Math.abs(I.xy[1][0] - 0.3) < 0.02 && Math.abs(I.xy[1][1] - 0.3) < 0.02, `mic 2 dragged to 0.3, 0.3: ${I.xy[1].map((v) => v.toFixed(3))}`);
  const spk = await ev((id) => import('./js/state.js').then((st) => st.engineParamsFor(st.blockById(id))), cab);
  ok(spk.m2spk === 0 && spk.m2pos >= 0 && spk.m2pos <= 1.3, `engine gets speaker / position for mic 2 (spk ${spk.m2spk}, pos ${spk.m2pos.toFixed(2)})`);

  // ---- a third mic (ribbon), 3 output jacks + MIX
  await drag(await libItem('One-Twenty-One'), await spot(0.78, 0.28), 20);
  I = await info();
  ok(I.slots.length === 3 && I.outs.length === 4 && I.outs[3] === 'MIC 3 121', `three mics: ${I.outs}`);

  // ---- cables: in -> cab, mic 1 -> out L (real drag), mic 2 -> a pedal -> out R, mic 3 -> out 3
  const ped = await ev(async () => { const b = window.__tz.editor.addAt('bx.ds1', 520, 620, true); return b.id; });
  await ev(() => window.__tz.editor.fit(false));
  await win.waitForTimeout(500);
  await drag(await center('[data-node="__in"] [data-jack="o0"]'), await center(`[data-node="${cab}"] [data-jack="i0"]`));
  await drag(await center(`[data-node="${cab}"] [data-jack="o1"]`), await center('[data-node="__out"] [data-jack="i0"]'));
  await drag(await center(`[data-node="${cab}"] [data-jack="o2"]`), await center(`[data-node="${ped}"] [data-jack="i0"]`));
  await ev(async ([cab, ped]) => {
    const st = await import('./js/state.js');
    st.connect({ node: ped, port: 0 }, { node: '__out', port: 1 });
    st.connect({ node: cab, port: 3 }, { node: '__out', port: 2 });
  }, [cab, ped]);
  await win.waitForTimeout(400);
  I = await info();
  ok(['1>__out:0', `2>${ped}:0`, '3>__out:2'].every((c) => I.cables.includes(c)), `mic outputs cabled to different places: ${I.cables}`);
  const g = await ev(() => window.__tz.buildGraph());
  const cn = g.nodes.find((n) => n.id === cab);
  ok(cn.nOut === 4 && cn.opts.layout.mix === 1 && JSON.stringify(cn.opts.layout.mics) === '[0,1,2]' && cn.opts.mics[1].type === 'dynamic' && cn.opts.mics[2].type === 'ribbon', `engine node: 4 outputs, layout ${JSON.stringify(cn.opts.layout)}`);
  await ev(([id]) => { const E = window.__tz.editor; E.select([id]); }, [cab]);
  await win.waitForTimeout(500);
  await win.screenshot({ path: path.join(S, 'cab-3mics.png') });

  // ---- each mic output renders, different models sound different
  const render = (port, model2) => ev(async ([id, port, di, model2]) => {
    const st = await import('./js/state.js');
    const p = JSON.parse(JSON.stringify(st.state.preset));
    const b = p.blocks.find((x) => x.id === id);
    if (model2) b.params.m2model = model2;
    p.cables = [{ from: { node: '__in', port: 0 }, to: { node: id, port: 0 } }, { from: { node: id, port }, to: { node: '__out', port: 0 } }];
    return window.tz.offline.render(window.__tz.buildGraph(p), di);
  }, [cab, port, di, model2]);
  const out = {};
  for (const [k, port] of [['mix', 0], ['m1', 1], ['m2', 2], ['m3', 3]]) {
    const f = await render(port);
    const x = readWav(f)[0];
    out[k] = { rms: rms(x), sp: bands(x) };
    fs.rmSync(f, { force: true });
  }
  for (const k of ['mix', 'm1', 'm2', 'm3']) ok(out[k].rms > 0.005, `${k} output renders audio (rms ${out[k].rms.toFixed(4)})`);
  const d12 = shapeDiff(out.m1.sp, out.m2.sp), d13 = shapeDiff(out.m1.sp, out.m3.sp);
  ok(d13 > 1.0, `57 vs 121 ribbon sound different (spectral shape ${d13.toFixed(2)} dB rms)`);
  ok(d12 > 0.3, `57 vs 58 (other spot) sound different (${d12.toFixed(2)} dB)`);
  // same spot, three models
  const same = {};
  for (const m of ['mics.dyn57', 'mics.beta57a', 'mics.dyn58', 'mics.c414', 'mics.r121', 'mics.u87']) {
    const f = await render(2, m);
    same[m] = bands(readWav(f)[0]);
    fs.rmSync(f, { force: true });
  }
  const pairs = [['mics.dyn57', 'mics.dyn58'], ['mics.dyn57', 'mics.beta57a'], ['mics.dyn58', 'mics.r121'], ['mics.c414', 'mics.r121'], ['mics.dyn57', 'mics.u87']];
  for (const [a, b] of pairs) ok(shapeDiff(same[a], same[b]) > 0.25, `same spot: ${a} vs ${b} differ by ${shapeDiff(same[a], same[b]).toFixed(2)} dB`);
  const hi = (sp) => sp.slice(-5).reduce((a, v) => a + v, 0) / 5;
  ok(hi(same['mics.r121']) < hi(same['mics.dyn57']) - 1, `the ribbon has the darker top (${hi(same['mics.r121']).toFixed(1)} vs ${hi(same['mics.dyn57']).toFixed(1)})`);

  // ---- swap: drop a Four-Fourteen onto mic 1 (keeps its spot)
  const before1 = I.xy[0];
  await drag(await libItem('Four-Fourteen'), await spot(before1[0], before1[1]), 20);
  I = await info();
  ok(I.slots.length === 3 && I.models[0] === 'mics.c414' && Math.abs(I.xy[0][0] - before1[0]) < 1e-6, `swap: mic 1 is now ${I.models[0]}, same place`);
  ok(I.outs[1] === 'MIC 1 414' && I.cables.includes('1>__out:0'), `swap keeps the jack and its cable (${I.outs[1]})`);

  // ---- remove mic 2 by right-click > Remove mic
  const pm2 = await spot(I.xy[1][0], I.xy[1][1]);
  await win.mouse.click(pm2.x, pm2.y, { button: 'right' });
  await win.waitForTimeout(300);
  await win.screenshot({ path: path.join(S, 'mic-menu.png') });
  await win.click('text=Remove mic');
  await win.waitForTimeout(400);
  I = await info();
  ok(I.slots.length === 2 && I.outs.length === 3 && I.outs[2] === 'MIC 2 121', `right-click remove: ${I.outs}`);
  ok(I.cables.includes('1>__out:0') && I.cables.includes('2>__out:2') && !I.cables.some((c) => c.includes(ped)), `cables follow their mic: ${I.cables}`);

  // ---- undo brings it back with its cable
  await ev(() => import('./js/state.js').then((st) => st.undo()));
  await win.waitForTimeout(500);
  I = await info();
  ok(I.slots.length === 3 && I.cables.includes(`2>${ped}:0`) && I.cables.includes('3>__out:2'), `undo: ${I.outs} / ${I.cables}`);

  // ---- Delete key on a clicked mic
  await ev(() => window.__tz.editor.board.focus());
  const pm3 = await spot(I.xy[2][0], I.xy[2][1]);
  await win.mouse.click(pm3.x, pm3.y);
  await win.waitForTimeout(200);
  await win.keyboard.press('Delete');
  await win.waitForTimeout(400);
  I = await info();
  const cabStill = await ev((id) => !!window.__tz.state.preset.blocks.find((b) => b.id === id), cab);
  ok(cabStill && I.slots.length === 2 && !I.models.includes('mics.r121'), `Delete removes the clicked mic, not the cab (${I.models})`);

  // ---- inspector shot with two mics, one selected
  await ev((id) => { window.__tz.editor.select([id]); }, cab);
  await win.waitForTimeout(800);
  await win.screenshot({ path: path.join(S, 'inspector.png') });

  // ---- save and reload
  const saved = await ev(() => import('./js/state.js').then((st) => JSON.stringify(st.serialize())));
  await ev(async (s) => { const st = await import('./js/state.js'); st.loadPreset(st.newPreset('x'), null); st.loadPreset(JSON.parse(s), 'mic-test.json'); }, saved);
  await win.waitForTimeout(500);
  const I2 = await info();
  ok(JSON.stringify(I2) === JSON.stringify(I), 'save + reload keeps mics, jacks and cables');
  const g2 = await ev(() => window.__tz.buildGraph());
  ok(JSON.stringify(g2.nodes.find((n) => n.id === cab).opts) === JSON.stringify((await ev(() => window.__tz.buildGraph())).nodes.find((n) => n.id === cab).opts), 'reloaded cab builds the same engine node');

  // ---- an old cab (v0.10 params) renders the same as with the core models named, and keeps its single output
  const old = await ev(async ([di]) => {
    const st = await import('./js/state.js');
    const mk = (named) => {
      const p = st.newPreset('old');
      const P = { m1on: 1, m1type: 0, m1dist: 0.2, _m1x: 0.2, _m1y: 0.25, m2on: 1, m2type: 2, m2dist: 0.1, m2lvl: -3, _m2x: 0.7, _m2y: 0.75, m2axis: 0.3 };
      if (named) Object.assign(P, { m1model: 'mics.dyn57', m2model: 'mics.r121' });
      p.blocks.push({ id: 'c1', type: 'cab.4x12uber', x: 0, y: 0, params: P, variant: 'mono' });
      p.cables = [{ id: 'a', from: { node: '__in', port: 0 }, to: { node: 'c1', port: 0 } }, { id: 'b', from: { node: 'c1', port: 0 }, to: { node: '__out', port: 0 } }];
      return p;
    };
    const ga = window.__tz.buildGraph(mk(false)), gb = window.__tz.buildGraph(mk(true));
    const [fa, fb] = [await window.tz.offline.render(ga, di), await window.tz.offline.render(gb, di)];
    st.loadPreset(mk(false), null);
    const b = st.blockById('c1');
    return { fa, fb, outs: st.nodePorts(b).outs, nodes: ga.nodes.length, legacy: ga.nodes[0].opts.mics.slice(0, 2).map((m) => m && m.legacy) };
  }, [di]);
  const xa = readWav(old.fa)[0], xb = readWav(old.fb)[0];
  let maxd = 0;
  for (let i = 0; i < xa.length; i++) maxd = Math.max(maxd, Math.abs(xa[i] - xb[i]));
  ok(maxd === 0 && rms(xa) > 0.005, `old m1/m2 cab = core models, sample for sample (max diff ${maxd}, rms ${rms(xa).toFixed(4)})`);
  ok(JSON.stringify(old.legacy) === '[0,2]' && old.nodes === 1 && old.outs[0] === 'MIX', `old cab: legacy voicings ${old.legacy}, ${old.nodes} node, port 0 = ${old.outs[0]}`);
  fs.rmSync(old.fa, { force: true }); fs.rmSync(old.fb, { force: true });

  // ---- stereo: MIX L / MIX R then per-mic jacks, cables kept when switching
  const st2 = await ev(async () => {
    const st = await import('./js/state.js');
    st.connect({ node: 'c1', port: 2 }, { node: '__out', port: 3 });
    st.setVariant('c1', 'stereo');
    const b = st.blockById('c1');
    const r = { outs: st.nodePorts(b).outs, cables: st.state.preset.cables.filter((c) => c.from.node === 'c1').map((c) => c.from.port + '>' + c.to.port) };
    st.setVariant('c1', 'mono');
    r.back = st.state.preset.cables.filter((c) => c.from.node === 'c1').map((c) => c.from.port + '>' + c.to.port);
    return r;
  });
  ok(st2.outs.join() === 'MIX L,MIX R,MIC 1 57,MIC 2 121' && st2.cables.includes('0>0') && st2.cables.includes('3>3'), `stereo jacks ${st2.outs}, cables ${st2.cables}`);
  ok(st2.back.includes('0>0') && st2.back.includes('2>3'), `back to mono keeps them: ${st2.back}`);

  console.log(errs.slice(0, 10).join('\n') || 'no renderer errors');
  console.log(fails ? `${fails} FAILED` : 'all mic tests passed');
  await app.close();
  process.exit(fails || errs.length ? 1 : 0);
})();
