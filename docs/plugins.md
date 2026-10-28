# Writing Tone Zone plugins

Plugins add blocks (pedals, amps, preamps, cabs, utilities, devices), enclosure renderers ("forms"), live
screens, control behaviour and even whole pages. Every "inspired by" brand in Tone Zone ships as a built-in
plugin (`app/plugins/<id>/`), so those are the best examples to copy from.

* Built-in plugins: `app/plugins/<id>/` (bundled in the AppImage, can be disabled in the **Plugins** tab).
* Your plugins: `~/.local/share/tone-zone/plugins/<id>/` (or install a `.zip` / folder from the Plugins tab).
  A user plugin with the same id as a built-in one replaces it.

## Layout

```
my-plugin/
  plugin.json
  index.js        ES module, default export register(tz)
  assets/…        optional (images, fonts) – use tz.asset('assets/x.png')
```

`plugin.json`

```json
{ "id": "acme", "name": "Acme FX", "version": "1.0.0", "author": "You", "description": "…",
  "kind": "brand", "brand": "Acme", "main": "index.js", "api": 1, "color": "#7a2" }
```

* `id`: lowercase, `[a-z0-9._-]`, unique. `kind`: `brand` | `device` | `originals` | `utility` | anything.
* `brand` is copied onto every block that does not set its own (`d.brand`) – it drives the browser's
  "Inspired by brand" filter.

`index.js`

```js
export default function register(tz) {
  const { K, SEL, TOG, BTN, FOOT, LED, SLIDER, SCREEN, TREADLE, def, ten, db, ms, MONO, STEREO } = tz.helpers;
  const { compact, mxr, stomp, S, AMP, CAB, preampPair, lvl, tone, gain } = tz.builders;
  tz.addDefs([
    compact({ id: 'acme.od1', name: 'OD-ONE', ref: 'Acme OD-1', code: 'OD-1', typeName: 'OverDrive',
      cat: 'Overdrive', color: '#e2b400', algo: 'drive', opts: { clip: 'asym', tone: 'lp' },
      controls: [lvl(), tone(), gain('DRIVE')] }),
  ]);
}
```

## Naming and look (important)

* `name` / `code` / `logo` are **Tone Zone originals** – never the real product name, logo text or trademark.
  Use a recognisable-but-different name (e.g. "DX-1 Distortion" for a BOSS DS-1, "Weep Baby" for a Cry Baby).
* `ref` is the real unit the block is inspired by ("BOSS DS-1") – shown as "Inspired by …".
* Copy the real unit's **layout, control labels, colours and enclosure shape** closely so users feel at home.
  Boutique pedals with artistic enclosures deserve custom forms (hand-drawn art, textures, odd shapes).

## Block definition reference

| field | meaning |
|---|---|
| `id` | unique, `<prefix>.<model>` (prefix per brand, e.g. `ehx.bigmuff`) |
| `name`, `code`, `logo`, `logoFont`, `logoColor`, `logoSize` | original names / printed text |
| `ref`, `brand` | inspired-by unit and brand |
| `cat` | one of `tz.categories`: Overdrive, Distortion, Fuzz, Boost, Amp, Bass Amp, Preamp, Cab, Bass Cab, Dynamics, EQ, Filter, Modulation, Pitch, Delay, Reverb, Synth, Acoustic, Looper, Volume, Wah, Multi-FX, Utility, Control, Device |
| `kind` | browser type filter override: Pedal, Amp, Preamp, Cab, Multi-FX, Utility (derived from `cat` otherwise) |
| `typeName`, `desc`, `tags` | subtitle, inspector text, extra search words |
| `form` | enclosure renderer (see Forms) |
| `baseForm` | for a custom enclosure that stands in for an amp or cab: `'amp'` / `'cab'` (amp heads stack on cabs in presets, z-order, stereo mic ports, thumbnails) |
| `color`, `text`, `accent`, `knob`, `labelBg`, `labelText`, `codeColor`, `plate`, `plateText`, `tolex`, `panel`, `panelText`, `grille`, `piping`, `wide`, `small`, `rows`, `tagline` | look; which ones matter depends on the form |
| `algo`, `opts` | engine algorithm and creation options – see `docs/engine-blocks.md` |
| `controls` | knobs, switches, footswitches, LEDs, screens (see Controls) |
| `fixed` | engine params forced to constant values |
| `derive(ui) → {param: value}` | compute engine params from the UI params (e.g. one knob drives several engine params) |
| `initParams` | initial UI params for a fresh block |
| `ports` | `{ ins: [labels], outs: [labels] }` (default `MONO`), `STEREO`, `MONO_TO_ST` |
| `stereo` | `'mono'` (default), `'both'` (user can switch mono/stereo), `'stereo'` (stereo by default, switchable) |
| `monoPorts`, `stereoPorts` | port sets for the two variants of a `'both'` block |
| `jackKinds` | `{ i0: 'xlr', o1: 'phones', … }` – jack / cable type: `inst` (1/4" TS, default), `trs` (1/4" stereo), `phones` (headphone, stereo), `mini` (3.5 mm stereo), `xlr`, `usb`, `midi`, `any`. Stereo kinds carry two audio channels on one cable. |
| `ctrl` | control jacks: `{ ins: [{ label, param, min, max, curve, invert } \| { label, action: 'bypass'\|'tap' } \| { label, action: 'event', event: {type, arg}, release } \| { label, hook: true }], outs: [{ label, source: 'param:<p>' \| 'foot' }] }` |
| `cost` | DSP cost estimate (≈ % of one core at 64 frames; drive 0.5, amp 2.5, NAM 12) |
| `alwaysOn`, `defaultBypass`, `noBypassClick`, `tunerBlock`, `tapFoot`, `momentaryWhen(ui)`, `holdWhen(ui)` | behaviour flags |
| `hidden` | not listed in the browser |

