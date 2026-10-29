// Pedal Factory: add a knob, drag it, change the enclosure colour, undo, and check for console errors.
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
  const before = (await D()).enc.color;
  await win.click('.fz-swatches[data-key="enc"] [data-swatch="#c9302c"]');
  await win.waitForTimeout(200);
  ok((await D()).enc.color === '#c9302c', 'enclosure colour changed');
  const fill = await win.evaluate(() => document.querySelector('.fz-stage [data-body]').getAttribute('fill'));
  ok(fill === '#c9302c', 'pedal repainted');
  await win.screenshot({ path: path.join(S, 'factory-colour.png') });

  // 4. undo brings the colour back, a second undo puts the knob back where it was
  await win.click('#fzUndo');
  await win.waitForTimeout(200);
  ok((await D()).enc.color === before, 'undo restored the colour');
  await win.click('#fzUndo');
  await win.waitForTimeout(200);
  const k3 = (await D()).ctls.find((c) => c.id === knob.id);
  ok(k3 && k3.x === knob.x && k3.y === knob.y, 'undo restored the knob position');
  await win.click('#fzRedo');
  await win.waitForTimeout(200);
  ok((await D()).ctls.find((c) => c.id === knob.id).x === k2.x, 'redo works');

  // 5. other panels render without errors
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
