// Raspberry Pi agent test in fake hardware mode (TZ_FAKE_HW=1): runs tz-agent from a real bundle installed into
// A/B slots, then drives it with the desktop client (app/main/pi.js): discovery, pairing, preset push with NAM
// and IR files, switching by API and by simulated footswitch, params, stats, LED PWM, signed / tampered /
// failing updates with rollback, the ARM engine under qemu, and the Pi tab showing the live (fake) Pi.
//   cd app && NODE_PATH=$(npm root -g) xvfb-run -a node scripts/pi-agent-test.js
// Env: TZ_ENGINE (x86 engine with preload support), TZ_SKIP_UI=1, TZ_SKIP_QEMU=1.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawn, spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..', '..');
const T = fs.mkdtempSync(path.join(os.tmpdir(), 'tz-pi-agent-'));
const PORT = 7600 + Math.floor(Math.random() * 300);
const MDNS = 5300 + Math.floor(Math.random() * 90);
process.env.TZ_MDNS_PORT = String(MDNS);
process.env.TZ_PI_PORT = String(PORT);
const { createClient } = require(path.join(ROOT, 'app/main/pi.js'));

const ENGINE = process.env.TZ_ENGINE || [path.join(ROOT, 'engine/build/tonezone-engine'), path.join(ROOT, 'engine/build-v2/tonezone-engine'), path.join(ROOT, 'engine/dist/tonezone-engine-v2')]
  .filter((p) => fs.existsSync(p)).sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0];
const FAKEJACK = path.join(ROOT, 'engine/tests/fakejack/libjack.so.0');
const HOME = path.join(T, 'opt'), DATA = path.join(T, 'data'), DESK = path.join(T, 'desk');
let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; return c; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 8000, step = 100) {
  const t0 = Date.now();
  for (;;) { let v; try { v = await fn(); } catch { v = null; } if (v) return v; if (Date.now() - t0 > ms) return null; await sleep(step); }
}

// ---- test signing key and bundles
const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
const PUB = path.join(T, 'test.pub.pem');
fs.writeFileSync(PUB, publicKey.export({ type: 'spki', format: 'pem' }));
const PRIV = privateKey.export({ type: 'pkcs8', format: 'pem' });
function bundle(version, { agentDir, sign = true } = {}) {
  const out = path.join(T, 'bundles', version);
  const r = spawnSync('bash', [path.join(ROOT, 'scripts/pi-bundle.sh'), version], { encoding: 'utf8', env: Object.assign({}, process.env, { TZ_PI_OUT: out, TZ_PI_AGENT_DIR: agentDir || '', TZ_PI_SIGNING_KEY: sign ? PRIV : '' }) });
  if (r.status !== 0) throw new Error('bundle failed: ' + r.stderr + r.stdout);
  return path.join(out, `pi-bundle-${version}-arm64.tar.gz`);
}
// first install, like install.sh: unpack into slot a, link current
function installSlotA(file) {
  fs.mkdirSync(path.join(HOME, 'x'), { recursive: true });
  spawnSync('tar', ['-xzf', file, '-C', path.join(HOME, 'x')]);
  fs.renameSync(path.join(HOME, 'x', 'tonezone'), path.join(HOME, 'a'));
  fs.rmSync(path.join(HOME, 'x'), { recursive: true });
  fs.symlinkSync(path.join(HOME, 'a'), path.join(HOME, 'current'));
  fs.copyFileSync(path.join(HOME, 'a', 'system', 'boot-check.sh'), path.join(HOME, 'boot-check.sh'));
}

