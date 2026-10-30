// Pi tab data layer: demo data, live data from a real Pi, saved tab state and the Pi CPU estimate.
//
// ===================================================================================================
// INTERFACE FOR pi-live.js (the real backend adapter, owned by the piback helper)
// ===================================================================================================
// The UI only reads the plain objects described here. Demo mode fills them with fake data, live mode
// fills them from pi-live.js. pi-live.js is only imported when window.tz.pi exists.
//
//   import { createLive } from './pi-live.js';
//   const live = createLive(window.tz.pi);
//
// LiveSource
//   live.start(emit)        Promise. Start discovery / connections. Call emit(event) whenever something
//                           changes (any number of times, from any async callback). Events:
//       { type: 'devices', devices: Device[] }      full list: online Pis and remembered (paired) ones
//       { type: 'stats', id, stats: Stats }         about once a second per online Pi
//       { type: 'config', id, config: Config }      after connecting, or when the Pi changed something itself
//       { type: 'device', id, patch: {...} }        some Device fields changed (bank, slot, version, banks...)
//       { type: 'log', id, line: LogLine }          a new log line
//       { type: 'progress', id, job, pct, text, done, error }   job is 'push' | 'update' | 'pair' | 'scan'
//   live.stop()             stop timers and sockets (tab closed)
//   live.call(action, args) Promise with the result. Reject with an Error whose message can be shown to the
//                           user as is. Actions and args (id is always the Device id):
//       scan       {}                                 -> Device[]   (also emit 'devices')
//       probe      { host }                           -> { model, version, name } | null   (wizard "Found ...")
//       pair       { host, code, link }               -> Device     (code is the 6 digit pairing code)
//       forget     { id }
//       rename     { id, name }
//       identify   { id }                             blink the status LED for 10 s
//       reboot     { id }
//       setBudget  { id, budget }                     DSP budget in percent (40..95)
//       setBanks   { id, banks }                      the whole Bank[] list (after any edit, reorder, delete)
//       select     { id, bank, slot }                 play that preset now
//       push       { id, preset, file, name, bank, slot } -> { dsp }  measured DSP % on the Pi; emit progress
//       setConfig  { id, part, value }                part: 'gpio' | 'display' | 'audio' | 'updates' | 'switching'
//       testPin    { id, pin, kind }                  kind 'foot' (fake a press) or 'led' (blink)
//       calibrate  { id, ch }                         -> { heel, toe }  (percent)
//       testTone   { id }
//       checkUpdate { id, channel }                   -> { latest, notes: string[] }
//       update     { id, channel, via }               emit progress job 'update', then a 'device' patch
//       rollback   { id }
//       logs       { id }                             -> LogLine[]  (recent history)
//       supportBundle { id }                          -> { path }   saved file
//       levels     { id }                             -> { in, out }  0..100, polled while Audio is open
//
// Device
//   { id, name, model: 'pi3b' | 'pi3bp' | 'pi4' | 'pi5', ram: GB, host: 'tonezone.local', ip,
//     link: 'wifi' | 'ethernet' | 'direct' | 'manual', online: bool, lastSeen: ms epoch, version: '0.9.0',
//     prevVersion, os: '64-bit' | '32-bit', budget: 40..95 (DSP budget %, default 70),
//     banks: Bank[], bank: index, slot: 0..3, ...Stats }
// Stats (merged into the Device)
//   { dsp: 0..100 (audio engine load, % of one audio cycle), cpu: 0..100 (whole system, all cores),
//     temp: C, xruns: count since start, uptime: s, latency: ms (round trip estimate) }
// Bank      { name, presets: [Slot | null, Slot | null, Slot | null, Slot | null] }   (A to D)
// Slot      { file, name, dsp? }         dsp = measured DSP % on that Pi, when known
// Config    { gpio, display, audio, updates, switching }   same shapes as defaults() below:
//   gpio.pins[physicalPin] = { type: 'foot', name, mode: 'momentary' | 'latching', debounce: ms,
//                               press: FOOT_ACTIONS id, hold: FOOT_ACTIONS id, pressBlock?, holdBlock? }
//                          | { type: 'led', name, show: LED_SHOWS id, drive: 'onoff' | 'pwm',
//                               bright: 0..100 (lit), dim: 0..100 (unlit, PWM only), block?, out? }
//       LED show ids: slotA..slotD (preset active), block (that block is on, by name in `block`),
//       tap (blinks with tap tempo), circuit (a circuit block output `out` of block `block`: on/off when it is
//       high, or brightness follows the value in PWM mode), tuner, status.
//       PWM: drive 'pwm' uses hardware PWM on GPIO 12, 13, 18, 19 when free, software PWM elsewhere.
//   gpio.adc 'none' | 'ads1115' | 'mcp3008', gpio.expr [{ ch, name, target, heel, toe }], gpio.bankWaits
//   display { screen: SCREENS id, rotation, brightness, timeout, theme, touch }
//   audio   { input: AUDIO_DEVICES id, output, rate, buffer, periods, governor, isolate, server }
//   updates { channel, auto, via }       switching { preload, spillover, midi }
// LogLine   { t: ms epoch, lvl: 'info' | 'warn' | 'error', src: 'agent' | 'engine' | 'gpio' | 'ui', msg }
//
// Mode: live when window.tz.pi exists and live.start found at least one Device, unless the user turned the
// Demo toggle on. With no real Pis the tab stays in demo mode (the toggle turns it off to pair a real one).
// ===================================================================================================
import { getDef } from '../catalog/index.js';
import { bus } from '../util.js';

