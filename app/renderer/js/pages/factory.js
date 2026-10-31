// Pedal Factory tab: design your own pedal, wire its controls to a circuit, test it, and save it as a block.
// The design is kept in memory (and in localStorage when it works). Units are millimetres.
import { el, svg, clamp, toast } from '../util.js';
import { installDefs } from '../gfx/defs.js';
import { materialPicker } from '../ui/material-picker.js';
import { BUTTON_SHAPES, TOGGLE_TIPS } from './factory-parts.js';
import { patternInspector, pruneImages } from './factory-patterns.js';
import {
  SHAPES, FONTS, SCREENS, ART_KINDS, JACKS, shapePoints, roundPoly, jackSpot, artPath, encSpec, isClear, drawJackGfx, drawControl, ctlHalf, renderPedal, thumb, r1,
} from './factory-render.js';
import { STAGES, makeCircuit, migrateCircuit, autoMap, targetsFor, targetInfo, mapTo } from './factory-circuit.js';
import { applyCircuit, renderCircuitPane, wiringSection, expSection, loopSection } from './factory-wiring.js';
import { initCircuitUI, refreshCircuitUI, circuitKeysBusy } from './factory-circuits.js';
import { startTest, stopTest, updateTest, testing, renderPlay, playDown, updateViews, engineRunning, testValues, testInfo, playSet } from './factory-play.js';
import { saveCustomBlock, customBlocks, deleteCustomBlock } from '../catalog/custom.js';
import { state, graphOverridden } from '../state.js';
import { PARTS as VARIANT_PARTS, EXTRA_LAYER_ICONS, NEW_KNOBS, partName, partInspector, extraSections, jackAngleSection, dotsSection, dotsOn } from './factory-extras.js';
import { materialSection } from './factory-matparts.js';
import { controlTile } from './factory-variants.js';
import { migrateCtl } from './factory-kinds.js';
import { openLibrary } from './factory-library.js';
import { jackOnOutline } from './factory-render.js';
import { screenInspector, liveStage } from '../screenscript/factory-ui.js';
import { showcaseTemplates, codedScreen, SYNTH_SCRIPT, ECHO_SCRIPT } from './factory-showcase.js';

const STORE = 'tz.factory.design.v1';
const PREFS = 'tz.factory.prefs.v1';
export const MAX_W = 360; // widest enclosure, mm

// ------------------------------------------------------------------ catalogues
const SIZES = [
  { id: '1590A', w: 39, h: 93, note: 'Mini' },
  { id: '1590B', w: 60, h: 112, note: 'Small' },
  { id: '125B', w: 66, h: 122, note: 'Classic' },
  { id: '1590BB', w: 94, h: 119, note: 'Wide' },
  { id: '1590XX', w: 121, h: 145, note: 'Big box' },
  { id: '1590DD', w: 188, h: 120, note: 'Dual' },
];
const BODY_SWATCHES = ['#1d1f24', '#f2f0ea', '#c9302c', '#e56b1f', '#f2c230', '#3a9a5b', '#1f8a8a', '#2b7bd6', '#5a3fb0', '#d6487e', '#8d99a8', '#8a5a2b'];
const INK_SWATCHES = ['#111111', '#f4f1e8', '#ffffff', '#f2c230', '#c9302c', '#2b7bd6', '#3ddc84', '#8d99a8'];
const LED_COLORS = ['#ff2a1a', '#3ddc84', '#3fa8ff', '#ffb020', '#f4f4ff', '#b45cff'];
const PCB_COLORS = ['#1f6b3a', '#1d3f8a', '#7a1f2a', '#222428', '#c9a14a'];
const KNOB_STYLES = [
  ['boss', 'Skirted'], ['mxr', 'Ribbed'], ['strymon', 'Soft touch'], ['chrome', 'Chrome'], ['fender', 'Chrome ring'],
  ['marshall', 'Gold cap'], ['white', 'White'], ['red', 'Red'], ['cream', 'Cream'], ['chicken', 'Chicken head'], ['vox', 'Pointer'],
  ...NEW_KNOBS,
];
const KNOB_SIZES = [[5.5, 'S'], [8, 'M'], [10.5, 'L'], [13, 'XL']];
const KNOBLIKE = new Set(['knob', 'trim', 'slider', 'pedal']);

// ------------------------------------------------------------------ small helpers
const uid = (p) => p + Math.random().toString(36).slice(2, 8);
const clone = (o) => JSON.parse(JSON.stringify(o));
const lsGet = (k) => {
  try {
    return JSON.parse(localStorage.getItem(k) || 'null');
  } catch (_) {
    return null;
  }
};
const lsSet = (k, v) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch (_) {
    /* storage may be unavailable */
  }
};

