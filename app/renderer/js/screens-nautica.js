// Screens and switch logic of the Nautica XL (catalog/nautica.js). Footswitches and buttons toggle `_p.<name>` params
// and the bus listener below turns each change into an action. The unit state is the `_st` param; the open page,
// cursor and focus live in state.ui[id].nx. Pages are rebuilt only when their structure changes; values, meters and
// LEDs are updated in place, and every screen skips its frame when nothing it shows has changed.
import { svg, bus, clamp } from './util.js';
import { registerScreen } from './screens.js';
import { setA, setText } from './gfx/fx.js';
import { state, uiParams, setParam, blockById, commit, syncGraph, markDirty } from './state.js';
import { getDef } from './catalog/index.js';
import { sendCtrl } from './control.js';
import * as N from './catalog/nautica.js';

const TYPE = 'tz.nautica';
let syncing = false; // true while we move knobs ourselves (their param events are not user edits)
export function nav(b) {
  const u = (state.ui[b.id] = state.ui[b.id] || {});
  if (!u.nx) u.nx = { page: 'rig', cur: 'A1', pp: 0, focus: { s: 'A1', i: 0 }, lcat: 1, lscr: 0, bank: 0, asel: 0, lsel: 0, lscr2: 0, gsel: 0, menu: [false, false], rev: 0 };
  N.nxNav[b.id] = u.nx;
  return u.nx;
}
const getSt = (b) => N.clone(N.nxState(uiParams(b)));
function put(b, st, undo = false) {
  if (undo) commit();
  const ch = N.nxRig(st);
  const cur = b.opts || getDef(b.type).opts;
  let rebuild = false;
  if (JSON.stringify(cur) !== JSON.stringify(ch)) { b.opts = ch; rebuild = true; }
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
  const n = nav(b);
  n.msg = msg;
  n.msgT = performance.now() + ms;
}
let ptrDown = false;
window.addEventListener('pointerdown', () => (ptrDown = true), true);
window.addEventListener('pointerup', () => (ptrDown = false), true);
function holdable(onTap, onHold, ms = 650) {
  if (!ptrDown) return onTap();
  let held = false;
  const t = setTimeout(() => { held = true; onHold(); }, ms);
  const up = () => { window.removeEventListener('pointerup', up, true); clearTimeout(t); if (!held) onTap(); };
  window.addEventListener('pointerup', up, true);
}
function momentary(onDown, onUp, auto = 300) {
  onDown();
  if (!ptrDown) return setTimeout(onUp, auto);
  const up = () => { window.removeEventListener('pointerup', up, true); onUp(); };
  window.addEventListener('pointerup', up, true);
}

// ================================================================== state edits
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
  const m = N.nxModel(mid);
  const v = N.nxDefaults(m);
  st.slots[k] = { m: mid, on: 1, v };
  for (let i = 0; i < 8; i++) { const sc = st.scenes[i] || (st.scenes[i] = { on: {}, v: {} }); sc.on[k] = 1; sc.v[k] = v.slice(); }
}
// move a block to another slot (swaps with whatever is there) and keep assignments pointing at it
function swapSlots(st, a, z) {
  const sw = (o) => { if (!o) return; const x = o[a], y = o[z]; if (y === undefined) delete o[a]; else o[a] = y; if (x === undefined) delete o[z]; else o[z] = x; };
  sw(st.slots);
  for (const sc of st.scenes || []) if (sc) { sw(sc.on); sw(sc.v); }
  const fix = (o) => { if (o && o.s === a) o.s = z; else if (o && o.s === z) o.s = a; if (o && o.blk === a) o.blk = z; else if (o && o.blk === z) o.blk = a; };
  (st.fs || []).forEach(fix); (st.exp || []).forEach(fix); Object.values(st.side || {}).forEach(fix);
}
function loadPresetInto(b, st, pi) {
  pi = ((pi % N.NX_NPRESETS) + N.NX_NPRESETS) % N.NX_NPRESETS;
  const src = N.nxPresetSrc(st, pi);
  Object.assign(st, { name: src.name, slots: src.slots, scenes: src.scenes, sc: src.sc | 0, route: src.route | 0, mix: src.mix, fs: src.fs, exp: src.exp, eon: src.eon, side: src.side, scn: src.scn, pi });
  if (st.g && st.g.dmode > 0) st.mode = st.g.dmode - 1;
  if (b && (uiParams(b)._emv | 0)) setUi(b, '_emv', 0);
  const n = b && nav(b);
  if (n) { const first = N.NX_SLOTS.find((k) => st.slots[k]) || 'A1'; n.cur = first; n.focus = { s: first, i: 0 }; n.pp = 0; }
}
function savePreset(b, st, pi = st.pi | 0) {
  captureScene(st);
  st.user = st.user || {};
  st.user[pi] = N.clone({ name: st.name, slots: st.slots, scenes: st.scenes, sc: st.sc, route: st.route, mix: st.mix, fs: st.fs, exp: st.exp, eon: st.eon, side: st.side, scn: st.scn });
  put(b, st, true);
  flash(b, 'SAVED  ' + N.nxPresetLabel(st, pi), 1400);
}
function tapTempo(b) {
  const st = getSt(b), n = nav(b), now = performance.now();
  n.taps = (n.taps || []).filter((t) => now - t < 2500);
  n.taps.push(now);
  if (n.taps.length < 2) return;
  const d = [];
  for (let i = 1; i < n.taps.length; i++) d.push(n.taps[i] - n.taps[i - 1]);
  const ms = d.reduce((a, x) => a + x, 0) / d.length;
  if (ms < 200 || ms > 2000) return;
  st.g.bpm = Math.round(60000 / ms);
  if (!st.g.sync) for (const k in st.slots) { const m = N.nxModel(st.slots[k].m); if (m.algo === 'delay') st.slots[k].v[0] = Math.round(ms); }
  captureScene(st);
  put(b, st);
  flash(b, `TAP  ${st.g.bpm} BPM`, 900);
}
function toggleTuner(b, on) {
  const n = nav(b);
  const was = (uiParams(b)._tuner ?? 0) > 0.5;
  on = on ?? !was;
  if (on && !was && n.page !== 'tun') n.prevPage = n.page;
  setUi(b, '_tuner', on ? 1 : 0);
  if (on) n.page = 'tun';
  else if (n.page === 'tun') n.page = n.prevPage && n.prevPage !== 'tun' ? n.prevPage : 'rig';
}
function looperFn(b, st, f) {
  const arg = N.nxLooperArg(st);
  const t = state.status.blocks[b.id]?.lp?.looper?.tracks?.[0];
  const s = t ? t.state : 0;
  const ev = [1, s === 4 || s === 0 ? 1 : 2, 4, 9, 2, 3][f];
  if (ev) engineEvent(b, ev, arg);
}
function nextMode(b, st) {
  const nm = ((st.mode | 0) + 1) % 4;
  if (nm === 3) st.prevMode = st.mode | 0;
  st.mode = nm;
  const n = nav(b);
  if (nm === 3) n.page = 'lpr';
  else if (n.page === 'lpr') n.page = 'rig';
  put(b, st);
  flash(b, N.NX_MODES[nm] + ' MODE', 800);
}
const xfoPulse = (b, down) => {
  const n = nav(b);
  n.xfoV = down ? 1 : 0;
  sendCtrl(b, 0, down ? 1 : 0, 'press');
};
// run a footswitch function (i = 0..19)
function runFs(b, i) {
  const st = getSt(b), a = N.nxFsFunc(st, i), n = nav(b);
  switch (a.t) {
    case 'blk': if (st.slots[a.s]) { st.slots[a.s].on = st.slots[a.s].on ? 0 : 1; captureScene(st); put(b, st, true); } return;
    case 'scn': recallScene(st, a.i); put(b, st, true); flash(b, 'SCENE ' + (a.i + 1) + '  ' + ((st.scn && st.scn[a.i]) || N.NX_SCENE_NAMES[a.i]), 800); return;
    case 'prs': { captureScene(st); const bank = Math.floor((st.pi | 0) / N.NX_PER_BANK); loadPresetInto(b, st, bank * N.NX_PER_BANK + a.i); put(b, st, true); flash(b, N.nxPresetLabel(st)); return; }
    case 'pup': case 'pdn': captureScene(st); loadPresetInto(b, st, (st.pi | 0) + (a.t === 'pup' ? 1 : -1)); put(b, st, true); flash(b, N.nxPresetLabel(st)); return;
    case 'bup': case 'bdn': {
      captureScene(st);
      const nb = N.NX_BANKS.length, bank = Math.floor((st.pi | 0) / N.NX_PER_BANK);
      loadPresetInto(b, st, (((bank + (a.t === 'bup' ? 1 : -1)) % nb + nb) % nb) * N.NX_PER_BANK + ((st.pi | 0) % N.NX_PER_BANK));
      put(b, st, true); flash(b, 'BANK ' + N.NX_BANKS[Math.floor(st.pi / N.NX_PER_BANK)]); return;
    }
    case 'tap': return tapTempo(b);
    case 'tun': return toggleTuner(b);
    case 'mode': return nextMode(b, st);
    case 'lpr': return looperFn(b, st, a.f);
    case 'lpx': st.mode = st.prevMode ?? 0; n.page = 'rig'; return put(b, st);
    case 'expb': {
      const t = N.nxExpTarget(st, a.i);
      if (t && t.blk && st.slots[t.blk]) { st.slots[t.blk].on = st.slots[t.blk].on ? 0 : 1; captureScene(st); }
      else { st.eon = (st.eon || [1, 1, 1, 1]).slice(); st.eon[a.i] = st.eon[a.i] ? 0 : 1; }
      put(b, st, true);
      return flash(b, N.NX_EXP_NAMES[a.i] + (N.nxExpOn(st, a.i) ? ' ON' : ' OFF'), 700);
    }
    case 'par': {
      const s = st.slots[a.s], m = s && N.nxModel(s.m), sp = m && m.knobs[a.i];
      if (!sp) return;
      s.v[a.i] = N.specTo(sp, N.specPos(sp, s.v[a.i] ?? sp.def) > 0.5 ? 0 : 1);
      captureScene(st); put(b, st, true); return;
    }
    case 'xfs': if (((st.g && st.g.xfo) | 0) === 0) momentary(() => xfoPulse(b, true), () => xfoPulse(b, false)); return;
  }
}
// focused parameter edits (dials, touch dials, side controls)
function slotParam(st, s, i) {
  const sl = st.slots[s], m = sl && N.nxModel(sl.m), sp = m && m.knobs[i];
  return sp ? { sl, m, sp, v: sl.v[i] ?? sp.def } : null;
}
function setPos(b, s, i, pos, st = getSt(b)) {
  const x = slotParam(st, s, i);
  if (!x) return;
  x.sl.v[i] = N.specTo(x.sp, clamp(pos, 0, 1));
  captureScene(st);
  put(b, st);
  const n = nav(b);
  n.touch = { s, i, t: performance.now() };
}
function stepParam(b, s, i, dir) {
  const st = getSt(b), x = slotParam(st, s, i);
  if (!x) return;
  const sp = x.sp;
  if (sp.step && (sp.names || sp.fmt === 'int' || sp.max - sp.min <= 48)) x.sl.v[i] = clamp(Math.round((x.v + dir * sp.step) / sp.step) * sp.step, Math.min(sp.min, sp.max), Math.max(sp.min, sp.max));
  else x.sl.v[i] = N.specTo(sp, N.specPos(sp, x.v) + dir * 0.02);
  captureScene(st);
  put(b, st);
}
function sideValue(st, t) {
  if (!t) return null;
  if (t.mix) return clamp(((st.mix && st.mix[t.mix]) ?? 1) / 2, 0, 1);
  const x = slotParam(st, t.s, t.i);
  return x ? N.specPos(x.sp, x.v) : null;
}
function setSide(b, t, pos) {
  if (!t) return;
  if (t.mix) {
    const st = getSt(b);
    st.mix = Object.assign({ a: 1, b: 1, ap: 0, bp: 0 }, st.mix || {});
    st.mix[t.mix] = Math.round(clamp(pos, 0, 1) * 200) / 100;
    return put(b, st);
  }
  setPos(b, t.s, t.i, pos);
}
function syncKnobs(b) {
  const n = nav(b), st = N.nxState(uiParams(b));
  const s = st.slots[n.cur], m = s && N.nxModel(s.m);
  for (let i = 0; i < 10; i++) {
    const sp = m && m.knobs[n.pp * 10 + i];
    const v = sp ? N.specPos(sp, s.v[n.pp * 10 + i] ?? sp.def) : 0.5;
    if (Math.abs((b.params['k' + (i + 1)] ?? -1) - v) > 1e-4) setUi(b, 'k' + (i + 1), v);
  }
  n.knobKey = n.cur + '|' + n.pp + '|' + (s ? s.m : '') + '|' + uiParams(b)._st;
}
const pagesOf = (st, k) => { const s = st.slots[k], m = s && N.nxModel(s.m); return m ? Math.max(1, Math.ceil(m.knobs.length / 10)) : 1; };
function focusSlot(b, k) {
  const n = nav(b);
  if (n.cur !== k) { n.cur = k; n.pp = 0; n.focus = { s: k, i: 0 }; syncKnobs(b); }
}
function openLibrary(b, n, st) {
  const s = st.slots[n.cur], m = s && N.nxModel(s.m);
  n.page = 'lib';
  n.lcat = m ? Math.max(0, N.NX_CATS.findIndex((c) => c.id === m.cat)) : n.lcat ?? 1;
  n.lscr = 0;
}
function openPage(b, pg) {
  const n = nav(b), st = getSt(b);
  if (pg === 'lib') return openLibrary(b, n, st);
  if (pg === 'blk') {
    if (!st.slots[n.cur]) { const k = N.NX_SLOTS.find((x) => st.slots[x]); if (k) focusSlot(b, k); else return openLibrary(b, n, st); }
  }
  if (pg === 'pre') n.bank = Math.floor((st.pi | 0) / N.NX_PER_BANK);
  if (pg === 'tun') return toggleTuner(b, true);
  if (n.page === 'tun' && pg !== 'tun') toggleTuner(b, false);
  n.page = pg;
}
// the hardware buttons and the side screen nav
const BACK = { lib: 'rig', blk: 'rig', scn: 'rig', pre: 'rig', lpr: 'rig', tun: 'rig', asg: 'rig', asgl: 'asg', io: 'rig', glb: 'rig', rig: 'rig' };
function navKey(b, key) {
  const n = nav(b), st = getSt(b);
  if (key === 'home') { if (n.page === 'tun') toggleTuner(b, false); n.page = 'rig'; return; }
  if (key === 'back') { if (n.page === 'tun') return toggleTuner(b, false); n.page = BACK[n.page] || 'rig'; return; }
  if (key === 'save') return savePreset(b, st);
  const dir = key === 'up' ? -1 : key === 'down' ? 1 : 0;
  switch (n.page) {
    case 'rig': {
      if (key === 'enter') return st.slots[n.cur] ? openPage(b, 'blk') : openLibrary(b, n, st);
      const i = N.NX_SLOTS.indexOf(n.cur);
      return focusSlot(b, N.NX_SLOTS[(i + dir + 16) % 16]);
    }
    case 'blk': {
      if (key === 'enter') { n.pp = (n.pp + 1) % pagesOf(st, n.cur); return syncKnobs(b); }
      const s = st.slots[n.cur], m = s && N.nxModel(s.m);
      if (m) n.focus = { s: n.cur, i: clamp((n.focus && n.focus.s === n.cur ? n.focus.i : 0) + dir, 0, m.knobs.length - 1) };
      if (m && Math.floor(n.focus.i / 10) !== n.pp) { n.pp = Math.floor(n.focus.i / 10); syncKnobs(b); }
      return;
    }
    case 'lib': {
      const list = N.nxModelsIn(N.NX_CATS[n.lcat].id);
      if (key === 'enter') { const m = list[n.lsel | 0]; if (m) chooseModel(b, n, m.id); return; }
      n.lsel = clamp((n.lsel | 0) + dir * 3, 0, Math.max(0, list.length - 1));
      n.lscr = clamp(Math.floor(n.lsel / 3) - 2, 0, Math.max(0, Math.ceil(list.length / 3) - 6));
      return;
    }
    case 'scn': if (key === 'enter') { recallScene(st, n.ssel | 0); put(b, st, true); } else n.ssel = (((n.ssel | 0) + dir) % 8 + 8) % 8; return;
    case 'pre': {
      const sel = n.psel ?? (st.pi | 0);
      if (key === 'enter') { captureScene(st); loadPresetInto(b, st, sel); put(b, st, true); flash(b, N.nxPresetLabel(st)); return; }
      n.psel = ((sel + dir) % N.NX_NPRESETS + N.NX_NPRESETS) % N.NX_NPRESETS; n.bank = Math.floor(n.psel / N.NX_PER_BANK); return;
    }
    case 'lpr': if (key === 'enter') looperFn(b, st, 0); else looperFn(b, st, dir < 0 ? 3 : 1); return;
    case 'tun': if (dir) { st.g.ref = clamp((st.g.ref || 440) - dir, 432, 446); put(b, st); } return;
    case 'asg': if (key === 'enter') { n.page = 'asgl'; n.lscr2 = 0; } else n.asel = (((n.asel | 0) + dir) % ASG_ITEMS.length + ASG_ITEMS.length) % ASG_ITEMS.length; return;
    case 'asgl': {
      const list = asgChoices(st, ASG_ITEMS[n.asel | 0]);
      if (key === 'enter') return assignPick(b, st, ASG_ITEMS[n.asel | 0], list[n.lsel | 0]);
      n.lsel = clamp((n.lsel | 0) + dir, 0, list.length - 1);
      n.lscr2 = clamp((n.lsel | 0) - 6, 0, Math.max(0, list.length - 14));
      return;
    }
    case 'glb': {
      if (key === 'enter') { globalStep(st, GLOBAL_ROWS[n.gsel | 0], 1); put(b, st, true); return; }
      n.gsel = (((n.gsel | 0) + dir) % GLOBAL_ROWS.length + GLOBAL_ROWS.length) % GLOBAL_ROWS.length; return;
    }
    case 'io': {
      if (key === 'enter') { ioStep(b, st, IO_ROWS[n.isel | 0], 1); return; }
      n.isel = (((n.isel | 0) + dir) % IO_ROWS.length + IO_ROWS.length) % IO_ROWS.length; return;
    }
  }
}
function chooseModel(b, n, mid) {
  const st = getSt(b);
  const m = mid && N.nxModel(mid);
  if (m && m.loop) {
    const used = N.NX_SLOTS.filter((k) => k !== n.cur && st.slots[k]).map((k) => N.nxModel(st.slots[k].m)).filter((x) => x.loop).flatMap((x) => x.loop);
    if (m.loop.some((k) => used.includes(k))) return flash(b, 'SEND ' + (m.loop.find((k) => used.includes(k)) + 1) + ' IS IN USE', 1200);
  }
  setModel(st, n.cur, mid);
  put(b, st, true);
  n.pp = 0;
  n.focus = { s: n.cur, i: 0 };
  n.page = mid ? 'blk' : 'rig';
  flash(b, mid ? n.cur + '  ' + m.name : n.cur + '  CLEARED', 900);
  syncKnobs(b);
}

