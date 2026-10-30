// Pedal Factory: the sound of a design. A pedal holds one or more circuits (graphs of parts, see
// circuit-parts.js); the wiring diagram routes the pedal's jacks through them, and each control drives one or
// more circuit inputs. designToDef() compiles all of it into one engine 'patch' node and a catalog block.
//
// Design model (v3):
//   D.circuit = { v: 3, insts: [{ id, ref, ver, name, graph, x, y, on }], wires: [{ id, a: {n, p}, b: {n, p} }],
//                 combine: { target: 'avg' (default) | 'sum' | 'max' | 'min' }, mix, mixDef, stages }
//   wire ends: n = 'jack:<jack id>' or an instance id, p = the circuit's Audio in / Audio out node id. A wire into
//   a PHONES jack may say p = 'L' or 'R' to feed one side only.
//   control targets: '<inst>.<control input node>', '<inst>.on', '<inst>.tap', 'bypass', 'mix'.
//   c.map is a control's first target, c.more its others; DIP switches and XY pads keep c.maps[i]; expression
//   and footswitch jacks j.maps (footswitch maps say ch 't' tip or 'r' ring). `stages` is a short summary of the
//   engine parts ([{type}]) for the circuit board drawing.
//   Circuit outputs (Analog / Binary output parts) are '<inst>.<node>' too, and drive:
//     C.cwires: [{id, a: {n: inst, p: output node}, b: {n: inst, p: input node}}]   another circuit's input
//     led.bind = 'cv:<inst>.<node>'                                                  an LED
//     j.from = {n: inst, p: node}                                                    an EXP / footswitch jack (out)
//     screen.sio.ins[i].from = {n, p}                                                a screen input
//   and a screen's outputs drive circuit inputs: screen.sio.outs[i].maps = [{to, raw: true}].
//   Analog values are floats from -255 to 255, binary 0 or 1.
// Older designs (v2: a list of stages) are migrated on load (circuit-migrate.js), old 'knob' inputs become
// analog or binary inputs (migrateGraph).
import { clamp } from '../util.js';
import { xyControls } from './factory-kinds.js';
import { STAGES, STAGE_CATS, CLIPS, COMP_TYPES, PARTS, LIM, ioNodes, nid, clone, val, portKind, graphCat, graphCost, graphNames, hasTap, migrateGraph, newNode } from './circuit-parts.js';
import {
  CIRCUITS, circuitById, makeCircuit, newStage, stageParam, v2TargetsFor, v2TargetInfo, v2MapTo, v2AutoMap, autoMapWith, stagesToGraph,
} from './circuit-migrate.js';

export { STAGES, STAGE_CATS, CLIPS, COMP_TYPES, CIRCUITS, circuitById, makeCircuit, newStage, stageParam, nid };
export const uid = (p) => p + Math.random().toString(36).slice(2, 7);
export const isV3 = (C) => !!C && C.v === 3;
const isOutput = (k) => k === 'out' || k === 'stereo' || k === 'phones' || k === 'xlr';
export const S = 2; // board units per millimetre

// ------------------------------------------------------------------ instances
export const instOf = (C, id) => (C && C.insts ? C.insts.find((i) => i.id === id) : null);
export const instInputs = (inst) => ioNodes(inst.graph, 'ctl');
export const instAudioIns = (inst) => ioNodes(inst.graph, 'in');
export const instAudioOuts = (inst) => ioNodes(inst.graph, 'out');
export const instOutputs = (inst) => ioNodes(inst.graph, 'cout');
/** Signal of a circuit input or output node: 'b' binary, 'n' analog. */
export const nodeSig = (n) => (n && (n.t === 'binary' || n.t === 'binout' || (n.t === 'knob' && n.steps === 2)) ? 'b' : 'n');
/** Every circuit output of the pedal, in engine order (status cv[idx]). */
export function circuitOutputs(D) {
  const out = [];
  for (const inst of (D.circuit && D.circuit.insts) || [])
    for (const n of instOutputs(inst)) out.push({ key: inst.id + '.' + n.id, inst, n, sig: nodeSig(n), idx: out.length, name: (inst.name || 'Circuit') + ': ' + (n.name || 'Out'), min: n.min ?? 0, max: n.max ?? 1 });
  return out;
}
export const outKey = (e) => (e && e.n ? e.n + '.' + e.p : '');
/** EXP and footswitch jacks. A jack driven by a circuit output (j.from) is an output, else an input. */
export const ctlJacks = (D) => D.jacks.filter((j) => j.kind === 'exp' || j.kind === 'fsw');
export const jackIsOut = (j) => !!(j && ((j.from && j.from.n) || j.dir === 'out'));
/** A screen's inputs and outputs (up to 16 each). */
export const SCREEN_PORTS = 16;
export const screenIO = (c) => {
  if (!c.sio) c.sio = { ins: [], outs: [] };
  if (!Array.isArray(c.sio.ins)) c.sio.ins = [];
  if (!Array.isArray(c.sio.outs)) c.sio.outs = [];
  return c.sio;
};
const titleCase = (s) => String(s || '').toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());
/** Keep the parts summary (C.stages) up to date after changing circuits. */
export function syncStages(C) {
  if (!isV3(C)) return;
  C.stages = [];
  for (const i of C.insts) for (const n of i.graph.nodes) if (STAGES[n.t] && C.stages.length < 8) C.stages.push({ id: n.id, type: n.t });
}

function knobInfo(k) {
  const name = k.name || 'Input';
  if (nodeSig(k) === 'b') return { min: 0, max: 1, i: 1, def: k.def ? 1 : 0, opts: k.opts && k.opts.length >= 2 ? k.opts.slice(0, 2) : ['Off', 'On'], label: name, key: name.toLowerCase(), bin: true };
  const steps = k.steps >= 2 ? k.steps : 0;
  if (steps) return { min: 0, max: steps - 1, i: 1, def: k.def ?? 0, opts: k.opts && k.opts.length ? k.opts.slice(0, steps) : undefined, label: name, key: name.toLowerCase() };
  const lo = clamp(k.min ?? 0, -LIM, LIM), hi = clamp(k.max ?? 1, -LIM, LIM);
  return { min: lo, max: hi, def: k.def ?? (lo + hi) / 2, label: name, key: name.toLowerCase() };
}
export const inputInfo = knobInfo;

