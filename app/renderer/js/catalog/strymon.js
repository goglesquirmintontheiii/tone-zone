// Boutique digital pedals inspired by the Strymon line-up and the Line 6 POD Express.
import { K, TOG, FOOT, LED, BTN, def, ms, STEREO, MONO } from './helpers.js';

const S = (o) => def(Object.assign({ form: 'strymon', brand: 'Strymon', stereo: 'stereo', ports: STEREO, cost: 1.2 }, o));
const onFoot = (o = {}) => FOOT(Object.assign({ action: 'bypass', label: 'ON' }, o));
const onLed = () => LED({ bind: 'on' });

export const strymonPedals = [
  // ---------- V2 medium enclosures
  S({
    id: 'sy.flint', name: 'Quartz Trem & Verb', ref: 'Strymon Flint V2', code: 'QUARTZ', logo: 'quartz', tagline: 'TREMOLO & REVERB', cat: 'Modulation', color: '#7d1d22',
    algo: 'chain',
    opts: { chain: [{ prefix: 't', algo: 'tremolo' }, { prefix: 'r', algo: 'reverb', params: { mode: 3 } }] },
    controls: [
      K('t.depth', 'INTENSITY', { x: 46, y: 42, def: 0.55 }),
      K('t.rate', 'SPEED', { x: 46, y: 104, def: 0.45 }),
      TOG('ttype', 'TREMOLO', ["'61 harm", "'63 tube", "'65 photo"], { x: 92, y: 74, def: 1 }),
      K('r.mix', 'MIX', { x: 128, y: 42, def: 0.35 }),
      K('r.decay', 'DECAY', { x: 170, y: 42, def: 0.45 }),
      K('r.tone', 'COLOR', { x: 170, y: 104, def: 0.55 }),
      TOG('rtype', 'REVERB', ["'60s", "'70s", "'80s"], { x: 128, y: 104, def: 0 }),
      FOOT({ action: 'param', p: 't.on', toggle: true, label: 'TREMOLO', x: 55, y: 192, style: 'stomp', r: 12 }),
      FOOT({ action: 'param', p: 'r.on', toggle: true, label: 'REVERB', x: 149, y: 192, style: 'stomp', r: 12 }),
      LED({ x: 55, y: 166, bind: 'rate:t.on:t.rate' }), LED({ x: 149, y: 166, bind: 'param:r.on' }),
    ],
    derive: (p) => ({ 't.mode': [1, 2, 0][p.ttype ?? 1], 'r.mode': [3, 2, 1][p.rtype ?? 0] }),
    alwaysOn: true, initParams: { 't.on': 1, 'r.on': 1 },
  }),
  S({
    id: 'sy.deco', name: 'Retro Tape Doubler', ref: 'Strymon Deco V2', code: 'RETRO', logo: 'retro', tagline: 'TAPE SATURATION & DOUBLETRACKER', cat: 'Drive', color: '#c9b48f',
    algo: 'deco',
    controls: [
      K('saturation', 'SATURATION', { x: 36, y: 42, def: 0.4 }), K('volume', 'VOLUME', { x: 80, y: 42 }), K('tone', 'TONE', { x: 58, y: 110 }),
      TOG('voice', 'VOICE', ['classic', 'cassette'], { x: 58, y: 78, orient: 'h' }),
      K('lag', 'LAG TIME', { x: 124, y: 42, def: 0.3 }), K('blend', 'BLEND', { x: 168, y: 42 }), K('wobble', 'WOBBLE', { x: 146, y: 110, def: 0.3 }),
      TOG('type', 'TYPE', ['sum', 'invert', 'bounce'], { x: 146, y: 78, orient: 'h' }),
      FOOT({ action: 'param', p: 'satOn', toggle: true, label: 'TAPE SATURATION', x: 55, y: 192, r: 12 }),
      FOOT({ action: 'param', p: 'dtOn', toggle: true, label: 'DOUBLETRACKER', x: 149, y: 192, r: 12, holdAuto: { p: 'lag', from: 0.04, to: 0.22, ms: 1600 } }),
      LED({ x: 55, y: 166, bind: 'param:satOn' }), LED({ x: 149, y: 166, bind: 'param:dtOn' }),
    ],
    derive: (p) => (p.voice ? { saturation: Math.min(1, (p.saturation ?? 0.4) * 1.3 + 0.1), tone: (p.tone ?? 0.5) * 0.75 } : {}),
    alwaysOn: true, initParams: { satOn: 1, dtOn: 1 },
    desc: 'Hold DOUBLETRACKER for an Auto-Flange sweep.',
  }),
  S({
    id: 'sy.bluesky', name: 'Azure Reverberator', ref: 'Strymon BlueSky V2', code: 'AZURE', logo: 'azure', tagline: 'REVERBERATOR', cat: 'Reverb', color: '#1f5fa8',
    algo: 'reverb', cost: 1.5,
    controls: [
      K('decay', 'DECAY', { def: 0.5 }), K('predelay', 'PRE-DELAY', { min: 0, max: 500, def: 30, display: ms }), K('mix', 'MIX', { def: 0.35 }),
      K('lowdamp', 'LOW', { def: 0.5 }), K('shimmer', 'SHIMMER', { def: 0 }), K('highdamp', 'HIGH', { def: 0.5, invert: true }),
      TOG('verb', 'VERB', ['plate', 'room', 'spring'], { orient: 'h' }), TOG('modsw', 'MOD', ['off', 'light', 'deep'], { orient: 'h', values: [0, 0.35, 1] }),
      FOOT({ action: 'favorite', label: 'FAV' }), onFoot(), LED({ bind: 'fav', color: '#ff2a1a' }), onLed(),
    ],
    derive: (p) => {
      const base = [2, 0, 3][p.verb ?? 0];
      const sh = p.shimmer ?? 0;
      return { mode: sh > 0.03 && base === 2 ? 4 : base, mod: [0, 0.35, 1][p.modsw ?? 0], highdamp: 1 - (p.highdamp ?? 0.5) };
    },
  }),
  S({
    id: 'sy.elcap', name: 'Mission dTape Echo', ref: 'Strymon El Capistan V2', code: 'MISSION', logo: 'mission', tagline: 'dTAPE ECHO', cat: 'Delay', color: '#6f747b',
    algo: 'chain', cost: 1.4,
    opts: { chain: [{ prefix: 'd', algo: 'delay', opts: { maxMs: 1600, fixedMode: 2 } }, { prefix: 's', algo: 'reverb', params: { mode: 3, mix: 0 } }] },
    controls: [
      K('d.time', 'TIME', { min: 60, max: 1500, def: 380, display: ms }), K('d.mix', 'MIX', { def: 0.4 }), K('d.feedback', 'REPEATS', { def: 0.4, max: 1.1 }),
      K('d.age', 'TAPE AGE', { def: 0.3 }), K('wf', 'WOW & FLUTTER', { def: 0.3, virtual: true }), K('s.mix', 'SPRING', { def: 0 }),
      TOG('head', 'TAPE HEAD', ['fixed', 'multi', 'single'], { orient: 'h' }), TOG('tmode', 'MODE', ['A', 'B', 'C'], { orient: 'h' }),
      FOOT({ action: 'tap', label: 'TAP', hold: { event: { type: 2, value: 1, arg: 0 }, release: { type: 2, value: 0, arg: 0 } } }), onFoot(),
      LED({ bind: 'tap:d.time' }), onLed(),
    ],
    derive: (p) => {
      const headsTable = [[4, 6, 7], [5, 3, 7], [4, 2, 1]][p.head ?? 0];
      return { 'd.heads': headsTable[p.tmode ?? 0], 'd.moddepth': (p.wf ?? 0.3) * 0.6, 'd.modrate': 0.2 + 0.3 * (p.wf ?? 0.3), 's.decay': 0.4 };
    },
    tapTarget: 'd.time',
    desc: 'Hold TAP for infinite repeats.',
  }),
  S({
    id: 'sy.riverside', name: 'Delta Multistage Drive', ref: 'Strymon Riverside', code: 'DELTA', logo: 'delta', tagline: 'MULTISTAGE DRIVE', cat: 'Overdrive', color: '#9a3b22', stereo: 'mono', ports: MONO, cost: 0.8,
    algo: 'drive', opts: { clip: 'jfet', bias: 0.2, stages: 2, stage2Db: 8, preHp: 40, gainMinDb: 0, gainMaxDb: 34, tone: 'eq3', eqRangeDb: 12, bassF: 110, midF: 750, trebleF: 2800, postLp: 9000, levelMaxDb: 8,
      modes: [{}, { preEq: [{ type: 'peak', f: 900, q: 0.8, db: 5 }] }, { gainMaxDb: 52 }, { gainMaxDb: 52, preEq: [{ type: 'peak', f: 900, q: 0.8, db: 5 }] }] },
    rows: [2],
    controls: [
      K('gain', 'DRIVE', { x: 70, y: 42 }), K('level', 'LEVEL', { x: 134, y: 42 }),
      K('bass', 'BASS', { x: 46, y: 106 }), K('mid', 'MIDDLE', { x: 102, y: 106 }), K('treble', 'TREBLE', { x: 158, y: 106 }),
      TOG('gainsw', 'GAIN', ['low', 'high'], { x: 28, y: 44, orient: 'h' }), TOG('push', 'PUSH', ['flat', 'enh.'], { x: 176, y: 44, orient: 'h' }),
      FOOT({ action: 'favorite', label: 'FAVORITE' }), onFoot(), LED({ bind: 'fav' }), onLed(),
    ],
    derive: (p) => ({ mode: (p.gainsw ?? 0) * 2 + (p.push ?? 0) }),
  }),
  S({
    id: 'sy.dig', name: 'Binary Dual Delay', ref: 'Strymon DIG V2', code: 'BINARY', logo: 'binary', tagline: 'DUAL DIGITAL DELAY', cat: 'Delay', color: '#1d4a5a',
    algo: 'delay', opts: { maxMs: 1600, fixedMode: 8 },
    controls: [
      K('time', 'TIME', { min: 20, max: 1500, def: 420, display: ms }), K('spread', 'TIME 2', { def: 0.5 }), K('tone', 'TONE', { def: 0.6 }),
      K('mix', 'MIX', { def: 0.35 }), K('mix2', 'MIX 2', { def: 0.5, virtual: true }), K('feedback', 'REPEATS', { def: 0.35, max: 1.0 }),
      TOG('dtype', 'DELAY TYPE', ['24/96', 'adm', '12 bit'], { orient: 'h' }), TOG('modt', 'MOD TYPE', ['off', 'light', 'deep'], { orient: 'h', def: 1 }),
      FOOT({ action: 'tap', label: 'TAP' }), onFoot(), LED({ bind: 'tap:time' }), onLed(),
    ],
    derive: (p) => ({ moddepth: [0, 0.2, 0.55][p.modt ?? 1], tone: p.dtype === 2 ? Math.min(p.tone ?? 0.6, 0.4) : p.tone ?? 0.6, age: p.dtype === 1 ? 0.3 : 0 }),
  }),
  S({
    id: 'sy.lex', name: 'Rotor Rotary', ref: 'Strymon Lex V2', code: 'ROTOR', logo: 'rotor', tagline: 'ROTARY', cat: 'Modulation', color: '#8f2323',
    algo: 'rotary',
    controls: [
      K('accel', 'SPEED', { def: 0.5 }), K('balance', 'HORN LEVEL', { def: 0.5 }), K('mix', 'MIC DISTANCE', { def: 0.9 }),
      K('level', 'VOLUME', { def: 0.5 }), K('drive', 'PREAMP DRIVE', { def: 0.25 }), K('dry', 'DRY', { def: 0, virtual: true }),
      TOG('mic', 'MIC', ['front', 'rear'], { orient: 'h' }), TOG('ramp', 'RAMP', ['slow', 'fast'], { orient: 'h', virtual: true }),
      onFoot(), FOOT({ action: 'param', p: 'speed', toggle: true, label: 'SLOW/FAST' }), onLed(), LED({ bind: 'rate:on:speedlex', color: '#ff2a1a' }),
    ],
    derive: (p) => ({ mix: Math.max(0.5, 1 - (p.dry ?? 0) * 0.5) * (p.mix ?? 0.9) / 0.9 }),
  }),
  S({
    id: 'sy.sunset', name: 'Dusk Dual Overdrive', ref: 'Strymon Sunset', code: 'DUSK', logo: 'dusk', tagline: 'DUAL OVERDRIVE', cat: 'Overdrive', color: '#c8662a', stereo: 'mono', ports: MONO,
    algo: 'chain',
    opts: { chain: [
      { prefix: 'a', algo: 'drive', opts: { tone: 'tilt', eqRangeDb: 9, levelMaxDb: 8, modes: [{ clip: 'asym', preEq: [{ type: 'hs', f: 1500, q: 0.7, db: 6 }], gainMaxDb: 30 }, { clip: 'ge', bias: 0.25, gainMaxDb: 34 }, { clip: 'ts', cleanSum: true, clipHp: 720, gainMaxDb: 40 }] } },
      { prefix: 'b', algo: 'drive', opts: { tone: 'tilt', eqRangeDb: 9, levelMaxDb: 8, modes: [{ clip: 'jfet', gainMaxDb: 32 }, { clip: 'tube', stages: 2, gainMaxDb: 40 }, { clip: 'diode', gainMaxDb: 44 }] } },
    ] },
    controls: [
      K('a.level', 'LEVEL', { x: 36, y: 42 }), K('a.gain', 'DRIVE', { x: 80, y: 42 }), K('a.tone', 'TONE', { x: 58, y: 110 }),
      TOG('a.mode', 'TYPE', ['treble', 'Ge', 'texas'], { x: 58, y: 78, orient: 'h' }),
      K('b.level', 'LEVEL', { x: 124, y: 42 }), K('b.gain', 'DRIVE', { x: 168, y: 42 }), K('b.tone', 'TONE', { x: 146, y: 110 }),
      TOG('b.mode', 'TYPE', ['JFET', '2stage', 'hard'], { x: 146, y: 78, orient: 'h' }),
      FOOT({ action: 'param', p: 'a.on', toggle: true, label: 'A', x: 55, y: 192, r: 12 }), FOOT({ action: 'param', p: 'b.on', toggle: true, label: 'B', x: 149, y: 192, r: 12 }),
      LED({ x: 55, y: 166, bind: 'param:a.on' }), LED({ x: 149, y: 166, bind: 'param:b.on' }),
    ],
    alwaysOn: true, initParams: { 'a.on': 1, 'b.on': 0 },
  }),
  S({
    id: 'sy.compadre', name: 'Amigo Comp & Boost', ref: 'Strymon Compadre', code: 'AMIGO', logo: 'amigo', tagline: 'COMPRESSOR & BOOST', cat: 'Dynamics', color: '#3e5f7a', stereo: 'mono', ports: MONO,
    algo: 'chain', opts: { chain: [{ prefix: 'c', algo: 'comp', opts: { type: 'vca' } }, { prefix: 'b', algo: 'boost', opts: { gainMaxDb: 20 } }] },
    controls: [
      TOG('beq', 'BOOST EQ', ['treble', 'mid', 'flat'], { x: 46, y: 42, orient: 'h', def: 2 }), K('c.blend', 'DRY LEVEL', { x: 102, y: 42, def: 0.9, invert: true }), K('b.gain', 'BOOST', { x: 158, y: 42, def: 0.4 }),
      TOG('ctype', 'COMP TYPE', ['studio', 'squeeze'], { x: 46, y: 104, orient: 'h' }), K('c.sustain', 'COMPRESSION', { x: 102, y: 104, def: 0.5 }), K('c.level', 'LEVEL', { x: 158, y: 104, def: 0.5 }),
      FOOT({ action: 'param', p: 'c.on', toggle: true, label: 'COMP', x: 55, y: 192, r: 12 }), FOOT({ action: 'param', p: 'b.on', toggle: true, label: 'BOOST', x: 149, y: 192, r: 12 }),
      LED({ x: 55, y: 166, bind: 'param:c.on' }), LED({ x: 149, y: 166, bind: 'param:b.on' }),
    ],
    derive: (p) => ({ 'c.blend': 1 - (p['c.blend'] ?? 0.1), 'c.ratio': p.ctype ? 0.9 : 0.3, 'b.treble': p.beq === 0 ? 0.75 : 0.5, 'b.bass': p.beq === 1 ? 0.4 : 0.5 }),
    alwaysOn: true, initParams: { 'c.on': 1, 'b.on': 0, 'c.blend': 0.1 },
  }),
  S({
    id: 'sy.ola', name: 'Wave Chorus & Vibrato', ref: 'Strymon Ola', code: 'WAVE', logo: 'wave', tagline: 'dBUCKET CHORUS & VIBRATO', cat: 'Modulation', color: '#2f8f8a',
    algo: 'chorus', opts: { invertR: false },
    controls: [
      K('rate', 'SPEED', { def: 0.35 }), K('depth', 'DEPTH', { def: 0.5 }), K('mix', 'MIX', { def: 0.5 }),
      K('tone', 'TONE', { def: 0.5 }), K('delay', 'RAMP | ENV', { def: 0.5 }),
      TOG('otype', 'TYPE', ['chorus', 'multi', 'vibrato'], { orient: 'h' }), TOG('omode', 'MODE', ['norm', 'env', 'ramp'], { orient: 'h', virtual: true }),
      FOOT({ action: 'favorite', label: 'FAVORITE' }), onFoot({ label: 'BYPASS' }), LED({ bind: 'fav' }), onLed(),
    ],
    derive: (p) => ({ mode: [0, 2, 1][p.otype ?? 0] }),
  }),
  S({
    id: 'sy.brigadier', name: 'Colonel dBucket Delay', ref: 'Strymon Brigadier', code: 'COLONEL', logo: 'colonel', tagline: 'dBUCKET DELAY', cat: 'Delay', color: '#2f4a3a',
    algo: 'delay', opts: { maxMs: 1250, fixedMode: 1 },
    controls: [
      K('dtime', 'TIME', { def: 0.45, virtual: true }), K('feedback', 'REPEATS', { def: 0.4, max: 1.1 }), K('mix', 'MIX', { def: 0.4 }),
      K('tone', 'BUCKET LOSS', { def: 0.3, invert: true }), K('moddepth', 'MOD', { def: 0.2 }),
      TOG('range', 'MODE', ['short', 'med', 'long'], { orient: 'h', def: 1 }), TOG('subdiv', 'TAP', ['quarter', 'dot', 'triplet'], { orient: 'h', values: [0, 1, 3] }),
      FOOT({ action: 'tap', label: 'TAP', hold: { event: { type: 2, value: 1 }, release: { type: 2, value: 0 } } }), onFoot({ label: 'BYPASS' }), LED({ bind: 'tap:time' }), onLed(),
    ],
    derive: (p) => {
      const r = [[20, 300], [60, 600], [100, 1200]][p.range ?? 1];
      return { time: r[0] + (r[1] - r[0]) * (p.dtime ?? 0.45), tone: 1 - (p.tone ?? 0.3) * 0.8 };
    },
  }),
  S({
    id: 'sy.volante', name: 'Flyer Magnetic Echo', ref: 'Strymon Volante', code: 'FLYER', logo: 'flyer', tagline: 'MAGNETIC ECHO MACHINE', cat: 'Delay', color: '#5a4a3c', rows: [4],
    algo: 'chain', cost: 1.5,
    opts: { chain: [{ prefix: 'd', algo: 'delay', opts: { maxMs: 2000, fixedMode: 2 } }, { prefix: 's', algo: 'reverb', params: { mode: 3, mix: 0 } }] },
    controls: [
      K('d.time', 'TIME', { min: 50, max: 1800, def: 450, display: ms, r: 11 }), K('d.mix', 'ECHO LEVEL', { def: 0.4, r: 11 }), K('d.feedback', 'REPEATS', { def: 0.4, max: 1.1, r: 11 }), K('s.mix', 'SPRING', { def: 0.1, r: 11 }),
      K('d.age', 'WEAR', { def: 0.35, r: 11 }), K('d.moddepth', 'MECHANICS', { def: 0.25, r: 11 }), K('d.lowcut', 'LOW CUT', { def: 0.2, r: 11 }),
      TOG('vtype', 'TYPE', ['drum', 'tape', 'studio'], { orient: 'h', x: 102, y: 74, def: 1 }),
      FOOT({ action: 'tap', label: 'TAP', hold: { event: { type: 2, value: 1, arg: 0 }, release: { type: 2, value: 0, arg: 0 } } }), onFoot(), LED({ bind: 'tap:d.time' }), onLed(),
    ],
    derive: (p) => ({ 'd.heads': [7, 5, 4][p.vtype ?? 1], 'd.sat': [0.5, 0.35, 0.1][p.vtype ?? 1] }),
    tapTarget: 'd.time',
  }),
  // ---------- small single-footswitch family
  S({
    id: 'sy.cloudburst', name: 'Cumulus Ambient Reverb', ref: 'Strymon CloudBurst', code: 'CUMULUS', logo: 'cumulus', tagline: 'AMBIENT REVERB', cat: 'Reverb', small: true, color: '#e8e8e6', text: '#1a1a1a',
    algo: 'reverb', opts: { fixedMode: 5 }, cost: 1.6,
    controls: [
      K('decay', 'DECAY', { def: 0.55 }), TOG('ens', 'ENSEMBLE', ['off', 'med', 'max'], { x: 64, y: 40, orient: 'h', values: [0, 0.45, 1] }), K('mix', 'MIX', { def: 0.4 }),
      K('predelay', 'PRE-DELAY', { min: 0, max: 400, def: 20, display: ms }), K('tone', 'TONE', { def: 0.55 }), K('mod', 'MOD', { def: 0.25 }),
      onFoot({ label: '' }), onLed(),
    ],
    derive: (p) => ({ ensemble: [0, 0.45, 1][p.ens ?? 0] }),
  }),
  S({
    id: 'sy.ultraviolet', name: 'Violet Vintage Vibe', ref: 'Strymon UltraViolet', code: 'VIOLET', logo: 'violet', tagline: 'VINTAGE VIBE', cat: 'Modulation', small: true, color: '#5a2d82',
    algo: 'vibe',
    controls: [
      K('speed', 'SPEED', { def: 0.4 }), K('intensity', 'INTENSITY', { def: 0.7 }), K('level', 'VOLUME', { def: 0.5 }),
      TOG('uvmode', 'MODE', ['chorus', 'blend', 'vibrato'], { orient: 'h', x: 38, y: 92 }), TOG('bias', 'BIAS', ['low', 'mid', 'high'], { orient: 'h', x: 90, y: 92, def: 1 }),
      onFoot({ label: '' }), LED({ bind: 'rate:on:speed', color: '#ff2a1a' }),
    ],
    derive: (p) => ({ mode: p.uvmode === 2 ? 1 : 0, drive: [0.1, 0.3, 0.6][p.bias ?? 1], tone: p.uvmode === 1 ? 0.75 : 0.6 }),
  }),
  S({
    id: 'sy.fairfax', name: 'Bayside Class-A Drive', ref: 'Strymon Fairfax', code: 'BAYSIDE', logo: 'bayside', tagline: 'CLASS A OVERDRIVE', cat: 'Overdrive', small: true, color: '#6b7a3a', stereo: 'mono', ports: MONO, cost: 0.6,
    algo: 'drive', opts: { clip: 'jfet', bias: 0.3, preHp: 40, gainMinDb: 0, gainMaxDb: 36, tone: 'lp', toneLo: 3500, toneHi: 12000, postLp: 8500, levelMaxDb: 8 },
    fixed: { tone: 0.55 },
    controls: [K('level', 'LEVEL'), K('sag', 'SAG', { def: 0.3 }), K('gain', 'DRIVE'), TOG('bright', 'BRIGHT', ['off', 'on'], { orient: 'h', x: 64, y: 92 }), onFoot({ label: '' }), LED({ bind: 'on', color: '#ffb000' })],
  }),
  S({
    id: 'sy.brig', name: 'Major dBucket Delay', ref: 'Strymon Brig', code: 'MAJOR', logo: 'major', tagline: 'dBUCKET DELAY', cat: 'Delay', small: true, color: '#30352f',
    algo: 'delay', opts: { maxMs: 2100, fixedMode: 1 },
    controls: [
      K('time', 'TIME', { min: 20, max: 2000, def: 400, display: ms }), TOG('voice', 'VOICE', ['3205', 'multi', '3005'], { orient: 'h', x: 64, y: 40 }), K('mix', 'MIX', { def: 0.4 }),
      K('tone', 'FILTER', { def: 0.45 }), K('feedback', 'REPEATS', { def: 0.4, max: 1.1 }), K('moddepth', 'MOD', { def: 0.2 }),
      onFoot({ label: '', hold: { action: 'tapMode' } }), LED({ bind: 'tap:time' }),
    ],
    derive: (p) => ({ heads: p.voice === 1 ? 6 : 4, age: p.voice === 2 ? 0.4 : 0.1 }),
  }),
];

