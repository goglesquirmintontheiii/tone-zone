// Pedal Factory tab: design your own pedal. UI demo for now: no audio, nothing goes to the catalog yet.
// The design is kept in memory (and in localStorage when it works). Units are millimetres.
import { el, svg, clamp, luminance } from '../util.js';
import { drawKnob, drawToggle, drawButton, drawFoot, drawLed } from '../gfx/controls.js';
import { installDefs } from '../gfx/defs.js';
import { normalize, materialFill, multiFill, wearOverlay, paletteFor } from '../gfx/materials.js';
import { materialPicker } from '../ui/material-picker.js';
import { knobPart, buttonPart, footPart, togglePart, ledPart, bezel, nutPaint, BUTTON_SHAPES, TOGGLE_TIPS } from './factory-parts.js';
import { renderPatterns, patternInspector, pruneImages } from './factory-patterns.js';

const STORE = 'tz.factory.design.v1';
const PREFS = 'tz.factory.prefs.v1';

// ------------------------------------------------------------------ catalogues
const SIZES = [
  { id: '1590A', w: 39, h: 93, note: 'Mini' },
  { id: '1590B', w: 60, h: 112, note: 'Small' },
  { id: '125B', w: 66, h: 122, note: 'Classic' },
  { id: '1590BB', w: 94, h: 119, note: 'Wide' },
  { id: '1590XX', w: 121, h: 145, note: 'Big box' },
  { id: '1590DD', w: 188, h: 120, note: 'Dual' },
];
const SHAPES = [
  ['box', 'Box'], ['wedge', 'Wedge'], ['slant', 'Slant'], ['chamfer', 'Chamfer'],
  ['arch', 'Arch'], ['coffin', 'Coffin'], ['pill', 'Pill'], ['shield', 'Shield'],
];
const ENC_SCALE = 0.44; // material tile size on the enclosure (mm per board pixel)
const BODY_SWATCHES = ['#1d1f24', '#f2f0ea', '#c9302c', '#e56b1f', '#f2c230', '#3a9a5b', '#1f8a8a', '#2b7bd6', '#5a3fb0', '#d6487e', '#8d99a8', '#8a5a2b'];
const INK_SWATCHES = ['#111111', '#f4f1e8', '#ffffff', '#f2c230', '#c9302c', '#2b7bd6', '#3ddc84', '#8d99a8'];
const LED_COLORS = ['#ff2a1a', '#3ddc84', '#3fa8ff', '#ffb020', '#f4f4ff', '#b45cff'];
const FONTS = [
  ["'Barlow Condensed', sans-serif", 'Barlow Condensed'],
  ["'Oswald', sans-serif", 'Oswald'],
  ["'Inter', sans-serif", 'Inter'],
  ["'Dancing Script', cursive", 'Script'],
  ["'Share Tech Mono', monospace", 'Mono'],
  ["Georgia, 'DejaVu Serif', serif", 'Serif'],
];
const KNOB_STYLES = [
  ['boss', 'Skirted'], ['mxr', 'Ribbed'], ['strymon', 'Soft touch'], ['chrome', 'Chrome'], ['fender', 'Chrome ring'],
  ['marshall', 'Gold cap'], ['white', 'White'], ['red', 'Red'], ['cream', 'Cream'], ['chicken', 'Chicken head'], ['vox', 'Pointer'],
];
const KNOB_SIZES = [[5.5, 'S'], [8, 'M'], [10.5, 'L'], [13, 'XL']];
const SCREENS = {
  oled: { name: 'OLED', bg: '#04070a', fg: '#7fe8ff' },
  lcd: { name: 'LCD', bg: '#9fbf3a', fg: '#1d2a08' },
  amber: { name: 'Amber', bg: '#1c1403', fg: '#ffb020' },
  tft: { name: 'Colour', bg: '#0d1730', fg: '#ffffff' },
};
const ART_KINDS = [
  ['rect', 'Box'], ['circle', 'Circle'], ['ring', 'Ring'], ['triangle', 'Triangle'], ['diamond', 'Diamond'], ['star', 'Star'],
  ['burst', 'Burst'], ['bolt', 'Bolt'], ['chevron', 'Chevron'], ['heart', 'Heart'], ['stripe', 'Stripe'], ['stripes', 'Twin stripe'],
  ['wave', 'Wave'], ['dots', 'Dots'],
];
const JACKS = {
  in: { name: 'Input', label: 'IN', edge: 'right' },
  out: { name: 'Output', label: 'OUT', edge: 'left' },
  stereo: { name: 'Stereo out', label: 'OUT R', edge: 'left' },
  exp: { name: 'Expression', label: 'EXP', edge: 'top' },
  power: { name: 'Power', label: '9V', edge: 'top' },
};
const EFFECTS = [
  ['boost', 'Boost'], ['drive', 'Overdrive'], ['dist', 'Distortion'], ['fuzz', 'Fuzz'], ['comp', 'Compressor'], ['eq', 'EQ'],
  ['chorus', 'Chorus'], ['phaser', 'Phaser'], ['flanger', 'Flanger'], ['trem', 'Tremolo'], ['delay', 'Delay'], ['reverb', 'Reverb'],
  ['octave', 'Octave'], ['pitch', 'Pitch'], ['filter', 'Filter'], ['synth', 'Synth'],
];
const PARAMS = {
  boost: ['Level', 'Bass', 'Treble', 'Bright'],
  drive: ['Drive', 'Tone', 'Level', 'Bass', 'Mid', 'Treble', 'Clipping', 'Voice'],
  dist: ['Gain', 'Tone', 'Level', 'Filter', 'Contour', 'Clipping'],
  fuzz: ['Fuzz', 'Tone', 'Volume', 'Bias', 'Gate', 'Octave'],
  comp: ['Sustain', 'Attack', 'Release', 'Level', 'Blend', 'Ratio'],
  eq: ['Low', 'Low mid', 'Mid', 'High mid', 'High', 'Level', 'Q'],
  chorus: ['Rate', 'Depth', 'Mix', 'Tone', 'Mode'],
  phaser: ['Rate', 'Depth', 'Feedback', 'Stages', 'Mix'],
  flanger: ['Rate', 'Depth', 'Manual', 'Regen', 'Mix'],
  trem: ['Rate', 'Depth', 'Shape', 'Level'],
  delay: ['Time', 'Repeats', 'Mix', 'Mod', 'Tone', 'Tap', 'Subdivision', 'Hold'],
  reverb: ['Decay', 'Mix', 'Pre-delay', 'Tone', 'Mod', 'Shimmer', 'Freeze'],
  octave: ['Sub', 'Dry', 'Up', 'Tone'],
  pitch: ['Interval', 'Mix', 'Detune', 'Key'],
  filter: ['Sensitivity', 'Range', 'Q', 'Mode', 'Mix'],
  synth: ['Waveform', 'Cutoff', 'Resonance', 'Glide', 'Attack', 'Mix'],
};
const COMMON_PARAMS = ['Bypass', 'Tap tempo', 'Preset', 'Expression'];
const BLOCKS = {
  buffer: ['Input buffer', 'io'], gain: ['Gain stage', 'drive'], opamp: ['Op-amp clipper', 'drive'], diode: ['Diode clipper', 'drive'],
  fuzz: ['Transistor fuzz', 'drive'], tone: ['Tone stack', 'eq'], eq: ['EQ band', 'eq'], filter: ['Filter', 'eq'],
  env: ['Envelope follower', 'mod'], lfo: ['LFO', 'mod'], delay: ['Delay line', 'time'], pitch: ['Pitch shifter', 'time'],
  reverb: ['Reverb tank', 'time'], vca: ['VCA', 'dyn'], comp: ['Compressor', 'dyn'], gate: ['Noise gate', 'dyn'],
  octave: ['Octave divider', 'drive'], osc: ['Oscillator', 'mod'], mix: ['Wet/dry mix', 'io'], level: ['Output level', 'io'],
};
const BLOCK_CATS = { io: 'In / out', drive: 'Drive', eq: 'Tone', mod: 'Modulation', time: 'Time', dyn: 'Dynamics' };
const STACKS = {
  boost: ['buffer', 'gain', 'tone', 'level'], drive: ['buffer', 'gain', 'diode', 'tone', 'level'], dist: ['buffer', 'opamp', 'diode', 'tone', 'level'],
  fuzz: ['fuzz', 'tone', 'level'], comp: ['buffer', 'comp', 'mix', 'level'], eq: ['buffer', 'eq', 'eq', 'eq', 'level'],
  chorus: ['buffer', 'lfo', 'delay', 'mix'], phaser: ['buffer', 'lfo', 'filter', 'mix'], flanger: ['buffer', 'lfo', 'delay', 'mix'],
  trem: ['buffer', 'lfo', 'vca', 'level'], delay: ['buffer', 'delay', 'filter', 'mix', 'level'], reverb: ['buffer', 'reverb', 'filter', 'mix'],
  octave: ['buffer', 'octave', 'mix'], pitch: ['buffer', 'pitch', 'mix'], filter: ['buffer', 'env', 'filter', 'mix'], synth: ['env', 'osc', 'filter', 'vca', 'level'],
};

// ------------------------------------------------------------------ small helpers
const uid = (p) => p + Math.random().toString(36).slice(2, 8);
const clone = (o) => JSON.parse(JSON.stringify(o));
const r1 = (v) => Math.round(v * 10) / 10;
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
const lum = (c) => {
  try {
    return luminance(c);
  } catch (_) {
    return 0.5;
  }
};

