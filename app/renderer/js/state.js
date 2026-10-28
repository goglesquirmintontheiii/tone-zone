// Preset model, engine synchronisation and undo/redo history.
import { cabGeom } from './gfx/cabgeom.js';
import { getDef, portsFor, defaultVariant } from './catalog/index.js';
import { bus, uid, clamp, debounce } from './util.js';

export const CABLE_COLORS = ['#e8473d', '#f39c12', '#f1c40f', '#2ecc71', '#1abc9c', '#3498db', '#6c5ce7', '#e84393', '#ecf0f1', '#95a5a6', '#2d3436', '#c0873f'];

export const state = {
  preset: null,
  file: null, // preset file name on disk
  dirty: false,
  selection: new Set(),
  selectedCable: null,
  status: { blocks: {} },
  cableColor: CABLE_COLORS[0],
  settings: {},
  engineParams: {}, // algo -> [{name, def, min, max}]
  ui: {}, // transient per-block UI state (alt mode, looper layer, favourites)
};

export function newPreset(name = 'New Preset') {
  return {
    version: 1,
    name,
    blocks: [
      { id: '__in', type: '__in', x: 1500, y: 120, params: {} },
      { id: '__out', type: '__out', x: -300, y: 120, params: {} },
    ],
    cables: [],
    view: null,
  };
}

export function blockById(id) {
  return state.preset.blocks.find((b) => b.id === id);
}

// -------- control <-> value helpers
export function ctlDefault(c) {
  if (c.t === 'sel' || c.t === 'toggle') return c.def ?? 0;
  if (c.t === 'button') return 0;
  return c.def ?? (c.min ?? 0);
}
export function uiParams(block) {
  const d = getDef(block.type);
  const p = {};
  if (d) {
    for (const c of d.controls) if (c.p) p[c.p] = block.params[c.p] ?? ctlDefault(c);
    if (d.initParams) for (const k in d.initParams) if (p[k] === undefined) p[k] = block.params[k] ?? d.initParams[k];
  }
  for (const k in block.params) if (p[k] === undefined) p[k] = block.params[k];
  return p;
}
export function engineParamsFor(block) {
  const d = getDef(block.type);
  if (!d || !d.algo) return {};
  const ui = uiParams(block);
  const out = {};
  const mapped = new Set();
  for (const c of d.controls) {
    if (!c.p) continue;
    mapped.add(c.p);
    if (c.virtual) continue;
    let v = ui[c.p];
    if (c.t === 'sel' || c.t === 'toggle') v = c.values ? c.values[v | 0] ?? c.values[0] : v | 0;
    else if (c.invert && c.t === 'knob') v = (c.min ?? 0) + (c.max ?? 1) - v;
    if (c.t === 'button' && c.toggle) v = v ? 1 : 0;
    if (typeof v === 'number') out[c.p] = v;
  }
  for (const k in ui) if (!mapped.has(k) && typeof ui[k] === 'number' && !k.startsWith('_')) out[k] = ui[k];
  Object.assign(out, d.fixed || {});
  if (d.derive) Object.assign(out, d.derive(ui));
  return out;
}

export function nodePorts(block) {
  const d = getDef(block.type);
  if (!d) return { ins: [], outs: [] };
  return portsFor(d, block.variant || defaultVariant(d));
}

// -------- engine sync
let lastSent = {}; // id -> {param: value}
export function buildGraph() {
  const nodes = [];
  for (const b of state.preset.blocks) {
    if (b.id === '__in' || b.id === '__out') continue;
    const d = getDef(b.type);
    if (!d || !d.algo) continue;
    const ports = nodePorts(b);
    const params = engineParamsFor(b);
    lastSent[b.id] = Object.assign({}, params);
    nodes.push({ id: b.id, algo: d.algo, nIn: ports.ins.length, nOut: ports.outs.length, opts: d.opts || {}, params, bypass: !!b.bypass && !d.alwaysOn });
  }
  const valid = new Set(nodes.map((n) => n.id).concat(['__in', '__out']));
  const cables = state.preset.cables
    .filter((c) => valid.has(c.from.node) && valid.has(c.to.node))
    .map((c) => ({ from: { node: c.from.node, port: c.from.port }, to: { node: c.to.node, port: c.to.port } }));
  return { nodes, cables };
}
export function syncGraph() {
  window.tz.engine.send({ cmd: 'setGraph', graph: buildGraph() });
}
const syncGraphSoon = debounce(syncGraph, 30);

