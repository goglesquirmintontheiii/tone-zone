// The board: pan and zoom, placing and dragging blocks, patch cables and controls.
import { drawPlug as drawPlugGfx, JACK_TIP, PLUG_LENS, CABLE_WIDTH, SLEEVE } from './gfx/jacks.js';
import { svg, clamp, shade, bus, toast } from './util.js';
import { installDefs } from './gfx/defs.js';
import { NodeView, knobPos, knobValue } from './nodeview.js';
import { screenPointer } from './screens.js';
import { getDef, jackKindOf, kindsCompatible, KIND_NAMES } from './catalog/index.js';
import {
  state, blockById, addBlock, removeBlocks, duplicateBlocks, setParam, setBypass, connect, removeCable, setCableColor,
  commitNow, uiParams, engineParamsFor, CABLE_COLORS, markDirty, estimatedLoad, cableMakesLoop,
} from './state.js';
import { showMenu } from './menus.js';
import { footCtrl } from './control.js';
import { hooksFor } from './plugins.js';
import { MIC_TYPES, micToSpeaker } from './gfx/cabgeom.js';
import { BOARD_SLOT } from './catalog/pedalboards.js';


export class Editor {
  constructor() {
    this.svg = document.getElementById('boardSvg');
    this.board = document.getElementById('board');
    this.viewport = document.getElementById('viewport');
    this.layerNodes = document.getElementById('layerNodes');
    this.layerBoards = document.getElementById('layerBoards'); // pedalboards, under everything
    this.layerCables = document.getElementById('layerCables');
    this.layerShadows = document.getElementById('layerCableShadows');
    this.layerPlugs = document.getElementById('layerPlugs');
    this.layerDrag = document.getElementById('layerDrag');
    installDefs(document.getElementById('globalDefs'));
    this.views = new Map();
    this.cableEls = new Map();
    this.view = { x: 0, y: 0, z: 0.8 };
    this._lodQueue = new Set();
    this.tip = document.createElement('div');
    this.tip.id = 'valueTip';
    document.body.appendChild(this.tip);
    // never leave a value tip behind (lost pointerup, tab switch, window change)
    const dropTip = () => { if (!this.drag || this.drag.kind !== 'ctl') this.hideTip(); };
    bus.on('tab', () => this.hideTip());
    window.addEventListener('blur', () => this.hideTip());
    document.addEventListener('visibilitychange', () => this.hideTip());
    this.bind();
    bus.on('preset:changed', ({ keepView }) => this.rebuild(keepView));
    bus.on('block:added', (b) => this.addView(b, true));
    bus.on('cables', () => this.drawCables());
    bus.on('param', ({ id, p }) => {
      const v = this.views.get(id);
      if (v && v.def.rerenderOn && v.def.rerenderOn.includes(p)) this.rerenderNode(id);
      else v?.updateControls();
    });
    bus.on('bypass', ({ id }) => this.views.get(id)?.setBypassVisual());
    bus.on('selection', () => this.views.forEach((v) => v.updateSelection()));
    this.boardView = document.getElementById('view-board');
    this.board.addEventListener('pointerleave', dropTip);
    // a timer, not rAF: a rAF loop that never stops forces a BeginMainFrame every vsync
    setInterval(() => this.frame(), 45); // ~22 Hz, so LEDs, screens and meters repaint in the same frame
  }

  // ------------------------------------------------------------ view
  // fast = during a pan or zoom: move the painted board with a compositor transform (no SVG repaint)
  // and redraw it sharp once the gesture pauses
  applyView(fast = false) {
    const { x, y, z } = this.view;
    const now = performance.now();
    // during a gesture, do a full redraw at most ~10 times a second and just move the board in between
    if (fast && this.committed && now - (this._lastCommit || 0) < 100) {
      const c = this.committed;
      const sc = z / c.z;
      this.svg.style.transform = `translate(${x - sc * c.x}px, ${y - sc * c.y}px) scale(${sc})`;
      this.board.classList.add('vfast');
      clearTimeout(this._commitT);
      this._commitT = setTimeout(() => this.applyView(false), 120);
    } else {
      this._lastCommit = now;
      clearTimeout(this._commitT);
      this.viewport.setAttribute('transform', `translate(${x},${y}) scale(${z})`);
      this.svg.style.transform = '';
      this.board.classList.remove('vfast');
      this.committed = { x, y, z };
    }
    document.getElementById('zoomVal').textContent = Math.round(z * 100) + '%';
    if (this._tipAt && !(this.drag && this.drag.kind === 'ctl') && performance.now() - this._tipAt > 80) this.hideTip();
    const grid = Math.max(4, 40 * z);
    const gEl = this.gridEl || (this.gridEl = document.getElementById('boardGrid'));
    if (gEl) {
      if (this._gridSize !== grid) { this._gridSize = grid; gEl.style.backgroundSize = `${grid}px ${grid}px, ${grid}px ${grid}px`; }
      const mx = (((x + 200) % grid) + grid) % grid, my = (((y + 200) % grid) + grid) % grid;
      gEl.style.transform = `translate(${mx.toFixed(1)}px, ${my.toFixed(1)}px)`;
    }
    // don't save a view computed while the board was hidden
    if (state.preset && !this._pendingView) state.preset.view = { ...this.view };
    if (fast) {
      this._moving = true;
      clearTimeout(this._moveEndT);
      this._moveEndT = setTimeout(() => { this._moving = false; this.updateLOD(); }, 180);
    }
    this.updateLOD();
  }

