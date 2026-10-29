// Settings: audio engine (buffer, quality, DSP budget), PipeWire routing, board preferences, about.
import { el, esc, bus, toast } from '../util.js';
import { state, CABLE_COLORS } from '../state.js';
import { captureSettingsPanel } from './capture.js';

let portsData = null;

export async function applySettings(s) {
  state.settings = Object.assign(state.settings, s);
  await window.tz.settings.set(s);
  sendEngineSettings();
  bus.emit('settings', state.settings);
}
export function sendEngineSettings() {
  const s = state.settings;
  window.tz.engine.send({ cmd: 'settings', quality: s.quality ?? 1, budget: s.budget ?? 0.75, autoQuality: !!s.autoQuality, inGainDb: s.inGainDb ?? 0, outGainDb: s.outGainDb ?? 0 });
  for (const dir of ['in', 'out']) (ioConf(dir) || []).forEach((c, index) => sendIo(dir, index, c));
}

// ---------------- per-port I/O configuration (labels, trim, mute, polarity) – stored per machine
export const IO_DEFAULT_LABELS = { in: ['GUITAR IN 1', 'GUITAR IN 2', 'RETURN L', 'RETURN R'], out: ['MAIN OUT L', 'MAIN OUT R', 'SEND L', 'SEND R'] };
export const IO_PORT_NAMES = { in: ['in_1', 'in_2', 'return_1', 'return_2'], out: ['out_L', 'out_R', 'send_1', 'send_2'] };
export function ioConf(dir) {
  const io = (state.settings.io = state.settings.io || {});
  if (!io[dir]) io[dir] = IO_DEFAULT_LABELS[dir].map((label) => ({ label, gainDb: 0, mute: false, invert: false }));
  return io[dir];
}
function sendIo(dir, index, c) {
  window.tz.engine.send({ cmd: 'io', dir, index, gainDb: c.gainDb || 0, mute: !!c.mute, invert: !!c.invert });
}
export function setIo(dir, index, patch) {
  const c = ioConf(dir)[index];
  Object.assign(c, patch);
  sendIo(dir, index, c);
  window.tz.settings.set({ io: state.settings.io });
  if ('label' in patch) bus.emit('rebuildBoard');
}
let renderAfterPicker = false;
export function portsSnapshot() {
  return portsData;
}
export function requestPorts() {
  window.tz.engine.send({ cmd: 'ports' });
}

export function onPorts(ev) {
  portsData = ev;
  renderPorts();
  bus.emit('ports', ev);
}

function srow(parent, title, sub, ctrl) {
  const r = el('div', { class: 'srow' }, parent);
  el('div', { class: 'lbl' }, r, `<b>${esc(title)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}`);
  const c = el('div', { class: 'ctrl' }, r);
  if (ctrl) c.appendChild(ctrl);
  return c;
}
function seg(options, value, onPick) {
  const s = el('div', { class: 'seg' });
  for (const [v, l] of options) {
    const b = el('button', { class: v === value ? 'on' : '' }, s, l);
    b.onclick = () => {
      s.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
      onPick(v);
    };
  }
  return s;
}
function toggle(value, onChange) {
  const l = el('label', { class: 'switch' }, null, `<input type="checkbox" ${value ? 'checked' : ''}><span></span>`);
  l.querySelector('input').onchange = (e) => onChange(e.target.checked);
  return l;
}
function range(min, max, step, value, fmt, onChange) {
  const w = el('div', { style: { display: 'flex', alignItems: 'center', gap: '10px', width: '230px' } });
  const r = el('input', { type: 'range', min, max, step, value }, w);
  const v = el('span', { class: 'rv' }, w);
  const upd = () => {
    v.textContent = fmt(+r.value);
    r.style.setProperty('--p', ((r.value - min) / (max - min)) * 100 + '%');
  };
  upd();
  r.oninput = () => { upd(); onChange(+r.value, false); };
  r.onchange = () => onChange(+r.value, true);
  return w;
}

