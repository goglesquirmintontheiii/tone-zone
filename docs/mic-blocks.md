# Mic blocks

Since v0.11 the microphones on a speaker cab are blocks of their own. Each mic model (inspired by a real mic) is a
catalog entry in the **Mics** list of the block library. Drag one onto a cab and it stands where you dropped it.

## Contract changes

Changes to the contract below since it was first written (all backwards compatible):

* Build mic defs with `tz.builders.mic({...})`. It fills in what a catalog entry needs (category, form, no audio,
  no ports, no controls). A plain object without `controls` would break the catalog.
* `ref` is just the real mic's name (`'Shure SM57'`). The list already says "Inspired by". The builder strips a
  leading "Inspired by (the)" anyway.
* New optional `mic.short`: the short name used on the cab's output jack (`MIC 2 421`) and the mic's tag on the
  cab. Default: the first word of the name.
* `look` has a documented schema for the core drawing (see Looks), and `tz.builders.micLook(kind, fn)` adds a
  drawing kind of your own (removed again when the plugin is disabled).
* Core ships ten models (see Core models). Plugins must not reuse their ids.

## Using mics

* **Add**: drag a mic from the Mics list onto a cab. It lands where you dropped it. Dropping a mic anywhere else does
  nothing but show a hint. Double-clicking a mic in the list puts it on the selected cab.
* **Move**: drag the mic over the speakers like before: which speaker, dust cap, cap edge, cone, past the cone edge.
  Scroll on a mic to change its distance (bigger = closer). The angle tilts the drawing.
* **Select**: click a mic. The inspector highlights its card.
* **Swap**: drop another mic onto an existing one (it keeps the position, distance and angle), pick a model in the
  inspector, Shift-click the mic for the next model, or right-click it.
* **Remove**: right-click > Remove mic, or click it and press Delete. A cab keeps at least one mic.
* **Settings** (cab inspector, Microphones): model, distance (1 to 31 cm), angle (on axis to 45 degrees off), level,
  pan (stereo cabs: placement in the MIX L / MIX R pair), polarity. Below them: the cabinet's low cut, high cut and
  level.
* A new cab starts with one Fifty-Seven (SM57 inspired). Up to 8 mics per cab.

## Output jacks

Every mic has its own output jack on the cab, labelled with its number and model (`MIC 2 121`), so each mic can go
to its own amp, effect or interface output. The blend of all mics stays available:

| Cab | Jacks |
| --- | --- |
| mono, 1 mic | `MIC 1 57` (that mic) |
| mono, 2 or more mics | `MIX` (all mics blended, as before), then `MIC 1 ...`, `MIC 2 ...` |
| stereo | `MIX L`, `MIX R` (the mics panned, as before), then one jack per mic |

Port 0 (and 1 on a stereo cab) is always the blend, so cables from older presets keep the same signal. When mics come
and go, the cables on the other jacks move with their mic. A cable on a mic's own jack moves to the single jack when
only that mic is left; a cable on a removed mic's jack is unplugged. Mono / stereo switching keeps the cables too.

A mic's own output has that mic only (its level and polarity apply, its pan doesn't). The blend works as in v0.10: each
mic's level, polarity and (stereo) pan, then a gain that keeps the cab about as loud as its loudest mic.

## Migration (old presets sound the same)

Presets, custom blocks and designs from before v0.11 store `m<i>on`, `m<i>type` (0 to 7) and positions. Nothing is
rewritten on load: a slot without `m<i>model` takes the core model for its old type:

| Old type | Model | id |
| --- | --- | --- |
| 0 Dynamic 57 | Fifty-Seven | `mics.dyn57` |
| 1 Condenser 414 | Four-Fourteen | `mics.c414` |
| 2 Ribbon 121 | One-Twenty-One | `mics.r121` |
| 3 Dynamic 421 | Four-Twenty-One | `mics.md421` |
| 4 Dynamic 906 | Nine-Oh-Six | `mics.e906` |
| 5 Dynamic 441 | Four-Forty-One | `mics.md441` |
| 6 Condenser 87 | Eighty-Seven | `mics.u87` |
| 7 Ribbon 160 | One-Sixty | `mics.m160` |

