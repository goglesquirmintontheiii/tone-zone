#!/usr/bin/env node
// tz-agent: the Tone Zone Raspberry Pi service. Runs the audio engine, holds the presets, reads footswitches,
// drives LEDs, serves the screen UI and the API the desktop app uses (HTTP + WebSocket, port 7650), and
// installs updates. It is never in the audio path: the engine keeps playing if the agent is busy.
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn, spawnSync } = require('child_process');

const hw = require('./lib/hw');
hw.setupFake();
const log = require('./lib/log');
const store = require('./lib/store');
const audio = require('./lib/audio');
const stats = require('./lib/stats');
const pair = require('./lib/pair');
const update = require('./lib/update');
const mdns = require('./lib/mdns');
const { Engine, selfTest, findEngine } = require('./lib/engine');
const { Gpio, bcmOf, hwPwmChannel } = require('./lib/gpio');
const { Router, createServer, send } = require('./lib/http');

const PORT = Number(process.env.TZ_PORT || 7650);
const START = Date.now();
const VERSION = update.version();
const board = hw.boardInfo();
const S = store.load();
const isPi3 = board.model === 'pi3b' || board.model === 'pi3bp';
if (!S.budget) S.budget = isPi3 ? 65 : 70;
if (!S.name) S.name = hw.FAKE ? 'Fake Pi' : os.hostname() === 'raspberrypi' ? 'Tone Zone Pi' : os.hostname();
store.save();
log.info(`tz-agent ${VERSION} on ${board.raw} (${board.os}, ${board.ram} GB)${hw.FAKE ? ' [fake hardware]' : ''}`);

// ------------------------------------------------------------------ engine + audio
const engine = new Engine();
const server = new audio.AudioServer();
let audioInfo = { mode: 'none' };
let tunerOn = false, muted = false;
const TUNER = '__tz_tuner';

// the stored graph plus a hidden tuner fed from input 1 (bypassed unless the tuner is on)
function engineGraph(p) {
  const g = store.resolveGraph(p.graph);
  g.nodes = (g.nodes || []).filter((n) => n.id !== TUNER).concat([{ id: TUNER, algo: 'tuner', nIn: 1, nOut: 1, opts: { mute: 0 }, params: {}, bypass: !tunerOn }]);
  g.cables = (g.cables || []).concat([{ from: { node: '__in', port: 0 }, to: { node: TUNER, port: 0 } }]);
  return g;
}
const EMPTY = { id: '__empty', name: 'Empty', rev: 0, graph: { nodes: [], cables: [{ from: { node: '__in', port: 0 }, to: { node: '__out', port: 0 } }, { from: { node: '__in', port: 0 }, to: { node: '__out', port: 1 } }] }, blocks: [] };
const keyOf = (p) => `${p.id}:${p.rev || 0}`;

