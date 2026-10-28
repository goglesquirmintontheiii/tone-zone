// Right-hand inspector: precise parameter editing, variants, DSP cost and block info.
import { MIC_TYPES, MIC_COLORS, defaultMicXY } from './gfx/cabgeom.js';
import { el, esc, bus, clamp } from './util.js';
import { getDef, canSwitchVariant } from './catalog/index.js';
import { state, blockById, uiParams, setParam, setBypass, setVariant, removeBlocks, duplicateBlocks, engineParamsFor, commitNow, sendParamsFor } from './state.js';
import { knobPos, knobValue } from './nodeview.js';
import { hooksFor } from './plugins.js';
import { ioConf, setIo, IO_PORT_NAMES, IO_DEFAULT_LABELS, portsSnapshot, requestPorts, openPortPicker, sendEngineSettings } from './pages/settings.js';

let root, body, current = null, editorRef = null;
const blockInfo = {};

export function initInspector(editor) {
  editorRef = editor;
  root = document.getElementById('inspector');
  body = root.querySelector('.insp-body');
  bus.on('selection', render);
  bus.on('preset:changed', render);
  bus.on('param', ({ id }) => id === current && refreshValues());
  bus.on('bypass', ({ id }) => id === current && render());
  bus.on('blockInfo', ({ id, info }) => {
    blockInfo[id] = info;
    if (id === current) render();
  });
  setInterval(updateCost, 500);
}

function fmtVal(c, v) {
  if (v === undefined || v === null) return '–';
  if (c.t === 'sel' || c.t === 'toggle') return c.options[v | 0] ?? String(v);
  if (c.display) return c.display(v, c);
  if (c.unit) return (c.unit === 'Hz' && v >= 1000 ? (v / 1000).toFixed(2) + 'k' : v >= 100 ? v.toFixed(0) : v.toFixed(1)) + ' ' + c.unit;
  return (((v - (c.min ?? 0)) / ((c.max ?? 1) - (c.min ?? 0))) * 10).toFixed(1);
}

