// Factory preset specs (see build-presets.js for the format). Knob values are positions 0..1.
// Genre library: every genre has a simple and a complex rig for rhythm and for lead.

const TUNERS = ['tz.tuner', 'bx.tu3', 'tc.polytune3', 'bx.tu3w', 'tc.polytune3mini', 'bh.tm300'];
let tunerI = 0;
const tuner = () => [TUNERS[tunerI++ % TUNERS.length], {}, { bypass: true }];
const meter = ['tz.meter'];
const off = (item) => [item[0], item[1] || {}, Object.assign({}, item[2] || {}, { bypass: true })];

// g: { id, name, tags, order, rs, ls, rc, lc, desc: {rs, ls, rc, lc} }, each r*/l* is a chain array
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
    mk('rhythm', 'Rhythm', g.rs, ['rhythm'], g.desc.rs, 1),
    mk('lead', 'Lead', g.ls, ['lead'], g.desc.ls, 2),
    mk('rhythm-pro', 'Rhythm Pro', g.rc, ['rhythm'], g.desc.rc, 3),
    mk('lead-pro', 'Lead Pro', g.lc, ['lead'], g.desc.lc, 4),
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
      rs: 'Warm solid-state clean with the treble rolled back and a touch of spring. For comping on the neck pickup.',
      ls: 'A light, clear boost for single-note lines, a short analog slap echo and spring.',
      rc: 'Compressed clean with scooped mids, optional stereo chorus and a soft stereo room. Two mics on the cab (dynamic and ribbon).',
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
      rs: 'Chimey top-boost clean with gentle compression and a warm hall. Sits nicely under a choir.',
      ls: 'A Morning Glory style drive into a chiming amp, dotted delay and hall for melodic lines.',
      rc: 'Full worship rhythm board: compressor, two low-gain drives (off), a cab with two mics, optional chorus, delay and room.',
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
      rs: 'Boutique EF86-style clean, studio compression, a dotted-eighth TimeLine delay and a big BigSky-style hall.',
      ls: 'A clear drive into the amp with longer, wetter delays and reverb for lead lines.',
      rc: 'Modern worship rhythm board: swell, compressor, a Klon-style and a multi-stage drive (off), chorus, dotted delay, hall and a freeze for pads.',
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
      rs: 'A JCM800 boosted by a Tube Screamer into Greenback speakers. The classic tight rock rhythm.',
      ls: 'An Oxblood-style drive pushing the amp harder, with analog echo and spring.',
      rc: 'Gate, Tube Screamer boost, optional Phase 90, a cab with two mics, delay (off) and room.',
      lc: 'Wah, compressor, a Tube Screamer and a RAT for two lead levels, EQ, delay and reverb.',
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
      rs: 'A gated Rectifier, tightened by a Tube Screamer, into V30 speakers for heavy palm mutes.',
      ls: 'Same rig hotter, with a stereo delay and a little room for solos.',
      rc: 'Tube Screamer boost, gate, Rectifier, a V30 cab with two mics and a 7-band EQ after the amp.',
      lc: 'Wah, boost, gate, Rectifier, EQ, optional chorus, delay and reverb.',
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
      rs: 'A 5150-style head with a smart gate. Classic heavy metal crunch.',
      ls: 'SD-1 in front for tight sustain, plus delay and reverb.',
      rc: 'Boost, gate, 5150, a cab with two mics and a 10-band EQ to help it cut through.',
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
      rc: 'Drop pedal, gate, Tube Screamer to tighten, a V30 cab with two mics, graphic EQ and a second gate after the amp.',
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
      rs: 'Modern, tight high gain with a Tube Screamer and gate in front, for chugs and open chords.',
      ls: 'More gain with delay and a big room for melodic leads.',
      rc: 'Boost, gate, modern amp, a cab with two mics and an EQ without the mid scoop. Room reverb when you want it.',
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
      rs: 'A cranked British two-channel head straight into T75 speakers. Loud, raw and simple.',
      ls: 'A RAT in front for leads, plus slapback.',
      rc: 'A DS-1 for the choruses (off), the dirty channel and a splash of spring.',
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
      rc: 'Drop pedal (off), a Plumes-style overdrive, Muff, phaser (off) and reverb. 90s and 00s alternative.',
      lc: 'Whammy, overdrive into fuzz, stereo delay and an otherworldly reverb.',
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
    rs: 'A synth that follows your notes, into a clean amp and a huge reverb.',
    ls: 'Fuzz into a bit crusher, a chiming amp and a granular delay.',
    rc: 'Slicer, a stepped bit crusher, a big modulation pedal, reverse delay and freeze.',
    lc: 'Whammy, octave fuzz, pitch shifter, a Superego for held notes, Polymoon delay and shimmer.',
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
      ls: 'An Andy Timmons style drive into the amp for singing fusion leads.',
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
      rs: 'A squeaky-clean, compressed blackface amp with lush chorus. For funky pop strumming.',
      ls: 'Blues Driver edge, tempo delay and hall.',
      rc: 'Compressor, EQ, tremolo (off), chorus, delay and a plate-like hall, with two mics on the cab.',
      lc: 'Opto compressor, BD-2, chorus (off), delay and hall.',
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
      rs: 'Bright, tight Mark-style crunch with an SD-1 in front. Big power chords.',
      ls: 'Same, a bit hotter, with slapback.',
      rc: 'Noise gate, SD-1, a 2x12 with two mics and a little room.',
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
      rs: 'A cranked Plexi with jumped channels into Greenback speakers.',
      ls: 'A treble booster into the Plexi with tape echo. 70s lead.',
      rc: 'Treble booster and Phase 90 (off), a cab with two mics, rotary (off) and spring.',
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
    rs: 'A compressed clean chopped in time by a gate, for pumping EDM-style guitar on the drops.',
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
    rc: 'Swells, analog chorus, granular delay, NightSky-style pads and freeze.',
    lc: 'Stereo volume pedal, soft drive, chorus, long delay, MercuryX reverb and shimmer.',
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
      rs: 'A Distortion+ into a hot JCM800. Early-80s British heavy metal rhythm.',
      ls: 'More push with analog delay and reverb.',
      rc: 'Distortion+, a 10-band EQ boost, a G12-65 cab with two mics and a CE-2 chorus (off).',
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
      rs: 'A squashed, sparkling Twin with spring, for chicken pickin\' rhythm.',
      ls: 'Compressor and a low-gain Fender drive, slapback and spring.',
      rc: 'Compressor, clean boost, a Twin with two mics, tremolo (off) and reverb.',
      lc: 'Compressor, drive and boost (off), slapback and reverb for Tele leads.',
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
      rc: 'Compressor, BD-2, a cab with two mics, slapback (off) and spring.',
      lc: 'Compressor, BD-2, Katana boost, analog delay and spring.',
    },
  }));
}

// ---------------------------------------------------------------- 22 Grunge
{
  const amp = (gain) => ['amp.recto', { gain, treble: 0.55, mid: 0.42, bass: 0.6, presence: 0.5, master: 0.5, channel: 1 }];
  const cab = ['cab.4x12v30', {}];
  G.push(genre({
    id: 'grunge', name: 'Grunge', tags: ['grunge', 'rock', 'alt-rock'], order: 22,
    rs: [['bx.ds1', { level: 0.6, tone: 0.45, gain: 0.7 }], ['amp.twin', { gain: 0.4, treble: 0.55, mid: 0.4, bass: 0.55, master: 0.6 }], ['cab.2x12twin']],
    ls: [['ehx.bigmuff', { level: 0.55, tone: 0.5, gain: 0.75 }], amp(0.35), cab, ['mx.m169', { time: 0.3, feedback: 0.2, mix: 0.12 }]],
    rc: [tuner(), ['bx.ns2', { threshold: 0.35, decay: 0.4 }], ['dt.grunge', { level: 0.55, bass: 0.6, treble: 0.5, gain: 0.6 }], ['ehx.nanoclone', {}, { bypass: true }], amp(0.45), ['cab.4x12v30', { mic2: 2 }], ['tz.spring', { mix: 0.08, decay: 0.3 }], meter],
    lc: [tuner(), ['dn.gcb95', { pos: 0.6 }, { bypass: true }], ['ehx.bigmuff', { level: 0.55, tone: 0.55, gain: 0.8 }], ['evh.phase90', { rate: 0.3 }, { bypass: true }], amp(0.4), ['cab.4x12v30', { mic2: 2 }], ['mx.m169', { time: 0.35, feedback: 0.25, mix: 0.15 }], ['tz.reverb', { decay: 0.35, mix: 0.12 }], meter],
    desc: {
      rs: 'An orange-box distortion into a loud clean Twin. The quiet verse, loud chorus garage sound.',
      ls: 'Big Muff sludge into a Rectifier with a short analog echo.',
      rc: 'Gate, the grunge distortion pedal, chorus for the clean verses (off), Rectifier and a hint of spring.',
      lc: 'Wah (off), Big Muff, phaser (off), Rectifier, analog delay and room for feedback-laden solos.',
    },
  }));
}

// ---------------------------------------------------------------- 23 Blues
{
  const amp = (gain) => ['amp.bassman', { gain, presence: 0.5, mid: 0.55, bass: 0.45, treble: 0.55, master: 0.6 }];
  const cab = ['cab.4x10tweed', {}];
  G.push(genre({
    id: 'blues', name: 'Blues', tags: ['blues', 'crunch'], order: 23,
    rs: [amp(0.45), cab, ['tz.spring', { mix: 0.18, decay: 0.4 }]],
    ls: [['ib.ts808', { gain: 0.45, tone: 0.55, level: 0.6 }], amp(0.5), cab, ['mx.m169', { time: 0.35, feedback: 0.25, mix: 0.18 }], ['tz.spring', { mix: 0.15 }]],
    rc: [tuner(), ['tz.klone', { gain: 0.3, tone: 0.5, level: 0.6 }], amp(0.45), ['cab.4x10tweed', { mic2: 2 }], ['tz.trem', { rate: 0.45, depth: 0.5 }, { bypass: true }], ['tz.spring', { mix: 0.2, decay: 0.4 }], meter],
    lc: [tuner(), ['dn.cbm95', { pos: 0.55 }, { bypass: true }], ['ib.ts808', { gain: 0.5, tone: 0.55, level: 0.62 }], ['kly.katana', { gain: 0.3 }], amp(0.5), ['cab.4x10tweed', { mic2: 2 }], ['mx.m169', { time: 0.4, feedback: 0.3, mix: 0.2 }], ['tz.spring', { mix: 0.15 }], meter],
    desc: {
      rs: 'A tweed Bassman right on the edge of breakup. Dig in for grit, play softly for clean.',
      ls: 'Tube Screamer into a tweed, analog delay and spring for Texas-style leads.',
      rc: 'A Klon-style boost, a tweed amp with two mics, tremolo (off) and spring.',
      lc: 'Wah (off), Screamer and Katana boost into the tweed, analog delay and spring.',
    },
  }));
}

// ---------------------------------------------------------------- 24 Funk
{
  const amp = (gain) => ['amp.twin', { gain, treble: 0.62, mid: 0.4, bass: 0.45, master: 0.6, bright: 1 }];
  G.push(genre({
    id: 'funk', name: 'Funk', tags: ['funk', 'clean'], order: 24,
    rs: [['mx.m102', { level: 0.55, sustain: 0.55 }], amp(0.3), ['cab.2x12twin']],
    ls: [['ehx.qtron', { sens: 0.55, q: 0.6 }], ['mx.m102', { level: 0.55, sustain: 0.5 }], amp(0.32), ['cab.2x12twin'], ['tz.spring', { mix: 0.12 }]],
    rc: [tuner(), ['kly.compplus', { sustain: 0.55, level: 0.55, blend: 0.6 }], ['bx.aw3', { sens: 0.5, q: 0.55, range: 0.5 }, { bypass: true }], amp(0.3), ['cab.2x12twin', { mic2: 2 }], ['ehx.smallstone', { rate: 0.35 }, { bypass: true }], ['tz.spring', { mix: 0.1 }], meter],
    lc: [tuner(), ['kly.compplus', { sustain: 0.5, level: 0.55, blend: 0.55 }], ['dn.535q', { pos: 0.5 }], ['ib.ts9', { gain: 0.3, tone: 0.6, level: 0.6 }], amp(0.35), ['cab.2x12twin', { mic2: 2 }], ['bx.dd3', { mix: 0.15, feedback: 0.2, dtime: 0.3 }], meter],
    desc: {
      rs: 'Squashed, bright Twin for sixteenth-note chicken scratch.',
      ls: 'Envelope filter quack into compression and a Twin.',
      rc: 'Compressor, auto-wah (off), dual-mic Twin and phaser (off).',
      lc: 'Compressor, wah, light Screamer push and a short delay for funky leads.',
    },
  }));
}

// ---------------------------------------------------------------- 25 Shoegaze
{
  const amp = (gain) => ['amp.ac30', { gain, treble: 0.5, bass: 0.5, presence: 0.45, master: 0.6 }];
  G.push(genre({
    id: 'shoegaze', name: 'Shoegaze', tags: ['shoegaze', 'ambient', 'experimental'], order: 25,
    rs: [['ehx.bigmuff', { level: 0.5, tone: 0.45, gain: 0.7 }], amp(0.4), ['cab.2x12blue'], ['ehx.holygrail', { mix: 0.45, gmode: 1 }]],
    ls: [['zvex.fuzzfactory', { 'f.level': 0.5, gate: 0.9, comp: 0.6, drive: 0.75, stab: 0.85 }], amp(0.4), ['cab.2x12blue'], ['tz.delay', { time: 0.55, feedback: 0.5, mix: 0.4, moddepth: 0.4 }], ['tz.shimmer', { decay: 0.8, mix: 0.45 }]],
    rc: [tuner(), ['ehx.bigmuff', { level: 0.5, tone: 0.45, gain: 0.7 }], ['tz.warble', {}], amp(0.4), ['cab.2x12blue', { mic2: 2 }], ['ehx.memorytoy', { mix: 0.4, feedback: 0.55, time: 0.5 }], ['eqd.afterneath', { decay: 0.7, mix: 0.5, size: 0.7 }], meter],
    lc: [tuner(), ['dt.whammy5', { model: 13 }, { bypass: true }], ['ehx.greenmuff', { level: 0.5, tone: 0.5, gain: 0.75 }], ['jhs.unicorn', { speed: 0.35, intensity: 0.5 }], amp(0.42), ['cab.2x12blue', { mic2: 2 }], ['tz.delay', { time: 0.6, feedback: 0.55, mix: 0.4, moddepth: 0.5 }], ['sy.bigsky', { machine: 6, decay: 0.8, mix: 0.45 }], meter],
    desc: {
      rs: 'A wall of fuzz washed in reverb. Strum and let the chords blur together.',
      ls: 'Gated, squealing fuzz into a long modulated delay and shimmer.',
      rc: 'Muff, tape warble, a chimey AC, wobbly echo and a huge reverb.',
      lc: 'Whammy (off) for glides, Green Muff, Uni-Vibe-style wobble, long delay and a huge Big Sky.',
    },
  }));
}

