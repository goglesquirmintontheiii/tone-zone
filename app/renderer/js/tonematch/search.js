// Tone replication search: finds the rig (drive → amp → cab → EQ → time FX) whose output on a DI guitar best
// matches the target audio's long-term spectrum and distortion / dynamics character.
// Every candidate is rendered offline by the real DSP engine (main process) and analysed with the same
// feature extractor as the target.
import { allDefs, getDef, getPackDefs, kindOf, brandOf, isOriginal, defaultVariant } from '../catalog/index.js';
import { buildGraph } from '../state.js';
import { knobValue } from '../nodeview.js';
import { sizeOf } from '../pages/presets.js';

export const DEPTHS = {
  quick: { gains: [0.6], amps: 60, noPreamps: true, ampKeep: 2, cabs: 40, pairs: 2, refine: 1, drives: 4, label: 'Quick (~1 min)' },
  balanced: { gains: [0.3, 0.6, 0.9], amps: 999, ampKeep: 3, cabs: 999, pairs: 3, refine: 2, drives: 8, label: 'Balanced (~3 min)' },
  thorough: { gains: [0.2, 0.4, 0.6, 0.8, 0.95], amps: 999, ampKeep: 5, cabs: 999, pairs: 4, refine: 3, drives: 16, label: 'Thorough (~8+ min)' },
};

// ------------------------------------------------------------------ distance between feature sets
export function distance(t, c) {
  if (!c || c.error || !t) return 1e9;
  let s = 0, w = 0;
  for (let i = 0; i < t.shape.length; i++) {
    const f = t.bands[i];
    const wt = f < 80 ? 0.35 : f > 9000 ? 0.45 : f > 5000 ? 0.8 : 1;
    const d = t.shape[i] - c.shape[i];
    s += wt * d * d;
    w += wt;
  }
  const spec = Math.sqrt(s / w);
  const dist = 0.28 * Math.abs(t.crest - c.crest) + 14 * Math.abs(t.flat - c.flat) + 0.22 * Math.abs(t.hf - c.hf);
  const dyn = 0.06 * Math.abs(t.dyn - c.dyn);
  const tail = 3 * Math.abs((t.tail || 0) - (c.tail || 0));
  return spec + dist + dyn + tail;
}
export function breakdown(t, c) {
  let s = 0;
  for (let i = 0; i < t.shape.length; i++) s += (t.shape[i] - c.shape[i]) ** 2;
  const spec = Math.sqrt(s / t.shape.length);
  return {
    spectrum: Math.max(0, 100 - spec * 9),
    distortion: Math.max(0, 100 - (Math.abs(t.crest - c.crest) * 9 + Math.abs(t.flat - c.flat) * 500)),
    brightness: Math.max(0, 100 - Math.abs(t.hf - c.hf) * 8),
    dynamics: Math.max(0, 100 - Math.abs(t.dyn - c.dyn) * 4),
  };
}

