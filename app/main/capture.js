// Capture: turns a Tone Zone preset (or part of its chain) into a NAM model. Renders the official NAM training
// signal through the board with the offline engine, trains it with the NAM trainer in a private Python venv,
// checks the result in our own engine and adds the .nam to the library.
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { readWav } = require('./offline');
const lib = require('./library');

const NAM_VERSION = '0.13.0';
// v3_0_0.wav, the standard NAM training signal (the NAM trainer links the same Google Drive file)
const INPUT_URLS = [
  'https://drive.usercontent.google.com/download?id=1Pgf8PdE0rKB1TD4TRPKbpNo1ByR3IOm9&export=download&confirm=t',
  'https://drive.google.com/uc?export=download&id=1Pgf8PdE0rKB1TD4TRPKbpNo1ByR3IOm9&confirm=t',
];
const INPUT_MD5 = '36cd1af62985c2fac3e654333e36431e';
const SR = 48000;

const fake = () => !!process.env.TZ_CAPTURE_FAKE_TRAINER;
let dataRoot = null, engineBin = null, send = () => {};
function init(opts) {
  ({ dataRoot, engineBin } = opts);
  send = opts.send || send;
  fs.mkdirSync(toolsDir(), { recursive: true });
  // leftovers from a run that was interrupted by closing the app
  try { fs.rmSync(path.join(dataRoot, 'captures', 'work'), { recursive: true, force: true }); } catch {}
}
const toolsDir = () => path.join(dataRoot, 'tools');
const inputPath = () => path.join(toolsDir(), 'nam-v3_0_0.wav');
const venvDir = () => path.join(dataRoot, 'nam-venv');
const venvPy = () => path.join(venvDir(), 'bin', 'python');
const markerPath = () => path.join(venvDir(), '.tz-ready.json');
const workDir = () => path.join(dataRoot, 'captures', 'work');

function which(cmd) {
  for (const d of (process.env.PATH || '').split(':')) {
    const p = path.join(d, cmd);
    try { fs.accessSync(p, fs.constants.X_OK); return p; } catch {}
  }
  return null;
}
// PyTorch wheels lag behind the newest Python, so prefer a well supported version
function findPython() {
  for (const v of ['python3.12', 'python3.11', 'python3.13', 'python3.10', 'python3']) {
    const p = which(v);
    if (p) return p;
  }
  return null;
}
function hasNvidia() {
  return fs.existsSync('/proc/driver/nvidia/version') || !!which('nvidia-smi');
}
function readJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
}

function run(cmd, args, { onLine, env, nice, track } = {}) {
  return new Promise((resolve) => {
    const p = spawn(cmd, args, { env: Object.assign({}, process.env, env || {}), detached: true });
    if (nice && p.pid) try { os.setPriority(p.pid, nice); } catch {}
    if (track) track(p);
    let out = '', err = '', partial = '';
    const feed = (buf, isErr) => {
      const s = buf.toString();
      if (isErr) err = (err + s).slice(-20000); else out = (out + s).slice(-200000);
      if (!onLine) return;
      const lines = (partial + s).split(/\r?\n|\r/);
      partial = lines.pop();
      for (const l of lines) if (l.trim()) onLine(l, isErr);
    };
    p.stdout.on('data', (b) => feed(b, false));
    p.stderr.on('data', (b) => feed(b, true));
    p.on('error', (e) => resolve({ code: -1, out, err: err + String(e) }));
    p.on('close', (code, signal) => {
      if (partial.trim() && onLine) onLine(partial, false);
      resolve({ code, signal, out, err });
    });
  });
}
function killTree(p) {
  if (!p || p.exitCode !== null) return;
  try { process.kill(-p.pid, 'SIGTERM'); } catch { try { p.kill('SIGTERM'); } catch {} }
  setTimeout(() => { try { process.kill(-p.pid, 'SIGKILL'); } catch {} }, 4000).unref();
}

