// Pedal Factory: the extra control types. Each one is stored with an existing `kind` (so wiring, test mode and the
// board treat it like that kind) plus `part` for its look and inspector. The XY pad / joystick is the one new kind
// ('xy'): two values, one per axis, wired through c.maps[0] (x) and c.maps[1] (y). No imports, so the circuit code
// can use this file too.

export const PART_INFO = {
  encoder: { kind: 'knob', name: 'Encoder' },
  meter: { kind: 'knob', name: 'Needle meter' },
  strip: { kind: 'slider', name: 'Touch strip' },
  arcade: { kind: 'button', name: 'Arcade button' },
  steps: { kind: 'sel', name: 'Step buttons' },
};
// parts that are gone: the whammy lever, pressure pad and light sensor become plain knobs, the toggle bank is now a
// look of the DIP switch. Kinds stay the same, so wiring is kept.
const OLD_KNOBS = { lever: 8, pad: 8, ldr: 5.5 };
/** Brings an older control up to date (in place). Returns true when it changed it. */
export function migrateCtl(c) {
  if (!c) return false;
  let changed = false;
  if (OLD_KNOBS[c.part]) {
    c.r = OLD_KNOBS[c.part];
    delete c.part;
    for (const k of ['len', 'w', 'tipMat', 'color']) delete c[k];
    c.kind = 'knob';
    c.style = 'boss';
    if (c.labelPos === 'none' && c.label) c.labelPos = 'below';
    changed = true;
  } else if (c.part === 'tbank') {
    delete c.part;
    c.kind = 'dip';
    c.look = 'toggle';
    changed = true;
  }
  // LED rings with LEDs wired one by one (before the One input / Each LED choice) are Each LED rings
  if (c.part === 'encoder' && !c.ringIn && c.ringLeds && Object.keys(c.ringLeds).some((k) => /^\d+$/.test(k))) {
    c.ringIn = 'each';
    changed = true;
  }
  // knob skirts used to share the dial's material; now they have their own (null = stock)
  if (c.kind === 'knob' && !c.part && c.skirtMat === undefined) {
    c.skirtMat = c.dialMat ? JSON.parse(JSON.stringify(c.dialMat)) : null;
    changed = true;
  }
  return changed;
}
/** The control as it should be drawn: older parts drawn as what they became (a copy, the input is not touched). */
export function drawable(c) {
  if (!c) return c;
  const old = OLD_KNOBS[c.part] || c.part === 'tbank' || (c.kind === 'knob' && !c.part && c.skirtMat === undefined && c.dialMat);
  if (!old) return c;
  const x = { ...c };
  migrateCtl(x);
  return x;
}

// rotary encoders click round in detent steps: c.encSteps a turn (one turn = the value going 0 to 1)
export const ENC_STEPS_DEF = 24;
export const encSteps = (c) => Math.max(4, Math.min(64, Math.round((c && c.encSteps) || ENC_STEPS_DEF)));
/** v snapped to the nearest step (wraps: a value of 1 is 0 again when wrap). */
export function encSnap(v, steps, wrap) {
  const q = Math.round(v * steps) / steps;
  return wrap ? ((q % 1) + 1) % 1 : Math.min(1, Math.max(0, q));
}

export const XY_LOOKS = [['pad', 'XY pad'], ['glow', 'Glow pad'], ['stick', 'Joystick'], ['thumb', 'Thumbstick']];
const XY_NAMES = Object.fromEntries(XY_LOOKS);
export const isStick = (c) => c.look === 'stick' || c.look === 'thumb';

/** Display name for a control with a part (or an XY control), else ''. */
export function partName(c) {
  if (!c) return '';
  if (c.kind === 'xy') return XY_NAMES[c.look] || 'XY pad';
  return (c.part && PART_INFO[c.part] && PART_INFO[c.part].name) || '';
}

// size of the XY area in mm
export const xySize = (c) => (isStick(c) ? [(c.r || 9) * 2, (c.r || 9) * 2] : [c.w || 26, c.h || 26]);

/**
 * The two block controls of an XY control (designToDef): one slider per axis, cid "<id>.x" / "<id>.y",
 * param "u.<id>.x" / "u.<id>.y". On the board the pad surface drags Y, the rail under it drags X.
 */
export function xyControls(c, S = 2) {
  const [w, h] = xySize(c);
  const name = c.label || (isStick(c) ? 'STICK' : 'XY');
  return ['x', 'y'].map((ax, i) => ({
    ctl: { cid: c.id + '.' + ax, t: 'slider', orient: i ? 'v' : 'h', h: (i ? h : w) * S, p: 'u.' + c.id + '.' + ax, min: 0, max: 1, def: (i ? c.vy : c.vx) ?? 0.5, virtual: true, label: name + ' ' + ax.toUpperCase(), xy: c.id },
    map: (c.maps || [])[i] || null,
  }));
}