// ------------------------------------------------------------------ Line 6 POD Express style
const podAmps = ['deluxe', 'jcm800', 'dc30', 'dumble', 'friedman', 'recto', '5150'];
const podCabs = ['1x12us', '4x12t75', '2x12blue', '2x12cream', '4x12gb', '4x12v30', '4x12uber'];
export const podExpress = def({
  id: 'l6.podexpress', name: 'Rig X Express', ref: 'Line 6 POD Express', brand: 'Line 6', code: 'RIG X', logo: 'RIG X  EXPRESS', cat: 'Multi-FX', form: 'pod', color: '#c3161c',
  algo: 'chain', stereo: 'stereo', ports: { ins: ['IN'], outs: ['OUT L/MONO', 'OUT RIGHT'] }, cost: 6,
  opts: { chain: [
    { prefix: 'gt', algo: 'gate', params: { threshold: 0.25 } },
    { prefix: 'ds', algo: 'drive', opts: { modes: [{ clip: 'ge', cleanSum: true, gainMaxDb: 24, tone: 'tilt' }, { clip: 'ts', cleanSum: true, clipHp: 720, gainMaxDb: 40, tone: 'ts', toneLo: 723 }, { clip: 'diode', gainMaxDb: 46, tone: 'blend' }, { clip: 'si', gainMaxDb: 50, tone: 'lp' }] } },
    { prefix: 'amp', algo: 'amp', opts: { models: podAmps } },
    { prefix: 'cab', algo: 'cab', opts: { models: podCabs } },
    { prefix: 'm1', algo: 'chorus', on: false }, { prefix: 'm2', algo: 'flanger', on: false }, { prefix: 'm3', algo: 'phaser', on: false }, { prefix: 'm4', algo: 'tremolo', on: false },
    { prefix: 'dl', algo: 'delay', opts: { maxMs: 2000 } },
    { prefix: 'rv', algo: 'reverb' },
  ] },
  controls: [
    K('dist', 'DIST', { x: 46, y: 50, r: 15, def: 0, virtual: true, alt: 'amp.gain', altLabel: 'GAIN' }),
    K('rev', 'REVERB', { x: 138, y: 50, r: 15, def: 0.3, virtual: true, alt: 'amp.treble', altLabel: 'TREBLE' }),
    K('mod', 'MOD', { x: 46, y: 132, r: 15, def: 0, virtual: true, alt: 'amp.mid', altLabel: 'MID' }),
    K('dly', 'DELAY', { x: 138, y: 132, r: 15, def: 0, virtual: true, alt: 'amp.bass', altLabel: 'BASS' }),
    { t: 'sel', p: 'ampsel', label: 'AMP', options: ['OFF', 'CLEAN', 'SPECIAL', 'CHIME', 'DYNAMIC', 'CRUNCH', 'HEAVY', 'LEAD'], x: 92, y: 90, r: 19, def: 5, sweep: 300, style: 'chrome', printLabels: false, ring: true, labelPos: 'above', alt: 'amp.level', altLabel: 'CH VOL' },
    BTN('ALT', { x: 92, y: 132, shape: 'rect', w: 18, h: 8, action: 'alt', led: true, ledDy: -8, ledColor: '#ffffff' }),
    FOOT({ action: 'bypass', label: 'ON', x: 50, y: 222, r: 12 }),
    FOOT({ action: 'tap', label: 'TAP', x: 134, y: 222, r: 12, tapTarget: 'dl.time' }),
    LED({ x: 50, y: 196, bind: 'on' }), LED({ x: 134, y: 196, bind: 'tap:dl.time' }),
  ],
  initParams: { 'amp.gain': 0.5, 'amp.treble': 0.5, 'amp.mid': 0.5, 'amp.bass': 0.5, 'amp.level': 0, 'dl.time': 400 },
  derive: (p) => {
    const quad = (v) => {
      if (v < 0.03) return [-1, 0];
      const x = (v - 0.03) / 0.97 * 4;
      const q = Math.min(3, Math.floor(x));
      return [q, x - q];
    };
    const o = {};
    const [dq, dv] = quad(p.dist ?? 0);
    o['ds.on'] = dq >= 0 ? 1 : 0;
    o['ds.mode'] = Math.max(0, dq);
    o['ds.gain'] = 0.25 + 0.75 * dv;
    o['ds.level'] = 0.55;
    const a = p.ampsel ?? 5;
    o['amp.on'] = a > 0 ? 1 : 0;
    o['cab.on'] = a > 0 ? 1 : 0;
    o['amp.channel'] = Math.max(0, a - 1);
    o['cab.model'] = Math.max(0, a - 1);
    const [mq, mv] = quad(p.mod ?? 0);
    for (let i = 0; i < 4; i++) o[`m${i + 1}.on`] = mq === i ? 1 : 0;
    o['m1.mix'] = 0.3 + 0.5 * mv; o['m2.mix'] = 0.3 + 0.5 * mv; o['m3.mix'] = 0.3 + 0.5 * mv; o['m4.depth'] = 0.2 + 0.8 * mv;
    const [lq, lv] = quad(Math.min(p.dly ?? 0, 0.999));
    o['dl.on'] = lq >= 0 ? 1 : 0;
    o['dl.mode'] = [1, 0, 2, 7][Math.max(0, lq)];
    o['dl.mix'] = 0.15 + 0.5 * lv;
    o['dl.feedback'] = 0.25 + 0.35 * lv;
    const [rq, rv] = quad(p.rev ?? 0.3);
    o['rv.on'] = rq >= 0 ? 1 : 0;
    o['rv.mode'] = [3, 1, 2, 5][Math.max(0, rq)];
    o['rv.mix'] = 0.15 + 0.45 * rv;
    return o;
  },
  desc: 'Four effect knobs each sweep four models (fully counter-clockwise = off). AMP encoder: 7 amps + off. Press ALT to turn the knobs into GAIN / MID / BASS / TREBLE / CH VOL.',
});
