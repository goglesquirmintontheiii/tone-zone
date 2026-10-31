// Pi tab: Audio, Updates and Logs sections.
import { el, toast, bus } from '../util.js';
import { MODELS, audioDevicesFor, audioDevice, audioNote, latencyFor, isPi3, savePi, piLog, piLogs, setLogs, act } from './pi-data.js';
import { card, field, seg, select, toggle, meter, demoNote, fakeProgress, copyBox } from './pi-ui.js';
import { uiAudioId } from './pi-live.js';

// ------------------------------------------------------------------ Audio
const tone = { on: false, tone: 0, side: 0, level: -20, timer: 0 }; // test tone settings, kept across redraws
export function renderAudio(main, ctx) {
  const { store, dev } = ctx;
  const a = store.audio;
  const model = dev ? dev.model : 'pi5';
  const top = el('div', { class: 'pi-sechead' }, main);
  el('div', {}, top, `<h2>Audio</h2><p>Where the guitar comes in and where the sound goes out on ${dev ? dev.name : 'the Pi'}.</p>`);
  // a device that does not exist on this board (the 3.5 mm jack on a Pi 5) falls back to the input device
  const outs = audioDevicesFor(model, 'out'), ins = audioDevicesFor(model, 'in');
  if (!ins.some((d) => d.id === a.input)) a.input = ins[0].id;
  if (!outs.some((d) => d.id === a.output)) a.output = outs.some((d) => d.id === a.input) ? a.input : outs[0].id;

  const cols = el('div', { class: 'pi-cols' }, main);
  const left = el('div', { class: 'pi-col' }, cols);
  const right = el('div', { class: 'pi-col' }, cols);
  const io = card(left, 'Input and output', 'They can be two different devices, like a USB adapter in and the headphone jack out.');
  // a real Pi says whether audio is actually running (and why not)
  const stt = ctx.live && a.alsa && a.alsa.status;
  if (stt) el('div', { class: 'pi-audio-status ' + (stt.ok ? 'ok' : 'bad'), 'data-ctl': 'audio-status' }, io).textContent = stt.ok ? 'Audio running: ' + stt.text : 'No audio: ' + stt.error;
  // a real Pi lists the sound cards it actually has; the demo picks from the common ones
  const al = ctx.live && a.alsa ? a.alsa : null;
  const devRow = (label, dir, list, key) => {
    field(io, label);
    const fc = io.lastChild.lastChild;
    if (al) {
      const real = dir === 'in' ? al.inputs : al.outputs;
      if (!real.length) {
        el('div', { class: 'pi-warn', 'data-q': 'none-' + dir }, fc).textContent = dir === 'in' ? 'No audio input found. Plug in a USB interface or add a HAT.' : 'No audio output found.';
        return;
      }
      const opts = real.map((d) => [d.id, `${d.name} (${d.id.replace(/^hw:/, '')})`]);
      select(fc, opts, al[key], (v) => {
        // the Pi may have sent a newer config since this was drawn: change the current one
        const cur = store.audio, cal = cur.alsa || al;
        cal[key] = v;
        cur[key] = uiAudioId(real.find((d) => d.id === v));
        savePi();
        piLog(`Audio ${dir}: ${(real.find((d) => d.id === v) || {}).name || v}`, 'info', 'engine');
        ctx.rerender();
      }, { 'data-ctl': 'audio-' + dir });
    } else select(fc, list.map((d) => [d.id, d.name]), a[key], (v) => { store.audio[key] = v; savePi(); piLog(`Audio ${dir}: ${audioDevice(v).name}`, 'info', 'engine'); ctx.rerender(); }, { 'data-ctl': 'audio-' + dir });
    const d = audioDevice(a[key]);
    if (d) el('div', { class: 'pi-devq ' + d.kind, 'data-q': d.id }, io).textContent = audioNote(d, model);
  };
  devRow('Input (guitar)', 'in', ins, 'input');
  if (al && al.inputs.length) {
    // interfaces with several inputs (a Helix sends 8 over USB): pick which one the guitar comes in on
    const n = Math.max(al.inChannels || 0, al.inChannel || 1, 2);
    field(io, 'Input channel', 'Which input of the device feeds the engine. On a Line 6 Helix, USB 7 is your dry guitar and USB 1/2 is the Helix\'s own sound.');
    select(io.lastChild.lastChild, [...Array(n)].map((_, i) => [i + 1, 'Input ' + (i + 1)]), al.inChannel || 1, (v) => { (store.audio.alsa || al).inChannel = +v; savePi(); piLog(`Audio input channel: ${v}`, 'info', 'engine'); ctx.rerender(); }, { 'data-ctl': 'audio-channel' });
  }
  devRow('Output (amp, headphones, PA)', 'out', outs, 'output');
  const notes = el('ul', { class: 'pi-list small' }, io);
  el('li', {}, notes).textContent = 'The Pi has no audio input of its own. Use a HAT, a USB interface or a USB audio adapter.';
  el('li', {}, notes).textContent = !MODELS[model].jack ? 'The Pi 5 has no 3.5 mm jack. Use a HAT, a USB device or HDMI for output.'
    : isPi3(model) ? `The ${MODELS[model].short} has a 3.5 mm output (no input). It is noisier than the Pi 4 jack: fine for headphones and practice, not for gigs.`
      : 'The Pi 4 has a 3.5 mm output (no input). It hisses a little: good for practice, not for gigs.';
  if (isPi3(model)) el('li', {}, notes).textContent = 'On a Pi 3, USB and Ethernet share one connection. USB audio works well at buffer 128 or 256; avoid big file copies while you play.';
  if (MODELS[model].jack && a.output === 'jack35') el('li', {}, notes).textContent = 'The jack uses the hardware PWM channels, so dimmable LEDs switch to software PWM.';

  if (al) {
    // everything the Pi can play to or record from, with the ones in use marked
    const lc = card(left, 'Audio devices on this Pi', 'Every sound card the Pi sees right now. Plug in a device and open this page again to see it.');
    const t = el('table', { class: 'pi-table compact', 'data-ctl': 'audio-list' }, lc);
    const tb = el('tbody', {}, t);
    const byId = new Map();
    for (const d of al.inputs) byId.set(d.id, Object.assign({ in: true }, d));
    for (const d of al.outputs) byId.set(d.id, Object.assign(byId.get(d.id) || {}, d, { out: true }));
    if (!byId.size) el('tr', {}, tb, '<td>No sound cards found.</td>');
    for (const d of byId.values()) {
      const tr = el('tr', { 'data-dev': d.id }, tb);
      el('td', {}, tr).textContent = d.name;
      el('td', { class: 'dim' }, tr).textContent = d.id.replace(/^hw:/, '');
      el('td', {}, tr).textContent = [d.in && 'in', d.out && 'out'].filter(Boolean).join(' + ');
      const use = [d.id === al.input && 'input', d.id === al.output && 'output'].filter(Boolean);
      el('td', { class: use.length ? 'ok' : 'dim' }, tr).textContent = use.length ? 'in use as ' + use.join(' and ') : '';
    }
  }

  const st = card(left, 'Engine', null);
  field(st, 'Sample rate');
  seg(st.lastChild.lastChild, [[44100, '44.1 kHz'], [48000, '48 kHz'], [96000, '96 kHz']], a.rate, (v) => { store.audio.rate = +v; savePi(); ctx.rerender(); }, { 'data-ctl': 'rate' });
  field(st, 'Buffer', isPi3(model) ? 'Smaller = less latency but more CPU. On a Pi 3, 128 with a HAT, 256 with USB.' : 'Smaller = less latency but more CPU. 128 is safe, 64 for Pi 5 with a HAT.');
  seg(st.lastChild.lastChild, [[32, '32'], [64, '64'], [128, '128'], [256, '256']], a.buffer, (v) => { store.audio.buffer = +v; savePi(); ctx.rerender(); }, { 'data-ctl': 'buffer' });
  field(st, 'Periods');
  seg(st.lastChild.lastChild, [[2, '2'], [3, '3 (USB)']], a.periods, (v) => { store.audio.periods = +v; savePi(); ctx.rerender(); });
  field(st, 'Audio server');
  seg(st.lastChild.lastChild, [['pipewire', 'PipeWire'], ['jack', 'JACK2 (lowest latency)']], a.server, (v) => { store.audio.server = v; savePi(); });
  const opt = (label, hint, key) => {
    const r = el('div', { class: 'pi-opt' }, st);
    el('div', {}, r, `<b>${label}</b><small>${hint}</small>`);
    toggle(r, a[key], (v) => { store.audio[key] = v; savePi(); });
  };
  opt('CPU at full speed', 'Performance governor, so the CPU never slows down while you play.', 'governor');
  opt('Keep one core for audio', 'Reserves core 4 for the engine (isolcpus). Needs a reboot.', 'isolate');

  const lat = latencyFor(a);
  const lc = card(right, 'Estimated latency', 'From the guitar jack to the output, before any pitch blocks.');
  el('div', { class: 'pi-big', 'data-latency': lat.total.toFixed(1) }, lc).textContent = lat.total.toFixed(1) + ' ms';
  meter(lc, (lat.total / 20) * 100, lat.total > 12 ? 'bad' : lat.total > 8 ? 'heavy' : 'ok', lat.total < 8 ? 'Feels instant' : lat.total < 12 ? 'Fine for most players' : 'You may feel it');
  const t = el('table', { class: 'pi-table compact' }, lc);
  const tb = el('tbody', {}, t);
  for (const [k, v] of lat.parts) { const tr = el('tr', {}, tb); el('td', {}, tr).textContent = k; el('td', { class: 'num' }, tr).textContent = v.toFixed(1) + ' ms'; }
  if (lat.split) el('p', { class: 'pi-warn' }, lc).textContent = 'Input and output are two devices with their own clocks. The engine resamples one side to keep them in sync: a bit more latency and CPU. One device for both is best.';
  if ((audioDevice(a.output) || {}).id === 'hdmi') el('p', { class: 'pi-warn' }, lc).textContent = 'HDMI audio adds a lot of latency. Use it for listening only.';
  if ((audioDevice(a.input) || {}).kind === 'aux') el('p', { class: 'pi-warn' }, lc).textContent = 'USB audio adapters expect mic or line level. Put a boost, buffer pedal or DI box before it for a full guitar sound.';

  const lv = card(right, 'Levels', null);
  const mi = meter(lv, 42, 'ok', 'Input');
  const mo = meter(lv, 55, 'ok', 'Output');
  let asking = false;
  const tick = setInterval(() => {
    if (!mi.isConnected) return clearInterval(tick);
    const p = dev && dev.online && !asking && act('levels', { id: dev.id });
    if (p) {
      asking = true;
      p.then((l) => { mi.firstChild.style.width = (l.in || 0) + '%'; mo.firstChild.style.width = (l.out || 0) + '%'; }, () => {}).finally(() => (asking = false));
      return;
    }
    if (ctx.live) return;
    mi.firstChild.style.width = 20 + Math.random() * 40 + '%';
    mo.firstChild.style.width = 30 + Math.random() * 40 + '%';
  }, 200);
  // test tone: replaces the preset on the Pi while it plays (30 s at most), to check each output
  const tc = card(right, 'Test tone', 'Plays instead of the preset for up to 30 seconds, so you can check the outputs and the cables.');
  field(tc, 'Tone');
  seg(tc.lastChild.lastChild, [[0, '440 Hz'], [1, '1 kHz'], [2, 'Pink noise'], [3, 'Sweep']], tone.tone, (v) => { tone.tone = +v; sendTone(); ctx.rerender(); }, { 'data-ctl': 'tone-kind' });
  field(tc, 'Output side');
  seg(tc.lastChild.lastChild, [[0, 'Both'], [1, 'Left'], [2, 'Right']], tone.side, (v) => { tone.side = +v; sendTone(); ctx.rerender(); }, { 'data-ctl': 'tone-side' });
  field(tc, 'Level', 'Start low: -20 dBFS is about as loud as a normal preset.');
  const lvRow = tc.lastChild.lastChild;
  const rng = el('input', { type: 'range', min: -40, max: -6, step: 1, value: tone.level, 'data-ctl': 'tone-level' }, lvRow);
  const lvTxt = el('span', { class: 'pi-num' }, lvRow);
  lvTxt.textContent = tone.level + ' dBFS';
  rng.oninput = () => { tone.level = +rng.value; lvTxt.textContent = tone.level + ' dBFS'; };
  rng.onchange = () => sendTone();
  const tt = el('button', { class: 'btn small' + (tone.on ? ' btn-accent' : ''), 'data-act': 'test-tone' }, tc, tone.on ? 'Stop test tone' : 'Play test tone');
  function sendTone(on = tone.on) {
    if (!on && !tone.on) return;
    tone.on = on;
    clearTimeout(tone.timer);
    if (on) tone.timer = setTimeout(() => { tone.on = false; ctx.rerender(); }, 30000); // the Pi stops it too
    const name = ['440 Hz sine', '1 kHz sine', 'pink noise', 'sweep'][tone.tone];
    const p = dev && ctx.live && act('testTone', { id: dev.id, on, tone: tone.tone, level: tone.level, side: tone.side });
    if (p) p.catch((e) => { tone.on = false; toast(e.message || String(e), 'err'); ctx.rerender(); });
    else if (on) toast(`Test tone: ${name} (demo)`);
  }
  tt.onclick = () => {
    const on = !tone.on;
    piLog(on ? `Test tone: ${['440 Hz sine', '1 kHz sine', 'pink noise', 'sweep'][tone.tone]}, ${tone.level} dBFS, ${['both sides', 'left', 'right'][tone.side]}` : 'Test tone off', 'info', 'engine');
    sendTone(on);
    ctx.rerender();
  };
  demoNote(main, 'Levels and latency are estimates until a Pi is connected.');
}