// ------------------------------------------------------------------ targets (v2 and v3)
/** Everything a control can drive: [value, label, info]. */
export function targetsFor(C, ctlKind) {
  if (!isV3(C)) return v2TargetsFor(C, ctlKind);
  const out = [['', 'Nothing']];
  const sw = ctlKind === 'foot' || ctlKind === 'button';
  if (ctlKind === 'foot') out.push(['bypass', 'Bypass (pedal on / off)']);
  if (C.mix) out.push(['mix', 'Wet / dry mix', { min: 0, max: 1, label: 'Mix' }]);
  for (const inst of C.insts) {
    const nm = inst.name || 'Circuit';
    out.push([inst.id + '.on', `${nm}: on / off`, { min: 0, max: 1, i: 1, label: 'On', key: 'on' }]);
    if (sw && hasTap(inst.graph)) out.push([inst.id + '.tap', `${nm}: tap tempo`, { tap: true, label: 'Tap' }]);
    for (const k of instInputs(inst)) out.push([inst.id + '.' + k.id, `${nm}: ${k.name || 'Input'}`, knobInfo(k)]);
  }
  // values inside the circuits that no control input reaches yet: picking one adds an input for it
  for (const inst of C.insts)
    for (const n of inst.graph.nodes) {
      const pt = PARTS[n.t];
      if (!pt || pt.io) continue;
      for (const p of pt.params) {
        if (p.key === 'on' || p.sig || inst.graph.wires.some((w) => w.b.n === n.id && w.b.p === '@' + p.key)) continue;
        out.push([`${inst.id}.+${n.id}.${p.key}`, `${inst.name || 'Circuit'}: ${n.label || pt.name} ${p.label} (new input)`, extraInfo(n, p)]);
      }
    }
  return out;
}
// a part value as a would-be control input
function extraInfo(n, p) {
  if (p.i && p.opts) return { min: 0, max: p.opts.length - 1, i: 1, opts: p.opts, def: Math.round(val(n, p) - p.min), label: p.label, key: p.key, extra: true };
  if (p.i) return { min: 0, max: p.max - p.min, i: 1, def: Math.round(val(n, p) - p.min), label: p.label, key: p.key, extra: true };
  const v = val(n, p);
  const def = p.l && p.min > 0 ? Math.log(v / p.min) / Math.log(p.max / p.min) : (v - p.min) / (p.max - p.min || 1);
  return { min: 0, max: 1, def: clamp(def, 0, 1), label: p.label, key: p.key, extra: true };
}
// turn a '<inst>.+<node>.<param>' target into a real control input wired to that value
function exposeExtra(C, to) {
  const m = /^([^.]+)\.\+([^.]+)\.(.+)$/.exec(to);
  const inst = m && instOf(C, m[1]);
  const n = inst && inst.graph.nodes.find((x) => x.id === m[2]);
  const p = n && (PARTS[n.t]?.params || []).find((x) => x.key === m[3]);
  if (!p) return null;
  const info = extraInfo(n, p);
  const ys = instInputs(inst).map((k) => k.y);
  const names = new Set(instInputs(inst).map((k) => (k.name || '').toLowerCase()));
  let name = p.label;
  for (let i = 2; names.has(name.toLowerCase()); i++) name = p.label + ' ' + i;
  const steps = info.i ? info.max + 1 : 0;
  const k = newNode(steps === 2 ? 'binary' : 'analog', 40, (ys.length ? Math.max(...ys) : 100) + 64, { name, def: info.def });
  if (steps > 2) k.steps = steps;
  if (p.opts) k.opts = p.opts.slice();
  inst.graph.nodes.push(k);
  const w = { id: nid('w'), a: { n: k.id, p: 'cv' }, b: { n: n.id, p: '@' + p.key } };
  if (p.l) w.log = true;
  inst.graph.wires.push(w);
  return inst.id + '.' + k.id;
}
export function targetInfo(C, to) {
  if (!to) return null;
  if (!isV3(C)) return v2TargetInfo(C, to);
  if (to === 'mix') return { min: 0, max: 1, label: 'Mix' };
  const dot = to.indexOf('.');
  const inst = instOf(C, to.slice(0, dot));
  if (!inst) return null;
  const key = to.slice(dot + 1);
  if (key === 'on') return { min: 0, max: 1, i: 1, label: 'On', key: 'on' };
  if (key === 'tap') return hasTap(inst.graph) ? { tap: true, label: 'Tap' } : null;
  if (key.startsWith('+')) {
    const [nid2, pk] = key.slice(1).split('.');
    const n = inst.graph.nodes.find((x) => x.id === nid2);
    const p = n && (PARTS[n.t]?.params || []).find((x) => x.key === pk);
    return p ? extraInfo(n, p) : null;
  }
  const k = inst.graph.nodes.find((n) => n.id === key && PARTS[n.t]?.io === 'ctl');
  return k ? knobInfo(k) : null;
}
export function targetLabel(C, to) {
  if (!to) return 'Nothing';
  if (to === 'bypass') return 'Bypass';
  const t = targetsFor(C, 'foot').find((x) => x[0] === to);
  return t ? t[1] : 'Missing';
}
export function mapTo(C, to, o = {}) {
  if (!isV3(C)) return v2MapTo(C, to, o);
  if (to && to.includes('.+')) {
    to = exposeExtra(C, to) || '';
    syncStages(C);
  }
  const info = targetInfo(C, to) || {};
  return Object.assign({ to, min: info.min ?? 0, max: info.max ?? 1, taper: 'lin', invert: false }, o);
}
/** A control's targets: its main one plus the extra ones. */
export const mappingsOf = (c) => [c.map, ...(c.more || [])].filter((m) => m && m.to);
export const COMBINES = [['avg', 'Average'], ['sum', 'Add up'], ['max', 'Highest'], ['min', 'Lowest']];
/** Every control (and expression jack) that drives target `to`. */
export function driversOf(D, to) {
  const out = [];
  for (const c of D.ctls) {
    mappingsOf(c).forEach((m) => m.to === to && out.push({ c, m }));
    (c.maps || []).forEach((m, i) => m && m.to === to && out.push({ c, m, sw: i }));
  }
  for (const j of D.jacks) (j.maps || []).forEach((m) => m && m.to === to && out.push({ j, m }));
  return out;
}

// ------------------------------------------------------------------ values
const TAPERS = { lin: (t) => t, audio: (t) => t * t, rev: (t) => 1 - (1 - t) * (1 - t), log: (t) => t };
export const TAPER_NAMES = [['lin', 'Linear'], ['log', 'Log'], ['audio', 'Audio'], ['rev', 'Reverse']];
export function mapValue(m, info, t) {
  t = clamp(t, 0, 1);
  if (m.invert) t = 1 - t;
  const lo = m.min ?? info?.min ?? 0, hi = m.max ?? info?.max ?? 1;
  let v;
  if (m.taper === 'log' && lo > 0 && hi > 0) v = lo * Math.pow(hi / lo, t);
  else v = lo + (hi - lo) * (TAPERS[m.taper] || TAPERS.lin)(t);
  if (m.offset) v += m.offset;
  if (info && (info.i || info.key === 'on')) v = Math.round(v);
  return v;
}

