// Renders every factory preset offline through the DI clip and reports level / errors; screenshots a few boards.
// usage: node scripts/preset-check.js outdir [--shots file1,file2]
const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');
(async () => {
  const out = process.argv[2] || '/tmp/pc';
  fs.mkdirSync(out, { recursive: true });
  const shots = process.argv.includes('--shots') ? process.argv[process.argv.indexOf('--shots') + 1].split(',') : [];
  const app = await electron.launch({ executablePath: require('electron'), args: [path.join(__dirname, '..', '..', 'app'), '--no-sandbox'] });
  const win = await app.firstWindow();
  const errs = [];
  win.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
  win.on('console', (m) => m.type() === 'error' && errs.push('CONSOLE ' + m.text()));
  await win.setViewportSize({ width: 1600, height: 950 }).catch(() => {});
  await win.waitForFunction(() => window.__tz && window.__tz.ready, null, { timeout: 120000 });
  const dir = path.join(__dirname, '..', 'presets');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
  const levels = {};
  for (const f of files) {
    const p = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    const r = await win.evaluate(async (p) => {
      try {
        const g = window.__tz.buildGraph(p);
        const wav = await window.tz.tm.preview(g, null);
        const ft = await window.tz.tm.features([wav], 0, Infinity);
        return { level: ft ? ft.level : null, nodes: g.nodes.length, crest: ft && ft.crest };
      } catch (e) {
        return { error: String(e.message || e) };
      }
    }, p);
    const flag = r.error ? 'ERROR ' + r.error : r.level === null ? 'SILENT' : r.level > -6 ? 'LOUD' : r.level < -40 ? 'QUIET' : '';
    if (!r.error && r.level !== null) levels[f.replace(/\.json$/, '')] = r.level;
    console.log(f.padEnd(44), r.error ? '' : `${String(r.level).padStart(7)} dB  ${r.nodes} nodes`, flag);
  }
  fs.writeFileSync(path.join(out, 'levels.json'), JSON.stringify(levels, null, 1));
  for (const f of shots) {
    await win.evaluate(async (f) => {
      const p = await window.tz.presets.load(f + '.json').catch(() => null);
      if (p) window.__tz.loadPreset(p, f + '.json');
    }, f);
    await win.waitForTimeout(1500);
    await win.evaluate(() => window.__tz.editor.fit());
    await win.waitForTimeout(800);
    await win.screenshot({ path: path.join(out, f + '.png') });
  }
  console.log(errs.slice(0, 20).join('\n'));
  await app.close();
})();