// jack: has a 3.5 mm output. hwPwm: independent hardware PWM channels on the header.
export const MODELS = {
  pi5: { name: 'Raspberry Pi 5', short: 'Pi 5', jack: false, ghz: 2.4, hwPwm: 4, ram: [2, 4, 8, 16] },
  pi4: { name: 'Raspberry Pi 4', short: 'Pi 4', jack: true, ghz: 1.8, hwPwm: 2, ram: [1, 2, 4, 8] },
  pi3bp: { name: 'Raspberry Pi 3 Model B+', short: 'Pi 3B+', jack: true, ghz: 1.4, hwPwm: 2, ram: [1] },
  pi3b: { name: 'Raspberry Pi 3 Model B', short: 'Pi 3B', jack: true, ghz: 1.2, hwPwm: 2, ram: [1] },
};
export const MODEL_IDS = ['pi3b', 'pi3bp', 'pi4', 'pi5'];
export const isPi3 = (m) => m === 'pi3b' || m === 'pi3bp';
export const modelOf = (m) => MODELS[m] || MODELS.pi4;

// Rough Pi cost factors vs. the desktop catalog cost. Replaced by measured numbers in phase 1 (see docs/raspberry-pi.md).
// Pi 3 is a Cortex-A53: about half a Pi 4 for plain DSP and worse for NAM (small caches, slow memory).
const FACTORS = {
  pi3b: { base: 6.6, nam: 12.5, ir: 4.4, fixed: 5 },
  pi3bp: { base: 5.7, nam: 10.8, ir: 3.8, fixed: 5 },
  pi4: { base: 3.0, nam: 5.0, ir: 2.0, fixed: 3 },
  pi5: { base: 1.4, nam: 2.2, ir: 1.0, fixed: 2 },
};
export const PI_BUDGET = 70;
export const BUDGET_MIN = 40, BUDGET_MAX = 95;
export const defaultBudget = (model) => (isPi3(model) ? 65 : 70);
export const budgetOf = (d) => (d && d.budget) || (d ? defaultBudget(d.model) : PI_BUDGET);

// load colour: green when low, yellow around 50 to 60%, red near the top. Returns a class and a CSS colour.
export function loadLevel(pct) {
  return pct >= 80 ? 'load-hot' : pct >= 50 ? 'load-warn' : 'load-ok';
}
export function loadColor(pct) {
  // green until 40, to yellow by 55, yellow to 65, to red by 85
  const p = Math.max(0, Math.min(100, pct));
  if (p <= 40) return 'var(--good)';
  if (p < 55) return mix('--warn', '--good', (p - 40) / 15);
  if (p <= 65) return 'var(--warn)';
  if (p < 85) return mix('--bad', '--warn', (p - 65) / 20);
  return 'var(--bad)';
}
// temperature: red around 77 C, flashing above 80 C
export function tempLevel(c) {
  return c > 80 ? 'temp-crit' : c >= 75 ? 'temp-hot' : c >= 65 ? 'temp-warn' : 'temp-ok';
}
export function tempColor(c) {
  if (c <= 58) return 'var(--good-text)';
  if (c < 66) return mix('--warn', '--good-text', (c - 58) / 8);
  if (c <= 70) return 'var(--warn)';
  if (c < 77) return mix('--bad', '--warn', (c - 70) / 7);
  return 'var(--bad)';
}
const mix = (a, b, t) => `color-mix(in srgb, var(${a}) ${Math.round(t * 100)}%, var(${b}))`;

