// Screen for the Tone Zone parametric EQ: drag band handles over a live spectrum,
// plus HPF/LPF handles, band solo (listen) and a pre/post analyser switch.
import { svg } from './util.js';
import { registerScreen } from './screens.js';
import { setA, setText } from './gfx/fx.js';
import { state, uiParams, setParam } from './state.js';

export const EQ_BANDS = 6;
export const BAND_COLORS = ['#ff7a2f', '#ffc23c', '#3ddc84', '#37d6c2', '#4aa8ff', '#a98bff'];
const TYPES = ['PEAK', 'LOW SHELF', 'HIGH SHELF', 'NOTCH', 'BAND PASS', 'TILT'];
const SR = 48000;
const F0 = 20, F1 = 20000, GMAX = 18;

// ---- RBJ biquad magnitude in dB, matches the engine's filters
function biquad(type, f0, q, g) {
  const A = Math.pow(10, g / 40), w0 = (2 * Math.PI * f0) / SR, cw = Math.cos(w0), sw = Math.sin(w0), al = sw / (2 * q);
  let b0, b1, b2, a0, a1, a2;
  switch (type) {
    case 'lp': b0 = (1 - cw) / 2; b1 = 1 - cw; b2 = b0; a0 = 1 + al; a1 = -2 * cw; a2 = 1 - al; break;
    case 'hp': b0 = (1 + cw) / 2; b1 = -(1 + cw); b2 = b0; a0 = 1 + al; a1 = -2 * cw; a2 = 1 - al; break;
    case 'bp': b0 = al; b1 = 0; b2 = -al; a0 = 1 + al; a1 = -2 * cw; a2 = 1 - al; break;
    case 'notch': b0 = 1; b1 = -2 * cw; b2 = 1; a0 = 1 + al; a1 = -2 * cw; a2 = 1 - al; break;
    case 'ls': { const s = 2 * Math.sqrt(A) * al; b0 = A * (A + 1 - (A - 1) * cw + s); b1 = 2 * A * (A - 1 - (A + 1) * cw); b2 = A * (A + 1 - (A - 1) * cw - s); a0 = A + 1 + (A - 1) * cw + s; a1 = -2 * (A - 1 + (A + 1) * cw); a2 = A + 1 + (A - 1) * cw - s; break; }
    case 'hs': { const s = 2 * Math.sqrt(A) * al; b0 = A * (A + 1 + (A - 1) * cw + s); b1 = -2 * A * (A - 1 + (A + 1) * cw); b2 = A * (A + 1 + (A - 1) * cw - s); a0 = A + 1 - (A - 1) * cw + s; a1 = 2 * (A - 1 - (A + 1) * cw); a2 = A + 1 - (A - 1) * cw - s; break; }
    default: b0 = 1 + al * A; b1 = -2 * cw; b2 = 1 - al * A; a0 = 1 + al / A; a1 = -2 * cw; a2 = 1 - al / A;
  }
  return (f) => {
    const w = (2 * Math.PI * f) / SR, c1 = Math.cos(w), s1 = Math.sin(w), c2 = Math.cos(2 * w), s2 = Math.sin(2 * w);
    const nr = b0 + b1 * c1 + b2 * c2, ni = -(b1 * s1 + b2 * s2), dr = a0 + a1 * c1 + a2 * c2, di = -(a1 * s1 + a2 * s2);
    return 10 * Math.log10((nr * nr + ni * ni) / (dr * dr + di * di) + 1e-30);
  };
}
const BW = { 0: [0.5], 1: [0.707], 2: [0.541, 1.307], 3: [0.51, 0.601, 0.9, 2.563] };
function bandFn(ui, i) {
  const t = ui[`b${i}type`] | 0, f = ui[`b${i}f`], g = ui[`b${i}g`], q = ui[`b${i}q`];
  const kind = ['peak', 'ls', 'hs', 'notch', 'bp', 'hs'][t];
  return biquad(kind, f, t === 1 || t === 2 ? Math.min(q, 2) : t === 5 ? 0.5 : q, t === 3 || t === 4 ? 0 : g);
}
function filterFn(ui, which) {
  const s = ui[which + 's'] | 0, f = ui[which + 'f'];
  const fns = (BW[s] || BW[1]).map((q) => biquad(which === 'hp' ? 'hp' : 'lp', f, s === 0 ? 0.5 : q, 0));
  return (x) => fns.reduce((a, fn) => a + fn(x), 0);
}

