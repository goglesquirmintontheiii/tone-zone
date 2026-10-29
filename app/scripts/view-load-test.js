// Load presets from the presets tab, go back to the board and check the blocks are on screen.
const { _electron: electron } = require('playwright');
const path = require('path');
(async () => {
  const app = await electron.launch({ executablePath: require('electron'), args: [path.join(__dirname, '..'), '--no-sandbox'] });
  const win = await app.firstWindow();
  const errs = []; win.on('pageerror', (e) => errs.push(e.message));
  await win.setViewportSize({ width: 1600, height: 950 }).catch(() => {});
  await win.waitForFunction(() => window.__tz && window.__tz.ready, null, { timeout: 120000 });
  const vis = () => win.evaluate(() => {
    const b = document.getElementById('board').getBoundingClientRect();
    let tot = 0, inn = 0;
    for (const n of document.querySelectorAll('#boardSvg .node')) {
      const r = n.getBoundingClientRect();
      const a = r.width * r.height; tot += a;
      const ix = Math.max(0, Math.min(r.right, b.right) - Math.max(r.left, b.left)), iy = Math.max(0, Math.min(r.bottom, b.bottom) - Math.max(r.top, b.top));
      inn += ix * iy;
    }
    return +(inn / Math.max(1, tot)).toFixed(2);
  });
  for (const i of [5, 20, 40, 60]) {
    await win.click('#tabs [data-tab="presets"]');
    await win.waitForTimeout(700);
    const card = win.locator('.preset-card').nth(i);
    const name = await card.locator('.pc-name').textContent();
    await card.click();
    await win.waitForTimeout(600);
    await win.click('#tabs [data-tab="board"]');
    await win.waitForTimeout(700);
    console.log(name.padEnd(40), 'visible fraction', await vis());
  }
  console.log(errs.length ? errs.join('\n') : 'no errors');
  await app.close();
})();
