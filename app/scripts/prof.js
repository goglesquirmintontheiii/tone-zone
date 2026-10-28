// CPU-profile the renderer for a few seconds and print the hottest functions (self time).
const { _electron: electron } = require('playwright');
const path = require('path');
(async () => {
  const app = await electron.launch({ executablePath: require('electron'), args: [path.join(__dirname, '..'), '--no-sandbox'] });
  const win = await app.firstWindow();
  await win.setViewportSize({ width: 1600, height: 950 }).catch(() => {});
  await win.waitForTimeout(4000);
  if (process.argv[2]) await win.evaluate(process.argv[2]);
  const cdp = await win.context().newCDPSession(win);
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.setSamplingInterval', { interval: 200 });
  await cdp.send('Profiler.start');
  await win.waitForTimeout(5000);
  const { profile } = await cdp.send('Profiler.stop');
  const self = new Map();
  const dt = profile.timeDeltas;
  const byId = new Map(profile.nodes.map((n) => [n.id, n]));
  const t = new Map();
  profile.samples.forEach((s, i) => t.set(s, (t.get(s) || 0) + (dt[i] || 0)));
  let total = 0;
  for (const [id, us] of t) {
    const n = byId.get(id);
    const k = `${n.callFrame.functionName || '(anon)'} ${n.callFrame.url.split('/').pop()}:${n.callFrame.lineNumber}`;
    self.set(k, (self.get(k) || 0) + us);
    total += us;
  }
  [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25).forEach(([k, us]) => console.log(((us / total) * 100).toFixed(1).padStart(5) + '%  ' + k));
  await app.close();
})();
