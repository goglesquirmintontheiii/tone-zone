// Interactive control graphics: knobs, selectors, toggles, buttons, footswitches, LEDs, sliders, treadles.
import { svg, clamp, shade, luminance } from '../util.js';
import { haloFill, setA } from './fx.js';

export const KNOB_SWEEP = 270; // degrees
export const angleFor = (v01, sweep = KNOB_SWEEP) => -sweep / 2 + sweep * clamp(v01, 0, 1);

function text(parent, x, y, str, o = {}) {
  return svg(
    'text',
    {
      x, y,
      'text-anchor': o.anchor || 'middle',
      'dominant-baseline': o.baseline || 'central',
      fill: o.fill || '#111',
      'font-family': o.font || "'Barlow Condensed', sans-serif",
      'font-weight': o.weight || 700,
      'font-size': o.size || 8,
      'letter-spacing': o.ls ?? 0.3,
      opacity: o.opacity,
      transform: o.transform,
      'pointer-events': 'none',
      'font-style': o.italic ? 'italic' : undefined,
    },
    parent,
    str
  );
}
export { text as label };

// ------------------------------------------------------------------ knobs
export function drawKnob(parent, ctl, theme) {
  const r = ctl.r || 13;
  const alias = { nine: 'mxr', rat: 'fender' };
  let style = ctl.style || theme.knob || 'boss';
  style = alias[style] || style;
  const g = svg('g', { class: 'ctl knob', transform: `translate(${ctl.x},${ctl.y})` }, parent);
  g.dataset.ctl = ctl.cid;
  svg('circle', { r: r + 6, fill: 'transparent' }, g); // larger hit area
  // panel scale / ticks
  if (ctl.ticks !== false && (ctl.scale || theme.knobTicks)) {
    const n = ctl.scale === 10 ? 11 : (ctl.ticks || 11);
    for (let i = 0; i < n; i++) {
      const a = (angleFor(i / (n - 1)) * Math.PI) / 180;
      const r1 = r + 2.5, r2 = r + (i % 5 === 0 ? 5.5 : 4.2);
      svg('line', { x1: Math.sin(a) * r1, y1: -Math.cos(a) * r1, x2: Math.sin(a) * r2, y2: -Math.cos(a) * r2, stroke: theme.text, 'stroke-width': 0.8, opacity: 0.75 }, g);
      if (ctl.scale === 10) text(g, Math.sin(a) * (r + 10), -Math.cos(a) * (r + 10), String(i), { size: 5.5, fill: theme.text, weight: 600 });
    }
  }
  svg('circle', { r: r + 2.6, cy: 2.4, fill: 'url(#g-knobShadow)', opacity: 0.8 }, g);
  const rot = svg('g', { class: 'knob-rot' }, g);
  if (style === 'chicken' || style === 'vox') {
    const col = style === 'vox' ? 'url(#g-cream)' : ctl.cap === 'white' ? 'url(#g-whiteKnob)' : 'url(#g-knobBlack)';
    svg('circle', { r: r * 0.95, fill: style === 'vox' ? '#cdbf9f' : '#141414' }, rot);
    svg('path', { d: `M0 ${-r * 1.35} L${r * 0.42} ${-r * 0.2} Q${r * 0.5} ${r * 0.75} 0 ${r * 0.8} Q${-r * 0.5} ${r * 0.75} ${-r * 0.42} ${-r * 0.2} Z`, fill: col, stroke: '#000', 'stroke-opacity': 0.35, 'stroke-width': 0.6 }, rot);
    svg('line', { x1: 0, y1: -r * 1.25, x2: 0, y2: -r * 0.35, stroke: style === 'vox' ? '#3b2f22' : '#e9e9e9', 'stroke-width': 1.3, 'stroke-linecap': 'round' }, rot);
  } else if (style === 'marshall') {
    svg('circle', { r, fill: 'url(#g-knobSkirt)' }, rot);
    svg('circle', { r: r - 1, fill: 'none', stroke: '#000', 'stroke-width': 2, 'stroke-dasharray': '1 1.3', opacity: 0.7 }, rot);
    svg('circle', { r: r * 0.62, fill: 'url(#g-gold)' }, rot);
    svg('line', { x1: 0, y1: -r * 0.15, x2: 0, y2: -r * 0.95, stroke: '#f2e2b0', 'stroke-width': 1.6, 'stroke-linecap': 'round' }, rot);
  } else if (style === 'fender') {
    svg('circle', { r, fill: '#0c0c0c' }, rot);
    svg('circle', { r: r * 0.92, fill: 'none', stroke: 'url(#g-chrome)', 'stroke-width': 1.4 }, rot);
    svg('circle', { r: r * 0.7, fill: 'url(#g-knobBlack)' }, rot);
    svg('line', { x1: 0, y1: -r * 0.2, x2: 0, y2: -r * 0.98, stroke: '#fff', 'stroke-width': 1.5, 'stroke-linecap': 'round' }, rot);
  } else if (style === 'chrome' || style === 'mesa') {
    svg('circle', { r, fill: style === 'mesa' ? 'url(#g-knobSkirt)' : 'url(#g-chromeR)' }, rot);
    svg('circle', { r: r - 0.8, fill: 'none', stroke: '#000', 'stroke-width': 1.6, 'stroke-dasharray': '0.8 1.2', opacity: 0.45 }, rot);
    svg('circle', { r: r * 0.66, fill: style === 'mesa' ? 'url(#g-chromeR)' : 'url(#g-chromeDome)' }, rot);
    svg('line', { x1: 0, y1: -r * 0.2, x2: 0, y2: -r * 0.95, stroke: style === 'mesa' ? '#111' : '#222', 'stroke-width': 1.5, 'stroke-linecap': 'round' }, rot);
  } else if (style === 'strymon') {
    svg('circle', { r, fill: 'url(#g-knobBlack)' }, rot);
    svg('circle', { r: r - 0.8, fill: 'none', stroke: '#000', 'stroke-width': 1.6, 'stroke-dasharray': '0.7 1.0', opacity: 0.6 }, rot);
    svg('circle', { r: r * 0.72, fill: 'url(#g-knobCap)' }, rot);
    svg('line', { x1: 0, y1: -r * 0.3, x2: 0, y2: -r * 0.95, stroke: '#fff', 'stroke-width': 1.4, 'stroke-linecap': 'round' }, rot);
  } else if (style === 'white' || style === 'red' || style === 'cream') {
    const f = style === 'white' ? 'url(#g-whiteKnob)' : style === 'red' ? 'url(#g-redKnob)' : 'url(#g-cream)';
    svg('circle', { r, fill: f }, rot);
    svg('circle', { r: r - 0.8, fill: 'none', stroke: '#000', 'stroke-width': 1.6, 'stroke-dasharray': '0.7 1.1', opacity: 0.2 }, rot);
    svg('line', { x1: 0, y1: -r * 0.25, x2: 0, y2: -r * 0.95, stroke: style === 'white' ? '#222' : '#fff', 'stroke-width': 1.5, 'stroke-linecap': 'round' }, rot);
  } else if (style === 'mxr') {
    svg('circle', { r, fill: 'url(#g-knobBlack)' }, rot);
    svg('circle', { r: r - 0.7, fill: 'none', stroke: '#000', 'stroke-width': 1.8, 'stroke-dasharray': '1 1', opacity: 0.6 }, rot);
    svg('circle', { r: r * 0.78, fill: 'url(#g-knobCap)' }, rot);
    svg('line', { x1: 0, y1: -r * 0.18, x2: 0, y2: -r * 0.92, stroke: '#fff', 'stroke-width': 1.6, 'stroke-linecap': 'round' }, rot);
  } else {
    // BOSS style skirted knob
    svg('circle', { r, fill: 'url(#g-knobSkirt)' }, rot);
    svg('circle', { r: r - 1, fill: 'none', stroke: '#000', 'stroke-width': 2.2, 'stroke-dasharray': '1.1 1.2', opacity: 0.65 }, rot);
    svg('circle', { r: r * 0.66, fill: 'url(#g-knobCap)' }, rot);
    svg('line', { x1: 0, y1: -r * 0.12, x2: 0, y2: -r * 0.62, stroke: '#f2f2f2', 'stroke-width': 1.7, 'stroke-linecap': 'round' }, rot);
    svg('path', { d: `M0 ${-r + 0.6} l-1.6 2.6 h3.2z`, fill: '#ddd', opacity: 0.85 }, rot);
  }
  // fixed specular highlight
  svg('ellipse', { cx: -r * 0.22, cy: -r * 0.32, rx: r * 0.42, ry: r * 0.26, fill: '#fff', opacity: style === 'white' || style === 'cream' || style === 'vox' ? 0.35 : 0.1, 'pointer-events': 'none' }, g);
  if (ctl.label && ctl.labelPos !== 'none') {
    const ly = ctl.labelPos === 'above' ? -r - (ctl.scale ? 15 : 8) : r + (ctl.scale ? 15 : 9);
    text(g, 0, ly, ctl.label, { size: ctl.labelSize || theme.labelSize || 7.5, fill: theme.text, font: theme.labelFont, weight: theme.labelWeight || 700, ls: theme.labelLs ?? 0.4 });
  }
  return {
    g,
    set(v01) {
      rot.setAttribute('transform', `rotate(${angleFor(v01, ctl.sweep || KNOB_SWEEP)})`);
    },
  };
}

