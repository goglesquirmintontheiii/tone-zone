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
// New circuit signals plug in with addSignalSource() / addInputSink() below, without touching this file.
import { clamp } from '../util.js';

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
    if (KNOBLIKE.has(c.kind)) add({ ...base, kind: 'knob', p: 'u.' + c.id, def: c.value ?? 0.5 });
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
  let paramCache = null, statusCache = null, lastFrame = 0;
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
    // per frame: levels, envelope and a fresh param cache
    beginFrame(now) {
      paramCache = null;
      statusCache = null;
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
      void statusCache;
    },
    store: () => (io.storeGet ? io.storeGet() : null),
    saveStore: (o) => io.storeSet && io.storeSet(o),
    log: (m) => io.log && io.log(m),
  };
  // an LFO phase from a stage's rate (approximate, from the rate the circuit runs with)
  function lfo(s) {
    if (!s) return 0;
    let hz = params()[s.id + '.rate'] ?? (s.params && s.params.rate) ?? 1;
    if (!(hz > 0.02 && hz < 40)) hz = 1;
    return 0.5 + 0.5 * Math.sin(lv.t * Math.PI * 2 * hz);
  }
  return host;
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
    log: o.log,
  };
  if (o.def) def = o.def;
  return { io, sim };
}
