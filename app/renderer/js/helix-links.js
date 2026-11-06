// Control links on the board: drag a device's footswitch (or its expression pedal) onto another block's
// footswitch (or treadle / knob) to link them. Used by the Line 6 Helix device block, whose plugin supplies a
// `link` hook ({ source, list, add, remove }); the links are its MIDI bindings, so real hardware drives them too.
// This module only does the gesture, the overlays on linked controls and the remove menus.
import { svg, bus, toast } from './util.js';
import { state, commitNow } from './state.js';
import { hooksFor } from './plugins.js';
import { showMenu, closeMenu } from './menus.js';
import { getDef } from './catalog/index.js';

const DRAG_PX = 6; // pointer travel before a press becomes a link drag
const HOLD_MS = 350; // held still this long: it's a normal (long) press, not a link
const PEDAL_TARGETS = new Set(['treadle', 'knob', 'slider']);

let ed = null;
let pend = null; // pointer down on a link source, not decided yet
let drag = null; // link drag in progress
const drawn = new Map(); // view id -> { g, key }

const linkApi = (b) => (b && hooksFor(b.type)?.link) || null;
const blockName = (b) => (b && (b.name || getDef(b.type)?.name)) || 'block';
const ctlEl = (v, cid) => v && v.g.querySelector(`[data-ctl="${CSS.escape(cid)}"]`);
const ctlName = (c) => (c.t === 'foot' ? 'footswitch' : c.t === 'treadle' ? 'treadle' : c.label || c.p || 'knob');
const targetKind = (c) => (c.t === 'foot' ? 'foot' : PEDAL_TARGETS.has(c.t) && c.p ? 'pedal' : null);

// box of a control in another element's coordinates (world = the viewport group, local = a block's content)
function boxIn(el, ref) {
  if (!el || !ref) return null;
  let bb;
  try { bb = el.getBBox(); } catch { return null; }
  if (!bb || (!bb.width && !bb.height)) return null;
  const a = el.getCTM(), b = ref.getCTM();
  if (!a || !b) return null;
  const m = b.inverse().multiply(a);
  const p1 = new DOMPoint(bb.x, bb.y).matrixTransform(m), p2 = new DOMPoint(bb.x + bb.width, bb.y + bb.height).matrixTransform(m);
  return { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2, w: Math.abs(p2.x - p1.x), h: Math.abs(p2.y - p1.y) };
}

export function installHelixLinks(editor) {
  ed = editor;
  const board = ed.board;
  board.addEventListener('pointerdown', onDown, true);
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', () => cancel());
  board.addEventListener('contextmenu', onContext, true);
  const soon = () => setTimeout(() => refresh(), 30);
  for (const ev of ['preset:changed', 'block:added', 'links:changed', 'rebuildBoard', 'catalog']) bus.on(ev, soon);
  // re-attach after a block redraws itself (model change, rotation, a board shown again)
  setInterval(() => { if (hasLinks() || drawn.size) refresh(); }, 500);
  const st = document.createElement('style');
  st.textContent = `.hxl-ring{pointer-events:visibleStroke}.hxl-badge{cursor:context-menu}.hxl-badge text,.hxl-mark text{pointer-events:none;font-family:'Inter',sans-serif;font-weight:800}
#layerDrag .hxl-line{fill:none;stroke-linecap:round;pointer-events:none}#layerDrag .hxl-hot{pointer-events:none}#layerDrag .hxl-bad{fill:none;stroke:var(--bad);stroke-dasharray:4 3;pointer-events:none}`;
  document.head.appendChild(st);
}

function hasLinks() {
  if (!state.preset) return false;
  for (const b of state.preset.blocks) { const L = linkApi(b); if (L && (b.bindings || []).some((x) => x.target)) return true; }
  return false;
}

