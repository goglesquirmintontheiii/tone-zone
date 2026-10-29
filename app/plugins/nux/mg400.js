// nux.mg4x: small floor modeler based on the NUX MG-400 (2.8" screen, SELECT encoder, knobs 1-3, MASTER,
// six buttons, three footswitches, drum machine, expression pedal). The looper of the real unit is not modeled.
import { makeKit, stdParts, stdLanes } from './mfx-kit.js';

export function registerMG400(tz) {
  const { K, FOOT, LED, SCREEN, TREADLE, def } = tz.helpers;
  const { svg, label, formKit } = tz.gfx;
  const kit = makeKit(tz);
  const { P, A, T, R, st, sa, fmt, nav } = kit;
  const S = stdParts(P);

  const CATS = [
    { key: 'WAH', name: 'WAH', color: '#ffb02e' },
    { key: 'CMP', name: 'COMP', color: '#ffe14d' },
    { key: 'EFX', name: 'EFX', color: '#ff5b3a' },
    { key: 'AMP', name: 'AMP', color: '#ff2d55' },
    { key: 'IR', name: 'IR / CAB', color: '#c98f5e' },
    { key: 'EQ', name: 'EQ', color: '#4fe0c4' },
    { key: 'NR', name: 'NOISE RED.', color: '#9aa4ae' },
    { key: 'MOD', name: 'MOD', color: '#47a6ff' },
    { key: 'DLY', name: 'DELAY', color: '#62e06c' },
    { key: 'RVB', name: 'REVERB', color: '#b47cff' },
  ];
  const v = {
    ts: { clip: 'ts', cleanSum: true, clipHp: 720, gainMinDb: 6, gainMaxDb: 40, tone: 'ts', toneLo: 723, postLp: 6500 },
    rat: { clip: 'si', gainMinDb: 12, gainMaxDb: 52, tone: 'rat', postLp: 7000 },
    muff: { clip: 'muff', stages: 2, stage2Db: 12, gainMinDb: 16, gainMaxDb: 50, tone: 'blend', postLp: 6000 },
    od: { clip: 'asym', gainMinDb: 6, gainMaxDb: 38, tone: 'lp', toneLo: 1200, toneHi: 7000, postLp: 7000 },
    boost: { clip: 'clean', gainMinDb: 0, gainMaxDb: 20, tone: 'tilt' },
  };
  const LIB = [
    { name: 'Cry Wah', cat: 'WAH', pedal: 'wah', ...S.wah(0) },
    { name: 'Touch Wah', cat: 'WAH', ...S.wah(2) },
    { name: 'Rose Comp', cat: 'CMP', ...S.comp('cmpO') },
    { name: 'K Comp', cat: 'CMP', ...S.comp('cmp') },
    { name: 'TS Drive', cat: 'EFX', ...S.drv(v.ts), params: [P('DRIVE', 'gain', 0.45), P('TONE', 'tone', 0.5), P('LEVEL', 'level', 0.55)] },
    { name: 'Red Dirt', cat: 'EFX', ...S.drv(v.od) },
    { name: 'Dist+', cat: 'EFX', ...S.drv(v.rat), params: [P('DIST', 'gain', 0.5), P('FILTER', 'tone', 0.45), P('LEVEL', 'level', 0.45)] },
    { name: 'Muffy', cat: 'EFX', ...S.drv(v.muff), params: [P('SUSTAIN', 'gain', 0.55), P('TONE', 'tone', 0.5), P('LEVEL', 'level', 0.45)] },
    { name: 'Boost', cat: 'EFX', ...S.drv(v.boost), params: [P('GAIN', 'gain', 0.4), P('TONE', 'tone', 0.5), P('LEVEL', 'level', 0.5)] },
    { name: 'Octaver', cat: 'EFX', ...S.pitch(1 / 7, { mix: 0.6 }) },
    { name: 'Jazz Clean', cat: 'AMP', ...S.amp('jc120', { gain: 0.3 }) },
    { name: 'Deluxe Rvb', cat: 'AMP', ...S.amp('deluxe', { gain: 0.45 }) },
    { name: 'Vibro King', cat: 'AMP', ...S.amp('twin', { gain: 0.35 }) },
    { name: 'AC Boost', cat: 'AMP', ...S.amp('ac30', { gain: 0.45 }) },
    { name: 'Plexi Lead', cat: 'AMP', ...S.amp('plexi', { gain: 0.55 }) },
    { name: 'Brit 800', cat: 'AMP', ...S.amp('jcm800', { gain: 0.55 }) },
    { name: 'Dual Rect', cat: 'AMP', ...S.amp('recto', { gain: 0.6 }) },
    { name: 'Uber', cat: 'AMP', ...S.amp('uber', { gain: 0.55 }) },
    ...['1x12us', '2x12twin', '2x12blue', '4x12gb', '4x12v30', '4x12t75'].map((c) => ({ name: c.replace(/^(\dx\d+)(.*)$/, (m, a, b) => `${a.toUpperCase()} ${b.toUpperCase()}`), cat: 'IR', ...S.cab(c) })),
    { name: '6 Band EQ', cat: 'EQ', ...S.eq() },
    { name: 'Para EQ', cat: 'EQ', ...S.peq() },
    { name: 'Noise Killer', cat: 'NR', ...S.gate() },
    { name: 'CE-1', cat: 'MOD', ...S.chorus(0) },
    { name: 'ST Chorus', cat: 'MOD', ...S.chorus(3, { rate: 0.2 }) },
    { name: 'Flanger', cat: 'MOD', ...S.flanger(0) },
    { name: 'Phase 100', cat: 'MOD', ...S.phaser(4) },
    { name: 'Tremolo', cat: 'MOD', ...S.trem(0) },
    { name: 'U-Vibe', cat: 'MOD', ...S.vibe() },
    { name: 'Analog Dly', cat: 'DLY', ...S.dly(1, [P('TONE', 'tone', 0.4)]) },
    { name: 'Digital Dly', cat: 'DLY', ...S.dly(0) },
    { name: 'Tape Echo', cat: 'DLY', ...S.dly(2, [P('WOW', 'moddepth', 0.25)]) },
    { name: 'Mod Delay', cat: 'DLY', ...S.dly(4, [P('DEPTH', 'moddepth', 0.4)]) },
    { name: 'Ping Pong', cat: 'DLY', ...S.dly(7) },
    { name: 'Room', cat: 'RVB', ...S.rev(0) },
    { name: 'Hall', cat: 'RVB', ...S.rev(1) },
    { name: 'Plate', cat: 'RVB', ...S.rev(2) },
    { name: 'Spring', cat: 'RVB', ...S.rev(3) },
    { name: 'Shimmer', cat: 'RVB', ...S.rev(4) },
  ];
  // the drum machine runs on a looper lane (rhythm patterns)
  const lanes = stdLanes({ drv: 1, dly: 1, looper: 1 });
  const mg = kit.unit({
    id: 'nux.mg4x', slots: 10, knobs: 3, cats: CATS, models: LIB, exp: true, memPrefix: 'PRESET',
    slotCats: CATS.map((c) => [c.key]), lanes,
    patch: [['Cry Wah', false], ['Rose Comp', false], ['TS Drive', true, { DRIVE: 0.25, LEVEL: 0.65 }], ['Plexi Lead', true, { GAIN: 0.5 }], ['4X12 GB', true], ['6 Band EQ', false], ['Noise Killer', true, { THRESH: 0.25 }], ['CE-1', false], ['Analog Dly', true, { MIX: 0.22 }], ['Hall', true, { MIX: 0.2 }]],
    mems: [
      { name: 'PLEXI DRIVE' },
      { name: 'CLEAN CHORUS', patch: [['Cry Wah', false], ['K Comp', true], null, ['Jazz Clean', true], ['2X12 TWIN', true], null, null, ['ST Chorus', true], ['Digital Dly', true, { MIX: 0.2 }], ['Plate', true, { MIX: 0.3 }]] },
      { name: 'RECTO RIFF', patch: [['Cry Wah', false], null, ['TS Drive', true, { DRIVE: 0.15, LEVEL: 0.7 }], ['Dual Rect', true], ['4X12 V30', true], null, ['Noise Killer', true, { THRESH: 0.4 }], null, ['Analog Dly', false], ['Room', true, { MIX: 0.15 }]] },
      { name: 'BLUES AC', patch: [['Cry Wah', false], ['Rose Comp', true], ['Red Dirt', false], ['AC Boost', true, { GAIN: 0.4 }], ['2X12 BLUE', true], null, null, ['Tremolo', false], ['Tape Echo', true, { MIX: 0.22 }], ['Spring', true, { MIX: 0.25 }]] },
    ],
  });

  // screen: black with red highlights, rounded sans
  const C = { bg: '#0b0b0d', card: '#18181c', acc: '#ff3b30', ink: '#f4f4f6', dim: '#86868f', line: '#2a2a30' };
  const NF = "'Trebuchet MS', 'Carlito', 'Calibri', sans-serif";
  const NM = 8;
  const DRUMS = ['ROCK', 'POP', 'FUNK', 'SHUFFLE', 'METAL', 'BALLAD', '4/4', 'HALF', 'BOSSA', 'CLICK'];
  const pname = (m) => `${String(m + 1).padStart(2, '0')}`;

  tz.addScreen('mg4x-lcd', {
    build(s, g, w, h) {
      s.w = w; s.h = h;
      R(g, 0, 0, w, h, { fill: C.bg });
      // header
      s.num = T(g, 4, 8, '', { anchor: 'start', size: 10, fill: C.acc, font: NF, weight: 700 });
      s.name = T(g, 20, 6, '', { anchor: 'start', size: 5, fill: C.ink, font: NF, weight: 700 });
      s.sub = T(g, 20, 11.5, '', { anchor: 'start', size: 3.4, fill: C.dim, font: NF });
      const V = (n) => (s[n] = svg('g', {}, g));
      // HOME: one row of 10 squares + a card for the selected module
      V('vHome');
      const bw = (w - 6) / 10;
      s.sq = CATS.map((c, i) => {
        const x = 3 + i * bw;
        const b = R(s.vHome, x + 0.5, 17, bw - 1, 9, { rx: 1.5, fill: '#222' });
        const t = T(s.vHome, x + bw / 2, 21.7, c.key, { size: 2.9, fill: C.ink, font: NF, weight: 700 });
        return { x, w: bw, b, t };
      });
      s.mark = R(s.vHome, 3, 27.5, bw, 1.2, { fill: C.acc });
      R(s.vHome, 3, 31, w - 6, 18, { rx: 2.5, fill: C.card });
      s.cBar = R(s.vHome, 3, 31, 2, 18, { fill: '#555' });
      s.cMod = T(s.vHome, 8, 35.5, '', { anchor: 'start', size: 3.2, fill: C.dim, font: NF });
      s.cModel = T(s.vHome, 8, 43, '', { anchor: 'start', size: 6.2, fill: C.ink, font: NF, weight: 700 });
      s.cOn = T(s.vHome, w - 6, 40, '', { anchor: 'end', size: 4.2, fill: C.acc, font: NF, weight: 700 });
      s.kn = [0, 1, 2].map((k) => {
        const cw = (w - 6) / 3, x = 3 + k * cw;
        const l = T(s.vHome, x + cw / 2, 55, '', { size: 3, fill: C.dim, font: NF });
        const val = T(s.vHome, x + cw / 2, 62, '', { size: 5, fill: C.ink, font: NF, weight: 700 });
        return { l, val };
      });
      // EDIT: three dials
      V('vEdit');
      s.eTag = R(s.vEdit, 3, 16, 20, 8, { rx: 4, fill: '#555' });
      s.eTagT = T(s.vEdit, 13, 20.2, '', { size: 3.4, fill: '#111', font: NF, weight: 700 });
      s.eModel = T(s.vEdit, w / 2 + 10, 20.2, '', { size: 5.2, fill: C.ink, font: NF, weight: 700 });
      s.eOn = T(s.vEdit, w - 3, 20.2, '', { anchor: 'end', size: 3.6, fill: C.acc, font: NF, weight: 700 });
      s.dial = [0, 1, 2].map((k) => {
        const cx = w * (k + 0.5) / 3, cy = 40, r = 10;
        svg('circle', { cx, cy, r, fill: 'none', stroke: '#26262c', 'stroke-width': 2.4 }, s.vEdit);
        const arc = svg('path', { d: '', fill: 'none', stroke: C.acc, 'stroke-width': 2.4, 'stroke-linecap': 'round' }, s.vEdit);
        const val = T(s.vEdit, cx, cy + 0.5, '', { size: 4.4, fill: C.ink, font: NF, weight: 700 });
        const l = T(s.vEdit, cx, cy + r + 6, '', { size: 3.2, fill: C.dim, font: NF });
        return { cx, cy, r, arc, val, l };
      });
      s.ePage = T(s.vEdit, w / 2, h - 3, '', { size: 3, fill: C.dim, font: NF });
      // LIST / SAVE / JAM share a row layout
      V('vRows');
      s.rTitle = T(s.vRows, 4, 19, '', { anchor: 'start', size: 3.8, fill: C.acc, font: NF, weight: 700 });
      s.rows = [0, 1, 2, 3, 4].map((r) => {
        const y = 23 + r * 9.4;
        const bg = R(s.vRows, 2, y, w - 4, 8.6, { rx: 1.5, fill: 'none' });
        const t = T(s.vRows, 6, y + 4.4, '', { anchor: 'start', size: 4.4, fill: C.ink, font: NF });
        const v2 = T(s.vRows, w - 5, y + 4.4, '', { anchor: 'end', size: 4, fill: C.dim, font: NF, weight: 700 });
        return { y, bg, t, v: v2 };
      });
      s.views = ['vHome', 'vEdit', 'vRows'];
      s.sig = '';
    },
    update(s, status, view) {
      const blk = view.block, ui = s.ui, n = nav(blk.id), w = s.w;
      let sig = `${n.view}|${n.t}|${n.sel}|${n.page}|${n.li}|${n.top}|${n.saveTo}|${ui._cur}|${ui._fsm}|${ui._bpm}|${ui._drum}|${ui._pat}|${ui._expT}`;
      for (let i = 0; i < 10; i++) sig += `|${ui['_m' + i]}${ui['_o' + i]}`;
      for (let k = 0; k < 8; k++) sig += `|${(ui[`_p${n.sel}_${k}`] ?? 0).toFixed(3)}`;
      if (sig === s.sig) return;
      s.sig = sig;
      const vn = { home: 'vHome', edit: 'vEdit' }[n.view] || 'vRows';
      if (s.curV !== vn) { for (const k of s.views) sa(s[k], 'display', k === vn ? 'inline' : 'none'); s.curV = vn; }
      const cur = ui._cur | 0;
      st(s.num, pname(cur));
      st(s.name, A.memName(blk, cur));
      st(s.sub, `${(ui._fsm | 0) ? 'STOMP' : 'PRESET'} · ${ui._bpm || 120} BPM${(ui._drum ?? 0) > 0.5 ? ' · DRUM ' + DRUMS[ui._pat | 0] : ''}`);
      const Al = mg.alloc(ui);
      const x = mg.slot(ui, n.sel, Al);
      if (vn === 'vHome') {
        s.sq.forEach((q, i) => {
          const y = mg.slot(ui, i, Al);
          sa(q.b, 'fill', y.m && y.on ? CATS[i].color : '#222');
          sa(q.t, 'fill', y.m && y.on ? '#111' : y.m ? C.ink : '#555');
        });
        sa(s.mark, 'x', s.sq[n.sel].x.toFixed(1));
        sa(s.cBar, 'fill', CATS[n.sel].color);
        st(s.cMod, CATS[n.sel].name + (x.over ? ' · DSP FULL' : ''));
        st(s.cModel, x.m ? x.m.name : 'EMPTY');
        st(s.cOn, x.m ? (x.on ? 'ON' : 'OFF') : '');
        s.kn.forEach((c, k) => { const p = x.m && x.m.params[n.page * 3 + k]; st(c.l, p ? `${k + 1}  ${p.label}` : ''); st(c.val, p ? fmt(p, x.val(n.page * 3 + k)) : ''); });
      } else if (vn === 'vEdit') {
        sa(s.eTag, 'fill', CATS[n.sel].color);
        st(s.eTagT, CATS[n.sel].key);
        st(s.eModel, x.m ? x.m.name : 'EMPTY');
        st(s.eOn, x.m ? (x.on ? 'ON' : 'OFF') : '');
        s.dial.forEach((d, k) => {
          const pi = n.page * 3 + k, p = x.m && x.m.params[pi];
          const vv = p ? x.val(pi) : 0;
          const a0 = -2.4, a1 = -2.4 + 4.8 * vv;
          const pt = (a) => `${(d.cx + d.r * Math.sin(a)).toFixed(2)} ${(d.cy - d.r * Math.cos(a)).toFixed(2)}`;
          sa(d.arc, 'd', p && vv > 0.005 ? `M${pt(a0)} A${d.r} ${d.r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${pt(a1)}` : '');
          st(d.val, p ? fmt(p, vv) : '');
          st(d.l, p ? p.label : '');
        });
        st(s.ePage, x.m ? `PAGE ${n.page + 1}/${A.pages(blk)}` : '');
      } else {
        let rows = [], title = '';
        if (n.view === 'list') { const list = mg.inCat(CATS[n.sel].key); title = `${CATS[n.sel].name} MODELS`; rows = list.map((m) => [m.name, x.m && m.idx === x.m.idx ? '●' : '']); }
        else if (n.view === 'save') { title = 'SAVE TO'; rows = Array.from({ length: NM }, (_, m) => [`${pname(m)}  ${A.memName(blk, m)}`, m === cur ? 'NOW' : '']); }
        else if (n.view === 'jam') { title = `DRUMS ${(ui._drum ?? 0) > 0.5 ? 'ON' : 'OFF'} · ${ui._bpm || 120} BPM`; rows = DRUMS.map((d, i) => [d, i === (ui._pat | 0) ? '●' : '']); }
        st(s.rTitle, title);
        s.rows.forEach((r, j) => {
          const it = rows[(n.top | 0) + j];
          const hl = (n.top | 0) + j === n.li;
          st(r.t, it ? it[0] : '');
          st(r.v, it ? it[1] : '');
          sa(r.bg, 'fill', it && hl ? C.acc : 'none');
          sa(r.t, 'fill', hl ? '#fff' : C.ink);
        });
      }
    },
    pointer(s, view, type, pt, e) {
      const blk = view.block, n = nav(blk.id), w = s.w;
      if (type === 'wheel') { go(blk, e.deltaY > 0 ? 1 : -1); return; }
      if (type !== 'down') return;
      s.sig = '';
      if (n.view === 'home') {
        if (pt.y < 29 && pt.y > 15) { const i = s.sq.findIndex((q) => pt.x >= q.x && pt.x < q.x + q.w); if (i >= 0) { if (i === n.sel) A.view(blk, 'edit'); else A.select(blk, i); } }
        else if (pt.y >= 29 && pt.y < 50) { if (pt.x > w - 20) A.toggle(blk, n.sel); else A.view(blk, 'edit'); }
        else if (pt.y >= 50) A.page(blk, 1);
      } else if (n.view === 'edit') {
        if (pt.y < 26) { if (pt.x < 24) A.view(blk, 'home'); else if (pt.x > w - 16) A.toggle(blk, n.sel); else push(blk); }
        else A.page(blk, 1);
      } else {
        const j = Math.floor((pt.y - 23) / 9.4);
        if (j >= 0 && j < 5) { n.li = (n.top | 0) + j; push(blk); }
      }
    },
  });
  const rowsLen = (blk) => { const n = nav(blk.id); return n.view === 'list' ? mg.inCat(CATS[n.sel].key).length : n.view === 'save' ? NM : DRUMS.length; };
  function openRows(blk, v2, li) {
    const n = nav(blk.id);
    A.view(blk, v2);
    n.li = Math.max(0, li);
    n.top = Math.max(0, Math.min(Math.max(0, rowsLen(blk) - 5), n.li - 2));
  }
  // SELECT turn
  function go(blk, d) {
    const n = nav(blk.id), ui = tz.app.ui(blk);
    if (n.view === 'home') A.selMove(blk, d);
    else if (n.view === 'edit') A.page(blk, d);
    else {
      n.li = Math.max(0, Math.min(rowsLen(blk) - 1, n.li + d));
      n.top = Math.max(0, Math.min(n.li, Math.max(n.top | 0, n.li - 4)));
      if (n.view === 'jam') tz.app.setParam(blk.id, '_pat', n.li);
      kit.bump(blk);
    }
    void ui;
  }
  // SELECT push
  function push(blk) {
    const n = nav(blk.id), ui = tz.app.ui(blk);
    if (n.view === 'home') A.view(blk, 'edit');
    else if (n.view === 'edit') openRows(blk, 'list', mg.inCat(CATS[n.sel].key).findIndex((m) => m.idx === (ui[`_m${n.sel}`] ?? -1)));
    else if (n.view === 'list') { const m = mg.inCat(CATS[n.sel].key)[n.li]; if (m) { A.setModel(blk, n.sel, m.idx); A.view(blk, 'edit'); } }
    else if (n.view === 'save') { A.store(blk, n.li); A.view(blk, 'home'); }
    else if (n.view === 'jam') { tz.app.setParam(blk.id, '_pat', n.li); tz.app.setParam(blk.id, '_drum', (ui._drum ?? 0) > 0.5 ? 0 : 1); kit.bump(blk); }
  }
  tz.bus.on('param', ({ id, p, v: val }) => {
    if (p !== 'ksel') return;
    const blk = kit.blockOf(id);
    if (!blk || blk.type !== 'nux.mg4x') return;
    const n = nav(id);
    const prev = n.selLast ?? val;
    n.selLast = val;
    n.selAcc = (n.selAcc || 0) + (val - prev);
    while (Math.abs(n.selAcc) >= 0.0499) { const d = n.selAcc > 0 ? 1 : -1; n.selAcc -= d * 0.05; go(blk, d); }
  });
  const DEF_CTRL = 2; // CTRL footswitch switches the EFX module
  kit.hooks('nux.mg4x', (blk, name, ctl, phase) => {
    const n = nav(blk.id), ui = tz.app.ui(blk);
    if (name === 'tap') { if (phase === 'down') A.tap(blk); return; }
    if (phase !== 'press') return;
    switch (name) {
      case 'push': push(blk); break;
      case 'edit': A.view(blk, n.view === 'home' ? 'edit' : n.view === 'list' ? 'edit' : 'home'); break;
      case 'save': if (n.view === 'save') push(blk); else openRows(blk, 'save', ui._cur | 0); break;
      case 'mode': tz.app.setParam(blk.id, '_fsm', (ui._fsm | 0) ? 0 : 1); kit.bump(blk); break;
      case 'jam': if (n.view === 'jam') A.view(blk, 'home'); else openRows(blk, 'jam', ui._pat | 0); break;
      case 'pedal': tz.app.setParam(blk.id, '_expT', ((ui._expT ?? 0) + 1) % 4); tz.ui.toast('Pedal: ' + ['AUTO (WAH / VOLUME)', 'VOLUME', 'WAH', 'OFF'][tz.app.ui(blk)._expT], 'info', 1000); break;
      case 'up': case 'down': {
        const d = name === 'up' ? 1 : -1;
        if ((ui._fsm | 0) === 1) A.toggle(blk, d > 0 ? 8 : 7); // stomp mode: DLY / MOD
        else A.recall(blk, ((ui._cur | 0) + d + NM) % NM);
        break;
      }
      case 'ctrl': A.toggle(blk, DEF_CTRL); break;
    }
  });

  tz.addForm('nux-mg4x', (ctx, d) => {
    const g = ctx.g, w = 376, h = 206;
    formKit.body(g, w, h, d.color, { rx: 10 });
    svg('rect', { x: 7, y: 7, width: 296, height: 104, rx: 6, fill: '#1e1e22', stroke: '#000', 'stroke-opacity': 0.6 }, g);
    svg('rect', { x: 7, y: 115, width: 296, height: 84, rx: 6, fill: '#141417', stroke: '#000', 'stroke-opacity': 0.6 }, g);
    svg('rect', { x: 308, y: 7, width: 61, height: 192, rx: 7, fill: '#0b0b0c', stroke: '#000' }, g);
    const txt = '#ececef', dim = '#8a8a92';
    const cap = (x, y, t) => {
      svg('rect', { x: x - 10.5, y: y - 4, width: 21, height: 9, rx: 2, fill: '#000', opacity: 0.6 }, g);
      svg('rect', { x: x - 10, y: y - 4.5, width: 20, height: 8.5, rx: 2, fill: '#37373c', stroke: '#0b0b0b', 'stroke-width': 0.5 }, g);
      label(g, x, y - 0.2, t, { size: 3.2, fill: txt, weight: 800 });
    };
    BTNS.forEach(([nm, t], i) => cap(BX(i), 34, t));
    label(g, 66, 103, 'MG-4X', { size: 10, fill: '#fff', font: "'Trebuchet MS', 'Carlito', sans-serif", weight: 700, ls: 1.2 });
    ['▲', 'CTRL', '▼'].forEach((t, i) => label(g, 60 + i * 95, 192, t, { size: 5, fill: dim, weight: 800, ls: 0.6 }));
    label(g, 338, 193, 'PEDAL', { size: 4.2, fill: dim, weight: 800, ls: 1 });
    formKit.tzBadge(g, 250, 105, '#5d636b', 3.4);
    const theme = { text: txt, knob: 'boss', labelSize: 4.4 };
    formKit.placeControls(ctx, d.controls, theme);
    return { w, h, theme, jacks: formKit.jacksTop(d, w, { flip: ctx.flip }) };
  });
  const BTNS = [['edit', 'EDIT/EXIT'], ['save', 'SAVE'], ['mode', 'MODE'], ['jam', 'JAM'], ['tap', 'TAP'], ['pedal', 'PEDAL']];
  const BX = (i) => 148 + i * 26;
  const controls = [
    Object.assign(SCREEN('mg4x-lcd', { interactive: true }), { x: 66, y: 50, w: 100, h: 70, bezel: '#050505' }),
    ...BTNS.map(([nm], i) => Object.assign(FOOT({ action: 'nav', nav: nm, style: 'plate', label: '' }), { x: BX(i), y: 34, w: 20, h: 8.5 })),
    Object.assign(LED({ bind: 'fn', color: '#ff3b30', ledFn: (ui, b, stt, now) => ((now / (60000 / (ui._bpm || 120))) % 1 < 0.15 ? '#ff3b30' : null) }), { x: BX(4) + 8, y: 27, r: 1.4 }),
    Object.assign(LED({ bind: 'fn', color: '#3ddc84', ledFn: (ui) => ((ui._drum ?? 0) > 0.5 ? '#3ddc84' : null) }), { x: BX(3) + 8, y: 27, r: 1.4 }),
    Object.assign(K('ksel', 'SELECT', { virtual: true, def: 0.5 }), { x: 152, y: 66, r: 13, labelPos: 'below', style: 'chrome' }),
    Object.assign(FOOT({ action: 'nav', nav: 'push', style: 'plate', label: '' }), { x: 152, y: 66, w: 8, h: 8 }),
    ...[0, 1, 2].map((k) => Object.assign(K('k' + (k + 1), String(k + 1), { virtual: true, def: 0.5 }), { x: 190 + k * 30, y: 66, r: 10, labelPos: 'below' })),
    Object.assign(K('_lvl', 'MASTER', { virtual: true, min: -24, max: 12, def: 0, display: (x) => (x > 0 ? '+' : '') + x.toFixed(1) + ' dB' }), { x: 280, y: 66, r: 10, labelPos: 'below' }),
    ...['up', 'ctrl', 'down'].map((nm, i) => Object.assign(FOOT({ action: 'nav', nav: nm, style: 'stomp', label: '' }), { x: 60 + i * 95, y: 166, r: 13 })),
    ...[0, 1, 2].map((i) => Object.assign(LED({ bind: 'fn', ledFn: (ui) => {
      if (i === 1) { const x = mg.slot(ui, DEF_CTRL); return x.m && x.on ? '#ff5b3a' : null; }
      if ((ui._fsm | 0) === 1) { const x = mg.slot(ui, i === 0 ? 8 : 7); return x.m && x.on ? CATS[i === 0 ? 8 : 7].color : null; }
      return '#3a3a40';
    } }), { x: 60 + i * 95, y: 140, r: 2.4 })),
    Object.assign(TREADLE('exp', { virtual: true, def: 1, color: '#1b1b1e' }), { x: 338, y: 98, w: 48, h: 168 }),
  ];
  tz.addDefs([def({
    id: 'nux.mg4x', name: 'MG-4X Modeler', ref: 'NUX MG-400', brand: 'NUX', code: 'MG-4X', logo: 'MG-4X', typeName: 'Compact floor modeler', cat: 'Multi-FX', kind: 'Multi-FX',
    form: 'nux-mg4x', color: '#232327', stereo: 'stereo', ports: { ins: ['INPUT'], outs: ['OUTPUT L', 'OUTPUT R', 'PHONES'] }, jackKinds: { o2: 'mini' }, cost: 5.5, noBypassClick: true,
    algo: 'chain', opts: { chain: mg.chain }, derive: mg.derive,
    initParams: Object.assign({}, mg.initParams, { _fsm: 0, _expT: 0, _lvl: 0, exp: 1, _drum: 0, _pat: 0 }),
    controls,
    desc: 'Small floor modeler with 10 modules, a colour screen, drum machine and expression pedal. Turn and push SELECT to pick a module and its model; knobs 1-3 edit it.',
  })]);
  kit.register('nux.mg4x', mg);
}