// ------------------------------------------------------------------ WAV helpers
function wavInfo(file) {
  try {
    const fd = fs.openSync(file, 'r');
    const b = Buffer.alloc(4096);
    fs.readSync(fd, b, 0, 4096, 0);
    fs.closeSync(fd);
    if (b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WAVE') return null;
    let pos = 12, info = {};
    while (pos + 8 <= b.length) {
      const id = b.toString('ascii', pos, pos + 4), len = b.readUInt32LE(pos + 4);
      if (id === 'fmt ') info = { fmt: b.readUInt16LE(pos + 8), channels: b.readUInt16LE(pos + 10), sr: b.readUInt32LE(pos + 12), bits: b.readUInt16LE(pos + 22) };
      if (id === 'data') { info.frames = Math.floor(len / ((info.bits / 8) * info.channels)); break; }
      pos += 8 + len + (len & 1);
    }
    return info.sr ? info : null;
  } catch { return null; }
}
// 24-bit PCM mono: what the NAM trainer reads (it can't read float WAV)
function writeWav24(file, x, sr) {
  const n = x.length, buf = Buffer.alloc(44 + n * 3);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 3, 4); buf.write('WAVE', 8); buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22); buf.writeUInt32LE(sr, 24);
  buf.writeUInt32LE(sr * 3, 28); buf.writeUInt16LE(3, 32); buf.writeUInt16LE(24, 34); buf.write('data', 36); buf.writeUInt32LE(n * 3, 40);
  for (let i = 0, o = 44; i < n; i++, o += 3) {
    const v = Math.max(-8388608, Math.min(8388607, Math.round(x[i] * 8388607)));
    buf.writeIntLE(v, o, 3);
  }
  fs.writeFileSync(file, buf);
}
function writeWavF32(file, x, sr) {
  const n = x.length, buf = Buffer.alloc(44 + n * 4);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 4, 4); buf.write('WAVE', 8); buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(3, 20); buf.writeUInt16LE(1, 22); buf.writeUInt32LE(sr, 24);
  buf.writeUInt32LE(sr * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(32, 34); buf.write('data', 36); buf.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) buf.writeFloatLE(x[i], 44 + i * 4);
  fs.writeFileSync(file, buf);
}
function md5(file) {
  return crypto.createHash('md5').update(fs.readFileSync(file)).digest('hex');
}

