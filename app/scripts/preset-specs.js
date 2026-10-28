// Factory preset specs (see build-presets.js for the format). Knob values are positions 0..1.
// Genre library: every genre has a simple and a complex rig for rhythm and for lead.

const TUNERS = ['tz.tuner', 'bx.tu3', 'tc.polytune3', 'bx.tu3w', 'tc.polytune3mini', 'bh.tm300'];
let tunerI = 0;
const tuner = () => [TUNERS[tunerI++ % TUNERS.length], {}, { bypass: true }];
const meter = ['tz.meter'];
const off = (item) => [item[0], item[1] || {}, Object.assign({}, item[2] || {}, { bypass: true })];

// g: { id, name, tags, order, rs, ls, rc, lc, desc: {rs, ls, rc, lc} } – each r*/l* is a chain array
function genre(g) {
  const base = g.order;
  const mk = (suffix, label, chain, tags, desc, o) => ({
    file: `g${String(base).padStart(2, '0')}${o}-${g.id}-${suffix}`,
    name: `${g.name} · ${label}`,
    tags: [...g.tags, ...tags],
    desc,
    order: 100 + base * 10 + o,
    chain,
  });
  return [
    mk('rhythm', 'Rhythm', g.rs, ['rhythm', 'simple'], g.desc.rs, 1),
    mk('lead', 'Lead', g.ls, ['lead', 'simple'], g.desc.ls, 2),
    mk('rhythm-pro', 'Rhythm Pro', g.rc, ['rhythm', 'complex'], g.desc.rc, 3),
    mk('lead-pro', 'Lead Pro', g.lc, ['lead', 'complex'], g.desc.lc, 4),
  ];
}

const G = [];

// ---------------------------------------------------------------- 1 Jazz
{
  const amp = (gain) => ['amp.jc120', { gain, treble: 0.38, mid: 0.55, bass: 0.58, bright: 0 }];
  const cab = ['cab.2x12jc', { mic1: 0, mic2: 2 }];
  G.push(genre({
    id: 'jazz', name: 'Jazz', tags: ['jazz', 'clean'], order: 1,
    rs: [amp(0.32), ['cab.2x12jc'], ['tz.spring', { mix: 0.18, decay: 0.35, tone: 0.4 }]],
    ls: [['tz.klone', { gain: 0.15, tone: 0.4, level: 0.6 }], amp(0.4), ['cab.2x12jc'], ['mx.m169', { feedback: 0.25, mix: 0.2, time: 0.35, mod: 0 }], ['tz.spring', { mix: 0.2, decay: 0.4, tone: 0.4 }]],
    rc: [tuner(), ['kly.compplus', { sustain: 0.25, level: 0.55, blend: 0.45, tone: 0.4 }], ['tz.contour', { lowgain: 0.55, mid1gain: 0.45, mid1freq: 0.45, highgain: 0.4 }], amp(0.32), cab, ['mx.m134', { rate: 0.25, depth: 0.3, feedback: 0.2, tone: 0.45 }, { bypass: true }], ['sy.bluesky', { decay: 0.35, predelay: 0.2, mix: 0.2, lowdamp: 0.4, highdamp: 0.55 }], meter],
    lc: [tuner(), ['tz.featherweight', { sustain: 0.35, level: 0.55, blend: 0.5 }], ['tz.klone', { gain: 0.2, tone: 0.42, level: 0.62 }], amp(0.42), cab, ['mx.m134', { rate: 0.2, depth: 0.25, feedback: 0.15, tone: 0.45 }], ['sy.brig', { time: 0.35, mix: 0.22, tone: 0.45, feedback: 0.25, moddepth: 0.2 }], ['sy.bluesky', { decay: 0.4, predelay: 0.25, mix: 0.22 }], meter],
    desc: {
      rs: 'Warm solid-state clean with the treble rolled back and a touch of spring – comping on the neck pickup.',
      ls: 'A transparent push for single-note lines, a short analog-style slap and spring.',
      rc: 'Compressed, mid-scooped clean with optional stereo chorus and a soft stereo room. Two mics on the cab (dynamic + ribbon).',
      lc: 'Light compression and a touch of drive for singing lines, subtle chorus, bucket-brigade echo and room.',
    },
  }));
}

// ---------------------------------------------------------------- 2 Worship (gospel / classic)
{
  const amp = (gain) => ['amp.ac30', { gain, treble: 0.55, bass: 0.48, presence: 0.5, master: 0.6 }];
  G.push(genre({
    id: 'worship', name: 'Worship', tags: ['worship', 'gospel'], order: 2,
    rs: [['tz.featherweight', { sustain: 0.35, level: 0.55, blend: 0.55 }], amp(0.3), ['cab.2x12blue'], ['tz.reverb', { decay: 0.45, mix: 0.25, predelay: 0.2, mode: 1 }]],
    ls: [['jhs.morningglory', { level: 0.6, gain: 0.5, tone: 0.55, mode: 0 }], amp(0.36), ['cab.2x12blue'], ['tz.lumen', { time: 0.42, feedback: 0.3, mix: 0.28, tone: 0.5 }], ['tz.reverb', { decay: 0.55, mix: 0.3, predelay: 0.3, mode: 1 }]],
    rc: [tuner(), ['bx.cs3', { level: 0.55, tone: 0.5, attack: 0.5, sustain: 0.35 }], ['tz.klone', { gain: 0.25, tone: 0.5, level: 0.6 }, { bypass: true }], ['bx.bd2', { level: 0.55, tone: 0.5, gain: 0.45 }, { bypass: true }], amp(0.3), ['cab.2x12blue', { mic2: 2 }], ['tc.corona', { rate: 0.3, depth: 0.35, mix: 0.3, tone: 0.5 }, { bypass: true }], ['bx.dd8', { mix: 0.25, feedback: 0.3, dtime: 0.45 }], ['tz.vaulted', { decay: 0.55, mix: 0.3, predelay: 0.3, tone: 0.5, size: 0.6 }], meter],
    lc: [tuner(), ['tz.silkvol', { pos: 1 }], ['bx.cs3', { level: 0.55, tone: 0.5, attack: 0.6, sustain: 0.4 }], ['tz.klone', { gain: 0.35, tone: 0.55, level: 0.62 }], ['jhs.morningglory', { level: 0.55, gain: 0.55, tone: 0.55 }], amp(0.36), ['cab.2x12blue', { mic2: 2 }], ['tc.corona', { rate: 0.25, depth: 0.3, mix: 0.25 }, { bypass: true }], ['tc.flashback2', { dtime: 0.5, feedback: 0.35, mix: 0.3 }], ['tz.shimmer', { decay: 0.7, mix: 0.35, shimmer: 0.3, tone: 0.55 }], meter],
    desc: {
      rs: 'Chimey top-boost clean with gentle compression and a warm hall – sits under a choir.',
      ls: 'Morning-style drive into a chiming amp, dotted delay and hall for melodic lines.',
      rc: 'Full worship rhythm board: compressor, stacked low-gain drives (off), dual-mic cab, optional chorus, delay and room.',
      lc: 'Volume swells into stacked drives, delay and shimmer for soaring leads and intros.',
    },
  }));
}

