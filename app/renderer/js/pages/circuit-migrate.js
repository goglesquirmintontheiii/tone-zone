// Older Pedal Factory circuits (v2: a list of stages, every control mapped to one stage value) and how they
// turn into circuit graphs (v3). The v2 helpers stay here so old designs, templates and saved blocks load.
import { clamp } from '../util.js';
import { STAGES, newNode, nid, clone } from './circuit-parts.js';

const uid = (p) => p + Math.random().toString(36).slice(2, 6);

export function stageParam(type, key) {
  return (STAGES[type]?.params || []).find((p) => p.key === key);
}
export function newStage(type, o = {}) {
  return Object.assign({ id: uid('s'), type, on: true, par: false, params: {}, voice: STAGES[type]?.opts?.clip || STAGES[type]?.opts?.type || '' }, o);
}

// ------------------------------------------------------------------ v2 circuit templates
// k = knobs, t = toggles / selectors, f = footswitches. Targets use the stage index: '0.gain' = first stage's gain.
const T = (id, name, cat, desc, stages, ctl, o = {}) => ({ id, name, cat, desc, stages, ctl, ...o });
export const CIRCUITS = [
  T('boost', 'Clean boost', 'Boost', 'More volume, a little sparkle', [['boost', { params: { gain: 0.6 } }]], { k: [['LEVEL', '0.level'], ['TONE', '0.treble']] }),
  T('overdrive', 'Overdrive', 'Overdrive', 'Warm mid push, like a tube screamer', [['overdrive']], { k: [['LEVEL', '0.level'], ['TONE', '0.tone'], ['DRIVE', '0.gain']] }),
  T('distortion', 'Distortion', 'Distortion', 'Hard clipping with a filter knob', [['distortion'], ['gate', { params: { threshold: 0.15 } }]], { k: [['DIST', '0.gain'], ['FILTER', '0.tone'], ['VOLUME', '0.level']] }),
  T('fuzz', 'Fuzz', 'Fuzz', 'Big, woolly sustain', [['fuzz']], { k: [['VOLUME', '0.level'], ['TONE', '0.tone'], ['SUSTAIN', '0.gain']] }),
  T('amp', 'Amp in a box', 'Overdrive', 'Gain and a 3 band EQ', [['amp']], { k: [['GAIN', '0.gain'], ['BASS', '0.bass'], ['MID', '0.mid'], ['TREBLE', '0.treble'], ['LEVEL', '0.level']] }),
  T('comp', 'Compressor', 'Dynamics', 'Even, squashed sustain', [['comp']], { k: [['LEVEL', '0.level'], ['SUSTAIN', '0.sustain'], ['ATTACK', '0.attack'], ['BLEND', '0.blend']] }),
  T('chorus', 'Chorus', 'Modulation', 'Shimmery doubled sound', [['chorus']], { k: [['RATE', '0.rate'], ['DEPTH', '0.depth'], ['MIX', '0.mix']], t: [['MODE', '0.mode', ['CHO', 'VIB']]] }),
  T('phaser', 'Phaser', 'Modulation', 'Swirling notches', [['phaser']], { k: [['SPEED', '0.rate'], ['DEPTH', '0.depth'], ['REGEN', '0.feedback']] }),
  T('flanger', 'Flanger', 'Modulation', 'Jet plane sweep', [['flanger']], { k: [['MANUAL', '0.manual'], ['WIDTH', '0.width'], ['SPEED', '0.speed'], ['REGEN', '0.regen']] }),
  T('tremolo', 'Tremolo', 'Modulation', 'Pulsing volume', [['tremolo']], { k: [['RATE', '0.rate'], ['DEPTH', '0.depth'], ['SHAPE', '0.wave']] }),
  T('vibe', 'Vibe', 'Modulation', 'Throbbing photocell phase', [['vibe']], { k: [['SPEED', '0.speed'], ['INTENSITY', '0.intensity']], t: [['MODE', '0.mode', ['CHO', 'VIB']]] }),
  T('delay', 'Delay', 'Delay', 'Echoes with tap tempo', [['delay']], { k: [['TIME', '0.time'], ['REPEATS', '0.feedback'], ['MIX', '0.mix']], t: [['MODE', '0.mode', ['DIG', 'ANA', 'TAPE'], [0, 2]]], tap: true }),
  T('tape', 'Tape echo', 'Delay', 'Warbly, dark repeats', [['delay', { params: { mode: 2, tone: 0.45 } }]], { k: [['TIME', '0.time'], ['REPEATS', '0.feedback'], ['MIX', '0.mix'], ['WOW', '0.moddepth']] }),
  T('reverb', 'Reverb', 'Reverb', 'Room, hall or spring', [['reverb']], { k: [['DECAY', '0.decay'], ['TONE', '0.tone'], ['MIX', '0.mix']], t: [['TYPE', '0.mode', ['ROOM', 'HALL', 'SPRING'], [0, 3]]] }),
  T('shimmer', 'Shimmer verb', 'Reverb', 'Octave-up wash', [['reverb', { params: { mode: 4, decay: 0.75, mix: 0.45 } }]], { k: [['DECAY', '0.decay'], ['SHIMMER', '0.shimmer'], ['MIX', '0.mix']] }),
  T('octave', 'Octave', 'Pitch', 'Adds an octave below', [['octave']], { k: [['SUB', '0.level1'], ['UP', '0.level3'], ['DRY', '0.dry']] }),
  T('wah', 'Wah', 'Wah', 'Expression treadle wah', [['wah', { params: { mode: 0 } }]], { pedal: ['WAH', '0.pos'], k: [['Q', '0.q']] }),
  T('autowah', 'Envelope wah', 'Filter', 'Quacky auto wah', [['wah', { params: { mode: 2, sens: 0.6 } }]], { k: [['SENS', '0.sens'], ['RANGE', '0.range'], ['Q', '0.q']] }),
  T('drivedelay', 'Drive into delay', 'Multi-FX', 'Two pedals in one', [['overdrive'], ['delay', { params: { mix: 0.3 } }]],
    { k: [['DRIVE', '0.gain'], ['LEVEL', '0.level'], ['TIME', '1.time'], ['MIX', '1.mix']], f: [['DRIVE', '0.on'], ['ECHO', '1.on']] }),
  T('shoegaze', 'Shoegaze stack', 'Multi-FX', 'Fuzz, chorus and a huge reverb', [['fuzz', { params: { gain: 0.7 } }], ['chorus', { params: { mix: 0.4 } }], ['reverb', { params: { mode: 5, decay: 0.8, mix: 0.5 } }]],
    { k: [['FUZZ', '0.gain'], ['TONE', '0.tone'], ['WOBBLE', '1.depth'], ['WASH', '2.mix'], ['LEVEL', '0.level']], f: [['FUZZ', '0.on'], ['WASH', '2.on']] }),
  T('ambient', 'Ambient', 'Multi-FX', 'Swells into echo and a cloud reverb', [['swell'], ['delay', { params: { mode: 4, mix: 0.4, feedback: 0.5 } }], ['reverb', { params: { mode: 5, decay: 0.85, mix: 0.55 } }]],
    { k: [['SWELL', '0.attack'], ['TIME', '1.time'], ['REPEATS', '1.feedback'], ['SPACE', '2.mix']] }),
  T('blend', 'Parallel blend', 'Multi-FX', 'Fuzz and octave side by side', [['fuzz'], ['octave', { par: true, params: { dry: 0 } }]],
    { k: [['FUZZ', '0.gain'], ['FUZZ LVL', '0.lvl'], ['OCT LVL', '1.lvl'], ['MIX', 'mix']] }, { mix: true }),
  T('synth', 'Synth', 'Synth', 'Guitar synth with a filter', [['synth']], { k: [['CUTOFF', '0.filter'], ['RES', '0.reso'], ['ATTACK', '0.attack'], ['MIX', '0.wet']], t: [['WAVE', '0.mode', ['SAW', 'SQR', 'PAD'], [1, 0, 6]]] }),
  T('lofi', 'Lo-fi', 'Utility', 'Old cassette wobble', [['lofi']], { k: [['WOW', '0.wow'], ['AGE', '0.age'], ['NOISE', '0.noise'], ['MIX', '0.mix']] }),
];
export const circuitById = (id) => CIRCUITS.find((c) => c.id === id);
/** A v2 circuit from a template plus the control mappings it wants (resolved to stage ids). */
export function makeCircuit(id) {
  const t = circuitById(id) || CIRCUITS[1];
  const stages = t.stages.map(([type, o]) => newStage(type, clone(o || {})));
  const res = (to) => {
    if (!to || to === 'mix' || to === 'bypass') return to;
    const [i, k] = to.split('.');
    return stages[+i] ? stages[+i].id + '.' + k : '';
  };
  const circuit = { v: 2, tpl: t.id, cat: t.cat, name: t.name, stages, mix: !!t.mix, mixDef: 1 };
  const wants = {
    knobs: (t.ctl.k || []).map(([label, to]) => ({ label, to: res(to) })),
    toggles: (t.ctl.t || []).map(([label, to, opts, vals]) => ({ label, to: res(to), opts, vals })),
    foots: (t.ctl.f || []).map(([label, to]) => ({ label, to: res(to) })),
    pedal: t.ctl.pedal ? { label: t.ctl.pedal[0], to: res(t.ctl.pedal[1]) } : null,
    tap: !!t.ctl.tap && stages.find((s) => STAGES[s.type].tap),
  };
  return { circuit, wants };
}

