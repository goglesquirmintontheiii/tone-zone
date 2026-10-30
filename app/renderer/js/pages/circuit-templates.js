// Built-in circuits: a few hand-wired ones that show what the editor can do, plus one for every classic
// single-effect circuit of earlier versions. They show up in the circuit list (read only: duplicate to change).
import { newNode, nid } from './circuit-parts.js';
import { CIRCUITS, makeCircuit, stagesToGraph, v2TargetInfo } from './circuit-migrate.js';

// a tiny builder: n(type, x, y, params, extra) adds a node, w(a, ap, b, bp, range) a wire
function build(fn) {
  const G = { nodes: [], wires: [], notes: [] };
  const n = (t, x, y, p = {}, o = {}) => {
    const node = newNode(t, x, y, o);
    Object.assign(node.p, p);
    G.nodes.push(node);
    return node.id;
  };
  const w = (a, ap, b, bp, o = {}) => G.wires.push({ id: nid('w'), a: { n: a, p: ap }, b: { n: b, p: bp }, ...o });
  const knob = (name, x, y, def = 0.5, o = {}) => n('knob', x, y, {}, { name, def, steps: 0, ...o });
  const note = (text, x, y, wd = 200, h = 54) => n('note', x, y, {}, { text, w: wd, h });
  fn({ n, w, knob, note });
  return G;
}
const R = (id, name, cat, desc, tags, graph) => ({ id: 'b.' + id, builtin: true, name, cat, desc, tags, graph, ver: 1 });

