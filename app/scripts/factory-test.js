// Pedal Factory: add a knob, drag it, change the enclosure colour, per-part materials, patterns, wear, undo,
// old designs loading, LED selection, multi-select editing, mirror mode, a 12 switch DIP, save as block (Custom
// filter, on the board), test mode (graph override and restore), an offline render of the custom block, the
// footswitch nut material, the dot grid toggle, an LED ring encoder, XY pad and step buttons, an angled jack wired
// on the board, the My pedals library, palette variants (dots on the tiles), the LED ring down to 2 curved LEDs, the
// toggle bank as a DIP look, the material part switcher (no quick colour rows), foot pedal materials, removed
// controls migrating, and a footswitch jack on a saved block as a control jack.
const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { makeDI, measure } = require('./loudness');
const S = process.env.SHOTS || '/tmp';
(async () => {
  // a data folder of our own, so saved custom blocks do not pile up in the real one
  const data = fs.mkdtempSync(path.join(os.tmpdir(), 'tz-factory-'));
  const app = await electron.launch({ executablePath: require('electron'), args: [path.join(__dirname, '..'), '--no-sandbox'], env: { ...process.env, XDG_DATA_HOME: data } });
  const win = await app.firstWindow();
  const errs = [];
  win.on('pageerror', (e) => (errs.push('PAGEERROR ' + e.stack), process.env.FZ_LOG && console.log('PAGEERROR ' + e.message)));
  win.on('console', (m) => (m.type() === 'error' ? errs.push('CONSOLE ' + m.text()) : process.env.FZ_LOG && console.log('page: ' + m.text())));
  await win.setViewportSize({ width: 1600, height: 950 }).catch(() => {});
  await win.waitForFunction(() => window.__tz && window.__tz.ready, null, { timeout: 120000 });
  let fails = 0;
  const ok = (cond, msg) => {
    console.log((cond ? 'ok   ' : 'FAIL ') + msg);
    if (!cond) fails++;
  };
  const D = () => win.evaluate(() => JSON.parse(JSON.stringify(window.__tzFactory.design())));
  const center = async (sel) => {
    const b = await (await win.$(sel)).boundingBox();
    return [b.x + b.width / 2, b.y + b.height / 2];
  };

  // 0. a design saved by an older version (sketch circuit, parameter names) still loads, now wired up
  await win.evaluate(() => {
    const old = {
      name: 'Old Fuzz',
      enc: { size: '125B', w: 66, h: 122, shape: 'box', radius: 3, finish: 'solid', color: '#c9302c', color2: '#5a3fb0', angle: 90, flake: 0.5 },
      labels: { font: "'Barlow Condensed', sans-serif", size: 3.4, color: '#f4f1e8' },
      title: { id: 'title', text: 'OLD', x: 33, y: 60, size: 8, font: "'Barlow Condensed', sans-serif", color: '#fff', weight: 800, ls: 0.6 },
      sub: { id: 'sub', text: '', hidden: true, x: 0, y: 0, size: 4, font: "'Barlow Condensed', sans-serif", color: '#fff', weight: 500, ls: 0.3 },
      art: [],
      ctls: [
        { id: 'k1', kind: 'knob', x: 20, y: 25, style: 'boss', r: 8, value: 0.5, label: 'FUZZ', labelPos: 'below', param: 'Fuzz' },
        { id: 'k2', kind: 'knob', x: 46, y: 25, style: 'boss', r: 8, value: 0.5, label: 'VOLUME', labelPos: 'below', param: 'Volume' },
        { id: 'f1', kind: 'foot', x: 33, y: 100, style: 'stomp', r: 7, label: '', labelPos: 'none', param: 'Bypass' },
      ],
      jacks: [{ id: 'j1', kind: 'in', edge: 'right', t: 0.3, label: 'IN' }, { id: 'j2', kind: 'out', edge: 'left', t: 0.3, label: 'OUT' }],
      circuit: { type: 'fuzz', blocks: [{ id: 'b1', kind: 'fuzz' }, { id: 'b2', kind: 'tone' }] },
    };
    localStorage.setItem('tz.factory.design.v1', JSON.stringify(old));
  });
  await win.click('#tabs [data-tab="factory"]');
  await win.waitForSelector('.fz-stage');
  await win.waitForTimeout(300);
  const d00 = await D();
  const in00 = d00.circuit.insts && d00.circuit.insts[0];
  ok(d00.name === 'Old Fuzz' && d00.circuit.v === 3 && in00 && in00.graph.nodes.some((n) => n.t === 'fuzz'), 'old design loads with a real circuit (migrated to a circuit graph)');
  // a control's target is a circuit input wired to the fuzz value it used to drive
  const drives = (m) => {
    const k = m && m.to && m.to.split('.')[1];
    const w = in00.graph.wires.find((x) => x.a.n === k);
    const n = w && in00.graph.nodes.find((x) => x.id === w.b.n);
    return n ? n.t + w.b.p : '';
  };
  ok(drives(d00.ctls[0].map) === 'fuzz@gain' && drives(d00.ctls[1].map) === 'fuzz@level' && d00.ctls[2].map.to === 'bypass', 'old controls wired by their names');

  // start from a known design
  await win.click('#fzTemplates');
  await win.click('[data-template="drive"]');
  await win.waitForTimeout(400);
  const d0 = await D();
  ok(d0.name === 'Classic Drive' && d0.ctls.length === 5, 'template loaded');
  ok(d0.ctls.filter((c) => c.kind === 'knob').every((c) => c.map && c.map.to.startsWith(d0.circuit.insts[0].id + '.')), 'template knobs are wired to the circuit');

  // 1. add a knob from the parts panel (every tile back on its first variant: the pick is remembered)
  await win.click('.fz-tabs [data-t="parts"]');
  await win.evaluate(() => document.querySelectorAll('.fz-vdots [data-var="0"]').forEach((d) => d.click()));
  await win.click('.fz-tile[data-part="knob"]');
  await win.waitForTimeout(300);
  const d1 = await D();
  const knob = d1.ctls.find((c) => !d0.ctls.some((o) => o.id === c.id));
  ok(d1.ctls.length === 6 && knob && knob.kind === 'knob', 'knob added');
  ok(knob.map && knob.map.to && knob.label, `new knob wired to the next free value (${knob.map.to}, ${knob.label})`);
  ok((await win.evaluate(() => window.__tzFactory.selection())) === knob.id, 'new knob is selected');

  // 2. drag it on the stage
  const [cx, cy] = await center(`.fz-stage [data-id="${knob.id}"]`);
  await win.mouse.move(cx, cy);
  await win.mouse.down();
  await win.mouse.move(cx + 40, cy + 60, { steps: 8 });
  await win.screenshot({ path: path.join(S, 'factory-drag.png') });
  await win.mouse.up();
  await win.waitForTimeout(200);
  const k2 = (await D()).ctls.find((c) => c.id === knob.id);
  ok(k2.x > knob.x + 3 && k2.y > knob.y + 3, `knob dragged (${knob.x},${knob.y}) -> (${k2.x},${k2.y})`);
  ok(Math.abs(k2.x / 2.5 - Math.round(k2.x / 2.5)) < 1e-6, 'drag snapped to the grid');

  // 3. change the enclosure colour in its material panel (the only colour picker: no quick colour row above it)
  await win.keyboard.press('Escape');
  await win.waitForSelector('[data-mtp="fz-enc"] .mtp-pick');
  ok(!(await win.$('.fz-swatches[data-key="enc"]')), 'no quick colour row above the enclosure material');
  const before = (await D()).enc.mat.c;
  await win.evaluate(() => { const i = document.querySelector('[data-mtp="fz-enc"] .mtp-pick'); i.value = '#c9302c'; i.dispatchEvent(new Event('change')); });
  await win.waitForTimeout(200);
  ok((await D()).enc.mat.c === '#c9302c', 'enclosure colour changed');
  const fill = await win.evaluate(() => document.querySelector('.fz-stage [data-body]').getAttribute('fill'));
  ok(/^url\(#mt-metal-.*c9302c/.test(fill), 'pedal repainted');
  await win.screenshot({ path: path.join(S, 'factory-colour.png') });

  // 4. undo brings the colour back, a second undo puts the knob back where it was
  await win.click('#fzUndo');
  await win.waitForTimeout(200);
  ok((await D()).enc.mat.c === before, 'undo restored the colour');
  await win.click('#fzUndo');
  await win.waitForTimeout(200);
  const k3 = (await D()).ctls.find((c) => c.id === knob.id);
  ok(k3 && k3.x === knob.x && k3.y === knob.y, 'undo restored the knob position');
  await win.click('#fzRedo');
  await win.waitForTimeout(200);
  ok((await D()).ctls.find((c) => c.id === knob.id).x === k2.x, 'redo works');

  // 5. per-knob materials: one wood, another glow in the dark
  const knobs = (await D()).ctls.filter((c) => c.kind === 'knob');
  await win.click(`.fz-stage [data-id="${knobs[0].id}"]`);
  await win.click('.fz-partmat .mtp-mats [data-v="wood"]');
  await win.waitForTimeout(200);
  await win.click('.fz-partmat .mtp-subs [data-v="koa"]');
  await win.waitForTimeout(200);
  await win.click(`.fz-stage [data-id="${knobs[1].id}"]`);
  await win.click('.fz-partmat .mtp-mats [data-v="glow"]');
  await win.waitForTimeout(200);
  let d5 = await D();
  const km = (id) => (d5.ctls.find((c) => c.id === id).mat || {});
  ok(km(knobs[0].id).m === 'wood' && km(knobs[0].id).s === 'koa', 'first knob is koa wood');
  ok(km(knobs[1].id).m === 'glow', 'second knob glows');
  ok(!km(knobs[2].id).m, 'third knob kept its stock look');
  ok(await win.evaluate((id) => !!document.querySelector(`.fz-stage [data-id="${id}"] [fill^="url(#mt-wood-koa"]`), knobs[0].id), 'wood knob drawn in its material');

  // 6. a pattern layer and wear on the enclosure
  await win.keyboard.press('Escape');
  await win.waitForSelector('.fz-pat-type');
  await win.selectOption('.fz-pat-type', 'checker');
  await win.waitForTimeout(300);
  d5 = await D();
  ok(d5.enc.patterns.length === 1 && d5.enc.patterns[0].type === 'checker', 'checkered pattern added');
  ok(await win.evaluate(() => !!document.querySelector('.fz-stage [data-pattern]')), 'pattern drawn');
  await win.click('[data-mtp="fz-enc"] [data-wear="scratch"]');
  await win.waitForTimeout(200);
  ok(((await D()).enc.mat.w || {}).scratch > 0, 'enclosure scratched');
  await win.screenshot({ path: path.join(S, 'factory-materials.png') });

  // 7. undo steps back through wear, pattern and the knob material
  await win.click('#fzUndo');
  await win.waitForTimeout(150);
  ok(!(await D()).enc.mat.w, 'undo removed the wear');
  await win.click('#fzUndo');
  await win.waitForTimeout(150);
  ok((await D()).enc.patterns.length === 0, 'undo removed the pattern');
  await win.click('#fzUndo');
  await win.waitForTimeout(150);
  d5 = await D();
  ok(!km(knobs[1].id).m && km(knobs[0].id).m === 'wood', 'undo put the second knob back to stock');
  await win.click('#fzRedo');
  await win.waitForTimeout(150);
  d5 = await D();
  ok(km(knobs[1].id).m === 'glow', 'redo brought the glow knob back');

  // 8. other panels render without errors
  await win.click('.fz-tabs [data-t="layers"]');
  await win.click('.fz-tabs [data-t="circuit"]');
  await win.click('.fz-tabs [data-t="parts"]');

  // 9. LEDs can be selected once dropped on the pedal
  await win.click('#fzTemplates');
  await win.click('[data-template="drive"]');
  await win.waitForTimeout(300);
  await win.click('.fz-tile[data-part="led"]');
  await win.waitForTimeout(200);
  const ledId = (await D()).ctls.filter((c) => c.kind === 'led').pop().id;
  await win.keyboard.press('Escape');
  await win.waitForTimeout(100);
  const [lx, ly] = await center(`.fz-stage [data-id="${ledId}"]`);
  await win.mouse.click(lx, ly);
  await win.waitForTimeout(200);
  ok((await win.evaluate(() => window.__tzFactory.selection())) === ledId, 'a dropped LED can be clicked and selected');
  ok(await win.evaluate(() => !!document.querySelector('.fz-insp h3') && /LED/.test(document.querySelector('.fz-insp h3').textContent)), 'LED inspector shown');

  // 10. multi-select: shift click three knobs, mixed values, one edit for all, then a marquee
  const kn = (await D()).ctls.filter((c) => c.kind === 'knob');
  await win.evaluate((id) => { const d = window.__tzFactory.design(); d.ctls.find((c) => c.id === id).style = 'mxr'; }, kn[0].id);
  await win.keyboard.press('Escape');
  for (const [i, k] of kn.entries()) {
    const [x, y] = await center(`.fz-stage [data-id="${k.id}"]`);
    if (i) await win.keyboard.down('Shift');
    await win.mouse.click(x, y);
    if (i) await win.keyboard.up('Shift');
    await win.waitForTimeout(120);
  }
  ok((await win.evaluate(() => window.__tzFactory.selected().length)) === 3, 'shift click selected three knobs');
  ok(await win.evaluate(() => /3 knobs/.test(document.querySelector('.fz-insp h3').textContent)), 'inspector says 3 knobs');
  ok(await win.evaluate(() => document.querySelectorAll('.fz-insp .fz-row.mixed').length > 0), 'mixed values are marked');
  await win.screenshot({ path: path.join(S, 'factory-multiselect.png') });
  await win.selectOption('.fz-insp .fz-sec select >> nth=0', 'chrome');
  await win.waitForTimeout(200);
  ok((await D()).ctls.filter((c) => c.kind === 'knob').every((c) => c.style === 'chrome'), 'one edit changed the cap of all three knobs');
  await win.click('.fz-insp [data-align="cy"]');
  await win.waitForTimeout(150);
  const ys = new Set((await D()).ctls.filter((c) => c.kind === 'knob').map((c) => c.y));
  ok(ys.size === 1, 'align middle lined them up');
  // marquee from empty space over the top row of knobs
  await win.keyboard.press('Escape');
  const sb = await (await win.$('.fz-stage [data-body]')).boundingBox();
  const kb = await (await win.$(`.fz-stage [data-id="${kn[0].id}"]`)).boundingBox();
  await win.mouse.move(sb.x - 30, kb.y - 12);
  await win.mouse.down();
  await win.mouse.move(sb.x + sb.width + 30, kb.y + kb.height + 6, { steps: 6 });
  await win.mouse.up();
  await win.waitForTimeout(200);
  const msel = await win.evaluate(() => window.__tzFactory.selected());
  ok(kn.every((k) => msel.includes(k.id)), `marquee selected the knob row (${msel.length} items)`);

  // 11. mirror mode: new parts get a twin, moving one moves the other
  await win.keyboard.press('Escape');
  await win.click('#fzTemplates');
  await win.click('[data-template="blank"]');
  await win.waitForTimeout(300);
  await win.click('#fzMirror');
  await win.click('#fzMirrorAxis [data-v="v"]');
  await win.waitForTimeout(150);
  ok((await D()) && (await win.evaluate(() => document.querySelector('#fzMirror').classList.contains('on'))), 'mirror mode on');
  await win.click('.fz-tile[data-part="knob"]');
  await win.waitForTimeout(200);
  let dm = await D();
  const mk = dm.ctls.filter((c) => c.kind === 'knob');
  ok(mk.length === 2 && mk[0].twin === mk[1].id && Math.abs(mk[0].x + mk[1].x - dm.enc.w) < 0.01 && mk[0].y === mk[1].y, 'adding a knob added its mirror twin');
  ok(mk[0].map.to && mk[1].map.to && mk[0].map.to !== mk[1].map.to, 'the twin drives its own value');
  await win.keyboard.press('Escape');
  const [mx, my] = await center(`.fz-stage [data-id="${mk[0].id}"]`);
  await win.mouse.move(mx, my);
  await win.mouse.down();
  await win.mouse.move(mx - 25, my + 30, { steps: 6 });
  await win.mouse.up();
  await win.waitForTimeout(200);
  dm = await D();
  const m0 = dm.ctls.find((c) => c.id === mk[0].id), m1 = dm.ctls.find((c) => c.id === mk[1].id);
  ok(m0.x < mk[0].x && Math.abs(m0.x + m1.x - dm.enc.w) < 0.01 && m0.y === m1.y && m0.y > mk[0].y, 'moving one knob moved its twin the mirrored way');
  await win.click(`.fz-stage [data-id="${mk[0].id}"]`);
  await win.click('.fz-insp .fz-seg [data-v="10.5"]');
  await win.waitForTimeout(150);
  ok((await D()).ctls.find((c) => c.id === mk[1].id).r === 10.5, 'resizing one knob resized its twin');
  await win.click('.fz-tile[data-part="out"]');
  await win.waitForTimeout(150);
  const jt = (await D()).jacks.filter((j) => j.kind === 'out');
  ok(jt.length >= 2 && jt.some((j) => j.edge === 'left') && jt.some((j) => j.edge === 'right' && j.twin), 'a jack got a twin on the other edge');
  await win.screenshot({ path: path.join(S, 'factory-mirror.png') });
  await win.click('#fzMirrorAxis [data-v="h"]');
  await win.waitForTimeout(150);
  await win.click('.fz-tile[data-part="led"]');
  await win.waitForTimeout(200);
  dm = await D();
  const ml = dm.ctls.filter((c) => c.kind === 'led');
  ok(ml.length === 2 && Math.abs(ml[0].y + ml[1].y - dm.enc.h) < 0.01 && ml[0].x === ml[1].x, 'horizontal mirror puts the twin below');
  await win.click('#fzMirrorAxis [data-v="v"]');
  await win.click('#fzMirror');
  await win.waitForTimeout(100);

  // 12. a DIP switch with 12 switches, each driving something different
  await win.click('#fzTemplates');
  await win.click('[data-template="blank"]');
  await win.waitForTimeout(300);
  await win.click('.fz-tabs [data-t="circuit"]');
  await win.click('.cl-inst [data-cl="rminst"]');
  await win.fill('.cl-search', '');
  await win.dispatchEvent('.cl-search', 'input');
  await win.click('[data-circuit-id="b.c-drivedelay"] [data-cl="use"]');
  await win.waitForTimeout(200);
  await win.click('.fz-tabs [data-t="parts"]');
  await win.click('.fz-tile[data-part="dip"]');
  await win.waitForTimeout(200);
  const nIn = await win.$('.fz-insp .fz-sec .fz-num');
  await nIn.fill('12');
  await nIn.press('Enter');
  await win.waitForTimeout(200);
  ok(!(await win.$('.fz-insp .fz-wiring')) && !(await win.$('.fz-insp .fz-dipmap')), 'no Drives section in the control inspector');
  // wire each switch the way the wiring diagram does: values nothing drives yet add a circuit input
  await win.evaluate(async () => {
    const m = await import('./js/pages/factory-circuit.js');
    const d = window.__tzFactory.design();
    const dip = d.ctls.find((c) => c.kind === 'dip');
    dip.maps = [];
    for (let i = 0; i < 12; i++) {
      const used = new Set(d.ctls.flatMap((c) => [c.map, ...(c.more || []), ...(c.maps || [])]).map((x) => x && x.to));
      const opts = m.targetsFor(d.circuit, 'dip').map((t) => t[0]).filter((v) => v && v !== 'bypass' && !v.endsWith('.on') && !v.endsWith('.tap'));
      const v = opts.find((x) => x.includes('.+')) || opts.find((x) => !used.has(x)) || opts.find((x) => !dip.maps.some((y) => y && y.to === x));
      const info = v && m.targetInfo(d.circuit, v);
      if (!info) console.log('dip ' + i + ': no target among ' + opts.length);
      dip.maps[i] = info ? m.mapTo(d.circuit, v, { min: info.def ?? info.min, max: info.def === info.max ? info.min : info.max, taper: 'lin' }) : null;
    }
    window.__tzFactory.load(JSON.parse(JSON.stringify(d)));
  });
  await win.waitForTimeout(200);
  const dd = await D();
  const dip = dd.ctls.find((c) => c.kind === 'dip');
  ok(dip.n === 12 && dip.bits.length === 12, 'DIP switch has 12 switches');
  ok(new Set(dip.maps.map((m) => m && m.to)).size === 12, '12 switches drive 12 different values');
  const der = await win.evaluate(async (dipId) => {
    const m = await import('./js/pages/factory-circuit.js');
    const def = m.designToDef(window.__tzFactory.design(), { id: 'custom.check' });
    const ui = {};
    for (const c of def.controls) if (c.p) ui[c.p] = c.def;
    const off = def.derive(ui);
    for (let i = 0; i < 12; i++) ui[`u.${dipId}.${i}`] = 1;
    const on = def.derive(ui);
    const changedKeys = Object.keys(on).filter((k) => on[k] !== off[k]);
    return { dipCtls: def.controls.filter((c) => c.cid.startsWith(dipId + '.')).length, changed: changedKeys.length };
  }, dip.id);
  ok(der.dipCtls === 12 && der.changed >= 10, `each DIP switch is its own block control (${der.dipCtls}) and flips its value (${der.changed} changed)`);
  await win.screenshot({ path: path.join(S, 'factory-dip12.png') });

  // 13. save as block: shows up under Custom, can be added to the board and draws its controls
  await win.click('#fzTemplates');
  await win.click('[data-template="glass"]');
  await win.waitForTimeout(300);
  await win.screenshot({ path: path.join(S, 'factory-glass.png') });
  await win.click('#fzSaveBlock');
  await win.waitForFunction(() => !!window.__tzFactory.design().blockId, null, { timeout: 5000 });
  const blockId = (await D()).blockId;
  ok(/^custom\./.test(blockId), 'saved as block ' + blockId);
  ok(fs.existsSync(path.join(data, 'tone-zone', 'custom-blocks', blockId + '.json')), 'saved to the custom-blocks folder');
  ok(await win.evaluate(() => /Update block/.test(document.querySelector('#fzSaveBlock').textContent)), 'button now updates the block');
  await win.click('#tabs [data-tab="board"]');
  await win.waitForTimeout(300);
  const chip = await win.$('#catChips .kinds .chip:text-is("Custom")');
  ok(!!chip, 'Custom filter chip next to Pedals');
  ok(await win.evaluate(() => { const c = [...document.querySelectorAll('#catChips .kinds .chip')].map((x) => x.textContent); return c.indexOf('Custom') === c.indexOf('Pedals') + 1; }), 'Custom sits right after Pedals');
  await chip.click();
  await win.waitForTimeout(400);
  const names = await win.$$eval('#blockList .bl-item', (els) => els.map((e) => e.textContent));
  ok(names.length === 1 && /Glass Drive/.test(names[0]), 'the block is listed under Custom');
  // the block list remembers its filter: put it back to All for other tests
  await win.click('#catChips .kinds .chip:text-is("All")');
  const onBoard = await win.evaluate(async (id) => {
    const m = await import('./js/state.js');
    const b = m.addBlock(id, 900, 700);
    await new Promise((r) => setTimeout(r, 400));
    const v = window.__tz.editor.views.get(b.id);
    const def = v.def;
    const want = def.controls.map((c) => c.cid).sort();
    const got = [...v.views.keys()].sort();
    const jacks = v.jacks.map((j) => j.key + ':' + (j.kind || 'inst'));
    window.__tz.editor.select([b.id]);
    return { id: b.id, same: JSON.stringify(want) === JSON.stringify(got), n: got.length, jacks, knobs: v.g.querySelectorAll('[data-ctl]').length, pcb: !!v.g.querySelector('.fz-pcb') };
  }, blockId);
  ok(onBoard.same && onBoard.n >= 7, `block on the board has its controls (${onBoard.n})`);
  ok(onBoard.jacks.includes('i0:inst') && onBoard.jacks.includes('o0:inst'), 'board jacks: ' + onBoard.jacks.join(' '));
  ok(onBoard.pcb, 'the board shows the circuit board through the clear enclosure');
  // turn a knob on the board: the engine gets the mapped param
  const turned = await win.evaluate(async (bid) => {
    const m = await import('./js/state.js');
    const b = m.blockById(bid);
    const def = window.__tz.editor.views.get(bid).def;
    const gain = def.controls.find((c) => c.label === 'GAIN');
    const before = m.engineParamsFor(b);
    window.__tz.editor.remoteControl(bid, gain.cid, 0.9);
    const after = m.engineParamsFor(b);
    const k = def.design.ctls.find((c) => c.label === 'GAIN').map.to;
    return { before: before[k], after: after[k] };
  }, onBoard.id);
  ok(turned.after > turned.before + 0.3, `board knob drives the stage (${turned.before} -> ${turned.after})`);
  await win.evaluate(async (bid) => {
    const v = window.__tz.editor.views.get(bid);
    const b = v.block;
    window.__tz.editor.view.z = 1.6;
    window.__tz.editor.view.x = -b.x * 1.6 + 500;
    window.__tz.editor.view.y = -b.y * 1.6 + 200;
    window.__tz.editor.applyView && window.__tz.editor.applyView();
  }, onBoard.id);
  await win.waitForTimeout(600);
  await win.screenshot({ path: path.join(S, 'factory-board.png') });

  // 14. test mode: the engine plays a graph with just the design, the board comes back after
  await win.click('#tabs [data-tab="factory"]');
  await win.waitForTimeout(300);
  await win.click('#fzTemplates');
  await win.click('[data-template="delay"]');
  await win.waitForTimeout(300);
  await win.click('#fzTest');
  await win.waitForTimeout(1500);
  const ti = await win.evaluate(() => {
    const i = window.__tzFactory.testInfo();
    const g = i.graphs[i.graphs.length - 1];
    return { nodes: g.nodes.map((n) => n.id + ':' + n.algo), cables: g.cables.length, over: window.__tzFactory.graphOverridden(), status: Object.keys(window.__tz.state.status.blocks || {}) };
  });
  ok(ti.over && ti.nodes.length === 1 && ti.nodes[0] === 'fztest:patch' && ti.cables >= 2, 'test mode sends a graph with the custom node: ' + ti.nodes.join(','));
  ok(ti.status.length === 1 && ti.status[0] === 'fztest', 'the engine runs only the tested pedal (' + ti.status.join(',') + ')');
  ok(await win.evaluate(() => document.querySelector('.fz-stagewrap').classList.contains('testing') && !!document.querySelector('.fz-meters')), 'testing banner and meters shown');
  // turn the TIME knob by dragging it on the stage
  const dq = await D();
  const tk = dq.ctls.find((c) => c.label === 'TIME');
  const [tx, ty] = await center(`.fz-stage [data-ctl="${tk.id}"]`);
  await win.mouse.move(tx, ty);
  await win.mouse.down();
  await win.mouse.move(tx, ty - 60, { steps: 6 });
  await win.mouse.up();
  await win.waitForTimeout(200);
  const tv = await win.evaluate((id) => window.__tzFactory.testInfo().params['u.' + id], tk.id);
  ok(tv > (tk.value ?? 0.5) + 0.2, `dragging a knob in test mode turns it (${tv.toFixed(2)})`);
  await win.screenshot({ path: path.join(S, 'factory-test.png') });
  await win.click('#fzTest');
  await win.waitForTimeout(1500);
  const back = await win.evaluate(() => ({ over: window.__tzFactory.graphOverridden(), testing: window.__tzFactory.testing(), status: Object.keys(window.__tz.state.status.blocks || {}), board: window.__tz.state.preset.blocks.filter((b) => !b.id.startsWith('__')).map((b) => b.id) }));
  ok(!back.over && !back.testing, 'test mode ended, override cleared');
  ok(!back.status.includes('fztest') && back.board.every((id) => back.status.includes(id)), 'the engine runs the board again');
  // leaving the tab also ends a test
  await win.click('#fzTest');
  await win.waitForTimeout(300);
  await win.click('#tabs [data-tab="board"]');
  await win.waitForTimeout(300);
  ok(!(await win.evaluate(() => window.__tzFactory.testing() || window.__tzFactory.graphOverridden())), 'switching tabs stops the test');

  // 15. offline render of a preset with the custom block is not silent
  const di = makeDI(path.join(data, 'di.wav'));
  const wav = await win.evaluate(async ([id, di]) => {
    const preset = {
      version: 1, name: 'custom check',
      blocks: [{ id: '__in', type: '__in', x: 0, y: 0, params: {} }, { id: '__out', type: '__out', x: 0, y: 0, params: {} }, { id: 'c1', type: id, x: 0, y: 0, params: {}, variant: 'mono' }],
      cables: [{ id: 'a', from: { node: '__in', port: 0 }, to: { node: 'c1', port: 0 } }, { id: 'b', from: { node: 'c1', port: 0 }, to: { node: '__out', port: 0 } }],
    };
    const g = window.__tz.buildGraph(preset);
    return { file: await window.tz.offline.render(g, di), algo: g.nodes[0].algo, chain: g.nodes[0].opts.nodes.length };
  }, [blockId, di]);
  const lv = measure(wav.file);
  fs.rmSync(wav.file, { force: true });
  ok(wav.algo === 'patch' && wav.chain >= 3 && lv.lufs > -45 && lv.peak < 0, `offline render of the custom block is not silent (${lv.lufs.toFixed(1)} LUFS)`);

  // 16. footswitch nut material: only the nut changes, the cap keeps its stock look
  await win.click('#tabs [data-tab="factory"]');
  await win.waitForTimeout(300);
  await win.click('#fzTemplates');
  await win.click('[data-template="drive"]');
  await win.waitForTimeout(300);
  const footId = (await D()).ctls.find((c) => c.kind === 'foot').id;
  await win.evaluate((id) => window.__tzFactory.select(id), footId);
  await win.click('.fz-matparts [data-matpart="nutMat"]');
  await win.waitForSelector('.fz-mat-nutMat .mtp-mats');
  await win.click('.fz-mat-nutMat .mtp-mats [data-v="metal"]');
  await win.waitForTimeout(150);
  await win.click('.fz-mat-nutMat .mtp-subs [data-v="brass"]');
  await win.waitForTimeout(200);
  const ft = (await D()).ctls.find((c) => c.id === footId);
  ok(ft.nutMat && ft.nutMat.m === 'metal' && ft.nutMat.s === 'brass' && !ft.mat, 'footswitch nut is brass, the cap is still stock');
  ok(await win.evaluate((id) => !!document.querySelector(`.fz-stage [data-id="${id}"] polygon[fill^="url(#mt-metal-brass"]`), footId), 'brass nut drawn on the stage');
  await win.screenshot({ path: path.join(S, 'factory-nut.png') });

  // 17. dot grid: on by default, the toolbar turns it off for this design (undoable), and it is part of the design
  await win.keyboard.press('Escape');
  ok(await win.evaluate(() => !!document.querySelector('.fz-stage .fz-gridfill') && document.querySelector('#fzDots').classList.contains('on')), 'dot grid shown by default');
  await win.click('#fzDots');
  await win.waitForTimeout(150);
  ok((await D()).enc.dots === false && (await win.evaluate(() => !document.querySelector('.fz-stage .fz-gridfill') && !document.querySelector('#fzDots').classList.contains('on'))), 'dot grid turned off');
  ok(await win.evaluate(() => [...document.querySelectorAll('.fz-insp h5')].some((h) => /Dot grid/i.test(h.textContent))), 'enclosure inspector has a dot grid section');
  await win.click('#fzUndo');
  await win.waitForTimeout(150);
  ok((await D()).enc.dots !== false && (await win.evaluate(() => !!document.querySelector('.fz-stage .fz-gridfill'))), 'undo brought the dots back');

  // 18. an encoder with an LED ring, and two new controls (XY pad, step buttons)
  await win.click('.fz-tabs [data-t="parts"]');
  await win.click('.fz-tile[data-part="encoder"] .fz-vdots [data-var="3"]');
  await win.waitForTimeout(100);
  ok(await win.evaluate(() => { const t = document.querySelector('.fz-tile[data-part="encoder"]'); return t.dataset.variant === '3' && /LED ring encoder/.test(t.textContent); }), 'the encoder tile switched to its LED ring variant');
  await win.click('.fz-tile[data-part="encoder"]');
  await win.waitForTimeout(200);
  const enc = (await D()).ctls.filter((c) => c.part === 'encoder').pop();
  ok(enc && enc.kind === 'knob' && enc.ring, 'LED ring encoder added');
  const ledsIn = await win.$('.fz-insp .fz-sec .fz-row:has(label:text-is("LEDs")) .fz-num');
  await ledsIn.fill('24');
  await ledsIn.press('Enter');
  await win.waitForTimeout(200);
  ok((await D()).ctls.find((c) => c.id === enc.id).ringN === 24 && (await win.evaluate((id) => document.querySelectorAll(`.fz-stage [data-id="${id}"] .enc-led`).length, enc.id)) === 24, 'encoder ring has 24 LEDs');
  // a circuit template reuses the plain knobs but keeps the encoder
  await win.click('.fz-tabs [data-t="circuit"]');
  await win.click('.cl-inst [data-cl="rminst"]');
  await win.click('[data-circuit-id="b.c-delay"] [data-cl="use"]');
  await win.waitForTimeout(200);
  ok(!!(await D()).ctls.find((c) => c.id === enc.id), 'applying a circuit kept the encoder');
  await win.click('.fz-tabs [data-t="parts"]');
  await win.click('.fz-tile[data-part="xy"]');
  await win.waitForTimeout(200);
  const xy = (await D()).ctls.find((c) => c.kind === 'xy');
  ok(xy && Array.isArray(xy.maps) && xy.maps.length === 2, 'XY pad added with one mapping per axis');
  ok(!(await win.$('.fz-insp [data-axis]')) && !(await win.$('.fz-insp .fz-wiring')), 'XY pad inspector has no Drives section (wired in the diagram)');
  await win.click('.fz-tile[data-part="steps"]');
  await win.waitForTimeout(200);
  const st = (await D()).ctls.find((c) => c.part === 'steps');
  ok(st && st.kind === 'sel' && st.n === 4, 'step buttons added');
  // wire them to values of the circuit (it may have no free ones left)
  await win.evaluate(async () => {
    const m = await import('./js/pages/factory-circuit.js');
    const d = window.__tzFactory.design();
    const C = d.circuit;
    const cont = m.targetsFor(C, 'knob').filter((t) => t[2] && !t[2].i && !t[2].tap && !t[0].endsWith('.on')).map((t) => t[0]);
    const ints = m.targetsFor(C, 'sel').filter((t) => t[2] && t[2].i && t[2].max > 1 && !t[0].endsWith('.on'));
    const n = cont.length;
    // room for everything, so nothing sits on top of anything else
    Object.assign(d.enc, { w: 110, h: 122, size: 'custom' });
    for (const c of d.ctls) {
      if (c.part === 'encoder') Object.assign(c, { x: 90, y: 24 });
      if (c.kind === 'xy') Object.assign(c, { x: 80, y: 64 });
      if (c.part === 'steps') Object.assign(c, { x: 30, y: 70 });
    }
    for (const c of d.ctls) {
      if (c.part === 'encoder') c.map = m.mapTo(C, cont[0]);
      if (c.kind === 'xy') c.maps = [m.mapTo(C, cont[1 % n]), m.mapTo(C, cont[2 % n])];
      if (c.part === 'steps') c.map = ints.length ? m.mapTo(C, ints[0][0], { max: Math.min(ints[0][2].max, ints[0][2].min + 3) }) : m.mapTo(C, cont[3 % n]);
    }
    window.__tzFactory.load(JSON.parse(JSON.stringify(d)));
  });
  await win.waitForTimeout(300);
  const der2 = await win.evaluate(async ([xyId, encId, stId]) => {
    const m = await import('./js/pages/factory-circuit.js');
    const def = m.designToDef(window.__tzFactory.design(), { id: 'custom.check2' });
    const ui = {};
    for (const c of def.controls) if (c.p) ui[c.p] = c.def;
    const a = def.derive(ui);
    ui['u.' + xyId + '.x'] = 1;
    ui['u.' + xyId + '.y'] = 0;
    ui['u.' + encId] = 1;
    ui['u.' + stId] = 2;
    const b = def.derive(ui);
    const t = (cid) => (def.controls.find((c) => c.cid === cid) || {}).t;
    return { tx: t(xyId + '.x'), ty: t(xyId + '.y'), te: t(encId), ts: t(stId), changed: Object.keys(b).filter((k) => a[k] !== b[k]).length };
  }, [xy.id, enc.id, st.id]);
  ok(der2.tx === 'slider' && der2.ty === 'slider' && der2.te === 'knob' && der2.ts === 'sel' && der2.changed >= 3, `new controls are block controls (xy ${der2.tx}/${der2.ty}, encoder ${der2.te}, steps ${der2.ts}, ${der2.changed} values move)`);
  // test mode: the encoder ring follows the value, the pad drags, a step lights
  await win.click('#fzTest');
  await win.waitForTimeout(1200);
  await win.evaluate((id) => window.__tzFactory.testSet(id, 0.5), enc.id);
  await win.waitForTimeout(100);
  const lit = await win.evaluate((id) => [...document.querySelectorAll(`.fz-stage [data-ctl="${id}"] .enc-led`)].filter((e) => e.dataset.on === '1').length, enc.id);
  ok(lit === 12, `encoder ring lights half its LEDs at half way (${lit} of 24)`);
  const pb = await (await win.$(`.fz-stage [data-ctl="${xy.id}.y"]`)).boundingBox();
  await win.mouse.move(pb.x + pb.width / 2, pb.y + pb.height / 2);
  await win.mouse.down();
  await win.mouse.move(pb.x + pb.width / 2, pb.y + pb.height / 2 - 40, { steps: 5 });
  await win.mouse.up();
  await win.waitForTimeout(150);
  const vy = await win.evaluate((id) => window.__tzFactory.testInfo().params['u.' + id + '.y'], xy.id);
  ok(vy > 0.6, `dragging the XY pad moves Y in test mode (${vy && vy.toFixed(2)})`);
  await win.evaluate((id) => window.__tzFactory.testSet(id, 2), st.id);
  await win.waitForTimeout(100);
  const stepLit = await win.evaluate((id) => [...document.querySelectorAll(`.fz-stage [data-ctl="${id}"] .step-led`)].map((e) => e.dataset.on).join(''), st.id);
  ok(stepLit === '0010', 'the chosen step button lights (' + stepLit + ')');
  await win.screenshot({ path: path.join(S, 'factory-newcontrols-test.png') });
  await win.click('#fzTest');
  await win.waitForTimeout(800);

  // 19. an angled jack: the wedge's slanted sides turn the jacks, one is set by hand, and they wire up on the board
  await win.evaluate(() => { const d = window.__tzFactory.design(); Object.assign(d.enc, { shape: 'wedge', w: 110, h: 122, size: 'custom' }); d.jacks.find((j) => j.kind === 'in').t = 0.5; d.jacks.find((j) => j.kind === 'out').t = 0.5; window.__tzFactory.load(JSON.parse(JSON.stringify(d))); });
  await win.waitForTimeout(300);
  const outJ = (await D()).jacks.find((j) => j.kind === 'out');
  await win.evaluate((id) => window.__tzFactory.select(id), outJ.id);
  await win.waitForTimeout(150);
  await win.click('.fz-insp .fz-seg [data-v="hand"]');
  await win.waitForTimeout(150);
  const autoA = (await D()).jacks.find((j) => j.id === outJ.id).angle;
  ok(typeof autoA === 'number' && autoA > 180 && autoA < 200, `out jack follows the slanted edge (${autoA} degrees)`);
  const angIn = await win.$('.fz-insp .fz-row:has(label:text-is("Angle")) .fz-num');
  await angIn.fill('210');
  await angIn.press('Enter');
  await win.waitForTimeout(150);
  ok((await D()).jacks.find((j) => j.id === outJ.id).angle === 210, 'jack angle set by hand');
  await win.keyboard.press('Escape');
  await win.click('#fzSaveBlock');
  await win.waitForFunction((old) => window.__tzFactory.design().blockId && window.__tzFactory.design().blockId !== old, blockId, { timeout: 5000 }).catch(() => {});
  const ctlBlock = (await D()).blockId;
  await win.click('#tabs [data-tab="board"]');
  await win.waitForTimeout(300);
  const wired = await win.evaluate(async (id) => {
    const m = await import('./js/state.js');
    const b = m.addBlock(id, 400, 900);
    m.connect({ node: '__in', port: 0 }, { node: b.id, port: 0 });
    m.connect({ node: b.id, port: 0 }, { node: '__out', port: 0 });
    await new Promise((r) => setTimeout(r, 500));
    const v = window.__tz.editor.views.get(b.id);
    const def = v.def;
    const want = def.controls.map((c) => c.cid).sort(), got = [...v.views.keys()].sort();
    const cables = m.state.preset.cables.filter((c) => c.to.node === b.id || c.from.node === b.id).map((c) => !!document.querySelector(`[data-cable="${c.id}"]`));
    return { bid: b.id, jacks: v.jacks.map((j) => ({ key: j.key, side: j.side, angle: j.angle })), same: JSON.stringify(want) === JSON.stringify(got), xy: got.filter((k) => k.includes('.')).length, dots: !!v.g.querySelector('.fz-gridfill'), cables };
  }, ctlBlock);
  const ji = wired.jacks.find((j) => j.key === 'i0'), jo = wired.jacks.find((j) => j.key === 'o0');
  ok(ji && typeof ji.angle === 'number' && ji.side === 'right' && Math.abs(ji.angle - 360) < 20, `board input jack is angled (${ji && ji.angle}, ${ji && ji.side})`);
  ok(jo && jo.angle === 210 && jo.side === 'left', `board output jack uses the hand set angle (${jo && jo.angle})`);
  ok(wired.cables.length === 2 && wired.cables.every(Boolean), 'cables plug into the angled jacks');
  ok(wired.same && wired.xy >= 2, 'the saved pedal has all its controls on the board, the XY pad as two');
  ok(wired.dots, 'the dot grid shows on the board too');
  await win.evaluate((bid) => {
    const v = window.__tz.editor.views.get(bid);
    const b = v.block;
    window.__tz.editor.view.z = 2;
    window.__tz.editor.view.x = -b.x * 2 + 450;
    window.__tz.editor.view.y = -b.y * 2 + 150;
    window.__tz.editor.applyView && window.__tz.editor.applyView();
  }, wired.bid);
  await win.waitForTimeout(500);
  await win.screenshot({ path: path.join(S, 'factory-angled-board.png') });

  // 20. My pedals: every saved pedal, duplicate, edit and update (the board follows), delete
  await win.click('#tabs [data-tab="factory"]');
  await win.waitForTimeout(300);
  await win.click('#fzLibrary');
  await win.waitForSelector('.fz-lib-card');
  const nLib = await win.$$eval('.fz-lib-card', (e) => e.length);
  const nSaved = await win.evaluate(async () => (await import('./js/catalog/custom.js')).customBlocks().length);
  ok(nLib === nSaved && nLib >= 2, `My pedals lists every saved pedal (${nLib})`);
  ok(await win.evaluate((id) => document.querySelector(`.fz-lib-card[data-lib="${id}"]`).classList.contains('open') && !!document.querySelector(`.fz-lib-card[data-lib="${id}"] svg`), ctlBlock), 'the open pedal is marked and has a picture');
  await win.screenshot({ path: path.join(S, 'factory-library.png') });
  await win.click(`.fz-lib-card[data-lib="${blockId}"] [data-act="dup"]`);
  await win.waitForFunction((n) => document.querySelectorAll('.fz-lib-card').length === n + 1, nLib, { timeout: 5000 }).catch(() => {});
  ok((await win.$$eval('.fz-lib-card', (e) => e.length)) === nLib + 1, 'duplicate made a new pedal');
  await win.click(`.fz-lib-card[data-lib="${blockId}"] [data-act="edit"]`);
  await win.waitForTimeout(300);
  const ed = await D();
  ok(ed.blockId === blockId && ed.name === 'Glass Drive', 'edit opened the saved pedal');
  await win.evaluate(() => { const d = window.__tzFactory.design(); d.name = 'Glass Drive II'; window.__tzFactory.load(JSON.parse(JSON.stringify(d))); });
  await win.click('#fzSaveBlock');
  await win.waitForTimeout(800);
  const upd = await win.evaluate((bid) => window.__tz.editor.views.get(bid)?.def.name, onBoard.id);
  ok(upd === 'Glass Drive II', 'saving updated the block already on the board (' + upd + ')');
  await win.click('#fzLibrary');
  await win.waitForSelector('.fz-lib-card');
  const dupId = await win.evaluate(() => [...document.querySelectorAll('.fz-lib-card')].find((c) => /copy/.test(c.textContent)).dataset.lib);
  await win.click(`.fz-lib-card[data-lib="${dupId}"] [data-act="del"]`);
  await win.click(`.fz-lib-card[data-lib="${dupId}"] [data-act="del"]`);
  await win.waitForTimeout(400);
  ok(!(await win.$(`.fz-lib-card[data-lib="${dupId}"]`)) && (await win.$$eval('.fz-lib-card', (e) => e.length)) === nLib, 'delete removed the copy');
  await win.click(`.fz-lib-card[data-lib="${ctlBlock}"] [data-act="test"]`);
  await win.waitForTimeout(1200);
  ok(await win.evaluate((id) => window.__tzFactory.testing() && window.__tzFactory.design().blockId === id, ctlBlock), 'test from My pedals opens the pedal and plays it');
  await win.click('#fzTest');
  await win.waitForTimeout(800);

  // 21. variants: every control tile has at least 3, a dot switches the tile, the next add uses it
  await win.click('#fzTemplates');
  await win.click('[data-template="blank"]');
  await win.waitForTimeout(300);
  await win.click('.fz-tabs [data-t="parts"]');
  await win.evaluate(() => document.querySelectorAll('.fz-vdots [data-var="0"]').forEach((d) => d.click()));
  const pal = await win.evaluate(() => [...document.querySelectorAll('.fz-vtile')].map((t) => [t.dataset.part, t.querySelectorAll('.fz-vdots i').length]));
  ok(pal.length >= 15 && pal.every(([, n]) => n >= 3), 'every control tile has 3 or more variants: ' + pal.map((p) => p.join(':')).join(' '));
  ok(!pal.some(([k]) => ['lever', 'pad', 'ldr', 'tbank', 'encring', 'stick'].includes(k)), 'no whammy lever, pressure pad, light sensor, toggle bank, ring encoder or joystick tiles of their own');
  const svg0 = await win.evaluate(() => document.querySelector('.fz-tile[data-part="dip"] svg').innerHTML);
  await win.click('.fz-tile[data-part="dip"] .fz-vdots [data-var="2"]');
  await win.waitForTimeout(100);
  const dipTile = await win.evaluate(() => { const t = document.querySelector('.fz-tile[data-part="dip"]'); return { v: t.dataset.variant, cap: t.querySelector('span').textContent, svg: t.querySelector('svg').innerHTML, on: t.querySelector('.fz-vdots i.on').dataset.var }; });
  ok(dipTile.v === '2' && dipTile.on === '2' && dipTile.cap === 'Toggle bank' && dipTile.svg !== svg0, 'a dot switched the DIP tile to its toggle bank variant (preview updated)');
  ok((await D()).ctls.length === 1, 'clicking a dot does not add anything');
  await win.click('.fz-tile[data-part="dip"]');
  await win.waitForTimeout(200);
  const tb = (await D()).ctls.find((c) => c.kind === 'dip');
  ok(tb && tb.look === 'toggle' && !tb.part, 'the toggle bank is a DIP switch variant');
  ok(await win.evaluate(() => /DIP switch/.test(document.querySelector('.fz-insp h3').textContent) && document.querySelector('.fz-insp .fz-seg [data-v="toggle"]').classList.contains('on')), 'its inspector is the DIP switch one, Look: Toggles');
  ok(await win.evaluate((id) => document.querySelectorAll(`.fz-stage [data-id="${id}"] .tbank`).length === 1, tb.id), 'drawn as a toggle bank');
  await win.screenshot({ path: path.join(S, 'factory-variant-dots.png') });
  await win.click('.fz-tile[data-part="dip"] .fz-vdots [data-var="0"]');

  // the LED ring encoder goes down to 2 LEDs, drawn as curved segments
  await win.click('.fz-tile[data-part="encoder"] .fz-vdots [data-var="3"]');
  await win.click('.fz-tile[data-part="encoder"]');
  await win.waitForTimeout(200);
  const e2 = (await D()).ctls.filter((c) => c.part === 'encoder').pop();
  const led2 = await win.$('.fz-insp .fz-sec .fz-row:has(label:text-is("LEDs")) .fz-num');
  await led2.fill('1');
  await led2.press('Enter');
  await win.waitForTimeout(150);
  const e2b = (await D()).ctls.find((c) => c.id === e2.id);
  const segs = await win.evaluate((id) => [...document.querySelectorAll(`.fz-stage [data-id="${id}"] .enc-led`)].map((e) => e.tagName + ':' + /A/.test(e.getAttribute('d') || '')), e2.id);
  ok(e2b.ringN === 2 && segs.length === 2 && segs.every((x) => x === 'path:true'), `LED ring encoder with 2 LEDs, as curved segments (${segs.join(' ')})`);
  await win.evaluate((id) => { const d = window.__tzFactory.design(); Object.assign(d.ctls.find((c) => c.id === id), { ringN: 10, value: 0.55, r: 10.5, x: 33, y: 40 }); window.__tzFactory.load(JSON.parse(JSON.stringify(d))); window.__tzFactory.select(id); }, e2.id);
  await win.waitForTimeout(200);
  const eb = await (await win.$(`.fz-stage [data-id="${e2.id}"]`)).boundingBox();
  await win.screenshot({ path: path.join(S, 'factory-ledring.png'), clip: { x: eb.x - 30, y: eb.y - 30, width: eb.width + 60, height: eb.height + 60 } });
  await win.click('.fz-tile[data-part="encoder"] .fz-vdots [data-var="0"]');

  // the material panel: one picker, a switcher picks the part; no quick colour rows anywhere
  await win.click('.fz-tile[data-part="knob"]');
  await win.waitForTimeout(200);
  const kk = (await D()).ctls.filter((c) => c.kind === 'knob').pop();
  ok(await win.evaluate(() => document.querySelectorAll('.fz-insp .mtp').length === 1 && [...document.querySelectorAll('.fz-matparts button')].map((b) => b.textContent).join() === 'Cap,Skirt'), 'knob: one material picker with a Cap / Skirt switcher');
  await win.click('.fz-matparts [data-matpart="skirtMat"]');
  await win.click('.fz-mat-skirtMat .mtp-mats [data-v="metal"]');
  await win.waitForTimeout(150);
  let kd = (await D()).ctls.find((c) => c.id === kk.id);
  ok(kd.skirtMat && kd.skirtMat.m === 'metal' && !kd.mat, 'the switcher picked the skirt: only the skirt is metal');
  await win.click('.fz-insp .fz-seg [data-v="plate"]');
  await win.waitForTimeout(150);
  ok(await win.evaluate(() => [...document.querySelectorAll('.fz-matparts button')].map((b) => b.textContent).join() === 'Cap,Skirt,Dial' && document.querySelector('.fz-matparts .on').dataset.matpart === 'skirtMat'), 'a dial adds a Dial part, the switcher stays on the skirt');
  await win.screenshot({ path: path.join(S, 'factory-matparts.png') });
  const quick = [];
  for (const k of ['button', 'arcade', 'pedal', 'dip', 'trim', 'foot']) {
    await win.click(`.fz-tile[data-part="${k}"]`);
    await win.waitForTimeout(120);
    quick.push(await win.evaluate((kind) => [kind, document.querySelectorAll('.fz-insp .mtp').length, document.querySelectorAll('.fz-insp .fz-swatches:is([data-key="cap"],[data-key="pedal"],[data-key="dip"],[data-key="trim"],[data-key="arcring"],[data-key="enc"])').length], k));
  }
  ok(quick.every(([, m, q]) => m === 1 && q === 0), 'no quick colour rows, one material picker each: ' + quick.map((q) => q.join(':')).join(' '));

  // foot pedals: the pedal itself takes a material, and so does its grip
  const pd = (await D()).ctls.filter((c) => c.kind === 'pedal').pop();
  await win.evaluate((id) => window.__tzFactory.select(id), pd.id);
  await win.waitForTimeout(150);
  ok(await win.evaluate(() => [...document.querySelectorAll('.fz-matparts button')].map((b) => b.dataset.matpart).join() === 'mat,gripMat'), 'foot pedal: Pedal and Grip parts');
  await win.click('.fz-mat-mat .mtp-mats [data-v="wood"]');
  await win.waitForTimeout(150);
  ok(((await D()).ctls.find((c) => c.id === pd.id).mat || {}).m === 'wood' && (await win.evaluate((id) => !!document.querySelector(`.fz-stage [data-id="${id}"] [fill^="url(#mt-wood"]`), pd.id)), 'the pedal body is wood');
  await win.click('.fz-matparts [data-matpart="gripMat"]');
  await win.click('.fz-mat-gripMat .mtp-mats [data-v="metal"]');
  await win.waitForTimeout(150);
  const pdd = (await D()).ctls.find((c) => c.id === pd.id);
  ok(pdd.gripMat && pdd.gripMat.m === 'metal' && pdd.mat.m === 'wood', 'and its grip is metal');

  // mirror mode and multi-select with variants
  await win.click('#fzTemplates');
  await win.click('[data-template="blank"]');
  await win.waitForTimeout(300);
  await win.click('.fz-tabs [data-t="parts"]');
  await win.click('#fzMirror');
  await win.click('#fzMirrorAxis [data-v="v"]');
  await win.click('.fz-tile[data-part="encoder"] .fz-vdots [data-var="3"]');
  await win.click('.fz-tile[data-part="encoder"]');
  await win.waitForTimeout(200);
  const tw = (await D()).ctls.filter((c) => c.part === 'encoder');
  ok(tw.length === 2 && tw.every((c) => c.ring && c.ringN === 12) && tw[0].twin === tw[1].id, 'mirror mode: the LED ring variant gets a matching twin');
  await win.evaluate((ids) => window.__tzFactory.selectMany(ids), tw.map((c) => c.id));
  await win.waitForTimeout(150);
  const ml2 = await win.$('.fz-insp .fz-sec .fz-row:has(label:text-is("LEDs")) .fz-num');
  await ml2.fill('6');
  await ml2.press('Enter');
  await win.waitForTimeout(150);
  ok((await D()).ctls.filter((c) => c.part === 'encoder').every((c) => c.ringN === 6), 'multi-select: one edit set both rings to 6 LEDs');
  await win.click('#fzMirror');
  await win.click('.fz-tile[data-part="encoder"] .fz-vdots [data-var="0"]');

  // 22. removed controls in an older design become knobs (wiring kept), the toggle bank becomes a DIP look
  const mig = await win.evaluate(async () => {
    const fc = await import('./js/pages/factory-circuit.js');
    const d = window.__tzFactory.template('blank');
    const C = d.circuit;
    const T = fc.targetsFor(C, 'knob').filter((t) => t[2] && !t[2].i && !t[2].tap && !t[0].endsWith('.on')).map((t) => t[0]);
    const id = '';
    const made = {};
    const m = (k) => (made[k] = made[k] || fc.mapTo(C, T[{ gain: 0, tone: 1, level: 2 }[k] % T.length]));
    d.ctls.push(
      { id: 'lv1', kind: 'knob', part: 'lever', len: 26, x: 15, y: 30, value: 0.3, label: 'BEND', labelPos: 'none', map: m('gain') },
      { id: 'pd1', kind: 'knob', part: 'pad', w: 16, x: 33, y: 30, value: 0.2, color: '#ff7a2f', label: '', labelPos: 'below', map: m('tone') },
      { id: 'ld1', kind: 'knob', part: 'ldr', r: 3.5, x: 51, y: 30, value: 0.5, label: 'LIGHT', labelPos: 'below', map: m('level') },
      { id: 'tb1', kind: 'dip', part: 'tbank', n: 3, bits: [1, 0, 1], x: 33, y: 60, maps: [m('gain'), null, m('tone')], label: '', labelPos: 'none' },
    );
    window.__tzFactory.load(d);
    const out = window.__tzFactory.design().ctls.filter((c) => ['lv1', 'pd1', 'ld1', 'tb1'].includes(c.id)).map((c) => ({ id: c.id, kind: c.kind, part: c.part, look: c.look, map: c.map && c.map.to, maps: (c.maps || []).map((x) => x && x.to), r: c.r }));
    return { out, T: [made.gain.to, made.tone.to, made.level.to] };
  });
  const mk2 = (id) => mig.out.find((c) => c.id === id) || {};
  if (process.env.FZ_LOG) console.log(JSON.stringify(mig));
  ok(['lv1', 'pd1', 'ld1'].every((id) => mk2(id).kind === 'knob' && !mk2(id).part && mk2(id).r > 0) && mk2('lv1').map === mig.T[0] && mk2('ld1').map === mig.T[2], 'whammy lever, pressure pad and light sensor load as knobs, still wired');
  ok(mk2('tb1').kind === 'dip' && mk2('tb1').look === 'toggle' && !mk2('tb1').part && mk2('tb1').maps[0] === mig.T[0] && mk2('tb1').maps[2] === mig.T[1], 'the toggle bank loads as a DIP switch with the toggle look, still wired');
  ok(await win.evaluate(() => ['lv1', 'pd1', 'ld1', 'tb1'].every((id) => !!document.querySelector(`.fz-stage [data-id="${id}"] .ctl, .fz-stage [data-id="${id}"] .tbank`))), 'they draw');

  // 23. a footswitch jack (TRS, a control input on the board) and a saved pedal full of variants on the board
  await win.click('#fzTemplates');
  await win.click('[data-template="blank"]');
  await win.waitForTimeout(300);
  await win.click('.fz-tabs [data-t="parts"]');
  await win.click('.fz-tile[data-part="fsw"]');
  await win.waitForTimeout(150);
  const fj = (await D()).jacks.find((j) => j.kind === 'fsw');
  ok(fj && fj.label === 'FSW', 'footswitch jack added (kind fsw)');
  await win.evaluate(async () => {
    const v = await import('./js/pages/factory-variants.js');
    const d = window.__tzFactory.design();
    Object.assign(d.enc, { w: 120, h: 150, size: 'custom', mat: { m: 'metal', s: 'aluminium', f: 'anodized', c: '#1f8a8a' } });
    d.name = 'Variant Box';
    d.title = { ...d.title, text: 'VARIANTS', x: 60, y: 76, size: 7 };
    d.ctls = d.ctls.filter((c) => c.kind === 'foot');
    Object.assign(d.ctls[0], { x: 60, y: 132 });
    const put = (k, i, x, y, o = {}) => d.ctls.push(Object.assign(v.makeControl(k, d, i), { x, y }, o));
    put('encoder', 3, 22, 24, { label: 'TIME' }); put('knob', 3, 60, 22, { label: 'MIX' }); put('arcade', 1, 98, 24);
    put('dip', 2, 30, 52); put('steps', 1, 88, 52); put('meter', 2, 22, 98, { h: 22 }); put('xy', 3, 60, 100); put('trim', 2, 98, 98, { r: 4 });
    window.__tzFactory.load(JSON.parse(JSON.stringify(d)));
  });
  await win.waitForTimeout(300);
  await win.click('#fzSaveBlock');
  await win.waitForFunction(() => !!window.__tzFactory.design().blockId, null, { timeout: 5000 }).catch(() => {});
  const vb = (await D()).blockId;
  await win.click('#tabs [data-tab="board"]');
  await win.waitForTimeout(300);
  const vOn = await win.evaluate(async ([id, jid]) => {
    const m = await import('./js/state.js');
    const b = m.addBlock(id, 1500, 300);
    await new Promise((r) => setTimeout(r, 500));
    const v = window.__tz.editor.views.get(b.id);
    const want = v.def.controls.map((c) => c.cid).sort(), got = [...v.views.keys()].sort();
    const ctrl = (v.def.ctrl?.ins || []).some((c) => c._jack === jid);
    window.__tz.editor.view.z = 2.2;
    window.__tz.editor.view.x = -b.x * 2.2 + 330;
    window.__tz.editor.view.y = -b.y * 2.2 + 120;
    window.__tz.editor.applyView && window.__tz.editor.applyView();
    return { same: JSON.stringify(want) === JSON.stringify(got), jacks: v.jacks.map((j) => j.key + ':' + (j.kind || 'inst')), ctrl, leds: v.g.querySelectorAll('.enc-led').length };
  }, [vb, fj.id]);
  await win.waitForTimeout(500);
  await win.screenshot({ path: path.join(S, 'factory-variants-board.png') });
  ok(vOn.same && vOn.leds === 12, `the saved pedal with variants works on the board (${vOn.leds} ring LEDs)`);
  ok(vOn.ctrl && vOn.jacks.some((j) => /^ic\d+:ctrl$/.test(j)), 'the footswitch jack is a control (ctrl) jack on the board: ' + vOn.jacks.join(' '));
  await win.click('#tabs [data-tab="factory"]');
  await win.waitForTimeout(300);

  // every variant of every control, for a look (two pictures, drawn big over the window)
  const shotDesign = async (file, build, arg) => {
    await win.evaluate(async ([d]) => {
      const r = await import('./js/pages/factory-render.js');
      const box = document.createElement('div');
      box.id = 'fzShot';
      box.style.cssText = 'position:fixed;inset:0;z-index:9999;background:#15171c;display:grid;place-items:center';
      const s = r.thumb(d, 'fz-shot');
      s.style.cssText = 'width:96vw;height:96vh';
      box.appendChild(s);
      document.body.appendChild(box);
    }, [await win.evaluate(build, arg)]);
    await win.waitForTimeout(300);
    await win.screenshot({ path: path.join(S, file) });
    await win.evaluate(() => document.getElementById('fzShot').remove());
  };
  const allTypes = await win.evaluate(async () => Object.keys((await import('./js/pages/factory-variants.js')).CONTROL_TYPES));
  const gallery = async (keys) => {
    const v = await import('./js/pages/factory-variants.js');
    const d = window.__tzFactory.template('blank');
    Object.assign(d.enc, { w: 248, h: keys.length * 36 + 6, size: 'custom', mat: { m: 'metal', s: 'aluminium', f: 'powder', c: '#2a2d33' }, dots: false });
    d.title.hidden = true;
    d.ctls = [];
    d.jacks = [];
    keys.forEach((k, row) => v.CONTROL_TYPES[k].variants.forEach((vr, i) => {
      const c = Object.assign(v.makeControl(k, d, i), { x: 24 + i * 40, y: 17 + row * 36, label: vr.name.toUpperCase().slice(0, 12), labelPos: 'below' });
      if (c.kind === 'pedal') Object.assign(c, { w: 18, h: 26 });
      if (c.kind === 'slider') Object.assign(c, { h: Math.min(c.h, 20) });
      if (c.part === 'strip') Object.assign(c, { h: 20 });
      if (c.kind === 'xy' && (c.look === 'pad' || c.look === 'glow')) Object.assign(c, { w: 20, h: 18 });
      if (c.kind === 'screen') Object.assign(c, { w: 26, h: 12 });
      if (c.kind === 'foot' && c.w) Object.assign(c, { w: 24, h: 22 });
      d.ctls.push(c);
    }));
    return d;
  };
  await shotDesign('factory-variants-all-1.png', gallery, allTypes.slice(0, 9));
  await shotDesign('factory-variants-all-2.png', gallery, allTypes.slice(9));
  // the LED ring up close, next to the reference look: curved segments with small gaps
  await shotDesign('factory-ledring-big.png', async () => {
    const v = await import('./js/pages/factory-variants.js');
    const d = window.__tzFactory.template('blank');
    Object.assign(d.enc, { w: 90, h: 40, size: 'custom', dots: false, mat: { m: 'metal', s: 'aluminium', f: 'powder', c: '#202226' } });
    d.title.hidden = true;
    d.jacks = [];
    d.ctls = [0.55, 0.85].map((val, i) => Object.assign(v.makeControl('encoder', d, 3), { x: 25 + i * 40, y: 20, r: 10, value: val, ringN: i ? 16 : 10, cap: i ? 'knurl' : 'rubber', labelPos: 'none' }));
    return d;
  });

  // old designs: 'knob' control inputs load as analog inputs (2 way switches as binary), still wired
  const mig2 = await win.evaluate(async () => {
    const F = await import('./js/pages/factory-circuit.js');
    const d = window.__tzFactory.template('delay');
    const inst = d.circuit.insts[0];
    const ctlNodes = inst.graph.nodes.filter((n) => n.t === 'analog' || n.t === 'binary');
    // make it look like a v0.7 design
    for (const n of ctlNodes) {
      n.t = 'knob';
      delete n.min;
      delete n.max;
    }
    inst.graph.nodes.push({ id: 'oldsw', t: 'knob', x: 40, y: 600, p: {}, name: 'Old switch', def: 1, steps: 2, opts: ['Off', 'On'] });
    window.__tzFactory.load(d);
    const D2 = window.__tzFactory.design();
    const g = D2.circuit.insts[0].graph;
    const def = F.designToDef(D2, { id: 'custom.migcheck' });
    const knob = D2.ctls.find((c) => c.map && c.map.to && c.map.to.startsWith(D2.circuit.insts[0].id + '.'));
    return { kinds: g.nodes.filter((n) => ['knob', 'analog', 'binary'].includes(n.t)).map((n) => n.t), sw: g.nodes.find((n) => n.id === 'oldsw'), derived: knob ? def.derive({ ['u.' + knob.id]: 1 })[knob.map.to] : null };
  });
  ok(!mig2.kinds.includes('knob') && mig2.kinds.includes('analog') && mig2.sw.t === 'binary' && mig2.sw.def === 1, 'old control inputs load as analog / binary inputs: ' + mig2.kinds.join(', '));
  ok(mig2.derived === 1, 'and the knobs wired to them still drive them (' + mig2.derived + ')');
  // a PHONES jack shows left and right in the wiring diagram, each can be wired on its own
  await win.evaluate(() => {
    const d = window.__tzFactory.template('blank');
    d.jacks.push({ id: 'jph', kind: 'phones', edge: 'top', t: 0.5, label: 'PHONES' });
    window.__tzFactory.load(d);
  });
  await win.waitForTimeout(300);
  await win.evaluate(() => window.__tzCircuits && window.__tzCircuits.diagram().refresh(true));
  await win.waitForTimeout(300);
  const ph = await win.evaluate(() => ['jack:jph', 'jack:jph:L', 'jack:jph:R'].map((k) => !!document.querySelector(`.fz-wd [data-wp="${k}"]`)));
  ok(ph.every(Boolean), 'the PHONES jack has left and right ports in the diagram');
  const phw = await win.evaluate(() => {
    const dg = window.__tzCircuits.diagram();
    const D2 = window.__tzFactory.design();
    const inst = D2.circuit.insts[0];
    const o = inst.graph.nodes.find((n) => n.t === 'out');
    dg.connect('out:' + inst.id + ':' + o.id, 'jack:jph:R');
    return window.__tzFactory.design().circuit.wires.some((w) => w.b.n === 'jack:jph' && w.b.p === 'R');
  });
  ok(phw, 'wiring a circuit to the right side of the PHONES jack');
  const phOuts = await win.evaluate(async () => (await import('./js/pages/factory-circuit.js')).compilePatch(window.__tzFactory.design()).outs);
  ok(phOuts.length === 3 && phOuts[1][1] === -1 && phOuts[2][1] === -1, 'the PHONES jack gets an engine output per side: ' + JSON.stringify(phOuts));
  await win.screenshot({ path: path.join(S, 'factory-phones-lr.png') });

  // 24. templates with coded screens: they load, play, and their screen scripts run without errors
  const NEW_TPL = ['vudrive', 'wavetrem', 'squeeze', 'command', 'patternlab'];
  ok((await win.evaluate((ids) => ids.every((id) => window.__tzFactory.templates().includes(id)), NEW_TPL)), 'the coded screen templates are in the list');
  // a big picture of the current design (drawn over the window)
  const bigShot = async (file, h = 900) => {
    await win.evaluate(async (h) => {
      const { thumb } = await import('./js/pages/factory-render.js');
      const ov = document.createElement('div');
      ov.id = 'fzBigShot';
      ov.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#202226;display:flex;align-items:center;justify-content:center';
      const s = thumb(window.__tzFactory.design(), 'fz-bigshot');
      s.setAttribute('height', h);
      s.style.cssText = `height:${h}px;max-width:1580px`;
      ov.appendChild(s);
      document.body.appendChild(ov);
    }, h);
    await win.waitForTimeout(300);
    await win.screenshot({ path: path.join(S, file) });
    await win.evaluate(() => document.querySelector('#fzBigShot')?.remove());
  };
  const runScreens = (id) => win.evaluate(async (id) => {
    const { ScreenRuntime } = await import('./js/screenscript/runtime.js');
    const { makeHost, simIO } = await import('./js/screenscript/host.js');
    const { screenPixels } = await import('./js/screenscript/surface.js');
    const D = window.__tzFactory.template(id);
    const out = [];
    for (const c of D.ctls.filter((x) => x.kind === 'screen' && x.shows === 'custom')) {
      const { W, H } = screenPixels(c);
      const { io } = simIO(D);
      io.cid = c.id;
      const rt = new ScreenRuntime({ src: c.script, w: W, h: H, host: makeHost(D, io), palette: c.type });
      let t = performance.now(), steps = 0;
      const step = () => { rt.frame((t += 40)); steps = Math.max(steps, rt.vm.used + 4000 - rt.vm.R.steps); };
      for (let i = 0; i < 8; i++) step();
      // tap through tabs and around the screen, so every page draws
      for (let k = 0; k < 6 && !rt.error; k++) {
        rt.pointer('down', ((k + 0.5) * W) / 6, 5); step(); rt.pointer('up', ((k + 0.5) * W) / 6, 5); step();
        for (const [fx, fy] of [[0.2, 0.4], [0.5, 0.6], [0.85, 0.92], [0.3, 0.85]]) { rt.pointer('down', fx * W, fy * H); step(); rt.pointer('up', fx * W, fy * H); step(); }
      }
      out.push({ err: rt.error, steps, frames: rt.frameN });
    }
    return out;
  }, id);
  for (const id of [...NEW_TPL, 'synth', 'delay']) {
    const sr = await runScreens(id);
    ok(sr.length >= 1 && sr.every((x) => !x.err && x.frames > 40 && x.steps < 150000), `${id}: the screen script runs without errors within its budget ` + JSON.stringify(sr));
  }
  for (const id of NEW_TPL) {
    await win.click('#fzTemplates');
    await win.click(`[data-template="${id}"]`);
    await win.waitForTimeout(500);
    const info = await win.evaluate(async () => {
      const F = await import('./js/pages/factory-circuit.js');
      const d = window.__tzFactory.design();
      const ins = new Set(d.circuit.insts.flatMap((i) => i.graph.nodes.filter((n) => n.t === 'analog' || n.t === 'binary').map((n) => i.id + '.' + n.id)));
      const maps = d.ctls.flatMap((c) => [c.map, ...(c.maps || [])]).filter((m) => m && m.to && m.to !== 'bypass' && !m.to.endsWith('.tap'));
      const outs = new Set(F.circuitOutputs(d).map((o) => o.key));
      const sio = d.ctls.filter((c) => c.sio).flatMap((c) => [...c.sio.ins.map((p) => outs.has(p.from.n + '.' + p.from.p)), ...c.sio.outs.flatMap((p) => p.maps.map((m) => ins.has(m.to)))]);
      let def = null;
      try { def = F.designToDef(d, { id: 'custom.tplcheck' }); } catch (e) { def = { err: e.message }; }
      return { maps: maps.length, wired: maps.every((m) => ins.has(m.to)), sio: sio.length, sioOk: sio.every(Boolean), def: !!(def && def.derive), stage: window.__tzScreens.stage() };
    });
    ok(info.maps >= 3 && info.wired && info.def, `${id}: every control is wired to a circuit input (${info.maps})`);
    ok(info.sio >= 1 && info.sioOk, `${id}: the screen's inputs and outputs are wired in the diagram (${info.sio})`);
    ok(info.stage.length >= 1 && info.stage.every((x) => !x.error), `${id}: the screen runs on the stage`);
    await win.screenshot({ path: path.join(S, `factory-tpl-${id}.png`) });
    await bigShot(`factory-tpl-${id}-big.png`);
    // Test mode: the engine plays it, circuit outputs reach the screen
    await win.evaluate(() => window.__tzFactory.test(true));
    await win.waitForTimeout(1800);
    const tm = await win.evaluate(() => {
      const st = window.__tz.state.status.blocks.fztest;
      const d = window.__tzFactory.design();
      const scr = d.ctls.find((c) => c.kind === 'screen');
      const p = window.__tzFactory.testInfo().params;
      return { cv: st && st.cv, outs: (scr.sio.outs || []).map((o, i) => p['u.s.' + scr.id + '.' + i]), stage: window.__tzScreens.stage() };
    });
    ok(Array.isArray(tm.cv) && tm.cv.length >= 1 && tm.stage.every((x) => !x.error && x.frames > 5), `${id}: plays in Test mode, circuit outputs ${JSON.stringify(tm.cv)}`);
    if (tm.outs.length) ok(tm.outs.every((v) => typeof v === 'number'), `${id}: the screen's outputs drive the circuit in Test mode ${JSON.stringify(tm.outs.map((v) => +(+v).toFixed(2)))}`);
    await win.screenshot({ path: path.join(S, `factory-tpl-${id}-test.png`) });
    await win.evaluate(() => window.__tzFactory.test(false));
    await win.waitForTimeout(500);
  }

  // the Synth Box screen draws the wave its controls make: turning a knob changes the picture
  const wave = await win.evaluate(async () => {
    const { ScreenRuntime } = await import('./js/screenscript/runtime.js');
    const { makeHost, simIO } = await import('./js/screenscript/host.js');
    const { screenPixels } = await import('./js/screenscript/surface.js');
    const D = window.__tzFactory.template('synth');
    const c = D.ctls.find((x) => x.kind === 'screen');
    const { W, H } = screenPixels(c);
    const { io } = simIO(D, { demo: false });
    io.cid = c.id;
    const host = makeHost(D, io);
    const rt = new ScreenRuntime({ src: c.script, w: W, h: H, host, palette: c.type, readBack: true });
    let t = performance.now();
    for (let i = 0; i < 6; i++) rt.frame((t += 40));
    // same time from here on (no scrolling), only the controls change
    const grab = () => { rt.frame(t); return rt.g.getImageData(2, 14, Math.floor(W * 0.72), H - 36).data; };
    const diff = (a, b) => { let n = 0; for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 60) n++; return n; };
    const a = grab();
    const same = diff(a, grab());
    host.setControl('CUTOFF', 0.05);
    const b = grab();
    host.setControl('CUTOFF', 0.5);
    host.setControl(host.list.find((e) => e.kind === 'switch').name, 2);
    const cc = grab();
    host.setControl('SUB', true);
    const d = grab();
    return { same, cutoff: diff(a, b), wave: diff(a, cc), sub: diff(cc, d), err: rt.error };
  });
  ok(!wave.err && wave.same === 0 && wave.cutoff > 80 && wave.wave > 80 && wave.sub > 80, `the Synth Box wave follows CUTOFF, the WAVE switch and SUB (${wave.same}, ${wave.cutoff}, ${wave.wave}, ${wave.sub} pixels changed)`);
  // pictures of the synth screen at two settings
  await win.click('#fzTemplates');
  await win.click('[data-template="synth"]');
  await win.waitForTimeout(500);
  await bigShot('factory-synth-saw.png');
  await win.evaluate(() => {
    const d = JSON.parse(JSON.stringify(window.__tzFactory.design()));
    const k = (l, v) => (d.ctls.find((c) => c.label === l).value = v);
    k('CUTOFF', 0.15); k('RES', 0.95);
    d.ctls.find((c) => c.kind === 'toggle').pos = 1;
    d.ctls.find((c) => c.label === 'SUB').on = true;
    window.__tzFactory.load(d);
  });
  await win.waitForTimeout(500);
  await bigShot('factory-synth-square.png');

  // the circuit board under a clear enclosure comes from the circuits: a chip for each part, a ribbon to the
  // screen with 10 or more wires, one wire to every step button, the same board every time
  for (const id of ['squeeze', 'command', 'patternlab']) {
    const pcb = await win.evaluate(async (id) => {
      const { PCB_PARTS } = await import('./js/pages/factory-pcb.js');
      const d = window.__tzFactory.template(id);
      d.enc.mat = { m: 'acrylic', f: 'clear', c: '#9fd4ff' };
      d.enc.pcb = true;
      window.__tzFactory.load(d);
      await new Promise((r) => setTimeout(r, 300));
      const D2 = window.__tzFactory.design();
      const p = document.querySelector('.fz-stage .fz-pcb');
      const wires = p.parentNode.querySelector('.fz-wires');
      const types = [...new Set(D2.circuit.insts.flatMap((i) => i.graph.nodes.map((n) => n.t)).filter((t) => PCB_PARTS[t] && PCB_PARTS[t].chips.length))];
      const missing = types.filter((t) => !p.querySelector(`[data-part="${t}"] [data-chip]`));
      const scr = D2.ctls.find((c) => c.kind === 'screen');
      const steps = D2.ctls.find((c) => c.part === 'steps');
      const { thumb } = await import('./js/pages/factory-render.js');
      const a = thumb(D2).querySelector('.fz-pcb').outerHTML, b = thumb(D2).querySelector('.fz-pcb').outerHTML;
      return {
        types, missing, chips: p.querySelectorAll('[data-chip]').length, labels: [...p.querySelectorAll('[data-chip]')].map((e) => e.dataset.label),
        ribbon: wires.querySelectorAll(`.fz-ribbon[data-to="${scr.id}"] path.w`).length, fpc: +(p.querySelector(`.fz-fpc[data-to="${scr.id}"]`)?.dataset.pins || 0),
        steps: steps ? { n: steps.n, wires: wires.querySelectorAll(`.fz-wb[data-to="${steps.id}"] path.w`).length } : null,
        same: a === b,
      };
    }, id);
    ok(pcb.types.length >= 2 && !pcb.missing.length, `${id}: the board has chips for every circuit part (${pcb.types.join(', ')}: ${pcb.labels.join(' ')})`);
    ok(pcb.ribbon >= 10 && pcb.fpc >= 10, `${id}: a wide connector and a ribbon of ${pcb.ribbon} wires to the screen`);
    if (pcb.steps) ok(pcb.steps.wires === pcb.steps.n, `${id}: a wire to each of the ${pcb.steps.n} step buttons (${pcb.steps.wires})`);
    ok(pcb.same, `${id}: the same design draws the same board`);
    await bigShot(`factory-pcb-${id}.png`);
  }
  // a DSP for the delay, an op-amp for the drive: the parts follow the circuit
  const dsp = await win.evaluate(async () => {
    const { pcbParts } = await import('./js/pages/factory-pcb.js');
    const pick = (id) => pcbParts(window.__tzFactory.template(id)).clusters.map((c) => c.type + ':' + c.spec.chips.map((x) => x[0] + x[1]).join('+'));
    return { delay: pick('delay'), drive: pick('drive'), fuzz: pick('fuzz') };
  });
  ok(dsp.delay.some((x) => /^delay:soic28/.test(x)) && dsp.drive.some((x) => /^overdrive:dip8/.test(x)) && dsp.fuzz.some((x) => /^fuzz:to923\+to923/.test(x)), 'delays get a DSP, drives an op-amp, fuzzes transistors: ' + [dsp.delay[0], dsp.drive[0], dsp.fuzz[0]].join(' '));
  // saved as a block, on the board with its board and screen
  await win.evaluate(() => window.__tzFactory.save(true));
  await win.waitForFunction(() => !!window.__tzFactory.design().blockId, null, { timeout: 5000 });
  const labId = (await D()).blockId;
  await win.click('#tabs [data-tab="board"]');
  await win.waitForTimeout(400);
  const labBoard = await win.evaluate(async (id) => {
    const m = await import('./js/state.js');
    const b = m.addBlock(id, 5200, 900);
    await new Promise((r) => setTimeout(r, 600));
    const v = window.__tz.editor.views.get(b.id);
    const ed = window.__tz.editor;
    ed.view.z = 1.3;
    ed.view.x = -b.x * 1.3 + 420;
    ed.view.y = -b.y * 1.3 + 140;
    ed.applyView && ed.applyView();
    return { pcb: !!v.g.querySelector('.fz-pcb'), ribbon: v.g.querySelectorAll('.fz-ribbon path.w').length };
  }, labId);
  await win.waitForTimeout(900);
  ok(labBoard.pcb && labBoard.ribbon >= 10, `the saved pedal shows its board and screen ribbon on the board (${labBoard.ribbon} wires)`);
  await win.screenshot({ path: path.join(S, 'factory-pcb-board.png') });
  await win.click('#tabs [data-tab="factory"]');
  await win.waitForTimeout(300);

  ok(errs.length === 0, 'no console errors');
  if (errs.length) console.log(errs.join('\n'));
  console.log(fails ? `${fails} failed` : 'all passed');
  await app.close();
  fs.rmSync(data, { recursive: true, force: true });
  process.exit(fails ? 1 : 0);
})();