// ------------------------------------------------------------------ migration
const OLD = { boost: 'boost', drive: 'overdrive', dist: 'distortion', fuzz: 'fuzz', comp: 'comp', eq: 'amp', chorus: 'chorus', phaser: 'phaser', flanger: 'flanger', trem: 'tremolo', delay: 'delay', reverb: 'reverb', octave: 'octave', pitch: 'octave', filter: 'autowah', synth: 'synth' };
/** Bring d.circuit up to v3 (in place). Returns false: controls are already mapped afterwards. */
export function migrateCircuit(d) {
  if (isV3(d.circuit)) {
    const C = d.circuit;
    if (!Array.isArray(C.insts)) C.insts = [];
    if (!Array.isArray(C.wires)) C.wires = [];
    if (!Array.isArray(C.cwires)) C.cwires = [];
    for (const i of C.insts) if (!i.graph || !Array.isArray(i.graph.nodes)) i.graph = { nodes: [], wires: [] };
    for (const i of C.insts) migrateGraph(i.graph);
    if (!C.stages) syncStages(C);
    return false;
  }
  if (!d.circuit || d.circuit.v !== 2) {
    const old = d.circuit || {};
    d.circuit = makeCircuit(OLD[old.type] || 'overdrive').circuit;
    v2AutoMap(d);
  }
  v2ToV3(d);
  return false;
}
function v2ToV3(d) {
  const C2 = d.circuit;
  const refs = [], pend = [];
  const names = new Map();
  const nameFor = (c, info) => {
    let n = c && c.label ? titleCase(c.label) : info.label || 'Knob';
    const k = n.toLowerCase();
    names.set(k, (names.get(k) || 0) + 1);
    if (names.get(k) > 1) n += ' ' + names.get(k);
    return n;
  };
  const consider = (m, c) => {
    if (!m || !m.to || m.to === 'bypass' || m.to === 'mix' || m.to.endsWith('.tap')) return;
    const info = v2TargetInfo(C2, m.to);
    if (!info) {
      m.to = '';
      return;
    }
    const ref = { to: m.to, name: nameFor(c, info), def: 0.5 };
    let nm;
    if (Array.isArray(m.values) && m.values.length) {
      const lo = Math.min(...m.values), hi = Math.max(...m.values);
      Object.assign(ref, { lo, hi });
      nm = { values: m.values.map((v) => (hi === lo ? 0 : (v - lo) / (hi - lo))) };
    } else {
      const lo = m.min ?? info.min ?? 0, hi = m.max ?? info.max ?? 1;
      Object.assign(ref, { lo, hi, log: m.taper === 'log' && lo > 0 && hi > 0 });
      nm = { min: 0, max: 1, taper: m.taper === 'log' ? 'lin' : m.taper || 'lin', invert: !!m.invert };
    }
    pend.push({ m, i: refs.length, nm });
    refs.push(ref);
  };
  for (const c of d.ctls || []) {
    consider(c.map, c);
    (c.maps || []).forEach((m) => consider(m, c));
  }
  const { graph, knobs } = stagesToGraph(C2, refs);
  const inst = { id: uid('c'), ref: C2.tpl ? 'b.c-' + C2.tpl : null, ver: 1, name: C2.name || circuitById(C2.tpl)?.name || 'Circuit', graph, x: 0, y: 0, on: true };
  for (const { m, i, nm } of pend) {
    for (const k of ['min', 'max', 'values', 'taper', 'invert']) delete m[k];
    Object.assign(m, nm, { to: inst.id + '.' + knobs[i] });
  }
  for (const c of d.ctls || []) {
    for (const m of [c.map, ...(c.maps || [])]) if (m && m.to && m.to.endsWith('.tap')) m.to = inst.id + '.tap';
    if (c.kind === 'led' && c.bind && c.bind.startsWith('tap:')) c.bind = 'tap:' + inst.id;
  }
  d.circuit = { v: 3, insts: [inst], wires: [], cwires: [], mix: !!C2.mix, mixDef: C2.mixDef ?? 1, combine: {} };
  seriesWires(d);
  syncStages(d.circuit);
}
/** Wire every circuit in a row: first input jack -> circuits -> every output jack. */
export function seriesWires(d) {
  const C = d.circuit;
  const J = jackList(d);
  const W = (a, b) => C.wires.push({ id: uid('w'), a, b });
  C.wires = [];
  let src = J.ins.length ? [{ n: 'jack:' + J.ins[0].id, p: '' }] : [];
  for (const inst of C.insts) {
    const i = instAudioIns(inst)[0], o = instAudioOuts(inst)[0];
    if (!i || !o) continue;
    for (const s of src) W(s, { n: inst.id, p: i.id });
    src = [{ n: inst.id, p: o.id }];
  }
  for (const s of src) for (const j of J.outs) W(s, { n: 'jack:' + j.id, p: '' });
}
export function autoMap(d) {
  const C = d.circuit;
  if (!isV3(C)) return v2AutoMap(d);
  autoMapWith(d, (k) => targetsFor(C, k), (to) => mapTo(C, to), () => {
    const i = C.insts.find((x) => hasTap(x.graph));
    return i ? i.id + '.tap' : null;
  });
}

// ------------------------------------------------------------------ jacks and pedal wiring
// audio jacks in port order: inputs, then outputs (main out first)
export function portJacks(D) {
  const order = { out: 0, stereo: 1, phones: 2, xlr: 3 };
  return {
    ins: D.jacks.filter((j) => j.kind === 'in'),
    outs: D.jacks.filter((j) => isOutput(j.kind)).sort((a, b) => order[a.kind] - order[b.kind]),
    exps: D.jacks.filter((j) => j.kind === 'exp'),
  };
}
// like portJacks, with stand-ins when the pedal has no input or output jack (the block still has one)
export function jackList(D) {
  const p = portJacks(D);
  return {
    ins: p.ins.length ? p.ins : [{ id: '__in', kind: 'in', label: 'INPUT', virtual: true }],
    outs: p.outs.length ? p.outs : [{ id: '__out', kind: 'out', label: 'OUTPUT', virtual: true }],
    exps: p.exps,
  };
}
// the stand-ins follow the first real jack once there is one
export function resolveJack(J, id, dir) {
  const list = dir === 'in' ? J.ins : J.outs;
  const hit = list.find((j) => j.id === id);
  if (hit) return hit;
  if (id === '__in' || id === '__out') return list[0];
  return null;
}
const endOk = (D, J, e, dir) => {
  if (!e || !e.n) return false;
  if (e.n.startsWith('jack:')) return !!resolveJack(J, e.n.slice(5), dir === 'src' ? 'in' : 'out');
  const inst = instOf(D.circuit, e.n);
  if (!inst) return false;
  const n = inst.graph.nodes.find((x) => x.id === e.p);
  return !!n && PARTS[n.t]?.io === (dir === 'src' ? 'out' : 'in');
};
/** The pedal's audio wires that work, plus outputs nobody wired following the main output (auto). */
export function effectiveWires(D) {
  const C = D.circuit;
  if (!isV3(C)) return [];
  const J = jackList(D);
  const ws = C.wires.filter((w) => endOk(D, J, w.a, 'src') && endOk(D, J, w.b, 'dst'));
  const fed = (j) => ws.filter((w) => w.b.n.startsWith('jack:') && resolveJack(J, w.b.n.slice(5), 'out') === j);
  const main = J.outs.find((j) => fed(j).length);
  if (!main) return ws;
  const out = ws.slice();
  for (const j of J.outs) if (!fed(j).length) for (const w of fed(main)) out.push({ id: 'auto-' + j.id + '-' + w.id, a: w.a, b: { n: 'jack:' + j.id, p: '' }, auto: true });
  return out;
}

