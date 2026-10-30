// Pi tab: demo data, saved tab state and the Pi CPU estimate. Nothing here talks to a real Pi yet.
import { getDef } from '../catalog/index.js';
import { bus } from '../util.js';

export const MODELS = {
  pi5: { name: 'Raspberry Pi 5', short: 'Pi 5', jack: false },
  pi4: { name: 'Raspberry Pi 4', short: 'Pi 4', jack: true },
};

// Rough Pi cost factors vs. the desktop catalog cost. Replaced by measured numbers in phase 1 (see docs/raspberry-pi.md).
const FACTORS = { pi4: { base: 3.0, nam: 5.0, ir: 2.0, fixed: 3 }, pi5: { base: 1.4, nam: 2.2, ir: 1.0, fixed: 2 } };
export const PI_BUDGET = 70;

export const SCREENS = [
  { id: 'none', name: 'No screen (headless)', w: 0, h: 0 },
  { id: 'touch7', name: 'Raspberry Pi Touch Display 7"', w: 800, h: 480, bus: 'DSI', touch: true },
  { id: 'touch7v2', name: 'Raspberry Pi Touch Display 2 (7")', w: 1280, h: 720, bus: 'DSI', touch: true },
  { id: 'hdmi5', name: '5" HDMI touch screen', w: 800, h: 480, bus: 'HDMI', touch: true },
  { id: 'spi35', name: '3.5" SPI touch screen', w: 480, h: 320, bus: 'SPI', touch: true, pins: [7, 8, 9, 10, 11, 24, 25] },
  { id: 'spi28', name: '2.8" SPI screen', w: 320, h: 240, bus: 'SPI', touch: true, pins: [7, 8, 9, 10, 11, 24, 25] },
  { id: 'oled', name: '1.3" OLED (status only)', w: 128, h: 64, bus: 'I2C', touch: false, pins: [2, 3] },
];

// audio devices; `for` limits a device to a board, `pins` are header pins it takes
export const AUDIO_DEVICES = [
  { id: 'hat-hifiberry', name: 'HiFiBerry DAC+ ADC Pro (HAT)', kind: 'hat', io: 'both', lat: 0.4, pins: [18, 19, 20, 21, 2, 3], q: 'Very good. Line level input: use a buffer or DI for guitar.' },
  { id: 'hat-codec', name: 'Raspberry Pi Codec Zero (HAT)', kind: 'hat', io: 'both', lat: 0.4, pins: [18, 19, 20, 21, 2, 3], q: 'Good. Small and cheap, mic / line input.' },
  { id: 'hat-pisound', name: 'Blokas Pisound (HAT)', kind: 'hat', io: 'both', lat: 0.5, pins: [18, 19, 20, 21, 8, 9, 10, 11], q: 'Very good. Hi-Z guitar input, MIDI and a button.' },
  { id: 'usb-scarlett', name: 'Focusrite Scarlett Solo (USB)', kind: 'usb', io: 'both', lat: 1.4, q: 'Very good. Hi-Z instrument input, no driver needed.' },
  { id: 'usb-umc22', name: 'Behringer UMC22 (USB)', kind: 'usb', io: 'both', lat: 1.8, q: 'Good. Hi-Z input, cheap.' },
  { id: 'usb-aux', name: 'USB audio adapter (aux dongle)', kind: 'aux', io: 'both', lat: 2.5, q: 'Okay. Mono mic / line in: guitar sounds thin and quiet without a boost or DI in front.' },
  { id: 'jack35', name: 'Built-in 3.5 mm jack', kind: 'builtin', io: 'out', lat: 1.0, for: 'pi4', q: 'Low (PWM, some hiss). Fine for headphones or a practice amp.' },
  { id: 'hdmi', name: 'HDMI audio', kind: 'builtin', io: 'out', lat: 20, q: 'Good sound but high latency. For monitoring only.' },
];
export function audioDevicesFor(model, dir) {
  return AUDIO_DEVICES.filter((d) => (!d.for || d.for === model) && (d.io === 'both' || d.io === dir));
}
export const audioDevice = (id) => AUDIO_DEVICES.find((d) => d.id === id);

