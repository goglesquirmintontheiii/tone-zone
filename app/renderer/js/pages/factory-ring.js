// Pedal Factory: the inputs of an LED ring encoder in the wiring diagram, and what the ring shows from them.
// c.ringIn: 'one' (default) the whole ring has one analog input (c.ringFrom: the arc or dot position), or 'each'
// one input per LED (analog sets that LED's brightness, binary turns it on or off). c.ringRgb: RGB LEDs, so each
// input becomes three (red, green, blue): per LED, or for the whole ring next to its position input.
// The refs live in c.ringFrom and c.ringLeds, keyed '3' (LED 4), '3r' / '3g' / '3b' (its colours) and 'r' / 'g' /
// 'b' (the colour of the whole ring). Unwired LEDs follow the knob. No imports, so circuit-links.js can use it.

const CH = ['r', 'g', 'b'];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const ringCount = (c) => clamp(Math.round(c.ringN || 12), 2, 32);
export const ringEach = (c) => c.ringIn === 'each';
const hex2 = (n) => Math.round(clamp(n, 0, 255)).toString(16).padStart(2, '0');
/** A colour from red, green and blue amounts (0..1), or null when all three are dark. */
export function rgbHex(r, g, b) {
  if (Math.max(r, g, b) < 0.02) return null;
  return '#' + [r, g, b].map((k) => hex2(clamp(k, 0, 1) * 255)).join('');
}

const PER_ROW = 8, RGB_ROW = 3; // LEDs per line in the diagram
/**
 * The ring's input ports in the wiring diagram, as [{k, label, sig, x, row}] (k null = the position input),
 * plus the number of rows they take. x is in diagram units from the row start.
 */
export function ringPorts(c) {
  const n = ringCount(c), rgb = !!c.ringRgb, each = ringEach(c);
  const out = [];
  // the position input; in Each LED mode only while an older design still has it wired
  if (!each || (c.ringFrom && typeof c.ringFrom === 'object')) out.push({ k: null, label: each ? 'Ring (old)' : rgb ? 'Level' : 'Ring', sig: 'n', x: 0, row: 0 });
  if (!each) {
    if (rgb) CH.forEach((ch, i) => out.push({ k: ch, label: ch.toUpperCase(), sig: 'n', x: 56 + i * 26, row: 0, labelRight: true }));
    return { ports: out, rows: 1 };
  }
  const r0 = out.length ? 1 : 0;
  for (let i = 0; i < n; i++) {
    if (rgb) CH.forEach((ch, j) => out.push({ k: i + ch, label: i + 1 + ch.toUpperCase(), sig: 'n', x: (i % RGB_ROW) * 44 + j * 13, row: r0 + Math.floor(i / RGB_ROW) }));
    else out.push({ k: String(i), label: String(i + 1), sig: 'n', x: (i % PER_ROW) * 17, row: r0 + Math.floor(i / PER_ROW) });
  }
  return { ports: out, rows: r0 + Math.ceil(n / (rgb ? RGB_ROW : PER_ROW)) };
}
/** Is key k a ring input this ring still has (after its LED count or mode changed)? */
export function ringKeyOk(c, k) {
  const m = /^(\d+)?([rgb])?$/.exec(String(k));
  if (!m || (!m[1] && !m[2])) return false;
  if (!m[1]) return !ringEach(c) && !!c.ringRgb;
  return ringEach(c) && +m[1] < ringCount(c) && !!m[2] === !!c.ringRgb;
}

/**
 * ledFn body for a ring wired in the diagram. read(ref) -> {t} | null, isRef(ref) -> bool.
 * Returns {v?, leds?, col?}: v the position, leds[i] null (follows the knob), a brightness 0..1 or a colour,
 * col the colour of the whole ring (a colour, or null for dark).
 */
export function ringOut(c, read, isRef) {
  const o = {};
  const t = (r) => {
    if (!isRef(r)) return null;
    const v = read(r);
    return v ? clamp(+v.t || 0, 0, 1) : 0;
  };
  const L = c.ringLeds || {};
  if (isRef(c.ringFrom)) o.v = t(c.ringFrom);
  if (!ringEach(c)) {
    if (c.ringRgb && CH.some((ch) => isRef(L[ch]))) o.col = rgbHex(...CH.map((ch) => t(L[ch]) || 0));
    return o;
  }
  const n = ringCount(c);
  o.leds = new Array(n).fill(null);
  for (let i = 0; i < n; i++) {
    if (c.ringRgb) {
      if (!CH.some((ch) => isRef(L[i + ch]))) continue;
      o.leds[i] = rgbHex(...CH.map((ch) => t(L[i + ch]) || 0)) || 0;
    } else if (isRef(L[i])) o.leds[i] = t(L[i]);
  }
  return o;
}
/** Is anything wired into the ring? */
export const ringAnyWired = (c, isRef) => isRef(c.ringFrom) || Object.entries(c.ringLeds || {}).some(([k, r]) => isRef(r) && ringKeyOk(c, k));
