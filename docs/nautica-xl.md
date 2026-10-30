# Nautica XL (tz.nautica)

The flagship Tone Zone floor processor. The built-in block is native: its audio runs in the engine's `rig`
algorithm and its screens are JavaScript (no Lua). This page lists its structure so a Pedal Factory template can
mirror it.

Files: `app/renderer/js/catalog/nautica.js` (models, presets, state, engine graph, derive, definition),
`app/renderer/js/screens-nautica.js` (screens and switch logic), `app/renderer/js/gfx/forms-nautica.js`
(enclosure), `engine/src/blocks/rig.cpp` (engine), `app/scripts/nautica-test.js` (test).

## Enclosure (1260 x 620)

| area | contents |
|---|---|
| rear rail | 30 jacks along the top edge, a bar LED under each one (`nxl-io` screen) |
| left panel | MASTER (large), PHONES and XLR volume dials; 10 shortcut buttons with LEDs: LIBRARY, AMP, PRESETS, SCENES, LOOPER, TUNER, ASSIGN, I/O, GLOBAL, MUTE |
| centre | two strip screens (560 x 22), the main touch screen (560 x 250), 10 dials under it |
| right of the main screen | portrait side screen (138 x 306): HOME, BACK, SAVE, UP, DOWN, two LED-ring encoders, XY pad, two sliders, a select encoder (push = enter) |
| floor | MODE and TAP / TUNER footswitches, 14 assignable footswitches (2 rows of 7) each with an LCD (84 x 22) |
| right | logo, then for each treadle: a footswitch with its LCD, a pedal LCD (116 x 24, value + target) and a full-size treadle (EXP 1, EXP 2, side by side) |

## Jacks

| key | label | kind | engine channels |
|---|---|---|---|
| i0 | GUITAR IN | 1/4" | 0 |
| i1 | AUX IN | TRS stereo | 1, 2 |
| i2 to i5 | RETURN 1 to 4 | 1/4" | 3 to 6 |
| o0, o1 | STEREO OUT 1, 2 | TRS stereo | 0-1, 2-3 |
| o2 to o9 | OUT 1 L, OUT 1 R ... OUT 4 R | 1/4" | 4 to 11 |
| o10 | PHONES | headphone | 12, 13 |
| o11 | XLR OUT | XLR (mono) | 14 |
| o12 to o15 | SEND 1 to 4 | 1/4" | 15 to 18 |
| ic0 to ic3 | EXT FS 1 to 4 | control in | param `_xfs1..4` |
| ic4, ic5 | EXT EXP 1, 2 | control in | param `_xexp1..2` |
| oc0 | EXT FS OUT | control out | driven by the unit (see Control outputs) |
| oc1 | EXT EXP OUT | control out | param `_xeo` |

The def lists `loopReturns: [2, 3, 4, 5]`: a cable SEND -> pedals -> RETURN on the same unit is an FX loop, not a
feedback loop. Returns read the previous engine cycle when the loop goes through other blocks.

## Signal flow

```
GUITAR (gain) ──┬─ pre: tuner (mutes) → noise gate → volume pedal (pre) ─┐
AUX (gain) ─────┘ (AUX TO: nowhere / input / path A / path B / main)     │
        SERIAL:   A1..A8 → B1..B8                                         │
        PARALLEL: A1..A8 and B1..B8 from the same input, mixed (level, pan)
        DUAL:     A from GUITAR, B from AUX, mixed
→ post: volume pedal (post) → looper (120 s) → MAIN
outputs: STEREO 1, STEREO 2, OUT 1-4, PHONES, XLR each pick MAIN / PATH A / PATH B / DRY DI / OFF, a level,
whether MASTER applies (PHONES and XLR have their own dials) and, for XLR, SUM / LEFT / RIGHT
```

Any slot can hold an FX loop block (FX Loop 1-4, Stereo Loop 1+2, 3+4): SEND level, RETURN level, MIX. A send can
only be used by one block. With nothing in the return, the send comes straight back.

Engine params (`rig`): `route`, `aLvl`, `bLvl`, `aPan`, `bPan`, `gtr`, `aux`, `auxTo`, `o<j>.src`, `o<j>.lvl`,
`o<j>.mono` (j = 0 STEREO 1 ... 7 XLR), and `<slot>.<param>` / `<slot>.on` for each loaded slot (slots are named
A1..B8), `tu.*`, `gate.*`, `pv.*`, `vol.*`, `lp.*`. The status has `io: {in: [peak per input channel], out: [...]}`.

