// Shared SVG <defs>: gradients, patterns and filters used by every pedal / amp / cab graphic.
import { svg } from '../util.js';

let installed = false;

function lin(defs, id, stops, x1 = 0, y1 = 0, x2 = 0, y2 = 1, extra = {}) {
  const g = svg('linearGradient', Object.assign({ id, x1, y1, x2, y2 }, extra), defs);
  for (const [o, c, a = 1] of stops) svg('stop', { offset: o, 'stop-color': c, 'stop-opacity': a }, g);
  return g;
}
function rad(defs, id, stops, cx = 0.5, cy = 0.5, r = 0.5, fx, fy) {
  const g = svg('radialGradient', { id, cx, cy, r, fx: fx ?? cx, fy: fy ?? cy }, defs);
  for (const [o, c, a = 1] of stops) svg('stop', { offset: o, 'stop-color': c, 'stop-opacity': a }, g);
  return g;
}

export function installDefs(defs) {
  if (installed && defs.childNodes.length) return;
  installed = true;
  // ---- shading overlays
  lin(defs, 'g-shadeV', [[0, '#fff', 0.28], [0.12, '#fff', 0.1], [0.45, '#fff', 0], [0.85, '#000', 0.14], [1, '#000', 0.32]]);
  lin(defs, 'g-shadeH', [[0, '#000', 0.22], [0.08, '#000', 0], [0.92, '#000', 0], [1, '#000', 0.28]], 0, 0, 1, 0);
  lin(defs, 'g-gloss', [[0, '#fff', 0.35], [0.5, '#fff', 0.05], [0.51, '#fff', 0], [1, '#fff', 0]]);
  lin(defs, 'g-edgeTop', [[0, '#fff', 0.5], [1, '#fff', 0]]);
  // ---- knobs
  rad(defs, 'g-knobBlack', [[0, '#5b5d62'], [0.35, '#2a2b2f'], [0.8, '#111214'], [1, '#050506']], 0.4, 0.3, 0.75);
  rad(defs, 'g-knobCap', [[0, '#6c6f75'], [0.5, '#2d2f33'], [1, '#141517']], 0.38, 0.28, 0.8);
  lin(defs, 'g-knobSkirt', [[0, '#3a3b3f'], [0.5, '#141518'], [1, '#050506']]);
  lin(defs, 'g-chrome', [[0, '#f4f6f8'], [0.18, '#a7adb5'], [0.4, '#eef1f4'], [0.62, '#7d848d'], [0.82, '#d6dbe0'], [1, '#6b727a']], 0, 0, 1, 1);
  rad(defs, 'g-chromeR', [[0, '#ffffff'], [0.35, '#cfd4da'], [0.7, '#8c939b'], [0.9, '#d9dee3'], [1, '#5f666e']], 0.38, 0.32, 0.7);
  rad(defs, 'g-chromeDome', [[0, '#ffffff'], [0.4, '#c4cad1'], [0.75, '#737a83'], [1, '#2e3238']], 0.35, 0.3, 0.75);
  rad(defs, 'g-gold', [[0, '#fff2c0'], [0.4, '#d9b45a'], [0.8, '#8a6a23'], [1, '#4d3a10']], 0.38, 0.3, 0.75);
  rad(defs, 'g-cream', [[0, '#fffaf0'], [0.5, '#e8dcc0'], [1, '#a89676']], 0.38, 0.3, 0.8);
  rad(defs, 'g-whiteKnob', [[0, '#ffffff'], [0.6, '#dfe2e6'], [1, '#9aa0a8']], 0.38, 0.3, 0.8);
  rad(defs, 'g-redKnob', [[0, '#ff8a80'], [0.5, '#d22a22'], [1, '#6e0e0a']], 0.38, 0.3, 0.8);
  // ---- rubber / pads
  lin(defs, 'g-rubber', [[0, '#3b3d42'], [0.5, '#232428'], [1, '#141518']]);
  lin(defs, 'g-rubberLight', [[0, '#55575d'], [1, '#26272b']]);
  const pad = svg('pattern', { id: 'p-pad', width: 6, height: 6, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, defs);
  svg('rect', { width: 6, height: 6, fill: '#1e1f23' }, pad);
  svg('rect', { width: 3, height: 6, fill: '#2b2c31' }, pad);
  const ridges = svg('pattern', { id: 'p-ridges', width: 4, height: 4, patternUnits: 'userSpaceOnUse' }, defs);
  svg('rect', { width: 4, height: 4, fill: 'transparent' }, ridges);
  svg('rect', { width: 4, height: 1.3, fill: 'rgba(0,0,0,0.18)' }, ridges);
  // ---- brushed metal
  const br = svg('pattern', { id: 'p-brushed', width: 200, height: 6, patternUnits: 'userSpaceOnUse' }, defs);
  for (let i = 0; i < 6; i++) svg('rect', { y: i, width: 200, height: 1, fill: i % 2 ? '#fff' : '#000', opacity: [0.04, 0.03, 0.06, 0.02, 0.05, 0.03][i] }, br);
  // ---- grille cloths
  const grille = (id, base, a, b) => {
    const p = svg('pattern', { id, width: 6, height: 6, patternUnits: 'userSpaceOnUse' }, defs);
    svg('rect', { width: 6, height: 6, fill: base }, p);
    svg('path', { d: 'M0 6L6 0M-1 1L1 -1M5 7L7 5', stroke: a, 'stroke-width': 1.4 }, p);
    svg('path', { d: 'M0 0L6 6', stroke: b, 'stroke-width': 0.8, opacity: 0.6 }, p);
  };
  grille('p-grille-black', '#141414', '#2a2a2a', '#090909');
  grille('p-grille-wheat', '#b9a27a', '#d8c59d', '#7c6a4a');
  grille('p-grille-silver', '#7b7f86', '#a9adb3', '#4c5056');
  grille('p-grille-oxblood', '#4a1414', '#6e2222', '#2a0808');
  grille('p-grille-brown', '#5a3b23', '#7b5636', '#3a2414');
  grille('p-grille-diamond', '#2a1f18', '#4b3a2b', '#1a120c');
  const salt = svg('pattern', { id: 'p-grille-salt', width: 4, height: 4, patternUnits: 'userSpaceOnUse' }, defs);
  svg('rect', { width: 4, height: 4, fill: '#2e2e2e' }, salt);
  svg('circle', { cx: 1, cy: 1, r: 0.7, fill: '#9a9a9a' }, salt);
  svg('circle', { cx: 3, cy: 3, r: 0.6, fill: '#4c4c4c' }, salt);
  // speaker cone hint
  rad(defs, 'g-cone', [[0, '#000', 0.0], [0.55, '#000', 0.05], [0.8, '#000', 0.22], [0.92, '#fff', 0.05], [1, '#000', 0.25]]);
  // ---- tolex
  const tol = svg('filter', { id: 'f-tolex', x: 0, y: 0, width: '100%', height: '100%' }, defs);
  svg('feTurbulence', { type: 'fractalNoise', baseFrequency: '1.2', numOctaves: 2, seed: 4, result: 'n' }, tol);
  svg('feColorMatrix', { in: 'n', type: 'matrix', values: '0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.55 0', result: 'a' }, tol);
  svg('feComposite', { in: 'a', in2: 'SourceGraphic', operator: 'in', result: 'c' }, tol);
  const m = svg('feMerge', {}, tol);
  svg('feMergeNode', { in: 'SourceGraphic' }, m);
  svg('feMergeNode', { in: 'c' }, m);
  // powder-coat grain overlay
  const grain = svg('filter', { id: 'f-grain', x: 0, y: 0, width: '100%', height: '100%' }, defs);
  svg('feTurbulence', { type: 'fractalNoise', baseFrequency: '2.2', numOctaves: 1, seed: 9, result: 'n' }, grain);
  svg('feColorMatrix', { in: 'n', type: 'matrix', values: '0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.09 0', result: 'w' }, grain);
  svg('feComposite', { in: 'w', in2: 'SourceAlpha', operator: 'in' }, grain);
  // ---- screens
  lin(defs, 'g-screen', [[0, '#0d1416'], [1, '#050809']]);
  lin(defs, 'g-glass', [[0, '#fff', 0.14], [0.4, '#fff', 0.03], [0.41, '#fff', 0], [1, '#fff', 0]], 0, 0, 1, 1);
  lin(defs, 'g-lcdAmber', [[0, '#3a2a06'], [1, '#1c1403']]);
  // ---- jacks
  rad(defs, 'g-nut', [[0, '#f0f2f5'], [0.6, '#9aa1a9'], [1, '#50565d']], 0.35, 0.3, 0.8);
  rad(defs, 'g-hole', [[0, '#000'], [0.7, '#0b0b0c'], [1, '#2d2f33']]);
  // ---- LEDs
  rad(defs, 'g-ledLens', [[0, '#fff', 0.85], [0.35, '#fff', 0.15], [1, '#fff', 0]], 0.35, 0.3, 0.6);
  const glow = svg('filter', { id: 'f-glow', x: '-150%', y: '-150%', width: '400%', height: '400%' }, defs);
  svg('feGaussianBlur', { stdDeviation: 3.2, result: 'b' }, glow);
  const gm = svg('feMerge', {}, glow);
  svg('feMergeNode', { in: 'b' }, gm);
  svg('feMergeNode', { in: 'b' }, gm);
  svg('feMergeNode', { in: 'SourceGraphic' }, gm);
  const glowS = svg('filter', { id: 'f-glowSoft', x: '-50%', y: '-50%', width: '200%', height: '200%' }, defs);
  svg('feGaussianBlur', { stdDeviation: 1.6, result: 'b' }, glowS);
  const gm2 = svg('feMerge', {}, glowS);
  svg('feMergeNode', { in: 'b' }, gm2);
  svg('feMergeNode', { in: 'SourceGraphic' }, gm2);
  // ---- shadows
  const sh = svg('filter', { id: 'f-node', x: '-20%', y: '-20%', width: '150%', height: '150%' }, defs);
  svg('feDropShadow', { dx: 0, dy: 10, stdDeviation: 9, 'flood-color': '#000', 'flood-opacity': 0.55 }, sh);
  const shs = svg('filter', { id: 'f-small', x: '-50%', y: '-50%', width: '200%', height: '200%' }, defs);
  svg('feDropShadow', { dx: 0, dy: 1.6, stdDeviation: 1.4, 'flood-color': '#000', 'flood-opacity': 0.6 }, shs);
  const csh = svg('filter', { id: 'f-cableShadow', x: '-20%', y: '-20%', width: '140%', height: '140%' }, defs);
  svg('feGaussianBlur', { stdDeviation: 4 }, csh);
  const inner = svg('filter', { id: 'f-inner', x: 0, y: 0, width: '100%', height: '100%' }, defs);
  svg('feOffset', { dx: 0, dy: 2 }, inner);
  svg('feGaussianBlur', { stdDeviation: 2, result: 'o' }, inner);
  svg('feComposite', { in: 'SourceAlpha', in2: 'o', operator: 'out', result: 'i' }, inner);
  svg('feFlood', { 'flood-color': '#000', 'flood-opacity': 0.7 }, inner);
  svg('feComposite', { in2: 'i', operator: 'in', result: 's' }, inner);
  const im = svg('feMerge', {}, inner);
  svg('feMergeNode', { in: 'SourceGraphic' }, im);
  svg('feMergeNode', { in: 's' }, im);
  // engraved text
  const eng = svg('filter', { id: 'f-emboss', x: '-10%', y: '-10%', width: '120%', height: '120%' }, defs);
  svg('feDropShadow', { dx: 0, dy: 0.6, stdDeviation: 0.2, 'flood-color': '#fff', 'flood-opacity': 0.25 }, eng);
  // plug metal
  lin(defs, 'g-plugMetal', [[0, '#5d636b'], [0.25, '#e6eaee'], [0.5, '#9aa1a9'], [0.75, '#f3f5f7'], [1, '#596068']]);
  lin(defs, 'g-plugGold', [[0, '#6b5320'], [0.3, '#f6dd94'], [0.55, '#b48d3c'], [0.8, '#fbe6a5'], [1, '#6b5320']]);
}
