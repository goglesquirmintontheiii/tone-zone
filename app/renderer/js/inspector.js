// Right-hand inspector: precise parameter editing, variants, DSP cost and block info.
import { el, esc, bus, clamp } from './util.js';
import { getDef, canSwitchVariant } from './catalog/index.js';
import { state, blockById, uiParams, setParam, setBypass, setVariant, removeBlocks, duplicateBlocks, engineParamsFor, commitNow, sendParamsFor } from './state.js';
import { knobPos, knobValue } from './nodeview.js';

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
    if (c.t === 'mic') continue;
    seen.add(c.p);
    rowFor(ctlSec, b, c, ui);
  }
  // cabinet microphone section
  if (d.algo === 'cab') {
    const ms = el('div', { class: 'insp-section' }, body);
    el('h5', {}, ms).textContent = 'Microphone';
    rowFor(ms, b, { t: 'sel', p: 'mic', label: 'Mic', options: ['Dynamic 57', 'Condenser 414', 'Ribbon 121', 'Dynamic 421'], def: d.opts.mic ?? 0 }, ui);
    rowFor(ms, b, { t: 'knob', p: 'position', label: 'Position', min: 0, max: 1, def: 0.3, display: (v) => (v < 0.15 ? 'Cap centre' : v > 0.8 ? 'Cone edge' : Math.round(v * 100) + '%') }, ui);
    rowFor(ms, b, { t: 'knob', p: 'distance', label: 'Distance', min: 0, max: 1, def: 0.15, display: (v) => (1 + v * 30).toFixed(0) + ' cm' }, ui);
    if ((b.variant || 'mono') === 'stereo') {
      rowFor(ms, b, { t: 'sel', p: 'mic2', label: 'Mic 2', options: ['Dynamic 57', 'Condenser 414', 'Ribbon 121', 'Dynamic 421'], def: 2 }, ui);
      rowFor(ms, b, { t: 'knob', p: 'position2', label: 'Position 2', min: 0, max: 1, def: 0.5 }, ui);
      rowFor(ms, b, { t: 'knob', p: 'mix', label: 'Mic blend', min: 0, max: 1, def: 0.5 }, ui);
    }
    rowFor(ms, b, { t: 'knob', p: 'lowcut', label: 'Low cut', min: 20, max: 500, def: 30, curve: 'log', unit: 'Hz' }, ui);
    rowFor(ms, b, { t: 'knob', p: 'highcut', label: 'High cut', min: 2000, max: 20000, def: 14000, curve: 'log', unit: 'Hz' }, ui);
    rowFor(ms, b, { t: 'knob', p: 'level', label: 'Level', min: -24, max: 12, def: 0, display: (v) => v.toFixed(1) + ' dB' }, ui);
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
    const extra = reg.filter((p) => !seen.has(p.name) && !fixed.has(p.name) && !derived.has(p.name) && !(d.algo === 'cab' && ['mic', 'position', 'distance', 'mic2', 'position2', 'mix', 'lowcut', 'highcut', 'level', 'model'].includes(p.name)));
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
