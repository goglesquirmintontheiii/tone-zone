// Audio devices and the JACK server. On Pi OS Lite the agent runs jackd (JACK2, ALSA backend) itself; when the
// input is a different card from the output, zita-a2j brings it in with a resampler (two cards = two clocks).
// If PipeWire is already running (desktop Pi OS) the engine uses PipeWire's JACK layer instead.
'use strict';
const fs = require('fs');
const { spawn, spawnSync } = require('child_process');
const hw = require('./hw');
const log = require('./log');

// ---- ALSA cards: /proc/asound/cards + /proc/asound/pcm
function listDevices() {
  const cards = {};
  const txt = hw.read('/proc/asound/cards', '') || '';
  const lines = txt.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^\s*(\d+)\s+\[(\S+)\s*\]:\s*(\S+)\s+-\s+(.*)$/);
    if (m) cards[m[1]] = { index: +m[1], id: m[2], driver: m[3], name: m[4].trim(), long: (lines[i + 1] || '').trim() };
  }
  const inputs = [], outputs = [];
  for (const l of (hw.read('/proc/asound/pcm', '') || '').split('\n')) {
    const m = l.match(/^(\d+)-(\d+):\s*([^:]*):\s*([^:]*)(.*)$/);
    if (!m) continue;
    const c = cards[String(+m[1])];
    if (!c) continue;
    const dev = +m[2];
    const kind = /USB/i.test(c.driver) ? 'usb' : /headpho|bcm2835/i.test(c.driver + c.name) ? 'builtin' : /hdmi/i.test(c.driver + c.name) ? 'hdmi' : 'hat';
    const label = kind === 'builtin' ? 'Built-in 3.5 mm jack' : kind === 'hdmi' ? `HDMI audio (${c.id})` : c.long.split(' at ')[0] || c.name;
    const d = { id: `hw:CARD=${c.id},DEV=${dev}`, card: c.id, dev, name: label, kind, driver: c.driver };
    if (/playback/.test(m[5])) outputs.push(d);
    if (/capture/.test(m[5])) inputs.push(Object.assign({}, d));
  }
  return { inputs, outputs };
}

// ---- PipeWire: the sound cards are PipeWire's, so list its hardware ports (from the engine's ports listing),
// one device per client. Ids are "pw:<client name>".
function pwKind(n) {
  return /usb/i.test(n) ? 'usb' : /hdmi/i.test(n) ? 'hdmi' : /headphone|bcm2835/i.test(n) ? 'builtin' : 'hat';
}
function pwDevices(ports) {
  const group = (list) => {
    const m = new Map();
    for (const p of list || []) {
      if (!p.physical || (ports.self && p.name.startsWith(ports.self + ':'))) continue;
      const i = p.name.indexOf(':');
      const client = i > 0 ? p.name.slice(0, i) : p.name;
      if (!m.has(client)) m.set(client, { id: 'pw:' + client, name: client, kind: pwKind(client), driver: 'pipewire', ports: [] });
      m.get(client).ports.push(p.name);
    }
    for (const d of m.values()) d.ports.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    return [...m.values()];
  };
  // hardware capture ports are sources (we read from them), playback ports are sinks
  return { inputs: group(ports.sources), outputs: group(ports.sinks) };
}

// sensible defaults: one USB / HAT device for both directions when there is one, else USB in and the jack out
function pickDefaults(cfg, devs) {
  const pref = (list) => list.find((d) => d.kind === 'hat') || list.find((d) => d.kind === 'usb') || list.find((d) => d.kind === 'builtin') || list[0];
  const out = { input: cfg.input, output: cfg.output };
  if (!out.input || !devs.inputs.some((d) => d.id === out.input)) out.input = (pref(devs.inputs) || {}).id || '';
  if (!out.output || !devs.outputs.some((d) => d.id === out.output)) {
    const same = devs.outputs.find((d) => out.input && d.card === (devs.inputs.find((i) => i.id === out.input) || {}).card);
    out.output = (same || pref(devs.outputs) || {}).id || '';
  }
  return out;
}

const have = (cmd) => spawnSync('sh', ['-c', `command -v ${cmd}`], { encoding: 'utf8' }).status === 0;
function pipewireRunning() {
  if (hw.FAKE) return false;
  const r = spawnSync('sh', ['-c', 'pgrep -x pipewire'], { encoding: 'utf8' });
  return r.status === 0;
}
// the desktop user whose PipeWire is running: { uid, dir } (their runtime dir holds the socket)
function pipewireOwner() {
  const r = spawnSync('sh', ['-c', 'ps -o uid= -p "$(pgrep -o -x pipewire)"'], { encoding: 'utf8' });
  const uid = parseInt((r.stdout || '').trim(), 10);
  return Number.isFinite(uid) ? { uid, dir: `/run/user/${uid}` } : null;
}
// PipeWire's JACK library (the plain libjack.so.0 is JACK2's, which can't talk to PipeWire)
const PW_JACK = ['/usr/lib/aarch64-linux-gnu/pipewire-0.3/jack/libjack.so.0', '/usr/lib/arm-linux-gnueabihf/pipewire-0.3/jack/libjack.so.0', '/usr/lib/pipewire-0.3/jack/libjack.so.0'];
const pwJackLib = () => PW_JACK.find((f) => fs.existsSync(f)) || '';