// ---------------------------------------------------------------- 3 Contemporary worship
{
  const amp = (gain) => ['amp.dc30', { gain, bass: 0.48, treble: 0.55, presence: 0.5, master: 0.6 }];
  const cab = ['tworock.cab-1x12', {}];
  G.push(genre({
    id: 'contemporary-worship', name: 'Contemporary Worship', tags: ['contemporary-worship', 'worship', 'ambient'], order: 3,
    rs: [['sy.compadre', { 'c.sustain': 0.4, 'c.level': 0.55, 'c.blend': 0.6 }], amp(0.38), cab, ['sy.timeline', { 'd.time': 0.45, 'd.feedback': 0.32, 'd.mix': 0.25 }], ['sy.bigsky', { decay: 0.6, mix: 0.3 }]],
    ls: [['eqd.westwood', { level: 0.6, gain: 0.5, bass: 0.5, treble: 0.55 }], amp(0.42), cab, ['sy.timeline', { 'd.time': 0.45, 'd.feedback': 0.4, 'd.mix': 0.3 }], ['sy.bigsky', { decay: 0.75, mix: 0.38 }]],
    rc: [tuner(), ['tz.tidalswell', { sens: 0.5, attack: 0.4, level: 0.6 }, { bypass: true }], ['sy.compadre', { 'c.sustain': 0.4, 'c.level': 0.55, 'c.blend': 0.6 }], ['tz.klone', { gain: 0.3, tone: 0.55, level: 0.6 }, { bypass: true }], ['sy.riverside', { gain: 0.4, level: 0.55, bass: 0.5, mid: 0.5, treble: 0.55 }, { bypass: true }], amp(0.38), ['tworock.cab-1x12', { mic2: 2 }], ['sy.ola', { rate: 0.3, depth: 0.35, mix: 0.3 }, { bypass: true }], ['sy.timeline', { 'd.time': 0.45, 'd.feedback': 0.32, 'd.mix': 0.25 }], ['sy.bigsky', { decay: 0.7, mix: 0.32 }], ['tz.glacier', { mix: 0.5, decay: 0.6 }, { bypass: true }], meter],
    lc: [tuner(), ['tz.exp', { pos: 1 }], ['tz.tidalswell', { sens: 0.5, attack: 0.45, level: 0.6 }, { bypass: true }], ['sy.compadre', { 'c.sustain': 0.45, 'c.level': 0.55, 'c.blend': 0.55 }], ['eqd.westwood', { level: 0.6, gain: 0.5, bass: 0.5, treble: 0.55 }], ['tz.amberline', { gain: 0.55, tone: 0.55, level: 0.6 }, { bypass: true }], amp(0.42), ['tworock.cab-1x12', { mic2: 2 }], ['sy.timeline', { 'd.time': 0.45, 'd.feedback': 0.42, 'd.mix': 0.3 }], ['mrs.mercury7', { decay: 0.7, mix: 0.35, shimmer: 0.25 }], ['sy.bigsky', { decay: 0.8, mix: 0.3 }], meter],
    desc: {
      rs: 'Boutique EF86-style clean, studio compression, dotted-eighth TimeLine and a big BigSky-style hall.',
      ls: 'Transparent drive into the amp with longer, wetter delays and reverb for lead lines.',
      rc: 'Modern worship rhythm board: swell, comp, Klon-style and multistage drives (off), chorus, dotted delay, hall and a freeze for pads.',
      lc: 'Ambient lead rig with swell, stacked drives, dotted delay into shimmer and hall.',
    },
  }));
}

// ---------------------------------------------------------------- 4 Rock
{
  const amp = (gain) => ['amp.jcm800', { gain, master: 0.55, presence: 0.55, bass: 0.5, mid: 0.6, treble: 0.6 }];
  const cab = ['cab.4x12gb', {}];
  G.push(genre({
    id: 'rock', name: 'Rock', tags: ['rock', 'crunch'], order: 4,
    rs: [['ib.ts9', { gain: 0.15, tone: 0.5, level: 0.75 }], amp(0.55), cab, ['tz.spring', { mix: 0.12, decay: 0.3, tone: 0.5 }]],
    ls: [['kly.oxblood', { level: 0.6, gain: 0.55, tone: 0.55 }], amp(0.65), cab, ['mx.m169', { feedback: 0.3, mix: 0.22, time: 0.4, mod: 0.3 }], ['tz.spring', { mix: 0.15, decay: 0.35, tone: 0.5 }]],
    rc: [tuner(), ['tz.hush', { threshold: 0.3, decay: 0.4 }], ['ib.ts9', { gain: 0.15, tone: 0.5, level: 0.75 }], ['mx.m101', { rate: 0.3 }, { bypass: true }], amp(0.55), ['cab.4x12gb', { mic2: 2 }], ['bx.dd8', { mix: 0.18, feedback: 0.25, dtime: 0.35 }, { bypass: true }], ['tz.reverb', { decay: 0.35, mix: 0.15, mode: 0 }], meter],
    lc: [tuner(), ['dn.gcb95', { pos: 0.5 }, { bypass: true }], ['mx.m102', { level: 0.55, sustain: 0.35 }], ['ib.ts9', { gain: 0.25, tone: 0.55, level: 0.75 }], ['pc.rat2', { gain: 0.35, tone: 0.5, level: 0.55 }, { bypass: true }], amp(0.65), ['cab.4x12gb', { mic2: 2 }], ['tz.paraeq', { b3on: 1 }], ['bx.dd8', { mix: 0.25, feedback: 0.35, dtime: 0.45 }], ['tz.reverb', { decay: 0.4, mix: 0.18, mode: 0 }], meter],
    desc: {
      rs: 'Screamer-boosted 800 into greenbacks – the classic tight rock rhythm.',
      ls: 'Oxblood-style drive pushing the amp harder, analog echo and spring.',
      rc: 'Gate, TS boost, optional Phase 90, dual-mic cab, delay (off) and room.',
      lc: 'Wah, compressor, TS and RAT for two lead levels, EQ, delay and reverb.',
    },
  }));
}

// ---------------------------------------------------------------- 5 Metal
{
  const amp = (gain) => ['amp.recto', { gain, treble: 0.55, mid: 0.4, bass: 0.6, presence: 0.55, master: 0.45, channel: 1 }];
  const cab = ['cab.4x12v30', {}];
  G.push(genre({
    id: 'metal', name: 'Metal', tags: ['metal', 'high-gain'], order: 5,
    rs: [['tc.sentry', { threshold: 0.45, decay: 0.3, range: 0.8 }], ['ib.ts9', { gain: 0, tone: 0.55, level: 0.8 }], amp(0.65), cab],
    ls: [['ib.ts9', { gain: 0.05, tone: 0.6, level: 0.8 }], amp(0.75), cab, ['tz.lumen', { time: 0.45, feedback: 0.3, mix: 0.2 }], ['tz.reverb', { decay: 0.4, mix: 0.15 }]],
    rc: [tuner(), ['ib.ts9', { gain: 0, tone: 0.55, level: 0.8 }], ['tz.gate', { threshold: 0.45, attack: 0.2, decay: 0.3, range: 0.8 }], amp(0.65), ['cab.4x12v30', { mic1: 0, mic2: 3 }], ['bx.ge7', { b0: 0.55, b1: 0.5, b2: 0.42, b3: 0.5, b4: 0.55, b5: 0.5, b6: 0.45, level: 0.5 }], ['tz.vaulted', { decay: 0.3, mix: 0.1 }, { bypass: true }], meter],
    lc: [tuner(), ['evh.wah95', { pos: 0.5 }, { bypass: true }], ['ib.ts9', { gain: 0.05, tone: 0.6, level: 0.8 }], ['tz.gate', { threshold: 0.35, decay: 0.4 }], amp(0.75), ['cab.4x12v30', { mic2: 3 }], ['tz.paraeq', { b3on: 1 }], ['evh.chorus', { mix: 0.25, rate: 0.3, depth: 0.3 }, { bypass: true }], ['tz.lumen', { time: 0.45, feedback: 0.32, mix: 0.22 }], ['tz.vaulted', { decay: 0.45, mix: 0.18 }], meter],
    desc: {
      rs: 'Gated, screamer-tightened Rectifier into V30s for heavy palm mutes.',
      ls: 'Same rig hotter, with a stereo delay and a little room for solos.',
      rc: 'TS boost, gate, Recto, dual-mic V30 cab and a 7-band post EQ.',
      lc: 'Wah, boost, gate, Recto, EQ, optional chorus, delay and reverb.',
    },
  }));
}

