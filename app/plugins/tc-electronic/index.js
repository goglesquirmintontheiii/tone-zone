// Built-in Tone Zone plugin: TC Electronic.
// Blocks inspired by TC Electronic gear. Names, logos and artwork are Tone Zone originals; control layouts and
// colours follow the real units (see each block's `ref`).
//
// Custom forms:
//  * `tc-stomp`: rounded die-cast TC box in four sizes (def.tcSize): `std` (TonePrint standard, side jacks),
//    `mini` (mini series, top jacks), `budget` (newer 3-knob line, top jacks), `wide` (2-footswitch looper).
//    Per-block artwork via def.art (printed graphic behind the name) and the small "TP" mini button (tp: true).
//  * `tc-x5`: five-slot multi pedal (one display, knob and footswitch per slot).
import { registerMore } from './more.js';

export default function register(tz) {
  const { K, SEL, TOG, BTN, FOOT, LED, SCREEN, def, ten, db, ms, MONO, STEREO } = tz.helpers;
  const { svg, label, formKit, luminance, textColorFor } = tz.gfx;

  // ------------------------------------------------------------------ printed artwork
  // every art is drawn centred on (cx, cy) inside roughly ±s, in one colour with low opacity
  function art(g, kind, cx, cy, s, c, op = 0.22) {
    const a = svg('g', { transform: `translate(${cx},${cy})`, opacity: op, 'pointer-events': 'none' }, g);
    const st = { fill: 'none', stroke: c, 'stroke-width': 1.6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };
    const P = (d, o = {}) => svg('path', Object.assign({ d }, st, o), a);
    switch (kind) {
      case 'star': {
        let d = '';
        for (let i = 0; i < 10; i++) {
          const r = i % 2 ? s * 0.42 : s, an = (Math.PI / 5) * i - Math.PI / 2;
          d += (i ? 'L' : 'M') + (Math.cos(an) * r).toFixed(1) + ' ' + (Math.sin(an) * r).toFixed(1);
        }
        P(d + 'Z', { fill: c, 'fill-opacity': 0.35 });
        break;
      }
      case 'echo':
        for (let i = 1; i <= 4; i++) P(`M${-s * 0.9 + i * s * 0.32} ${-s * 0.25 * i} A ${s * 0.3 * i} ${s * 0.3 * i} 0 0 1 ${-s * 0.9 + i * s * 0.32} ${s * 0.25 * i}`, { 'stroke-width': 2.2 - i * 0.3 });
        svg('circle', { cx: -s * 0.85, cy: 0, r: s * 0.12, fill: c }, a);
        break;
      case 'loop':
        P(`M${-s} 0 C ${-s} ${-s * 0.6} ${-s * 0.2} ${-s * 0.6} 0 0 C ${s * 0.2} ${s * 0.6} ${s} ${s * 0.6} ${s} 0 C ${s} ${-s * 0.6} ${s * 0.2} ${-s * 0.6} 0 0 C ${-s * 0.2} ${s * 0.6} ${-s} ${s * 0.6} ${-s} 0 Z`, { 'stroke-width': 2.4 });
        break;
      case 'bolt':
        P(`M${s * 0.15} ${-s} L${-s * 0.45} ${s * 0.1} H${s * 0.05} L${-s * 0.15} ${s} L${s * 0.5} ${-s * 0.15} H${0} Z`, { fill: c, 'fill-opacity': 0.45 });
        break;
      case 'rays':
        svg('circle', { r: s * 0.38, fill: c, 'fill-opacity': 0.3, stroke: c, 'stroke-width': 1.4 }, a);
        for (let i = 0; i < 16; i++) {
          const an = (Math.PI / 8) * i, r1 = s * 0.5, r2 = s * (i % 2 ? 0.78 : 1);
          P(`M${(Math.cos(an) * r1).toFixed(1)} ${(Math.sin(an) * r1).toFixed(1)} L${(Math.cos(an) * r2).toFixed(1)} ${(Math.sin(an) * r2).toFixed(1)}`);
        }
        break;
      case 'spiral': {
        let d = 'M0 0';
        for (let t = 0; t < 22; t++) {
          const an = t * 0.5, r = (s * t) / 22;
          d += ` L${(Math.cos(an) * r).toFixed(1)} ${(Math.sin(an) * r).toFixed(1)}`;
        }
        P(d, { 'stroke-width': 2 });
        break;
      }
      case 'wave':
        for (let k = -1; k <= 1; k++) P(`M${-s} ${k * s * 0.35} q ${s * 0.25} ${-s * 0.4} ${s * 0.5} 0 t ${s * 0.5} 0 t ${s * 0.5} 0 t ${s * 0.5} 0`, { 'stroke-width': 2 - Math.abs(k) * 0.6 });
        break;
      case 'oct':
        P(`M${-s} ${s * 0.5} L${-s * 0.4} ${s * 0.5} L${-s * 0.4} ${-s * 0.1} L${s * 0.2} ${-s * 0.1} L${s * 0.2} ${-s * 0.7} L${s} ${-s * 0.7}`, { 'stroke-width': 2.4 });
        P(`M${-s} ${s * 0.85} H${s}`, { 'stroke-width': 1 });
        break;
      case 'twin':
        for (const dx of [-s * 0.18, s * 0.18]) P(`M${dx - s * 0.6} ${s * 0.6} L${dx} ${-s * 0.8} L${dx + s * 0.6} ${s * 0.6}`, { 'stroke-width': 2 });
        break;
      case 'helix':
        P(`M${-s} 0 C ${-s * 0.5} ${-s} ${-s * 0.5} ${s} 0 0 S ${s * 0.5} ${-s} ${s} 0`, { 'stroke-width': 2.2 });
        P(`M${-s} 0 C ${-s * 0.5} ${s} ${-s * 0.5} ${-s} 0 0 S ${s * 0.5} ${s} ${s} 0`, { 'stroke-width': 1.2 });
        break;
      case 'drop':
        P(`M0 ${-s} C ${s * 0.6} ${-s * 0.2} ${s * 0.7} ${s * 0.25} ${s * 0.45} ${s * 0.6} A ${s * 0.6} ${s * 0.6} 0 0 1 ${-s * 0.45} ${s * 0.6} C ${-s * 0.7} ${s * 0.25} ${-s * 0.6} ${-s * 0.2} 0 ${-s} Z`, { fill: c, 'fill-opacity': 0.3 });
        break;
      case 'flame':
        P(`M0 ${s} C ${-s * 0.8} ${s * 0.6} ${-s * 0.6} ${-s * 0.1} ${-s * 0.15} ${-s * 0.4} C ${-s * 0.2} ${-s * 0.05} 0 ${s * 0.1} ${s * 0.1} ${-s * 0.1} C ${s * 0.2} ${-s * 0.5} 0 ${-s * 0.8} ${s * 0.1} ${-s} C ${s * 0.7} ${-s * 0.5} ${s * 0.8} ${s * 0.5} 0 ${s} Z`, { fill: c, 'fill-opacity': 0.35 });
        break;
      case 'eye':
        P(`M${-s} 0 Q 0 ${-s * 0.9} ${s} 0 Q 0 ${s * 0.9} ${-s} 0 Z`, { 'stroke-width': 2 });
        svg('circle', { r: s * 0.3, fill: c }, a);
        break;
      case 'rust':
        for (let i = 0; i < 14; i++) {
          const an = i * 2.4, r = s * (0.25 + ((i * 37) % 10) / 14);
          svg('circle', { cx: Math.cos(an) * r, cy: Math.sin(an) * r * 0.7, r: 1.5 + ((i * 13) % 5) * 0.8, fill: c }, a);
        }
        break;
      case 'gravity':
        svg('circle', { r: s * 0.22, fill: c }, a);
        for (let i = 1; i <= 3; i++) svg('ellipse', { rx: s * (0.35 + 0.22 * i), ry: s * (0.15 + 0.1 * i), fill: 'none', stroke: c, 'stroke-width': 1.3 }, a);
        break;
      case 'spectrum':
        for (let i = 0; i < 9; i++) {
          const hh = s * (0.3 + 0.7 * Math.abs(Math.sin(i * 1.3 + 0.4)));
          svg('rect', { x: -s + i * (s / 4.2), y: s * 0.7 - hh, width: s / 6, height: hh, fill: c }, a);
        }
        break;
      case 'pipe':
        P(`M${-s} ${s * 0.4} H${-s * 0.2} Q ${s * 0.2} ${s * 0.4} ${s * 0.2} 0 V${-s * 0.4} Q ${s * 0.2} ${-s * 0.8} ${s * 0.6} ${-s * 0.8} H${s}`, { 'stroke-width': s * 0.28, 'stroke-opacity': 0.6 });
        break;
      case 'shimmer':
        for (let i = 0; i < 7; i++) {
          const x = Math.cos(i * 2.1) * s * 0.75, y = Math.sin(i * 1.7) * s * 0.6, r = s * (0.1 + (i % 3) * 0.07);
          P(`M${x} ${y - r * 2} L${x + r * 0.4} ${y - r * 0.4} L${x + r * 2} ${y} L${x + r * 0.4} ${y + r * 0.4} L${x} ${y + r * 2} L${x - r * 0.4} ${y + r * 0.4} L${x - r * 2} ${y} L${x - r * 0.4} ${y - r * 0.4} Z`, { fill: c, 'fill-opacity': 0.6, 'stroke-width': 0.6 });
        }
        break;
      case 'body':
        P(`M0 ${-s} C ${s * 0.5} ${-s} ${s * 0.45} ${-s * 0.3} ${s * 0.3} ${-s * 0.2} C ${s * 0.8} ${s * 0.1} ${s * 0.8} ${s} 0 ${s} C ${-s * 0.8} ${s} ${-s * 0.8} ${s * 0.1} ${-s * 0.3} ${-s * 0.2} C ${-s * 0.45} ${-s * 0.3} ${-s * 0.5} ${-s} 0 ${-s} Z`, { 'stroke-width': 1.8 });
        svg('circle', { cy: s * 0.2, r: s * 0.22, fill: 'none', stroke: c, 'stroke-width': 1.6 }, a);
        break;
      case 'stripes':
        ['#e8452c', '#f39a1d', '#f7d417', '#4fb648', '#2f8fd8'].forEach((sc, i) => svg('rect', { x: -s * 1.4, y: -s * 0.55 + i * s * 0.22, width: s * 2.8, height: s * 0.12, fill: sc }, a));
        break;
      case 'laurel':
        for (const sx of [-1, 1]) {
          P(`M${sx * s * 0.2} ${s * 0.8} Q ${sx * s} ${s * 0.4} ${sx * s * 0.7} ${-s * 0.8}`, { 'stroke-width': 1.4 });
          for (let i = 0; i < 5; i++) {
            const y = s * 0.6 - i * s * 0.32, x = sx * (s * 0.55 + Math.sin(i * 0.6) * s * 0.25);
            svg('ellipse', { cx: x, cy: y, rx: s * 0.16, ry: s * 0.07, transform: `rotate(${sx * -40} ${x} ${y})`, fill: c }, a);
          }
        }
        break;
      case 'tube':
        svg('rect', { x: -s * 0.35, y: -s, width: s * 0.7, height: s * 1.7, rx: s * 0.35, fill: c, 'fill-opacity': 0.15, stroke: c, 'stroke-width': 1.6 }, a);
        P(`M${-s * 0.18} ${s * 0.4} V${-s * 0.4} M${s * 0.18} ${s * 0.4} V${-s * 0.4} M${-s * 0.25} 0 H${s * 0.25}`, { 'stroke-width': 1.2 });
        for (const x of [-0.2, 0, 0.2]) P(`M${x * s} ${s * 0.7} V${s}`);
        break;
      case 'shield':
        P(`M0 ${-s} L${s * 0.8} ${-s * 0.65} V${0} Q ${s * 0.75} ${s * 0.7} 0 ${s} Q ${-s * 0.75} ${s * 0.7} ${-s * 0.8} 0 V${-s * 0.65} Z`, { fill: c, 'fill-opacity': 0.2, 'stroke-width': 2 });
        break;
      case 'bars':
        for (let i = 0; i < 6; i++) P(`M${-s + i * s * 0.4} ${-s * 0.8} V${s * 0.8}`, { 'stroke-width': s * 0.14 });
        break;
      case 'chord':
        for (let i = 0; i < 5; i++) P(`M${-s} ${-s * 0.6 + i * s * 0.3} H${s}`, { 'stroke-width': 0.9 });
        [[-0.5, 0.3], [0, 0], [0.5, -0.3]].forEach(([x, y]) => svg('ellipse', { cx: x * s, cy: y * s, rx: s * 0.17, ry: s * 0.12, transform: `rotate(-20 ${x * s} ${y * s})`, fill: c }, a));
        break;
      case 'infinity':
        P(`M0 0 C ${s * 0.3} ${-s * 0.6} ${s} ${-s * 0.6} ${s} 0 S ${s * 0.3} ${s * 0.6} 0 0 S ${-s} ${-s * 0.6} ${-s} 0 S ${-s * 0.3} ${s * 0.6} 0 0`, { 'stroke-width': 3 });
        break;
      case 'storm':
        P(`M${-s * 0.8} ${-s * 0.1} A ${s * 0.32} ${s * 0.32} 0 0 1 ${-s * 0.3} ${-s * 0.55} A ${s * 0.42} ${s * 0.42} 0 0 1 ${s * 0.45} ${-s * 0.45} A ${s * 0.3} ${s * 0.3} 0 0 1 ${s * 0.75} ${-s * 0.05} Z`, { fill: c, 'fill-opacity': 0.4 });
        P(`M${0} ${-s * 0.05} L${-s * 0.25} ${s * 0.45} H${s * 0.05} L${-s * 0.1} ${s}`, { 'stroke-width': 2 });
        break;
      case 'brain':
        P(`M${-s * 0.9} 0 C ${-s * 0.9} ${-s * 0.8} ${-s * 0.1} ${-s * 0.9} 0 ${-s * 0.5} C ${s * 0.1} ${-s * 0.9} ${s * 0.9} ${-s * 0.8} ${s * 0.9} 0 C ${s * 0.9} ${s * 0.7} ${s * 0.1} ${s * 0.8} 0 ${s * 0.45} C ${-s * 0.1} ${s * 0.8} ${-s * 0.9} ${s * 0.7} ${-s * 0.9} 0 Z M0 ${-s * 0.5} V${s * 0.45}`, { 'stroke-width': 1.8 });
        P(`M${-s * 0.6} ${-s * 0.15} q ${s * 0.2} ${-s * 0.2} ${s * 0.4} 0 M${s * 0.2} ${s * 0.15} q ${s * 0.2} ${-s * 0.2} ${s * 0.4} 0`, { 'stroke-width': 1.2 });
        break;
      case 'sun':
        svg('circle', { cy: s * 0.3, r: s * 0.6, fill: c, 'fill-opacity': 0.35 }, a);
        for (let i = 0; i < 4; i++) P(`M${-s * 1.2} ${s * 0.35 + i * s * 0.18} H${s * 1.2}`, { 'stroke-width': 1.2 });
        break;
      case 'needle':
        for (let i = -4; i <= 4; i++) P(`M${i * s * 0.22} ${s * 0.6} V${s * (i % 2 ? 0.45 : 0.3)}`, { 'stroke-width': 1 });
        P(`M0 ${s * 0.75} L${s * 0.35} ${-s * 0.6}`, { 'stroke-width': 2 });
        break;
      default:
        break;
    }
    return a;
  }

  // ------------------------------------------------------------------ TC die-cast enclosure
  // x3 / x4: three or four footswitch boxes, pre: two-channel preamp pedals
  const SIZES = { std: [134, 236], mini: [96, 190], budget: [124, 216], wide: [186, 234], x3: [228, 234], x4: [276, 234], pre: [214, 236] };
  const spread = (list, x0, x1, y) => list.forEach((c, i) => {
    c.x = list.length === 1 ? (x0 + x1) / 2 : x0 + ((x1 - x0) * i) / (list.length - 1);
    c.y = y;
  });
  tz.addForm('tc-stomp', (ctx, d) => {
    const size = d.tcSize || 'std';
    const [w, h] = SIZES[size] || SIZES.std;
    const g = ctx.g;
    const col = d.color, txt = d.text || textColorFor(col);
    const dark = luminance(col) < 0.45;
    formKit.body(g, w, h, col, { rx: size === 'mini' ? 12 : 15 });
    // die-cast bevel + rounded top face
    svg('rect', { x: 4, y: 4, width: w - 8, height: h - 8, rx: size === 'mini' ? 9 : 12, fill: 'none', stroke: dark ? '#fff' : '#000', 'stroke-opacity': 0.12, 'stroke-width': 2.4 }, g);
    svg('path', { d: `M14 6.5 H${w - 14}`, stroke: '#fff', 'stroke-opacity': dark ? 0.18 : 0.5, 'stroke-width': 1.2, 'stroke-linecap': 'round' }, g);
    const theme = { text: txt, knob: d.knob || 'mxr', labelSize: size === 'mini' ? 5.6 : 6.2, labelLs: 0.5, toggleTitles: false };
    const free = (c) => !c.pinned; // forms can run several times: always lay out from scratch
    const knobs = d.controls.filter((c) => (c.t === 'knob' || c.t === 'sel') && free(c) && !c.small);
    const smalls = d.controls.filter((c) => (c.t === 'knob' || c.t === 'sel') && free(c) && c.small);
    const tps = d.controls.filter((c) => c.t === 'button' && c.tp && free(c));
    const toggles = d.controls.filter((c) => (c.t === 'toggle' || (c.t === 'button' && !c.tp)) && free(c));
    const foots = d.controls.filter((c) => c.t === 'foot' && free(c));
    const leds = d.controls.filter((c) => c.t === 'led' && free(c));
    const screens = d.controls.filter((c) => c.t === 'screen' && free(c));
    let nameY;
    if (size === 'mini') {
      const n = knobs.length;
      if (screens.length) { Object.assign(screens[0], { x: w / 2, y: 50, w: w - 18, h: 66 }); nameY = 102; }
      else if (n === 1) { Object.assign(knobs[0], { x: w / 2, y: 44, r: 16 }); nameY = 108; }
      else { spread(knobs, 22, w - 22, 38); knobs.forEach((k) => (k.r = k.r || (n >= 3 ? 9.5 : 12))); nameY = 108; }
      knobs.forEach((k) => (k.labelPos = k.labelPos || 'below'));
      const row2 = [...smalls, ...toggles];
      spread(row2, 26, w - 26, 78);
      tps.forEach((b) => Object.assign(b, { x: w / 2 + 5, y: n === 1 ? 82 : 76, r: 3.4 }));
      if (row2.length && tps.length) tps.forEach((b) => (b.x = w - 16));
      foots.forEach((f) => Object.assign(f, { style: 'stomp', x: w / 2, y: h - 30, r: 12 }));
      leds.forEach((l) => Object.assign(l, { x: w / 2, y: h - 56, r: 2.6 }));
      nameY = d.nameY ?? nameY - 4;
    } else {
      const big = size !== 'budget';
      const y1 = (d.knobY ?? (big ? 42 : 40));
      const n = knobs.length;
      const multi = size === 'x3' || size === 'x4';
      let y2 = n ? y1 + 46 : 52;
      let yk = y1;
      if (n > 5 || d.krows) {
        // two knob rows
        const r1 = d.krows ? d.krows[0] : Math.ceil(n / 2);
        const a = knobs.slice(0, r1), b = knobs.slice(r1);
        const m1 = a.length >= 4 ? 24 : 34;
        spread(a, m1, w - m1, y1);
        spread(b, b.length >= 4 ? 24 : 40, w - (b.length >= 4 ? 24 : 40), y1 + 40);
        knobs.forEach((k) => { k.r = k.r || 10; k.labelPos = k.labelPos || 'below'; });
        y2 = y1 + 84;
        yk = y1 + 40;
      } else {
        const m = multi ? (n >= 4 ? 34 : 56) : n >= 4 ? 20 : size === 'wide' || size === 'pre' ? 40 : 28;
        spread(knobs, m, w - m, y1);
        knobs.forEach((k) => { k.r = k.r || (n >= 4 ? 9.5 : n === 1 ? 15 : 12); k.labelPos = k.labelPos || 'below'; });
      }
      const row2 = [...smalls, ...toggles];
      spread(row2, row2.length > 2 ? 26 : 38, w - (row2.length > 2 ? 26 : 38), y2);
      smalls.forEach((k) => { k.r = k.r || 8.5; k.labelPos = k.labelPos || 'below'; });
      toggles.forEach((t) => (t.orient = t.orient || 'h'));
      tps.forEach((b) => Object.assign(b, { x: w - 17, y: 15, r: 3.4 }));
      screens.forEach((s) => Object.assign(s, { x: w / 2, y: s.y ?? 56, w: s.w || w - 30, h: s.h || 50 }));
      nameY = d.nameY ?? (row2.length ? y2 + 34 : n ? yk + 50 : 70) + (big ? 6 : 0);
      if (foots.length >= 3) {
        const fx = (i) => w * (0.14 + (0.72 * i) / (foots.length - 1));
        foots.forEach((f, i) => Object.assign(f, { style: 'stomp', x: fx(i), y: h - 40, r: 12.5 }));
        leds.forEach((l, i) => Object.assign(l, { x: i < foots.length ? fx(i) : w / 2, y: h - 72, r: 2.8 }));
      } else if (foots.length === 2) {
        foots.forEach((f, i) => Object.assign(f, { style: 'stomp', x: [w * 0.27, w * 0.73][i], y: h - 40, r: 12.5 }));
        // preamps: LEDs sit beside their switch so the name has room
        if (size === 'pre') leds.forEach((l, i) => Object.assign(l, { x: [w * 0.27 + 26, w * 0.73 - 26][i] ?? w / 2, y: h - 40, r: 2.8 }));
        else leds.forEach((l, i) => Object.assign(l, { x: [w * 0.27, w * 0.73][i] ?? w / 2, y: h - 74, r: 2.8 }));
      } else {
        foots.forEach((f) => Object.assign(f, { style: 'stomp', x: w / 2, y: big ? h - 40 : h - 34, r: 13 }));
        leds.forEach((l) => Object.assign(l, { x: w / 2, y: big ? h - 74 : h - 60, r: 2.8 }));
      }
    }
    // printed artwork + name
    const logo = d.logo || d.name.toLowerCase();
    const sub = d.tagline ?? (d.typeName || d.cat).toLowerCase();
    const maxW = w - 18;
    const fs = Math.min(size === 'mini' ? 15 : 19, (maxW / Math.max(4, logo.length)) * 1.85);
    if (d.art) art(g, d.art, w / 2, nameY - 2, size === 'mini' ? 20 : 26, d.artColor || txt, d.artOpacity ?? 0.2);
    label(g, w / 2, nameY, logo, { size: fs, fill: d.logoColor || txt, font: "'Inter', sans-serif", weight: 800, ls: -0.2 });
    label(g, w / 2, nameY + fs * 0.5 + 6, sub, { size: 6, fill: txt, font: "'Inter', sans-serif", weight: 600, ls: 1.1, opacity: 0.8 });
    // the TP mini switch gets a little circled "T" printed beside it
    for (const b of tps) {
      b.label = b.label ?? '';
      svg('circle', { cx: b.x - 10, cy: b.y, r: 4, fill: 'none', stroke: txt, 'stroke-width': 0.8, opacity: 0.85 }, g);
      label(g, b.x - 10, b.y + 0.3, 'T', { size: 5.2, fill: txt, weight: 800, font: "'Inter', sans-serif" });
    }
    formKit.tzBadge(g, w / 2, h - 9, txt, 4.2);
    formKit.placeControls(ctx, d.controls, theme);
    const top = size === 'mini' || size === 'budget' || d.topJacks;
    // a wide printed name would run into the side-jack labels: drop the jacks below the name + tagline
    const nameW = Math.max(logo.length * fs * 0.54, sub.length * 4.6);
    const jy = nameW > w - 50 ? Math.max(150, Math.ceil(nameY + fs * 0.5 + 25)) : 150;
    return { w, h, theme, jacks: top ? formKit.jacksTop(d, w, { flip: ctx.flip }) : formKit.jacksSide(d, w, { flip: ctx.flip, y0: jy, gap: 22 }) };
  });

  // five-slot multi pedal: per slot a little display (slot name), a knob, an LED and a footswitch
  tz.addForm('tc-x5', (ctx, d) => {
    const slots = d.slots || [];
    const step = 76, w = 30 + slots.length * step, h = 236;
    const g = ctx.g;
    const col = d.color, txt = d.text || '#ececec';
    formKit.body(g, w, h, col, { rx: 14 });
    svg('rect', { x: 4, y: 4, width: w - 8, height: h - 8, rx: 11, fill: 'none', stroke: '#fff', 'stroke-opacity': 0.08, 'stroke-width': 2.4 }, g);
    const theme = { text: txt, knob: 'mxr', labelSize: 6, labelLs: 0.5 };
    slots.forEach((s, i) => {
      const x = 15 + step * (i + 0.5);
      svg('rect', { x: x - 30, y: 16, width: 60, height: 34, rx: 3, fill: '#0b0d10', stroke: '#000' }, g);
      svg('rect', { x: x - 30, y: 16, width: 60, height: 34, rx: 3, fill: 'url(#g-glass)', opacity: 0.6 }, g);
      label(g, x, 27, s.name, { size: 6.4, fill: s.color || '#8fd3ff', weight: 800, font: "'Share Tech Mono', monospace", ls: 0.4 });
      label(g, x, 40, s.sub || '', { size: 5, fill: s.color || '#8fd3ff', weight: 600, font: "'Share Tech Mono', monospace", opacity: 0.75 });
      const k = d.controls.find((c) => c.slot === i && c.t === 'knob');
      if (k) Object.assign(k, { x, y: 82, r: 12, labelPos: 'below' });
      const f = d.controls.find((c) => c.slot === i && c.t === 'foot');
      if (f) Object.assign(f, { x, y: 184, r: 12.5, style: 'stomp' });
      const l = d.controls.find((c) => c.slot === i && c.t === 'led');
      if (l) Object.assign(l, { x, y: 152, r: 2.8 });
      if (i) svg('line', { x1: 15 + step * i, x2: 15 + step * i, y1: 120, y2: 214, stroke: txt, 'stroke-opacity': 0.12 }, g);
    });
    label(g, 30, 126, d.logo || d.name, { size: 15, fill: txt, font: "'Inter', sans-serif", weight: 800, anchor: 'start' });
    label(g, w - 30, 126, (d.typeName || '').toLowerCase(), { size: 6.4, fill: txt, font: "'Inter', sans-serif", weight: 600, anchor: 'end', opacity: 0.75, ls: 1 });
    formKit.tzBadge(g, w / 2, h - 9, txt, 4.4);
    formKit.placeControls(ctx, d.controls, theme);
    return { w, h, theme, jacks: formKit.jacksTop(d, w, { flip: ctx.flip }) };
  });

  // ------------------------------------------------------------------ builders
  const TC = (o) => def(Object.assign({ form: 'tc-stomp', brand: 'TC Electronic' }, o, {
    controls: [...(o.controls || []), ...(o.noStd ? [] : [FOOT(), LED({ color: o.led || '#ff2a1a' })])],
  }));
  // the TonePrint-style mini switch: a latching alternate voicing (`tp` param, read by each block's derive)
  const TP = (o = {}) => BTN('', Object.assign({ p: 'tp', toggle: true, tp: true, led: true, ledColor: '#3d8bff', ledDy: -7 }, o));
  const k = (p, label, o = {}) => K(p, label, Object.assign({ display: ten }, o));
  const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

  tz.addDefs([
    def({
      id: 'tc.polytune3', name: 'PolyTone 3', ref: 'TC Electronic PolyTune 3', brand: 'TC Electronic', code: 'PT3', cat: 'Utility', form: 'polytune', color: '#1d1e21', text: '#ececec',
      algo: 'tuner', opts: { mute: 1 },
      controls: [SCREEN('polytune', { x: 72, y: 76, w: 108, h: 80 }), BTN('TUNING', { x: 30, y: 18, r: 4, shape: 'rect', w: 18, h: 7, cycle: 'tuning', labelPos: 'below' }), BTN('DISPLAY', { x: 114, y: 18, r: 4, shape: 'rect', w: 18, h: 7, cycle: 'tunerDisplay', labelPos: 'below' }),
        FOOT({ style: 'stomp', x: 72, y: 196, r: 13 })],
      defaultBypass: true, tunerBlock: true, polyDefault: true,
      desc: 'Strum all strings for polyphonic view; play one note for chromatic. DISPLAY toggles needle / strobe.',
    }),

    // ---------------------------------------------------------------- reverbs
    TC({
      id: 'tc.hof2', name: 'Hall of Fable 2', ref: 'TC Electronic Hall of Fame 2', code: 'HOF-II', logo: 'hall of fable 2', typeName: 'Reverb', cat: 'Reverb',
      color: '#2c2d31', text: '#efe6d2', art: 'star', artColor: '#d8b36a', artOpacity: 0.3, stereo: 'both',
      algo: 'reverb', cost: 1.1,
      controls: [k('decay', 'DECAY', { def: 0.5 }), k('tone', 'TONE', { def: 0.55 }), k('mix', 'LEVEL', { def: 0.35 }),
        SEL('rtype', 'TYPE', ['SPR', 'ROOM', 'HALL', 'CHUR', 'PLATE', 'LOFI', 'MOD', 'TILE', 'SHIM', 'TP'], { def: 2, sweep: 300, small: true, r: 9, optSize: 3.9, labelRadius: 8, labelPos: 'none' }),
        TOG('pre', '', ['SHORT', 'MED', 'LONG'], { def: 1 })],
      derive: (p) => {
        const t = p.rtype ?? 2;
        const mode = [3, 0, 1, 1, 2, 0, 6, 0, 4, 5][t];
        const size = [0.4, 0.35, 0.6, 0.95, 0.5, 0.3, 0.6, 0.2, 0.7, 0.8][t];
        return { mode, size, predelay: [4, 25, 70][p.pre ?? 1], highdamp: t === 5 ? 0.92 : t === 7 ? 0.15 : 0.5, lowcut: t === 5 ? 0.5 : 0.15 };
      },
      desc: 'Ten reverb types (spring, room, hall, church, plate, lo-fi, mod, tile, shimmer, TP = cloud). Toggle sets the pre-delay.',
    }),
    TC({
      id: 'tc.hof2mini', name: 'Hall of Fable 2 Mini', ref: 'TC Electronic Hall of Fame 2 Mini', code: 'HOF-II M', logo: 'hall of fable', tagline: 'mini reverb', cat: 'Reverb', tcSize: 'mini',
      color: '#2c2d31', text: '#efe6d2', art: 'star', artColor: '#d8b36a', artOpacity: 0.3, stereo: 'both',
      algo: 'reverb', fixed: { decay: 0.55, tone: 0.55 },
      controls: [k('mix', 'REVERB', { def: 0.35 }), TP()],
      derive: (p) => (p.tp ? { mode: 2, size: 0.5, predelay: 12 } : { mode: 1, size: 0.6, predelay: 20 }),
      desc: 'One knob hall reverb. The TP switch loads the alternative voice (plate).',
    }),
    TC({
      id: 'tc.fluorescence', name: 'Phosphorescence Shimmer', ref: 'TC Electronic Fluorescence Shimmer Reverb', code: 'PHOS', logo: 'phosphor', tagline: 'shimmer reverb', cat: 'Reverb', tcSize: 'budget',
      color: '#d9e04a', text: '#1b1d10', art: 'shimmer', artOpacity: 0.35, stereo: 'both',
      algo: 'reverb', cost: 1.2,
      controls: [k('decay', 'DECAY', { def: 0.6 }), k('shimmer', 'SHIMMER', { def: 0.5 }), k('tone', 'TONE', { def: 0.55 }), k('mix', 'LEVEL', { def: 0.35 }),
        TOG('mode', '', ['SHIMMER', 'HALL', 'PLATE'], { values: [4, 1, 2] })],
    }),

    // ---------------------------------------------------------------- delays / loopers
    TC({
      id: 'tc.flashback2', name: 'Throwback 2 Delay', ref: 'TC Electronic Flashback 2', code: 'TB-II', logo: 'throwback 2', typeName: 'Delay', cat: 'Delay',
      color: '#e4e5e6', text: '#1a1b1d', art: 'echo', artOpacity: 0.28, stereo: 'both',
      algo: 'delay', opts: { maxMs: 2200 }, cost: 0.8,
      controls: [k('dtime', 'DELAY', { def: 0.4, virtual: true }), k('feedback', 'FEEDBACK', { def: 0.35, max: 0.98 }), k('mix', 'FX LEVEL', { def: 0.4 }),
        SEL('dtype', 'TYPE', ['2290', 'ANA', 'TAPE', 'LOFI', 'DYN', 'MOD', 'PING', 'SLAP', 'REV', 'CRYS', 'TP'], { def: 0, sweep: 300, small: true, r: 9, optSize: 3.8, labelRadius: 8, labelPos: 'none' }),
        TOG('subdiv', '', ['1/4', '1/4.', 'BOTH'], { values: [0, 1, 2] })],
      derive: (p) => {
        const t = p.dtype ?? 0;
        // [min ms, max ms, engine mode, tone, mod depth]
        const T = [[20, 2000, 0, 0.82, 0], [20, 1200, 1, 0.4, 0.1], [20, 1500, 2, 0.55, 0.15], [20, 1200, 3, 0.3, 0], [20, 2000, 10, 0.72, 0], [20, 1500, 4, 0.7, 0.4],
          [20, 2000, 7, 0.75, 0], [30, 220, 0, 0.7, 0], [200, 2000, 5, 0.7, 0], [200, 1500, 6, 0.75, 0], [20, 2000, 4, 0.6, 0.25]][t];
        return { time: T[0] + (T[1] - T[0]) * Math.pow(p.dtime ?? 0.4, 1.4), mode: T[2], tone: T[3], moddepth: T[4] };
      },
      tapFoot: true, tapLed: true,
      desc: 'Delay types: 2290 digital, analog, tape, lo-fi, dynamic (+ambience), mod, ping-pong, slapback, reverse, crystal (shimmer), TP. Hold the switch for tap tempo.',
    }),
    TC({
      id: 'tc.flashback2mini', name: 'Throwback 2 Mini', ref: 'TC Electronic Flashback 2 Mini', code: 'TB-II M', logo: 'throwback', tagline: 'mini delay', cat: 'Delay', tcSize: 'mini',
      color: '#e4e5e6', text: '#1a1b1d', art: 'echo', artOpacity: 0.28, stereo: 'both',
      algo: 'delay', opts: { maxMs: 1300 },
      controls: [k('dtime', 'DELAY', { def: 0.4, virtual: true }), k('feedback', 'F.BACK', { def: 0.35, max: 0.98 }), k('mix', 'FX LVL', { def: 0.4 }), TP()],
      derive: (p) => ({ time: 20 + 1180 * Math.pow(p.dtime ?? 0.4, 1.4), mode: p.tp ? 1 : 0, tone: p.tp ? 0.42 : 0.82 }),
      desc: 'Digital delay; the TP switch swaps in a warm analog voicing.',
    }),
    TC({
      id: 'tc.ditto', name: 'Likewise Looper', ref: 'TC Electronic Ditto Looper', code: 'LIKE', logo: 'likewise', tagline: 'looper', cat: 'Looper', tcSize: 'mini',
      color: '#c3c7cc', text: '#17191c', art: 'loop', artOpacity: 0.3, noStd: true,
      algo: 'looper', opts: { tracks: 1, maxSec: 300 }, stereo: 'both', alwaysOn: true, loopTracks: 1, cost: 0.2,
      controls: [k('level1', 'LOOP LEVEL', { def: 0.8 }),
        FOOT({ action: 'event', event: { type: 1, arg: 0 }, hold: { ms: 900, event: { type: 2, arg: 0 } }, doubleHold: { event: { type: 3, arg: 0 } } }), LED({ bind: 'looper:track:0' })],
      desc: 'Press: record → play → overdub. Hold: stop. Hold again while stopped: clear. 5 minutes of loop time.',
    }),
    TC({
      id: 'tc.dittox2', name: 'Likewise X2 Looper', ref: 'TC Electronic Ditto X2 Looper', code: 'LIKE X2', logo: 'likewise x2', tagline: 'looper', cat: 'Looper', tcSize: 'wide',
      color: '#c3c7cc', text: '#17191c', art: 'loop', artOpacity: 0.3, noStd: true,
      algo: 'looper', opts: { tracks: 1, maxSec: 300 }, stereo: 'both', alwaysOn: true, loopTracks: 1, cost: 0.2,
      controls: [k('level1', 'LOOP LEVEL', { def: 0.8 }),
        FOOT({ label: 'REC/PLAY', action: 'event', event: { type: 1, arg: 0 }, hold: { ms: 1200, event: { type: 4, arg: 0 } } }),
        FOOT({ label: 'STOP', action: 'event', event: { type: 2, arg: 0 }, hold: { ms: 1200, event: { type: 3, arg: 0 } } }),
        LED({ bind: 'looper:track:0' }), LED({ bind: 'looper:stop' })],
      desc: 'Left: record / play / overdub (hold = undo / redo). Right: stop (hold = clear). Stereo in and out.',
    }),

    // ---------------------------------------------------------------- boosts / drives
    TC({
      id: 'tc.spark', name: 'Sparx Booster', ref: 'TC Electronic Spark Booster', code: 'SPX', logo: 'sparx', typeName: 'Booster', cat: 'Boost',
      color: '#c9ccd0', text: '#161719', logoColor: '#d0261f', art: 'bolt', artColor: '#d0261f', artOpacity: 0.25,
      algo: 'boost', cost: 0.3,
      controls: [k('gain', 'GAIN', { def: 0.3 }), k('level', 'LEVEL', { def: 0.62 }),
        k('treble', 'TREBLE', { small: true }), TOG('mode', '', ['FAT', 'CLEAN', 'MID'], { values: [3, 0, 2], def: 1 }), k('bass', 'BASS', { small: true })],
      desc: 'Clean booster with active bass / treble and FAT / CLEAN / MID voicing.',
    }),
    TC({
      id: 'tc.sparkmini', name: 'Sparx Mini Booster', ref: 'TC Electronic Spark Mini Booster', code: 'SPX M', logo: 'sparx', tagline: 'mini booster', cat: 'Boost', tcSize: 'mini',
      color: '#c9ccd0', text: '#161719', logoColor: '#d0261f', art: 'bolt', artColor: '#d0261f', artOpacity: 0.25,
      algo: 'boost', fixed: { mode: 0, bass: 0.5, treble: 0.5, level: 0.62 }, cost: 0.3,
      controls: [k('gain', 'LEVEL', { def: 0.3 })],
      desc: 'Up to +20 dB of clean boost from one knob.',
    }),
    TC({
      id: 'tc.mojomojo', name: 'Moja Moja Overdrive', ref: 'TC Electronic MojoMojo Overdrive', code: 'MOJA', logo: 'moja moja', typeName: 'Overdrive', cat: 'Overdrive',
      color: '#c3352a', text: '#f6eee6', art: 'flame', artOpacity: 0.22,
      algo: 'drive', opts: { clip: 'asym', bias: 0.2, preHp: 70, gainMinDb: 2, gainMaxDb: 34, tone: 'eq3', eqRangeDb: 12, bassF: 120, midF: 800, trebleF: 3000, postLp: 9000, levelMaxDb: 8,
        modes: [{}, { preEq: [{ type: 'peak', f: 1100, q: 0.7, db: 4 }], gainMaxDb: 38 }] },
      fixed: { mid: 0.5 },
      controls: [k('gain', 'DRIVE'), k('level', 'LEVEL'), k('bass', 'BASS', { small: true }), TOG('mode', '', ['FAT', 'BRIGHT']), k('treble', 'TREBLE', { small: true })],
    }),
    TC({
      id: 'tc.darkmatter', name: 'Dark Energy Distortion', ref: 'TC Electronic Dark Matter Distortion', code: 'DKE', logo: 'dark energy', typeName: 'Distortion', cat: 'Distortion',
      color: '#1d2233', text: '#d9def0', art: 'gravity', artColor: '#8a7cff', artOpacity: 0.3,
      algo: 'drive', opts: { clip: 'diode', preHp: 90, gainMinDb: 8, gainMaxDb: 44, tone: 'eq3', eqRangeDb: 12, bassF: 110, midF: 900, trebleF: 3200, postLp: 7800, levelMaxDb: -1,
        modes: [{}, { preEq: [{ type: 'ls', f: 160, q: 0.7, db: 5 }] }] },
      fixed: { mid: 0.5 },
      controls: [k('gain', 'GAIN'), k('level', 'LEVEL'), k('bass', 'BASS', { small: true }), TOG('mode', '', ['TIGHT', 'FAT']), k('treble', 'TREBLE', { small: true })],
    }),
    TC({
      id: 'tc.rustyfuzz', name: 'Rustbucket Fuzz', ref: 'TC Electronic Rusty Fuzz', code: 'RSB', logo: 'rustbucket', typeName: 'Fuzz', cat: 'Fuzz',
      color: '#9b4d27', text: '#f5e4d2', art: 'rust', artColor: '#3a1a08', artOpacity: 0.35,
      algo: 'drive', opts: { clip: 'si', bias: 0.25, preHp: 60, gainMinDb: 16, gainMaxDb: 50, tone: 'eq3', eqRangeDb: 12, bassF: 120, midF: 800, trebleF: 2800, postLp: 7000, levelMaxDb: -7,
        modes: [{ clip: 'si' }, { clip: 'ge', bias: 0.35, gainMaxDb: 44 }] },
      fixed: { mid: 0.5 },
      controls: [k('gain', 'FUZZ', { def: 0.6 }), k('level', 'LEVEL'), k('bass', 'BASS', { small: true }), TOG('mode', '', ['SI', 'GE']), k('treble', 'TREBLE', { small: true })],
    }),
    TC({
      id: 'tc.eyemaster', name: 'Eyecatcher Metal', ref: 'TC Electronic Eyemaster Metal Distortion', code: 'EYC', logo: 'eyecatcher', tagline: 'metal distortion', cat: 'Distortion', tcSize: 'budget',
      color: '#18191b', text: '#9be26a', art: 'eye', artOpacity: 0.3,
      algo: 'drive', opts: { clip: 'diode', stages: 2, stage2Db: 14, preHp: 120, gainMinDb: 16, gainMaxDb: 54, tone: 'eq3', eqRangeDb: 14, bassF: 100, midF: 750, trebleF: 3500, postLp: 7200, levelMaxDb: -7,
        modes: [{}, { preHp: 60, postEq: [{ type: 'peak', f: 700, q: 0.8, db: -6 }] }] },
      controls: [k('gain', 'GAIN', { def: 0.6 }), k('bass', 'LOW'), k('mid', 'MID'), k('treble', 'HIGH'), k('level', 'LEVEL', { small: true }), TOG('mode', '', ['TIGHT', 'SCOOP'])],
    }),
    TC({
      id: 'tc.cinders', name: 'Ashes Overdrive', ref: 'TC Electronic Cinders Overdrive', code: 'ASH', logo: 'ashes', tagline: 'overdrive', cat: 'Overdrive', tcSize: 'budget',
      color: '#d4511f', text: '#1d0f08', art: 'flame', artColor: '#5a1a00', artOpacity: 0.25,
      algo: 'drive', opts: { clip: 'jfet', bias: 0.2, preHp: 60, gainMinDb: 0, gainMaxDb: 36, tone: 'lp', toneLo: 1400, toneHi: 10000, postLp: 9000, levelMaxDb: 8, cleanSum: true, cleanMix: 0.2 },
      controls: [k('gain', 'DRIVE'), k('tone', 'TONE'), k('level', 'LEVEL')],
    }),
    TC({
      id: 'tc.pipedreamer', name: 'PipeRunner Overdrive', ref: 'TC Electronic PipeDreamer Overdrive', code: 'PIPE', logo: 'piperunner', tagline: 'overdrive', cat: 'Overdrive', tcSize: 'budget',
      color: '#2f8a3c', text: '#effbe9', art: 'pipe', artOpacity: 0.25,
      algo: 'drive', opts: { clip: 'ts', cleanSum: true, clipHp: 720, gainMinDb: 4, gainMaxDb: 40, tone: 'ts', toneLo: 723, postLp: 6000, levelMaxDb: 6 },
      controls: [k('gain', 'DRIVE'), k('tone', 'TONE'), k('level', 'LEVEL')],
    }),
    TC({
      id: 'tc.zeus', name: 'Jupiter Drive', ref: 'TC Electronic Zeus Drive', code: 'JUP', logo: 'jupiter', tagline: 'overdrive', cat: 'Overdrive', tcSize: 'budget',
      color: '#c9a74c', text: '#231a06', art: 'laurel', artOpacity: 0.3,
      algo: 'drive', opts: { clip: 'ge', bias: 0.1, cleanSum: true, cleanMix: 0.5, clipHp: 400, gainMinDb: 0, gainMaxDb: 36, tone: 'lp', toneLo: 1500, toneHi: 9000, postLp: 9000, levelMaxDb: 12 },
      controls: [k('gain', 'GAIN', { def: 0.4 }), k('tone', 'TREBLE'), k('level', 'OUTPUT')],
      desc: 'Transparent boost / overdrive with clean blend that rises as the gain goes down.',
    }),
    TC({
      id: 'tc.tubepilot', name: 'Tube Captain Overdrive', ref: 'TC Electronic Tube Pilot Overdrive', code: 'CAPT', logo: 'tube captain', typeName: 'Tube overdrive', cat: 'Overdrive',
      color: '#35363a', text: '#f3c27a', art: 'tube', artColor: '#ff9a3a', artOpacity: 0.35,
      algo: 'drive', opts: { clip: 'tube', bias: 0.2, preHp: 60, gainMinDb: 4, gainMaxDb: 38, tone: 'eq3', eqRangeDb: 12, bassF: 120, midF: 800, trebleF: 2800, postLp: 9000, levelMaxDb: 4.5 },
      fixed: { mid: 0.5 },
      controls: [k('gain', 'DRIVE'), k('level', 'LEVEL'), k('bass', 'BASS', { small: true }), k('treble', 'TREBLE', { small: true })],
      desc: 'Real-tube style overdrive (12AX7 character) with active bass and treble.',
    }),

    // ---------------------------------------------------------------- modulation
    TC({
      id: 'tc.corona', name: 'Coronet Chorus', ref: 'TC Electronic Corona Chorus', code: 'CRN', logo: 'coronet', typeName: 'Chorus', cat: 'Modulation',
      color: '#3ea4c8', text: '#0d1d24', art: 'rays', artColor: '#ffffff', artOpacity: 0.3, stereo: 'both',
      algo: 'chorus', cost: 0.5,
      controls: [k('rate', 'SPEED', { def: 0.35 }), k('depth', 'DEPTH', { def: 0.5 }), k('mix', 'FX LEVEL', { def: 0.5 }),
        TOG('cmode', '', ['CHORUS', 'TP', 'TRI']), k('tone', 'TONE', { small: true })],
      derive: (p) => ({ mode: [0, 3, 2][p.cmode ?? 0] }),
      desc: 'Classic chorus, TP (dimension voice) or lush tri-chorus.',
    }),
    TC({
      id: 'tc.vortex', name: 'Vertex Flanger', ref: 'TC Electronic Vortex Flanger', code: 'VTX', logo: 'vertex', typeName: 'Flanger', cat: 'Modulation',
      color: '#6b47a3', text: '#f0e8ff', art: 'spiral', artOpacity: 0.3, stereo: 'both',
      algo: 'flanger', cost: 0.5,
      controls: [k('speed', 'SPEED', { def: 0.3 }), k('width', 'DEPTH', { def: 0.6 }), k('regen', 'FEEDBACK', { def: 0.55 }),
        TOG('mode', '', ['FLANGER', 'TP', 'TZ'], { values: [0, 1, 3] }), k('manual', 'DELAY', { small: true })],
      desc: 'Flanger, TP (ultra) and through-zero modes.',
    }),
    TC({
      id: 'tc.thunderstorm', name: 'Thunderhead Flanger', ref: 'TC Electronic Thunderstorm Flanger', code: 'THD', logo: 'thunderhead', tagline: 'flanger', cat: 'Modulation', tcSize: 'budget',
      color: '#2e3b55', text: '#dfe8ff', art: 'storm', artOpacity: 0.3, stereo: 'both',
      algo: 'flanger',
      controls: [k('speed', 'SPEED', { def: 0.3 }), k('width', 'DEPTH', { def: 0.6 }), k('regen', 'FEEDBACK', { def: 0.55 }), TOG('mode', '', ['FLANGE', 'TZ'], { values: [0, 3] })],
    }),
    TC({
      id: 'tc.shaker', name: 'Shiver Vibrato', ref: 'TC Electronic Shaker Vibrato', code: 'SHV', logo: 'shiver', typeName: 'Vibrato', cat: 'Modulation',
      color: '#e05a2a', text: '#1d0c05', art: 'wave', artOpacity: 0.28, stereo: 'both',
      algo: 'chorus', opts: { baseMs: 4, depthMs: 3 }, fixed: { mode: 1 },
      controls: [k('rate', 'SPEED', { def: 0.45 }), k('depth', 'DEPTH', { def: 0.5 }), k('tone', 'TONE', { def: 0.6 }),
        TOG('latch', '', ['LATCH', 'TP', 'MOM']), k('delay', 'RISE', { small: true, def: 0.3 })],
      derive: (p) => (p.latch === 1 ? { wave: 1 } : { wave: 0 }),
      momentaryWhen: (p) => p.latch === 2,
      desc: 'Pitch vibrato. MOM makes the switch momentary (with RISE time), TP uses a triangle LFO.',
    }),
    TC({
      id: 'tc.helix', name: 'Helical Phaser', ref: 'TC Electronic Helix Phaser', code: 'HLC', logo: 'helical', typeName: 'Phaser', cat: 'Modulation',
      color: '#1f8a9e', text: '#e6fbff', art: 'helix', artOpacity: 0.3, stereo: 'both',
      algo: 'phaser',
      controls: [k('rate', 'SPEED', { def: 0.35 }), k('depth', 'DEPTH', { def: 0.8 }), k('feedback', 'FEEDBACK', { def: 0.4 }),
        TOG('stages', '', ['VINTAGE', 'TP', 'SMOOTH'], { values: [4, 8, 12] }), k('mix', 'MIX', { small: true, def: 0.5 })],
    }),
    TC({
      id: 'tc.viscousvibe', name: 'Viscose Vibe', ref: 'TC Electronic Viscous Vibe', code: 'VSV', logo: 'viscose vibe', typeName: 'Vibe', tagline: 'vintage vibe', cat: 'Modulation',
      color: '#a8336f', text: '#ffe9f4', art: 'drop', artOpacity: 0.3, stereo: 'both',
      algo: 'vibe',
      controls: [k('speed', 'SPEED', { def: 0.4 }), k('intensity', 'INTENSITY', { def: 0.7 }), k('level', 'VOLUME', { def: 0.5 }), TOG('mode', '', ['CHORUS', 'VIBRATO'])],
    }),
    TC({
      id: 'tc.choka', name: 'Chokka Tremolo', ref: 'TC Electronic Choka Tremolo', code: 'CHK', logo: 'chokka', tagline: 'tremolo', cat: 'Modulation', tcSize: 'budget',
      color: '#2e8b57', text: '#ecfff3', art: 'bars', artOpacity: 0.2, stereo: 'both',
      algo: 'tremolo',
      controls: [k('rate', 'SPEED', { def: 0.45 }), k('depth', 'DEPTH', { def: 0.6 }), TOG('wave', '', ['SINE', 'SQUARE'], { values: [0.2, 0.95] })],
    }),
    TC({
      id: 'tc.june60', name: 'July-60 Chorus', ref: 'TC Electronic June-60 Chorus', code: 'J-60', logo: 'july-60', tagline: 'chorus', cat: 'Modulation', tcSize: 'budget',
      color: '#1d1d1f', text: '#ececec', art: 'stripes', artOpacity: 0.16, stereo: 'both',
      algo: 'chorus', opts: { style: 'bbd' }, fixed: { mode: 0, mix: 0.5, tone: 0.55 },
      controls: [BTN('I', { p: 'b1', toggle: true, led: true, ledColor: '#ff3a2a', ledDy: -9, r: 6, labelPos: 'below' }), BTN('II', { p: 'b2', toggle: true, led: true, ledColor: '#ff3a2a', ledDy: -9, r: 6, labelPos: 'below' })],
      initParams: { b1: 1, b2: 0 },
      derive: (p) => {
        const m = p.b1 && p.b2 ? 3 : p.b2 ? 2 : 1;
        return { rate: [0.3, 0.3, 0.42, 0.82][m], depth: [0.5, 0.5, 0.6, 0.22][m] };
      },
      desc: 'Synth-style BBD chorus: buttons I, II or both pressed for the fast, shallow I+II setting.',
    }),
    TC({
      id: 'tc.afterglow', name: 'Afterlight Chorus', ref: 'TC Electronic Afterglow Chorus', code: 'AFL', logo: 'afterlight', tagline: 'chorus', cat: 'Modulation', tcSize: 'budget',
      color: '#ec8a2d', text: '#2a1404', art: 'sun', artColor: '#7a2a00', artOpacity: 0.28, stereo: 'both',
      algo: 'chorus', opts: { style: 'bbd' },
      controls: [k('rate', 'SPEED', { def: 0.35 }), k('depth', 'DEPTH', { def: 0.5 }), k('tone', 'TONE', { def: 0.55 }), TOG('mode', '', ['CHORUS', 'VIBRATO'], { values: [0, 1] })],
      derive: (p) => ({ mix: p.mode ? 1 : 0.5 }),
    }),
    TC({
      id: 'tc.mimiq', name: 'Mimik Doubler', ref: 'TC Electronic Mimiq Doubler', code: 'MMK', logo: 'mimik', typeName: 'Doubler', cat: 'Modulation',
      color: '#f0f0ee', text: '#151515', art: 'twin', artOpacity: 0.25, stereo: 'both',
      algo: 'deco', fixed: { satOn: 0, dtOn: 1, saturation: 0, tone: 0.55 }, cost: 0.6,
      controls: [k('volume', 'DRY', { def: 0.5 }), k('blend', 'EFFECT', { def: 0.5 }), k('tight', 'TIGHTNESS', { def: 0.6, virtual: true }), TOG('type', '', ['1', '2', '3'], { values: [0, 1, 2] })],
      derive: (p) => ({ wobble: 0.55 * (1 - (p.tight ?? 0.6)), lag: 0.12 + 0.3 * (1 - (p.tight ?? 0.6)) }),
      desc: 'Double-tracking: up to three virtual takes. TIGHTNESS sets how closely they follow you.',
    }),

    // ---------------------------------------------------------------- dynamics
    TC({
      id: 'tc.hypergravity', name: 'HyperMass Compressor', ref: 'TC Electronic HyperGravity Compressor', code: 'HPM', logo: 'hypermass', typeName: 'Compressor', cat: 'Dynamics',
      color: '#2c3e66', text: '#e3ecff', art: 'gravity', artOpacity: 0.28, stereo: 'both',
      algo: 'comp', opts: { type: 'vca' },
      controls: [k('sustain', 'SUSTAIN', { def: 0.5 }), k('attack', 'ATTACK', { def: 0.3 }), k('level', 'LEVEL', { def: 0.36 }),
        TOG('hg', '', ['SPECTRAL', 'TP', 'VINTAGE']), k('blend', 'BLEND', { small: true, def: 1 })],
      derive: (p) => [{ ratio: 0.55, knee: 0.7, release: 0.35 }, { ratio: 0.45, knee: 0.6, release: 0.5 }, { ratio: 0.75, knee: 0.3, release: 0.45 }][p.hg ?? 0],
      desc: 'Multi-band flavoured studio compressor with parallel BLEND.',
    }),
    TC({
      id: 'tc.spectracomp', name: 'SpectroComp Bass', ref: 'TC Electronic SpectraComp Bass Compressor', code: 'SPC', logo: 'spectro comp', tagline: 'bass compressor', cat: 'Dynamics', tcSize: 'mini',
      color: '#151618', text: '#7ec8ff', art: 'spectrum', artOpacity: 0.3,
      algo: 'comp', opts: { type: 'vca' }, fixed: { attack: 0.3, release: 0.4, level: 0.36, tone: 0.5 },
      controls: [k('sustain', 'COMPRESS', { def: 0.5 }), TP()],
      derive: (p) => (p.tp ? { ratio: 0.8, knee: 0.3 } : { ratio: 0.5, knee: 0.7 }),
      tags: ['bass'],
    }),
    TC({
      id: 'tc.sentry', name: 'Sentinel Gate', ref: 'TC Electronic Sentry Noise Gate', code: 'SNT', logo: 'sentinel', typeName: 'Noise gate', cat: 'Dynamics',
      color: '#202326', text: '#e8eaee', art: 'shield', artOpacity: 0.25,
      algo: 'gate', ports: { ins: ['INPUT', 'RETURN'], outs: ['OUTPUT', 'SEND'] },
      controls: [k('threshold', 'THRESHOLD', { def: 0.4 }), k('decay', 'RELEASE', { def: 0.4 }), k('range', 'DEPTH', { def: 1 }), TOG('gm', '', ['HARD', 'TP', 'SOFT'])],
      derive: (p) => [{ attack: 0.02, mode: 1 }, { attack: 0.1, mode: 0 }, { attack: 0.3, mode: 0 }][p.gm ?? 0],
      desc: 'Noise gate with send / return loop: detection stays on INPUT.',
    }),
    TC({
      id: 'tc.ironcurtain', name: 'Iron Shutter Gate', ref: 'TC Electronic Iron Curtain Noise Gate', code: 'ISH', logo: 'iron shutter', tagline: 'noise gate', cat: 'Dynamics', tcSize: 'budget',
      color: '#6b6f74', text: '#111214', art: 'bars', artOpacity: 0.22,
      algo: 'gate', fixed: { range: 1 },
      controls: [k('threshold', 'THRESHOLD', { def: 0.4 }), TOG('decay', '', ['FAST', 'SLOW'], { values: [0.18, 0.6] })],
    }),

    // ---------------------------------------------------------------- pitch / sustain
    TC({
      id: 'tc.subnup', name: "Down'n'Up Octaver", ref: "TC Electronic Sub'n'Up Octaver", code: 'DNU', logo: "down'n'up", typeName: 'Octaver', cat: 'Pitch',
      color: '#3c7d4a', text: '#eefbe9', art: 'oct', artOpacity: 0.28,
      algo: 'pitch', fixed: { quality: 1 }, cost: 0.8,
      controls: [k('level1', 'SUB OCT', { def: 0.6 }), k('dry', 'DRY', { def: 0.8 }), k('level2', 'UP OCT', { def: 0 }),
        TOG('poly', '', ['POLY', 'TP', 'CLASSIC']), k('tone', 'TONE', { small: true, def: 0.7 })],
      derive: (p) => [{ semis1: -12, semis2: 12, vintage: 0 }, { semis1: -24, semis2: 12, vintage: 0 }, { semis1: -12, semis2: 12, vintage: 1 }][p.poly ?? 0],
      desc: 'Polyphonic octaves (or the classic mono analog-style tracking). TP drops the sub to two octaves.',
    }),
    TC({
      id: 'tc.brainwaves', name: 'Brainstorm Pitch Shifter', ref: 'TC Electronic Brainwaves Pitch Shifter', code: 'BRN', logo: 'brainstorm', tagline: 'pitch shifter', cat: 'Pitch', tcSize: 'budget',
      color: '#d4428a', text: '#2a0618', art: 'brain', artOpacity: 0.3,
      algo: 'pitch', fixed: { quality: 1, level2: 0 }, cost: 0.8,
      controls: [SEL('semis1', 'SHIFT', ['-24', '-12', '-7', '-5', '-3', '+3', '+5', '+7', '+12', '+24'], { values: [-24, -12, -7, -5, -3, 3, 5, 7, 12, 24], def: 8, sweep: 270, optSize: 3.8, labelRadius: 7.5 }),
        k('cents', 'DETUNE', { min: -50, max: 50, def: 0, display: (v) => Math.round(v) + ' ct' }), k('mix', 'MIX', { def: 0.5, virtual: true })],
      derive: (p) => { const m = p.mix ?? 0.5; return { dry: 0.8 * Math.min(1, 2 * (1 - m)), level1: 0.8 * Math.min(1, 2 * m) }; },
    }),
    TC({
      id: 'tc.quintessence', name: 'Quintet Harmony', ref: 'TC Electronic Quintessence Harmony', code: 'QNT', logo: 'quintet', typeName: 'Harmony', cat: 'Pitch',
      color: '#3b4fa0', text: '#eef1ff', art: 'chord', artOpacity: 0.28,
      algo: 'pitch', fixed: { quality: 2 }, cost: 1,
      controls: [SEL('key', 'KEY', NOTES, { def: 9, sweep: 300, optSize: 3.6, labelRadius: 7, r: 10 }), k('mix', 'MIX', { def: 0.5, virtual: true }),
        SEL('harm', 'HARMONY', ['-8', '-3', '+3', '+5', '+8', '3+5'], { def: 2, sweep: 200, optSize: 4, labelRadius: 7.5, r: 10 }),
        TOG('scale', '', ['MAJ', 'MIN', 'PENT'], { values: [1, 2, 6] })],
      derive: (p) => {
        const m = p.mix ?? 0.5;
        const H = [[-7, 0, 0], [-2, 0, 0], [2, 0, 0], [4, 0, 0], [7, 0, 0], [2, 4, 1]][p.harm ?? 2];
        return { dry: 0.8 * Math.min(1, 2 * (1 - m)), level1: 0.8 * Math.min(1, 2 * m) * (H[2] ? 0.7 : 1), deg1: H[0], deg2: H[1], level2: H[2] * Math.min(1, 2 * m) * 0.56 };
      },
      desc: 'Intelligent diatonic harmony: set KEY and SCALE, choose the interval(s).',
    }),
    TC({
      id: 'tc.infinite', name: 'Endless Sustainer', ref: 'TC Electronic Infinite Sample Sustainer', code: 'END', logo: 'endless', tagline: 'sample sustainer', cat: 'Synth', tcSize: 'budget',
      color: '#e9e9ec', text: '#1b1c22', art: 'infinity', artOpacity: 0.3, noStd: true, stereo: 'both',
      algo: 'freeze', cost: 0.7,
      controls: [k('mix', 'LEVEL', { def: 0.7 }), k('speed', 'ATTACK', { def: 0.3 }), k('decay', 'SUSTAIN', { def: 1 }), TOG('mode', '', ['LATCH', 'MOM', 'AUTO'], { values: [0, 1, 2] }),
        FOOT({ action: 'event', event: { type: 1, arg: 0 }, hold: { ms: 350, event: { type: 1, arg: 0 }, release: { type: 2, arg: 0 } } }), LED({ color: '#7ec8ff' })],
      desc: 'Tap the switch to freeze / release; hold it for a momentary freeze. AUTO re-samples every new note.',
    }),

    // ---------------------------------------------------------------- acoustic
    TC({
      id: 'tc.bodyrez', name: 'TimberRez Acoustic', ref: 'TC Electronic BodyRez Acoustic Pickup Enhancer', code: 'TRZ', logo: 'timberrez', tagline: 'acoustic pickup enhancer', cat: 'Acoustic', tcSize: 'budget',
      color: '#b8874a', text: '#24160a', art: 'body', artOpacity: 0.3,
      algo: 'acoustic', opts: { mode: 1, type: 0 }, fixed: { mode: 1, antifb: 0.5 },
      controls: [k('body', 'BODYREZ', { def: 0.6 }), TOG('comp', 'COMP', ['OFF', 'ON'], { values: [0, 0.45] })],
      desc: 'Restores the body and air a piezo pickup loses, with a built-in anti-feedback notch and optional compression.',
    }),

    // ---------------------------------------------------------------- multi
    def({
      id: 'tc.plethora', name: 'Plenty X5', ref: 'TC Electronic Plethora X5', brand: 'TC Electronic', code: 'PLX5', logo: 'plenty x5', typeName: 'five-slot pedalboard', cat: 'Multi-FX', kind: 'Multi-FX',
      form: 'tc-x5', color: '#17181b', text: '#ececec', algo: 'chain', stereo: 'both', alwaysOn: true, cost: 3.2,
      slots: [{ name: 'HYPERMASS', sub: 'compressor', color: '#ffd36b' }, { name: 'CORONET', sub: 'chorus', color: '#6fd6ff' }, { name: 'VERTEX', sub: 'flanger', color: '#c9a2ff' },
        { name: 'THROWBACK', sub: 'delay 2290', color: '#9cff8f' }, { name: 'HALL', sub: 'reverb', color: '#ff9f7a' }],
      opts: { chain: [
        { prefix: 'c', algo: 'comp', opts: { type: 'vca' }, params: { ratio: 0.5, attack: 0.3, level: 0.36 } },
        { prefix: 'm', algo: 'chorus', on: false },
        { prefix: 'f', algo: 'flanger', on: false },
        { prefix: 'd', algo: 'delay', opts: { maxMs: 2000 }, params: { time: 420, feedback: 0.32, tone: 0.75 } },
        { prefix: 'r', algo: 'reverb', params: { mode: 1, decay: 0.5 } },
      ] },
      controls: [
        k('c.sustain', 'SUSTAIN', { slot: 0, def: 0.45 }), k('m.mix', 'FX LEVEL', { slot: 1, def: 0.5 }), k('f.mix', 'FX LEVEL', { slot: 2, def: 0.5 }), k('d.mix', 'FX LEVEL', { slot: 3, def: 0.3 }), k('r.mix', 'LEVEL', { slot: 4, def: 0.3 }),
        ...['c', 'm', 'f', 'd', 'r'].flatMap((x, i) => [FOOT({ action: 'toggle', p: x + '.on', slot: i, def: [1, 0, 0, 1, 1][i] }), LED({ bind: 'param:' + x + '.on', slot: i, color: '#ff2a1a' })]),
      ],
      desc: 'Five effect slots on one board: compressor, chorus, flanger, delay and hall reverb. Each footswitch turns its slot on or off.',
    }),

    // ---------------------------------------------------------------- utilities
    TC({
      id: 'tc.polytune3mini', name: 'PolyTone 3 Mini', ref: 'TC Electronic PolyTune 3 Mini', code: 'PT3 M', logo: 'polytone 3', tagline: 'mini tuner', cat: 'Utility', kind: 'Utility', tcSize: 'mini',
      color: '#1d1e21', text: '#ececec', noStd: true,
      algo: 'tuner', opts: { mute: 1 },
      controls: [SCREEN('polytune'), FOOT()],
      defaultBypass: true, tunerBlock: true, polyDefault: true,
      desc: 'Polyphonic / chromatic tuner in a mini enclosure. Strum all strings for the polyphonic view.',
    }),
    def({
      id: 'tc.polytune3noir', name: 'PolyTone 3 Nero', ref: 'TC Electronic PolyTune 3 Noir', brand: 'TC Electronic', code: 'PT3 N', logo: 'PolyTone 3 Nero', cat: 'Utility', kind: 'Utility', form: 'polytune', color: '#0b0b0c', text: '#f7f7f7',
      algo: 'tuner', opts: { mute: 1 },
      controls: [SCREEN('polytune', { x: 72, y: 76, w: 108, h: 80 }), BTN('TUNING', { x: 30, y: 18, r: 4, shape: 'rect', w: 18, h: 7, cycle: 'tuning', labelPos: 'below', color: '#111' }), BTN('DISPLAY', { x: 114, y: 18, r: 4, shape: 'rect', w: 18, h: 7, cycle: 'tunerDisplay', labelPos: 'below', color: '#111' }),
        FOOT({ style: 'stomp', x: 72, y: 196, r: 13 })],
      defaultBypass: true, tunerBlock: true, polyDefault: true,
      desc: 'All-black polyphonic tuner. DISPLAY toggles needle / strobe.',
    }),
    def({
      id: 'tc.bonafide', name: 'Genuine Buffer', ref: 'TC Electronic Bonafide Buffer', brand: 'TC Electronic', code: 'BUF', logo: 'GENUINE', sub: 'BUFFER', cat: 'Utility', kind: 'Utility', form: 'box', boxW: 92,
      color: '#c9ccd0', text: '#17191c', algo: 'utility', opts: { kind: 'gain' }, alwaysOn: true, cost: 0.02,
      controls: [TOG('level', 'OUTPUT', ['0 dB', '+3 dB'], { values: [0, 3], x: 46, y: 70, orient: 'h' })],
      desc: 'Always-on buffer: restores the high end long cable runs eat. Optional +3 dB output trim.',
    }),
  ]);
  registerMore(tz, { TC, TP, k, NOTES });
}
