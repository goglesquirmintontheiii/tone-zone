# Engine blocks (algorithms)

Generated from `tonezone-engine --list` by `scripts/gen-engine-doc.py`. A block definition picks an algorithm with `algo`, sets creation options with `opts`, and maps its controls to the parameters below (knob `p` = parameter name; knob `min`/`max` = engine units).

## `acoustic`

Acoustic simulator / piezo enhancer / acoustic preamp: body resonance, air, pick attack, EQ, notch, anti-feedback auto-notch, compression, saturation, small room.

**opts:** `mode` 0 electric→acoustic, 1 piezo enhance, 2 preamp; `type` 0 dread, 1 jumbo, 2 parlor, 3 nylon, 4 12-string.

| param | default | range |
|---|---|---|
| `mode` | 0 | 0 … 2 |
| `body` | 0.6 | 0 … 1 |
| `type` | 0 | 0 … 4 |
| `top` | 0.5 | 0 … 1 |
| `bass` | 0.5 | 0 … 1 |
| `mid` | 0.5 | 0 … 1 |
| `midfreq` | 0.5 | 0 … 1 |
| `treble` | 0.5 | 0 … 1 |
| `presence` | 0.5 | 0 … 1 |
| `notch` | 0 | 0 … 1 |
| `notchdepth` | 0.6 | 0 … 1 |
| `comp` | 0 | 0 … 1 |
| `saturate` | 0 | 0 … 1 |
| `level` | 0 | -24 … 12 |
| `phase` | 0 | 0 … 1 |
| `antifb` | 0 | 0 … 1 |
| `mix` | 1 | 0 … 1 |
| `reverb` | 0 | 0 … 1 |

## `amp`

Tube / solid-state amplifier (or preamp with `opts.preamp: true`).

**opts:** `opts.model` = one of the built-in models: deluxe twin bassman ac30 dc30 plexi jcm800 jubilee recto markiic 5150 slo dumble orange uber vh4 friedman hiwatt jc120 svt b15 gk800 ad200 markbass acoustic.
`opts.models: [...]` = several channels (switch with the `channel` param); entries may be model names or voice objects.
`opts.voice` = a new amp built from a base model: `{base, stages:[[gain,headroom,bias,lpHz,hpHz],...], gainPos, tsPos, tsType (0 FMV, 1 Baxandall, 2 top-boost, 3 bass/James), stack: "fender"|"bassman"|"marshall"|"mesa"|"vox"|"orange"|"peavey"|[R1,R2,R3,R4,C1,C2,C3], tsMakeup, brightHz, brightDb, power (0 none, 1 push-pull, 2 class A, 3 solid state), pwrH, sag, presHz, depthHz, nfb, otLp, otHp, tight, inHp, baxBass, baxMid, baxTreble, baxRange, drive (scales all stage gains), dark (octaves to darken the stage filters)}`. The block self-calibrates its output level.

| param | default | range |
|---|---|---|
| `gain` | 0.5 | 0 … 1 |
| `bass` | 0.5 | 0 … 1 |
| `mid` | 0.5 | 0 … 1 |
| `treble` | 0.5 | 0 … 1 |
| `presence` | 0.5 | 0 … 1 |
| `depth` | 0.5 | 0 … 1 |
| `master` | 0.5 | 0 … 1 |
| `level` | 0 | -30 … 12 |
| `bright` | 0 | 0 … 1 |
| `channel` | 0 | 0 … 3 |
| `sag` | 0.5 | 0 … 1 |
| `midfreq` | 0.5 | 0 … 1 |
| `ultralo` | 0 | 0 … 1 |
| `ultrahi` | 0 | 0 … 1 |

## `boost`

Clean / treble / mid boost.

**opts:** `mode` param picks the voicing (0 clean, 1 treble, 2 mid, 3 fat).

| param | default | range |
|---|---|---|
| `gain` | 0.5 | 0 … 1 |
| `bass` | 0.5 | 0 … 1 |
| `treble` | 0.5 | 0 … 1 |
| `level` | 1 | 0 … 1 |
| `mode` | 0 | 0 … 3 |

## `cab`

Speaker cabinet with up to 4 microphones (any speaker, position, distance, angle, level, pan, polarity) – mixed into one IR per output, so extra mics cost no CPU.

