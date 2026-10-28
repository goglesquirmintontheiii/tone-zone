// Interaction smoke test: knobs, cables, drag-in, inspector, presets, library import.
const { _electron: electron } = require('playwright');
const path = require('path');
const S = process.env.SHOTS || '/tmp';
(async () => {
  const app = await electron.launch({ executablePath: require('electron'), args: [path.join(__dirname, '..'), '--no-sandbox'] });
  const win = await app.firstWindow();
  const errs = [];
  win.on('pageerror', (e) => errs.push('PAGEERROR ' + e.stack));
  win.on('console', (m) => m.type() === 'error' && errs.push('CONSOLE ' + m.text()));
  await win.waitForFunction(() => window.__tz && window.__tz.ready, null, { timeout: 90000 });
  await win.waitForTimeout(500);
  const ev = (f, a) => win.evaluate(f, a);
  // 1. knob drag on the green drive
  const ts = await ev(() => window.__tz.state.preset.blocks.find((b) => b.type === 'ib.ts9').id);
  await ev((id) => { const ed = window.__tz.editor; const b = window.__tz.state.preset.blocks.find(x=>x.id===id); const v = ed.views.get(id); const r = ed.svg.getBoundingClientRect(); ed.view.z = 1.6; ed.view.x = r.width/2 - (b.x + v.w/2) * 1.6; ed.view.y = r.height/2 - (b.y + v.h/2) * 1.6; ed.applyView(); }, ts);
  await win.waitForTimeout(300);
  const knob = await win.$(`[data-node="${ts}"] [data-ctl="c0"]`);
  const kb = await knob.boundingBox();
  const before = await ev((id) => window.__tz.state.preset.blocks.find((b) => b.id === id).params.gain, ts);
  await win.mouse.move(kb.x + kb.width / 2, kb.y + kb.height / 2);
  await win.mouse.down();
  await win.mouse.move(kb.x + kb.width / 2, kb.y + kb.height / 2 - 60, { steps: 6 });
  await win.screenshot({ path: S + '/ui-knobdrag.png' });
  await win.mouse.up();
  const after = await ev((id) => window.__tz.state.preset.blocks.find((b) => b.id === id).params.gain, ts);
  console.log('knob gain', before, '->', after);
  // 2. click the node to open the inspector
  const nb = await (await win.$(`[data-node="${ts}"]`)).boundingBox();
  await win.mouse.click(nb.x + nb.width / 2, nb.y + nb.height * 0.42);
  await win.waitForTimeout(400);
  console.log('inspector open', await ev(() => !document.getElementById('inspector').classList.contains('collapsed')));
  await win.screenshot({ path: S + '/ui-inspector.png' });
  // 3. drag a block in from the browser
  const item = await win.$('.bl-item');
  const board = await win.$('#board');
  const bb = await board.boundingBox();
  const nBefore = await ev(() => window.__tz.state.preset.blocks.length);
  const ib0 = await (await win.$('.bl-item >> nth=3')).boundingBox();
  await win.mouse.move(ib0.x + 30, ib0.y + ib0.height / 2);
  await win.mouse.down();
  await win.mouse.move(bb.x + bb.width * 0.5, bb.y + bb.height * 0.25, { steps: 10 });
  await win.mouse.up();
  const tDrop = Date.now();
  await win.waitForFunction((n) => window.__tz.state.preset.blocks.length > n, nBefore, { timeout: 3000 }).catch(() => {});
  console.log('drop-in latency ms', Date.now() - tDrop);
  console.log('blocks', nBefore, '->', await ev(() => window.__tz.state.preset.blocks.length));
  // 4. patch a cable: unplug TS9 input then re-plug by dragging from the TS9 output to the new block input
  const newId = await ev(() => { const s = window.__tz.state; return [...s.selection][0]; });
  const cablesBefore = await ev(() => window.__tz.state.preset.cables.length);
  const out = await win.$(`[data-node="${ts}"] [data-jack="o0"]`);
  const inp = await win.$(`[data-node="${newId}"] [data-jack="i0"]`);
  if (out && inp) {
    const ob = await out.boundingBox(), ib = await inp.boundingBox();
    await win.mouse.move(ob.x + ob.width / 2, ob.y + ob.height / 2);
    await win.mouse.down();
    await win.mouse.move(ib.x + ib.width / 2, ib.y + ib.height / 2, { steps: 12 });
    await win.screenshot({ path: S + '/ui-cabledrag.png' });
    await win.mouse.up();
  }
  console.log('cables', cablesBefore, '->', await ev(() => window.__tz.state.preset.cables.length));
  // 4b. shift+drag marquee selects several blocks
  await win.keyboard.down('Shift');
  await win.mouse.move(bb.x + 20, bb.y + 20);
  await win.mouse.down();
  await win.mouse.move(bb.x + bb.width - 20, bb.y + bb.height - 20, { steps: 8 });
  await win.mouse.up();
  await win.keyboard.up('Shift');
  console.log('marquee selected', await ev(() => window.__tz.state.selection.size));
  // 5. undo
  await win.keyboard.press('Control+z');
  await win.waitForTimeout(200);
  console.log('after undo cables', await ev(() => window.__tz.state.preset.cables.length));
  await win.screenshot({ path: S + '/ui-final.png' });
  console.log(errs.join('\n') || 'no errors');
  await app.close();
})();
