// Plugin QA tool: renders every block of a plugin (gallery + one close-up per block), loads them all into the
// realtime engine (fake JACK) to catch engine errors, and runs each block offline on a guitar riff to flag
// silent / clipping / way-too-loud voicings.
//
// usage (from app/):
//   NODE_PATH=$(npm root -g) LD_LIBRARY_PATH=../engine/tests/fakejack xvfb-run -a -s "-screen 0 1600x950x24" \
//     node scripts/plugin-check.js <pluginId|core|all> <outDir> [--no-shots] [--only id1,id2]
const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');

const [pluginId, outDir = '/tmp/plugin-check'] = process.argv.slice(2);
const noShots = process.argv.includes('--no-shots');
const onlyArg = process.argv.indexOf('--only');
const only = onlyArg > 0 ? process.argv[onlyArg + 1].split(',') : null;
const ROOT = path.join(__dirname, '..');
const ENGINE = (() => {
  const c = [path.join(ROOT, '../engine/build/tonezone-engine'), path.join(ROOT, '../engine/dist/tonezone-engine-v2')];
  return c.find((p) => fs.existsSync(p));
})();
fs.mkdirSync(outDir, { recursive: true });

function readWav(p) {
  const b = fs.readFileSync(p);
  let pos = 12, fmt = 1, ch = 1, bits = 16, data = null;
  while (pos + 8 < b.length) {
    const id = b.toString('ascii', pos, pos + 4), len = b.readUInt32LE(pos + 4);
    if (id === 'fmt ') { fmt = b.readUInt16LE(pos + 8); ch = b.readUInt16LE(pos + 10); bits = b.readUInt16LE(pos + 22); }
    if (id === 'data') { data = b.subarray(pos + 8, pos + 8 + len); break; }
    pos += 8 + len + (len & 1);
  }
  const n = data.length / (bits / 8) / ch;
  const out = [];
  for (let c = 0; c < ch; c++) out.push(new Float32Array(n));
  for (let i = 0; i < n; i++)
    for (let c = 0; c < ch; c++) {
      const o = (i * ch + c) * (bits / 8);
      out[c][i] = fmt === 3 ? data.readFloatLE(o) : data.readInt16LE(o) / 32768;
    }
  return out;
}
function makeRiff(p) {
  // decaying plucked notes + a chord (Karplus-Strong), mono float wav @ 48 kHz
  const sr = 48000, notes = [82.41, 110, 146.83, 196, 246.94, 329.63];
  const parts = [];
  let seed = 1;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
  const ks = (f, dur, amp) => {
    const n = Math.floor(dur * sr), N = Math.floor(sr / f);
    const buf = new Float32Array(N).map(() => rnd() * amp);
    const out = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const j = i % N;
      out[i] = buf[j];
      buf[j] = 0.5 * (buf[j] + buf[(j + 1) % N]) * 0.996;
    }
    return out;
  };
  for (const f of notes) parts.push(ks(f, 0.8, 0.3));
  const chord = new Float32Array(sr * 2);
  for (const f of notes) { const k = ks(f, 2, 0.12); for (let i = 0; i < k.length; i++) chord[i] += k[i]; }
  parts.push(chord);
  const total = parts.reduce((a, x) => a + x.length, 0);
  const all = new Float32Array(total);
  let o = 0;
  for (const x of parts) { all.set(x, o); o += x.length; }
  const hdr = Buffer.alloc(44);
  hdr.write('RIFF', 0); hdr.writeUInt32LE(36 + total * 4, 4); hdr.write('WAVE', 8); hdr.write('fmt ', 12);
  hdr.writeUInt32LE(16, 16); hdr.writeUInt16LE(3, 20); hdr.writeUInt16LE(1, 22); hdr.writeUInt32LE(sr, 24); hdr.writeUInt32LE(sr * 4, 28); hdr.writeUInt16LE(4, 32); hdr.writeUInt16LE(32, 34);
  hdr.write('data', 36); hdr.writeUInt32LE(total * 4, 40);
  fs.writeFileSync(p, Buffer.concat([hdr, Buffer.from(all.buffer)]));
}
const rms = (a) => Math.sqrt(a.reduce((s, v) => s + v * v, 0) / a.length);
const peak = (a) => a.reduce((m, v) => Math.max(m, Math.abs(v)), 0);