// ------------------------------------------------------------------ v2 targets
export function v2TargetsFor(circuit, ctlKind) {
  const out = [['', 'Nothing']];
  const sw = ctlKind === 'foot' || ctlKind === 'button';
  if (ctlKind === 'foot') out.push(['bypass', 'Bypass (pedal on / off)']);
  if (circuit.mix) out.push(['mix', 'Wet / dry mix', { min: 0, max: 1 }]);
  circuit.stages.forEach((s, i) => {
    const st = STAGES[s.type];
    if (!st) return;
    const nm = `${i + 1}. ${st.name}`;
    out.push([s.id + '.on', `${nm}: on / off`, { min: 0, max: 1, i: 1 }]);
    if (sw && st.tap) out.push([s.id + '.tap', `${nm}: tap tempo`]);
    if (s.par || circuit.stages[i + 1]?.par) out.push([s.id + '.lvl', `${nm}: blend level`, { min: 0, max: 2, def: 1 }]);
    for (const p of st.params) out.push([s.id + '.' + p.key, `${nm}: ${p.label}`, p]);
  });
  return out;
}
export function v2TargetInfo(circuit, to) {
  if (!to) return null;
  if (to === 'mix') return { min: 0, max: 1, label: 'Mix' };
  const [sid, key] = to.split('.');
  const s = circuit.stages.find((x) => x.id === sid);
  if (!s) return null;
  if (key === 'on') return { min: 0, max: 1, i: 1, label: 'On', key: 'on' };
  if (key === 'lvl') return { min: 0, max: 2, label: 'Blend level' };
  if (key === 'tap') return { tap: true, label: 'Tap' };
  const p = stageParam(s.type, key);
  return p ? { ...p } : null;
}
// map controls that have no mapping yet, by their label or old parameter name (v2 or v3 targets)
const SYN = { drive: ['gain', 'drive', 'fuzz', 'sustain', 'dist'], gain: ['gain'], level: ['level', 'volume', 'vol', 'output'], volume: ['level', 'volume'], tone: ['tone', 'treble', 'filter'], filter: ['tone', 'filter'],
  time: ['time'], repeats: ['feedback', 'repeats'], feedback: ['feedback'], mix: ['mix', 'wet'], rate: ['rate', 'speed'], speed: ['rate', 'speed'], depth: ['depth', 'width', 'intensity'], decay: ['decay'],
  bass: ['bass', 'lowgain'], mid: ['mid', 'mid1gain'], treble: ['treble', 'highgain'], cutoff: ['filter'], res: ['reso'], resonance: ['reso'], glide: ['glide'], mod: ['moddepth', 'mod'], sub: ['level1'], q: ['q'] };
