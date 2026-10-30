// scriptHost: the bridge between a screen script and its pedal. Scripts talk to controls by name and to the
// circuit through signals (things they can read) and inputs (things they can write).
//
// Bridge interface (every host has these):
//   controls()             -> [{ name, kind, id }]  kind = knob | switch | button | foot | dip
//   getControl(name)       -> knob 0..1, switch position 1..n, true / false for buttons, DIPs and footswitches
//   setControl(name, v)    -> goes through the app's normal path (board: setParam, so it is saved and undoable)
//   getSignal(name)        -> number (or string for a few) or undefined
//   setInput(name, v)      -> true when something took the value
//   signals()              -> names a script can read
//   screenInput(i)         -> the value wired into this screen's input i (1-based number or its name)
//   screenOutput(i, v)     -> set this screen's output i (drives the circuit inputs wired to it)
//   screenPorts()          -> { ins: [{name, sig}], outs: [{name, sig}] }
// New circuit signals plug in with addSignalSource() / addInputSink() below, without touching this file.
// io.cid is the id of the screen the host runs (for its inputs and outputs).
//   files                  -> the pedal's FileStore (files.js), shared by all its screens; null when there is none
//   codeFile(path)         -> the text of a code file saved with the design (require), or null
//   audio                  -> script audio, below
//
// ---- Script audio: the contract with the engine side
// Lua runs in the renderer at the screen's frame rate (20 to 30 a second), so it never touches samples. It reads
// analysis the engine reports and drives engine side generators, sample players and simple processors by id.
// The engine side registers a backend with setAudioBackend(backend) (circuit code, not this folder). Without one
// the board falls back to the level meters (gen, buffer and fx give false), and the code editor preview uses a
// fake (audio.js) with a demo guitar and the script's own generators.
//
//   backend.analysis(ctx, jack, want) -> { rms, peak, bands, wave, pitch, onset } or null
//       jack = { dir: 'in' | 'out', index, name, id } (index: the block's audio port, inputs and outputs counted
//       apart, main output first, as jackList() in factory-circuit.js). want = { bands: 4..64, wave: 16..1024 }.
//       rms and peak 0..1, bands 0..1 (log spaced centres from 40 Hz to 16 kHz, a dB scale from -72 to 0),
//       wave the last samples (-1..1, newest last), pitch in Hz (0 = none), onset a counter that goes up at
//       each note start. Called at most once per jack per frame; values from the last status are fine.
//   backend.gen(ctx, id, params) -> true when taken. Start or update a generator. Sent only when params change.
//       params = { type: sine | square | saw | tri | pulse | noise | sample, freq (Hz), amp (0..1), pw (0..1),
//         attack, decay, release (seconds), sustain (0..1), gate (true starts the envelope, false releases it;
//         with no envelope fields and no gate it just plays), trig (a counter: each new value restarts the
//         note or the sample), buffer (a buffer id, for sample), loop (bool), rate (1 = as written), start (0..1),
//         pan (-1..1), to: { dir: 'out', index } (added to that output after the circuit) | { dir: 'in', index }
//         (added to that input before the circuit) | { circuit: name } (a circuit input part for script audio,
//         by its name) }
//   backend.stop(ctx, id)           -> stop and forget one generator or processor
//   backend.buffer(ctx, id, samples, rate) -> true. samples: Float32Array (-1..1), up to 96000; rate in Hz
//   backend.fx(ctx, id, params)     -> true when taken. A processor on a jack: { type: gain | lowpass | highpass
//         | bandpass | drive, jack: { dir, index }, gain (linear), freq (Hz), q, amount (0..1), mix (0..1) }
//   backend.reset(ctx)              -> drop everything one screen made (ctx.screen), when it starts again
//   backend.jacks(ctx)              -> optional, the jacks as above (default: the design's audio jacks)
//   ctx = { design, block, blockId, def, mode ('board' | 'test' | 'sim'), screen (the screen's id) }
// Ids are unique per block: the bridge puts the screen id in front ("<screen>:<script id>"). Each screen has at
// most 16 generators, 16 processors and 192000 samples of buffers. There is no per sample script code: a
// script that wants its own sound writes it into a buffer (a wavetable or a short sample) and plays that.
// Engine work should stay small: a handful of oscillators and one filter per jack. A block removed from the
// board should drop what its scripts made.
import { clamp } from '../util.js';
import { circuitOutputs, outKey, readLink } from '../pages/factory-circuit.js';
import { audioJacks, findJack, fakeAudio, levelAnalysis, GEN_TYPES, FX_TYPES, MAX_GENS, MAX_BUFFER, MAX_BUFFERS, MAX_BINS, MIN_BINS, MAX_WAVE } from './audio.js';
import { sandboxStore, scratchStore, storedText, codeFiles } from './files.js';

