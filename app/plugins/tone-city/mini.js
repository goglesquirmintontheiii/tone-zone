// Mini pedal enclosure (about 47 x 93 mm) shared by the budget mini brands. Each brand plugin keeps its own
// copy and registers it under its own form name with a brand style (`st`). Per block: colour, text, accent,
// knob style, logo, typeName and `art` ({ kind, c1, c2 }) for the printed picture between the knobs and the switch.
// Controls without coordinates are laid out on a small grid (knobs first, then toggles).

const CELLS = {
  1: [[0.5, 36]],
  2: [[0.28, 34], [0.72, 34]],
  3: [[0.26, 31], [0.74, 31], [0.5, 60]],
  4: [[0.28, 30], [0.72, 30], [0.28, 67], [0.72, 67]],
  5: [[0.2, 30], [0.5, 30], [0.8, 30], [0.3, 66], [0.7, 66]],
  6: [[0.2, 30], [0.5, 30], [0.8, 30], [0.2, 66], [0.5, 66], [0.8, 66]],
};

export function installMini(tz, formName, st = {}) {
  const { svg, label, formKit, shade, luminance, textColorFor } = tz.gfx;
  let seq = 0;

  // small printed pictures, drawn inside the art box (x, y, w, h)
  function art(g, a, x, y, w, h, ink) {
    const c1 = a.c1 || ink, c2 = a.c2 || shade(c1, -0.3);
    const cx = x + w / 2, cy = y + h / 2, s = Math.min(w, h);
    const P = (d, o = {}) => svg('path', Object.assign({ d, fill: 'none', stroke: c1, 'stroke-width': 1.2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, o), g);
    switch (a.kind) {
      case 'clouds':
        for (const [dx, dy, k] of [[-0.26, 0.05, 1], [0.2, -0.12, 0.8], [0.12, 0.26, 0.6]]) {
          const bx = cx + dx * w, by = cy + dy * h, r = s * 0.13 * k;
          svg('path', { d: `M${bx - r * 2.2} ${by + r} a${r} ${r} 0 0 1 ${r * 0.6} ${-r * 1.7} a${r * 1.2} ${r * 1.2} 0 0 1 ${r * 2.2} ${-r * 0.3} a${r} ${r} 0 0 1 ${r * 1.6} ${r * 2} Z`, fill: c1, 'fill-opacity': 0.9 }, g);
        }
        break;
      case 'burst': {
        for (let i = 0; i < 16; i++) {
          const t = (i / 16) * Math.PI * 2, t2 = t + Math.PI / 16;
          const R = s * 0.8;
          svg('path', { d: `M${cx} ${cy} L${cx + Math.cos(t) * R} ${cy + Math.sin(t) * R} L${cx + Math.cos(t2) * R} ${cy + Math.sin(t2) * R} Z`, fill: i % 2 ? c2 : c1, 'fill-opacity': 0.55 }, g);
        }
        svg('circle', { cx, cy, r: s * 0.2, fill: c1 }, g);
        break;
      }
      case 'waves':
        for (let i = 0; i < 4; i++) {
          const yy = y + h * (0.25 + i * 0.17);
          let d = `M${x + 4} ${yy}`;
          for (let k = 0; k < 4; k++) d += ` q${(w - 8) / 8} ${-5 + i} ${(w - 8) / 4} 0`;
          P(d, { stroke: i % 2 ? c2 : c1, 'stroke-width': 1.6 });
        }
        break;
      case 'cactus': {
        const b = y + h - 4;
        P(`M${x + 6} ${b} H${x + w - 6}`, { 'stroke-width': 1 });
        svg('path', { d: `M${cx - 4} ${b} V${y + 10} a4 4 0 0 1 8 0 V${b} Z M${cx - 4} ${cy + 4} h-6 a3 3 0 0 1 -3 -3 v-9 a2.5 2.5 0 0 1 5 0 v7 h4 Z M${cx + 4} ${cy} h6 a3 3 0 0 0 3 -3 v-7 a2.5 2.5 0 0 0 -5 0 v5 h-4 Z`, fill: c1 }, g);
        svg('circle', { cx: cx + w * 0.3, cy: y + 9, r: 4, fill: c2 }, g);
        break;
      }
      case 'lime': {
        const r = s * 0.42;
        svg('circle', { cx, cy, r, fill: c2 }, g);
        svg('circle', { cx, cy, r: r * 0.86, fill: '#f4f7d8' }, g);
        svg('circle', { cx, cy, r: r * 0.78, fill: c1 }, g);
        for (let i = 0; i < 8; i++) {
          const t = (i / 8) * Math.PI * 2;
          svg('line', { x1: cx, y1: cy, x2: cx + Math.cos(t) * r * 0.78, y2: cy + Math.sin(t) * r * 0.78, stroke: '#f4f7d8', 'stroke-width': 1.1 }, g);
        }
        break;
      }
      case 'swirl': {
        let d = `M${cx} ${cy}`;
        for (let i = 1; i <= 40; i++) {
          const t = i * 0.42, r = i * s * 0.011;
          d += ` L${(cx + Math.cos(t) * r).toFixed(1)} ${(cy + Math.sin(t) * r).toFixed(1)}`;
        }
        P(d, { 'stroke-width': 2, stroke: c1 });
        break;
      }
      case 'horseshoe': {
        const r = s * 0.34;
        svg('path', { d: `M${cx - r} ${cy + r} V${cy} a${r} ${r} 0 0 1 ${r * 2} 0 V${cy + r} h${-r * 0.42} V${cy} a${r * 0.58} ${r * 0.58} 0 0 0 ${-r * 1.16} 0 V${cy + r} Z`, fill: c1 }, g);
        for (const t of [0.15, 0.4, 0.6, 0.85]) {
          const ang = Math.PI + t * Math.PI;
          svg('circle', { cx: cx + Math.cos(ang) * r * 0.79, cy: cy + Math.sin(ang) * r * 0.79, r: 0.9, fill: c2 }, g);
        }
        break;
      }
      case 'spring': {
        let d = `M${x + 6} ${cy}`;
        const n = 9, step = (w - 12) / n;
        for (let i = 0; i < n; i++) d += ` c${step * 0.2} ${-h * 0.32} ${step * 0.9} ${-h * 0.32} ${step * 0.6} 0 s${-step * 0.3} ${h * 0.32} ${step * 0.4} 0`;
        P(d, { 'stroke-width': 1.3 });
        break;
      }
      case 'wing':
        for (let i = 0; i < 5; i++) {
          const L = s * (0.85 - i * 0.12), yy = cy - h * 0.28 + i * h * 0.13;
          svg('path', { d: `M${cx - w * 0.32} ${yy} q${L * 0.5} ${-6} ${L} ${3} q${-L * 0.5} ${4} ${-L} ${-3} Z`, fill: i % 2 ? c2 : c1, 'fill-opacity': 0.95 }, g);
        }
        break;
      case 'crown':
        svg('path', { d: `M${cx - s * 0.4} ${cy + s * 0.22} L${cx - s * 0.44} ${cy - s * 0.2} L${cx - s * 0.18} ${cy} L${cx} ${cy - s * 0.3} L${cx + s * 0.18} ${cy} L${cx + s * 0.44} ${cy - s * 0.2} L${cx + s * 0.4} ${cy + s * 0.22} Z`, fill: c1, stroke: c2, 'stroke-width': 0.8 }, g);
        for (const dx of [-0.2, 0, 0.2]) svg('circle', { cx: cx + dx * s, cy: cy + s * 0.12, r: 1.6, fill: c2 }, g);
        break;
      case 'flame':
        svg('path', { d: `M${cx} ${y + 4} C${cx + s * 0.32} ${cy - 4} ${cx + s * 0.34} ${cy + 6} ${cx + s * 0.2} ${y + h - 4} Q${cx} ${y + h} ${cx - s * 0.2} ${y + h - 4} C${cx - s * 0.36} ${cy + 4} ${cx - s * 0.18} ${cy - 2} ${cx - s * 0.06} ${cy - 8} C${cx - s * 0.04} ${cy - 2} ${cx + s * 0.06} ${cy} ${cx} ${y + 4} Z`, fill: c1 }, g);
        svg('path', { d: `M${cx} ${cy - 2} C${cx + s * 0.16} ${cy + 6} ${cx + s * 0.14} ${y + h - 8} ${cx} ${y + h - 5} C${cx - s * 0.14} ${y + h - 8} ${cx - s * 0.12} ${cy + 6} ${cx} ${cy - 2} Z`, fill: c2 }, g);
        break;
      case 'bolt':
        svg('path', { d: `M${cx + s * 0.08} ${y + 3} L${cx - s * 0.22} ${cy + 3} H${cx - s * 0.02} L${cx - s * 0.1} ${y + h - 3} L${cx + s * 0.24} ${cy - 4} H${cx + s * 0.04} Z`, fill: c1, stroke: c2, 'stroke-width': 0.8 }, g);
        break;
      case 'mountains':
        svg('path', { d: `M${x} ${y + h} L${x + w * 0.3} ${y + h * 0.3} L${x + w * 0.48} ${y + h * 0.62} L${x + w * 0.66} ${y + h * 0.18} L${x + w} ${y + h} Z`, fill: c1 }, g);
        svg('path', { d: `M${x + w * 0.66} ${y + h * 0.18} L${x + w * 0.58} ${y + h * 0.36} L${x + w * 0.66} ${y + h * 0.32} L${x + w * 0.74} ${y + h * 0.38} Z`, fill: '#fff', 'fill-opacity': 0.85 }, g);
        svg('circle', { cx: x + w * 0.2, cy: y + h * 0.28, r: 4, fill: c2 }, g);
        break;
      case 'moon':
        svg('path', { d: `M${cx + 2} ${cy - s * 0.36} a${s * 0.36} ${s * 0.36} 0 1 0 ${s * 0.3} ${s * 0.56} a${s * 0.3} ${s * 0.3} 0 1 1 ${-s * 0.3} ${-s * 0.56} Z`, fill: c1 }, g);
        for (const [dx, dy] of [[0.28, -0.25], [0.36, 0.12], [-0.34, -0.2]]) svg('circle', { cx: cx + dx * w, cy: cy + dy * h, r: 1.1, fill: c2 }, g);
        break;
      case 'drop':
        svg('path', { d: `M${cx} ${y + 3} C${cx + s * 0.1} ${cy - 6} ${cx + s * 0.3} ${cy} ${cx + s * 0.3} ${cy + s * 0.12} a${s * 0.3} ${s * 0.3} 0 0 1 ${-s * 0.6} 0 C${cx - s * 0.3} ${cy} ${cx - s * 0.1} ${cy - 6} ${cx} ${y + 3} Z`, fill: c1 }, g);
        svg('ellipse', { cx: cx - s * 0.12, cy: cy + s * 0.08, rx: 2, ry: 4, fill: '#fff', 'fill-opacity': 0.45 }, g);
        break;
      case 'mouse':
        svg('ellipse', { cx, cy: cy + 3, rx: s * 0.3, ry: s * 0.2, fill: c1 }, g);
        svg('circle', { cx: cx + s * 0.22, cy: cy - s * 0.1, r: s * 0.11, fill: c1 }, g);
        svg('circle', { cx: cx + s * 0.32, cy: cy - 1, r: 1, fill: c2 }, g);
        P(`M${cx - s * 0.3} ${cy + 4} q${-s * 0.2} ${s * 0.1} ${-s * 0.1} ${s * 0.3}`, { stroke: c1, 'stroke-width': 1.3 });
        break;
      case 'fur':
        for (let i = 0; i < 26; i++) {
          const xx = x + 4 + ((w - 8) * i) / 25, yy = y + h - 4;
          P(`M${xx} ${yy} q${(i % 3) - 1} ${-h * 0.4} ${(i % 2 ? 3 : -3)} ${-h * (0.55 + (i % 4) * 0.08)}`, { stroke: i % 2 ? c1 : c2, 'stroke-width': 1.1 });
        }
        break;
      case 'stripes':
        for (let i = -6; i < 12; i++) svg('path', { d: `M${x + i * 9} ${y + h} l${h} ${-h} h4 l${-h} ${h} Z`, fill: i % 2 ? c1 : c2, 'fill-opacity': 0.7 }, g);
        break;
      case 'dots':
        for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) svg('circle', { cx: x + 8 + c * ((w - 16) / 5), cy: y + 6 + r * ((h - 12) / 3), r: 1.6 + ((r + c) % 3) * 0.5, fill: (r + c) % 2 ? c1 : c2 }, g);
        break;
      case 'rings':
        for (let i = 4; i > 0; i--) svg('circle', { cx, cy, r: s * 0.1 * i, fill: 'none', stroke: i % 2 ? c1 : c2, 'stroke-width': 2 }, g);
        break;
      case 'scope': {
        let d = `M${x + 4} ${cy}`;
        for (let xx = x + 4; xx <= x + w - 4; xx += 2) d += ` L${xx} ${(cy + Math.sin((xx - x) * 0.32) * h * 0.3 * Math.sin(((xx - x) / w) * Math.PI)).toFixed(1)}`;
        P(d, { 'stroke-width': 1.4 });
        break;
      }
      case 'leaf':
        svg('path', { d: `M${cx - s * 0.36} ${cy + s * 0.3} C${cx - s * 0.4} ${cy - s * 0.3} ${cx + s * 0.2} ${cy - s * 0.4} ${cx + s * 0.4} ${cy - s * 0.34} C${cx + s * 0.36} ${cy + s * 0.2} ${cx - s * 0.1} ${cy + s * 0.4} ${cx - s * 0.36} ${cy + s * 0.3} Z`, fill: c1 }, g);
        P(`M${cx - s * 0.36} ${cy + s * 0.3} Q${cx} ${cy} ${cx + s * 0.4} ${cy - s * 0.34}`, { stroke: c2, 'stroke-width': 1 });
        break;
      case 'gear': {
        let d = '';
        for (let i = 0; i < 20; i++) {
          const t = (i / 20) * Math.PI * 2, R = i % 2 ? s * 0.32 : s * 0.4;
          d += `${i ? 'L' : 'M'}${(cx + Math.cos(t) * R).toFixed(1)} ${(cy + Math.sin(t) * R).toFixed(1)} `;
        }
        svg('path', { d: d + 'Z', fill: c1 }, g);
        svg('circle', { cx, cy, r: s * 0.14, fill: c2 }, g);
        break;
      }
      default:
        break;
    }
  }

  tz.addForm(formName, (ctx, d) => {
    const g = ctx.g;
    const w = st.w || 94, h = st.h || 190, rx = st.rx ?? 6;
    const col = d.color, txt = d.text || textColorFor(col), acc = d.accent || shade(col, luminance(col) > 0.5 ? -0.35 : 0.35);
    formKit.body(g, w, h, col, { rx, brushed: d.brushed ?? st.brushed });

    // controls on the grid
    const cells = d.controls.filter((c) => (c.t === 'knob' || c.t === 'sel' || c.t === 'toggle' || c.t === 'button') && (c.x === undefined || c._auto));
    const n = Math.min(6, cells.length);
    const pos = CELLS[n] || [];
    const rows = n ? new Set(pos.map((p) => p[1])).size : 0;
    cells.slice(0, 6).forEach((c, i) => {
      c._auto = true;
      const [fx, y] = pos[i];
      c.x = fx * w;
      c.y = y;
      if (c.t === 'knob' || c.t === 'sel') {
        c.r = n === 1 ? 11 : n === 2 ? 10 : n >= 5 ? 7.5 : 8.8;
        c.labelPos = c.t === 'sel' ? 'below' : 'below';
        c.labelSize = n >= 5 ? 4.4 : 5;
        if (c.t === 'sel') { c.optSize = c.optSize || 3.6; c.labelRadius = c.labelRadius || 5.5; c.printLabels = c.printLabels ?? false; }
      } else if (c.t === 'toggle') {
        c.orient = c.orient || 'h';
        c.optSize = c.optSize || 4;
        c.y = y + 2;
      } else if (c.t === 'button') {
        c.r = 4.6;
        c.labelSize = 4.4;
      }
    });
    const deck = rows >= 2 ? 90 : n === 3 ? 80 : 58;

    // brand band
    if (st.band === 'bottom') {
      const by = h - 38;
      svg('path', { d: `M0 ${by} H${w} V${h - rx} Q${w} ${h} ${w - rx} ${h} H${rx} Q0 ${h} 0 ${h - rx} Z`, fill: st.bandColor || shade(col, -0.55) }, g);
      svg('rect', { x: 0, y: by, width: w, height: 1.2, fill: acc }, g);
    } else if (st.band === 'top') {
      svg('path', { d: `M${rx} 0 H${w - rx} Q${w} 0 ${w} ${rx} V7 H0 V${rx} Q0 0 ${rx} 0 Z`, fill: st.bandColor || shade(col, -0.5) }, g);
    }

    // art box
    const ay = deck + 2, ah = Math.max(22, 126 - ay), ax = st.artBleed ? 0 : 8, aw = st.artBleed ? w : w - 16;
    if (d.art && d.art.kind) {
      const id = `${formName}-clip${++seq}`;
      const cp = svg('clipPath', { id }, g);
      svg('rect', { x: ax, y: ay, width: aw, height: ah, rx: st.artBleed ? 0 : 4 }, cp);
      const ag = svg('g', { 'clip-path': `url(#${id})` }, g);
      if (d.art.bg) svg('rect', { x: ax, y: ay, width: aw, height: ah, fill: d.art.bg }, ag);
      art(ag, d.art, ax, ay, aw, ah, acc);
      if (!st.artBleed && st.artFrame !== false) svg('rect', { x: ax, y: ay, width: aw, height: ah, rx: 4, fill: 'none', stroke: txt, 'stroke-opacity': 0.35, 'stroke-width': 0.8 }, g);
    }

    // name + type
    const logo = d.logo || d.name;
    const lsz = d.logoSize || Math.min(st.logoSize || 11, 84 / Math.max(4, logo.length * 0.56));
    label(g, w / 2, 135, logo, { size: lsz, fill: d.logoColor || txt, font: d.logoFont || st.logoFont || "'Oswald', sans-serif", weight: 700, ls: 0.6, italic: st.logoItalic });
    label(g, w / 2, 145, (d.typeName || d.cat).toUpperCase(), { size: 4.2, fill: st.band === 'bottom' ? acc : txt, weight: 700, ls: 1, opacity: 0.85 });
    formKit.tzBadge(g, w / 2, h - 5, st.band === 'bottom' ? '#d8d8d8' : txt, 3.3);

    for (const c of d.controls) {
      if (c.x !== undefined && !c._auto) continue;
      if (c.t === 'foot') Object.assign(c, { _auto: true, style: 'stomp', x: w / 2, y: 166, r: 10 });
      else if (c.t === 'led') Object.assign(c, { _auto: true, x: w / 2, y: 11, r: 2.4 });
    }
    const theme = { text: txt, knob: d.knob || st.knob || 'mxr', labelSize: 5, labelFont: "'Barlow Condensed', sans-serif", labelLs: 0.3, toggleTitles: false };
    formKit.placeControls(ctx, d.controls, theme);
    return { w, h, theme, jacks: formKit.jacksSide(d, w, { flip: ctx.flip, y0: 44, gap: 24 }) };
  });
}
