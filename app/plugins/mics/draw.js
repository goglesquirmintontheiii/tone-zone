// Mic drawings for the Studio Mics plugin. Every mic is drawn upright in a side view, head on top, centred on
// x = 0 with its top at y = 0, in mic units (a large-diaphragm condenser is about 110 units tall).
// drawMic(g, look) draws it and returns { w, h, headH }; fitMic(g, look, w, h) scales it into a box.
// No SVG filters: shading is done with a few shared gradients and patterns (installed once into the page defs).

let svg = null, shade = null;
export function initDraw(gfx) {
  svg = gfx.svg;
  shade = gfx.shade;
}

const NS = 'http://www.w3.org/2000/svg';
let defsDone = false;
function defsHost() {
  let d = document.getElementById('globalDefs');
  if (!d) {
    d = document.getElementById('tzm-defs');
    if (!d) {
      const s = document.createElementNS(NS, 'svg');
      s.setAttribute('width', 0);
      s.setAttribute('height', 0);
      s.style.position = 'absolute';
      d = document.createElementNS(NS, 'defs');
      d.id = 'tzm-defs';
      s.appendChild(d);
      document.body.appendChild(s);
    }
  }
  return d;
}
function ensureDefs() {
  if (defsDone && document.getElementById('tzm-cyl')) return;
  defsDone = true;
  const d = defsHost();
  const lin = (id, stops, x2 = 1, y2 = 0) => {
    const gr = svg('linearGradient', { id, x1: 0, y1: 0, x2, y2 }, d);
    for (const [o, c, a] of stops) svg('stop', { offset: o, 'stop-color': c, 'stop-opacity': a }, gr);
  };
  // round body seen from the side: dark edges, a soft highlight left of centre
  lin('tzm-cyl', [[0, '#000', 0.55], [0.14, '#fff', 0.1], [0.3, '#fff', 0.3], [0.42, '#fff', 0.06], [0.7, '#000', 0.08], [0.9, '#000', 0.35], [1, '#000', 0.65]]);
  // polished metal: sharper, banded reflections
  lin('tzm-chrome', [[0, '#000', 0.65], [0.1, '#fff', 0.75], [0.22, '#fff', 0.05], [0.4, '#000', 0.3], [0.55, '#fff', 0.45], [0.66, '#fff', 0.05], [0.85, '#000', 0.35], [1, '#000', 0.7]]);
  // flat faces (e906, coles): mild top light
  lin('tzm-flat', [[0, '#fff', 0.18], [0.35, '#fff', 0.03], [0.8, '#000', 0.12], [1, '#000', 0.3]], 0, 1);
  const sph = svg('radialGradient', { id: 'tzm-sph', cx: 0.38, cy: 0.32, r: 0.7, fx: 0.32, fy: 0.25 }, d);
  for (const [o, c, a] of [[0, '#fff', 0.55], [0.25, '#fff', 0.15], [0.6, '#000', 0.1], [1, '#000', 0.65]]) svg('stop', { offset: o, 'stop-color': c, 'stop-opacity': a }, sph);
  // woven mesh (light threads), perforated metal (dark holes), foam, fine horizontal slats
  const pat = (id, w, h) => svg('pattern', { id, width: w, height: h, patternUnits: 'userSpaceOnUse' }, d);
  let p = pat('tzm-mesh', 2, 2);
  svg('path', { d: 'M0 0 L2 2 M2 0 L0 2', stroke: '#fff', 'stroke-opacity': 0.32, 'stroke-width': 0.45 }, p);
  p = pat('tzm-meshd', 2, 2);
  svg('path', { d: 'M0 0 L2 2 M2 0 L0 2', stroke: '#000', 'stroke-opacity': 0.45, 'stroke-width': 0.5 }, p);
  p = pat('tzm-perf', 2.4, 2.4);
  svg('circle', { cx: 0.6, cy: 0.6, r: 0.55, fill: '#000', 'fill-opacity': 0.6 }, p);
  svg('circle', { cx: 1.8, cy: 1.8, r: 0.55, fill: '#000', 'fill-opacity': 0.6 }, p);
  p = pat('tzm-foam', 3, 3);
  svg('circle', { cx: 0.7, cy: 0.9, r: 0.5, fill: '#fff', 'fill-opacity': 0.1 }, p);
  svg('circle', { cx: 2.2, cy: 2.1, r: 0.6, fill: '#000', 'fill-opacity': 0.5 }, p);
  svg('circle', { cx: 2.3, cy: 0.5, r: 0.35, fill: '#fff', 'fill-opacity': 0.08 }, p);
  p = pat('tzm-slats', 4, 1.6);
  svg('rect', { x: 0, y: 0, width: 4, height: 0.7, fill: '#000', 'fill-opacity': 0.55 }, p);
}