// estimated round trip in ms; two devices means two clocks, so add the resampler
export function latencyFor(a) {
  const inD = audioDevice(a.input), outD = audioDevice(a.output);
  const cycle = (a.buffer / a.rate) * 1000;
  const parts = [['Input buffer', cycle], ['Output buffer', cycle * (a.periods - 1)]];
  if (inD) parts.push(['Input converter', inD.lat]);
  if (outD && outD !== inD) parts.push(['Output converter', outD.lat]);
  else if (inD) parts.push(['Output converter', inD.lat * 0.6]);
  if (inD && outD && inD !== outD) parts.push(['Clock sync (resampler)', Math.max(1, cycle * 0.5) + 0.5]);
  return { total: parts.reduce((s, p) => s + p[1], 0), parts, split: !!(inD && outD && inD !== outD) };
}

export const HEADER = (() => {
  // physical pin -> [label, bcm or null, kind]
  const m = {
    1: ['3V3', null, 'p3'], 2: ['5V', null, 'p5'], 4: ['5V', null, 'p5'], 17: ['3V3', null, 'p3'],
    6: ['GND', null, 'gnd'], 9: ['GND', null, 'gnd'], 14: ['GND', null, 'gnd'], 20: ['GND', null, 'gnd'], 25: ['GND', null, 'gnd'], 30: ['GND', null, 'gnd'], 34: ['GND', null, 'gnd'], 39: ['GND', null, 'gnd'],
  };
  const g = { 3: [2, 'SDA'], 5: [3, 'SCL'], 7: [4], 8: [14, 'TXD'], 10: [15, 'RXD'], 11: [17], 12: [18, 'PCM CLK'], 13: [27], 15: [22], 16: [23], 18: [24], 19: [10, 'MOSI'], 21: [9, 'MISO'], 22: [25], 23: [11, 'SCLK'], 24: [8, 'CE0'], 26: [7, 'CE1'], 27: [0, 'ID_SD'], 28: [1, 'ID_SC'], 29: [5], 31: [6], 32: [12, 'PWM0'], 33: [13, 'PWM1'], 35: [19, 'PCM FS'], 36: [16], 37: [26], 38: [20, 'PCM DIN'], 40: [21, 'PCM DOUT'] };
  for (const k in g) m[k] = ['GPIO' + g[k][0], g[k][0], 'gpio', g[k][1]];
  return m;
})();

export const FOOT_ACTIONS = [
  ['none', 'Nothing'], ['preset+', 'Next preset'], ['preset-', 'Previous preset'], ['bank+', 'Bank up'], ['bank-', 'Bank down'],
  ['slotA', 'Preset A'], ['slotB', 'Preset B'], ['slotC', 'Preset C'], ['slotD', 'Preset D'],
  ['block', 'Toggle a block'], ['tap', 'Tap tempo'], ['tuner', 'Tuner'], ['loop', 'Looper rec / play'], ['mute', 'Mute'],
];
export const LED_SHOWS = [['slotA', 'Preset A active'], ['slotB', 'Preset B active'], ['slotC', 'Preset C active'], ['slotD', 'Preset D active'], ['block', 'A block is on'], ['tap', 'Tap tempo'], ['tuner', 'Tuner on'], ['status', 'Status (CPU, clipping, pairing)']];

