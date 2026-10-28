// Dumps every block definition (id, name, ref, brand, cat, kind, plugin, params) to JSON – used to write presets
// and to count the catalog. usage: node scripts/dump-catalog.js out.json
const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');
(async () => {
  const app = await electron.launch({ executablePath: require('electron'), args: [path.join(__dirname, '..'), '--no-sandbox'] });
  const win = await app.firstWindow();
  await win.waitForFunction(() => window.__tz && window.__tz.ready, null, { timeout: 90000 });
  const res = await win.evaluate(async () => {
    const C = await import('./js/catalog/index.js');
    const P = await import('./js/plugins.js');
    const owner = {};
    for (const [id, rec] of P.pluginInfo()) for (const d of C.pluginDefIds(id)) owner[d] = id;
    const errors = [...P.pluginInfo()].filter(([, r]) => r.error).map(([id, r]) => id + ': ' + r.error);
    return {
      errors,
      defs: C.allDefs().map((d) => ({
        id: d.id, name: d.name, ref: d.ref || '', brand: C.brandOf(d) || '', cat: d.cat, kind: C.kindOf(d), original: C.isOriginal(d), plugin: owner[d.id] || 'core', stereo: d.stereo || 'mono', algo: d.algo, form: d.form,
        ins: (C.portsFor(d, 'mono').ins || []).length, outs: (C.portsFor(d, 'mono').outs || []).length,
        params: d.controls.filter((c) => c.p).map((c) => c.p + (c.t === 'sel' || c.t === 'toggle' ? `[${(c.options || []).length}]` : '')),
      })),
    };
  });
  fs.writeFileSync(process.argv[2] || 'catalog.json', JSON.stringify(res, null, 1));
  console.log('defs', res.defs.length, 'plugin errors', res.errors.length, res.errors.join('\n'));
  await app.close();
})();
