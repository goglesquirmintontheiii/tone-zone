// The screen generator panel: every style previewed live on this screen, with a choice of what to show.
import { el } from '../util.js';
import { STYLES, generate } from './generator.js';
import { ScreenRuntime } from './runtime.js';
import { makeHost, simIO, controlList } from './host.js';
import { screenPixels, paletteOf } from './surface.js';
import { loadCSS } from './factory-ui.js';

const LEVELS = [['in', 'Input level'], ['out', 'Output level'], ['env', 'Envelope'], ['lfo', 'LFO']];
let open = null;
export const generatorOpen = () => open;

/** o = { getD, id, onUse(code), paramsFor } */
export function openGenerator(o) {
  if (open) open.close();
  loadCSS();
  const D = o.getD();
  const c = (D.ctls || []).find((x) => x.id === o.id);
  if (!c) return null;
  const { W, H } = screenPixels(c);
  const list = controlList(D);
  const host = makeHost(D, simIO(D, { paramsFor: o.paramsFor ? safe(() => o.paramsFor(D)) : null }).io);
  const pick = { style: 'amp', title: (D.name || 'PEDAL').toUpperCase().slice(0, 18), items: list.filter((e) => e.kind === 'knob').slice(0, 4).map((e) => e.name), signals: ['in', 'out'] };
  if (!pick.items.length) pick.items = list.slice(0, 3).map((e) => e.name);

  const ov = el('div', { class: 'ss-overlay ss-gen-overlay' }, document.body);
  const win = el('div', { class: 'ss-win ss-gen', role: 'dialog', 'aria-label': 'Screen generator' }, ov);
  const hd = el('header', { class: 'ss-head' }, win);
  const ttl = el('div', { class: 'ss-ttl' }, hd);
  el('h2', {}, ttl).textContent = 'Screen generator';
  el('p', {}, ttl).textContent = 'Pick a look and what to show. You get code you can change in the editor.';
  const hb = el('div', { class: 'ss-hbtns' }, hd);
  const bCancel = el('button', { class: 'btn small' }, hb);
  bCancel.textContent = 'Cancel';
  const bUse = el('button', { class: 'btn small btn-accent', 'data-ss': 'use' }, hb);
  bUse.textContent = 'Use this style';

  const main = el('div', { class: 'ss-gmain' }, win);
  const opts = el('div', { class: 'ss-gopts' }, main);
  el('h5', {}, opts).textContent = 'Title';
  const ti = el('input', { type: 'text', class: 'ss-gtitle', maxlength: 24 }, opts);
  ti.value = pick.title;
  ti.oninput = () => {
    pick.title = ti.value;
    regen();
  };
  el('h5', {}, opts).textContent = 'Show these controls';
  const boxes = [];
  const box = (name, label, on, onChange) => {
    const r = el('label', { class: 'ss-gcheck' }, opts);
    const cb = el('input', { type: 'checkbox', 'data-item': name }, r);
    cb.checked = on;
    el('span', {}, r).textContent = label;
    cb.onchange = () => onChange(cb.checked);
    boxes.push(cb);
    return cb;
  };
  for (const e of list) {
    box(e.name, `${e.name} (${e.kind})`, pick.items.includes(e.name), (on) => {
      pick.items = on ? [...pick.items, e.name] : pick.items.filter((x) => x !== e.name);
      regen();
    });
  }
  if (!list.length) el('p', { class: 'fz-note' }, opts).textContent = 'This pedal has no controls yet.';
  el('h5', {}, opts).textContent = 'And these signals';
  for (const [k, label] of LEVELS) {
    box(k, label, pick.signals.includes(k), (on) => {
      pick.signals = on ? [...pick.signals, k] : pick.signals.filter((x) => x !== k);
      pick.items = on ? [...pick.items, k] : pick.items.filter((x) => x !== k);
      regen();
    });
  }
  el('p', { class: 'fz-note' }, opts).textContent = 'Signals come from the circuit. Previews use a demo guitar signal.';

  const grid = el('div', { class: 'ss-ggrid' }, main);
  const cards = [];
  const cw = 230;
  const sc = Math.min(cw / W, 150 / H);
  for (const s of STYLES) {
    const card = el('button', { class: 'ss-gcard', 'data-style': s.id }, grid);
    const fr = el('div', { class: 'ss-gframe' }, card);
    const cv = el('canvas', {}, fr);
    cv.style.width = Math.round(W * sc) + 'px';
    cv.style.height = Math.round(H * sc) + 'px';
    el('b', {}, card).textContent = s.name;
    el('span', {}, card).textContent = s.desc;
    card.onclick = () => {
      pick.style = s.id;
      cards.forEach((x) => x.card.classList.toggle('on', x.id === s.id));
    };
    cards.push({ id: s.id, card, cv, rt: null });
  }
  cards[0].card.classList.add('on');

  function regen() {
    for (const k of cards) {
      const code = generate(k.id, pick);
      k.code = code;
      k.rt = new ScreenRuntime({ src: code, w: W, h: H, host, canvas: k.cv, palette: paletteOf(c), screen: { type: c.type, name: c.label || '' } });
      k.rt.start(performance.now());
      k.card.classList.toggle('bad', !!k.rt.error);
      k.card.title = k.rt.error ? 'Error: ' + k.rt.error.message : '';
    }
  }
  regen();
  let raf = 0, last = 0;
  const loop = (now) => {
    raf = requestAnimationFrame(loop);
    if (now - last < 50) return;
    last = now;
    for (const k of cards) if (k.rt) k.rt.frame(now);
  };
  raf = requestAnimationFrame(loop);

  function close() {
    cancelAnimationFrame(raf);
    ov.remove();
    open = null;
  }
  bCancel.onclick = close;
  bUse.onclick = () => {
    const code = generate(pick.style, pick);
    close();
    if (o.onUse) o.onUse(code, pick.style);
  };
  ov.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close();
    }
  });
  open = {
    close,
    pick,
    use: (style) => {
      pick.style = style;
      bUse.click();
    },
    errors: () => cards.map((k) => ({ style: k.id, error: k.rt && k.rt.error, frames: k.rt ? k.rt.frameN : 0 })),
  };
  return open;
}
function safe(f) {
  try {
    return f();
  } catch (_) {
    return null;
  }
}
