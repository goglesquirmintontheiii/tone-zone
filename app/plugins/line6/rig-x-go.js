// "Rig X Go" – inspired by the Line 6 POD Go.
// 4.3" colour screen with the fixed POD-style signal flow (Wah, Volume, FX 1, Amp, Cab, EQ, FX 2–4), nav encoder,
// six knobs under the screen (parameter pages), < PAGE / PAGE >, ACTION, HOME buttons, VOLUME knob, built-in
// expression treadle with toe switch (wah ↔ volume), footswitches A–D + MODE + TAP and BANK ▼ / ▲.
import { CATS, pText } from './mfx-kit.js';

export function registerRigXGo(tz, kit) {
  const { K, FOOT, SCREEN, TREADLE, def, db } = tz.helpers;
  const { svg, label, formKit, setA, setText } = tz.gfx;
  const ID = 'l6.rigxgo';
  const N = 9;
  const FONT = "Verdana, 'DejaVu Sans', Geneva, sans-serif";
  const COL = { dist: '#ffb000', dyn: '#ffe14d', eq: '#b9c2cc', mod: '#4aa3ff', dly: '#54e08a', rev: '#ff9a4a', pitch: '#c792ff', filter: '#ff7ce0', wah: '#c792ff', vol: '#6ee0d8', amp: '#ff5a5a', ampo: '#ff5a5a', cab: '#d24b55' };
  const FIXED = { 1: 'wah', 2: 'vol', 4: 'ampo', 5: 'cab', 6: 'eq' };
  const SLOTNAME = { 1: 'WAH', 2: 'VOL', 3: 'FX 1', 4: 'AMP', 5: 'CAB', 6: 'EQ', 7: 'FX 2', 8: 'FX 3', 9: 'FX 4' };
  const FLEX = ['dist', 'dyn', 'mod', 'dly', 'rev', 'pitch', 'filter'];
  const MODES = ['STOMP', 'SNAPSHOT', 'PRESET'];
  const FSL = ['A', 'B', 'C', 'D', 'BANK ▼', 'MODE', 'TAP', 'BANK ▲'];
  const SNAPCOL = ['#ff4d4d', '#4aa3ff', '#54e08a', '#ffe14d'];
  const pName = (k) => `${String(Math.floor(k / 4) + 1).padStart(2, '0')}${'ABCD'[k % 4]}`;

  const presets = [
    { name: 'Clean Machine', slots: { 1: ['fassel', {}, true], 2: ['volpedal'], 3: ['dlxcomp', { sustain: 0.4 }], 4: ['a-ustwin', {}], 5: ['c-2x12twin'], 6: ['paraeq', {}], 7: ['plasti', {}, true], 8: ['adriatic', { mix: 0.25 }], 9: ['hall', { mix: 0.25 }] } },
    { name: 'Crunch Rhythm', slots: { 1: ['fassel', {}, true], 2: ['volpedal'], 3: ['scream', { gain: 0.25, level: 0.65 }, true], 4: ['a-plexi', {}], 5: ['c-4x12gb'], 6: ['paraeq', {}], 7: ['grayflg', {}, true], 8: ['tape', { mix: 0.2 }], 9: ['room', { mix: 0.2 }] } },
    { name: 'Lead Boost', slots: { 1: ['chromewah', {}, true], 2: ['volpedal'], 3: ['minotaur', { gain: 0.4 }], 4: ['a-jcm', {}], 5: ['c-4x12t75'], 6: ['paraeq', { mid1gain: 2 }], 7: ['plasti', {}, true], 8: ['simple', { time: 450, mix: 0.25 }], 9: ['plate', { mix: 0.22 }] } },
    { name: 'Hi Gain', slots: { 1: ['fassel', {}, true], 2: ['volpedal'], 3: ['gate', { threshold: 0.45 }], 4: ['a-recto', {}], 5: ['c-4x12v30'], 6: ['paraeq', {}], 7: ['scream', { gain: 0.1, level: 0.75 }, true], 8: ['simple', { mix: 0.18 }], 9: ['room', { mix: 0.15 }] } },
    { name: 'Swirl', slots: { 1: ['fassel', {}, true], 2: ['volpedal'], 3: ['univibe', {}], 4: ['a-ac30', {}], 5: ['c-2x12blue'], 6: ['paraeq', {}], 7: ['tzflg', {}, true], 8: ['cosmos', { mix: 0.25 }], 9: ['spring', { mix: 0.3 }] } },
    { name: 'Ambient Pad', slots: { 1: ['fassel', {}, true], 2: ['volpedal'], 3: ['lastudio', {}], 4: ['a-usdlx', { 'a.gain': 0.35 }], 5: ['c-1x12us'], 6: ['paraeq', {}], 7: ['dual', { mix: 0.35 }], 8: ['shimdly', { mix: 0.3 }, true], 9: ['shimmer', { mix: 0.4 }] } },
  ];
  const SETTINGS = [
    { n: 'Toe Switch', p: '_toeMode', d: 0, opts: ['Wah On/Off', 'EXP 1/EXP 2'] },
    { n: 'Snapshot Edits', p: '_snapEdit', d: 1, opts: ['Discard', 'Recall'] },
    { n: 'Tap Tempo Delays', p: '_tapSync', d: 1, opts: ['Off', 'On'] },
    { n: 'Tuner Reference', p: '_tref', d: 440, min: 425, max: 455, step: 1, f: (v) => v + ' Hz' },
    { n: 'Tuner Mute', p: '_tmute', d: 1, opts: ['Off', 'On'] },
    { n: 'Output Level', p: '_vol', d: 0, min: -30, max: 6, step: 0.5, f: (v) => (v > 0 ? '+' : '') + v.toFixed(1) + ' dB' },
  ];
  const B = (id) => kit.blk(id);
  const U = (id) => kit.ui(B(id));
  const assignable = (u) => [3, 7, 8, 9, 1, 6].filter((i) => kit.slotModel(u, i)).slice(0, 4);
  const M = kit.menus({
    n: N, col: COL, settings: SETTINGS,
    cats: (i) => (FIXED[i] ? [] : FLEX), fixedCat: (i) => FIXED[i], noNone: (i) => !!FIXED[i],
    action: (id) => {
      const n = kit.nav(id), u = U(id);
      const fixed = !!FIXED[n.sel];
      return [
        { t: 'Bypass', r: kit.slotModel(u, n.sel) ? (kit.slotOn(u, n.sel) ? 'On' : 'Off') : '–', act: () => kit.toggleSlot(id, n.sel) },
        { t: 'Copy Block', act: () => kit.copySlot(id, n.sel) },
        { t: 'Paste Block', act: () => (fixed ? kit.say(id, 'Fixed block') : kit.pasteSlot(id, n.sel)) },
        { t: 'Clear Block', act: () => { if (fixed) kit.say(id, 'Fixed block'); else { kit.clearSlot(id, n.sel); n.view = 'home'; } } },
        { t: 'Exit', act: () => (n.view = 'home') },
      ];
    },
    menu: (id) => {
      const n = kit.nav(id), u = U(id);
      return [
        { t: 'Global Settings', r: '▸', act: () => M.open(id, 'settings') },
        { t: 'Tuner', r: '▸', act: () => kit.tuner(id, true) },
        { t: 'Tempo', r: (u._bpm ?? 120).toFixed(0) + ' BPM', turn: (d) => kit.setTempo(id, Math.max(30, Math.min(300, (u._bpm ?? 120) + d))), act: () => {} },
        { t: 'Reload Preset', r: pName(u._preset | 0), act: () => { kit.loadPreset(id, u._preset | 0, true); n.view = 'home'; } },
        { t: 'Exit', act: () => (n.view = 'home') },
      ];
    },
  });
  const TITLES = { cats: 'FX TYPE', models: '', action: 'ACTION', menu: 'MENU', settings: 'GLOBAL SETTINGS' };

  function turn(id, ctl, d) {
    const n = kit.nav(id);
    if (n.view === 'tuner') return;
    if (n.view === 'home' || n.view === 'play') { n.view = 'home'; kit.selectSlot(id, ((n.sel - 1 + d + N) % N) + 1); }
    else if (n.view === 'settings' || n.view === 'menu') M.valueTurn(id, d);
    else M.move(id, d);
  }
  function push(id) {
    const n = kit.nav(id);
    if (n.view === 'tuner') return kit.tuner(id, false);
    if (n.view === 'home' || n.view === 'play') return M.openSlot(id);
    if (n.view === 'settings' || n.view === 'menu') { const it = M.items(id)[n.cur]; if (it && (it.row || it.turn)) return M.move(id, 1); }
    M.activate(id);
  }
  function button(id, name, down) {
    const n = kit.nav(id);
    if (name === 'home') return kit.press(id + '|home', down, {
      tap: () => { if (n.view === 'tuner') kit.tuner(id, false); else n.view = n.view === 'home' ? 'play' : 'home'; kit.bump(id); },
      hold: () => { M.open(id, 'menu'); kit.bump(id); }, ms: 750,
    });
    if (!down) return;
    if (name === 'action') { if (n.view === 'home' || n.view === 'play') M.open(id, 'action'); else M.back(id); }
    else if (name === 'pgl' || name === 'pgr') { const d = name === 'pgl' ? -1 : 1; if (M.isList(n.view)) M.move(id, d * 6); else { n.view = 'home'; kit.page(id, d); } }
    else if (name === 'toe') toe(id);
  }
  function toe(id) {
    const u = U(id);
    if ((u._toeMode ?? 0) > 0.5) { tz.app.setParam(id, '_expSel', (u._expSel ?? 0) > 0.5 ? 0 : 1); kit.say(id, (u._expSel ?? 0) > 0.5 ? 'EXP 1 (wah)' : 'EXP 2 (volume)'); }
    else { kit.toggleSlot(id, 1); kit.say(id, kit.slotOn(U(id), 1) ? 'WAH ON' : 'WAH OFF'); }
  }
  function footswitch(id, k, down) {
    const n = kit.nav(id);
    n.fsMode = n.fsMode || 0;
    n.bank = n.bank ?? Math.floor((U(id)._preset | 0) / 4);
    if (k === 6) return kit.press(id + '|tap', down, { tap: () => (n.view === 'tuner' ? kit.tuner(id, false) : kit.tap(id)), hold: () => kit.tuner(id), ms: 800 });
    if (!down) return;
    if (n.view === 'tuner') return kit.tuner(id, false);
    const u = U(id);
    if (k === 5) { n.fsMode = (n.fsMode + 1) % 3; return kit.say(id, MODES[n.fsMode]); }
    if (k === 4 || k === 7) {
      const d = k === 4 ? -1 : 1;
      if (n.fsMode === 2) { n.bank = (n.bank + d + 8) % 8; kit.say(id, 'BANK ' + (n.bank + 1)); }
      else kit.loadPreset(id, ((u._preset | 0) + d + 32) % 32);
      return;
    }
    if (n.fsMode === 0) { const s = assignable(u)[k]; if (s) { kit.toggleSlot(id, s); kit.selectSlot(id, s); } }
    else if (n.fsMode === 1) kit.recallSnap(id, k);
    else kit.loadPreset(id, n.bank * 4 + k);
  }
  function fsInfo(id, u, n, k, now) {
    const mode = n.fsMode || 0;
    if (k === 5) return { t: MODES[mode], c: '#ffffff', lit: true };
    if (k === 6) { const per = 60000 / (u._bpm || 120); return { t: 'TAP', c: '#ff4d4d', lit: now % per < 90 }; }
    if (k === 4 || k === 7) return { t: mode === 2 ? FSL[k] : k === 4 ? 'PRESET ▼' : 'PRESET ▲', c: '#9aa3b0', lit: false };
    if (mode === 0) { const s = assignable(u)[k]; const m = s && kit.slotModel(u, s); return m ? { t: m.n.slice(0, 12), c: COL[m.cat], lit: kit.slotOn(u, s) } : { t: '—', c: '#444', lit: false }; }
    if (mode === 1) return { t: 'SNAP ' + (k + 1), c: SNAPCOL[k], lit: (u._snap | 0) === k };
    const bank = n.bank ?? Math.floor((u._preset | 0) / 4);
    const p = bank * 4 + k;
    return { t: pName(p), c: '#4aa3ff', lit: (u._preset | 0) === p };
  }

  // ---------------------------------------------------------------- screen
  const T = (g, x, y, s, o = {}) => kit.svgT(g, x, y, s, Object.assign({ font: FONT }, o));
  const show = (el, on) => setA(el, 'display', on ? 'inline' : 'none');
  const BX = (i) => 12 + (i - 1) * 23.2;
  const arc = (cx, cy, r, a0, a1) => {
    const p = (a) => `${(cx + Math.sin(a) * r).toFixed(2)} ${(cy - Math.cos(a) * r).toFixed(2)}`;
    return `M${p(a0)} A${r} ${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${p(a1)}`;
  };
  tz.addScreen('rxg-main', {
    build(s, g, w, h) {
      s.w = w; s.h = h;
      const defs = svg('defs', {}, g);
      const gid = 'rxg' + Math.random().toString(36).slice(2, 7);
      const lg = svg('linearGradient', { id: gid, x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
      svg('stop', { offset: 0, 'stop-color': '#2b3038' }, lg);
      svg('stop', { offset: 1, 'stop-color': '#14171c' }, lg);
      svg('rect', { width: w, height: h, fill: `url(#${gid})` }, g);
      // home
      const H = (s.home = svg('g', {}, g));
      svg('rect', { width: w, height: 13, fill: '#0e1013' }, H);
      s.bankBg = svg('rect', { x: 2, y: 2, width: 20, height: 9, rx: 2, fill: '#2a7fff' }, H);
      s.bank = T(H, 12, 6.7, '', { size: 5.4, weight: 700, anchor: 'middle' });
      s.pname = T(H, w / 2, 6.7, '', { size: 6.6, weight: 700, anchor: 'middle' });
      s.mode = T(H, w - 3, 6.7, '', { size: 4.6, anchor: 'end', fill: '#9aa3b0' });
      svg('path', { d: `M4 33 H${w - 4}`, stroke: '#59616d', 'stroke-width': 1 }, H);
      s.blocks = [];
      for (let i = 1; i <= N; i++) {
        const x = BX(i);
        const bg = svg('rect', { x: x - 9.5, y: 21, width: 19, height: 24, rx: 4, fill: '#20242a', stroke: '#59616d', 'stroke-width': 0.7 }, H);
        const band = svg('rect', { x: x - 9.5, y: 21, width: 19, height: 6, rx: 3, fill: '#555' }, H);
        const tag = T(H, x, 24.2, SLOTNAME[i], { size: 3.5, weight: 700, anchor: 'middle', fill: '#000' });
        const nm = T(H, x, 35.5, '', { size: 3.3, anchor: 'middle', fill: '#e8ecf1' });
        const nm2 = T(H, x, 40, '', { size: 3.3, anchor: 'middle', fill: '#e8ecf1' });
        const sel = svg('path', { d: `M${x - 3} 50 L${x} 47 L${x + 3} 50 Z`, fill: '#fff', 'fill-opacity': 0 }, H);
        s.blocks.push({ bg, band, tag, nm, nm2, sel });
      }
      s.mName = T(H, 4, 56, '', { size: 6.6, weight: 700 });
      s.mCat = T(H, w - 4, 56, '', { size: 4.4, anchor: 'end', fill: '#9aa3b0' });
      s.dials = [];
      for (let k = 0; k < 6; k++) {
        const cx = 17.5 + k * ((w - 35) / 5), cy = 75;
        svg('path', { d: arc(cx, cy, 9, -2.4, 2.4), stroke: '#3a414c', 'stroke-width': 2.4, fill: 'none', 'stroke-linecap': 'round' }, H);
        const a = svg('path', { d: '', stroke: '#2a7fff', 'stroke-width': 2.4, fill: 'none', 'stroke-linecap': 'round' }, H);
        const v = T(H, cx, cy + 0.5, '', { size: 4.2, anchor: 'middle', weight: 700 });
        const nm = T(H, cx, cy + 14, '', { size: 3.9, anchor: 'middle', fill: '#b8c0cc' });
        s.dials.push({ a, v, nm, cx, cy });
      }
      s.pg = T(H, w / 2, 94.5, '', { size: 3.6, anchor: 'middle', fill: '#78818e' });
      // list
      const L = (s.list = svg('g', {}, g));
      svg('rect', { width: w, height: 13, fill: '#2a7fff' }, L);
      s.lt = T(L, 4, 6.7, '', { size: 6, weight: 700 });
      s.ls = T(L, w - 4, 6.7, '', { size: 4.6, anchor: 'end', fill: '#dbe8ff' });
      s.rows = [];
      for (let r = 0; r < 7; r++) {
        const y = 14 + r * 11.6;
        const bg = svg('rect', { x: 0, y, width: w, height: 11.6, fill: r % 2 ? '#1b1f25' : '#22272e' }, L);
        const dot = svg('circle', { cx: 7, cy: y + 5.8, r: 2.2, fill: '#555' }, L);
        const t = T(L, 13, y + 6, '', { size: 5.4 });
        const rr = T(L, w - 5, y + 6, '', { size: 5, anchor: 'end', fill: '#9aa3b0' });
        s.rows.push({ bg, dot, t, rr, y, zebra: r % 2 ? '#1b1f25' : '#22272e' });
      }
      // tuner
      const TU = (s.tun = svg('g', {}, g));
      svg('rect', { width: w, height: 13, fill: '#0e1013' }, TU);
      T(TU, w / 2, 6.7, 'TUNER', { size: 6, weight: 700, anchor: 'middle' });
      s.segs = [];
      for (let k = 0; k < 25; k++) s.segs.push(svg('rect', { x: 8 + k * ((w - 16) / 25), y: 58, width: (w - 16) / 25 - 1.6, height: 12, rx: 1.2, fill: '#2b3038' }, TU));
      s.tn = T(TU, w / 2, 37, '', { size: 24, weight: 700, anchor: 'middle' });
      s.tc = T(TU, w / 2, 80, '', { size: 5.2, anchor: 'middle', fill: '#9aa3b0' });
      // play view: footswitch overview
      const PV = (s.play = svg('g', {}, g));
      s.pvT = T(PV, w / 2, 11, '', { size: 9, weight: 700, anchor: 'middle' });
      s.pvS = T(PV, w / 2, 22, '', { size: 4.8, anchor: 'middle', fill: '#9aa3b0' });
      s.pv = [];
      for (let k = 0; k < 8; k++) {
        const x = 5 + (k % 4) * ((w - 10) / 4), y = k < 4 ? 30 : 62, cw = (w - 10) / 4 - 4;
        const r = svg('rect', { x, y, width: cw, height: 28, rx: 5, fill: '#20242a', stroke: '#59616d', 'stroke-width': 0.8 }, PV);
        const t = T(PV, x + cw / 2, y + 17, '', { size: 5.2, anchor: 'middle', weight: 700 });
        T(PV, x + cw / 2, y + 6.5, FSL[k], { size: 3.6, anchor: 'middle', fill: '#78818e' });
        s.pv.push({ r, t });
      }
      s.toast = svg('g', { display: 'none' }, g);
      svg('rect', { x: w / 2 - 52, y: h - 22, width: 104, height: 15, rx: 7.5, fill: '#f2f4f7' }, s.toast);
      s.toastT = T(s.toast, w / 2, h - 14.5, '', { size: 6, anchor: 'middle', weight: 700, fill: '#14171c' });
      s.sig = '';
    },
    update(s, st, nv, now) {
      const b = nv.block, id = b.id, u = s.ui, n = kit.nav(id), w = s.w;
      const lv = kit.live.get(id);
      if (lv) for (let k = 0; k < 8; k++) {
        const fi = fsInfo(id, u, n, k, now);
        setA(lv.rings[k], 'stroke', fi.c);
        setA(lv.rings[k], 'stroke-opacity', fi.lit ? 1 : 0.2);
      }
      const ton = n.msg && now - n.msgT < 1300;
      show(s.toast, ton);
      if (ton) setText(s.toastT, n.msg);
      const v = n.view;
      show(s.home, v === 'home'); show(s.list, M.isList(v)); show(s.tun, v === 'tuner'); show(s.play, v === 'play');
      if (v === 'tuner') {
        const t = st && st.tu && st.tu.tuner;
        const c = t && t.note ? t.cents : null;
        const idx = c === null ? -1 : Math.round(Math.max(-1, Math.min(1, c / 50)) * 12) + 12;
        s.segs.forEach((r, k) => setA(r, 'fill', k === idx ? (Math.abs(c) < 2 ? '#54e08a' : '#ff4d4d') : k === 12 ? '#3c5a47' : '#2b3038'));
        setText(s.tn, t && t.note ? t.note : '–');
        setText(s.tc, t && t.note ? `${c >= 0 ? '+' : ''}${c.toFixed(1)} cents` : `${u._tref ?? 440} Hz`);
        return;
      }
      const sig = n.rev + v + n.sel + '|' + n.page + '|' + n.cur + '|' + (n.fsMode || 0) + JSON.stringify(b.params) + (b.mfx ? b.mfx.name : '');
      if (sig === s.sig) return;
      s.sig = sig;
      if (v === 'home') {
        setText(s.bank, pName(u._preset | 0));
        setText(s.pname, kit.presetName(b));
        setText(s.mode, `${MODES[n.fsMode || 0]} · SNAP ${(u._snap | 0) + 1} · ${Math.round(u._bpm ?? 120)}`);
        s.blocks.forEach((e, k) => {
          const i = k + 1, m = kit.slotModel(u, i), on = kit.slotOn(u, i);
          const c = m ? COL[m.cat] : '#59616d';
          setA(e.band, 'fill', m && on ? c : '#3a414c');
          setA(e.bg, 'stroke', i === n.sel ? '#ffffff' : m && on ? c : '#59616d');
          setA(e.bg, 'stroke-width', i === n.sel ? 1.3 : 0.7);
          setA(e.tag, 'fill', m && on ? '#000' : '#9aa3b0');
          const words = m ? m.n.split(' ') : ['—'];
          setText(e.nm, (words[0] || '').slice(0, 7));
          setText(e.nm2, words.slice(1).join(' ').slice(0, 7));
          setA(e.nm, 'fill', m && on ? '#e8ecf1' : '#78818e');
          setA(e.nm2, 'fill', m && on ? '#e8ecf1' : '#78818e');
          setA(e.sel, 'fill-opacity', i === n.sel ? 1 : 0);
        });
        const m = kit.slotModel(u, n.sel);
        setText(s.mName, m ? m.n : SLOTNAME[n.sel] + ' — empty');
        setText(s.mCat, m ? `${SLOTNAME[n.sel]} · ${CATS[m.cat].n}${kit.slotOn(u, n.sel) ? '' : ' · OFF'}` : 'push the knob to choose');
        const np = kit.pages(u, n.sel, 6);
        s.dials.forEach((e, k) => {
          const j = n.page * 6 + k, p = m && m.P[j];
          const pos = p ? kit.slotPos(u, n.sel, j, m) : 0;
          setA(e.a, 'd', p && pos > 0.005 ? arc(e.cx, e.cy, 9, -2.4, -2.4 + 4.8 * pos) : '');
          setA(e.a, 'stroke', m ? COL[m.cat] : '#2a7fff');
          setText(e.v, p ? pText(p, pos) : '');
          setText(e.nm, p ? p.n : '');
        });
        setText(s.pg, m && np > 1 ? `◂ page ${n.page + 1} of ${np} ▸` : '');
      } else if (M.isList(v)) {
        const it = M.items(id);
        n.cur = Math.min(n.cur, Math.max(0, it.length - 1));
        n.top = kit.windowTop(it.length, n.cur, n.top || 0, 7);
        setText(s.lt, v === 'models' ? CATS[n.cat].n.toUpperCase() : TITLES[v]);
        setText(s.ls, v === 'menu' || v === 'settings' ? pName(u._preset | 0) : SLOTNAME[n.sel]);
        s.rows.forEach((r, k) => {
          const e = it[n.top + k];
          show(r.t, !!e); show(r.rr, !!e); show(r.dot, !!(e && e.c));
          const sel = e && n.top + k === n.cur;
          setA(r.bg, 'fill', sel ? '#e6eaf0' : r.zebra);
          if (!e) return;
          setText(r.t, e.t + (e.mark ? '  ✓' : ''));
          setText(r.rr, e.r || '');
          if (e.c) setA(r.dot, 'fill', e.c);
          setA(r.t, 'fill', sel ? '#14171c' : '#e8ecf1');
          setA(r.rr, 'fill', sel ? '#3a414c' : '#9aa3b0');
          setA(r.t, 'x', e.c ? 13 : 6);
        });
      } else if (v === 'play') {
        setText(s.pvT, `${pName(u._preset | 0)}  ${kit.presetName(b)}`);
        setText(s.pvS, `${MODES[n.fsMode || 0]} MODE · SNAPSHOT ${(u._snap | 0) + 1} · ${Math.round(u._bpm ?? 120)} BPM`);
        s.pv.forEach((c, k) => {
          const fi = fsInfo(id, u, n, k, now);
          setText(c.t, fi.t);
          setA(c.r, 'stroke', fi.c);
          setA(c.r, 'fill', fi.lit ? fi.c : '#20242a');
          setA(c.t, 'fill', fi.lit ? '#000' : '#e8ecf1');
        });
      }
      void w;
    },
    pointer(s, nv, type, pt) {
      if (type !== 'down') return;
      const id = nv.block.id, n = kit.nav(id);
      if (n.view === 'home') {
        if (pt.y > 18 && pt.y < 50) {
          const i = Math.round((pt.x - 12) / 23.2) + 1;
          if (i >= 1 && i <= N) { if (n.sel === i) M.openSlot(id); else kit.selectSlot(id, i); }
        }
      } else if (M.isList(n.view)) {
        if (pt.y < 13) M.back(id);
        else { const r = Math.floor((pt.y - 14) / 11.6); const it = M.items(id); if (r >= 0 && r < 7 && n.top + r < it.length) { if (n.cur === n.top + r) M.activate(id); else n.cur = n.top + r; } }
      } else if (n.view === 'tuner') kit.tuner(id, false);
      else n.view = 'home';
      kit.bump(id);
    },
  });
  kit.addEncoder('rxg-enc', (s, g, w, h) => {
    const cx = w / 2, cy = h / 2, r = Math.min(w, h) / 2 - 2;
    svg('circle', { cx, cy: cy + 1.4, r: r + 1, fill: '#000', 'fill-opacity': 0.5 }, g);
    svg('circle', { cx, cy, r, fill: '#c9ccd1', stroke: '#7d828a', 'stroke-width': 0.8 }, g);
    svg('circle', { cx, cy, r: r * 0.78, fill: 'url(#g-chromeDome)' }, g);
    const rot = svg('g', {}, svg('g', { transform: `translate(${cx},${cy})` }, g));
    svg('circle', { cx: 0, cy: -r * 0.55, r: 1.3, fill: '#2a2d33' }, rot);
    svg('rect', { width: w, height: h, fill: 'transparent' }, g);
    return rot;
  }, turn, push);

  // ---------------------------------------------------------------- enclosure
  const W = 566, H = 310;
  const BTNS = [['pgl', '◂ PAGE', 362, 44], ['pgr', 'PAGE ▸', 410, 44], ['action', 'ACTION', 362, 88], ['home', 'HOME', 410, 88]];
  const FSX = (k) => 62 + (k % 4) * 106, FSY = (k) => (k < 4 ? 196 : 270);
  tz.addForm('rxg-podgo', (ctx, d) => {
    const g = ctx.g;
    // kidney-ish shell: dark grey with a lighter top deck
    formKit.body(g, W, H, '#2a2c30', { rx: 22 });
    svg('rect', { x: 8, y: 8, width: 436, height: 148, rx: 16, fill: '#1c1e21' }, g);
    svg('rect', { x: 8, y: 8, width: 436, height: 148, rx: 16, fill: 'none', stroke: '#000', 'stroke-opacity': 0.5 }, g);
    const theme = { text: '#d7dade', knob: 'mxr', labelSize: 5.4, labelFont: FONT };
    label(g, 60, 128, 'RIG X GO', { size: 11, fill: '#e9ebee', weight: 800, ls: 1.2, font: FONT });
    formKit.tzBadge(g, 60, 141, '#8a8f97', 4);
    label(g, 60, 18, 'VOLUME', { size: 4.8, fill: '#9aa0a8', weight: 700, font: FONT });
    for (const [, t, x, y] of BTNS) {
      svg('rect', { x: x - 17, y: y - 8, width: 34, height: 16, rx: 8, fill: '#000', 'fill-opacity': 0.55 }, g);
      svg('rect', { x: x - 16, y: y - 7.5, width: 32, height: 14, rx: 7, fill: '#3a3d43', stroke: '#55595f', 'stroke-width': 0.6 }, g);
      label(g, x, y + 15, t, { size: 4.8, fill: '#c6cad0', weight: 700, font: FONT });
    }
    const rings = [];
    FSL.forEach((t, k) => {
      const x = FSX(k), y = FSY(k);
      svg('circle', { cx: x, cy: y, r: 18, fill: '#18191c', stroke: '#45484e', 'stroke-width': 0.8 }, g);
      rings.push(svg('circle', { cx: x, cy: y, r: 15.6, fill: 'none', stroke: '#444', 'stroke-width': 2, 'stroke-opacity': 0.2 }, g));
      label(g, x, y - 26, t, { size: 5.6, fill: '#c6cad0', weight: 700, font: FONT });
    });
    // treadle well
    svg('rect', { x: 452, y: 14, width: 104, height: 282, rx: 14, fill: '#141518', stroke: '#000', 'stroke-opacity': 0.6 }, g);
    label(g, 504, 302, 'WAH / VOL', { size: 4.6, fill: '#8a8f97', weight: 700, font: FONT });
    label(g, 504, 24, 'TOE', { size: 4.4, fill: '#8a8f97', weight: 700, font: FONT });
    if (ctx.block) kit.live.set(ctx.block.id, { rings });
    formKit.placeControls(ctx, d.controls, theme);
    const X = (x) => (ctx.flip ? W - x : x);
    const jacks = [];
    d.ctrl.ins.forEach((c, i) => jacks.push({ key: 'ic' + i, dir: 'in', port: 'c' + i, label: c.label, side: 'top', x: X(150 + i * 30), y: -2, kind: 'ctrl' }));
    d.ports.outs.forEach((l, i) => jacks.push({ key: 'o' + i, dir: 'out', port: i, label: l.replace('OUTPUT', 'OUT'), side: 'top', x: X(300 + i * 30), y: -2 }));
    d.ports.ins.forEach((l, i) => jacks.push({ key: 'i' + i, dir: 'in', port: i, label: l.replace('INPUT', 'IN'), side: 'top', x: X(400), y: -2 }));
    return { w: W, h: H, theme, jacks };
  });

  const controls = [
    SCREEN('rxg-main', { x: 226, y: 66, w: 210, h: 98, interactive: true, bg: '#14171c', bezel: '#0a0b0d' }),
    K('_vol', 'VOLUME', { x: 60, y: 42, r: 11, min: -30, max: 6, def: 0, virtual: true, display: db, labelPos: 'none' }),
    SCREEN('rxg-enc', { x: 60, y: 90, w: 30, h: 30, interactive: true, bg: 'transparent', bezel: 'transparent' }),
    ...[1, 2, 3, 4, 5, 6].map((k) => K('k' + k, String(k), { x: 136 + (k - 1) * 36, y: 136, r: 9.5, def: 0.5, virtual: true, labelPos: 'none' })),
    ...BTNS.map(([btn, , x, y]) => FOOT({ action: 'mfx', mfx: 'btn', btn, style: 'plate', w: 32, h: 14, x, y })),
    ...FSL.map((t, k) => FOOT({ action: 'mfx', mfx: 'fs', fs: k, style: 'soft', r: 12, x: FSX(k), y: FSY(k) })),
    TREADLE('_tre', { x: 504, y: 160, w: 86, h: 250, def: 0.5, virtual: true, color: '#202226', logo: 'RIG X', logoColor: '#6f747c', logoFont: "'Oswald', sans-serif", logoSize: 13 }),
    FOOT({ action: 'mfx', mfx: 'btn', btn: 'toe', style: 'plate', w: 86, h: 22, x: 504, y: 40 }),
  ];
  const d = def({
    id: ID, name: 'Rig X Go', ref: 'Line 6 POD Go', brand: 'Line 6', code: 'RIG X GO', typeName: 'Amp modeler & effects with expression pedal', cat: 'Multi-FX', kind: 'Multi-FX',
    form: 'rxg-podgo', color: '#2a2c30', stereo: 'both', cost: 6, alwaysOn: true, noBypassClick: true,
    monoPorts: { ins: ['INPUT'], outs: ['OUTPUT L/MONO'] }, stereoPorts: { ins: ['INPUT'], outs: ['OUTPUT L/MONO', 'OUTPUT R'] }, ports: { ins: ['INPUT'], outs: ['OUTPUT L/MONO'] },
    ctrl: { ins: [{ label: 'EXP 2', hook: true, exp: 2 }] },
    controls,
    tags: ['pod', 'modeler', 'snapshot', 'expression'],
    desc: 'Fixed POD-style signal flow: Wah, Volume, FX 1, Amp, Cab, EQ, FX 2–4 (the four FX slots take drives, dynamics, modulation, delays, reverbs, pitch / synth and filters). Nav knob: select a block, push to pick the FX type → model. Knobs 1–6 edit the block, < PAGE / PAGE > flip pages, ACTION = bypass / copy / paste / clear, HOME = home ↔ footswitch view, hold HOME = MENU (Global Settings, tuner, tempo). The treadle works the wah while it is on and the volume pedal otherwise; click the TOE strip to switch the wah on / off. MODE cycles STOMP / SNAPSHOT / PRESET; TAP (hold = tuner); BANK ▼▲ step presets or banks.',
  });
  kit.register(d, {
    n: N, knobs: 6, sel0: 4, layout: () => [1, 2, 3, 4, 5, 6, 7, 8, 9], inputGate: false, looper: false, presets,
    init: { _toeMode: 0, _expSel: 0 },
    foot(id, ctl, down) { if (ctl.mfx === 'btn') button(id, ctl.btn, down); else footswitch(id, ctl.fs, down); },
    treadle(id, v) {
      const u = U(id);
      const wah = (u._toeMode ?? 0) > 0.5 ? (u._expSel ?? 0) < 0.5 : kit.slotOn(u, 1) && !!kit.slotModel(u, 1);
      kit.exp(id, wah ? 1 : 2, v);
    },
  });
  tz.addDefs([d]);
}