// rotary selector (detented); labels are printed around it
export function drawSelector(parent, ctl, theme) {
  const n = ctl.options.length;
  const sweep = ctl.sweep || Math.min(300, Math.max(120, (n - 1) * 30));
  const k = drawKnob(parent, Object.assign({}, ctl, { sweep, scale: false, ticks: false, label: ctl.labelPos === 'below' ? ctl.label : null }), theme);
  const r = ctl.r || 13;
  if (ctl.printLabels !== false)
    ctl.options.forEach((o, i) => {
      const a = ((-sweep / 2 + (sweep * i) / Math.max(1, n - 1)) * Math.PI) / 180;
      const rr = r + (ctl.labelRadius || 9);
      const t = text(k.g, Math.sin(a) * rr, -Math.cos(a) * rr, o, { size: ctl.optSize || 5.4, fill: theme.text, weight: 700, ls: 0.1 });
      t.setAttribute('class', 'sel-opt');
      svg('circle', { cx: Math.sin(a) * (r + 3), cy: -Math.cos(a) * (r + 3), r: 0.8, fill: theme.text, opacity: 0.8 }, k.g);
    });
  if (ctl.label && ctl.labelPos !== 'below' && ctl.labelPos !== 'none')
    text(k.g, 0, ctl.labelPos === 'above' ? -r - (ctl.ring ? 13 : 16) : r + 15, ctl.label, { size: theme.labelSize || 7.5, fill: theme.text, font: theme.labelFont });
  // LED ring (e.g. multi-FX amp selector): one LED per position
  const ring = [];
  if (ctl.ring)
    ctl.options.forEach((o, i) => {
      const a = ((-sweep / 2 + (sweep * i) / Math.max(1, n - 1)) * Math.PI) / 180;
      const rr = r + 6;
      ring.push(svg('circle', { cx: Math.sin(a) * rr, cy: -Math.cos(a) * rr, r: 1.6, class: 'led', fill: '#2a0d0d' }, k.g));
    });
  return {
    g: k.g,
    set(idx) {
      k.set(n > 1 ? idx / (n - 1) : 0.5);
      ring.forEach((d, i) => {
        setA(d, 'fill', i === idx && i > 0 ? '#ff3020' : i === idx ? '#555' : '#2a0d0d');
      });
    },
    sweep,
  };
}

