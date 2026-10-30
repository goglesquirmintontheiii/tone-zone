// The circuit board seen through a clear enclosure, built from the pedal's own circuits: chips and parts for
// every circuit part (an op-amp for a drive, a DSP with its crystal for a delay, logic chips for gates ...),
// traces that follow the circuit wiring, and wires from the board to every control, jack and screen.
// Same design, same board: everything comes from the design itself, nothing random between draws.
import { svg, clamp } from '../util.js';

const r2 = (v) => Math.round(v * 100) / 100;
function rng(seed) {
  let s = 2166136261;
  for (const ch of String(seed)) s = Math.imul(s ^ ch.charCodeAt(0), 16777619);
  return () => {
    s = Math.imul(s ^ (s >>> 15), 2246822507);
    s = Math.imul(s ^ (s >>> 13), 3266489909);
    return ((s ^= s >>> 16) >>> 0) / 4294967296;
  };
}

// ------------------------------------------------------------------ what each circuit part is made of
// chips: [package, pins, part number]; r resistors, c film caps, k ceramic caps, e electrolytics, d diodes,
// t trimmers, x crystal, ldr light dependent resistors, ind inductor. pack: how many parts share one chip.
const S = (chips, o = {}) => ({ chips, r: 0, c: 0, k: 0, e: 0, d: 0, t: 0, x: 0, ldr: 0, ind: 0, ...o });
const DSP = (main, pins, extra = [], o = {}) => S([['qfp', pins, main], ...extra], { x: 1, k: 4, e: 2, r: 3, ...o });
export const PCB_PARTS = {
  boost: S([['to92', 3, '2N5457']], { r: 4, c: 2, e: 1, t: 1 }),
  overdrive: S([['dip', 8, 'JRC4558']], { r: 6, c: 3, k: 1, e: 2, d: 2 }),
  distortion: S([['dip', 8, 'LM308N']], { r: 6, c: 3, e: 2, d: 2 }),
  fuzz: S([['to92', 3, '2N5088'], ['to92', 3, '2N5088'], ['to92', 3, '2N5088']], { r: 6, c: 3, e: 2 }),
  amp: S([['dip', 8, 'TL072'], ['to92', 3, 'J201'], ['to92', 3, 'J201']], { r: 7, c: 4, e: 2 }),
  comp: S([['dip', 8, 'CA3080'], ['dip', 8, 'TL072']], { r: 6, c: 2, e: 2, t: 1 }),
  gate: S([['dip', 8, 'LM393']], { r: 3, c: 1, e: 1 }),
  swell: S([['dip', 16, 'V2164'], ['dip', 8, 'TL072']], { r: 4, c: 2, e: 1 }),
  eq: S([['dip', 14, 'TL074']], { r: 8, c: 4, e: 1 }),
  wah: S([['to92', 3, '2N5089'], ['to92', 3, '2N5089']], { r: 5, c: 2, e: 2, ind: 1 }),
  chorus: S([['dip', 8, 'MN3207'], ['dip', 8, 'MN3102'], ['dip', 8, 'TL072']], { r: 6, c: 4, e: 2, t: 1 }),
  phaser: S([['dip', 14, 'TL074']], { r: 6, c: 4, e: 1, t: 1, jfets: 1 }),
  flanger: S([['dip', 8, 'MN3007'], ['dip', 8, 'MN3101'], ['dip', 8, 'TL072']], { r: 6, c: 3, e: 2, t: 2 }),
  vibe: S([['dip', 8, 'TL072'], ['to92', 3, '2N5088']], { r: 5, c: 4, e: 2, ldr: 4 }),
  tremolo: S([['dip', 8, 'TL072'], ['to92', 3, '2N3904']], { r: 5, c: 2, e: 2, ldr: 1 }),
  rotary: DSP('ADAU1701', 48, [['soic', 8, '24LC256']]),
  ringmod: S([['dip', 14, 'MC1496'], ['dip', 8, 'TL072']], { r: 6, c: 2, e: 1 }),
  delay: S([['soic', 28, 'FV-1'], ['soic', 8, '24LC32']], { x: 1, r: 4, k: 4, e: 2, c: 2 }),
  reverb: DSP('ADAU1701', 48, [['soic', 8, '24LC256'], ['tssop', 20, 'PCM3060']], { k: 6, e: 3 }),
  freeze: DSP('STM32F4', 64, [['tssop', 20, 'CS4270'], ['tsop', 44, 'SDRAM']]),
  slicer: S([['qfn', 32, 'ATMEGA328']], { x: 1, r: 3, k: 2, e: 1 }),
  octave: DSP('STM32H7', 64, [['tssop', 20, 'CS4270']], { k: 6 }),
  pitch: DSP('STM32H7', 64, [['tssop', 20, 'CS4270']], { k: 6 }),
  synth: DSP('STM32H7', 64, [['tssop', 20, 'CS4270'], ['soic', 8, 'W25Q64']], { k: 6, e: 3 }),
  lofi: S([['qfn', 56, 'RP2040'], ['soic', 8, 'W25Q16']], { x: 1, r: 3, k: 4, e: 2 }),
  crusher: S([['qfn', 32, 'ATSAMD21']], { x: 1, r: 2, k: 2, e: 1 }),
  volume: S([], { r: 2, c: 1 }),
  level: S([['dip', 8, 'NE5532']], { r: 2, c: 1, e: 1 }),
  filter: S([['dip', 16, 'LM13700']], { r: 6, c: 2, e: 1, t: 1 }),
  shaper: S([['dip', 8, 'TL072']], { r: 3, c: 1, d: 4 }),
  vca: S([['dip', 16, 'V2164']], { r: 3, c: 1 }),
  mixer: S([['dip', 14, 'TL074']], { r: 6, c: 1 }),
  xfade: S([['dip', 8, 'TL072']], { r: 3 }),
  switch: S([['dip', 16, 'CD4053']], { r: 2 }),
  pol: S([['dip', 8, 'TL072']], { r: 3 }),
  fb: S([['dip', 16, 'PT2399']], { r: 4, c: 3, e: 2 }),
  env: S([['dip', 8, 'TL072']], { r: 3, c: 1, e: 1, d: 2 }),
  lfo: S([['dip', 8, 'ATTINY85']], { r: 2, k: 1, e: 1 }),
  seq: S([['qfp', 32, 'ATMEGA328P']], { x: 1, r: 2, k: 2 }),
  const: S([], { t: 1, r: 1 }),
  scale: S([['dip', 8, 'TL072']], { r: 3, c: 1 }),
  math: S([['dip', 8, 'TL072']], { r: 3 }),
  smooth: S([], { r: 1, e: 1 }),
  sh: S([['dip', 8, 'LF398']], { c: 1, r: 1 }),
  and: S([['dip', 14, '74HC08']], { pack: 4 }),
  or: S([['dip', 14, '74HC32']], { pack: 4 }),
  xor: S([['dip', 14, '74HC86']], { pack: 4 }),
  not: S([['dip', 14, '74HC04']], { pack: 6 }),
  toggle: S([['dip', 14, 'CD4013']], { pack: 2, r: 1 }),
  cmp: S([['dip', 8, 'LM393']], { pack: 2, r: 2 }),
  window: S([['dip', 14, 'LM339']], { pack: 2, r: 2 }),
  add: S([['soic', 14, 'ATTINY1614']], { pack: 8, k: 1, group: 'mcu' }),
  sub: S([['soic', 14, 'ATTINY1614']], { pack: 8, k: 1, group: 'mcu' }),
  mul: S([['soic', 14, 'ATTINY1614']], { pack: 8, k: 1, group: 'mcu' }),
  div: S([['soic', 14, 'ATTINY1614']], { pack: 8, k: 1, group: 'mcu' }),
  cdelay: S([['soic', 14, 'ATTINY1614']], { pack: 8, k: 1, group: 'mcu' }),
};
const DIGITAL = new Set(['qfp', 'qfn', 'soic', 'tssop', 'tsop']);