// ---------------------------------------------------------------- 6 Heavy metal
{
  const amp = (gain) => ['amp.5150', { gain, bass: 0.55, mid: 0.5, treble: 0.6, master: 0.4, depth: 0.5, presence: 0.55 }];
  const cab = ['cab.4x12t75', {}];
  G.push(genre({
    id: 'heavy-metal', name: 'Heavy Metal', tags: ['heavy-metal', 'metal', 'high-gain'], order: 6,
    rs: [['mx.m135', { threshold: 0.4 }], amp(0.6), cab],
    ls: [['bx.sd1', { level: 0.75, tone: 0.55, gain: 0.1 }], amp(0.72), cab, ['bx.dd3', { mix: 0.22, feedback: 0.3, dtime: 0.45 }], ['bx.rv6', { mix: 0.15, decay: 0.4 }]],
    rc: [tuner(), ['bx.sd1', { level: 0.75, tone: 0.55, gain: 0.05 }], ['mx.m135', { threshold: 0.4 }], amp(0.6), ['cab.4x12t75', { mic2: 2 }], ['mx.m108', { level: 0.5, gain: 0.5, b2: 0.45, b3: 0.42, b4: 0.48, b6: 0.55 }], meter],
    lc: [tuner(), ['dn.gcb95', { pos: 0.5 }, { bypass: true }], ['bx.sd1', { level: 0.75, tone: 0.6, gain: 0.1 }], ['mx.m135', { threshold: 0.35 }], amp(0.72), ['cab.4x12t75', { mic2: 2 }], ['mx.m117', { manual: 0.4, width: 0.5, speed: 0.3, regen: 0.4 }, { bypass: true }], ['bx.dd8', { mix: 0.25, feedback: 0.35, dtime: 0.45 }], ['bx.rv6', { mix: 0.18, decay: 0.45 }], meter],
    desc: {
      rs: '5150-style head with a smart gate – classic heavy metal crunch.',
      ls: 'SD-1 in front for tight sustain, plus delay and reverb.',
      rc: 'Boost, gate, 5150, dual-mic cab and the 10-band EQ trick for cut.',
      lc: 'Wah, boost, flanger (off), delay and reverb for screaming leads.',
    },
  }));
}

// ---------------------------------------------------------------- 7 Deathcore
{
  const amp = (gain) => ['peavey.amp-6505plus', { gain, bass: 0.6, mid: 0.45, treble: 0.6, master: 0.4, depth: 0.55, presence: 0.55, channel: 1 }];
  const cab = ['cab.4x12v30', {}];
  G.push(genre({
    id: 'deathcore', name: 'Deathcore', tags: ['deathcore', 'metal', 'high-gain', 'drop-tuning'], order: 7,
    rs: [['tz.lowdown', { semis1: 2, dry: 0 }], ['tc.ironcurtain', { threshold: 0.5 }], ['tc.spark', { gain: 0.2, level: 0.7, treble: 0.6, bass: 0.35 }], amp(0.62), cab],
    ls: [['tz.lowdown', { semis1: 2, dry: 0 }], ['tc.spark', { gain: 0.25, level: 0.7, treble: 0.6, bass: 0.35 }], amp(0.7), cab, ['tz.lumen', { time: 0.4, feedback: 0.3, mix: 0.2 }], ['tz.reverb', { decay: 0.5, mix: 0.18 }]],
    rc: [tuner(), ['dt.drop', { dsel: 2 }], ['tc.ironcurtain', { threshold: 0.5 }], ['ib.ts9', { gain: 0, tone: 0.6, level: 0.85 }], amp(0.62), ['cab.4x12v30', { mic1: 0, mic2: 4 }], ['tz.ladder', { b0: 0.55, b1: 0.45, b2: 0.42, b3: 0.5, b4: 0.55, b5: 0.52, b6: 0.45 }], ['bx.ns2', { threshold: 0.45, decay: 0.3 }], meter],
    lc: [tuner(), ['dt.drop', { dsel: 2 }], ['ib.ts9', { gain: 0.05, tone: 0.6, level: 0.85 }], ['tc.ironcurtain', { threshold: 0.4 }], amp(0.72), ['cab.4x12v30', { mic2: 4 }], ['tz.ladder', { b3: 0.55, b4: 0.58 }], ['tz.lumen', { time: 0.45, feedback: 0.35, mix: 0.22 }], ['tz.vaulted', { decay: 0.6, mix: 0.2 }], meter],
    desc: {
      rs: 'Two semitones down, hard gate and a treble-boosted 6505+ for crushing breakdowns.',
      ls: 'Detuned lead with more gain, delay and reverb.',
      rc: 'Drop pedal, gate, TS tightener, dual-mic V30, graphic EQ and a second gate after the amp.',
      lc: 'Drop-tuned lead rig with boost, gate, EQ, stereo delay and room.',
    },
  }));
}

// ---------------------------------------------------------------- 8 Metalcore
{
  const amp = (gain) => ['revv.amp-generator', { gain, bass: 0.55, mid: 0.5, treble: 0.6, presence: 0.55, master: 0.45, channel: 2 }];
  const cab = ['engl.cab-pro4x12', {}];
  G.push(genre({
    id: 'metalcore', name: 'Metalcore', tags: ['metalcore', 'metal', 'high-gain'], order: 8,
    rs: [['tz.hush', { threshold: 0.45, decay: 0.3 }], ['ib.tsmini', { gain: 0, tone: 0.6, level: 0.8 }], amp(0.6), cab],
    ls: [['ib.tsmini', { gain: 0.1, tone: 0.6, level: 0.8 }], amp(0.68), cab, ['bx.dd8', { mix: 0.25, feedback: 0.35, dtime: 0.45 }], ['tz.vaulted', { decay: 0.55, mix: 0.22 }]],
    rc: [tuner(), ['ib.tsmini', { gain: 0, tone: 0.6, level: 0.8 }], ['tz.hush', { threshold: 0.45, decay: 0.3 }], amp(0.6), ['engl.cab-pro4x12', { mic2: 2 }], ['tz.contour', { lowgain: 0.55, mid1gain: 0.45, highgain: 0.55 }], ['tz.vaulted', { decay: 0.4, mix: 0.12 }, { bypass: true }], meter],
    lc: [tuner(), ['tz.whammy', { expr: 0 }, { bypass: true }], ['ib.tsmini', { gain: 0.1, tone: 0.6, level: 0.8 }], ['tz.hush', { threshold: 0.35, decay: 0.4 }], amp(0.68), ['engl.cab-pro4x12', { mic2: 2 }], ['tz.halo', { rate: 0.3, depth: 0.3, mix: 0.25 }, { bypass: true }], ['bx.dd500', { time: 0.45, feedback: 0.35, mix: 0.25 }], ['mrs.mercury7', { decay: 0.6, mix: 0.25 }], meter],
    desc: {
      rs: 'Modern tight high gain with a TS front end and gate, for chugs and open chords.',
      ls: 'More gain with delay and a big room for melodic leads.',
      rc: 'Boost, gate, modern amp, dual-mic cab and a smile-free EQ; room on demand.',
      lc: 'Whammy (off), boost, gate, chorus (off), stereo delay and ambient reverb.',
    },
  }));
}