// ------------------------------------------------------------------ training signal
let inputCache = null;
function inputStatus() {
  const p = inputPath();
  if (!fs.existsSync(p)) return { ok: false, missing: true };
  const st = fs.statSync(p);
  if (inputCache && inputCache.mtime === st.mtimeMs) return inputCache.info;
  const w = wavInfo(p);
  let info;
  if (!w) info = { ok: false, error: 'This file is not a WAV file.' };
  else if (w.sr !== SR) info = { ok: false, error: `The training signal must be 48 kHz (this one is ${w.sr / 1000} kHz).` };
  else if (w.channels !== 1) info = { ok: false, error: 'The training signal must be mono.' };
  else info = { ok: true, official: md5(p) === INPUT_MD5, seconds: Math.round(w.frames / SR) };
  info.path = p;
  inputCache = { mtime: st.mtimeMs, info };
  return info;
}
function download(url, dest, onProgress, redirects = 0) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'tone-zone' } }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && redirects < 8) {
        res.resume();
        return resolve(download(new URL(res.headers.location, url).href, dest, onProgress, redirects + 1));
      }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error(`HTTP ${res.statusCode}`)); }
      // Google Drive sometimes answers with a "can't scan this file" page that holds the real link in a form
      if (/text\/html/.test(res.headers['content-type'] || '')) {
        let html = '';
        res.on('data', (c) => (html += c));
        res.on('end', () => {
          const form = html.match(/<form[^>]+id="download-form"[^>]+action="([^"]+)"/);
          if (!form || redirects > 6) return reject(new Error('the download page did not offer the file'));
          const q = new URLSearchParams();
          for (const m of html.matchAll(/<input[^>]+name="([^"]+)"[^>]+value="([^"]*)"/g)) q.set(m[1], m[2]);
          resolve(download(form[1].replace(/&amp;/g, '&') + '?' + q.toString(), dest, onProgress, redirects + 1));
        });
        return;
      }
      const total = +res.headers['content-length'] || 0;
      let got = 0;
      const tmp = dest + '.part';
      const f = fs.createWriteStream(tmp);
      res.on('data', (c) => { got += c.length; onProgress(total ? got / total : 0, got); });
      res.pipe(f);
      f.on('finish', () => f.close(() => { fs.renameSync(tmp, dest); resolve(dest); }));
      f.on('error', reject);
    });
    req.setTimeout(30000, () => req.destroy(new Error('the connection timed out')));
    req.on('error', reject);
  });
}
let downloading = false;
async function downloadInput() {
  if (downloading) return inputStatus();
  downloading = true;
  const ev = (o) => send('capture:event', Object.assign({ kind: 'input' }, o));
  let lastErr = null;
  try {
    for (const url of INPUT_URLS) {
      try {
        ev({ p: 0, label: 'Downloading the training signal…' });
        const tmp = inputPath() + '.dl';
        await download(url, tmp, (p, got) => ev({ p, label: `Downloading the training signal… ${(got / 1e6).toFixed(1)} MB` }));
        const w = wavInfo(tmp);
        if (!w) { fs.rmSync(tmp, { force: true }); throw new Error('the download was not a WAV file'); }
        fs.renameSync(tmp, inputPath());
        inputCache = null;
        ev({ p: 1, done: true });
        return inputStatus();
      } catch (e) {
        lastErr = e;
      }
    }
    const why = lastErr && /ENOTFOUND|EAI_AGAIN|ECONNREFUSED|timed out/.test(lastErr.message) ? 'no connection' : (lastErr && lastErr.message) || 'unknown error';
    ev({ error: `Could not download the training signal (${why}).` });
    throw new Error(`Could not download the training signal (${why}). Get v3_0_0.wav from the Neural Amp Modeler project and pick it with the Choose file button.`);
  } finally {
    downloading = false;
  }
}
function useInputFile(src) {
  const w = wavInfo(src);
  if (!w) throw new Error('This file is not a WAV file.');
  if (w.sr !== SR) throw new Error(`The training signal must be 48 kHz (this one is ${w.sr / 1000} kHz).`);
  if (w.channels !== 1) throw new Error('The training signal must be mono.');
  fs.copyFileSync(src, inputPath());
  inputCache = null;
  return inputStatus();
}

// ------------------------------------------------------------------ trainer venv
let setupProc = null, setupState = null;
function trainerStatus() {
  const marker = readJson(markerPath());
  const ready = !!marker && (fake() ? !!marker.fake : fs.existsSync(venvPy()));
  return {
    ready,
    info: ready ? marker : null,
    python: fake() ? 'fake' : findPython(),
    venvExists: fs.existsSync(venvDir()),
    nvidia: hasNvidia(),
    dir: venvDir(),
    fake: fake(),
  };
}
function status() {
  return { trainer: trainerStatus(), input: inputStatus(), job: snapshot(), setup: setupState, downloading };
}
async function dirSize(dir) {
  let total = 0;
  const walk = async (d) => {
    let list;
    try { list = await fs.promises.readdir(d, { withFileTypes: true }); } catch { return; }
    for (const e of list) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) await walk(p);
      else if (e.isFile()) try { total += (await fs.promises.stat(p)).size; } catch {}
    }
  };
  await walk(dir);
  return total;
}
async function trainerSize() {
  return fs.existsSync(venvDir()) ? dirSize(venvDir()) : 0;
}

