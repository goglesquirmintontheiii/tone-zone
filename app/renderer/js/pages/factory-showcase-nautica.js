// Pedal Factory template: the Nautica XL, the flagship floor processor rebuilt as a factory design (the block in the
// pedal list is the native one, catalog/nautica.js; docs/nautica-xl.md has its structure). Same layout as the board
// unit scaled to the factory's 360 mm: the touch screen, two strips, the portrait side screen, footswitch and treadle
// displays, I/O bar LEDs, 14 + 2 + 2 footswitches, two treadles, ten dials, three volume dials and the shortcut
// buttons. One circuit plays two paths of eight blocks with four effects loops; the screens run in Lua
// (factory-nautica-scripts.js) and drive the circuit through their outputs.
import { circuit, knobMap, binMap, finish, screen, uid } from './factory-showcase-kit.js';
import { nxLib, MAIN_SCRIPT, SIDE_SCRIPT, stripScript, fsLcdScript, expLcdScript, ioScript } from './factory-nautica-scripts.js';

const K = 360 / 1260; // native board units -> mm
const u = (v) => Math.round(v * K * 100) / 100;
const RES = 3.5; // screen pixels per mm: the scripts keep the native unit's coordinates
const btn = (x, y, label, o = {}) => ({ id: uid('b'), kind: 'button', x, y, r: 4, shape: 'rect', w: 11.4, h: 3.4, color: '#2a2f37', led: false, ledColor: '#2ee6d6', on: false, label, labelPos: 'below', ...o });
const tread = (x, y, w, h, label, o = {}) => ({ id: uid('p'), kind: 'pedal', x, y, w, h, value: 0.5, color: '#15181d', logo: label, logoColor: '#7c8697', label, labelPos: 'none', ...o });
const lua = (v) => (typeof v === 'string' ? JSON.stringify(v) : typeof v === 'boolean' ? String(v) : Array.isArray(v) ? '{' + v.map(lua).join(', ') + '}' : v && typeof v === 'object'
  ? '{' + Object.entries(v).map(([k, x]) => (/^[a-z_][a-z0-9_]*$/i.test(k) ? k : '[' + (/^\d+$/.test(k) ? k : JSON.stringify(k)) + ']') + ' = ' + lua(x)).join(', ') + '}'
  : String(Math.round(v * 10000) / 10000));

const DLY = ['Clean Digital', 'Bucket Analog', 'Tape Echo', 'Lo-Fi Echo', 'Mod Echo', 'Reverse', 'Shimmer Echo', 'Ping Pong', 'Dual Tap', 'Warp Echo', 'Echo Verb'];
const DLY_S = ['DIGITAL', 'ANALOG', 'TAPE', 'LO-FI', 'MOD DLY', 'REVERSE', 'SHIM DLY', 'PINGPONG', 'DUAL', 'WARP', 'ECHOVERB'];
const REV = ['Small Room', 'Concert Hall', 'Bright Plate', 'Spring Tank', 'Shimmer', 'Cloud', 'Mod Verb', 'Ducking Verb', 'Verb + Delay', 'Swell Verb'];
const REV_S = ['ROOM', 'HALL', 'PLATE', 'SPRING', 'SHIMMER', 'CLOUD', 'MODVERB', 'DUCKING', 'VRB+DLY', 'SWELL'];
const SYN = ['SQUARE', 'SAW', 'ORGAN', 'STRINGS', 'BRASS', 'SUB BASS', 'PAD', 'SWEEP'];

