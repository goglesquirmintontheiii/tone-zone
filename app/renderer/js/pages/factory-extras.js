// Pedal Factory: the extra parts in the palette (encoder, XY pad, joystick, touch strip, arcade button, step
// buttons, toggle bank, whammy lever, pressure pad, light sensor, needle meter) and their inspector sections, plus
// the looks of sliders, rotary switches and LEDs, dials, footswitch nuts, angled jacks and the dot grid.
// factory.js calls in here; H is its set of inspector helpers.
import { el } from '../util.js';
import { materialPicker } from '../ui/material-picker.js';
import { targetsFor, targetInfo, mapTo, TAPER_NAMES } from './factory-circuit.js';
import { shapePoints, jackSpot, dotsOn } from './factory-render.js';
import { ENC_CAPS, STRIP_LOOKS, SLIDER_LOOKS, SEL_LOOKS, LED_LOOKS, LED_BEZELS } from './factory-controls.js';
import { NEW_KNOBS, DIALS } from './factory-parts.js';
import { partName } from './factory-kinds.js';

export { partName, NEW_KNOBS };
const uid = (p) => p + Math.random().toString(36).slice(2, 8);
const clone = (o) => JSON.parse(JSON.stringify(o));
const LED_COLORS = ['#ff2a1a', '#3ddc84', '#3fa8ff', '#ffb020', '#f4f4ff', '#b45cff'];
const base = (o) => Object.assign({ label: '', labelPos: 'below' }, o);

// ------------------------------------------------------------------ palette
export const EXTRA_PARTS = {
  encoder: { name: 'Encoder', make: () => base({ id: uid('e'), kind: 'knob', part: 'encoder', r: 8, value: 0.5, cap: 'knurl', push: true }), sample: [{ kind: 'knob', part: 'encoder', r: 7.5, value: 0.6, push: true }, 1.15] },
  encring: { name: 'LED ring encoder', make: () => base({ id: uid('e'), kind: 'knob', part: 'encoder', r: 7, value: 0.5, cap: 'rubber', ring: true, ringN: 16, ringMode: 'arc', ringColor: '#3fa8ff' }), sample: [{ kind: 'knob', part: 'encoder', r: 6, ring: true, ringN: 16, cap: 'rubber', value: 0.62, ringColor: '#3fa8ff', ringColor2: '#ff3fb4' }, 1.2] },
  xy: { name: 'XY pad', make: () => base({ id: uid('x'), kind: 'xy', look: 'pad', w: 26, h: 26, vx: 0.5, vy: 0.5, color: '#3fa8ff', maps: [] }), sample: [{ kind: 'xy', w: 20, h: 17, vx: 0.68, vy: 0.62 }, 1] },
  stick: { name: 'Joystick', make: () => base({ id: uid('x'), kind: 'xy', look: 'stick', r: 9, vx: 0.5, vy: 0.5, maps: [] }), sample: [{ kind: 'xy', look: 'stick', r: 8, vx: 0.72, vy: 0.7 }, 1] },
  strip: { name: 'Touch strip', make: () => base({ id: uid('v'), kind: 'slider', part: 'strip', look: 'touch', h: 40, w: 6, orient: 'v', value: 0.5, color: '#3fa8ff' }), sample: [{ kind: 'slider', part: 'strip', h: 22, w: 5, value: 0.62 }, 1] },
  arcade: { name: 'Arcade button', make: () => base({ id: uid('b'), kind: 'button', part: 'arcade', r: 7, color: '#d0312d', led: true, on: false }), sample: [{ kind: 'button', part: 'arcade', r: 8.5, color: '#d0312d' }, 1] },
  steps: { name: 'Step buttons', make: () => base({ id: uid('r'), kind: 'sel', part: 'steps', n: 4, opts: ['1', '2', '3', '4'], pos: 0, ledColor: '#3ddc84', labelPos: 'none' }), sample: [{ kind: 'sel', part: 'steps', n: 3, pos: 1, opts: [] }, 1] },
  tbank: { name: 'Toggle bank', make: () => base({ id: uid('d'), kind: 'dip', part: 'tbank', n: 4, bits: [1, 0, 0, 1], maps: [], labelPos: 'none' }), sample: [{ kind: 'dip', part: 'tbank', n: 4, bits: [1, 0, 1, 1] }, 1.25] },
  lever: { name: 'Whammy lever', make: () => base({ id: uid('k'), kind: 'knob', part: 'lever', len: 26, value: 0.5, labelPos: 'none' }), sample: [{ kind: 'knob', part: 'lever', len: 24, value: 0.35 }, 1] },
  pad: { name: 'Pressure pad', make: () => base({ id: uid('k'), kind: 'knob', part: 'pad', w: 16, value: 0, color: '#ff7a2f' }), sample: [{ kind: 'knob', part: 'pad', w: 17, value: 0.6 }, 1] },
  ldr: { name: 'Light sensor', make: () => base({ id: uid('k'), kind: 'knob', part: 'ldr', r: 3.5, value: 0.5 }), sample: [{ kind: 'knob', part: 'ldr', r: 5, value: 0.8 }, 1.2] },
  meter: { name: 'Needle meter', make: () => base({ id: uid('k'), kind: 'knob', part: 'meter', w: 28, h: 18, value: 0.4 }), sample: [{ kind: 'knob', part: 'meter', w: 24, h: 16, value: 0.62 }, 1] },
};
export const EXTRA_LAYER_ICONS = { xy: 'M4 4h16v16H4zM12 4v16M4 12h16' };
// material names for "apply to all" (by part, or by kind for the plain ones)
export const EXTRA_PART_NAMES = {
  encoder: 'encoders', lever: 'levers', pad: 'pressure pads', ldr: 'light sensors', meter: 'meter bezels', strip: 'touch strips', arcade: 'arcade buttons',
  steps: 'step buttons', tbank: 'toggle levers', xy: 'XY pads', slider: 'slider caps', sel: 'rotary switch caps', pedal: 'foot pedals',
};
export const partKey = (c) => c.part || c.kind;