const xOf = (f, w) => (Math.log(f / F0) / Math.log(F1 / F0)) * w;
const fOf = (x, w) => F0 * Math.pow(F1 / F0, Math.max(0, Math.min(1, x / w)));
const fmtF = (f) => (f >= 1000 ? (f / 1000).toFixed(f >= 10000 ? 1 : 2) + ' kHz' : Math.round(f) + ' Hz');

registerScreen('paraeq', {
  build(s, g, w, h) {
    s.w = w; s.h = h;
    s.top = 16; s.bot = h - 14; s.H = s.bot - s.top;
    const yOfG = (gd) => s.top + s.H / 2 - (gd / GMAX) * (s.H / 2);
    s.yOfG = yOfG;
    svg('rect', { width: w, height: h, fill: '#06080c' }, g);
    const grid = svg('g', { opacity: 1 }, g);
    for (const f of [30, 50, 100, 200, 300, 500, 1000, 2000, 3000, 5000, 10000, 20000]) {
      const x = xOf(f, w);
      const major = [100, 1000, 10000].includes(f);
      svg('line', { x1: x, x2: x, y1: s.top, y2: s.bot, stroke: '#fff', 'stroke-opacity': major ? 0.09 : 0.045 }, grid);
      if ([50, 100, 200, 500, 1000, 2000, 5000, 10000].includes(f)) svg('text', { x, y: h - 4, 'text-anchor': 'middle', fill: '#5b6372', 'font-size': 6.5, 'font-family': "'Share Tech Mono', monospace" }, grid, f >= 1000 ? f / 1000 + 'k' : String(f));
    }
    for (const gd of [-12, -6, 0, 6, 12]) {
      const y = yOfG(gd);
      svg('line', { x1: 0, x2: w, y1: y, y2: y, stroke: '#fff', 'stroke-opacity': gd === 0 ? 0.13 : 0.05, 'stroke-dasharray': gd === 0 ? null : '2 3' }, grid);
      svg('text', { x: 3, y: y - 2, fill: '#4b5361', 'font-size': 6, 'font-family': "'Share Tech Mono', monospace" }, grid, (gd > 0 ? '+' : '') + gd);
    }
    // gradients for spectrum + curve fill
    const defs = svg('defs', {}, g);
    const sid = 'eqsg' + Math.random().toString(36).slice(2, 7);
    const lg = svg('linearGradient', { id: sid, x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    svg('stop', { offset: 0, 'stop-color': '#37d6c2', 'stop-opacity': 0.42 }, lg);
    svg('stop', { offset: 1, 'stop-color': '#37d6c2', 'stop-opacity': 0.02 }, lg);
    const cid = 'eqcg' + Math.random().toString(36).slice(2, 7);
    const cg = svg('linearGradient', { id: cid, x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    svg('stop', { offset: 0, 'stop-color': '#ff7a2f', 'stop-opacity': 0.28 }, cg);
    svg('stop', { offset: 0.5, 'stop-color': '#ff7a2f', 'stop-opacity': 0.04 }, cg);
    svg('stop', { offset: 1, 'stop-color': '#ff7a2f', 'stop-opacity': 0.28 }, cg);
    s.specFill = svg('path', { fill: `url(#${sid})`, d: '' }, g);
    s.specLine = svg('path', { fill: 'none', stroke: '#37d6c2', 'stroke-opacity': 0.55, 'stroke-width': 0.8, d: '' }, g);
    s.listenShade = svg('path', { fill: '#000', opacity: 0, d: '' }, g);
    s.listenBox = svg('rect', { y: s.top, height: s.H, fill: '#ffc23c', opacity: 0, rx: 2 }, g);
    s.bandCurve = svg('path', { fill: 'none', stroke: '#fff', 'stroke-opacity': 0.35, 'stroke-width': 1, 'stroke-dasharray': '3 2', d: '' }, g);
    s.curveFill = svg('path', { fill: `url(#${cid})`, d: '' }, g);
    s.curve = svg('path', { fill: 'none', stroke: '#ff9a52', 'stroke-width': 1.8, 'stroke-linejoin': 'round', d: '' }, g);
    // filter handles
    s.fh = ['hp', 'lp'].map((k) => {
      const hg = svg('g', { style: 'cursor: ew-resize' }, g);
      svg('path', { d: k === 'hp' ? 'M-5 4 L0 -5 L5 4 Z' : 'M-5 -4 L0 5 L5 -4 Z', fill: '#c9d1dd', stroke: '#000', 'stroke-width': 0.6 }, hg);
      const t = svg('text', { y: k === 'hp' ? 13 : -8, 'text-anchor': 'middle', 'font-size': 5.6, fill: '#c9d1dd', 'font-family': "'Barlow Condensed', sans-serif", 'font-weight': 700 }, hg, k.toUpperCase() + 'F');
      return { k, g: hg, t };
    });
    // band handles
    s.handles = [];
    for (let i = 1; i <= EQ_BANDS; i++) {
      const hg = svg('g', { style: 'cursor: move' }, g);
      const ring = svg('circle', { r: 8.5, fill: 'none', stroke: BAND_COLORS[i - 1], 'stroke-width': 1.2, opacity: 0 }, hg);
      const dot = svg('circle', { r: 5.6, fill: BAND_COLORS[i - 1], stroke: '#000', 'stroke-width': 0.8 }, hg);
      const num = svg('text', { y: 2.1, 'text-anchor': 'middle', 'font-size': 6, 'font-weight': 800, fill: '#111', 'font-family': "'Inter', sans-serif" }, hg, String(i));
      s.handles.push({ g: hg, ring, dot, num });
    }
    // header: readout + pre/post chip + badges
    svg('rect', { width: w, height: 13, fill: '#0c1016' }, g);
    s.readout = svg('text', { x: 6, y: 9.2, fill: '#c9d1dd', 'font-size': 6.6, 'font-family': "'Share Tech Mono', monospace" }, g, '');
    s.typeChip = svg('text', { x: 6, y: 9.2, fill: '#ffc23c', 'font-size': 6.6, 'font-family': "'Share Tech Mono', monospace", style: 'cursor: pointer' }, g, '');
    s.chipBg = svg('rect', { x: w - 74, y: 2, width: 70, height: 9.5, rx: 4.5, fill: '#1a2029', stroke: '#2a3240' }, g);
    s.chipPre = svg('text', { x: w - 56, y: 9.2, 'text-anchor': 'middle', 'font-size': 6, 'font-weight': 700, 'font-family': "'Inter', sans-serif" }, g, 'PRE');
    s.chipPost = svg('text', { x: w - 22, y: 9.2, 'text-anchor': 'middle', 'font-size': 6, 'font-weight': 700, 'font-family': "'Inter', sans-serif" }, g, 'POST');
    s.chipSel = svg('rect', { x: w - 73, y: 3, width: 34, height: 7.5, rx: 3.75, fill: '#37d6c2', opacity: 0.22 }, g);
    s.badge = svg('text', { x: w - 82, y: 9.2, 'text-anchor': 'end', 'font-size': 6, 'font-weight': 800, fill: '#ffc23c', 'font-family': "'Inter', sans-serif" }, g, '');
    s.sig = '';
  },
  update(s, st, nv) {
    const ui = uiParams(nv.block);
    const id = nv.block.id;
    const sui = (state.ui[id] = state.ui[id] || {});
    const sel = sui.eqSel || 1;
    const w = s.w;
    // LISTEN just switched on: solo the selected band
    const lis = (ui.listen ?? 0) > 0.5;
    if (lis && s.prevListen === false && ui[`b${sel}on`] > 0.5) {
      setParam(id, 'listenf', ui[`b${sel}f`], { silent: true });
      setParam(id, 'listenq', Math.max(0.7, Math.min(8, ui[`b${sel}q`] * 1.2)), { silent: true });
    }
    s.prevListen = lis;
    // spectrum
    const spec = st.spec;
    const specOn = (ui.spectrum ?? 1) > 0.5;
    if (specOn && spec && spec !== s.lastSpec) {
      s.lastSpec = spec;
      const yOfDb = (db) => s.bot - ((Math.max(-96, Math.min(-6, db)) + 96) / 90) * s.H;
      let d = '';
      spec.forEach((db, i) => {
        const f = 20 * Math.pow(1000, (i + 0.5) / spec.length);
        d += (i ? 'L' : 'M') + xOf(f, w).toFixed(1) + ' ' + yOfDb(db).toFixed(1);
      });
      setA(s.specLine, 'd', d);
      setA(s.specFill, 'd', d + `L${w} ${s.bot} L0 ${s.bot} Z`);
    } else if (!specOn && s.lastSpec) {
      s.lastSpec = null;
      setA(s.specLine, 'd', '');
      setA(s.specFill, 'd', '');
    }
    const post = (ui.specpost ?? 1) > 0.5;
    setA(s.chipSel, 'x', post ? w - 39 : w - 73);
    setA(s.chipPre, 'fill', post ? '#6b7385' : '#e9ecf3');
    setA(s.chipPost, 'fill', post ? '#e9ecf3' : '#6b7385');
    setA(s.chipSel, 'opacity', specOn ? 0.22 : 0.06);
    // curve (only when params change)
    const keys = ['hpon', 'hpf', 'hps', 'lpon', 'lpf', 'lps', 'listen', 'listenf', 'listenq'];
    for (let i = 1; i <= EQ_BANDS; i++) keys.push(`b${i}on`, `b${i}type`, `b${i}f`, `b${i}g`, `b${i}q`);
    const sig = keys.map((k) => ui[k]).join('|') + '|' + sel;
    if (sig === s.sig) return;
    s.sig = sig;
    const fns = [];
    for (let i = 1; i <= EQ_BANDS; i++) if (ui[`b${i}on`] > 0.5) fns.push(bandFn(ui, i));
    if (ui.hpon > 0.5) fns.push(filterFn(ui, 'hp'));
    if (ui.lpon > 0.5) fns.push(filterFn(ui, 'lp'));
    let d = '', bd = '';
    const selFn = ui[`b${sel}on`] > 0.5 ? bandFn(ui, sel) : null;
    for (let x = 0; x <= w; x += 2) {
      const f = fOf(x, w);
      const gsum = fns.reduce((a, fn) => a + fn(f), 0);
      d += (x ? 'L' : 'M') + x + ' ' + Math.max(s.top - 4, Math.min(s.bot + 4, s.yOfG(gsum))).toFixed(1);
      if (selFn) bd += (x ? 'L' : 'M') + x + ' ' + Math.max(s.top, Math.min(s.bot, s.yOfG(selFn(f)))).toFixed(1);
    }
    setA(s.curve, 'd', d);
    setA(s.curveFill, 'd', d + `L${w} ${s.yOfG(0)} L0 ${s.yOfG(0)} Z`);
    setA(s.bandCurve, 'd', bd);
    setA(s.bandCurve, 'stroke', BAND_COLORS[sel - 1]);
    // handles
    s.handles.forEach((hd, k) => {
      const i = k + 1;
      const on = ui[`b${i}on`] > 0.5;
      const t = ui[`b${i}type`] | 0;
      const x = xOf(ui[`b${i}f`], w), y = t === 3 || t === 4 ? s.yOfG(0) : s.yOfG(ui[`b${i}g`]);
      setA(hd.g, 'transform', `translate(${x.toFixed(1)},${y.toFixed(1)})`);
      setA(hd.dot, 'fill', on ? BAND_COLORS[k] : '#1b2029');
      setA(hd.dot, 'stroke', on ? '#000' : BAND_COLORS[k]);
      setA(hd.num, 'fill', on ? '#111' : BAND_COLORS[k]);
      setA(hd.ring, 'opacity', i === sel ? 1 : 0);
    });
    s.fh.forEach((f) => {
      const on = ui[f.k + 'on'] > 0.5;
      setA(f.g, 'transform', `translate(${xOf(ui[f.k + 'f'], w).toFixed(1)},${s.yOfG(0).toFixed(1)})`);
      setA(f.g, 'opacity', on ? 1 : 0.35);
    });
    // listen region
    const listen = ui.listen > 0.5;
    if (listen) {
      const fc = ui.listenf, q = ui.listenq;
      const bw = fc / q;
      const xa = xOf(Math.max(F0, fc - bw / 2), w), xb = xOf(Math.min(F1, fc + bw / 2), w);
      setA(s.listenBox, 'x', xa.toFixed(1));
      setA(s.listenBox, 'width', Math.max(2, xb - xa).toFixed(1));
      setA(s.listenBox, 'opacity', 0.12);
      setA(s.listenShade, 'd', `M0 ${s.top} H${xa} V${s.bot} H0 Z M${xb} ${s.top} H${w} V${s.bot} H${xb} Z`);
      setA(s.listenShade, 'opacity', 0.45);
      setText(s.badge, `LISTEN ${fmtF(fc)}`);
    } else {
      setA(s.listenBox, 'opacity', 0);
      setA(s.listenShade, 'opacity', 0);
      setText(s.badge, '');
    }
    // readout of the selected band
    const t = ui[`b${sel}type`] | 0;
    const on = ui[`b${sel}on`] > 0.5;
    setText(s.typeChip, `B${sel} ${TYPES[t]}`);
    const tw = (`B${sel} ${TYPES[t]}`.length + 1) * 3.9;
    setA(s.readout, 'x', (6 + tw).toFixed(1));
    setText(s.readout, `${fmtF(ui[`b${sel}f`])}  ${t === 3 || t === 4 ? '' : (ui[`b${sel}g`] > 0 ? '+' : '') + ui[`b${sel}g`].toFixed(1) + ' dB  '}Q ${ui[`b${sel}q`].toFixed(2)}${on ? '' : '  (off)'}`);
  },
  pointer(s, nv, type, pt, e, editor) {
    const ui = uiParams(nv.block);
    const id = nv.block.id;
    const sui = (state.ui[id] = state.ui[id] || {});
    const w = s.w;
    const fine = e.shiftKey ? 0.25 : 1;
    const nearBand = () => {
      let best = 0, bd = 14;
      for (let i = 1; i <= EQ_BANDS; i++) {
        const t = ui[`b${i}type`] | 0;
        const x = xOf(ui[`b${i}f`], w), y = t === 3 || t === 4 ? s.yOfG(0) : s.yOfG(ui[`b${i}g`]);
        const d = Math.hypot(pt.x - x, pt.y - y);
        if (d < bd) { bd = d; best = i; }
      }
      return best;
    };
    const nearFilter = () => {
      for (const k of ['hp', 'lp']) if (Math.abs(pt.x - xOf(ui[k + 'f'], w)) < 7 && Math.abs(pt.y - s.yOfG(0)) < 12) return k;
      return null;
    };
    if (type === 'down') {
      s.drag = null;
      if (pt.y < 13) {
        if (pt.x > w - 74) setParam(id, 'specpost', (ui.specpost ?? 1) > 0.5 ? 0 : 1);
        else if (pt.x < 70) { const sel = sui.eqSel || 1; setParam(id, `b${sel}type`, (((ui[`b${sel}type`] | 0) + 1) % TYPES.length)); }
        return;
      }
      const b = nearBand();
      if (b) {
        sui.eqSel = b;
        s.drag = { kind: 'band', b, f0: ui[`b${b}f`], g0: ui[`b${b}g`], x0: pt.x, y0: pt.y };
        s.sig = '';
        // listen mode: soloing follows the band you pick
        if (ui.listen > 0.5) { setParam(id, 'listenf', ui[`b${b}f`], { silent: true }); setParam(id, 'listenq', Math.max(0.7, Math.min(8, ui[`b${b}q`] * 1.2)), { silent: true }); }
        return;
      }
      const fk = nearFilter();
      if (fk) { s.drag = { kind: 'filter', k: fk, f0: ui[fk + 'f'], x0: pt.x }; return; }
      if (ui.listen > 0.5) { s.drag = { kind: 'listen' }; setParam(id, 'listenf', Math.round(fOf(pt.x, w)), { silent: true }); return; }
      s.drag = null;
    } else if (type === 'move' && s.drag) {
      const d = s.drag;
      if (d.kind === 'band') {
        const fx = xOf(d.f0, w) + (pt.x - d.x0) * fine;
        setParam(id, `b${d.b}f`, Math.round(Math.max(20, Math.min(20000, fOf(fx, w)))), { silent: true });
        const t = ui[`b${d.b}type`] | 0;
        if (t !== 3 && t !== 4) {
          const gd = d.g0 - ((pt.y - d.y0) / (s.H / 2)) * GMAX * fine;
          setParam(id, `b${d.b}g`, Math.round(Math.max(-GMAX, Math.min(GMAX, gd)) * 10) / 10, { silent: true });
        }
        if (ui[`b${d.b}on`] < 0.5) setParam(id, `b${d.b}on`, 1, { silent: true });
        if (ui.listen > 0.5) setParam(id, 'listenf', uiParams(nv.block)[`b${d.b}f`], { silent: true });
        editor.tipText(e, `B${d.b}  ${fmtF(uiParams(nv.block)[`b${d.b}f`])}  ${(uiParams(nv.block)[`b${d.b}g`]).toFixed(1)} dB`);
      } else if (d.kind === 'filter') {
        const fx = xOf(d.f0, w) + (pt.x - d.x0) * fine;
        const lim = d.k === 'hp' ? [20, 2000] : [500, 20000];
        setParam(id, d.k + 'f', Math.round(Math.max(lim[0], Math.min(lim[1], fOf(fx, w)))), { silent: true });
        if (ui[d.k + 'on'] < 0.5) setParam(id, d.k + 'on', 1, { silent: true });
        editor.tipText(e, `${d.k.toUpperCase()}F ${fmtF(uiParams(nv.block)[d.k + 'f'])}`);
      } else if (d.kind === 'listen') {
        setParam(id, 'listenf', Math.round(fOf(pt.x, w)), { silent: true });
      }
    } else if (type === 'up') {
      s.drag = null;
      editor.hideTip();
    } else if (type === 'wheel') {
      const dir = e.deltaY < 0 ? 1 : -1;
      const fk = nearFilter();
      if (fk) { setParam(id, fk + 's', Math.max(0, Math.min(3, (ui[fk + 's'] | 0) + dir))); editor.tipText(e, `${fk.toUpperCase()}F ${[6, 12, 24, 48][uiParams(nv.block)[fk + 's'] | 0]} dB/oct`); return; }
      if (ui.listen > 0.5 && !nearBand()) { setParam(id, 'listenq', Math.max(0.3, Math.min(12, ui.listenq * (dir > 0 ? 1.15 : 1 / 1.15)))); return; }
      const b = nearBand() || sui.eqSel || 1;
      sui.eqSel = b;
      const q = Math.max(0.1, Math.min(18, ui[`b${b}q`] * (dir > 0 ? 1.12 : 1 / 1.12)));
      setParam(id, `b${b}q`, Math.round(q * 100) / 100);
      editor.tipText(e, `B${b} Q ${q.toFixed(2)}`);
    } else if (type === 'dbl') {
      const b = nearBand();
      if (b) setParam(id, `b${b}on`, ui[`b${b}on`] > 0.5 ? 0 : 1);
      else { const fk = nearFilter(); if (fk) setParam(id, fk + 'on', ui[fk + 'on'] > 0.5 ? 0 : 1); }
    }
  },
});
