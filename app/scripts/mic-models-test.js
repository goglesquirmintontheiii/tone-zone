// Studio Mics plugin check: every plugin mic loads, shows up in the block list, has valid mic data (the mic model
// contract in docs/mic-blocks.md), draws without errors (thumbnail, free-standing block, on-cab view) and, once
// the cab mic system is there, sounds different from the others when it is put on a cab.
// usage: node scripts/mic-models-test.js [shotDir]
const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
// the newest engine binary (a dev build or the dist one)
const ENGINE = [path.join(ROOT, '../engine/build/tonezone-engine'), path.join(ROOT, '../engine/dist/tonezone-engine-v2')].filter((p) => fs.existsSync(p)).sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0];
(async () => {
  const shotDir = process.argv[2] || '';
  const app = await electron.launch({ executablePath: require('electron'), args: [path.join(__dirname, '..'), '--no-sandbox'] });
  const win = await app.firstWindow();
  const logs = [];
  win.on('pageerror', (e) => logs.push('PAGEERROR: ' + e.stack));
  win.on('console', (m) => m.type() === 'error' && logs.push('ERR: ' + m.text() + ' ' + JSON.stringify(m.location())));
  await win.setViewportSize({ width: 1600, height: 950 }).catch(() => {});
  await win.waitForFunction(() => window.__tz && window.__tz.ready, null, { timeout: 60000 }).catch(() => {});
  await win.waitForTimeout(800);
  const fails = [];
  const fail = (m) => { fails.push(m); console.log('FAIL', m); };

  // ---- 1. plugin, defs and contract data
  const info = await win.evaluate(async () => {
    const pl = await import('./js/plugins.js');
    const cat = await import('./js/catalog/index.js');
    const rec = pl.pluginInfo().get('mics');
    const defs = cat.allDefs().filter((d) => d.plugin === 'mics');
    // a core SM57 inspired model to compare against, if the core has one
    const core = cat.allDefs().find((d) => d.mic && d.plugin !== 'mics' && /SM ?57/i.test(d.ref || '') && !/beta/i.test(d.ref || ''));
    return {
      loaded: !!rec, error: rec && rec.error, count: rec && rec.count,
      core57: core ? core.mic.resp : null, core57id: core ? core.id : null,
      defs: defs.map((d) => ({ id: d.id, name: d.name, ref: d.ref, brand: d.brand, cat: d.cat, desc: d.desc, original: cat.isOriginal(d), mic: JSON.parse(JSON.stringify(d.mic)), kind: d.mic.look && d.mic.look.kind, form: d.form })),
    };
  });
  if (!info.loaded || info.error) fail('plugin not loaded: ' + info.error);
  const defs = info.defs;
  const inspired = defs.filter((d) => !d.original), originals = defs.filter((d) => d.original);
  console.log(`mics: ${defs.length} (${inspired.length} inspired by, ${originals.length} originals)`);
  if (inspired.length < 30 || inspired.length > 40) fail('need 30 to 40 inspired-by mics, got ' + inspired.length);
  if (originals.length < 3 || originals.length > 5) fail('need 3 to 5 originals, got ' + originals.length);
  const TYPES = ['dynamic', 'condenser', 'ribbon'], PATTERNS = ['cardioid', 'supercardioid', 'hypercardioid', 'figure8', 'omni', 'wide'];
  for (const t of TYPES) if (inspired.filter((d) => d.mic.type === t).length < 8) fail('fewer than 8 ' + t + ' mics');
  const names = new Set();
  for (const d of defs) {
    const m = d.mic, w = (s) => fail(`${d.id}: ${s}`);
    if (names.has(d.name)) w('duplicate name');
    names.add(d.name);
    if (d.cat !== 'Mic') w('cat ' + d.cat);
    if (!d.desc || d.desc.length < 20) w('no desc');
    if (/[\u2013\u2014]/.test(d.desc + d.name + d.ref)) w('dash character in text');
    if (!d.original && (!d.ref || !d.brand)) w('missing ref / brand');
    // product names must not be the real model
    if (!d.original && d.ref) {
      const model = d.ref.replace(d.brand, '').replace(/\(.*\)/, '').trim().replace(/[\s-]/g, '').toLowerCase();
      if (model.length > 2 && d.name.replace(/[\s-]/g, '').toLowerCase().includes(model)) w('name contains the real model name');
      if (d.name.toLowerCase().includes(d.brand.toLowerCase())) w('name contains the real brand');
    }
    if (!TYPES.includes(m.type)) w('type ' + m.type);
    if (!PATTERNS.includes(m.pattern)) w('pattern ' + m.pattern);
    const r = m.resp;
    if (!Array.isArray(r) || r.length < 10 || r.length > 40) w('resp needs 10 to 40 points');
    else {
      if (r[0][0] !== 20 || r[r.length - 1][0] !== 20000) w('resp must span 20 Hz to 20 kHz');
      for (let i = 1; i < r.length; i++) if (!(r[i][0] > r[i - 1][0])) w('resp not ascending at ' + r[i][0]);
      for (const [f, g] of r) if (!(g >= -40 && g <= 15)) w(`resp ${f} Hz: ${g} dB out of range`);
      const k = r.find(([f]) => f === 1000);
      if (!k || Math.abs(k[1]) > 0.5) w('resp should be 0 dB at 1 kHz');
    }
    if (!(m.prox >= 0 && m.prox <= 20)) w('prox ' + m.prox);
    if (m.pattern === 'omni' && m.prox !== 0) w('omni with proximity');
    if (m.pattern === 'figure8' && m.prox < 8) w('figure 8 with little proximity');
    if (!(m.offAxis <= 0 && m.offAxis >= -15)) w('offAxis ' + m.offAxis);
    if (!(m.sens >= -12 && m.sens <= 15)) w('sens ' + m.sens);
    if (m.type === 'condenser' && m.sens < 5) w('condenser too quiet');
    if (m.type === 'ribbon' && m.sens > 3 && !d.original) w('passive ribbon too loud');
    if (!/^#[0-9a-f]{6}$/i.test(m.color || '')) w('color');
    if (!m.look || !m.look.shape || d.kind !== 'studio-mics') w('look is not a studio-mics drawing');
    if (d.form !== 'mic') w('form ' + d.form);
    if (!m.short || m.short.length > 5) w('short tag');
  }

  // ---- 2. response sanity: interpolate on a log axis
  const at = (r, f) => {
    if (f <= r[0][0]) return r[0][1];
    for (let i = 1; i < r.length; i++) if (f <= r[i][0]) {
      const t = Math.log(f / r[i - 1][0]) / Math.log(r[i][0] / r[i - 1][0]);
      return r[i - 1][1] + t * (r[i][1] - r[i - 1][1]);
    }
    return r[r.length - 1][1];
  };
  const band = (r, f0, f1) => { let s = 0, n = 0; for (let f = f0; f <= f1; f *= 1.06) { s += at(r, f); n++; } return s / n; };
  const avg = (list, fn) => list.reduce((a, d) => a + fn(d.mic.resp), 0) / list.length;
  const byType = (t) => inspired.filter((d) => d.mic.type === t);
  const hi = (r) => band(r, 5000, 12000);
  const hR = avg(byType('ribbon'), hi), hC = avg(byType('condenser'), hi), hD = avg(byType('dynamic'), hi);
  console.log(`mean 5 to 12 kHz: ribbon ${hR.toFixed(1)} dB, dynamic ${hD.toFixed(1)} dB, condenser ${hC.toFixed(1)} dB`);
  if (!(hR < hD - 2 && hD < hC)) fail('ribbons should be darker than dynamics, dynamics darker than condensers');
  const sm57 = info.core57 || [[20, -14], [50, -8], [100, -3], [200, 0], [1000, 0], [3000, 2], [5500, 6], [8000, 2], [12000, -6], [16000, -12], [20000, -20]];
  const rms = (a, b) => { let s = 0, n = 0; for (let f = 40; f <= 16000; f *= 1.05) { s += (at(a, f) - at(b, f)) ** 2; n++; } return Math.sqrt(s / n); };
  // none of the plugin mics is just another 57
  const near = defs.map((d) => [d.id, rms(d.mic.resp, sm57)]).sort((a, b) => a[1] - b[1]);
  console.log(`closest to the 57 (${info.core57id || 'contract example'}): ${near.slice(0, 3).map(([i, v]) => `${i} ${v.toFixed(1)} dB`).join(', ')}`);
  for (const [i, v] of near) if (v < 1) fail(`${i} is nearly the same as the 57`);
  // every pair of mics of the same type and pattern should differ somewhere (no copy-paste curves)
  for (let i = 0; i < defs.length; i++) for (let j = i + 1; j < defs.length; j++) {
    const a = defs[i].mic, b = defs[j].mic;
    if (a.type === b.type && a.pattern === b.pattern && rms(a.resp, b.resp) < 0.4) fail(`${defs[i].id} and ${defs[j].id} have nearly the same response`);
  }

  // ---- 3. drawing: library form (thumbnail), the raw mic drawing, raster thumbnail
  const draw = await win.evaluate(async () => {
    const cat = await import('./js/catalog/index.js');
    const { renderForm } = await import('./js/gfx/forms.js');
    const { drawMicModel } = await import('./js/gfx/forms-mic.js');
    const { thumbURL } = await import('./js/gfx/raster.js');
    const NS = 'http://www.w3.org/2000/svg';
    const host = document.createElementNS(NS, 'svg');
    document.body.appendChild(host);
    const out = [];
    for (const d of cat.allDefs().filter((x) => x.plugin === 'mics')) {
      const r = { id: d.id, errs: [] };
      try {
        const g = document.createElementNS(NS, 'g');
        host.appendChild(g);
        const res = renderForm({ g, views: new Map(), flip: false, thumb: true }, Object.assign(Object.create(d), { ports: d.ports }));
        const bb = g.getBBox();
        if (!(res.w > 30 && res.h > 30 && bb.width > 20 && bb.height > 20)) r.errs.push(`form size ${res.w}x${res.h}`);
        g.remove();
      } catch (e) { r.errs.push('form: ' + e.message); }
      try {
        const g = document.createElementNS(NS, 'g');
        host.appendChild(g);
        const ext = drawMicModel(g, d);
        const bb = g.getBBox();
        // the plugin's own drawing (its shading gradients), not the core fallback
        if (!g.innerHTML.includes('tzm-')) r.errs.push('drawn by the core fallback');
        if (!(ext.w > 15 && ext.bottom - ext.top > 60 && ext.top <= 0 && ext.bottom > 0)) r.errs.push('extent ' + JSON.stringify(ext));
        if (Math.abs(bb.width - ext.w) > ext.w * 0.6 || Math.abs(bb.height - (ext.bottom - ext.top)) > (ext.bottom - ext.top) * 0.35) r.errs.push(`extent ${Math.round(ext.w)}x${Math.round(ext.bottom - ext.top)} vs drawn ${Math.round(bb.width)}x${Math.round(bb.height)}`);
        g.remove();
      } catch (e) { r.errs.push('mic drawing: ' + e.message); }
      try {
        const url = await thumbURL(d, 42, true);
        if (!url || url.length < 600) r.errs.push('thumbnail empty');
      } catch (e) { r.errs.push('thumb: ' + e.message); }
      out.push(r);
    }
    host.remove();
    return out;
  });
  for (const r of draw) for (const e of r.errs) fail(`${r.id}: ${e}`);
  console.log(`drawn: ${draw.length} (library form, mic drawing, thumbnail)`);

  // ---- 4. the block list: the Mics kind chip (or a search) lists every plugin mic
  const listed = await win.evaluate(async (wanted) => {
    const chips = [...document.querySelectorAll('#catChips .kinds .chip')];
    const chip = chips.find((c) => /^mics?$/i.test(c.textContent.trim()));
    const inp = document.getElementById('blockSearch');
    if (chip) chip.click();
    else { inp.value = 'mic'; inp.dispatchEvent(new Event('input')); }
    await new Promise((r) => setTimeout(r, 300));
    const list = document.getElementById('blockList');
    const seen = new Set();
    for (let y = 0; y < 40000; y += 300) {
      list.scrollTop = y;
      list.dispatchEvent(new Event('scroll'));
      await new Promise((r) => setTimeout(r, 30));
      list.querySelectorAll('.bl-item .name').forEach((n) => seen.add(n.textContent));
      if (list.scrollTop + list.clientHeight >= list.scrollHeight - 2) break;
    }
    list.scrollTop = 0;
    return { chip: !!chip, missing: wanted.filter((n) => !seen.has(n)), seen: seen.size };
  }, defs.map((d) => d.name));
  console.log(`block list (${listed.chip ? 'Mics chip' : 'search "mic"'}): ${listed.seen} rows, missing ${listed.missing.length}`);
  if (listed.missing.length) fail('not in the list: ' + listed.missing.join(', '));
  if (!listed.chip) console.log('note: no Mics chip in the block list yet');
  if (shotDir) {
    await win.waitForTimeout(800);
    await win.screenshot({ path: path.join(shotDir, 'mics-list.png') });
  }

  // ---- 5. on cabs: every plugin mic on a cab (8 per cab), drawn on the board
  const onCab = await win.evaluate(async (ids) => {
    const T = window.__tz;
    const st = await import('./js/state.js');
    const cat = await import('./js/catalog/index.js');
    const cm = await import('./js/catalog/cabmics.js');
    const { bus } = await import('./js/util.js');
    st.loadPreset(st.newPreset('mics'), null);
    const cabs = [];
    for (let k = 0; k < ids.length; k += 8) {
      const b = st.addBlock('celestion.cab-v30-2x12', (k / 8) * 480, 0);
      const d = cat.getDef(b.type);
      const spots = ['cap', 'cap-edge', 'cone', 'edge'];
      cm.applyMicSpec(b, d, { mics: ids.slice(k, k + 8).map((m, j) => ({ model: m, spk: j % 2, at: spots[j >> 1], dist: 0.05 + 0.1 * (j % 3) })) });
      cabs.push(b.id);
    }
    bus.emit('rebuildBoard');
    st.syncGraph();
    await new Promise((r) => setTimeout(r, 600));
    const res = { cabs: cabs.length, mics: 0, missing: [] };
    for (const id of cabs) {
      const b = T.state.preset.blocks.find((x) => x.id === id);
      const v = T.editor.views.get(id);
      const n = cm.activeSlots(b).length;
      res.mics += n;
      const drawn = v && v.g ? v.g.querySelectorAll('.ctl.mic').length : 0;
      if (drawn < n) res.missing.push(id);
    }
    // frame the cabs for a screenshot
    const bl = T.state.preset.blocks.filter((b) => cabs.includes(b.id));
    const vw = (b) => T.editor.views.get(b.id);
    const minX = Math.min(...bl.map((b) => b.x)), maxX = Math.max(...bl.map((b) => b.x + vw(b).w));
    const minY = Math.min(...bl.map((b) => b.y)), maxY = Math.max(...bl.map((b) => b.y + vw(b).h));
    const rr = T.editor.svg.getBoundingClientRect();
    const z = Math.min(2, (rr.width - 40) / (maxX - minX), (rr.height - 40) / (maxY - minY));
    T.editor.view.z = z; T.editor.view.x = rr.width / 2 - ((minX + maxX) / 2) * z; T.editor.view.y = rr.height / 2 - ((minY + maxY) / 2) * z;
    T.editor.applyView();
    T.state.selection.clear();
    return res;
  }, defs.map((d) => d.id));
  console.log(`on cabs: ${onCab.mics} mics on ${onCab.cabs} cabs`);
  if (onCab.mics !== defs.length) fail(`only ${onCab.mics} of ${defs.length} mics landed on the cabs`);
  if (onCab.missing.length) fail('mics not drawn on ' + onCab.missing.join(', '));
  if (shotDir) {
    await win.waitForTimeout(1200);
    await (await win.$('#board')).screenshot({ path: path.join(shotDir, 'mics-on-cabs.png') });
  }

  // ---- 6. audio: each mic alone on a cab, pink-ish noise through it offline, compare the spectra
  const ids = ['smic.r10', 'smic.tlm103', 'smic.rca44', 'smic.c800g', 'smic.e609', 'smic.re20', 'smic.d112', 'smic.sm7b'];
  const graphs = await win.evaluate(async (ids) => {
    const cat = await import('./js/catalog/index.js');
    const st = await import('./js/state.js');
    const cm = await import('./js/catalog/cabmics.js');
    const out = {};
    for (const id of ['mics.dyn57', ...ids]) {
      const p = st.newPreset('one');
      const b = { id: 'b', type: 'celestion.cab-v30-1x12', x: 0, y: 0, params: {}, bypass: false, variant: 'mono' };
      cm.applyMicSpec(b, cat.getDef(b.type), { mics: [{ model: id, at: 'cap-edge', dist: 0.15 }] });
      p.blocks.push(b);
      p.cables = [{ id: 'c1', from: { node: '__in', port: 0 }, to: { node: 'b', port: 0 } }, { id: 'c2', from: { node: 'b', port: 0 }, to: { node: '__out', port: 0 } }];
      st.loadPreset(p, null);
      out[id] = st.buildGraph();
    }
    return out;
  }, ids);
  if (!ENGINE) console.log('audio: skipped, no engine build');
  else {
    console.log('audio with ' + path.relative(ROOT, ENGINE));
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mics-'));
    const sr = 48000, N = sr * 3;
    // white noise with a gentle low-pass: enough energy everywhere
    let seed = 7, lp = 0;
    const x = new Float32Array(N).map(() => { const w = ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1; lp += 0.6 * (w - lp); return 0.2 * lp; });
    const wav = (p, a) => {
      const hdr = Buffer.alloc(44);
      hdr.write('RIFF', 0); hdr.writeUInt32LE(36 + a.length * 4, 4); hdr.write('WAVE', 8); hdr.write('fmt ', 12);
      hdr.writeUInt32LE(16, 16); hdr.writeUInt16LE(3, 20); hdr.writeUInt16LE(1, 22); hdr.writeUInt32LE(sr, 24); hdr.writeUInt32LE(sr * 4, 28); hdr.writeUInt16LE(4, 32); hdr.writeUInt16LE(32, 34);
      hdr.write('data', 36); hdr.writeUInt32LE(a.length * 4, 40);
      fs.writeFileSync(p, Buffer.concat([hdr, Buffer.from(a.buffer)]));
    };
    const readMono = (p) => {
      const b = fs.readFileSync(p);
      let pos = 12, ch = 1, bits = 32, fmt = 3, data = null;
      while (pos + 8 < b.length) {
        const id = b.toString('ascii', pos, pos + 4), len = b.readUInt32LE(pos + 4);
        if (id === 'fmt ') { fmt = b.readUInt16LE(pos + 8); ch = b.readUInt16LE(pos + 10); bits = b.readUInt16LE(pos + 22); }
        if (id === 'data') { data = b.subarray(pos + 8, pos + 8 + len); break; }
        pos += 8 + len + (len & 1);
      }
      const n = data.length / (bits / 8) / ch, y = new Float32Array(n);
      for (let i = 0; i < n; i++) y[i] = fmt === 3 ? data.readFloatLE(i * ch * 4) : data.readInt16LE(i * ch * 2) / 32768;
      return y;
    };
    // averaged magnitude spectrum (Hann, 4096) -> [[Hz, dB]] on a log grid, 0 dB at 1 kHz
    const spectrum = (y) => {
      const n = 4096, re = new Float64Array(n), im = new Float64Array(n), acc = new Float64Array(n / 2);
      for (let s0 = sr / 2; s0 + n <= y.length; s0 += n / 2) {
        for (let i = 0; i < n; i++) { re[i] = y[s0 + i] * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n)); im[i] = 0; }
        for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; } }
        for (let len = 2; len <= n; len <<= 1) {
          const a = (-2 * Math.PI) / len;
          for (let i = 0; i < n; i += len) for (let k = 0; k < len / 2; k++) {
            const c = Math.cos(a * k), sn = Math.sin(a * k), u = i + k, v = u + len / 2;
            const tr = re[v] * c - im[v] * sn, ti = re[v] * sn + im[v] * c;
            re[v] = re[u] - tr; im[v] = im[u] - ti; re[u] += tr; im[u] += ti;
          }
        }
        for (let k = 0; k < n / 2; k++) acc[k] += re[k] * re[k] + im[k] * im[k];
      }
      const out = [];
      for (let f = 40; f <= 16000; f *= 1.12) {
        const k0 = Math.floor((f / 1.06 / sr) * n), k1 = Math.ceil((f * 1.06 / sr) * n);
        let e = 0; for (let k = k0; k <= k1; k++) e += acc[k];
        out.push([f, 10 * Math.log10(e / (k1 - k0 + 1) + 1e-20)]);
      }
      const ref = at(out, 1000);
      return out.map(([f, v]) => [f, v - ref]);
    };
    const inp = path.join(tmp, 'in.wav'), outp = path.join(tmp, 'out.wav'), gp = path.join(tmp, 'g.json');
    wav(inp, x);
    const sp = {}, lv = {};
    for (const [id, g] of Object.entries(graphs)) {
      fs.writeFileSync(gp, JSON.stringify({ settings: { quality: 1 }, graph: g }));
      try {
        execFileSync(ENGINE, ['--offline', gp, inp, outp], { stdio: ['ignore', 'pipe', 'pipe'] });
        const y = readMono(outp);
        sp[id] = spectrum(y);
        lv[id] = 10 * Math.log10(y.reduce((a, v) => a + v * v, 0) / y.length + 1e-20);
      } catch (e) { fail(`${id}: engine failed ${String(e.stderr || e.message).slice(0, 160)}`); }
    }
    fs.rmSync(tmp, { recursive: true, force: true });
    if (Object.keys(sp).length === ids.length + 1) {
      const tilt = (s) => band(s, 5000, 12000) - band(s, 300, 1500);
      for (const [id, s] of Object.entries(sp)) console.log(`  ${id.padEnd(14)} level ${(lv[id] - lv['mics.dyn57']).toFixed(1).padStart(5)} dB, highs vs mids ${tilt(s).toFixed(1).padStart(6)} dB, vs 57 ${rms(s, sp['mics.dyn57']).toFixed(1)} dB rms`);
      for (const id of ids) if (Math.abs(lv[id] - lv['mics.dyn57']) > 15) fail(`${id}: level ${(lv[id] - lv['mics.dyn57']).toFixed(1)} dB against the 57`);
      const spread = Math.max(...ids.map((i) => rms(sp[i], sp['mics.dyn57'])));
      if (spread < 0.3) console.log('audio: every model sounds like the 57: the engine build does not read mic models yet (rebuild engine)');
      else {
        if (!(tilt(sp['smic.r10']) < tilt(sp['smic.tlm103']) - 3)) fail('the R-10 should sound darker than the TLM 103 on a cab');
        if (!(tilt(sp['smic.rca44']) < tilt(sp['smic.c800g']) - 4)) fail('the 44 should sound darker than the C-800G on a cab');
        if (rms(sp['smic.e609'], sp['smic.re20']) < 0.8) fail('the e609 and RE20 sound the same on a cab');
        for (const i of ids) if (rms(sp[i], sp['mics.dyn57']) < 0.5) fail(i + ' sounds like the 57 on a cab');
      }
    }
  }

  if (logs.length) { console.log(logs.join('\n')); fail('console errors'); }
  console.log(fails.length ? `${fails.length} failures` : 'mic models ok');
  await app.close();
  process.exit(fails.length ? 1 : 0);
})();