// ---------------------------------------------------------------- 9 Punk
{
  const amp = (gain) => ['marshall.amp-jcm900', { presence: 0.6, bass: 0.55, mid: 0.6, treble: 0.65, ga: gain, gb: gain, master: 0.55, channel: 1 }];
  const cab = ['cab.4x12t75', {}];
  G.push(genre({
    id: 'punk', name: 'Punk', tags: ['punk', 'crunch'], order: 9,
    rs: [amp(0.6), cab],
    ls: [['pc.rat2', { gain: 0.3, tone: 0.5, level: 0.6 }], amp(0.62), cab, ['bx.dd3', { mix: 0.15, feedback: 0.2, dtime: 0.25 }]],
    rc: [tuner(), ['bx.ds1', { level: 0.6, tone: 0.55, gain: 0.45 }, { bypass: true }], amp(0.6), ['cab.4x12t75', { mic2: 2 }], ['tz.spring', { mix: 0.1, decay: 0.25 }], meter],
    lc: [tuner(), ['bx.ds1', { level: 0.6, tone: 0.55, gain: 0.5 }], ['tz.boost', { gain: 0.35 }], amp(0.62), ['cab.4x12t75', { mic2: 2 }], ['ehx.memorytoy', { mix: 0.18, feedback: 0.25, time: 0.3 }], ['tz.spring', { mix: 0.12, decay: 0.3 }], meter],
    desc: {
      rs: 'Cranked British dual-channel head straight into T75s – loud, raw and simple.',
      ls: 'A RAT in front for leads, plus slapback.',
      rc: 'DS-1 for the chorus parts (off), the dirty channel and a splash of spring.',
      lc: 'DS-1 plus a clean boost for solos, analog echo and spring.',
    },
  }));
}

// ---------------------------------------------------------------- 10 Alt rock
{
  const amp = (gain) => ['amp.orange', { gain, bass: 0.55, mid: 0.6, treble: 0.55, master: 0.55 }];
  const cab = ['cab.4x12orange', {}];
  G.push(genre({
    id: 'alt-rock', name: 'Alt Rock', tags: ['alt-rock', 'rock'], order: 10,
    rs: [['tz.muff', { level: 0.55, tone: 0.5, gain: 0.55 }, { bypass: true }], amp(0.5), cab, ['tz.spring', { mix: 0.15 }]],
    ls: [['ehx.bigmuff', { level: 0.55, tone: 0.55, gain: 0.7 }], amp(0.5), cab, ['eqd.avalanche', { 'd.time': 0.45, 'd.feedback': 0.4, 'd.mix': 0.3 }]],
    rc: [tuner(), ['dt.drop', { dsel: 1 }, { bypass: true }], ['eqd.plumes', { level: 0.6, tone: 0.5, gain: 0.35 }], ['ehx.bigmuff', { level: 0.55, tone: 0.5, gain: 0.6 }, { bypass: true }], amp(0.5), ['cab.4x12orange', { mic2: 2 }], ['eqd.grandorbiter', { rate: 0.3, depth: 0.5, feedback: 0.4 }, { bypass: true }], ['tz.reverb', { decay: 0.4, mix: 0.18 }], meter],
    lc: [tuner(), ['tz.whammy', { expr: 0 }, { bypass: true }], ['eqd.plumes', { level: 0.6, tone: 0.55, gain: 0.4 }], ['ehx.bigmuff', { level: 0.55, tone: 0.55, gain: 0.7 }], amp(0.5), ['cab.4x12orange', { mic2: 2 }], ['eqd.avalanche', { 'd.time': 0.45, 'd.feedback': 0.45, 'd.mix': 0.3 }], ['eqd.afterneath', { decay: 0.5, mix: 0.3, size: 0.6 }], meter],
    desc: {
      rs: 'Mid-heavy British crunch with a Muff on standby for the chorus.',
      ls: 'Big Muff sustain into the amp with a stereo delay.',
      rc: 'Drop (off), Plumes-style OD, Muff, phaser (off) and reverb – 90s/00s alternative.',
      lc: 'Whammy, OD into fuzz, stereo delay and otherworldly reverb.',
    },
  }));
}

// ---------------------------------------------------------------- 11 Experimental
G.push(genre({
  id: 'experimental', name: 'Experimental', tags: ['experimental', 'ambient', 'noise'], order: 11,
  rs: [['eqd.datacorrupter', { wet: 0.6, dry: 0.5, level: 0.6 }], ['amp.jc120', { gain: 0.35 }], ['cab.2x12jc'], ['eqd.afterneath', { decay: 0.6, mix: 0.4 }]],
  ls: [['tz.staticbloom', { 'fz.gain': 0.6, 'fz.level': 0.55, 'cr.mix': 0.4 }], ['amp.ac30', { gain: 0.45 }], ['cab.2x12blue'], ['wa.fable', { 'd.mix': 0.35, 'r.mix': 0.35 }]],
  rc: [tuner(), ['bx.sl2', { level: 0.6, depth: 0.8, time: 0.5 }], ['mrs.ottobit', { 'c.bits': 0.6 }, { variant: 'mono' }], ['amp.jc120', { gain: 0.35 }], ['cab.2x12jc', { mic2: 2 }], ['sy.mobius', { mix: 0.5, speed: 0.4, depth: 0.6 }], ['wa.lore', { 'd.mix': 0.3, 'r.mix': 0.4 }], ['tz.glacier', { mix: 0.5 }, { bypass: true }], meter],
  lc: [tuner(), ['dt.whammy5', { expr: 0 }], ['bee.octahive', { 'f.gain': 0.6, 'f.level': 0.55 }], ['eqd.rainbow', { 'c.mix': 0.4, 'p.level1': 0.5 }], ['amp.ac30', { gain: 0.45 }], ['cab.2x12blue', { mic2: 2 }], ['ehx.superego', { mix: 0.5 }, { bypass: true }], ['mrs.polymoon', { 'd.mix': 0.35, 'd.feedback': 0.5 }], ['eqd.astral', { mix: 0.4, decay: 0.7 }], meter],
  desc: {
    rs: 'Harmonic synth tracking into a clean amp and a cavernous reverb.',
    ls: 'Fuzz into bit crusher, chiming amp and granular delay.',
    rc: 'Slicer, sequenced bit crusher, modulation workstation, reverse delay and freeze.',
    lc: 'Whammy, octave fuzz, polyphonic pitch, Superego hold, Polymoon and shimmer.',
  },
}));

