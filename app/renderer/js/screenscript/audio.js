// Script audio helpers: the audio jacks a script can name, the fallback when no engine backend is registered,
// and a small fake engine for the code editor preview (a demo guitar plus the script's own generators, so
// analysis and generators show something there). The bridge contract is at the top of host.js.
import { jackList } from '../pages/factory-circuit.js';

export const MAX_BINS = 64, MIN_BINS = 4, MAX_WAVE = 1024;
export const MAX_BUFFER = 96000; // samples in one buffer (2 s at 48 kHz)
export const MAX_BUFFERS = 192000; // samples in all buffers of one screen
export const GEN_TYPES = ['sine', 'square', 'saw', 'tri', 'pulse', 'noise', 'sample'];
export const FX_TYPES = ['gain', 'lowpass', 'highpass', 'bandpass', 'drive'];
export const MAX_GENS = 16;
const RATE = 48000;
const lc = (s) => String(s ?? '').trim().toLowerCase();

/** The pedal's audio jacks: [{ name, dir: 'in' | 'out', index, id, kind }]. Inputs first, then outputs (main first). */
export function audioJacks(D) {
  let J;
  try {
    J = jackList(D && Array.isArray(D.jacks) ? D : { ...(D || {}), jacks: [] });
  } catch (_) {
    J = { ins: [{ id: '__in', kind: 'in', label: 'INPUT' }], outs: [{ id: '__out', kind: 'out', label: 'OUTPUT' }] };
  }
  const out = [];
  const used = new Set();
  const add = (j, dir, i) => {
    let name = (j.label || '').trim() || (dir === 'in' ? 'In ' : 'Out ') + (i + 1);
    if (used.has(lc(name))) name += ' ' + (i + 1);
    used.add(lc(name));
    out.push({ name, dir, index: i, id: j.id, kind: j.kind });
  };
  J.ins.forEach((j, i) => add(j, 'in', i));
  J.outs.forEach((j, i) => add(j, 'out', i));
  return out;
}
/** A jack by name (any case), "in" / "out" (first input, main output), "in 2" / "out 2", or null. */
export function findJack(list, name) {
  if (name === undefined || name === null) return list.find((j) => j.dir === 'in') || list[0] || null;
  const k = lc(name);
  const m = /^(in|out|input|output)\s*(\d*)$/.exec(k);
  return (
    list.find((j) => lc(j.name) === k) ||
    list.find((j) => lc(j.id) === k) ||
    (m ? list.filter((j) => j.dir === (m[1].startsWith('in') ? 'in' : 'out'))[(+m[2] || 1) - 1] : null) ||
    null
  );
}

// ------------------------------------------------------------------ analysis from a block of samples
// log spaced band centres from 40 Hz to 16 kHz
function centres(n) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(40 * Math.pow(16000 / 40, n === 1 ? 0 : i / (n - 1)));
  return out;
}
/** Bands (0..1, a dB scale from -72 to 0) of a block of samples, with the Goertzel filter (cheap for a few bands). */
export function bandsOf(x, n, rate = RATE) {
  const out = new Array(n);
  const f = centres(n);
  const N = x.length;
  for (let b = 0; b < n; b++) {
    const k = (2 * Math.PI * f[b]) / rate;
    const c = 2 * Math.cos(k);
    let s1 = 0, s2 = 0;
    for (let i = 0; i < N; i++) {
      const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1)); // Hann window
      const s0 = x[i] * w + c * s1 - s2;
      s2 = s1;
      s1 = s0;
    }
    const mag = Math.sqrt(Math.max(0, s1 * s1 + s2 * s2 - c * s1 * s2)) / (N / 4);
    const db = 20 * Math.log10(Math.max(1e-6, mag));
    out[b] = Math.max(0, Math.min(1, (db + 72) / 72));
  }
  return out;
}
export function levelsOf(x) {
  let s = 0, pk = 0;
  for (const v of x) {
    s += v * v;
    const a = Math.abs(v);
    if (a > pk) pk = a;
  }
  return { rms: Math.sqrt(s / (x.length || 1)), peak: pk };
}

/** The board without an engine backend: levels from the status meters, nothing else. */
export function levelAnalysis(levels, jack) {
  const L = levels || { inPk: 0, outPk: 0 };
  const pk = Math.max(0, Math.min(1, (jack && jack.dir === 'out' ? L.outPk : L.inPk) || 0));
  return { rms: pk * 0.707, peak: pk, bands: [], wave: [], pitch: 0, onset: 0 };
}

// ------------------------------------------------------------------ the fake engine (editor preview)
function oscAt(type, ph, pw) {
  const p = ph - Math.floor(ph);
  switch (type) {
    case 'square': return p < 0.5 ? 1 : -1;
    case 'pulse': return p < (pw ?? 0.5) ? 1 : -1;
    case 'saw': return 2 * p - 1;
    case 'tri': return p < 0.5 ? 4 * p - 1 : 3 - 4 * p;
    case 'noise': return Math.random() * 2 - 1;
    default: return Math.sin(2 * Math.PI * p);
  }
}
/**
 * A fake backend over a simulated pedal: sim = { demo, inLevel, outLevel, bypass }. Signals are made in
 * blocks of samples at the time of the call, so the numbers move like the real thing.
 */
