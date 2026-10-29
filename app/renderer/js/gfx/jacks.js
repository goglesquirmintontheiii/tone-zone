// Jacks and plugs. Side-mounted jacks are drawn as a 3D profile (washer, hex nut facets, threaded barrel,
// opening); panel / front jacks face-on. Kinds: inst (1/4" TS), trs (1/4" TRS stereo / headphones),
// mini (3.5 mm TRS), ctrl (1/4" TRS footswitch / expression), xlr, usb, midi.
import { svg, shade } from '../util.js';
import { label as text } from './controls.js';

export const JACK_TIP = { inst: 6, trs: 6, phones: 6, ctrl: 6, mini: 4, xlr: 4, usb: 3, midi: 3 };
export const PLUG_LENS = { inst: 44, trs: 44, phones: 30, ctrl: 40, mini: 22, xlr: 50, usb: 22, midi: 30 };
// how far a plug sinks in when plugged: the 10 unit sleeve plus the jack's 3 unit threaded bushing
export const SLEEVE = { inst: 13, trs: 13, ctrl: 13, phones: 13 };
export const CABLE_WIDTH = { inst: 5.6, trs: 4.8, phones: 3.4, ctrl: 4.4, mini: 3.4, xlr: 7.8, usb: 4.2, midi: 5.2 };

// side → transform mapping local frame (outward = -x, light from local -y) into board space
const SIDE_M = {
  left: 'matrix(1,0,0,1,0,0)',
  right: 'matrix(-1,0,0,1,0,0)',
  top: 'matrix(0,1,1,0,0,0)',
  bottom: 'matrix(0,-1,1,0,0,0)',
};

function nutProfile(g, x0, x1, half, tone = 0) {
  // three visible facets of a hex nut seen side-on
  const f = half * 0.5;
  const m = (a) => shade('#c9ced5', a + tone);
  svg('rect', { x: x0, y: -half, width: x1 - x0, height: half * 2, rx: 0.9, fill: '#2a2e33' }, g);
  svg('rect', { x: x0 + 0.25, y: -half + 0.3, width: x1 - x0 - 0.5, height: half - f, fill: m(0.15) }, g);
  svg('rect', { x: x0 + 0.25, y: -f, width: x1 - x0 - 0.5, height: f * 2, fill: m(0.35) }, g);
  svg('rect', { x: x0 + 0.25, y: f, width: x1 - x0 - 0.5, height: half - f - 0.3, fill: m(-0.35) }, g);
  // specular streak on the front facet and chamfer edge
  svg('rect', { x: x0 + 0.6, y: -f + 0.6, width: 0.9, height: f * 2 - 1.2, fill: '#fff', opacity: 0.55 }, g);
  svg('line', { x1: x0 + 0.25, y1: -f, x2: x1 - 0.25, y2: -f, stroke: '#000', 'stroke-width': 0.35, opacity: 0.35 }, g);
  svg('line', { x1: x0 + 0.25, y1: f, x2: x1 - 0.25, y2: f, stroke: '#000', 'stroke-width': 0.35, opacity: 0.45 }, g);
}
function barrel(g, x0, x1, r, tone = 0) {
  svg('rect', { x: x0, y: -r, width: x1 - x0, height: r * 2, fill: shade('#9aa1aa', tone), stroke: '#2b2f34', 'stroke-width': 0.35 }, g);
  svg('rect', { x: x0, y: -r, width: x1 - x0, height: r * 0.55, fill: '#fff', opacity: 0.35 }, g);
  svg('rect', { x: x0, y: r * 0.35, width: x1 - x0, height: r * 0.65, fill: '#000', opacity: 0.3 }, g);
  for (let x = x0 + 0.5; x < x1 - 0.2; x += 0.85) svg('line', { x1: x, y1: -r, x2: x + 0.35, y2: r, stroke: '#000', 'stroke-width': 0.25, opacity: 0.35 }, g);
}
function opening(g, x, r, rx = 1.3) {
  svg('ellipse', { cx: x, cy: 0, rx: rx + 0.4, ry: r + 0.4, fill: '#d7dce2' }, g);
  svg('ellipse', { cx: x, cy: 0, rx, ry: r, fill: '#050506' }, g);
  svg('ellipse', { cx: x + 0.35, cy: 0, rx: rx * 0.45, ry: r * 0.48, fill: '#2a2c30' }, g);
}