// ---------------------------------------------------------------- 26 Stoner / Doom
{
  const amp = (gain) => ['orange.amp-thunderverb', { 'a.gain': gain, 'a.master': 0.55, 'a.treble': 0.5, 'a.mid': 0.6, 'a.bass': 0.65, 'r.mix': 0, 'a.channel': 1 }];
  const cab = ['cab.4x12orange', {}];
  G.push(genre({
    id: 'stoner-doom', name: 'Stoner Doom', tags: ['stoner', 'doom', 'metal', 'drop-tuning'], order: 26,
    rs: [['ehx.bigmuff', { level: 0.55, tone: 0.4, gain: 0.8 }], ['amp.orange', { gain: 0.55, bass: 0.65, mid: 0.6, treble: 0.5, master: 0.55 }], cab],
    ls: [['eqd.hoof', { gain: 0.7, shift: 0.55, tone: 0.5, level: 0.55 }], amp(0.55), cab, ['tz.delay', { time: 0.45, feedback: 0.3, mix: 0.18 }]],
    rc: [tuner(), ['dt.drop', { dsel: 1 }], ['ehx.greenmuff', { level: 0.55, tone: 0.4, gain: 0.8 }], amp(0.6), ['cab.4x12orange', { mic2: 2 }], ['tz.reverb', { decay: 0.4, mix: 0.12 }], meter],
    lc: [tuner(), ['dt.drop', { dsel: 1 }], ['eqd.hoof', { gain: 0.75, shift: 0.6, tone: 0.55, level: 0.55 }], ['dn.gcb95', { pos: 0.45 }], amp(0.6), ['cab.4x12orange', { mic2: 2 }], ['tz.delay', { time: 0.5, feedback: 0.35, mix: 0.2 }], ['tz.reverb', { decay: 0.5, mix: 0.15 }], meter],
    desc: {
      rs: 'A Muff into a cranked Orange. Slow, heavy, fuzzy riffs.',
      ls: 'Hoof fuzz into a Thunderverb with a dark echo.',
      rc: 'Pitch-drop a whole step, Green Muff, Thunderverb, two mics and a little room.',
      lc: 'Pitch-drop, Hoof fuzz, parked wah, Thunderverb, echo and room.',
    },
  }));
}

// ---------------------------------------------------------------- 27 Djent
{
  const amp = (gain) => ['peavey.amp-6505plus', { gain, bass: 0.45, mid: 0.55, treble: 0.6, master: 0.5, depth: 0.4, presence: 0.55, channel: 1 }];
  const cab = ['cab.4x12v30', {}];
  G.push(genre({
    id: 'djent', name: 'Djent', tags: ['djent', 'metal', 'high-gain', 'drop-tuning'], order: 27,
    rs: [['tz.gate', { threshold: 0.45, attack: 0.1, decay: 0.2 }], ['ib.ts9', { gain: 0, tone: 0.6, level: 0.75 }], amp(0.55), cab],
    ls: [['ib.ts9', { gain: 0.1, tone: 0.6, level: 0.75 }], amp(0.55), cab, ['tz.delay', { time: 0.4, feedback: 0.3, mix: 0.18 }], ['tz.reverb', { decay: 0.45, mix: 0.15 }]],
    rc: [tuner(), ['tz.gate', { threshold: 0.5, attack: 0.05, decay: 0.15 }], ['mx.m102', { level: 0.6, sustain: 0.25 }], ['ib.ts9', { gain: 0, tone: 0.65, level: 0.78 }], amp(0.6), ['cab.4x12v30', { mic2: 2 }], ['tz.peq', {}], meter],
    lc: [tuner(), ['ib.ts9', { gain: 0.1, tone: 0.6, level: 0.75 }], amp(0.6), ['cab.4x12v30', { mic2: 2 }], ['tz.harmony', {}, { bypass: true }], ['sy.timeline', { 'd.time': 0.45, 'd.feedback': 0.3, 'd.mix': 0.2 }], ['sy.bigsky', { decay: 0.55, mix: 0.2 }], meter],
    desc: {
      rs: 'A tightly gated 5150 boosted by a Tube Screamer. Palm mutes that go "djent".',
      ls: 'Boosted 5150 with a clean delay and room for melodic leads.',
      rc: 'Hard gate, a little compression, boost, 5150, a cab with two mics and EQ.',
      lc: 'Boosted 5150, harmonizer (off), stereo delay and reverb.',
    },
  }));
}

// ---------------------------------------------------------------- 28 Surf
{
  const amp = (gain) => ['fender.amp-superreverb', { 'a.gain': gain, 'a.treble': 0.65, 'a.mid': 0.5, 'a.bass': 0.45, 'r.mix': 0.45, 't.rate': 0.5, 't.depth': 0, 'a.bright': 1 }];
  const cab = ['fender.cab-super4x10', {}];
  G.push(genre({
    id: 'surf', name: 'Surf', tags: ['surf', 'clean'], order: 28,
    rs: [amp(0.35), cab, ['tz.spring', { mix: 0.45, decay: 0.6, tone: 0.6 }]],
    ls: [amp(0.4), cab, ['tz.reelecho', {}], ['tz.spring', { mix: 0.5, decay: 0.65, tone: 0.6 }]],
    rc: [tuner(), ['tz.boost', { gain: 0.2 }], amp(0.35), ['fender.cab-super4x10', { mic2: 2 }], ['tz.trem', { rate: 0.55, depth: 0.5 }, { bypass: true }], ['jhs.springtank', {}], meter],
    lc: [tuner(), ['tz.trebleboost', {}], amp(0.4), ['fender.cab-super4x10', { mic2: 2 }], ['bx.re2', {}], ['jhs.springtank', {}], meter],
    desc: {
      rs: 'A Super Reverb with the springs dripping wet, for reverb-soaked rhythm.',
      ls: 'Tape echo and deep spring for staccato picked melodies.',
      rc: 'Clean boost, Super Reverb, tremolo (off) and a spring tank.',
      lc: 'Treble booster, Super Reverb, Space Echo and spring tank.',
    },
  }));
}

