// Builds the factory presets from the specs in scripts/preset-specs.js inside the running app, so block sizes,
// port counts and knob ranges come from the real catalog (plugin blocks included).
// usage: node scripts/build-presets.js [--only file-prefix] [--check] [--levels levels.json [--target LUFS]]
//
// Spec:
//   { file, name, tags, desc,
//     chain: [ 'type' | ['type', {param: value}, {bypass, variant, x, y}] , … ]            (simple series rig), or
//     nodes: { key: ['type', {params}, {bypass, variant}] }, edges: [['in', 'a'], ['a', 'b', outPort, inPort], …],
//     rows: [['a', 'b'], ['c']]                                                          (any graph, rows laid out R→L)
//   }
// Every preset with 3 or more blocks that fit on a pedalboard gets one (the smallest that holds them in signal
// order, right to left, a row at a time); amps, cabs and floor units go in a row behind it. The hand-made presets
// 01-09 (scripts/make-presets.js, run that first) get the same treatment here.
// Knob, slider and treadle values are positions 0..1 (converted with the control's range). Selectors and toggles
// take the option index, anything else is stored as is. Prefix a key with '=' to store a raw knob value.
const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null;
  const check = process.argv.includes('--check');
  // level matching: measured loudness (LUFS, from preset-check.js levels.json) → per-preset output trims (dB) so
  // every preset plays at the same loudness. Trims go on the cab level; what doesn't fit (or rigs without a cab)
  // goes on a gain block at the end of the chain. make-presets.js reads the same trims file for 01-09.
  const TARGET = process.argv.includes('--target') ? +process.argv[process.argv.indexOf('--target') + 1] : -17;
  const lvPath = process.argv.includes('--levels') ? process.argv[process.argv.indexOf('--levels') + 1] : null;
  const measured = lvPath ? JSON.parse(fs.readFileSync(lvPath, 'utf8')) : {};
  const prevTrim = (() => { try { return JSON.parse(fs.readFileSync(path.join(__dirname, 'preset-trims.json'), 'utf8')); } catch { return {}; } })();
  const trims = Object.assign({}, prevTrim);
  // peak guard: very peaky rigs (clean acoustic, slicers) sit up to 1.5 LU lower so they stay under -1 dBTP.
  // A peak at 0 dBFS was clamped by the output, so the real peak is higher than measured.
  const detail = (() => { try { return JSON.parse(fs.readFileSync(path.join(path.dirname(lvPath), 'loudness.json'), 'utf8')); } catch { return {}; } })();
  for (const [f, lv] of Object.entries(measured)) {
    const plr = detail[f] ? detail[f].tp - detail[f].lufs + (detail[f].peak > -0.01 ? 2 : 0) : 0;
    const goal = Math.max(TARGET - 1.5, Math.min(TARGET, -1 - plr));
    const t = Math.max(-30, Math.min(24, Math.round(((prevTrim[f] || 0) + (goal - lv)) * 10) / 10));
    if (t) trims[f] = t;
    else delete trims[f];
  }
  if (lvPath) fs.writeFileSync(path.join(__dirname, 'preset-trims.json'), JSON.stringify(Object.fromEntries(Object.entries(trims).sort()), null, 1));
  const specs = require('./preset-specs.js').filter((s) => !only || s.file.startsWith(only));
  const app = await electron.launch({ executablePath: require('electron'), args: [path.join(__dirname, '..'), '--no-sandbox'] });
  const win = await app.firstWindow();
  const errs = [];
  win.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
  await win.waitForFunction(() => window.__tz && window.__tz.ready, null, { timeout: 120000 });
  for (const sp of specs) sp.trimDb = trims[sp.file] || 0;
  // hand-made presets (not in the specs) only get their pedalboard
  const dir = path.join(__dirname, '..', 'presets');
  const known = new Set(require('./preset-specs.js').map((s) => s.file));
  const extra = fs.readdirSync(dir).filter((f) => f.endsWith('.json') && !known.has(f.slice(0, -5)) && (!only || f.startsWith(only)))
    .map((f) => ({ file: f.slice(0, -5), preset: JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) }));
  const out = await win.evaluate(async ([specs, extra]) => {
    const C = await import('./js/catalog/index.js');
    const { sizeOf } = await import('./js/pages/presets.js');
    const { knobValue } = await import('./js/nodeview.js');
    const CM = await import('./js/catalog/cabmics.js');
    const { renderForm } = await import('./js/gfx/forms.js');
    const { svg } = await import('./js/util.js');
    const PB = await import('./js/catalog/pedalboards.js');
    const M = await import('./js/gfx/materials.js');
    // ---- board looks that suit the music: first matching tag wins, a couple of variants per style picked by
    // file name so neighbouring presets differ. frame / rail / screw are material specs (gfx/materials.js);
    // rail null = rails match the frame. style: 0 full velcro, 1 strips, 2 screws, 3 messy screws, 4 blank.
    // velcro: 0 black, 1 white, 2 semi-clear.
    const metal = (s, f, c, w) => ({ m: 'metal', s, f, c, w });
    const wood = (s, f, c, w) => ({ m: 'wood', s, f, c, w });
    const LOOKS = [
      [['meme'], [
        { frame: { m: 'acrylic', f: 'candy', c: '#e870aa' }, rail: { m: 'plastic', f: 'gloss', c: '#f1f0ec' }, screw: metal('chrome', 'polished'), style: 1, velcro: 1 },
        { frame: { m: 'glow', f: 'glowing', c: '#7dff6a' }, rail: { m: 'plastic', f: 'gloss', c: '#6b45c4' }, screw: metal('chrome', 'polished'), style: 1, velcro: 0 },
        { frame: { m: 'plastic', f: 'sparkle', c: '#6b45c4', mc: { mode: 'rainbow', angle: 30, stops: [] } }, rail: { m: 'plastic', f: 'gloss', c: '#f5cb2f' }, screw: metal('gold', 'polished'), style: 1, velcro: 2 },
      ]],
      [['deathcore'], [
        { frame: { m: 'carbon', f: 'forged', c: '#3a3d44' }, rail: metal('iron', 'powder', '#1b1c20', { scratch: 0.5, chip: 0.3 }), screw: metal('iron', 'bare'), style: 3, velcro: 0 },
        { frame: metal('iron', 'bare', '', { rust: 0.45, scratch: 0.6, dent: 0.4 }), rail: metal('steel', 'hammertone', '#1b1c20', { scratch: 0.4 }), screw: metal('iron', 'patina'), style: 3, velcro: 0 },
      ]],
      [['djent'], [
        { frame: { m: 'carbon', f: 'gloss', c: '#3a3d44' }, rail: metal('aluminium', 'anodized', '#3d4249'), screw: metal('titanium', 'bare'), style: 2, velcro: 0 },
        { frame: { m: 'carbon', f: 'matte', c: '#2a5fb0' }, rail: metal('aluminium', 'anodized', '#1d1e22'), screw: metal('stainless', 'polished'), style: 0, velcro: 0 },
      ]],
      [['doom', 'stoner'], [
        { frame: metal('bronze', 'patina', '', { scratch: 0.3 }), rail: metal('iron', 'bare', '', { rust: 0.5 }), screw: metal('brass', 'patina'), style: 3, velcro: 0 },
      ]],
      [['metalcore', 'nu-metal'], [
        { frame: metal('steel', 'powder', '#1b1c20', { scratch: 0.45 }), rail: metal('aluminium', 'anodized', '#b3202a'), screw: metal('chrome', 'polished'), style: 2, velcro: 0 },
        { frame: { m: 'carbon', f: 'flake', c: '#b02a2a' }, rail: metal('steel', 'powder', '#1b1c20'), screw: metal('stainless', 'polished'), style: 2, velcro: 0 },
      ]],
      [['thrash', 'heavy-metal', 'classic-metal', 'metal', 'high-gain'], [
        { frame: metal('steel', 'hammertone', '#1b1c20', { scratch: 0.35 }), rail: metal('steel', 'brushed'), screw: metal('chrome', 'polished'), style: 2, velcro: 0 },
        { frame: metal('stainless', 'polished', '', { scratch: 0.25 }), rail: metal('aluminium', 'anodized', '#1d1e22'), screw: metal('iron', 'bare'), style: 2, velcro: 0 },
        { frame: metal('aluminium', 'anodized', '#3d4249', { scratch: 0.3, chip: 0.2 }), rail: null, screw: metal('chrome', 'polished'), style: 3, velcro: 0 },
      ]],
      [['grunge'], [
        { frame: metal('steel', 'bare', '', { scratch: 0.6, rust: 0.25, dent: 0.3 }), rail: metal('steel', 'powder', '#5d6337', { chip: 0.4 }), screw: metal('iron', 'bare'), style: 3, velcro: 0 },
      ]],
      [['punk', 'pop-punk'], [
        { frame: metal('steel', 'powder', '#1b1c20', { chip: 0.5, scratch: 0.5 }), rail: metal('aluminium', 'anodized', '#d0508a'), screw: metal('chrome', 'bare'), style: 3, velcro: 0 },
        { frame: { m: 'rubber', f: 'grip', c: '#1f2023' }, rail: metal('aluminium', 'powder', '#f2c230', { chip: 0.3 }), screw: metal('steel', 'bare'), style: 1, velcro: 0 },
      ]],
      [['worship', 'gospel', 'contemporary-worship'], [
        { frame: { m: 'pearl', s: 'white', f: 'polished' }, rail: metal('aluminium', 'powder', '#efede7'), screw: metal('chrome', 'polished'), style: 0, velcro: 1 },
        { frame: { m: 'glass', f: 'frosted', c: '#eef3f7' }, rail: metal('chrome', 'polished'), screw: metal('chrome', 'polished'), style: 1, velcro: 2 },
        { frame: metal('aluminium', 'powder', '#efede7'), rail: metal('gold', 'brushed'), screw: metal('gold', 'polished'), style: 1, velcro: 1 },
      ]],
      [['acoustic', 'folk'], [
        { frame: wood('walnut', 'oil'), rail: wood('maple', 'satin'), screw: metal('brass', 'polished'), style: 1, velcro: 0 },
        { frame: wood('koa', 'nitro'), rail: wood('mahogany', 'satin'), screw: metal('brass', 'polished'), style: 2, velcro: 0 },
        { frame: wood('maple', 'satin'), rail: wood('rosewood', 'oil'), screw: metal('bronze', 'polished'), style: 1, velcro: 2 },
      ]],
      [['jazz', 'jazz-fusion'], [
        { frame: wood('mahogany', 'nitro'), rail: metal('brass', 'brushed'), screw: metal('gold', 'polished'), style: 0, velcro: 0 },
        { frame: wood('rosewood', 'poly'), rail: metal('aluminium', 'anodized', '#1d1e22'), screw: metal('gold', 'polished'), style: 1, velcro: 0 },
      ]],
      [['country', 'country-rock'], [
        { frame: wood('oak', 'stained', '#e8b25a'), rail: metal('copper', 'brushed'), screw: metal('copper', 'polished'), style: 2, velcro: 0 },
        { frame: wood('pine', 'satin', '', { scratch: 0.3 }), rail: { m: 'tolex', s: 'leather', f: 'worn', c: '#5a3a24' }, screw: metal('brass', 'patina'), style: 2, velcro: 0 },
      ]],
      [['blues'], [
        { frame: { m: 'tolex', s: 'tweed', f: 'worn' }, rail: metal('aluminium', 'brushed'), screw: metal('chrome', 'polished'), style: 1, velcro: 0 },
        { frame: { m: 'tolex', s: 'tolex', f: 'worn', c: '#5a3a24' }, rail: metal('brass', 'brushed'), screw: metal('brass', 'polished'), style: 0, velcro: 0 },
      ]],
      [['surf'], [
        { frame: metal('steel', 'powder', '#1f8a8a'), rail: { m: 'plastic', f: 'gloss', c: '#ece2c6' }, screw: metal('chrome', 'polished'), style: 1, velcro: 1 },
      ]],
      [['funk'], [
        { frame: metal('steel', 'flake', '#5a3fb0'), rail: metal('gold', 'polished'), screw: metal('gold', 'polished'), style: 0, velcro: 0 },
        { frame: metal('steel', 'flake', '#e56b1f'), rail: metal('chrome', 'polished'), screw: metal('chrome', 'polished'), style: 1, velcro: 0 },
      ]],
      [['edm', 'synth'], [
        { frame: { m: 'acrylic', f: 'clear', c: '#3b78d8' }, rail: { m: 'glow', f: 'glowing', c: '#4ff5e0' }, screw: metal('chrome', 'polished'), style: 1, velcro: 2 },
        { frame: { m: 'acrylic', f: 'frosted', c: '#8e5bd8' }, rail: metal('aluminium', 'anodized', '#d0508a'), screw: metal('chrome', 'polished'), style: 0, velcro: 2 },
      ]],
      [['shoegaze'], [
        { frame: { m: 'pearl', s: 'abalone', f: 'polished' }, rail: metal('aluminium', 'anodized', '#5b2b9a'), screw: metal('chrome', 'polished'), style: 1, velcro: 0 },
      ]],
      [['ambient', 'experimental', 'noise'], [
        { frame: { m: 'glass', f: 'frosted', c: '#8e5bd8' }, rail: metal('aluminium', 'brushed'), screw: metal('chrome', 'polished'), style: 0, velcro: 2 },
        { frame: { m: 'concrete', f: 'terrazzo', c: '#4e4f50' }, rail: metal('copper', 'patina'), screw: metal('iron', 'bare'), style: 2, velcro: 0 },
      ]],
      [['classic-rock', 'hard-rock'], [
        { frame: { m: 'tolex', s: 'tolex', f: 'new', c: '#18181a' }, rail: metal('gold', 'brushed'), screw: metal('gold', 'polished'), style: 2, velcro: 0 },
        { frame: { m: 'tolex', s: 'tolex', f: 'worn', c: '#5a1a1e' }, rail: metal('aluminium', 'brushed'), screw: metal('chrome', 'polished'), style: 0, velcro: 0 },
      ]],
      [['prog', 'instrumental'], [
        { frame: { m: 'carbon', f: 'gloss', c: '#6a3fb0' }, rail: metal('chrome', 'polished'), screw: metal('chrome', 'polished'), style: 2, velcro: 0 },
      ]],
      [['indie'], [
        { frame: wood('plywood', 'matte'), rail: metal('steel', 'powder', '#2b7bd6'), screw: metal('steel', 'bare'), style: 1, velcro: 1 },
      ]],
      [['alt-rock'], [
        { frame: metal('aluminium', 'anodized', '#1f5fbf', { scratch: 0.25 }), rail: metal('aluminium', 'anodized', '#1d1e22'), screw: metal('chrome', 'polished'), style: 0, velcro: 0 },
        { frame: { m: 'concrete', f: 'smooth', c: '#4e4f50' }, rail: metal('aluminium', 'brushed'), screw: metal('steel', 'bare'), style: 2, velcro: 0 },
      ]],
      [['pop'], [
        { frame: { m: 'plastic', f: 'gloss', c: '#f1f0ec' }, rail: metal('aluminium', 'powder', '#d6487e'), screw: metal('chrome', 'polished'), style: 1, velcro: 1 },
        { frame: metal('aluminium', 'anodized', '#d0508a'), rail: metal('aluminium', 'brushed'), screw: metal('chrome', 'polished'), style: 0, velcro: 1 },
      ]],
      [['rock', 'crunch'], [
        { frame: metal('aluminium', 'anodized', '#b3202a', { scratch: 0.2 }), rail: metal('aluminium', 'anodized', '#1d1e22'), screw: metal('chrome', 'polished'), style: 0, velcro: 0 },
        { frame: metal('steel', 'hammertone', '#1f2d55'), rail: metal('aluminium', 'brushed'), screw: metal('chrome', 'polished'), style: 2, velcro: 0 },
      ]],
    ];
    // the hand-made presets have no tags
    const LOOK_TAGS = { '02-clean-ambient': ['ambient'], '04-bass-rig': ['funk'], '06-looper-jam': ['rock'], '08-boutique': ['jazz'], '09-wah-fuzz': ['classic-rock'] };
    const hashOf = (str) => { let h = 7; for (const ch of str) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; };
    const boardLook = (file, tags) => {
      const hit = LOOKS.find(([keys]) => keys.some((k) => tags.includes(k)));
      if (!hit) return {}; // the plain default board
      const v = hit[1][hashOf(file) % hit[1].length];
      const out = Object.assign({}, M.toParams(v.frame, 'frame'), v.rail ? M.toParams(v.rail, 'rail') : { railMat: 'frame' }, M.toParams(v.screw, 'screw'));
      // glass takes no screws
      out.style = v.frame.m === 'glass' && (v.style === 2 || v.style === 3) ? 0 : v.style;
      out.velcro = v.velcro;
      return out;
    };
    // ---- v0.11: every cab is re-miked with the new mic models, by style. First matching tag wins; presets that
    // share a style get one of a few variants (by file name) so they don't all sound alike. A spec can still give
    // its own `mics` list. Plugin models (smic.*) fall back to the core 57 if the Studio Mics plugin is off.
    const M57 = (at = 'cap-edge', dist = 0.06, spk = 0) => ({ model: 'mics.dyn57', at, dist, spk });
    const MIC = (model, at, dist, spk, lvl = 0, axis) => Object.assign({ model, at, dist, spk, lvl }, axis !== undefined ? { axis } : {});
    const MIC_RECIPES = [
      [['bass'], [
        [MIC('smic.re20', 'cap', 0.08, 0), MIC('mics.md421', 'cone', 0.1, 1, -5)],
        [MIC('smic.d112', 'cap-edge', 0.06, 0), MIC('mics.md421', 'cone', 0.1, 1, -6)],
      ]],
      [['deathcore', 'djent'], [
        [M57('cap-edge', 0.04), MIC('smic.tz-hornet', 'cone', 0.06, 1, -4)],
        [M57('cap-edge', 0.04), MIC('mics.md421', 'cap-edge', 0.05, 1, -3)],
      ]],
      [['metal', 'high-gain', 'thrash', 'doom'], [
        [M57('cap-edge', 0.05), MIC('mics.md421', 'cone', 0.08, 1, -4)],
        [M57('cap-edge', 0.05), MIC('mics.r121', 'cone', 0.12, 1, -5)],
        [MIC('mics.beta57a', 'cap-edge', 0.04, 0), MIC('smic.m88', 'cone', 0.08, 1, -4)],
        [MIC('mics.e906', 'cap-edge', 0.03, 0), MIC('mics.r121', 'cone', 0.12, 1, -6)],
      ]],
      [['meme'], [
        [MIC('mics.dyn58', 'cap', 0.1, 0)],
        [MIC('smic.tz-prism', 'cone', 0.3, 0), MIC('smic.tz-orb', 'off', 0.9, 1, -8)],
        [MIC('smic.e609', 'cap-edge', 0.02, 0)],
      ]],
      [['acoustic', 'folk'], [
        [MIC('mics.c414', 'cone', 0.5, 0)],
        [MIC('smic.km184', 'cap', 0.45, 0)],
      ]],
      [['edm', 'synth', 'synthwave', 'pop'], [
        [MIC('mics.e906', 'cap-edge', 0.05, 0), MIC('mics.c414', 'cone', 0.4, 1, -5)],
        [M57('cap-edge', 0.06), MIC('smic.tlm103', 'cone', 0.35, 1, -5)],
      ]],
      [['clean', 'ambient', 'worship', 'shoegaze', 'post-rock', 'experimental'], [
        [MIC('mics.u87', 'cone', 0.35, 0), MIC('mics.r121', 'cone', 0.2, 1, -3)],
        [MIC('mics.c414', 'cone', 0.3, 0), M57('cap-edge', 0.08, 1)],
        [MIC('smic.u47', 'cone', 0.4, 0), MIC('smic.r10', 'cone', 0.2, 1, -3)],
        [MIC('smic.c800g', 'cone', 0.35, 0), MIC('smic.rca44', 'cone', 0.25, 1, -4)],
      ]],
      [['blues', 'jazz', 'soul', 'r&b'], [
        [MIC('mics.r121', 'cone', 0.2, 0), M57('cap-edge', 0.1, 1)],
        [MIC('smic.c4038', 'cone', 0.3, 0)],
        [MIC('smic.rca44', 'cone', 0.35, 0), M57('cap-edge', 0.1, 1)],
        [MIC('mics.m160', 'cap-edge', 0.1, 0), MIC('smic.u47fet', 'cone', 0.4, 1, -4)],
      ]],
      [['country', 'funk', 'indie', 'surf'], [
        [M57('cap-edge', 0.08), MIC('mics.md441', 'cone', 0.12, 1, -3)],
        [M57('cap-edge', 0.08), MIC('smic.km184', 'cone', 0.35, 1, -4)],
        [MIC('mics.md441', 'cap-edge', 0.08, 0), MIC('smic.r92', 'cone', 0.2, 1, -4)],
      ]],
      [['grunge', 'punk', 'hard-rock', 'classic-rock', 'rock', 'crunch', 'lead', 'rhythm'], [
        [M57('cap-edge', 0.08), MIC('mics.r121', 'cone', 0.15, 1, -3)],
        [M57('cap-edge', 0.08), MIC('mics.md421', 'cone', 0.1, 1, -4)],
        [MIC('mics.m160', 'cone', 0.1, 0), M57('cap-edge', 0.08, 1, -2)],
        [M57('cap-edge', 0.06), MIC('smic.re20', 'cone', 0.12, 1, -4)],
      ]],
    ];
    const MIC_DEFAULT = [[M57('cap-edge', 0.08), MIC('mics.md421', 'cone', 0.1, 1, -4)], [M57('cap-edge', 0.08), MIC('mics.r121', 'cone', 0.15, 1, -3)]];
    const micsFor = (file, tags, d, nth) => {
      const isBass = d.cat === 'Bass Cab';
      const hit = MIC_RECIPES.find(([keys]) => (isBass && keys[0] === 'bass') || keys.some((k) => tags.includes(k)));
      const set = hit ? hit[1] : MIC_DEFAULT;
      // the n-th cab in a preset takes the next variant, so dual-cab rigs get two different pairs
      return set[(hashOf(file) + nth) % set.length].map((m) => Object.assign({}, m));
    };
    const problems = [];
    const COLORS = ['#e8473d', '#f39c12', '#f1c40f', '#2ecc71', '#3498db', '#6c5ce7', '#e84393', '#1abc9c', '#ecf0f1'];
    const AUX = /^(EXP|CTL|CTRL|MIDI|USB|SEND|RETURN|TUNER|BYPASS|DI OUT|XLR|THRU|DIRECT|LINE OUT|PHONES|B OUT)/i;
    const audioPorts = (N, dir) => (N.d ? (C.portsFor(N.d, N.b.variant)[dir] || []).filter((l) => !AUX.test(l)).length : 1);
    const build = (spec) => {
      let n = 0, cabN = 0;
      const nodes = {};
      const order = [];
      const add = (key, item) => {
        let [type, params = {}, o = {}] = Array.isArray(item) ? item : [item];
        const d = C.getDef(type);
        if (!d || d.missing) problems.push(`${spec.file}: unknown block ${type}`);
        const b = { id: 'b' + ++n, type, x: 0, y: 0, params: {}, bypass: !!o.bypass, variant: 'mono' };
        if (d && d.initParams) Object.assign(b.params, JSON.parse(JSON.stringify(d.initParams)));
        // cabs: mics: [{ model, at, spk, dist, axis, lvl, phase, pan }] or the old mic1 / mic2 type numbers
        // (catalog/cabmics.js applyMicSpec, docs/mic-blocks.md "Presets")
        if (d && d.cabMics) {
          const tags = spec.tags || LOOK_TAGS[spec.file] || [];
          CM.applyMicSpec(b, d, { mics: params.mics || micsFor(spec.file, tags, d, cabN++) });
          params = Object.fromEntries(Object.entries(params).filter(([k]) => !/^mic(s|\d)/.test(k)));
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
      // output trim: on the cab level (0 dB by default, range -24..12); the rest on a gain block at the end
      const isCab = (it) => { const d = C.getDef(Array.isArray(it) ? it[0] : it); return !!(d && d.cabMics); };
      const hasCab = spec.chain ? spec.chain.some(isCab) : Object.values(spec.nodes).some(isCab);
      const cabTrim = hasCab ? Math.max(-24, Math.min(12, spec.trimDb || 0)) : 0;
      const restTrim = +((spec.trimDb || 0) - cabTrim).toFixed(1);
      if (restTrim && !spec.chain) problems.push(`${spec.file}: no place for ${restTrim} dB trim`);
      if (spec.chain) {
        const items = spec.chain.slice();
        // the gain block goes before a level meter at the end, so the meter shows the final level
        if (restTrim) items.splice([].concat(items[items.length - 1])[0] === 'tz.meter' ? items.length - 1 : items.length, 0, ['@trim']);
        const keys = [];
        // stereo once a block outputs stereo; 'both' blocks downstream follow
        let st = false;
        let prev = 'in';
        for (const it of items) {
          const k = add('n' + keys.length, [].concat(it)[0] !== '@trim' ? it : [st ? 'ut.width' : 'ut.gain', { '=level': restTrim }]);
          keys.push(k);
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
      if (cabTrim) for (const k of order) if (nodes[k].d && nodes[k].d.cabMics) nodes[k].b.params.level = Math.max(-24, Math.min(12, +((nodes[k].b.params.level || 0) + cabTrim).toFixed(1)));
      return { version: 1, name: spec.name, tags: spec.tags || [], desc: spec.desc || '', factory: true, order: spec.order || 0, blocks, cables, view: null };
    };
    // ---- pedalboard: size, jacks and plug reach of each block from its real drawing
    const measure = (b) => {
      const d = C.getDef(b.type);
      try {
        const rdef = Object.create(d);
        rdef.ports = C.portsFor(d, b.variant || 'mono');
        const r = renderForm({ g: svg('g'), views: new Map(), flip: false, thumb: true }, rdef);
        if (r && r.w > 0) return { d, w: Math.round(r.w), h: Math.round(r.h), jacks: r.jacks || [] };
      } catch (e) { /* fall back to the plain size */ }
      const [w, h] = sizeOf(d);
      return { d, w, h, jacks: [] };
    };
    const boardify = (file, p) => {
      p.blocks = p.blocks.filter((b) => !(C.getDef(b.type) || {}).pedalboard);
      const info = p.blocks.filter((b) => !b.type.startsWith('__')).map((b) => {
        const m = measure(b);
        return Object.assign(m, { b, f: PB.boardFootprint(m.w, m.h, m.jacks), on: PB.boardable(m.d, m.w, m.h) });
      });
      const on = info.filter((i) => i.on);
      if (on.length < 3) return p;
      const plan = PB.planBoard(on);
      if (!plan) { problems.push(`${file}: ${on.length} pedals don't fit on a board`); return p; }
      const pd = C.getDef('pb.' + plan.key).pedalboard, sz = PB.boardSize(pd), S = PB.BOARD_SLOT;
      const bx = -sz.w, by = 0;
      on.forEach((it, i) => { it.b.x = bx + plan.pos[i].x; it.b.y = by + plan.pos[i].y; });
      // behind the board: amps (heads stacked on their cabs), cabs and floor units, right to left, standing on
      // one line and centred over the board
      const offs = info.filter((i) => !i.on), units = [];
      for (let i = 0; i < offs.length; i++) {
        const a = offs[i], c = offs[i + 1];
        if (a.d.baseForm === 'amp' && !a.d.combo && c && c.d.baseForm === 'cab') {
          const W = Math.max(a.w, c.w);
          units.push({ w: W, h: a.h + 14 + c.h, put: (x, y) => { a.b.x = Math.round(x + (W - a.w) / 2); a.b.y = y; c.b.x = Math.round(x + (W - c.w) / 2); c.b.y = y + a.h + 14; } });
          i++;
        } else units.push({ w: a.w, h: a.h, put: (x, y) => { a.b.x = Math.round(x); a.b.y = y; } });
      }
      const GAP = 80, rowW = units.reduce((t, u) => t + u.w, 0) + GAP * Math.max(0, units.length - 1);
      let x = rowW < sz.w ? -(sz.w - rowW) / 2 : 0;
      for (const u of units) { x -= u.w; u.put(x, by - 170 - u.h); x -= GAP; }
      // input on the right of the first row, output left of the row the chain ends on
      const last = p.blocks.filter((b) => !b.type.startsWith('__')).pop();
      const lastOn = on.findIndex((i) => i.b === last);
      const endRow = lastOn >= 0 ? Math.floor((plan.pos[lastOn].y - S.padY + 20) / S.h) : 0;
      for (const b of p.blocks) {
        if (b.type === '__in') { b.x = 90; b.y = by + S.padY + S.h / 2 - 110; }
        if (b.type === '__out') { b.x = bx - 260; b.y = by + S.padY + endRow * S.h + S.h / 2 - 110; }
      }
      // the pedals remember their board, so a board moved over this one can't take them
      for (const it of on) it.b.board = 'board1';
      p.blocks.unshift({ id: 'board1', type: 'pb.' + plan.key, x: bx, y: by, params: boardLook(file, [...(p.tags || []), ...(LOOK_TAGS[file] || [])]) });
      return p;
    };
    const res = specs.map((s) => ({ file: s.file, preset: boardify(s.file, build(s)) }));
    // hand-made presets: re-mike their cabs the same way
    for (const e of extra) {
      let nth = 0;
      for (const b of e.preset.blocks) {
        const d = C.getDef(b.type);
        if (d && d.cabMics) CM.applyMicSpec(b, d, { mics: micsFor(e.file, e.preset.tags && e.preset.tags.length ? e.preset.tags : LOOK_TAGS[e.file] || [], d, nth++) });
      }
      res.push({ file: e.file, preset: boardify(e.file, e.preset) });
    }
    // validate: load each into the engine graph builder
    for (const r of res) {
      try {
        window.__tz.buildGraph(r.preset);
      } catch (e) {
        problems.push(`${r.file}: graph error ${e.message}`);
      }
    }
    return { res, problems };
  }, [specs, extra]);
  if (out.problems.length) console.log('PROBLEMS\n' + out.problems.join('\n'));
  if (!check) {
    for (const r of out.res) fs.writeFileSync(path.join(dir, r.file + '.json'), JSON.stringify(r.preset, null, 1));
    console.log('wrote', out.res.length, 'presets');
  }
  if (errs.length) console.log(errs.join('\n'));
  await app.close();
})();
