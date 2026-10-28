// Dump the engine graph JSON for each factory preset (for offline engine profiling).
const { _electron: electron } = require('playwright');
const path = require('path'); const fs = require('fs');
(async () => {
  const out = process.argv[2];
  fs.mkdirSync(out, { recursive: true });
  const app = await electron.launch({ executablePath: require('electron'), args: [path.join(__dirname, '..'), '--no-sandbox'] });
  const win = await app.firstWindow();
  await win.waitForTimeout(3000);
  for (const f of fs.readdirSync(path.join(__dirname, '../presets'))) {
    const p = JSON.parse(fs.readFileSync(path.join(__dirname, '../presets', f)));
    const g = await win.evaluate((p) => { window.__tz.loadPreset(p, null); return window.__tz.buildGraph(); }, p);
    fs.writeFileSync(path.join(out, f), JSON.stringify(g));
  }
  await app.close();
})();