async function startAudio() {
  const cfg = S.config.audio;
  audioInfo = await server.start(cfg);
  broadcast({ t: 'config', config: configOut() });
  const env = Object.assign({}, audioInfo.env || {});
  if (audioInfo.jackLib) env.TZ_JACK_LIB = audioInfo.jackLib;
  // the desktop's PipeWire lives in that user's private runtime dir: let the tonezone user in
  if (audioInfo.uid != null) root('pw-access', String(audioInfo.uid));
  engine.settings = { buffer: cfg.buffer, budget: S.budget / 100, autoQuality: true, quality: isPi3 ? 0 : 1 };
  if (engine.proc) engine.restart(env);
  else engine.start(env);
}
// the engine's latest ports listing; under PipeWire it is also the device list
let lastPorts = null;
let route = ''; // what the engine was last connected to (input|channel|output)
const pwMode = () => audioInfo.mode === 'pipewire';
const byNum = (a, b) => a.localeCompare(b, undefined, { numeric: true });
function devicesNow() {
  return pwMode() && lastPorts ? audio.pwDevices(lastPorts) : audio.listDevices();
}
// the hardware the engine should use, from a ports listing: { inDev, outDev } with sorted port names
function routeTargets(ev) {
  if (pwMode()) {
    const devs = audio.pwDevices(ev);
    const sel = audio.pickDefaults(S.config.audio, devs);
    server.sel = sel;
    return { inDev: devs.inputs.find((d) => d.id === sel.input), outDev: devs.outputs.find((d) => d.id === sel.output) };
  }
  // jackd: the card it runs on is "system"; a second input card comes in through the zita bridge
  const names = (list, test) => (list || []).map((p) => p.name).filter(test).sort(byNum);
  const sys = (n) => n.startsWith('system:');
  const inPorts = server.bridge ? names(ev.sources, (n) => n.startsWith(server.bridge + ':')) : names(ev.sources, sys);
  const outPorts = names(ev.sinks, sys);
  const sel = server.sel || {};
  return {
    inDev: inPorts.length ? { id: sel.input || 'system', name: server.bridge ? 'input bridge' : 'JACK input', ports: inPorts } : null,
    outDev: outPorts.length ? { id: sel.output || 'system', name: 'JACK output', ports: outPorts } : null,
  };
}
// connect engine input 1 to the chosen input channel and out L / R to the output's first two ports
function connectEngine(ev) {
  if (!['pipewire', 'jackd', 'fake'].includes(audioInfo.mode)) return;
  const { inDev, outDev } = routeTargets(ev);
  const me = ev.self + ':';
  const mineIn = (ev.sinks || []).filter((p) => p.name.startsWith(me) && /:in_\d/.test(p.name)).sort((a, b) => byNum(a.name, b.name));
  const mineOut = (ev.sources || []).filter((p) => p.name.startsWith(me) && /:out_/.test(p.name)).sort((a, b) => byNum(a.name, b.name));
  const ch = Math.max(1, Math.round(+S.config.audio.inChannel || 1));
  const src = inDev && inDev.ports[Math.min(ch, inDev.ports.length) - 1];
  const r = `${inDev ? inDev.id : '-'}|${src || '-'}|${outDev ? outDev.id : '-'}`;
  const send = (a, b, on) => engine.send({ cmd: 'connect', src: a, dst: b, on });
  const hw = (n) => !n.startsWith(me);
  if (r !== route) {
    // something changed: drop links from our main ports to other hardware
    for (const p of mineIn) for (const c of p.connections || []) if (hw(c) && c !== src) send(c, p.name, false);
    for (const p of mineOut) for (const c of p.connections || []) if (hw(c) && !(outDev && outDev.ports.includes(c))) send(p.name, c, false);
    route = r;
    log.info(`audio: input ${src || 'none'}, output ${outDev ? outDev.ports.slice(0, 2).join(' + ') : 'none'}`, 'engine');
    // the Audio page shows the ports in use, so a silent input can be found by switching channels
    if (audioInfo.status) {
      audioInfo.status.route = `In: ${src || 'nothing (no input ports)'}${inDev ? ` (channel ${Math.min(ch, inDev.ports.length)} of ${inDev.ports.length})` : ''}. Out: ${outDev ? outDev.ports.slice(0, 2).join(' + ') : 'nothing'}.`;
      setTimeout(() => broadcast({ t: 'config', config: configOut() }), 0);
    }
    if (!src) log.warn('no input port to connect: check the input device on the Audio page', 'engine');
    if (!outDev) log.warn('no output port to connect: check the output device on the Audio page', 'engine');
  }
  if (src && mineIn[0] && !(mineIn[0].connections || []).includes(src)) send(src, mineIn[0].name, true);
  if (outDev) {
    // out L / R to the first two playback ports (a mono device gets both)
    mineOut.slice(0, 2).forEach((p, i) => {
      const dst = outDev.ports[Math.min(i, outDev.ports.length - 1)];
      if (dst && !(p.connections || []).includes(dst)) send(p.name, dst, true);
    });
  }
}
engine.on('event', (ev) => {
  // the Audio page shows whether the engine really got audio
  if (ev.ev === 'audioError') { audioInfo.status = { ok: false, error: 'The engine could not join the audio server: ' + ev.error }; broadcast({ t: 'config', config: configOut() }); }
  if (ev.ev === 'ready' && ev.running && audioInfo.status && !audioInfo.status.ok && audioInfo.mode !== 'none') { audioInfo.status = { ok: true, text: audioInfo.mode }; broadcast({ t: 'config', config: configOut() }); }
  if (ev.ev === 'ready') { route = ''; setTimeout(() => engine.send({ cmd: 'ports' }), 300); }
  if (ev.ev === 'ports' && ev.self) {
    const had = lastPorts && JSON.stringify(audio.pwDevices(lastPorts)) === JSON.stringify(audio.pwDevices(ev));
    lastPorts = ev;
    connectEngine(ev);
    if (pwMode() && !had) broadcast({ t: 'config', config: configOut() }); // devices came or went: show them
  }
});
engine.on('applied', ({ key, ms, cached }) => {
  const p = currentPreset();
  log.info(`preset "${p.name}" (${bankName(S.bank)} ${'ABCD'[S.slot]}) ${cached ? 'switched in ' + ms + ' ms (preloaded)' : 'loaded in ' + ms + ' ms'}`, 'engine');
  schedulePreload();
});
engine.on('cacheCleared', () => schedulePreload());
engine.on('exit', () => setTimeout(schedulePreload, 2000));

// ------------------------------------------------------------------ presets and switching
const bankName = (b) => (S.banks[b] && S.banks[b].name) || `Bank ${b + 1}`;
function presetAt(bank, slot) {
  const ref = S.banks[bank] && S.banks[bank].presets[slot];
  return ref ? store.getPreset(ref.id) : null;
}
let livePreset = null; // the preset object currently playing (params edited live)
function currentPreset() { return livePreset || EMPTY; }

function loadSlot(bank, slot, why = '') {
  const p = presetAt(bank, slot);
  if (!p) return false;
  S.bank = bank;
  S.slot = slot;
  S.pendingBank = null;
  store.save();
  livePreset = p;
  if (testTone) { clearTimeout(testTone.timer); testTone = null; } // switching presets ends a test tone
  engine.use(keyOf(p), engineGraph(p));
  applyMuteAndTuner();
  broadcastState();
  return true;
}
function loadInitial() {
  if (!loadSlot(S.bank, S.slot)) {
    const first = store.order()[0];
    if (!first || !loadSlot(first.bank, first.slot)) { livePreset = null; engine.use('__empty', engineGraph(EMPTY)); }
  }
}
function step(dir) {
  const ord = store.order();
  if (!ord.length) return;
  let i = ord.findIndex((x) => x.bank === S.bank && x.slot === S.slot);
  i = i < 0 ? 0 : (i + dir + ord.length) % ord.length;
  loadSlot(ord[i].bank, ord[i].slot);
}
function bank(dir) {
  const n = S.banks.length;
  const from = S.pendingBank != null ? S.pendingBank : S.bank;
  const to = (from + dir + n) % n;
  if (S.config.gpio.bankWaits) {
    // like a floor unit: the bank shows, the preset changes when you pick A to D
    S.pendingBank = to === S.bank ? null : to;
    log.info(`bank ${bankName(to)} (press A to D to load)`, 'gpio');
    broadcastState();
  } else if (!loadSlot(to, S.slot)) {
    const k = S.banks[to].presets.findIndex(Boolean);
    if (k >= 0) loadSlot(to, k);
    else { S.pendingBank = to; broadcastState(); }
  }
}
function slotPress(k) {
  const b = S.pendingBank != null ? S.pendingBank : S.bank;
  if (b === S.bank && k === S.slot && S.pendingBank == null) return;
  if (!loadSlot(b, k)) log.warn(`${bankName(b)} ${'ABCD'[k]} is empty`, 'gpio');
}

