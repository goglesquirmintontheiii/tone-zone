// Turning plugins off and on again: preset thumbnails must stop showing missing pedals once they're back.
const { _electron: electron } = require('playwright');
const path = require('path');
(async () => {
  const app = await electron.launch({ executablePath: require('electron'), args: [path.join(__dirname, '..'), '--no-sandbox'] });
  const win = await app.firstWindow();
  const errs = []; win.on('pageerror', (e) => errs.push(e.message));
  await win.setViewportSize({ width: 1600, height: 950 }).catch(() => {});
  await win.waitForFunction(() => window.__tz && window.__tz.ready, null, { timeout: 120000 });
  const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) errs.push(m); };
  // thumbnails of the first presets (wait until they're drawn)
  const thumbs = async () => {
    await win.click('#tabs [data-tab="presets"]');
    await win.waitForFunction(() => [...document.querySelectorAll('.pc-thumb')].slice(0, 12).every((i) => i.src && i.src.startsWith('data:')), null, { timeout: 60000 }).catch(() => {});
    await win.waitForTimeout(500);
    return win.evaluate(() => [...document.querySelectorAll('.pc-thumb')].slice(0, 12).map((i) => i.src.length + ':' + i.src.slice(-40)));
  };
  const before = await thumbs();
  const plugins = async (on) => {
    await win.click('#tabs [data-tab="plugins"]');
    await win.waitForTimeout(800);
    await win.locator('button', { hasText: on ? 'Turn all on' : 'Turn brands off' }).first().click();
    await win.waitForTimeout(on ? 300 : 2500);
  };
  await plugins(false);
  const off = await thumbs();
  ok(off.some((t, i) => t !== before[i]), 'with plugins off some thumbnails change (missing pedals)');
  await plugins(true);
  await thumbs(); // straight away, while plugins are still loading
  // then wait for every plugin to be back and give the thumbnails a moment to redraw
  for (let i = 0; i < 90; i++) {
    const left = await win.evaluate(async () => { const P = await import('./js/plugins.js'); return [...P.pluginInfo().values()].filter((p) => p.disabled).length; });
    if (!left) break;
    await win.waitForTimeout(1000);
  }
  await win.waitForTimeout(3000);
  const back = await win.evaluate(() => [...document.querySelectorAll('.pc-thumb')].slice(0, 12).map((i) => i.src.length + ':' + i.src.slice(-40)));
  ok(back.every((t, i) => t === before[i]), 'with plugins back on the thumbnails match the originals');
  console.log(errs.length ? errs.join('\n') : 'no errors');
  await app.close();
})();
