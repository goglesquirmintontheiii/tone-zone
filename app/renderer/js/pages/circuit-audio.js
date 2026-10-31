// Script audio, the engine side of the bridge in screenscript/host.js (see the contract there): screen scripts
// read analysis of a custom pedal's audio jacks and start voices, processors and sample buffers in the engine's
// patch block. Commands (docs/engine-blocks.md, patch):
//   {cmd: 'scope', id, what, jacks, bands, wave, span, sync}   status blocks[id].scope[<jack id>]
//   {cmd: 'voice', id, v, ...} / {cmd: 'fx', id, f, ...}        v, f: 0..31 per block, {stop: true} ends one
//   {cmd: 'sample', id, slot, sr, b64, fmt: 's16'}              slots 1..8 are the circuit samplers', 9..32 scripts'
// The engine keeps what was sent and hands it to a rebuilt block, so this side only tracks ids and slots.
import { setAudioBackend } from '../screenscript/host.js';
import { audioJacks } from '../screenscript/audio.js';
import { state } from '../state.js';

const VOICES = 32, FXS = 32, SLOT0 = 9, SLOTS = 32;
const ANALYSIS_IDLE = 3000; // ms without a script asking: the engine stops analysing
let tap = null; // tests: see the commands instead of sending them
const send = (cmd) => {
  try {
    if (tap) tap(cmd);
    else if (window.tz && window.tz.engine) window.tz.engine.send(cmd);
  } catch (_) {
    /* no engine */
  }
};

// per engine block: what the scripts on it made
const blocks = new Map();
function blk(id) {
  let b = blocks.get(id);
  if (!b) blocks.set(id, (b = { voices: new Map(), fx: new Map(), bufs: new Map(), owner: new Map(), scope: null, asked: 0, jacksAsked: new Set() }));
  return b;
}
const freeIdx = (m, n) => {
  const used = new Set(m.values());
  for (let i = 0; i < n; i++) if (!used.has(i)) return i;
  return -1;
};
function jackId(ctx, j) {
  if (!j) return null;
  if (j.id) return j.id;
  const list = audioJacks(ctx.design);
  const hit = list.find((x) => x.dir === (j.dir || 'out') && x.index === (j.index || 0));
  return hit ? hit.id : null;
}
function target(ctx, to) {
  if (to && to.circuit !== undefined) return { part: String(to.circuit || '') };
  const id = jackId(ctx, to || { dir: 'out', index: 0 });
  return id ? { jack: id } : null;
}
const owned = (b, ctx, key) => b.owner.set(key, ctx.screen || '');

// ------------------------------------------------------------------ analysis
// resample a list to n points (linear)
function resample(a, n) {
  if (!Array.isArray(a) || !a.length) return [];
  if (a.length === n) return a.slice();
  const out = new Array(n);
  for (let i = 0; i < n; i++) {
    const x = n === 1 ? 0 : (i * (a.length - 1)) / (n - 1);
    const k = Math.floor(x), f = x - k;
    out[i] = k + 1 < a.length ? a[k] + (a[k + 1] - a[k]) * f : a[a.length - 1];
  }
  return out;
}
function askScope(ctx, b, jk, want) {
  const bands = Math.max(want.bands || 32, b.scope ? b.scope.bands : 0);
  const wave = Math.max(want.wave || 128, b.scope ? b.scope.wave : 0);
  b.asked = Date.now();
  if (b.scope && b.scope.bands === bands && b.scope.wave === wave && b.jacksAsked.has(jk)) return;
  b.jacksAsked.add(jk);
  b.scope = { bands, wave };
  // raw samples, newest last (the contract's wave)
  send({ cmd: 'scope', id: ctx.blockId, what: ['level', 'spec', 'wave', 'pitch'], jacks: [...b.jacksAsked], bands, wave, span: wave, sync: false });
}
function analysis(ctx, jack, want = {}) {
  if (!ctx.blockId) return null;
  const jk = jackId(ctx, jack);
  if (!jk) return null;
  const b = blk(ctx.blockId);
  askScope(ctx, b, jk, want);
  const st = state.status && state.status.blocks ? state.status.blocks[ctx.blockId] : null;
  const s = st && st.scope && st.scope[jk];
  if (!s) return null;
  const nb = want.bands || 32, nw = want.wave || 128;
  return {
    rms: s.rms ?? 0,
    peak: s.peak ?? 0,
    bands: resample((s.spec || []).map((db) => Math.max(0, Math.min(1, (db + 72) / 72))), nb),
    wave: resample(s.wave || [], nw),
    pitch: s.hz || 0,
    onset: s.onset || 0,
  };
}
// nobody asked for a while: stop analysing (and forget blocks that are gone)
let timer = null;
function tick() {
  const now = Date.now();
  for (const [id, b] of blocks) {
    if (b.scope && now - b.asked > ANALYSIS_IDLE) {
      send({ cmd: 'scope', id, on: false });
      b.scope = null;
      b.jacksAsked.clear();
    }
    const gone = state.preset && Array.isArray(state.preset.blocks) && !state.preset.blocks.some((x) => x.id === id) && !(state.status && state.status.blocks && state.status.blocks[id]);
    if (gone && !b.scope && !b.voices.size && !b.fx.size) blocks.delete(id);
  }
}