function render() {
  const io = [...state.selection].find((id) => id === '__in' || id === '__out');
  if (io && state.selection.size === 1) return renderIO(io === '__in' ? 'in' : 'out');
  const ids = [...state.selection].filter((id) => !id.startsWith('__'));
  if (ids.length !== 1) {
    current = null;
    root.classList.add('collapsed');
    if (ids.length > 1) {
      root.classList.remove('collapsed');
      body.innerHTML = '';
      el('div', { class: 'insp-title' }, body, `<div><h3>${ids.length} blocks selected</h3><p>Drag to move them together.</p></div>`);
      const a = el('div', { class: 'insp-section insp-actions' }, body);
      el('button', { class: 'btn small', onclick: () => ids.forEach((id) => setBypass(id, !blockById(id).bypass)) }, a, '<i class="ic ic-power"></i>Toggle bypass');
      el('button', { class: 'btn small', onclick: () => editorRef.select(duplicateBlocks(ids).map((b) => b.id)) }, a, '<i class="ic ic-copy"></i>Duplicate');
      el('button', { class: 'btn small btn-danger', onclick: () => removeBlocks(ids) }, a, '<i class="ic ic-trash"></i>Delete');
    }
    return;
  }
  const b = blockById(ids[0]);
  const d = b && getDef(b.type);
  if (!d) return;
  current = b.id;
  root.classList.remove('collapsed');
  body.innerHTML = '';
  const t = el('div', { class: 'insp-title' }, body);
  el('div', { class: 'swatch', style: { background: `linear-gradient(135deg, ${d.color}, ${d.color}cc)` } }, t);
  const tt = el('div', {}, t);
  el('h3', {}, tt).textContent = d.name;
  el('p', {}, tt).textContent = d.pack ? d.ref : d.ref && d.ref !== 'Tone Zone original' ? 'Inspired by ' + d.ref : d.typeName || d.cat;
  if (d.desc) el('p', { style: { marginTop: '8px', color: 'var(--text2)' } }, body).textContent = d.desc;

  // actions
  const a = el('div', { class: 'insp-section insp-actions' }, body);
  if (!d.alwaysOn) {
    const bb = el('button', { class: 'btn small' + (b.bypass ? '' : ' btn-accent') }, a, `<i class="ic ic-power"></i>${b.bypass ? (d.tunerBlock ? 'Tuner off' : 'Bypassed') : d.tunerBlock ? 'Tuning' : 'Active'}`);
    bb.onclick = () => setBypass(b.id, !b.bypass);
  }
  if (canSwitchVariant(d)) {
    const seg = el('div', { class: 'seg' }, a);
    for (const v of ['mono', 'stereo']) {
      const btn = el('button', { class: (b.variant || 'mono') === v ? 'on' : '' }, seg, v === 'mono' ? 'Mono' : 'Stereo');
      btn.onclick = () => {
        setVariant(b.id, v);
        editorRef.rerenderNode(b.id);
        render();
      };
    }
  }
  el('button', { class: 'btn small', title: 'Duplicate (Ctrl+D)', onclick: () => editorRef.select(duplicateBlocks([b.id]).map((x) => x.id)) }, a, '<i class="ic ic-copy"></i>');
  el('button', {
    class: 'btn small', title: 'Reset to defaults',
    onclick: () => {
      commitNow();
      const keep = d.initParams ? { ...d.initParams } : {};
      b.params = keep;
      sendParamsFor(b);
      bus.emit('param', { id: b.id });
    },
  }, a, '<i class="ic ic-reload"></i>');
  el('button', { class: 'btn small btn-danger', title: 'Delete', onclick: () => removeBlocks([b.id]) }, a, '<i class="ic ic-trash"></i>');

  // DSP cost
  const cost = el('div', { class: 'insp-section' }, body);
  el('h5', {}, cost).textContent = 'DSP cost';
  const cr = el('div', { class: 'cost' }, cost, '<div class="bar"><i></i></div><span class="pv" style="font:12px Share Tech Mono;min-width:60px;text-align:right">–</span>');
  cr.dataset.costFor = b.id;

  // controls
  const ctlSec = el('div', { class: 'insp-section' }, body);
  el('h5', {}, ctlSec).textContent = 'Controls';
  const ui = uiParams(b);
  const seen = new Set();
  for (const c of d.controls) {
    if (!c.p || seen.has(c.p) || c.t === 'screen' || c.t === 'led' || c.t === 'foot') continue;
    if (c.t === 'mic' || c.noInspector) continue;
    seen.add(c.p);
    rowFor(ctlSec, b, c, ui);
  }
  // cabinet microphones (up to 4, any speaker, mixed / panned)
  if (d.cabMics) {
    const ms = el('div', { class: 'insp-section' }, body);
    const hdr = el('h5', { class: 'h5-row' }, ms, 'Microphones');
    const sel = state.ui[b.id]?.selMic ?? 1;
    const stereo = (b.variant || 'mono') === 'stereo';
    let count = 0;
    for (let i = 1; i <= 4; i++) {
      if ((ui[`m${i}on`] ?? 0) < 0.5) continue;
      count++;
      const card = el('div', { class: 'mic-card' + (sel === i ? ' sel' : '') }, ms);
      const top = el('div', { class: 'mic-top' }, card, `<span class="mic-dot" style="background:${MIC_COLORS[i - 1]}">${i}</span><b>Mic ${i}</b><small>speaker ${(engineParamsFor(b)[`m${i}spk`] ?? 0) + 1}</small>`);
      top.onclick = () => { (state.ui[b.id] = state.ui[b.id] || {}).selMic = i; editorRef.views.get(b.id)?.updateControls(); render(); };
      if (count > 1 || [2, 3, 4].some((k) => (ui[`m${k}on`] ?? 0) > 0.5)) {
        const rm = el('button', { class: 'icon-btn sm', title: 'Remove mic' }, top, '<i class="ic ic-trash"></i>');
        rm.onclick = (e) => { e.stopPropagation(); setParam(b.id, `m${i}on`, 0); render(); };
      }
      rowFor(card, b, { t: 'sel', p: `m${i}type`, label: 'Model', options: MIC_TYPES, def: 0 }, ui);
      rowFor(card, b, { t: 'knob', p: `m${i}dist`, label: 'Distance', min: 0, max: 1, def: 0.15, display: (v) => (1 + v * 30).toFixed(0) + ' cm' }, ui);
      rowFor(card, b, { t: 'knob', p: `m${i}axis`, label: 'Angle', min: 0, max: 1, def: 0, display: (v) => (v < 0.02 ? 'On axis' : Math.round(v * 45) + '° off') }, ui);
      rowFor(card, b, { t: 'knob', p: `m${i}lvl`, label: 'Level', min: -40, max: 12, def: 0, display: (v) => v.toFixed(1) + ' dB' }, ui);
      if (stereo) rowFor(card, b, { t: 'knob', p: `m${i}pan`, label: 'Pan', min: -1, max: 1, def: 0, display: (v) => (Math.abs(v) < 0.02 ? 'C' : (v < 0 ? 'L' : 'R') + Math.round(Math.abs(v) * 100)) }, ui);
      rowFor(card, b, { t: 'toggle', p: `m${i}phase`, label: 'Polarity', options: ['Normal', 'Inverted'], def: 0 }, ui);
    }
    if (count < 4) {
      const add = el('button', { class: 'btn small', style: { marginTop: '8px' } }, ms, '<i class="ic ic-plus"></i>Add microphone');
      add.onclick = () => { addMic(b); render(); };
    }
    el('p', { class: 'hint' }, ms).textContent = 'Drag mics anywhere over the speakers · scroll on a mic for distance · shift-click to change model.';
    void hdr;
    const cs = el('div', { class: 'insp-section' }, body);
    el('h5', {}, cs).textContent = 'Cabinet';
    rowFor(cs, b, { t: 'knob', p: 'lowcut', label: 'Low cut', min: 20, max: 500, def: 30, curve: 'log', unit: 'Hz' }, ui);
    rowFor(cs, b, { t: 'knob', p: 'highcut', label: 'High cut', min: 2000, max: 20000, def: 14000, curve: 'log', unit: 'Hz' }, ui);
    rowFor(cs, b, { t: 'knob', p: 'level', label: 'Level', min: -24, max: 12, def: 0, display: (v) => v.toFixed(1) + ' dB' }, ui);
  }
  // plugin-provided inspector section
  const hk = hooksFor(d.id);
  if (hk && hk.inspector) {
    const sec = el('div', { class: 'insp-section' }, body);
    try { hk.inspector(sec, b, { rowFor: (c) => rowFor(sec, b, c, uiParams(b)), rerender: () => render() }); } catch (e) { console.error(e); }
  }
  if (d.id === 'mx.m222') {
    const ms = el('div', { class: 'insp-section' }, body);
    el('h5', {}, ms).textContent = 'Talk box';
    rowFor(ms, b, { t: 'toggle', p: 'mode', label: 'Mouth', options: ['Expression', 'Follows picking'], def: 1 }, ui);
    rowFor(ms, b, { t: 'knob', p: 'pos', label: 'Vowel (EXP)', min: 0, max: 1, def: 0.5, display: (v) => ['U', 'O', 'A', 'E', 'I'][Math.round(v * 4)] }, ui);
  }

  // NAM / IR pack info
  const inf = blockInfo[b.id];
  if (d.pack) {
    const ps = el('div', { class: 'insp-section' }, body);
    el('h5', {}, ps).textContent = d.algo === 'nam' ? 'NAM configurations' : 'Impulse responses';
    const list = el('div', { class: 'kv' }, ps);
    d.pack.models.forEach((m, i) => {
      const mi = inf?.models?.[i] || inf?.irs?.[i];
      el('span', {}, list).textContent = (i === (ui.model | 0) ? '▶ ' : '') + (i + 1);
      el('span', {}, list).textContent = m.name + (mi ? ` · ${mi.arch || ''}${mi.sr ? ' ' + Math.round(mi.sr / 100) / 10 + 'k' : ''}${mi.resampled ? ' (resampled)' : ''}${mi.slimmable ? ' · A2 slimmable' : ''}${mi.error ? ' ⚠ ' + mi.error : ''}` : '');
    });
    if (d.algo === 'nam') {
      rowFor(ps, b, { t: 'sel', p: 'size', label: 'A2 size', options: ['Auto (DSP quality)', 'Lite', 'Full'], values: [-1, 0, 1], def: -1 }, ui, true);
      rowFor(ps, b, { t: 'toggle', p: 'normalize', label: 'Normalize', options: ['Off', 'On'], def: 1 }, ui);
    }
  }

  // advanced engine params
  const reg = state.engineParams[d.algo];
  if (reg) {
    const fixed = new Set(Object.keys(d.fixed || {}));
    const derived = d.derive ? new Set(Object.keys(d.derive(ui) || {})) : new Set();
    const extra = reg.filter((p) => !seen.has(p.name) && !fixed.has(p.name) && !derived.has(p.name) && !(d.algo === 'cab' && (/^m[1-4]/.test(p.name) || ['lowcut', 'highcut', 'level', 'model'].includes(p.name))));
    if (extra.length) {
      const det = el('details', { class: 'insp-section' }, body);
      el('summary', { style: { cursor: 'pointer', color: 'var(--muted)', fontSize: '11px', letterSpacing: '.12em', textTransform: 'uppercase', fontWeight: 700 } }, det).textContent = `Advanced (${extra.length})`;
      const box = el('div', { style: { marginTop: '10px' } }, det);
      const eng = engineParamsFor(b);
      for (const p of extra) rowFor(box, b, { t: 'knob', p: p.name, label: p.name, min: p.min, max: p.max, def: p.def }, Object.assign({}, eng, ui));
    }
  }
  updateCost();
}