// ---------------------------------------------------------------- primitives
const f1 = (v) => Math.round(v * 100) / 100;
// rounded rect with separate top / bottom corner radii
function rr(x, y, w, h, rt = 0, rb = 0) {
  rt = Math.min(rt, w / 2, h / 2);
  rb = Math.min(rb, w / 2, h / 2);
  return `M${f1(x + rt)} ${f1(y)} H${f1(x + w - rt)} A${rt} ${rt} 0 0 1 ${f1(x + w)} ${f1(y + rt)} V${f1(y + h - rb)} A${rb} ${rb} 0 0 1 ${f1(x + w - rb)} ${f1(y + h)} H${f1(x + rb)} A${rb} ${rb} 0 0 1 ${f1(x)} ${f1(y + h - rb)} V${f1(y + rt)} A${rt} ${rt} 0 0 1 ${f1(x + rt)} ${f1(y)} Z`;
}
// tapered body from width w0 at y0 to w1 at y1, with rounded bottom corners
function taper(y0, w0, y1, w1, rb = 0) {
  const a = w0 / 2, b = w1 / 2;
  return `M${f1(-a)} ${f1(y0)} H${f1(a)} L${f1(b)} ${f1(y1 - rb)} Q${f1(b)} ${f1(y1)} ${f1(b - rb)} ${f1(y1)} H${f1(-b + rb)} Q${f1(-b)} ${f1(y1)} ${f1(-b)} ${f1(y1 - rb)} Z`;
}
const P = (g, d, a) => svg('path', Object.assign({ d }, a), g);
// a solid part with round-body shading and an outline
function part(g, d, color, o = {}) {
  P(g, d, { fill: color });
  if (o.pattern) P(g, d, { fill: `url(#${o.pattern})` });
  P(g, d, { fill: `url(#${o.finish === 'chrome' ? 'tzm-chrome' : o.flat ? 'tzm-flat' : 'tzm-cyl'})`, opacity: o.finish === 'matte' ? 0.75 : 1 });
  P(g, d, { fill: 'none', stroke: o.edge || shade(color, -0.65), 'stroke-width': o.sw ?? 0.6, 'stroke-opacity': 0.9 });
}
// a grille: base colour, mesh / perforation / slats texture, shading
function grille(g, d, color, kind = 'mesh', o = {}) {
  P(g, d, { fill: color });
  const light = luma(color) > 0.35;
  if (kind === 'mesh') P(g, d, { fill: light ? 'url(#tzm-meshd)' : 'url(#tzm-mesh)' });
  else if (kind === 'perf') P(g, d, { fill: 'url(#tzm-perf)' });
  else if (kind === 'foam') P(g, d, { fill: 'url(#tzm-foam)' });
  else if (kind === 'slats') P(g, d, { fill: 'url(#tzm-slats)' });
  P(g, d, { fill: `url(#${o.sphere ? 'tzm-sph' : 'tzm-cyl'})` });
  P(g, d, { fill: 'none', stroke: shade(color, -0.6), 'stroke-width': 0.6 });
}
function luma(hex) {
  const n = parseInt(hex.slice(1), 16);
  return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
}
// a thin band (ring) across a round body
function band(g, y, w, h, color, chrome = false) {
  part(g, rr(-w / 2, y, w, h, 0.6, 0.6), color, { finish: chrome ? 'chrome' : undefined, sw: 0.4 });
}
function text(g, x, y, s, o = {}) {
  return svg('text', {
    x, y, 'text-anchor': 'middle', 'dominant-baseline': 'central', fill: o.fill || '#ddd',
    'font-family': o.font || "'Barlow Condensed', sans-serif", 'font-weight': o.weight || 700, 'font-size': o.size || 4,
    'letter-spacing': o.ls ?? 0.2, opacity: o.opacity ?? 0.85, transform: o.transform, 'pointer-events': 'none',
  }, g, s);
}
const ink = (color) => (luma(color) > 0.45 ? '#222' : '#d8d8d8');
// XLR tail: the darker connector end at the bottom of a body
function xlr(g, y, w, color) {
  part(g, rr(-w / 2, y, w, 5, 0, 2), shade(color, -0.25), { sw: 0.4 });
  svg('rect', { x: -w / 2 + 1.5, y: y + 4.2, width: w - 3, height: 1.1, rx: 0.5, fill: '#000', opacity: 0.5 }, g);
}
// stand stub with a wing knob (integrated mounts, yokes)
function stub(g, y, len = 12) {
  part(g, rr(-3, y, 6, len, 0, 1), '#2a2b2e', { sw: 0.4 });
  part(g, rr(-5, y + len - 3, 10, 5, 1.5, 1.5), '#1a1a1b', { sw: 0.4 });
}
function knobSide(g, x, y, r = 3.4, color = '#2a2b2e') {
  svg('circle', { cx: x, cy: y, r, fill: color, stroke: '#000', 'stroke-width': 0.5 }, g);
  svg('circle', { cx: x, cy: y, r, fill: 'url(#tzm-sph)' }, g);
}
// U-shaped yoke around a body: arms at x = +-hw from y0 down to y1, joined under the mic
function yoke(g, hw, y0, y1, color = '#2b2c2f') {
  const d = `M${-hw - 2} ${y0} H${-hw + 1.5} V${y1 - 4} Q${-hw + 1.5} ${y1 - 1.5} ${-hw + 5} ${y1 - 1.5} H${hw - 5} Q${hw - 1.5} ${y1 - 1.5} ${hw - 1.5} ${y1 - 4} V${y0} H${hw + 2} V${y1 - 3} Q${hw + 2} ${y1 + 2} ${hw - 4} ${y1 + 2} H${-hw + 4} Q${-hw - 2} ${y1 + 2} ${-hw - 2} ${y1 - 3} Z`;
  part(g, d, color, { sw: 0.5 });
  knobSide(g, -hw - 0.2, y0 + 3, 3.2);
  knobSide(g, hw + 0.2, y0 + 3, 3.2);
  stub(g, y1 + 2, 10);
}