class AudioServer {
  constructor() {
    this.procs = [];
    this.mode = null;
    this.bridge = null; // jack client name of the input bridge, if any
    this.stopping = false;
  }
  // returns { mode, jackLib, bridge }
  async start(cfg) {
    this.stop();
    this.stopping = false;
    const devs = listDevices();
    const sel = pickDefaults(cfg, devs);
    this.sel = sel;
    if (hw.FAKE && cfg.server === 'pipewire') {
      // tests: the fake JACK library stands in for PipeWire
      this.mode = 'pipewire';
      log.info('fake audio through the PipeWire path', 'engine');
      return { mode: 'pipewire', jackLib: process.env.TZ_JACK_LIB || '', sel };
    }
    if (hw.FAKE) {
      this.mode = 'fake';
      log.info(`fake audio: input ${sel.input || 'none'}, output ${sel.output || 'none'}, ${cfg.rate} Hz, ${cfg.buffer} frames`, 'engine');
      return { mode: 'fake', jackLib: process.env.TZ_JACK_LIB || '', sel };
    }
    const server = cfg.server === 'auto' ? (pipewireRunning() ? 'pipewire' : 'jackd') : cfg.server;
    if (server === 'pipewire') {
      const lib = pwJackLib();
      const owner = pipewireOwner();
      if (!lib) {
        log.error("PipeWire is running but its JACK library is missing, so the engine can't join it. Run the installer again or: sudo apt install pipewire-jack", 'engine');
        return { mode: 'none', jackLib: '', sel };
      }
      if (!owner) {
        log.error('PipeWire is running but its user could not be found', 'engine');
        return { mode: 'none', jackLib: '', sel };
      }
      this.mode = 'pipewire';
      log.info(`using PipeWire (the desktop's, user ${owner.uid}) through its JACK layer, ${cfg.buffer} frames at ${cfg.rate} Hz`, 'engine');
      // PIPEWIRE_LATENCY asks PipeWire for our buffer size instead of its large desktop default
      return { mode: 'pipewire', jackLib: lib, sel, uid: owner.uid, env: { PIPEWIRE_RUNTIME_DIR: owner.dir, PIPEWIRE_LATENCY: `${cfg.buffer || 128}/${cfg.rate || 48000}` } };
    }
    if (!have('jackd')) {
      log.error('jackd is not installed (sudo apt install jackd2)', 'engine');
      return { mode: 'none', jackLib: '', sel };
    }
    if (!sel.output) {
      log.error('no audio output found: plug in a USB audio adapter or a HAT', 'engine');
      return { mode: 'none', jackLib: '', sel };
    }
    const outCard = (devs.outputs.find((d) => d.id === sel.output) || {}).card;
    const inDev = devs.inputs.find((d) => d.id === sel.input);
    const same = inDev && inDev.card === outCard;
    const usb = (devs.outputs.find((d) => d.id === sel.output) || {}).kind === 'usb';
    const periods = String(cfg.periods || (usb ? 3 : 2));
    const args = ['-R', '-P', '80', '-t', '2000', '-d', 'alsa', '-r', String(cfg.rate || 48000), '-p', String(cfg.buffer || 128), '-n', periods];
    if (same) args.push('-d', sel.output.replace(/^hw:CARD=([^,]+),DEV=(\d+)$/, 'hw:$1,$2'));
    else args.push('-P', sel.output.replace(/^hw:CARD=([^,]+),DEV=(\d+)$/, 'hw:$1,$2'));
    this.spawn('jackd', args);
    await waitJack(4000);
    if (inDev && !same) {
      if (have('zita-a2j')) {
        this.bridge = 'tz-in';
        this.spawn('zita-a2j', ['-j', 'tz-in', '-d', inDev.id.replace(/^hw:CARD=([^,]+),DEV=(\d+)$/, 'hw:$1,$2'), '-r', String(cfg.rate || 48000), '-p', String(cfg.buffer || 128), '-n', '3', '-c', '1']);
        log.info(`input ${inDev.name} through zita-a2j (separate clock, resampled, about 2 ms extra)`, 'engine');
      } else log.warn('input and output are different cards and zita-a2j is missing: no input (sudo apt install zita-ajbridge)', 'engine');
    }
    this.mode = 'jackd';
    log.info(`JACK: ${sel.output}${same ? ' (in + out)' : ''}, ${cfg.rate} Hz, ${cfg.buffer} frames x ${periods}`, 'engine');
    return { mode: 'jackd', jackLib: 'libjack.so.0', bridge: this.bridge, sel };
  }
  spawn(cmd, args) {
    // headless: no D-Bus session, so skip JACK's device reservation
    const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], env: Object.assign({}, process.env, { JACK_NO_AUDIO_RESERVATION: '1' }) });
    const tag = cmd;
    const out = (b) => String(b).split('\n').filter((l) => l.trim() && !/^(jackdmp|Copyright|This is free|JACK server starting|creating alsa driver|configuring for)/.test(l)).forEach((l) => log.info(`${tag}: ${l.trim()}`, 'engine'));
    p.stdout.on('data', out);
    p.stderr.on('data', out);
    p.on('exit', (code) => {
      this.procs = this.procs.filter((x) => x !== p);
      if (!this.stopping) log.warn(`${tag} exited (${code})`, 'engine');
    });
    this.procs.push(p);
    return p;
  }
  stop() {
    this.stopping = true;
    for (const p of this.procs) try { p.kill('SIGTERM'); } catch {}
    this.procs = [];
    this.bridge = null;
  }
}

function waitJack(ms) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const tick = () => {
      const r = spawnSync('sh', ['-c', 'command -v jack_wait >/dev/null && jack_wait -c'], { encoding: 'utf8' });
      if ((r.stdout || '').includes('running') || Date.now() - t0 > ms) return resolve();
      setTimeout(tick, 200);
    };
    setTimeout(tick, 300);
  });
}

module.exports = { listDevices, pwDevices, pickDefaults, AudioServer };
