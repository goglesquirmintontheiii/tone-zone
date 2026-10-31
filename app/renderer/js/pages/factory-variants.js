// Pedal Factory: the controls in the Parts palette, each with its variants. A tile shows a small dot per variant;
// clicking a dot switches the tile to that variant, so the next click or drag adds that one. The pick is
// remembered in this browser.
import { el, svg, clamp } from '../util.js';
import { drawControl } from './factory-render.js';

const uid = (p) => p + Math.random().toString(36).slice(2, 8);
const base = (o) => Object.assign({ label: '', labelPos: 'below' }, o);
const STORE = 'tz.factory.variants.v1';
const picked = (() => {
  try {
    return JSON.parse(localStorage.getItem(STORE) || '{}') || {};
  } catch (_) {
    return {};
  }
})();
const toggle = (ways, opts, o = {}) => base({ id: uid('t'), kind: 'toggle', ways, orient: 'v', opts, pos: 0, labelPos: 'none', ...o });
const tipVariants = [
  { name: 'Bat', set: { tip: 'bat', orient: 'v' } },
  { name: 'Ball', set: { tip: 'ball', orient: 'v' } },
  { name: 'Paddle', set: { tip: 'paddle', orient: 'v' } },
  { name: 'Sideways', set: { tip: 'bat', orient: 'h' } },
];

/**
 * Every control type in the palette, in palette order. make(D) builds a new control (D = the design, for sizes),
 * sample is [control, scale] for the tile picture, each variant sets a few fields on both (tile: extra fields for the
 * picture only, cap: a caption instead of the type name).
 */
