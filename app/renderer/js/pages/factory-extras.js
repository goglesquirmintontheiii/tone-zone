// Pedal Factory: inspector sections for the extra controls (encoder, XY pad and joystick, touch strip, arcade button,
// step buttons, needle meter) and the looks of the stock ones (sliders, rotary switches, LEDs, trim pots, DIP
// switches, foot pedals), dials, angled jacks and the dot grid. The palette and its variants live in
// factory-variants.js, materials in factory-matparts.js. factory.js calls in here; H is its set of inspector helpers.
import { el } from '../util.js';
import { shapePoints, jackSpot, dotsOn, TRIM_LOOKS, DIP_LOOKS } from './factory-render.js';
import { ENC_CAPS, STRIP_LOOKS, SLIDER_LOOKS, SEL_LOOKS, LED_LOOKS, LED_BEZELS, ARCADE_SHAPES, STEP_LOOKS, METER_LOOKS } from './factory-controls.js';
import { NEW_KNOBS, DIALS, PEDAL_GRIPS } from './factory-parts.js';
import { partName, XY_LOOKS, isStick } from './factory-kinds.js';
import { partKey } from './factory-matparts.js';
import { PARTS } from './factory-variants.js';

export { partName, NEW_KNOBS, partKey, PARTS };
const LED_COLORS = ['#ff2a1a', '#3ddc84', '#3fa8ff', '#ffb020', '#f4f4ff', '#b45cff'];
export const EXTRA_LAYER_ICONS = { xy: 'M4 4h16v16H4zM12 4v16M4 12h16' };

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
        slider(s, 'LEDs', c.ringN || 12, 2, 32, 1, (v) => (c.ringN = v));
        seg(s, 'Shows', [['arc', 'Arc'], ['dot', 'Dot']], c.ringMode || 'arc', (v) => (c.ringMode = v), false);
        check(s, 'Centre detent', c.detent, (v) => (c.detent = v));
        colors(s, 'Colour', c.ringColor || '#38f07a', ['#38f07a', ...LED_COLORS], (v) => (c.ringColor = v), 'ring');
        check(s, 'Gradient', !!c.ringColor2, (v) => (c.ringColor2 = v ? '#ff3fb4' : null), true);
        if (c.ringColor2) colors(s, 'Ends in', c.ringColor2, LED_COLORS, (v) => (c.ringColor2 = v), 'ring2');
      }
      slider(s, 'Value', c.value ?? 0.5, 0, 1, 0.01, (v) => (c.value = v));
      note(s, 'An endless encoder: turn it to change the value. The ring of LEDs lights to show it.');
      return true;
    case 'meter':
      seg(s, 'Look', METER_LOOKS, c.look || 'vu', (v) => (c.look = v), true);
      if (c.look !== 'round') slider(s, 'Width', c.w || 28, 16, 60, 1, (v) => (c.w = v));
      slider(s, 'Height', c.h || 18, 10, 40, 1, (v) => (c.h = v));
      colors(s, 'Face', c.face || (c.look === 'dark' ? '#15171b' : '#efe6cc'), ['#efe6cc', '#f4f4f0', '#15171b', '#f2c230'], (v) => (c.face = v), 'face');
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
      seg(s, 'Shape', ARCADE_SHAPES, c.shape || 'round', (v) => (c.shape = v), false);
      slider(s, 'Size', c.r || 7, 4, 13, 0.5, (v) => (c.r = v));
      check(s, 'Lights up', c.led, (v) => (c.led = v), true);
      if (c.led) {
        colors(s, 'Light', c.ledColor || c.color || '#d0312d', LED_COLORS, (v) => (c.ledColor = v), 'arcled');
        check(s, 'Lit', c.on, (v) => (c.on = v));
      }
      note(s, 'A big arcade button. On the board and in test mode it latches on and off.');
      return true;
    case 'steps':
      seg(s, 'Look', STEP_LOOKS, c.look || 'rubber', (v) => (c.look = v), false);
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
  }
  if (c.kind === 'xy') {
    wrap(seg(s, 'Look', XY_LOOKS, c.look || 'pad', (v) => (c.look = v), true));
    if (isStick(c)) slider(s, 'Size', c.r || 9, 5, 16, 0.5, (v) => (c.r = v));
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
  if (c.kind === 'trim') {
    seg(s, 'Look', TRIM_LOOKS, c.look || 'square', (v) => (c.look = v), false);
    seg(s, 'Size', [[2.5, 'S'], [3, 'M'], [4, 'L']], c.r, (v) => (c.r = +v), false);
    slider(s, 'Pointer', c.value ?? 0.5, 0, 1, 0.01, (v) => (c.value = v));
    return true;
  }
  if (c.kind === 'dip') {
    seg(s, 'Look', DIP_LOOKS, c.look || 'slide', (v) => (c.look = v), true);
    const max = c.look === 'toggle' ? 8 : 12;
    slider(s, 'Switches', Math.min(c.n || 4, max), 2, max, 1, (v) => {
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
    note(s, c.look === 'toggle' ? 'A row of mini toggles. Wire each one in the wiring diagram.' : 'Each switch can be wired to something different in the wiring diagram.');
    return true;
  }
  if (c.kind === 'pedal') {
    seg(s, 'Grip', PEDAL_GRIPS, c.grip === false ? 'none' : c.grip || 'pad', (v) => (c.grip = v), true).classList.add('fz-wrap');
    slider(s, 'Width', c.w || 40, 16, 200, 1, (v) => (c.w = v));
    slider(s, 'Length', c.h || 60, 20, 200, 1, (v) => (c.h = v));
    textField(s, 'Logo', c.logo, (v) => (c.logo = v));
    slider(s, 'Rocked', c.value ?? 0.5, 0, 1, 0.01, (v) => (c.value = v));
    note(s, 'A treadle you rock with your foot, like a wah or volume pedal. Pick the pedal and its grip under Material.');
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

// ------------------------------------------------------------------ inspector: the dial under a knob
/** Sections after the control's own one: the knob dial. Materials are in factory-matparts.js. */
export function extraSections(host, D, c, multi, H) {
  if (c.kind === 'knob' && !c.part) {
    const s = H.sec(host, 'Dial');
    H.seg(s, 'Dial', DIALS, c.dial || 'none', (v) => (c.dial = v), true);
    el('p', { class: 'fz-note' }, s).textContent = 'A plate or scale ring under the knob. Pick its material under Material.';
  }
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
