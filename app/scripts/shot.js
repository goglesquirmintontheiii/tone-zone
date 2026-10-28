// Launch the app under Xvfb and take screenshots (dev tool).
const { _electron: electron } = require('playwright');
const path = require('path');
(async () => {
  const out = process.argv[2] || 'shot.png';
  const actions = process.argv[3] || '';
  const app = await electron.launch({ executablePath: require('electron'), args: [path.join(__dirname, '..'), '--no-sandbox'], env: { ...process.env, TZ_DEBUG: '1' } });
  const win = await app.firstWindow();
  const logs = [];
  win.on('console', (m) => logs.push(m.type() + ': ' + m.text()));
  win.on('pageerror', (e) => logs.push('PAGEERROR: ' + e.stack));
  await win.setViewportSize({ width: 1600, height: 950 }).catch(() => {});
  await win.waitForTimeout(3500);
  if (actions) await win.evaluate(actions).catch((e) => logs.push('EVAL: ' + e));
  await win.waitForTimeout(1500);
  await win.screenshot({ path: out });
  console.log(logs.join('\n'));
  await app.close();
})();
