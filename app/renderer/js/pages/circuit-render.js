// Drawing circuits on a canvas: node sizes and port positions (shared by the editor's hit testing), the full
// editor view and the small PNG pictures in the circuit list.
import { PARTS, STAGES, portsOf, val } from './circuit-parts.js';

export const HEAD = 22, ROW = 15, NODE_W = 156;
const GROUP_VAR = { drive: '--fz-drive', dyn: '--fz-dyn', eq: '--fz-eq', mod: '--fz-mod', time: '--fz-time', pitch: '--fz-pitch', util: '--fz-util', route: '--teal', ctl: '--good', logic: '--warn', io: '--muted' };
const GROUP_FIX = { drive: '#ff7a2f', dyn: '#3ddc84', eq: '#37d6c2', mod: '#ffc24b', time: '#ff3d6e', pitch: '#ff3d6e', util: '#8d99a8', route: '#37d6c2', ctl: '#3ddc84', logic: '#ffc24b', io: '#8d99a8' };

/** Does a node show every value as a port, or just the wired ones? Engine parts start folded. */
export const showsAll = (n, expandAll) => expandAll || (n.open ?? !STAGES[n.t]);

/** Size and ports of every node: Map(id -> {x, y, w, h, ins: [{k, kind, x, y, l, param}], outs: [...]}) */
export function layout(G, o = {}) {
  const wiredIn = new Set();
  for (const w of G.wires) wiredIn.add(w.b.n + ' ' + w.b.p);
  const L = new Map();
  for (const n of G.nodes) {
    const pt = PARTS[n.t];
    if (pt && pt.io === 'note') {
      L.set(n.id, { x: n.x, y: n.y, w: n.w || 160, h: n.h || 60, ins: [], outs: [], note: true });
      continue;
    }
    const all = portsOf(n);
    const full = showsAll(n, o.expandAll || (o.expand && o.expand.has(n.id)));
    const ins = all.ins.filter((p) => p.kind === 'a' || full || wiredIn.has(n.id + ' ' + p.k));
    const hidden = all.ins.length - ins.length;
    const w = pt && pt.io ? (pt.io === 'ctl' || pt.io === 'cout' ? 128 : 104) : NODE_W;
    const rows = Math.max(1, ins.length + (hidden ? 1 : 0), all.outs.length);
    const h = HEAD + rows * ROW + 6;
    const box = { x: n.x, y: n.y, w, h, hidden, ins: [], outs: [] };
    ins.forEach((p, i) => box.ins.push({ ...p, x: n.x, y: n.y + HEAD + i * ROW + ROW / 2 + 2 }));
    all.outs.forEach((p, i) => box.outs.push({ ...p, x: n.x + w, y: n.y + HEAD + i * ROW + ROW / 2 + 2 }));
    L.set(n.id, box);
  }
  return L;
}
/** Where a wire ends: the port, or the node's edge when the port is folded away. */
export function portPos(L, end, out) {
  const b = L.get(end.n);
  if (!b) return null;
  const p = (out ? b.outs : b.ins).find((x) => x.k === end.p);
  if (p) return p;
  return { x: out ? b.x + b.w : b.x, y: b.y + b.h - 8, folded: true };
}
export function wirePath(ctx, a, b) {
  const dx = Math.max(30, Math.abs(b.x - a.x) * 0.45);
  ctx.moveTo(a.x, a.y);
  ctx.bezierCurveTo(a.x + dx, a.y, b.x - dx, b.y, b.x, b.y);
}
export function fmtParam(p, v) {
  if (p.opts && p.i) return p.opts[Math.round(v) - (p.min || 0)] ?? String(Math.round(v));
  if (p.i) return String(Math.round(v));
  if (p.unit === 'ms') return v >= 1000 ? (v / 1000).toFixed(2) + ' s' : Math.round(v) + ' ms';
  if (p.unit === 's') return v.toFixed(2) + ' s';
  if (p.raw) return Math.abs(v) >= 100 ? String(Math.round(v)) : String(Math.round(v * 100) / 100);
  if (p.unit === 'Hz') return v >= 1000 ? (v / 1000).toFixed(1) + ' k' : v >= 10 ? Math.round(v) + ' Hz' : v.toFixed(2) + ' Hz';
  if (p.unit === 'dB' || (p.min < 0 && p.max > 0)) return (v > 0 ? '+' : '') + v.toFixed(1);
  if (p.max > 20) return String(Math.round(v));
  return v.toFixed(2);
}

