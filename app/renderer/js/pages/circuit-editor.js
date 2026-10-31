// The circuit editor: a large pop-up over the pedal canvas and wiring diagram. Drag parts in from the palette,
// drag from port to port to wire them, select, move, copy, undo, and listen to the circuit on its own.
// Drawn on a canvas (circuit-render.js), so big circuits stay smooth.
import { el, clamp, toast } from '../util.js';
import { PARTS, GROUPS, STAGES, CLIPS, COMP_TYPES, LIM, newNode, nid, clone, portsOf, canWire, validate, graphCat, graphCost, val, emptyGraph, migrateGraph, isRaw } from './circuit-parts.js';
import { layout, portPos, drawGraph, themeColors, bounds, fmtParam, HEAD, showsAll, legendSVG } from './circuit-render.js';
import { EDITOR_TEMPLATES } from './circuit-templates.js';
import { allCats } from './circuit-library.js';

const GRID = 16;
let clipboard = null;
let current = null;
export const editorOpen = () => !!current;
export const currentEditor = () => current;

/**
 * Open the editor. o: { host, rec: {id?, name, desc, tags, cat, graph, builtin?}, title, onSave(rec, {asNew}) -> Promise<rec>,
 * onClose(), test: { start(graph, name), update(graph), stop(), running() } }
 */
export function openCircuitEditor(o) {
  if (current) current.close(true);
  const E = new Editor(o);
  current = E;
  return E;
}