export const CONTROL_TYPES = {
  knob: {
    name: 'Knob', make: () => base({ id: uid('k'), kind: 'knob', style: 'boss', r: 8, value: 0.5, ticks: false, skirtMat: null }), sample: [{ kind: 'knob', r: 9, value: 0.6 }, 1],
    variants: [
      { name: 'Skirted', set: { style: 'boss' } }, { name: 'Ribbed', set: { style: 'mxr' } }, { name: 'Chrome', set: { style: 'chrome' } },
      { name: 'Chicken head', set: { style: 'chicken' }, tile: { r: 8 } }, { name: 'Davies 1900', set: { style: 'davies' } }, { name: 'Witch hat', set: { style: 'witch' } },
    ],
  },
  encoder: {
    name: 'Encoder', make: () => base({ id: uid('e'), kind: 'knob', part: 'encoder', r: 8, value: 0.5 }), sample: [{ kind: 'knob', part: 'encoder', r: 7.5, value: 0.6 }, 1.15],
    variants: [
      { name: 'Knurled', set: { cap: 'knurl', push: true } }, { name: 'Rubber', set: { cap: 'rubber', push: false } }, { name: 'Aluminium', set: { cap: 'alu', push: true } },
      { name: 'LED ring', cap: 'LED ring encoder', set: { cap: 'rubber', push: false, r: 7, ring: true, ringN: 12, ringMode: 'arc', ringColor: '#38f07a', ringIn: 'one' }, tile: { r: 6, value: 0.62 }, scale: 1.2 },
    ],
  },
  trim: {
    name: 'Trim pot', make: () => base({ id: uid('m'), kind: 'trim', r: 3, value: 0.5, labelPos: 'none' }), sample: [{ kind: 'trim', r: 6, value: 0.3 }, 1],
    variants: [{ name: 'Square', set: { look: 'square', color: '#2b6fd6' } }, { name: 'Round', set: { look: 'round', color: '#f2c230' } }, { name: 'Thumbwheel', set: { look: 'thumb', color: '#d8dade' } }],
  },
  slider: {
    name: 'Slider', make: () => base({ id: uid('v'), kind: 'slider', h: 24, w: 5, orient: 'v', value: 0.5 }), sample: [{ kind: 'slider', h: 18, w: 6, value: 0.65 }, 1],
    variants: [
      { name: 'Classic', set: { look: 'classic' } }, { name: 'Fader cap', set: { look: 'fader' } }, { name: 'LED slider', set: { look: 'led', ledColor: '#3fa8ff' } },
      { name: 'Long throw', set: { look: 'long', h: 40 }, tile: { h: 20 } }, { name: 'With scale', set: { look: 'scale' } },
    ],
  },
  strip: {
    name: 'Touch strip', make: () => base({ id: uid('v'), kind: 'slider', part: 'strip', h: 40, w: 6, orient: 'v', value: 0.5, color: '#3fa8ff' }), sample: [{ kind: 'slider', part: 'strip', h: 22, w: 5, value: 0.62 }, 1],
    variants: [{ name: 'Touch strip', set: { look: 'touch' } }, { name: 'Ribbon', set: { look: 'ribbon' } }, { name: 'LED dots', set: { look: 'leds' } }],
  },
  sel: {
    name: 'Rotary switch', make: () => base({ id: uid('r'), kind: 'sel', n: 4, r: 7, style: 'boss', opts: ['1', '2', '3', '4'], pos: 0 }), sample: [{ kind: 'sel', n: 5, r: 7, style: 'mxr', opts: ['', '', '', '', ''], pos: 1, marks: true }, 1],
    variants: [
      { name: 'Classic', set: { look: 'classic' } }, { name: 'Pointer', set: { look: 'pointer' } }, { name: 'Chicken head', set: { look: 'chicken' } },
      { name: 'Lit ring', set: { look: 'ring' } }, { name: 'Readout', set: { look: 'lcd' }, scale: 0.85 },
    ],
  },
  steps: {
    name: 'Step buttons', make: () => base({ id: uid('r'), kind: 'sel', part: 'steps', n: 4, opts: ['1', '2', '3', '4'], pos: 0, ledColor: '#3ddc84', labelPos: 'none' }), sample: [{ kind: 'sel', part: 'steps', n: 3, pos: 1, opts: [] }, 1],
    variants: [{ name: 'Rubber', set: { look: 'rubber' } }, { name: 'Lit pads', set: { look: 'lit' } }, { name: 'Round', set: { look: 'round' } }],
  },
  toggle2: { name: '2 way toggle', make: () => toggle(2, ['ON', 'OFF']), sample: [{ kind: 'toggle', ways: 2, opts: ['', ''], pos: 0 }, 1.15], variants: tipVariants },
  toggle3: { name: '3 way toggle', make: () => toggle(3, ['A', 'B', 'C'], { pos: 1 }), sample: [{ kind: 'toggle', ways: 3, opts: ['', '', ''], pos: 0 }, 1.15], variants: tipVariants },
  button: {
    name: 'Push button', make: () => base({ id: uid('b'), kind: 'button', r: 4, shape: 'round', color: '#2a2c31', led: false, ledColor: '#3fa8ff', on: false }), sample: [{ kind: 'button', r: 6, color: '#2a2c31' }, 1],
    variants: [
      { name: 'Round', set: { shape: 'round' } }, { name: 'Square', set: { shape: 'square' } }, { name: 'Pill', set: { shape: 'pill', w: 12, h: 6 }, tile: { w: 18, h: 8 } },
      { name: 'Hex', set: { shape: 'hex' } }, { name: 'With LED', set: { shape: 'round', led: true, on: true }, tile: { r: 5 }, scale: 0.9 },
    ],
  },
  arcade: {
    name: 'Arcade button', make: () => base({ id: uid('b'), kind: 'button', part: 'arcade', r: 7, color: '#d0312d', led: true, on: false }), sample: [{ kind: 'button', part: 'arcade', r: 8.5, color: '#d0312d' }, 1],
    variants: [{ name: 'Round', set: { shape: 'round' } }, { name: 'Square', set: { shape: 'square', color: '#f5cb2f' }, tile: { r: 7.5 } }, { name: 'Big dome', set: { shape: 'dome', r: 10, color: '#2f7de0' }, tile: { r: 9 } }],
  },
  foot: {
    name: 'Footswitch', make: () => base({ id: uid('f'), kind: 'foot', style: 'stomp', r: 7, labelPos: 'none' }), sample: [{ kind: 'foot', r: 7.5 }, 1],
    variants: [
      { name: 'Metal', set: { style: 'stomp' } }, { name: 'Soft touch', set: { style: 'soft' } },
      { name: 'Rubber pad', set: { style: 'rc', w: 34, h: 30 }, tile: { w: 22, h: 20 } }, { name: 'Rocker', set: { style: 'ts', w: 34, h: 30 }, tile: { w: 22, h: 20 } },
    ],
  },
  pedal: {
    name: 'Foot pedal',
    make: (D) => base({ id: uid('p'), kind: 'pedal', w: clamp(Math.round(D.enc.w * 0.6), 20, 90), h: clamp(Math.round(D.enc.h * 0.45), 30, 140), value: 0.5, color: '#1b1c1f', logo: '', labelPos: 'none' }),
    sample: [{ kind: 'pedal', w: 30, h: 46, value: 0.5, color: '#1b1c1f' }, 0.5],
    variants: [{ name: 'Rubber pad', set: { grip: 'pad' } }, { name: 'Ribbed', set: { grip: 'ridges' } }, { name: 'Toe plate', set: { grip: 'plate' } }, { name: 'Smooth', set: { grip: 'none', color: '#3a3d42' } }],
  },
  xy: {
    name: 'XY pad', make: () => base({ id: uid('x'), kind: 'xy', vx: 0.5, vy: 0.5, maps: [] }), sample: [{ kind: 'xy', vx: 0.68, vy: 0.62 }, 1],
    variants: [
      { name: 'XY pad', set: { look: 'pad', w: 26, h: 26, color: '#3fa8ff' }, tile: { w: 20, h: 17 } },
      { name: 'Glow pad', set: { look: 'glow', w: 26, h: 26, color: '#b45cff' }, tile: { w: 20, h: 17 } },
      { name: 'Joystick', cap: 'Joystick', set: { look: 'stick', r: 9 }, tile: { r: 8, vx: 0.72, vy: 0.7 } },
      { name: 'Thumbstick', cap: 'Thumbstick', set: { look: 'thumb', r: 9 }, tile: { r: 8, vx: 0.6, vy: 0.66 } },
    ],
  },
  led: {
    name: 'LED', make: () => base({ id: uid('l'), kind: 'led', r: 2.5, color: '#ff2a1a', on: true, labelPos: 'none', bind: 'on' }), sample: [{ kind: 'led', r: 4, color: '#ff2a1a', on: true }, 1],
    variants: [
      { name: 'Round', set: { look: 'round' } }, { name: 'Flat top', set: { look: 'flat', color: '#3fa8ff' } }, { name: 'Square', set: { look: 'square', color: '#3ddc84' } },
      { name: 'Bar', set: { look: 'bar', w: 8, h: 2.4, color: '#ffb020' }, tile: { w: 16, h: 4.5 } }, { name: 'Jewel lamp', set: { look: 'jewel' }, tile: { r: 3.5 } },
      { name: 'Meter bar', set: { look: 'meter', n: 8 }, tile: { n: 7 }, scale: 1.2 },
    ],
  },
  meter: {
    name: 'Needle meter', make: () => base({ id: uid('k'), kind: 'knob', part: 'meter', w: 28, h: 18, value: 0.4 }), sample: [{ kind: 'knob', part: 'meter', w: 24, h: 16, value: 0.62 }, 1],
    variants: [{ name: 'VU', set: { look: 'vu' } }, { name: 'Dark', set: { look: 'dark' } }, { name: 'Round gauge', set: { look: 'round', h: 20 }, tile: { h: 20 } }],
  },
  screen: {
    name: 'Screen', make: () => base({ id: uid('s'), kind: 'screen', w: 30, h: 14, text: 'HELLO', labelPos: 'none' }), sample: [{ kind: 'screen', w: 22, h: 12, text: '120\nBPM' }, 1],
    variants: [{ name: 'OLED', set: { type: 'oled' } }, { name: 'LCD', set: { type: 'lcd' } }, { name: 'Amber', set: { type: 'amber' } }, { name: 'Colour', set: { type: 'tft' } }],
  },
  dip: {
    name: 'DIP switch', make: () => base({ id: uid('d'), kind: 'dip', n: 4, bits: [1, 0, 0, 1], maps: [], labelPos: 'none' }), sample: [{ kind: 'dip', n: 4, bits: [1, 0, 1, 0] }, 1.6],
    variants: [
      { name: 'Slide', set: { look: 'slide', color: '#c8102e' } }, { name: 'Piano', set: { look: 'piano', color: '#1f4fbf' } },
      { name: 'Toggle bank', cap: 'Toggle bank', set: { look: 'toggle' }, tile: { bits: [1, 0, 1, 1] }, scale: 1.25 },
    ],
  },
};