/** Theme colours from the app's CSS variables (the editor follows the app theme). */
export function themeColors(elm) {
  const cs = getComputedStyle(elm || document.documentElement);
  const v = (k, d) => (cs.getPropertyValue(k) || '').trim() || d;
  const groups = {};
  for (const [g, k] of Object.entries(GROUP_VAR)) groups[g] = v(k, GROUP_FIX[g]);
  return {
    bg: v('--bg1', '#0f1218'), grid: v('--grid-line', 'rgba(255,255,255,0.04)'), node: v('--bg3', '#1b202b'), node2: v('--bg4', '#232937'),
    text: v('--text', '#e9ecf3'), text2: v('--text2', '#b8bfcd'), muted: v('--muted', '#7d8597'), line: v('--line2', 'rgba(255,255,255,0.11)'),
    audio: v('--accent', '#ff7a2f'), ctl: v('--teal', '#37d6c2'), bin: v('--warn', '#ffc24b'), sel: v('--accent', '#ff7a2f'), err: v('--bad', '#ff4d5e'), warn: v('--warn', '#ffc24b'),
    note: 'rgba(255, 214, 102, 0.16)', noteText: v('--text', '#e9ecf3'), groups,
  };
}
const FIXED = {
  bg: '#141821', grid: 'rgba(255,255,255,0.035)', node: '#222836', node2: '#2a3242', text: '#e9ecf3', text2: '#b8bfcd', muted: '#7d8597', line: 'rgba(255,255,255,0.14)',
  audio: '#ff8a45', ctl: '#45d8c6', bin: '#ffc24b', sel: '#ff8a45', err: '#ff4d5e', warn: '#ffc24b', note: 'rgba(255, 214, 102, 0.2)', noteText: '#f4ead0', groups: GROUP_FIX,
};

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
const portKindOf = (G, L, end, out) => {
  const b = L.get(end.n);
  const p = b && (out ? b.outs : b.ins).find((x) => x.k === end.p);
  if (p) return p.kind;
  return end.p.startsWith('@') ? 'c' : 'a';
};
// a wire looks like what it carries: the signal of its source port
const wireSig = (G, L, w) => {
  const b = L.get(w.a.n);
  const p = b && b.outs.find((x) => x.k === w.a.p);
  return p ? p.sig || (p.kind === 'a' ? 'a' : 'n') : portKindOf(G, L, w.b, false) === 'a' ? 'a' : 'n';
};
/** Wire looks per signal: colour key, width, dash. Audio thick solid, analog thin solid, binary dashed. */
export const WIRE_STYLE = { a: { col: 'audio', w: 2.6, dash: [] }, n: { col: 'ctl', w: 1.6, dash: [] }, b: { col: 'bin', w: 1.6, dash: [5, 4] } };

/**
 * Draw graph G. o: { L (layout), view: {x, y, z}, w, h, sel: Set, selWires: Set, hover, issues: Map(node -> level),
 * badWires: Set, drag: {a: {x, y}, b: {x, y}, kind}, marquee, colors, detail (text on), grid }
 */