export const SCREENS = [
  { id: 'none', name: 'No screen (headless)', w: 0, h: 0 },
  { id: 'touch7', name: 'Raspberry Pi Touch Display 7"', w: 800, h: 480, bus: 'DSI', touch: true },
  { id: 'touch7v2', name: 'Raspberry Pi Touch Display 2 (7")', w: 1280, h: 720, bus: 'DSI', touch: true },
  { id: 'hdmi5', name: '5" HDMI touch screen', w: 800, h: 480, bus: 'HDMI', touch: true },
  { id: 'spi35', name: '3.5" SPI touch screen', w: 480, h: 320, bus: 'SPI', touch: true, pins: [7, 8, 9, 10, 11, 24, 25] },
  { id: 'spi28', name: '2.8" SPI screen', w: 320, h: 240, bus: 'SPI', touch: true, pins: [7, 8, 9, 10, 11, 24, 25] },
  { id: 'oled', name: '1.3" OLED (status only)', w: 128, h: 64, bus: 'I2C', touch: false, pins: [2, 3] },
];

// audio devices; `for` limits a device to some boards, `pins` are GPIO numbers it takes, `qFor` is a per board note
export const AUDIO_DEVICES = [
  { id: 'hat-hifiberry', name: 'HiFiBerry DAC+ ADC Pro (HAT)', kind: 'hat', io: 'both', lat: 0.4, pins: [18, 19, 20, 21, 2, 3], q: 'Very good. Line level input: use a buffer or DI for guitar.' },
  { id: 'hat-codec', name: 'Raspberry Pi Codec Zero (HAT)', kind: 'hat', io: 'both', lat: 0.4, pins: [18, 19, 20, 21, 2, 3], q: 'Good. Small and cheap, mic / line input.' },
  { id: 'hat-pisound', name: 'Blokas Pisound (HAT)', kind: 'hat', io: 'both', lat: 0.5, pins: [18, 19, 20, 21, 8, 9, 10, 11], q: 'Very good. Hi-Z guitar input, MIDI and a button.' },
  { id: 'usb-scarlett', name: 'Focusrite Scarlett Solo (USB)', kind: 'usb', io: 'both', lat: 1.4, q: 'Very good. Hi-Z instrument input, no driver needed.', qFor: { pi3: 'Very good sound. On a Pi 3 USB shares its bus with Ethernet: use buffer 128 or more.' } },
  { id: 'usb-umc22', name: 'Behringer UMC22 (USB)', kind: 'usb', io: 'both', lat: 1.8, q: 'Good. Hi-Z input, cheap.' },
  { id: 'usb-aux', name: 'USB audio adapter (aux dongle)', kind: 'aux', io: 'both', lat: 2.5, q: 'Okay. Mono mic / line in: guitar sounds thin and quiet without a boost or DI in front.' },
  { id: 'jack35', name: 'Built-in 3.5 mm jack', kind: 'builtin', io: 'out', lat: 1.0, for: ['pi3b', 'pi3bp', 'pi4'], q: 'Low (PWM, some hiss). Fine for headphones or a practice amp.', qFor: { pi3: 'Lower than the Pi 4 jack (PWM, more hiss and some whine). Fine for headphones and practice.' } },
  { id: 'hdmi', name: 'HDMI audio', kind: 'builtin', io: 'out', lat: 20, q: 'Good sound but high latency. For monitoring only.' },
];
export function audioDevicesFor(model, dir) {
  return AUDIO_DEVICES.filter((d) => (!d.for || d.for.includes(model)) && (d.io === 'both' || d.io === dir));
}
export const audioDevice = (id) => AUDIO_DEVICES.find((d) => d.id === id);
export const audioNote = (d, model) => (d.qFor && isPi3(model) && d.qFor.pi3) || d.q;

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
  // physical pin -> [label, bcm or null, kind, alt function]
  const m = {
    1: ['3V3', null, 'p3'], 2: ['5V', null, 'p5'], 4: ['5V', null, 'p5'], 17: ['3V3', null, 'p3'],
    6: ['GND', null, 'gnd'], 9: ['GND', null, 'gnd'], 14: ['GND', null, 'gnd'], 20: ['GND', null, 'gnd'], 25: ['GND', null, 'gnd'], 30: ['GND', null, 'gnd'], 34: ['GND', null, 'gnd'], 39: ['GND', null, 'gnd'],
  };
  const g = { 3: [2, 'SDA'], 5: [3, 'SCL'], 7: [4], 8: [14, 'TXD'], 10: [15, 'RXD'], 11: [17], 12: [18, 'PCM CLK, PWM0'], 13: [27], 15: [22], 16: [23], 18: [24], 19: [10, 'MOSI'], 21: [9, 'MISO'], 22: [25], 23: [11, 'SCLK'], 24: [8, 'CE0'], 26: [7, 'CE1'], 27: [0, 'ID_SD'], 28: [1, 'ID_SC'], 29: [5], 31: [6], 32: [12, 'PWM0'], 33: [13, 'PWM1'], 35: [19, 'PCM FS, PWM1'], 36: [16], 37: [26], 38: [20, 'PCM DIN'], 40: [21, 'PCM DOUT'] };
  for (const k in g) m[k] = ['GPIO' + g[k][0], g[k][0], 'gpio', g[k][1]];
  return m;
})();
// hardware PWM: GPIO -> channel. Pi 3 / 4 have two channels (12 and 18 share one, 13 and 19 the other) and the
// 3.5 mm jack uses both. Pi 5 has four independent channels and no jack.
export const HW_PWM = { 12: 0, 13: 1, 18: 0, 19: 1 };
export const pwmChannel = (bcm, model) => (bcm in HW_PWM ? (model === 'pi5' ? { 12: 0, 13: 1, 18: 2, 19: 3 }[bcm] : HW_PWM[bcm]) : null);

