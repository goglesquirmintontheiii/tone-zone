# Tone Zone on a Raspberry Pi

This is the plan for running Tone Zone on a Raspberry Pi as a standalone pedal: plug in a guitar, step on
footswitches, no computer needed. The desktop app stays the place where you build presets. The Pi plays them.

Status: planned. The **Pi tab** in the desktop app shows the finished UI with demo data so we can agree on how it
should work. Nothing in it talks to a real Pi yet (it says so where that matters).

## Goals

* Install with a few commands over SSH, or (later) by flashing a ready made SD card image.
* Connect without technical knowledge: over Wi-Fi, over Ethernet to your router, or with one cable straight from
  the computer to the Pi.
* Updates over the network or the cable, signed, with automatic rollback if an update fails.
* Many presets on the Pi, in banks, switched with footswitches, the on-device screen or the desktop app.
* Full NAM support (A1 and A2, every size), with honest CPU numbers so you know what fits.
* Never glitch: high CPU use is fine, dropouts are not. The Pi refuses or lightens a preset before it would lag.
* Footswitches, LEDs and expression pedals on GPIO.
* Runs headless, or with a small screen that shows a very light UI for picking presets and tweaking parameters.

## Target hardware

| | Pi 4 Model B | Pi 5 |
|---|---|---|
| CPU | 4x Cortex-A72 @ 1.8 GHz | 4x Cortex-A76 @ 2.4 GHz |
| Rough speed vs. a desktop core | about 1/3 (1/5 for NAM) | about 2/3 (about 1/2 for NAM) |
| RAM | 2 GB is plenty, 1 GB works | 2 GB or more |
| Built-in 3.5 mm jack | **output only** (PWM, noisy, fine for headphone practice) | **none** |
| Built-in audio input | none | none |
| Cooling | heatsink case recommended | active cooler strongly recommended |

Pi 5 is the recommended board. Pi 4 works well for amp + cab + a few pedals, and for NAM Lite / Feather models.
Pi 3 and Pi Zero 2 W are not supported (too slow for NAM, and only 1 GB / 512 MB of RAM).

**OS:** Raspberry Pi OS Lite (64-bit, Bookworm or newer). 64-bit matters: the engine is built for aarch64 with NEON.
The desktop edition of the OS also works but uses more RAM and CPU for nothing.

### Audio in and out