// ================================================================== assignments, I/O and global settings
const ASG_ITEMS = [
  ...[...Array(20)].map((_, i) => ({ kind: 'fs', i, name: N.NX_FS_NAMES[i] })),
  ...[0, 1, 2, 3].map((i) => ({ kind: 'exp', i, name: N.NX_EXP_NAMES[i] })),
  ...N.NX_SIDE.map((k) => ({ kind: 'side', k, name: N.NX_SIDE_NAMES[k] })),
  { kind: 'xfo', name: 'EXT FS OUT' }, { kind: 'xeo', name: 'EXT EXP OUT' },
];
function asgChoices(st, it) {
  if (it.kind === 'fs') return N.nxFsChoices(st, it.i);
  if (it.kind === 'exp') return N.nxExpChoices(st);
  if (it.kind === 'side') return N.nxSideChoices(st);
  return (it.kind === 'xfo' ? N.NX_XFO : N.NX_XEO).map((label, v) => ({ label, a: v }));
}
function asgCurrent(st, it) {
  if (it.kind === 'fs') return (st.fs && st.fs[it.i]) || { t: 'auto' };
  if (it.kind === 'exp') return (st.exp && st.exp[it.i]) || { t: 'none' };
  if (it.kind === 'side') return (st.side && st.side[it.k]) || { t: 'auto' };
  return (st.g && st.g[it.kind]) | 0;
}
function asgShort(st, it, lp, ui) {
  if (it.kind === 'fs') {
    // the assignment itself (STOMP mode), not what the current mode puts on the switch
    const f = N.nxFsInfo(Object.assign({}, st, { mode: 0 }), it.i, { lp, tuner: (ui._tuner ?? 0) > 0.5 });
    const a = (st.fs && st.fs[it.i]) || { t: 'auto' };
    return a.t === 'auto' ? (f.label ? 'AUTO: ' + f.label : 'AUTO') : f.label || 'NONE';
  }
  if (it.kind === 'exp') { const t = N.nxExpTarget(st, it.i); return t ? t.name : 'NONE'; }
  if (it.kind === 'side') { const t = N.nxSideTarget(st, it.k, null); const a = st.side && st.side[it.k]; return t ? t.name : a && a.t === 'auto' ? 'AUTO' : 'NONE'; }
  return (it.kind === 'xfo' ? N.NX_XFO : N.NX_XEO)[asgCurrent(st, it)];
}
function assignPick(b, st, it, ch) {
  if (!ch) return;
  if (it.kind === 'fs') { st.fs = st.fs || []; st.fs[it.i] = N.clone(ch.a); }
  else if (it.kind === 'exp') { st.exp = st.exp || []; st.exp[it.i] = N.clone(ch.a); }
  else if (it.kind === 'side') { st.side = st.side || {}; st.side[it.k] = N.clone(ch.a); }
  else st.g[it.kind] = ch.a;
  put(b, st, true);
  flash(b, it.name + '  ' + ch.label, 1000);
  nav(b).page = 'asg';
}
const pctF = (v) => Math.round(v * 100) + '%';
const dbF = (v) => (v > 0 ? '+' : '') + (+v).toFixed(1) + ' dB';
const GLOBAL_ROWS = [
  { l: 'TEMPO', k: 'bpm', min: 40, max: 240, step: 1, f: (v) => Math.round(v) + ' BPM' },
  { l: 'DELAY TEMPO SYNC', k: 'sync', opts: ['OFF', 'ON (SUBDIV)'] },
  { l: 'TUNER REFERENCE', k: 'ref', min: 432, max: 446, step: 1, f: (v) => Math.round(v) + ' Hz' },
  { l: 'SCREEN THEME', k: 'theme', opts: ['OCEAN', 'MIDNIGHT', 'DAYLIGHT'] },
  { l: 'TOP STRIP 1', k: 'strip', idx: 0, opts: N.NX_STRIPS },
  { l: 'TOP STRIP 2', k: 'strip', idx: 1, opts: N.NX_STRIPS },
  { l: 'SWITCH DISPLAYS', k: 'fsB', opts: ['DIM', 'NORMAL', 'BRIGHT'] },
  { l: 'MODE ON PRESET LOAD', k: 'dmode', opts: ['KEEP', ...N.NX_MODES] },
  { l: 'TAP TEMPO LED', k: 'tapLed', opts: ['OFF', 'ON'] },
  { l: 'VOLUME PEDAL', k: 'volPos', opts: ['PRE PATHS', 'POST PATHS'] },
  { l: 'LOOPER LEVEL', k: 'lpLvl', min: 0, max: 1, step: 0.05, f: pctF },
  { l: 'ENCODER SPEED', k: 'encSens', opts: ['SLOW', 'NORMAL', 'FAST'] },
  { l: 'XLR GROUND LIFT', k: 'xlrLift', opts: ['GROUND', 'LIFT'] },
];
function globalValue(st, r) {
  const g = Object.assign({}, N.NX_GLOBAL, st.g || {});
  const v = r.idx !== undefined ? (g[r.k] || [0, 1])[r.idx] : g[r.k];
  return r.opts ? r.opts[v | 0] ?? r.opts[0] : r.f(v ?? r.min);
}
function globalStep(st, r, dir) {
  const g = (st.g = Object.assign({}, N.NX_GLOBAL, st.g || {}));
  if (r.idx !== undefined) { const a = (g[r.k] || [0, 1]).slice(); a[r.idx] = ((a[r.idx] | 0) + dir + r.opts.length) % r.opts.length; g[r.k] = a; return; }
  if (r.opts) { g[r.k] = (((g[r.k] | 0) + dir) % r.opts.length + r.opts.length) % r.opts.length; return; }
  g[r.k] = clamp(Math.round(((g[r.k] ?? r.min) + dir * r.step) / r.step) * r.step, r.min, r.max);
}
const IO_ROWS = [
  { l: 'GUITAR IN GAIN', k: 'gtr', min: -24, max: 12, step: 0.5, f: dbF },
  { l: 'AUX IN GAIN', k: 'aux', min: -60, max: 12, step: 1, f: (v) => (v <= -60 ? 'OFF' : dbF(v)) },
  { l: 'AUX IN TO', k: 'auxTo', opts: ['NOWHERE', 'INPUT', 'PATH A', 'PATH B', 'MAIN OUT'] },
  { l: 'NOISE GATE', k: 'gate', min: 0, max: 0.8, step: 0.05, f: (v) => (v < 0.01 ? 'OFF' : pctF(v)) },
  { l: 'PATH A LEVEL', mix: 'a', min: 0, max: 2, step: 0.05, f: pctF },
  { l: 'PATH B LEVEL', mix: 'b', min: 0, max: 2, step: 0.05, f: pctF },
  { l: 'PATH A PAN', mix: 'ap', min: -1, max: 1, step: 0.1, f: (v) => (Math.abs(v) < 0.05 ? 'C' : (v < 0 ? 'L' : 'R') + Math.round(Math.abs(v) * 100)) },
  { l: 'PATH B PAN', mix: 'bp', min: -1, max: 1, step: 0.1, f: (v) => (Math.abs(v) < 0.05 ? 'C' : (v < 0 ? 'L' : 'R') + Math.round(Math.abs(v) * 100)) },
  ...N.NX_OUTS.map((name, j) => ({ out: j, l: name })),
];
function ioValue(st, r) {
  if (r.mix) return r.f((st.mix || {})[r.mix] ?? (r.mix.length === 1 ? 1 : 0));
  const g = Object.assign({}, N.NX_GLOBAL, st.g || {});
  return r.opts ? r.opts[g[r.k] | 0] : r.f(g[r.k] ?? 0);
}
// I/O rows: col = 0 (value / source), 1 (level), 2 (master), 3 (mono mode)
function ioStep(b, st, r, dir, col = 0) {
  st.g = Object.assign({}, N.NX_GLOBAL, st.g || {});
  if (r.out !== undefined) {
    const outs = N.clone(N.nxOuts(st.g)), o = outs[r.out];
    if (col === 0) o.src = ((o.src | 0) + dir + N.NX_OUT_SRC.length) % N.NX_OUT_SRC.length;
    else if (col === 1) o.lvl = clamp((o.lvl || 0) + dir, -30, 12);
    else if (col === 2) o.m = o.m ? 0 : 1;
    else o.mono = ((o.mono | 0) + 1) % 3;
    st.g.outs = outs;
  } else if (r.mix) {
    st.mix = Object.assign({ a: 1, b: 1, ap: 0, bp: 0 }, st.mix || {});
    st.mix[r.mix] = clamp(Math.round((st.mix[r.mix] + dir * r.step) * 100) / 100, r.min, r.max);
  } else if (r.opts) st.g[r.k] = (((st.g[r.k] | 0) + dir) % r.opts.length + r.opts.length) % r.opts.length;
  else st.g[r.k] = clamp(Math.round(((st.g[r.k] ?? 0) + dir * r.step) / r.step) * r.step, r.min, r.max);
  put(b, st, true);
}