// ------------------------------------------------------------------ rig <-> preset / graph
let uid = 0;
function knobsOf(d) {
  return d.controls.filter((c) => c.t === 'knob' && c.p && !c.alt && c.p !== 'level' && c.p !== 'master' && c.p !== 'output' && c.p !== 'volume');
}
function setPos(block, d, p, pos) {
  const c = d.controls.find((x) => x.p === p);
  if (c) block.params[p] = knobValue(c, pos);
}
function blockFor(type, params = {}) {
  const d = getDef(type);
  const b = { id: 'r' + ++uid, type, x: 0, y: 0, params: {}, bypass: false, variant: defaultVariant(d) === 'stereo' ? 'stereo' : 'mono' };
  if (d.initParams) Object.assign(b.params, JSON.parse(JSON.stringify(d.initParams)));
  for (const [k, v] of Object.entries(params)) {
    if (k.startsWith('pos:')) setPos(b, d, k.slice(4), v);
    else b.params[k] = v;
  }
  return b;
}
export function rigPreset(rig, name = 'Tone Match') {
  const blocks = rig.map((r) => blockFor(r.type, r.params));
  // lay out right-to-left like a real board (input on the right)
  let x = 0;
  const placed = [];
  for (const b of blocks) {
    const sz = sizeOf(getDef(b.type));
    placed.push(Object.assign(b, { x: -x - sz[0], y: 180 - sz[1] / 2 }));
    x += sz[0] + 80;
  }
  const cables = [];
  let prev = { node: '__in', port: 0 };
  for (const b of placed) {
    cables.push({ id: 'c' + ++uid, from: prev, to: { node: b.id, port: 0 }, color: '#e8473d' });
    prev = { node: b.id, port: 0 };
  }
  cables.push({ id: 'c' + ++uid, from: prev, to: { node: '__out', port: 0 }, color: '#e8473d' });
  if (placed.length && getDef(placed[placed.length - 1].type)?.stereo !== 'mono') cables.push({ id: 'c' + ++uid, from: prev, to: { node: '__out', port: 1 }, color: '#e8473d' });
  return {
    version: 1, name, tags: ['tone-match'],
    blocks: [{ id: '__in', type: '__in', x: 260, y: 60, params: {} }, ...placed, { id: '__out', type: '__out', x: -x - 260, y: 60, params: {} }],
    cables, view: null,
  };
}
const graphOf = (rig) => buildGraph(rigPreset(rig));

// ------------------------------------------------------------------ candidate pools
function pools(opts) {
  const allow = (d) => {
    if (d.hidden || d.missing) return false;
    if (opts.sources === 'originals' && !isOriginal(d)) return false;
    if (opts.sources === 'inspired' && isOriginal(d)) return false;
    if (opts.brands && opts.brands.length && !isOriginal(d) && !d.pack && !opts.brands.includes(brandOf(d))) return false;
    if (d.pack && !opts.usePacks) return false;
    return true;
  };
  const defs = [...allDefs(), ...(opts.usePacks ? getPackDefs() : [])].filter(allow);
  const bass = opts.instrument === 'bass';
  const amps = defs.filter((d) => (d.algo === 'amp' && (d.cat === (bass ? 'Bass Amp' : 'Amp') || (d.cat === 'Preamp' && opts.usePreamps))) || (d.pack && d.algo === 'nam' && d.packCat !== 'Cab'));
  const cabs = defs.filter((d) => (d.algo === 'cab' && d.cat === (bass ? 'Bass Cab' : 'Cab')) || (d.pack && d.algo === 'ir'));
  const drives = defs.filter((d) => ['Overdrive', 'Distortion', 'Fuzz', 'Boost'].includes(d.cat) && d.algo === 'drive' && d.stereo !== 'stereo');
  const reverbs = defs.filter((d) => d.cat === 'Reverb' && d.algo === 'reverb');
  const delays = defs.filter((d) => d.cat === 'Delay' && d.algo === 'delay');
  const eq = getDef('tz.paraeq');
  return { amps, cabs, drives, reverbs, delays, eq };
}
// rough character of an amp from its voice (for "character" hints and to pick a sensible screening cab)
function guessCab(amp, cabs) {
  const r = (amp.ref || '').toLowerCase() + ' ' + (amp.name || '').toLowerCase();
  const pref = [
    [/fender|deluxe|twin|princeton|super|tweed|bassman/, /1x12us|2x12twin|fender|1x10|4x10/],
    [/vox|ac30|ac15|matchless|dc-30/, /blue|vox|alnico|2x12/],
    [/mesa|rect|boogie|5150|6505|peavey|evh|diezel|engl|revv|bogner|uber/, /v30|recto|uber|4x12/],
    [/marshall|jcm|plexi|jubilee|friedman|soldano|slo/, /greenback|gb|t75|marsh|4x12/],
    [/orange/, /orange|citrus/],
    [/svt|ampeg|b-15|portaflex/, /8x10|svt|1x15|ampeg/],
  ];
  for (const [a, c] of pref) if (a.test(r)) { const hit = cabs.find((x) => c.test((x.id + ' ' + x.ref).toLowerCase())); if (hit) return hit; }
  return cabs[0];
}