**opts:** `opts.model` = built-in cab: 1x12us 2x12twin 4x10tweed 2x12blue 4x12gb 4x12v30 4x12t75 4x12uber 2x12cream 1x12open 4x12orange 2x12jc 8x10svt 4x10bass 1x15bass 2x10horn 4x12bass.
`opts.cab` = a new cab voicing: `{hp, hpQ, resDb (low resonance), lp (cone break-up Hz), lpQ, open (open back), peaks: [[f, q, db], ...], seed (speaker detail), detail (dB of fine ripple)}`; `opts.cabs: [...]` several (param `model`). Mic params are `m1on m1type m1pos m1dist m1spk m1lvl m1pan m1phase m1axis` … `m4*` (the CAB builder maps the draggable mics to these).

| param | default | range |
|---|---|---|
| `m1on` | 1 | 0 … 1 |
| `m1type` | 0 | 0 … 7 |
| `m1pos` | 0.3 | 0 … 1.3 |
| `m1dist` | 0.15 | 0 … 1 |
| `m1spk` | 0 | 0 … 7 |
| `m1lvl` | 0 | -40 … 6 |
| `m1pan` | 0 | -1 … 1 |
| `m1phase` | 0 | 0 … 1 |
| `m1axis` | 0 | 0 … 1 |
| `m2on` | 0 | 0 … 1 |
| `m2type` | 2 | 0 … 7 |
| `m2pos` | 0.5 | 0 … 1.3 |
| `m2dist` | 0.15 | 0 … 1 |
| `m2spk` | 0 | 0 … 7 |
| `m2lvl` | 0 | -40 … 6 |
| `m2pan` | 0 | -1 … 1 |
| `m2phase` | 0 | 0 … 1 |
| `m2axis` | 0 | 0 … 1 |
| `m3on` | 0 | 0 … 1 |
| `m3type` | 2 | 0 … 7 |
| `m3pos` | 0.5 | 0 … 1.3 |
| `m3dist` | 0.15 | 0 … 1 |
| `m3spk` | 0 | 0 … 7 |
| `m3lvl` | 0 | -40 … 6 |
| `m3pan` | 0 | -1 … 1 |
| `m3phase` | 0 | 0 … 1 |
| `m3axis` | 0 | 0 … 1 |
| `m4on` | 0 | 0 … 1 |
| `m4type` | 2 | 0 … 7 |
| `m4pos` | 0.5 | 0 … 1.3 |
| `m4dist` | 0.15 | 0 … 1 |
| `m4spk` | 0 | 0 … 7 |
| `m4lvl` | 0 | -40 … 6 |
| `m4pan` | 0 | -1 … 1 |
| `m4phase` | 0 | 0 … 1 |
| `m4axis` | 0 | 0 … 1 |
| `lowcut` | 30 | 20 … 500 |
| `highcut` | 14000 | 2000 … 20000 |
| `level` | 0 | -24 … 12 |
| `model` | 0 | 0 … 0 |

## `chain`

Composite block: several algorithms in series inside one pedal (dual pedals, multi-FX).

**opts:** `opts.chain: [{prefix, algo, opts, params, on}]` → params are exposed as `<prefix>.<param>` plus `<prefix>.on`.

| param | default | range |
|---|---|---|

## `chorus`

Chorus / vibrato / ensemble / dimension.

**opts:** `mode` 0 chorus, 1 vibrato, 2 3-voice ensemble, 3 dimension; `opts.baseMs`, `opts.depthMs`, `opts.invertR`.

| param | default | range |
|---|---|---|
| `rate` | 0.35 | 0 … 1 |
| `depth` | 0.5 | 0 … 1 |
| `mix` | 0.5 | 0 … 1 |
| `tone` | 0.5 | 0 … 1 |
| `delay` | 0.5 | 0 … 1 |
| `mode` | 0 | 0 … 3 |
| `feedback` | 0 | 0 … 1 |
| `wave` | 0 | 0 … 1 |
| `level` | 0.5 | 0 … 1 |

## `comp`

Compressor: OTA (Dyna Comp), VCA (studio), opto.

**opts:** `opts.type` = ota | vca | opto.

