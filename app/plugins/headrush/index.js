// Built-in Tone Zone plugin: Headrush.
// "Rush Five", inspired by the Headrush MX5: 4" touchscreen rig view (seven block slots), VALUE push knob,
// BACK button, four footswitches (RIG / STOMP / HYBRID / LOOPER modes) and a built-in expression pedal.
import { createKit, CATS, modelsIn, pText } from './mfx-kit.js';

export default function register(tz) {
  const kit = createKit(tz);
  const { K, FOOT, SCREEN, TREADLE, def, db } = tz.helpers;
  const { svg, label, formKit, setA, setText } = tz.gfx;
  const ID = 'hr.rushfive';
  const N = 7;
  const FONT = "'Segoe UI', 'Carlito', Calibri, 'DejaVu Sans', sans-serif";
  const CY = '#18b4e8';
  const COL = { dist: '#ff8a00', dyn: '#f9d71c', eq: '#9fb3c8', mod: '#00c2ff', dly: '#00e0a4', rev: '#7b61ff', pitch: '#c6ff00', filter: '#ff4081', wah: '#ffab40', vol: '#80deea', amp: '#ff3d3d', ampo: '#ff3d3d', cab: '#d4785b' };
  const CATL = ['amp', 'ampo', 'cab', 'dist', 'dyn', 'eq', 'mod', 'dly', 'rev', 'pitch', 'filter', 'wah', 'vol'];
  const MODES = ['RIG', 'STOMP', 'HYBRID', 'LOOPER'];
  const presets = [
    { name: 'Rock Rig', slots: { 1: ['scream', { gain: 0.25, level: 0.65 }, true], 2: ['ac-plexi'], 3: ['plasti', {}, true], 4: ['tape', { mix: 0.2 }], 5: ['plate', { mix: 0.2 }] } },
    { name: 'Clean Shimmer', slots: { 1: ['dlxcomp'], 2: ['ac-ustwin'], 3: ['trinity', { mix: 0.4 }], 4: ['adriatic', { mix: 0.25 }], 5: ['shimmer', { mix: 0.3 }] } },
    { name: 'Thrash', slots: { 1: ['gate', { threshold: 0.5 }], 2: ['scream', { gain: 0.05, level: 0.8 }], 3: ['ac-uber'], 4: ['room', { mix: 0.12 }] } },
    { name: 'Blues Room', slots: { 1: ['teemah'], 2: ['ac-tweed'], 3: ['spring', { mix: 0.3 }] } },
    { name: 'Wah Funk', slots: { 1: ['fassel'], 2: ['redsq'], 3: ['ac-usdlx', { 'a.gain': 0.35 }], 4: ['phase8', {}, true], 5: ['room', { mix: 0.15 }] } },
    { name: 'Lead Echo', slots: { 1: ['minotaur'], 2: ['ac-fried'], 3: ['harmony', {}, true], 4: ['pingpong', { mix: 0.3 }], 5: ['hall', { mix: 0.25 }] } },
  ];
  const SETTINGS = [
    { n: 'Noise Gate', p: '_gate', opts: ['Off', 'On'] },
    { n: 'Tuner Ref', p: '_tref', d: 440, min: 425, max: 455, step: 1, f: (v) => v + ' Hz' },
    { n: 'Tuner Mute', p: '_tmute', d: 1, opts: ['Off', 'On'] },
    { n: 'Tempo Sync', p: '_tapSync', d: 1, opts: ['Off', 'On'] },
    { n: 'Output', p: '_vol', d: 0, min: -30, max: 6, step: 0.5, f: (v) => (v > 0 ? '+' : '') + v.toFixed(1) + ' dB' },
  ];
  const B = (id) => kit.blk(id);
  const U = (id) => kit.ui(B(id));
  const M = kit.menus({ n: N, col: COL, settings: SETTINGS, cats: () => CATL });
  const used = (u) => { const r = []; for (let i = 1; i <= N; i++) if (kit.slotModel(u, i)) r.push(i); return r; };

  function footswitch(id, k, down) {
    const n = kit.nav(id);
    n.fsMode = n.fsMode || 0;
    const u = U(id);
    const holds = [() => kit.tuner(id), () => kit.tap(id), () => kit.tap(id), () => { n.fsMode = (n.fsMode + 1) % 4; kit.say(id, MODES[n.fsMode] + ' MODE'); }];
    kit.press(id + '|fs' + k, down, {
      ms: 800, hold: holds[k],
      tap: () => {
        if (n.view === 'tuner') return kit.tuner(id, false);
        const m = n.fsMode;
        if (m === 0) kit.loadPreset(id, Math.floor((u._preset | 0) / 4) * 4 + k);
        else if (m === 1 || (m === 2 && k < 2)) { const s = used(u)[k]; if (s) { kit.toggleSlot(id, s); kit.selectSlot(id, s); } }
        else if (m === 2) kit.loadPreset(id, ((u._preset | 0) + (k === 2 ? 23 : 1)) % 24);
        else {
          const ls = kit.loopState(tz.app.state.status.blocks[id]);
          if (k === 0) kit.looper(id, 'rec');
          else if (k === 1) kit.looper(id, ls === 1 || ls === 2 || ls === 3 ? 'stop' : 'play');
          else if (k === 2) kit.looper(id, 'undo');
          else kit.looper(id, 'clear');
        }
        kit.bump(id);
      },
    });
  }
  function fsInfo(id, u, n, k, st) {
    const m = n.fsMode || 0;
    if (m === 0) { const p = Math.floor((u._preset | 0) / 4) * 4 + k; return { t: kit.presetName(B(id), p).slice(0, 11), c: CY, lit: (u._preset | 0) === p }; }
    if (m === 1 || (m === 2 && k < 2)) { const s = used(u)[k]; const mm = s && kit.slotModel(u, s); return mm ? { t: mm.n.slice(0, 11), c: COL[mm.cat], lit: kit.slotOn(u, s) } : { t: '', c: '#333', lit: false }; }
    if (m === 2) return { t: k === 2 ? 'RIG DOWN' : 'RIG UP', c: '#ffffff', lit: false };
    const ls = kit.loopState(st);
    return [{ t: ls === 3 ? 'DUB' : 'REC', c: '#ff3d3d', lit: ls === 1 || ls === 3 }, { t: ls === 2 || ls === 3 ? 'STOP' : 'PLAY', c: '#00e0a4', lit: ls === 2 }, { t: 'UNDO', c: '#f9d71c', lit: false }, { t: 'CLEAR', c: '#ff8a00', lit: false }][k];
  }
  function turn(id, ctl, d) {
    const n = kit.nav(id);
    if (n.view === 'home') kit.selectSlot(id, ((n.sel - 1 + d + N) % N) + 1);
    else if (n.view === 'edit') kit.stepParam(id, n.sel, n.page * 4 + (n.knob || 0), d);
    else if (n.view === 'settings') M.valueTurn(id, d);
    else if (n.view === 'models' || n.view === 'cats') M.move(id, d);
  }
  function push(id) {
    const n = kit.nav(id);
    if (n.view === 'tuner') return kit.tuner(id, false);
    if (n.view === 'home') { if (kit.slotModel(U(id), n.sel)) n.view = 'edit'; else M.openSlot(id); return; }
    if (n.view === 'edit') { n.knob = ((n.knob || 0) + 1) % 4; return; }
    if (n.view === 'settings') return M.move(id, 1);
    M.activate(id);
  }
  function back(id) {
    const n = kit.nav(id);
    if (n.view === 'models') { n.view = 'cats'; n.cur = Math.max(0, CATL.indexOf(n.cat) + 1); }
    else if (n.view === 'tuner') kit.tuner(id, false);
    else n.view = 'home';
  }

  // ---------------------------------------------------------------- touchscreen
  const T = (g, x, y, s, o = {}) => kit.svgT(g, x, y, s, Object.assign({ font: FONT, weight: 600, fill: '#ffffff' }, o));
  const show = (el, on) => setA(el, 'display', on ? 'inline' : 'none');
  const BXX = (i) => 18 + (i - 1) * 27.5;
  const arc = (cx, cy, r, a0, a1) => { const p = (a) => `${(cx + Math.sin(a) * r).toFixed(2)} ${(cy - Math.cos(a) * r).toFixed(2)}`; return `M${p(a0)} A${r} ${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${p(a1)}`; };
  tz.addScreen('hr-touch', {
    build(s, g, w, h) {
      s.w = w; s.h = h;
      svg('rect', { width: w, height: h, fill: '#050608' }, g);
      svg('rect', { width: w, height: 13, fill: '#0d1418' }, g);
      svg('rect', { y: 12.4, width: w, height: 0.6, fill: CY }, g);
      s.rig = T(g, 4, 6.8, '', { size: 6.2 });
      s.modeR = svg('rect', { x: w - 74, y: 2, width: 30, height: 9, rx: 4.5, fill: CY }, g);
      s.modeT = T(g, w - 59, 6.8, '', { size: 4.6, anchor: 'middle', fill: '#050608', weight: 700 });
      T(g, w - 32, 6.8, 'TUNE', { size: 4.4, anchor: 'middle', fill: '#9fb3c8' });
      T(g, w - 10, 6.8, '⚙', { size: 7, anchor: 'middle', fill: '#9fb3c8' });
      // rig view
      const H = (s.home = svg('g', {}, g));
      svg('line', { x1: 4, x2: w - 4, y1: 36, y2: 36, stroke: '#24414d', 'stroke-width': 1.2 }, H);
      s.blocks = [];
      for (let i = 1; i <= N; i++) {
        const x = BXX(i);
        const ring = svg('circle', { cx: x, cy: 36, r: 11.5, fill: 'none', stroke: '#fff', 'stroke-width': 1, 'stroke-opacity': 0 }, H);
        const c = svg('circle', { cx: x, cy: 36, r: 9, fill: '#101820', stroke: '#24414d', 'stroke-width': 0.8 }, H);
        const t = T(H, x, 36.4, '+', { size: 6, anchor: 'middle', fill: '#24414d', weight: 700 });
        const nm = T(H, x, 52, '', { size: 3.9, anchor: 'middle', fill: '#9fb3c8', weight: 500 });
        s.blocks.push({ ring, c, t, nm });
      }
      s.mName = T(H, w / 2, 64, '', { size: 7, anchor: 'middle' });
      s.hint = T(H, w / 2, 76, '', { size: 4.6, anchor: 'middle', fill: '#5f7a88', weight: 500 });
      s.fsT = [0, 1, 2, 3].map((k) => { const x = 4 + k * 48; const r = svg('rect', { x, y: 88, width: 45, height: 20, rx: 3, fill: '#0d1418', stroke: '#24414d', 'stroke-width': 0.7 }, H); const t = T(H, x + 22.5, 98.4, '', { size: 5, anchor: 'middle' }); return { r, t }; });
      // block edit: 4 dials
      const E = (s.edit = svg('g', {}, g));
      s.eName = T(E, 4, 21, '', { size: 7 });
      s.eOn = svg('rect', { x: w - 34, y: 16, width: 30, height: 10, rx: 5, fill: CY }, E);
      s.eOnT = T(E, w - 19, 21.2, '', { size: 4.8, anchor: 'middle', fill: '#050608', weight: 700 });
      s.dials = [0, 1, 2, 3].map((k) => {
        const cx = 27 + k * 48.5, cy = 62;
        const sel = svg('circle', { cx, cy, r: 19, fill: '#0d1418', stroke: CY, 'stroke-width': 0.8, 'stroke-opacity': 0 }, E);
        svg('path', { d: arc(cx, cy, 14, -2.5, 2.5), stroke: '#1d2e36', 'stroke-width': 3.4, fill: 'none', 'stroke-linecap': 'round' }, E);
        const a = svg('path', { d: '', stroke: CY, 'stroke-width': 3.4, fill: 'none', 'stroke-linecap': 'round' }, E);
        const v = T(E, cx, cy + 0.5, '', { size: 5.4, anchor: 'middle' });
        const nm = T(E, cx, cy + 25, '', { size: 4.6, anchor: 'middle', fill: '#9fb3c8', weight: 500 });
        return { sel, a, v, nm, cx, cy };
      });
      s.ePg = T(E, w / 2, h - 4, '', { size: 4.4, anchor: 'middle', fill: '#5f7a88' });
      // category tiles
      const C = (s.cats = svg('g', {}, g));
      s.tiles = [];
      for (let k = 0; k < 14; k++) {
        const x = 4 + (k % 5) * 38.8, y = 17 + Math.floor(k / 5) * 31;
        const r = svg('rect', { x, y, width: 36, height: 28, rx: 4, fill: '#101820', stroke: '#24414d', 'stroke-width': 0.7 }, C);
        const bar = svg('rect', { x: x + 3, y: y + 3, width: 30, height: 3, rx: 1.5, fill: '#333' }, C);
        const t = T(C, x + 18, y + 17, '', { size: 4.6, anchor: 'middle' });
        s.tiles.push({ r, bar, t });
      }
      // lists (models, settings)
      const L = (s.list = svg('g', {}, g));
      s.lt = T(L, 4, 20, '', { size: 6, fill: CY });
      s.rows = [];
      for (let k = 0; k < 7; k++) {
        const y = 26 + k * 12;
        const r = svg('rect', { x: 3, y, width: w - 6, height: 11, rx: 5.5, fill: CY, 'fill-opacity': 0 }, L);
        const t = T(L, 10, y + 5.7, '', { size: 5.4, weight: 500 });
        const v = T(L, w - 10, y + 5.7, '', { size: 5, anchor: 'end', fill: '#9fb3c8' });
        s.rows.push({ r, t, v });
      }
      // tuner
      const TU = (s.tun = svg('g', {}, g));
      s.tn = T(TU, w / 2, 52, '', { size: 34, anchor: 'middle', weight: 700 });
      s.tbars = [];
      for (let k = 0; k < 15; k++) s.tbars.push(svg('rect', { x: w / 2 - 75 + k * 10, y: 80, width: 7, height: 12, rx: 2, fill: '#1d2e36' }, TU));
      s.tc = T(TU, w / 2, 102, '', { size: 5.4, anchor: 'middle', fill: '#9fb3c8' });
      s.toast = svg('g', { display: 'none' }, g);
      svg('rect', { x: w / 2 - 50, y: h / 2 - 9, width: 100, height: 18, rx: 9, fill: CY }, s.toast);
      s.toastT = T(s.toast, w / 2, h / 2, '', { size: 6.6, anchor: 'middle', fill: '#050608', weight: 700 });
      s.sig = '';
    },
    update(s, st, nv, now) {
      const b = nv.block, id = b.id, u = s.ui, n = kit.nav(id), w = s.w;
      n.fsMode = n.fsMode || 0;
      const lv = kit.live.get(id);
      if (lv) for (let k = 0; k < 4; k++) { const fi = fsInfo(id, u, n, k, st); setA(lv.rings[k], 'stroke', fi.c); setA(lv.rings[k], 'stroke-opacity', fi.lit ? 1 : 0.2); setText(lv.labels[k], fi.t); setA(lv.labels[k], 'fill', fi.lit ? fi.c : '#8d98a0'); }
      const ton = n.msg && now - n.msgT < 1300;
      show(s.toast, ton);
      if (ton) setText(s.toastT, n.msg);
      const v = n.view;
      show(s.home, v === 'home'); show(s.edit, v === 'edit'); show(s.cats, v === 'cats'); show(s.list, v === 'models' || v === 'settings'); show(s.tun, v === 'tuner');
      if (v === 'tuner') {
        const t = st && st.tu && st.tu.tuner;
        const c = t && t.note ? t.cents : 0;
        const k0 = Math.round(Math.max(-1, Math.min(1, c / 50)) * 7) + 7;
        s.tbars.forEach((r, k) => setA(r, 'fill', t && t.note && k === k0 ? (Math.abs(c) < 2 ? '#00e0a4' : '#ff3d3d') : k === 7 ? '#14423a' : '#1d2e36'));
        setText(s.tn, t && t.note ? t.note : '-');
        setText(s.tc, t && t.note ? `${c >= 0 ? '+' : ''}${c.toFixed(1)} cents` : 'tap to close');
      }
      const sig = n.rev + v + n.sel + '|' + n.page + '|' + n.cur + '|' + n.knob + '|' + n.fsMode + JSON.stringify(b.params) + (b.mfx ? b.mfx.name : '');
      if (sig === s.sig) return;
      s.sig = sig;
      setText(s.rig, `${String((u._preset | 0) + 1).padStart(2, '0')}  ${kit.presetName(b)}`);
      setText(s.modeT, MODES[n.fsMode]);
      if (v === 'home') {
        s.blocks.forEach((e, k) => {
          const i = k + 1, m = kit.slotModel(u, i), on = m && kit.slotOn(u, i);
          setA(e.c, 'fill', on ? COL[m.cat] : '#101820');
          setA(e.c, 'stroke', m ? COL[m.cat] : '#24414d');
          setText(e.t, m ? CATS[m.cat].s.slice(0, 4) : '+');
          setA(e.t, 'font-size', m ? 3.8 : 6);
          setA(e.t, 'fill', on ? '#050608' : m ? COL[m.cat] : '#24414d');
          setText(e.nm, m ? m.n.split(' ')[0].slice(0, 8) : '');
          setA(e.ring, 'stroke-opacity', i === n.sel ? 1 : 0);
        });
        const m = kit.slotModel(u, n.sel);
        setText(s.mName, m ? m.n : `Slot ${n.sel} is empty`);
        setText(s.hint, m ? 'tap again or push VALUE to edit' : 'tap the + to add a block');
        s.fsT.forEach((e, k) => { const fi = fsInfo(id, u, n, k, st); setText(e.t, fi.t || '-'); setA(e.r, 'stroke', fi.c); setA(e.r, 'fill', fi.lit ? fi.c : '#0d1418'); setA(e.t, 'fill', fi.lit ? '#050608' : '#ffffff'); });
      } else if (v === 'edit') {
        const m = kit.slotModel(u, n.sel);
        if (!m) { n.view = 'home'; return; }
        setText(s.eName, m.n);
        const on = kit.slotOn(u, n.sel);
        setA(s.eOn, 'fill', on ? CY : '#24414d'); setText(s.eOnT, on ? 'ON' : 'OFF');
        const np = kit.pages(u, n.sel, 4);
        s.dials.forEach((e, k) => {
          const j = n.page * 4 + k, p = m.P[j];
          const pos = p ? kit.slotPos(u, n.sel, j, m) : 0;
          setA(e.a, 'd', p && pos > 0.005 ? arc(e.cx, e.cy, 14, -2.5, -2.5 + 5 * pos) : '');
          setA(e.a, 'stroke', COL[m.cat]);
          setText(e.v, p ? pText(p, pos) : '');
          setText(e.nm, p ? p.n : '');
          setA(e.sel, 'stroke-opacity', k === (n.knob || 0) ? 1 : 0);
        });
        setText(s.ePg, np > 1 ? `page ${n.page + 1}/${np}  (swipe here)` : '');
      } else if (v === 'cats') {
        const it = M.items(id);
        s.tiles.forEach((e, k) => {
          const x = it[k];
          show(e.r, !!x); show(e.bar, !!x); show(e.t, !!x);
          if (!x) return;
          setText(e.t, x.t);
          setA(e.bar, 'fill', x.c || '#555');
          setA(e.r, 'stroke', k === n.cur ? '#ffffff' : '#24414d');
        });
      } else {
        const it = M.items(id);
        n.cur = Math.min(n.cur, Math.max(0, it.length - 1));
        n.top = kit.windowTop(it.length, n.cur, n.top || 0, 7);
        setText(s.lt, v === 'settings' ? 'SETTINGS' : CATS[n.cat].n.toUpperCase());
        s.rows.forEach((e, k) => {
          const x = it[n.top + k];
          show(e.t, !!x); show(e.v, !!x);
          const sel = x && n.top + k === n.cur;
          setA(e.r, 'fill-opacity', sel ? 1 : 0);
          if (!x) return;
          setText(e.t, x.t + (x.mark ? '  •' : ''));
          setText(e.v, x.r && x.r !== '▸' ? x.r : '');
          setA(e.t, 'fill', sel ? '#050608' : '#ffffff');
          setA(e.v, 'fill', sel ? '#050608' : '#9fb3c8');
        });
      }
    },
    pointer(s, nv, type, pt, e) {
      const id = nv.block.id, n = kit.nav(id), w = s.w, u = s.ui;
      if (type === 'move' && s.drag) { kit.setPos(id, n.sel, s.drag.j, s.drag.p0 + (s.drag.y0 - pt.y) / 50); return; }
      if (type === 'up') { if (s.drag && n.view === 'edit' && Math.abs(pt.x - s.drag.x0) > 30) kit.page(id, pt.x < s.drag.x0 ? 1 : -1); s.drag = null; return; }
      if (type === 'wheel' && n.view === 'edit') { const k = Math.floor((pt.x - 3) / 48.5); if (k >= 0 && k < 4) kit.stepParam(id, n.sel, n.page * 4 + k, e.deltaY < 0 ? 1 : -1); return; }
      if (type !== 'down') return;
      const v = n.view;
      if (pt.y < 13) {
        if (pt.x > w - 76 && pt.x < w - 44) { n.fsMode = (n.fsMode + 1) % 4; kit.say(id, MODES[n.fsMode] + ' MODE'); }
        else if (pt.x > w - 42 && pt.x < w - 22) kit.tuner(id, v !== 'tuner');
        else if (pt.x > w - 20) { if (v === 'settings') n.view = 'home'; else M.open(id, 'settings'); }
        else back(id);
      } else if (v === 'tuner') kit.tuner(id, false);
      else if (v === 'home') {
        if (pt.y < 58) { const i = Math.round((pt.x - 18) / 27.5) + 1; if (i >= 1 && i <= N) { if (!kit.slotModel(u, i)) { kit.selectSlot(id, i); M.openSlot(id); } else if (n.sel === i) n.view = 'edit'; else kit.selectSlot(id, i); } }
      } else if (v === 'edit') {
        if (pt.y < 28 && pt.x > w - 36) kit.toggleSlot(id, n.sel);
        else if (pt.y < 28) M.openModels(id, kit.slotModel(u, n.sel).cat);
        else { const k = Math.floor((pt.x - 3) / 48.5); if (k >= 0 && k < 4) { n.knob = k; const m = kit.slotModel(u, n.sel); const j = n.page * 4 + k; s.drag = { j, y0: pt.y, x0: pt.x, p0: m && m.P[j] ? kit.slotPos(u, n.sel, j, m) : 0 }; } }
      } else if (v === 'cats') {
        const k = Math.floor((pt.x - 4) / 38.8) + Math.floor((pt.y - 17) / 31) * 5;
        const it = M.items(id);
        if (it[k]) { n.cur = k; it[k].act(); }
      } else {
        const r = Math.floor((pt.y - 26) / 12), it = M.items(id);
        if (r >= 0 && r < 7 && n.top + r < it.length) { n.cur = n.top + r; if (v === 'settings') kit.setStep(id, it[n.cur].row, 1); else M.activate(id); }
      }
      kit.bump(id);
    },
  });
  kit.addEncoder('hr-enc', (s, g, w, h) => {
    const cx = w / 2, cy = h / 2, r = Math.min(w, h) / 2 - 2;
    svg('circle', { cx, cy: cy + 1.6, r: r + 1, fill: '#000', 'fill-opacity': 0.5 }, g);
    svg('circle', { cx, cy, r, fill: '#15191c', stroke: CY, 'stroke-width': 1.2 }, g);
    svg('circle', { cx, cy, r: r * 0.7, fill: 'url(#g-knobBlack)' }, g);
    const rot = svg('g', {}, svg('g', { transform: `translate(${cx},${cy})` }, g));
    svg('line', { x1: 0, y1: -r * 0.6, x2: 0, y2: -r * 0.25, stroke: '#fff', 'stroke-width': 1.4, 'stroke-linecap': 'round' }, rot);
    svg('rect', { width: w, height: h, fill: 'transparent' }, g);
    return rot;
  }, turn, push);

  // ---------------------------------------------------------------- enclosure
  const W = 436, H = 246;
  const FX = (k) => 52 + k * 80;
  tz.addForm('hr-mx', (ctx, d) => {
    const g = ctx.g;
    formKit.body(g, W, H, '#16181a', { rx: 10 });
    svg('rect', { x: 6, y: 6, width: 330, height: 136, rx: 8, fill: '#0e1012' }, g);
    svg('rect', { x: 6, y: 141, width: 330, height: 1, fill: CY, 'fill-opacity': 0.5 }, g);
    const theme = { text: '#d8dde2', knob: 'strymon', labelSize: 5.4, labelFont: FONT };
    label(g, 28, 120, 'RUSH', { size: 9, fill: '#ffffff', weight: 800, ls: 1.6, font: FONT });
    label(g, 28, 131, 'FIVE', { size: 6.5, fill: CY, weight: 800, ls: 2, font: FONT });
    formKit.tzBadge(g, 300, 132, '#6c747b', 3.8);
    label(g, 300, 24, 'VALUE', { size: 5, fill: '#9fb3c8', weight: 700, font: FONT });
    svg('rect', { x: 286, y: 92, width: 28, height: 12, rx: 6, fill: '#22272b', stroke: '#3a4248', 'stroke-width': 0.6 }, g);
    label(g, 300, 98, 'BACK', { size: 4.8, fill: '#d8dde2', weight: 700, font: FONT });
    const rings = [], labels = [];
    for (let k = 0; k < 4; k++) {
      svg('rect', { x: FX(k) - 32, y: 158, width: 64, height: 12, rx: 3, fill: '#050608', stroke: '#24414d', 'stroke-width': 0.7 }, g);
      labels.push(svg('text', { x: FX(k), y: 164.4, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-family': FONT, 'font-weight': 600, 'font-size': 6, fill: '#8d98a0', 'pointer-events': 'none' }, g, ''));
      svg('circle', { cx: FX(k), cy: 206, r: 20, fill: '#0b0c0d', stroke: '#2d3236', 'stroke-width': 0.8 }, g);
      rings.push(svg('circle', { cx: FX(k), cy: 206, r: 17.5, fill: 'none', stroke: CY, 'stroke-width': 2.2, 'stroke-opacity': 0.2 }, g));
    }
    svg('rect', { x: 346, y: 8, width: 82, height: 230, rx: 10, fill: '#0b0c0d', stroke: '#000', 'stroke-opacity': 0.6 }, g);
    label(g, 387, 17, 'TOE', { size: 4.4, fill: '#6c747b', weight: 700, font: FONT });
    if (ctx.block) kit.live.set(ctx.block.id, { rings, labels });
    formKit.placeControls(ctx, d.controls, theme);
    return { w: W, h: H, theme, jacks: kit.topJacks(d, W, ctx.flip, 60, 300) };
  });
  const controls = [
    SCREEN('hr-touch', { x: 152, y: 72, w: 200, h: 112, interactive: true, bg: '#050608', bezel: '#020203' }),
    K('_vol', 'VOLUME', { x: 28, y: 44, r: 10, min: -30, max: 6, def: 0, virtual: true, display: db, labelPos: 'below' }),
    SCREEN('hr-enc', { x: 300, y: 58, w: 40, h: 40, interactive: true, bg: 'transparent', bezel: 'transparent' }),
    FOOT({ action: 'mfx', mfx: 'btn', btn: 'back', style: 'plate', w: 28, h: 12, x: 300, y: 98 }),
    ...[0, 1, 2, 3].map((k) => FOOT({ action: 'mfx', mfx: 'fs', fs: k, style: 'stomp', r: 13, x: FX(k), y: 206 })),
    TREADLE('_tre', { x: 387, y: 128, w: 70, h: 200, def: 1, virtual: true, color: '#1d2023', logo: 'RUSH', logoColor: '#3d6f80', logoFont: FONT, logoSize: 12 }),
    FOOT({ action: 'mfx', mfx: 'btn', btn: 'toe', style: 'plate', w: 70, h: 22, x: 387, y: 38 }),
  ];
  const d = def({
    id: ID, name: 'Rush Five', ref: 'Headrush MX5', brand: 'Headrush', code: 'RUSH FIVE', typeName: 'Touchscreen amp & effects modeler', cat: 'Multi-FX', kind: 'Multi-FX',
    form: 'hr-mx', color: '#16181a', cost: 6, alwaysOn: true, noBypassClick: true,
    ports: { ins: ['INPUT'], outs: ['OUT L/MONO', 'OUT R', 'PHONES'] }, jackKinds: { o2: 'phones' },
    ctrl: { ins: [] },
    controls,
    desc: 'Tap a block on the screen to edit it (drag the dials, swipe for pages) or tap + to add one. The pedal works the wah while it is on, otherwise volume; tap TOE to switch the wah, hold switch 4 to change the footswitch mode.',
  });
  kit.register(d, {
    n: N, knobs: 0, sel0: 2, layout: () => [1, 2, 3, 4, 5, 6, 7], inputGate: true, looper: true, presets,
    foot(id, ctl, down) {
      if (ctl.mfx === 'fs') return footswitch(id, ctl.fs, down);
      if (!down) return;
      if (ctl.btn === 'back') back(id);
      else if (ctl.btn === 'toe') {
        const u = U(id);
        const w = [1, 2, 3, 4, 5, 6, 7].find((i) => { const m = kit.slotModel(u, i); return m && m.cat === 'wah'; });
        if (w) { kit.toggleSlot(id, w); kit.say(id, kit.slotOn(U(id), w) ? 'WAH ON' : 'WAH OFF'); } else kit.say(id, 'No wah block');
      }
    },
    treadle(id, v) {
      const u = U(id);
      const wah = [1, 2, 3, 4, 5, 6, 7].some((i) => { const m = kit.slotModel(u, i); return m && m.cat === 'wah' && kit.slotOn(u, i); });
      if (wah) kit.exp(id, 1, v);
      else { tz.app.setParam(id, '_pv', v); kit.exp(id, 2, v); }
    },
    init: { _pv: 1 },
    volume: (u) => (u._vol ?? 0) + ((u._pv ?? 1) < 0.02 ? -60 : 40 * Math.log10(u._pv ?? 1)),
  });
  tz.addDefs([d]);
}