// ------------------------------------------------------------------ templates
const txt = (o) => Object.assign({ text: '', font: FONTS[0][0], size: 8, color: '#f4f1e8', weight: 800, ls: 0.6, italic: false, outline: 0, outlineColor: '#111111', x: 0, y: 0, rot: 0, hidden: false, locked: false }, o);
const knob = (x, y, label, o = {}) => Object.assign({ id: uid('k'), kind: 'knob', x, y, style: 'boss', r: 8, value: 0.5, ticks: false, label, labelPos: 'below' }, o);
const stomp = (x, y, o = {}) => Object.assign({ id: uid('f'), kind: 'foot', x, y, style: 'stomp', r: 7, label: '', labelPos: 'none' }, o);
const led = (x, y, color, o = {}) => Object.assign({ id: uid('l'), kind: 'led', x, y, r: 2.5, color, on: true, label: '', labelPos: 'none', bind: 'on' }, o);
const jack = (kind, edge, t, o = {}) => Object.assign({ id: uid('j'), kind, edge, t, label: JACKS[kind].label }, o);
const art = (kind, x, y, w, h, color, o = {}) => Object.assign({ id: uid('a'), kind, x, y, w, h, rot: 0, color, opacity: 1, hidden: false, locked: false }, o);
const toggle = (x, y, ways, opts, o = {}) => Object.assign({ id: uid('t'), kind: 'toggle', x, y, ways, orient: 'v', opts, pos: 0, label: '', labelPos: 'none' }, o);
function base(o) {
  return Object.assign(
    {
      name: 'My pedal',
      enc: { size: '125B', w: 66, h: 122, shape: 'box', radius: 3, finish: 'solid', color: '#1d1f24', color2: '#5a3fb0', angle: 90, flake: 0.5 },
      labels: { font: FONTS[0][0], size: 3.4, color: '#f4f1e8' },
      title: txt({ id: 'title' }),
      sub: txt({ id: 'sub', size: 4.2, weight: 500, ls: 0.3, hidden: true }),
      art: [],
      ctls: [],
      jacks: [],
    },
    o
  );
}
// wire a template: controls carry `to` ('0.gain' = first stage gain), resolved once the circuit exists
function wired(circuitId, d, stageParams = {}) {
  const { circuit } = makeCircuit(circuitId);
  circuit.stages.forEach((s, i) => Object.assign(s.params, stageParams[i] || {}));
  d.circuit = circuit;
  const res = (to) => (!to || to === 'bypass' || to === 'mix' ? to : (circuit.stages[+to.split('.')[0]]?.id || '') + '.' + to.split('.')[1]);
  for (const c of d.ctls) {
    if (c.kind === 'dip' && c.tos) {
      c.maps = c.tos.map((t) => (!t ? null : Array.isArray(t) ? mapTo(circuit, res(t[0]), { min: t[1], max: t[2] }) : mapTo(circuit, res(t))));
      delete c.tos;
    }
    if (c.bindTo) {
      c.bind = c.bindTo.startsWith('tap:') ? 'tap:' + res(c.bindTo.slice(4) + '.x').split('.')[0] : c.bindTo;
      delete c.bindTo;
    }
    if (c.to === undefined) continue;
    const to = res(c.to);
    c.map = to && (to.endsWith('.tap') || to === 'bypass') ? { to } : mapTo(circuit, to, c.vals ? { values: c.vals } : c.kind === 'toggle' || c.kind === 'sel' ? { max: (targetInfo(circuit, to)?.min ?? 0) + (c.ways || c.n || 2) - 1 } : {});
    delete c.to;
    delete c.vals;
  }
  for (const c of d.ctls) if (c.kind === 'foot' && !c.map) c.map = { to: 'bypass' };
  return d;
}
const TEMPLATES = [
  {
    id: 'drive', name: 'Classic Drive', desc: '125B, three knobs, one stomp',
    make: () => wired('overdrive', base({
      name: 'Classic Drive',
      enc: { size: '125B', w: 66, h: 122, shape: 'box', radius: 3, finish: 'solid', color: '#3a9a5b', color2: '#1f8a8a', angle: 90, flake: 0.5 },
      title: txt({ id: 'title', text: 'OVERDRIVE', x: 33, y: 62, size: 8.5 }),
      sub: txt({ id: 'sub', text: 'Classic Drive', font: FONTS[3][0], x: 33, y: 71, size: 5, weight: 700, ls: 0.2 }),
      art: [art('rect', 33, 66, 66, 22, '#2b7444', { opacity: 0.9 })],
      ctls: [knob(13, 22, 'LEVEL', { to: '0.level' }), knob(33, 22, 'TONE', { to: '0.tone' }), knob(53, 22, 'DRIVE', { to: '0.gain' }), led(33, 44, '#ff2a1a'), stomp(33, 100)],
      jacks: [jack('in', 'right', 0.42), jack('out', 'left', 0.42), jack('power', 'top', 0.5)],
    })),
  },
  {
    id: 'boost', name: 'Mini Boost', desc: '1590A, one big knob, sparkle red',
    make: () => wired('boost', base({
      name: 'Mini Boost',
      enc: { size: '1590A', w: 39, h: 93, shape: 'box', radius: 2.5, finish: 'sparkle', color: '#c9302c', color2: '#5a3fb0', angle: 90, flake: 0.6 },
      title: txt({ id: 'title', text: 'BOOST', font: FONTS[1][0], weight: 700, x: 19.5, y: 51, size: 7, ls: 1 }),
      ctls: [knob(19.5, 25, 'LEVEL', { style: 'chrome', r: 10.5, to: '0.level', value: 0.7 }), led(19.5, 62, '#3fa8ff'), stomp(19.5, 77)],
      jacks: [jack('in', 'right', 0.25), jack('out', 'left', 0.25), jack('power', 'top', 0.5)],
    }), [{ gain: 0.7 }]),
  },
  {
    id: 'fuzz', name: 'Fuzz Wedge', desc: 'Wedge shape, hammertone, 3 way toggle',
    make: () => wired('fuzz', base({
      name: 'Fuzz Wedge',
      enc: { size: 'custom', w: 100, h: 120, shape: 'wedge', radius: 5, finish: 'hammer', color: '#c8641e', color2: '#5a3fb0', angle: 90, flake: 0.5 },
      labels: { font: FONTS[0][0], size: 3.6, color: '#111111' },
      title: txt({ id: 'title', text: 'FUZZ', font: FONTS[1][0], weight: 700, x: 50, y: 69, size: 15, color: '#1d1f24', ls: 1.5 }),
      sub: txt({ id: 'sub', text: 'germanium', font: FONTS[3][0], weight: 700, x: 50, y: 80, size: 5, color: '#1d1f24', hidden: false }),
      art: [art('burst', 50, 71, 46, 46, '#f2c230', { opacity: 0.95 }), art('stripes', 50, 113, 100, 6, '#1d1f24')],
      ctls: [
        knob(30, 26, 'FUZZ', { style: 'chicken', r: 9, to: '0.gain', value: 0.65 }), knob(70, 26, 'VOLUME', { style: 'chicken', r: 9, to: '0.level' }),
        toggle(50, 30, 3, ['DARK', 'MID', 'BRT'], { pos: 1, to: '0.tone', vals: [0.2, 0.5, 0.85] }),
        stomp(50, 100, { r: 7.5 }),
      ],
      jacks: [jack('in', 'right', 0.4), jack('out', 'left', 0.4), jack('power', 'top', 0.5)],
    })),
  },
  {
    id: 'delay', name: 'Twin Echo', desc: '1590DD, screen, tap tempo, stereo',
    make: () => wired('delay', base({
      name: 'Twin Echo',
      enc: { size: '1590DD', w: 188, h: 120, shape: 'box', radius: 4, finish: 'brushed', color: '#8d99a8', color2: '#5a3fb0', angle: 90, flake: 0.5 },
      labels: { font: FONTS[0][0], size: 3.6, color: '#111111' },
      title: txt({ id: 'title', text: 'TWIN ECHO', x: 94, y: 97, size: 9, color: '#1d1f24', ls: 1.2 }),
      sub: txt({ id: 'sub', text: 'stereo delay', x: 94, y: 105, size: 3.8, weight: 500, color: '#1d1f24', hidden: false }),
      art: [art('rect', 94, 6, 188, 3, '#1d1f24')],
      ctls: [
        knob(22, 26, 'TIME', { style: 'mxr', to: '0.time', value: 0.55 }), knob(48, 26, 'REPEATS', { style: 'mxr', to: '0.feedback', value: 0.4 }), knob(140, 26, 'MIX', { style: 'mxr', to: '0.mix', value: 0.35 }), knob(166, 26, 'MOD', { style: 'mxr', to: '0.moddepth', value: 0.2 }),
        knob(22, 56, 'TONE', { style: 'mxr', r: 5.5, to: '0.tone', value: 0.6 }), knob(166, 56, 'LEVEL', { style: 'mxr', r: 5.5, to: '0.level' }),
        { id: uid('s'), kind: 'screen', x: 94, y: 27, w: 48, h: 18, type: 'oled', text: 'TIME 420ms\nFDBK 38%', label: '', labelPos: 'none' },
        toggle(94, 56, 2, ['DIG', 'TAPE'], { orient: 'h', pos: 0, to: '0.mode', vals: [0, 2] }),
        led(50, 80, '#3ddc84'), led(138, 80, '#ff2a1a', { bindTo: 'tap:0' }),
        stomp(50, 100, { label: 'BYPASS', labelPos: 'below' }), stomp(138, 100, { label: 'TAP', labelPos: 'below', to: '0.tap' }),
      ],
      jacks: [jack('in', 'right', 0.35), jack('out', 'left', 0.3, { label: 'OUT L' }), jack('stereo', 'left', 0.62), jack('exp', 'top', 0.3), jack('power', 'top', 0.6)],
    })),
  },
  {
    id: 'synth', name: 'Synth Box', desc: '1590XX, colour screen, 8 DIP switches',
    make: () => wired('synth', base({
      name: 'Synth Box',
      enc: { size: '1590XX', w: 121, h: 145, shape: 'box', radius: 6, finish: 'gradient', color: '#5a3fb0', color2: '#d6487e', angle: 120, flake: 0.5 },
      labels: { font: FONTS[4][0], size: 3.2, color: '#ffffff' },
      title: txt({ id: 'title', text: 'SYNTH BOX', font: FONTS[4][0], weight: 400, x: 60.5, y: 108, size: 8, color: '#ffffff', ls: 1.5 }),
      art: [art('wave', 60.5, 109, 150, 18, '#ffffff', { opacity: 0.14, rot: -8 }), art('dots', 100, 120, 26, 26, '#ffffff', { opacity: 0.18 })],
      ctls: [
        { id: uid('s'), kind: 'screen', x: 60.5, y: 25, w: 50, h: 22, type: 'tft', text: 'SAW 440Hz\nCUT 62%', label: '', labelPos: 'none' },
        toggle(17, 25, 3, ['SAW', 'SQR', 'PAD'], { to: '0.mode', vals: [1, 0, 6] }),
        led(104, 25, '#b45cff', { label: 'GATE', labelPos: 'above' }),
        knob(19, 58, 'CUTOFF', { style: 'chrome', ticks: true, to: '0.filter' }), knob(46, 58, 'RES', { style: 'chrome', ticks: true, to: '0.reso', value: 0.4 }),
        knob(75, 58, 'ATTACK', { style: 'chrome', ticks: true, to: '0.attack', value: 0.2 }), knob(102, 58, 'MIX', { style: 'chrome', ticks: true, to: '0.wet', value: 0.8 }),
        { id: uid('d'), kind: 'dip', x: 32, y: 90, n: 8, bits: [0, 0, 1, 0, 0, 0, 1, 1], color: '#c8102e', label: 'VOICE', labelPos: 'below', tos: [['0.octave', 0, -1], ['0.dry', 0, 0.5], ['0.sens', 0.5, 0.8], ['0.reso', 0.4, 0.8], '', '', '', ''] },
        { id: uid('b'), kind: 'button', x: 76, y: 92, r: 4, shape: 'round', color: '#2a2c31', led: true, ledColor: '#3fa8ff', on: false, label: 'SUB', labelPos: 'below', to: '0.octave', vals: [0, -1] },
        { id: uid('b'), kind: 'button', x: 100, y: 92, r: 4, shape: 'round', color: '#2a2c31', led: true, ledColor: '#3fa8ff', on: false, label: 'DRY', labelPos: 'below', to: '0.dry' },
        stomp(32, 124, { label: 'ON', labelPos: 'below' }), stomp(89, 124, { label: 'HOLD', labelPos: 'below', to: '0.attack', vals: [0.2, 1] }),
      ],
      jacks: [jack('in', 'right', 0.3), jack('out', 'left', 0.3), jack('exp', 'top', 0.25), jack('power', 'top', 0.75)],
    })),
  },
  {
    id: 'glass', name: 'Glass Drive', desc: 'Clear acrylic with the circuit board on show',
    make: () => wired('amp', base({
      name: 'Glass Drive',
      enc: { size: '1590B', w: 60, h: 112, shape: 'box', radius: 4, mat: { m: 'acrylic', f: 'clear', c: '#5fc9d6' }, pcb: true },
      labels: { font: FONTS[0][0], size: 3.2, color: '#f4f1e8' },
      title: txt({ id: 'title', text: 'GLASS', font: FONTS[1][0], weight: 700, x: 30, y: 80, size: 8, ls: 2, outline: 0.25, outlineColor: '#111111' }),
      ctls: [
        knob(15, 16, 'GAIN', { r: 5.5, style: 'chrome', to: '0.gain' }), knob(45, 16, 'LEVEL', { r: 5.5, style: 'chrome', to: '0.level' }),
        knob(11, 36, 'BASS', { r: 5.5, style: 'chrome', to: '0.bass' }), knob(30, 36, 'MID', { r: 5.5, style: 'chrome', to: '0.mid' }), knob(49, 36, 'TREBLE', { r: 5.5, style: 'chrome', to: '0.treble' }),
        led(30, 66, '#3fa8ff'), stomp(30, 94),
      ],
      jacks: [jack('in', 'right', 0.52), jack('out', 'left', 0.52), jack('power', 'top', 0.5)],
    })),
  },
  {
    id: 'wah', name: 'Wah Wah', desc: 'A treadle you rock with your foot',
    make: () => wired('wah', base({
      name: 'Wah Wah',
      enc: { size: 'custom', w: 100, h: 200, shape: 'pill', radius: 3, mat: { m: 'metal', s: 'aluminium', f: 'hammertone', c: '#222428' } },
      labels: { font: FONTS[0][0], size: 3.4, color: '#f4f1e8' },
      title: txt({ id: 'title', text: 'WAH', font: FONTS[3][0], weight: 700, x: 50, y: 186, size: 9, ls: 0.5 }),
      ctls: [
        { id: uid('p'), kind: 'pedal', x: 50, y: 92, w: 76, h: 140, value: 0.5, color: '#1b1c1f', logo: 'cry baby', label: '', labelPos: 'none', to: '0.pos' },
        knob(84, 176, 'Q', { r: 5.5, style: 'mxr', to: '0.q' }), led(16, 176, '#ff2a1a'), stomp(50, 172, { r: 5.5, style: 'soft' }),
      ],
      jacks: [jack('in', 'right', 0.25), jack('out', 'left', 0.25), jack('power', 'top', 0.5)],
    })),
  },
  {
    id: 'shoegaze', name: 'Shoegaze Stack', desc: 'Fuzz, chorus and a huge reverb',
    make: () => wired('shoegaze', base({
      name: 'Shoegaze Stack',
      enc: { size: 'custom', w: 140, h: 130, shape: 'tower', radius: 4, mat: { m: 'metal', s: 'aluminium', f: 'flake', c: '#d6487e' } },
      labels: { font: FONTS[0][0], size: 3.4, color: '#f4f1e8' },
      title: txt({ id: 'title', text: 'DREAMSTACK', font: FONTS[1][0], weight: 700, x: 70, y: 84, size: 9, ls: 1.2 }),
      art: [art('wave', 70, 84, 140, 22, '#5a3fb0', { opacity: 0.55 })],
      ctls: [
        knob(26, 36, 'FUZZ', { to: '0.gain', value: 0.7 }), knob(50, 36, 'TONE', { to: '0.tone' }), knob(70, 14, 'LEVEL', { r: 5.5, to: '0.level' }),
        knob(90, 36, 'WOBBLE', { to: '1.depth' }), knob(114, 36, 'WASH', { to: '2.mix', value: 0.5 }),
        led(38, 100, '#ff2a1a', { bindTo: 'fz0' }), led(102, 100, '#3fa8ff', { bindTo: 'fz1' }),
        stomp(38, 114, { label: 'FUZZ', labelPos: 'none', to: '0.on' }), stomp(102, 114, { label: 'WASH', labelPos: 'none', to: '2.on' }),
      ],
      jacks: [jack('in', 'right', 0.5), jack('out', 'left', 0.5), jack('phones', 'top', 0.35), jack('power', 'top', 0.65)],
    }), [{ gain: 0.7 }, { mix: 0.4 }, { mode: 5, decay: 0.8, mix: 0.5 }]),
  },
  {
    id: 'ambient', name: 'Ambient Cloud', desc: 'Swell, echo and a cloud reverb, XLR out',
    make: () => wired('ambient', base({
      name: 'Ambient Cloud',
      enc: { size: 'custom', w: 110, h: 140, shape: 'hex', radius: 4, mat: { m: 'metal', s: 'aluminium', f: 'powder', c: '#f2f0ea' } },
      labels: { font: FONTS[2][0], size: 3.2, color: '#1d1f24' },
      title: txt({ id: 'title', text: 'cloud', font: FONTS[3][0], weight: 700, x: 55, y: 82, size: 14, color: '#2b7bd6', ls: 0.5 }),
      art: [art('circle', 55, 80, 70, 38, '#2b7bd6', { opacity: 0.12 })],
      ctls: [
        knob(33, 38, 'SWELL', { r: 6.5, style: 'white', to: '0.attack' }), knob(55, 30, 'TIME', { r: 6.5, style: 'white', to: '1.time', value: 0.6 }), knob(77, 38, 'REPEATS', { r: 6.5, style: 'white', to: '1.feedback' }),
        knob(55, 54, 'SPACE', { r: 6.5, style: 'white', to: '2.mix', value: 0.55 }),
        led(55, 98, '#3fa8ff'), stomp(55, 114, { style: 'soft', r: 6.5 }),
      ],
      jacks: [jack('in', 'right', 0.5), jack('out', 'left', 0.45), jack('xlr', 'left', 0.65), jack('power', 'top', 0.5)],
    })),
  },
  {
    id: 'chorus', name: 'Drop Chorus', desc: 'Teardrop shape, two knobs and a slider',
    make: () => wired('chorus', base({
      name: 'Drop Chorus',
      enc: { size: 'custom', w: 80, h: 128, shape: 'drop', radius: 2, mat: { m: 'metal', s: 'aluminium', f: 'anodized', c: '#1f8a8a' } },
      labels: { font: FONTS[0][0], size: 3.2, color: '#f4f1e8' },
      title: txt({ id: 'title', text: 'DROP', font: FONTS[1][0], weight: 700, x: 40, y: 64, size: 8, ls: 2 }),
      ctls: [
        knob(26, 84, 'RATE', { r: 6.5, to: '0.rate', value: 0.35 }), knob(54, 84, 'DEPTH', { r: 6.5, to: '0.depth' }),
        { id: uid('v'), kind: 'slider', x: 40, y: 40, h: 22, w: 5, orient: 'v', value: 0.5, label: 'MIX', labelPos: 'below', to: '0.mix' },
        led(40, 100, '#3fa8ff'), stomp(40, 112, { r: 5.5 }),
      ],
      jacks: [jack('in', 'right', 0.62), jack('out', 'left', 0.62), jack('power', 'top', 0.5)],
    })),
  },
  {
    id: 'octo', name: 'Octo Fuzz', desc: 'Octagon, fuzz with an octave beside it',
    make: () => wired('blend', base({
      name: 'Octo Fuzz',
      enc: { size: 'custom', w: 104, h: 104, shape: 'oct', radius: 3, mat: { m: 'metal', s: 'aluminium', f: 'hammertone', c: '#5a3fb0' } },
      labels: { font: FONTS[0][0], size: 3.4, color: '#f4f1e8' },
      title: txt({ id: 'title', text: 'OCTO', font: FONTS[1][0], weight: 700, x: 52, y: 58, size: 10, ls: 2 }),
      ctls: [
        knob(30, 24, 'FUZZ', { r: 6.5, to: '0.gain', value: 0.65 }), knob(52, 18, 'MIX', { r: 5.5, to: 'mix', value: 1 }), knob(74, 24, 'OCTAVE', { r: 6.5, to: '1.lvl', value: 0.4 }),
        { id: uid('r'), kind: 'sel', x: 52, y: 38, n: 3, r: 5, style: 'boss', opts: ['1', '2', '3'], pos: 1, label: '', labelPos: 'none', to: '0.tone', vals: [0.25, 0.5, 0.8] },
        { id: uid('m'), kind: 'trim', x: 84, y: 52, r: 2.5, value: 0.5, color: '#2b6fd6', label: 'BIAS', labelPos: 'below', to: '0.sag' },
        led(52, 72, '#b45cff'), stomp(52, 86, { r: 6.5 }),
      ],
      jacks: [jack('in', 'right', 0.5), jack('out', 'left', 0.5), jack('exp', 'top', 0.3), jack('power', 'top', 0.7)],
    })),
  },
  {
    id: 'lab', name: 'DIP Lab', desc: '12 DIP switches, each one wired to something',
    make: () => wired('drivedelay', base({
      name: 'DIP Lab',
      enc: { size: '1590BB', w: 94, h: 119, shape: 'chamfer', radius: 2, mat: { m: 'metal', s: 'aluminium', f: 'powder', c: '#1d1f24' } },
      labels: { font: FONTS[4][0], size: 3, color: '#3ddc84' },
      title: txt({ id: 'title', text: 'DIP LAB', font: FONTS[4][0], weight: 400, x: 47, y: 74, size: 7, color: '#3ddc84', ls: 1.5 }),
      ctls: [
        knob(18, 20, 'DRIVE', { r: 6.5, to: '0.gain' }), knob(38, 20, 'LEVEL', { r: 6.5, to: '0.level' }), knob(58, 20, 'TIME', { r: 6.5, to: '1.time' }), knob(78, 20, 'MIX', { r: 6.5, to: '1.mix' }),
        { id: uid('d'), kind: 'dip', x: 47, y: 50, n: 12, bits: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1], color: '#1f4fbf', label: 'MODES', labelPos: 'below',
          tos: [['0.bright', 0, 1], ['0.blend', 1, 0.6], ['0.sag', 0, 0.6], ['0.tone', 0.5, 0.8], ['1.mode', 0, 2], ['1.feedback', 0.35, 0.7], ['1.moddepth', 0, 0.5], ['1.tone', 0.6, 0.3], ['1.modrate', 0.3, 0.7], ['1.subdiv', 0, 2], ['1.level', 0.5, 0.8], ['0.on', 0, 1]] },
        led(26, 88, '#3ddc84'), led(68, 88, '#3ddc84', { bindTo: 'tap:1' }),
        stomp(26, 102, { r: 6.5 }), stomp(68, 102, { r: 6.5, to: '1.tap', label: 'TAP', labelPos: 'below' }),
      ],
      jacks: [jack('in', 'right', 0.3), jack('out', 'left', 0.3), jack('phones', 'top', 0.3), jack('power', 'top', 0.7)],
    })),
  },
  {
    id: 'blank', name: 'Blank', desc: 'Black 125B with a stomp',
    make: () => wired('overdrive', base({
      title: txt({ id: 'title', text: 'MY PEDAL', x: 33, y: 52, size: 9 }),
      ctls: [stomp(33, 100)],
      jacks: [jack('in', 'right', 0.3), jack('out', 'left', 0.3), jack('power', 'top', 0.5)],
    })),
  },
];
// coded screens for Twin Echo and Synth Box, and the showcase templates (factory-showcase.js)
for (const t of TEMPLATES) {
  const code = { delay: ECHO_SCRIPT, synth: SYNTH_SCRIPT }[t.id];
  const mk = t.make;
  if (code) t.make = () => codedScreen(mk(), code);
}
TEMPLATES.splice(TEMPLATES.findIndex((t) => t.id === 'blank'), 0, ...showcaseTemplates({ base, txt, knob, stomp, led, jack, art, toggle, FONTS }));
// LEDs that follow a footswitch: 'fz0' = the first footswitch
for (const t of TEMPLATES) {
  const mk = t.make;
  t.make = () => {
    const d = mk();
    const foots = d.ctls.filter((c) => c.kind === 'foot');
    for (const c of d.ctls) if (c.kind === 'led' && /^fz\d$/.test(c.bind || '')) c.bind = foots[+c.bind.slice(2)] ? 'ctl:' + foots[+c.bind.slice(2)].id : 'on';
    return d;
  };
}

// ------------------------------------------------------------------ editor state
let D = null; // the design
let sel = null; // primary selection: 'enc', 'title', 'sub', or an item id
const sels = new Set(); // every selected id (multi-select)
let built = false;
const hist = { stack: [], idx: -1 };
const prefs = Object.assign({ grid: 2.5, showGrid: true, tab: 'parts', mirror: { on: false, axis: 'v' } }, lsGet(PREFS) || {});
if (!prefs.mirror) prefs.mirror = { on: false, axis: 'v' };
const view = { z: 4, x: 0, y: 0, touched: false };
const ui = {};
let guides = [];
let marquee = null;
let openStage = null;

