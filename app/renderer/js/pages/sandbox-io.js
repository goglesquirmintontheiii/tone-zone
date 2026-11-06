// Hardware I/O for the plugin sandbox: small HARDWARE IN / HARDWARE OUT blocks beside the pedal, with cables the
// user drags like on the board. While any cable connects the pedal to the hardware, the engine plays the sandbox
// instead of the board: the board's running graph is parked in the engine's graph cache (preload / useGraph), so
// its loopers and delays come back exactly as they were when the last cable is pulled or the pop-up closes.
// Nothing here touches the preset: the cables live only in this module.
import { svg, el, bus, toast } from '../util.js';
import { state, buildGraph, setGraphOverride, graphOverridden, nodePorts, CABLE_COLORS } from '../state.js';
import { getDef, hasDef, jackKindOf, kindsCompatible, jackChannels, KIND_NAMES } from '../catalog/index.js';
import { drawJack, drawPlug, JACK_TIP, PLUG_LENS, SLEEVE, CABLE_WIDTH } from '../gfx/jacks.js';
import { formKit } from '../gfx/forms.js';
import { label } from '../gfx/controls.js';
import { looseCurve, cableBody } from '../editor.js';
import { showMenu } from '../menus.js';

const BOARD_KEY = 'tz-sandbox-board'; // the parked board graph
const SB_KEY = 'tz-sandbox';
const HW_W = 104, HW_H = 168, GAP = 150;
const JACK_Y = [76, 126];
const HW = {
  hwin: { title: 'HARDWARE IN', labels: ['IN 1', 'IN 2'], dir: 'out' },
  hwout: { title: 'HARDWARE OUT', labels: ['OUT L', 'OUT R'], dir: 'in' },
};

// one live sandbox at a time
let owner = null;
let openCount = 0;
const log = { graphs: [], cmds: [] }; // for tests
const send = (cmd) => {
  log.cmds.push(cmd.cmd + (cmd.key ? ':' + cmd.key : ''));
  if (log.cmds.length > 60) log.cmds.shift();
  window.tz.engine.send(cmd);
};

// a stylesheet of our own, loaded once
function ensureCss() {
  if (document.getElementById('sandboxIoCss')) return;
  el('link', { id: 'sandboxIoCss', rel: 'stylesheet', href: 'css/sandbox-io.css' }, document.head);
}

// the main window's "board paused" pill, over the preset name in the top bar
function pausedPill(on) {
  let p = document.getElementById('boardPaused');
  if (!on) {
    if (p) p.remove();
    document.body.classList.remove('board-paused');
    return;
  }
  if (!p) p = el('div', { id: 'boardPaused', class: 'board-paused-pill', title: 'Close the pedal pop-up or unplug its cables to hear your board again' }, document.body, '<i></i><span>Board paused: trying a pedal</span>');
  document.body.classList.add('board-paused');
  const bar = document.getElementById('presetbar');
  const r = bar && bar.getBoundingClientRect();
  if (r && r.width) {
    p.style.left = r.left + 'px';
    p.style.top = r.top + 'px';
    p.style.width = r.width + 'px';
    p.style.height = r.height + 'px';
  }
}

const pt = (p) => p.x.toFixed(1) + ',' + p.y.toFixed(1);
const isCtl = (key) => /^[io]c/.test(key);
const portOf = (key) => parseInt(key.slice(1), 10);

/**
 * Add hardware I/O to a sandbox. ctx: { d, root, layer, block(), nv(), close() }.
 * Returns hooks the sandbox calls: down / move / up (true when the event was ours), fit(), redraw(), reset(),
 * tick(now), close().
 */
