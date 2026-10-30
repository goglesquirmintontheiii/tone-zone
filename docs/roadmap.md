# Roadmap

Plans for bigger things that aren't in the app yet. Rough order, not dates.

## Windows support

Goal: a Windows 10/11 (x64) build that works like the Linux one, released from the same CI run as the AppImage.

### 1. Audio engine
The engine talks to JACK / PipeWire today (`engine/src/jack_dl.cpp` loads libjack at runtime). Everything above that
(blocks, graph, offline render) is plain C++ and should build on Windows as is.
- Add an audio backend layer so the engine can run on something other than JACK. Two backends on Windows:
  - **WASAPI** (shared and exclusive mode): works on every machine, no drivers needed. Exclusive mode for low latency.
  - **ASIO**: what most audio interfaces ship for low latency on Windows. Use the ASIO SDK through a small wrapper
    (or RtAudio, which supports both WASAPI and ASIO and is MIT licensed).
- Keep JACK on Linux. The backend is picked at startup and shown in Settings.
- Port listing and routing: JACK lets us create named ports and connect them anywhere. WASAPI/ASIO give a device with
  numbered channels, so the AUDIO IN / OUT panels map board jacks to device channels instead of PipeWire ports.
- Buffer size and sample rate come from the device (ASIO control panel or WASAPI period), not a PipeWire quantum.
- MIDI: the app uses Web MIDI in Electron, which works on Windows already. Check foot controller learn and clock.

### 2. Build
- CMake already drives the engine. Add an MSVC (or clang-cl) build with the same x86-64-v2 / v3 split
  (`/arch:AVX2` for v3) and pick the binary at runtime like on Linux.
- Replace the few POSIX bits (stdin/stdout pipes are fine; check signals, `mmap`, paths and `dlopen` in jack_dl).
- `scripts/build-engine.sh` gets a PowerShell twin, or a CMake preset that both use.

### 3. App
- electron-builder target `nsis` (installer) plus `portable` (single exe). App icon as `.ico`.
- Paths: user data already goes through Electron's `app.getPath`, so presets, library and settings land in
  `%APPDATA%\Tone Zone`. Check every place that builds a path by hand (`main/library.js`, `main/capture.js`).
- Capture tab: the NAM trainer setup uses Python. On Windows, find `py` / `python`, create the venv with
  `Scripts\` instead of `bin/`, and install the CUDA build of PyTorch when an NVIDIA GPU is present.
- Settings: audio device picker (backend, input and output device, channels, buffer, sample rate).
- Window chrome, file dialogs and drag and drop of presets need a quick check on Windows.

### 4. CI and release
- Add a `windows-latest` job next to the AppImage job: build the engine, run the engine self-test
  (`tonezone-engine-v2.exe --list`) and the offline preset check, then build the installer.
- Attach `Tone-Zone-<version>-Setup.exe` and the portable exe to the same GitHub release.
- Code signing: unsigned builds trigger SmartScreen warnings. Start unsigned, add a certificate later.

### 5. Testing
- The playwright UI tests run on Windows runners too (no xvfb needed). The fake JACK library used in tests gets a
  matching fake backend so tests don't need an audio device.
- Manual checks on real hardware: latency with WASAPI exclusive and with ASIO on a common interface, hot plugging a
  USB interface, sleep and resume.

## Raspberry Pi

The full plan is in [raspberry-pi.md](raspberry-pi.md): the same engine built for aarch64 on a Pi 4 or Pi 5,
installed over SSH with one command, found on the network as `tonezone.local` (Wi-Fi, Ethernet or one cable straight
from the computer), many presets in banks switched with GPIO footswitches, signed updates with rollback, full NAM
support, and an optional very light screen UI. The Pi tab already shows the finished UI with demo data; it does not
talk to a real Pi yet. Next: phase 1 (ARM build, denormal fix, measured block costs on real boards).

## Pedal Factory

The Factory tab designs a pedal's look. Next: pick and wire the sound blocks (the circuit panel), map controls to
their parameters, and save the result as a block that shows up in the block list.