| param | default | range |
|---|---|---|
| `sustain` | 0.5 | 0 … 1 |
| `attack` | 0.3 | 0 … 1 |
| `release` | 0.4 | 0 … 1 |
| `level` | 0.5 | 0 … 1 |
| `tone` | 0.5 | 0 … 1 |
| `blend` | 1 | 0 … 1 |
| `ratio` | 0.5 | 0 … 1 |
| `knee` | 0.5 | 0 … 1 |

## `crusher`

Bit / sample-rate crusher.

| param | default | range |
|---|---|---|
| `bits` | 0.5 | 0 … 1 |
| `rate` | 0.3 | 0 … 1 |
| `mix` | 1 | 0 … 1 |

## `deco`

Tape saturation + doubletracker (Deco).

| param | default | range |
|---|---|---|
| `saturation` | 0.4 | 0 … 1 |
| `volume` | 0.5 | 0 … 1 |
| `tone` | 0.5 | 0 … 1 |
| `lag` | 0.3 | 0 … 1 |
| `blend` | 0.5 | 0 … 1 |
| `wobble` | 0.3 | 0 … 1 |
| `type` | 0 | 0 … 2 |
| `satOn` | 1 | 0 … 1 |
| `dtOn` | 1 | 0 … 1 |

## `delay`

Delay with 11 modes: 0 digital, 1 analog (BBD), 2 tape (multi-head `heads` bitmask), 3 lo-fi, 4 modulated, 5 reverse, 6 shimmer, 7 ping-pong, 8 dual, 9 warp (self-oscillating), 10 delay+reverb. Event 1 = tap, event 2 = hold/freeze.

**opts:** `opts.mode`, `opts.fixedMode`, `opts.maxMs`, `opts.defaultMs`.

| param | default | range |
|---|---|---|
| `time` | 400 | 10 … 3000 |
| `feedback` | 0.35 | 0 … 1.1 |
| `mix` | 0.35 | 0 … 1 |
| `tone` | 0.6 | 0 … 1 |
| `mode` | 0 | 0 … 10 |
| `modrate` | 0.3 | 0 … 1 |
| `moddepth` | 0 | 0 … 1 |
| `age` | 0.3 | 0 … 1 |
| `sat` | 0.3 | 0 … 1 |
| `subdiv` | 0 | 0 … 4 |
| `level` | 0.5 | 0 … 1 |
| `heads` | 4 | 1 … 7 |
| `spread` | 0.5 | 0 … 1 |
| `lowcut` | 0 | 0 … 1 |

## `di`

DI box (instrument → mic level, pad, polarity, low cut, speaker sim) or re-amp box (`opts.reamp: true`).

| param | default | range |
|---|---|---|
| `pad` | 0 | 0 … 2 |
| `lift` | 0 | 0 … 1 |
| `invert` | 0 | 0 … 1 |
| `lowcut` | 20 | 20 … 300 |
| `level` | 0 | -24 … 24 |
| `speaker` | 0 | 0 … 1 |

## `drive`

Overdrive / distortion / fuzz / boost circuit model.

**opts:** `opts` is a *voicing* (all optional): `clip` = ts | diode | asym | opamp | ge | si | muff | led | jfet | tube | mosfet | clean;
`tone` = none | lp | ts | blend | rat | eq3 | tilt | hm2 | mt2; `gainMinDb`, `gainMaxDb` (gain knob range), `preHp`, `clipHp`, `clipLp`, `postLp` (Hz),
`cleanSum` + `cleanMix` (Klon / TS-style clean blend), `toneLo`, `toneHi` (lp tone range), `blendLp`, `blendHp` (blend tone), `bassF`, `midF`, `midQ`, `trebleF`, `hiMidF`, `useHiMid`, `midMin`, `midMax`, `eqRangeDb` (eq3 / tilt),
`levelMinDb`, `levelMaxDb`, `bias` (asymmetry), `stages` (1-3 cascaded clippers), `stage2Db`, `slew` (op-amp slew limiting), `outTrim`,
`preEq` / `postEq`: `[{type: peak|lp|hp|bp|notch|ls|hs, f, q, db}]`, `modes`: array of partial voicings selected by the `mode` param (e.g. a 3-way clipping switch).