function demoBanks() {
  const P = (file, name) => ({ file, name });
  return [
    { name: 'Gig set', presets: [P('01-welcome.json', 'Welcome'), P('03-modern-metal.json', 'Modern Metal'), P('02-clean-ambient.json', 'Clean Ambient'), P('09-wah-fuzz.json', 'Wah Fuzz')] },
    { name: 'Practice', presets: [P('08-boutique.json', 'Boutique'), P('07-drop-tune.json', 'Drop Tune'), null, null] },
    { name: 'Bass night', presets: [P('04-bass-rig.json', 'Bass Rig'), null, null, null] },
  ];
}
function demoDevices() {
  return [
    { id: 'd1', name: 'Pedalboard Pi', model: 'pi5', ram: 4, host: 'tonezone.local', ip: '192.168.1.42', link: 'wifi', online: true, version: '0.8.0', cpu: 31, temp: 52, xruns: 0, uptime: 3 * 3600 + 1240, banks: demoBanks(), bank: 0, slot: 1 },
    { id: 'd2', name: 'Practice Pi', model: 'pi4', ram: 2, host: 'tonezone-3f2a.local', ip: '169.254.12.7', link: 'direct', online: true, version: '0.7.2', cpu: 48, temp: 61, xruns: 2, uptime: 900, banks: demoBanks().slice(1), bank: 0, slot: 0 },
    { id: 'd3', name: 'Spare Pi', model: 'pi4', ram: 1, host: 'tonezone-91c0.local', ip: '192.168.1.77', link: 'ethernet', online: false, version: '0.7.0', cpu: 0, temp: 0, xruns: 0, uptime: 0, banks: [], bank: 0, slot: 0 },
  ];
}
function demoGpio() {
  return {
    pins: {
      11: { type: 'foot', name: 'FS 1', mode: 'momentary', debounce: 20, press: 'slotA', hold: 'bank-' },
      13: { type: 'foot', name: 'FS 2', mode: 'momentary', debounce: 20, press: 'slotB', hold: 'none' },
      15: { type: 'foot', name: 'FS 3', mode: 'momentary', debounce: 20, press: 'slotC', hold: 'none' },
      16: { type: 'foot', name: 'FS 4', mode: 'momentary', debounce: 20, press: 'slotD', hold: 'bank+' },
      29: { type: 'led', name: 'LED A', show: 'slotA', bright: 80 },
      31: { type: 'led', name: 'LED B', show: 'slotB', bright: 80 },
      37: { type: 'led', name: 'Status', show: 'status', bright: 60 },
    },
    adc: 'ads1115',
    expr: [{ ch: 0, name: 'Expression 1', target: 'Volume', heel: 4, toe: 96 }],
    bankWaits: true,
  };
}
function defaults() {
  return {
    v: 1, section: 'devices', current: 'd1', devices: demoDevices(), gpio: demoGpio(),
    display: { screen: 'touch7', rotation: 0, brightness: 80, timeout: 0, theme: 'dark', touch: true },
    audio: { input: 'hat-hifiberry', output: 'hat-hifiberry', rate: 48000, buffer: 128, periods: 2, governor: true, isolate: false, server: 'pipewire' },
    updates: { channel: 'stable', auto: false, via: 'network' },
    switching: { preload: true, spillover: true, midi: false },
  };
}