/** The variant index the tile of type k shows now. */
export function variantOf(k) {
  const t = CONTROL_TYPES[k];
  return t ? clamp(picked[k] | 0, 0, t.variants.length - 1) : 0;
}
export function setVariant(k, i) {
  picked[k] = i;
  try {
    localStorage.setItem(STORE, JSON.stringify(picked));
  } catch (_) {
    /* storage may be unavailable */
  }
}
/** A new control of type k in variant i (default: the one the tile shows). */
export function makeControl(k, D, i = variantOf(k)) {
  const t = CONTROL_TYPES[k];
  return Object.assign(t.make(D), JSON.parse(JSON.stringify(t.variants[i].set)));
}
// for factory.js: { key: { name, make(D) } }
export const PARTS = Object.fromEntries(Object.entries(CONTROL_TYPES).map(([k, t]) => [k, { name: t.name, make: (D) => makeControl(k, D) }]));

/** The tile picture and caption of type k in variant i. */
export function drawSample(s, k, th, i = variantOf(k)) {
  const t = CONTROL_TYPES[k], v = t.variants[i];
  const c = { id: 'tile-' + k, x: 0, y: 0, label: '', labelPos: 'none', ...t.sample[0], ...v.set, ...(v.tile || {}) };
  drawControl(svg('g', { transform: `scale(${v.scale || t.sample[1]})`, 'pointer-events': 'none' }, s), c, th);
}

