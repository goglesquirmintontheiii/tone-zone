// Empty pedalboards. No audio: they hold pedals. Drop a pedal on one and it snaps into a slot; dragging the
// board takes its pedals along. Drawn by gfx/forms-board.js. Frame, rails and screwheads each have a material
// (gfx/materials.js), stored as string params frameMat/frameSub/frameFin/frameCol, rail..., screw...
import { SEL, def } from './helpers.js';
import { JACK_TIP, PLUG_LENS, SLEEVE } from '../gfx/jacks.js';

// slot grid: one slot fits one regular pedal (about 150 x 250) with its plugs. A pedal that is wider with its
// plugs takes two slots. Rows leave a gap between them for cables.
export const BOARD_SLOT = { w: 240, h: 300, padX: 34, padY: 30 };
// anything bigger than this (floor units, big multi-effects) stays off boards
export const BOARD_MAX = { w: 480, h: 364 };
export const BOARD_SIZES = [
  ['tiny', 'Tiny', 4, 1],
  ['small', 'Small', 8, 1],
  ['medium', 'Medium', 6, 2],
  ['large', 'Large', 9, 2],
  ['xl', 'XL', 12, 2],
  ['xlmax', 'XL Max', 10, 3, [10, 9, 9]],
];
// stored style values: 0 full velcro, 1 velcro strips, 2 screws, 3 messy screws, 4 blank. The inspector shows
// them as a mounting choice (velcro, screws, blank) plus a toggle for each.
export const BOARD_STYLES = ['FULL VELCRO', 'VELCRO STRIPS', 'SCREWS', 'MESSY', 'BLANK'];
export const MOUNTINGS = ['Velcro', 'Screws', 'Blank'];
export const mountingOf = (style) => (style >= 4 ? 2 : style >= 2 ? 1 : 0);
// style value for a mounting and its toggle (strips for velcro, messy for screws)
export const styleFor = (mount, toggle) => (mount === 2 ? 4 : mount * 2 + (toggle ? 1 : 0));
const VELCRO_COLS = ['BLACK', 'WHITE', 'SEMI-CLEAR'];

// Mounting rows: velcro / screws / blank, then the toggle and velcro colour that go with the choice
function mountingRows(host, api, glass) {
  const p = api.params();
  const style = Math.round(p.style || 0);
  const mount = mountingOf(style);
  const h = document.createElement('h5');
  h.textContent = 'Mounting';
  host.appendChild(h);
  const row = (label, cls) => {
    const r = document.createElement('div');
    r.className = 'prow ' + cls;
    const l = document.createElement('label');
    l.textContent = label;
    r.appendChild(l);
    host.appendChild(r);
    return r;
  };
  const sel = (r, options, value, onchange) => {
    const s = document.createElement('select');
    options.forEach((o, i) => { const op = document.createElement('option'); op.value = i; op.textContent = o; s.appendChild(op); });
    s.value = value;
    s.onchange = () => onchange(+s.value, s);
    r.appendChild(s);
    return s;
  };
  const toggle = (r, on, onchange) => {
    const l = document.createElement('label');
    l.className = 'switch';
    l.innerHTML = '<input type="checkbox"><span></span>';
    const cb = l.querySelector('input');
    cb.checked = on;
    cb.onchange = () => onchange(cb.checked);
    r.appendChild(l);
    return cb;
  };
  // each toggle is remembered, so going velcro > screws > velcro keeps the strips choice
  const strips = style === 1 || (style !== 0 && !!p._strips);
  const messy = style === 3 || (style !== 2 && !!p._messy);
  const ms = sel(row('Mounting', 'pb-mount'), MOUNTINGS, mount, (m, s) => {
    if (m === 1 && glass) { s.value = mount; return; }
    api.setParams({ style: styleFor(m, m === 0 ? strips : messy) });
  });
  if (glass) ms.options[1].disabled = true;
  if (mount === 0) {
    toggle(row('Strips per spot', 'pb-strips'), style === 1, (on) => api.setParams({ style: styleFor(0, on), _strips: on ? 1 : 0 }));
    sel(row('Velcro colour', 'pb-velcro'), VELCRO_COLS.map((c) => c[0] + c.slice(1).toLowerCase()), Math.round(p.velcro || 0), (v) => api.setParams({ velcro: v }));
  } else if (mount === 1) {
    toggle(row('Messy', 'pb-messy'), style === 3, (on) => api.setParams({ style: styleFor(1, on), _messy: on ? 1 : 0 }));
  }
}

// how far a plugged in cable sticks out of a jack (plug plus a little cable)
export const plugOut = (kind) => (JACK_TIP[kind] ?? 6) + (PLUG_LENS[kind] || 30) - (SLEEVE[kind] || 0) + 4;

