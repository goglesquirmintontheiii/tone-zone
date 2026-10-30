// Pedal Factory: the wiring diagram under the pedal canvas. The pedal's controls and jacks on the left, its
// circuits (and screens) in the middle, the output jacks, control out jacks and LEDs on the right. Drag from a
// control or jack to a circuit's input to wire it, between circuits to chain audio or control values, from a
// circuit's output to an LED, jack, screen or another circuit; click a wire and press Delete to remove it.
// Controls, jacks and screens also wire straight to LEDs (one input per colour on RGB and bicolour LEDs), OUT
// jacks, screen inputs and other controls (their input on the left of the row), and any source can feed many
// things: drag again from the same port. Circuit and screen boxes move by their title bars.
// Audio ports are circles, analog diamonds and binary squares (wires: thick, thin, dashed). The panel folds away,
// resizes from its top edge and pops out into its own window.
import { el, svg, clamp, toast } from '../util.js';
import { isRef, refKey, ledChans, ledRef, hasChans, drivable, linkCtx, pruneLinks } from './circuit-links.js';
import { PARTS, hasTap } from './circuit-parts.js';
import { legendSVG } from './circuit-render.js';
import {
  instInputs, instAudioIns, instAudioOuts, instOutputs, instOf, jackList, effectiveWires, mappingsOf, mapTo, targetInfo, addMapping, removeMapping, uid, resolveJack,
  nodeSig, ctlJacks, jackIsOut, screenIO, SCREEN_PORTS, loopRole, circuitOutputs,
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
  const legend = el('div', { class: 'sig-legend fz-wd-legend', title: 'What the wires carry', 'data-wd': 'legend' }, body, legendSVG());
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
  // what a control sends: switches and footswitches are binary, knobs and selectors analog
  const ctlSig = (c) => (c.kind === 'foot' || c.kind === 'button' || c.kind === 'dip' || (c.kind === 'toggle' && (c.ways || 2) === 2) ? 'b' : 'n');
  function build(D) {
    const C = D.circuit;
    const J = jackList(D);
    const ports = new Map(); // key -> {x, y, dir: 'out' | 'in', kind: 'a' | 'c', sig: 'a' | 'n' | 'b', ...}
    const rows = [];
    let y = 0;
    const group = (t) => {
      rows.push({ title: t, y });
      y += 20;
    };
    const ctls = D.ctls.filter((c) => !CTL_SKIP.has(c.kind) && !c.hidden);
    if (ctls.length) group('Controls');
    const subRow = (key, subs, base, at) =>
      subs.forEach(([k, l, sig], i) => {
        const px = 20 + (i % 6) * 22, py = at + ROWH - 2 + Math.floor(i / 6) * 16 + 6;
        ports.set(key + ':' + k, { x: px, y: py, dir: 'out', kind: 'c', sig, label: l, small: true, ...base, sw: +k });
      });
    for (const c of ctls) {
      const subs = c.kind === 'dip' ? [...Array(c.n || 4)].map((_, i) => [String(i), String(i + 1), 'b']) : c.kind === 'xy' ? [['0', 'X', 'n'], ['1', 'Y', 'n']] : null;
      const h = subs ? ROWH + Math.ceil(subs.length / 6) * 16 : ROWH;
      rows.push({ ctl: c, y, h, label: ctlName(c), subs });
      if (subs) subRow('ctl:' + c.id, subs, { ctl: c }, y);
      else ports.set('ctl:' + c.id, { x: COL, y: y + h / 2, dir: 'out', kind: 'c', sig: ctlSig(c), ctl: c });
      // a control another source can move: its input on the left edge
      if (drivable(c)) ports.set('cin:' + c.id, { x: 0, y: y + h / 2, dir: 'in', kind: 'c', sig: ctlSig(c), cin: c });
      y += h + 4;
    }
    group('Jacks');
    for (const j of J.ins) {
      rows.push({ jack: j, y, h: ROWH, label: (j.label || (loopRole(j) ? 'RETURN' : 'IN')) + (j.virtual ? ' (no jack)' : loopRole(j) ? ' (return ' + (j.loopN || 1) + ')' : ''), audio: true });
      ports.set('jack:' + j.id, { x: COL, y: y + ROWH / 2, dir: 'out', kind: 'a', sig: 'a', jack: j });
      y += ROWH + 4;
    }
    for (const j of ctlJacks(D)) {
      const out = jackIsOut(j);
      if (j.kind === 'fsw') {
        const h = ROWH + 18;
        rows.push({ jack: j, y, h, label: (j.label || 'FS') + (out ? ' (used as out)' : ' (footswitch in)'), dim: out });
        const p = (k, l, i) => ports.set('jack:' + j.id + ':' + k, { x: 18 + i * 52, y: y + ROWH + 7, dir: 'out', kind: 'c', sig: 'b', jack: j, ch: k, label: l, small: true, side: 'right' });
        p('t', 'Tip', 0);
        p('r', 'Ring', 1);
        y += h + 4;
      } else {
        rows.push({ jack: j, y, h: ROWH, label: (j.label || 'EXP') + (out ? ' (used as out)' : ' (expression in)'), dim: out });
        ports.set('jack:' + j.id, { x: COL, y: y + ROWH / 2, dir: 'out', kind: 'c', sig: 'n', jack: j });
        y += ROWH + 4;
      }
    }
    const leftH = y;
    // circuits
    const boxes = [];
    let maxR = AREA + BOXW, maxB = 0;
    for (const inst of C.insts) {
      const ains = instAudioIns(inst), aouts = instAudioOuts(inst);
      const kins = [...ains.map((n) => ({ key: 'in:' + inst.id + ':' + n.id, label: n.name || 'IN', kind: 'a', sig: 'a' })),
        ...instInputs(inst).map((n) => ({ key: 'k:' + inst.id + ':' + n.id, label: n.name || 'Input', kind: 'c', sig: nodeSig(n), to: inst.id + '.' + n.id, node: n.id })),
        { key: 'k:' + inst.id + ':on', label: 'On / off', kind: 'c', sig: 'b', to: inst.id + '.on' },
        ...(hasTap(inst.graph) ? [{ key: 'k:' + inst.id + ':tap', label: 'Tap tempo', kind: 'c', sig: 'b', to: inst.id + '.tap' }] : [])];
      const kouts = [...aouts.map((n) => ({ key: 'out:' + inst.id + ':' + n.id, label: n.name || 'OUT', kind: 'a', sig: 'a' })),
        ...instOutputs(inst).map((n) => ({ key: 'co:' + inst.id + ':' + n.id, label: n.name || 'Out', kind: 'c', sig: nodeSig(n), cout: { n: inst.id, p: n.id } }))];
      const bx = AREA + (inst.x || 0), by = inst.y || 0;
      const h = 28 + Math.max(kins.length, kouts.length, 1) * 18 + 6;
      boxes.push({ inst, x: bx, y: by, w: BOXW, h, kins, kouts });
      kins.forEach((p, i) => ports.set(p.key, { x: bx, y: by + 28 + i * 18 + 9, dir: 'in', kind: p.kind, sig: p.sig, inst, to: p.to, node: p.node, label: p.label, tapOnly: p.to && p.to.endsWith('.tap') }));
      kouts.forEach((p, i) => ports.set(p.key, { x: bx + BOXW, y: by + 28 + i * 18 + 9, dir: 'out', kind: p.kind, sig: p.sig, inst, label: p.label, cout: p.cout }));
      maxR = Math.max(maxR, bx + BOXW);
      maxB = Math.max(maxB, by + h);
    }
    // screens: their inputs read circuit outputs, their outputs drive circuit inputs
    const sboxes = [];
    let sy = (C.insts.length ? maxB : 0) + 24;
    for (const c of D.ctls.filter((x) => x.kind === 'screen' && !x.hidden)) {
      const sio = c.sio || { ins: [], outs: [] };
      const ins = (sio.ins || []).slice(0, SCREEN_PORTS), outs = (sio.outs || []).slice(0, SCREEN_PORTS);
      const h = 28 + Math.max(ins.length, outs.length, 1) * 18 + 6;
      // a screen moved by hand keeps its place (c.wx, c.wy), the others stack under the circuits
      const placed = typeof c.wx === 'number' && typeof c.wy === 'number';
      const bx = AREA + (placed ? c.wx : 0), by = placed ? c.wy : sy;
      sboxes.push({ c, x: bx, y: by, w: BOXW, h, ins, outs, label: ctlName(c) });
      ins.forEach((p, i) => ports.set('si:' + c.id + ':' + i, { x: bx, y: by + 28 + i * 18 + 9, dir: 'in', kind: 'c', sig: p.sig === 'b' ? 'b' : 'n', screen: c, si: i, label: p.name }));
      outs.forEach((p, i) => ports.set('so:' + c.id + ':' + i, { x: bx + BOXW, y: by + 28 + i * 18 + 9, dir: 'out', kind: 'c', sig: p.sig === 'b' ? 'b' : 'n', screen: c, so: i, label: p.name }));
      maxB = Math.max(maxB, by + h);
      maxR = Math.max(maxR, bx + BOXW);
      if (!placed) sy += h + 16;
    }
    const rx = maxR + 110;
    let ry = 20;
    const outRows = [];
    for (const j of J.outs) {
      const stereo = j.kind === 'phones';
      outRows.push({ jack: j, y: ry, label: (j.label || (loopRole(j) ? 'SEND' : 'OUT')) + (j.virtual ? ' (no jack)' : loopRole(j) ? ' (send ' + (j.loopN || 1) + ')' : ''), h: stereo ? ROWH + 18 : ROWH });
      ports.set('jack:' + j.id, { x: rx, y: ry + ROWH / 2, dir: 'in', kind: 'a', sig: 'a', jack: j });
      if (stereo) {
        ports.set('jack:' + j.id + ':L', { x: rx + 18, y: ry + ROWH + 7, dir: 'in', kind: 'a', sig: 'a', jack: j, side: 'L', label: 'Left', small: true, labelRight: true });
        ports.set('jack:' + j.id + ':R', { x: rx + 72, y: ry + ROWH + 7, dir: 'in', kind: 'a', sig: 'a', jack: j, side: 'R', label: 'Right', small: true, labelRight: true });
      }
      ry += (stereo ? ROWH + 18 : ROWH) + 4;
    }
    const ctlOuts = ctlJacks(D);
    if (ctlOuts.length) {
      ry += 6;
      outRows.push({ title: 'Control out', y: ry });
      ry += 20;
      for (const j of ctlOuts) {
        outRows.push({ jack: j, y: ry, label: (j.label || (j.kind === 'fsw' ? 'FS' : 'EXP')) + (jackIsOut(j) ? ' (out)' : ' (used as in)'), dim: !jackIsOut(j), h: ROWH });
        ports.set('jo:' + j.id, { x: rx, y: ry + ROWH / 2, dir: 'in', kind: 'c', sig: j.kind === 'fsw' ? 'b' : 'n', jout: j });
        ry += ROWH + 4;
      }
    }
    const leds = D.ctls.filter((c) => c.kind === 'led' && !c.hidden);
    if (leds.length) {
      ry += 6;
      outRows.push({ title: 'LEDs', y: ry });
      ry += 20;
      for (const c of leds) {
        const chans = ledChans(c);
        // RGB and bicolour LEDs: one input per colour, each analog (brightness) or binary (on / off)
        outRows.push({ led: c, y: ry, label: ctlName(c), h: chans ? ROWH + 18 : ROWH });
        if (chans) chans.forEach(([ch, l], i) => ports.set('led:' + c.id + ':' + ch, { x: rx + 18 + i * 34, y: ry + ROWH + 7, dir: 'in', kind: 'c', sig: 'n', led: c, ch, label: l, small: true, labelRight: true }));
        else ports.set('led:' + c.id, { x: rx, y: ry + ROWH / 2, dir: 'in', kind: 'c', sig: 'b', led: c });
        ry += (chans ? ROWH + 18 : ROWH) + 4;
      }
    }
    // wires: audio from the design, control from the mappings and the circuit outputs
    const wires = [];
    const ekey = (e, out) => {
      if (e.n.startsWith('jack:')) {
        const j = resolveJack(J, e.n.slice(5), out ? 'in' : 'out');
        if (!j) return null;
        return 'jack:' + j.id + (!out && (e.p === 'L' || e.p === 'R') && j.kind === 'phones' ? ':' + e.p : '');
      }
      return (out ? 'out:' : 'in:') + e.n + ':' + e.p;
    };
    for (const w of effectiveWires(D)) {
      const a = ekey(w.a, true), b = ekey(w.b, false);
      if (ports.has(a) && ports.has(b)) wires.push({ id: w.id, a, b, kind: 'a', sig: 'a', auto: !!w.auto, w });
    }
    const inPort = (to) => {
      const dot = to.indexOf('.');
      return 'k:' + to.slice(0, dot) + ':' + to.slice(dot + 1);
    };
    const cw = (o) => {
      if (ports.has(o.a) && ports.has(o.b)) wires.push({ kind: 'c', sig: ports.get(o.a).sig, ...o });
    };
    for (const c of ctls) {
      mappingsOf(c).forEach((m, i) => cw({ id: 'm:' + c.id + ':' + i, a: 'ctl:' + c.id, b: inPort(m.to), ctl: c, mi: i }));
      if (c.kind === 'dip' || c.kind === 'xy')
        (c.maps || []).forEach((m, i) => m && m.to && cw({ id: 's:' + c.id + ':' + i, a: 'ctl:' + c.id + ':' + i, b: inPort(m.to), ctl: c, sw: i }));
    }
    for (const c of ctls) (c.smore || []).forEach((m, k) => m && m.to && cw({ id: 'sx:' + c.id + ':' + k, a: 'ctl:' + c.id + ':' + m.sw, b: inPort(m.to), ctl: c, smore: k }));
    for (const j of ctlJacks(D)) {
      if (jackIsOut(j)) {
        if (isRef(j.from)) cw({ id: 'jo:' + j.id, a: refKey(j.from), b: 'jo:' + j.id, jout: j });
        continue;
      }
      (j.maps || []).forEach((m, i) => cw({ id: 'x:' + j.id + ':' + i, a: 'jack:' + j.id + (j.kind === 'fsw' ? ':' + (m.ch || 't') : ''), b: inPort(m.to), jack: j, xi: i }));
      // an expression jack set to move a control
      if (j.kind === 'exp' && j.drive && j.drive !== 'none' && !(j.maps || []).length) cw({ id: 'jd:' + j.id, a: 'jack:' + j.id, b: 'cin:' + j.drive, jdrive: j });
    }
    for (const w of C.cwires || []) cw({ id: 'cw:' + w.id, a: 'co:' + w.a.n + ':' + w.a.p, b: 'k:' + w.b.n + ':' + w.b.p, cwire: w });
    for (const c of leds) {
      const chans = ledChans(c);
      if (hasChans(c)) {
        for (const [ch] of chans) if (isRef(c.chans[ch])) cw({ id: 'lc:' + c.id + ':' + ch, a: refKey(c.chans[ch]), b: 'led:' + c.id + ':' + ch, led: c, ch });
      } else if (ledRef(c)) {
        // one source: on an RGB or bicolour LED it lights every colour (its own colour, as before)
        if (chans) for (const [ch] of chans) cw({ id: 'led:' + c.id + ':' + ch, a: refKey(ledRef(c)), b: 'led:' + c.id + ':' + ch, led: c, one: true });
        else cw({ id: 'led:' + c.id, a: refKey(ledRef(c)), b: 'led:' + c.id, led: c, one: true });
      }
    }
    for (const c of ctls) if (isRef(c.from)) cw({ id: 'cin:' + c.id, a: refKey(c.from), b: 'cin:' + c.id, cin: c });
    for (const b of sboxes) {
      b.ins.forEach((p, i) => isRef(p.from) && cw({ id: 'si:' + b.c.id + ':' + i, a: refKey(p.from), b: 'si:' + b.c.id + ':' + i, screen: b.c, si: i }));
      b.outs.forEach((p, i) => (p.maps || []).forEach((m, k) => m && m.to && cw({ id: 'sm:' + b.c.id + ':' + i + ':' + k, a: 'so:' + b.c.id + ':' + i, b: inPort(m.to), screen: b.c, so: i, mk: k })));
    }
    return { rows, outRows, boxes, sboxes, ports, wires, rx, w: rx + COL, h: Math.max(leftH, maxB + 10, ry) };
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
    legend.hidden = !C.insts.length;
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
      const g = svg('g', { class: 'fz-wd-row' + (r.ctl && sel.has(r.ctl.id) ? ' on' : '') + (r.jack ? ' jack' : '') + (r.dim ? ' dim' : ''), 'data-wrow': key }, gl);
      svg('rect', { x: 0, y: r.y, width: COL, height: r.h, rx: 6, class: 'fz-wd-rowbg' }, g);
      svg('text', { x: 10, y: r.y + 15, class: 'fz-wd-label' }, g, r.label.length > 22 ? r.label.slice(0, 21) + '...' : r.label);
      if (r.ctl && r.ctl.kind === 'foot' && (!r.ctl.map || r.ctl.map.to === 'bypass')) svg('text', { x: COL - 14, y: r.y + 15, class: 'fz-wd-note', 'text-anchor': 'end' }, g, 'bypass');
      g.addEventListener('click', () => r.ctl ? api.select(r.ctl.id) : r.jack.virtual ? null : api.select(r.jack.id));
    }
    for (const r of geo.outRows) {
      if (r.title) {
        svg('text', { x: geo.rx + 4, y: r.y + 13, class: 'fz-wd-group' }, vg, r.title.toUpperCase());
        continue;
      }
      const it = r.jack || r.led;
      const key = r.led ? 'led:' + r.led.id : (r.dim !== undefined && r.jack && (r.jack.kind === 'exp' || r.jack.kind === 'fsw') ? 'jo:' : 'jack:') + it.id;
      const g = svg('g', { class: 'fz-wd-row jack' + (r.dim ? ' dim' : '') + (r.led && sel.has(r.led.id) ? ' on' : ''), 'data-wrow': key }, vg);
      svg('rect', { x: geo.rx, y: r.y, width: COL, height: r.h || ROWH, rx: 6, class: 'fz-wd-rowbg' }, g);
      svg('text', { x: geo.rx + 12, y: r.y + 15, class: 'fz-wd-label' }, g, r.label.length > 22 ? r.label.slice(0, 21) + '...' : r.label);
      if (r.led) svg('circle', { cx: geo.rx + COL - 14, cy: r.y + ROWH / 2, r: 4, class: 'fz-wd-led', fill: r.led.color || '#ff2a1a' }, g);
      g.addEventListener('click', () => (r.led ? api.select(r.led.id) : !r.jack.virtual && api.select(r.jack.id)));
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
      b.kins.forEach((p, i) => svg('text', { x: b.x + 12, y: b.y + 28 + i * 18 + 13, class: 'fz-wd-plabel' + (p.kind === 'c' ? ' c ' + p.sig : '') }, g, p.label.slice(0, 18)));
      b.kouts.forEach((p, i) => svg('text', { x: b.x + b.w - 12, y: b.y + 28 + i * 18 + 13, class: 'fz-wd-plabel' + (p.kind === 'c' ? ' c ' + p.sig : ''), 'text-anchor': 'end' }, g, p.label.slice(0, 14)));
      g.addEventListener('dblclick', () => api.editInst(b.inst.id));
    }
    // screens
    for (const b of geo.sboxes) {
      const g = svg('g', { class: 'fz-wd-box fz-wd-screen' + (sel.has(b.c.id) ? ' on' : ''), 'data-wscreen': b.c.id }, vg);
      svg('rect', { x: b.x, y: b.y, width: b.w, height: b.h, rx: 8, class: 'fz-wd-boxbg' }, g);
      const hd = svg('g', { class: 'fz-wd-boxhead', 'data-wsdrag': b.c.id }, g);
      svg('rect', { x: b.x, y: b.y, width: b.w, height: 24, rx: 8, class: 'fz-wd-boxtop' }, hd);
      svg('text', { x: b.x + 10, y: b.y + 16, class: 'fz-wd-title' }, hd, 'Screen: ' + (b.label.length > 12 ? b.label.slice(0, 11) + '...' : b.label));
      svg('title', {}, hd, 'Drag to move, click to select the screen');
      const nIn = b.ins.length, nOut = b.outs.length;
      [['in', 'Add an input (the script reads it with input())', b.x + b.w - 70, nIn], ['out', 'Add an output (the script sets it with output())', b.x + b.w - 36, nOut]].forEach(([k, tip, x, n]) => {
        const bt = svg('g', { class: 'fz-wd-btn' + (n >= SCREEN_PORTS ? ' off' : ''), 'data-wscreen-add': k }, g);
        svg('rect', { x, y: b.y + 4, width: 30, height: 16, rx: 4 }, bt);
        svg('text', { x: x + 15, y: b.y + 15.5, class: 'fz-wd-btxt', 'text-anchor': 'middle' }, bt, '+' + k);
        svg('title', {}, bt, tip);
        bt.addEventListener('click', (e) => {
          e.stopPropagation();
          if (n < SCREEN_PORTS) api.addScreenPort(b.c.id, k);
        });
      });
      if (!nIn && !nOut) svg('text', { x: b.x + 12, y: b.y + 41, class: 'fz-wd-note' }, g, 'No inputs or outputs yet');
      b.ins.forEach((p, i) => svg('text', { x: b.x + 12, y: b.y + 28 + i * 18 + 13, class: 'fz-wd-plabel c ' + (p.sig === 'b' ? 'b' : 'n') }, g, (p.name || 'In ' + (i + 1)).slice(0, 14)));
      b.outs.forEach((p, i) => svg('text', { x: b.x + b.w - 12, y: b.y + 28 + i * 18 + 13, class: 'fz-wd-plabel c ' + (p.sig === 'b' ? 'b' : 'n'), 'text-anchor': 'end' }, g, (p.name || 'Out ' + (i + 1)).slice(0, 14)));
    }
    // wires
    for (const w of geo.wires) {
      const a = geo.ports.get(w.a), b = geo.ports.get(w.b);
      const hot = hoverKey && (hoverKey === w.a || hoverKey === w.b || hoverKey === w.id || (w.ctl && hoverKey === 'ctl:' + w.ctl.id));
      const on = selWire === w.id || (w.ctl && sel.has(w.ctl.id));
      const p = svg('path', { d: wpath(a, b), class: `fz-wd-wire ${w.kind === 'a' ? 'a' : 'c ' + (w.sig || 'n')}${w.auto ? ' auto' : ''}${hot ? ' hot' : ''}${on ? ' on' : ''}`, 'data-ww': w.id, 'data-kind': w.kind, 'data-sig': w.sig || w.kind }, gw);
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
      // audio circle, analog diamond, binary square
      const sg = p.sig || (p.kind === 'a' ? 'a' : 'n');
      const r0 = p.small ? 3.8 : 4.5;
      const c = svg(sg === 'a' ? 'circle' : 'rect', sg === 'a' ? { cx: p.x, cy: p.y, r: p.small ? 4.2 : 5 } : sg === 'b' ? { x: p.x - r0 + 0.5, y: p.y - r0 + 0.5, width: r0 * 2 - 1, height: r0 * 2 - 1, rx: 1 } : { x: p.x - r0, y: p.y - r0, width: r0 * 2, height: r0 * 2, rx: 1.5, transform: `rotate(45 ${p.x} ${p.y})` }, gp);
      c.setAttribute('class', `fz-wd-port ${p.kind} ${sg}${wired ? ' wired' : ''}${drag && !ok && drag.from !== k ? ' dim' : ''}${drag && ok && drag.from !== k ? ' ok' : ''}${hoverKey === k ? ' hot' : ''}`);
      c.setAttribute('data-wp', k);
      svg('title', {}, c, (p.dir === 'out' ? 'Drag to wire it up. Drag again to feed more things.' : 'Drag from here to an output, or drop a wire on it.'));
      if (p.small && (p.labelRight || p.side === 'right')) svg('text', { x: p.x + 8, y: p.y + 3, class: 'fz-wd-sub' }, gp, p.label);
      else if (p.small) svg('text', { x: p.x, y: p.y - 7, class: 'fz-wd-sub', 'text-anchor': 'middle' }, gp, p.label);
      c.addEventListener('pointerdown', (e) => startDrag(e, k));
      c.addEventListener('pointerenter', () => setHover(k));
      c.addEventListener('pointerleave', () => setHover(null));
    }
    if (drag && drag.to) svg('path', { d: wpath(drag.dir === 'out' ? drag.p0 : drag.to, drag.dir === 'out' ? drag.to : drag.p0), class: 'fz-wd-wire drag ' + drag.kind + (drag.kind === 'c' ? ' ' + (drag.sig || 'n') : '') }, vg);
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
  // why a wire from port `from` to port `to` cannot be made ('' when it can)
  function why(from, to) {
    if (!geo || from === to) return 'x';
    const a = geo.ports.get(from), b = geo.ports.get(to);
    if (!a || !b) return 'x';
    if (a.dir === b.dir) return a.dir === 'out' ? 'Wire an output to an input.' : 'Wire an input to an output.';
    const src = a.dir === 'out' ? a : b, dst = a.dir === 'out' ? b : a;
    if (src.kind === 'a' && dst.kind !== 'a') return 'Audio only goes into audio inputs: it cannot drive a control, an LED or a screen.';
    if (src.kind !== 'a' && dst.kind === 'a') return 'A control signal cannot go into an audio input.';
    if (src.inst && dst.inst && src.inst === dst.inst) return 'A circuit cannot feed itself here: wire it inside the circuit editor.';
    if (src.kind === 'a') return '';
    if (dst.tapOnly) return src.ctl && (src.ctl.kind === 'foot' || src.ctl.kind === 'button') && src.sw == null ? '' : 'Tap tempo takes a footswitch or a button.';
    if (src.cout) return dst.node || dst.led || dst.jout || dst.screen ? '' : dst.cin ? 'A circuit output cannot move a control.' : 'Circuit outputs go into circuit inputs, not their on / off.';
    if (dst.cin && ((src.ctl && src.ctl.id === dst.cin.id) || (src.ctl && src.ctl.kind === 'foot' && src.sw == null && !footParam(src.ctl)))) return 'That control cannot move this one.';
    if (dst.jout && src.jack && src.jack.id === dst.jout.id) return 'A jack cannot drive itself.';
    if (dst.screen && src.screen && src.screen.id === dst.screen.id) return 'A screen cannot read its own output here: use a variable in its script.';
    if (dst.to || dst.led || dst.jout || dst.screen || dst.cin) return '';
    return 'That does not connect.';
  }
  const footParam = (c) => c.map && c.map.to && c.map.to !== 'bypass' && !c.map.to.endsWith('.tap');
  const canDrop = (from, to) => !why(from, to);
  let lastNo = '';
  function startDrag(e, k) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const p = geo.ports.get(k);
    drag = { from: k, kind: p.kind, sig: p.sig, dir: p.dir, p0: { x: p.x, y: p.y }, to: null };
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
      else {
        // dropped on a port that does not fit: say why
        const near = nearest(toLocal(ev), (key) => key !== from);
        const no = near ? why(from, near.k) : '';
        if (no && no !== 'x') refuse(no);
        refresh(true);
      }
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
  function refuse(msg) {
    lastNo = msg;
    toast(msg, 'warn', 3200);
  }
  // the source a port stands for, as a link ref (circuit-links.js)
  function refOfPort(src) {
    if (src.cout) return { n: src.cout.n, p: src.cout.p };
    if (src.screen) return { scr: src.screen.id, o: src.so };
    if (src.jack) return src.jack.kind === 'fsw' ? { jack: src.jack.id, ch: src.ch || 't' } : { jack: src.jack.id };
    if (src.ctl) return src.sw != null ? { ctl: src.ctl.id, sw: src.sw } : { ctl: src.ctl.id };
    return null;
  }
  /** Wire port key a to port key b (either direction). Returns true when something was wired. */
  function connect(ka, kb) {
    const no = why(ka, kb);
    if (no) {
      if (no !== 'x') lastNo = no;
      return false;
    }
    const D = api.design();
    const A = geo.ports.get(ka), B = geo.ports.get(kb);
    const src = A.dir === 'out' ? A : B, dst = A.dir === 'out' ? B : A;
    const sk = A.dir === 'out' ? ka : kb, dk = A.dir === 'out' ? kb : ka;
    const C = D.circuit;
    if (src.kind === 'a') {
      const end = (k) => {
        const [t, ...r] = k.split(':');
        return t === 'jack' ? { n: 'jack:' + r[0], p: r[1] || '' } : { n: r[0], p: r[1] };
      };
      const a = end(sk), b = end(dk);
      if (C.wires.some((w) => w.a.n === a.n && w.a.p === a.p && w.b.n === b.n && w.b.p === b.p)) return false;
      C.wires.push({ id: uid('w'), a, b });
    } else if (dst.led || dst.jout || dst.screen || dst.cin) {
      if (!linkTo(D, src, dst)) return false;
    } else if (src.cout) {
      const b = { n: dst.inst.id, p: dst.node };
      if (!Array.isArray(C.cwires)) C.cwires = [];
      if (C.cwires.some((w) => w.a.n === src.cout.n && w.a.p === src.cout.p && w.b.n === b.n && w.b.p === b.p)) return false;
      C.cwires.push({ id: uid('w'), a: { ...src.cout }, b });
    } else if (src.screen) {
      const p = screenIO(D.ctls.find((x) => x.id === src.screen.id)).outs[src.so];
      if (!p || !targetInfo(C, dst.to) || (p.maps || []).some((m) => m.to === dst.to)) return false;
      p.maps = [...(p.maps || []), { to: dst.to, raw: true }];
    } else {
      const to = dst.to;
      const info = targetInfo(D.circuit, to);
      if (!info) return false;
      if (src.jack) {
        const j = D.jacks.find((x) => x.id === src.jack.id);
        const ch = j.kind === 'fsw' ? src.ch || 't' : undefined;
        if ((j.maps || []).some((m) => m.to === to && (m.ch || 't') === (ch || 't'))) return false;
        delete j.from; // a jack wired into a circuit is an input
        delete j.dir;
        j.maps = [...(j.maps || []), mapTo(D.circuit, to, ch ? { ch } : {})];
      } else if (src.sw != null) {
        const c = D.ctls.find((x) => x.id === src.ctl.id);
        const n = c.kind === 'dip' ? c.n || 4 : 2;
        const maps = (c.maps || []).slice();
        while (maps.length < n) maps.push(null);
        const m = c.kind === 'dip' ? mapTo(D.circuit, to, { min: info.i ? info.min : info.def ?? info.min, max: info.max }) : mapTo(D.circuit, to);
        if ((maps[src.sw] && maps[src.sw].to === to) || (c.smore || []).some((x) => x && x.sw === src.sw && x.to === to)) return false;
        // a switch or axis that drives something already drives this too
        if (maps[src.sw] && maps[src.sw].to) c.smore = [...(c.smore || []), { ...m, sw: src.sw }];
        else maps[src.sw] = m;
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
  // a control, jack, screen or circuit output straight to an LED, an OUT jack, a screen input or a control
  function linkTo(D, src, dst) {
    const ref = refOfPort(src);
    if (!ref) return false;
    const same = (r) => isRef(r) && refKey(r) === refKey(ref);
    if (src.jack) {
      // a jack read by something is an input
      const j = D.jacks.find((x) => x.id === src.jack.id);
      if (j && jackIsOut(j)) {
        delete j.from;
        delete j.dir;
      }
    }
    if (dst.led) {
      const c = D.ctls.find((x) => x.id === dst.led.id);
      if (!c) return false;
      if (dst.ch) {
        if (!hasChans(c)) {
          // its one source so far lit every colour: the other colours keep it
          const old = ledRef(c);
          c.chans = {};
          if (old) for (const [ch] of ledChans(c)) if (ch !== dst.ch) c.chans[ch] = { ...old };
          c.bind = 'on';
          delete c.src;
        }
        if (same(c.chans[dst.ch])) return false;
        c.chans[dst.ch] = ref;
      } else {
        if (same(ledRef(c))) return false;
        if (ref.n) {
          c.bind = 'cv:' + ref.n + '.' + ref.p;
          delete c.src;
        } else {
          c.bind = 'src';
          c.src = ref;
        }
      }
    } else if (dst.jout) {
      const j = D.jacks.find((x) => x.id === dst.jout.id);
      if (!j || same(j.from)) return false;
      j.from = ref;
      j.dir = 'out';
      delete j.maps;
      delete j.drive;
      pruneLinks(D, linkCtx(D, circuitOutputs(D)), j.id); // nothing reads it as an input any more
    } else if (dst.screen) {
      const p = screenIO(D.ctls.find((x) => x.id === dst.screen.id)).ins[dst.si];
      if (!p || same(p.from)) return false;
      p.from = ref;
    } else if (dst.cin) {
      const c = D.ctls.find((x) => x.id === dst.cin.id);
      if (!c || same(c.from)) return false;
      c.from = ref;
      // one source moves a control: an expression jack set to move it gives way
      for (const j of D.jacks) if (j.drive === c.id) delete j.drive;
    }
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
    else if (w.smore != null) {
      const c = D.ctls.find((x) => x.id === w.ctl.id);
      c.smore = (c.smore || []).filter((_, i) => i !== w.smore);
    } else if (w.led && w.ch) {
      const c = D.ctls.find((x) => x.id === w.led.id);
      if (c.chans) delete c.chans[w.ch];
      if (c.chans && !Object.keys(c.chans).length) delete c.chans;
    } else if (w.led) {
      const c = D.ctls.find((x) => x.id === w.led.id);
      c.bind = 'on';
      delete c.src;
    } else if (w.cin) delete D.ctls.find((x) => x.id === w.cin.id).from;
    else if (w.jdrive) D.jacks.find((x) => x.id === w.jdrive.id).drive = 'none';
    else if (w.cwire) D.circuit.cwires = (D.circuit.cwires || []).filter((x) => x.id !== w.cwire.id);
    else if (w.jout) delete D.jacks.find((x) => x.id === w.jout.id).from;
    else if (w.screen && w.si != null) screenIO(D.ctls.find((x) => x.id === w.screen.id)).ins[w.si].from = null;
    else if (w.screen && w.so != null) {
      const p = screenIO(D.ctls.find((x) => x.id === w.screen.id)).outs[w.so];
      p.maps = (p.maps || []).filter((_, i) => i !== w.mk);
    } else if (w.jack) {
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
    const sh = e.target.closest('[data-wsdrag]');
    if (sh && e.button === 0) {
      // screens move like circuits; a click without moving selects the screen
      const D = api.design();
      const c = D.ctls.find((x) => x.id === sh.dataset.wsdrag);
      const b = geo && geo.sboxes.find((x) => x.c.id === sh.dataset.wsdrag);
      if (!c || !b) return;
      e.preventDefault();
      sv.setPointerCapture(e.pointerId);
      const p0 = toLocal(e), x0 = b.x - AREA, y0 = b.y;
      let moved = false;
      const mv = (ev) => {
        const p = toLocal(ev);
        if (!moved && Math.hypot(p.x - p0.x, p.y - p0.y) < 3) return;
        c.wx = Math.round((x0 + p.x - p0.x) / 8) * 8;
        c.wy = Math.round((y0 + p.y - p0.y) / 8) * 8;
        moved = true;
        render();
      };
      const up = () => {
        sv.removeEventListener('pointermove', mv);
        sv.removeEventListener('pointerup', up);
        if (moved) api.commit();
        else api.select(c.id);
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
    return JSON.stringify([D.ctls.map((c) => [c.id, c.kind, c.label, c.hidden, c.map, c.more, c.maps, c.smore, c.n, c.ways, c.bind, c.src, c.chans, c.from, c.look, c.sio, c.color, c.wx, c.wy]), D.jacks.map((j) => [j.id, j.kind, j.label, j.maps, j.from, j.dir, j.drive, j.loop, j.loopN]), D.circuit && D.circuit.insts && D.circuit.insts.map((i) => [i.id, i.name, i.x, i.y, i.on, i.graph.nodes.filter((n) => PARTS[n.t]?.io).map((n) => [n.id, n.t, n.name, n.steps]), hasTap(i.graph)]), D.circuit && D.circuit.wires, D.circuit && D.circuit.cwires, api.selected(), selWire, P.collapsed]);
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
    /** Why the last wire could not be made (tests). */
    lastRefusal: () => lastNo,
    why: (a, b) => {
      if (!geo) render();
      return why(a, b);
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