const KEY = 'tz.pi.demo.v1';
let store = null;
export function piStore() {
  if (store) return store;
  try { store = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { store = null; }
  if (!store || store.v !== 1) store = defaults();
  return store;
}
export function savePi() {
  try { localStorage.setItem(KEY, JSON.stringify(store)); } catch { /* demo only */ }
}
export function resetPi() {
  store = defaults();
  savePi();
}
export const currentDevice = () => { const s = piStore(); return s.devices.find((d) => d.id === s.current) || s.devices[0]; };

// ---- logs (kept in memory, demo lines plus whatever the tab does)
const logs = [];
const t0 = Date.now() - 1000 * 60 * 14;
for (const [dt, lvl, src, msg] of [
  [0, 'info', 'agent', 'tz-agent 0.8.0 starting'], [400, 'info', 'agent', 'mDNS: advertising tonezone.local (_tonezone._tcp, port 7650)'],
  [900, 'info', 'engine', 'JACK: PipeWire 1.2.7, 48000 Hz, 128 frames, RT priority 88'], [1300, 'info', 'engine', 'CPU governor: performance, 2400 MHz'],
  [1700, 'info', 'engine', 'Loaded preset "Modern Metal" (bank 1, B) in 182 ms'], [1800, 'info', 'agent', 'Preloaded 3 presets (A, C, D) for instant switching'],
  [2200, 'info', 'gpio', 'gpiochip0: 4 footswitches, 3 LEDs, ADS1115 at 0x48'], [64000, 'warn', 'engine', 'xrun (1) at 61 C, buffer 128'],
  [128000, 'info', 'agent', 'Desktop "studio-pc" connected (paired)'],
]) logs.push({ t: t0 + dt, lvl, src, msg });
export function piLog(msg, lvl = 'info', src = 'agent') {
  logs.push({ t: Date.now(), lvl, src, msg });
  if (logs.length > 500) logs.shift();
  bus.emit('pi:log');
}
export const piLogs = () => logs;

// ---- blocks in signal order (follows cables from the input, then anything left over by position)
export function chainOrder(preset) {
  const blocks = (preset?.blocks || []).filter((b) => !String(b.id).startsWith('__'));
  const out = [], seen = new Set();
  const next = new Map();
  for (const c of preset?.cables || []) {
    if (!next.has(c.from.node)) next.set(c.from.node, []);
    next.get(c.from.node).push(c.to.node);
  }
  const q = ['__in'];
  while (q.length) {
    const id = q.shift();
    for (const n of next.get(id) || []) {
      if (seen.has(n) || String(n).startsWith('__')) continue;
      seen.add(n);
      const b = blocks.find((x) => x.id === n);
      if (b) out.push(b);
      q.push(n);
    }
  }
  const rest = blocks.filter((b) => !seen.has(b.id)).sort((a, b) => b.x - a.x);
  return [...out, ...rest];
}

// ---- compatibility check: per block Pi 4 / Pi 5 estimate and notes
export function checkPreset(preset) {
  const rows = [];
  let pi4 = FACTORS.pi4.fixed, pi5 = FACTORS.pi5.fixed;
  for (const b of chainOrder(preset)) {
    const d = getDef(b.type);
    const row = { id: b.id, name: d ? d.name : b.type, cat: d ? d.cat : '?', status: 'ok', notes: [], pi4: 0, pi5: 0 };
    if (!d) { row.status = 'bad'; row.notes.push('Unknown block (is its plugin turned off?). Skipped.'); rows.push(row); continue; }
    if (!d.algo) { rows.push(Object.assign(row, { status: 'ok', notes: ['No sound processing (looks only).'] })); continue; }
    if (d.algo === 'extio' || d.cat === 'Device') {
      row.status = 'bad';
      row.notes.push('Needs a USB device on the desktop. Skipped on the Pi, audio passes through.');
      rows.push(row);
      continue;
    }
    const kind = d.algo === 'nam' ? 'nam' : d.algo === 'ir' || d.algo === 'cab' ? 'ir' : 'base';
    const cost = d.cost ?? 0.5;
    row.pi4 = cost * FACTORS.pi4[kind];
    row.pi5 = cost * FACTORS.pi5[kind];
    if (d.algo === 'nam') {
      row.notes.push('NAM model is copied with the preset. Lite or Feather models are best on Pi 4.');
      if (row.pi4 > 40) row.notes.push('A2 Full drops to Lite on Pi 4.');
    }
    if (d.algo === 'ir' || d.algo === 'cab') row.notes.push('IR trimmed to 4096 taps on the Pi (sounds the same).');
    if (d.algo === 'pitch') row.notes.push('Adds 10 to 21 ms of latency, same as on the desktop.');
    if (d.algo === 'looper') row.notes.push('Loop time limited to about 60 s on a 1 GB Pi.');
    if (String(b.type).startsWith('custom:')) row.notes.push('Custom screens are not drawn on the Pi screen.');
    if (row.pi4 > 15) row.status = 'heavy';
    pi4 += row.pi4;
    pi5 += row.pi5;
    rows.push(row);
  }
  const verdict = (v) => (v > PI_BUDGET ? 'bad' : v > PI_BUDGET * 0.8 ? 'heavy' : 'ok');
  return { rows, pi4, pi5, v4: verdict(pi4), v5: verdict(pi5) };
}

export const fmtUptime = (s) => (s < 3600 ? Math.round(s / 60) + ' min' : Math.floor(s / 3600) + ' h ' + Math.round((s % 3600) / 60) + ' min');
export const LINKS = { wifi: 'Wi-Fi', ethernet: 'Ethernet', direct: 'Direct cable', manual: 'Manual' };