// ------------------------------------------------------------ gesture
function sourceAt(e) {
  if (e.button !== 0 || ed.spaceDown || e.shiftKey || e.ctrlKey || e.metaKey) return null;
  const t = e.target;
  const ce = t.closest && t.closest('[data-ctl]'), ne = t.closest && t.closest('[data-node]');
  if (!ce || !ne) return null;
  const v = ed.views.get(ne.dataset.node);
  const L = v && linkApi(v.block);
  const entry = L && v.views.get(ce.dataset.ctl);
  if (!entry) return null;
  const src = L.source(v, entry.ctl);
  return src ? { v, ctl: entry.ctl, src, L } : null;
}
function onDown(e) {
  const s = sourceAt(e);
  if (!s) return;
  // ours until we know whether this is a press or a link drag
  e.stopPropagation();
  closeMenu();
  ed.board.focus({ preventScroll: true });
  if (ed.drag) ed.onUp(e);
  pend = { ...s, down: e, sx: e.clientX, sy: e.clientY };
  // a footswitch held still is a normal press (tap hold, momentary)
  if (s.ctl.t === 'foot') pend.hold = setTimeout(() => handOver(), HOLD_MS);
}
// give the press to the editor as if it had got the pointerdown itself
function handOver() {
  const p = pend;
  if (!p) return;
  clearTimeout(p.hold);
  pend = null;
  ed.startControl(p.down, p.v.block.id, p.ctl.cid);
}
function onMove(e) {
  if (drag) return moveDrag(e);
  if (!pend) return;
  const dx = e.clientX - pend.sx, dy = e.clientY - pend.sy;
  if (Math.hypot(dx, dy) < DRAG_PX) return;
  // the EXP treadle still sweeps when dragged up and down; sideways starts a link
  if (pend.ctl.t !== 'foot' && Math.abs(dy) >= Math.abs(dx)) {
    handOver();
    return ed.onMove(e);
  }
  startDrag(e);
}
function onUp(e) {
  if (drag) return finishDrag(e);
  if (!pend) return;
  // a click: press and release through the editor, same as before
  handOver();
  ed.onUp(e);
}
function cancel() {
  if (pend) { clearTimeout(pend.hold); pend = null; }
  if (drag) endDrag();
}