// ------------------------------------------------------------------ enclosure geometry
function shapePoints(shape, w, h) {
  const arc = (cx, cy, rx, ry, a0, a1, n = 18) => {
    const out = [];
    for (let i = 0; i <= n; i++) {
      const a = a0 + ((a1 - a0) * i) / n;
      out.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
    }
    return out;
  };
  switch (shape) {
    case 'wedge': {
      const i = w * 0.14;
      return [[i, 0], [w - i, 0], [w, h], [0, h]];
    }
    case 'slant':
      return [[0, h * 0.12], [w, 0], [w, h], [0, h]];
    case 'chamfer': {
      const c = Math.min(w, h) * 0.17;
      return [[c, 0], [w - c, 0], [w, c], [w, h - c], [w - c, h], [c, h], [0, h - c], [0, c]];
    }
    case 'arch': {
      const rise = Math.min(w * 0.5, h * 0.3);
      return [[0, h], ...arc(w / 2, rise, w / 2, rise, Math.PI, Math.PI * 2, 24), [w, h]];
    }
    case 'coffin':
      return [[w * 0.28, 0], [w * 0.72, 0], [w, h * 0.26], [w * 0.8, h], [w * 0.2, h], [0, h * 0.26]];
    case 'pill': {
      if (h >= w) {
        const r = w / 2;
        return [...arc(r, r, r, r, Math.PI, Math.PI * 2), ...arc(r, h - r, r, r, 0, Math.PI)];
      }
      const r = h / 2;
      return [...arc(w - r, r, r, r, -Math.PI / 2, Math.PI / 2), ...arc(r, r, r, r, Math.PI / 2, Math.PI * 1.5)];
    }
    case 'shield': {
      const top = h * 0.62;
      return [[0, 0], [w, 0], [w, top], ...arc(w / 2, top, w / 2, h - top, 0, Math.PI, 20).slice(1, -1), [0, top]];
    }
    default:
      return [[0, 0], [w, 0], [w, h], [0, h]];
  }
}
// polygon with rounded corners (quadratic corners, radius clamped to half of each edge)
function roundPoly(pts, r) {
  const n = pts.length;
  const seg = [];
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n];
    const d1 = Math.hypot(p0[0] - p1[0], p0[1] - p1[1]) || 1, d2 = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) || 1;
    const rr = Math.min(r, d1 / 2, d2 / 2);
    const a = [p1[0] + ((p0[0] - p1[0]) / d1) * rr, p1[1] + ((p0[1] - p1[1]) / d1) * rr];
    const b = [p1[0] + ((p2[0] - p1[0]) / d2) * rr, p1[1] + ((p2[1] - p1[1]) / d2) * rr];
    seg.push({ a, p1, b });
  }
  const f = (p) => `${r1(p[0] * 10) / 10},${r1(p[1] * 10) / 10}`;
  let d = `M${f(seg[0].a)}`;
  seg.forEach((s, i) => {
    if (i > 0) d += `L${f(s.a)}`;
    d += `Q${f(s.p1)} ${f(s.b)}`;
  });
  return d + 'Z';
}
// where a jack sits on an edge: point on the outline plus the outward angle
function edgePoint(pts, w, h, edge, t) {
  const horiz = edge === 'top' || edge === 'bottom';
  const v = horiz ? t * w : t * h;
  let best = null;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const [ka, kb] = horiz ? [a[0], b[0]] : [a[1], b[1]];
    if (ka === kb || v < Math.min(ka, kb) || v > Math.max(ka, kb)) continue;
    const u = (v - ka) / (kb - ka);
    const x = a[0] + (b[0] - a[0]) * u, y = a[1] + (b[1] - a[1]) * u;
    const score = edge === 'top' ? y : edge === 'bottom' ? -y : edge === 'left' ? x : -x;
    if (!best || score < best.score) {
      const dx = b[0] - a[0], dy = b[1] - a[1];
      best = { x, y, score, ang: (Math.atan2(-dx, dy) * 180) / Math.PI };
    }
  }
  if (!best) best = { x: horiz ? v : edge === 'left' ? 0 : w, y: horiz ? (edge === 'top' ? 0 : h) : v, ang: { top: -90, bottom: 90, left: 180, right: 0 }[edge] };
  return best;
}

// ------------------------------------------------------------------ art shapes (unit box -0.5..0.5 scaled to w x h)
function artPath(a) {
  const { w, h } = a;
  const P = (pts) => 'M' + pts.map(([u, v]) => `${r1(u * w)},${r1(v * h)}`).join('L') + 'Z';
  const star = (n, inner) => {
    const pts = [];
    for (let i = 0; i < n * 2; i++) {
      const ang = (Math.PI * i) / n - Math.PI / 2;
      const rr = i % 2 ? inner : 0.5;
      pts.push([Math.cos(ang) * rr, Math.sin(ang) * rr]);
    }
    return P(pts);
  };
  const ell = (rx, ry) => `M${-rx},0a${rx},${ry} 0 1,0 ${rx * 2},0a${rx},${ry} 0 1,0 ${-rx * 2},0Z`;
  switch (a.kind) {
    case 'circle':
      return ell(w / 2, h / 2);
    case 'ring': {
      const t = a.thick ?? 0.18;
      return ell(w / 2, h / 2) + ell((w / 2) * (1 - t * 2), (h / 2) * (1 - t * 2));
    }
    case 'triangle':
      return P([[0, -0.5], [0.5, 0.5], [-0.5, 0.5]]);
    case 'diamond':
      return P([[0, -0.5], [0.5, 0], [0, 0.5], [-0.5, 0]]);
    case 'star':
      return star(5, 0.2);
    case 'burst':
      return star(14, 0.36);
    case 'bolt':
      return P([[-0.05, -0.5], [0.32, -0.5], [0.1, -0.08], [0.36, -0.08], [-0.22, 0.5], [-0.03, 0.04], [-0.3, 0.04]]);
    case 'chevron':
      return P([[-0.5, -0.5], [0, -0.05], [0.5, -0.5], [0.5, -0.05], [0, 0.45], [-0.5, -0.05]]);
    case 'heart': {
      const m = (u, v) => `${r1(u * w)},${r1(v * h)}`;
      return `M${m(0, 0.45)}C${m(-0.75, -0.05)} ${m(-0.4, -0.75)} ${m(0, -0.25)}C${m(0.4, -0.75)} ${m(0.75, -0.05)} ${m(0, 0.45)}Z`;
    }
    case 'stripes':
      return P([[-0.5, -0.5], [0.5, -0.5], [0.5, -0.12], [-0.5, -0.12]]) + P([[-0.5, 0.12], [0.5, 0.12], [0.5, 0.5], [-0.5, 0.5]]);
    case 'wave': {
      const top = [], bot = [];
      for (let i = 0; i <= 24; i++) {
        const u = -0.5 + i / 24;
        const s = Math.sin(u * Math.PI * 4) * 0.25;
        top.push([u, s - 0.25]);
        bot.unshift([u, s + 0.25]);
      }
      return P([...top, ...bot]);
    }
    case 'dots': {
      let d = '';
      const n = 5;
      for (let i = 0; i < n; i++)
        for (let j = 0; j < n; j++) {
          const rr = Math.min(w, h) / n / 2 * (0.35 + 0.55 * ((i + j) / (2 * n - 2)));
          const cx = -w / 2 + (w / n) * (i + 0.5), cy = -h / 2 + (h / n) * (j + 0.5);
          d += `M${r1(cx - rr)},${r1(cy)}a${r1(rr)},${r1(rr)} 0 1,0 ${r1(rr * 2)},0a${r1(rr)},${r1(rr)} 0 1,0 ${r1(-rr * 2)},0Z`;
        }
      return d;
    }
    default:
      return P([[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]]);
  }
}