// ---------------------------------------------------------------- 12 Jazz fusion
{
  const amp = (gain) => ['amp.dumble', { gain, treble: 0.5, mid: 0.6, bass: 0.45, master: 0.55, presence: 0.45 }];
  const cab = ['cab.2x12cream', {}];
  G.push(genre({
    id: 'jazz-fusion', name: 'Jazz Fusion', tags: ['jazz-fusion', 'jazz', 'lead'], order: 12,
    rs: [['tz.comp', { sustain: 0.35, ratio: 0.4, level: 0.55, blend: 0.6 }], amp(0.3), cab, ['tz.chorus', { rate: 0.3, depth: 0.3, mix: 0.3 }], ['tz.reverb', { decay: 0.4, mix: 0.2 }]],
    ls: [['jhs.atplus', { level: 0.6, gain: 0.55, bass: 0.5, treble: 0.5 }], amp(0.55), cab, ['kly.halo', { time: 0.45, feedback: 0.35, mix: 0.25 }], ['tz.reverb', { decay: 0.45, mix: 0.2 }]],
    rc: [tuner(), ['tz.comp', { sustain: 0.35, level: 0.55, blend: 0.6 }], ['tz.envfilter', { sens: 0.5, q: 0.5, range: 0.5 }, { bypass: true }], amp(0.3), ['cab.2x12cream', { mic2: 2 }], ['bx.dc2w', {}, { variant: 'stereo' }], ['tz.delay', { time: 0.4, feedback: 0.25, mix: 0.2 }], ['tz.reverb', { decay: 0.4, mix: 0.2 }], meter],
    lc: [tuner(), ['tz.vowel', { pos: 0.5 }, { bypass: true }], ['tz.comp', { sustain: 0.45, level: 0.55, blend: 0.55 }], ['jhs.atplus', { level: 0.6, gain: 0.55 }], amp(0.55), ['cab.2x12cream', { mic2: 2 }], ['tz.harmony', { level1: 0.3, semis1: 0.5 }, { bypass: true }], ['kly.halo', { time: 0.45, feedback: 0.35, mix: 0.25 }], ['tz.reverb', { decay: 0.5, mix: 0.22 }], meter],
    desc: {
      rs: 'Compressed Dumble-style clean with chorus for comping chords.',
      ls: 'Andy-Timmons-style drive into the amp for vocal, singing fusion leads.',
      rc: 'Compressor, envelope filter (off), dimension chorus, delay and reverb.',
      lc: 'Wah, compressor, drive, harmonizer (off), dual echo and hall.',
    },
  }));
}

// ---------------------------------------------------------------- 13 Pop
{
  const amp = (gain) => ['amp.deluxe', { gain, treble: 0.55, bass: 0.45, master: 0.6, bright: 1 }];
  const cab = ['cab.1x12us', {}];
  G.push(genre({
    id: 'pop', name: 'Pop', tags: ['pop', 'clean'], order: 13,
    rs: [['mx.m102', { level: 0.55, sustain: 0.45 }], amp(0.3), cab, ['tz.chorus', { rate: 0.35, depth: 0.25, mix: 0.25 }], ['tz.reverb', { decay: 0.35, mix: 0.2 }]],
    ls: [['bx.bd2', { level: 0.55, tone: 0.55, gain: 0.45 }], amp(0.35), cab, ['tz.delay', { time: 0.38, feedback: 0.3, mix: 0.25 }], ['tz.reverb', { decay: 0.45, mix: 0.22 }]],
    rc: [tuner(), ['mx.m102', { level: 0.55, sustain: 0.45 }], ['tz.peq', {}], amp(0.3), ['cab.1x12us', { mic2: 1 }], ['tz.trem', { rate: 0.45, depth: 0.4 }, { bypass: true }], ['tz.chorus', { rate: 0.35, depth: 0.25, mix: 0.25 }], ['tz.delay', { time: 0.35, feedback: 0.2, mix: 0.18 }], ['tz.reverb', { decay: 0.35, mix: 0.2 }], meter],
    lc: [tuner(), ['tz.opto', { sustain: 0.45, level: 0.55, blend: 0.6 }], ['bx.bd2', { level: 0.55, tone: 0.55, gain: 0.45 }], amp(0.35), ['cab.1x12us', { mic2: 1 }], ['tz.chorus', { rate: 0.3, depth: 0.2, mix: 0.2 }, { bypass: true }], ['tz.delay', { time: 0.38, feedback: 0.3, mix: 0.25 }], ['tz.reverb', { decay: 0.45, mix: 0.22 }], meter],
    desc: {
      rs: 'Squeaky-clean compressed blackface with lush chorus – for funky pop strums.',
      ls: 'Blues Driver edge, tempo delay and hall.',
      rc: 'Compressor, EQ, trem (off), chorus, delay and plate-ish hall; two mics.',
      lc: 'Opto comp, BD-2, chorus (off), delay and hall.',
    },
  }));
}

// ---------------------------------------------------------------- 14 Pop punk
{
  const amp = (gain) => ['mesa.amp-markv', { gain, master: 0.5, treble: 0.6, mid: 0.5, bass: 0.55, presence: 0.55, channel: 1 }];
  const cab = ['mesa.cab-2x12recto', {}];
  G.push(genre({
    id: 'pop-punk', name: 'Pop Punk', tags: ['pop-punk', 'punk', 'rock'], order: 14,
    rs: [['bx.sd1', { level: 0.7, tone: 0.55, gain: 0.15 }], amp(0.55), cab],
    ls: [['bx.sd1', { level: 0.7, tone: 0.55, gain: 0.25 }], amp(0.6), cab, ['bx.dd3', { mix: 0.2, feedback: 0.25, dtime: 0.35 }]],
    rc: [tuner(), ['bx.ns2', { threshold: 0.35 }], ['bx.sd1', { level: 0.7, tone: 0.55, gain: 0.15 }], amp(0.55), ['mesa.cab-2x12recto', { mic2: 2 }], ['tz.reverb', { decay: 0.3, mix: 0.1 }], meter],
    lc: [tuner(), ['bx.sd1', { level: 0.7, tone: 0.55, gain: 0.25 }], ['tz.boost', { gain: 0.3 }], amp(0.6), ['mesa.cab-2x12recto', { mic2: 2 }], ['mx.m117', { speed: 0.3, regen: 0.4 }, { bypass: true }], ['bx.dd8', { mix: 0.22, feedback: 0.3, dtime: 0.4 }], ['tz.reverb', { decay: 0.35, mix: 0.12 }], meter],
    desc: {
      rs: 'Bright, tight Mark-style crunch with an SD-1 in front – big power chords.',
      ls: 'Same, a bit hotter, with slapback.',
      rc: 'Noise suppressor, SD-1, dual-mic 2x12 and a little room.',
      lc: 'SD-1 plus boost, flanger (off), delay and reverb.',
    },
  }));
}

// ---------------------------------------------------------------- 15 Classic rock
{
  const amp = (gain) => ['amp.plexi', { presence: 0.55, bass: 0.5, mid: 0.65, treble: 0.6, gain, master: 0.6, bright: 1 }];
  const cab = ['cab.4x12gb', {}];
  G.push(genre({
    id: 'classic-rock', name: 'Classic Rock', tags: ['classic-rock', 'rock', 'crunch'], order: 15,
    rs: [amp(0.6), cab, ['tz.spring', { mix: 0.12, decay: 0.3 }]],
    ls: [['tz.trebleboost', { gain: 0.6 }], amp(0.65), cab, ['tz.reelecho', { time: 0.35, feedback: 0.3, mix: 0.2 }]],
    rc: [tuner(), ['tz.trebleboost', { gain: 0.5 }, { bypass: true }], ['mx.m101', { rate: 0.3 }, { bypass: true }], amp(0.6), ['cab.4x12gb', { mic2: 2 }], ['tz.rotary', { mix: 0.4 }, { bypass: true }], ['tz.reverb', { decay: 0.3, mix: 0.12, mode: 0 }], meter],
    lc: [tuner(), ['dn.gcb95', { pos: 0.5 }, { bypass: true }], ['tz.fuzzface', { level: 0.55, gain: 0.7 }, { bypass: true }], ['tz.trebleboost', { gain: 0.6 }], amp(0.65), ['cab.4x12gb', { mic2: 2 }], ['mx.m68', { level: 0.55, intensity: 0.5, speed: 0.35 }, { bypass: true }], ['tz.reelecho', { time: 0.35, feedback: 0.3, mix: 0.2 }], ['tz.spring', { mix: 0.12 }], meter],
    desc: {
      rs: 'Cranked Plexi with the channels jumped into greenbacks.',
      ls: 'Treble booster into the Plexi with tape echo – 70s lead.',
      rc: 'Treble boost and Phase 90 (off), dual-mic cab, rotary (off) and spring.',
      lc: 'Wah, Fuzz Face (off), treble booster, Uni-Vibe (off), tape echo.',
    },
  }));
}

