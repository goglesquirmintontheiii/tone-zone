// Board form for pedals made in the Pedal Factory: draws the saved design (millimetres, scaled up) with the
// factory renderer, so the block looks like the factory preview, and returns its jacks and control views.
import { svg } from '../util.js';
import { registerForm, hasForm } from './forms.js';
import { renderPedal, jackSpot, jackAngle, sideOf, shapePoints, boardKind, r1 } from '../pages/factory-render.js';
import { S, portJacks } from '../pages/factory-circuit.js';
import { attachBoardScreens } from '../screenscript/board.js';

function customForm(ctx, def) {
  const D = def.design;
  const W = D.enc.w, H = D.enc.h;
  const g = svg('g', { transform: `scale(${S})` }, ctx.g);
  const ctlDefs = new Map(def.controls.map((c) => [c.cid, c]));
  renderPedal(g, D, { board: true, views: ctx.views, ctlDefs });
  attachBoardScreens(ctx, D, S); // live custom screens (screenscript/board.js)
  const pts = shapePoints(D.enc.shape, W, H);
  // jacks on a slanted or curved edge (or turned by hand) carry their angle; side stays the nearest edge
  const at = (j) => {
    const p = jackSpot(pts, D, j);
    const a = jackAngle(p, j.edge);
    return a == null ? { x: r1(p.x * S), y: r1(p.y * S), side: j.edge } : { x: r1(p.x * S), y: r1(p.y * S), side: sideOf(a), angle: a };
  };
  const jacks = [];
  const { ins, outs } = portJacks(D);
  if (ins.length) ins.forEach((j, i) => jacks.push({ key: 'i' + i, dir: 'in', port: i, label: '', kind: boardKind(j.kind), ...at(j) }));
  else jacks.push({ key: 'i0', dir: 'in', port: 0, label: 'IN', side: 'right', x: W * S + 2, y: H * S * 0.3 });
  if (outs.length) outs.forEach((j, i) => jacks.push({ key: 'o' + i, dir: 'out', port: i, label: '', kind: boardKind(j.kind), ...at(j) }));
  else jacks.push({ key: 'o0', dir: 'out', port: 0, label: 'OUT', side: 'left', x: -2, y: H * S * 0.3 });
  (def.ctrl?.ins || []).forEach((c, i) => {
    const j = D.jacks.find((x) => x.id === c._jack);
    if (j) jacks.push({ key: 'ic' + i, dir: 'in', port: 'c' + i, label: '', kind: 'ctrl', ...at(j) });
  });
  // EXP / footswitch jacks driven by a circuit output (factory-circuit.js def.ctrl.outs)
  (def.ctrl?.outs || []).forEach((c, i) => {
    const j = D.jacks.find((x) => x.id === c._jack);
    if (j) jacks.push({ key: 'oc' + i, dir: 'out', port: 'c' + i, label: '', kind: 'ctrl', ...at(j) });
  });
  return { w: W * S, h: H * S, theme: { text: D.labels.color, jackLabels: false }, jacks };
}

export function installCustomForm() {
  if (!hasForm('custom')) registerForm('custom', customForm);
}
