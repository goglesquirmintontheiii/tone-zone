// Board screens drop resolution when they're small on screen: full detail on hover or above 140% zoom.
const { _electron: electron } = require('playwright');
const path = require('path');
(async () => {
  const app = await electron.launch({ executablePath: require('electron'), args: [path.join(__dirname, '..'), '--no-sandbox'] });
  const win = await app.firstWindow();
  const errs = [];
  win.on('pageerror', (e) => errs.push(e.message));
  await win.setViewportSize({ width: 1600, height: 950 }).catch(() => {});
  await win.waitForFunction(() => window.__tz && window.__tz.ready, null, { timeout: 120000 });
  const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) errs.push(m); };
  await win.click('#tabs [data-tab="factory"]');
  await win.waitForFunction(() => window.__tzFactory, null, { timeout: 30000 });
  // a pedal with a big scripted screen
  const id = await win.evaluate(async () => {
    const { saveCustomBlock } = await import('./js/catalog/custom.js');
    const D = window.__tzFactory.template('synth');
    const c = D.ctls.find((x) => x.kind === 'screen');
    c.shows = 'custom';
    c.script = 'function draw()\n  clear()\n  for i = 0, 20 do line(0, i * 4, W, H - i * 4) end\n  text("LOD " .. W .. "x" .. H, 2, 2)\nend\n';
    D.name = 'LOD test';
    D.blockId = null;
    return saveCustomBlock(D, { asNew: true });
  });
  await win.click('#tabs [data-tab="board"]');
  const bid = await win.evaluate(async (id) => {
    const m = await import('./js/state.js');
    const b = m.addBlock(id, 3000, 3000);
    await new Promise((r) => setTimeout(r, 400));
    return b.id;
  }, id);
  // zoom onto the block, then read the running screen's backing size
  const at = async (z, settle = 1200) =>
    win.evaluate(async ({ bid, z, settle }) => {
      const ed = window.__tz.editor;
      const v = ed.views.get(bid);
      ed.view.z = z;
      ed.view.x = -(v.block.x + v.w / 2) * z + 700;
      ed.view.y = -(v.block.y + v.h / 2) * z + 450;
      ed.applyView && ed.applyView();
      await new Promise((r) => setTimeout(r, settle));
      const { boardScreens } = await import('./js/screenscript/board.js');
      const s = boardScreens().find((x) => x.key.startsWith(bid + '|'));
      const r = v.g.querySelector('.ss-board').getBoundingClientRect();
      return s && { scale: s.scale, px: s.px, W: s.W, H: s.H, frames: s.frames, error: s.error, box: { x: r.x, y: r.y, w: r.width, h: r.height } };
    }, { bid, z, settle });
  await win.mouse.move(5, 500);
  const z150 = await at(1.5);
  console.log('150%', JSON.stringify(z150));
  ok(z150 && !z150.error && z150.scale === 1 && z150.px[0] === z150.W, 'above 140% the screen runs at full resolution');
  const z100 = await at(1.0);
  console.log('100%', JSON.stringify(z100));
  ok(z100.scale < 1 && z100.px[0] < z100.W, `at 100% it's lower (${z100.px.join('x')} of ${z100.W}x${z100.H})`);
  const z60 = await at(0.6);
  console.log(' 60%', JSON.stringify(z60));
  ok(z60.scale < z100.scale, `zoomed out further it's lower still (${z60.px.join('x')})`);
  // hover: full resolution right away
  await win.mouse.move(z60.box.x + z60.box.w / 2, z60.box.y + z60.box.h / 2);
  await win.waitForTimeout(400);
  const hov = await at(0.6, 300);
  console.log('hover', JSON.stringify(hov));
  ok(hov.scale === 1, 'with the mouse over it the screen is full resolution');
  await win.mouse.move(5, 500);
  await win.waitForTimeout(1200);
  const left = await at(0.6);
  ok(left.scale === z60.scale, 'and drops again when the mouse leaves');
  ok(left.frames > 20, `it keeps drawing (${left.frames} frames)`);
  const img = await win.evaluate((bid) => !!window.__tz.editor.views.get(bid).g.querySelector('.ss-board image.ss-img[href^="data:image/png"]'), bid);
  ok(img, 'the screen image is there');
  console.log(errs.length ? errs.join('\n') : 'no errors');
  await app.close();
  process.exit(errs.length ? 1 : 0);
})();
