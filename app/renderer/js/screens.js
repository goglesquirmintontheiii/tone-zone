// Live displays drawn inside pedal screens: tuners (needle / stream / strobe / polyphonic), looper LCDs,
// loop ring and model-name readouts. Elements are created once and updated per status frame.
import { svg, clamp, shade } from './util.js';
import { setA, setText } from './gfx/fx.js';
import { state, uiParams } from './state.js';

const LCD_FONT = "'Share Tech Mono', monospace";
const TUNINGS = ['E Std', 'Drop D', 'Eb Std', 'D Std', '7-str B', '8-str F#', 'Bass 4', 'Bass 5', 'Bass 6', 'Open D', 'Open G', 'DADGAD'];
const STR_COUNT = [6, 6, 6, 6, 7, 8, 4, 5, 6, 6, 6, 6];
const STATE_NAMES = ['EMPTY', 'REC', 'PLAY', 'DUB', 'STOP'];
const STATE_COL = ['#3f6dff', '#ff3b30', '#3ddc84', '#ffd21f', '#e8e8e8'];

function t(parent, x, y, s, o = {}) {
  return svg('text', { x, y, fill: o.fill || '#9fffe0', 'font-family': o.font || LCD_FONT, 'font-size': o.size || 9, 'text-anchor': o.anchor || 'middle', 'dominant-baseline': 'central', 'font-weight': o.weight || 400, opacity: o.opacity }, parent, s);
}

export function drawScreen(s, nv, st, now) {
  const kind = s.ctl.kind;
  const fn = SCREENS[kind];
  if (!fn) return;
  if (!s.built) {
    s.built = true;
    s.view.content.innerHTML = '';
    fn.build(s, s.view.content, s.view.w, s.view.h, nv);
  }
  fn.update(s, st, nv, now);
}