// ---------------------------------------------------------------- shape families
const SHAPES = {
  // Sennheiser MD 421 style: broad slotted plastic head, tapering body, bass roll-off ring, side clip
  md421(g, L) {
    const c = L.color;
    // side clip (behind)
    part(g, rr(-21, 58, 9, 22, 2, 2), '#2c2d30', { sw: 0.5 });
    svg('rect', { x: -20, y: 62, width: 3, height: 14, rx: 1, fill: '#000', opacity: 0.35 }, g);
    part(g, taper(40, 26, 98, 18, 0), c, { finish: 'matte' });
    // broad head, wider than the body, with the slotted front grille
    const hd = `M-17 9 Q-17 0 -8 0 H8 Q17 0 17 9 V34 Q17 40 12 43 H-12 Q-17 40 -17 34 Z`;
    part(g, hd, shade(c, 0.04), {});
    const gd = rr(-14, 3, 28, 35, 7, 4);
    P(g, gd, { fill: '#0b0b0c' });
    for (let y = 6; y < 36; y += 3) {
      svg('rect', { x: -13, y, width: 26, height: 1.5, rx: 0.7, fill: shade(c, 0.12) }, g);
      svg('rect', { x: -13, y, width: 26, height: 0.5, rx: 0.25, fill: '#fff', opacity: 0.14 }, g);
    }
    P(g, gd, { fill: 'url(#tzm-cyl)' });
    // bass roll-off ring with ticks
    part(g, rr(-10, 98, 20, 8, 0.5, 0.5), '#2a2a2c', { sw: 0.4 });
    for (let i = 0; i < 5; i++) svg('rect', { x: -6 + i * 3, y: 99.5, width: 0.6, height: 2.2, fill: '#e8e8e8', opacity: 0.75 }, g);
    text(g, 0, 104, 'M  .  .  .  S', { size: 2.2, fill: '#ddd', opacity: 0.6 });
    xlr(g, 106, 17, c);
    text(g, 0, 52, L.badge || '', { size: 4.2, fill: '#cfd2d6' });
    return { w: 40, h: 111, headH: 43 };
  },
  // Sennheiser MD 441 style: long champagne bar with slotted front and switch rings
  md441(g, L) {
    const c = L.color, w = 22;
    part(g, rr(-w / 2, 0, w, 128, 6, 2), c, { finish: 'satin' });
    const gd = rr(-8, 4, 16, 50, 4, 2);
    P(g, gd, { fill: L.slot || '#222' });
    for (let y = 7; y < 52; y += 2.6) svg('rect', { x: -7, y, width: 14, height: 1.3, rx: 0.6, fill: shade(c, -0.05) }, g);
    P(g, gd, { fill: 'url(#tzm-cyl)' });
    P(g, gd, { fill: 'none', stroke: shade(c, -0.5), 'stroke-width': 0.5 });
    // two rotary switch rings
    for (const y of [64, 74]) {
      band(g, y, w + 0.6, 5, shade(c, -0.15));
      for (let i = 0; i < 5; i++) svg('rect', { x: -5 + i * 2.5, y: y + 1, width: 0.5, height: 3, fill: '#333', opacity: 0.7 }, g);
    }
    text(g, 0, 90, L.badge || '', { size: 3.8, fill: '#3a372f', transform: 'rotate(-90 0 90)' });
    xlr(g, 123, 19, c);
    return { w: 24, h: 128, headH: 56 };
  },
  // Sennheiser e906 / e609 style: flat paddle with a mesh window
  flat(g, L) {
    const c = L.color, h = L.short ? 62 : 72;
    const tr = L.vintage ? 13 : 8;
    const body = `M-15 ${tr} Q-15 0 ${-15 + tr} 0 H${15 - tr} Q15 0 15 ${tr} V${h - 26} L11 ${h - 3} Q10.5 ${h} 7.5 ${h} H-7.5 Q-10.5 ${h} -11 ${h - 3} L-15 ${h - 26} Z`;
    part(g, body, c, { finish: L.finish, flat: true });
    P(g, body, { fill: 'url(#tzm-cyl)', opacity: 0.6 });
    const win = L.vintage ? rr(-12, 3, 24, 33, 10, 3) : rr(-11.5, 3.5, 23, 30, 5, 3);
    if (L.trim) part(g, L.vintage ? rr(-13.4, 1.6, 26.8, 35.8, 11, 4) : rr(-12.9, 2.1, 25.8, 32.8, 6, 4), L.trim, { finish: 'chrome', sw: 0.4 });
    grille(g, win, L.mesh || '#141416', 'mesh');
    svg('rect', { x: -11.5, y: 3.5, width: 23, height: 3, rx: 2, fill: '#fff', opacity: 0.1 }, g);
    text(g, 0, 39, L.badge || '', { size: 4, fill: ink(c) });
    if (L.switch) {
      part(g, rr(-5, h - 22, 10, 5, 1.5, 1.5), '#121213', { sw: 0.4 });
      for (let i = 0; i < 3; i++) svg('circle', { cx: -2.6 + i * 2.6, cy: h - 19.5, r: 0.7, fill: i === 1 ? '#e8e8e8' : '#555' }, g);
    }
    svg('rect', { x: -6, y: h - 3, width: 12, height: 1.2, rx: 0.6, fill: '#000', opacity: 0.5 }, g);
    return { w: 30, h, headH: 34 };
  },
  // EV RE20 / RE320 / Heil PR 30 style: long cylinder, long domed grille, band, body
  longcyl(g, L) {
    const w = L.w, h = L.h, gh = L.gh, c = L.color;
    part(g, rr(-w / 2, gh - 2, w, h - gh + 2, 0, 3), c, { finish: L.finish });
    const gd = rr(-w / 2, 0, w, gh, w * 0.3, 0);
    if (L.gk === 'ribs') {
      grille(g, gd, L.grille, 'mesh');
      for (let y = 7; y < gh - 3; y += 6.5) part(g, rr(-w / 2 - 0.6, y, w + 1.2, 2.2, 1, 1), shade(L.grille, 0.25), { sw: 0.3 });
    } else grille(g, gd, L.grille, L.gk || 'perf');
    // dome highlight
    svg('ellipse', { cx: -w * 0.12, cy: 4, rx: w * 0.25, ry: 2, fill: '#fff', opacity: 0.18 }, g);
    band(g, gh - 1.5, w + 1, 4, L.band, L.bandChrome);
    text(g, 0, gh + 16, L.badge || '', { size: 4.2, fill: ink(c) });
    // shock mount stud on the side
    part(g, rr(w / 2 - 0.5, gh + 30, 4, 8, 1, 1), '#2a2b2e', { sw: 0.4 });
    xlr(g, h - 5, w - 6, c);
    return { w: w + 8, h, headH: gh };
  },
  // Shure SM7B style: big foam dome, black body in a yoke
  sm7(g, L) {
    const c = L.color;
    // yoke arms behind the body
    const yk = 'M-21 58 H-17 V106 H17 V58 H21 V110 H-21 Z';
    part(g, yk, '#2a2b2e', { sw: 0.5 });
    part(g, rr(-15, 42, 30, 64, 2, 3), c, {});
    // ribbed grip band
    for (let y = 50; y < 98; y += 3) svg('rect', { x: -15, y, width: 30, height: 1, fill: '#000', opacity: 0.35 }, g);
    grille(g, rr(-17.5, 0, 35, 46, 17, 5), '#141415', 'foam');
    knobSide(g, -20, 64, 4.2, '#3b3c40');
    knobSide(g, 20, 64, 4.2, '#3b3c40');
    text(g, 0, 101, L.badge || '', { size: 3.6, fill: '#bbb' });
    stub(g, 110, 9);
    return { w: 46, h: 121, headH: 46 };
  },
  // Shure Beta 52A style: big ball grille, short body, built-in stand clamp
  ball(g, L) {
    const c = L.color, d = L.d || 40, r = d / 2;
    part(g, taper(r + 12, 30, r + 50, 20, 3), c, {});
    // integrated clamp sticking out the side
    part(g, rr(9, r + 24, 16, 8, 2, 2), '#2a2b2e', { sw: 0.4 });
    knobSide(g, 24, r + 28, 4.6, '#2a2b2e');
    const ring = rr(-15, r + 9, 30, 6, 1, 1);
    part(g, ring, shade(c, 0.08), {});
    const bd = `M${-r} ${r} A${r} ${r} 0 1 1 ${r} ${r} A${r} ${r * 0.8} 0 0 1 ${-r} ${r} Z`;
    grille(g, bd, L.mesh, 'mesh', { sphere: true });
    svg('path', { d: `M${-r + 1} ${r - 2} A${r - 1} ${r * 0.3} 0 0 0 ${r - 1} ${r - 2}`, fill: 'none', stroke: '#000', 'stroke-opacity': 0.35, 'stroke-width': 1 }, g);
    text(g, 0, r + 34, L.badge || '', { size: 4, fill: '#ccc' });
    stub(g, r + 50, 8);
    return { w: d + 12, h: r + 63, headH: d };
  },
  // AKG D112 style: egg with a mesh crown and an integrated mount
  egg(g, L) {
    const c = L.color, rx = 23, top = 0, h = 70;
    const egg = `M0 ${top} C${rx * 1.2} ${top} ${rx} ${h * 0.62} ${rx * 0.86} ${h * 0.75} C${rx * 0.7} ${h * 0.95} ${rx * 0.4} ${h} 0 ${h} C${-rx * 0.4} ${h} ${-rx * 0.7} ${h * 0.95} ${-rx * 0.86} ${h * 0.75} C${-rx} ${h * 0.62} ${-rx * 1.2} ${top} 0 ${top} Z`;
    part(g, egg, c, {});
    P(g, egg, { fill: 'url(#tzm-sph)', opacity: 0.6 });
    const crown = `M0 0 C${rx * 1.2} 0 ${rx * 1.02} ${h * 0.42} ${rx * 0.98} ${h * 0.46} Q0 ${h * 0.52} ${-rx * 0.98} ${h * 0.46} C${-rx * 1.02} ${h * 0.42} ${-rx * 1.2} 0 0 0 Z`;
    grille(g, crown, L.mesh, 'mesh', { sphere: true });
    svg('path', { d: `M${-rx * 0.98} ${h * 0.46} Q0 ${h * 0.52} ${rx * 0.98} ${h * 0.46}`, fill: 'none', stroke: '#bfc2c6', 'stroke-width': 1.2, opacity: 0.8 }, g);
    text(g, 0, h * 0.68, L.badge || '', { size: 4.6, fill: '#d2d4d8' });
    stub(g, h - 1, 10);
    return { w: 50, h: h + 13, headH: h * 0.5 };
  },
  // handheld / instrument stick: head (flat, dome, ball or hex) on a tapering body
  stick(g, L) {
    const c = L.color, hw = L.hw, hh = L.hh, bw0 = L.bw0, bw1 = L.bw1, bl = L.bl;
    const y0 = L.head === 'ball' ? hh - 3 : hh;
    part(g, taper(y0 - 1, bw0, y0 + bl, bw1, 3), c, { finish: L.finish });
    if (L.stripes) for (let y = y0 + 12; y < y0 + bl - 12; y += 9) {
      const t0 = bw0 + ((bw1 - bw0) * (y - y0)) / bl;
      P(g, taper(y, t0, y + 4.2, t0 - ((bw0 - bw1) * 4.2) / bl, 0), { fill: '#18181a', opacity: 0.92 });
    }
    if (L.ribs) for (let y = y0 + 2; y < y0 + 12; y += 2.2) svg('rect', { x: -bw0 / 2, y, width: bw0, height: 0.8, fill: '#000', opacity: 0.45 }, g);
    let gd;
    if (L.head === 'dome') gd = rr(-hw / 2, 0, hw, hh, hw * 0.48, 1.5);
    else if (L.head === 'flat') gd = rr(-hw / 2, 0, hw, hh, Math.min(4, hw * 0.16), 1.5);
    else if (L.head === 'hex') gd = `M${-hw / 2} ${hh * 0.3} L${-hw * 0.28} 0 H${hw * 0.28} L${hw / 2} ${hh * 0.3} V${hh} H${-hw / 2} Z`;
    if (L.head === 'ball') {
      const r = hw / 2;
      gd = `M${-r} ${r} A${r} ${r} 0 1 1 ${r} ${r} A${r} ${r} 0 1 1 ${-r} ${r} Z`;
      grille(g, gd, L.mesh, L.gk || 'mesh', { sphere: true });
    } else grille(g, gd, L.mesh, L.gk || 'mesh');
    if (L.head === 'flat') svg('rect', { x: -hw / 2 + 1, y: 0.5, width: hw - 2, height: 2, rx: 1, fill: '#fff', opacity: 0.12 }, g);
    if (L.head === 'hex') for (let i = -1; i <= 1; i++) svg('line', { x1: i * hw * 0.22, y1: 1, x2: i * hw * 0.22, y2: hh - 1, stroke: '#000', 'stroke-opacity': 0.4, 'stroke-width': 0.6 }, g);
    band(g, y0 - 1.5, Math.max(bw0, L.head === 'ball' ? bw0 : hw) + 0.6, 3.2, L.ring || '#888', true);
    text(g, 0, y0 + bl * 0.45, L.badge || '', { size: L.stubby ? 5 : 3.8, fill: ink(c), transform: L.stubby ? undefined : `rotate(-90 0 ${y0 + bl * 0.45})` });
    xlr(g, y0 + bl - 5, bw1 - 1, c);
    return { w: Math.max(hw, bw0) + 2, h: y0 + bl, headH: hh };
  },
  // EV N/D468 style: head on a pivot, tilted forward over a short body
  pivot(g, L) {
    const c = L.color;
    part(g, taper(44, 22, 96, 18, 3), c, {});
    part(g, rr(-9, 92, 18, 6, 0, 2), shade(c, -0.2), { sw: 0.4 });
    // hinge plates
    part(g, rr(-14, 34, 28, 14, 4, 4), L.hinge, { finish: 'chrome', sw: 0.5 });
    const head = svg('g', { transform: 'translate(0,40) rotate(-24) translate(0,-40)' }, g);
    part(head, rr(-13, 4, 26, 38, 3, 6), c, {});
    grille(head, rr(-12, 0, 24, 22, 11, 1.5), L.mesh, 'mesh');
    band(head, 20.5, 26.6, 3, L.hinge, true);
    knobSide(g, 0, 41, 4, '#2a2b2e');
    text(g, 0, 70, L.badge || '', { size: 3.8, fill: '#ccc', transform: 'rotate(-90 0 70)' });
    return { w: 40, h: 98, headH: 40 };
  },
  // clip-on drum mic (e604 style): short body, grille cap, a rim clamp with a thumb screw
  clip(g, L) {
    const c = L.color;
    // clamp: a bent bar from the body down and out, with the screw
    const cl = 'M8 30 H22 V56 Q22 60 18 60 H6 V55 H16 V36 H8 Z';
    part(g, cl, L.clip, { finish: 'chrome', sw: 0.5 });
    part(g, rr(13, 46, 12, 4, 1.5, 1.5), '#2a2b2e', { sw: 0.4 });
    knobSide(g, 28, 48, 3.6, '#2a2b2e');
    part(g, rr(-13, 14, 26, 26, 2, 4), c, {});
    grille(g, rr(-11, 0, 22, 16, 9, 1), L.mesh, 'mesh');
    band(g, 14, 26.6, 2.6, '#7d8086', true);
    text(g, 0, 28, L.badge || '', { size: 4, fill: '#ccc' });
    part(g, rr(-8, 40, 16, 6, 0, 2), shade(c, -0.25), { sw: 0.4 });
    return { w: 62, h: 62, headH: 16 };
  },
  // large-diaphragm side-address condenser: basket head (round, square, flat or faceted) over a body
  ldc(g, L) {
    const c = L.color, w = L.w, h = L.h, hh = L.hh, bw1 = L.bw1 ?? w;
    const finish = L.finish;
    if (L.fins) {
      // tube heat sink: wide fins on the lower body
      for (let y = h * 0.6; y < h - 8; y += 3.4) part(g, rr(-w / 2 - 4, y, w + 8, 2.2, 0.8, 0.8), shade(c, -0.08), { finish: 'chrome', sw: 0.3 });
    }
    part(g, taper(hh - 2, w, h - 4, bw1, 3), c, { finish });
    let gd;
    if (L.head === 'round') gd = rr(-w / 2 + 0.8, 0, w - 1.6, hh, (w - 1.6) / 2, 1.5);
    else if (L.head === 'square') gd = rr(-w / 2 + 0.8, 0, w - 1.6, hh, 9, 1.5);
    else if (L.head === 'flat') gd = rr(-w / 2 + 0.8, 0, w - 1.6, hh, 3, 1);
    else gd = `M${-w / 2 + 0.8} ${hh} V${hh * 0.32} L${-w * 0.22} 0 H${w * 0.22} L${w / 2 - 0.8} ${hh * 0.32} V${hh} Z`;
    grille(g, gd, L.grille, 'mesh');
    // the capsule showing through the mesh
    svg('ellipse', { cx: 0, cy: hh * 0.5, rx: w * 0.28, ry: hh * 0.3, fill: '#000', opacity: 0.18 }, g);
    if (L.head === 'facet') {
      svg('path', { d: `M${-w * 0.22} 0 L0 ${hh * 0.32} L${w * 0.22} 0 M0 ${hh * 0.32} V${hh}`, stroke: '#000', 'stroke-opacity': 0.35, 'stroke-width': 0.7, fill: 'none' }, g);
    }
    // trim ring between basket and body
    band(g, hh - 1.5, w + 0.6, 3, L.trim || shade(c, -0.2), !!L.trim || finish === 'chrome');
    const by = hh + 12;
    if (L.badge === 'circle') {
      const cy = L.badgeOnGrille ? hh * 0.62 : by;
      svg('circle', { cx: 0, cy, r: 4.6, fill: L.badgeColor || '#1b1b1b', stroke: '#d9d9d9', 'stroke-width': 0.7 }, g);
      svg('path', { d: `M0 ${cy - 2.6} L2.6 ${cy} L0 ${cy + 2.6} L-2.6 ${cy} Z`, fill: 'none', stroke: '#e4e4e4', 'stroke-width': 0.6 }, g);
    } else if (L.badge === 'plate') {
      part(g, rr(-7, by - 3, 14, 6, 1, 1), L.badgeColor || '#1e1e1e', { sw: 0.4 });
      text(g, 0, by, 'E 251', { size: 3.2, fill: '#d9d1b8' });
    } else if (L.badge === 'golddot') {
      svg('circle', { cx: 0, cy: by - 4, r: 2, fill: '#d6a93a', stroke: '#6b5216', 'stroke-width': 0.4 }, g);
    } else if (L.badge === 'text') {
      text(g, 0, by, L.badgeText || '', { size: 4.2, fill: L.trim && L.head === 'facet' ? L.trim : ink(c) });
    }
    if (L.switches) {
      part(g, rr(-6, by + 7, 12, 9, 1.5, 1.5), '#111', { sw: 0.4 });
      for (let i = 0; i < 4; i++) svg('circle', { cx: -3.6 + i * 2.4, cy: by + 11.5, r: 0.7, fill: i === 1 ? '#7fd3ff' : '#444' }, g);
    }
    if (L.knob) {
      knobSide(g, 0, by + 14, 3.6, '#1c1c1c');
      for (let i = -1; i <= 1; i++) svg('circle', { cx: i * 4.4, cy: by + 8.6, r: 0.6, fill: '#333' }, g);
    }
    if (L.base) band(g, h - 12, bw1 + 0.6, 4, L.base);
    xlr(g, h - 5, bw1 - 4, c);
    return { w: w + (L.fins ? 10 : 2), h, headH: hh };
  },
  // small-diaphragm pencil condenser
  sdc(g, L) {
    const c = L.color, w = L.w, h = L.h, gh = L.gh;
    part(g, rr(-w / 2, gh - 1, w, h - gh + 1, 0, 2), c, { finish: L.finish });
    grille(g, rr(-w / 2 + 0.3, 0, w - 0.6, gh, 2.5, 0.5), L.grille, 'mesh');
    svg('rect', { x: -w / 2 + 1, y: 0.4, width: w - 2, height: 1.4, rx: 0.7, fill: '#fff', opacity: 0.15 }, g);
    band(g, gh - 1, w + 0.4, 2.6, L.ring || '#666', true);
    if (L.badge === 'dot') svg('circle', { cx: 0, cy: gh + 8, r: 1.4, fill: '#d9d9d9' }, g);
    if (L.switches) for (const y of [gh + 30, gh + 36]) part(g, rr(-2.2, y, 4.4, 3.6, 1, 1), '#1d1d1d', { sw: 0.3 });
    xlr(g, h - 5, w - 1, c);
    return { w: w + 2, h, headH: gh };
  },
  // ribbon "pill": stadium body with a long grille window (Royer, KSM313, Velvet)
  pill(g, L) {
    const c = L.color, w = L.w, h = L.h, r = L.square ? w * 0.3 : w / 2;
    part(g, rr(-w / 2, 0, w, h, r, r * 0.6), c, { finish: L.finish });
    const gw = w - 6;
    const gd = rr(-gw / 2, L.gTop, gw, L.gBot - L.gTop, Math.max(2, r - 3), 2.5);
    grille(g, gd, L.grille, L.slots ? 'slats' : 'mesh');
    // ribbon slots: a few vertical bars behind the mesh
    for (let i = -1; i <= 1; i += 2) svg('rect', { x: i * gw * 0.18 - 0.6, y: L.gTop + 6, width: 1.2, height: L.gBot - L.gTop - 12, rx: 0.6, fill: '#000', opacity: 0.25 }, g);
    if (L.band) band(g, L.gBot + 2, w + 0.5, 3, L.band, true);
    if (L.front) svg('circle', { cx: 0, cy: L.gBot + 9, r: 1.6, fill: L.front }, g);
    text(g, 0, (L.gBot + h) / 2 + (L.front ? 4 : 0), L.badge || '', { size: 4.2, fill: L.band && L.slots ? L.band : ink(c) });
    stub(g, h - 1, 9);
    return { w: w + 2, h: h + 12, headH: L.gBot };
  },
  // Coles 4038 style: grey rectangular head with two round-ended perforated faces, on a short neck
  coles(g, L) {
    const c = L.color;
    part(g, rr(-4, 44, 8, 22, 0, 1), '#3a3b3e', { sw: 0.4 });
    part(g, rr(-27, 0, 54, 48, 14, 14), c, { finish: 'satin', flat: true });
    P(g, rr(-27, 0, 54, 48, 14, 14), { fill: 'url(#tzm-cyl)', opacity: 0.5 });
    grille(g, rr(-23, 4, 46, 40, 11, 11), L.mesh, 'perf');
    // centre frame splitting the two ribbon chambers
    part(g, rr(-2.2, 4, 4.4, 40, 1, 1), shade(c, -0.1), { sw: 0.3 });
    svg('rect', { x: -21, y: 5, width: 42, height: 2.5, rx: 1.2, fill: '#fff', opacity: 0.14 }, g);
    part(g, rr(-9, 60, 18, 7, 2, 2), '#2a2b2e', { sw: 0.4 });
    knobSide(g, 10, 63.5, 3.2);
    stub(g, 66, 8);
    return { w: 56, h: 78, headH: 48 };
  },
  // RCA 44 style: lozenge body with fine slats, chrome centre band and a yoke
  lozenge(g, L) {
    const W = 50, H = 108, c = L.color;
    yoke(g, W / 2 + 1, H * 0.5, H + 6, '#2b2c2f');
    const d = `M0 0 C${W * 0.42} 0 ${W / 2} ${H * 0.2} ${W / 2} ${H * 0.36} V${H * 0.64} C${W / 2} ${H * 0.8} ${W * 0.42} ${H} 0 ${H} C${-W * 0.42} ${H} ${-W / 2} ${H * 0.8} ${-W / 2} ${H * 0.64} V${H * 0.36} C${-W / 2} ${H * 0.2} ${-W * 0.42} 0 0 0 Z`;
    grille(g, d, c, 'slats');
    svg('path', { d, fill: 'url(#tzm-sph)', opacity: 0.35 }, g);
    // ribs running top to bottom
    for (let i = -2; i <= 2; i++) svg('path', { d: `M${i * 7} 2 Q${i * 9.5} ${H / 2} ${i * 7} ${H - 2}`, fill: 'none', stroke: '#8a8d92', 'stroke-opacity': 0.45, 'stroke-width': 0.8 }, g);
    part(g, rr(-W / 2 - 0.5, H / 2 - 4, W + 1, 8, 3, 3), L.band, { finish: 'chrome', sw: 0.5 });
    text(g, 0, H / 2, 'CMD 44', { size: 4.2, fill: '#2a2a2a', opacity: 0.8 });
    return { w: W + 12, h: H + 18, headH: H };
  },
  // RCA 77-DX style: rounded capsule with horizontal ribs, a top pattern screw and a stem
  capsule(g, L) {
    const W = 36, H = 96, c = L.color;
    part(g, rr(-3.5, H - 4, 7, 20, 0, 1), '#3a3b3e', { sw: 0.4 });
    const d = rr(-W / 2, 0, W, H, W / 2, W / 2);
    grille(g, d, L.grille, 'mesh');
    for (let y = 5; y < H - 4; y += 3.2) {
      const t = Math.abs(y - H / 2) / (H / 2);
      const hw = W / 2 - (t > 0.6 ? (W / 2) * (1 - Math.sqrt(Math.max(0, 1 - ((t - 0.6) / 0.4) ** 2))) : 0) - 0.8;
      if (hw < 3) continue;
      svg('rect', { x: -hw, y, width: hw * 2, height: 1.3, rx: 0.6, fill: c, opacity: 0.95 }, g);
    }
    P(g, d, { fill: 'url(#tzm-chrome)', opacity: 0.55 });
    part(g, rr(-W / 2 - 0.5, H / 2 - 3, W + 1, 6, 2, 2), c, { finish: 'chrome', sw: 0.4 });
    svg('circle', { cx: 0, cy: -1.5, r: 2.4, fill: '#9a9da1', stroke: '#333', 'stroke-width': 0.4 }, g);
    svg('line', { x1: -1.6, y1: -1.5, x2: 1.6, y2: -1.5, stroke: '#333', 'stroke-width': 0.5 }, g);
    stub(g, H + 14, 7);
    return { w: W + 2, h: H + 25, headH: H };
  },
  // AEA R84 / R92 style: big rounded black body, long vertical grille, gold band, yoke
  aea(g, L) {
    const W = 42, H = 104, c = L.color;
    yoke(g, W / 2 + 1, H * 0.55, H + 4, '#2b2c2f');
    const d = rr(-W / 2, 0, W, H, W * 0.45, W * 0.45);
    part(g, d, c, {});
    const gd = rr(-W / 2 + 4, 6, W - 8, H - 12, W * 0.38, W * 0.38);
    grille(g, gd, L.grille, 'mesh');
    for (let i = -2; i <= 2; i++) svg('rect', { x: i * 6 - 0.7, y: 10, width: 1.4, height: H - 20, rx: 0.7, fill: '#000', opacity: 0.35 }, g);
    part(g, rr(-W / 2 - 0.4, H * 0.5 - 3, W + 0.8, 6, 2, 2), L.band, { finish: 'chrome', sw: 0.4 });
    text(g, 0, H * 0.5, 'PSD 92', { size: 3.6, fill: '#2b220f' });
    return { w: W + 12, h: H + 16, headH: H };
  },
  // Tone Zone Room Orb: omni ball on a thin stalk
  orb(g, L) {
    const r = 15, c = L.color;
    part(g, taper(2 * r - 4, 9, 2 * r + 58, 8, 2), L.stalk, {});
    band(g, 2 * r - 3, 11, 4, c, true);
    const d = `M${-r} ${r} A${r} ${r} 0 1 1 ${r} ${r} A${r} ${r} 0 1 1 ${-r} ${r} Z`;
    grille(g, d, L.mesh || '#b9bcc0', 'mesh', { sphere: true });
    svg('path', { d: `M${-r} ${r} A${r} ${r * 0.3} 0 0 0 ${r} ${r}`, fill: 'none', stroke: c, 'stroke-width': 2.2 }, g);
    text(g, 0, 2 * r + 30, 'TZ', { size: 3.6, fill: '#ddd', transform: `rotate(-90 0 ${2 * r + 30})` });
    xlr(g, 2 * r + 53, 8, L.stalk);
    return { w: 2 * r + 2, h: 2 * r + 58, headH: 2 * r };
  },
};
export const SHAPE_NAMES = Object.keys(SHAPES);