function startDrag(e) {
  const p = pend;
  clearTimeout(p.hold);
  pend = null;
  const world = ed.layerDrag.parentNode;
  const a = boxIn(ctlEl(p.v, p.ctl.cid), world);
  if (!a) return;
  ed.layerDrag.innerHTML = '';
  const g = svg('g', {}, ed.layerDrag);
  const z = ed.view.z || 1;
  drag = { ...p, a, g, world, col: p.src.color };
  drag.hot = svg('circle', { class: 'hxl-hot', r: 0, fill: p.src.color, 'fill-opacity': 0.16, stroke: p.src.color, 'stroke-width': 2 / z, display: 'none' }, g);
  drag.bad = svg('circle', { class: 'hxl-bad', r: 0, 'stroke-width': 2 / z, display: 'none' }, g);
  svg('circle', { cx: a.x, cy: a.y, r: Math.max(a.w, a.h) / 2 + 4, fill: 'none', stroke: p.src.color, 'stroke-width': 2 / z, opacity: 0.9 }, g);
  drag.glow = svg('path', { class: 'hxl-line', stroke: '#000', 'stroke-opacity': 0.45, 'stroke-width': 5.5 / z }, g);
  drag.line = svg('path', { class: 'hxl-line', stroke: p.src.color, 'stroke-width': 2.6 / z, 'stroke-dasharray': `${8 / z} ${5 / z}` }, g);
  drag.tip = svg('circle', { r: 4.5 / z, fill: p.src.color, stroke: '#000', 'stroke-opacity': 0.5, 'stroke-width': 1 / z }, g);
  ed.board.classList.add('hx-linking');
  moveDrag(e);
}
// the control under the pointer that a link could go to
function targetAt(e) {
  for (const el of document.elementsFromPoint(e.clientX, e.clientY)) {
    if (ed.layerDrag.contains(el)) continue;
    const ne = el.closest && el.closest('[data-node]');
    if (!ne) continue;
    const id = ne.dataset.node;
    if (id === drag.v.block.id || id.startsWith('__')) return null;
    const v = ed.views.get(id);
    if (!v) return null;
    const ce = el.closest('[data-ctl],[data-hxl-target]');
    let c = ce && v.views.get(ce.dataset.ctl || ce.dataset.hxlTarget)?.ctl;
    // dropped on the body of a pedal with a single footswitch / treadle: that one
    if (!c || !targetKind(c)) {
      const want = drag.src.kind === 'foot' ? (x) => x.t === 'foot' : (x) => x.t === 'treadle' && x.p;
      const opts = [...v.views.values()].map((x) => x.ctl).filter((x) => want(x) && ctlEl(v, x.cid));
      if (opts.length === 1) c = opts[0];
      else if (!c) return { v, none: true };
    }
    const kind = targetKind(c);
    if (!kind) return { v, none: true };
    return { v, c, ok: kind === drag.src.kind };
  }
  return null;
}
function moveDrag(e) {
  const d = drag;
  const w = ed.toWorld(e.clientX, e.clientY);
  const t = targetAt(e);
  d.target = t && !t.none ? t : null;
  let b = { x: w.x, y: w.y };
  d.hot.setAttribute('display', 'none');
  d.bad.setAttribute('display', 'none');
  if (d.target) {
    const box = boxIn(ctlEl(t.v, t.c.cid), d.world);
    if (box) {
      const r = Math.max(box.w, box.h) / 2 + 6;
      const ring = t.ok ? d.hot : d.bad;
      ring.setAttribute('cx', box.x); ring.setAttribute('cy', box.y); ring.setAttribute('r', r);
      ring.setAttribute('display', 'inline');
      if (t.ok) b = { x: box.x, y: box.y };
    }
  }
  const a = d.a;
  // a gentle sag, so it reads as a link rather than a cable
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2 + Math.min(60, Math.hypot(b.x - a.x, b.y - a.y) * 0.12);
  const path = `M${a.x.toFixed(1)},${a.y.toFixed(1)} Q${mx.toFixed(1)},${my.toFixed(1)} ${b.x.toFixed(1)},${b.y.toFixed(1)}`;
  d.line.setAttribute('d', path);
  d.glow.setAttribute('d', path);
  d.tip.setAttribute('cx', b.x); d.tip.setAttribute('cy', b.y);
  const what = d.src.kind === 'foot' ? 'a footswitch' : 'a treadle or knob';
  if (d.target && d.target.ok) ed.tipText(e, `Link ${d.src.name} to ${blockName(t.v.block)} ${ctlName(t.c)}`);
  else if (d.target) ed.tipText(e, d.src.kind === 'foot' ? 'A footswitch links to a footswitch' : 'EXP links to a treadle or knob');
  else ed.tipText(e, `${d.src.name}: drop on ${what}`);
}
function endDrag() {
  ed.layerDrag.innerHTML = '';
  ed.board.classList.remove('hx-linking');
  ed.hideTip();
  drag = null;
}
function finishDrag() {
  const d = drag;
  endDrag();
  const t = d.target;
  if (!t) return;
  if (!t.ok) {
    toast(d.src.kind === 'foot' ? 'Helix footswitches link to footswitches. Drag the EXP pedal to link a treadle or knob.' : 'The EXP pedal links to a treadle or knob. Drag a footswitch to link a footswitch.', 'warn', 3200);
    return;
  }
  const target = { block: t.v.block.id, cid: t.c.cid };
  const dup = (d.v.block.bindings || []).some((x) => x.src === d.src.src && x.target && x.target.block === target.block && x.target.cid === target.cid);
  if (dup) return toast(`${d.src.name} is already linked to that ${ctlName(t.c)}`, 'info', 1800);
  commitNow();
  if (!d.L.add(d.v.block, d.src, target, t.c)) return;
  toast(`${d.src.name} now controls ${blockName(t.v.block)}`, 'ok', 1800);
  refresh(true);
  bus.emit('selection'); // the inspector's link list
}