function rowFor(parent, b, c, ui, rawIndex = false) {
  const row = el('div', { class: 'prow' }, parent);
  el('label', { title: c.p }, row).textContent = c.label || c.p;
  let input;
  const v = ui[c.p] ?? (c.t === 'sel' || c.t === 'toggle' ? c.def ?? 0 : c.def ?? c.min ?? 0);
  const pv = el('span', { class: 'pv' }, row);
  if (c.t === 'sel' || c.t === 'toggle') {
    input = el('select', {}, row);
    c.options.forEach((o, i) => el('option', { value: i }, input).textContent = o);
    if (c.values && rawIndex) input.value = Math.max(0, c.values.indexOf(v));
    else input.value = v | 0;
    input.onchange = () => setParam(b.id, c.p, rawIndex && c.values ? c.values[+input.value] : +input.value);
    pv.textContent = '';
    row.insertBefore(input, pv);
  } else if (c.t === 'button') {
    const lab = el('label', { class: 'switch' }, row, `<input type="checkbox" ${v ? 'checked' : ''}><span></span>`);
    lab.querySelector('input').onchange = (e) => setParam(b.id, c.p, e.target.checked ? 1 : 0);
    row.insertBefore(lab, pv);
  } else {
    input = el('input', { type: 'range', min: 0, max: 1000, step: 1 }, row);
    const pos = knobPos(c, v);
    input.value = Math.round(pos * 1000);
    input.style.setProperty('--p', pos * 100 + '%');
    input.oninput = () => {
      const p = input.value / 1000;
      input.style.setProperty('--p', p * 100 + '%');
      const val = knobValue(c, p);
      setParam(b.id, c.p, val);
      pv.textContent = fmtVal(c, val);
    };
    input.ondblclick = () => setParam(b.id, c.p, c.def ?? 0.5);
    row.insertBefore(input, pv);
    pv.textContent = fmtVal(c, v);
  }
  row._c = c;
  row._input = input;
  row._pv = pv;
}