### Controls

All controls take `x`, `y` (optional – forms auto-place controls without coordinates), `label`, `labelPos`
(`above` / `below` / `none`), `labelSize`, `r` (radius) and map to an engine param with `p`.

* `K(p, label, {min, max, def, curve:'log', step, display: fn|ten|db|ms|pct, unit, style, cap, scale:10, ticks, invert, virtual, alt})` – knob. Knob `style`: boss, mxr, nine, chicken, vox, marshall, fender, chrome, mesa, strymon, white, red, cream, rat. `virtual` = UI only (use `derive`).
* `SEL(p, label, options, {sweep, values, printLabels, ring, optSize, labelRadius})` – rotary selector; `values` maps positions to engine values.
* `TOG(p, label, options, {values, orient:'h'|'v'})` – 2/3-way mini toggle.
* `BTN(label, {p, toggle, event: {type, value, arg}, action, led, ledColor, shape:'rect', w, h})` – push button.
* `FOOT({action, label, style, idx, hold, tapTarget})` – footswitch. `action`: `bypass` (default), `tap`, `ctrl` (control output `idx`), `select` (output selector), plus `hold: {ms, event, release, action}`. `style`: stomp, soft, plate, ts, rc. Tap options: `tapTarget` (param that
  mirrors the tapped time, default `time`), `tapHz: true` (target is a rate in Hz → 1000/ms × `tapMul`), `tapSub: i`
  (send the tap to sub-block `i` of a chain).
* `LED({bind, color, r, label})` – `bind`: `on` (bypass state, default), `param:<p>`, `param:!<p>` (inverted),
  `param:<p>:=2` / `param:<p>:>0.3` / `param:<p>:<0.3` (compare), `onparam:<p>` (block on **and** param set),
  `fn` with `ledFn(ui, block, status, now) → true | '#colour' | null` for anything derived, `tap:<param ms>`,
  `rate:on:<p>`, `tunerOk`, `select:<i>`, `looper:…`, `fav`. Add `sub: '<prefix>'` to read a chain sub-block's status
  (e.g. a looper inside a `chain`).
* `SLIDER(p, label, {h, w, orient: 'h' for horizontal, led, capColor})`, `TREADLE(p, {…})` (wah / volume / whammy), `SCREEN(kind, {w, h, interactive})` – live displays (tu3, polytune, strobe, looper500, looper600, looperMini, ring, modelName, meter, or one you register).

### Chains (several engine blocks in one pedal)

`algo: 'chain', opts: { chain: [{ algo, prefix, opts, params, on, group, ch, lvl }], mix }` – sub-blocks run in
series; every sub param is exposed as `<prefix>.<param>` plus `<prefix>.on`.

* `group: n` – consecutive subs with the same group number run **in parallel** from the same input and are summed
  (each gets a `<prefix>.lvl` gain, 0–2). Turning every lane off passes the dry signal.
* `ch: 0 | 1` – the sub only processes that channel (per-input EQ on a two-channel DI, for example).
* `lvl: true` – adds `<prefix>.lvl` to a series sub.
* `mix: true` (chain option) – adds a chain-level `mix` param (dry/wet of the whole chain, e.g. a bass DI blend after
  the speaker sim).
* Events: footswitch events reach sub-block `i` with `arg = i * 100 + innerArg` (tap tempo on the 3rd sub = `arg: 200`).

Engine ranges worth knowing: drive `mode` 0–15 (16 voicings via `opts.modes`), pitch has three voices
(`semis1..3` / `level1..3`, diatonic `deg1..3`), `outTrim` in `opts` is a linear gain (not dB), cab `open` is boolean.

## Forms (enclosures)