// keep the neighbours built so a switch is a pointer swap in the engine
let preloadTimer = null;
function schedulePreload() {
  clearTimeout(preloadTimer);
  preloadTimer = setTimeout(() => {
    if (!S.config.switching.preload) return engine.preload([]);
    const ord = store.order();
    const i = ord.findIndex((x) => x.bank === S.bank && x.slot === S.slot);
    const want = [];
    const add = (x) => { if (!x) return; const p = store.getPreset(x.id); if (p && !want.some((w) => w.id === p.id) && (!livePreset || p.id !== livePreset.id)) want.push(p); };
    if (i >= 0) { add(ord[(i + 1) % ord.length]); add(ord[(i - 1 + ord.length) % ord.length]); }
    S.banks[S.bank] && S.banks[S.bank].presets.forEach((r, k) => r && add({ id: r.id }));
    // 1 GB boards: next, previous and one more
    const max = board.ram <= 1 ? 3 : 6;
    engine.preload(want.slice(0, max).map((p) => ({ key: keyOf(p), graph: engineGraph(p) })));
  }, 250);
}

function blockOf(p, name) {
  if (!p || !name) return null;
  const n = String(name).toLowerCase();
  return (p.blocks || []).find((b) => b.id === name) || (p.blocks || []).find((b) => String(b.name || '').toLowerCase() === n);
}
function setBypass(id, on) {
  const p = livePreset;
  if (!p) throw new Error('No preset loaded');
  const b = (p.blocks || []).find((x) => x.id === id);
  const node = p.graph.nodes.find((n) => n.id === id);
  if (!b && !node) throw new Error('No such block');
  if (b) b.bypass = !!on;
  if (node) node.bypass = !!on;
  engine.send({ cmd: 'bypass', id, on: !!on });
  saveLiveSoon();
  broadcast({ t: 'block', id, bypass: !!on });
}
function setParam(id, name, value) {
  const p = livePreset;
  if (!p) throw new Error('No preset loaded');
  const v = Number(value);
  if (!Number.isFinite(v)) throw new Error('Bad value');
  const node = p.graph.nodes.find((n) => n.id === id);
  if (!node) throw new Error('No such block');
  node.params = node.params || {};
  node.params[name] = v;
  const b = (p.blocks || []).find((x) => x.id === id);
  const par = b && (b.params || []).find((x) => x.p === name);
  if (par) par.value = v;
  engine.send({ cmd: 'param', id, name, value: v });
  // halves of a split block (effects loop) follow by the engine's "also"
  saveLiveSoon();
  broadcast({ t: 'param', id, name, value: v });
}
let saveTimer = null;
function saveLiveSoon() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const p = livePreset;
    if (p) store.updatePreset(p.id, (x) => { x.graph = p.graph; x.blocks = p.blocks; });
  }, 800);
}

// tap tempo
let taps = [], bpm = 0;
function tap() {
  const now = Date.now();
  taps = taps.filter((t) => now - t < 2500).concat([now]);
  if (taps.length >= 2) {
    const d = (taps[taps.length - 1] - taps[0]) / (taps.length - 1);
    bpm = Math.round(60000 / d);
  }
  for (const b of (livePreset && livePreset.blocks) || []) if (b.tap) engine.send({ cmd: 'event', id: b.id, type: 1, value: 0, arg: 0 });
  broadcast({ t: 'tap', bpm });
}
function applyMuteAndTuner() {
  engine.send({ cmd: 'bypass', id: TUNER, on: !tunerOn });
  for (const i of [0, 1]) engine.send({ cmd: 'io', dir: 'out', index: i, gainDb: 0, mute: muted || tunerOn });
}
// ---- test tone: replaces the preset while it plays so you can check the outputs (stops by itself after 30 s)
const TONES = ['440 Hz sine', '1 kHz sine', 'pink noise', 'sweep 40 Hz to 12 kHz'];
let testTone = null; // { tone, level, side, timer }
function testToneGraph(t) {
  return {
    nodes: [{ id: '__tt', algo: 'testtone', nIn: 0, nOut: 2, opts: {}, params: { tone: t.tone, level: t.level, side: t.side }, bypass: false }],
    cables: [{ from: { node: '__tt', port: 0 }, to: { node: '__out', port: 0 } }, { from: { node: '__tt', port: 1 }, to: { node: '__out', port: 1 } }],
  };
}
function setTestTone(o = {}) {
  if (!o.on) {
    if (!testTone) return { on: false };
    clearTimeout(testTone.timer);
    testTone = null;
    if (livePreset) engine.use(keyOf(livePreset), engineGraph(livePreset));
    else engine.use('__empty', engineGraph(EMPTY));
    applyMuteAndTuner();
    log.info('test tone off, preset back', 'engine');
    broadcastState();
    return { on: false };
  }
  const t = {
    tone: Math.max(0, Math.min(3, Math.round(+o.tone || 0))),
    level: Math.max(-60, Math.min(-6, Number.isFinite(+o.level) ? +o.level : -20)), // never louder than -6 dBFS
    side: Math.max(0, Math.min(2, Math.round(+o.side || 0))),
  };
  if (testTone) {
    clearTimeout(testTone.timer);
    engine.send({ cmd: 'params', id: '__tt', values: { tone: t.tone, level: t.level, side: t.side } });
  } else engine.use('__testtone', testToneGraph(t));
  // the tone plays even when the output is muted or the tuner is on
  for (const i of [0, 1]) engine.send({ cmd: 'io', dir: 'out', index: i, gainDb: 0, mute: false });
  t.timer = setTimeout(() => setTestTone({ on: false }), 30000);
  testTone = t;
  log.info(`test tone: ${TONES[t.tone]}, ${t.level} dBFS, ${['both sides', 'left only', 'right only'][t.side]}`, 'engine');
  broadcastState();
  return { on: true, tone: t.tone, level: t.level, side: t.side };
}
function setTuner(on) { tunerOn = !!on; applyMuteAndTuner(); broadcastState(); }
function setMute(on) { muted = !!on; applyMuteAndTuner(); broadcastState(); }

