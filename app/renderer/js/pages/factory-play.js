// Pedal Factory test mode: the design runs in the engine as a hidden block between the board's input and
// output (state.js graph override), and its controls on the factory stage can be played.
import { state, setGraphOverride, buildGraph, engineParamsFor, nodePorts, ctlDefault } from '../state.js';
import { registerTestDef, unregisterTestDef, TEST_ID } from '../catalog/custom.js';
import { renderPedal } from './factory-render.js';
import { clamp } from '../util.js';

export const NODE = 'fztest';
let T = null;
let lastStatus = 0;
let hooked = false;

function hookStatus() {
  if (hooked || !window.tz || !window.tz.engine) return;
  hooked = true;
  window.tz.engine.onEvent((ev) => {
    if (ev.ev === 'status') lastStatus = Date.now();
  });
}
export const engineRunning = () => Date.now() - lastStatus < 2000;
export const testing = () => !!T;
export const testInfo = () => (T ? { graphs: T.graphs.slice(), params: { ...T.block.params }, bypass: T.block.bypass, def: T.def.id } : null);
const chainKey = (d) => JSON.stringify([d.opts, d.ports, d.jackKinds]);

function graph() {
  const io = (id) => JSON.parse(JSON.stringify(state.preset.blocks.find((b) => b.id === id) || { id, type: id, params: {} }));
  const pin = io('__in'), pout = io('__out');
  const ports = nodePorts(T.block);
  const cables = [];
  for (let i = 0; i < Math.min(2, ports.ins.length); i++) cables.push({ from: { node: '__in', port: i }, to: { node: NODE, port: i } });
  const outs = Math.min(2, ports.outs.length);
  for (let i = 0; i < outs; i++) cables.push({ from: { node: NODE, port: i }, to: { node: '__out', port: i } });
  const g = buildGraph({ blocks: [pin, pout, T.block], cables });
  T.sent = engineParamsFor(T.block);
  T.graphs.push(g);
  if (T.graphs.length > 20) T.graphs.shift();
  return g;
}
function sendParams() {
  const now = engineParamsFor(T.block);
  const diff = {};
  let any = false;
  for (const k in now)
    if (T.sent[k] !== now[k]) {
      diff[k] = now[k];
      any = true;
    }
  if (any) window.tz.engine.send({ cmd: 'params', id: NODE, values: diff });
  T.sent = now;
}

/** Start playing design d. */
export function startTest(d) {
  hookStatus();
  const def = registerTestDef(d);
  const params = {};
  for (const c of def.controls) if (c.p) params[c.p] = ctlDefault(c);
  T = { def, key: chainKey(def), block: { id: NODE, type: TEST_ID, params, bypass: false, variant: 'mono' }, sent: {}, graphs: [], views: null };
  setGraphOverride(graph);
}
/** The design changed while testing: new circuit means a new graph, otherwise just the params. */
export function updateTest(d) {
  if (!T) return;
  const def = registerTestDef(d);
  for (const c of def.controls) if (c.p && T.block.params[c.p] === undefined) T.block.params[c.p] = ctlDefault(c);
  T.def = def;
  const key = chainKey(def);
  if (key !== T.key) {
    T.key = key;
    setGraphOverride(graph);
  } else sendParams();
}
export function stopTest() {
  if (!T) return;
  T = null;
  setGraphOverride(null);
  unregisterTestDef();
}
// values the player set, written back into the design as its defaults
export function testValues() {
  return T ? { ...T.block.params } : {};
}

// ------------------------------------------------------------------ the playable pedal
export function renderPlay(g, d) {
  if (!T) return;
  const views = new Map();
  renderPedal(g, d, { views, ctlDefs: new Map(T.def.controls.map((c) => [c.cid, c])) });
  T.views = views;
  updateViews();
}
function ledOn(c, now) {
  const b = T.block;
  const bind = c.bind || 'on';
  if (bind === 'on') return !b.bypass;
  if (bind === 'fn') return c.ledFn ? !!c.ledFn(b.params, b) : false;
  if (bind.startsWith('tap:')) {
    if (b.bypass) return false;
    const msv = engineParamsFor(b)[bind.slice(4)] || 400;
    return now % msv < Math.min(70, msv * 0.4);
  }
  return false;
}
export function updateViews(now = performance.now()) {
  if (!T || !T.views) return;
  const P = T.block.params;
  for (const [, { ctl: c, view }] of T.views) {
    const v = P[c.p] ?? ctlDefault(c);
    if (!view || !view.set) continue;
    if (c.t === 'knob' || c.t === 'slider' || c.t === 'treadle') view.set(clamp(v, 0, 1));
    else if (c.t === 'toggle' || c.t === 'sel') view.set(v | 0);
    else if (c.t === 'button' && c.toggle) view.set(!!v);
    else if (c.t === 'led') view.set(ledOn(c, now) ? true : null);
  }
}
function setP(p, v) {
  T.block.params[p] = v;
  sendParams();
  updateViews();
}