// mini toggle switch (2 or 3 way)
export function drawToggle(parent, ctl, theme) {
  const g = svg('g', { class: 'ctl toggle', transform: `translate(${ctl.x},${ctl.y})` }, parent);
  g.dataset.ctl = ctl.cid;
  const n = ctl.options.length;
  const horiz = ctl.orient === 'h';
  svg('rect', { x: -14, y: -16, width: 28, height: 32, fill: 'transparent' }, g);
  if (ctl.plate !== false) svg('circle', { r: 6.4, fill: '#111', opacity: 0.4, cy: 1 }, g);
  svg('polygon', { points: hex(5.6), fill: 'url(#g-nut)', stroke: '#2a2d31', 'stroke-width': 0.4 }, g);
  svg('circle', { r: 3.4, fill: '#24272b' }, g);
  const lever = svg('g', {}, g);
  svg('line', { x1: 0, y1: 0, x2: 0, y2: -11, stroke: 'url(#g-chrome)', 'stroke-width': 3.2, 'stroke-linecap': 'round' }, lever);
  svg('circle', { cx: 0, cy: -11, r: 2.4, fill: 'url(#g-chromeDome)' }, lever);
  const labels = [];
  ctl.options.forEach((o, i) => {
    let x, y, anchor = 'start';
    if (horiz) {
      x = n === 2 ? (i === 0 ? -11 : 11) : -14 + i * 14;
      y = 11.5;
      anchor = 'middle';
    } else {
      x = ctl.labelSide === 'left' ? -9 : 9;
      y = n === 2 ? (i === 0 ? -8 : 8) : -10 + i * 10;
      anchor = ctl.labelSide === 'left' ? 'end' : 'start';
    }
    labels.push(text(g, x, y, o, { size: ctl.optSize || 5.2, fill: theme.text, anchor, weight: 700, ls: 0.1 }));
  });
  if (ctl.label && theme.toggleTitles !== false) text(g, 0, horiz ? -14 : -20, ctl.label, { size: 6, fill: theme.text, weight: 700 });
  return {
    g,
    set(idx) {
      let ang;
      if (n === 2) ang = idx === 0 ? -32 : 32;
      else ang = [-36, 0, 36][Math.max(0, Math.min(2, idx))];
      if (horiz) lever.setAttribute('transform', `rotate(${ang + 90 * 0})`);
      else {
        // vertical toggles: up / middle(sideways-ish short) / down
        const a = n === 2 ? (idx === 0 ? 0 : 180) : [0, 0, 180][idx];
        const sc = n === 3 && idx === 1 ? 0.25 : 1;
        lever.setAttribute('transform', `rotate(${a}) scale(1,${sc})`);
      }
      labels.forEach((l, i) => l.setAttribute('opacity', i === idx ? 1 : 0.55));
    },
  };
}
function hex(r) {
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i + Math.PI / 6;
    pts.push(`${(Math.cos(a) * r).toFixed(2)},${(Math.sin(a) * r).toFixed(2)}`);
  }
  return pts.join(' ');
}
export { hex };