(async () => {
  const riff = path.join(outDir, 'riff.wav');
  if (!fs.existsSync(riff)) makeRiff(riff);
  const app = await electron.launch({ executablePath: require('electron'), args: [ROOT, '--no-sandbox'] });
  const win = await app.firstWindow();
  const errs = [];
  win.on('pageerror', (e) => errs.push('PAGEERROR ' + e.stack));
  win.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && errs.push('CONSOLE ' + m.text()));
  await win.setViewportSize({ width: 1600, height: 950 }).catch(() => {});
  await win.waitForTimeout(3000);
  const info = await win.evaluate(async ({ pluginId, only }) => {
    const cat = await import('./js/catalog/index.js');
    const pl = await import('./js/plugins.js');
    const rec = pl.pluginInfo().get(pluginId);
    let ids;
    if (pluginId === 'all') ids = cat.allDefs().map((d) => d.id);
    else if (pluginId === 'core') ids = cat.allDefs().filter((d) => !d.plugin && !d.pack).map((d) => d.id);
    else ids = cat.pluginDefIds(pluginId);
    if (only) ids = ids.filter((i) => only.includes(i));
    return { ids, error: rec ? rec.error : pluginId === 'all' || pluginId === 'core' ? null : 'plugin not found', defs: ids.map((i) => { const d = cat.getDef(i); return { id: i, name: d.name, cat: d.cat, form: d.form, algo: d.algo, stereo: d.stereo }; }) };
  }, { pluginId, only });
  if (info.error) console.log('PLUGIN ERROR:', info.error);
  console.log(`${info.ids.length} blocks`);
  // ---- 1. render: gallery + close-ups
  if (!noShots && info.ids.length) {
    for (let start = 0; start < info.ids.length; start += 12) {
      const chunk = info.ids.slice(start, start + 12);
      await win.evaluate(async (types) => {
        const st = await import('./js/state.js');
        const T = window.__tz;
        const p = st.newPreset('check');
        types.forEach((t, i) => p.blocks.push({ id: 'g' + i, type: t, x: 0, y: 0, params: {}, bypass: false }));
        st.loadPreset(p, null);
        let x = 0, y = 0, rowH = 0, c = 0;
        for (const b of T.state.preset.blocks) {
          const v = T.editor.views.get(b.id);
          if (b.id.startsWith('__')) { v.g.style.display = 'none'; continue; }
          v.setPosition(x, y); x += v.w + 70; rowH = Math.max(rowH, v.h);
          if (++c % 4 === 0) { x = 0; y += rowH + 80; rowH = 0; }
        }
        const bl = T.state.preset.blocks.filter((b) => !b.id.startsWith('__'));
        let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
        for (const b of bl) { const v = T.editor.views.get(b.id); x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); x1 = Math.max(x1, b.x + v.w); y1 = Math.max(y1, b.y + v.h); }
        document.getElementById('browser').style.display = 'none';
        document.getElementById('inspector').style.display = 'none';
        const r = T.editor.svg.getBoundingClientRect();
        const z = Math.min((r.width - 60) / (x1 - x0 + 40), (r.height - 60) / (y1 - y0 + 40));
        T.editor.view = { z, x: (r.width - (x1 - x0) * z) / 2 - x0 * z, y: 30 - y0 * z };
        T.editor.applyView();
      }, chunk);
      await win.waitForTimeout(700);
      await (await win.$('#board')).screenshot({ path: path.join(outDir, `gallery-${String(start / 12 + 1).padStart(2, '0')}.png`) });
    }
    for (const id of info.ids) {
      await win.evaluate(async (t) => {
        const st = await import('./js/state.js');
        const T = window.__tz;
        const p = st.newPreset('one');
        p.blocks.push({ id: 'one', type: t, x: 0, y: 0, params: {}, bypass: false });
        st.loadPreset(p, null);
        for (const b of T.state.preset.blocks) if (b.id.startsWith('__')) T.editor.views.get(b.id).g.style.display = 'none';
        const v = T.editor.views.get('one');
        const r = T.editor.svg.getBoundingClientRect();
        const z = Math.min(3, (r.width - 120) / (v.w + 60), (r.height - 120) / (v.h + 60));
        T.editor.view = { z, x: r.width / 2 - (v.w / 2) * z, y: r.height / 2 - (v.h / 2) * z };
        T.editor.applyView();
      }, id);
      await win.waitForTimeout(150);
      await (await win.$('#board')).screenshot({ path: path.join(outDir, `block-${id.replace(/[^\w.-]/g, '_')}.png`) });
    }
  }
  // ---- 2. realtime engine: all blocks at once (mono + stereo variants), catch blockError
  const live = await win.evaluate(async (ids) => {
    const cat = await import('./js/catalog/index.js');
    const st = await import('./js/state.js');
    const evs = [];
    window.tz.engine.onEvent((e) => { if (e.ev === 'blockError' || e.ev === 'error') evs.push(e); });
    const p = st.newPreset('All');
    ids.forEach((id, i) => p.blocks.push({ id: 'd' + i, type: id, x: (i % 10) * 700, y: Math.floor(i / 10) * 700, params: {}, bypass: false, variant: cat.defaultVariant(cat.getDef(id)) }));
    st.loadPreset(p, null);
    await new Promise((r) => setTimeout(r, 3500));
    for (const b of window.__tz.state.preset.blocks) { const d = cat.getDef(b.type); if (d && cat.canSwitchVariant(d)) b.variant = b.variant === 'stereo' ? 'mono' : 'stereo'; }
    st.syncGraph();
    await new Promise((r) => setTimeout(r, 3500));
    return evs.map((e) => (window.__tz.state.preset.blocks.find((b) => b.id === e.id)?.type || e.id) + ': ' + (e.error || e.message));
  }, info.ids);
  // ---- 3. offline audio: each block alone (in -> block -> out), riff in, levels out
  const graphs = await win.evaluate(async (ids) => {
    const cat = await import('./js/catalog/index.js');
    const st = await import('./js/state.js');
    const out = {};
    for (const id of ids) {
      const d = cat.getDef(id);
      if (!d || !d.algo) continue;
      const p = st.newPreset('one');
      p.blocks.push({ id: 'b', type: id, x: 0, y: 0, params: {}, bypass: false, variant: cat.defaultVariant(d) });
      p.cables = [{ id: 'c1', from: { node: '__in', port: 0 }, to: { node: 'b', port: 0 } }, { id: 'c2', from: { node: 'b', port: 0 }, to: { node: '__out', port: 0 } }];
      st.loadPreset(p, null);
      const ports = st.nodePorts(window.__tz.state.preset.blocks.find((b) => b.id === 'b'));
      if (!ports.ins.length || !ports.outs.length) continue;
      out[id] = st.buildGraph();
    }
    return out;
  }, info.ids);
  await app.close();
  const x = readWav(riff)[0];
  const inR = rms(x);
  const report = [];
  for (const [id, g] of Object.entries(graphs)) {
    const gp = path.join(outDir, 'g.json'), op = path.join(outDir, 'o.wav');
    fs.writeFileSync(gp, JSON.stringify({ settings: { quality: 1 }, graph: g }));
    let warn = '';
    try {
      const so = execFileSync(ENGINE, ['--offline', gp, riff, op], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
      void so;
      const y = readWav(op)[0];
      const r = rms(y), pk = peak(y);
      const db = 20 * Math.log10(Math.max(1e-9, r) / inR);
      if (!isFinite(db) || r < 1e-5) warn = 'SILENT';
      else if (db > 14) warn = 'TOO LOUD';
      else if (db < -18) warn = 'very quiet';
      if (pk > 1.2) warn += ' CLIPS';
      report.push(`${id.padEnd(30)} ${db.toFixed(1).padStart(6)} dB  peak ${pk.toFixed(2)}  ${warn}`);
    } catch (e) {
      report.push(`${id.padEnd(30)} ENGINE FAILED: ${String(e.stderr || e.message).slice(0, 200)}`);
    }
  }
  console.log('--- offline levels (output RMS relative to the dry riff; default knob settings) ---');
  console.log(report.join('\n'));
  console.log('--- realtime engine errors ---');
  console.log(live.join('\n') || 'none');
  console.log('--- renderer errors ---');
  console.log(errs.filter((e) => !/Autofill|DevTools/.test(e)).slice(0, 30).join('\n') || 'none');
  fs.writeFileSync(path.join(outDir, 'report.txt'), report.join('\n') + '\n\nengine:\n' + live.join('\n') + '\n\nrenderer:\n' + errs.join('\n'));
})();