/** Pointer down on the stage in test mode. Returns true when a control took it. */
export function playDown(e, stage, zoom, onChange) {
  if (!T || !T.views) return false;
  const ctlEl = e.target.closest('[data-ctl]');
  const entry = ctlEl && T.views.get(ctlEl.dataset.ctl);
  if (!entry) return false;
  const c = entry.ctl, view = entry.view;
  const P = T.block.params;
  const sx = e.clientX, sy = e.clientY;
  let moved = false;
  const start = P[c.p] ?? ctlDefault(c);
  stage.setPointerCapture(e.pointerId);
  if (c.t === 'foot' || c.t === 'button') view.press && view.press(true);
  if (c.t === 'foot') {
    if (c.action === 'bypass') {
      T.block.bypass = !T.block.bypass;
      window.tz.engine.send({ cmd: 'bypass', id: NODE, on: T.block.bypass });
      updateViews();
    } else if (c.action === 'toggle') setP(c.p, (P[c.p] ?? c.def ?? 0) > 0.5 ? 0 : 1);
    else if (c.action === 'tap') window.tz.engine.send({ cmd: 'event', id: NODE, type: 1, value: 0, arg: (c.tapSub ?? 0) * 100 });
  }
  const mv = (ev) => {
    const dx = ev.clientX - sx, dy = ev.clientY - sy;
    if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
    const fine = ev.shiftKey ? 0.2 : 1;
    if (c.t === 'knob' || c.t === 'slider' || c.t === 'treadle') {
      const range = c.t === 'slider' ? ((c.h || 48) / 2) * zoom() * 1.6 : c.t === 'treadle' ? ((c.h || 120) / 2) * zoom() * 0.7 : 170;
      const d = c.t === 'slider' && c.orient === 'h' ? -dx : dy;
      setP(c.p, clamp(start - (d / range) * fine, 0, 1));
      onChange && onChange();
    } else if (c.t === 'sel') {
      const idx = clamp(Math.round(start - dy / 16), 0, c.options.length - 1);
      if (idx !== P[c.p]) setP(c.p, idx);
    }
  };
  const up = (ev) => {
    stage.removeEventListener('pointermove', mv);
    stage.removeEventListener('pointerup', up);
    stage.removeEventListener('pointercancel', up);
    if (c.t === 'foot' || c.t === 'button') view.press && view.press(false);
    if (!moved) {
      if (c.t === 'toggle') setP(c.p, ((P[c.p] ?? c.def ?? 0) + 1) % c.options.length);
      else if (c.t === 'sel') setP(c.p, ((P[c.p] ?? c.def ?? 0) + (ev.shiftKey ? c.options.length - 1 : 1)) % c.options.length);
      else if (c.t === 'button') {
        if (c.toggle && c.p) setP(c.p, P[c.p] ? 0 : 1);
        else if (c.event) window.tz.engine.send({ cmd: 'event', id: NODE, type: c.event.type, value: c.event.value ?? 0, arg: c.event.arg | 0 });
      }
    }
    onChange && onChange();
  };
  stage.addEventListener('pointermove', mv);
  stage.addEventListener('pointerup', up);
  stage.addEventListener('pointercancel', up);
  return true;
}
/** Set a control from code (tests, wheel): pos 0..1 for knobs, index for switches. */
export function playSet(cid, v) {
  if (!T) return false;
  const c = T.def.controls.find((x) => x.cid === cid);
  if (!c || !c.p) return false;
  setP(c.p, v);
  return true;
}