function sideJack(g, kind) {
  // contact shadow on the enclosure side
  svg('rect', { x: -1, y: -7, width: 6, height: 17, rx: 3, fill: '#000', opacity: 0.28 }, g);
  switch (kind) {
    case 'xlr': {
      svg('rect', { x: -1, y: -12, width: 4.5, height: 24, rx: 1.5, fill: '#1c1e22' }, g);
      svg('rect', { x: -4, y: -10.5, width: 4.2, height: 21, rx: 1.4, fill: '#8f969f', stroke: '#2b2f34', 'stroke-width': 0.4 }, g);
      svg('rect', { x: -4, y: -10.5, width: 4.2, height: 6, rx: 1.2, fill: '#fff', opacity: 0.3 }, g);
      svg('rect', { x: -4, y: 3.5, width: 4.2, height: 7, rx: 1.2, fill: '#000', opacity: 0.3 }, g);
      // latch tab
      svg('rect', { x: -2.6, y: -13.2, width: 2.4, height: 3, rx: 0.6, fill: '#c8ced6', stroke: '#33373d', 'stroke-width': 0.3 }, g);
      opening(g, -4, 8.2, 1.6);
      break;
    }
    case 'usb': {
      svg('rect', { x: -3, y: -6, width: 6, height: 12, rx: 1.4, fill: '#9ca3ac', stroke: '#2b2f34', 'stroke-width': 0.4 }, g);
      svg('rect', { x: -3, y: -6, width: 6, height: 3, rx: 1, fill: '#fff', opacity: 0.35 }, g);
      svg('rect', { x: -3.6, y: -4.3, width: 1.2, height: 8.6, rx: 0.4, fill: '#060607' }, g);
      break;
    }
    case 'midi': {
      svg('rect', { x: -1, y: -11, width: 4, height: 22, rx: 1.5, fill: '#1c1e22' }, g);
      barrel(g, -3.2, -0.6, 8.5, -0.1);
      opening(g, -3.2, 7.4, 1.4);
      break;
    }
    case 'mini': {
      svg('rect', { x: 0.2, y: -5.5, width: 2.8, height: 11, rx: 0.8, fill: '#4b5057' }, g);
      nutProfile(g, -2.2, 0.6, 4.6);
      barrel(g, -4, -2, 2.6);
      opening(g, -4, 2.2, 0.8);
      break;
    }
    default: {
      // inst / trs / ctrl: washer, hex nut, threaded barrel, opening
      svg('rect', { x: 0.4, y: -8.6, width: 3.1, height: 17.2, rx: 1, fill: '#3c4047' }, g);
      svg('rect', { x: 0.4, y: -8.6, width: 3.1, height: 4, rx: 1, fill: '#fff', opacity: 0.18 }, g);
      nutProfile(g, -3, 0.9, 7.6, kind === 'ctrl' ? -0.1 : 0);
      barrel(g, -6, -3, 4.6, kind === 'trs' ? 0.05 : 0);
      opening(g, -6, 3.9, 1.35);
      if (kind === 'trs' || kind === 'ctrl' || kind === 'phones') svg('circle', { cx: 2, cy: -10.5, r: 1.1, fill: kind === 'trs' ? '#37d6c2' : kind === 'phones' ? '#b18cff' : '#ffc24b', opacity: 0.85 }, g);
    }
  }
}