// small push button (with optional LED ring)
export function drawButton(parent, ctl, theme) {
  const r = ctl.r || 5;
  const g = svg('g', { class: 'ctl button', transform: `translate(${ctl.x},${ctl.y})` }, parent);
  g.dataset.ctl = ctl.cid;
  svg('circle', { r: r + 5, fill: 'transparent' }, g);
  if (ctl.shape === 'rect') {
    const w = ctl.w || 16, h = ctl.h || 8;
    svg('rect', { x: -w / 2 - 1, y: -h / 2 - 1, width: w + 2, height: h + 2, rx: 2.5, fill: '#000', opacity: 0.5 }, g);
    const cap = svg('rect', { x: -w / 2, y: -h / 2, width: w, height: h, rx: 2, fill: ctl.color || '#2a2c31', stroke: '#000', 'stroke-width': 0.5 }, g);
    svg('rect', { x: -w / 2 + 1, y: -h / 2 + 0.6, width: w - 2, height: h * 0.4, rx: 1.5, fill: '#fff', opacity: 0.12 }, g);
    var capEl = cap;
  } else {
    svg('circle', { r: r + 1.4, fill: 'url(#g-chrome)' }, g);
    capEl = svg('circle', { r, fill: ctl.color || 'url(#g-knobBlack)' }, g);
    svg('circle', { r: r * 0.6, cx: -r * 0.2, cy: -r * 0.25, fill: '#fff', opacity: 0.12 }, g);
  }
  let led = null;
  let ledHalo = null;
  if (ctl.led) {
    led = svg('circle', { cx: ctl.ledDx ?? 0, cy: ctl.ledDy ?? -(r + 6), r: 2, class: 'led', fill: '#3a1010' }, g);
    ledHalo = svg('circle', { cx: ctl.ledDx ?? 0, cy: ctl.ledDy ?? -(r + 6), r: 6, fill: haloFill(ctl.ledColor || '#4aa8ff'), 'fill-opacity': 0, 'pointer-events': 'none' }, g);
  }
  if (ctl.label) text(g, 0, ctl.labelPos === 'above' ? -r - 8 : r + 8, ctl.label, { size: ctl.labelSize || 5.6, fill: theme.text, weight: 700 });
  return {
    g,
    set(on) {
      if (led) {
        setA(led, 'fill', on ? ctl.ledColor || '#4aa8ff' : '#151a22');
        if (ledHalo) setA(ledHalo, 'fill-opacity', on ? 0.9 : 0); // fill-opacity: repaint only (opacity toggles rebuild the compositor's property trees)
      }
      setA(capEl, 'fill-opacity', on && !led ? 0.85 : 1);
    },
    press(p) {
      g.setAttribute('transform', `translate(${ctl.x},${ctl.y + (p ? 0.6 : 0)})`);
    },
  };
}