function refreshValues() {
  const b = blockById(current);
  if (!b) return;
  const ui = uiParams(b);
  body.querySelectorAll('.prow').forEach((row) => {
    const c = row._c;
    if (!c || !row._input) return;
    const v = ui[c.p];
    if (v === undefined) return;
    if (c.t === 'sel' || c.t === 'toggle') {
      if (document.activeElement !== row._input) row._input.value = c.values && row._input.options.length === c.values.length && c.p === 'size' ? Math.max(0, c.values.indexOf(v)) : v | 0;
    } else if (document.activeElement !== row._input) {
      const pos = knobPos(c, v);
      row._input.value = Math.round(pos * 1000);
      row._input.style.setProperty('--p', pos * 100 + '%');
      row._pv.textContent = fmtVal(c, v);
    }
  });
}

function updateCost() {
  const row = body && body.querySelector('[data-cost-for]');
  if (!row) return;
  const id = row.dataset.costFor;
  const st = state.status.blocks[id];
  const d = getDef(blockById(id)?.type || '');
  const load = st && typeof st.load === 'number' ? st.load * 100 : null;
  const bar = row.querySelector('.bar i');
  const pv = row.querySelector('.pv');
  const v = load ?? d?.cost ?? 0;
  bar.style.width = clamp(v * 2, 0, 100) + '%';
  pv.textContent = load !== null ? v.toFixed(2) + '%' : '≈' + v.toFixed(1) + '%';
}

