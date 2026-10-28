// Built-in Tone Zone plugin: DigiTech.
// Blocks inspired by DigiTech gear. Names, logos and artwork are Tone Zone originals; control layouts and
// colours follow the real units (see each block's `ref`) so moving between the real thing and the virtual one is easy.
export default function register(tz) {
  const { K, SEL, TOG, BTN, FOOT, LED, SLIDER, SCREEN, TREADLE, MIC, def, ten, pct, db, ms, MONO, STEREO, MONO_TO_ST, STD } = tz.helpers;
  const { BOSS, NINE, MXRD, lvl, tone, gain, S, onFoot, onLed, k, AMP, CAB, preampPair, marshallKnobs, fenderKnobs } = tz.builders;
  tz.addDefs([
    def({
      id: 'dt.drop', name: 'Dropper', ref: 'DigiTech Drop', brand: 'DigiTech', code: 'DROP', cat: 'Pitch', form: 'drop', color: '#c4161c',
      algo: 'pitch', fixed: { level1: 1, quality: 1 }, cost: 0.6,
      controls: [
        SEL('dsel', '', ['1', '2', '3', '4', '5', '6', '7', 'OCT', 'OCT+DRY'], { x: 73, y: 64, r: 20, sweep: 270, def: 1, style: 'chrome', labelRadius: 13, optSize: 5.6 }),
        TOG('momentary', 'MOMENTARY', ['OFF', 'ON'], { x: 26, y: 26, orient: 'h' }),
        FOOT({ style: 'stomp', x: 73, y: 196, r: 13 }), LED({ x: 73, y: 168, r: 3 }),
      ],
      derive: (p) => {
        const i = p.dsel ?? 1;
        if (i < 7) return { semis1: -(i + 1), dry: 0, level1: 1 };
        return { semis1: -12, dry: i === 8 ? 0.8 : 0, level1: 1 };
      },
      momentaryWhen: (p) => p.momentary === 1,
      dropLeds: true,
      desc: 'Polyphonic drop tune 1–7 semitones, octave, octave+dry. MOMENTARY ON = active only while the footswitch is held.',
    })
  ]);
}