function faceJack(g, kind) {
  const hexPts = (r) => [...Array(6)].map((_, i) => `${(Math.cos((Math.PI / 3) * i + Math.PI / 6) * r).toFixed(2)},${(Math.sin((Math.PI / 3) * i + Math.PI / 6) * r).toFixed(2)}`).join(' ');
  if (kind === 'xlr') {
    svg('circle', { r: 12, cy: 1.5, fill: '#000', opacity: 0.4 }, g);
    svg('circle', { r: 11.5, fill: 'url(#g-chromeR)', stroke: '#2a2d31', 'stroke-width': 0.6 }, g);
    svg('circle', { r: 9, fill: '#16181b' }, g);
    for (const a of [210, 330, 90]) svg('circle', { cx: Math.cos((a * Math.PI) / 180) * 4.6, cy: Math.sin((a * Math.PI) / 180) * 4.6, r: 1.4, fill: '#000', stroke: '#c9ced5', 'stroke-width': 0.5 }, g);
    svg('rect', { x: -2.2, y: -13.5, width: 4.4, height: 4, rx: 1, fill: '#c9ced5' }, g);
    return;
  }
  if (kind === 'usb') {
    svg('rect', { x: -7, y: -7, width: 14, height: 14, rx: 2, fill: 'url(#g-chromeR)', stroke: '#2a2d31', 'stroke-width': 0.6 }, g);
    svg('path', { d: 'M-4.5 4.5 V-2 L-2.5 -4.5 H2.5 L4.5 -2 V4.5 Z', fill: '#08090a' }, g);
    svg('rect', { x: -2.4, y: -1.5, width: 4.8, height: 3.6, fill: '#e7e3d6' }, g);
    return;
  }
  if (kind === 'midi') {
    svg('circle', { r: 11, fill: 'url(#g-chromeR)', stroke: '#2a2d31', 'stroke-width': 0.6 }, g);
    svg('circle', { r: 8.5, fill: '#121315' }, g);
    for (let i = 0; i < 5; i++) {
      const a = Math.PI + (Math.PI * i) / 4;
      svg('circle', { cx: Math.cos(a) * 5, cy: Math.sin(a) * 5 + 1.5, r: 0.95, fill: '#000', stroke: '#9aa1aa', 'stroke-width': 0.35 }, g);
    }
    svg('rect', { x: -1.2, y: 6.5, width: 2.4, height: 2.2, fill: '#000' }, g);
    return;
  }
  const s = kind === 'mini' ? 0.62 : 1;
  const gg = svg('g', { transform: `scale(${s})` }, g);
  svg('polygon', { points: hexPts(8.6), fill: '#000', opacity: 0.4, transform: 'translate(0.8,1.8)' }, gg);
  svg('polygon', { points: hexPts(8.4), fill: 'url(#g-nut)', stroke: '#24272b', 'stroke-width': 0.5 }, gg);
  svg('polygon', { points: hexPts(6.9), fill: 'none', stroke: '#fff', 'stroke-opacity': 0.35, 'stroke-width': 0.6 }, gg);
  svg('circle', { r: 5.6, fill: 'url(#g-chromeR)', stroke: '#3a3e44', 'stroke-width': 0.4 }, gg);
  svg('circle', { r: 4.1, fill: 'url(#g-hole)' }, gg);
  svg('circle', { r: 2.2, fill: '#000' }, gg);
  svg('path', { d: 'M-3.3 -2.3 A4 4 0 0 1 2.3 -3.3', fill: 'none', stroke: '#fff', 'stroke-opacity': 0.35, 'stroke-width': 0.6 }, gg);
}