function doAction({ action, block }) {
  switch (action) {
    case 'preset+': return step(1);
    case 'preset-': return step(-1);
    case 'bank+': return bank(1);
    case 'bank-': return bank(-1);
    case 'slotA': return slotPress(0);
    case 'slotB': return slotPress(1);
    case 'slotC': return slotPress(2);
    case 'slotD': return slotPress(3);
    case 'tap': return tap();
    case 'tuner': return setTuner(!tunerOn);
    case 'mute': return setMute(!muted);
    case 'block': {
      const b = blockOf(livePreset, block);
      if (!b) return log.warn(`no block "${block}" in this preset`, 'gpio');
      return setBypass(b.id, !b.bypass);
    }
    case 'loop': {
      const b = ((livePreset && livePreset.blocks) || []).find((x) => x.looper);
      if (!b) return log.warn('no looper in this preset', 'gpio');
      return engine.send({ cmd: 'event', id: b.id, type: b.looper.event || 1, value: 1, arg: 0 });
    }
  }
}

// ------------------------------------------------------------------ GPIO and LEDs
let gpio = null;
function startGpio() {
  const helper = path.join(hw.SLOT, 'bin', process.arch === 'arm' ? 'tz-gpio-armhf' : 'tz-gpio');
  const outKind = (devicesNow().outputs.find((d) => d.id === (server.sel || {}).output) || {}).kind;
  // the 3.5 mm jack is driven by the PWM block on Pi 3 / 4: hardware PWM LEDs would break it
  const blocked = outKind === 'builtin' && board.model !== 'pi5' ? [12, 13, 18, 19] : [];
  if (!hw.FAKE && !fs.existsSync(helper)) { log.warn('GPIO helper missing, footswitches off', 'gpio'); return; }
  gpio = new Gpio({ model: board.model, helper, blockedPins: blocked });
  gpio.on('action', doAction);
  gpio.configure(S.config.gpio).catch((e) => log.error('GPIO: ' + e.message, 'gpio'));
}
let identifyUntil = 0;
const blinkUntil = {};
function ledTick() {
  if (!gpio) return;
  const t = Date.now();
  const st = engine.status || {};
  for (const [pin, c] of Object.entries(S.config.gpio.pins || {})) {
    if (!c || c.type !== 'led') continue;
    const bcm = bcmOf(+pin);
    if (bcm === undefined) continue;
    const bright = c.bright ?? 80, dim = c.drive === 'pwm' ? c.dim ?? 0 : 0;
    let on = false;
    const slotShown = (k) => {
      if (S.pendingBank != null) return S.banks[S.pendingBank] && S.banks[S.pendingBank].presets[k] ? t % 600 < 300 : false; // picking a bank: blink
      return S.slot === k && !!livePreset;
    };
    switch (c.show) {
      case 'slotA': on = slotShown(0); break;
      case 'slotB': on = slotShown(1); break;
      case 'slotC': on = slotShown(2); break;
      case 'slotD': on = slotShown(3); break;
      case 'block': { const b = blockOf(livePreset, c.block); on = !!b && !b.bypass; break; }
      case 'tap': on = bpm > 0 && t % Math.round(60000 / bpm) < 80; break;
      case 'tuner': on = tunerOn; break;
      case 'circuit': {
        const bo = blockOf(livePreset, c.block);
        const bs = st.blocks && st.blocks[bo ? bo.id : c.block];
        const v = bs && Array.isArray(bs.cv) ? Number(bs.cv[c.out | 0]) || 0 : 0;
        if (c.drive === 'pwm') { gpio.setLed(bcm, dim + (bright - dim) * Math.max(0, Math.min(1, v))); continue; }
        on = v > 0.5;
        break;
      }
      case 'status': {
        const load = (st.load || 0) * 100;
        if (t < identifyUntil) on = t % 200 < 100;
        else if (!engine.ready) on = t % 2000 < 1000; // slow: no audio
        else if (load > S.budget) on = t % 250 < 125; // fast: over budget
        else if (!pair.paired()) on = t % 1500 < 120 || (t % 1500 > 300 && t % 1500 < 420); // double: waiting to pair
        else on = true;
        break;
      }
    }
    if (blinkUntil[pin] && t < blinkUntil[pin]) on = t % 300 < 150;
    gpio.setLed(bcm, on ? bright : dim);
  }
}
setInterval(ledTick, 40).unref();

