// Screens + interaction for the v0.4.0 Tone Zone multi-effects originals (catalog/originals4.js):
//   tz5-atlas / tz5-atlas-strip   Atlas Floor colour LCD (chain view, browser, menus, scenes, presets, looper, tuner,
//                                 global settings) + footswitch scribble strips
//   tz5-aurora                    Aurora Desk vector-scope (stroke font, Lissajous morph display)
//   tz5-pixel                     Pixel Quest dot-matrix (bitmap font, sprites, game-style menus)
//   tz5-meter / tz5-seg           Low Foundry analog VU meter + 14-segment alphanumeric display
// Footswitches / buttons of these units toggle `_p.<name>` press params; a bus listener below turns every change
// into an action (with hold detection from the pointer). Persistent unit state lives in the JSON param `_st`;
// navigation (page, cursor) is transient in state.ui[id].tz5.
import { svg, bus, clamp } from './util.js';
import { registerScreen } from './screens.js';
import { setA, setText } from './gfx/fx.js';
import { state, uiParams, setParam, blockById, commit, syncGraph, markDirty } from './state.js';
import { getDef } from './catalog/index.js';
import * as O from './catalog/originals4.js';

// ================================================================== shared plumbing
const HANDLERS = {};
let syncing = false; // true while we move knobs ourselves (their param events are not user edits)
const navOf = (b) => {
  const u = (state.ui[b.id] = state.ui[b.id] || {});
  return (u.tz5 = u.tz5 || {});
};
function putSt(b, st, { undo = false, chainFn = null } = {}) {
  if (undo) commit();
  let rebuild = false;
  if (chainFn) {
    const ch = chainFn(st);
    const cur = b.opts || getDef(b.type).opts;
    if (JSON.stringify(cur) !== JSON.stringify(ch)) { b.opts = ch; rebuild = true; }
  }
  setParam(b.id, '_st', JSON.stringify(st), { silent: true });
  if (rebuild) syncGraph();
  markDirty();
}
function setUi(b, p, v) {
  syncing = true;
  try { setParam(b.id, p, v, { silent: true }); } finally { syncing = false; }
}
const engineEvent = (b, type, arg = 0) => window.tz.engine.send({ cmd: 'event', id: b.id, type, value: 0, arg });
function flash(b, msg, ms = 1300) {
  const n = navOf(b);
  n.msg = msg;
  n.msgT = performance.now() + ms;
}

// pointer state, for hold detection on footswitches (remote presses have no pointer: they act as taps)
let ptrDown = false;
window.addEventListener('pointerdown', () => (ptrDown = true), true);
window.addEventListener('pointerup', () => (ptrDown = false), true);
function holdable(onTap, onHold, ms = 650, onRelease = null) {
  if (!ptrDown) return onTap();
  let held = false;
  const t = setTimeout(() => { held = true; onHold(); }, ms);
  const up = () => {
    window.removeEventListener('pointerup', up, true);
    clearTimeout(t);
    if (!held) onTap();
    else if (onRelease) onRelease();
  };
  window.addEventListener('pointerup', up, true);
}
// momentary: on now, off on release (or after `auto` ms for remote presses)
function momentary(onDown, onUp, auto = 1500) {
  onDown();
  if (!ptrDown) return setTimeout(onUp, auto);
  const up = () => { window.removeEventListener('pointerup', up, true); onUp(); };
  window.addEventListener('pointerup', up, true);
}

bus.on('param', ({ id, p }) => {
  if (!p || typeof p !== 'string') return;
  const b = blockById(id);
  if (!b) return;
  const H = HANDLERS[b.type];
  if (!H) return;
  if (p.startsWith('_p.')) H.press(b, p.slice(3));
  else if (!syncing && H.param) H.param(b, p);
});

// tiny SVG helpers
const T = (g, x, y, s, o = {}) => svg('text', { x, y, fill: o.fill || '#fff', 'font-family': o.font || "'Inter', sans-serif", 'font-size': o.size || 7, 'font-weight': o.weight || 600, 'text-anchor': o.anchor || 'start', 'dominant-baseline': 'central', 'letter-spacing': o.ls ?? 0, 'pointer-events': 'none' }, g, s);
const R = (g, x, y, width, height, a = {}) => svg('rect', Object.assign({ x, y, width, height }, a), g);
const show = (el, on) => setA(el, 'display', on ? null : 'none');
const cut = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

// ================================================================== ATLAS FLOOR
const ATHEMES = [
  { bg: '#0b0d12', panel: '#161a22', line: '#2a3140', text: '#eef1f6', dim: '#7f8898', acc: '#ff8a3d', sel: '#ffffff', head: '#11141b' },
  { bg: '#030407', panel: '#0b0e14', line: '#1d2330', text: '#c9d1df', dim: '#566074', acc: '#ff5a3d', sel: '#ffd9c2', head: '#07090d' },
  { bg: '#e8ebf0', panel: '#ffffff', line: '#c3c9d4', text: '#141820', dim: '#677084', acc: '#d9621c', sel: '#141820', head: '#d5dae3' },
];
const MENU = ['SIGNAL CHAIN', 'MODEL BROWSER', 'SCENES', 'PRESETS', 'LOOPER', 'TUNER', 'GLOBAL SETTINGS'];
const MENU_SUB = ['2 paths · 12 slots', 'pick a model for the slot', '8 snapshots per preset', '3 banks · 12 presets', '60 s, footswitch control', 'chromatic, mutes output', 'ins/outs · pedals · tempo'];
const pctF = (v) => Math.round(v * 100) + '%';
const GLOBAL = [
  { name: 'INS / OUTS', rows: [
    { l: 'INPUT PAD', k: 'pad', opts: ['0 dB', '-6 dB', '-12 dB'] },
    { l: 'INPUT GATE', k: 'gate', min: 0, max: 0.8, step: 0.05, f: (v) => (v < 0.01 ? 'OFF' : pctF(v)) },
    { l: 'OUTPUT LEVEL', k: 'out', min: -12, max: 12, step: 0.5, f: O.F.db },
    { l: 'PATH ROUTING', k: 'route', opts: ['PARALLEL A+B', 'SERIAL A→B'] },
    { l: 'PATH B LEVEL', k: 'bLvl', min: 0, max: 2, step: 0.05, f: pctF },
  ] },
  { name: 'PEDALS', rows: [
    { l: 'TOE SWITCH', k: 'toe', opts: ['WAH ↔ VOLUME', 'WAH ONLY', 'VOLUME ONLY'] },
    { l: 'WAH VOICE', k: 'wahv', opts: ['CLASSIC', 'VOCAL', 'SMOOTH'] },
    { l: 'VOLUME POSITION', k: 'volPos', opts: ['PRE PATHS', 'POST PATHS'] },
    { l: 'EXP 2 TARGET', k: 'exp2', exp: true },
  ] },
  { name: 'FOOTSWITCHES', rows: [
    { l: 'MODE ON PRESET LOAD', k: 'dmode', opts: ['KEEP', ...O.ATLAS_MODES] },
    { l: 'TAP TEMPO LED', k: 'tapLed', opts: ['OFF', 'ON'] },
  ] },
  { name: 'TEMPO', rows: [
    { l: 'BPM', k: 'bpm', min: 40, max: 240, step: 1, f: (v) => Math.round(v) + ' BPM' },
    { l: 'DELAY SYNC', k: 'sync', opts: ['OFF', 'ON (SUBDIV)'] },
  ] },
  { name: 'TUNER & DISPLAY', rows: [
    { l: 'TUNER REFERENCE', k: 'ref', min: 432, max: 446, step: 1, f: (v) => Math.round(v) + ' Hz' },
    { l: 'SCREEN THEME', k: 'theme', opts: ['GRAPHITE', 'MIDNIGHT', 'DAYLIGHT'] },
    { l: 'STRIP BRIGHTNESS', k: 'stripB', opts: ['DIM', 'BRIGHT'] },
  ] },
];
const at = {
  st: (b) => O.clone(O.atlasState(uiParams(b))),
  put: (b, st, undo = false) => putSt(b, st, { undo, chainFn: O.atlasChain }),
  nav(b) {
    const n = navOf(b);
    if (!n.page) Object.assign(n, { page: 'home', cur: 'A1', pp: 0, bcat: 0, bidx: 0, bcol: 0, mi: 0, gs: 0, gr: 0, sci: 0, pri: 0 });
    return n;
  },
};
function captureScene(st) {
  const sc = { on: {}, v: {} };
  for (const k in st.slots) { sc.on[k] = st.slots[k].on; sc.v[k] = st.slots[k].v.slice(); }
  st.scenes = st.scenes || [];
  st.scenes[st.sc | 0] = sc;
}
function recallScene(st, i) {
  captureScene(st);
  const sc = st.scenes[i];
  if (sc) for (const k in st.slots) {
    const s = st.slots[k];
    if (sc.on[k] !== undefined) s.on = sc.on[k];
    if (sc.v[k] && sc.v[k].length === s.v.length) s.v = sc.v[k].slice();
  }
  st.sc = i;
}
function setModel(st, k, mid) {
  st.scenes = st.scenes || [];
  if (!mid) {
    delete st.slots[k];
    for (const sc of st.scenes) if (sc) { delete sc.on[k]; delete sc.v[k]; }
    return;
  }
  const m = O.MODEL_BY_ID[mid];
  const v = O.modelDefaults(m);
  st.slots[k] = { m: mid, on: 1, v };
  for (let i = 0; i < 8; i++) { const sc = st.scenes[i] || (st.scenes[i] = { on: {}, v: {} }); sc.on[k] = 1; sc.v[k] = v.slice(); }
}
function loadAtlasPreset(st, pi) {
  pi = ((pi % 12) + 12) % 12;
  const src = st.user && st.user[pi] ? O.clone(st.user[pi]) : O.patchToLive(O.ATLAS_FACTORY[pi]);
  Object.assign(st, { name: src.name, slots: src.slots, scenes: src.scenes, sc: src.sc | 0, pi });
  if (st.g && st.g.dmode > 0) st.mode = st.g.dmode - 1;
}
function atlasSlotModel(st, k) {
  const s = st.slots[k];
  return s ? O.MODEL_BY_ID[s.m] : null;
}
function atlasSyncKnobs(b) {
  const n = at.nav(b), st = O.atlasState(uiParams(b));
  const s = st.slots[n.cur], m = s && O.MODEL_BY_ID[s.m];
  for (let i = 0; i < 6; i++) {
    const sp = m && m.knobs[n.pp * 6 + i];
    setUi(b, 'k' + (i + 1), sp ? O.specPos(sp, s.v[n.pp * 6 + i] ?? sp.def) : 0.5);
  }
  n.knobKey = n.cur + '|' + n.pp + '|' + (s ? s.m : '');
}
function atlasPages(st, k) {
  const m = atlasSlotModel(st, k);
  return m ? Math.ceil(m.knobs.length / 6) : 1;
}
function tapTempo(b, st) {
  const n = at.nav(b);
  const now = performance.now();
  n.taps = (n.taps || []).filter((t) => now - t < 2500);
  n.taps.push(now);
  if (n.taps.length >= 2) {
    const d = [];
    for (let i = 1; i < n.taps.length; i++) d.push(n.taps[i] - n.taps[i - 1]);
    const ms = d.reduce((a, x) => a + x, 0) / d.length;
    if (ms > 200 && ms < 2000) {
      st.g.bpm = Math.round(60000 / ms);
      if (!st.g.sync) for (const k in st.slots) { const m = O.MODEL_BY_ID[st.slots[k].m]; if (m.algo === 'delay') st.slots[k].v[0] = Math.round(ms); }
      captureScene(st);
      at.put(b, st);
      flash(b, `TAP  ${st.g.bpm} BPM`, 900);
    }
  }
}
function toggleTuner(b) {
  const on = (uiParams(b)._tuner ?? 0) > 0.5;
  const n = at.nav(b);
  if (!on) n.prevPage = n.page === 'tuner' ? 'home' : n.page;
  setUi(b, '_tuner', on ? 0 : 1);
  n.page = on ? n.prevPage || 'home' : 'tuner';
}
function looperPress(b, st, i) {
  const arg = O.atlasLooperArg(st);
  const lp = state.status.blocks[b.id]?.lp?.looper;
  const t = lp && lp.tracks && lp.tracks[0];
  const s = t ? t.state : 0;
  if (i === 0) engineEvent(b, 1, arg);
  else if (i === 1) engineEvent(b, s === 4 || s === 0 ? 1 : 2, arg);
  else if (i === 2) engineEvent(b, 4, arg);
  else if (i === 3) engineEvent(b, 9, arg);
  else if (i === 4) engineEvent(b, 3, arg);
}
HANDLERS['tz.atlas'] = {
  press(b, name) {
    atlasPress(b, name);
    // leaving the tuner page switches the tuner (and its mute) off
    if (at.nav(b).page !== 'tuner' && (uiParams(b)._tuner ?? 0) > 0.5 && name !== 'tap') setUi(b, '_tuner', 0);
  },
  param(b, p) {
    const m = /^k([1-6])$/.exec(p);
    if (!m) return;
    const n = at.nav(b), st = at.st(b);
    const s = st.slots[n.cur], md = s && O.MODEL_BY_ID[s.m];
    const idx = n.pp * 6 + (+m[1] - 1);
    const sp = md && md.knobs[idx];
    if (!sp) return;
    s.v[idx] = O.specTo(sp, uiParams(b)[p]);
    captureScene(st);
    at.put(b, st);
    n.touch = { idx, t: performance.now() };
  },
};
function atlasPress(b, name) {
  {
    const n = at.nav(b), st = at.st(b);
    const k = n.cur;
    const fs = /^fs(\d+)$/.exec(name);
    if (fs) {
      const i = +fs[1] - 1, mode = st.mode | 0;
      const stompToggle = (key) => { if (!key) return; st.slots[key].on = st.slots[key].on ? 0 : 1; captureScene(st); at.put(b, st, true); };
      if (mode === 0) return stompToggle(O.atlasStompSlots(st)[i]);
      if (mode === 1) {
        if (i < 8) { recallScene(st, i); at.put(b, st, true); flash(b, 'SCENE ' + (i + 1) + '  ' + O.SCENE_NAMES[i], 800); return atlasSyncKnobs(b); }
        captureScene(st); loadAtlasPreset(st, (st.pi | 0) + (i === 8 ? -1 : 1)); at.put(b, st, true); flash(b, presetLabel(st)); return atlasSyncKnobs(b);
      }
      if (mode === 2) {
        const bank = Math.floor((st.pi | 0) / 4);
        if (i < 4) { loadAtlasPreset(st, bank * 4 + i); at.put(b, st, true); flash(b, presetLabel(st)); return atlasSyncKnobs(b); }
        if (i === 4 || i === 9) { loadAtlasPreset(st, (((bank + (i === 4 ? 1 : -1)) % 3) + 3) % 3 * 4 + ((st.pi | 0) % 4)); at.put(b, st, true); flash(b, 'BANK ' + O.ATLAS_BANKS[Math.floor(st.pi / 4)]); return atlasSyncKnobs(b); }
        recallScene(st, i - 5); at.put(b, st, true); return atlasSyncKnobs(b);
      }
      // looper mode
      if (i < 5) return looperPress(b, st, i);
      if (i < 9) return stompToggle(O.atlasStompSlots(st)[i - 5]);
      st.mode = st.prevMode ?? 0; n.page = 'home'; return at.put(b, st);
    }
    switch (name) {
      case 'mode': {
        const nm = ((st.mode | 0) + 1) % 4;
        if (nm === 3) st.prevMode = st.mode | 0;
        st.mode = nm;
        n.page = nm === 3 ? 'looper' : n.page === 'looper' ? 'home' : n.page;
        at.put(b, st);
        return flash(b, O.ATLAS_MODES[nm] + ' MODE', 800);
      }
      case 'tap': return holdable(() => tapTempo(b, O.clone(O.atlasState(uiParams(b)))), () => toggleTuner(b), 700);
      case 'menu': n.page = n.page === 'menu' ? 'home' : 'menu'; return;
      case 'home': n.page = 'home'; return;
      case 'save': {
        captureScene(st);
        st.user = st.user || {};
        st.user[st.pi | 0] = O.clone({ name: st.name, slots: st.slots, scenes: st.scenes, sc: st.sc });
        at.put(b, st, true);
        return flash(b, 'SAVED  ' + presetLabel(st), 1400);
      }
      case 'onoff': if (st.slots[k]) { st.slots[k].on = st.slots[k].on ? 0 : 1; captureScene(st); at.put(b, st, true); } return;
      case 'pgl': case 'pgr': {
        const np = atlasPages(st, k);
        n.pp = (((n.pp | 0) + (name === 'pgr' ? 1 : -1)) % np + np) % np;
        return atlasSyncKnobs(b);
      }
      case 'back': {
        const up = { browser: 'home', menu: 'home', global: 'menu', gsub: 'global', scenes: 'menu', presets: 'menu', looper: 'menu', tuner: 'menu', home: 'home' };
        if (n.page === 'tuner' && (uiParams(b)._tuner ?? 0) > 0.5) setUi(b, '_tuner', 0);
        n.page = up[n.page] || 'home';
        return;
      }
      default: return atlasNav(b, n, st, name);
    }
  }
}
const presetLabel = (st) => O.ATLAS_BANKS[Math.floor((st.pi | 0) / 4)] + (((st.pi | 0) % 4) + 1) + '  ' + st.name;
function openBrowser(b, n, st) {
  const m = atlasSlotModel(st, n.cur);
  n.page = 'browser';
  n.bcat = m ? O.ATLAS_CATS.findIndex((c) => c.id === m.cat) + 1 : 0;
  n.bidx = m ? Math.max(0, O.MODELS_IN[m.cat].indexOf(m)) : 0;
  n.bcol = m ? 1 : 0;
}
function globalRowValue(st, row) {
  const v = st.g[row.k];
  if (row.exp) { const t = O.atlasExpTargets(st)[v]; return v < 0 || !t ? 'OFF' : t.name; }
  if (row.opts) return row.opts[v | 0] ?? row.opts[0];
  return row.f(v ?? row.min);
}
function globalRowStep(st, row, dir) {
  const g = st.g;
  if (row.exp) { const n = O.atlasExpTargets(st).length; g.exp2 = clamp((g.exp2 ?? -1) + dir, -1, n - 1); return; }
  if (row.opts) { const n = row.opts.length; g[row.k] = (((g[row.k] | 0) + dir) % n + n) % n; return; }
  g[row.k] = clamp(Math.round(((g[row.k] ?? row.min) + dir * row.step) / row.step) * row.step, row.min, row.max);
}
function atlasNav(b, n, st, key) {
  const dir = key === 'up' || key === 'left' ? -1 : key === 'down' || key === 'right' ? 1 : 0;
  switch (n.page) {
    case 'home': {
      if (key === 'enter') return openBrowser(b, n, st);
      let p = n.cur[0], i = +n.cur[1];
      if (key === 'left' || key === 'right') i = ((i - 1 + dir + 6) % 6) + 1;
      else p = p === 'A' ? 'B' : 'A';
      n.cur = p + i; n.pp = 0;
      return atlasSyncKnobs(b);
    }
    case 'browser': {
      const cats = O.ATLAS_CATS.length + 1;
      if (key === 'left') { n.bcol = 0; return; }
      if (n.bcol === 0) {
        if (key === 'up' || key === 'down') { n.bcat = (n.bcat + dir + cats) % cats; n.bidx = 0; return; }
        if (key === 'right' || key === 'enter') {
          if (n.bcat === 0) { setModel(st, n.cur, null); at.put(b, st, true); n.page = 'home'; flash(b, n.cur + '  CLEARED', 900); return atlasSyncKnobs(b); }
          n.bcol = 1; return;
        }
      } else {
        const list = O.MODELS_IN[O.ATLAS_CATS[n.bcat - 1].id];
        if (key === 'up' || key === 'down') { n.bidx = (n.bidx + dir + list.length) % list.length; return; }
        if (key === 'enter' || key === 'right') {
          const m = list[n.bidx];
          setModel(st, n.cur, m.id); at.put(b, st, true);
          n.page = 'home'; n.pp = 0; flash(b, n.cur + '  ' + m.name, 1000);
          return atlasSyncKnobs(b);
        }
      }
      return;
    }
    case 'menu': {
      if (key === 'up' || key === 'down') { n.mi = (n.mi + dir + MENU.length) % MENU.length; return; }
      if (key === 'enter' || key === 'right') {
        const pg = ['home', 'browser', 'scenes', 'presets', 'looper', 'tuner', 'global'][n.mi];
        if (pg === 'browser') return openBrowser(b, n, st);
        if (pg === 'tuner') { n.prevPage = 'menu'; if ((uiParams(b)._tuner ?? 0) < 0.5) setUi(b, '_tuner', 1); }
        if (pg === 'scenes') n.sci = st.sc | 0;
        if (pg === 'presets') n.pri = st.pi | 0;
        n.page = pg;
      }
      return;
    }
    case 'global': {
      if (key === 'up' || key === 'down') { n.gs = (n.gs + dir + GLOBAL.length) % GLOBAL.length; return; }
      if (key === 'enter' || key === 'right') { n.page = 'gsub'; n.gr = 0; }
      return;
    }
    case 'gsub': {
      const rows = GLOBAL[n.gs].rows;
      if (key === 'up' || key === 'down') { n.gr = (n.gr + dir + rows.length) % rows.length; return; }
      globalRowStep(st, rows[n.gr], key === 'left' ? -1 : 1);
      at.put(b, st, true);
      return;
    }
    case 'scenes': {
      if (key === 'enter') { recallScene(st, n.sci); at.put(b, st, true); return atlasSyncKnobs(b); }
      if (key === 'left' || key === 'right') n.sci = (n.sci + dir + 8) % 8;
      else n.sci = (n.sci + 4) % 8;
      return;
    }
    case 'presets': {
      if (key === 'enter') { loadAtlasPreset(st, n.pri); at.put(b, st, true); flash(b, presetLabel(st)); n.page = 'home'; return atlasSyncKnobs(b); }
      if (key === 'up' || key === 'down') n.pri = Math.floor(n.pri / 4) * 4 + ((n.pri % 4) + dir + 4) % 4;
      else n.pri = ((Math.floor(n.pri / 4) + dir + 3) % 3) * 4 + (n.pri % 4);
      return;
    }
    case 'looper': {
      if (key === 'enter') looperPress(b, st, 0);
      else if (key === 'down') looperPress(b, st, 1);
      else if (key === 'left') looperPress(b, st, 2);
      else if (key === 'right') looperPress(b, st, 3);
      return;
    }
    case 'tuner': {
      if (key === 'left' || key === 'right') { st.g.ref = clamp((st.g.ref || 440) + dir, 432, 446); at.put(b, st); }
      return;
    }
  }
}