function savePrefs() {
  lsSet(PREFS, prefs);
}
function find(id) {
  if (!id || !D) return null;
  if (id === 'enc') return { kind: 'enc', item: D.enc };
  if (id === 'title' || id === 'sub') return { kind: 'text', item: D[id] };
  for (const [kind, list] of [['art', D.art], ['ctl', D.ctls], ['jack', D.jacks]]) {
    const i = list.findIndex((x) => x.id === id);
    if (i >= 0) return { kind, item: list[i], list, index: i };
  }
  return null;
}
const selItems = () => [...sels].map(find).filter((f) => f && f.kind !== 'enc');
const typeKey = (f) => (f.kind === 'ctl' ? 'ctl:' + f.item.kind + (f.item.part ? ':' + f.item.part : '') + (f.item.kind === 'xy' ? ':' + (f.item.look || 'pad') : '') : f.kind);
function commit() {
  const s = JSON.stringify(D);
  if (hist.stack[hist.idx] === s) return;
  hist.stack.length = hist.idx + 1;
  hist.stack.push(s);
  if (hist.stack.length > 300) hist.stack.shift();
  hist.idx = hist.stack.length - 1;
  lsSet(STORE, D);
  updateUndo();
  if (testing()) updateTest(D);
}
function restore(i) {
  hist.idx = i;
  D = JSON.parse(hist.stack[i]);
  for (const id of [...sels]) if (!find(id)) sels.delete(id);
  if (sel && !find(sel)) sel = [...sels].pop() || null;
  lsSet(STORE, D);
  if (testing()) updateTest(D);
  refreshAll();
}
function undo() {
  if (JSON.stringify(D) !== hist.stack[hist.idx]) commit();
  if (hist.idx > 0) restore(hist.idx - 1);
}
function redo() {
  if (hist.idx < hist.stack.length - 1) restore(hist.idx + 1);
}
function updateUndo() {
  if (!ui.undo) return;
  ui.undo.disabled = hist.idx <= 0;
  ui.redo.disabled = hist.idx >= hist.stack.length - 1;
}
// mode: undefined = only this, 'toggle' = add or remove (shift / ctrl click), 'add'
function select(id, mode) {
  if (mode && id && id !== 'enc' && !(sel === 'enc')) {
    if (mode === 'toggle' && sels.has(id)) {
      sels.delete(id);
      sel = sel === id ? [...sels].pop() || null : sel;
    } else {
      sels.add(id);
      sel = id;
    }
  } else {
    if (id === sel && sels.size <= 1) return;
    sels.clear();
    if (id) sels.add(id);
    sel = id;
  }
  refreshSel();
}
function selectMany(ids, add) {
  if (!add) sels.clear();
  ids.forEach((i) => sels.add(i));
  sel = ids.length ? ids[ids.length - 1] : add ? sel : null;
  if (!sels.size) sel = null;
  refreshSel();
}
function refreshSel() {
  renderStage();
  renderInspector();
  renderLayers();
  if (prefs.tab === 'circuit') renderCircuit();
}
function refreshAll() {
  if (ui.name) ui.name.value = D.name;
  renderStage();
  renderInspector();
  renderLayers();
  renderParts();
  renderCircuit();
  updateUndo();
  updateBar();
}
// after an edit: live edits only repaint, final ones are committed
function changed(live) {
  mirrorSync(selItems());
  if (testing() && live) updateTest(D);
  renderStage();
  if (!live) {
    commit();
    renderLayers();
  }
}

function migrateDesign(d) {
  if (!d || !d.enc) return d;
  if (!d.enc.mat) d.enc.mat = encSpec(d.enc);
  if (!Array.isArray(d.enc.patterns)) d.enc.patterns = [];
  if (d.enc.showThrough == null) d.enc.showThrough = 0.3;
  if (!d.title) d.title = txt({ id: 'title' });
  if (!d.sub) d.sub = txt({ id: 'sub', size: 4.2, weight: 500, ls: 0.3, hidden: true });
  for (const k of ['art', 'ctls', 'jacks']) if (!Array.isArray(d[k])) d[k] = [];
  for (const c of d.ctls) migrateCtl(c); // removed parts, toggle bank, knob skirts (factory-kinds.js)
  for (const c of d.ctls) if (c.kind === 'dip') c.n = clamp(c.n || 4, 2, 12);
  if (migrateCircuit(d)) autoMap(d);
  return d;
}
function loadDesign(d, keepHistory) {
  D = migrateDesign(d);
  sel = null;
  sels.clear();
  if (!keepHistory) {
    hist.stack = [];
    hist.idx = -1;
  }
  commit();
  view.touched = false;
  fit();
  refreshAll();
}
// ------------------------------------------------------------------ mirror mode
const MIR = () => prefs.mirror;
const vAxis = () => MIR().axis !== 'h';
const mirrorEdge = (e) => (vAxis() ? { left: 'right', right: 'left' }[e] || e : { top: 'bottom', bottom: 'top' }[e] || e);
const SIZE_KEYS = ['r', 'w', 'h', 'size'];
function applyMirror(f, tw) {
  const it = f.item, W = D.enc.w, H = D.enc.h;
  if (f.kind === 'jack') {
    tw.edge = mirrorEdge(it.edge);
    tw.angle = typeof it.angle === 'number' ? (((vAxis() ? 180 - it.angle : -it.angle) % 360) + 360) % 360 : undefined;
    const flipT = vAxis() ? it.edge === 'top' || it.edge === 'bottom' : it.edge === 'left' || it.edge === 'right';
    tw.t = flipT ? Math.round((1 - it.t) * 1000) / 1000 : it.t;
    return;
  }
  tw.x = vAxis() ? r1(W - it.x) : it.x;
  tw.y = vAxis() ? it.y : r1(H - it.y);
  for (const k of SIZE_KEYS) if (it[k] !== undefined) tw[k] = it[k];
  if (it.rot !== undefined) tw.rot = it.rot ? -it.rot : 0;
}
function mirrorSync(items) {
  if (!MIR().on) return;
  const done = new Set();
  for (const f of items) {
    const it = f.item;
    if (!it || !it.twin || done.has(it.id)) continue;
    const t = find(it.twin);
    if (!t || t.kind !== f.kind) {
      delete it.twin;
      continue;
    }
    done.add(it.id);
    done.add(t.item.id);
    applyMirror(f, t.item);
  }
}
// on the mirror axis there is nothing to mirror
function onAxis(f) {
  const it = f.item;
  if (f.kind === 'jack') return vAxis() ? (it.edge === 'top' || it.edge === 'bottom') && Math.abs(it.t - 0.5) < 0.04 : (it.edge === 'left' || it.edge === 'right') && Math.abs(it.t - 0.5) < 0.04;
  return vAxis() ? Math.abs(it.x - D.enc.w / 2) < 1.5 : Math.abs(it.y - D.enc.h / 2) < 1.5;
}
function makeTwin(f) {
  if (!f.list || f.item.twin || onAxis(f)) return null;
  const c = clone(f.item);
  c.id = uid(f.item.id[0]);
  if (f.kind === 'ctl') {
    if (c.map && c.map.to && c.map.to !== 'bypass') {
      c.map = nextMap(c.kind, c.id);
      const info = targetInfo(D.circuit, c.map.to);
      if (KNOBLIKE.has(c.kind) && c.label) c.label = info ? (info.label || '').toUpperCase().slice(0, 10) : '';
    }
    if (c.kind === 'dip' || c.kind === 'xy') c.maps = [];
  }
  f.item.twin = c.id;
  c.twin = f.item.id;
  f.list.splice(f.index + 1, 0, c);
  applyMirror(f, c);
  return c;
}
// pairs existing items that already sit at mirrored spots
function autoPair() {
  for (const [kind, list] of [['art', D.art], ['ctl', D.ctls], ['jack', D.jacks]])
    for (const a of list) {
      if (a.twin) continue;
      const fa = { kind, item: a };
      if (onAxis(fa)) continue;
      const want = {};
      applyMirror(fa, want);
      const b = list.find((o) => o !== a && !o.twin && o.kind === a.kind && (kind === 'jack' ? o.edge === want.edge && Math.abs(o.t - want.t) < 0.03 : Math.hypot(o.x - want.x, o.y - want.y) < 2));
      if (b) {
        a.twin = b.id;
        b.twin = a.id;
      }
    }
}
function setMirror(on, axis) {
  if (axis && axis !== MIR().axis) {
    for (const list of [D.art, D.ctls, D.jacks]) for (const it of list) delete it.twin;
    MIR().axis = axis;
  }
  MIR().on = on;
  savePrefs();
  if (on) autoPair();
  commit();
  updateBar();
  renderStage();
  renderInspector();
}

// ------------------------------------------------------------------ adding and removing parts
function usedTargets() {
  const s = new Set();
  for (const c of D.ctls) {
    if (c.map && c.map.to) s.add(c.map.to);
    for (const m of c.maps || []) if (m && m.to) s.add(m.to);
  }
  return s;
}
// the first circuit value nothing drives yet, for a new control
function nextMap(kind, selfId) {
  const C = D.circuit;
  const used = usedTargets();
  if (kind === 'foot') {
    if (!D.ctls.some((c) => c.id !== selfId && c.kind === 'foot' && (!c.map || c.map.to === 'bypass'))) return { to: 'bypass' };
    const t = targetsFor(C, 'foot').find((x) => (x[0].endsWith('.on') || x[0].endsWith('.tap')) && !used.has(x[0]));
    return t ? mapTo(C, t[0]) : { to: '' };
  }
  const list = targetsFor(C, kind).filter((t) => t[2] && !used.has(t[0]) && !t[0].endsWith('.on') && !t[0].endsWith('.lvl'));
  let t;
  if (KNOBLIKE.has(kind)) t = list.find((x) => !x[2].i);
  else if (kind === 'toggle' || kind === 'sel') t = list.find((x) => x[2].i && x[2].opts);
  else if (kind === 'button') t = targetsFor(C, 'button').find((x) => x[0].endsWith('.on') && !used.has(x[0]));
  return t ? mapTo(C, t[0]) : { to: '' };
}
// the palette: every control type with its variants (factory-variants.js)
const PARTS = VARIANT_PARTS;

function freeSpot(c, d = D, o = {}) {
  const W = d.enc.w, H = d.enc.h;
  const [hw, hh] = ctlHalf(c);
  let best = null;
  const maxX = o.half ? W / 2 - hw - 1 : W - hw - 3;
  const maxY = o.halfY ? H / 2 - hh - 1 : H - hh - 4;
  // first try to keep clear of the printed text, then allow overlapping it
  for (const avoidText of [true, false]) {
    if (best) break;
    for (let y = hh + 4; y <= maxY; y += 2)
      for (let x = hw + 3; x <= maxX; x += 2) {
        const ok = d.ctls.every((q) => {
          if (q === c || q.hidden || q.x == null) return true;
          const [qw, qh] = ctlHalf(q);
          return Math.abs(q.x - x) > hw + qw + 2 || Math.abs(q.y - y) > hh + qh + 2;
        });
        if (!ok) continue;
        const onText = [d.title, d.sub].some((t) => !t.hidden && t.text && Math.abs(y - t.y) < t.size * 0.7 + hh && Math.abs(x - t.x) < (t.text.length * t.size * 0.55) / 2 + hw);
        if (avoidText && onText) continue;
        const score = Math.abs(x - (o.half ? W * 0.3 : W / 2)) * 0.6 + Math.abs(y - (o.halfY ? H * 0.25 : H * 0.4));
        if (!best || score < best.score) best = { x, y, score };
      }
  }
  const p = best || { x: o.half ? W * 0.3 : W / 2, y: H / 2 };
  return { x: snap(p.x), y: snap(p.y) };
}
// snaps to the nearest point of the outline (factory-render.js)
function jackAt(p) {
  return jackOnOutline(D, p, prefs.grid);
}
function addPart(kind, payload, at) {
  let item;
  const mir = MIR().on;
  if (kind === 'art') {
    const big = payload === 'stripe' || payload === 'stripes' || payload === 'wave';
    const s = Math.min(D.enc.w, D.enc.h) * 0.4;
    item = art(payload, at ? at.x : D.enc.w / 2, at ? at.y : D.enc.h / 2, big ? D.enc.w : s, big ? Math.max(8, s * 0.45) : s, payload === 'dots' ? '#ffffff' : '#f2c230', { opacity: payload === 'dots' ? 0.4 : 1 });
    D.art.push(item);
  } else if (kind === 'jack') {
    const used = D.jacks.filter((j) => j.edge === JACKS[payload].edge).length;
    const pos = at ? jackAt(at) : { edge: JACKS[payload].edge, t: clamp((mir && vAxis() && JACKS[payload].edge === 'top' ? 0.25 : 0.3) + used * 0.3, 0.1, 0.9) };
    item = jack(payload, pos.edge, pos.t);
    if (payload === 'exp') item.drive = '';
    D.jacks.push(item);
  } else {
    item = PARTS[payload].make(D);
    const p = at ? { x: snap(at.x), y: snap(at.y) } : freeSpot(item, D, { half: mir && vAxis(), halfY: mir && !vAxis() });
    item.x = p.x;
    item.y = p.y;
    if (item.kind === 'pedal' && !at) Object.assign(item, { x: snap(D.enc.w / 2), y: snap(D.enc.h * 0.55) });
    D.ctls.push(item);
    if (item.kind === 'dip') item.maps = [];
    else if (item.kind === 'xy') {
      item.maps = [];
      item.maps.push(nextMap('knob', item.id));
      item.maps.push(nextMap('knob', item.id));
    }
    else if (item.kind !== 'led' && item.kind !== 'screen') {
      item.map = nextMap(item.kind, item.id);
      const info = targetInfo(D.circuit, item.map.to);
      if (KNOBLIKE.has(item.kind) && info && !item.label && item.kind !== 'pedal') item.label = (info.label || '').toUpperCase().slice(0, 10);
      if ((item.kind === 'toggle' || item.kind === 'sel') && info && info.opts) {
        const n = item.kind === 'toggle' ? item.ways : item.n;
        item.opts = info.opts.slice(0, n).map((o) => o.toUpperCase().slice(0, 5));
        item.map.max = Math.min(info.max, info.min + n - 1);
      }
    }
  }
  const f = find(item.id);
  const tw = mir ? makeTwin(f) : null;
  sels.clear();
  sels.add(item.id);
  sel = item.id;
  if (tw) sels.add(tw.id);
  commit();
  renderStage();
  renderInspector();
  renderLayers();
}
function removeSel() {
  const items = sels.size ? selItems() : [];
  if (!items.length) return;
  const gone = new Set(items.map((f) => f.item.id));
  if (MIR().on) for (const f of items) if (f.item.twin) gone.add(f.item.twin);
  for (const f of items) if (f.kind === 'text') f.item.hidden = true;
  D.art = D.art.filter((x) => !gone.has(x.id));
  D.ctls = D.ctls.filter((x) => !gone.has(x.id));
  D.jacks = D.jacks.filter((x) => !gone.has(x.id));
  for (const list of [D.art, D.ctls, D.jacks]) for (const it of list) if (it.twin && gone.has(it.twin)) delete it.twin;
  sel = null;
  sels.clear();
  commit();
  renderStage();
  renderInspector();
  renderLayers();
}
function duplicateSel() {
  const items = selItems().filter((f) => f.list);
  if (!items.length) return;
  const ids = [];
  for (const f0 of items) {
    const f = find(f0.item.id);
    const c = clone(f.item);
    c.id = uid(f.item.id[0]);
    delete c.twin;
    if (f.kind === 'jack') c.t = clamp(c.t + 0.15, 0.06, 0.94);
    else {
      c.x += 6;
      c.y += 6;
    }
    if (f.kind === 'ctl' && c.map && c.map.to !== 'bypass') c.map = nextMap(c.kind, c.id);
    f.list.splice(f.index + 1, 0, c);
    ids.push(c.id);
  }
  sels.clear();
  ids.forEach((i) => sels.add(i));
  sel = ids[ids.length - 1];
  commit();
  renderStage();
  renderInspector();
  renderLayers();
}
function moveOrder(id, dir) {
  const f = find(id);
  if (!f || !f.list) return;
  const j = f.index + dir;
  if (j < 0 || j >= f.list.length) return;
  const [it] = f.list.splice(f.index, 1);
  f.list.splice(j, 0, it);
  commit();
  renderStage();
  renderLayers();
}
// align or space out the selected items (by their centres)
function align(how) {
  const items = selItems().filter((f) => f.kind !== 'jack' && !f.item.locked);
  if (items.length < 2) return;
  const xs = items.map((f) => f.item.x), ys = items.map((f) => f.item.y);
  const set = (k, v) => items.forEach((f) => (f.item[k] = r1(v)));
  if (how === 'left') set('x', Math.min(...xs));
  else if (how === 'right') set('x', Math.max(...xs));
  else if (how === 'cx') set('x', (Math.min(...xs) + Math.max(...xs)) / 2);
  else if (how === 'top') set('y', Math.min(...ys));
  else if (how === 'bottom') set('y', Math.max(...ys));
  else if (how === 'cy') set('y', (Math.min(...ys) + Math.max(...ys)) / 2);
  else if (how === 'dx' || how === 'dy') {
    const k = how === 'dx' ? 'x' : 'y';
    const s = [...items].sort((a, b) => a.item[k] - b.item[k]);
    const a = s[0].item[k], b = s[s.length - 1].item[k];
    s.forEach((f, i) => (f.item[k] = r1(a + ((b - a) * i) / (s.length - 1))));
  }
  changed(false);
  renderInspector();
}

