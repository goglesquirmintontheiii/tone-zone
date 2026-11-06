// Plugin sandbox hardware I/O: cables from the hardware into a pedal and back out with real pointer drags, the
// engine playing the sandbox instead of the board while it is cabled, knob turns reaching the engine, the main
// window's paused indicator, and the board coming back exactly as it was on every way of closing.
// usage: node sandbox-io-test.js [out-dir]
const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');
const { readWav } = require('../main/offline.js');
const S = process.argv[2] || '/tmp';
fs.mkdirSync(S, { recursive: true });
let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const PEDAL = 'bx.sd1', PLUGIN = 'boss';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const app = await electron.launch({ executablePath: require('electron'), args: [path.join(__dirname, '..'), '--no-sandbox'] });
  // every command the renderer sends to the engine
  await app.evaluate(({ ipcMain }) => { global.__cmds = []; ipcMain.on('engine:cmd', (_e, c) => global.__cmds.push(c)); });
  const cmds = () => app.evaluate(() => global.__cmds);
  const clearCmds = () => app.evaluate(() => { global.__cmds = []; });
  const win = await app.firstWindow();
  const errs = [];
  win.on('pageerror', (e) => errs.push(e.message));
  win.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await win.setViewportSize({ width: 1600, height: 950 }).catch(() => {});
  await win.waitForFunction(() => window.__tz && window.__tz.ready, null, { timeout: 120000 });
  await win.evaluate(() => { window.__evs = []; window.tz.engine.onEvent((ev) => { if (ev.ev !== 'status') window.__evs.push(ev); }); });
  const ev = (fn, arg) => win.evaluate(fn, arg);
  const statusIds = () => ev(() => Object.keys(window.__tz.state.status.blocks || {}).sort());
  const waitStatus = async (want, ms = 8000) => {
    const t0 = Date.now();
    let got;
    while (Date.now() - t0 < ms) {
      got = await statusIds();
      if (JSON.stringify(got) === JSON.stringify(want)) return got;
      await sleep(150);
    }
    return got;
  };
  const board = () => ev(async () => {
    const st = await import('./js/state.js');
    return { graph: JSON.stringify(st.buildGraph()), dirty: st.state.dirty, undo: st.canUndo(), blocks: st.state.preset.blocks.length, json: JSON.stringify(st.state.preset), over: st.graphOverridden() };
  });
  const engineBoardIds = (g) => JSON.parse(g).nodes.map((n) => n.id).sort();

  await sleep(2500);
  const b0 = await board();
  const ids0 = engineBoardIds(b0.graph);
  ok((await waitStatus(ids0)).join() === ids0.join(), 'engine runs the board at start: ' + ids0.join(','));

  // ---- open the pedal's sandbox from the Plugins page
  const openPedal = async () => {
    if (!(await win.locator('.pl-overlay.detail').count())) {
      await win.click('#tabs [data-tab="plugins"]');
      await win.waitForTimeout(1500);
      await win.locator(`[data-plugin="${PLUGIN}"]`).first().click();
      await win.waitForTimeout(1200);
    }
    const name = await ev((id) => import('./js/catalog/index.js').then((c) => c.getDef(id).name), PEDAL);
    await win.locator('.pd-block', { hasText: name }).first().click();
    await win.waitForSelector('.pl-overlay.sandbox .sb-hwblock');
    await win.waitForTimeout(400);
    return ev(() => [...document.querySelectorAll('.sb-svg')].pop()._sandbox.block.id);
  };
  const sb = () => '.pl-overlay.sandbox .sb-svg';
  const jackSel = (node, key, sbId) => node === 'pedal' ? `${sb()} g.node[data-node="${sbId}"] [data-jack="${key}"]` : `${sb()} [data-sbnode="${node}"] [data-jack="${key}"]`;
  const center = async (sel) => {
    const b = await win.locator(sel).first().boundingBox();
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  };
  const dragTo = async (a, b) => {
    await win.mouse.move(a.x, a.y);
    await win.mouse.down();
    await win.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2 + 40, { steps: 6 });
    await win.mouse.move(b.x, b.y, { steps: 6 });
    await win.mouse.up();
    await win.waitForTimeout(250);
  };
  const io = () => ev(() => {
    const s = [...document.querySelectorAll('.sb-svg')].pop();
    const L = window.__tzSandboxIO;
    const g = L.log.graphs[L.log.graphs.length - 1];
    return { live: L.live(), mine: s ? s._sandbox.io.live() : false, cables: s ? s._sandbox.io.cables() : [], graph: g, cmds: L.log.cmds.slice(), bar: ([...document.querySelectorAll('.pl-overlay.sandbox .sb-io-bar')].pop() || {}).textContent, pill: (() => { const p = document.getElementById('boardPaused'); if (!p) return null; const r = p.getBoundingClientRect(); return { text: p.textContent, w: r.width, h: r.height }; })() };
  });
  const peak = async (ms = 900) => {
    // the loudest output over a short while (status arrives a few times a second)
    let pk = 0;
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
      pk = Math.max(pk, await ev(() => Math.max(...(window.__tz.state.status.outPeak || [0]).slice(0, 2))));
      await sleep(80);
    }
    return pk;
  };
  // after closing: the board is back, exactly
  const checkRestored = async (how, { cached = true } = {}) => {
    await win.waitForTimeout(300);
    const b = await board();
    ok(b.graph === b0.graph, `${how}: the board graph is the same as before`);
    ok(!b.over && !(await io()).live, `${how}: no graph override, no live sandbox`);
    ok(!b.dirty && b.undo === b0.undo && b.json === b0.json, `${how}: preset not modified (dirty ${b.dirty}, undo ${b.undo}, same JSON ${b.json === b0.json})`);
    const st = await waitStatus(ids0);
    ok(st.join() === ids0.join(), `${how}: the engine runs the board again (${st.join()})`);
    const c = await cmds();
    const sets = c.filter((x) => x.cmd === 'setGraph');
    const last = sets[sets.length - 1];
    ok(last && JSON.stringify(last.graph) === b0.graph && !last.key, `${how}: last graph sent is the board's`);
    const iu = c.findIndex((x) => x.cmd === 'useGraph' && x.key === 'tz-sandbox-board');
    ok(iu >= 0 && c.indexOf(last) > iu, `${how}: parked board brought back before the final send`);
    if (cached) {
      const evs = await ev(() => window.__evs.slice());
      ok(evs.some((e) => e.ev === 'graphApplied' && e.key === 'tz-sandbox-board' && e.cached), `${how}: the engine switched back to the board's built blocks (loopers, delays kept)`);
    }
    ok(!(await win.locator('#boardPaused').count()), `${how}: paused indicator gone`);
    await ev(() => { window.__evs = []; });
    await clearCmds();
  };

  const sbId = await openPedal();
  await win.screenshot({ path: path.join(S, 'sandbox-idle.png') });
  let s = await io();
  ok(!s.live && s.cables.length === 0, 'nothing is connected by itself when the pop-up opens');
  ok((await statusIds()).join() === ids0.join(), 'the board still plays while nothing is hooked up');
  ok(/Hook up/.test(s.bar), 'Hook up offered');
  await clearCmds();

  // ---- real drags: IN 1 -> pedal input, pedal output -> OUT L and OUT R
  await dragTo(await center(jackSel('hwin', 'o0')), await center(jackSel('pedal', 'i0', sbId)));
  s = await io();
  ok(s.cables.length === 1 && s.cables[0].from.node === 'hwin' && s.cables[0].to.node === 'pedal', 'drag IN 1 -> pedal input makes a cable');
  ok(s.live && s.mine, 'the sandbox goes live with one hardware cable');
  ok(JSON.stringify(s.cmds.slice(-4)) === JSON.stringify(['setGraph:tz-sandbox-board', 'preload:tz-sandbox', 'useGraph:tz-sandbox', 'override:on']), 'board parked in the engine, sandbox switched in: ' + s.cmds.slice(-4).join(' '));
  await dragTo(await center(jackSel('pedal', 'o0', sbId)), await center(jackSel('hwout', 'i0')));
  await dragTo(await center(jackSel('pedal', 'o0', sbId)), await center(jackSel('hwout', 'i1')));
  s = await io();
  ok(s.cables.length === 3, 'pedal output cabled to OUT L and OUT R (' + s.cables.length + ' cables)');
  const g = s.graph;
  const nodes = g.nodes.map((n) => n.id);
  ok(nodes.length === 1 && nodes[0] === sbId, 'sandbox graph has just the pedal: ' + nodes.join(','));
  const cs = g.cables.map((c) => `${c.from.node}:${c.from.port}>${c.to.node}:${c.to.port}`).sort();
  const want = [`__in:0>${sbId}:0`, `${sbId}:0>__out:0`, `${sbId}:0>__out:1`].sort();
  ok(JSON.stringify(cs) === JSON.stringify(want), 'wiring __in -> pedal -> __out L/R: ' + cs.join(' '));
  const st1 = await waitStatus([sbId]);
  ok(st1.join() === sbId, 'the engine runs only the sandbox pedal; the board blocks are gone (' + st1.join(',') + ')');
  const sentGraph = (await cmds()).filter((x) => x.cmd === 'setGraph').pop();
  ok(sentGraph && !ids0.some((id) => sentGraph.graph.nodes.some((n) => n.id === id)), 'the last graph sent holds none of the board blocks');
  const pk1 = await peak();
  ok(pk1 > 0.01, 'the pedal is heard at the outputs (peak ' + pk1.toFixed(3) + ')');
  s = await io();
  ok(/Live/.test(s.bar) && /board is paused/.test(s.bar), 'live banner shown in the pop-up: ' + s.bar.trim());
  ok(s.pill && /Board paused: trying a pedal/.test(s.pill.text) && s.pill.w > 50, 'main window shows the paused indicator');

  // ---- a knob turn reaches the engine live
  await clearCmds();
  const kc = await center(`${sb()} [data-ctl="c0"]`);
  await win.mouse.move(kc.x, kc.y); await win.mouse.down();
  await win.mouse.move(kc.x, kc.y + 120, { steps: 8 }); await win.mouse.move(kc.x, kc.y + 260, { steps: 8 });
  await win.mouse.up();
  await win.waitForTimeout(300);
  const pc = (await cmds()).filter((x) => x.cmd === 'params' && x.id === sbId && x.values && 'level' in x.values);
  ok(pc.length > 0, `level knob turn sent to the engine (${pc.length} params commands, last level ${pc.length ? pc[pc.length - 1].values.level.toFixed(3) : '-'})`);
  const pk2 = await peak();
  ok(pk2 < pk1 * 0.6, `level down makes the output quieter (${pk1.toFixed(3)} -> ${pk2.toFixed(3)})`);
  // put it back up for the render and the screenshot
  const kc2 = await center(`${sb()} [data-ctl="c0"]`);
  await win.mouse.move(kc2.x, kc2.y); await win.mouse.down(); await win.mouse.move(kc2.x, kc2.y - 150, { steps: 10 }); await win.mouse.up();
  await win.mouse.move(800, 900);
  await win.waitForTimeout(400);
  await win.screenshot({ path: path.join(S, 'sandbox-live.png') });
  const box = await win.locator('.pl-overlay.sandbox .pl-panel').boundingBox();
  await win.screenshot({ path: path.join(S, 'sandbox-live-panel.png'), clip: { x: box.x, y: box.y, width: box.width, height: Math.min(box.height, 950 - box.y) } });
  await win.screenshot({ path: path.join(S, 'topbar-paused.png'), clip: { x: 0, y: 0, width: 1600, height: 60 } });

  // ---- an offline render through the sandbox graph is not silent
  const file = await ev(() => { const L = window.__tzSandboxIO.log; return window.tz.offline.render(L.graphs[L.graphs.length - 1]); });
  const w = readWav(file);
  const rms = (x) => Math.sqrt(x.reduce((a, v) => a + v * v, 0) / x.length);
  ok(w.chans.length >= 2 && rms(w.chans[0]) > 0.005 && rms(w.chans[1]) > 0.005, `offline render of the sandbox graph has sound on L and R (rms ${rms(w.chans[0]).toFixed(4)}, ${rms(w.chans[1] || [0]).toFixed(4)})`);
  fs.rmSync(file, { force: true });

  // ---- unplugging like on the board: drag a plug off, right-click a jack, Delete on a selected cable
  await dragTo(await center(jackSel('hwout', 'i1')), { x: 400, y: 880 });
  s = await io();
  ok(s.cables.length === 2 && s.live, 'dragging the OUT R plug away unplugs it, still live');
  await win.click(jackSel('pedal', 'i0', sbId), { button: 'right' });
  await win.waitForTimeout(250);
  s = await io();
  ok(s.cables.length === 1 && s.live, 'right-click on the pedal input unplugs it, still live (output cable left)');
  await clearCmds();
  // select the last cable by clicking its body, then Delete
  const cablePt = await ev(() => {
    const p = document.querySelector('.pl-overlay.sandbox .sb-svg [data-sbcable] .cable-main');
    const L = p.getTotalLength(), q = p.getPointAtLength(L * 0.5), m = p.getScreenCTM();
    const r = new DOMPoint(q.x, q.y).matrixTransform(m);
    return { x: r.x, y: r.y };
  });
  await win.mouse.click(cablePt.x, cablePt.y);
  await win.keyboard.press('Delete');
  await win.waitForTimeout(300);
  s = await io();
  ok(s.cables.length === 0 && !s.live, 'Delete on a selected cable unplugs it; no cables left so the board comes back');
  ok(/Hook up/.test(s.bar), 'Hook up offered again');
  await checkRestored('last cable removed');

  // ---- Hook up, then close with Escape
  await win.click('.pl-overlay.sandbox .sb-io-bar .btn');
  await win.waitForTimeout(300);
  s = await io();
  const hc = s.cables.map((c) => `${c.from.node}:${c.from.port}>${c.to.node}:${c.to.port}`).sort().join(' ');
  ok(s.live && hc === 'hwin:0>pedal:0 pedal:0>hwout:0 pedal:0>hwout:1', 'Hook up: IN 1 to the input, the mono output to L and R: ' + hc);
  ok((await waitStatus([sbId])).join() === sbId, 'Hook up: engine runs the pedal');
  await win.keyboard.press('Escape');
  await win.waitForTimeout(300);
  ok(!(await win.locator('.pl-overlay.sandbox').count()), 'Escape closes the pop-up');
  await checkRestored('Escape');

  // ---- the X
  let id2 = await openPedal();
  await win.click('.pl-overlay.sandbox .sb-io-bar .btn');
  ok((await waitStatus([id2])).join() === id2, 'live again');
  await win.click('.pl-overlay.sandbox .pl-close');
  await checkRestored('the X');

  // ---- clicking outside
  id2 = await openPedal();
  await win.click('.pl-overlay.sandbox .sb-io-bar .btn');
  ok((await waitStatus([id2])).join() === id2, 'live again');
  await win.mouse.click(8, 940);
  await win.waitForTimeout(200);
  ok(!(await win.locator('.pl-overlay.sandbox').count()), 'clicking outside closes the pop-up');
  await checkRestored('click outside');

  // ---- switching tabs
  id2 = await openPedal();
  await win.click('.pl-overlay.sandbox .sb-io-bar .btn');
  ok((await waitStatus([id2])).join() === id2, 'live again');
  await ev(() => import('./js/util.js').then((u) => u.bus.emit('tab', 'board')));
  await win.waitForTimeout(300);
  ok(!(await win.locator('.pl-overlay.sandbox').count()), 'switching tabs closes the pop-up');
  await checkRestored('tab switch');
  await ev(() => document.querySelectorAll('.pl-overlay').forEach((o) => o.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))));

  // ---- the plugin is turned off while live
  id2 = await openPedal();
  await win.click('.pl-overlay.sandbox .sb-io-bar .btn');
  ok((await waitStatus([id2])).join() === id2, 'live again');
  await ev(() => import('./js/plugins.js').then((p) => p.setPluginEnabled('boss', false)));
  await win.waitForTimeout(600);
  ok(!(await win.locator('.pl-overlay.sandbox').count()), 'turning the plugin off closes the pop-up');
  await checkRestored('plugin off');
  await ev(() => import('./js/plugins.js').then((p) => p.setPluginEnabled('boss', true)));
  await win.waitForTimeout(1500);
  await ev(() => document.querySelectorAll('.pl-overlay').forEach((o) => o.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))));
  ok((await board()).graph === b0.graph && (await waitStatus(ids0)).join() === ids0.join(), 'plugin back on: board unchanged and playing');
  await clearCmds();
  await ev(() => { window.__evs = []; });

  // ---- the engine restarts while live: it comes back playing the sandbox, closing gives the board back
  id2 = await openPedal();
  await win.click('.pl-overlay.sandbox .sb-io-bar .btn');
  ok((await waitStatus([id2])).join() === id2, 'live again');
  await ev(() => { window.__tz.state.status.blocks = {}; return window.tz.engine.restart(); });
  await win.waitForTimeout(1500);
  ok((await waitStatus([id2], 15000)).join() === id2, 'after an engine restart the sandbox is still what plays');
  ok((await io()).live, 'still live after the restart');
  await win.keyboard.press('Escape');
  await checkRestored('engine restart', { cached: false });

  // ---- two sandboxes can't be live at once
  id2 = await openPedal();
  await win.click('.pl-overlay.sandbox .sb-io-bar .btn');
  ok((await waitStatus([id2])).join() === id2, 'first sandbox live');
  const two = await ev(async (pid) => {
    const [{ openSandbox }, cat] = await Promise.all([import('./js/pages/plugins.js'), import('./js/catalog/index.js')]);
    const close2 = openSandbox(cat.getDef(pid));
    const s2 = [...document.querySelectorAll('.sb-svg')].pop()._sandbox;
    s2.io.hookUp();
    const r = { second: s2.io.live(), cables: s2.io.cables().length };
    close2();
    return r;
  }, PEDAL);
  ok(!two.second && two.cables === 0, 'a second sandbox is refused while the first is live');
  ok((await io()).live && (await statusIds()).join() === id2, 'the first one still plays');
  await win.keyboard.press('Escape');
  await checkRestored('two sandboxes');

  ok(!errs.length, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 5).join(' | ') : ''));
  console.log(fails ? `${fails} FAILED` : 'all ok');
  await app.close();
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
