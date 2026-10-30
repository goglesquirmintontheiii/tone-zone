// Small form helpers shared by the Pi tab sections.
import { el } from '../util.js';
import { loadLevel, loadColor, tempLevel, tempColor, isLive } from './pi-data.js';

export function card(parent, title, sub, cls = '') {
  const c = el('div', { class: 'pi-card ' + cls }, parent);
  if (title) {
    const h = el('div', { class: 'pi-card-head' }, c);
    const t = el('div', {}, h);
    el('h3', {}, t).textContent = title;
    if (sub) el('p', {}, t).textContent = sub;
    c.head = h;
  }
  return c;
}
export function field(parent, label, hint) {
  const r = el('div', { class: 'pi-field' }, parent);
  const l = el('div', { class: 'pi-flabel' }, r);
  el('span', {}, l).textContent = label;
  if (hint) el('small', {}, l).textContent = hint;
  return el('div', { class: 'pi-fctl' }, r);
}
export function seg(parent, options, value, onPick, attrs = {}) {
  const s = el('div', Object.assign({ class: 'seg' }, attrs), parent);
  for (const [v, label] of options) {
    const b = el('button', { class: v === value ? 'on' : '', 'data-v': v }, s);
    b.textContent = label;
    b.onclick = () => { [...s.children].forEach((x) => x.classList.toggle('on', x === b)); onPick(v); };
  }
  return s;
}
export function select(parent, options, value, onPick, attrs = {}) {
  const s = el('select', attrs, parent);
  for (const [v, label] of options) {
    const o = el('option', { value: v }, s);
    o.textContent = label;
    if (String(v) === String(value)) o.selected = true;
  }
  s.onchange = () => onPick(s.value);
  return s;
}
export function toggle(parent, on, onChange, attrs = {}) {
  const l = el('label', Object.assign({ class: 'switch' }, attrs), parent);
  const i = el('input', { type: 'checkbox' }, l);
  i.checked = !!on;
  el('span', {}, l);
  i.onchange = () => onChange(i.checked);
  return i;
}
export function range(parent, min, max, value, onInput, fmt = (v) => v, step = 1) {
  const w = el('div', { class: 'pi-range' }, parent);
  const r = el('input', { type: 'range', min, max, step, value }, w);
  const v = el('span', { class: 'pi-rval' }, w);
  const paint = () => { r.style.setProperty('--p', ((r.value - min) / (max - min)) * 100 + '%'); v.textContent = fmt(+r.value); };
  paint();
  r.oninput = () => { paint(); onInput(+r.value); };
  return r;
}
// a bar with a label; kind ok / heavy / bad picks the colour
export function meter(parent, pct, kind = 'ok', label = '') {
  const m = el('div', { class: 'pi-meter ' + kind }, parent);
  el('i', {}, m).style.width = Math.min(100, Math.max(0, pct)) + '%';
  if (label) el('span', {}, m).textContent = label;
  return m;
}
// a load bar (DSP or CPU) whose colour follows the value; budget draws a marker
export function loadMeter(parent, pct, opts = {}) {
  const m = el('div', { class: 'pi-meter pi-load' }, parent);
  el('i', {}, m);
  if (opts.budget) {
    const k = el('em', { class: 'pi-budget-mark', title: 'DSP budget' }, m);
    k.style.left = opts.budget + '%';
  }
  if (opts.label) el('span', {}, m).textContent = opts.label;
  paintLoad(m, pct, opts.budget);
  return m;
}
export function paintLoad(m, pct, budget) {
  const v = Math.min(100, Math.max(0, pct || 0));
  m.firstChild.style.width = v + '%';
  m.style.setProperty('--lc', loadColor(v));
  m.classList.remove('load-ok', 'load-warn', 'load-hot');
  m.classList.add(loadLevel(v));
  m.dataset.load = Math.round(v);
  const mark = m.querySelector('.pi-budget-mark');
  if (mark && budget) {
    mark.style.left = budget + '%';
    m.classList.toggle('over', v > budget);
  }
}
// temperature text coloured like the load bars, flashing above 80 C
export function paintTemp(n, c) {
  n.textContent = c ? c.toFixed(0) + ' C' : '-';
  n.classList.add('pi-temp');
  n.classList.remove('temp-ok', 'temp-warn', 'temp-hot', 'temp-crit');
  if (!c) return;
  n.classList.add(tempLevel(c));
  n.style.setProperty('--tc', tempColor(c));
  n.dataset.temp = Math.round(c);
}
// only shown in demo mode
export function demoNote(parent, text) {
  if (isLive()) return el('div');
  const n = el('div', { class: 'pi-demo-note' }, parent, '<b>Demo</b><span></span>');
  n.lastChild.textContent = text;
  return n;
}
export function copyBox(parent, text, label) {
  const b = el('div', { class: 'pi-code' }, parent);
  if (label) el('div', { class: 'pi-code-label' }, b).textContent = label;
  const row = el('div', { class: 'pi-code-row' }, b);
  el('pre', {}, row).textContent = text;
  const c = el('button', { class: 'btn small', 'data-copy': '' }, row, 'Copy');
  c.onclick = () => {
    try { navigator.clipboard.writeText(text); } catch { /* clipboard may be blocked */ }
    c.textContent = 'Copied';
    setTimeout(() => (c.textContent = 'Copy'), 1400);
  };
  return b;
}
// fake progress through named stages; returns a promise
export function fakeProgress(bar, label, stages, ms = 500) {
  return new Promise((resolve) => {
    let i = 0;
    const total = stages.length;
    const tick = () => {
      if (i >= total) { bar.style.width = '100%'; resolve(); return; }
      label.textContent = stages[i];
      bar.style.width = Math.round(((i + 1) / total) * 100) + '%';
      i++;
      setTimeout(tick, ms);
    };
    tick();
  });
}
