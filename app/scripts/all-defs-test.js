const { _electron: electron } = require('playwright');
const path = require('path');
const S = process.env.SHOTS || '/tmp';
(async () => {
  const app = await electron.launch({ executablePath: require('electron'), args: [path.join(__dirname, '..'), '--no-sandbox'] });
  const win = await app.firstWindow();
  const errs = [];
  win.on('pageerror', (e) => errs.push('PAGEERROR ' + e.stack));
  win.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && errs.push('CONSOLE ' + m.text()));
  await win.waitForTimeout(2500);
  const res = await win.evaluate(async () => {
    const cat = await import('./js/catalog/index.js');
    const st = await import('./js/state.js');
    const evs = [];
    window.tz.engine.onEvent((e) => { if (e.ev === 'blockError') evs.push(e); });
    const defs = cat.allDefs();
    const p = st.newPreset('All');
    let x = 0, y = 0;
    defs.forEach((d, i) => { p.blocks.push({ id: 'd' + i, type: d.id, x: (i % 12) * 700, y: Math.floor(i / 12) * 700, params: {}, bypass: false, variant: cat.defaultVariant(d) }); });
    st.loadPreset(p, null);
    await new Promise((r) => setTimeout(r, 6000));
    // also stereo variants
    for (const b of window.__tz.state.preset.blocks) { const d = cat.getDef(b.type); if (cat.canSwitchVariant(d)) b.variant = b.variant === 'stereo' ? 'mono' : 'stereo'; }
    st.syncGraph();
    await new Promise((r) => setTimeout(r, 5000));
    return { n: defs.length, errors: evs.map((e) => (cat.getDef(window.__tz.state.preset.blocks.find((b) => b.id === e.id)?.type)?.id || e.id) + ': ' + e.error), load: window.__tz.state.status.load };
  });
  console.log('defs', res.n, 'engine load with everything', res.load);
  console.log(res.errors.join('\n') || 'no engine errors');
  console.log(errs.slice(0, 20).join('\n') || 'no renderer errors');
  await app.close();
})();