export function autoMapWith(d, targets, mapTo, tapTarget) {
  const used = new Set();
  for (const c of d.ctls) {
    if (c.map && c.map.to) used.add(c.map.to);
    for (const m of c.more || []) if (m && m.to) used.add(m.to);
  }
  const all = targets('knob').filter((t) => t[2] && !String(t[0]).endsWith('.on') && !t[2].tap);
  const keyOf = (t) => (t[2].key || t[0].split('.')[1] || '').toLowerCase();
  for (const c of d.ctls) {
    if (c.map || c.kind === 'led' || c.kind === 'screen') continue;
    if (c.kind === 'foot') {
      const tt = c.param === 'Tap tempo' ? tapTarget() : null;
      c.map = tt ? { to: tt } : { to: 'bypass' };
      continue;
    }
    if (c.kind === 'dip') continue;
    const words = [c.param, c.label].filter(Boolean).map((w) => w.toLowerCase().trim());
    let hit = null;
    for (const w of words) {
      const keys = SYN[w] || [w];
      hit = all.find((t) => !used.has(t[0]) && keys.includes(keyOf(t))) || all.find((t) => !used.has(t[0]) && t[2].label && t[2].label.toLowerCase() === w);
      if (hit) break;
    }
    if (!hit && (c.kind === 'knob' || c.kind === 'slider' || c.kind === 'trim' || c.kind === 'pedal')) hit = all.find((t) => !used.has(t[0]) && !t[2].i);
    if (!hit && (c.kind === 'toggle' || c.kind === 'sel')) hit = all.find((t) => !used.has(t[0]) && t[2].i && t[2].max > 1);
    if (hit) {
      used.add(hit[0]);
      c.map = mapTo(hit[0]);
      if ((c.kind === 'toggle' || c.kind === 'sel') && hit[2].opts) c.map.max = Math.min(hit[2].max, hit[2].min + ((c.ways || c.n || 2) - 1));
    } else c.map = { to: '' };
  }
  for (const l of d.ctls) if (l.kind === 'led' && !l.bind) l.bind = 'on';
}
export function v2AutoMap(d) {
  const C = d.circuit;
  autoMapWith(d, (k) => v2TargetsFor(C, k), (to) => v2MapTo(C, to), () => {
    const s = C.stages.find((x) => STAGES[x.type].tap);
    return s ? s.id + '.tap' : null;
  });
}
export function v2MapTo(circuit, to, o = {}) {
  const info = v2TargetInfo(circuit, to) || {};
  return Object.assign({ to, min: info.min ?? 0, max: info.max ?? 1, taper: info.l ? 'log' : 'lin', invert: false }, o);
}