// ------------------------------------------------------------------ editing helpers (used by the circuit UI)
/** Add a library circuit to the pedal, wired in before the outputs. Returns the instance. */
export function addInstance(D, rec, at) {
  const C = D.circuit;
  const inst = { id: uid('c'), ref: rec.id || null, ver: rec.ver || 1, name: rec.name || 'Circuit', graph: clone(rec.graph), x: 0, y: 0, on: true };
  const n = C.insts.length;
  Object.assign(inst, at || { x: 0, y: n * 150 });
  const i = instAudioIns(inst)[0], o = instAudioOuts(inst)[0];
  const J = jackList(D);
  const intoOuts = effectiveWires(D).filter((w) => !w.auto && w.b.n.startsWith('jack:'));
  C.insts.push(inst);
  if (i && o) {
    if (intoOuts.length) {
      // insert before the outputs: what fed them now feeds the new circuit
      const srcs = [];
      for (const w of intoOuts) if (!srcs.some((s) => s.n === w.a.n && s.p === w.a.p)) srcs.push(w.a);
      const outsHit = [...new Set(intoOuts.map((w) => w.b.n))];
      const gone = new Set(intoOuts.map((w) => w.id));
      C.wires = C.wires.filter((w) => !gone.has(w.id));
      for (const s of srcs) C.wires.push({ id: uid('w'), a: s, b: { n: inst.id, p: i.id } });
      for (const b of outsHit) C.wires.push({ id: uid('w'), a: { n: inst.id, p: o.id }, b: { n: b, p: '' } });
    } else {
      C.wires.push({ id: uid('w'), a: { n: 'jack:' + J.ins[0].id, p: '' }, b: { n: inst.id, p: i.id } });
      for (const j of J.outs) C.wires.push({ id: uid('w'), a: { n: inst.id, p: o.id }, b: { n: 'jack:' + j.id, p: '' } });
    }
  }
  syncStages(C);
  return inst;
}
/** Remove a circuit from the pedal; what fed it now feeds what it fed. */
export function removeInstance(D, id) {
  const C = D.circuit;
  const ins = C.wires.filter((w) => w.b.n === id), outs = C.wires.filter((w) => w.a.n === id);
  C.wires = C.wires.filter((w) => w.a.n !== id && w.b.n !== id);
  for (const a of ins) for (const b of outs) if (!C.wires.some((w) => w.a.n === a.a.n && w.a.p === a.a.p && w.b.n === b.b.n && w.b.p === b.b.p)) C.wires.push({ id: uid('w'), a: a.a, b: b.b });
  C.insts = C.insts.filter((i) => i.id !== id);
  pruneTargets(D);
  syncStages(C);
}
/** New graph for an instance (after editing its circuit): drops wiring that no longer has an end. */
export function setInstanceGraph(D, inst, graph, o = {}) {
  inst.graph = clone(graph);
  Object.assign(inst, o);
  const J = jackList(D);
  D.circuit.wires = D.circuit.wires.filter((w) => endOk(D, J, w.a, 'src') && endOk(D, J, w.b, 'dst'));
  pruneTargets(D);
  syncStages(D.circuit);
}
/** Mappings whose target is gone are cleared. */
export function pruneTargets(D) {
  const C = D.circuit;
  const ok = (m) => !m || !m.to || m.to === 'bypass' || !!targetInfo(C, m.to);
  for (const c of D.ctls) {
    if (c.map && !ok(c.map)) c.map = { to: '' };
    if (c.more) c.more = c.more.filter((m) => m && m.to && ok(m));
    if (c.maps) c.maps = c.maps.map((m) => (ok(m) ? m : null));
    if (c.kind === 'led' && c.bind && c.bind.startsWith('tap:') && !instOf(C, c.bind.slice(4))) c.bind = 'on';
  }
  for (const j of D.jacks) if (j.maps) j.maps = j.maps.filter((m) => m && m.to && ok(m));
  if (C.combine) for (const k of Object.keys(C.combine)) if (!targetInfo(C, k)) delete C.combine[k];
  // control wiring of circuit outputs: ends that are gone are dropped
  const outs = new Set(circuitOutputs(D).map((o) => o.key));
  const outOk = (e) => !!e && outs.has(outKey(e));
  const inOk = (e) => !!e && !!instOf(C, e.n) && instInputs(instOf(C, e.n)).some((k) => k.id === e.p);
  C.cwires = (C.cwires || []).filter((w) => outOk(w.a) && inOk(w.b) && w.a.n !== w.b.n);
  for (const c of D.ctls) {
    if (c.kind === 'led' && c.bind && c.bind.startsWith('cv:') && !outs.has(c.bind.slice(3))) c.bind = 'on';
    if (c.sio) {
      for (const p of c.sio.ins || []) if (p.from && !outOk(p.from)) p.from = null;
      for (const p of c.sio.outs || []) if (p.maps) p.maps = p.maps.filter((m) => m && m.to && ok(m));
    }
  }
  for (const j of D.jacks) if (j.from && !outOk(j.from)) delete j.from;
}
/** Add a mapping from control c to target `to` (its main one if it has none). */
export function addMapping(D, c, to, o = {}) {
  if (mappingsOf(c).some((x) => x.to === to)) return null;
  const m = mapTo(D.circuit, to, o);
  if (!c.map || !c.map.to || (c.map.to === 'bypass' && c.kind === 'foot')) c.map = m;
  else c.more = [...(c.more || []), m];
  return m;
}
/** Remove mapping number i of control c (0 = the main one). */
export function removeMapping(c, i) {
  const all = [c.map, ...(c.more || [])];
  all.splice(i, 1);
  const rest = all.filter((m) => m && m.to);
  c.map = rest.shift() || (c.kind === 'foot' ? { to: 'bypass' } : { to: '' });
  c.more = rest;
}