These eight models carry `legacy: <type>`: the engine renders them with the exact v0.10 voicing (bit for bit, checked
with the full preset check). Their `resp` curves describe the real mics for reference and for plugin authors. The
`MIX` / `MIX L` / `MIX R` outputs are the old outputs, so old cables, old presets and saved designs render the same.
Their sens is 0 (the v0.10 blend levels). New in the jack list are the per-mic outputs (they cost nothing until a
cable is plugged in).

The cab's engine block still takes the old params, and a cab inside a chain (multi-effects units, amp + cab blocks)
without mic data works exactly as before.

## Presets (scripts/build-presets.js specs)

A cab item in a preset spec can list its mics:

```js
['tz.cab-monolith', {
  mics: [
    { model: 'mics.dyn57', at: 'cap-edge', dist: 0.1 },
    { model: 'mics.r121', at: 'cone', spk: 1, dist: 0.2, lvl: -3 },
    { model: 'mics.u87', at: { x: 0.5, y: 0.5 }, dist: 0.9, axis: 0.3, phase: 0, pan: 0 },
  ],
}]
```

* `model`: any mic model id (core or plugin).
* `at`: a named spot on a speaker: `'cap'` (dust cap centre), `'cap-edge'`, `'cone'`, `'edge'` (cone edge), `'off'`
  (past the edge), a number (0 = centre, 1 = cone edge), or `{ x, y }` over the grille (0..1).
* `spk`: the speaker for a named spot (0 = top left; default: mic 1 on speaker 0, mic 2 on speaker 1, ...).
  Named spots alternate to the right and left of the centre so mics on one speaker don't overlap.
* `dist` 0..1 (1 to 31 cm, default 0.15), `axis` 0..1 (0 to 45 degrees), `lvl` dB, `phase` 0 / 1, `pan` -1..1.
* The old keys still work: `mic1` / `mic2` (old type numbers, mic 2 on the next speaker at `mic2lvl`, default -3 dB).

Wiring: by default the spec's cable from the cab uses port 0, the blend of all its mics. To send a mic to its own
place, cable from its port: mono cab with 2+ mics: port 1 = mic 1, port 2 = mic 2, ...; stereo cab: port 2 = mic 1.

The helper is `applyMicSpec(block, def, spec)` in `app/renderer/js/catalog/cabmics.js`.

## The mic model contract (for plugin authors)

A mic model is a catalog def with `cat: 'Mic'`, no audio and a `mic` record. Register them like any block:

```js
export default function register(tz) {
  const { mic } = tz.builders;
  tz.addDefs([
    mic({
      id: 'acme.km84', name: 'Pencil Eighty-Four', brand: 'Acme Mics', ref: 'Neumann KM 84',
      desc: 'Small-diaphragm condenser: fast, bright, honest.',
      mic: {
        type: 'condenser',            // 'dynamic' | 'condenser' | 'ribbon'
        pattern: 'cardioid',          // 'cardioid' | 'supercardioid' | 'hypercardioid' | 'figure8' | 'omni' | 'wide'
        short: 'KM84',                // jack and tag label (optional)
        resp: [[20, -4], [50, -1], [100, 0], [1000, 0], [5000, 1], [10000, 2], [15000, 0], [20000, -4]],
        offAxis: -4,                  // dB at 10 kHz when 90 degrees off axis (0 for an omni)
        prox: 6,                      // dB of bass boost at 100 Hz when touching the grille (0 for omni)
        sens: 10,                     // level vs. the SM57 (condensers about +10, ribbons -4 to -8)
        color: '#c8cacc',             // main body colour (thumbnails, fallbacks)
        look: { kind: 'sdc', body: '#c8cacc', grille: '#aab0b6', len: 110, w: 22 },
      },
    }),
  ]);
}
```

