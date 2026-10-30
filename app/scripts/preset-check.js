// Renders every factory preset offline through a DI phrase and reports loudness / peaks / errors; screenshots a
// few boards. Loudness is BS.1770 style (K-weighted, gated LUFS) over the played part of the DI, so reverb tails
// and silence don't skew it. levels.json (file -> LUFS) feeds the level matching in build-presets.js (--levels).
// usage: node scripts/preset-check.js outdir [--only prefix,prefix] [--shots file1,file2]
const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');
const { makeDI, measure } = require('./loudness');
(async () => {
  const out = process.argv[2] || '/tmp/pc';
  fs.mkdirSync(out, { recursive: true });
  const arg = (k) => (process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1].split(',') : []);
  const shots = arg('--shots');
  const only = arg('--only');
  const di = makeDI(path.join(out, 'di-phrase-v2.wav'));
  const app = await electron.launch({ executablePath: require('electron'), args: [path.join(__dirname, '..', '..', 'app'), '--no-sandbox'] });
  const win = await app.firstWindow();
  const errs = [];
  win.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
  win.on('console', (m) => m.type() === 'error' && errs.push('CONSOLE ' + m.text()));
  await win.setViewportSize({ width: 1600, height: 950 }).catch(() => {});
  await win.waitForFunction(() => window.__tz && window.__tz.ready, null, { timeout: 120000 });
  const dir = path.join(__dirname, '..', 'presets');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json') && (!only.length || only.some((o) => f.startsWith(o)))).sort();
  const lvPath = path.join(out, 'levels.json'), detPath = path.join(out, 'loudness.json');
  // with --only, merge into the previous results
  const levels = only.length && fs.existsSync(lvPath) ? JSON.parse(fs.readFileSync(lvPath, 'utf8')) : {};
  const detail = only.length && fs.existsSync(detPath) ? JSON.parse(fs.readFileSync(detPath, 'utf8')) : {};
  let nErr = 0;
  for (const f of files) {
    const p = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    const r = await win.evaluate(async ([p, di]) => {
      try {
        const g = window.__tz.buildGraph(p);
        const wav = await window.tz.offline.render(g, di);
        return { wav, nodes: g.nodes.length };
      } catch (e) {
        return { error: String(e.message || e) };
      }
    }, [p, di]);
    let m = null;
    if (r.wav) {
      try { m = measure(r.wav); } catch (e) { r.error = 'measure ' + e.message; }
      fs.rmSync(r.wav, { force: true });
    }
    const flag = r.error ? 'ERROR ' + r.error : !m ? 'SILENT' : m.peak > -0.05 ? 'CLIP' : m.tp > -1 ? 'HOT' : m.lufs < -40 ? 'QUIET' : '';
    if (r.error || !m) nErr++;
    const key = f.replace(/\.json$/, '');
    if (m) { levels[key] = m.lufs; detail[key] = m; }
    console.log(f.padEnd(44), m ? `${m.lufs.toFixed(2).padStart(7)} LUFS  st ${m.stMax.toFixed(1).padStart(6)}  tail ${String(m.tail ?? '-').padStart(6)}  tp ${m.tp.toFixed(1).padStart(5)} dBFS  ${r.nodes} nodes` : '', flag);
  }
  fs.writeFileSync(lvPath, JSON.stringify(levels, null, 1));
  fs.writeFileSync(detPath, JSON.stringify(detail, null, 1));
  const v = Object.values(levels).sort((a, b) => a - b);
  if (v.length) {
    const med = v[Math.floor(v.length / 2)];
    console.log(`loudness: min ${v[0]} max ${v[v.length - 1]} spread ${(v[v.length - 1] - v[0]).toFixed(2)} LU, median ${med}`);
    console.log(`max true peak ${Math.max(...Object.values(detail).map((d) => d.tp))} dBFS, errors ${nErr}`);
  }
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
