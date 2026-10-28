// Render one or more blocks alone on a fresh board and screenshot them zoomed in.
// usage: node block-shot.js out.png type1[,type2...] [zoom] [extraEval]
const { _electron: electron } = require('playwright');
const path = require('path');
(async () => {
  const [out, types, zoom = '2', extra = ''] = process.argv.slice(2);
  const app = await electron.launch({ executablePath: require('electron'), args: [path.join(__dirname, '..'), '--no-sandbox'] });
  const win = await app.firstWindow();
  const logs = [];
  win.on('pageerror', (e) => logs.push('PAGEERROR: ' + e.stack));
  win.on('console', (m) => m.type() === 'error' && logs.push('ERR: ' + m.text()));
  await win.setViewportSize({ width: 1600, height: 950 }).catch(() => {});
  await win.waitForFunction(() => window.__tz && window.__tz.ready, null, { timeout: 60000 }).catch(() => {});
  await win.waitForTimeout(600);
  await win.evaluate(async ({ types, zoom }) => {
    const T = window.__tz;
    const st = await import('./js/state.js');
    st.loadPreset(st.newPreset('shot'), null);
    let x = 0;
    const ids = [];
    for (const t of types.split(',')) {
      const b = st.addBlock(t, x, 0);
      if (!b) { console.error('no def ' + t); continue; }
      st.setBypass(b.id, false);
      const v = T.editor.views.get(b.id);
      x += v.w + 60;
      ids.push(b.id);
    }
    // connect a chain in -> blocks -> out so the engine runs them
    let prev = { node: '__in', port: 0 };
    for (const id of ids) { st.connect(prev, { node: id, port: 0 }); prev = { node: id, port: 0 }; }
    st.connect(prev, { node: '__out', port: 0 });
    T.state.selection.clear();
    const bl = T.state.preset.blocks.filter((b) => ids.includes(b.id));
    const minX = Math.min(...bl.map((b) => b.x)), maxX = Math.max(...bl.map((b) => b.x + T.editor.views.get(b.id).w));
    const minY = Math.min(...bl.map((b) => b.y)), maxY = Math.max(...bl.map((b) => b.y + T.editor.views.get(b.id).h));
    const r = T.editor.svg.getBoundingClientRect();
    const z = Math.min(+zoom, (r.width - 80) / (maxX - minX), (r.height - 80) / (maxY - minY));
    T.editor.view.z = z;
    T.editor.view.x = r.width / 2 - ((minX + maxX) / 2) * z;
    T.editor.view.y = r.height / 2 - ((minY + maxY) / 2) * z;
    T.editor.applyView();
    window.__shotIds = ids;
  }, { types, zoom });
  if (extra) await win.evaluate(extra).catch((e) => logs.push('EVAL ' + e));
  await win.waitForTimeout(1800);
  const box = await win.$('#board');
  await box.screenshot({ path: out });
  console.log(logs.join('\n'));
  await app.close();
})();