* `resp`: on-axis response at about 30 cm (where proximity is negligible), `[Hz, dB]` pairs, ascending, 0 dB near
  1 kHz, 10 to 40 points from 20 Hz to 20 kHz. The engine interpolates in log frequency and holds the end values.
* `prox`: the engine adds a bass shelf (corner about 250 Hz, rising below it) of `prox` dB at 100 Hz at 1 cm,
  falling to nothing at 31 cm (square root of the 1/r curve, so 5 cm gives about 40%). Figure-8 mics get 15% more.
  Omni mics have none.
* `offAxis`: the extra high-frequency loss at 90 degrees, shaped from about 1.5 kHz up (full at 10 kHz). The cab's
  angle control spans 0 to 45 degrees and the loss follows sin squared (45 degrees = half the 90 degree figure).
  The speaker's own beaming adds a little on top.
* `sens`: the relative level of the mic when it is blended with others on the same cab (relative to the hottest
  mic there). A mic's own output and a single mic are always at the cab's normal level.
* Type and pattern also shape the room: omni and figure-8 mics hear more of the early reflections when backed off,
  condensers a little more than dynamics, super / hypercardioids less. Ribbons smooth the speaker's fine break-up
  detail above 3 kHz.
* Positions (speaker, cone position, distance, angle, level, pan, polarity) are fast params of the cab; the mic data
  reaches the engine when the graph is built (`opts.mics`), so swapping a model rebuilds the cab block, moving a mic
  only regenerates that mic's impulse response.

The mic appears in the Mics list and works on every cab with no extra code. If its plugin is disabled, cabs that use
it fall back to the Fifty-Seven sound (the preset keeps the model id).

### Looks

The core drawing reads `mic.look`. All sizes are millimetres of the real mic (1 mm is about half a pixel on a cab at
100% zoom). Colours are hex strings.

| kind | what it draws | fields (defaults) |
| --- | --- | --- |
| `stick` | end-address stick dynamic (57 style) | `body`, `grille`, `ring`, `band`, `len` 157, `w` 32, `headW` w, `headLen` 38, `tail` w*0.78, `angled` (Beta-style stepped head), `text`, `textColor` |
| `handheld` | ball grille (58 style) | `body`, `grille`, `cup`, `band`, `len` 162, `w` 34, `ball` 51, `tail` 25, `text` |
| `tube` | long cylinder (441 / M160 / RE20 style) | `body`, `grille`, `headColor`, `mesh` (mesh front instead of slots), `top` 'flat' / 'round', `ring`, `rings` (count), `len` 180, `w` 34, `headLen` 55, `taper` 0.9, `text` |
| `oblong` | wide slotted head, bass ring, stand clip (421 style) | `body`, `grille`, `slots`, `ring`, `len` 200, `w` 46, `headLen` 62, `text` |
| `sideflat` | flat side-address (906 / 609 style) | `body`, `grille`, `switch` (bool), `len` 135, `w` 54, `window` 44, `text` |
| `ldc` | large-diaphragm condenser | `head` 'square' (414 style) or 'pill' (87 style), `body`, `grille`, `frame`, `badge`, `len` 190, `w` 54, `headLen` 74, `taper`, `text` |
| `sdc` | pencil condenser | `body`, `grille`, `ring`, `len` 150, `w` 21, `headLen` 24, `text` |
| `ribbon` | slim modern ribbon (121 style) | `body`, `grille`, `element`, `len` 158, `w` 25, `window` len/2, `text` |
| `ribbon44` | big vintage ribbon on a yoke | `frame` ('chrome' or a colour), `grille`, `body`, `yoke`, `len` 230, `w` 92, `headLen` 150 |
| `pill` | vintage capsule (55 / 77 style) | `frame`, `grille`, `ribs` 'v' / 'h', `body`, `len` 170, `w` 64, `headLen` 104 |
| `broadcast` | broadcast dynamic with foam and yoke (7B style) | `body`, `foam`, `len` 190, `w` 50, `headLen` 60, `text` |
| `egg` | kick drum mic (D112 style) | `body`, `grille`, `band`, `len` 150, `w` 72, `headLen` 110 |
| `boundary` | half-cylinder / boundary mic | `body`, `grille`, `w` 90, `headLen` 70 |

