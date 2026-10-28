// Helix bindings: a learned CC from the Helix presses another pedal's footswitch / moves a treadle.
const { _electron: electron } = require('playwright');
const path = require('path');
(async () => {
  const app = await electron.launch({ executablePath: require('electron'), args: [path.join(__dirname, '..'), '--no-sandbox'] });
  const win = await app.firstWindow();
  const errs = [];
  win.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
  await win.setViewportSize({ width: 1600, height: 950 }).catch(() => {});
  await win.waitForFunction(() => window.__tz && window.__tz.ready, null, { timeout: 90000 });
  const r = await win.evaluate(async () => {
    const st = await import('./js/state.js');
    const T = window.__tz;
    const hx = st.addBlock('l6x.helix', -2000, 600);
    const ts = T.state.preset.blocks.find((b) => b.type === 'ib.ts9');
    const wah = st.addBlock('dn.gcb95', -2400, 600);
    await new Promise((r) => setTimeout(r, 500));
    const C = await import('./js/catalog/index.js');
    const tsFoot = C.getDef('ib.ts9').controls.find((c) => c.t === 'foot').cid;
    const wahTr = C.getDef('dn.gcb95').controls.find((c) => c.t === 'treadle').cid;
    hx.bindings = [
      { src: 'FS 1', msg: { t: 'cc', n: 80, ch: 0 }, target: { block: ts.id, cid: tsFoot }, mode: 'press' },
      { src: 'EXP 1', msg: { t: 'cc', n: 1, ch: 0 }, target: { block: wah.id, cid: wahTr }, mode: 'press' },
    ];
    const before = ts.bypass;
    window.__hxInject([0xb0, 80, 127]);
    await new Promise((r) => setTimeout(r, 120));
    const after1 = ts.bypass;
    window.__hxInject([0xb0, 80, 0]);
    await new Promise((r) => setTimeout(r, 120));
    const after2 = ts.bypass;
    window.__hxInject([0xb0, 1, 100]);
    await new Promise((r) => setTimeout(r, 50));
    const wahPos = st.uiParams(wah).pos;
    T.editor.select([hx.id]);
    await new Promise((r) => setTimeout(r, 400));
    return { before, after1, after2, wahPos, insp: !!document.querySelector('.hx-bind') };
  });
  console.log(JSON.stringify(r));
  await win.evaluate(() => document.querySelector('.hx-bind').scrollIntoView());
  await win.screenshot({ path: process.argv[2] || '/tmp/hxbind.png' });
  console.log(errs.join('\n') || 'no errors');
  await app.close();
})();