// ---------------------------------------------------------------- 29 Indie
{
  const amp = (gain) => ['vox.amp-ac15', { 'a.gain': gain, 'a.treble': 0.55, 'a.bass': 0.5, 'r.mix': 0.15, 't.rate': 0.5, 't.depth': 0, 'a.presence': 0.5, 'a.master': 0.6 }];
  const cab = ['vox.cab-ac15', {}];
  G.push(genre({
    id: 'indie', name: 'Indie', tags: ['indie', 'alt-rock', 'crunch'], order: 29,
    rs: [amp(0.45), cab, ['tz.reverb', { decay: 0.35, mix: 0.15 }]],
    ls: [['eqd.plumes', {}], amp(0.45), cab, ['bx.dd3', { mix: 0.2, feedback: 0.3, dtime: 0.45 }], ['tz.reverb', { decay: 0.35, mix: 0.15 }]],
    rc: [tuner(), ['bx.cs3', { level: 0.55, sustain: 0.35 }], ['eqd.westwood', {}, { bypass: true }], amp(0.45), ['vox.cab-ac15', { mic2: 2 }], ['ehx.nanoclone', {}, { bypass: true }], ['ehx.holygrail', { mix: 0.25, gmode: 0 }], meter],
    lc: [tuner(), ['eqd.plumes', {}], ['mx.m133', { gain: 0.3 }, { bypass: true }], amp(0.48), ['vox.cab-ac15', { mic2: 2 }], ['ehx.memorytoy', { mix: 0.3, feedback: 0.4, time: 0.45 }], ['ehx.holygrail', { mix: 0.25, gmode: 1 }], meter],
    desc: {
      rs: 'Jangly AC15 on the edge of breakup with a small room.',
      ls: 'Plumes overdrive into an AC15, digital delay and room.',
      rc: 'Compressor, Westwood drive (off), AC15, chorus (off) and Holy Grail.',
      lc: 'Plumes, Micro Amp boost (off), AC15, Memory Toy echo and Holy Grail hall.',
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
  tags: ['worship', 'contemporary-worship', 'gospel', 'rhythm', 'lead', 'ambient'],
  desc: 'Four full rigs on one selector: A gospel clean, B modern ambient, C overdrive, D heavy. Each has its own drives, amp and cab, and they share the delays and reverbs at the end. Switch rigs with the selector\'s footswitches, or use MULTI mode to play several at once.',
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
  tags: ['classic-metal', 'metal', 'rhythm', 'lead'],
  desc: 'Inspired by Randy Rhoads in the early 80s: a Distortion+ and a 10-band EQ (mid boost) into a hot modded JCM800 and G12-65 speakers. Turn on the chorus and echo for the solo, and the wah for fills.',
  chain: [tuner(), ['dn.gcb95', { pos: 0.55 }, { bypass: true }], ['mx.m104', { level: 0.75, gain: 0.3 }], ['mx.m108', { level: 0.55, gain: 0.55, b0: 0.38, b1: 0.45, b2: 0.55, b3: 0.62, b4: 0.6, b5: 0.55, b6: 0.5, b7: 0.48, b8: 0.45, b9: 0.4 }], ['amp.jcm800', { gain: 0.78, master: 0.5, presence: 0.6, bass: 0.5, mid: 0.7, treble: 0.6 }], ['celestion.cab-g12-65', { mic1: 0, mic2: 2 }], ['mx.m134', { rate: 0.3, depth: 0.3, feedback: 0.1, tone: 0.5 }, { bypass: true }], ['mx.m169', { feedback: 0.25, mix: 0.22, time: 0.4, mod: 0.2 }, { bypass: true }], ['tz.reverb', { decay: 0.35, mix: 0.12, mode: 0 }], meter],
});

// "For The Love Of God"-style lead (Steve Vai) for an Ibanez with active pickups
SPECIAL.push({
  file: 's03-love-of-god', name: 'For The Love Of God (Ibanez)', order: 12,
  tags: ['lead', 'rock', 'instrumental', 'ibanez'],
  desc: 'Inspired by Steve Vai\'s singing lead tone: Bad Horsie-style wah, light compressor, a Tube Screamer as a clean boost into a Bogner-style red channel, an EQ with more mids, wide stereo delay and a big hall. Made for an Ibanez with hot or active pickups, so the input gain stays low and notes bloom instead of fizzing.',
  chain: [tuner(), ['mo.badhorsie', { 'w.pos': 0.5, 'w.range': 0.5, 'w.level': 0.55 }], ['kly.compplus', { sustain: 0.3, level: 0.55, blend: 0.4, tone: 0.5 }], ['ib.ts9', { gain: 0.08, tone: 0.55, level: 0.72 }], ['bogner.amp-ecstasy', { gain: 0.62, master: 0.55, treble: 0.52, mid: 0.65, bass: 0.45, presence: 0.5, channel: 2 }], ['cab.4x12uber', { mic1: 0, mic2: 2 }], ['tz.paraeq', { b3on: 1 }], ['tz.harmony', { level1: 0.12, semis1: 0.5, dry: 1 }, { bypass: true }], ['tz.lumen', { time: 0.42, feedback: 0.38, mix: 0.25, spread: 0.7 }], ['sy.bigsky', { decay: 0.75, mix: 0.3 }], meter],
});


// ---------------------------------------------------------------- synth presets
const SYN = (file, name, tags, desc, chain, order) => ({ file, name, tags: ['synth', ...tags], desc, chain, order });
SPECIAL.push(
  SYN('x01-synth-meow-lead', 'Synth · Meow Lead', ['lead', 'experimental'], 'The Meowsynth singing your lead lines as a cat, through a clean amp, tempo delay and a big room. Play single notes; slide for meows.',
    [tuner(), ['tz.meowsynth', { shift: 0.55, octave: 0.5, glide: 0.35, vibrato: 0.4, blend: 0.85, '=level': 10 }], ['amp.jc120', { gain: 0.3, treble: 0.5 }], ['cab.2x12jc'], ['tz.delay', { time: 0.4, feedback: 0.3, mix: 0.22 }], ['tz.reverb', { decay: 0.5, mix: 0.25 }], meter], 30),
  SYN('x02-synth-arcade', 'Synth · Arcade Lead', ['lead', 'edm'], 'Square-wave arcade synth with stacked fifth and octave, stepped gate and bit crush, into a clean amp, stereo delay and shimmer.',
    [tuner(), ['tz.insertcoin', { 's.filter': 0.6, chord: 0.5, blend: 0.85, 'sl.time': 0.4, 'cr.bits': 0.6, '=s.level': 6 }], ['amp.jc120', { gain: 0.3 }], ['cab.2x12jc'], ['tz.delay', { time: 0.38, feedback: 0.35, mix: 0.25 }], ['tz.shimmer', { decay: 0.6, mix: 0.25 }], meter], 31),
  SYN('x03-synth-string-pad', 'Synth · String Machine Pad', ['ambient', 'rhythm'], 'A swelling 70s string machine with ensemble chorus into a huge hall. Hold chords and let them bloom.',
    [tuner(), ['tz.tidalswell', { sens: 0.5, attack: 0.55, level: 0.6 }], ['tz.polyester', { 's.attack': 0.5, ens: 0.6, 'rv.mix': 0.25, 's.wet': 0.8, 's.dry': 0.1, '=s.level': 4 }], ['amp.jc120', { gain: 0.3 }], ['cab.2x12jc'], ['sy.bigsky', { decay: 0.75, mix: 0.35 }], meter], 32),
  SYN('x04-synth-wobble-bass', 'Synth · Wobble Bass', ['bass', 'edm'], 'A sub or saw bass synth with a wobble, into a bass amp and an 8x10 cab. Works on bass or the low strings of a guitar.',
    [tuner(), ['tz.wobbler', { 's.octave': 0.5, 'wb.rate': 0.45, 'wb.range': 0.6, 'wb.q': 0.5, 's.wet': 0.85, 's.dry': 0.2 }], ['amp.svt', { gain: 0.35 }], ['cab.8x10svt'], meter], 33),
  SYN('x05-synth-vespers', 'Synth · Cathedral Choir', ['ambient', 'worship'], 'A choir that sings every note you play, a new vowel each time, into shimmer and a cathedral reverb.',
    [tuner(), ['tz.vespers', { 'v.attack': 0.4, 'v.vibrato': 0.3, 'rv.mix': 0.3, blend: 0.85, '=v.level': 9 }], ['amp.jc120', { gain: 0.3 }], ['cab.2x12jc'], ['mrs.mercury7', { decay: 0.8, mix: 0.35, shimmer: 0.2 }], meter], 34),
  SYN('x06-synth-mothership', 'Synth · Mothership', ['experimental', 'lead'], 'Robot voice with ring mod and echo, then a sci-fi delay and reverb. We come in peace.',
    [tuner(), ['tz.mothership', { 'v.shift': 0.5, blend: 0.8, 'rm.mix': 0.4, 'dl.mix': 0.3, '=v.level': 9 }], ['amp.jc120', { gain: 0.3 }], ['cab.2x12jc'], ['tz.lumen', { time: 0.45, feedback: 0.4, mix: 0.25 }], ['tz.reverb', { decay: 0.6, mix: 0.3 }], meter], 35),
  SYN('x07-synth-organ-pad', 'Synth · Gospel Organ', ['rhythm', 'worship', 'gospel'], 'Gospel organ voice from your guitar with its rotary speaker spinning, a clean boost into a Twin and a warm room.',
    [tuner(), ['ehx.b9', { 's.dry': 0.1, 's.wet': 1, omod: 0.6, voice: 2 }], ['tz.boost', { gain: 0.25 }], ['amp.twin', { gain: 0.3 }], ['cab.2x12twin'], ['tz.reverb', { decay: 0.45, mix: 0.25 }], meter], 36),
);

// ---------------------------------------------------------------- meme presets
const MEME = (file, name, tags, desc, chain, order) => ({ file, name, tags: ['meme', ...tags], desc, chain, order });
SPECIAL.push(
  MEME('m01-meme-lofi-study', 'Meme · Lo-Fi Beats to Study To', ['ambient', 'experimental'], 'Slowed + reverb, a worn cassette ghost and a dusty radio. Jazz chords recommended, rain sounds optional.',
    [['tz.slowedreverb', { 'p.semis1': 0.45, 'rv.mix': 0.3, 'lf.mix': 0.5 }], ['tz.cassetteghost', { 'lf.wow': 0.4, 'lf.flutter': 0.3, 'lf.age': 0.5, 'lf.noise': 0.25 }], ['amp.deluxe', { gain: 0.3 }], ['cab.1x12us']], 40),
  MEME('m02-meme-bad-connection', 'Meme · Bad Connection', ['experimental'], '"Can you hear me now?" Streaming damage, lag spikes and a 56k modem screech on an otherwise lovely clean tone.',
    [['tz.dialup', { 'cr.bits': 0.7, 'cr.mix': 0.4, 'rm.mix': 0.15 }], ['tz.lagspike', { 'net.loss': 0.4, 'net.packets': 0.3, 'net.mix': 0.8 }], ['amp.ac30', { gain: 0.35 }], ['cab.2x12blue'], ['tz.badwifi', { loss: 0.5, packets: 0.3, mix: 0.8 }]], 41),
  MEME('m03-meme-microwave', 'Meme · Microwave Fuzz', ['rock', 'high-gain'], 'Reheated leftovers on HIGH: the microwave fuzz into a cranked British head. Ding!',
    [['tz.reheat', { 'fz.mode': 2, 'fz.gain': 0.7, 'fz.tone': 0.5, 'fz.level': 0.55 }], ['amp.orange', { gain: 0.5 }], ['cab.4x12orange']], 42),
  MEME('m04-meme-npc-dialogue', 'Meme · NPC Dialogue', ['experimental', 'lead'], 'Your guitar babbles like an RPG villager. Every note is a new line of dialogue.',
    [['tz.npc', { blend: 0.85, chatter: 0.6, lyric: 0, '=level': 4 }], ['amp.deluxe', { gain: 0.3 }], ['cab.1x12us'], ['tz.delay', { time: 0.3, feedback: 0.2, mix: 0.15 }], ['tz.reverb', { decay: 0.35, mix: 0.2 }]], 43),
  MEME('m05-meme-rubber-duck', 'Meme · Rubber Duck Debugging', ['clean', 'pop'], 'Explain your problem to the duck: a quacky chorus on a sparkly blackface clean.',
    [['tz.rubberduck', { rate: 0.4, depth: 0.5, mix: 0.5 }], ['amp.deluxe', { gain: 0.3, bright: 1 }], ['cab.1x12us'], ['tz.spring', { mix: 0.18 }]], 44),
  MEME('m06-meme-haunted-house', 'Meme · Haunted House', ['experimental', 'metal'], 'Goblin octave fuzz into a reversed, haunted reverb. Best played at 3 a.m.',
    [['tz.goblin', { 'p.level1': 0.6, 'fz.gain': 0.65, 'p.level2': 0.2, 'fz.level': 0.5 }], ['amp.recto', { gain: 0.45 }], ['cab.4x12v30'], ['tz.haunted', { 'rd.mix': 0.35, 'rv.mix': 0.35 }]], 45),
  MEME('m07-meme-speedrun', 'Meme · Speedrun Any%', ['edm', 'lead'], 'Arcade synth into a delay whose repeats keep climbing octaves. Frame-perfect.',
    [['tz.insertcoin', { blend: 0.7, '=s.level': 5 }], ['amp.jc120', { gain: 0.3 }], ['cab.2x12jc'], ['tz.speedrun', { time: 0.35, feedback: 0.45, mix: 0.35 }], ['tz.reverb', { decay: 0.4, mix: 0.2 }]], 46),
  MEME('m08-meme-whoopee', 'Meme · Whoopee Cushion', ['experimental'], 'Exactly what it sounds like. Low notes are funnier.',
    [['tz.whoopee', { blend: 0.85, '=level': 9 }], ['amp.svt', { gain: 0.3 }], ['cab.1x15bass'], ['tz.reverb', { decay: 0.4, mix: 0.18 }]], 47),
  MEME('m09-meme-deja-vu', 'Meme · Déjà Vu', ['experimental', 'ambient'], 'Press REMEMBER and your last phrase comes back, slower and stretched. Haven\'t we been here before?',
    [['tz.dejavu', { length: 0.4, speed: 0.4, stretch: 0.3, mix: 0.6, mode: 0 }], ['amp.twin', { gain: 0.3 }], ['cab.2x12twin'], ['tz.shimmer', { decay: 0.6, mix: 0.25 }]], 48),
);

// ---------------------------------------------------------------- grunge signature rigs
const GR = (file, name, tags, desc, chain, order) => ({ file, name, tags: ['grunge', ...tags], desc, chain, order });
SPECIAL.push(
  GR('r01-grunge-nevermind', 'Grunge · Nevermind Era', ['rock', 'rhythm'], 'An orange-box distortion into a scooped solid-state style head and a 4x12, with a chorus for the clean verses (off). Seattle, 1991.',
    [tuner(), ['bx.ds2', { level: 0.6, tone: 0.45, gain: 0.7 }], ['ehx.smallstone', { rate: 0.3 }, { bypass: true }], ['ehx.nanoclone', {}, { bypass: true }], ['mesa.amp-markv', { gain: 0.4, master: 0.5, treble: 0.55, mid: 0.35, bass: 0.6, presence: 0.5, channel: 2 }], ['cab.4x12v30', { mic2: 2 }], meter], 60),
  GR('r02-grunge-badmotor', 'Grunge · Badmotorfinger Drop D', ['metal', 'drop-tuning', 'rhythm'], 'Drop-D sludge: pitch drop, a Big Muff into a Rectifier, plus a parked wah you can kick on for the psychedelic bits.',
    [tuner(), ['dt.drop', { dsel: 0 }], ['ehx.bigmuff', { level: 0.55, tone: 0.45, gain: 0.7 }], ['dn.gcb95', { pos: 0.55 }, { bypass: true }], ['amp.recto', { gain: 0.5, treble: 0.5, mid: 0.45, bass: 0.6, presence: 0.5, master: 0.5, channel: 1 }], ['cab.4x12v30', { mic2: 2 }], ['tz.spring', { mix: 0.08 }], meter], 61),
  GR('r03-grunge-dirt', 'Grunge · Dirt Wah Lead', ['metal', 'lead'], 'A dark, heavy Bogner-style lead with a wah, a slow flanger (off) and a mostly dry slap echo. For sludgy minor-key solos.',
    [tuner(), ['dn.cbm95', { pos: 0.6 }], ['ib.ts9', { gain: 0.25, tone: 0.5, level: 0.65 }], ['evh.flanger117', { speed: 0.2, width: 0.5, regen: 0.4 }, { bypass: true }], ['bogner.amp-shiva', {}], ['cab.4x12v30', { mic2: 2 }], ['mx.m169', { time: 0.3, feedback: 0.2, mix: 0.15 }], meter], 62),
  GR('r04-grunge-ten', 'Grunge · Ten Lead', ['rock', 'lead'], 'Grunge lead with classic rock roots: a Tube Screamer into a cranked Marshall, wah and a Uni-Vibe-style wobble (off), and analog delay.',
    [tuner(), ['dn.gcb95', { pos: 0.55 }, { bypass: true }], ['ib.ts808', { gain: 0.4, tone: 0.55, level: 0.62 }], ['jhs.unicorn', { speed: 0.35, intensity: 0.5 }, { bypass: true }], ['amp.jcm800', { gain: 0.6, presence: 0.55, bass: 0.5, mid: 0.6, treble: 0.6, master: 0.5 }], ['cab.4x12gb', { mic2: 2 }], ['mx.m169', { time: 0.4, feedback: 0.3, mix: 0.2 }], ['tz.reverb', { decay: 0.4, mix: 0.12 }], meter], 63),
);

// ---------------------------------------------------------------- song and artist rigs
// graph helpers: ser('a', 'b', 'c') chains keys in order, lr(a, b, to) sends a to the left and b to the right input
const ser = (...k) => k.slice(1).map((b, i) => [k[i], b]);
const lr = (a, b, to) => [[a, to, 0, 0], [b, to, 0, 1]];
const tail = (...k) => [...ser(...k), [k[k.length - 1], 'out']];
const sel = (n) => [n === 4 ? 'tz.select4' : 'tz.select2', { fade: 0.2 }, { raw: { sel: 0, mode: 0 } }];
const SONGS = [];
const ARTISTS = [];
const song = (n, file, name, tags, desc, rig) => SONGS.push({ file: `t${String(n).padStart(2, '0')}-${file}`, name: `Song · ${name}`, tags: ['song', ...tags], desc, order: 200 + n, ...rig });
const artist = (n, file, name, tags, desc, rig) => ARTISTS.push({ file: `a${String(n).padStart(2, '0')}-${file}`, name: `Artist · ${name}`, tags: ['artist', ...tags], desc, order: 300 + n, ...rig });

song(1, 'sweet-child-o-mine', "Sweet Child O' Mine", ['rock', 'hard-rock', 'lead', 'rhythm'],
  "Slash's Appetite tone: a hot modded Plexi and an 800 on two sides like a double-tracked part. Tune down a half step and use the neck pickup for the intro; turn on the wah and delay for the outro solo.",
  {
    nodes: {
      tun: tuner(),
      wah: ['dn.sw95', { 'w.pos': 0.55 }, { bypass: true }],
      split: ['box.split2'],
      a1: ['amp.plexi', { gain: 0.85, master: 0.6, presence: 0.55, bass: 0.5, mid: 0.7, treble: 0.6, bright: 0 }],
      a2: ['cab.4x12gb', { mic1: 0, mic2: 2 }],
      b1: ['amp.jcm800', { gain: 0.68, master: 0.5, presence: 0.5, bass: 0.5, mid: 0.65, treble: 0.55 }],
      b2: ['cab.4x12t75', { mic1: 0, mic2: 3 }],
      dly: ['tz.delay', { '=time': 420, feedback: 0.25, mix: 0.16, mode: 1, tone: 0.45 }, { bypass: true }],
      rev: ['tz.reverb', { mode: 2, decay: 0.3, mix: 0.12 }],
      met: meter,
    },
    edges: [...ser('in', 'tun', 'wah', 'split'), ['split', 'a1', 0, 0], ['a1', 'a2'], ['split', 'b1', 1, 0], ['b1', 'b2'], ...lr('a2', 'b2', 'dly'), ...tail('dly', 'rev', 'met')],
    rows: [['tun', 'wah', 'split'], ['@split', 'a1', 'a2'], ['@split', 'b1', 'b2'], ['@a2', 'dly', 'rev', 'met']],
  });

song(2, 'smells-like-teen-spirit', 'Smells Like Teen Spirit', ['grunge', 'rock', 'rhythm'],
  'Nevermind style: a Small Clone chorus clean for the verses (A) and a DS-1 into a Mesa and a Bassman for the loud parts (B). Standard tuning; switch the selector for each verse and chorus.',
  {
    nodes: {
      tun: tuner(),
      sel: ['tz.select2', { fade: 0.15 }, { raw: { sel: 1, mode: 0 } }],
      a1: ['ehx.smallclone', { rate: 0.35, deep: 0 }],
      a2: ['amp.twin', { gain: 0.3, treble: 0.55, mid: 0.5, bass: 0.5, master: 0.6, bright: 0 }],
      a3: ['cab.2x12twin', { mic2: 2 }],
      b1: ['bx.ds1', { level: 0.4, tone: 0.45, gain: 0.75 }],
      b2: ['box.split2'],
      b3: ['mesa.amp-markv', { gain: 0.45, master: 0.38, treble: 0.55, mid: 0.4, bass: 0.6, presence: 0.5, channel: 1 }],
      b4: ['cab.4x12v30', { mic2: 2 }],
      b5: ['amp.bassman', { gain: 0.6, presence: 0.5, mid: 0.55, bass: 0.5, treble: 0.55, master: 0.42 }],
      b6: ['cab.4x10tweed'],
      mix: ['box.merge4'],
      rev: ['tz.reverb', { mode: 0, decay: 0.25, mix: 0.1 }],
      met: meter,
    },
    edges: [...ser('in', 'tun'), ['tun', 'sel', 0, 0], ['sel', 'a1', 0, 0], ...ser('a1', 'a2', 'a3'), ['a3', 'mix', 0, 0],
      ['sel', 'b1', 2, 0], ['b1', 'b2'], ['b2', 'b3', 0, 0], ['b3', 'b4'], ['b4', 'mix', 0, 1], ['b2', 'b5', 1, 0], ['b5', 'b6'], ['b6', 'mix', 0, 2], ...tail('mix', 'rev', 'met')],
    rows: [['tun', 'sel'], ['@sel', 'a1', 'a2', 'a3'], ['@sel', 'b1', 'b2', 'b3', 'b4'], ['@b2', 'b5', 'b6'], ['@a3', 'mix', 'rev', 'met']],
  });

song(3, 'enter-sandman', 'Enter Sandman', ['metal', 'rhythm', 'lead'],
  'Black Album style: a scooped Mark IIC+ and a Rectifier side by side, with a gate for the tight stops. Standard tuning; turn on the wah and delay for the solo.',
  {
    nodes: {
      tun: tuner(),
      wah: ['dn.kh95', { pos: 0.55 }, { bypass: true }],
      gate: ['tz.hush', { threshold: 0.3, decay: 0.35 }],
      split: ['box.split2'],
      a1: ['amp.markiic', { gain: 0.7, treble: 0.6, bass: 0.35, mid: 0.3, master: 0.5, presence: 0.6 }],
      a2: ['bx.ge7', { b0: 0.56, b1: 0.52, b2: 0.4, b3: 0.36, b4: 0.45, b5: 0.56, b6: 0.5, level: 0.5 }],
      a3: ['cab.4x12v30', { mic1: 0, mic2: 3 }],
      b1: ['amp.recto', { gain: 0.58, treble: 0.55, mid: 0.4, bass: 0.6, presence: 0.5, master: 0.45, channel: 1 }],
      b2: ['cab.4x12t75', { mic2: 2 }],
      dly: ['tz.delay', { '=time': 450, feedback: 0.3, mix: 0.18, mode: 0 }, { bypass: true }],
      rev: ['tz.reverb', { mode: 0, decay: 0.25, mix: 0.1 }],
      met: meter,
    },
    edges: [...ser('in', 'tun', 'wah', 'gate', 'split'), ['split', 'a1', 0, 0], ...ser('a1', 'a2', 'a3'), ['split', 'b1', 1, 0], ['b1', 'b2'], ...lr('a3', 'b2', 'dly'), ...tail('dly', 'rev', 'met')],
    rows: [['tun', 'wah', 'gate', 'split'], ['@split', 'a1', 'a2', 'a3'], ['@split', 'b1', 'b2'], ['@a3', 'dly', 'rev', 'met']],
  });

song(4, 'master-of-puppets', 'Master Of Puppets', ['metal', 'thrash', 'rhythm', 'lead'],
  'Hetfield in 1986: a Tube Screamer-boosted Mark IIC+ with a V-shaped graphic EQ (A) and a JC-120 clean for the middle section (B). Standard tuning; wah and delay are for the solos.',
  {
    nodes: {
      tun: tuner(),
      wah: ['dn.gcb95', { pos: 0.55 }, { bypass: true }],
      sel: sel(2),
      a1: ['ib.ts808', { gain: 0.05, tone: 0.55, level: 0.8 }],
      a2: ['tz.hush', { threshold: 0.32, decay: 0.3 }],
      a3: ['amp.markiic', { gain: 0.78, treble: 0.62, bass: 0.32, mid: 0.28, master: 0.5, presence: 0.6 }],
      a4: ['bx.ge7', { b0: 0.58, b1: 0.53, b2: 0.38, b3: 0.33, b4: 0.44, b5: 0.57, b6: 0.52, level: 0.5 }],
      a5: ['cab.4x12v30', { mic1: 0, mic2: 3 }],
      b1: ['mx.m134', { rate: 0.25, depth: 0.3, feedback: 0.1, tone: 0.5 }],
      b2: ['amp.jc120', { gain: 0.32, treble: 0.5, mid: 0.5, bass: 0.5, bright: 0 }],
      b3: ['cab.2x12jc'],
      mix: ['box.merge2'],
      dly: ['tz.delay', { '=time': 400, feedback: 0.3, mix: 0.18, mode: 0 }, { bypass: true }],
      rev: ['tz.reverb', { mode: 0, decay: 0.3, mix: 0.12 }],
      met: meter,
    },
    edges: [...ser('in', 'tun', 'wah'), ['wah', 'sel', 0, 0], ['sel', 'a1', 0, 0], ...ser('a1', 'a2', 'a3', 'a4', 'a5'), ['a5', 'mix', 0, 0], ['sel', 'b1', 2, 0], ...ser('b1', 'b2', 'b3'), ['b3', 'mix', 0, 1], ...tail('mix', 'dly', 'rev', 'met')],
    rows: [['tun', 'wah', 'sel'], ['@sel', 'a1', 'a2', 'a3', 'a4', 'a5'], ['@sel', 'b1', 'b2', 'b3'], ['@a3', 'mix', 'dly', 'rev', 'met']],
  });

song(5, 'hysteria', 'Hysteria (Muse)', ['rock', 'alt-rock', 'rhythm', 'lead'],
  'Absolution-era Bellamy: a Fuzz Factory into a Diezel VH4, with a Matchless-style amp alongside for bite. Standard tuning; turn on the Whammy (octave up) for the solo and the delay for the high lines.',
  {
    nodes: {
      tun: tuner(),
      wh: ['dt.whammy5', { expr: 1, model: 1 }, { bypass: true }],
      ff: ['zvex.fuzzfactory', { 'f.level': 0.5, gate: 0.75, comp: 0.6, drive: 0.75, stab: 0.85 }],
      split: ['box.split2'],
      a1: ['amp.vh4', { gain: 0.6, bass: 0.55, mid: 0.55, treble: 0.55, master: 0.5, depth: 0.5, presence: 0.5 }],
      a2: ['cab.4x12v30', { mic2: 2 }],
      b1: ['amp.dc30', { gain: 0.55, bass: 0.45, treble: 0.6, presence: 0.5, master: 0.55 }],
      b2: ['cab.2x12blue'],
      dly: ['tz.delay', { '=time': 360, feedback: 0.3, mix: 0.2, mode: 0 }, { bypass: true }],
      rev: ['tz.reverb', { mode: 1, decay: 0.35, mix: 0.12 }],
      met: meter,
    },
    edges: [...ser('in', 'tun', 'wh', 'ff', 'split'), ['split', 'a1', 0, 0], ['a1', 'a2'], ['split', 'b1', 1, 0], ['b1', 'b2'], ...lr('a2', 'b2', 'dly'), ...tail('dly', 'rev', 'met')],
    rows: [['tun', 'wh', 'ff', 'split'], ['@split', 'a1', 'a2'], ['@split', 'b1', 'b2'], ['@a2', 'dly', 'rev', 'met']],
  });

song(6, 'thunderstruck', 'Thunderstruck', ['rock', 'hard-rock', 'lead', 'rhythm'],
  "AC/DC: Angus on a cranked Plexi (left) and Malcolm on a JTM45-style amp (right), with a wireless-style boost and a little squash for the hammer-on intro. Standard tuning; roll the guitar volume back for the build-up.",
  {
    nodes: {
      tun: tuner(),
      sv: ['tz.boost', { gain: 0.4, bass: 0.45, treble: 0.6 }],
      comp: ['tz.comp', { sustain: 0.35, ratio: 0.4, attack: 0.5, level: 0.5, blend: 0.7 }],
      split: ['box.split2'],
      a1: ['amp.plexi', { gain: 0.7, master: 0.6, presence: 0.55, bass: 0.45, mid: 0.65, treble: 0.6, bright: 0 }],
      a2: ['cab.4x12gb', { mic1: 0, mic2: 2 }],
      b1: ['marshall.amp-bluesbreaker', { 'a.gain': 0.55, 'a.master': 0.6, 'a.presence': 0.5, 'a.bass': 0.5, 'a.mid': 0.6, 'a.treble': 0.55, 't.depth': 0 }],
      b2: ['celestion.cab-g12h4x12', { mic2: 2 }],
      rev: ['tz.reverb', { mode: 0, decay: 0.25, mix: 0.1 }],
      met: meter,
    },
    edges: [...ser('in', 'tun', 'sv', 'comp', 'split'), ['split', 'a1', 0, 0], ['a1', 'a2'], ['split', 'b1', 1, 0], ['b1', 'b2'], ...lr('a2', 'b2', 'rev'), ...tail('rev', 'met')],
    rows: [['tun', 'sv', 'comp', 'split'], ['@split', 'a1', 'a2'], ['@split', 'b1', 'b2'], ['@a2', 'rev', 'met']],
  });

song(7, 'beat-it', 'Beat It', ['rock', 'pop', 'rhythm', 'lead'],
  "Two rigs: A is the tight Marshall rhythm, B is Eddie's solo sound (Echoplex preamp, Phase 90, a hot Plexi and Echoplex echo). Tune down a half step; switch to B for the solo.",
  {
    nodes: {
      tun: tuner(),
      sel: sel(2),
      a1: ['tz.comp', { sustain: 0.3, ratio: 0.4, level: 0.5, blend: 0.6 }],
      a2: ['amp.jcm800', { gain: 0.55, master: 0.55, presence: 0.55, bass: 0.5, mid: 0.6, treble: 0.6 }],
      a3: ['cab.4x12t75', { mic2: 2 }],
      b1: ['dn.ep101', { gain: 0.5 }],
      b2: ['mx.m101', { rate: 0.25 }],
      b3: ['amp.plexi', { gain: 0.92, master: 0.6, presence: 0.6, bass: 0.45, mid: 0.6, treble: 0.65, bright: 1 }],
      b4: ['cab.4x12gb', { mic1: 0, mic2: 2 }],
      b5: ['dn.ep103', { '=time': 320, feedback: 0.2, mix: 0.22, age: 0.3 }],
      mix: ['box.merge2'],
      rev: ['tz.reverb', { mode: 2, decay: 0.35, mix: 0.12 }],
      met: meter,
    },
    edges: [...ser('in', 'tun'), ['tun', 'sel', 0, 0], ['sel', 'a1', 0, 0], ...ser('a1', 'a2', 'a3'), ['a3', 'mix', 0, 0], ['sel', 'b1', 2, 0], ...ser('b1', 'b2', 'b3', 'b4', 'b5'), ['b5', 'mix', 0, 1], ...tail('mix', 'rev', 'met')],
    rows: [['tun', 'sel'], ['@sel', 'a1', 'a2', 'a3'], ['@sel', 'b1', 'b2', 'b3', 'b4', 'b5'], ['@a3', 'mix', 'rev', 'met']],
  });

song(8, 'layla', 'Layla', ['rock', 'blues', 'classic-rock', 'lead'],
  "Derek and the Dominos style: two small cranked tweed amps, one for Clapton's Strat and one for Duane's slide, panned apart. Standard tuning; the compressor (off) helps slide notes sustain.",
  {
    nodes: {
      tun: tuner(),
      comp: ['mx.m102', { level: 0.55, sustain: 0.35 }, { bypass: true }],
      split: ['box.split2'],
      a1: ['fender.amp-tweeddeluxe', { gain: 0.72, treble: 0.62, mic: 0 }],
      a2: ['cab.1x12us', { mic2: 2 }],
      b0: ['tz.boost', { gain: 0.3, bass: 0.55, treble: 0.45 }],
      b1: ['fender.amp-tweeddeluxe', { gain: 0.82, treble: 0.5, mic: 0 }],
      b2: ['fender.cab-princeton'],
      rev: ['tz.reverb', { mode: 0, decay: 0.3, mix: 0.14 }],
      met: meter,
    },
    edges: [...ser('in', 'tun', 'comp', 'split'), ['split', 'a1', 0, 0], ['a1', 'a2'], ['split', 'b0', 1, 0], ...ser('b0', 'b1', 'b2'), ...lr('a2', 'b2', 'rev'), ...tail('rev', 'met')],
    rows: [['tun', 'comp', 'split'], ['@split', 'a1', 'a2'], ['@split', 'b0', 'b1', 'b2'], ['@a2', 'rev', 'met']],
  });

song(9, 'sunshine-of-your-love', 'Sunshine Of Your Love', ['rock', 'blues', 'classic-rock', 'rhythm', 'lead'],
  "Clapton's Cream 'woman tone': neck pickup with the tone rolled off (the EQ does that here) into two cranked Marshalls. Standard tuning; switch the EQ off for a brighter solo, the wah is there for fills.",
  {
    nodes: {
      tun: tuner(),
      wah: ['dn.gcb95', { pos: 0.5 }, { bypass: true }],
      eq: ['tz.contour', { '=highcut': 1700, '=lowcut': 70, '=mid1freq': 650, '=mid1gain': 3, '=mid1q': 0.8 }],
      split: ['box.split2'],
      a1: ['amp.plexi', { gain: 0.82, master: 0.65, presence: 0.6, bass: 0.5, mid: 0.65, treble: 0.7, bright: 1 }],
      a2: ['cab.4x12gb', { mic2: 2 }],
      b1: ['marshall.amp-bluesbreaker', { 'a.gain': 0.75, 'a.master': 0.6, 'a.presence': 0.55, 'a.bass': 0.5, 'a.mid': 0.6, 'a.treble': 0.65, 't.depth': 0 }],
      b2: ['celestion.cab-g12h4x12'],
      rev: ['tz.reverb', { mode: 0, decay: 0.35, mix: 0.14 }],
      met: meter,
    },
    edges: [...ser('in', 'tun', 'wah', 'eq', 'split'), ['split', 'a1', 0, 0], ['a1', 'a2'], ['split', 'b1', 1, 0], ['b1', 'b2'], ...lr('a2', 'b2', 'rev'), ...tail('rev', 'met')],
    rows: [['tun', 'wah', 'eq', 'split'], ['@split', 'a1', 'a2'], ['@split', 'b1', 'b2'], ['@a2', 'rev', 'met']],
  });

song(10, 'nightmare', 'Nightmare (Avenged Sevenfold)', ['metal', 'heavy-metal', 'rhythm', 'lead'],
  'Synyster and Zacky: an Überschall-style head and a Rectifier, boosted and gated. Tune to drop D; turn on the harmony (D minor, thirds) for the twin leads, and the wah and delay for the solo.',
  {
    nodes: {
      tun: tuner(),
      wah: ['dn.gcb95', { pos: 0.55 }, { bypass: true }],
      harm: ['tz.choirmaster', { '=key': 2, scale: 1, '=deg1': 2, level1: 0.6, dry: 1, level2: 0 }, { bypass: true }],
      ts: ['ib.ts9', { gain: 0.02, tone: 0.55, level: 0.8 }],
      gate: ['tz.hush', { threshold: 0.38, decay: 0.3 }],
      split: ['box.split2'],
      a1: ['amp.uber', { gain: 0.65, presence: 0.55, bass: 0.5, mid: 0.5, treble: 0.55, master: 0.5 }],
      a2: ['cab.4x12uber', { mic2: 2 }],
      b1: ['amp.recto', { gain: 0.6, treble: 0.55, mid: 0.42, bass: 0.6, presence: 0.55, master: 0.45, channel: 1 }],
      b2: ['cab.4x12v30', { mic1: 0, mic2: 3 }],
      dly: ['tz.delay', { '=time': 440, feedback: 0.3, mix: 0.2, mode: 7 }, { bypass: true }],
      rev: ['tz.reverb', { mode: 1, decay: 0.35, mix: 0.12 }],
      met: meter,
    },
    edges: [...ser('in', 'tun', 'wah', 'harm', 'ts', 'gate', 'split'), ['split', 'a1', 0, 0], ['a1', 'a2'], ['split', 'b1', 1, 0], ['b1', 'b2'], ...lr('a2', 'b2', 'dly'), ...tail('dly', 'rev', 'met')],
    rows: [['tun', 'wah', 'harm', 'ts', 'gate', 'split'], ['@split', 'a1', 'a2'], ['@split', 'b1', 'b2'], ['@a2', 'dly', 'rev', 'met']],
  });

song(11, 'holiday', 'Holiday (Green Day)', ['punk', 'pop-punk', 'rock', 'rhythm'],
  'American Idiot style: a boosted modded Plexi and a Rectifier panned apart, with a gate for the hard stops. Standard tuning; lots of downstrokes, and the delay (off) is for the short solo.',
  {
    nodes: {
      tun: tuner(),
      gate: ['tz.hush', { threshold: 0.3, decay: 0.3 }],
      split: ['box.split2'],
      a0: ['ib.ts808', { gain: 0.2, tone: 0.55, level: 0.72 }],
      a1: ['amp.plexi', { gain: 0.88, master: 0.6, presence: 0.55, bass: 0.55, mid: 0.6, treble: 0.6, bright: 0 }],
      a2: ['cab.4x12gb', { mic2: 2 }],
      b1: ['amp.recto', { gain: 0.48, treble: 0.55, mid: 0.5, bass: 0.55, presence: 0.5, master: 0.5, channel: 1 }],
      b2: ['mesa.cab-2x12recto', { mic2: 2 }],
      dly: ['tz.delay', { '=time': 360, feedback: 0.25, mix: 0.16, mode: 1 }, { bypass: true }],
      rev: ['tz.reverb', { mode: 0, decay: 0.22, mix: 0.08 }],
      met: meter,
    },
    edges: [...ser('in', 'tun', 'gate', 'split'), ['split', 'a0', 0, 0], ...ser('a0', 'a1', 'a2'), ['split', 'b1', 1, 0], ['b1', 'b2'], ...lr('a2', 'b2', 'dly'), ...tail('dly', 'rev', 'met')],
    rows: [['tun', 'gate', 'split'], ['@split', 'a0', 'a1', 'a2'], ['@split', 'b1', 'b2'], ['@a2', 'dly', 'rev', 'met']],
  });

song(12, 'no-more-tears', 'No More Tears', ['metal', 'heavy-metal', 'rhythm', 'lead'],
  "Zakk's No More Tears rig: an SD-1 into a CH-1 chorus whose two outputs feed two JCM800s with G12T-75s. Tune to drop C#; the wah and delay are off (he only added delay at the end of the solo).",
  {
    nodes: {
      tun: tuner(),
      wah: ['dn.gcb95', { pos: 0.55 }, { bypass: true }],
      sd1: ['bx.sd1', { level: 0.8, tone: 0.55, gain: 0.12 }],
      ch: ['bx.ch1', { mix: 0.45, tone: 0.5, rate: 0.25, depth: 0.4 }],
      a1: ['amp.jcm800', { gain: 0.75, master: 0.55, presence: 0.6, bass: 0.55, mid: 0.6, treble: 0.6 }],
      a2: ['cab.4x12t75', { mic1: 0, mic2: 2 }],
      b1: ['amp.jcm800', { gain: 0.72, master: 0.55, presence: 0.55, bass: 0.55, mid: 0.65, treble: 0.58 }],
      b2: ['cab.4x12t75', { mic1: 0, mic2: 3 }],
      dly: ['tz.delay', { '=time': 480, feedback: 0.35, mix: 0.2, mode: 0 }, { bypass: true }],
      rev: ['tz.reverb', { mode: 0, decay: 0.25, mix: 0.1 }],
      met: meter,
    },
    edges: [...ser('in', 'tun', 'wah', 'sd1', 'ch'), ['ch', 'a1', 0, 0], ['a1', 'a2'], ['ch', 'b1', 1, 0], ['b1', 'b2'], ...lr('a2', 'b2', 'dly'), ...tail('dly', 'rev', 'met')],
    rows: [['tun', 'wah', 'sd1', 'ch'], ['@ch', 'a1', 'a2'], ['@ch', 'b1', 'b2'], ['@a2', 'dly', 'rev', 'met']],
  });

song(13, 'mr-brightside', 'Mr. Brightside', ['indie', 'rock', 'pop', 'rhythm'],
  'Hot Fuss style: light compression and a Blues Driver into a Deluxe and an AC30, with a dotted-eighth delay (304 ms, 148 BPM) for the intro riff. Standard tuning; the chorus (off) adds width to the verses.',
  {
    nodes: {
      tun: tuner(),
      comp: ['tz.comp', { sustain: 0.3, ratio: 0.4, level: 0.5, blend: 0.6 }],
      od: ['bx.bd2', { level: 0.6, tone: 0.55, gain: 0.45 }],
      cho: ['mx.m134', { rate: 0.3, depth: 0.35, feedback: 0.1, tone: 0.55 }, { bypass: true }],
      split: ['box.split2'],
      a1: ['amp.deluxe', { gain: 0.6, treble: 0.6, bass: 0.55, master: 0.6, bright: 1 }],
      a2: ['cab.1x12us', { mic2: 2 }],
      b1: ['amp.ac30', { gain: 0.5, treble: 0.6, bass: 0.5, presence: 0.5, master: 0.6 }],
      b2: ['cab.2x12blue'],
      dly: ['tz.delay', { '=time': 304, subdiv: 1, feedback: 0.3, mix: 0.3, mode: 0, tone: 0.55 }],
      rev: ['tz.reverb', { mode: 0, decay: 0.3, mix: 0.14 }],
      met: meter,
    },
    edges: [...ser('in', 'tun', 'comp', 'od', 'cho', 'split'), ['split', 'a1', 0, 0], ['a1', 'a2'], ['split', 'b1', 1, 0], ['b1', 'b2'], ...lr('a2', 'b2', 'dly'), ...tail('dly', 'rev', 'met')],
    rows: [['tun', 'comp', 'od', 'cho', 'split'], ['@split', 'a1', 'a2'], ['@split', 'b1', 'b2'], ['@a2', 'dly', 'rev', 'met']],
  });

song(14, 'message-in-a-bottle', 'Message In A Bottle', ['rock', 'pop', 'clean', 'rhythm'],
  'Andy Summers: Dyna Comp and an Electric Mistress (set more chorus than flange) into a clean Marshall and a JC-120, with a short tape echo. Standard tuning; let the add9 arpeggios ring.',
  {
    nodes: {
      tun: tuner(),
      comp: ['mx.m102', { level: 0.55, sustain: 0.35 }],
      mist: ['ehx.mistress', { speed: 0.25, width: 0.45, regen: 0.2, matrix: 0 }],
      split: ['box.split2'],
      a1: ['amp.plexi', { gain: 0.32, master: 0.6, presence: 0.55, bass: 0.45, mid: 0.55, treble: 0.6, bright: 1 }],
      a2: ['cab.4x12gb', { mic2: 2 }],
      b1: ['amp.jc120', { gain: 0.35, treble: 0.55, mid: 0.5, bass: 0.5, bright: 1 }],
      b2: ['cab.2x12jc'],
      dly: ['tz.delay', { '=time': 320, feedback: 0.2, mix: 0.15, mode: 2 }],
      rev: ['tz.reverb', { mode: 2, decay: 0.3, mix: 0.14 }],
      met: meter,
    },
    edges: [...ser('in', 'tun', 'comp', 'mist', 'split'), ['split', 'a1', 0, 0], ['a1', 'a2'], ['split', 'b1', 1, 0], ['b1', 'b2'], ...lr('a2', 'b2', 'dly'), ...tail('dly', 'rev', 'met')],
    rows: [['tun', 'comp', 'mist', 'split'], ['@split', 'a1', 'a2'], ['@split', 'b1', 'b2'], ['@a2', 'dly', 'rev', 'met']],
  });

artist(1, 'weezer', 'Weezer', ['alt-rock', 'rock', 'pop-punk', 'rhythm'],
  'Blue Album style: a Mesa Mark into a tall Marshall 4x12, doubled on the other side for a wall of power chords. Tune down a half step; the delay (off) is for volume swells like in Only in Dreams.',
  {
    nodes: {
      tun: tuner(),
      vol: ['tz.silkvol', { pos: 1 }],
      split: ['box.split2'],
      a1: ['amp.markiic', { gain: 0.62, treble: 0.6, bass: 0.5, mid: 0.55, master: 0.5, presence: 0.5 }],
      a2: ['cab.4x12gb', { mic1: 0, mic2: 2 }],
      b0: ['pc.rat2', { gain: 0.3, tone: 0.45, level: 0.55 }],
      b1: ['amp.markiic', { gain: 0.5, treble: 0.68, bass: 0.45, mid: 0.6, master: 0.5, presence: 0.55 }],
      b2: ['celestion.cab-g12h4x12', { mic2: 3 }],
      dly: ['tz.delay', { '=time': 500, feedback: 0.4, mix: 0.3, mode: 1 }, { bypass: true }],
      rev: ['tz.reverb', { mode: 0, decay: 0.25, mix: 0.1 }],
      met: meter,
    },
    edges: [...ser('in', 'tun', 'vol', 'split'), ['split', 'a1', 0, 0], ['a1', 'a2'], ['split', 'b0', 1, 0], ...ser('b0', 'b1', 'b2'), ...lr('a2', 'b2', 'dly'), ...tail('dly', 'rev', 'met')],
    rows: [['tun', 'vol', 'split'], ['@split', 'a1', 'a2'], ['@split', 'b0', 'b1', 'b2'], ['@a2', 'dly', 'rev', 'met']],
  });

artist(2, 'metallica', 'Metallica', ['metal', 'thrash', 'rhythm', 'lead'],
  "Three Metallica sounds on a selector: A the chorus clean (Fade to Black), B the boosted, scooped Mark IIC+ rhythm, C Kirk's lead with more mids. Standard tuning; wah and delay for the solos.",
  {
    nodes: {
      tun: tuner(),
      wah: ['dn.kh95', { pos: 0.55 }, { bypass: true }],
      sel: ['tz.select4', { fade: 0.2 }, { raw: { sel: 1, mode: 0 } }],
      a1: ['mx.m134', { rate: 0.25, depth: 0.35, feedback: 0.1, tone: 0.5 }],
      a2: ['mesa.amp-markv', { gain: 0.35, master: 0.55, treble: 0.55, mid: 0.5, bass: 0.5, presence: 0.5, channel: 0 }],
      a3: ['cab.4x12v30'],
      b1: ['ib.ts808', { gain: 0.05, tone: 0.55, level: 0.8 }],
      b2: ['tz.hush', { threshold: 0.32, decay: 0.3 }],
      b3: ['amp.markiic', { gain: 0.75, treble: 0.62, bass: 0.33, mid: 0.28, master: 0.5, presence: 0.6 }],
      b4: ['bx.ge7', { b0: 0.57, b1: 0.53, b2: 0.39, b3: 0.34, b4: 0.45, b5: 0.56, b6: 0.5, level: 0.5 }],
      b5: ['cab.4x12v30', { mic1: 0, mic2: 3 }],
      c1: ['ib.ts808', { gain: 0.3, tone: 0.6, level: 0.7 }],
      c2: ['amp.markiic', { gain: 0.82, treble: 0.6, bass: 0.4, mid: 0.6, master: 0.5, presence: 0.55 }],
      c3: ['cab.4x12gb', { mic2: 2 }],
      mix: ['box.merge4'],
      dly: ['tz.delay', { '=time': 430, feedback: 0.32, mix: 0.2, mode: 0 }, { bypass: true }],
      rev: ['tz.reverb', { mode: 1, decay: 0.35, mix: 0.12 }],
      met: meter,
    },
    edges: [...ser('in', 'tun', 'wah'), ['wah', 'sel', 0, 0], ['sel', 'a1', 0, 0], ...ser('a1', 'a2', 'a3'), ['a3', 'mix', 0, 0], ['sel', 'b1', 2, 0], ...ser('b1', 'b2', 'b3', 'b4', 'b5'), ['b5', 'mix', 0, 1],
      ['sel', 'c1', 4, 0], ...ser('c1', 'c2', 'c3'), ['c3', 'mix', 0, 2], ...tail('mix', 'dly', 'rev', 'met')],
    rows: [['tun', 'wah', 'sel'], ['@sel', 'a1', 'a2', 'a3'], ['@sel', 'b1', 'b2', 'b3', 'b4', 'b5'], ['@sel', 'c1', 'c2', 'c3'], ['@a3', 'mix', 'dly', 'rev', 'met']],
  });

artist(3, 'slipknot', 'Slipknot', ['metal', 'nu-metal', 'high-gain', 'rhythm', 'drop-tuning'],
  "Mick and Jim: a gated, TS-tightened Rivera Knucklehead-style head on the left and an Orange on the right. Tune to drop B, or play in drop D and turn on the Drop pedal (down 3).",
  {
    nodes: {
      tun: tuner(),
      drop: ['dt.drop', { dsel: 2 }, { bypass: true }],
      gate: ['tz.hush', { threshold: 0.45, decay: 0.25 }],
      ts: ['ib.ts9', { gain: 0, tone: 0.55, level: 0.82 }],
      split: ['box.split2'],
      a1: ['rivera.amp-ktre', { ch: 2, g3: 0.7, treble: 0.55, mid: 0.45, bass: 0.6, master: 0.5, fnd: 0.5, presence: 0.55 }],
      a2: ['cab.4x12v30', { mic1: 0, mic2: 3 }],
      b1: ['amp.orange', { gain: 0.75, bass: 0.6, mid: 0.45, treble: 0.55, master: 0.5 }],
      b2: ['cab.4x12orange', { mic2: 2 }],
      eq: ['tz.contour', { '=lowcut': 70, '=mid1freq': 800, '=mid1gain': -2, '=highcut': 9000 }],
      rev: ['tz.reverb', { mode: 0, decay: 0.2, mix: 0.06 }],
      met: meter,
    },
    edges: [...ser('in', 'tun', 'drop', 'gate', 'ts', 'split'), ['split', 'a1', 0, 0], ['a1', 'a2'], ['split', 'b1', 1, 0], ['b1', 'b2'], ...lr('a2', 'b2', 'eq'), ...tail('eq', 'rev', 'met')],
    rows: [['tun', 'drop', 'gate', 'ts', 'split'], ['@split', 'a1', 'a2'], ['@split', 'b1', 'b2'], ['@a2', 'eq', 'rev', 'met']],
  });

artist(4, 'eric-clapton', 'Eric Clapton', ['blues', 'classic-rock', 'rock', 'lead', 'rhythm'],
  'Four Clapton eras on a selector: A the Beano (Les Paul into a cranked Bluesbreaker), B the Cream woman tone, C the 80s and 90s Strat into a Soldano, D a Leslie for Badge-style parts. Standard tuning.',
  {
    nodes: {
      tun: tuner(),
      sel: sel(4),
      a1: ['marshall.amp-bluesbreaker', { 'a.gain': 0.85, 'a.master': 0.6, 'a.presence': 0.5, 'a.bass': 0.5, 'a.mid': 0.6, 'a.treble': 0.6, 't.depth': 0 }],
      a2: ['cab.2x12cream', { mic2: 2 }],
      b1: ['tz.contour', { '=highcut': 1700, '=lowcut': 70, '=mid1freq': 650, '=mid1gain': 3, '=mid1q': 0.8 }],
      b2: ['amp.plexi', { gain: 0.82, master: 0.65, presence: 0.6, bass: 0.5, mid: 0.65, treble: 0.7, bright: 1 }],
      b3: ['cab.4x12gb'],
      c1: ['tz.comp', { sustain: 0.35, ratio: 0.45, level: 0.55, blend: 0.7, tone: 0.55 }],
      c2: ['tz.boost', { gain: 0.3, bass: 0.45, treble: 0.55 }],
      c3: ['amp.slo', { gain: 0.5, master: 0.5, presence: 0.5, bass: 0.5, mid: 0.6, treble: 0.55 }],
      c4: ['cab.2x12cream'],
      d1: ['amp.twin', { gain: 0.4, treble: 0.55, mid: 0.5, bass: 0.5, master: 0.6, bright: 0 }],
      d2: ['cab.2x12twin'],
      d3: ['ehx.lester', { level: 0.55, drive: 0.3, balance: 0.5, accel: 0.5, mix: 0.8, speed: 0.3 }],
      mix: ['box.merge4'],
      dly: ['tz.delay', { '=time': 380, feedback: 0.2, mix: 0.14, mode: 1 }, { bypass: true }],
      rev: ['tz.reverb', { mode: 0, decay: 0.35, mix: 0.14 }],
      met: meter,
    },
    edges: [...ser('in', 'tun'), ['tun', 'sel', 0, 0], ['sel', 'a1', 0, 0], ['a1', 'a2'], ['a2', 'mix', 0, 0], ['sel', 'b1', 2, 0], ...ser('b1', 'b2', 'b3'), ['b3', 'mix', 0, 1],
      ['sel', 'c1', 4, 0], ...ser('c1', 'c2', 'c3', 'c4'), ['c4', 'mix', 0, 2], ['sel', 'd1', 6, 0], ...ser('d1', 'd2', 'd3'), ['d3', 'mix', 0, 3], ...tail('mix', 'dly', 'rev', 'met')],
    rows: [['tun', 'sel'], ['@sel', 'a1', 'a2'], ['@sel', 'b1', 'b2', 'b3'], ['@sel', 'c1', 'c2', 'c3', 'c4'], ['@sel', 'd1', 'd2', 'd3'], ['@c4', 'mix', 'dly', 'rev', 'met']],
  });

artist(5, 'the-beatles', 'The Beatles', ['classic-rock', 'pop', 'rock', 'rhythm', 'lead'],
  'Four Beatles sounds: A a 12-string-style AC30 jangle, B Revolution-style fuzz, C a Leslie for Something and Let It Be, D a crunchy Bassman. Standard tuning; the tape slap at the end is very Abbey Road.',
  {
    nodes: {
      tun: tuner(),
      sel: sel(4),
      a1: ['tz.harmony', { '=semis1': 12, level1: 0.35, level2: 0, dry: 1, '=cents': 4 }],
      a2: ['amp.ac30', { gain: 0.45, treble: 0.65, bass: 0.45, presence: 0.55, master: 0.6 }],
      a3: ['cab.2x12blue', { mic2: 2 }],
      b1: ['bx.fz1w', { level: 0.5, tone: 0.55, gain: 0.85, mode: 0 }],
      b2: ['vox.amp-ac15', { 'a.gain': 0.6, 'a.treble': 0.6, 'a.bass': 0.5, 'r.mix': 0, 't.depth': 0, 'a.presence': 0.5, 'a.master': 0.55 }],
      b3: ['vox.cab-ac15'],
      c1: ['amp.twin', { gain: 0.38, treble: 0.55, mid: 0.5, bass: 0.5, master: 0.6, bright: 0 }],
      c2: ['cab.2x12twin'],
      c3: ['ehx.lester', { level: 0.55, drive: 0.25, balance: 0.5, accel: 0.5, mix: 0.85, speed: 0.25 }],
      d1: ['amp.bassman', { gain: 0.62, presence: 0.5, mid: 0.55, bass: 0.45, treble: 0.6, master: 0.6 }],
      d2: ['cab.4x10tweed', { mic2: 2 }],
      mix: ['box.merge4'],
      slap: ['tz.reelecho', { '=time': 110, feedback: 0.1, mix: 0.16, heads: 2, age: 0.3 }],
      rev: ['tz.reverb', { mode: 2, decay: 0.4, mix: 0.16 }],
      met: meter,
    },
    edges: [...ser('in', 'tun'), ['tun', 'sel', 0, 0], ['sel', 'a1', 0, 0], ...ser('a1', 'a2', 'a3'), ['a3', 'mix', 0, 0], ['sel', 'b1', 2, 0], ...ser('b1', 'b2', 'b3'), ['b3', 'mix', 0, 1],
      ['sel', 'c1', 4, 0], ...ser('c1', 'c2', 'c3'), ['c3', 'mix', 0, 2], ['sel', 'd1', 6, 0], ['d1', 'd2'], ['d2', 'mix', 0, 3], ...tail('mix', 'slap', 'rev', 'met')],
    rows: [['tun', 'sel'], ['@sel', 'a1', 'a2', 'a3'], ['@sel', 'b1', 'b2', 'b3'], ['@sel', 'c1', 'c2', 'c3'], ['@sel', 'd1', 'd2'], ['@a3', 'mix', 'slap', 'rev', 'met']],
  });

artist(6, 'muse', 'Muse', ['alt-rock', 'rock', 'lead', 'rhythm'],
  "Two Muse sounds: A Bellamy's Fuzz Factory into a Diezel VH4 (Whammy off, turn it on for octave-up leads), B a Queen-like treble booster into an AC30 with echo for Knights of Cydonia style leads. Standard tuning.",
  {
    nodes: {
      tun: tuner(),
      sel: sel(2),
      a0: ['dt.whammy5', { expr: 1, model: 1 }, { bypass: true }],
      a1: ['zvex.fuzzfactory', { 'f.level': 0.5, gate: 0.75, comp: 0.6, drive: 0.75, stab: 0.85 }],
      a2: ['amp.vh4', { gain: 0.6, bass: 0.55, mid: 0.55, treble: 0.55, master: 0.5, depth: 0.5, presence: 0.5 }],
      a3: ['cab.4x12v30', { mic2: 2 }],
      b1: ['tz.trebleboost', { gain: 0.6 }],
      b2: ['amp.ac30', { gain: 0.7, treble: 0.55, bass: 0.5, presence: 0.5, master: 0.6 }],
      b3: ['cab.2x12blue', { mic2: 2 }],
      b4: ['tz.reelecho', { '=time': 650, feedback: 0.35, mix: 0.3, heads: 2, age: 0.25 }],
      mix: ['box.merge2'],
      dly: ['tz.lumen', { '=time': 420, feedback: 0.3, mix: 0.18, mode: 2, spread: 0.7 }, { bypass: true }],
      rev: ['tz.reverb', { mode: 1, decay: 0.4, mix: 0.14 }],
      met: meter,
    },
    edges: [...ser('in', 'tun'), ['tun', 'sel', 0, 0], ['sel', 'a0', 0, 0], ...ser('a0', 'a1', 'a2', 'a3'), ['a3', 'mix', 0, 0], ['sel', 'b1', 2, 0], ...ser('b1', 'b2', 'b3', 'b4'), ['b4', 'mix', 0, 1], ...tail('mix', 'dly', 'rev', 'met')],
    rows: [['tun', 'sel'], ['@sel', 'a0', 'a1', 'a2', 'a3'], ['@sel', 'b1', 'b2', 'b3', 'b4'], ['@a3', 'mix', 'dly', 'rev', 'met']],
  });

artist(7, 'green-day', 'Green Day', ['punk', 'pop-punk', 'rock', 'rhythm'],
  'Dookie-era Billie Joe: a boosted modded Plexi on one side and an AC30 on the other for a punchy wall, with a gate. Tune down a half step; turn the Tube Screamer off for cleaner verses.',
  {
    nodes: {
      tun: tuner(),
      ts: ['ib.ts808', { gain: 0.15, tone: 0.55, level: 0.72 }],
      gate: ['tz.hush', { threshold: 0.3, decay: 0.3 }],
      ph: ['mx.m101', { rate: 0.3 }, { bypass: true }],
      split: ['box.split2'],
      a1: ['amp.plexi', { gain: 0.9, master: 0.6, presence: 0.55, bass: 0.55, mid: 0.6, treble: 0.6, bright: 1 }],
      a2: ['cab.4x12gb', { mic1: 0, mic2: 2 }],
      b1: ['amp.ac30', { gain: 0.62, treble: 0.55, bass: 0.55, presence: 0.5, master: 0.6 }],
      b2: ['cab.2x12blue', { mic2: 2 }],
      rev: ['tz.reverb', { mode: 0, decay: 0.2, mix: 0.07 }],
      met: meter,
    },
    edges: [...ser('in', 'tun', 'ts', 'gate', 'ph', 'split'), ['split', 'a1', 0, 0], ['a1', 'a2'], ['split', 'b1', 1, 0], ['b1', 'b2'], ...lr('a2', 'b2', 'rev'), ...tail('rev', 'met')],
    rows: [['tun', 'ts', 'gate', 'ph', 'split'], ['@split', 'a1', 'a2'], ['@split', 'b1', 'b2'], ['@a2', 'rev', 'met']],
  });

artist(8, 'pink-floyd', 'Pink Floyd', ['classic-rock', 'rock', 'ambient', 'lead'],
  "Gilmour's rig: Dyna Comp, a Power Boost-style push and a Ram's Head Muff (off) into a Hiwatt, with a Twin through a rotary alongside, then multi-head echo and a hall. Standard tuning; Muff on for Comfortably Numb, Uni-Vibe for Breathe.",
  {
    nodes: {
      tun: tuner(),
      comp: ['mx.m102', { level: 0.55, sustain: 0.4 }],
      muff: ['ehx.ramshead', { level: 0.5, tone: 0.45, gain: 0.7 }, { bypass: true }],
      boost: ['tz.boost', { gain: 0.3, bass: 0.5, treble: 0.55 }],
      vibe: ['mx.m68', { level: 0.55, intensity: 0.6, speed: 0.3, mode: 0 }, { bypass: true }],
      split: ['box.split2'],
      a1: ['amp.hiwatt', { gain: 0.45, bass: 0.45, treble: 0.6, mid: 0.5, presence: 0.5, master: 0.7 }],
      a2: ['cab.4x12t75', { mic2: 2 }],
      b1: ['amp.twin', { gain: 0.35, treble: 0.55, mid: 0.5, bass: 0.5, master: 0.6, bright: 0 }],
      b2: ['cab.2x12twin'],
      b3: ['ehx.lester', { level: 0.5, drive: 0.2, balance: 0.5, accel: 0.5, mix: 0.9, speed: 0.3 }],
      mix: ['ut.merge', { '=level': 0, '=levelB': -5 }],
      echo: ['tz.reelecho', { '=time': 430, feedback: 0.35, mix: 0.25, heads: 6, age: 0.3, tone: 0.5 }],
      dly: ['tz.delay', { '=time': 380, subdiv: 1, feedback: 0.35, mix: 0.25, mode: 0 }, { bypass: true }],
      rev: ['tz.reverb', { mode: 1, decay: 0.55, mix: 0.22, predelay: 0.3 }],
      met: meter,
    },
    edges: [...ser('in', 'tun', 'comp', 'muff', 'boost', 'vibe', 'split'), ['split', 'a1', 0, 0], ['a1', 'a2'], ['a2', 'mix', 0, 0], ['split', 'b1', 1, 0], ...ser('b1', 'b2', 'b3'), ['b3', 'mix', 0, 1], ...tail('mix', 'echo', 'dly', 'rev', 'met')],
    rows: [['tun', 'comp', 'muff', 'boost', 'vibe', 'split'], ['@split', 'a1', 'a2'], ['@split', 'b1', 'b2', 'b3'], ['@a2', 'mix', 'echo', 'dly', 'rev', 'met']],
  });

artist(9, 'avenged-sevenfold', 'Avenged Sevenfold', ['metal', 'heavy-metal', 'metalcore', 'rhythm', 'lead'],
  'City of Evil style: A a gated Rectifier rhythm, B a boosted Mark lead with the harmony set to E minor thirds for twin-guitar lines (change the key per song). Tune down a half step; wah for the solos.',
  {
    nodes: {
      tun: tuner(),
      wah: ['dn.gcb95', { pos: 0.55 }, { bypass: true }],
      sel: sel(2),
      a1: ['ib.ts9', { gain: 0.02, tone: 0.55, level: 0.8 }],
      a2: ['tz.hush', { threshold: 0.38, decay: 0.3 }],
      a3: ['amp.recto', { gain: 0.62, treble: 0.55, mid: 0.42, bass: 0.6, presence: 0.55, master: 0.45, channel: 1 }],
      a4: ['cab.4x12v30', { mic1: 0, mic2: 3 }],
      b1: ['tz.choirmaster', { '=key': 4, scale: 1, '=deg1': 2, level1: 0.55, dry: 1, level2: 0 }],
      b2: ['ib.ts9', { gain: 0.15, tone: 0.6, level: 0.72 }],
      b3: ['mesa.amp-markv', { gain: 0.65, master: 0.5, treble: 0.55, mid: 0.6, bass: 0.5, presence: 0.55, channel: 2 }],
      b4: ['cab.4x12v30', { mic2: 2 }],
      mix: ['box.merge2'],
      dly: ['tz.lumen', { '=time': 450, feedback: 0.3, mix: 0.2, mode: 2, spread: 0.7 }],
      rev: ['tz.reverb', { mode: 1, decay: 0.35, mix: 0.12 }],
      met: meter,
    },
    edges: [...ser('in', 'tun', 'wah'), ['wah', 'sel', 0, 0], ['sel', 'a1', 0, 0], ...ser('a1', 'a2', 'a3', 'a4'), ['a4', 'mix', 0, 0], ['sel', 'b1', 2, 0], ...ser('b1', 'b2', 'b3', 'b4'), ['b4', 'mix', 0, 1], ...tail('mix', 'dly', 'rev', 'met')],
    rows: [['tun', 'wah', 'sel'], ['@sel', 'a1', 'a2', 'a3', 'a4'], ['@sel', 'b1', 'b2', 'b3', 'b4'], ['@a3', 'mix', 'dly', 'rev', 'met']],
  });

artist(10, 'ac-dc', 'AC/DC', ['rock', 'hard-rock', 'classic-rock', 'rhythm', 'lead'],
  "Both AC/DC guitars at once: Malcolm's cleaner Marshall on the left, Angus's boosted JTM45-style amp on the right. Standard tuning; Angus's wah and the slap echo (off) are there for solos.",
  {
    nodes: {
      tun: tuner(),
      split: ['box.split2'],
      a1: ['amp.plexi', { gain: 0.55, master: 0.6, presence: 0.5, bass: 0.5, mid: 0.6, treble: 0.55, bright: 0 }],
      a2: ['cab.4x12gb', { mic1: 0, mic2: 2 }],
      b0: ['dn.gcb95', { pos: 0.55 }, { bypass: true }],
      b1: ['tz.boost', { gain: 0.45, bass: 0.45, treble: 0.6 }],
      b2: ['marshall.amp-bluesbreaker', { 'a.gain': 0.8, 'a.master': 0.6, 'a.presence': 0.55, 'a.bass': 0.45, 'a.mid': 0.65, 'a.treble': 0.6, 't.depth': 0 }],
      b3: ['celestion.cab-g12h4x12', { mic2: 2 }],
      b4: ['dn.ep103', { '=time': 140, feedback: 0.1, mix: 0.15, age: 0.3 }, { bypass: true }],
      rev: ['tz.reverb', { mode: 0, decay: 0.25, mix: 0.1 }],
      met: meter,
    },
    edges: [...ser('in', 'tun', 'split'), ['split', 'a1', 0, 0], ['a1', 'a2'], ['split', 'b0', 1, 0], ...ser('b0', 'b1', 'b2', 'b3', 'b4'), ...lr('a2', 'b4', 'rev'), ...tail('rev', 'met')],
    rows: [['tun', 'split'], ['@split', 'a1', 'a2'], ['@split', 'b0', 'b1', 'b2', 'b3', 'b4'], ['@a2', 'rev', 'met']],
  });

artist(11, 'guns-n-roses', "Guns N' Roses", ['rock', 'hard-rock', 'lead', 'rhythm'],
  "Slash and Izzy: a Jubilee-style lead amp on the left and an 800 on the right, with Slash's wah, a 10-band EQ push and a talk box (off) for Rocket Queen style parts. Tune down a half step.",
  {
    nodes: {
      tun: tuner(),
      tb: ['mx.m222', { volume: 0.55, tone: 0.5, sens: 0.5 }, { bypass: true }],
      wah: ['dn.sw95', { 'w.pos': 0.55 }, { bypass: true }],
      eq: ['mx.m108', { level: 0.55, gain: 0.5, b0: 0.45, b1: 0.48, b2: 0.52, b3: 0.58, b4: 0.6, b5: 0.56, b6: 0.52, b7: 0.5, b8: 0.48, b9: 0.45 }],
      split: ['box.split2'],
      a1: ['amp.jubilee', { gain: 0.72, master: 0.55, presence: 0.55, bass: 0.5, mid: 0.65, treble: 0.6 }],
      a2: ['cab.4x12gb', { mic1: 0, mic2: 2 }],
      b1: ['amp.jcm800', { gain: 0.5, master: 0.55, presence: 0.5, bass: 0.5, mid: 0.6, treble: 0.55 }],
      b2: ['cab.4x12t75', { mic2: 3 }],
      dly: ['tz.delay', { '=time': 420, feedback: 0.25, mix: 0.16, mode: 1 }, { bypass: true }],
      rev: ['tz.reverb', { mode: 2, decay: 0.3, mix: 0.1 }],
      met: meter,
    },
    edges: [...ser('in', 'tun', 'tb', 'wah'), ['wah', 'eq'], ['eq', 'split', 0, 0], ['split', 'a1', 0, 0], ['a1', 'a2'], ['split', 'b1', 1, 0], ['b1', 'b2'], ...lr('a2', 'b2', 'dly'), ...tail('dly', 'rev', 'met')],
    rows: [['tun', 'tb', 'wah', 'eq', 'split'], ['@split', 'a1', 'a2'], ['@split', 'b1', 'b2'], ['@a2', 'dly', 'rev', 'met']],
  });

artist(12, 'van-halen', 'Van Halen', ['rock', 'hard-rock', 'lead', 'rhythm'],
  'Two Eddie eras: A the early brown sound (Echoplex preamp, Phase 90, Flanger off, a cranked Plexi and Echoplex echo), B the 5150 era with a touch of chorus. Tune down a half step; wah for the solos.',
  {
    nodes: {
      tun: tuner(),
      wah: ['evh.wah95', { pos: 0.55 }, { bypass: true }],
      sel: sel(2),
      a1: ['dn.ep101', { gain: 0.5 }],
      a2: ['mx.m101', { rate: 0.25 }],
      a3: ['mx.m117', { manual: 0.45, width: 0.5, speed: 0.2, regen: 0.55 }, { bypass: true }],
      a4: ['amp.plexi', { gain: 0.95, master: 0.6, presence: 0.6, bass: 0.45, mid: 0.6, treble: 0.65, bright: 1 }],
      a5: ['cab.4x12gb', { mic1: 0, mic2: 2 }],
      a6: ['dn.ep103', { '=time': 330, feedback: 0.2, mix: 0.2, age: 0.3 }],
      b1: ['tz.hush', { threshold: 0.3, decay: 0.35 }],
      b2: ['amp.5150', { gain: 0.6, bass: 0.55, mid: 0.55, treble: 0.6, master: 0.5, depth: 0.5, presence: 0.55 }],
      b3: ['evh.cab-stripe412', { mic2: 2 }],
      b4: ['evh.chorus', { mix: 0.2, rate: 0.25, depth: 0.3 }],
      mix: ['box.merge2'],
      rev: ['tz.reverb', { mode: 2, decay: 0.35, mix: 0.12 }],
      met: meter,
    },
    edges: [...ser('in', 'tun', 'wah'), ['wah', 'sel', 0, 0], ['sel', 'a1', 0, 0], ...ser('a1', 'a2', 'a3', 'a4', 'a5', 'a6'), ['a6', 'mix', 0, 0], ['sel', 'b1', 2, 0], ...ser('b1', 'b2', 'b3', 'b4'), ['b4', 'mix', 0, 1], ...tail('mix', 'rev', 'met')],
    rows: [['tun', 'wah', 'sel'], ['@sel', 'a1', 'a2', 'a3', 'a4', 'a5', 'a6'], ['@sel', 'b1', 'b2', 'b3', 'b4'], ['@a4', 'mix', 'rev', 'met']],
  });

artist(13, 'steve-vai', 'Steve Vai', ['rock', 'instrumental', 'lead'],
  'Passion and Warfare to Fire Garden: Bad Horsie wah, Whammy and DS-1 (both off) into an Ecstasy and a JVM, then a Harmonizer-style detune, ping-pong delay and a big hall. Standard tuning; Whammy on for the screams.',
  {
    nodes: {
      tun: tuner(),
      wah: ['mo.badhorsie', { 'w.pos': 0.5, 'w.range': 0.5, 'w.level': 0.55 }, { bypass: true }],
      wh: ['dt.whammy5', { expr: 1, model: 1 }, { bypass: true }],
      ds: ['bx.ds1', { level: 0.55, tone: 0.5, gain: 0.35 }, { bypass: true }],
      comp: ['tz.comp', { sustain: 0.3, ratio: 0.4, level: 0.5, blend: 0.5 }],
      split: ['box.split2'],
      a1: ['bogner.amp-ecstasy', { gain: 0.62, master: 0.55, treble: 0.52, mid: 0.65, bass: 0.45, presence: 0.5, channel: 2 }],
      a2: ['cab.4x12uber', { mic1: 0, mic2: 2 }],
      b1: ['marshall.amp-jvm', { gain: 0.6, bass: 0.5, mid: 0.62, treble: 0.55, master: 0.5, presence: 0.5, depth: 0.5, channel: 2 }],
      b2: ['cab.4x12t75', { mic2: 3 }],
      dv: ['tz.doublevision', { '=p.cents': 9, 'p.level1': 0.4, '=st.time': 12, '=st.level': -4 }, { variant: 'stereo' }],
      dly: ['tz.lumen', { '=time': 440, feedback: 0.38, mix: 0.24, mode: 2, spread: 0.75 }],
      rev: ['tz.reverb', { mode: 1, decay: 0.6, mix: 0.22, predelay: 0.3 }],
      met: meter,
    },
    edges: [...ser('in', 'tun', 'wah', 'wh', 'ds', 'comp', 'split'), ['split', 'a1', 0, 0], ['a1', 'a2'], ['split', 'b1', 1, 0], ['b1', 'b2'], ...lr('a2', 'b2', 'dv'), ...tail('dv', 'dly', 'rev', 'met')],
    rows: [['tun', 'wah', 'wh', 'ds', 'comp', 'split'], ['@split', 'a1', 'a2'], ['@split', 'b1', 'b2'], ['@a2', 'dv', 'dly', 'rev', 'met']],
  });

artist(14, 'polyphia', 'Polyphia', ['prog', 'instrumental', 'clean', 'lead'],
  'Polyphia style: heavy compression into a sparkly clean (A) or a boosted Mark lead (B), then stereo chorus, delay and reverb. Standard tuning; turn on the Ricochet for octave jumps and the harmonizer for stacked lines.',
  {
    nodes: {
      tun: tuner(),
      comp: ['tz.comp', { sustain: 0.6, ratio: 0.6, attack: 0.3, release: 0.4, level: 0.55, blend: 0.85 }],
      ric: ['dt.ricochet', { glide: 0.2, dry: 0, semis1: 8 }, { bypass: true }],
      harm: ['tz.harmony', { '=semis1': 12, level1: 0.25, '=semis2': 7, level2: 0.18, dry: 1 }, { bypass: true }],
      sel: sel(2),
      a1: ['tz.contour', { '=lowcut': 90, '=mid1freq': 500, '=mid1gain': -3, '=highgain': 2 }],
      a2: ['amp.twin', { gain: 0.32, treble: 0.62, mid: 0.45, bass: 0.48, master: 0.6, bright: 1 }],
      a3: ['cab.2x12twin', { mic2: 2 }],
      b1: ['ib.ts9', { gain: 0.05, tone: 0.6, level: 0.78 }],
      b2: ['mesa.amp-markv', { gain: 0.6, master: 0.5, treble: 0.55, mid: 0.55, bass: 0.45, presence: 0.55, channel: 2 }],
      b3: ['prs.cab-212v30', { mic2: 2 }],
      mix: ['box.merge2'],
      cho: ['tz.chorus', { rate: 0.3, depth: 0.25, mix: 0.25, tone: 0.55 }],
      dly: ['tz.delay', { '=time': 380, subdiv: 1, feedback: 0.3, mix: 0.18, mode: 7 }],
      rev: ['tz.reverb', { mode: 1, decay: 0.45, mix: 0.18 }],
      met: meter,
    },
    edges: [...ser('in', 'tun', 'comp', 'ric', 'harm'), ['harm', 'sel', 0, 0], ['sel', 'a1', 0, 0], ...ser('a1', 'a2', 'a3'), ['a3', 'mix', 0, 0], ['sel', 'b1', 2, 0], ...ser('b1', 'b2', 'b3'), ['b3', 'mix', 0, 1], ...tail('mix', 'cho', 'dly', 'rev', 'met')],
    rows: [['tun', 'comp', 'ric', 'harm', 'sel'], ['@sel', 'a1', 'a2', 'a3'], ['@sel', 'b1', 'b2', 'b3'], ['@a3', 'mix', 'cho', 'dly', 'rev', 'met']],
  });

artist(15, 'linkin-park', 'Linkin Park', ['nu-metal', 'alt-rock', 'metal', 'rhythm', 'drop-tuning'],
  'Hybrid Theory style: A a chorus clean, B a gated Dual Rectifier for the riffs, plus a Whammy (off) for the noise parts. Tune to drop C#, or play drop D with the Drop pedal on (down 1).',
  {
    nodes: {
      tun: tuner(),
      drop: ['dt.drop', { dsel: 0 }, { bypass: true }],
      wh: ['dt.whammy5', { expr: 1, model: 0 }, { bypass: true }],
      sel: ['tz.select2', { fade: 0.15 }, { raw: { sel: 1, mode: 0 } }],
      a1: ['mx.m134', { rate: 0.3, depth: 0.35, feedback: 0.1, tone: 0.5 }],
      a2: ['amp.jc120', { gain: 0.32, treble: 0.55, mid: 0.5, bass: 0.5, bright: 0 }],
      a3: ['cab.2x12jc'],
      b1: ['tz.hush', { threshold: 0.42, decay: 0.25 }],
      b2: ['ib.ts9', { gain: 0, tone: 0.55, level: 0.78 }],
      b3: ['amp.recto', { gain: 0.6, treble: 0.55, mid: 0.4, bass: 0.62, presence: 0.55, master: 0.45, channel: 1 }],
      b4: ['cab.4x12v30', { mic1: 0, mic2: 3 }],
      mix: ['box.merge2'],
      dly: ['tz.delay', { '=time': 400, feedback: 0.3, mix: 0.2, mode: 0 }, { bypass: true }],
      rev: ['tz.reverb', { mode: 0, decay: 0.3, mix: 0.1 }],
      met: meter,
    },
    edges: [...ser('in', 'tun', 'drop', 'wh'), ['wh', 'sel', 0, 0], ['sel', 'a1', 0, 0], ...ser('a1', 'a2', 'a3'), ['a3', 'mix', 0, 0], ['sel', 'b1', 2, 0], ...ser('b1', 'b2', 'b3', 'b4'), ['b4', 'mix', 0, 1], ...tail('mix', 'dly', 'rev', 'met')],
    rows: [['tun', 'drop', 'wh', 'sel'], ['@sel', 'a1', 'a2', 'a3'], ['@sel', 'b1', 'b2', 'b3', 'b4'], ['@a3', 'mix', 'dly', 'rev', 'met']],
  });

artist(16, 'slayer', 'Slayer', ['metal', 'thrash', 'rhythm', 'lead'],
  'Kerry and Jeff: a mid-pushed JCM800 on one side and a JCM900 on the other, tight and gated. Tune down a half step; turn on the wah for the solos.',
  {
    nodes: {
      tun: tuner(),
      wah: ['dn.gcb95', { pos: 0.55 }, { bypass: true }],
      gate: ['tz.hush', { threshold: 0.38, decay: 0.25 }],
      eq: ['mx.m108', { level: 0.6, gain: 0.55, b0: 0.42, b1: 0.45, b2: 0.5, b3: 0.6, b4: 0.62, b5: 0.58, b6: 0.52, b7: 0.48, b8: 0.45, b9: 0.42 }],
      split: ['box.split2'],
      a1: ['amp.jcm800', { gain: 0.85, master: 0.5, presence: 0.6, bass: 0.55, mid: 0.6, treble: 0.62 }],
      a2: ['cab.4x12t75', { mic1: 0, mic2: 2 }],
      b1: ['marshall.amp-jcm900', { channel: 1, gb: 0.75, ga: 0.5, master: 0.5, presence: 0.55, bass: 0.55, mid: 0.55, treble: 0.6 }],
      b2: ['cab.4x12gb', { mic2: 3 }],
      rev: ['tz.reverb', { mode: 0, decay: 0.2, mix: 0.06 }],
      met: meter,
    },
    edges: [...ser('in', 'tun', 'wah', 'gate', 'eq'), ['eq', 'split', 0, 0], ['split', 'a1', 0, 0], ['a1', 'a2'], ['split', 'b1', 1, 0], ['b1', 'b2'], ...lr('a2', 'b2', 'rev'), ...tail('rev', 'met')],
    rows: [['tun', 'wah', 'gate', 'eq', 'split'], ['@split', 'a1', 'a2'], ['@split', 'b1', 'b2'], ['@a2', 'rev', 'met']],
  });

artist(17, 'slaughter-to-prevail', 'Slaughter To Prevail', ['deathcore', 'metal', 'high-gain', 'rhythm', 'drop-tuning'],
  'Deathcore weight: gate and TS into a 5150 and an ENGL, an octave fuzz (off) on one side and a stutter (off) for breakdowns. Made for a low-tuned 7-string; with a 6-string in drop D turn on the Drop pedal (down 6).',
  {
    nodes: {
      tun: tuner(),
      drop: ['dt.drop', { dsel: 5 }, { bypass: true }],
      gate: ['tz.hush', { threshold: 0.5, decay: 0.2 }],
      ts: ['ib.ts9', { gain: 0, tone: 0.6, level: 0.85 }],
      split: ['box.split2'],
      a1: ['amp.5150', { gain: 0.62, bass: 0.6, mid: 0.45, treble: 0.6, master: 0.5, depth: 0.55, presence: 0.55 }],
      a2: ['cab.4x12v30', { mic1: 0, mic2: 3 }],
      b0: ['tz.goblin', { 'p.level1': 0.55, 'fz.gain': 0.7, 'p.level2': 0.2, 'fz.tone': 0.5, 'fz.level': 0.5 }, { bypass: true }],
      b1: ['engl.amp-powerball', { gain: 0.6, bass: 0.6, mid: 0.45, treble: 0.58, presence: 0.55, depth: 0.55, master: 0.5, channel: 2 }],
      b2: ['engl.cab-pro4x12', { mic2: 2 }],
      chop: ['tz.pulsegrid', { '=time': 110, '=pattern': 5, depth: 1, smooth: 0.1, mix: 1, '=steps': 8 }, { bypass: true, variant: 'stereo' }],
      rev: ['tz.reverb', { mode: 0, decay: 0.2, mix: 0.06 }],
      met: meter,
    },
    edges: [...ser('in', 'tun', 'drop', 'gate', 'ts', 'split'), ['split', 'a1', 0, 0], ['a1', 'a2'], ['split', 'b0', 1, 0], ...ser('b0', 'b1', 'b2'), ...lr('a2', 'b2', 'chop'), ...tail('chop', 'rev', 'met')],
    rows: [['tun', 'drop', 'gate', 'ts', 'split'], ['@split', 'a1', 'a2'], ['@split', 'b0', 'b1', 'b2'], ['@a2', 'chop', 'rev', 'met']],
  });

artist(18, 'lorna-shore', 'Lorna Shore', ['deathcore', 'metal', 'high-gain', 'rhythm', 'lead', 'drop-tuning'],
  "Lorna Shore's core sound: a noise gate and a TS9 into two 6505+ heads on V30 4x12s. Tune to drop A (or drop D with the Drop pedal down 5); turn on the delay and hall for the big leads.",
  {
    nodes: {
      tun: tuner(),
      drop: ['dt.drop', { dsel: 4 }, { bypass: true }],
      gate: ['tz.hush', { threshold: 0.48, decay: 0.2 }],
      ts: ['ib.ts9', { gain: 0, tone: 0.6, level: 0.85 }],
      split: ['box.split2'],
      a1: ['peavey.amp-6505plus', { channel: 1, gain: 0.58, bass: 0.6, mid: 0.45, treble: 0.6, master: 0.5, depth: 0.5, presence: 0.55, bright: 0 }],
      a2: ['cab.4x12v30', { mic1: 0, mic2: 3 }],
      b1: ['peavey.amp-6505plus', { channel: 1, gain: 0.55, bass: 0.58, mid: 0.5, treble: 0.58, master: 0.5, depth: 0.55, presence: 0.5, bright: 0 }],
      b2: ['mesa.cab-2x12recto', { mic2: 2 }],
      dly: ['tz.delay', { '=time': 460, feedback: 0.35, mix: 0.22, mode: 7 }, { bypass: true }],
      rev: ['tz.reverb', { mode: 1, decay: 0.6, mix: 0.25 }, { bypass: true }],
      met: meter,
    },
    edges: [...ser('in', 'tun', 'drop', 'gate', 'ts', 'split'), ['split', 'a1', 0, 0], ['a1', 'a2'], ['split', 'b1', 1, 0], ['b1', 'b2'], ...lr('a2', 'b2', 'dly'), ...tail('dly', 'rev', 'met')],
    rows: [['tun', 'drop', 'gate', 'ts', 'split'], ['@split', 'a1', 'a2'], ['@split', 'b1', 'b2'], ['@a2', 'dly', 'rev', 'met']],
  });

artist(19, 'iron-maiden', 'Iron Maiden', ['heavy-metal', 'classic-metal', 'metal', 'lead', 'rhythm'],
  'Twin-guitar Maiden: a JCM800 on the left and a Plexi on the right, with a harmony pedal set to E minor thirds (off) for the twin leads. Standard tuning; change the harmony key per song.',
  {
    nodes: {
      tun: tuner(),
      wah: ['dn.gcb95', { pos: 0.55 }, { bypass: true }],
      harm: ['tz.choirmaster', { '=key': 4, scale: 1, '=deg1': 2, level1: 0.6, dry: 1, level2: 0 }, { bypass: true }],
      cho: ['mx.m134', { rate: 0.3, depth: 0.3, feedback: 0.1, tone: 0.5 }, { bypass: true }],
      ts: ['ib.ts9', { gain: 0.1, tone: 0.55, level: 0.75 }],
      split: ['box.split2'],
      a1: ['amp.jcm800', { gain: 0.72, master: 0.55, presence: 0.55, bass: 0.5, mid: 0.65, treble: 0.6 }],
      a2: ['cab.4x12t75', { mic2: 2 }],
      b1: ['amp.plexi', { gain: 0.85, master: 0.6, presence: 0.55, bass: 0.5, mid: 0.65, treble: 0.6, bright: 1 }],
      b2: ['cab.4x12gb', { mic2: 3 }],
      dly: ['tz.delay', { '=time': 420, feedback: 0.3, mix: 0.18, mode: 1 }, { bypass: true }],
      rev: ['tz.reverb', { mode: 1, decay: 0.35, mix: 0.12 }],
      met: meter,
    },
    edges: [...ser('in', 'tun', 'wah', 'harm', 'cho', 'ts', 'split'), ['split', 'a1', 0, 0], ['a1', 'a2'], ['split', 'b1', 1, 0], ['b1', 'b2'], ...lr('a2', 'b2', 'dly'), ...tail('dly', 'rev', 'met')],
    rows: [['tun', 'wah', 'harm', 'cho', 'ts', 'split'], ['@split', 'a1', 'a2'], ['@split', 'b1', 'b2'], ['@a2', 'dly', 'rev', 'met']],
  });

artist(20, 'red-hot-chili-peppers', 'Red Hot Chili Peppers', ['funk', 'rock', 'alt-rock', 'rhythm', 'lead'],
  "Frusciante's board: WH10 wah, DS-2, Big Muff, Electric Mistress and CE-1 chorus (all off) into a Silver Jubilee and a Showman-style Fender. Standard tuning; DS-2 on for crunchy riffs, the chorus for Under the Bridge.",
  {
    nodes: {
      tun: tuner(),
      wah: ['ib.wh10', { pos: 0.55 }, { bypass: true }],
      ds: ['bx.ds2', { level: 0.55, tone: 0.5, gain: 0.55, mode: 0 }, { bypass: true }],
      muff: ['ehx.bigmuff', { level: 0.5, tone: 0.5, gain: 0.7 }, { bypass: true }],
      mist: ['ehx.mistress', { speed: 0.2, width: 0.6, regen: 0.5, matrix: 0 }, { bypass: true }],
      ce: ['bx.ce2w', { rate: 0.3, depth: 0.5, mode: 1 }, { bypass: true }],
      split: ['box.split2'],
      a1: ['amp.jubilee', { gain: 0.42, master: 0.6, presence: 0.55, bass: 0.5, mid: 0.6, treble: 0.6 }],
      a2: ['cab.4x12gb', { mic2: 2 }],
      b1: ['amp.twin', { gain: 0.4, treble: 0.6, mid: 0.5, bass: 0.5, master: 0.6, bright: 1 }],
      b2: ['cab.2x12twin'],
      dly: ['tz.delay', { '=time': 380, feedback: 0.3, mix: 0.18, mode: 1 }, { bypass: true }],
      rev: ['tz.reverb', { mode: 3, decay: 0.3, mix: 0.12 }],
      met: meter,
    },
    edges: [...ser('in', 'tun', 'wah', 'ds', 'muff', 'mist', 'ce'), ['ce', 'split', 0, 0], ['split', 'a1', 0, 0], ['a1', 'a2'], ['split', 'b1', 1, 0], ['b1', 'b2'], ...lr('a2', 'b2', 'dly'), ...tail('dly', 'rev', 'met')],
    rows: [['tun', 'wah', 'ds', 'muff', 'mist', 'ce', 'split'], ['@split', 'a1', 'a2'], ['@split', 'b1', 'b2'], ['@a2', 'dly', 'rev', 'met']],
  });

artist(21, 'eagles', 'Eagles', ['classic-rock', 'country-rock', 'rock', 'rhythm', 'lead'],
  'Hotel California layers: a 12-string-style clean Twin on the left and a Mesa Mark drive on the right, both playing at once. Standard tuning (capo 7 for the intro); the talk box (off) is for Rocky Mountain Way.',
  {
    nodes: {
      tun: tuner(),
      comp: ['mx.m102', { level: 0.55, sustain: 0.3 }],
      split: ['box.split2'],
      a1: ['tz.harmony', { '=semis1': 12, level1: 0.35, level2: 0, dry: 1, '=cents': 4 }],
      a2: ['amp.twin', { gain: 0.32, treble: 0.6, mid: 0.5, bass: 0.48, master: 0.6, bright: 1 }],
      a3: ['cab.2x12twin', { mic2: 2 }],
      b0: ['mx.m222', { volume: 0.55, tone: 0.5, sens: 0.5 }, { bypass: true }],
      b1: ['ib.ts808', { gain: 0.25, tone: 0.55, level: 0.65 }],
      b2: ['amp.markiic', { gain: 0.55, treble: 0.55, bass: 0.5, mid: 0.6, master: 0.5, presence: 0.5 }],
      b3: ['cab.1x12open', { mic2: 2 }],
      dly: ['tz.delay', { '=time': 400, feedback: 0.25, mix: 0.14, mode: 1 }],
      rev: ['tz.reverb', { mode: 1, decay: 0.4, mix: 0.16 }],
      met: meter,
    },
    edges: [...ser('in', 'tun', 'comp', 'split'), ['split', 'a1', 0, 0], ...ser('a1', 'a2', 'a3'), ['split', 'b0', 1, 0], ...ser('b0', 'b1', 'b2', 'b3'), ...lr('a3', 'b3', 'dly'), ...tail('dly', 'rev', 'met')],
    rows: [['tun', 'comp', 'split'], ['@split', 'a1', 'a2', 'a3'], ['@split', 'b0', 'b1', 'b2', 'b3'], ['@a3', 'dly', 'rev', 'met']],
  });

artist(22, 'rage-against-the-machine', 'Rage Against The Machine', ['rock', 'alt-rock', 'funk', 'metal', 'rhythm', 'lead'],
  "Morello's board: Whammy, wah, Phase 90, flanger and a DD-2 style delay in front of a 50-watt JCM800 style head. Drop D for Killing in the Name; the stutter (off) stands in for his kill-switch toggle.",
  {
    chain: [tuner(), ['dt.whammy5', { expr: 1, model: 1 }, { bypass: true }], ['dn.gcb95', { pos: 0.55 }, { bypass: true }], ['mx.m101', { rate: 0.3 }, { bypass: true }], ['ib.fl9', { speed: 0.25, regen: 0.6, width: 0.6, manual: 0.5 }, { bypass: true }],
      ['bx.dd3', { mix: 0.4, feedback: 0.55, dtime: 0.5, range: 1 }, { bypass: true }], ['amp.jcm800', { gain: 0.62, master: 0.6, presence: 0.6, bass: 0.55, mid: 0.5, treble: 0.55 }], ['cab.4x12t75', { mic1: 0, mic2: 2 }],
      ['tz.pulsegrid', { '=time': 70, '=pattern': 1, depth: 1, smooth: 0.05, mix: 1, '=steps': 2 }, { bypass: true }], meter],
  });

module.exports = [...G.flat(), ...SPECIAL, ...SONGS, ...ARTISTS];