// ------------------------------------------------------------ overlays
function wanted() {
  const out = new Map(); // view id -> [{ cid, items, side }]
  const add = (id, cid, side, item) => {
    if (!out.has(id)) out.set(id, new Map());
    const m = out.get(id);
    const k = side + '|' + cid;
    if (!m.has(k)) m.set(k, { cid, side, items: [] });
    m.get(k).items.push(item);
  };
  if (!state.preset) return out;
  for (const b of state.preset.blocks) {
    const L = linkApi(b);
    if (!L) continue;
    for (const l of L.list(b)) {
      const tb = state.preset.blocks.find((x) => x.id === l.target.block);
      const tc = tb && getDef(tb.type)?.controls.find((c) => c.cid === l.target.cid);
      if (!tc) continue;
      const item = { helix: b, l, tb, tc };
      add(tb.id, l.target.cid, 't', item);
      if (l.cid) add(b.id, l.cid, 's', item);
    }
  }
  return out;
}
export function refresh(force = false) {
  if (!ed) return;
  if (ed.board.classList.contains('vfast')) return; // mid pan or zoom: next pass
  const want = wanted();
  for (const [id, rec] of drawn) {
    if (!want.has(id) || !ed.views.get(id)) { rec.g.remove(); drawn.delete(id); }
  }
  for (const [id, m] of want) {
    const v = ed.views.get(id);
    if (!v) continue;
    const key = [...m.values()].map((x) => x.side + x.cid + ':' + x.items.map((i) => i.helix.id + i.l.src + i.l.short + i.l.color + i.l.msg + i.tb.id + i.tc.cid).join(',')).join(';');
    const rec = drawn.get(id);
    if (!force && rec && rec.key === key && rec.g.parentNode === v.content) continue;
    if (rec) rec.g.remove();
    const g = svg('g', { class: 'hxl' });
    let ok = true;
    for (const x of m.values()) ok = drawOne(v, g, x) && ok;
    v.content.appendChild(g);
    v._lodDirty = true;
    // a block not on screen yet (other tab, bitmap mode) can't be measured: try again later
    drawn.set(id, { g, key: ok ? key : '' });
  }
}
function drawOne(v, g, x) {
  const box = boxIn(ctlEl(v, x.cid), v.content);
  if (!box) return false;
  const R = Math.max(box.w, box.h) / 2;
  if (x.side === 't') {
    const col = x.items[0].l.color;
    const names = x.items.map((i) => `${i.l.name} on ${blockName(i.helix)} (${i.l.msg})`).join('\n');
    const tip = `Controlled by ${names}\nRight-click to remove`;
    const ring = svg('circle', { class: 'hxl-ring', cx: box.x, cy: box.y, r: R + 3, fill: col, 'fill-opacity': 0.1, stroke: col, 'stroke-width': 1.5, 'stroke-opacity': 0.85, 'stroke-dasharray': '3.5 2.2' }, g);
    svg('title', {}, ring, tip);
    ring.dataset.hxlTarget = x.cid;
    // one small tag per Helix control, stacked up the right side of the switch
    x.items.forEach((i, k) => {
      const txt = i.l.short;
      const w = 7 + txt.length * 4.4, h = 10;
      const bx = box.x + R * 0.62, by = box.y - R * 0.62 - h / 2 - k * (h + 2);
      const bg = svg('g', { class: 'hxl-badge', transform: `translate(${bx.toFixed(1)},${by.toFixed(1)})` }, g);
      bg.dataset.hxlTarget = x.cid;
      svg('title', {}, bg, `Controlled by ${i.l.name} on ${blockName(i.helix)} (${i.l.msg})\nRight-click to remove`);
      svg('rect', { x: 0, y: 0, width: w, height: h, rx: 3, fill: '#0b0c10', 'fill-opacity': 0.88, stroke: i.l.color, 'stroke-width': 0.9 }, bg);
      svg('text', { x: w / 2, y: h / 2 + 2.3, 'text-anchor': 'middle', 'font-size': 6.4, fill: i.l.color }, bg, txt);
    });
  } else {
    const col = x.items[0].l.color;
    const mk = svg('g', { class: 'hxl-mark hxl-badge', transform: `translate(${(box.x + R * 0.78).toFixed(1)},${(box.y + R * 0.78).toFixed(1)})` }, g);
    mk.dataset.hxlSource = x.cid;
    svg('title', {}, mk, `${x.items[0].l.name} controls ${x.items.map((i) => blockName(i.tb) + ' ' + ctlName(i.tc)).join(', ')}\nRight-click to remove`);
    svg('circle', { r: 5.6, fill: '#0b0c10', stroke: col, 'stroke-width': 1.1 }, mk);
    // a tiny chain link, plus a count when it drives several pedals
    if (x.items.length > 1) svg('text', { y: 2.3, 'text-anchor': 'middle', 'font-size': 6.2, fill: col }, mk, String(x.items.length));
    else {
      svg('rect', { x: -3.6, y: -1.6, width: 4.4, height: 3.2, rx: 1.6, fill: 'none', stroke: col, 'stroke-width': 0.9, transform: 'rotate(-35)' }, mk);
      svg('rect', { x: -0.8, y: -1.6, width: 4.4, height: 3.2, rx: 1.6, fill: 'none', stroke: col, 'stroke-width': 0.9, transform: 'rotate(-35)' }, mk);
    }
  }
  return true;
}