// ------------------------------------------------------------------ compiling to the engine
const portIdx = (list, key) => Math.max(0, list.findIndex((x) => x[0] === key));
// the span a control input reads as 0..1 when it drives a part value: its own range
function ownSpan(n) {
  if (!n || PARTS[n.t]?.io !== 'ctl') return null;
  const info = knobInfo(n);
  return { xlo: info.min, xhi: info.max };
}
function slotFor(p, v, w, src) {
  if (p.raw) return { p: p.key, def: v, lo: p.min, hi: p.max, raw: true };
  const s = { p: p.key, def: v, lo: p.min, hi: p.max, log: !!p.l, int: !!p.i };
  if (w) {
    const sp = ownSpan(src);
    const xlo = w.xlo ?? (sp ? sp.xlo : 0), xhi = w.xhi ?? (sp ? sp.xhi : 1);
    if (xlo !== 0 || xhi !== 1) Object.assign(s, { xlo, xhi });
    if (w.lo != null) s.lo = w.lo;
    if (w.hi != null) s.hi = w.hi;
    if (w.log != null) s.log = !!w.log;
    if (Array.isArray(w.tab) && w.tab.length) s.tab = w.tab.slice();
  }
  return s;
}
/** One engine 'patch' node (its opts) for the whole pedal. */
export function compilePatch(D) {
  const C = D.circuit;
  const J = jackList(D);
  const E = { params: [], nodes: [], edges: [], outs: [] };
  const addParam = (name, def, min, max) => E.params.push({ name, def, min, max }) - 1;
  const add = (n) => E.nodes.push(n) - 1;
  const ain = J.ins.map((_, i) => add({ k: 'ain', idx: i }));
  const ew = effectiveWires(D);
  const outJack = (w) => J.outs.indexOf(resolveJack(J, w.b.n.slice(5), 'out'));
  // a PHONES jack wired L and R on their own gets an engine output per side
  const split = J.outs.map((j, i) => j.kind === 'phones' && ew.some((w) => w.b.n.startsWith('jack:') && outJack(w) === i && (w.b.p === 'L' || w.b.p === 'R')));
  const aout = J.outs.map((_, i) => add({ k: 'aout', idx: i }));
  const aoutR = J.outs.map((_, i) => (split[i] ? add({ k: 'aout', idx: J.outs.length + i }) : aout[i]));
  const maps = new Map();
  const outsList = circuitOutputs(D);
  const outIdx = new Map(outsList.map((o) => [o.key, o.idx]));
  const fedIns = new Set((C.cwires || []).map((w) => outKey(w.b)));
  const coutNode = new Map(); // '<inst>.<node>' -> engine node
  C.insts.forEach((inst, gi) => {
    const G = inst.graph;
    const by = new Map(G.nodes.map((n) => [n.id, n]));
    const idx = new Map(), slotsOf = new Map();
    const wired = new Map();
    for (const w of G.wires) {
      if (!w.b.p.startsWith('@')) continue;
      if (!wired.has(w.b.n)) wired.set(w.b.n, new Map());
      if (!wired.get(w.b.n).has(w.b.p.slice(1))) wired.get(w.b.n).set(w.b.p.slice(1), w);
    }
    const onNode = add({ k: 'param', pi: addParam(inst.id + '.on', inst.on === false ? 0 : 1, 0, 1) });
    for (const n of G.nodes) {
      const pt = PARTS[n.t];
      if (!pt || pt.io === 'note') continue;
      if (pt.io === 'in') idx.set(n.id, add({ k: 'sum' }));
      else if (pt.io === 'out') idx.set(n.id, add({ k: 'bypass', slots: [{ p: 'on', def: 1, lo: 0, hi: 1 }] }));
      else if (pt.io === 'ctl') {
        const info = knobInfo(n);
        const lo = Math.min(info.min, info.max), hi = Math.max(info.min, info.max);
        const pn = { k: 'param', pi: addParam(inst.id + '.' + n.id, clamp(n.def ?? info.def, lo, hi), lo, hi) };
        // fed by another circuit's output: the wire wins over the param
        if (fedIns.has(inst.id + '.' + n.id)) pn.slots = [{ p: 'in', def: 0, lo: -LIM, hi: LIM, raw: true }];
        idx.set(n.id, add(pn));
      } else if (pt.io === 'cout') {
        const ni = add({ k: 'cout', idx: outIdx.get(inst.id + '.' + n.id) ?? 0, slots: [{ p: 'in', def: 0, lo: -LIM, hi: LIM, raw: true }] });
        idx.set(n.id, ni);
        slotsOf.set(n.id, new Map([['in', 0]]));
        coutNode.set(inst.id + '.' + n.id, ni);
      } else {
        const slots = [], sm = new Map(), fixed = {};
        const wp = wired.get(n.id) || new Map();
        for (const p of pt.params) {
          const v = val(n, p), w = wp.get(p.key);
          if (pt.native || w || p.key === 'on') {
            sm.set(p.key, slots.length);
            slots.push(slotFor(p, v, w, w && by.get(w.a.n)));
          } else fixed[p.key] = v;
        }
        let en;
        if (pt.native) en = { k: pt.native, slots };
        else {
          const st = STAGES[n.t];
          const opts = Object.assign({}, st.opts || {});
          if (n.voice && st.algo === 'drive') opts.clip = n.voice;
          if (n.voice && st.algo === 'comp') opts.type = n.voice;
          if (n.opts) Object.assign(opts, n.opts);
          en = { k: 'algo', algo: st.algo, opts, params: fixed, slots };
        }
        if (pt.tap) en.tap = gi;
        idx.set(n.id, add(en));
        slotsOf.set(n.id, sm);
      }
    }
    for (const w of G.wires) {
      const na = by.get(w.a.n), nb = by.get(w.b.n);
      if (!na || !nb || !idx.has(na.id) || !idx.has(nb.id)) continue;
      const ka = portKind(na, w.a.p, true), kb = portKind(nb, w.b.p, false);
      if (!ka || ka !== kb) continue;
      if (ka === 'a') E.edges.push([idx.get(na.id), portIdx(PARTS[na.t].aout, w.a.p), idx.get(nb.id), portIdx(PARTS[nb.t].ain, w.b.p), 0]);
      else {
        const si = slotsOf.get(nb.id)?.get(w.b.p.slice(1));
        if (si != null) E.edges.push([idx.get(na.id), portIdx(PARTS[na.t].cout, w.a.p), idx.get(nb.id), si, 1]);
      }
    }
    // each audio out crossfades to the circuit's dry input when the circuit is switched off
    const first = ioNodes(G, 'in')[0];
    for (const o of ioNodes(G, 'out')) {
      if (first) E.edges.push([idx.get(first.id), 0, idx.get(o.id), 1, 0]);
      E.edges.push([onNode, 0, idx.get(o.id), 0, 1]);
    }
    maps.set(inst.id, idx);
  });
  for (const w of ew) {
    const a = w.a.n.startsWith('jack:') ? ain[J.ins.indexOf(resolveJack(J, w.a.n.slice(5), 'in'))] : maps.get(w.a.n)?.get(w.a.p);
    if (a == null) continue;
    if (w.b.n.startsWith('jack:')) {
      const i = outJack(w);
      if (i < 0) continue;
      if (w.b.p !== 'R') E.edges.push([a, 0, aout[i], 0, 0]);
      if (split[i] && w.b.p !== 'L') E.edges.push([a, 0, aoutR[i], 0, 0]);
    } else {
      const b = maps.get(w.b.n)?.get(w.b.p);
      if (b != null) E.edges.push([a, 0, b, 0, 0]);
    }
  }
  // circuit outputs into other circuits' inputs
  for (const w of C.cwires || []) {
    const a = coutNode.get(outKey(w.a)), b = maps.get(w.b.n)?.get(w.b.p);
    if (a != null && b != null && fedIns.has(outKey(w.b))) E.edges.push([a, 0, b, 0, 1]);
  }
  // engine outputs: a stereo pair is OUT = left, STEREO = right; phones carry both (or a mono mix per side when
  // they are wired on their own); anything else a mono sum
  const hasPair = J.outs.some((j) => j.kind === 'stereo') && J.outs.some((j) => j.kind === 'out');
  J.outs.forEach((j, i) => {
    if (j.kind === 'phones') E.outs.push(split[i] ? [i, -1] : [i, 0], split[i] ? [J.outs.length + i, -1] : [i, 1]);
    else E.outs.push([i, hasPair && j.kind === 'out' ? 0 : hasPair && j.kind === 'stereo' ? 1 : -1]);
  });
  if (C.mix) Object.assign(E, { mix: true, mixDef: C.mixDef ?? 1 });
  return E;
}