export const FOOT_ACTIONS = [
  ['none', 'Nothing'], ['preset+', 'Next preset'], ['preset-', 'Previous preset'], ['bank+', 'Bank up'], ['bank-', 'Bank down'],
  ['slotA', 'Preset A'], ['slotB', 'Preset B'], ['slotC', 'Preset C'], ['slotD', 'Preset D'],
  ['block', 'Toggle a block'], ['tap', 'Tap tempo'], ['tuner', 'Tuner'], ['loop', 'Looper rec / play'], ['mute', 'Mute'],
];
export const LED_SHOWS = [
  ['slotA', 'Preset A active'], ['slotB', 'Preset B active'], ['slotC', 'Preset C active'], ['slotD', 'Preset D active'],
  ['block', 'A block is on (bypass state)'], ['tap', 'Tap tempo (blinks on the beat)'], ['circuit', 'A circuit output'],
  ['tuner', 'Tuner on'], ['status', 'Status (CPU, clipping, pairing)'],
];

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
    { id: 'd1', name: 'Pedalboard Pi', model: 'pi5', ram: 4, host: 'tonezone.local', ip: '192.168.1.42', link: 'wifi', online: true, version: '0.8.0', os: '64-bit', budget: 70, dsp: 31, cpu: 24, temp: 52, xruns: 0, uptime: 3 * 3600 + 1240, latency: 5.3, banks: demoBanks(), bank: 0, slot: 1 },
    { id: 'd2', name: 'Practice Pi', model: 'pi3bp', ram: 1, host: 'tonezone-3f2a.local', ip: '169.254.12.7', link: 'direct', online: true, version: '0.7.2', os: '64-bit', budget: 65, dsp: 56, cpu: 61, temp: 71, xruns: 2, uptime: 900, latency: 12.4, banks: demoBanks().slice(1), bank: 0, slot: 0 },
    { id: 'd3', name: 'Spare Pi', model: 'pi4', ram: 2, host: 'tonezone-91c0.local', ip: '192.168.1.77', link: 'ethernet', online: false, lastSeen: Date.now() - 2 * 86400e3, version: '0.7.0', os: '64-bit', budget: 70, dsp: 0, cpu: 0, temp: 0, xruns: 0, uptime: 0, banks: [], bank: 0, slot: 0 },
  ];
}
function demoGpio() {
  return {
    pins: {
      11: { type: 'foot', name: 'FS 1', mode: 'momentary', debounce: 20, press: 'slotA', hold: 'bank-' },
      13: { type: 'foot', name: 'FS 2', mode: 'momentary', debounce: 20, press: 'slotB', hold: 'none' },
      15: { type: 'foot', name: 'FS 3', mode: 'momentary', debounce: 20, press: 'slotC', hold: 'none' },
      16: { type: 'foot', name: 'FS 4', mode: 'momentary', debounce: 20, press: 'slotD', hold: 'bank+' },
      29: { type: 'led', name: 'LED A', show: 'slotA', drive: 'pwm', bright: 80, dim: 0 },
      31: { type: 'led', name: 'LED B', show: 'slotB', drive: 'pwm', bright: 80, dim: 0 },
      37: { type: 'led', name: 'Status', show: 'status', drive: 'onoff', bright: 100, dim: 0 },
    },
    adc: 'ads1115',
    expr: [{ ch: 0, name: 'Expression 1', target: 'Volume', heel: 4, toe: 96 }],
    bankWaits: true,
  };
}
export function defaultConfig() {
  return {
    gpio: demoGpio(),
    display: { screen: 'touch7', rotation: 0, brightness: 80, timeout: 0, theme: 'dark', touch: true },
    audio: { input: 'hat-hifiberry', output: 'hat-hifiberry', rate: 48000, buffer: 128, periods: 2, governor: true, isolate: false, server: 'pipewire' },
    updates: { channel: 'stable', auto: false, via: 'network' },
    switching: { preload: true, spillover: true, midi: false },
  };
}
function defaults() {
  return Object.assign({ v: 2, section: 'devices', current: 'd1', devices: demoDevices() }, defaultConfig());
}
export const CONFIG_PARTS = ['gpio', 'display', 'audio', 'updates', 'switching'];