// ------------------------------------------------------------------ v2 -> graph
/**
 * Build a circuit graph from v2 stages. refs: [{to: '<stage>.<key>', name, lo, hi, log, int, steps}] each gets
 * a control input wired to its target. Returns { graph, knobs: [node id per ref] }.
 */
export function stagesToGraph(C2, refs = []) {
  const nodes = [], wires = [];
  const W = (a, ap, b, bp, o = {}) => wires.push({ id: nid('w'), a: { n: a, p: ap }, b: { n: b, p: bp }, ...o });
  const inN = newNode('in', 40, 60);
  nodes.push(inN);
  const stages = (C2.stages || []).filter((s) => STAGES[s.type]);
  // series groups (a stage marked par joins the one before it)
  const groups = [];
  stages.forEach((s, i) => (s.par && i > 0 ? groups[groups.length - 1].push(s) : groups.push([s])));
  let prev = [{ n: inN.id, p: 'out' }];
  let x = 260;
  const nodeOf = new Map(), mixOf = new Map();
  for (const g of groups) {
    const here = [];
    g.forEach((s, j) => {
      const n = newNode(s.type, x, 40 + j * 200);
      n.id = s.id;
      for (const p of STAGES[s.type].params) if (s.params[p.key] != null) n.p[p.key] = s.params[p.key];
      if (s.on === false) n.p.on = 0;
      if (s.voice) n.voice = s.voice;
      nodes.push(n);
      nodeOf.set(s.id, n);
      for (const pr of prev) W(pr.n, pr.p, n.id, 'in');
      here.push(n);
    });
    x += 240;
    if (g.length > 1) {
      // parallel lanes are summed and evened out, like the chain block
      const mx = newNode('mixer', x, 60);
      g.slice(0, 4).forEach((s, j) => {
        mx.p['g' + (j + 1)] = (s.lvl ?? 1) / g.length;
        W(s.id, 'out', mx.id, 'in' + (j + 1));
        mixOf.set(s.id, { n: mx, j, k: g.length });
      });
      nodes.push(mx);
      prev = [{ n: mx.id, p: 'out' }];
      x += 200;
    } else prev = [{ n: here[0].id, p: 'out' }];
  }
  const outN = newNode('out', x, 60);
  nodes.push(outN);
  for (const pr of prev) W(pr.n, pr.p, outN.id, 'in');
  // control inputs
  const knobs = refs.map((r, i) => {
    const k = newNode('knob', 40, 170 + i * 64, { name: r.name || 'Knob ' + (i + 1), def: r.def ?? 0.5, steps: r.steps || 0 });
    if (r.opts) k.opts = r.opts.slice();
    nodes.push(k);
    const [sid, key] = String(r.to).split('.');
    const range = (o) => Object.assign(o, r.lo != null ? { lo: r.lo, hi: r.hi } : {}, r.log ? { log: true } : {});
    if (key === 'lvl' && mixOf.has(sid)) {
      const m = mixOf.get(sid);
      W(k.id, 'cv', m.n.id, '@g' + (m.j + 1), { lo: (r.lo ?? 0) / m.k, hi: (r.hi ?? 2) / m.k });
    } else if (nodeOf.has(sid)) W(k.id, 'cv', sid, '@' + key, range({}));
    return k.id;
  });
  return { graph: { nodes, wires }, knobs };
}
// the position values of a v2 mapping as 0..1 of [lo, hi]
export function normRange(m, info) {
  const lo = m.min ?? info?.min ?? 0, hi = m.max ?? info?.max ?? 1;
  return { lo, hi };
}
export const norm01 = (v, lo, hi, log) => (log && lo > 0 && hi > 0 ? Math.log(v / lo) / Math.log(hi / lo) : (v - lo) / (hi - lo || 1));
export const clamp01 = (v) => clamp(v, 0, 1);
