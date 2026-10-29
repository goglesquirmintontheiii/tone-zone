// Line 6 amps and cabs (each amp also gets a matching preamp through preampPair).
export function registerAmps(tz) {
  const { SEL, TOG, K } = tz.helpers;
  const { AMP, CAB, preampPair, k } = tz.builders;
  // amp level trim (dB) and preamp output default, set from plugin-check levels
  const pair = (a, ampTrim, preTrim) => {
    const [amp, pre] = preampPair(a);
    amp.fixed = Object.assign({}, amp.fixed, { level: ampTrim });
    const out = pre.controls.find((c) => c.p === 'level');
    if (out) out.def = preTrim;
    // keep the channel / voicing selector on the preamp too
    const sel = a.controls.find((c) => c.t === 'sel');
    if (sel) pre.controls.unshift(Object.assign({}, sel, { x: undefined, y: undefined }));
    return [amp, pre];
  };
  const black = { tolex: '#141414', grille: 'black', logoFont: "'Oswald', sans-serif", logoColor: '#e8e8e8' };
  const spiderKnobs = (sel) => [SEL('channel', 'AMP', sel, { def: 1, printLabels: false }), k('gain', 'DRIVE'), k('bass', 'BASS'), k('mid', 'MID'), k('treble', 'TREBLE'), k('master', 'CH VOL', { def: 0.55 })];
  const SPIDER = ['CLEAN', 'CRUNCH', 'METAL', 'INSANE'];
  const dtVoice = (base, g) => ({ base, drive: g });
  tz.addDefs([
    pair(AMP({ id: 'l6.amp-spider4', name: 'Arachnid IV 120', ref: 'Line 6 Spider IV 120', brand: 'Line 6', typeName: 'Modeling combo 2x10', combo: true, speakers: 2,
      ...black, panel: '#1a1a1a', panelText: '#ff3b30', logo: 'ARACHNID', knob: 'boss', opts: { models: ['jc120', 'jcm800', 'recto', '5150'] },
      controls: spiderKnobs(SPIDER), desc: 'Solid state modeling combo with four amp channels from clean to insane.' }), -6, -6),
    pair(AMP({ id: 'l6.amp-spidervalve', name: 'Arachnid Valve 112', ref: 'Line 6 Spider Valve 112 (Bogner voiced)', brand: 'Line 6', typeName: 'Tube modeling combo 1x12', combo: true, speakers: 1,
      ...black, panel: '#c9ccd0', panelText: '#111', logo: 'ARACHNID VALVE', knob: 'chrome', opts: { models: ['dc30', 'plexi', 'uber', 'recto'] },
      controls: [...spiderKnobs(['CLEAN', 'TWANG', 'BRIT', 'METAL']), k('presence', 'PRESENCE')], desc: 'Tube power amp with modeled preamps, voiced together with a famous tube amp builder.' }), -6, -5),
    pair(AMP({ id: 'l6.amp-spidervalvehd', name: 'Arachnid Valve HD100', ref: 'Line 6 Spider Valve HD100 MkII', brand: 'Line 6', typeName: '100 W tube modeling head',
      ...black, panel: '#c9ccd0', panelText: '#111', logo: 'ARACHNID VALVE', knob: 'chrome', opts: { models: ['twin', 'ac30', 'jcm800', 'uber'] },
      controls: [...spiderKnobs(['CLEAN', 'CHIME', 'CRUNCH', 'LEAD']), k('presence', 'PRESENCE')], desc: '100 W tube head with four modeled channels.' }), -6, -6),
    pair(AMP({ id: 'l6.amp-catalyst', name: 'Catalyzer 100', ref: 'Line 6 Catalyst 100', brand: 'Line 6', typeName: 'Modeling combo 1x12', combo: true, speakers: 1,
      ...black, panel: '#202020', panelText: '#e8e8e8', logo: 'CATALYZER', knob: 'strymon', opts: { models: ['deluxe', 'ac30', 'jcm800', '5150'] },
      controls: [SEL('channel', 'AMP', ['CLEAN', 'CHIME', 'CRUNCH', 'HEAVY'], { def: 2, printLabels: false }), k('gain', 'DRIVE'), k('bass', 'BASS'), k('mid', 'MID'), k('treble', 'TREBLE'), k('presence', 'PRESENCE'), k('master', 'MASTER', { def: 0.55 })],
      desc: 'Two-channel modeling combo with six amp voices (four here).' }), -6, -6),
    pair(AMP({ id: 'l6.amp-flextone', name: 'Flexitone III', ref: 'Line 6 Flextone III', brand: 'Line 6', typeName: 'Modeling combo 1x12', combo: true, speakers: 1,
      ...black, panel: '#2a3a5a', panelText: '#e8eefc', logo: 'FLEXITONE', knob: 'boss', opts: { models: ['twin', 'ac30', 'plexi', 'recto'] },
      controls: [SEL('channel', 'AMP', ['BLACKFACE', 'TOP BOOST', 'PLEXI', 'RECTO'], { def: 2, printLabels: false }), k('gain', 'DRIVE'), k('bass', 'BASS'), k('mid', 'MID'), k('treble', 'TREBLE'), k('master', 'CH VOL', { def: 0.55 })],
      desc: 'Early 2000s modeling combo with classic amp models.' }), -6, -6),
    pair(AMP({ id: 'l6.amp-dt25', name: 'DT-Twenty Five', ref: 'Line 6 DT25', brand: 'Line 6', typeName: '25 W tube head (4 voicings)',
      ...black, panel: '#b8bcc2', panelText: '#111', logo: 'DT 25', knob: 'chicken', opts: { models: [dtVoice('deluxe', 1), dtVoice('ac30', 1), dtVoice('plexi', 1.1), dtVoice('uber', 1)] },
      controls: [SEL('channel', 'VOICING', ['I', 'II', 'III', 'IV'], { def: 2 }), k('gain', 'DRIVE'), k('bass', 'BASS'), k('mid', 'MID'), k('treble', 'TREBLE'), k('presence', 'PRESENCE'), k('master', 'MASTER', { def: 0.6 }), TOG('sag', 'CLASS', ['A', 'A/B'], { values: [0.75, 0.35] })],
      desc: 'Tube head with four voicings (clean, chime, crunch, lead) and a class A / AB switch.' }), -6, -6),
    pair(AMP({ id: 'l6.amp-dt50', name: 'DT-Fifty', ref: 'Line 6 DT50', brand: 'Line 6', typeName: '50 W tube head (4 voicings)',
      ...black, panel: '#b8bcc2', panelText: '#111', logo: 'DT 50', knob: 'chicken', opts: { models: [dtVoice('twin', 1), dtVoice('dc30', 1), dtVoice('jcm800', 1), dtVoice('recto', 1)] },
      controls: [SEL('channel', 'VOICING', ['I', 'II', 'III', 'IV'], { def: 2 }), k('gain', 'DRIVE'), k('bass', 'BASS'), k('mid', 'MID'), k('treble', 'TREBLE'), k('presence', 'PRESENCE'), k('master', 'MASTER', { def: 0.6 }), TOG('sag', 'CLASS', ['A', 'A/B'], { values: [0.75, 0.35] })],
      desc: 'Bigger brother of the 25 W head: four voicings and a class A / AB switch.' }), -6, -6),
    pair(AMP({ id: 'l6.amp-hd147', name: 'HD-One47', ref: 'Line 6 HD147', brand: 'Line 6', typeName: 'Modeling head',
      ...black, panel: '#121212', panelText: '#c9ccd0', logo: 'HD-ONE47', knob: 'chrome', opts: { models: ['plexi', 'jcm800', 'recto', '5150'] },
      controls: [SEL('channel', 'AMP', ['PLEXI', '800', 'RECTO', 'PANAMA'], { def: 1 }), k('gain', 'DRIVE'), k('bass', 'BASS'), k('mid', 'MID'), k('treble', 'TREBLE'), k('presence', 'PRESENCE'), k('master', 'CH VOL', { def: 0.55 })],
      desc: 'Rack-style modeling head with classic and high-gain amp models.' }), -6, -6),
    pair(AMP({ id: 'l6.amp-spiderjam', name: 'Arachnid Jam 75', ref: 'Line 6 Spider Jam', brand: 'Line 6', typeName: 'Practice combo 1x12', combo: true, speakers: 1,
      ...black, panel: '#1a1a1a', panelText: '#ff3b30', logo: 'ARACHNID JAM', knob: 'boss', opts: { models: ['twin', 'ac30', 'jcm800', '5150'] },
      controls: spiderKnobs(SPIDER), desc: 'Practice combo with the classic four amp channels.' }), -6, -6),
    CAB({ id: 'l6.cab-powercab112', name: 'Powerbox 112', ref: 'Line 6 Powercab 112 (FRFR mode)', brand: 'Line 6', typeName: '1x12 FRFR speaker', cabSize: '1x12', grille: 'black', logo: 'POWERBOX', logoFont: "'Oswald', sans-serif", logoColor: '#d8d8d8',
      opts: { cab: { hp: 55, hpQ: 0.8, resDb: 1, lp: 15000, lpQ: 0.7, open: false, peaks: [[3000, 1.2, 0.5]], seed: 61, detail: 0.3 } }, desc: 'Flat full-range speaker for modelers (it adds very little color).' }),
    CAB({ id: 'l6.cab-dt412', name: 'DT 4x12 V30', ref: 'Line 6 DT50 412 (Celestion V30)', brand: 'Line 6', typeName: '4x12 closed back', cabSize: '4x12', grille: 'black', logo: 'DT 412', logoFont: "'Oswald', sans-serif", logoColor: '#d8d8d8',
      opts: { cab: { hp: 75, hpQ: 0.9, resDb: 4, lp: 5200, lpQ: 0.8, open: false, peaks: [[2500, 1.5, 4], [1200, 1.2, -2], [130, 1, 2]], seed: 62, detail: 1.5 } } }),
    CAB({ id: 'l6.cab-dt212', name: 'DT 2x12', ref: 'Line 6 DT50 212', brand: 'Line 6', typeName: '2x12 open back', cabSize: '2x12', grille: 'black', logo: 'DT 212', logoFont: "'Oswald', sans-serif", logoColor: '#d8d8d8',
      opts: { cab: { hp: 90, hpQ: 0.9, resDb: 2, lp: 5600, open: true, peaks: [[2200, 1.4, 3], [900, 1.1, -1]], seed: 63, detail: 1.2 } } }),
  ]);
  void K;
}
