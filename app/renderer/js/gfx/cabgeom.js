// Speaker-cabinet geometry shared by the cab graphic and the mic → engine-param mapping.
export const CAB_DIMS = { '1x12': [250, 236, 1, 1], '1x10': [230, 220, 1, 1], '2x12': [400, 262, 2, 1], '4x12': [440, 420, 2, 2], '4x10': [300, 330, 2, 2], '8x10': [270, 480, 2, 4], '1x15': [264, 300, 1, 1], '2x10': [300, 240, 2, 1], '2x15': [300, 520, 1, 2], '6x10': [300, 440, 2, 3], '1x18': [300, 330, 1, 1], '2x12v': [262, 400, 1, 2], '3x10': [380, 230, 3, 1] };
export const MIC_TYPES = ['Dynamic 57', 'Condenser 414', 'Ribbon 121', 'Dynamic 421', 'Dynamic 906', 'Dynamic 441', 'Condenser 87', 'Ribbon 160'];
export const MIC_SHORT = ['57', '414', '121', '421', '906', '441', '87', '160'];
export const MIC_COLORS = ['#ff7a2f', '#37d6c2', '#a98bff', '#ffd23f'];

export function cabGeom(size) {
  const [w, h, cols, rows] = CAB_DIMS[size] || CAB_DIMS['4x12'];
  const gx = 18, gy = 18, gw = w - 36, gh = h - 36;
  const sr = Math.min(gw / cols, gh / rows) * 0.42;
  const centers = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) centers.push([gx + (gw * (c + 0.5)) / cols, gy + (gh * (r + 0.5)) / rows]);
  return { w, h, cols, rows, gx, gy, gw, gh, sr, centers };
}
// default mic placement: on speaker 0, `pos` of the radius to the right of the dust cap
export function defaultMicXY(size, idx = 1) {
  const g = cabGeom(size);
  const spk = Math.min(g.centers.length - 1, idx - 1);
  const [cx, cy] = g.centers[spk];
  const dx = idx % 2 ? 0.3 : -0.5;
  return { x: (cx + dx * g.sr - g.gx) / g.gw, y: (cy - g.gy) / g.gh };
}
// grille-normalised mic position → nearest speaker + radial position (0 = dust cap, 1 = cone edge, >1 off the cone)
export function micToSpeaker(size, x, y) {
  const g = cabGeom(size);
  const px = g.gx + x * g.gw, py = g.gy + y * g.gh;
  let best = 0, bd = 1e9;
  g.centers.forEach(([cx, cy], i) => {
    const d = Math.hypot(px - cx, py - cy);
    if (d < bd) { bd = d; best = i; }
  });
  return { spk: best, pos: Math.min(1.3, bd / g.sr) };
}