// LED
export function drawLed(parent, ctl) {
  const g = svg('g', { transform: `translate(${ctl.x},${ctl.y})`, 'pointer-events': 'none' }, parent);
  const r = ctl.r || 3;
  svg('circle', { r: r + 1.3, fill: ctl.bezel || 'url(#g-chrome)' }, g);
  const lens = svg('circle', { r, class: 'led', fill: offColor(ctl.color || '#ff2a1a') }, g);
  const halo = svg('circle', { r: r * 3.4, 'fill-opacity': 0, 'pointer-events': 'none' }, g);
  svg('circle', { r: r * 0.95, fill: 'url(#g-ledLens)' }, g);
  if (ctl.label) text(g, 0, -r - 6, ctl.label, { size: 5.5, fill: ctl.textColor || '#222', weight: 700 });
  let cur = null;
  return {
    g,
    set(color) {
      // color: null/false = off, true = default colour, or a css colour string
      const c = color === true ? ctl.color || '#ff2a1a' : color;
      if (c === cur) return;
      cur = c;
      if (!c) {
        lens.setAttribute('fill', offColor(ctl.color || '#ff2a1a'));
        halo.setAttribute('fill-opacity', 0);
      } else {
        lens.setAttribute('fill', c);
        halo.setAttribute('fill', haloFill(c));
        halo.setAttribute('fill-opacity', 1);
      }
    },
  };
}
function offColor(c) {
  try {
    return shade(c, -0.78);
  } catch (_) {
    return '#2a0a0a';
  }
}