let backend = null;
/** The engine side of script audio (see the contract above). Returns a function that removes it. */
export function setAudioBackend(b) {
  backend = b || null;
  return () => {
    if (backend === b) backend = null;
  };
}
export const audioBackend = () => backend;

const sources = [];
const sinks = [];
/**
 * A signal source: { names(ctx) -> [name], get(ctx, name) -> value or undefined }.
 * ctx = { design, block, def, mode ('board' | 'test' | 'sim'), status, params() }.
 */
export function addSignalSource(src) {
  sources.push(src);
  return () => sources.splice(sources.indexOf(src) >>> 0, 1);
}
/** An input sink: { set(ctx, name, value) -> true when handled }. */
export function addInputSink(sink) {
  sinks.push(sink);
  return () => sinks.splice(sinks.indexOf(sink) >>> 0, 1);
}

const KNOBLIKE = new Set(['knob', 'trim', 'slider', 'pedal']);
const lc = (s) => String(s ?? '').trim().toLowerCase();

/** The controls a design offers to scripts, in panel order. */
export function controlList(D) {
  const out = [];
  const count = {};
  const add = (e) => {
    count[e.kind] = (count[e.kind] || 0) + 1;
    e.n = count[e.kind];
    out.push(e);
  };
  for (const c of (D && D.ctls) || []) {
    if (c.hidden) continue;
    const label = (c.label || '').trim();
    const base = { id: c.id, label, param: c.param || '', src: c };
    if (KNOBLIKE.has(c.kind)) add({ ...base, kind: 'knob', p: 'u.' + c.id, def: c.value ?? 0.5, enc: c.part === 'encoder', wrap: c.part === 'encoder' && c.encMode !== 'clamp' });
    else if (c.kind === 'toggle' || c.kind === 'sel') {
      const n = c.kind === 'toggle' ? c.ways || 2 : c.n || 4;
      const opts = (c.opts || []).slice(0, n);
      while (opts.length < n) opts.push(String(opts.length + 1));
      add({ ...base, kind: 'switch', p: 'u.' + c.id, ways: n, opts, def: c.pos || 0 });
    } else if (c.kind === 'button') {
      const tap = c.map && c.map.to && c.map.to.endsWith('.tap');
      add({ ...base, kind: 'button', p: tap ? null : 'u.' + c.id, def: c.on ? 1 : 0, tap });
    } else if (c.kind === 'foot') {
      const to = c.map ? c.map.to : 'bypass';
      const action = !to || to === 'bypass' ? 'bypass' : to.endsWith('.tap') ? 'tap' : 'toggle';
      add({ ...base, kind: 'foot', p: action === 'toggle' ? 'u.' + c.id : null, action, def: 1 });
    } else if (c.kind === 'dip') {
      const n = c.n || 4;
      for (let i = 0; i < n; i++) add({ id: c.id + '.' + i, label: (label || 'DIP') + ' ' + (i + 1), param: '', src: c, kind: 'dip', p: 'u.' + c.id + '.' + i, bit: i, def: c.bits?.[i] ? 1 : 0 });
    }
  }
  // display names: the label, else kind + number
  const used = new Set();
  for (const e of out) {
    let nm = e.label || (e.kind === 'foot' ? 'Foot ' + String.fromCharCode(64 + e.n) : e.kind[0].toUpperCase() + e.kind.slice(1) + ' ' + e.n);
    if (used.has(lc(nm))) nm += ' ' + e.n;
    used.add(lc(nm));
    e.name = nm;
  }
  return out;
}

// find a control: by name / label / param / id, "Knob 2", a number (n-th of the kind) or a letter for footswitches
export function findControl(list, name, kind) {
  const pool = kind ? list.filter((e) => e.kind === kind || (kind === 'knob' && e.kind === 'knob')) : list;
  if (typeof name === 'number') return pool[Math.round(name) - 1] || null;
  const k = lc(name);
  if (!k) return null;
  return (
    pool.find((e) => lc(e.name) === k) ||
    pool.find((e) => lc(e.label) === k) ||
    pool.find((e) => lc(e.param) === k) ||
    pool.find((e) => lc(e.id) === k) ||
    (kind === 'foot' && /^[a-z]$/.test(k) ? pool[k.charCodeAt(0) - 97] : null) ||
    (/^\d+$/.test(k) ? pool[+k - 1] : null) ||
    list.find((e) => lc(e.name) === k) ||
    null
  );
}

