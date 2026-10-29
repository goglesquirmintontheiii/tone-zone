// Built-in Tone Zone plugin: Mooer.
// Blocks inspired by Mooer gear. Names, logos and artwork are Tone Zone originals; control layouts and
// colours follow the real units (see each block's `ref`).
import { registerGE300 } from './ge300.js';

export default function register(tz) {
  const { K, SEL, TOG, BTN, FOOT, LED, SLIDER, SCREEN, TREADLE, MIC, def, ten, pct, db, ms, MONO, STEREO, MONO_TO_ST, STD } = tz.helpers;
  const { lvl, tone, gain, onFoot, onLed, k, AMP, CAB, preampOf, stomp } = tz.builders;
  // ---- Micro Preamp enclosure: tiny brushed box, 5 small knobs, channel + cab toggles, one footswitch
  tz.addForm('mooer-micro', (ctx, d) => {
    const { svg, label, formKit } = tz.gfx;
    const g = ctx.g, w = 100, h = 196, txt = d.text || '#151515';
    formKit.body(g, w, h, d.color || '#cfd2d6', { rx: 7, brushed: true });
    svg('rect', { x: 6, y: 6, width: w - 12, height: 134, rx: 5, fill: d.accent || '#1a1a1a', opacity: 0.9 }, g);
    const kn = d.controls.filter((c) => c.t === 'knob');
    const pos = [[22, 30], [50, 30], [78, 30], [33, 70], [67, 70]];
    kn.forEach((c, i) => Object.assign(c, { x: pos[i][0], y: pos[i][1], r: 8.5, labelPos: 'below', labelSize: 4.6 }));
    const tg = d.controls.filter((c) => c.t === 'toggle');
    tg.forEach((t, i) => Object.assign(t, { x: [28, 72][i], y: 122, orient: 'h', optSize: 3.8 }));
    label(g, w / 2, 146, d.logo || d.name, { size: 9.5, fill: txt, font: "'Oswald', sans-serif", weight: 700, ls: 0.8 });
    label(g, w / 2, 156, d.tagline || 'MICRO PRE', { size: 4.6, fill: txt, weight: 700, ls: 1.6, opacity: 0.75 });
    d.controls.forEach((c) => {
      if (c.t === 'led') Object.assign(c, { x: w / 2, y: 112, r: 2.6 });
      if (c.t === 'foot') Object.assign(c, { style: 'stomp', x: w / 2, y: 176, r: 11 });
    });
    const theme = { text: '#e8e8e8', knob: 'white', labelSize: 4.6 };
    formKit.placeControls(ctx, d.controls, theme);
    return { w, h, theme: Object.assign({}, theme, { text: txt }), jacks: formKit.jacksSide(d, w, { y0: 176, gap: 26, flip: ctx.flip }) };
  });
  // two-channel preamp (NORMAL / DRIVE) + speaker sim, as in the real Micro Preamps
  const MICRO = (o) => def(Object.assign({ form: 'mooer-micro', cat: 'Preamp', kind: 'Preamp', typeName: 'Micro preamp', algo: 'chain', cost: 3.2, ports: { ins: ['INPUT'], outs: ['OUTPUT'] } }, o, {
    opts: { chain: [{ prefix: 'a', algo: 'amp', opts: { preamp: true, models: o.models } }, { prefix: 'c', algo: 'cab', opts: { cab: o.cab } }] },
    controls: [K('a.level', 'VOLUME', { min: -24, max: 12, def: -5, display: db }), K('a.gain', 'GAIN', { def: 0.55 }), K('a.treble', 'TREBLE'), K('a.mid', 'MIDDLE'), K('a.bass', 'BASS'),
      TOG('a.channel', 'CHANNEL', ['NORMAL', 'DRIVE'], { def: 1 }), TOG('c.on', 'CAB', ['OFF', 'ON'], { def: 1 }), LED({ color: '#3d8bff' }), FOOT()],
    initParams: { 'c.m1on': 1, 'c.m1pos': 0.35, 'c.m1dist': 0.15 },
  }));
  const v30 = { hp: 75, hpQ: 1.7, resDb: 5, lp: 5600, peaks: [[110, 1, 2], [1500, 1.2, 2.5], [2900, 1.6, 5], [4600, 2.5, 3]], seed: 201 };
  const gb = { hp: 78, hpQ: 1.6, resDb: 5, lp: 5000, peaks: [[120, 1, 2], [800, 0.9, 1.5], [1900, 1.3, 3], [3200, 1.8, 2]], seed: 202 };
  const open12 = { hp: 95, hpQ: 1.0, resDb: 2, lp: 6300, open: true, peaks: [[1000, 1, 1], [2600, 1.4, 3.5], [4600, 2, 2]], seed: 203 };
  tz.addDefs([
    MICRO({ id: 'mooer.micro-001', name: 'Micro Pre 001 Fuel Stop', ref: 'Mooer Micro Preamp 001 Gas Station (Diezel Herbert)', logo: 'FUEL STOP', tagline: 'MICRO PRE 001', color: '#c9ccd0', accent: '#1d1d1f',
      models: [{ base: 'recto_clean', stack: 'mesa', drive: 0.9 }, { base: 'vh4', drive: 1.05, tight: 0.7 }], cab: v30 }),
    MICRO({ id: 'mooer.micro-002', name: 'Micro Pre 002 Brit Gold 900', ref: 'Mooer Micro Preamp 002 UK Gold 900 (Marshall JCM900)', logo: 'BRIT GOLD 900', tagline: 'MICRO PRE 002', color: '#c9a64e', accent: '#1d1d1f',
      models: [{ base: 'jcm800', stages: [[40, 1.6, 0.25, 12000, 40], [30, 1.5, 0.3, 9000, 80]], tsPos: 2 }, { base: 'slo', stack: 'marshall', tight: 0.25 }], cab: gb }),
    MICRO({ id: 'mooer.micro-003', name: 'Micro Pre 003 Power Orb', ref: 'Mooer Micro Preamp 003 Power-Zone (ENGL Powerball)', logo: 'POWER ORB', tagline: 'MICRO PRE 003', color: '#2b5fa8', text: '#f2f2f2', accent: '#101820',
      models: [{ base: 'recto_clean', stack: 'mesa' }, { base: 'vh4', drive: 1.1, tight: 0.75 }], cab: v30 }),
    MICRO({ id: 'mooer.micro-005', name: 'Micro Pre 005 Brown Tone 3', ref: 'Mooer Micro Preamp 005 Brown Sound 3 (EVH 5150 III)', logo: 'BROWN TONE 3', tagline: 'MICRO PRE 005', color: '#6b4a2e', text: '#f2e6d0', accent: '#1d1d1f',
      models: [{ base: 'twin', stack: 'peavey' }, { base: '5150', drive: 1.05, tight: 0.55 }], cab: v30 }),
    MICRO({ id: 'mooer.micro-008', name: 'Micro Pre 008 Cali Twin Rect', ref: 'Mooer Micro Preamp 008 Cali-Dual (Mesa Dual Rectifier)', logo: 'CALI TWIN', tagline: 'MICRO PRE 008', color: '#a7acb2', accent: '#1d1d1f',
      models: ['recto_clean', 'recto'], cab: v30 }),
    MICRO({ id: 'mooer.micro-010', name: 'Micro Pre 010 Two Stones', ref: 'Mooer Micro Preamp 010 Two Stone (Two-Rock)', logo: 'TWO STONES', tagline: 'MICRO PRE 010', color: '#e3ddcc', accent: '#1d1d1f',
      models: [{ base: 'twin', brightDb: 5 }, { base: 'dumble' }], cab: open12 }),
  ]);
  registerGE300(tz);
}