export function fakeAudio(sim) {
  const gens = new Map(); // id -> { p, t0, gateT, relT }
  const buffers = new Map(); // id -> { x: Float32Array, rate }
  const fx = new Map();
  let onsets = 0, lastPluck = -1;
  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000;
  // the demo guitar: a pluck every 1.6 s, an A string with a few harmonics
  function guitar(t, N, out) {
    const ph = (t % 1.6) / 1.6;
    const env = sim.demo ? Math.exp(-ph * 4.5) * (0.75 + 0.25 * Math.sin(t * 0.7)) : sim.inLevel;
    const n = Math.floor(t / 1.6);
    if (sim.demo && n !== lastPluck) {
      if (lastPluck >= 0) onsets++;
      lastPluck = n;
    }
    for (let i = 0; i < N; i++) {
      const tt = t + i / RATE;
      out[i] += env * (0.6 * Math.sin(2 * Math.PI * 110 * tt) + 0.25 * Math.sin(2 * Math.PI * 220 * tt) + 0.12 * Math.sin(2 * Math.PI * 330 * tt) + 0.06 * Math.sin(2 * Math.PI * 550 * tt));
    }
  }
  function envAt(g, t) {
    const p = g.p;
    const a = +p.attack || 0, d = +p.decay || 0, r = +p.release || 0;
    const s = p.sustain === undefined ? 1 : +p.sustain;
    if (!a && !d && !r && p.gate === undefined) return 1;
    if (g.gateT === null) return 0;
    let v;
    const since = t - g.gateT;
    if (since < a) v = since / a;
    else if (since < a + d) v = 1 - (1 - s) * ((since - a) / d);
    else v = d ? s : 1;
    if (g.relT !== null) v *= r ? Math.max(0, 1 - (t - g.relT) / r) : 0;
    return Math.max(0, v);
  }
  function gensInto(t, N, out, jack) {
    for (const g of gens.values()) {
      const to = g.p.to;
      if (!to || to.circuit) {
        if (jack.dir !== 'out' || jack.index !== 0) continue; // circuit inputs come out of the main output here
      } else if (to.dir !== jack.dir || (to.index || 0) !== jack.index) continue;
      const amp = Math.max(0, Math.min(1, g.p.amp ?? 0.5));
      const e = envAt(g, t);
      if (!amp || !e) continue;
      if (g.p.type === 'sample') {
        const B = buffers.get(g.p.buffer);
        if (!B || !B.x.length) continue;
        const rate = (g.p.rate ?? 1) * (B.rate / RATE);
        const pos0 = (t - (g.trigT ?? g.t0)) * RATE * rate + (g.p.start || 0) * B.x.length;
        for (let i = 0; i < N; i++) {
          let k = Math.floor(pos0 + i * rate);
          if (g.p.loop) k = ((k % B.x.length) + B.x.length) % B.x.length;
          if (k >= 0 && k < B.x.length) out[i] += amp * e * B.x[k];
        }
        continue;
      }
      const f = Math.max(0, +g.p.freq || 220);
      for (let i = 0; i < N; i++) out[i] += amp * e * oscAt(g.p.type, f * (t + i / RATE), g.p.pw);
    }
  }
  function signal(jack, N) {
    const t = now();
    const x = new Float32Array(N);
    if (jack.dir === 'in' && jack.index === 0) guitar(t, N, x);
    gensInto(t, N, x, jack);
    if (jack.dir === 'out') {
      const dry = new Float32Array(N);
      guitar(t, N, dry);
      const ins = { dir: 'in', index: 0 };
      gensInto(t, N, dry, ins);
      const k = sim.bypass ? 1 : 0.8;
      for (let i = 0; i < N; i++) x[i] += dry[i] * k;
      for (const f of fx.values()) if (f.jack && f.jack.dir === 'out' && f.jack.index === jack.index && f.type === 'gain') for (let i = 0; i < N; i++) x[i] *= +f.gain || 0;
    }
    return x;
  }
  return {
    fake: true,
    gens,
    buffers,
    analysis(ctx, jack, want = {}) {
      const nb = Math.max(MIN_BINS, Math.min(MAX_BINS, Math.round(want.bands || 32)));
      const nw = Math.max(16, Math.min(MAX_WAVE, Math.round(want.wave || 128)));
      const x = signal(jack, 512);
      const { rms, peak } = levelsOf(x);
      const wave = Array.from(x.subarray(0, nw));
      while (wave.length < nw) wave.push(0);
      let pitch = 0;
      const loud = [...gens.values()].filter((g) => g.p.type !== 'noise' && g.p.type !== 'sample' && g.relT === null && (g.p.amp ?? 0.5) > 0.01);
      if (loud.length) pitch = +loud[0].p.freq || 0;
      else if (jack.index === 0 && rms > 0.01) pitch = 110;
      return { rms, peak, bands: bandsOf(x, nb), wave, pitch, onset: onsets };
    },
    gen(ctx, id, p) {
      if (!gens.has(id) && gens.size >= MAX_GENS * 4) return false;
      const t = now();
      const g = gens.get(id) || { p: {}, t0: t, gateT: null, relT: null, trig: undefined, trigT: t };
      if (p.trig !== undefined && p.trig !== g.trig) {
        g.trig = p.trig;
        g.trigT = t;
        g.gateT = t;
        g.relT = null;
        onsets++;
      } else if (p.gate === true && g.p.gate !== true) {
        g.gateT = t;
        g.relT = null;
        onsets++;
      }
      if (p.gate === false && g.p.gate !== false && g.gateT !== null) g.relT = t;
      g.p = p;
      gens.set(id, g);
      return true;
    },
    stop(ctx, id) {
      return gens.delete(id);
    },
    buffer(ctx, id, samples, rate) {
      buffers.set(id, { x: samples, rate: rate || RATE });
      return true;
    },
    fx(ctx, id, p) {
      fx.set(id, p);
      return true;
    },
    reset(ctx) {
      const pre = ctx && ctx.screen ? ctx.screen + ':' : '';
      for (const m of [gens, buffers, fx]) for (const k of [...m.keys()]) if (!pre || k.startsWith(pre)) m.delete(k);
    },
  };
}