// how far a block's plugs reach past its body on each side. jacks: [{key, x, y, side, kind}] in block coords.
// Control jacks only count when `used` (a Set of jack keys) has them.
export function boardFootprint(w, h, jacks, used) {
  const f = { l: 0, r: 0, t: 0, b: 0 };
  for (const j of jacks || []) {
    if (/^[io]c/.test(j.key) && !(used && used.has(j.key))) continue;
    if (j.male) continue;
    const P = plugOut(j.kind || 'inst');
    if (j.side === 'left') f.l = Math.max(f.l, P - j.x);
    else if (j.side === 'right') f.r = Math.max(f.r, j.x + P - w);
    else if (j.side === 'top') f.t = Math.max(f.t, P - j.y);
    else if (j.side === 'bottom') f.b = Math.max(f.b, j.y + P - h);
  }
  return f;
}
// slots a block needs side by side so its plugs stay inside its own slots
export const slotSpan = (w, f, cols = 99) => Math.min(cols, Math.max(1, Math.ceil((w + f.l + f.r + 4) / BOARD_SLOT.w)));
// can this block go on a board at all?
export const boardable = (d, w, h) => !!d && !d.pedalboard && !d.coupler && d.baseForm !== 'amp' && d.baseForm !== 'cab' && d.form !== 'io' && w <= BOARD_MAX.w && h <= BOARD_MAX.h;
export const rowColsOf = (pb) => pb.rowCols || Array(pb.rows).fill(pb.cols);
export const boardSize = (pb) => ({ w: pb.cols * BOARD_SLOT.w + BOARD_SLOT.padX * 2, h: pb.rows * BOARD_SLOT.h + BOARD_SLOT.padY * 2 });
// left edge of row r (shorter rows are centred)
export const rowX = (pb, r) => BOARD_SLOT.padX + ((pb.cols - rowColsOf(pb)[r]) * BOARD_SLOT.w) / 2;
// where a block sits (board coords) when it takes `n` slots from column c of row r: centred with its plugs,
// and low enough that its top plugs stay on its row. Taller blocks stand at the bottom of the row.
export function slotPos(pb, r, c, n, w, h, f) {
  const S = BOARD_SLOT;
  const x = rowX(pb, r) + c * S.w + (n * S.w - (w + f.l + f.r)) / 2 + f.l;
  const y0 = S.padY + r * S.h;
  const y = y0 + (h + f.t + f.b + 6 > S.h ? S.h - h - 4 : Math.min(Math.max((S.h - h) / 2, f.t + 3), S.h - h - f.b - 3));
  return { x: Math.round(x), y: Math.round(y) };
}
// Factory presets: the smallest board that holds these blocks in signal order, filled right to left one row
// at a time. items: [{w, h, f}]. Returns { key, pos: [{x, y}] } in board coords, or null.
export function planBoard(items) {
  for (const [key, , cols, rows, rowCols] of BOARD_SIZES) {
    const pb = { cols, rows, rowCols };
    const rc = rowColsOf(pb);
    const pos = [];
    let r = 0, used = 0;
    for (const it of items) {
      const n = slotSpan(it.w, it.f, cols);
      if (used + n > rc[r]) { r++; used = 0; }
      if (r >= rows || n > rc[r]) break;
      pos.push(slotPos(pb, r, rc[r] - used - n, n, it.w, it.h, it.f));
      used += n;
    }
    if (pos.length === items.length) return { key, pos };
  }
  return null;
}

const count = (cols, rows, rowCols) => (rowCols ? rowCols.reduce((a, b) => a + b, 0) : cols * rows);
const MAT_KEYS = ['Mat', 'Sub', 'Fin', 'Col', 'T', 'Wear', 'Multi'];
const matParams = (pre) => MAT_KEYS.map((k) => pre + k);

function wearOf(str) {
  const w = {};
  for (const part of String(str || '').split(',')) {
    const [k, v] = part.split(':');
    if (k && +v > 0) w[k.trim()] = +v;
  }
  return w;
}
function multiOf(str) {
  const [mode, angle, stops] = String(str || '').split('|');
  return mode ? { mode, angle: +angle || 0, stops: (stops || '').split(' ').filter(Boolean) } : null;
}
// older presets stored a plain frame colour (jacket) and screw colour (screwCol)
export function boardSpecs(p = {}) {
  const get = (pre) => (p[pre + 'Mat'] ? { m: p[pre + 'Mat'], s: p[pre + 'Sub'], f: p[pre + 'Fin'], c: p[pre + 'Col'], t: p[pre + 'T'], w: wearOf(p[pre + 'Wear']), mc: multiOf(p[pre + 'Multi']) } : null);
  const frame = get('frame') || { m: 'metal', s: 'aluminium', f: 'anodized', c: p.jacket || '#1d1e22' };
  const ownRails = p.railMat && p.railMat !== 'frame';
  const rail = ownRails ? get('rail') : frame;
  const screw = get('screw') || (p.screwCol ? { m: 'metal', s: 'stainless', f: 'anodized', c: p.screwCol } : { m: 'metal', s: 'chrome', f: 'polished' });
  return { frame, rail, screw, ownRails: !!ownRails };
}