// ------------------------------------------------------------------ stage, view and pointer handling
const snap = (v, alt) => (prefs.grid && !alt ? Math.round(v / prefs.grid) * prefs.grid : v);
function toPedal(e) {
  const r = ui.stage.getBoundingClientRect();
  return { x: (e.clientX - r.left - view.x) / view.z, y: (e.clientY - r.top - view.y) / view.z };
}
function applyView() {
  ui.viewG.setAttribute('transform', `translate(${r1(view.x)},${r1(view.y)}) scale(${view.z.toFixed(4)})`);
  ui.zoomVal.textContent = Math.round((view.z / 4) * 100) + '%';
  ui.stageWrap.classList.toggle('touched', view.touched);
}
function fit() {
  if (!ui.stage) return;
  const r = ui.stage.getBoundingClientRect();
  if (!r.width || !r.height) return;
  const W = D.enc.w + 30, H = D.enc.h + 44;
  view.z = clamp(Math.min(r.width / W, r.height / H) * 0.86, 0.5, 40);
  view.x = r.width / 2 - (D.enc.w / 2) * view.z;
  view.y = r.height / 2 - (D.enc.h / 2 + 4) * view.z;
  applyView();
}
function zoomAt(f, cx, cy) {
  const r = ui.stage.getBoundingClientRect();
  if (cx == null) {
    cx = r.width / 2;
    cy = r.height / 2;
  }
  const z = clamp(view.z * f, 0.6, 48);
  const px = (cx - view.x) / view.z, py = (cy - view.y) / view.z;
  view.z = z;
  view.x = cx - px * z;
  view.y = cy - py * z;
  view.touched = true;
  applyView();
  renderOverlay();
}

function renderStage() {
  if (!ui.pedalG || !D) return;
  ui.pedalG.textContent = '';
  if (testing()) renderPlay(ui.pedalG, D);
  else renderPedal(ui.pedalG, D, { edit: true, grid: prefs.showGrid ? prefs.grid || 0 : 0 });
  liveStage(ui.pedalG, D, testing() ? 'test' : 'edit'); // live custom screens
  ui.stageWrap.classList.toggle('has-sel', !!sel);
  renderOverlay();
  renderDims();
  renderStatus();
  refreshCircuitUI(); // wiring diagram follows the design
}
function renderDims() {
  const g = ui.dimsG;
  g.textContent = '';
  const W = D.enc.w, H = D.enc.h;
  const y = H + 11;
  svg('path', { d: `M0,${y - 2}V${y + 2}M0,${y}H${W}M${W},${y - 2}V${y + 2}`, class: 'fz-dimline' }, g);
  svg('text', { x: W / 2, y: y + 5.5, 'text-anchor': 'middle', class: 'fz-dimtext' }, g, `${r1(W)} x ${r1(H)} mm${D.enc.size !== 'custom' ? ' · ' + D.enc.size : ''}`);
  const x = W + 11;
  svg('path', { d: `M${x - 2},0H${x + 2}M${x},0V${H}M${x - 2},${H}H${x + 2}`, class: 'fz-dimline' }, g);
}
function selBox(g, f, single) {
  const it = f.item;
  if (it.hidden) return;
  const target = ui.pedalG.querySelector(`[data-sel="${CSS.escape(it.id || f.item.id)}"]`) || (f.kind === 'text' ? ui.pedalG.querySelector(`[data-sel="${f.item === D.title ? 'title' : 'sub'}"]`) : null);
  if (!target) return;
  let bb;
  try {
    bb = target.getBBox();
  } catch (_) {
    return;
  }
  const og = svg('g', { transform: target.getAttribute('transform') || '' }, g);
  const pad = 1.2;
  let box = { x: bb.x - pad, y: bb.y - pad, w: bb.width + pad * 2, h: bb.height + pad * 2 };
  if (f.kind === 'art') box = { x: -it.w / 2, y: -it.h / 2, w: it.w, h: it.h };
  svg('rect', { x: box.x, y: box.y, width: box.w, height: box.h, rx: 0.8, class: 'fz-selbox' + (it.locked ? ' locked' : '') + (single ? '' : ' multi') }, og);
  if (it.locked || !single) return;
  const hr = 4.5 / view.z;
  const canResize = f.kind === 'art' || f.kind === 'text' || (f.kind === 'ctl' && (it.kind === 'screen' || it.kind === 'pedal'));
  if (canResize) svg('rect', { x: box.x + box.w - hr, y: box.y + box.h - hr, width: hr * 2, height: hr * 2, rx: hr * 0.4, class: 'fz-handle', 'data-handle': 'resize' }, og);
  if (f.kind === 'art' || f.kind === 'text') {
    const ty = box.y - 16 / view.z;
    svg('line', { x1: box.x + box.w / 2, x2: box.x + box.w / 2, y1: box.y, y2: ty, class: 'fz-handle-line' }, og);
    svg('circle', { cx: box.x + box.w / 2, cy: ty, r: hr, class: 'fz-handle rot', 'data-handle': 'rotate' }, og);
  }
}
function renderOverlay() {
  const g = ui.overlayG;
  if (!g) return;
  g.textContent = '';
  if (testing()) return;
  if (MIR().on) {
    const v = vAxis();
    svg('line', v ? { x1: D.enc.w / 2, x2: D.enc.w / 2, y1: -8, y2: D.enc.h + 8, class: 'fz-axis' } : { y1: D.enc.h / 2, y2: D.enc.h / 2, x1: -8, x2: D.enc.w + 8, class: 'fz-axis' }, g);
  }
  for (const gd of guides) {
    if (gd.x != null) svg('line', { x1: gd.x, x2: gd.x, y1: -6, y2: D.enc.h + 6, class: 'fz-guide' }, g);
    else svg('line', { y1: gd.y, y2: gd.y, x1: -6, x2: D.enc.w + 6, class: 'fz-guide' }, g);
  }
  if (marquee) svg('rect', { x: Math.min(marquee.x0, marquee.x1), y: Math.min(marquee.y0, marquee.y1), width: Math.abs(marquee.x1 - marquee.x0), height: Math.abs(marquee.y1 - marquee.y0), class: 'fz-marquee' }, g);
  if (sel === 'enc') {
    svg('path', { d: roundPoly(shapePoints(D.enc.shape, D.enc.w, D.enc.h), D.enc.radius || 0), class: 'fz-selbox enc' }, g);
    return;
  }
  const items = selItems();
  for (const f of items) selBox(g, f, items.length === 1);
  // mirror twins of the selection get a faint box
  if (MIR().on)
    for (const f of items) {
      const t = f.item.twin && find(f.item.twin);
      if (t && !sels.has(t.item.id)) {
        const n = g.childNodes.length;
        selBox(g, t, false);
        for (let i = n; i < g.childNodes.length; i++) g.childNodes[i].classList.add('fz-twinbox');
      }
    }
}
function renderStatus() {
  if (!ui.status) return;
  const f = find(sel);
  let s = '';
  if (testing()) s = 'Testing: turn the knobs and stomp the switches';
  else if (sels.size > 1) s = `${sels.size} items selected`;
  else if (!f || f.kind === 'enc') s = `${D.enc.size === 'custom' ? 'Custom' : D.enc.size} enclosure, ${D.ctls.length} controls, ${D.jacks.length} jacks`;
  else if (f.kind === 'jack') s = `${JACKS[f.item.kind].name} jack on the ${f.item.edge} edge`;
  else s = `${itemName(f)}  ·  x ${r1(f.item.x)}  y ${r1(f.item.y)} mm`;
  ui.status.textContent = s;
}

function startDrag(e, onMove, onUp) {
  ui.stage.setPointerCapture(e.pointerId);
  const sx = e.clientX, sy = e.clientY;
  let moved = false;
  const mv = (ev) => {
    if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 3) return;
    moved = true;
    onMove(ev);
  };
  const up = (ev) => {
    ui.stage.removeEventListener('pointermove', mv);
    ui.stage.removeEventListener('pointerup', up);
    ui.stage.removeEventListener('pointercancel', up);
    onUp && onUp(ev, moved);
  };
  ui.stage.addEventListener('pointermove', mv);
  ui.stage.addEventListener('pointerup', up);
  ui.stage.addEventListener('pointercancel', up);
}
function startPan(e) {
  const x0 = view.x, y0 = view.y, sx = e.clientX, sy = e.clientY;
  ui.stageWrap.classList.add('panning');
  startDrag(e, (ev) => {
    view.x = x0 + ev.clientX - sx;
    view.y = y0 + ev.clientY - sy;
    view.touched = true;
    applyView();
  }, () => ui.stageWrap.classList.remove('panning'));
}
function startMarquee(e, onBody) {
  const p0 = toPedal(e);
  const add = e.shiftKey || e.ctrlKey || e.metaKey;
  marquee = { x0: p0.x, y0: p0.y, x1: p0.x, y1: p0.y };
  startDrag(e, (ev) => {
    const p = toPedal(ev);
    marquee.x1 = p.x;
    marquee.y1 = p.y;
    renderOverlay();
  }, (ev, moved) => {
    const m = marquee;
    marquee = null;
    if (!moved) {
      if (!add) select(onBody ? 'enc' : null);
      else renderOverlay();
      return;
    }
    const x0 = Math.min(m.x0, m.x1), x1 = Math.max(m.x0, m.x1), y0 = Math.min(m.y0, m.y1), y1 = Math.max(m.y0, m.y1);
    const inside = (x, y) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
    const ids = [];
    for (const c of D.ctls) if (!c.hidden && !c.locked && inside(c.x, c.y)) ids.push(c.id);
    for (const a of D.art) if (!a.hidden && !a.locked && inside(a.x, a.y)) ids.push(a.id);
    for (const id of ['title', 'sub']) if (!D[id].hidden && D[id].text && !D[id].locked && inside(D[id].x, D[id].y)) ids.push(id);
    const pts = shapePoints(D.enc.shape, D.enc.w, D.enc.h);
    for (const j of D.jacks) {
      const s = jackSpot(pts, D, j);
      if (inside(s.ex, s.ey)) ids.push(j.id);
    }
    if (sel === 'enc') sels.clear();
    selectMany(ids, add);
  });
}
function alignTo(ids, x, y, alt) {
  guides = [];
  if (alt) return { x, y };
  const xs = [D.enc.w / 2], ys = [D.enc.h / 2];
  for (const c of D.ctls)
    if (!ids.has(c.id) && !c.hidden) {
      xs.push(c.x);
      ys.push(c.y);
    }
  const tol = Math.max(0.8, 5 / view.z);
  const bx = xs.reduce((b, v) => (Math.abs(v - x) < tol && (b == null || Math.abs(v - x) < Math.abs(b - x)) ? v : b), null);
  const by = ys.reduce((b, v) => (Math.abs(v - y) < tol && (b == null || Math.abs(v - y) < Math.abs(b - y)) ? v : b), null);
  if (bx != null) {
    x = bx;
    guides.push({ x: bx });
  }
  if (by != null) {
    y = by;
    guides.push({ y: by });
  }
  return { x, y };
}
function startMove(e, id) {
  const f = find(id);
  if (!f || f.item.locked) return;
  const p0 = toPedal(e);
  // the clicked item leads, the rest of the selection follows
  const group = (sels.has(id) ? selItems() : [f]).filter((g) => !g.item.locked && g.kind !== 'enc');
  const lead = f.item;
  const start = new Map(group.map((g) => [g.item, { x: g.item.x, y: g.item.y, t: g.item.t }]));
  const ids = new Set(group.map((g) => g.item.id));
  const o = start.get(lead) || { x: lead.x, y: lead.y };
  ui.stageWrap.classList.add('moving');
  startDrag(e, (ev) => {
    const p = toPedal(ev);
    if (f.kind === 'jack' && group.length === 1) Object.assign(lead, jackAt(p));
    else {
      let nx = snap(o.x + p.x - p0.x, ev.altKey), ny = snap(o.y + p.y - p0.y, ev.altKey);
      if (f.kind === 'jack') {
        nx = o.x;
        ny = o.y;
      } else if (f.kind === 'ctl') ({ x: nx, y: ny } = alignTo(ids, nx, ny, ev.altKey));
      const dx = f.kind === 'jack' ? p.x - p0.x : nx - o.x, dy = f.kind === 'jack' ? p.y - p0.y : ny - o.y;
      for (const g of group) {
        const s = start.get(g.item);
        if (g.kind === 'jack') {
          const len = g.item.edge === 'top' || g.item.edge === 'bottom' ? D.enc.w : D.enc.h;
          const d = g.item.edge === 'top' || g.item.edge === 'bottom' ? dx : dy;
          g.item.t = clamp(s.t + d / len, 0.04, 0.96);
        } else {
          g.item.x = r1(clamp(s.x + dx, -20, D.enc.w + 20));
          g.item.y = r1(clamp(s.y + dy, -20, D.enc.h + 20));
        }
      }
    }
    mirrorSync(group);
    renderStage();
  }, (ev, moved) => {
    ui.stageWrap.classList.remove('moving');
    guides = [];
    if (moved) {
      commit();
      renderInspector();
    }
    renderStage();
  });
}
function startHandle(e, kind) {
  const f = find(sel);
  if (!f) return;
  const it = f.item;
  const p0 = toPedal(e);
  const o = clone(it);
  const rot = ((it.rot || 0) * Math.PI) / 180;
  const local = (p) => {
    const dx = p.x - o.x, dy = p.y - o.y;
    return { x: dx * Math.cos(-rot) - dy * Math.sin(-rot), y: dx * Math.sin(-rot) + dy * Math.cos(-rot) };
  };
  const l0 = local(p0);
  startDrag(e, (ev) => {
    const p = toPedal(ev);
    if (kind === 'rotate') {
      let a = (Math.atan2(p.y - o.y, p.x - o.x) * 180) / Math.PI + 90;
      a = ev.shiftKey ? Math.round(a / 15) * 15 : Math.round(a);
      if (a > 180) a -= 360;
      it.rot = a;
    } else {
      const l = local(p);
      if (f.kind === 'text') {
        const k = Math.hypot(l.x, l.y) / Math.max(1, Math.hypot(l0.x, l0.y));
        it.size = clamp(r1(o.size * k), 2, 40);
      } else {
        let w = Math.max(3, o.w + (l.x - l0.x) * 2), h = Math.max(3, o.h + (l.y - l0.y) * 2);
        if (ev.shiftKey) {
          const k = Math.max(w / o.w, h / o.h);
          w = o.w * k;
          h = o.h * k;
        }
        it.w = r1(w);
        it.h = r1(h);
      }
    }
    mirrorSync([f]);
    renderStage();
  }, (ev, moved) => {
    if (moved) {
      commit();
      renderInspector();
    }
  });
}
function onStageDown(e) {
  if (e.button === 1 || e.button === 2 || (e.button === 0 && ui.space)) {
    e.preventDefault();
    return startPan(e);
  }
  if (e.button !== 0) return;
  if (testing()) {
    if (playDown(e, ui.stage, () => view.z, () => renderTestPanel(true))) return;
    return startPan(e);
  }
  const h = e.target.closest('[data-handle]');
  if (h) return startHandle(e, h.dataset.handle);
  const it = e.target.closest('[data-id]');
  if (it) {
    const id = it.dataset.id;
    const multi = e.shiftKey || e.ctrlKey || e.metaKey;
    if (multi) {
      select(id, 'toggle');
      if (!sels.has(id)) return;
    } else if (!sels.has(id)) select(id);
    else if (sel !== id) {
      sel = id;
      renderInspector();
    }
    return startMove(e, id);
  }
  startMarquee(e, !!e.target.closest('[data-body]'));
}