// older saved demo data: cpu meant DSP load, LEDs had no drive mode
function migrate(s) {
  if (!s || typeof s !== 'object' || !Array.isArray(s.devices)) return null;
  if (s.v === 1) {
    for (const d of s.devices) {
      d.dsp = d.cpu || 0;
      d.cpu = d.online ? Math.min(100, d.dsp * 0.8 + 6) : 0;
      d.budget = d.budget || defaultBudget(d.model);
    }
    s.v = 2;
  }
  if (s.v !== 2) return null;
  const def = defaultConfig();
  for (const k of CONFIG_PARTS) if (!s[k]) s[k] = def[k];
  fixDevices(s.devices);
  fixGpio(s.gpio);
  return s;
}
// fill in fields a device may lack (older saves, or a live agent that sends less)
export function fixDevices(list) {
  for (const d of list) {
    if (!MODELS[d.model]) d.model = 'pi4';
    if (!d.budget) d.budget = defaultBudget(d.model);
    for (const k of ['dsp', 'cpu', 'temp', 'xruns', 'uptime']) if (typeof d[k] !== 'number') d[k] = 0;
    if (!Array.isArray(d.banks)) d.banks = [];
    if (typeof d.bank !== 'number') d.bank = 0;
    if (typeof d.slot !== 'number') d.slot = 0;
  }
  return list;
}
export function fixGpio(g) {
  for (const p of Object.values((g && g.pins) || {})) {
    if (p.type !== 'led') continue;
    if (!p.drive) p.drive = 'pwm';
    if (typeof p.bright !== 'number') p.bright = 80;
    if (typeof p.dim !== 'number') p.dim = 0;
  }
  return g;
}

// ---- mode: demo or live
const KEY = 'tz.pi.demo.v1';
const UI_KEY = 'tz.pi.ui.v1';
let store = null; // demo store (saved)
let liveStore = null; // live store (in memory, filled by pi-live.js)
let ui = null; // { demo: true | false | null (auto), order: [ids], section, current }
function uiPrefs() {
  if (ui) return ui;
  try { ui = JSON.parse(localStorage.getItem(UI_KEY) || 'null'); } catch { ui = null; }
  if (!ui || typeof ui !== 'object') ui = { demo: null, order: [], liveSection: 'devices', liveCurrent: null };
  if (!Array.isArray(ui.order)) ui.order = [];
  return ui;
}
const saveUi = () => { try { localStorage.setItem(UI_KEY, JSON.stringify(ui)); } catch { /* not important */ } };

function demoStore() {
  if (store) return store;
  try { store = migrate(JSON.parse(localStorage.getItem(KEY) || 'null')); } catch { store = null; }
  if (!store) store = defaults();
  fixDevices(store.devices);
  return store;
}