// ------------------------------------------------------------------ inspector: main section for the extra controls and looks
/** Fills section s for control c. Returns true when it handled the control (factory.js skips its own section). */
export function partInspector(s, c, multi, H, o = {}) {
  const { slider, seg, colors, selectField, textField, check, row } = H;
  const wrap = (x) => (x && x.classList.add('fz-wrap'), x);
  switch (c.part) {
    case 'encoder':
      seg(s, 'Cap', ENC_CAPS, c.cap || 'knurl', (v) => (c.cap = v), false);
      seg(s, 'Size', [[5.5, 'S'], [8, 'M'], [10.5, 'L'], [13, 'XL']], c.r, (v) => (c.r = +v), false);
      check(s, 'Push switch', c.push, (v) => (c.push = v));
      check(s, 'LED ring', c.ring, (v) => (c.ring = v), true);
      if (c.ring) {
        slider(s, 'LEDs', c.ringN || 16, 8, 32, 1, (v) => (c.ringN = v));
        seg(s, 'Shows', [['arc', 'Arc'], ['dot', 'Dot']], c.ringMode || 'arc', (v) => (c.ringMode = v), false);
        check(s, 'Centre detent', c.detent, (v) => (c.detent = v));
        colors(s, 'Colour', c.ringColor || '#3fa8ff', LED_COLORS, (v) => (c.ringColor = v), 'ring');
        check(s, 'Gradient', !!c.ringColor2, (v) => (c.ringColor2 = v ? '#ff3fb4' : null), true);
        if (c.ringColor2) colors(s, 'Ends in', c.ringColor2, LED_COLORS, (v) => (c.ringColor2 = v), 'ring2');
      }
      slider(s, 'Value', c.value ?? 0.5, 0, 1, 0.01, (v) => (c.value = v));
      note(s, 'An endless encoder: turn it to change the value. The ring of LEDs lights to show it.');
      return true;
    case 'lever':
      slider(s, 'Length', c.len || 26, 14, 44, 1, (v) => (c.len = v));
      slider(s, 'Position', c.value ?? 0.5, 0, 1, 0.01, (v) => (c.value = v));
      note(s, 'A whammy bar: push it either way to bend the value.');
      return true;
    case 'pad':
      slider(s, 'Size', c.w || 16, 8, 34, 0.5, (v) => (c.w = v));
      colors(s, 'Glow', c.color || '#ff7a2f', ['#ff7a2f', ...LED_COLORS], (v) => (c.color = v), 'padglow');
      slider(s, 'Pressure', c.value ?? 0, 0, 1, 0.01, (v) => (c.value = v));
      note(s, 'Press harder (drag up) for more.');
      return true;
    case 'ldr':
      seg(s, 'Size', [[2.5, 'S'], [3.5, 'M'], [5, 'L']], c.r || 3.5, (v) => (c.r = +v), false);
      slider(s, 'Light', c.value ?? 0.5, 0, 1, 0.01, (v) => (c.value = v));
      note(s, 'A light sensor. Drag it to set how much light falls on it.');
      return true;
    case 'meter':
      slider(s, 'Width', c.w || 28, 16, 60, 1, (v) => (c.w = v));
      slider(s, 'Height', c.h || 18, 10, 40, 1, (v) => (c.h = v));
      colors(s, 'Face', c.face || '#efe6cc', ['#efe6cc', '#f4f4f0', '#1d1f24', '#f2c230'], (v) => (c.face = v), 'face');
      check(s, 'Backlight', c.lit, (v) => (c.lit = v));
      textField(s, 'Text', c.text ?? 'VU', (v) => (c.text = v));
      slider(s, 'Needle', c.value ?? 0.4, 0, 1, 0.01, (v) => (c.value = v));
      return true;
    case 'strip':
      seg(s, 'Look', STRIP_LOOKS, c.look || 'touch', (v) => (c.look = v), false);
      seg(s, 'Direction', [['v', 'Up / down'], ['h', 'Sideways']], c.orient || 'v', (v) => (c.orient = v), false);
      slider(s, 'Length', c.h || 40, 16, 120, 1, (v) => (c.h = v));
      slider(s, 'Width', c.w || 6, 3, 14, 0.5, (v) => (c.w = v));
      colors(s, 'Light', c.color || '#3fa8ff', LED_COLORS, (v) => (c.color = v), 'strip');
      slider(s, 'Position', c.value ?? 0.5, 0, 1, 0.01, (v) => (c.value = v));
      return true;
    case 'arcade':
      slider(s, 'Size', c.r || 7, 4, 13, 0.5, (v) => (c.r = v));
      if (!c.mat) colors(s, 'Cap', c.color || '#d0312d', ['#d0312d', '#f5cb2f', '#2f9a57', '#2f7de0', '#f1f0ec', '#1c1d21'], (v) => (c.color = v), 'cap');
      colors(s, 'Bezel', c.ringColor || '#1c1d21', ['#1c1d21', '#f1f0ec', '#d0312d', '#2f7de0', '#8a9099'], (v) => (c.ringColor = v), 'arcring');
      check(s, 'Lights up', c.led, (v) => (c.led = v), true);
      if (c.led) {
        colors(s, 'Light', c.ledColor || c.color || '#d0312d', LED_COLORS, (v) => (c.ledColor = v), 'arcled');
        check(s, 'Lit', c.on, (v) => (c.on = v));
      }
      note(s, 'A big arcade button. On the board and in test mode it latches on and off.');
      return true;
    case 'steps':
      slider(s, 'Buttons', c.n || 4, 2, 8, 1, (v) => {
        c.n = v;
        const op = (c.opts || []).slice();
        while (op.length < v) op.push(String(op.length + 1));
        c.opts = op;
        c.pos = Math.min(c.pos || 0, v - 1);
      });
      textField(s, 'Names', (c.opts || []).slice(0, c.n).join(', '), (v) => (c.opts = v.split(',').map((x) => x.trim().toUpperCase().slice(0, 5))));
      check(s, 'Print names', c.marks !== false, (v) => (c.marks = v));
      colors(s, 'LED', c.ledColor || '#3ddc84', LED_COLORS, (v) => (c.ledColor = v), 'stepled');
      if (!multi) seg(s, 'Set to', (c.opts || []).slice(0, c.n).map((x, i) => [i, x || String(i + 1)]), c.pos || 0, (v) => (c.pos = +v), false);
      note(s, 'Picks one of several, like a rotary switch: the lit button is the choice.');
      return true;
    case 'tbank':
      slider(s, 'Switches', c.n || 4, 2, 8, 1, (v) => {
        c.n = v;
        const b = (c.bits || []).slice(0, v);
        while (b.length < v) b.push(0);
        c.bits = b;
      });
      if (!multi) {
        const r = row(s, 'Set');
        const bits = el('div', { class: 'fz-bits' }, r);
        for (let i = 0; i < c.n; i++) {
          const b = el('button', { class: c.bits[i] ? 'on' : '' }, bits);
          b.textContent = i + 1;
          b.onclick = () => {
            const nb = c.bits.slice();
            nb[i] = nb[i] ? 0 : 1;
            c.bits = nb;
            b.classList.toggle('on', !!nb[i]);
            H.changed(false);
          };
        }
      }
      note(s, 'A row of mini toggles. Each one can be wired to something different.');
      return true;
  }
  if (c.kind === 'xy') {
    seg(s, 'Look', [['pad', 'XY pad'], ['stick', 'Joystick']], c.look || 'pad', (v) => (c.look = v), true);
    if (c.look === 'stick') slider(s, 'Size', c.r || 9, 5, 16, 0.5, (v) => (c.r = v));
    else {
      slider(s, 'Width', c.w || 26, 12, 70, 1, (v) => (c.w = v));
      slider(s, 'Height', c.h || 26, 12, 70, 1, (v) => (c.h = v));
      colors(s, 'Light', c.color || '#3fa8ff', LED_COLORS, (v) => (c.color = v), 'xy');
    }
    slider(s, 'X', c.vx ?? 0.5, 0, 1, 0.01, (v) => (c.vx = v));
    slider(s, 'Y', c.vy ?? 0.5, 0, 1, 0.01, (v) => (c.vy = v));
    note(s, 'Two values in one: across and up. On the board drag the pad up and down for Y and the rail under it for X.');
    return true;
  }
  if (c.kind === 'slider') {
    wrap(seg(s, 'Look', SLIDER_LOOKS, c.look || 'classic', (v) => (c.look = v), true));
    seg(s, 'Direction', [['v', 'Up / down'], ['h', 'Sideways']], c.orient || 'v', (v) => (c.orient = v), false);
    slider(s, 'Length', c.h || 24, 10, 90, 1, (v) => (c.h = v));
    slider(s, 'Cap width', c.w || 5, 3, 12, 0.5, (v) => (c.w = v));
    if (c.look === 'led') colors(s, 'LED', c.ledColor || '#3fa8ff', LED_COLORS, (v) => (c.ledColor = v), 'sled');
    slider(s, 'Position', c.value ?? 0.5, 0, 1, 0.01, (v) => (c.value = v));
    return true;
  }
  if (c.kind === 'sel') {
    wrap(seg(s, 'Look', SEL_LOOKS, c.look || 'classic', (v) => (c.look = v), true));
    slider(s, 'Positions', c.n || 4, 2, 12, 1, (v) => {
      c.n = v;
      const op = (c.opts || []).slice();
      while (op.length < v) op.push(String(op.length + 1));
      c.opts = op;
      c.pos = Math.min(c.pos || 0, v - 1);
    });
    if (c.look !== 'chicken' && c.look !== 'pointer') selectField(s, 'Cap', o.knobStyles || [], c.style || 'boss', (v) => (c.style = v));
    seg(s, 'Size', [[5, 'S'], [7, 'M'], [9, 'L']], c.r, (v) => (c.r = +v), false);
    textField(s, 'Positions', (c.opts || []).slice(0, c.n).join(', '), (v) => (c.opts = v.split(',').map((x) => x.trim().toUpperCase().slice(0, 5))));
    if (c.look !== 'wafer' && c.look !== 'lcd') check(s, 'Print names', c.marks !== false, (v) => (c.marks = v));
    if (c.look === 'ring' || c.look === 'wafer') colors(s, 'Light', c.ledColor || '#ff3020', ['#ff3020', ...LED_COLORS.slice(1)], (v) => (c.ledColor = v), 'selled');
    if (!multi) seg(s, 'Set to', (c.opts || []).slice(0, c.n).map((x, i) => [i, x || String(i + 1)]), c.pos || 0, (v) => (c.pos = +v), false);
    return true;
  }
  if (c.kind === 'led') {
    wrap(seg(s, 'Look', LED_LOOKS, c.look || 'round', (v) => (c.look = v), true));
    colors(s, 'Colour', c.color, LED_COLORS, (v) => (c.color = v), 'led');
    if (c.look === 'bicolour') colors(s, 'Off colour', c.color2 || '#3ddc84', LED_COLORS, (v) => (c.color2 = v), 'led2');
    if (c.look === 'bar') {
      slider(s, 'Width', c.w || 8, 3, 30, 0.5, (v) => (c.w = v));
      slider(s, 'Height', c.h || 2.4, 1.2, 8, 0.2, (v) => (c.h = v));
    } else if (c.look === 'meter') {
      slider(s, 'Segments', c.n || 8, 3, 16, 1, (v) => (c.n = v));
      slider(s, 'Level', c.level ?? 0.7, 0, 1, 0.01, (v) => (c.level = v));
    } else seg(s, 'Size', [[1.5, '3 mm'], [2.5, '5 mm'], [4, '8 mm']], c.r, (v) => (c.r = +v), false);
    if (c.look !== 'jewel') wrap(seg(s, 'Bezel', LED_BEZELS, c.bezel || 'chrome', (v) => (c.bezel = v), false));
    check(s, 'Lit', c.on, (v) => (c.on = v));
    return true;
  }
  return false;
}
const note = (s, t) => (el('p', { class: 'fz-note' }, s).textContent = t);

