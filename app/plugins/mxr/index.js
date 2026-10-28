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
      controls: [K('level', 'OUTPUT', { def: 0.55 }), K('gain', 'DISTORTION', { def: 0.5 })] }),
    MXRD({ id: 'mx.m133', name: 'Mini Amp', ref: 'MXR M133 Micro Amp', code: 'MX133', logo: 'Mini Amp', cat: 'Boost', color: '#efe9da', text: '#111', led: '#ff2a1a',
      algo: 'boost', opts: { gainMaxDb: 26 }, controls: [K('gain', 'GAIN', { def: 0.4 })] }),
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
      controls: [K('d.level', 'VOLUME', { r: 10 }), K('d.gain', 'GAIN', { r: 10 }), K('d.midfreq', 'FREQ', { r: 10 }), K('d.mid', 'MID', { r: 10 }), K('d.bass', 'LOW', { r: 10 }), K('d.treble', 'HIGH', { r: 10 }),
        BTN('SCOOP', { p: 'd.mode', toggle: true, led: true, ledColor: '#ff2a1a', x: 92, y: 120, ledDy: -9 }), BTN('GATE', { p: 'g.on', toggle: true, led: true, ledColor: '#3ddc84', x: 36, y: 120, ledDy: -9 })] }),
    MXRD({ id: 'mx.m75', name: 'Super Bad Dist', ref: 'MXR M75 Super Badass Distortion', code: 'MX75', logo: 'Super Bad', cat: 'Distortion', color: '#151515', text: '#e9e9e9',
      algo: 'drive', opts: { clip: 'asym', bias: 0.2, preHp: 80, gainMinDb: 6, gainMaxDb: 44, tone: 'eq3', eqRangeDb: 14, bassF: 120, midF: 900, trebleF: 3000, postLp: 8000, levelMaxDb: 6 },
      controls: [K('level', 'OUTPUT', { r: 11 }), K('bass', 'BASS', { r: 11 }), K('mid', 'MID', { r: 11 }), K('treble', 'TREBLE', { r: 11 }), K('gain', 'DISTORTION', { r: 11 })] }),
    MXRD({ id: 'mx.m68', name: 'Vibe Machine', ref: 'MXR M68 Uni-Vibe', code: 'MX68', logo: 'Vibe Machine', logoSize: 18, cat: 'Modulation', color: '#5a2a1a', text: '#f0e6d6', wide: true,
      algo: 'vibe', controls: [K('level', 'VOLUME'), K('intensity', 'INTENSITY', { def: 0.7 }), K('speed', 'SPEED', { def: 0.4 }), TOG('mode', '', ['CHORUS', 'VIBRATO'], { x: 98, y: 80, orient: 'h' })] })
  ]);
}