// ------------------------------------------------------------------ Updates
const LATEST = '0.8.1';
const CHANGES = ['Faster preset switching with preloading', 'Pi 5: NAM A2 Full at 128 frames', 'Fixed: footswitch hold sometimes counted as a press', 'Tuner on the OLED screen'];

export function renderUpdates(main, ctx) {
  const { store, dev } = ctx;
  const u = store.updates;
  const latest = ctx.live ? dev?.latest || dev?.version || '?' : u.channel === 'stable' ? LATEST : LATEST + '-beta.2';
  const top = el('div', { class: 'pi-sechead' }, main);
  el('div', {}, top, '<h2>Updates</h2><p>Signed updates with automatic rollback. Your presets and settings are kept.</p>');
  if (!dev) return el('div', { class: 'pi-empty' }, main).textContent = 'Add a Pi first.';
  const cols = el('div', { class: 'pi-cols' }, main);
  const left = el('div', { class: 'pi-col' }, cols);
  const right = el('div', { class: 'pi-col' }, cols);
  const c = card(left, dev.name, `${MODELS[dev.model].name}, Tone Zone ${dev.version}`);
  const ver = el('div', { class: 'pi-verrow' }, c);
  el('div', {}, ver, `<span>Installed</span><b data-ver>${dev.version}</b>`);
  el('div', {}, ver, `<span>Latest (${u.channel})</span><b data-latest>${latest}</b>`);
  el('div', {}, ver, `<span>Previous</span><b>${dev.prevVersion || '0.7.2'}</b>`);
  field(c, 'Channel');
  seg(c.lastChild.lastChild, [['stable', 'Stable'], ['beta', 'Beta'], ['nightly', 'Nightly']], u.channel, (v) => { u.channel = v; savePi(); ctx.rerender(); });
  field(c, 'Update through', u.via === 'network' ? 'The Pi downloads it over Wi-Fi or Ethernet.' : u.via === 'push' ? 'This computer downloads it and sends it over the network or the direct cable. The Pi needs no internet.' : 'For places with no network at all.');
  seg(c.lastChild.lastChild, [['network', 'Pi downloads'], ['push', 'From this app'], ['usb', 'USB stick']], u.via, (v) => { u.via = v; savePi(); ctx.rerender(); }, { 'data-ctl': 'via' });
  if (u.via === 'usb') el('p', { class: 'pi-muted' }, c).textContent = 'Save the update file to a USB stick, plug it into the Pi and press footswitch 1 and 4 together (or tap Update on the screen).';
  const r = el('div', { class: 'pi-opt' }, c);
  el('div', {}, r, '<b>Install automatically</b><small>Only when the Pi has had no guitar signal for 10 minutes. Never during a show.</small>');
  toggle(r, u.auto, (v) => { u.auto = v; savePi(); });

  const row = el('div', { class: 'pi-row' }, c);
  const chk = el('button', { class: 'btn', 'data-act': 'check-update' }, row, 'Check for updates');
  const inst = el('button', { class: 'btn btn-accent', 'data-act': 'install-update' }, row, `Install ${ctx.live ? latest : LATEST}`);
  const rb = el('button', { class: 'btn btn-ghost', 'data-act': 'rollback' }, row, 'Roll back');
  const prog = el('div', { class: 'pi-progress hidden', 'data-progress': 'update' }, c, '<div class="pi-pbar"><i></i></div><span></span>');
  const upToDate = ctx.live ? !dev.latest || dev.latest === dev.version : dev.version === LATEST;
  inst.disabled = upToDate;
  if (upToDate) inst.textContent = 'Up to date';
  chk.onclick = () => {
    chk.textContent = 'Checking...';
    const p = act('checkUpdate', { id: dev.id, channel: u.channel });
    if (p) {
      p.then((r) => {
        dev.latest = r.latest;
        dev.notes = r.notes || [];
        toast(r.latest === dev.version ? 'Already up to date' : `Tone Zone ${r.latest} is available`);
        ctx.rerender();
      }, () => (chk.textContent = 'Check for updates'));
      return;
    }
    setTimeout(() => { chk.textContent = 'Check for updates'; toast(upToDate ? 'Already up to date' : `Tone Zone ${LATEST} is available`); piLog(`Update check (${u.channel}): ${upToDate ? 'up to date' : LATEST + ' available'}`); }, 700);
  };
  inst.onclick = async () => {
    inst.disabled = chk.disabled = rb.disabled = true;
    prog.classList.remove('hidden');
    if (ctx.live) {
      const bar = prog.querySelector('i'), label = prog.querySelector('span');
      const off = bus.on('pi:progress', (ev) => {
        if (ev.id !== dev.id || ev.job !== 'update') return;
        bar.style.width = (ev.pct || 0) + '%';
        if (ev.text) label.textContent = ev.text;
      });
      label.textContent = 'Starting...';
      try {
        await act('update', { id: dev.id, channel: u.channel, via: u.via });
        piLog(`Updated to ${dev.latest}`);
        toast(`${dev.name} is updated`);
      } catch { /* shown by act */ }
      off();
      return setTimeout(() => ctx.rerender(), 600);
    }
    const src = u.via === 'push' ? 'Sending from this computer' : u.via === 'usb' ? 'Reading from USB stick' : 'Downloading';
    await fakeProgress(prog.querySelector('i'), prog.querySelector('span'), [
      `${src}: 38 MB...`, 'Checking the signature...', 'Writing to the spare slot (B)...', 'Switching to the new version...', 'Restarting audio (about 2 s of silence)...', 'Health check: engine, preset, footswitches...', `Done. Now on ${LATEST}`,
    ], 450);
    dev.prevVersion = dev.version;
    dev.version = LATEST;
    savePi();
    piLog(`Updated ${dev.prevVersion} -> ${LATEST} (slot B active, health check passed)`);
    toast(`${dev.name} is now on ${LATEST} (demo)`);
    setTimeout(() => ctx.rerender(), 600);
  };
  rb.onclick = async () => {
    if (ctx.live) {
      try { await act('rollback', { id: dev.id }); toast('Rolled back'); } catch { /* shown by act */ }
      return ctx.rerender();
    }
    const back = dev.prevVersion || '0.7.2';
    dev.prevVersion = dev.version;
    dev.version = back;
    savePi();
    piLog(`Rolled back to ${back} (switched slot)`, 'warn');
    toast(`Rolled back to ${back} (demo)`);
    ctx.rerender();
  };

  const notes = ctx.live ? dev.notes || [] : CHANGES;
  if (notes.length) {
    const n = card(right, `What is new in ${ctx.live ? latest : LATEST}`, null);
    const ul = el('ul', { class: 'pi-list' }, n);
    for (const t of notes) el('li', {}, ul).textContent = t;
  }
  const how = card(right, 'How updates stay safe', null);
  const ul2 = el('ul', { class: 'pi-list small' }, how);
  for (const t of ['Every update is signed. The Pi refuses anything that is not from Tone Zone.', 'The new version goes into a spare slot. If it does not start properly within a minute, the Pi goes back to the old one by itself.', 'Roll back keeps the previous version one click away.', 'Updating from the command line: sudo tonezone update'])
    el('li', {}, ul2).textContent = t;
  demoNote(main, 'No real download happens. The progress is fake.');
}

