// Board, paths and the fake hardware mode (TZ_FAKE_HW=1), which runs everything on a normal PC for tests:
// /proc and /sys reads go to a fixture tree, GPIO is simulated and the engine uses the fake JACK library.
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');

const FAKE = process.env.TZ_FAKE_HW === '1';
const DATA = process.env.TZ_DATA || (FAKE ? path.join(os.tmpdir(), 'tz-agent-fake') : '/var/lib/tonezone');
const SLOT = fs.realpathSync(path.resolve(__dirname, '..', '..')); // the install slot this agent runs from (/opt/tonezone/a)
const HOME = process.env.TZ_HOME || path.dirname(SLOT); // /opt/tonezone (holds a, b and the current link)
const FAKE_ROOT = process.env.TZ_FAKE_ROOT || path.join(DATA, 'fake-root');

// a /proc or /sys path, redirected into the fixture tree in fake mode
const sys = (p) => (FAKE ? path.join(FAKE_ROOT, p) : p);
function read(p, def = null) {
  try { return fs.readFileSync(sys(p), 'utf8'); } catch { return def; }
}
function write(p, v) {
  fs.writeFileSync(sys(p), String(v));
}

const FAKE_MODELS = {
  pi3bp: 'Raspberry Pi 3 Model B Plus Rev 1.3',
  pi3b: 'Raspberry Pi 3 Model B Rev 1.2',
  pi4: 'Raspberry Pi 4 Model B Rev 1.4',
  pi5: 'Raspberry Pi 5 Model B Rev 1.0',
};

function setupFake() {
  if (!FAKE) return;
  const model = FAKE_MODELS[process.env.TZ_FAKE_MODEL || 'pi3bp'] || FAKE_MODELS.pi3bp;
  const put = (p, s, keep) => {
    const f = path.join(FAKE_ROOT, p);
    if (keep && fs.existsSync(f)) return;
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, s);
  };
  put('proc/device-tree/model', model + '\0');
  put('sys/class/thermal/thermal_zone0/temp', '48312\n', true);
  put('proc/asound/cards', [
    ' 0 [Headphones     ]: bcm2835_headpho - bcm2835 Headphones',
    '                      bcm2835 Headphones',
    ' 1 [Device         ]: USB-Audio - USB Audio Device',
    '                      C-Media Electronics Inc. USB Audio Device at usb-3f980000.usb-1.2, full speed',
    ' 2 [vc4hdmi        ]: vc4-hdmi - vc4-hdmi',
    '                      vc4-hdmi',
    '',
  ].join('\n'));
  put('proc/asound/pcm', [
    '00-00: bcm2835 Headphones : bcm2835 Headphones : playback 8',
    '01-00: USB Audio : USB Audio : playback 1 : capture 1',
    '02-00: MAI PCM i2s-hifi-0 : MAI PCM i2s-hifi-0 : playback 1',
    '',
  ].join('\n'));
  // hardware PWM chip with two channels (dtoverlay=pwm-2chan)
  put('sys/class/pwm/pwmchip0/npwm', '2\n');
  put('sys/class/pwm/pwmchip0/export', '');
  put('sys/class/pwm/pwmchip0/unexport', '');
}

function boardInfo() {
  const raw = (read('/proc/device-tree/model', '') || '').replace(/\0/g, '').trim();
  let model = 'unknown';
  if (/Raspberry Pi 5|Compute Module 5/.test(raw)) model = 'pi5';
  else if (/Raspberry Pi 4|Compute Module 4|Raspberry Pi 400/.test(raw)) model = 'pi4';
  else if (/Raspberry Pi 3 Model B Plus|Raspberry Pi 3 Model A Plus/.test(raw)) model = 'pi3bp';
  else if (/Raspberry Pi 3|Compute Module 3/.test(raw)) model = 'pi3b';
  else if (/Zero 2/.test(raw)) model = 'pi02';
  const memKb = Number(((read('/proc/meminfo', '') || '').match(/MemTotal:\s+(\d+)/) || [])[1] || 0) || os.totalmem() / 1024;
  const ram = FAKE && model === 'pi3bp' ? 1 : Math.max(1, Math.round(memKb / 1024 / 1024));
  const arch = FAKE ? 'arm64' : process.arch;
  return { model, raw: raw || os.hostname(), ram, arch, os: arch === 'arm64' ? '64-bit' : arch === 'arm' ? '32-bit' : arch, fake: FAKE };
}

module.exports = { FAKE, DATA, SLOT, HOME, FAKE_ROOT, sys, read, write, setupFake, boardInfo };
