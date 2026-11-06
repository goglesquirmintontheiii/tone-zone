// Mic models for the Studio Mics plugin. Every response is the on-axis curve at about 30 cm (so proximity is
// mostly out of the picture), read off the published charts, with any switches at their default (flat) setting.
// resp: [Hz, dB], 0 dB near 1 kHz. prox: bass boost at 100 Hz on the grille. offAxis: HF loss at 90 degrees.
// sens: level in dB against the SM57 inspired core model (condensers and ribbons squeezed into a sane range).
// look: what draw.js needs to draw the mic (shape family + proportions, colours, finish, grille).

const D = 'dynamic', C = 'condenser', R = 'ribbon';

export const MODELS = [
  // ------------------------------------------------------------------ dynamics
  {
    id: 'e609', name: 'Hanover Flat 69', brand: 'Sennheiser', ref: 'Sennheiser e609 Silver', type: D, pattern: 'supercardioid',
    desc: 'The silver flat one: bright, forward upper mids that cut through a busy mix.',
    resp: [[20, -22], [40, -14], [70, -8], [120, -3.5], [250, -1], [500, 0], [1000, 0], [2000, 2], [3000, 4.5], [4000, 6.5], [5000, 5], [7000, 2], [9000, -0.5], [11000, -3], [13000, -7], [15000, -12], [18000, -20], [20000, -26]],
    prox: 8, offAxis: -7, sens: -0.5, color: '#b4b7bc',
    look: { shape: 'flat', color: '#b4b7bc', mesh: '#1b1c1f', finish: 'satin', badge: 'HNV 69', short: true },
  },
  {
    id: 're20', name: 'Buchanan 20', brand: 'Electro-Voice', ref: 'Electro-Voice RE20', type: D, pattern: 'cardioid',
    desc: 'Smooth, flat and polite with almost no proximity boom, so it stays even as you move it in.',
    resp: [[20, -16], [45, -5], [70, -1.5], [120, 0], [500, 0], [1000, 0], [2000, 0.5], [3500, 1], [5000, 1.5], [7000, 1], [9000, 0.5], [11000, -1], [14000, -4], [16000, -7], [18000, -11], [20000, -16]],
    prox: 2, offAxis: -3, sens: -0.5, color: '#bfb8a6',
    look: { shape: 'longcyl', w: 30, h: 128, gh: 64, color: '#bfb8a6', grille: '#a8a394', kind: 'perf', band: '#3a3a3a', badge: 'BCN 20' },
  },
  {
    id: 're320', name: 'Buchanan 32', brand: 'Electro-Voice', ref: 'Electro-Voice RE320', type: D, pattern: 'cardioid',
    desc: 'The black long-body: even and full like its beige big brother, with a touch more presence.',
    resp: [[20, -12], [30, -6], [50, -2], [100, 0], [500, 0], [1000, 0], [2000, 1], [3500, 2.5], [5000, 3], [7000, 2], [9000, 1.5], [12000, 0], [15000, -4], [18000, -9], [20000, -14]],
    prox: 3, offAxis: -4, sens: 4, color: '#1e1e20',
    look: { shape: 'longcyl', w: 30, h: 122, gh: 60, color: '#1e1e20', grille: '#38393c', kind: 'perf', band: '#b9bcc0', bandChrome: true, badge: 'BCN 32' },
  },
  {
    id: 'sm7b', name: 'Niles Broadcast 7', brand: 'Shure', ref: 'Shure SM7B', type: D, pattern: 'cardioid',
    desc: 'Thick, smooth and dark-ish with a soft top: tames fizzy high gain without losing body.',
    resp: [[20, -18], [40, -9], [60, -4], [100, -1], [200, 0], [500, 0], [1000, 0], [2000, 0.5], [3000, 1.5], [4500, 2.5], [6000, 2.5], [8000, 1], [10000, -1], [12000, -4], [15000, -8], [18000, -13], [20000, -18]],
    prox: 10, offAxis: -6, sens: -3, color: '#1b1b1c',
    look: { shape: 'sm7', color: '#1b1b1c', badge: 'NB7' },
  },
  {
    id: 'beta52', name: 'Niles Kick 52', brand: 'Shure', ref: 'Shure Beta 52A', type: D, pattern: 'supercardioid',
    desc: 'Kick drum mic with a fat low bump, scooped low mids and a hard 4 kHz click: bass cabs love it.',
    resp: [[20, -3], [30, 1], [50, 4], [80, 5], [120, 4], [200, 2], [400, 0], [700, -1], [1000, 0], [2000, 3], [3000, 7], [4000, 10], [5000, 8], [6500, 4], [8000, 0], [10000, -6], [13000, -14], [16000, -22], [20000, -30]],
    prox: 7, offAxis: -8, sens: -8, color: '#1c1c1e',
    look: { shape: 'ball', d: 40, color: '#1c1c1e', mesh: '#8b8e93', badge: 'NK52', mount: true },
  },
  {
    id: 'i5', name: 'Wilson Five', brand: 'Audix', ref: 'Audix i5', type: D, pattern: 'cardioid',
    desc: 'Like a 57 with a bit more upper-mid bite and a tighter low end.',
    resp: [[20, -12], [50, -5], [80, -2], [150, 0], [300, 0], [1000, 0], [2000, 1], [2500, 2.5], [4000, 4], [5000, 5], [6500, 4.5], [8000, 3.5], [10000, 1.5], [12500, -2], [15000, -8], [17000, -13], [20000, -22]],
    prox: 9, offAxis: -6, sens: 0, color: '#2d2e31',
    look: { shape: 'stick', head: 'flat', hw: 24, hh: 22, mesh: '#1d1d1f', color: '#2d2e31', bw0: 21, bw1: 17, bl: 72, ring: '#8a8d92', badge: 'W5' },
  },
  {
    id: 'd6', name: 'Wilson Kick 6', brand: 'Audix', ref: 'Audix D6', type: D, pattern: 'cardioid',
    desc: 'Huge lows and a deep mid scoop with a bright click on top: instant modern bass cab.',
    resp: [[20, 0], [30, 5], [50, 9], [70, 10], [100, 9], [200, 5], [400, 0], [700, -2], [1000, 0], [2000, 4], [3000, 6.5], [4500, 7], [6000, 5], [8000, 2], [10000, -2], [12500, -8], [15000, -14], [20000, -26]],
    prox: 5, offAxis: -7, sens: -4, color: '#18181a',
    look: { shape: 'stick', head: 'flat', hw: 38, hh: 22, mesh: '#202022', color: '#18181a', bw0: 38, bw1: 30, bl: 42, ring: '#c4262e', badge: 'W6', stubby: true },
  },
  {
    id: 'pr30', name: 'Fairview 30', brand: 'Heil Sound', ref: 'Heil PR 30', type: D, pattern: 'cardioid',
    desc: 'Big-diaphragm dynamic with an extended, open top: a brighter, fuller alternative to the 57.',
    resp: [[20, -16], [40, -6], [70, -2], [120, 0], [300, 0], [1000, 0], [2000, 1], [3000, 2.5], [4500, 3.5], [6000, 3], [8000, 2.5], [10000, 2], [12500, 0], [15000, -3], [18000, -7], [20000, -12]],
    prox: 9, offAxis: -5, sens: -2.5, color: '#c9b385',
    look: { shape: 'longcyl', w: 34, h: 116, gh: 50, color: '#c9b385', grille: '#9a8a62', kind: 'ribs', band: '#1d1d1d', badge: 'FV 30', finish: 'satin' },
  },
  {
    id: 'm88', name: 'Heilbronn 88', brand: 'Beyerdynamic', ref: 'Beyerdynamic M 88 TG', type: D, pattern: 'hypercardioid',
    desc: 'Deep, extended lows and a smooth presence lift: a warm, full-range dynamic.',
    resp: [[20, -10], [30, -5], [50, -1.5], [100, 0.5], [200, 0.5], [500, 0], [1000, 0], [2000, 1], [3500, 3], [5000, 4], [7000, 3.5], [9000, 2], [12000, 0], [15000, -3], [18000, -7], [20000, -11]],
    prox: 7, offAxis: -7, sens: 5, color: '#151516',
    look: { shape: 'stick', head: 'dome', hw: 25, hh: 32, mesh: '#232325', color: '#151516', bw0: 23, bw1: 18, bl: 74, ring: '#3a3b3e', ribs: true, badge: 'HB 88' },
  },
  {
    id: 'm201', name: 'Heilbronn 21', brand: 'Beyerdynamic', ref: 'Beyerdynamic M 201 TG', type: D, pattern: 'hypercardioid',
    desc: 'Slim and accurate with crisp, airy highs: a tight, detailed cab mic.',
    resp: [[20, -18], [40, -9], [70, -4], [120, -1.5], [250, 0], [1000, 0], [2000, 0.5], [3000, 1], [5000, 2], [7000, 3], [9000, 2.5], [11000, 1], [14000, -2], [17000, -7], [20000, -14]],
    prox: 7, offAxis: -6, sens: 0, color: '#3b3c40',
    look: { shape: 'stick', head: 'flat', hw: 20, hh: 24, mesh: '#2a2b2e', kind: 'perf', color: '#3b3c40', bw0: 20, bw1: 19, bl: 84, ring: '#b9bcc0', badge: 'HB 21' },
  },
  {
    id: 'd112', name: 'Vienna Egg 12', brand: 'AKG', ref: 'AKG D112', type: D, pattern: 'cardioid',
    desc: 'The egg: round low-end bump and a 4 kHz snap, the go-to for bass cabs.',
    resp: [[20, -6], [30, -2], [50, 2], [80, 5], [100, 6], [150, 4], [250, 1], [500, -1], [1000, 0], [2000, 1.5], [3000, 4], [4000, 6], [5000, 5], [7000, 1], [9000, -3], [12000, -9], [15000, -14], [17000, -18], [20000, -26]],
    prox: 8, offAxis: -8, sens: 1, color: '#2b2c2f',
    look: { shape: 'egg', color: '#2b2c2f', mesh: '#6b6e73', badge: 'V112' },
  },

  {
    id: 'md409', name: 'Hanover Flat 49', brand: 'Sennheiser', ref: 'Sennheiser MD 409 U3', type: D, pattern: 'supercardioid',
    desc: 'The vintage flat one: a broad upper-mid push and a soft top, the old-school British rock sound.',
    resp: [[20, -18], [40, -11], [60, -6], [100, -2.5], [200, 0], [500, 0.5], [1000, 0], [1500, 1.5], [2500, 3], [3500, 4], [4500, 4], [6000, 2.5], [8000, 0], [10000, -4], [12500, -9], [15000, -14], [20000, -26]],
    prox: 8, offAxis: -8, sens: 1, color: '#2e2f31',
    look: { shape: 'flat', color: '#2e2f31', mesh: '#2a2b2d', vintage: true, trim: '#b9bcc0', badge: 'HNV 49' },
  },
  {
    id: 'nd468', name: 'Buchanan Pivot 68', brand: 'Electro-Voice', ref: 'Electro-Voice N/D468', type: D, pattern: 'supercardioid',
    desc: 'Pivoting head that hangs neatly over the speaker: crisp, extended highs and a tight low end.',
    resp: [[20, -16], [40, -8], [70, -3], [120, -1], [250, 0], [1000, 0], [2000, 1], [3500, 3], [5000, 4.5], [7000, 4], [9000, 3.5], [11000, 2], [14000, -1], [17000, -5], [20000, -10]],
    prox: 8, offAxis: -7, sens: 3, color: '#1b1b1c',
    look: { shape: 'pivot', color: '#1b1b1c', mesh: '#3d3e41', hinge: '#b9bcc0', badge: 'BCN 68' },
  },
  {
    id: 'm80', name: 'Elektro Stick 80', brand: 'Telefunken', ref: 'Telefunken M80', type: D, pattern: 'supercardioid',
    desc: 'A bright, open dynamic with a condenser-like top end: articulate and sparkly on clean amps.',
    resp: [[20, -14], [40, -7], [70, -3], [120, -1], [250, 0], [1000, 0], [2000, 0.5], [3500, 2], [5000, 3], [7000, 4], [9000, 4.5], [11000, 4], [13000, 2], [16000, -2], [20000, -8]],
    prox: 8, offAxis: -6, sens: 3, color: '#1a1a1b',
    look: { shape: 'stick', head: 'dome', hw: 27, hh: 28, mesh: '#c3c6ca', color: '#1a1a1b', bw0: 24, bw1: 19, bl: 66, ring: '#c4262e', badge: 'E 80' },
  },
  {
    id: 'e604', name: 'Hanover Clip 64', brand: 'Sennheiser', ref: 'Sennheiser e604', type: D, pattern: 'cardioid',
    desc: 'Tiny clip-on drum mic that clamps to the cab: bright and punchy upper mids, lean lows.',
    resp: [[20, -18], [40, -10], [70, -5], [120, -2], [250, 0], [1000, 0], [2000, 1.5], [3000, 3], [4500, 4], [6000, 4.5], [8000, 4], [10000, 2.5], [12500, -1], [15000, -5], [18000, -10], [20000, -16]],
    prox: 9, offAxis: -6, sens: 1, color: '#1d1e20',
    look: { shape: 'clip', color: '#1d1e20', mesh: '#2a2b2e', clip: '#a9acb0', badge: 'HNV 64' },
  },
  {
    id: 'pr31', name: 'Fairview 31', brand: 'Heil Sound', ref: 'Heil PR 31 BW', type: D, pattern: 'cardioid',
    desc: 'Short and wide with a tight low end and a forward 3 to 5 kHz bite: made to sit on a speaker.',
    resp: [[20, -18], [40, -10], [70, -5], [120, -2], [250, 0], [1000, 0], [2000, 1.5], [3000, 3], [4000, 4], [5500, 4], [7000, 3], [9000, 2], [11000, 0.5], [14000, -3], [17000, -7], [20000, -13]],
    prox: 8, offAxis: -6, sens: -2, color: '#b9bcc0',
    look: { shape: 'stick', head: 'flat', hw: 32, hh: 26, mesh: '#1d1d1f', color: '#b9bcc0', finish: 'satin', bw0: 30, bw1: 22, bl: 50, ring: '#1d1d1f', badge: 'FV 31', stubby: true },
  },

  // ------------------------------------------------------------------ condensers
  {
    id: 'u47', name: 'Berlin 47 Tube', brand: 'Neumann', ref: 'Neumann U 47 (tube)', type: C, pattern: 'cardioid',
    desc: 'Vintage tube warmth: thick low mids and a round, sweet top end.',
    resp: [[20, -5], [40, -1.5], [80, 0.5], [150, 1], [300, 0.5], [1000, 0], [2000, 0.5], [3500, 1.5], [5000, 3], [7000, 3.5], [9000, 2.5], [11000, 1], [13000, -1.5], [16000, -5], [20000, -11]],
    prox: 11, offAxis: -6, sens: 10, color: '#b2aa97',
    look: { shape: 'ldc', w: 32, h: 132, hh: 48, head: 'round', bw1: 32, color: '#b2aa97', finish: 'satin', grille: '#9b958a', badge: 'circle', badgeColor: '#2a2a2a', badgeOnGrille: true, base: '#5a564e' },
  },
  {
    id: 'tlm103', name: 'Berlin 103', brand: 'Neumann', ref: 'Neumann TLM 103', type: C, pattern: 'cardioid',
    desc: 'Stubby and bright with a clear 8 to 10 kHz lift: sparkle and detail on clean tones.',
    resp: [[20, -5], [30, -2.5], [50, -0.8], [100, 0], [1000, 0], [2000, 0.3], [4000, 1], [6000, 2], [8000, 3.5], [10000, 4.5], [12000, 3.5], [14000, 1.5], [17000, -2], [20000, -5]],
    prox: 10, offAxis: -5, sens: 13, color: '#c3c4c0',
    look: { shape: 'ldc', w: 36, h: 80, hh: 38, head: 'round', bw1: 34, color: '#c3c4c0', finish: 'satin', grille: '#a2a5a8', badge: 'circle', badgeColor: '#1b1b1b' },
  },
  {
    id: 'km184', name: 'Berlin Pencil 84', brand: 'Neumann', ref: 'Neumann KM 184', type: C, pattern: 'cardioid',
    desc: 'Small-diaphragm pencil: fast, airy and honest. Lovely on open-back cabs and as a room pair.',
    resp: [[20, -2.5], [40, -0.8], [100, 0], [1000, 0], [3000, 0], [5000, 0.5], [7000, 1.5], [9000, 3], [11000, 2.5], [13000, 3], [15000, 1.5], [18000, -1], [20000, -4]],
    prox: 9, offAxis: -2, sens: 9, color: '#1c1c1d',
    look: { shape: 'sdc', w: 13, h: 92, gh: 20, color: '#1c1c1d', grille: '#2c2c2e', ring: '#555', badge: 'dot' },
  },
  {
    id: 'c451', name: 'Vienna Pencil 451', brand: 'AKG', ref: 'AKG C451 B', type: C, pattern: 'cardioid',
    desc: 'Bright pencil condenser with a rising top: crisp and cutting on clean amps.',
    resp: [[20, -7], [40, -3], [70, -1], [120, 0], [1000, 0], [2000, 0.5], [4000, 1], [6000, 1.5], [8000, 2.5], [10000, 3.5], [12000, 4], [14000, 3], [17000, 1], [20000, -2]],
    prox: 9, offAxis: -2, sens: 9, color: '#c2c4c6',
    look: { shape: 'sdc', w: 14, h: 90, gh: 15, color: '#c2c4c6', finish: 'satin', grille: '#8d9093', ring: '#1d1d1d', switches: true },
  },
  {
    id: 'c800g', name: 'Tokyo 800 Tube', brand: 'Sony', ref: 'Sony C-800G', type: C, pattern: 'cardioid',
    desc: 'Big, glossy and bright with a hi-fi top end: the finned tube vocal mic, shiny on clean cabs.',
    resp: [[20, -5], [40, -2], [80, -0.5], [150, 0], [1000, 0], [2000, 1], [3500, 2.5], [5000, 4], [7000, 4.5], [9000, 4], [12000, 5], [15000, 3], [18000, 0], [20000, -3]],
    prox: 10, offAxis: -5, sens: 11, color: '#c9cbce',
    look: { shape: 'ldc', w: 38, h: 134, hh: 44, head: 'round', bw1: 38, color: '#c9cbce', finish: 'chrome', grille: '#9b9ea2', fins: true, badge: 'text', badgeText: 'TK 800' },
  },
  {
    id: 'ksm32', name: 'Niles Studio 32', brand: 'Shure', ref: 'Shure KSM32 (charcoal)', type: C, pattern: 'cardioid',
    desc: 'Smooth, neutral studio condenser with a soft presence lift: a safe room or second mic.',
    resp: [[20, -6], [40, -2.5], [80, -0.5], [150, 0], [1000, 0], [2000, 0.5], [4000, 1.5], [6000, 2.5], [8000, 2.5], [10000, 1.5], [12000, 1], [15000, 0], [18000, -2.5], [20000, -5]],
    prox: 10, offAxis: -5, sens: 9, color: '#47484b',
    look: { shape: 'ldc', w: 36, h: 110, hh: 38, head: 'round', bw1: 25, color: '#47484b', grille: '#5e6064', badge: 'text', badgeText: 'NS32' },
  },
  {
    id: 'ela251', name: 'Elektro 251 Tube', brand: 'Telefunken', ref: 'Telefunken ELA M 251', type: C, pattern: 'cardioid',
    desc: 'Tall tube classic: silky, open highs over a full, rich midrange.',
    resp: [[20, -3], [40, -0.5], [80, 0.5], [200, 1], [400, 0.7], [1000, 0], [2500, -0.7], [4000, 0], [6000, 1.5], [8000, 3], [10000, 4], [12000, 4], [14000, 2.5], [17000, -1], [20000, -5]],
    prox: 11, offAxis: -5, sens: 10, color: '#bab3a2',
    look: { shape: 'ldc', w: 34, h: 134, hh: 52, head: 'square', bw1: 34, color: '#bab3a2', finish: 'satin', grille: '#9e988a', knob: true, badge: 'plate', badgeColor: '#1e1e1e' },
  },
  {
    id: 'at4050', name: 'Machida 4050', brand: 'Audio-Technica', ref: 'Audio-Technica AT4050', type: C, pattern: 'cardioid',
    desc: 'Clean, flat and dependable with a slight top lift: the workhorse condenser.',
    resp: [[20, -4], [40, -1.5], [80, -0.3], [150, 0], [1000, 0], [3000, 0], [5000, 0.5], [7000, 1], [9000, 1.5], [12000, 1.5], [15000, 0], [18000, -2.5], [20000, -5]],
    prox: 10, offAxis: -5, sens: 10, color: '#2d2e30',
    look: { shape: 'ldc', w: 38, h: 112, hh: 46, head: 'square', bw1: 33, color: '#2d2e30', grille: '#46484b', trim: '#c8cbcf', badge: 'text', badgeText: 'MC 4050' },
  },
  {
    id: 'at2020', name: 'Machida 2020', brand: 'Audio-Technica', ref: 'Audio-Technica AT2020', type: C, pattern: 'cardioid',
    desc: 'The budget favourite: a little thin, with a bright 8 to 10 kHz edge.',
    resp: [[20, -8], [40, -4], [70, -1.5], [120, -0.5], [300, 0], [1000, 0], [2000, 0.5], [3500, 1.5], [5000, 2.5], [7000, 3], [9000, 4], [11000, 3.5], [13000, 2], [16000, -1], [20000, -6]],
    prox: 9, offAxis: -4, sens: 8, color: '#232325',
    look: { shape: 'ldc', w: 28, h: 88, hh: 30, head: 'flat', bw1: 26, color: '#232325', grille: '#3a3a3d', trim: '#a9acb0', badge: 'text', badgeText: 'MC 20' },
  },
  {
    id: 'nt1', name: 'Sydney One', brand: 'RODE', ref: 'RODE NT1 (black)', type: C, pattern: 'cardioid',
    desc: 'Very quiet and clean with a smooth high lift: modern, polished clean tones.',
    resp: [[20, -1.5], [40, 0], [100, 0.3], [300, 0.3], [1000, 0], [3000, 0], [5000, 0.3], [7000, 0.8], [10000, 1.5], [13000, 2.5], [16000, 2.5], [18000, 1], [20000, -2]],
    prox: 10, offAxis: -5, sens: 11, color: '#1d1d1f',
    look: { shape: 'ldc', w: 30, h: 118, hh: 42, head: 'round', bw1: 30, color: '#1d1d1f', grille: '#2c2c2f', badge: 'golddot' },
  },
  {
    id: 'nt5', name: 'Sydney Pencil 5', brand: 'RODE', ref: 'RODE NT5', type: C, pattern: 'cardioid',
    desc: 'Affordable pencil condenser: bright and crisp, best a little back from the cone.',
    resp: [[20, -6], [40, -2.5], [70, -1], [120, 0], [1000, 0], [3000, 0.8], [5000, 2], [8000, 3.5], [10000, 3.5], [12000, 2.5], [15000, 1], [18000, -1], [20000, -4]],
    prox: 9, offAxis: -2, sens: 8, color: '#cfc7b5',
    look: { shape: 'sdc', w: 12, h: 76, gh: 24, color: '#cfc7b5', finish: 'satin', grille: '#8a877f', ring: '#7d786c' },
  },

  {
    id: 'u47fet', name: 'Berlin 47 Solid', brand: 'Neumann', ref: 'Neumann U 47 fet', type: C, pattern: 'cardioid',
    desc: 'Fat, solid-state big brother of the 47: handles huge levels, deep lows and a smooth lift. A bass cab favourite.',
    resp: [[20, -4], [30, -2], [50, -0.5], [100, 0], [200, 0.5], [1000, 0], [2000, 0.5], [4000, 1.5], [6000, 2.5], [8000, 3], [10000, 2.5], [12000, 1], [15000, -1.5], [18000, -4.5], [20000, -8]],
    prox: 10, offAxis: -5, sens: 7, color: '#c3c0b6',
    look: { shape: 'ldc', w: 42, h: 98, hh: 42, head: 'round', bw1: 42, color: '#c3c0b6', finish: 'satin', grille: '#a19d93', badge: 'circle', badgeColor: '#2a2a2a', badgeOnGrille: true, base: '#7a776f' },
  },

  // ------------------------------------------------------------------ ribbons
  {
    id: 'r10', name: 'Burbank 10', brand: 'Royer', ref: 'Royer R-10', type: R, pattern: 'figure8',
    desc: 'The stage-proof little brother: warm and smooth with a hint more edge.',
    resp: [[20, -8], [30, -4], [50, -1.5], [100, 0], [1000, 0], [2000, 0], [3500, -0.5], [5000, -1.5], [7000, -3], [9000, -5], [11000, -7.5], [13000, -10], [15000, -14], [20000, -24]],
    prox: 14, offAxis: -10, sens: -3, color: '#1f2022',
    look: { shape: 'pill', w: 30, h: 86, gTop: 5, gBot: 54, color: '#1f2022', grille: '#3b3c3f', badge: 'BB 10', band: '#8a8d92' },
  },
  {
    id: 'c4038', name: 'London Ribbon 38', brand: 'Coles', ref: 'Coles 4038', type: R, pattern: 'figure8',
    desc: 'Broadcast ribbon from the 50s: big, natural lows and a gently fading top. Vintage and smooth.',
    resp: [[20, -4], [30, -2], [50, 0], [100, 0.5], [1000, 0], [3000, -0.5], [6000, -1.5], [8000, -3], [10000, -5], [12000, -9], [14000, -14], [16000, -20], [20000, -30]],
    prox: 16, offAxis: -10, sens: -8, color: '#8d9094',
    look: { shape: 'coles', color: '#8d9094', mesh: '#5c5f63' },
  },
  {
    id: 'rca44', name: 'Camden 44', brand: 'RCA', ref: 'RCA 44-BX', type: R, pattern: 'figure8',
    desc: 'The 1930s icon: dark, huge and creamy. Rolled-off highs make fizzy amps sound vintage.',
    resp: [[20, -3], [40, 0], [80, 1], [200, 0.5], [1000, 0], [2000, -1], [3500, -2.5], [5000, -4.5], [7000, -7], [9000, -10], [11000, -13], [13000, -17], [16000, -22], [20000, -30]],
    prox: 16, offAxis: -11, sens: -7, color: '#2d2e30',
    look: { shape: 'lozenge', color: '#2d2e30', band: '#c7cacd' },
  },
  {
    id: 'rca77', name: 'Camden 77', brand: 'RCA', ref: 'RCA 77-DX', type: R, pattern: 'figure8',
    desc: 'The capsule-shaped vintage ribbon: warm and rich, slightly clearer than the 44.',
    resp: [[20, -5], [40, -1], [80, 0.5], [200, 0.5], [1000, 0], [2000, -0.5], [3500, -1.5], [5000, -3], [7000, -5], [9000, -8], [11000, -11], [14000, -16], [20000, -26]],
    prox: 15, offAxis: -10, sens: -7, color: '#b8babd',
    look: { shape: 'capsule', color: '#b8babd', grille: '#2b2c2f' },
  },
  {
    id: 'm130', name: 'Heilbronn Ribbon 130', brand: 'Beyerdynamic', ref: 'Beyerdynamic M 130', type: R, pattern: 'figure8',
    desc: 'Tiny figure 8 double ribbon: open and detailed for a ribbon, with a round low end.',
    resp: [[20, -10], [40, -4], [70, -1], [120, 0], [1000, 0], [2000, 0.5], [4000, 1], [6000, 0.5], [8000, -1], [10000, -3], [12000, -5], [15000, -9], [18000, -13], [20000, -17]],
    prox: 13, offAxis: -10, sens: -7, color: '#19191a',
    look: { shape: 'stick', head: 'ball', hw: 30, hh: 30, mesh: '#a2a5aa', color: '#19191a', bw0: 18, bw1: 16, bl: 70, ring: '#c3c6ca', badge: 'HB 130' },
  },
  {
    id: 'r92', name: 'Pasadena 92', brand: 'AEA', ref: 'AEA R92', type: R, pattern: 'figure8',
    desc: 'A big ribbon voiced for close cab work: less boom up close, smooth and articulate.',
    resp: [[20, -9], [40, -4], [70, -1.5], [120, -0.5], [300, 0], [1000, 0], [2000, 0], [3500, -0.5], [5000, -1.5], [7000, -3], [9000, -5], [12000, -8], [15000, -12], [20000, -20]],
    prox: 9, offAxis: -10, sens: -4, color: '#1b1b1c',
    look: { shape: 'aea', color: '#1b1b1c', grille: '#3d3e41', band: '#c49a4a' },
  },
  {
    id: 'ksm313', name: 'Niles Ribbon 313', brand: 'Shure', ref: 'Shure KSM313', type: R, pattern: 'figure8',
    desc: 'Two-faced ribbon, used on its warm side: smooth, fat and forgiving.',
    resp: [[20, -5], [30, -2], [60, 0], [150, 0.5], [1000, 0], [2000, -0.5], [4000, -2], [6000, -3.5], [8000, -5.5], [10000, -8], [12000, -10.5], [15000, -15], [20000, -24]],
    prox: 14, offAxis: -10, sens: -6, color: '#202022',
    look: { shape: 'pill', w: 34, h: 96, gTop: 8, gBot: 62, color: '#202022', grille: '#8d9095', badge: 'NR 313', front: '#c4262e', square: true },
  },

  {
    id: 'fathead', name: 'Cascadia Fat Ribbon', brand: 'Cascade', ref: 'Cascade Fat Head', type: R, pattern: 'figure8',
    desc: 'The budget ribbon with the brass grille: warm, a little woolly, smooths out any harsh amp.',
    resp: [[20, -6], [40, -2], [80, 0], [1000, 0], [2000, -0.5], [3500, -1], [5000, -2], [7000, -4], [9000, -6.5], [11000, -9], [14000, -13], [17000, -18], [20000, -24]],
    prox: 15, offAxis: -10, sens: -6, color: '#1a1a1b',
    look: { shape: 'pill', w: 30, h: 100, gTop: 6, gBot: 70, color: '#1a1a1b', grille: '#b08a3e', band: '#b08a3e', badge: 'CFR' },
  },

  // ------------------------------------------------------------------ Tone Zone originals
  {
    id: 'tz-hornet', name: 'TZ Hornet', original: true, type: D, pattern: 'supercardioid',
    desc: 'A Tone Zone original for heavy rhythm: tight lows, a 1.5 kHz push and a firm 4 kHz edge.',
    resp: [[20, -18], [40, -10], [70, -5], [120, -2], [250, 0], [600, 0], [1000, 0], [1500, 1.5], [2200, 1], [3200, 2.5], [4200, 4.5], [5500, 3], [7000, 0.5], [9000, -2], [12000, -6], [15000, -12], [20000, -24]],
    prox: 7, offAxis: -7, sens: 1, color: '#e2ad1a',
    look: { shape: 'stick', head: 'hex', hw: 28, hh: 28, mesh: '#18181a', color: '#e2ad1a', bw0: 24, bw1: 18, bl: 70, ring: '#18181a', stripes: true, badge: 'TZ' },
  },
  {
    id: 'tz-velvet', name: 'TZ Velvet', original: true, type: R, pattern: 'figure8',
    desc: 'A Tone Zone original active ribbon: dark and velvety with less boom up close, made to tame bright amps.',
    resp: [[20, -10], [40, -4], [70, -1.5], [150, 0], [1000, 0], [2000, -0.5], [3000, -1.5], [4500, -3], [6000, -5], [8000, -7.5], [10000, -10], [13000, -14], [16000, -19], [20000, -27]],
    prox: 8, offAxis: -10, sens: 2, color: '#6e1f2a',
    look: { shape: 'pill', w: 32, h: 100, gTop: 6, gBot: 66, color: '#6e1f2a', grille: '#2a1418', band: '#c9a45a', badge: 'TZ', slots: true },
  },
  {
    id: 'tz-prism', name: 'TZ Prism', original: true, type: C, pattern: 'cardioid',
    desc: 'A Tone Zone original condenser: open air up top with the harsh 2 to 3 kHz band smoothed down.',
    resp: [[20, -4], [40, -1], [80, 0], [1000, 0], [1600, -0.5], [2500, -2], [3500, -1.5], [5000, 0.5], [7000, 2], [9000, 3], [12000, 3.5], [15000, 2], [18000, -1], [20000, -4]],
    prox: 10, offAxis: -5, sens: 10, color: '#1f6f73',
    look: { shape: 'ldc', w: 36, h: 110, hh: 44, head: 'facet', bw1: 30, color: '#1f6f73', grille: '#2b4446', trim: '#f0c419', badge: 'text', badgeText: 'TZ' },
  },
  {
    id: 'tz-orb', name: 'TZ Room Orb', original: true, type: C, pattern: 'omni',
    desc: 'A Tone Zone original omni ball: no proximity, even all round. Pull it back for room sound.',
    resp: [[20, 0], [40, 0], [80, 0], [1000, 0], [3000, 0], [6000, 0.5], [9000, 1], [12000, 1.5], [15000, 2], [18000, 0.5], [20000, -1.5]],
    prox: 0, offAxis: -1.5, sens: 8, color: '#e8742a',
    look: { shape: 'orb', color: '#e8742a', mesh: '#b9bcc0', stalk: '#2c2d30' },
  },
];
