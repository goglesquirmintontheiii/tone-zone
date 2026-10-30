// Pedal Factory circuits: the circuit list (pictures, search, tags), the circuit editor (templates, parts,
// wires by drag, undo / redo, save with name, tags and description), two circuits in one pedal wired from
// different controls and jacks, one control driving two inputs, the wiring diagram (drag to wire, fold,
// resize, pop out), testing a circuit alone, a big circuit staying smooth, and an offline render of the saved
// block that is not silent and changes with a mapped control.
const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { makeDI, measure } = require('./loudness');
const S = process.env.SHOTS || '/tmp';
(async () => {
  const data = fs.mkdtempSync(path.join(os.tmpdir(), 'tz-circuits-'));
  const app = await electron.launch({ executablePath: require('electron'), args: [path.join(__dirname, '..'), '--no-sandbox'], env: { ...process.env, XDG_DATA_HOME: data } });
  const win = await app.firstWindow();
  const errs = [];
  win.on('pageerror', (e) => errs.push('PAGEERROR ' + e.stack));
  win.on('console', (m) => m.type() === 'error' && errs.push('CONSOLE ' + m.text()));
  await win.setViewportSize({ width: 1600, height: 950 }).catch(() => {});
  await win.waitForFunction(() => window.__tz && window.__tz.ready, null, { timeout: 120000 });
  let fails = 0;
  const ok = (cond, msg) => {
    console.log((cond ? 'ok   ' : 'FAIL ') + msg);
    if (!cond) fails++;
  };
  const D = () => win.evaluate(() => JSON.parse(JSON.stringify(window.__tzFactory.design())));
  const drag = async (a, b, steps = 10) => {
    await win.mouse.move(a.x, a.y);
    await win.mouse.down();
    await win.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps });
    await win.mouse.move(b.x, b.y, { steps });
    await win.mouse.up();
    await win.waitForTimeout(150);
  };
  const center = async (sel) => {
    const b = await (await win.$(sel)).boundingBox();
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  };

  // diagram size and list filters are remembered per machine: start from the defaults
  await win.evaluate(() => ['tz.factory.wd.v1', 'tz.circuits.filter.v1'].forEach((k) => localStorage.removeItem(k)));
  await win.click('#tabs [data-tab="factory"]');
  await win.waitForSelector('.fz-stage');
  await win.click('#fzTemplates');
  await win.click('[data-template="blank"]');
  await win.waitForTimeout(300);

  // 1. the circuit list: pictures, search, tags, kinds
  await win.click('.fz-tabs [data-t="circuit"]');
  await win.waitForSelector('.cl-item');
  const imgs = await win.$$eval('.cl-item .cl-thumb', (a) => a.slice(0, 6).map((i) => i.src.slice(0, 22)));
  ok(imgs.length >= 6 && imgs.every((s) => s === 'data:image/png;base64,'), 'circuits in the list have PNG pictures');
  await win.fill('.cl-search', 'muff');
  await win.waitForTimeout(150);
  let names = await win.$$eval('.cl-item .cl-name b', (a) => a.map((x) => x.textContent));
  ok(names.length >= 1 && names.some((n) => /Muff/.test(n)), 'search finds the Muff circuit: ' + names.join(', '));
  await win.fill('.cl-search', '');
  await win.click('.cl-tags [data-tag="envelope"]');
  await win.waitForTimeout(150);
  names = await win.$$eval('.cl-item .cl-name b', (a) => a.map((x) => x.textContent));
  ok(names.length >= 3 && names.includes('Envelope filter') && !names.includes('Big Muff style fuzz'), 'tag filter shows only envelope circuits (' + names.length + ')');
  await win.click('.cl-tags [data-tag="envelope"]');
  await win.selectOption('.cl-cat', 'Reverb');
  await win.waitForTimeout(150);
  names = await win.$$eval('.cl-item .cl-name b', (a) => a.map((x) => x.textContent));
  ok(names.length >= 2 && names.includes('Shimmer'), 'kind filter: ' + names.join(', '));
  await win.selectOption('.cl-cat', '');
  await win.waitForTimeout(100);
  await win.screenshot({ path: path.join(S, 'circuits-list.png') });

  // 2. New opens the editor over the canvas; start from a template
  await win.click('[data-cl="new"]');
  await win.waitForSelector('.cz-modal');
  const cover = await win.evaluate(() => {
    const m = document.querySelector('.cz-modal').getBoundingClientRect();
    const s = document.querySelector('.fz-stagewrap').getBoundingClientRect();
    const w = document.querySelector('.fz-wd').getBoundingClientRect();
    return m.left <= s.left + 8 && m.right >= s.right - 8 && m.top <= s.top + 8 && m.bottom >= w.bottom - 8;
  });
  ok(cover, 'the editor covers the pedal canvas and the wiring diagram');
  await win.click('[data-cz="templates"]');
  await win.click('.cz-menu [data-tpl="b.envfilter"]');
  await win.waitForTimeout(300);
  const E = (fn, arg) => win.evaluate(([f, a]) => new Function('E', 'a', 'return (' + f + ')(E, a)')(window.__tzCircuits.editor(), a), [fn.toString(), arg]);
  const g0 = await E((E) => ({ n: E.G.nodes.length, w: E.G.wires.length, name: E.rec.name }));
  ok(g0.n >= 7 && g0.w >= 8 && g0.name === 'Envelope filter', `template loaded (${g0.n} parts, ${g0.w} wires)`);

  // 3. add parts: click one in, drag another onto the canvas
  await win.fill('.cz-search', 'tremolo');
  await win.click('.cz-part[data-part-type="tremolo"]');
  await win.waitForTimeout(150);
  await win.fill('.cz-search', 'lfo');
  const cvb = await (await win.$('.cz-canvas')).boundingBox();
  await drag(await center('.cz-part[data-part-type="lfo"]'), { x: cvb.x + cvb.width * 0.5, y: cvb.y + cvb.height * 0.8 });
  await win.fill('.cz-search', '');
  const g1 = await E((E) => ({ n: E.G.nodes.length, trem: E.G.nodes.find((n) => n.t === 'tremolo')?.id, lfo: E.G.nodes.find((n) => n.t === 'lfo')?.id, filt: E.G.nodes.find((n) => n.t === 'filter')?.id, out: E.G.nodes.find((n) => n.t === 'out')?.id, x: E.G.nodes.find((n) => n.t === 'xfade')?.id }));
  ok(g1.n === g0.n + 2 && g1.trem && g1.lfo, 'parts added by click and by drag');
  // 4. wires by dragging port to port: filter out -> tremolo in, tremolo out -> blend B (moves that wire), LFO -> tremolo rate
  await E((E) => E.fit());
  await win.waitForTimeout(200);
  // spread the new parts out so their ports are reachable
  await E((E, a) => { const t = E.node(a.trem), l = E.node(a.lfo); t.x = 520; t.y = 360; l.x = 300; l.y = 520; E.commit(); E.fit(); }, g1);
  await win.waitForTimeout(250);
  const pxy = (n, p, out) => E((E, a) => E.portXY(a.n, a.p, a.out), { n, p, out });
  await drag(await pxy(g1.filt, 'out', true), await pxy(g1.trem, 'in', false));
  await drag(await pxy(g1.trem, 'out', true), await pxy(g1.x, 'b', false));
  const g2 = await E((E, a) => ({ w: E.G.wires.length, ft: E.G.wires.some((w) => w.a.n === a.filt && w.b.n === a.trem), tb: E.G.wires.filter((w) => w.b.n === a.x && w.b.p === 'b').map((w) => w.a.n) }), g1);
  ok(g2.ft, 'dragged a wire from the filter to the tremolo');
  ok(g2.tb.includes(g1.trem), 'dragged a wire into the blend input');
  // a control wire: LFO out onto the tremolo's Depth (folded parts open while dragging a control wire)
  const lfoOut = await pxy(g1.lfo, 'cv', true);
  await win.mouse.move(lfoOut.x, lfoOut.y);
  await win.mouse.down();
  await win.mouse.move(lfoOut.x + 30, lfoOut.y - 20, { steps: 4 });
  const depth = await pxy(g1.trem, '@depth', false);
  await win.mouse.move(depth.x, depth.y, { steps: 8 });
  await win.mouse.up();
  await win.waitForTimeout(150);
  const g3 = await E((E, a) => ({ w: E.G.wires.length, lfo: E.G.wires.some((w) => w.a.n === a.lfo && w.b.n === a.trem && w.b.p === '@depth') }), g1);
  ok(g3.lfo, 'dragged a control wire from the LFO to the tremolo depth');
  await win.screenshot({ path: path.join(S, 'circuits-editor.png') });
  // 5. undo / redo
  await win.click('[data-cz="undo"]');
  await win.waitForTimeout(100);
  const u1 = await E((E) => E.G.wires.length);
  await win.click('[data-cz="redo"]');
  await win.waitForTimeout(100);
  const u2 = await E((E) => E.G.wires.length);
  ok(u1 === g3.w - 1 && u2 === g3.w, `undo and redo the last wire (${g3.w} -> ${u1} -> ${u2})`);
  // keyboard: select the LFO, copy, paste, delete
  await E((E, a) => { E.sel = new Set([a.lfo]); E.paintInsp(); }, g1);
  await win.focus('.cz-modal');
  await win.keyboard.press('Control+c');
  await win.keyboard.press('Control+v');
  const pasted = await E((E) => E.G.nodes.filter((n) => n.t === 'lfo').length);
  await win.keyboard.press('Delete');
  const afterDel = await E((E) => E.G.nodes.filter((n) => n.t === 'lfo').length);
  ok(pasted === 2 && afterDel === 1, 'copy, paste and delete with the keyboard');
  const issues = await E((E) => E.issues.filter((i) => i.level === 'error').length);
  ok(issues === 0, 'the circuit checks out (no errors)');

  // 6. test the circuit on its own
  await win.click('[data-cz="test"]');
  await win.waitForTimeout(1200);
  const solo = await win.evaluate(async () => {
    const m = await import('./js/pages/factory-play.js');
    const i = m.soloInfo();
    const g = i && i.graphs[i.graphs.length - 1];
    return { on: m.soloRunning(), nodes: g ? g.nodes.map((n) => n.id + ':' + n.algo) : [], over: window.__tzFactory.graphOverridden(), status: Object.keys(window.__tz.state.status.blocks || {}) };
  });
  ok(solo.on && solo.over && solo.nodes.join() === 'fzsolo:patch', 'Test circuit plays the circuit alone: ' + solo.nodes.join());
  ok(solo.status.includes('fzsolo'), 'the engine runs the circuit (' + solo.status.join(',') + ')');
  await win.click('[data-cz="test"]');
  await win.waitForTimeout(500);
  ok(!(await win.evaluate(() => window.__tzFactory.graphOverridden())), 'stopping the test gives the board back');

  // 7. name, description, tags and save: JSON and PNG in the circuits folder
  await win.fill('[data-cz="name"]', 'Wobble Filter');
  await E((E) => { E.sel.clear(); E.selW.clear(); E.paintInsp(); });
  await win.fill('[data-cz="desc"]', 'An envelope filter with a tremolo after it.');
  await win.fill('[data-cz="tags"]', 'filter, wobble, test');
  await win.click('[data-cz="save"]');
  await win.waitForTimeout(500);
  const saved = await win.evaluate(() => window.__tzCircuits.list().find((r) => r.name === 'Wobble Filter'));
  ok(saved && !saved.builtin && saved.tags.includes('wobble'), 'saved to the library with its tags');
  const dir = path.join(data, 'tone-zone', 'circuits');
  ok(saved && fs.existsSync(path.join(dir, saved.id + '.json')) && fs.existsSync(path.join(dir, saved.id + '.png')) && fs.statSync(path.join(dir, saved.id + '.png')).size > 2000, 'circuit JSON and PNG written');
  const rec = saved && JSON.parse(fs.readFileSync(path.join(dir, saved.id + '.json'), 'utf8'));
  ok(rec && rec.desc === 'An envelope filter with a tremolo after it.' && /^data:image\/png/.test(rec.thumb), 'description and picture saved');
  await win.click('[data-cz="close"]');
  await win.waitForTimeout(200);
  ok(!(await win.evaluate(() => window.__tzCircuits.editorOpen())), 'editor closed');
  await win.fill('.cl-search', 'wobble');
  await win.waitForTimeout(150);
  names = await win.$$eval('.cl-item .cl-name b', (a) => a.map((x) => x.textContent));
  ok(names.length >= 1 && names[0] === 'Wobble Filter', 'the new circuit is found by its tag: ' + names.join(', '));

  // 8. two circuits in one pedal: the saved one and a built-in drive, from the list
  await win.click('.cl-item [data-cl="use"]');
  await win.fill('.cl-search', 'tube screamer');
  await win.waitForTimeout(150);
  await win.click('.cl-item[data-circuit-id="b.tsdrive"] [data-cl="use"]');
  await win.fill('.cl-search', '');
  await win.waitForTimeout(300);
  let d = await D();
  // the blank template had an Overdrive already; take it out so the pedal is ours
  const firstInst = d.circuit.insts.find((i) => i.ref !== saved.id && i.ref !== 'b.tsdrive');
  if (firstInst) {
    await win.click(`.fz-wd [data-wremove="${firstInst.id}"]`);
    await win.waitForTimeout(200);
  }
  d = await D();
  const wob = d.circuit.insts.find((i) => i.ref === saved.id), ts = d.circuit.insts.find((i) => i.ref === 'b.tsdrive');
  ok(d.circuit.insts.length === 2 && wob && ts, 'two circuits in the pedal');
  ok(d.circuit.wires.some((w) => w.a.n === wob.id && w.b.n === ts.id), 'they are wired in a row (Wobble Filter into the drive)');
  ok(d.ctls.filter((c) => c.kind === 'knob').length >= 6, 'their inputs got knobs (' + d.ctls.filter((c) => c.kind === 'knob').length + ')');
  await win.screenshot({ path: path.join(S, 'circuits-diagram.png') });

  // 9. wiring diagram: drag from a control to a circuit input, a jack to a circuit input, an expression jack to an input
  await win.click('.fz-tabs [data-t="parts"]');
  await win.click('.fz-tile[data-part="knob"]');
  await win.click('.fz-tile[data-part="in"]');
  await win.click('.fz-tile[data-part="exp"]');
  await win.waitForTimeout(300);
  d = await D();
  const newKnob = d.ctls.filter((c) => c.kind === 'knob').pop();
  const in2 = d.jacks.filter((j) => j.kind === 'in').pop();
  const exp = d.jacks.find((j) => j.kind === 'exp');
  const tsDrive = ts.graph.nodes.find((n) => (n.t === 'analog' || n.t === 'binary') && n.name === 'Drive');
  const wobMix = wob.graph.nodes.find((n) => (n.t === 'analog' || n.t === 'binary') && n.name === 'Mix');
  const wobIn = wob.graph.nodes.find((n) => n.t === 'in');
  await win.evaluate(() => window.__tzCircuits.diagram().refresh(true));
  await win.waitForTimeout(200);
  const wdDrag = async (a, b) => drag(await center(`.fz-wd [data-wp="${a}"]`), await center(`.fz-wd [data-wp="${b}"]`));
  await wdDrag('ctl:' + newKnob.id, `k:${ts.id}:${tsDrive.id}`);
  await wdDrag('ctl:' + newKnob.id, `k:${wob.id}:${wobMix.id}`);
  await wdDrag('jack:' + in2.id, `in:${wob.id}:${wobIn.id}`);
  await wdDrag('jack:' + exp.id, `k:${ts.id}:${tsDrive.id}`);
  d = await D();
  const nk = d.ctls.find((c) => c.id === newKnob.id);
  const tos = [nk.map, ...(nk.more || [])].filter((m) => m && m.to).map((m) => m.to);
  ok(tos.includes(ts.id + '.' + tsDrive.id) && tos.includes(wob.id + '.' + wobMix.id), 'one knob wired to two circuits by dragging in the diagram: ' + tos.join(', '));
  ok(d.circuit.wires.some((w) => w.a.n === 'jack:' + in2.id && w.b.n === wob.id), 'the second input jack is wired into a circuit');
  ok((d.jacks.find((j) => j.id === exp.id).maps || []).some((m) => m.to === ts.id + '.' + tsDrive.id), 'the expression jack drives the drive input');
  ok((await win.evaluate(() => window.__tzFactory.selection())) === newKnob.id, 'wiring a control selects it (' + tos.length + ' targets)');
  // the knob moves both
  const both = await win.evaluate(async ([kid, a, b]) => {
    const m = await import('./js/pages/factory-circuit.js');
    const def = m.designToDef(window.__tzFactory.design(), { id: 'custom.both' });
    const ui = {};
    for (const c of def.controls) if (c.p) ui[c.p] = c.def;
    ui['u.' + kid] = 0;
    const lo = def.derive(ui);
    ui['u.' + kid] = 1;
    const hi = def.derive(ui);
    return { a: [lo[a], hi[a]], b: [lo[b], hi[b]] };
  }, [newKnob.id, ts.id + '.' + tsDrive.id, wob.id + '.' + wobMix.id]);
  ok(both.a[1] > both.a[0] && both.b[1] > both.b[0], `one knob turns two inputs (${both.a.map((v) => v.toFixed(2))} and ${both.b.map((v) => v.toFixed(2))})`);
  // click a wire and delete it
  const wid = `m:${newKnob.id}:${tos.indexOf(wob.id + '.' + wobMix.id)}`;
  await win.click(`.fz-wd .fz-wd-wirehit[data-ww="${wid}"]`, { force: true });
  await win.keyboard.press('Delete');
  await win.waitForTimeout(200);
  d = await D();
  const nk2 = d.ctls.find((c) => c.id === newKnob.id);
  ok(![nk2.map, ...(nk2.more || [])].some((m) => m && m.to === wob.id + '.' + wobMix.id) && [nk2.map, ...(nk2.more || [])].filter((m) => m && m.to).length === tos.length - 1, 'clicking a wire and pressing Delete removes it');
  // put it back for the render below
  await wdDrag('ctl:' + newKnob.id, `k:${wob.id}:${wobMix.id}`);

  // 10. fold, resize and pop out the diagram
  const st0 = await win.evaluate(() => window.__tzCircuits.diagram().state());
  const mid = await win.evaluate(() => document.querySelector('.fz-mid').getBoundingClientRect().height);
  const sw = await win.evaluate(() => document.querySelector('.fz-stagewrap').getBoundingClientRect().height);
  ok(st0.h > sw * 0.35 && st0.h < sw * 0.75, `the diagram starts at about half the canvas (${Math.round(st0.h)} vs ${Math.round(sw)})`);
  await win.click('.fz-wd [data-wd="collapse"]');
  await win.waitForTimeout(200);
  const st1 = await win.evaluate(() => window.__tzCircuits.diagram().state());
  ok(st1.collapsed && st1.h < 50, 'the diagram folds away (' + Math.round(st1.h) + ' px)');
  await win.click('.fz-wd [data-wd="collapse"]');
  await win.waitForTimeout(200);
  const gb = await (await win.$('.fz-wd [data-wd="grip"]')).boundingBox();
  await drag({ x: gb.x + 200, y: gb.y + 4 }, { x: gb.x + 200, y: gb.y - 80 });
  const st2 = await win.evaluate(() => window.__tzCircuits.diagram().state());
  ok(!st2.collapsed && st2.h > st0.h + 50, `dragging the top edge resizes it (${Math.round(st0.h)} -> ${Math.round(st2.h)})`);
  const [pop] = await Promise.all([app.waitForEvent('window'), win.click('.fz-wd [data-wd="pop"]')]);
  await pop.waitForTimeout(800);
  ok(await pop.evaluate(() => !!document.querySelector('.fz-wd.popped .fz-wd-svg [data-winst]')), 'the diagram pops out into its own window, circuits and all');
  ok(!(await win.evaluate(() => !!document.querySelector('.fz-mid .fz-wd'))), 'it left the factory tab');
  await pop.screenshot({ path: path.join(S, 'circuits-diagram-popped.png') });
  await pop.click('[data-wd="pop"]');
  await win.waitForTimeout(400);
  ok(await win.evaluate(() => !!document.querySelector('.fz-mid .fz-wd:not(.popped)')), 'and pops back in');

  // 11. a big circuit stays smooth: 220 parts, 300 wires
  const perf = await win.evaluate(async () => {
    const parts = await import('./js/pages/circuit-parts.js');
    const g = parts.emptyGraph();
    const types = ['overdrive', 'filter', 'vca', 'lfo', 'env', 'cmp', 'delay', 'mixer', 'scale', 'and'];
    for (let i = 0; i < 220; i++) g.nodes.push(parts.newNode(types[i % types.length], 200 + (i % 20) * 190, 40 + Math.floor(i / 20) * 200));
    let k = 0;
    for (let i = 3; i < g.nodes.length && k < 300; i++) {
      const a = g.nodes[i - 1], b = g.nodes[i];
      const pa = parts.portsOf(a), pb = parts.portsOf(b);
      const o = pa.outs[0], ins = pb.ins.filter((p) => o && p.kind === o.kind);
      if (o && ins[0]) g.wires.push({ id: 'w' + k++, a: { n: a.id, p: o.k }, b: { n: b.id, p: ins[0].k } });
    }
    window.__tzCircuits.editLibraryGraph = null;
    const m = await import('./js/pages/circuit-editor.js');
    const host = document.querySelector('.fz-root');
    const E = m.openCircuitEditor({ host, rec: { name: 'Big', graph: g }, onSave: async (r) => r });
    await new Promise((r) => setTimeout(r, 400));
    const times = [];
    for (let i = 0; i < 20; i++) {
      E.view.x -= 20;
      E.L = null;
      E.draw();
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      times.push(E.lastDraw);
    }
    const t0 = performance.now();
    for (let i = 0; i < 200; i++) E.hit({ x: 500 + i, y: 300 + i });
    const hitMs = (performance.now() - t0) / 200;
    E.close(true);
    times.sort((a, b) => a - b);
    return { median: times[10], max: times[19], hitMs, nodes: g.nodes.length, wires: g.wires.length };
  });
  ok(perf.median < 25 && perf.hitMs < 2, `a ${perf.nodes} part, ${perf.wires} wire circuit draws in ${perf.median.toFixed(1)} ms (max ${perf.max.toFixed(1)}), hit test ${perf.hitMs.toFixed(2)} ms`);

  // 12. a complex built-in circuit in the editor (screenshot)
  await win.evaluate(() => window.__tzCircuits.edit('b.dynamo'));
  await win.waitForTimeout(600);
  await win.evaluate(() => { const E = window.__tzCircuits.editor(); E.view.z = 0.62; E.view.x = 20; E.view.y = 10; E.draw(); });
  await win.waitForTimeout(300);
  await win.screenshot({ path: path.join(S, 'circuits-complex.png') });
  await win.click('[data-cz="close"]');
  await win.waitForTimeout(200);

  // 13. save as block, offline render through the engine: not silent, and the mapped knob changes it
  await win.click('#fzSaveBlock');
  await win.waitForFunction(() => !!window.__tzFactory.design().blockId, null, { timeout: 5000 });
  const blockId = (await D()).blockId;
  // the drive's Level knob (made when the circuit was added)
  const dl = await D();
  const lvlK = ts.graph.nodes.find((n) => (n.t === 'analog' || n.t === 'binary') && n.name === 'Level');
  const lvlCtl = dl.ctls.find((c) => c.map && c.map.to === ts.id + '.' + lvlK.id);
  const di = makeDI(path.join(data, 'di.wav'));
  const render = (v) => win.evaluate(async ([id, di, kid, v]) => {
    const preset = {
      version: 1, name: 'circuit check',
      blocks: [{ id: '__in', type: '__in', x: 0, y: 0, params: {} }, { id: '__out', type: '__out', x: 0, y: 0, params: {} }, { id: 'c1', type: id, x: 0, y: 0, params: { ['u.' + kid]: v }, variant: 'mono' }],
      cables: [{ id: 'a', from: { node: '__in', port: 0 }, to: { node: 'c1', port: 0 } }, { id: 'b', from: { node: 'c1', port: 0 }, to: { node: '__out', port: 0 } }],
    };
    const g = window.__tz.buildGraph(preset);
    return { file: await window.tz.offline.render(g, di), algo: g.nodes[0].algo, n: g.nodes[0].opts.nodes.length };
  }, [blockId, di, lvlCtl.id, v]);
  const r0 = await render(0), r1 = await render(1);
  const l0 = measure(r0.file), l1 = measure(r1.file);
  fs.rmSync(r0.file, { force: true });
  fs.rmSync(r1.file, { force: true });
  ok(r0.algo === 'patch' && r0.n > 10 && l0.lufs > -50 && l1.lufs > -50 && l1.peak < 3, `offline render of the two-circuit pedal is not silent (${l0.lufs.toFixed(1)} / ${l1.lufs.toFixed(1)} LUFS)`);
  ok(Math.abs(l1.lufs - l0.lufs) > 1 || Math.abs(l1.rms - l0.rms) > 0.001, `turning the drive's mapped Level knob changes the sound (${l0.lufs.toFixed(1)} -> ${l1.lufs.toFixed(1)} LUFS)`);

  // 14. editing a circuit from the pedal updates the pedal and the library
  d = await D();
  const wob2 = d.circuit.insts.find((i) => i.ref === saved.id);
  await win.evaluate((id) => window.__tzCircuits.editInst(id), wob2.id);
  await win.waitForTimeout(300);
  await E((E) => { E.addPart('crusher'); });
  await win.click('[data-cz="save"]');
  await win.waitForTimeout(500);
  await win.click('[data-cz="close"]');
  d = await D();
  ok(d.circuit.insts.find((i) => i.id === wob2.id).graph.nodes.some((n) => n.t === 'crusher'), 'saving from the pedal updates the pedal\'s circuit');
  ok(JSON.parse(fs.readFileSync(path.join(dir, saved.id + '.json'), 'utf8')).graph.nodes.some((n) => n.t === 'crusher'), 'and the circuit in the library');

  // 15. analog and binary signals: math, delay, outputs to LEDs, jacks, screens and other circuits
  await win.evaluate(async () => {
    const P = await import('./js/pages/circuit-parts.js');
    const F = await import('./js/pages/factory-circuit.js');
    const N = (G, id, t, o = {}, p = {}) => {
      const n = P.newNode(t, 0, 0, o);
      n.id = id;
      Object.assign(n.p, p);
      G.nodes.push(n);
      return n;
    };
    const W = (G, a, ap, b, bp, o = {}) => G.wires.push({ id: P.nid('w'), a: { n: a, p: ap }, b: { n: b, p: bp }, ...o });
    const pedal = (name, insts, o = {}) => {
      const d = window.__tzFactory.template('blank');
      d.name = name;
      d.circuit = { v: 3, insts: insts.map((x, i) => ({ id: x.id, ref: null, ver: 1, name: x.name, graph: x.graph, x: (i % 2) * 250, y: Math.floor(i / 2) * 170, on: true })), wires: o.wires || [], cwires: o.cwires || [], combine: {} };
      d.jacks = o.jacks || d.jacks;
      d.ctls = o.ctls || [];
      F.syncStages(d.circuit);
      return d;
    };
    window.__ct = { P, F, N, W, pedal, G: () => ({ nodes: [], wires: [] }) };
  });
  const renderBlock = (design, params, extra) => win.evaluate(async ([design, params, di, extra]) => {
    const cu = await import('./js/catalog/custom.js');
    const id = await cu.saveCustomBlock(design, { asNew: true });
    const preset = {
      version: 1, name: 'signal check',
      blocks: [{ id: '__in', type: '__in', x: 0, y: 0, params: {} }, { id: '__out', type: '__out', x: 0, y: 0, params: {} }, { id: 'c1', type: id, x: 0, y: 0, params, variant: 'mono' }],
      cables: [{ id: 'a', from: { node: '__in', port: 0 }, to: { node: 'c1', port: 0 } }, { id: 'b', from: { node: 'c1', port: 0 }, to: { node: '__out', port: 0 } }],
    };
    const g = window.__tz.buildGraph(preset);
    if (extra === 'stereo') {
      // both sides of the PHONES jack to the two outputs
      g.cables = g.cables.filter((c) => c.to.node !== '__out');
      g.cables.push({ from: { node: 'c1', port: 0 }, to: { node: '__out', port: 0 } }, { from: { node: 'c1', port: 1 }, to: { node: '__out', port: 1 } });
    }
    return { file: await window.tz.offline.render(g, di), id, nOut: g.nodes[0].nOut };
  }, [design, params, di, extra]);
  const { readWav } = require('../main/offline');
  const segRms = (x, t0, t1) => {
    let a = 0, n = 0;
    for (let i = Math.floor(t0 * 48000); i < Math.min(x.length, Math.floor(t1 * 48000)); i++, n++) a += x[i] * x[i];
    return Math.sqrt(a / Math.max(1, n));
  };
  // math: an analog input of -255..255 at 200, times -1, plus 201 = 1 (VCA open); at 200.5 it gives 0.5
  const mathD = await win.evaluate(() => {
    const { N, W, pedal, G: g0, F } = window.__ct;
    const G = g0();
    N(G, 'in', 'in'); N(G, 'out', 'out');
    N(G, 'A', 'analog', { name: 'A', min: -255, max: 255, def: 0 });
    N(G, 'mul', 'mul', {}, { b: -1 }); N(G, 'add', 'add', {}, { b: 201 }); N(G, 'vca', 'vca');
    W(G, 'in', 'out', 'vca', 'in'); W(G, 'vca', 'out', 'out', 'in');
    W(G, 'A', 'cv', 'mul', '@a'); W(G, 'mul', 'cv', 'add', '@a'); W(G, 'add', 'cv', 'vca', '@gain', { lo: 0, hi: 1 });
    const d = pedal('Math check', [{ id: 'M', name: 'Math', graph: G }], { ctls: [{ id: 'k', kind: 'knob', x: 30, y: 40, r: 6.5, style: 'boss', value: 0.5, label: 'A', labelPos: 'below' }] });
    F.seriesWires(d);
    d.ctls[0].map = F.mapTo(d.circuit, 'M.A');
    const def = F.designToDef(d, { id: 'custom.mathcheck' });
    const at = (v) => def.derive({ 'u.k': (v + 255) / 510 })['M.A'];
    return { d, a200: at(200), a2005: at(200.5), aNeg: at(-255), slots: def.opts.nodes.filter((n) => n.k === 'mul' || n.k === 'add').map((n) => n.slots.map((x) => x.raw)) };
  });
  ok(Math.abs(mathD.a200 - 200) < 1e-6 && Math.abs(mathD.a2005 - 200.5) < 1e-6 && mathD.aNeg === -255, `a knob sweeps an analog input from -255 to 255 (${mathD.aNeg}, ${mathD.a200}, ${mathD.a2005})`);
  ok(mathD.slots.flat().every((x) => x === true), 'math parts take their values as they are (raw slots)');
  const m1 = await renderBlock(mathD.d, { 'u.k': 455 / 510 }), m2 = await renderBlock(mathD.d, { 'u.k': 455.5 / 510 });
  const rm1 = segRms(readWav(m1.file).chans[0], 0.2, 10), rm2 = segRms(readWav(m2.file).chans[0], 0.2, 10);
  ok(rm1 > 0.01 && Math.abs(rm1 / rm2 - 2) < 0.15, `200 * -1 + 201 opens the VCA, 200.5 gives half (${rm1.toFixed(4)} / ${rm2.toFixed(4)})`);
  // the math circuit in the editor, with an output and the signal key (screenshot)
  await win.evaluate(async (d) => {
    const m = await import('./js/pages/circuit-editor.js');
    const P = window.__ct.P;
    const g = JSON.parse(JSON.stringify(d.circuit.insts[0].graph));
    const o = P.newNode('anaout', 0, 0, { name: 'Gain out' }), dl = P.newNode('cdelay'), b = P.newNode('binary', 0, 0, { name: 'Hold' }), bo = P.newNode('binout');
    g.nodes.push(o, dl, b, bo);
    g.wires.push({ id: 'x1', a: { n: 'add', p: 'cv' }, b: { n: dl.id, p: '@in' } }, { id: 'x2', a: { n: dl.id, p: 'cv' }, b: { n: o.id, p: '@in' } }, { id: 'x3', a: { n: b.id, p: 'cv' }, b: { n: bo.id, p: '@in' } });
    const pos = { in: [40, 60], A: [40, 200], mul: [240, 200], add: [440, 200], vca: [640, 60], out: [860, 60] };
    pos[dl.id] = [640, 260]; pos[o.id] = [860, 260]; pos[b.id] = [40, 360]; pos[bo.id] = [240, 360];
    for (const n of g.nodes) if (pos[n.id]) [n.x, n.y] = pos[n.id];
    const E = m.openCircuitEditor({ host: document.querySelector('.fz-root'), rec: { name: 'Math and delay', graph: g }, onSave: async (r) => r });
    await new Promise((r) => setTimeout(r, 400));
    E.fit();
    E.sel = new Set(['A']);
    E.paintInsp();
  }, mathD.d);
  await win.waitForTimeout(400);
  await win.screenshot({ path: path.join(S, 'circuits-signals-editor.png') });
  await win.evaluate(() => window.__tzCircuits.editor().close(true));
  // delay: a constant reaches the VCA a second later
  const delD = await win.evaluate(() => {
    const { N, W, pedal, G: g0, F } = window.__ct;
    const G = g0();
    N(G, 'in', 'in'); N(G, 'out', 'out');
    N(G, 'one', 'const', {}, { value: 1 }); N(G, 'dl', 'cdelay', {}, { time: 1 }); N(G, 'vca', 'vca');
    W(G, 'in', 'out', 'vca', 'in'); W(G, 'vca', 'out', 'out', 'in');
    W(G, 'one', 'cv', 'dl', '@in'); W(G, 'dl', 'cv', 'vca', '@gain', { lo: 0, hi: 1 });
    const d = pedal('Delay check', [{ id: 'D', name: 'Delay', graph: G }]);
    F.seriesWires(d);
    return d;
  });
  const dr = await renderBlock(delD, {});
  const dx = readWav(dr.file).chans[0];
  const early = segRms(dx, 0.05, 0.9), late = segRms(dx, 1.1, 3);
  ok(early < 1e-4 && late > 0.01, `the Delay part passes its input on after its time (${early.toFixed(5)} then ${late.toFixed(4)})`);
  // PHONES: left and right wired from different circuits
  const phD = await win.evaluate(() => {
    const { N, W, pedal, G: g0 } = window.__ct;
    const mk = (gain) => {
      const G = g0();
      N(G, 'in', 'in'); N(G, 'out', 'out'); N(G, 'vca', 'vca', {}, { gain });
      W(G, 'in', 'out', 'vca', 'in'); W(G, 'vca', 'out', 'out', 'in');
      return G;
    };
    const jacks = [{ id: 'jin', kind: 'in', edge: 'right', t: 0.4, label: 'IN' }, { id: 'jph', kind: 'phones', edge: 'top', t: 0.5, label: 'PHONES' }];
    const wires = [
      { id: 'w1', a: { n: 'jack:jin', p: '' }, b: { n: 'L', p: 'in' } }, { id: 'w2', a: { n: 'jack:jin', p: '' }, b: { n: 'R', p: 'in' } },
      { id: 'w3', a: { n: 'L', p: 'out' }, b: { n: 'jack:jph', p: 'L' } }, { id: 'w4', a: { n: 'R', p: 'out' }, b: { n: 'jack:jph', p: 'R' } },
    ];
    return pedal('Phones check', [{ id: 'L', name: 'Loud', graph: mk(1) }, { id: 'R', name: 'Quiet', graph: mk(0.25) }], { jacks, wires });
  });
  const pr = await renderBlock(phD, {}, 'stereo');
  const pw = readWav(pr.file);
  const pl = segRms(pw.chans[0], 0.2, 10), prr = pw.chans[1] ? segRms(pw.chans[1], 0.2, 10) : 0;
  ok(pw.chans.length >= 2 && pl > 0.01 && Math.abs(pl / prr - 4) < 0.3, `PHONES L and R wired on their own (${pw.chans.length} channels, L ${pl.toFixed(4)}, R ${prr.toFixed(4)})`);
  for (const r of [m1, m2, dr, pr]) fs.rmSync(r.file, { force: true });

  // the big one: outputs to LEDs, an EXP OUT jack, a footswitch IN jack, circuit to circuit and a screen
  const big = await win.evaluate(() => {
    const { N, W, pedal, G: g0, F } = window.__ct;
    const E = g0();
    N(E, 'in', 'in'); N(E, 'out', 'out'); W(E, 'in', 'out', 'out', 'in');
    N(E, 'V', 'analog', { name: 'V', def: 0.75 }); N(E, 'exp', 'anaout', { name: 'Exp' }); W(E, 'V', 'cv', 'exp', '@in');
    const Gt = g0();
    N(Gt, 'gate', 'binary', { name: 'Gate', def: 0 }); N(Gt, 'lit', 'binout', { name: 'Lit' }); W(Gt, 'gate', 'cv', 'lit', '@in');
    N(Gt, 'gate2', 'binary', { name: 'Gate2', def: 0 }); N(Gt, 'fsw', 'binout', { name: 'Fsw' }); W(Gt, 'gate2', 'cv', 'fsw', '@in');
    N(Gt, 'lvl', 'analog', { name: 'Lvl', def: 0.5 }); N(Gt, 'glow', 'anaout', { name: 'Glow' }); W(Gt, 'lvl', 'cv', 'glow', '@in');
    const H = g0();
    N(H, 'hin', 'analog', { name: 'In', def: 0 }); N(H, 'm2', 'mul', {}, { b: 2 }); N(H, 'twice', 'anaout', { name: 'Twice', min: 0, max: 2 });
    W(H, 'hin', 'cv', 'm2', '@a'); W(H, 'm2', 'cv', 'twice', '@in');
    const S = g0();
    N(S, 'val', 'analog', { name: 'Val', min: -255, max: 255, def: 0 }); N(S, 'back', 'anaout', { name: 'Back', min: -255, max: 255 }); W(S, 'val', 'cv', 'back', '@in');
    const jacks = [
      { id: 'jin', kind: 'in', edge: 'right', t: 0.3, label: 'IN' }, { id: 'jout', kind: 'out', edge: 'left', t: 0.3, label: 'OUT' },
      { id: 'jexp', kind: 'exp', edge: 'top', t: 0.25, label: 'EXP', from: { n: 'E', p: 'exp' } },
      { id: 'jfs', kind: 'fsw', edge: 'top', t: 0.7, label: 'FS', maps: [{ to: 'G.gate2', min: 0, max: 1, taper: 'lin', ch: 't' }] },
    ];
    const ctls = [
      { id: 'tg', kind: 'toggle', ways: 2, orient: 'v', x: 20, y: 70, pos: 0, label: 'GATE', labelPos: 'below', map: { to: 'G.gate', min: 0, max: 1, taper: 'lin' } },
      { id: 'l1', kind: 'led', x: 20, y: 20, r: 2.5, color: '#ff2a1a', on: true, label: '', labelPos: 'none', bind: 'cv:G.lit' },
      { id: 'l2', kind: 'led', x: 40, y: 20, r: 2.5, color: '#3fa8ff', on: true, label: '', labelPos: 'none', bind: 'on' },
      { id: 'sc', kind: 'screen', x: 30, y: 45, w: 40, h: 16, type: 'oled', text: '', label: '', labelPos: 'none', shows: 'custom',
        script: 'function draw()\n  clear()\n  output(1, input("Level") * 2)\n  text(string.format("%.2f", input(1)), 2, 2)\nend\n',
        sio: { ins: [{ id: 'p1', name: 'Level', sig: 'n', from: { n: 'E', p: 'exp' } }], outs: [{ id: 'p2', name: 'Set', sig: 'n', maps: [{ to: 'S.val', raw: true }] }] } },
    ];
    const wires = [{ id: 'w1', a: { n: 'jack:jin', p: '' }, b: { n: 'E', p: 'in' } }, { id: 'w2', a: { n: 'E', p: 'out' }, b: { n: 'jack:jout', p: '' } }];
    const d = pedal('Signals', [{ id: 'E', name: 'Exp', graph: E }, { id: 'G', name: 'Gates', graph: Gt }, { id: 'H', name: 'Double', graph: H }, { id: 'S', name: 'Screen in', graph: S }], { jacks, ctls, wires });
    d.enc.w = 90;
    d.enc.h = 110;
    window.__tzFactory.load(d);
    const def = F.designToDef(window.__tzFactory.design(), { id: 'custom.sigcheck' });
    return { couts: def.couts.map((x) => x.key), ctrl: def.ctrl, screenIO: def.screenIO };
  });
  ok(big.couts.join() === 'E.exp,G.lit,G.fsw,G.glow,H.twice,S.back', 'circuit outputs are numbered for the engine status: ' + big.couts.join());
  ok(big.ctrl && big.ctrl.outs.length === 1 && big.ctrl.outs[0].source === 'cv' && big.ctrl.ins.length === 1 && big.ctrl.ins[0].param === 'u.f.jfs', 'the EXP jack is a control out, the footswitch jack a control in');
  await win.evaluate(() => window.__tzCircuits.diagram().refresh(true));
  await win.waitForTimeout(300);
  const wdHas = await win.evaluate(() => ['co:E:exp', 'k:H:hin', 'led:l1', 'led:l2', 'jo:jexp', 'jack:jfs:t', 'jack:jfs:r', 'si:sc:0', 'so:sc:0'].filter((k) => !document.querySelector(`.fz-wd [data-wp="${k}"]`)));
  ok(!wdHas.length, 'the diagram shows circuit outputs, LEDs, the EXP out, footswitch tip and ring and the screen ports' + (wdHas.length ? ' (missing ' + wdHas.join(', ') + ')' : ''));
  const shapes = await win.evaluate(() => ['co:E:exp', 'co:G:lit', 'jack:jin'].map((k) => { const e = document.querySelector(`.fz-wd [data-wp="${k}"]`); return e.tagName + (e.getAttribute('transform') ? '/rot' : '') + ':' + e.getAttribute('class').split(' ').slice(1, 3).join('.'); }));
  ok(shapes[0] === 'rect/rot:c.n' && shapes[1] === 'rect:c.b' && shapes[2] === 'circle:a.a', 'analog ports are diamonds, binary squares, audio circles: ' + shapes.join(' '));
  ok(await win.evaluate(() => !!document.querySelector('.fz-wd [data-wd="legend"] svg')), 'the diagram has a signal key');
  // drag circuit to circuit, and an analog output to an LED
  await wdDrag('co:E:exp', 'k:H:hin');
  await wdDrag('co:G:glow', 'led:l2');
  d = await D();
  ok(d.circuit.cwires.some((w) => w.a.n === 'E' && w.a.p === 'exp' && w.b.n === 'H' && w.b.p === 'hin'), 'dragged a circuit output into another circuit\'s input');
  ok(d.ctls.find((c) => c.id === 'l2').bind === 'cv:G.glow', 'dragged an analog output onto an LED');
  const wsig = await win.evaluate(() => [...document.querySelectorAll('.fz-wd .fz-wd-wire')].map((p) => p.dataset.sig));
  ok(wsig.includes('a') && wsig.includes('n') && wsig.includes('b'), 'audio, analog and binary wires are drawn differently: ' + [...new Set(wsig)].join(', '));
  await win.screenshot({ path: path.join(S, 'circuits-signals-diagram.png') });
  // Test mode: the LEDs and the circuit values from the engine
  await win.evaluate(() => window.__tzFactory.test(true));
  await win.waitForTimeout(1800);
  const tv = () => win.evaluate(async () => {
    const m = await import('./js/pages/factory-play.js');
    const st = window.__tz.state.status.blocks.fztest;
    return { leds: m.testLeds(), cv: st && st.cv };
  });
  let t1 = await tv();
  ok(t1.cv && Math.abs(t1.cv[4] - 1.5) < 0.01, 'circuit to circuit: 0.75 from one circuit, doubled in the other = ' + (t1.cv && t1.cv[4]));
  ok(t1.cv && Math.abs(t1.cv[5] - 1.5) < 0.01, 'the screen reads a circuit output and drives another circuit\'s input (' + (t1.cv && t1.cv[5]) + ')');
  ok(t1.leds.find((l) => l.cid === 'l1').on === false && typeof t1.leds.find((l) => l.cid === 'l2').on === 'string', 'in Test mode the binary LED is off and the analog one dimmed: ' + JSON.stringify(t1.leds));
  await win.evaluate(() => window.__tzFactory.testSet('tg', 1));
  await win.waitForTimeout(700);
  t1 = await tv();
  ok(t1.leds.find((l) => l.cid === 'l1').on === true && t1.cv[1] === 1, 'flipping the switch lights the LED through the binary output');
  await win.screenshot({ path: path.join(S, 'circuits-signals-test.png') });
  await win.evaluate(() => window.__tzFactory.test(false));
  await win.waitForTimeout(300);
  // on the board: the saved pedal drives a volume pedal through its EXP OUT, a footswitch plugs into its FS jack
  await win.evaluate(() => window.__tzFactory.save(true));
  await win.waitForFunction(() => !!window.__tzFactory.design().blockId, null, { timeout: 5000 });
  const sigId = (await D()).blockId;
  await win.click('#tabs [data-tab="board"]');
  await win.waitForTimeout(400);
  const ids = await win.evaluate(async (id) => {
    const st = await import('./js/state.js');
    const a = st.addBlock(id, 300, 160), v = st.addBlock('tz.dimmer', 620, 160), f = st.addBlock('tz.fs1', 300, 420);
    st.connect({ node: a.id, port: 'c0' }, { node: v.id, port: 'c0' });
    st.connect({ node: f.id, port: 'c0' }, { node: a.id, port: 'c0' });
    // in the signal chain, so the engine runs it
    st.connect({ node: '__in', port: 0 }, { node: a.id, port: 0 });
    st.connect({ node: a.id, port: 0 }, { node: '__out', port: 0 });
    st.syncGraph();
    return { a: a.id, v: v.id, f: f.id };
  }, sigId);
  await win.waitForTimeout(1800);
  const bv = () => win.evaluate(async (ids) => {
    const st = await import('./js/state.js');
    const s = st.state.status.blocks[ids.a];
    const fills = [...document.querySelectorAll(`[data-node="${ids.a}"] circle.led`)].map((c) => c.getAttribute('fill'));
    return { pos: st.uiParams(st.blockById(ids.v)).pos, cv: s && s.cv, gate2: st.engineParamsFor(st.blockById(ids.a))['G.gate2'], fills };
  }, ids);
  let b1 = await bv();
  ok(Math.abs(b1.pos - 0.75) < 0.01, 'a circuit analog output on the EXP OUT jack moves the volume pedal plugged into it (' + b1.pos + ')');
  await win.evaluate(async (ids) => { const c = await import('./js/control.js'); const st = await import('./js/state.js'); c.footCtrl(st.blockById(ids.f), 0, true); }, ids);
  await win.waitForTimeout(700);
  b1 = await bv();
  ok(b1.gate2 === 1 && b1.cv && b1.cv[2] === 1, 'a footswitch on the FS jack sends a binary 1 through the tip into the circuit (' + b1.gate2 + ', ' + (b1.cv && b1.cv[2]) + ')');
  const before = b1.fills.slice();
  await win.evaluate(async (ids) => { const st = await import('./js/state.js'); st.setParam(ids.a, 'u.tg', 1); }, ids);
  await win.waitForTimeout(900);
  b1 = await bv();
  ok(b1.fills.length >= 2 && !before.includes('#ff2a1a') && b1.fills.includes('#ff2a1a'), 'on the board the LED wired to the binary output lights (' + before.join(' ') + ' -> ' + b1.fills.join(' ') + ')');
  await win.screenshot({ path: path.join(S, 'circuits-signals-board.png') });
  await win.evaluate(async (ids) => { const st = await import('./js/state.js'); st.removeBlocks([ids.a, ids.v, ids.f]); }, ids);
  await win.click('#tabs [data-tab="factory"]');
  await win.waitForTimeout(300);

  // 16. effects loop: a SEND and a RETURN on the pedal, in the same audio cycle
  const loopDs = await win.evaluate(() => {
    const { N, W, pedal, G: g0 } = window.__ct;
    const drive = () => {
      const G = g0();
      N(G, 'in', 'in'); N(G, 'out', 'out'); N(G, 'od', 'overdrive', {}, { gain: 0.6 });
      W(G, 'in', 'out', 'od', 'in'); W(G, 'od', 'out', 'out', 'in');
      return G;
    };
    // blend: what came back (A) with the dry input (B, crosses over the loop) at a mix set by a Value part
    const blend = () => {
      const G = g0();
      N(G, 'in', 'in', { name: 'WET' }); N(G, 'dry', 'in', { name: 'DRY' }); N(G, 'out', 'out');
      N(G, 'xf', 'xfade'); N(G, 'mx', 'const', {}, { value: 0.3 });
      W(G, 'in', 'out', 'xf', 'a'); W(G, 'dry', 'out', 'xf', 'b'); W(G, 'mx', 'cv', 'xf', '@mix'); W(G, 'xf', 'out', 'out', 'in');
      return G;
    };
    const mk = (loop) => {
      const jacks = [
        { id: 'jin', kind: 'in', edge: 'right', t: 0.3, label: 'IN' }, { id: 'jret', kind: 'in', edge: 'right', t: 0.7, label: 'RET', ...(loop ? { loop: 'return', loopN: 1 } : {}) },
        { id: 'jout', kind: 'out', edge: 'left', t: 0.3, label: 'OUT' }, { id: 'jsend', kind: 'out', edge: 'left', t: 0.7, label: 'SEND', ...(loop ? { loop: 'send', loopN: 1 } : {}) },
      ];
      const wires = [
        { id: 'w1', a: { n: 'jack:jin', p: '' }, b: { n: 'D', p: 'in' } }, { id: 'w2', a: { n: 'jack:jin', p: '' }, b: { n: 'B', p: 'dry' } },
        { id: 'w5', a: { n: 'B', p: 'out' }, b: { n: 'jack:jout', p: '' } },
        ...(loop ? [{ id: 'w3', a: { n: 'D', p: 'out' }, b: { n: 'jack:jsend', p: '' } }, { id: 'w4', a: { n: 'jack:jret', p: '' }, b: { n: 'B', p: 'in' } }] : [{ id: 'w3', a: { n: 'D', p: 'out' }, b: { n: 'B', p: 'in' } }]),
      ];
      return pedal(loop ? 'Loop pedal' : 'No loop pedal', [{ id: 'D', name: 'Drive', graph: drive() }, { id: 'B', name: 'Blend', graph: blend() }], { jacks, wires });
    };
    return { loop: mk(true), plain: mk(false) };
  });
  const imp = path.join(data, 'imp.wav');
  {
    const n = 48000 * 2, buf = Buffer.alloc(44 + n * 4);
    buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 4, 4); buf.write('WAVE', 8); buf.write('fmt ', 12);
    buf.writeUInt32LE(16, 16); buf.writeUInt16LE(3, 20); buf.writeUInt16LE(1, 22); buf.writeUInt32LE(48000, 24);
    buf.writeUInt32LE(48000 * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(32, 34); buf.write('data', 36); buf.writeUInt32LE(n * 4, 40);
    for (let i = 0; i < n; i++) buf.writeFloatLE(i === 4800 ? 0.5 : 0, 44 + i * 4);
    fs.writeFileSync(imp, buf);
  }
  const loopRender = (design, how, src) => win.evaluate(async ([design, how, src]) => {
    const cu = await import('./js/catalog/custom.js');
    const ci = await import('./js/catalog/index.js');
    const st = await import('./js/state.js');
    const id = await cu.saveCustomBlock(design, { asNew: true });
    const drv = ci.allDefs().find((d) => d.algo === 'drive' && !d.hidden && /screamer|ts/i.test((d.name || '') + ' ' + (d.typeName || ''))) || ci.allDefs().find((d) => d.algo === 'drive' && !d.hidden);
    const blocks = [{ id: '__in', type: '__in', x: 0, y: 0, params: {} }, { id: '__out', type: '__out', x: 0, y: 0, params: {} }, { id: 'lp', type: id, x: 0, y: 0, params: {}, variant: 'mono' }];
    const cables = [{ id: 'a', from: { node: '__in', port: 0 }, to: { node: 'lp', port: 0 } }, { id: 'b', from: { node: 'lp', port: 0 }, to: { node: '__out', port: 0 } }];
    if (how === 'self') cables.push({ id: 's', from: { node: 'lp', port: 1 }, to: { node: 'lp', port: 1 } });
    if (how === 'ts') {
      blocks.push({ id: 'ts', type: drv.id, x: 0, y: 0, params: {}, variant: 'mono' });
      cables.push({ id: 's1', from: { node: 'lp', port: 1 }, to: { node: 'ts', port: 0 } }, { id: 's2', from: { node: 'ts', port: 0 }, to: { node: 'lp', port: 1 } });
    }
    const preset = { version: 1, name: 'loop check', blocks, cables };
    const g = window.__tz.buildGraph(preset);
    // the cycle check: SEND -> pedal -> own RETURN is fine, OUT -> pedal -> own IN is a loop
    const cyc = how === 'ts' ? {
      ok: st.cableMakesLoop({ node: 'ts', port: 0 }, { node: 'lp', port: 1 }, preset),
      bad: st.cableMakesLoop({ node: 'ts', port: 0 }, { node: 'lp', port: 0 }, { ...preset, cables: [...cables.filter((c) => c.id !== 's1' && c.id !== 's2'), { id: 'x', from: { node: 'lp', port: 0 }, to: { node: 'ts', port: 0 } }] }),
    } : null;
    return { file: await window.tz.offline.render(g, src), nodes: g.nodes.map((n) => n.id), drv: drv && drv.name, cyc };
  }, [design, how, src]);
  const rd = (r) => readWav(r.file).chans[0];
  const plain = await loopRender(loopDs.plain, 'none', di), self = await loopRender(loopDs.loop, 'self', di), open = await loopRender(loopDs.loop, 'none', di), viaTs = await loopRender(loopDs.loop, 'ts', di);
  const xp = rd(plain), xs = rd(self), xo = rd(open), xt = rd(viaTs);
  const maxDiff = (a, b) => {
    let m = 0;
    for (let i = 0; i < Math.min(a.length, b.length); i++) m = Math.max(m, Math.abs(a[i] - b[i]));
    return m;
  };
  ok(self.nodes.includes('lp~a') && self.nodes.includes('lp') && !plain.nodes.includes('lp~a'), 'a pedal with an effects loop runs as two engine nodes: ' + self.nodes.join(', '));
  ok(segRms(xp, 0.2, 10) > 0.01 && maxDiff(xs, xp) < 1e-6, `SEND cabled to its own RETURN sounds the same as no loop (max difference ${maxDiff(xs, xp).toExponential(1)})`);
  ok(maxDiff(xo, xs) < 1e-6, 'an unplugged RETURN gets the SEND (same as cabling them together)');
  ok(maxDiff(xt, xs) > 0.01 && segRms(xt, 0.2, 10) > 0.01, `a drive pedal between SEND and RETURN changes the sound (${viaTs.drv}, difference ${maxDiff(xt, xs).toFixed(3)})`);
  ok(viaTs.cyc && viaTs.cyc.ok === false && viaTs.cyc.bad === true, 'the cycle check allows SEND -> pedal -> RETURN and still finds a real loop');
  const ip = await loopRender(loopDs.plain, 'none', imp), is = await loopRender(loopDs.loop, 'self', imp);
  const peakAt = (x) => x.reduce((b, v, i) => (Math.abs(v) > Math.abs(x[b]) ? i : b), 0);
  const ipx = rd(ip), isx = rd(is);
  ok(peakAt(isx) === peakAt(ipx) && maxDiff(isx, ipx) < 1e-6, `an impulse through the loop lines up with no loop (peak at sample ${peakAt(isx)} vs ${peakAt(ipx)}, no added delay)`);
  for (const r of [plain, self, open, viaTs, ip, is]) fs.rmSync(r.file, { force: true });
  // the loop in the factory: jacks marked in the inspector, shown in the diagram
  await win.evaluate((d) => window.__tzFactory.load(d), loopDs.loop);
  await win.evaluate(() => window.__tzCircuits.diagram().refresh(true));
  await win.waitForTimeout(300);
  const lbl = await win.evaluate(() => [...document.querySelectorAll('.fz-wd .fz-wd-label')].map((t) => t.textContent).filter((t) => /send|return/i.test(t)));
  ok(lbl.some((t) => /return 1/.test(t)) && lbl.some((t) => /send 1/.test(t)), 'the diagram marks the loop send and return: ' + lbl.join(', '));
  await win.evaluate(() => window.__tzFactory.select('jsend'));
  await win.waitForTimeout(300);
  ok(await win.evaluate(() => [...document.querySelectorAll('.fz-insp h5')].some((h) => h.textContent === 'Effects loop')), 'the jack inspector has the Effects loop setting');
  await win.screenshot({ path: path.join(S, 'circuits-loop.png') });
  await win.evaluate(() => window.__tzFactory.test(true));
  await win.waitForTimeout(1200);
  const tl = await win.evaluate(async () => {
    const m = await import('./js/pages/factory-play.js');
    const i = m.testInfo();
    const g = i.graphs[i.graphs.length - 1];
    return { nodes: g.nodes.map((n) => n.id), out: (window.__tz.state.status.outPeak || [0])[0] };
  });
  ok(tl.nodes.join() === 'fztest~a,fztest', 'Test mode plays the loop pedal as its two halves: ' + tl.nodes.join());
  await win.evaluate(() => window.__tzFactory.test(false));
  await win.waitForTimeout(300);

  // 17. direct links (no circuit in between), fan out and moving screens
  const linkD = await win.evaluate(() => {
    const { N, W, pedal, G: g0 } = window.__ct;
    const mk = (gain) => {
      const G = g0();
      N(G, 'in', 'in'); N(G, 'out', 'out'); N(G, 'vca', 'vca', {}, { gain });
      W(G, 'in', 'out', 'vca', 'in'); W(G, 'vca', 'out', 'out', 'in');
      N(G, 'G', 'analog', { name: 'G', def: 0.5 }); N(G, 'O', 'anaout', { name: 'O' }); W(G, 'G', 'cv', 'O', '@in');
      return G;
    };
    const jacks = [
      { id: 'jin', kind: 'in', edge: 'right', t: 0.3, label: 'IN' }, { id: 'jout', kind: 'out', edge: 'left', t: 0.3, label: 'OUT' },
      { id: 'jeo', kind: 'exp', edge: 'top', t: 0.25, label: 'EXP OUT', dir: 'out' }, { id: 'jx', kind: 'exp', edge: 'top', t: 0.7, label: 'EXP' },
    ];
    const led = (id, x, color, o = {}) => ({ id, kind: 'led', x, y: 16, r: 2.5, color, on: true, label: '', labelPos: 'none', bind: 'on', ...o });
    const ctls = [
      { id: 'tg', kind: 'toggle', ways: 2, orient: 'v', x: 18, y: 70, pos: 0, label: 'TG', labelPos: 'below' },
      { id: 'kn', kind: 'knob', x: 45, y: 70, r: 6.5, style: 'boss', value: 0, label: 'KN', labelPos: 'below' },
      { id: 'kd', kind: 'knob', x: 72, y: 70, r: 6.5, style: 'boss', value: 0.2, label: 'KD', labelPos: 'below' },
      led('l1', 15, '#ff2a1a'), led('l2', 30, '#3fa8ff'), led('lr', 50, '#ffffff', { look: 'rgb', r: 3 }),
      { id: 'sc', kind: 'screen', x: 45, y: 40, w: 40, h: 16, type: 'oled', text: '', label: 'SCR', labelPos: 'none', shows: 'custom', script: 'function draw()\n  clear()\nend\n' },
    ];
    const d = pedal('Links', [{ id: 'A1', name: 'Loud', graph: mk(1) }, { id: 'A2', name: 'Half', graph: mk(0.5) }], { jacks, ctls, wires: [] });
    d.enc.w = 90;
    d.enc.h = 110;
    return d;
  });
  await win.evaluate((d) => window.__tzFactory.load(d), linkD);
  await win.evaluate(() => { const g = window.__tzCircuits.diagram(); g.setHeight(560); g.refresh(true); });
  await win.waitForTimeout(400);
  // audio: IN straight to OUT
  await wdDrag('jack:jin', 'jack:jout');
  d = await D();
  ok(d.circuit.wires.length === 1 && d.circuit.wires[0].a.n === 'jack:jin' && d.circuit.wires[0].b.n === 'jack:jout', 'dragged the IN jack straight to the OUT jack');
  const straight = await renderBlock(d, {});
  // then IN fanned out to both circuits, both into OUT
  await win.evaluate(() => window.__tzCircuits.diagram().removeWire((window.__tzFactory.design().circuit.wires[0] || {}).id));
  await wdDrag('jack:jin', 'in:A1:in');
  await wdDrag('jack:jin', 'in:A2:in');
  await wdDrag('out:A1:out', 'jack:jout');
  await wdDrag('out:A2:out', 'jack:jout');
  d = await D();
  ok(d.circuit.wires.filter((w) => w.a.n === 'jack:jin').length === 2 && d.circuit.wires.filter((w) => w.b.n === 'jack:jout').length === 2, 'one IN jack fanned out to two circuits by dragging from it twice');
  const fanned = await renderBlock(d, {});
  const xs0 = readWav(straight.file).chans[0], xf0 = readWav(fanned.file).chans[0], xd0 = readWav(di).chans[0];
  const rs = segRms(xs0, 0.2, 10), rf = segRms(xf0, 0.2, 10), rdi = segRms(xd0, 0.2, 10);
  ok(rs > 0.01 && Math.abs(rs / rdi - 1) < 0.03, `IN straight to OUT passes the guitar through as it is (${rs.toFixed(4)} vs ${rdi.toFixed(4)})`);
  ok(Math.abs(rf / rs - 1.5) < 0.06, `IN split into a full and a half volume circuit adds up to 1.5 times (${(rf / rs).toFixed(3)})`);
  fs.rmSync(straight.file, { force: true });
  fs.rmSync(fanned.file, { force: true });
  // controls and jacks straight to LEDs, an OUT jack and a control; one knob fanned out to two circuits and an LED
  await wdDrag('ctl:tg', 'led:l1');
  await wdDrag('ctl:kn', 'k:A1:G');
  await wdDrag('ctl:kn', 'k:A2:G');
  await wdDrag('ctl:kn', 'led:l2');
  await wdDrag('ctl:kn', 'jo:jeo');
  await wdDrag('ctl:tg', 'led:lr:r');
  await wdDrag('ctl:kn', 'led:lr:g');
  await wdDrag('jack:jx', 'led:lr:b');
  await wdDrag('jack:jx', 'cin:kd');
  d = await D();
  const cOf = (id) => d.ctls.find((c) => c.id === id);
  const knT = [cOf('kn').map, ...(cOf('kn').more || [])].map((m) => m.to);
  ok(cOf('l1').bind === 'src' && cOf('l1').src.ctl === 'tg', 'a toggle wired straight to an LED');
  ok(knT.includes('A1.G') && knT.includes('A2.G') && cOf('l2').src && cOf('l2').src.ctl === 'kn' && d.jacks.find((j) => j.id === 'jeo').from.ctl === 'kn', 'one knob fanned out to two circuit inputs, an LED and the EXP OUT jack');
  const ch = cOf('lr').chans || {};
  ok(ch.r && ch.r.ctl === 'tg' && ch.g && ch.g.ctl === 'kn' && ch.b && ch.b.jack === 'jx', 'the RGB LED has an input per colour, each wired from a different source');
  ok(cOf('kd').from && cOf('kd').from.jack === 'jx', 'the EXP jack wired to move a knob');
  const wdPorts = await win.evaluate(() => ['led:lr:r', 'led:lr:g', 'led:lr:b', 'cin:kd', 'cin:kn'].filter((k) => !document.querySelector(`.fz-wd [data-wp="${k}"]`)));
  ok(!wdPorts.length, 'the diagram shows R, G and B inputs on the RGB LED and an input on each control' + (wdPorts.length ? ' (missing ' + wdPorts.join(', ') + ')' : ''));
  // refusal: audio cannot drive an LED
  const nBefore = JSON.stringify((await D()).ctls.find((c) => c.id === 'l1'));
  await wdDrag('jack:jin', 'led:l1');
  const refusal = await win.evaluate(() => window.__tzCircuits.diagram().lastRefusal());
  ok(/audio/i.test(refusal) && JSON.stringify((await D()).ctls.find((c) => c.id === 'l1')) === nBefore, 'an audio jack dropped on an LED is refused: ' + refusal);
  // deleting one wire of a fan out keeps the others
  // the knob's wires all leave the same port, so pick this one by itself
  await win.evaluate(() => document.querySelector('.fz-wd .fz-wd-wirehit[data-ww="m:kn:1"]').dispatchEvent(new MouseEvent('click', { bubbles: true })));
  await win.waitForTimeout(100);
  await win.keyboard.press('Delete');
  await win.waitForTimeout(200);
  d = await D();
  const knT2 = [cOf('kn').map, ...(cOf('kn').more || [])].filter((m) => m && m.to).map((m) => m.to);
  ok(knT2.length === 1 && knT2[0] === 'A1.G' && cOf('l2').src && d.jacks.find((j) => j.id === 'jeo').from, 'deleting one wire of the knob leaves its other wires: ' + knT2.join(', '));
  await wdDrag('ctl:kn', 'k:A2:G');
  await win.screenshot({ path: path.join(S, 'circuits-links-diagram.png') });
  // Test mode: the LEDs follow, the knob reaches both circuits, the jack moves the other knob
  await win.evaluate(() => window.__tzFactory.test(true));
  await win.waitForTimeout(1800);
  const lt = () => win.evaluate(async () => {
    const m = await import('./js/pages/factory-play.js');
    const st = window.__tz.state.status.blocks.fztest;
    const fills = [...document.querySelectorAll('.fz-stage .led-part circle')].map((c) => c.getAttribute('fill'));
    return { leds: Object.fromEntries(m.testLeds().map((l) => [l.cid, l.on])), cv: st && st.cv, vals: m.testValues(), fills };
  });
  let L = await lt();
  ok(L.leds.l1 === false && L.leds.lr === false, 'in Test mode the toggle LED is off and the RGB LED dark to start: ' + JSON.stringify(L.leds));
  await win.evaluate(() => window.__tzFactory.testSet('tg', 1));
  await win.waitForTimeout(300);
  L = await lt();
  ok(L.leds.l1 === true, 'flipping the toggle lights the LED wired straight to it');
  ok(L.leds.lr === '#ff0000' && L.fills.includes('#ff0000'), 'the toggle lights the red of the RGB LED (' + L.leds.lr + ')');
  await win.evaluate(() => window.__tzFactory.testSet('kn', 0.8));
  await win.waitForTimeout(900);
  L = await lt();
  ok(L.cv && Math.abs(L.cv[0] - 0.8) < 0.01 && Math.abs(L.cv[1] - 0.8) < 0.01, 'the knob reaches both circuits (' + (L.cv && L.cv.slice(0, 2).map((v) => v.toFixed(2))) + ')');
  ok(typeof L.leds.l2 === 'string' && L.leds.l2 !== '#3fa8ff', 'and sets the brightness of its LED (' + L.leds.l2 + ')');
  ok(L.leds.lr === '#ffcc00' && L.fills.includes('#ffcc00'), 'the knob adds green to the RGB LED: ' + L.leds.lr);
  await win.evaluate(async () => (await import('./js/pages/factory-play.js')).playSetParam('u.x.jx', 1));
  await win.waitForTimeout(300);
  L = await lt();
  ok(L.leds.lr === '#ffccff' && L.fills.includes('#ffccff'), 'an expression pedal on the EXP jack adds blue: ' + L.leds.lr);
  ok(L.vals['u.kd'] === 1, 'and moves the knob wired to it (' + L.vals['u.kd'] + ')');
  await win.evaluate(() => window.__tzFactory.testSet('tg', 0));
  await win.waitForTimeout(300);
  L = await lt();
  ok(L.leds.lr === '#00ccff' && L.leds.l1 === false, 'switching the toggle off takes the red out again: ' + L.leds.lr);
  await win.screenshot({ path: path.join(S, 'circuits-links-test.png') });
  await win.evaluate(() => window.__tzFactory.test(false));
  await win.waitForTimeout(300);
  // move the screen box: its place is saved with the design and comes back on load
  const sb0 = await win.evaluate(() => { const b = window.__tzCircuits.diagram().geo().sboxes.find((x) => x.c.id === 'sc'); return { x: b.x, y: b.y }; });
  const zoom = await win.evaluate(() => { const g = document.querySelector('.fz-wd-svg > g').getAttribute('transform'); return +/scale\(([\d.]+)/.exec(g)[1]; });
  const hd = await center('.fz-wd [data-wsdrag="sc"]');
  await drag({ x: hd.x - 40, y: hd.y }, { x: hd.x - 40 + 160 * zoom, y: hd.y + 64 * zoom });
  d = await D();
  const scD = d.ctls.find((c) => c.id === 'sc');
  ok(typeof scD.wx === 'number' && Math.abs(scD.wx - (sb0.x - 230) - 160) <= 8 && Math.abs(scD.wy - sb0.y - 64) <= 8, `dragged the screen box in the diagram (${sb0.x - 230},${sb0.y} -> ${scD.wx},${scD.wy})`);
  await win.evaluate((d) => window.__tzFactory.load(d), d);
  await win.waitForTimeout(300);
  const sb1 = await win.evaluate(() => { const b = window.__tzCircuits.diagram().geo().sboxes.find((x) => x.c.id === 'sc'); return { x: b.x, y: b.y }; });
  ok(sb1.x === 230 + scD.wx && sb1.y === scD.wy, 'the screen keeps its place after loading the design again');
  await win.screenshot({ path: path.join(S, 'circuits-links-moved.png') });
  // screen output straight to an LED and a control (compiled, no Test mode needed)
  const scr = await win.evaluate(async () => {
    const F = await import('./js/pages/factory-circuit.js');
    const d = JSON.parse(JSON.stringify(window.__tzFactory.design()));
    const sc = d.ctls.find((c) => c.id === 'sc');
    sc.sio = { ins: [{ id: 'i1', name: 'Knob', sig: 'n', from: { ctl: 'kn' } }], outs: [{ id: 'o1', name: 'Lamp', sig: 'b' }] };
    const l1 = d.ctls.find((c) => c.id === 'l1');
    l1.src = { scr: 'sc', o: 0 };
    d.ctls.find((c) => c.id === 'tg').from = { scr: 'sc', o: 0 };
    const def = F.designToDef(d, { id: 'custom.scrlink' });
    const led = def.controls.find((c) => c.cid === 'l1');
    const pl = (def.plinks || []).find((l) => l.from === 'u.s.sc.0');
    return { off: led.ledFn({ 'u.s.sc.0': 0 }, { bypass: false }, null), on: led.ledFn({ 'u.s.sc.0': 1 }, { bypass: false }, null), moves: pl && pl.to === 'u.tg' && pl.value({ 'u.s.sc.0': 1 }) === 1, reads: F.readLink(d, sc.sio.ins[0].from, { 'u.kn': 0.4 }, null, {}) };
  });
  ok(scr.off === null && scr.on === true && scr.moves && Math.abs(scr.reads - 0.4) < 1e-9, 'a screen output lights an LED and flips a switch, a screen input reads a knob straight');
  // on the board: the knob moves a volume pedal through the EXP OUT jack, the LEDs light
  await win.evaluate(() => window.__tzFactory.save(true));
  await win.waitForFunction(() => !!window.__tzFactory.design().blockId, null, { timeout: 5000 });
  const linkId = (await D()).blockId;
  const savedRec = await win.evaluate(async (id) => (await import('./js/catalog/custom.js')).customBlocks().find((r) => r.id === id), linkId);
  ok(savedRec && savedRec.design.ctls.find((c) => c.id === 'sc').wx === scD.wx, 'the saved block keeps the screen position');
  await win.click('#tabs [data-tab="board"]');
  await win.waitForTimeout(400);
  const lids = await win.evaluate(async (id) => {
    const st = await import('./js/state.js');
    const a = st.addBlock(id, 300, 160), v = st.addBlock('tz.dimmer', 620, 160);
    st.connect({ node: a.id, port: 'c0' }, { node: v.id, port: 'c0' });
    st.connect({ node: '__in', port: 0 }, { node: a.id, port: 0 });
    st.connect({ node: a.id, port: 0 }, { node: '__out', port: 0 });
    st.syncGraph();
    return { a: a.id, v: v.id };
  }, linkId);
  await win.waitForTimeout(1200);
  const lb = () => win.evaluate(async (ids) => {
    const st = await import('./js/state.js');
    const fills = [...document.querySelectorAll(`[data-node="${ids.a}"] circle.led`)].map((c) => c.getAttribute('fill'));
    const all = [...document.querySelectorAll(`[data-node="${ids.a}"] circle`)].map((c) => c.getAttribute('fill'));
    return { pos: st.uiParams(st.blockById(ids.v)).pos, fills, all };
  }, lids);
  await win.evaluate(async (ids) => { const st = await import('./js/state.js'); st.setParam(ids.a, 'u.kn', 0.3); }, lids);
  await win.waitForTimeout(500);
  let B1 = await lb();
  await win.evaluate(async (ids) => { const st = await import('./js/state.js'); st.setParam(ids.a, 'u.kn', 0.9); }, lids);
  await win.waitForTimeout(500);
  const B2 = await lb();
  ok(Math.abs(B1.pos - 0.3) < 0.01 && Math.abs(B2.pos - 0.9) < 0.01, `on the board the knob wired straight to EXP OUT moves the volume pedal (${B1.pos} then ${B2.pos})`);
  const offFills = B2.fills.slice();
  await win.evaluate(async (ids) => { const st = await import('./js/state.js'); st.setParam(ids.a, 'u.tg', 1); }, lids);
  await win.waitForTimeout(700);
  B1 = await lb();
  ok(!offFills.includes('#ff2a1a') && B1.fills.includes('#ff2a1a'), 'on the board the toggle lights its LED (' + offFills.join(' ') + ' -> ' + B1.fills.join(' ') + ')');
  ok(!B2.all.includes('#ffe600') && B1.all.includes('#ffe600'), 'and the RGB LED mixes red with the knob\'s green (#ffe600)');
  await win.screenshot({ path: path.join(S, 'circuits-links-board.png') });
  await win.evaluate(async (ids) => { const st = await import('./js/state.js'); st.removeBlocks([ids.a, ids.v]); }, lids);
  await win.click('#tabs [data-tab="factory"]');
  await win.waitForTimeout(300);

  await win.evaluate(() => ['tz.factory.wd.v1', 'tz.circuits.filter.v1'].forEach((k) => localStorage.removeItem(k)));
  ok(errs.length === 0, 'no console errors');
  if (errs.length) console.log(errs.join('\n'));
  console.log(fails ? `${fails} failed` : 'all passed');
  await app.close();
  fs.rmSync(data, { recursive: true, force: true });
  process.exit(fails ? 1 : 0);
})();