// ------------------------------------------------------------------ the search
export async function runSearch(target, opts, onProgress, isCancelled) {
  const D = DEPTHS[opts.depth || 'balanced'];
  const P = pools(opts);
  if (!P.amps.length || !P.cabs.length) throw new Error('No amps / cabs available with the current filters');
  let evals = 0;
  const total = estimateEvals(D, P, opts);
  const evalRigs = async (rigs, stage) => {
    if (isCancelled()) throw new Error('cancelled');
    const graphs = rigs.map(graphOf);
    const out = [];
    for (let i = 0; i < graphs.length; i += 8) {
      if (isCancelled()) throw new Error('cancelled');
      const res = await window.tz.tm.evalGraphs(graphs.slice(i, i + 8), opts.di || null);
      out.push(...res);
      evals += res.length;
      onProgress({ p: Math.min(0.99, evals / total), stage, evals, total });
    }
    return rigs.map((rig, i) => ({ rig, f: out[i], d: distance(target, out[i]) }));
  };
  const ampKnobs = (d) => knobsOf(d).map((c) => c.p);
  // character hint narrows amp gain levels
  let gains = D.gains;
  if (opts.character === 'clean') gains = gains.map((g) => g * 0.45);
  else if (opts.character === 'crunch') gains = gains.map((g) => 0.25 + g * 0.5);
  else if (gains.length === 1 && opts.character !== 'high') gains = [0.35, 0.75]; // unknown character: bracket it
  else if (opts.character === 'high') gains = gains.map((g) => 0.55 + g * 0.45);
  // 1. every amp at each gain step through one reference cabinet
  let amps = D.noPreamps && P.amps.filter((a) => a.cat !== 'Preamp').length >= 8 ? P.amps.filter((a) => a.cat !== 'Preamp') : P.amps;
  if (amps.length > D.amps) amps = amps.slice().sort(() => Math.random() - 0.5).slice(0, D.amps);
  let cabs = P.cabs;
  if (cabs.length > D.cabs) cabs = cabs.slice().sort(() => Math.random() - 0.5).slice(0, D.cabs);
  const refCab = { type: (cabs.find((c) => /4x12/i.test(c.id + c.name)) || cabs[0]).id, params: {} };
  const seen = new Map(); // rendered rigs, so nothing is rendered twice
  const key = (rig) => rig.map((x) => x.type + JSON.stringify(x.params)).join('|');
  const evalNew = async (rigs, stage) => {
    const fresh = rigs.filter((r, i) => !seen.has(key(r)) && rigs.findIndex((x) => key(x) === key(r)) === i);
    (await evalRigs(fresh, stage)).forEach((r) => seen.set(key(r.rig), r));
    return rigs.map((r) => seen.get(key(r)));
  };
  const stage1 = [];
  for (const a of amps) for (const g of a.pack ? [0.5] : gains) stage1.push([{ type: a.id, params: { 'pos:gain': g } }, refCab]);
  const r1 = (await evalNew(stage1, 'Auditioning amps')).filter((r) => r.f && !r.f.error).sort((x, y) => x.d - y.d);
  if (!r1.length) throw new Error('none of the amps could be rendered');
  // 2. measure every cabinet's response with the leading amp. A cab is (nearly) a linear filter after the amp, so in
  //    dB its effect adds to the amp's spectrum – that lets us predict every amp × cab pair without rendering it.
  const lead = r1[0];
  const rc = await evalNew(cabs.map((c) => [lead.rig[0], { type: c.id, params: {} }]), 'Measuring speaker cabinets');
  const cabFx = rc.filter((r) => r.f && !r.f.error).map((r) => ({
    cab: r.rig[1],
    shape: r.f.shape.map((v, i) => v - lead.f.shape[i]),
    hf: r.f.hf - lead.f.hf, crest: r.f.crest - lead.f.crest, flat: r.f.flat - lead.f.flat, dyn: r.f.dyn - lead.f.dyn,
  }));
  const predict = (f, cx) => {
    const sh = f.shape.map((v, i) => v + cx.shape[i]);
    const m = sh.reduce((a, v) => a + v, 0) / sh.length;
    return Object.assign({}, f, { shape: sh.map((v) => v - m), hf: f.hf + cx.hf, crest: f.crest + cx.crest, flat: Math.max(0, f.flat + cx.flat), dyn: f.dyn + cx.dyn });
  };
  onProgress({ p: Math.min(0.99, evals / total), stage: 'Predicting amp × cabinet pairs', evals, total });
  const preds = [];
  for (const r of r1) for (const cx of cabFx) preds.push({ rig: [r.rig[0], cx.cab], d: distance(target, predict(r.f, cx)) });
  preds.sort((x, y) => x.d - y.d);
  // 3. render the most promising predictions for real (several amps, not just one amp's best cabs)
  const K = D.pairs * 4 + 4;
  const pick = [];
  const perAmp = new Map();
  for (const p of preds) {
    if (pick.length >= K) break;
    const n = perAmp.get(p.rig[0].type) || 0;
    if (n >= 3) continue;
    perAmp.set(p.rig[0].type, n + 1);
    pick.push(p.rig);
  }
  const dbg = { ref: refCab.type, lead: lead.rig[0], preds: preds.slice(0, 12).map((p) => [p.rig[0].type, p.rig[0].params['pos:gain'], p.rig[1].type, +p.d.toFixed(2)]) };
  const r2 = (await evalNew(pick, 'Pairing amps and cabinets')).concat(rc, r1).filter((r) => r.f && !r.f.error).sort((x, y) => x.d - y.d);
  const pairs = [];
  for (const r of r2) if (!pairs.find((p) => p.rig[0].type === r.rig[0].type) && pairs.length < D.pairs) pairs.push(r);
  dbg.rendered = r2.slice(0, 10).map((p) => [p.rig[0].type, p.rig[0].params['pos:gain'], p.rig[1].type, +p.d.toFixed(2)]);
  // 3. knob refinement (coordinate descent on gain / EQ / presence)
  let best = pairs[0];
  for (const start of pairs) {
    let cur = start;
    const ad = getDef(cur.rig[0].type);
    const ks = ampKnobs(ad);
    for (let pass = 0; pass < D.refine; pass++) {
      const step = pass === 0 ? 0.18 : pass === 1 ? 0.09 : 0.045;
      for (const k of ks) {
        const c = ad.controls.find((x) => x.p === k);
        const curPos = posOf(cur.rig[0], c);
        const cands = [curPos - step, curPos + step].filter((v) => v >= 0 && v <= 1).map((v) => [{ type: cur.rig[0].type, params: Object.assign({}, cur.rig[0].params, { ['pos:' + k]: v }) }, cur.rig[1]]);
        if (!cands.length) continue;
        const rr = await evalRigs(cands, `Dialling in ${ad.name}`);
        for (const r of rr) if (r.d < cur.d) cur = r;
      }
    }
    if (cur.d < best.d) best = cur;
  }
  let rig = best.rig, bestD = best.d, bestF = best.f;
  // 4. optional drive pedal in front
  if (opts.drives !== false && P.drives.length) {
    let ds = P.drives.slice().sort(() => Math.random() - 0.5).slice(0, D.drives);
    const cands = [];
    for (const d of ds) for (const g of [0.3, 0.7]) cands.push([{ type: d.id, params: { 'pos:gain': g } }, ...rig]);
    const rr = await evalRigs(cands, 'Trying drive pedals');
    rr.sort((x, y) => x.d - y.d);
    if (rr[0] && rr[0].d < bestD * 0.97) ({ rig, d: bestD, f: bestF } = { rig: rr[0].rig, d: rr[0].d, f: rr[0].f });
  }
  // 5. EQ correction from the remaining spectral difference
  if (opts.eq !== false && P.eq) {
    const resid = target.shape.map((v, i) => v - bestF.shape[i]);
    const at = (hz) => {
      let acc = 0, w = 0;
      target.bands.forEach((f, i) => { const k = Math.exp(-((Math.log2(f / hz)) ** 2) / (2 * 0.35 ** 2)); acc += resid[i] * k; w += k; });
      return acc / (w || 1);
    };
    const freqs = [90, 250, 700, 1800, 4200, 9000];
    const tries = [];
    for (const scale of [0.6, 0.9, 1.15]) {
      const params = {};
      freqs.forEach((f, i) => { params[`b${i + 1}f`] = f; params[`b${i + 1}g`] = Math.max(-12, Math.min(12, Math.round(at(f) * scale * 10) / 10)); params[`b${i + 1}q`] = i === 0 || i === 5 ? 0.7 : 1.0; params[`b${i + 1}on`] = 1; });
      params.spectrum = 0;
      tries.push([...rig, { type: P.eq.id, params }]);
    }
    const rr = await evalRigs(tries, 'Correcting the EQ curve');
    rr.sort((x, y) => x.d - y.d);
    if (rr[0].d < bestD) ({ rig, d: bestD, f: bestF } = { rig: rr[0].rig, d: rr[0].d, f: rr[0].f });
  }
  // 6. ambience (reverb / delay) when the target has a noticeable tail
  if (opts.timefx !== false && (target.tail || 0) > (bestF.tail || 0) + 0.06) {
    const tries = [];
    for (const rv of P.reverbs.slice(0, 3)) for (const mix of [0.15, 0.3, 0.45]) tries.push([...rig, { type: rv.id, params: { 'pos:mix': mix, 'pos:decay': 0.5 } }]);
    if (P.delays[0]) for (const mix of [0.15, 0.3]) tries.push([...rig, { type: P.delays[0].id, params: { 'pos:mix': mix } }]);
    const rr = await evalRigs(tries, 'Adding ambience');
    rr.sort((x, y) => x.d - y.d);
    if (rr[0] && rr[0].d < bestD) ({ rig, d: bestD, f: bestF } = { rig: rr[0].rig, d: rr[0].d, f: rr[0].f });
  }
  onProgress({ p: 1, stage: 'Done', evals, total: evals });
  // alternatives: next best distinct amp/cab pairs (refined result first)
  const alts = pairs.slice(0, 3).filter((p) => p.rig[0].type !== rig.find((r) => getDef(r.type).algo === 'amp' || getDef(r.type).algo === 'nam')?.type).map((p) => ({ rig: p.rig, d: p.d, f: p.f }));
  return { best: { rig, d: bestD, f: bestF, score: score(bestD), breakdown: breakdown(target, bestF) }, alternatives: alts.map((a) => Object.assign(a, { score: score(a.d), breakdown: breakdown(target, a.f) })), evals, dbg };
}
const score = (d) => Math.max(0, Math.min(100, Math.round(100 - d * 8)));
function posOf(r, c) {
  const v = r.params['pos:' + c.p];
  if (v !== undefined) return v;
  const val = r.params[c.p] ?? c.def ?? 0.5;
  return Math.max(0, Math.min(1, ((val - (c.min ?? 0)) / ((c.max ?? 1) - (c.min ?? 0)))));
}
function estimateEvals(D, P, opts) {
  const amps = Math.min(D.amps, P.amps.length);
  return amps * Math.max(D.gains.length, D.noPreamps ? 2 : 1) + Math.min(D.cabs, P.cabs.length) + D.pairs * 4 + 4 + D.pairs * D.refine * 10 + (opts.drives !== false ? D.drives * 2 : 0) + 3 + 11;
}