// ------------------------------------------------------------------ stats
let lastStats = null;
function collectStats() {
  const st = engine.status || {};
  const tz = (st.blocks && st.blocks[TUNER] && st.blocks[TUNER].tuner) || null;
  lastStats = {
    dsp: Math.round((st.load || 0) * 1000) / 10,
    peak: Math.round((st.peakLoad || 0) * 1000) / 10,
    cpu: Math.round(stats.cpuPercent() * 10) / 10,
    temp: Math.round(stats.tempC() * 10) / 10,
    mem: stats.memory(),
    xruns: st.xruns || 0,
    uptime: Math.round((Date.now() - START) / 1000),
    latency: Math.round((st.latencyMs || 0) * 10) / 10,
    sr: st.sr || 0,
    buffer: st.buffer || 0,
    running: !!st.running,
    inPeak: (st.inPeak || [])[0] || 0,
    outPeak: Math.max((st.outPeak || [])[0] || 0, (st.outPeak || [])[1] || 0),
    throttle: stats.throttle(),
    governor: stats.governor(),
    tuner: tunerOn ? tz : null,
  };
  return lastStats;
}
setInterval(() => broadcast({ t: 'stats', stats: collectStats() }), 1000).unref();
// fast meters / tuner for screens that ask for them
setInterval(() => {
  if (![...clients].some((c) => c.meters)) return;
  const st = engine.status || {};
  const msg = { t: 'meter', in: (st.inPeak || [])[0] || 0, out: Math.max((st.outPeak || [])[0] || 0, (st.outPeak || [])[1] || 0), dsp: st.load || 0 };
  if (tunerOn) msg.tuner = (st.blocks && st.blocks[TUNER] && st.blocks[TUNER].tuner) || null;
  for (const c of clients) if (c.meters) c.ws.send(msg);
}, 100).unref();

// ------------------------------------------------------------------ measured DSP for a preset (offline, 2 s)
function benchPreset(p) {
  return new Promise((resolve) => {
    const bin = findEngine();
    if (!bin) return resolve(null);
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tz-bench-'));
    const sr = 48000, n = sr * 2;
    const buf = Buffer.alloc(44 + n * 4);
    buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 4, 4); buf.write('WAVE', 8); buf.write('fmt ', 12);
    buf.writeUInt32LE(16, 16); buf.writeUInt16LE(3, 20); buf.writeUInt16LE(1, 22); buf.writeUInt32LE(sr, 24);
    buf.writeUInt32LE(sr * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(32, 34); buf.write('data', 36); buf.writeUInt32LE(n * 4, 40);
    for (let i = 0; i < n; i++) buf.writeFloatLE(0.25 * Math.sin((2 * Math.PI * 110 * i) / sr) * Math.exp(-(i % sr) / 20000), 44 + i * 4);
    fs.writeFileSync(path.join(tmp, 'in.wav'), buf);
    fs.writeFileSync(path.join(tmp, 'g.json'), JSON.stringify({ settings: { quality: isPi3 ? 0 : 1 }, graph: store.resolveGraph(p.graph) }));
    const proc = spawn(bin, ['--offline', path.join(tmp, 'g.json'), path.join(tmp, 'in.wav'), path.join(tmp, 'out.wav'), '--block', String(S.config.audio.buffer || 128), '--data', hw.DATA], { stdio: ['ignore', 'ignore', 'pipe'] });
    try { os.setPriority(proc.pid, 15); } catch {}
    let err = '';
    proc.stderr.on('data', (d) => (err += d));
    const done = (v) => { fs.rmSync(tmp, { recursive: true, force: true }); resolve(v); };
    const timer = setTimeout(() => { try { proc.kill(); } catch {} }, 60000);
    proc.on('close', (code) => {
      clearTimeout(timer);
      const m = err.match(/load = ([\d.]+)/);
      done(code === 0 && m ? Math.round(Number(m[1]) * 10) / 10 : null);
    });
  });
}

