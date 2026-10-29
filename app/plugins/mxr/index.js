// Built-in Tone Zone plugin: MXR.
// Blocks inspired by MXR gear. Names, logos and artwork are Tone Zone originals; control layouts and
// colours follow the real units (see each block's `ref`) so moving between the real thing and the virtual one is easy.
export default function register(tz) {
  const { K, SEL, TOG, BTN, FOOT, LED, SLIDER, SCREEN, TREADLE, MIC, def, ten, pct, db, ms, MONO, STEREO, MONO_TO_ST, STD } = tz.helpers;
  const { BOSS, NINE, MXRD, lvl, tone, gain, S, onFoot, onLed, k, AMP, CAB, preampPair, marshallKnobs, fenderKnobs } = tz.builders;
  tz.addDefs([
    MXRD({
      id: 'mx.m169', name: 'Carbon Echo', ref: 'MXR M169 Carbon Copy', code: 'MX169', logo: 'Carbon Echo', cat: 'Delay', color: '#3d4a2e', text: '#f0f0f0',
      algo: 'delay', opts: { maxMs: 650 }, fixed: { mode: 1, tone: 0.32, modrate: 0.25 },
      controls: [K('feedback', 'REGEN', { def: 0.35, max: 1.05 }), K('mix', 'MIX', { def: 0.4 }), K('time', 'DELAY', { min: 20, max: 600, def: 300, display: ms }),
        BTN('MOD', { p: 'mod', toggle: true, led: true, ledColor: '#3d8bff', ledDy: -10 })],
      derive: (p) => ({ moddepth: p.mod ? 0.45 : 0 }),
    }),
    MXRD({
      id: 'mx.m222', name: 'Talk Box', ref: 'MXR M222 Talk Box', code: 'MX222', logo: 'Talk Box', cat: 'Filter', color: '#1a1a1a', text: '#e9e9e9', wide: true,
      algo: 'talkbox', fixed: { mode: 1 },
      controls: [K('volume', 'VOLUME', { def: 0.5 }), K('tone', 'TONE', { def: 0.5 }), K('sens', 'GAIN', { def: 0.5 })],
      desc: 'Talk-box simulation: the "mouth" vowel follows your picking dynamics. Use the inspector EXP control for manual vowels.',
    }),
    MXRD({ id: 'mx.m101', name: 'Phase Nine', ref: 'MXR M101 Phase 90', code: 'MX101', logo: 'Phase 9', cat: 'Modulation', color: '#f26a1b', text: '#111', led: '#ff2a1a',
      algo: 'phaser', opts: { stages: 4 }, fixed: { stages: 4, depth: 0.85, mix: 0.5 },
      controls: [K('rate', 'SPEED', { def: 0.35 })], derive: () => ({ script: 0 }) }),
    MXRD({ id: 'mx.m102', name: 'Dyno Comp', ref: 'MXR M102 Dyna Comp', code: 'MX102', logo: 'Dyno Comp', cat: 'Dynamics', color: '#c8202a', text: '#f4f4f4', led: '#ff2a1a',
      algo: 'comp', opts: { type: 'ota' }, controls: [K('level', 'OUTPUT', { def: 0.55 }), K('sustain', 'SENSITIVITY', { def: 0.55 })] }),
    MXRD({ id: 'mx.m104', name: 'Dist Plus', ref: 'MXR M104 Distortion+', code: 'MX104', logo: 'Dist +', cat: 'Distortion', color: '#f4d21e', text: '#111', led: '#ff2a1a',
      algo: 'drive', opts: { clip: 'diode', preHp: 140, gainMinDb: 4, gainMaxDb: 40, tone: 'none', postLp: 4800, levelMaxDb: 6 },
      controls: [K('level', 'OUTPUT', { def: 0.46 }), K('gain', 'DISTORTION', { def: 0.5 })] }),
    MXRD({ id: 'mx.m133', name: 'Mini Amp', ref: 'MXR M133 Micro Amp', code: 'MX133', logo: 'Mini Amp', cat: 'Boost', color: '#efe9da', text: '#111', led: '#ff2a1a',
      algo: 'boost', opts: { gainMaxDb: 26 }, controls: [K('gain', 'GAIN', { def: 0.25 })] }),
    MXRD({ id: 'mx.m108', name: 'Ten Band EQ', ref: 'MXR M108S Ten Band EQ', code: 'MX108', logo: '', cat: 'EQ', color: '#2b2d31', text: '#e8e8e8', wide: true,
      algo: 'geq', opts: { freqs: [31.25, 62.5, 125, 250, 500, 1000, 2000, 4000, 8000, 16000], q: 1.6 }, ports: { ins: ['INPUT'], outs: ['OUTPUT 1', 'OUTPUT 2'] }, stereo: 'fixedDual',
      controls: [
        SLIDER('level', 'VOL', { min: -12, max: 12, def: 0, display: db }), SLIDER('gain', 'GAIN', { min: -12, max: 12, def: 0, display: db }),
        ...['31', '62', '125', '250', '500', '1K', '2K', '4K', '8K', '16K'].map((l, i) => SLIDER('b' + i, l, { min: -12, max: 12, def: 0, display: db })),
      ] }),
    MXRD({ id: 'mx.m117', name: 'Flanger 117', ref: 'MXR M117R Flanger', code: 'MX117', logo: 'Flanger', cat: 'Modulation', color: '#a7abb1', text: '#111', stereo: 'both',
      algo: 'flanger', controls: [K('manual', 'MANUAL', { def: 0.45 }), K('width', 'WIDTH', { def: 0.6 }), K('speed', 'SPEED', { def: 0.3 }), K('regen', 'REGEN.', { def: 0.55 })] }),
    MXRD({ id: 'mx.m234', name: 'Analog Chorus', ref: 'MXR M234 Analog Chorus', code: 'MX234', logo: 'Analog Chorus', logoSize: 17, cat: 'Modulation', color: '#2ba6c4', text: '#111', ports: { ins: ['INPUT'], outs: ['OUTPUT', 'THRU'] }, stereo: 'fixed',
      algo: 'chorus', opts: { invertR: false }, controls: [K('mix', 'LEVEL', { def: 0.55 }), K('rate', 'RATE', { def: 0.35 }), K('depth', 'DEPTH', { def: 0.5 }), K('tone', 'HIGH', { def: 0.6, r: 8 }), K('lowcut', 'LOW', { def: 0.2, r: 8, virtual: true })] }),
    MXRD({ id: 'mx.m288', name: 'Bass Octave DLX', ref: 'MXR M288 Bass Octave Deluxe', code: 'MX288', logo: 'Bass Octave', logoSize: 18, cat: 'Pitch', color: '#5b2c83', text: '#f2f2f2',
      algo: 'pitch', opts: { semis1: -12, semis2: -12 }, fixed: { semis1: -12, semis2: -12, quality: 2 },
      controls: [K('dry', 'DRY', { def: 0.7 }), K('level1', 'GROWL', { def: 0.5 }), K('level2', 'GIRTH', { def: 0.3 }), BTN('MID+', { p: 'midplus', toggle: true, led: true, ledDy: -10 })],
      derive: (p) => ({ tone: 0.35 + 0.15 * (p.level2 ?? 0.3) + (p.midplus ? 0.25 : 0) }) }),
    MXRD({ id: 'mx.m135', name: 'Clever Gate', ref: 'MXR M135 Smart Gate', code: 'MX135', logo: 'Clever Gate', cat: 'Dynamics', color: '#1c1c1c', text: '#e9e9e9',
      algo: 'gate', controls: [K('threshold', 'THRESHOLD', { def: 0.4 }), TOG('range', '', ['HISS', 'MID', 'FULL'], { x: 64, y: 76, values: [0.3, 0.6, 1.0], def: 1, orient: 'h' })] }),
    MXRD({ id: 'mx.m116', name: 'Fullbody Metal', ref: 'MXR M116 Fullbore Metal', code: 'MX116', logo: 'Fullbody', cat: 'Distortion', color: '#222428', text: '#e9e9e9',
      algo: 'chain', opts: { chain: [
        { prefix: 'g', algo: 'gate', on: false, params: { threshold: 0.45, decay: 0.25 } },
        { prefix: 'd', algo: 'drive', opts: { clip: 'diode', stages: 2, stage2Db: 16, preHp: 120, gainMinDb: 18, gainMaxDb: 58, tone: 'mt2', eqRangeDb: 15, postLp: 7200, levelMaxDb: 6,
          modes: [{}, { postEq: [{ type: 'peak', f: 750, q: 0.7, db: -9 }] }] } },
      ] },
      controls: [K('d.level', 'VOLUME', { r: 10, def: 0.3 }), K('d.gain', 'GAIN', { r: 10 }), K('d.midfreq', 'FREQ', { r: 10 }), K('d.mid', 'MID', { r: 10 }), K('d.bass', 'LOW', { r: 10 }), K('d.treble', 'HIGH', { r: 10 }),
        BTN('SCOOP', { p: 'd.mode', toggle: true, led: true, ledColor: '#ff2a1a', x: 92, y: 120, ledDy: -9 }), BTN('GATE', { p: 'g.on', toggle: true, led: true, ledColor: '#3ddc84', x: 36, y: 120, ledDy: -9 })] }),
    MXRD({ id: 'mx.m75', name: 'Super Bad Dist', ref: 'MXR M75 Super Badass Distortion', code: 'MX75', logo: 'Super Bad', cat: 'Distortion', color: '#151515', text: '#e9e9e9',
      algo: 'drive', opts: { clip: 'asym', bias: 0.2, preHp: 80, gainMinDb: 6, gainMaxDb: 44, tone: 'eq3', eqRangeDb: 14, bassF: 120, midF: 900, trebleF: 3000, postLp: 8000, levelMaxDb: 6 },
      controls: [K('level', 'OUTPUT', { r: 11 }), K('bass', 'BASS', { r: 11 }), K('mid', 'MID', { r: 11 }), K('treble', 'TREBLE', { r: 11 }), K('gain', 'DISTORTION', { r: 11 })] }),
    MXRD({ id: 'mx.m68', name: 'Vibe Machine', ref: 'MXR M68 Uni-Vibe', code: 'MX68', logo: 'Vibe Machine', logoSize: 18, cat: 'Modulation', color: '#5a2a1a', text: '#f0e6d6', wide: true,
      algo: 'vibe', controls: [K('level', 'VOLUME'), K('intensity', 'INTENSITY', { def: 0.7 }), K('speed', 'SPEED', { def: 0.4 }), TOG('mode', '', ['CHORUS', 'VIBRATO'], { x: 98, y: 80, orient: 'h' })] }),

    // ---- v0.2.0 additions
    MXRD({ id: 'mx.m105', name: 'Phase Four-Five', ref: 'MXR M105 Phase 45', code: 'MX105', logo: 'Phase 45', cat: 'Modulation', color: '#e0801e', text: '#111', led: '#ff2a1a',
      algo: 'phaser', opts: { stages: 2 }, fixed: { stages: 2, depth: 0.8, feedback: 0.15, mix: 0.5 }, controls: [K('rate', 'SPEED', { def: 0.35 })],
      desc: 'Two-stage phaser: subtler and more vocal than the four-stage Phase 90.' }),
    MXRD({ id: 'mx.m107', name: 'Phase Hundred', ref: 'MXR M107 Phase 100', code: 'MX107', logo: 'Phase 100', cat: 'Modulation', color: '#4c5560', text: '#f2f2f2', led: '#ff2a1a',
      algo: 'phaser', opts: { stages: 10 }, fixed: { stages: 10, mix: 0.5 },
      controls: [K('rate', 'SPEED', { def: 0.3 }), SEL('intensity', 'INTENSITY', ['1', '2', '3', '4'], { def: 2, sweep: 120, virtual: true })],
      derive: (p) => { const i = p.intensity ?? 2; return { depth: [0.55, 0.7, 0.85, 1][i], feedback: [0.2, 0.35, 0.5, 0.65][i], center: [0.6, 0.5, 0.45, 0.4][i] }; },
      desc: 'Ten-stage phaser; the 4-position INTENSITY switch sets depth and resonance.' }),
    MXRD({ id: 'mx.csp026', name: "'74 Script Phase", ref: "MXR CSP026 '74 Vintage Phase 90", code: 'CSP026', logo: 'phase 90', logoFont: "'Dancing Script', cursive", cat: 'Modulation', color: '#ef6a1a', text: '#111', led: '#ff2a1a',
      algo: 'phaser', opts: { stages: 4 }, fixed: { stages: 4, depth: 0.8, mix: 0.5, script: 1 }, controls: [K('rate', 'SPEED', { def: 0.3 })],
      desc: 'Script-logo Phase 90 voicing: no feedback resistor, a smoother and rounder swirl.' }),
    MXRD({ id: 'mx.m292', name: 'Carbon Echo DLX', ref: 'MXR M292 Carbon Copy Deluxe', code: 'MX292', logo: 'Carbon Echo', logoSize: 19, cat: 'Delay', color: '#30402a', text: '#f0f0f0', wide: true, noStd: true,
      algo: 'delay', opts: { maxMs: 1200 }, fixed: { mode: 1, modrate: 0.25 }, tapTarget: 'time',
      controls: [K('feedback', 'REGEN', { def: 0.35, max: 1.05 }), K('mix', 'MIX', { def: 0.4 }), K('time', 'DELAY', { min: 20, max: 1200, def: 380, display: ms }),
        BTN('MOD', { p: 'mod', toggle: true, led: true, ledColor: '#3d8bff', x: 74, y: 86, ledDy: -9 }), BTN('BRIGHT', { p: 'bright', toggle: true, led: true, ledColor: '#3d8bff', x: 122, y: 86, ledDy: -9 }),
        FOOT({ x: 58, y: 180, r: 13 }), LED({ x: 58, y: 154, color: '#3d8bff' }), FOOT({ action: 'tap', label: 'TAP', x: 138, y: 180, r: 12 }), LED({ x: 138, y: 154, bind: 'tap:time', color: '#3ddc84' })],
      derive: (p) => ({ moddepth: p.mod ? 0.45 : 0, tone: p.bright ? 0.55 : 0.32 }),
      desc: 'Analog BBD delay up to 1.2 s with tap tempo, MOD and BRIGHT switches.' }),
    MXRD({ id: 'mx.m103', name: 'Blue Crate', ref: 'MXR M103 Blue Box', code: 'MX103', logo: 'Blue Crate', cat: 'Fuzz', color: '#1d5fb8', text: '#f2f2f2', led: '#ff2a1a',
      algo: 'chain', cost: 1.1,
      opts: { chain: [
        { prefix: 'p', algo: 'pitch', params: { semis1: -24, level1: 0.7, dry: 0.7, quality: 0, tone: 0.55 } },
        { prefix: 'd', algo: 'drive', opts: { clip: 'si', preHp: 50, gainMinDb: 24, gainMaxDb: 40, tone: 'none', postLp: 3800, levelMaxDb: 0 }, params: { gain: 0.8 } },
      ] },
      fixed: { 'p.semis1': -24, 'p.quality': 0 },
      controls: [K('d.level', 'OUTPUT', { def: 0.32 }), K('blend', 'BLEND', { def: 0.5, virtual: true })],
      derive: (p) => { const b = p.blend ?? 0.5; return { 'p.level1': 0.15 + 0.85 * b, 'p.dry': 1 - 0.7 * b }; },
      desc: 'Fuzz with a sub-octave two octaves down. BLEND moves from the fuzzed guitar to the low octave.' }),
    MXRD({ id: 'mx.m109', name: 'Six Band EQ', ref: 'MXR M109S Six Band EQ', code: 'MX109', logo: 'Six Band', logoSize: 17, cat: 'EQ', color: '#2b2d31', text: '#e8e8e8',
      algo: 'geq', opts: { freqs: [100, 200, 400, 800, 1600, 3200], q: 1.3 },
      controls: ['100', '200', '400', '800', '1.6K', '3.2K'].map((l, i) => SLIDER('b' + i, l, { min: -18, max: 18, def: 0, display: db })) }),
    MXRD({ id: 'mx.m195', name: 'Hush Clamp', ref: 'MXR M195 Noise Clamp', code: 'MX195', logo: 'Hush Clamp', cat: 'Dynamics', color: '#ece9e1', text: '#111', led: '#ff2a1a',
      algo: 'gate', fixed: { attack: 0.05, range: 1 }, controls: [K('threshold', 'THRESHOLD', { def: 0.35 })], derive: (p) => ({ decay: 0.25 + 0.3 * (p.threshold ?? 0.35) }),
      desc: 'Fast, transparent noise gate for high-gain rigs.' }),
    MXRD({ id: 'mx.m80', name: 'Bass DI Plus', ref: 'MXR M80 Bass D.I.+', code: 'MX80', logo: 'Bass DI +', logoFont: "'Oswald', sans-serif", logoSize: 18, cat: 'Preamp', kind: 'Preamp', color: '#26272b', text: '#ececec', wide: true, noStd: true,
      algo: 'chain', cost: 0.9, alwaysOn: false,
      opts: { chain: [
        { prefix: 'c', algo: 'boost', params: { mode: 0 } },
        { prefix: 'd', algo: 'drive', on: false, opts: { clip: 'opamp', preHp: 60, gainMinDb: 6, gainMaxDb: 40, tone: 'none', postLp: 5000, cleanSum: true, levelMaxDb: 4 } },
      ] },
      ports: { ins: ['INPUT'], outs: ['OUTPUT', 'DI OUT'] }, jackKinds: { o1: 'xlr' },
      controls: [K('c.bass', 'BASS', { def: 0.5, x: 44, y: 36, r: 11 }), K('c.treble', 'TREBLE', { def: 0.5, x: 98, y: 36, r: 11 }), K('c.level', 'VOLUME', { def: 0.55, x: 152, y: 36, r: 11 }),
        K('d.level', 'D-VOL', { def: 0.5, x: 44, y: 80, r: 11 }), K('d.blend', 'BLEND', { def: 0.5, x: 98, y: 80, r: 11 }), K('d.gain', 'DIST', { def: 0.5, x: 152, y: 80, r: 11 }),
        BTN('COLOR', { p: 'color', toggle: true, led: true, ledColor: '#3d8bff', x: 98, y: 153, ledDy: -9 }),
        FOOT({ x: 58, y: 186, r: 12, label: 'BYPASS' }), LED({ x: 58, y: 160, color: '#3d8bff' }), FOOT({ action: 'param', p: 'd.on', label: 'DIST', x: 138, y: 186, r: 12 }), LED({ x: 138, y: 160, bind: 'param:d.on', color: '#ff2a1a' })],
      derive: (p) => ({ 'c.gain': p.color ? 0.62 : 0.5 }),
      desc: 'Bass preamp / DI with a switchable distortion channel (BLEND keeps the low end). COLOR adds a mid scoop and treble lift.' }),
    MXRD({ id: 'mx.m84', name: 'Bass Fuzz DLX', ref: 'MXR M84 Bass Fuzz Deluxe', code: 'MX84', logo: 'Bass Fuzz', cat: 'Fuzz', color: '#1a1a1a', text: '#e9e9e9', led: '#ff2a1a',
      algo: 'drive', opts: { clip: 'si', preHp: 30, gainMinDb: 16, gainMaxDb: 44, tone: 'none', postLp: 4500, cleanSum: true, levelMaxDb: 0, outTrim: 0.6 },
      controls: [K('level', 'VOLUME', { def: 0.5 }), K('blend', 'BLEND', { def: 0.5 }), K('gain', 'FUZZ', { def: 0.6 })],
      desc: 'Bass fuzz with a clean blend so the fundamental stays solid.' }),
    MXRD({ id: 'mx.m82', name: 'Bass Envelope', ref: 'MXR M82 Bass Envelope Filter', code: 'MX82', logo: 'Envelope', cat: 'Filter', color: '#e3d531', text: '#111', led: '#ff2a1a', wide: true,
      algo: 'wah', opts: { fLo: 180, fHi: 2200, mode: 2 }, fixed: { mode: 2, filter: 1 },
      controls: [K('dry', 'DRY', { def: 0.3, virtual: true }), K('level', 'FX', { def: 0.55 }), K('q', 'Q', { def: 0.55 }), K('rate', 'DECAY', { def: 0.45 }), K('sens', 'SENS', { def: 0.55 })],
      derive: (p) => ({ range: 0.35 + 0.3 * (p.dry ?? 0.3) }),
      desc: 'Envelope filter voiced for bass. Note: DRY shifts the sweep range down (the engine filter has no separate dry blend).' }),
    MXRD({ id: 'mx.m300', name: 'Verb 300', ref: 'MXR M300 Reverb', code: 'M300', logo: 'Reverb', cat: 'Reverb', color: '#e9e6df', text: '#111', led: '#3d8bff', stereo: 'both', cost: 1.3, wide: true,
      algo: 'reverb',
      controls: [K('decay', 'DECAY', { def: 0.5, x: 30, y: 44, r: 12 }), K('tone', 'TONE', { def: 0.55, x: 74, y: 44, r: 12 }), K('mix', 'MIX', { def: 0.3, x: 118, y: 44, r: 12 }),
        SEL('style', 'STYLE', ['ROOM', 'PLATE', 'SPRING', 'EPIC', 'MOD', 'PAD'], { def: 1, sweep: 250, virtual: true, optSize: 4.2, x: 162, y: 46, r: 10, labelPos: 'below', labelRadius: 8 })],
      derive: (p) => { const s = p.style ?? 1; return { mode: [0, 2, 3, 1, 6, 5][s], size: [0.35, 0.5, 0.4, 0.95, 0.6, 0.9][s], mod: s === 4 ? 0.8 : 0.25 }; },
      desc: 'Six reverb styles: room, plate, spring, epic (huge hall), mod and pad.' }),
    MXRD({ id: 'mx.m134', name: 'Stereo Chorus', ref: 'MXR M134 Stereo Chorus', code: 'MX134', logo: 'Stereo Chorus', logoSize: 17, cat: 'Modulation', color: '#3b3d42', text: '#ececec', wide: true, led: '#ff2a1a',
      algo: 'chorus', opts: { invertR: true }, stereo: 'both', monoPorts: { ins: ['INPUT'], outs: ['OUTPUT'] }, stereoPorts: { ins: ['INPUT'], outs: ['OUTPUT A', 'OUTPUT B'] },
      controls: [K('rate', 'RATE', { def: 0.3 }), K('depth', 'WIDTH', { def: 0.55 }), K('feedback', 'INTENSITY', { def: 0.15, max: 0.6 }), K('tone', 'BASS FILTER', { def: 0.6 })],
      fixed: { mix: 0.5 } }),
    MXRD({ id: 'mx.csp039', name: 'Duchess of Tone', ref: 'MXR CSP039 Duke of Tone', code: 'CSP039', logo: 'Duchess', logoSize: 19, cat: 'Overdrive', color: '#4a2d7a', text: '#e8d7a8', led: '#ff2a1a',
      algo: 'drive', opts: { clip: 'diode', preHp: 120, gainMinDb: 0, gainMaxDb: 36, tone: 'lp', toneLo: 1200, toneHi: 9000, levelMaxDb: 6,
        modes: [{ clip: 'clean', gainMaxDb: 18 }, { clip: 'diode', gainMaxDb: 32 }, { clip: 'si', gainMaxDb: 42 }] },
      controls: [K('level', 'VOLUME', { def: 0.5 }), K('tone', 'TONE', { def: 0.55 }), K('gain', 'DRIVE', { def: 0.45 }), TOG('mode', '', ['BOOST', 'OD', 'DIST'], { def: 1, x: 64, y: 78, orient: 'h' })],
      desc: 'Prince-of-Tone style: the 3-way switch picks boost, overdrive or distortion.' }),
    MXRD({ id: 'mx.m203', name: 'Tommy Drive', ref: 'MXR M203 Timmy Overdrive', code: 'MX203', logo: 'Tommy', cat: 'Overdrive', color: '#a7b59a', text: '#111', led: '#ff2a1a',
      algo: 'drive', opts: { clip: 'diode', preHp: 40, gainMinDb: 0, gainMaxDb: 34, tone: 'eq3', eqRangeDb: 12, bassF: 110, midF: 800, trebleF: 3200, levelMaxDb: 6,
        modes: [{ clip: 'asym' }, { clip: 'diode' }, { clip: 'si', gainMaxDb: 30 }] },
      controls: [K('level', 'VOLUME', { def: 0.5 }), K('gain', 'GAIN', { def: 0.45 }), K('bass', 'BASS', { def: 0.55 }), K('treble', 'TREBLE', { def: 0.5 }), TOG('mode', '', ['ASYM', 'SYM', 'MORE'], { def: 1, x: 64, y: 50, orient: 'h' })],
      fixed: { mid: 0.5 }, desc: 'Transparent overdrive with BASS / TREBLE cut controls and a 3-way clipping switch.' }),
    MXRD({ id: 'mx.m294', name: 'Candy Drive', ref: 'MXR M294 Sugar Drive', code: 'MX294', logo: 'Candy Drive', logoSize: 18, cat: 'Overdrive', color: '#d2a46f', text: '#1a1206', led: '#ff2a1a',
      algo: 'drive', opts: { clip: 'ge', preHp: 120, gainMinDb: 2, gainMaxDb: 34, tone: 'tilt', cleanSum: true, cleanMix: 0.6, levelMaxDb: 8 },
      controls: [K('level', 'OUTPUT', { def: 0.5 }), K('tone', 'TONE', { def: 0.55 }), K('gain', 'GAIN', { def: 0.4 }), TOG('buffer', '', ['TRUE', 'BUF'], { def: 0, x: 64, y: 78, orient: 'h' })],
      desc: 'Klon-style transparent drive with clean blend.' }),
    MXRD({ id: 'mx.m306', name: 'Poly Azure Octave', ref: 'MXR M306 Poly Blue Octave', code: 'MX306', logo: 'Azure Octave', logoSize: 18, cat: 'Pitch', color: '#1f4f9a', text: '#f2f2f2', led: '#3d8bff', cost: 1.3,
      algo: 'chain',
      opts: { chain: [
        { prefix: 'p', algo: 'pitch', params: { semis1: 12, semis2: -12, quality: 1 } },
        { prefix: 'm', algo: 'chorus', on: false, params: { mode: 1, mix: 1, depth: 0.35 } },
      ] },
      fixed: { 'p.semis1': 12, 'p.semis2': -12 },
      controls: [K('p.dry', 'DRY', { def: 0.8 }), K('p.level1', 'OCT UP', { def: 0.3 }), K('p.level2', 'OCT DOWN', { def: 0.5 }), K('m.rate', 'MOD', { def: 0.3 }),
        BTN('MOD', { p: 'm.on', toggle: true, led: true, ledColor: '#3d8bff' })],
      desc: 'Polyphonic octave up / down with dry blend and a vibrato modulation section.' }),
    MXRD({ id: 'mx.csp035', name: 'Shibuya Drive', ref: 'MXR CSP035 Shin-Juku Drive', code: 'CSP035', logo: 'Shibuya', logoSize: 19, cat: 'Overdrive', color: '#d8d6cf', text: '#151515', led: '#ff2a1a',
      algo: 'drive', opts: { clip: 'tube', preHp: 90, gainMinDb: 6, gainMaxDb: 40, tone: 'lp', toneLo: 1500, toneHi: 9000, levelMaxDb: 6, modes: [{}, { preEq: [{ type: 'peak', f: 700, q: 0.8, db: 4 }] }] },
      controls: [K('level', 'OUTPUT', { def: 0.5 }), K('tone', 'TONE', { def: 0.55 }), K('gain', 'DRIVE', { def: 0.5 }), TOG('mode', '', ['FAT', 'MID'], { def: 0, x: 64, y: 78, orient: 'h' })],
      desc: 'Amp-like plexi crunch in a box.' }),
    MXRD({ id: 'mx.csp036', name: 'Il Demonio', ref: 'MXR Il Diavolo Overdrive', code: 'CSP036', logo: 'Il Demonio', logoSize: 19, cat: 'Overdrive', color: '#9c1414', text: '#f2e4c8', led: '#ffb020',
      algo: 'drive', opts: { clip: 'asym', bias: 0.2, preHp: 80, gainMinDb: 8, gainMaxDb: 44, tone: 'lp', toneLo: 1300, toneHi: 9000, levelMaxDb: 6, modes: [{}, { gainMaxDb: 52 }] },
      controls: [K('level', 'OUTPUT', { def: 0.5 }), K('tone', 'TONE', { def: 0.55 }), K('gain', 'GAIN', { def: 0.5 }), BTN('HOT', { p: 'mode', toggle: true, led: true, ledColor: '#ff2a1a' })],
      art: 'flames', desc: 'Hot-rodded British overdrive; HOT adds a second gain stage.' }),
  ]);

  // ---- v0.4 additions
  // MXR mini enclosure (Dyna Comp Mini, Carbon Copy Mini, Phase 95): narrow box, script logo, small stomp
  const { svg, label, formKit, textColorFor } = tz.gfx;
  const placed = new WeakSet();
  tz.addForm('mx-mini', (ctx, d) => {
    const g = ctx.g, w = 92, h = 200;
    const col = d.color, txt = d.text || textColorFor(col);
    formKit.body(g, w, h, col, { rx: 6 });
    const theme = { text: txt, knob: 'mxr', labelSize: 6 };
    d.controls.forEach((c) => { if (c.x === undefined) placed.add(c); });
    const mine = d.controls.filter((c) => placed.has(c));
    const knobs = mine.filter((c) => c.t === 'knob' || c.t === 'sel');
    const pos = knobs.length === 1 ? [[w / 2, 36, 13]] : knobs.length === 2 ? [[24, 32, 11], [68, 32, 11]] : [[24, 30, 10], [68, 30, 10], [46, 64, 10]];
    knobs.forEach((k, i) => Object.assign(k, { x: pos[i][0], y: pos[i][1], r: pos[i][2], labelPos: 'below' }));
    const sw = mine.filter((c) => c.t === 'toggle' || c.t === 'button');
    const sy = knobs.length === 3 ? 96 : 74;
    sw.forEach((c, i) => {
      Object.assign(c, { x: sw.length === 1 ? w / 2 : [26, 66][i], y: sy });
      if (c.t === 'button') Object.assign(c, { r: 4.5, led: c.led ?? true, ledDy: -8 });
      if (c.t === 'toggle') c.orient = c.orient || 'v';
    });
    const ly = sw.length ? sy + 30 : knobs.length === 3 ? 98 : 84;
    label(g, w / 2, ly, d.logo, { size: d.logoSize || 15, fill: d.logoColor || txt, font: d.logoFont || "'Dancing Script', cursive", weight: 700 });
    label(g, w / 2, ly + 12, d.code, { size: 6, fill: txt, weight: 700, ls: 1.4, opacity: 0.85 });
    mine.forEach((c) => {
      if (c.t === 'foot') Object.assign(c, { style: 'stomp', x: w / 2, y: h - 30, r: 11 });
      if (c.t === 'led') Object.assign(c, { x: w / 2, y: h - 54, r: 2.6 });
    });
    formKit.tzBadge(g, w / 2, h - 8, txt, 3.8);
    formKit.placeControls(ctx, d.controls, theme);
    return { w, h, theme, jacks: formKit.jacksSide(d, w, { y0: 40, gap: 26, flip: ctx.flip }) };
  });
  const MINI = (o) => MXRD(Object.assign({ form: 'mx-mini' }, o));
  // 5 or 6 knobs in two rows, small enough to leave room for the logo
  const rows2 = (list) => list.map((k, i) => Object.assign(k, i < 3 ? { x: 30 + i * 34, y: 32, r: 10 } : { x: (list.length === 5 ? 47 : 30) + (i - 3) * 34, y: 70, r: 10 }));
  const bassDrive = (o = {}) => Object.assign({ clip: 'opamp', preHp: 40, gainMinDb: 6, gainMaxDb: 40, tone: 'eq3', eqRangeDb: 14, bassF: 100, midF: 700, trebleF: 2800, cleanSum: true, postLp: 6000, levelMaxDb: 4 }, o);

  tz.addDefs([
    // ---- minis
    MINI({ id: 'mx.m291', name: 'Dyno Comp Mini', ref: 'MXR M291 Dyna Comp Mini', code: 'MX291', logo: 'Dyno Comp', cat: 'Dynamics', color: '#c8202a', text: '#f4f4f4', led: '#ff2a1a',
      algo: 'comp', opts: { type: 'ota' },
      controls: [K('level', 'OUTPUT', { def: 0.4 }), K('sustain', 'SENS', { def: 0.55 }), TOG('att', '', ['FAST', 'SLOW'], { virtual: true, orient: 'h' })],
      derive: (p) => ({ attack: p.att ? 0.6 : 0.15 }),
      desc: 'The classic red squeeze in a mini box, with a fast or slow attack switch.' }),
    MINI({ id: 'mx.m299', name: 'Carbon Echo Mini', ref: 'MXR M299 Carbon Copy Mini', code: 'MX299', logo: 'Carbon Echo', logoSize: 14, cat: 'Delay', color: '#3d4a2e', text: '#f0f0f0', led: '#3d8bff',
      algo: 'delay', opts: { maxMs: 650 }, fixed: { mode: 1, tone: 0.32, modrate: 0.25 },
      controls: [K('feedback', 'REGEN', { def: 0.35, max: 1.05 }), K('mix', 'MIX', { def: 0.4 }), K('time', 'DELAY', { min: 20, max: 600, def: 300, display: ms }),
        BTN('MOD', { p: 'mod', toggle: true, ledColor: '#3d8bff' })],
      derive: (p) => ({ moddepth: p.mod ? 0.45 : 0 }),
      desc: 'Analog BBD delay up to 600 ms with a MOD switch, in a mini box.' }),
    MINI({ id: 'mx.m290', name: 'Phase Ninety-Five', ref: 'MXR M290 Phase 95', code: 'MX290', logo: 'Phase 95', cat: 'Modulation', color: '#f0731e', text: '#111', led: '#ff2a1a',
      algo: 'phaser', fixed: { mix: 0.5, depth: 0.85 },
      controls: [K('rate', 'SPEED', { def: 0.35 }), BTN('45/90', { p: 'p90', toggle: true, def: 1, ledColor: '#ff2a1a' }), BTN('SCRIPT', { p: 'script', toggle: true, ledColor: '#ff2a1a' })],
      initParams: { p90: 1 },
      derive: (p) => (p.p90 ? { stages: 4, feedback: p.script ? 0 : 0.35 } : { stages: 2, feedback: p.script ? 0 : 0.15 }),
      desc: 'Phase 45 and Phase 90 in one mini box. SCRIPT gives the smoother vintage voice.' }),
    // ---- standard boxes
    MXRD({ id: 'mx.m173', name: 'Classic 108 Fuzzer', ref: 'MXR M173 Classic 108 Fuzz', code: 'MX173', logo: 'Classic 108', logoSize: 18, cat: 'Fuzz', color: '#6d7177', text: '#f2f2f2', led: '#ff2a1a',
      algo: 'drive', opts: { clip: 'si', bias: 0.25, preHp: 70, gainMinDb: 12, gainMaxDb: 46, tone: 'none', postLp: 5400, levelMaxDb: 0, outTrim: 0.4 },
      controls: [K('level', 'VOLUME', { def: 0.55 }), K('gain', 'FUZZ', { def: 0.7 }), BTN('BUFFER', { p: 'buf', toggle: true, led: true, ledColor: '#ff2a1a' })],
      derive: (p) => ({ preHp: p.buf ? 110 : 70 }),
      desc: 'Silicon Fuzz Face circuit in an MXR box. BUFFER keeps the tone tight with a wah in front.' }),
    MXRD({ id: 'mx.m148', name: 'Micro Chorus 148', ref: 'MXR M148 Micro Chorus', code: 'MX148', logo: 'Micro Chorus', logoSize: 18, cat: 'Modulation', color: '#5aa0c8', text: '#111', led: '#ff2a1a',
      algo: 'chorus', fixed: { mix: 0.5, depth: 0.55, mode: 0 }, controls: [K('rate', 'RATE', { def: 0.35 })],
      desc: 'One-knob analog chorus.' }),
    MXRD({ id: 'mx.m152', name: 'Micro Flanger 152', ref: 'MXR M152 Micro Flanger', code: 'MX152', logo: 'Micro Flanger', logoSize: 17, cat: 'Modulation', color: '#3c4b6e', text: '#f0f0f0', led: '#ff2a1a',
      algo: 'flanger', fixed: { manual: 0.45, width: 0.6, mix: 0.5 }, controls: [K('regen', 'REGEN', { def: 0.5 }), K('speed', 'RATE', { def: 0.3 })] }),
    MXRD({ id: 'mx.m132', name: 'Super Squeeze', ref: 'MXR M132 Super Comp', code: 'MX132', logo: 'Super Comp', logoSize: 19, cat: 'Dynamics', color: '#2b6aa8', text: '#f2f2f2', led: '#ff2a1a',
      algo: 'comp', opts: { type: 'ota' }, controls: [K('level', 'OUTPUT', { def: 0.38 }), K('attack', 'ATTACK', { def: 0.3 }), K('sustain', 'SENSITIVITY', { def: 0.5 })] }),
    MXRD({ id: 'mx.m76', name: 'Studio Squeeze', ref: 'MXR M76 Studio Compressor', code: 'MX76', logo: 'Studio Comp', logoSize: 18, cat: 'Dynamics', color: '#2a2c30', text: '#ececec', led: '#3d8bff',
      algo: 'comp', opts: { type: 'vca' },
      controls: rows2([K('level', 'OUTPUT', { def: 0.36 }), K('sustain', 'SUSTAIN', { def: 0.5 }), K('ratio', 'RATIO', { def: 0.5 }), K('attack', 'ATTACK', { def: 0.3 }), K('release', 'RELEASE', { def: 0.4 })]),
      desc: 'Studio-style VCA compressor with ratio, attack and release.' }),
    MXRD({ id: 'mx.m87', name: 'Bass Squeeze', ref: 'MXR M87 Bass Compressor', code: 'MX87', logo: 'Bass Comp', logoSize: 19, cat: 'Dynamics', color: '#18181a', text: '#ececec', led: '#3d8bff',
      algo: 'comp', opts: { type: 'vca' }, fixed: { tone: 0.5 },
      controls: rows2([K('sustain', 'INPUT', { def: 0.5 }), K('ratio', 'RATIO', { def: 0.5 }), K('attack', 'ATTACK', { def: 0.3 }), K('release', 'RELEASE', { def: 0.4 }), K('level', 'OUTPUT', { def: 0.36 })]),
      desc: 'Bass compressor with full controls.' }),
    MXRD({ id: 'mx.m115', name: 'Dist Three', ref: 'MXR M115 Distortion III', code: 'MX115', logo: 'Dist III', cat: 'Distortion', color: '#1c3b6e', text: '#f2f2f2', led: '#ff2a1a',
      algo: 'drive', opts: { clip: 'diode', preHp: 90, gainMinDb: 8, gainMaxDb: 44, tone: 'lp', toneLo: 1400, toneHi: 9000, postLp: 7500, levelMaxDb: 4 },
      controls: [K('level', 'OUTPUT', { def: 0.42 }), K('tone', 'TONE', { def: 0.55 }), K('gain', 'DISTORTION', { def: 0.5 })] }),
    MXRD({ id: 'mx.m78', name: "Custom Bad '78", ref: "MXR M78 Custom Badass '78 Distortion", code: 'MX78', logo: "Bad '78", logoSize: 21, cat: 'Distortion', color: '#b3141b', text: '#f4f4f4', led: '#ff2a1a',
      algo: 'drive', opts: { clip: 'diode', preHp: 80, gainMinDb: 8, gainMaxDb: 46, tone: 'lp', toneLo: 1200, toneHi: 8000, postLp: 7500, levelMaxDb: 3, modes: [{}, { clip: 'led', levelMaxDb: 5 }] },
      controls: [K('level', 'OUTPUT', { def: 0.42 }), K('tone', 'FILTER', { def: 0.5 }), K('gain', 'DISTORTION', { def: 0.5 }), BTN('CRUNCH', { p: 'mode', toggle: true, led: true, ledColor: '#ff2a1a' })],
      desc: 'Late-70s style distortion. CRUNCH swaps in LED clipping for more volume and an open sound.' }),
    MXRD({ id: 'mx.m77', name: 'Custom Bad Mod OD', ref: 'MXR M77 Custom Badass Modified O.D.', code: 'MX77', logo: 'Bad Mod OD', logoSize: 19, cat: 'Overdrive', color: '#5d6b2e', text: '#f2f2f2', led: '#ff2a1a',
      algo: 'drive', opts: { clip: 'asym', bias: 0.15, preHp: 70, gainMinDb: 2, gainMaxDb: 38, tone: 'lp', toneLo: 1300, toneHi: 9000, levelMaxDb: 6, modes: [{}, { preEq: [{ type: 'peak', f: 100, q: 0.8, db: 5 }] }] },
      controls: [K('level', 'OUTPUT', { def: 0.5 }), K('tone', 'TONE', { def: 0.55 }), K('gain', 'GAIN', { def: 0.45 }), BTN('BUMP', { p: 'mode', toggle: true, led: true, ledColor: '#ff2a1a' })],
      desc: 'Tube Screamer-flavoured overdrive with more range. BUMP adds low end at 100 Hz.' }),
    MXRD({ id: 'mx.m193', name: 'GT-Drive', ref: 'MXR M193 GT-OD', code: 'MX193', logo: 'GT-Drive', cat: 'Overdrive', color: '#2d6b3a', text: '#f2f2f2', led: '#ff2a1a',
      algo: 'drive', opts: { clip: 'asym', bias: 0.1, preHp: 100, gainMinDb: 4, gainMaxDb: 40, tone: 'lp', toneLo: 1200, toneHi: 8000, levelMaxDb: 6 },
      controls: [K('level', 'OUTPUT', { def: 0.5 }), K('tone', 'TONE', { def: 0.5 }), K('gain', 'GAIN', { def: 0.45 })] }),
    MXRD({ id: 'mx.zw44', name: 'Wild Overdrive', ref: 'MXR ZW44 Wylde Overdrive', code: 'ZW44', logo: 'Wild OD', cat: 'Overdrive', color: '#141414', text: '#f2f2f2', logoColor: '#f2f2f2', led: '#ff2a1a',
      algo: 'drive', opts: { clip: 'diode', preHp: 120, gainMinDb: 4, gainMaxDb: 40, tone: 'lp', toneLo: 1100, toneHi: 8000, postLp: 7000, levelMaxDb: 7 },
      controls: [K('level', 'OUTPUT', { def: 0.5 }), K('tone', 'TONE', { def: 0.5 }), K('gain', 'GAIN', { def: 0.4 })],
      desc: 'Signature overdrive made to push an already driven amp.' }),
    MXRD({ id: 'mx.m279', name: 'Deep Phaser', ref: 'MXR M279 Deep Phase', code: 'MX279', logo: 'Deep Phase', logoSize: 19, cat: 'Modulation', color: '#6a2c8a', text: '#f2f2f2', led: '#ff2a1a',
      algo: 'phaser', opts: { stages: 4 }, fixed: { stages: 4, mix: 0.5 },
      controls: [K('rate', 'SPEED', { def: 0.3 }), K('depth', 'INTENSITY', { def: 0.8 }), BTN('VINTAGE', { p: 'vint', toggle: true, led: true, ledColor: '#ff2a1a' })],
      derive: (p) => ({ feedback: p.vint ? 0.15 : 0.5, script: p.vint ? 1 : 0 }),
      desc: 'Deep four-stage phaser. VINTAGE gives a softer, older sweep.' }),
    MXRD({ id: 'mx.m159', name: 'Stereo Shiver', ref: 'MXR M159 Stereo Tremolo', code: 'MX159', logo: 'Stereo Trem', logoSize: 18, cat: 'Modulation', color: '#1d6b6b', text: '#f2f2f2', led: '#ff2a1a',
      algo: 'tremolo', stereo: 'both', monoPorts: MONO, stereoPorts: { ins: ['INPUT'], outs: ['OUTPUT A', 'OUTPUT B'] },
      controls: [K('rate', 'SPEED', { def: 0.4 }), K('depth', 'DEPTH', { def: 0.6 }), K('wave', 'SHAPE', { def: 0.3 }), BTN('PAN', { p: 'stereo', toggle: true, led: true, ledColor: '#ff2a1a' })],
      fixed: { mode: 0 },
      desc: 'Tremolo with a shape knob. PAN bounces the sound between the two outputs.' }),
    // ---- bass
    MXRD({ id: 'mx.m89', name: 'Bass Drive', ref: 'MXR M89 Bass Overdrive', code: 'MX89', logo: 'Bass Drive', logoSize: 19, cat: 'Overdrive', color: '#26303a', text: '#ececec', led: '#ff2a1a',
      algo: 'drive', opts: bassDrive({ clip: 'asym', bias: 0.15, gainMinDb: 4, gainMaxDb: 34 }), fixed: { mid: 0.5 },
      controls: rows2([K('level', 'VOLUME', { def: 0.62 }), K('blend', 'BLEND', { def: 0.6 }), K('gain', 'GAIN', { def: 0.45 }), K('bass', 'BASS', { def: 0.5 }), K('treble', 'TREBLE', { def: 0.5 })]),
      desc: 'Bass overdrive with clean blend and two-band EQ.' }),
    MXRD({ id: 'mx.m85', name: 'Bass Dist', ref: 'MXR M85 Bass Distortion', code: 'MX85', logo: 'Bass Dist', logoSize: 19, cat: 'Distortion', color: '#141414', text: '#ececec', led: '#ff2a1a',
      algo: 'drive', opts: bassDrive({ clip: 'diode', gainMinDb: 12, gainMaxDb: 46, levelMaxDb: 2 }),
      controls: rows2([K('level', 'VOLUME', { def: 0.5 }), K('blend', 'BLEND', { def: 0.5 }), K('gain', 'DIST', { def: 0.55 }), K('bass', 'BASS', { def: 0.5 }), K('mid', 'MID', { def: 0.5 }), K('treble', 'TREBLE', { def: 0.5 })]),
      desc: 'Bass distortion with a clean blend to keep the low end solid.' }),
    MXRD({ id: 'mx.m83', name: 'Bass Chorus DLX', ref: 'MXR M83 Bass Chorus Deluxe', code: 'MX83', logo: 'Bass Chorus', logoSize: 18, cat: 'Modulation', color: '#3a3d8f', text: '#f2f2f2', led: '#3d8bff', cost: 1.1,
      algo: 'chain',
      opts: { chain: [{ prefix: 'c', algo: 'chorus', params: { mode: 0, mix: 0.5 } }, { prefix: 'f', algo: 'flanger', on: false, params: { mix: 0.5, manual: 0.45 } }] },
      stereo: 'both', monoPorts: MONO, stereoPorts: { ins: ['INPUT'], outs: ['OUTPUT A', 'OUTPUT B'] },
      controls: [K('mix', 'MIX', { def: 0.5, virtual: true }), K('rate', 'RATE', { def: 0.3, virtual: true }), K('depth', 'DEPTH', { def: 0.5, virtual: true }), K('xover', 'X-OVER', { def: 0.3, virtual: true }),
        BTN('FLANGER', { p: 'fl', toggle: true, led: true, ledColor: '#3d8bff' })],
      derive: (p) => {
        const fl = p.fl ? 1 : 0, m = p.mix ?? 0.5;
        return { 'c.on': fl ? 0 : 1, 'f.on': fl, 'c.mix': m, 'f.mix': m, 'c.rate': p.rate ?? 0.3, 'f.speed': p.rate ?? 0.3, 'c.depth': p.depth ?? 0.5, 'f.width': p.depth ?? 0.5, 'c.tone': 0.3 + 0.6 * (p.xover ?? 0.3) };
      },
      desc: 'Bass chorus or flanger. X-OVER keeps the lows dry (approximated with the chorus tone).' }),
    MXRD({ id: 'mx.m81', name: 'Bass Pre', ref: 'MXR M81 Bass Preamp', code: 'MX81', logo: 'Bass Pre', logoFont: "'Oswald', sans-serif", logoSize: 19, cat: 'Preamp', kind: 'Preamp', color: '#1a1a1a', text: '#ececec', led: '#3d8bff',
      algo: 'peq', ports: { ins: ['INPUT'], outs: ['OUTPUT', 'DI OUT'] }, jackKinds: { o1: 'xlr' }, stereo: 'fixedDual',
      fixed: { lowfreq: 80, highfreq: 4000, mid1q: 0.8 },
      controls: rows2([K('level', 'VOLUME', { min: -12, max: 12, def: 0, display: db }), K('highgain', 'TREBLE', { min: -15, max: 15, def: 0, display: db }), K('mid1gain', 'MID', { min: -15, max: 15, def: 0, display: db }),
        K('mid1freq', 'FREQ', { min: 200, max: 3000, def: 600, curve: 'log' }), K('lowgain', 'BASS', { min: -15, max: 15, def: 0, display: db })]),
      desc: 'Clean bass preamp with sweepable mid and a balanced DI output.' }),
  ]);
}