// ---- the agent, run the way systemd does: boot-check.sh, then node current/agent/tz-agent.js
let agent = null, agentLog = '';
function startAgent() {
  spawnSync('sh', [path.join(HOME, 'boot-check.sh')], { env: Object.assign({}, process.env, { TZ_HOME: HOME }) });
  const env = Object.assign({}, process.env, {
    TZ_FAKE_HW: '1', TZ_FAKE_MODEL: 'pi3bp', TZ_DATA: DATA, TZ_HOME: HOME, TZ_PORT: String(PORT), TZ_ENGINE: ENGINE, TZ_JACK_LIB: FAKEJACK,
    TZ_LOOPBACK_TRUSTED: '0', TZ_TEST_PUBKEY: PUB, TZ_MDNS_PORT: String(MDNS),
  });
  agent = spawn(process.execPath, [path.join(HOME, 'current', 'agent', 'tz-agent.js')], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  agent.stdout.on('data', (d) => (agentLog += d));
  agent.stderr.on('data', (d) => (agentLog += d));
  const p = agent;
  p.exited = new Promise((r) => p.on('exit', (c) => r(c)));
  return p;
}
async function stopAgent() {
  if (!agent || agent.exitCode !== null) return;
  agent.kill('SIGTERM');
  await Promise.race([agent.exited, sleep(3000)]);
  try { agent.kill('SIGKILL'); } catch {}
}
const info = async () => { const r = await fetch(`http://127.0.0.1:${PORT}/api/info`); return r.json(); };
const waitUp = () => until(() => info().catch(() => null), 15000);

// a preset as pi-live.js makes it (graph with absolute model / IR paths + block list)
function makeIr(file) {
  const n = 1024, b = Buffer.alloc(44 + n * 4);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 4, 4); b.write('WAVE', 8); b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(3, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(48000, 24); b.writeUInt32LE(192000, 28); b.writeUInt16LE(4, 32); b.writeUInt16LE(32, 34); b.write('data', 36); b.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) b.writeFloatLE(i === 0 ? 1 : Math.exp(-i / 100) * Math.sin(i), 44 + i * 4);
  fs.writeFileSync(file, b);
}
function piPreset(id, name, withNam) {
  const ir = path.join(T, 'cab.wav');
  if (!fs.existsSync(ir)) makeIr(ir);
  const nodes = [{ id: 'd', algo: 'drive', nIn: 1, nOut: 1, opts: {}, params: { gain: 0.4 }, bypass: false }, { id: 'dl', algo: 'delay', nIn: 1, nOut: 1, opts: {}, params: {}, bypass: true }];
  if (withNam) nodes.push({ id: 'n', algo: 'nam', nIn: 1, nOut: 1, opts: { files: [path.join(ROOT, 'engine/test_models/lstm.nam')] }, params: {}, bypass: false }, { id: 'c', algo: 'ir', nIn: 1, nOut: 1, opts: { files: [ir] }, params: {}, bypass: false });
  const cables = [];
  let prev = '__in';
  for (const n of nodes) { cables.push({ from: { node: prev, port: 0 }, to: { node: n.id, port: 0 } }); prev = n.id; }
  cables.push({ from: { node: prev, port: 0 }, to: { node: '__out', port: 0 } }, { from: { node: prev, port: 0 }, to: { node: '__out', port: 1 } });
  const blocks = [
    { id: 'd', name: 'Drive', bypass: false, canBypass: true, params: [{ p: 'gain', label: 'GAIN', kind: 'knob', min: 0, max: 1, value: 0.4 }] },
    { id: 'dl', name: 'Delay', bypass: true, canBypass: true, tap: true, params: [] },
  ];
  if (withNam) blocks.push({ id: 'n', name: 'NAM', bypass: false, params: [] }, { id: 'c', name: 'Cab IR', bypass: false, params: [] });
  return { id, name, graph: { nodes, cables }, blocks };
}