// ---------------------------------------------------------------- 16 EDM
G.push(genre({
  id: 'edm', name: 'EDM', tags: ['edm', 'pop', 'synth'], order: 16,
  rs: [['tz.comp', { sustain: 0.5, level: 0.55, blend: 0.7 }], ['tz.pulsegrid', { time: 0.4, depth: 0.85, mix: 0.9 }], ['amp.jc120', { gain: 0.3, treble: 0.6 }], ['cab.2x12jc'], ['tz.reverb', { decay: 0.45, mix: 0.25 }]],
  ls: [['bx.sy200', { wet: 0.75, dry: 0.3, filter: 0.6, reso: 0.4 }], ['amp.jc120', { gain: 0.3 }], ['cab.2x12jc'], ['tz.delay', { time: 0.38, feedback: 0.4, mix: 0.3 }], ['tz.reverb', { decay: 0.6, mix: 0.3 }]],
  rc: [tuner(), ['tz.comp', { sustain: 0.5, level: 0.55, blend: 0.7 }], ['bx.sl2', { level: 0.6, depth: 0.9, time: 0.5, pattern: 3 }], ['amp.jc120', { gain: 0.3, treble: 0.6 }], ['cab.2x12jc', { mic2: 1 }], ['tz.panorama', { rate: 0.5, depth: 0.7, width: 0.8 }], ['tz.delay', { time: 0.38, feedback: 0.35, mix: 0.25 }], ['tz.vaulted', { decay: 0.55, mix: 0.25 }], meter],
  lc: [tuner(), ['tz.neonlead', { filter: 0.6, reso: 0.4, wet: 0.8, dry: 0.2 }], ['bx.sy1', { wet: 0.6, dry: 0.3 }, { bypass: true }], ['amp.jc120', { gain: 0.3 }], ['cab.2x12jc', { mic2: 1 }], ['tz.crush', { bits: 0.6, rate: 0.6, mix: 0.3 }, { bypass: true }], ['tz.delay', { time: 0.38, feedback: 0.4, mix: 0.3 }], ['tz.shimmer', { decay: 0.6, mix: 0.3 }], meter],
  desc: {
    rs: 'Compressed clean chopped by a tempo gate – sidechain-pump guitar for drops.',
    ls: 'Guitar synth lead into tempo delay and big reverb.',
    rc: 'Compressor, slicer patterns, auto-pan, delay and reverb in stereo.',
    lc: 'Mono synth lead, second synth (off), bit crusher (off), delay and shimmer.',
  },
}));

// ---------------------------------------------------------------- 17 Ambient
G.push(genre({
  id: 'ambient', name: 'Ambient', tags: ['ambient', 'experimental', 'clean'], order: 17,
  rs: [['tz.tidalswell', { sens: 0.5, attack: 0.55, level: 0.6 }], ['amp.twin', { gain: 0.3, treble: 0.5, bass: 0.5, master: 0.6 }], ['cab.2x12twin'], ['sy.cloudburst', { decay: 0.8, mix: 0.5 }]],
  ls: [['tz.lantern', { gain: 0.4, tone: 0.5, level: 0.6 }], ['amp.twin', { gain: 0.35 }], ['cab.2x12twin'], ['sy.timeline', { 'd.time': 0.5, 'd.feedback': 0.5, 'd.mix': 0.35 }], ['sy.bigsky', { decay: 0.85, mix: 0.45 }]],
  rc: [tuner(), ['tz.tidalswell', { sens: 0.5, attack: 0.55, level: 0.6 }], ['amp.twin', { gain: 0.3 }], ['cab.2x12twin', { mic2: 2 }], ['drb.komorebi', { mix: 0.4 }], ['wa.fable', { 'd.mix': 0.35, 'r.mix': 0.4 }], ['sy.nightsky', { 'r.decay': 0.8, 'r.mix': 0.5 }], ['tz.glacier', { mix: 0.5 }, { bypass: true }], meter],
  lc: [tuner(), ['tz.silkvol', { pos: 1 }], ['tz.lantern', { gain: 0.4, tone: 0.5, level: 0.6 }], ['amp.twin', { gain: 0.35 }], ['cab.2x12twin', { mic2: 2 }], ['sy.ola', { mix: 0.3 }], ['sy.timeline', { 'd.time': 0.5, 'd.feedback': 0.55, 'd.mix': 0.35 }], ['mrs.mercuryx', { decay: 0.8, mix: 0.45 }], ['tz.shimmer', { decay: 0.85, mix: 0.3 }], meter],
  desc: {
    rs: 'Auto-swells into a clean twin and a vast ambient reverb.',
    ls: 'Soft drive, long delays and a huge hall.',
    rc: 'Swells, BBD chorus, granular delay, NightSky-style pads and freeze.',
    lc: 'Stereo volume, soft drive, chorus, long delay, MercuryX and shimmer.',
  },
}));

// ---------------------------------------------------------------- 18 Acoustic
G.push(genre({
  id: 'acoustic', name: 'Acoustic', tags: ['acoustic', 'clean'], order: 18,
  rs: [['lrb.alignsession', { 'a.level': 0.85, 'a.comp': 0.4 }], ['lrb.aligneq', { 'a.level': 0.75 }], ['lrb.alignreverb', { mix: 0.25, decay: 0.4 }]],
  ls: [['fm.platpro', { gain: 0.65, vol: 0.85 }], ['fm.bluechorus', { rate: 0.3, depth: 0.3, mix: 0.25 }], ['fm.echoback', { time: 0.4, feedback: 0.25, mix: 0.2 }], ['lrb.alignreverb', { mix: 0.3, decay: 0.45 }]],
  rc: [tuner(), ['lrb.venue', { gain: 0.65, vol: 0.85 }], ['tz.featherweight', { sustain: 0.3, level: 0.55, blend: 0.5 }], ['lrb.aligneq', {}], ['lrb.alignchorus', { mix: 0.2 }, { bypass: true }], ['tz.steelplate', { decay: 0.4, mix: 0.2 }], meter],
  lc: [tuner(), ['gd.alix', { 'a.level': 0.7, vol: 0.85 }], ['tz.featherweight', { sustain: 0.35, level: 0.55, blend: 0.5 }], ['tz.spruce', {}], ['lrb.alignchorus', { mix: 0.25 }], ['fm.echoback', { time: 0.4, feedback: 0.25, mix: 0.2 }], ['tz.steelplate', { decay: 0.5, mix: 0.25 }], meter],
  desc: {
    rs: 'For an acoustic guitar with a pickup: studio-style preamp, EQ and reverb.',
    ls: 'Platinum-style DI, chorus, echo and reverb for fingerstyle melodies.',
    rc: 'Venue DI, light compression, EQ, chorus (off) and plate.',
    lc: 'Studio preamp, compressor, piezo enhancer, chorus, echo and plate.',
  },
}));

