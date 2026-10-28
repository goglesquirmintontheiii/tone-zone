// Tone Match backend: audio sources (files / YouTube via yt-dlp), AI stem separation (Demucs in a private
// Python venv), offline renders of candidate rigs through the DSP engine and audio feature extraction.
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');
const crypto = require('crypto');
const { spawn, execFile } = require('child_process');

let dataRoot = null, appRoot = null, engineBin = null, send = () => {};
function init(opts) {
  ({ dataRoot, appRoot, engineBin, send } = opts);
  for (const d of ['tools', 'ai', 'tonematch']) fs.mkdirSync(path.join(dataRoot, d), { recursive: true });
}
const toolsDir = () => path.join(dataRoot, 'tools');
const projDir = (id) => path.join(dataRoot, 'tonematch', path.basename(id));
const venv = () => path.join(dataRoot, 'ai', 'venv');
const venvPy = () => path.join(venv(), 'bin', 'python');
const separateScript = () => {
  const unpacked = appRoot.replace(/app\.asar$/, 'app.asar.unpacked');
  return [path.join(unpacked, 'tools', 'separate.py'), path.join(appRoot, 'tools', 'separate.py')].find((p) => fs.existsSync(p));
};

// ------------------------------------------------------------------ helpers
function which(cmd) {
  for (const d of (process.env.PATH || '').split(':')) {
    const p = path.join(d, cmd);
    try { fs.accessSync(p, fs.constants.X_OK); return p; } catch {}
  }
  return null;
}
function download(url, dest, onProgress, redirects = 0) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'tone-zone' } }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && redirects < 8) {
        res.resume();
        return resolve(download(new URL(res.headers.location, url).href, dest, onProgress, redirects + 1));
      }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error(`HTTP ${res.statusCode} for ${url}`)); }
      const total = +res.headers['content-length'] || 0;
      let got = 0;
      const tmp = dest + '.part';
      const f = fs.createWriteStream(tmp);
      res.on('data', (c) => { got += c.length; onProgress && onProgress(total ? got / total : 0, got); });
      res.pipe(f);
      f.on('finish', () => f.close(() => { fs.renameSync(tmp, dest); resolve(dest); }));
      f.on('error', reject);
    }).on('error', reject);
  });
}
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

// ------------------------------------------------------------------ projects
function newProject(title) {
  const id = Date.now().toString(36) + '-' + crypto.randomBytes(3).toString('hex');
  fs.mkdirSync(path.join(projDir(id), 'stems'), { recursive: true });
  const meta = { id, title: title || 'Untitled', created: Date.now(), stems: {} };
  fs.writeFileSync(path.join(projDir(id), 'meta.json'), JSON.stringify(meta, null, 2));
  return meta;
}
function getProject(id) {
  try { return JSON.parse(fs.readFileSync(path.join(projDir(id), 'meta.json'), 'utf8')); } catch { return null; }
}
function saveProject(meta) {
  fs.writeFileSync(path.join(projDir(meta.id), 'meta.json'), JSON.stringify(meta, null, 2));
  return meta;
}
function listProjects() {
  const d = path.join(dataRoot, 'tonematch');
  return fs.readdirSync(d).map(getProject).filter(Boolean).sort((a, b) => b.created - a.created);
}
function deleteProject(id) {
  fs.rmSync(projDir(id), { recursive: true, force: true });
}
function importFile(src) {
  const meta = newProject(path.basename(src).replace(/\.[^.]+$/, ''));
  const dest = path.join(projDir(meta.id), 'original' + path.extname(src).toLowerCase());
  fs.copyFileSync(src, dest);
  meta.original = dest;
  return saveProject(meta);
}
// renderer decoded the audio (Web Audio) -> write the canonical source.wav
function writeSource(id, chans, sr) {
  const meta = getProject(id);
  const p = path.join(projDir(id), 'source.wav');
  writeWav(p, chans.map((c) => Float32Array.from(c)), sr);
  meta.source = p;
  meta.sr = sr;
  meta.duration = chans[0].length / sr;
  return saveProject(meta);
}
function writeStem(id, name, chans, sr) {
  const meta = getProject(id);
  const p = path.join(projDir(id), 'stems', name + '.wav');
  writeWav(p, chans.map((c) => Float32Array.from(c)), sr);
  meta.stems[name] = p;
  return saveProject(meta);
}

