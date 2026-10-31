const { _electron: electron } = require('playwright');
const fs = require('fs'), os = require('os'), path = require('path');
(async () => {
  const S = process.argv[2];
  const xdg = fs.mkdtempSync(path.join(os.tmpdir(), 'nxd-'));
  const app = await electron.launch({ executablePath: require('electron'), args: ['/home/claude/tone-zone/app', '--no-sandbox'], env: { ...process.env, XDG_DATA_HOME: xdg } });
  const win = await app.firstWindow();
  win.on('console', (m) => m.type() === 'error' && console.log('ERR', m.text()));
  await win.setViewportSize({ width: 1600, height: 950 }).catch(() => {});
  await win.waitForFunction(() => window.__tz && window.__tz.ready, null, { timeout: 120000 });
  await win.evaluate(async () => {
    const st = await import('./js/state.js');
    st.loadPreset(st.newPreset('nx'), null);
    const b = st.addBlock('custom.template.nautica', 0, 0);
    st.connect({ node: '__in', port: 0 }, { node: b.id, port: 0 });
    st.connect({ node: b.id, port: 0 }, { node: '__out', port: 0 });
    window.__nxb = b.id;
    document.getElementById('layerCables').style.display = 'none';
  });
  for (const [z, cx, cy, name] of [[2.6, 0.12, 0.35, 'zl'], [2.6, 0.25, 0.04, 'zr1'], [2.6, 0.85, 0.3, 'zrt'], [2.6, 0.2, 0.75, 'zf']]) {
    await win.evaluate(([z, cx, cy]) => {
      const T = window.__tz, v = T.editor.views.get(window.__nxb), b = v.block, r = T.editor.svg.getBoundingClientRect(), vis = document.getElementById('board').getBoundingClientRect();
      T.editor.view = { z, x: (vis.left + vis.right) / 2 - r.left - (b.x + v.w * cx) * z, y: (vis.top + vis.bottom) / 2 - r.top - (b.y + v.h * cy) * z };
      T.editor.applyView();
    }, [z, cx, cy]);
    await win.waitForTimeout(2500);
    await (await win.$('#board')).screenshot({ path: S + '/' + name + '.png' });
  }
  await app.close();
})();