// live state, set up by initLive()
const liveState = { api: null, source: null, started: false, found: false, error: null, sent: {} };
export const liveAvailable = () => !!liveState.source;
export const liveFound = () => liveState.found;
export const liveError = () => liveState.error;
export function isLive() {
  const p = uiPrefs();
  if (!liveState.source) return false;
  if (p.demo === true) return false;
  if (p.demo === false) return true;
  return liveState.found; // auto: live once a real Pi shows up
}
export function setDemo(on) {
  uiPrefs().demo = on;
  saveUi();
  bus.emit('pi:mode');
}

export function piStore() {
  if (!isLive()) return demoStore();
  if (!liveStore) {
    const p = uiPrefs();
    liveStore = Object.assign({ v: 2, live: true, section: p.liveSection || 'devices', current: p.liveCurrent, devices: [] }, defaultConfig());
  }
  return liveStore;
}

// Saves the demo store, or in live mode sends whatever changed (config parts, device names, banks, budget, slot).
export function savePi() {
  const s = piStore();
  if (!s.live) {
    try { localStorage.setItem(KEY, JSON.stringify(store)); } catch { /* demo only */ }
    return;
  }
  const p = uiPrefs();
  p.liveSection = s.section;
  p.liveCurrent = s.current;
  saveUi();
  const dev = currentDevice();
  if (!dev) return;
  const sent = liveState.sent;
  for (const part of CONFIG_PARTS) {
    // nothing is sent before the Pi told us its own config
    if (sent[dev.id + ':' + part] === undefined) continue;
    const j = JSON.stringify(s[part]);
    if (sent[dev.id + ':' + part] !== j) { sent[dev.id + ':' + part] = j; act('setConfig', { id: dev.id, part, value: s[part] }); }
  }
  for (const d of s.devices) {
    const was = sent[d.id + ':dev'] || {};
    const now = { name: d.name, budget: d.budget, banks: JSON.stringify(d.banks), sel: d.bank + ':' + d.slot };
    if (was.name !== undefined) {
      if (was.name !== now.name) act('rename', { id: d.id, name: d.name });
      if (was.budget !== now.budget) act('setBudget', { id: d.id, budget: d.budget });
      if (was.banks !== now.banks) act('setBanks', { id: d.id, banks: d.banks });
      if (was.sel !== now.sel) act('select', { id: d.id, bank: d.bank, slot: d.slot });
    }
    sent[d.id + ':dev'] = now;
  }
}
// remember what the Pi already has, so savePi only sends real changes
function markSent(d, cfg) {
  const sent = liveState.sent;
  if (cfg) for (const part of CONFIG_PARTS) if (cfg[part]) sent[d.id + ':' + part] = JSON.stringify(cfg[part]);
  sent[d.id + ':dev'] = { name: d.name, budget: d.budget, banks: JSON.stringify(d.banks), sel: d.bank + ':' + d.slot };
}

export function resetPi() {
  store = defaults();
  try { localStorage.setItem(KEY, JSON.stringify(store)); } catch { /* demo only */ }
}

// devices in the order the user dragged them to
export function orderedDevices(s = piStore()) {
  const order = uiPrefs().order;
  const at = (d) => { const i = order.indexOf(d.id); return i < 0 ? 1e6 + s.devices.indexOf(d) : i; };
  return [...s.devices].sort((a, b) => at(a) - at(b));
}
export function setDeviceOrder(ids) {
  const p = uiPrefs();
  // keep ids from the other mode in place after the ones we know about
  p.order = [...ids, ...p.order.filter((x) => !ids.includes(x))];
  saveUi();
}
export const deviceOrder = () => [...uiPrefs().order];

export const currentDevice = () => { const s = piStore(); return s.devices.find((d) => d.id === s.current) || orderedDevices(s)[0]; };

// Runs an action. Demo mode: returns null and the caller fakes it. Live mode: the promise from pi-live.js.
export function act(action, args = {}) {
  if (!isLive()) return null;
  return liveState.source.call(action, args).catch((e) => {
    piLog(`${action} failed: ${e.message || e}`, 'error');
    bus.emit('pi:error', { action, message: e.message || String(e) });
    throw e;
  });
}