## Blocks

14 colour-coded types: DRIVE, AMP, CAB, NAM & IR (the user's packs), DYNAMICS, EQ, MODULATION, FILTER & WAH, PITCH,
DELAY, REVERB, SYNTH & FX, UTILITY, FX LOOP. The library shares the Atlas models and adds wahs, synth, freeze,
swell, lo-fi, acoustic sim, stereo tools, gain, volume and the loops. Each block has up to 11 parameters (pages of
10 on the dials and the touch screen).

## State (`_st`, JSON)

`{ ver, pi, name, mode, slots: {A1: {m, on, v: [...]}}, route, mix: {a, b, ap, bp}, scenes: [8 x {on, v}], sc,
scn: [8 names], fs: [20 assignments], exp: [4 assignments], eon: [4], side: {e1, e2, x, y, s1, s2}, user: {pi:
preset}, g: {bpm, sync, ref, theme, strip: [2], fsB, dmode, tapLed, gate, volPos, lpLvl, gtr, aux, auxTo, outs:
[8 x {src, lvl, m, mono}], xfo, xeo, xlrLift, encSens} }`

* Presets: 4 banks of 7 (A1..D7); 14 factory presets, the rest start as an empty rig. SAVE stores into `user`.
* Scenes: 8 per preset, each a snapshot of every block's on/off and values; edits go into the current scene.

## Footswitches

Index 0-13 floor, 14-15 above the treadles, 16-19 EXT FS jacks. Assignments: `auto` (floor: the n-th loaded block;
treadle switches: that pedal on/off), `none`, `blk` (block on/off), `scn`, `pup` / `pdn` (preset), `bup` / `bdn`
(bank), `tap`, `tun`, `mode`, `lpr` (looper: REC/DUB, PLAY/STOP, UNDO, REVERSE, STOP, CLEAR), `expb` (pedal on/off;
for a wah it switches the wah block), `par` (toggle a parameter min / max), `xfs` (pulse EXT FS OUT).

Modes (MODE switch): STOMP (assignments), SCENE (FS 1-8 = scenes), PRESET (FS 1-7 = presets of the bank, FS 8 / 14 =
bank down / up, FS 9-13 = scenes 1-5), LOOPER (FS 1-6 looper, FS 7 exit). Hold TAP = tuner.
Each LCD shows the switch number, a sub line (slot and type, scene number...) and the function, lit in its colour.

## Pedals and side controls

* EXP 1 / EXP 2 treadles and EXT EXP 1 / 2: `auto` (EXP 1: first wah, else the volume pedal; EXP 2: first delay or
  reverb MIX), `none`, `vol`, `par` (any parameter, heel..toe). A pedal moves its parameter once it has moved since
  the preset loaded.
* Side controls (`auto` follows the focused block): ENC 1 = focused parameter, ENC 2 = MIX / LEVEL, XY = parameters
  1 and 2, sliders = path A / B level by default. Any can be assigned to any parameter or path level.

## Control outputs

* EXT FS OUT (`g.xfo`): ASSIGNED SWITCH (switches assigned to `xfs`), TEMPO PULSE, TUNER ON, LOOPER RUNNING,
  SCENE 2+ ACTIVE, EXP 1 ON, EXP 2 ON. Sent as presses (1 / 0).
* EXT EXP OUT (`g.xeo`): EXP 1, EXP 2, EXT EXP 1, EXT EXP 2, XY X, XY Y, SLIDER 1, SLIDER 2, MASTER VOL.

## Screens

* Main (touch): header (preset, scene, page, mode, tempo; tap to jump). Pages: SIGNAL CHAIN (2 x 8 grid, tap =
  select, tap again = open, drag onto another slot = move, ROUTE chip, 10 parameter cells), BLOCK (10 touch dials,
  drag / wheel, ON, MODEL, TO EXP 1 / 2, pages), LIBRARY (types + models), SCENES, PRESETS (banks, SAVE HERE, LOAD),
  LOOPER, TUNER, ASSIGN (+ picker), I/O ROUTING, GLOBAL. Swipe left / right changes parameter pages, library types
  and banks.
* Strips: PRESET & SCENE, LEVELS, FOCUSED BLOCK, TEMPO & TUNER, PEDALS, SIGNAL PATH; the menu button on the right end
  picks the content.
* I/O bars: brightness from the jack's level (audio peak, or the control value for control jacks), red on clipping.