// ------------------------------------------------------------------ generators, processors, buffers
const num = (v, d) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
function slotFor(ctx, b, id) {
  if (id === undefined || id === null) return 0;
  const raw = String(id);
  const tail = raw.includes(':') ? raw.slice(raw.lastIndexOf(':') + 1) : raw;
  if (/^[1-8]$/.test(tail)) return +tail; // a circuit sampler's slot
  return b.bufs.get(raw) || b.bufs.get((ctx.screen || '') + ':' + raw) || 0;
}
function gen(ctx, id, p = {}) {
  if (!ctx.blockId) return false;
  const b = blk(ctx.blockId);
  let v = b.voices.get(id);
  if (v === undefined) {
    v = freeIdx(b.voices, VOICES);
    if (v < 0) return false;
    b.voices.set(id, v);
    owned(b, ctx, 'g' + id);
  }
  const to = target(ctx, p.to);
  if (!to) return false;
  const env = ['attack', 'decay', 'sustain', 'release', 'gate'].some((k) => p[k] !== undefined);
  send({
    cmd: 'voice', id: ctx.blockId, v, type: p.type || 'sine', to,
    freq: num(p.freq, 220), amp: num(p.amp, 0.5), pw: num(p.pw, 0.5), pan: num(p.pan, 0),
    env, gate: p.gate !== false, attack: num(p.attack, 0.005), decay: num(p.decay, 0.1), sustain: num(p.sustain, 1), release: num(p.release, 0.05),
    trig: num(p.trig, 0), slot: slotFor(ctx, b, p.buffer), loop: !!p.loop, rate: num(p.rate, 1), start: num(p.start, 0),
  });
  return true;
}
function fx(ctx, id, p = {}) {
  if (!ctx.blockId) return false;
  const b = blk(ctx.blockId);
  const jk = jackId(ctx, p.jack || { dir: 'out', index: 0 });
  if (!jk) return false;
  let f = b.fx.get(id);
  if (f === undefined) {
    f = freeIdx(b.fx, FXS);
    if (f < 0) return false;
    b.fx.set(id, f);
    owned(b, ctx, 'f' + id);
  }
  send({ cmd: 'fx', id: ctx.blockId, f, type: p.type || 'gain', jack: jk, gain: num(p.gain, 1), freq: num(p.freq, 1000), q: num(p.q, 0.7), amount: num(p.amount, 0.5), mix: num(p.mix, 1) });
  return true;
}
function stop(ctx, id) {
  if (!ctx.blockId) return;
  const b = blk(ctx.blockId);
  if (b.voices.has(id)) send({ cmd: 'voice', id: ctx.blockId, v: b.voices.get(id), stop: true });
  if (b.fx.has(id)) send({ cmd: 'fx', id: ctx.blockId, f: b.fx.get(id), stop: true });
  b.voices.delete(id);
  b.fx.delete(id);
  b.owner.delete('g' + id);
  b.owner.delete('f' + id);
}
// Float32Array (-1..1) to base64 of little endian int16
function b64s16(x) {
  const bytes = new Uint8Array(x.length * 2);
  const dv = new DataView(bytes.buffer);
  for (let i = 0; i < x.length; i++) dv.setInt16(2 * i, Math.round(Math.max(-1, Math.min(1, x[i] || 0)) * 32767), true);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
function buffer(ctx, id, samples, rate) {
  if (!ctx.blockId) return false;
  const b = blk(ctx.blockId);
  const tail = String(id).includes(':') ? String(id).slice(String(id).lastIndexOf(':') + 1) : String(id);
  let slot = /^[1-8]$/.test(tail) ? +tail : b.bufs.get(id);
  if (!slot) {
    const used = new Set(b.bufs.values());
    for (let s = SLOT0; s <= SLOTS && !slot; s++) if (!used.has(s)) slot = s;
    if (!slot) return false;
  }
  b.bufs.set(id, slot);
  owned(b, ctx, 'b' + id);
  send({ cmd: 'sample', id: ctx.blockId, slot, sr: num(rate, 48000), b64: b64s16(samples || []), fmt: 's16' });
  return true;
}
function reset(ctx) {
  if (!ctx.blockId) return;
  const b = blk(ctx.blockId);
  const mine = (k) => (b.owner.get(k) || '') === (ctx.screen || '');
  for (const id of [...b.voices.keys()]) if (mine('g' + id)) stop(ctx, id);
  for (const id of [...b.fx.keys()]) if (mine('f' + id)) stop(ctx, id);
  for (const [id, slot] of [...b.bufs]) {
    if (!mine('b' + id)) continue;
    if (slot >= SLOT0) send({ cmd: 'sample', id: ctx.blockId, slot, clear: true });
    b.bufs.delete(id);
    b.owner.delete('b' + id);
  }
}

/** Register the backend (once, from catalog/custom.js). */
export function installScriptAudio() {
  if (timer) return;
  timer = setInterval(tick, 1000);
  // after the module graph has loaded (host.js may still be loading when this runs)
  setTimeout(() => setAudioBackend({ analysis, gen, fx, stop, buffer, reset }), 0);
}
// for tests
export const _scriptAudio = { blocks, analysis, gen, fx, stop, buffer, reset, resample, tap: (fn) => (tap = fn) };
