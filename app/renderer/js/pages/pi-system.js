// Pi tab: Audio, Updates and Logs sections.
import { el, toast } from '../util.js';
import { MODELS, audioDevicesFor, audioDevice, latencyFor, savePi, piLog, piLogs } from './pi-data.js';
import { card, field, seg, select, toggle, meter, demoNote, fakeProgress, copyBox } from './pi-ui.js';

// ------------------------------------------------------------------ Audio
export function renderAudio(main, ctx) {
  const { store, dev } = ctx;
  const a = store.audio;
  const model = dev ? dev.model : 'pi5';
  const top = el('div', { class: 'pi-sechead' }, main);
  el('div', {}, top, `<h2>Audio</h2><p>Where the guitar comes in and where the sound goes out on ${dev ? dev.name : 'the Pi'}.</p>`);
  // a device that does not exist on this board (the 3.5 mm jack on a Pi 5) falls back to the input device
  const outs = audioDevicesFor(model, 'out'), ins = audioDevicesFor(model, 'in');
  if (!ins.some((d) => d.id === a.input)) a.input = ins[0].id;
  if (!outs.some((d) => d.id === a.output)) a.output = a.input;

  const cols = el('div', { class: 'pi-cols' }, main);
  const left = el('div', { class: 'pi-col' }, cols);
  const right = el('div', { class: 'pi-col' }, cols);
  const io = card(left, 'Input and output', 'They can be two different devices, like a USB adapter in and the headphone jack out.');
  const devRow = (label, dir, list, key) => {
    field(io, label);
    const fc = io.lastChild.lastChild;
    select(fc, list.map((d) => [d.id, d.name]), a[key], (v) => { a[key] = v; savePi(); piLog(`Audio ${dir}: ${audioDevice(v).name}`, 'info', 'engine'); ctx.rerender(); }, { 'data-ctl': 'audio-' + dir });
    const d = audioDevice(a[key]);
    el('div', { class: 'pi-devq ' + d.kind }, io).textContent = d.q;
  };
  devRow('Input (guitar)', 'in', ins, 'input');
  devRow('Output (amp, headphones, PA)', 'out', outs, 'output');
  const notes = el('ul', { class: 'pi-list small' }, io);
  el('li', {}, notes).textContent = 'The Pi has no audio input of its own. Use a HAT, a USB interface or a USB audio adapter.';
  el('li', {}, notes).textContent = MODELS[model].jack ? 'The Pi 4 has a 3.5 mm output (no input). It hisses a little: good for practice, not for gigs.' : 'The Pi 5 has no 3.5 mm jack. Use a HAT, a USB device or HDMI for output.';

  const st = card(left, 'Engine', null);
  field(st, 'Sample rate');
  seg(st.lastChild.lastChild, [[44100, '44.1 kHz'], [48000, '48 kHz'], [96000, '96 kHz']], a.rate, (v) => { a.rate = +v; savePi(); ctx.rerender(); }, { 'data-ctl': 'rate' });
  field(st, 'Buffer', 'Smaller = less latency but more CPU. 128 is safe, 64 for Pi 5 with a HAT.');
  seg(st.lastChild.lastChild, [[32, '32'], [64, '64'], [128, '128'], [256, '256']], a.buffer, (v) => { a.buffer = +v; savePi(); ctx.rerender(); }, { 'data-ctl': 'buffer' });
  field(st, 'Periods');
  seg(st.lastChild.lastChild, [[2, '2'], [3, '3 (USB)']], a.periods, (v) => { a.periods = +v; savePi(); ctx.rerender(); });
  field(st, 'Audio server');
  seg(st.lastChild.lastChild, [['pipewire', 'PipeWire'], ['jack', 'JACK2 (lowest latency)']], a.server, (v) => { a.server = v; savePi(); });
  const opt = (label, hint, key) => {
    const r = el('div', { class: 'pi-opt' }, st);
    el('div', {}, r, `<b>${label}</b><small>${hint}</small>`);
    toggle(r, a[key], (v) => { a[key] = v; savePi(); });
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
  if (audioDevice(a.output).id === 'hdmi') el('p', { class: 'pi-warn' }, lc).textContent = 'HDMI audio adds a lot of latency. Use it for listening only.';
  if (audioDevice(a.input).kind === 'aux') el('p', { class: 'pi-warn' }, lc).textContent = 'USB audio adapters expect mic or line level. Put a boost, buffer pedal or DI box before it for a full guitar sound.';

  const lv = card(right, 'Levels', null);
  const mi = meter(lv, 42, 'ok', 'Input');
  const mo = meter(lv, 55, 'ok', 'Output');
  const tick = setInterval(() => {
    if (!mi.isConnected) return clearInterval(tick);
    mi.firstChild.style.width = 20 + Math.random() * 40 + '%';
    mo.firstChild.style.width = 30 + Math.random() * 40 + '%';
  }, 200);
  const tt = el('button', { class: 'btn small' }, lv, 'Play test tone');
  tt.onclick = () => { piLog('Test tone 440 Hz, -18 dBFS on output', 'info', 'engine'); toast('Test tone on the Pi output (demo)'); };
  demoNote(main, 'Levels and latency are estimates until a Pi is connected.');
}

// ------------------------------------------------------------------ Updates
const LATEST = '0.8.1';
const CHANGES = ['Faster preset switching with preloading', 'Pi 5: NAM A2 Full at 128 frames', 'Fixed: footswitch hold sometimes counted as a press', 'Tuner on the OLED screen'];

export function renderUpdates(main, ctx) {
  const { store, dev } = ctx;
  const u = store.updates;
  const top = el('div', { class: 'pi-sechead' }, main);
  el('div', {}, top, '<h2>Updates</h2><p>Signed updates with automatic rollback. Your presets and settings are kept.</p>');
  if (!dev) return el('div', { class: 'pi-empty' }, main).textContent = 'Add a Pi first.';
  const cols = el('div', { class: 'pi-cols' }, main);
  const left = el('div', { class: 'pi-col' }, cols);
  const right = el('div', { class: 'pi-col' }, cols);
  const c = card(left, dev.name, `${MODELS[dev.model].name}, Tone Zone ${dev.version}`);
  const ver = el('div', { class: 'pi-verrow' }, c);
  el('div', {}, ver, `<span>Installed</span><b data-ver>${dev.version}</b>`);
  el('div', {}, ver, `<span>Latest (${u.channel})</span><b>${u.channel === 'stable' ? LATEST : LATEST + '-beta.2'}</b>`);
  el('div', {}, ver, `<span>Previous</span><b>${dev.prevVersion || '0.7.2'}</b>`);
  field(c, 'Channel');
  seg(c.lastChild.lastChild, [['stable', 'Stable'], ['beta', 'Beta'], ['nightly', 'Nightly']], u.channel, (v) => { u.channel = v; savePi(); ctx.rerender(); });
  field(c, 'Update through');
  seg(c.lastChild.lastChild, [['network', 'Pi downloads it (Wi-Fi / Ethernet)'], ['push', 'This app sends it (network or cable)'], ['usb', 'USB stick']], u.via, (v) => { u.via = v; savePi(); ctx.rerender(); }, { 'data-ctl': 'via' });
  if (u.via === 'usb') el('p', { class: 'pi-muted' }, c).textContent = 'Save the update file to a USB stick, plug it into the Pi and press footswitch 1 and 4 together (or tap Update on the screen).';
  const r = el('div', { class: 'pi-opt' }, c);
  el('div', {}, r, '<b>Install automatically</b><small>Only when the Pi has had no guitar signal for 10 minutes. Never during a show.</small>');
  toggle(r, u.auto, (v) => { u.auto = v; savePi(); });

  const act = el('div', { class: 'pi-row' }, c);
  const chk = el('button', { class: 'btn', 'data-act': 'check-update' }, act, 'Check for updates');
  const inst = el('button', { class: 'btn btn-accent', 'data-act': 'install-update' }, act, `Install ${LATEST}`);
  const rb = el('button', { class: 'btn btn-ghost', 'data-act': 'rollback' }, act, 'Roll back');
  const prog = el('div', { class: 'pi-progress hidden', 'data-progress': 'update' }, c, '<div class="pi-pbar"><i></i></div><span></span>');
  const upToDate = dev.version === LATEST;
  inst.disabled = upToDate;
  if (upToDate) inst.textContent = 'Up to date';
  chk.onclick = () => {
    chk.textContent = 'Checking...';
    setTimeout(() => { chk.textContent = 'Check for updates'; toast(upToDate ? 'Already up to date' : `Tone Zone ${LATEST} is available`); piLog(`Update check (${u.channel}): ${upToDate ? 'up to date' : LATEST + ' available'}`); }, 700);
  };
  inst.onclick = async () => {
    inst.disabled = chk.disabled = rb.disabled = true;
    prog.classList.remove('hidden');
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
  rb.onclick = () => {
    const back = dev.prevVersion || '0.7.2';
    dev.prevVersion = dev.version;
    dev.version = back;
    savePi();
    piLog(`Rolled back to ${back} (switched slot)`, 'warn');
    toast(`Rolled back to ${back} (demo)`);
    ctx.rerender();
  };

  const n = card(right, `What is new in ${LATEST}`, null);
  const ul = el('ul', { class: 'pi-list' }, n);
  for (const t of CHANGES) el('li', {}, ul).textContent = t;
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
  cp.onclick = () => {
    try { navigator.clipboard.writeText(piLogs().map((l) => `${new Date(l.t).toISOString()} ${l.src} ${l.lvl} ${l.msg}`).join('\n')); } catch { /* ignore */ }
    toast('Logs copied');
  };
  sb.onclick = () => toast('A support bundle (logs, settings, no presets) will download from the Pi (demo)');
  const ssh = card(main, 'Same logs over SSH', null);
  copyBox(ssh, 'journalctl -u tonezone-engine -u tz-agent -f');
}
