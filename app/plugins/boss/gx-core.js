// "GX-1000 Core", inspired by the BOSS GT-1000CORE.
// Small black box with a monochrome LCD, knobs 1-3 + MASTER, cursor / ENTER / EXIT / MENU buttons and three
// footswitches (memory down, memory up, CTL). Fixed BOSS-style chain: COMP, DIST, AMP, EQ, FX1, FX2, DELAY, REVERB.
import { createKit, CATS, modelsIn, pText } from './mfx-kit.js';

export function registerGXCore(tz) {
  const kit = createKit(tz);
  const { K, FOOT, LED, SCREEN, def, db } = tz.helpers;
  const { svg, label, formKit, setA, setText } = tz.gfx;
  const ID = 'bx.gx1000core';
  const N = 8;
  const FONT = "'Courier New', 'FreeMono', 'Liberation Mono', monospace";
  const INK = '#e9f4ff', BG = '#06080d', DIMI = '#5a6f88';
  const SLOT = ['', 'COMP', 'DIST', 'AMP', 'EQ', 'FX1', 'FX2', 'DLY', 'REV'];
  const FIXED = { 1: 'dyn', 2: 'dist', 3: 'amp', 4: 'eq', 7: 'dly', 8: 'rev' };
  const FXCATS = ['mod', 'filter', 'pitch', 'wah', 'dyn', 'eq', 'vol'];
  const memName = (k) => `U${String(Math.floor(k / 4) + 1).padStart(2, '0')}-${(k % 4) + 1}`;
  const presets = [
    { name: 'JC CLEAN', slots: { 1: ['dlxcomp'], 2: ['minotaur', {}, true], 3: ['ac-jc'], 4: ['paraeq'], 5: ['dimension', {}, true], 6: ['opttrem', {}, true], 7: ['simple', { mix: 0.22 }], 8: ['hall', { mix: 0.25 }] } },
    { name: 'BRIT CRUNCH', slots: { 1: ['redsq', {}, true], 2: ['scream', { gain: 0.25, level: 0.65 }], 3: ['ac-plexi'], 4: ['paraeq'], 5: ['plasti', {}, true], 6: ['grayflg', {}, true], 7: ['tape', { mix: 0.2 }], 8: ['plate', { mix: 0.2 }] } },
    { name: 'LEAD STACK', slots: { 1: ['gate', { threshold: 0.4 }], 2: ['scream', { gain: 0.15, level: 0.75 }], 3: ['ac-slo'], 4: ['paraeq', { mid1gain: 2 }], 5: ['plasti', {}, true], 6: ['harmony', {}, true], 7: ['simple', { time: 440, mix: 0.25 }], 8: ['room', { mix: 0.18 }] } },
    { name: 'SPACE ECHO', slots: { 1: ['lastudio'], 2: ['teemah', {}, true], 3: ['ac-usdlx'], 4: ['paraeq'], 5: ['univibe', {}, true], 6: ['opttrem', {}, true], 7: ['cosmos', { mix: 0.3 }], 8: ['spring', { mix: 0.3 }] } },
    { name: 'METAL ZONE', slots: { 1: ['gate', { threshold: 0.5 }], 2: ['megadeth', { gain: 0.5 }], 3: ['ac-recto', { 'a.gain': 0.35 }], 4: ['paraeq'], 5: ['phase8', {}, true], 6: ['tzflg', {}, true], 7: ['simple', { mix: 0.15 }], 8: ['room', { mix: 0.12 }] } },
  ];
  const SETTINGS = [
    { n: 'NS (INPUT)', p: '_gate', opts: ['OFF', 'ON'] },
    { n: 'NS THRESHOLD', p: '_gateT', d: 0.4, min: 0, max: 1, step: 0.05, f: (v) => String(Math.round(v * 100)) },
    { n: 'TUNER PITCH', p: '_tref', d: 440, min: 425, max: 455, step: 1, f: (v) => v + 'Hz' },
    { n: 'TUNER OUT', p: '_tmute', d: 1, opts: ['BYPASS', 'MUTE'] },
    { n: 'DLY SYNC', p: '_tapSync', d: 1, opts: ['OFF', 'ON'] },
    { n: 'MAIN OUT', p: '_vol', d: 0, min: -30, max: 6, step: 0.5, f: (v) => (v > 0 ? '+' : '') + v.toFixed(1) + 'dB' },
  ];
  const B = (id) => kit.blk(id);
  const U = (id) => kit.ui(B(id));
  const M = kit.menus({ n: N, col: {}, settings: SETTINGS, cats: (i) => (FIXED[i] ? [] : FXCATS), fixedCat: (i) => FIXED[i], noNone: () => true });

  function button(id, name, down) {
    const n = kit.nav(id);
    if (!down) return;
    const v = n.view;
    if (v === 'tuner') return kit.tuner(id, false);
    if (name === 'left' || name === 'right') {
      const d = name === 'left' ? -1 : 1;
      if (v === 'home') kit.selectSlot(id, ((n.sel - 1 + d + N) % N) + 1);
      else if (v === 'edit') kit.page(id, d);
      else if (v === 'settings') M.valueTurn(id, d);
      else M.move(id, d);
    } else if (name === 'enter') {
      if (v === 'home') { n.view = 'edit'; kit.syncKnobs(id); }
      else if (v === 'edit') kit.toggleSlot(id, n.sel);
      else if (v === 'settings') M.move(id, 1);
      else { M.activate(id); if (n.view === 'home') n.view = 'edit'; }
    } else if (name === 'exit') {
      if (v === 'edit' || v === 'settings') n.view = 'home';
      else if (v === 'models' && !FIXED[n.sel]) { n.view = 'cats'; n.cur = Math.max(0, FXCATS.indexOf(n.cat)); }
      else if (v === 'models' || v === 'cats') n.view = 'edit';
      else n.view = 'home';
    } else if (name === 'menu') {
      if (v === 'edit') M.openSlot(id);
      else if (v === 'home') M.open(id, 'settings');
      else n.view = 'home';
    }
  }
  function footswitch(id, k, down) {
    const n = kit.nav(id);
    const u = U(id);
    if (k === 0) return kit.press(id + '|f1', down, { tap: () => (n.view === 'tuner' ? kit.tuner(id, false) : kit.loadPreset(id, ((u._preset | 0) + 19) % 20)), hold: () => kit.tuner(id), ms: 900 });
    if (k === 1) return kit.press(id + '|f2', down, { tap: () => (n.view === 'tuner' ? kit.tuner(id, false) : kit.loadPreset(id, ((u._preset | 0) + 1) % 20)), hold: () => kit.tap(id), ms: 900 });
    if (k === 2) return kit.press(id + '|f3', down, { tap: () => { kit.toggleSlot(id, 5); }, hold: () => kit.tap(id), ms: 700 });
  }

  // ---------------------------------------------------------------- dot-matrix LCD
  const T = (g, x, y, s, o = {}) => kit.svgT(g, x, y, s, Object.assign({ font: FONT, weight: 700, fill: INK }, o));
  const show = (el, on) => setA(el, 'display', on ? 'inline' : 'none');
  tz.addScreen('gx-lcd', {
    build(s, g, w, h) {
      s.w = w; s.h = h;
      svg('rect', { width: w, height: h, fill: BG }, g);
      // pixel grid
      const defs = svg('defs', {}, g);
      const pid = 'gxp' + Math.random().toString(36).slice(2, 7);
      const pat = svg('pattern', { id: pid, width: 1.6, height: 1.6, patternUnits: 'userSpaceOnUse' }, defs);
      svg('rect', { width: 1.6, height: 0.35, fill: '#000', 'fill-opacity': 0.5 }, pat);
      svg('rect', { width: 0.35, height: 1.6, fill: '#000', 'fill-opacity': 0.5 }, pat);
      s.inv = svg('rect', { x: 0, y: 0, width: w, height: 9, fill: INK }, g);
      s.top = T(g, 2, 4.8, '', { size: 6, fill: BG });
      s.topR = T(g, w - 2, 4.8, '', { size: 5, anchor: 'end', fill: BG });
      s.big = T(g, 3, 20, '', { size: 11 });
      s.chain = [];
      for (let i = 1; i <= N; i++) {
        const x = 2 + (i - 1) * ((w - 4) / N), cw = (w - 4) / N - 1.4;
        const r = svg('rect', { x, y: 30, width: cw, height: 9, fill: 'none', stroke: INK, 'stroke-width': 0.6 }, g);
        const t = T(g, x + cw / 2, 34.8, SLOT[i], { size: 4.2, anchor: 'middle' });
        s.chain.push({ r, t });
      }
      s.rows = [];
      for (let k = 0; k < 4; k++) {
        const y = 12 + k * 9;
        const r = svg('rect', { x: 1, y: y - 1, width: w - 2, height: 8.4, fill: INK, 'fill-opacity': 0 }, g);
        const t = T(g, 3, y + 3.3, '', { size: 5.6 });
        const v = T(g, w - 3, y + 3.3, '', { size: 5.4, anchor: 'end' });
        const bar = svg('rect', { x: w - 40, y: y + 1.5, width: 0, height: 3.6, fill: INK }, g);
        s.rows.push({ r, t, v, bar });
      }
      s.msg = T(g, w / 2, h - 4, '', { size: 5, anchor: 'middle', fill: DIMI });
      svg('rect', { width: w, height: h, fill: `url(#${pid})`, 'pointer-events': 'none' }, g);
      s.sig = '';
    },
    update(s, st, nv, now) {
      const b = nv.block, id = b.id, u = s.ui, n = kit.nav(id), w = s.w;
      const v = n.view;
      const ton = n.msg && now - n.msgT < 1300;
      if (v === 'tuner') {
        const t = st && st.tu && st.tu.tuner;
        setText(s.top, 'TUNER'); setText(s.topR, (u._tref ?? 440) + 'Hz');
        show(s.big, true);
        setText(s.big, t && t.note ? t.note : '--');
        const c = t && t.note ? t.cents : 0;
        const pos = Math.round(Math.max(-1, Math.min(1, c / 50)) * 3.5 + 3.5);
        s.chain.forEach((e, k) => { show(e.r, true); show(e.t, true); setText(e.t, k === 3 || k === 4 ? (Math.abs(c) < 2 && t && t.note ? '<>' : '|') : ''); setA(e.r, 'fill', t && t.note && k === Math.min(7, pos) ? INK : 'none'); });
        s.rows.forEach((r) => { show(r.r, false); show(r.t, false); show(r.v, false); show(r.bar, false); });
        setText(s.msg, t && t.note ? `${c >= 0 ? '+' : ''}${c.toFixed(1)} cent` : 'PLAY A STRING');
        s.sig = '';
        return;
      }
      const sig = n.rev + v + n.sel + '|' + n.page + '|' + n.cur + (ton ? n.msg : '') + JSON.stringify(b.params);
      if (sig === s.sig) return;
      s.sig = sig;
      const home = v === 'home';
      show(s.big, home);
      s.chain.forEach((e) => { show(e.r, home); show(e.t, home); });
      s.rows.forEach((r) => { show(r.r, !home); show(r.t, !home); show(r.v, !home); show(r.bar, false); setA(r.r, 'fill-opacity', 0); setA(r.t, 'fill', INK); setA(r.v, 'fill', INK); });
      setText(s.msg, ton ? n.msg : '');
      if (home) {
        setText(s.top, memName(u._preset | 0));
        setText(s.topR, `BPM${Math.round(u._bpm ?? 120)}`);
        setText(s.big, kit.presetName(b).slice(0, 13));
        s.chain.forEach((e, k) => {
          const i = k + 1, m = kit.slotModel(u, i), on = m && kit.slotOn(u, i);
          const cur = i === n.sel;
          setA(e.r, 'fill', on ? INK : 'none');
          setA(e.r, 'stroke-width', cur ? 1.4 : 0.6);
          setA(e.t, 'fill', on ? BG : m ? INK : DIMI);
        });
        const m = kit.slotModel(u, n.sel);
        if (!ton) setText(s.msg, `${SLOT[n.sel]}: ${m ? m.n.toUpperCase().slice(0, 16) : 'EMPTY'}`);
      } else if (v === 'edit') {
        const m = kit.slotModel(u, n.sel);
        const np = kit.pages(u, n.sel, 3);
        setText(s.top, `${SLOT[n.sel]} ${m && kit.slotOn(u, n.sel) ? 'ON' : 'OFF'}`);
        setText(s.topR, `P${n.page + 1}/${np}`);
        s.rows.forEach((r, k) => {
          if (k === 0) { setText(r.t, 'TYPE'); setText(r.v, m ? m.n.toUpperCase().slice(0, 14) : '-'); return; }
          const j = n.page * 3 + k - 1, p = m && m.P[j];
          show(r.bar, !!p);
          setText(r.t, p ? `${k}:${p.n.toUpperCase().slice(0, 8)}` : '');
          const pos = p ? kit.slotPos(u, n.sel, j, m) : 0;
          setText(r.v, p ? pText(p, pos) : '');
          setA(r.v, 'x', w - 44);
          setA(r.bar, 'width', (36 * pos).toFixed(1));
        });
        s.rows[0].v.setAttribute('x', w - 3);
        if (!ton) setText(s.msg, 'ENTER=ON/OFF  MENU=TYPE');
      } else {
        const it = M.items(id);
        n.cur = Math.min(n.cur, Math.max(0, it.length - 1));
        n.top = kit.windowTop(it.length, n.cur, n.top || 0, 4);
        setText(s.top, v === 'settings' ? 'SYSTEM' : v === 'cats' ? `${SLOT[n.sel]} CATEGORY` : `${SLOT[n.sel]} TYPE`);
        setText(s.topR, `${n.cur + 1}/${it.length}`);
        s.rows.forEach((r, k) => {
          const e = it[n.top + k];
          show(r.t, !!e); show(r.v, !!e);
          if (!e) return;
          const sel = n.top + k === n.cur;
          setA(r.r, 'fill-opacity', sel ? 1 : 0);
          setText(r.t, (e.mark ? '*' : ' ') + e.t.toUpperCase().slice(0, 20));
          setText(r.v, e.r && e.r !== '▸' ? e.r.toUpperCase() : '');
          setA(r.v, 'x', w - 3);
          setA(r.t, 'fill', sel ? BG : INK);
          setA(r.v, 'fill', sel ? BG : INK);
        });
      }
    },
  });

  // ---------------------------------------------------------------- enclosure
  const W = 300, H = 236;
  const BTNS = [['left', '◀', 206, 98], ['right', '▶', 232, 98], ['exit', 'EXIT', 30, 98], ['enter', 'ENTER', 266, 98], ['menu', 'MENU', 62, 98]];
  const FX = (k) => 54 + k * 96;
  tz.addForm('gx-core', (ctx, d) => {
    const g = ctx.g;
    formKit.body(g, W, H, '#202124', { rx: 8 });
    svg('rect', { x: 0, y: 0, width: W, height: 118, rx: 8, fill: '#2b2c30' }, g);
    svg('rect', { x: 0, y: 116, width: W, height: 2, fill: '#000', 'fill-opacity': 0.5 }, g);
    svg('rect', { x: 8, y: 124, width: W - 16, height: 2, fill: '#c8102e' }, g);
    const theme = { text: '#e8e8e8', knob: 'boss', labelSize: 6, labelFont: "'Barlow Condensed', sans-serif" };
    label(g, 76, 112, 'GX-1000', { size: 11, fill: '#f2f2f2', weight: 800, italic: true, ls: 0.6, font: "'Barlow Condensed', sans-serif" });
    label(g, 108, 112, 'CORE', { size: 9, fill: '#c8102e', weight: 800, italic: true, font: "'Barlow Condensed', sans-serif", anchor: 'start' });
    formKit.tzBadge(g, W - 34, 112, '#8a8c90', 4);
    for (const [, t, x, y] of BTNS) {
      svg('rect', { x: x - 12, y: y - 5.5, width: 24, height: 11, rx: 2, fill: '#121214', stroke: '#45474c', 'stroke-width': 0.6 }, g);
      label(g, x, y, t, { size: t.length > 1 ? 4.6 : 5.6, fill: '#e8e8e8', weight: 700 });
    }
    ['MEMORY ▼', 'MEMORY ▲', 'CTL'].forEach((t, k) => label(g, FX(k), 145, t, { size: 6, fill: '#d8d8d8', weight: 700, font: "'Barlow Condensed', sans-serif" }));
    formKit.placeControls(ctx, d.controls, theme);
    return { w: W, h: H, theme, jacks: kit.topJacks(d, W, ctx.flip, 24, W - 24) };
  });
  const controls = [
    SCREEN('gx-lcd', { x: 64, y: 44, w: 112, h: 58, bg: BG, bezel: '#0b0b0c' }),
    K('k1', '1', { x: 150, y: 46, r: 10, def: 0.5, virtual: true, labelPos: 'above' }),
    K('k2', '2', { x: 188, y: 46, r: 10, def: 0.5, virtual: true, labelPos: 'above' }),
    K('k3', '3', { x: 226, y: 46, r: 10, def: 0.5, virtual: true, labelPos: 'above' }),
    K('_vol', 'MASTER', { x: 268, y: 46, r: 11, min: -30, max: 6, def: 0, virtual: true, display: db, labelPos: 'above' }),
    ...BTNS.map(([btn, , x, y]) => FOOT({ action: 'mfx', mfx: 'btn', btn, style: 'plate', w: 24, h: 11, x, y })),
    ...[0, 1, 2].map((k) => FOOT({ action: 'mfx', mfx: 'fs', fs: k, style: 'stomp', r: 13, x: FX(k), y: 196 })),
    LED({ x: FX(0), y: 164, r: 2.6, color: '#ff2a1a', bind: 'fn', ledFn: (u, b, st, now) => (kit.nav(b.id).view === 'tuner' ? (now % 600 < 300) : null) }),
    LED({ x: FX(1), y: 164, r: 2.6, color: '#ff2a1a', bind: 'fn', ledFn: (u, b, st, now) => now % (60000 / (u._bpm || 120)) < 80 }),
    LED({ x: FX(2), y: 164, r: 2.6, color: '#ff2a1a', bind: 'param:_s5on' }),
  ];
  const d = def({
    id: ID, name: 'GX-1000 Core', ref: 'BOSS GT-1000CORE', brand: 'BOSS', code: 'GX-1000 CORE', typeName: 'Compact amp & effects processor', cat: 'Multi-FX', kind: 'Multi-FX',
    form: 'gx-core', color: '#202124', cost: 6, alwaysOn: true,
    ports: { ins: ['INPUT'], outs: ['OUT L/MONO', 'OUT R', 'SEND 1', 'SEND 2', 'PHONES'] }, jackKinds: { o4: 'phones' },
    ctrl: { ins: [{ label: 'EXP', hook: true, exp: 1 }, { label: 'CTL', hook: true, fs: 1 }] },
    controls,
    desc: 'Cursor through the chain with the arrows, ENTER edits a block (knobs 1-3, arrows flip pages, ENTER = on/off, MENU = type). MEMORY switches step patches (hold = tuner / tap), CTL turns FX1 on and off.',
  });
  kit.register(d, {
    n: N, knobs: 3, sel0: 3, layout: () => [1, 2, 3, 4, 5, 6, 7, 8], inputGate: true, looper: false, presets,
    foot(id, ctl, down) { if (ctl.mfx === 'btn') button(id, ctl.btn, down); else footswitch(id, ctl.fs, down); },
    extFs(id, k, down) { if (down) kit.toggleSlot(id, 6); },
  });
  tz.addDefs([d]);
}
