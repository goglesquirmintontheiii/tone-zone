#!/usr/bin/env python3
"""Generate docs/engine-blocks.md from the engine's parameter registry (`tonezone-engine --list`)."""
import json, subprocess, sys, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
exe = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'engine/build/tonezone-engine')
reg = json.loads(subprocess.check_output([exe, '--list']))
DESC = {
  'drive': ('Overdrive / distortion / fuzz / boost circuit model.', '''`opts` is a *voicing* (all optional): `clip` = ts | diode | asym | opamp | ge | si | muff | led | jfet | tube | mosfet | clean;
`tone` = none | lp | ts | blend | rat | eq3 | tilt | hm2 | mt2; `gainMinDb`, `gainMaxDb` (gain knob range), `preHp`, `clipHp`, `clipLp`, `postLp` (Hz),
`cleanSum` + `cleanMix` (Klon / TS-style clean blend), `toneLo`, `toneHi` (lp tone range), `blendLp`, `blendHp` (blend tone), `bassF`, `midF`, `midQ`, `trebleF`, `hiMidF`, `useHiMid`, `midMin`, `midMax`, `eqRangeDb` (eq3 / tilt),
`levelMinDb`, `levelMaxDb`, `bias` (asymmetry), `stages` (1-3 cascaded clippers), `stage2Db`, `slew` (op-amp slew limiting), `outTrim`,
`preEq` / `postEq`: `[{type: peak|lp|hp|bp|notch|ls|hs, f, q, db}]`, `modes`: array of partial voicings selected by the `mode` param (e.g. a 3-way clipping switch).'''),
  'boost': ('Clean / treble / mid boost.', '`mode` param picks the voicing (0 clean, 1 treble, 2 mid, 3 fat).'),
  'amp': ('Tube / solid-state amplifier (or preamp with `opts.preamp: true`).', '''`opts.model` = one of the built-in models: deluxe twin bassman ac30 dc30 plexi jcm800 jubilee recto markiic 5150 slo dumble orange uber vh4 friedman hiwatt jc120 svt b15 gk800 ad200 markbass acoustic.
`opts.models: [...]` = several channels (switch with the `channel` param); entries may be model names or voice objects.
`opts.voice` = a new amp built from a base model: `{base, stages:[[gain,headroom,bias,lpHz,hpHz],...], gainPos, tsPos, tsType (0 FMV, 1 Baxandall, 2 top-boost, 3 bass/James), stack: "fender"|"bassman"|"marshall"|"mesa"|"vox"|"orange"|"peavey"|[R1,R2,R3,R4,C1,C2,C3], tsMakeup, brightHz, brightDb, power (0 none, 1 push-pull, 2 class A, 3 solid state), pwrH, sag, presHz, depthHz, nfb, otLp, otHp, tight, inHp, baxBass, baxMid, baxTreble, baxRange, drive (scales all stage gains), dark (octaves to darken the stage filters)}`. The block sets its own output level.'''),
  'cab': ('Speaker cabinet with up to 4 microphones (any speaker, position, distance, angle, level, pan, polarity). The mics are mixed into one IR per output, so extra mics cost no CPU.', '''`opts.model` = built-in cab: 1x12us 2x12twin 4x10tweed 2x12blue 4x12gb 4x12v30 4x12t75 4x12uber 2x12cream 1x12open 4x12orange 2x12jc 8x10svt 4x10bass 1x15bass 2x10horn 4x12bass.
`opts.cab` = a new cab voicing: `{hp, hpQ, resDb (low resonance), lp (cone break-up Hz), lpQ, open (open back), peaks: [[f, q, db], ...], seed (speaker detail), detail (dB of fine ripple)}`; `opts.cabs: [...]` several (param `model`). Mic params are `m1on m1type m1pos m1dist m1spk m1lvl m1pan m1phase m1axis` … `m4*` (the CAB builder maps the draggable mics to these).'''),
  'ir': ('Impulse-response loader (user IR packs).', '`opts.files: [paths]`, `model` param selects.'),
  'nam': ('Neural Amp Modeler (A1 / A2 / LSTM) player.', '`opts.files: [paths]`.'),
  'comp': ('Compressor: OTA (Dyna Comp), VCA (studio), opto.', '`opts.type` = ota | vca | opto.'),
  'gate': ('Noise gate / suppressor (with optional key input for NS-2 style send/return).', ''),
  'geq': ('Graphic EQ.', '`opts.freqs: [Hz,...]` (bands become params b0, b1 …), `opts.q`.'),
  'peq': ('3-band parametric EQ with shelves and cuts.', ''),
  'pareq': ('6-band studio parametric EQ, switchable HPF / LPF, band listen and a spectrum analyser (status `spec`).', 'Band types: 0 peak, 1 low shelf, 2 high shelf, 3 notch, 4 band-pass, 5 tilt.'),
  'utility': ('Small mixer utilities.', '`opts.kind` = split | merge | gain | pan | width | sum.'),
  'chorus': ('Chorus / vibrato / ensemble / dimension.', '`mode` 0 chorus, 1 vibrato, 2 3-voice ensemble, 3 dimension; `opts.baseMs`, `opts.depthMs`, `opts.invertR`.'),
  'flanger': ('Flanger (standard / ultra / gate / through-zero).', ''),
  'phaser': ('Phaser (2 to 12 stages, script / block logo modes).', '`opts.stages`, `opts.style`.'),
  'tremolo': ('Tremolo: opto / harmonic / bias, optional stereo auto-pan.', ''),
  'vibe': ('Uni-vibe style photocell phaser (chorus / vibrato).', ''),
  'rotary': ('Rotary speaker (horn + drum, slow / fast with acceleration).', ''),
  'ringmod': ('Ring modulator.', ''),
  'crusher': ('Bit / sample-rate crusher.', ''),
  'delay': ('Delay with 11 modes: 0 digital, 1 analog (BBD), 2 tape (multi-head `heads` bitmask), 3 lo-fi, 4 modulated, 5 reverse, 6 shimmer, 7 ping-pong, 8 dual, 9 warp (self-oscillating), 10 delay+reverb. Event 1 = tap, event 2 = hold/freeze.', '`opts.mode`, `opts.fixedMode`, `opts.maxMs`, `opts.defaultMs`.'),
  'deco': ('Tape saturation + doubletracker (Deco).', ''),
  'reverb': ('Algorithmic reverb with 10 modes: 0 room, 1 hall, 2 plate, 3 spring, 4 shimmer, 5 cloud, 6 modulated, 7 dynamic (ducking), 8 +delay, 9 swell.', '`opts.mode`, `opts.fixedMode`.'),
  'wah': ('Wah / auto-wah / envelope filter.', '`mode` 0 treadle, 1 LFO, 2 envelope; `filter` 0 LP, 1 BP, 2 HP; `opts.fLo`, `opts.fHi`, `opts.q`.'),
  'talkbox': ('Talk box (vowel formant filter, treadle or picking dynamics).', ''),
  'volume': ('Volume pedal (linear / audio taper, minimum volume).', ''),
  'pitch': ('Polyphonic pitch shifter (WSOLA): drop tune, octaves, whammy, harmonies; `scale` > 0 = intelligent diatonic harmony using `key`, `deg1`, `deg2` (scale steps).', '`opts.semis1`, `opts.level1`, … initial values.'),
  'tuner': ('Chromatic / strobe / polyphonic tuner (status `tuner`). Output 0 mutes while tuning (if `mute`), output 1 is an always-on thru.', ''),
  'looper': ('Multi-track looper with rhythm patterns (RC-500 / RC-600 style).', '`opts.tracks`, `opts.maxSec`.'),
  'chain': ('Composite block: several algorithms in series inside one pedal (dual pedals, multi-FX).', '`opts.chain: [{prefix, algo, opts, params, on}]` → params are exposed as `<prefix>.<param>` plus `<prefix>.on`.'),
  'acoustic': ('Acoustic simulator / piezo enhancer / acoustic preamp: body resonance, air, pick attack, EQ, notch, anti-feedback auto-notch, compression, saturation, small room.', '`mode` 0 electric→acoustic, 1 piezo enhance, 2 preamp; `type` 0 dread, 1 jumbo, 2 parlor, 3 nylon, 4 12-string.'),
  'synth': ('Guitar synthesizer: 0 square lead, 1 saw lead, 2 organ, 3 strings, 4 brass, 5 sub bass, 6 pad, 7 filter sweep.', ''),
  'freeze': ('Spectral freeze / sustainer (event 1 = freeze / toggle, event 2 = release). `mode` 0 latch, 1 momentary, 2 auto (every new note).', ''),
  'lofi': ('Lo-fi: 0 cassette, 1 vinyl, 2 AM radio, 3 telephone, 4 sampler (bits / rate).', ''),
  'swell': ('Auto-swell / slow gear (fades every note in).', ''),
  'slicer': ('Rhythmic gate / stutter (16 patterns, tap tempo via event 1).', ''),
  'vocal': ('Formant voice that follows your playing: pitch-tracked oscillator (or your own signal) through a 3-formant vowel filter with per-note syllables.', '`mode` 0 talk box (formants on the input), 1 sing, 2 meow (m-i-a-u + pitch bend), 3 fart (low, flappy, sagging pitch), 4 robot (monotone), 5 choir (3 detuned voices). `vowel` 0 a, 1 e, 2 i, 3 o, 4 u, 5 m, 6 schwa, 7 brr. `lyric` (per-note syllable rotation): 0 the vowel knob, 1 "mi-ku", 2 a-e-i-o-u, 3 meow, 4 la-la gibberish. `shift` moves the formants (deep … cartoon), `octave` the sung pitch. Status: `vowel`, `gate`, `hz`.'),
  'lossy': ('Spectral codec damage: low-bitrate streaming artefacts, band limiting, packet loss, warble, frame freeze.', '`mode` 0 standard, 1 inverse (only what the codec throws away), 2 warble (phase jitter, packets repeat). `loss` = weak-bin removal + magnitude quantisation, `filter` = bandwidth, `packets` = dropped frames, `verb` = smeared frame averaging, `freeze` holds the current frame. ~21 ms latency (dry is delayed to match).'),
  'microloop': ('Short-term memory looper: always records, captures the last `length` seconds and loops them with speed / reverse / stretch.', '`mode` 0 latch (event 1 toggles), 1 momentary (event 1 down / 2 up), 2 auto (each new note), 3 stutter (re-captures continuously). `speed` −2…2 (negative = reverse), `stretch` repeats 60 ms grains, `decay` < 1 lets loops fade. Status: `looping`, `pos`.'),
  'split': ('1 → N splitter (per-output gain `g1..g8`, mute `m*`, polarity `inv*`).', ''),
  'merge': ('N → 1/2 mixer (per-input gain, mute, polarity, pan).', ''),
  'select': ('Output selector: stereo in → one of N stereo output pairs (`sel`), or several at once (`mode` 1, bitmask `mask`).', ''),
  'meter': ('Pass-through stereo level meter (status `meter`: [[peak, rms, clip], …]).', ''),
  'stereo': ('Stereo tool: 0 M/S width, 1 Haas, 2 dual-voice widener, 3 auto-pan, 4 mono sum, 5 swap, 6 balance / pan; optional mono bass.', ''),
  'di': ('DI box (instrument → mic level, pad, polarity, low cut, speaker sim) or re-amp box (`opts.reamp: true`).', ''),
  'thru': ('Plain pass-through (stands in for unavailable blocks, also used for adapters).', ''),
  'extio': ('External device I/O: block inputs go to new PipeWire ports `<name>_to_k`, block outputs come from `<name>_from_k`; auto-connected to device ports matching `opts.capture` / `opts.playback` (regex).', '`opts: {name, capture, playback}`'),
}
out = ['# Engine blocks (algorithms)', '', 'Generated from `tonezone-engine --list` by `scripts/gen-engine-doc.py`. A block definition picks an algorithm with `algo`, sets creation options with `opts`, and maps its controls to the parameters below (knob `p` = parameter name; knob `min`/`max` = engine units).', '']
for name in sorted(reg):
    d, o = DESC.get(name, ('', ''))
    out += [f'## `{name}`', '', d, '']
    if o: out += ['**opts:** ' + o, '']
    out += ['| param | default | range |', '|---|---|---|']
    for p in reg[name]:
        out.append(f"| `{p['name']}` | {round(p['def'], 3):g} | {round(p['min'], 3):g} … {round(p['max'], 3):g} |")
    out.append('')
open(os.path.join(ROOT, 'docs/engine-blocks.md'), 'w').write('\n'.join(out))
print('wrote docs/engine-blocks.md', len(reg), 'algorithms')
