// Offline rendering + audio analysis: renders a board graph through the DSP engine (engine --offline) with a DI
// clip and measures it (level, spectrum shape …). Used by the preset tools / tests, not by the UI.
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

let dataRoot = null, engineBin = null;
function init(opts) {
  ({ dataRoot, engineBin } = opts);
  fs.mkdirSync(path.join(dataRoot, 'tools'), { recursive: true });
  // Tone Match was removed in 0.4.0: drop the large app-managed downloads it left behind (AI venv, yt-dlp)
  for (const p of [path.join(dataRoot, 'ai'), path.join(dataRoot, 'tools', 'yt-dlp')]) {
    try { fs.rmSync(p, { recursive: true, force: true }); } catch {}
  }
}
const toolsDir = () => path.join(dataRoot, 'tools');

function run(cmd, args, { onLine, cwd, env, nice } = {}) {
  return new Promise((resolve) => {
    const p = spawn(cmd, args, { cwd, env: Object.assign({}, process.env, env || {}) });
    // background renders must never starve the live audio engine
    if (nice && p.pid) try { os.setPriority(p.pid, nice); } catch {}
    let out = '', err = '';
    const feed = (buf, isErr) => {
      const s = buf.toString();
      if (isErr) err += s; else out += s;
      if (onLine) for (const l of s.split(/[\r\n]+/)) if (l.trim()) onLine(l, isErr);
    };
    p.stdout.on('data', (b) => feed(b, false));
    p.stderr.on('data', (b) => feed(b, true));
    p.on('error', (e) => resolve({ code: -1, out, err: err + String(e) }));
    p.on('close', (code) => resolve({ code, out, err }));
  });
}
function writeWav(file, chans, sr) {
  const n = chans[0].length, ch = chans.length;
  const buf = Buffer.alloc(44 + n * ch * 4);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * ch * 4, 4); buf.write('WAVE', 8); buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(3, 20); buf.writeUInt16LE(ch, 22); buf.writeUInt32LE(sr, 24);
  buf.writeUInt32LE(sr * ch * 4, 28); buf.writeUInt16LE(ch * 4, 32); buf.writeUInt16LE(32, 34); buf.write('data', 36); buf.writeUInt32LE(n * ch * 4, 40);
  let o = 44;
  for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) { buf.writeFloatLE(chans[c][i] || 0, o); o += 4; }
  fs.writeFileSync(file, buf);
}
function readWav(file) {
  const b = fs.readFileSync(file);
  let pos = 12, fmt = 1, ch = 1, bits = 16, sr = 48000, data = null;
  while (pos + 8 <= b.length) {
    const id = b.toString('ascii', pos, pos + 4), len = b.readUInt32LE(pos + 4);
    if (id === 'fmt ') { fmt = b.readUInt16LE(pos + 8); ch = b.readUInt16LE(pos + 10); sr = b.readUInt32LE(pos + 12); bits = b.readUInt16LE(pos + 22); if (fmt === 0xfffe) fmt = b.readUInt16LE(pos + 32); }
    if (id === 'data') { data = b.subarray(pos + 8, Math.min(b.length, pos + 8 + len)); break; }
    pos += 8 + len + (len & 1);
  }
  if (!data) throw new Error('bad wav ' + file);
  const bps = bits / 8, n = Math.floor(data.length / bps / ch);
  const out = [];
  for (let c = 0; c < ch; c++) out.push(new Float32Array(n));
  for (let i = 0; i < n; i++)
    for (let c = 0; c < ch; c++) {
      const o = (i * ch + c) * bps;
      out[c][i] = fmt === 3 ? (bits === 64 ? data.readDoubleLE(o) : data.readFloatLE(o)) : bits === 24 ? (data.readIntLE(o, 3) / 8388608) : bits === 32 ? data.readInt32LE(o) / 2147483648 : data.readInt16LE(o) / 32768;
    }
  return { chans: out, sr };
}