Without `look.kind` a dynamic draws as `stick`, a condenser as `ldc`, a ribbon as `ribbon`.

A drawing of your own:

```js
tz.builders.micLook('acme-tube47', (g, look, mic, def) => {
  const { svg, shade } = tz.gfx;
  // millimetres, the pickup point (capsule front, or diaphragm centre for side-address mics) at 0,0, body down +y
  svg('rect', { x: -30, y: -50, width: 60, height: 230, rx: 30, fill: look.body }, g);
  return { top: -50, bottom: 180, w: 60 }; // extent, used for the shadow, the list thumbnail and the hit area
});
// then: mic: { ..., look: { kind: 'acme-tube47', body: '#d9d2c0' } }
```

The same drawing is used in the library list (upright, cropped to the head and upper body), on the cab (smaller when backed off, tilted with
the angle, with its number tag) and in the inspector. A kind added through `tz.builders.micLook` goes away when its
plugin is disabled (models using it then draw as their type's default kind). Use gradients and patterns, no SVG filters. A plugin can also
give the def its own `form` (registered with `tz.addForm`) for the library thumbnail only.

## Core models

| id | name | inspired by | notes |
| --- | --- | --- | --- |
| `mics.dyn57` | Fifty-Seven | Shure SM57 | default on new cabs, legacy type 0 |
| `mics.beta57a` | Beta Fifty-Seven | Shure Beta 57A | supercardioid, +1.5 dB |
| `mics.dyn58` | Fifty-Eight | Shure SM58 | ball grille |
| `mics.c414` | Four-Fourteen | AKG C414 | legacy type 1 |
| `mics.r121` | One-Twenty-One | Royer R-121 | legacy type 2 |
| `mics.md421` | Four-Twenty-One | Sennheiser MD 421 | legacy type 3 |
| `mics.e906` | Nine-Oh-Six | Sennheiser e906 | legacy type 4 |
| `mics.md441` | Four-Forty-One | Sennheiser MD 441 | legacy type 5 |
| `mics.u87` | Eighty-Seven | Neumann U 87 | legacy type 6 |
| `mics.m160` | One-Sixty | Beyerdynamic M 160 | legacy type 7 |

More models come from the Mics plugin (`app/plugins/mics`).

## Under the hood

* Cab params per slot `i` (1 to 8): `m<i>on`, `m<i>model` (string), `m<i>dist`, `m<i>axis`, `m<i>lvl`, `m<i>pan`,
  `m<i>phase`, `_m<i>x` / `_m<i>y` (over the grille, 0..1; the engine gets `m<i>spk` / `m<i>pos` from them), and the
  old `m<i>type` (used only when there is no `m<i>model`).
* `app/renderer/js/catalog/cabmics.js`: slots, models, jacks, cable moves, engine opts, preset specs.
  `catalog/mics.js`: core models. `gfx/forms-mic.js`: drawings. `mic-edit.js`: drop, select, swap, remove,
  inspector. `engine/src/blocks/cab_ir.cpp`: one impulse response per mic (re-made only when that mic changes),
  one convolver per output, mic outputs only run with a cable on them.
* Engine opts of a cab: `mics` (8 entries, null for empty slots: `{type, pattern, resp, offAxis, prox, sens,
  legacy?}`) and `layout: { mix: 1 | 2, mics: [slot indices, 0-based] }`, outputs = mix outputs then the mic outputs.