// ------------------------------------------------------------------ part sizes (millimetres, leads included)
const PITCH = { dip: 2.54, soic: 1.27, tssop: 0.65, tsop: 0.8, qfp: 0.5, qfn: 0.5 };
function chipSize(pkg, pins) {
  const half = pins / 2, side = pins / 4;
  switch (pkg) {
    case 'dip': return { w: half * 2.54 + 0.4, h: 9.4, bw: half * 2.54 + 0.4, bh: 6.4 };
    case 'soic': return { w: half * 1.27 + 0.5, h: 6, bw: half * 1.27 + 0.5, bh: pins > 16 ? 7.5 : 3.9 };
    case 'tssop': return { w: half * 0.65 + 0.6, h: 6.4, bw: half * 0.65 + 0.6, bh: 4.4 };
    case 'tsop': return { w: half * 0.8 + 0.8, h: 11.8, bw: half * 0.8 + 0.8, bh: 10.2 };
    case 'qfp': {
      const p = pins <= 32 ? 0.8 : 0.5;
      const s = side * p + 1.4;
      return { w: s + 2.4, h: s + 2.4, bw: s, bh: s, p };
    }
    case 'qfn': { const s = side * 0.5 + 1; return { w: s, h: s, bw: s, bh: s }; }
    case 'to92': return { w: 4.8, h: 4.6, bw: 4.6, bh: 3.6 };
    default: return { w: 6, h: 6, bw: 6, bh: 6 };
  }
}
const PASSIVE = {
  r: { w: 8.6, h: 2.2 }, c: { w: 7.2, h: 3.4 }, k: { w: 4, h: 2.6 }, e: { w: 6.4, h: 6.4 }, d: { w: 6.6, h: 1.8 },
  t: { w: 6.6, h: 6.6 }, x: { w: 11.4, h: 4.6 }, ldr: { w: 5.2, h: 4.4 }, ind: { w: 9, h: 9 }, to220: { w: 10.4, h: 4.8 }, sot223: { w: 7, h: 7 },
};
const BANDS = ['#111111', '#8a4b1e', '#c9302c', '#e56b1f', '#f2c230', '#3a9a5b', '#2b7bd6', '#8b5bd6', '#8d99a8', '#f4f1e8'];
const FILM = ['#c9302c', '#e0a21b', '#3a9a5b', '#2b7bd6', '#d6487e'];
const WIRE = ['#d63a2f', '#2b2b2b', '#f2c230', '#2f7bd6', '#3a9a5b', '#f4f1e8', '#e56b1f'];

// mixes a hex colour toward white (k > 0) or black (k < 0)
function shade(hex, k) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  const n = m ? parseInt(m[1], 16) : 0x1f6b3a;
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => Math.round(k > 0 ? c + (255 - c) * k : c * (1 + k)));
  return '#' + ch.map((c) => clamp(c, 0, 255).toString(16).padStart(2, '0')).join('');
}

// ------------------------------------------------------------------ the parts list for a design
const IO_PARTS = new Set(['in', 'out', 'analog', 'binary', 'knob', 'anaout', 'binout', 'note']);
/** The clusters of parts the board carries: one per circuit part (shared chips for small logic), plus power and display. */
export function pcbParts(d) {
  const C = d.circuit || {};
  const out = [];
  const nodeCluster = new Map(); // 'inst.node' -> cluster index
  const shared = new Map(); // spec key -> { cluster, used }
  const insts = Array.isArray(C.insts) ? C.insts : [];
  const add = (cl) => (out.push(cl), out.length - 1);
  for (const inst of insts) {
    const nodes = ((inst.graph && inst.graph.nodes) || []).filter((n) => !IO_PARTS.has(n.t) && PCB_PARTS[n.t]);
    nodes.sort((a, b) => (a.x || 0) - (b.x || 0) || (a.y || 0) - (b.y || 0));
    for (const n of nodes) {
      const sp = PCB_PARTS[n.t];
      const key = sp.group || n.t;
      if (sp.pack) {
        const sh = shared.get(key);
        if (sh && sh.used < sp.pack) {
          sh.used++;
          nodeCluster.set(inst.id + '.' + n.id, sh.cluster);
          continue;
        }
        const idx = add({ type: n.t, spec: sp, nodes: [inst.id + '.' + n.id] });
        shared.set(key, { cluster: idx, used: 1 });
        nodeCluster.set(inst.id + '.' + n.id, idx);
        continue;
      }
      let spec = sp;
      if (sp.jfets) spec = { ...sp, jfet: clamp(Math.round((n.p && n.p.stages) || 4), 2, 6) };
      nodeCluster.set(inst.id + '.' + n.id, add({ type: n.t, spec, nodes: [inst.id + '.' + n.id] }));
    }
  }
  // older designs that only carry the stage summary
  if (!out.length) for (const s of C.stages || []) if (PCB_PARTS[s.type]) add({ type: s.type, spec: PCB_PARTS[s.type], nodes: [] });
  const digital = out.some((c) => c.spec.chips.some((ch) => DIGITAL.has(ch[0])));
  const screens = (d.ctls || []).filter((c) => c.kind === 'screen' && !c.hidden);
  const display = screens.length ? add({ type: 'display', spec: S([['qfp', 48, 'STM32G0']], { x: 1, k: 3, r: 2 }), nodes: [] }) : -1;
  const power = add({ type: 'power', spec: S([], { e: 2, d: 1, k: 1, reg: digital || display >= 0 ? 'sot223' : 'to220' }), nodes: [] });
  return { clusters: out, nodeCluster, display, power };
}