// ------------------------------------------------------------------ palette drag
function startPaletteDrag(e, tile, kind, payload) {
  if (e.button !== 0) return;
  e.preventDefault();
  const sx = e.clientX, sy = e.clientY;
  let ghost = null;
  const over = (ev) => {
    const r = ui.stage.getBoundingClientRect();
    return ev.clientX > r.left && ev.clientX < r.right && ev.clientY > r.top && ev.clientY < r.bottom;
  };
  const mv = (ev) => {
    if (!ghost && Math.hypot(ev.clientX - sx, ev.clientY - sy) > 4) {
      ghost = el('div', { class: 'fz-ghost' }, document.body);
      ghost.appendChild(tile.querySelector('svg').cloneNode(true));
      ghost.style.setProperty('--gs', Math.max(28, view.z * 9) + 'px');
    }
    if (ghost) {
      ghost.style.transform = `translate(${ev.clientX}px,${ev.clientY}px)`;
      ghost.classList.toggle('over', over(ev));
    }
  };
  const up = (ev) => {
    window.removeEventListener('pointermove', mv);
    window.removeEventListener('pointerup', up);
    if (testing()) return ghost && ghost.remove();
    if (ghost) {
      ghost.remove();
      if (over(ev)) addPart(kind, payload, toPedal(ev));
    } else addPart(kind, payload, null);
  };
  window.addEventListener('pointermove', mv);
  window.addEventListener('pointerup', up);
}

// ------------------------------------------------------------------ form helpers for the inspector
// Multi-select edits go through a proxy: reads give the first item's value and note when the items differ,
// writes go to every item. Each helper asks takeMixed() whether the value it shows is mixed.
let mixedRead = false;
const NOT_MIXED = new Set(['id', 'x', 'y', 'twin', 'kind', 'bits', 'maps']);
function multiProxy(items) {
  const prim = items[0];
  return new Proxy(prim, {
    get(t, k) {
      const v = t[k];
      if (typeof k === 'string' && !NOT_MIXED.has(k)) {
        const s = JSON.stringify(v);
        if (items.some((o) => JSON.stringify(o[k]) !== s)) mixedRead = true;
      }
      return v;
    },
    set(t, k, v) {
      // a range or taper edit keeps what each control drives; only a new target replaces the whole mapping
      if (k === 'map' && v && t.map && v.to === t.map.to) {
        const old = t.map;
        const keys = new Set([...Object.keys(v), ...Object.keys(old)]);
        for (const o of items) {
          const m = { ...(o.map || { to: '' }) };
          for (const x of keys) {
            if (x === 'to' || JSON.stringify(v[x]) === JSON.stringify(old[x])) continue;
            if (v[x] === undefined) delete m[x];
            else m[x] = clone(v[x]);
          }
          o.map = m;
        }
        return true;
      }
      for (const o of items) o[k] = v && typeof v === 'object' ? clone(v) : v;
      return true;
    },
  });
}
function takeMixed() {
  const m = mixedRead;
  mixedRead = false;
  return m;
}
function sec(parent, title, extra) {
  takeMixed();
  const s = el('div', { class: 'fz-sec' }, parent);
  if (title) {
    const h = el('h5', {}, s);
    h.textContent = title;
    if (extra) el('span', { class: 'fz-soon' }, h).textContent = extra;
  }
  return s;
}
function row(parent, label, mixed) {
  const r = el('div', { class: 'fz-row' + (mixed ? ' mixed' : '') }, parent);
  el('label', {}, r).textContent = label;
  if (mixed) el('em', { class: 'fz-mixed' }, r).textContent = 'Mixed';
  return el('div', { class: 'fz-field' }, r);
}
function slider(parent, label, val, min, max, step, set, cls) {
  const mixed = takeMixed();
  const c = row(parent, label, mixed);
  const r = el('input', { type: 'range', min, max, step, class: cls }, c);
  r.value = val;
  const n = el('input', { type: 'number', min, max, step, class: 'fz-num' }, c);
  n.value = mixed ? '' : r1(val);
  if (mixed) n.placeholder = '...';
  const paint = () => r.style.setProperty('--p', ((r.value - min) / (max - min)) * 100 + '%');
  paint();
  r.oninput = () => {
    n.value = r.value;
    paint();
    set(+r.value);
    changed(true);
  };
  r.onchange = () => changed(false);
  n.onchange = () => {
    const v = clamp(+n.value || 0, min, max);
    r.value = v;
    n.value = v;
    paint();
    set(v);
    changed(false);
  };
  return r;
}
function seg(parent, label, opts, cur, set, rerender = true) {
  const mixed = takeMixed();
  const c = label ? row(parent, label, mixed) : el('div', { class: 'fz-field' }, parent);
  const s = el('div', { class: 'seg fz-seg' }, c);
  for (const [v, t] of opts) {
    const b = el('button', { class: !mixed && String(v) === String(cur) ? 'on' : '', 'data-v': v }, s);
    b.textContent = t;
    b.onclick = () => {
      set(v);
      changed(false);
      if (rerender) renderInspector();
      else s.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
    };
  }
  return s;
}
function colors(parent, label, cur, swatches, set, key) {
  const mixed = takeMixed();
  const c = row(parent, label, mixed);
  const w = el('div', { class: 'fz-swatches', 'data-key': key || '' }, c);
  const pick = el('input', { type: 'color', class: 'fz-color', title: 'Pick any colour' });
  pick.value = /^#[0-9a-f]{6}$/i.test(cur) ? cur : '#000000';
  const mark = (v) => w.querySelectorAll('i').forEach((i) => i.classList.toggle('on', i.dataset.swatch === v.toLowerCase()));
  for (const s of swatches) {
    const i = el('i', { 'data-swatch': s.toLowerCase(), title: s }, w);
    i.style.background = s;
    i.onclick = () => {
      set(s);
      pick.value = s;
      mark(s);
      changed(false);
    };
  }
  w.appendChild(pick);
  mark(mixed ? '' : cur || '');
  pick.oninput = () => {
    set(pick.value);
    mark(pick.value);
    changed(true);
  };
  pick.onchange = () => changed(false);
}
function selectField(parent, label, opts, cur, set, rerender) {
  const mixed = takeMixed();
  const c = row(parent, label, mixed);
  const s = el('select', {}, c);
  if (mixed) el('option', { value: '__mixed', disabled: '' }, s).textContent = 'Mixed';
  for (const [v, t] of opts) {
    const o = el('option', { value: v }, s);
    o.textContent = t;
  }
  s.value = mixed ? '__mixed' : cur;
  s.onchange = () => {
    set(s.value);
    changed(false);
    if (rerender) renderInspector();
  };
  return s;
}
function textField(parent, label, cur, set, o = {}) {
  const mixed = takeMixed();
  const c = row(parent, label, mixed);
  const i = el(o.multi ? 'textarea' : 'input', o.multi ? { rows: 2, class: 'fz-text' } : { type: 'text', class: 'fz-text', maxlength: 40 }, c);
  i.value = mixed ? '' : cur || '';
  if (mixed) i.placeholder = 'Mixed';
  i.oninput = () => {
    set(i.value);
    changed(true);
  };
  i.onchange = () => changed(false);
  return i;
}
function check(parent, label, cur, set, rerender) {
  const mixed = takeMixed();
  const c = row(parent, label, mixed);
  const l = el('label', { class: 'switch' }, c);
  const i = el('input', { type: 'checkbox' }, l);
  i.checked = !!cur;
  i.indeterminate = mixed;
  el('span', {}, l);
  i.onchange = () => {
    set(i.checked);
    changed(false);
    if (rerender) renderInspector();
  };
}
function xy(parent, it) {
  const c = row(parent, 'Position');
  const mk = (k) => {
    const w = el('span', { class: 'fz-xy' }, c);
    el('em', {}, w).textContent = k.toUpperCase();
    const i = el('input', { type: 'number', step: 0.5, class: 'fz-num' }, w);
    i.value = r1(it[k]);
    i.onchange = () => {
      it[k] = +i.value || 0;
      changed(false);
    };
  };
  mk('x');
  mk('y');
}
const H = () => ({ sec, row, slider, seg, colors, selectField, textField, check, changed, rerender: renderInspector, name: (c) => itemName({ kind: 'ctl', item: c }) });

