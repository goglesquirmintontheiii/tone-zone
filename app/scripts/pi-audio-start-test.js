// Starting JACK on a Pi: a device that refuses small buffers gets larger ones, a busy device and a missing PipeWire
// are reported, and the status says what happened. Runs the agent's real start code against a fake jackd.
const fs = require('fs');
const os = require('os');
const path = require('path');
const T = fs.mkdtempSync(path.join(os.tmpdir(), 'tz-audio-start-'));
const BIN = path.join(T, 'bin');
fs.mkdirSync(BIN);
// fake jackd: FAKE_JACKD_MIN = smallest period it accepts, FAKE_JACKD_BUSY=1 = device in use
fs.writeFileSync(path.join(BIN, 'jackd'), `#!/bin/sh
p=0; prev=""
for a in "$@"; do [ "$prev" = "-p" ] && p=$a; prev=$a; done
echo "$@" >> "${T}/jackd-args"
if [ "$FAKE_JACKD_BUSY" = 1 ]; then echo "ALSA: Cannot open PCM device alsa_pcm for playback. Falling back to capture-only mode"; echo "ALSA: Device or resource busy" >&2; exit 255; fi
if [ "$p" -lt "\${FAKE_JACKD_MIN:-0}" ]; then echo "ALSA: cannot set period size to $p frames for playback" >&2; echo "Cannot initialize driver" >&2; exit 255; fi
exec sleep 30
`, { mode: 0o755 });
for (const tool of ['zita-a2j']) fs.writeFileSync(path.join(BIN, tool), '#!/bin/sh\nexec sleep 30\n', { mode: 0o755 });
process.env.PATH = BIN + ':' + process.env.PATH;
process.env.TZ_FAKE_HW = '1';
process.env.TZ_TEST_REAL_AUDIO = '1';
process.env.TZ_DATA = path.join(T, 'data');
const AG = path.join(__dirname, '..', '..', 'pi', 'agent', 'lib');
const hw = require(path.join(AG, 'hw.js'));
hw.setupFake();
const audio = require(path.join(AG, 'audio.js'));
let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const base = { input: '', output: '', rate: 48000, buffer: 128, periods: 3, server: 'auto' };
(async () => {
  const srv = new audio.AudioServer();
  // USB in + out (same card), device happy at 128
  let r = await srv.start(Object.assign({}, base, { input: 'hw:CARD=Device,DEV=0', output: 'hw:CARD=Device,DEV=0' }));
  ok(r.mode === 'jackd' && r.status.ok && /128 frames x 3/.test(r.status.text) && /\(in \+ out\)/.test(r.status.text), 'JACK starts on a USB device at 128 frames: ' + r.status.text);
  srv.stop();
  // the headphone jack refuses small periods: retried up to a size it accepts
  process.env.FAKE_JACKD_MIN = '512';
  fs.writeFileSync(path.join(T, 'jackd-args'), '');
  r = await srv.start(Object.assign({}, base, { input: 'hw:CARD=Device,DEV=0', output: 'hw:CARD=Headphones,DEV=0' }));
  const tries = fs.readFileSync(path.join(T, 'jackd-args'), 'utf8').trim().split('\n').length;
  ok(r.mode === 'jackd' && r.status.ok && /512 frames/.test(r.status.text), `a device that refuses 128 frames runs at 512 after ${tries} tries: ${r.status.text}`);
  ok(r.bridge === 'tz-in' && /input resampled/.test(r.status.text), 'a different input card comes in through the bridge');
  srv.stop();
  // refuses everything: a clear error with the reason
  process.env.FAKE_JACKD_MIN = '99999';
  r = await srv.start(Object.assign({}, base, { output: 'hw:CARD=Headphones,DEV=0' }));
  ok(r.mode === 'none' && !r.status.ok && /could not open .*cannot set period size/i.test(r.status.error), 'a device that refuses every buffer gives a clear error: ' + r.status.error);
  srv.stop();
  delete process.env.FAKE_JACKD_MIN;
  // busy device: says so, no endless retries
  process.env.FAKE_JACKD_BUSY = '1';
  fs.writeFileSync(path.join(T, 'jackd-args'), '');
  r = await srv.start(Object.assign({}, base, { output: 'hw:CARD=Device,DEV=0', input: 'hw:CARD=Device,DEV=0' }));
  const busyTries = fs.readFileSync(path.join(T, 'jackd-args'), 'utf8').trim().split('\n').length;
  ok(!r.status.ok && /in use by another program/.test(r.status.error) && busyTries === 1, `a busy device is reported after one try: ${r.status.error}`);
  srv.stop();
  delete process.env.FAKE_JACKD_BUSY;
  // PipeWire picked but not running: falls back to JACK
  r = await srv.start(Object.assign({}, base, { server: 'pipewire', input: 'hw:CARD=Device,DEV=0', output: 'hw:CARD=Device,DEV=0' }));
  ok(r.mode === 'jackd' && r.status.ok, 'PipeWire picked but not running: JACK is used instead');
  srv.stop();
  console.log(fails ? fails + ' FAILED' : 'all passed');
  process.exit(fails ? 1 : 0);
})();