// ------------------------------------------------------------------ templates
const txt = (o) => Object.assign({ text: '', font: FONTS[0][0], size: 8, color: '#f4f1e8', weight: 800, ls: 0.6, italic: false, outline: 0, outlineColor: '#111111', x: 0, y: 0, rot: 0, hidden: false, locked: false }, o);
const knob = (x, y, label, o = {}) => Object.assign({ id: uid('k'), kind: 'knob', x, y, style: 'boss', r: 8, value: 0.5, ticks: false, label, labelPos: 'below', param: label ? label[0] + label.slice(1).toLowerCase() : '' }, o);
const stomp = (x, y, o = {}) => Object.assign({ id: uid('f'), kind: 'foot', x, y, style: 'stomp', r: 7, label: '', labelPos: 'none', param: 'Bypass' }, o);
const led = (x, y, color, o = {}) => Object.assign({ id: uid('l'), kind: 'led', x, y, r: 2.5, color, on: true, label: '', labelPos: 'none', param: '' }, o);
const jack = (kind, edge, t, o = {}) => Object.assign({ id: uid('j'), kind, edge, t, label: JACKS[kind].label }, o);
const art = (kind, x, y, w, h, color, o = {}) => Object.assign({ id: uid('a'), kind, x, y, w, h, rot: 0, color, opacity: 1, hidden: false, locked: false }, o);
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
      circuit: { type: 'drive', blocks: STACKS.drive.map((k) => ({ id: uid('b'), kind: k })) },
    },
    o
  );
}
const TEMPLATES = [
  {
    id: 'drive', name: 'Classic Drive', desc: '125B, three knobs, one stomp',
    make: () => base({
      name: 'Classic Drive',
      enc: { size: '125B', w: 66, h: 122, shape: 'box', radius: 3, finish: 'solid', color: '#3a9a5b', color2: '#1f8a8a', angle: 90, flake: 0.5 },
      title: txt({ id: 'title', text: 'OVERDRIVE', x: 33, y: 62, size: 8.5 }),
      sub: txt({ id: 'sub', text: 'Classic Drive', font: FONTS[3][0], x: 33, y: 71, size: 5, weight: 700, ls: 0.2 }),
      art: [art('rect', 33, 66, 66, 22, '#2b7444', { opacity: 0.9 })],
      ctls: [knob(13, 22, 'LEVEL'), knob(33, 22, 'TONE'), knob(53, 22, 'DRIVE'), led(33, 44, '#ff2a1a'), stomp(33, 100)],
      jacks: [jack('in', 'right', 0.42), jack('out', 'left', 0.42), jack('power', 'top', 0.5)],
    }),
  },
  {
    id: 'boost', name: 'Mini Boost', desc: '1590A, one big knob, sparkle red',
    make: () => base({
      name: 'Mini Boost',
      enc: { size: '1590A', w: 39, h: 93, shape: 'box', radius: 2.5, finish: 'sparkle', color: '#c9302c', color2: '#5a3fb0', angle: 90, flake: 0.6 },
      title: txt({ id: 'title', text: 'BOOST', font: FONTS[1][0], weight: 700, x: 19.5, y: 51, size: 7, ls: 1 }),
      circuit: { type: 'boost', blocks: STACKS.boost.map((k) => ({ id: uid('b'), kind: k })) },
      ctls: [knob(19.5, 25, 'LEVEL', { style: 'chrome', r: 10.5 }), led(19.5, 62, '#3fa8ff'), stomp(19.5, 77)],
      jacks: [jack('in', 'right', 0.25), jack('out', 'left', 0.25), jack('power', 'top', 0.5)],
    }),
  },
  {
    id: 'fuzz', name: 'Fuzz Wedge', desc: 'Wedge shape, hammertone, 3 way toggle',
    make: () => base({
      name: 'Fuzz Wedge',
      enc: { size: 'custom', w: 100, h: 120, shape: 'wedge', radius: 5, finish: 'hammer', color: '#c8641e', color2: '#5a3fb0', angle: 90, flake: 0.5 },
      labels: { font: FONTS[0][0], size: 3.6, color: '#111111' },
      title: txt({ id: 'title', text: 'FUZZ', font: FONTS[1][0], weight: 700, x: 50, y: 69, size: 15, color: '#1d1f24', ls: 1.5 }),
      sub: txt({ id: 'sub', text: 'germanium', font: FONTS[3][0], weight: 700, x: 50, y: 80, size: 5, color: '#1d1f24', hidden: false }),
      art: [art('burst', 50, 71, 46, 46, '#f2c230', { opacity: 0.95 }), art('stripes', 50, 113, 100, 6, '#1d1f24')],
      circuit: { type: 'fuzz', blocks: STACKS.fuzz.map((k) => ({ id: uid('b'), kind: k })) },
      ctls: [
        knob(30, 26, 'FUZZ', { style: 'chicken', r: 9 }), knob(70, 26, 'VOLUME', { style: 'chicken', r: 9 }),
        { id: uid('t'), kind: 'toggle', x: 50, y: 30, ways: 3, orient: 'v', opts: ['LO', 'MID', 'HI'], pos: 1, label: '', labelPos: 'none', param: 'Voice' },
        stomp(50, 100, { r: 7.5 }),
      ],
      jacks: [jack('in', 'right', 0.4), jack('out', 'left', 0.4), jack('power', 'top', 0.5)],
    }),
  },
  {
    id: 'delay', name: 'Twin Echo', desc: '1590DD, screen, two stomps, stereo',
    make: () => base({
      name: 'Twin Echo',
      enc: { size: '1590DD', w: 188, h: 120, shape: 'box', radius: 4, finish: 'brushed', color: '#8d99a8', color2: '#5a3fb0', angle: 90, flake: 0.5 },
      labels: { font: FONTS[0][0], size: 3.6, color: '#111111' },
      title: txt({ id: 'title', text: 'TWIN ECHO', x: 94, y: 97, size: 9, color: '#1d1f24', ls: 1.2 }),
      sub: txt({ id: 'sub', text: 'stereo delay', x: 94, y: 105, size: 3.8, weight: 500, color: '#1d1f24', hidden: false }),
      art: [art('rect', 94, 6, 188, 3, '#1d1f24')],
      circuit: { type: 'delay', blocks: STACKS.delay.map((k) => ({ id: uid('b'), kind: k })) },
      ctls: [
        knob(22, 26, 'TIME', { style: 'mxr' }), knob(48, 26, 'REPEATS', { style: 'mxr' }), knob(140, 26, 'MIX', { style: 'mxr' }), knob(166, 26, 'MOD', { style: 'mxr' }),
        knob(22, 56, 'TONE', { style: 'mxr', r: 5.5 }), knob(166, 56, 'LEVEL', { style: 'mxr', r: 5.5 }),
        { id: uid('s'), kind: 'screen', x: 94, y: 27, w: 48, h: 18, type: 'oled', text: 'TIME 420ms\nFDBK 38%', label: '', labelPos: 'none', param: '' },
        { id: uid('t'), kind: 'toggle', x: 94, y: 56, ways: 2, orient: 'h', opts: ['DIG', 'TAPE'], pos: 1, label: '', labelPos: 'none', param: 'Voice' },
        led(50, 80, '#3ddc84'), led(138, 80, '#ff2a1a'),
        stomp(50, 100, { label: 'BYPASS', labelPos: 'below' }), stomp(138, 100, { label: 'TAP', labelPos: 'below', param: 'Tap tempo' }),
      ],
      jacks: [jack('in', 'right', 0.35), jack('out', 'left', 0.3, { label: 'OUT L' }), jack('stereo', 'left', 0.62), jack('exp', 'top', 0.3), jack('power', 'top', 0.6)],
    }),
  },
  {
    id: 'synth', name: 'Synth Box', desc: '1590XX, colour screen, DIP switches',
    make: () => base({
      name: 'Synth Box',
      enc: { size: '1590XX', w: 121, h: 145, shape: 'box', radius: 6, finish: 'gradient', color: '#5a3fb0', color2: '#d6487e', angle: 120, flake: 0.5 },
      labels: { font: FONTS[4][0], size: 3.2, color: '#ffffff' },
      title: txt({ id: 'title', text: 'SYNTH BOX', font: FONTS[4][0], weight: 400, x: 60.5, y: 108, size: 8, color: '#ffffff', ls: 1.5 }),
      art: [art('wave', 60.5, 109, 150, 18, '#ffffff', { opacity: 0.14, rot: -8 }), art('dots', 100, 120, 26, 26, '#ffffff', { opacity: 0.18 })],
      circuit: { type: 'synth', blocks: STACKS.synth.map((k) => ({ id: uid('b'), kind: k })) },
      ctls: [
        { id: uid('s'), kind: 'screen', x: 60.5, y: 25, w: 50, h: 22, type: 'tft', text: 'SAW 440Hz\nCUT 62%', label: '', labelPos: 'none', param: '' },
        { id: uid('t'), kind: 'toggle', x: 17, y: 25, ways: 3, orient: 'v', opts: ['SAW', 'SQR', 'TRI'], pos: 0, label: '', labelPos: 'none', param: 'Waveform' },
        led(104, 25, '#b45cff', { label: 'GATE', labelPos: 'above' }),
        knob(19, 58, 'CUTOFF', { style: 'chrome', ticks: true, param: 'Cutoff' }), knob(46, 58, 'RES', { style: 'chrome', ticks: true, param: 'Resonance' }),
        knob(75, 58, 'GLIDE', { style: 'chrome', ticks: true, param: 'Glide' }), knob(102, 58, 'MIX', { style: 'chrome', ticks: true, param: 'Mix' }),
        { id: uid('d'), kind: 'dip', x: 28, y: 90, n: 4, bits: [1, 0, 1, 1], color: '#c8102e', label: 'MODE', labelPos: 'below', param: 'Preset' },
        { id: uid('b'), kind: 'button', x: 72, y: 92, r: 4, shape: 'round', color: '#2a2c31', led: true, ledColor: '#3fa8ff', on: true, label: 'OCT-', labelPos: 'below', param: '' },
        { id: uid('b'), kind: 'button', x: 96, y: 92, r: 4, shape: 'round', color: '#2a2c31', led: true, ledColor: '#3fa8ff', on: false, label: 'OCT+', labelPos: 'below', param: '' },
        stomp(32, 124, { label: 'ON', labelPos: 'below' }), stomp(89, 124, { label: 'HOLD', labelPos: 'below', param: 'Hold' }),
      ],
      jacks: [jack('in', 'right', 0.3), jack('out', 'left', 0.3), jack('exp', 'top', 0.25), jack('power', 'top', 0.75)],
    }),
  },
  {
    id: 'blank', name: 'Blank', desc: 'Black 125B with a stomp',
    make: () => base({
      title: txt({ id: 'title', text: 'MY PEDAL', x: 33, y: 52, size: 9 }),
      ctls: [stomp(33, 100)],
      jacks: [jack('in', 'right', 0.3), jack('out', 'left', 0.3), jack('power', 'top', 0.5)],
    }),
  },
];

// ------------------------------------------------------------------ pedal renderer
let rid = 0;
const theme = (d) => ({ text: d.labels.color, labelFont: d.labels.font, labelSize: d.labels.size, toggleTitles: false });

// the enclosure's material spec; older designs had a finish + colour (and gradient colours)
function encSpec(E) {
  if (E.mat) return normalize(E.mat);
  const c = /^#[0-9a-f]{6}$/i.test(E.color || '') ? E.color : '#1d1f24';
  const by = {
    sparkle: { f: 'flake' }, brushed: { f: 'anodized' }, hammer: { f: 'hammertone' },
    gradient: { mc: { mode: 'linear', stops: [c, E.color2 || c], angle: E.angle ?? 90 } },
  };
  return normalize(Object.assign({ m: 'metal', s: 'aluminium', f: 'powder', c }, by[E.finish] || {}));
}
function migrateDesign(d) {
  if (!d || !d.enc) return d;
  if (!d.enc.mat) d.enc.mat = encSpec(d.enc);
  if (!Array.isArray(d.enc.patterns)) d.enc.patterns = [];
  if (d.enc.showThrough == null) d.enc.showThrough = 0.3;
  return d;
}
// a spec with a new colour: keeps the material when its finish takes a colour, else powder coat
function withColour(spec, c) {
  const s = normalize(spec);
  if (paletteFor(s)) return normalize({ ...s, c, mc: null });
  return normalize({ m: 'metal', s: 'aluminium', f: 'powder', c, w: s.w });
}

function drawJackGfx(parent, j) {
  if (j.kind === 'power') {
    svg('rect', { x: -1.2, y: -5, width: 4.6, height: 10, rx: 0.8, fill: '#151618', stroke: '#000', 'stroke-width': 0.3 }, parent);
    svg('rect', { x: 2.6, y: -3.4, width: 0.9, height: 6.8, fill: '#2b2d31' }, parent);
    svg('circle', { cx: 3.3, r: 1.2, fill: '#000' }, parent);
    return;
  }
  // nut seen from the side, then the threaded sleeve
  if (!nutPaint(parent, j, { x: -0.5, y: -6.2, width: 2.6, height: 12.4, rx: 0.5 })) svg('rect', { x: -0.5, y: -6.2, width: 2.6, height: 12.4, rx: 0.5, fill: 'url(#g-chrome)', stroke: '#2a2d31', 'stroke-width': 0.3 }, parent);
  svg('path', { d: 'M-0.5,-3.1H2.1M-0.5,3.1H2.1', stroke: '#2a2d31', 'stroke-width': 0.3, opacity: 0.6 }, parent);
  svg('rect', { x: 2.1, y: -4, width: 1.6, height: 8, fill: 'url(#g-plugMetal)', stroke: '#2a2d31', 'stroke-width': 0.25 }, parent);
  if (j.kind === 'stereo' || j.kind === 'exp') svg('rect', { x: 2.5, y: -4, width: 0.4, height: 8, fill: j.kind === 'exp' ? '#2b7bd6' : '#c9302c', opacity: 0.8 }, parent);
}