// ------------------------------------------------------------------ audio features
function fftReal(re) {
  const n = re.length, im = new Float64Array(n);
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { const t = re[i]; re[i] = re[j]; re[j] = t; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len, wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k, b = a + len / 2;
        const tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
        const ncr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = ncr;
      }
    }
  }
  return im;
}
const BANDS = (() => { const b = []; for (let f = 50; f < 15000; f *= Math.pow(2, 1 / 4)) b.push(f); return b; })(); // 1/4-octave
function features(chans, sr, t0 = 0, t1 = Infinity) {
  const N = 4096, hop = 2048;
  const start = Math.floor(Math.max(0, t0) * sr), end = Math.min(chans[0].length, Math.floor(Math.min(t1, chans[0].length / sr) * sr));
  const mono = new Float32Array(end - start);
  for (let c = 0; c < chans.length; c++) for (let i = 0; i < mono.length; i++) mono[i] += chans[c][start + i] / chans.length;
  const win = new Float64Array(N).map((_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N));
  const frames = [];
  let maxRms = 0;
  for (let p = 0; p + N <= mono.length; p += hop) {
    let s = 0, pk = 0;
    for (let i = 0; i < N; i++) { const v = mono[p + i]; s += v * v; if (Math.abs(v) > pk) pk = Math.abs(v); }
    const rms = Math.sqrt(s / N);
    frames.push({ p, rms, pk });
    if (rms > maxRms) maxRms = rms;
  }
  const active = frames.filter((f) => f.rms > maxRms * 0.06 && f.rms > 1e-4);
  const band = new Float64Array(BANDS.length);
  let flatAcc = 0, hf = 0, mid = 0, crest = [];
  const step = Math.max(1, Math.floor(active.length / 120)); // cap the cost: ~120 frames
  let used = 0;
  for (let k = 0; k < active.length; k += step) {
    const f = active[k];
    const re = new Float64Array(N);
    for (let i = 0; i < N; i++) re[i] = mono[f.p + i] * win[i];
    const im = fftReal(re);
    const mag2 = new Float64Array(N / 2);
    for (let i = 1; i < N / 2; i++) mag2[i] = re[i] * re[i] + im[i] * im[i];
    BANDS.forEach((bf, bi) => {
      const lo = Math.floor((bf / Math.pow(2, 1 / 8) / sr) * N), hi = Math.max(lo + 1, Math.ceil((bf * Math.pow(2, 1 / 8) / sr) * N));
      let s = 0;
      for (let i = lo; i < hi && i < N / 2; i++) s += mag2[i];
      band[bi] += s / (hi - lo) / (f.rms * f.rms + 1e-12);
    });
    // spectral flatness 200 Hz – 6 kHz
    const a = Math.floor((200 / sr) * N), b = Math.floor((6000 / sr) * N);
    let lg = 0, ar = 0;
    for (let i = a; i < b; i++) { lg += Math.log(mag2[i] + 1e-20); ar += mag2[i]; }
    flatAcc += Math.exp(lg / (b - a)) / (ar / (b - a) + 1e-20);
    for (let i = Math.floor((300 / sr) * N); i < Math.floor((3000 / sr) * N); i++) mid += mag2[i];
    for (let i = Math.floor((3000 / sr) * N); i < Math.floor((10000 / sr) * N); i++) hf += mag2[i];
    crest.push(20 * Math.log10(f.pk / f.rms));
    used++;
  }
  if (!used) return null;
  const ltas = Array.from(band, (v) => 10 * Math.log10(v / used + 1e-20));
  const mean = ltas.reduce((s, v) => s + v, 0) / ltas.length;
  const shape = ltas.map((v) => v - mean);
  crest.sort((x, y) => x - y);
  const rmsDb = active.map((f) => 20 * Math.log10(f.rms)).sort((x, y) => x - y);
  // stereo width
  let side = 0, midE = 0;
  if (chans.length > 1) for (let i = start; i < end; i += 4) { const l = chans[0][i], r = chans[1][i]; side += (l - r) * (l - r); midE += (l + r) * (l + r); }
  // reverb-ish tail: energy ratio of frames just after peaks vs peaks
  let tail = 0, tn = 0;
  for (let k = 1; k + 3 < frames.length; k++) {
    if (frames[k].rms > frames[k - 1].rms * 1.6 && frames[k].rms > maxRms * 0.2) { tail += frames[k + 3].rms / frames[k].rms; tn++; }
  }
  return {
    bands: BANDS.map((f) => Math.round(f)),
    shape: shape.map((v) => +v.toFixed(2)),
    flat: +(flatAcc / used).toFixed(4),
    hf: +(10 * Math.log10((hf + 1e-20) / (mid + 1e-20))).toFixed(2),
    crest: +crest[Math.floor(crest.length / 2)].toFixed(2),
    dyn: +(rmsDb[Math.floor(rmsDb.length * 0.95)] - rmsDb[Math.floor(rmsDb.length * 0.1)]).toFixed(2),
    width: chans.length > 1 ? +(side / (midE + 1e-12)).toFixed(3) : 0,
    tail: tn ? +(tail / tn).toFixed(3) : 0,
    level: +(20 * Math.log10(Math.sqrt(active.reduce((s, f) => s + f.rms * f.rms, 0) / active.length) + 1e-12)).toFixed(2),
  };
}
function fileFeatures(file, t0, t1) {
  const { chans, sr } = readWav(file);
  return features(chans, sr, t0, t1);
}
// mix several stems (same length) and analyse
function stemsFeatures(files, t0, t1) {
  let mix = null, sr = 48000;
  for (const f of files) {
    const w = readWav(f);
    sr = w.sr;
    if (!mix) mix = w.chans.map((c) => Float32Array.from(c));
    else w.chans.forEach((c, k) => { const m = mix[Math.min(k, mix.length - 1)]; for (let i = 0; i < Math.min(m.length, c.length); i++) m[i] += c[i]; });
  }
  return features(mix, sr, t0, t1);
}

