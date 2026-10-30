// Pedal Factory: the wiring diagram under the pedal canvas. The pedal's controls and jacks on the left, its
// circuits in the middle, the output jacks on the right. Drag from a control or jack to a circuit's input to
// wire it, between circuits to chain audio; click a wire and press Delete to remove it. The panel folds away,
// resizes from its top edge and pops out into its own window.
import { el, svg, clamp } from '../util.js';
import { PARTS, hasTap } from './circuit-parts.js';
import {
  instInputs, instAudioIns, instAudioOuts, instOf, jackList, effectiveWires, mappingsOf, mapTo, targetInfo, addMapping, removeMapping, uid, resolveJack,
} from './factory-circuit.js';

const PREF = 'tz.factory.wd.v1';
const LSget = () => {
  try {
    return JSON.parse(localStorage.getItem(PREF) || 'null') || {};
  } catch (_) {
    return {};
  }
};
const LSset = (v) => {
  try {
    localStorage.setItem(PREF, JSON.stringify(v));
  } catch (_) {
    /* ignore */
  }
};
const COL = 158, ROWH = 22, BOXW = 196, AREA = 230;
const CTL_SKIP = new Set(['led', 'screen']);

/** Mount the panel at the bottom of the factory's middle column. api: see factory-circuits.js. */
export function mountDiagram(mid, api) {
  const P = Object.assign({ h: 0, collapsed: false }, LSget());
  const root = el('div', { class: 'fz-wd' + (P.collapsed ? ' collapsed' : ''), tabindex: '0', 'data-wd': 'panel' }, mid);
  const grip = el('div', { class: 'fz-wd-grip', title: 'Drag to resize, double-click for the default size', 'data-wd': 'grip' }, root);
  const head = el('div', { class: 'fz-wd-head' }, root);
  const fold = el('button', { class: 'icon-btn fz-wd-fold', title: 'Fold away', 'data-wd': 'collapse' }, head, '<i class="ic ic-down"></i>');
  el('b', {}, head).textContent = 'Wiring';
  const info = el('span', { class: 'fz-wd-info' }, head);
  el('div', { class: 'fz-grow' }, head);
  el('button', { class: 'btn small', 'data-wd': 'add', title: 'Pick a circuit to add from the circuit list', onclick: () => api.showList() }, head, '<i class="ic ic-plus"></i>Add circuit');
  el('button', { class: 'btn small', 'data-wd': 'auto', title: 'Wire every circuit in a row, input to output', onclick: () => api.wireInRow() }, head, 'Wire in a row');
  const delB = el('button', { class: 'btn small', 'data-wd': 'delete', title: 'Remove the selected wire (Delete)', onclick: () => delSel() }, head, '<i class="ic ic-trash"></i>');
  el('button', { class: 'icon-btn', title: 'Fit', 'data-wd': 'fit', onclick: () => fitView(true) }, head, '<i class="ic ic-fit"></i>');
  const popB = el('button', { class: 'icon-btn', title: 'Pop out into its own window', 'data-wd': 'pop' }, head, '<i class="ic ic-popout"></i>');
  const body = el('div', { class: 'fz-wd-body' }, root);
  const sv = svg('svg', { class: 'fz-wd-svg' }, body);
  const vg = svg('g', {}, sv);
  const empty = el('div', { class: 'fz-wd-empty' }, body);
  let view = { x: 10, y: 8, z: 1 }, touched = false;
  let selWire = null, hoverKey = null, drag = null, sig = '', raf = 0, geo = null;

  // ---------------------------------------------------------------- size, fold, pop out
  const defaultH = () => Math.round(Math.max(160, (mid.getBoundingClientRect().height || 600) / 3));
  const applySize = () => {
    root.classList.toggle('collapsed', !!P.collapsed);
    if (popped()) root.style.height = '';
    else root.style.height = P.collapsed ? '' : (P.h || defaultH()) + 'px';
    fold.title = P.collapsed ? 'Show the wiring diagram' : 'Fold away';
  };
  const save = () => LSset({ h: P.h, collapsed: P.collapsed });
  fold.onclick = () => {
    P.collapsed = !P.collapsed;
    save();
    applySize();
    refresh(true);
  };
  head.addEventListener('dblclick', (e) => {
    if (e.target.closest('button')) return;
    fold.onclick();
  });
  grip.addEventListener('pointerdown', (e) => {
    if (popped() || P.collapsed) return;
    e.preventDefault();
    grip.setPointerCapture(e.pointerId);
    const sy = e.clientY, h0 = root.getBoundingClientRect().height;
    const max = Math.max(160, mid.getBoundingClientRect().height - 140);
    document.body.classList.add('resizing-panel');
    const mv = (ev) => {
      P.h = Math.round(clamp(h0 - (ev.clientY - sy), 110, max));
      applySize();
    };
    const up = () => {
      grip.removeEventListener('pointermove', mv);
      grip.removeEventListener('pointerup', up);
      document.body.classList.remove('resizing-panel');
      save();
      refresh(true);
    };
    grip.addEventListener('pointermove', mv);
    grip.addEventListener('pointerup', up);
  });
  grip.addEventListener('dblclick', () => {
    P.h = 0;
    save();
    applySize();
  });
  let win = null, holder = null;
  const popped = () => !!win;
  const popIn = () => {
    if (!win) return;
    const w = win;
    win = null;
    root.classList.remove('popped');
    holder.replaceWith(document.adoptNode(root));
    holder = null;
    popB.innerHTML = '<i class="ic ic-popout"></i>';
    popB.title = 'Pop out into its own window';
    try {
      w.close();
    } catch (_) {
      /* already closed */
    }
    applySize();
    refresh(true);
  };
  const popOut = () => {
    const r = root.getBoundingClientRect();
    win = window.open('about:blank', 'tz-panel-wiring', `width=${Math.round(Math.max(700, r.width))},height=${Math.round(Math.max(420, r.height + 60))}`);
    if (!win) return;
    const d = win.document;
    d.open();
    d.write('<!doctype html><html><head><meta charset="utf-8"></head><body class="popout-body fz-wd-window"></body></html>');
    d.close();
    d.title = 'Tone Zone - Wiring';
    for (const n of document.querySelectorAll('link[rel=stylesheet], style')) {
      const c = n.cloneNode(true);
      if (n.href) c.href = n.href;
      d.head.appendChild(c);
    }
    d.documentElement.className = document.documentElement.className;
    for (const a of document.documentElement.getAttributeNames()) if (a.startsWith('data-')) d.documentElement.setAttribute(a, document.documentElement.getAttribute(a));
    holder = document.createComment('wiring');
    root.replaceWith(holder);
    root.classList.add('popped');
    d.body.appendChild(d.adoptNode(root));
    popB.innerHTML = '<i class="ic ic-dock"></i>';
    popB.title = 'Dock back under the pedal';
    win.addEventListener('pagehide', popIn);
    win.addEventListener('beforeunload', popIn);
    win.addEventListener('resize', () => refresh(true));
    applySize();
    refresh(true);
  };
  popB.onclick = () => (win ? popIn() : popOut());
  window.addEventListener('beforeunload', () => win && win.close());

  // ---------------------------------------------------------------- layout
  const ctlName = (c) => api.name(c);
  function build(D) {
    const C = D.circuit;
    const J = jackList(D);
    const ports = new Map(); // key -> {x, y, dir: 'out' | 'in', kind: 'a' | 'c', ...}
    const rows = [];
    let y = 0;
    const group = (t) => {
      rows.push({ title: t, y });
      y += 20;
    };
    const ctls = D.ctls.filter((c) => !CTL_SKIP.has(c.kind) && !c.hidden);
    if (ctls.length) group('Controls');
    for (const c of ctls) {
      const subs = c.kind === 'dip' ? [...Array(c.n || 4)].map((_, i) => [String(i), String(i + 1)]) : c.kind === 'xy' ? [['0', 'X'], ['1', 'Y']] : null;
      const h = subs ? ROWH + Math.ceil(subs.length / 6) * 16 : ROWH;
      const r = { ctl: c, y, h, label: ctlName(c), subs };
      rows.push(r);
      if (subs)
        subs.forEach(([k, l], i) => {
          const px = 20 + (i % 6) * 22, py = y + ROWH - 2 + Math.floor(i / 6) * 16 + 6;
          ports.set('ctl:' + c.id + ':' + k, { x: px, y: py, dir: 'out', kind: 'c', ctl: c, sw: +k, label: l, small: true });
        });
      else ports.set('ctl:' + c.id, { x: COL, y: y + h / 2, dir: 'out', kind: 'c', ctl: c });
      y += h + 4;
    }
    group('Jacks');
    for (const j of J.ins) {
      rows.push({ jack: j, y, h: ROWH, label: (j.label || 'IN') + (j.virtual ? ' (no jack)' : ''), audio: true });
      ports.set('jack:' + j.id, { x: COL, y: y + ROWH / 2, dir: 'out', kind: 'a', jack: j });
      y += ROWH + 4;
    }
    for (const j of J.exps) {
      rows.push({ jack: j, y, h: ROWH, label: (j.label || 'EXP') + ' (expression)' });
      ports.set('jack:' + j.id, { x: COL, y: y + ROWH / 2, dir: 'out', kind: 'c', jack: j });
      y += ROWH + 4;
    }
    const leftH = y;
    // circuits
    const boxes = [];
    let maxR = AREA + BOXW, maxB = 0;
    for (const inst of C.insts) {
      const ains = instAudioIns(inst), aouts = instAudioOuts(inst);
      const kins = [...ains.map((n) => ({ key: 'in:' + inst.id + ':' + n.id, label: n.name || 'IN', kind: 'a' })),
        ...instInputs(inst).map((n) => ({ key: 'k:' + inst.id + ':' + n.id, label: n.name || 'Knob', kind: 'c', to: inst.id + '.' + n.id })),
        { key: 'k:' + inst.id + ':on', label: 'On / off', kind: 'c', to: inst.id + '.on' },
        ...(hasTap(inst.graph) ? [{ key: 'k:' + inst.id + ':tap', label: 'Tap tempo', kind: 'c', to: inst.id + '.tap' }] : [])];
      const kouts = aouts.map((n) => ({ key: 'out:' + inst.id + ':' + n.id, label: n.name || 'OUT', kind: 'a' }));
      const bx = AREA + (inst.x || 0), by = inst.y || 0;
      const h = 28 + Math.max(kins.length, kouts.length, 1) * 18 + 6;
      boxes.push({ inst, x: bx, y: by, w: BOXW, h, kins, kouts });
      kins.forEach((p, i) => ports.set(p.key, { x: bx, y: by + 28 + i * 18 + 9, dir: 'in', kind: p.kind, inst, to: p.to, label: p.label, tapOnly: p.to && p.to.endsWith('.tap') }));
      kouts.forEach((p, i) => ports.set(p.key, { x: bx + BOXW, y: by + 28 + i * 18 + 9, dir: 'out', kind: 'a', inst, label: p.label }));
      maxR = Math.max(maxR, bx + BOXW);
      maxB = Math.max(maxB, by + h);
    }
    const rx = maxR + 110;
    let ry = 20;
    const outRows = [];
    for (const j of J.outs) {
      outRows.push({ jack: j, y: ry, label: (j.label || 'OUT') + (j.virtual ? ' (no jack)' : '') });
      ports.set('jack:' + j.id, { x: rx, y: ry + ROWH / 2, dir: 'in', kind: 'a', jack: j });
      ry += ROWH + 4;
    }
    // wires: audio from the design, control from the mappings
    const wires = [];
    const ekey = (e, out) => {
      if (e.n.startsWith('jack:')) {
        const j = resolveJack(J, e.n.slice(5), out ? 'in' : 'out');
        return j ? 'jack:' + j.id : null;
      }
      return (out ? 'out:' : 'in:') + e.n + ':' + e.p;
    };
    for (const w of effectiveWires(D)) {
      const a = ekey(w.a, true), b = ekey(w.b, false);
      if (ports.has(a) && ports.has(b)) wires.push({ id: w.id, a, b, kind: 'a', auto: !!w.auto, w });
    }
    const inPort = (to) => {
      const dot = to.indexOf('.');
      return 'k:' + to.slice(0, dot) + ':' + to.slice(dot + 1);
    };
    for (const c of ctls) {
      mappingsOf(c).forEach((m, i) => {
        const b = inPort(m.to);
        if (ports.has(b)) wires.push({ id: 'm:' + c.id + ':' + i, a: 'ctl:' + c.id, b, kind: 'c', ctl: c, mi: i });
      });
      if (c.kind === 'dip' || c.kind === 'xy')
        (c.maps || []).forEach((m, i) => {
          if (!m || !m.to) return;
          const b = inPort(m.to);
          if (ports.has(b) && ports.has('ctl:' + c.id + ':' + i)) wires.push({ id: 's:' + c.id + ':' + i, a: 'ctl:' + c.id + ':' + i, b, kind: 'c', ctl: c, sw: i });
        });
    }
    for (const j of J.exps)
      (j.maps || []).forEach((m, i) => {
        const b = inPort(m.to);
        if (ports.has(b)) wires.push({ id: 'x:' + j.id + ':' + i, a: 'jack:' + j.id, b, kind: 'c', jack: j, xi: i });
      });
    return { rows, outRows, boxes, ports, wires, rx, w: rx + COL, h: Math.max(leftH, maxB + 10, ry) };
  }

  // ---------------------------------------------------------------- drawing
  const wpath = (a, b) => {
    const dx = Math.max(40, Math.abs(b.x - a.x) * 0.45);
    return `M${a.x},${a.y}C${a.x + dx},${a.y} ${b.x - dx},${b.y} ${b.x},${b.y}`;
  };
  function render() {
    const D = api.design();
    if (!D || !D.circuit || !D.circuit.insts) return;
    geo = build(D);
    vg.textContent = '';
    const sel = new Set(api.selected());
    const C = D.circuit;
    info.textContent = `${C.insts.length} circuit${C.insts.length === 1 ? '' : 's'} · ${geo.wires.filter((w) => w.kind === 'c').length} control wires`;
    empty.textContent = C.insts.length ? '' : 'No circuits yet: add one from the Circuit list on the left.';
    empty.hidden = !!C.insts.length;
    // left column
    const gl = svg('g', { class: 'fz-wd-left' }, vg);
    for (const r of geo.rows) {
      if (r.title) {
        svg('text', { x: 4, y: r.y + 13, class: 'fz-wd-group' }, gl, r.title.toUpperCase());
        continue;
      }
      const key = r.ctl ? 'ctl:' + r.ctl.id : 'jack:' + r.jack.id;
      const g = svg('g', { class: 'fz-wd-row' + (r.ctl && sel.has(r.ctl.id) ? ' on' : '') + (r.jack ? ' jack' : ''), 'data-wrow': key }, gl);
      svg('rect', { x: 0, y: r.y, width: COL, height: r.h, rx: 6, class: 'fz-wd-rowbg' }, g);
      svg('text', { x: 10, y: r.y + 15, class: 'fz-wd-label' }, g, r.label.length > 22 ? r.label.slice(0, 21) + '...' : r.label);
      if (r.ctl && r.ctl.kind === 'foot' && (!r.ctl.map || r.ctl.map.to === 'bypass')) svg('text', { x: COL - 14, y: r.y + 15, class: 'fz-wd-note', 'text-anchor': 'end' }, g, 'bypass');
      g.addEventListener('click', () => r.ctl ? api.select(r.ctl.id) : r.jack.virtual ? null : api.select(r.jack.id));
    }
    for (const r of geo.outRows) {
      const g = svg('g', { class: 'fz-wd-row jack', 'data-wrow': 'jack:' + r.jack.id }, vg);
      svg('rect', { x: geo.rx, y: r.y, width: COL, height: ROWH, rx: 6, class: 'fz-wd-rowbg' }, g);
      svg('text', { x: geo.rx + 12, y: r.y + 15, class: 'fz-wd-label' }, g, r.label);
      g.addEventListener('click', () => !r.jack.virtual && api.select(r.jack.id));
    }
    if (geo.outRows.length) svg('text', { x: geo.rx + 4, y: 13, class: 'fz-wd-group' }, vg, 'OUTPUTS');
    // wires go under the circuit boxes, so wires passing behind a box do not look plugged into it
    const gw = svg('g', { class: 'fz-wd-wires' }, vg);
    // circuits
    for (const b of geo.boxes) {
      const g = svg('g', { class: 'fz-wd-box' + (b.inst.on === false ? ' off' : ''), 'data-winst': b.inst.id }, vg);
      svg('rect', { x: b.x, y: b.y, width: b.w, height: b.h, rx: 8, class: 'fz-wd-boxbg' }, g);
      const hd = svg('g', { class: 'fz-wd-boxhead', 'data-wdrag': b.inst.id }, g);
      svg('rect', { x: b.x, y: b.y, width: b.w, height: 24, rx: 8, class: 'fz-wd-boxtop' }, hd);
      svg('text', { x: b.x + 10, y: b.y + 16, class: 'fz-wd-title' }, hd, ((n) => (n.length > 21 ? n.slice(0, 20) + '...' : n))(b.inst.name || 'Circuit'));
      const ed = svg('g', { class: 'fz-wd-btn', 'data-wedit': b.inst.id }, g);
      svg('rect', { x: b.x + b.w - 46, y: b.y + 4, width: 18, height: 16, rx: 4 }, ed);
      svg('path', { d: `M${b.x + b.w - 42},${b.y + 16}l1.5-4 6-6 2.5 2.5-6 6z`, class: 'fz-wd-ico' }, ed);
      svg('title', {}, ed, 'Edit this circuit');
      ed.addEventListener('click', (e) => {
        e.stopPropagation();
        api.editInst(b.inst.id);
      });
      const rm = svg('g', { class: 'fz-wd-btn', 'data-wremove': b.inst.id }, g);
      svg('rect', { x: b.x + b.w - 24, y: b.y + 4, width: 18, height: 16, rx: 4 }, rm);
      svg('path', { d: `M${b.x + b.w - 19},${b.y + 8}l8,8M${b.x + b.w - 11},${b.y + 8}l-8,8`, class: 'fz-wd-ico' }, rm);
      svg('title', {}, rm, 'Take this circuit out of the pedal');
      rm.addEventListener('click', (e) => {
        e.stopPropagation();
        api.removeInst(b.inst.id);
      });
      b.kins.forEach((p, i) => svg('text', { x: b.x + 12, y: b.y + 28 + i * 18 + 13, class: 'fz-wd-plabel' + (p.kind === 'c' ? ' c' : '') }, g, p.label.slice(0, 18)));
      b.kouts.forEach((p, i) => svg('text', { x: b.x + b.w - 12, y: b.y + 28 + i * 18 + 13, class: 'fz-wd-plabel', 'text-anchor': 'end' }, g, p.label.slice(0, 14)));
      g.addEventListener('dblclick', () => api.editInst(b.inst.id));
    }
    // wires
    for (const w of geo.wires) {
      const a = geo.ports.get(w.a), b = geo.ports.get(w.b);
      const hot = hoverKey && (hoverKey === w.a || hoverKey === w.b || hoverKey === w.id || (w.ctl && hoverKey === 'ctl:' + w.ctl.id));
      const on = selWire === w.id || (w.ctl && sel.has(w.ctl.id));
      const p = svg('path', { d: wpath(a, b), class: `fz-wd-wire ${w.kind === 'a' ? 'a' : 'c'}${w.auto ? ' auto' : ''}${hot ? ' hot' : ''}${on ? ' on' : ''}`, 'data-ww': w.id, 'data-kind': w.kind }, gw);
      const hitp = svg('path', { d: wpath(a, b), class: 'fz-wd-wirehit', 'data-ww': w.id }, gw);
      for (const q of [p, hitp]) {
        q.addEventListener('pointerenter', () => setHover(w.id));
        q.addEventListener('pointerleave', () => setHover(null));
        q.addEventListener('click', (e) => {
          e.stopPropagation();
          selWire = w.auto ? null : w.id;
          if (w.ctl) api.select(w.ctl.id);
          refresh(true);
          root.focus();
        });
      }
    }
    // ports
    const gp = svg('g', { class: 'fz-wd-ports' }, vg);
    for (const [k, p] of geo.ports) {
      const wired = geo.wires.some((w) => w.a === k || w.b === k);
      const ok = drag ? canDrop(drag.from, k) : true;
      const c = svg(p.kind === 'a' ? 'circle' : 'rect', p.kind === 'a' ? { cx: p.x, cy: p.y, r: 5 } : { x: p.x - 4.5, y: p.y - 4.5, width: 9, height: 9, rx: 1.5, transform: `rotate(45 ${p.x} ${p.y})` }, gp);
      c.setAttribute('class', `fz-wd-port ${p.kind}${wired ? ' wired' : ''}${drag && !ok && drag.from !== k ? ' dim' : ''}${drag && ok && drag.from !== k ? ' ok' : ''}${hoverKey === k ? ' hot' : ''}`);
      c.setAttribute('data-wp', k);
      if (p.small) svg('text', { x: p.x, y: p.y - 7, class: 'fz-wd-sub', 'text-anchor': 'middle' }, gp, p.label);
      c.addEventListener('pointerdown', (e) => startDrag(e, k));
      c.addEventListener('pointerenter', () => setHover(k));
      c.addEventListener('pointerleave', () => setHover(null));
    }
    if (drag && drag.to) svg('path', { d: wpath(drag.dir === 'out' ? drag.p0 : drag.to, drag.dir === 'out' ? drag.to : drag.p0), class: 'fz-wd-wire drag ' + drag.kind }, vg);
    delB.disabled = !selWire;
    applyView();
  }
  function setHover(k) {
    if (hoverKey === k) return;
    hoverKey = k;
    if (!drag) refresh(true);
  }
  const applyView = () => vg.setAttribute('transform', `translate(${view.x.toFixed(1)},${view.y.toFixed(1)}) scale(${view.z.toFixed(3)})`);
  function fitView(force) {
    if (!geo || (touched && !force)) return;
    const r = sv.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const z = clamp(Math.min((r.width - 20) / geo.w, (r.height - 16) / geo.h), 0.35, 1.25);
    view = { z, x: Math.max(8, (r.width - geo.w * z) / 2), y: 8 };
    if (force) touched = false;
    applyView();
  }

  // ---------------------------------------------------------------- wiring by drag
  const toLocal = (e) => {
    const r = sv.getBoundingClientRect();
    return { x: (e.clientX - r.left - view.x) / view.z, y: (e.clientY - r.top - view.y) / view.z };
  };
  function canDrop(from, to) {
    if (!geo || from === to) return false;
    const a = geo.ports.get(from), b = geo.ports.get(to);
    if (!a || !b || a.dir === b.dir || a.kind !== b.kind) return false;
    const src = a.dir === 'out' ? a : b, dst = a.dir === 'out' ? b : a;
    if (dst.tapOnly && !(src.ctl && (src.ctl.kind === 'foot' || src.ctl.kind === 'button') && src.sw == null)) return false;
    if (src.inst && dst.inst && src.inst === dst.inst) return false;
    return true;
  }
  function startDrag(e, k) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const p = geo.ports.get(k);
    drag = { from: k, kind: p.kind, dir: p.dir, p0: { x: p.x, y: p.y }, to: null };
    sv.setPointerCapture(e.pointerId);
    refresh(true);
    const mv = (ev) => {
      drag.to = toLocal(ev);
      // snap onto a port that fits
      const hit = nearest(drag.to, (key) => canDrop(drag.from, key));
      if (hit) drag.to = { x: hit.p.x, y: hit.p.y };
      drag.over = hit ? hit.k : null;
      render();
    };
    const up = (ev) => {
      sv.removeEventListener('pointermove', mv);
      sv.removeEventListener('pointerup', up);
      sv.removeEventListener('pointercancel', up);
      const over = drag.over || (nearest(toLocal(ev), (key) => canDrop(drag.from, key)) || {}).k;
      const from = drag.from;
      drag = null;
      if (over) connect(from, over);
      else refresh(true);
    };
    sv.addEventListener('pointermove', mv);
    sv.addEventListener('pointerup', up);
    sv.addEventListener('pointercancel', up);
  }
  function nearest(pt, ok) {
    let best = null;
    for (const [k, p] of geo.ports) {
      if (!ok(k)) continue;
      const d = Math.hypot(p.x - pt.x, p.y - pt.y);
      if (d < 16 / view.z && (!best || d < best.d)) best = { k, p, d };
    }
    return best;
  }
  /** Wire port key a to port key b (either direction). Returns true when something was wired. */
  function connect(ka, kb) {
    if (!canDrop(ka, kb)) return false;
    const D = api.design();
    const A = geo.ports.get(ka), B = geo.ports.get(kb);
    const src = A.dir === 'out' ? A : B, dst = A.dir === 'out' ? B : A;
    const sk = A.dir === 'out' ? ka : kb, dk = A.dir === 'out' ? kb : ka;
    if (src.kind === 'a') {
      const end = (k) => {
        const [t, ...r] = k.split(':');
        return t === 'jack' ? { n: 'jack:' + r[0], p: '' } : { n: r[0], p: r[1] };
      };
      const a = end(sk), b = end(dk);
      const C = D.circuit;
      if (C.wires.some((w) => w.a.n === a.n && w.a.p === a.p && w.b.n === b.n && w.b.p === b.p)) return false;
      C.wires.push({ id: uid('w'), a, b });
    } else {
      const to = dst.to;
      const info = targetInfo(D.circuit, to);
      if (!info) return false;
      if (src.jack) {
        const j = D.jacks.find((x) => x.id === src.jack.id);
        if ((j.maps || []).some((m) => m.to === to)) return false;
        j.maps = [...(j.maps || []), mapTo(D.circuit, to)];
      } else if (src.sw != null) {
        const c = D.ctls.find((x) => x.id === src.ctl.id);
        const n = c.kind === 'dip' ? c.n || 4 : 2;
        const maps = (c.maps || []).slice();
        while (maps.length < n) maps.push(null);
        maps[src.sw] = c.kind === 'dip' ? mapTo(D.circuit, to, { min: info.i ? info.min : info.def ?? info.min, max: info.max }) : mapTo(D.circuit, to);
        c.maps = maps;
      } else {
        const c = D.ctls.find((x) => x.id === src.ctl.id);
        const n = c.kind === 'toggle' ? c.ways : c.kind === 'sel' ? c.n || 4 : 0;
        const o = n && info.i && info.max - info.min >= 1 ? { max: Math.min(info.max, info.min + n - 1) } : {};
        if (!addMapping(D, c, to, o)) return false;
        api.select(c.id);
      }
    }
    api.commit();
    api.refresh();
    return true;
  }
  function delSel() {
    if (!selWire || !geo) return;
    const w = geo.wires.find((x) => x.id === selWire);
    selWire = null;
    if (!w) return refresh(true);
    removeWire(w);
  }
  function removeWire(w) {
    const D = api.design();
    if (w.kind === 'a') D.circuit.wires = D.circuit.wires.filter((x) => x.id !== w.id);
    else if (w.jack) {
      const j = D.jacks.find((x) => x.id === w.jack.id);
      j.maps = (j.maps || []).filter((_, i) => i !== w.xi);
    } else if (w.sw != null) {
      const c = D.ctls.find((x) => x.id === w.ctl.id);
      const maps = (c.maps || []).slice();
      maps[w.sw] = null;
      c.maps = maps;
    } else removeMapping(D.ctls.find((x) => x.id === w.ctl.id), w.mi);
    api.commit();
    api.refresh();
  }
  root.addEventListener('keydown', (e) => {
    const tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
    if ((e.key === 'Delete' || e.key === 'Backspace') && selWire) {
      e.preventDefault();
      e.stopPropagation();
      delSel();
    } else if (e.key === 'Escape' && selWire) {
      selWire = null;
      refresh(true);
    }
  });
  // moving circuit boxes, panning and zooming the diagram
  sv.addEventListener('pointerdown', (e) => {
    root.focus({ preventScroll: true });
    const hd = e.target.closest('[data-wdrag]');
    if (hd && e.button === 0) {
      const D = api.design();
      const inst = instOf(D.circuit, hd.dataset.wdrag);
      if (!inst) return;
      e.preventDefault();
      sv.setPointerCapture(e.pointerId);
      const p0 = toLocal(e), x0 = inst.x || 0, y0 = inst.y || 0;
      let moved = false;
      const mv = (ev) => {
        const p = toLocal(ev);
        inst.x = Math.round((x0 + p.x - p0.x) / 8) * 8;
        inst.y = Math.round((y0 + p.y - p0.y) / 8) * 8;
        moved = true;
        render();
      };
      const up = () => {
        sv.removeEventListener('pointermove', mv);
        sv.removeEventListener('pointerup', up);
        if (moved) api.commit();
      };
      sv.addEventListener('pointermove', mv);
      sv.addEventListener('pointerup', up);
      return;
    }
    if (e.target.closest('[data-wp], [data-ww], [data-wrow], .fz-wd-btn')) return;
    // empty space: pan
    if (selWire) {
      selWire = null;
      refresh(true);
    }
    const sx = e.clientX, sy = e.clientY, v0 = { ...view };
    sv.setPointerCapture(e.pointerId);
    const mv = (ev) => {
      view = { ...v0, x: v0.x + ev.clientX - sx, y: v0.y + ev.clientY - sy };
      touched = true;
      applyView();
    };
    const up = () => {
      sv.removeEventListener('pointermove', mv);
      sv.removeEventListener('pointerup', up);
    };
    sv.addEventListener('pointermove', mv);
    sv.addEventListener('pointerup', up);
  });
  sv.addEventListener('wheel', (e) => {
    e.preventDefault();
    const r = sv.getBoundingClientRect();
    const cx = e.clientX - r.left, cy = e.clientY - r.top;
    const z = clamp(view.z * Math.exp(-e.deltaY * 0.0015), 0.3, 2.5);
    const px = (cx - view.x) / view.z, py = (cy - view.y) / view.z;
    view = { z, x: cx - px * z, y: cy - py * z };
    touched = true;
    applyView();
  }, { passive: false });

  // ---------------------------------------------------------------- keeping in sync
  function signature() {
    const D = api.design();
    if (!D) return '';
    return JSON.stringify([D.ctls.map((c) => [c.id, c.kind, c.label, c.hidden, c.map, c.more, c.maps, c.n]), D.jacks.map((j) => [j.id, j.kind, j.label, j.maps]), D.circuit && D.circuit.insts && D.circuit.insts.map((i) => [i.id, i.name, i.x, i.y, i.on, i.graph.nodes.filter((n) => PARTS[n.t]?.io).map((n) => [n.id, n.name]), hasTap(i.graph)]), D.circuit && D.circuit.wires, api.selected(), selWire, P.collapsed]);
  }
  function refresh(force) {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      if (P.collapsed && !popped()) return;
      const s = signature();
      if (!force && s === sig) return;
      const first = !sig;
      sig = s;
      render();
      if (first || !touched) fitView();
    });
  }
  new ResizeObserver(() => {
    if (!touched) fitView();
  }).observe(body);
  applySize();
  refresh(true);
  return {
    refresh,
    root,
    connect: (a, b) => {
      if (!geo) render();
      return connect(a, b);
    },
    removeWire: (id) => {
      if (!geo) render();
      const w = geo.wires.find((x) => x.id === id);
      if (w) removeWire(w);
    },
    geo: () => {
      render();
      return geo;
    },
    collapse: (on) => {
      P.collapsed = !!on;
      save();
      applySize();
      refresh(true);
    },
    setHeight: (h) => {
      P.h = h;
      save();
      applySize();
    },
    popOut,
    popIn,
    popped,
    state: () => ({ collapsed: !!P.collapsed, h: root.getBoundingClientRect().height, popped: popped() }),
  };
}