function drawScreen(g, c) {
  const s = SCREENS[c.type] || SCREENS.oled;
  const w = c.w, h = c.h;
  bezel(g, c, w, h);
  svg('rect', { x: -w / 2, y: -h / 2, width: w, height: h, rx: 0.6, fill: s.bg }, g);
  const lines = String(c.text || '').split('\n').slice(0, 4);
  const fs = Math.min(h / (lines.length + 1.2), w / 8);
  if (c.type === 'tft') {
    svg('rect', { x: -w / 2, y: -h / 2, width: w, height: h * 0.2, fill: '#2b7bd6' }, g);
    const pts = [];
    for (let i = 0; i <= 30; i++) pts.push(`${r1(-w / 2 + 2 + ((w - 4) * i) / 30)},${r1(h / 2 - 3 - (((i * 7) % 10) / 10) * h * 0.18)}`);
    svg('polyline', { points: pts.join(' '), fill: 'none', stroke: '#ff7a2f', 'stroke-width': 0.5 }, g);
  }
  lines.forEach((ln, i) => {
    const y = -h / 2 + (c.type === 'tft' ? h * 0.2 : 0) + fs * (i + 1.05);
    svg('text', { x: -w / 2 + 2, y, fill: s.fg, 'font-family': "'Share Tech Mono', monospace", 'font-size': r1(fs * 0.95), 'pointer-events': 'none' }, g, ln);
  });
  svg('rect', { x: -w / 2, y: -h / 2, width: w, height: h, rx: 0.6, fill: 'url(#g-glass)', 'pointer-events': 'none' }, g);
}

function drawDip(g, c) {
  const n = c.n || 4;
  const sw = 2.8, w = n * sw + 2.4, h = 9;
  svg('rect', { x: -w / 2, y: -h / 2, width: w, height: h, rx: 0.6, fill: c.color || '#c8102e', stroke: '#000', 'stroke-opacity': 0.5, 'stroke-width': 0.3 }, g);
  svg('text', { x: -w / 2 + 0.8, y: -h / 2 + 1.3, fill: '#fff', 'font-size': 1.5, 'font-family': "'Inter', sans-serif", 'font-weight': 700, 'pointer-events': 'none' }, g, 'ON');
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + 1.2 + i * sw + sw / 2;
    svg('rect', { x: x - 0.9, y: -2.6, width: 1.8, height: 5.2, rx: 0.2, fill: '#1a1a1a' }, g);
    const on = c.bits ? c.bits[i] : 0;
    svg('rect', { x: x - 0.8, y: on ? -2.5 : 0.1, width: 1.6, height: 2.4, rx: 0.2, fill: '#f4f4f4' }, g);
    svg('text', { x, y: 3.8, fill: '#fff', 'font-size': 1.4, 'text-anchor': 'middle', 'font-family': "'Inter', sans-serif", 'font-weight': 700, 'pointer-events': 'none' }, g, String(i + 1));
  }
}

// rough half-height used to place labels under or over a control
function ctlExtent(c) {
  switch (c.kind) {
    case 'knob': return c.r + (c.ticks ? 6.5 : 2.5);
    case 'toggle': return c.orient === 'h' ? 9 : 10;
    case 'button': return (c.shape === 'rect' || c.shape === 'pill' ? (c.h || 6) / 2 : c.r) + (c.led ? 1 : 1.5);
    case 'foot': return c.style === 'rc' || c.style === 'ts' ? (c.h || 30) / 2 + 1 : (c.r || 7) + 4.5;
    case 'led': return c.r + 2;
    case 'screen': return c.h / 2 + 2.5;
    case 'dip': return 5.5;
    default: return 6;
  }
}
const ctlRadius = (c) => (c.kind === 'screen' ? Math.max(c.w, c.h) / 2 : c.kind === 'dip' ? (c.n * 2.8 + 2.4) / 2 : ctlExtent(c));

function drawControl(parent, c, th) {
  // each part can have its own material (factory-parts.js); no material keeps the stock look
  if (c.kind === 'knob') knobPart(parent, c, th).set(c.value ?? 0.5);
  else if (c.kind === 'toggle') togglePart(parent, c, th);
  else if (c.kind === 'button') buttonPart(parent, c, th).set(!!c.on);
  else if (c.kind === 'foot') footPart(parent, c, th);
  else if (c.kind === 'led') ledPart(parent, c);
  else if (c.kind === 'screen') drawScreen(parent, c);
  else if (c.kind === 'dip') drawDip(parent, c);
  if (c.label && c.labelPos !== 'none') {
    const e = ctlExtent(c) + (c.kind === 'button' && c.led && c.labelPos === 'above' ? 5 : 0);
    const y = c.labelPos === 'above' ? -e - th.labelSize * 0.6 : e + th.labelSize * 0.6;
    svg('text', { x: 0, y, 'text-anchor': 'middle', 'dominant-baseline': 'central', fill: th.text, 'font-family': th.labelFont, 'font-weight': 700, 'font-size': th.labelSize, 'letter-spacing': 0.3, 'pointer-events': 'none' }, parent, c.label);
  }
}

function drawText(parent, t) {
  const e = svg('text', {
    x: 0, y: 0, 'text-anchor': 'middle', 'dominant-baseline': 'central', fill: t.color, 'font-family': t.font, 'font-weight': t.weight,
    'font-size': t.size, 'letter-spacing': t.ls, 'font-style': t.italic ? 'italic' : undefined,
    stroke: t.outline ? t.outlineColor : undefined, 'stroke-width': t.outline || undefined, 'paint-order': 'stroke', 'stroke-linejoin': 'round',
  }, parent, t.text || ' ');
  return e;
}

// draws a whole pedal into <g> root. o.edit adds hit targets and the grid.
function renderPedal(root, d, o = {}) {
  const pre = 'fz' + ++rid + '-';
  const E = d.enc;
  const W = E.w, H = E.h;
  const pts = shapePoints(E.shape, W, H);
  const body = roundPoly(pts, E.radius || 0);
  const defs = svg('defs', {}, root);
  const cp = svg('clipPath', { id: pre + 'clip' }, defs);
  svg('path', { d: body }, cp);
  const spec = encSpec(E);
  const mf = materialFill(spec, { scale: ENC_SCALE });
  const sh = svg('filter', { id: pre + 'sh', x: '-30%', y: '-30%', width: '160%', height: '160%' }, defs);
  svg('feDropShadow', { dx: 0, dy: 3, stdDeviation: 3.5, 'flood-color': '#000', 'flood-opacity': 0.55 }, sh);
  const th = theme(d);
  const edit = !!o.edit;

  // jacks sit under the body so only the part outside the edge shows
  const jackLayer = svg('g', { class: 'fz-jacks' }, root);
  const jackPos = new Map();
  for (const j of d.jacks) {
    const p = edgePoint(pts, W, H, j.edge, j.t);
    jackPos.set(j.id, p);
    const g = svg('g', { transform: `translate(${r1(p.x)},${r1(p.y)}) rotate(${r1(p.ang)})`, 'data-sel': j.id }, jackLayer);
    drawJackGfx(g, j);
  }

  if (mf.glow) for (const [sw, op] of [[7, 0.12], [3.5, 0.22]]) svg('path', { d: body, fill: 'none', stroke: mf.glow, 'stroke-width': sw, 'stroke-opacity': op, 'pointer-events': 'none' }, root);
  svg('path', { d: body, fill: mf.fill, filter: `url(#${pre}sh)`, 'data-body': 1, 'data-sel': 'enc' }, root);
  // material extras, multicolour, then the pattern layers (blend modes mix with the body underneath)
  const cg = svg('g', { 'clip-path': `url(#${pre}clip)`, 'pointer-events': 'none' }, root);
  const full = { x: -2, y: -2, width: W + 4, height: H + 4 };
  if (mf.overlay) svg('rect', { ...full, fill: mf.overlay }, cg);
  if (spec.mc) svg('rect', { ...full, fill: multiFill(spec.mc), style: 'mix-blend-mode:multiply' }, cg);
  const pats = (E.patterns || []).filter((L) => L.on);
  if (pats.length) {
    renderPatterns(cg, defs, pre, E.patterns, W, H);
    // the material's texture shows through the patterns
    if ((E.showThrough ?? 0.3) > 0) svg('rect', { ...full, fill: mf.fill, opacity: E.showThrough ?? 0.3, style: 'mix-blend-mode:soft-light' }, cg);
  }

  // artwork (clipped to the body)
  const artG = svg('g', { 'clip-path': `url(#${pre}clip)` }, root);
  for (const a of d.art) {
    if (a.hidden) continue;
    const g = svg('g', { transform: `translate(${r1(a.x)},${r1(a.y)}) rotate(${r1(a.rot || 0)})`, 'data-sel': a.id, class: 'fz-item' }, artG);
    if (edit) g.dataset.id = a.id;
    svg('path', { d: artPath(a), fill: a.color, opacity: a.opacity ?? 1, 'fill-rule': 'evenodd' }, g);
  }
  // lighting over body and art, then the finish sheen and wear
  svg('path', { d: body, fill: 'url(#g-shadeV)', opacity: 0.6, 'pointer-events': 'none' }, root);
  svg('path', { d: body, fill: mf.sheen, opacity: mf.sheenOpacity * 0.8, 'pointer-events': 'none' }, root);
  if (spec.w) wearOverlay(svg('g', { 'pointer-events': 'none' }, root), 'path', { d: body }, spec, { scale: ENC_SCALE, seed: 'enc' + W + 'x' + H, size: Math.min(W, H) });
  const ed = svg('g', { 'clip-path': `url(#${pre}clip)`, 'pointer-events': 'none' }, root);
  svg('path', { d: body, fill: 'none', stroke: '#fff', 'stroke-opacity': 0.22, 'stroke-width': 1.4 }, ed);
  svg('path', { d: body, fill: 'none', stroke: '#000', 'stroke-opacity': 0.55, 'stroke-width': 0.5, 'pointer-events': 'none' }, root);

  if (edit && o.grid) {
    const step = o.grid >= 2.5 ? o.grid : 5;
    const gp = svg('pattern', { id: pre + 'grid', width: step, height: step, patternUnits: 'userSpaceOnUse' }, defs);
    const dark = lum(mf.base) > 0.55;
    svg('circle', { cx: 0, cy: 0, r: 0.22, fill: dark ? '#000' : '#fff', opacity: 0.45 }, gp);
    svg('rect', { width: W + 1, height: H + 1, fill: `url(#${pre}grid)`, 'clip-path': `url(#${pre}clip)`, 'pointer-events': 'none', class: 'fz-gridfill' }, root);
  }

  // jack labels are printed on the body
  for (const j of d.jacks) {
    const p = jackPos.get(j.id);
    if (!j.label) continue;
    const a = (p.ang * Math.PI) / 180;
    svg('text', { x: r1(p.x - Math.cos(a) * 5.2), y: r1(p.y - Math.sin(a) * 5.2), 'text-anchor': 'middle', 'dominant-baseline': 'central', fill: th.text, 'font-family': th.labelFont, 'font-weight': 700, 'font-size': th.labelSize * 0.85, 'letter-spacing': 0.2, 'pointer-events': 'none' }, root, j.label);
  }

  for (const t of [d.title, d.sub]) {
    if (t.hidden || !t.text) continue;
    const g = svg('g', { transform: `translate(${r1(t.x)},${r1(t.y)}) rotate(${r1(t.rot || 0)})`, 'data-sel': t.id, class: 'fz-item' }, root);
    if (edit) g.dataset.id = t.id;
    drawText(g, t);
  }
  for (const c of d.ctls) {
    if (c.hidden) continue;
    const g = svg('g', { transform: `translate(${r1(c.x)},${r1(c.y)})`, 'data-sel': c.id, class: 'fz-item fz-ctl' }, root);
    if (edit) g.dataset.id = c.id;
    drawControl(g, c, th);
  }
  // jack hit areas on top so they can be grabbed through the body edge
  if (edit)
    for (const j of d.jacks) {
      const p = jackPos.get(j.id);
      const g = svg('g', { transform: `translate(${r1(p.x)},${r1(p.y)}) rotate(${r1(p.ang)})`, 'data-id': j.id, class: 'fz-item fz-jack' }, root);
      svg('rect', { x: -8, y: -6.5, width: 13, height: 13, fill: 'transparent' }, g);
    }
  return { W, H, pts, body };
}