// ------------------------------------------------------------------ inspector: extra material sections and the dial
// one material for one property of a part, with "apply to all"
function matSection(host, D, c, key, title, H, names) {
  const s = H.sec(host, title);
  s.classList.add('fz-partmat', 'fz-mat-' + key);
  materialPicker(s, {
    key: 'fz-' + key, value: c[key] || { m: 'stock' }, allowStock: true, wear: true, collapsible: true,
    onChange: (spec, live) => {
      c[key] = spec.m === 'stock' ? null : spec;
      H.changed(live);
    },
  });
  const ar = el('div', { class: 'fz-actrow' }, s);
  const pk = partKey(c);
  el('button', { class: 'btn small', 'data-apply': key, onclick: () => { const m = c[key] ? clone(c[key]) : null; for (const o of D.ctls) if (partKey(o) === pk) o[key] = m ? clone(m) : null; H.changed(false); } }, ar, 'Apply to all ' + names);
}
/** Sections after the control's own one: dial, nut, base and tip materials. */
export function extraSections(host, D, c, multi, H) {
  if (c.kind === 'knob' && !c.part) {
    const s = H.sec(host, 'Dial');
    H.seg(s, 'Dial', DIALS, c.dial || 'none', (v) => (c.dial = v), true);
    el('p', { class: 'fz-note' }, s).textContent = 'A plate or scale ring under the knob. Its material also colours the knob skirt.';
    matSection(host, D, c, 'dialMat', 'Dial and skirt material', H, 'knobs');
  } else if (c.kind === 'foot' && c.style !== 'rc' && c.style !== 'ts') matSection(host, D, c, 'nutMat', c.style === 'soft' ? 'Bezel material' : 'Nut material', H, 'footswitches');
  else if (c.part === 'tbank') matSection(host, D, c, 'plateMat', 'Plate material', H, 'toggle banks');
  else if (c.part === 'arcade') matSection(host, D, c, 'ringMat', 'Bezel material', H, 'arcade buttons');
  else if (c.part === 'lever') matSection(host, D, c, 'tipMat', 'Tip material', H, 'levers');
  else if (c.kind === 'xy' && c.look === 'stick') matSection(host, D, c, 'plateMat', 'Base material', H, 'joysticks');
}