// ---------------------------------------------------------------- 19 Classic metal
{
  const amp = (gain) => ['amp.jcm800', { gain, master: 0.5, presence: 0.6, bass: 0.55, mid: 0.65, treble: 0.6 }];
  const cab = ['celestion.cab-g12-65', {}];
  G.push(genre({
    id: 'classic-metal', name: 'Classic Metal', tags: ['classic-metal', 'metal', 'rock'], order: 19,
    rs: [['mx.m104', { level: 0.75, gain: 0.25 }], amp(0.7), cab],
    ls: [['mx.m104', { level: 0.75, gain: 0.35 }], amp(0.75), cab, ['mx.m169', { feedback: 0.3, mix: 0.25, time: 0.45 }], ['tz.reverb', { decay: 0.4, mix: 0.18 }]],
    rc: [tuner(), ['mx.m104', { level: 0.75, gain: 0.25 }], ['mx.m108', { level: 0.55, gain: 0.5, b0: 0.4, b5: 0.6, b6: 0.58 }], amp(0.7), ['celestion.cab-g12-65', { mic2: 2 }], ['bx.ce2w', { rate: 0.3, depth: 0.3 }, { bypass: true }], meter],
    lc: [tuner(), ['dn.gcb95', { pos: 0.5 }, { bypass: true }], ['mx.m104', { level: 0.75, gain: 0.35 }], ['mx.m108', { level: 0.55, gain: 0.5, b5: 0.62, b6: 0.6 }], amp(0.75), ['celestion.cab-g12-65', { mic2: 2 }], ['mx.m134', { rate: 0.3, depth: 0.25 }, { bypass: true }], ['mx.m169', { feedback: 0.3, mix: 0.25, time: 0.45 }], ['tz.reverb', { decay: 0.4, mix: 0.18 }], meter],
    desc: {
      rs: 'Distortion+ into a hot 800 – early-80s NWOBHM rhythm.',
      ls: 'More push with analog delay and reverb.',
      rc: 'Distortion+, 10-band EQ boost, dual-mic G12-65 cab, CE-2 (off).',
      lc: 'Wah, Distortion+, EQ, chorus (off), analog delay and reverb.',
    },
  }));
}

// ---------------------------------------------------------------- 20 Country
{
  const amp = (gain) => ['amp.twin', { gain, treble: 0.65, mid: 0.45, bass: 0.45, master: 0.6, bright: 1 }];
  const cab = ['cab.2x12twin', {}];
  G.push(genre({
    id: 'country', name: 'Country', tags: ['country', 'clean'], order: 20,
    rs: [['mx.m102', { level: 0.55, sustain: 0.5 }], amp(0.3), cab, ['tz.spring', { mix: 0.2, decay: 0.35 }]],
    ls: [['mx.m102', { level: 0.55, sustain: 0.55 }], ['fender.santaana', { level: 0.6, gain: 0.3, bright: 0.5, bass: 0.5, mid: 0.5, treble: 0.55 }], amp(0.32), cab, ['bx.dm2w', { dtime: 0.2, mix: 0.25, feedback: 0.15 }], ['tz.spring', { mix: 0.18 }]],
    rc: [tuner(), ['kly.compplus', { sustain: 0.5, level: 0.55, blend: 0.55 }], ['tz.boost', { gain: 0.2 }], amp(0.3), ['cab.2x12twin', { mic2: 2 }], ['tz.trem', { rate: 0.5, depth: 0.45 }, { bypass: true }], ['fender.marinelayer', { decay: 0.35, mix: 0.2 }], meter],
    lc: [tuner(), ['kly.compplus', { sustain: 0.55, level: 0.55, blend: 0.55 }], ['fender.santaana', { level: 0.6, gain: 0.3 }], ['tz.boost', { gain: 0.35 }, { bypass: true }], amp(0.32), ['cab.2x12twin', { mic2: 2 }], ['fender.mirrorimage', { time: 0.2, feedback: 0.15, mix: 0.22 }], ['fender.marinelayer', { decay: 0.35, mix: 0.18 }], meter],
    desc: {
      rs: 'Squashed, sparkling Twin with spring – chicken pickin\' rhythm.',
      ls: 'Compressor and a low-gain Fender drive, slapback and spring.',
      rc: 'Compressor, clean boost, dual-mic Twin, tremolo (off) and reverb.',
      lc: 'Comp, drive and boost (off), slapback and reverb for Tele leads.',
    },
  }));
}

// ---------------------------------------------------------------- 21 Country rock
{
  const amp = (gain) => ['fender.amp-hotrod', { 'a.vol': gain, 'a.drv': 0.4, 'a.treble': 0.6, 'a.bass': 0.5, 'a.mid': 0.55, 'a.master': 0.5, 'r.mix': 0.15, 'a.channel': 1 }];
  const cab = ['cab.1x12us', {}];
  G.push(genre({
    id: 'country-rock', name: 'Country Rock', tags: ['country-rock', 'country', 'rock'], order: 21,
    rs: [['bx.bd2', { level: 0.6, tone: 0.55, gain: 0.35 }], amp(0.45), cab],
    ls: [['bx.bd2', { level: 0.6, tone: 0.55, gain: 0.45 }], ['tz.boost', { gain: 0.25 }], amp(0.5), cab, ['bx.dm2w', { dtime: 0.3, mix: 0.25, feedback: 0.25 }]],
    rc: [tuner(), ['mx.m102', { level: 0.55, sustain: 0.4 }], ['bx.bd2', { level: 0.6, tone: 0.55, gain: 0.35 }], amp(0.45), ['cab.1x12us', { mic2: 2 }], ['bx.dd3', { mix: 0.15, feedback: 0.2, dtime: 0.3 }, { bypass: true }], ['tz.spring', { mix: 0.12 }], meter],
    lc: [tuner(), ['mx.m102', { level: 0.55, sustain: 0.45 }], ['bx.bd2', { level: 0.6, tone: 0.55, gain: 0.45 }], ['kly.katana', { gain: 0.3 }], amp(0.5), ['cab.1x12us', { mic2: 2 }], ['bx.dm2w', { dtime: 0.3, mix: 0.25, feedback: 0.25 }], ['tz.spring', { mix: 0.15 }], meter],
    desc: {
      rs: 'Blues Driver into a Hot Rod for gritty southern rhythm.',
      ls: 'Stacked BD-2 and boost with analog delay.',
      rc: 'Compressor, BD-2, dual-mic cab, slapback (off) and spring.',
      lc: 'Compressor, BD-2, Katana boost, analog delay and spring.',
    },
  }));
}

// ---------------------------------------------------------------- special presets
const SPECIAL = [];