// inspector: one material picker per part
function inspectorSection(block, host, api) {
  host.classList.add('insp-mat');
  host.dataset.reveal = 'material';
  // mounting and velcro have their own rows here, so the plain Controls section above would be empty
  const prev = host.previousElementSibling;
  if (prev && prev.children.length === 1 && prev.firstElementChild.tagName === 'H5') prev.hidden = true;
  const mount = document.createElement('div');
  mount.className = 'pb-mounting';
  mount.style.marginBottom = '14px';
  host.appendChild(mount);
  const p0 = api.params();
  mountingRows(mount, api, p0.frameMat === 'glass');
  import('../ui/material-picker.js').then(({ materialPicker }) =>
    import('../gfx/materials.js').then((M) => {
      const h = document.createElement('h5');
      h.textContent = 'Materials';
      host.appendChild(h);
      const draw = () => {
        [...host.querySelectorAll('.mtp, .mtp-row')].forEach((n) => n.remove());
        const p = api.params();
        const sp = boardSpecs(p);
        materialPicker(host, {
          key: 'pb-frame', title: 'Frame', value: sp.frame, collapsible: true, open: true, wear: true,
          onChange: (s) => {
            const st = Math.round(api.params().style || 0);
            // glass can't take screws: fall back to full velcro
            api.setParams(Object.assign(M.toParams(s, 'frame'), s.m === 'glass' && (st === 2 || st === 3) ? { style: 0 } : {}));
            if ((s.m === 'glass') !== (sp.frame.m === 'glass')) api.rerender();
          },
        });
        const row = document.createElement('label');
        row.className = 'mtp-row';
        row.innerHTML = '<input type="checkbox"> Rails match the frame';
        const cb = row.querySelector('input');
        cb.checked = !sp.ownRails;
        cb.onchange = () => {
          api.setParams(cb.checked ? { railMat: 'frame' } : M.toParams({ m: 'metal', s: 'aluminium', f: 'brushed' }, 'rail'));
          draw();
        };
        host.appendChild(row);
        if (sp.ownRails) materialPicker(host, { key: 'pb-rail', title: 'Rails', value: sp.rail, collapsible: true, wear: true, onChange: (s) => api.setParams(M.toParams(s, 'rail')) });
        const style = Math.round(p.style || 0);
        if (sp.frame.m === 'glass' && (style === 2 || style === 3)) {
          // picked a screw mounting on a glass board: undo it
          setTimeout(() => api.setParams({ style: 0 }), 0);
          import('../util.js').then((u) => u.toast("Glass boards can't use screws", 'info'));
        }
        if (sp.frame.m === 'glass') {
          const note = document.createElement('p');
          note.className = 'mtp-note';
          note.textContent = 'Glass frames have no screws, so the screw mountings are off.';
          host.appendChild(note);
        } else materialPicker(host, { key: 'pb-screw', title: 'Screwheads', value: sp.screw, collapsible: true, onChange: (s) => api.setParams(M.toParams(s, 'screw')) });
      };
      draw();
    })
  );
}

export const pedalboards = BOARD_SIZES.map(([key, label, cols, rows, rowCols]) =>
  def({
    id: 'pb.' + key,
    name: label + ' Pedalboard',
    brand: 'Tone Zone',
    ref: 'Tone Zone original',
    cat: 'Pedalboard',
    kind: 'Pedalboard',
    typeName: `${count(cols, rows, rowCols)} pedals`,
    form: 'pedalboard',
    pedalboard: { cols, rows, rowCols },
    algo: null,
    ports: { ins: [], outs: [] },
    rerenderOn: ['jacket', 'velcro', 'name', 'style', 'screwCol', ...matParams('frame'), ...matParams('rail'), ...matParams('screw')],
    alwaysOn: true,
    cost: 0,
    controls: [
      SEL('style', 'MOUNTING', BOARD_STYLES, { virtual: true, hidden: true, noInspector: true }),
      SEL('velcro', 'VELCRO', VELCRO_COLS, { virtual: true, hidden: true, noInspector: true }),
    ],
    inspectorSection,
    inspectorRerenderOn: ['style'],
    desc: `Holds ${count(cols, rows, rowCols)} regular pedals (${rowCols ? rowCols.join(' + ') : cols + ' x ' + rows}); wide ones take two spots. Drop pedals on it to snap them into place; drag the frame to move the whole board. Right-click to rename it or change the frame material; mounting, velcro and materials are in the inspector.`,
  })
);