// Starts pi-live.js when the desktop side is there. Safe to call many times.
export async function initLive() {
  if (liveState.started) return;
  liveState.started = true;
  // window.__tzPiLiveMock lets a UI test stand in for pi-live.js
  const mock = window.__tzPiLiveMock;
  const api = (window.tz && window.tz.pi) || (mock && {});
  if (!api) return;
  try {
    const mod = mock || (await import('./pi-live.js'));
    liveState.source = mod.createLive(api);
  } catch (e) {
    liveState.error = 'Could not start the Pi connection: ' + (e.message || e);
    console.warn(liveState.error);
    return;
  }
  const wasLive = isLive();
  try {
    await liveState.source.start(onLive);
  } catch (e) {
    liveState.error = e.message || String(e);
    piLog('Pi discovery failed: ' + liveState.error, 'error');
  }
  if (isLive() !== wasLive) bus.emit('pi:mode');
}
function onLive(ev) {
  if (!ev || !ev.type) return;
  const wasLive = isLive();
  if (ev.type === 'devices') {
    const list = fixDevices((ev.devices || []).map((d) => Object.assign({}, d)));
    if (list.length) liveState.found = true;
    if (isLive() !== wasLive) { liveStore = null; bus.emit('pi:mode'); }
    const s = liveStoreOrNull();
    if (s) {
      // keep the objects the UI holds where we can
      s.devices = list.map((d) => { const old = s.devices.find((x) => x.id === d.id); return old ? Object.assign(old, d) : d; });
      for (const d of s.devices) if (!liveState.sent[d.id + ':dev']) markSent(d);
      if (!s.devices.some((d) => d.id === s.current)) s.current = orderedDevices(s)[0]?.id;
      bus.emit('pi:devices');
    }
    return;
  }
  const s = liveStoreOrNull();
  if (!s) return;
  const d = s.devices.find((x) => x.id === ev.id);
  if (ev.type === 'stats' && d) { Object.assign(d, ev.stats); bus.emit('pi:stats', d); }
  else if (ev.type === 'device' && d) { Object.assign(d, ev.patch); markSent(d); bus.emit('pi:devices'); }
  else if (ev.type === 'config' && d) {
    markSent(d, ev.config);
    if (ev.config.gpio) fixGpio(ev.config.gpio);
    if (d.id === s.current) { for (const k of CONFIG_PARTS) if (ev.config[k]) s[k] = ev.config[k]; bus.emit('pi:config'); }
    (configs[d.id] = configs[d.id] || {}), Object.assign(configs[d.id], ev.config);
  } else if (ev.type === 'log' && ev.line) { logs.push(ev.line); if (logs.length > 500) logs.shift(); bus.emit('pi:log'); }
  else if (ev.type === 'progress') bus.emit('pi:progress', ev);
}
const liveStoreOrNull = () => (isLive() ? piStore() : null);
// config per live device, so switching devices shows the right pins and audio
const configs = {};
export function selectDevice(id) {
  const s = piStore();
  s.current = id;
  if (s.live) {
    const def = defaultConfig();
    for (const k of CONFIG_PARTS) s[k] = (configs[id] && configs[id][k]) || def[k];
  }
  savePi();
}

// ---- logs (kept in memory: demo lines plus whatever the tab does, or the Pi's lines in live mode)
const logs = [];
const t0 = Date.now() - 1000 * 60 * 14;
for (const [dt, lvl, src, msg] of [
  [0, 'info', 'agent', 'tz-agent 0.8.0 starting'], [400, 'info', 'agent', 'mDNS: advertising tonezone.local (_tonezone._tcp, port 7650)'],
  [900, 'info', 'engine', 'JACK: PipeWire 1.2.7, 48000 Hz, 128 frames, RT priority 88'], [1300, 'info', 'engine', 'CPU governor: performance, 2400 MHz'],
  [1700, 'info', 'engine', 'Loaded preset "Modern Metal" (bank 1, B) in 182 ms'], [1800, 'info', 'agent', 'Preloaded 3 presets (A, C, D) for instant switching'],
  [2200, 'info', 'gpio', 'gpiochip0: 4 footswitches, 3 LEDs (2 PWM), ADS1115 at 0x48'], [64000, 'warn', 'engine', 'xrun (1) at 61 C, buffer 128'],
  [128000, 'info', 'agent', 'Desktop "studio-pc" connected (paired)'],
]) logs.push({ t: t0 + dt, lvl, src, msg });
export function piLog(msg, lvl = 'info', src = 'agent') {
  logs.push({ t: Date.now(), lvl, src, msg });
  if (logs.length > 500) logs.shift();
  bus.emit('pi:log');
}
export const piLogs = () => logs;
export function setLogs(list) {
  logs.length = 0;
  logs.push(...list);
  bus.emit('pi:log');
}

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

