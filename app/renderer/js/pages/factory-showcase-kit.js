// Pedal Factory: a small builder for template designs (factory-showcase*.js): circuits with control inputs and
// outputs, screens and the finishing touches every template needs.
import { newNode, nid } from './circuit-parts.js';
import { seriesWires, syncStages } from './factory-circuit.js';

export const uid = (p) => p + Math.random().toString(36).slice(2, 8);

// ------------------------------------------------------------------ a small circuit builder
// const c = circuit('Name'); const n = c.part('overdrive', x, y, params); c.chain([in, n, out]);
// c.input('Gain', node, 'gain', {lo, hi, log}) -> target string for a control map
export function circuit(name) {
  const inst = { id: uid('c'), ref: null, ver: 1, name, graph: { nodes: [], wires: [] }, x: 0, y: 0, on: true };
  const G = inst.graph;
  let iy = 170;
  const api = {
    inst,
    node(t, x, y, o = {}) {
      const n = newNode(t, x, y, o);
      G.nodes.push(n);
      return n;
    },
    part(t, x, y, p = {}) {
      const n = api.node(t, x, y);
      Object.assign(n.p, p);
      return n;
    },
    wire(a, ap, b, bp, o = {}) {
      G.wires.push({ id: nid('w'), a: { n: a.id, p: ap }, b: { n: b.id, p: bp }, ...o });
    },
    // audio through the nodes in order (each node's 'out' into the next one's 'in')
    chain(list) {
      for (let i = 1; i < list.length; i++) api.wire(list[i - 1], 'out', list[i], list[i].t === 'xfade' ? 'b' : 'in');
    },
    /** A control input (0 to 1) wired to one or more part values. Returns the target for a control map. */
    input(name, def, targets, o = {}) {
      const k = api.node(o.bin ? 'binary' : 'analog', 40, (iy += 64), o.bin ? { name, def: def ? 1 : 0 } : { name, def, min: o.min ?? 0, max: o.max ?? 1, steps: 0 });
      for (const [n, key, w] of targets) api.wire(k, 'cv', n, '@' + key, w || {});
      return { to: inst.id + '.' + k.id, node: k };
    },
    /** A circuit output (Analog output part) fed by a control signal. Returns { n, p } for a screen input. */
    out(name, src, port = 'cv') {
      const o = api.node('anaout', 900, (iy += 40), { name, min: 0, max: 1 });
      api.wire(src, port, o, '@in');
      return { n: inst.id, p: o.id };
    },
  };
  return api;
}
export const knobMap = (t) => ({ to: t.to, min: 0, max: 1, taper: 'lin', invert: false });
export const valsMap = (t, n) => ({ to: t.to, values: [...Array(n)].map((_, i) => (n > 1 ? i / (n - 1) : 0)) });
export const binMap = (t) => ({ to: t.to, min: 0, max: 1, taper: 'lin', invert: false });
export function finish(d, insts) {
  for (const c of d.ctls) if (c.kind === 'foot' && !c.map) c.map = { to: 'bypass' };
  d.circuit = { v: 3, insts, wires: [], cwires: [], mix: false, mixDef: 1, combine: {} };
  seriesWires(d);
  syncStages(d.circuit);
  return d;
}
export const screen = (x, y, w, h, type, script, o = {}) => ({ id: uid('s'), kind: 'screen', x, y, w, h, type, text: '', label: '', labelPos: 'none', shows: 'custom', script, res: 4, ...o });