// ------------------------------------------------------------------ inspector
const CTL_NAMES = { knob: 'Knob', trim: 'Trim pot', slider: 'Slider', sel: 'Rotary switch', button: 'Push button', foot: 'Footswitch', pedal: 'Foot pedal', led: 'LED', screen: 'Screen', dip: 'DIP switch' };
function itemName(f) {
  if (!f) return '';
  if (f.kind === 'enc') return 'Enclosure';
  if (f.kind === 'text') return f.item.id === 'title' ? 'Name' : 'Subtitle';
  if (f.kind === 'jack') return JACKS[f.item.kind].name + ' jack';
  if (f.kind === 'art') return (ART_KINDS.find((a) => a[0] === f.item.kind) || [0, 'Shape'])[1];
  const c = f.item;
  const k = c.kind === 'toggle' ? c.ways + ' way toggle' : partName(c) || CTL_NAMES[c.kind] || 'Control';
  return c.label ? `${k} "${c.label}"` : k;
}
function scaleDesign(kx, ky) {
  for (const list of [D.ctls, D.art, [D.title, D.sub]])
    for (const it of list) {
      it.x = r1(it.x * kx);
      it.y = r1(it.y * ky);
    }
}
function renderInspector() {
  const host = ui.insp;
  if (!host) return;
  const scroll = host.scrollTop;
  host.textContent = '';
  if (testing()) {
    renderTestPanel();
    return;
  }
  const items = selItems();
  if (items.length > 1) {
    inspMulti(host, items);
    host.scrollTop = scroll;
    return;
  }
  const f = find(sel) || { kind: 'enc', item: D.enc };
  const head = el('div', { class: 'fz-insp-head' }, host);
  const ttl = el('div', { class: 'fz-insp-title' }, head);
  el('h3', {}, ttl).textContent = itemName(f);
  el('p', {}, ttl).textContent = { enc: 'Size, shape and finish', text: 'Printed text', jack: 'Sits on an edge', art: 'Artwork layer', ctl: 'Control' }[f.kind];
  if (f.kind !== 'enc') {
    const acts = el('div', { class: 'fz-acts' }, head);
    if (f.list) el('button', { class: 'icon-btn', title: 'Duplicate (Ctrl+D)', onclick: duplicateSel }, acts, '<i class="ic ic-copy"></i>');
    el('button', { class: 'icon-btn', title: f.kind === 'text' ? 'Hide' : 'Delete (Del)', onclick: removeSel }, acts, '<i class="ic ic-trash"></i>');
  }
  if (f.kind === 'enc') inspEnclosure(host);
  else if (f.kind === 'text') inspText(host, f.item);
  else if (f.kind === 'art') inspArt(host, f.item);
  else if (f.kind === 'jack') inspJack(host, f.item);
  else inspControl(host, f.item, false);
  if (MIR().on && f.list) mirrorSection(host, f);
  host.scrollTop = scroll;
}
function mirrorSection(host, f) {
  const s = sec(host, 'Mirror');
  const t = f.item.twin && find(f.item.twin);
  if (t) {
    el('p', { class: 'fz-note fz-note-top' }, s).textContent = `Mirrored by ${itemName(t)}. Moving or resizing one moves the other.`;
    const ar = el('div', { class: 'fz-actrow' }, s);
    el('button', { class: 'btn small', onclick: () => select(t.item.id) }, ar, 'Select twin');
    el('button', { class: 'btn small', onclick: () => { delete f.item.twin; delete t.item.twin; changed(false); renderInspector(); } }, ar, 'Unlink');
  } else if (onAxis(f)) el('p', { class: 'fz-note fz-note-top' }, s).textContent = 'Sits on the mirror line, so it has no twin.';
  else el('div', { class: 'fz-actrow' }, s).appendChild(el('button', { class: 'btn small', 'data-act': 'twin', onclick: () => { makeTwin(find(f.item.id)); changed(false); renderInspector(); renderLayers(); } }, null, 'Add mirror twin'));
}
function inspMulti(host, items) {
  const kinds = new Set(items.map(typeKey));
  const same = kinds.size === 1;
  const f0 = items[0];
  const head = el('div', { class: 'fz-insp-head' }, host);
  const ttl = el('div', { class: 'fz-insp-title' }, head);
  const base = same ? itemName({ ...f0, item: { ...f0.item, label: '' } }) : 'items';
  const nm = base.charAt(0).toLowerCase() + base.slice(1);
  el('h3', {}, ttl).textContent = `${items.length} ${same ? (nm.endsWith('s') ? nm : nm + 's') : 'items'}`;
  el('p', {}, ttl).textContent = same ? 'Changes apply to all of them' : 'Pick items of one type to edit them together';
  const acts = el('div', { class: 'fz-acts' }, head);
  el('button', { class: 'icon-btn', title: 'Duplicate (Ctrl+D)', onclick: duplicateSel }, acts, '<i class="ic ic-copy"></i>');
  el('button', { class: 'icon-btn', title: 'Delete (Del)', onclick: removeSel }, acts, '<i class="ic ic-trash"></i>');
  host.dataset.multi = items.length;
  const s = sec(host, 'Arrange');
  const ar = el('div', { class: 'fz-align' }, s);
  for (const [k, t] of [['left', 'Left'], ['cx', 'Centre'], ['right', 'Right'], ['top', 'Top'], ['cy', 'Middle'], ['bottom', 'Bottom'], ['dx', 'Space across'], ['dy', 'Space down']])
    el('button', { class: 'btn small', 'data-align': k, onclick: () => align(k) }, ar, t);
  if (!same) return;
  const P = multiProxy(items.map((f) => f.item));
  takeMixed();
  if (f0.kind === 'ctl') inspControl(host, P, true);
  else if (f0.kind === 'art') inspArt(host, P, true);
  else if (f0.kind === 'jack') inspJack(host, P, true);
  else if (f0.kind === 'text') inspText(host, P, true);
}
function inspEnclosure(host) {
  const E = D.enc;
  const s1 = sec(host, 'Size');
  const grid = el('div', { class: 'fz-sizes' }, s1);
  for (const s of SIZES) {
    const b = el('button', { class: 'fz-size' + (E.size === s.id ? ' on' : ''), 'data-size': s.id, title: `${s.w} x ${s.h} mm` }, grid);
    const k = 26 / 190;
    const m = el('div', { class: 'fz-size-art' }, b);
    el('i', { style: { width: Math.max(5, s.w * k * 1.4) + 'px', height: Math.max(8, s.h * k * 1.4) + 'px' } }, m);
    el('b', {}, b).textContent = s.id;
    el('small', {}, b).textContent = s.note;
    b.onclick = () => {
      scaleDesign(s.w / E.w, s.h / E.h);
      Object.assign(E, { size: s.id, w: s.w, h: s.h });
      changed(false);
      if (!view.touched) fit();
      renderInspector();
    };
  }
  const setDim = (k) => (v) => {
    scaleDesign(k === 'w' ? v / E.w : 1, k === 'h' ? v / E.h : 1);
    E[k] = v;
    const m = SIZES.find((s) => s.w === E.w && s.h === E.h);
    E.size = m ? m.id : 'custom';
  };
  slider(s1, 'Width', E.w, 30, MAX_W, 1, setDim('w'));
  slider(s1, 'Length', E.h, 50, 220, 1, setDim('h'));

  const s2 = sec(host, 'Shape');
  const sg = el('div', { class: 'fz-shapes' }, s2);
  for (const [id, name] of SHAPES) {
    const b = el('button', { class: 'fz-shape' + (E.shape === id ? ' on' : ''), title: name, 'data-shape': id }, sg);
    const s = svg('svg', { viewBox: '-2 -2 34 44' }, b);
    svg('path', { d: roundPoly(shapePoints(id, 30, 40), 3) }, s);
    el('span', {}, b).textContent = name;
    b.onclick = () => {
      E.shape = id;
      changed(false);
      renderInspector();
    };
  }
  slider(s2, 'Corners', E.radius, 0, 24, 0.5, (v) => (E.radius = v));

  const s3 = sec(host, 'Material');
  if (!E.mat) E.mat = encSpec(E);
  // the colour is picked in the material panel (no quick colour row above it)
  materialPicker(s3, { key: 'fz-enc', value: E.mat, wear: true, onChange: (spec, live) => { E.mat = spec; changed(live); if (!live) renderInspector(); } });

  const s5 = sec(host, 'Inside');
  if (isClear(E)) {
    check(s5, 'Circuit board', E.pcb, (v) => (E.pcb = v), true);
    if (E.pcb) colors(s5, 'Board', E.pcbColor || PCB_COLORS[0], PCB_COLORS, (v) => (E.pcbColor = v), 'pcb');
    el('p', { class: 'fz-note' }, s5).textContent = 'Shows the board and the wires to every control through the clear enclosure, here and on the board.';
  } else el('p', { class: 'fz-note fz-note-top' }, s5).textContent = 'Pick a clear glass or acrylic material to show the circuit board inside.';

  patternInspector(host, E, { sec, row, slider, colors, seg, selectField, check, changed, rerender: renderInspector });
  dotsSection(host, E, H());

  const s4 = sec(host, 'Printed labels');
  selectField(s4, 'Font', FONTS, D.labels.font, (v) => (D.labels.font = v));
  slider(s4, 'Size', D.labels.size, 2, 6, 0.1, (v) => (D.labels.size = v));
  colors(s4, 'Ink', D.labels.color, INK_SWATCHES, (v) => (D.labels.color = v), 'ink');
}
function inspText(host, t, multi) {
  const s = sec(host, 'Text');
  textField(s, 'Text', t.text, (v) => (t.text = v));
  check(s, 'Show', !t.hidden, (v) => (t.hidden = !v));
  selectField(s, 'Font', FONTS, t.font, (v) => (t.font = v));
  slider(s, 'Size', t.size, 2, 40, 0.5, (v) => (t.size = v));
  seg(s, 'Weight', [[500, 'Regular'], [700, 'Bold'], [800, 'Heavy']], t.weight, (v) => (t.weight = +v), false);
  slider(s, 'Spacing', t.ls, -1, 6, 0.1, (v) => (t.ls = v));
  check(s, 'Italic', t.italic, (v) => (t.italic = v));
  colors(s, 'Colour', t.color, INK_SWATCHES, (v) => (t.color = v), 'text');
  const s2 = sec(host, 'Outline');
  slider(s2, 'Width', t.outline || 0, 0, 2, 0.05, (v) => (t.outline = v));
  colors(s2, 'Colour', t.outlineColor, INK_SWATCHES, (v) => (t.outlineColor = v), 'outline');
  if (multi) return;
  const s3 = sec(host, 'Placement');
  xy(s3, t);
  slider(s3, 'Rotation', t.rot || 0, -180, 180, 1, (v) => (t.rot = v));
  el('div', { class: 'fz-actrow' }, s3).appendChild(el('button', { class: 'btn small', onclick: () => { t.x = D.enc.w / 2; changed(false); renderInspector(); } }, null, 'Centre across'));
}
function inspArt(host, a, multi) {
  const s = sec(host, 'Shape');
  const sg = el('div', { class: 'fz-artkinds' }, s);
  for (const [k, name] of ART_KINDS) {
    const b = el('button', { class: 'fz-artkind' + (a.kind === k ? ' on' : ''), title: name }, sg);
    const v = svg('svg', { viewBox: '-12 -12 24 24' }, b);
    svg('path', { d: artPath({ kind: k, w: 20, h: k === 'stripe' || k === 'stripes' || k === 'wave' ? 10 : 20 }), 'fill-rule': 'evenodd' }, v);
    b.onclick = () => {
      a.kind = k;
      changed(false);
      renderInspector();
    };
  }
  colors(s, 'Colour', a.color, [...BODY_SWATCHES.slice(0, 10), '#ffffff', '#000000'], (v) => (a.color = v), 'art');
  slider(s, 'Opacity', a.opacity ?? 1, 0.05, 1, 0.05, (v) => (a.opacity = v));
  if (a.kind === 'ring') slider(s, 'Thickness', a.thick ?? 0.18, 0.04, 0.45, 0.01, (v) => (a.thick = v));
  const s2 = sec(host, 'Placement');
  if (!multi) xy(s2, a);
  slider(s2, 'Width', a.w, 2, MAX_W + 20, 0.5, (v) => (a.w = v));
  slider(s2, 'Height', a.h, 2, 240, 0.5, (v) => (a.h = v));
  slider(s2, 'Rotation', a.rot || 0, -180, 180, 1, (v) => (a.rot = v));
  if (multi) return;
  const ar = el('div', { class: 'fz-actrow' }, s2);
  el('button', { class: 'btn small', onclick: () => moveOrder(a.id, 1) }, ar, 'Bring forward');
  el('button', { class: 'btn small', onclick: () => moveOrder(a.id, -1) }, ar, 'Send back');
}
function inspJack(host, j, multi) {
  const s = sec(host, 'Jack');
  selectField(s, 'Type', Object.entries(JACKS).map(([k, v]) => [k, v.name]), j.kind, (v) => {
    if (j.label === JACKS[j.kind].label) j.label = JACKS[v].label;
    j.kind = v;
  }, true);
  textField(s, 'Label', j.label, (v) => (j.label = v));
  seg(s, 'Edge', [['top', 'Top'], ['left', 'Left'], ['right', 'Right'], ['bottom', 'Bottom']], j.edge, (v) => (j.edge = v), false);
  if (!multi) slider(s, 'Along', j.t, 0.04, 0.96, 0.01, (v) => (j.t = v));
  el('p', { class: 'fz-note' }, s).textContent = { phones: 'A stereo headphone out (TRS) on the board.', xlr: 'A balanced XLR out on the board.', exp: 'A control input: an expression pedal plugged in here turns one of your controls.', fsw: 'A footswitch input (TRS): plug one or two external footswitches in on the board. Tip and ring each send an on / off. Wire it in the wiring diagram.', power: 'Just for looks: the board does not need power.' }[j.kind] || 'Drag a jack around the pedal to move it to another edge.';
  if ((j.kind === 'exp' || j.kind === 'fsw') && !multi) expSection(host, D, j, H());
  if ((j.kind === 'in' || j.kind === 'out') && !multi) loopSection(host, D, j, H()); // effects loop SEND / RETURN
  if (j.kind !== 'power') jackAngleSection(host, D, j, multi, H());
  if (j.kind !== 'power') partMaterial(host, j);
}
// one Material section with a part switcher (factory-matparts.js)
function partMaterial(host, c) {
  materialSection(host, D, c, H());
}
function inspControl(host, c, multi) {
  const s = sec(host, itemName({ kind: 'ctl', item: { kind: c.kind, ways: c.ways, part: c.part, look: c.look, label: '' } }));
  if (partInspector(s, c, multi, H(), { knobStyles: KNOB_STYLES })) {
    /* extra controls and looks: factory-extras.js */
  } else if (c.kind === 'knob') {
    selectField(s, 'Cap', KNOB_STYLES, c.style, (v) => (c.style = v));
    seg(s, 'Size', KNOB_SIZES, c.r, (v) => (c.r = +v), false);
    slider(s, 'Pointer', c.value ?? 0.5, 0, 1, 0.01, (v) => (c.value = v));
    check(s, 'Scale ticks', c.ticks, (v) => (c.ticks = v));
  } else if (c.kind === 'slider') {
    seg(s, 'Direction', [['v', 'Up / down'], ['h', 'Sideways']], c.orient || 'v', (v) => (c.orient = v), false);
    slider(s, 'Length', c.h || 24, 10, 70, 1, (v) => (c.h = v));
    slider(s, 'Cap width', c.w || 5, 3, 10, 0.5, (v) => (c.w = v));
    slider(s, 'Position', c.value ?? 0.5, 0, 1, 0.01, (v) => (c.value = v));
  } else if (c.kind === 'sel') {
    slider(s, 'Positions', c.n || 4, 2, 12, 1, (v) => {
      c.n = v;
      const o = (c.opts || []).slice();
      while (o.length < v) o.push(String(o.length + 1));
      c.opts = o;
      c.pos = Math.min(c.pos || 0, v - 1);
    });
    selectField(s, 'Cap', KNOB_STYLES, c.style || 'boss', (v) => (c.style = v));
    seg(s, 'Size', [[5, 'S'], [7, 'M'], [9, 'L']], c.r, (v) => (c.r = +v), false);
    textField(s, 'Positions', (c.opts || []).slice(0, c.n).join(', '), (v) => (c.opts = v.split(',').map((x) => x.trim().toUpperCase().slice(0, 5))));
    check(s, 'Print names', c.marks !== false, (v) => (c.marks = v));
    if (!multi) seg(s, 'Set to', (c.opts || []).slice(0, c.n).map((o, i) => [i, o || String(i + 1)]), c.pos || 0, (v) => (c.pos = +v), false);
  } else if (c.kind === 'toggle') {
    seg(s, 'Ways', [[2, '2 way'], [3, '3 way']], c.ways, (v) => {
      c.ways = +v;
      c.pos = Math.min(c.pos, c.ways - 1);
      const o = c.opts.slice();
      while (o.length < c.ways) o.push(String.fromCharCode(65 + o.length));
      c.opts = o;
    });
    seg(s, 'Lever', [['v', 'Vertical'], ['h', 'Sideways']], c.orient, (v) => (c.orient = v), false);
    seg(s, 'Tip', TOGGLE_TIPS, c.tip || 'bat', (v) => (c.tip = v), false);
    textField(s, 'Positions', c.opts.slice(0, c.ways).join(', '), (v) => (c.opts = v.split(',').map((x) => x.trim().toUpperCase().slice(0, 6))));
    if (!multi) seg(s, 'Set to', c.opts.slice(0, c.ways).map((o, i) => [i, o || String(i + 1)]), c.pos, (v) => (c.pos = +v), false);
  } else if (c.kind === 'button') {
    seg(s, 'Shape', BUTTON_SHAPES, c.shape || 'round', (v) => (c.shape = v)).classList.add('fz-wrap');
    if (c.shape === 'rect' || c.shape === 'pill') {
      slider(s, 'Width', c.w || 12, 5, 30, 0.5, (v) => (c.w = v));
      slider(s, 'Height', c.h || 6, 3, 14, 0.5, (v) => (c.h = v));
    } else slider(s, 'Size', c.r, 2.5, 7, 0.5, (v) => (c.r = v));
    check(s, 'LED ring', c.led, (v) => (c.led = v), true);
    if (c.led) {
      colors(s, 'LED', c.ledColor, LED_COLORS, (v) => (c.ledColor = v), 'led');
      check(s, 'Lit', c.on, (v) => (c.on = v));
    }
  } else if (c.kind === 'foot') {
    seg(s, 'Style', [['stomp', 'Metal'], ['soft', 'Soft touch'], ['rc', 'Rubber pad'], ['ts', 'Rocker']], c.style, (v) => (c.style = v), true);
    if (c.style === 'stomp' || c.style === 'soft') slider(s, 'Size', c.r || 7, 5, 10, 0.5, (v) => (c.r = v));
    else {
      slider(s, 'Width', c.w || 34, 18, 90, 1, (v) => (c.w = v));
      slider(s, 'Height', c.h || 30, 14, 70, 1, (v) => (c.h = v));
    }
  } else if (c.kind === 'led') {
    colors(s, 'Colour', c.color, LED_COLORS, (v) => (c.color = v), 'led');
    seg(s, 'Size', [[1.5, '3 mm'], [2.5, '5 mm'], [4, '8 mm']], c.r, (v) => (c.r = +v), false);
    check(s, 'Lit', c.on, (v) => (c.on = v));
  } else if (c.kind === 'screen') {
    seg(s, 'Type', Object.entries(SCREENS).map(([k, v]) => [k, v.name]), c.type, (v) => (c.type = v), false);
    slider(s, 'Width', c.w, 12, 90, 1, (v) => (c.w = v));
    slider(s, 'Height', c.h, 8, 50, 1, (v) => (c.h = v));
    screenInspector(s, c, H(), { getD: () => D, multi }); // Basic text or Custom (screenscript/factory-ui.js)
  }
  extraSections(host, D, c, multi, H());
  // what a control drives is wired in the wiring diagram; LEDs keep their "Lights when" section
  if (c.kind === 'led' || (c.kind === 'screen' && !multi) || (c.part === 'encoder' && !multi)) wiringSection(host, D, c, H()); // screens: inputs and outputs, encoders: how they turn
  partMaterial(host, c);
  const s2 = sec(host, 'Label');
  textField(s2, 'Text', c.label, (v) => (c.label = v.toUpperCase()));
  seg(s2, 'Show', [['above', 'Above'], ['below', 'Below'], ['none', 'Hidden']], c.labelPos, (v) => (c.labelPos = v), false);
  if (multi) return;
  const s4 = sec(host, 'Placement');
  xy(s4, c);
  const ar = el('div', { class: 'fz-actrow' }, s4);
  el('button', { class: 'btn small', onclick: () => { c.x = D.enc.w / 2; changed(false); renderInspector(); } }, ar, 'Centre across');
  el('button', { class: 'btn small', onclick: () => moveOrder(c.id, 1) }, ar, 'Bring forward');
  el('button', { class: 'btn small', onclick: () => moveOrder(c.id, -1) }, ar, 'Send back');
}