// natural size of a look without keeping the drawing
const sizeCache = new Map();
export function micSize(look) {
  const k = JSON.stringify(look);
  if (!sizeCache.has(k)) {
    const g = document.createElementNS(NS, 'g');
    sizeCache.set(k, drawMic(g, look));
  }
  return sizeCache.get(k);
}

/** Draw a mic upright into g (top centre at 0,0). Returns { w, h, headH } in mic units. */
export function drawMic(g, look) {
  ensureDefs();
  const fn = SHAPES[look.shape];
  if (!fn) throw new Error('unknown mic shape ' + look.shape);
  return fn(g, look);
}

// where the sound goes in, in mic units from the top: the front of an end-address mic, the diaphragm or ribbon
// centre of a side-address one
function pickup(look, size) {
  switch (look.shape) {
    case 'ldc': return look.hh * 0.5;
    case 'flat': return 19.5;
    case 'pill': return (look.gTop + look.gBot) / 2;
    case 'coles': return 24;
    case 'lozenge': case 'capsule': case 'aea': return size.headH / 2;
    case 'orb': return 15;
    default: return 0;
  }
}
// mic units to millimetres (a U 87 sized condenser is 112 units, 200 mm)
export const MM = 1.8;

/**
 * Draw for the core mic graphics (tz.builders.micLook): millimetres, pickup point at 0,0, body running down.
 * Returns the extent { top, bottom, w } in mm.
 */
export function drawMicMM(g, look) {
  const size = micSize(look), py = pickup(look, size);
  const inner = svg('g', { transform: `scale(${MM}) translate(0,${f1(-py)})` }, g);
  drawMic(inner, look);
  return { top: -py * MM, bottom: (size.h - py) * MM, w: size.w * MM };
}