// ================================================================== bus: presses and param changes
const BTN_PAGES = { lib: 'lib', amp: 'blk', pre: 'pre', scn: 'scn', lpr: 'lpr', tun: 'tun', asg: 'asg', io: 'io', glb: 'glb' };
function press(b, name) {
  const fs = /^fs(\d+)$/.exec(name);
  if (fs) return runFs(b, +fs[1] - 1);
  if (name === 'mode') return nextMode(b, getSt(b));
  if (name === 'tap') return holdable(() => tapTempo(b), () => toggleTuner(b), 700);
  if (BTN_PAGES[name]) {
    const n = nav(b);
    if (name === 'tun') return toggleTuner(b);
    if (name === 'amp') {
      const st = getSt(b), k = N.NX_SLOTS.find((x) => st.slots[x] && N.nxModel(st.slots[x].m).cat === 'amp') || N.NX_SLOTS.find((x) => st.slots[x] && N.nxModel(st.slots[x].m).cat === 'nam');
      if (k) focusSlot(b, k);
    }
    if (n.page === BTN_PAGES[name] && name !== 'amp') { if (n.page === 'tun') toggleTuner(b, false); n.page = 'rig'; return; }
    return openPage(b, BTN_PAGES[name]);
  }
}
const EXP_BIT = { exp1: 1, exp2: 2, _xexp1: 4, _xexp2: 8 };
bus.on('param', ({ id, p }) => {
  if (!p || typeof p !== 'string') return;
  const b = blockById(id);
  if (!b || b.type !== TYPE) return;
  if (p.startsWith('_p.')) return press(b, p.slice(3));
  if (syncing) return;
  if (EXP_BIT[p]) { const m = uiParams(b)._emv | 0; if (!(m & EXP_BIT[p])) setUi(b, '_emv', m | EXP_BIT[p]); return; }
  const xf = /^_xfs([1-4])$/.exec(p);
  if (xf) {
    const n = nav(b), v = (uiParams(b)[p] ?? 0) > 0.5;
    n.xin = n.xin || {};
    if (v && !n.xin[p]) runFs(b, 15 + +xf[1]);
    n.xin[p] = v;
    return;
  }
  const k = /^k(\d+)$/.exec(p);
  if (k) {
    const n = nav(b), i = n.pp * 10 + (+k[1] - 1);
    const st = getSt(b);
    if (!slotParam(st, n.cur, i)) return;
    n.focus = { s: n.cur, i };
    setPos(b, n.cur, i, uiParams(b)[p], st);
  }
});

// EXT FS OUT / EXT EXP OUT: driven from the chosen source, checked 20 times a second
setInterval(() => {
  if (!state.preset || !state.preset.blocks) return;
  for (const b of state.preset.blocks) {
    if (b.type !== TYPE) continue;
    if (!state.preset.cables.some((c) => c.from.node === b.id && typeof c.from.port === 'string')) continue;
    const ui = uiParams(b), st = N.nxState(ui), n = nav(b), g = st.g || {};
    const now = performance.now();
    const lp = state.status.blocks[b.id]?.lp?.looper?.tracks?.[0];
    const src = g.xfo | 0;
    if (src > 0) {
      const v = src === 1 ? now % (60000 / (g.bpm || 120)) < 90 : src === 2 ? (ui._tuner ?? 0) > 0.5 : src === 3 ? !!lp && (lp.state === 2 || lp.state === 3) : src === 4 ? (st.sc | 0) > 0 : N.nxExpOn(st, src - 5);
      if (!!v !== !!n.xfoV) xfoPulse(b, v);
    }
    const e = g.xeo | 0;
    let ev = 0;
    if (e < 4) ev = ui[N.NX_EXP_PARAMS[e]] ?? (e === 0 ? 1 : 0);
    else if (e < 8) ev = sideValue(st, N.nxSideTarget(st, ['x', 'y', 's1', 's2'][e - 4], n.focus)) ?? 0;
    else ev = ui.mvol ?? 0.8;
    if (Math.abs(ev - (ui._xeo ?? -1)) > 0.002) setUi(b, '_xeo', Math.round(ev * 1000) / 1000);
  }
}, 50);