(async () => {
  console.log(`engine: ${ENGINE}\ntmp: ${T}, port ${PORT}, mDNS ${MDNS}`);
  if (!ENGINE || !fs.existsSync(FAKEJACK)) { console.error('need an x86 engine build and the fake JACK lib'); process.exit(2); }
  ok(fs.readFileSync(path.join(ROOT, 'app/main/pi-mdns.js'), 'utf8') === fs.readFileSync(path.join(ROOT, 'pi/agent/lib/mdns.js'), 'utf8'), 'mDNS module identical on desktop and Pi');

  // ---------------------------------------------------------------- install + start
  const b1 = bundle('0.9.0-t1');
  installSlotA(b1);
  startAgent();
  const i0 = await waitUp();
  ok(i0 && i0.version === '0.9.0-t1' && i0.model === 'pi3bp' && i0.ram === 1, `agent up from slot a: ${i0 && i0.board}, ${i0 && i0.version}`);

  // ---------------------------------------------------------------- discovery + pairing
  const events = [];
  const client = createClient({ dataRoot: DESK, emit: (id, msg) => events.push({ id, msg }) });
  const list = await client.scan({ timeout: 1500 });
  const viaMdns = list.find((d) => d.online);
  if (viaMdns) ok(true, `found by mDNS: ${viaMdns.name} at ${viaMdns.addr}`);
  else console.log('note: multicast does not work in this container, using the manual address');
  const probed = await client.probe('127.0.0.1');
  ok(probed && probed.id === i0.id && probed.paired === false, 'manual address probe');
  const r401 = await fetch(`http://127.0.0.1:${PORT}/api/state`);
  ok(r401.status === 401, 'API refuses an unpaired computer');
  let bad = null;
  try { await client.pair('127.0.0.1', '000000'); } catch (e) { bad = e.message; }
  ok(/Wrong pairing code/.test(bad || ''), 'wrong code refused');
  const code = (agentLog.match(/pairing code: (\d{6})/g) || []).pop().slice(-6);
  const dev = await client.pair('127.0.0.1', code, 'direct');
  ok(dev && dev.paired && dev.id === i0.id, `paired with code ${code}`);
  const ID = dev.id;
  const call = (m, p, b) => client.api(ID, m, p, b === undefined ? {} : { body: b });
  ok(JSON.parse(fs.readFileSync(path.join(DESK, 'pi-devices.json'), 'utf8'))[0].token.length > 20, 'token stored on the desktop');
  client.connect(ID);
  ok(await until(() => events.some((e) => e.msg.t === 'state'), 5000), 'WebSocket connected, state received');

  // ---------------------------------------------------------------- presets
  const p1 = await client.pushPreset(ID, piPreset('rock', 'Rock', true), { bank: 0, slot: 0 });
  ok(p1.copied === 2 && p1.files === 2 && typeof p1.dsp === 'number', `pushed "Rock" with NAM + IR (copied ${p1.copied} files, measured DSP ${p1.dsp}%)`);
  const p1b = await client.pushPreset(ID, piPreset('rock', 'Rock', true), { bank: 0, slot: 0, bench: false });
  ok(p1b.copied === 0 && p1b.rev === 2, 'pushing again copies no files (deduplicated by hash)');
  await client.pushPreset(ID, piPreset('clean', 'Clean', false), { bank: 0, slot: 1, bench: false });
  await client.pushPreset(ID, piPreset('lead', 'Lead', false), { bank: 1, slot: 0, bench: false });
  let st = await call('GET', '/api/state');
  ok(st.banks.length === 2 && st.banks[0].presets[1].name === 'Clean' && st.banks[1].presets[0].name === 'Lead', 'banks hold the pushed presets');
  ok(st.preset && st.preset.id === 'rock', 'first preset is playing');
  const stored = await call('GET', '/api/presets/rock');
  ok(stored.graph.nodes.find((n) => n.id === 'n').opts.files[0].startsWith('tzfile:'), 'model paths rewritten to the Pi store');

  // ---------------------------------------------------------------- switching
  await sleep(1500); // preloading
  await call('POST', '/api/select', { bank: 0, slot: 1 });
  st = await until(async () => { const s = await call('GET', '/api/state'); return s.slot === 1 && s.preset.id === 'clean' && s; });
  ok(!!st, 'switched to B by the API');
  ok(await until(() => /preset "Clean" .*switched in \d+ ms \(preloaded\)/.test(agentLog), 3000), 'switch used the preloaded graph');
  // footswitch 1 (pin 11) = preset A, it has a hold action so it fires on release
  await call('POST', '/api/fake/gpio', { pin: 11, press: 80 });
  ok(await until(async () => (await call('GET', '/api/state')).slot === 0), 'footswitch 1 press: preset A');
  // footswitch 4 held = bank up (waits for a preset press), then footswitch 1 = bank 2 A
  await call('POST', '/api/fake/gpio', { pin: 16, press: 900 });
  ok(await until(async () => (await call('GET', '/api/state')).pendingBank === 1), 'footswitch 4 hold: bank up (pending)');
  await call('POST', '/api/fake/gpio', { pin: 11, press: 60 });
  st = await until(async () => { const s = await call('GET', '/api/state'); return s.bank === 1 && s.slot === 0 && s.preset.id === 'lead' && s; });
  ok(!!st, 'then footswitch 1: bank 2 preset A loaded');
  // a bounce shorter than the debounce time does nothing
  await call('POST', '/api/fake/gpio', { pin: 13, press: 5 });
  await sleep(300);
  ok((await call('GET', '/api/state')).slot === 0, 'a 5 ms bounce is ignored (debounce)');
  await call('POST', '/api/select', { bank: 0, slot: 0 });
  await until(async () => (await call('GET', '/api/state')).preset.id === 'rock');

  // ---------------------------------------------------------------- params, bypass, tap
  await call('POST', '/api/param', { block: 'd', name: 'gain', value: 0.9 });
  ok(await until(() => events.some((e) => e.msg.t === 'param' && e.msg.value === 0.9), 3000), 'param change broadcast');
  ok(await until(async () => (await call('GET', '/api/presets/rock')).graph.nodes.find((n) => n.id === 'd').params.gain === 0.9, 3000), 'param saved in the preset');
  await call('POST', '/api/bypass', { block: 'dl', on: false });
  ok((await call('GET', '/api/state')).preset.blocks.find((b) => b.id === 'dl').bypass === false, 'block turned on');
  await call('POST', '/api/tap', {});
  await sleep(500);
  const tp = await call('POST', '/api/tap', {});
  ok(tp.bpm > 100 && tp.bpm < 130, `tap tempo: ${tp.bpm} BPM`);

  // ---------------------------------------------------------------- stats
  await call('POST', '/api/fake/temp', { c: 76.5 });
  const sEv = await until(() => events.filter((e) => e.msg.t === 'stats').map((e) => e.msg.stats).reverse().find((s) => s.temp === 76.5), 4000);
  ok(sEv && sEv.dsp > 0 && sEv.cpu >= 0 && sEv.running, `stats: DSP ${sEv && sEv.dsp}%, CPU ${sEv && sEv.cpu}%, ${sEv && sEv.temp} C, ${sEv && sEv.sr} Hz`);
  const devs = await call('GET', '/api/audio/devices');
  ok(devs.inputs.length === 1 && devs.outputs.length === 3 && devs.outputs.some((d) => d.kind === 'builtin'), 'ALSA devices listed (USB in, USB + 3.5 mm + HDMI out)');
  // the agent wires the engine to the hardware itself (nobody else does on a Pi): input 1 and out L / R
  const portsHave = async (pairs) => {
    const p = await call('GET', '/api/audio/ports');
    const has = (n, c) => [...(p.sources || []), ...(p.sinks || [])].some((x) => x.name === n && (x.connections || []).includes(c));
    return pairs.every(([n, c, want = true]) => has(n, c) === want);
  };
  ok(await until(() => portsHave([['Tone Zone:in_1', 'system:capture_1'], ['Tone Zone:out_L', 'system:playback_1'], ['Tone Zone:out_R', 'system:playback_2']]), 15000), 'engine wired to the audio device (input 1, out L / R)');
  // input channel 2 moves the link (a Helix sends its dry guitar on USB 7)
  const aud1 = (await call('GET', '/api/config')).audio;
  ok(aud1.inChannels === 2, `the input's channel count is reported (${aud1.inChannels})`);
  await call('PUT', '/api/config/audio', Object.assign({}, aud1, { inChannel: 2, devices: undefined }));
  ok(await until(() => portsHave([['Tone Zone:in_1', 'system:capture_2'], ['Tone Zone:in_1', 'system:capture_1', false]]), 15000), 'input channel 2 connects capture_2 instead of capture_1');
  await call('PUT', '/api/config/audio', Object.assign({}, aud1, { inChannel: 1, devices: undefined }));
  ok(await until(() => portsHave([['Tone Zone:in_1', 'system:capture_1'], ['Tone Zone:in_1', 'system:capture_2', false]]), 15000), 'and back to channel 1');
  // test tone: plays instead of the preset, changes on the fly, and the preset comes back when it stops
  const outPk = async () => (await call('GET', '/api/stats')).outPeak || 0;
  await call('POST', '/api/audio/testtone', { on: true, tone: 1, level: -12, side: 0 });
  const ttOn = await until(async () => { const v = await outPk(); return v > 0.15 && v < 0.4 && v; }, 10000);
  ok(ttOn, `test tone reaches the outputs (peak ${ttOn && ttOn.toFixed(3)}, a -12 dBFS sine peaks at 0.251)`);
  ok((await call('GET', '/api/state')).testTone?.tone === 1, 'the state reports the test tone');
  const tLoud = await call('POST', '/api/audio/testtone', { on: true, tone: 2, level: 0, side: 1 });
  ok(tLoud.level === -6 && tLoud.tone === 2 && tLoud.side === 1, 'the level is capped at -6 dBFS; tone and side change while playing');
  for (const t of [0, 3]) ok((await call('POST', '/api/audio/testtone', { on: true, tone: t, level: -20 })).tone === t, `tone ${t} plays`);
  await call('POST', '/api/audio/testtone', { on: false });
  ok(await until(async () => !(await call('GET', '/api/state')).testTone, 5000), 'test tone off, the preset is back');
  // under PipeWire the devices are PipeWire's ports, and the agent connects the engine to the chosen ones
  const aud0 = (await call('GET', '/api/config')).audio;
  await call('PUT', '/api/config/audio', Object.assign({}, aud0, { server: 'pipewire', devices: undefined }));
  const pw = await until(async () => { const d = await call('GET', '/api/audio/devices'); return d.inputs.some((x) => x.id === 'pw:system') && d; }, 15000);
  ok(pw && pw.inputs.some((x) => x.id === 'pw:system' && x.ports.length === 2) && pw.outputs.some((x) => x.id === 'pw:system' && x.ports.length === 2), 'PipeWire devices listed: ' + JSON.stringify(pw && { in: pw.inputs.map((x) => x.id), out: pw.outputs.map((x) => x.id) }));
  const linked = await until(async () => {
    const p = await call('GET', '/api/audio/ports');
    const has = (n, c) => [...(p.sources || []), ...(p.sinks || [])].some((x) => x.name === n && (x.connections || []).includes(c));
    return has('Tone Zone:in_1', 'system:capture_1') && has('Tone Zone:out_L', 'system:playback_1') && has('Tone Zone:out_R', 'system:playback_2');
  }, 15000);
  ok(linked, 'engine connected to the PipeWire input and output');
  await call('PUT', '/api/config/audio', Object.assign({}, aud0, { devices: undefined }));
  await until(async () => (await call('GET', '/api/audio/devices')).outputs.length === 3, 15000);

  // ---------------------------------------------------------------- LEDs
  const cfg = (await call('GET', '/api/config')).gpio;
  cfg.pins[32] = { type: 'led', name: 'LED A', show: 'slotA', drive: 'pwm', bright: 40, dim: 0 }; // GPIO 12: hardware PWM
  cfg.pins[29] = { type: 'led', name: 'LED B', show: 'slotA', drive: 'pwm', bright: 30, dim: 5 }; // GPIO 5: software PWM
  cfg.pins[31] = { type: 'led', name: 'LED C', show: 'slotB', drive: 'pwm', bright: 80, dim: 10 };
  await call('PUT', '/api/config/gpio', cfg);
  const duty = path.join(DATA, 'fake-root/sys/class/pwm/pwmchip0/pwm0/duty_cycle');
  ok(await until(() => fs.existsSync(duty) && fs.readFileSync(duty, 'utf8') === '400000', 3000), 'hardware PWM LED at 40% (duty_cycle 400000 of 1000000)');
  const leds = await call('GET', '/api/gpio/leds');
  ok(leds[29] && leds[29].duty === 300 && !leds[29].hw && leds[31].duty === 100 && leds[32].hw, 'software PWM LEDs: lit 30%, unlit glow 10%');

  // ---------------------------------------------------------------- ARM engine under qemu (offline self test)
  if (!process.env.TZ_SKIP_QEMU && spawnSync('sh', ['-c', 'command -v qemu-aarch64']).status === 0 && fs.existsSync(path.join(HOME, 'a/engine/tonezone-engine-arm64'))) {
    const w = path.join(T, 'qemu-engine.sh');
    fs.writeFileSync(w, `#!/bin/sh\nexec qemu-aarch64 -L /usr/aarch64-linux-gnu ${path.join(HOME, 'a/engine/tonezone-engine-arm64')} "$@"\n`, { mode: 0o755 });
    process.env.TZ_FAKE_HW = '1';
    process.env.TZ_DATA = path.join(T, 'qdata');
    const { selfTest } = require(path.join(ROOT, 'pi/agent/lib/engine.js'));
    let r = null, err = null;
    try { r = selfTest(w); } catch (e) { err = e.message; }
    ok(r && r.peak > 0.001, `ARM engine from the bundle passes the agent self test under qemu${r ? ` (peak ${r.peak.toFixed(2)})` : ': ' + err}`);
  }

  // ---------------------------------------------------------------- the Pi tab with the live (fake) Pi
  if (!process.env.TZ_SKIP_UI) {
    let playwright = null;
    try { playwright = require('playwright'); } catch {}
    if (!playwright) console.log('note: playwright missing, Pi tab check skipped');
    else {
      const xdg = path.join(T, 'xdg');
      fs.mkdirSync(path.join(xdg, 'tone-zone'), { recursive: true });
      fs.copyFileSync(path.join(DESK, 'pi-devices.json'), path.join(xdg, 'tone-zone', 'pi-devices.json'));
      const app = await playwright._electron.launch({ executablePath: require('electron'), args: [path.join(__dirname, '..'), '--no-sandbox'], env: Object.assign({}, process.env, { XDG_DATA_HOME: xdg, LD_LIBRARY_PATH: path.dirname(FAKEJACK), TZ_PI_PORT: String(PORT), TZ_MDNS_PORT: String(MDNS), TZ_NO_SINGLE_INSTANCE: '1' }) });
      try {
        const win = await app.firstWindow();
        const errs = [];
        win.on('pageerror', (e) => errs.push(e.message));
        win.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
        await win.waitForFunction(() => window.__tz && window.__tz.ready, null, { timeout: 120000 });
        await win.evaluate(() => localStorage.removeItem('tz.pi.ui.v1'));
        await win.click('#tabs [data-tab="pi"]');
        const live = await win.waitForFunction(() => document.querySelector('.pi-page.live .pi-dev'), null, { timeout: 20000 }).then(() => true).catch(() => false);
        ok(live, 'Pi tab switched to live data');
        ok(await win.evaluate((n) => [...document.querySelectorAll('.pi-dev h3')].some((h) => h.textContent === n), i0.name), `Pi tab lists "${i0.name}"`);
        await win.waitForTimeout(2500);
        const shotDir = process.env.SHOTS || T;
        await win.screenshot({ path: path.join(shotDir, 'pi-live-fake.png') });
        // push the editor's current preset through the tab's data layer (real catalog conversion)
        const r = await win.evaluate(async (id) => {
          const m = await import('./js/pages/pi-data.js');
          const s = await import('./js/state.js');
          const out = await m.act('push', { id, preset: s.state.preset, file: 'from-ui.json', name: 'From the UI', bank: 0, slot: 3 });
          return out;
        }, ID);
        ok(r && typeof r.dsp === 'number', `pushed the editor preset from the tab (DSP ${r && r.dsp}%)`);
        const fromUi = await call('GET', '/api/presets/from-ui');
        ok(fromUi && fromUi.blocks.length > 0 && fromUi.blocks.some((b) => b.params.length), `converted preset has ${fromUi.blocks.length} blocks with editable params`);
        // Audio: the Pi's real sound cards are listed, and picking one reaches the Pi
        await win.click('.pi-navbtn[data-section="audio"]');
        await win.waitForSelector('[data-ctl="audio-list"]', { timeout: 10000 });
        const aud = await win.evaluate(() => ({
          rows: [...document.querySelectorAll('[data-ctl="audio-list"] tr')].map((r) => r.textContent),
          ins: [...document.querySelectorAll('[data-ctl="audio-in"] option')].map((o) => o.value),
          outs: [...document.querySelectorAll('[data-ctl="audio-out"] option')].map((o) => o.value),
        }));
        ok(aud.rows.length === 3 && aud.rows.some((r) => /USB Audio Device/.test(r) && /in \+ out/.test(r)), 'audio page lists every sound card: ' + JSON.stringify(aud.rows));
        ok(aud.ins.length === 1 && aud.outs.length === 3, `real inputs (${aud.ins.length}) and outputs (${aud.outs.length}) in the pickers`);
        ok(await win.evaluate(() => document.querySelectorAll('[data-ctl="audio-channel"] option').length) >= 2, 'the Audio page has an input channel picker');
        await win.click('[data-ctl="tone-kind"] [data-v="2"]');
        await win.click('[data-act="test-tone"]');
        ok(await until(async () => (await call('GET', '/api/state')).testTone?.tone === 2, 8000), 'Play test tone on the Audio page plays pink noise on the Pi');
        await win.click('[data-act="test-tone"]');
        ok(await until(async () => !(await call('GET', '/api/state')).testTone, 8000), 'and Stop ends it');
        const hdmi = aud.outs.find((v) => /vc4hdmi/.test(v));
        await win.selectOption('[data-ctl="audio-out"]', hdmi);
        const okPick = await until(async () => (await call('GET', '/api/config')).audio.output === hdmi, 10000);
        ok(okPick, 'picked output reaches the Pi: ' + hdmi);
        ok(!errs.length, 'no renderer errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
      } finally {
        await app.close().catch(() => {});
      }
    }
  }

  // ---------------------------------------------------------------- updates
  const b2 = bundle('0.9.0-t2');
  const v2 = await client.pushUpdate(ID, { file: b2, verifyOnly: true });
  ok(v2.ok && v2.signed, 'signed bundle verifies');
  const tampered = path.join(T, 'tampered.tar.gz');
  const tb = fs.readFileSync(b2);
  tb[tb.length - 100] ^= 0xff;
  fs.writeFileSync(tampered, tb);
  fs.copyFileSync(b2 + '.sig', tampered + '.sig');
  const vt = await client.pushUpdate(ID, { file: tampered, verifyOnly: true });
  ok(!vt.ok && /Bad signature/.test(vt.error), 'tampered bundle refused');
  const unsigned = bundle('0.9.0-t2u', { sign: false });
  const vu = await client.pushUpdate(ID, { file: unsigned, verifyOnly: true });
  ok(!vu.ok && /not signed/.test(vu.error), 'unsigned bundle refused unless dev bundles are allowed');
  let terr = null;
  try { await client.pushUpdate(ID, { file: tampered }); } catch (e) { terr = e.message; }
  ok(/Bad signature/.test(terr || ''), 'installing the tampered bundle fails');

  const up = await client.pushUpdate(ID, { file: b2 });
  ok(up.version === '0.9.0-t2' && up.slot === 'b', 'update installed into slot b');
  ok((await agent.exited) === 75, 'agent exits to restart into the new slot');
  startAgent();
  let i2 = await waitUp();
  ok(i2 && i2.version === '0.9.0-t2' && i2.slot === 'b', 'new version running from slot b');
  ok(await until(() => /update 0.9.0-t2 is healthy/.test(agentLog), 15000), 'health check passed, update kept');
  ok((await call('GET', '/api/presets')).length >= 3, 'presets survive the update');
  ok(i2.prevVersion === '0.9.0-t1', 'previous version kept for a roll back');
  // manual roll back
  const rb = await call('POST', '/api/update/rollback', {});
  ok(rb.version === '0.9.0-t1', 'roll back requested');
  await agent.exited;
  startAgent();
  i2 = await waitUp();
  ok(i2 && i2.version === '0.9.0-t1' && i2.slot === 'a', 'rolled back to 0.9.0-t1 in slot a');

  // a version that fails its health check rolls itself back
  const brokenDir = path.join(T, 'agent-broken');
  fs.cpSync(path.join(ROOT, 'pi/agent'), brokenDir, { recursive: true });
  const ef = path.join(brokenDir, 'lib/engine.js');
  fs.writeFileSync(ef, fs.readFileSync(ef, 'utf8').replace("function selfTest(bin = findEngine()) {", "function selfTest(bin = findEngine()) {\n  throw new Error('test: broken engine');"));
  await client.pushUpdate(ID, { file: bundle('0.9.0-t3', { agentDir: brokenDir }) });
  await agent.exited;
  startAgent();
  ok(await until(() => /failed its health check/.test(agentLog), 20000), 'bad update fails its health check');
  ok((await agent.exited) === 75, 'and restarts into the old slot');
  startAgent();
  let i3 = await waitUp();
  ok(i3 && i3.version === '0.9.0-t1' && i3.failedUpdate && i3.failedUpdate.version === '0.9.0-t3', 'rolled back to 0.9.0-t1, failed update reported');

  // a version that crashes at once is rolled back by boot-check.sh after 3 tries
  const crashDir = path.join(T, 'agent-crash');
  fs.cpSync(path.join(ROOT, 'pi/agent'), crashDir, { recursive: true });
  fs.writeFileSync(path.join(crashDir, 'tz-agent.js'), "process.exit(1);\n");
  await client.pushUpdate(ID, { file: bundle('0.9.0-t4', { agentDir: crashDir }) });
  await agent.exited;
  // systemd restarts it each time; after the 3rd crash boot-check.sh switches back and the old version stays up
  let tries = 0;
  for (; tries < 6; tries++) { startAgent(); if ((await Promise.race([agent.exited, sleep(5000).then(() => 'up')])) === 'up') break; }
  ok(tries === 3, `crashed ${tries} times before the roll back`);
  const i4 = await waitUp();
  ok(i4 && i4.version === '0.9.0-t1' && i4.failedUpdate && i4.failedUpdate.version === '0.9.0-t4', 'crash looping update rolled back by boot-check.sh');

  ok(!i4.prevVersion, 'no broken version offered for roll back');

  await stopAgent();
  client.disconnect(ID);
  if (fails) console.log('\n--- agent log (tail) ---\n' + agentLog.split('\n').slice(-60).join('\n'));
  fs.rmSync(T, { recursive: true, force: true });
  console.log(fails ? `\n${fails} check(s) failed` : '\nall Pi agent checks passed');
  process.exit(fails ? 1 : 0);
})().catch(async (e) => {
  console.error(e);
  console.log('\n--- agent log (tail) ---\n' + agentLog.split('\n').slice(-60).join('\n'));
  await stopAgent();
  process.exit(1);
});
