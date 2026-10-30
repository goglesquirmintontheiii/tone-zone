// Pedal Factory: add a knob, drag it, change the enclosure colour, per-part materials, patterns, wear, undo.
const { _electron: electron } = require('playwright');
const path = require('path');
const S = process.env.SHOTS || '/tmp';
(async () => {
  const app = await electron.launch({ executablePath: require('electron'), args: [path.join(__dirname, '..'), '--no-sandbox'] });
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

  await win.click('#tabs [data-tab="factory"]');
  await win.waitForSelector('.fz-stage');
  // start from a known design
  await win.click('#fzTemplates');
  await win.click('[data-template="drive"]');
  await win.waitForTimeout(400);
  const d0 = await D();
  ok(d0.name === 'Classic Drive' && d0.ctls.length === 5, 'template loaded');

  // 1. add a knob from the parts panel
  await win.click('.fz-tabs [data-t="parts"]');
  await win.click('.fz-tile[data-part="knob"]');
  await win.waitForTimeout(300);
  const d1 = await D();
  const knob = d1.ctls.find((c) => !d0.ctls.some((o) => o.id === c.id));
  ok(d1.ctls.length === 6 && knob && knob.kind === 'knob', 'knob added');
  ok((await win.evaluate(() => window.__tzFactory.selection())) === knob.id, 'new knob is selected');

  // 2. drag it on the stage
  const box = await (await win.$(`.fz-stage [data-id="${knob.id}"]`)).boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
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
  ok(await win.$eval('#fzExport', (b) => b.disabled), 'export is disabled');

  ok(errs.length === 0, 'no console errors');
  if (errs.length) console.log(errs.join('\n'));
  console.log(fails ? `${fails} failed` : 'all passed');
  await app.close();
  process.exit(fails ? 1 : 0);
})();