// ------------------------------------------------------------------ the block definition
const fmtV = (v, info) => {
  if (!info) return '';
  if (info.opts && info.i) return info.opts[Math.round(v) - (info.min || 0)] ?? String(Math.round(v));
  if (info.i) return String(Math.round(v));
  if (info.unit === 'ms') return v >= 1000 ? (v / 1000).toFixed(2) + ' s' : Math.round(v) + ' ms';
  if (info.unit === 'dB' || (info.min < 0 && info.max > 0 && info.max >= 12)) return (v > 0 ? '+' : '') + v.toFixed(1) + ' dB';
  if (info.max > 20) return String(Math.round(v));
  return ((v - (info.min || 0)) / ((info.max - info.min) || 1) * 10).toFixed(1);
};
// the delay time an instance's tap LED blinks at: the first tap part's time, from a control input or fixed
function tapTime(inst) {
  const n = inst.graph.nodes.find((x) => STAGES[x.t]?.tap);
  if (!n) return { knob: null, ms: () => 400 };
  const p = STAGES[n.t].params.find((q) => q.key === 'time');
  const w = inst.graph.wires.find((x) => x.b.n === n.id && x.b.p === '@time');
  const k = w && inst.graph.nodes.find((x) => x.id === w.a.n && PARTS[x.t]?.io === 'ctl');
  const fixed = val(n, p);
  if (!k) return { knob: null, ms: () => fixed };
  const lo = w.lo ?? p.min, hi = w.hi ?? p.max, log = w.log ?? !!p.l;
  return { knob: inst.id + '.' + k.id, def: k.def ?? 0.5, ms: (x) => (log && lo > 0 ? lo * Math.pow(hi / lo, clamp(x, 0, 1)) : lo + (hi - lo) * clamp(x, 0, 1)) };
}

