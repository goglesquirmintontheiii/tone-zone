// Studio Mics plugin check: every plugin mic loads, shows up in the block list, has valid mic data (the mic model
// contract in docs/mic-blocks.md), draws without errors (thumbnail, free-standing block, on-cab view) and, once
// the cab mic system is there, sounds different from the others when it is put on a cab.
// usage: node scripts/mic-models-test.js [shotDir]
const { _electron: electron } = require('playwright');
const path = require('path');
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
      defs: defs.map((d) => ({ id: d.id, name: d.name, ref: d.ref, brand: d.brand, cat: d.cat, desc: d.desc, original: cat.isOriginal(d), mic: JSON.parse(JSON.stringify(d.mic)), hasDraw: typeof d.mic.draw === 'function' })),
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
    if (/[–—]/.test(d.desc + d.name + d.ref)) w('dash character in text');
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
    if (!m.look || !m.look.shape) w('no look');
    if (!d.hasDraw) w('no draw hook');
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

  // ---- 3. drawing: free-standing form, raster thumbnail, on-cab view
  const draw = await win.evaluate(async () => {
    const cat = await import('./js/catalog/index.js');
    const { renderForm } = await import('./js/gfx/forms.js');
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
        r.form = [res.w, res.h, Math.round(bb.width), Math.round(bb.height)];
        if (!(res.w > 15 && res.h > 40 && bb.width > 10 && bb.height > 30)) r.errs.push('form size ' + r.form);
        g.remove();
      } catch (e) { r.errs.push('form: ' + e.message); }
      try {
        const g = document.createElementNS(NS, 'g');
        host.appendChild(g);
        const s = d.mic.draw(g, { view: 'cab', len: 40 });
        const bb = g.getBBox();
        if (!(bb.width > 4 && bb.height > 8 && s.w > 0)) r.errs.push('cab view size');
        g.remove();
      } catch (e) { r.errs.push('cab view: ' + e.message); }
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
  console.log(`drawn: ${draw.length} (form, thumbnail, on-cab)`);

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

  // ---- 5. audio: put mics on a cab and compare spectra (needs the cab mic system from docs/mic-blocks.md)
  const audio = await win.evaluate(async () => {
    const T = window.__tz;
    const hook = T.mics || (await import('./js/catalog/mics.js').catch(() => null));
    if (!hook || !hook.testSpectrum) return { skipped: 'no cab mic system yet (window.__tz.mics.testSpectrum)' };
    const ids = ['smic.r10', 'smic.tlm103', 'smic.rca44', 'smic.c800g', 'smic.e609', 'smic.re20', 'smic.d112', 'smic.sm7b'];
    const out = {};
    for (const id of ids) out[id] = await hook.testSpectrum(id);
    return { out };
  });
  if (audio.skipped) console.log('audio: skipped, ' + audio.skipped);
  else {
    const sp = audio.out, hiE = (s) => band(s, 5000, 12000) - band(s, 300, 1500);
    for (const [id, s] of Object.entries(sp)) console.log(`  ${id}: tilt ${hiE(s).toFixed(1)} dB`);
    if (!(hiE(sp['smic.r10']) < hiE(sp['smic.tlm103']) - 3)) fail('the R-10 should sound darker than the TLM 103 on a cab');
    if (!(hiE(sp['smic.rca44']) < hiE(sp['smic.c800g']) - 4)) fail('the 44 should sound darker than the C-800G on a cab');
    if (rms(sp['smic.e609'], sp['smic.re20']) < 0.8) fail('the e609 and RE20 sound the same on a cab');
  }

  if (logs.length) { console.log(logs.join('\n')); fail('console errors'); }
  console.log(fails.length ? `${fails.length} failures` : 'mic models ok');
  await app.close();
  process.exit(fails.length ? 1 : 0);
})();
