// Runs tonezone-engine (the same C++ engine as the desktop) and talks the same JSON lines protocol on
// stdin / stdout. Restarts it if it dies, keeps the last graph, and preloads presets for instant switching.
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');
const { spawn, spawnSync } = require('child_process');
const { EventEmitter } = require('events');
const hw = require('./hw');
const log = require('./log');

function findEngine() {
  if (process.env.TZ_ENGINE && fs.existsSync(process.env.TZ_ENGINE)) return process.env.TZ_ENGINE;
  const arch = process.arch === 'arm' ? 'armhf' : process.arch;
  for (const n of [`tonezone-engine-${arch}`, 'tonezone-engine']) {
    const p = path.join(hw.SLOT, 'engine', n);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

class Engine extends EventEmitter {
  constructor() {
    super();
    this.proc = null;
    this.stopping = false;
    this.restarts = 0;
    this.status = null;
    this.ready = false;
    this.cached = new Set(); // keys the engine holds built
    this.preloadQueue = [];
    this.preloading = null;
    this.current = null; // { key, graph }
    this.settings = {};
    this.ports = null;
  }

  start(env = {}) {
    const bin = findEngine();
    if (!bin) { log.error('engine binary not found', 'engine'); return false; }
    this.env = env;
    this.stopping = false;
    this.bin = bin;
    const e = Object.assign({}, process.env, env, {
      PIPEWIRE_LATENCY: `${this.settings.buffer || 128}/48000`,
      PIPEWIRE_PROPS: JSON.stringify({ 'node.name': 'tone-zone', 'node.description': 'Tone Zone', 'media.role': 'Production' }),
    });
    const args = ['--data', hw.DATA];
    this.proc = spawn(bin, args, { env: e, stdio: ['pipe', 'pipe', 'pipe'] });
    this.ready = false;
    this.cached.clear();
    this.preloading = null;
    const rl = readline.createInterface({ input: this.proc.stdout });
    rl.on('line', (l) => {
      if (!l) return;
      let ev;
      try { ev = JSON.parse(l); } catch { return; }
      this.onEvent(ev);
    });
    this.proc.stderr.on('data', (d) => String(d).split('\n').filter((x) => x.trim()).forEach((x) => log.info(x.trim(), 'engine')));
    const p = this.proc;
    p.on('exit', (code, sig) => {
      if (this.proc === p) this.proc = null;
      this.ready = false;
      if (this.stopping) return;
      log.warn(`engine exited (${sig || code}), restarting`, 'engine');
      this.emit('exit', code);
      const delay = Math.min(5000, 300 * Math.pow(2, this.restarts++));
      setTimeout(() => !this.stopping && this.start(this.env), delay);
    });
    setTimeout(() => (this.restarts = 0), 20000).unref();
    // re-apply after (re)start
    this.send({ cmd: 'settings', ...this.settings });
    if (this.current) this.send({ cmd: 'setGraph', key: this.current.key, graph: this.current.graph });
    this.send({ cmd: 'hello' });
    return true;
  }

  onEvent(ev) {
    switch (ev.ev) {
      case 'status': this.status = ev; break;
      case 'ready':
        this.ready = true;
        log.info(`audio running: ${ev.sr} Hz, ${ev.buffer} frames${ev.lib ? ', ' + path.basename(path.dirname(ev.lib)) + '/' + path.basename(ev.lib) : ''}`, 'engine');
        break;
      case 'audioError': log.error('audio: ' + ev.error, 'engine'); break;
      case 'blockError': log.warn(`block ${ev.id}: ${ev.error}`, 'engine'); break;
      case 'error': log.warn('engine: ' + ev.error, 'engine'); break;
      case 'ports': this.ports = ev; break;
      case 'preloaded':
        this.cached.add(ev.key);
        if (this.preloading && this.preloading.key === ev.key) this.preloading = null;
        this.pumpPreload();
        break;
      case 'cacheCleared': this.cached.clear(); this.emit('cacheCleared'); break;
      case 'notPreloaded':
        // fall back to a normal load
        if (this.want && this.want.key === ev.key) this.send({ cmd: 'setGraph', key: ev.key, graph: this.want.graph });
        break;
      case 'graphApplied':
        if (ev.key) this.cached.delete(ev.key);
        if (this.want && (!ev.key || this.want.key === ev.key)) {
          const ms = Date.now() - this.want.t0;
          this.emit('applied', { key: ev.key, ms, cached: !!ev.cached });
          this.want = null;
        }
        break;
    }
    this.emit('event', ev);
  }

  send(cmd) {
    if (!this.proc || !this.proc.stdin.writable) return false;
    try { this.proc.stdin.write(JSON.stringify(cmd) + '\n'); return true; } catch { return false; }
  }

  // switch to a preset: a pointer swap when it was preloaded, a normal load otherwise
  use(key, graph) {
    const prev = this.current;
    this.current = { key, graph };
    this.want = { key, graph, t0: Date.now() };
    this.preloadQueue = this.preloadQueue.filter((x) => x.key !== key);
    if (this.cached.has(key)) this.send({ cmd: 'useGraph', key });
    else this.send({ cmd: 'setGraph', key, graph });
    // the engine keeps the outgoing graph built (stashed under its key)
    if (prev && prev.key && prev.key !== key) this.cached.add(prev.key);
  }

  // keep exactly these presets built (besides the current one)
  preload(list) {
    const keys = new Set(list.map((x) => x.key));
    const drop = [...this.cached].filter((k) => !keys.has(k));
    if (drop.length) {
      this.send({ cmd: 'dropCache', keep: [...this.cached].filter((k) => keys.has(k)) });
      drop.forEach((k) => this.cached.delete(k));
    }
    this.preloadQueue = list.filter((x) => !this.cached.has(x.key) && (!this.current || x.key !== this.current.key));
    this.pumpPreload();
  }
  pumpPreload() {
    if (this.preloading || !this.preloadQueue.length || !this.proc) return;
    const next = this.preloadQueue.shift();
    this.preloading = next;
    this.send({ cmd: 'preload', key: next.key, graph: next.graph });
  }

  setSettings(s) {
    Object.assign(this.settings, s);
    this.send(Object.assign({ cmd: 'settings' }, s));
  }

  stop() {
    this.stopping = true;
    if (this.proc) {
      this.send({ cmd: 'quit' });
      const p = this.proc;
      setTimeout(() => { try { p.kill('SIGKILL'); } catch {} }, 1000).unref();
    }
  }
  restart(env) {
    if (this.proc) {
      const p = this.proc;
      this.stopping = true;
      p.once('exit', () => this.start(env || this.env));
      this.send({ cmd: 'quit' });
      setTimeout(() => { try { p.kill('SIGKILL'); } catch {} }, 1500).unref();
    } else this.start(env || this.env);
  }
}

// render a short clip offline: proves the binary runs (update health check, self test). Returns ms or throws.
function selfTest(bin = findEngine()) {
  if (!bin) throw new Error('engine binary not found');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tz-self-'));
  try {
    const sr = 48000, n = sr / 2;
    const buf = Buffer.alloc(44 + n * 4);
    buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 4, 4); buf.write('WAVE', 8); buf.write('fmt ', 12);
    buf.writeUInt32LE(16, 16); buf.writeUInt16LE(3, 20); buf.writeUInt16LE(1, 22); buf.writeUInt32LE(sr, 24);
    buf.writeUInt32LE(sr * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(32, 34); buf.write('data', 36); buf.writeUInt32LE(n * 4, 40);
    for (let i = 0; i < n; i++) buf.writeFloatLE(0.2 * Math.sin((2 * Math.PI * 220 * i) / sr), 44 + i * 4);
    fs.writeFileSync(path.join(tmp, 'in.wav'), buf);
    const g = { nodes: [{ id: 'd', algo: 'drive', nIn: 1, nOut: 1, params: {} }, { id: 'r', algo: 'reverb', nIn: 1, nOut: 2, params: {} }],
      cables: [{ from: { node: '__in', port: 0 }, to: { node: 'd', port: 0 } }, { from: { node: 'd', port: 0 }, to: { node: 'r', port: 0 } }, { from: { node: 'r', port: 0 }, to: { node: '__out', port: 0 } }, { from: { node: 'r', port: 1 }, to: { node: '__out', port: 1 } }] };
    fs.writeFileSync(path.join(tmp, 'g.json'), JSON.stringify(g));
    const t0 = Date.now();
    const r = spawnSync(bin, ['--offline', path.join(tmp, 'g.json'), path.join(tmp, 'in.wav'), path.join(tmp, 'out.wav'), '--block', '128'], { encoding: 'utf8', timeout: 60000 });
    if (r.status !== 0) throw new Error('engine self test failed: ' + (r.stderr || r.error || r.status));
    const out = fs.readFileSync(path.join(tmp, 'out.wav'));
    let peak = 0;
    for (let o = 44; o + 4 <= out.length; o += 4) peak = Math.max(peak, Math.abs(out.readFloatLE(o)));
    if (!(peak > 0.001 && peak < 2)) throw new Error('engine self test: output looks wrong (peak ' + peak + ')');
    return { ms: Date.now() - t0, peak, load: Number((r.stderr.match(/load = ([\d.]+)/) || [])[1] || 0) };
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

module.exports = { Engine, findEngine, selfTest };