async function setupTrainer(opts = {}) {
  if (setupState && setupState.running) throw new Error('The trainer is already being set up.');
  const gpu = opts.device === 'cuda' || (opts.device !== 'cpu' && hasNvidia());
  const ev = (o) => {
    setupState = Object.assign(setupState || {}, o);
    send('capture:event', Object.assign({ kind: 'setup' }, setupState, o.line ? { line: o.line } : {}));
  };
  setupState = { running: true, p: 0, label: 'Starting…', error: null, gpu, log: [] };
  const log = (l) => {
    setupState.log.push(l);
    if (setupState.log.length > 300) setupState.log.shift();
    ev({ line: l });
  };
  const track = (p) => (setupProc = p);
  try {
    if (fake()) {
      for (let i = 1; i <= 10; i++) {
        if (setupState.cancelled) throw new Error('Cancelled.');
        await new Promise((r) => setTimeout(r, 150));
        ev({ p: i / 10, label: i < 4 ? 'Creating the Python environment' : i < 8 ? 'Installing PyTorch (CPU)' : 'Installing the NAM trainer' });
        log(`fake setup step ${i}`);
      }
      fs.mkdirSync(venvDir(), { recursive: true });
      fs.writeFileSync(markerPath(), JSON.stringify({ fake: true, nam: 'fake', torch: 'fake', gpu: false, device: 'CPU', time: Date.now() }));
      ev({ running: false, done: true, p: 1, label: 'Ready' });
      return trainerStatus();
    }
    const py = findPython();
    if (!py) throw new Error('Python 3 was not found. Install it with your package manager (for example "sudo apt install python3 python3-venv") and try again.');
    fs.rmSync(markerPath(), { force: true });
    if (!fs.existsSync(venvPy())) {
      ev({ p: 0.02, label: 'Creating the Python environment' });
      const r = await run(py, ['-m', 'venv', venvDir()], { onLine: log, track });
      if (r.code !== 0) {
        fs.rmSync(venvDir(), { recursive: true, force: true });
        if (/ensurepip|python3-venv/.test(r.out + r.err)) throw new Error('Python can\'t make a virtual environment yet. Install the "python3-venv" package and try again.');
        throw new Error('Could not create the Python environment (see the log).');
      }
    }
    const pip = (args, onLine) => run(venvPy(), ['-m', 'pip', '--disable-pip-version-check', ...args], { onLine: onLine || log, track });
    ev({ p: 0.05, label: 'Updating pip' });
    await pip(['install', '--upgrade', 'pip', 'wheel']);
    if (setupState.cancelled) throw new Error('Cancelled.');
    // pip shows per-file progress as "Progress <bytes> of <total>" with --progress-bar raw
    const pipProgress = (lo, hi, label) => {
      let file = '', big = false;
      return (l) => {
        const dl = l.match(/^\s*Downloading (\S+?)(?:-\d[^ ]*)? \(([\d.]+) (kB|MB|GB)\)/);
        if (dl) { file = dl[1]; big = dl[3] === 'GB' || (dl[3] === 'MB' && +dl[2] > 20); log(l); return; }
        const m = l.match(/^Progress (\d+) of (\d+)/);
        if (m) {
          const f = +m[1] / Math.max(1, +m[2]);
          if (big) ev({ p: lo + (hi - lo) * f * 0.92, label: `${label}: ${file} ${Math.round(f * 100)}% of ${(+m[2] / 1e6).toFixed(0)} MB` });
          return;
        }
        if (/^Installing collected packages/.test(l)) ev({ p: lo + (hi - lo) * 0.95, label: `${label}: installing` });
        log(l);
      };
    };
    ev({ p: 0.08, label: gpu ? 'Installing PyTorch with NVIDIA CUDA (about 3 GB)' : 'Installing PyTorch for CPU (about 200 MB)' });
    const torchArgs = ['install', '--progress-bar', 'raw', 'torch'];
    if (!gpu) torchArgs.push('--index-url', 'https://download.pytorch.org/whl/cpu');
    let r = await pip(torchArgs, pipProgress(0.08, 0.7, 'PyTorch'));
    if (setupState.cancelled) throw new Error('Cancelled.');
    if (r.code !== 0) throw new Error('Installing PyTorch failed. Check your internet connection and the log.');
    ev({ p: 0.7, label: 'Installing the NAM trainer' });
    r = await pip(['install', '--progress-bar', 'raw', `neural-amp-modeler==${NAM_VERSION}`], pipProgress(0.7, 0.95, 'NAM trainer'));
    if (setupState.cancelled) throw new Error('Cancelled.');
    if (r.code !== 0) throw new Error('Installing the NAM trainer failed (see the log).');
    ev({ p: 0.96, label: 'Checking the trainer' });
    const info = await trainerCheck(log, track);
    if (!info) throw new Error('The trainer was installed but does not start (see the log).');
    fs.writeFileSync(markerPath(), JSON.stringify(Object.assign(info, { time: Date.now() })));
    ev({ running: false, done: true, p: 1, label: 'Ready' });
    return trainerStatus();
  } catch (e) {
    ev({ running: false, error: e.message });
    throw e;
  } finally {
    setupProc = null;
    if (setupState) setupState.running = false;
  }
}
function cancelSetup() {
  if (!setupState || !setupState.running) return false;
  setupState.cancelled = true;
  killTree(setupProc);
  return true;
}
function trainScript() {
  // the app may live in an asar archive; Python needs a real file
  const dst = path.join(venvDir(), 'tz-nam-train.py');
  const src = fs.readFileSync(path.join(__dirname, 'nam-train.py'));
  if (!fs.existsSync(dst) || !fs.readFileSync(dst).equals(src)) fs.writeFileSync(dst, src);
  return dst;
}
async function trainerCheck(log, track) {
  const r = await run(venvPy(), [trainScript(), '--check', '--input', '-', '--output', '-', '--outdir', '-'], { onLine: log, track, env: { PYTHONUNBUFFERED: '1' } });
  const m = (r.out || '').match(/^TZ (\{.*"type": "check".*\})$/m);
  return m ? JSON.parse(m[1]) : null;
}
async function removeTrainer() {
  if (job && job.running) throw new Error('Wait for the capture to finish first.');
  cancelSetup();
  await fs.promises.rm(venvDir(), { recursive: true, force: true });
  setupState = null;
  return trainerStatus();
}