// ------------------------------------------------------------------ inspector: XY wiring (one target per axis)
export function xyWiring(host, D, c, H) {
  const C = D.circuit;
  const s = H.sec(host, 'Controls');
  s.classList.add('fz-wiring');
  const opts = targetsFor(C, 'knob').filter((t) => !t[0] || (t[2] && !String(t[0]).endsWith('.tap'))).map((t) => [t[0], t[1]]);
  ['Across (X)', 'Up (Y)'].forEach((name, i) => {
    const m = (c.maps || [])[i] || null;
    const box = el('div', { class: 'fz-dipmap', 'data-axis': i ? 'y' : 'x' }, s);
    const cur = m ? m.to || '' : '';
    const o2 = opts.slice();
    if (cur && !o2.some((x) => x[0] === cur)) o2.push([cur, 'Missing stage']);
    H.selectField(box, name, o2, cur, (v) => {
      const maps = (c.maps || []).slice();
      while (maps.length < 2) maps.push(null);
      maps[i] = v ? mapTo(C, v) : null;
      c.maps = maps;
    }, true);
    const info = m && targetInfo(C, m.to);
    if (!info) return;
    const lo = info.min ?? 0, hi = info.max ?? 1, step = info.i ? 1 : (hi - lo) / 200;
    const set = (k) => (x) => {
      const maps = c.maps.slice();
      maps[i] = { ...maps[i], [k]: x };
      c.maps = maps;
    };
    H.slider(box, 'From', m.min ?? lo, lo, hi, step, set('min'));
    H.slider(box, 'To', m.max ?? hi, lo, hi, step, set('max'));
    H.seg(box, 'Taper', TAPER_NAMES, m.taper || 'lin', set('taper'), false);
    H.check(box, 'Invert', m.invert, set('invert'));
  });
}

