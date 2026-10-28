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
      algo: 'drive', opts: { clip: 'diode', stages: 2, stage2Db: 10, preHp: 60, gainMinDb: 14, gainMaxDb: 50, tone: 'hm2', postLp: 8000, levelMaxDb: 6 },
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
      controls: [K('balance', 'BALANCE', { def: 0.5, virtual: true }), SEL('semis1', 'SHIFT', ['-12', '-7', '-5', '-3', '+3', '+4', '+5', '+7', '+12'], { values: [-12, -7, -5, -3, 3, 4, 5, 7, 12], def: 7, sweep: 240, optSize: 4.4 }),
        SEL('psmode', 'MODE', ['HARM', 'SHIFT', 'DETUNE', 'S-BEND'], { def: 1, sweep: 120, optSize: 4.4 })],
      derive: (p) => {
        const b = p.balance ?? 0.5;
        const r = { dry: Math.min(1, 2 * (1 - b)), level1: Math.min(1, 2 * b), glide: 0.1 };
        if (p.psmode === 2) Object.assign(r, { semis1: 0, cents: 12, semis2: 0, level2: 0 });
        if (p.psmode === 3) Object.assign(r, { glide: 0.8 });
        return r;
      },
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
}
