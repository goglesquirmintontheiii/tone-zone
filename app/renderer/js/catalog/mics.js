// Core microphone models. The first eight are the mic types of v0.10 (cab param m<i>type 0..7): `legacy` keeps their
// exact v0.10 voicing in the engine so old presets sound the same. More models come from the Mics plugin.
// Responses are [Hz, dB] at about 30 cm, 0 dB near 1 kHz (docs/mic-blocks.md).
import { mic } from './builders.js';

const B = 'Tone Zone Mics';

export const coreMics = [
  mic({
    id: 'mics.dyn57', name: 'Fifty-Seven', brand: B, ref: 'Shure SM57',
    desc: 'The cab mic. Tight low end, a 5 to 6 kHz presence lift, and a top that rolls off before it gets fizzy.',
    mic: {
      type: 'dynamic', pattern: 'cardioid', legacy: 0, short: '57',
      resp: [[20, -18], [40, -11], [60, -7], [100, -3], [200, 0], [500, 0], [1000, 0], [2000, 1], [3000, 2], [4000, 4], [5500, 6], [6500, 4.5], [8000, 2], [10000, -1], [12000, -5], [15000, -10], [20000, -20]],
      offAxis: -8, prox: 9, sens: 0, color: '#3d4046',
      look: { kind: 'stick', body: '#3d4046', grille: '#9ea3aa', ring: '#2a2c30', len: 157, w: 32, headW: 32, headLen: 38, tail: 25 },
    },
  }),
  mic({
    id: 'mics.c414', name: 'Four-Fourteen', brand: B, ref: 'AKG C414',
    desc: 'Large-diaphragm condenser. Even, detailed and open, with a gentle sparkle around 10 kHz.',
    mic: {
      type: 'condenser', pattern: 'cardioid', legacy: 1, short: '414',
      resp: [[20, -3], [40, -1], [100, 0], [1000, 0], [3000, 0.5], [6000, 1.5], [8000, 2], [10000, 3], [12000, 2], [15000, 0], [20000, -5]],
      offAxis: -5, prox: 6, sens: 0, color: '#1f2023',
      look: { kind: 'ldc', head: 'square', body: '#1f2023', grille: '#c8a95c', frame: '#c8a95c', len: 160, w: 50, headLen: 70, badge: '#c8a95c' },
    },
  }),
  mic({
    id: 'mics.r121', name: 'One-Twenty-One', brand: B, ref: 'Royer R-121',
    desc: 'Ribbon. Big, smooth low mids and a soft, rolled-off top that tames harsh amps.',
    mic: {
      type: 'ribbon', pattern: 'figure8', legacy: 2, short: '121',
      resp: [[20, -5], [40, -1.5], [100, 0], [300, 0.5], [1000, 0], [3000, -1], [5000, -3], [8000, -6], [10000, -8], [15000, -14], [20000, -20]],
      offAxis: -10, prox: 12, sens: 0, color: '#a7abb1',
      look: { kind: 'ribbon', body: '#a7abb1', grille: '#1c1d20', len: 158, w: 25 },
    },
  }),
  mic({
    id: 'mics.md421', name: 'Four-Twenty-One', brand: B, ref: 'Sennheiser MD 421',
    desc: 'Large dynamic. Fuller than a 57 with a wider presence bump, punchy and a bit scooped in the low mids.',
    mic: {
      type: 'dynamic', pattern: 'cardioid', legacy: 3, short: '421',
      resp: [[30, -10], [50, -6], [100, -2], [200, -1.5], [500, 0], [1000, 0], [2000, 1], [3000, 2], [4000, 3.5], [5000, 3], [7000, 2], [10000, 0], [15000, -6], [18000, -12]],
      offAxis: -7, prox: 7, sens: 0, color: '#26272b',
      look: { kind: 'oblong', body: '#26272b', grille: '#26272b', slots: '#6a6d74', len: 200, w: 46, headLen: 62, ring: '#8a8e95' },
    },
  }),
  mic({
    id: 'mics.e906', name: 'Nine-Oh-Six', brand: B, ref: 'Sennheiser e906',
    desc: 'Flat side-address dynamic that hangs over the cab. Forward upper mids, tight lows.',
    mic: {
      type: 'dynamic', pattern: 'supercardioid', legacy: 4, short: '906',
      resp: [[40, -10], [70, -6], [100, -4], [250, -2], [500, 0], [1000, 0], [2000, 1], [3000, 2.5], [4500, 4], [6000, 3], [8000, 1], [10000, -1], [15000, -8], [18000, -14]],
      offAxis: -8, prox: 8, sens: 0, color: '#1b1c1f',
      look: { kind: 'sideflat', body: '#1b1c1f', grille: '#2e3034', len: 135, w: 54, switch: true },
    },
  }),
  mic({
    id: 'mics.md441', name: 'Four-Forty-One', brand: B, ref: 'Sennheiser MD 441',
    desc: 'Long supercardioid dynamic with an almost condenser-like flat, detailed response.',
    mic: {
      type: 'dynamic', pattern: 'supercardioid', legacy: 5, short: '441',
      resp: [[30, -6], [50, -3], [100, 0], [200, 0], [1000, 0], [3000, 0.5], [6000, 1], [8000, 1.5], [10000, 1], [15000, -3], [20000, -8]],
      offAxis: -6, prox: 6, sens: 0, color: '#c9c6bd',
      look: { kind: 'tube', body: '#c9c6bd', grille: '#26272b', slots: true, len: 190, w: 33, headLen: 62, top: 'flat', ring: '#7d7a73' },
    },
  }),
  mic({
    id: 'mics.u87', name: 'Eighty-Seven', brand: B, ref: 'Neumann U 87',
    desc: 'The studio large-diaphragm condenser. Full, polished, with an airy top.',
    mic: {
      type: 'condenser', pattern: 'cardioid', legacy: 6, short: '87',
      resp: [[20, -4], [40, -1.5], [100, 0], [400, -0.5], [1000, 0], [3000, 0], [6000, 1], [8000, 2.5], [10000, 3], [12000, 2], [15000, 0], [20000, -5]],
      offAxis: -4, prox: 6, sens: 0, color: '#c8cacc',
      look: { kind: 'ldc', head: 'pill', body: '#c8cacc', grille: '#c8cacc', len: 200, w: 56, headLen: 78, badge: '#26282c' },
    },
  }),
  mic({
    id: 'mics.m160', name: 'One-Sixty', brand: B, ref: 'Beyerdynamic M 160',
    desc: 'Hypercardioid ribbon in a slim dynamic-style body. Focused, warm, with a smooth top.',
    mic: {
      type: 'ribbon', pattern: 'hypercardioid', legacy: 7, short: '160',
      resp: [[40, -6], [60, -3], [100, -1], [300, 0], [1000, 0], [3000, -1], [5000, -2.5], [8000, -5], [10000, -7], [14000, -12], [18000, -18]],
      offAxis: -9, prox: 8, sens: 0, color: '#2b2c30',
      look: { kind: 'tube', body: '#2b2c30', grille: '#b5b9bf', len: 150, w: 38, headLen: 52, top: 'round', mesh: true, ring: '#5d6168' },
    },
  }),
  mic({
    id: 'mics.beta57a', name: 'Beta Fifty-Seven', brand: B, ref: 'Shure Beta 57A',
    desc: 'Supercardioid cousin of the 57: a little hotter, tighter off-axis, with a more extended top.',
    mic: {
      type: 'dynamic', pattern: 'supercardioid', short: 'B57A',
      resp: [[20, -16], [40, -10], [60, -6], [100, -2], [200, 0], [500, 0], [1000, 0], [2000, 1], [3000, 2.5], [4000, 4], [5000, 5], [6000, 4.5], [8000, 3], [10000, 1], [12000, -2.5], [15000, -8], [20000, -18]],
      offAxis: -7, prox: 10, sens: 1.5, color: '#141517',
      look: { kind: 'stick', body: '#141517', grille: '#8f949b', ring: '#24497e', len: 160, w: 34, headW: 38, headLen: 42, tail: 25, angled: true },
    },
  }),
  mic({
    id: 'mics.dyn58', name: 'Fifty-Eight', brand: B, ref: 'Shure SM58',
    desc: 'The vocal mic, on a cab. The ball grille softens the top a little, the presence peak sits lower and wider than a 57.',
    mic: {
      type: 'dynamic', pattern: 'cardioid', short: '58',
      resp: [[20, -18], [40, -13], [60, -9], [100, -4], [200, -1], [500, 0], [1000, 0], [2000, 1.5], [3000, 3], [4000, 4.5], [5000, 5], [6000, 4], [7000, 2], [8000, 1], [10000, -2], [12000, -6], [15000, -12], [20000, -22]],
      offAxis: -7, prox: 10, sens: 0, color: '#3d4046',
      look: { kind: 'handheld', body: '#3d4046', grille: '#b9bdc3', len: 162, w: 34, ball: 51, tail: 25 },
    },
  }),
];