// lays out one cluster: chips in a row, then its small parts in rows under them (natural mm)
function layoutCluster(cl, rnd) {
  const sp = cl.spec;
  const items = [];
  for (const [pkg, pins, label] of sp.chips) items.push({ kind: 'chip', pkg, pins, label, ...chipSize(pkg, pins) });
  for (let i = 0; i < (sp.jfet || 0); i++) items.push({ kind: 'chip', pkg: 'to92', pins: 3, label: 'J201', ...chipSize('to92', 3) });
  if (sp.reg) items.push({ kind: sp.reg, label: sp.reg === 'sot223' ? 'AMS1117' : 'L7809', ...PASSIVE[sp.reg] });
  if (sp.x) items.push({ kind: 'x', label: cl.type === 'display' ? '8MHz' : '12.288', ...PASSIVE.x });
  if (sp.ind) items.push({ kind: 'ind', ...PASSIVE.ind });
  const row1 = items.slice();
  const small = [];
  for (const k of ['e', 't', 'ldr', 'c', 'k', 'd', 'r']) for (let i = 0; i < (sp[k] || 0); i++) small.push({ kind: k, ...PASSIVE[k], v: rnd() });
  const gap = 1.4;
  let x = 0, h1 = 0;
  for (const it of row1) {
    it.x = x;
    it.y = 0;
    x += it.w + gap;
    h1 = Math.max(h1, it.h);
  }
  for (const it of row1) it.y = (h1 - it.h) / 2;
  const w1 = Math.max(0, x - gap);
  const maxW = Math.max(w1, 16);
  let rx = 0, ry = h1 ? h1 + gap : 0, rh = 0, wMax = w1;
  for (const it of small) {
    if (rx > 0 && rx + it.w > maxW) {
      rx = 0;
      ry += rh + gap * 0.7;
      rh = 0;
    }
    it.x = rx;
    it.y = ry;
    rx += it.w + gap * 0.7;
    rh = Math.max(rh, it.h);
    wMax = Math.max(wMax, rx - gap * 0.7);
  }
  // centre the chip row over the parts
  const off = (wMax - w1) / 2;
  for (const it of row1) it.x += off;
  cl.items = [...row1, ...small];
  cl.w = Math.max(wMax, 4);
  cl.h = Math.max(4, ry + rh);
  return cl;
}

// shelf packing: clusters left to right in rows of the given width; rows are centred
function pack(clusters, width, gap) {
  const rows = [];
  let row = { items: [], w: 0, h: 0 };
  for (const cl of clusters) {
    if (row.items.length && row.w + gap + cl.w > width) {
      rows.push(row);
      row = { items: [], w: 0, h: 0 };
    }
    row.w += (row.items.length ? gap : 0) + cl.w;
    row.h = Math.max(row.h, cl.h);
    row.items.push(cl);
  }
  if (row.items.length) rows.push(row);
  let y = 0, wMax = 0;
  for (const r of rows) {
    let x = Math.max(0, (width - r.w) / 2);
    for (const cl of r.items) {
      cl.x = x;
      cl.y = y + (r.h - cl.h) / 2;
      x += cl.w + gap;
    }
    y += r.h + gap;
    wMax = Math.max(wMax, r.w);
  }
  return { w: wMax, h: Math.max(0, y - gap), rows };
}

