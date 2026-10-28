const { _electron: electron } = require('playwright');
const path = require('path'); const fs = require('fs');
(async () => {
  const app = await electron.launch({ executablePath: require('electron'), args: [path.join(__dirname, '..'), '--no-sandbox'] });
  const win = await app.firstWindow();
  await win.setViewportSize({ width: 1600, height: 950 }).catch(() => {});
  await win.waitForTimeout(4000);
  const r = await win.evaluate(fs.readFileSync(process.argv[2], 'utf8'));
  for (const [k, v] of r) console.log(v, k);
  await app.close();
})();
