// Built-in Tone Zone plugin: Neural DSP.
// "Quad Neuron", inspired by the Neural DSP Quad Cortex: touchscreen with a 4 x 8 block grid (rows 1A/1B are
// path 1, 2A/2B path 2, rows of one path run in parallel), model picker, sliders, presets, settings, gig view,
// tuner and eleven footswitches with LED rings (PRESET / SCENE / STOMP modes, bank, MODE / TUNER).
// Names and artwork are Tone Zone originals.
import { createKit, CATS, modelsIn, pText } from './mfx-kit.js';

export default function register(tz) {
  const kit = createKit(tz);
  const { K, FOOT, SCREEN, def, db } = tz.helpers;
  const { svg, label, formKit, setA, setText } = tz.gfx;
  const ID = 'ndsp.quadneuron';
  const ROWS = 4, COLS = 8, N = ROWS * COLS;
  const FONT = "'Inter', 'Helvetica Neue', Helvetica, Arial, sans-serif";
  const COL = { dist: '#ff7a1a', dyn: '#ffc400', eq: '#8a96a8', mod: '#1fc7b6', dly: '#3c8dff', rev: '#9b59ff', pitch: '#7cdb44', filter: '#ff4fa0', wah: '#ff9d4f', vol: '#88c0d0', amp: '#e5484d', ampo: '#e5484d', cab: '#c4785b' };
  const CATL = ['amp', 'ampo', 'cab', 'dist', 'dyn', 'eq', 'mod', 'dly', 'rev', 'pitch', 'filter', 'wah', 'vol'];
  const MODES = ['PRESET', 'SCENE', 'STOMP'];
  const FSN = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', '▲', '▼', 'MODE'];
  const SCOL = ['#ff5f57', '#ffbd2e', '#28c840', '#3c8dff', '#9b59ff', '#1fc7b6', '#ff4fa0', '#e8e8e8'];
  const ROWN = ['1A', '1B', '2A', '2B'];
  const rc = (i) => [Math.floor((i - 1) / COLS), (i - 1) % COLS];
  const idx = (r, c) => r * COLS + c + 1;
  const pName = (k) => `${Math.floor(k / 8) + 1}${'ABCDEFGH'[k % 8]}`;
  const short = (m) => (m ? m.n.replace(/ (Lead|Nrm|Brt|Hot)$/, '').slice(0, 9) : '');

  // ---------------------------------------------------------------- routing: path 1 = rows 1A/1B, path 2 = rows 2A/2B
  function layout(u) {
    const row = (r) => { const p = []; for (let c = 0; c < COLS; c++) if (kit.slotModel(u, idx(r, c))) p.push(idx(r, c)); return p; };
    const steps = [];
    for (const [a, b] of [[0, 1], [2, 3]]) {
      const ra = row(a), rb = row(b);
      if (ra.length && rb.length) steps.push({ par: [ra, rb] });
      else steps.push(...ra, ...rb);
    }
    return steps;
  }
  const S = (r, c) => idx(r, c);
  const presets = [
    { name: 'Modern Crunch', slots: { [S(0, 0)]: ['gate', { threshold: 0.35 }], [S(0, 1)]: ['scream', { gain: 0.2, level: 0.7 }, true], [S(0, 2)]: ['a-jcm'], [S(0, 3)]: ['c-4x12t75'], [S(0, 4)]: ['plasti', {}, true], [S(0, 5)]: ['simple', { mix: 0.2 }], [S(0, 6)]: ['plate', { mix: 0.2 }] } },
    { name: 'Glass Clean', slots: { [S(0, 0)]: ['dlxcomp'], [S(0, 1)]: ['a-ustwin'], [S(0, 2)]: ['c-2x12twin'], [S(0, 3)]: ['trinity', { mix: 0.45 }], [S(0, 4)]: ['adriatic', { mix: 0.25 }], [S(0, 5)]: ['hall', { mix: 0.3 }] } },
    { name: 'Djent Machine', slots: { [S(0, 0)]: ['gate', { threshold: 0.5 }], [S(0, 1)]: ['scream', { gain: 0.05, level: 0.8 }], [S(0, 2)]: ['a-uber'], [S(0, 3)]: ['c-4x12uber'], [S(0, 4)]: ['paraeq', { lowcut: 80 }], [S(0, 5)]: ['room', { mix: 0.1 }] } },
    { name: 'Wet / Dry Split', slots: { [S(0, 0)]: ['a-plexi'], [S(0, 1)]: ['c-4x12gb'], [S(2, 0)]: ['simple', { mix: 1, time: 380 }], [S(2, 1)]: ['hall', { mix: 1 }], [S(3, 0)]: ['gain', { level: -2 }] } },
    { name: 'Blues Breaker', slots: { [S(0, 0)]: ['teemah'], [S(0, 1)]: ['a-dumble'], [S(0, 2)]: ['c-1x12open'], [S(0, 3)]: ['tape', { mix: 0.2 }], [S(0, 4)]: ['spring', { mix: 0.25 }] } },
    { name: 'Synth Lead', slots: { [S(0, 0)]: ['synthlead'], [S(0, 1)]: ['a-recto', { 'a.gain': 0.35 }], [S(0, 2)]: ['c-4x12v30'], [S(0, 3)]: ['pingpong', { mix: 0.3 }], [S(0, 4)]: ['shimmer', { mix: 0.3 }] } },
    { name: 'Dual Amp Blend', slots: { [S(0, 0)]: ['a-ac30'], [S(0, 1)]: ['c-2x12blue'], [S(1, 0)]: ['a-5150', { 'a.gain': 0.35 }], [S(1, 1)]: ['c-4x12v30'], [S(2, 0)]: ['dual', { mix: 0.25 }], [S(2, 1)]: ['ganymede', { mix: 0.25 }] } },
    { name: 'Bass DI + Amp', slots: { [S(0, 0)]: ['redsq'], [S(0, 1)]: ['a-svt'], [S(0, 2)]: ['c-8x10svt'], [S(1, 0)]: ['lowhicut', { lowcut: 30, highcut: 5000 }] } },
  ];
  const SETTINGS = [
    { n: 'Input 1 Gate', p: '_gate', opts: ['Off', 'On'] },
    { n: 'Gate Threshold', p: '_gateT', d: 0.4, min: 0, max: 1, step: 0.05, f: (v) => Math.round(v * 100) + '%' },
    { n: 'Scene Edits', p: '_snapEdit', d: 1, opts: ['Discard', 'Keep'] },
    { n: 'Tempo Sync Delays', p: '_tapSync', d: 1, opts: ['Off', 'On'] },
    { n: 'Tuner Reference', p: '_tref', d: 440, min: 425, max: 455, step: 1, f: (v) => v + ' Hz' },
    { n: 'Mute When Tuning', p: '_tmute', d: 1, opts: ['Off', 'On'] },
    { n: 'Out 1 Level', p: '_vol', d: 0, min: -30, max: 6, step: 0.5, f: (v) => (v > 0 ? '+' : '') + v.toFixed(1) + ' dB' },
  ];
  const B = (id) => kit.blk(id);
  const U = (id) => kit.ui(B(id));
  const blocksInOrder = (u) => { const r = []; for (let i = 1; i <= N; i++) if (kit.slotModel(u, i)) r.push(i); return r; };

  // ---------------------------------------------------------------- footswitches
  function footswitch(id, k, down) {
    const n = kit.nav(id);
    n.fsMode = n.fsMode ?? 1;
    n.bank = n.bank ?? Math.floor((U(id)._preset | 0) / 8);
    if (k === 10) return kit.press(id + '|mode', down, { tap: () => { if (n.view === 'tuner') return kit.tuner(id, false); n.fsMode = (n.fsMode + 1) % 3; kit.say(id, MODES[n.fsMode] + ' MODE'); }, hold: () => kit.tuner(id), ms: 700 });
    if (!down) return;
    if (n.view === 'tuner') return kit.tuner(id, false);
    const u = U(id);
    if (k === 8 || k === 9) {
      const d = k === 8 ? 1 : -1;
      if (n.fsMode === 0) { n.bank = (n.bank + d + 4) % 4; kit.say(id, 'BANK ' + (n.bank + 1)); }
      else kit.loadPreset(id, ((u._preset | 0) + d + 32) % 32);
      return;
    }
    if (n.fsMode === 0) kit.loadPreset(id, n.bank * 8 + k);
    else if (n.fsMode === 1) kit.recallSnap(id, k);
    else { const s = blocksInOrder(u)[k]; if (s) { kit.toggleSlot(id, s); kit.selectSlot(id, s); } }
  }
  function fsInfo(id, u, n, k) {
    const mode = n.fsMode ?? 1;
    if (k === 10) return { t: MODES[mode], c: '#ffffff', lit: true };
    if (k === 8 || k === 9) return { t: mode === 0 ? (k === 8 ? 'BANK UP' : 'BANK DOWN') : k === 8 ? 'PRESET UP' : 'PRESET DN', c: '#9aa0aa', lit: false };
    if (mode === 0) { const bank = n.bank ?? Math.floor((u._preset | 0) / 8); const p = bank * 8 + k; return { t: kit.presetName(B(id), p).slice(0, 12), c: '#e8e8e8', lit: (u._preset | 0) === p }; }
    if (mode === 1) return { t: 'Scene ' + 'ABCDEFGH'[k], c: SCOL[k], lit: (u._snap | 0) === k };
    const s = blocksInOrder(u)[k]; const m = s && kit.slotModel(u, s);
    return m ? { t: short(m), c: COL[m.cat], lit: kit.slotOn(u, s) } : { t: '', c: '#333', lit: false };
  }

  // ---------------------------------------------------------------- touchscreen
  const T = (g, x, y, s, o = {}) => kit.svgT(g, x, y, s, Object.assign({ font: FONT, weight: 500, fill: '#f2f2f2' }, o));
  const show = (el, on) => setA(el, 'display', on ? 'inline' : 'none');
  const CX = (c) => 30 + c * 34.5, CYY = (r) => 31 + r * 22.5;
  const TABX = [124, 152, 180];
  const PX = (k) => 22 + k * 66;
  tz.addScreen('qn-touch', {
    build(s, g, w, h) {
      s.w = w; s.h = h;
      svg('rect', { width: w, height: h, fill: '#0d0e10' }, g);
      // top bar
      svg('rect', { width: w, height: 16, fill: '#16171a' }, g);
      s.pre = T(g, 5, 8, '', { size: 6.6, weight: 600 });
      s.tabs = MODES.map((m, k) => ({ r: svg('rect', { x: TABX[k] - 13, y: 3, width: 26, height: 10, rx: 5, fill: '#2a2c31' }, g), t: T(g, TABX[k], 8.2, m, { size: 4.4, weight: 600, anchor: 'middle' }) }));
      s.gear = T(g, 214, 8, '⚙', { size: 8, anchor: 'middle', fill: '#c9ccd2' });
      s.tunI = T(g, 234, 8.2, 'TUNER', { size: 4.2, anchor: 'middle', weight: 600, fill: '#c9ccd2' });
      s.gigI = T(g, 254, 8.2, 'GIG', { size: 4.2, anchor: 'middle', weight: 600, fill: '#c9ccd2' });
      s.bpm = T(g, w - 4, 8.2, '', { size: 4.6, anchor: 'end', fill: '#9aa0aa' });
      // grid
      const G = (s.grid = svg('g', {}, g));
      for (let r = 0; r < ROWS; r++) {
        svg('line', { x1: 18, x2: w - 6, y1: CYY(r), y2: CYY(r), stroke: '#24262b', 'stroke-width': 1 }, G);
        T(G, 8, CYY(r), ROWN[r], { size: 4.4, anchor: 'middle', fill: '#5c6068', weight: 600 });
      }
      s.split = svg('path', { d: '', stroke: '#8a8f99', 'stroke-width': 0.8, fill: 'none' }, G);
      s.cells = [];
      for (let i = 1; i <= N; i++) {
        const [r, c] = rc(i), x = CX(c), y = CYY(r);
        const plus = svg('circle', { cx: x, cy: y, r: 2.4, fill: '#1c1e22', stroke: '#33363c', 'stroke-width': 0.6 }, G);
        const box = svg('rect', { x: x - 15, y: y - 9, width: 30, height: 18, rx: 4, fill: '#333' }, G);
        const t = T(G, x, y + 0.4, '', { size: 4.3, anchor: 'middle', weight: 600, fill: '#0d0e10' });
        const sel = svg('rect', { x: x - 17, y: y - 11, width: 34, height: 22, rx: 5.5, fill: 'none', stroke: '#ffffff', 'stroke-width': 1.1, 'stroke-opacity': 0 }, G);
        s.cells.push({ plus, box, t, sel });
      }
      // parameter strip
      const P = (s.panel = svg('g', {}, g));
      svg('rect', { x: 0, y: 116, width: w, height: h - 116, fill: '#141518' }, P);
      s.mName = T(P, 6, 123, '', { size: 6.4, weight: 600 });
      s.onPill = svg('rect', { x: w - 46, y: 118, width: 40, height: 10, rx: 5, fill: '#28c840' }, P);
      s.onT = T(P, w - 26, 123.2, '', { size: 4.6, weight: 700, anchor: 'middle', fill: '#0d0e10' });
      s.pgT = T(P, w - 54, 123.2, '', { size: 4.4, anchor: 'end', fill: '#9aa0aa' });
      T(P, 7, 141, '‹', { size: 10, anchor: 'middle', fill: '#9aa0aa' });
      T(P, w - 7, 141, '›', { size: 10, anchor: 'middle', fill: '#9aa0aa' });
      s.prm = [0, 1, 2, 3].map((k) => {
        const x = PX(k);
        const nm = T(P, x, 133, '', { size: 4.6, fill: '#9aa0aa' });
        const vl = T(P, x + 60, 133, '', { size: 4.8, anchor: 'end', weight: 600 });
        svg('rect', { x, y: 139, width: 60, height: 6, rx: 3, fill: '#24262b' }, P);
        const bar = svg('rect', { x, y: 139, width: 0, height: 6, rx: 3, fill: '#3c8dff' }, P);
        return { nm, vl, bar };
      });
      // model picker
      const MP = (s.pick = svg('g', {}, g));
      svg('rect', { y: 16, width: w, height: h - 16, fill: '#0d0e10' }, MP);
      svg('rect', { y: 16, width: 78, height: h - 16, fill: '#141518' }, MP);
      s.pickT = T(MP, 84, 22.5, '', { size: 5, fill: '#9aa0aa' });
      s.rem = svg('rect', { x: w - 62, y: 18.5, width: 32, height: 9, rx: 4.5, fill: '#3a1d1f' }, MP);
      T(MP, w - 46, 23.2, 'REMOVE', { size: 4.2, weight: 700, anchor: 'middle', fill: '#ff8a8a' });
      T(MP, w - 12, 23, '✕', { size: 7, anchor: 'middle', fill: '#c9ccd2' });
      s.pc = CATL.map((c, k) => {
        const y = 19 + k * 10.1;
        const hl = svg('rect', { x: 2, y, width: 74, height: 9.4, rx: 2, fill: '#2a2c31', 'fill-opacity': 0 }, MP);
        svg('circle', { cx: 8, cy: y + 4.7, r: 2.2, fill: COL[c] }, MP);
        const t = T(MP, 14, y + 4.9, CATS[c].n, { size: 4.8 });
        return { hl, t };
      });
      s.pm = [];
      for (let k = 0; k < 22; k++) {
        const x = 84 + (k >= 11 ? 108 : 0), y = 30 + (k % 11) * 11;
        const r = svg('rect', { x, y, width: 104, height: 10, rx: 3, fill: '#1b1d21' }, MP);
        const t = T(MP, x + 5, y + 5.2, '', { size: 4.8 });
        s.pm.push({ r, t });
      }
      // list views (settings, presets)
      const L = (s.list = svg('g', {}, g));
      s.lt = T(L, 6, 23, '', { size: 6, weight: 600 });
      s.rows = [];
      for (let k = 0; k < 8; k++) {
        const y = 29 + k * 15;
        const r = svg('rect', { x: 4, y, width: w - 8, height: 13, rx: 3.5, fill: '#17181b' }, L);
        const t = T(L, 10, y + 6.6, '', { size: 5.4 });
        const v = T(L, w - 38, y + 6.6, '', { size: 5.2, anchor: 'middle', weight: 600, fill: '#c9ccd2' });
        const mi = T(L, w - 60, y + 6.6, '−', { size: 7, anchor: 'middle', fill: '#9aa0aa' });
        const pl = T(L, w - 14, y + 6.6, '+', { size: 7, anchor: 'middle', fill: '#9aa0aa' });
        s.rows.push({ r, t, v, mi, pl });
      }
      s.tiles = [];
      for (let k = 0; k < 16; k++) {
        const x = 6 + (k % 4) * 72, y = 30 + Math.floor(k / 4) * 30;
        const r = svg('rect', { x, y, width: 68, height: 26, rx: 5, fill: '#17181b', stroke: '#2a2c31', 'stroke-width': 0.8 }, L);
        const a = T(L, x + 5, y + 7, '', { size: 4.4, fill: '#9aa0aa', weight: 600 });
        const t = T(L, x + 5, y + 17, '', { size: 5.4, weight: 600 });
        s.tiles.push({ r, a, t });
      }
      // gig view
      const GV = (s.gig = svg('g', {}, g));
      s.gT = T(GV, w / 2, 34, '', { size: 15, weight: 700, anchor: 'middle' });
      s.gS = T(GV, w / 2, 50, '', { size: 6, anchor: 'middle', fill: '#9aa0aa' });
      s.gt = [];
      for (let k = 0; k < 10; k++) {
        const top = k >= 5, col = k % 5;
        const x = 6 + col * 58, y = top ? 60 : 104;
        const r = svg('rect', { x, y, width: 54, height: 38, rx: 6, fill: '#17181b', stroke: '#333', 'stroke-width': 1 }, GV);
        const t = T(GV, x + 27, y + 22, '', { size: 6, weight: 700, anchor: 'middle' });
        const l = T(GV, x + 6, y + 8, '', { size: 4.6, fill: '#9aa0aa', weight: 700 });
        s.gt.push({ r, t, l });
      }
      // tuner
      const TU = (s.tun = svg('g', {}, g));
      svg('rect', { y: 16, width: w, height: h - 16, fill: '#0d0e10' }, TU);
      s.tn = T(TU, w / 2, 64, '', { size: 40, weight: 700, anchor: 'middle' });
      svg('rect', { x: 30, y: 104, width: w - 60, height: 4, rx: 2, fill: '#24262b' }, TU);
      svg('rect', { x: w / 2 - 0.6, y: 98, width: 1.2, height: 16, fill: '#28c840' }, TU);
      s.tdot = svg('circle', { cx: w / 2, cy: 106, r: 5, fill: '#ff5f57' }, TU);
      s.tc = T(TU, w / 2, 126, '', { size: 6.4, anchor: 'middle', fill: '#9aa0aa' });
      T(TU, w / 2, 142, 'tap anywhere to close', { size: 4.8, anchor: 'middle', fill: '#5c6068' });
      s.toast = svg('g', { display: 'none' }, g);
      svg('rect', { x: w / 2 - 56, y: 60, width: 112, height: 18, rx: 9, fill: '#f2f2f2' }, s.toast);
      s.toastT = T(s.toast, w / 2, 69, '', { size: 6.6, anchor: 'middle', weight: 600, fill: '#0d0e10' });
      s.sig = '';
    },
    update(s, st, nv, now) {
      const b = nv.block, id = b.id, u = s.ui, n = kit.nav(id), w = s.w;
      n.fsMode = n.fsMode ?? 1;
      const lv = kit.live.get(id);
      if (lv) for (let k = 0; k < 11; k++) {
        const fi = fsInfo(id, u, n, k);
        setA(lv.rings[k], 'stroke', fi.c);
        setA(lv.rings[k], 'stroke-opacity', fi.lit ? 1 : 0.2);
        setText(lv.labels[k], fi.t);
        setA(lv.labels[k], 'fill', fi.lit ? fi.c : '#8d929b');
      }
      const ton = n.msg && now - n.msgT < 1300;
      show(s.toast, ton);
      if (ton) setText(s.toastT, n.msg);
      const v = n.view;
      show(s.grid, v === 'home'); show(s.panel, v === 'home'); show(s.pick, v === 'models'); show(s.list, v === 'settings' || v === 'presets');
      show(s.gig, v === 'play'); show(s.tun, v === 'tuner');
      if (v === 'tuner') {
        const t = st && st.tu && st.tu.tuner;
        const c = t && t.note ? t.cents : 0;
        setText(s.tn, t && t.note ? t.note : '-');
        setA(s.tdot, 'cx', (w / 2 + (Math.max(-50, Math.min(50, c)) / 50) * (w / 2 - 30)).toFixed(1));
        setA(s.tdot, 'fill', t && t.note && Math.abs(c) < 2 ? '#28c840' : '#ff5f57');
        setText(s.tc, t && t.note ? `${c >= 0 ? '+' : ''}${c.toFixed(1)} cents · ${t.freq ? t.freq.toFixed(1) : ''} Hz` : `${u._tref ?? 440} Hz reference`);
      }
      const sig = n.rev + v + n.sel + '|' + n.page + '|' + n.cat + '|' + n.fsMode + JSON.stringify(b.params) + (b.mfx ? b.mfx.name : '');
      if (sig === s.sig) return;
      s.sig = sig;
      setText(s.pre, `${pName(u._preset | 0)}  ${kit.presetName(b)}`);
      s.tabs.forEach((e, k) => { setA(e.r, 'fill', k === n.fsMode ? '#f2f2f2' : '#2a2c31'); setA(e.t, 'fill', k === n.fsMode ? '#0d0e10' : '#c9ccd2'); });
      setText(s.bpm, `${Math.round(u._bpm ?? 120)} BPM`);
      setA(s.tunI, 'fill', v === 'tuner' ? '#28c840' : '#c9ccd2');
      setA(s.gigI, 'fill', v === 'play' ? '#28c840' : '#c9ccd2');
      if (v === 'home') {
        // path split / merge marks
        let d = '';
        for (const [a, bb] of [[0, 1], [2, 3]]) {
          const has = (r) => { for (let c = 0; c < COLS; c++) if (kit.slotModel(u, idx(r, c))) return true; return false; };
          if (has(a) && has(bb)) d += `M18 ${CYY(a)} V${CYY(bb)} M${w - 8} ${CYY(a)} V${CYY(bb)}`;
        }
        setA(s.split, 'd', d);
        s.cells.forEach((e, k) => {
          const i = k + 1, m = kit.slotModel(u, i), on = kit.slotOn(u, i);
          show(e.box, !!m); show(e.t, !!m); show(e.plus, !m);
          if (m) {
            setA(e.box, 'fill', on ? COL[m.cat] : '#2a2c31');
            setText(e.t, short(m));
            setA(e.t, 'fill', on ? '#0d0e10' : '#8d929b');
          }
          setA(e.sel, 'stroke-opacity', i === n.sel ? 1 : 0);
        });
        const m = kit.slotModel(u, n.sel);
        const [r, c] = rc(n.sel);
        setText(s.mName, m ? m.n : `${ROWN[r]} · ${c + 1}  -  tap to add a block`);
        show(s.onPill, !!m); show(s.onT, !!m);
        if (m) { const on = kit.slotOn(u, n.sel); setA(s.onPill, 'fill', on ? '#28c840' : '#3a3d44'); setText(s.onT, on ? 'ON' : 'BYPASSED'); setA(s.onT, 'fill', on ? '#0d0e10' : '#c9ccd2'); }
        const np = kit.pages(u, n.sel, 4);
        setText(s.pgT, m && np > 1 ? `${n.page + 1}/${np}` : '');
        s.prm.forEach((e, k) => {
          const j = n.page * 4 + k, p = m && m.P[j];
          const pos = p ? kit.slotPos(u, n.sel, j, m) : 0;
          setText(e.nm, p ? p.n : '');
          setText(e.vl, p ? pText(p, pos) : '');
          setA(e.bar, 'width', p ? (60 * pos).toFixed(1) : 0);
          setA(e.bar, 'fill', m ? COL[m.cat] : '#3c8dff');
        });
      } else if (v === 'models') {
        const [r, c] = rc(n.sel);
        setText(s.pickT, `Block ${ROWN[r]} · ${c + 1}${kit.slotModel(u, n.sel) ? '  -  ' + kit.slotModel(u, n.sel).n : ''}`);
        const cur = kit.slotModel(u, n.sel);
        s.pc.forEach((e, k) => { const on = CATL[k] === n.cat; setA(e.hl, 'fill-opacity', on ? 1 : 0); setA(e.t, 'fill', on ? '#ffffff' : '#9aa0aa'); });
        const list = modelsIn(n.cat);
        s.pm.forEach((e, k) => {
          const m = list[k];
          show(e.r, !!m); show(e.t, !!m);
          if (!m) return;
          const on = cur && cur.idx === m.idx;
          setText(e.t, m.n);
          setA(e.r, 'fill', on ? COL[m.cat] : '#1b1d21');
          setA(e.t, 'fill', on ? '#0d0e10' : '#e8e8e8');
        });
      } else if (v === 'settings') {
        setText(s.lt, 'Settings');
        s.tiles.forEach((e) => { show(e.r, false); show(e.a, false); show(e.t, false); });
        s.rows.forEach((e, k) => {
          const row = SETTINGS[k];
          for (const el of [e.r, e.t, e.v, e.mi, e.pl]) show(el, !!row);
          if (!row) return;
          setText(e.t, row.n);
          setText(e.v, kit.setText(row, u));
        });
      } else if (v === 'presets') {
        setText(s.lt, 'Presets');
        s.rows.forEach((e) => { for (const el of [e.r, e.t, e.v, e.mi, e.pl]) show(el, false); });
        s.tiles.forEach((e, k) => {
          for (const el of [e.r, e.a, e.t]) show(el, true);
          const cur = (u._preset | 0) === k;
          setText(e.a, pName(k));
          setText(e.t, kit.presetName(b, k).slice(0, 14));
          setA(e.r, 'fill', cur ? '#f2f2f2' : '#17181b');
          setA(e.t, 'fill', cur ? '#0d0e10' : '#f2f2f2');
        });
      } else if (v === 'play') {
        setText(s.gT, kit.presetName(b));
        setText(s.gS, `${pName(u._preset | 0)} · ${MODES[n.fsMode]} MODE · Scene ${'ABCDEFGH'[u._snap | 0]}`);
        const order = [0, 1, 2, 3, 9, 4, 5, 6, 7, 8]; // bottom row A-D ▼, top row E-H ▲
        s.gt.forEach((e, k) => {
          const f = order[k];
          const fi = fsInfo(id, u, n, f);
          setText(e.t, fi.t); setText(e.l, FSN[f]);
          setA(e.r, 'stroke', fi.c);
          setA(e.r, 'fill', fi.lit ? fi.c : '#17181b');
          setA(e.t, 'fill', fi.lit ? '#0d0e10' : '#f2f2f2');
        });
      }
    },
    pointer(s, nv, type, pt, e) {
      const id = nv.block.id, n = kit.nav(id), w = s.w, u = s.ui;
      const v = n.view;
      if (type === 'move' && s.drag) {
        const dx = pt.x - s.drag.x0;
        kit.setPos(id, n.sel, s.drag.j, s.drag.p0 + dx / 60);
        kit.syncKnobs(id);
        return;
      }
      if (type === 'up') { s.drag = null; return; }
      if (type === 'wheel' && v === 'home' && pt.y > 128) {
        const k = Math.floor((pt.x - 16) / 66);
        if (k >= 0 && k < 4) kit.stepParam(id, n.sel, n.page * 4 + k, e.deltaY < 0 ? 1 : -1);
        return;
      }
      if (type === 'dbl' && v === 'home' && pt.y > 16 && pt.y < 112) {
        const c = Math.round((pt.x - 30) / 34.5), r = Math.round((pt.y - 31) / 22.5);
        if (r >= 0 && r < ROWS && c >= 0 && c < COLS) { kit.toggleSlot(id, idx(r, c)); n.view = 'home'; }
        return;
      }
      if (type !== 'down') return;
      // top bar
      if (pt.y < 16) {
        if (pt.x < 108) { n.view = v === 'presets' ? 'home' : 'presets'; }
        else for (let k = 0; k < 3; k++) if (Math.abs(pt.x - TABX[k]) < 13) { n.fsMode = k; kit.say(id, MODES[k] + ' MODE'); }
        if (Math.abs(pt.x - 214) < 8) n.view = v === 'settings' ? 'home' : 'settings';
        else if (Math.abs(pt.x - 234) < 9) kit.tuner(id, v !== 'tuner');
        else if (Math.abs(pt.x - 254) < 8) n.view = v === 'play' ? 'home' : 'play';
        else if (pt.x > w - 26) kit.tap(id);
        kit.bump(id);
        return;
      }
      if (v === 'tuner') return kit.tuner(id, false);
      if (v === 'play') { n.view = 'home'; return kit.bump(id); }
      if (v === 'home') {
        if (pt.y < 112) {
          const c = Math.round((pt.x - 30) / 34.5), r = Math.round((pt.y - 31) / 22.5);
          if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return;
          const i = idx(r, c), m = kit.slotModel(u, i);
          if (!m || n.sel === i) { kit.selectSlot(id, i); n.view = 'models'; n.cat = m ? m.cat : n.cat || 'dist'; }
          else kit.selectSlot(id, i);
        } else if (pt.y < 128) {
          if (pt.x > w - 48) kit.toggleSlot(id, n.sel);
          else if (pt.x < 150 && kit.slotModel(u, n.sel)) { n.view = 'models'; n.cat = kit.slotModel(u, n.sel).cat; }
        } else {
          if (pt.x < 14) kit.page(id, -1);
          else if (pt.x > w - 14) kit.page(id, 1);
          else {
            const k = Math.floor((pt.x - 16) / 66);
            const m = kit.slotModel(u, n.sel);
            if (m && m.P[n.page * 4 + k]) s.drag = { j: n.page * 4 + k, x0: pt.x, p0: kit.slotPos(u, n.sel, n.page * 4 + k, m) };
          }
        }
      } else if (v === 'models') {
        if (pt.y < 30 && pt.x > w - 20) n.view = 'home';
        else if (pt.y < 30 && pt.x > w - 64) { kit.clearSlot(id, n.sel); n.view = 'home'; }
        else if (pt.x < 78) { const k = Math.floor((pt.y - 19) / 10.1); if (CATL[k]) n.cat = CATL[k]; }
        else if (pt.y >= 30) {
          const col = pt.x >= 192 ? 1 : 0, r = Math.floor((pt.y - 30) / 11);
          const m = modelsIn(n.cat)[col * 11 + r];
          if (r >= 0 && r < 11 && m) { kit.setModel(id, n.sel, m.idx); n.view = 'home'; }
        }
      } else if (v === 'settings') {
        const k = Math.floor((pt.y - 29) / 15), row = SETTINGS[k];
        if (row) kit.setStep(id, row, pt.x > w - 50 && pt.x < w - 25 ? 0 : pt.x < w - 50 && pt.x > w - 72 ? -1 : 1);
      } else if (v === 'presets') {
        const c = Math.floor((pt.x - 6) / 72), r = Math.floor((pt.y - 30) / 30);
        if (c >= 0 && c < 4 && r >= 0 && r < 4) { kit.loadPreset(id, r * 4 + c); n.view = 'home'; }
      }
      kit.bump(id);
    },
  });

  // ---------------------------------------------------------------- enclosure
  const W = 520, H = 340;
  // footswitch positions: bottom row A-D + ▼, top row E-H + ▲, MODE beside the screen
  const FP = [[66, 300], [158, 300], [250, 300], [342, 300], [66, 226], [158, 226], [250, 226], [342, 226], [452, 226], [452, 300], [472, 92]];
  tz.addForm('qn-cortex', (ctx, d) => {
    const g = ctx.g;
    formKit.body(g, W, H, '#1a1b1e', { rx: 14 });
    svg('rect', { x: 4, y: 4, width: W - 8, height: 178, rx: 11, fill: '#0f1012' }, g);
    svg('rect', { x: 4, y: 182, width: W - 8, height: 1, fill: '#fff', 'fill-opacity': 0.07 }, g);
    const theme = { text: '#c9ccd2', knob: 'strymon', labelSize: 5.4, labelFont: FONT };
    label(g, 48, 150, 'QUAD', { size: 8, fill: '#e8e8e8', weight: 700, ls: 2.4, font: FONT });
    label(g, 48, 161, 'NEURON', { size: 6, fill: '#9aa0aa', weight: 600, ls: 2, font: FONT });
    formKit.tzBadge(g, 472, 160, '#6c7079', 4);
    label(g, 472, 118, 'MODE · TUNER', { size: 4.6, fill: '#9aa0aa', weight: 700, font: FONT });
    const rings = [], labels = [];
    FP.forEach(([x, y], k) => {
      if (k < 10) {
        svg('rect', { x: x - 34, y: y - 42, width: 68, height: 12, rx: 3, fill: '#050506', stroke: '#26282d', 'stroke-width': 0.7 }, g);
        labels.push(svg('text', { x, y: y - 35.6, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-family': FONT, 'font-weight': 600, 'font-size': 6, fill: '#8d929b', 'pointer-events': 'none' }, g, ''));
        label(g, x - 26, y + 19, FSN[k], { size: 5.4, fill: '#6c7079', weight: 700, font: FONT });
      } else labels.push(svg('text', { x, y, 'font-size': 1, fill: 'none', 'pointer-events': 'none' }, g, ''));
      svg('circle', { cx: x, cy: y, r: 19.5, fill: '#0b0b0c', stroke: '#2c2e33', 'stroke-width': 0.8 }, g);
      rings.push(svg('circle', { cx: x, cy: y, r: 17, fill: 'none', stroke: '#444', 'stroke-width': 2.4, 'stroke-opacity': 0.2 }, g));
    });
    if (ctx.block) kit.live.set(ctx.block.id, { rings, labels });
    formKit.placeControls(ctx, d.controls, theme);
    return { w: W, h: H, theme, jacks: kit.topJacks(d, W, ctx.flip) };
  });
  const controls = [
    SCREEN('qn-touch', { x: 260, y: 92, w: 300, h: 152, interactive: true, bg: '#0d0e10', bezel: '#050506' }),
    K('_vol', 'OUT 1', { x: 48, y: 70, r: 13, min: -30, max: 6, def: 0, virtual: true, display: db, labelPos: 'below' }),
    ...FP.map(([x, y], k) => FOOT({ action: 'mfx', mfx: 'fs', fs: k, style: 'stomp', r: 13, x, y })),
  ];
  const d = def({
    id: ID, name: 'Quad Neuron', ref: 'Neural DSP Quad Cortex', brand: 'Neural DSP', code: 'QUAD NEURON', typeName: 'Touchscreen amp & effects modeler', cat: 'Multi-FX', kind: 'Multi-FX',
    form: 'qn-cortex', color: '#1a1b1e', cost: 7, alwaysOn: true,
    ports: { ins: ['IN 1', 'IN 2', 'RETURN 1', 'RETURN 2'], outs: ['XLR OUT L', 'XLR OUT R', 'OUT 3', 'OUT 4', 'SEND 1', 'SEND 2', 'PHONES'] }, jackKinds: { o0: 'xlr', o1: 'xlr', o6: 'phones' },
    ctrl: { ins: [{ label: 'EXP 1', hook: true, exp: 1 }, { label: 'EXP 2', hook: true, exp: 2 }] },
    controls,
    tags: ['cortex', 'touchscreen', 'scenes', 'modeler', 'grid'],
    desc: 'Touch the screen: tap a cell to add or select a block, drag the bars below to edit it, double-tap to bypass. Rows 1A/1B and 2A/2B run as parallel paths, and the top bar switches preset, scene and stomp modes.',
  });
  kit.register(d, {
    n: N, knobs: 0, sel0: 3, layout, inputGate: true, looper: false, presets, snapWord: 'Scene', snapName: (k) => 'ABCDEFGH'[k],
    foot(id, ctl, down) { footswitch(id, ctl.fs, down); },
  });
  tz.addDefs([d]);
}
