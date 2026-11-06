// Dev feedback picker test (Ctrl+Shift+K): element pick, area pick with screenshot, Esc, toggle.
// SHOTS=<dir> for screenshots.
const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');
const { decode, imageSize, extractImages } = require('./feedback-decode.js');
const S = process.env.SHOTS || '/tmp';
fs.mkdirSync(S, { recursive: true });
let fails = 0;
const check = (ok, what) => {
  console.log((ok ? 'ok   ' : 'FAIL ') + what);
  if (!ok) fails++;
};

(async () => {
  const app = await electron.launch({ executablePath: require('electron'), args: [path.join(__dirname, '..'), '--no-sandbox'] });
  const win = await app.firstWindow();
  const errs = [];
  win.on('pageerror', (e) => errs.push('PAGEERROR ' + e.stack));
  win.on('console', (m) => m.type() === 'error' && errs.push('CONSOLE ' + m.text()));
  await win.waitForFunction(() => window.__tz && window.__tz.ready, null, { timeout: 90000 });
  await win.waitForTimeout(800);
  const clip = () => app.evaluate(({ clipboard }) => clipboard.readText());
  const setClip = (t) => app.evaluate(({ clipboard }, t) => clipboard.writeText(t), t);
  const overlay = () => win.evaluate(() => !!document.querySelector('.dfb-ui .dfb-overlay'));
  const center = async (sel) => {
    const b = await (await win.$(sel)).boundingBox();
    return [b.x + b.width / 2, b.y + b.height / 2];
  };
  const waitClip = async (old) => {
    for (let i = 0; i < 100; i++) {
      const c = await clip();
      if (c !== old) return c;
      await win.waitForTimeout(100);
    }
    return null;
  };

  // ---- 1. single element: the Save button; the click must not reach it
  await win.evaluate(() => {
    window.__saveClicks = 0;
    document.getElementById('presetSave').addEventListener('click', () => window.__saveClicks++);
  });
  await setClip('none');
  await win.mouse.move(800, 500);
  await win.keyboard.press('Control+Shift+K');
  check(await overlay(), 'Ctrl+Shift+K opens pick mode');
  const [sx, sy] = await center('#presetSave');
  await win.mouse.move(sx - 5, sy, { steps: 4 });
  await win.waitForTimeout(150);
  const lab = await win.evaluate(() => document.querySelector('.dfb-label').textContent);
  console.log('hover label:', lab);
  check(/button#presetSave/.test(lab) && /Save/.test(lab), 'hover label names the button');
  await win.screenshot({ path: S + '/1-hover.png' });
  await win.mouse.click(sx, sy);
  await win.waitForTimeout(200);
  check(await win.evaluate(() => !!document.querySelector('.dfb-dialog textarea')), 'note dialog opens');
  check((await win.evaluate(() => window.__saveClicks)) === 0, 'picked click does not trigger the button');
  await win.keyboard.type('This button doesn\'t work');
  await win.screenshot({ path: S + '/2-note-element.png' });
  await win.keyboard.press('Control+Enter');
  let s1 = await waitClip('none');
  check(s1 && s1.startsWith('TZFB1:'), 'clipboard has a TZFB1 string');
  const p1 = decode(s1);
  console.log('element payload', (s1.length / 1024).toFixed(1), 'KB');
  check(p1.n === "This button doesn't work", 'note round trips');
  check(p1.m === 'el' && p1.el.id === 'presetSave' && p1.el.tg === 'button' && /Save/.test(p1.el.tx), 'button info decoded');
  check(p1.el.cs && p1.el.cs.fs && p1.el.p && p1.el.r.length === 4, 'styles, path and rect present');
  check(p1.pre && p1.tab === 'board' && p1.view && p1.app, 'app context present');
  const t1 = extractImages(p1);
  check(t1.length === 1 && t1[0].size && t1[0].size.w === p1.th.w, 'thumbnail decodes ' + (t1[0] && JSON.stringify(t1[0].size)));
  if (t1[0]) fs.writeFileSync(S + '/thumb.' + t1[0].img.f, t1[0].buf);
  check((await win.evaluate(() => window.__saveClicks)) === 0 && !(await overlay()), 'pick mode closed, button still not clicked');
  await win.waitForTimeout(300);
  await win.screenshot({ path: S + '/3-toast.png' });

  // ---- 2. a knob on the board (svg context)
  const nodes = await win.evaluate(() => {
    const r = document.getElementById('board').getBoundingClientRect();
    return [...document.querySelectorAll('#layerNodes [data-node]')].map((g) => {
      const b = g.getBoundingClientRect();
      return { id: g.dataset.node, x: b.left, y: b.top, w: b.width, h: b.height };
    }).filter((b) => b.x >= r.left && b.y >= r.top && b.x + b.w <= r.right && b.y + b.h <= r.bottom && !b.id.startsWith('__'));
  });
  console.log('visible blocks', nodes.length);
  const knob = await win.evaluate((ids) => {
    for (const id of ids) {
      const k = document.querySelector(`[data-node="${id}"] .knob[data-ctl]`);
      if (k) { const b = k.getBoundingClientRect(); return { id, cid: k.dataset.ctl, x: b.left + b.width / 2, y: b.top + b.height / 2 }; }
    }
  }, nodes.map((n) => n.id));
  if (knob) {
    const before = await win.evaluate((id) => JSON.stringify(window.__tz.state.preset.blocks.find((b) => b.id === id).params), knob.id);
    await setClip('none');
    await win.keyboard.press('Control+Shift+K');
    await win.mouse.move(knob.x, knob.y, { steps: 3 });
    await win.waitForTimeout(100);
    console.log('knob label:', await win.evaluate(() => document.querySelector('.dfb-label').textContent));
    await win.screenshot({ path: S + '/4-hover-knob.png' });
    await win.mouse.click(knob.x, knob.y);
    await win.keyboard.type('Knob label is wrong');
    await win.keyboard.press('Control+Enter');
    const s2 = await waitClip('none');
    const p2 = s2 && decode(s2);
    check(p2 && p2.el.ctl && p2.el.ctl.cid === knob.cid && p2.el.blk && p2.el.blk.id === knob.id && p2.el.blk.ty, 'knob pick has block + control context ' + JSON.stringify(p2 && { ctl: p2.el.ctl, blk: p2.el.blk }));
    const after = await win.evaluate((id) => JSON.stringify(window.__tz.state.preset.blocks.find((b) => b.id === id).params), knob.id);
    check(before === after, 'knob value unchanged by the pick');
  } else console.log('no knob visible, skipped');

  // ---- 3. area over board blocks
  const pick = nodes.slice(0, 3);
  const br = await win.evaluate(() => { const r = document.getElementById('board').getBoundingClientRect(); return { x: r.left, y: r.top, r: r.right, b: r.bottom }; });
  const x0 = Math.max(br.x + 2, Math.min(...pick.map((n) => n.x)) - 20), y0 = Math.max(br.y + 2, Math.min(...pick.map((n) => n.y)) - 20);
  const x1 = Math.min(br.r - 2, Math.max(...pick.map((n) => n.x + n.w)) + 20), y1 = Math.min(br.b - 2, Math.max(...pick.map((n) => n.y + n.h)) + 20);
  await setClip('none');
  await win.keyboard.press('Control+Shift+K');
  await win.mouse.move(x0, y0);
  await win.mouse.down();
  await win.mouse.move((x0 + x1) / 2, (y0 + y1) / 2, { steps: 5 });
  await win.mouse.move(x1, y1, { steps: 5 });
  await win.screenshot({ path: S + '/5-area-drag.png' });
  await win.mouse.up();
  await win.waitForTimeout(150);
  await win.keyboard.type('Make these pedals line up');
  await win.screenshot({ path: S + '/6-note-area.png' });
  const moved = await win.evaluate(() => JSON.stringify(window.__tz.state.preset.blocks.map((b) => [b.x, b.y])));
  await win.keyboard.press('Control+Enter');
  const s3 = await waitClip('none');
  check(s3 && s3.startsWith('TZFB1:'), 'area string copied');
  const p3 = decode(s3);
  console.log('area payload', (s3.length / 1024).toFixed(1), 'KB,', p3.els.length, 'elements, cut', p3.cut || 0);
  const imgs = extractImages(p3);
  const ai = imgs.find((i) => i.name === 'area');
  check(ai && ai.size && ai.size.w === p3.ar.img.w && ai.size.h === p3.ar.img.h && Math.max(ai.size.w, ai.size.h) <= 900, 'area image decodes ' + JSON.stringify(ai && ai.size) + ' ' + (ai && (ai.buf.length / 1024).toFixed(1) + ' KB'));
  const wantW = Math.round(x1 - x0), wantH = Math.round(y1 - y0);
  check(ai && Math.abs(ai.size.w / ai.size.h - wantW / wantH) < 0.05, 'image aspect matches the area');
  if (ai) fs.writeFileSync(S + '/area.' + ai.img.f, ai.buf);
  const ids = new Set(p3.els.filter((e) => e.d && e.d.node).map((e) => e.d.node));
  check(pick.every((n) => ids.has(n.id)), 'elements include the blocks ' + pick.map((n) => n.id).join(','));
  check(pick.every((n) => p3.bl && p3.bl[n.id] && p3.bl[n.id].ty), 'block table has types');
  check(p3.els.every((e) => e.r[0] + e.r[2] > 0 && e.r[1] + e.r[3] > 0 && e.r[0] < p3.ar.r[2] && e.r[1] < p3.ar.r[3]), 'element rects are relative to the area and overlap it');
  check(p3.els.length <= 150, 'element cap');
  check(moved === (await win.evaluate(() => JSON.stringify(window.__tz.state.preset.blocks.map((b) => [b.x, b.y])))), 'drag did not move blocks');
  fs.writeFileSync(S + '/area-payload.json', JSON.stringify(p3, null, 1));

  // ---- 4. Esc cancels (pick mode and note dialog), Ctrl+Shift+K toggles off
  await setClip('keep');
  await win.keyboard.press('Control+Shift+K');
  await win.mouse.move(sx, sy, { steps: 2 });
  await win.keyboard.press('Escape');
  check(!(await overlay()), 'Esc leaves pick mode');
  await win.keyboard.press('Control+Shift+K');
  await win.mouse.click(sx, sy);
  await win.keyboard.type('nope');
  await win.keyboard.press('Escape');
  check(!(await win.evaluate(() => !!document.querySelector('.dfb-ui'))), 'Esc closes the note dialog');
  await win.keyboard.press('Control+Shift+K');
  await win.keyboard.press('Control+Shift+K');
  check(!(await overlay()), 'Ctrl+Shift+K again toggles off');
  await win.waitForTimeout(300);
  check((await clip()) === 'keep', 'cancel copies nothing');
  check((await win.evaluate(() => window.__saveClicks)) === 0, 'Save never clicked');

  console.log(errs.length ? errs.join('\n') : 'no errors');
  console.log(fails ? `${fails} FAILED` : 'ALL OK');
  await app.close();
  process.exit(fails || errs.length ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