// the value range a control mapping covers, for writing a circuit input through it
function invertMap(m, v) {
  const lo = m.min ?? 0, hi = m.max ?? 1;
  let t;
  if (m.taper === 'log' && lo > 0 && hi > 0 && v > 0) t = Math.log(v / lo) / Math.log(hi / lo);
  else t = (v - lo) / ((hi - lo) || 1);
  if (m.taper === 'audio') t = Math.sqrt(clamp(t, 0, 1));
  else if (m.taper === 'rev') t = 1 - Math.sqrt(1 - clamp(t, 0, 1));
  if (m.invert) t = 1 - t;
  return clamp(t, 0, 1);
}

/**
 * Make a host. io gives the raw access for one place the screen runs:
 *   get(p), set(p, v, entry), bypassed(), setBypass(on), levels() -> { inPk, outPk }, blockStatus(), params(),
 *   storeGet(), storeSet(obj), log(msg), mode, block, def
 */
export function makeHost(design, io) {
  const list = controlList(design);
  const stages = (design && design.circuit && Array.isArray(design.circuit.stages) ? design.circuit.stages : []).filter((s) => s && s.id);
  const lv = { in: 0, out: 0, env: 0, t: 0 };
  let paramCache = null, lastFrame = 0;
  const ctx = { design, mode: io.mode, block: io.block, def: io.def, get status() { return io.blockStatus ? io.blockStatus() : null; }, params: () => params() };
  const params = () => {
    if (!paramCache) {
      try {
        paramCache = (io.params && io.params()) || {};
      } catch (_) {
        paramCache = {};
      }
    }
    return paramCache;
  };
  const stageOf = (ref) => {
    const r = lc(ref);
    return stages.find((s) => lc(s.id) === r) || stages.find((s) => lc(s.type) === r) || stages.find((s) => lc(s.name) === r) || null;
  };
  const value = (e) => {
    if (e.kind === 'foot') {
      if (e.action === 'bypass') return !io.bypassed();
      if (e.action === 'tap') return false;
    }
    if (!e.p) return false;
    const raw = io.get(e.p);
    const v = raw ?? e.def;
    if (e.kind === 'knob') return clamp(+v || 0, 0, 1);
    if (e.kind === 'switch') return clamp(Math.round(+v || 0), 0, e.ways - 1) + 1;
    return +v > 0.5;
  };
  const host = {
    mode: io.mode,
    list,
    controls: () => list.map((e) => ({ name: e.name, kind: e.kind, id: e.id })),
    find: (name, kind) => findControl(list, name, kind),
    getControl(name, kind) {
      const e = findControl(list, name, kind);
      return e ? value(e) : undefined;
    },
    setControl(name, v, kind) {
      const e = typeof name === 'object' && name ? name : findControl(list, name, kind);
      if (!e) return false;
      if (e.kind === 'foot' && e.action === 'bypass') {
        const on = !!v && v !== 0;
        if (on === !io.bypassed()) return true;
        if (io.setBypass) io.setBypass(!on);
        return true;
      }
      if (!e.p) return false;
      let nv;
      if (e.kind === 'knob') nv = clamp(+v || 0, 0, 1);
      else if (e.kind === 'switch') nv = clamp(Math.round(+v || 1) - 1, 0, e.ways - 1);
      else nv = v === true || (typeof v === 'number' && v > 0.5) ? 1 : 0;
      const cur = io.get(e.p) ?? e.def;
      if (Math.abs((+cur || 0) - nv) < 1e-7) return true;
      io.set(e.p, nv, e);
      paramCache = null;
      return true;
    },
    display(name) {
      const e = findControl(list, name);
      if (!e) return '';
      const v = value(e);
      if (e.kind === 'switch') return e.opts[v - 1] ?? String(v);
      if (e.kind === 'knob') {
        const dc = io.def && io.def.controls && io.def.controls.find((c) => c.cid === e.id);
        try {
          if (dc && dc.display) return String(dc.display(v));
        } catch (_) {
          /* fall back to 0..10 */
        }
        return (v * 10).toFixed(1);
      }
      return v ? 'ON' : 'OFF';
    },
    snapshot() {
      const out = [];
      for (const e of list) out.push([e, value(e)]);
      return out;
    },
    bypassed: () => !!io.bypassed(),
    taps: () => (io.taps ? io.taps() : 0),
    presetSerial: () => (io.presetSerial ? io.presetSerial() : 0),
    setBypass: (on) => io.setBypass && io.setBypass(!!on),
    signals() {
      const names = ['in', 'out', 'inDb', 'outDb', 'env', 'on'];
      if (stages.some((s) => s.params && s.params.rate !== undefined)) names.push('lfo');
      for (const s of stages) for (const k of Object.keys(s.params || {})) names.push(s.type + '.' + k);
      for (const src of sources) {
        try {
          names.push(...(src.names(ctx) || []));
        } catch (_) {
          /* a broken source lists nothing */
        }
      }
      return [...new Set(names)];
    },
    getSignal(name) {
      const k = lc(name);
      switch (k) {
        case 'in': case 'input': case 'level': return lv.in;
        case 'out': case 'output': return lv.out;
        case 'indb': return 20 * Math.log10(Math.max(1e-5, lv.in));
        case 'outdb': return 20 * Math.log10(Math.max(1e-5, lv.out));
        case 'env': case 'envelope': return lv.env;
        case 'on': return io.bypassed() ? 0 : 1;
        case 'load': { const st = io.blockStatus && io.blockStatus(); return st && typeof st.load === 'number' ? st.load : 0; }
        case 'lfo': return lfo(stages.find((s) => s.params && s.params.rate !== undefined));
        case 'tempo': case 'bpm': {
          const st = io.blockStatus && io.blockStatus();
          if (st) for (const key in st) if (st[key] && typeof st[key].timeMs === 'number' && st[key].timeMs > 0) return 60000 / st[key].timeMs;
          const p = params();
          for (const key in p) if (/\.time$/.test(key) && p[key] > 20) return 60000 / p[key];
          return 120;
        }
      }
      for (const src of sources) {
        try {
          const v = src.get(ctx, name);
          if (v !== undefined) return v;
        } catch (_) {
          /* ignore a broken source */
        }
      }
      // <stage>.<key>: the stage's live status first, then the value the circuit runs with
      const dot = String(name).indexOf('.');
      if (dot > 0) {
        const s = stageOf(String(name).slice(0, dot));
        const key = String(name).slice(dot + 1);
        if (s) {
          if (key === 'lfo') return lfo(s);
          if (key === 'on') return s.on === false ? 0 : (params()[s.id + '.on'] ?? 1);
          const st = io.blockStatus && io.blockStatus();
          const sv = st && st[s.id] && st[s.id][key];
          if (typeof sv === 'number' || typeof sv === 'string' || typeof sv === 'boolean') return sv;
          const pv = params()[s.id + '.' + key];
          if (pv !== undefined) return pv;
          if (s.params && s.params[key] !== undefined) return s.params[key];
        }
      }
      const p = params()[name];
      return p;
    },
    setInput(name, v) {
      for (const sink of sinks) {
        try {
          if (sink.set(ctx, name, v)) return true;
        } catch (_) {
          /* try the next one */
        }
      }
      // today: a circuit input is written through the control wired to it
      let target = String(name);
      const dot = target.indexOf('.');
      if (dot > 0) {
        const s = stageOf(target.slice(0, dot));
        if (s) target = s.id + '.' + target.slice(dot + 1);
      }
      const e = list.find((x) => x.src && (x.kind === 'dip' ? (x.src.maps || [])[x.bit]?.to === target : x.src.map && x.src.map.to === target));
      if (!e) {
        const c = findControl(list, name);
        return c ? host.setControl(c, v) : false;
      }
      const m = e.kind === 'dip' ? e.src.maps[e.bit] : e.src.map;
      if (e.kind === 'knob') return host.setControl(e, invertMap(m, +v || 0));
      if (e.kind === 'switch') return host.setControl(e, Math.round(invertMap(m, +v || 0) * (e.ways - 1)) + 1);
      return host.setControl(e, !!v && v !== 0);
    },
    // ---- this screen's own inputs and outputs (wired in the factory's wiring diagram)
    screenPorts() {
      const c = screenCtl();
      const sio = (c && c.sio) || { ins: [], outs: [] };
      const m = (p, i, d) => ({ name: p.name || d + ' ' + (i + 1), sig: p.sig === 'b' ? 'b' : 'n' });
      return { ins: (sio.ins || []).map((p, i) => m(p, i, 'In')), outs: (sio.outs || []).map((p, i) => m(p, i, 'Out')) };
    },
    screenInput(which) {
      const c = screenCtl();
      const list = (c && c.sio && c.sio.ins) || [];
      const i = portIndex(list, which, 'In');
      const p = list[i];
      if (!p) return 0;
      const st = io.blockStatus && io.blockStatus();
      // the code editor's Test tab sets inputs by hand
      let v = io.screenIn ? io.screenIn(i) : undefined;
      if (typeof v === 'number') return p.sig === 'b' ? (v > 0.5 ? 1 : 0) : clamp(v, -255, 255);
      // wired straight from a control, jack or screen (pages/circuit-links.js)
      if (p.from && !p.from.n) v = readLink(design, p.from, new Proxy({}, { get: (_, k) => io.get(k) }), st, { bypass: !!(io.bypassed && io.bypassed()) });
      // a circuit output: 0 while the pedal is bypassed (the circuits are not running), like a direct link reads it
      else if (p.from && st && Array.isArray(st.cv) && !(io.bypassed && io.bypassed())) {
        const o = outIndex().get(outKey(p.from));
        if (o !== undefined) v = st.cv[o];
      }
      if (typeof v !== 'number') v = 0;
      return p.sig === 'b' ? (v > 0.5 ? 1 : 0) : clamp(v, -255, 255);
    },
    screenOutput(which, v) {
      const c = screenCtl();
      const list = (c && c.sio && c.sio.outs) || [];
      const i = portIndex(list, which, 'Out');
      const p = list[i];
      if (!p) return false;
      const nv = p.sig === 'b' ? (v === true || (typeof v === 'number' && v > 0.5) ? 1 : 0) : clamp(+v || 0, -255, 255);
      const key = 'u.s.' + c.id + '.' + i;
      const cur = io.get(key);
      if (cur !== undefined && Math.abs((+cur || 0) - nv) < 1e-7) return true;
      io.set(key, nv, { raw: true, p: key, id: null });
      paramCache = null;
      return true;
    },
    screenOutputValue(which) {
      const c = screenCtl();
      const list = (c && c.sio && c.sio.outs) || [];
      const i = portIndex(list, which, 'Out');
      if (!list[i]) return 0;
      return +(io.get('u.s.' + c.id + '.' + i) ?? list[i].def ?? 0) || 0; // never set: its default
    },
    // per frame: levels, envelope and a fresh param cache
    beginFrame(now) {
      paramCache = null;
      if (host.audio) host.audio.frame();
      const dt = lastFrame ? clamp((now - lastFrame) / 1000, 0, 0.5) : 0.05;
      lastFrame = now;
      lv.t = now / 1000;
      let L = { inPk: 0, outPk: 0 };
      try {
        L = io.levels() || L;
      } catch (_) {
        /* no levels */
      }
      lv.in = L.inPk || 0;
      lv.out = L.outPk || 0;
      lv.env = Math.max(lv.in, lv.env * Math.exp(-dt / 0.25));
      if (io.beginFrame) io.beginFrame(now);
    },
    store: () => (io.storeGet ? io.storeGet() : null),
    saveStore: (o) => io.storeSet && io.storeSet(o),
    log: (m) => io.log && io.log(m),
    // ---- files: the pedal's store (shared by its screens) and the design's code files
    get files() {
      return io.files || null;
    },
    codeFile(path) {
      const F = design && design.files;
      if (!F || !Object.prototype.hasOwnProperty.call(F, path)) return null;
      return storedText(F[path]);
    },
    codeFiles: () => codeFiles(design).map((f) => f.path),
    audio: null,
  };
  host.audio = makeAudio(design, io, ctx);
  // the screen this host belongs to, and where circuit outputs sit in the status
  function screenCtl() {
    const id = io.cid;
    return id ? ((design && design.ctls) || []).find((x) => x.id === id) || null : null;
  }
  let outIdx = null;
  function outIndex() {
    if (!outIdx) outIdx = new Map(circuitOutputs(design || { circuit: null }).map((o) => [o.key, o.idx]));
    return outIdx;
  }
  function portIndex(list, which, word) {
    if (typeof which === 'number') return Math.round(which) - 1;
    const k = lc(which);
    const i = list.findIndex((p, n) => lc(p.name || word + ' ' + (n + 1)) === k);
    return i >= 0 ? i : /^\d+$/.test(k) ? +k - 1 : -1;
  }
  // an LFO phase from a stage's rate (approximate, from the rate the circuit runs with)
  function lfo(s) {
    if (!s) return 0;
    let hz = params()[s.id + '.rate'] ?? (s.params && s.params.rate) ?? 1;
    if (!(hz > 0.02 && hz < 40)) hz = 1;
    return 0.5 + 0.5 * Math.sin(lv.t * Math.PI * 2 * hz);
  }
  return host;
}