// ------------------------------------------------------------------ drawing the parts
function drawChip(g, it, ref, acc) {
  const { pkg, pins } = it;
  const cx = it.x + it.w / 2, cy = it.y + it.h / 2;
  const grp = svg('g', { 'data-chip': (pkg === 'to92' ? 'TO-92' : pkg.toUpperCase() + '-' + pins), 'data-label': it.label }, g);
  if (pkg === 'to92') {
    // flat side forward, three leads behind
    for (let i = -1; i <= 1; i++) acc.pins += `M${r2(cx + i * 1.27 - 0.25)},${r2(cy + 1)}h0.5v1.4h-0.5z`;
    svg('path', { d: `M${r2(cx - 2.3)},${r2(cy + 1.2)}H${r2(cx + 2.3)}A2.3 2.3 0 0 0 ${r2(cx - 2.3)},${r2(cy + 1.2)}Z`, fill: '#1a1b1e', stroke: '#000', 'stroke-width': 0.15 }, grp);
    label(grp, cx, cy + 0.2, it.label, 0.75, '#9aa0a8');
    silk(acc, cx, it.y - 0.5, ref);
    return { l: [cx - 1.27, cy + 2.2], r: [cx + 1.27, cy + 2.2], b: [cx, cy + 2.2] };
  }
  const bw = it.bw, bh = it.bh;
  const x0 = cx - bw / 2, y0 = cy - bh / 2;
  if (pkg === 'qfp' || pkg === 'qfn') {
    const side = pins / 4, p = pkg === 'qfp' ? it.p : 0.5;
    const span = (side - 1) * p;
    const lead = pkg === 'qfp' ? 1.2 : 0;
    const lw = p * 0.55;
    for (let i = 0; i < side; i++) {
      const o = -span / 2 + i * p - lw / 2;
      if (pkg === 'qfp') {
        acc.pins += `M${r2(cx + o)},${r2(y0 - lead)}h${r2(lw)}v${lead}h${r2(-lw)}z`;
        acc.pins += `M${r2(cx + o)},${r2(y0 + bh)}h${r2(lw)}v${lead}h${r2(-lw)}z`;
        acc.pins += `M${r2(x0 - lead)},${r2(cy + o)}h${lead}v${r2(lw)}h${-lead}z`;
        acc.pins += `M${r2(x0 + bw)},${r2(cy + o)}h${lead}v${r2(lw)}h${-lead}z`;
      } else {
        acc.pins += `M${r2(cx + o)},${r2(y0 - 0.15)}h${r2(lw)}v0.5h${r2(-lw)}z M${r2(cx + o)},${r2(y0 + bh - 0.35)}h${r2(lw)}v0.5h${r2(-lw)}z`;
        acc.pins += `M${r2(x0 - 0.15)},${r2(cy + o)}h0.5v${r2(lw)}h-0.5z M${r2(x0 + bw - 0.35)},${r2(cy + o)}h0.5v${r2(lw)}h-0.5z`;
      }
    }
    svg('rect', { x: r2(x0), y: r2(y0), width: r2(bw), height: r2(bh), rx: 0.3, fill: '#1c1d21', stroke: '#000', 'stroke-width': 0.15 }, grp);
    svg('circle', { cx: r2(x0 + 1), cy: r2(y0 + 1), r: 0.35, fill: '#3a3c42' }, grp);
    label(grp, cx, cy - 0.4, it.label, clamp(bw / 7, 0.7, 1.4), '#b8bec7');
    label(grp, cx, cy + clamp(bw / 7, 0.7, 1.4), pkg === 'qfp' ? 'LQFP' + pins : 'QFN' + pins, clamp(bw / 11, 0.5, 0.9), '#6d727b');
    silk(acc, x0 - 0.2, y0 - (pkg === 'qfp' ? 1.9 : 0.8), ref, 'start');
    return { l: [x0 - lead, cy], r: [x0 + bw + lead, cy], b: [cx, y0 + bh + lead] };
  }
  // two rows of pins: DIP (through hole), SOIC / TSSOP / TSOP (surface mount)
  const half = pins / 2, pitch = PITCH[pkg];
  const span = (half - 1) * pitch;
  const lead = (it.h - bh) / 2;
  const lw = pkg === 'dip' ? 0.6 : pitch * 0.5;
  for (let i = 0; i < half; i++) {
    const x = cx - span / 2 + i * pitch - lw / 2;
    acc.pins += `M${r2(x)},${r2(y0 - lead)}h${r2(lw)}v${r2(lead)}h${r2(-lw)}z M${r2(x)},${r2(y0 + bh)}h${r2(lw)}v${r2(lead)}h${r2(-lw)}z`;
    if (pkg === 'dip') acc.pads += `M${r2(x + lw / 2 + 0.55)},${r2(y0 - lead + 0.2)}a0.55,0.55 0 1,0 -1.1,0a0.55,0.55 0 1,0 1.1,0z M${r2(x + lw / 2 + 0.55)},${r2(y0 + bh + lead - 0.2)}a0.55,0.55 0 1,0 -1.1,0a0.55,0.55 0 1,0 1.1,0z`;
  }
  svg('rect', { x: r2(x0), y: r2(y0), width: r2(bw), height: r2(bh), rx: pkg === 'dip' ? 0.5 : 0.25, fill: '#18191c', stroke: '#000', 'stroke-width': 0.15 }, grp);
  if (pkg === 'dip') svg('path', { d: `M${r2(x0)},${r2(cy - 0.8)}a0.8,0.8 0 0 1 0,1.6z`, fill: '#2c2e33' }, grp);
  else svg('circle', { cx: r2(x0 + 0.6), cy: r2(y0 + bh - 0.6), r: 0.25, fill: '#3a3c42' }, grp);
  label(grp, cx, cy, it.label, clamp(Math.min(bh * 0.28, bw / Math.max(4, it.label.length) * 1.5), 0.6, 1.6), '#b8bec7');
  silk(acc, x0 - 0.2, y0 - lead - 0.6, ref, 'start');
  return { l: [x0, cy], r: [x0 + bw, cy], b: [cx, y0 + bh + lead] };
}
function label(g, x, y, s, size, fill) {
  if (!s) return;
  svg('text', { x: r2(x), y: r2(y), 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-family': "'JetBrains Mono', monospace", 'font-size': r2(size), 'font-weight': 700, fill }, g, s);
}
// silkscreen reference labels are collected and drawn as a few text runs at the end
function silk(acc, x, y, s, anchor = 'middle') {
  acc.silk.push({ x, y, s, anchor });
}
function drawSmall(g, it, acc, refs) {
  const cx = it.x + it.w / 2, cy = it.y + it.h / 2;
  switch (it.kind) {
    case 'r': {
      acc.leads += `M${r2(it.x)},${r2(cy)}H${r2(it.x + it.w)}`;
      acc.pads += pad(it.x + 0.6, cy) + pad(it.x + it.w - 0.6, cy);
      const b = svg('g', {}, g);
      svg('rect', { x: r2(cx - 3), y: r2(cy - 0.95), width: 6, height: 1.9, rx: 0.8, fill: it.v > 0.5 ? '#d8c79a' : '#6f9fd8' }, b);
      const k = Math.floor(it.v * 997);
      [k % 10, (k >> 2) % 10, 1 + ((k >> 4) % 4), 3].forEach((c, i) => svg('rect', { x: r2(cx - 2.1 + i * 1.05 + (i === 3 ? 0.5 : 0)), y: r2(cy - 0.95), width: 0.45, height: 1.9, fill: i === 3 ? '#c9a14a' : BANDS[c] }, b));
      silk(acc, cx, cy - 1.7, 'R' + ++refs.R);
      break;
    }
    case 'c':
      acc.pads += pad(it.x + 1.2, cy + 1.5) + pad(it.x + it.w - 1.2, cy + 1.5);
      svg('rect', { x: r2(it.x), y: r2(it.y), width: r2(it.w), height: r2(it.h), rx: 0.5, fill: FILM[Math.floor(it.v * FILM.length)], stroke: '#000', 'stroke-opacity': 0.35, 'stroke-width': 0.15 }, g);
      label(g, cx, cy, ['104', '473', '223', '102', '683'][Math.floor(it.v * 5)], 0.9, '#f4f1e8');
      refs.C++;
      break;
    case 'k':
      acc.leads += `M${r2(cx - 1.27)},${r2(cy)}V${r2(it.y + it.h)}M${r2(cx + 1.27)},${r2(cy)}V${r2(it.y + it.h)}`;
      svg('ellipse', { cx: r2(cx), cy: r2(cy), rx: 1.9, ry: 1.2, fill: it.v > 0.5 ? '#e0a21b' : '#c8642c', stroke: '#000', 'stroke-opacity': 0.3, 'stroke-width': 0.12 }, g);
      refs.C++;
      break;
    case 'e': {
      const r = 2.6 + it.v * 0.5;
      svg('circle', { cx: r2(cx), cy: r2(cy), r: r2(r), fill: it.v > 0.6 ? '#1f2a5a' : '#2a4fa8', stroke: '#0e1630', 'stroke-width': 0.2 }, g);
      svg('path', { d: `M${r2(cx - r * 0.95)},${r2(cy - r * 0.3)}A${r2(r)} ${r2(r)} 0 0 1 ${r2(cx - r * 0.3)},${r2(cy - r * 0.95)}L${r2(cx - r * 0.1)},${r2(cy - r * 0.55)}Z`, fill: '#c9d2e6', opacity: 0.8 }, g);
      svg('path', { d: `M${r2(cx - r * 0.5)},${r2(cy)}h${r2(r)}M${r2(cx)},${r2(cy - r * 0.5)}v${r2(r)}`, stroke: '#9aa3b5', 'stroke-width': 0.25, opacity: 0.6 }, g);
      silk(acc, cx, it.y - 0.5, 'C' + ++refs.C);
      break;
    }
    case 'd':
      acc.leads += `M${r2(it.x)},${r2(cy)}H${r2(it.x + it.w)}`;
      acc.pads += pad(it.x + 0.5, cy) + pad(it.x + it.w - 0.5, cy);
      svg('rect', { x: r2(cx - 1.8), y: r2(cy - 0.8), width: 3.6, height: 1.6, rx: 0.7, fill: '#d2602a', opacity: 0.9 }, g);
      svg('rect', { x: r2(cx + 1), y: r2(cy - 0.8), width: 0.5, height: 1.6, fill: '#111' }, g);
      silk(acc, cx, cy - 1.4, 'D' + ++refs.D);
      break;
    case 't':
      svg('rect', { x: r2(it.x), y: r2(it.y), width: r2(it.w), height: r2(it.h), rx: 0.5, fill: '#2b6fd6', stroke: '#13275a', 'stroke-width': 0.2 }, g);
      svg('circle', { cx: r2(cx), cy: r2(cy), r: 2, fill: '#e8e6df' }, g);
      svg('path', { d: `M${r2(cx - 1.2)},${r2(cy)}h2.4M${r2(cx)},${r2(cy - 1.2)}v2.4`, stroke: '#555', 'stroke-width': 0.4 }, g);
      silk(acc, cx, it.y - 0.5, 'VR' + ++refs.VR);
      break;
    case 'x':
      acc.pads += pad(it.x + 3, cy) + pad(it.x + it.w - 3, cy);
      svg('rect', { x: r2(it.x), y: r2(it.y), width: r2(it.w), height: r2(it.h), rx: r2(it.h / 2), fill: '#c9ced6', stroke: '#7d838c', 'stroke-width': 0.25 }, g);
      svg('rect', { x: r2(it.x + 1), y: r2(it.y + 0.8), width: r2(it.w - 2), height: r2(it.h - 1.6), rx: r2(it.h / 2 - 0.8), fill: 'none', stroke: '#fff', 'stroke-opacity': 0.5, 'stroke-width': 0.2 }, g);
      label(g, cx, cy, it.label, 1, '#4a4f57');
      silk(acc, cx, it.y - 0.5, 'Y' + ++refs.Y);
      break;
    case 'ldr':
      svg('circle', { cx: r2(cx), cy: r2(cy), r: 2.1, fill: '#e3a35a', stroke: '#8a5a2b', 'stroke-width': 0.2 }, g);
      svg('path', { d: `M${r2(cx - 1.3)},${r2(cy - 0.8)}h2.6v0.55h-2.6v0.55h2.6v0.55h-2.6`, fill: 'none', stroke: '#7a3a12', 'stroke-width': 0.22 }, g);
      silk(acc, cx, it.y - 0.5, 'LDR' + ++refs.LDR);
      break;
    case 'ind':
      svg('circle', { cx: r2(cx), cy: r2(cy), r: 4.2, fill: '#b8302a', stroke: '#5a1410', 'stroke-width': 0.3 }, g);
      svg('circle', { cx: r2(cx), cy: r2(cy), r: 1.6, fill: '#2a2a2a' }, g);
      label(g, cx, cy + 2.8, '500mH', 0.9, '#f4f1e8');
      silk(acc, cx, it.y - 0.5, 'L1');
      break;
    case 'to220':
      for (let i = -1; i <= 1; i++) acc.pins += `M${r2(cx + i * 2.54 - 0.4)},${r2(it.y + it.h - 0.6)}h0.8v1.2h-0.8z`;
      svg('rect', { x: r2(it.x), y: r2(it.y), width: r2(it.w), height: 1.4, fill: '#b8bec6' }, g);
      svg('rect', { x: r2(it.x), y: r2(it.y + 1.4), width: r2(it.w), height: r2(it.h - 2), rx: 0.3, fill: '#1a1b1e' }, g);
      label(g, cx, it.y + 2.9, it.label, 1, '#b8bec7');
      silk(acc, it.x, it.y - 0.6, 'U' + ++refs.U, 'start');
      break;
    case 'sot223':
      acc.pins += `M${r2(cx - 1.6)},${r2(it.y)}h3.2v1.2h-3.2z`;
      for (let i = -1; i <= 1; i++) acc.pins += `M${r2(cx + i * 2.3 - 0.4)},${r2(it.y + it.h - 1.4)}h0.8v1.4h-0.8z`;
      svg('rect', { x: r2(cx - 3.3), y: r2(it.y + 1.1), width: 6.6, height: 3.6, rx: 0.3, fill: '#1a1b1e' }, g);
      label(g, cx, it.y + 2.9, it.label, 0.85, '#b8bec7');
      silk(acc, cx - 3.3, it.y - 0.4, 'U' + ++refs.U, 'start');
      break;
  }
}
const pad = (x, y, r = 0.55) => `M${r2(x + r)},${r2(y)}a${r},${r} 0 1,0 ${-2 * r},0a${r},${r} 0 1,0 ${2 * r},0z`;

// a trace with 45 degree corners, from a to b leaving and arriving horizontally
function trace(a, b, lane = 0) {
  const [x0, y0] = a, [x1, y1] = b;
  const xm = (x0 + x1) / 2 + lane;
  const dy = y1 - y0;
  const c = Math.min(Math.abs(dy) / 2, Math.abs(xm - x0), Math.abs(x1 - xm), 1.2) * Math.sign(dy || 1);
  const sx0 = Math.sign(xm - x0) || 1, sx1 = Math.sign(x1 - xm) || 1;
  if (Math.abs(dy) < 0.05) return `M${r2(x0)},${r2(y0)}H${r2(x1)}`;
  return `M${r2(x0)},${r2(y0)}H${r2(xm - sx0 * Math.abs(c))}L${r2(xm)},${r2(y0 + c)}V${r2(y1 - c)}L${r2(xm + sx1 * Math.abs(c))},${r2(y1)}H${r2(x1)}`;
}
// a trace leaving vertically (from a header on the top or bottom edge)
function vtrace(a, b) {
  const [x0, y0] = a, [x1, y1] = b;
  const ym = (y0 + y1) / 2;
  const dx = x1 - x0;
  const c = Math.min(Math.abs(dx) / 2, Math.abs(ym - y0), 1.2) * Math.sign(dx || 1);
  const sy = Math.sign(y1 - y0) || 1;
  if (Math.abs(dx) < 0.05) return `M${r2(x0)},${r2(y0)}V${r2(y1)}`;
  return `M${r2(x0)},${r2(y0)}V${r2(ym - sy * Math.abs(c))}L${r2(x0 + c)},${r2(ym)}H${r2(x1 - c)}L${r2(x1)},${r2(ym + sy * Math.abs(c))}V${r2(y1)}`;
}

// ------------------------------------------------------------------ the board
const KNOBLIKE = new Set(['knob', 'trim', 'slider', 'pedal']);
export const STEP_PITCH = 8; // factory-controls.js STEP
/** How many wires go from the board to a control. */
export function wireCount(c) {
  if (c.kind === 'screen') return clamp(Math.round((c.w || 40) / 3), 12, 24);
  if (c.kind === 'sel' && c.part === 'steps') return c.n || 4;
  if (c.kind === 'foot') return 6;
  if (c.kind === 'dip') return Math.min(13, (c.n || 4) + 1);
  if (c.kind === 'led') return 2;
  if (c.kind === 'toggle') return (c.ways || 2) === 3 ? 3 : 3;
  if (c.kind === 'sel') return Math.min(8, (c.n || 4) + 1);
  if (c.kind === 'xy') return 5;
  return 3;
}

/** Draws the board, its parts and the wires to every control and jack into g (pedal millimetres). */
export function drawPcb(g, d, pts, spots) {
  const W = d.enc.w, H = d.enc.h;
  const C = d.circuit || {};
  const seed = [W, H, ...(C.insts || []).map((i) => i.id + ':' + ((i.graph && i.graph.nodes) || []).map((n) => n.id).join(',')), ...(d.ctls || []).map((c) => c.id)].join('|');
  const rnd = rng(seed);
  const { clusters, nodeCluster, display, power } = pcbParts(d);
  const lay = rng(seed + 'parts');
  for (const cl of clusters) layoutCluster(cl, lay);

  // board size: wide, as tall as the parts need (parts shrink a little on a crowded small board)
  const bw = clamp(W * 0.82, 24, 190);
  const maxBh = clamp(H * 0.62, 20, 130);
  const pad0 = 2.6, gap = 2.4;
  let sc = 1, lp = null;
  for (const s of [1, 0.9, 0.8, 0.7, 0.6, 0.52, 0.45, 0.38, 0.32]) {
    sc = s;
    lp = pack(clusters, (bw - pad0 * 2) / s, gap);
    if (lp.h * s <= maxBh - pad0 * 2) break;
  }
  // a board that fills a good part of the enclosure; spare height spreads the rows of parts apart
  const bh = clamp(Math.max(lp.h * sc + pad0 * 2 + 1, H * 0.42), 20, maxBh);
  const spare = (bh - pad0 * 2 - 1) / sc - lp.h;
  if (spare > 0 && lp.rows.length > 1) {
    const add = Math.min(10, spare / (lp.rows.length - 1));
    lp.rows.forEach((r, i) => r.items.forEach((cl) => (cl.y += add * i)));
    lp.h += add * (lp.rows.length - 1);
  }
  const bx = (W - bw) / 2;
  const by = clamp(H * 0.47 - bh / 2, H * 0.05, Math.max(H * 0.05, H * 0.95 - bh));
  const ox = bx + pad0 + Math.max(0, (bw - pad0 * 2 - lp.w * sc) / 2), oy = by + pad0 + Math.max(0, (bh - pad0 * 2 - lp.h * sc) / 2);
  const mm = (x, y) => [ox + x * sc, oy + y * sc];

  const col = d.enc.pcbColor || '#1f6b3a';
  const pcb = svg('g', { class: 'fz-pcb', 'pointer-events': 'none', 'data-chips': 0 }, g);
  svg('rect', { x: r2(bx + 0.8), y: r2(by + 1.2), width: r2(bw), height: r2(bh), rx: 1.5, fill: '#000', opacity: 0.35 }, pcb);
  svg('rect', { x: r2(bx), y: r2(by), width: r2(bw), height: r2(bh), rx: 1.5, fill: col, stroke: shade(col, -0.45), 'stroke-width': 0.4 }, pcb);
  const tracesEl = svg('path', { fill: 'none', stroke: shade(col, 0.28), 'stroke-width': 0.42, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: 0.9, class: 'fz-traces' }, pcb);
  const padsEl = svg('path', { fill: '#d8b45a', stroke: '#8a6a22', 'stroke-width': 0.08 }, pcb);
  // mounting holes
  const corners = [[bx + 2.4, by + 2.4], [bx + bw - 2.4, by + 2.4], [bx + 2.4, by + bh - 2.4], [bx + bw - 2.4, by + bh - 2.4]];
  svg('path', { d: corners.map(([x, y]) => pad(x, y, 1.3)).join(''), fill: '#c9ced5', stroke: '#8a8f97', 'stroke-width': 0.3 }, pcb);
  svg('path', { d: corners.map(([x, y]) => pad(x, y, 0.7)).join(''), fill: '#0b0c0e', opacity: 0.85 }, pcb);

  const acc = { pins: '', pads: '', leads: '', silk: [] };
  let lugs = '';
  const refs = { U: 0, Q: 0, R: 0, C: 0, D: 0, VR: 0, Y: 0, LDR: 0 };
  const partsG = svg('g', { transform: `translate(${r2(ox)},${r2(oy)}) scale(${r2(sc)})` }, pcb);
  const leadsEl = svg('path', { fill: 'none', stroke: '#b9bec6', 'stroke-width': 0.35 }, partsG);
  const pinsEl = svg('path', { fill: '#c9ced5' }, partsG);
  let tr = '';
  let nChips = 0;
  const anchors = [];
  for (const cl of clusters) {
    // parts in board units (the cluster offset added), so pins, pads and leads can share one path each
    for (const it of cl.items) {
      it.x += cl.x;
      it.y += cl.y;
    }
    const cg = svg('g', { 'data-part': cl.type }, partsG);
    let first = null;
    const chipPins = [];
    for (const it of cl.items) {
      if (it.kind === 'chip') {
        const ref = it.pkg === 'to92' ? 'Q' + ++refs.Q : 'U' + ++refs.U;
        const a = drawChip(cg, it, ref, acc);
        nChips++;
        if (!first) first = a;
        chipPins.push(a);
      } else drawSmall(cg, it, acc, refs);
    }
    // short traces from the chips to their own small parts
    const local = cl.items.filter((it) => it.kind !== 'chip');
    if (chipPins.length && local.length) {
      local.forEach((it, i) => {
        const a = chipPins[i % chipPins.length].b;
        const b = [it.x + Math.min(1, it.w / 2), it.y + it.h / 2];
        const [ax, ay] = mm(a[0], a[1]);
        const [bx2, by2] = mm(b[0], b[1]);
        tr += vtrace([ax + (i % 3 - 1) * 0.6 * sc, ay], [bx2, by2]);
      });
    }
    // parts of the same cluster in a row, chip to chip
    for (let i = 1; i < chipPins.length; i++) {
      const [ax, ay] = mm(chipPins[i - 1].r[0], chipPins[i - 1].r[1]);
      const [bx2, by2] = mm(chipPins[i].l[0], chipPins[i].l[1]);
      tr += trace([ax, ay], [bx2, by2]);
    }
    const f = first || { l: [cl.x, cl.y + cl.h / 2], r: [cl.x + cl.w, cl.y + cl.h / 2] };
    anchors.push({ l: mm(f.l[0], f.l[1]), r: mm(f.r[0], f.r[1]), c: mm(cl.x + cl.w / 2, cl.y + cl.h / 2) });
  }
  pcb.setAttribute('data-chips', nChips);
  // traces between parts that are wired together in the circuit
  const nodeOf = (inst, id) => nodeCluster.get(inst + '.' + id);
  const linked = new Set();
  const link = (a, b, lane) => {
    if (a == null || b == null || a === b) return;
    const k = a + '>' + b;
    if (linked.has(k)) return;
    linked.add(k);
    const A = anchors[a], B = anchors[b];
    tr += A.r[0] <= B.l[0] ? trace(A.r, B.l, lane) : trace(A.l, B.r, lane);
  };
  // follows a node's wires until it reaches a part on the board (through io nodes)
  const feedsOf = (inst, id, seen = new Set()) => {
    if (seen.has(id)) return [];
    seen.add(id);
    const hit = nodeOf(inst.id, id);
    if (hit != null) return [hit];
    const out = [];
    for (const w of inst.graph.wires || []) if (w.a.n === id) out.push(...feedsOf(inst, w.b.n, seen));
    return out;
  };
  const fedBy = (inst, id, seen = new Set()) => {
    if (seen.has(id)) return [];
    seen.add(id);
    const hit = nodeOf(inst.id, id);
    if (hit != null) return [hit];
    const out = [];
    for (const w of inst.graph.wires || []) if (w.b.n === id) out.push(...fedBy(inst, w.a.n, seen));
    return out;
  };
  let lane = 0;
  for (const inst of C.insts || []) {
    for (const w of (inst.graph && inst.graph.wires) || []) {
      const a = nodeOf(inst.id, w.a.n), b = nodeOf(inst.id, w.b.n);
      if (a != null && b != null) link(a, b, ((lane++ % 5) - 2) * 0.7);
    }
  }
  const instById = new Map((C.insts || []).map((i) => [i.id, i]));
  const ioNode = (inst, kind) => ((inst && inst.graph && inst.graph.nodes) || []).filter((n) => n.t === kind);
  // circuit to circuit: audio wires between instances and circuit outputs into other circuits
  for (const w of [...(C.wires || []), ...(C.cwires || [])]) {
    const A = instById.get(w.a.n), B = instById.get(w.b.n);
    if (!A || !B) continue;
    const a = fedBy(A, w.a.p)[0] ?? fedBy(A, (ioNode(A, 'out')[0] || {}).id)[0];
    const b = feedsOf(B, w.b.p)[0] ?? feedsOf(B, (ioNode(B, 'in')[0] || {}).id)[0];
    link(a, b, 0);
  }
  // the regulator feeds every chip cluster along the top edge
  if (power >= 0 && anchors.length > 1) {
    const P = anchors[power];
    let bus = '';
    for (let i = 0; i < anchors.length; i++) if (i !== power && clusters[i].spec.chips.length) bus += vtrace(P.c, [anchors[i].c[0], anchors[i].c[1] - 0.6]);
    svg('path', { d: bus, fill: 'none', stroke: shade(col, 0.18), 'stroke-width': 0.7, opacity: 0.8 }, pcb).dataset.bus = 'power';
  }

  // ---------------------------------------------------------------- wires from the board to controls and jacks
  const wires = svg('g', { class: 'fz-wires', 'pointer-events': 'none' }, g);
  const ends = [];
  const targetCluster = (c) => {
    for (const m of [c.map, ...(c.more || []), ...(c.maps || [])]) {
      if (!m || !m.to) continue;
      const dot = m.to.indexOf('.');
      const inst = instById.get(m.to.slice(0, dot));
      if (!inst) continue;
      const hit = feedsOf(inst, m.to.slice(dot + 1))[0];
      if (hit != null) return hit;
      const first = feedsOf(inst, (ioNode(inst, 'in')[0] || {}).id)[0];
      if (first != null) return first;
    }
    return null;
  };
  const insideB = (x, y) => x > bx && x < bx + bw && y > by && y < by + bh;
  for (const c of d.ctls || []) {
    if (c.hidden) continue;
    if (c.kind === 'screen') continue;
    const n = wireCount(c);
    let to = [];
    if (c.kind === 'sel' && c.part === 'steps') {
      // one wire to every button
      const w = (c.n || 4) * STEP_PITCH;
      for (let i = 0; i < n; i++) to.push([c.x - w / 2 + STEP_PITCH * (i + 0.5), c.y + 1]);
    } else for (let i = 0; i < n; i++) to.push(null);
    const pot = KNOBLIKE.has(c.kind) && insideB(c.x, c.y);
    ends.push({ c, x: c.x, y: c.y, n, to, pot, ribbon: c.kind === 'foot' || c.kind === 'dip' || (c.kind === 'sel' && c.part === 'steps'), cl: c.kind === 'led' ? display : targetCluster(c) });
  }
  const C0 = (C.insts || [])[0];
  for (const s of spots) {
    const k = s.j.kind;
    let cl = null;
    if (k === 'power') cl = power;
    else if (k === 'in' && C0) cl = feedsOf(C0, (ioNode(C0, 'in')[0] || {}).id)[0];
    else if (C0) {
      const last = (C.insts || [])[(C.insts || []).length - 1];
      cl = fedBy(last, (ioNode(last, 'out')[0] || {}).id)[0];
    }
    ends.push({ j: s.j, x: s.ex, y: s.ey, n: k === 'power' ? 2 : k === 'xlr' ? 3 : k === 'phones' || k === 'stereo' ? 3 : 2, jack: true, cl: cl ?? null, to: [] });
  }
  const headers = svg('path', { fill: '#e8e6df', opacity: 0.9 }, pcb);
  let hdr = '';
  ends.forEach((e, k) => {
    const inside = insideB(e.x, e.y);
    let hx = clamp(e.x, bx + 3, bx + bw - 3);
    let hy;
    if (e.pot) hy = e.y;
    else if (inside) hy = e.y < by + bh / 2 ? by + 1 : by + bh - 1; // board-mounted parts still get a wired header near them
    else hy = e.y < by ? by + 1 : e.y > by + bh ? by + bh - 1 : clamp(e.y, by + 1, by + bh - 1);
    if (!inside && !e.jack && e.y >= by && e.y <= by + bh) hx = e.x < bx ? bx + 1 : bx + bw - 1;
    const gapW = e.ribbon ? 0.65 : 0.85;
    const width = e.n * gapW;
    hdr += `M${r2(hx - width / 2 - 0.3)},${r2(hy - 0.65)}h${r2(width + 0.6)}v1.3h${r2(-width - 0.6)}z`;
    if (e.cl != null && anchors[e.cl]) tr += vtrace([hx, hy], anchors[e.cl].c);
    if (e.pot) {
      // a pot soldered straight to the board: three lugs, no wires
      for (let i = -1; i <= 1; i++) lugs += pad(e.x + i * 2.5, e.y + 4, 0.7);
      return;
    }
    const grp = svg('g', { class: 'fz-wb', 'data-to': e.c ? e.c.id : 'jack:' + e.j.id, 'data-n': e.n }, wires);
    let shadow = '';
    for (let i = 0; i < e.n; i++) {
      const o = (i - (e.n - 1) / 2) * gapW;
      const x0 = hx + o, y0 = hy;
      const [x1, y1] = e.to[i] || [e.x + o * 0.8, e.y];
      const my = (y0 + y1) / 2 + (rnd() - 0.5) * 6;
      const p = `M${r2(x0)},${r2(y0)}C${r2(x0 + (rnd() - 0.5) * 6)},${r2(my)} ${r2(x1 + (rnd() - 0.5) * 6)},${r2(my)} ${r2(x1)},${r2(y1)}`;
      shadow += p;
      const colr = e.ribbon ? (i === 0 ? '#c9302c' : '#9aa0a8') : WIRE[(k * 3 + i) % WIRE.length];
      svg('path', { d: p, fill: 'none', stroke: colr, 'stroke-width': e.ribbon ? 0.5 : 0.5, 'stroke-linecap': 'round', class: 'w' }, grp);
      if (e.to[i]) svg('circle', { cx: r2(x1), cy: r2(y1), r: 0.55, fill: '#8a8f97', opacity: 0.8 }, grp);
    }
    grp.insertBefore(svg('path', { d: shadow, fill: 'none', stroke: '#000', 'stroke-width': 0.75, opacity: 0.35, transform: 'translate(0.4,0.6)' }), grp.firstChild);
    if (!e.to.some(Boolean)) svg('circle', { cx: r2(e.x), cy: r2(e.y), r: e.jack ? 1.1 : 1.4, fill: '#8a8f97', opacity: 0.6 }, grp);
  });
  headers.setAttribute('d', hdr);

  // screens: a wide flat flex connector on the board and a ribbon of parallel wires to the screen
  for (const c of d.ctls || []) {
    if (c.kind !== 'screen' || c.hidden) continue;
    const n = wireCount(c);
    const pitch = 0.5;
    const rw = n * pitch;
    const sw = c.w || 40, sh = c.h || 16;
    const sTop = c.y - sh / 2, sBot = c.y + sh / 2;
    const hx = clamp(c.x, bx + rw / 2 + 2, bx + bw - rw / 2 - 2);
    let hy, ty;
    if (sBot < by + 1) { hy = by + 1.6; ty = sBot - 1.5; }
    else if (sTop > by + bh - 1) { hy = by + bh - 1.6; ty = sTop + 1.5; }
    else { hy = clamp(sBot + 8, by + 1.6, by + bh - 1.6); ty = sBot - 1.5; }
    const tx = clamp(hx, c.x - sw / 2 + rw / 2 + 0.5, c.x + sw / 2 - rw / 2 - 0.5);
    // the connector: a wide body with a latch and a row of gold contacts
    const fc = svg('g', { class: 'fz-fpc', 'data-to': c.id, 'data-pins': n }, pcb);
    svg('rect', { x: r2(hx - rw / 2 - 1.2), y: r2(hy - 1.3), width: r2(rw + 2.4), height: 2.6, rx: 0.3, fill: '#e9e2cf', stroke: '#8f8a7c', 'stroke-width': 0.15 }, fc);
    svg('rect', { x: r2(hx - rw / 2 - 0.9), y: r2(hy + (ty < hy ? -1.3 : 0.5)), width: r2(rw + 1.8), height: 0.8, fill: '#3a3c42' }, fc);
    let gold = '';
    for (let i = 0; i < n; i++) gold += `M${r2(hx - rw / 2 + (i + 0.25) * pitch)},${r2(hy + (ty < hy ? 1.3 : -1.3))}v${ty < hy ? 0.9 : -0.9}h${r2(pitch * 0.5)}v${ty < hy ? -0.9 : 0.9}z`;
    svg('path', { d: gold, fill: '#d8b45a' }, fc);
    // a bus of traces from the display chip to the connector
    if (display >= 0 && anchors[display]) {
      const A = anchors[display].c;
      let bus = '';
      for (let i = 0; i < 6; i++) bus += vtrace([hx - 1.5 + i * 0.6, hy + (ty < hy ? 1.3 : -1.3)], [A[0] - 1.5 + i * 0.6, A[1]]);
      tr += bus;
    }
    // the ribbon: an S bend from the connector up (or down) to the screen
    const rib = svg('g', { class: 'fz-ribbon', 'data-to': c.id, 'data-wires': n }, wires);
    const y0 = hy + (ty < hy ? -1.3 : 1.3);
    const curve = (o) => {
      const xa = hx + o, xb = tx + o, ym = (y0 + ty) / 2;
      return `M${r2(xa)},${r2(y0)}C${r2(xa)},${r2(ym)} ${r2(xb)},${r2(ym)} ${r2(xb)},${r2(ty)}`;
    };
    svg('path', { d: curve(0), fill: 'none', stroke: '#000', 'stroke-width': r2(rw + 1.4), opacity: 0.3, transform: 'translate(0.5,0.7)' }, rib);
    svg('path', { d: curve(0), fill: 'none', stroke: '#c98a2c', 'stroke-width': r2(rw + 0.8), opacity: 0.88 }, rib);
    for (let i = 0; i < n; i++) svg('path', { d: curve(-rw / 2 + (i + 0.5) * pitch), fill: 'none', stroke: '#e8c27a', 'stroke-width': 0.18, class: 'w' }, rib);
    svg('rect', { x: r2(tx - rw / 2 - 0.6), y: r2(ty - 0.8), width: r2(rw + 1.2), height: 1.6, fill: '#2b2c30', opacity: 0.9 }, rib);
  }

  leadsEl.setAttribute('d', acc.leads);
  pinsEl.setAttribute('d', acc.pins);
  padsEl.setAttribute('d', (acc.pads ? scaled(acc.pads, ox, oy, sc) : '') + lugs);
  tracesEl.setAttribute('d', tr);
  // silkscreen: references next to the parts, the board name and a revision
  const sg = svg('g', { 'font-family': "'JetBrains Mono', monospace", 'font-size': 0.95, fill: '#eceae3', opacity: 0.8, 'font-weight': 700 }, partsG);
  for (const s of acc.silk.slice(0, 80)) svg('text', { x: r2(s.x), y: r2(s.y), 'text-anchor': s.anchor, 'dominant-baseline': 'auto' }, sg, s.s);
  const name = String(d.name || 'PEDAL').toUpperCase().slice(0, 24);
  svg('text', { x: r2(bx + bw - 4.2), y: r2(by + bh - 1.4), 'text-anchor': 'end', 'font-family': "'JetBrains Mono', monospace", 'font-size': 1.3, 'font-weight': 700, fill: '#eceae3', opacity: 0.75 }, pcb, name + ' REV A');
}
// pads were collected in the parts' own units: move the numbers to pedal millimetres
function scaled(path, ox, oy, sc) {
  // every pad is "M x,y a r,r 0 1,0 dx,0 a r,r 0 1,0 dx,0 z"
  return path.replace(/M(-?[\d.]+),(-?[\d.]+)a([\d.]+),([\d.]+) 0 1,0 (-?[\d.]+),0a[\d.]+,[\d.]+ 0 1,0 (-?[\d.]+),0z/g, (_, x, y, r, r2b, d1, d2) => {
    const X = ox + +x * sc, Y = oy + +y * sc, R = +r * sc;
    return `M${r2(X)},${r2(Y)}a${r2(R)},${r2(R)} 0 1,0 ${r2(+d1 * sc)},0a${r2(R)},${r2(R)} 0 1,0 ${r2(+d2 * sc)},0z`;
  });
}