// ------------------------------------------------------------------ device config
function audioConfigOut() {
  const devs = devicesNow();
  // how many channels the active input has (from the live ports), for the input channel picker
  let inChannels = 0;
  try { if (lastPorts) { const t = routeTargets(lastPorts); inChannels = t.inDev ? t.inDev.ports.length : 0; } } catch (_) { /* no ports yet */ }
  return Object.assign({}, S.config.audio, { devices: devs, active: server.sel || null, mode: audioInfo.mode, inChannels, status: audioInfo.status || null });
}
function configOut() {
  return { gpio: S.config.gpio, display: S.config.display, audio: audioConfigOut(), updates: S.config.updates, switching: S.config.switching };
}
async function setConfig(part, value) {
  if (!['gpio', 'display', 'audio', 'updates', 'switching'].includes(part)) throw new Error('Unknown config part');
  if (!value || typeof value !== 'object') throw new Error('Bad config');
  const old = S.config[part];
  const v = Object.assign({}, old, value);
  delete v.devices; delete v.active; delete v.mode; delete v.inChannels; delete v.status;
  S.config[part] = v;
  store.save();
  if (part === 'gpio' && gpio) await gpio.configure(v);
  if (part === 'audio' && ['input', 'output', 'rate', 'buffer', 'periods', 'server'].some((k) => old[k] !== v[k])) {
    log.info('audio settings changed, restarting audio', 'engine');
    await startAudio();
    if (gpio) { gpio.close(); startGpio(); }
  }
  if (part === 'audio' && v.governor && !old.governor) root('governor', 'performance');
  // a different input channel only needs new links, not an audio restart
  if (part === 'audio' && old.inChannel !== v.inChannel && engine.proc) engine.send({ cmd: 'ports' });
  if (part === 'display') applyDisplay(old);
  if (part === 'switching') schedulePreload();
  broadcast({ t: 'config', config: configOut() });
  return configOut()[part];
}
// a few things need root: a fixed list of commands through sudo (installed by install.sh)
function root(...args) {
  if (hw.FAKE) { log.info(`(fake) root: ${args.join(' ')}`); return true; }
  const r = spawnSync('sudo', ['-n', '/usr/local/sbin/tonezone-root', ...args.map(String)], { encoding: 'utf8', timeout: 20000 });
  if (r.status !== 0) log.warn(`tonezone-root ${args[0]} failed: ${(r.stderr || '').trim()}`);
  return r.status === 0;
}
function applyDisplay(old = {}) {
  const d = S.config.display;
  const want = d.screen && d.screen !== 'none' && d.screen !== 'oled';
  if (!old || want !== (old.screen && old.screen !== 'none' && old.screen !== 'oled') || d.rotation !== old.rotation) root('kiosk', want ? 'on' : 'off', String(d.rotation || 0));
  if (old && d.brightness !== old.brightness) root('backlight', String(d.brightness));
}

// ------------------------------------------------------------------ device + state for the API
function deviceInfo() {
  const ip = Object.values(os.networkInterfaces()).flat().filter((a) => a && a.family === 'IPv4' && !a.internal);
  const link = (() => {
    const names = Object.keys(os.networkInterfaces());
    const has = (re) => ip.some((a) => Object.entries(os.networkInterfaces()).some(([n, l]) => re.test(n) && l.includes(a)));
    if (ip.some((a) => a.address.startsWith('169.254.'))) return 'direct';
    if (has(/^eth|^en/)) return 'ethernet';
    if (has(/^wlan|^wl/)) return 'wifi';
    return names.length ? 'ethernet' : 'manual';
  })();
  const up = update.status();
  return {
    id: S.id, name: S.name, model: board.model, board: board.raw, ram: board.ram, os: board.os, arch: board.arch,
    host: (hw.FAKE ? 'tonezone-fake' : os.hostname()) + '.local', ip: (ip[0] || {}).address || '127.0.0.1', ips: ip.map((a) => a.address), link,
    version: VERSION, prevVersion: up.previous, slot: up.slot, failedUpdate: up.failed, fake: hw.FAKE, api: 1, budget: S.budget,
  };
}
function stateOut() {
  const cur = livePreset;
  return {
    device: deviceInfo(),
    banks: S.banks,
    bank: S.bank, slot: S.slot, pendingBank: S.pendingBank,
    preset: cur ? { id: cur.id, name: cur.name, rev: cur.rev, blocks: cur.blocks || [], dsp: cur.dsp } : null,
    tuner: tunerOn, muted, bpm, testTone: testTone ? { tone: testTone.tone, level: testTone.level, side: testTone.side } : null,
    stats: lastStats || collectStats(),
    config: configOut(),
  };
}

