// Trace paints for a couple of seconds and summarise paint/raster events.
const { _electron: electron } = require('playwright');
const path = require('path');
(async () => {
  const app = await electron.launch({ executablePath: require('electron'), args: [path.join(__dirname, '..'), '--no-sandbox'] });
  const win = await app.firstWindow();
  await win.setViewportSize({ width: 1600, height: 950 }).catch(() => {});
  await win.waitForTimeout(4000);
  if (process.env.EVAL) await win.evaluate(process.env.EVAL);
  const cdp = await win.context().newCDPSession(win);
  const events = [];
  cdp.on('Tracing.dataCollected', (d) => events.push(...d.value));
  const done = new Promise((r) => cdp.once('Tracing.tracingComplete', r));
  await cdp.send('Tracing.start', { categories: 'devtools.timeline,disabled-by-default-devtools.timeline,disabled-by-default-devtools.timeline.invalidationTracking,cc,blink', transferMode: 'ReportEvents' });
  await win.waitForTimeout(2000);
  await cdp.send('Tracing.end');
  await done;
  const agg = {};
  for (const e of events) {
    if (e.ph !== 'X' && e.ph !== 'B') continue;
    const k = e.name;
    agg[k] = agg[k] || { n: 0, dur: 0 };
    agg[k].n++;
    agg[k].dur += (e.dur || 0) / 1000;
  }
  Object.entries(agg).sort((a, b) => b[1].dur - a[1].dur).slice(0, 30).forEach(([k, v]) => console.log(v.dur.toFixed(1).padStart(8) + 'ms', String(v.n).padStart(5), k));
  const paints = events.filter((e) => e.name === 'Paint' && e.args?.data);
  console.log('paints', paints.length, JSON.stringify(paints.slice(0, 5).map((p) => p.args.data)));
  const inv = events.filter((e) => /Invalidat/.test(e.name)).slice(0, 12).map((e) => e.name + ' ' + JSON.stringify(e.args?.data || {}).slice(0, 300));
  console.log(inv.join('\n'));
  await app.close();
})();
