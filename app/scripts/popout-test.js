// Pop the inspector out into its own window, screenshot both, then dock it back.
const { _electron: electron } = require('playwright');
const path = require('path');
(async () => {
  const S = process.argv[2];
  const app = await electron.launch({ executablePath: require('electron'), args: [path.join(__dirname, '..'), '--no-sandbox'] });
  const win = await app.firstWindow();
  const errs = [];
  win.on('pageerror', (e) => errs.push(e.stack));
  await win.setViewportSize({ width: 1600, height: 950 }).catch(() => {});
  await win.waitForTimeout(3000);
  await win.evaluate(() => { const T = window.__tz; const b = T.state.preset.blocks.find((x) => x.type === 'ib.ts9'); T.editor.select([b.id]); });
  await win.waitForTimeout(400);
  const [pop] = await Promise.all([app.waitForEvent('window'), win.click('#inspector > .panel-pop')]);
  await pop.waitForTimeout(800);
  await pop.screenshot({ path: S + '/popped-insp.png' });
  await win.screenshot({ path: S + '/main-after-pop.png' });
  // change a knob from the popped window
  const before = await win.evaluate(() => window.__tz.state.preset.blocks.find((x) => x.type === 'ib.ts9').params.gain);
  console.log('popped has controls', await pop.evaluate(() => document.querySelectorAll('.insp-row, .row').length));
  await pop.click('.panel-pop');
  await win.waitForTimeout(500);
  console.log('docked back', await win.evaluate(() => !!document.querySelector('#views #inspector')));
  // resize browser panel
  const g = await win.$('#browser .panel-resizer');
  const bb = await g.boundingBox();
  await win.mouse.move(bb.x + 3, bb.y + 300); await win.mouse.down(); await win.mouse.move(bb.x + 120, bb.y + 300, { steps: 5 }); await win.mouse.up();
  console.log('browser width', await win.evaluate(() => document.getElementById('browser').getBoundingClientRect().width));
  console.log(errs.join('\n'), before);
  await app.close();
})();