// ------------------------------------------------------------------ the capture job
let job = null, trainProc = null, lastSent = 0, sendTimer = null;
const STEP_IDS = ['render', 'train', 'check', 'library'];
function snapshot() {
  if (!job) return null;
  const { proc, ...rest } = job;
  void proc;
  return JSON.parse(JSON.stringify(rest));
}
function pushJob(now) {
  const go = () => { lastSent = Date.now(); sendTimer = null; send('capture:event', { kind: 'job', job: snapshot() }); };
  if (now || Date.now() - lastSent > 120) { clearTimeout(sendTimer); return go(); }
  if (!sendTimer) sendTimer = setTimeout(go, 120);
}
function stepSet(id, o) {
  Object.assign(job.steps[id], o);
  pushJob(o.state && o.state !== 'run');
}
function jobLog(l) {
  job.log.push(l);
  if (job.log.length > 400) job.log.shift();
}

async function renderTarget(graph, input, out, onP) {
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const t0 = Date.now();
  const timer = setInterval(() => onP(1 - Math.exp(-(Date.now() - t0) / 25000)), 400);
  try {
    let gain = 0;
    for (let pass = 0; pass < 2; pass++) {
      const gp = path.join(path.dirname(out), 'graph.json'), raw = path.join(path.dirname(out), 'render-raw.wav');
      // Ultra quality: the most oversampling and the full size of any NAM blocks in the chain
      fs.writeFileSync(gp, JSON.stringify({ settings: { quality: 3, outGainDb: gain, inGainDb: 0 }, graph }));
      const r = await run(engineBin(), ['--offline', gp, input, raw], { nice: 10, track: (p) => (job.proc = p) });
      if (job.cancelled) throw new Error('Cancelled.');
      if (r.code !== 0 || !fs.existsSync(raw)) throw new Error('The engine could not render the preset. ' + (r.err || '').split('\n').filter(Boolean).slice(-2).join(' '));
      const w = readWav(raw);
      fs.rmSync(raw, { force: true });
      const L = w.chans[0], R = w.chans[1] || L;
      // a mono chain only feeds the left output: use it as is, otherwise mix both sides
      let dR = 0, eL = 0;
      for (let i = 0; i < L.length; i += 7) { dR += (L[i] - R[i]) ** 2; eL += L[i] * L[i]; }
      let rEnergy = 0;
      for (let i = 0; i < R.length; i += 7) rEnergy += R[i] * R[i];
      const mono = dR < eL * 1e-6 || rEnergy < eL * 1e-6 ? L : L.map((v, i) => 0.5 * (v + R[i]));
      let pk = 0, e = 0;
      for (let i = 0; i < mono.length; i++) { const a = Math.abs(mono[i]); if (a > pk) pk = a; e += mono[i] * mono[i]; }
      const rms = Math.sqrt(e / mono.length);
      if (rms < 1e-5) throw new Error('The chain is silent. Check that its cables reach the output and that nothing is muted.');
      // the engine's safety limiter starts at 0.95: render quieter instead of capturing the limiter
      if (pk > 0.94 && pass === 0) { gain = Math.min(-3, Math.floor(20 * Math.log10(0.7 / pk))); jobLog(`output peaks at ${pk.toFixed(2)}, rendering again ${gain} dB quieter`); continue; }
      writeWav24(out, mono, SR);
      return { peakDb: 20 * Math.log10(pk), rmsDb: 20 * Math.log10(rms), gainDb: gain };
    }
  } finally {
    clearInterval(timer);
  }
}

