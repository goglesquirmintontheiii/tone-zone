// Loudness tools for the preset scripts: a longer synthetic DI phrase and a BS.1770 style loudness meter.
'use strict';
const fs = require('fs');
const path = require('path');
const { readWav } = require('../main/offline');

const SR = 48000;
// DI phrase: single notes, power chords, palm mutes, open chords, a lead line, softer strummed chords and a melody
// with sustained notes, then silence so delay and reverb tails are rendered too. PLAYED is where playing ends.
const PLAYED = 22;
const TAIL = 5;
function makeDI(file) {
  if (fs.existsSync(file)) return file;
  let seed = 11;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
  const out = new Float32Array(SR * (PLAYED + TAIL));
  const pluck = (t, f, dur, amp, damp = 0.996, bright = 0.5) => {
    const N = Math.floor(SR / f), s0 = Math.floor(t * SR), n = Math.floor(dur * SR);
    const buf = new Float32Array(N).map(() => rnd() * amp);
    for (let k = 0; k < Math.floor((1 - bright) * 4); k++) for (let i = 0; i < N; i++) buf[i] = 0.5 * (buf[i] + buf[(i + 1) % N]);
    const rel = Math.min(n, Math.floor(0.02 * SR)); // fret hand release, no clicks
    for (let i = 0; i < n && s0 + i < out.length; i++) {
      const j = i % N;
      out[s0 + i] += buf[j] * (i > n - rel ? (n - i) / rel : 1);
      buf[j] = 0.5 * (buf[j] + buf[(j + 1) % N]) * damp;
    }
  };
  const E = [82.41, 110, 146.83, 196, 246.94, 329.63];
  const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const strum = (t, frets, dur, amp, down = true) => frets.forEach((f, s) => f !== null && pluck(t + (down ? s : 5 - s) * 0.012, E[s] * Math.pow(2, f / 12), dur, amp));
  // 0-3 s: riff of single notes
  [40, 43, 45, 47, 50, 52, 55, 57, 59, 62, 64, 67].forEach((m, i) => pluck(i * 0.22, midi(m), 0.5, 0.35));
  // 3-5.5 s: power chords
  [[40, 47, 52], [43, 50, 55], [45, 52, 57], [38, 45, 50]].forEach((ch, i) => ch.forEach((m) => pluck(3 + i * 0.6, midi(m), 0.6, 0.28)));
  // 5.6-7 s: palm-muted chugs
  for (let i = 0; i < 8; i++) pluck(5.6 + i * 0.16, midi(40), 0.14, 0.32, 0.97, 0.3);
  // 7-11 s: open chords
  [[0, 2, 2, 1, 0, 0], [3, 2, 0, 0, 0, 3], [0, 0, 2, 2, 2, 0]].forEach((fr, i) => strum(7 + i * 1.4, fr, 1.4, 0.18));
  // 11-12 s: fast lead line
  [64, 67, 69, 71, 74, 76].forEach((m, i) => pluck(11 + i * 0.15, midi(m), 0.3, 0.3, 0.998, 0.6));
  // 12-17 s: softer eighth-note strumming (G D Em C), down and up
  const prog = [[3, 2, 0, 0, 0, 3], [null, null, 0, 2, 3, 2], [0, 2, 2, 0, 0, 0], [null, 3, 2, 0, 1, 0]];
  for (let b = 0; b < 4; b++) for (let k = 0; k < 5; k++) strum(12.2 + b * 1.2 + k * 0.24, prog[b], 0.26, k % 2 ? 0.1 : 0.14, k % 2 === 0);
  // 17-22 s: melody with bends-free sustained notes and a final held chord
  [[67, 0.4], [69, 0.4], [71, 0.8], [74, 0.4], [72, 0.4], [71, 0.8], [69, 1.2]].reduce((t, [m, d]) => (pluck(t, midi(m), d + 0.1, 0.3, 0.999, 0.55), t + d), 17.1);
  strum(21.0, [0, 2, 2, 1, 0, 0], 1.0, 0.16);
  let pk = 0;
  for (const v of out) pk = Math.max(pk, Math.abs(v));
  for (let i = 0; i < out.length; i++) out[i] *= 0.5 / pk; // same peak level as the app's offline DI
  writeWav(file, out);
  return file;
}
function writeWav(file, x) {
  const n = x.length;
  const buf = Buffer.alloc(44 + n * 4);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 4, 4); buf.write('WAVE', 8); buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(3, 20); buf.writeUInt16LE(1, 22); buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(32, 34); buf.write('data', 36); buf.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) buf.writeFloatLE(x[i], 44 + i * 4);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, buf);
}

