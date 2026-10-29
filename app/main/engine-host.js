// Starts and watches the native DSP engine (a PipeWire/JACK client).
'use strict';
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { EventEmitter } = require('events');

function cpuSupportsV3() {
  try {
    const info = fs.readFileSync('/proc/cpuinfo', 'utf8');
    const flags = (info.match(/^flags\s*:(.*)$/m) || [, ''])[1];
    return ['avx2', 'fma', 'bmi2', 'movbe'].every((f) => flags.includes(' ' + f));
  } catch (_) {
    return false;
  }
}

function findEngine(appRoot, isPackaged) {
  const v3 = cpuSupportsV3();
  const names = v3 ? ['tonezone-engine-v3', 'tonezone-engine-v2'] : ['tonezone-engine-v2'];
  const dirs = isPackaged
    ? [path.join(process.resourcesPath, 'engine')]
    : [path.join(appRoot, '..', 'engine', 'dist'), path.join(appRoot, '..', 'engine', 'build-v3'), path.join(appRoot, '..', 'engine', 'build')];
  if (process.env.TZ_ENGINE && fs.existsSync(process.env.TZ_ENGINE)) return process.env.TZ_ENGINE;
  const found = [];
  for (const d of dirs) {
    for (const n of names.concat(['tonezone-engine'])) {
      const p = path.join(d, n);
      if (fs.existsSync(p)) found.push(p);
    }
  }
  if (!found.length) return null;
  if (isPackaged) return found[0];
  // development: use the most recently built binary
  return found.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0];
}

class EngineHost extends EventEmitter {
  constructor(opts) {
    super();
    this.opts = opts; // { appRoot, isPackaged, dataDir, getBuffer }
    this.proc = null;
    this.restarts = 0;
    this.stopping = false;
    this.lastGraph = null;
    this.lastSettings = null;
  }

  start() {
    const bin = findEngine(this.opts.appRoot, this.opts.isPackaged);
    if (!bin) {
      this.emit('event', { ev: 'audioError', error: 'DSP engine binary not found.' });
      return;
    }
    try { fs.chmodSync(bin, 0o755); } catch (_) {}
    const buffer = this.opts.getBuffer ? this.opts.getBuffer() : 64;
    const env = Object.assign({}, process.env, {
      // ask PipeWire for a small quantum for this client (lower = less latency)
      PIPEWIRE_LATENCY: `${buffer}/48000`,
      PIPEWIRE_PROPS: JSON.stringify({ 'node.name': 'tone-zone', 'node.description': 'Tone Zone', 'media.role': 'Production' }),
    });
    this.binPath = bin;
    this.proc = spawn(bin, ['--data', this.opts.dataDir], { env, stdio: ['pipe', 'pipe', 'pipe'] });
    const rl = readline.createInterface({ input: this.proc.stdout });
    rl.on('line', (line) => {
      if (!line) return;
      try {
        this.emit('event', JSON.parse(line));
      } catch (_) {}
    });
    this.proc.stderr.on('data', (d) => this.emit('log', d.toString()));
    this.proc.on('exit', (code, sig) => {
      this.proc = null;
      if (this.stopping) return;
      this.emit('event', { ev: 'engineExit', code, signal: sig });
      const delay = Math.min(5000, 400 * Math.pow(2, this.restarts++));
      setTimeout(() => this.start(), delay);
    });
    // re-apply state after (re)start
    setTimeout(() => {
      if (this.lastSettings) this.send(this.lastSettings);
      if (this.lastGraph) this.send(this.lastGraph);
      this.send({ cmd: 'hello' });
    }, 50);
    setTimeout(() => (this.restarts = 0), 15000);
  }

  send(cmd) {
    if (cmd.cmd === 'setGraph') this.lastGraph = cmd;
    if (cmd.cmd === 'settings') this.lastSettings = Object.assign({}, this.lastSettings || {}, cmd);
    if (!this.proc || !this.proc.stdin.writable) return;
    try {
      this.proc.stdin.write(JSON.stringify(cmd) + '\n');
    } catch (_) {}
  }

  restart() {
    if (this.proc) {
      this.stopping = true;
      const p = this.proc;
      p.once('exit', () => {
        this.stopping = false;
        this.start();
      });
      try { p.stdin.end(); } catch (_) {}
      setTimeout(() => { try { p.kill('SIGKILL'); } catch (_) {} }, 1500);
    } else this.start();
  }

  stop() {
    this.stopping = true;
    if (this.proc) {
      try { this.proc.stdin.write(JSON.stringify({ cmd: 'quit' }) + '\n'); } catch (_) {}
      const p = this.proc;
      setTimeout(() => { try { p.kill('SIGKILL'); } catch (_) {} }, 1000);
    }
  }
}

module.exports = { EngineHost, cpuSupportsV3, findEngine };