export function renderSettings() {
  const s = state.settings;
  const v = document.getElementById('view-settings');
  v.innerHTML = '';
  const page = el('div', { class: 'page' }, v);
  el('div', { class: 'page-head' }, page, '<div><h1>Settings</h1><p>Audio engine, PipeWire routing and board preferences.</p></div>');
  const grid = el('div', { class: 'settings-grid' }, page);

  // ---------------- audio
  const a = el('div', { class: 'panel' }, grid);
  el('h3', {}, a, '<i class="ic ic-chip"></i>Audio engine');
  el('p', {}, a).textContent = 'Tone Zone runs as a native PipeWire (JACK API) client with a realtime DSP engine.';
  const st = state.status;
  const info = srow(a, 'Status', st.running ? `${st.sr} Hz · ${st.buffer} frames · round trip ≈ ${(st.latencyMs || 0).toFixed(1)} ms` : 'Not connected to PipeWire', null);
  info.id = 'audioStatusCtl';
  const re = el('button', { class: 'btn small' }, info, '<i class="ic ic-reload"></i>Reconnect');
  re.onclick = () => window.tz.engine.send({ cmd: 'reconnect' });
  srow(a, 'Buffer size (quantum)', 'Smaller = lower latency, more CPU. 64 @ 48 kHz ≈ 1.3 ms per buffer.', seg([[32, '32'], [64, '64'], [128, '128'], [256, '256'], [512, '512']], s.buffer ?? 64, (b) => { applySettings({ buffer: b }); toast(`Requesting a ${b}-frame quantum from PipeWire…`, 'info'); }));
  srow(a, 'DSP quality', 'Oversampling for amps & drives, IR length and A2 NAM size.', seg([[0, 'Eco'], [1, 'Standard'], [2, 'High'], [3, 'Ultra']], s.quality ?? 1, (q) => applySettings({ quality: q })));
  srow(a, 'DSP budget', 'Share of each audio cycle the board may use. Shown as the white marker on the DSP meter.', range(20, 95, 1, Math.round((s.budget ?? 0.75) * 100), (x) => x + '%', (x, fin) => fin && applySettings({ budget: x / 100 })));
  srow(a, 'Auto-lower quality', 'If the board stays over budget for a few seconds, step the DSP quality down automatically.', toggle(!!s.autoQuality, (x) => applySettings({ autoQuality: x })));
  srow(a, 'Enforce budget', 'Refuse to add blocks that would exceed the budget.', toggle(!!s.hardLimit, (x) => applySettings({ hardLimit: x })));
  srow(a, 'Input gain', 'Applied to every input before the board.', range(-24, 24, 0.5, s.inGainDb ?? 0, (x) => (x > 0 ? '+' : '') + x.toFixed(1) + ' dB', (x) => applySettings({ inGainDb: x })));
  srow(a, 'Output gain', 'Master level after the board (a soft safety limiter sits after it).', range(-36, 12, 0.5, s.outGainDb ?? 0, (x) => (x > 0 ? '+' : '') + x.toFixed(1) + ' dB', (x) => applySettings({ outGainDb: x })));
  const rst = srow(a, 'Engine', 'Restart the audio engine process.', null);
  const rb = el('button', { class: 'btn small' }, rst, '<i class="ic ic-power"></i>Restart engine');
  rb.onclick = () => window.tz.engine.restart();

  // ---------------- routing
  const r = el('div', { class: 'panel' }, grid);
  el('h3', {}, r, '<i class="ic ic-cable"></i>PipeWire routing');
  el('p', {}, r).textContent = 'Tone Zone appears as “Tone Zone” in Helvum, qpwgraph, Carla or any patchbay. You can also patch it here.';
  srow(r, 'Auto-connect on start', 'Connect the first hardware input and the stereo outputs automatically.', toggle(s.autoConnect !== false, (x) => applySettings({ autoConnect: x })));
  const ac = srow(r, 'Connect defaults now', '', null);
  el('button', { class: 'btn small', onclick: () => window.tz.engine.send({ cmd: 'autoConnect' }) }, ac, 'Auto-connect');
  el('button', { class: 'btn small', onclick: () => window.tz.engine.send({ cmd: 'ports' }) }, ac, '<i class="ic ic-reload"></i>Refresh');
  el('div', { class: 'ports', id: 'portsBox' }, r);
  renderPorts();
  window.tz.engine.send({ cmd: 'ports' });

  // ---------------- board
  const bd = el('div', { class: 'panel' }, grid);
  el('h3', {}, bd, '<i class="ic ic-board"></i>Board');
  el('p', {}, bd).textContent = 'How the pedalboard looks and behaves.';
  srow(bd, 'Signal flow', 'Real pedals take input on the right. Choose left→right to mirror every jack.', seg([[false, 'Realistic (R → L)'], [true, 'Left → right']], !!s.flowLeftToRight, (x) => { applySettings({ flowLeftToRight: x }); bus.emit('rebuildBoard'); }));
  srow(bd, 'Snap to grid', '', toggle(s.snap !== false, (x) => applySettings({ snap: x })));
  srow(bd, 'Show per-block DSP load', '', toggle(s.showLoad !== false, (x) => applySettings({ showLoad: x })));
  const cc = srow(bd, 'Default cable colour', 'Right-click any cable to recolour it.', null);
  const sw = el('div', { class: 'color-row' }, cc);
  for (const c of CABLE_COLORS) {
    const i = el('i', { style: { background: c }, class: c === state.cableColor ? 'on' : '' }, sw);
    i.onclick = () => {
      bus.emit('cableColor', c);
      sw.querySelectorAll('i').forEach((x) => x.classList.toggle('on', x === i));
    };
  }

  // ---------------- capture trainer
  captureSettingsPanel(grid);

  // ---------------- about
  const ab = el('div', { class: 'panel' }, grid);
  el('h3', {}, ab, 'About & shortcuts');
  window.tz.app.info().then((inf) => {
    el('p', {}, ab).textContent = `Tone Zone ${inf.version} · data in ${inf.dataDir}`;
    const t = el('div', { class: 'sc-table' }, ab);
    const sc = [
      ['Drag knob', 'turn (Shift = fine), wheel works too, double-click = default'],
      ['Drag jack', 'patch a cable; drag a plugged input to move / unplug it'],
      ['Shift+drag board', 'rubber-band select several blocks (Shift+click adds one)'],
      ['Shift+drag output', 'pick up the last cable from an output'],
      ['Right-click', 'block / cable menus (colours, stereo, duplicate…)'],
      ['Del', 'delete selection'], ['Ctrl+D', 'duplicate'], ['B', 'bypass selected'], ['F', 'fit board'],
      ['Ctrl+Z / Ctrl+Shift+Z', 'undo / redo'], ['Ctrl+S', 'save preset'], ['Space+drag / middle drag', 'pan'],
    ];
    for (const [k, d] of sc) {
      el('span', {}, t, `<kbd>${esc(k)}</kbd>`);
      el('span', {}, t).textContent = d;
    }
  });
}