// K-weighting (BS.1770, 48 kHz): high shelf then RLB high-pass
function kWeight(x) {
  const y = new Float64Array(x.length);
  const st = [[1.53512485958697, -2.69169618940638, 1.19839281085285, -1.69065929318241, 0.73248077421585], [1, -2, 1, -1.99004745483398, 0.99007225036621]];
  let src = x;
  for (const [b0, b1, b2, a1, a2] of st) {
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < src.length; i++) {
      const v = src[i];
      const o = b0 * v + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
      x2 = x1; x1 = v; y2 = y1; y1 = o;
      y[i] = o;
    }
    src = y;
  }
  return y;
}
// gated integrated loudness of [t0, t1) (400 ms blocks, 75 % overlap, -70 LUFS absolute and -10 LU relative gate)
function integrated(kw, sr, t0, t1) {
  const N = Math.round(0.4 * sr), hop = Math.round(0.1 * sr);
  const a = Math.floor(t0 * sr), b = Math.min(kw[0].length, Math.floor(t1 * sr));
  const blocks = [];
  for (let p = a; p + N <= b; p += hop) {
    let z = 0;
    for (const ch of kw) { let s = 0; for (let i = p; i < p + N; i++) s += ch[i] * ch[i]; z += s / N; }
    blocks.push(z);
  }
  const L = (z) => -0.691 + 10 * Math.log10(z + 1e-20);
  let g = blocks.filter((z) => L(z) > -70);
  if (!g.length) return null;
  const rel = L(g.reduce((s, z) => s + z, 0) / g.length) - 10;
  g = g.filter((z) => L(z) > rel);
  return L(g.reduce((s, z) => s + z, 0) / g.length);
}
// max short-term (3 s) loudness, to spot swells and loud bursts
function shortTermMax(kw, sr, t1) {
  const N = 3 * sr, hop = Math.round(0.5 * sr);
  let best = -Infinity;
  for (let p = 0; p + N <= Math.min(kw[0].length, t1 * sr); p += hop) {
    let z = 0;
    for (const ch of kw) { let s = 0; for (let i = p; i < p + N; i++) s += ch[i] * ch[i]; z += s / N; }
    best = Math.max(best, -0.691 + 10 * Math.log10(z + 1e-20));
  }
  return best;
}
// 4x oversampled peak (simple windowed-sinc interpolation), close to a true peak reading
function truePeak(x) {
  let pk = 0;
  for (let i = 0; i < x.length; i++) pk = Math.max(pk, Math.abs(x[i]));
  const taps = 8;
  for (let i = taps; i < x.length - taps; i++) {
    if (Math.abs(x[i]) < pk * 0.7) continue;
    for (let f = 1; f < 4; f++) {
      const t = f / 4;
      let s = 0;
      for (let k = -taps + 1; k <= taps; k++) {
        const d = k - t, w = 0.5 + 0.5 * Math.cos((Math.PI * d) / taps);
        s += x[i + k] * (Math.sin(Math.PI * d) / (Math.PI * d)) * w;
      }
      pk = Math.max(pk, Math.abs(s));
    }
  }
  return pk;
}
const db = (v) => +(20 * Math.log10(v + 1e-12)).toFixed(2);
// measure a rendered (stereo) file: played-section loudness, whole-file loudness, short-term max, peaks
function measure(file) {
  const { chans, sr } = readWav(file);
  const kw = chans.map(kWeight);
  const played = integrated(kw, sr, 0, PLAYED + 0.5);
  if (played === null) return null;
  const full = integrated(kw, sr, 0, Infinity);
  const tail = integrated(kw, sr, PLAYED + 0.5, Infinity);
  let sp = 0;
  for (const c of chans) for (const v of c) sp = Math.max(sp, Math.abs(v));
  return {
    lufs: +played.toFixed(2),
    full: +full.toFixed(2),
    tail: tail === null ? null : +tail.toFixed(2),
    stMax: +shortTermMax(kw, sr, PLAYED + 0.5).toFixed(2),
    peak: db(sp),
    tp: db(Math.max(...chans.map(truePeak))),
  };
}

module.exports = { makeDI, measure, PLAYED, TAIL };