export function drawGraph(ctx, G, o) {
  const C = o.colors || FIXED;
  const L = o.L || layout(G);
  const z = o.view.z;
  ctx.save();
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, o.w, o.h);
  ctx.translate(o.view.x, o.view.y);
  ctx.scale(z, z);
  const x0 = -o.view.x / z, y0 = -o.view.y / z, x1 = x0 + o.w / z, y1 = y0 + o.h / z;
  if (o.grid && z > 0.35) {
    ctx.strokeStyle = C.grid;
    ctx.lineWidth = 1 / z;
    ctx.beginPath();
    const g = 32;
    for (let x = Math.floor(x0 / g) * g; x < x1; x += g) ctx.moveTo(x, y0), ctx.lineTo(x, y1);
    for (let y = Math.floor(y0 / g) * g; y < y1; y += g) ctx.moveTo(x0, y), ctx.lineTo(x1, y);
    ctx.stroke();
  }
  const visible = (b) => b.x + b.w > x0 - 40 && b.x < x1 + 40 && b.y + b.h > y0 - 40 && b.y < y1 + 40;
  const detail = o.detail !== false && z > 0.45;
  // notes sit under everything
  for (const n of G.nodes) {
    const b = L.get(n.id);
    if (!b || !b.note || !visible(b)) continue;
    ctx.fillStyle = C.note;
    roundRect(ctx, b.x, b.y, b.w, b.h, 6);
    ctx.fill();
    if (o.sel && o.sel.has(n.id)) {
      ctx.strokeStyle = C.sel;
      ctx.lineWidth = 2 / z;
      ctx.stroke();
    }
    if (detail) {
      ctx.fillStyle = C.noteText;
      ctx.font = '12px Inter, system-ui, sans-serif';
      wrapText(ctx, n.text || '', b.x + 8, b.y + 18, b.w - 16, 15, Math.floor((b.h - 8) / 15));
    }
  }
  // wires
  ctx.lineCap = 'round';
  for (const w of G.wires) {
    const a = portPos(L, w.a, true), b = portPos(L, w.b, false);
    if (!a || !b) continue;
    if (Math.max(a.x, b.x) < x0 - 60 || Math.min(a.x, b.x) > x1 + 60 || Math.max(a.y, b.y) < y0 - 60 || Math.min(a.y, b.y) > y1 + 60) continue;
    const sig = wireSig(G, L, w);
    const ws = WIRE_STYLE[sig] || WIRE_STYLE.n;
    const selW = o.selWires && o.selWires.has(w.id);
    const hot = o.hover && (o.hover.wire === w.id || o.hover.node === w.a.n || o.hover.node === w.b.n);
    const bad = o.badWires && o.badWires.has(w.id);
    ctx.beginPath();
    wirePath(ctx, a, b);
    ctx.strokeStyle = bad ? C.err : C[ws.col] || C.ctl;
    ctx.globalAlpha = selW || hot ? 1 : sig === 'a' ? 0.85 : 0.75;
    ctx.lineWidth = ws.w + (selW ? 1.6 : hot ? 0.8 : 0);
    ctx.setLineDash(ws.dash);
    ctx.stroke();
    if (selW) {
      ctx.globalAlpha = 0.25;
      ctx.lineWidth += 5;
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
  ctx.setLineDash([]);
  // nodes
  ctx.textBaseline = 'middle';
  for (const n of G.nodes) {
    const b = L.get(n.id);
    if (!b || b.note || !visible(b)) continue;
    const pt = PARTS[n.t] || { name: n.t, group: 'util', params: [] };
    const gc = C.groups[pt.group] || C.muted;
    const selN = o.sel && o.sel.has(n.id);
    const hot = o.hover && o.hover.node === n.id;
    ctx.fillStyle = C.node;
    roundRect(ctx, b.x, b.y, b.w, b.h, 7);
    ctx.fill();
    const issue = o.issues && o.issues.get(n.id);
    ctx.lineWidth = (selN ? 2.2 : 1) / Math.min(1, z);
    ctx.strokeStyle = selN ? C.sel : issue === 'error' ? C.err : issue === 'warn' ? C.warn : hot ? C.text2 : C.line;
    ctx.stroke();
    // header
    ctx.save();
    roundRect(ctx, b.x, b.y, b.w, b.h, 7);
    ctx.clip();
    ctx.fillStyle = gc;
    ctx.globalAlpha = 0.24;
    ctx.fillRect(b.x, b.y, b.w, HEAD);
    ctx.globalAlpha = 1;
    ctx.fillRect(b.x, b.y, 3, HEAD);
    ctx.restore();
    const off = n.p && n.p.on === 0 && !pt.io;
    if (!detail && o.labels) {
      // small pictures: just the part name, readable at any scale
      ctx.fillStyle = C.text;
      ctx.font = `600 ${(10 / z).toFixed(1)}px Inter, system-ui, sans-serif`;
      const nm = pt.io && pt.io !== 'note' ? n.name || pt.name : n.label || pt.name;
      ctx.fillText(clip(ctx, nm, b.w - 6 / z), b.x + 5 / z, b.y + HEAD / 2 + 0.5);
    }
    if (detail) {
      ctx.fillStyle = off ? C.muted : C.text;
      ctx.font = '600 11.5px Inter, system-ui, sans-serif';
      const title = pt.io && pt.io !== 'note' ? n.name || pt.name : n.label || pt.name;
      ctx.fillText(clip(ctx, title + (off ? ' (off)' : ''), b.w - 22), b.x + 9, b.y + HEAD / 2 + 0.5);
      if (pt.io === 'ctl' || pt.io === 'in' || pt.io === 'out' || pt.io === 'cout') {
        ctx.fillStyle = C.muted;
        ctx.font = '10px Inter, system-ui, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(ioTag(n, pt), b.x + b.w - 8, b.y + HEAD / 2 + 0.5);
        ctx.textAlign = 'left';
      } else if (STAGES[n.t]) {
        // fold toggle
        ctx.fillStyle = C.muted;
        ctx.font = '10px Inter, system-ui, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(showsAll(n, o.expandAll) ? '▴' : '▾', b.x + b.w - 8, b.y + HEAD / 2 + 0.5);
        ctx.textAlign = 'left';
      }
    }
    // ports
    for (const p of b.ins) {
      dot(ctx, p.x, p.y, p.sig || p.kind, C, o.dragKind && o.dragKind !== p.kind);
      if (!detail) continue;
      ctx.fillStyle = C.text2;
      ctx.font = '10.5px Inter, system-ui, sans-serif';
      ctx.fillText(clip(ctx, p.l, b.w * 0.55), p.x + 8, p.y);
      if (p.param) {
        ctx.fillStyle = C.muted;
        ctx.textAlign = 'right';
        const wired = G.wires.some((w) => w.b.n === n.id && w.b.p === p.k);
        ctx.fillText(wired ? 'wired' : fmtParam(p.param, val(n, p.param)), b.x + b.w - (b.outs.some((q) => Math.abs(q.y - p.y) < 2) ? 34 : 8), p.y);
        ctx.textAlign = 'left';
      }
    }
    if (b.hidden && detail) {
      ctx.fillStyle = C.muted;
      ctx.font = '10px Inter, system-ui, sans-serif';
      ctx.fillText(`+ ${b.hidden} values`, b.x + 8, b.y + HEAD + b.ins.length * ROW + ROW / 2 + 2);
    }
    for (const p of b.outs) {
      dot(ctx, p.x, p.y, p.sig || p.kind, C, o.dragKind && o.dragKind !== p.kind);
      if (!detail) continue;
      ctx.fillStyle = C.text2;
      ctx.font = '10.5px Inter, system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(p.l, p.x - 8, p.y);
      ctx.textAlign = 'left';
    }
    if (pt.io === 'ctl' && detail) {
      ctx.fillStyle = C.muted;
      ctx.font = '10px Inter, system-ui, sans-serif';
      ctx.fillText(clip(ctx, ctlSummary(n), b.w - 44), b.x + 9, b.y + HEAD + ROW / 2 + 2);
    }
  }
  // a wire being dragged
  if (o.drag) {
    ctx.beginPath();
    wirePath(ctx, o.drag.a, o.drag.b);
    const ds = WIRE_STYLE[o.drag.sig || (o.drag.kind === 'c' ? 'n' : 'a')] || WIRE_STYLE.n;
    ctx.strokeStyle = C[ds.col] || C.ctl;
    ctx.lineWidth = 2.2;
    ctx.setLineDash(ds.dash);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  if (o.marquee) {
    const m = o.marquee;
    ctx.fillStyle = 'rgba(255,122,47,0.08)';
    ctx.strokeStyle = C.sel;
    ctx.lineWidth = 1 / z;
    ctx.setLineDash([4 / z, 3 / z]);
    ctx.fillRect(Math.min(m.x0, m.x1), Math.min(m.y0, m.y1), Math.abs(m.x1 - m.x0), Math.abs(m.y1 - m.y0));
    ctx.strokeRect(Math.min(m.x0, m.x1), Math.min(m.y0, m.y1), Math.abs(m.x1 - m.x0), Math.abs(m.y1 - m.y0));
    ctx.setLineDash([]);
  }
  ctx.restore();
}
// port shapes: audio circle, analog diamond, binary square
function dot(ctx, x, y, kind, C, dim) {
  ctx.globalAlpha = dim ? 0.25 : 1;
  ctx.fillStyle = kind === 'a' ? C.audio : kind === 'b' ? C.bin : C.ctl;
  ctx.beginPath();
  if (kind === 'a') ctx.arc(x, y, 4.2, 0, Math.PI * 2);
  else if (kind === 'b') ctx.rect(x - 3.2, y - 3.2, 6.4, 6.4);
  else {
    ctx.moveTo(x, y - 3.6);
    ctx.lineTo(x + 3.6, y);
    ctx.lineTo(x, y + 3.6);
    ctx.lineTo(x - 3.6, y);
    ctx.closePath();
  }
  ctx.fill();
  ctx.globalAlpha = 1;
}
// the small tag in the header of input and output parts
function ioTag(n, pt) {
  if (pt.io === 'in') return 'in';
  if (pt.io === 'out') return 'out';
  if (pt.io === 'cout') return n.t === 'binout' ? 'binary out' : 'analog out';
  if (n.t === 'binary') return 'binary';
  return n.steps >= 2 ? n.steps + ' steps' : 'analog';
}
// the default (and range) line of a control input
function ctlSummary(n) {
  if (n.t === 'binary') return 'default ' + ((n.opts && n.opts[n.def ? 1 : 0]) || (n.def ? 'on' : 'off'));
  if (n.steps >= 2) return 'default ' + ((n.opts && n.opts[n.def | 0]) || 'pos ' + ((n.def | 0) + 1));
  const f = (v) => String(+(+v).toFixed(2));
  const lo = n.min ?? 0, hi = n.max ?? 1;
  return lo === 0 && hi === 1 ? 'default ' + f(n.def ?? 0.5) : `${f(n.def ?? 0.5)} of ${f(lo)}..${f(hi)}`;
}
/** A small key for the signal kinds (audio, analog, binary), as an SVG string for the editor and the diagram. */
export function legendSVG() {
  const item = (x, label, sig) => {
    const st = WIRE_STYLE[sig];
    const col = sig === 'a' ? 'var(--accent)' : sig === 'b' ? 'var(--warn)' : 'var(--teal)';
    const shape = sig === 'a' ? `<circle cx="${x + 26}" cy="8" r="3.6" fill="${col}"/>` : sig === 'b' ? `<rect x="${x + 23}" y="5" width="6" height="6" fill="${col}"/>` : `<path d="M${x + 26} 4.6l3.4 3.4-3.4 3.4-3.4-3.4z" fill="${col}"/>`;
    return `<g><path d="M${x} 8h20" stroke="${col}" stroke-width="${st.w}" stroke-dasharray="${st.dash.join(' ')}" fill="none"/>${shape}<text x="${x + 34}" y="11.5">${label}</text></g>`;
  };
  return `<svg class="sig-legend-svg" width="210" height="16" viewBox="0 0 210 16">${item(2, 'Audio', 'a')}${item(72, 'Analog', 'n')}${item(144, 'Binary', 'b')}</svg>`;
}
const clipCache = new Map();
function clip(ctx, s, w) {
  s = String(s || '');
  const k = ctx.font + '|' + w + '|' + s;
  if (clipCache.has(k)) return clipCache.get(k);
  let r = s;
  if (ctx.measureText(s).width > w) {
    while (r.length > 1 && ctx.measureText(r + '...').width > w) r = r.slice(0, -1);
    r += '...';
  }
  if (clipCache.size > 4000) clipCache.clear();
  clipCache.set(k, r);
  return r;
}
function wrapText(ctx, text, x, y, w, lh, max) {
  let line = '', n = 0;
  for (const word of String(text).split(/\s+/)) {
    const t = line ? line + ' ' + word : word;
    if (ctx.measureText(t).width > w && line) {
      ctx.fillText(line, x, y + n * lh);
      line = word;
      if (++n >= max) return;
    } else line = t;
  }
  if (line && n < max) ctx.fillText(line, x, y + n * lh);
}

/** Bounds of a graph's nodes. */
export function bounds(G, L = layout(G)) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const b of L.values()) {
    x0 = Math.min(x0, b.x);
    y0 = Math.min(y0, b.y);
    x1 = Math.max(x1, b.x + b.w);
    y1 = Math.max(y1, b.y + b.h);
  }
  if (!isFinite(x0)) return { x0: 0, y0: 0, x1: 100, y1: 100 };
  return { x0, y0, x1, y1 };
}
/** A PNG (data URL) picture of a circuit for the circuit list. */
export function renderThumb(G, w = 300, h = 180) {
  const cv = document.createElement('canvas');
  const k = 2;
  cv.width = w * k;
  cv.height = h * k;
  const ctx = cv.getContext('2d');
  ctx.scale(k, k);
  const L = layout(G);
  const b = bounds(G, L);
  const pad = 14;
  const z = Math.min((w - pad * 2) / (b.x1 - b.x0 || 1), (h - pad * 2) / (b.y1 - b.y0 || 1), 1.2);
  const view = { z, x: (w - (b.x1 - b.x0) * z) / 2 - b.x0 * z, y: (h - (b.y1 - b.y0) * z) / 2 - b.y0 * z };
  drawGraph(ctx, G, { L, view, w, h, colors: FIXED, detail: z > 0.42, grid: true, labels: true });
  return cv.toDataURL('image/png');
}
