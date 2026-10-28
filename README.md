<p align="center"><img src="app/build/icon.png" width="96" alt="Tone Zone"></p>

<h1 align="center">Tone Zone</h1>
<p align="center">A realtime guitar &amp; bass DSP pedalboard for Linux (PipeWire) – pedals, amps, preamps, cabs, NAM and IRs on a drag-and-drop board.</p>

---

## Install (Nobara / Fedora / any modern x86-64 distro)

1. Download `Tone-Zone-<version>-x86_64.AppImage` from the [latest release](https://github.com/goglesquirmintontheiii/tone-zone/releases/latest).
2. `chmod +x Tone-Zone-*.AppImage` and run it (or double-click it).

Requirements: PipeWire with its JACK compatibility library (installed by default on Nobara; otherwise
`sudo dnf install pipewire-jack-audio-connection-kit-libs`). The AppImage uses the static AppImage runtime, so no
`fuse2` package is needed.

## Highlights

- **Board editor** – drag blocks from the browser, move them around, and patch them by dragging between the
  1/4" jacks. Cables sag like real ones, have plugs at both ends and can be recoloured (right-click). Inputs take one
  cable; drag a plugged input to move or unplug it, Shift-drag an output to pick up its cable.
- **174 built-in blocks** – drives, distortions, fuzzes, boosts, 26 amps (guitar &amp; bass), preamps, 17 speaker
  cabinets with draggable microphones, compressors, gates, EQs, wahs, filters, modulation, pitch, delays, reverbs,
  loopers, utilities. Pedals that can be stereo come in **mono and stereo variants**.
- **Real-pedal layouts** – blocks inspired by the BOSS, Ibanez, MXR, Dunlop, ProCo, TC Electronic, DigiTech, Line 6
  and Strymon units you know, with the same knob / switch / footswitch / screen layout and similar colours, so
  moving between the real pedal and the virtual one is seamless. LEDs, tap lights, tuner and looper displays are live.
- **Low latency** – a native C++ realtime engine that runs as a PipeWire (JACK API) client. The board itself adds no
  latency (except pitch blocks); the round trip is whatever your PipeWire quantum gives you (64 frames @ 48 kHz ≈ 2.7 ms).
- **DSP budget** – set a budget (share of each audio cycle), see per-block cost, optionally refuse blocks that would
  exceed it or let Tone Zone lower the quality (oversampling, IR length, A2 NAM size) automatically.
- **PipeWire patchbay friendly** – Tone Zone shows up as *Tone Zone* in Helvum, qpwgraph, Carla… with
  2 guitar inputs, 2 returns, stereo main out and 2 sends. There is also a built-in routing panel.
- **NAM + IR** – Neural Amp Modeler A1 and A2 (slimmable Full/Lite) captures, LSTM and more, via
  NeuralAmpModelerCore 0.6. Import single files, many files at once, folders or `.zip` packs: several models become
  **one block with selectable configurations**, shown as an amp, pedal, preamp or cab. IRs (mono/stereo WAV, any
  sample rate) work the same way.
- **TONE3000 tab** – browse tone3000.com inside Tone Zone. “Send to Tone Zone” buttons sit next to download
  buttons, and anything you download there opens straight in the import dialog.
- **Natural pitch shifting** – correlation-aligned (WSOLA) shifter for drop tune / octave / whammy / harmony with
  10–21 ms latency options and no warble on chords.
- **Precise tuners** – YIN + phase-regression refinement: sub-cent accuracy down to low B on 5/6-string bass and
  F# on 8-string guitar; polyphonic strum mode on the PolyTune-style tuner.
- **Presets** – save / load / import / export, undo / redo, factory presets to get started.

## Using it

| Action | How |
|---|---|
| Turn a knob | drag up/down (Shift = fine), mouse wheel, double-click = default |
| Press a footswitch / button | click (footswitches support hold actions where the real pedal does) |
| Wah / volume / whammy treadle | drag; click without dragging = toe switch |
| Cab microphone | drag the mic over the speaker (position / distance), click it to change the mic |
| Patch | drag from a jack to a jack |
| Pan / zoom | drag empty board or middle-drag / mouse wheel |
| Shortcuts | `Del` delete · `Ctrl+D` duplicate · `B` bypass · `F` fit · `Ctrl+Z`/`Ctrl+Shift+Z` undo/redo · `Ctrl+S` save |

Real pedals take their input on the right, so the board flows right → left by default; switch to left → right in
Settings → Board.

User data lives in `~/.local/share/tone-zone` (presets, NAM/IR library, settings).

## Building from source

```bash
./scripts/build-engine.sh          # C++ engine (x86-64-v2 + AVX2/FMA builds) -> engine/dist
cd app && npm ci
npm start                          # run in development
npx electron-builder --linux AppImage
```

Engine test mode: `engine/dist/tonezone-engine-v2 --offline graph.json in.wav out.wav`.

## Project layout

- `engine/` – realtime DSP engine (C++20): PipeWire/JACK host, graph compiler, block library
  (`src/blocks/*`), NAM, convolution, tuner, looper.
- `app/` – Electron UI: board editor, SVG pedal graphics (`renderer/js/gfx`), block catalog
  (`renderer/js/catalog`), library / TONE3000 / settings pages.

See [THIRD_PARTY.md](THIRD_PARTY.md) for bundled components. Product names are trademarks of their owners and are
used only to describe which hardware a layout follows; Tone Zone is not affiliated with them.
