// Built-in Tone Zone plugin: BOSS.
// Blocks inspired by BOSS gear. Names, logos and artwork are Tone Zone originals; control layouts and
// colours follow the real units (see each block's `ref`) so moving between the real thing and the virtual one is easy.
export default function register(tz) {
  const { K, SEL, TOG, BTN, FOOT, LED, SLIDER, SCREEN, TREADLE, MIC, def, ten, pct, db, ms, MONO, STEREO, MONO_TO_ST, STD } = tz.helpers;
  const { BOSS, NINE, MXRD, lvl, tone, gain, S, onFoot, onLed, k, AMP, CAB, preampPair, marshallKnobs, fenderKnobs } = tz.builders;
  tz.addDefs([
    BOSS({
      id: 'bx.ds1', name: 'DX-1 Distortion', ref: 'BOSS DS-1', code: 'DX-1', typeName: 'Distortion', cat: 'Distortion', color: '#f07b1e',
      algo: 'drive', opts: { clip: 'diode', preHp: 90, gainMinDb: 8, gainMaxDb: 44, clipLp: 9000, tone: 'blend', blendLp: 650, blendHp: 1150, postLp: 7500, levelMaxDb: 8 },
      controls: [lvl(), tone(), gain('DIST')], cost: 0.6,
    }),
    BOSS({
      id: 'bx.sd1', name: 'SO-1 Super Overdrive', ref: 'BOSS SD-1', code: 'SO-1', typeName: 'Super OverDrive', cat: 'Overdrive', color: '#f5c800',
      algo: 'drive', opts: { clip: 'asym', bias: 0.25, cleanSum: true, clipHp: 720, gainMinDb: 2, gainMaxDb: 38, tone: 'ts', toneLo: 700, postLp: 5600, levelMaxDb: 6 },
      controls: [lvl(), tone(), gain('DRIVE')],
    }),
    BOSS({
      id: 'bx.od3', name: 'OV-3 OverDrive', ref: 'BOSS OD-3', code: 'OV-3', typeName: 'OverDrive', cat: 'Overdrive', color: '#ffd21f',
      algo: 'drive', opts: { clip: 'asym', bias: 0.18, clipHp: 250, gainMinDb: 4, gainMaxDb: 36, tone: 'lp', toneLo: 1500, toneHi: 11000, postLp: 9000, levelMaxDb: 6 },
      controls: [lvl(), tone(), gain('DRIVE')],
    }),
    BOSS({
      id: 'bx.bd2', name: 'BL-2 Blues Drive', ref: 'BOSS BD-2', code: 'BL-2', typeName: 'Blues Drive', cat: 'Overdrive', color: '#2771c0', text: '#111',
      algo: 'drive', opts: { clip: 'jfet', bias: 0.2, preHp: 50, gainMinDb: 0, gainMaxDb: 40, tone: 'tilt', trebleF: 1800, bassF: 160, eqRangeDb: 9, postLp: 9500, levelMaxDb: 8, cleanSum: true, cleanMix: 0.25 },
      controls: [lvl(), tone(), gain('GAIN')],
    }),
    BOSS({
      id: 'bx.ds2', name: 'DX-2 Turbo Distortion', ref: 'BOSS DS-2', code: 'DX-2', typeName: 'Turbo Distortion', cat: 'Distortion', color: '#e8601c',
      algo: 'drive', opts: { clip: 'diode', preHp: 90, gainMinDb: 8, gainMaxDb: 44, tone: 'blend', blendLp: 700, blendHp: 1100, postLp: 7500, levelMaxDb: 8,
        modes: [{}, { gainMaxDb: 50, preEq: [{ type: 'peak', f: 850, q: 0.8, db: 8 }] }] },
      controls: [lvl(), tone(), gain('DIST'), SEL('mode', 'TURBO', ['I', 'II'], { sweep: 70 })],
    }),
    BOSS({
      id: 'bx.mt2', name: 'MX-2 Metal Core', ref: 'BOSS MT-2', code: 'MX-2', typeName: 'Metal Core', cat: 'Distortion', color: '#2a2a2a', text: '#d9d9d9', codeColor: '#e8e8e8',
      algo: 'drive', opts: { clip: 'diode', stages: 2, stage2Db: 14, preHp: 120, gainMinDb: 18, gainMaxDb: 56, tone: 'mt2', eqRangeDb: 15, bassF: 100, trebleF: 3500, midMin: 200, midMax: 5000, postLp: 7000, levelMaxDb: 6 },
      controls: [
        lvl(),
        K('treble', 'HI / LO', { display: (v) => db((v - 0.5) * 30) }), K('bass', 'LOW', { inner: 'treble' }),
        K('mid', 'MID/FRQ', { display: (v) => db((v - 0.5) * 30) }), K('midfreq', 'MID FREQ', { inner: 'mid', display: (v) => Math.round(200 * Math.pow(25, v)) + ' Hz' }),
        gain('DIST'),
      ],
      desc: 'Concentric EQ knobs: outer ring HIGH / MIDDLE, inner cap LOW / MID FREQ.',
    }),
    BOSS({
      id: 'bx.hm2', name: 'HV-2 Heavy Metal', ref: 'BOSS HM-2', code: 'HV-2', typeName: 'Heavy Metal', cat: 'Distortion', color: '#151515', text: '#f28c28', codeColor: '#f28c28', labelText: '#f28c28',
      algo: 'drive', opts: { clip: 'diode', stages: 2, stage2Db: 10, preHp: 60, gainMinDb: 14, gainMaxDb: 50, tone: 'hm2', postLp: 8000, levelMaxDb: -1 },
      fixed: { mid: 0.85 },
      controls: [lvl(), K('bass', 'LOW', { def: 0.5 }), K('treble', 'HIGH', { def: 0.5 }), gain('DIST')],
      desc: 'Max LOW and HIGH for the legendary "chainsaw" tone.',
    }),
    BOSS({
      id: 'bx.fz1w', name: 'FX-1W Fuzz', ref: 'BOSS FZ-1W', code: 'FX-1W', typeName: 'Fuzz', cat: 'Fuzz', color: '#6d6f73', text: '#111',
      algo: 'drive', opts: { clip: 'ge', bias: 0.3, gainMinDb: 12, gainMaxDb: 46, tone: 'lp', toneLo: 1200, toneHi: 9000, postLp: 7000, levelMaxDb: 4,
        modes: [{ clip: 'ge' }, { clip: 'si', gainMaxDb: 50 }] },
      controls: [lvl(), tone(), gain('FUZZ'), SEL('mode', 'MODE', ['VINTAGE', 'MODERN'], { sweep: 70, x: 120, y: 88, r: 7, labelPos: 'none', optSize: 4.6 })],
    }),
    BOSS({
      id: 'bx.ch1', name: 'SC-1 Super Chorus', ref: 'BOSS CH-1', code: 'SC-1', typeName: 'Super Chorus', cat: 'Modulation', color: '#4fb0e0', text: '#111',
      algo: 'chorus', opts: { style: 'bbd', invertR: true }, ports: MONO_TO_ST, stereo: 'fixed',
      controls: [K('mix', 'E.LEVEL', { def: 0.55, display: ten }), K('tone', 'EQ', { display: ten }), K('rate', 'RATE', { def: 0.3, display: ten }), K('depth', 'DEPTH', { def: 0.5, display: ten })],
    }),
    BOSS({
      id: 'bx.ce2w', name: 'CR-2W Chorus', ref: 'BOSS CE-2W', code: 'CR-2W', typeName: 'Chorus', cat: 'Modulation', color: '#6cc0e5', text: '#111',
      algo: 'chorus', opts: { style: 'bbd', invertR: false }, ports: MONO_TO_ST, stereo: 'fixed',
      controls: [K('rate', 'RATE', { def: 0.35 }), K('depth', 'DEPTH', { def: 0.55 }), TOG('mode', '', ['STD', 'CE-1', 'VIB'], { x: 73, y: 86, values: [0, 0, 1], orient: 'h' })],
      derive: (p) => ({ mix: p.mode === 1 ? 0.6 : 0.5, delay: p.mode === 1 ? 0.65 : 0.5 }),
    }),
    BOSS({
      id: 'bx.dc2w', name: 'DM-2W Dimension', ref: 'BOSS DC-2W', code: 'DM-2W', typeName: 'Dimension', cat: 'Modulation', color: '#d9d9d6', text: '#111',
      algo: 'chorus', opts: { style: 'clean', invertR: false }, ports: STEREO, stereo: 'fixed', fixed: { mode: 3, mix: 0.6 },
      controls: [SEL('depth', 'MODE', ['1', '2', '3', '4'], { values: [0.25, 0.45, 0.65, 0.9], sweep: 120, def: 1 }), TOG('rate', '', ['S', 'M'], { x: 112, y: 52, values: [0.3, 0.45], orient: 'h' })],
    }),
    BOSS({
      id: 'bx.vb2w', name: 'VI-2W Vibrato', ref: 'BOSS VB-2W', code: 'VI-2W', typeName: 'Vibrato', cat: 'Modulation', color: '#2a6f9e', text: '#111',
      algo: 'chorus', opts: { style: 'bbd', baseMs: 4, depthMs: 3 }, fixed: { mode: 1 },
      controls: [K('rate', 'RATE', { def: 0.45 }), K('depth', 'DEPTH', { def: 0.5 }), K('delay', 'RISE TIME', { def: 0.3 })],
    }),
    BOSS({
      id: 'bx.tr2', name: 'TM-2 Tremolo', ref: 'BOSS TR-2', code: 'TM-2', typeName: 'Tremolo', cat: 'Modulation', color: '#4baa4e', text: '#111',
      algo: 'tremolo', controls: [K('rate', 'RATE', { def: 0.45 }), K('wave', 'WAVE', { def: 0.25 }), K('depth', 'DEPTH', { def: 0.65 })], stereo: 'both',
    }),
    BOSS({
      id: 'bx.bf3', name: 'FL-3 Flanger', ref: 'BOSS BF-3', code: 'FL-3', typeName: 'Flanger', cat: 'Modulation', color: '#9ea2a8', text: '#111',
      algo: 'flanger', stereo: 'both',
      controls: [
        K('manual', 'MANUAL', { def: 0.5 }), K('regen', 'RES', { inner: 'manual', def: 0.55 }),
        K('width', 'DEPTH', { def: 0.6 }), K('speed', 'RATE', { def: 0.3 }),
        SEL('mode', 'MODE', ['ULTRA', 'STD', 'GATE', 'MOM'], { values: [1, 0, 2, 0], def: 1, sweep: 120 }),
      ],
      momentaryWhen: (p) => p.mode === 3,
    }),
    BOSS({
      id: 'bx.ph3', name: 'PS-3 Phase Shifter', ref: 'BOSS PH-3', code: 'PS-3', typeName: 'Phase Shifter', cat: 'Modulation', color: '#35a9c6', text: '#111',
      algo: 'phaser', controls: [K('rate', 'RATE', { def: 0.35 }), K('depth', 'DEPTH', { def: 0.75 }), K('feedback', 'RES', { def: 0.4 }),
        SEL('stages', 'STAGE', ['4', '8', '10', '12', 'FALL', 'RISE', 'STEP'], { values: [4, 8, 10, 12, 10, 10, 8], def: 0, sweep: 200, optSize: 4.4 })],
    }),
    BOSS({
      id: 'bx.dd3', name: 'DG-3 Digital Delay', ref: 'BOSS DD-3', code: 'DG-3', typeName: 'Digital Delay', cat: 'Delay', color: '#f2f2f0', text: '#111',
      algo: 'delay', opts: { maxMs: 900 }, fixed: { mode: 0, tone: 0.75 },
      controls: [K('mix', 'E.LEVEL', { def: 0.45 }), K('feedback', 'F.BACK', { def: 0.35, max: 0.98 }), K('dtime', 'D.TIME', { def: 0.6, virtual: true }),
        SEL('range', 'MODE', ['S', 'M', 'L', 'HOLD'], { def: 2, sweep: 120 })],
      derive: (p) => {
        const ranges = [[12.5, 50], [50, 200], [200, 800], [200, 800]];
        const r = ranges[p.range ?? 2];
        return { time: r[0] + (r[1] - r[0]) * (p.dtime ?? 0.6) };
      },
      holdWhen: (p) => p.range === 3,
      tapLed: true,
    }),
    BOSS({
      id: 'bx.dd7', name: 'DG-7 Digital Delay', ref: 'BOSS DD-7', code: 'DG-7', typeName: 'Digital Delay', cat: 'Delay', color: '#f2f2f0', text: '#111', stereo: 'both',
      algo: 'delay', opts: { maxMs: 3300 },
      controls: [K('mix', 'E.LEVEL', { def: 0.45 }), K('feedback', 'F.BACK', { def: 0.35, max: 0.98 }), K('dtime', 'D.TIME', { def: 0.5, virtual: true }),
        SEL('dmode', 'MODE', ['50', '200', '800', '3200', 'MOD', 'ANA', 'REV', 'HOLD'], { def: 2, sweep: 230, optSize: 4.3 })],
      derive: (p) => {
        const t = [[1, 50, 0], [50, 200, 0], [200, 800, 0], [800, 3200, 0], [20, 800, 4], [20, 800, 1], [300, 3200, 5], [200, 800, 0]][p.dmode ?? 2];
        return { time: t[0] + (t[1] - t[0]) * (p.dtime ?? 0.5), mode: t[2], tone: t[2] === 1 ? 0.4 : 0.75 };
      },
      tapFoot: true, tapLed: true,
    }),
    BOSS({
      id: 'bx.dd8', name: 'DG-8 Digital Delay', ref: 'BOSS DD-8', code: 'DG-8', typeName: 'Digital Delay', cat: 'Delay', color: '#f4f4f2', text: '#111', stereo: 'both',
      algo: 'delay', opts: { maxMs: 5100 },
      controls: [K('mix', 'E.LEVEL', { def: 0.45 }), K('feedback', 'FEEDBACK', { def: 0.38, max: 0.98 }), K('dtime', 'TIME', { def: 0.45, virtual: true }),
        SEL('dmode', 'MODE', ['STD', 'ANA', 'TAPE', 'WARM', 'REV', '+RV', 'SHIM', 'MOD', 'WARP', 'GLT', 'LOOP'], { def: 0, sweep: 300, optSize: 4.1, labelRadius: 10 })],
      derive: (p) => {
        // [min, max, engine mode, tone]
        const t = [[20, 800, 0, 0.8], [20, 800, 1, 0.45], [20, 800, 2, 0.6], [20, 800, 1, 0.3], [300, 5000, 5, 0.7], [20, 800, 10, 0.7], [200, 800, 6, 0.7], [20, 800, 4, 0.7], [20, 800, 9, 0.6], [10, 400, 3, 0.6], [200, 800, 0, 0.8]][p.dmode ?? 0];
        return { time: t[0] + (t[1] - t[0]) * (p.dtime ?? 0.45), mode: t[2], tone: t[3] };
      },
      tapFoot: true, tapLed: true,
    }),
    BOSS({
      id: 'bx.dm2w', name: 'AD-2W Analog Delay', ref: 'BOSS DM-2W', code: 'AD-2W', typeName: 'Delay', cat: 'Delay', color: '#d81f2a', text: '#111',
      algo: 'delay', opts: { maxMs: 850 }, fixed: { mode: 1, tone: 0.35 },
      controls: [K('dtime', 'REPEAT RATE', { def: 0.45, virtual: true }), K('mix', 'ECHO', { def: 0.45 }), K('feedback', 'INTENSITY', { def: 0.4, max: 1.05 }), TOG('custom', '', ['STD', 'CUSTOM'], { x: 120, y: 88, orient: 'h' })],
      derive: (p) => ({ time: p.custom ? 40 + 760 * (p.dtime ?? 0.45) : 20 + 280 * (p.dtime ?? 0.45) }),
    }),
    BOSS({
      id: 'bx.rv6', name: 'RX-6 Reverb', ref: 'BOSS RV-6', code: 'RX-6', typeName: 'Reverb', cat: 'Reverb', color: '#1f4f8f', text: '#e9eef7', stereo: 'stereo', ports: STEREO,
      algo: 'reverb',
      controls: [K('mix', 'E.LEVEL', { def: 0.4 }), K('tone', 'TONE', { def: 0.55 }), K('decay', 'TIME', { def: 0.5 }),
        SEL('mode', 'MODE', ['MOD', 'SPRING', 'PLATE', 'HALL', 'ROOM', 'DYN', 'SHIM', '+DLY'], { values: [6, 3, 2, 1, 0, 7, 4, 8], def: 3, sweep: 240, optSize: 4.2 })],
    }),
    BOSS({
      id: 'bx.tu3', name: 'TN-3 Chromatic Tuner', ref: 'BOSS TU-3', code: 'TN-3', typeName: 'Chromatic Tuner', cat: 'Utility', color: '#262626', text: '#f0f0f0', codeColor: '#ffffff', noStd: true,
      algo: 'tuner', opts: { mute: 1 }, ports: { ins: ['INPUT'], outs: ['OUTPUT', 'BYPASS'] },
      controls: [SCREEN('tu3', { x: 73, y: 52, w: 112, h: 52 }), BTN('MODE', { x: 22, y: 92, r: 4.5, cycle: 'tunerRange' }), BTN('STREAM/CENT', { x: 124, y: 92, r: 4.5, cycle: 'tunerMode' }), FOOT({ action: 'bypass' })],
      defaultBypass: true, tunerBlock: true,
      desc: 'Pedal engages the tuner (OUTPUT muted). BYPASS jack always passes the signal.',
    }),
    BOSS({
      id: 'bx.ns2', name: 'NR-2 Noise Suppressor', ref: 'BOSS NS-2', code: 'NR-2', typeName: 'Noise Suppressor', cat: 'Dynamics', color: '#f2f2f0', text: '#111',
      algo: 'gate', ports: { ins: ['INPUT', 'RETURN'], outs: ['OUTPUT', 'SEND'] },
      controls: [K('threshold', 'THRESHOLD', { def: 0.4 }), K('decay', 'DECAY', { def: 0.4 }), SEL('mode', 'MODE', ['REDUCTION', 'MUTE'], { sweep: 70, optSize: 4.4 })],
      desc: 'Patch other pedals into SEND/RETURN – detection stays on INPUT, exactly like the real unit.',
    }),
    BOSS({
      id: 'bx.oc5', name: 'OX-5 Octave', ref: 'BOSS OC-5', code: 'OX-5', typeName: 'Octave', cat: 'Pitch', color: '#8a8e93', text: '#111',
      algo: 'pitch', opts: { semis1: -12, semis2: 12 }, fixed: { semis1: -12, quality: 1 },
      controls: [K('dry', 'DIRECT', { def: 0.8 }), K('level2', 'OCT+1', { def: 0, virtual: true }), K('level1', 'OCT-1', { def: 0.6 }), K('range', 'RANGE/OCT-2', { def: 0.5, virtual: true }),
        TOG('vintage', '', ['POLY', 'VINTAGE'], { x: 73, y: 86, orient: 'h' })],
      derive: (p) => (p.vintage ? { semis2: -24, level2: p.range ?? 0.5, tone: 0.5 } : { semis2: 12, level2: p.level2 ?? 0, tone: 0.3 + 0.7 * (p.range ?? 0.5) }),
    }),
    BOSS({
      id: 'bx.ps6', name: 'HP-6 Harmonist', ref: 'BOSS PS-6', code: 'HP-6', typeName: 'Harmonist', cat: 'Pitch', color: '#4a4f9e', text: '#111',
      algo: 'pitch', fixed: { quality: 2 },
      controls: [K('balance', 'BALANCE', { def: 0.5, virtual: true }),
        SEL('semis1', 'SHIFT / KEY', ['-12', '-7', '-5', '-3', '+3', '+4', '+5', '+7', '+12'], { values: [-12, -7, -5, -3, 3, 4, 5, 7, 12], def: 7, sweep: 210, optSize: 4.1 }),
        SEL('key', 'KEY', ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'], { def: 9, sweep: 300, inner: 'semis1', printLabels: false }),
        SEL('psmode', 'MODE', ['HARM', 'SHIFT', 'DET', 'S-BEND'], { def: 0, sweep: 110, optSize: 4 })],
      derive: (p) => {
        const b = p.balance ?? 0.5;
        const r = { dry: Math.min(1, 2 * (1 - b)), level1: Math.min(1, 2 * b), glide: 0.1, scale: 0, level2: 0 };
        // HARMONIST: intelligent diatonic harmony in KEY (major scale); SHIFT picks the scale interval
        if ((p.psmode ?? 0) === 0) {
          const deg = [-7, -4, -3, -2, 2, 2, 3, 4, 7][p.semis1 ?? 7] ?? 4;
          Object.assign(r, { scale: 1, deg1: deg });
        }
        if (p.psmode === 2) Object.assign(r, { semis1: 0, cents: 12, semis2: 0, level2: 0 });
        if (p.psmode === 3) Object.assign(r, { glide: 0.8 });
        return r;
      },
      desc: 'HARM mode: diatonic harmony in the selected KEY (inner knob, major scale) – SHIFT (outer ring) picks the interval. SHIFT mode: fixed pitch shift.',
    }),
    BOSS({
      id: 'bx.aw3', name: 'AF-3 Dynamic Wah', ref: 'BOSS AW-3', code: 'AF-3', typeName: 'Dynamic Wah', cat: 'Filter', color: '#e94b8d', text: '#111',
      algo: 'wah', opts: { mode: 2, q: 5 },
      controls: [K('sens', 'SENS', { def: 0.55 }), K('q', 'DECAY', { def: 0.5 }), K('range', 'MANUAL', { def: 0.5 }), SEL('awmode', 'MODE', ['UP', 'DOWN', 'AUTO'], { sweep: 100 })],
      derive: (p) => ({ mode: p.awmode === 2 ? 1 : 2, direction: p.awmode === 1 ? 1 : 0 }),
    }),
    BOSS({
      id: 'bx.cs3', name: 'CP-3 Compression Sustainer', ref: 'BOSS CS-3', code: 'CP-3', typeName: 'Compression Sustainer', cat: 'Dynamics', color: '#47b2e6', text: '#111',
      algo: 'comp', opts: { type: 'vca' }, fixed: { ratio: 0.6 },
      controls: [lvl(), tone(), K('attack', 'ATTACK', { def: 0.35 }), K('sustain', 'SUSTAIN', { def: 0.55 })],
    }),
    BOSS({
      id: 'bx.ge7', name: 'GQ-7 Graphic Equalizer', ref: 'BOSS GE-7', code: 'GQ-7', typeName: 'Graphic Equalizer', cat: 'EQ', color: '#f2f2f0', text: '#111',
      algo: 'geq', opts: { freqs: [100, 200, 400, 800, 1600, 3200, 6400] },
      controls: [
        ...['100', '200', '400', '800', '1.6k', '3.2k', '6.4k'].map((l, i) => SLIDER('b' + i, l, { min: -15, max: 15, def: 0, display: db })),
        SLIDER('level', 'LEVEL', { min: -15, max: 15, def: 0, display: db }),
      ],
    }),
    def({
      id: 'bx.fv500', name: 'VL-500 Volume', ref: 'BOSS FV-500', brand: 'BOSS', code: 'VL-500', cat: 'Volume', form: 'treadle', color: '#151515', wide: true, algo: 'volume', stereo: 'both',
      controls: [TREADLE('pos', { def: 1 }), K('min', 'MIN VOLUME', { def: 0, x: 168, y: 210, r: 7, labelPos: 'none' })],
      logo: 'VOLUME', logoFont: "'Oswald', sans-serif", logoColor: '#bbb', noBypassClick: true,
    }),
    def({
      id: 'bx.rc500', name: 'LS-500 Looper', ref: 'BOSS RC-500', brand: 'BOSS', code: 'LS-500', cat: 'Looper', form: 'rc500', color: '#c8161d',
      algo: 'looper', opts: { tracks: 2, maxSec: 90 }, stereo: 'both', cost: 0.3,
      controls: [
        SCREEN('looper500', { x: 150, y: 46, w: 128, h: 56 }),
        SLIDER('level1', 'TRACK 1', { x: 30, y: 52, h: 52, def: 0.8 }),
        SLIDER('level2', 'TRACK 2', { x: 60, y: 52, h: 52, def: 0.8 }),
        K('tempo', 'MEMORY/VALUE', { x: 248, y: 40, r: 13, min: 40, max: 250, def: 100, display: (v) => Math.round(v) + ' BPM', labelPos: 'below' }),
        K('rhythmLevel', 'RHYTHM LVL', { x: 248, y: 92, r: 8, def: 0.5, labelPos: 'below' }),
        BTN('TRACK 1', { x: 98, y: 102, shape: 'rect', w: 18, h: 8, event: { type: 6, arg: 0 } }),
        BTN('TRACK 2', { x: 124, y: 102, shape: 'rect', w: 18, h: 8, event: { type: 6, arg: 1 } }),
        BTN('TAP', { x: 166, y: 102, shape: 'rect', w: 18, h: 8, event: { type: 8, arg: 0 } }),
        BTN('RHYTHM', { x: 192, y: 102, shape: 'rect', w: 18, h: 8, event: { type: 7, arg: 0 }, led: true, ledDy: -8, ledColor: '#3ddc84', bind: 'looper:rhythm' }),
        BTN('PATTERN', { x: 218, y: 102, shape: 'rect', w: 18, h: 8, cycle: 'pattern' }),
        FOOT({ style: 'rc', x: 60, y: 196, label: 'REC/PLAY', action: 'event', event: { type: 1, arg: 'current' }, hold: { ms: 1500, event: { type: 4, arg: 'current' } } }),
        FOOT({ style: 'rc', x: 150, y: 196, label: 'STOP', action: 'event', event: { type: 2, arg: 'current' }, hold: { ms: 1500, event: { type: 3, arg: 'current' } } }),
        FOOT({ style: 'rc', x: 240, y: 196, label: 'TRACK SELECT', action: 'trackSelect' }),
        LED({ x: 60, y: 160, r: 3.6, bind: 'looper:track:current' }),
        LED({ x: 150, y: 160, r: 3.6, bind: 'looper:stop' }),
        LED({ x: 240, y: 160, r: 3.6, bind: 'looper:current', color: '#ffffff' }),
      ],
      ports: MONO, loopTracks: 2, alwaysOn: true,
      desc: 'REC/PLAY: record → overdub/play. Hold REC/PLAY = undo/redo, hold STOP = clear. Built-in rhythm.',
    }),
    def({
      id: 'bx.rc600', name: 'LS-600 Looper', ref: 'BOSS RC-600', brand: 'BOSS', code: 'LS-600', cat: 'Looper', form: 'rc600', color: '#d0141c',
      algo: 'looper', opts: { tracks: 6, maxSec: 45 }, stereo: 'both', cost: 0.5,
      controls: [
        SCREEN('looper600', { x: 128, y: 52, w: 210, h: 72 }),
        K('level', 'TRACK LVL', { x: 46, y: 140, r: 9, def: 0.8, virtual: true, labelPos: 'below' }),
        K('rhythmLevel', 'RHYTHM', { x: 92, y: 140, r: 9, def: 0.5, labelPos: 'below' }),
        K('tempo', 'TEMPO', { x: 138, y: 140, r: 9, min: 40, max: 250, def: 100, display: (v) => Math.round(v) + ' BPM', labelPos: 'below' }),
        K('pattern', 'PATTERN', { x: 184, y: 140, r: 9, min: 0, max: 9, def: 0, step: 1, labelPos: 'below' }),
        K('master', 'OUTPUT LEVEL', { x: 230, y: 140, r: 10, def: 0.8, labelPos: 'below' }),
        BTN('RHYTHM', { x: 270, y: 92, shape: 'rect', w: 20, h: 8, event: { type: 7, arg: 0 }, led: true, ledDy: -8, ledColor: '#3ddc84', bind: 'looper:rhythm' }),
        BTN('TAP TEMPO', { x: 300, y: 92, shape: 'rect', w: 20, h: 8, event: { type: 8, arg: 0 } }),
        ...[0, 1, 2].flatMap((i) => [
          FOOT({ style: 'rc', x: 52 + i * 100, y: 212, w: 44, h: 40, label: 'REC/PLAY', action: 'event', event: { type: 1, arg: 'layer+' + i } }),
          FOOT({ style: 'rc', x: 100 + i * 100, y: 212, w: 44, h: 40, label: 'STOP', action: 'event', event: { type: 2, arg: 'layer+' + i }, hold: { ms: 1500, event: { type: 3, arg: 'layer+' + i } } }),
          LED({ x: 52 + i * 100, y: 182, r: 3.4, bind: 'looper:track:layer+' + i }),
          LED({ x: 100 + i * 100, y: 182, r: 3.4, bind: 'looper:stop:layer+' + i }),
        ]),
        FOOT({ style: 'rc', x: 420, y: 132, w: 44, h: 40, label: 'TRACK SELECT', action: 'layerToggle' }),
        FOOT({ style: 'rc', x: 490, y: 132, w: 44, h: 40, label: 'UNDO/REDO', action: 'event', event: { type: 4, arg: 'current' } }),
        FOOT({ style: 'rc', x: 560, y: 132, w: 44, h: 40, label: 'ALL START/STOP', action: 'event', event: { type: 5, arg: 0 } }),
        LED({ x: 420, y: 102, r: 3.4, bind: 'looper:layer' }),
        LED({ x: 490, y: 102, r: 3.4, bind: 'looper:undo' }),
        LED({ x: 560, y: 102, r: 3.4, bind: 'looper:any', color: '#3ddc84' }),
        SCREEN('ring', { x: 520, y: 210, w: 60, h: 60, bg: 'transparent', bezel: 'transparent' }),
      ],
      loopTracks: 6, alwaysOn: true,
      desc: 'Six synchronised tracks. TRACK SELECT switches the bottom row between tracks 1-3 and 4-6. Hold STOP to clear.',
    })
  ]);

  // ================================================================ v0.2 catalog expansion
  const G = tz.gfx;
  // current UI value of a control from inside a screen (block params, falling back to the control default)
  const P = (nv, p) => {
    const v = nv.block.params[p];
    if (v !== undefined) return v;
    const c = nv.def.controls.find((x) => x.p === p && x.t !== 'screen');
    return c ? c.def ?? 0 : nv.def.initParams?.[p] ?? 0;
  };
  const LCD_FONT = "'Share Tech Mono', monospace";
  // small graphic LCD of the 200 / 500 series: line 1 = selected type, line 2 = a live value
  const lcd = {
    override: true,
    build(s, g, w, h, nv) {
      G.svg('rect', { width: w, height: h, rx: 2, fill: s.ctl.lcdBg || '#0b1016' }, g);
      s.l1 = G.label(g, w / 2, h * 0.37, '', { size: s.ctl.size1 || 8.4, fill: s.ctl.lcdFg || '#dcefff', font: LCD_FONT, weight: 400, ls: 0.5 });
      s.l2 = G.label(g, w / 2, h * 0.76, '', { size: 5.6, fill: s.ctl.lcdFg || '#dcefff', font: LCD_FONT, weight: 400, opacity: 0.75, ls: 0.3 });
      s.last = null;
      lcd.update(s, null, nv);
    },
    update(s, st, nv) {
      const c = s.ctl;
      const a = c.names ? c.names[P(nv, c.p) | 0] || '' : c.text || '';
      const b = c.p2 ? c.fmt2(P(nv, c.p2)) : c.sub || '';
      const key = a + '|' + b;
      if (key === s.last) return;
      s.last = key;
      G.setText(s.l1, a);
      G.setText(s.l2, b);
    },
  };
  tz.addScreen('bx-lcd', lcd);

  // LS-2 line selector: which outputs are live for each MODE in footswitch state 0 / 1
  const LS_MODES = ['A/B', 'A/A+B', 'B/A+B', 'A/OFF', 'B/OFF', 'A+B/OFF'];
  const LS_TABLE = [[[1, 0], [0, 1]], [[1, 0], [1, 1]], [[0, 1], [1, 1]], [[1, 0], [0, 0]], [[0, 1], [0, 0]], [[1, 1], [0, 0]]];
  const lsState = (mode, st) => (LS_TABLE[mode] || LS_TABLE[0])[st > 0.5 ? 1 : 0];
  tz.addScreen('bx-ab', {
    override: true,
    build(s, g, w, h) {
      // borderless: hide the screen bezel so the LEDs sit directly on the enclosure
      const bez = g.parentNode && g.parentNode.parentNode && g.parentNode.parentNode.firstChild;
      if (bez && bez.setAttribute) bez.setAttribute('stroke', 'none');
      s.leds = ['A', 'B'].map((t, i) => {
        const x = w * (i ? 0.78 : 0.3);
        G.svg('circle', { cx: x, cy: h / 2, r: 3.9, fill: 'url(#g-chrome)' }, g);
        const l = G.svg('circle', { cx: x, cy: h / 2, r: 2.8, fill: '#3a0c0c' }, g);
        G.svg('circle', { cx: x, cy: h / 2, r: 2.6, fill: 'url(#g-ledLens)' }, g);
        G.label(g, x - 8, h / 2 + 0.3, t, { size: 6, fill: s.ctl.textColor || '#222', weight: 800 });
        return l;
      });
      s.last = null;
    },
    update(s, st, nv) {
      const ab = lsState(P(nv, 'mode') | 0, P(nv, 'st'));
      const key = ab.join('');
      if (key === s.last) return;
      s.last = key;
      G.setA(s.leds[0], 'fill', ab[0] ? '#ff2a1a' : '#3a0c0c');
      G.setA(s.leds[1], 'fill', ab[1] ? '#3ddc84' : '#0c2a16');
    },
  });

  // all jacks (audio + control) along the top edge, like the real 200 / 500-series rear panel
  const topJacks = (d, w, flip) => {
    const short = (l) => l.replace(/^INPUT/, 'IN').replace(/^OUTPUT/, 'OUT').replace(' A (MONO)', ' L').replace(/ B$/, ' R');
    const all = [
      ...d.ports.outs.map((l, i) => ({ key: 'o' + i, dir: 'out', port: i, label: short(l) })),
      ...(d.ctrl?.outs || []).map((c, i) => ({ key: 'oc' + i, dir: 'out', port: 'c' + i, label: c.label, kind: c.kind || 'ctrl' })),
      ...(d.ctrl?.ins || []).map((c, i) => ({ key: 'ic' + i, dir: 'in', port: 'c' + i, label: c.label, kind: c.kind || 'ctrl' })),
      ...d.ports.ins.map((l, i) => ({ key: 'i' + i, dir: 'in', port: i, label: short(l) })),
    ];
    if (flip) all.reverse();
    const n = all.length;
    return all.map((j, k) => Object.assign(j, { side: 'top', y: -2, x: w * (0.14 + 0.72 * (n === 1 ? 0.5 : k / (n - 1))) }));
  };
  // 200-series style enclosure (2 footswitches) and the wide 500-series / RE-202 (3 footswitches):
  // a black control panel (big MODE selector + LCD + knob rows or EQ sliders) above a painted footswitch deck.
  tz.addForm('bx-200', (ctx, d) => {
    const { svg, label, formKit } = G;
    const g = ctx.g;
    const foots = d.controls.filter((c) => c.t === 'foot');
    const nf = foots.length;
    const w = d.bigW || (nf >= 3 ? 270 : 196);
    const col = d.color, txt = d.text || G.textColorFor(col);
    const ptxt = d.panelText || '#ececec';
    const main = d.controls.find((c) => c.main);
    const sliders = d.controls.filter((c) => c.t === 'slider');
    const knobs = d.controls.filter((c) => (c.t === 'knob' || c.t === 'sel') && !c.main);
    const perRow = d.perRow || (w > 200 ? 7 : 5);
    const rows = [];
    for (let i = 0; i < knobs.length; i += perRow) rows.push(knobs.slice(i, i + perRow));
    const ph = sliders.length ? 152 : 84 + Math.max(1, rows.length) * 40;
    const h = ph + 142;
    formKit.body(g, w, h, col, { rx: 9 });
    svg('rect', { x: 7, y: 7, width: w - 14, height: ph, rx: 6, fill: d.panel || '#141516' }, g);
    svg('rect', { x: 7, y: 7, width: w - 14, height: ph * 0.45, rx: 6, fill: '#fff', opacity: 0.04 }, g);
    svg('rect', { x: 7.5, y: 7.5, width: w - 15, height: ph - 1, rx: 5.5, fill: 'none', stroke: d.accent || '#ffffff', 'stroke-opacity': d.accent ? 0.85 : 0.12, 'stroke-width': 1 }, g);
    const theme = { text: ptxt, knob: 'boss', labelSize: 5.8, labelFont: "'Barlow Condensed', sans-serif" };
    if (main) Object.assign(main, { x: 44, y: 54, r: 16, labelPos: 'none', optSize: main.optSize || 4, labelRadius: 6.5, sweep: main.sweep || 300 });
    const scr = d.controls.find((c) => c.t === 'screen');
    if (scr) {
      if (sliders.length || !main) Object.assign(scr, { x: w / 2, y: 28, w: 96, h: 24 });
      else Object.assign(scr, { x: (90 + w - 18) / 2, y: 38, w: w - 18 - 90, h: 32 });
    }
    const btns = d.controls.filter((c) => c.t === 'button');
    btns.forEach((b, i) => Object.assign(b, { x: btns.length === 1 ? (90 + w - 18) / 2 : 100 + (i * (w - 128)) / (btns.length - 1), y: 70, shape: 'rect', w: 16, h: 7 }));
    rows.forEach((r, ri) => {
      formKit.autoRow(r, r.length === 1 ? w / 2 : 28, r.length === 1 ? w / 2 : w - 28, 114 + ri * 40);
      r.forEach((k) => { k.r = 10; k.labelPos = 'above'; if (k.t === 'sel') { k.optSize = k.optSize || 3.8; k.labelRadius = k.labelRadius || 6; } });
    });
    if (sliders.length) {
      formKit.autoRow(sliders, 20, w - 20, 94);
      sliders.forEach((s) => Object.assign(s, { h: 66, w: 6.5, labelSize: 4.8 }));
    }
    const by = 7 + ph;
    label(g, 16, by + 18, d.code, { size: 14, fill: txt, weight: 800, ls: 1.2, anchor: 'start' });
    label(g, w - 16, by + 18, d.typeName || '', { size: 8.5, fill: txt, weight: 700, italic: true, anchor: 'end', font: "'Barlow Condensed', sans-serif" });
    foots.forEach((f, i) => Object.assign(f, { style: 'stomp', r: 13, y: by + 80, x: nf === 1 ? w / 2 : 46 + (i * (w - 92)) / (nf - 1), labelSize: 6 }));
    const leds = d.controls.filter((c) => c.t === 'led');
    leds.forEach((l, i) => Object.assign(l, { r: 2.8, y: by + 48, x: foots[i] ? foots[i].x : w / 2 }));
    formKit.tzBadge(g, w / 2, h - 9, txt, 4.6);
    formKit.placeControls(ctx, d.controls, theme);
    return { w, h, theme: Object.assign({}, theme, { text: txt, jackText: txt }), jacks: topJacks(d, w, ctx.flip) };
  });

  // GT-1 style multi-effects floor unit: panel + display on the left, two switches below, expression pedal on the right
  tz.addForm('bx-gt', (ctx, d) => {
    const { svg, label, formKit } = G;
    const g = ctx.g, w = 330, h = 212;
    formKit.body(g, w, h, d.color, { rx: 12 });
    svg('rect', { x: 8, y: 8, width: 218, height: 108, rx: 7, fill: '#111213' }, g);
    svg('rect', { x: 8.5, y: 8.5, width: 217, height: 107, rx: 6.5, fill: 'none', stroke: '#fff', 'stroke-opacity': 0.12 }, g);
    svg('rect', { x: 232, y: 8, width: 90, height: 196, rx: 9, fill: '#0b0b0c', opacity: 0.75 }, g);
    label(g, 117, 130, d.code, { size: 11, fill: '#f2f2f2', weight: 800, ls: 1.5 });
    label(g, 117, 141, d.typeName || '', { size: 5.6, fill: '#cfcfcf', weight: 700, ls: 1.2 });
    formKit.tzBadge(g, 117, h - 8, '#e8e8e8', 4.4);
    const theme = { text: '#ececec', knob: 'boss', labelSize: 5.8 };
    formKit.placeControls(ctx, d.controls, theme);
    return { w, h, theme: Object.assign({}, theme, { jackText: '#ddd' }), jacks: formKit.jacksSide(d, w, { flip: ctx.flip, y0: 40, gap: 28 }) };
  });

  // shared voicings / helpers
  const VSD1 = { clip: 'asym', bias: 0.25, cleanSum: true, clipHp: 720, gainMinDb: 2, gainMaxDb: 38, tone: 'ts', toneLo: 700, postLp: 5600, levelMaxDb: 6 };
  const VBD2 = { clip: 'jfet', bias: 0.2, preHp: 50, gainMinDb: 0, gainMaxDb: 40, tone: 'tilt', trebleF: 1800, bassF: 160, eqRangeDb: 9, postLp: 9500, levelMaxDb: 8, cleanSum: true, cleanMix: 0.25 };
  const VDS1 = { clip: 'diode', preHp: 90, gainMinDb: 8, gainMaxDb: 44, clipLp: 9000, tone: 'blend', blendLp: 650, blendHp: 1150, postLp: 7500, levelMaxDb: 8 };
  const VMT2 = { clip: 'diode', stages: 2, stage2Db: 14, preHp: 120, gainMinDb: 18, gainMaxDb: 56, tone: 'mt2', eqRangeDb: 15, bassF: 100, trebleF: 3500, midMin: 200, midMax: 5000, postLp: 7000, levelMaxDb: 6 };
  const VHM2 = { clip: 'diode', stages: 2, stage2Db: 10, preHp: 60, gainMinDb: 14, gainMaxDb: 50, tone: 'hm2', postLp: 8000, levelMaxDb: 6 };
  const waza = (o = {}) => TOG('mode', '', ['S', 'C'], Object.assign({ x: 73, y: 86, orient: 'h' }, o));
  const dbK = (p, label, o = {}) => K(p, label, Object.assign({ min: -15, max: 15, def: 0, display: db }, o));
  const tapHold = (label, target) => FOOT({ action: 'tap', label, tapTarget: target, hold: { ms: 800, event: { type: 2, value: 1, arg: 0 }, release: { type: 2, value: 0, arg: 0 } } });
  const quad = (v) => {
    if (v < 0.03) return [-1, 0];
    const x = ((v - 0.03) / 0.97) * 4;
    const q = Math.min(3, Math.floor(x));
    return [q, x - q];
  };
  // Space Echo mode selector: tape heads (bitmask) per position, reverb on/off, echo on/off
  const SE_HEADS = [1, 2, 4, 6, 1, 2, 4, 3, 6, 5, 7, 0];
  const seDerive = (p, modeKey) => {
    const m = p[modeKey] ?? 4;
    const wf = p.wf ?? 0.3;
    return { 'd.heads': SE_HEADS[m] || 4, 'd.on': m < 11 ? 1 : 0, 's.on': m >= 4 ? 1 : 0, 'd.moddepth': wf * 0.6, 'd.modrate': 0.2 + 0.3 * wf, 's.decay': 0.45 };
  };

  tz.addDefs([
    // ---------------------------------------------------------------- Waza Craft compacts
    BOSS({
      id: 'bx.sd1w', name: 'SO-1W Super Overdrive', ref: 'BOSS SD-1W Waza Craft', code: 'SO-1W', typeName: 'Super OverDrive', cat: 'Overdrive', color: '#f5c800',
      algo: 'drive', opts: Object.assign({}, VSD1, { modes: [{}, { gainMaxDb: 42, clipHp: 380, preEq: [{ type: 'ls', f: 180, q: 0.7, db: 3 }], postLp: 7000 }] }),
      controls: [lvl(), tone(), gain('DRIVE'), waza()],
      desc: 'S = the classic asymmetric overdrive, C = fuller low end, more gain and a smoother top.',
    }),
    BOSS({
      id: 'bx.bd2w', name: 'BL-2W Blues Drive', ref: 'BOSS BD-2W Waza Craft', code: 'BL-2W', typeName: 'Blues Driver', cat: 'Overdrive', color: '#2771c0', text: '#111',
      algo: 'drive', opts: Object.assign({}, VBD2, { modes: [{}, { cleanMix: 0.4, bias: 0.12, postLp: 11000, preEq: [{ type: 'peak', f: 700, q: 0.7, db: 2 }] }] }),
      controls: [lvl(), tone(), gain('GAIN'), waza()],
      desc: 'S = standard BD-2, C = more open, dynamic tube-amp feel.',
    }),
    BOSS({
      id: 'bx.ds1w', name: 'DX-1W Distortion', ref: 'BOSS DS-1W Waza Craft', code: 'DX-1W', typeName: 'Distortion', cat: 'Distortion', color: '#f07b1e',
      algo: 'drive', opts: Object.assign({}, VDS1, { modes: [{}, { gainMaxDb: 48, preHp: 55, postEq: [{ type: 'ls', f: 120, q: 0.7, db: 4 }] }] }),
      controls: [tone(), lvl(), gain('DIST'), waza()],
      desc: 'S = classic DS-1, C = thicker low end and more sustain.',
    }),
    BOSS({
      id: 'bx.ds1x', name: 'DX-1X Distortion', ref: 'BOSS DS-1X', code: 'DX-1X', typeName: 'Distortion', cat: 'Distortion', color: '#1c1c1d', text: '#e6e6e6', codeColor: '#e8402e', labelText: '#e8402e',
      algo: 'drive', opts: { clip: 'diode', stages: 2, stage2Db: 8, preHp: 70, gainMinDb: 10, gainMaxDb: 48, tone: 'eq3', bassF: 110, midF: 900, trebleF: 3200, eqRangeDb: 12, postLp: 8500, levelMaxDb: 7 },
      fixed: { mid: 0.5 },
      controls: [lvl(), K('bass', 'LOW'), K('treble', 'HIGH'), gain('DIST')],
    }),
    BOSS({
      id: 'bx.mt2w', name: 'MX-2W Metal Core', ref: 'BOSS MT-2W Waza Craft', code: 'MX-2W', typeName: 'Metal Core', cat: 'Distortion', color: '#2a2a2a', text: '#d9d9d9', codeColor: '#e8e8e8',
      algo: 'drive', opts: Object.assign({}, VMT2, { modes: [{}, { gainMaxDb: 60, preEq: [{ type: 'peak', f: 110, q: 0.8, db: 3 }], postLp: 8000 }] }),
      controls: [
        lvl(),
        K('treble', 'HI / LO', { display: (v) => db((v - 0.5) * 30) }), K('bass', 'LOW', { inner: 'treble' }),
        K('mid', 'MID/FRQ', { display: (v) => db((v - 0.5) * 30) }), K('midfreq', 'MID FREQ', { inner: 'mid', display: (v) => Math.round(200 * Math.pow(25, v)) + ' Hz' }),
        gain('DIST'), waza(),
      ],
      desc: 'Concentric EQ like the MT-2. S = original, C = tighter, more modern high-gain voicing.',
    }),
    BOSS({
      id: 'bx.hm2w', name: 'HV-2W Heavy Metal', ref: 'BOSS HM-2W Waza Craft', code: 'HV-2W', typeName: 'Heavy Metal', cat: 'Distortion', color: '#151515', text: '#f28c28', codeColor: '#f28c28', labelText: '#f28c28',
      algo: 'drive', opts: Object.assign({}, VHM2, { levelMaxDb: -1, modes: [{}, { preEq: [{ type: 'ls', f: 140, q: 0.7, db: 3 }], postLp: 9000, gainMaxDb: 54 }] }),
      fixed: { mid: 0.85 },
      controls: [lvl(), K('bass', 'LOW'), K('treble', 'HIGH'), gain('DIST'), waza()],
      desc: 'Max LOW and HIGH for the chainsaw tone. C mode adds low end and gain.',
    }),
    BOSS({
      id: 'bx.od1x', name: 'OV-1X OverDrive', ref: 'BOSS OD-1X', code: 'OV-1X', typeName: 'OverDrive', cat: 'Overdrive', color: '#232324', text: '#e6e6e6', codeColor: '#f2c230', labelText: '#f2c230',
      algo: 'drive', opts: { clip: 'asym', bias: 0.2, cleanSum: true, cleanMix: 0.15, clipHp: 300, gainMinDb: 3, gainMaxDb: 40, tone: 'eq3', bassF: 120, midF: 800, trebleF: 2800, eqRangeDb: 12, postLp: 9000, levelMaxDb: 7 },
      fixed: { mid: 0.5 },
      controls: [lvl(), K('bass', 'LOW'), K('treble', 'HIGH'), gain('DRIVE')],
    }),
    // ---------------------------------------------------------------- bass drives
    BOSS({
      id: 'bx.bb1x', name: 'BD-1X Bass Driver', ref: 'BOSS BB-1X', code: 'BD-1X', typeName: 'Bass Driver', cat: 'Overdrive', color: '#202022', text: '#e6e6e6', codeColor: '#d23a2f', labelText: '#e6e6e6',
      algo: 'drive', opts: { clip: 'tube', bias: 0.15, preHp: 25, gainMinDb: 2, gainMaxDb: 36, tone: 'eq3', bassF: 90, midF: 600, trebleF: 2500, eqRangeDb: 14, postLp: 8000, levelMaxDb: 7 },
      fixed: { mid: 0.5 }, tags: ['bass'],
      controls: [lvl(), K('blend', 'BLEND', { def: 0.6, display: ten }), K('treble', 'HIGH/LOW'), K('bass', 'LOW', { inner: 'treble' }), gain('DRIVE')],
      desc: 'Bass overdrive with a clean blend. Concentric EQ: outer HIGH, inner LOW.',
    }),
    BOSS({
      id: 'bx.odb3', name: 'BO-3 Bass OverDrive', ref: 'BOSS ODB-3', code: 'BO-3', typeName: 'Bass OverDrive', cat: 'Overdrive', color: '#b9cc2e', text: '#111',
      algo: 'drive', opts: { clip: 'asym', bias: 0.3, preHp: 25, gainMinDb: 8, gainMaxDb: 42, tone: 'eq3', bassF: 80, midF: 700, trebleF: 2500, eqRangeDb: 15, postLp: 7000, levelMaxDb: 7 },
      fixed: { mid: 0.5 }, tags: ['bass'],
      controls: [lvl(), K('blend', 'BALANCE', { def: 0.6, display: ten }), K('treble', 'HI / LO'), K('bass', 'LOW', { inner: 'treble' }), gain('GAIN')],
      desc: 'BALANCE mixes the clean bass with the overdrive. Concentric EQ: outer HIGH, inner LOW.',
    }),
    // ---------------------------------------------------------------- modulation / pitch
    BOSS({
      id: 'bx.ce5', name: 'CR-5 Chorus Ensemble', ref: 'BOSS CE-5', code: 'CR-5', typeName: 'Chorus Ensemble', cat: 'Modulation', color: '#7cc7ea', text: '#111',
      algo: 'chorus', opts: { style: 'bbd', invertR: true }, ports: MONO_TO_ST, stereo: 'fixed',
      controls: [K('mix', 'E.LEVEL', { def: 0.55, display: ten }), K('rate', 'RATE', { def: 0.3, display: ten }), K('depth', 'DEPTH', { def: 0.5, display: ten }), K('tone', 'FILTER', { def: 0.55, display: ten })],
    }),
    BOSS({
      id: 'bx.mo2', name: 'MU-2 Multi Overtone', ref: 'BOSS MO-2', code: 'MU-2', typeName: 'Multi Overtone', cat: 'Pitch', color: '#7a72c9', text: '#111',
      algo: 'chain', cost: 1.1,
      opts: { chain: [{ prefix: 'p', algo: 'pitch', params: { quality: 1, glide: 0.05 } }, { prefix: 'c', algo: 'chorus', params: { mix: 0.3, depth: 0.35, rate: 0.25 } }] },
      controls: [K('el', 'E.LEVEL', { def: 0.6, virtual: true, display: ten }), K('p.dry', 'D.LEVEL', { def: 0.85, display: ten }), K('p.tone', 'TONE', { def: 0.6, display: ten }), SEL('omode', 'MODE', ['1', '2', '3'], { sweep: 90 })],
      derive: (p) => {
        const e = p.el ?? 0.6, m = p.omode ?? 0;
        if (m === 1) return { 'p.semis1': -12, 'p.level1': e, 'p.semis2': -24, 'p.level2': e * 0.45, 'c.on': 0 };
        if (m === 2) return { 'p.semis1': 12, 'p.level1': e * 0.8, 'p.semis2': 19, 'p.level2': e * 0.4, 'c.on': 1 };
        return { 'p.semis1': 12, 'p.level1': e * 0.6, 'p.semis2': -12, 'p.level2': e * 0.7, 'c.on': 1 };
      },
      desc: 'Adds overtones: MODE 1 = octave up + down with shimmer, 2 = sub octaves, 3 = octave + 12th.',
    }),
    // ---------------------------------------------------------------- delays (compact)
    BOSS({
      id: 'bx.dd3t', name: 'DG-3T Digital Delay', ref: 'BOSS DD-3T', code: 'DG-3T', typeName: 'Digital Delay', cat: 'Delay', color: '#f2f2f0', text: '#111',
      algo: 'delay', opts: { maxMs: 900 }, fixed: { mode: 0, tone: 0.75 },
      controls: [K('mix', 'E.LEVEL', { def: 0.45 }), K('feedback', 'F.BACK', { def: 0.35, max: 0.98 }), K('dtime', 'D.TIME', { def: 0.6, virtual: true }),
        SEL('range', 'MODE', ['S', 'M', 'L', 'HOLD'], { def: 2, sweep: 120 })],
      derive: (p) => {
        const r = [[12.5, 50], [50, 200], [200, 800], [200, 800]][p.range ?? 2];
        return { time: r[0] + (r[1] - r[0]) * (p.dtime ?? 0.6) };
      },
      holdWhen: (p) => p.range === 3, tapFoot: true, tapLed: true,
      desc: 'Hold the pedal ~2 s for TEMPO mode, then tap the delay time.',
    }),
    BOSS({
      id: 'bx.re2', name: 'SE-2 Space Echo', ref: 'BOSS RE-2', code: 'SE-2', typeName: 'Space Echo', cat: 'Delay', color: '#4f6a4a', text: '#f0f0ea', codeColor: '#e9e4c9',
      algo: 'chain', cost: 1.5,
      opts: { chain: [{ prefix: 'd', algo: 'delay', opts: { maxMs: 1200, fixedMode: 2 }, params: { tone: 0.5, sat: 0.4, age: 0.3 } }, { prefix: 's', algo: 'reverb', params: { mode: 3, mix: 0.25 } }] },
      controls: [
        K('d.time', 'RATE', { min: 50, max: 1000, def: 330, curve: 'log', display: ms }), K('d.feedback', 'INTENS.', { def: 0.4, max: 1.1 }),
        K('d.mix', 'ECHO', { def: 0.4 }), K('s.mix', 'REVERB', { inner: 'd.mix', def: 0.25 }),
        SEL('semode', 'MODE', ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', 'RV'], { def: 4, sweep: 300 }),
      ],
      initParams: { wf: 0.3 },
      derive: (p) => seDerive(p, 'semode'),
      tapFoot: true, tapLed: true, tapTarget: 'd.time',
      desc: 'Tape echo + spring reverb. MODE 1-4 echo heads, 5-11 echo + reverb, RV reverb only. Inner knob on ECHO VOL = REVERB volume.',
    }),
    // ---------------------------------------------------------------- dynamics / EQ
    BOSS({
      id: 'bx.cp1x', name: 'CX-1X Compressor', ref: 'BOSS CP-1X', code: 'CX-1X', typeName: 'Compressor', cat: 'Dynamics', color: '#2a2b2d', text: '#e6e6e6', codeColor: '#4fb2e8', labelText: '#4fb2e8',
      algo: 'comp', opts: { type: 'vca' }, stereo: 'mono',
      controls: [K('level', 'LEVEL', { def: 0.42, display: ten }), K('attack', 'ATTACK', { def: 0.4, display: ten }), K('ratio', 'RATIO', { def: 0.45, display: ten }), K('sustain', 'COMP', { def: 0.5, display: ten })],
    }),
    BOSS({
      id: 'bx.geb7', name: 'GQ-7B Bass Equalizer', ref: 'BOSS GEB-7', code: 'GQ-7B', typeName: 'Bass Equalizer', cat: 'EQ', color: '#2f6fbe', text: '#111', tags: ['bass'],
      algo: 'geq', opts: { freqs: [50, 120, 400, 500, 800, 4500, 10000] },
      controls: [
        ...['50', '120', '400', '500', '800', '4.5k', '10k'].map((l, i) => SLIDER('b' + i, l, { min: -15, max: 15, def: 0, display: db })),
        SLIDER('level', 'LEVEL', { min: -15, max: 15, def: 0, display: db }),
      ],
    }),
    // ---------------------------------------------------------------- synth / slicer
    BOSS({
      id: 'bx.sy1', name: 'SN-1 Synthesizer', ref: 'BOSS SY-1', code: 'SN-1', typeName: 'Synthesizer', cat: 'Synth', color: '#9fb3c8', text: '#111', cost: 1,
      algo: 'synth', stereo: 'both',
      controls: [K('wet', 'E.LEVEL', { def: 0.7, display: ten }), K('dry', 'DIRECT', { def: 0.4, display: ten }), K('filter', 'TONE/RATE', { def: 0.5, display: ten }),
        SEL('mode', 'TYPE', ['LEAD', 'SAW', 'ORGAN', 'STR', 'BRASS', 'BASS', 'PAD', 'SWEEP'], { def: 0, sweep: 240 })],
    }),
    BOSS({
      id: 'bx.sl2', name: 'SC-2 Slicer', ref: 'BOSS SL-2', code: 'SC-2', typeName: 'Slicer', cat: 'Modulation', color: '#7b2f63', text: '#f2e8ef', stereo: 'both',
      algo: 'slicer',
      controls: [K('level', 'E.LEVEL', { min: -12, max: 6, def: 0, display: db }), K('depth', 'DEPTH', { def: 1, display: ten }), K('time', 'RATE', { min: 60, max: 500, def: 125, invert: true, curve: 'log', display: ms }),
        SEL('pattern', 'PATTERN', ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'], { def: 0, sweep: 300 })],
    }),
    // ---------------------------------------------------------------- reverb / acoustic
    BOSS({
      id: 'bx.frv1', name: "FR-1 '63 Reverb", ref: "BOSS FRV-1 '63 Fender Reverb", code: 'FR-1', typeName: "'63 Reverb", cat: 'Reverb', color: '#4a3322', text: '#efe4cc',
      labelBg: '#e3d7bd', labelText: '#3a2a1a', codeColor: '#3a2a1a',
      algo: 'reverb', opts: { fixedMode: 3 }, fixed: { mode: 3 },
      controls: [K('decay', 'DWELL', { def: 0.5, style: 'fender', display: ten }), K('tone', 'TONE', { def: 0.55, style: 'fender', display: ten }), K('mix', 'MIXER', { def: 0.35, style: 'fender', display: ten })],
      desc: 'Tube spring-reverb tank tone: DWELL drives the springs, MIXER blends them in.',
    }),
    BOSS({
      id: 'bx.ad2', name: 'AP-2 Acoustic Preamp', ref: 'BOSS AD-2', code: 'AP-2', typeName: 'Acoustic Preamp', cat: 'Acoustic', color: '#6e4326', text: '#f2e8da',
      algo: 'acoustic', opts: { mode: 2 }, fixed: { mode: 2, notchdepth: 0.6, comp: 0.2 },
      controls: [K('body', 'RESONANCE', { def: 0.5, display: ten }), K('reverb', 'AMBIENCE', { def: 0.3, display: ten }), K('notch', 'NOTCH', { def: 0, display: ten })],
      desc: 'Piezo preamp: ACOUSTIC RESONANCE restores body, AMBIENCE adds room, NOTCH tames feedback.',
    }),
    BOSS({
      id: 'bx.ac3', name: 'AS-3 Acoustic Simulator', ref: 'BOSS AC-3', code: 'AS-3', typeName: 'Acoustic Simulator', cat: 'Acoustic', color: '#b48a4a', text: '#111',
      algo: 'acoustic', opts: { mode: 0 },
      controls: [K('level', 'LEVEL', { min: -12, max: 12, def: 0, display: db }), K('top', 'TOP', { def: 0.5, display: ten }), K('body', 'BODY', { def: 0.6, display: ten }),
        SEL('acmode', 'MODE', ['STD', 'JMB', 'ENH', 'PZO'], { sweep: 150, optSize: 4 })],
      derive: (p) => {
        const m = p.acmode ?? 0;
        return { type: [0, 1, 0, 0][m], mode: m === 3 ? 1 : 0, presence: m === 2 ? 0.75 : 0.5 };
      },
      desc: 'Electric guitar → acoustic: STANDARD / JUMBO bodies, ENHANCE (brighter attack), PIEZO (for acoustic pickups).',
    }),
    // ---------------------------------------------------------------- wah
    def({
      id: 'bx.pw3', name: 'WW-3 Wah', ref: 'BOSS PW-3', brand: 'BOSS', code: 'WW-3', cat: 'Wah', form: 'treadle', color: '#161617', treadleColor: '#1d1d1f',
      algo: 'wah', opts: { mode: 0, fLo: 380, fHi: 2300, q: 5 },
      controls: [TREADLE('pos', { def: 0.5 }), TOG('wmode', '', ['VINTAGE', 'RICH'], { x: 84, y: 283, orient: 'h', optSize: 4.4 }), LED({ color: '#ff2a1a', r: 2.2, x: 56, y: 283 })],
      derive: (p) => (p.wmode ? { q: 0.62, range: 0.62 } : { q: 0.5, range: 0.5 }),
      logo: 'WAH', logoFont: "'Oswald', sans-serif", logoColor: '#cfcfcf', toeSwitch: true,
      desc: 'VINTAGE = classic sweep, RICH = wider range with a fuller low end. Click the treadle to toggle the toe switch.',
    }),
    // ---------------------------------------------------------------- utilities / control
    BOSS({
      id: 'bx.tu3w', name: 'TN-3W Chromatic Tuner', ref: 'BOSS TU-3W Waza Craft', code: 'TN-3W', typeName: 'Chromatic Tuner', cat: 'Utility', kind: 'Utility', color: '#1d1d1e', text: '#f0f0f0', codeColor: '#ffffff', noStd: true,
      algo: 'tuner', opts: { mute: 1 }, ports: { ins: ['INPUT'], outs: ['OUTPUT', 'BYPASS'] },
      controls: [SCREEN('tu3', { x: 73, y: 52, w: 112, h: 52 }), BTN('MODE', { x: 22, y: 92, r: 4.5, cycle: 'tunerRange' }), BTN('STREAM/CENT', { x: 124, y: 92, r: 4.5, cycle: 'tunerMode' }), FOOT({ action: 'bypass' })],
      defaultBypass: true, tunerBlock: true,
      desc: 'Waza tuner with a premium buffer. Pedal engages the tuner (OUTPUT muted); BYPASS jack always passes the signal.',
    }),
    BOSS({
      id: 'bx.ls2', name: 'LX-2 Line Selector', ref: 'BOSS LS-2', code: 'LX-2', typeName: 'Line Selector', cat: 'Utility', kind: 'Utility', color: '#d9d9d6', text: '#111', noStd: true,
      algo: 'split', ports: { ins: ['INPUT'], outs: ['OUT A', 'OUT B'] }, alwaysOn: true, noBypassClick: true, cost: 0.05,
      controls: [
        K('g1', 'A LEVEL', { min: -30, max: 10, def: 0, display: db }), K('g2', 'B LEVEL', { min: -30, max: 10, def: 0, display: db }),
        SEL('mode', 'MODE', LS_MODES, { def: 0, sweep: 240, optSize: 3.7 }),
        SCREEN('bx-ab', { x: 73, y: 16, w: 46, h: 12, bg: 'transparent', bezel: 'transparent', textColor: '#111' }),
        FOOT({ action: 'toggle', p: 'st' }),
      ],
      initParams: { st: 0 },
      derive: (p) => { const ab = lsState(p.mode ?? 0, p.st ?? 0); return { m1: ab[0] ? 0 : 1, m2: ab[1] ? 0 : 1 }; },
      desc: 'A/B/A+B line selector: each press of the pedal switches between the two states of the selected MODE (e.g. A ↔ B, A ↔ A+B). LEDs show the live outputs.',
    }),
    def({
      id: 'bx.fs6', name: 'FW-6 Dual Footswitch', ref: 'BOSS FS-6', brand: 'BOSS', code: 'FW-6', cat: 'Control', kind: 'Utility', form: 'footswitch', color: '#1e1f21', text: '#e9e9e9', algo: null, logo: 'FW-6', alwaysOn: true,
      ports: { ins: [], outs: [] }, ctrl: { outs: [{ label: 'A', source: 'foot' }, { label: 'B', source: 'foot' }] },
      controls: [FOOT({ action: 'ctrl', idx: 0, label: 'A' }), LED({ bind: 'param:sw1', color: '#ff3020' }), FOOT({ action: 'ctrl', idx: 1, label: 'B' }), LED({ bind: 'param:sw2', color: '#ff3020' }),
        TOG('mode1', 'A', ['MOM', 'LATCH'], { def: 0 }), TOG('mode2', 'B', ['MOM', 'LATCH'], { def: 0 })],
      desc: 'Dual footswitch: patch A / B into CTL, tap tempo or EXT FS jacks. Each switch can be momentary or latching.',
    }),
    def({
      id: 'bx.ev30', name: 'EX-30 Dual Expression', ref: 'BOSS EV-30', brand: 'BOSS', code: 'EX-30', cat: 'Control', kind: 'Utility', form: 'treadle', color: '#1b1b1c', algo: null,
      ports: { ins: [], outs: [] }, ctrl: { outs: [{ label: 'EXP 1', source: 'param:pos' }, { label: 'EXP 2', source: 'param:pos' }] },
      controls: [TREADLE('pos', { def: 0.5, virtual: true })], logo: 'EXPRESSION', logoFont: "'Oswald', sans-serif", logoColor: '#bdbdbd', noBypassClick: true, alwaysOn: true,
      desc: 'Dual-output expression pedal: both EXP outputs follow the treadle – patch them into EXP / CTRL jacks.',
    }),
    def({
      id: 'bx.fv30l', name: 'VL-30L Volume', ref: 'BOSS FV-30L', brand: 'BOSS', code: 'VL-30L', cat: 'Volume', form: 'treadle', color: '#1a1a1b', algo: 'volume',
      controls: [TREADLE('pos', { def: 1 })], logo: 'VOLUME', logoFont: "'Oswald', sans-serif", logoColor: '#bbb', noBypassClick: true,
      desc: 'Compact low-impedance volume pedal (place it after your effects).',
    }),

    // ---------------------------------------------------------------- 200 / 500 series
    def({
      id: 'bx.od200', name: 'OV-200 Hybrid Drive', ref: 'BOSS OD-200', brand: 'BOSS', code: 'OV-200', typeName: 'Hybrid Drive', cat: 'Overdrive', form: 'bx-200', color: '#2a2b2e', text: '#eeeeee', accent: '#d8402c', cost: 0.8,
      algo: 'drive', stereo: 'mono',
      opts: { tone: 'eq3', eqRangeDb: 12, bassF: 110, midF: 800, trebleF: 3000, postLp: 9000, levelMaxDb: 8, gainMinDb: 2,
        modes: [
          { clip: 'clean', gainMinDb: 0, gainMaxDb: 22 },
          { clip: 'ge', bias: 0.1, cleanSum: true, cleanMix: 0.6, clipHp: 400, gainMaxDb: 34 },
          { clip: 'jfet', bias: 0.2, cleanSum: true, cleanMix: 0.25, gainMaxDb: 38 },
          { clip: 'asym', bias: 0.25, cleanSum: true, clipHp: 720, gainMaxDb: 38 },
          { clip: 'ts', cleanSum: true, clipHp: 720, gainMaxDb: 41, postLp: 5200 },
          { clip: 'tube', stages: 2, stage2Db: 6, gainMaxDb: 42 },
          { clip: 'diode', preHp: 90, gainMaxDb: 46, postLp: 7500 },
          { clip: 'muff', stages: 2, stage2Db: 14, gainMaxDb: 50, postLp: 7000 },
        ] },
      controls: [
        SEL('mode', 'TYPE', ['BOOST', 'CENTA', 'BLUES', 'OD-1', 'TS', 'X-DRV', 'DIST', 'FUZZ'], { main: true, def: 3 }),
        SCREEN('bx-lcd', { p: 'mode', names: ['CLEAN BOOST', 'CENTAUR', 'BLUES OD', 'OD-1', 'TS DRIVE', 'X-DRIVE', 'DISTORTION', 'FUZZ'], p2: 'gain', fmt2: (v) => 'GAIN ' + (v * 10).toFixed(1) }),
        K('gain', 'GAIN', { def: 0.5, display: ten }), K('bass', 'BASS', { display: ten }), K('mid', 'MIDDLE', { display: ten }), K('treble', 'TREBLE', { display: ten }), K('level', 'LEVEL', { def: 0.5, display: ten }),
        FOOT({ label: 'ON/OFF' }), FOOT({ action: 'favorite', label: 'MEMORY' }), LED({ color: '#ff2a1a' }), LED({ bind: 'fav', color: '#3ddc84' }),
      ],
      desc: 'Eight drive types with 3-band EQ. MEMORY recalls a stored setting (hold to save).',
    }),
    def({
      id: 'bx.dd200', name: 'DG-200 Digital Delay', ref: 'BOSS DD-200', brand: 'BOSS', code: 'DG-200', typeName: 'Digital Delay', cat: 'Delay', form: 'bx-200', color: '#e8e8e5', text: '#161616', cost: 1.1,
      algo: 'delay', opts: { maxMs: 5000 }, stereo: 'both',
      controls: [
        SEL('dmode', 'MODE', ['STD', 'ANA', 'TAPE', 'DRUM', 'LO-FI', 'REV', 'SHIM', 'PAN', 'DUAL', 'MOD', 'WARP', '+RV'], { main: true, def: 0 }),
        SCREEN('bx-lcd', { p: 'dmode', names: ['STANDARD', 'ANALOG', 'TAPE', 'DRUM ECHO', 'LO-FI', 'REVERSE', 'SHIMMER', 'PAN', 'DUAL', 'MODULATE', 'WARP', 'DLY+REVERB'], p2: 'time', fmt2: (v) => ms(v) }),
        K('time', 'TIME', { min: 20, max: 5000, def: 420, curve: 'log', display: ms }), K('feedback', 'F.BACK', { def: 0.38, max: 1.05 }), K('mix', 'E.LEVEL', { def: 0.4 }), K('tone', 'TONE', { def: 0.6 }), K('moddepth', 'MOD DEPTH', { def: 0 }),
        FOOT({ label: 'ON/OFF' }), tapHold('TAP/MEMORY', 'time'), LED({ color: '#ff2a1a' }), LED({ bind: 'tap:time', color: '#ff2a1a' }),
      ],
      ctrl: { ins: [{ label: 'CTL/EXP', action: 'tap' }] },
      derive: (p) => {
        const m = p.dmode ?? 0;
        return { mode: [0, 1, 2, 2, 3, 5, 6, 7, 8, 4, 9, 10][m], heads: m === 3 ? 7 : 4, age: m === 2 || m === 3 ? 0.4 : 0.2 };
      },
      desc: '12 delay types. TAP sets the time (hold = freeze the repeats).',
    }),
    def({
      id: 'bx.dd500', name: 'DG-500 Digital Delay', ref: 'BOSS DD-500', brand: 'BOSS', code: 'DG-500', typeName: 'Digital Delay', cat: 'Delay', form: 'bx-200', color: '#ececea', text: '#161616', cost: 1.3,
      algo: 'delay', opts: { maxMs: 6000 }, stereo: 'stereo', ports: STEREO,
      controls: [
        SEL('dmode', 'MODE', ['STD', 'ANA', 'TAPE', 'VINT', 'DUAL', 'PATT', 'SFX', 'SHIM', 'REV', 'LO-FI', 'SLOW', 'TERA'], { main: true, def: 0 }),
        SCREEN('bx-lcd', { p: 'dmode', names: ['STANDARD', 'ANALOG', 'TAPE', 'VINTAGE DIGITAL', 'DUAL', 'PATTERN', 'SFX', 'SHIMMER', 'REVERSE', 'LO-FI', 'SLOW', 'TERA ECHO'], p2: 'time', fmt2: (v) => 'TIME ' + ms(v) }),
        K('time', 'TIME', { min: 20, max: 6000, def: 450, curve: 'log', display: ms }), K('feedback', 'FEEDBACK', { def: 0.38, max: 1.05 }), K('mix', 'E.LEVEL', { def: 0.4 }), K('tone', 'TONE', { def: 0.6 }),
        K('modrate', 'MOD RATE', { def: 0.3 }), K('moddepth', 'MOD DEPTH', { def: 0 }),
        FOOT({ label: 'A' }), FOOT({ action: 'favorite', label: 'B' }), tapHold('TAP/CTL', 'time'),
        LED({ color: '#ff2a1a' }), LED({ bind: 'fav', color: '#3ddc84' }), LED({ bind: 'tap:time', color: '#ff2a1a' }),
      ],
      ctrl: { ins: [{ label: 'CTL 1,2/EXP', action: 'tap' }] },
      derive: (p) => {
        const m = p.dmode ?? 0;
        return { mode: [0, 1, 2, 0, 8, 7, 4, 6, 5, 3, 10, 9][m], age: m === 2 ? 0.4 : m === 3 ? 0.5 : 0.2, lowcut: m === 3 ? 0.3 : 0 };
      },
      desc: 'A = on/off, B = memory (press to recall, hold to save), TAP/CTL = tap tempo (hold to freeze).',
    }),
    def({
      id: 'bx.re202', name: 'SE-202 Space Echo', ref: 'BOSS RE-202', brand: 'BOSS', code: 'SE-202', typeName: 'Space Echo', cat: 'Delay', form: 'bx-200', color: '#3f5a3d', text: '#efeadb', panel: '#1b1c1a', perRow: 4, cost: 1.6,
      algo: 'chain', stereo: 'both',
      opts: { chain: [{ prefix: 'd', algo: 'delay', opts: { maxMs: 1500, fixedMode: 2 }, params: { tone: 0.5 } }, { prefix: 's', algo: 'reverb', params: { mode: 3, mix: 0.25 } }] },
      controls: [
        SEL('semode', 'MODE', ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', 'RV'], { main: true, def: 4 }),
        SCREEN('bx-lcd', { p: 'semode', names: ['HEAD 1', 'HEAD 2', 'HEAD 3', 'HEAD 2+3', 'H1 + REV', 'H2 + REV', 'H3 + REV', 'H1+2 + REV', 'H2+3 + REV', 'H1+3 + REV', 'H1+2+3 + REV', 'REVERB ONLY'], p2: 'd.time', fmt2: (v) => 'RATE ' + ms(v), lcdFg: '#ffd27a' }),
        K('d.time', 'REPEAT RATE', { min: 50, max: 1200, def: 330, curve: 'log', display: ms }), K('d.feedback', 'INTENSITY', { def: 0.4, max: 1.1 }), K('d.mix', 'ECHO VOL', { def: 0.4 }), K('s.mix', 'REVERB VOL', { def: 0.25 }),
        K('bass', 'BASS', { def: 0.5, virtual: true }), K('d.tone', 'TREBLE', { def: 0.5 }), K('d.sat', 'SATURATION', { def: 0.4 }), K('wf', 'WOW&FLUTTER', { def: 0.3, virtual: true }),
        FOOT({ label: 'ON/OFF' }), tapHold('TAP', 'd.time'), FOOT({ action: 'favorite', label: 'MEMORY' }),
        LED({ color: '#ff2a1a' }), LED({ bind: 'tap:d.time', color: '#ff2a1a' }), LED({ bind: 'fav', color: '#3ddc84' }),
      ],
      derive: (p) => Object.assign(seDerive(p, 'semode'), { 'd.lowcut': (1 - (p.bass ?? 0.5)) * 0.6 }),
      desc: 'Tape echo + spring reverb with the classic 12-position mode selector. Hold TAP for runaway repeats.',
    }),
    def({
      id: 'bx.rv200', name: 'RX-200 Reverb', ref: 'BOSS RV-200', brand: 'BOSS', code: 'RX-200', typeName: 'Reverb', cat: 'Reverb', form: 'bx-200', color: '#2a4a86', text: '#eef2fa', cost: 1.5,
      algo: 'reverb', stereo: 'stereo', ports: STEREO,
      controls: [
        SEL('mode', 'MODE', ['ROOM', 'HALL', 'PLATE', 'SPRG', 'SHIM', 'CLOUD', 'MOD', 'DYN', '+DLY', 'SWELL'], { main: true, def: 1 }),
        SCREEN('bx-lcd', { p: 'mode', names: ['ROOM', 'HALL', 'PLATE', 'SPRING', 'SHIMMER', 'CLOUD', 'MODULATE', 'DYNAMIC', 'DELAY+REVERB', 'SWELL'], p2: 'decay', fmt2: (v) => 'TIME ' + (0.3 + v * 9.7).toFixed(1) + ' s' }),
        K('mix', 'E.LEVEL', { def: 0.38 }), K('decay', 'TIME', { def: 0.5 }), K('predelay', 'PRE-DLY', { min: 0, max: 500, def: 20, display: ms }), K('low', 'LOW', { def: 0.5, virtual: true }), K('tone', 'HIGH', { def: 0.6 }), K('param', 'PARAM', { def: 0.5, virtual: true }),
        FOOT({ label: 'ON/OFF' }), FOOT({ action: 'favorite', label: 'MEMORY' }), LED({ color: '#ff2a1a' }), LED({ bind: 'fav', color: '#3ddc84' }),
      ],
      perRow: 6,
      derive: (p) => { const v = p.param ?? 0.5; return { lowcut: (1 - (p.low ?? 0.5)) * 0.6, shimmer: v, mod: v, size: 0.3 + 0.7 * v }; },
      desc: 'Ten reverb types. PARAM = shimmer amount / modulation / room size depending on the type.',
    }),
    def({
      id: 'bx.md200', name: 'MX-200 Modulation', ref: 'BOSS MD-200', brand: 'BOSS', code: 'MX-200', typeName: 'Modulation', cat: 'Modulation', form: 'bx-200', color: '#5a64b8', text: '#f2f3fb', cost: 1.4,
      algo: 'chain', stereo: 'both',
      opts: { chain: [
        { prefix: 'c', algo: 'chorus', opts: { style: 'bbd', invertR: true } }, { prefix: 'f', algo: 'flanger', on: false }, { prefix: 'ph', algo: 'phaser', on: false },
        { prefix: 'u', algo: 'vibe', on: false }, { prefix: 't', algo: 'tremolo', on: false }, { prefix: 'r', algo: 'rotary', on: false }, { prefix: 'g', algo: 'ringmod', on: false },
      ] },
      controls: [
        SEL('mtype', 'MODE', ['CHO', 'DIM', 'VIB', 'FLG', 'PHA', 'UNI-V', 'TREM', 'ROT', 'RING'], { main: true, def: 0 }),
        SCREEN('bx-lcd', { p: 'mtype', names: ['CHORUS', 'DIMENSION', 'VIBRATO', 'FLANGER', 'PHASER', 'UNI-V', 'TREMOLO', 'ROTARY', 'RING MOD'], p2: 'rate', fmt2: (v) => 'RATE ' + Math.round(v * 100) }),
        K('rate', 'RATE', { def: 0.35, virtual: true }), K('depth', 'DEPTH', { def: 0.55, virtual: true }), K('elevel', 'E.LEVEL', { def: 0.5, virtual: true }), K('param', 'PARAM', { def: 0.4, virtual: true }),
        FOOT({ label: 'ON/OFF' }), FOOT({ action: 'favorite', label: 'MEMORY' }), LED({ color: '#ff2a1a' }), LED({ bind: 'fav', color: '#3ddc84' }),
      ],
      derive: (p) => {
        const t = p.mtype ?? 0, rate = p.rate ?? 0.35, dep = p.depth ?? 0.55, el = p.elevel ?? 0.5, prm = p.param ?? 0.4;
        const on = (k) => (k ? 1 : 0);
        return {
          'c.on': on(t <= 2), 'c.mode': [0, 3, 1][t] ?? 0, 'c.rate': rate, 'c.depth': dep, 'c.mix': t === 2 ? 1 : el, 'c.tone': prm,
          'f.on': on(t === 3), 'f.speed': rate, 'f.width': dep, 'f.mix': el, 'f.regen': prm, 'f.manual': 0.5,
          'ph.on': on(t === 4), 'ph.rate': rate, 'ph.depth': dep, 'ph.mix': el, 'ph.feedback': prm,
          'u.on': on(t === 5), 'u.speed': rate, 'u.intensity': dep, 'u.mode': prm > 0.5 ? 1 : 0,
          't.on': on(t === 6), 't.rate': rate, 't.depth': dep, 't.wave': prm,
          'r.on': on(t === 7), 'r.speed': rate > 0.5 ? 1 : 0, 'r.balance': prm, 'r.mix': Math.max(0.5, el),
          'g.on': on(t === 8), 'g.freq': rate, 'g.mix': el, 'g.fine': prm,
        };
      },
      desc: 'Nine modulation types sharing RATE / DEPTH / E.LEVEL / PARAM (PARAM = tone, resonance, wave or balance).',
    }),
    def({
      id: 'bx.sy200', name: 'SN-200 Synthesizer', ref: 'BOSS SY-200', brand: 'BOSS', code: 'SN-200', typeName: 'Synthesizer', cat: 'Synth', form: 'bx-200', color: '#202224', text: '#e9f4f2', accent: '#2fc6b0', cost: 1.2,
      algo: 'synth', stereo: 'both', perRow: 6,
      controls: [
        SEL('mode', 'TYPE', ['SQR', 'SAW', 'ORG', 'STR', 'BRS', 'BASS', 'PAD', 'SWP'], { main: true, def: 0 }),
        SCREEN('bx-lcd', { p: 'mode', names: ['SQUARE LEAD', 'SAW LEAD', 'ORGAN', 'STRINGS', 'BRASS', 'SUB BASS', 'PAD', 'FILTER SWEEP'], p2: 'filter', fmt2: (v) => 'CUTOFF ' + Math.round(v * 100), lcdFg: '#9ff5e6' }),
        K('wet', 'E.LEVEL', { def: 0.7 }), K('dry', 'DIRECT', { def: 0.4 }), K('filter', 'FILTER', { def: 0.5 }), K('reso', 'RESO', { def: 0.4 }), K('attack', 'ATTACK', { def: 0.2 }), K('mod', 'MOD', { def: 0.3 }),
        FOOT({ label: 'ON/OFF' }), FOOT({ action: 'favorite', label: 'MEMORY' }), LED({ color: '#ff2a1a' }), LED({ bind: 'fav', color: '#3ddc84' }),
      ],
    }),
    def({
      id: 'bx.eq200', name: 'GQ-200 Graphic EQ', ref: 'BOSS EQ-200', brand: 'BOSS', code: 'GQ-200', typeName: 'Graphic Equalizer', cat: 'EQ', form: 'bx-200', color: '#c7c9cc', text: '#151515', cost: 0.4,
      algo: 'geq', opts: { freqs: [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000] }, stereo: 'both',
      controls: [
        SCREEN('bx-lcd', { text: '10-BAND EQ', p2: 'level', fmt2: (v) => 'LEVEL ' + db(v) }),
        ...['31', '62', '125', '250', '500', '1k', '2k', '4k', '8k', '16k'].map((l, i) => SLIDER('b' + i, l, { min: -15, max: 15, def: 0, display: db })),
        SLIDER('level', 'LEVEL', { min: -15, max: 15, def: 0, display: db }),
        FOOT({ label: 'ON/OFF' }), FOOT({ action: 'favorite', label: 'MEMORY' }), LED({ color: '#ff2a1a' }), LED({ bind: 'fav', color: '#3ddc84' }),
      ],
      desc: '10-band graphic EQ. MEMORY switches to a stored curve (hold to save the current one).',
    }),
    // ---------------------------------------------------------------- multi-FX
    def({
      id: 'bx.gt1', name: 'GX-1 Effects Processor', ref: 'BOSS GT-1', brand: 'BOSS', code: 'GX-1', typeName: 'GUITAR EFFECTS PROCESSOR', cat: 'Multi-FX', kind: 'Multi-FX', form: 'bx-gt', color: '#1a1b1d', cost: 6,
      algo: 'chain', stereo: 'stereo', ports: { ins: ['INPUT'], outs: ['OUTPUT L/MONO', 'OUTPUT R'] },
      opts: { chain: [
        { prefix: 'gt', algo: 'gate', params: { threshold: 0.25 } },
        { prefix: 'ds', algo: 'drive', opts: { modes: [{ clip: 'clean', gainMaxDb: 22, tone: 'tilt' }, { clip: 'ts', cleanSum: true, clipHp: 720, gainMaxDb: 40, tone: 'ts', toneLo: 723 }, { clip: 'diode', gainMaxDb: 46, tone: 'blend' }, { clip: 'muff', stages: 2, gainMaxDb: 50, tone: 'blend' }] } },
        { prefix: 'amp', algo: 'amp', opts: { models: ['jc120', 'deluxe', 'ac30', 'plexi', 'jcm800', 'recto'] } },
        { prefix: 'cab', algo: 'cab', opts: { models: ['2x12jc', '1x12us', '2x12blue', '4x12gb', '4x12t75', '4x12v30'] } },
        { prefix: 'm1', algo: 'chorus', on: false }, { prefix: 'm2', algo: 'flanger', on: false }, { prefix: 'm3', algo: 'phaser', on: false }, { prefix: 'm4', algo: 'tremolo', on: false },
        { prefix: 'dl', algo: 'delay', opts: { maxMs: 2000 } },
        { prefix: 'rv', algo: 'reverb' },
        { prefix: 'vol', algo: 'volume' },
      ] },
      controls: [
        SCREEN('bx-lcd', { x: 74, y: 34, w: 112, h: 32, p: 'ampsel', names: ['AMP OFF', 'JC CLEAN', 'TWEED CLEAN', 'BRIT COMBO', 'CLASSIC STACK', 'BRIT LEAD', 'RECTI HI-GAIN'], p2: 'amp.gain', fmt2: (v) => 'GAIN ' + Math.round(v * 100) }),
        SEL('ampsel', 'AMP', ['OFF', 'JC', 'TWD', 'BRT', 'STK', 'LEAD', 'RECT'], { x: 175, y: 38, r: 15, def: 4, sweep: 300, optSize: 3.8, labelRadius: 6, labelPos: 'none' }),
        K('dist', 'BOOST/DS', { x: 24, y: 92, r: 10, def: 0, virtual: true, labelPos: 'above' }),
        K('amp.gain', 'GAIN', { x: 60, y: 92, r: 10, def: 0.5, labelPos: 'above' }),
        K('mod', 'MOD', { x: 96, y: 92, r: 10, def: 0, virtual: true, labelPos: 'above' }),
        K('dly', 'DELAY', { x: 132, y: 92, r: 10, def: 0.2, virtual: true, labelPos: 'above' }),
        K('rev', 'REVERB', { x: 168, y: 92, r: 10, def: 0.3, virtual: true, labelPos: 'above' }),
        K('amp.level', 'MASTER', { x: 204, y: 92, r: 10, min: -24, max: 6, def: 0, display: db, labelPos: 'above' }),
        FOOT({ action: 'bypass', label: 'BYPASS', x: 62, y: 170, r: 13 }),
        FOOT({ action: 'tap', label: 'CTL / TAP', x: 172, y: 170, r: 13, tapTarget: 'dl.time' }),
        LED({ x: 62, y: 140, bind: 'on', color: '#ff2a1a' }), LED({ x: 172, y: 140, bind: 'tap:dl.time', color: '#ff2a1a' }),
        TREADLE('vol.pos', { x: 277, y: 106, w: 74, h: 184, def: 1, color: '#151516', logo: 'EXP', logoColor: '#bdbdbd', logoFont: "'Oswald', sans-serif", logoSize: 12 }),
      ],
      initParams: { 'amp.gain': 0.5, 'amp.level': 0, 'dl.time': 400 },
      derive: (p) => {
        const o = {};
        const [dq, dv] = quad(p.dist ?? 0);
        o['ds.on'] = dq >= 0 ? 1 : 0; o['ds.mode'] = Math.max(0, dq); o['ds.gain'] = 0.25 + 0.75 * dv; o['ds.level'] = 0.55;
        const a = p.ampsel ?? 4;
        o['amp.on'] = a > 0 ? 1 : 0; o['cab.on'] = a > 0 ? 1 : 0; o['amp.channel'] = Math.max(0, a - 1); o['cab.model'] = Math.max(0, a - 1);
        const [mq, mv] = quad(p.mod ?? 0);
        for (let i = 0; i < 4; i++) o[`m${i + 1}.on`] = mq === i ? 1 : 0;
        o['m1.mix'] = 0.3 + 0.5 * mv; o['m2.mix'] = 0.3 + 0.5 * mv; o['m3.mix'] = 0.3 + 0.5 * mv; o['m4.depth'] = 0.2 + 0.8 * mv;
        const [lq, lv] = quad(Math.min(p.dly ?? 0.2, 0.999));
        o['dl.on'] = lq >= 0 ? 1 : 0; o['dl.mode'] = [0, 1, 2, 7][Math.max(0, lq)]; o['dl.mix'] = 0.15 + 0.45 * lv; o['dl.feedback'] = 0.25 + 0.35 * lv;
        const [rq, rv] = quad(p.rev ?? 0.3);
        o['rv.on'] = rq >= 0 ? 1 : 0; o['rv.mode'] = [0, 1, 2, 3][Math.max(0, rq)]; o['rv.mix'] = 0.15 + 0.4 * rv;
        return o;
      },
      desc: 'Compact multi-FX: BOOST/DS, MOD, DELAY and REVERB knobs each sweep four types (fully left = off), AMP picks one of six amps + cab. The expression pedal is a volume pedal; CTL taps the delay time.',
    }),
  ]);
}