| param | default | range |
|---|---|---|
| `gain` | 0.5 | 0 … 1 |
| `tone` | 0.5 | 0 … 1 |
| `level` | 0.5 | 0 … 1 |
| `bass` | 0.5 | 0 … 1 |
| `mid` | 0.5 | 0 … 1 |
| `treble` | 0.5 | 0 … 1 |
| `midfreq` | 0.5 | 0 … 1 |
| `blend` | 1 | 0 … 1 |
| `mode` | 0 | 0 … 7 |
| `bright` | 0 | 0 … 1 |
| `himid` | 0.5 | 0 … 1 |
| `sag` | 0 | 0 … 1 |

## `extio`

External device I/O: block inputs go to new PipeWire ports `<name>_to_k`, block outputs come from `<name>_from_k`; auto-connected to device ports matching `opts.capture` / `opts.playback` (regex).

**opts:** `opts: {name, capture, playback}`

| param | default | range |
|---|---|---|
| `send` | 0 | -40 … 12 |
| `return` | 0 | -40 … 12 |

## `flanger`

Flanger (standard / ultra / gate / through-zero).

| param | default | range |
|---|---|---|
| `manual` | 0.5 | 0 … 1 |
| `width` | 0.6 | 0 … 1 |
| `speed` | 0.3 | 0 … 1 |
| `regen` | 0.6 | 0 … 1 |
| `mix` | 0.5 | 0 … 1 |
| `mode` | 0 | 0 … 3 |

## `freeze`

Spectral freeze / sustainer (event 1 = freeze / toggle, event 2 = release). `mode` 0 latch, 1 momentary, 2 auto (every new note).

| param | default | range |
|---|---|---|
| `mode` | 0 | 0 … 2 |
| `decay` | 1 | 0 … 1 |
| `mix` | 0.7 | 0 … 1 |
| `level` | 0 | -24 … 12 |
| `layer` | 0 | 0 … 1 |
| `speed` | 0.3 | 0 … 1 |
| `tone` | 1 | 0 … 1 |
| `dry` | 1 | 0 … 1 |

## `gate`

Noise gate / suppressor (with optional key input for NS-2 style send/return).

| param | default | range |
|---|---|---|
| `threshold` | 0.4 | 0 … 1 |
| `decay` | 0.4 | 0 … 1 |
| `mode` | 0 | 0 … 1 |
| `attack` | 0.1 | 0 … 1 |
| `range` | 1 | 0 … 1 |

## `geq`

Graphic EQ.

**opts:** `opts.freqs: [Hz,...]` (bands become params b0, b1 …), `opts.q`.

| param | default | range |
|---|---|---|
| `b0` | 0 | -15 … 15 |
| `b1` | 0 | -15 … 15 |
| `b2` | 0 | -15 … 15 |
| `b3` | 0 | -15 … 15 |
| `b4` | 0 | -15 … 15 |
| `b5` | 0 | -15 … 15 |
| `b6` | 0 | -15 … 15 |
| `level` | 0 | -15 … 15 |
| `gain` | 0 | -15 … 15 |

## `ir`

Impulse-response loader (user IR packs).

**opts:** `opts.files: [paths]`, `model` param selects.

| param | default | range |
|---|---|---|
| `model` | 0 | 0 … 0 |
| `mix` | 1 | 0 … 1 |
| `lowcut` | 20 | 20 … 500 |
| `highcut` | 20000 | 2000 … 20000 |
| `level` | 0 | -24 … 12 |

## `lofi`

Lo-fi: 0 cassette, 1 vinyl, 2 AM radio, 3 telephone, 4 sampler (bits / rate).

| param | default | range |
|---|---|---|
| `mode` | 0 | 0 … 4 |
| `wow` | 0.3 | 0 … 1 |
| `flutter` | 0.3 | 0 … 1 |
| `age` | 0.4 | 0 … 1 |
| `noise` | 0.2 | 0 … 1 |
| `mix` | 1 | 0 … 1 |
| `level` | 0 | -24 … 12 |
| `saturate` | 0.3 | 0 … 1 |
| `bits` | 0.7 | 0 … 1 |
| `rate` | 0.7 | 0 … 1 |

## `looper`

Multi-track looper with rhythm patterns (RC-500 / RC-600 style).

**opts:** `opts.tracks`, `opts.maxSec`.