/** h = the factory's template helpers: { base, txt, knob, stomp, led, jack, art, toggle, FONTS }. */
export function nauticaTemplates(h) {
  const { base, txt, knob, stomp, led, jack, art, FONTS } = h;
  return [{
    id: 'nautica', name: 'Nautica XL', desc: 'Flagship floor processor: 2 x 8 blocks, 4 FX loops, touch screens',
    make: () => {
      // ---------------------------------------------------------------- the circuit
      const c = circuit('Nautica core');
      const nIn = (name, y) => c.node('in', 40, y, { name });
      const nOut = (name, y) => c.node('out', 2600, y, { name });
      const gin = nIn('GUITAR', 60), ain = nIn('AUX', 260), rin = [1, 2, 3, 4].map((k) => nIn('RETURN ' + k, 400 + k * 80));
      const P = {};
      const part = (k, t, x, y, p) => (P[k] = c.part(t, x, y, p));
      let x = 140;
      const row = (list, y) => list.map(([k, t, p]) => part(k, t, (x += 120), y, p));
      row([['gtrg', 'level', { level: 0 }], ['tmute', 'volume', { pos: 1 }], ['gate', 'gate', { threshold: 0.3 }], ['comp', 'comp', { sustain: 0.45 }],
        ['boost', 'boost', { gain: 0.35, level: 0.6 }], ['od', 'overdrive', { gain: 0.4, level: 0.6 }], ['dist', 'distortion', { gain: 0.45, level: 0.5 }], ['fuzz', 'fuzz', { gain: 0.6, level: 0.5 }],
        ['amp', 'amp', { gain: 0.45, level: 0.5 }], ['eq', 'eq', {}]], 40);
      row([['chorus', 'chorus', { mix: 0.4 }], ['phaser', 'phaser', {}], ['trem', 'tremolo', {}], ['delay', 'delay', { mix: 0.2, time: 420, feedback: 0.32 }], ['reverb', 'reverb', { mix: 0.2, decay: 0.5, mode: 1 }]], 40);
      x = 260;
      part('bmix', 'mixer', (x += 120), 700, { g1: 1, g2: 0, g3: 0, g4: 0 });
      row([['pitch', 'pitch', { semis1: -12, level1: 0.8, dry: 1 }], ['wah', 'wah', { mode: 0 }], ['synth', 'synth', { mode: 6, dry: 0.3, wet: 0.7 }], ['flanger', 'flanger', {}], ['delay2', 'delay', { mix: 0.25, time: 330 }]], 700);
      part('omix', 'mixer', (x += 140), 500, { g1: 0, g2: 0.5, g3: 0, g4: 0 });
      part('x1', 'xfade', (x += 120), 500, { mix: 0 });
      part('rmix', 'mixer', (x += 120), 500, { g1: 1, g2: 0, g3: 0, g4: 0 });
      row([['freeze', 'freeze', { mode: 2, mix: 0.5 }], ['volp', 'volume', { pos: 1 }], ['mst', 'level', { level: -2 }], ['vmute', 'volume', { pos: 1 }]], 500);
      part('auxg', 'level', 300, 260, { level: 0 });
      part('sw3', 'switch', 2400, 820, { sel: 0 });
      part('sw4', 'switch', 2400, 900, { sel: 0 });
      part('ph', 'level', 2400, 980, { level: 0 });
      part('xlr', 'level', 2400, 1060, { level: 0 });
      for (const k of ['vs1', 'vs2', 'vs3', 'vs4']) part(k, 'vca', 1500, 1100 + ['vs1', 'vs2', 'vs3', 'vs4'].indexOf(k) * 70, { gain: 0 });
      for (const k of ['chorus', 'phaser', 'trem', 'pitch', 'wah', 'synth', 'flanger', 'freeze', 'boost', 'dist', 'fuzz', 'gate']) P[k].p.on = 0;
      // audio: path A, path B, the A + B mix, the master loop (1), the returns of loops 2 to 4, the outputs, the sends.
      // Every send is taken before any return, so the board runs SEND -> pedals -> RETURN in one audio cycle.
      c.chain([gin, P.gtrg, P.tmute, P.gate, P.comp, P.boost, P.od, P.dist, P.fuzz, P.amp, P.eq, P.chorus, P.phaser, P.trem, P.delay, P.reverb]);
      c.wire(ain, 'out', P.auxg, 'in');
      c.wire(P.reverb, 'out', P.bmix, 'in1');
      c.wire(P.comp, 'out', P.bmix, 'in2');
      c.wire(P.auxg, 'out', P.bmix, 'in3');
      c.chain([P.bmix, P.pitch, P.wah, P.synth, P.flanger, P.delay2]);
      c.wire(P.reverb, 'out', P.omix, 'in1');
      c.wire(P.delay2, 'out', P.omix, 'in2');
      c.wire(P.omix, 'out', P.x1, 'a');
      c.wire(rin[0], 'out', P.x1, 'b');
      c.wire(P.x1, 'out', P.rmix, 'in1');
      rin.slice(1).forEach((n, i) => c.wire(n, 'out', P.rmix, 'in' + (i + 2)));
      c.chain([P.rmix, P.freeze, P.volp, P.mst, P.vmute]);
      const oMain = nOut('MAIN', 60), o3 = nOut('OUT 3', 820), o4 = nOut('OUT 4', 900), oPh = nOut('PHONES', 980), oXlr = nOut('XLR', 1060);
      const oSend = [1, 2, 3, 4].map((k) => nOut('SEND ' + k, 1100 + k * 70));
      c.wire(P.vmute, 'out', oMain, 'in');
      c.wire(P.reverb, 'out', P.sw3, 'a'); c.wire(P.gtrg, 'out', P.sw3, 'b'); c.wire(P.sw3, 'out', o3, 'in');
      c.wire(P.delay2, 'out', P.sw4, 'a'); c.wire(P.gtrg, 'out', P.sw4, 'b'); c.wire(P.sw4, 'out', o4, 'in');
      c.wire(P.vmute, 'out', P.ph, 'in'); c.wire(P.ph, 'out', oPh, 'in');
      c.wire(P.vmute, 'out', P.xlr, 'in'); c.wire(P.xlr, 'out', oXlr, 'in');
      c.wire(P.omix, 'out', P.vs1, 'in'); c.wire(P.fuzz, 'out', P.vs2, 'in'); c.wire(P.comp, 'out', P.vs3, 'in'); c.wire(P.comp, 'out', P.vs4, 'in');
      ['vs1', 'vs2', 'vs3', 'vs4'].forEach((k, i) => c.wire(P[k], 'out', oSend[i], 'in'));
      // levels for the screens (envelope followers -> circuit outputs)
      const lvl = (name, src) => {
        const e = c.part('env', 1800, 1500 + Object.keys(P).length * 10, { sens: 0, attack: 2, release: 160 });
        c.wire(src, 'out', e, 'in');
        return c.out(name, e);
      };
      const L = {
        gtr: lvl('Lvl gtr', P.gtrg), aux: lvl('Lvl aux', P.auxg), main: lvl('Lvl main', P.vmute), a: lvl('Lvl A', P.reverb), b: lvl('Lvl B', P.delay2),
        o3: lvl('Lvl out 3', P.sw3), o4: lvl('Lvl out 4', P.sw4), ph: lvl('Lvl phones', P.ph), xlr: lvl('Lvl XLR', P.xlr),
        s: ['vs1', 'vs2', 'vs3', 'vs4'].map((k, i) => lvl('Lvl send ' + (i + 1), P[k])), r: rin.map((n, i) => lvl('Lvl return ' + (i + 1), n)),
      };

      // ---------------------------------------------------------------- what the screens drive (bus order)
      // name, default, targets [part, key, {lo, hi, log}], binary
      const g4 = (key, w) => ['boost', 'od', 'dist', 'fuzz'].map((k) => [k, k === 'boost' && key === 'tone' ? 'treble' : key, w]);
      const B = [
        ['Comp on', 1, [['comp', 'on']], 1], ['Gate on', 0, [['gate', 'on']], 1], ['Sustain', 0.45, [['comp', 'sustain']]], ['Comp level', 0.5, [['comp', 'level']]], ['Gate thresh', 0.3, [['gate', 'threshold']]],
        ['Boost on', 0, [['boost', 'on']], 1], ['OD on', 1, [['od', 'on']], 1], ['Dist on', 0, [['dist', 'on']], 1], ['Fuzz on', 0, [['fuzz', 'on']], 1],
        ['Drive gain', 0.4, g4('gain')], ['Drive tone', 0.5, g4('tone')], ['Drive level', 0.6, g4('level')],
        ['Amp on', 1, [['amp', 'on']], 1], ['Amp gain', 0.45, [['amp', 'gain']]], ['Amp bass', 0.5, [['amp', 'bass']]], ['Amp mid', 0.5, [['amp', 'mid']]], ['Amp treble', 0.5, [['amp', 'treble']]], ['Amp level', 0.5, [['amp', 'level']]],
        ['EQ on', 1, [['eq', 'on']], 1], ['EQ low', 0.5, [['eq', 'lowgain', { lo: -15, hi: 15 }]]], ['EQ mid', 0.5, [['eq', 'mid1gain', { lo: -15, hi: 15 }]]], ['EQ high', 0.5, [['eq', 'highgain', { lo: -15, hi: 15 }]]], ['EQ level', 0.5, [['eq', 'level', { lo: -12, hi: 12 }]]],
        ['Loop 1 on', 0, [['vs1', 'gain', { lo: 0, hi: 1 }]], 1], ['Loop 1 mix', 0, [['x1', 'mix']]],
        ['Chorus on', 0, [['chorus', 'on']], 1], ['Phaser on', 0, [['phaser', 'on']], 1], ['Trem on', 0, [['trem', 'on']], 1],
        ['Chorus mode', 0, [['chorus', 'mode', { lo: 0, hi: 3 }]]], ['Trem mode', 0, [['trem', 'mode', { lo: 0, hi: 2 }]]],
        ['Mod rate', 0.35, [['chorus', 'rate'], ['phaser', 'rate'], ['trem', 'rate']]], ['Mod depth', 0.5, [['chorus', 'depth'], ['phaser', 'depth'], ['trem', 'depth']]], ['Mod mix', 0.5, [['chorus', 'mix'], ['phaser', 'mix']]],
        ['Delay on', 1, [['delay', 'on']], 1], ['Delay type', 0, [['delay', 'mode', { lo: 0, hi: 10 }]]], ['Delay time', 0.7, [['delay', 'time', { lo: 20, hi: 2000, log: true }]]], ['Repeats', 0.32, [['delay', 'feedback']]], ['Delay mix', 0.2, [['delay', 'mix']]],
        ['Reverb on', 1, [['reverb', 'on']], 1], ['Reverb type', 1 / 9, [['reverb', 'mode', { lo: 0, hi: 9 }]]], ['Decay', 0.5, [['reverb', 'decay']]], ['Reverb mix', 0.2, [['reverb', 'mix']]],
        ['Pitch on', 0, [['pitch', 'on']], 1], ['Interval', 0.25, [['pitch', 'semis1', { lo: -24, hi: 24 }]]], ['Pitch level', 0.8, [['pitch', 'level1']]], ['Detune', 0.5, [['pitch', 'cents', { lo: -50, hi: 50 }]]],
        ['Filter on', 0, [['wah', 'on']], 1], ['Filter type', 0, [['wah', 'mode', { lo: 0, hi: 2 }]]], ['Wah pos', 0.5, [['wah', 'pos']]], ['Filter Q', 0.55, [['wah', 'q']]], ['Filter rate', 0.4, [['wah', 'rate'], ['wah', 'sens']]],
        ['Synth on', 0, [['synth', 'on']], 1], ['Synth voice', 6 / 7, [['synth', 'mode', { lo: 0, hi: 7 }]]], ['Synth cutoff', 0.5, [['synth', 'filter']]], ['Synth wet', 0.7, [['synth', 'wet']]],
        ['Flanger on', 0, [['flanger', 'on']], 1], ['Flange rate', 0.3, [['flanger', 'speed']]], ['Flange depth', 0.6, [['flanger', 'width']]], ['Flange mix', 0.5, [['flanger', 'mix']]],
        ['Delay 2 on', 0, [['delay2', 'on']], 1], ['Delay 2 type', 0, [['delay2', 'mode', { lo: 0, hi: 10 }]]], ['Delay 2 time', 0.65, [['delay2', 'time', { lo: 20, hi: 2000, log: true }]]], ['Repeats 2', 0.3, [['delay2', 'feedback']]], ['Delay 2 mix', 0.25, [['delay2', 'mix']]],
        ['Loop 2 on', 0, [['rmix', 'g2', { lo: 0, hi: 1 }], ['vs2', 'gain', { lo: 0, hi: 1 }]], 1], ['Loop 3 on', 0, [['rmix', 'g3', { lo: 0, hi: 1 }], ['vs3', 'gain', { lo: 0, hi: 1 }]], 1], ['Loop 4 on', 0, [['rmix', 'g4', { lo: 0, hi: 1 }], ['vs4', 'gain', { lo: 0, hi: 1 }]], 1],
        ['B from A', 1, [['bmix', 'g1', { lo: 0, hi: 1 }]]], ['B from input', 0, [['bmix', 'g2', { lo: 0, hi: 1 }]]], ['B from aux', 0, [['bmix', 'g3', { lo: 0, hi: 1 }]]],
        ['A level', 0, [['omix', 'g1', { lo: 0, hi: 2 }]]], ['B level', 0.5, [['omix', 'g2', { lo: 0, hi: 2 }]]],
        ['Vol pedal', 1, [['volp', 'pos']]], ['Tuner mute', 0, [['tmute', 'pos', { lo: 1, hi: 0 }]], 1], ['Hold', 0, [['freeze', 'on']], 1],
        ['Gtr gain', 24 / 36, [['gtrg', 'level', { lo: -24, hi: 12 }]]], ['Aux gain', 24 / 36, [['auxg', 'level', { lo: -24, hi: 12 }]]],
        ['Out 3 src', 0, [['sw3', 'sel']], 1], ['Out 4 src', 0, [['sw4', 'sel']], 1],
        ['LED LIBRARY', 0, [], 1], ['LED AMP', 0, [], 1], ['LED PRESETS', 0, [], 1], ['LED SCENES', 0, [], 1], ['LED TUNER', 0, [], 1], ['LED ASSIGN', 0, [], 1], ['LED I/O', 0, [], 1], ['LED GLOBAL', 0, [], 1], ['LED MODE', 0.35, []],
      ];
      const OUTDEF = {};
      const port = {};
      for (const [name, def, tg, bin] of B) {
        OUTDEF[name] = def;
        port[name] = { id: uid('p'), name, sig: bin ? 'b' : 'n', def };
        if (tg.length) {
          const t = c.input(name, def, tg.map(([k, key, w]) => [P[k], '@' === key ? key : key, w]), bin ? { bin: true } : {});
          port[name].maps = [{ to: t.to, raw: true }];
        } else port[name].maps = [];
      }
      const BUS = B.map((b) => b[0]);
      const special = ['LED TAP', 'FS out', 'EXP out'].map((name, i) => ({ id: uid('p'), name, sig: i === 2 ? 'n' : 'b', def: i === 2 ? 1 : 0, maps: [] }));
      // the screens' output slices: MAIN 1-13 (+ 3 of its own), then 16 each
      const slice = (a, n) => BUS.slice(a, a + n).map((nm) => port[nm]);
      const mainOuts = [...slice(0, 13), ...special];
      const tgtRange = (name) => {
        const t = B.find((b) => b[0] === name)[2][0];
        return t && t[2] ? t[2] : { lo: 0, hi: 1 };
      };

      // ---------------------------------------------------------------- the block library (fixed block types per slot)
      const kn = (l, o, d, f = 'pct', extra = {}) => {
        const r = tgtRange(o);
        return Object.assign({ l, o, d, f, lo: r.lo, hi: r.hi, lg: !!r.log }, extra);
      };
      const set = (o) => o;
      const SLOTS = [
        { id: 'A1', t: 'DYNAMICS', s: 'DYN', c: '#ffd23f', m: [
          { n: 'Studio Comp', s: 'COMP', on: ['Comp on'], k: [kn('SUSTAIN', 'Sustain', 0.45), kn('LEVEL', 'Comp level', 0.5)] },
          { n: 'Noise Gate', s: 'GATE', on: ['Gate on'], k: [kn('THRESH', 'Gate thresh', 0.3)] },
          { n: 'Gate + Comp', s: 'GATE+CMP', on: ['Comp on', 'Gate on'], k: [kn('SUSTAIN', 'Sustain', 0.45), kn('LEVEL', 'Comp level', 0.5), kn('THRESH', 'Gate thresh', 0.3)] }] },
        { id: 'A2', t: 'DRIVE', s: 'DRV', c: '#ff8a3d', m: [['Clean Lift', 'LIFT', 'Boost on', 0.35], ['Jade Screamer', 'JADE OD', 'OD on', 0.4], ['Rodent Dist', 'RODENT', 'Dist on', 0.45], ['Big Fluff', 'FLUFF', 'Fuzz on', 0.6]]
          .map(([n, s, on, gd]) => ({ n, s, on: [on], k: [kn('GAIN', 'Drive gain', gd), kn('TONE', 'Drive tone', 0.5), kn('LEVEL', 'Drive level', 0.6)] })) },
        { id: 'A3', t: 'AMP', s: 'AMP', c: '#ff4b4b', m: [['Tweed Lux', 'LUX', [0.45, 0.55, 0.5, 0.55, 0.5]], ['Brit 68 Plexi', 'BRIT 68', [0.6, 0.5, 0.65, 0.6, 0.45]], ['Cali Lead', 'CALI', [0.75, 0.6, 0.4, 0.55, 0.4]],
          ['Chime 30', 'CHIME 30', [0.5, 0.45, 0.55, 0.7, 0.5]], ['Silver Clean', 'SILVER', [0.25, 0.5, 0.45, 0.6, 0.55]]]
          .map(([n, s, d]) => ({ n, s, on: ['Amp on'], k: [kn('GAIN', 'Amp gain', d[0]), kn('BASS', 'Amp bass', d[1]), kn('MID', 'Amp mid', d[2]), kn('TREBLE', 'Amp treble', d[3]), kn('LEVEL', 'Amp level', d[4])] })) },
        { id: 'A4', t: 'EQ & CAB', s: 'EQ', c: '#c4ccda', m: [['Studio EQ', 'STUDIO EQ', [0.5, 0.5, 0.5]], ['Cab 4x12', 'CAB 4x12', [0.62, 0.45, 0.33]], ['Cab 1x12 Open', 'CAB 1x12', [0.47, 0.56, 0.42]]]
          .map(([n, s, d]) => ({ n, s, on: ['EQ on'], k: [kn('BASS', 'EQ low', d[0], 'db'), kn('MID', 'EQ mid', d[1], 'db'), kn('TREBLE', 'EQ high', d[2], 'db'), kn('LEVEL', 'EQ level', 0.5, 'db')] })) },
        { id: 'A5', t: 'MODULATION', s: 'MOD', c: '#3fb6ff', m: [
          { n: 'Classic Chorus', s: 'CHORUS', on: ['Chorus on'], set: set({ 'Chorus mode': 0 }), k: [kn('RATE', 'Mod rate', 0.35), kn('DEPTH', 'Mod depth', 0.5), kn('MIX', 'Mod mix', 0.45)] },
          { n: 'Pitch Vibrato', s: 'VIBRATO', on: ['Chorus on'], set: set({ 'Chorus mode': 1 / 3 }), k: [kn('RATE', 'Mod rate', 0.4), kn('DEPTH', 'Mod depth', 0.4), kn('MIX', 'Mod mix', 1)] },
          { n: 'Tri Ensemble', s: 'ENSEMBLE', on: ['Chorus on'], set: set({ 'Chorus mode': 2 / 3 }), k: [kn('RATE', 'Mod rate', 0.25), kn('DEPTH', 'Mod depth', 0.5), kn('MIX', 'Mod mix', 0.5)] },
          { n: 'Script Phase', s: 'PHASER', on: ['Phaser on'], k: [kn('RATE', 'Mod rate', 0.35), kn('DEPTH', 'Mod depth', 0.8), kn('MIX', 'Mod mix', 0.5)] },
          { n: 'Opto Tremolo', s: 'TREMOLO', on: ['Trem on'], set: set({ 'Trem mode': 0 }), k: [kn('RATE', 'Mod rate', 0.45), kn('DEPTH', 'Mod depth', 0.6)] },
          { n: 'Harmonic Trem', s: 'HARM TRM', on: ['Trem on'], set: set({ 'Trem mode': 0.5 }), k: [kn('RATE', 'Mod rate', 0.4), kn('DEPTH', 'Mod depth', 0.6)] }] },
        { id: 'A6', t: 'DELAY', s: 'DLY', c: '#46d36f', m: DLY.map((n, i) => ({ n, s: DLY_S[i], on: ['Delay on'], set: set({ 'Delay type': i / 10 }),
          k: [kn('TIME', 'Delay time', 0.7, 'ms'), kn('REPEATS', 'Repeats', 0.32), kn('MIX', 'Delay mix', 0.2)] })) },
        { id: 'A7', t: 'REVERB', s: 'REV', c: '#a98bff', m: REV.map((n, i) => ({ n, s: REV_S[i], on: ['Reverb on'], set: set({ 'Reverb type': i / 9 }), k: [kn('DECAY', 'Decay', 0.5), kn('MIX', 'Reverb mix', 0.2)] })) },
        { id: 'A8', t: 'FX LOOP 2', s: 'LOOP', c: '#f2f5fa', m: [{ n: 'FX Loop 2 (pre amp)', s: 'LOOP 2', on: ['Loop 2 on'], k: [] }] },
        { id: 'B1', t: 'PITCH', s: 'PITCH', c: '#45e0c8', m: [['Sub Octave', 'OCT DN', 0.25], ['Octave Up', 'OCT UP', 0.75], ['Fifth Up', 'FIFTH', 31 / 48], ['Detune', 'DETUNE', 0.5]]
          .map(([n, s, iv]) => ({ n, s, on: ['Pitch on'], k: [kn('INTERVAL', 'Interval', iv, 'st'), kn('LEVEL', 'Pitch level', 0.8), kn('DETUNE', 'Detune', s === 'DETUNE' ? 0.62 : 0.5, 'ct')] })) },
        { id: 'B2', t: 'FILTER & WAH', s: 'FLT', c: '#ff5fb0', m: [
          { n: 'Classic Wah', s: 'WAH', wah: true, on: ['Filter on'], set: set({ 'Filter type': 0 }), k: [kn('POSITION', 'Wah pos', 0.5), kn('Q', 'Filter Q', 0.55)] },
          { n: 'LFO Filter', s: 'LFO FLT', on: ['Filter on'], set: set({ 'Filter type': 0.5 }), k: [kn('RATE', 'Filter rate', 0.4), kn('Q', 'Filter Q', 0.6)] },
          { n: 'Envelope Wah', s: 'ENV WAH', on: ['Filter on'], set: set({ 'Filter type': 1 }), k: [kn('SENS', 'Filter rate', 0.55), kn('Q', 'Filter Q', 0.6)] }] },
        { id: 'B3', t: 'SYNTH', s: 'SYN', c: '#b8f040', m: SYN.map((s, i) => ({ n: 'Synth ' + s[0] + s.slice(1).toLowerCase(), s, on: ['Synth on'], set: set({ 'Synth voice': i / 7 }), k: [kn('CUTOFF', 'Synth cutoff', 0.5), kn('WET', 'Synth wet', 0.7)] })) },
        { id: 'B4', t: 'FLANGER', s: 'FLG', c: '#7fd0ff', m: [{ n: 'Jet Flanger', s: 'FLANGER', on: ['Flanger on'], k: [kn('RATE', 'Flange rate', 0.3), kn('DEPTH', 'Flange depth', 0.6), kn('MIX', 'Flange mix', 0.5)] }] },
        { id: 'B5', t: 'DELAY 2', s: 'DLY', c: '#46d36f', m: DLY.map((n, i) => ({ n, s: DLY_S[i], on: ['Delay 2 on'], set: set({ 'Delay 2 type': i / 10 }),
          k: [kn('TIME', 'Delay 2 time', 0.65, 'ms'), kn('REPEATS', 'Repeats 2', 0.3), kn('MIX', 'Delay 2 mix', 0.25)] })) },
        { id: 'B6', t: 'FX LOOP 3', s: 'LOOP', c: '#f2f5fa', m: [{ n: 'FX Loop 3', s: 'LOOP 3', on: ['Loop 3 on'], k: [] }] },
        { id: 'B7', t: 'FX LOOP 4', s: 'LOOP', c: '#f2f5fa', m: [{ n: 'FX Loop 4', s: 'LOOP 4', on: ['Loop 4 on'], k: [] }] },
        { id: 'B8', t: 'MASTER LOOP 1', s: 'LOOP', c: '#f2f5fa', m: [{ n: 'FX Loop 1 (master)', s: 'LOOP 1', on: ['Loop 1 on'], k: [kn('MIX', 'Loop 1 mix', 1, 'pct', { g: true })] }] },
      ];
      // factory presets: per slot [model, on, {knob: position}], scene changes {scene: {slot: [on, {knob: pos}]}}
      const S = (m, on = 1, v) => (v ? [m, on, v] : [m, on]);
      const PRE = [
        { name: 'BLUE HORIZON', s: { 1: S(1), 2: S(2, 0), 3: S(5), 4: S(3), 5: S(1, 0), 6: S(3, 1, { 3: 0.18 }), 7: S(2, 1, { 2: 0.2 }) }, sc: { 2: { 5: [1] }, 5: { 6: [1, { 3: 0.35, 2: 0.5 }], 7: [1, { 2: 0.45, 1: 0.75 }] } } },
        { name: 'BRIT STACK', s: { 1: S(2), 2: S(2, 0, { 1: 0.25 }), 3: S(2), 4: S(2), 6: S(2, 1, { 3: 0.16 }), 7: S(3, 1, { 2: 0.16 }) }, sc: { 3: { 2: [1], 6: [1, { 3: 0.28 }] } } },
        { name: 'TIDAL AMBIENT', route: 2, ma: 1, mb: 0.6, s: { 1: S(1), 3: S(1, 1, { 1: 0.35 }), 4: S(3), 5: S(3), 6: S(5, 1, { 3: 0.3, 2: 0.5 }), 7: S(5, 1, { 2: 0.35 }), 13: S(6, 1, { 3: 0.5 }), 9: S(2, 1, { 2: 0.3 }) } },
        { name: 'DUAL AMP WALL', route: 2, s: { 3: S(4), 4: S(3), 6: S(8, 1, { 3: 0.18 }), 13: S(1, 1, { 3: 0.15 }), 12: S(1, 0), 7: S(1, 1, { 2: 0.15 }) } },
        { name: 'WAH FUNK', s: { 1: S(1), 3: S(5), 4: S(3), 10: S(1), 5: S(4, 0), 7: S(1, 1, { 2: 0.15 }) }, sc: { 2: { 5: [1] } } },
        { name: 'SKY LEAD', s: { 1: S(3), 2: S(2, 1, { 1: 0.2, 3: 0.72 }), 3: S(3), 4: S(2), 6: S(1, 1, { 3: 0.22 }), 7: S(2, 1, { 2: 0.18 }) }, sc: { 1: { 2: [0] }, 3: { 6: [1, { 3: 0.32 }] } } },
        { name: 'FX LOOP RIG', s: { 2: S(2), 16: S(1), 3: S(2), 4: S(2), 6: S(3, 1, { 3: 0.2 }), 7: S(4, 1, { 2: 0.22 }), 8: S(1, 0) } },
        { name: 'METAL GRID', s: { 1: S(3, 1, { 3: 0.32 }), 2: S(2, 1, { 1: 0.1, 3: 0.78 }), 3: S(3, 1, { 1: 0.85 }), 4: S(2), 7: S(1, 1, { 2: 0.1 }) } },
        { name: 'SURF SPRING', s: { 3: S(5), 4: S(3), 5: S(5, 1, { 1: 0.55 }), 6: S(3, 1, { 3: 0.18 }), 7: S(4, 1, { 2: 0.42 }) }, sc: { 2: { 5: [0] } } },
        { name: 'SYNTH DREAMS', s: { 1: S(1), 11: S(7), 5: S(1, 1, { 3: 0.4 }), 6: S(8, 1, { 3: 0.3 }), 7: S(6, 1, { 2: 0.4 }), 3: S(5, 0), 4: S(1, 0) }, sc: { 2: { 11: [1] } } },
        { name: 'OCTO FUZZ', s: { 9: S(1), 2: S(4), 3: S(2, 1, { 1: 0.35 }), 4: S(2), 12: S(1, 0), 7: S(3, 1, { 2: 0.16 }) }, sc: { 2: { 12: [1] } } },
        { name: 'ACOUSTIC STAGE', route: 3, s: { 1: S(1), 3: S(5, 1, { 1: 0.15 }), 4: S(1, 1, { 1: 0.45, 3: 0.55 }), 7: S(2, 1, { 2: 0.22 }), 13: S(1, 1, { 3: 0.12 }) } },
        { name: 'LOFI TAPE', s: { 3: S(5), 4: S(3), 5: S(1, 1, { 2: 0.7 }), 6: S(4, 1, { 3: 0.28 }), 7: S(6, 1, { 2: 0.3 }) } },
        { name: 'ROTARY ORGAN', s: { 1: S(1), 3: S(1, 1, { 1: 0.5 }), 4: S(3), 5: S(6, 1), 7: S(1, 1, { 2: 0.18 }) } },
      ].map((p) => ({ route: 1, ma: 1, mb: 1, ...p }));
      // Lua knob indices are 1 based (as written above)
      const DATA = [
        'M.SLOTS = ' + lua(SLOTS),
        'M.OUTS = ' + lua(BUS),
        'M.OUTDEF = ' + lua(OUTDEF),
        'M.PAGE_LEDS = ' + lua([['LIBRARY', 'lib'], ['AMP', 'blk'], ['PRESETS', 'pre'], ['SCENES', 'scn'], ['TUNER', 'tun'], ['ASSIGN', 'asg'], ['I/O', 'io'], ['GLOBAL', 'glb']]),
        'M.PRESETS = ' + lua(PRE),
      ].join('\n');

      // ---------------------------------------------------------------- jacks along the rear edge (native order)
      const J = {};
      const JW = 1260;
      const jx = (i, n, gaps) => i; // placeholder (positions computed below)
      void jx;
      const order = [
        ['xlr', 'XLR', 'xlr'], ['phones', 'PHONES', 'phones'], ['o1l', 'OUT 1 L', 'out'], ['o1r', 'OUT 1 R', 'stereo'], ['o2l', 'OUT 2 L', 'out'], ['o2r', 'OUT 2 R', 'stereo'],
        ['o3l', 'OUT 3 L', 'out'], ['o3r', 'OUT 3 R', 'stereo'], ['o4l', 'OUT 4 L', 'out'], ['o4r', 'OUT 4 R', 'stereo'], null,
        ['s1', 'SEND 1', 'out', 1], ['r1', 'RETURN 1', 'in', 1], ['s2', 'SEND 2', 'out', 2], ['r2', 'RETURN 2', 'in', 2], ['s3', 'SEND 3', 'out', 3], ['r3', 'RETURN 3', 'in', 3], ['s4', 'SEND 4', 'out', 4], ['r4', 'RETURN 4', 'in', 4], null,
        ['aux', 'AUX IN', 'in'], ['gtr', 'GUITAR IN', 'in'], null,
        ['xf1', 'EXT FS 1', 'fsw'], ['xf2', 'EXT FS 2', 'fsw'], ['xf3', 'EXT FS 3', 'fsw'], ['xf4', 'EXT FS 4', 'fsw'], ['xe1', 'EXT EXP 1', 'exp'], ['xe2', 'EXT EXP 2', 'exp'], ['xfo', 'FS OUT', 'fsw'], ['xeo', 'EXP OUT', 'exp'],
      ];
      const nj = order.filter(Boolean).length, gaps = order.length - nj;
      const x0 = 30, x1 = JW - 30, gapW = 14, step = (x1 - x0 - gaps * gapW) / (nj - 1);
      let jxx = x0;
      const jxs = {};
      for (const e of order) {
        if (!e) { jxx += gapW; continue; }
        const [k, label, kind, loopN] = e;
        jxs[k] = jxx;
        const o = { label };
        if (loopN) Object.assign(o, { loop: kind === 'out' ? 'send' : 'return', loopN });
        J[k] = jack(kind, 'top', Math.round((jxx / JW) * 10000) / 10000, o);
        jxx += step;
      }
      // EXT FS / EXP jacks into the circuit (so they are control inputs) and the screens
      const dummyB = (name) => binMap(c.input(name, 0, [], { bin: true }));
      const dummyA = (name) => knobMap(c.input(name, 0, []));
      for (const k of ['xf1', 'xf2', 'xf3', 'xf4']) J[k].maps = [dummyB('Jack ' + J[k].label)];
      for (const k of ['xe1', 'xe2']) J[k].maps = [dummyA('Jack ' + J[k].label)];

      // ---------------------------------------------------------------- screens
      const sio = (ins, outs) => ({ ins, outs });
      const fromCv = (name, ref) => ({ id: uid('p'), name, sig: 'n', from: ref });
      const fromJack = (name, k, sig) => ({ id: uid('p'), name, sig, from: { jack: J[k].id } });
      const main = screen(131.4, 67.9, u(560), u(250), 'tft', MAIN_SCRIPT, { res: RES, label: 'MAIN', sio: sio([
        fromJack('EXT FS 1', 'xf1', 'b'), fromJack('EXT FS 2', 'xf2', 'b'), fromJack('EXT FS 3', 'xf3', 'b'), fromJack('EXT FS 4', 'xf4', 'b'), fromJack('EXT EXP 1', 'xe1', 'n'), fromJack('EXT EXP 2', 'xe2', 'n'),
      ], mainOuts) });
      const levelIns = [fromCv('GTR', L.gtr), fromCv('AUX', L.aux), fromCv('MAIN', L.main), fromCv('PATH A', L.a), fromCv('PATH B', L.b), fromCv('SEND 1', L.s[0])];
      const side = screen(237.7, 55.8, u(138), u(306), 'tft', SIDE_SCRIPT, { res: RES, label: 'SIDE', sio: sio([], slice(13, 16)) });
      const strip = (r) => screen(131.4, r === 1 ? 15.4 : 25.4, u(560), u(22), 'tft', stripScript(r), { res: RES, label: 'STRIP ' + r, sio: sio(levelIns.map((p) => ({ ...p, id: uid('p') })), slice(29 + (r - 1) * 16, 16)) });
      // the I/O rail: two halves, a bar under each jack
      const railL = 20, railMid = 630, railR = JW - 20;
      const ioIns = {
        L: [['XLR', L.xlr, ['xlr']], ['PHONES', L.ph, ['phones']], ['MAIN', L.main, ['o1l', 'o1r', 'o2l', 'o2r']], ['OUT 3', L.o3, ['o3l', 'o3r']], ['OUT 4', L.o4, ['o4l', 'o4r']],
          ['SEND 1', L.s[0], ['s1']], ['RETURN 1', L.r[0], ['r1']], ['SEND 2', L.s[1], ['s2']], ['RETURN 2', L.r[1], ['r2']]],
        R: [['SEND 3', L.s[2], ['s3']], ['RETURN 3', L.r[2], ['r3']], ['SEND 4', L.s[3], ['s4']], ['RETURN 4', L.r[3], ['r4']], ['AUX', L.aux, ['aux']], ['GTR', L.gtr, ['gtr']],
          ['EXT FS 1', 'xf1', ['xf1']], ['EXT FS 2', 'xf2', ['xf2']], ['EXT FS 3', 'xf3', ['xf3']], ['EXT FS 4', 'xf4', ['xf4']], ['EXT EXP 1', 'xe1', ['xe1']], ['EXT EXP 2', 'xe2', ['xe2']],
          ['FS OUT', { scr: main.id, o: 14 }, ['xfo']], ['EXP OUT', { scr: main.id, o: 15 }, ['xeo']]],
      };
      const rail = (half, a, b, base) => {
        const ins = [], bars = [];
        const colOf = (k) => (/^x/.test(k) ? '#b58bff' : /^[sr]\d/.test(k) ? '#ffb340' : k === 'gtr' || k === 'aux' ? '#2ee6d6' : '#46d36f');
        ioIns[half].forEach(([name, ref, keys], i) => {
          if (typeof ref === 'string') ins.push(fromJack(name, ref, ref.startsWith('xf') ? 'b' : 'n'));
          else ins.push(fromCv(name, ref));
          for (const k of keys) bars.push({ x: (jxs[k] - a) * K * RES, input: i + 1, col: colOf(k), n: 1 });
        });
        return screen(u((a + b) / 2), 5.4, u(b - a), u(9), 'tft', ioScript(base, bars, (b - a) * K * RES), { res: RES, label: 'I/O ' + half, sio: sio(ins, slice(base, 16)) });
      };
      const ioL = rail('L', railL, railMid, 61), ioR = rail('R', railMid + 16, railR, 77);
      J.xfo.dir = 'out'; J.xfo.from = { scr: main.id, o: 14 };
      J.xeo.dir = 'out'; J.xeo.from = { scr: main.id, o: 15 };
      const fsx = (i) => u(196 + (i % 7) * 113.7), fsy = (i) => (i < 7 ? 140.4 : 170.2);
      const lcds = [...Array(14)].map((_, i) => screen(fsx(i), fsy(i) - 13.4, u(84), u(22), 'tft', fsLcdScript(i + 1), { res: RES, label: 'FS ' + (i + 1) + ' LCD' }));
      lcds.push(screen(u(1010), 45, u(84), u(22), 'tft', fsLcdScript(15), { res: RES, label: 'EXP 1 SW LCD' }), screen(u(1170), 45, u(84), u(22), 'tft', fsLcdScript(16), { res: RES, label: 'EXP 2 SW LCD' }));
      const xlcds = [1, 2].map((i) => screen(u(i === 1 ? 1010 : 1170), 74, u(116), u(24), 'tft', expLcdScript(i), { res: RES, label: 'EXP ' + i + ' LCD' }));

      // ---------------------------------------------------------------- controls
      const dummy = (name) => binMap(c.input(name, 0, [], { bin: true }));
      const feet = [...Array(14)].map((_, i) => stomp(fsx(i), fsy(i), { style: 'soft', r: 4.6, label: 'FS ' + (i + 1), labelPos: 'none', map: dummy('FS ' + (i + 1)) }));
      const dials = [...Array(10)].map((_, i) => knob(u(208 + i * 56), 112.8, String(i + 1), { r: 4, style: 'chrome', labelPos: 'below' }));
      const master = c.input('Master', 0.8, [[P.mst, 'level', { lo: -30, hi: 6 }]]);
      const phones = c.input('Phones', 0.8, [[P.ph, 'level', { lo: -30, hi: 6 }]]);
      const xlrv = c.input('XLR level', 0.8, [[P.xlr, 'level', { lo: -30, hi: 6 }]]);
      const mute = c.input('Mute', 0, [[P.vmute, 'pos', { lo: 1, hi: 0 }]], { bin: true });
      const BTNS = ['LIBRARY', 'AMP', 'PRESETS', 'SCENES', 'HOLD', 'TUNER', 'ASSIGN', 'I/O', 'GLOBAL', 'MUTE'];
      const buttons = BTNS.map((l, i) => btn(u(i % 2 ? 124 : 54), 68 + Math.floor(i / 2) * 9.5, l, { color: l === 'MUTE' ? '#3a2226' : '#2a2f37', map: l === 'MUTE' ? binMap(mute) : dummy(l) }));
      // button LEDs follow the open page (screen outputs)
      const where = (name) => {
        const i = BUS.indexOf(name);
        if (i < 13) return { scr: main.id, o: i };
        const k = Math.floor((i - 13) / 16), o = (i - 13) % 16;
        return { scr: [side, null, null, ioL, ioR][k] ? [side, null, null, ioL, ioR][k].id : null, o, k };
      };
      const stripScreens = [strip(1), strip(2)];
      const scrOf = (name) => {
        const w = where(name);
        if (w.k === 1 || w.k === 2) return { scr: stripScreens[w.k - 1].id, o: w.o };
        return { scr: w.scr, o: w.o };
      };
      const btnLeds = buttons.map((b) => {
        const name = b.label === 'MUTE' ? null : 'LED ' + (b.label === 'HOLD' ? '' : b.label);
        if (b.label === 'MUTE') return led(b.x - 8.6, b.y, '#ff3b30', { r: 0.9, bind: 'ctl:' + b.id });
        if (b.label === 'HOLD') return led(b.x - 8.6, b.y, '#a98bff', { r: 0.9, bind: 'src', src: scrOf('Hold') });
        return led(b.x - 8.6, b.y, '#2ee6d6', { r: 0.9, bind: 'src', src: scrOf(name) });
      });
      const exp1 = tread(u(1010), 132.9, u(112), u(330), 'EXP 1', { value: 1 });
      const exp2 = tread(u(1170), 132.9, u(112), u(330), 'EXP 2', { value: 0 });

      const d = base({
        name: 'Nautica XL',
        desc: 'The flagship floor processor rebuilt in the Pedal Factory: two paths of eight blocks, four FX loops, scenes, presets on file and touch screens.',
        enc: { size: 'custom', w: 360, h: 184, shape: 'box', radius: 5, dots: false, mat: { m: 'metal', s: 'aluminium', f: 'anodized', c: '#1c2026' } },
        labels: { font: FONTS[2][0], size: 1.9, color: '#dfe3ea' },
        title: txt({ id: 'title', text: 'NAUTICA', font: FONTS[1][0], weight: 700, x: 311, y: 21, size: 8.4, color: '#f2f4f7', ls: 2 }),
        sub: txt({ id: 'sub', text: 'XL  FLAGSHIP FLOOR PROCESSOR', font: FONTS[2][0], weight: 800, x: 311, y: 28.5, size: 1.9, color: '#2ee6d6', ls: 0.5, hidden: false }),
        art: [
          art('rect', 180, 5.4, 357, 8, '#0b0d10'),
          art('rect', 180, 63.5, 357, 107, '#2a2f37', { opacity: 0.55 }),
          art('rect', 134, 151, 262, 63, '#14161a'),
          art('rect', 313.5, 132.5, 87, 99, '#0c0d10'),
          art('rect', 134, 118.3, 256, 0.7, '#2ee6d6', { opacity: 0.85 }),
          art('rect', 154.5, 58.5, 219, 101, '#08090c'),
          art('rect', 25.4, 63, 40, 102, '#000000', { opacity: 0.18 }),
          art('rect', 313.5, 34.5, 84, 0.3, '#ffffff', { opacity: 0.12 }),
        ],
        ctls: [
          main, side, ...stripScreens, ioL, ioR, ...lcds, ...xlcds,
          ...dials,
          knob(25.4, 33, 'MASTER', { r: 8, style: 'chrome', value: 0.8, labelPos: 'below', map: knobMap(master) }),
          knob(15.4, 53, 'PHONES', { r: 4, style: 'chrome', value: 0.8, labelPos: 'below', map: knobMap(phones) }),
          knob(35.4, 53, 'XLR', { r: 4, style: 'chrome', value: 0.8, labelPos: 'below', map: knobMap(xlrv) }),
          ...buttons, ...btnLeds,
          ...feet,
          stomp(u(1010), 58.6, { style: 'soft', r: 4.6, label: 'EXP 1 SW', labelPos: 'none', map: dummy('EXP 1 SW') }),
          stomp(u(1170), 58.6, { style: 'soft', r: 4.6, label: 'EXP 2 SW', labelPos: 'none', map: dummy('EXP 2 SW') }),
          stomp(18.3, 140.4, { style: 'soft', r: 4.6, label: 'MODE', labelPos: 'below', map: dummy('MODE') }),
          stomp(18.3, 170.2, { style: 'soft', r: 4.6, label: 'TAP', labelPos: 'below', map: dummy('TAP') }),
          led(28.5, 133.5, '#2ee6d6', { r: 0.9, bind: 'src', src: scrOf('LED MODE') }),
          led(28.5, 163.3, '#ff3b5c', { r: 0.9, bind: 'src', src: { scr: main.id, o: 13 } }),
          exp1, exp2,
        ],
        // inputs first (GUITAR IN is the block's first input), then the rest
        jacks: [J.gtr, J.aux, ...Object.values(J).filter((j) => j !== J.gtr && j !== J.aux), jack('power', 'right', 0.06)],
        files: { 'nx.lua': nxLib(DATA) },
      });
      const out = finish(d, [c.inst]);
      // the pedal's wiring: jacks into the circuit's inputs, its outputs to the jacks
      const C = out.circuit;
      const id = c.inst.id;
      const W = (a, b) => C.wires.push({ id: uid('w'), a, b });
      const J2 = (k) => ({ n: 'jack:' + J[k].id, p: '' }), N2 = (n) => ({ n: id, p: n.id });
      C.wires = [];
      W(J2('gtr'), N2(gin)); W(J2('aux'), N2(ain));
      rin.forEach((n, i) => W(J2('r' + (i + 1)), N2(n)));
      for (const k of ['o1l', 'o1r', 'o2l', 'o2r']) W(N2(oMain), J2(k));
      for (const k of ['o3l', 'o3r']) W(N2(o3), J2(k));
      for (const k of ['o4l', 'o4r']) W(N2(o4), J2(k));
      W(N2(oPh), J2('phones')); W(N2(oXlr), J2('xlr'));
      oSend.forEach((n, i) => W(N2(n), J2('s' + (i + 1))));
      return out;
    },
  }];
}
