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
  const g = await win.evaluate(async () => {
    const st = await import('./js/state.js');
    st.loadPreset(st.newPreset('nx'), null);
    const b = st.addBlock('custom.template.nautica', 0, 0);
    st.connect({ node: '__in', port: 0 }, { node: b.id, port: 0 });
    st.connect({ node: b.id, port: 0 }, { node: '__out', port: 0 });
    window.__nxb = b.id;
    const T = window.__tz, v = T.editor.views.get(b.id), r = T.editor.svg.getBoundingClientRect(), vis = document.getElementById('board').getBoundingClientRect();
    const z = Math.min((vis.width - 40) / v.w, (vis.height - 80) / v.h);
    T.editor.view = { z, x: (vis.left + vis.right) / 2 - r.left - (v.w / 2) * z, y: (vis.top + vis.bottom) / 2 - r.top - (v.h / 2) * z };
    T.editor.applyView();
    return window.__tz.buildGraph(window.__tz.state.preset);
  });
  fs.writeFileSync(S + '/g.json', JSON.stringify(g));
  await win.waitForTimeout(2500);
  const at = (x, y) => win.evaluate(([x, y]) => {
    const T = window.__tz, v = T.editor.views.get(window.__nxb), b = v.block, z = T.editor.view.z, r = T.editor.svg.getBoundingClientRect();
    const e = [...v.views.values()].find((q) => q.ctl.t === 'screen' && q.ctl.label === 'MAIN');
    const c = e.ctl, W = c.src.w * c.src.res, H = c.src.h * c.src.res;
    return [r.left + T.editor.view.x + (b.x + c.x - c.w / 2 + (x / W) * c.w) * z, r.top + T.editor.view.y + (b.y + c.y - c.h / 2 + (y / H) * c.h) * z];
  }, [x, y]);
  console.log(JSON.stringify(await win.evaluate(() => {
    const T = window.__tz, v = T.editor.views.get(window.__nxb), b = v.block, z = T.editor.view.z, r = T.editor.svg.getBoundingClientRect();
    const e = [...v.views.values()].find((q) => q.ctl.t === 'screen' && q.ctl.label === 'MAIN');
    const img = e.view.g.querySelector('image').getBoundingClientRect();
    const c = e.ctl;
    return { img: [img.left, img.top, img.width, img.height], f: [r.left + T.editor.view.x + (b.x + c.x - c.w / 2) * z, r.top + T.editor.view.y + (b.y + c.y - c.h / 2) * z, c.w * z, c.h * z], rot: v.rot, c: [c.x, c.y, c.w, c.h], fw: [v.fw, v.fh, v.w, v.h] };
  })));
  let p = await at(42 + 2 * 61 + 27, 68);
  await win.mouse.click(p[0], p[1]); await win.waitForTimeout(600);
  await (await win.$('#board')).screenshot({ path: S + '/dbg1.png' });
  p = await at(240, 159); console.log(p); await win.mouse.click(p[0], p[1]); await win.waitForTimeout(600);
  await (await win.$('#board')).screenshot({ path: S + '/dbg2.png' });
  await app.close();
})();