| param | default | range |
|---|---|---|
| `level1` | 0.8 | 0 … 1 |
| `pan1` | 0 | -1 … 1 |
| `level2` | 0.8 | 0 … 1 |
| `pan2` | 0 | -1 … 1 |
| `rhythm` | 0 | 0 … 1 |
| `rhythmLevel` | 0.5 | 0 … 1 |
| `tempo` | 100 | 40 … 250 |
| `pattern` | 0 | 0 … 9 |
| `sync` | 1 | 0 … 1 |
| `recAction` | 0 | 0 … 1 |
| `dubLevel` | 1 | 0 … 1 |
| `master` | 0.8 | 0 … 1 |
| `input` | 1 | 0 … 1 |
| `current` | 0 | 0 … 7 |

## `merge`

N → 1/2 mixer (per-input gain, mute, polarity, pan).

| param | default | range |
|---|---|---|
| `g1` | 0 | -60 … 12 |
| `m1` | 0 | 0 … 1 |
| `inv1` | 0 | 0 … 1 |
| `pan1` | 0 | -1 … 1 |
| `g2` | 0 | -60 … 12 |
| `m2` | 0 | 0 … 1 |
| `inv2` | 0 | 0 … 1 |
| `pan2` | 0 | -1 … 1 |
| `g3` | 0 | -60 … 12 |
| `m3` | 0 | 0 … 1 |
| `inv3` | 0 | 0 … 1 |
| `pan3` | 0 | -1 … 1 |
| `g4` | 0 | -60 … 12 |
| `m4` | 0 | 0 … 1 |
| `inv4` | 0 | 0 … 1 |
| `pan4` | 0 | -1 … 1 |
| `g5` | 0 | -60 … 12 |
| `m5` | 0 | 0 … 1 |
| `inv5` | 0 | 0 … 1 |
| `pan5` | 0 | -1 … 1 |
| `g6` | 0 | -60 … 12 |
| `m6` | 0 | 0 … 1 |
| `inv6` | 0 | 0 … 1 |
| `pan6` | 0 | -1 … 1 |
| `g7` | 0 | -60 … 12 |
| `m7` | 0 | 0 … 1 |
| `inv7` | 0 | 0 … 1 |
| `pan7` | 0 | -1 … 1 |
| `g8` | 0 | -60 … 12 |
| `m8` | 0 | 0 … 1 |
| `inv8` | 0 | 0 … 1 |
| `pan8` | 0 | -1 … 1 |
| `level` | 0 | -60 … 12 |

## `meter`

Pass-through stereo level meter (status `meter`: [[peak, rms, clip], …]).

| param | default | range |
|---|---|---|
| `release` | 0.5 | 0 … 1 |

## `nam`

Neural Amp Modeler (A1 / A2 / LSTM) player.

**opts:** `opts.files: [paths]`.

| param | default | range |
|---|---|---|
| `model` | 0 | 0 … 0 |
| `input` | 0 | -24 … 24 |
| `output` | 0 | -24 … 24 |
| `bass` | 0.5 | 0 … 1 |
| `mid` | 0.5 | 0 … 1 |
| `treble` | 0.5 | 0 … 1 |
| `normalize` | 1 | 0 … 1 |
| `size` | -1 | -1 … 1 |
| `gate` | 0 | 0 … 1 |

## `pareq`

6-band studio parametric EQ, switchable HPF / LPF, band listen and a spectrum analyser (status `spec`).

**opts:** Band types: 0 peak, 1 low shelf, 2 high shelf, 3 notch, 4 band-pass, 5 tilt.

