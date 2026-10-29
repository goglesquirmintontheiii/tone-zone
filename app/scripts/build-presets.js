// Builds factory presets from compact specs (scripts/preset-specs.js) inside the running app, so block sizes, port
// counts and knob ranges come from the real catalog (including plugin blocks).
// usage: node scripts/build-presets.js [--only file-prefix] [--check]
//
// Spec:
//   { file, name, tags, desc,
//     chain: [ 'type' | ['type', {param: value}, {bypass, variant, x, y}] , … ]            – simple series rig, or
//     nodes: { key: ['type', {params}, {bypass, variant}] }, edges: [['in', 'a'], ['a', 'b', outPort, inPort], …],
//     rows: [['a', 'b'], ['c']]                                                          – any graph, rows laid out R→L
//   }
// Knob / slider / treadle values are positions 0..1 (converted with the control's range); selectors and toggles take
// the option index; anything else is stored as given. Prefix a key with '=' to store a raw value for a knob.
const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null;
  const check = process.argv.includes('--check');
  // level matching: measured levels (from preset-check.js) → trim each rig's cab mics towards a common loudness
  const lvPath = process.argv.includes('--levels') ? process.argv[process.argv.indexOf('--levels') + 1] : null;
  const measured = lvPath ? JSON.parse(fs.readFileSync(lvPath, 'utf8')) : {};
  const prevTrim = (() => { try { return JSON.parse(fs.readFileSync(path.join(__dirname, 'preset-trims.json'), 'utf8')); } catch { return {}; } })();
  const trims = Object.assign({}, prevTrim);
  for (const [f, lv] of Object.entries(measured)) {
    if (!/^[gsxmrta]\d/.test(f)) continue;
    const target = /lead/.test(f) ? -13 : -15;
    trims[f] = Math.max(-12, Math.min(12, Math.round(((prevTrim[f] || 0) + (target - lv)) * 2) / 2));
  }
  fs.writeFileSync(path.join(__dirname, 'preset-trims.json'), JSON.stringify(trims, null, 1));
  const specs = require('./preset-specs.js').filter((s) => !only || s.file.startsWith(only));
  const app = await electron.launch({ executablePath: require('electron'), args: [path.join(__dirname, '..'), '--no-sandbox'] });
  const win = await app.firstWindow();
  const errs = [];
  win.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
  await win.waitForFunction(() => window.__tz && window.__tz.ready, null, { timeout: 120000 });
  for (const sp of specs) sp.trimDb = trims[sp.file] || 0;
  const out = await win.evaluate(async (specs) => {
    const C = await import('./js/catalog/index.js');
    const { sizeOf } = await import('./js/pages/presets.js');
    const { knobValue } = await import('./js/nodeview.js');
    const { defaultMicXY } = await import('./js/gfx/cabgeom.js');
    const problems = [];
    const COLORS = ['#e8473d', '#f39c12', '#f1c40f', '#2ecc71', '#3498db', '#6c5ce7', '#e84393', '#1abc9c', '#ecf0f1'];
    const AUX = /^(EXP|CTL|CTRL|MIDI|USB|SEND|RETURN|TUNER|BYPASS|DI OUT|XLR|THRU|DIRECT|LINE OUT|PHONES|B OUT)/i;
    const audioPorts = (N, dir) => (N.d ? (C.portsFor(N.d, N.b.variant)[dir] || []).filter((l) => !AUX.test(l)).length : 1);
    const build = (spec) => {
      let n = 0;
      const nodes = {};
      const order = [];
      const add = (key, item) => {
        let [type, params = {}, o = {}] = Array.isArray(item) ? item : [item];
        const d = C.getDef(type);
        if (!d || d.missing) problems.push(`${spec.file}: unknown block ${type}`);
        const b = { id: 'b' + ++n, type, x: 0, y: 0, params: {}, bypass: !!o.bypass, variant: 'mono' };
        if (d && d.initParams) Object.assign(b.params, JSON.parse(JSON.stringify(d.initParams)));
        // cabs: mic1 / mic2 = mic type index (2nd mic placed on the next speaker, blended in mono)
        if (d && d.cabMics) {
          if (params.mic1 !== undefined) b.params.m1type = params.mic1;
          if (params.mic2 !== undefined) {
            const xy = defaultMicXY(d.cabSize || '4x12', 2);
            Object.assign(b.params, { m2on: 1, m2type: params.mic2, m2dist: 0.2, _m2x: xy.x, _m2y: xy.y, m2lvl: params.mic2lvl ?? -3 });
          }
          params = Object.fromEntries(Object.entries(params).filter(([k]) => !/^mic\d/.test(k)));
        }
        for (const [k0, v] of Object.entries(params)) {
          const raw = k0.startsWith('=');
          const k = raw ? k0.slice(1) : k0;
          const c = d && d.controls.find((x) => x.p === k);
          if (d && !c && !(d.initParams && k in d.initParams) && !k.startsWith('_') && !k.includes('.')) problems.push(`${spec.file}: ${type} has no control "${k}"`);
          b.params[k] = !raw && c && (c.t === 'knob' || c.t === 'slider' || c.t === 'treadle') ? +knobValue(c, Math.max(0, Math.min(1, v))).toFixed(4) : v;
        }
        if (o.raw) Object.assign(b.params, o.raw);
        if (o.variant) b.variant = o.variant;
        else if (d && (d.stereo === 'stereo')) b.variant = 'stereo';
        nodes[key] = { b, d, o };
        order.push(key);
        return key;
      };
      const edges = [];
      let rows;
      if (spec.chain) {
        const keys = spec.chain.map((it, i) => add('n' + i, it));
        // stereo once a block outputs stereo; 'both' blocks downstream follow
        let st = false;
        let prev = 'in';
        for (const k of keys) {
          const N = nodes[k];
          if (N.d && N.d.stereo === 'both' && !N.o.variant) N.b.variant = st && N.d.baseForm !== 'cab' && !/^(Amp|Bass Amp|Preamp|Overdrive|Distortion|Fuzz|Boost|Wah|Dynamics)$/.test(N.d.cat) ? 'stereo' : N.o.stereo ? 'stereo' : 'mono';
          edges.push([prev, k]);
          const ins = audioPorts(N, 'ins');
          if (st && ins < 2 && N.d && N.d.cat !== 'Utility') problems.push(`${spec.file}: mono ${N.b.type} after a stereo signal (right channel dropped)`);
          if (audioPorts(N, 'outs') >= 2 && N.d.stereo !== 'fixedDual') st = true;
          prev = k;
        }
        edges.push([prev, 'out']);
        rows = spec.rows || [keys];
      } else {
        for (const [k, it] of Object.entries(spec.nodes)) add(k, it);
        for (const e of spec.edges) edges.push(e);
        rows = spec.rows || [Object.keys(spec.nodes)];
      }
      // ---- layout: rows right→left (input on the right), amp heads with a cab right after get the cab stacked below
      const GAP = 70, ROWGAP = 90;
      let y = 0;
      const placed = new Set();
      // a row starting with '@key' begins (on its right) at the left edge of block `key`
      for (let row of rows) {
        let x = 0, rowH = 0;
        if (typeof row[0] === 'string' && row[0][0] === '@') {
          x = -nodes[row[0].slice(1)].b.x + 40;
          row = row.slice(1);
        }
        for (let i = 0; i < row.length; i++) {
          const N = nodes[row[i]];
          const [w, h] = sizeOf(N.d);
          const next = nodes[row[i + 1]];
          const stack = N.d && N.d.baseForm === 'amp' && !N.d.combo && next && next.d && next.d.baseForm === 'cab' && !N.o.noStack;
          if (stack) {
            const [cw, ch] = sizeOf(next.d);
            const W = Math.max(w, cw);
            N.b.x = Math.round(-x - (W + w) / 2);
            N.b.y = y;
            next.b.x = Math.round(-x - (W + cw) / 2);
            next.b.y = y + h + 14;
            rowH = Math.max(rowH, h + 14 + ch);
            x += W + GAP;
            placed.add(row[i + 1]);
            i++;
            continue;
          }
          N.b.x = Math.round(-x - w);
          N.b.y = y;
          rowH = Math.max(rowH, h);
          x += w + GAP;
        }
        // vertically centre short blocks in the row
        for (const k of row) {
          const N = nodes[k];
          const [, h] = sizeOf(N.d);
          if (!placed.has(k) && !(N.d && N.d.baseForm === 'amp')) N.b.y = y + Math.max(0, (Math.min(rowH, 460) - h) / 2);
        }
        y += rowH + ROWGAP;
      }
      for (const k of order) if (nodes[k].o.x !== undefined) { nodes[k].b.x = nodes[k].o.x; nodes[k].b.y = nodes[k].o.y; }
      // I/O blocks at both ends of the first row
      const minX = Math.min(...order.map((k) => nodes[k].b.x));
      const firstH = Math.max(...rows[0].filter((k) => k[0] !== '@').map((k) => sizeOf(nodes[k].d)[1]));
      const blocks = [{ id: '__in', type: '__in', x: 130, y: Math.max(0, firstH / 2 - 110), params: {} }, ...order.map((k) => nodes[k].b), { id: '__out', type: '__out', x: minX - 240, y: Math.max(0, firstH / 2 - 110), params: {} }];
      // ---- cables
      const cables = [];
      let ci = 0;
      const id = (k) => (k === 'in' ? '__in' : k === 'out' ? '__out' : nodes[k].b.id);
      const portsOf = (k, dir) => {
        if (k === 'in') return dir === 'out' ? 1 : 0;
        if (k === 'out') return dir === 'in' ? 2 : 0;
        const N = nodes[k];
        if (!N.d) return 1;
        const p = C.portsFor(N.d, N.b.variant);
        return (dir === 'in' ? p.ins : p.outs).filter((l) => !AUX.test(l)).length || 1;
      };
      for (const e of edges) {
        const [a, b, fp, tp] = e;
        const color = e[4] || COLORS[ci++ % COLORS.length];
        if (fp !== undefined) {
          cables.push({ id: 'c' + ++n, from: { node: id(a), port: fp }, to: { node: id(b), port: tp ?? 0 }, color });
          continue;
        }
        const outs = portsOf(a, 'out'), ins = portsOf(b, 'in');
        if (b === 'out') {
          cables.push({ id: 'c' + ++n, from: { node: id(a), port: 0 }, to: { node: '__out', port: 0 }, color });
          cables.push({ id: 'c' + ++n, from: { node: id(a), port: outs >= 2 ? 1 : 0 }, to: { node: '__out', port: 1 }, color: outs >= 2 ? COLORS[ci++ % COLORS.length] : color });
          continue;
        }
        const k = Math.max(1, Math.min(outs, ins));
        for (let p = 0; p < k; p++) cables.push({ id: 'c' + ++n, from: { node: id(a), port: p }, to: { node: id(b), port: p }, color: p ? COLORS[ci++ % COLORS.length] : color });
      }
      if (spec.trimDb) {
        let applied = false;
        for (const k of order) {
          const N = nodes[k];
          if (N.d && N.d.cabMics) {
            N.b.params.level = Math.max(-24, Math.min(12, +((N.b.params.level || 0) + spec.trimDb).toFixed(1)));
            applied = true;
          }
        }
        if (!applied) problems.push(`${spec.file}: no cab to apply ${spec.trimDb} dB trim`);
      }
      return { version: 1, name: spec.name, tags: spec.tags || [], desc: spec.desc || '', factory: true, order: spec.order || 0, blocks, cables, view: null };
    };
    const res = specs.map((s) => ({ file: s.file, preset: build(s) }));
    // validate: load each into the engine graph builder
    for (const r of res) {
      try {
        window.__tz.buildGraph(r.preset);
      } catch (e) {
        problems.push(`${r.file}: graph error ${e.message}`);
      }
    }
    return { res, problems };
  }, specs);
  if (out.problems.length) console.log('PROBLEMS\n' + out.problems.join('\n'));
  if (!check) {
    const dir = path.join(__dirname, '..', 'presets');
    for (const r of out.res) fs.writeFileSync(path.join(dir, r.file + '.json'), JSON.stringify(r.preset, null, 1));
    console.log('wrote', out.res.length, 'presets');
  }
  if (errs.length) console.log(errs.join('\n'));
  await app.close();
})();
