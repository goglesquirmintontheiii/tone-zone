// Built-in Tone Zone plugin: Universal Audio.
// Blocks inspired by Universal Audio gear. Names, logos and artwork are Tone Zone originals; control layouts and
// colours follow the real units (see each block's `ref`) so moving between the real thing and the virtual one is easy.
export default function register(tz) {
  const { K, SEL, TOG, BTN, FOOT, LED, SLIDER, SCREEN, TREADLE, MIC, def, ten, pct, db, ms, MONO, STEREO, MONO_TO_ST, STD } = tz.helpers;
  const { lvl, tone, gain, onFoot, onLed, k, AMP, CAB, preampOf, stomp } = tz.builders;
  // UAFX-style amp pedal: amp (3 mods) -> [vibrato] -> [spring reverb] -> speaker cab (3 speakers or off) in one stompbox
  const UA = (o) => {
    const chain = [{ prefix: 'a', algo: 'amp', opts: { models: o.models } }];
    if (o.vib) chain.push({ prefix: 't', algo: 'tremolo', params: { mode: 1, rate: 0.5, depth: 0.45, wave: 0.2 }, on: false });
    if (o.verb) chain.push({ prefix: 'r', algo: 'reverb', params: { mode: 3, decay: 0.45, tone: 0.55, lowcut: 0.2 } });
    chain.push({ prefix: 'c', algo: 'cab', opts: { cabs: o.cabs } });
    // explicit layout: switches on top, two rows of knobs below (as on the real pedals)
    const kn = o.controls.filter((c) => c.t === 'knob'), tg = o.controls.filter((c) => c.t === 'toggle');
    kn.forEach((c, i) => Object.assign(c, { x: [40, 102, 164][i % 3], y: i < 3 ? 62 : 106, r: 12, labelPos: 'below' }));
    tg.forEach((t, i) => Object.assign(t, { x: tg.length === 2 ? [70, 134][i] : [40, 102, 164][i], y: 24, orient: 'h', optSize: 4.4 }));
    const d = def(Object.assign({ form: 'strymon', cat: 'Preamp', kind: 'Preamp', algo: 'chain', cost: 4.2, stereo: 'both', ports: MONO }, o, { opts: { chain } }));
    d.fixed = Object.assign({ 'a.master': 0.6 }, o.fixed || {});
    const dv = o.derive;
    d.derive = (u) => {
      const sp = u.spk ?? 0, boost = u.bst ? (u.boost ?? 0.5) : 0;
      const out = { 'c.on': sp < 3 ? 1 : 0, 'c.model': Math.min(2, sp), 'a.gain': Math.min(1, (u['a.gain'] ?? 0.5) + 0.35 * boost) };
      if (o.vib) out['t.on'] = u.vib ? 1 : 0;
      if (o.verb) out['r.on'] = (u['r.mix'] ?? 0) > 0.004 ? 1 : 0;
      return Object.assign(out, dv ? dv(u) : {});
    };
    return d;
  };
  const feet = () => [FOOT({ action: 'bypass', label: 'ON' }), FOOT({ action: 'param', p: 'bst', toggle: true, virtual: true, label: 'BOOST' }), LED({ color: '#ff2a1a' }), LED({ bind: 'param:bst', color: '#ff2a1a' })];
  const outK = () => K('a.level', 'OUTPUT', { min: -24, max: 12, def: -2, display: db });
  tz.addDefs([
    UA({ id: 'uafx.dream65', name: 'Dreamy 65 Reverb Amp', ref: "UAFX Dream '65 Reverb Amplifier", logo: "dreamy '65", tagline: 'REVERB AMPLIFIER', color: '#1b1b1d', text: '#e9e9e9', vib: true, verb: true,
      models: [
        { base: 'deluxe', drive: 1.2, stages: [[38, 1.4, 0.24, 11000, 25], [34, 1.35, 0.28, 8500, 40], [24, 1.4, 0.26, 7500, 60]], tsPos: 1 },
        'deluxe',
        { base: 'deluxe', brightDb: 3, pwrH: 1.8, sag: 0.35 },
      ],
      cabs: [
        { hp: 78, hpQ: 1.6, resDb: 4.5, lp: 5100, peaks: [[800, 0.9, 1.5], [1900, 1.3, 3], [3200, 1.8, 2]], seed: 211 },
        { hp: 100, hpQ: 0.9, resDb: 2, lp: 6000, open: true, peaks: [[180, 1, 1], [1200, 1.2, -2], [2600, 1.5, 4], [4300, 2, 2]], seed: 212 },
        { hp: 80, hpQ: 1.0, resDb: 2, lp: 7500, open: true, peaks: [[400, 1, -1], [3000, 1.3, 3], [5500, 2, 2]], seed: 213 },
      ],
      controls: [K('a.gain', 'VOLUME', { def: 0.45 }), K('r.mix', 'REVERB', { def: 0.2 }), outK(), K('a.bass', 'BASS', { def: 0.45 }), K('a.treble', 'TREBLE', { def: 0.6 }), K('boost', 'BOOST', { def: 0.5, virtual: true }),
        TOG('spk', 'SPEAKER', ['GB', 'OX', 'EV', '—'], { virtual: true, def: 1 }), TOG('vib', 'VIBRATO', ['OFF', 'ON'], { virtual: true }), TOG('a.channel', 'MOD', ['LEAD', 'STOCK', 'D-TEX'], { def: 1 }), ...feet()],
      desc: "Blackface reverb combo in a pedal: amp, spring reverb, vibrato and three speakers. The right footswitch adds the BOOST amount." }),
    UA({ id: 'uafx.ruby63', name: 'Garnet 63 Top Boost', ref: "UAFX Ruby '63 Top Boost Amplifier", logo: "garnet '63", tagline: 'TOP BOOST AMPLIFIER', color: '#7a1f22', text: '#f2e6d8',
      models: [
        { base: 'ac30', tsType: 0, stack: 'vox' },
        'ac30',
        { base: 'ac30', drive: 1.25, stages: [[44, 1.35, 0.24, 11000, 30], [36, 1.25, 0.28, 9000, 70], [24, 1.3, 0.26, 7600, 80]] },
      ],
      cabs: [
        { hp: 100, hpQ: 1.1, resDb: 3, lp: 6500, open: true, peaks: [[900, 1, 1], [2500, 1.2, 5], [4500, 2, 3]], seed: 221 },
        { hp: 90, hpQ: 1.2, resDb: 3, lp: 5600, open: true, peaks: [[850, 1, 1.5], [2200, 1.3, 3.5], [3800, 2, 2]], seed: 222 },
        { hp: 95, hpQ: 1.0, resDb: 2, lp: 6200, open: true, peaks: [[700, 1, 1], [2400, 1.4, 3], [4500, 2, 2]], seed: 223 },
      ],
      controls: [K('a.gain', 'VOLUME', { def: 0.5 }), K('a.presence', 'CUT', { def: 0.5, invert: true }), outK(), K('a.bass', 'BASS'), K('a.treble', 'TREBLE', { def: 0.55 }), K('boost', 'BOOST', { def: 0.5, virtual: true }),
        TOG('spk', 'SPEAKER', ['BL', 'GR', 'JN', '—'], { virtual: true }), TOG('a.channel', 'MOD', ['NORMAL', 'TB', 'CUSTOM'], { def: 1 }), ...feet()],
      desc: 'Class-A Top Boost combo in a pedal with three speaker choices and a boost footswitch.' }),
    UA({ id: 'uafx.lion68', name: 'Leo 68 Super Lead', ref: "UAFX Lion '68 Super Lead Amplifier", logo: "leo '68", tagline: 'SUPER LEAD AMPLIFIER', color: '#c9a64e', text: '#151515',
      models: [
        'plexi',
        { base: 'plexi', drive: 1.25, stages: [[44, 1.4, 0.3, 11500, 45], [36, 1.25, 0.34, 8500, 100], [24, 1.3, 0.3, 7400, 90]], tsPos: 3 },
        { base: 'jcm800', drive: 1.1, tight: 0.2 },
      ],
      cabs: [
        { hp: 75, hpQ: 1.6, resDb: 5, lp: 5000, peaks: [[120, 1, 2], [800, 0.9, 1.5], [1900, 1.3, 3], [3200, 1.8, 2]], seed: 231 },
        { hp: 70, hpQ: 1.8, resDb: 5.5, lp: 5600, peaks: [[110, 1, 2], [1500, 1.2, 2.5], [2900, 1.6, 5], [4600, 2.5, 3]], seed: 232 },
        { hp: 70, hpQ: 1.6, resDb: 5, lp: 5000, peaks: [[120, 1, 2.5], [450, 1, 1.5], [1800, 1.3, 2.5], [3200, 1.8, 1.5]], seed: 233 },
      ],
      controls: [K('a.gain', 'VOLUME', { def: 0.55 }), K('a.presence', 'PRESENCE'), outK(), K('a.bass', 'BASS'), K('a.mid', 'MIDDLE'), K('a.treble', 'TREBLE'),
        TOG('spk', 'SPEAKER', ['GB', 'V3', '65', '—'], { virtual: true }), TOG('a.channel', 'MOD', ['STOCK', 'PLEXI', 'BROWN'], { def: 0 }), ...feet()],
      derive: (u) => ({ 'a.gain': Math.min(1, (u['a.gain'] ?? 0.55) + (u.bst ? 0.25 : 0)) }),
      desc: 'Plexi Super Lead stack in a pedal: three amp mods, three 4x12 speaker voicings and a boost footswitch.' }),
  ]);
}