| param | default | range |
|---|---|---|
| `b1on` | 1 | 0 … 1 |
| `b1type` | 1 | 0 … 5 |
| `b1f` | 80 | 20 … 20000 |
| `b1g` | 0 | -18 … 18 |
| `b1q` | 0.9 | 0.1 … 18 |
| `b2on` | 1 | 0 … 1 |
| `b2type` | 0 | 0 … 5 |
| `b2f` | 250 | 20 … 20000 |
| `b2g` | 0 | -18 … 18 |
| `b2q` | 0.9 | 0.1 … 18 |
| `b3on` | 1 | 0 … 1 |
| `b3type` | 0 | 0 … 5 |
| `b3f` | 800 | 20 … 20000 |
| `b3g` | 0 | -18 … 18 |
| `b3q` | 0.9 | 0.1 … 18 |
| `b4on` | 1 | 0 … 1 |
| `b4type` | 0 | 0 … 5 |
| `b4f` | 2500 | 20 … 20000 |
| `b4g` | 0 | -18 … 18 |
| `b4q` | 0.9 | 0.1 … 18 |
| `b5on` | 1 | 0 … 1 |
| `b5type` | 0 | 0 … 5 |
| `b5f` | 6000 | 20 … 20000 |
| `b5g` | 0 | -18 … 18 |
| `b5q` | 0.9 | 0.1 … 18 |
| `b6on` | 1 | 0 … 1 |
| `b6type` | 2 | 0 … 5 |
| `b6f` | 12000 | 20 … 20000 |
| `b6g` | 0 | -18 … 18 |
| `b6q` | 0.9 | 0.1 … 18 |
| `hpon` | 0 | 0 … 1 |
| `hpf` | 80 | 20 … 2000 |
| `hps` | 1 | 0 … 3 |
| `lpon` | 0 | 0 … 1 |
| `lpf` | 9000 | 500 … 20000 |
| `lps` | 1 | 0 … 3 |
| `listen` | 0 | 0 … 1 |
| `listenf` | 1000 | 20 … 20000 |
| `listenq` | 2 | 0.3 … 12 |
| `level` | 0 | -24 … 12 |
| `spectrum` | 1 | 0 … 1 |
| `specpost` | 1 | 0 … 1 |

## `peq`

3-band parametric EQ with shelves and cuts.

| param | default | range |
|---|---|---|
| `lowcut` | 20 | 20 … 1000 |
| `highcut` | 20000 | 1000 … 20000 |
| `lowfreq` | 100 | 30 … 500 |
| `lowgain` | 0 | -18 … 18 |
| `mid1freq` | 500 | 100 … 4000 |
| `mid1gain` | 0 | -18 … 18 |
| `mid1q` | 1 | 0.2 … 8 |
| `mid2freq` | 2000 | 300 … 10000 |
| `mid2gain` | 0 | -18 … 18 |
| `mid2q` | 1 | 0.2 … 8 |
| `highfreq` | 5000 | 1000 … 16000 |
| `highgain` | 0 | -18 … 18 |
| `level` | 0 | -18 … 18 |

## `phaser`

Phaser (2–12 stages, script / block logo modes).

**opts:** `opts.stages`, `opts.style`.

| param | default | range |
|---|---|---|
| `rate` | 0.35 | 0 … 1 |
| `depth` | 0.8 | 0 … 1 |
| `feedback` | 0.4 | 0 … 1 |
| `mix` | 0.5 | 0 … 1 |
| `stages` | 4 | 2 … 12 |
| `center` | 0.5 | 0 … 1 |
| `script` | 0 | 0 … 1 |

## `pitch`

Polyphonic pitch shifter (WSOLA): drop tune, octaves, whammy, harmonies; `scale` > 0 = intelligent diatonic harmony using `key`, `deg1`, `deg2` (scale steps).

**opts:** `opts.semis1`, `opts.level1`, … initial values.

| param | default | range |
|---|---|---|
| `key` | 0 | 0 … 11 |
| `scale` | 0 | 0 … 7 |
| `deg1` | 2 | -14 … 14 |
| `deg2` | 4 | -14 … 14 |
| `semis1` | -2 | -24 … 24 |
| `level1` | 1 | 0 … 1 |
| `semis2` | -12 | -24 … 24 |
| `level2` | 0 | 0 … 1 |
| `dry` | 0 | 0 … 1 |
| `cents` | 0 | -50 … 50 |
| `quality` | 1 | 0 … 2 |
| `expr` | 1 | 0 … 1 |
| `glide` | 0.1 | 0 … 1 |
| `vintage` | 0 | 0 … 1 |
| `tone` | 1 | 0 … 1 |
| `range` | 0 | 0 … 1 |

## `reverb`

Algorithmic reverb with 10 modes: 0 room, 1 hall, 2 plate, 3 spring, 4 shimmer, 5 cloud, 6 modulated, 7 dynamic (ducking), 8 +delay, 9 swell.

**opts:** `opts.mode`, `opts.fixedMode`.