// ---- the Atlas main screen (330 × 160)
const AF = "'Inter', sans-serif", AH = "'Oswald', sans-serif";
const TILE_W = 38, TILE_H = 22;
const tileX = (i) => 38 + i * 43;
const rowY = (p) => (p === 'A' ? 36 : 70);
const CELLS = 6, CELL_W = 330 / 6;
registerScreen('tz5-atlas', {
  build(s, g, w, h) {
    s.w = w; s.h = h;
    s.bg = R(g, 0, 0, w, h, { fill: ATHEMES[0].bg });
    // header
    s.head = R(g, 0, 0, w, 14, { fill: ATHEMES[0].head });
    s.hPreset = T(g, 6, 7.2, '', { font: AH, size: 7.6, weight: 600, ls: 0.4 });
    s.hScene = T(g, 182, 7.2, '', { size: 6, weight: 700, anchor: 'middle' });
    s.hSceneDot = svg('circle', { cx: 150, cy: 7, r: 2.6, fill: '#fff' }, g);
    s.hMode = T(g, w - 6, 7.2, '', { size: 6, weight: 800, anchor: 'end', ls: 0.6 });
    s.pages = {};
    const page = (name) => (s.pages[name] = svg('g', {}, g));
    // ---------- home
    const hp = page('home');
    s.wires = svg('path', { d: '', fill: 'none', stroke: '#2a3140', 'stroke-width': 1.4 }, hp);
    s.ioIn = svg('circle', { cx: 12, cy: 53, r: 4.5, fill: 'none', stroke: '#7f8898', 'stroke-width': 1.2 }, hp);
    s.ioOut = svg('circle', { cx: w - 12, cy: 53, r: 4.5, fill: 'none', stroke: '#7f8898', 'stroke-width': 1.2 }, hp);
    s.ioInT = T(hp, 12, 63, 'IN', { size: 4.6, anchor: 'middle', weight: 800 });
    s.ioOutT = T(hp, w - 12, 63, 'OUT', { size: 4.6, anchor: 'middle', weight: 800 });
    s.pathLbl = ['A', 'B'].map((p) => T(hp, 27, rowY(p) - 15, p, { size: 5, weight: 800, anchor: 'middle' }));
    s.tiles = {};
    for (const k of O.SLOTS) {
      const x = tileX(+k[1] - 1), y = rowY(k[0]) - TILE_H / 2;
      const tg = svg('g', { transform: `translate(${x},${y})` }, hp);
      const box = R(tg, 0, 0, TILE_W, TILE_H, { rx: 3.5, fill: '#1c212b', stroke: '#2a3140', 'stroke-width': 0.8 });
      const bar = R(tg, 0, TILE_H - 3, TILE_W, 3, { fill: '#000', 'fill-opacity': 0 });
      const nm = T(tg, TILE_W / 2, 8.6, '', { size: 5.4, weight: 700, anchor: 'middle' });
      const cat = T(tg, TILE_W / 2, 15.4, '', { size: 3.8, weight: 800, anchor: 'middle', ls: 0.5 });
      s.tiles[k] = { g: tg, box, bar, nm, cat };
    }
    s.cursor = R(hp, 0, 0, TILE_W + 4, TILE_H + 4, { rx: 5, fill: 'none', stroke: '#fff', 'stroke-width': 1.4 });
    s.info = T(hp, 6, 95, '', { size: 6, weight: 700 });
    s.infoR = T(hp, w - 6, 95, '', { size: 5.4, weight: 700, anchor: 'end' });
    s.cells = [];
    for (let i = 0; i < CELLS; i++) {
      const x = i * CELL_W;
      const cg = svg('g', { transform: `translate(${x},103)` }, hp);
      const bgc = R(cg, 2, 0, CELL_W - 4, 54, { rx: 4, fill: '#161a22' });
      const lb = T(cg, CELL_W / 2, 9, '', { size: 5.2, weight: 800, anchor: 'middle', ls: 0.4 });
      const vl = T(cg, CELL_W / 2, 23, '', { size: 8.4, weight: 700, anchor: 'middle', font: AH });
      const arcBg = svg('path', { d: arcPath(CELL_W / 2, 41, 9, 0, 1), fill: 'none', stroke: '#2a3140', 'stroke-width': 2.4, 'stroke-linecap': 'round' }, cg);
      const arc = svg('path', { d: '', fill: 'none', stroke: '#ff8a3d', 'stroke-width': 2.4, 'stroke-linecap': 'round' }, cg);
      const num = T(cg, CELL_W / 2, 41.5, String(i + 1), { size: 5, weight: 800, anchor: 'middle' });
      s.cells.push({ bgc, lb, vl, arcBg, arc, num });
    }
    // ---------- browser
    const bp = page('browser');
    s.bTitle = T(bp, 6, 21, '', { font: AH, size: 7.4, weight: 600 });
    s.bCatRows = [];
    for (let i = 0; i < 11; i++) {
      const y = 28 + i * 11.6;
      const hl = R(bp, 4, y, 104, 10.6, { rx: 2.5, fill: '#ff8a3d', 'fill-opacity': 0 });
      const sw = R(bp, 8, y + 2.8, 5, 5, { rx: 1, fill: '#fff' });
      const t = T(bp, 17, y + 5.6, '', { size: 5.8, weight: 700 });
      s.bCatRows.push({ hl, sw, t });
    }
    s.bSep = R(bp, 112, 26, 0.8, 130, { fill: '#2a3140' });
    s.bModRows = [];
    for (let i = 0; i < 11; i++) {
      const y = 28 + i * 11.6;
      const hl = R(bp, 117, y, w - 122, 10.6, { rx: 2.5, fill: '#fff', 'fill-opacity': 0 });
      const t = T(bp, 122, y + 5.6, '', { size: 6, weight: 600 });
      const sub = T(bp, w - 8, y + 5.6, '', { size: 4.8, weight: 700, anchor: 'end' });
      s.bModRows.push({ hl, t, sub });
    }
    s.bScroll = R(bp, w - 3, 28, 1.6, 20, { rx: 0.8, fill: '#7f8898' });
    // ---------- lists (menu / global / gsub share one list widget)
    const lp = page('list');
    s.lTitle = T(lp, 8, 22, '', { font: AH, size: 8.4, weight: 600, ls: 0.6 });
    s.lCrumb = T(lp, w - 8, 22, '', { size: 5, weight: 700, anchor: 'end' });
    s.lRows = [];
    for (let i = 0; i < 8; i++) {
      const y = 31 + i * 15.5;
      const hl = R(lp, 5, y, w - 10, 13.5, { rx: 3, fill: '#ff8a3d', 'fill-opacity': 0 });
      const t = T(lp, 13, y + 6.9, '', { size: 6.6, weight: 700 });
      const v = T(lp, w - 13, y + 6.9, '', { size: 6, weight: 600, anchor: 'end' });
      s.lRows.push({ hl, t, v });
    }
    // ---------- scenes grid
    const sp = page('scenes');
    s.sTitle = T(sp, 8, 22, 'SCENES', { font: AH, size: 8.4, weight: 600, ls: 0.6 });
    s.sHint = T(sp, w - 8, 22, 'ENTER = RECALL', { size: 5, weight: 700, anchor: 'end' });
    s.sCards = [];
    for (let i = 0; i < 8; i++) {
      const x = 6 + (i % 4) * 80, y = 32 + Math.floor(i / 4) * 62;
      const box = R(sp, x, y, 74, 56, { rx: 5, fill: '#161a22', stroke: '#2a3140', 'stroke-width': 1 });
      const band = R(sp, x, y, 74, 6, { rx: 2, fill: O.SCENE_COLS[i] });
      const num = T(sp, x + 8, y + 18, String(i + 1), { font: AH, size: 13, weight: 600 });
      const nm = T(sp, x + 8, y + 34, O.SCENE_NAMES[i], { size: 6.2, weight: 800 });
      const sub = T(sp, x + 8, y + 45, '', { size: 4.8, weight: 700 });
      s.sCards.push({ box, band, num, nm, sub });
    }
    // ---------- presets grid
    const pp = page('presets');
    s.pTitle = T(pp, 8, 22, 'PRESETS', { font: AH, size: 8.4, weight: 600, ls: 0.6 });
    s.pBanks = O.ATLAS_BANKS.map((bk, c) => T(pp, 10 + c * 108, 36, 'BANK ' + bk, { size: 5.4, weight: 800, ls: 0.8 }));
    s.pCells = [];
    for (let i = 0; i < 12; i++) {
      const c = Math.floor(i / 4), r = i % 4;
      const x = 6 + c * 108, y = 42 + r * 28;
      const box = R(pp, x, y, 102, 24, { rx: 4, fill: '#161a22', stroke: '#2a3140', 'stroke-width': 1 });
      const id = T(pp, x + 7, y + 12, O.ATLAS_BANKS[c] + (r + 1), { font: AH, size: 8, weight: 600 });
      const nm = T(pp, x + 22, y + 12, '', { size: 5.6, weight: 700 });
      s.pCells.push({ box, id, nm });
    }
    // ---------- looper
    const lo = page('looper');
    s.loTitle = T(lo, 8, 22, 'LOOPER', { font: AH, size: 8.4, weight: 600, ls: 0.6 });
    s.loState = T(lo, w / 2, 56, '', { font: AH, size: 26, weight: 700, anchor: 'middle', ls: 2 });
    s.loBarBg = R(lo, 30, 80, w - 60, 8, { rx: 4, fill: '#161a22' });
    s.loBar = R(lo, 30, 80, 0, 8, { rx: 4, fill: '#46d36f' });
    s.loLen = T(lo, w / 2, 98, '', { size: 6, weight: 700, anchor: 'middle' });
    s.loLegend = ['1 REC/DUB', '2 PLAY/STOP', '3 UNDO', '4 REVERSE', '5 CLEAR', '6-9 STOMP', '10 EXIT'].map((t, i) => T(lo, 14 + (i % 4) * 78, 120 + Math.floor(i / 4) * 14, t, { size: 5.4, weight: 700 }));
    // ---------- tuner
    const tu = page('tuner');
    s.tuTitle = T(tu, 8, 22, 'TUNER', { font: AH, size: 8.4, weight: 600, ls: 0.6 });
    s.tuRef = T(tu, w - 8, 22, '', { size: 5.4, weight: 700, anchor: 'end' });
    s.tuNote = T(tu, w / 2, 62, '', { font: AH, size: 40, weight: 700, anchor: 'middle' });
    s.tuTicks = [];
    for (let i = -10; i <= 10; i++) s.tuTicks.push(R(tu, w / 2 + i * 13 - 1.5, 102, 3, i === 0 ? 16 : i % 5 === 0 ? 12 : 8, { rx: 1, fill: '#2a3140', y: i === 0 ? 100 : i % 5 === 0 ? 102 : 104 }));
    s.tuCents = T(tu, w / 2, 132, '', { size: 7, weight: 700, anchor: 'middle' });
    s.tuMute = T(tu, w / 2, 148, 'OUTPUT MUTED · BACK / HOLD TAP TO EXIT', { size: 5, weight: 800, anchor: 'middle', ls: 0.6 });
    // ---------- message toast
    s.msgG = svg('g', {}, g);
    s.msgBox = R(s.msgG, w / 2 - 90, h / 2 - 11, 180, 22, { rx: 6, fill: '#000', 'fill-opacity': 0.82, stroke: '#ff8a3d', 'stroke-width': 1 });
    s.msgT = T(s.msgG, w / 2, h / 2, '', { size: 7.2, weight: 800, anchor: 'middle', ls: 0.6 });
    s.sig = '';
  },
  update(s, status, view, now) {
    const b = view.block;
    const ui = s.ui;
    const st = O.atlasState(ui);
    const n = at.nav(b);
    const th = ATHEMES[(st.g && st.g.theme) | 0] || ATHEMES[0];
    const tuner = (ui._tuner ?? 0) > 0.5;
    if (!tuner && n.page === 'tuner') n.page = n.prevPage && n.prevPage !== 'tuner' ? n.prevPage : 'home';
    if ((st.mode | 0) === 3 && n.page === 'home' && !n.looperSeen) { n.page = 'looper'; n.looperSeen = true; }
    if ((st.mode | 0) !== 3) n.looperSeen = false;
    // knobs follow the cursor slot (also after undo / preset loads)
    const kk = n.cur + '|' + n.pp + '|' + (st.slots[n.cur] ? st.slots[n.cur].m : '');
    if (kk !== n.knobKey || ui._st !== s.lastSt) { s.lastSt = ui._st; atlasSyncKnobs(b); }
    const msgOn = n.msg && now < n.msgT;
    const sig = [ui._st, n.page, n.cur, n.pp, n.bcat, n.bidx, n.bcol, n.mi, n.gs, n.gr, n.sci, n.pri, msgOn ? n.msg : '', ui.exp2 ?? 0].join('|');
    if (sig !== s.sig) {
      s.sig = sig;
      atlasDraw(s, st, n, th, ui);
      show(s.msgG, msgOn);
      if (msgOn) { setText(s.msgT, n.msg); setA(s.msgBox, 'stroke', th.acc); }
    }
    if (n.page === 'looper') atlasLooper(s, status, th);
    if (n.page === 'tuner') atlasTuner(s, status, th, st);
    if (msgOn !== s.msgShown) { s.msgShown = msgOn; show(s.msgG, msgOn); if (!msgOn) s.sig = ''; }
  },
  pointer(s, view, type, pt, e) {
    const b = view.block;
    const n = at.nav(b);
    const st = at.st(b);
    const press = (name) => HANDLERS['tz.atlas'].press(b, name);
    if (type === 'wheel') {
      const dir = e.deltaY < 0 ? -1 : 1;
      if (n.page === 'home' && pt.y > 103) {
        const ci = clamp(Math.floor(pt.x / CELL_W), 0, 5);
        const s0 = st.slots[n.cur], md = s0 && O.MODEL_BY_ID[s0.m], idx = n.pp * 6 + ci, sp = md && md.knobs[idx];
        if (!sp) return;
        const pos = clamp(O.specPos(sp, s0.v[idx]) - dir * (sp.step ? 0 : 0.02), 0, 1);
        s0.v[idx] = sp.step ? clamp(s0.v[idx] - dir * sp.step, Math.min(sp.min, sp.max), Math.max(sp.min, sp.max)) : O.specTo(sp, pos);
        captureScene(st); at.put(b, st); atlasSyncKnobs(b);
        return;
      }
      return press(dir < 0 ? 'up' : 'down');
    }
    if (type !== 'down' && type !== 'dbl') return;
    if (pt.y < 14) {
      n.page = pt.x < 130 ? 'presets' : pt.x < 230 ? 'scenes' : 'menu';
      if (n.page === 'presets') n.pri = st.pi | 0;
      if (n.page === 'scenes') n.sci = st.sc | 0;
      return;
    }
    if (n.page === 'home') {
      for (const k of O.SLOTS) {
        const x = tileX(+k[1] - 1), y = rowY(k[0]) - TILE_H / 2;
        if (pt.x >= x - 2 && pt.x <= x + TILE_W + 2 && pt.y >= y - 3 && pt.y <= y + TILE_H + 3) {
          const again = n.cur === k && performance.now() - (n.tapT || 0) < 450;
          n.tapT = performance.now();
          if (n.cur !== k) { n.cur = k; n.pp = 0; atlasSyncKnobs(b); }
          if (type === 'dbl' || again) openBrowser(b, n, st);
          return;
        }
      }
      return;
    }
    const rowAt = (y0, hgt, nrows) => { const r = Math.floor((pt.y - y0) / hgt); return r >= 0 && r < nrows ? r : -1; };
    if (n.page === 'browser') {
      const r = rowAt(28, 11.6, 11);
      if (r < 0) return;
      if (pt.x < 112) { n.bcat = r; n.bidx = 0; n.bcol = 0; if (r === 0 && type === 'dbl') press('enter'); return; }
      const list = n.bcat > 0 ? O.MODELS_IN[O.ATLAS_CATS[n.bcat - 1].id] : [];
      const top = clamp(n.bidx - 5, 0, Math.max(0, list.length - 11));
      if (top + r < list.length) { n.bcol = 1; n.bidx = top + r; press('enter'); }
      return;
    }
    if (n.page === 'menu' || n.page === 'global' || n.page === 'gsub') {
      const r = rowAt(31, 15.5, 8);
      if (r < 0) return;
      if (n.page === 'menu' && r < MENU.length) { n.mi = r; press('enter'); }
      else if (n.page === 'global' && r < GLOBAL.length) { n.gs = r; press('enter'); }
      else if (n.page === 'gsub' && r < GLOBAL[n.gs].rows.length) { n.gr = r; press(pt.x < 165 ? 'left' : 'right'); }
      return;
    }
    if (n.page === 'scenes') {
      const c = Math.floor((pt.x - 6) / 80), r = Math.floor((pt.y - 32) / 62);
      if (c >= 0 && c < 4 && r >= 0 && r < 2) { n.sci = r * 4 + c; press('enter'); }
      return;
    }
    if (n.page === 'presets') {
      const c = Math.floor((pt.x - 6) / 108), r = Math.floor((pt.y - 42) / 28);
      if (c >= 0 && c < 3 && r >= 0 && r < 4) { n.pri = c * 4 + r; press('enter'); }
    }
  },
});
function arcPath(cx, cy, r, a0, a1) {
  // 270° sweep knob arc from position a0 to a1 (0..1)
  const ang = (t) => ((-135 + 270 * t) * Math.PI) / 180;
  const p = (t) => [cx + Math.sin(ang(t)) * r, cy - Math.cos(ang(t)) * r];
  if (a1 - a0 < 0.004) return '';
  const [x0, y0] = p(a0), [x1, y1] = p(a1);
  return `M${x0.toFixed(2)} ${y0.toFixed(2)}A${r} ${r} 0 ${(a1 - a0) * 270 > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}
function atlasDraw(s, st, n, th, ui) {
  const w = s.w;
  setA(s.bg, 'fill', th.bg); setA(s.head, 'fill', th.head);
  setText(s.hPreset, presetLabel(st));
  setA(s.hPreset, 'fill', th.text);
  const sc = st.sc | 0;
  setText(s.hScene, 'SCENE ' + (sc + 1) + ' · ' + O.SCENE_NAMES[sc]);
  setA(s.hScene, 'fill', th.text);
  setA(s.hSceneDot, 'fill', O.SCENE_COLS[sc]);
  setText(s.hMode, O.ATLAS_MODES[st.mode | 0] + '  ' + Math.round(st.g.bpm || 120) + ' BPM');
  setA(s.hMode, 'fill', th.acc);
  const pg = n.page === 'menu' || n.page === 'global' || n.page === 'gsub' ? 'list' : n.page;
  for (const k in s.pages) show(s.pages[k], k === pg);
  if (pg === 'home') {
    const hasB = O.SLOTS.slice(6).some((k) => st.slots[k]);
    const hasA = O.SLOTS.slice(0, 6).some((k) => st.slots[k]);
    const serial = st.g.route > 0.5 || !hasB || !hasA;
    // wires: in → split → rows → merge → out (serial: A row then B row)
    let d = '';
    const x0 = tileX(0) - 6, x1 = tileX(5) + TILE_W + 6;
    if (!serial) d = `M17 53H24V${rowY('A')}H${x1}V53H${w - 17}M24 53V${rowY('B')}H${x1}V53`;
    else if (hasB && hasA) d = `M17 53H24V${rowY('A')}H${x1}V53H${x0}V${rowY('B')}H${x1}V53H${w - 17}`;
    else d = `M17 53H24V${rowY(hasB ? 'B' : 'A')}H${x1}V53H${w - 17}`;
    setA(s.wires, 'd', d);
    setA(s.wires, 'stroke', th.line);
    for (const el of [s.ioIn, s.ioOut]) setA(el, 'stroke', th.dim);
    for (const el of [s.ioInT, s.ioOutT, ...s.pathLbl]) setA(el, 'fill', th.dim);
    for (const k of O.SLOTS) {
      const t = s.tiles[k], sl = st.slots[k];
      const m = sl && O.MODEL_BY_ID[sl.m];
      const cat = m && O.CAT_BY_ID[m.cat];
      if (m) {
        setA(t.box, 'fill', sl.on ? cat.color : th.panel);
        setA(t.box, 'fill-opacity', sl.on ? 0.92 : 1);
        setA(t.box, 'stroke', cat.color);
        setA(t.box, 'stroke-dasharray', null);
        setText(t.nm, m.short);
        setText(t.cat, cat.short + (sl.on ? '' : ' · OFF'));
        setA(t.nm, 'fill', sl.on ? '#101317' : cat.color);
        setA(t.cat, 'fill', sl.on ? '#101317' : th.dim);
      } else {
        setA(t.box, 'fill', th.bg); setA(t.box, 'fill-opacity', 1);
        setA(t.box, 'stroke', th.line); setA(t.box, 'stroke-dasharray', '2 2');
        setText(t.nm, ''); setText(t.cat, '+');
        setA(t.cat, 'fill', th.dim);
      }
    }
    const cx = tileX(+n.cur[1] - 1) - 2, cy = rowY(n.cur[0]) - TILE_H / 2 - 2;
    setA(s.cursor, 'x', cx); setA(s.cursor, 'y', cy); setA(s.cursor, 'stroke', th.sel);
    const sl = st.slots[n.cur], m = sl && O.MODEL_BY_ID[sl.m];
    const np = atlasPages(st, n.cur);
    setText(s.info, m ? `${n.cur}  ·  ${O.CAT_BY_ID[m.cat].name}  ·  ${m.name}${sl.on ? '' : '  (OFF)'}` : `${n.cur}  ·  EMPTY — ENTER TO ADD A MODEL`);
    setA(s.info, 'fill', m ? O.CAT_BY_ID[m.cat].color : th.dim);
    setText(s.infoR, m ? `PAGE ${n.pp + 1}/${np}` : '');
    setA(s.infoR, 'fill', th.dim);
    const g = st.g, targets = g.exp2 >= 0 ? O.atlasExpTargets(st) : [], tgt = targets[g.exp2 | 0];
    s.cells.forEach((c, i) => {
      const idx = n.pp * 6 + i, sp = m && m.knobs[idx];
      setA(c.bgc, 'fill', th.panel);
      setA(c.arcBg, 'stroke', th.line);
      if (!sp) { setText(c.lb, ''); setText(c.vl, ''); setA(c.arc, 'd', ''); setA(c.num, 'fill', th.line); return; }
      let v = sl.v[idx] ?? sp.def;
      const isExp = tgt && tgt.s === n.cur && tgt.i === idx;
      if (isExp) v = O.specTo(sp, ui.exp2 ?? 0);
      setText(c.lb, sp.l + (isExp ? ' ◆' : ''));
      setA(c.lb, 'fill', isExp ? th.acc : th.dim);
      setText(c.vl, O.specFmt(sp, v));
      setA(c.vl, 'fill', th.text);
      setA(c.arc, 'd', arcPath(CELL_W / 2, 41, 9, 0, O.specPos(sp, v)));
      setA(c.arc, 'stroke', O.CAT_BY_ID[m.cat].color);
      setA(c.num, 'fill', th.dim);
    });
  } else if (pg === 'browser') {
    setText(s.bTitle, `MODEL BROWSER  ·  ${n.cur}`);
    setA(s.bTitle, 'fill', th.text);
    const cats = [{ name: '— EMPTY SLOT —', color: th.dim }, ...O.ATLAS_CATS];
    s.bCatRows.forEach((r, i) => {
      const c = cats[i];
      setText(r.t, c.name);
      const selected = n.bcat === i;
      setA(r.hl, 'fill', selected ? (n.bcol === 0 ? th.acc : th.line) : th.bg);
      setA(r.hl, 'fill-opacity', selected ? (n.bcol === 0 ? 0.9 : 0.8) : 0);
      setA(r.t, 'fill', selected && n.bcol === 0 ? '#101317' : th.text);
      setA(r.sw, 'fill', c.color);
    });
    setA(s.bSep, 'fill', th.line);
    const list = n.bcat > 0 ? O.MODELS_IN[O.ATLAS_CATS[n.bcat - 1].id] : [];
    const top = clamp(n.bidx - 5, 0, Math.max(0, list.length - 11));
    const cur = st.slots[n.cur] && st.slots[n.cur].m;
    s.bModRows.forEach((r, i) => {
      const m = list[top + i];
      setText(r.t, m ? m.name : i === 0 && n.bcat === 0 ? 'ENTER clears this slot' : '');
      setText(r.sub, m ? (m.id === cur ? '● LOADED' : m.algo.toUpperCase()) : '');
      const sel = m && top + i === n.bidx;
      setA(r.hl, 'fill', sel ? (n.bcol === 1 ? O.CAT_BY_ID[m.cat].color : th.line) : th.bg);
      setA(r.hl, 'fill-opacity', sel ? 0.9 : 0);
      setA(r.t, 'fill', sel && n.bcol === 1 ? '#101317' : m ? th.text : th.dim);
      setA(r.sub, 'fill', sel && n.bcol === 1 ? '#101317' : th.dim);
    });
    show(s.bScroll, list.length > 11);
    if (list.length > 11) { setA(s.bScroll, 'y', 28 + (128 * top) / list.length); setA(s.bScroll, 'height', (128 * 11) / list.length); }
  } else if (pg === 'list') {
    let title, crumb, rows;
    if (n.page === 'menu') { title = 'MENU'; crumb = 'ENTER = OPEN · BACK'; rows = MENU.map((t, i) => [t, MENU_SUB[i]]); }
    else if (n.page === 'global') { title = 'GLOBAL SETTINGS'; crumb = 'MENU ▸ GLOBAL'; rows = GLOBAL.map((x) => [x.name, x.rows.length + ' settings  ▶']); }
    else { title = GLOBAL[n.gs].name; crumb = 'GLOBAL ▸ ' + GLOBAL[n.gs].name + '  ·  ◀ ▶ CHANGE'; rows = GLOBAL[n.gs].rows.map((r) => [r.l, '◀  ' + cut(globalRowValue(st, r), 22) + '  ▶']); }
    const sel = n.page === 'menu' ? n.mi : n.page === 'global' ? n.gs : n.gr;
    setText(s.lTitle, title); setA(s.lTitle, 'fill', th.text);
    setText(s.lCrumb, crumb); setA(s.lCrumb, 'fill', th.dim);
    s.lRows.forEach((r, i) => {
      const row = rows[i];
      setText(r.t, row ? row[0] : ''); setText(r.v, row ? row[1] : '');
      const on = row && i === sel;
      setA(r.hl, 'fill', on ? th.acc : th.bg); setA(r.hl, 'fill-opacity', on ? 0.92 : 0);
      setA(r.t, 'fill', on ? '#101317' : th.text);
      setA(r.v, 'fill', on ? '#101317' : th.dim);
    });
  } else if (pg === 'scenes') {
    setA(s.sTitle, 'fill', th.text); setA(s.sHint, 'fill', th.dim);
    s.sCards.forEach((c, i) => {
      const active = (st.sc | 0) === i, sel = n.sci === i;
      setA(c.box, 'fill', active ? O.SCENE_COLS[i] : th.panel);
      setA(c.box, 'fill-opacity', active ? 0.85 : 1);
      setA(c.box, 'stroke', sel ? th.sel : th.line);
      setA(c.box, 'stroke-width', sel ? 1.8 : 1);
      setA(c.num, 'fill', active ? '#101317' : th.text);
      setA(c.nm, 'fill', active ? '#101317' : O.SCENE_COLS[i]);
      const sc = st.scenes && st.scenes[i];
      const ons = sc ? Object.values(sc.on).filter((x) => x).length : 0;
      setText(c.sub, active ? '● ACTIVE' : sc ? ons + ' blocks on' : '');
      setA(c.sub, 'fill', active ? '#101317' : th.dim);
    });
  } else if (pg === 'presets') {
    setA(s.pTitle, 'fill', th.text);
    s.pBanks.forEach((t) => setA(t, 'fill', th.dim));
    s.pCells.forEach((c, i) => {
      const active = (st.pi | 0) === i, sel = n.pri === i;
      setText(c.nm, cut(O.presetName(st, i) || '', 15) + (st.user && st.user[i] ? ' *' : ''));
      setA(c.box, 'fill', active ? th.acc : th.panel);
      setA(c.box, 'stroke', sel ? th.sel : th.line);
      setA(c.box, 'stroke-width', sel ? 1.8 : 1);
      setA(c.id, 'fill', active ? '#101317' : th.acc);
      setA(c.nm, 'fill', active ? '#101317' : th.text);
    });
  } else if (pg === 'looper') {
    setA(s.loTitle, 'fill', th.text);
    s.loLegend.forEach((t) => setA(t, 'fill', th.dim));
    setA(s.loBarBg, 'fill', th.panel);
    s.loKey = '';
  } else if (pg === 'tuner') {
    setA(s.tuTitle, 'fill', th.text);
    setText(s.tuRef, 'REF ' + (st.g.ref || 440) + ' Hz  ·  ◀ ▶');
    setA(s.tuRef, 'fill', th.dim);
    setA(s.tuMute, 'fill', th.acc);
    s.tuKey = '';
  }
}
const LOOP_NAMES = ['EMPTY', 'RECORDING', 'PLAYING', 'OVERDUB', 'STOPPED'];
const LOOP_COLS = ['#7f8898', '#ff3b30', '#46d36f', '#ffb21f', '#e8ecf3'];
function atlasLooper(s, status, th) {
  const lp = status && status.lp && status.lp.looper;
  const t = lp && lp.tracks && lp.tracks[0];
  const stt = t ? t.state : 0;
  const key = stt + '|' + (t ? Math.round((t.pos || 0) * 200) : 0) + '|' + (t && t.rev ? 1 : 0);
  if (key === s.loKey) return;
  s.loKey = key;
  setText(s.loState, LOOP_NAMES[stt] + (t && t.rev ? ' ◀◀' : ''));
  setA(s.loState, 'fill', LOOP_COLS[stt]);
  const frac = t && stt === 1 ? (t.pos % 4) / 4 : t && t.len > 0 ? clamp(t.pos, 0, 1) : 0;
  setA(s.loBar, 'width', ((s.w - 60) * frac).toFixed(1));
  setA(s.loBar, 'fill', LOOP_COLS[stt]);
  setText(s.loLen, t && t.len > 0 ? (stt === 1 ? 'REC ' : 'LOOP ') + t.len.toFixed(1) + ' s  /  60 s' : 'PRESS FS 1 TO RECORD');
  setA(s.loLen, 'fill', th.dim);
}
function atlasTuner(s, status, th) {
  const tu = status && status.tu && status.tu.tuner;
  const note = tu && tu.note;
  const c = note ? tu.cents || 0 : 0;
  const key = (note || '-') + '|' + Math.round(c);
  if (key === s.tuKey) return;
  s.tuKey = key;
  const ok = note && Math.abs(c) < 3;
  setText(s.tuNote, note || '—');
  setA(s.tuNote, 'fill', !note ? th.dim : ok ? '#46d36f' : th.text);
  const pos = Math.round(clamp(c / 50, -1, 1) * 10);
  s.tuTicks.forEach((r, i) => {
    const k = i - 10;
    const lit = note && (k === pos || (ok && k === 0));
    setA(r, 'fill', lit ? (ok ? '#46d36f' : Math.abs(k) > 5 ? '#ff3b30' : th.acc) : th.line);
  });
  setText(s.tuCents, note ? (c > 0 ? '+' : '') + c.toFixed(1) + ' cents' + (tu.freq ? '  ·  ' + tu.freq.toFixed(1) + ' Hz' : '') : 'play a single note');
  setA(s.tuCents, 'fill', th.dim);
}
// ---- scribble strips (one screen per footswitch row, 5 cells)
registerScreen('tz5-atlas-strip', {
  build(s, g, w, h) {
    s.cells = [];
    const cw = w / 5;
    for (let i = 0; i < 5; i++) {
      const x = i * cw;
      const bg = R(g, x + 3, 1.5, cw - 6, h - 3, { rx: 2, fill: '#10131a' });
      const bar = R(g, x + 3, 1.5, 3, h - 3, { rx: 1, fill: '#fff' });
      const num = T(g, x + 11, h / 2 + 0.3, '', { size: 4.6, weight: 800, fill: '#5d6575' });
      const t = T(g, x + cw / 2 + 4, h / 2 + 0.3, '', { size: 6.6, weight: 800, anchor: 'middle', ls: 0.4 });
      s.cells.push({ bg, bar, num, t });
    }
    s.sig = '';
  },
  update(s, status, view) {
    const st = O.atlasState(s.ui);
    const row = s.ctl.row | 0;
    const lp = status && status.lp && status.lp.looper;
    const infos = [0, 1, 2, 3, 4].map((i) => O.atlasFsInfo(st, row * 5 + i, lp));
    const bright = (st.g && st.g.stripB) ?? 1;
    const sig = JSON.stringify(infos) + bright + (view.block.bypass ? 1 : 0);
    if (sig === s.sig) return;
    s.sig = sig;
    infos.forEach((f, i) => {
      const c = s.cells[i];
      setText(c.t, cut(f.label, 13));
      setText(c.num, String(row * 5 + i + 1));
      setA(c.t, 'fill', f.lit ? f.color : bright ? '#aab2c0' : '#6b7383');
      setA(c.bar, 'fill', f.color);
      setA(c.bar, 'fill-opacity', f.lit ? 1 : 0.25);
      setA(c.bg, 'fill', f.lit ? '#1b2130' : '#10131a');
    });
  },
});

// ================================================================== AURORA DESK (vector scope)
// stroke font on a 4 × 6 grid: each glyph is a list of polylines "x,y x,y …"
const O_ = '1,0 3,0 4,1 4,5 3,6 1,6 0,5 0,1 1,0';
const P_ = '0,6 0,0 3,0 4,1 4,2 3,3 0,3';
const VGLYPH = {
  A: ['0,6 0,2 2,0 4,2 4,6', '0,3.6 4,3.6'], B: ['0,6 0,0 3,0 4,1 4,2 3,3 0,3', '3,3 4,4 4,5 3,6 0,6'], C: ['4,1 3,0 1,0 0,1 0,5 1,6 3,6 4,5'],
  D: ['0,0 0,6 2.5,6 4,4.5 4,1.5 2.5,0 0,0'], E: ['4,0 0,0 0,6 4,6', '0,3 3,3'], F: ['4,0 0,0 0,6', '0,3 3,3'], G: ['4,1 3,0 1,0 0,1 0,5 1,6 3,6 4,5 4,3.4 2.2,3.4'],
  H: ['0,0 0,6', '4,0 4,6', '0,3 4,3'], I: ['1,0 3,0', '2,0 2,6', '1,6 3,6'], J: ['4,0 4,5 3,6 1,6 0,5'], K: ['0,0 0,6', '4,0 0,4', '1.3,3 4,6'], L: ['0,0 0,6 4,6'],
  M: ['0,6 0,0 2,3 4,0 4,6'], N: ['0,6 0,0 4,6 4,0'], O: [O_], P: [P_], Q: [O_, '2.4,4.4 4,6'], R: [P_, '2,3 4,6'],
  S: ['4,1 3,0 1,0 0,1 0,2 1,3 3,3 4,4 4,5 3,6 1,6 0,5'], T: ['0,0 4,0', '2,0 2,6'], U: ['0,0 0,5 1,6 3,6 4,5 4,0'], V: ['0,0 2,6 4,0'], W: ['0,0 1,6 2,3 3,6 4,0'],
  X: ['0,0 4,6', '4,0 0,6'], Y: ['0,0 2,3 4,0', '2,3 2,6'], Z: ['0,0 4,0 0,6 4,6'],
  0: [O_, '4,1 0,5'], 1: ['1,1 2,0 2,6', '1,6 3,6'], 2: ['0,1 1,0 3,0 4,1 4,2 0,6 4,6'], 3: ['0,1 1,0 3,0 4,1 4,2 3,3 2,3', '3,3 4,4 4,5 3,6 1,6 0,5'],
  4: ['3,6 3,0 0,4 4,4'], 5: ['4,0 0,0 0,3 3,3 4,4 4,5 3,6 0,6'], 6: ['3,0 1,0 0,1 0,5 1,6 3,6 4,5 4,4 3,3 0,3'], 7: ['0,0 4,0 1.5,6'],
  8: ['1,0 3,0 4,1 4,2 3,3 1,3 0,4 0,5 1,6 3,6 4,5 4,4 3,3', '1,3 0,2 0,1 1,0'], 9: ['4,3 1,3 0,2 0,1 1,0 3,0 4,1 4,5 3,6 1,6'],
  '.': ['2,5.5 2,6'], ':': ['2,1.5 2,2', '2,4.5 2,5'], '-': ['1,3 3,3'], '/': ['0,6 4,0'], '%': ['0,6 4,0', '0.2,0.2 1.4,0.2 1.4,1.4 0.2,1.4 0.2,0.2', '2.6,4.6 3.8,4.6 3.8,5.8 2.6,5.8 2.6,4.6'], '+': ['2,1.5 2,4.5', '0.5,3 3.5,3'],
  '>': ['1,1 3,3 1,5'], '<': ['3,1 1,3 3,5'], '=': ['1,2 3,2', '1,4 3,4'], '?': ['0,1 1,0 3,0 4,1 4,2 2,3 2,4', '2,5.5 2,6'], '|': ['2,0 2,6'], "'": ['2,0 2,1.5'], '*': ['2,1 2,5', '0.4,2 3.6,4', '3.6,2 0.4,4'],
};
const vcache = new Map();
function vtext(str, x, y, size, anchor = 'start', ls = 1.2) {
  const key = str + '|' + x + '|' + y + '|' + size + '|' + anchor;
  let d = vcache.get(key);
  if (d !== undefined) return d;
  const u = size / 6, adv = (4 + ls) * u;
  const W = str.length * adv - ls * u;
  let x0 = anchor === 'middle' ? x - W / 2 : anchor === 'end' ? x - W : x;
  d = '';
  for (const ch of String(str).toUpperCase()) {
    const gl = VGLYPH[ch];
    if (gl) for (const pl of gl) {
      const pts = pl.split(' ').map((p) => p.split(',').map(Number));
      d += pts.map(([px, py], i) => (i ? 'L' : 'M') + (x0 + px * u).toFixed(1) + ' ' + (y + py * u).toFixed(1)).join('');
    }
    x0 += adv;
  }
  if (vcache.size > 600) vcache.clear();
  vcache.set(key, d);
  return d;
}
// a glowing vector line = wide faint stroke + thin bright one
function vline(g, col, w = 0.9) {
  const glow = svg('path', { d: '', fill: 'none', stroke: col, 'stroke-opacity': 0.16, 'stroke-width': w * 2.4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g);
  const core = svg('path', { d: '', fill: 'none', stroke: col, 'stroke-width': w, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g);
  return { glow, core, set(d) { setA(glow, 'd', d); setA(core, 'd', d); }, col(c) { setA(glow, 'stroke', c); setA(core, 'stroke', c); } };
}
const au = {
  st: (b) => O.clone(O.auroraState(uiParams(b))),
  put: (b, st, undo = false) => putSt(b, st, { undo }),
  nav(b) { const n = navOf(b); if (n.page === undefined) Object.assign(n, { page: 0 }); return n; },
};
function auroraSyncKnobs(b) {
  const st = O.auroraState(uiParams(b));
  const sn = st.edit === 'b' ? st.b : st.a;
  sn.m.forEach((v, i) => setUi(b, 'm' + (i + 1), v));
  setUi(b, 'mixk', sn.mix);
  setUi(b, 'timek', Math.log(sn.time / 80) / Math.log(2000 / 80));
}
function auroraGlide(b, target, secs) {
  const n = au.nav(b);
  clearInterval(n.glideT);
  const from = uiParams(b).morph ?? 0;
  const t0 = performance.now();
  n.gliding = target;
  n.glideT = setInterval(() => {
    const t = clamp((performance.now() - t0) / (secs * 1000), 0, 1);
    const e = t * t * (3 - 2 * t);
    setParam(b.id, 'morph', from + (target - from) * e, { silent: true });
    if (t >= 1) { clearInterval(n.glideT); n.gliding = null; markDirty(); }
  }, 30);
}
HANDLERS['tz.aurora'] = {
  param(b, p) {
    const mm = /^m([1-4])$/.exec(p);
    if (!mm && p !== 'mixk' && p !== 'timek') return;
    const st = au.st(b), ui = uiParams(b);
    const sn = st.edit === 'b' ? st.b : st.a;
    if (mm) sn.m[+mm[1] - 1] = ui[p];
    else if (p === 'mixk') sn.mix = ui.mixk;
    else sn.time = 80 * Math.pow(2000 / 80, ui.timek);
    au.put(b, st);
    au.nav(b).touch = { p, t: performance.now() };
  },
  press(b, name) {
    const n = au.nav(b), st = au.st(b);
    switch (name) {
      case 'prev': case 'next': {
        const dir = name === 'next' ? 1 : -1;
        if (n.page === 0) { st.prog = ((st.prog | 0) + dir + 6) % 6; au.put(b, st, true); return; }
        if (n.page === 1) { if (dir > 0) st.b = O.clone(st.a); else st.a = O.clone(st.b); au.put(b, st, true); flash(b, dir > 0 ? 'COPY A > B' : 'COPY B > A', 900); return auroraSyncKnobs(b); }
        st.mtime = clamp(Math.round(((st.mtime ?? 1.5) + dir * 0.25) * 100) / 100, 0.25, 8); au.put(b, st); return;
      }
      case 'edit':
        if (n.page === 2) { st.scope = ((st.scope | 0) + 1) % 3; au.put(b, st); return; }
        st.edit = st.edit === 'b' ? 'a' : 'b'; au.put(b, st); flash(b, 'EDIT ' + st.edit.toUpperCase(), 700); return auroraSyncKnobs(b);
      case 'page': n.page = ((n.page | 0) + 1) % 3; return;
      case 'ab': {
        const target = (uiParams(b).morph ?? 0) > 0.5 ? 0 : 1;
        return holdable(() => { clearInterval(n.glideT); n.gliding = null; setParam(b.id, 'morph', target); }, () => auroraGlide(b, target, st.mtime ?? 1.5), 350);
      }
      case 'fz': {
        const on = (uiParams(b)._fz ?? 0) > 0.5;
        setUi(b, '_fz', on ? 0 : 1);
        setTimeout(() => engineEvent(b, on ? 2 : 1, 600), on ? 0 : 30);
        return;
      }
    }
  },
};
const SCOPE_NAMES = ['LISSAJOUS', 'WAVE', 'POLAR'];
registerScreen('tz5-aurora', {
  build(s, g, w, h) {
    s.w = w; s.h = h;
    R(g, 0, 0, w, h, { fill: '#020604' });
    // graticule
    s.pages = [svg('g', {}, g), svg('g', {}, g), svg('g', {}, g)];
    const gr = s.pages[0];
    s.sx0 = 8; s.sx1 = 124; s.sy0 = 30; s.sy1 = 92;
    for (let i = 0; i <= 8; i++) { const x = s.sx0 + ((s.sx1 - s.sx0) * i) / 8; svg('path', { d: `M${x} ${s.sy0}V${s.sy1}`, stroke: '#1d4a32', 'stroke-width': i === 4 ? 0.5 : 0.3, 'stroke-dasharray': i === 4 ? null : '0.6 1.6' }, gr); }
    for (let i = 0; i <= 4; i++) { const y = s.sy0 + ((s.sy1 - s.sy0) * i) / 4; svg('path', { d: `M${s.sx0} ${y}H${s.sx1}`, stroke: '#1d4a32', 'stroke-width': i === 2 ? 0.5 : 0.3, 'stroke-dasharray': i === 2 ? null : '0.6 1.6' }, gr); }
    const hp = s.pages[0];
    s.vName = vline(g, '#7dffb0', 1.1);
    s.vSub = vline(g, '#7dffb0', 0.55);
    s.vEdit = vline(g, '#7dffb0', 0.6);
    s.trace = vline(hp, '#7dffb0', 0.8);
    s.trace2 = vline(hp, '#9fd8ff', 0.5);
    s.bars = [0, 1, 2, 3].map((i) => {
      const x = 134 + i * 10;
      svg('path', { d: `M${x} 34V88`, stroke: '#1d4a32', 'stroke-width': 3.2, 'stroke-linecap': 'round' }, hp);
      const bar = svg('path', { d: '', stroke: '#7dffb0', 'stroke-width': 3.2, 'stroke-linecap': 'round' }, hp);
      const ta = svg('path', { d: '', stroke: '#ffffff', 'stroke-width': 0.6 }, hp);
      const tb = svg('path', { d: '', stroke: '#ff9a6b', 'stroke-width': 0.6 }, hp);
      const lb = vline(hp, '#7dffb0', 0.5);
      lb.set(vtext(O.AURORA_MACROS[i][0], x, 91, 4.2, 'middle'));
      return { x, bar, ta, tb };
    });
    s.mBar = vline(g, '#7dffb0', 0.7);
    s.mKnob = vline(g, '#ffffff', 1.4);
    s.mLbl = vline(g, '#7dffb0', 0.55);
    s.mLbl.set(vtext('A', 8, 100, 5.4) + vtext('B', w - 12, 100, 5.4));
    // snapshot table page
    s.tbl = vline(s.pages[1], '#7dffb0', 0.55);
    s.tblHi = vline(s.pages[1], '#ff9a6b', 0.55);
    // setup page
    s.setup = vline(s.pages[2], '#7dffb0', 0.6);
    s.msg = vline(g, '#ffffff', 0.7);
    s.sig = '';
    s.lastSt = 0;
  },
  update(s, status, view, now) {
    const b = view.block, ui = s.ui, st = O.auroraState(ui), n = au.nav(b);
    const prog = O.AURORA_PROGRAMS[st.prog | 0];
    const mo = clamp(ui.morph ?? 0, 0, 1);
    const mm = O.auroraMacros(st, mo);
    const col = prog.col;
    const bypass = b.bypass;
    const msgOn = n.msg && now < n.msgT;
    if (ui._st !== s.lastSt && !(n.touch && now - n.touch.t < 400)) auroraSyncKnobs(b);
    s.lastSt = ui._st;
    const sig = [ui._st, n.page, mo.toFixed(3), msgOn ? n.msg : '', bypass ? 1 : 0, (ui._fz ?? 0) > 0.5 ? 1 : 0].join('|');
    if (sig !== s.sig) {
      s.sig = sig;
      for (const l of [s.vName, s.vSub, s.vEdit, s.trace, s.mBar, s.mLbl, s.tbl, s.setup]) l.col(bypass ? '#2f6b4a' : col);
      s.pages.forEach((p, i) => show(p, i === (n.page | 0)));
      s.vName.set(vtext('P' + ((st.prog | 0) + 1) + ' ' + prog.name, 8, 8, 9.5));
      s.vSub.set(vtext(prog.sub + ((ui._fz ?? 0) > 0.5 ? '  * FROZEN' : ''), 8, 21, 4.4));
      s.vEdit.set(vtext('EDIT ' + (st.edit === 'b' ? 'B' : 'A'), s.w - 6, 8, 5.2, 'end') + (n.page ? vtext(['', 'SNAP', 'SETUP'][n.page | 0], s.w - 6, 18, 4, 'end') : ''));
      // morph bar
      const x0 = 18, x1 = s.w - 18, mx = x0 + (x1 - x0) * mo;
      s.mBar.set(`M${x0} 103H${x1}` + [0, 0.25, 0.5, 0.75, 1].map((t) => `M${x0 + (x1 - x0) * t} 101V105`).join(''));
      s.mKnob.set(`M${mx - 2.5} 103L${mx} 99.5L${mx + 2.5} 103L${mx} 106.5Z`);
      if ((n.page | 0) === 0) {
        s.bars.forEach((bb, i) => {
          const y = (v) => 88 - 54 * v;
          setA(bb.bar, 'd', `M${bb.x} 88V${y(mm.m[i]).toFixed(1)}`);
          setA(bb.bar, 'stroke', bypass ? '#2f6b4a' : col);
          setA(bb.ta, 'd', `M${bb.x - 3.4} ${y(st.a.m[i]).toFixed(1)}h1.6`);
          setA(bb.tb, 'd', `M${bb.x + 1.8} ${y(st.b.m[i]).toFixed(1)}h1.6`);
        });
      } else if ((n.page | 0) === 1) {
        const rows = [...O.AURORA_MACROS.map((l, i) => [l, st.a.m[i], st.b.m[i]]), ['MIX', st.a.mix, st.b.mix], ['TIME', st.a.time, st.b.time], ['FDBK', st.a.fb, st.b.fb]];
        let d = vtext('SNAPSHOTS', 8, 30, 5.4) + vtext('A', 104, 30, 5.4, 'middle') + vtext('B', 146, 30, 5.4, 'middle');
        rows.forEach((r, i) => {
          const y = 40 + i * 7.6;
          const f = (v) => (r[0] === 'TIME' ? Math.round(v) + 'MS' : Math.round(v * 100) + '%');
          d += vtext(r[0], 8, y, 4.4) + vtext(f(r[1]), 104, y, 4.4, 'middle') + vtext(f(r[2]), 146, y, 4.4, 'middle');
        });
        d += vtext('< COPY B>A   COPY A>B >', s.w / 2, 92, 3.8, 'middle');
        s.tbl.set(d);
        s.tblHi.set(vtext(st.edit === 'b' ? '*' : '', 158, 30, 5.4) + vtext(st.edit === 'b' ? '' : '*', 116, 30, 5.4));
      } else {
        let d = vtext('SETUP', 8, 30, 5.4);
        d += vtext('GLIDE TIME', 8, 44, 4.6) + vtext('< ' + (st.mtime ?? 1.5).toFixed(2) + ' S >', s.w - 8, 44, 4.6, 'end');
        d += vtext('SCOPE', 8, 56, 4.6) + vtext('EDIT: ' + SCOPE_NAMES[st.scope | 0], s.w - 8, 56, 4.6, 'end');
        d += vtext('HOLD A/B = GLIDE', 8, 70, 4) + vtext('TAP A/B = JUMP', 8, 78, 4) + vtext('EXP JACK = MORPH', 8, 86, 4);
        s.setup.set(d);
      }
      s.msg.set(msgOn ? vtext(n.msg, s.w / 2, 56, 7, 'middle') : '');
      if (msgOn) s.trace.set('');
    }
    if (msgOn !== s.msgShown) { s.msgShown = msgOn; if (!msgOn) s.sig = ''; }
    // live trace (every frame on the home page)
    if ((n.page | 0) === 0 && !msgOn) {
      const [space, motion, pitch, tex] = mm.m;
      const ratios = [[1, 2], [3, 2], [1, 1], [5, 4], [2, 3], [3, 5]][st.prog | 0];
      const cx = (s.sx0 + s.sx1) / 2, cy = (s.sy0 + s.sy1) / 2;
      const ax = ((s.sx1 - s.sx0) / 2 - 3) * (0.35 + 0.65 * space), ay = ((s.sy1 - s.sy0) / 2 - 3) * (0.35 + 0.65 * mm.mix);
      const ph = now * 0.0006 * (0.2 + 2.5 * motion) + mo * Math.PI;
      const jit = tex * 0.08;
      const mode = st.scope | 0;
      let d = '', d2 = '';
      const N = 110;
      for (let i = 0; i <= N; i++) {
        const t = (i / N) * Math.PI * 2;
        let x, y;
        if (mode === 0) { x = Math.sin(ratios[0] * t + ph); y = Math.sin(ratios[1] * t + pitch * 1.4); }
        else if (mode === 1) { x = (i / N) * 2 - 1; y = Math.sin(t * (2 + ratios[0]) + ph * 3) * (0.6 + 0.4 * Math.sin(t * ratios[1] + mo * 3)); }
        else { const r = 0.55 + 0.4 * Math.sin(t * (ratios[0] + ratios[1]) + ph * 2) * (0.4 + pitch * 0.6); x = r * Math.cos(t); y = r * Math.sin(t); }
        if (jit) { x += Math.sin(i * 12.9898 + now * 0.01) * jit; y += Math.cos(i * 78.233 + now * 0.013) * jit; }
        d += (i ? 'L' : 'M') + (cx + x * ax).toFixed(1) + ' ' + (cy - y * ay).toFixed(1);
        if (pitch > 0.05 && i % 2 === 0) d2 += (i ? 'L' : 'M') + (cx + Math.sin(ratios[0] * 2 * t + ph * 1.3) * ax * 0.5).toFixed(1) + ' ' + (cy - Math.sin(ratios[1] * 2 * t) * ay * 0.5).toFixed(1);
      }
      s.trace.set(b.bypass ? `M${s.sx0} ${cy}H${s.sx1}` : d);
      s.trace2.set(b.bypass ? '' : d2);
    } else s.trace2.set('');
  },
  pointer(s, view, type, pt, e) {
    const b = view.block, n = au.nav(b);
    if (type === 'wheel') return HANDLERS['tz.aurora'].press(b, e.deltaY < 0 ? 'prev' : 'next');
    if ((type === 'down' || type === 'move') && pt.y > 94) {
      const mo = clamp((pt.x - 18) / (s.w - 36), 0, 1);
      clearInterval(n.glideT);
      setParam(b.id, 'morph', mo, { silent: type === 'move' });
      return;
    }
    if (type === 'down' && pt.y < 26) {
      if (pt.x > s.w - 40) return HANDLERS['tz.aurora'].press(b, 'edit');
      return HANDLERS['tz.aurora'].press(b, 'next');
    }
    if (type === 'down') HANDLERS['tz.aurora'].press(b, 'page');
  },
});

// ================================================================== PIXEL QUEST (dot-matrix game screen)
const PF3 = {
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111', F: '111100110100100', G: '011100101101011',
  H: '101101111101101', I: '111010010010111', J: '001001001101010', K: '101101110101101', L: '100100100100111', M: '101111111101101', N: '110101101101101',
  O: '010101101101010', P: '110101110100100', Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010', U: '101101101101111',
  V: '101101101101010', W: '101101111111101', X: '101101010101101', Y: '101101010010010', Z: '111001010100111',
  0: '111101101101111', 1: '010110010010111', 2: '110001010100111', 3: '110001010001110', 4: '101101111001001', 5: '111100110001110', 6: '011100111101111',
  7: '111001010010010', 8: '111101111101111', 9: '111101111001110', '-': '000000111000000', '.': '000000000000010', ':': '000010000010000', '!': '010010010000010',
  '?': '110001010000010', '/': '001001010100100', '>': '100010001010100', '<': '001010100010001', '+': '000010111010000', '*': '000101010101000', '&': '000101111010000',
  '=': '000111000111000', '%': '101001010100101', "'": '010010000000000', '#': '010111010111010',
};
const pcacheT = new Map();
function ptext(str, x, y, px = 1, anchor = 'start') {
  const key = str + '|' + x + '|' + y + '|' + px + '|' + anchor;
  let d = pcacheT.get(key);
  if (d !== undefined) return d;
  str = String(str).toUpperCase();
  const W = str.length * 4 * px - px;
  let x0 = anchor === 'middle' ? Math.round(x - W / 2) : anchor === 'end' ? x - W : x;
  d = '';
  for (const ch of str) {
    const gl = PF3[ch];
    if (gl) for (let r = 0; r < 5; r++) {
      // merge horizontal runs into one rect per row
      let c = 0;
      while (c < 3) {
        if (gl[r * 3 + c] === '1') { let e = c; while (e + 1 < 3 && gl[r * 3 + e + 1] === '1') e++; d += `M${x0 + c * px} ${y + r * px}h${(e - c + 1) * px}v${px}h${-(e - c + 1) * px}z`; c = e + 1; } else c++;
      }
    }
    x0 += 4 * px;
  }
  if (pcacheT.size > 600) pcacheT.clear();
  pcacheT.set(key, d);
  return d;
}
const SPR = {
  KNIGHT: ['..b..b..', '.aaaaaa.', '.abwwba.', '.aaaaaa.', '..bbbb..', '.aaaaaa.', '.a.aa.a.', '..a..a..'],
  NINJA: ['........', '.bbbbbb.', '.bwbbwb.', '.aaaaaaa', '.bbbbbb.', '..bbbb..', '.b.bb.b.', '.b....b.'],
  WIZARD: ['...a....', '..aaa...', '.aaaaa..', 'aaaaaaa.', '.bwbwb..', '.bbbbb..', '..bbb...', '.b...b..'],
  GOLEM: ['.bbbbbb.', 'baaaaaab', 'bawaawab', 'baaaaaab', 'bbaaaabb', 'baaaaaab', '.aa..aa.', 'bb....bb'],
  GHOST: ['..aaaa..', '.aaaaaa.', 'awwaawwa', 'abwaabwa', 'aaaaaaaa', 'aaaaaaaa', 'aaaaaaaa', 'a.aa.aa.'],
  ROBOT: ['...b....', '..aaaa..', '.awbbwa.', '.aaaaaa.', '.abbbba.', 'aaaaaaaa', '.a.aa.a.', '.bb..bb.'],
  KITTY: ['a......a', 'aa....aa', 'aaaaaaaa', 'awbaawba', 'aaawwaaa', 'aaaaaaaa', '.aaaaaa.', '..a..a..'],
  SLIME: ['........', '...aa...', '..aaaa..', '.awaawa.', '.abaaba.', 'aaaaaaaa', 'aaaaaaaa', '.bbbbbb.'],
};
function spritePaths(name, x, y, px) {
  const rows = SPR[name] || SPR.KNIGHT;
  const out = { a: '', b: '', w: '' };
  rows.forEach((r, j) => { for (let i = 0; i < 8; i++) { const c = r[i]; if (out[c] !== undefined) out[c] += `M${x + i * px} ${y + j * px}h${px}v${px}h${-px}z`; } });
  return out;
}
function makeSprite(g) {
  const a = svg('path', { d: '', fill: '#fff' }, g), b2 = svg('path', { d: '', fill: '#000' }, g), wt = svg('path', { d: '', fill: '#fff1e8' }, g);
  return {
    set(name, x, y, px, col, dark) { const p = spritePaths(name, x, y, px); setA(a, 'd', p.a); setA(b2, 'd', p.b); setA(wt, 'd', p.w); setA(a, 'fill', col); setA(b2, 'fill', dark); },
    hide() { setA(a, 'd', ''); setA(b2, 'd', ''); setA(wt, 'd', ''); },
  };
}
const PAL = { bg: '#1d2b53', ink: '#000000', white: '#fff1e8', yellow: '#ffec27', red: '#ff004d', green: '#00e436', blue: '#29adff', grey: '#83769c', pink: '#ff77a8', peach: '#ffccaa', orange: '#ffa300', dpurple: '#7e2553', dgreen: '#008751' };
const darken = (hex) => { const n = parseInt(hex.slice(1), 16); const f = (v) => Math.round(v * 0.55); return '#' + [f(n >> 16), f((n >> 8) & 255), f(n & 255)].map((v) => v.toString(16).padStart(2, '0')).join(''); };
const PAUSE_ITEMS = ['RESUME', 'CHARACTERS', 'WORLD MAP', 'OPTIONS', 'TITLE SCREEN'];
const OPT_ROWS = [['SYNTH MIX', 'mix', 0, 1, 0.1], ['TONE', 'tone', 0, 1, 0.1], ['SPEED', 'speed', 0, 1, 0.1], ['VOLUME', 'vol', -18, 12, 3]];
const LV_POS = [[18, 70], [44, 52], [70, 72], [96, 50], [122, 68], [144, 44]];
const pq = {
  st: (b) => O.clone(O.pqState(uiParams(b))),
  put: (b, st, undo = false) => putSt(b, st, { undo }),
  nav(b) { const n = navOf(b); if (!n.page) Object.assign(n, { page: 'title', cc: 0, lc: 0, pi: 0, oi: 0, coins: 0 }); return n; },
};
HANDLERS['tz.pixelquest'] = {
  press(b, name) {
    const n = pq.nav(b), st = pq.st(b);
    const dir = name === 'up' || name === 'left' ? -1 : 1;
    if (name === 'lvprev' || name === 'lvnext') {
      st.lv = ((st.lv | 0) + (name === 'lvnext' ? 1 : -1) + O.PQ_LEVELS.length) % O.PQ_LEVELS.length;
      pq.put(b, st, true);
      n.lc = st.lv;
      flash(b, 'WARP ' + O.PQ_LEVELS[st.lv].name.slice(0, 3), 900);
      if (n.page === 'title') n.page = 'game';
      return;
    }
    if (name === 'pw') return momentary(() => setUi(b, '_power', 1), () => setUi(b, '_power', 0));
    switch (n.page) {
      case 'title':
        if (name === 'start' || name === 'a') { n.page = 'chars'; n.cc = st.ch | 0; }
        return;
      case 'chars':
        if (name === 'left' || name === 'right') n.cc = (n.cc + dir + 8) % 8;
        else if (name === 'up' || name === 'down') n.cc = (n.cc + 4) % 8;
        else if (name === 'a' || name === 'start') { st.ch = n.cc; pq.put(b, st, true); n.page = 'levels'; n.lc = st.lv | 0; flash(b, O.PQ_CHARS[n.cc].name + ' JOINS!', 900); }
        else if (name === 'b') n.page = 'title';
        return;
      case 'levels':
        if (name === 'left' || name === 'right' || name === 'up' || name === 'down') n.lc = (n.lc + dir + O.PQ_LEVELS.length) % O.PQ_LEVELS.length;
        else if (name === 'a' || name === 'start') { st.lv = n.lc; pq.put(b, st, true); n.page = 'game'; }
        else if (name === 'b') n.page = 'chars';
        return;
      case 'game':
        if (name === 'start') { n.page = 'pause'; n.pi = 0; }
        else if (name === 'select') { n.page = 'levels'; n.lc = st.lv | 0; }
        else if (name === 'a') n.jumpT = performance.now();
        else if (name === 'left' || name === 'right') { st.ch = ((st.ch | 0) + dir + 8) % 8; pq.put(b, st, true); }
        return;
      case 'pause':
        if (name === 'up' || name === 'down') n.pi = (n.pi + dir + PAUSE_ITEMS.length) % PAUSE_ITEMS.length;
        else if (name === 'a') n.page = ['game', 'chars', 'levels', 'options', 'title'][n.pi];
        else if (name === 'b' || name === 'start') n.page = 'game';
        if (n.page === 'chars') n.cc = st.ch | 0;
        if (n.page === 'levels') n.lc = st.lv | 0;
        return;
      case 'options': {
        if (name === 'up' || name === 'down') { n.oi = (n.oi + dir + OPT_ROWS.length) % OPT_ROWS.length; return; }
        if (name === 'left' || name === 'right') {
          const [, p, mn, mx, step] = OPT_ROWS[n.oi];
          const ui = uiParams(b);
          setParam(b.id, p, clamp(Math.round(((ui[p] ?? 0) + dir * step) / step) * step, mn, mx));
          return;
        }
        if (name === 'b' || name === 'start' || name === 'a') n.page = 'pause';
      }
    }
  },
};
registerScreen('tz5-pixel', {
  build(s, g, w, h) {
    s.w = w; s.h = h;
    s.bg = R(g, 0, 0, w, h, { fill: PAL.bg });
    s.stars = svg('path', { d: '', fill: PAL.white }, g);
    let sd = '';
    for (let i = 0; i < 26; i++) { const x = (i * 53) % w, y = (i * 37) % 70; sd += `M${x} ${y}h1v1h-1z`; }
    setA(s.stars, 'd', sd);
    s.pages = {};
    const page = (k) => (s.pages[k] = svg('g', {}, g));
    // title
    const tp = page('title');
    s.tTitle = svg('path', { d: ptext('PIXEL', w / 2, 18, 4, 'middle') + ptext('QUEST', w / 2, 42, 4, 'middle'), fill: PAL.yellow }, tp);
    s.tShadow = svg('path', { d: ptext('PIXEL', w / 2 + 2, 20, 4, 'middle') + ptext('QUEST', w / 2 + 2, 44, 4, 'middle'), fill: PAL.red }, tp);
    tp.insertBefore(s.tShadow, s.tTitle);
    s.tPress = svg('path', { d: ptext('PRESS START', w / 2, 74, 1.5, 'middle'), fill: PAL.white }, tp);
    s.tParade = ['KNIGHT', 'WIZARD', 'KITTY', 'SLIME'].map(() => makeSprite(tp));
    svg('path', { d: ptext('TONE ZONE 2026', w / 2, 112, 1, 'middle'), fill: PAL.grey }, tp);
    // character select
    const cp = page('chars');
    svg('path', { d: ptext('SELECT CHARACTER', w / 2, 4, 1.5, 'middle'), fill: PAL.white }, cp);
    s.cCards = O.PQ_CHARS.map((c, i) => {
      const x = 6 + (i % 4) * 38, y = 16 + Math.floor(i / 4) * 42;
      const box = R(cp, x, y, 34, 38, { fill: PAL.ink, 'fill-opacity': 0.35, stroke: PAL.grey, 'stroke-width': 1 });
      const spr = makeSprite(cp);
      spr.set(Object.keys(SPR)[i], x + 5, y + 4, 3, c.col, darken(c.col));
      svg('path', { d: ptext(c.name, x + 17, y + 30, 1, 'middle'), fill: PAL.white }, cp);
      return { box };
    });
    s.cInfo = svg('path', { d: '', fill: PAL.yellow }, cp);
    s.cStats = svg('path', { d: '', fill: PAL.green }, cp);
    // level map
    const lp = page('levels');
    svg('path', { d: ptext('WORLD MAP', w / 2, 4, 1.5, 'middle'), fill: PAL.white }, lp);
    let path = '';
    LV_POS.forEach(([x, y], i) => { if (i) { const [px, py] = LV_POS[i - 1]; path += `M${px} ${py}L${x} ${y}`; } });
    svg('path', { d: path, stroke: PAL.peach, 'stroke-width': 2, 'stroke-dasharray': '2 2', fill: 'none' }, lp);
    s.lNodes = LV_POS.map(([x, y], i) => R(lp, x - 5, y - 5, 10, 10, { fill: O.PQ_LEVELS[i].col, stroke: PAL.ink, 'stroke-width': 1 }));
    LV_POS.forEach(([x, y], i) => svg('path', { d: ptext(O.PQ_LEVELS[i].name.slice(0, 3), x, y + 8, 1, 'middle'), fill: PAL.white }, lp));
    s.lHero = makeSprite(lp);
    s.lBox = R(lp, 4, 92, w - 8, 24, { fill: PAL.ink, 'fill-opacity': 0.6, stroke: PAL.white, 'stroke-width': 1 });
    s.lName = svg('path', { d: '', fill: PAL.yellow }, lp);
    s.lFx = svg('path', { d: '', fill: PAL.white }, lp);
    // game
    const gp = page('game');
    s.gSky = R(gp, 0, 12, w, 78, { fill: PAL.blue });
    s.gHills = svg('path', { d: '', fill: PAL.dgreen }, gp);
    s.gGround = svg('path', { d: '', fill: PAL.orange }, gp);
    s.gGround2 = svg('path', { d: '', fill: '#ab5236' }, gp);
    s.gCoins = svg('path', { d: '', fill: PAL.yellow }, gp);
    s.gHero = makeSprite(gp);
    s.gStars = svg('path', { d: '', fill: PAL.yellow }, gp);
    R(gp, 0, 0, w, 12, { fill: PAL.ink });
    s.gHud = svg('path', { d: '', fill: PAL.white }, gp);
    s.gHudCoin = svg('path', { d: '', fill: PAL.yellow }, gp);
    R(gp, 0, 104, w, 16, { fill: PAL.ink });
    s.gHearts = svg('path', { d: '', fill: PAL.red }, gp);
    s.gBottom = svg('path', { d: '', fill: PAL.white }, gp);
    // pause / options overlay
    const pp = page('pause');
    R(pp, 30, 26, 100, 70, { fill: PAL.ink, stroke: PAL.white, 'stroke-width': 1.5 });
    svg('path', { d: ptext('PAUSED', 80, 32, 2, 'middle'), fill: PAL.yellow }, pp);
    s.pItems = svg('path', { d: PAUSE_ITEMS.map((t, i) => ptext(t, 48, 50 + i * 9, 1)).join(''), fill: PAL.white }, pp);
    s.pCur = svg('path', { d: '', fill: PAL.red }, pp);
    const op = page('options');
    R(op, 10, 22, 140, 80, { fill: PAL.ink, stroke: PAL.white, 'stroke-width': 1.5 });
    svg('path', { d: ptext('OPTIONS', 80, 28, 2, 'middle'), fill: PAL.yellow }, op);
    s.oText = svg('path', { d: '', fill: PAL.white }, op);
    s.oBars = svg('path', { d: '', fill: PAL.green }, op);
    s.oCur = svg('path', { d: '', fill: PAL.red }, op);
    // message banner
    s.mBox = R(g, 10, 50, w - 20, 16, { fill: PAL.ink, stroke: PAL.yellow, 'stroke-width': 1 });
    s.mTxt = svg('path', { d: '', fill: PAL.yellow }, g);
    s.sig = '';
    s.scroll = 0; s.lvl = 0; s.jump = 0;
  },
  update(s, status, view, now) {
    const b = view.block, ui = s.ui, st = O.pqState(ui), n = pq.nav(b), w = s.w;
    const ch = O.PQ_CHARS[st.ch | 0], L = O.PQ_LEVELS[st.lv | 0];
    const blink = Math.floor(now / 400) % 2 === 0;
    const msgOn = n.msg && now < n.msgT;
    const page = n.page === 'pause' || n.page === 'options' ? n.page : n.page;
    const sig = [ui._st, n.page, n.cc, n.lc, n.pi, n.oi, blink ? 1 : 0, msgOn ? n.msg : '', ui.mix, ui.tone, ui.speed, ui.vol, b.bypass ? 1 : 0].join('|');
    const powered = (ui._power ?? 0) > 0.5;
    if (sig !== s.sig) {
      s.sig = sig;
      for (const k in s.pages) show(s.pages[k], k === page || (k === 'game' && (page === 'pause' || page === 'options')));
      setA(s.bg, 'fill', b.bypass ? '#0b0f1c' : PAL.bg);
      show(s.stars, page !== 'game' && page !== 'pause' && page !== 'options');
      if (page === 'title') {
        setA(s.tPress, 'fill', blink ? PAL.white : PAL.bg);
        ['KNIGHT', 'WIZARD', 'KITTY', 'SLIME'].forEach((k, i) => { const c = O.PQ_CHARS.find((x) => x.name === k); s.tParade[i].set(k, 32 + i * 26, 88, 2, c.col, darken(c.col)); });
      } else if (page === 'chars') {
        s.cCards.forEach((c, i) => { setA(c.box, 'stroke', i === n.cc ? (blink ? PAL.yellow : PAL.orange) : PAL.grey); setA(c.box, 'stroke-width', i === n.cc ? 2 : 1); });
        const c = O.PQ_CHARS[n.cc];
        setA(s.cInfo, 'd', ptext(c.name + ' - ' + c.voice, w2(s), 103, 1, 'middle'));
        setA(s.cStats, 'd', ['PWR', 'MAG', 'SPD'].map((l, i) => ptext(l + ' ' + '#'.repeat(c.stats[i]), 8 + i * 52, 112, 1)).join(''));
      } else if (page === 'levels') {
        s.lNodes.forEach((r, i) => setA(r, 'stroke', i === n.lc ? (blink ? PAL.white : PAL.yellow) : PAL.ink));
        const [x, y] = LV_POS[n.lc];
        s.lHero.set(ch.name, x - 6, y - 19, 1.5, ch.col, darken(ch.col));
        const lv = O.PQ_LEVELS[n.lc];
        setA(s.lName, 'd', ptext('WORLD ' + lv.name, 9, 96, 1.5));
        setA(s.lFx, 'd', ptext('FX: ' + lv.fx + (n.lc === (st.lv | 0) ? '  *NOW' : ''), 9, 107, 1));
      }
      if (page === 'game' || page === 'pause' || page === 'options') {
        setA(s.gSky, 'fill', L.col === '#e9e3ff' ? '#c2c3c7' : L.col === '#2fd1c4' ? '#1d4a7a' : L.col === '#ff5a2a' ? '#2a1a3a' : L.col === '#5ec8ff' ? '#14203a' : PAL.blue);
        setA(s.gHud, 'd', ptext(ch.name, 14, 3.5, 1) + ptext('W' + L.name.slice(0, 3), 80, 3.5, 1, 'middle'));
        const vol = ui.vol ?? 0;
        const hearts = clamp(Math.round(((vol + 18) / 30) * 5), 0, 5);
        setA(s.gHearts, 'd', ptext('&'.repeat(hearts), 6, 108, 1.5) + ptext('-'.repeat(5 - hearts), 6 + hearts * 6, 108, 1.5));
        setA(s.gBottom, 'd', ptext('MIX ' + Math.round((ui.mix ?? 0.7) * 100) + '%', w - 6, 106, 1, 'end') + ptext(L.fx, w - 6, 113, 1, 'end'));
      }
      if (page === 'pause') setA(s.pCur, 'd', ptext('>', 42, 50 + n.pi * 9, 1));
      if (page === 'options') {
        let t = '', bars = '';
        OPT_ROWS.forEach(([l, p, mn, mx], i) => {
          const y = 42 + i * 13;
          t += ptext(l, 22, y, 1);
          const v = clamp(((ui[p] ?? 0) - mn) / (mx - mn), 0, 1);
          for (let k = 0; k < 10; k++) bars += `M${82 + k * 6} ${y - 1}h4v${k < Math.round(v * 10) ? 7 : 1}h-4z`;
        });
        setA(s.oText, 'd', t + ptext('LEFT/RIGHT CHANGE  B BACK', 80, 94, 1, 'middle'));
        setA(s.oBars, 'd', bars);
        setA(s.oCur, 'd', ptext('>', 16, 42 + n.oi * 13, 1));
      }
      show(s.mBox, msgOn); setA(s.mTxt, 'd', msgOn ? ptext(n.msg, w2(s), 55, 1.5, 'middle') : '');
    }
    if (msgOn !== s.msgShown) { s.msgShown = msgOn; if (!msgOn) s.sig = ''; }
    // game animation: scroll speed + jumps follow the output level
    if (page === 'game' && !msgOn) {
      const m = status && status.mt && status.mt.meter;
      const pk = m && m[0] ? m[0][0] : 0;
      const lvl = clamp((20 * Math.log10(Math.max(1e-5, pk)) + 48) / 42, 0, 1);
      if (lvl > s.lvl + 0.18 && lvl > 0.35 && now - (s.lastNote || 0) > 160) { s.lastNote = now; n.jumpT = now; n.coins = ((n.coins || 0) + 1) % 1000; }
      s.lvl = lvl * 0.3 + s.lvl * 0.7;
      s.scroll = (s.scroll + 0.4 + 3 * s.lvl * (0.5 + (ui.speed ?? 0.5))) % 16;
      const sc = s.scroll;
      let gd = '', gd2 = '', hill = '';
      for (let x = -16; x < s.w + 16; x += 16) { gd += `M${x - sc} 90h15v4h-15z`; gd2 += `M${x - sc} 94h16v10h-16z M${x - sc + 4} 97h3v2h-3z`; }
      for (let x = -40; x < s.w + 40; x += 40) { const hx = x - ((sc * 0.4 + now * 0.004) % 40); hill += `M${hx} 90v-12h8v-6h8v-4h8v4h8v6h8v12z`; }
      setA(s.gGround, 'd', gd); setA(s.gGround2, 'd', gd2); setA(s.gHills, 'd', hill);
      const jt = (now - (n.jumpT || 0)) / 380;
      const jy = jt < 1 ? Math.sin(jt * Math.PI) * 18 : 0;
      const flick = powered && Math.floor(now / 80) % 2;
      s.gHero.set(ch.name, 34, 66 - jy, 3, flick ? PAL.yellow : ch.col, darken(ch.col));
      let cd = '';
      for (let i = 0; i < 4; i++) { const cx = ((i * 41 - sc * 3 - now * 0.02) % (s.w + 20) + s.w + 20) % (s.w + 20) - 10; cd += `M${cx} 46h3v1h1v4h-1v1h-3v-1h-1v-4h1z`; }
      setA(s.gCoins, 'd', cd);
      setA(s.gHudCoin, 'd', ptext('*' + String(n.coins || 0).padStart(3, '0'), s.w - 6, 3.5, 1, 'end'));
      let sp = '';
      if (powered) for (let i = 0; i < 8; i++) { const a = now * 0.008 + i * 0.785; sp += `M${46 + Math.cos(a) * 20} ${76 - jy + Math.sin(a) * 18}h2v2h-2z`; }
      setA(s.gStars, 'd', sp);
    }
  },
  pointer(s, view, type, pt) {
    if (type !== 'down') return;
    const b = view.block, n = pq.nav(b);
    const press = (k) => HANDLERS['tz.pixelquest'].press(b, k);
    if (n.page === 'title') return press('start');
    if (n.page === 'chars') {
      const c = Math.floor((pt.x - 6) / 38), r = Math.floor((pt.y - 16) / 42);
      if (c >= 0 && c < 4 && r >= 0 && r < 2) { const i = r * 4 + c; if (i === n.cc) press('a'); else n.cc = i; }
      return;
    }
    if (n.page === 'levels') {
      const i = LV_POS.findIndex(([x, y]) => Math.abs(pt.x - x) < 9 && Math.abs(pt.y - y) < 9);
      if (i >= 0) { if (i === n.lc) press('a'); else n.lc = i; }
      return;
    }
    if (n.page === 'game') return press(pt.y < 14 ? 'start' : 'a');
    if (n.page === 'pause') {
      const i = Math.floor((pt.y - 48) / 9);
      if (i >= 0 && i < PAUSE_ITEMS.length && pt.x > 30 && pt.x < 130) { n.pi = i; press('a'); }
      return;
    }
    if (n.page === 'options') {
      const i = Math.floor((pt.y - 38) / 13);
      if (i >= 0 && i < OPT_ROWS.length) { n.oi = i; press(pt.x < 110 ? 'left' : 'right'); }
    }
  },
});
const w2 = (s) => s.w / 2;

// ================================================================== LOW FOUNDRY (VU meter + 14-segment display)
const SEG14 = {
  a: 'M1.2 0.4H8.8L8 1.6H2Z', d: 'M1.2 17.6H8.8L8 16.4H2Z', f: 'M0.4 1.2L1.6 2V8.2L0.4 8.8Z', b: 'M9.6 1.2L8.4 2V8.2L9.6 8.8Z',
  e: 'M0.4 9.2L1.6 9.8V16L0.4 16.8Z', c: 'M9.6 9.2L8.4 9.8V16L9.6 16.8Z', g1: 'M1 9L2 8.3H4.6V9.7H2Z', g2: 'M9 9L8 8.3H5.4V9.7H8Z',
  i: 'M4.3 2H5.7V8L5 8.5L4.3 8Z', l: 'M4.3 16H5.7V10L5 9.5L4.3 10Z', h: 'M2 2H2.9L4.2 6.6V8H3.7L2 3.5Z', j: 'M8 2H7.1L5.8 6.6V8H6.3L8 3.5Z',
  k: 'M2 16H2.9L4.2 11.4V10H3.7L2 14.5Z', m: 'M8 16H7.1L5.8 11.4V10H6.3L8 14.5Z', dp: 'M10.3 16.4h1.2v1.2h-1.2Z',
};
const S14 = {
  0: 'abcdefjk', 1: 'bcj', 2: 'abdeg1g2', 3: 'abcdg2', 4: 'bcfg1g2', 5: 'acdfg1g2', 6: 'acdefg1g2', 7: 'abc', 8: 'abcdefg1g2', 9: 'abcdfg1g2',
  A: 'abcefg1g2', B: 'abcdg2il', C: 'adef', D: 'abcdil', E: 'adefg1', F: 'aefg1', G: 'acdefg2', H: 'bcefg1g2', I: 'adil', J: 'bcde', K: 'efg1jm', L: 'def',
  M: 'bcefhj', N: 'bcefhm', O: 'abcdef', P: 'abefg1g2', Q: 'abcdefm', R: 'abefg1g2m', S: 'acdfg1g2', T: 'ail', U: 'bcdef', V: 'efjk', W: 'bcefkm', X: 'hjkm',
  Y: 'hjl', Z: 'adjk', '-': 'g1g2', '+': 'g1g2il', '/': 'jk', '*': 'g1g2hijklm', '<': 'jm', '>': 'hk', '_': 'd', '=': 'dg1g2', "'": 'i', '#': 'bcdg1g2il',
};
const segList = (ch) => {
  const s = S14[ch] || '';
  const out = new Set();
  for (const k of ['g1', 'g2']) if (s.includes(k)) out.add(k);
  for (const c of s.replace(/g[12]/g, '')) out.add(c);
  return out;
};
const lf = {
  st: (b) => O.clone(O.lfState(uiParams(b))),
  put: (b, st, undo = false) => putSt(b, st, { undo, chainFn: O.lfChain }),
  nav(b) { const n = navOf(b); if (!n.page) n.page = 'prog'; return n; },
};
const LF_PAGES = ['prog', 'amp', 'cab'];
const LF_KNOBS = { gain: 'GAIN', comp: 'COMP', drive: 'DRIV', blend: 'BLND', bass: 'BASS', lomid: 'LMID', himid: 'HMID', treble: 'TREB', dimix: 'DI-A', level: 'MSTR' };
HANDLERS['tz.foundry'] = {
  param(b, p) {
    if (!LF_KNOBS[p]) return;
    lf.nav(b).touch = { p, t: performance.now() };
  },
  press(b, name) {
    const n = lf.nav(b), st = lf.st(b);
    const tunerOn = (uiParams(b)._tuner ?? 0) > 0.5;
    switch (name) {
      case 'mode':
        if (tunerOn) { setUi(b, '_tuner', 0); n.page = 'prog'; return; }
        n.page = LF_PAGES[(LF_PAGES.indexOf(n.page) + 1) % LF_PAGES.length];
        return;
      case 'left': case 'right': {
        const dir = name === 'right' ? 1 : -1;
        if (n.page === 'prog') st.prog = ((st.prog | 0) + dir + O.LF_PROGS.length) % O.LF_PROGS.length;
        else if (n.page === 'amp') st.amp = ((st.amp | 0) + dir + O.LF_AMPS.length) % O.LF_AMPS.length;
        else if (n.page === 'cab') st.cab = st.cab ? 0 : 1;
        else return;
        lf.put(b, st, true);
        return;
      }
      case 'store':
        st.mem = st.mem || {};
        st.mem[st.chan | 0] = { prog: st.prog, amp: st.amp, cab: st.cab };
        lf.put(b, st, true);
        return flash(b, 'STORED ' + ((st.chan | 0) ? 'B' : 'A'), 1000);
      case 'chan': {
        st.chan = (st.chan | 0) ? 0 : 1;
        const m = st.mem && st.mem[st.chan];
        if (m) Object.assign(st, m);
        lf.put(b, st, true);
        return flash(b, 'CHAN ' + (st.chan ? 'B' : 'A'), 700);
      }
      case 'tuner':
        setUi(b, '_tuner', tunerOn ? 0 : 1);
        n.page = tunerOn ? 'prog' : 'tuner';
        return;
    }
  },
};
function lfText(b, st, n, ui, status, now) {
  if (n.msg && now < n.msgT) return n.msg;
  if ((ui._tuner ?? 0) > 0.5) {
    const tu = status && status.tu && status.tu.tuner;
    if (!tu || !tu.note) return 'TUNE  --';
    const c = Math.round(tu.cents || 0);
    return (tu.note + ' ').slice(0, 2) + '   ' + (c >= 0 ? '+' : '-') + String(Math.abs(c)).padStart(2, '0');
  }
  if (n.touch && now - n.touch.t < 1400) {
    const p = n.touch.p, v = ui[p] ?? 0;
    const val = p === 'level' ? (v >= 0 ? '+' : '-') + Math.abs(Math.round(v)).toString().padStart(2, ' ') : (v * 10).toFixed(1);
    return (LF_KNOBS[p] + ' ' + val).padEnd(8).slice(0, 9);
  }
  const ch = (st.chan | 0) ? 'B' : 'A';
  if (n.page === 'amp') return 'AMP  ' + O.LF_AMPS[st.amp | 0].name;
  if (n.page === 'cab') return 'CAB  ' + (st.cab ? ' ON' : 'OFF');
  const pn = O.LF_PROGS[st.prog | 0].replace(' ', '');
  return ch + ((st.prog | 0) + 1) + ' ' + pn.slice(0, 5);
}
registerScreen('tz5-seg', {
  build(s, g, w, h) {
    s.chars = [];
    const sc = 1.15, step = 14.2, x0 = (w - step * 8) / 2 + 1.6, y0 = (h - 18 * sc) / 2;
    for (let k = 0; k < 8; k++) {
      const cg = svg('g', { transform: `translate(${(x0 + k * step).toFixed(2)},${y0.toFixed(2)}) scale(${sc}) skewX(-7)` }, g);
      const segs = {};
      for (const name in SEG14) segs[name] = svg('path', { d: SEG14[name], fill: '#1c0a04' }, cg);
      s.chars.push(segs);
    }
    s.cur = '';
  },
  update(s, status, view, now) {
    const b = view.block, ui = s.ui, st = O.lfState(ui), n = lf.nav(b);
    let txt = b.bypass ? '  BYPASS' : lfText(b, st, n, ui, status, now);
    // a '.' lights the previous character's decimal point
    const cells = [];
    for (const ch of String(txt).toUpperCase()) { if (ch === '.' && cells.length) cells[cells.length - 1].dp = true; else cells.push({ ch, dp: false }); }
    while (cells.length < 8) cells.push({ ch: ' ', dp: false });
    const key = cells.slice(0, 8).map((c) => c.ch + (c.dp ? '.' : '')).join('') + (b.bypass ? 1 : 0);
    if (key === s.cur) return;
    s.cur = key;
    const on = b.bypass ? '#7a3a10' : '#ff9a1f';
    cells.slice(0, 8).forEach((c, k) => {
      const lit = segList(c.ch);
      for (const name in s.chars[k]) setA(s.chars[k][name], 'fill', (name === 'dp' ? c.dp : lit.has(name)) ? on : '#1c0a04');
    });
  },
  pointer(s, view, type, pt, e) {
    const b = view.block;
    if (type === 'down') HANDLERS['tz.foundry'].press(b, 'mode');
    if (type === 'wheel') HANDLERS['tz.foundry'].press(b, e.deltaY < 0 ? 'right' : 'left');
  },
});
// analog VU: amplitude-linear scale from -20 VU to +3 VU (0 VU = -18 dBFS); while tuning it shows cents
const VU_MARKS = [-20, -10, -7, -5, -3, -2, -1, 0, 1, 2, 3];
const vuPos = (db) => clamp(Math.pow(10, db / 20) / Math.pow(10, 3 / 20), 0, 1);
registerScreen('tz5-meter', {
  build(s, g, w, h) {
    s.w = w; s.h = h;
    const cx = w / 2, cy = h + 14, r = 62;
    s.cx = cx; s.cy = cy; s.r = r;
    R(g, 0, 0, w, h, { fill: '#efe3c2' });
    R(g, 0, 0, w, h, { fill: 'url(#p-grain)', 'fill-opacity': 0.5 });
    const ang = (p) => ((-44 + 88 * p) * Math.PI) / 180;
    const pt = (p, rr) => [cx + Math.sin(ang(p)) * rr, cy - Math.cos(ang(p)) * rr];
    s.ang = ang;
    // scale arcs: black to 0 VU, red above
    const arc = (p0, p1, rr) => { const [x0, y0] = pt(p0, rr), [x1, y1] = pt(p1, rr); return `M${x0.toFixed(2)} ${y0.toFixed(2)}A${rr} ${rr} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`; };
    s.vuG = svg('g', {}, g);
    svg('path', { d: arc(0, vuPos(0), r - 14), fill: 'none', stroke: '#1d1712', 'stroke-width': 0.9 }, s.vuG);
    svg('path', { d: arc(vuPos(0), 1, r - 14), fill: 'none', stroke: '#c8261b', 'stroke-width': 2.6 }, s.vuG);
    for (const m of VU_MARKS) {
      const p = vuPos(m), [x0, y0] = pt(p, r - 14), [x1, y1] = pt(p, r - 19), [tx, ty] = pt(p, r - 8.5);
      svg('path', { d: `M${x0.toFixed(2)} ${y0.toFixed(2)}L${x1.toFixed(2)} ${y1.toFixed(2)}`, stroke: m > 0 ? '#c8261b' : '#1d1712', 'stroke-width': 0.8 }, s.vuG);
      if ([-20, -10, -5, -3, 0, 3].includes(m)) T(s.vuG, tx, ty, (m > 0 ? '+' : '') + m, { size: 4.6, fill: m > 0 ? '#c8261b' : '#1d1712', anchor: 'middle', font: "'Barlow Condensed', sans-serif", weight: 700 });
    }
    T(s.vuG, cx, h - 21, 'VU', { size: 9, fill: '#1d1712', anchor: 'middle', font: "'Oswald', sans-serif", weight: 700 });
    // tuner scale (cents)
    s.tuG = svg('g', {}, g);
    svg('path', { d: arc(0, 1, r - 14), fill: 'none', stroke: '#1d1712', 'stroke-width': 0.9 }, s.tuG);
    for (let c = -50; c <= 50; c += 10) {
      const p = (c + 50) / 100, [x0, y0] = pt(p, r - 14), [x1, y1] = pt(p, r - (c % 50 === 0 || c === 0 ? 20 : 17)), [tx, ty] = pt(p, r - 8.5);
      svg('path', { d: `M${x0.toFixed(2)} ${y0.toFixed(2)}L${x1.toFixed(2)} ${y1.toFixed(2)}`, stroke: c === 0 ? '#1f8a3a' : '#1d1712', 'stroke-width': c === 0 ? 1.6 : 0.8 }, s.tuG);
      if (c % 25 === 0 || c === 0) T(s.tuG, tx, ty, c === 0 ? '0' : (c > 0 ? '+' : '') + c, { size: 4.4, fill: c === 0 ? '#1f8a3a' : '#1d1712', anchor: 'middle', font: "'Barlow Condensed', sans-serif", weight: 700 });
    }
    s.tuNote = T(s.tuG, cx, h - 21, '', { size: 9, fill: '#1d1712', anchor: 'middle', font: "'Oswald', sans-serif", weight: 700 });
    T(g, 5, 6, 'LOW FOUNDRY', { size: 3.6, fill: '#6b5b45', font: "'Inter', sans-serif", weight: 800, ls: 0.6 });
    s.mode = T(g, w - 5, 6, '', { size: 3.6, fill: '#6b5b45', font: "'Inter', sans-serif", weight: 800, anchor: 'end', ls: 0.6 });
    s.peak = svg('circle', { cx: w - 8, cy: h - 8, r: 2.4, fill: '#5a1a14' }, g);
    s.needle = svg('path', { d: `M${cx} ${cy}L${cx} ${cy - r + 9}`, stroke: '#121010', 'stroke-width': 0.9, 'stroke-linecap': 'round' }, g);
    // pivot cover
    R(g, 0, h - 9, w, 9, { fill: '#2b241c' });
    T(g, cx, h - 4.4, 'OUTPUT', { size: 3.8, fill: '#d9c9a6', anchor: 'middle', font: "'Inter', sans-serif", weight: 800, ls: 1 });
    s.pos = 0; s.peakT = 0; s.cur = '';
  },
  update(s, status, view, now) {
    const b = view.block, ui = s.ui, n = lf.nav(b);
    const tuner = (ui._tuner ?? 0) > 0.5;
    if (tuner !== s.tuner) { s.tuner = tuner; show(s.vuG, !tuner); show(s.tuG, tuner); setText(s.mode, tuner ? 'CENTS' : n.peakMode ? 'PEAK' : 'VU'); }
    let target;
    if (tuner) {
      const tu = status && status.tu && status.tu.tuner;
      target = tu && tu.note ? clamp(((tu.cents || 0) + 50) / 100, 0, 1) : 0.5;
      setText(s.tuNote, tu && tu.note ? tu.note : '');
      setA(s.tuNote, 'fill', tu && tu.note && Math.abs(tu.cents) < 3 ? '#1f8a3a' : '#1d1712');
    } else {
      const m = status && status.mt && status.mt.meter;
      const v = m && m[0] ? (n.peakMode ? m[0][0] : m[0][1]) : 0;
      const dbfs = 20 * Math.log10(Math.max(1e-6, v));
      target = b.bypass ? 0 : vuPos(dbfs + 18 - (n.peakMode ? 6 : 0));
      if (m && m[0] && m[0][0] > 0.9) s.peakT = now;
    }
    s.pos += (target - s.pos) * (tuner ? 0.25 : target > s.pos ? 0.35 : 0.12);
    const a = (s.ang(s.pos) * 180) / Math.PI;
    const key = a.toFixed(1) + (now - s.peakT < 400 ? 'p' : '');
    if (key === s.cur) return;
    s.cur = key;
    setA(s.needle, 'transform', `rotate(${a.toFixed(1)} ${s.cx} ${s.cy})`);
    setA(s.peak, 'fill', now - s.peakT < 400 ? '#ff2a1a' : '#5a1a14');
  },
  pointer(s, view, type) {
    if (type !== 'down') return;
    const n = lf.nav(view.block);
    n.peakMode = !n.peakMode;
    setText(s.mode, n.peakMode ? 'PEAK' : 'VU');
  },
});