// ------------------------------------------------------------ remove menus
function onContext(e) {
  const t = e.target;
  const ne = t.closest && t.closest('[data-node]');
  if (!ne) return;
  const v = ed.views.get(ne.dataset.node);
  if (!v) return;
  const want = wanted().get(v.block.id);
  if (!want) return;
  let cid = null, side = null;
  const ov = t.closest('[data-hxl-target],[data-hxl-source]');
  if (ov) { cid = ov.dataset.hxlTarget || ov.dataset.hxlSource; side = ov.dataset.hxlTarget ? 't' : 's'; }
  else {
    // right-click on a linked Helix switch itself
    const ce = t.closest('[data-ctl]');
    if (ce && want.has('s|' + ce.dataset.ctl)) { cid = ce.dataset.ctl; side = 's'; }
  }
  const rec = cid && want.get(side + '|' + cid);
  if (!rec) return;
  e.preventDefault();
  e.stopPropagation();
  const items = [{ title: side === 't' ? 'Helix link' : `${rec.items[0].l.name} links` }];
  for (const i of rec.items) {
    const label = side === 't' ? `Remove link from ${i.l.name}` : `Remove link to ${blockName(i.tb)} ${ctlName(i.tc)}`;
    items.push({ label, icon: 'trash', onClick: () => removeLinks([i]) });
  }
  if (rec.items.length > 1) items.push({ sep: true }, { label: 'Remove all of these', icon: 'trash', onClick: () => removeLinks(rec.items) });
  showMenu(e.clientX, e.clientY, items);
}
function removeLinks(list) {
  commitNow();
  let n = 0;
  for (const i of list) if (linkApi(i.helix)?.remove(i.helix, i.l.bd)) n++;
  if (n) toast(n > 1 ? `${n} links removed` : 'Link removed', 'info', 1200);
  refresh(true);
  bus.emit('selection');
}

// tests
window.__hxLinks = { refresh: () => refresh(true), drawn };