export function sendParamsFor(block) {
  const now = engineParamsFor(block);
  const prev = lastSent[block.id] || {};
  const diff = {};
  let any = false;
  for (const k in now)
    if (prev[k] !== now[k]) {
      diff[k] = now[k];
      any = true;
    }
  if (any) {
    window.tz.engine.send({ cmd: 'params', id: block.id, values: diff });
    lastSent[block.id] = now;
  }
}

// -------- history
const history = { past: [], future: [] };
let snapshotPending = null;
function snapshot() {
  return JSON.stringify(state.preset);
}
export function commit(label = '') {
  // call BEFORE mutating; coalesces rapid edits (knob drags) into one undo step
  if (snapshotPending) return;
  history.past.push(snapshot());
  if (history.past.length > 150) history.past.shift();
  history.future.length = 0;
  snapshotPending = setTimeout(() => (snapshotPending = null), 400);
  markDirty();
  bus.emit('history');
  void label;
}
export function commitNow() {
  clearTimeout(snapshotPending);
  snapshotPending = null;
  commit();
}
export function canUndo() {
  return history.past.length > 0;
}
export function canRedo() {
  return history.future.length > 0;
}
export function undo() {
  if (!history.past.length) return;
  history.future.push(snapshot());
  state.preset = JSON.parse(history.past.pop());
  afterRestore();
}
export function redo() {
  if (!history.future.length) return;
  history.past.push(snapshot());
  state.preset = JSON.parse(history.future.pop());
  afterRestore();
}
function afterRestore() {
  state.selection.clear();
  state.selectedCable = null;
  markDirty();
  bus.emit('preset:changed', { keepView: true });
  syncGraph();
  bus.emit('history');
}
export function resetHistory() {
  history.past.length = 0;
  history.future.length = 0;
  bus.emit('history');
}

export function markDirty(v = true) {
  state.dirty = v;
  bus.emit('dirty', v);
}

// -------- mutations
export function addBlock(type, x, y, extra = {}) {
  const d = getDef(type);
  if (!d) return null;
  commitNow();
  const b = { id: uid('b'), type, x: Math.round(x), y: Math.round(y), params: {}, bypass: !!d.defaultBypass, variant: defaultVariant(d) };
  if (d.initParams) Object.assign(b.params, d.initParams);
  Object.assign(b, extra);
  state.preset.blocks.push(b);
  bus.emit('block:added', b);
  syncGraphSoon();
  return b;
}
export function removeBlocks(ids) {
  ids = ids.filter((id) => id !== '__in' && id !== '__out');
  if (!ids.length) return;
  commitNow();
  const set = new Set(ids);
  state.preset.blocks = state.preset.blocks.filter((b) => !set.has(b.id));
  state.preset.cables = state.preset.cables.filter((c) => !set.has(c.from.node) && !set.has(c.to.node));
  for (const id of ids) state.selection.delete(id);
  bus.emit('preset:changed', { keepView: true });
  syncGraphSoon();
}
export function duplicateBlocks(ids) {
  const out = [];
  commitNow();
  for (const id of ids) {
    const b = blockById(id);
    if (!b || b.id.startsWith('__')) continue;
    const nb = JSON.parse(JSON.stringify(b));
    nb.id = uid('b');
    nb.x += 40;
    nb.y += 40;
    state.preset.blocks.push(nb);
    out.push(nb);
    bus.emit('block:added', nb);
  }
  syncGraphSoon();
  return out;
}
export function moveBlock(id, x, y) {
  const b = blockById(id);
  if (!b) return;
  b.x = x;
  b.y = y;
}
export function setParam(id, p, v, { silent = false } = {}) {
  const b = blockById(id);
  if (!b) return;
  if (!silent) commit();
  b.params[p] = v;
  sendParamsFor(b);
  bus.emit('param', { id, p, v });
}
export function setBypass(id, on) {
  const b = blockById(id);
  if (!b) return;
  commit();
  b.bypass = !!on;
  window.tz.engine.send({ cmd: 'bypass', id, on: !!on });
  bus.emit('bypass', { id, on: !!on });
}
export function setVariant(id, variant) {
  const b = blockById(id);
  if (!b || b.variant === variant) return;
  commitNow();
  b.variant = variant;
  const d = getDef(b.type);
  if (d && d.cabMics && variant === 'stereo' && !(b.params.m2on > 0.5)) {
    const g = cabGeom(d.cabSize || '4x12');
    const [cx, cy] = g.centers[Math.min(1, g.centers.length - 1)];
    Object.assign(b.params, { m2on: 1, m2type: 2, m2dist: 0.15, _m2x: (cx - 0.4 * g.sr - g.gx) / g.gw, _m2y: (cy - g.gy) / g.gh, m1pan: -0.8, m2pan: 0.8 });
  }
  // drop cables to ports that no longer exist
  const ports = nodePorts(b);
  state.preset.cables = state.preset.cables.filter(
    (c) => !((c.to.node === id && c.to.port >= ports.ins.length) || (c.from.node === id && c.from.port >= ports.outs.length))
  );
  bus.emit('preset:changed', { keepView: true });
  syncGraphSoon();
}
export function connect(from, to, color) {
  // from = {node, port} (output), to = {node, port} (input). An input takes one cable.
  if (from.node === to.node) return null;
  commitNow();
  state.preset.cables = state.preset.cables.filter((c) => !(c.to.node === to.node && c.to.port === to.port));
  const c = { id: uid('c'), from: { ...from }, to: { ...to }, color: color || state.cableColor };
  state.preset.cables.push(c);
  bus.emit('cables');
  syncGraphSoon();
  return c;
}
export function removeCable(id) {
  commitNow();
  state.preset.cables = state.preset.cables.filter((c) => c.id !== id);
  if (state.selectedCable === id) state.selectedCable = null;
  bus.emit('cables');
  syncGraphSoon();
}
export function setCableColor(id, color) {
  const c = state.preset.cables.find((x) => x.id === id);
  if (!c) return;
  commit();
  c.color = color;
  bus.emit('cables');
}