// footswitches: 'stomp' (round metal), 'ts' (rubber rocker), 'rc' (rubber pad), 'plate' (BOSS pedal area: invisible hit rect)
export function drawFoot(parent, ctl, theme) {
  const g = svg('g', { class: 'ctl foot-wrap', transform: `translate(${ctl.x},${ctl.y})` }, parent);
  g.dataset.ctl = ctl.cid;
  const inner = svg('g', { class: 'foot' }, g);
  const style = ctl.style || 'stomp';
  if (style === 'plate') {
    svg('rect', { x: -ctl.w / 2, y: -ctl.h / 2, width: ctl.w, height: ctl.h, rx: 6, fill: 'transparent' }, inner);
  } else if (style === 'ts') {
    const w = ctl.w || 90, h = ctl.h || 70;
    svg('rect', { x: -w / 2 - 2, y: -h / 2 + 3, width: w + 4, height: h, rx: 7, fill: '#000', opacity: 0.45 }, inner);
    svg('rect', { x: -w / 2, y: -h / 2, width: w, height: h, rx: 6, fill: ctl.color || '#2b2c30', stroke: '#000', 'stroke-opacity': 0.4 }, inner);
    svg('rect', { x: -w / 2 + 5, y: -h / 2 + 5, width: w - 10, height: h - 10, rx: 4, fill: 'url(#p-pad)', opacity: 0.85 }, inner);
    svg('rect', { x: -w / 2, y: -h / 2, width: w, height: h * 0.35, rx: 6, fill: '#fff', opacity: 0.07 }, inner);
  } else if (style === 'rc') {
    const w = ctl.w || 52, h = ctl.h || 46;
    svg('rect', { x: -w / 2 - 2, y: -h / 2 - 2, width: w + 4, height: h + 6, rx: 6, fill: '#000', opacity: 0.5 }, inner);
    svg('rect', { x: -w / 2, y: -h / 2, width: w, height: h, rx: 5, fill: 'url(#g-rubberLight)', stroke: '#0b0b0c', 'stroke-width': 0.8 }, inner);
    svg('rect', { x: -w / 2 + 3, y: -h / 2 + 3, width: w - 6, height: h - 6, rx: 3, fill: 'url(#p-ridges)', opacity: 0.7 }, inner);
    if (ctl.text) text(inner, 0, h / 2 + 7, ctl.text, { size: 5.5, fill: theme.text, weight: 700 });
  } else if (style === 'soft') {
    const r = ctl.r || 11;
    svg('circle', { r: r + 2.5, fill: '#000', opacity: 0.45, cy: 2 }, inner);
    svg('circle', { r: r + 1.5, fill: 'url(#g-chrome)' }, inner);
    svg('circle', { r, fill: 'url(#g-knobBlack)' }, inner);
  } else {
    const r = ctl.r || 11;
    svg('circle', { r: r + 6, cy: 2.8, fill: 'url(#g-knobShadow)', opacity: 0.75 }, inner);
    svg('polygon', { points: hex(r + 3.5), fill: 'url(#g-nut)', stroke: '#2a2d31', 'stroke-width': 0.5 }, inner);
    svg('circle', { r: r + 0.5, fill: 'url(#g-chrome)' }, inner);
    svg('circle', { r: r - 1.2, fill: 'none', stroke: '#000', 'stroke-width': 1.4, 'stroke-dasharray': '0.8 1', opacity: 0.35 }, inner);
    svg('circle', { r: r * 0.68, fill: 'url(#g-chromeDome)' }, inner);
  }
  if (ctl.label) text(g, 0, ctl.labelDy ?? (style === 'stomp' || style === 'soft' ? (ctl.r || 11) + 11 : (ctl.h || 46) / 2 + 9), ctl.label, { size: ctl.labelSize || 6, fill: theme.text, weight: 700 });
  return {
    g,
    inner,
    set() {},
    press(p) {
      inner.classList.toggle('pressed', !!p);
    },
  };
}

