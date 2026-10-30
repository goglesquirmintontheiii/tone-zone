// Empty pedalboards. No audio: they hold pedals. Drop a pedal on one and it snaps into a slot; dragging the
// board takes its pedals along. Drawn by gfx/forms-board.js.
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
    recolor: true,
    recolorSwatches: ['#1d1e22', '#4a4f57', '#9aa0a8', '#d9dbde', '#b8964f', '#8e2a26', '#2b4a7a', '#2f5a3e'],
    rerenderOn: ['jacket', 'velcro', 'name'],
    alwaysOn: true,
    cost: 0,
    controls: [SEL('velcro', 'VELCRO', ['BLACK', 'WHITE', 'SEMI-CLEAR'], { virtual: true, hidden: true })],
    desc: `Holds ${cols * rows} regular pedals (${cols} x ${rows}). Drop pedals on it to snap them into place; drag the frame to move the whole board. Right-click to rename it or change the frame colour; the velcro colour is in the inspector.`,
  })
);