/** A palette tile with a dot per variant. onDown(e, tile) starts the add or drag. */
export function controlTile(parent, k, th, onDown) {
  const t = CONTROL_TYPES[k];
  const tile = el('div', { class: 'fz-tile fz-vtile', 'data-part': k }, parent);
  const s = svg('svg', { viewBox: '-14 -14 28 28' }, tile);
  const cap = el('span', {}, tile);
  const dots = el('div', { class: 'fz-vdots' }, tile);
  const show = () => {
    const i = variantOf(k), v = t.variants[i];
    s.textContent = '';
    drawSample(s, k, th, i);
    cap.textContent = v.cap || t.name;
    tile.dataset.variant = i;
    tile.title = `${t.name}: ${v.name}. Click to add, or drag onto the pedal`;
    dots.querySelectorAll('i').forEach((d, j) => d.classList.toggle('on', j === i));
  };
  t.variants.forEach((v, i) => {
    const d = el('i', { 'data-var': i, title: v.name }, dots);
    // the dots switch the tile; they never add a part
    d.addEventListener('pointerdown', (e) => e.stopPropagation());
    d.addEventListener('click', (e) => {
      e.stopPropagation();
      setVariant(k, i);
      show();
    });
  });
  tile.addEventListener('pointerdown', (e) => onDown(e, tile));
  show();
  return tile;
}
