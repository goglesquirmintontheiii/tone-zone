// Pedal Factory: the extra control types. Each one is stored with an existing `kind` (so wiring, test mode and the
// board treat it like that kind) plus `part` for its look and inspector. The XY pad / joystick is the one new kind
// ('xy'): two values, one per axis, wired through c.maps[0] (x) and c.maps[1] (y). No imports, so the circuit code
// can use this file too.

export const PART_INFO = {
  encoder: { kind: 'knob', name: 'Encoder' },
  lever: { kind: 'knob', name: 'Whammy lever' },
  pad: { kind: 'knob', name: 'Pressure pad' },
  ldr: { kind: 'knob', name: 'Light sensor' },
  meter: { kind: 'knob', name: 'Needle meter' },
  strip: { kind: 'slider', name: 'Touch strip' },
  arcade: { kind: 'button', name: 'Arcade button' },
  steps: { kind: 'sel', name: 'Step buttons' },
  tbank: { kind: 'dip', name: 'Toggle bank' },
};

/** Display name for a control with a part (or an XY control), else ''. */
export function partName(c) {
  if (!c) return '';
  if (c.kind === 'xy') return c.look === 'stick' ? 'Joystick' : 'XY pad';
  return (c.part && PART_INFO[c.part] && PART_INFO[c.part].name) || '';
}

// size of the XY area in mm
export const xySize = (c) => (c.look === 'stick' ? [(c.r || 9) * 2, (c.r || 9) * 2] : [c.w || 26, c.h || 26]);

/**
 * The two block controls of an XY control (designToDef): one slider per axis, cid "<id>.x" / "<id>.y",
 * param "u.<id>.x" / "u.<id>.y". On the board the pad surface drags Y, the rail under it drags X.
 */
export function xyControls(c, S = 2) {
  const [w, h] = xySize(c);
  const name = c.label || (c.look === 'stick' ? 'STICK' : 'XY');
  return ['x', 'y'].map((ax, i) => ({
    ctl: { cid: c.id + '.' + ax, t: 'slider', orient: i ? 'v' : 'h', h: (i ? h : w) * S, p: 'u.' + c.id + '.' + ax, min: 0, max: 1, def: (i ? c.vy : c.vx) ?? 0.5, virtual: true, label: name + ' ' + ax.toUpperCase(), xy: c.id },
    map: (c.maps || [])[i] || null,
  }));
}