// play the finished .nam in our own engine on the validation part (last 9 s) and compare it to the target
async function engineCheck(namFile, input, target, dir) {
  const xi = readWav(input).chans[0], yt = readWav(target).chans[0];
  const n = Math.min(9 * SR, xi.length);
  const pre = SR; // a little lead-in so the model has settled
  const seg = xi.subarray(xi.length - n - pre);
  const inSeg = path.join(dir, 'check-in.wav'), outSeg = path.join(dir, 'check-out.wav'), gp = path.join(dir, 'check.json');
  writeWavF32(inSeg, seg, SR);
  const graph = {
    nodes: [{ id: 'cap', algo: 'nam', nIn: 1, nOut: 1, opts: { files: [namFile] }, params: { normalize: 0 }, bypass: false }],
    cables: [{ from: { node: '__in', port: 0 }, to: { node: 'cap', port: 0 } }, { from: { node: 'cap', port: 0 }, to: { node: '__out', port: 0 } }],
  };
  fs.writeFileSync(gp, JSON.stringify({ settings: { quality: 3 }, graph }));
  const r = await run(engineBin(), ['--offline', gp, inSeg, outSeg], { nice: 10 });
  if (r.code !== 0 || !fs.existsSync(outSeg)) return { ok: false, error: 'The engine could not load the model.' };
  const y = readWav(outSeg).chans[0].subarray(pre);
  const t = yt.subarray(yt.length - n);
  // the trainer shifts the target by the chain's latency: find that shift, then match levels
  const W = Math.min(SR, y.length - 4200);
  let best = 0, bestC = -Infinity;
  for (let lag = -64; lag <= 4096; lag++) {
    let c = 0;
    for (let i = 4200; i < W; i += 2) { const j = i + lag; c += y[i] * t[j]; }
    if (c > bestC) { bestC = c; best = lag; }
  }
  let yy = 0, yt2 = 0, tt = 0;
  const lo = Math.max(0, -best), hi = Math.min(y.length, t.length - best);
  for (let i = lo; i < hi; i++) { yy += y[i] * y[i]; yt2 += y[i] * t[i + best]; tt += t[i + best] * t[i + best]; }
  if (yy < 1e-12) return { ok: false, error: 'The model is silent in the engine.' };
  const g = yt2 / yy;
  const esr = Math.max(0, (tt - 2 * g * yt2 + g * g * yy) / tt);
  return { ok: true, esr, latency: best, gainDb: 20 * Math.log10(Math.abs(g) + 1e-12) };
}

function trainCommand(a) {
  if (fake()) return { cmd: process.execPath, args: [path.join(__dirname, 'capture-fake-trainer.js'), ...a], env: { ELECTRON_RUN_AS_NODE: '1' } };
  return { cmd: venvPy(), args: [trainScript(), ...a], env: { PYTHONUNBUFFERED: '1', MPLBACKEND: 'Agg', PYTHONNOUSERSITE: '1' } };
}

