// CPU of renderer + GPU process while panning and zooming the board continuously (pan/zoom cost).
const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');
let ROOT = 0;
function inTree(pid) {
  for (let p = +pid, i = 0; p > 1 && i < 20; i++) {
    if (p === ROOT) return true;
    try { p = +fs.readFileSync(`/proc/${p}/stat`, 'utf8').split(') ')[1].split(' ')[1]; } catch { return false; }
  }
  return false;
}
function times() {
  const out = {};
  for (const pid of fs.readdirSync('/proc').filter((x) => /^\d+$/.test(x))) {
    try {
      const cmd = fs.readFileSync(`/proc/${pid}/cmdline`, 'utf8');
      if (!/electron/.test(cmd) || !inTree(pid)) continue;
      const st = fs.readFileSync(`/proc/${pid}/stat`, 'utf8').split(') ')[1].split(' ');
      const type = (cmd.match(/--type=([a-z-]+)/) || [, 'main'])[1];
      out[type] = (out[type] || 0) + (+st[11] + +st[12]) / 100;
    } catch {}
  }
  return out;
}
(async () => {
  const app = await electron.launch({ executablePath: require('electron'), args: [path.join(__dirname, '..'), '--no-sandbox'] });
  ROOT = app.process().pid;
  const win = await app.firstWindow();
  await win.setViewportSize({ width: 1600, height: 950 }).catch(() => {});
  await win.waitForFunction(() => window.__tz && window.__tz.ready, null, { timeout: 90000 });
  if (process.argv[2]) await win.evaluate(process.argv[2]);
  await win.waitForTimeout(3000);
  const b = await (await win.$('#board')).boundingBox();
  const a = times(), t0 = Date.now();
  for (let k = 0; k < 4; k++) {
    await win.mouse.move(b.x + 200, b.y + b.height - 120);
    await win.mouse.down({ button: 'middle' });
    await win.mouse.move(b.x + 600, b.y + b.height - 220, { steps: 40 });
    if (k === 1) await win.screenshot({ path: '/tmp/claude-0/-home-claude/61932e72-9244-569c-b9d8-0f0409210a96/scratchpad/midpan.png' });
    await win.mouse.up({ button: 'middle' });
    for (let i = 0; i < 10; i++) { await win.mouse.wheel(0, k % 2 ? 60 : -60); await win.waitForTimeout(16); }
  }
  const z = times(), dt = (Date.now() - t0) / 1000;
  const res = {};
  for (const k of Object.keys(z)) res[k] = (((z[k] - (a[k] || 0)) / dt) * 100).toFixed(1) + '%';
  console.log('pan/zoom', dt.toFixed(1) + 's', JSON.stringify(res));
  await win.waitForTimeout(400);
  await win.screenshot({ path: '/tmp/claude-0/-home-claude/61932e72-9244-569c-b9d8-0f0409210a96/scratchpad/afterpan.png' });
  await app.close();
})();