// ------------------------------------------------------------------ script audio (the bridge side)
const sameParams = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function makeAudio(design, io, hctx) {
  const jacks = audioJacks(design);
  const ctx = {
    get design() { return design; },
    get block() { return io.block; },
    get blockId() { return io.blockId || (io.block && io.block.id) || null; },
    get def() { return io.def; },
    mode: io.mode,
    get screen() { return io.cid || ''; },
  };
  const be = () => io.audio || backend; // the preview brings its own fake
  const key = (id) => (io.cid || '') + ':' + String(id);
  const sent = new Map(); // id -> params last sent (generators and processors)
  const bufs = new Map(); // id -> samples
  let cache = new Map();
  const jackList = () => {
    const b = be();
    try {
      const own = b && b.jacks && b.jacks(ctx);
      if (Array.isArray(own) && own.length) return own;
    } catch (_) {
      /* the design's jacks */
    }
    return jacks;
  };
  const A = {
    jacks: () => jackList().map((j) => ({ ...j })),
    find: (name) => findJack(jackList(), name),
    ready: () => !!be(),
    frame() {
      cache = new Map();
    },
    /** Analysis of a jack (by name, see findJack), cached for the frame. */
    analysis(name, want = {}) {
      const j = findJack(jackList(), name);
      if (!j) return null;
      const nb = Math.max(MIN_BINS, Math.min(MAX_BINS, Math.round(want.bands || 32)));
      const nw = Math.max(16, Math.min(MAX_WAVE, Math.round(want.wave || 128)));
      const k = j.dir + j.index + '|' + nb + '|' + nw;
      if (cache.has(k)) return cache.get(k);
      let r = null;
      const b = be();
      try {
        r = b && b.analysis ? b.analysis(ctx, j, { bands: nb, wave: nw }) : null;
      } catch (_) {
        r = null;
      }
      if (!r) {
        let L = null;
        try {
          L = io.levels ? io.levels() : null;
        } catch (_) {
          L = null;
        }
        r = levelAnalysis(L, j);
      }
      cache.set(k, r);
      return r;
    },
    /** Resolve "to" (a jack name or "circuit:<name>") for the engine. */
    target(to) {
      if (to === undefined || to === null || to === '') return { dir: 'out', index: 0 };
      const s = String(to);
      if (/^circuit(:|$)/i.test(s)) return { circuit: s.slice(8).trim() };
      const j = findJack(jackList(), s);
      if (!j) throw new Error(`there is no audio jack "${s}" (jacks: ${jackList().map((x) => x.name).join(', ')})`);
      return { dir: j.dir, index: j.index };
    },
    gen(id, params) {
      const b = be();
      if (!b || !b.gen) return false;
      if (!GEN_TYPES.includes(params.type)) throw new Error(`audio: type is ${GEN_TYPES.join(', ')}`);
      const k = key(id);
      if (!sent.has('g' + k) && [...sent.keys()].filter((x) => x.startsWith('g')).length >= MAX_GENS) throw new Error(`audio: a screen can run ${MAX_GENS} generators at most (stop some with audio.stop)`);
      const last = sent.get('g' + k);
      if (last && sameParams(last, params)) return true;
      let ok = false;
      try {
        ok = !!b.gen(ctx, k, params);
      } catch (_) {
        ok = false;
      }
      if (ok) sent.set('g' + k, params);
      return ok;
    },
    fx(id, params) {
      const b = be();
      if (!b || !b.fx) return false;
      if (!FX_TYPES.includes(params.type)) throw new Error(`audio.fx: type is ${FX_TYPES.join(', ')}`);
      const k = key(id);
      if (!sent.has('f' + k) && [...sent.keys()].filter((x) => x.startsWith('f')).length >= MAX_GENS) throw new Error(`audio.fx: a screen can have ${MAX_GENS} processors at most`);
      const last = sent.get('f' + k);
      if (last && sameParams(last, params)) return true;
      let ok = false;
      try {
        ok = !!b.fx(ctx, k, params);
      } catch (_) {
        ok = false;
      }
      if (ok) sent.set('f' + k, params);
      return ok;
    },
    stop(id) {
      const k = key(id);
      const had = sent.delete('g' + k) | sent.delete('f' + k);
      const b = be();
      try {
        if (b && b.stop) b.stop(ctx, k);
      } catch (_) {
        /* gone already */
      }
      return !!had;
    },
    buffer(id, samples, rate) {
      const b = be();
      if (!b || !b.buffer) return false;
      if (samples.length > MAX_BUFFER) throw new Error(`audio.buffer: ${samples.length} samples is too many (${MAX_BUFFER} at most, 2 seconds at 48 kHz)`);
      const k = key(id);
      let total = samples.length;
      for (const [x, v] of bufs) if (x !== k) total += v.length;
      if (total > MAX_BUFFERS) throw new Error(`audio.buffer: the screen's buffers would hold ${total} samples (${MAX_BUFFERS} at most)`);
      let ok = false;
      try {
        ok = !!b.buffer(ctx, k, samples, rate);
      } catch (_) {
        ok = false;
      }
      if (ok) bufs.set(k, samples);
      return ok;
    },
    bufferKey: key,
    /** Forget everything this screen made (a restart). */
    reset() {
      sent.clear();
      bufs.clear();
      const b = be();
      try {
        if (b && b.reset) b.reset(ctx);
      } catch (_) {
        /* nothing to reset */
      }
    },
    stats: () => ({ gens: [...sent.keys()].filter((x) => x.startsWith('g')).length, fx: [...sent.keys()].filter((x) => x.startsWith('f')).length, samples: [...bufs.values()].reduce((n, v) => n + v.length, 0) }),
  };
  return A;
}