/** Build a catalog block definition from a factory design. */
export function designToDef(design, o = {}) {
  const D = clone(design);
  migrateCircuit(D);
  const C = D.circuit;
  const opts = compilePatch(D);
  const couts = circuitOutputs(D);
  const coutOf = new Map(couts.map((x) => [x.key, x]));
  // every exposed value is sent, so a changed default reaches a running engine
  const fixed = {};
  for (const p of opts.params) fixed[p.name] = p.def;
  if (C.mix) fixed.mix = C.mixDef ?? 1;

  const { ins, outs } = jackList(D);
  const jackKinds = {};
  outs.forEach((j, i) => {
    if (j.kind === 'phones') jackKinds['o' + i] = 'phones';
    if (j.kind === 'xlr') jackKinds['o' + i] = 'xlr';
  });
  const ports = { ins: ins.map((j, i) => (j.virtual ? 'INPUT' : j.label || (ins.length > 1 ? 'IN ' + (i + 1) : 'INPUT'))), outs: outs.map((j) => (j.virtual ? 'OUTPUT' : j.label || 'OUTPUT')) };

  // controls and their mappings
  const controls = [];
  const maps = []; // {key, n, def, m, info, to, opt}
  const knobLike = { knob: 'knob', trim: 'knob', slider: 'slider', pedal: 'treadle' };
  const instIndex = (to) => C.insts.findIndex((i) => to.startsWith(i.id + '.'));
  const disp = (list) => (v) => {
    const m = list.find((x) => x && x.to);
    const info = m && targetInfo(C, m.to);
    return m && info && !info.tap ? fmtV(mapValue(m, info, v), info) : (v * 10).toFixed(1);
  };
  const addMaps = (key, n, def, list, opt) => {
    for (const m of list) {
      if (!m || !m.to || m.to === 'bypass' || m.to.endsWith('.tap')) continue;
      const info = targetInfo(C, m.to);
      if (info && !info.tap) maps.push({ key, n, def, m, info, to: m.to, opt });
    }
  };
  let tapSub = null;
  for (const c of D.ctls) {
    if (c.hidden) continue;
    const key = 'u.' + c.id;
    const list = mappingsOf(c);
    const base = { cid: c.id, label: c.label || '', virtual: true };
    if (knobLike[c.kind]) {
      const v0 = c.value ?? 0.5;
      controls.push(Object.assign(base, { t: knobLike[c.kind], p: key, min: 0, max: 1, def: v0, display: disp(list) }, c.kind === 'slider' ? { h: (c.h || 24) * S, orient: c.orient } : {}, c.kind === 'pedal' ? { h: (c.h || 60) * S, w: (c.w || 40) * S } : {}));
      addMaps(key, 0, v0, list);
    } else if (c.kind === 'toggle' || c.kind === 'sel') {
      const n = c.kind === 'toggle' ? c.ways : c.n || 4;
      const ol = (c.opts || []).slice(0, n);
      while (ol.length < n) ol.push(String(ol.length + 1));
      controls.push(Object.assign(base, { t: c.kind === 'toggle' ? 'toggle' : 'sel', p: key, options: ol, def: c.pos || 0 }));
      addMaps(key, n, c.pos || 0, list);
    } else if (c.kind === 'button') {
      const m = c.map;
      if (m && m.to && m.to.endsWith('.tap')) controls.push(Object.assign(base, { t: 'button', event: { type: 1, arg: Math.max(0, instIndex(m.to)) * 100 }, virtual: undefined }));
      else {
        controls.push(Object.assign(base, { t: 'button', toggle: true, p: key, def: c.on ? 1 : 0, led: c.led, ledColor: c.ledColor }));
        addMaps(key, 2, c.on ? 1 : 0, list);
      }
    } else if (c.kind === 'foot') {
      const to = c.map ? c.map.to : 'bypass';
      if (!to || to === 'bypass') controls.push(Object.assign(base, { t: 'foot', action: 'bypass', virtual: undefined }));
      else if (to.endsWith('.tap')) {
        const idx = Math.max(0, instIndex(to));
        if (tapSub == null) tapSub = idx;
        controls.push(Object.assign(base, { t: 'foot', action: 'tap', tapSub: idx, tapTarget: '_tap', virtual: undefined }));
      } else {
        // latching footswitch (a circuit on / off by default)
        const inst = to.endsWith('.on') ? instOf(C, to.slice(0, -3)) : null;
        const def0 = inst ? (inst.on !== false ? 1 : 0) : 1;
        controls.push(Object.assign(base, { t: 'foot', action: 'toggle', p: key, def: def0 }));
        addMaps(key, 2, def0, list);
      }
    } else if (c.kind === 'dip') {
      const n = c.n || 4;
      for (let i = 0; i < n; i++) {
        const k2 = key + '.' + i;
        controls.push({ cid: c.id + '.' + i, t: 'toggle', p: k2, options: ['OFF', 'ON'], def: c.bits?.[i] ? 1 : 0, virtual: true, label: (c.label || 'DIP') + ' ' + (i + 1) });
        addMaps(k2, 2, c.bits?.[i] ? 1 : 0, [(c.maps || [])[i]]);
      }
    } else if (c.kind === 'xy') {
      // XY pad / joystick (factory-kinds.js): one slider per axis, wired by c.maps[0] and c.maps[1]
      for (const x of xyControls(c, S)) {
        controls.push(Object.assign(x.ctl, { display: disp([x.map]) }));
        addMaps(x.ctl.p, 0, x.ctl.def, [x.map]);
      }
    } else if (c.kind === 'led') {
      const bind = c.bind || 'on';
      const l = { cid: c.id, t: 'led', color: c.color, label: '' };
      if (bind === 'on') l.bind = 'on';
      else if (bind === 'always') Object.assign(l, { bind: 'fn', ledFn: () => true });
      else if (bind === 'off') Object.assign(l, { bind: 'fn', ledFn: () => null });
      else if (bind.startsWith('ctl:')) {
        const src = D.ctls.find((x) => x.id === bind.slice(4));
        const k3 = 'u.' + bind.slice(4);
        const n = src ? (src.kind === 'toggle' ? src.ways : src.kind === 'sel' ? src.n || 4 : 2) : 2;
        const knob = src && knobLike[src.kind];
        Object.assign(l, { bind: 'fn', ledFn: (ui, b) => !b.bypass && ((ui[k3] ?? 0) / (knob ? 1 : Math.max(1, n - 1))) > (knob ? 0.05 : 0.5) });
      } else if (bind.startsWith('tap:')) l.bind = 'tap:_tap.' + bind.slice(4);
      else if (bind.startsWith('cv:')) {
        // a circuit output: binary lights it, analog sets its brightness (from the engine status cv[idx])
        const co = coutOf.get(bind.slice(3));
        if (co) Object.assign(l, { bind: 'fn', cv: co.idx, ledFn: cvLed(co, c.color) });
        else Object.assign(l, { bind: 'fn', ledFn: () => null });
      }
      controls.push(l);
    }
  }
  // board hints for the extra control types (factory-kinds.js)
  const byId = new Map(D.ctls.map((c) => [c.id, c]));
  for (const x of controls) {
    const c = byId.get(x.cid) || byId.get(String(x.cid).split('.')[0]);
    if (!c || !c.part) continue;
    x.part = c.part;
    if (c.part === 'lever' || c.part === 'pad') x.spring = true;
    if (c.part === 'arcade') x.momentary = true;
    if (c.part === 'encoder') x.endless = true;
  }
  // expression jacks: move a control (j.drive) or drive circuit inputs directly (j.maps)
  const ctrlIns = [], ctrlOuts = [];
  for (const j of ctlJacks(D)) {
    if (jackIsOut(j)) {
      // driven by a circuit output: an expression or footswitch OUT on the board
      const co = j.from && coutOf.get(outKey(j.from));
      if (co) ctrlOuts.push({ label: j.label || (j.kind === 'fsw' ? 'FS OUT' : 'EXP OUT'), source: 'cv', cv: co.idx, sig: j.kind === 'fsw' ? 'b' : co.sig, lo: co.sig === 'b' ? 0 : co.min, hi: co.sig === 'b' ? 1 : co.max, _jack: j.id });
      continue;
    }
    if (j.kind === 'fsw') {
      // a footswitch plugged in: tip (the cable's switch) and ring, each 0 or 1
      const key = 'u.f.' + j.id;
      ctrlIns.push({ label: j.label || 'FS', param: key, min: 0, max: 1, _jack: j.id });
      addMaps(key, 0, undefined, (j.maps || []).filter((m) => m && (m.ch || 't') === 't'), true);
      addMaps(key + '.r', 0, undefined, (j.maps || []).filter((m) => m && m.ch === 'r'), true);
      continue;
    }
    if (j.maps && j.maps.length) {
      const key = 'u.x.' + j.id;
      ctrlIns.push({ label: j.label || 'EXP', param: key, min: 0, max: 1, _jack: j.id });
      addMaps(key, 0, undefined, j.maps, true);
      continue;
    }
    const tgt = D.ctls.find((c) => c.id === j.drive) || D.ctls.find((c) => c.kind === 'pedal') || D.ctls.find((c) => c.kind === 'knob');
    if (tgt && knobLike[tgt.kind]) ctrlIns.push({ label: j.label || 'EXP', param: 'u.' + tgt.id, min: 0, max: 1, _jack: j.id });
  }
  // screens: their outputs drive circuit inputs (values set by the script, as they are), their inputs read outputs
  const screenIO = {};
  for (const c of D.ctls) {
    if (c.kind !== 'screen' || !c.sio) continue;
    const sio = screenIO[c.id] = { ins: [], outs: [] };
    (c.sio.ins || []).slice(0, SCREEN_PORTS).forEach((p, i) => {
      const co = p.from && coutOf.get(outKey(p.from));
      sio.ins.push({ name: p.name || 'In ' + (i + 1), sig: p.sig === 'b' ? 'b' : 'n', cv: co ? co.idx : null });
    });
    (c.sio.outs || []).slice(0, SCREEN_PORTS).forEach((p, i) => {
      const key = 'u.s.' + c.id + '.' + i;
      sio.outs.push({ name: p.name || 'Out ' + (i + 1), sig: p.sig === 'b' ? 'b' : 'n', p: key, def: p.def ?? 0 });
      addMaps(key, 0, undefined, (p.maps || []).map((m) => m && { ...m, raw: true }), true);
    });
  }
  const taps = C.insts.filter((i) => hasTap(i.graph)).map((i) => ({ id: i.id, ...tapTime(i) }));
  const combine = C.combine || {};
  const derive = (ui) => {
    const got = new Map();
    for (const x of maps) {
      let v = ui[x.key];
      if (v == null) {
        if (x.opt) continue; // nothing plugged into the expression jack
        v = x.def;
      }
      const r = x.m.raw ? clamp(+v || 0, -LIM, LIM) : x.n && Array.isArray(x.m.values) && x.m.values.length ? x.m.values[clamp(Math.round(v), 0, x.m.values.length - 1)] : mapValue(x.m, x.info, x.n ? v / Math.max(1, x.n - 1) : v);
      if (!got.has(x.to)) got.set(x.to, []);
      got.get(x.to).push(r);
    }
    const out = {};
    for (const [to, vs] of got) {
      const info = targetInfo(C, to) || { min: 0, max: 1 };
      const how = combine[to] || 'avg';
      let v = how === 'max' ? Math.max(...vs) : how === 'min' ? Math.min(...vs) : vs.reduce((a, b) => a + b, 0) / (how === 'avg' ? vs.length : 1);
      v = clamp(v, Math.min(info.min ?? 0, info.max ?? 1), Math.max(info.min ?? 0, info.max ?? 1));
      if (info.i) v = Math.round(v);
      out[to] = v;
    }
    for (const t of taps) {
      const k = t.knob ? out[t.knob] ?? t.def : 0.5;
      out['_tap.' + t.id] = t.ms(k);
    }
    return out;
  };
  const mat = D.enc.mat || {};
  const graphs = C.insts.map((i) => i.graph);
  const cost = 0.1 + graphs.reduce((a, g) => a + graphCost(g) - 0.1, 0);
  const names = [...new Set(graphs.flatMap(graphNames))];
  const instNames = C.insts.map((i) => i.name || 'Circuit');
  const cats = [...new Set(graphs.map(graphCat))];
  const def = {
    id: o.id || D.blockId || 'custom.' + uid('x'),
    name: D.name || 'Custom pedal',
    code: D.name || 'Custom',
    kind: 'Custom',
    cat: o.cat || (cats.length === 1 ? cats[0] : cats.length ? 'Multi-FX' : 'Utility'),
    brand: 'Custom',
    typeName: instNames.join(' + ') || 'Custom pedal',
    desc: (D.desc ? D.desc + ' ' : '') + 'Made in the Pedal Factory: ' + (instNames.join(' into ') || 'clean pass-through') + '.',
    form: 'custom',
    design: D,
    color: /^#[0-9a-f]{6}$/i.test(mat.c || '') ? mat.c : '#555555',
    algo: 'patch',
    opts,
    fixed,
    derive,
    ports,
    jackKinds,
    stereo: 'mono',
    cost,
    controls,
    noBypassClick: true,
    tags: ['custom', 'factory', ...names.map((n) => n.toLowerCase())],
  };
  if (tapSub != null) def.tapSub = tapSub;
  if (ctrlIns.length || ctrlOuts.length) def.ctrl = { ins: ctrlIns, outs: ctrlOuts };
  if (couts.length) def.couts = couts.map((x) => ({ key: x.key, name: x.name, sig: x.sig, idx: x.idx, min: x.min, max: x.max }));
  if (Object.keys(screenIO).length) def.screenIO = screenIO;
  if (o.hidden) def.hidden = true;
  return def;
}