function renderPorts() {
  const box = document.getElementById('portsBox');
  if (!box) return;
  if (document.querySelector('.port-picker')) return (renderAfterPicker = true); // rebuilt when the picker closes
  box.innerHTML = '';
  if (!portsData || !portsData.self) {
    el('p', { class: 'ports-wait' }, box).textContent = 'Waiting for the audio engine…';
    return;
  }
  const me = portsData.self + ':';
  const mineIn = portsData.sinks.filter((p) => p.name.startsWith(me));
  const mineOut = portsData.sources.filter((p) => p.name.startsWith(me));
  const otherSrc = portsData.sources.filter((p) => !p.name.startsWith(me));
  const otherSink = portsData.sinks.filter((p) => !p.name.startsWith(me));
  const col = (title, mine, others, isInput) => {
    const c = el('div', { class: 'port-col' }, box);
    el('h5', {}, c).textContent = title;
    for (const m of mine) {
      const row = el('div', { class: 'port-row' }, c);
      el('div', { class: 'port-name' }, row).textContent = m.name.slice(me.length);
      const chips = el('div', { class: 'port-chips' }, row);
      const conns = others.filter((o) => m.connections.includes(o.name));
      for (const o of conns) {
        const ch = el('span', { class: 'port-chip', title: o.name }, chips, `${o.physical ? '<i class="hw"></i>' : ''}<span><strong>${esc(o.name.split(':').slice(1).join(':'))}</strong> <em>${esc(o.name.split(':')[0])}</em></span><b>×</b>`);
        ch.querySelector('b').onclick = () => window.tz.engine.send({ cmd: 'connect', src: isInput ? o.name : m.name, dst: isInput ? m.name : o.name, on: false });
      }
      const add = el('button', { class: 'port-add', title: 'Connect…' }, chips, '+');
      add.onclick = (e) => {
        e.stopPropagation();
        openPortPicker(add, others.filter((o) => !m.connections.includes(o.name)), (o) => window.tz.engine.send({ cmd: 'connect', src: isInput ? o.name : m.name, dst: isInput ? m.name : o.name, on: true }));
      };
    }
  };
  col('TONE ZONE INPUTS', mineIn, otherSrc, true);
  col('TONE ZONE OUTPUTS', mineOut, otherSink, false);
}

export function openPortPicker(anchor, list, onPick) {
  document.querySelectorAll('.port-picker').forEach((x) => x.remove());
  const r = anchor.getBoundingClientRect();
  const pop = el('div', { class: 'port-picker' }, document.body);
  pop.style.left = Math.min(window.innerWidth - 380, r.left) + 'px';
  pop.style.top = Math.min(window.innerHeight - 340, r.bottom + 6) + 'px';
  const q = el('input', { placeholder: 'Filter ports…', spellcheck: 'false' }, pop);
  const ul = el('div', { class: 'pp-list' }, pop);
  const draw = () => {
    ul.innerHTML = '';
    const f = q.value.trim().toLowerCase();
    const groups = new Map();
    for (const o of list) {
      if (f && !o.name.toLowerCase().includes(f)) continue;
      const client = o.name.split(':')[0];
      if (!groups.has(client)) groups.set(client, []);
      groups.get(client).push(o);
    }
    if (!groups.size) el('div', { class: 'pp-empty' }, ul).textContent = 'No matching ports';
    for (const [client, ports] of groups) {
      el('div', { class: 'pp-client' }, ul).textContent = client;
      for (const o of ports) {
        const it = el('div', { class: 'pp-item' }, ul, `${o.physical ? '<i class="hw"></i>' : ''}${esc(o.name.slice(client.length + 1))}`);
        it.onclick = () => { onPick(o); closePicker(); };
      }
    }
  };
  q.oninput = draw;
  draw();
  setTimeout(() => q.focus(), 0);
  const closePicker = () => {
    pop.remove();
    document.removeEventListener('pointerdown', close, true);
    if (renderAfterPicker) { renderAfterPicker = false; renderPorts(); }
    if (portsData) bus.emit('ports', portsData);
  };
  const close = (e) => { if (!pop.contains(e.target)) closePicker(); };
  document.addEventListener('pointerdown', close, true);
}
