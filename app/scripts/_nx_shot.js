const { _electron: electron } = require('playwright');
(async () => {
  const out = process.argv[2];
  const app = await electron.launch({ executablePath: require('electron'), args: ['/home/claude/tone-zone/app', '--no-sandbox'] });
  const win = await app.firstWindow();
  await win.setViewportSize({ width: 1600, height: 950 }).catch(() => {});
  await win.waitForFunction(() => window.__tz && window.__tz.ready, null, { timeout: 120000 });
  await win.evaluate(async () => { const st = await import('./js/state.js'); st.loadPreset(st.newPreset('n'), null); window.__nx = st.addBlock('tz.nautica', 0, 0).id; });
  const shots = [[2.2, 0.86, 0.15, 'logo'], [2.2, 0.15, 0.05, 'rail-left'], [2.2, 0.75, 0.05, 'rail-right'], [2.0, 0.1, 0.4, 'leftpanel'], [2.0, 0.88, 0.32, 'expsw']];
  for (const [z, cx, cy, name] of shots) {
    await win.evaluate(([z, cx, cy]) => {
      const T = window.__tz, v = T.editor.views.get(window.__nx), r = T.editor.svg.getBoundingClientRect();
      const vis = document.getElementById('board').getBoundingClientRect();
      T.editor.view = { z, x: (vis.left + vis.right) / 2 - r.left - v.w * cx * z, y: (vis.top + vis.bottom) / 2 - r.top - v.h * cy * z }; T.editor.applyView();
    }, [z, cx, cy]);
    await win.waitForTimeout(900);
    await (await win.$('#board')).screenshot({ path: out + '/' + name + '.png' });
  }
  await app.close();
})();