| param | default | range |
|---|---|---|
| `decay` | 0.5 | 0 … 1 |
| `mix` | 0.35 | 0 … 1 |
| `tone` | 0.6 | 0 … 1 |
| `lowcut` | 0.15 | 0 … 1 |
| `predelay` | 20 | 0 … 500 |
| `mod` | 0.3 | 0 … 1 |
| `mode` | 1 | 0 … 9 |
| `level` | 0.5 | 0 … 1 |
| `shimmer` | 0.5 | 0 … 1 |
| `size` | 0.5 | 0 … 1 |
| `diffusion` | 0.7 | 0 … 1 |
| `highdamp` | 0.5 | 0 … 1 |
| `lowdamp` | 0.5 | 0 … 1 |
| `ensemble` | 0 | 0 … 1 |

## `ringmod`

Ring modulator.

| param | default | range |
|---|---|---|
| `freq` | 0.4 | 0 … 1 |
| `mix` | 0.5 | 0 … 1 |
| `fine` | 0.5 | 0 … 1 |

## `rotary`

Rotary speaker (horn + drum, slow / fast with acceleration).

| param | default | range |
|---|---|---|
| `speed` | 0 | 0 … 1 |
| `drive` | 0.2 | 0 … 1 |
| `balance` | 0.5 | 0 … 1 |
| `mix` | 1 | 0 … 1 |
| `accel` | 0.5 | 0 … 1 |
| `level` | 0.5 | 0 … 1 |

## `select`

Output selector: stereo in → one of N stereo output pairs (`sel`), or several at once (`mode` 1, bitmask `mask`).

| param | default | range |
|---|---|---|
| `sel` | 0 | 0 … 7 |
| `mode` | 0 | 0 … 1 |
| `mask` | 1 | 0 … 255 |
| `fade` | 12 | 1 … 200 |

## `slicer`

Rhythmic gate / stutter (16 patterns, tap tempo via event 1).

| param | default | range |
|---|---|---|
| `time` | 125 | 30 … 1000 |
| `pattern` | 1 | 0 … 15 |
| `depth` | 1 | 0 … 1 |
| `smooth` | 0.2 | 0 … 1 |
| `mix` | 1 | 0 … 1 |
| `mode` | 0 | 0 … 1 |
| `level` | 0 | -24 … 12 |
| `steps` | 16 | 2 … 16 |

## `split`

1 → N splitter (per-output gain `g1..g8`, mute `m*`, polarity `inv*`).

| param | default | range |
|---|---|---|
| `g1` | 0 | -60 … 12 |
| `m1` | 0 | 0 … 1 |
| `inv1` | 0 | 0 … 1 |
| `g2` | 0 | -60 … 12 |
| `m2` | 0 | 0 … 1 |
| `inv2` | 0 | 0 … 1 |
| `g3` | 0 | -60 … 12 |
| `m3` | 0 | 0 … 1 |
| `inv3` | 0 | 0 … 1 |
| `g4` | 0 | -60 … 12 |
| `m4` | 0 | 0 … 1 |
| `inv4` | 0 | 0 … 1 |
| `g5` | 0 | -60 … 12 |
| `m5` | 0 | 0 … 1 |
| `inv5` | 0 | 0 … 1 |
| `g6` | 0 | -60 … 12 |
| `m6` | 0 | 0 … 1 |
| `inv6` | 0 | 0 … 1 |
| `g7` | 0 | -60 … 12 |
| `m7` | 0 | 0 … 1 |
| `inv7` | 0 | 0 … 1 |
| `g8` | 0 | -60 … 12 |
| `m8` | 0 | 0 … 1 |
| `inv8` | 0 | 0 … 1 |
| `level` | 0 | -60 … 12 |

## `stereo`

Stereo tool: 0 M/S width, 1 Haas, 2 dual-voice widener, 3 auto-pan, 4 mono sum, 5 swap, 6 balance / pan; optional mono bass.

| param | default | range |
|---|---|---|
| `mode` | 0 | 0 … 6 |
| `width` | 0.6 | 0 … 1 |
| `time` | 12 | 1 … 40 |
| `pan` | 0 | -1 … 1 |
| `rate` | 0.3 | 0 … 1 |
| `depth` | 0.5 | 0 … 1 |
| `monobass` | 20 | 20 … 400 |
| `level` | 0 | -24 … 12 |
| `invR` | 0 | 0 … 1 |

## `swell`

Auto-swell / slow gear (fades every note in).

