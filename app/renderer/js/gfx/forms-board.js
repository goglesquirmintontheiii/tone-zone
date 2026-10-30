// Pedalboard: a frame with rails (velcro, screws or bare), plus the board's name above it. Frame, rails and
// screwheads are drawn in their materials (gfx/materials.js).
import { svg, luminance } from '../util.js';
import { softShadow } from './fx.js';
import { label } from './controls.js';
import { BOARD_SLOT, boardSpecs } from '../catalog/pedalboards.js';
import { materialFill, paint } from './materials.js';

const VELCRO = [
  { fill: 'url(#p-velcro-black)', edge: '#050506' },
  { fill: 'url(#p-velcro-white)', edge: '#b9b6ae' },
  { fill: 'url(#p-velcro-clear)', edge: 'rgba(255,255,255,0.35)' },
];

// small deterministic random numbers from a string seed
function seeded(str, n) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  h = Math.imul(h ^ (n * 2654435761), 1597334677);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

// a pan head screw with a Phillips cross. o.rot turns the cross, o.stripped chews it up a bit.
function screw(g, cx, cy, r, spec, o = {}) {
  svg('circle', { cx: cx + 0.6, cy: cy + 1, r: r + 0.4, fill: '#000', opacity: 0.45 }, g);
  const { f } = paint(g, 'circle', { cx, cy, r }, spec, { scale: 0.12, round: true, edgeWidth: 0.5, glowWidth: 2.5 });
  svg('circle', { cx: cx - r * 0.3, cy: cy - r * 0.3, r: r * 0.36, fill: '#fff', opacity: f && f.translucent ? 0.2 : 0.3 }, g);
  const k = r * 0.55, sw = Math.max(0.8, r * 0.22);
  const slot = (f && f.edge) || '#222';
  const t = `rotate(${(o.rot || 0).toFixed(1)} ${cx} ${cy})`;
  if (!o.stripped) {
    svg('path', { d: `M${cx - k} ${cy}H${cx + k}M${cx} ${cy - k}V${cy + k}`, stroke: slot, 'stroke-width': sw, 'stroke-linecap': 'round', transform: t }, g);
    return;
  }
  // stripped: the slot is reamed out into a rounded hole, with burrs and a few bright scratches
  const rnd = o.rnd;
  svg('path', { d: `M${cx - k * 1.05} ${cy}H${cx + k * 1.05}M${cx} ${cy - k * 1.05}V${cy + k * 1.05}`, stroke: slot, 'stroke-width': sw * 1.5, 'stroke-linecap': 'round', transform: t }, g);
  svg('circle', { cx, cy, r: k * 0.62, fill: slot }, g);
  svg('circle', { cx: cx + k * 0.12, cy: cy + k * 0.12, r: k * 0.36, fill: '#000', opacity: 0.5 }, g);
  for (let i = 0; i < 4; i++) {
    const a = ((o.rot || 0) + i * 90) * (Math.PI / 180);
    const ex = cx + Math.cos(a) * k * 1.05, ey = cy + Math.sin(a) * k * 1.05;
    // raised burr at the slot end
    svg('circle', { cx: ex + Math.cos(a) * sw * 0.55, cy: ey + Math.sin(a) * sw * 0.55, r: sw * 0.42, fill: '#fff', opacity: 0.35 + rnd() * 0.2 }, g);
  }
  const n = 2 + Math.floor(rnd() * 3);
  let d = '';
  for (let i = 0; i < n; i++) {
    const a = rnd() * Math.PI * 2, r0 = r * (0.35 + rnd() * 0.25), len = r * (0.25 + rnd() * 0.35), b = a + (rnd() - 0.5) * 0.6;
    const x0 = cx + Math.cos(a) * r0, y0 = cy + Math.sin(a) * r0;
    d += `M${x0.toFixed(2)} ${y0.toFixed(2)}L${(x0 + Math.cos(b) * len).toFixed(2)} ${(y0 + Math.sin(b) * len).toFixed(2)}`;
  }
  svg('path', { d, stroke: '#fff', 'stroke-width': 0.45, 'stroke-linecap': 'round', opacity: 0.75 }, g);
}