export function drawJack(parent, j, theme) {
  const kind = j.kind || 'inst';
  const g = svg('g', { class: 'jack jack-' + kind, transform: `translate(${j.x},${j.y})` }, parent);
  g.dataset.jack = j.key;
  svg('circle', { r: kind === 'xlr' ? 14 : 11, class: 'jack-hot' }, g);
  if (j.side === 'face' || j.side === 'front') faceJack(g, kind);
  else sideJack(svg('g', { transform: SIDE_M[j.side] || SIDE_M.left }, g), kind);
  if (j.label && theme && theme.jackLabels !== false) {
    const lx = j.side === 'left' ? 5 : j.side === 'right' ? -5 : 0;
    const ly = j.side === 'top' ? 13 : j.side === 'bottom' ? -13 : j.side === 'face' || j.side === 'front' ? 16 : -12;
    const anchor = j.side === 'left' ? 'start' : j.side === 'right' ? 'end' : 'middle';
    text(g, lx, ly, j.label, { size: 4.6, fill: theme.jackText || theme.text, anchor, weight: 700, opacity: 0.8, ls: 0.3 });
  }
  return g;
}

// the last bit of sleeve going into the jack's hole, so the plug reads as pushed in rather than floating
function sleeveIn(g, S, r, fill) {
  svg('rect', { x: S - 1.8, y: -r, width: 11.3 - S + 1.8, height: r * 2, fill, stroke: '#2b2f34', 'stroke-width': 0.3 }, g);
  svg('rect', { x: S - 1.8, y: -r, width: 1.4, height: r * 2, fill: '#000', opacity: 0.45 }, g);
}

