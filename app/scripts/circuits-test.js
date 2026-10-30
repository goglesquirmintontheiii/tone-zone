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
  const tsDrive = ts.graph.nodes.find((n) => n.t === 'knob' && n.name === 'Drive');
  const wobMix = wob.graph.nodes.find((n) => n.t === 'knob' && n.name === 'Mix');
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
  ok((await win.evaluate(() => window.__tzFactory.selection())) === newKnob.id && (await win.evaluate(() => document.querySelectorAll('.fz-insp .fz-mapbox').length)) === tos.length, 'the inspector lists every target of the knob (' + tos.length + ')');
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
  const lvlK = ts.graph.nodes.find((n) => n.t === 'knob' && n.name === 'Level');
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

  await win.evaluate(() => ['tz.factory.wd.v1', 'tz.circuits.filter.v1'].forEach((k) => localStorage.removeItem(k)));
  ok(errs.length === 0, 'no console errors');
  if (errs.length) console.log(errs.join('\n'));
  console.log(fails ? `${fails} failed` : 'all passed');
  await app.close();
  fs.rmSync(data, { recursive: true, force: true });
  process.exit(fails ? 1 : 0);
})();
