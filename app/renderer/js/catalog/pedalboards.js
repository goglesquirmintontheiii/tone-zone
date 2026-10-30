// Empty pedalboards. No audio: they hold pedals. Drop a pedal on one and it snaps into a slot; dragging the
// board takes its pedals along. Drawn by gfx/forms-board.js. Frame, rails and screwheads each have a material
// (gfx/materials.js), stored as string params frameMat/frameSub/frameFin/frameCol, rail..., screw...
import { SEL, def } from './helpers.js';

// slot grid: one slot fits one regular pedal (about 150 x 250)
export const BOARD_SLOT = { w: 160, h: 270, padX: 34, padY: 30 };
export const BOARD_SIZES = [
  ['tiny', 'Tiny', 4, 1],
  ['small', 'Small', 8, 1],
  ['medium', 'Medium', 6, 2],
  ['large', 'Large', 9, 2],
  ['xl', 'XL', 12, 2],
  ['xlmax', 'XL Max', 14, 2],
];
export const BOARD_STYLES = ['FULL VELCRO', 'VELCRO STRIPS', 'SCREWS', 'MESSY', 'BLANK'];

const MAT_KEYS = ['Mat', 'Sub', 'Fin', 'Col', 'Wear', 'Multi'];
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
  const get = (pre) => (p[pre + 'Mat'] ? { m: p[pre + 'Mat'], s: p[pre + 'Sub'], f: p[pre + 'Fin'], c: p[pre + 'Col'], w: wearOf(p[pre + 'Wear']), mc: multiOf(p[pre + 'Multi']) } : null);
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
  import('../ui/material-picker.js').then(({ materialPicker }) =>
    import('../gfx/materials.js').then((M) => {
      const h = document.createElement('h5');
      h.textContent = 'Materials';
      host.appendChild(h);
      const draw = () => {
        [...host.querySelectorAll('.mtp, .mtp-row')].forEach((n) => n.remove());
        const p = api.params();
        const sp = boardSpecs(p);
        materialPicker(host, { key: 'pb-frame', title: 'Frame', value: sp.frame, collapsible: true, open: true, wear: true, onChange: (s) => api.setParams(M.toParams(s, 'frame')) });
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
        materialPicker(host, { key: 'pb-screw', title: 'Screwheads', value: sp.screw, collapsible: true, onChange: (s) => api.setParams(M.toParams(s, 'screw')) });
      };
      draw();
    })
  );
}

export const pedalboards = BOARD_SIZES.map(([key, label, cols, rows]) =>
  def({
    id: 'pb.' + key,
    name: label + ' Pedalboard',
    brand: 'Tone Zone',
    ref: 'Tone Zone original',
    cat: 'Pedalboard',
    kind: 'Pedalboard',
    typeName: `${cols * rows} pedals`,
    form: 'pedalboard',
    pedalboard: { cols, rows },
    algo: null,
    ports: { ins: [], outs: [] },
    rerenderOn: ['jacket', 'velcro', 'name', 'style', 'screwCol', ...matParams('frame'), ...matParams('rail'), ...matParams('screw')],
    alwaysOn: true,
    cost: 0,
    controls: [
      SEL('style', 'MOUNTING', BOARD_STYLES, { virtual: true, hidden: true }),
      SEL('velcro', 'VELCRO', ['BLACK', 'WHITE', 'SEMI-CLEAR'], { virtual: true, hidden: true }),
    ],
    inspectorSection,
    desc: `Holds ${cols * rows} regular pedals (${cols} x ${rows}). Drop pedals on it to snap them into place; drag the frame to move the whole board. Right-click to rename it or change the frame material; mounting, velcro and materials are in the inspector.`,
  })
);
