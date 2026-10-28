// Finds overlapping text on block enclosures: draws every block off-screen and intersects the bounding boxes of
// all its <text> elements. usage: node scripts/text-overlap.js out.json [--only id1,id2] [--plugin id]
const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');
(async () => {
  const out = process.argv[2] || 'overlaps.json';
  const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1].split(',') : null;
  const plugin = process.argv.includes('--plugin') ? process.argv[process.argv.indexOf('--plugin') + 1] : null;
  const app = await electron.launch({ executablePath: require('electron'), args: [path.join(__dirname, '..'), '--no-sandbox'] });
  const win = await app.firstWindow();
  await win.waitForFunction(() => window.__tz && window.__tz.ready, null, { timeout: 120000 });
  const res = await win.evaluate(async ({ only, plugin }) => {
    const C = await import('./js/catalog/index.js');
    const { renderForm } = await import('./js/gfx/forms.js');
    const NS = 'http://www.w3.org/2000/svg';
    const host = document.createElementNS(NS, 'svg');
    host.setAttribute('width', '2000');
    host.setAttribute('height', '2000');
    host.style.cssText = 'position:fixed;left:-3000px;top:0;';
    document.body.appendChild(host);
    const found = [];
    const defs = C.allDefs().filter((d) => !d.hidden && (!only || only.includes(d.id)) && (!plugin || d.plugin === plugin || (plugin === 'core' && !d.plugin)));
    for (const d of defs) {
      host.innerHTML = '';
      const g = document.createElementNS(NS, 'g');
      g.setAttribute('transform', 'translate(40,40)');
      host.appendChild(g);
      const rdef = Object.create(d);
      rdef.ports = C.portsFor(d, C.defaultVariant(d));
      try {
        renderForm({ g, views: new Map(), flip: false, thumb: false }, rdef);
      } catch (e) {
        found.push({ id: d.id, error: String(e.message || e) });
        continue;
      }
      const texts = [...g.querySelectorAll('text')].filter((t) => t.textContent.trim() && getComputedStyle(t).display !== 'none' && t.getAttribute('opacity') !== '0' && t.getAttribute('fill-opacity') !== '0');
      const boxes = texts.map((t) => {
        const r = t.getBoundingClientRect();
        return { t: t.textContent.trim().slice(0, 24), x0: r.left, y0: r.top, x1: r.right, y1: r.bottom };
      });
      const hits = [];
      for (let i = 0; i < boxes.length; i++)
        for (let j = i + 1; j < boxes.length; j++) {
          const a = boxes[i], b = boxes[j];
          const w = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0), h = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
          if (w <= 0 || h <= 0) continue;
          if (a.t === b.t) continue; // embossed / shadowed copies of the same text
          const area = w * h, small = Math.min((a.x1 - a.x0) * (a.y1 - a.y0), (b.x1 - b.x0) * (b.y1 - b.y0));
          // glyph boxes include ascender / descender space: ignore slivers
          if (small > 0 && area / small > 0.18 && h > 2) hits.push([a.t, b.t, +(area / small).toFixed(2)]);
        }
      if (hits.length) found.push({ id: d.id, plugin: d.plugin || 'core', hits });
    }
    host.remove();
    return { n: defs.length, found };
  }, { only, plugin });
  fs.writeFileSync(out, JSON.stringify(res, null, 1));
  const byPlugin = {};
  for (const f of res.found) byPlugin[f.plugin || 'err'] = (byPlugin[f.plugin || 'err'] || 0) + 1;
  console.log(`checked ${res.n} blocks, ${res.found.length} with overlapping text`);
  console.log(JSON.stringify(byPlugin));
  await app.close();
})();