const HAND = [
  R('tsdrive', 'Tube Screamer style drive', 'Drive', 'Mid hump boost into soft diode clipping, a tone control and a clean low end blend.', ['drive', 'classic', 'mid'],
    build(({ n, w, knob }) => {
      const i = n('in', 40, 80, {}, { name: 'IN' });
      const hp = n('filter', 230, 40, { freq: 720, res: 0.15, mode: 2 });
      const lp = n('filter', 230, 230, { freq: 260, res: 0.1, mode: 0 });
      const od = n('overdrive', 470, 40, { gain: 0.55, tone: 0.5, level: 0.5 }, { voice: 'ts' });
      const mx = n('mixer', 720, 80, { g1: 1, g2: 0.35 });
      const o = n('out', 940, 80, {}, { name: 'OUT' });
      w(i, 'out', hp, 'in'); w(i, 'out', lp, 'in'); w(hp, 'out', od, 'in'); w(od, 'out', mx, 'in1'); w(lp, 'out', mx, 'in2'); w(mx, 'out', o, 'in');
      const d = knob('Drive', 40, 360, 0.55), t = knob('Tone', 40, 430, 0.5), l = knob('Level', 40, 500, 0.5);
      w(d, 'cv', od, '@gain'); w(t, 'cv', od, '@tone'); w(l, 'cv', od, '@level');
    })),
  R('muff', 'Big Muff style fuzz', 'Fuzz', 'Two cascaded clipping stages and the scooped Muff tone control.', ['fuzz', 'classic', 'sustain'],
    build(({ n, w, knob }) => {
      const i = n('in', 40, 80);
      const b = n('boost', 230, 60, { gain: 0.5, mode: 3 });
      const s1 = n('shaper', 470, 60, { drive: 0.6, mode: 0, level: 0.6 });
      const f = n('fuzz', 690, 60, { gain: 0.7, tone: 0.5, level: 0.5 }, { voice: 'muff' });
      const o = n('out', 930, 80);
      w(i, 'out', b, 'in'); w(b, 'out', s1, 'in'); w(s1, 'out', f, 'in'); w(f, 'out', o, 'in');
      const su = knob('Sustain', 40, 360, 0.7), tn = knob('Tone', 40, 430, 0.5), v = knob('Volume', 40, 500, 0.5);
      w(su, 'cv', f, '@gain'); w(su, 'cv', s1, '@drive', { lo: 0.3, hi: 0.9 }); w(tn, 'cv', f, '@tone'); w(v, 'cv', f, '@level');
    })),
  R('envfilter', 'Envelope filter', 'Filter', 'A resonant band pass that opens up the harder you play.', ['filter', 'funk', 'envelope'],
    build(({ n, w, knob }) => {
      const i = n('in', 40, 80);
      const e = n('env', 250, 260, { sens: 0.6, attack: 4, release: 180 });
      const f = n('filter', 480, 60, { freq: 400, res: 0.7, mode: 1 });
      const x = n('xfade', 720, 80, { mix: 0.85 });
      const o = n('out', 930, 80);
      w(i, 'out', f, 'in'); w(i, 'out', e, 'in'); w(e, 'cv', f, '@freq', { lo: 250, hi: 3200, log: true });
      w(i, 'out', x, 'a'); w(f, 'out', x, 'b'); w(x, 'out', o, 'in');
      const s = knob('Sens', 40, 380, 0.6), q = knob('Q', 40, 450, 0.7), m = knob('Mix', 40, 520, 0.85);
      w(s, 'cv', e, '@sens'); w(q, 'cv', f, '@res'); w(m, 'cv', x, '@mix');
    })),
  R('autowah', 'Auto-wah', 'Filter', 'An envelope follower rocks a wah for you. Range sets how far it opens.', ['wah', 'envelope', 'funk'],
    build(({ n, w, knob }) => {
      const i = n('in', 40, 80);
      const e = n('env', 240, 250, { sens: 0.55, attack: 6, release: 140 });
      const sc = n('scale', 470, 250, { lo: 0.1, hi: 0.9, curve: 2 });
      const wh = n('wah', 700, 40, { mode: 0, q: 0.6 });
      const o = n('out', 940, 80);
      w(i, 'out', wh, 'in'); w(i, 'out', e, 'in'); w(e, 'cv', sc, '@in'); w(sc, 'cv', wh, '@pos'); w(wh, 'out', o, 'in');
      const s = knob('Sens', 40, 380, 0.55), r = knob('Range', 40, 450, 0.8), q = knob('Q', 40, 520, 0.6);
      w(s, 'cv', e, '@sens'); w(r, 'cv', sc, '@hi'); w(q, 'cv', wh, '@q');
    })),
  R('tremtap', 'Tremolo with tap', 'Modulation', 'An LFO into a VCA. Tap a footswitch to set the speed, Depth sets how deep it pulses.', ['tremolo', 'tap', 'modulation'],
    build(({ n, w, knob, note }) => {
      const i = n('in', 40, 80);
      const l = n('lfo', 300, 250, { rate: 4, shape: 1, lo: 0.3, hi: 1, sync: 1 });
      const inv = n('scale', 300, 470, { invert: 1 });
      const v = n('vca', 560, 60, { gain: 1 });
      const o = n('out', 800, 80);
      w(i, 'out', v, 'in'); w(l, 'cv', v, '@gain', { lo: 0, hi: 1 }); w(v, 'out', o, 'in'); w(inv, 'cv', l, '@lo');
      const r = knob('Rate', 40, 300, 0.4), d = knob('Depth', 40, 370, 0.6), s = knob('Shape', 40, 440, 0, { steps: 3, opts: ['Sine', 'Triangle', 'Square'] });
      w(r, 'cv', l, '@rate'); w(d, 'cv', inv, '@in'); w(s, 'cv', l, '@shape', { lo: 0, hi: 2 });
      note('Map a footswitch to "tap tempo" on the pedal: the LFO follows the taps.', 560, 300);
    })),
  R('duckdelay', 'Ducking delay', 'Delay', 'Repeats duck out of the way while you play and swell up when you stop. An envelope and a comparator do the ducking.', ['delay', 'ducking', 'envelope', 'comparator'],
    build(({ n, w, knob }) => {
      const i = n('in', 40, 60);
      const dl = n('delay', 260, 40, { time: 380, feedback: 0.45, mix: 1, mode: 1 });
      const e = n('env', 260, 360, { sens: 0.6, attack: 3, release: 220 });
      const c = n('cmp', 480, 360, { thr: 0.3, hyst: 0.08 });
      const nt = n('not', 690, 360);
      const sm = n('smooth', 890, 360, { time: 260 });
      const v = n('vca', 520, 40, { gain: 1 });
      const mx = n('mixer', 780, 40, { g1: 1, g2: 0.7 });
      const o = n('out', 1000, 60);
      w(i, 'out', dl, 'in'); w(i, 'out', e, 'in'); w(e, 'cv', c, '@in'); w(c, 'cv', nt, '@a'); w(nt, 'cv', sm, '@in'); w(sm, 'cv', v, '@gain', { lo: 0.12, hi: 1 });
      w(dl, 'out', v, 'in'); w(i, 'out', mx, 'in1'); w(v, 'out', mx, 'in2'); w(mx, 'out', o, 'in');
      const t = knob('Time', 40, 220, 0.5), r = knob('Repeats', 40, 290, 0.45), m = knob('Mix', 40, 360, 0.6), du = knob('Duck', 40, 430, 0.3);
      w(t, 'cv', dl, '@time', { lo: 60, hi: 1200, log: true }); w(r, 'cv', dl, '@feedback'); w(m, 'cv', mx, '@g2', { lo: 0, hi: 1.2 }); w(du, 'cv', c, '@thr', { lo: 0.05, hi: 0.8 });
    })),
  R('stchorus', 'Stereo chorus', 'Modulation', 'Two choruses with their sweeps apart, one per side. Use a pedal with OUT and STEREO OUT for the full width.', ['chorus', 'stereo', 'modulation'],
    build(({ n, w, knob }) => {
      const i = n('in', 40, 100);
      const c1 = n('chorus', 280, 30, { rate: 0.32, depth: 0.55, mix: 0.5, mode: 0 }, { opts: { invertR: true } });
      const c2 = n('chorus', 280, 290, { rate: 0.27, depth: 0.5, mix: 0.5, mode: 3 });
      const x = n('xfade', 540, 120, { mix: 0.5 });
      const o = n('out', 760, 120);
      w(i, 'out', c1, 'in'); w(i, 'out', c2, 'in'); w(c1, 'out', x, 'a'); w(c2, 'out', x, 'b'); w(x, 'out', o, 'in');
      const r = knob('Rate', 40, 330, 0.32), d = knob('Depth', 40, 400, 0.55), m = knob('Mix', 40, 470, 0.5);
      w(r, 'cv', c1, '@rate'); w(r, 'cv', c2, '@rate', { lo: 0, hi: 0.85 }); w(d, 'cv', c1, '@depth'); w(d, 'cv', c2, '@depth'); w(m, 'cv', c1, '@mix'); w(m, 'cv', c2, '@mix');
    })),
  R('shimmer', 'Shimmer', 'Reverb', 'A hall reverb whose tail is pitched up an octave and fed back in, so it climbs.', ['reverb', 'shimmer', 'ambient', 'feedback'],
    build(({ n, w, knob }) => {
      const i = n('in', 40, 60);
      const mx = n('mixer', 230, 40, { g1: 1, g2: 1 });
      const rv = n('reverb', 450, 40, { mode: 1, decay: 0.7, mix: 1, size: 0.7 });
      const ps = n('pitch', 450, 360, { semis1: 12, level1: 1, dry: 0 });
      const fb = n('fb', 230, 360, { amount: 0.45, time: 30, tone: 7000 });
      const x = n('xfade', 700, 60, { mix: 0.45 });
      const o = n('out', 920, 60);
      w(i, 'out', mx, 'in1'); w(mx, 'out', rv, 'in'); w(rv, 'out', ps, 'in'); w(ps, 'out', fb, 'in'); w(fb, 'out', mx, 'in2');
      w(i, 'out', x, 'a'); w(rv, 'out', x, 'b'); w(x, 'out', o, 'in');
      const d = knob('Decay', 40, 220, 0.7), s = knob('Shimmer', 40, 290, 0.45), m = knob('Mix', 40, 520, 0.45);
      w(d, 'cv', rv, '@decay'); w(s, 'cv', fb, '@amount', { lo: 0, hi: 0.8 }); w(m, 'cv', x, '@mix');
    })),
  R('gatedhg', 'Noise gated high gain', 'Distortion', 'A tight boost into hard clipping, a 3 band EQ and a gate after it all to keep it quiet.', ['distortion', 'metal', 'gate', 'high gain'],
    build(({ n, w, knob }) => {
      const i = n('in', 40, 60);
      const g0 = n('gate', 210, 40, { threshold: 0.25, decay: 0.3 });
      const b = n('boost', 420, 40, { gain: 0.6, mode: 1 });
      const ds = n('distortion', 640, 40, { gain: 0.75, tone: 0.55 }, { voice: 'si' });
      const eq = n('eq', 860, 40, { lowgain: 2, mid1gain: -3, highgain: 2 });
      const o = n('out', 1080, 60);
      w(i, 'out', g0, 'in'); w(g0, 'out', b, 'in'); w(b, 'out', ds, 'in'); w(ds, 'out', eq, 'in'); w(eq, 'out', o, 'in');
      const ga = knob('Gain', 40, 300, 0.75), ba = knob('Bass', 40, 370, 0.55), mi = knob('Mid', 40, 440, 0.4), tr = knob('Treble', 40, 510, 0.55), lv = knob('Level', 40, 580, 0.5), gt = knob('Gate', 40, 650, 0.25);
      w(ga, 'cv', ds, '@gain'); w(ba, 'cv', eq, '@lowgain'); w(mi, 'cv', eq, '@mid1gain'); w(tr, 'cv', eq, '@highgain'); w(lv, 'cv', ds, '@level'); w(gt, 'cv', g0, '@threshold');
    })),
  R('swell', 'Sidechain swell', 'Dynamics', 'Each note fades in: a comparator spots the pick attack and a slow smoother opens a VCA. Plug another signal into SIDE to duck from it instead.', ['swell', 'volume', 'sidechain', 'envelope'],
    build(({ n, w, knob }) => {
      const i = n('in', 40, 60);
      const sd = n('in', 40, 300, {}, { name: 'SIDE' });
      const e = n('env', 260, 280, { sens: 0.6, attack: 1, release: 80 });
      const c = n('cmp', 480, 280, { thr: 0.12, hyst: 0.05 });
      const sm = n('smooth', 700, 280, { time: 600 });
      const v = n('vca', 700, 40, { gain: 1 });
      const o = n('out', 930, 60);
      w(i, 'out', v, 'in'); w(i, 'out', e, 'in'); w(sd, 'out', e, 'in'); w(e, 'cv', c, '@in'); w(c, 'cv', sm, '@in'); w(sm, 'cv', v, '@gain', { lo: 0, hi: 1 }); w(v, 'out', o, 'in');
      const sp = knob('Speed', 40, 440, 0.5), se = knob('Sens', 40, 510, 0.3);
      w(sp, 'cv', sm, '@time', { lo: 60, hi: 2000, log: true }); w(se, 'cv', c, '@thr', { lo: 0.4, hi: 0.03 });
    })),
  R('dynamo', 'Dynamic multi-FX', 'Multi-FX', 'Clean when you play soft, fuzz when you dig in (an envelope, a window comparator and an A / B switch), then a phaser on an LFO, a step sequenced filter and a feedback echo.', ['multi', 'envelope', 'logic', 'sequencer', 'feedback'],
    build(({ n, w, knob, note }) => {
      const i = n('in', 40, 120);
      const e = n('env', 250, 420, { sens: 0.5, attack: 2, release: 120 });
      const c = n('cmp', 470, 420, { thr: 0.35, hyst: 0.1 });
      const win = n('window', 470, 600, { lo: 0.05, hi: 0.35 });
      const orr = n('or', 690, 600);
      const cmb = n('comp', 250, 220, { sustain: 0.4 });
      const fz = n('fuzz', 250, 20, { gain: 0.7 }, { voice: 'muff' });
      const sw = n('switch', 520, 100);
      const lf = n('lfo', 700, 420, { rate: 0.6, shape: 0, lo: 0.2, hi: 0.9 });
      const ph = n('phaser', 760, 60, { depth: 0.8, mix: 0.5 });
      const sq = n('seq', 1000, 420, { rate: 3, steps: 6 });
      const fl = n('filter', 1000, 60, { freq: 1500, res: 0.5, mode: 0 });
      const mx = n('mixer', 1240, 100, { g1: 1, g2: 0.6 });
      const fb = n('fb', 1240, 420, { amount: 0.5, time: 330, tone: 4000 });
      const o = n('out', 1470, 120);
      w(i, 'out', fz, 'in'); w(i, 'out', cmb, 'in'); w(i, 'out', e, 'in');
      w(cmb, 'out', sw, 'a'); w(fz, 'out', sw, 'b'); w(e, 'cv', c, '@in'); w(c, 'cv', sw, '@sel');
      w(e, 'cv', win, '@in'); w(win, 'cv', orr, '@a'); w(orr, 'cv', ph, '@on');
      w(sw, 'out', ph, 'in'); w(lf, 'cv', ph, '@center'); w(ph, 'out', fl, 'in'); w(sq, 'cv', fl, '@freq', { lo: 300, hi: 4000, log: true });
      w(fl, 'out', mx, 'in1'); w(fl, 'out', fb, 'in'); w(fb, 'out', mx, 'in2'); w(mx, 'out', o, 'in');
      const k1 = knob('Dig in', 40, 300, 0.35), k2 = knob('Swirl', 40, 370, 0.6), k3 = knob('Steps', 40, 440, 0.4), k4 = knob('Echo', 40, 510, 0.5);
      const k5 = knob('Always swirl', 40, 580, 0, { steps: 2, opts: ['Off', 'On'] });
      w(k5, 'cv', orr, '@b');
      w(k1, 'cv', c, '@thr', { lo: 0.1, hi: 0.7 }); w(k2, 'cv', lf, '@rate'); w(k3, 'cv', sq, '@rate'); w(k4, 'cv', mx, '@g2', { lo: 0, hi: 1 });
      note('The comparator picks fuzz over the compressor when you dig in. The phaser only swirls while you play softly, unless Always swirl is on.', 470, 250, 230, 70);
    })),
];
const titled = (s) => String(s || '').toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());
// the classic single-effect circuits, built the way old designs are migrated
const CLASSIC = CIRCUITS.map((t) => {
  const { circuit, wants } = makeCircuit(t.id);
  const refs = [];
  for (const k of wants.knobs) {
    const info = k.to === 'mix' ? null : v2TargetInfo(circuit, k.to);
    if (info) refs.push({ to: k.to, name: titled(k.label), def: info.def != null && info.max != null ? (info.def - info.min) / (info.max - info.min || 1) : 0.5, log: !!info.l });
  }
  for (const tg of wants.toggles) {
    const info = v2TargetInfo(circuit, tg.to);
    if (!info) continue;
    const vals = tg.vals || tg.opts.map((_, i) => info.min + i);
    refs.push({ to: tg.to, name: titled(tg.label), steps: tg.opts.length, opts: tg.opts.map(titled), def: 0, tab: vals });
  }
  for (const f of wants.foots) refs.push({ to: f.to, name: titled(f.label) + ' on', steps: 2, opts: ['Off', 'On'], def: 1 });
  if (wants.pedal) refs.push({ to: wants.pedal.to, name: titled(wants.pedal.label), def: 0.5 });
  const { graph, knobs } = stagesToGraph(circuit, refs);
  // toggles pick table values (non-linear positions)
  refs.forEach((r, i) => {
    if (!r.tab) return;
    const wr = graph.wires.find((x) => x.a.n === knobs[i]);
    if (wr) wr.tab = r.tab;
  });
  return R('c-' + t.id, t.name, t.cat, t.desc, [t.cat.toLowerCase(), 'classic'], graph);
});
export const BUILTIN = [...HAND, ...CLASSIC];
export const builtinById = (id) => BUILTIN.find((b) => b.id === id);
// templates offered in the circuit editor: the hand-wired ones first
export const EDITOR_TEMPLATES = BUILTIN;