// ------------------------------------------------------------------ DI clip + offline renders
function defaultDI() {
  const p = path.join(toolsDir(), 'offline-di-v1.wav');
  if (fs.existsSync(p)) return p;
  // synthetic DI guitar: single notes, power chords, open chords, palm-muted chugs (Karplus-Strong strings)
  const sr = 48000;
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
  const out = new Float32Array(sr * 12);
  const pluck = (t, f, dur, amp, damp = 0.996, bright = 0.5) => {
    const N = Math.floor(sr / f), s0 = Math.floor(t * sr), n = Math.floor(dur * sr);
    const buf = new Float32Array(N).map(() => rnd() * amp);
    for (let k = 0; k < Math.floor((1 - bright) * 4); k++) for (let i = 0; i < N; i++) buf[i] = 0.5 * (buf[i] + buf[(i + 1) % N]);
    for (let i = 0; i < n && s0 + i < out.length; i++) {
      const j = i % N;
      out[s0 + i] += buf[j];
      buf[j] = 0.5 * (buf[j] + buf[(j + 1) % N]) * damp;
    }
  };
  const E = [82.41, 110, 146.83, 196, 246.94, 329.63];
  const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);
  // riff of single notes
  [40, 43, 45, 47, 50, 52, 55, 57, 59, 62, 64, 67].forEach((m, i) => pluck(i * 0.22, midi(m), 0.5, 0.35));
  // power chords
  [[40, 47, 52], [43, 50, 55], [45, 52, 57], [38, 45, 50]].forEach((ch, i) => ch.forEach((m) => pluck(3 + i * 0.6, midi(m), 0.6, 0.28)));
  // palm-muted chugs
  for (let i = 0; i < 8; i++) pluck(5.6 + i * 0.16, midi(40), 0.14, 0.32, 0.97, 0.3);
  // open chords (strummed)
  [[0, 2, 2, 1, 0, 0], [3, 2, 0, 0, 0, 3], [0, 0, 2, 2, 2, 0]].forEach((fr, i) => fr.forEach((f, s) => pluck(7 + i * 1.4 + s * 0.012, E[s] * Math.pow(2, f / 12), 1.4, 0.18)));
  // lead line with sustain
  [64, 67, 69, 71, 74, 76].forEach((m, i) => pluck(11 + i * 0.15, midi(m), 0.3, 0.3, 0.998, 0.6));
  let pk = 0;
  for (const v of out) pk = Math.max(pk, Math.abs(v));
  for (let i = 0; i < out.length; i++) out[i] *= 0.5 / pk;
  writeWav(p, [out], sr);
  return p;
}
const work = path.join(os.tmpdir(), 'tz-offline-' + process.pid);
fs.mkdirSync(work, { recursive: true });
let evalSeq = 0;
async function renderAndAnalyse(graph, diPath) {
  const id = ++evalSeq;
  const gp = path.join(work, `g${id}.json`), op = path.join(work, `o${id}.wav`);
  fs.writeFileSync(gp, JSON.stringify({ settings: { quality: 1 }, graph }));
  const r = await run(engineBin(), ['--offline', gp, diPath, op], { nice: 15 });
  try {
    if (r.code !== 0 || !fs.existsSync(op)) return { error: (r.err || '').slice(0, 300) };
    const w = readWav(op);
    const f = features(w.chans, w.sr);
    return f || { error: 'silent' };
  } finally {
    fs.rmSync(gp, { force: true });
    fs.rmSync(op, { force: true });
  }
}
// evaluate many graphs (2 at a time – one per core)
async function evalGraphs(graphs, diPath) {
  const di = diPath || defaultDI();
  const out = new Array(graphs.length);
  let next = 0;
  const worker = async () => {
    while (next < graphs.length) {
      const i = next++;
      out[i] = await renderAndAnalyse(graphs[i], di);
    }
  };
  const n = Math.max(1, Math.min(6, os.cpus().length - 1));
  await Promise.all(Array.from({ length: n }, worker));
  return out;
}
// render a graph to a wav file
async function renderPreview(graph, diPath) {
  const di = diPath || defaultDI();
  const gp = path.join(work, 'preview.json'), op = path.join(work, `preview-${Date.now()}.wav`);
  fs.writeFileSync(gp, JSON.stringify({ settings: { quality: 1 }, graph }));
  const r = await run(engineBin(), ['--offline', gp, di, op]);
  if (r.code !== 0) throw new Error('render failed');
  return op;
}

module.exports = { init, stemsFeatures, evalGraphs, renderPreview, defaultDI, readWav };