// ------------------------------------------------------------------ test mode
let meterRaf = 0;
function renderTestPanel(soft) {
  const host = ui.insp;
  if (!host || !testing()) return;
  if (soft && ui.testVals) return paintTestVals();
  host.textContent = '';
  const head = el('div', { class: 'fz-insp-head' }, host);
  const ttl = el('div', { class: 'fz-insp-title' }, head);
  el('h3', {}, ttl).textContent = 'Testing ' + (D.name || 'pedal');
  el('p', {}, ttl).textContent = 'Your guitar goes through this pedal only';
  const s = sec(host, 'Audio');
  ui.engineNote = el('p', { class: 'fz-note fz-note-top fz-engine' }, s);
  const m = el('div', { class: 'fz-meters' }, s);
  ui.meters = [['in', 'In'], ['out', 'Out']].map(([k, t]) => {
    const r = el('div', { class: 'fz-meter', 'data-meter': k }, m);
    el('span', {}, r).textContent = t;
    const bar = el('div', { class: 'fz-meter-bar' }, r);
    return el('i', {}, bar);
  });
  const s2 = sec(host, 'Controls');
  ui.testVals = el('div', { class: 'fz-testvals' }, s2);
  paintTestVals();
  const s3 = sec(host, '');
  const ar = el('div', { class: 'fz-actrow' }, s3);
  el('button', { class: 'btn small', 'data-act': 'keep', title: 'Use the knob positions you set while testing as the pedal defaults', onclick: keepTestValues }, ar, 'Keep these settings');
  el('button', { class: 'btn small btn-accent', onclick: () => setTesting(false) }, ar, 'Stop test');
  el('p', { class: 'fz-note' }, s3).textContent = 'The board comes back when you stop the test or leave this tab.';
  cancelAnimationFrame(meterRaf);
  const tick = () => {
    if (!testing()) return;
    const st = state.status || {};
    const pk = (a) => Math.max(0, ...(a || [0]).slice(0, 2));
    const db = (v) => clamp((20 * Math.log10(Math.max(1e-5, v)) + 60) / 60, 0, 1);
    if (ui.meters) {
      ui.meters[0].style.width = db(pk(st.inPeak)) * 100 + '%';
      ui.meters[1].style.width = db(pk(st.outPeak)) * 100 + '%';
    }
    const run = engineRunning();
    ui.engineNote.textContent = run ? 'Engine running. Play your guitar.' : 'The audio engine is not running, so there is nothing to hear. Check the audio settings.';
    ui.engineNote.classList.toggle('bad', !run);
    ui.stageWrap.classList.toggle('no-engine', !run);
    updateViews();
    meterRaf = requestAnimationFrame(tick);
  };
  meterRaf = requestAnimationFrame(tick);
}
function paintTestVals() {
  const box = ui.testVals;
  if (!box) return;
  box.textContent = '';
  const info = testInfo();
  if (!info) return;
  const P = info.params;
  for (const c of D.ctls) {
    if (c.hidden || c.kind === 'led' || c.kind === 'screen') continue;
    const r = el('div', { class: 'fz-testval' }, box);
    el('b', {}, r).textContent = itemName({ kind: 'ctl', item: c });
    let v = '';
    if (c.kind === 'foot') v = !c.map || c.map.to === 'bypass' ? (info.bypass ? 'Bypassed' : 'On') : c.map.to.endsWith('.tap') ? 'Tap' : P['u.' + c.id] > 0.5 ? 'On' : 'Off';
    else if (c.kind === 'dip') v = [...Array(c.n)].map((_, i) => (P['u.' + c.id + '.' + i] ? '1' : '0')).join('');
    else if (c.kind === 'xy') v = ['x', 'y'].map((a) => Math.round((P['u.' + c.id + '.' + a] ?? 0.5) * 100) + '%').join(' / ');
    else if (KNOBLIKE.has(c.kind)) v = Math.round((P['u.' + c.id] ?? 0.5) * 100) + '%';
    else if (c.kind === 'toggle' || c.kind === 'sel') v = (c.opts || [])[P['u.' + c.id] | 0] || String((P['u.' + c.id] | 0) + 1);
    else if (c.kind === 'button') v = P['u.' + c.id] ? 'On' : 'Off';
    el('span', {}, r).textContent = v;
  }
}
function keepTestValues() {
  const P = testValues();
  for (const c of D.ctls) {
    const k = 'u.' + c.id;
    if (KNOBLIKE.has(c.kind) && P[k] != null) c.value = Math.round(P[k] * 1000) / 1000;
    else if ((c.kind === 'toggle' || c.kind === 'sel') && P[k] != null) c.pos = P[k] | 0;
    else if (c.kind === 'button' && P[k] != null) c.on = !!P[k];
    else if (c.kind === 'dip') c.bits = [...Array(c.n)].map((_, i) => (P[k + '.' + i] ? 1 : 0));
    else if (c.kind === 'xy') for (const a of ['x', 'y']) if (P[k + '.' + a] != null) c['v' + a] = Math.round(P[k + '.' + a] * 1000) / 1000;
  }
  commit();
  toast('Kept the test settings as the pedal defaults', 'ok', 1800);
}
function setTesting(on) {
  if (on === testing()) return;
  if (on) {
    sels.clear();
    sel = null;
    startTest(D);
  } else {
    cancelAnimationFrame(meterRaf);
    ui.testVals = null;
    stopTest();
  }
  ui.stageWrap.classList.toggle('testing', on);
  ui.root.classList.toggle('fz-testing', on);
  updateBar();
  renderStage();
  renderInspector();
}

// ------------------------------------------------------------------ saving as a block
async function saveBlock(asNew) {
  try {
    const id = await saveCustomBlock(D, { asNew });
    D.blockId = id;
    commit();
    updateBar();
    toast(`Saved "${D.name}". Find it under Custom in the block list.`, 'ok', 3200);
  } catch (e) {
    console.error(e);
    toast('Could not save the block: ' + (e.message || e), 'err', 5000);
  }
}
function updateBar() {
  if (!ui.saveBtn) return;
  const saved = D.blockId && customBlocks().some((r) => r.id === D.blockId);
  ui.saveBtn.innerHTML = `<i class="ic ic-import"></i>${saved ? 'Update block' : 'Save as block'}`;
  if (ui.gridBtn) ui.gridBtn.classList.toggle('on', dotsOn(D.enc));
  ui.saveNew.hidden = !saved;
  ui.mirrorBtn.classList.toggle('on', MIR().on);
  ui.mirrorAxis.hidden = !MIR().on;
  ui.mirrorAxis.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.v === MIR().axis));
  ui.testBtn.classList.toggle('on', testing());
  ui.testBtn.innerHTML = testing() ? '<i class="ic fz-ic-stop"></i>Stop test' : '<i class="ic fz-ic-play"></i>Test';
}

// ------------------------------------------------------------------ left panel: parts, layers, circuit
function tile(parent, name, kind, payload, draw) {
  const t = el('div', { class: 'fz-tile', title: `${name}: click to add, or drag onto the pedal`, 'data-part': payload }, parent);
  const s = svg('svg', { viewBox: '-14 -14 28 28' }, t);
  draw(s);
  el('span', {}, t).textContent = name;
  t.addEventListener('pointerdown', (e) => startPaletteDrag(e, t, kind, payload));
  return t;
}
function renderParts() {
  const host = ui.parts;
  if (!host) return;
  host.textContent = '';
  const th = { text: '#d8dce4', labelFont: FONTS[0][0], labelSize: 3.4, toggleTitles: false };
  const tx = sec(host, 'Text');
  const tr = el('div', { class: 'fz-actrow' }, tx);
  for (const id of ['title', 'sub'])
    el('button', { class: 'btn small', onclick: () => { D[id].hidden = false; if (!D[id].text) D[id].text = id === 'title' ? 'NAME' : 'subtitle'; if (!D[id].x) { D[id].x = D.enc.w / 2; D[id].y = D.enc.h * (id === 'title' ? 0.5 : 0.58); } select(id); changed(false); renderInspector(); } }, tr, id === 'title' ? 'Edit name' : 'Edit subtitle');
  const s1 = sec(host, 'Controls');
  const g1 = el('div', { class: 'fz-tiles' }, s1);
  // each tile has a dot per variant: a dot switches the tile, the tile adds that variant (factory-variants.js)
  for (const k of Object.keys(PARTS)) controlTile(g1, k, th, (e, t) => startPaletteDrag(e, t, 'ctl', k));
  const s2 = sec(host, 'Jacks');
  const g2 = el('div', { class: 'fz-tiles' }, s2);
  for (const [k, j] of Object.entries(JACKS))
    tile(g2, j.name, 'jack', k, (s) => {
      const g = svg('g', { transform: k === 'power' ? 'rotate(-90) scale(1.5) translate(-1.5,0)' : 'translate(0,-2) scale(2.3)' }, s);
      drawJackGfx(g, { kind: k }, 'top');
      svg('text', { x: 0, y: 11, 'text-anchor': 'middle', 'font-size': 4.6, 'font-weight': 700, 'font-family': "'Barlow Condensed', sans-serif", class: 'fz-tile-ink' }, s, j.label);
    });
  const s3 = sec(host, 'Artwork');
  const g3 = el('div', { class: 'fz-tiles small' }, s3);
  for (const [k, name] of ART_KINDS)
    tile(g3, name, 'art', k, (s) => {
      svg('path', { d: artPath({ kind: k, w: 20, h: k === 'stripe' || k === 'stripes' || k === 'wave' ? 10 : 20 }), class: 'fz-art-ico', 'fill-rule': 'evenodd' }, s);
    });
  el('p', { class: 'fz-note' }, host).textContent = 'Click a part to add it, or drag it onto the pedal. New controls are wired to the next free value in the circuit. Hold Alt while dragging to skip snapping.';
}

const LAYER_ICONS = {
  enc: 'M5 3h14v18H5z', text: 'M5 6h14M12 6v13', art: 'M12 3l9 16H3z', jack: 'M4 12h9M13 8v8M16 10h4v4h-4z',
  knob: 'M12 4a8 8 0 1 0 0.01 0M12 12V6', toggle: 'M12 21v-6M9 15h6M12 15l3-11', button: 'M12 7a5 5 0 1 0 0.01 0M5 21h14',
  foot: 'M12 3l7.8 4.5v9L12 21l-7.8-4.5v-9zM12 9a3 3 0 1 0 0.01 0', led: 'M12 8a4 4 0 1 0 0.01 0M12 2v2M4 12H2M22 12h-2',
  screen: 'M3 6h18v12H3zM7 10h6M7 14h3', dip: 'M3 7h18v10H3zM7 10v4M12 10v4M17 10v4',
  ...EXTRA_LAYER_ICONS,
  trim: 'M6 6h12v12H6zM9 15l6-6', slider: 'M12 3v18M8 10h8v4H8z', sel: 'M12 4a8 8 0 1 0 0.01 0M12 12l4-5M4 12h1M19 12h1', pedal: 'M7 3h10l2 18H5zM9 8h6',
};
function layerRow(parent, id, f, o = {}) {
  const it = f.item;
  const on = sels.has(id) || (id === 'enc' && (!sel || sel === 'enc'));
  const r = el('div', { class: 'fz-layer' + (on ? ' on' : '') + (it.hidden ? ' hidden' : ''), 'data-layer': id }, parent);
  const ic = svg('svg', { viewBox: '0 0 24 24', class: 'fz-lic' }, r);
  svg('path', { d: LAYER_ICONS[f.kind === 'ctl' ? it.kind : f.kind] }, ic);
  el('span', { class: 'n' }, r).textContent = o.name || itemName(f);
  if (it.twin && MIR().on) el('i', { class: 'fz-ltwin', title: 'Has a mirror twin' }, r);
  if (f.kind === 'art') el('i', { class: 'fz-ldot', style: { background: it.color } }, r);
  if (o.order) {
    el('button', { class: 'fz-lbtn', title: 'Bring forward', onclick: (e) => { e.stopPropagation(); moveOrder(id, 1); } }, r, '<i class="ic fz-ic-up"></i>');
    el('button', { class: 'fz-lbtn', title: 'Send back', onclick: (e) => { e.stopPropagation(); moveOrder(id, -1); } }, r, '<i class="ic ic-down"></i>');
  }
  if (o.toggles) {
    el('button', { class: 'fz-lbtn' + (it.hidden ? ' off' : ''), title: it.hidden ? 'Show' : 'Hide', onclick: (e) => { e.stopPropagation(); it.hidden = !it.hidden; if (it.hidden) sels.delete(id); if (it.hidden && sel === id) sel = [...sels].pop() || null; changed(false); renderInspector(); } }, r, '<i class="ic fz-ic-eye"></i>');
    el('button', { class: 'fz-lbtn' + (it.locked ? ' act' : ' dim'), title: it.locked ? 'Unlock' : 'Lock', onclick: (e) => { e.stopPropagation(); it.locked = !it.locked; changed(false); renderOverlay(); } }, r, '<i class="ic fz-ic-lock"></i>');
  }
  r.onclick = (e) => select(id, (e.shiftKey || e.ctrlKey || e.metaKey) && id !== 'enc' ? 'toggle' : undefined);
}
function renderLayers() {
  const host = ui.layers;
  if (!host || !D) return;
  const scroll = host.scrollTop;
  host.textContent = '';
  const group = (title, n) => {
    const s = el('div', { class: 'fz-lgroup' }, host);
    const h = el('h5', {}, s);
    h.textContent = title;
    el('em', {}, h).textContent = n;
    return s;
  };
  const gc = group('Controls', D.ctls.length);
  [...D.ctls].reverse().forEach((c) => layerRow(gc, c.id, find(c.id), { order: true, toggles: true }));
  if (!D.ctls.length) el('div', { class: 'fz-lempty' }, gc).textContent = 'No controls yet';
  const gt = group('Text', [D.title, D.sub].filter((t) => !t.hidden).length);
  for (const id of ['title', 'sub']) layerRow(gt, id, find(id), { toggles: true, name: (id === 'title' ? 'Name' : 'Subtitle') + (D[id].text ? `: ${D[id].text}` : '') });
  const ga = group('Artwork', D.art.length);
  [...D.art].reverse().forEach((a) => layerRow(ga, a.id, find(a.id), { order: true, toggles: true }));
  if (!D.art.length) el('div', { class: 'fz-lempty' }, ga).textContent = 'No artwork yet';
  const gj = group('Jacks', D.jacks.length);
  D.jacks.forEach((j) => layerRow(gj, j.id, find(j.id), { name: `${JACKS[j.kind].name} · ${j.edge}` }));
  const ge = group('Body', 1);
  layerRow(ge, 'enc', { kind: 'enc', item: D.enc }, { name: `Enclosure · ${D.enc.size === 'custom' ? 'custom' : D.enc.size}` });
  el('p', { class: 'fz-note' }, host).textContent = 'Shift or Ctrl click to pick several. Drag a box on the stage to select everything inside it.';
  host.scrollTop = scroll;
}

function renderCircuit() {
  const host = ui.circuit;
  if (!host || !D) return;
  const scroll = host.scrollTop;
  renderCircuitPane(host, D, {
    ...H(),
    commit: () => {
      commit();
    },
    rerender: (all) => {
      renderCircuit();
      renderInspector();
      renderStage();
      if (all) renderLayers();
    },
    place: (c) => freeSpot(c),
    select: (id) => select(id),
    isSel: (id) => sels.has(id),
    openStage,
    setOpenStage: (id) => (openStage = id),
  });
  host.scrollTop = scroll;
}

function setTab(t) {
  prefs.tab = t;
  savePrefs();
  ui.tabs.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.t === t));
  for (const k of ['parts', 'layers', 'circuit']) ui[k].hidden = k !== t;
  if (t === 'circuit') renderCircuit();
}

