// Measure per-process CPU of the running app for a scene (GPU/raster cost proxy under software GL).
const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');
const scene = process.argv[2] || 'one';
let ROOT = 0; // only this app's process tree (other test runs may be going on at the same time)
function inTree(pid) {
  for (let p = +pid, i = 0; p > 1 && i < 20; i++) {
    if (p === ROOT) return true;
    try { p = +fs.readFileSync(`/proc/${p}/stat`, 'utf8').split(') ')[1].split(' ')[1]; } catch { return false; }
  }
  return false;
}
function procTimes() {
  const out = {};
  for (const pid of fs.readdirSync('/proc').filter((x) => /^\d+$/.test(x))) {
    try {
      const cmd = fs.readFileSync(`/proc/${pid}/cmdline`, 'utf8');
      if (!/electron|tonezone-engine/.test(cmd)) continue;
      if (ROOT && !inTree(pid)) continue;
      const st = fs.readFileSync(`/proc/${pid}/stat`, 'utf8').split(') ')[1].split(' ');
      const t = (+st[11] + +st[12]) / 100;
      let type = (cmd.match(/--type=([a-z-]+)/) || [, 'main'])[1];
      if (/tonezone-engine/.test(cmd)) type = 'engine';
      out[type] = (out[type] || 0) + t;
    } catch {}
  }
  return out;
}
(async () => {
  const app = await electron.launch({ executablePath: require('electron'), args: [path.join(__dirname, '..'), '--no-sandbox'] });
  ROOT = app.process().pid;
  const win = await app.firstWindow();
  await win.setViewportSize({ width: 1600, height: 950 }).catch(() => {});
  await win.waitForTimeout(3500);
  if (process.env.EVAL) await win.evaluate(process.env.EVAL);
  await win.evaluate((scene) => {
    const T = window.__tz;
    const keep = scene === 'one' ? ['ib.ts9'] : null;
    if (keep) {
      const ids = T.state.preset.blocks.filter((b) => !b.id.startsWith('__') && !keep.includes(b.type)).map((b) => b.id);
      T.removeBlocks ? T.removeBlocks(ids) : null;
    }
  }, scene).catch((e) => console.log('eval', e.message));
  await win.waitForTimeout(1500);
  const a = procTimes();
  const t0 = Date.now();
  await win.waitForTimeout(10000);
  const b = procTimes();
  const dt = (Date.now() - t0) / 1000;
  const res = {};
  for (const k of Object.keys(b)) res[k] = (((b[k] - (a[k] || 0)) / dt) * 100).toFixed(1) + '%';
  console.log(scene, JSON.stringify(res));
  await win.screenshot({ path: process.env.SHOT || '/tmp/perf.png' });
  await app.close();
})();