// ---- compatibility check: per block estimate for every board, and notes
// returns { rows, est: { model: pct }, verdict: { model: 'ok' | 'heavy' | 'bad' }, pi4, pi5, v4, v5 }
export function checkPreset(preset, budget = PI_BUDGET) {
  const rows = [];
  const est = {};
  for (const m of MODEL_IDS) est[m] = FACTORS[m].fixed;
  let nams = 0;
  for (const b of chainOrder(preset)) {
    const d = getDef(b.type);
    const row = { id: b.id, name: d ? d.name : b.type, cat: d ? d.cat : '?', status: 'ok', notes: [], est: {} };
    for (const m of MODEL_IDS) row.est[m] = 0;
    if (!d) { row.status = 'bad'; row.notes.push('Unknown block (is its plugin turned off?). Skipped.'); rows.push(fin(row)); continue; }
    if (!d.algo) { rows.push(fin(Object.assign(row, { status: 'ok', notes: ['No sound processing (looks only).'] }))); continue; }
    if (d.algo === 'extio' || d.cat === 'Device') {
      row.status = 'bad';
      row.notes.push('Needs a USB device on the desktop. Skipped on the Pi, audio passes through.');
      rows.push(fin(row));
      continue;
    }
    const kind = d.algo === 'nam' ? 'nam' : d.algo === 'ir' || d.algo === 'cab' ? 'ir' : 'base';
    const cost = d.cost ?? 0.5;
    for (const m of MODEL_IDS) row.est[m] = cost * FACTORS[m][kind];
    if (d.algo === 'nam') {
      nams++;
      row.notes.push('NAM model is copied with the preset. Lite or Feather models are best on Pi 4, Feather only on Pi 3.');
      if (row.est.pi4 > 40) row.notes.push('A2 Full drops to Lite on Pi 4.');
    }
    if (d.algo === 'ir' || d.algo === 'cab') row.notes.push('IR trimmed to 4096 taps on the Pi (sounds the same), 2048 on Pi 3.');
    if (d.algo === 'pitch') row.notes.push('Adds 10 to 21 ms of latency, same as on the desktop.');
    if (d.algo === 'looper') row.notes.push('Loop time limited to about 60 s on a 1 GB Pi (all Pi 3 boards).');
    if (String(b.type).startsWith('custom:')) row.notes.push('Custom screens are not drawn on the Pi screen.');
    if (row.est.pi4 > 15) row.status = 'heavy';
    for (const m of MODEL_IDS) est[m] += row.est[m];
    rows.push(fin(row));
  }
  // 1 GB of RAM: NAM models are loaded for the current and preloaded presets
  const ramNote = nams > 1 ? `${nams} NAM models: on a 1 GB Pi (Pi 3) keep them Feather or Nano, and turn off instant switching if memory runs short.` : nams ? 'On a 1 GB Pi (Pi 3) use a Feather or Nano NAM model: Standard needs too much CPU and memory.' : '';
  const verdict = {};
  for (const m of MODEL_IDS) verdict[m] = est[m] > budget ? 'bad' : est[m] > budget * 0.8 ? 'heavy' : 'ok';
  return { rows, est, verdict, ramNote, budget, pi4: est.pi4, pi5: est.pi5, v4: verdict.pi4, v5: verdict.pi5 };
}
function fin(row) {
  row.pi4 = row.est.pi4;
  row.pi5 = row.est.pi5;
  return row;
}

export const fmtUptime = (s) => (s < 3600 ? Math.round(s / 60) + ' min' : Math.floor(s / 3600) + ' h ' + Math.round((s % 3600) / 60) + ' min');
export function fmtAgo(t) {
  if (!t) return 'a while ago';
  const s = (Date.now() - t) / 1000;
  return s < 120 ? 'just now' : s < 3600 ? Math.round(s / 60) + ' minutes ago' : s < 86400 * 2 ? Math.round(s / 3600) + ' hours ago' : Math.round(s / 86400) + ' days ago';
}
export const LINKS = { wifi: 'Wi-Fi', ethernet: 'Ethernet', direct: 'Direct cable', manual: 'Manual' };
// latency estimate when the Pi does not report one
export const latencyOf = (d) => d.latency || { pi5: 5.3, pi4: 10.7, pi3bp: 12.4, pi3b: 13.1 }[d.model] || 10;