function thumb(d, cls = 'fz-thumb') {
  const pad = 9;
  const s = svg('svg', { viewBox: `${-pad} ${-pad} ${d.enc.w + pad * 2} ${d.enc.h + pad * 2}`, class: cls });
  renderPedal(svg('g', {}, s), d);
  return s;
}

// ------------------------------------------------------------------ editor state
let D = null; // the design
let sel = null; // selected id: 'enc', 'title', 'sub', or an item id
let built = false;
const hist = { stack: [], idx: -1 };
const prefs = Object.assign({ grid: 2.5, showGrid: true, tab: 'parts' }, lsGet(PREFS) || {});
const view = { z: 4, x: 0, y: 0, touched: false };
const ui = {};
let guides = [];

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
function commit() {
  const s = JSON.stringify(D);
  if (hist.stack[hist.idx] === s) return;
  hist.stack.length = hist.idx + 1;
  hist.stack.push(s);
  if (hist.stack.length > 300) hist.stack.shift();
  hist.idx = hist.stack.length - 1;
  lsSet(STORE, D);
  updateUndo();
}
function restore(i) {
  hist.idx = i;
  D = JSON.parse(hist.stack[i]);
  if (sel && !find(sel)) sel = null;
  lsSet(STORE, D);
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
function select(id) {
  if (id === sel) return;
  sel = id;
  renderStage();
  renderInspector();
  renderLayers();
}
function refreshAll() {
  if (ui.name) ui.name.value = D.name;
  renderStage();
  renderInspector();
  renderLayers();
  renderParts();
  renderCircuit();
  updateUndo();
}
// after an edit: live edits only repaint, final ones are committed
function changed(live) {
  renderStage();
  if (!live) {
    commit();
    renderLayers();
  }
}

function loadDesign(d, keepHistory) {
  D = migrateDesign(d);
  sel = null;
  if (!keepHistory) {
    hist.stack = [];
    hist.idx = -1;
  }
  commit();
  view.touched = false;
  fit();
  refreshAll();
}

// ------------------------------------------------------------------ adding and removing parts
function paramsFor() {
  return [...(PARAMS[D.circuit.type] || []), ...COMMON_PARAMS];
}
function nextParam() {
  const used = new Set(D.ctls.map((c) => c.param));
  return (PARAMS[D.circuit.type] || []).find((p) => !used.has(p)) || '';
}
const PARTS = {
  knob: { name: 'Knob', make: () => { const p = nextParam(); return knob(0, 0, p.toUpperCase(), { param: p }); } },
  toggle2: { name: '2 way toggle', make: () => ({ id: uid('t'), kind: 'toggle', ways: 2, orient: 'v', opts: ['ON', 'OFF'], pos: 0, label: '', labelPos: 'none', param: '' }) },
  toggle3: { name: '3 way toggle', make: () => ({ id: uid('t'), kind: 'toggle', ways: 3, orient: 'v', opts: ['A', 'B', 'C'], pos: 1, label: '', labelPos: 'none', param: '' }) },
  button: { name: 'Push button', make: () => ({ id: uid('b'), kind: 'button', r: 4, shape: 'round', color: '#2a2c31', led: false, ledColor: '#3fa8ff', on: false, label: '', labelPos: 'below', param: '' }) },
  foot: { name: 'Footswitch', make: () => stomp(0, 0) },
  led: { name: 'LED', make: () => led(0, 0, '#ff2a1a') },
  screen: { name: 'Screen', make: () => ({ id: uid('s'), kind: 'screen', w: 30, h: 14, type: 'oled', text: 'HELLO', label: '', labelPos: 'none', param: '' }) },
  dip: { name: 'DIP switch', make: () => ({ id: uid('d'), kind: 'dip', n: 4, bits: [1, 0, 0, 1], color: '#c8102e', label: '', labelPos: 'none', param: '' }) },
};

function freeSpot(c) {
  const W = D.enc.w, H = D.enc.h;
  const r = ctlRadius(c);
  let best = null;
  // first try to keep clear of the printed text, then allow overlapping it
  for (const avoidText of [true, false]) {
    if (best) break;
    for (let y = r + 4; y <= H - r - 4; y += 2)
      for (let x = r + 3; x <= W - r - 3; x += 2) {
        const ok = D.ctls.every((o) => o.hidden || Math.hypot(o.x - x, o.y - y) > r + ctlRadius(o) + 3);
        if (!ok) continue;
        // keep clear of the printed name and subtitle
        const onText = [D.title, D.sub].some((t) => !t.hidden && t.text && Math.abs(y - t.y) < t.size * 0.7 + r && Math.abs(x - t.x) < (t.text.length * t.size * 0.55) / 2 + r);
        if (avoidText && onText) continue;
        const score = Math.abs(x - W / 2) * 0.6 + Math.abs(y - H * 0.4);
        if (!best || score < best.score) best = { x, y, score };
      }
  }
  const p = best || { x: W / 2, y: H / 2 };
  return { x: snap(p.x), y: snap(p.y) };
}
function jackAt(p) {
  const W = D.enc.w, H = D.enc.h;
  const dists = { top: p.y, bottom: H - p.y, left: p.x, right: W - p.x };
  const edge = Object.keys(dists).sort((a, b) => dists[a] - dists[b])[0];
  const len = edge === 'top' || edge === 'bottom' ? W : H;
  let t = (edge === 'top' || edge === 'bottom' ? p.x : p.y) / len;
  if (prefs.grid) t = (Math.round((t * len) / prefs.grid) * prefs.grid) / len;
  return { edge, t: clamp(t, 0.06, 0.94) };
}
function addPart(kind, payload, at) {
  let item;
  if (kind === 'art') {
    const big = payload === 'stripe' || payload === 'stripes' || payload === 'wave';
    const s = Math.min(D.enc.w, D.enc.h) * 0.4;
    item = art(payload, at ? at.x : D.enc.w / 2, at ? at.y : D.enc.h / 2, big ? D.enc.w : s, big ? Math.max(8, s * 0.45) : s, payload === 'dots' ? '#ffffff' : '#f2c230', { opacity: payload === 'dots' ? 0.4 : 1 });
    D.art.push(item);
  } else if (kind === 'jack') {
    const used = D.jacks.filter((j) => j.edge === JACKS[payload].edge).length;
    const pos = at ? jackAt(at) : { edge: JACKS[payload].edge, t: clamp(0.3 + used * 0.3, 0.1, 0.9) };
    item = jack(payload, pos.edge, pos.t);
    D.jacks.push(item);
  } else {
    item = PARTS[payload].make();
    const p = at ? { x: snap(at.x), y: snap(at.y) } : freeSpot(item);
    item.x = p.x;
    item.y = p.y;
    D.ctls.push(item);
  }
  sel = item.id;
  commit();
  renderStage();
  renderInspector();
  renderLayers();
}
function removeSel() {
  const f = find(sel);
  if (!f) return;
  if (f.kind === 'text') f.item.hidden = true;
  else if (f.list) f.list.splice(f.index, 1);
  else return;
  sel = null;
  commit();
  renderStage();
  renderInspector();
  renderLayers();
}
function duplicateSel() {
  const f = find(sel);
  if (!f || !f.list) return;
  const c = clone(f.item);
  c.id = uid(f.item.id[0]);
  if (f.kind === 'jack') c.t = clamp(c.t + 0.15, 0.06, 0.94);
  else {
    c.x += 6;
    c.y += 6;
  }
  f.list.splice(f.index + 1, 0, c);
  sel = c.id;
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
  renderPedal(ui.pedalG, D, { edit: true, grid: prefs.showGrid ? prefs.grid || 0 : 0 });
  ui.stageWrap.classList.toggle('has-sel', !!sel);
  renderOverlay();
  renderDims();
  renderStatus();
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
function renderOverlay() {
  const g = ui.overlayG;
  if (!g) return;
  g.textContent = '';
  const z = view.z;
  for (const gd of guides) {
    if (gd.x != null) svg('line', { x1: gd.x, x2: gd.x, y1: -6, y2: D.enc.h + 6, class: 'fz-guide' }, g);
    else svg('line', { y1: gd.y, y2: gd.y, x1: -6, x2: D.enc.w + 6, class: 'fz-guide' }, g);
  }
  const f = find(sel);
  if (!f) return;
  if (f.kind === 'enc') {
    svg('path', { d: roundPoly(shapePoints(D.enc.shape, D.enc.w, D.enc.h), D.enc.radius || 0), class: 'fz-selbox enc' }, g);
    return;
  }
  const it = f.item;
  if (it.hidden) return;
  const target = ui.pedalG.querySelector(`[data-sel="${CSS.escape(sel)}"]`);
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
  svg('rect', { x: box.x, y: box.y, width: box.w, height: box.h, rx: 0.8, class: 'fz-selbox' + (it.locked ? ' locked' : '') }, og);
  if (it.locked) return;
  const hr = 4.5 / z;
  const canResize = f.kind === 'art' || f.kind === 'text' || (f.kind === 'ctl' && it.kind === 'screen');
  if (canResize) svg('rect', { x: box.x + box.w - hr, y: box.y + box.h - hr, width: hr * 2, height: hr * 2, rx: hr * 0.4, class: 'fz-handle', 'data-handle': 'resize' }, og);
  if (f.kind === 'art' || f.kind === 'text') {
    const ty = box.y - 16 / z;
    svg('line', { x1: box.x + box.w / 2, x2: box.x + box.w / 2, y1: box.y, y2: ty, class: 'fz-handle-line' }, og);
    svg('circle', { cx: box.x + box.w / 2, cy: ty, r: hr, class: 'fz-handle rot', 'data-handle': 'rotate' }, og);
  }
}
function renderStatus() {
  if (!ui.status) return;
  const f = find(sel);
  let s = '';
  if (!f || f.kind === 'enc') s = `${D.enc.size === 'custom' ? 'Custom' : D.enc.size} enclosure, ${D.ctls.length} controls, ${D.jacks.length} jacks`;
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
function alignTo(id, x, y, alt) {
  guides = [];
  if (alt) return { x, y };
  const xs = [D.enc.w / 2], ys = [D.enc.h / 2];
  for (const c of D.ctls) if (c.id !== id && !c.hidden) {
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
  const it = f.item;
  const o = { x: it.x, y: it.y };
  ui.stageWrap.classList.add('moving');
  startDrag(e, (ev) => {
    const p = toPedal(ev);
    if (f.kind === 'jack') Object.assign(it, jackAt(p));
    else {
      const nx = snap(o.x + p.x - p0.x, ev.altKey), ny = snap(o.y + p.y - p0.y, ev.altKey);
      const a = f.kind === 'ctl' ? alignTo(id, nx, ny, ev.altKey) : { x: nx, y: ny };
      it.x = clamp(a.x, -20, D.enc.w + 20);
      it.y = clamp(a.y, -20, D.enc.h + 20);
    }
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
    renderStage();
  }, (ev, moved) => {
    if (moved) {
      commit();
      renderInspector();
    }
  });
}
function onStageDown(e) {
  if (e.button === 1 || (e.button === 0 && ui.space)) {
    e.preventDefault();
    return startPan(e);
  }
  if (e.button !== 0) return;
  const h = e.target.closest('[data-handle]');
  if (h) return startHandle(e, h.dataset.handle);
  const it = e.target.closest('[data-id]');
  if (it) {
    select(it.dataset.id);
    return startMove(e, it.dataset.id);
  }
  select(e.target.closest('[data-body]') ? 'enc' : null);
  startPan(e);
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
    if (ghost) {
      ghost.remove();
      if (over(ev)) addPart(kind, payload, toPedal(ev));
    } else addPart(kind, payload, null);
  };
  window.addEventListener('pointermove', mv);
  window.addEventListener('pointerup', up);
}

// ------------------------------------------------------------------ form helpers for the inspector
function sec(parent, title, extra) {
  const s = el('div', { class: 'fz-sec' }, parent);
  if (title) {
    const h = el('h5', {}, s);
    h.textContent = title;
    if (extra) el('span', { class: 'fz-soon' }, h).textContent = extra;
  }
  return s;
}
function row(parent, label) {
  const r = el('div', { class: 'fz-row' }, parent);
  el('label', {}, r).textContent = label;
  return el('div', { class: 'fz-field' }, r);
}
function slider(parent, label, val, min, max, step, set, cls) {
  const c = row(parent, label);
  const r = el('input', { type: 'range', min, max, step, class: cls }, c);
  r.value = val;
  const n = el('input', { type: 'number', min, max, step, class: 'fz-num' }, c);
  n.value = r1(val);
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
  const c = label ? row(parent, label) : el('div', { class: 'fz-field' }, parent);
  const s = el('div', { class: 'seg fz-seg' }, c);
  for (const [v, t] of opts) {
    const b = el('button', { class: String(v) === String(cur) ? 'on' : '', 'data-v': v }, s);
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
  const c = row(parent, label);
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
  mark(cur || '');
  pick.oninput = () => {
    set(pick.value);
    mark(pick.value);
    changed(true);
  };
  pick.onchange = () => changed(false);
}
function selectField(parent, label, opts, cur, set, rerender) {
  const c = row(parent, label);
  const s = el('select', {}, c);
  for (const [v, t] of opts) {
    const o = el('option', { value: v }, s);
    o.textContent = t;
  }
  s.value = cur;
  s.onchange = () => {
    set(s.value);
    changed(false);
    if (rerender) renderInspector();
  };
  return s;
}
function textField(parent, label, cur, set, o = {}) {
  const c = row(parent, label);
  const i = el(o.multi ? 'textarea' : 'input', o.multi ? { rows: 2, class: 'fz-text' } : { type: 'text', class: 'fz-text', maxlength: 40 }, c);
  i.value = cur || '';
  i.oninput = () => {
    set(i.value);
    changed(true);
  };
  i.onchange = () => changed(false);
  return i;
}
function check(parent, label, cur, set, rerender) {
  const c = row(parent, label);
  const l = el('label', { class: 'switch' }, c);
  const i = el('input', { type: 'checkbox' }, l);
  i.checked = !!cur;
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

// ------------------------------------------------------------------ inspector
function itemName(f) {
  if (!f) return '';
  if (f.kind === 'enc') return 'Enclosure';
  if (f.kind === 'text') return f.item.id === 'title' ? 'Name' : 'Subtitle';
  if (f.kind === 'jack') return JACKS[f.item.kind].name + ' jack';
  if (f.kind === 'art') return (ART_KINDS.find((a) => a[0] === f.item.kind) || [0, 'Shape'])[1];
  const c = f.item;
  const k = { knob: 'Knob', toggle: c.ways + ' way toggle', button: 'Push button', foot: 'Footswitch', led: 'LED', screen: 'Screen', dip: 'DIP switch' }[c.kind];
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
  else inspControl(host, f.item);
  host.scrollTop = scroll;
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
  slider(s1, 'Width', E.w, 30, 220, 1, setDim('w'));
  slider(s1, 'Length', E.h, 50, 200, 1, setDim('h'));

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
  let picker = null;
  // quick colour: sets the finish colour (or switches to powder coat)
  colors(s3, 'Colour', (paletteFor(E.mat) && /^#/.test(E.mat.c || '') ? E.mat.c : '') || '', BODY_SWATCHES, (v) => {
    E.mat = withColour(E.mat, v);
    if (picker) picker.set(E.mat);
  }, 'enc');
  picker = materialPicker(s3, { key: 'fz-enc', value: E.mat, wear: true, onChange: (spec, live) => { E.mat = spec; changed(live); } });

  patternInspector(host, E, { sec, row, slider, colors, seg, selectField, check, changed, rerender: renderInspector });

  const s4 = sec(host, 'Printed labels');
  selectField(s4, 'Font', FONTS, D.labels.font, (v) => (D.labels.font = v));
  slider(s4, 'Size', D.labels.size, 2, 6, 0.1, (v) => (D.labels.size = v));
  colors(s4, 'Ink', D.labels.color, INK_SWATCHES, (v) => (D.labels.color = v), 'ink');
}
function inspText(host, t) {
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
  const s3 = sec(host, 'Placement');
  xy(s3, t);
  slider(s3, 'Rotation', t.rot || 0, -180, 180, 1, (v) => (t.rot = v));
  el('div', { class: 'fz-actrow' }, s3).appendChild(el('button', { class: 'btn small', onclick: () => { t.x = D.enc.w / 2; changed(false); renderInspector(); } }, null, 'Centre across'));
}
function inspArt(host, a) {
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
  xy(s2, a);
  slider(s2, 'Width', a.w, 2, 240, 0.5, (v) => (a.w = v));
  slider(s2, 'Height', a.h, 2, 240, 0.5, (v) => (a.h = v));
  slider(s2, 'Rotation', a.rot || 0, -180, 180, 1, (v) => (a.rot = v));
  const ar = el('div', { class: 'fz-actrow' }, s2);
  el('button', { class: 'btn small', onclick: () => moveOrder(a.id, 1) }, ar, 'Bring forward');
  el('button', { class: 'btn small', onclick: () => moveOrder(a.id, -1) }, ar, 'Send back');
}
function inspJack(host, j) {
  const s = sec(host, 'Jack');
  selectField(s, 'Type', Object.entries(JACKS).map(([k, v]) => [k, v.name]), j.kind, (v) => {
    if (j.label === JACKS[j.kind].label) j.label = JACKS[v].label;
    j.kind = v;
  }, true);
  textField(s, 'Label', j.label, (v) => (j.label = v));
  seg(s, 'Edge', [['top', 'Top'], ['left', 'Left'], ['right', 'Right'], ['bottom', 'Bottom']], j.edge, (v) => (j.edge = v), false);
  slider(s, 'Along', j.t, 0.04, 0.96, 0.01, (v) => (j.t = v));
  el('p', { class: 'fz-note' }, s).textContent = 'Drag a jack around the pedal to move it to another edge.';
  if (j.kind !== 'power') partMaterial(host, j, 'Nut');
}
const PART_NAMES = { knob: 'knobs', toggle: 'toggles', button: 'buttons', foot: 'footswitches', led: 'LED bezels', screen: 'screen bezels', jack: 'jack nuts' };
// material picker for one part, plus "apply to all" shortcuts
function partMaterial(host, c, title) {
  const kind = c.kind === 'in' || c.kind === 'out' || c.kind === 'stereo' || c.kind === 'exp' ? 'jack' : c.kind;
  const s = sec(host, title ? title + ' material' : { led: 'Bezel material', screen: 'Bezel material' }[kind] || 'Material');
  s.classList.add('fz-partmat');
  materialPicker(s, {
    key: 'fz-part', value: c.mat || { m: 'stock' }, allowStock: true, wear: true,
    onChange: (spec, live) => {
      c.mat = spec.m === 'stock' ? null : spec;
      changed(live);
      if (!live && kind === 'button') renderInspector();
    },
  });
  const all = (pred) => {
    const m = c.mat ? clone(c.mat) : null;
    for (const o of [...D.ctls, ...D.jacks]) if (o !== c && pred(o)) o.mat = m ? clone(m) : null;
    changed(false);
  };
  const isJack = (o) => !!JACKS[o.kind] && o.kind !== 'power';
  const ar = el('div', { class: 'fz-actrow' }, s);
  el('button', { class: 'btn small', 'data-apply': 'kind', onclick: () => all((o) => (kind === 'jack' ? isJack(o) : o.kind === c.kind)) }, ar, 'Apply to all ' + PART_NAMES[kind]);
  el('button', { class: 'btn small', 'data-apply': 'all', onclick: () => all((o) => o.kind !== 'dip' && o.kind !== 'power') }, ar, 'Apply to every part');
  if (kind === 'knob') el('button', { class: 'btn small', onclick: () => { for (const o of D.ctls) if (o.kind === 'knob') { o.style = c.style; o.mat = c.mat ? clone(c.mat) : null; } changed(false); } }, ar, 'Copy cap and material to all knobs');
}
function inspControl(host, c) {
  const s = sec(host, itemName({ kind: 'ctl', item: { ...c, label: '' } }));
  if (c.kind === 'knob') {
    selectField(s, 'Cap', KNOB_STYLES, c.style, (v) => (c.style = v));
    seg(s, 'Size', KNOB_SIZES, c.r, (v) => (c.r = +v), false);
    slider(s, 'Pointer', c.value ?? 0.5, 0, 1, 0.01, (v) => (c.value = v));
    check(s, 'Scale ticks', c.ticks, (v) => (c.ticks = v));
  } else if (c.kind === 'toggle') {
    seg(s, 'Ways', [[2, '2 way'], [3, '3 way']], c.ways, (v) => {
      c.ways = +v;
      c.pos = Math.min(c.pos, c.ways - 1);
      while (c.opts.length < c.ways) c.opts.push(String.fromCharCode(65 + c.opts.length));
    });
    seg(s, 'Lever', [['v', 'Vertical'], ['h', 'Sideways']], c.orient, (v) => (c.orient = v), false);
    seg(s, 'Tip', TOGGLE_TIPS, c.tip || 'bat', (v) => (c.tip = v), false);
    textField(s, 'Positions', c.opts.slice(0, c.ways).join(', '), (v) => (c.opts = v.split(',').map((x) => x.trim().toUpperCase().slice(0, 6))));
    seg(s, 'Set to', c.opts.slice(0, c.ways).map((o, i) => [i, o || String(i + 1)]), c.pos, (v) => (c.pos = +v), false);
  } else if (c.kind === 'button') {
    seg(s, 'Shape', BUTTON_SHAPES, c.shape || 'round', (v) => (c.shape = v)).classList.add('fz-wrap');
    if (c.shape === 'rect' || c.shape === 'pill') {
      slider(s, 'Width', c.w || 12, 5, 30, 0.5, (v) => (c.w = v));
      slider(s, 'Height', c.h || 6, 3, 14, 0.5, (v) => (c.h = v));
    } else slider(s, 'Size', c.r, 2.5, 7, 0.5, (v) => (c.r = v));
    if (!c.mat) colors(s, 'Cap', c.color, ['#2a2c31', '#d8dade', '#c9302c', '#2b7bd6', '#3a9a5b', '#f2c230'], (v) => (c.color = v), 'cap');
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
    textField(s, 'Shows', c.text, (v) => (c.text = v), { multi: true });
  } else if (c.kind === 'dip') {
    slider(s, 'Switches', c.n, 2, 8, 1, (v) => {
      c.n = v;
      while (c.bits.length < v) c.bits.push(0);
    });
    const r = row(s, 'Set');
    const bits = el('div', { class: 'fz-bits' }, r);
    for (let i = 0; i < c.n; i++) {
      const b = el('button', { class: c.bits[i] ? 'on' : '' }, bits);
      b.textContent = i + 1;
      b.onclick = () => {
        c.bits[i] = c.bits[i] ? 0 : 1;
        b.classList.toggle('on', !!c.bits[i]);
        changed(false);
      };
    }
    colors(s, 'Body', c.color, ['#c8102e', '#1f4fbf', '#1d1f24', '#3a9a5b'], (v) => (c.color = v), 'dip');
  }
  if (c.kind !== 'dip') partMaterial(host, c);
  const s2 = sec(host, 'Label');
  textField(s2, 'Text', c.label, (v) => (c.label = v.toUpperCase()));
  seg(s2, 'Show', [['above', 'Above'], ['below', 'Below'], ['none', 'Hidden']], c.labelPos, (v) => (c.labelPos = v), false);
  const s3 = sec(host, 'Parameter', 'Coming later');
  const opts = [['', 'Not set'], ...paramsFor().map((p) => [p, p])];
  if (c.param && !opts.some((o) => o[0] === c.param)) opts.push([c.param, c.param]);
  selectField(s3, 'Controls', opts, c.param || '', (v) => (c.param = v)).classList.add('fz-param');
  el('p', { class: 'fz-note' }, s3).textContent = 'Picks what this control will drive once circuits can be built. It does nothing yet.';
  const s4 = sec(host, 'Placement');
  xy(s4, c);
  const ar = el('div', { class: 'fz-actrow' }, s4);
  el('button', { class: 'btn small', onclick: () => { c.x = D.enc.w / 2; changed(false); renderInspector(); } }, ar, 'Centre across');
  el('button', { class: 'btn small', onclick: () => moveOrder(c.id, 1) }, ar, 'Bring forward');
  el('button', { class: 'btn small', onclick: () => moveOrder(c.id, -1) }, ar, 'Send back');
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
    el('button', { class: 'btn small', onclick: () => { D[id].hidden = false; if (!D[id].text) D[id].text = id === 'title' ? 'NAME' : 'subtitle'; if (!D[id].x) { D[id].x = D.enc.w / 2; D[id].y = D.enc.h * (id === 'title' ? 0.5 : 0.58); } sel = id; changed(false); renderInspector(); } }, tr, id === 'title' ? 'Edit name' : 'Edit subtitle');
  const s1 = sec(host, 'Controls');
  const g1 = el('div', { class: 'fz-tiles' }, s1);
  const prev = {
    knob: (s) => drawKnob(s, { x: 0, y: 0, r: 9, style: 'boss' }, th).set(0.6),
    toggle2: (s) => drawToggle(s, { x: 0, y: 0, options: ['', ''] }, th).set(0),
    toggle3: (s) => drawToggle(s, { x: 0, y: 0, options: ['', '', ''] }, th).set(0),
    button: (s) => drawButton(s, { x: 0, y: 0, r: 6 }, th).set(false),
    foot: (s) => drawFoot(s, { x: 0, y: 0, r: 7.5 }, th),
    led: (s) => drawLed(s, { x: 0, y: 0, r: 4, color: '#ff2a1a' }).set(true),
    screen: (s) => drawScreen(s, { w: 22, h: 12, type: 'oled', text: '120\nBPM' }),
    dip: (s) => {
      const g = svg('g', { transform: 'scale(1.6)' }, s);
      drawDip(g, { n: 4, bits: [1, 0, 1, 0], color: '#c8102e' });
    },
  };
  for (const [k, p] of Object.entries(PARTS)) tile(g1, p.name, 'ctl', k, prev[k]);
  const s2 = sec(host, 'Jacks');
  const g2 = el('div', { class: 'fz-tiles' }, s2);
  for (const [k, j] of Object.entries(JACKS))
    tile(g2, j.name, 'jack', k, (s) => {
      const g = svg('g', { transform: 'rotate(-90) scale(1.5) translate(-1.5,0)' }, s);
      drawJackGfx(g, { kind: k });
      svg('text', { x: 0, y: 9, 'text-anchor': 'middle', 'font-size': 5, 'font-weight': 700, 'font-family': "'Barlow Condensed', sans-serif", class: 'fz-tile-ink' }, s, j.label);
    });
  const s3 = sec(host, 'Artwork');
  const g3 = el('div', { class: 'fz-tiles small' }, s3);
  for (const [k, name] of ART_KINDS)
    tile(g3, name, 'art', k, (s) => {
      svg('path', { d: artPath({ kind: k, w: 20, h: k === 'stripe' || k === 'stripes' || k === 'wave' ? 10 : 20 }), class: 'fz-art-ico', 'fill-rule': 'evenodd' }, s);
    });
  el('p', { class: 'fz-note' }, host).textContent = 'Click a part to add it, or drag it onto the pedal. Hold Alt while dragging to skip snapping.';
}

const LAYER_ICONS = {
  enc: 'M5 3h14v18H5z', text: 'M5 6h14M12 6v13', art: 'M12 3l9 16H3z', jack: 'M4 12h9M13 8v8M16 10h4v4h-4z',
  knob: 'M12 4a8 8 0 1 0 0.01 0M12 12V6', toggle: 'M12 21v-6M9 15h6M12 15l3-11', button: 'M12 7a5 5 0 1 0 0.01 0M5 21h14',
  foot: 'M12 3l7.8 4.5v9L12 21l-7.8-4.5v-9zM12 9a3 3 0 1 0 0.01 0', led: 'M12 8a4 4 0 1 0 0.01 0M12 2v2M4 12H2M22 12h-2',
  screen: 'M3 6h18v12H3zM7 10h6M7 14h3', dip: 'M3 7h18v10H3zM7 10v4M12 10v4M17 10v4',
};
function layerRow(parent, id, f, o = {}) {
  const it = f.item;
  const r = el('div', { class: 'fz-layer' + (sel === id || (id === 'enc' && !sel) ? ' on' : '') + (it.hidden ? ' hidden' : ''), 'data-layer': id }, parent);
  const ic = svg('svg', { viewBox: '0 0 24 24', class: 'fz-lic' }, r);
  svg('path', { d: LAYER_ICONS[f.kind === 'ctl' ? it.kind : f.kind] }, ic);
  el('span', { class: 'n' }, r).textContent = o.name || itemName(f);
  if (f.kind === 'art') el('i', { class: 'fz-ldot', style: { background: it.color } }, r);
  if (o.order) {
    el('button', { class: 'fz-lbtn', title: 'Bring forward', onclick: (e) => { e.stopPropagation(); moveOrder(id, 1); } }, r, '<i class="ic fz-ic-up"></i>');
    el('button', { class: 'fz-lbtn', title: 'Send back', onclick: (e) => { e.stopPropagation(); moveOrder(id, -1); } }, r, '<i class="ic ic-down"></i>');
  }
  if (o.toggles) {
    el('button', { class: 'fz-lbtn' + (it.hidden ? ' off' : ''), title: it.hidden ? 'Show' : 'Hide', onclick: (e) => { e.stopPropagation(); it.hidden = !it.hidden; if (it.hidden && sel === id) sel = null; changed(false); renderInspector(); } }, r, '<i class="ic fz-ic-eye"></i>');
    el('button', { class: 'fz-lbtn' + (it.locked ? ' act' : ' dim'), title: it.locked ? 'Unlock' : 'Lock', onclick: (e) => { e.stopPropagation(); it.locked = !it.locked; changed(false); renderOverlay(); } }, r, '<i class="ic fz-ic-lock"></i>');
  }
  r.onclick = () => select(id);
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
  host.scrollTop = scroll;
}

function renderCircuit() {
  const host = ui.circuit;
  if (!host || !D) return;
  host.textContent = '';
  const C = D.circuit;
  const ban = el('div', { class: 'fz-banner' }, host);
  el('span', { class: 'fz-soon' }, ban).textContent = 'Coming later';
  el('p', {}, ban).textContent = 'Sound design is not here yet. Pick a type and sketch the signal chain; nothing makes sound for now.';
  const s1 = sec(host, 'Effect type');
  const chips = el('div', { class: 'fz-chips' }, s1);
  for (const [k, name] of EFFECTS) {
    const b = el('button', { class: 'chip' + (C.type === k ? ' on' : ''), 'data-fx': k }, chips);
    b.textContent = name;
    b.onclick = () => {
      C.type = k;
      C.blocks = (STACKS[k] || []).map((x) => ({ id: uid('b'), kind: x }));
      commit();
      renderCircuit();
      renderInspector();
    };
  }
  const s2 = sec(host, 'Signal chain');
  const chain = el('div', { class: 'fz-chain' }, s2);
  el('div', { class: 'fz-node io' }, chain).textContent = 'Guitar in';
  C.blocks.forEach((b, i) => {
    const [name, cat] = BLOCKS[b.kind] || ['Block', 'io'];
    const card = el('div', { class: `fz-block cat-${cat}` }, chain);
    el('i', { class: 'bar' }, card);
    const m = el('div', { class: 'm' }, card);
    el('b', {}, m).textContent = name;
    el('small', {}, m).textContent = BLOCK_CATS[cat];
    const knobs = el('div', { class: 'mini' }, card);
    for (let k = 0; k < 2 + (i % 2); k++) el('span', {}, knobs);
    const acts = el('div', { class: 'acts' }, card);
    const mv = (d) => () => {
      const j = i + d;
      if (j < 0 || j >= C.blocks.length) return;
      [C.blocks[i], C.blocks[j]] = [C.blocks[j], C.blocks[i]];
      commit();
      renderCircuit();
    };
    el('button', { class: 'fz-lbtn', title: 'Move up', onclick: mv(-1) }, acts, '<i class="ic fz-ic-up"></i>');
    el('button', { class: 'fz-lbtn', title: 'Move down', onclick: mv(1) }, acts, '<i class="ic ic-down"></i>');
    el('button', { class: 'fz-lbtn', title: 'Remove', onclick: () => { C.blocks.splice(i, 1); commit(); renderCircuit(); } }, acts, '<i class="ic ic-x"></i>');
  });
  el('div', { class: 'fz-node io' }, chain).textContent = 'Out to amp';
  const s3 = sec(host, 'Add a block');
  const add = el('div', { class: 'fz-chips' }, s3);
  for (const [k, [name, cat]] of Object.entries(BLOCKS)) {
    const b = el('button', { class: `chip sm fz-addblock cat-${cat}` }, add);
    b.textContent = name;
    b.onclick = () => {
      C.blocks.push({ id: uid('b'), kind: k });
      commit();
      renderCircuit();
    };
  }
}

function setTab(t) {
  prefs.tab = t;
  savePrefs();
  ui.tabs.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.t === t));
  for (const k of ['parts', 'layers', 'circuit']) ui[k].hidden = k !== t;
}

// ------------------------------------------------------------------ templates gallery
function openTemplates() {
  const layer = ui.tpl;
  layer.textContent = '';
  layer.classList.add('show');
  const box = el('div', { class: 'fz-tpl' }, layer);
  const head = el('header', {}, box);
  el('div', {}, head, '<h2>Start from a template</h2><p>Your current design stays in the undo history.</p>');
  el('button', { class: 'icon-btn', title: 'Close', onclick: closeTemplates }, head, '<i class="ic ic-x"></i>');
  const grid = el('div', { class: 'fz-tpl-grid' }, box);
  for (const t of TEMPLATES) {
    const card = el('button', { class: 'fz-tpl-card', 'data-template': t.id }, grid);
    const art = el('div', { class: 'art' }, card);
    art.appendChild(thumb(t.make()));
    el('b', {}, card).textContent = t.name;
    el('small', {}, card).textContent = t.desc;
    card.onclick = () => {
      closeTemplates();
      D = migrateDesign(t.make());
      sel = null;
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
function closeTemplates() {
  ui.tpl.classList.remove('show');
  ui.tpl.textContent = '';
}

// ------------------------------------------------------------------ keyboard
function onKey(e) {
  const v = document.getElementById('view-factory');
  if (!v || !v.classList.contains('active')) return;
  const tag = (e.target.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
  const k = e.key.toLowerCase();
  const mod = e.ctrlKey || e.metaKey;
  let handled = true;
  if (k === ' ' && !mod) {
    ui.space = true;
    ui.stageWrap.classList.add('space');
  } else if (mod && k === 'z') e.shiftKey ? redo() : undo();
  else if (mod && k === 'y') redo();
  else if (mod && k === 'd') duplicateSel();
  else if ((k === 'delete' || k === 'backspace') && sel && sel !== 'enc') removeSel();
  else if (k === 'escape') {
    if (ui.tpl.classList.contains('show')) closeTemplates();
    else select(null);
  } else if (k.startsWith('arrow') && sel) {
    const f = find(sel);
    if (!f || f.kind === 'enc' || f.item.locked) return;
    const step = e.shiftKey ? 5 : prefs.grid || 0.5;
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
    changed(false);
    clearTimeout(ui.nudgeT);
    ui.nudgeT = setTimeout(renderInspector, 250);
  } else if (!mod && (k === '+' || k === '=')) zoomAt(1.2);
  else if (!mod && k === '-') zoomAt(1 / 1.2);
  else if (!mod && k === '0') fit();
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
  ui.circuit = el('div', { class: 'fz-pane' }, left);
  // centre
  const mid = el('div', { class: 'fz-mid' }, root);
  const bar = el('div', { class: 'fz-bar' }, mid);
  ui.name = el('input', { type: 'text', class: 'fz-name', maxlength: 40, title: 'Design name' }, bar);
  ui.name.oninput = () => (D.name = ui.name.value);
  ui.name.onchange = () => commit();
  el('button', { class: 'btn small', id: 'fzTemplates', onclick: openTemplates }, bar, '<i class="ic ic-board"></i>Templates');
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
  const gb = el('button', { class: 'icon-btn fz-gridbtn' + (prefs.showGrid ? ' on' : ''), title: 'Show grid' }, bar, '<i class="ic fz-ic-grid"></i>');
  gb.onclick = () => {
    prefs.showGrid = !prefs.showGrid;
    gb.classList.toggle('on', prefs.showGrid);
    savePrefs();
    renderStage();
  };
  el('div', { class: 'fz-grow' }, bar);
  const ex = el('span', { class: 'fz-soonwrap', 'data-tip': 'Coming soon' }, bar);
  el('button', { class: 'btn small btn-accent', id: 'fzExport', disabled: '' }, ex, '<i class="ic ic-import"></i>Export');

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
  const zb = el('div', { class: 'fz-zoom' }, ui.stageWrap);
  el('button', { class: 'icon-btn', title: 'Zoom out (-)', onclick: () => zoomAt(1 / 1.25) }, zb, '<i class="ic ic-minus"></i>');
  ui.zoomVal = el('span', { class: 'fz-zoomval' }, zb);
  el('button', { class: 'icon-btn', title: 'Zoom in (+)', onclick: () => zoomAt(1.25) }, zb, '<i class="ic ic-plus"></i>');
  el('button', { class: 'icon-btn', title: 'Fit (0)', onclick: () => { view.touched = false; fit(); renderOverlay(); } }, zb, '<i class="ic ic-fit"></i>');
  ui.status = el('div', { class: 'fz-status' }, ui.stageWrap);
  el('div', { class: 'fz-hint' }, ui.stageWrap).textContent = 'Scroll to zoom · drag empty space to pan · Alt skips snapping';
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
    const ok = saved && saved.enc && Array.isArray(saved.ctls) && Array.isArray(saved.jacks) && Array.isArray(saved.art) && saved.title && saved.sub && saved.circuit;
    D = migrateDesign(ok ? saved : TEMPLATES[0].make());
    pruneImages(new Set((D.enc.patterns || []).map((L) => L.img).filter(Boolean)));
    hist.stack = [];
    hist.idx = -1;
    commit();
    refreshAll();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => renderStage());
    window.__tzFactory = { design: () => D, selection: () => sel, load: (d) => loadDesign(clone(d), true), select: (id) => select(id) };
  }
  requestAnimationFrame(() => {
    if (!view.touched) fit();
    renderOverlay();
  });
}