// ------------------------------------------------------------------ HTTP API
const R = new Router();
const pub = { public: true };
R.add('GET', '/api/info', (c) => Object.assign(deviceInfo(), { paired: pair.paired(), authorized: pair.check(c.req, c) }), pub);
R.add('POST', '/api/pair', (c) => ({ token: pair.pair(String(c.body.code || '').trim(), c.body.client), device: deviceInfo() }), pub);
R.add('GET', '/api/pair/code', (c) => { if (!c.loopback) throw Object.assign(new Error('Only on the Pi itself'), { status: 403 }); return { code: pair.current() }; }, pub);
R.add('POST', '/api/unpair', () => { pair.unpairAll(); return {}; });
R.add('GET', '/api/state', () => stateOut());
R.add('GET', '/api/stats', () => lastStats || collectStats());
R.add('POST', '/api/rename', (c) => { S.name = String(c.body.name || '').trim().slice(0, 40) || S.name; store.save(); broadcastState(); return deviceInfo(); });
R.add('POST', '/api/budget', (c) => {
  S.budget = Math.max(40, Math.min(95, Number(c.body.budget) || 70));
  store.save();
  engine.setSettings({ budget: S.budget / 100 });
  return { budget: S.budget };
});
// presets
R.add('GET', '/api/presets', () => store.listPresets());
R.add('GET', '/api/presets/:id', (c) => store.getPreset(c.params.id) || Promise.reject(Object.assign(new Error('No such preset'), { status: 404 })));
R.add('POST', '/api/files/check', (c) => ({ missing: (c.body.files || []).filter((h) => !store.hasFile(h)) }));
R.add('PUT', '/api/files/:name', (c) => ({ name: store.putFile(c.params.name, c.body) }), { raw: true, limit: 256 << 20 });
R.add('POST', '/api/presets', async (c) => {
  const rec = store.putPreset(c.body.preset);
  const where = store.placePreset(rec, c.body.bank, c.body.slot) || {};
  const dsp = c.body.bench === false ? null : await benchPreset(rec);
  if (dsp != null) store.updatePreset(rec.id, (x) => { x.dsp = dsp; });
  for (const b of S.banks) for (const r of b.presets) if (r && r.id === rec.id) r.dsp = dsp;
  store.save();
  log.info(`preset "${rec.name}" received${dsp != null ? `, measured DSP ${dsp}%` : ''}`);
  // replaced the one that is playing: load the new version
  if (livePreset && livePreset.id === rec.id) loadSlot(S.bank, S.slot);
  else if (!livePreset) loadInitial();
  schedulePreload();
  broadcastState();
  return { id: rec.id, rev: rec.rev, dsp, bank: where.bank, slot: where.slot };
});
R.add('DELETE', '/api/presets/:id', (c) => {
  store.deletePreset(c.params.id);
  if (livePreset && livePreset.id === c.params.id) { livePreset = null; loadInitial(); }
  schedulePreload();
  broadcastState();
  return {};
});
R.add('GET', '/api/banks', () => S.banks);
R.add('PUT', '/api/banks', (c) => {
  store.setBanks(Array.isArray(c.body) ? c.body : c.body.banks);
  const cur = presetAt(S.bank, S.slot);
  if (!cur || !livePreset || cur.id !== livePreset.id) loadInitial();
  schedulePreload();
  broadcastState();
  return S.banks;
});
R.add('POST', '/api/select', (c) => {
  const b = c.body;
  if (b.action) doAction(b);
  else if (b.id) {
    const x = store.order().find((o) => o.id === b.id);
    if (!x) throw new Error('That preset is not in a bank');
    loadSlot(x.bank, x.slot);
  } else if (!loadSlot(Number(b.bank), Number(b.slot))) throw new Error('That slot is empty');
  return { bank: S.bank, slot: S.slot, pendingBank: S.pendingBank, preset: livePreset && livePreset.id };
});
R.add('POST', '/api/param', (c) => { setParam(c.body.block, c.body.name, c.body.value); return {}; });
R.add('POST', '/api/bypass', (c) => { setBypass(c.body.block, c.body.on); return {}; });
R.add('POST', '/api/tuner', (c) => { setTuner(c.body.on); return { tuner: tunerOn }; });
R.add('POST', '/api/mute', (c) => { setMute(c.body.on); return { muted }; });
R.add('POST', '/api/tap', () => { tap(); return { bpm }; });
// config
R.add('GET', '/api/config', () => configOut());
R.add('PUT', '/api/config/:part', (c) => setConfig(c.params.part, c.body));
R.add('GET', '/api/audio/devices', () => devicesNow());
R.add('GET', '/api/audio/ports', () => lastPorts || { sources: [], sinks: [] });
R.add('GET', '/api/gpio/leds', () => (gpio ? gpio.ledState() : {}));
R.add('POST', '/api/gpio/test', async (c) => {
  const pin = String(c.body.pin);
  const cfg = S.config.gpio.pins[pin];
  if (!cfg) throw new Error('Nothing set up on that pin');
  if (cfg.type === 'led' || c.body.kind === 'led') { blinkUntil[pin] = Date.now() + 3000; return { blinking: 3 }; }
  if (gpio && hw.FAKE) await gpio.press(pin, c.body.ms || 60);
  else doAction({ action: cfg.press, block: cfg.pressBlock || cfg.block });
  return { pressed: pin };
});
R.add('POST', '/api/identify', () => { identifyUntil = Date.now() + 10000; log.info('identify: blinking the status LED', 'gpio'); return {}; });
R.add('POST', '/api/reboot', () => { log.info('reboot requested'); setTimeout(() => root('reboot'), 300); return {}; });
R.add('POST', '/api/audio/testtone', (c) => setTestTone(c.body || {}));
R.add('POST', '/api/restart-audio', async () => { await startAudio(); return {}; });
R.add('GET', '/api/logs', (c) => log.since(Number(c.query.since) || 0));
R.add('GET', '/api/support', () => {
  const s = JSON.parse(JSON.stringify(stateOut()));
  return { made: new Date().toISOString(), state: s, logs: log.since(0), presets: store.listPresets(), engine: engine.bin, audio: audioInfo, uname: os.release(), node: process.version };
});
R.add('POST', '/api/selftest', () => selfTest());
// updates
R.add('GET', '/api/update/status', () => update.status());
R.add('POST', '/api/update/verify', (c) => update.check(c.body, c.req.headers['x-tz-signature'], { allowUnsigned: !!S.config.updates.allowUnsigned }), { raw: true });
R.add('POST', '/api/update', (c) => {
  const r = update.install(c.body, c.req.headers['x-tz-signature'], { allowUnsigned: !!S.config.updates.allowUnsigned });
  restartSoon();
  return r;
}, { raw: true });
R.add('POST', '/api/update/check', async (c) => {
  const info = await update.latest(c.body.channel || S.config.updates.channel);
  return { latest: info.version, current: VERSION, newer: update.newer(info.version, VERSION), notes: info.notes || [] };
});
R.add('POST', '/api/update/download', async (c) => {
  const info = await update.latest(c.body.channel || S.config.updates.channel);
  if (!update.newer(info.version, VERSION) && !c.body.force) return { upToDate: true, version: VERSION };
  broadcast({ t: 'progress', job: 'update', pct: 10, text: `Downloading ${info.version}` });
  const { buf, sig } = await update.download(info);
  broadcast({ t: 'progress', job: 'update', pct: 70, text: 'Installing' });
  const r = update.install(buf, sig, { allowUnsigned: !!S.config.updates.allowUnsigned });
  restartSoon();
  return r;
});
R.add('POST', '/api/update/rollback', () => { const r = update.rollback(); restartSoon(); return r; });
// fake hardware test hooks
if (hw.FAKE) {
  R.add('POST', '/api/fake/gpio', async (c) => {
    if (!gpio) throw new Error('no gpio');
    if (c.body.press) return { ok: await gpio.press(c.body.pin, Number(c.body.press) || 60) };
    return { ok: gpio.setLevel(c.body.pin, c.body.level) };
  });
  R.add('POST', '/api/fake/temp', (c) => { hw.write('/sys/class/thermal/thermal_zone0/temp', Math.round(Number(c.body.c) * 1000)); return {}; });
}