// ------------------------------------------------------------------ yt-dlp
function ytdlpPath() {
  const own = path.join(toolsDir(), 'yt-dlp');
  if (fs.existsSync(own)) return own;
  return which('yt-dlp');
}
async function installYtdlp() {
  const dest = path.join(toolsDir(), 'yt-dlp');
  await download('https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux', dest, (p) => send('tm:progress', { task: 'ytdlp-install', p }));
  fs.chmodSync(dest, 0o755);
  return dest;
}
async function fetchYoutube(url) {
  const bin = ytdlpPath();
  if (!bin) throw new Error('yt-dlp is not installed');
  const meta = newProject('YouTube');
  const dir = projDir(meta.id);
  const ffmpeg = which('ffmpeg');
  const args = ['--no-playlist', '--newline', '-f', 'bestaudio/best', '-o', path.join(dir, 'original.%(ext)s'), '--print', 'before_dl:TITLE %(title)s', '--print', 'after_move:FILE %(filepath)s'];
  if (ffmpeg) args.push('-x', '--audio-format', 'wav');
  args.push(url);
  let title = null, file = null;
  const r = await run(bin, args, {
    onLine: (l) => {
      if (l.startsWith('TITLE ')) title = l.slice(6);
      else if (l.startsWith('FILE ')) file = l.slice(5).trim();
      const m = l.match(/\[download\]\s+([\d.]+)%/);
      if (m) send('tm:progress', { task: 'youtube', p: +m[1] / 100, line: l });
    },
  });
  if (r.code !== 0 || !file || !fs.existsSync(file)) {
    deleteProject(meta.id);
    throw new Error((r.err || r.out).split('\n').filter((x) => /ERROR/.test(x)).join(' ') || 'yt-dlp failed');
  }
  meta.title = title || 'YouTube audio';
  meta.url = url;
  meta.original = file;
  return saveProject(meta);
}
function readFileBytes(p) {
  const b = fs.readFileSync(p);
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
}