  // ------------------------------------------------------------ level of detail
  // Big boards: when zoomed out (or while moving), each block is drawn as one bitmap instead of
  // hundreds of SVG shapes, so panning and zooming don't re-rasterise the whole board.
  // bitmaps only below 50% (as shown in the zoom box); at 50% and up it's always live SVG
  lodWanted() {
    return Math.round(this.view.z * 100) < 50;
  }
  boardShown() {
    const r = this.board.getBoundingClientRect();
    return r.width >= 50 && r.height >= 50;
  }
  lodScale() {
    const t = this.view.z * Math.min(2, window.devicePixelRatio || 1);
    return t <= 0.3 ? 0.3 : t <= 0.5 ? 0.5 : t <= 0.75 ? 0.75 : 1;
  }
  updateLOD(force = false) {
    const want = this.lodWanted(), scale = this.lodScale();
    const key = want + ':' + scale + ':' + this.views.size;
    if (!force && key === this._lodKey) return;
    this._lodKey = key;
    // cable shadows are big soft strokes, skip them when zoomed far out
    const farOut = this.view.z < 0.45;
    if (this._shadowsOff !== farOut) { this._shadowsOff = farOut; this.layerShadows.style.display = farOut ? 'none' : ''; }
    const prewarm = this.views.size >= 12 && this.view.z < 0.6; // so zooming out can switch right away
    for (const v of this.views.values()) {
      if (want) v.setLOD(true); // shows the bitmap if there is one, even if slightly stale
      else v.setLOD(false);
      if ((want || prewarm) && !v.lodReady(scale)) this._lodQueue.add(v);
    }
    this.pumpLOD();
  }
  pumpLOD() {
    if (this._lodPumping || !this._lodQueue.size) return;
    this._lodPumping = true;
    const step = async () => {
      // don't compete with an active drag; visible blocks first
      if (this.drag && this.drag.kind === 'node') { setTimeout(step, 120); return; }
      // a hidden board (other tab open) snapshots as blank, so wait until it's shown again
      if (!this.boardShown()) { this._lodPumping = false; return; }
      const scale = this.lodScale(), want = this.lodWanted();
      const r = this._vr || this.board.getBoundingClientRect();
      const { x, y, z } = this.view;
      const vis = (v) => v.block.x * z + x < r.width && (v.block.x + v.w) * z + x > 0 && v.block.y * z + y < r.height && (v.block.y + v.h) * z + y > 0;
      let next = null;
      for (const v of this._lodQueue) {
        if (!this.views.has(v.block.id) || this.views.get(v.block.id) !== v || v.lodReady(scale)) { this._lodQueue.delete(v); continue; }
        if (!next || (vis(v) && !vis(next))) next = v;
        if (vis(v)) break;
      }
      if (!next) { this._lodPumping = false; return; }
      this._lodQueue.delete(next);
      await next.makeLOD(scale);
      if (this.lodWanted()) next.setLOD(true);
      const idle = window.requestIdleCallback || ((f) => setTimeout(f, 16));
      idle(step, { timeout: 200 });
    };
    step();
  }
  toWorld(cx, cy) {
    const r = this.board.getBoundingClientRect();
    return { x: (cx - r.left - this.view.x) / this.view.z, y: (cy - r.top - this.view.y) / this.view.z };
  }
  zoomAt(cx, cy, factor) {
    const r = this.board.getBoundingClientRect();
    const px = cx - r.left, py = cy - r.top;
    const nz = clamp(this.view.z * factor, 0.2, 2.5);
    this.view.x = px - ((px - this.view.x) * nz) / this.view.z;
    this.view.y = py - ((py - this.view.y) * nz) / this.view.z;
    this.view.z = nz;
    this.applyView(true);
  }
  fit(animate = true) {
    if (!this.views.size) return;
    if (this.board.getBoundingClientRect().width < 50) { this._pendingView = true; state.preset && (state.preset.view = null); return this.restoreView(); }
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const v of this.views.values()) {
      x0 = Math.min(x0, v.block.x - 40);
      y0 = Math.min(y0, v.block.y - 40);
      x1 = Math.max(x1, v.block.x + v.w + 40);
      y1 = Math.max(y1, v.block.y + v.h + 60);
    }
    const r = this.board.getBoundingClientRect();
    const z = clamp(Math.min(r.width / (x1 - x0), (r.height - 70) / (y1 - y0)), 0.2, 1.3);
    const target = { z, x: (r.width - (x1 - x0) * z) / 2 - x0 * z, y: (r.height - 70 - (y1 - y0) * z) / 2 - y0 * z };
    if (!animate) {
      this.view = target;
      return this.applyView();
    }
    const from = { ...this.view };
    const t0 = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - t0) / 380);
      const e = 1 - Math.pow(1 - t, 3);
      this.view = { x: from.x + (target.x - from.x) * e, y: from.y + (target.y - from.y) * e, z: from.z + (target.z - from.z) * e };
      this.applyView(t < 1);
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  // ------------------------------------------------------------ building
  rebuild(keepView) {
    this.layerNodes.innerHTML = '';
    this.layerBoards.innerHTML = '';
    this.views.clear();
    // draw order: big things (cabs/amps) behind pedals
    const order = [...state.preset.blocks].sort((a, b) => zOrder(a) - zOrder(b));
    for (const b of order) this.addView(b, false);
    this.drawCables();
    if (!keepView) {
      this._pendingView = true;
      this.restoreView();
    }
    this.updateLOD(true);
  }
  // Use the preset's saved view or fit the board. A hidden board (preset loaded from another tab)
  // has no size, so wait until it's visible.
  restoreView() {
    if (!this._pendingView || !state.preset) return;
    const r = this.board.getBoundingClientRect();
    if (r.width < 50 || r.height < 50) {
      if (!this._viewRO) {
        this._viewRO = new ResizeObserver(() => this.restoreView());
        this._viewRO.observe(this.board);
      }
      return;
    }
    this._pendingView = false;
    this._lodKey = null; // bitmaps were put off while hidden
    const sv = state.preset.view;
    if (sv && this.viewShowsContent(sv, r)) {
      this.view = { ...sv };
      this.applyView();
    } else this.fit(false);
  }
  // true if a saved view still shows a good part of the blocks
  viewShowsContent(v, r) {
    if (!(v.z >= 0.2 && v.z <= 2.5) || !isFinite(v.x) || !isFinite(v.y) || !this.views.size) return false;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const nv of this.views.values()) {
      x0 = Math.min(x0, nv.block.x); y0 = Math.min(y0, nv.block.y);
      x1 = Math.max(x1, nv.block.x + nv.w); y1 = Math.max(y1, nv.block.y + nv.h);
    }
    const sx0 = x0 * v.z + v.x, sy0 = y0 * v.z + v.y, sx1 = x1 * v.z + v.x, sy1 = y1 * v.z + v.y;
    const ix = Math.max(0, Math.min(sx1, r.width) - Math.max(sx0, 0)), iy = Math.max(0, Math.min(sy1, r.height) - Math.max(sy0, 0));
    const area = Math.max(1, (sx1 - sx0) * (sy1 - sy0));
    return (ix * iy) / Math.min(area, r.width * r.height) > 0.35;
  }
  addView(b, animate) {
    const d = getDef(b.type);
    if (!d) return;
    const v = new NodeView(b, d.pedalboard ? this.layerBoards : this.layerNodes);
    this.views.set(b.id, v);
    v.setBypassVisual();
    if (animate) {
      v.g.classList.add('appear');
      setTimeout(() => v.g.classList.remove('appear'), 450);
    }
  }
  // turn blocks 90 degrees around their own centre
  rotateBlocks(ids, delta = 90) {
    ids = ids.filter((id) => !id.startsWith('__') && this.views.has(id) && !this.views.get(id).def.pedalboard);
    if (!ids.length) return;
    commitNow();
    for (const id of ids) {
      const v = this.views.get(id), b = v.block;
      const cx = b.x + v.w / 2, cy = b.y + v.h / 2;
      b.rot = ((((b.rot || 0) + delta) % 360) + 360) % 360;
      if (!b.rot) delete b.rot;
      v.render();
      v.setBypassVisual();
      v.setPosition(Math.round(cx - v.w / 2), Math.round(cy - v.h / 2));
    }
    this.coupleAfterMove(ids);
    this.drawCables();
    markDirty();
  }
  rerenderNode(id) {
    const v = this.views.get(id);
    if (v) {
      v.render();
      v.setBypassVisual();
      this.drawCables();
    }
  }

  // ------------------------------------------------------------ cables
  jackGeom(nodeId, key) {
    const v = this.views.get(nodeId);
    if (!v) return null;
    const p = v.jackWorld(key);
    if (!p) return null;
    const dir = typeof p.angle === 'number' && p.side !== 'front'
      ? [Math.cos((p.angle * Math.PI) / 180), Math.sin((p.angle * Math.PI) / 180)]
      : { left: [-1, 0], right: [1, 0], top: [0, -1], bottom: [0, 1], front: [0, 1] }[p.side] || [1, 0];
    return { x: p.x, y: p.y, dx: dir[0], dy: dir[1], front: p.side === 'front', kind: p.kind || 'inst' };
  }
  cablePath(a, b) {
    // a, b: plug tips {x,y,dx,dy}. The cable starts at the end of each boot
    const plugLen = (j) => (j.front ? 6 : (JACK_TIP[j.kind] ?? 6) + (PLUG_LENS[j.kind] || 30) - (j.free ? 0 : SLEEVE[j.kind] || 0));
    const la = plugLen(a), lb = plugLen(b);
    const ax = a.x + a.dx * la, ay = a.y + a.dy * la;
    const bx = b.x + b.dx * lb, by = b.y + b.dy * lb;
    const dist = Math.hypot(bx - ax, by - ay);
    const L = clamp(dist * 0.42, 40, 220);
    const sag = clamp(dist * 0.28, 22, 180);
    const c1x = ax + a.dx * L, c1y = ay + a.dy * L + sag;
    const c2x = bx + b.dx * L, c2y = by + b.dy * L + sag;
    return `M${ax.toFixed(1)},${ay.toFixed(1)} C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${bx.toFixed(1)},${by.toFixed(1)}`;
  }
  drawPlug(parent, j, color) {
    return drawPlugGfx(parent, j, color, j.kind);
  }
  drawCables() {
    this.layerCables.innerHTML = '';
    this.layerShadows.innerHTML = '';
    this.layerPlugs.innerHTML = '';
    this.cableEls.clear();
    for (const c of state.preset.cables) this.drawCable(c);
  }
  drawCable(c) {
    if (c.direct) return; // coupler link: the plugs touch, so nothing to draw
    const a = this.jackGeom(c.from.node, 'o' + c.from.port);
    const b = this.jackGeom(c.to.node, 'i' + c.to.port);
    if (!a || !b) return;
    // cable kind follows the jacks (an interface combo jack takes whatever is plugged in)
    let kind = a.kind !== 'any' ? a.kind : b.kind !== 'any' ? b.kind : 'inst';
    if (a.kind === 'any') a.kind = kind;
    if (b.kind === 'any') b.kind = kind;
    const d = this.cablePath(a, b);
    const col = c.color || '#e8473d';
    const cw = CABLE_WIDTH[kind] || 5.6;
    const sh = svg('g', { transform: 'translate(5,12)', 'pointer-events': 'none', fill: 'none', stroke: '#000', 'stroke-linecap': 'round' }, this.layerShadows);
    svg('path', { d, 'stroke-width': 16, opacity: 0.07 }, sh);
    svg('path', { d, 'stroke-width': 10, opacity: 0.1 }, sh);
    svg('path', { d, 'stroke-width': 5, opacity: 0.12 }, sh);
    const g = svg('g', { class: 'cable' + (state.selectedCable === c.id ? ' selected' : '') }, this.layerCables);
    g.dataset.cable = c.id;
    svg('path', { d, fill: 'none', stroke: 'transparent', 'stroke-width': 16 }, g);
    cableBody(g, d, col, kind, cw);
    if (kind === 'ctrl' || kind === 'midi') svg('path', { d, fill: 'none', stroke: '#000', 'stroke-width': 1, 'stroke-dasharray': '2 6', opacity: 0.35, 'pointer-events': 'none' }, g);
    const pg = svg('g', {}, this.layerPlugs);
    this.drawPlug(pg, a, col);
    this.drawPlug(pg, b, col);
    this.cableEls.set(c.id, { g, sh, pg });
  }
  updateCablesFor(nodeIds) {
    const set = new Set(nodeIds);
    for (const c of state.preset.cables) {
      if (!set.has(c.from.node) && !set.has(c.to.node)) continue;
      const e = this.cableEls.get(c.id);
      if (e) {
        e.g.remove();
        e.sh.remove();
        e.pg.remove();
      }
      this.drawCable(c);
    }
  }

  // ------------------------------------------------------------ interaction
  bind() {
    const s = this.svg;
    s.addEventListener('pointerdown', (e) => this.onDown(e));
    window.addEventListener('pointermove', (e) => this.onMove(e));
    window.addEventListener('pointerup', (e) => this.onUp(e));
    // a drag that never got its pointerup (window lost focus, pointer cancelled) must not stay active
    window.addEventListener('pointercancel', (e) => this.onUp(e));
    window.addEventListener('blur', () => this.drag && this.onUp(new PointerEvent('pointerup')));
    s.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
    s.addEventListener('dblclick', (e) => this.onDbl(e));
    s.addEventListener('contextmenu', (e) => this.onContext(e));
    this.board.addEventListener('keydown', (e) => this.onKey(e));
    // drop from the block list
    this.board.addEventListener('dragover', (e) => {
      if (e.dataTransfer.types.includes('application/x-tz-block')) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
      }
    });
    this.board.addEventListener('drop', (e) => {
      const type = e.dataTransfer.getData('application/x-tz-block');
      if (!type) return;
      e.preventDefault();
      const w = this.toWorld(e.clientX, e.clientY);
      this.addAt(type, w.x, w.y, true);
    });
    document.getElementById('zoomIn').onclick = () => this.zoomAtCenter(1.2);
    document.getElementById('zoomOut').onclick = () => this.zoomAtCenter(1 / 1.2);
    document.getElementById('zoomFit').onclick = () => this.fit();
  }
  zoomAtCenter(f) {
    const r = this.board.getBoundingClientRect();
    this.zoomAt(r.left + r.width / 2, r.top + r.height / 2, f);
  }
  addAt(type, x, y, centered) {
    const d = getDef(type);
    if (!d) return;
    const budget = (state.settings.budget ?? 0.75) * 100;
    const est = estimatedLoad(d.cost || 0.5);
    if (est > budget) {
      if (state.settings.hardLimit) return toast(`Not added. It would push DSP load to about ${est.toFixed(0)}%, over your ${Math.round(budget)}% budget.`, 'err');
      toast(`Heads up: DSP load is now about ${est.toFixed(0)}%, over your ${Math.round(budget)}% budget.`, 'warn');
    }
    const b = addBlock(type, x, y);
    if (b && centered) {
      const v = this.views.get(b.id);
      if (v) v.setPosition(Math.round(x - v.w / 2), Math.round(y - v.h / 2));
    }
    if (b) {
      const hit = this.coupleSnap(new Set([b.id]));
      const v = this.views.get(b.id);
      if (hit && v) v.setPosition(v.block.x + hit.ox, v.block.y + hit.oy);
      else this.boardSnap([b.id], b.id);
      this.coupleLinks(new Set([b.id]));
      this.select([b.id]);
    }
    return b;
  }

  // ------------------------------------------------------------ pedalboards
  boardAt(x, y) {
    let best = null;
    for (const v of this.views.values()) {
      if (!v.def.pedalboard) continue;
      const b = v.block;
      if (x >= b.x && x <= b.x + v.w && y >= b.y && y <= b.y + v.h) best = v; // last one is drawn on top
    }
    return best;
  }
  // blocks whose centre is on this board
  boardMembers(id) {
    const bv = this.views.get(id);
    if (!bv || !bv.def.pedalboard) return [];
    const out = [];
    for (const v of this.views.values()) {
      if (v === bv || v.def.pedalboard || v.block.id.startsWith('__')) continue;
      const cx = v.block.x + v.w / 2, cy = v.block.y + v.h / 2;
      if (this.boardAt(cx, cy) === bv) out.push(v.block.id);
    }
    return out;
  }
  // drop on a board: put the grabbed block in the nearest free slot and move the rest of the group with it
  boardSnap(ids, grab) {
    const gv = this.views.get(grab);
    if (!gv || gv.def.pedalboard || gv.def.coupler || ids.some((i) => this.views.get(i)?.def.pedalboard)) return;
    const bv = this.boardAt(gv.block.x + gv.w / 2, gv.block.y + gv.h / 2);
    if (!bv || !bv.slots) return;
    const { cols, rows } = bv.def.pedalboard, S = BOARD_SLOT;
    const rowCols = bv.def.pedalboard.rowCols || Array(rows).fill(cols);
    const rowX = (r) => S.padX + ((cols - rowCols[r]) * S.w) / 2;
    // floor units, amps and cabs don't go on boards: slide them off below the board
    const base = gv.def.baseForm;
    if (gv.w > S.w * 3 || gv.h > S.h * 1.35 || base === 'amp' || base === 'cab' || gv.def.cat === 'Pedalboard') {
      const dy = bv.block.y + bv.h + 40 - gv.block.y;
      for (const i of ids) { const v = this.views.get(i); if (v) v.setPosition(v.block.x, v.block.y + dy); }
      this.updateCablesFor(ids);
      toast(`${gv.def.name} is too big for a pedalboard`, 'info');
      return;
    }
    // a pedal a little taller than a row (a level meter, say) stands on that row's two rails and sticks out above
    const tall = gv.h + 6 > S.h;
    const n = Math.min(cols, Math.ceil((gv.w + 6) / S.w)), m = 1;
    const others = this.boardMembers(bv.block.id).filter((i) => !ids.includes(i)).map((i) => this.views.get(i));
    const hits = (x, y) => others.some((o) => x < o.block.x + o.w - 4 && x + gv.w > o.block.x + 4 && y < o.block.y + o.h - 4 && y + gv.h > o.block.y + 4);
    let best = null;
    for (let r = 0; r <= rows - m; r++)
      for (let c = 0; c <= rowCols[r] - n; c++) {
        const x = Math.round(bv.block.x + rowX(r) + c * S.w + (n * S.w - gv.w) / 2);
        const y = Math.round(bv.block.y + S.padY + r * S.h + (tall ? S.h - gv.h - 4 : (S.h - gv.h) / 2));
        const d = Math.hypot(x - gv.block.x, y - gv.block.y) + (hits(x, y) ? 1e6 : 0);
        if (!best || d < best.d) best = { d, x, y };
      }
    if (!best) return;
    const dx = best.x - gv.block.x, dy = best.y - gv.block.y;
    if (!dx && !dy) return;
    for (const i of ids) { const v = this.views.get(i); if (v) v.setPosition(v.block.x + dx, v.block.y + dy); }
    this.updateCablesFor(ids);
  }

  // ------------------------------------------------------------ male couplers
  // every open plug end of a male coupler and every free side jack it could plug into.
  // A pair whose sides don't face each other gets `rot`: how far the coupler would have to turn.
  couplePairs(moved) {
    const busy = new Set();
    for (const c of state.preset.cables) { busy.add(c.from.node + ':o' + c.from.port); busy.add(c.to.node + ':i' + c.to.port); }
    const ends = [], jacks = [];
    for (const v of this.views.values()) {
      for (const j of v.jacks || []) {
        const n = SIDE_N[j.side];
        if (!n) continue;
        if (/^[io]c/.test(j.key)) continue;
        const kind = j.kind || jackKindOf(v.def, j.key);
        if (!kindsCompatible(kind, 'inst')) continue;
        const rec = { v, j, x: v.block.x + j.x, y: v.block.y + j.y, n, busy: busy.has(v.block.id + ':' + j.key) };
        (j.male ? ends : jacks).push(rec);
      }
    }
    const pairs = [];
    for (const e of ends)
      for (const k of jacks) {
        if (k.v === e.v || k.j.key[0] === e.j.key[0]) continue;
        const em = moved.has(e.v.block.id), km = moved.has(k.v.block.id);
        if (em === km && moved.size) continue;
        const tx = k.x + k.n[0] * SEAT, ty = k.y + k.n[1] * SEAT; // the coupler's end sits against the jack nut
        const facing = k.n[0] === -e.n[0] && k.n[1] === -e.n[1];
        const rot = facing ? 0 : ((angOf([-k.n[0], -k.n[1]]) - angOf(e.n)) % 360 + 360) % 360;
        pairs.push({ e, k, em, rot, dx: tx - e.x, dy: ty - e.y });
      }
    return pairs;
  }
  // can this coupler be turned to fit? only if it isn't held in place by its other end
  coupleCanTurn(e, moved) {
    const id = e.v.block.id;
    if (moved.has(id)) return moved.size === 1;
    return !state.preset.cables.some((c) => c.direct && (c.from.node === id || c.to.node === id));
  }
  coupleSnap(moved, turn = true) {
    let best = null;
    for (const p of this.couplePairs(moved)) {
      if (p.e.busy || p.k.busy) continue;
      if (p.rot && (!turn || !this.coupleCanTurn(p.e, moved))) continue;
      const d = Math.hypot(p.dx, p.dy) - (p.rot ? 0 : 6); // prefer ends that already face the jack
      if (Math.hypot(p.dx, p.dy) < 28 && (!best || d < best.d)) best = { d, p, ox: p.em ? p.dx : -p.dx, oy: p.em ? p.dy : -p.dy };
    }
    if (best && best.p.rot) {
      // turn the coupler around the end that's being plugged in, then measure again
      const v = best.p.e.v, b = v.block, j0 = best.p.e;
      b.rot = (((b.rot || 0) + best.p.rot) % 360 + 360) % 360;
      if (!b.rot) delete b.rot;
      v.render();
      const j1 = v.jack(j0.j.key);
      v.setPosition(Math.round(j0.x - j1.x), Math.round(j0.y - j1.y));
      this.drawCables();
      return this.coupleSnap(moved, false);
    }
    return best;
  }
  // couplers always draw above pedals so their plugs look pushed into the jacks
  raiseCouplers() {
    for (const v of this.views.values()) if (v.def.coupler) this.layerNodes.appendChild(v.g);
  }
  // after a move: link ends that touch a jack, unlink ones that were pulled apart
  coupleLinks(moved) {
    let changed = false;
    const views = this.views;
    const aligned = (c) => {
      const a = views.get(c.from.node), b = views.get(c.to.node);
      if (!a || !b) return false;
      const ja = a.jack('o' + c.from.port), jb = b.jack('i' + c.to.port);
      if (!ja || !jb) return false;
      const male = ja.male ? { v: a, j: ja } : { v: b, j: jb }, fem = ja.male ? { v: b, j: jb } : { v: a, j: ja };
      const n = SIDE_N[fem.j.side] || [0, 0];
      return Math.hypot(fem.v.block.x + fem.j.x + n[0] * SEAT - (male.v.block.x + male.j.x), fem.v.block.y + fem.j.y + n[1] * SEAT - (male.v.block.y + male.j.y)) < 1.5;
    };
    const keep = state.preset.cables.filter((c) => !c.direct || (!moved.has(c.from.node) && !moved.has(c.to.node)) || aligned(c));
    if (keep.length !== state.preset.cables.length) { state.preset.cables = keep; changed = true; }
    for (const p of this.couplePairs(moved)) {
      if (p.rot || p.e.busy || p.k.busy || Math.hypot(p.dx, p.dy) > 1.5) continue;
      const out = p.e.j.key[0] === 'o' ? p.e : p.k, inn = out === p.e ? p.k : p.e;
      state.preset.cables.push({ id: 'cd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), from: { node: out.v.block.id, port: +out.j.key.slice(1) }, to: { node: inn.v.block.id, port: +inn.j.key.slice(1) }, color: '#2d3436', direct: true });
      p.e.busy = p.k.busy = true;
      changed = true;
    }
    if (!changed) return;
    for (const v of this.views.values()) if (v.def.coupler) this.rerenderNode(v.block.id);
    this.raiseCouplers();
    this.drawCables();
    bus.emit('cables');
    import('./state.js').then((m) => m.syncGraph());
  }
  // after blocks were rotated or moved by code: snap and relink couplers
  coupleAfterMove(ids) {
    const moved = new Set(ids);
    const hit = this.coupleSnap(moved);
    if (hit) for (const id of ids) { const v = this.views.get(id); if (v) v.setPosition(v.block.x + hit.ox, v.block.y + hit.oy); }
    this.coupleLinks(moved);
  }
  addNear(type) {
    // find a free spot near the centre of the view so the new block doesn't land on top of another
    const r = this.board.getBoundingClientRect();
    const c = this.toWorld(r.left + r.width / 2, r.top + r.height / 2);
    const b = this.addAt(type, c.x, c.y, true);
    if (!b) return b;
    const v = this.views.get(b.id);
    const rects = [...this.views.values()].filter((o) => o !== v).map((o) => [o.block.x - 30, o.block.y - 40, o.block.x + o.w + 30, o.block.y + o.h + 50]);
    const free = (x, y) => rects.every(([a, bb, cc, d]) => x + v.w < a || x > cc || y + v.h < bb || y > d);
    const x0 = b.x, y0 = b.y;
    for (let ring = 0; ring < 30; ring++) {
      const step = 60;
      for (let k = 0; k < Math.max(1, ring * 8); k++) {
        const ang = (k / Math.max(1, ring * 8)) * Math.PI * 2;
        const x = Math.round((x0 + Math.cos(ang) * ring * step) / 10) * 10, y = Math.round((y0 + Math.sin(ang) * ring * step * 0.7) / 10) * 10;
        if (free(x, y)) {
          v.setPosition(x, y);
          this.drawCables();
          return b;
        }
      }
    }
    return b;
  }

  select(ids, add = false) {
    if (!add) state.selection.clear();
    for (const id of ids) state.selection.add(id);
    state.selectedCable = null;
    bus.emit('selection');
    this.highlightCables();
  }
  highlightCables() {
    for (const [id, e] of this.cableEls) e.g.classList.toggle('selected', state.selectedCable === id);
  }

  hit(e) {
    const t = e.target;
    const ctlEl = t.closest && t.closest('[data-ctl]');
    let jackEl = t.closest && t.closest('[data-jack]');
    const nodeEl = t.closest && t.closest('[data-node]');
    const cableEl = t.closest && t.closest('[data-cable]');
    // zoomed out, a block is one bitmap: find a jack near the pointer so cables can still be started
    if (!jackEl && nodeEl && t.classList && t.classList.contains('lod-img')) {
      const v = this.views.get(nodeEl.dataset.node), w = this.toWorld(e.clientX, e.clientY);
      let best = null;
      for (const j of (v && v.jacks) || []) {
        const d = Math.hypot(v.block.x + j.x - w.x, v.block.y + j.y - w.y);
        if (d < 16 && (!best || d < best.d)) best = { d, key: j.key };
      }
      if (best) jackEl = { dataset: { jack: best.key } };
    }
    return { ctlEl, jackEl, nodeEl, cableEl };
  }

  onDown(e) {
    this.board.focus({ preventScroll: true });
    if (this.drag) this.onUp(e); // left over from a drag that lost its pointerup
    const { ctlEl, jackEl, nodeEl, cableEl } = this.hit(e);
    const w = this.toWorld(e.clientX, e.clientY);
    if (e.button === 1 || (e.button === 0 && this.spaceDown)) return this.startPan(e);
    if (e.button !== 0) return;
    if (jackEl && nodeEl) return this.startCableDrag(e, nodeEl.dataset.node, jackEl.dataset.jack);
    if (ctlEl && nodeEl) return this.startControl(e, nodeEl.dataset.node, ctlEl.dataset.ctl);
    if (nodeEl) {
      const id = nodeEl.dataset.node;
      if (!state.selection.has(id)) this.select([id], e.shiftKey || e.ctrlKey);
      const ids = [...state.selection];
      // a pedalboard takes the pedals sitting on it along
      for (const i of [...ids]) for (const m of this.boardMembers(i)) if (!ids.includes(m)) ids.push(m);
      const starts = ids.map((i) => ({ id: i, x: blockById(i).x, y: blockById(i).y }));
      this.drag = { kind: 'node', sx: w.x, sy: w.y, starts, moved: false, grab: id };
      // raise
      for (const i of ids) {
        const v = this.views.get(i);
        if (v && !v.def.pedalboard) v.layer.appendChild(v.g);
      }
      this.raiseCouplers();
      return;
    }
    if (cableEl) {
      state.selectedCable = cableEl.dataset.cable;
      state.selection.clear();
      bus.emit('selection');
      this.highlightCables();
      return;
    }
    // shift or ctrl + drag on empty board: box select
    if (e.shiftKey || e.ctrlKey) {
      const rect = svg('rect', { class: 'marquee', x: w.x, y: w.y, width: 0, height: 0, rx: 4 }, this.layerDrag);
      this.drag = { kind: 'marquee', sx: w.x, sy: w.y, rect, base: new Set(state.selection) };
      return;
    }
    // empty board: pan and deselect
    if (state.selection.size || state.selectedCable) {
      state.selection.clear();
      state.selectedCable = null;
      bus.emit('selection');
      this.highlightCables();
    }
    this.startPan(e);
  }
  startPan(e) {
    this.drag = { kind: 'pan', sx: e.clientX, sy: e.clientY, vx: this.view.x, vy: this.view.y };
    this.board.classList.add('panning');
  }

  // --- cable dragging
  startCableDrag(e, nodeId, key) {
    const isIn = key[0] === 'i';
    const port = portOf(key);
    let fixed; // the end that stays put
    let existing = null;
    if (isIn) {
      existing = state.preset.cables.find((c) => c.to.node === nodeId && c.to.port === port);
      if (existing) fixed = { node: existing.from.node, key: 'o' + existing.from.port, dir: 'out' };
      else fixed = { node: nodeId, key, dir: 'in' };
    } else {
      if (e.shiftKey) existing = [...state.preset.cables].reverse().find((c) => c.from.node === nodeId && c.from.port === port);
      if (existing) fixed = { node: existing.to.node, key: 'i' + existing.to.port, dir: 'in' };
      else fixed = { node: nodeId, key, dir: 'out' };
    }
    if (existing && existing.direct) { this.drag = null; return; }
    const color = existing ? existing.color : state.cableColor;
    if (existing) {
      const el = this.cableEls.get(existing.id);
      if (el) { el.g.style.opacity = 0.15; el.pg.style.opacity = 0.15; el.sh.style.opacity = 0; }
    }
    this.drag = { kind: 'cable', fixed, existing, color, moved: false };
    this.layerDrag.innerHTML = '';
    this.drag.path = svg('path', { fill: 'none', stroke: color, 'stroke-width': 5.6, 'stroke-linecap': 'round', opacity: 0.95 }, this.layerDrag);
    this.drag.plug = svg('g', {}, this.layerDrag);
    this.updateCableDrag(e);
  }
  updateCableDrag(e) {
    const d = this.drag;
    const w = this.toWorld(e.clientX, e.clientY);
    const a = this.jackGeom(d.fixed.node, d.fixed.key);
    if (!a) return;
    // snap preview to a compatible jack under the cursor
    const target = this.jackUnder(e, d.fixed.dir === 'out' ? 'i' : 'o');
    let b;
    if (target) b = this.jackGeom(target.node, target.key);
    else {
      const dx = w.x - a.x, dy = w.y - a.y;
      const len = Math.hypot(dx, dy) || 1;
      b = { x: w.x, y: w.y, dx: -(dx / len), dy: 0.2, free: true };
    }
    // the loose plug matches the cable (an interface combo jack takes whatever is plugged in)
    const kind = a.kind !== 'any' ? a.kind : b.kind && b.kind !== 'any' ? b.kind : 'inst';
    if (a.kind === 'any') a.kind = kind;
    if (!b.kind || b.kind === 'any') b.kind = kind;
    if (d.pathKind !== kind) {
      d.pathKind = kind;
      d.path.setAttribute('stroke-width', CABLE_WIDTH[kind] || 5.6);
      d.path.setAttribute('stroke-dasharray', kind === 'phones' ? '1.4 1.2' : 'none');
    }
    d.target = target;
    d.path.setAttribute('d', this.cablePath(a, b));
    d.plug.innerHTML = '';
    this.drawPlug(d.plug, a, d.color);
    this.drawPlug(d.plug, b, d.color);
  }
  jackKind(nodeId, key) {
    const v = this.views.get(nodeId);
    const j = v && v.jack(key);
    return (j && j.kind) || jackKindOf(v && v.def, key);
  }
  jackUnder(e, prefix) {
    if (this.drag) this.drag.badKind = null;
    const ok = (node, key) => {
      if (key[0] !== prefix || node === this.drag.fixed.node) return false;
      const fk = this.jackKind(this.drag.fixed.node, this.drag.fixed.key), tk = this.jackKind(node, key);
      // control jacks only take control cables (and audio only audio)
      if ((/^[io]c/.test(key)) !== (/^[io]c/.test(this.drag.fixed.key))) { this.drag.badKind = [fk, tk]; return false; }
      if (!kindsCompatible(fk, tk)) { this.drag.badKind = [fk, tk]; return false; }
      return true;
    };
    const els = document.elementsFromPoint(e.clientX, e.clientY);
    for (const el of els) {
      const j = el.closest && el.closest('[data-jack]');
      const n = el.closest && el.closest('[data-node]');
      if (j && n && ok(n.dataset.node, j.dataset.jack)) return { node: n.dataset.node, key: j.dataset.jack };
      // a block drawn as a bitmap (zoomed out): use the nearest of its jacks
      if (!j && n && el.classList.contains('lod-img')) {
        const v = this.views.get(n.dataset.node), w = this.toWorld(e.clientX, e.clientY);
        let best = null;
        for (const jj of (v && v.jacks) || []) {
          const d = Math.hypot(v.block.x + jj.x - w.x, v.block.y + jj.y - w.y);
          if (d < 18 && (!best || d < best.d) && ok(n.dataset.node, jj.key)) best = { d, key: jj.key };
        }
        if (best) return { node: n.dataset.node, key: best.key };
      }
    }
    return null;
  }
  finishCableDrag() {
    const d = this.drag;
    this.layerDrag.innerHTML = '';
    if (d.target) {
      const tPort = portOf(d.target.key);
      const fPort = portOf(d.fixed.key);
      const from = d.fixed.dir === 'out' ? { node: d.fixed.node, port: fPort } : { node: d.target.node, port: tPort };
      const to = d.fixed.dir === 'out' ? { node: d.target.node, port: tPort } : { node: d.fixed.node, port: fPort };
      if (d.existing) {
        state.preset.cables = state.preset.cables.filter((c) => c.id !== d.existing.id);
      }
      if (wouldCycle(from, to)) toast('That cable makes a feedback loop. It will run with one buffer of delay.', 'warn');
      const c = connect(from, to, d.color);
      if (c) {
        this.flashJack(to.node, 'i' + to.port);
      }
    } else if (d.existing) {
      removeCable(d.existing.id);
      toast('Cable unplugged', 'info', 1400);
    } else {
      if (d.badKind) toast(`A ${KIND_NAMES[d.badKind[0]] || d.badKind[0]} cable doesn't fit a ${KIND_NAMES[d.badKind[1]] || d.badKind[1]} jack. Use a DI box, re-amp box or adapter from Utilities.`, 'warn', 4200);
      this.drawCables();
    }
  }
  flashJack(node, key) {
    const v = this.views.get(node);
    const el = v && v.g.querySelector(`[data-jack="${key}"] .jack-hot`);
    if (!el) return;
    el.style.fill = 'rgba(255,190,90,0.55)';
    setTimeout(() => (el.style.fill = ''), 260);
  }

  // --- controls
  screenLocal(e, v, c) {
    const w = this.toWorld(e.clientX, e.clientY);
    let X = w.x - v.block.x, Y = w.y - v.block.y;
    // undo the block's rotation so taps land in the screen's own coordinates
    const r = v.rot || 0, fw = v.fw ?? v.w, fh = v.fh ?? v.h;
    if (r === 90) [X, Y] = [Y, fh - X];
    else if (r === 180) [X, Y] = [fw - X, fh - Y];
    else if (r === 270) [X, Y] = [fw - Y, X];
    return { x: X - (c.x - c.w / 2), y: Y - (c.y - c.h / 2) };
  }
  screenOf(v, c) {
    return v.screens.find((s) => s.ctl === c);
  }
  startControl(e, nodeId, cid) {
    const v = this.views.get(nodeId);
    const entry = v && v.views.get(cid);
    if (!entry) return;
    const c = entry.ctl;
    if (c.t === 'screen') {
      // interactive screens (like the parametric EQ) handle their own pointer input
      const s = this.screenOf(v, c);
      commitNow();
      this.drag = { kind: 'ctl', node: nodeId, c, view: entry.view, sx: e.clientX, sy: e.clientY, moved: false, screen: s };
      if (s) screenPointer(s, v, 'down', this.screenLocal(e, v, c), e, this);
      return;
    }
    const b = v.block;
    const ui = uiParams(b);
    const alt = state.ui[b.id]?.alt && c.alt;
    const pName = alt ? c.alt : c.p;
    this.drag = { kind: 'ctl', node: nodeId, c, view: entry.view, sx: e.clientX, sy: e.clientY, moved: false, pName, alt };
    commitNow();
    switch (c.t) {
      case 'knob':
      case 'slider':
      case 'treadle':
        this.drag.start = alt ? altPos(pName, ui[pName]) : knobPos(c, ui[pName] ?? c.def ?? 0);
        // XY pad / joystick: its two axis controls move together, horizontal drag = x, vertical = y
        if (c.xy) {
          for (const [, en] of v.views) {
            if (en.ctl !== c && en.ctl.xy === c.xy) {
              const xAxis = /\.x$/.test(c.cid) ? c : en.ctl, yAxis = xAxis === c ? en.ctl : c;
              this.drag.xyAxes = { x: xAxis, y: yAxis, sx: knobPos(xAxis, ui[xAxis.p] ?? xAxis.def ?? 0.5), sy: knobPos(yAxis, ui[yAxis.p] ?? yAxis.def ?? 0.5) };
            }
          }
        }
        this.showTip(e, c, ui[pName]);
        break;
      case 'sel':
        this.drag.start = alt ? altPos(pName, ui[pName]) : ui[pName] ?? c.def ?? 0;
        this.showTip(e, c, ui[pName]);
        break;
      case 'mic':
        this.drag.start = { x: ui[`_m${c.idx}x`] ?? 0.5, y: ui[`_m${c.idx}y`] ?? 0.5 };
        break;
      case 'foot':
        this.footDown(v, c, entry.view);
        break;
      case 'button':
        entry.view.press && entry.view.press(true);
        // momentary (arcade style): on while held
        if (c.momentary && c.p) this.setCtl(v, c, c.p, 1);
        break;
    }
  }
  setCtl(v, c, pName, value) {
    setParam(v.block.id, pName, value, { silent: true });
  }
  dragControl(e) {
    const d = this.drag;
    const v = this.views.get(d.node);
    if (!v) return;
    const c = d.c;
    if (c.t === 'screen') {
      if (Math.abs(e.clientX - d.sx) + Math.abs(e.clientY - d.sy) > 2) d.moved = true;
      if (d.screen) screenPointer(d.screen, v, 'move', this.screenLocal(e, v, c), e, this);
      return;
    }
    const dy = e.clientY - d.sy, dx = e.clientX - d.sx;
    if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
    const fine = e.shiftKey ? 0.2 : 1;
    if (d.xyAxes) {
      const A = d.xyAxes, span = Math.max(40, (A.y.h || A.x.h || 60) * this.view.z);
      const px = clamp(A.sx + (dx / span) * fine, 0, 1), py = clamp(A.sy - (dy / span) * fine, 0, 1);
      this.setCtl(v, A.x, A.x.p, knobValue(A.x, px));
      this.setCtl(v, A.y, A.y.p, knobValue(A.y, py));
      this.tipText(e, `X ${Math.round(px * 100)}%  Y ${Math.round(py * 100)}%`);
      return;
    }
    if (c.t === 'knob' || c.t === 'slider' || c.t === 'treadle' || (c.t === 'sel' && d.alt)) {
      const range = c.t === 'slider' ? (c.h || 46) * this.view.z * 1.6 : c.t === 'treadle' ? (c.h || 220) * this.view.z * 0.7 : 170;
      const raw = d.start - ((c.t === 'slider' && c.orient === 'h' ? -dx : dy) / range) * fine;
      // an endless encoder wraps around instead of stopping at the ends
      const pos = c.endless ? ((raw % 1) + 1) % 1 : clamp(raw, 0, 1);
      const val = d.alt ? altVal(d.pName, pos) : knobValue(c, pos);
      this.setCtl(v, c, d.pName, val);
      this.showTip(e, c, val);
    } else if (c.t === 'sel') {
      const n = c.options.length;
      const idx = clamp(Math.round(d.start - dy / 16), 0, n - 1);
      if (idx !== (uiParams(v.block)[c.p] ?? c.def)) this.setCtl(v, c, c.p, idx);
      this.showTip(e, c, idx);
    } else if (c.t === 'mic') {
      const g = c.geom;
      const x = clamp(d.start.x + dx / (g.gw * this.view.z), 0, 1);
      const y = clamp(d.start.y + dy / (g.gh * this.view.z), 0, 1);
      setParam(v.block.id, `_m${c.idx}x`, x, { silent: true });
      setParam(v.block.id, `_m${c.idx}y`, y, { silent: true });
      const s = micToSpeaker(v.def.cabSize || '4x12', x, y);
      const dist = uiParams(v.block)[`m${c.idx}dist`] ?? 0.15;
      this.tipText(e, `Mic ${c.idx} · speaker ${s.spk + 1} · ${s.pos < 0.15 ? 'dust cap' : s.pos < 0.45 ? 'cap edge' : s.pos <= 1 ? 'cone' : 'off the cone'} · ${(1 + dist * 30).toFixed(0)} cm  (scroll = distance)`);
    }
  }
  endControl(e) {
    const d = this.drag;
    const v = this.views.get(d.node);
    this.hideTip();
    if (!v) return;
    const c = d.c;
    if (c.t === 'screen') {
      if (d.screen) screenPointer(d.screen, v, 'up', this.screenLocal(e, v, c), e, this);
      if (d.moved) markDirty();
      return;
    }
    const b = v.block;
    if (c.t === 'foot') return this.footUp(v, c, d.view);
    // spring-loaded (whammy lever, pressure pad): back to rest on release
    if (c.spring && c.p) setParam(b.id, c.p, c.def ?? 0);
    if (c.momentary && c.p) { d.view.press && d.view.press(false); setParam(b.id, c.p, 0); return; }
    if (d.moved) return markDirty();
    // clicks
    if (c.t === 'sel' && !d.alt) {
      const n = c.options.length;
      const cur = uiParams(b)[c.p] ?? c.def ?? 0;
      setParam(b.id, c.p, (cur + (e.shiftKey ? n - 1 : 1)) % n);
    } else if (c.t === 'toggle') {
      const n = c.options.length;
      const cur = uiParams(b)[c.p] ?? c.def ?? 0;
      setParam(b.id, c.p, (cur + 1) % n);
    } else if (c.t === 'button') {
      d.view.press && d.view.press(false);
      this.buttonAction(v, c);
    } else if (c.t === 'treadle' && (v.def.toeSwitch || !v.def.noBypassClick)) {
      setBypass(b.id, !b.bypass);
    } else if (c.t === 'mic') {
      // click selects the mic (the inspector shows it), shift-click cycles the mic model
      const sui = (state.ui[b.id] = state.ui[b.id] || {});
      if (e.shiftKey) {
        const cur = uiParams(b)[`m${c.idx}type`] ?? 0;
        setParam(b.id, `m${c.idx}type`, ((cur | 0) + 1) % MIC_TYPES.length);
        toast(`Mic ${c.idx}: ${MIC_TYPES[((cur | 0) + 1) % MIC_TYPES.length]}`, 'info', 1300);
      } else {
        sui.selMic = c.idx;
        this.select([b.id]);
        v.updateControls();
        bus.emit('selection');
      }
    }
  }
  // output-selector pedals: each footswitch picks an output pair (or toggles it in additive mode)
  selectFoot(v, c) {
    const b = v.block;
    const ui = uiParams(b);
    if ((ui.mode ?? 0) > 0.5) setParam(b.id, 'mask', ((ui.mask ?? 1) ^ (1 << c.idx)) || (1 << c.idx));
    else setParam(b.id, 'sel', c.idx);
  }
  buttonAction(v, c) {
    const b = v.block;
    const ui = uiParams(b);
    const sui = (state.ui[b.id] = state.ui[b.id] || {});
    if (c.toggle && c.p) setParam(b.id, c.p, ui[c.p] ? 0 : 1);
    else if (c.event) {
      let arg = c.event.arg;
      window.tz.engine.send({ cmd: 'event', id: b.id, type: c.event.type, value: c.event.value ?? 0, arg: arg | 0 });
      if (c.event.type === 6) sui.current = arg;
    } else if (c.action === 'alt') {
      sui.alt = !sui.alt;
      v.updateControls();
      toast(sui.alt ? 'ALT: knobs now control GAIN / MID / BASS / TREBLE / CH VOL' : 'ALT off', 'info', 1600);
    } else if (c.cycle) {
      const cyc = {
        tunerRange: ['range', 3, ['GUITAR', 'BASS / ERG', 'AUTO']],
        tunerMode: [null, 0],
        tuning: ['tuning', 12],
        tunerDisplay: [null, 0],
        pattern: ['pattern', 10],
      }[c.cycle];
      if (c.cycle === 'tunerMode') {
        sui.stream = !sui.stream;
        toast(sui.stream ? 'Stream meter' : 'Cent meter', 'info', 1000);
      } else if (c.cycle === 'tunerDisplay') {
        sui.display = sui.display === 'strobe' ? 'needle' : 'strobe';
      } else if (cyc && cyc[0]) {
        const nv = (((ui[cyc[0]] ?? (c.cycle === 'tunerRange' ? 2 : 0)) | 0) + 1) % cyc[1];
        setParam(b.id, cyc[0], nv);
        if (cyc[2]) toast(`Tuner range: ${cyc[2][nv]}`, 'info', 1200);
      }
    }
    v.updateControls();
  }

  // --- footswitches
  // press or release a footswitch from code (MIDI, Helix bindings), same as clicking it
  remoteFoot(blockId, cid, down) {
    const v = this.views.get(blockId);
    const entry = v && v.views.get(cid);
    if (!entry || entry.ctl.t !== 'foot') return false;
    this._remote = this._remote || new Map();
    const key = blockId + '|' + cid;
    const saved = this.drag;
    let dr = this._remote.get(key);
    if (down) { dr = { kind: 'ctl', node: blockId, c: entry.ctl, view: entry.view, remote: true }; this._remote.set(key, dr); }
    else if (!dr) return false;
    this.drag = dr;
    try {
      if (down) this.footDown(v, entry.ctl, entry.view);
      else { this.footUp(v, entry.ctl, entry.view); this._remote.delete(key); }
    } finally {
      this.drag = saved;
    }
    v.updateControls();
    return true;
  }
  // set a knob, slider or treadle from a 0..1 position
  remoteControl(blockId, cid, pos) {
    const v = this.views.get(blockId);
    const entry = v && v.views.get(cid);
    if (!entry || !entry.ctl.p) return false;
    const c = entry.ctl;
    this.setCtl(v, c, c.p, knobValue(c, clamp(pos, 0, 1)));
    return true;
  }
  footDown(v, c, view) {
    view.press(true);
    const hk = hooksFor(v.block.type);
    if (hk && hk.foot && hk.foot(v, c, true)) return;
    if (c.action === 'ctrl') return footCtrl(v.block, c.idx ?? 0, true);
    if (c.action === 'select') return this.selectFoot(v, c);
    if (c.action === 'toggle' && c.p) return setParam(v.block.id, c.p, (uiParams(v.block)[c.p] ?? c.def ?? 0) > 0.5 ? 0 : 1);
    const b = v.block;
    const d = v.def;
    const ui = uiParams(b);
    const sui = (state.ui[b.id] = state.ui[b.id] || {});
    this.drag.footT0 = performance.now();
    this.drag.held = false;
    if (c.action === 'bypass' && d.tapFoot) {
      // BOSS style: hold the pedal ~2 s to enter or leave TEMPO (tap) mode
      this.drag.holdTimer = setTimeout(() => {
        if (!this.drag) return;
        this.drag.held = true;
        sui.tapMode = !sui.tapMode;
        toast(sui.tapMode ? 'TEMPO mode: tap the pedal (hold again to exit)' : 'TEMPO mode off', 'info', 1800);
      }, 1500);
    } else if (c.hold || c.holdAuto) {
      this.drag.holdTimer = setTimeout(() => {
        this.drag && (this.drag.held = true);
        if (c.hold?.event) sendEvent(b, c.hold.event, sui);
        if (c.hold?.action === 'tapMode') toast('Tap mode', 'info', 900);
        if (c.holdAuto) this.autoSweep(b, c.holdAuto, true);
      }, c.hold?.ms ?? 700);
    }
    const momentary = (d.momentaryWhen && d.momentaryWhen(ui)) || (d.holdWhen && d.holdWhen(ui));
    if (c.action === 'bypass') {
      if (momentary) {
        this.drag.momentary = true;
        this.drag.wasBypass = b.bypass;
        setBypass(b.id, !b.bypass);
        if (d.holdWhen && d.holdWhen(ui)) window.tz.engine.send({ cmd: 'event', id: b.id, type: 2, value: 1, arg: 0 });
      }
    } else if (c.action === 'tap' || d.tapFoot) {
      // handled on release so a hold can be detected
    }
  }
  footUp(v, c, view) {
    view.press(false);
    const hk = hooksFor(v.block.type);
    if (hk && hk.foot && hk.foot(v, c, false)) return;
    if (c.action === 'ctrl') return footCtrl(v.block, c.idx ?? 0, false);
    if (c.action === 'select' || c.action === 'toggle') return;
    const dr = this.drag;
    clearTimeout(dr.holdTimer);
    const b = v.block;
    const d = v.def;
    const ui = uiParams(b);
    const sui = (state.ui[b.id] = state.ui[b.id] || {});
    if (dr.held) {
      if (c.hold?.release) sendEvent(b, c.hold.release, sui);
      if (c.holdAuto) this.autoSweep(b, c.holdAuto, false);
      return;
    }
    if (dr.momentary) {
      setBypass(b.id, dr.wasBypass);
      if (d.holdWhen && d.holdWhen(ui)) window.tz.engine.send({ cmd: 'event', id: b.id, type: 2, value: 0, arg: 0 });
      return;
    }
    switch (c.action) {
      case 'bypass':
        if (d.tapFoot && sui.tapMode) {
          window.tz.engine.send({ cmd: 'event', id: b.id, type: 1, value: 0, arg: 0 });
          const now = performance.now();
          const dt = now - (sui.lastTap || 0);
          sui.lastTap = now;
          if (dt > 80 && dt < 3000 && d.controls.find((x) => x.p === 'time' && !x.virtual)) setParam(b.id, 'time', dt, { silent: true });
          break;
        }
        setBypass(b.id, !b.bypass);
        break;
      case 'param':
        setParam(b.id, c.p, ui[c.p] > 0.5 ? 0 : 1);
        break;
      case 'tap': {
        // tapSub: route the tap to sub-block i of a chain (arg = i * 100)
        window.tz.engine.send({ cmd: 'event', id: b.id, type: 1, value: 0, arg: (c.tapSub ?? d.tapSub ?? 0) * 100 });
        // copy tap tempo into the UI param so knobs follow (tapHz: target is a rate in Hz, like tremolo speed)
        const now = performance.now();
        const dt = now - (sui.lastTap || 0);
        sui.lastTap = now;
        const target = c.tapTarget || d.tapTarget || 'time';
        if (dt > 80 && dt < 3000 && (c.tapHz || d.tapHz)) {
          const dctl = d.controls.find((x) => x.p === target);
          const hz = (1000 / dt) * (c.tapMul || d.tapMul || 1);
          setParam(b.id, target, dctl ? clamp(hz, dctl.min ?? 0.05, dctl.max ?? 20) : hz);
        } else if (dt > 80 && dt < 3000) {
          const dctl = d.controls.find((x) => x.p === target);
          if (dctl && !dctl.virtual) setParam(b.id, target, clamp(dt, dctl.min ?? 10, dctl.max ?? 3000), { silent: true });
          else if (!dctl) setParam(b.id, target, dt, { silent: true });
        }
        break;
      }
      case 'event':
        sendEvent(b, c.event, sui);
        break;
      case 'trackSelect':
        sui.current = ((sui.current ?? 0) + 1) % (d.loopTracks || 2);
        window.tz.engine.send({ cmd: 'event', id: b.id, type: 6, value: 0, arg: sui.current });
        break;
      case 'layerToggle':
        sui.layer = sui.layer ? 0 : 1;
        break;
      case 'favorite':
        this.favorite(v, performance.now() - dr.footT0 > 900);
        break;
    }
    v.updateControls();
  }
  favorite(v, save) {
    const b = v.block;
    const sui = (state.ui[b.id] = state.ui[b.id] || {});
    if (save || !b.params._fav) {
      commitNow();
      b.params._fav = JSON.stringify(Object.fromEntries(Object.entries(b.params).filter(([k]) => k !== '_fav')));
      toast('Favorite saved', 'ok', 1200);
      sui.favActive = true;
    } else if (sui.favActive) {
      if (sui.favBackup) Object.assign(b.params, JSON.parse(sui.favBackup));
      sui.favActive = false;
    } else {
      sui.favBackup = JSON.stringify(Object.fromEntries(Object.entries(b.params).filter(([k]) => k !== '_fav')));
      Object.assign(b.params, JSON.parse(b.params._fav));
      sui.favActive = true;
    }
    import('./state.js').then((m) => m.sendParamsFor(b));
    v.updateControls();
  }
  autoSweep(b, cfg, on) {
    const ui = uiParams(b);
    if (on) {
      this._sweepBase = ui[cfg.p];
      const t0 = performance.now();
      const run = () => {
        if (!this._sweeping) return;
        const t = ((performance.now() - t0) / cfg.ms) % 2;
        const x = t < 1 ? t : 2 - t;
        setParam(b.id, cfg.p, cfg.from + (cfg.to - cfg.from) * x, { silent: true });
        requestAnimationFrame(run);
      };
      this._sweeping = true;
      run();
    } else {
      this._sweeping = false;
      setParam(b.id, cfg.p, this._sweepBase, { silent: true });
    }
  }

  // --- tooltip
  showTip(e, c, v) {
    let s;
    if (c.t === 'sel') s = c.options[v | 0] ?? '';
    else if (c.display) s = c.display(v, c);
    else if (c.unit) s = (v >= 1000 && c.unit === 'Hz' ? (v / 1000).toFixed(2) + ' k' : v >= 100 ? v.toFixed(0) : v.toFixed(1)) + ' ' + c.unit;
    else s = (((v - (c.min ?? 0)) / ((c.max ?? 1) - (c.min ?? 0))) * 10).toFixed(1);
    this.tip.innerHTML = `<small>${c.altLabel && this.drag?.alt ? c.altLabel : c.label || c.p}</small>${s}`;
    this.tip.style.left = e.clientX + 'px';
    this.tip.style.top = e.clientY + 'px';
    this.tip.classList.add('show');
    this._tipAt = performance.now();
  }
  tipText(e, s) {
    this.tip.textContent = s;
    this.tip.style.left = e.clientX + 'px';
    this.tip.style.top = e.clientY + 'px';
    this.tip.classList.add('show');
    this._tipAt = performance.now();
  }
  hideTip() {
    this._tipAt = 0;
    this.tip.classList.remove('show');
  }

  onMove(e) {
    const d = this.drag;
    if (!d) return;
    // no button held any more: the pointerup went somewhere else, so finish the drag here
    if (e.buttons === 0 && e.pointerType === 'mouse') return this.onUp(e);
    if (d.kind === 'pan') {
      this.view.x = d.vx + (e.clientX - d.sx);
      this.view.y = d.vy + (e.clientY - d.sy);
      this.applyView(true);
    } else if (d.kind === 'node') {
      const w = this.toWorld(e.clientX, e.clientY);
      const dx = w.x - d.sx, dy = w.y - d.sy;
      if (!d.moved && Math.hypot(dx, dy) < 2) return;
      if (!d.moved) commitNow();
      d.moved = true;
      // snap the grabbed block to the grid and move the rest by the same amount, so a group keeps its spacing
      const snap = state.settings.snap !== false ? 10 : 1;
      const s0 = d.starts.find((s) => s.id === d.grab) || d.starts[0];
      const sdx = Math.round((s0.x + dx) / snap) * snap - s0.x, sdy = Math.round((s0.y + dy) / snap) * snap - s0.y;
      for (const s of d.starts) {
        const v = this.views.get(s.id);
        if (v) v.setPosition(s.x + sdx, s.y + sdy);
      }
      // couplers: pull the dragged blocks onto a nearby open plug end
      const hit = this.coupleSnap(new Set(d.starts.map((s) => s.id)));
      if (hit) for (const s of d.starts) { const v = this.views.get(s.id); if (v) v.setPosition(v.block.x + hit.ox, v.block.y + hit.oy); }
      this.updateCablesFor(d.starts.map((s) => s.id));
    } else if (d.kind === 'cable') {
      d.moved = true;
      this.updateCableDrag(e);
    } else if (d.kind === 'ctl') this.dragControl(e);
    else if (d.kind === 'marquee') {
      const w = this.toWorld(e.clientX, e.clientY);
      const x0 = Math.min(d.sx, w.x), y0 = Math.min(d.sy, w.y), x1 = Math.max(d.sx, w.x), y1 = Math.max(d.sy, w.y);
      d.rect.setAttribute('x', x0); d.rect.setAttribute('y', y0);
      d.rect.setAttribute('width', x1 - x0); d.rect.setAttribute('height', y1 - y0);
      const sel = new Set(d.base);
      for (const [id, v] of this.views) {
        if (id.startsWith('__')) continue;
        const b = v.block;
        if (b.x < x1 && b.x + v.w > x0 && b.y < y1 && b.y + v.h > y0) sel.add(id);
      }
      if (sel.size !== state.selection.size || [...sel].some((i) => !state.selection.has(i))) {
        state.selection = sel;
        this.views.forEach((v) => v.updateSelection());
      }
    }
  }
  onUp(e) {
    const d = this.drag;
    if (!d) return;
    // always end the drag, even if finishing it throws: a stuck drag blocks every later click
    this.drag = null;
    this.board.classList.remove('panning');
    try {
      if (d.kind === 'cable') { this.drag = d; this.finishCableDrag(); }
      else if (d.kind === 'ctl') { this.drag = d; this.endControl(e); }
      else if (d.kind === 'node' && d.moved) {
        this.boardSnap(d.starts.map((s) => s.id), d.grab);
        this.coupleLinks(new Set(d.starts.map((s) => s.id)));
        markDirty();
      } else if (d.kind === 'marquee') {
        d.rect.remove();
        bus.emit('selection');
      }
    } catch (err) {
      console.error('drag end failed', err);
      if (d.rect) d.rect.remove();
      this.layerDrag.innerHTML = '';
    } finally {
      this.drag = null;
    }
  }
  onWheel(e) {
    e.preventDefault();
    const { ctlEl, nodeEl } = this.hit(e);
    if (ctlEl && nodeEl && !e.ctrlKey) {
      const v = this.views.get(nodeEl.dataset.node);
      const entry = v && v.views.get(ctlEl.dataset.ctl);
      if (entry) {
        const c = entry.ctl;
        const ui = uiParams(v.block);
        const dir = e.deltaY < 0 ? 1 : -1;
        if (c.t === 'screen') {
          const sc = this.screenOf(v, c);
          if (sc) screenPointer(sc, v, 'wheel', this.screenLocal(e, v, c), e, this);
          return;
        }
        if (c.t === 'mic') {
          const k = `m${c.idx}dist`;
          const nd = clamp((ui[k] ?? 0.15) - dir * 0.04, 0, 1);
          setParam(v.block.id, k, nd);
          this.tipText(e, `Mic ${c.idx} distance · ${(1 + nd * 30).toFixed(0)} cm`);
          clearTimeout(this._tipT);
          this._tipT = setTimeout(() => this.hideTip(), 700);
          return;
        }
        if (c.t === 'knob' || c.t === 'slider' || c.t === 'treadle') {
          const alt = state.ui[v.block.id]?.alt && c.alt;
          const pName = alt ? c.alt : c.p;
          const pos = clamp((alt ? altPos(pName, ui[pName]) : knobPos(c, ui[pName] ?? c.def ?? 0)) + dir * (e.shiftKey ? 0.005 : 0.025), 0, 1);
          const val = alt ? altVal(pName, pos) : knobValue(c, pos);
          setParam(v.block.id, pName, val);
          this.showTip(e, c, val);
          clearTimeout(this._tipT);
          this._tipT = setTimeout(() => this.hideTip(), 700);
        } else if (c.t === 'sel') {
          const n = c.options.length;
          setParam(v.block.id, c.p, clamp((ui[c.p] ?? c.def ?? 0) + dir, 0, n - 1));
          this.showTip(e, c, clamp((ui[c.p] ?? c.def ?? 0) + dir, 0, n - 1));
          clearTimeout(this._tipT);
          this._tipT = setTimeout(() => this.hideTip(), 700);
        }
        return;
      }
    }
    const f = Math.pow(1.0015, -e.deltaY * (e.deltaMode === 1 ? 30 : 1));
    this.zoomAt(e.clientX, e.clientY, f);
  }
  onDbl(e) {
    const { ctlEl, nodeEl } = this.hit(e);
    if (ctlEl && nodeEl) {
      const v = this.views.get(nodeEl.dataset.node);
      const entry = v && v.views.get(ctlEl.dataset.ctl);
      if (entry && entry.ctl.t === 'screen') {
        const sc = this.screenOf(v, entry.ctl);
        if (sc) screenPointer(sc, v, 'dbl', this.screenLocal(e, v, entry.ctl), e, this);
        return;
      }
      if (entry && entry.ctl.p && (entry.ctl.t === 'knob' || entry.ctl.t === 'slider')) {
        setParam(v.block.id, entry.ctl.p, entry.ctl.def ?? 0.5);
        toast(`${entry.ctl.label || entry.ctl.p} reset`, 'info', 900);
      }
    } else if (!nodeEl) this.fit();
  }
  onContext(e) {
    e.preventDefault();
    const { nodeEl, cableEl } = this.hit(e);
    if (cableEl) {
      const id = cableEl.dataset.cable;
      state.selectedCable = id;
      this.highlightCables();
      showMenu(e.clientX, e.clientY, [
        { title: 'Cable colour' },
        { swatches: CABLE_COLORS, onPick: (c) => setCableColor(id, c) },
        { sep: true },
        { label: 'Use as default colour', onClick: () => { const c = state.preset.cables.find((x) => x.id === id); if (c) bus.emit('cableColor', c.color); } },
        { label: 'Unplug cable', icon: 'trash', kbd: 'Del', onClick: () => removeCable(id) },
      ]);
      return;
    }
    if (nodeEl) {
      const id = nodeEl.dataset.node;
      if (!state.selection.has(id)) this.select([id]);
      bus.emit('nodeMenu', { id, x: e.clientX, y: e.clientY });
      return;
    }
    const w = this.toWorld(e.clientX, e.clientY);
    showMenu(e.clientX, e.clientY, [
      { label: 'Add block here…', icon: 'plus', onClick: () => bus.emit('quickAdd', w) },
      { label: 'Paste', icon: 'copy', kbd: 'Ctrl+V', onClick: () => bus.emit('paste', w) },
      { sep: true },
      { label: 'Fit board', icon: 'fit', kbd: 'F', onClick: () => this.fit() },
      { label: 'Tidy layout', icon: 'magic', onClick: () => bus.emit('tidy') },
    ]);
  }
  onKey(e) {
    if (e.target !== this.board) return;
    const k = e.key.toLowerCase();
    if (k === ' ') { this.spaceDown = true; e.preventDefault(); window.addEventListener('keyup', (ev) => ev.key === ' ' && (this.spaceDown = false), { once: true }); }
    if (k === 'delete' || k === 'backspace') {
      if (state.selectedCable) removeCable(state.selectedCable);
      else removeBlocks([...state.selection]);
      e.preventDefault();
    } else if (k === 'f') this.fit();
    else if (k === 'd' && (e.ctrlKey || e.metaKey)) {
      const nb = duplicateBlocks([...state.selection]);
      this.select(nb.map((b) => b.id));
      e.preventDefault();
    } else if (k === 'r' && !(e.ctrlKey || e.metaKey)) {
      this.rotateBlocks([...state.selection], e.shiftKey ? -90 : 90);
    } else if (k === 'b') {
      for (const id of state.selection) {
        const b = blockById(id);
        if (b && !b.id.startsWith('__')) setBypass(id, !b.bypass);
      }
    } else if (k === 'a' && (e.ctrlKey || e.metaKey)) {
      this.select(state.preset.blocks.map((b) => b.id));
      e.preventDefault();
    } else if (k === 'escape') {
      state.selection.clear();
      state.selectedCable = null;
      bus.emit('selection');
      this.highlightCables();
    } else if (k.startsWith('arrow') && state.selection.size) {
      commitNow();
      const step = e.shiftKey ? 50 : 10;
      const dx = k === 'arrowleft' ? -step : k === 'arrowright' ? step : 0;
      const dy = k === 'arrowup' ? -step : k === 'arrowdown' ? step : 0;
      for (const id of state.selection) {
        const v = this.views.get(id);
        if (v) v.setPosition(v.block.x + dx, v.block.y + dy);
      }
      this.updateCablesFor([...state.selection]);
      e.preventDefault();
    }
  }

  // ------------------------------------------------------------ animation loop for LEDs and screens
  frame() {
    const now = performance.now();
    if (this._tipAt && now - this._tipAt > 1500 && !(this.drag && this.drag.kind === 'ctl')) this.hideTip();
    if (this.onTick) this.onTick(now);
    this._tickN = (this._tickN || 0) + 1;
    // plugin hooks (ramps, timers…) run for every block, on or off screen, on any tab
    for (const v of this.views.values()) {
      const hk = hooksFor(v.block.type);
      if (hk && hk.status) try { hk.status(v, now); } catch (e) { if (!v._hkErr) { v._hkErr = 1; console.error('status hook', v.block.type, e); } }
    }
    if (document.hidden || !this.boardView.classList.contains('active')) return;
    // only blocks in view animate, and less often when zoomed far out, since every changed pixel
    // of a big zoomed-out board costs a large SVG repaint
    const { x, y, z } = this.view;
    if (!this._vr || now - this._vrT > 250) {
      this._vrT = now;
      this._vr = this.board.getBoundingClientRect();
    }
    const r = this._vr;
    const wx0 = -x / z, wy0 = -y / z, wx1 = (r.width - x) / z, wy1 = (r.height - y) / z;
    // one pass over all visible blocks so the repaints land in one frame
    const every = z < 0.35 ? 3 : z < 0.55 ? 2 : 1;
    if (this._tickN % every) return;
    for (const v of this.views.values()) {
      const b = v.block;
      if (v.lodOn) continue; // shown as a bitmap, nothing to animate
      if (b.x > wx1 || b.y > wy1 || b.x + (v.w || 200) < wx0 || b.y + (v.h || 200) < wy0) continue;
      v.updateStatus(now);
    }
    // refresh stale bitmaps now and then (a knob or bypass changed)
    if (now - (this._lodCheckT || 0) > 700 && (this.lodWanted() || (this.views.size >= 12 && this.view.z < 0.6))) {
      this._lodCheckT = now;
      const sc = this.lodScale();
      for (const v of this.views.values()) if (!v.lodReady(sc)) this._lodQueue.add(v);
      this.pumpLOD();
    }
  }
}

// jack key -> cable port: audio ports are numbers, control ports strings like "c0"
export function portOf(key) {
  const s = key.slice(1);
  return s[0] === 'c' ? s : parseInt(s, 10);
}

function sendEvent(b, ev, sui) {
  let arg = ev.arg ?? 0;
  if (arg === 'current') arg = sui.current ?? 0;
  else if (typeof arg === 'string' && arg.startsWith('layer+')) {
    arg = (sui.layer ?? 0) * 3 + parseInt(arg.slice(6), 10);
    sui.current = arg;
  }
  window.tz.engine.send({ cmd: 'event', id: b.id, type: ev.type, value: ev.value ?? 0, arg: arg | 0 });
}

// ALT-mode params on the multi-FX map 0..1 except channel volume (dB)
function altPos(p, v) {
  if (p === 'amp.level') return clamp(((v ?? 0) + 30) / 42, 0, 1);
  return clamp(v ?? 0.5, 0, 1);
}
function altVal(p, pos) {
  if (p === 'amp.level') return -30 + pos * 42;
  return pos;
}

const SIDE_N = { left: [-1, 0], right: [1, 0], top: [0, -1], bottom: [0, 1] };
const angOf = (n) => (Math.atan2(n[1], n[0]) * 180) / Math.PI;
const SEAT = 3; // a plug end pushed in stops against the jack's nut, 3 units out

function zOrder(b) {
  const d = getDef(b.type);
  if (!d) return 0;
  if (d.baseForm === 'cab') return 0;
  if (d.baseForm === 'amp') return 1;
  if (d.form === 'io') return 3;
  if (d.coupler) return 4;
  return 2;
}

function wouldCycle(from, to) {
  // does `to` already reach `from`? (a pedal's effects loop SEND -> ... -> its own RETURN is fine: state.js)
  return cableMakesLoop(from, to);
}

export { engineParamsFor };

// Cable look per type: 1/4" glossy, XLR thick matte rubber, headphone thin and coiled, control cables dotted.
function cableBody(g, d, col, kind, cw) {
  const path = (o) => svg('path', Object.assign({ d, fill: 'none', 'stroke-linecap': 'round' }, o), g);
  if (kind === 'xlr') {
    path({ stroke: shade(col, -0.65), 'stroke-width': cw + 2 });
    path({ stroke: shade(col, -0.2), 'stroke-width': cw, class: 'cable-main' });
    path({ stroke: shade(col, 0.3), 'stroke-width': cw * 0.22, opacity: 0.3, transform: 'translate(-0.6,-1.8)', 'pointer-events': 'none' });
    return;
  }
  if (kind === 'phones') {
    path({ stroke: shade(col, -0.6), 'stroke-width': cw + 1.4 });
    path({ stroke: col, 'stroke-width': cw, class: 'cable-main' });
    // coil ridges
    path({ stroke: shade(col, -0.45), 'stroke-width': cw, 'stroke-dasharray': '1.1 1.5', 'pointer-events': 'none' });
    path({ stroke: shade(col, 0.6), 'stroke-width': 0.8, opacity: 0.45, transform: 'translate(-0.4,-0.9)', 'pointer-events': 'none' });
    return;
  }
  path({ stroke: shade(col, -0.6), 'stroke-width': cw + 1.8 });
  path({ stroke: col, 'stroke-width': cw, class: 'cable-main' });
  path({ stroke: shade(col, 0.55), 'stroke-width': Math.max(0.8, cw * 0.25), opacity: 0.55, transform: 'translate(-0.6,-1.4)', 'pointer-events': 'none' });
}