// ------------------------------------------------------------------ plugs (local frame: +x = outward from the jack)
export function drawPlug(parent, j, color, kind = 'inst') {
  const ang = (Math.atan2(j.dy, j.dx) * 180) / Math.PI;
  const tip = j.front ? 0 : JACK_TIP[kind] ?? 6;
  // plugged in: the sleeve sits inside the jack, so draw from the collar onwards (a loose plug shows it)
  const S = j.free || j.front ? 0 : SLEEVE[kind] || 0;
  const g = svg('g', { transform: `translate(${(j.x + j.dx * tip).toFixed(1)},${(j.y + j.dy * tip).toFixed(1)}) rotate(${j.front ? 90 : ang})${S ? ` translate(${-S},0)` : ''}`, 'pointer-events': 'none' }, parent);
  const dark = shade(color, -0.45), mid = shade(color, -0.12);
  if (j.front) {
    const r = kind === 'xlr' ? 13 : kind === 'mini' ? 5.5 : kind === 'phones' ? 6.5 : 8;
    svg('circle', { r: r + 1, fill: '#000', opacity: 0.4, cy: 3 }, g);
    svg('circle', { r, fill: kind === 'xlr' ? '#2a2c30' : shade(color, -0.35) }, g);
    svg('circle', { r: r * 0.75, fill: kind === 'xlr' ? '#4a4e55' : color }, g);
    if (kind === 'xlr') svg('circle', { r: r * 0.5, fill: color }, g);
    svg('circle', { r: r * 0.38, cx: -r * 0.2, cy: -r * 0.2, fill: '#fff', opacity: 0.25 }, g);
    return g;
  }
  const L = PLUG_LENS[kind] || 30;
  const shadow = (h) => svg('rect', { x: S || 2, y: -h / 2, width: L - S, height: h, rx: h / 2.5, fill: '#000', opacity: 0.32, transform: 'translate(3,4)' }, g);
  switch (kind) {
    case 'xlr': {
      // male XLR: metal shell with latch button, coloured ID ring, long rubber boot
      shadow(19);
      svg('rect', { x: 0, y: -9, width: 22, height: 18, rx: 2.4, fill: 'url(#g-plugMetal)', stroke: '#2b2f34', 'stroke-width': 0.45 }, g);
      svg('rect', { x: 0.5, y: -8.4, width: 21, height: 5, rx: 2, fill: '#fff', opacity: 0.22 }, g);
      svg('rect', { x: 0.5, y: 3.8, width: 21, height: 4.8, rx: 2, fill: '#000', opacity: 0.22 }, g);
      svg('rect', { x: 2.5, y: -9, width: 1, height: 18, fill: '#000', opacity: 0.3 }, g);
      svg('rect', { x: 6, y: -10.6, width: 6, height: 2.6, rx: 1, fill: '#d6dbe1', stroke: '#33373d', 'stroke-width': 0.35 }, g);
      svg('rect', { x: 19, y: -9.4, width: 3.4, height: 18.8, rx: 1, fill: color }, g);
      svg('path', { d: `M22 -8.2 L${L - 4} -5.2 Q${L} -4.6 ${L} 0 Q${L} 4.6 ${L - 4} 5.2 L22 8.2 Z`, fill: '#1c1e22', stroke: '#0c0d0f', 'stroke-width': 0.4 }, g);
      svg('path', { d: `M23 -7.2 L${L - 5} -4.4`, stroke: '#fff', 'stroke-opacity': 0.14, 'stroke-width': 2, fill: 'none' }, g);
      for (let i = 0; i < 6; i++) { const x = 27 + i * 3.4, hh = 7.6 - i * 0.45; svg('rect', { x, y: -hh, width: 1.1, height: hh * 2, fill: '#000', opacity: 0.4 }, g); }
      break;
    }
    case 'phones': {
      // slim headphone plug: TRS sleeve with two insulator bands, moulded body, thin strain relief
      shadow(8);
      if (!S) {
        svg('rect', { x: 0, y: -3, width: 10, height: 6, rx: 1, fill: 'url(#g-plugGold)', stroke: '#2b2f34', 'stroke-width': 0.3 }, g);
        for (const x of [2.8, 5.6]) svg('rect', { x, y: -3, width: 0.8, height: 6, fill: '#111' }, g);
      } else sleeveIn(g, S, 3, 'url(#g-plugGold)');
      svg('rect', { x: 9.5, y: -4.6, width: 12, height: 9.2, rx: 2.4, fill: '#25272c', stroke: '#0e0f11', 'stroke-width': 0.35 }, g);
      svg('rect', { x: 10, y: -4.1, width: 11, height: 2.6, rx: 1.3, fill: '#fff', opacity: 0.16 }, g);
      svg('rect', { x: 18.5, y: -4.6, width: 2, height: 9.2, fill: color }, g);
      svg('path', { d: `M21.5 -3.6 L${L} -2.2 L${L} 2.2 L21.5 3.6 Z`, fill: '#1b1c20' }, g);
      for (let i = 0; i < 3; i++) svg('rect', { x: 23.5 + i * 2.2, y: -3, width: 0.7, height: 6, fill: '#000', opacity: 0.45 }, g);
      break;
    }
    case 'usb': {
      shadow(9);
      svg('rect', { x: 0, y: -4, width: 7, height: 8, rx: 1, fill: 'url(#g-plugMetal)', stroke: '#2b2f34', 'stroke-width': 0.4 }, g);
      svg('rect', { x: 6.5, y: -5, width: L - 6.5, height: 10, rx: 2.5, fill: dark }, g);
      svg('rect', { x: 7, y: -4.4, width: L - 7.5, height: 8.8, rx: 2.2, fill: mid }, g);
      svg('path', { d: 'M12 0h6M15 -2.5v5M18 0l-1.5 -1.2v2.4z', stroke: '#fff', 'stroke-width': 0.6, opacity: 0.5, fill: '#fff' }, g);
      break;
    }
    case 'midi': {
      shadow(13);
      svg('rect', { x: 0, y: -6, width: 6, height: 12, rx: 1, fill: 'url(#g-plugMetal)', stroke: '#2b2f34', 'stroke-width': 0.4 }, g);
      svg('rect', { x: 5.5, y: -6.6, width: L - 5.5, height: 13.2, rx: 5.5, fill: '#17181b' }, g);
      svg('rect', { x: 6, y: -6, width: L - 7, height: 3.6, rx: 2, fill: '#fff', opacity: 0.12 }, g);
      svg('rect', { x: L - 6, y: -6.6, width: 2.5, height: 13.2, fill: color }, g);
      break;
    }
    case 'mini': {
      shadow(8);
      svg('rect', { x: 0, y: -2.2, width: 7, height: 4.4, rx: 1, fill: 'url(#g-plugMetal)', stroke: '#2b2f34', 'stroke-width': 0.3 }, g);
      for (const x of [2, 4.2]) svg('rect', { x, y: -2.2, width: 0.7, height: 4.4, fill: '#111' }, g);
      svg('rect', { x: 6.5, y: -3.6, width: L - 6.5, height: 7.2, rx: 3, fill: dark }, g);
      svg('rect', { x: 7, y: -3.2, width: L - 7.5, height: 6.4, rx: 2.8, fill: mid }, g);
      svg('rect', { x: 7.5, y: -3, width: L - 9, height: 2, rx: 1, fill: '#fff', opacity: 0.22 }, g);
      break;
    }
    default: {
      // 1/4" plug like a Switchcraft: exposed sleeve, collar, long knurled metal barrel, rubber strain relief
      const tip = kind === 'inst' ? 'url(#g-plugMetal)' : 'url(#g-plugGold)';
      shadow(12);
      if (!S) {
        svg('rect', { x: 0, y: -3.9, width: 10, height: 7.8, rx: 1.2, fill: tip, stroke: '#2b2f34', 'stroke-width': 0.4 }, g);
        svg('rect', { x: 3.2, y: -3.9, width: 1, height: 7.8, fill: '#000', opacity: 0.55 }, g);
        if (kind === 'trs' || kind === 'ctrl') svg('rect', { x: 6.4, y: -3.9, width: 0.9, height: 7.8, fill: '#000', opacity: 0.55 }, g);
      } else sleeveIn(g, S, 3.9, tip);
      // collar: a bright flange where the sleeve meets the barrel
      svg('rect', { x: 9.5, y: -5.4, width: 3.2, height: 10.8, rx: 1.2, fill: 'url(#g-plugMetal)', stroke: '#2b2f34', 'stroke-width': 0.35 }, g);
      svg('rect', { x: 10.1, y: -5.4, width: 0.8, height: 10.8, fill: '#fff', opacity: 0.35 }, g);
      svg('rect', { x: 11.9, y: -5.4, width: 0.6, height: 10.8, fill: '#000', opacity: 0.3 }, g);
      svg('rect', { x: 12.4, y: -5.9, width: 16, height: 11.8, rx: 1.6, fill: 'url(#g-plugMetal)', stroke: '#2b2f34', 'stroke-width': 0.4 }, g);
      svg('rect', { x: 12.9, y: -5.4, width: 15, height: 3.2, rx: 1.2, fill: '#fff', opacity: 0.3 }, g);
      for (let x = 14; x < 27.5; x += 1.5) svg('rect', { x, y: -5.9, width: 0.55, height: 11.8, fill: '#000', opacity: 0.22 }, g);
      svg('rect', { x: 24.5, y: -6.1, width: 2.2, height: 12.2, fill: color }, g);
      svg('path', { d: `M28.2 -5 L${L - 1} -3.4 Q${L} -3.2 ${L} 0 Q${L} 3.2 ${L - 1} 3.4 L28.2 5 Z`, fill: dark }, g);
      svg('path', { d: `M28.6 -4.4 L${L - 1.4} -2.9 L${L - 1.4} 2.9 L28.6 4.4 Z`, fill: mid }, g);
      for (let i = 0; i < 4; i++) svg('rect', { x: 30.5 + i * 3, y: -4.2 + i * 0.35, width: 0.9, height: 8.4 - i * 0.7, fill: '#000', opacity: 0.28 }, g);
      if (kind === 'trs') svg('rect', { x: 13.5, y: -6.1, width: 1.6, height: 12.2, fill: '#37d6c2', opacity: 0.85 }, g);
      if (kind === 'ctrl') svg('rect', { x: 13.5, y: -6.1, width: 1.6, height: 12.2, fill: '#ffc24b', opacity: 0.85 }, g);
    }
  }
  return g;
}