// ------------------------------------------------------------------ a simulated pedal (editor, factory preview)
/** Values live in memory, levels come from sliders or a demo signal. */
export function simIO(design, o = {}) {
  const vals = new Map();
  for (const e of controlList(design)) if (e.p) vals.set(e.p, e.def);
  const sim = {
    vals,
    bypass: false,
    demo: o.demo !== false,
    inLevel: 0.4,
    outLevel: 0.3,
    store: null,
    onSet: null,
    ports: new Map(), // screen input index -> value
  };
  let def = null;
  const io = {
    mode: o.mode || 'sim',
    block: null,
    get def() {
      return def;
    },
    get: (p) => vals.get(p),
    set: (p, v) => {
      if (o.readOnly) return;
      vals.set(p, v);
      if (sim.onSet) sim.onSet(p, v);
    },
    bypassed: () => sim.bypass,
    setBypass: (on) => {
      if (o.readOnly) return;
      sim.bypass = on;
      if (sim.onSet) sim.onSet('bypass', on);
    },
    levels() {
      if (!sim.demo) return { inPk: sim.inLevel, outPk: sim.outLevel };
      // a strummed guitar: a pick attack every so often, then a decay
      const t = performance.now() / 1000;
      const ph = (t % 1.6) / 1.6;
      const env = Math.exp(-ph * 4.5) * (0.75 + 0.25 * Math.sin(t * 0.7));
      const jitter = 0.85 + 0.15 * Math.sin(t * 37) * Math.sin(t * 23);
      const inPk = clamp(env * jitter, 0, 1);
      return { inPk, outPk: sim.bypass ? inPk : clamp(inPk * 0.8 + 0.06, 0, 1) };
    },
    blockStatus: () => null,
    params: () => {
      if (!o.paramsFor) return {};
      const ui = Object.fromEntries(vals);
      return o.paramsFor(ui) || {};
    },
    storeGet: () => sim.store,
    storeSet: (s) => (sim.store = s),
    screenIn: (i) => sim.ports.get(i), // simulated screen inputs (0 based)
    log: o.log,
    // the pedal's files: a sandbox per design in memory (the code editor can keep them in the design)
    files: o.files !== undefined ? o.files : o.readOnly ? scratchStore(design) : sandboxStore(design),
    audio: null,
  };
  sim.audio = io.audio = fakeAudio(sim);
  if (o.def) def = o.def;
  return { io, sim };
}