async function train(opts, dir, target) {
  const outdir = path.join(dir, 'train');
  fs.mkdirSync(outdir, { recursive: true });
  const a = ['--input', inputPath(), '--output', target, '--outdir', outdir, '--basename', 'capture', '--name', opts.name, '--arch', opts.arch, '--epochs', String(opts.epochs), '--stop-file', path.join(dir, 'stop'),
    '--threads', String(Math.max(1, os.cpus().length - 1))];
  if (opts.gearType) a.push('--gear-type', opts.gearType);
  if (opts.toneType) a.push('--tone-type', opts.toneType);
  if (opts.ignoreChecks) a.push('--ignore-checks');
  const { cmd, args, env } = trainCommand(a);
  const st = job.steps.train;
  let result = null, error = null;
  const stageText = { loading: 'Starting the trainer…', device: 'Starting the trainer…', checks: 'Checking the recording and timing…', export: 'Saving the model…' };
  const onLine = (l) => {
    if (!l.startsWith('TZ ')) return jobLog(l);
    let m;
    try { m = JSON.parse(l.slice(3)); } catch { return jobLog(l); }
    if (m.type === 'stage') {
      if (m.stage === 'device') job.device = m.device;
      stepSet('train', { text: stageText[m.stage] || st.text });
    } else if (m.type === 'batch') {
      const p = (m.epoch + m.batch / Math.max(1, m.batches)) / opts.epochs;
      stepSet('train', { p: Math.min(0.99, p), text: `Epoch ${m.epoch + 1} of ${opts.epochs}` });
    } else if (m.type === 'epoch') {
      job.epoch = m.epoch;
      if (m.esr != null) job.history.push(+m.esr);
      job.epochTimes.push(m.secs);
      job.esrNow = m.esr;
      const avg = job.epochTimes.slice(-5).reduce((s, v) => s + v, 0) / Math.min(5, job.epochTimes.length);
      job.eta = Math.round(avg * (opts.epochs - m.epoch));
      stepSet('train', { p: m.epoch / opts.epochs, text: `Epoch ${m.epoch} of ${opts.epochs}` });
    } else if (m.type === 'esr') {
      job.esr = m.esr;
      job.esrs = m.esrs;
    } else if (m.type === 'error') {
      error = m;
    } else if (m.type === 'done') {
      result = m;
    }
  };
  const r = await run(cmd, args, { onLine, env, nice: 15, track: (p) => (trainProc = job.proc = p) });
  trainProc = null;
  if (job.cancelled) throw new Error('Cancelled.');
  if (error) {
    const e = new Error(error.code === 'checks' ? 'The trainer\'s data checks failed. This can happen with noisy or changing sounds (gates, modulation).' : error.code === 'input' ? 'The trainer does not recognise the training signal. Use the official v3_0_0.wav file.' : error.message);
    e.code = error.code;
    throw e;
  }
  if (r.code !== 0 || !result || !fs.existsSync(result.file)) {
    const tail = (r.err || '').split('\n').filter(Boolean).slice(-3).join(' ');
    throw new Error('Training stopped with an error. ' + tail.slice(0, 300));
  }
  if (job.esr == null) job.esr = result.esr;
  job.latency = result.latency;
  return result.file;
}

function rating(esr) {
  if (esr == null) return null;
  if (esr < 0.01) return 'Excellent';
  if (esr < 0.035) return 'Very good';
  if (esr < 0.1) return 'Good';
  if (esr < 0.3) return 'Rough';
  return 'Poor';
}