The Pi has no audio input of its own, so you always need one of these for the guitar. Input and output can be two
different devices (for example a USB adapter in and the Pi 4's built-in jack out).

| Option | In | Out | Latency | Quality | Notes |
|---|---|---|---|---|---|
| **Audio HAT** (I2S) | yes | yes | lowest | good to very good | Sits on the GPIO header. Uses GPIO 18, 19, 20, 21. Good picks: HiFiBerry DAC+ ADC Pro, IQaudio / Raspberry Pi Codec Zero, Blokas Pisound (has a hi-Z input, MIDI and a button). |
| **USB audio interface** (class compliant) | yes | yes | low | very good | Focusrite Scarlett Solo / 2i2, Behringer UMC22 / UMC202HD, Audient EVO 4, M-Audio M-Track. Anything that works on Linux without a driver. Best choice for a hi-Z guitar input. |
| **Cheap USB "aux" adapter** | yes (mic / line) | yes (headphone) | low to medium | okay | The 5 to 15 dollar dongles (C-Media CM108 / CM119 and similar). The input is mono and expects mic or line level, so a guitar sounds thin and quiet without a buffer, boost pedal or DI in front. Fine to start with. |
| **Built-in 3.5 mm** (Pi 4 only) | no | yes | medium | low (PWM, hiss) | Headphones or a practice amp's aux in. Not for gigs. Pi 5 has no jack. |
| **HDMI audio** | no | yes | high | good | Only for monitoring through a TV or monitor. Not recommended for playing. |

**One device for both directions is always best.** When input and output are two different devices they run on
two different clocks. The engine then has to resample one side to stay in sync, which adds about 1 to 3 ms of
latency and a little CPU (PipeWire does this automatically; on plain ALSA we use an adaptive resampler in the
engine's I/O layer). The tab shows this as a warning with the extra latency in the Audio section.

### Screens

| Screen | Resolution | Connection | Notes |
|---|---|---|---|
| Raspberry Pi Touch Display (7") | 800 x 480 | DSI | Best fit. Capacitive touch. |
| Raspberry Pi Touch Display 2 (7") | 1280 x 720 (rotated) | DSI | Higher resolution, same UI scaled up. |
| 5" HDMI touch screen | 800 x 480 | HDMI + USB touch | Common, cheap. |
| 3.5" SPI touch screen (ILI9486 class) | 480 x 320 | SPI (GPIO 7 to 11, 24, 25) | Small and slow to redraw. Resistive touch. The UI uses its compact layout. |
| 2.8" SPI screen | 320 x 240 | SPI | Compact layout, preset and tuner focus. |
| 0.96" / 1.3" OLED (SSD1306 / SH1106) | 128 x 64 | I2C (GPIO 2, 3) | Status only: preset name, bank, tuner. No touch. |
| None | | | Headless. Footswitches, LEDs and the desktop app. |

## Architecture

```
  Desktop app (Pi tab)                         Raspberry Pi
  +----------------------+   HTTPS + WebSocket  +-------------------------------------------+
  | find, pair, push     | <------------------> | tz-agent (user service)                    |
  | presets, GPIO map,   |    port 7650         |  discovery (mDNS), pairing, preset store,  |
  | updates, logs        |                      |  updates, GPIO, screen UI, logs            |
  +----------------------+                      |          | JSON lines on a local socket   |
                                                |          v                                 |
                                                | tonezone-engine (system service, RT)       |
                                                |  same C++ engine as the desktop, aarch64   |
                                                |  NAM, IRs, all blocks, JACK or ALSA        |
                                                +-------------------------------------------+
```

### The engine

The same C++20 engine as the desktop (`engine/src`), built for `aarch64` (Cortex-A72 / A76) with NEON. No new DSP
code is needed for the Pi; the work is build, I/O and tuning:

* **Build.** CMakeLists today hard codes `-march=x86-64-v2`. Add a `TZ_ARCH` value for ARM: `-mcpu=cortex-a72`
  (Pi 4) and `-mcpu=cortex-a76` (Pi 5), one binary each, the agent picks the right one at start. Eigen (used by
  NAM) uses NEON automatically. Cross compile in CI with an aarch64 toolchain, test under QEMU for correctness and
  on real boards for speed.
* **Denormals.** `flushDenormals()` in `engine.cpp` only handles x86 today. On ARM set the FZ bit (bit 24) of FPCR
  at the start of every process call, otherwise reverb and filter tails stall the CPU.
* **Audio host.** The engine already talks the JACK API (`jack_dl.cpp` loads libjack at runtime). On the Pi it runs
  on **PipeWire's JACK layer** by default (what Raspberry Pi OS Bookworm ships), or on **plain JACK2** with the ALSA
  backend for the lowest and most stable latency. Later, a direct ALSA backend (no server at all) is an option
  if JACK turns out to cost too much on Pi 4.
* **Offline mode** (`--offline graph.json in.wav out.wav`) is reused for the on-device benchmark and for checking
  presets after an update (render a short clip, compare against a stored hash).
* **Runs as a systemd service** `tonezone-engine.service` with `LimitRTPRIO=95`, `LimitMEMLOCK=infinity`,
  `CPUSchedulingPolicy=fifo` for the audio thread (via JACK / PipeWire RT settings), `Nice=-10` for the rest,
  and `Restart=always`. If the engine ever crashes it is back in about a second with the last preset.
* **Control** is the same JSON lines protocol the desktop app uses on stdin/stdout, carried over a Unix socket so
  the agent can restart without restarting audio.

### tz-agent

A small companion service, written in Node.js (it reuses the desktop app's preset, catalog and graph code, so a
preset means exactly the same thing on both sides). It does everything that is not audio:

* **Discovery:** advertises `_tonezone._tcp` over mDNS (Avahi) with the name `tonezone.local` (or
  `tonezone-<4 hex>.local` if there is more than one).
* **Pairing and API:** HTTPS + WebSocket on port 7650 for the desktop app.
* **Preset store:** set lists, banks, NAM models and IRs on the SD card, turning a desktop preset into an engine
  graph (`buildGraph` from `state.js`).
* **Updates:** downloads, verifies and installs update bundles, handles rollback.
* **GPIO:** footswitches, LEDs and ADC expression inputs via libgpiod (works on Pi 4 and Pi 5; Pi 5's RP1 chip
  breaks the old sysfs and `/dev/mem` libraries).
* **Screen UI:** draws the on-device UI (see below).
* **Logs:** journald, plus a "support bundle" the desktop can download.

The agent is never in the audio path. If it hangs, sound keeps going.

## Install over SSH

1. Flash **Raspberry Pi OS Lite (64-bit)** with Raspberry Pi Imager. In Imager's settings: set the hostname to
   `tonezone`, turn on SSH, set a user name and password and (if you use Wi-Fi) your Wi-Fi network.
2. Boot the Pi, then from your computer:

```bash
ssh pi@tonezone.local
curl -fsSL https://raw.githubusercontent.com/goglesquirmintontheiii/tone-zone/main/pi/install.sh | sudo bash
```

If you prefer to read the script before running it:

```bash
curl -fsSLO https://raw.githubusercontent.com/goglesquirmintontheiii/tone-zone/main/pi/install.sh
less install.sh
sudo bash install.sh
```

(The `pi/` folder and installer do not exist yet. This is the planned path.)

What the installer does:

1. Checks the board (Pi 4 or Pi 5), the OS (64-bit Bookworm or newer) and free space.
2. Installs packages: `pipewire-jack` or `jackd2`, `avahi-daemon`, `libgpiod`, Node.js runtime (bundled, not from
   apt), `cpufrequtils`.
3. Downloads the signed release bundle for the board, checks its signature, unpacks it into `/opt/tonezone/a`.
4. Creates a `tonezone` system user in the `audio` and `gpio` groups, and `/var/lib/tonezone` for presets and models.
5. Sets real-time limits (`/etc/security/limits.d/tonezone.conf`), the CPU governor to `performance`, and turns off
   Wi-Fi power saving.
6. Installs and starts `tonezone-engine.service` and `tz-agent.service`.
7. Prints the pairing code and the address to open in the desktop app.

Options: `--channel beta`, `--no-tuning` (skip governor and RT changes), `--headless`.

Uninstall:

```bash
sudo tonezone uninstall          # removes services, /opt/tonezone, the tonezone user and the tuning files
sudo tonezone uninstall --keep-data   # keeps /var/lib/tonezone (presets, models) for a later reinstall
```

Later (phase 4) there will also be a ready made SD card image in Raspberry Pi Imager's list, for people who never
want to see a terminal.

## Connecting without technical knowledge

The desktop's Pi tab has an **Add a Pi** wizard that walks through each of these with pictures and copy buttons.

* **Found automatically.** The agent advertises itself over mDNS, so `tonezone.local` just works on macOS, Linux
  and Windows 10/11. The Pi tab lists every Pi it finds. No IP addresses to type.
* **Wi-Fi.** Either set Wi-Fi in Raspberry Pi Imager, or: if the Pi has no network for 60 seconds after boot, it
  starts a hotspot called `ToneZone-Setup-<4 hex>` with the password shown on its screen or printed on a sticker
  you made at install time. Join it from your phone or computer, a page opens (captive portal at `10.42.0.1`), pick
  your home network, done. The hotspot turns off once the Pi is online. A long press on footswitch 1 at boot
  forces the hotspot (for when you move to a new place).
* **Ethernet to your router.** Plug it in. Nothing to set up.
* **Direct cable, computer to Pi.** One Ethernet cable from your computer (or a USB Ethernet adapter) to the Pi,
  no router. Both sides fall back to link-local addresses (`169.254.x.x`) and mDNS still finds `tonezone.local`.
  On Linux with NetworkManager the wired connection must be set to "Link-local only" or "Shared to other
  computers"; the wizard explains this in one step. On Pi 4 / Pi 5 USB-C "gadget mode" networking is a possible
  later option for a one-cable setup on laptops without Ethernet.
* **Manual address.** For unusual networks: type the IP or hostname.
* **Pairing code.** The first time, the desktop shows the Pi it found and asks for a 6 digit code. The Pi shows the
  code on its screen, or prints it in the SSH session (`tonezone pair`), or blinks it on the status LED for headless
  setups. Pairing swaps keys; after that the desktop connects automatically.

## Updates

* **Bundles.** One file per release per board: engine binary, agent, UI assets, a manifest with version and
  SHA-256 of every file. Bundles are **signed with an Ed25519 key** that is pinned on the Pi at install time. An
  unsigned or mismatched bundle is refused.
* **A/B slots.** The app lives in `/opt/tonezone/a` and `/opt/tonezone/b`. An update writes the inactive slot,
  switches a symlink, restarts the services and runs a health check (engine starts, loads the current preset,
  renders 1 second offline with the expected result, agent answers). If any of that fails within 60 seconds, the
  Pi switches back to the old slot by itself. A manual **Roll back** button keeps the previous version available.
  The OS itself is updated with normal `apt` (optional, off by default during gigs).
* **Ways to update:**
  * Over the internet, from the Pi itself (Wi-Fi or Ethernet).
  * Pushed from the desktop app over the local network or the direct cable (the desktop downloads the bundle, the
    Pi does not need internet).
  * From a USB stick with the bundle file on it, for places with no network at all.
* **Channels:** Stable, Beta and Nightly. Stable by default.
* **Never during a show.** Updates only install when you press Install, or (if you turn on auto updates) when the
  Pi has had no input signal for 10 minutes.

## Presets on the Pi

* **Set list and banks.** The Pi holds many presets, grouped into banks of 4 (A, B, C, D) like a classic floor
  unit. Up to 128 banks. The desktop's Pi tab shows the banks, lets you reorder them, and pushes presets.
* **Pushing.** "Push current preset" or pick presets from your list. The desktop sends the preset JSON plus every
  NAM model and IR it uses (deduplicated by hash, so a model used by 20 presets is copied once).
* **Supported blocks.** Every engine algorithm runs on the Pi: amps, cabs, drives, modulation, delays, reverbs,
  pitch, synths, loopers, NAM, IRs, tuner. Custom Pedal Factory blocks run too (they are made of the same
  algorithms).
* **Not supported or limited:**
  * Device blocks that need hardware on the desktop (the Line 6 Helix USB blocks, `extio` with no matching ports):
    skipped on the Pi, audio passes straight through. The check lists them.
  * Custom screen scripts and pedal graphics are not drawn on the Pi screen (it shows parameters only).
  * Very long loopers are limited by RAM (a 1 GB Pi 4 caps loop memory at about 60 seconds of stereo).
* **Compatibility check.** Before pushing, the tab estimates each block's CPU on Pi 4 and Pi 5 from the block's
  measured desktop cost (from the catalog) and a per algorithm factor, adds the engine's fixed cost and compares
  with the Pi's budget. Blocks are marked OK, heavy, or not supported, and a preset that does not fit is marked
  so before it ever gets to the Pi. When a real Pi is paired, the estimate is replaced by a measured number (the
  Pi renders the preset offline for 2 seconds when it is pushed).
* **Too heavy?** The Pi applies the same auto quality the desktop has (lower oversampling, shorter IRs, A2 Lite).
  If it still does not fit, the preset is stored but marked "too heavy" and won't load, instead of glitching.

### Switching presets

* **From footswitches:** preset up / down, bank up / down, direct select of A to D in the current bank, and hold
  actions (for example hold A = bank down, hold D = bank up). Bank changes can wait for a preset press (the usual
  floor unit behaviour) or switch at once.
* **From the screen:** the preset list, and big previous / next buttons on the home view.
* **From the desktop app:** click a preset in the Pi tab.
* **From MIDI:** program change (bank select with CC 0 / 32), optional.
* **Fast switching.** Loading a preset with a NAM model from scratch takes 100 to 400 ms on a Pi (reading and
  building the model). To make switching feel instant, the agent keeps the **current, next and previous presets
  built in memory** (and all four of the current bank when RAM allows). Switching to a preloaded preset is a pointer
  swap in the engine (the same lock free graph swap it already uses), about one audio cycle.
* **Spillover.** Optional: delay and reverb tails from the old preset keep ringing for a few seconds after a
  switch. The engine runs the old graph's time based blocks with no input alongside the new one until they fade
  (costs extra CPU for those seconds, so it is skipped when the budget does not allow it).

## Performance plan

* **CPU budget.** The engine runs the audio graph on one core. The budget is 70% of one audio cycle on that core
  (a bit lower than the desktop's 75%, because the Pi has less headroom for spikes). The other three cores take the
  agent, the screen UI, the network and preset preloading.
* **Measured costs.** Each block's catalog cost is a desktop number. We will run `tonezone-engine --bench` on real
  Pi 4 and Pi 5 boards for every algorithm and ship a per algorithm cost table, so the estimate in the Pi tab
  comes from measurements, not guesses. Until then the tab uses these factors:

| | Pi 4 | Pi 5 |
|---|---|---|
| Most blocks | 3.0x desktop cost | 1.4x |
| NAM | 5.0x | 2.2x |
| IR / cab (auto trimmed) | 2.0x | 1.0x |
| Engine fixed cost | 3% | 2% |

* **Auto lowered quality for the Pi:** 1x or 2x oversampling instead of 4x, IRs trimmed to 4096 taps (85 ms, which
  sounds identical for cabs), A2 NAM at Lite size on Pi 4, eco reverb mode on Pi 4. Each can be overridden per
  preset if it fits.
* **Buffer sizes.** 128 frames at 48 kHz (about 5.3 ms round trip on a HAT) is the default. 64 frames works on
  Pi 5 with a HAT or a good USB interface. 256 is the safe choice for Pi 4 with heavy presets.
* **Tuning the OS** (the installer does the first three, the rest are options in the Audio section):
  * CPU governor `performance` (no clock ramp up when you start playing).
  * Wi-Fi power save off.
  * Real-time priority for the audio thread, memory locked.
  * `isolcpus=3 nohz_full=3 rcu_nocbs=3` on the kernel command line to keep the audio core free of other work.
  * `force_turbo=1` in `config.txt` (Pi 4) and a good cooler, so it never throttles. The agent warns at 75 C.
  * USB interfaces: avoid USB hubs; put the interface on a USB 3 port on Pi 4 (separate controller from Ethernet).
* **NAM on the Pi.** Full support for NAM A1 (WaveNet Standard, Lite, Feather, Nano, LSTM) and A2 (Full and Lite),
  through NeuralAmpModelerCore with NEON. Rough budget at 48 kHz, 128 frames, one model:

| Model | Pi 4 | Pi 5 |
|---|---|---|
| A1 Standard | about 55 to 70% of a core, alone only | about 25 to 30% |
| A1 Lite | about 30% | about 13% |
| A1 Feather / Nano | about 15 to 20% | about 7% |
| A2 Full | too heavy, auto switches to Lite | about 30% |
| A2 Lite | about 30% | about 13% |

  So on Pi 4: one Lite or Feather model plus cab and pedals, or one Standard model with little else. On Pi 5:
  a Standard model plus a full board, or two Lite models. The Pi tab recommends Lite or Feather captures when a
  preset is too heavy, and the Capture tab will get a "Pi friendly" size option.

## GPIO: footswitches, LEDs, expression

* **Footswitches** are wired between a GPIO pin and ground. The agent turns on the internal pull-up, so no
  resistors are needed. Use any free GPIO; the defaults avoid the pins used by audio HATs (18 to 21), I2C (2, 3)
  and SPI screens (7 to 11, 24, 25).
* **Debounce** in software, 20 ms by default (adjustable 5 to 80 ms), on edge events from libgpiod.
* **Momentary or latching.** Momentary switches (soft touch) can do press and hold actions (hold time 600 ms by
  default). Latching switches (the classic clicky 3PDT) send their action on every change of state.
* **Actions:** preset up, preset down, bank up, bank down, preset A / B / C / D, toggle a block (by name in the
  current preset), tap tempo, tuner, looper record / play / stop, mute. Each switch has a press action and a
  hold action.
* **LEDs** through a 330 ohm resistor to ground. Each LED shows one thing: a block's on/off, the current preset slot
  (A to D), tap tempo, tuner, or status. PWM brightness on GPIO 12, 13 (hardware PWM) or software PWM elsewhere.
* **Expression pedals and external TRS footswitches.** The Pi has no analog inputs, so expression pedals go through
  an ADC: **ADS1115** (I2C, 4 channels, 16 bit, recommended) or **MCP3008** (SPI, 8 channels, 10 bit). An
  expression pedal is a TRS jack wired to 3.3 V, ground and an ADC input. A heel / toe calibration step in the tab
  sets the range. External TRS footswitches (like a dual footswitch box) can go to two GPIO pins via a TRS jack.
* **Status LED.** One pin (default GPIO 26) for "running / clipping / CPU high / pairing code".
* The tab has a visual header map where you click a pin to assign it, and a "test" button to try it.

## Headless mode

No screen. The Pi boots straight into the last preset. Footswitches switch presets and blocks, LEDs show state, the
status LED blinks a pattern for problems (fast = CPU over budget, slow = no audio interface, double = pairing). MIDI
in (USB MIDI or a DIN MIDI HAT like Pisound) for program changes and CC to parameters. Everything else is done
from the desktop app over the network.

## The on-device UI

Small and fixed on purpose. It shows:

* **Home:** preset name, bank and slot, big previous / next buttons, the block list in signal order as big tiles
  (tap to turn on or off, long press or tap the arrow to edit), CPU and in / out levels.
* **Block edit:** the block's parameters as big sliders (knobs and switches from the catalog become sliders and
  buttons), bypass toggle, back.
* **Presets:** the banks and presets on the Pi, tap one to load it.
* **Tuner:** big note name and cents bar.

It does **not** let you add, move, remove or rewire blocks. That stays in the desktop app. This keeps the UI tiny
and impossible to break on stage.

**Tech choice:** draw it directly to the screen with **SDL2 on KMS/DRM** (no X11, no Wayland, no browser), from
a small native process in the agent package. Reasons:

* It starts in under a second and uses about 15 to 25 MB of RAM. A kiosk browser (Chromium on Wayland) needs
  200 to 400 MB and seconds of start up, and its compositor and GPU work compete with audio on Pi 4.
* SDL2 handles DSI, HDMI and touch input on both boards. SPI screens use the kernel's `fbtft` / `panel-mipi-dbi`
  drivers, which show up as a DRM device too, so the same code works.
* It redraws only when something changes (meters at 15 fps), so it costs almost no CPU.
* The 128 x 64 OLED gets a separate tiny text renderer over I2C.

The layout is a fixed grid of large touch targets (at least 48 px on the 7" screen) with flat colours and one font,
so it looks right from 320 x 240 to 1280 x 720. A very light web UI served by the agent stays available for phones
and tablets on the same network (no extra cost on the Pi when nobody opens it).

## Security

* The agent only listens on the local network (private ranges and link-local); never exposed to the internet.
* Pairing with a 6 digit code shown on the Pi, then per desktop keys (mutual TLS with self signed certs pinned on
  pairing). Unpaired clients can only see the device name.
* Update bundles must be signed with the Tone Zone release key; the Pi refuses anything else.
* Services run as the `tonezone` user, not root. Only the installer and the updater's slot switch need root (via a
  small polkit rule).
* The setup hotspot uses WPA2 with a random password and turns itself off once the Pi is online.
* SSH stays as the user set it up in Imager; the tab suggests turning password login off once paired.

## Roadmap

1. **Phase 1, engine on ARM.** aarch64 build in CI, FPCR denormal fix, offline renders match desktop output,
   `--bench` numbers for every algorithm on Pi 4 and Pi 5, the per algorithm cost table.
   *Milestone: a desktop preset renders offline on a Pi with the same output.*
2. **Phase 2, headless pedal.** Systemd services, JACK / PipeWire setup, install script, tz-agent with mDNS,
   pairing, preset push, banks, GPIO footswitches and LEDs, preloaded preset switching.
   *Milestone: play a gig with a Pi, a HAT and four footswitches.*
3. **Phase 3, desktop Pi tab for real.** Wire the tab to the agent: discovery, compatibility check with measured
   numbers, GPIO map, audio settings, logs, updates with A/B rollback.
   *Milestone: a new user goes from a blank SD card to playing in 15 minutes.*
4. **Phase 4, screen and polish.** SDL on-device UI, OLED status, setup hotspot, expression via ADS1115 / MCP3008,
   MIDI, spillover, ready made SD card image, USB stick updates.
   *Milestone: the on-device UI matches the preview in the tab.*