// ================================================================== drawing helpers
const AF = "'Inter', sans-serif", AH = "'Oswald', sans-serif", MONO = "'Share Tech Mono', monospace";
const T = (g, x, y, s, o = {}) => svg('text', { x, y, fill: o.fill || '#fff', 'font-family': o.font || AF, 'font-size': o.size || 7, 'font-weight': o.weight || 600, 'text-anchor': o.anchor || 'start', 'dominant-baseline': 'central', 'letter-spacing': o.ls ?? 0, 'pointer-events': 'none', opacity: o.opacity }, g, s);
const R = (g, x, y, width, height, a = {}) => svg('rect', Object.assign({ x, y, width, height }, a), g);
const G = (g, a = {}) => svg('g', a, g);
const show = (el, on) => setA(el, 'display', on ? null : 'none');
const cut = (s, n) => { s = String(s ?? ''); return s.length > n ? s.slice(0, n - 1) + '.' : s; };
const THEMES = [
  { bg: '#060b11', panel: '#0f1821', panel2: '#162330', line: '#21303f', text: '#eaf2f8', dim: '#7790a3', acc: '#2ee6d6', head: '#0a121a', ink: '#05090d' },
  { bg: '#020304', panel: '#0b0d11', panel2: '#13161c', line: '#1e232c', text: '#cfd6e2', dim: '#5c6678', acc: '#ff8a3d', head: '#06070a', ink: '#020304' },
  { bg: '#e9eef3', panel: '#ffffff', panel2: '#dde4ec', line: '#c2ccd8', text: '#121a24', dim: '#5f6c7d', acc: '#0b8f86', head: '#d3dce6', ink: '#0b1118' },
];
const themeOf = (st) => THEMES[(st.g && st.g.theme) | 0] || THEMES[0];
function arcPath(cx, cy, r, a0, a1) {
  const ang = (t) => ((-135 + 270 * t) * Math.PI) / 180;
  const p = (t) => [cx + Math.sin(ang(t)) * r, cy - Math.cos(ang(t)) * r];
  if (a1 - a0 < 0.004) return '';
  const [x0, y0] = p(a0), [x1, y1] = p(a1);
  return `M${x0.toFixed(2)} ${y0.toFixed(2)}A${r} ${r} 0 ${(a1 - a0) * 270 > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}
const statusOf = (b) => state.status.blocks[b.id] || {};
// hit regions: { x, y, w, h, down(pt), move(pt, d), up(pt, d), wheel(dir), swipe(dir) }
function hit(s, x, y, w, h, o) { s.hits.push(Object.assign({ x, y, w, h }, o)); }
function pointerOn(s, view, type, pt, e) {
  if (type === 'wheel') {
    const dir = e.deltaY < 0 ? -1 : 1;
    const h = [...s.hits].reverse().find((r) => r.wheel && pt.x >= r.x && pt.x <= r.x + r.w && pt.y >= r.y && pt.y <= r.y + r.h);
    if (h) h.wheel(dir, pt);
    else if (s.wheel) s.wheel(dir, pt);
    s.sigS = '';
    return;
  }
  if (type === 'down') {
    const h = [...s.hits].reverse().find((r) => pt.x >= r.x && pt.x <= r.x + r.w && pt.y >= r.y && pt.y <= r.y + r.h);
    s.drag = { h, x0: pt.x, y0: pt.y, moved: false };
    if (h && h.down) h.down(pt);
    return;
  }
  const d = s.drag;
  if (!d) return;
  const dd = { dx: pt.x - d.x0, dy: pt.y - d.y0 };
  if (Math.abs(dd.dx) + Math.abs(dd.dy) > 3) d.moved = true;
  if (type === 'move') { if (d.h && d.h.move) d.h.move(pt, dd); return; }
  if (type === 'up') {
    s.drag = null;
    if (d.h && d.h.up) d.h.up(pt, dd, d.moved);
    else if (Math.abs(dd.dx) > 40 && Math.abs(dd.dx) > Math.abs(dd.dy) * 1.5) {
      const sw = (d.h && d.h.swipe) || s.swipe;
      if (sw) sw(dd.dx < 0 ? 1 : -1);
    } else if (d.h && d.h.tap && !d.moved) d.h.tap(pt);
    s.sigS = '';
  }
}

// ================================================================== MAIN SCREEN (560 x 250)
const TW = 54, TH = 36, TX = (i) => 42 + i * 61, TY = (r) => (r === 'A' ? 50 : 104);
const PAGE_NAMES = { rig: 'SIGNAL CHAIN', lib: 'BLOCK LIBRARY', blk: 'BLOCK', scn: 'SCENES', pre: 'PRESETS', lpr: 'LOOPER', tun: 'TUNER', asg: 'ASSIGN', asgl: 'ASSIGN', io: 'I/O ROUTING', glb: 'GLOBAL' };
function structSig(st, n, ui, msgOn) {
  const slots = N.NX_SLOTS.map((k) => (st.slots[k] ? st.slots[k].m + (st.slots[k].on ? '+' : '-') : '')).join(',');
  return [n.page, n.cur, n.pp, n.focus && n.focus.s, n.focus && n.focus.i, n.lcat, n.lscr, n.lsel, n.bank, n.psel, n.ssel, n.asel, n.lscr2, n.lsel, n.gsel, n.isel, n.drag2 ? n.drag2.over : '',
    slots, st.route, st.sc, st.pi, st.name, st.mode, st.g && st.g.theme, st.g && st.g.bpm, JSON.stringify(st.scn), msgOn ? n.msg : '', N.nxModelCount()].join('|');
}
registerScreen('nxl-main', {
  build(s, g, w, h) {
    s.w = w; s.h = h;
    s.bg = R(g, 0, 0, w, h, { fill: THEMES[0].bg });
    s.page = G(g);
    s.live = G(g);
    s.msgG = G(g);
    s.msgBox = R(s.msgG, w / 2 - 120, h / 2 - 14, 240, 28, { rx: 8, fill: '#000', 'fill-opacity': 0.85, stroke: '#2ee6d6', 'stroke-width': 1.2 });
    s.msgT = T(s.msgG, w / 2, h / 2, '', { size: 9, weight: 800, anchor: 'middle', ls: 0.6 });
    show(s.msgG, false);
    s.sigS = ''; s.sigV = '';
    s.hits = [];
  },
  update(s, status, view, now) {
    const b = view.block, ui = s.ui, st = N.nxState(ui), n = nav(b);
    const th = themeOf(st);
    const tuner = (ui._tuner ?? 0) > 0.5;
    if (!tuner && n.page === 'tun') n.page = n.prevPage && n.prevPage !== 'tun' ? n.prevPage : 'rig';
    if (tuner && n.page !== 'tun') n.page = 'tun';
    if ((st.mode | 0) === 3 && !n.looperSeen) { n.page = 'lpr'; n.looperSeen = true; }
    if ((st.mode | 0) !== 3) n.looperSeen = false;
    if (!st.slots[n.cur] && n.page === 'blk') n.page = 'rig';
    const kk = n.cur + '|' + n.pp + '|' + (st.slots[n.cur] ? st.slots[n.cur].m : '') + '|' + ui._st;
    if (kk !== n.knobKey) syncKnobs(b);
    const msgOn = !!n.msg && now < n.msgT;
    const sigS = structSig(st, n, ui, msgOn);
    if (sigS !== s.sigS) {
      s.sigS = sigS; s.sigV = '';
      s.page.innerHTML = ''; s.live.innerHTML = '';
      s.hits = []; s.vals = []; s.swipe = null; s.wheel = null; s.liveFn = null;
      setA(s.bg, 'fill', th.bg);
      header(s, s.page, st, n, th, b);
      (PAGES[n.page] || PAGES.rig)(s, s.page, st, n, th, b, ui);
      show(s.msgG, msgOn);
      if (msgOn) { setText(s.msgT, cut(n.msg, 40)); setA(s.msgBox, 'stroke', th.acc); }
    }
    const sigV = ui._st + '|' + (ui.exp1 ?? 1) + '|' + (ui.exp2 ?? 0) + '|' + (ui._emv | 0) + '|' + (n.touch ? n.touch.t : 0);
    if (sigV !== s.sigV) { s.sigV = sigV; for (const f of s.vals) f(st, ui); }
    if (s.liveFn) s.liveFn(status, now, th);
  },
  pointer(s, view, type, pt, e) { pointerOn(s, view, type, pt, e); },
});
function chip(s, g, x, y, w, h, label, th, o = {}) {
  const on = !!o.on;
  R(g, x, y, w, h, { rx: h / 2.6, fill: on ? o.color || th.acc : th.panel2, stroke: o.color || th.line, 'stroke-width': 0.8 });
  T(g, x + w / 2, y + h / 2 + 0.3, cut(label, Math.floor(w / ((o.size || 5.6) * 0.66))), { size: o.size || 5.6, weight: 800, anchor: 'middle', fill: on ? th.ink : o.fill || th.text, ls: 0.4 });
  if (o.tap) hit(s, x, y, w, h, { tap: o.tap, wheel: o.wheel });
}
function header(s, g, st, n, th, b) {
  const w = s.w;
  R(g, 0, 0, w, 19, { fill: th.head });
  R(g, 0, 19, w, 0.8, { fill: th.line });
  T(g, 8, 9.8, cut(N.nxPresetLabel(st), 26), { font: AH, size: 9, weight: 600, ls: 0.5, fill: th.text });
  hit(s, 0, 0, 170, 19, { tap: () => openPage(b, 'pre') });
  const sc = st.sc | 0;
  svg('circle', { cx: 184, cy: 9.6, r: 3.2, fill: N.NX_SCENE_COLS[sc] }, g);
  T(g, 191, 9.8, 'SCENE ' + (sc + 1) + ' ' + cut((st.scn && st.scn[sc]) || N.NX_SCENE_NAMES[sc], 9), { size: 6, weight: 800, fill: th.text });
  hit(s, 176, 0, 100, 19, { tap: () => openPage(b, 'scn') });
  T(g, 340, 9.8, PAGE_NAMES[n.page] || '', { size: 6.4, weight: 800, anchor: 'middle', fill: th.acc, ls: 1.2 });
  chip(s, g, 420, 3.5, 58, 12, N.NX_MODES[st.mode | 0], th, { on: true, color: N.NX_MODE_COL[st.mode | 0], size: 5.4, tap: () => nextMode(b, getSt(b)) });
  T(g, w - 8, 9.8, Math.round((st.g && st.g.bpm) || 120) + ' BPM', { size: 6.2, weight: 800, anchor: 'end', fill: th.dim });
  hit(s, 484, 0, 76, 19, { tap: () => openPage(b, 'glb') });
}
const PAGES = {};
// ---- signal chain
PAGES.rig = (s, g, st, n, th, b) => {
  const w = s.w, route = N.nxRoute(st), r0 = st.route | 0;
  chip(s, g, 8, 25, 70, 13, 'ROUTE ' + N.NX_ROUTES[r0], th, { size: 5.4, tap: () => { const x = getSt(b); x.route = ((x.route | 0) + 1) % 3; put(b, x, true); flash(b, 'ROUTING  ' + N.NX_ROUTES[x.route], 800); } });
  T(g, 86, 31.8, route !== r0 ? 'one path is empty: running SERIAL' : ['A then B', 'A and B side by side', 'A from GUITAR, B from AUX'][route], { size: 5.2, weight: 700, fill: th.dim });
  const mix = Object.assign({ a: 1, b: 1 }, st.mix || {});
  T(g, w - 8, 31.8, `A ${Math.round(mix.a * 100)}%  ·  B ${Math.round(mix.b * 100)}%`, { size: 5.2, weight: 800, anchor: 'end', fill: th.dim });
  // wires
  const yA = TY('A') + TH / 2, yB = TY('B') + TH / 2, ym = (yA + yB) / 2, xs = TX(0) - 8, xe = TX(7) + TW + 8;
  let d;
  if (route === 0) d = `M14 ${ym}H24V${yA}H${xe}V${ym}H${xs}V${yB}H${xe}V${ym}H${w - 14}`;
  else if (route === 1) d = `M14 ${ym}H24V${yA}H${xe}V${ym}H${w - 14}M24 ${ym}V${yB}H${xe}V${ym}`;
  else d = `M14 ${yA}H${xe}V${ym}H${w - 14}M14 ${yB}H${xe}V${ym}`;
  svg('path', { d, fill: 'none', stroke: th.line, 'stroke-width': 2, 'stroke-linejoin': 'round' }, g);
  if (route === 2) { T(g, 14, yA - 7, 'GTR', { size: 4.6, weight: 800, fill: th.dim, anchor: 'middle' }); T(g, 14, yB - 7, 'AUX', { size: 4.6, weight: 800, fill: th.dim, anchor: 'middle' }); }
  else { svg('circle', { cx: 12, cy: ym, r: 4.4, fill: th.bg, stroke: th.dim, 'stroke-width': 1.2 }, g); T(g, 12, ym + 10, 'IN', { size: 4.6, weight: 800, fill: th.dim, anchor: 'middle' }); }
  svg('circle', { cx: w - 12, cy: ym, r: 4.4, fill: th.bg, stroke: th.dim, 'stroke-width': 1.2 }, g);
  T(g, w - 12, ym + 10, 'OUT', { size: 4.6, weight: 800, fill: th.dim, anchor: 'middle' });
  for (const k of N.NX_SLOTS) {
    const i = +k.slice(1) - 1, x = TX(i), y = TY(k[0]);
    const sl = st.slots[k], m = sl && N.nxModel(sl.m), cat = m && N.NX_CAT[m.cat];
    const tg = G(g, { transform: `translate(${x},${y})` });
    const over = n.drag2 && n.drag2.over === k && n.drag2.from !== k;
    if (m) {
      R(tg, 0, 0, TW, TH, { rx: 5, fill: sl.on ? cat.color : th.panel, 'fill-opacity': sl.on ? 0.95 : 1, stroke: cat.color, 'stroke-width': 1.2 });
      R(tg, 0, TH - 4, TW, 4, { rx: 2, fill: sl.on ? '#000' : cat.color, 'fill-opacity': sl.on ? 0.25 : 0.5 });
      T(tg, TW / 2, 12, cut(m.short, 9), { size: 6.4, weight: 800, anchor: 'middle', fill: sl.on ? th.ink : cat.color });
      T(tg, TW / 2, 23, cat.short + (sl.on ? '' : ' OFF'), { size: 4.8, weight: 800, anchor: 'middle', fill: sl.on ? th.ink : th.dim, ls: 0.6 });
    } else {
      R(tg, 0, 0, TW, TH, { rx: 5, fill: th.bg, stroke: th.line, 'stroke-width': 1, 'stroke-dasharray': '3 2' });
      T(tg, TW / 2, TH / 2 - 1, '+', { size: 11, weight: 400, anchor: 'middle', fill: th.dim });
    }
    T(tg, 3, -4.5, k, { size: 4.4, weight: 800, fill: th.dim });
    if (k === n.cur) R(tg, -3, -3, TW + 6, TH + 6, { rx: 7, fill: 'none', stroke: th.text, 'stroke-width': 1.6 });
    if (over) R(tg, -3, -3, TW + 6, TH + 6, { rx: 7, fill: 'none', stroke: th.acc, 'stroke-width': 1.6, 'stroke-dasharray': '4 2' });
    // tap = select, tap the selected block again = open it; drag onto another slot = move it there
    hit(s, x - 3, y - 3, TW + 6, TH + 6, {
      down: () => { n.drag2 = { from: k, over: k, t: performance.now() }; },
      move: (pt) => {
        const tgt = N.NX_SLOTS.find((q) => { const qx = TX(+q.slice(1) - 1), qy = TY(q[0]); return pt.x >= qx - 4 && pt.x <= qx + TW + 4 && pt.y >= qy - 4 && pt.y <= qy + TH + 4; });
        if (tgt && n.drag2 && n.drag2.over !== tgt) { n.drag2.over = tgt; s.sigS = ''; }
      },
      up: (pt, dd, moved) => {
        const dg = n.drag2;
        n.drag2 = null;
        s.sigS = '';
        if (moved && dg && dg.over && dg.over !== k) {
          const x2 = getSt(b);
          if (!x2.slots[k]) return;
          swapSlots(x2, k, dg.over); put(b, x2, true);
          focusSlot(b, dg.over); flash(b, `MOVED ${k} TO ${dg.over}`, 800);
          return;
        }
        if (moved) return;
        if (n.cur === k) return sl ? openPage(b, 'blk') : openLibrary(b, n, st);
        focusSlot(b, k);
        if (!sl) openLibrary(b, n, st);
      },
    });
  }
  // focused block: 10 parameters (same as the dials)
  focusPanel(s, g, st, n, th, b, 150);
};
function focusPanel(s, g, st, n, th, b, y0) {
  const w = s.w, sl = st.slots[n.cur], m = sl && N.nxModel(sl.m);
  R(g, 6, y0, w - 12, s.h - y0 - 6, { rx: 7, fill: th.panel, stroke: th.line, 'stroke-width': 0.8 });
  if (!m) {
    T(g, w / 2, y0 + 44, n.cur + ' IS EMPTY · TAP IT TO ADD A BLOCK', { size: 7, weight: 800, anchor: 'middle', fill: th.dim, ls: 0.6 });
    return;
  }
  const cat = N.NX_CAT[m.cat], np = Math.max(1, Math.ceil(m.knobs.length / 10));
  R(g, 6, y0, 4, s.h - y0 - 6, { rx: 2, fill: cat.color });
  T(g, 16, y0 + 9, n.cur + '  ·  ' + cut(m.name, 22).toUpperCase(), { size: 6.6, weight: 800, fill: cat.color, ls: 0.4 });
  chip(s, g, 220, y0 + 3, 40, 12, sl.on ? 'ON' : 'OFF', th, { on: !!sl.on, color: cat.color, size: 5.4, tap: () => { const x = getSt(b); if (x.slots[n.cur]) { x.slots[n.cur].on = x.slots[n.cur].on ? 0 : 1; captureScene(x); put(b, x, true); } } });
  chip(s, g, 266, y0 + 3, 46, 12, 'EDIT', th, { size: 5.4, tap: () => openPage(b, 'blk') });
  T(g, w - 14, y0 + 9, np > 1 ? `PAGE ${n.pp + 1}/${np}  ·  SWIPE` : 'DIALS 1-10', { size: 5.2, weight: 800, anchor: 'end', fill: th.dim });
  const cw = (w - 24) / 5, ch = (s.h - y0 - 26) / 2;
  for (let i = 0; i < 10; i++) {
    const idx = n.pp * 10 + i, sp = m.knobs[idx];
    const x = 12 + (i % 5) * cw, y = y0 + 19 + Math.floor(i / 5) * ch;
    const cg = G(g, { transform: `translate(${x},${y})` });
    R(cg, 1, 1, cw - 2, ch - 2, { rx: 4, fill: th.panel2 });
    T(cg, 10, 9, String(i + 1), { size: 5, weight: 800, fill: th.dim, anchor: 'middle' });
    if (!sp) continue;
    const foc = n.focus && n.focus.s === n.cur && n.focus.i === idx;
    if (foc) R(cg, 1, 1, cw - 2, ch - 2, { rx: 4, fill: 'none', stroke: cat.color, 'stroke-width': 1 });
    T(cg, 18, 9, cut(sp.l, 12), { size: 5.4, weight: 800, fill: foc ? cat.color : th.dim, ls: 0.3 });
    const vt = T(cg, 18, ch / 2 + 6, '', { size: 8.6, weight: 600, font: AH, fill: th.text });
    svg('path', { d: arcPath(cw - 16, ch / 2 + 2, 8.5, 0, 1), fill: 'none', stroke: th.line, 'stroke-width': 2.4, 'stroke-linecap': 'round' }, cg);
    const arc = svg('path', { d: '', fill: 'none', stroke: cat.color, 'stroke-width': 2.4, 'stroke-linecap': 'round' }, cg);
    s.vals.push((st2) => {
      const s2 = st2.slots[n.cur];
      if (!s2) return;
      const v = s2.v[idx] ?? sp.def;
      setText(vt, cut(N.specFmt(sp, v), 9));
      setA(arc, 'd', arcPath(cw - 16, ch / 2 + 2, 8.5, 0, N.specPos(sp, v)));
    });
    dialHit(s, x, y, cw, ch, b, n, idx);
  }
  s.swipe = (dir) => { const np2 = pagesOf(getSt(b), n.cur); n.pp = (((n.pp + dir) % np2) + np2) % np2; syncKnobs(b); };
}
// a touch dial: tap = focus, drag up / down = change, wheel = fine steps
function dialHit(s, x, y, w, h, b, n, idx) {
  let start = 0;
  hit(s, x, y, w, h, {
    down: () => { const st = getSt(b), p = slotParam(st, n.cur, idx); start = p ? N.specPos(p.sp, p.v) : 0; n.focus = { s: n.cur, i: idx }; },
    move: (pt, d) => { if (Math.abs(d.dy) > 2) setPos(b, n.cur, idx, start - d.dy / 90); },
    up: (pt, d, moved) => { if (!moved) { n.focus = { s: n.cur, i: idx }; s.sigS = ''; } else if (Math.abs(d.dx) > 40 && Math.abs(d.dx) > Math.abs(d.dy) * 1.5 && s.swipe) s.swipe(d.dx < 0 ? 1 : -1); },
    wheel: (dir) => { n.focus = { s: n.cur, i: idx }; stepParam(b, n.cur, idx, -dir); },
  });
}
// ---- block page: big touch dials
PAGES.blk = (s, g, st, n, th, b) => {
  const w = s.w, sl = st.slots[n.cur], m = sl && N.nxModel(sl.m);
  if (!m) return;
  const cat = N.NX_CAT[m.cat], np = Math.max(1, Math.ceil(m.knobs.length / 10));
  R(g, 0, 20, w, 30, { fill: cat.color, 'fill-opacity': 0.14 });
  R(g, 0, 20, 5, 30, { fill: cat.color });
  T(g, 12, 31, cut(m.name, 24).toUpperCase(), { font: AH, size: 11, weight: 600, fill: th.text, ls: 0.6 });
  T(g, 12, 43.5, n.cur + '  ·  ' + cat.name + (m.loop ? '  ·  SEND / RETURN ' + m.loop.map((k) => k + 1).join('+') : ''), { size: 5.4, weight: 800, fill: cat.color, ls: 0.8 });
  chip(s, g, 250, 26, 40, 16, sl.on ? 'ON' : 'OFF', th, { on: !!sl.on, color: cat.color, tap: () => { const x = getSt(b); x.slots[n.cur].on = x.slots[n.cur].on ? 0 : 1; captureScene(x); put(b, x, true); } });
  chip(s, g, 296, 26, 52, 16, 'MODEL', th, { tap: () => openLibrary(b, n, st) });
  chip(s, g, 354, 26, 52, 16, 'TO EXP 1', th, { size: 5.2, tap: () => assignFocusExp(b, 0) });
  chip(s, g, 412, 26, 52, 16, 'TO EXP 2', th, { size: 5.2, tap: () => assignFocusExp(b, 1) });
  chip(s, g, 470, 26, 82, 16, np > 1 ? `PAGE ${n.pp + 1} / ${np}  ▸` : 'PAGE 1 / 1', th, { size: 5.4, tap: () => { n.pp = (n.pp + 1) % np; syncKnobs(b); } });
  const cw = (w - 16) / 5, ch = 96;
  const tgt = [0, 1].map((i) => N.nxExpTarget(st, i));
  for (let i = 0; i < 10; i++) {
    const idx = n.pp * 10 + i, sp = m.knobs[idx];
    const x = 8 + (i % 5) * cw, y = 54 + Math.floor(i / 5) * ch;
    const cg = G(g, { transform: `translate(${x},${y})` });
    R(cg, 2, 2, cw - 4, ch - 4, { rx: 6, fill: th.panel });
    if (!sp) { T(cg, cw / 2, ch / 2, String(i + 1), { size: 7, weight: 800, anchor: 'middle', fill: th.line }); continue; }
    const foc = n.focus && n.focus.s === n.cur && n.focus.i === idx;
    if (foc) R(cg, 2, 2, cw - 4, ch - 4, { rx: 6, fill: 'none', stroke: cat.color, 'stroke-width': 1.4 });
    const isExp = tgt.map((t, e) => (t && t.tg && t.tg.some((q) => q.s === n.cur && q.i === idx) ? 'EXP ' + (e + 1) : null)).filter(Boolean)[0];
    T(cg, cw / 2, 12, cut(sp.l, 12), { size: 6.4, weight: 800, anchor: 'middle', fill: foc ? cat.color : th.dim, ls: 0.5 });
    if (isExp) T(cg, cw / 2, 21, isExp, { size: 4.8, weight: 800, anchor: 'middle', fill: th.acc, ls: 0.6 });
    svg('path', { d: arcPath(cw / 2, 52, 22, 0, 1), fill: 'none', stroke: th.line, 'stroke-width': 5, 'stroke-linecap': 'round' }, cg);
    const arc = svg('path', { d: '', fill: 'none', stroke: cat.color, 'stroke-width': 5, 'stroke-linecap': 'round' }, cg);
    const dot = svg('circle', { r: 3, fill: th.text }, cg);
    const vt = T(cg, cw / 2, 53, '', { font: AH, size: 10, weight: 600, anchor: 'middle', fill: th.text });
    T(cg, cw / 2, 84, String(i + 1), { size: 5, weight: 800, anchor: 'middle', fill: th.dim });
    s.vals.push((st2) => {
      const s2 = st2.slots[n.cur];
      if (!s2) return;
      const v = s2.v[idx] ?? sp.def, pos = N.specPos(sp, v);
      setText(vt, cut(N.specFmt(sp, v), 9));
      setA(arc, 'd', arcPath(cw / 2, 52, 22, 0, pos));
      const a = ((-135 + 270 * pos) * Math.PI) / 180;
      setA(dot, 'cx', (cw / 2 + Math.sin(a) * 22).toFixed(1)); setA(dot, 'cy', (52 - Math.cos(a) * 22).toFixed(1));
    });
    dialHit(s, x, y, cw, ch, b, n, idx);
  }
  s.swipe = (dir) => { n.pp = (((n.pp + dir) % np) + np) % np; syncKnobs(b); };
};
function assignFocusExp(b, e) {
  const st = getSt(b), n = nav(b), f = n.focus;
  if (!f || !slotParam(st, f.s, f.i)) return;
  const m = N.nxModel(st.slots[f.s].m);
  st.exp = st.exp || [];
  st.exp[e] = { t: 'par', s: f.s, i: f.i, blk: m.algo === 'wah' && f.i === 0 ? 1 : 0 };
  put(b, st, true);
  flash(b, `EXP ${e + 1}  ${f.s} ${m.knobs[f.i].l}`, 1000);
}
// ---- library
PAGES.lib = (s, g, st, n, th, b) => {
  const w = s.w;
  const rh = 16;
  N.NX_CATS.forEach((c, i) => {
    const y = 22 + i * rh, sel = n.lcat === i;
    R(g, 4, y + 1, 116, rh - 2, { rx: 3, fill: sel ? c.color : th.panel, 'fill-opacity': sel ? 0.95 : 1 });
    R(g, 8, y + 5, 5, rh - 10, { rx: 1, fill: c.color });
    T(g, 18, y + rh / 2 + 0.3, c.name, { size: 6, weight: 800, fill: sel ? th.ink : th.text, ls: 0.4 });
    hit(s, 4, y, 116, rh, { tap: () => { n.lcat = i; n.lscr = 0; n.lsel = 0; } });
  });
  const cat = N.NX_CATS[n.lcat] || N.NX_CATS[0];
  const list = N.nxModelsIn(cat.id);
  const cur = st.slots[n.cur] && st.slots[n.cur].m;
  T(g, 128, 29, 'LOAD INTO ' + n.cur, { size: 6.4, weight: 800, fill: th.text, ls: 0.6 });
  T(g, 214, 29, list.length + ' ' + cat.name + ' MODELS', { size: 5.2, weight: 700, fill: th.dim });
  if (st.slots[n.cur]) chip(s, g, w - 92, 22, 86, 14, 'REMOVE BLOCK', th, { size: 5.4, color: '#ff5a5a', tap: () => chooseModel(b, n, null) });
  const cols = 3, cw = (w - 132) / cols, chh = 30, rows = 6;
  const nr = Math.ceil(list.length / cols);
  const top = clamp(n.lscr | 0, 0, Math.max(0, nr - rows));
  if (!list.length) {
    T(g, 128 + (w - 132) / 2, 110, cat.id === 'nam' ? 'NO NAM OR IR PACKS INSTALLED' : 'NO MODELS', { size: 7, weight: 800, anchor: 'middle', fill: th.dim });
    if (cat.id === 'nam') T(g, 128 + (w - 132) / 2, 124, 'ADD THEM ON THE LIBRARY PAGE', { size: 6, weight: 700, anchor: 'middle', fill: th.dim });
  }
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const idx = (top + r) * cols + c, m = list[idx];
      if (!m) continue;
      const x = 128 + c * cw, y = 40 + r * (chh + 4);
      const loaded = m.id === cur, sel = (n.lsel | 0) === idx;
      R(g, x, y, cw - 4, chh, { rx: 5, fill: loaded ? cat.color : th.panel, stroke: sel ? th.text : cat.color, 'stroke-width': sel ? 1.4 : 0.6, 'stroke-opacity': sel ? 1 : 0.6 });
      T(g, x + 7, y + 11, cut(m.name, 20).toUpperCase(), { size: 6.2, weight: 800, fill: loaded ? th.ink : th.text, ls: 0.3 });
      T(g, x + 7, y + 22, loaded ? 'LOADED' : (m.loop ? 'SEND / RETURN' : m.algo.toUpperCase()), { size: 4.8, weight: 800, fill: loaded ? th.ink : th.dim, ls: 0.6 });
      hit(s, x, y, cw - 4, chh, { tap: () => chooseModel(b, n, m.id), wheel: (dir) => { n.lscr = clamp((n.lscr | 0) + dir, 0, Math.max(0, nr - rows)); } });
    }
  if (nr > rows) {
    const H = rows * (chh + 4) - 4;
    R(g, w - 4, 40, 2, H, { rx: 1, fill: th.line });
    R(g, w - 4, 40 + (H * top) / nr, 2, (H * rows) / nr, { rx: 1, fill: th.dim });
  }
  s.wheel = (dir) => { n.lscr = clamp((n.lscr | 0) + dir, 0, Math.max(0, nr - rows)); };
  s.swipe = (dir) => { n.lcat = (n.lcat + dir + N.NX_CATS.length) % N.NX_CATS.length; n.lscr = 0; n.lsel = 0; };
};
// ---- scenes
PAGES.scn = (s, g, st, n, th, b) => {
  const w = s.w;
  T(g, 8, 30, 'TAP A SCENE TO RECALL IT · TAP ITS NAME TO RENAME', { size: 5.6, weight: 800, fill: th.dim, ls: 0.4 });
  chip(s, g, w - 104, 23, 96, 14, 'COPY TO NEXT SCENE', th, { size: 5.2, tap: () => { const x = getSt(b); captureScene(x); const j = ((x.sc | 0) + 1) % 8; x.scenes[j] = N.clone(x.scenes[x.sc | 0]); x.sc = j; put(b, x, true); flash(b, 'COPIED TO SCENE ' + (j + 1), 900); } });
  for (let i = 0; i < 8; i++) {
    const x = 6 + (i % 4) * 137, y = 42 + Math.floor(i / 4) * 102;
    const active = (st.sc | 0) === i, sel = (n.ssel | 0) === i, col = N.NX_SCENE_COLS[i];
    R(g, x, y, 131, 96, { rx: 8, fill: active ? col : th.panel, 'fill-opacity': active ? 0.9 : 1, stroke: sel ? th.text : th.line, 'stroke-width': sel ? 1.6 : 1 });
    R(g, x, y, 131, 7, { rx: 3, fill: col });
    T(g, x + 12, y + 30, String(i + 1), { font: AH, size: 22, weight: 600, fill: active ? th.ink : th.text });
    const nm = (st.scn && st.scn[i]) || N.NX_SCENE_NAMES[i];
    T(g, x + 12, y + 58, cut(nm, 14), { size: 8, weight: 800, fill: active ? th.ink : col, ls: 0.6 });
    const sc = st.scenes && st.scenes[i];
    const ons = sc ? Object.keys(st.slots).filter((k) => sc.on[k]).length : 0;
    T(g, x + 12, y + 78, active ? 'ACTIVE' : ons + ' OF ' + Object.keys(st.slots).length + ' BLOCKS ON', { size: 5.6, weight: 800, fill: active ? th.ink : th.dim, ls: 0.4 });
    hit(s, x, y, 131, 96, { tap: () => { n.ssel = i; const z = getSt(b); recallScene(z, i); put(b, z, true); } });
    hit(s, x + 6, y + 48, 110, 20, { tap: () => { const z = getSt(b); z.scn = (z.scn || N.NX_SCENE_NAMES.slice()).slice(); const pool = N.NX_SCENE_NAMES.concat(['INTRO', 'BRIDGE', 'RHYTHM', 'BREAK', 'DRY', 'WET', 'BOOST', 'FINALE']); z.scn[i] = pool[(pool.indexOf(z.scn[i]) + 1) % pool.length]; put(b, z, true); } });
  }
};
// ---- presets
PAGES.pre = (s, g, st, n, th, b) => {
  const w = s.w, bank = n.bank | 0;
  N.NX_BANKS.forEach((bk, i) => chip(s, g, 8 + i * 70, 23, 64, 15, 'BANK ' + bk, th, { on: i === bank, size: 5.8, tap: () => { n.bank = i; } }));
  const sel = n.psel ?? (st.pi | 0);
  chip(s, g, w - 186, 23, 86, 15, 'SAVE HERE', th, { size: 5.6, color: th.acc, tap: () => savePreset(b, getSt(b), sel) });
  chip(s, g, w - 94, 23, 86, 15, 'LOAD', th, { size: 5.6, on: true, tap: () => { const z = getSt(b); captureScene(z); loadPresetInto(b, z, sel); put(b, z, true); flash(b, N.nxPresetLabel(z)); } });
  for (let r = 0; r < N.NX_PER_BANK; r++) {
    const pi = bank * N.NX_PER_BANK + r, y = 44 + r * 29;
    const active = (st.pi | 0) === pi, isSel = sel === pi;
    R(g, 6, y, w - 12, 26, { rx: 5, fill: active ? th.acc : th.panel, 'fill-opacity': active ? 0.9 : 1, stroke: isSel ? th.text : th.line, 'stroke-width': isSel ? 1.4 : 0.8 });
    T(g, 16, y + 13.4, N.NX_BANKS[bank] + (r + 1), { font: AH, size: 10, weight: 600, fill: active ? th.ink : th.acc });
    const nm = N.nxPresetName(st, pi);
    T(g, 46, y + 13.4, nm || 'EMPTY RIG', { size: 7.2, weight: 800, fill: active ? th.ink : nm ? th.text : th.dim, ls: 0.4 });
    const src = st.user && st.user[pi] ? 'USER' : N.NX_FACTORY[pi] ? 'FACTORY' : '';
    T(g, w - 18, y + 13.4, active ? 'LOADED' : src, { size: 5.4, weight: 800, anchor: 'end', fill: active ? th.ink : th.dim, ls: 0.6 });
    hit(s, 6, y, w - 12, 26, { tap: () => { if (n.psel === pi) { const z = getSt(b); captureScene(z); loadPresetInto(b, z, pi); put(b, z, true); flash(b, N.nxPresetLabel(z)); } n.psel = pi; } });
  }
  s.swipe = (dir) => { n.bank = (((n.bank | 0) + dir) % N.NX_BANKS.length + N.NX_BANKS.length) % N.NX_BANKS.length; };
};
// ---- looper
const LOOP_NAMES = ['EMPTY', 'RECORDING', 'PLAYING', 'OVERDUB', 'STOPPED'];
const LOOP_COLS = ['#7f8898', '#ff3b30', '#46d36f', '#ffb21f', '#e8ecf3'];
PAGES.lpr = (s, g, st, n, th, b) => {
  const w = s.w;
  const L = G(s.live);
  const stT = T(L, w / 2, 62, '', { font: AH, size: 30, weight: 700, anchor: 'middle', ls: 2 });
  R(g, 30, 92, w - 60, 10, { rx: 5, fill: th.panel2 });
  const bar = R(L, 30, 92, 0, 10, { rx: 5, fill: '#46d36f' });
  const len = T(L, w / 2, 114, '', { size: 6.6, weight: 700, anchor: 'middle', fill: th.dim });
  const bw = (w - 16) / 6;
  N.NX_LOOPER.slice(0, 6).forEach((l, f) => chip(s, g, 8 + f * bw, 134, bw - 6, 34, l, th, { size: 6.4, color: [LOOP_COLS[1], LOOP_COLS[2], th.line, '#3fb6ff', th.line, '#ff5a5a'][f], tap: () => looperFn(b, getSt(b), f) }));
  T(g, 8, 186, 'FOOTSWITCHES IN LOOPER MODE', { size: 5.6, weight: 800, fill: th.dim, ls: 0.6 });
  T(g, 8, 200, 'FS 1-6: ' + N.NX_LOOPER.slice(0, 6).join('  ·  ') + '  ·  FS 7: EXIT', { size: 5.6, weight: 700, fill: th.text });
  T(g, 8, 214, 'FS 8-14 keep their stomp assignments', { size: 5.6, weight: 700, fill: th.dim });
  chip(s, g, w - 150, 224, 142, 16, 'LOOP LEVEL ' + Math.round(((st.g && st.g.lpLvl) ?? 0.9) * 100) + '%  ·  TAP + / WHEEL', th, { size: 5.2, tap: () => { const z = getSt(b); z.g.lpLvl = ((Math.round(((z.g.lpLvl ?? 0.9) + 0.1) * 10) / 10) % 1.1); put(b, z); }, wheel: (dir) => { const z = getSt(b); z.g.lpLvl = clamp((z.g.lpLvl ?? 0.9) - dir * 0.05, 0, 1); put(b, z); } });
  let key = '';
  s.liveFn = (status) => {
    const t = status && status.lp && status.lp.looper && status.lp.looper.tracks && status.lp.looper.tracks[0];
    const sv = t ? t.state : 0;
    const k2 = sv + '|' + (t ? Math.round((t.pos || 0) * 200) : 0) + '|' + (t && t.rev ? 1 : 0);
    if (k2 === key) return;
    key = k2;
    setText(stT, LOOP_NAMES[sv] + (t && t.rev ? '  REV' : ''));
    setA(stT, 'fill', LOOP_COLS[sv]);
    const frac = t && sv === 1 ? (t.pos % 4) / 4 : t && t.len > 0 ? clamp(t.pos, 0, 1) : 0;
    setA(bar, 'width', ((w - 60) * frac).toFixed(1));
    setA(bar, 'fill', LOOP_COLS[sv]);
    setText(len, t && t.len > 0 ? (sv === 1 ? 'REC ' : 'LOOP ') + t.len.toFixed(1) + ' s  /  120 s' : 'TAP REC / DUB OR PRESS FS 1 TO RECORD');
  };
};
// ---- tuner
PAGES.tun = (s, g, st, n, th, b) => {
  const w = s.w;
  T(g, 8, 30, 'OUTPUT MUTED  ·  BACK OR HOLD TAP TO EXIT', { size: 5.6, weight: 800, fill: th.acc, ls: 0.6 });
  chip(s, g, w - 128, 23, 120, 15, 'REF ' + ((st.g && st.g.ref) || 440) + ' Hz  ·  TAP + / WHEEL', th, { size: 5.2, tap: () => { const z = getSt(b); z.g.ref = (z.g.ref || 440) >= 446 ? 432 : (z.g.ref || 440) + 1; put(b, z); }, wheel: (dir) => { const z = getSt(b); z.g.ref = clamp((z.g.ref || 440) - dir, 432, 446); put(b, z); } });
  const L = G(s.live);
  const note = T(L, w / 2, 92, '', { font: AH, size: 64, weight: 700, anchor: 'middle' });
  const ticks = [];
  for (let i = -12; i <= 12; i++) ticks.push(R(L, w / 2 + i * 18 - 2, i === 0 ? 150 : 154, 4, i === 0 ? 30 : i % 4 === 0 ? 22 : 14, { rx: 1.5, fill: th.line }));
  const cents = T(L, w / 2, 204, '', { size: 8, weight: 700, anchor: 'middle', fill: th.dim });
  let key = '';
  s.liveFn = (status) => {
    const tu = status && status.tu && status.tu.tuner;
    const nt = tu && tu.note, c = nt ? tu.cents || 0 : 0;
    const k2 = (nt || '-') + '|' + Math.round(c);
    if (k2 === key) return;
    key = k2;
    const ok = nt && Math.abs(c) < 3;
    setText(note, nt || '-');
    setA(note, 'fill', !nt ? th.dim : ok ? '#46d36f' : th.text);
    const pos = Math.round(clamp(c / 50, -1, 1) * 12);
    ticks.forEach((r, i) => { const k = i - 12; const lit = nt && (k === pos || (ok && k === 0)); setA(r, 'fill', lit ? (ok ? '#46d36f' : Math.abs(k) > 6 ? '#ff3b30' : th.acc) : th.line); });
    setText(cents, nt ? (c > 0 ? '+' : '') + c.toFixed(1) + ' cents' + (tu.freq ? '  ·  ' + tu.freq.toFixed(1) + ' Hz' : '') : 'PLAY A SINGLE NOTE');
  };
};
// ---- assignments overview + picker
PAGES.asg = (s, g, st, n, th, b, ui) => {
  const w = s.w, lp = statusOf(b).lp && statusOf(b).lp.looper;
  const sec = (y, t) => T(g, 8, y, t, { size: 5.4, weight: 800, fill: th.acc, ls: 1 });
  const cell = (it, idx, x, y, cw) => {
    const sel = (n.asel | 0) === idx;
    R(g, x, y, cw - 4, 24, { rx: 4, fill: th.panel, stroke: sel ? th.text : th.line, 'stroke-width': sel ? 1.4 : 0.8 });
    T(g, x + 6, y + 7.5, it.name, { size: 4.8, weight: 800, fill: th.dim, ls: 0.4 });
    T(g, x + 6, y + 17, cut(asgShort(st, it, lp, ui), Math.floor((cw - 12) / 3.9)), { size: 5.8, weight: 800, fill: th.text });
    hit(s, x, y, cw - 4, 24, { tap: () => { n.asel = idx; n.page = 'asgl'; n.lscr2 = 0; const list = asgChoices(getSt(b), it); n.lsel = Math.max(0, list.findIndex((c) => N.nxSameA(c.a, asgCurrent(getSt(b), it)))); n.lscr2 = clamp(n.lsel - 6, 0, Math.max(0, list.length - 14)); } });
  };
  sec(28, 'FLOOR FOOTSWITCHES (STOMP MODE)');
  const cw7 = (w - 12) / 7;
  for (let i = 0; i < 14; i++) cell(ASG_ITEMS[i], i, 8 + (i % 7) * cw7, 34 + Math.floor(i / 7) * 27, cw7);
  sec(96, 'TREADLE SWITCHES & EXT FOOTSWITCHES');
  const cw6 = (w - 12) / 6;
  for (let i = 14; i < 20; i++) cell(ASG_ITEMS[i], i, 8 + (i - 14) * cw6, 102, cw6);
  sec(136, 'EXPRESSION PEDALS');
  for (let i = 20; i < 24; i++) cell(ASG_ITEMS[i], i, 8 + (i - 20) * ((w - 12) / 4), 142, (w - 12) / 4);
  sec(176, 'SIDE SCREEN CONTROLS');
  for (let i = 24; i < 30; i++) cell(ASG_ITEMS[i], i, 8 + (i - 24) * cw6, 182, cw6);
  sec(214, 'CONTROL OUTPUTS');
  for (let i = 30; i < 32; i++) cell(ASG_ITEMS[i], i, 8 + (i - 30) * ((w - 12) / 2), 220, (w - 12) / 2);
};
PAGES.asgl = (s, g, st, n, th, b) => {
  const w = s.w, it = ASG_ITEMS[n.asel | 0], list = asgChoices(st, it), cur = asgCurrent(st, it);
  T(g, 8, 29, 'CHOOSE A FUNCTION FOR ' + it.name, { size: 6.2, weight: 800, fill: th.text, ls: 0.5 });
  chip(s, g, w - 66, 22, 58, 14, 'BACK', th, { size: 5.6, tap: () => { n.page = 'asg'; } });
  const rows = 14, top = clamp(n.lscr2 | 0, 0, Math.max(0, list.length - rows)), cols = 2, cw = (w - 16) / cols;
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const idx = top + c * rows + r, ch = list[idx];
      if (!ch) continue;
      const x = 8 + c * cw, y = 40 + r * 14.6;
      const on = N.nxSameA(ch.a, cur), sel = (n.lsel | 0) === idx;
      R(g, x, y, cw - 4, 13.4, { rx: 3, fill: on ? th.acc : th.panel, stroke: sel ? th.text : 'none', 'stroke-width': 1 });
      T(g, x + 7, y + 7, cut(ch.label, 46), { size: 6, weight: 700, fill: on ? th.ink : th.text });
      hit(s, x, y, cw - 4, 13.4, { tap: () => assignPick(b, getSt(b), it, ch), wheel: (dir) => { n.lscr2 = clamp((n.lscr2 | 0) + dir * 2, 0, Math.max(0, list.length - rows)); } });
    }
  if (list.length > rows * cols) T(g, w - 10, 244, `${top + 1}-${Math.min(list.length, top + rows * cols)} OF ${list.length} · WHEEL / SWIPE`, { size: 5, weight: 700, anchor: 'end', fill: th.dim });
  s.wheel = (dir) => { n.lscr2 = clamp((n.lscr2 | 0) + dir * 2, 0, Math.max(0, list.length - rows)); };
  s.swipe = (dir) => { n.lscr2 = clamp((n.lscr2 | 0) + dir * rows, 0, Math.max(0, list.length - rows)); };
};
// ---- I/O routing
PAGES.io = (s, g, st, n, th, b) => {
  const w = s.w, outs = N.nxOuts(st.g);
  T(g, 8, 28, 'INPUTS & PATHS', { size: 5.6, weight: 800, fill: th.acc, ls: 1 });
  T(g, 214, 28, 'OUTPUTS', { size: 5.6, weight: 800, fill: th.acc, ls: 1 });
  T(g, 300, 28, 'SOURCE', { size: 4.8, weight: 800, fill: th.dim, anchor: 'middle' });
  T(g, 370, 28, 'LEVEL', { size: 4.8, weight: 800, fill: th.dim, anchor: 'middle' });
  T(g, 430, 28, 'MASTER VOL', { size: 4.8, weight: 800, fill: th.dim, anchor: 'middle' });
  T(g, 500, 28, 'MONO JACK', { size: 4.8, weight: 800, fill: th.dim, anchor: 'middle' });
  IO_ROWS.forEach((r, idx) => {
    const sel = (n.isel | 0) === idx;
    if (r.out === undefined) {
      const y = 36 + idx * 26;
      R(g, 6, y, 200, 23, { rx: 4, fill: th.panel, stroke: sel ? th.text : th.line, 'stroke-width': sel ? 1.4 : 0.8 });
      T(g, 12, y + 7.5, r.l, { size: 5, weight: 800, fill: th.dim, ls: 0.4 });
      T(g, 12, y + 17, ioValue(st, r), { size: 6.6, weight: 800, fill: th.text });
      T(g, 198, y + 12, '-   +', { size: 6.6, weight: 800, anchor: 'end', fill: th.dim });
      hit(s, 6, y, 200, 23, { tap: (pt) => { n.isel = idx; ioStep(b, getSt(b), r, pt.x < 150 && !r.opts ? -1 : 1); }, wheel: (dir) => { n.isel = idx; ioStep(b, getSt(b), r, -dir); } });
      return;
    }
    const o = outs[r.out], y = 36 + r.out * 26;
    R(g, 212, y, w - 218, 23, { rx: 4, fill: th.panel, stroke: sel ? th.text : th.line, 'stroke-width': sel ? 1.4 : 0.8 });
    T(g, 218, y + 11.5, r.l, { size: 6, weight: 800, fill: th.text });
    const cells = [[300, N.NX_OUT_SRC[o.src | 0], 0], [370, (o.src | 0) === 4 ? '-' : dbF(o.lvl || 0), 1], [430, r.out === 6 || r.out === 7 ? 'OWN DIAL' : o.m ? 'FOLLOWS' : 'FIXED', 2], [500, r.out === 7 ? ['SUM', 'LEFT', 'RIGHT'][o.mono | 0] : '-', 3]];
    for (const [cx, t, col] of cells) {
      const live = !(col === 3 && r.out !== 7) && !(col === 2 && r.out >= 6);
      R(g, cx - 30, y + 4, 60, 15, { rx: 4, fill: live ? th.panel2 : th.panel, stroke: th.line, 'stroke-width': 0.6 });
      T(g, cx, y + 11.8, t, { size: 5.6, weight: 800, anchor: 'middle', fill: live ? th.text : th.dim });
      if (live) hit(s, cx - 30, y + 4, 60, 15, { tap: (pt) => { n.isel = idx; ioStep(b, getSt(b), r, col === 1 && pt.x < cx ? -1 : 1, col); }, wheel: (dir) => { n.isel = idx; ioStep(b, getSt(b), r, -dir, col); } });
    }
  });
  T(g, 214, 246, 'LEVEL: TAP LEFT / RIGHT HALF OR WHEEL  ·  SOURCE: TAP TO CYCLE', { size: 4.8, weight: 700, fill: th.dim });
};
// ---- global settings
PAGES.glb = (s, g, st, n, th, b) => {
  const w = s.w;
  GLOBAL_ROWS.forEach((r, i) => {
    const y = 23 + i * 17, sel = (n.gsel | 0) === i;
    R(g, 6, y, w - 12, 15, { rx: 3, fill: sel ? th.acc : th.panel, 'fill-opacity': sel ? 0.9 : 1 });
    T(g, 14, y + 7.8, r.l, { size: 6.4, weight: 800, fill: sel ? th.ink : th.text, ls: 0.4 });
    T(g, w - 96, y + 7.8, cut(globalValue(st, r), 24), { size: 6.2, weight: 700, anchor: 'middle', fill: sel ? th.ink : th.dim });
    T(g, w - 170, y + 7.8, '◀', { size: 6.2, weight: 700, anchor: 'middle', fill: sel ? th.ink : th.dim });
    T(g, w - 22, y + 7.8, '▶', { size: 6.2, weight: 700, anchor: 'middle', fill: sel ? th.ink : th.dim });
    const step = (dir) => { n.gsel = i; const z = getSt(b); globalStep(z, r, dir); put(b, z, true); };
    hit(s, 6, y, w - 12, 15, { tap: (pt) => step(pt.x >= w - 184 && pt.x < w - 140 ? -1 : 1), wheel: (dir) => step(-dir) });
  });
};

// ================================================================== TOP STRIPS (560 x 22, two of them)
registerScreen('nxl-strip', {
  build(s, g, w, h) {
    s.w = w; s.h = h;
    s.bg = R(g, 0, 0, w, h, { fill: '#03060a' });
    s.body = G(g);
    s.live = G(g);
    s.sig = '';
    s.hits = [];
  },
  update(s, status, view, now) {
    const b = view.block, ui = s.ui, st = N.nxState(ui), n = nav(b), row = s.ctl.row | 0;
    const g = Object.assign({}, N.NX_GLOBAL, st.g || {});
    const kind = (g.strip || [0, 1])[row] | 0;
    const menu = n.menu && n.menu[row];
    const th = themeOf(st);
    // what the strip shows: the static part is rebuilt on change, meters / tuner / pedals update in place
    const f = n.focus, fs = f && st.slots[f.s];
    const sig = [kind, menu, th.acc, kind === 0 ? [st.pi, st.name, st.sc, st.mode, JSON.stringify(st.scn)].join(',') : '', kind === 2 ? n.cur + (st.slots[n.cur] ? JSON.stringify(st.slots[n.cur]) : '') : '', kind === 5 ? N.NX_SLOTS.map((k) => (st.slots[k] ? st.slots[k].m + st.slots[k].on : '')).join(',') + st.route : '', kind === 3 ? g.bpm : '', kind === 4 ? JSON.stringify(st.exp) + JSON.stringify(st.slots) : ''].join('|');
    void fs;
    if (sig !== s.sig) {
      s.sig = sig;
      s.body.innerHTML = ''; s.live.innerHTML = ''; s.hits = []; s.liveFn = null;
      stripBuild(s, st, n, th, b, kind, menu, row, g, ui);
    }
    if (s.liveFn) s.liveFn(status, now, ui, st);
  },
  pointer(s, view, type, pt, e) { pointerOn(s, view, type, pt, e); s.sig = ''; },
});
function stripBuild(s, st, n, th, b, kind, menu, row, g, ui) {
  const w = s.w, h = s.h, G0 = s.body;
  // settings button at the right end: opens the content menu
  R(G0, w - 22, 3, 18, h - 6, { rx: 3, fill: menu ? th.acc : '#0d141c' });
  for (let i = 0; i < 3; i++) R(G0, w - 17, 7.5 + i * 3, 8, 1.2, { fill: menu ? th.ink : '#7790a3' });
  hit(s, w - 24, 0, 24, h, { tap: () => { n.menu = (n.menu || [false, false]).slice(); n.menu[row] = !n.menu[row]; } });
  if (menu) {
    const cw = (w - 30) / N.NX_STRIPS.length;
    N.NX_STRIPS.forEach((l, i) => {
      const on = i === kind;
      R(G0, 3 + i * cw, 3, cw - 4, h - 6, { rx: 3, fill: on ? th.acc : '#0d141c' });
      T(G0, 3 + i * cw + (cw - 4) / 2, h / 2 + 0.3, l, { size: 5.4, weight: 800, anchor: 'middle', fill: on ? th.ink : '#c8d4de' });
      hit(s, 3 + i * cw, 0, cw - 4, h, { tap: () => { const z = getSt(b); z.g.strip = (z.g.strip || [0, 1]).slice(); z.g.strip[row] = i; n.menu[row] = false; put(b, z); } });
    });
    return;
  }
  const W = w - 28, C = '#c8d4de', D = '#5e7183';
  const lab = (x, t, o = {}) => T(G0, x, h / 2 + 0.3, t, Object.assign({ size: 5.4, weight: 800, fill: D, ls: 0.6 }, o));
  if (kind === 0) {
    T(G0, 8, h / 2 + 0.6, cut(N.nxPresetLabel(st), 28), { font: AH, size: 10, weight: 600, fill: '#f2f6fa', ls: 0.6 });
    for (let i = 0; i < 8; i++) {
      const x = 230 + i * 30, on = (st.sc | 0) === i;
      R(G0, x, 4, 27, h - 8, { rx: 3, fill: on ? N.NX_SCENE_COLS[i] : '#0d141c', stroke: N.NX_SCENE_COLS[i], 'stroke-width': 0.6 });
      T(G0, x + 13.5, h / 2 + 0.3, String(i + 1), { size: 6.4, weight: 800, anchor: 'middle', fill: on ? '#05090d' : N.NX_SCENE_COLS[i] });
      hit(s, x, 0, 27, h, { tap: () => { const z = getSt(b); recallScene(z, i); put(b, z, true); } });
    }
    lab(W - 4, N.NX_MODES[st.mode | 0] + ' MODE', { anchor: 'end', fill: N.NX_MODE_COL[st.mode | 0] });
  } else if (kind === 1) {
    // levels: GUITAR, AUX, MAIN L/R, PHONES, XLR, SENDS
    const items = [['GTR', 'in', [0]], ['AUX', 'in', [1, 2]], ['ST 1', 'out', [0, 1]], ['ST 2', 'out', [2, 3]], ['PHONES', 'out', [12, 13]], ['XLR', 'out', [14]], ['SENDS', 'out', [15, 16, 17, 18]]];
    const iw = W / items.length, segs = [];
    items.forEach(([l, dir, chs], i) => {
      const x = 4 + i * iw;
      lab(x, l, { size: 4.8 });
      const bx = x + 26, bw = iw - 32, ns = 12, sw = bw / ns;
      const row2 = [];
      for (let k = 0; k < ns; k++) row2.push(R(G0, bx + k * sw, 6, sw - 1, h - 12, { rx: 0.8, fill: k >= 10 ? '#ff4d5e' : k >= 8 ? '#ffc24b' : '#37d6c2', 'fill-opacity': 0.12 }));
      segs.push({ dir, chs, row: row2, lit: -1 });
    });
    s.liveFn = (status) => {
      const io = status && status.io;
      if (!io) return;
      for (const sg of segs) {
        const pk = Math.max(0, ...sg.chs.map((c) => (io[sg.dir] && io[sg.dir][c]) || 0));
        const db = 20 * Math.log10(Math.max(1e-6, pk));
        const lit = Math.round(clamp((db + 54) / 54, 0, 1) * sg.row.length);
        if (lit === sg.lit) continue;
        sg.lit = lit;
        sg.row.forEach((r, k) => setA(r, 'fill-opacity', k < lit ? 1 : 0.12));
      }
    };
  } else if (kind === 2) {
    const sl = st.slots[n.cur], m = sl && N.nxModel(sl.m);
    if (!m) { lab(8, n.cur + '  ·  EMPTY SLOT'); return; }
    const col = N.NX_CAT[m.cat].color;
    R(G0, 3, 3, 4, h - 6, { rx: 1, fill: col });
    T(G0, 12, h / 2 + 0.3, n.cur + ' ' + cut(m.short, 9), { size: 6.6, weight: 800, fill: col });
    const per = 5, pw = (W - 90) / per;
    for (let i = 0; i < per; i++) {
      const sp = m.knobs[i];
      if (!sp) continue;
      const x = 90 + i * pw;
      lab(x, cut(sp.l, 9), { size: 4.8 });
      T(G0, x + pw - 6, h / 2 + 0.3, cut(N.specFmt(sp, sl.v[i] ?? sp.def), 8), { size: 6.2, weight: 700, anchor: 'end', fill: C, font: MONO });
    }
  } else if (kind === 3) {
    T(G0, 8, h / 2 + 0.6, Math.round(g.bpm || 120) + ' BPM', { font: AH, size: 10, weight: 600, fill: '#f2f6fa' });
    const dot = svg('circle', { cx: 80, cy: h / 2, r: 4, fill: '#ff3b5c', 'fill-opacity': 0.15 }, s.live);
    lab(96, g.sync ? 'DELAYS FOLLOW TEMPO' : 'TAP TO SET', { size: 4.8 });
    hit(s, 0, 0, 180, h, { tap: () => tapTempo(b) });
    const tn = T(s.live, 260, h / 2 + 0.3, '', { size: 7, weight: 800, fill: C });
    const bar = R(s.live, 330, 8, 0, h - 16, { rx: 2, fill: '#46d36f' });
    R(G0, 330, 8, 180, h - 16, { rx: 2, fill: 'none', stroke: '#1d2a36', 'stroke-width': 0.8 });
    R(G0, 419.5, 5, 1, h - 10, { fill: '#5e7183' });
    let key = '';
    s.liveFn = (status, now, ui2) => {
      const beat = now % (60000 / (g.bpm || 120)) < 90;
      const tu = status && status.tu && status.tu.tuner, nt = tu && tu.note, c = nt ? tu.cents || 0 : 0;
      const k2 = beat + '|' + (nt || '') + '|' + Math.round(c) + '|' + ((ui2._tuner ?? 0) > 0.5);
      if (k2 === key) return;
      key = k2;
      setA(dot, 'fill-opacity', beat ? 1 : 0.15);
      setText(tn, (ui2._tuner ?? 0) > 0.5 ? 'TUNER ' + (nt || '-') : 'TUNER OFF');
      const x = clamp(c / 50, -1, 1);
      setA(bar, 'x', (x < 0 ? 420 + x * 90 : 420).toFixed(1));
      setA(bar, 'width', (Math.abs(x) * 90 + (nt ? 1.5 : 0)).toFixed(1));
      setA(bar, 'fill', Math.abs(c) < 3 ? '#46d36f' : '#ff8a3d');
    };
  } else if (kind === 4) {
    const iw = W / 4, bars = [];
    for (let i = 0; i < 4; i++) {
      const x = 4 + i * iw, t = N.nxExpTarget(st, i);
      lab(x, N.NX_EXP_NAMES[i], { size: 4.8 });
      T(G0, x + 40, h / 2 + 0.3, cut(t ? t.name : 'NONE', 13), { size: 5, weight: 700, fill: C });
      R(G0, x + iw - 34, 7, 28, h - 14, { rx: 2, fill: '#0d141c' });
      bars.push({ r: R(s.live, x + iw - 34, 7, 0, h - 14, { rx: 2, fill: '#2ee6d6' }), x: x + iw - 34, i });
    }
    let key = '';
    s.liveFn = (status, now, ui2, st2) => {
      const vals = bars.map((x) => (ui2[N.NX_EXP_PARAMS[x.i]] ?? (x.i === 0 ? 1 : 0)));
      const k2 = vals.map((v) => Math.round(v * 50)).join(',') + N.nxExpOn(st2, 0) + N.nxExpOn(st2, 1);
      if (k2 === key) return;
      key = k2;
      bars.forEach((x, j) => { setA(x.r, 'width', (28 * vals[j]).toFixed(1)); setA(x.r, 'fill-opacity', N.nxExpOn(st2, x.i) ? 1 : 0.35); });
    };
  } else {
    lab(8, N.NX_ROUTES[N.nxRoute(st)], { fill: C });
    N.NX_SLOTS.forEach((k, i) => {
      const x = 70 + i * ((W - 70) / 16), sl = st.slots[k], m = sl && N.nxModel(sl.m);
      R(G0, x, 4, (W - 70) / 16 - 3, h - 8, { rx: 2, fill: m ? N.NX_CAT[m.cat].color : '#0d141c', 'fill-opacity': m ? (sl.on ? 1 : 0.3) : 1, stroke: k === n.cur ? '#fff' : 'none', 'stroke-width': 0.8 });
      if (m) T(G0, x + ((W - 70) / 16 - 3) / 2, h / 2 + 0.3, m ? k : '', { size: 4.6, weight: 800, anchor: 'middle', fill: sl.on ? '#05090d' : '#c8d4de' });
      hit(s, x, 0, (W - 70) / 16, h, { tap: () => { focusSlot(b, k); } });
    });
  }
}

// ================================================================== SIDE SCREEN (138 x 306, portrait)
registerScreen('nxl-side', {
  build(s, g, w, h) {
    s.w = w; s.h = h;
    s.bg = R(g, 0, 0, w, h, { fill: '#05080c' });
    s.body = G(g);
    s.sig = ''; s.vsig = '';
    s.hits = [];
  },
  update(s, status, view) {
    const b = view.block, ui = s.ui, st = N.nxState(ui), n = nav(b), th = themeOf(st);
    const tg = {};
    for (const k of N.NX_SIDE) tg[k] = N.nxSideTarget(st, k, n.focus);
    const sig = [th.acc, ...N.NX_SIDE.map((k) => (tg[k] ? tg[k].name : '-')), n.page].join('|');
    if (sig !== s.sig) { s.sig = sig; s.vsig = ''; s.body.innerHTML = ''; s.hits = []; s.vals = []; sideBuild(s, st, n, th, b, tg); }
    const vsig = ui._st + '|' + JSON.stringify(n.focus);
    if (vsig !== s.vsig) { s.vsig = vsig; for (const f of s.vals) f(st, tg); }
  },
  pointer(s, view, type, pt, e) { pointerOn(s, view, type, pt, e); },
});
function sideBuild(s, st, n, th, b, tg) {
  const w = s.w, g = s.body;
  const btn = (x, y, bw, bh, l, key, col) => {
    R(g, x, y, bw, bh, { rx: 4, fill: '#111a24', stroke: col || '#24364a', 'stroke-width': 0.8 });
    T(g, x + bw / 2, y + bh / 2 + 0.3, l, { size: 5.8, weight: 800, anchor: 'middle', fill: col || '#d6e2ec', ls: 0.6 });
    hit(s, x, y, bw, bh, { tap: () => navKey(b, key) });
  };
  btn(4, 4, 41, 20, 'HOME', 'home', th.acc); btn(48.5, 4, 41, 20, 'BACK', 'back'); btn(93, 4, 41, 20, 'SAVE', 'save', '#ff8a3d');
  btn(4, 27, 63, 18, '▲  UP', 'up'); btn(71, 27, 63, 18, '▼  DOWN', 'down');
  // drag-to-change helper for a target
  const dragHit = (x, y, bw, bh, key, axis = 'y', sens = 80) => {
    let start = 0;
    hit(s, x, y, bw, bh, {
      down: () => { start = sideValue(getSt(b), tg[key]) ?? 0; if (tg[key] && tg[key].s) n.focus = { s: tg[key].s, i: tg[key].i }; },
      move: (pt, d) => setSide(b, tg[key], start + (axis === 'y' ? -d.dy : d.dx) / sens),
      wheel: (dir) => setSide(b, tg[key], (sideValue(getSt(b), tg[key]) ?? 0) - dir * 0.02),
    });
  };
  // two LED-ring encoders
  for (const [k, cx] of [['e1', 36], ['e2', 102]]) {
    const cy = 78, t = tg[k];
    svg('circle', { cx, cy, r: 18, fill: '#0b1118', stroke: '#1d2a36', 'stroke-width': 1 }, g);
    const leds = [];
    for (let i = 0; i < 15; i++) {
      const a = ((-135 + (270 * i) / 14) * Math.PI) / 180;
      leds.push(svg('circle', { cx: (cx + Math.sin(a) * 24).toFixed(2), cy: (cy - Math.cos(a) * 24).toFixed(2), r: 1.8, fill: th.acc, 'fill-opacity': 0.12 }, g));
    }
    const knob = svg('circle', { cx, cy, r: 13, fill: '#1a2430', stroke: '#2b3b4c', 'stroke-width': 1 }, g);
    const tick = svg('path', { d: '', stroke: '#e8f1f8', 'stroke-width': 1.6, 'stroke-linecap': 'round' }, g);
    const vt = T(g, cx, cy + 0.5, '', { size: 5, weight: 800, anchor: 'middle', fill: '#e8f1f8' });
    T(g, cx, cy + 33, k === 'e1' ? 'ENC 1' : 'ENC 2', { size: 4.6, weight: 800, anchor: 'middle', fill: '#5e7183', ls: 0.6 });
    T(g, cx, cy + 40, cut(t ? t.name.replace(/^[AB]\d /, '') : 'NONE', 13), { size: 4.8, weight: 700, anchor: 'middle', fill: '#c8d4de' });
    void knob;
    s.vals.push((st2, tg2) => {
      const v = sideValue(st2, tg2[k]);
      const lit = v == null ? -1 : Math.round(v * 14);
      leds.forEach((l, i) => setA(l, 'fill-opacity', i <= lit ? 1 : 0.12));
      const a = ((-135 + 270 * (v ?? 0)) * Math.PI) / 180;
      setA(tick, 'd', `M${(cx + Math.sin(a) * 6).toFixed(1)} ${(cy - Math.cos(a) * 6).toFixed(1)}L${(cx + Math.sin(a) * 11.5).toFixed(1)} ${(cy - Math.cos(a) * 11.5).toFixed(1)}`);
      const x = tg2[k] && tg2[k].s ? slotParam(st2, tg2[k].s, tg2[k].i) : null;
      setText(vt, x ? cut(N.specFmt(x.sp, x.v), 7) : v == null ? '' : Math.round(v * 200) + '%');
    });
    dragHit(cx - 28, cy - 28, 56, 56, k);
  }
  // XY pad
  const px = 6, py = 128, pw = w - 12, ph = 80;
  R(g, px, py, pw, ph, { rx: 5, fill: '#0b1118', stroke: '#1d2a36', 'stroke-width': 1 });
  for (let i = 1; i < 4; i++) {
    R(g, px + (pw * i) / 4, py + 2, 0.5, ph - 4, { fill: '#16222e' });
    R(g, px + 2, py + (ph * i) / 4, pw - 4, 0.5, { fill: '#16222e' });
  }
  T(g, px + 4, py + 6, 'X ' + cut(tg.x ? tg.x.name.replace(/^[AB]\d /, '') : 'NONE', 15), { size: 4.4, weight: 800, fill: '#5e7183' });
  T(g, px + pw - 4, py + ph - 5, 'Y ' + cut(tg.y ? tg.y.name.replace(/^[AB]\d /, '') : 'NONE', 15), { size: 4.4, weight: 800, anchor: 'end', fill: '#5e7183' });
  const cx1 = R(g, px, py, 0.8, ph, { fill: th.acc, 'fill-opacity': 0.5 }), cy1 = R(g, px, py, pw, 0.8, { fill: th.acc, 'fill-opacity': 0.5 });
  const dot = svg('circle', { r: 4.5, fill: th.acc, stroke: '#fff', 'stroke-width': 1 }, g);
  s.vals.push((st2, tg2) => {
    const vx = sideValue(st2, tg2.x) ?? 0.5, vy = sideValue(st2, tg2.y) ?? 0.5;
    const x = px + 4 + vx * (pw - 8), y = py + ph - 4 - vy * (ph - 8);
    setA(dot, 'cx', x.toFixed(1)); setA(dot, 'cy', y.toFixed(1));
    setA(cx1, 'x', x.toFixed(1)); setA(cy1, 'y', y.toFixed(1));
  });
  const xyAt = (pt) => {
    const vx = clamp((pt.x - px - 4) / (pw - 8), 0, 1), vy = clamp((py + ph - 4 - pt.y) / (ph - 8), 0, 1);
    const z = getSt(b);
    for (const [t, v] of [[tg.x, vx], [tg.y, vy]]) {
      if (!t) continue;
      if (t.mix) { z.mix = Object.assign({ a: 1, b: 1, ap: 0, bp: 0 }, z.mix || {}); z.mix[t.mix] = Math.round(v * 200) / 100; }
      else { const q = slotParam(z, t.s, t.i); if (q) q.sl.v[t.i] = N.specTo(q.sp, v); }
    }
    captureScene(z); put(b, z);
  };
  hit(s, px, py, pw, ph, { down: xyAt, move: xyAt });
  // two sliders and the select encoder
  for (const [k, sx] of [['s1', 14], ['s2', 44]]) {
    const sy = 218, sh = 64, t = tg[k];
    R(g, sx - 2, sy, 4, sh, { rx: 2, fill: '#0b1118', stroke: '#1d2a36', 'stroke-width': 0.6 });
    const fill = R(g, sx - 2, sy + sh, 4, 0, { rx: 2, fill: th.acc });
    const cap = R(g, sx - 9, sy, 18, 7, { rx: 2, fill: '#c8d4de', stroke: '#000', 'stroke-width': 0.5 });
    T(g, sx, sy + sh + 8, k === 's1' ? 'S1' : 'S2', { size: 4.6, weight: 800, anchor: 'middle', fill: '#5e7183' });
    T(g, sx, sy + sh + 15, cut(t ? t.name.replace(/^[AB]\d /, '').replace('PATH ', '') : 'NONE', 7), { size: 4.2, weight: 700, anchor: 'middle', fill: '#c8d4de' });
    s.vals.push((st2, tg2) => {
      const v = sideValue(st2, tg2[k]) ?? 0;
      setA(cap, 'y', (sy + sh - 3.5 - v * sh).toFixed(1));
      setA(fill, 'y', (sy + sh - v * sh).toFixed(1)); setA(fill, 'height', (v * sh).toFixed(1));
    });
    const at = (pt) => setSide(b, tg[k], (sy + sh - pt.y) / sh);
    hit(s, sx - 13, sy - 6, 26, sh + 12, { down: at, move: at, wheel: (dir) => setSide(b, tg[k], (sideValue(getSt(b), tg[k]) ?? 0) - dir * 0.02) });
  }
  // select encoder: turn (drag / wheel) = up / down, tap = enter
  const ex = 100, ey = 248;
  svg('circle', { cx: ex, cy: ey, r: 26, fill: '#0b1118', stroke: '#1d2a36', 'stroke-width': 1 }, g);
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    svg('path', { d: `M${(ex + Math.sin(a) * 19).toFixed(1)} ${(ey - Math.cos(a) * 19).toFixed(1)}L${(ex + Math.sin(a) * 23).toFixed(1)} ${(ey - Math.cos(a) * 23).toFixed(1)}`, stroke: '#2b3b4c', 'stroke-width': 1.4 }, g);
  }
  const knob = G(g, { transform: `rotate(${((n.encA || 0) * 15) % 360} ${ex} ${ey})` });
  svg('circle', { cx: ex, cy: ey, r: 16, fill: '#1a2430', stroke: '#33475b', 'stroke-width': 1 }, knob);
  svg('path', { d: `M${ex} ${ey - 13}V${ey - 7}`, stroke: th.acc, 'stroke-width': 2, 'stroke-linecap': 'round' }, knob);
  T(g, ex, ey + 0.5, 'PUSH', { size: 4.6, weight: 800, anchor: 'middle', fill: '#c8d4de' });
  T(g, ex, ey + 33, 'SELECT', { size: 4.6, weight: 800, anchor: 'middle', fill: '#5e7183', ls: 0.6 });
  const enc = (dir) => { n.encA = (n.encA || 0) + dir; setA(knob, 'transform', `rotate(${(n.encA * 15) % 360} ${ex} ${ey})`); navKey(b, dir < 0 ? 'up' : 'down'); };
  let acc = 0;
  hit(s, ex - 28, ey - 28, 56, 56, {
    down: () => { acc = 0; },
    move: (pt, d) => { const step = 14 / ([0.6, 1, 1.8][(st.g && st.g.encSens) ?? 1] || 1); const k = Math.trunc((d.dy - acc) / step); if (k) { acc += k * step; enc(k > 0 ? 1 : -1); } },
    up: (pt, d, moved) => { if (!moved) navKey(b, 'enter'); },
    wheel: (dir) => enc(dir),
  });
}

// ================================================================== FOOTSWITCH LCDs (84 x 22) and pedal LCDs (116 x 24)
registerScreen('nxl-fs', {
  build(s, g, w, h) {
    s.w = w; s.h = h;
    s.bg = R(g, 0, 0, w, h, { fill: '#05070a' });
    s.bar = R(g, 0, 0, 3.5, h, { fill: '#2a2f38' });
    s.num = T(g, 7, 6, '', { size: 4.6, weight: 800, fill: '#6b7686', font: AF });
    s.sub = T(g, w - 4, 6, '', { size: 4.4, weight: 800, anchor: 'end', fill: '#6b7686' });
    s.t = T(g, w / 2 + 1.5, 15, '', { size: 7.4, weight: 800, anchor: 'middle', ls: 0.3 });
    s.sig = '';
  },
  update(s, status, view) {
    const ui = s.ui, st = N.nxState(ui), i = s.ctl.idx | 0;
    const f = N.nxFsInfo(st, i, { lp: status && status.lp && status.lp.looper, tuner: (ui._tuner ?? 0) > 0.5, xfo: nav(view.block).xfoV });
    const br = ((st.g && st.g.fsB) ?? 1) | 0;
    const sig = f.label + '|' + f.sub + '|' + f.color + '|' + f.lit + '|' + br;
    if (sig === s.sig) return;
    s.sig = sig;
    const k = [0.45, 0.75, 1][br];
    setText(s.num, i < 14 ? 'FS ' + (i + 1) : 'SW');
    setText(s.sub, cut(f.sub, 12));
    setText(s.t, cut(f.label, 12));
    setA(s.t, 'fill', f.lit ? f.color : '#8f99a8');
    setA(s.t, 'fill-opacity', f.lit ? k : k * 0.8);
    setA(s.bar, 'fill', f.color);
    setA(s.bar, 'fill-opacity', f.lit ? k : 0.25);
    setA(s.bg, 'fill', f.lit ? '#0f1a22' : '#05070a');
  },
});
registerScreen('nxl-exp', {
  build(s, g, w, h) {
    s.w = w; s.h = h;
    R(g, 0, 0, w, h, { fill: '#05070a' });
    s.name = T(g, 5, 6.5, '', { size: 4.8, weight: 800, fill: '#6b7686' });
    s.tg = T(g, w - 5, 6.5, '', { size: 4.8, weight: 800, anchor: 'end', fill: '#9fb0c0' });
    R(g, 5, 13, w - 40, 6.5, { rx: 2, fill: '#121820' });
    s.bar = R(g, 5, 13, 0, 6.5, { rx: 2, fill: '#2ee6d6' });
    s.v = T(g, w - 5, 16.5, '', { size: 6.4, weight: 800, anchor: 'end', fill: '#e8f1f8', font: MONO });
    s.sig = '';
  },
  update(s) {
    const ui = s.ui, st = N.nxState(ui), i = s.ctl.idx | 0;
    const v = clamp(ui[N.NX_EXP_PARAMS[i]] ?? (i === 0 ? 1 : 0), 0, 1), t = N.nxExpTarget(st, i), on = N.nxExpOn(st, i);
    const sig = Math.round(v * 100) + '|' + (t ? t.name : '') + '|' + on;
    if (sig === s.sig) return;
    s.sig = sig;
    setText(s.name, N.NX_EXP_NAMES[i] + (on ? '' : '  OFF'));
    setText(s.tg, cut(t ? t.name : 'NOT ASSIGNED', 16));
    setA(s.bar, 'width', ((s.w - 40) * v).toFixed(1));
    setA(s.bar, 'fill-opacity', on && t ? 1 : 0.3);
    setText(s.v, Math.round(v * 100) + '%');
  },
});

// ================================================================== I/O LED BARS (one bar per jack, brightness = level)
const JACK_CH = (key) => {
  const m = /^(i|o)(\d+)$/.exec(key);
  if (!m) return null;
  return m[1] === 'i' ? { dir: 'in', chs: N.NX_IN_CH[+m[2]] } : { dir: 'out', chs: N.NX_OUT_CH[+m[2]] };
};
registerScreen('nxl-io', {
  build(s, g) {
    s.bars = [];
    for (const j of s.ctl.bars || []) {
      const io = JACK_CH(j.key);
      const col = /^ic|^oc/.test(j.key) ? '#b58bff' : io && (j.label.startsWith('SEND') || j.label.startsWith('RETURN')) ? '#ffb340' : io && io.dir === 'in' ? '#2ee6d6' : '#46d36f';
      const n = io ? io.chs.length : 1, bw = n > 1 ? 6 : 12;
      const rects = [];
      for (let k = 0; k < n; k++) {
        const x = j.x - (n * bw + (n - 1) * 1.5) / 2 + k * (bw + 1.5);
        R(g, x - 0.5, 2.5, bw + 1, 4, { rx: 1.5, fill: '#000', 'fill-opacity': 0.6 });
        rects.push(R(g, x, 3, bw, 3, { rx: 1.2, fill: col, 'fill-opacity': 0.1 }));
      }
      s.bars.push({ key: j.key, io, rects, col, q: [] });
    }
  },
  update(s, status, view) {
    const io = status && status.io, ui = s.ui;
    const ctlVal = (key) => {
      const m = /^(ic|oc)(\d)$/.exec(key);
      if (!m) return 0;
      if (m[1] === 'ic') { const i = +m[2]; return i < 4 ? ui['_xfs' + (i + 1)] ?? 0 : ui['_xexp' + (i - 3)] ?? 0; }
      return +m[2] === 0 ? (nav(view.block).xfoV ? 1 : 0) : ui._xeo ?? 0;
    };
    for (const bar of s.bars) {
      bar.rects.forEach((r, k) => {
        let lv;
        if (bar.io) {
          const pk = io && io[bar.io.dir] ? io[bar.io.dir][bar.io.chs[k]] || 0 : 0;
          const db = 20 * Math.log10(Math.max(1e-6, pk));
          lv = pk > 0.98 ? 2 : clamp((db + 60) / 60, 0, 1);
        } else lv = clamp(ctlVal(bar.key), 0, 1);
        const q = lv === 2 ? 99 : Math.round(lv * 10);
        if (bar.q[k] === q) return;
        bar.q[k] = q;
        setA(r, 'fill', q === 99 ? '#ff3b30' : bar.col);
        setA(r, 'fill-opacity', q === 99 ? 1 : (0.1 + 0.9 * Math.pow(q / 10, 1.4)).toFixed(2));
      });
    }
  },
});