async function start(opts) {
  if (job && job.running) throw new Error('A capture is already running.');
  if (!trainerStatus().ready) throw new Error('Set up the trainer first.');
  const inp = inputStatus();
  if (!inp.ok) throw new Error(inp.error || 'Get the training signal first.');
  opts = Object.assign({ arch: 'a2', epochs: 100, name: 'Capture', category: 'amp', color: '#8a5cf6' }, opts);
  const dir = workDir();
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  job = {
    id: Date.now().toString(36), running: true, name: opts.name, arch: opts.arch, epochs: opts.epochs, started: Date.now(),
    steps: Object.fromEntries(STEP_IDS.map((k) => [k, { state: 'wait', p: 0, text: '' }])),
    epoch: 0, history: [], epochTimes: [], esr: null, esrNow: null, eta: null, log: [], result: null, error: null, cancelled: false,
  };
  pushJob(true);
  let cur = 'render';
  try {
    stepSet('render', { state: 'run', text: 'Playing the training signal through your preset…' });
    const target = path.join(dir, 'target.wav');
    const lv = await renderTarget(opts.graph, inputPath(), target, (p) => stepSet('render', { p }));
    stepSet('render', { state: 'done', p: 1, text: `Done · peak ${lv.peakDb.toFixed(1)} dB${lv.gainDb ? ` (rendered ${-lv.gainDb} dB quieter)` : ''}` });

    cur = 'train';
    stepSet('train', { state: 'run', p: 0, text: 'Starting the trainer…' });
    const nam = await train(opts, dir, target);
    stepSet('train', { state: 'done', p: 1, text: job.epoch < opts.epochs ? `Stopped early after ${job.epoch} epochs` : `${opts.epochs} epochs` });

    cur = 'check';
    stepSet('check', { state: 'run', p: 0.3, text: 'Playing the model in the Tone Zone engine…' });
    const chk = await engineCheck(nam, inputPath(), target, dir);
    job.engine = chk;
    job.rating = rating(job.esr);
    stepSet('check', {
      state: chk.ok ? 'done' : 'error',
      p: 1,
      text: chk.ok ? `ESR ${job.esr != null ? job.esr.toFixed(4) : '?'} · ${job.rating || ''}` : chk.error,
    });
    if (!chk.ok) throw new Error(chk.error);

    cur = 'library';
    stepSet('library', { state: 'run', p: 0.5, text: 'Adding to your library…' });
    const info = lib.inspect([nam], 'capture');
    for (const it of info.items) it.label = opts.modelLabel || (opts.arch === 'a2' ? 'Capture (A2)' : `Capture (${opts.arch[0].toUpperCase()}${opts.arch.slice(1)})`);
    const packs = lib.commit({ stagingId: info.stagingId, name: opts.name, category: opts.category, color: opts.color, items: info.items, origin: 'capture' });
    if (!packs.length) throw new Error('The model could not be added to the library.');
    job.result = { packId: packs[0].id, file: packs[0].files[0], name: packs[0].name };
    stepSet('library', { state: 'done', p: 1, text: `Added as "${packs[0].name}"` });
  } catch (e) {
    job.error = e.message;
    job.errorCode = e.code || null;
    job.steps[cur].state = job.cancelled ? 'cancel' : 'error';
    job.steps[cur].text = job.cancelled ? 'Cancelled' : e.message;
  } finally {
    job.running = false;
    job.proc = null;
    job.finished = Date.now();
    try { fs.writeFileSync(path.join(dataRoot, 'captures', 'last.log'), job.log.join('\n')); } catch {}
    fs.rm(dir, { recursive: true, force: true }, () => {});
    pushJob(true);
  }
  return snapshot();
}
function cancel() {
  if (!job || !job.running) return false;
  job.cancelled = true;
  killTree(job.proc);
  pushJob(true);
  return true;
}
// stop training now and keep the best model so far
function finishEarly() {
  if (!job || !job.running || job.steps.train.state !== 'run') return false;
  fs.writeFileSync(path.join(workDir(), 'stop'), '1');
  job.steps.train.text = 'Finishing…';
  pushJob(true);
  return true;
}
function clearJob() {
  if (job && job.running) return false;
  job = null;
  return true;
}
function shutdown() {
  if (job && job.running) cancel();
  cancelSetup();
}

module.exports = { init, status, trainerStatus, trainerSize, setupTrainer, cancelSetup, removeTrainer, downloadInput, useInputFile, inputStatus, start, cancel, finishEarly, clearJob, shutdown, rating };