// ------------------------------------------------------------------ inspector: jack angle
export function jackAngleSection(host, D, j, multi, H) {
  const s = H.sec(host, 'Angle');
  const auto = typeof j.angle !== 'number';
  H.seg(s, 'Points', [['auto', 'Out of the edge'], ['hand', 'By hand']], auto ? 'auto' : 'hand', (v) => {
    if (v === 'auto') j.angle = undefined;
    else {
      const sp = jackSpot(shapePoints(D.enc.shape, D.enc.w, D.enc.h), D, { ...j, angle: undefined });
      j.angle = Math.round(((sp.ang % 360) + 360) % 360);
    }
  }, true);
  if (!auto) H.slider(s, 'Angle', j.angle, 0, 359, 1, (v) => (j.angle = v));
  el('p', { class: 'fz-note' }, s).textContent = auto ? 'Jacks sit on the outline and point straight out of it, so on a curve or a slanted edge they turn to match.' : '0 points right, 90 down, 180 left, 270 up. Cables on the board leave the same way.';
}

// ------------------------------------------------------------------ inspector: dot grid
export function dotsSection(host, E, H) {
  const s = H.sec(host, 'Dot grid');
  H.check(s, 'Show dots', dotsOn(E), (v) => (E.dots = !!v), true);
  if (dotsOn(E)) {
    H.slider(s, 'Spacing', E.dotStep || 2.5, 1.5, 10, 0.5, (v) => (E.dotStep = v));
    H.slider(s, 'Dot size', E.dotSize || 0.22, 0.1, 0.7, 0.01, (v) => (E.dotSize = v));
  }
  el('p', { class: 'fz-note' }, s).textContent = 'Printed on the pedal, so it shows the same on the board.';
}
export { dotsOn };