const SCREENS = {
  // ---------------------------------------------------------------- BOSS TU-3 style LED meter
  tu3: {
    build(s, g, w, h) {
      s.segs = [];
      const n = 21;
      for (let i = 0; i < n; i++) {
        const x = 8 + (i * (w - 52)) / (n - 1);
        s.segs.push(svg('rect', { x: x - 1.6, y: 12, width: 3.2, height: i === 10 ? 16 : 12, rx: 1, fill: '#1a0d0d', class: 'led' }, g));
      }
      s.arrowL = svg('path', { d: 'M8 36 l7 -4 v8z', fill: '#1a0d0d' }, g);
      s.arrowR = svg('path', { d: `M${w - 52} 36 l-7 -4 v8z`, fill: '#1a0d0d' }, g);
      s.note = t(g, w - 22, h / 2 - 2, '', { fill: '#ff3b2f', size: 20, weight: 700 });
      s.sub = t(g, w - 22, h - 8, '', { fill: '#ff3b2f', size: 6.5 });
      s.off = t(g, (w - 44) / 2, h - 9, 'TUNER OFF', { fill: '#5b2020', size: 6 });
    },
    update(s, st, nv, now) {
      const tu = st.tuner || {};
      const engaged = !nv.block.bypass;
      setText(s.off, engaged ? '' : 'PEDAL = TUNE');
      const ui = state.ui[nv.block.id] || {};
      if (!engaged || !tu.note) {
        s.segs.forEach((r) => setA(r, 'fill', '#1a0d0d'));
        setText(s.note, engaged ? '–' : '');
        setText(s.sub, engaged ? `${uiParams(nv.block).calib ?? 440}Hz` : '');
        setA(s.arrowL, 'fill', '#1a0d0d');
        setA(s.arrowR, 'fill', '#1a0d0d');
        return;
      }
      const c = tu.cents;
      const inTune = Math.abs(c) < 1.5;
      if (ui.stream) {
        // running light: moves slower as you approach pitch
        const speed = clamp(Math.abs(c) / 50, 0, 1) * 18;
        s.phase = (s.phase || 0) + (c > 0 ? 1 : -1) * speed * 0.033;
        const pos = ((Math.floor(s.phase) % 21) + 21) % 21;
        s.segs.forEach((r, i) => setA(r, 'fill', inTune ? (i === 10 ? '#3ddc84' : '#1a0d0d') : i === pos ? '#ff3b2f' : '#1a0d0d'));
      } else {
        const idx = Math.round(clamp(c / 50, -1, 1) * 10) + 10;
        s.segs.forEach((r, i) => setA(r, 'fill', i === 10 ? (inTune ? '#3ddc84' : '#3a1414') : i === idx ? '#ff3b2f' : '#1a0d0d'));
      }
      setA(s.arrowL, 'fill', c < -1.5 ? '#ff3b2f' : inTune ? '#3ddc84' : '#1a0d0d');
      setA(s.arrowR, 'fill', c > 1.5 ? '#ff3b2f' : inTune ? '#3ddc84' : '#1a0d0d');
      setText(s.note, tu.note);
      setA(s.note, 'fill', inTune ? '#3ddc84' : '#ff3b2f');
      setText(s.sub, `${c >= 0 ? '+' : ''}${c.toFixed(1)}¢`);
      void now;
    },
  },

  // ---------------------------------------------------------------- PolyTune style LED matrix
  polytune: {
    build(s, g, w, h) {
      s.cols = [];
      const nCols = 8, nRows = 11;
      const cw = (w - 16) / nCols, rh = (h - 26) / nRows;
      for (let c = 0; c < nCols; c++) {
        const col = [];
        for (let r = 0; r < nRows; r++) col.push(svg('circle', { cx: 8 + cw * (c + 0.5), cy: 6 + rh * (r + 0.5), r: Math.min(cw, rh) * 0.32, fill: '#170808' }, g));
        s.cols.push(col);
      }
      s.note = t(g, w / 2, h - 10, '', { fill: '#ff3b2f', size: 12, weight: 700 });
      s.mode = t(g, w - 6, h - 9, '', { fill: '#7a3030', size: 5.4, anchor: 'end' });
      s.left = t(g, 6, h - 9, '', { fill: '#7a3030', size: 5.4, anchor: 'start' });
    },
    update(s, st, nv, now) {
      const tu = st.tuner || {};
      const ui = uiParams(nv.block);
      const disp = state.ui[nv.block.id]?.display || 'needle';
      const off = '#170808';
      const all = s.cols.flat();
      all.forEach((d) => setA(d, 'fill', off));
      setText(s.left, TUNINGS[ui.tuning | 0] || '');
      setText(s.mode, nv.block.bypass ? 'BYPASS' : disp.toUpperCase());
      if (nv.block.bypass) {
        setText(s.note, '');
        // four "ready" LEDs at the bottom
        for (let c = 2; c < 6; c++) setA(s.cols[c][10], 'fill', '#5a1010');
        return;
      }
      if (tu.polyActive && tu.strings) {
        const n = STR_COUNT[ui.tuning | 0] || tu.strings.length;
        const start = Math.floor((8 - n) / 2);
        tu.strings.forEach((sv, i) => {
          const col = s.cols[start + i];
          if (!col) return;
          if (!sv.active) { setA(col[5], 'fill', '#3a1010'); return; }
          const off2 = Math.round(clamp(sv.cents / 25, -1, 1) * 5);
          if (Math.abs(sv.cents) < 2) setA(col[5], 'fill', '#3ddc84');
          else if (off2 > 0) for (let r = 5 - off2; r <= 5; r++) setA(col[r], 'fill', '#ff3b2f');
          else for (let r = 5; r <= 5 - off2; r++) setA(col[r], 'fill', '#ff3b2f');
        });
        setText(s.note, '');
        return;
      }
      if (!tu.note) { setText(s.note, '·'); return; }
      const c = tu.cents;
      const inTune = Math.abs(c) < 1.5;
      if (disp === 'strobe') {
        s.phase = (s.phase || 0) + c * 0.012;
        const shift = ((Math.floor(s.phase * 8) % 8) + 8) % 8;
        s.cols.forEach((col, ci) => col.forEach((d, r) => { if (r < 10 && (r + ci + shift) % 4 === 0) setA(d, 'fill', inTune ? '#3ddc84' : '#ff3b2f'); }));
      } else {
        const x = Math.round(clamp(c / 50, -1, 1) * 3.5 + 3.5);
        for (let r = 1; r < 10; r++) setA(s.cols[clamp(x, 0, 7)][r], 'fill', inTune ? '#3ddc84' : '#ff3b2f');
        if (x === 3 || x === 4) for (let r = 1; r < 10; r++) setA(s.cols[x === 3 ? 4 : 3][r], 'fill', inTune ? '#3ddc84' : '#5a1010');
      }
      setText(s.note, tu.note);
      setA(s.note, 'fill', inTune ? '#3ddc84' : '#ff3b2f');
      void now;
    },
  },

  // ---------------------------------------------------------------- strobe tuner (Tone Zone)
  strobe: {
    build(s, g, w, h) {
      s.bands = [];
      const bandH = Math.max(4, (h * 0.42) / 3 - 2);
      s.rects = [];
      for (let r = 0; r < 3; r++) {
        const row = svg('g', {}, g);
        for (let i = -2; i < Math.ceil(w / 10) + 2; i++) s.rects.push(svg('rect', { x: i * 10, y: 4 + r * (bandH + 2), width: 5, height: bandH, rx: 1, fill: '#2a8cff', opacity: 0.85 - r * 0.2 }, row));
        s.bands.push(row);
      }
      // centre reference marks
      svg('path', { d: `M${w / 2} 2 v3 M${w / 2} ${4 + 3 * (bandH + 2)} v3`, stroke: '#e9ecf3', 'stroke-width': 1, opacity: 0.6 }, g);
      s.note = t(g, w / 2, h - 20, '', { fill: '#e9ecf3', size: Math.min(16, h * 0.24), weight: 700 });
      s.cents = t(g, w / 2, h - 7, '', { fill: '#7d8597', size: 7 });
    },
    update(s, st, nv) {
      const tu = st.tuner || {};
      if (nv.block.bypass || !tu.note) {
        setText(s.note, nv.block.bypass ? 'OFF' : '–');
        setText(s.cents, '');
        return;
      }
      s.ph = s.ph || [0, 0, 0];
      s.bands.forEach((b, r) => {
        s.ph[r] = (s.ph[r] + tu.cents * 0.08 * (r + 1)) % 10;
        setA(b, 'transform', `translate(${s.ph[r].toFixed(1)},0)`);
      });
      const col = Math.abs(tu.cents) < 1 ? '#3ddc84' : '#2a8cff';
      if (s.col !== col) { s.col = col; s.rects.forEach((x) => setA(x, 'fill', col)); }
      setText(s.note, tu.note + (tu.octave ?? ''));
      setText(s.cents, `${tu.cents >= 0 ? '+' : ''}${tu.cents.toFixed(1)} ¢  ${tu.freq ? tu.freq.toFixed(2) + ' Hz' : ''}`);
    },
  },

  // ---------------------------------------------------------------- RC-500 style LCD
  looper500: {
    build(s, g, w, h) {
      s.bg = svg('rect', { width: w, height: h, rx: 2, fill: '#0d2a4a', opacity: 0.9 }, g);
      s.hdr = t(g, 6, 8, 'MEM 01', { size: 7, anchor: 'start', fill: '#dff' });
      s.tempo = t(g, w - 6, 8, '', { size: 7, anchor: 'end', fill: '#dff' });
      s.tracks = [0, 1].map((i) => {
        const y = 22 + i * 16;
        const lab = t(g, 6, y, `TR${i + 1}`, { size: 7, anchor: 'start', fill: '#dff' });
        const bar = svg('rect', { x: 26, y: y - 4, width: w - 74, height: 8, rx: 2, fill: '#ffffff22' }, g);
        const fill = svg('rect', { x: 26, y: y - 4, width: 0, height: 8, rx: 2, fill: '#3ddc84' }, g);
        const stt = t(g, w - 6, y, '', { size: 6.5, anchor: 'end', fill: '#dff' });
        return { lab, bar, fill, stt, w: w - 74 };
      });
      s.foot = t(g, 6, h - 6, '', { size: 6, anchor: 'start', fill: '#9cd' });
    },
    update(s, st, nv, now) {
      const L = st.looper;
      const ui = state.ui[nv.block.id] || {};
      const cur = ui.current ?? 0;
      const p = uiParams(nv.block);
      setText(s.tempo, `${Math.round(p.tempo ?? 100)} BPM`);
      if (!L) return;
      // backlight colour follows the current track state like the real unit
      const cs = L.tracks[cur]?.state ?? 0;
      setA(s.bg, 'fill', ['#0d2a4a', '#4a0d0d', '#0d4a22', '#4a420d', '#3a3a3a'][cs]);
      L.tracks.slice(0, 2).forEach((tr, i) => {
        const v = s.tracks[i];
        setA(v.fill, 'width', (tr.state === 1 ? (now % 1000) / 1000 : tr.pos) * v.w);
        setA(v.fill, 'fill', STATE_COL[tr.state]);
        setText(v.stt, STATE_NAMES[tr.state] + (tr.len ? ` ${tr.len.toFixed(1)}s` : ''));
        setText(v.lab, (i === cur ? '▶' : ' ') + `TR${i + 1}`);
      });
      setText(s.foot, L.rhythm ? `RHYTHM ${['ROCK', 'POP', 'FUNK', 'SHFL', 'METAL', 'BALLAD', '4/4', 'HALF', 'BOSSA', 'CLICK'][p.pattern | 0]} ${'•'.repeat((L.step >> 2) + 1)}` : 'RHYTHM OFF');
    },
  },

  // ---------------------------------------------------------------- RC-600 style LCD (6 tracks)
  looper600: {
    build(s, g, w, h) {
      svg('rect', { width: w, height: h, rx: 2, fill: '#c7d6c2' }, g);
      s.hdr = t(g, 6, 7, 'MEMORY 01: TONE ZONE', { size: 6.6, anchor: 'start', fill: '#1a2a1a' });
      s.tempo = t(g, w - 6, 7, '', { size: 6.6, anchor: 'end', fill: '#1a2a1a' });
      s.tr = [];
      for (let i = 0; i < 6; i++) {
        const x = 8 + i * ((w - 16) / 6), cw = (w - 16) / 6 - 5;
        svg('rect', { x, y: 15, width: cw, height: h - 30, rx: 2, fill: 'none', stroke: '#1a2a1a', 'stroke-width': 0.7 }, g);
        const lvl = svg('rect', { x: x + 2, y: 17, width: cw - 4, height: 0, fill: '#1a2a1a', opacity: 0.85 }, g);
        const name = t(g, x + cw / 2, h - 9, `${i + 1}`, { size: 7, fill: '#1a2a1a', weight: 700 });
        const st = t(g, x + cw / 2, 22, '', { size: 5, fill: '#c7d6c2' });
        s.tr.push({ lvl, name, st, x, cw, hh: h - 34 });
      }
    },
    update(s, st, nv) {
      const L = st.looper;
      const p = uiParams(nv.block);
      const ui = state.ui[nv.block.id] || {};
      setText(s.tempo, `♩${Math.round(p.tempo ?? 100)}`);
      if (!L) return;
      L.tracks.forEach((tr, i) => {
        const v = s.tr[i];
        if (!v) return;
        const hh = tr.state === 0 ? 0 : v.hh * (tr.state === 1 ? 1 : 1 - tr.pos);
        setA(v.lvl, 'height', hh);
        setA(v.lvl, 'y', 17 + (v.hh - hh));
        setText(v.st, tr.state ? STATE_NAMES[tr.state] : '');
        setText(v.name, ((ui.current ?? 0) === i ? '▸' : '') + (i + 1));
      });
    },
  },

  looperMini: {
    build(s, g, w, h) {
      s.bar = svg('rect', { x: 6, y: h / 2 - 4, width: w - 12, height: 8, rx: 3, fill: '#ffffff18' }, g);
      s.fill = svg('rect', { x: 6, y: h / 2 - 4, width: 0, height: 8, rx: 3, fill: '#3ddc84' }, g);
      s.txt = t(g, w / 2, 9, 'EMPTY', { size: 7, fill: '#bfe' });
    },
    update(s, st, nv, now) {
      const tr = st.looper?.tracks?.[0];
      if (!tr) return;
      setA(s.fill, 'width', (tr.state === 1 ? (now % 1000) / 1000 : tr.pos) * (s.bar.getAttribute('width') | 0));
      setA(s.fill, 'fill', STATE_COL[tr.state]);
      setText(s.txt, STATE_NAMES[tr.state] + (tr.len ? `  ${tr.len.toFixed(1)} s` : ''));
    },
  },

  // ---------------------------------------------------------------- RC-600 loop ring
  ring: {
    build(s, g, w, h) {
      s.segs = [];
      const cx = w / 2, cy = h / 2, r = Math.min(w, h) / 2 - 3;
      for (let i = 0; i < 16; i++) {
        const a0 = (i / 16) * Math.PI * 2 - Math.PI / 2 + 0.04, a1 = ((i + 1) / 16) * Math.PI * 2 - Math.PI / 2 - 0.04;
        const p = (a, rr) => `${cx + Math.cos(a) * rr},${cy + Math.sin(a) * rr}`;
        s.segs.push(svg('path', { d: `M${p(a0, r)} A${r},${r} 0 0 1 ${p(a1, r)} L${p(a1, r - 6)} A${r - 6},${r - 6} 0 0 0 ${p(a0, r - 6)} Z`, fill: '#2a0a0a', class: 'led' }, g));
      }
    },
    update(s, st) {
      const L = st.looper;
      if (!L) return;
      const tr = L.tracks.find((x) => x.state === 2 || x.state === 3 || x.state === 1);
      const pos = tr ? Math.floor((tr.state === 1 ? 0 : tr.pos) * 16) : L.rhythm ? L.step : -1;
      const col = tr ? STATE_COL[tr.state] : '#3f6dff';
      s.segs.forEach((seg, i) => {
        setA(seg, 'fill', i === pos ? shade(col, 0.25) : i <= pos ? col : '#2a0a0a');
      });
    },
  },

  modelName: {
    build(s, g, w, h) {
      svg('rect', { width: w, height: h, rx: 2, fill: '#1b1203' }, g);
      s.txt = t(g, w / 2, h / 2 + 0.5, '', { size: 7.5, fill: '#ffb84d' });
    },
    update(s, st, nv) {
      const idx = uiParams(nv.block).model | 0;
      const names = s.ctl.names || [];
      setText(s.txt, (names[idx] || '').slice(0, 18));
    },
  },
};

export const TUNING_NAMES = TUNINGS;

export function registerScreen(kind, impl) {
  if (SCREENS[kind] && !impl.override) throw new Error(`screen "${kind}" already exists`);
  SCREENS[kind] = impl;
}
