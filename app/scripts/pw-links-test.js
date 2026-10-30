// PipeWire links are remembered: changes made in the patchbay come back after an engine restart and an app restart.
const { _electron: electron } = require('playwright');
const path = require('path');
const errs = [];
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) errs.push(m); };
const launch = async () => {
  const app = await electron.launch({ executablePath: require('electron'), args: [path.join(__dirname, '..'), '--no-sandbox'] });
  const win = await app.firstWindow();
  win.on('pageerror', (e) => errs.push(e.message));
  await win.waitForFunction(() => window.__tz && window.__tz.ready, null, { timeout: 120000 });
  return { app, win };
};
// the links of our ports, as "src > dst", from a fresh ports listing
const links = (win) =>
  win.evaluate(() => new Promise((res) => {
    import('./js/util.js').then(({ bus }) => {
      const f = (ev) => {
        bus.off && bus.off('ports', f);
        const s = new Set();
        for (const p of ev.sources) for (const c of p.connections || []) s.add(p.name + ' > ' + c);
        for (const p of ev.sinks) for (const c of p.connections || []) s.add(c + ' > ' + p.name);
        res([...s].filter((l) => l.includes('Tone Zone:')).sort());
      };
      bus.on('ports', f);
      window.tz.engine.send({ cmd: 'ports' });
    });
  }));
(async () => {
  let { app, win } = await launch();
  // start clean: forget whatever an earlier run left, then auto-connect the defaults
  await win.evaluate(async () => { const { state } = await import('./js/state.js'); state.settings.pwLinks = []; await window.tz.settings.set({ pwLinks: [] }); window.tz.engine.send({ cmd: 'autoConnect' }); });
  await win.waitForTimeout(1500);
  const base = await links(win);
  console.log('defaults', JSON.stringify(base));
  ok(base.length >= 2, 'auto-connect made links');
  // patch: drop one default, add a new one
  const [s0, d0] = base.find((l) => l.startsWith('Tone Zone:')).split(' > ');
  await win.evaluate(([s, d]) => {
    window.tz.engine.send({ cmd: 'connect', src: s, dst: d, on: false });
    window.tz.engine.send({ cmd: 'connect', src: 'system:capture_1', dst: 'Tone Zone:in_2', on: true });
  }, [s0, d0]);
  await win.waitForTimeout(1500);
  const want = await links(win);
  console.log('patched', JSON.stringify(want));
  ok(!want.includes(s0 + ' > ' + d0), 'removed link is gone');
  const saved = await win.evaluate(async () => (await import('./js/state.js')).state.settings.pwLinks);
  ok(saved.length === want.length && saved.every((l) => l[0].startsWith('@self:') || l[1].startsWith('@self:')), 'links are saved: ' + JSON.stringify(saved));
  // the engine restarts with no links at all (fake JACK starts empty), they must come back
  await win.evaluate(() => window.tz.engine.restart());
  await win.waitForTimeout(6000);
  const again = await links(win);
  ok(JSON.stringify(again) === JSON.stringify(want), 'after an engine restart: ' + JSON.stringify(again));
  await app.close();
  ({ app, win } = await launch());
  await win.waitForTimeout(4000);
  const relaunch = await links(win);
  ok(JSON.stringify(relaunch) === JSON.stringify(want), 'after an app restart: ' + JSON.stringify(relaunch));
  // leave nothing behind for other tests
  await win.evaluate(async () => { const { state } = await import('./js/state.js'); state.settings.pwLinks = []; await window.tz.settings.set({ pwLinks: [] }); });
  await app.close();
  console.log(errs.length ? errs.join('\n') : 'no errors');
  process.exit(errs.length ? 1 : 0);
})();