// ------------------------------------------------------------------ Logs
let logFilter = 'all';
export function renderLogs(main, ctx) {
  const { dev } = ctx;
  const top = el('div', { class: 'pi-sechead' }, main);
  el('div', {}, top, `<h2>Logs</h2><p>What ${dev ? dev.name : 'the Pi'} has been doing. Handy when asking for help.</p>`);
  const acts = el('div', { class: 'pi-row' }, top);
  seg(acts, [['all', 'All'], ['engine', 'Engine'], ['agent', 'Agent'], ['gpio', 'GPIO'], ['warn', 'Warnings']], logFilter, (v) => { logFilter = v; draw(); });
  const cp = el('button', { class: 'btn small' }, acts, 'Copy');
  const sb = el('button', { class: 'btn small' }, acts, 'Support bundle');
  const box = el('div', { class: 'pi-log', 'data-log': '' }, main);
  const draw = () => {
    box.innerHTML = '';
    const rows = piLogs().filter((l) => logFilter === 'all' || (logFilter === 'warn' ? l.lvl !== 'info' : l.src === logFilter));
    for (const l of rows) {
      const r = el('div', { class: 'pi-logline ' + l.lvl }, box);
      el('span', { class: 't' }, r).textContent = new Date(l.t).toLocaleTimeString([], { hour12: false });
      el('span', { class: 's' }, r).textContent = l.src;
      el('span', { class: 'm' }, r).textContent = l.msg;
    }
    box.scrollTop = box.scrollHeight;
  };
  draw();
  main.addEventListener('pi-log', draw);
  const lp = dev && act('logs', { id: dev.id });
  if (lp) lp.then((list) => Array.isArray(list) && setLogs(list), () => {});
  cp.onclick = () => {
    try { navigator.clipboard.writeText(piLogs().map((l) => `${new Date(l.t).toISOString()} ${l.src} ${l.lvl} ${l.msg}`).join('\n')); } catch { /* ignore */ }
    toast('Logs copied');
  };
  sb.onclick = () => {
    const p = dev && act('supportBundle', { id: dev.id });
    if (p) p.then((r) => toast('Support bundle saved' + (r && r.path ? ': ' + r.path : '')), () => {});
    else toast('A support bundle (logs, settings, no presets) will download from the Pi (demo)');
  };
  const ssh = card(main, 'Same logs over SSH', null);
  copyBox(ssh, 'journalctl -u tonezone-engine -u tz-agent -f');
}
