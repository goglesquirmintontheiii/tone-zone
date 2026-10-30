// Pedal Factory: add a knob, drag it, change the enclosure colour, per-part materials, patterns, wear, undo,
// old designs loading, LED selection, multi-select editing, mirror mode, a 12 switch DIP, save as block (Custom
// filter, on the board), test mode (graph override and restore) and an offline render of the custom block.
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
  ok(d00.name === 'Old Fuzz' && d00.circuit.v === 2 && d00.circuit.stages[0].type === 'fuzz', 'old design loads with a real circuit');
  const sid0 = d00.circuit.stages[0].id;
  ok(d00.ctls[0].map.to === sid0 + '.gain' && d00.ctls[1].map.to === sid0 + '.level' && d00.ctls[2].map.to === 'bypass', 'old controls wired by their names');

  // start from a known design
  await win.click('#fzTemplates');
  await win.click('[data-template="drive"]');
  await win.waitForTimeout(400);
  const d0 = await D();
  ok(d0.name === 'Classic Drive' && d0.ctls.length === 5, 'template loaded');
  ok(d0.ctls.filter((c) => c.kind === 'knob').every((c) => c.map && c.map.to.startsWith(d0.circuit.stages[0].id + '.')), 'template knobs are wired to the circuit');

  // 1. add a knob from the parts panel
  await win.click('.fz-tabs [data-t="parts"]');
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

  // 3. change the enclosure colour from the inspector
  await win.keyboard.press('Escape');
  await win.waitForSelector('.fz-swatches[data-key="enc"]');
  const before = (await D()).enc.mat.c;
  await win.click('.fz-swatches[data-key="enc"] [data-swatch="#c9302c"]');
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
  await win.click('[data-circuit="drivedelay"]');
  await win.waitForTimeout(200);
  await win.click('.fz-tabs [data-t="parts"]');
  await win.click('.fz-tile[data-part="dip"]');
  await win.waitForTimeout(200);
  const nIn = await win.$('.fz-insp .fz-sec .fz-num');
  await nIn.fill('12');
  await nIn.press('Enter');
  await win.waitForTimeout(200);
  for (let i = 0; i < 12; i++) {
    const opts = await win.$$eval(`.fz-dipmap[data-dip="${i}"] .fz-dip-sel option`, (o) => o.map((x) => x.value).filter((v) => v && !v.endsWith('.on') && !v.endsWith('.tap')));
    await win.selectOption(`.fz-dipmap[data-dip="${i}"] .fz-dip-sel`, opts[i]);
    await win.waitForTimeout(60);
  }
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
    const k = Object.keys(after).find((x) => x.endsWith('.gain'));
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
  ok(ti.over && ti.nodes.length === 1 && ti.nodes[0] === 'fztest:chain' && ti.cables >= 2, 'test mode sends a graph with the custom node: ' + ti.nodes.join(','));
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
    return { file: await window.tz.offline.render(g, di), algo: g.nodes[0].algo, chain: g.nodes[0].opts.chain.length };
  }, [blockId, di]);
  const lv = measure(wav.file);
  fs.rmSync(wav.file, { force: true });
  ok(wav.algo === 'chain' && wav.chain >= 1 && lv.lufs > -45 && lv.peak < 0, `offline render of the custom block is not silent (${lv.lufs.toFixed(1)} LUFS)`);

  ok(errs.length === 0, 'no console errors');
  if (errs.length) console.log(errs.join('\n'));
  console.log(fails ? `${fails} failed` : 'all passed');
  await app.close();
  fs.rmSync(data, { recursive: true, force: true });
  process.exit(fails ? 1 : 0);
})();