// ------------------------------------------------------------------ AI environment (Demucs)
async function aiStatus() {
  const st = { python: which('python3'), venv: fs.existsSync(venvPy()), script: !!separateScript() };
  if (!st.venv) return st;
  const r = await run(venvPy(), [separateScript(), '--check']);
  const m = (r.out || '').match(/RESULT (.*)/);
  if (m) Object.assign(st, JSON.parse(m[1]));
  st.ready = !!(st.torch && st.demucs && st.soundfile);
  const marker = path.join(dataRoot, 'ai', 'model-ready');
  st.modelReady = fs.existsSync(marker);
  return st;
}
let installing = false;
async function aiInstall(kind = 'cuda') {
  if (installing) throw new Error('already installing');
  installing = true;
  const log = (l) => send('tm:log', { task: 'ai-install', line: l });
  const step = (p, label) => send('tm:progress', { task: 'ai-install', p, label });
  try {
    const py = which('python3');
    if (!py) throw new Error('python3 was not found – install it with your package manager (e.g. sudo dnf install python3)');
    if (!fs.existsSync(venvPy())) {
      step(0.02, 'Creating Python environment');
      const r = await run(py, ['-m', 'venv', venv()], { onLine: log });
      if (r.code !== 0) throw new Error('could not create the virtual environment: ' + r.err);
    }
    const pip = [venvPy(), '-m', 'pip'];
    step(0.06, 'Updating pip');
    await run(pip[0], [...pip.slice(1), 'install', '--upgrade', 'pip', 'wheel'], { onLine: log });
    step(0.1, kind === 'cpu' ? 'Installing PyTorch (CPU, ~250 MB)' : 'Installing PyTorch with NVIDIA CUDA (~2.5 GB)');
    const torchArgs = ['install', 'torch', 'torchaudio'];
    if (kind === 'cpu') torchArgs.push('--index-url', 'https://download.pytorch.org/whl/cpu');
    let r = await run(pip[0], [...pip.slice(1), ...torchArgs], { onLine: (l) => { log(l); const m = l.match(/(\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?) (MB|GB)/); if (m) step(0.1 + 0.6 * Math.min(1, +m[1] / +m[2]), 'Downloading PyTorch'); } });
    if (r.code !== 0) throw new Error('PyTorch install failed (see log)');
    step(0.72, 'Installing Demucs + soundfile');
    r = await run(pip[0], [...pip.slice(1), 'install', 'demucs', 'soundfile'], { onLine: log });
    if (r.code !== 0) throw new Error('Demucs install failed (see log)');
    step(0.85, 'Downloading the separation model (htdemucs_6s, ~80 MB)');
    r = await run(venvPy(), ['-c', "from demucs.pretrained import get_model; get_model('htdemucs_6s'); print('ok')"], { onLine: log });
    if (r.code === 0) fs.writeFileSync(path.join(dataRoot, 'ai', 'model-ready'), String(Date.now()));
    else log('Model download will be retried on first use.');
    step(1, 'Ready');
    return aiStatus();
  } finally {
    installing = false;
  }
}
async function aiRemove() {
  fs.rmSync(path.join(dataRoot, 'ai'), { recursive: true, force: true });
  fs.mkdirSync(path.join(dataRoot, 'ai'), { recursive: true });
  return true;
}
let sepProc = null;
async function separate(id, opts = {}) {
  const meta = getProject(id);
  if (!meta || !meta.source) throw new Error('no source audio');
  const outDir = path.join(projDir(id), 'stems');
  const args = [separateScript(), '--in', meta.source, '--out', outDir, '--model', opts.model || 'htdemucs_6s', '--device', opts.device || 'auto', '--shifts', String(opts.shifts || 1)];
  if (opts.splitGuitar !== false) args.push('--split-guitar');
  return new Promise((resolve, reject) => {
    sepProc = spawn(venvPy(), args);
    let result = null, errLines = [];
    const onLine = (l) => {
      const p = l.match(/^PROGRESS ([\d.]+) (.*)$/);
      if (p) return send('tm:progress', { task: 'separate', p: +p[1] / 100, label: p[2] });
      const r = l.match(/^RESULT (.*)$/);
      if (r) { result = JSON.parse(r[1]); return; }
      if (/^ERROR /.test(l)) errLines.push(l.slice(6));
      send('tm:log', { task: 'separate', line: l });
    };
    let buf = '';
    const feed = (b) => { buf += b.toString(); const parts = buf.split(/\r?\n/); buf = parts.pop(); parts.forEach((l) => l.trim() && onLine(l.trim())); };
    sepProc.stdout.on('data', feed);
    sepProc.stderr.on('data', (b) => b.toString().split(/[\r\n]+/).forEach((l) => l.trim() && send('tm:log', { task: 'separate', line: l.trim() })));
    sepProc.on('close', (code) => {
      sepProc = null;
      if (code === 0 && result) {
        meta.stems = Object.assign({}, meta.stems, result.stems);
        meta.separated = { model: result.model, device: result.device, at: Date.now() };
        resolve(saveProject(meta));
      } else reject(new Error(errLines.join(' ') || `separation failed (exit ${code})`));
    });
  });
}
function cancelSeparation() {
  if (sepProc) sepProc.kill('SIGTERM');
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
  const p = path.join(toolsDir(), 'tonematch-di-v1.wav');
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
const work = path.join(os.tmpdir(), 'tz-tonematch-' + process.pid);
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
// render a graph to a file (for A/B listening of the result against the stem)
async function renderPreview(graph, diPath) {
  const di = diPath || defaultDI();
  const gp = path.join(work, 'preview.json'), op = path.join(work, `preview-${Date.now()}.wav`);
  fs.writeFileSync(gp, JSON.stringify({ settings: { quality: 1 }, graph }));
  const r = await run(engineBin(), ['--offline', gp, di, op]);
  if (r.code !== 0) throw new Error('render failed');
  return op;
}

module.exports = {
  init, newProject, listProjects, getProject, saveProject, deleteProject, importFile, writeSource, writeStem, readFileBytes,
  ytdlpPath, installYtdlp, fetchYoutube, aiStatus, aiInstall, aiRemove, separate, cancelSeparation,
  fileFeatures, stemsFeatures, evalGraphs, renderPreview, defaultDI, readWav,
};