let restarting = false;
function restartSoon() {
  if (restarting) return;
  restarting = true;
  // systemd starts us again from the new /opt/tonezone/current
  setTimeout(() => { shutdown(); setTimeout(() => process.exit(75), 300); }, 400);
}

// ------------------------------------------------------------------ static UI
const UI_DIR = [path.join(hw.SLOT, 'ui'), path.join(__dirname, '..', 'ui')].find((d) => fs.existsSync(path.join(d, 'index.html')));
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };
function staticFiles(p) {
  if (!UI_DIR) return null;
  if (p === '/' || p === '/ui' || p === '/ui/') p = '/index.html';
  p = p.replace(/^\/ui\//, '/');
  const f = path.normalize(path.join(UI_DIR, p));
  if (!f.startsWith(UI_DIR) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return null;
  return { body: fs.readFileSync(f), type: TYPES[path.extname(f)] || 'application/octet-stream' };
}

// ------------------------------------------------------------------ WebSocket
const clients = new Set();
function broadcast(msg) {
  const s = JSON.stringify(msg);
  for (const c of clients) c.ws.send(s);
}
let stateTimer = null;
function broadcastState() {
  clearTimeout(stateTimer);
  stateTimer = setTimeout(() => broadcast({ t: 'state', state: stateOut() }), 30);
}
log.bus.on('line', (line) => broadcast({ t: 'log', line }));

const http = createServer({
  router: R,
  auth: (req, ctx) => pair.check(req, ctx),
  staticFiles,
  onWs: (ws) => {
    const c = { ws, meters: false };
    clients.add(c);
    ws.onclose = () => clients.delete(c);
    ws.onmessage = (txt) => {
      let m;
      try { m = JSON.parse(txt); } catch { return; }
      if (m.meters !== undefined) c.meters = !!m.meters;
      if (m.action) try { doAction(m); } catch {}
    };
    ws.send({ t: 'state', state: stateOut() });
  },
});

// ------------------------------------------------------------------ mDNS (Avahi does it on a normal install)
let mdnsAd = null;
function startMdns() {
  const avahi = !hw.FAKE && fs.existsSync('/etc/avahi/services/tonezone.service') && spawnSync('sh', ['-c', 'pgrep -x avahi-daemon'], { encoding: 'utf8' }).status === 0;
  if (avahi) { log.info('mDNS: Avahi advertises _tonezone._tcp'); return; }
  if (process.env.TZ_NO_MDNS === '1') return;
  mdnsAd = mdns.advertise({ instance: S.name || 'Tone Zone', host: hw.FAKE ? 'tonezone-fake' : os.hostname(), port: PORT, txt: { id: S.id, model: board.model, version: VERSION, api: 1 } });
  log.info(`mDNS: advertising ${S.name} (_tonezone._tcp, port ${PORT})`);
}

// ------------------------------------------------------------------ start / stop
function shutdown() {
  try { engine.stop(); } catch {}
  try { server.stop(); } catch {}
  try { gpio && gpio.close(); } catch {}
  try { mdnsAd && mdnsAd.close(); } catch {}
  try { http.close(); } catch {}
}
process.on('SIGTERM', () => { shutdown(); setTimeout(() => process.exit(0), 300); });
process.on('SIGINT', () => { shutdown(); setTimeout(() => process.exit(0), 300); });
process.on('uncaughtException', (e) => log.error('uncaught: ' + (e.stack || e)));

(async () => {
  if (S.config.audio.governor) root('governor', 'performance');
  http.listen(PORT, process.env.TZ_BIND || '0.0.0.0', () => log.info(`API on port ${PORT}`));
  http.on('error', (e) => { log.error(`cannot listen on ${PORT}: ${e.message}`); process.exit(1); });
  await startAudio();
  loadInitial();
  startGpio();
  startMdns();
  if (!pair.paired()) log.info(`not paired yet: open the Pi tab in Tone Zone and enter code ${pair.current()}`);
  else pair.current();
  // a new version checks itself: engine renders, API answers
  const r = await update.afterStart(async () => {
    selfTest();
    await new Promise((res) => setTimeout(res, 1500));
    if (!engine.proc) throw new Error('engine does not stay up');
    return true;
  });
  if (r.rollback) { shutdown(); setTimeout(() => process.exit(75), 300); }
})();
