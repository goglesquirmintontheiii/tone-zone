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
  const { f } = paint(g, 'circle', { cx, cy, r }, spec, { scale: 0.12, round: true, edgeWidth: 0.5, glowWidth: 2.5, wear: false });
  svg('circle', { cx: cx - r * 0.3, cy: cy - r * 0.3, r: r * 0.36, fill: '#fff', opacity: f && f.translucent ? 0.2 : 0.3 }, g);
  const k = r * 0.55, sw = Math.max(0.8, r * 0.22);
  const slot = (f && f.edge) || '#222';
  const t = `rotate(${(o.rot || 0).toFixed(1)} ${cx} ${cy})`;
  // a faint light bevel under the slot keeps it readable on dark heads
  const bevel = `translate(${(sw * 0.3).toFixed(2)} ${(sw * 0.3).toFixed(2)}) ` + t;
  svg('path', { d: `M${cx - k} ${cy}H${cx + k}M${cx} ${cy - k}V${cy + k}`, stroke: '#fff', 'stroke-opacity': 0.28, 'stroke-width': sw, 'stroke-linecap': 'round', transform: bevel }, g);
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
    const rowCols = def.pedalboard.rowCols || Array(rows).fill(cols);
    const S = BOARD_SLOT;
    const w = cols * S.w + S.padX * 2, h = rows * S.h + S.padY * 2;
    const rowX = (r) => S.padX + ((cols - rowCols[r]) * S.w) / 2; // shorter rows are centred
    const specs = boardSpecs(p);
    const vel = VELCRO[Math.round(p.velcro || 0)] || VELCRO[0];
    let style = Math.round(p.style || 0); // 0 full velcro, 1 strips per spot, 2 screws, 3 messy screws, 4 blank
    const glass = specs.frame.m === 'glass';
    if (glass && (style === 2 || style === 3)) style = 4; // you can't screw into glass
    const ff = materialFill(specs.frame);
    const box = { x: 0, y: 0, w, h }; // multicolour fades and bursts span the whole board
    const ix = S.padX - 12, iy = S.padY - 10;
    // the frame is one piece: an outer rounded rectangle with the deck opening cut out of it
    const ring = `M14 0H${w - 14}A14 14 0 0 1 ${w} 14V${h - 14}A14 14 0 0 1 ${w - 14} ${h}H14A14 14 0 0 1 0 ${h - 14}V14A14 14 0 0 1 14 0Z` +
      `M${ix + 6} ${iy}H${w - ix - 6}A6 6 0 0 1 ${w - ix} ${iy + 6}V${h - iy - 6}A6 6 0 0 1 ${w - ix - 6} ${h - iy}H${ix + 6}A6 6 0 0 1 ${ix} ${h - iy - 6}V${iy + 6}A6 6 0 0 1 ${ix + 6} ${iy}Z`;
    softShadow(g, { w, h, rx: 14, blur: 14, opacity: ff.translucent ? 0.25 : 0.6, dy: 14 });
    // invisible, but catches clicks anywhere on the board (the gaps between rails on see-through boards too)
    svg('rect', { width: w, height: h, rx: 14, fill: 'transparent' }, g);
    // opaque boards: the floor under the deck is in shadow. See-through boards leave it empty.
    if (!ff.translucent) svg('rect', { x: ix, y: iy, width: w - ix * 2, height: h - iy * 2, rx: 6, fill: '#08090b' }, g);
    // rails: two per row of pedals (a regular pedal stands across both), each with a velcro strip
    const nr = rows * 2, rh = (h - iy * 2 - 8) / nr;
    const frameLayer = () => {
      paint(g, 'path', { d: ring, 'fill-rule': 'evenodd' }, specs.frame, { edge: false, glowWidth: 10, seed: seed + 'f', box, size: 40 });
      svg('path', { d: ring, 'fill-rule': 'evenodd', fill: 'none', stroke: ff.hi, 'stroke-width': 1.2, 'stroke-opacity': 0.6 }, g);
      svg('rect', { x: 3, y: 3, width: w - 6, height: 3, rx: 1.5, fill: '#fff', opacity: ff.translucent ? 0.35 : 0.22 }, g);
      // inner lip shadow at the top of the opening
      if (!ff.translucent) svg('rect', { x: ix, y: iy, width: w - ix * 2, height: 5, fill: '#000', opacity: 0.45 }, g);
    };
    const rf = materialFill(specs.rail);
    let si = 0;
    for (let i = 0; i < nr; i++) {
      const y = iy + 4 + i * rh;
      const rail = svg('g', {}, g);
      // slat with open gaps between them, like an aluminium rail board
      const sh = rh * 0.64, sy = y + (rh - sh) / 2;
      svg('rect', { x: ix - 2, y: sy + 3, width: w - ix * 2 + 4, height: sh, rx: 3, fill: '#000', opacity: rf.translucent ? 0.25 : 0.5 }, rail);
      paint(rail, 'rect', { x: ix - 2, y: sy, width: w - ix * 2 + 4, height: sh, rx: 3 }, specs.rail, { edgeWidth: 0.6, glowWidth: 5, seed: seed + 'r' + i, box });
      svg('rect', { x: ix - 2, y: sy, width: w - ix * 2 + 4, height: 1.6, fill: '#fff', opacity: 0.3 }, rail);
      const rw = w - ix * 2 + 4, my = sh * 0.09;
      if (style === 0) {
        // full velcro: 4% bare rail at the ends, 9% above and below
        const mx = rw * 0.04;
        svg('rect', { x: ix - 2 + mx, y: sy + my, width: rw - mx * 2, height: sh - my * 2, rx: 2, fill: vel.fill, stroke: vel.edge, 'stroke-width': 0.8 }, rail);
      } else if (style === 1) {
        // one strip per pedal spot
        const mx = S.w * 0.04;
        const r = Math.floor(i / 2);
        for (let c = 0; c < rowCols[r]; c++) svg('rect', { x: rowX(r) + c * S.w + mx, y: sy + my, width: S.w - mx * 2, height: sh - my * 2, rx: 2, fill: vel.fill, stroke: vel.edge, 'stroke-width': 0.8 }, rail);
      } else if (style === 2 || style === 3) {
        // no velcro: two screws per spot on each rail, four per pedal. Messy: crooked crosses, a few stripped.
        const r = Math.floor(i / 2);
        for (let c = 0; c < rowCols[r]; c++)
          for (const fx of [0.22, 0.78]) {
            const o = {};
            if (style === 3) {
              const rnd = seeded(seed, si);
              o.rot = rnd() * 90;
              o.stripped = rnd() < 0.22;
              o.rnd = rnd;
            }
            si++;
            screw(rail, rowX(r) + c * S.w + S.w * fx, sy + sh / 2, Math.min(5.5, sh * 0.16), specs.screw, o);
          }
      }
      // style 4: blank rails
    }
    // the frame goes over the rail ends, then the screws that hold the rails (none on glass)
    frameLayer();
    for (const x of glass ? [] : [2, w - S.padX + 10]) {
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
    for (let r = 0; r < rows; r++) for (let c = 0; c < rowCols[r]; c++) slots.push({ x: rowX(r) + c * S.w, y: S.padY + r * S.h, r, c });
    return { w, h, theme: { text: '#ccc', jackLabels: false }, jacks: [], slots };
  });
}
