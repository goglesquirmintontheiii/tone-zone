// Built-in Tone Zone plugin: Strymon.
// Blocks inspired by Strymon gear. Names, logos and artwork are Tone Zone originals; control layouts and
// colours follow the real units (see each block's `ref`) so moving between the real thing and the virtual one is easy.
export default function register(tz) {
  const { K, SEL, TOG, BTN, FOOT, LED, SLIDER, SCREEN, TREADLE, MIC, def, ten, pct, db, ms, MONO, STEREO, MONO_TO_ST, STD } = tz.helpers;
  const { BOSS, NINE, MXRD, lvl, tone, gain, S, onFoot, onLed, k, AMP, CAB, preampPair, marshallKnobs, fenderKnobs } = tz.builders;
  tz.addDefs([
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
      id: 'sy.deco', name: 'Retro Tape Doubler', ref: 'Strymon Deco V2', code: 'RETRO', logo: 'retro', tagline: 'TAPE SATURATION & DOUBLETRACKER', cat: 'Modulation', color: '#c9b48f',
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
    })
  ]);
  registerWorkstations(tz);
}

// ---------------------------------------------------------------------------------------------------------
// Big Strymon "workstations" (BigSky / TimeLine / Mobius / NightSky / Magneto): wide brushed enclosure, an
// LCD that names the selected machine, a TYPE selector + VALUE knob on top, a long knob row and 3 footswitches.
function registerWorkstations(tz) {
  const { K, SEL, TOG, FOOT, LED, SCREEN, ms, db, STEREO } = tz.helpers;
  const { S, onFoot, onLed } = tz.builders;
  const { svg, label, formKit, setText } = tz.gfx;

  const blockVal = (b, ctl, p, dflt) => (b && b.params && b.params[p] !== undefined ? b.params[p] : (ctl.defaults || {})[p] ?? dflt);
  // two-line LCD: machine name (from a selector param) + a status line
  tz.addScreen('sy-lcd', {
    override: true,
    build(s, g, w, h, nv) {
      svg('rect', { width: w, height: h, rx: 2, fill: '#04070b' }, g);
      for (let y = 2; y < h; y += 2) svg('line', { x1: 0, x2: w, y1: y, y2: y, stroke: '#9fd6ff', 'stroke-opacity': 0.035 }, g);
      s.l1 = svg('text', { x: w / 2, y: h * 0.4, fill: '#dff1ff', 'font-family': "'Share Tech Mono', monospace", 'font-size': Math.min(12, h * 0.34), 'text-anchor': 'middle', 'dominant-baseline': 'central', 'letter-spacing': 1 }, g, '');
      s.l2 = svg('text', { x: w / 2, y: h * 0.78, fill: '#8fc6ee', 'font-family': "'Share Tech Mono', monospace", 'font-size': Math.min(6.6, h * 0.2), 'text-anchor': 'middle', 'dominant-baseline': 'central', 'letter-spacing': 0.6 }, g, '');
      this.update(s, {}, nv);
    },
    update(s, st, nv) {
      const c = s.ctl, b = nv && nv.block;
      const idx = blockVal(b, c, c.param, 0) | 0;
      let l1 = (c.names || [])[idx] || '';
      if (c.param2) l1 = `${(c.names || [])[idx] || ''} > ${(c.names2 || c.names || [])[blockVal(b, c, c.param2, 0) | 0] || ''}`;
      setText(s.l1, l1);
      const bank = c.bank || '00';
      setText(s.l2, b && b.bypass ? `${bank}  BYPASS` : `${bank}  ${c.status ? c.status((p, d) => blockVal(b, c, p, d)) : 'ON'}`);
    },
  });

  tz.addForm('sy-work', (ctx, def) => {
    const w = def.wsW || 300, h = 238, g = ctx.g;
    const col = def.color, txt = def.text || '#f2f2f2';
    formKit.body(g, w, h, col, { rx: 6, brushed: true });
    // recessed top deck with the display + a thin silk-screen line under the knob row
    const hasScreen = def.controls.some((c) => c.t === 'screen');
    const theme = { text: txt, knob: 'strymon', labelSize: 5.9, labelLs: 0.3, toggleTitles: false };
    const type = def.controls.find((c) => c.role === 'type');
    const type2 = def.controls.find((c) => c.role === 'type2');
    const value = def.controls.find((c) => c.role === 'value');
    if (hasScreen) {
      svg('rect', { x: 10, y: 12, width: w - 20, height: 70, rx: 5, fill: '#000', opacity: 0.16 }, g);
      svg('rect', { x: 10.5, y: 12.5, width: w - 21, height: 69, rx: 4.5, fill: 'none', stroke: '#fff', 'stroke-opacity': 0.08 }, g);
    }
    const scr = def.controls.find((c) => c.t === 'screen');
    if (scr && scr.x === undefined) Object.assign(scr, { x: w / 2, y: 44, w: scr.w || 120, h: scr.h || 34, bezel: '#050505' });
    if (type && type.x === undefined) Object.assign(type, { x: 50, y: 46, r: 14, optSize: 3.5, labelRadius: 8.5, labelPos: 'none' });
    if (type2 && type2.x === undefined) Object.assign(type2, { x: w - 50, y: 46, r: 14, optSize: 3.5, labelRadius: 8.5, labelPos: 'none' });
    if (value && value.x === undefined) Object.assign(value, { x: w - 50, y: 46, r: 14, labelPos: 'none' });
    if (type && type.labelPos === 'none') label(g, type.x, 76, type.label || 'TYPE', { size: 5.6, fill: txt, weight: 700, ls: 1 });
    if (type2 && type2.labelPos === 'none') label(g, type2.x, 76, type2.label || 'TYPE', { size: 5.6, fill: txt, weight: 700, ls: 1 });
    if (value && value.labelPos === 'none') label(g, value.x, 76, value.label || 'VALUE', { size: 5.6, fill: txt, weight: 700, ls: 1 });
    // remaining knobs / selectors: one or two rows
    const rest = def.controls.filter((c) => (c.t === 'knob' || c.t === 'sel') && c.x === undefined);
    const rows = def.wsRows || [rest.length];
    let i0 = 0;
    const rowY = hasScreen ? [108] : rows.length > 1 ? [36, 86] : [60];
    rows.forEach((n, ri) => {
      const r = rest.slice(i0, i0 + n);
      i0 += n;
      formKit.autoRow(r, 34, w - 34, rowY[ri] ?? 98);
      r.forEach((k) => { k.r = k.r || (n > 6 ? 11 : 12.5); k.labelPos = k.labelPos || 'below'; });
    });
    const tog = def.controls.filter((c) => c.t === 'toggle' && c.x === undefined);
    tog.forEach((t, i) => Object.assign(t, { x: tog.length === 1 ? w / 2 : 70 + (i * (w - 140)) / (tog.length - 1), y: 124, orient: 'h' }));
    const logoY = tog.length ? 158 : 148;
    label(g, w / 2, logoY, def.logo || def.name.toLowerCase(), { size: 18, fill: txt, font: "'Inter', sans-serif", weight: 700, ls: 1.4 });
    label(g, w / 2, logoY + 12, def.tagline || '', { size: 5.4, fill: txt, weight: 700, ls: 1.6, opacity: 0.72 });
    const bdg = formKit.tzBadge(g, w - 18, logoY + 1, txt, 4.2);
    bdg.setAttribute('text-anchor', 'end');
    const foots = def.controls.filter((c) => c.t === 'foot' && c.x === undefined);
    const fx = (i) => (foots.length === 3 ? [0.17, 0.5, 0.83][i] : [0.3, 0.7][i] ?? 0.5) * w;
    foots.forEach((f, i) => Object.assign(f, { style: 'stomp', r: 12, x: fx(i), y: 207 }));
    const leds = def.controls.filter((c) => c.t === 'led' && c.x === undefined);
    leds.forEach((l, i) => Object.assign(l, { r: 2.6, x: fx(i), y: 185 }));
    formKit.placeControls(ctx, def.controls, theme);
    return { w, h, theme, jacks: formKit.jacksTop(def, w, { flip: ctx.flip }) };
  });

  const W = (o) => S(Object.assign({ form: 'sy-work', cost: 2 }, o));
  const lcd = (param, names, o = {}) => SCREEN('sy-lcd', Object.assign({ param, names }, o));
  const ctlDefaults = (d) => {
    const scr = d.controls.find((c) => c.t === 'screen');
    if (scr) scr.defaults = Object.fromEntries(d.controls.filter((c) => c.p).map((c) => [c.p, c.def ?? 0]));
    return d;
  };

  // ---- reverb workstation
  const SKY = ['ROOM', 'HALL', 'PLATE', 'SPRING', 'SWELL', 'BLOOM', 'CLOUD', 'CHORALE', 'SHIMMER', 'MAGNETO', 'NONLINEAR', 'REFLECTIONS'];
  const SKYS = ['room', 'hall', 'plate', 'sprg', 'swell', 'bloom', 'cloud', 'chorl', 'shim', 'magn', 'nonl', 'refl'];
  const SKY_MODE = [0, 1, 2, 3, 9, 6, 5, 6, 4, 8, 0, 0];
  const skyVoice = (m, p1, p2) => {
    const o = { mode: SKY_MODE[m], size: 0.25 + 0.75 * p1, diffusion: 0.4 + 0.6 * p2, shimmer: 0, ensemble: 0 };
    if (m === 7) o.ensemble = 0.4 + 0.6 * p2;
    if (m === 5) o.diffusion = 0.9;
    if (m === 8) { o.shimmer = 0.15 + 0.85 * p1; o.size = 0.7; }
    if (m === 10) { o.size = 0.2 + 0.3 * p1; o.diffusion = 0.15 + 0.3 * p2; }
    if (m === 11) { o.size = 0.1 + 0.3 * p1; o.diffusion = 0.2 + 0.4 * p2; }
    return o;
  };
  const sky = ctlDefaults(W({
    id: 'sy.bigsky', name: 'Vast Sky Reverberator', ref: 'Strymon BigSky', code: 'VASTSKY', logo: 'vastsky', tagline: 'MULTIDIMENSIONAL REVERBERATOR', cat: 'Reverb', color: '#2c3540',
    algo: 'reverb', cost: 1.8,
    controls: [
      SEL('machine', 'TYPE', SKYS, { role: 'type', def: 1, sweep: 300 }),
      lcd('machine', SKY, { bank: '00A', status: (v) => (v('inf', 0) > 0.5 ? 'INFINITE' : 'ON') }),
      K('level', 'VALUE', { role: 'value', def: 0.5 }),
      K('decay', 'DECAY', { def: 0.5 }), K('predelay', 'PRE-DELAY', { min: 0, max: 500, def: 30, display: ms }), K('mix', 'MIX', { def: 0.35 }),
      K('tone', 'TONE', { def: 0.6 }), K('p1', 'PARAM 1', { def: 0.5, virtual: true }), K('p2', 'PARAM 2', { def: 0.5, virtual: true }), K('mod', 'MOD', { def: 0.3 }),
      onFoot({ label: 'A · ON' }), FOOT({ action: 'favorite', label: 'B · FAV' }), FOOT({ action: 'param', p: 'inf', label: 'C · INFINITE' }),
      onLed(), LED({ bind: 'fav' }), LED({ bind: 'param:inf', color: '#4aa8ff' }),
    ],
    initParams: { inf: 0 },
    derive: (p) => Object.assign(skyVoice(p.machine ?? 1, p.p1 ?? 0.5, p.p2 ?? 0.5), p.inf > 0.5 ? { decay: 1 } : {}),
    desc: '12 reverb machines (TYPE). PARAM 1 / PARAM 2 follow the machine (size, diffusion, shimmer amount, ensemble). VALUE trims the output level. C holds an infinite wash.',
  }));
  const skyMx = ctlDefaults(W({
    id: 'sy.bigskymx', name: 'Vast Sky MX', ref: 'Strymon BigSky MX', code: 'VASTSKY MX', logo: 'vastsky mx', tagline: 'DUAL-ENGINE REVERB', cat: 'Reverb', color: '#1d232b', cost: 3.4,
    algo: 'chain', opts: { chain: [{ prefix: 'a', algo: 'reverb' }, { prefix: 'b', algo: 'reverb', params: { mode: 5 } }] },
    controls: [
      SEL('ma', 'TYPE A', SKYS, { role: 'type', def: 1, sweep: 300 }),
      lcd('ma', SKY, { param2: 'mb', bank: 'A+B', w: 130, status: (v) => (v('inf', 0) > 0.5 ? 'INFINITE' : `BLEND ${Math.round(v('blend', 0.5) * 100)}%`) }),
      SEL('mb', 'TYPE B', SKYS, { role: 'type2', def: 6, sweep: 300 }),
      K('decay', 'DECAY', { def: 0.5, virtual: true }), K('predelay', 'PRE-DELAY', { min: 0, max: 500, def: 25, display: ms, virtual: true }), K('mix', 'MIX', { def: 0.35, virtual: true }),
      K('tone', 'TONE', { def: 0.6, virtual: true }), K('mod', 'MOD', { def: 0.3, virtual: true }), K('param', 'PARAM', { def: 0.5, virtual: true }), K('blend', 'A / B', { def: 0.5, virtual: true }),
      onFoot({ label: 'A · ON' }), FOOT({ action: 'favorite', label: 'B · FAV' }), FOOT({ action: 'param', p: 'inf', label: 'C · INFINITE' }),
      onLed(), LED({ bind: 'fav' }), LED({ bind: 'param:inf', color: '#4aa8ff' }),
    ],
    initParams: { inf: 0 },
    derive: (p) => {
      const o = {}, bl = p.blend ?? 0.5, mix = p.mix ?? 0.35, inf = p.inf > 0.5;
      for (const [pre, m, share] of [['a', p.ma ?? 1, 1 - bl], ['b', p.mb ?? 6, bl]]) {
        const v = skyVoice(m, p.param ?? 0.5, p.param ?? 0.5);
        for (const k in v) o[`${pre}.${k}`] = v[k];
        o[`${pre}.decay`] = inf ? 1 : p.decay ?? 0.5;
        o[`${pre}.predelay`] = p.predelay ?? 25;
        o[`${pre}.tone`] = p.tone ?? 0.6;
        o[`${pre}.mod`] = p.mod ?? 0.3;
        o[`${pre}.mix`] = Math.min(1, mix * Math.min(1, share * 1.6));
      }
      return o;
    },
    desc: 'Two reverb engines in series (TYPE A → TYPE B). A / B blends their wet levels; PARAM drives each machine’s character. C holds an infinite wash.',
  }));

  // ---- delay workstation
  const TL = ['dTAPE', 'dBUCKET', 'DIGITAL', 'DUAL', 'PATTERN', 'REVERSE', 'ICE', 'DUCK', 'SWELL', 'TREM', 'FILTER', 'LO-FI'];
  const TLS = ['tape', 'bckt', 'digi', 'dual', 'pttn', 'rvrs', 'ice', 'duck', 'swell', 'trem', 'fltr', 'lofi'];
  const TL_MODE = [2, 1, 0, 8, 7, 5, 6, 0, 0, 4, 4, 3];
  const timeline = ctlDefaults(W({
    id: 'sy.timeline', name: 'Chronicle Delay', ref: 'Strymon TimeLine', code: 'CHRONICLE', logo: 'chronicle', tagline: 'MULTIDIMENSIONAL DELAY', cat: 'Delay', color: '#3a3f46', cost: 2,
    algo: 'chain',
    opts: { chain: [
      { prefix: 'd', algo: 'delay', opts: { maxMs: 2600 } },
      { prefix: 't', algo: 'tremolo', on: false },
      { prefix: 'f', algo: 'wah', on: false, params: { mode: 1, filter: 0 } },
      { prefix: 'sw', algo: 'swell', on: false },
    ] },
    controls: [
      SEL('machine', 'TYPE', TLS, { role: 'type', def: 2, sweep: 300 }),
      lcd('machine', TL, { bank: '00A', status: (v) => `${Math.round(v('d.time', 420))} ms` }),
      K('d.level', 'VALUE', { role: 'value', def: 0.5 }),
      K('d.time', 'TIME', { min: 20, max: 2500, def: 420, display: ms, curve: 'log' }), K('d.feedback', 'REPEATS', { def: 0.38, max: 1.05 }), K('d.mix', 'MIX', { def: 0.35 }),
      K('d.tone', 'FILTER', { def: 0.6 }), K('grit', 'GRIT', { def: 0.2, virtual: true }), K('d.modrate', 'SPEED', { def: 0.3 }), K('d.moddepth', 'DEPTH', { def: 0.15 }),
      onFoot({ label: 'A · ON' }), FOOT({ action: 'favorite', label: 'B · FAV' }),
      FOOT({ action: 'tap', label: 'TAP', hold: { event: { type: 2, value: 1, arg: 0 }, release: { type: 2, value: 0, arg: 0 } } }),
      onLed(), LED({ bind: 'fav' }), LED({ bind: 'tap:d.time' }),
    ],
    tapTarget: 'd.time',
    derive: (p) => {
      const m = p.machine ?? 2, g = p.grit ?? 0.2;
      return {
        'd.mode': TL_MODE[m], 'd.age': g, 'd.sat': 0.15 + 0.6 * g, 'd.heads': m === 0 ? 4 : 4,
        't.on': m === 9 ? 1 : 0, 't.rate': p['d.modrate'] ?? 0.3, 't.depth': 0.3 + 0.7 * (p['d.moddepth'] ?? 0.15),
        'f.on': m === 10 ? 1 : 0, 'f.rate': p['d.modrate'] ?? 0.3, 'f.range': 0.3 + 0.7 * (p['d.moddepth'] ?? 0.15),
        'sw.on': m === 8 ? 1 : 0,
        'd.moddepth': m === 9 || m === 10 ? 0 : p['d.moddepth'] ?? 0.15,
      };
    },
    desc: '12 delay machines. GRIT adds tape age / saturation, SPEED / DEPTH set the modulation (or the tremolo / filter rate in TREM and FILTER). Hold TAP for infinite repeats; VALUE trims the delay level.',
  }));

  // ---- modulation workstation
  const MB = ['CHORUS', 'FLANGER', 'ROTARY', 'VIBE', 'PHASER', 'FILTER', 'FORMANT', 'VINTAGE TREM', 'PATTERN TREM', 'AUTOSWELL', 'DESTROYER', 'QUADRATURE'];
  const MBS = ['chor', 'flng', 'rtry', 'vibe', 'phsr', 'fltr', 'frmt', 'vtrm', 'ptrm', 'aswl', 'dstr', 'quad'];
  const mobius = ctlDefaults(W({
    id: 'sy.mobius', name: 'Twist Modulation', ref: 'Strymon Mobius', code: 'TWIST', logo: 'twist', tagline: 'MULTIDIMENSIONAL MODULATION', cat: 'Modulation', color: '#4a2f55', cost: 2,
    algo: 'chain',
    opts: { chain: [
      { prefix: 'ch', algo: 'chorus', on: false }, { prefix: 'fl', algo: 'flanger', on: false }, { prefix: 'ro', algo: 'rotary', on: false },
      { prefix: 'vb', algo: 'vibe', on: false }, { prefix: 'ph', algo: 'phaser', on: false }, { prefix: 'wa', algo: 'wah', on: false, params: { mode: 1 } },
      { prefix: 'tr', algo: 'tremolo', on: false }, { prefix: 'sl', algo: 'slicer', on: false }, { prefix: 'sw', algo: 'swell', on: false },
      { prefix: 'cr', algo: 'crusher', on: false }, { prefix: 'rm', algo: 'ringmod', on: false },
      { prefix: 'o', algo: 'utility', opts: { kind: 'gain' } },
    ] },
    controls: [
      SEL('machine', 'TYPE', MBS, { role: 'type', def: 0, sweep: 300 }),
      lcd('machine', MB, { bank: '00A', status: (v) => (v('fast', 0) > 0.5 ? 'FAST' : 'ON') }),
      K('mix', 'VALUE', { role: 'value', def: 0.6, virtual: true }),
      K('speed', 'SPEED', { def: 0.35, virtual: true }), K('depth', 'DEPTH', { def: 0.55, virtual: true }), K('lvl', 'LEVEL', { def: 0.5, virtual: true }),
      K('pa', 'PARAM 1', { def: 0.5, virtual: true }), K('pb', 'PARAM 2', { def: 0.4, virtual: true }),
      onFoot({ label: 'A · ON' }), FOOT({ action: 'favorite', label: 'B · FAV' }), FOOT({ action: 'param', p: 'fast', label: 'C · FAST' }),
      onLed(), LED({ bind: 'fav' }), LED({ bind: 'param:fast', color: '#4aa8ff' }),
    ],
    initParams: { fast: 0 },
    derive: (p) => {
      const m = p.machine ?? 0, sp = Math.min(1, (p.speed ?? 0.35) * (p.fast > 0.5 ? 1.6 : 1)), dp = p.depth ?? 0.55, a = p.pa ?? 0.5, b = p.pb ?? 0.4, mix = p.mix ?? 0.6;
      const o = { 'o.level': ((p.lvl ?? 0.5) - 0.5) * 18 };
      ['ch', 'fl', 'ro', 'vb', 'ph', 'wa', 'tr', 'sl', 'sw', 'cr', 'rm'].forEach((k) => (o[k + '.on'] = 0));
      const on = { 0: 'ch', 1: 'fl', 2: 'ro', 3: 'vb', 4: 'ph', 5: 'wa', 6: 'wa', 7: 'tr', 8: 'sl', 9: 'sw', 10: 'cr', 11: 'rm' }[m];
      o[on + '.on'] = 1;
      Object.assign(o, {
        'ch.rate': sp, 'ch.depth': dp, 'ch.mix': mix * 0.85, 'ch.tone': a, 'ch.mode': b > 0.66 ? 2 : b > 0.33 ? 3 : 0,
        'fl.speed': sp * 0.7, 'fl.width': dp, 'fl.mix': mix * 0.85, 'fl.manual': a, 'fl.regen': b,
        'ro.speed': p.fast > 0.5 ? 1 : 0, 'ro.balance': a, 'ro.drive': b * 0.6, 'ro.mix': 0.5 + mix * 0.5,
        'vb.speed': sp, 'vb.intensity': dp, 'vb.mode': b > 0.5 ? 1 : 0, 'vb.tone': a,
        'ph.rate': sp, 'ph.depth': dp, 'ph.mix': mix * 0.8, 'ph.feedback': b * 0.85, 'ph.center': a, 'ph.stages': 4 + Math.round(b * 4) * 2,
        'wa.rate': sp, 'wa.range': dp, 'wa.q': m === 6 ? 0.85 : 0.3 + 0.6 * b, 'wa.filter': m === 6 ? 1 : 0, 'wa.pos': a,
        'tr.rate': sp, 'tr.depth': dp, 'tr.wave': a, 'tr.mode': b > 0.5 ? 1 : 0,
        'sl.time': 90 + (1 - sp) * 400, 'sl.depth': dp, 'sl.pattern': Math.round(a * 15), 'sl.smooth': b,
        'sw.attack': 0.15 + dp * 0.8, 'sw.sens': a,
        'cr.bits': 1 - dp * 0.85, 'cr.rate': 0.15 + 0.7 * a, 'cr.mix': mix,
        'rm.freq': sp, 'rm.fine': a, 'rm.mix': mix * 0.8,
      });
      return o;
    },
    desc: '12 modulation machines. VALUE is the wet mix, PARAM 1 / PARAM 2 follow the machine (tone / regen / manual / stages …). C toggles a faster speed (rotary fast).',
  }));

  // ---- time-warped reverb (no display)
  const nightsky = W({
    id: 'sy.nightsky', name: 'Polar Night Reverb', ref: 'Strymon NightSky', code: 'POLAR', logo: 'polar night', tagline: 'TIME-WARPED REVERBERATOR', cat: 'Reverb', color: '#1b2238', text: '#e8ecff', cost: 2.2,
    algo: 'chain',
    opts: { chain: [{ prefix: 'r', algo: 'reverb', params: { mode: 5 } }, { prefix: 'f', algo: 'wah', params: { mode: 0, filter: 0 } }] },
    wsRows: [5, 5],
    controls: [
      K('r.decay', 'DECAY', { def: 0.6 }), K('r.mix', 'MIX', { def: 0.38 }), K('r.size', 'SIZE', { def: 0.65 }), K('r.diffusion', 'TEXTURE', { def: 0.7 }), K('r.shimmer', 'PITCH', { def: 0 }),
      K('r.predelay', 'PRE-DELAY', { min: 0, max: 500, def: 30, display: ms }), K('f.pos', 'FILTER', { def: 0.85 }), K('f.q', 'RESONANCE', { def: 0.2 }), K('r.mod', 'MOD', { def: 0.35 }), K('r.tone', 'TONE', { def: 0.6 }),
      TOG('sky', 'REVERB', ['sky', 'vast', 'deep'], { def: 0 }), TOG('shim', 'SHIMMER', ['+oct', '+5th', '-oct'], { def: 0 }), TOG('flt', 'FILTER', ['lp', 'bp', 'hp'], { def: 0 }),
      onFoot({ label: 'ON' }), FOOT({ action: 'favorite', label: 'FAV' }), FOOT({ action: 'param', p: 'inf', label: 'HOLD' }),
      onLed(), LED({ bind: 'fav' }), LED({ bind: 'param:inf', color: '#9a7cff' }),
    ],
    initParams: { inf: 0 },
    derive: (p) => {
      const sh = p['r.shimmer'] ?? 0;
      return {
        'r.mode': sh > 0.03 ? 4 : [5, 1, 6][p.sky ?? 0], 'r.ensemble': [0.2, 0.4, 0.7][p.sky ?? 0], 'r.decay': p.inf > 0.5 ? 1 : p['r.decay'] ?? 0.6,
        'f.filter': p.flt ?? 0, 'f.on': (p.flt ?? 0) === 0 && (p['f.pos'] ?? 0.85) > 0.97 ? 0 : 1, 'f.level': 0.5,
      };
    },
    desc: 'Approximation: cloud / hall / modulated reverb with a pitch-shimmer engine and a resonant post filter (no sequencer). HOLD freezes the wash.',
  });

  // ---- 4-head tape echo (no display)
  const HEADS = ['1', '2', '1+2', '3', '1+3', '2+3', 'all'];
  const magneto = W({
    id: 'sy.magneto', name: 'Iron Tape Echo', ref: 'Strymon Magneto', code: 'IRON', logo: 'iron', tagline: 'FOUR-HEAD dTAPE ECHO & LOOPER', cat: 'Delay', color: '#5b3a2a', cost: 2,
    algo: 'chain',
    opts: { chain: [{ prefix: 'd', algo: 'delay', opts: { maxMs: 2600, fixedMode: 2 } }, { prefix: 's', algo: 'reverb', params: { mode: 3, mix: 0 } }] },
    wsRows: [5, 5],
    controls: [
      K('d.time', 'TIME', { min: 40, max: 2400, def: 420, display: ms, curve: 'log' }), K('d.feedback', 'REPEATS', { def: 0.4, max: 1.1 }), K('d.mix', 'MIX', { def: 0.38 }), K('d.age', 'AGE', { def: 0.35 }), K('wf', 'WOW & FLUT', { def: 0.3, virtual: true }),
      K('d.lowcut', 'LOW', { def: 0.15 }), K('d.tone', 'HIGH', { def: 0.55 }), K('s.mix', 'SPRING', { def: 0.1 }), K('d.sat', 'DRIVE', { def: 0.35 }),
      SEL('d.heads', 'HEADS', HEADS, { def: 3, values: [1, 2, 3, 4, 5, 6, 7], optSize: 4 }),
      TOG('d.subdiv', 'SUBDIV', ['1/4', 'dot', 'trip'], { values: [0, 1, 3] }), TOG('mode', 'MODE', ['single', 'multi', 'swell'], { def: 1, virtual: true }),
      onFoot({ label: 'ON' }), FOOT({ action: 'tap', label: 'TAP', hold: { event: { type: 2, value: 1, arg: 0 }, release: { type: 2, value: 0, arg: 0 } } }), FOOT({ action: 'favorite', label: 'FAV' }),
      onLed(), LED({ bind: 'tap:d.time' }), LED({ bind: 'fav' }),
    ],
    tapTarget: 'd.time',
    derive: (p) => {
      const wf = p.wf ?? 0.3, o = { 'd.moddepth': wf * 0.6, 'd.modrate': 0.15 + 0.35 * wf, 's.decay': 0.4 };
      if ((p.mode ?? 1) === 0) o['d.heads'] = 4;
      if (p.mode === 2) o['d.feedback'] = Math.max(p['d.feedback'] ?? 0.4, 0.75);
      return o;
    },
    desc: 'Approximation: multi-head tape echo with spring reverb (the looper is not modelled — hold TAP for infinite repeats instead).',
  });

  tz.addDefs([
    sky, skyMx, timeline, mobius, nightsky, magneto,
    S({
      id: 'sy.iridium', name: 'Prism Amp & IR Cab', ref: 'Strymon Iridium', code: 'PRISM', logo: 'prism', tagline: 'AMP & IR CAB', cat: 'Amp', kind: 'Pedal', color: '#2a2b2e', cost: 3.6,
      algo: 'chain',
      opts: { chain: [
        { prefix: 'a', algo: 'amp', opts: { models: ['deluxe', 'ac30', 'plexi'] } },
        { prefix: 'c', algo: 'cab', opts: { models: ['1x12us', '2x12blue', '4x12gb'] } },
        { prefix: 'r', algo: 'reverb', params: { mode: 0, decay: 0.3, size: 0.25 } },
      ] },
      controls: [
        K('a.gain', 'DRIVE', { def: 0.45 }), K('a.bass', 'BASS'), K('a.mid', 'MIDDLE'),
        K('a.treble', 'TREBLE'), K('r.mix', 'ROOM', { def: 0.15 }), K('a.level', 'LEVEL', { min: -20, max: 12, def: 0, display: db }),
        TOG('amp', 'AMP', ['round', 'chime', 'punch'], { def: 0 }), TOG('cab', 'CAB', ['a', 'b', 'c'], { def: 0 }),
        onFoot({ label: 'ON' }), onLed(),
      ],
      derive: (p) => ({ 'a.channel': p.amp ?? 0, 'c.model': p.cab ?? 0 }),
      desc: 'Three amps (round = blackface, chime = top-boost, punch = plexi) into a matching IR cab, with a small room.',
    }),
    S({
      id: 'sy.orbit', name: 'Ellipse dBucket Flanger', ref: 'Strymon Orbit', code: 'ELLIPSE', logo: 'ellipse', tagline: 'dBUCKET FLANGER', cat: 'Modulation', small: true, color: '#b5462e', cost: 0.8,
      algo: 'flanger',
      controls: [
        K('speed', 'SPEED', { def: 0.3 }), K('width', 'WIDTH', { def: 0.6 }), K('manual', 'MANUAL', { def: 0.45 }),
        K('regen', 'REGEN', { def: 0.55, x: 26, y: 92 }), K('mix', 'MIX', { def: 0.5, x: 102, y: 92 }),
        TOG('mode', 'TYPE', ['clsc', 'TZ', 'ultra'], { values: [0, 3, 1], x: 64, y: 90, orient: 'h' }),
        onFoot({ label: '' }), LED({ bind: 'rate:on:speed', color: '#ff2a1a' }),
      ],
    }),
    S({
      id: 'sy.zelzah', name: 'Zephyr Phaser', ref: 'Strymon Zelzah', code: 'ZEPHYR', logo: 'zephyr', tagline: 'MULTIDIMENSIONAL PHASER', cat: 'Modulation', color: '#a8783a', cost: 1.2,
      algo: 'chain', opts: { chain: [{ prefix: 'ph', algo: 'phaser', opts: { stages: 6 } }, { prefix: 'ch', algo: 'chorus', params: { mix: 0.3 } }] },
      controls: [
        K('ph.rate', 'SPEED', { def: 0.3 }), K('ph.depth', 'INTENSITY', { def: 0.75 }), K('ph.mix', 'MIX', { def: 0.5 }),
        K('ph.feedback', 'REGEN', { def: 0.4 }), K('ph.center', 'CENTER', { def: 0.5 }), K('dim', 'DIMENSION', { def: 0, virtual: true }),
        TOG('ph.stages', 'STAGES', ['4', '6', '10'], { values: [4, 6, 10], def: 1 }), TOG('pmode', 'MODE', ['phase', 'vibe', 'barber'], { def: 0, virtual: true }),
        onFoot({ label: 'ON' }), FOOT({ action: 'favorite', label: 'FAVORITE' }), onLed(), LED({ bind: 'fav' }),
      ],
      derive: (p) => {
        const d = p.dim ?? 0, m = p.pmode ?? 0;
        return { 'ch.on': d > 0.02 ? 1 : 0, 'ch.mix': d * 0.6, 'ch.depth': 0.3 + 0.5 * d, 'ch.rate': (p['ph.rate'] ?? 0.3) * 0.8,
          'ph.mix': m === 1 ? 1 : p['ph.mix'] ?? 0.5, 'ph.feedback': m === 2 ? Math.max(0.7, p['ph.feedback'] ?? 0.4) : p['ph.feedback'] ?? 0.4 };
      },
      desc: 'Classic multi-stage phaser; DIMENSION blends in a BBD-style chorus, MODE picks phase / vibe (100% wet) / barber-pole-like high regen.',
    }),
  ]);
}
