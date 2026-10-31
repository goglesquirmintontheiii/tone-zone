# Tone Zone on a Raspberry Pi

Run Tone Zone on a Raspberry Pi as a standalone pedal: plug in a guitar, step on footswitches, no computer
needed. The desktop app stays the place where you build presets. The Pi plays them.

**Status (v0.9):** first working version. The aarch64 engine, the Pi service (tz-agent), the installer, signed
A/B updates, footswitches and LEDs, the on-device screen UI and the desktop Pi tab's live connection are all
implemented. They are tested on a PC in emulation (qemu for the ARM engine) and in a fake hardware mode (see
[Testing](#testing)). **Nothing has run on a real Pi yet**: the first real test is on a Pi 3B+. Expect rough
edges with real audio interfaces and GPIO wiring; the [checklist](#first-test-on-a-real-pi) lists what to try.

## Contents

* [What you need](#what-you-need)
* [Install on a Pi 3B+ (exact steps)](#install-on-a-pi-3b-exact-steps)
* [Connect the desktop app](#connect-the-desktop-app)
* [Presets, banks and switching](#presets-banks-and-switching)
* [Footswitches and LEDs](#footswitches-and-leds)
* [Screen](#screen)
* [Updates](#updates)
* [Troubleshooting](#troubleshooting)
* [How it works](#how-it-works)
* [Implemented vs planned](#implemented-vs-planned)
* [Testing](#testing) and [first test on a real Pi](#first-test-on-a-real-pi)
* [For maintainers: building, signing, releasing](#for-maintainers-building-signing-releasing)

## What you need

| | Pi 3B / 3B+ | Pi 4 Model B | Pi 5 |
|---|---|---|---|
| CPU | 4x Cortex-A53 @ 1.2 / 1.4 GHz | 4x Cortex-A72 @ 1.8 GHz | 4x Cortex-A76 @ 2.4 GHz |
| Rough speed vs. a desktop core | about 1/6 (1/10 for NAM) | about 1/3 (1/5 for NAM) | about 2/3 (1/2 for NAM) |
| RAM | 1 GB (fine, the agent preloads fewer presets) | 1 GB works, 2 GB plenty | 2 GB or more |
| Built-in 3.5 mm jack | **output only** (PWM, some hiss) | **output only** | none |
| Built-in audio input | none | none | none |
| Default DSP budget | 65% | 70% | 70% |

All three use **one aarch64 engine binary** (built for Cortex-A53 with NEON, which also runs on A72 and A76).
Pi 3B / 3B+ work well for amp + cab + a few pedals, or a small NAM model (Feather / Nano / LSTM) with a cab IR.
A NAM A1 Standard model alone is probably too much for a Pi 3 (we will know after the first real test).

**OS:** Raspberry Pi OS Lite **(64-bit)**, Bookworm or newer. 64-bit also works on Pi 3B / 3B+ and is required:
the installer refuses the 32-bit OS.

**Audio.** The Pi has no audio input, so the guitar always goes in through a USB adapter, a USB interface or a
HAT. Input and output can be two devices (for example a USB adapter in and the built-in jack out).

| Option | In | Out | Notes |
|---|---|---|---|
| USB audio interface (class compliant) | yes | yes | Scarlett Solo / 2i2, UMC22 / UMC202HD, EVO 4... Best for a hi-Z guitar input. On a Pi 3 USB shares its bus with Ethernet: use buffer 128 or more. |
| Cheap USB "aux" adapter (C-Media CM108 / CM119...) | yes, mono mic / line | yes | Fine to start with. Guitar sounds thin and quiet without a buffer, boost pedal or DI in front. |
| Audio HAT (I2S) | yes | yes | HiFiBerry DAC+ ADC Pro, Codec Zero, Pisound. Lowest latency. Uses GPIO 18 to 21. |
| Built-in 3.5 mm (Pi 3, Pi 4) | no | yes | Headphones or a practice amp's aux in. |
| HDMI audio | no | yes | High latency, monitoring only. |

**One device for both directions is best.** Two devices run on two clocks; the agent then brings the input in
through `zita-a2j`, which resamples it (about 2 ms extra).

## Install on a Pi 3B+ (exact steps)

1. On your computer, open **Raspberry Pi Imager**. Device: *Raspberry Pi 3*. OS: *Raspberry Pi OS (other) >
   Raspberry Pi OS Lite (64-bit)*. Storage: your SD card. Click *Next*, then *Edit settings*:
   * hostname: `tonezone`
   * set a user name and password (for example `pi`)
   * Wi-Fi: your network and country (skip it if you use an Ethernet cable)
   * *Services* tab: turn on **SSH** (password login is fine)

   Write the card, put it in the Pi, plug in the USB audio adapter, power it on and wait about 2 minutes.

2. On your computer, open a terminal (Windows: PowerShell) and log in:

   ```bash
   ssh pi@tonezone.local
   ```

   (If `tonezone.local` is not found, use the Pi's IP address from your router's device list.)

3. On the Pi, run the installer:

   ```bash
   curl -fsSL https://github.com/goglesquirmintontheiii/tone-zone/releases/latest/download/install.sh | sudo bash
   ```

   With a screen attached add `-s -- --screen`:

   ```bash
   curl -fsSL https://github.com/goglesquirmintontheiii/tone-zone/releases/latest/download/install.sh | sudo bash -s -- --screen
   ```

   It takes 5 to 10 minutes on a Pi 3 (package downloads). At the end it prints the address and a **6 digit
   pairing code**:

   ```
     Tone Zone 0.9.0 is running.
     Address:       tonezone.local   (192.168.1.42)
     Pairing code:  493017
   ```

4. In Tone Zone on your computer: **Pi tab > Add a Pi**, pick the Pi it found (or type `tonezone.local`), type
   the code. Then push presets from the Presets section.

**Without internet on the Pi (manual path).** Download `install.sh` and `pi-bundle-<version>-arm64.tar.gz`
(and its `.sig`) from the GitHub release page on your computer, then:

```bash
scp install.sh pi-bundle-0.9.0-arm64.tar.gz pi-bundle-0.9.0-arm64.tar.gz.sig pi@tonezone.local:
ssh pi@tonezone.local sudo bash install.sh --bundle pi-bundle-0.9.0-arm64.tar.gz
```

The installer still needs the Pi OS package mirror for `jackd2` and friends. Installer options:
`--screen` (on-device UI), `--pwm` (hardware PWM on GPIO 12 / 13 for LEDs, needs a reboot, not with the 3.5 mm
jack as output), `--no-tuning`, `--version V`, `--allow-unsigned` (development bundles), `--force`.

What the installer does: checks the board (Pi 3B / 3B+ / 4 / 5), 64-bit OS, Bookworm or newer, free space;
installs `jackd2 zita-ajbridge alsa-utils avahi-daemon libnss-mdns gpiod curl openssl` (plus `cage` and `cog`
or Chromium with `--screen`) and Node.js 18+ (the distro's, else the official arm64 build); downloads the
release bundle, checks its SHA-256 and Ed25519 signature; creates the `tonezone` system user (groups audio,
gpio, video, input); unpacks into `/opt/tonezone/a` (or `b` on a reinstall) with `/opt/tonezone/current`
pointing at it; installs `tonezone.service`, the Avahi service file, real-time limits, a sudoers rule for the
small root helper `/usr/local/sbin/tonezone-root`, and the `tonezone` command; sets the CPU governor to
`performance`, turns Wi-Fi power save off and adds a link-local fallback profile for direct cables; starts the
service and prints the pairing code.

**The `tonezone` command on the Pi:** `tonezone pair` (show the code), `tonezone status`, `tonezone logs`,
`tonezone restart`, `tonezone update`, `tonezone rollback`, `tonezone unpair`, `tonezone version`.

**Uninstall:** `sudo tonezone uninstall` (removes everything, presets too) or
`sudo tonezone uninstall --keep-data` (keeps `/var/lib/tonezone`: presets, models, pairing).

## Connect the desktop app

* **Found automatically.** The Pi advertises `_tonezone._tcp` over mDNS (Avahi). The Pi tab scans every 15
  seconds and lists Pis it finds, paired or not.
* **Wi-Fi or Ethernet to your router.** Nothing to set up.
* **Direct cable, computer to Pi.** One Ethernet cable, no router. With no DHCP server both sides fall back to
  link-local addresses (`169.254.x.x`): the installer adds a `tonezone-direct` link-local profile on the Pi
  (NetworkManager) for this. On a Linux desktop with NetworkManager the wired port must be "Link-local only" or
  "Shared to other computers"; the desktop side can create a "Tone Zone direct" link-local profile for a port
  (`window.tz.pi.setupDirect(iface)`). The tab also probes link-local neighbours and `10.42.0.x` (shared mode)
  directly, so it finds the Pi even when mDNS is blocked.
* **Manual address.** Type the IP or hostname in Add a Pi.
* **Pairing.** The first time, type the 6 digit code. It is printed by the installer, by `tonezone pair`, in the
  journal, and on the screen UI; the status LED double blinks while the Pi is not paired. Five wrong codes lock
  pairing for 30 seconds. A code works once. The desktop keeps a random token; the Pi stores only its hash.
* **Phones and tablets** on the same network can open `http://tonezone.local:7650/` for the same UI as the
  screen (they pair with the code too).

## Presets, banks and switching

* **Banks of four** (A to D), up to 128 banks, edited in the Pi tab. Pushing a preset copies it with every NAM
  model and IR it uses; files are stored by SHA-256, so a model used by 20 presets is copied once.
* After a push the Pi **measures the preset's DSP load** (renders 2 s offline at low priority) and the tab
  shows the number.
* **Fast switching.** The engine can build presets ahead of time (`preload`) and switch with a pointer swap
  (`useGraph`). The agent keeps the next and previous presets and the current bank built (3 on a 1 GB board,
  6 otherwise), and the outgoing preset stays built, so going back is instant too.
* **Bank changes** wait for a preset press by default (like a floor unit; the slot LEDs blink while you pick).
* **Parameter edits** from the screen, a phone or the desktop are applied live and saved in the preset.
* **DSP budget.** Per Pi, 40 to 95% of one audio cycle (Pi 3 default 65%, others 70%). The engine's auto quality
  lowers oversampling when a preset goes over it, and the status LED blinks fast.
* **Not supported on the Pi:** desktop device blocks (Helix USB, `extio` with no matching ports), custom screen
  scripts and pedal graphics (the Pi shows parameters only). Knobs with an inverted range or worked out from other
  controls are not editable on the Pi (they still play as set).

## Footswitches and LEDs

* **Footswitches** go between a GPIO pin and ground; the internal pull-up is turned on, no resistors needed.
  Defaults: header pins 11, 13, 15, 16 (GPIO 17, 27, 22, 23) = preset A to D, hold A = bank down, hold D = bank
  up. Debounce 20 ms (5 to 80), hold time 600 ms. Momentary switches act on press (or on release when the switch
  also has a hold action); latching switches act on every change.
* **Actions:** preset up / down, bank up / down, preset A to D, toggle a block (by name), tap tempo, tuner
  (mutes the output), looper rec / play, mute.
* **LEDs** through a 330 ohm resistor to ground. Each shows one thing: preset A to D active, a block on, tap
  tempo, tuner, a circuit block output, or status. **On / off** or **dimmable (PWM)** with a lit brightness and
  an unlit glow.
* **PWM.** GPIO 12, 13, 18, 19 can use hardware PWM (`/sys/class/pwm`, after `--pwm` or
  `dtoverlay=pwm-2chan`). Pi 3 and Pi 4 have two channels (12 / 18 share one, 13 / 19 the other). **On Pi 3 / 4
  the 3.5 mm jack is driven by the same PWM block**, so while the built-in jack is the output the agent uses
  software PWM for every LED. Any other pin uses software PWM (200 Hz, in the GPIO helper).
* **Status LED** (default pin 37, GPIO 26): steady = running, slow blink = no audio, fast blink = over the DSP
  budget, double blink = waiting to pair, very fast = identify (Blink LED button).
* GPIO goes through `tz-gpio`, a small C helper that uses the kernel GPIO character device (`/dev/gpiochipN`,
  uAPI v2, the interface libgpiod wraps). That keeps it independent of the libgpiod version (Bookworm has 1.6,
  Trixie 2.x with different tools) and works on the Pi 5's RP1 chip. `gpiod` tools are installed for debugging
  (`gpioinfo`).

## Screen

The on-device UI is a small web page served by the agent and shown full screen by **cage** (a one-window
Wayland compositor) with **cog** (WPE WebKit), or Chromium when cog is not available. Enable it with
`--screen` at install time, or by choosing a screen in the tab's Display section.

It shows the preset name, bank and slot, big previous / next buttons, the blocks as big tiles (tap to turn
on or off, arrow to edit), block parameters as big sliders and option buttons, the presets of every bank, a
tuner and in / out levels, plus DSP, CPU and temperature. It cannot add, move or rewire blocks.

**Why a web page and not SDL (the original plan).** For a first version on a 3B+ this is the lightest route
that works on every screen without new native code: one UI for the Pi screen and for phones, written once; cage
and cog are Pi OS packages; the page has no framework, no web fonts, no animations, and only redraws what
changed (meters at 10 per second). The kiosk runs at a lower priority than audio, and the engine's audio
thread runs with real-time priority under JACK, so the UI cannot cause dropouts unless the Pi runs out of
memory. The cost is RAM: about 80 to 150 MB for cog (more for Chromium) against 15 to 25 MB for an SDL app. On a
1 GB Pi 3 that is fine. A native SDL / KMS UI and the 128 x 64 OLED status screen are still planned.

## Updates

* **Bundles.** `pi-bundle-<version>-arm64.tar.gz` holds the engine, the GPIO helper, the agent, the screen UI,
  scripts and units, with a `manifest.json` listing the SHA-256 of every file. Bundles are **signed with an
  Ed25519 key** (detached `.sig`, base64). The public key is built into the agent and the installer. The Pi
  refuses unsigned or mismatched bundles; unsigned development bundles only install when "Allow unsigned dev
  bundles" (`updates.allowUnsigned`) is turned on.
* **A/B slots.** `/opt/tonezone/a` and `/opt/tonezone/b`, `/opt/tonezone/current` points at the running one. An
  update unpacks and checks the bundle into the other slot, switches the link and restarts the service. The new
  version then checks itself: the engine renders a short clip offline with the expected result and stays up.
  If that fails it switches back by itself. If the new version crashes before it can check itself,
  `boot-check.sh` (runs before every start) switches back after 3 tries. The previous version stays available
  for a manual **Roll back** (`tonezone rollback`).
* **Three ways in:** the Pi downloads the latest release itself (needs internet); the desktop downloads it and
  pushes it over the network or the direct cable (the Pi needs no internet); or pick a bundle file in the tab.
* Updates never install by themselves during playing (auto updates are not implemented yet).

## Troubleshooting

| Problem | What to do |
|---|---|
| `tonezone.local` not found | Use the IP address (router list, or `hostname -I` on the Pi). Windows 10 needs Bonjour or an IP. Check that avahi runs: `systemctl status avahi-daemon`. |
| The tab does not list the Pi | Add a Pi > type the address. Check `tonezone status` on the Pi. The API is only reachable from private and link-local addresses. |
| "Wrong pairing code" | Run `tonezone pair` for the current code (a code works once). After 5 wrong tries wait 30 s. |
| No sound | `tonezone logs`: look for `JACK:` and `audio running`. List devices with `aplay -l` and `arecord -l`. Pick the input and output in the tab's Audio section. |
| The Audio section says "No audio" | It gives the reason. A device that refuses small buffers is retried at 256, 512 and 1024 frames by itself. "In use by another program": a desktop sound server (PulseAudio or PipeWire) holds the device; stop it or pick PipeWire as the audio server if the desktop runs PipeWire. |
| No sound on a Pi with a desktop | The desktop runs PipeWire and Tone Zone joins it. `tonezone logs` should show `using PipeWire (the desktop's, user 1000)` and `audio: input ..., output ...`. If it says PipeWire's JACK library is missing, run the installer again (it adds `pipewire-jack` and `acl`). Someone has to be logged in to the desktop (auto-login is fine). |
| Only 2 inputs on a Helix or other multichannel interface | Set the device's profile to Pro Audio in the desktop's sound settings (or `pavucontrol` > Configuration), then pick the input channel in the Audio section (a Helix sends the dry guitar on USB 7). |
| Check the outputs | The Audio section's Test tone plays a 440 Hz or 1 kHz sine, pink noise or a sweep on both sides or one, instead of the preset, for up to 30 s. |
| `jackd` errors like "cannot set hw params" | The device does not support 48 kHz or the buffer: try buffer 256 and periods 3 (USB) in the Audio section. |
| Crackles / dropouts | Raise the buffer (128 to 256), lower the DSP budget, use Lite / Feather NAM models, avoid USB hubs. On a Pi 3 Wi-Fi and Ethernet share USB with the audio adapter: try the other one. Check `tonezone status` for under-voltage (use the official power supply). |
| Thin, quiet guitar on a cheap USB adapter | Its input is mic / line level. Put a boost pedal, buffer or DI in front. |
| Footswitches do nothing | `tonezone logs` should show `GPIO: /dev/gpiochip0 (pinctrl-bcm2835...)` and `n footswitches`. Check wiring to ground. `gpioinfo` shows if a pin is used by something else. |
| LED does not dim | Hardware PWM needs `--pwm` and a reboot, and is off while the 3.5 mm jack is the output (software PWM then). |
| Screen stays black | `systemctl status tonezone-kiosk`; is `cog` or Chromium installed? Re-run the installer with `--screen`. |
| An update failed | It rolled back by itself; the tab shows "update failed". `journalctl -u tonezone -b` has the reason. |
| Start over | `sudo tonezone uninstall --keep-data`, then install again. |

Logs: `tonezone logs` or `journalctl -u tonezone -f`. The tab's Logs section shows the same lines live, and
"Support bundle" saves state and logs as a JSON file.

## How it works

```
  Desktop app (Pi tab)                         Raspberry Pi
  +----------------------+   HTTP + WebSocket   +-------------------------------------------+
  | app/main/pi.js       | <------------------> | tz-agent (tonezone.service, user tonezone) |
  | find, pair, push,    |    port 7650         |  API, pairing, preset store, preloading,  |
  | updates              |                      |  GPIO (tz-gpio), LEDs, stats, updates,    |
  | pages/pi-live.js     |                      |  screen UI files, mDNS fallback           |
  +----------------------+                      |    | child processes                      |
                                                |    +-- jackd (ALSA, real-time) [+ zita-a2j]|
                                                |    +-- tonezone-engine (JSON lines on      |
                                                |        stdin / stdout, same as desktop)    |
                                                +-------------------------------------------+
```

* **Engine.** The same C++ engine as the desktop, cross compiled for aarch64 (`scripts/build-engine.sh arm64`,
  `-mcpu=cortex-a53 -fsigned-char`, NEON always on, Eigen picks it up). ARM specifics: denormals are flushed with
  the FZ bit of FPCR on every process call; plain `char` is signed as on x86 (NAM's WDL code asserts it). New
  engine commands `preload`, `useGraph` and `dropCache` keep presets built for instant switching. `TZ_JACK_LIB`
  picks the JACK library. Offline renders on the ARM build match the x86 build within float rounding.
* **Audio host.** On Pi OS Lite the agent runs `jackd -R -P80 -d alsa` itself (real-time limits come from the
  systemd unit: `LimitRTPRIO=95`, `LimitMEMLOCK=infinity`). When PipeWire already runs (desktop Pi OS) the
  engine uses PipeWire's JACK layer. A direct ALSA backend without a server is still an option for later.
* **tz-agent** is Node.js 18+ with no npm dependencies (HTTP, WebSocket and mDNS are small built-in modules).
  Data lives in `/var/lib/tonezone`: `state.json` (banks, current preset, config, token hashes), `presets/`,
  `files/` (models and IRs by hash).
* **Differences from the original plan:** the agent starts the engine as a child process (one service instead
  of two, so restarting the agent restarts audio for a second); the API is plain HTTP with a bearer token on the
  local network (HTTPS with pinned certificates is planned); the screen UI is a web page in a kiosk (see above).

API summary (all JSON, `Authorization: Bearer <token>` except where noted): `GET /api/info` (public),
`POST /api/pair` (public), `GET /api/state`, `GET /api/stats`, `GET|POST /api/presets`,
`GET|DELETE /api/presets/:id`, `POST /api/files/check`, `PUT /api/files/:sha.ext`, `GET|PUT /api/banks`,
`POST /api/select` ({bank, slot} or {action}), `POST /api/param`, `POST /api/bypass`, `POST /api/tap`,
`POST /api/tuner`, `POST /api/mute`, `GET /api/config`, `PUT /api/config/:part`, `GET /api/audio/devices`,
`GET /api/gpio/leds`, `POST /api/gpio/test`, `POST /api/identify`, `POST /api/reboot`, `POST /api/budget`,
`GET /api/logs`, `GET /api/support`, `POST /api/update` (raw bundle, `X-TZ-Signature`), `POST /api/update/verify`,
`POST /api/update/check`, `POST /api/update/download`, `POST /api/update/rollback`, `GET /api/update/status`.
WebSocket `/ws`: `state`, `stats` (1 per second), `meter` (10 per second when asked), `log`, `param`, `block`,
`tap`, `progress`, `config`.

## Implemented vs planned

| Feature | State |
|---|---|
| aarch64 engine (Pi 3B / 3B+ / 4 / 5), NAM A1 / A2, IRs, all blocks | done, tested under qemu |
| Installer, uninstaller, `tonezone` command, systemd units | done, not yet run on a Pi |
| Pairing, HTTP + WebSocket API, mDNS (Avahi + JS fallback) | done |
| Preset push with models / IRs, banks, measured DSP | done |
| Preloaded switching, bank wait | done |
| Footswitches (momentary, latching, hold, debounce), LEDs on / off and PWM | done, GPIO helper untested on real hardware |
| Audio device list (separate in / out), jackd + zita-a2j | done, untested with real devices |
| Stats: DSP, CPU, temperature, memory, xruns, throttling | done |
| Screen UI (web page in cage + cog) and phone UI | done |
| Signed A/B updates with health check and rollback, push from desktop | done |
| CI: aarch64 build on Debian Bookworm, bundle on every release | done |
| Desktop Pi tab live data (pi-live.js) | done |
| Expression pedals (ADS1115 / MCP3008), MIDI, OLED, setup hotspot, spillover | planned |
| HTTPS with pinned certificates | planned |
| Native SDL screen UI, SD card image, USB stick updates, auto updates | planned |
| Measured per algorithm cost tables for Pi 3 / 4 / 5 | planned (needs real boards) |

## Testing

Everything here runs on an x86 PC:

* `node scripts/pi-arm-render.js` renders six graphs (compressor, drive, amp, IR; NAM A1 Standard, LSTM, A2;
  chorus, phaser, delay, reverb; wah, pitch, EQ, tremolo) with the x86 and the aarch64 engine (under
  `qemu-aarch64`) and compares them. All match within float rounding (68 to 111 dB apart).
* `node scripts/pi-qemu-selftest.js` runs the agent's engine self test on the ARM binary (also in CI).
* `cd app && xvfb-run -a node scripts/pi-agent-test.js` builds real bundles, installs one into A/B slots and
  runs tz-agent in fake hardware mode (`TZ_FAKE_HW=1`: fixture `/proc` and `/sys`, simulated GPIO, the x86
  engine on the fake JACK library), then drives it with the desktop client: mDNS discovery, manual address,
  pairing (wrong and right code), preset push with NAM + IR, switching by API and by simulated footswitch presses
  (press, hold, bank wait, debounce), params, tap tempo, stats, ALSA list, hardware and software PWM LEDs,
  signed / tampered / unsigned bundles, an update with health check, manual rollback, a failing health check and
  a crash loop (both roll back), the ARM engine from the bundle under qemu, and the desktop Pi tab showing the
  fake Pi live and pushing the editor's preset through it.

What only a real Pi can test: real-time audio with jackd on real ALSA devices (latency, dropouts, CPU numbers),
the GPIO helper on `/dev/gpiochip0`, hardware PWM, the kiosk screen, Avahi, NetworkManager direct cable
fallback, the installer itself, and the glibc compatibility of the CI built binaries on Pi OS Bookworm.

## First test on a real Pi

1. Install as above with a USB adapter in and out. `tonezone status` should show `DSP` and `48000 Hz`.
2. Pair from the desktop, push the Welcome preset, play. Then a preset with a small NAM model and a cab.
3. Watch `tonezone status` for DSP and dropouts at buffer 128 and 256.
4. Wire one footswitch from pin 11 to pin 9 (ground) and an LED with 330 ohm from pin 37 to ground.
5. Try `--screen` with a monitor, and a phone on `http://tonezone.local:7650/`.
6. Try an update from the tab once a newer release exists.

Send `tonezone logs` output (or the support bundle) for anything that goes wrong.

## For maintainers: building, signing, releasing

* `scripts/build-engine.sh arm64` builds `engine/dist-pi/tonezone-engine-arm64` (cross compiles with
  `g++-aarch64-linux-gnu` on x86). It prints the newest glibc symbol needed; `TZ_MAX_GLIBC=2.36` makes it fail
  above Bookworm's. Built on Ubuntu 24.04 the binary needs glibc 2.38 (fine on Trixie, not Bookworm), which is
  why CI builds in a `debian:bookworm` container. `armhf` (32-bit) builds are possible but not supported.
* `scripts/pi-bundle.sh [version]` makes `dist-pi/` with the bundle, `install.sh`, `pi-latest.json` and
  `SHA256SUMS`, and signs the bundle when `TZ_PI_SIGNING_KEY` is set.
* **Signing key.** The public key is in `pi/release-key.pub.pem`, `pi/agent/lib/release-key.js` and
  `pi/install.sh`. The private key is never in the repo. To set up CI signing, put the PEM private key into the
  repository secret **`TZ_PI_SIGNING_KEY`** (Settings > Secrets and variables > Actions). Without the secret CI
  still publishes the bundle, unsigned: fresh installs warn and continue (they are protected by HTTPS and the
  checksum), but Pis refuse it as an update unless dev bundles are allowed. To replace the key, run
  `node scripts/pi-keygen.js ~/tz-pi-signing-key.pem` (writes the new public key into the three files) and
  update the secret; Pis installed with the old key must be reinstalled.
* `scripts/pi-sign.js <bundle> [--key file] [--verify]` signs or checks a bundle by hand.
* The release workflow builds the AppImage as before, then the `pi-bundle` job (Bookworm container) and the
  `pi-release` job attach `pi-bundle-<version>-arm64.tar.gz`, its `.sig`, `install.sh`, `pi-latest.json` and
  `SHA256SUMS` to the same release.
