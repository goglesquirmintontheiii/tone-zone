// 35-pedal board: pan continuously at a zoom level and measure renderer / GPU-process CPU.
// usage: node big-board-perf.js [zoom=0.35] [shot.png]
const { _electron: electron } = require('playwright');
const path = require('path'); const fs = require('fs');
let ROOT = 0;
function inTree(pid){for(let p=+pid,i=0;p>1&&i<20;i++){if(p===ROOT)return true;try{p=+fs.readFileSync(`/proc/${p}/stat`,'utf8').split(') ')[1].split(' ')[1];}catch{return false;}}return false;}
function procTimes(){const out={};for(const pid of fs.readdirSync('/proc').filter(x=>/^\d+$/.test(x))){try{const cmd=fs.readFileSync(`/proc/${pid}/cmdline`,'utf8');if(!/electron|tonezone-engine/.test(cmd))continue;if(!inTree(pid))continue;const st=fs.readFileSync(`/proc/${pid}/stat`,'utf8').split(') ')[1].split(' ');let type=(cmd.match(/--type=([a-z-]+)/)||[,'main'])[1];if(/tonezone-engine/.test(cmd))type='engine';out[type]=(out[type]||0)+(+st[11]+ +st[12])/100;}catch{}}return out;}
(async () => {
  const z = +(process.argv[2] || 0.35);
  const app = await electron.launch({ executablePath: require('electron'), args: [path.join(__dirname, '..'), '--no-sandbox'] });
  ROOT = app.process().pid;
  const win = await app.firstWindow();
  await win.setViewportSize({ width: 1600, height: 950 }).catch(() => {});
  await win.waitForFunction(() => window.__tz && window.__tz.ready, null, { timeout: 120000 });
  await win.waitForTimeout(2500);
  await win.evaluate(async (z) => {
    const st = await import('./js/state.js');
    const C = await import('./js/catalog/index.js');
    st.loadPreset(st.newPreset('big'), null);
    const pick = C.allDefs().filter((d) => d.kind === 'Pedal' || (!d.kind && d.cat !== 'Amp' && d.cat !== 'Cab')).filter((d, i) => i % 23 === 0).slice(0, 35);
    let x = 0, y = 0;
    pick.forEach((d, i) => { st.addBlock(d.id, x, y); x += 260; if (i % 7 === 6) { x = 0; y += 330; } });
    const E = window.__tz.editor;
    E.view = { x: 60, y: 40, z }; E.applyView();
  }, z);
  await win.waitForTimeout(4000);
  const a = procTimes(), t0 = Date.now();
  const frames = await win.evaluate(async () => {
    const E = window.__tz.editor; const end = performance.now() + 8000; let t = 0, n = 0;
    while (performance.now() < end) { t += 0.05; E.view.x += Math.sin(t) * 9; E.view.y += Math.cos(t * 0.7) * 6; E.applyView(true); n++; await new Promise((r) => requestAnimationFrame(r)); }
    return n;
  });
  const b = procTimes(), dt = (Date.now() - t0) / 1000;
  const r = {}; for (const k in b) r[k] = +(((b[k] - (a[k] || 0)) / dt) * 100).toFixed(1);
  console.log('zoom', z, 'fps', (frames / 8).toFixed(0), JSON.stringify(r), 'lod', await win.evaluate(() => [...window.__tz.editor.views.values()].filter((v) => v.lodOn).length));
  if (process.argv[3]) await win.screenshot({ path: process.argv[3] });
  await app.close();
})();