// Multi-layered worship rig: one input, a 4-way stereo selector picks a whole chain (gospel clean → contemporary
// ambient → overdrive → heavy), every chain feeds a shared ambience section.
SPECIAL.push({
  file: 's01-worship-multi-rig',
  name: 'Worship · Multi-Layer Rig',
  tags: ['worship', 'contemporary-worship', 'gospel', 'complex', 'rhythm', 'lead', 'ambient'],
  desc: 'Four complete rigs behind one selector (A gospel clean, B contemporary ambient, C overdrive, D heavy). Each has its own drives, amp and cab; all of them share the delays and reverbs at the end. Use the selector\'s footswitches to change chains; MULTI mode stacks them.',
  order: 10,
  nodes: {
    tun: ['tz.tuner', {}, { bypass: true }],
    swell: ['tz.tidalswell', { sens: 0.5, attack: 0.5, level: 0.6 }, { bypass: true }],
    comp: ['sy.compadre', { 'c.sustain': 0.4, 'c.level': 0.55, 'c.blend': 0.6 }],
    sel: ['tz.select4', { fade: 0.2 }, { raw: { sel: 0, mode: 0 } }],
    // A · gospel clean: Twin, chorus, organ-ish Leslie
    a1: ['mx.m134', { rate: 0.25, depth: 0.3, feedback: 0.15, tone: 0.5 }],
    a2: ['amp.twin', { gain: 0.32, treble: 0.55, mid: 0.5, bass: 0.5, master: 0.6, bright: 1 }],
    a3: ['cab.2x12twin', { mic2: 2 }],
    a4: ['tz.rotary', { mix: 0.35 }, { bypass: true, variant: 'mono' }],
    // B · contemporary ambient: transparent drive into an EF86-style amp, dotted delay
    b1: ['tz.klone', { gain: 0.3, tone: 0.55, level: 0.6 }],
    b2: ['amp.dc30', { gain: 0.4, bass: 0.48, treble: 0.55, presence: 0.5, master: 0.6 }],
    b3: ['tworock.cab-1x12', { mic2: 2 }],
    b4: ['bx.dd8', { mix: 0.3, feedback: 0.4, dtime: 0.45 }],
    // C · overdrive: stacked Morning Glory + Blues Driver into an AC30
    c1: ['jhs.morningglory', { level: 0.55, gain: 0.5, tone: 0.55 }],
    c2: ['bx.bd2', { level: 0.55, tone: 0.5, gain: 0.45 }],
    c3: ['amp.ac30', { gain: 0.45, treble: 0.55, bass: 0.5, presence: 0.5, master: 0.6 }],
    c4: ['cab.2x12blue', { mic2: 2 }],
    // D · heavy: gate + Dirty Shirley, wide modern lead
    d1: ['tz.hush', { threshold: 0.35, decay: 0.4 }],
    d2: ['friedman.amp-dirtyshirley', { presence: 0.55, bass: 0.5, mid: 0.6, treble: 0.55, master: 0.5, gain: 0.7 }],
    d3: ['cab.4x12gb', { mic2: 2 }],
    // shared ambience
    mix: ['box.merge4'],
    dly: ['sy.timeline', { 'd.time': 0.45, 'd.feedback': 0.35, 'd.mix': 0.22 }],
    rev: ['sy.bigsky', { decay: 0.7, mix: 0.3 }],
    shim: ['tz.shimmer', { decay: 0.8, mix: 0.25, shimmer: 0.35 }, { bypass: true }],
    frz: ['tz.glacier', { mix: 0.5 }, { bypass: true }],
    met: ['tz.meter'],
  },
  edges: [
    ['in', 'tun'], ['tun', 'swell'], ['swell', 'comp'], ['comp', 'sel', 0, 0],
    ['sel', 'a1', 0, 0], ['a1', 'a2'], ['a2', 'a3'], ['a3', 'a4'], ['a4', 'mix', 0, 0],
    ['sel', 'b1', 2, 0], ['b1', 'b2'], ['b2', 'b3'], ['b3', 'b4'], ['b4', 'mix', 0, 1],
    ['sel', 'c1', 4, 0], ['c1', 'c2'], ['c2', 'c3'], ['c3', 'c4'], ['c4', 'mix', 0, 2],
    ['sel', 'd1', 6, 0], ['d1', 'd2'], ['d2', 'd3'], ['d3', 'mix', 0, 3],
    ['mix', 'dly'], ['dly', 'rev', 0, 0], ['dly', 'rev', 1, 1], ['rev', 'shim', 0, 0], ['rev', 'shim', 1, 1], ['shim', 'frz', 0, 0], ['shim', 'frz', 1, 1], ['frz', 'met', 0, 0], ['frz', 'met', 1, 1], ['met', 'out', 0, 0], ['met', 'out', 1, 1],
  ],
  rows: [['tun', 'swell', 'comp', 'sel'], ['@sel', 'a1', 'a2', 'a3', 'a4'], ['@sel', 'b1', 'b2', 'b3', 'b4'], ['@sel', 'c1', 'c2', 'c3', 'c4'], ['@sel', 'd1', 'd2', 'd3'], ['@c4', 'mix', 'dly', 'rev', 'shim', 'frz', 'met']],
});

// "Crazy Train"-style tone: Distortion+ into a modded 800 with the 10-band EQ, chorus and echo for the solo
SPECIAL.push({
  file: 's02-crazy-train', name: 'Crazy Train', order: 11,
  tags: ['classic-metal', 'metal', 'rhythm', 'lead', 'complex'],
  desc: 'Inspired by the early-80s Randy Rhoads sound: a Distortion+ and a 10-band EQ (mid hump) into a hot modded 800 and G12-65s. Kick in the chorus and echo for the solo; the wah is there for the fills.',
  chain: [tuner(), ['dn.gcb95', { pos: 0.55 }, { bypass: true }], ['mx.m104', { level: 0.75, gain: 0.3 }], ['mx.m108', { level: 0.55, gain: 0.55, b0: 0.38, b1: 0.45, b2: 0.55, b3: 0.62, b4: 0.6, b5: 0.55, b6: 0.5, b7: 0.48, b8: 0.45, b9: 0.4 }], ['amp.jcm800', { gain: 0.78, master: 0.5, presence: 0.6, bass: 0.5, mid: 0.7, treble: 0.6 }], ['celestion.cab-g12-65', { mic1: 0, mic2: 2 }], ['mx.m134', { rate: 0.3, depth: 0.3, feedback: 0.1, tone: 0.5 }, { bypass: true }], ['mx.m169', { feedback: 0.25, mix: 0.22, time: 0.4, mod: 0.2 }, { bypass: true }], ['tz.reverb', { decay: 0.35, mix: 0.12, mode: 0 }], meter],
});

// "For The Love Of God"-style lead (Steve Vai) for an Ibanez with active pickups
SPECIAL.push({
  file: 's03-love-of-god', name: 'For The Love Of God (Ibanez)', order: 12,
  tags: ['lead', 'rock', 'instrumental', 'complex', 'ibanez'],
  desc: 'Inspired by Steve Vai\'s singing lead tone: Bad Horsie-style wah, a light compressor, a TS used as a clean boost into a Bogner-style red channel, a mid-forward EQ, wide stereo delay and a big hall. Made for an Ibanez with hot/active pickups – the input gain stays modest so the notes bloom instead of fizz.',
  chain: [tuner(), ['mo.badhorsie', { 'w.pos': 0.5, 'w.range': 0.5, 'w.level': 0.55 }], ['kly.compplus', { sustain: 0.3, level: 0.55, blend: 0.4, tone: 0.5 }], ['ib.ts9', { gain: 0.08, tone: 0.55, level: 0.72 }], ['bogner.amp-ecstasy', { gain: 0.62, master: 0.55, treble: 0.52, mid: 0.65, bass: 0.45, presence: 0.5, channel: 2 }], ['cab.4x12uber', { mic1: 0, mic2: 2 }], ['tz.paraeq', { b3on: 1 }], ['tz.harmony', { level1: 0.12, semis1: 0.5, dry: 1 }, { bypass: true }], ['tz.lumen', { time: 0.42, feedback: 0.38, mix: 0.25, spread: 0.7 }], ['sy.bigsky', { decay: 0.75, mix: 0.3 }], meter],
});

module.exports = [...G.flat(), ...SPECIAL];