// vertical slider (graphic EQ / looper levels)
export function drawSlider(parent, ctl, theme) {
  const h = ctl.h || 44, w = ctl.w || 7;
  const outer = svg('g', { class: 'ctl slider', transform: `translate(${ctl.x},${ctl.y})` }, parent);
  outer.dataset.ctl = ctl.cid;
  // orient 'h': the same slider turned on its side (value grows to the right)
  const g = ctl.orient === 'h' ? svg('g', { transform: 'rotate(90)' }, outer) : outer;
  svg('rect', { x: -9, y: -h / 2 - 6, width: 18, height: h + 12, fill: 'transparent' }, g);
  if (ctl.marks !== false)
    for (let i = 0; i <= 6; i++) {
      const yy = -h / 2 + (h * i) / 6;
      svg('line', { x1: -w - 1, x2: -w + 1.5, y1: yy, y2: yy, stroke: theme.text, 'stroke-width': 0.6, opacity: 0.7 }, g);
      svg('line', { x1: w - 1.5, x2: w + 1, y1: yy, y2: yy, stroke: theme.text, 'stroke-width': 0.6, opacity: 0.7 }, g);
    }
  svg('rect', { x: -1.6, y: -h / 2, width: 3.2, height: h, rx: 1.6, fill: '#050505', stroke: '#000', 'stroke-width': 0.4 }, g);
  const cap = svg('g', {}, g);
  svg('rect', { x: -w / 2 - 0.5, y: -4.5, width: w + 1, height: 9.5, rx: 1.5, fill: '#000', opacity: 0.5 }, cap);
  svg('rect', { x: -w / 2, y: -4.5, width: w, height: 9, rx: 1.4, fill: ctl.capColor || 'url(#g-knobSkirt)', stroke: '#000', 'stroke-width': 0.4 }, cap);
  svg('line', { x1: -w / 2 + 0.6, x2: w / 2 - 0.6, y1: 0, y2: 0, stroke: ctl.lineColor || '#eee', 'stroke-width': 1 }, cap);
  let led = null;
  if (ctl.led) led = svg('rect', { x: -w / 2 + 1.2, y: -3.6, width: w - 2.4, height: 1.6, rx: 0.6, class: 'led', fill: '#0b1a2a' }, cap);
  if (ctl.label) {
    if (ctl.orient === 'h') text(outer, 0, w + 11, ctl.label, { size: ctl.labelSize || 5.4, fill: theme.text, weight: 700, ls: 0 });
    else text(g, 0, h / 2 + 9, ctl.label, { size: ctl.labelSize || 5.4, fill: theme.text, weight: 700, ls: 0 });
  }
  const flipH = 1; // rotate(90) maps cap y to -x, so the value already grows to the right
  return {
    g: outer,
    set(v01) {
      cap.setAttribute('transform', `translate(0,${flipH * ((h / 2) - h * clamp(v01, 0, 1))})`);
    },
    led(on) {
      if (led) {
        setA(led, 'fill', on ? ctl.ledColor || '#3fa8ff' : '#0b1a2a');
      }
    },
    h,
  };
}

// jack (1/4" socket with hex nut)
// expression treadle (wah / volume / whammy)
export function drawTreadle(parent, ctl) {
  const g = svg('g', { class: 'ctl treadle', transform: `translate(${ctl.x},${ctl.y})` }, parent);
  g.dataset.ctl = ctl.cid;
  const w = ctl.w, h = ctl.h;
  svg('rect', { x: -w / 2, y: -h / 2, width: w, height: h, fill: 'transparent' }, g);
  const tread = svg('g', {}, g);
  svg('rect', { x: -w / 2 - 2, y: -h / 2 + 4, width: w + 4, height: h, rx: 10, fill: '#000', opacity: 0.55 }, tread);
  svg('rect', { x: -w / 2, y: -h / 2, width: w, height: h, rx: 10, fill: ctl.color || '#1b1c1f', stroke: '#000', 'stroke-width': 0.8 }, tread);
  svg('rect', { x: -w / 2 + 7, y: -h / 2 + 10, width: w - 14, height: h - 20, rx: 6, fill: 'url(#p-pad)', opacity: 0.9 }, tread);
  if (ctl.logo) text(tread, 0, -h * 0.05, ctl.logo, { size: ctl.logoSize || 15, fill: ctl.logoColor || '#d9d9d9', font: ctl.logoFont || "'Dancing Script', cursive", weight: 700, ls: 0.5, transform: `rotate(-90 0 ${-h * 0.05})` });
  const sheen = svg('rect', { x: -w / 2, y: -h / 2, width: w, height: h, rx: 10, fill: 'url(#g-shadeV)', opacity: 0.9 }, tread);
  return {
    g,
    set(v01) {
      // toe down = 1: the toe end catches more light and the visible length shrinks slightly (perspective)
      const s = 0.94 + 0.06 * (1 - v01);
      tread.setAttribute('transform', `scale(1,${s})`);
      sheen.setAttribute('opacity', 0.5 + 0.5 * v01);
    },
  };
}

export function textColorFor(hex) {
  try {
    return luminance(hex) > 0.55 ? '#141414' : '#f2f2f2';
  } catch (_) {
    return '#111';
  }
}