export function getBlockInfo() {
  return blockInfo;
}
void esc;

export function addMic(b) {
  const ui = uiParams(b);
  const d = getDef(b.type);
  for (let i = 1; i <= 4; i++) {
    if ((ui[`m${i}on`] ?? 0) > 0.5) continue;
    commitNow();
    const xy = defaultMicXY(d.cabSize || '4x12', i);
    Object.assign(b.params, { [`m${i}on`]: 1, [`m${i}type`]: [0, 2, 1, 3][i - 1], [`m${i}dist`]: 0.15, [`_m${i}x`]: xy.x, [`_m${i}y`]: xy.y });
    if ((b.variant || 'mono') === 'stereo') b.params[`m${i}pan`] = i % 2 ? -0.7 : 0.7;
    (state.ui[b.id] = state.ui[b.id] || {}).selMic = i;
    sendParamsFor(b);
    bus.emit('param', { id: b.id });
    return i;
  }
  return 0;
}

// ------------------------------------------------------------------ AUDIO IN / AUDIO OUT configuration
let ioPortsHandler = null;
function renderIO(dir, fromPorts = false) {
  current = dir === 'in' ? '__in' : '__out';
  root.classList.remove('collapsed');
  body.innerHTML = '';
  const t = el('div', { class: 'insp-title' }, body);
  el('div', { class: 'swatch', style: { background: 'linear-gradient(135deg,#2a3040,#161a22)' } }, t);
  el('div', {}, t, `<h3>${dir === 'in' ? 'Audio In' : 'Audio Out'}</h3><p>${dir === 'in' ? 'Inputs from PipeWire into the board' : 'Board outputs to PipeWire'}</p>`);
  const conf = ioConf(dir);
  const snap = portsSnapshot();
  const me = snap && snap.self ? snap.self + ':' : null;
  const g = el('div', { class: 'insp-section' }, body);
  el('h5', {}, g).textContent = dir === 'in' ? 'Global input gain' : 'Global output gain';
  const key = dir === 'in' ? 'inGainDb' : 'outGainDb';
  const gr = el('div', { class: 'io-gain' }, g);
  const rng = el('input', { type: 'range', min: dir === 'in' ? -24 : -36, max: dir === 'in' ? 24 : 12, step: 0.5, value: state.settings[key] ?? 0 }, gr);
  const rv = el('span', { class: 'rv' }, gr);
  const upd = () => { rv.textContent = (+rng.value > 0 ? '+' : '') + (+rng.value).toFixed(1) + ' dB'; rng.style.setProperty('--p', ((rng.value - rng.min) / (rng.max - rng.min)) * 100 + '%'); };
  upd();
  rng.oninput = () => { upd(); state.settings[key] = +rng.value; sendEngineSettings(); };
  rng.onchange = () => window.tz.settings.set({ [key]: +rng.value });
  conf.forEach((c, i) => {
    const sec = el('div', { class: 'insp-section io-port' }, body);
    const hdr = el('div', { class: 'io-hdr' }, sec);
    el('span', { class: 'io-idx' }, hdr).textContent = IO_PORT_NAMES[dir][i];
    const name = el('input', { class: 'io-label', value: c.label, spellcheck: 'false', maxlength: 18 }, hdr);
    name.onchange = () => setIo(dir, i, { label: name.value.trim().toUpperCase() || IO_DEFAULT_LABELS[dir][i] });
    const row = el('div', { class: 'io-row' }, sec);
    const trim = el('input', { type: 'range', min: -24, max: 24, step: 0.5, value: c.gainDb || 0 }, row);
    const tv = el('span', { class: 'rv' }, row);
    const up2 = () => { tv.textContent = (+trim.value > 0 ? '+' : '') + (+trim.value).toFixed(1) + ' dB'; trim.style.setProperty('--p', ((+trim.value + 24) / 48) * 100 + '%'); };
    up2();
    trim.oninput = () => { up2(); setIo(dir, i, { gainDb: +trim.value }); };
    const mute = el('button', { class: 'chip sm' + (c.mute ? ' on' : ''), title: 'Mute' }, row, 'M');
    mute.onclick = () => { setIo(dir, i, { mute: !c.mute }); mute.classList.toggle('on', c.mute); };
    const inv = el('button', { class: 'chip sm' + (c.invert ? ' on' : ''), title: 'Invert polarity' }, row, 'Ø');
    inv.onclick = () => { setIo(dir, i, { invert: !c.invert }); inv.classList.toggle('on', c.invert); };
    // PipeWire connections for this port
    const chips = el('div', { class: 'port-chips io-conn' }, sec);
    if (!me) {
      el('small', { class: 'muted' }, chips).textContent = 'Audio engine not connected';
      return;
    }
    const full = me + IO_PORT_NAMES[dir][i];
    const mine = (dir === 'in' ? snap.sinks : snap.sources).find((p) => p.name === full);
    const others = (dir === 'in' ? snap.sources : snap.sinks).filter((p) => !p.name.startsWith(me));
    const conns = mine ? others.filter((o) => mine.connections.includes(o.name)) : [];
    if (!conns.length) el('small', { class: 'muted' }, chips).textContent = 'Not connected';
    for (const o of conns) {
      const ch = el('span', { class: 'port-chip', title: o.name }, chips, `${o.physical ? '<i class="hw"></i>' : ''}<span><strong>${esc(o.name.split(':').slice(1).join(':'))}</strong> <em>${esc(o.name.split(':')[0])}</em></span><b>×</b>`);
      ch.querySelector('b').onclick = () => window.tz.engine.send({ cmd: 'connect', src: dir === 'in' ? o.name : full, dst: dir === 'in' ? full : o.name, on: false });
    }
    const add = el('button', { class: 'port-add', title: 'Connect…' }, chips, '+');
    add.onclick = (e) => {
      e.stopPropagation();
      openPortPicker(add, others.filter((o) => !conns.includes(o)), (o) => window.tz.engine.send({ cmd: 'connect', src: dir === 'in' ? o.name : full, dst: dir === 'in' ? full : o.name, on: true }));
    };
  });
  el('p', { class: 'hint', style: { padding: '0 16px' } }, body).textContent = 'Labels, trims and connections are saved for this computer, not per preset.';
  if (!ioPortsHandler) {
    // re-render on port updates, but never request ports from here (that was a request → render → request loop)
    ioPortsHandler = () => {
      if (current !== '__in' && current !== '__out') return;
      if (document.querySelector('.port-picker')) return; // don't rebuild under an open picker
      renderIO(current === '__in' ? 'in' : 'out', true);
    };
    bus.on('ports', ioPortsHandler);
  }
  if (!fromPorts) requestPorts();
}