// bring blocks saved by older versions up to date
function migrateBlock(b) {
  const d = getDef(b.type);
  if (!d) return;
  const P = b.params || (b.params = {});
  if (d.cabMics && P._m1x === undefined && (P.position !== undefined || P.mic !== undefined || P.distance !== undefined)) {
    const size = d.cabSize || '4x12';
    const g = cabGeom(size);
    const [cx, cy] = g.centers[0];
    const pos = P.position ?? 0.3;
    Object.assign(P, { m1on: 1, m1type: P.mic ?? d.opts.mic ?? 0, m1dist: P.distance ?? 0.15, _m1x: (cx + pos * g.sr - g.gx) / g.gw, _m1y: (cy - g.gy) / g.gh });
    if (b.variant === 'stereo') {
      const p2 = P.position2 ?? 0.5;
      Object.assign(P, { m2on: 1, m2type: P.mic2 ?? 2, m2dist: P.distance ?? 0.15, _m2x: (cx - p2 * g.sr - g.gx) / g.gw, _m2y: (cy - g.gy) / g.gh, m1pan: -1, m2pan: 1 });
    }
    for (const k of ['position', 'distance', 'mic', 'mic2', 'position2', 'mix']) delete P[k];
  }
}

export function loadPreset(p, file = null) {
  // ensure I/O blocks exist
  if (!p.blocks.find((b) => b.id === '__in')) p.blocks.push({ id: '__in', type: '__in', x: 1500, y: 120, params: {} });
  if (!p.blocks.find((b) => b.id === '__out')) p.blocks.push({ id: '__out', type: '__out', x: -300, y: 120, params: {} });
  p.blocks = p.blocks.filter((b) => getDef(b.type) || b.id.startsWith('__'));
  for (const b of p.blocks) migrateBlock(b);
  state.preset = p;
  state.file = file;
  state.selection.clear();
  state.selectedCable = null;
  lastSent = {};
  resetHistory();
  markDirty(false);
  bus.emit('preset:changed', { keepView: false });
  syncGraph();
}

export function serialize() {
  return JSON.parse(JSON.stringify(state.preset));
}

export function estimatedLoad(extraCost = 0) {
  let total = extraCost;
  for (const b of state.preset.blocks) {
    const d = getDef(b.type);
    if (!d || !d.algo) continue;
    const st = state.status.blocks[b.id];
    total += st && typeof st.load === 'number' ? st.load * 100 : d.cost || 0.5;
  }
  return total;
}

export { clamp };
