// Pedalboard: brushed metal frame (recolourable) with rails covered in velcro, plus the board's name above it.
import { svg, shade, luminance } from '../util.js';
import { softShadow } from './fx.js';
import { label } from './controls.js';
import { BOARD_SLOT } from '../catalog/pedalboards.js';

const VELCRO = [
  { fill: 'url(#p-velcro-black)', edge: '#050506' },
  { fill: 'url(#p-velcro-white)', edge: '#b9b6ae' },
  { fill: 'url(#p-velcro-clear)', edge: 'rgba(255,255,255,0.35)' },
];

export function installBoardForms(registerForm) {
  registerForm('pedalboard', (ctx, def) => {
    const g = ctx.g;
    const p = (ctx.block && ctx.block.params) || {};
    const { cols, rows } = def.pedalboard;
    const S = BOARD_SLOT;
    const w = cols * S.w + S.padX * 2, h = rows * S.h + S.padY * 2;
    const frame = p.jacket || '#1d1e22';
    const vel = VELCRO[Math.round(p.velcro || 0)] || VELCRO[0];
    softShadow(g, { w, h, rx: 14, blur: 14, opacity: 0.6, dy: 14 });
    // frame
    svg('rect', { width: w, height: h, rx: 14, fill: shade(frame, -0.35) }, g);
    svg('rect', { x: 2, y: 2, width: w - 4, height: h - 4, rx: 12, fill: frame }, g);
    svg('rect', { x: 2, y: 2, width: w - 4, height: h - 4, rx: 12, fill: 'url(#p-brushed)' }, g);
    svg('rect', { x: 2, y: 2, width: w - 4, height: h - 4, rx: 12, fill: 'url(#g-boardSheen)' }, g);
    svg('rect', { x: 1.2, y: 1.2, width: w - 2.4, height: h - 2.4, rx: 13, fill: 'none', stroke: shade(frame, 0.45), 'stroke-width': 1.2, 'stroke-opacity': 0.7 }, g);
    svg('rect', { x: 3, y: 3, width: w - 6, height: 3, rx: 1.5, fill: '#fff', opacity: 0.22 }, g);
    // open deck between the rails
    const ix = S.padX - 12, iy = S.padY - 10;
    svg('rect', { x: ix, y: iy, width: w - ix * 2, height: h - iy * 2, rx: 6, fill: '#08090b' }, g);
    svg('rect', { x: ix, y: iy, width: w - ix * 2, height: 6, rx: 3, fill: '#000', opacity: 0.6 }, g);
    // rails: three per row of pedals, each covered with a velcro strip
    const nr = rows * 3, rh = (h - iy * 2 - 8) / nr;
    for (let i = 0; i < nr; i++) {
      const y = iy + 4 + i * rh;
      const rail = svg('g', {}, g);
      // slat with open gaps between them, like an aluminium rail board
      const sh = rh * 0.6, sy = y + (rh - sh) / 2;
      svg('rect', { x: ix - 2, y: sy + 3, width: w - ix * 2 + 4, height: sh, rx: 3, fill: '#000', opacity: 0.5 }, rail);
      svg('rect', { x: ix - 2, y: sy, width: w - ix * 2 + 4, height: sh, rx: 3, fill: shade(frame, 0.08) }, rail);
      svg('rect', { x: ix - 2, y: sy, width: w - ix * 2 + 4, height: sh, rx: 3, fill: 'url(#p-brushed)' }, rail);
      svg('rect', { x: ix - 2, y: sy, width: w - ix * 2 + 4, height: 1.6, fill: '#fff', opacity: 0.3 }, rail);
      svg('rect', { x: ix + 6, y: sy + 3, width: w - ix * 2 - 12, height: sh - 7, rx: 2, fill: vel.fill, stroke: vel.edge, 'stroke-width': 0.8 }, rail);
    }
    // side caps over the rail ends, with screws
    for (const x of [2, w - S.padX + 10]) {
      svg('rect', { x, y: 2, width: S.padX - 12, height: h - 4, rx: 10, fill: frame }, g);
      svg('rect', { x, y: 2, width: S.padX - 12, height: h - 4, rx: 10, fill: 'url(#p-brushed)' }, g);
      svg('rect', { x: x + 1, y: 4, width: S.padX - 14, height: h - 8, rx: 9, fill: 'url(#g-boardSheen)' }, g);
      for (let r = 0; r < nr; r++) {
        const cy = iy + 4 + r * rh + rh / 2 - 1, cx = x + (S.padX - 12) / 2;
        svg('circle', { cx, cy, r: 3.2, fill: 'url(#g-chromeR)', stroke: '#222', 'stroke-width': 0.5 }, g);
        svg('path', { d: `M${cx - 1.8} ${cy}H${cx + 1.8}`, stroke: '#333', 'stroke-width': 0.8 }, g);
      }
    }
    // the board's name sits above the frame
    const name = (p.name || def.name).toUpperCase();
    const light = luminance(frame) > 0.45;
    label(g, w / 2, -12, name, { size: 15, weight: 800, fill: '#d8dce4', ls: 1.6, font: "'Barlow Condensed', sans-serif" });
    label(g, w - 50, h - 8, 'TONE ZONE', { size: 6, weight: 700, fill: light ? '#333' : '#aab', opacity: 0.5, ls: 1.4 });
    const slots = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) slots.push({ x: S.padX + c * S.w, y: S.padY + r * S.h });
    return { w, h, theme: { text: '#ccc', jackLabels: false }, jacks: [], slots };
  });
}