export function sandboxIO(ctx) {
  ensureCss();
  const { d, root } = ctx;
  const me = {};
  const flip = !!state.settings.flowLeftToRight;
  let cables = []; // { id, from: {node, port}, to: {node, port}, color }
  let seq = 0;
  let live = false;
  let drag = null;
  let selected = null;
  const pos = { hwin: { x: 0, y: 0 }, hwout: { x: 0, y: 0 } };

  // ---- layers: hardware blocks beside the pedal, then cable shadows, cables, plugs and the cable being dragged
  const layerHw = svg('g', { class: 'sb-hw' }, root);
  const layerShadows = svg('g', {}, root);
  const layerCables = svg('g', {}, root);
  const layerPlugs = svg('g', {}, root);
  const layerDrag = svg('g', {}, root);
  const hw = {};
  for (const id of ['hwin', 'hwout']) hw[id] = drawHw(id);

  function drawHw(id) {
    const H = HW[id];
    const g = svg('g', { class: 'node sb-hwblock' }, layerHw);
    g.dataset.sbnode = id;
    formKit.body(g, HW_W, HW_H, '#20242d', { rx: 10, brushed: true });
    svg('rect', { x: 0, y: 0, width: HW_W, height: 32, rx: 10, fill: '#000', opacity: 0.25 }, g);
    label(g, HW_W / 2, 17, H.title, { size: 8.4, fill: '#e9ecf3', weight: 800, ls: 1.6 });
    label(g, HW_W / 2, HW_H - 13, 'YOUR INTERFACE', { size: 5, fill: '#9aa3b5', weight: 700, ls: 1.4 });
    // jacks face the pedal: the input sits right of it (jacks on its left side), the output left of it
    const faceLeft = (id === 'hwin') !== flip;
    const meters = [];
    const jacks = H.labels.map((l, i) => {
      const y = JACK_Y[i];
      label(g, faceLeft ? 16 : HW_W - 16, y - 18, l, { size: 7.2, fill: '#e3e7ef', weight: 700, anchor: faceLeft ? 'start' : 'end', ls: 0.6 });
      const segs = [];
      for (let s = 0; s < 8; s++) segs.push(svg('rect', { x: (faceLeft ? 16 : HW_W - 16 - 8 * 8.4) + s * 8.4, y: y - 5, width: 6.4, height: 9, rx: 1.5, fill: '#14181f' }, g));
      meters.push(segs);
      const key = (H.dir === 'out' ? 'o' : 'i') + i;
      const j = { key, dir: H.dir, port: i, label: '', side: faceLeft ? 'left' : 'right', x: faceLeft ? -2 : HW_W + 2, y, kind: 'any' };
      drawJack(g, j, { text: '#cfd5e2', jackLabels: false });
      return j;
    });
    return { g, jacks, meters };
  }

  // ---- layout: pedal at 0,0, the hardware either side, level with the pedal's jacks that face it
  function layout() {
    const nv = ctx.nv();
    const audio = (nv.jacks || []).filter((j) => !isCtl(j.key));
    const midY = (dir) => {
      const js = audio.filter((j) => j.key[0] === dir && (j.side === 'left' || j.side === 'right'));
      return js.length ? js.reduce((a, j) => a + j.y, 0) / js.length : nv.h / 2;
    };
    const place = (id, jy) => {
      const lo = Math.min(nv.h / 2, HW_H / 2 - 30), hi = Math.max(nv.h / 2, nv.h - HW_H / 2 + 30);
      const cy = Math.max(lo, Math.min(hi, jy));
      const right = (id === 'hwin') !== flip;
      pos[id] = { x: right ? nv.w + GAP : -GAP - HW_W, y: Math.round(cy - (JACK_Y[0] + JACK_Y[1]) / 2) };
      hw[id].g.setAttribute('transform', `translate(${pos[id].x},${pos[id].y})`);
    };
    place('hwin', midY('i'));
    place('hwout', midY('o'));
  }
  // the viewBox: pedal (with room above for tubes), hardware, and room below for hanging cables
  me.fit = (top = 16) => {
    layout();
    const nv = ctx.nv(), pad = 26;
    const x0 = Math.min(0, pos.hwin.x, pos.hwout.x) - pad, x1 = Math.max(nv.w, pos.hwin.x + HW_W, pos.hwout.x + HW_W) + pad;
    const y0 = Math.min(-top - 10, pos.hwin.y - pad, pos.hwout.y - pad);
    const y1 = Math.max(nv.h + 40, pos.hwin.y + HW_H + 60, pos.hwout.y + HW_H + 60);
    root.setAttribute('viewBox', `${x0} ${y0} ${x1 - x0} ${y1 - y0}`);
    draw();
  };

  // ---- jack geometry, as the board's jackGeom
  function jackOf(node, key) {
    if (node === 'pedal') {
      const p = ctx.nv().jackWorld(key);
      return p;
    }
    const j = hw[node].jacks.find((x) => x.key === key);
    return j && { x: pos[node].x + j.x, y: pos[node].y + j.y, side: j.side, kind: j.kind };
  }
  function geom(node, key) {
    const p = jackOf(node, key);
    if (!p) return null;
    const dir = typeof p.angle === 'number' && p.side !== 'front'
      ? [Math.cos((p.angle * Math.PI) / 180), Math.sin((p.angle * Math.PI) / 180)]
      : { left: [-1, 0], right: [1, 0], top: [0, -1], bottom: [0, 1], front: [0, 1] }[p.side] || [1, 0];
    return { x: p.x, y: p.y, dx: dir[0], dy: dir[1], front: p.side === 'front', kind: p.kind || 'inst' };
  }
  function kindOf(node, key) {
    if (node !== 'pedal') return 'any';
    const j = ctx.nv().jack(key);
    return (j && j.kind) || jackKindOf(getDef(ctx.block().type), key);
  }
  function cablePath(a, b) {
    const plugLen = (j) => (j.front ? 6 : (JACK_TIP[j.kind] ?? 6) + (PLUG_LENS[j.kind] || 30) - (j.free ? 0 : SLEEVE[j.kind] || 0));
    const la = plugLen(a), lb = plugLen(b);
    const A = { x: a.x + a.dx * la, y: a.y + a.dy * la, dx: a.dx, dy: a.dy };
    const B = { x: b.x + b.dx * lb, y: b.y + b.dy * lb, dx: b.dx, dy: b.dy };
    return 'M' + pt(A) + ' ' + looseCurve(A, B);
  }
  // cable kind follows the jacks (the interface takes whatever is plugged in)
  function pairKind(a, b) {
    const k = a.kind !== 'any' ? a.kind : b.kind && b.kind !== 'any' ? b.kind : 'inst';
    if (a.kind === 'any') a.kind = k;
    if (!b.kind || b.kind === 'any') b.kind = k;
    return k;
  }

  // ---- drawing
  function draw() {
    layerShadows.innerHTML = '';
    layerCables.innerHTML = '';
    layerPlugs.innerHTML = '';
    const lit = new Set();
    for (const c of cables) {
      const a = geom(c.from.node, 'o' + c.from.port), b = geom(c.to.node, 'i' + c.to.port);
      if (!a || !b) continue;
      lit.add(c.from.node + ':o' + c.from.port).add(c.to.node + ':i' + c.to.port);
      const kind = pairKind(a, b);
      const dpath = cablePath(a, b);
      const sh = svg('g', { transform: 'translate(5,12)', 'pointer-events': 'none', fill: 'none', stroke: '#000', 'stroke-linecap': 'round' }, layerShadows);
      svg('path', { d: dpath, 'stroke-width': 14, opacity: 0.08 }, sh);
      svg('path', { d: dpath, 'stroke-width': 6, opacity: 0.12 }, sh);
      const g = svg('g', { class: 'cable' + (selected === c.id ? ' selected' : '') }, layerCables);
      g.dataset.sbcable = c.id;
      svg('path', { d: dpath, fill: 'none', stroke: 'transparent', 'stroke-width': 16 }, g);
      cableBody(g, dpath, c.color, kind, CABLE_WIDTH[kind] || 5.6);
      if (drag && drag.existing === c) { g.style.opacity = 0.15; sh.style.opacity = 0; }
      const pg = svg('g', drag && drag.existing === c ? { opacity: 0.15 } : {}, layerPlugs);
      drawPlug(pg, a, c.color, kind);
      drawPlug(pg, b, c.color, kind);
    }
    for (const id of ['hwin', 'hwout']) hw[id].g.classList.toggle('plugged', [...lit].some((k) => k.startsWith(id + ':')));
  }

  // ---- the graph the engine plays while live: the pedal between the hardware ports
  function graph() {
    const b = ctx.block();
    const out = [];
    for (const c of cables) {
      if (c.from.node === 'hwin') out.push({ from: { node: '__in', port: c.from.port }, to: { node: b.id, port: c.to.port } });
      else {
        // one stereo jack to both OUT L and OUT R: its left to L and right to R (the interface's PHONES pair)
        const both = jackChannels(getDef(b.type), 'o' + c.from.port) === 2 && cables.filter((x) => x.from.node === 'pedal' && x.from.port === c.from.port).length === 2;
        if (both) { if (c.to.port === 0) out.push({ from: { node: b.id, port: c.from.port }, to: { node: '__out', port: 4 } }); }
        else out.push({ from: { node: b.id, port: c.from.port }, to: { node: '__out', port: c.to.port } });
      }
    }
    const g = buildGraph({ blocks: [{ id: '__in', type: '__in', params: {} }, { id: '__out', type: '__out', params: {} }, b], cables: out });
    log.graphs.push(g);
    if (log.graphs.length > 20) log.graphs.shift();
    return g;
  }

  // ---- audio priority
  function goLive() {
    if (owner && owner !== me) {
      toast('Another pedal is already hooked up. Close it first.', 'warn');
      return false;
    }
    if (graphOverridden()) {
      toast('The engine is busy with another test. Stop it first.', 'warn');
      return false;
    }
    owner = me;
    live = true;
    // tag the board's graph, then switch: the board's blocks stay built in the engine's cache
    send({ cmd: 'setGraph', graph: buildGraph(), key: BOARD_KEY });
    send({ cmd: 'preload', graph: graph(), key: SB_KEY });
    send({ cmd: 'useGraph', key: SB_KEY });
    // from now on every graph send (engine restart, board edits) plays the sandbox
    setGraphOverride(graph);
    log.cmds.push('override:on');
    pausedPill(true);
    return true;
  }
  function goIdle() {
    if (!live) return;
    live = false;
    if (owner === me) owner = null;
    // the parked board first (if the engine still has it), then a fresh send of the board as it is now
    send({ cmd: 'useGraph', key: BOARD_KEY });
    setGraphOverride(null);
    log.cmds.push('override:off');
    send({ cmd: 'dropCache', keep: [] });
    pausedPill(false);
  }
  function sync() {
    if (cables.length && !live) {
      if (!goLive()) return false;
    } else if (!cables.length && live) goIdle();
    else if (live) setGraphOverride(graph);
    return true;
  }
  function changed() {
    draw();
    updateBar();
  }

  // ---- cable edits (local only)
  function connect(from, to, color) {
    const prev = cables;
    cables = cables.filter((c) => !(c.to.node === to.node && c.to.port === to.port));
    const c = { id: 'sbc' + ++seq, from: { ...from }, to: { ...to }, color: color || state.cableColor };
    cables.push(c);
    if (!sync()) { cables = prev; changed(); return null; }
    changed();
    return c;
  }
  function unplug(id) {
    cables = cables.filter((c) => c.id !== id);
    if (selected === id) selected = null;
    sync();
    changed();
  }
  function unplugAll() {
    cables = [];
    selected = null;
    sync();
    changed();
  }

  // the obvious wiring: IN 1 into the pedal's main input, its main output (or stereo pair) to L and R
  function suggestion() {
    const b = ctx.block(), def = getDef(b.type), S = def.loopSplit;
    const ports = nodePorts(b);
    const aux = /PHONES|SEND|RETURN|THRU|TUNER|DRY|BYPASS|DIRECT|PARALLEL|INVERTED|SIDECHAIN|EXP|USB/i;
    const pick = (list, labels) => list.find((i) => !aux.test(labels[i]) && !/XLR|DI\b/i.test(labels[i])) ?? list.find((i) => !aux.test(labels[i])) ?? list[0];
    const ins = ports.ins.map((_, i) => i).filter((i) => (!S || S.inA[i] !== undefined) && !(def.loopReturns || []).includes(i) && kindsCompatible(jackKindOf(def, 'i' + i), 'any'));
    const outs = ports.outs.map((_, i) => i).filter((i) => (!S || !S.outA[i]) && kindsCompatible(jackKindOf(def, 'o' + i), 'any'));
    const list = [];
    const inP = ins.find((i) => /GUITAR|INST|^IN(PUT)?\b/i.test(ports.ins[i]) && !aux.test(ports.ins[i])) ?? pick(ins, ports.ins);
    if (inP !== undefined) list.push([{ node: 'hwin', port: 0 }, { node: 'pedal', port: inP }]);
    // a stereo pair: two labels the same but for L / R, A / B or 1 / 2 ("OUT L/MONO" and "OUT R")
    const words = (l) => l.toUpperCase().replace(/\(MONO\)|\/MONO/g, '').trim().split(/\s+/);
    const SIDES = { L: 'R', LEFT: 'RIGHT', A: 'B', 1: '2' };
    const pairOf = (i, j) => {
      const a = words(ports.outs[i]), z = words(ports.outs[j]);
      if (a.length !== z.length) return false;
      const diff = a.map((w, k) => (w === z[k] ? null : [w, z[k]])).filter(Boolean);
      return diff.length === 1 && SIDES[diff[0][0]] === diff[0][1];
    };
    let L, R;
    for (const i of outs) {
      if (aux.test(ports.outs[i]) || jackChannels(def, 'o' + i) !== 1) continue;
      const j = outs.find((k) => k > i && pairOf(i, k));
      if (j !== undefined) { L = i; R = j; break; }
    }
    if (L === undefined) L = R = pick(outs, ports.outs); // mono (or one stereo jack): to both sides
    if (L !== undefined) {
      list.push([{ node: 'pedal', port: L }, { node: 'hwout', port: 0 }]);
      list.push([{ node: 'pedal', port: R }, { node: 'hwout', port: 1 }]);
    }
    return list;
  }
  function hookUp() {
    const list = suggestion();
    if (!list.length) return toast('This block has no audio jacks to hook up.', 'info');
    const prev = cables;
    cables = [];
    list.forEach(([from, to], i) => cables.push({ id: 'sbc' + ++seq, from, to, color: i === 0 ? state.cableColor : CABLE_COLORS[(CABLE_COLORS.indexOf(state.cableColor) + 5 + i) % CABLE_COLORS.length] }));
    if (!sync()) cables = prev;
    changed();
  }

  // ---- the bar under the stage: hint + Hook up, or the live banner
  const bar = el('div', { class: 'sb-io-bar' });
  ctx.stage.after(bar);
  function updateBar() {
    bar.classList.toggle('live', live);
    bar.innerHTML = '';
    if (live) {
      el('div', { class: 'sb-live-msg' }, bar, '<i class="sb-live-dot"></i><b>Live:</b> your board is paused while this pedal is hooked up');
      el('button', { class: 'btn small', onclick: unplugAll }, bar, 'Unplug all');
    } else {
      el('div', { class: 'sb-io-hint' }, bar).textContent = cables.length
        ? 'Plug the pedal into the hardware to hear it.'
        : 'Want to hear it? Drag cables between the hardware jacks and the pedal. Your board pauses while it is hooked up.';
      const b = el('button', { class: 'btn small btn-accent', onclick: hookUp }, bar, 'Hook up');
      if (!suggestion().length) b.disabled = true;
    }
  }
  updateBar();

  // ---- pointer input
  function jackAt(e) {
    const t = e.target;
    const jEl = t.closest && t.closest('[data-jack]');
    if (!jEl) return null;
    const hwEl = jEl.closest('[data-sbnode]');
    if (hwEl) return { node: hwEl.dataset.sbnode, key: jEl.dataset.jack };
    if (ctx.nv().g.contains(jEl)) return { node: 'pedal', key: jEl.dataset.jack };
    return null;
  }
  // can the dragged cable's loose end go into this jack?
  function fits(fixed, node, key) {
    if (!drag) return false;
    drag.badKind = null;
    if (key[0] !== (fixed.dir === 'out' ? 'i' : 'o') || node === fixed.node || isCtl(key) || isCtl(fixed.key)) return false;
    if (node !== 'pedal' && fixed.node !== 'pedal') return false; // the pedal sits between the hardware
    // the hardware input feeds the pedal, the pedal feeds the hardware output
    if ((node === 'hwin' && key[0] !== 'o') || (node === 'hwout' && key[0] !== 'i')) return false;
    const fk = kindOf(fixed.node, fixed.key), tk = kindOf(node, key);
    if (!kindsCompatible(fk, tk)) { drag.badKind = [fk, tk]; return false; }
    return true;
  }
  function jackUnder(e) {
    for (const t of document.elementsFromPoint(e.clientX, e.clientY)) {
      const j = jackAt({ target: t });
      if (j && fits(drag.fixed, j.node, j.key)) return j;
    }
    return null;
  }
  function toLocal(e) {
    const m = root.getScreenCTM();
    if (!m) return { x: 0, y: 0 };
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return { x: p.x, y: p.y };
  }
  function dragDraw(e) {
    const a = geom(drag.fixed.node, drag.fixed.key);
    if (!a) return;
    const target = jackUnder(e);
    let b;
    if (target) b = geom(target.node, target.key);
    else {
      const w = toLocal(e), dx = w.x - a.x, dy = w.y - a.y, len = Math.hypot(dx, dy) || 1;
      b = { x: w.x, y: w.y, dx: -(dx / len), dy: 0.2, free: true };
    }
    const kind = pairKind(a, b);
    drag.target = target;
    layerDrag.innerHTML = '';
    svg('path', { d: cablePath(a, b), fill: 'none', stroke: drag.color, 'stroke-width': CABLE_WIDTH[kind] || 5.6, 'stroke-linecap': 'round', opacity: 0.95 }, layerDrag);
    drawPlug(layerDrag, a, drag.color, kind);
    drawPlug(layerDrag, b, drag.color, kind);
  }

  me.down = (e) => {
    const j = jackAt(e);
    const cEl = e.target.closest && e.target.closest('[data-sbcable]');
    if (!j && !cEl) {
      if (selected) { selected = null; draw(); }
      return false;
    }
    if (e.button === 2) return true; // the context menu handles it
    if (e.button !== 0) return false;
    e.preventDefault();
    if (cEl && !j) {
      selected = cEl.dataset.sbcable;
      draw();
      return true;
    }
    if (isCtl(j.key)) return true; // control jacks have nothing to plug into here
    const port = portOf(j.key);
    let existing = null, fixed;
    if (j.key[0] === 'i') {
      existing = cables.find((c) => c.to.node === j.node && c.to.port === port);
      fixed = existing ? { node: existing.from.node, key: 'o' + existing.from.port, dir: 'out' } : { node: j.node, key: j.key, dir: 'in' };
    } else {
      if (e.shiftKey) existing = [...cables].reverse().find((c) => c.from.node === j.node && c.from.port === port);
      fixed = existing ? { node: existing.to.node, key: 'i' + existing.to.port, dir: 'in' } : { node: j.node, key: j.key, dir: 'out' };
    }
    root.setPointerCapture(e.pointerId);
    drag = { fixed, existing, color: existing ? existing.color : state.cableColor };
    selected = null;
    draw();
    dragDraw(e);
    return true;
  };
  me.move = (e) => {
    if (!drag) return false;
    dragDraw(e);
    return true;
  };
  me.up = (e) => {
    if (!drag) return false;
    const dr = drag;
    if (e.type !== 'pointercancel') dragDraw(e);
    drag = null;
    layerDrag.innerHTML = '';
    if (dr.target && e.type !== 'pointercancel') {
      const tp = portOf(dr.target.key), fp = portOf(dr.fixed.key);
      const from = dr.fixed.dir === 'out' ? { node: dr.fixed.node, port: fp } : { node: dr.target.node, port: tp };
      const to = dr.fixed.dir === 'out' ? { node: dr.target.node, port: tp } : { node: dr.fixed.node, port: fp };
      if (dr.existing) cables = cables.filter((c) => c !== dr.existing);
      connect(from, to, dr.color);
    } else if (dr.existing && e.type !== 'pointercancel') {
      unplug(dr.existing.id);
      toast('Cable unplugged', 'info', 1400);
    } else {
      if (dr.badKind) toast(`A ${KIND_NAMES[dr.badKind[0]] || dr.badKind[0]} cable doesn't fit a ${KIND_NAMES[dr.badKind[1]] || dr.badKind[1]} jack.`, 'warn', 3200);
      draw();
    }
    return true;
  };
  // right-click: on a cable, the board's cable menu; on a plugged jack, unplug it
  const onMenu = (e) => {
    const cEl = e.target.closest && e.target.closest('[data-sbcable]');
    const j = !cEl && jackAt(e);
    if (!cEl && !j) return;
    e.preventDefault();
    if (j) {
      const port = portOf(j.key);
      const c = cables.find((x) => (j.key[0] === 'i' ? x.to : x.from).node === j.node && (j.key[0] === 'i' ? x.to : x.from).port === port);
      if (c) unplug(c.id);
      return;
    }
    const id = cEl.dataset.sbcable;
    selected = id;
    draw();
    showMenu(e.clientX, e.clientY, [
      { title: 'Cable colour' },
      { swatches: CABLE_COLORS, onPick: (col) => { const c = cables.find((x) => x.id === id); if (c) { c.color = col; draw(); } } },
      { label: 'Unplug cable', icon: 'trash', kbd: 'Del', onClick: () => unplug(id) },
    ]);
  };
  root.addEventListener('contextmenu', onMenu);
  const onKey = (e) => {
    if (!selected || !root.isConnected) return;
    const tops = [...document.querySelectorAll('.pl-overlay')];
    if (!tops.length || !tops[tops.length - 1].contains(root)) return;
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); unplug(selected); }
  };
  document.addEventListener('keydown', onKey);
  openCount++;
  document.body.classList.add('sb-open');
  let closed = false;

  // the plugin was turned off, or the tab changed: close (which gives the board back)
  const offCat = bus.on('catalog', () => { if (!hasDef(d.id)) ctx.close(); });
  const view = document.getElementById('view-plugins');
  const mo = view && new MutationObserver(() => { if (!view.classList.contains('active')) ctx.close(); });
  if (mo) mo.observe(view, { attributes: true, attributeFilter: ['class'] });

  // ---- per frame: meters on the hardware
  let meterT = 0;
  me.tick = (now) => {
    if (now - meterT < 80) return;
    meterT = now;
    const st = state.status || {};
    for (const id of ['hwin', 'hwout']) {
      const peaks = id === 'hwin' ? st.inPeak : live ? st.outPeak : null;
      hw[id].meters.forEach((segs, i) => {
        const db = 20 * Math.log10(Math.max(1e-6, (peaks && peaks[i]) || 0));
        const lit = Math.round(Math.max(0, Math.min(1, (db + 54) / 54)) * segs.length);
        segs.forEach((s, k) => s.setAttribute('fill', k < lit ? (k >= 7 ? '#ff4d5e' : k >= 5 ? '#ffc24b' : '#37d6c2') : '#14181f'));
      });
    }
    if (live) pausedPill(true);
  };
  // the pedal was redrawn (some blocks change their jacks): drop cables to jacks that are gone
  me.redraw = () => {
    const ports = nodePorts(ctx.block());
    const n = cables.length;
    cables = cables.filter((c) => !(c.to.node === 'pedal' && c.to.port >= ports.ins.length) && !(c.from.node === 'pedal' && c.from.port >= ports.outs.length));
    if (cables.length !== n) sync();
    else if (live) setGraphOverride(graph);
    changed();
  };
  // a fresh block (Reset): same cables, new block in the engine
  me.reset = () => me.redraw();
  me.close = () => {
    if (closed) return;
    closed = true;
    goIdle();
    drag = null;
    offCat();
    if (mo) mo.disconnect();
    root.removeEventListener('contextmenu', onMenu);
    document.removeEventListener('keydown', onKey);
    if (--openCount <= 0) { openCount = 0; document.body.classList.remove('sb-open'); }
  };
  me.live = () => live;
  me.cables = () => cables.map((c) => ({ from: { ...c.from }, to: { ...c.to } }));
  me.hookUp = hookUp;
  me.unplugAll = unplugAll;
  return me;
}

// for tests
window.__tzSandboxIO = { log, live: () => !!owner, keys: { board: BOARD_KEY, sandbox: SB_KEY } };