| param | default | range |
|---|---|---|
| `sens` | 0.5 | 0 … 1 |
| `attack` | 0.4 | 0 … 1 |
| `level` | 0 | -24 … 12 |
| `mode` | 0 | 0 … 1 |

## `synth`

Guitar synthesizer: 0 square lead, 1 saw lead, 2 organ, 3 strings, 4 brass, 5 sub bass, 6 pad, 7 filter sweep.

| param | default | range |
|---|---|---|
| `mode` | 0 | 0 … 7 |
| `attack` | 0.2 | 0 … 1 |
| `filter` | 0.5 | 0 … 1 |
| `reso` | 0.4 | 0 … 1 |
| `sens` | 0.5 | 0 … 1 |
| `octave` | 0 | -2 … 1 |
| `dry` | 0 | 0 … 1 |
| `wet` | 0.8 | 0 … 1 |
| `level` | 0 | -24 … 12 |
| `mod` | 0.3 | 0 … 1 |
| `decay` | 0.6 | 0 … 1 |

## `talkbox`

Talk box (vowel formant filter, treadle or picking dynamics).

| param | default | range |
|---|---|---|
| `pos` | 0.5 | 0 … 1 |
| `tone` | 0.5 | 0 … 1 |
| `volume` | 0.5 | 0 … 1 |
| `mode` | 0 | 0 … 1 |
| `sens` | 0.5 | 0 … 1 |

## `thru`

Plain pass-through (placeholder for unavailable blocks; adapters).

| param | default | range |
|---|---|---|

## `tremolo`

Tremolo: opto / harmonic / bias, optional stereo auto-pan.

| param | default | range |
|---|---|---|
| `rate` | 0.4 | 0 … 1 |
| `depth` | 0.6 | 0 … 1 |
| `wave` | 0.3 | 0 … 1 |
| `mode` | 0 | 0 … 2 |
| `level` | 0.5 | 0 … 1 |
| `stereo` | 0 | 0 … 1 |

## `tuner`

Chromatic / strobe / polyphonic tuner (status `tuner`). Output 0 mutes while tuning (if `mute`), output 1 is an always-on thru.

| param | default | range |
|---|---|---|
| `mute` | 1 | 0 … 1 |
| `calib` | 440 | 425 … 455 |
| `mode` | 0 | 0 … 3 |
| `tuning` | 0 | 0 … 11 |
| `alwaysOn` | 0 | 0 … 1 |
| `range` | 2 | 0 … 2 |

## `utility`

Small mixer utilities.

**opts:** `opts.kind` = split | merge | gain | pan | width | sum.

| param | default | range |
|---|---|---|
| `level` | 0 | -60 … 24 |
| `pan` | 0 | -1 … 1 |
| `width` | 1 | 0 … 2 |
| `invert` | 0 | 0 … 1 |
| `select` | 2 | 0 … 2 |
| `levelB` | 0 | -60 … 24 |

## `vibe`

Uni-vibe style photocell phaser (chorus / vibrato).

| param | default | range |
|---|---|---|
| `speed` | 0.4 | 0 … 1 |
| `intensity` | 0.7 | 0 … 1 |
| `mode` | 0 | 0 … 1 |
| `level` | 0.5 | 0 … 1 |
| `tone` | 0.6 | 0 … 1 |
| `drive` | 0.2 | 0 … 1 |

## `volume`

Volume pedal (linear / audio taper, minimum volume).

| param | default | range |
|---|---|---|
| `pos` | 1 | 0 … 1 |
| `min` | 0 | 0 … 1 |
| `taper` | 1 | 0 … 1 |

## `wah`

Wah / auto-wah / envelope filter.

**opts:** `mode` 0 treadle, 1 LFO, 2 envelope; `filter` 0 LP, 1 BP, 2 HP; `opts.fLo`, `opts.fHi`, `opts.q`.

| param | default | range |
|---|---|---|
| `pos` | 0.5 | 0 … 1 |
| `q` | 0.5 | 0 … 1 |
| `mode` | 0 | 0 … 2 |
| `rate` | 0.4 | 0 … 1 |
| `sens` | 0.5 | 0 … 1 |
| `level` | 0.5 | 0 … 1 |
| `range` | 0.5 | 0 … 1 |
| `filter` | 1 | 0 … 2 |
| `direction` | 0 | 0 … 1 |
