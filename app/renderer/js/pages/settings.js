// Settings page: audio engine, PipeWire routing, board options, about.
import { el, esc, bus, toast } from '../util.js';
import { state, CABLE_COLORS } from '../state.js';
import { captureSettingsPanel } from './capture.js';

let portsData = null;

// App theme: only UI colours change (CSS variables in app.css). Popped out panels follow it too.
export const THEMES = [['dark', 'Dark'], ['light', 'White'], ['mono', 'Monochrome']];
export function applyTheme(t = state.settings.theme) {
  const theme = THEMES.some(([v]) => v === t) ? t : 'dark';
  const docs = new Set([document]);
  for (const id of ['browser', 'inspector']) {
    const p = themedPanels[id] || (themedPanels[id] = document.getElementById(id));
    if (p) docs.add(p.ownerDocument);
  }
  for (const d of docs) if (d && d.documentElement) d.documentElement.dataset.theme = theme;
}
const themedPanels = {};
bus.on('panelDock', () => applyTheme());

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

// ---------------- per-port I/O setup (label, trim, mute, polarity), saved per machine
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
  el('div', { class: 'page-head' }, page, '<div><h1>Settings</h1><p>Audio, PipeWire connections and board options.</p></div>');
  const grid = el('div', { class: 'settings-grid' }, page);

  // ---------------- audio
  const a = el('div', { class: 'panel' }, grid);
  el('h3', {}, a, '<i class="ic ic-chip"></i>Audio engine');
  el('p', {}, a).textContent = 'Tone Zone runs as a PipeWire client (through the JACK API).';
  const st = state.status;
  const info = srow(a, 'Status', st.running ? `${st.sr} Hz · ${st.buffer} frames · round trip about ${(st.latencyMs || 0).toFixed(1)} ms` : 'Not connected to PipeWire', null);
  info.id = 'audioStatusCtl';
  const re = el('button', { class: 'btn small' }, info, '<i class="ic ic-reload"></i>Reconnect');
  re.onclick = () => window.tz.engine.send({ cmd: 'reconnect' });
  srow(a, 'Buffer size', 'Smaller means less delay but more CPU. 64 at 48 kHz is about 1.3 ms.', seg([[32, '32'], [64, '64'], [128, '128'], [256, '256'], [512, '512']], s.buffer ?? 64, (b) => { applySettings({ buffer: b }); toast(`Asking PipeWire for a ${b}-frame buffer…`, 'info'); }));
  srow(a, 'DSP quality', 'Higher sounds better but uses more CPU. Affects amps, drives, IRs and NAM.', seg([[0, 'Eco'], [1, 'Standard'], [2, 'High'], [3, 'Ultra']], s.quality ?? 1, (q) => applySettings({ quality: q })));
  srow(a, 'DSP budget', 'How much CPU time the board may use. Shown as the white line on the DSP meter.', range(20, 95, 1, Math.round((s.budget ?? 0.75) * 100), (x) => x + '%', (x, fin) => fin && applySettings({ budget: x / 100 })));
  srow(a, 'Auto-lower quality', 'Lower the DSP quality when the board stays over budget for a few seconds.', toggle(!!s.autoQuality, (x) => applySettings({ autoQuality: x })));
  srow(a, 'Enforce budget', 'Stop new blocks from being added if they would go over the budget.', toggle(!!s.hardLimit, (x) => applySettings({ hardLimit: x })));
  srow(a, 'Input gain', 'Applied to every input before the board.', range(-24, 24, 0.5, s.inGainDb ?? 0, (x) => (x > 0 ? '+' : '') + x.toFixed(1) + ' dB', (x) => applySettings({ inGainDb: x })));
  srow(a, 'Output gain', 'Master level after the board. A soft limiter follows it for safety.', range(-36, 12, 0.5, s.outGainDb ?? 0, (x) => (x > 0 ? '+' : '') + x.toFixed(1) + ' dB', (x) => applySettings({ outGainDb: x })));
  const rst = srow(a, 'Engine', 'Restart the audio engine.', null);
  const rb = el('button', { class: 'btn small' }, rst, '<i class="ic ic-power"></i>Restart engine');
  rb.onclick = () => window.tz.engine.restart();

  // ---------------- routing
  const r = el('div', { class: 'panel' }, grid);
  el('h3', {}, r, '<i class="ic ic-cable"></i>PipeWire connections');
  el('p', {}, r).textContent = 'Tone Zone shows up as “Tone Zone” in Helvum, qpwgraph, Carla and other patchbays. You can also connect it here. Connections are remembered and come back the next time the app starts, also for a device you plug in later.';
  srow(r, 'Auto-connect on start', 'On the first start (nothing remembered yet), connect the first hardware input and the stereo outputs.', toggle(s.autoConnect !== false, (x) => applySettings({ autoConnect: x })));
  const ac = srow(r, 'Connect defaults now', '', null);
  el('button', { class: 'btn small', onclick: () => window.tz.engine.send({ cmd: 'autoConnect' }) }, ac, 'Auto-connect');
  el('button', { class: 'btn small', onclick: () => window.tz.engine.send({ cmd: 'ports' }) }, ac, '<i class="ic ic-reload"></i>Refresh');
  el('button', { class: 'btn small', title: 'Forget the remembered connections (the current ones stay)', onclick: () => { state.settings.pwLinks = []; window.tz.settings.set({ pwLinks: [] }); toast('Remembered connections cleared. The current ones are remembered again from now on.', 'ok', 3500); } }, ac, 'Forget');
  el('div', { class: 'ports', id: 'portsBox' }, r);
  renderPorts();
  window.tz.engine.send({ cmd: 'ports' });

  // ---------------- board
  const bd = el('div', { class: 'panel' }, grid);
  el('h3', {}, bd, '<i class="ic ic-board"></i>Board');
  el('p', {}, bd).textContent = 'How the pedalboard looks and works.';
  srow(bd, 'App theme', 'Changes the app colours only. Pedals, amps and cables keep their look.', seg(THEMES, s.theme || 'dark', (t) => { applyTheme(t); applySettings({ theme: t }); }));
  srow(bd, 'Signal flow', 'Real pedals take their input on the right. Pick Left to right to flip every jack.', seg([[false, 'Realistic (right to left)'], [true, 'Left to right']], !!s.flowLeftToRight, (x) => { applySettings({ flowLeftToRight: x }); bus.emit('rebuildBoard'); }));
  srow(bd, 'Snap to grid', '', toggle(s.snap !== false, (x) => applySettings({ snap: x })));
  srow(bd, 'Show DSP load on each block', '', toggle(s.showLoad !== false, (x) => applySettings({ showLoad: x })));
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
      ['Drag knob', 'turn it (hold Shift for fine steps). The wheel works too, double-click resets'],
      ['Drag jack', 'add a cable. Drag a plugged input to move or unplug it'],
      ['Shift+drag board', 'select several blocks (Shift+click adds one)'],
      ['Shift+drag output', 'pick up the last cable from an output'],
      ['Right-click', 'block and cable menus (colours, stereo, duplicate…)'],
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
  if (document.querySelector('.port-picker')) return (renderAfterPicker = true); // redrawn when the picker closes
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