export function installBoardForms(registerForm) {
  registerForm('pedalboard', (ctx, def) => {
    const g = ctx.g;
    const p = (ctx.block && ctx.block.params) || {};
    const seed = (ctx.block && ctx.block.id) || def.id;
    const { cols, rows } = def.pedalboard;
    const S = BOARD_SLOT;
    const w = cols * S.w + S.padX * 2, h = rows * S.h + S.padY * 2;
    const specs = boardSpecs(p);
    const vel = VELCRO[Math.round(p.velcro || 0)] || VELCRO[0];
    const style = Math.round(p.style || 0); // 0 full velcro, 1 strips per spot, 2 screws, 3 messy screws, 4 blank
    const ff = materialFill(specs.frame);
    softShadow(g, { w, h, rx: 14, blur: 14, opacity: ff.translucent ? 0.3 : 0.6, dy: 14 });
    // frame
    svg('rect', { width: w, height: h, rx: 14, fill: ff.translucent ? 'rgba(255,255,255,0.08)' : ff.edge }, g);
    paint(g, 'rect', { x: 2, y: 2, width: w - 4, height: h - 4, rx: 12 }, specs.frame, { edge: false, glowWidth: 10 });
    svg('rect', { x: 1.2, y: 1.2, width: w - 2.4, height: h - 2.4, rx: 13, fill: 'none', stroke: ff.hi, 'stroke-width': 1.2, 'stroke-opacity': 0.7 }, g);
    svg('rect', { x: 3, y: 3, width: w - 6, height: 3, rx: 1.5, fill: '#fff', opacity: 0.22 }, g);
    // open deck between the rails
    const ix = S.padX - 12, iy = S.padY - 10;
    svg('rect', { x: ix, y: iy, width: w - ix * 2, height: h - iy * 2, rx: 6, fill: '#08090b', opacity: ff.translucent ? 0.55 : 1 }, g);
    svg('rect', { x: ix, y: iy, width: w - ix * 2, height: 6, rx: 3, fill: '#000', opacity: 0.6 }, g);
    // rails: two per row of pedals (a regular pedal stands across both), each with a velcro strip
    const nr = rows * 2, rh = (h - iy * 2 - 8) / nr;
    const rf = materialFill(specs.rail);
    let si = 0;
    for (let i = 0; i < nr; i++) {
      const y = iy + 4 + i * rh;
      const rail = svg('g', {}, g);
      // slat with open gaps between them, like an aluminium rail board
      const sh = rh * 0.64, sy = y + (rh - sh) / 2;
      svg('rect', { x: ix - 2, y: sy + 3, width: w - ix * 2 + 4, height: sh, rx: 3, fill: '#000', opacity: rf.translucent ? 0.25 : 0.5 }, rail);
      paint(rail, 'rect', { x: ix - 2, y: sy, width: w - ix * 2 + 4, height: sh, rx: 3 }, specs.rail, { edgeWidth: 0.6, glowWidth: 5 });
      svg('rect', { x: ix - 2, y: sy, width: w - ix * 2 + 4, height: 1.6, fill: '#fff', opacity: 0.3 }, rail);
      const rw = w - ix * 2 + 4, my = sh * 0.09;
      if (style === 0) {
        // full velcro: 4% bare rail at the ends, 9% above and below
        const mx = rw * 0.04;
        svg('rect', { x: ix - 2 + mx, y: sy + my, width: rw - mx * 2, height: sh - my * 2, rx: 2, fill: vel.fill, stroke: vel.edge, 'stroke-width': 0.8 }, rail);
      } else if (style === 1) {
        // one strip per pedal spot
        const mx = S.w * 0.04;
        for (let c = 0; c < cols; c++) svg('rect', { x: S.padX + c * S.w + mx, y: sy + my, width: S.w - mx * 2, height: sh - my * 2, rx: 2, fill: vel.fill, stroke: vel.edge, 'stroke-width': 0.8 }, rail);
      } else if (style === 2 || style === 3) {
        // no velcro: two screws per spot on each rail, four per pedal. Messy: crooked crosses, a few stripped.
        for (let c = 0; c < cols; c++)
          for (const fx of [0.22, 0.78]) {
            const o = {};
            if (style === 3) {
              const rnd = seeded(seed, si);
              o.rot = rnd() * 90;
              o.stripped = rnd() < 0.22;
              o.rnd = rnd;
            }
            si++;
            screw(rail, S.padX + c * S.w + S.w * fx, sy + sh / 2, Math.min(5.5, sh * 0.16), specs.screw, o);
          }
      }
      // style 4: blank rails
    }
    // side caps over the rail ends, with screws (grain runs along the cap)
    for (const x of [2, w - S.padX + 10]) {
      paint(g, 'rect', { x, y: 2, width: S.padX - 12, height: h - 4, rx: 10 }, specs.frame, { angle: 90, edgeWidth: 0.8, glowWidth: 6 });
      for (let r = 0; r < nr; r++) {
        const cy = iy + 4 + r * rh + rh / 2 - 1, cx = x + (S.padX - 12) / 2;
        screw(g, cx, cy, 3.2, specs.screw, style === 3 ? { rot: seeded(seed, 1000 + r + (x > 2 ? 50 : 0))() * 90 } : {});
      }
    }
    // the board's name sits above the frame
    const name = (p.name || def.name).toUpperCase();
    let light = false;
    try { light = luminance(ff.base) > 0.45; } catch (_) { /* keep dark */ }
    label(g, w / 2, -12, name, { size: 15, weight: 800, fill: '#d8dce4', ls: 1.6, font: "'Barlow Condensed', sans-serif" });
    label(g, w - 50, h - 8, 'TONE ZONE', { size: 6, weight: 700, fill: light ? '#333' : '#aab', opacity: 0.5, ls: 1.4 });
    const slots = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) slots.push({ x: S.padX + c * S.w, y: S.padY + r * S.h });
    return { w, h, theme: { text: '#ccc', jackLabels: false }, jacks: [], slots };
  });
}