// ------------------------------------------------------------------ templates gallery
function openTemplates() {
  const layer = ui.tpl;
  layer.textContent = '';
  layer.classList.add('show');
  const box = el('div', { class: 'fz-tpl' }, layer);
  const head = el('header', {}, box);
  el('div', {}, head, '<h2>Start from a template</h2><p>Every template comes wired up and ready to play. Your current design stays in the undo history.</p>');
  el('button', { class: 'icon-btn', title: 'Close', onclick: closeTemplates }, head, '<i class="ic ic-x"></i>');
  const body = el('div', { class: 'fz-tpl-body' }, box);
  const mine = customBlocks();
  if (mine.length) {
    el('h4', { class: 'fz-tpl-h' }, body).textContent = 'Your blocks';
    const g2 = el('div', { class: 'fz-tpl-grid' }, body);
    for (const rec of mine) {
      const card = el('div', { class: 'fz-tpl-card mine', 'data-mine': rec.id }, g2);
      const a = el('div', { class: 'art' }, card);
      const d = migrateDesign(clone(rec.design));
      a.appendChild(thumb(d));
      el('b', {}, card).textContent = rec.design.name || 'Pedal';
      el('small', {}, card).textContent = 'Saved ' + new Date(rec.savedAt || 0).toLocaleDateString();
      const ar = el('div', { class: 'fz-actrow' }, card);
      el('button', { class: 'btn small', onclick: () => { closeTemplates(); d.blockId = rec.id; loadDesign(d, true); } }, ar, 'Edit');
      const del = el('button', { class: 'btn small', 'data-del': rec.id }, ar, 'Delete');
      del.onclick = async () => {
        if (!del.classList.contains('sure')) {
          del.classList.add('sure');
          del.textContent = 'Delete for good?';
          return;
        }
        await deleteCustomBlock(rec.id);
        if (D.blockId === rec.id) delete D.blockId;
        updateBar();
        openTemplates();
      };
    }
    el('h4', { class: 'fz-tpl-h' }, body).textContent = 'Templates';
  }
  const grid = el('div', { class: 'fz-tpl-grid' }, body);
  for (const t of TEMPLATES) {
    const card = el('button', { class: 'fz-tpl-card', 'data-template': t.id }, grid);
    const a = el('div', { class: 'art' }, card);
    a.appendChild(thumb(migrateDesign(t.make())));
    el('b', {}, card).textContent = t.name;
    el('small', {}, card).textContent = t.desc;
    card.onclick = () => {
      closeTemplates();
      D = migrateDesign(t.make());
      sel = null;
      sels.clear();
      if (MIR().on) autoPair();
      commit();
      view.touched = false;
      fit();
      refreshAll();
    };
  }
  layer.onclick = (e) => {
    if (e.target === layer) closeTemplates();
  };
}
// My pedals (factory-library.js), in the same overlay as the templates
function openMine() {
  if (testing()) setTesting(false);
  openLibrary(ui.tpl, {
    migrate: migrateDesign,
    current: () => D.blockId,
    close: closeTemplates,
    edit: (d, test) => {
      closeTemplates();
      loadDesign(d, true);
      if (test) setTesting(true);
    },
    deleted: (id) => {
      if (D.blockId === id) delete D.blockId;
      updateBar();
    },
  });
}
function closeTemplates() {
  ui.tpl.classList.remove('show');
  ui.tpl.textContent = '';
}

// ------------------------------------------------------------------ keyboard
function onKey(e) {
  const v = document.getElementById('view-factory');
  if (!v || !v.classList.contains('active')) return;
  if (circuitKeysBusy(e)) return; // circuit editor and wiring diagram keys
  const tag = (e.target.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
  const k = e.key.toLowerCase();
  const mod = e.ctrlKey || e.metaKey;
  let handled = true;
  if (k === ' ' && !mod) {
    ui.space = true;
    ui.stageWrap.classList.add('space');
  } else if (testing()) {
    if (k === 'escape') setTesting(false);
    else handled = false;
  } else if (mod && k === 'z') e.shiftKey ? redo() : undo();
  else if (mod && k === 'y') redo();
  else if (mod && k === 'd') duplicateSel();
  else if (mod && k === 'a') selectMany([...D.ctls, ...D.art].filter((x) => !x.hidden && !x.locked).map((x) => x.id));
  else if ((k === 'delete' || k === 'backspace') && sels.size && sel !== 'enc') removeSel();
  else if (k === 'escape') {
    if (ui.tpl.classList.contains('show')) closeTemplates();
    else select(null);
  } else if (k.startsWith('arrow') && sels.size && sel !== 'enc') {
    const items = selItems().filter((f) => !f.item.locked);
    if (!items.length) return;
    const step = e.shiftKey ? 5 : prefs.grid || 0.5;
    for (const f of items) {
      if (f.kind === 'jack') {
        const len = f.item.edge === 'top' || f.item.edge === 'bottom' ? D.enc.w : D.enc.h;
        const d = k === 'arrowleft' || k === 'arrowup' ? -1 : 1;
        f.item.t = clamp(f.item.t + (d * step) / len, 0.04, 0.96);
      } else {
        if (k === 'arrowleft') f.item.x -= step;
        if (k === 'arrowright') f.item.x += step;
        if (k === 'arrowup') f.item.y -= step;
        if (k === 'arrowdown') f.item.y += step;
        f.item.x = r1(f.item.x);
        f.item.y = r1(f.item.y);
      }
    }
    changed(false);
    clearTimeout(ui.nudgeT);
    ui.nudgeT = setTimeout(renderInspector, 250);
  } else if (!mod && (k === '+' || k === '=')) zoomAt(1.2);
  else if (!mod && k === '-') zoomAt(1 / 1.2);
  else if (!mod && k === '0') fit();
  else if (!mod && k === 'm') setMirror(!MIR().on);
  else handled = false;
  if (handled) {
    e.preventDefault();
    e.stopImmediatePropagation();
  }
}

// ------------------------------------------------------------------ build
function build(v) {
  v.textContent = '';
  const root = el('div', { class: 'fz-root' }, v);
  ui.root = root;
  // left
  const left = el('aside', { class: 'fz-left' }, root);
  ui.tabs = el('div', { class: 'seg fz-tabs' }, left);
  for (const [t, n] of [['parts', 'Parts'], ['layers', 'Layers'], ['circuit', 'Circuit']]) {
    const b = el('button', { 'data-t': t }, ui.tabs);
    b.textContent = n;
    b.onclick = () => setTab(t);
  }
  ui.parts = el('div', { class: 'fz-pane' }, left);
  ui.layers = el('div', { class: 'fz-pane fz-layers' }, left);
  ui.circuit = el('div', { class: 'fz-pane fz-circuit' }, left);
  // centre
  const mid = el('div', { class: 'fz-mid' }, root);
  const bar = el('div', { class: 'fz-bar' }, mid);
  ui.name = el('input', { type: 'text', class: 'fz-name', maxlength: 40, title: 'Design name' }, bar);
  ui.name.oninput = () => (D.name = ui.name.value);
  ui.name.onchange = () => commit();
  el('button', { class: 'btn small', id: 'fzTemplates', onclick: openTemplates }, bar, '<i class="ic ic-board"></i>Templates');
  el('button', { class: 'btn small', id: 'fzLibrary', title: 'View, test and edit your saved pedals', onclick: openMine }, bar, '<i class="ic ic-lib"></i>My pedals');
  el('i', { class: 'fz-sep' }, bar);
  ui.undo = el('button', { class: 'icon-btn', id: 'fzUndo', title: 'Undo (Ctrl+Z)', onclick: undo }, bar, '<i class="ic ic-undo"></i>');
  ui.redo = el('button', { class: 'icon-btn', id: 'fzRedo', title: 'Redo (Ctrl+Shift+Z)', onclick: redo }, bar, '<i class="ic ic-redo"></i>');
  el('i', { class: 'fz-sep' }, bar);
  const sn = el('label', { class: 'fz-snap' }, bar, '<span>Snap</span>');
  const ss = el('select', { id: 'fzSnap' }, sn);
  for (const [v2, t] of [[0, 'Off'], [1, '1 mm'], [2.5, '2.5 mm'], [5, '5 mm']]) el('option', { value: v2 }, ss).textContent = t;
  ss.value = prefs.grid;
  ss.onchange = () => {
    prefs.grid = +ss.value;
    savePrefs();
    renderStage();
  };
  // the dot grid belongs to the design (it shows on the board too), so this toggles it for this pedal
  const gb = el('button', { class: 'icon-btn fz-gridbtn', id: 'fzDots', title: 'Dot grid on this pedal (shows on the board too)' }, bar, '<i class="ic fz-ic-grid"></i>');
  ui.gridBtn = gb;
  gb.onclick = () => {
    D.enc.dots = !dotsOn(D.enc);
    changed(false);
    updateBar();
    if (sel === 'enc' || !sel) renderInspector();
  };
  ui.mirrorBtn = el('button', { class: 'icon-btn', id: 'fzMirror', title: 'Mirror mode (M): parts get a twin on the other side' }, bar, '<i class="ic fz-ic-mirror"></i>');
  ui.mirrorBtn.onclick = () => setMirror(!MIR().on);
  ui.mirrorAxis = el('div', { class: 'seg fz-seg fz-axisseg', id: 'fzMirrorAxis' }, bar);
  for (const [a, t, tip] of [['v', 'Left | right', 'Mirror across the vertical centre line'], ['h', 'Top | bottom', 'Mirror across the horizontal centre line']]) {
    const b = el('button', { 'data-v': a, title: tip }, ui.mirrorAxis);
    b.textContent = t;
    b.onclick = () => setMirror(true, a);
  }
  el('div', { class: 'fz-grow' }, bar);
  ui.testBtn = el('button', { class: 'btn small fz-testbtn', id: 'fzTest', title: 'Play the pedal with your guitar' }, bar);
  ui.testBtn.onclick = () => setTesting(!testing());
  ui.saveNew = el('button', { class: 'icon-btn', id: 'fzSaveNew', title: 'Save as a new block' }, bar, '<i class="ic ic-copy"></i>');
  ui.saveNew.onclick = () => saveBlock(true);
  ui.saveBtn = el('button', { class: 'btn small btn-accent', id: 'fzSaveBlock', title: 'Save this pedal to your blocks (Custom in the block list)' }, bar);
  ui.saveBtn.onclick = () => saveBlock(false);

  ui.stageWrap = el('div', { class: 'fz-stagewrap' }, mid);
  ui.stage = svg('svg', { class: 'fz-stage' }, ui.stageWrap);
  ui.viewG = svg('g', {}, ui.stage);
  ui.dimsG = svg('g', { class: 'fz-dims', 'pointer-events': 'none' }, ui.viewG);
  ui.pedalG = svg('g', { class: 'fz-pedal' }, ui.viewG);
  ui.overlayG = svg('g', { class: 'fz-overlay' }, ui.viewG);
  ui.stage.addEventListener('pointerdown', onStageDown);
  ui.stage.addEventListener('wheel', (e) => {
    e.preventDefault();
    const r = ui.stage.getBoundingClientRect();
    zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top);
  }, { passive: false });
  ui.stage.addEventListener('contextmenu', (e) => e.preventDefault());
  const banner = el('div', { class: 'fz-testbanner' }, ui.stageWrap);
  el('b', {}, banner).textContent = 'Testing';
  el('span', { class: 'ok' }, banner).textContent = 'Play your guitar and use the controls. Esc stops.';
  el('span', { class: 'bad' }, banner).textContent = 'The audio engine is not running.';
  const zb = el('div', { class: 'fz-zoom' }, ui.stageWrap);
  el('button', { class: 'icon-btn', title: 'Zoom out (-)', onclick: () => zoomAt(1 / 1.25) }, zb, '<i class="ic ic-minus"></i>');
  ui.zoomVal = el('span', { class: 'fz-zoomval' }, zb);
  el('button', { class: 'icon-btn', title: 'Zoom in (+)', onclick: () => zoomAt(1.25) }, zb, '<i class="ic ic-plus"></i>');
  el('button', { class: 'icon-btn', title: 'Fit (0)', onclick: () => { view.touched = false; fit(); renderOverlay(); } }, zb, '<i class="ic ic-fit"></i>');
  ui.status = el('div', { class: 'fz-status' }, ui.stageWrap);
  el('div', { class: 'fz-hint' }, ui.stageWrap).textContent = 'Scroll to zoom · drag to select · Space or right drag to pan · Alt skips snapping';
  // wiring diagram and circuit editor (factory-circuits.js)
  initCircuitUI(mid, { design: () => D, commit: () => commit(), refresh: () => refreshAll(), select: (id) => select(id), selected: () => [...sels], place: (c) => freeSpot(c), name: (c) => itemName({ kind: 'ctl', item: c }), setTab: (t) => setTab(t), stopTest: () => setTesting(false) });
  // right
  const right = el('aside', { class: 'fz-right' }, root);
  ui.insp = el('div', { class: 'fz-insp' }, right);
  ui.tpl = el('div', { class: 'fz-tpllayer' }, root);

  new ResizeObserver(() => {
    if (!view.touched) fit();
  }).observe(ui.stageWrap);
  window.addEventListener('keydown', onKey, true);
  window.addEventListener('keyup', (e) => {
    if (e.key === ' ' && ui.space) {
      ui.space = false;
      ui.stageWrap.classList.remove('space');
    }
  });
  // leaving the tab ends a test, so the board plays again
  new MutationObserver(() => {
    if (!v.classList.contains('active') && testing()) setTesting(false);
  }).observe(v, { attributes: true, attributeFilter: ['class'] });
  setTab(prefs.tab || 'parts');
  built = true;
}

export function renderFactory() {
  const v = document.getElementById('view-factory');
  if (!v) return;
  try {
    installDefs(document.getElementById('globalDefs'));
  } catch (_) {
    /* the board installs these at startup */
  }
  if (!built) {
    build(v);
    const saved = lsGet(STORE);
    const ok = saved && saved.enc && Array.isArray(saved.ctls) && Array.isArray(saved.jacks) && Array.isArray(saved.art) && saved.title && saved.sub;
    let d = null;
    try {
      d = ok ? migrateDesign(saved) : null;
    } catch (e) {
      console.warn('factory: saved design', e);
    }
    D = d || migrateDesign(TEMPLATES[0].make());
    pruneImages(new Set((D.enc.patterns || []).map((L) => L.img).filter(Boolean)));
    hist.stack = [];
    hist.idx = -1;
    commit();
    refreshAll();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => renderStage());
    window.__tzFactory = {
      design: () => D,
      selection: () => sel,
      selected: () => [...sels],
      load: (d2) => loadDesign(clone(d2), true),
      select: (id, mode) => select(id, mode),
      selectMany: (ids, add) => selectMany(ids, add),
      mirror: (on, axis) => setMirror(on, axis),
      test: (on) => setTesting(on),
      testInfo: () => testInfo(),
      testSet: (cid, val) => playSet(cid, val),
      testing: () => testing(),
      graphOverridden: () => graphOverridden(),
      save: (asNew) => saveBlock(asNew),
      templates: () => TEMPLATES.map((t) => t.id),
      library: () => openMine(),
      template: (id) => clone(migrateDesign(TEMPLATES.find((t) => t.id === id).make())),
      stages: () => Object.keys(STAGES),
    };
  }
  requestAnimationFrame(() => {
    if (!view.touched) fit();
    renderOverlay();
  });
}
// the templates as board blocks (catalog/templates.js)
export { TEMPLATES, migrateDesign };