// an LED driven by circuit output co: ledFn(ui, block, status) -> true | colour | null
const hex2 = (n) => Math.round(clamp(n, 0, 255)).toString(16).padStart(2, '0');
function dimmed(col, k) {
  const m = /^#?([0-9a-f]{6})$/i.exec(col || '');
  const c = m ? m[1] : 'ff2a1a';
  const off = 0.22;
  const f = off + (1 - off) * k;
  return '#' + [0, 2, 4].map((i) => hex2(parseInt(c.slice(i, i + 2), 16) * f)).join('');
}
export function cvLed(co, color) {
  return (ui, b, st) => {
    if (b && b.bypass) return null;
    const v = st && Array.isArray(st.cv) ? st.cv[co.idx] : undefined;
    if (typeof v !== 'number') return null;
    if (co.sig === 'b') return v > 0.5 ? true : null;
    const k = clamp((v - co.min) / ((co.max - co.min) || 1), 0, 1);
    if (k < 0.02) return null;
    return k > 0.98 ? true : dimmed(color, k);
  };
}
/** Value of circuit output idx from a block's status (undefined when the engine has not said). */
export const cvValue = (st, idx) => (st && Array.isArray(st.cv) && typeof st.cv[idx] === 'number' ? st.cv[idx] : undefined);

/** A pedal design that plays one circuit alone (Test circuit in the editor): its inputs stay at their defaults. */
export function soloDesign(graph, name) {
  const inst = { id: 'csolo', ref: null, name: name || 'Circuit', graph: clone(graph), x: 0, y: 0, on: true };
  const d = {
    name: name || 'Circuit', enc: { w: 60, h: 100, mat: {} }, labels: {}, ctls: [], art: [], title: {}, sub: {},
    jacks: [{ id: 'jin', kind: 'in', edge: 'right', t: 0.3, label: 'IN' }, { id: 'jout', kind: 'out', edge: 'left', t: 0.3, label: 'OUT' }, { id: 'jst', kind: 'stereo', edge: 'left', t: 0.6, label: 'OUT R' }],
    circuit: { v: 3, insts: [inst], wires: [], cwires: [], combine: {} },
  };
  migrateGraph(inst.graph);
  seriesWires(d);
  syncStages(d.circuit);
  return d;
}