| form | look | auto-layout |
|---|---|---|
| `compact` | BOSS-style compact with pedal plate | up to 4 knobs in a row (+ concentric `inner` knobs), LED "CHECK", name label (`typeName` + `code`) |
| `mxr` | MXR box (`wide` for 196 px) | 1–3 knobs in a row or 2 rows, script logo, stomp + LED |
| `nine` | Ibanez 9-series | 2–3 knobs, chrome name plate, big switch |
| `strymon` | brushed medium (or `small`) | 3+3 knobs (`rows: [n, m]`), toggles, 1–2 footswitches, jacks on top |
| `tz` | generic stomp (any brand) | rows of 3 (or 4) knobs, toggles row, logo + type, stomp + LED |
| `rat`, `polytune`, `drop`, `pod`, `rc500`, `rc600` | special shapes used by built-ins |
| `treadle` | wah / volume / whammy | treadle fills the top, jacks low on the sides |
| `amp` | head or `combo` (tolex, grille, panel) | knob row on the panel, toggles, power LED |
| `cab` | speaker cab (`cabSize`: 1x10 1x12 2x10 2x12 2x12v 3x10 4x10 4x12 6x10 8x10 1x15 2x15 1x18) | mics are draggable |
| `rack` | 19" rack unit | knob row |
| `util`, `box`, `selector`, `footswitch`, `meter` | utility boxes |

### Custom forms

```js
tz.addForm('acme-wedge', (ctx, def) => {
  const { svg, label, formKit, softShadow, shade } = tz.gfx;
  const g = ctx.g, w = 160, h = 240;
  formKit.body(g, w, h, def.color, { rx: 14 });              // shaded enclosure (or draw your own shape)
  svg('path', { d: 'M20 150 Q80 120 140 150', stroke: '#fff', fill: 'none', opacity: 0.4 }, g); // art
  label(g, w / 2, 170, def.logo, { size: 18, fill: '#fff', font: "'Oswald', sans-serif", weight: 700 });
  const theme = { text: '#fff', knob: 'chrome', labelSize: 6.5 };
  def.controls.forEach((c, i) => { if (c.t === 'knob' && c.x === undefined) Object.assign(c, { x: 35 + i * 45, y: 50, r: 13 }); });
  formKit.placeControls(ctx, def.controls, theme);            // draws all controls and wires interaction
  return { w, h, theme, jacks: formKit.jacksSide(def, w, { flip: ctx.flip, y0: 50, gap: 28 }) };
});
```

* **Forms run more than once** (re-renders, zoom, variants) and the control objects are shared, so positions you
  assign stick. Don't decide layout with `c.x === undefined` alone – mark what you placed (e.g. `c._auto = true`)
  and lay those out again on every call.
* `ctx.g` is the SVG group; `ctx.flip` is true when the user chose left→right signal flow (inputs on the left).
* Return `{ w, h, theme, jacks }`. A jack is `{ key: 'i0'|'o0'|'ic0'|'oc0', dir, port, label, side: 'left'|'right'|'top'|'bottom'|'face', x, y, kind }`.
* Performance rule: **no SVG `filter`s** (blur, turbulence…) – use `tz.gfx.softShadow`, `noisePattern`, gradients and
  `haloFill` (LED glow) instead. Repaints are cheap only without filters.
* Fonts available: Inter, Barlow Condensed, Oswald, Dancing Script, Share Tech Mono (or load your own with `addStyles`).

## API (`tz`)

| member | |
|---|---|
| `helpers`, `builders`, `categories` | definition helpers (see above) |
| `gfx` | `svg, label, shade, luminance, clamp, softShadow, noisePattern, haloFill, setA, setText, drawKnob, drawSelector, drawToggle, drawButton, drawLed, drawFoot, drawSlider, drawTreadle, drawJack, drawPlug, formKit, cabgeom` |
| `addDefs(defs)` | register blocks (arrays may be nested) |
| `addForm(name, fn)`, `addScreen(kind, {build(s,g,w,h,view), update(s,status,view,now)})`, `addStyles(css)` | rendering. In `update`, `s.ui` holds the block's current UI params (defaults filled in). Screens are removed when the plugin unloads. |
| `blockHooks(type, {foot(view, ctl, down) → handled, ctrl(block, input, value, kind), …})` | custom behaviour |
| `addPage({id, title, icon, render(el)})` | a full page tab |
| `engine.send(cmd)`, `engine.onEvent(fn)` | talk to the DSP engine |
| `storage.get(k, default)`, `storage.set(k, v)` | per-plugin settings |
| `midi(opts)` | Web MIDI access (`navigator.requestMIDIAccess`) |
| `sys.usbDevices()` | list USB devices (vendor / product ids, names) |
| `asset(rel)` | URL of a file in the plugin folder |
| `ui.el, ui.esc, ui.toast`, `bus.on/emit` | UI helpers and app events |
| `onUnload(fn)` | cleanup when the plugin is disabled |

## Testing

```
cd app
NODE_PATH=$(npm root -g) LD_LIBRARY_PATH=../engine/tests/fakejack xvfb-run -a -s "-screen 0 1600x950x24" \
  node scripts/plugin-check.js <pluginId> /tmp/check
```

renders every block (gallery + close-ups), loads them all into the engine, and reports each block's output level
on a guitar riff (flags silent / too loud / clipping voicings).