class Editor {
  constructor(o) {
    this.o = o;
    this.rec = clone(o.rec || { name: '', desc: '', tags: [], graph: emptyGraph() });
    if (!this.rec.graph) this.rec.graph = emptyGraph();
    this.G = this.rec.graph;
    if (!this.G.wires) this.G.wires = [];
    migrateGraph(this.G);
    this.sel = new Set();
    this.selW = new Set();
    this.view = { x: 40, y: 40, z: 1 };
    this.hist = [];
    this.hi = -1;
    this.snap = true;
    this.L = null;
    this.issues = [];
    this.dirty = false;
    this.build();
    this.commit(true);
    requestAnimationFrame(() => {
      this.resize();
      this.fit();
    });
  }
  // ---------------------------------------------------------------- DOM
  build() {
    const o = this.o;
    const root = (this.root = el('div', { class: 'cz-modal', tabindex: '-1' }, o.host));
    const bar = el('div', { class: 'cz-bar' }, root);
    el('i', { class: 'ic fz-ic-chip cz-logo' }, bar);
    this.nameIn = el('input', { type: 'text', class: 'cz-name', maxlength: 48, placeholder: 'Circuit name', 'data-cz': 'name' }, bar);
    this.nameIn.value = this.rec.name || '';
    this.nameIn.oninput = () => {
      this.rec.name = this.nameIn.value;
      this.dirty = true;
    };
    if (this.rec.builtin) el('span', { class: 'cz-badge', title: 'Saving makes your own copy in the library' }, bar).textContent = 'Built in';
    const tb = el('button', { class: 'btn small', 'data-cz': 'templates', title: 'Start from a template' }, bar, '<i class="ic ic-board"></i>Templates');
    tb.onclick = (e) => this.templatesMenu(e.currentTarget);
    el('i', { class: 'fz-sep' }, bar);
    this.undoB = el('button', { class: 'icon-btn', title: 'Undo (Ctrl+Z)', 'data-cz': 'undo', onclick: () => this.undo() }, bar, '<i class="ic ic-undo"></i>');
    this.redoB = el('button', { class: 'icon-btn', title: 'Redo (Ctrl+Shift+Z)', 'data-cz': 'redo', onclick: () => this.redo() }, bar, '<i class="ic ic-redo"></i>');
    el('i', { class: 'fz-sep' }, bar);
    const al = el('div', { class: 'seg fz-seg cz-align' }, bar);
    for (const [k, t, tip] of [['left', 'L', 'Align left'], ['cx', 'C', 'Align centres'], ['top', 'T', 'Align tops'], ['dx', '↔', 'Space across'], ['dy', '↕', 'Space down']])
      el('button', { title: tip, 'data-align': k, onclick: () => this.align(k) }, al).textContent = t;
    this.snapB = el('button', { class: 'icon-btn on', title: 'Snap to grid', 'data-cz': 'snap' }, bar, '<i class="ic fz-ic-grid"></i>');
    this.snapB.onclick = () => {
      this.snap = !this.snap;
      this.snapB.classList.toggle('on', this.snap);
    };
    el('button', { class: 'icon-btn', title: 'Fit (F)', onclick: () => this.fit() }, bar, '<i class="ic ic-fit"></i>');
    el('div', { class: 'fz-grow' }, bar);
    this.testB = el('button', { class: 'btn small', 'data-cz': 'test', title: 'Play this circuit on its own' }, bar);
    this.testB.onclick = () => this.toggleTest();
    this.saveNewB = el('button', { class: 'btn small', 'data-cz': 'saveas', title: 'Save as a new circuit in your library' }, bar, 'Save as new');
    this.saveNewB.onclick = () => this.save(true);
    this.saveB = el('button', { class: 'btn small btn-accent', 'data-cz': 'save' }, bar, '<i class="ic ic-import"></i>Save');
    this.saveB.onclick = () => this.save(false);
    this.closeB = el('button', { class: 'icon-btn', title: 'Close (Esc)', 'data-cz': 'close' }, bar, '<i class="ic ic-x"></i>');
    this.closeB.onclick = () => this.close();
    const body = el('div', { class: 'cz-body' }, root);
    this.pal = el('aside', { class: 'cz-pal' }, body);
    this.buildPalette();
    const cw = (this.cw = el('div', { class: 'cz-canvaswrap' }, body));
    this.cv = el('canvas', { class: 'cz-canvas' }, cw);
    this.ctx = this.cv.getContext('2d');
    this.status = el('div', { class: 'cz-status' }, cw);
    el('div', { class: 'cz-hint' }, cw).textContent = 'Drag from a port to wire · drag empty space to select · right drag or Space to pan · scroll to zoom';
    el('div', { class: 'sig-legend cz-legend', title: 'What the wires carry', 'data-cz': 'legend' }, cw, legendSVG());
    this.zoomV = el('div', { class: 'cz-zoom' }, cw);
    this.insp = el('aside', { class: 'cz-insp' }, body);
    this.updateTestBtn();
    // events
    this.cv.addEventListener('pointerdown', (e) => this.down(e));
    this.cv.addEventListener('pointermove', (e) => this.hoverMove(e));
    this.cv.addEventListener('dblclick', (e) => this.dbl(e));
    this.cv.addEventListener('wheel', (e) => {
      e.preventDefault();
      const r = this.cv.getBoundingClientRect();
      this.zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top);
    }, { passive: false });
    this.cv.addEventListener('contextmenu', (e) => e.preventDefault());
    root.addEventListener('keydown', (e) => this.key(e));
    root.addEventListener('keyup', (e) => {
      if (e.key === ' ') this.space = false;
    });
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(cw);
    this.colors = themeColors(root);
    root.focus();
  }
  buildPalette() {
    const p = this.pal;
    const s = el('input', { type: 'text', class: 'cz-search', placeholder: 'Find a part', 'data-cz': 'find' }, p);
    const list = el('div', { class: 'cz-pal-list' }, p);
    const paint = () => {
      list.textContent = '';
      const q = s.value.trim().toLowerCase();
      for (const [g, gname] of GROUPS) {
        const items = Object.entries(PARTS).filter(([k, pt]) => pt.group === g && (!q || (pt.name + ' ' + (pt.desc || '') + ' ' + k).toLowerCase().includes(q)));
        if (!items.length) continue;
        const sec = el('div', { class: 'cz-pal-group cat-' + (g === 'route' || g === 'ctl' || g === 'logic' || g === 'io' ? 'io' : g) }, list);
        el('h6', {}, sec).textContent = gname;
        for (const [k, pt] of items) {
          const t = el('div', { class: 'cz-part', 'data-part-type': k, title: (pt.desc || pt.name) + ' (click to add, or drag in)' }, sec);
          el('i', { class: 'cz-part-dot g-' + g }, t);
          el('span', {}, t).textContent = pt.name;
          t.addEventListener('pointerdown', (e) => this.paletteDrag(e, k, t));
        }
      }
    };
    s.oninput = paint;
    paint();
  }
  // ---------------------------------------------------------------- geometry
  resize() {
    const r = this.cw.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.W = Math.max(50, r.width);
    this.H = Math.max(50, r.height);
    this.cv.width = Math.round(this.W * dpr);
    this.cv.height = Math.round(this.H * dpr);
    this.cv.style.width = this.W + 'px';
    this.cv.style.height = this.H + 'px';
    this.draw();
  }
  toWorld(e) {
    const r = this.cv.getBoundingClientRect();
    return { x: (e.clientX - r.left - this.view.x) / this.view.z, y: (e.clientY - r.top - this.view.y) / this.view.z };
  }
  toScreen(p) {
    const r = this.cv.getBoundingClientRect();
    return { x: r.left + this.view.x + p.x * this.view.z, y: r.top + this.view.y + p.y * this.view.z };
  }
  lay() {
    if (!this.L || this.L.expandAll !== !!this.expandAll) {
      this.L = layout(this.G, { expandAll: this.expandAll });
      this.L.expandAll = !!this.expandAll;
    }
    return this.L;
  }
  invalidate() {
    this.L = null;
    this.draw();
  }
  fit() {
    const b = bounds(this.G, this.lay());
    const pad = 50;
    const z = clamp(Math.min((this.W - pad * 2) / (b.x1 - b.x0 || 1), (this.H - pad * 2) / (b.y1 - b.y0 || 1)), this.fitMin ?? 0.45, 1.3);
    this.fitMin = 0.2;
    this.view = { z, x: (this.W - (b.x1 - b.x0) * z) / 2 - b.x0 * z, y: (this.H - (b.y1 - b.y0) * z) / 2 - b.y0 * z };
    this.draw();
  }
  zoomAt(f, cx, cy) {
    const z = clamp(this.view.z * f, 0.15, 3);
    const px = (cx - this.view.x) / this.view.z, py = (cy - this.view.y) / this.view.z;
    this.view = { z, x: cx - px * z, y: cy - py * z };
    this.draw();
  }
  draw() {
    if (this.raf) return;
    this.raf = requestAnimationFrame(() => {
      this.raf = 0;
      if (!this.cv.isConnected) return;
      const dpr = window.devicePixelRatio || 1;
      const ctx = this.ctx;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const issueMap = new Map();
      const bad = new Set();
      for (const i of this.issues) {
        if (i.node && issueMap.get(i.node) !== 'error') issueMap.set(i.node, i.level);
        for (const w of i.wires || []) bad.add(w);
      }
      const t0 = performance.now();
      drawGraph(ctx, this.G, { L: this.lay(), view: this.view, w: this.W, h: this.H, sel: this.sel, selWires: this.selW, hover: this.hover, issues: issueMap, badWires: bad, drag: this.wireDrag, dragKind: this.wireDrag && this.wireDrag.kind, marquee: this.marquee, colors: this.colors, grid: true, expandAll: this.expandAll });
      this.lastDraw = performance.now() - t0;
      this.zoomV.textContent = Math.round(this.view.z * 100) + '%';
    });
  }
  // what is under a point (world coords)
  hit(p) {
    const L = this.lay();
    const z = this.view.z;
    const pr = Math.max(7, 9 / z);
    let best = null;
    // ports first (they sit on node edges)
    for (const n of this.G.nodes) {
      const b = L.get(n.id);
      if (!b || p.x < b.x - pr || p.x > b.x + b.w + pr || p.y < b.y - pr || p.y > b.y + b.h + pr) continue;
      for (const q of b.ins) if (Math.abs(q.x - p.x) < pr && Math.abs(q.y - p.y) < pr * 0.75) best = { type: 'port', node: n.id, port: q.k, out: false, kind: q.kind, sig: q.sig };
      for (const q of b.outs) if (Math.abs(q.x - p.x) < pr && Math.abs(q.y - p.y) < pr * 0.75) best = { type: 'port', node: n.id, port: q.k, out: true, kind: q.kind, sig: q.sig };
    }
    if (best) return best;
    for (let i = this.G.nodes.length - 1; i >= 0; i--) {
      const n = this.G.nodes[i];
      const b = L.get(n.id);
      if (b && !b.note && p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) return { type: 'node', node: n.id, head: p.y < b.y + HEAD, fold: p.y < b.y + HEAD && p.x > b.x + b.w - 20 };
    }
    // wires
    const tol = 6 / z;
    for (const w of this.G.wires) {
      const a = portPos(L, w.a, true), b = portPos(L, w.b, false);
      if (!a || !b) continue;
      if (p.x < Math.min(a.x, b.x) - 40 || p.x > Math.max(a.x, b.x) + 40 || p.y < Math.min(a.y, b.y) - 20 || p.y > Math.max(a.y, b.y) + 20) continue;
      const dx = Math.max(30, Math.abs(b.x - a.x) * 0.45);
      for (let k = 0; k <= 24; k++) {
        const t = k / 24, u = 1 - t;
        const x = u * u * u * a.x + 3 * u * u * t * (a.x + dx) + 3 * u * t * t * (b.x - dx) + t * t * t * b.x;
        const y = u * u * u * a.y + 3 * u * u * t * a.y + 3 * u * t * t * b.y + t * t * t * b.y;
        if (Math.abs(x - p.x) < tol && Math.abs(y - p.y) < tol) return { type: 'wire', wire: w.id };
      }
    }
    for (let i = this.G.nodes.length - 1; i >= 0; i--) {
      const n = this.G.nodes[i];
      const b = L.get(n.id);
      if (b && b.note && p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) return { type: 'node', node: n.id, note: true };
    }
    return null;
  }
  /** Screen position of a port (tests and tools). */
  portXY(nodeId, key, out) {
    const p = portPos(this.lay(), { n: nodeId, p: key }, out);
    return p ? this.toScreen(p) : null;
  }
  nodeXY(nodeId) {
    const b = this.lay().get(nodeId);
    return b ? this.toScreen({ x: b.x + b.w / 2, y: b.y + HEAD / 2 }) : null;
  }
  // ---------------------------------------------------------------- history
  commit(first) {
    const s = JSON.stringify(this.G);
    if (this.hist[this.hi] === s) return this.after();
    this.hist.length = this.hi + 1;
    this.hist.push(s);
    if (this.hist.length > 200) this.hist.shift();
    this.hi = this.hist.length - 1;
    if (!first) this.dirty = true;
    this.after();
  }
  after() {
    this.issues = validate(this.G);
    this.L = null;
    for (const id of [...this.sel]) if (!this.G.nodes.some((n) => n.id === id)) this.sel.delete(id);
    for (const id of [...this.selW]) if (!this.G.wires.some((w) => w.id === id)) this.selW.delete(id);
    this.undoB.disabled = this.hi <= 0;
    this.redoB.disabled = this.hi >= this.hist.length - 1;
    this.paintStatus();
    this.paintInsp();
    this.draw();
    if (this.testing()) {
      clearTimeout(this.testT);
      this.testT = setTimeout(() => this.o.test.update(this.G, this.rec.name), 150);
    }
  }
  restore(i) {
    this.hi = i;
    this.G = this.rec.graph = JSON.parse(this.hist[i]);
    this.dirty = true;
    this.after();
  }
  undo() {
    if (this.hi > 0) this.restore(this.hi - 1);
  }
  redo() {
    if (this.hi < this.hist.length - 1) this.restore(this.hi + 1);
  }
  // ---------------------------------------------------------------- edits
  node(id) {
    return this.G.nodes.find((n) => n.id === id);
  }
  addPart(type, at) {
    const pt = PARTS[type];
    if (!pt) return null;
    const c = at || { x: (this.W / 2 - this.view.x) / this.view.z - 70, y: (this.H / 2 - this.view.y) / this.view.z - 30 };
    const s = (v) => (this.snap ? Math.round(v / GRID) * GRID : Math.round(v));
    const n = newNode(type, s(c.x), s(c.y));
    if (pt.io === 'ctl' || pt.io === 'cout') n.name = this.freeName(n.name || 'Value');
    if (pt.io === 'in' && this.G.nodes.some((x) => PARTS[x.t]?.io === 'in')) n.name = 'IN ' + (this.G.nodes.filter((x) => PARTS[x.t]?.io === 'in').length + 1);
    if (pt.io === 'out' && this.G.nodes.some((x) => PARTS[x.t]?.io === 'out')) n.name = 'OUT ' + (this.G.nodes.filter((x) => PARTS[x.t]?.io === 'out').length + 1);
    this.G.nodes.push(n);
    this.sel = new Set([n.id]);
    this.selW.clear();
    this.commit();
    return n;
  }
  freeName(base) {
    const names = new Set(this.G.nodes.map((n) => (n.name || '').toLowerCase()));
    if (!names.has(base.toLowerCase())) return base;
    for (let i = 2; ; i++) if (!names.has((base + ' ' + i).toLowerCase())) return base + ' ' + i;
  }
  addWire(a, b, o = {}) {
    if (!canWire(this.G, a, b)) return null;
    const w = { id: nid('w'), a, b, ...o };
    this.G.wires.push(w);
    return w;
  }
  removeSel() {
    if (!this.sel.size && !this.selW.size) return;
    this.G.wires = this.G.wires.filter((w) => !this.selW.has(w.id) && !this.sel.has(w.a.n) && !this.sel.has(w.b.n));
    this.G.nodes = this.G.nodes.filter((n) => !this.sel.has(n.id));
    this.sel.clear();
    this.selW.clear();
    this.commit();
  }
  copy() {
    if (!this.sel.size) return false;
    const nodes = this.G.nodes.filter((n) => this.sel.has(n.id));
    const wires = this.G.wires.filter((w) => this.sel.has(w.a.n) && this.sel.has(w.b.n));
    clipboard = clone({ nodes, wires });
    return true;
  }
  paste(dx = 32, dy = 32) {
    if (!clipboard) return;
    const map = new Map();
    const nodes = clone(clipboard.nodes).map((n) => {
      const id = nid();
      map.set(n.id, id);
      if (PARTS[n.t]?.io === 'ctl' || PARTS[n.t]?.io === 'cout') n.name = this.freeName(n.name || 'Value');
      return Object.assign(n, { id, x: n.x + dx, y: n.y + dy });
    });
    const wires = clone(clipboard.wires).map((w) => ({ ...w, id: nid('w'), a: { ...w.a, n: map.get(w.a.n) }, b: { ...w.b, n: map.get(w.b.n) } }));
    this.G.nodes.push(...nodes);
    this.G.wires.push(...wires);
    this.sel = new Set(nodes.map((n) => n.id));
    this.selW.clear();
    clipboard = { nodes: nodes.map((n) => ({ ...n })), wires };
    this.commit();
  }
  align(how) {
    const ns = this.G.nodes.filter((n) => this.sel.has(n.id));
    if (ns.length < 2) return;
    const L = this.lay();
    const cx = (n) => n.x + L.get(n.id).w / 2;
    if (how === 'left') ns.forEach((n) => (n.x = Math.min(...ns.map((m) => m.x))));
    else if (how === 'top') ns.forEach((n) => (n.y = Math.min(...ns.map((m) => m.y))));
    else if (how === 'cx') {
      const c = ns.reduce((a, n) => a + cx(n), 0) / ns.length;
      ns.forEach((n) => (n.x = Math.round(c - L.get(n.id).w / 2)));
    } else if (how === 'dx' || how === 'dy') {
      const k = how === 'dx' ? 'x' : 'y';
      const s = ns.slice().sort((a, b) => a[k] - b[k]);
      const a = s[0][k], b = s[s.length - 1][k];
      s.forEach((n, i) => (n[k] = Math.round(a + ((b - a) * i) / (s.length - 1))));
    }
    this.commit();
  }
  // ---------------------------------------------------------------- pointer
  down(e) {
    this.root.focus();
    const p = this.toWorld(e);
    if (e.button === 1 || e.button === 2 || (e.button === 0 && this.space)) return this.pan(e);
    if (e.button !== 0) return;
    const h = this.hit(p);
    const add = e.shiftKey || e.ctrlKey || e.metaKey;
    if (h && h.type === 'port') return this.startWire(e, h);
    if (h && h.type === 'node') {
      if (h.fold && STAGES[this.node(h.node).t]) {
        const n = this.node(h.node);
        n.open = !showsAll(n);
        this.commit();
        return;
      }
      if (add) {
        if (this.sel.has(h.node)) this.sel.delete(h.node);
        else this.sel.add(h.node);
      } else if (!this.sel.has(h.node)) {
        this.sel = new Set([h.node]);
        this.selW.clear();
      }
      this.paintInsp();
      this.draw();
      if (this.sel.has(h.node)) this.move(e, p);
      return;
    }
    if (h && h.type === 'wire') {
      if (add) this.selW.has(h.wire) ? this.selW.delete(h.wire) : this.selW.add(h.wire);
      else {
        this.selW = new Set([h.wire]);
        this.sel.clear();
      }
      this.paintInsp();
      this.draw();
      return;
    }
    this.marqueeSel(e, p, add);
  }
  capture(e, mv, up) {
    this.cv.setPointerCapture(e.pointerId);
    const m = (ev) => mv(ev);
    const u = (ev) => {
      this.cv.removeEventListener('pointermove', m);
      this.cv.removeEventListener('pointerup', u);
      this.cv.removeEventListener('pointercancel', u);
      up && up(ev);
    };
    this.cv.addEventListener('pointermove', m);
    this.cv.addEventListener('pointerup', u);
    this.cv.addEventListener('pointercancel', u);
  }
  pan(e) {
    e.preventDefault();
    const v0 = { ...this.view }, sx = e.clientX, sy = e.clientY;
    this.cw.classList.add('panning');
    this.capture(e, (ev) => {
      this.view = { ...v0, x: v0.x + ev.clientX - sx, y: v0.y + ev.clientY - sy };
      this.draw();
    }, () => this.cw.classList.remove('panning'));
  }
  move(e, p0) {
    const ns = this.G.nodes.filter((n) => this.sel.has(n.id));
    const start = ns.map((n) => [n, n.x, n.y]);
    let moved = false;
    this.capture(e, (ev) => {
      const p = this.toWorld(ev);
      let dx = p.x - p0.x, dy = p.y - p0.y;
      if (!moved && Math.hypot(dx, dy) * this.view.z < 3) return;
      moved = true;
      if (this.snap && !ev.altKey) {
        const lead = start[0];
        dx = Math.round((lead[1] + dx) / GRID) * GRID - lead[1];
        dy = Math.round((lead[2] + dy) / GRID) * GRID - lead[2];
      }
      for (const [n, x, y] of start) {
        n.x = Math.round(x + dx);
        n.y = Math.round(y + dy);
      }
      this.L = null;
      this.draw();
    }, () => moved && this.commit());
  }
  marqueeSel(e, p0, add) {
    const base = add ? new Set(this.sel) : new Set();
    this.marquee = { x0: p0.x, y0: p0.y, x1: p0.x, y1: p0.y };
    let moved = false;
    this.capture(e, (ev) => {
      const p = this.toWorld(ev);
      Object.assign(this.marquee, { x1: p.x, y1: p.y });
      moved = true;
      const m = this.marquee, x0 = Math.min(m.x0, m.x1), x1 = Math.max(m.x0, m.x1), y0 = Math.min(m.y0, m.y1), y1 = Math.max(m.y0, m.y1);
      const L = this.lay();
      this.sel = new Set(base);
      for (const n of this.G.nodes) {
        const b = L.get(n.id);
        if (b && b.x + b.w > x0 && b.x < x1 && b.y + b.h > y0 && b.y < y1) this.sel.add(n.id);
      }
      this.draw();
    }, () => {
      this.marquee = null;
      if (!moved && !add) {
        this.sel.clear();
        this.selW.clear();
      }
      this.paintInsp();
      this.draw();
    });
  }
  startWire(e, h) {
    // grabbing a wired input picks its wire up (to move or drop it), otherwise a new wire starts here
    let fixed = { n: h.node, p: h.port }, fixedOut = h.out;
    let lifted = null;
    if (!h.out && !e.shiftKey) {
      const ws = this.G.wires.filter((w) => w.b.n === h.node && w.b.p === h.port);
      if (ws.length) {
        lifted = ws[ws.length - 1];
        this.G.wires = this.G.wires.filter((w) => w !== lifted);
        fixed = lifted.a;
        fixedOut = true;
      }
    }
    this.expandAll = h.kind === 'c';
    this.L = null;
    const from = () => portPos(this.lay(), fixed, fixedOut);
    const p0 = this.toWorld(e);
    // the drag looks like the signal it carries (the output end's)
    const fp = from();
    const sig = (fixedOut && fp && fp.sig) || h.sig;
    this.wireDrag = { kind: h.kind, sig, a: fp, b: p0 };
    if (!fixedOut) this.wireDrag = { kind: h.kind, sig, a: p0, b: fp };
    this.draw();
    this.capture(e, (ev) => {
      const p = this.toWorld(ev);
      const f = from();
      this.wireDrag = fixedOut ? { kind: h.kind, sig, a: f, b: p } : { kind: h.kind, sig, a: p, b: f };
      this.draw();
    }, (ev) => {
      const p = this.toWorld(ev);
      let t = this.hit(p);
      if (t && t.type === 'node') t = this.portOn(t.node, h.kind, !fixedOut);
      let made = null;
      if (t && t.type === 'port' && t.out !== fixedOut && t.kind === h.kind) {
        const a = fixedOut ? fixed : { n: t.node, p: t.port }, b = fixedOut ? { n: t.node, p: t.port } : fixed;
        const keep = lifted && lifted.b.n === b.n && lifted.b.p === b.p ? { lo: lifted.lo, hi: lifted.hi, log: lifted.log, tab: lifted.tab, xlo: lifted.xlo, xhi: lifted.xhi } : {};
        for (const k of Object.keys(keep)) if (keep[k] === undefined) delete keep[k];
        made = this.addWire(a, b, keep);
      }
      this.wireDrag = null;
      this.expandAll = false;
      if (made) {
        this.selW = new Set([made.id]);
        this.sel.clear();
      }
      if (made || lifted) this.commit();
      else this.invalidate();
    });
  }
  // dropping a wire on a node: the first free port of the right kind
  portOn(nodeId, kind, out) {
    const n = this.node(nodeId);
    if (!n) return null;
    const ps = portsOf(n)[out ? 'outs' : 'ins'].filter((q) => q.kind === kind);
    const free = ps.find((q) => out || !this.G.wires.some((w) => w.b.n === nodeId && w.b.p === q.k)) || ps[0];
    return free ? { type: 'port', node: nodeId, port: free.k, out, kind } : null;
  }
  hoverMove(e) {
    if (this.wireDrag || this.marquee) return;
    const h = this.hit(this.toWorld(e));
    const hv = h ? { node: h.node, wire: h.wire, port: h.port } : null;
    if (JSON.stringify(hv) !== JSON.stringify(this.hover)) {
      this.hover = hv;
      this.cv.style.cursor = h && h.type === 'port' ? 'crosshair' : h && (h.type === 'node' || h.type === 'wire') ? 'pointer' : '';
      this.draw();
    }
  }
  dbl(e) {
    const h = this.hit(this.toWorld(e));
    if (h && h.type === 'node' && STAGES[this.node(h.node).t]) {
      const n = this.node(h.node);
      n.open = !showsAll(n);
      this.commit();
    } else if (!h) this.fit();
  }
  paletteDrag(e, type, tile) {
    if (e.button !== 0) return;
    e.preventDefault();
    const sx = e.clientX, sy = e.clientY;
    let ghost = null;
    const doc = this.root.ownerDocument;
    const over = (ev) => {
      const r = this.cv.getBoundingClientRect();
      return ev.clientX > r.left && ev.clientX < r.right && ev.clientY > r.top && ev.clientY < r.bottom;
    };
    const mv = (ev) => {
      if (!ghost && Math.hypot(ev.clientX - sx, ev.clientY - sy) > 4) {
        ghost = el('div', { class: 'cz-ghost' }, doc.body);
        ghost.textContent = PARTS[type].name;
      }
      if (ghost) {
        ghost.style.transform = `translate(${ev.clientX + 8}px,${ev.clientY + 8}px)`;
        ghost.classList.toggle('over', over(ev));
      }
    };
    const up = (ev) => {
      doc.removeEventListener('pointermove', mv);
      doc.removeEventListener('pointerup', up);
      if (ghost) {
        ghost.remove();
        if (over(ev)) {
          const p = this.toWorld(ev);
          this.addPart(type, { x: p.x - 40, y: p.y - 10 });
        }
      } else this.addPart(type);
    };
    doc.addEventListener('pointermove', mv);
    doc.addEventListener('pointerup', up);
  }
  key(e) {
    const tag = (e.target.tagName || '').toLowerCase();
    const typing = tag === 'input' || tag === 'textarea' || tag === 'select';
    const k = e.key.toLowerCase();
    const mod = e.ctrlKey || e.metaKey;
    e.stopPropagation();
    if (k === 'escape') {
      if (typing) e.target.blur();
      else if (this.sel.size || this.selW.size) {
        this.sel.clear();
        this.selW.clear();
        this.paintInsp();
        this.draw();
      } else this.close();
      e.preventDefault();
      return;
    }
    if (typing) return;
    let handled = true;
    if (k === ' ') this.space = true;
    else if (mod && k === 'z') e.shiftKey ? this.redo() : this.undo();
    else if (mod && k === 'y') this.redo();
    else if (mod && k === 'c') this.copy();
    else if (mod && k === 'x') {
      if (this.copy()) this.removeSel();
    } else if (mod && k === 'v') this.paste();
    else if (mod && k === 'd') {
      if (this.copy()) this.paste(24, 24);
    } else if (mod && k === 'a') {
      this.sel = new Set(this.G.nodes.map((n) => n.id));
      this.paintInsp();
      this.draw();
    } else if (mod && k === 's') this.save(false);
    else if (k === 'delete' || k === 'backspace') this.removeSel();
    else if (k === 'f') this.fit();
    else if (k.startsWith('arrow') && this.sel.size) {
      const d = e.shiftKey ? GRID : this.snap ? GRID : 2;
      for (const n of this.G.nodes)
        if (this.sel.has(n.id)) {
          if (k === 'arrowleft') n.x -= d;
          if (k === 'arrowright') n.x += d;
          if (k === 'arrowup') n.y -= d;
          if (k === 'arrowdown') n.y += d;
        }
      this.commit();
    } else handled = false;
    if (handled) e.preventDefault();
  }
  // ---------------------------------------------------------------- templates
  templatesMenu(btn) {
    if (this.menu) return this.closeMenu();
    const m = (this.menu = el('div', { class: 'cz-menu' }, this.root));
    const r = btn.getBoundingClientRect(), rr = this.root.getBoundingClientRect();
    m.style.left = r.left - rr.left + 'px';
    m.style.top = r.bottom - rr.top + 4 + 'px';
    el('div', { class: 'cz-menu-h' }, m).textContent = 'Replace the canvas with a template (undo brings it back)';
    const blank = el('button', { class: 'cz-menu-i', 'data-tpl': 'blank' }, m);
    el('b', {}, blank).textContent = 'Blank';
    el('small', {}, blank).textContent = 'Just an input and an output';
    blank.onclick = () => this.useTemplate(null);
    for (const t of EDITOR_TEMPLATES) {
      const b = el('button', { class: 'cz-menu-i', 'data-tpl': t.id }, m);
      el('b', {}, b).textContent = t.name;
      el('small', {}, b).textContent = t.desc;
      b.onclick = () => this.useTemplate(t);
    }
    setTimeout(() => {
      this.menuOff = (ev) => !m.contains(ev.target) && ev.target !== btn && this.closeMenu();
      this.root.addEventListener('pointerdown', this.menuOff, true);
    });
  }
  closeMenu() {
    if (this.menu) this.menu.remove();
    this.menu = null;
    if (this.menuOff) this.root.removeEventListener('pointerdown', this.menuOff, true);
  }
  useTemplate(t) {
    this.closeMenu();
    this.G = this.rec.graph = t ? clone(t.graph) : emptyGraph();
    if (t && (!this.rec.name || !this.rec.name.trim())) {
      this.rec.name = t.name;
      this.nameIn.value = t.name;
      if (!this.rec.desc) this.rec.desc = t.desc;
      if (!(this.rec.tags || []).length) this.rec.tags = (t.tags || []).slice();
    }
    this.sel.clear();
    this.selW.clear();
    this.commit();
    this.fit();
  }
  // ---------------------------------------------------------------- testing
  testing() {
    return !!(this.o.test && this.o.test.running && this.o.test.running() && this.testOn);
  }
  toggleTest() {
    if (!this.o.test) return;
    if (this.testOn) {
      this.testOn = false;
      this.o.test.stop();
    } else if (this.issues.some((i) => i.level === 'error')) {
      toast('Fix the problems in red first', 'err', 2200);
      return;
    } else {
      this.testOn = true;
      this.o.test.start(this.G, this.rec.name);
    }
    this.updateTestBtn();
  }
  updateTestBtn() {
    const on = !!this.testOn;
    this.testB.classList.toggle('on', on);
    this.testB.innerHTML = on ? '<i class="ic fz-ic-stop"></i>Stop test' : '<i class="ic fz-ic-play"></i>Test circuit';
  }
  // ---------------------------------------------------------------- save / close
  async save(asNew) {
    if (!this.rec.name || !this.rec.name.trim()) {
      this.nameIn.focus();
      this.nameIn.classList.add('bad');
      toast('Give the circuit a name first', 'err', 2000);
      return null;
    }
    this.nameIn.classList.remove('bad');
    try {
      const saved = await this.o.onSave({ ...this.rec, graph: clone(this.G) }, { asNew: asNew || !!this.rec.builtin });
      if (saved) {
        Object.assign(this.rec, { id: saved.id, ver: saved.ver, builtin: false });
        this.dirty = false;
        this.root.querySelector('.cz-badge')?.remove();
        toast(`Saved "${saved.name}" to your circuits`, 'ok', 2200);
      }
      return saved;
    } catch (e) {
      console.error(e);
      toast('Could not save the circuit: ' + (e.message || e), 'err', 4000);
      return null;
    }
  }
  close(force) {
    if (!force && this.dirty && !this.closeB.classList.contains('sure')) {
      this.closeB.classList.add('sure');
      this.closeB.title = 'Unsaved changes: click again to close without saving';
      toast('Unsaved changes: click close again to throw them away', 'warn', 2400);
      setTimeout(() => this.closeB && this.closeB.classList.remove('sure'), 2600);
      return;
    }
    if (this.testOn && this.o.test) this.o.test.stop();
    this.testOn = false;
    this.closeMenu();
    this.ro.disconnect();
    this.root.remove();
    if (current === this) current = null;
    this.o.onClose && this.o.onClose();
  }
  // ---------------------------------------------------------------- status and inspector
  paintStatus() {
    const s = this.status;
    s.textContent = '';
    const errs = this.issues.filter((i) => i.level === 'error'), warns = this.issues.filter((i) => i.level === 'warn');
    const head = el('div', { class: 'cz-status-h ' + (errs.length ? 'bad' : warns.length ? 'warn' : 'ok') }, s);
    head.textContent = errs.length ? `${errs.length} problem${errs.length > 1 ? 's' : ''}` : warns.length ? `${warns.length} note${warns.length > 1 ? 's' : ''}` : 'Ready to play';
    el('span', {}, head).textContent = ` · ${this.G.nodes.length} parts, ${this.G.wires.length} wires`;
    for (const i of [...errs, ...warns].slice(0, 4)) {
      const r = el('button', { class: 'cz-issue ' + i.level }, s);
      r.textContent = i.msg;
      r.onclick = () => {
        if (i.node) this.sel = new Set([i.node]);
        if (i.wire) this.selW = new Set([i.wire]);
        this.paintInsp();
        this.draw();
      };
    }
  }
  paintInsp() {
    const h = this.insp;
    const sc = h.scrollTop;
    h.textContent = '';
    const ns = this.G.nodes.filter((n) => this.sel.has(n.id));
    const ws = this.G.wires.filter((w) => this.selW.has(w.id));
    if (ns.length === 1 && !ws.length) this.inspNode(h, ns[0]);
    else if (ws.length === 1 && !ns.length) this.inspWire(h, ws[0]);
    else if (ns.length || ws.length) this.inspMulti(h, ns, ws);
    else this.inspCircuit(h);
    h.scrollTop = sc;
  }
  sec(h, title) {
    const s = el('div', { class: 'fz-sec' }, h);
    if (title) el('h5', {}, s).textContent = title;
    return s;
  }
  row(s, label) {
    const r = el('div', { class: 'fz-row' }, s);
    el('label', {}, r).textContent = label;
    return el('div', { class: 'fz-field' }, r);
  }
  slider(s, label, v, min, max, step, set, o = {}) {
    const f = this.row(s, label);
    const r = el('input', { type: 'range', min, max, step }, f);
    r.value = v;
    const n = el('input', { type: 'number', min, max, step, class: 'fz-num' }, f);
    n.value = Math.round(v * 1000) / 1000;
    const paint = () => r.style.setProperty('--p', ((r.value - min) / (max - min || 1)) * 100 + '%');
    paint();
    if (o.disabled) r.disabled = n.disabled = true;
    r.oninput = () => {
      n.value = r.value;
      paint();
      set(+r.value);
      this.dirty = true;
      this.L = null;
      this.draw();
    };
    r.onchange = () => this.commit();
    n.onchange = () => {
      const x = clamp(+n.value || 0, min, max);
      r.value = x;
      paint();
      set(x);
      this.commit();
    };
    return r;
  }
  number(s, label, v, min, max, set, cz) {
    const f = this.row(s, label);
    const n = el('input', { type: 'number', min, max, step: 'any', class: 'fz-num fz-num-wide' }, f);
    if (cz) n.dataset.cz = cz;
    n.value = Math.round(v * 1000) / 1000;
    n.onchange = () => {
      set(clamp(+n.value || 0, min, max));
      this.commit();
    };
    return n;
  }
  select(s, label, opts, cur, set) {
    const f = this.row(s, label);
    const sel = el('select', {}, f);
    for (const [v, t] of opts) el('option', { value: v }, sel).textContent = t;
    sel.value = cur;
    sel.onchange = () => {
      set(sel.value);
      this.commit();
    };
    return sel;
  }
  text(s, label, cur, set, o = {}) {
    const f = this.row(s, label);
    const i = el(o.multi ? 'textarea' : 'input', o.multi ? { rows: 3, class: 'fz-text' } : { type: 'text', class: 'fz-text', maxlength: o.max || 60 }, f);
    i.value = cur || '';
    if (o.placeholder) i.placeholder = o.placeholder;
    if (o.cz) i.dataset.cz = o.cz;
    i.oninput = () => {
      set(i.value);
      this.dirty = true;
      if (o.live) {
        this.L = null;
        this.draw();
      }
    };
    i.onchange = () => (o.graph === false ? null : this.commit());
    return i;
  }
  inspCircuit(h) {
    const head = el('div', { class: 'fz-insp-head' }, h);
    const t = el('div', { class: 'fz-insp-title' }, head);
    el('h3', {}, t).textContent = this.o.title || 'Circuit';
    el('p', {}, t).textContent = 'Name, describe and tag it so you can find it again';
    const s = this.sec(h, 'About');
    this.text(s, 'Description', this.rec.desc, (v) => (this.rec.desc = v), { multi: true, graph: false, cz: 'desc' });
    this.text(s, 'Tags', (this.rec.tags || []).join(', '), (v) => (this.rec.tags = v.split(',').map((x) => x.trim()).filter(Boolean)), { placeholder: 'drive, warm, classic', graph: false, cz: 'tags' });
    const cats = [...new Set(['Drive', 'Fuzz', 'Distortion', 'Dynamics', 'Filter', 'Modulation', 'Delay', 'Reverb', 'Pitch', 'Synth', 'Multi-FX', 'Utility', ...allCats()])];
    const f = this.row(s, 'Category');
    const sel = el('select', { 'data-cz': 'cat' }, f);
    el('option', { value: '' }, sel).textContent = 'Automatic (' + graphCat(this.G) + ')';
    for (const c of cats) el('option', { value: c }, sel).textContent = c;
    sel.value = this.rec.cat || '';
    sel.onchange = () => {
      this.rec.cat = sel.value;
      this.dirty = true;
    };
    const s2 = this.sec(h, 'This circuit');
    const ins = this.G.nodes.filter((n) => PARTS[n.t]?.io === 'ctl');
    el('p', { class: 'fz-note fz-note-top' }, s2).textContent = `${this.G.nodes.length} parts, ${this.G.wires.length} wires, about ${Math.round(graphCost(this.G) * 10) / 10} CPU units.`;
    el('p', { class: 'fz-note' }, s2).textContent = ins.length ? 'Pedal controls can turn: ' + ins.map((n) => n.name).join(', ') + '.' : 'Add an Analog or Binary input so a knob or switch on the pedal can turn something in here.';
    const outs = this.G.nodes.filter((n) => PARTS[n.t]?.io === 'cout');
    if (outs.length) el('p', { class: 'fz-note' }, s2).textContent = 'It puts out: ' + outs.map((n) => n.name).join(', ') + ' (wire them to LEDs, jacks, screens or other circuits in the wiring diagram).';
    const s3 = this.sec(h, 'How to');
    el('p', { class: 'fz-note fz-note-top' }, s3).innerHTML = 'Orange round ports carry <b>audio</b>. Teal diamonds carry <b>analog</b> values (from -255 to 255), amber squares carry <b>binary</b> on / off signals. Every value of a part is an input: drag a wire from an envelope, LFO or input onto it. A part value sweeps its range as the signal goes from 0 to 1 (set another span on the wire); the math and Delay parts take values as they are. Audio can only loop through a <b>Feedback loop</b> part.';
    el('div', { class: 'sig-legend' }, s3, legendSVG());
  }
  inspMulti(h, ns, ws) {
    const head = el('div', { class: 'fz-insp-head' }, h);
    const t = el('div', { class: 'fz-insp-title' }, head);
    el('h3', {}, t).textContent = [ns.length && `${ns.length} parts`, ws.length && `${ws.length} wires`].filter(Boolean).join(', ');
    el('p', {}, t).textContent = 'Move them together, align or delete';
    const acts = el('div', { class: 'fz-acts' }, head);
    el('button', { class: 'icon-btn', title: 'Duplicate (Ctrl+D)', onclick: () => this.copy() && this.paste(24, 24) }, acts, '<i class="ic ic-copy"></i>');
    el('button', { class: 'icon-btn', title: 'Delete (Del)', onclick: () => this.removeSel() }, acts, '<i class="ic ic-trash"></i>');
    if (ns.length > 1) {
      const s = this.sec(h, 'Arrange');
      const ar = el('div', { class: 'fz-align' }, s);
      for (const [k, tt] of [['left', 'Left'], ['cx', 'Centre'], ['top', 'Top'], ['dx', 'Space across'], ['dy', 'Space down']]) el('button', { class: 'btn small', 'data-align': k, onclick: () => this.align(k) }, ar, tt);
    }
  }
  inspNode(h, n) {
    const pt = PARTS[n.t] || { name: n.t, params: [] };
    const head = el('div', { class: 'fz-insp-head' }, h);
    const t = el('div', { class: 'fz-insp-title' }, head);
    el('h3', {}, t).textContent = pt.io && pt.io !== 'note' ? n.name || pt.name : n.label || pt.name;
    el('p', {}, t).textContent = pt.desc || GROUPS.find((g) => g[0] === pt.group)?.[1] || '';
    const acts = el('div', { class: 'fz-acts' }, head);
    el('button', { class: 'icon-btn', title: 'Duplicate (Ctrl+D)', onclick: () => this.copy() && this.paste(24, 24) }, acts, '<i class="ic ic-copy"></i>');
    el('button', { class: 'icon-btn', title: 'Delete (Del)', 'data-cz': 'delnode', onclick: () => this.removeSel() }, acts, '<i class="ic ic-trash"></i>');
    if (pt.io === 'note') {
      const s = this.sec(h, 'Note');
      this.text(s, 'Text', n.text, (v) => (n.text = v), { multi: true, live: true });
      this.slider(s, 'Width', n.w || 160, 80, 600, 8, (v) => (n.w = v));
      this.slider(s, 'Height', n.h || 60, 30, 400, 8, (v) => (n.h = v));
      return;
    }
    if (pt.io === 'in' || pt.io === 'out') {
      const s = this.sec(h, pt.io === 'in' ? 'Audio input' : 'Audio output');
      this.text(s, 'Name', n.name, (v) => (n.name = v.toUpperCase()), { live: true, max: 12 });
      el('p', { class: 'fz-note' }, s).textContent = pt.io === 'in' ? 'In the wiring diagram, wire a jack or another circuit to this input.' : 'In the wiring diagram, wire this to an output jack or into another circuit.';
      return;
    }
    if (pt.io === 'ctl' && n.t === 'binary') {
      const s = this.sec(h, 'Binary input');
      this.text(s, 'Name', n.name, (v) => (n.name = v), { live: true, max: 24, cz: 'knobname' });
      this.text(s, 'Off and on', (n.opts || ['Off', 'On']).slice(0, 2).join(', '), (v) => (n.opts = v.split(',').map((x) => x.trim()).slice(0, 2)), { placeholder: 'Off, On' });
      this.select(s, 'Default', [['0', (n.opts && n.opts[0]) || 'Off'], ['1', (n.opts && n.opts[1]) || 'On']], String(n.def ? 1 : 0), (v) => (n.def = +v));
      el('p', { class: 'fz-note' }, s).textContent = 'An on / off input (0 or 1). On the pedal, wire a footswitch, switch, button, footswitch jack, screen or another circuit to it. With nothing wired it stays at the default.';
      return;
    }
    if (pt.io === 'ctl') {
      const s = this.sec(h, 'Analog input');
      this.text(s, 'Name', n.name, (v) => (n.name = v), { live: true, max: 24, cz: 'knobname' });
      this.select(s, 'Type', [['0', 'Smooth value'], ['3', 'Steps, 3 positions'], ['4', 'Steps, 4'], ['6', 'Steps, 6'], ['8', 'Steps, 8']], String(n.steps >= 2 ? n.steps : 0), (v) => {
        n.steps = +v;
        if (n.steps) n.def = clamp(Math.round(n.def || 0), 0, n.steps - 1);
        else {
          n.min = n.min ?? 0;
          n.max = n.max ?? 1;
          n.def = clamp(n.def ?? 0.5, Math.min(n.min, n.max), Math.max(n.min, n.max));
        }
        this.paintInsp();
      });
      if (n.steps >= 2) {
        this.text(s, 'Positions', (n.opts || []).slice(0, n.steps).join(', '), (v) => (n.opts = v.split(',').map((x) => x.trim())), { placeholder: 'Low, Mid, High' });
        this.select(s, 'Default', [...Array(n.steps)].map((_, i) => [String(i), (n.opts && n.opts[i]) || 'Position ' + (i + 1)]), String(n.def | 0), (v) => (n.def = +v));
      } else {
        const lo = n.min ?? 0, hi = n.max ?? 1;
        this.number(s, 'Lowest', lo, -LIM, LIM, (v) => (n.min = v), 'ctlmin');
        this.number(s, 'Highest', hi, -LIM, LIM, (v) => (n.max = v), 'ctlmax');
        this.slider(s, 'Default', clamp(n.def ?? 0.5, Math.min(lo, hi), Math.max(lo, hi)), Math.min(lo, hi), Math.max(lo, hi), Math.abs(hi - lo) / 200 || 0.01, (v) => (n.def = v));
      }
      el('p', { class: 'fz-note' }, s).textContent = 'A value from -255 to 255. A knob or pedal on the pedal sweeps it from Lowest to Highest. Part values it is wired to sweep their range as it goes from Lowest to Highest; the math parts get the value as it is.';
      return;
    }
    if (pt.io === 'cout') {
      const s = this.sec(h, n.t === 'binout' ? 'Binary output' : 'Analog output');
      this.text(s, 'Name', n.name, (v) => (n.name = v), { live: true, max: 24, cz: 'outname' });
      if (n.t === 'anaout') {
        this.number(s, 'Lowest', n.min ?? 0, -LIM, LIM, (v) => (n.min = v), 'outmin');
        this.number(s, 'Highest', n.max ?? 1, -LIM, LIM, (v) => (n.max = v), 'outmax');
        el('p', { class: 'fz-note' }, s).textContent = 'Wire a value into it. An LED wired to it is dark at Lowest and full at Highest; an EXP jack goes heel to toe over the same span.';
      } else el('p', { class: 'fz-note' }, s).textContent = 'Wire an on / off signal into it (on above 0.5). An LED wired to it lights when it is on; a footswitch jack presses.';
      el('p', { class: 'fz-note' }, s).textContent += ' Wire it up in the wiring diagram under the pedal.';
      return;
    }
    const s = this.sec(h, 'Part');
    if (STAGES[n.t] || pt.group === 'script') this.text(s, 'Label', n.label || '', (v) => (n.label = v), { live: true, placeholder: pt.name, max: 30 });
    if (STAGES[n.t]?.algo === 'drive') this.select(s, 'Clipping', CLIPS, n.voice || STAGES[n.t].opts.clip, (v) => (n.voice = v));
    if (STAGES[n.t]?.algo === 'comp') this.select(s, 'Type', COMP_TYPES, n.voice || 'ota', (v) => (n.voice = v));
    if (STAGES[n.t]) {
      const f = this.row(s, 'Show values');
      const l = el('label', { class: 'switch' }, f);
      const cb = el('input', { type: 'checkbox' }, l);
      cb.checked = showsAll(n);
      el('span', {}, l);
      cb.onchange = () => {
        n.open = cb.checked;
        this.commit();
      };
    }
    const s2 = this.sec(h, 'Values');
    for (const p of pt.params) {
      const w = this.G.wires.find((x) => x.b.n === n.id && x.b.p === '@' + p.key);
      if (w) {
        const src = this.node(w.a.n);
        const r = this.row(s2, p.label);
        const b = el('button', { class: 'fz-mapped cz-wired' }, r);
        b.textContent = 'Set by ' + ((src && (src.name || src.label || PARTS[src.t]?.name)) || 'a wire');
        b.title = 'Select the wire';
        b.onclick = () => {
          this.sel.clear();
          this.selW = new Set([w.id]);
          this.paintInsp();
          this.draw();
        };
        continue;
      }
      const v = val(n, p);
      if (p.opts && p.i) this.select(s2, p.label, p.opts.map((o, k) => [String(p.min + k), o]), String(Math.round(v)), (x) => (n.p[p.key] = +x));
      else this.slider(s2, p.label + (p.unit ? ` (${p.unit})` : ''), v, p.min, p.max, p.i ? 1 : (p.max - p.min) / 200, (x) => (n.p[p.key] = x));
    }
  }
  inspWire(h, w) {
    const na = this.node(w.a.n), nb = this.node(w.b.n);
    const head = el('div', { class: 'fz-insp-head' }, h);
    const t = el('div', { class: 'fz-insp-title' }, head);
    const nm = (n) => (n ? n.name || n.label || PARTS[n.t]?.name : '?');
    const param = nb && w.b.p.startsWith('@') ? PARTS[nb.t].params.find((p) => p.key === w.b.p.slice(1)) : null;
    const srcOut = na && portsOf(na).outs.find((q) => q.k === w.a.p);
    el('h3', {}, t).textContent = !param ? 'Audio wire' : srcOut && srcOut.sig === 'b' ? 'Binary wire' : 'Analog wire';
    el('p', {}, t).textContent = `${nm(na)} to ${nm(nb)}${param ? ': ' + param.label : ''}`;
    const acts = el('div', { class: 'fz-acts' }, head);
    el('button', { class: 'icon-btn', title: 'Delete (Del)', 'data-cz': 'delwire', onclick: () => this.removeSel() }, acts, '<i class="ic ic-trash"></i>');
    if (!param) return;
    if (isRaw(param)) {
      el('p', { class: 'fz-note fz-note-top' }, this.sec(h, 'Value')).textContent = `${param.label} gets the value as it is (from ${fmtParam(param, param.min)} to ${fmtParam(param, param.max)}).`;
      return;
    }
    const s = this.sec(h, 'Range');
    // the span of the signal that sweeps the value: an input's own range, else 0 to 1
    const ownLo = na && PARTS[na.t]?.io === 'ctl' ? (na.t === 'binary' ? 0 : na.steps >= 2 ? 0 : na.min ?? 0) : 0;
    const ownHi = na && PARTS[na.t]?.io === 'ctl' ? (na.t === 'binary' ? 1 : na.steps >= 2 ? na.steps - 1 : na.max ?? 1) : 1;
    const xlo = w.xlo ?? ownLo, xhi = w.xhi ?? ownHi;
    el('p', { class: 'fz-note fz-note-top' }, s).textContent = `As the signal goes from ${+xlo.toFixed(3)} to ${+xhi.toFixed(3)}, ${param.label} goes from:`;
    if (w.tab) {
      el('p', { class: 'fz-note' }, s).textContent = 'Steps through: ' + w.tab.map((v) => fmtParam(param, v)).join(', ');
      el('div', { class: 'fz-actrow' }, s).appendChild(el('button', { class: 'btn small', onclick: () => { delete w.tab; this.commit(); } }, null, 'Use a range instead'));
      return;
    }
    const lo = w.lo ?? param.min, hi = w.hi ?? param.max;
    if (param.opts && param.i) {
      const opts = param.opts.map((o, k) => [String(param.min + k), o]);
      this.select(s, 'From', opts, String(Math.round(lo)), (x) => (w.lo = +x));
      this.select(s, 'To', opts, String(Math.round(hi)), (x) => (w.hi = +x));
    } else {
      const step = param.i ? 1 : (param.max - param.min) / 200;
      this.slider(s, 'From', lo, param.min, param.max, step, (x) => (w.lo = x));
      this.slider(s, 'To', hi, param.min, param.max, step, (x) => (w.hi = x));
      if (param.min > 0 || lo > 0) {
        const f = this.row(s, 'Log sweep');
        const l = el('label', { class: 'switch' }, f);
        const cb = el('input', { type: 'checkbox' }, l);
        cb.checked = w.log ?? !!param.l;
        el('span', {}, l);
        cb.onchange = () => {
          w.log = cb.checked;
          this.commit();
        };
      }
    }
    el('div', { class: 'fz-actrow' }, s).appendChild(el('button', { class: 'btn small', onclick: () => { delete w.lo; delete w.hi; delete w.log; this.commit(); } }, null, 'Full range'));
    const s2 = this.sec(h, 'Signal span');
    this.number(s2, 'Signal from', xlo, -LIM, LIM, (v) => (w.xlo = v), 'xlo');
    this.number(s2, 'Signal to', xhi, -LIM, LIM, (v) => (w.xhi = v), 'xhi');
    el('p', { class: 'fz-note' }, s2).textContent = 'Signals below or above the span hold the value at its ends.';
    if (w.xlo != null || w.xhi != null) el('div', { class: 'fz-actrow' }, s2).appendChild(el('button', { class: 'btn small', onclick: () => { delete w.xlo; delete w.xhi; this.commit(); } }, null, 'Default span'));
  }
}
