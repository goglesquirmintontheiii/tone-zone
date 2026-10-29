// Small DOM / SVG helpers and an event bus.
export const SVGNS = 'http://www.w3.org/2000/svg';

export function svg(tag, attrs = {}, parent = null, text = null) {
  const e = document.createElementNS(SVGNS, tag);
  for (const k in attrs) if (attrs[k] !== undefined && attrs[k] !== null) e.setAttribute(k, attrs[k]);
  if (text !== null) e.textContent = text;
  if (parent) parent.appendChild(e);
  return e;
}

export function el(tag, attrs = {}, parent = null, html = null) {
  const e = document.createElement(tag);
  for (const k in attrs) {
    const v = attrs[k];
    if (v === undefined || v === null) continue;
    if (k === 'class') e.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v);
  }
  if (html !== null) e.innerHTML = html;
  if (parent) parent.appendChild(e);
  return e;
}

export const clamp = (x, a, b) => Math.min(Math.max(x, a), b);
export const lerp = (a, b, t) => a + (b - a) * t;
export const uid = (p = 'b') => p + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3);
export function debounce(fn, ms) {
  let t = null;
  return (...a) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
}
export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

// colour helpers
export function hexToRgb(h) {
  h = h.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function rgbToHex([r, g, b]) {
  return '#' + [r, g, b].map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
}
export function shade(hex, amt) {
  // amt from -1 (darker) to 1 (lighter)
  const [r, g, b] = hexToRgb(hex);
  if (amt >= 0) return rgbToHex([r + (255 - r) * amt, g + (255 - g) * amt, b + (255 - b) * amt]);
  return rgbToHex([r * (1 + amt), g * (1 + amt), b * (1 + amt)]);
}
export function luminance(hex) {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

class Bus {
  constructor() { this.m = new Map(); }
  on(ev, fn) { if (!this.m.has(ev)) this.m.set(ev, new Set()); this.m.get(ev).add(fn); return () => this.m.get(ev).delete(fn); }
  off(ev, fn) { const s = this.m.get(ev); if (s) s.delete(fn); }
  emit(ev, ...a) { const s = this.m.get(ev); if (s) for (const fn of [...s]) fn(...a); }
}
export const bus = new Bus();

let toastHost = null;
export function toast(msg, kind = 'info', ms = 3600) {
  toastHost = toastHost || document.getElementById('toasts');
  const t = el('div', { class: `toast ${kind}` }, toastHost);
  el('span', { class: 'dot' }, t);
  el('span', {}, t).textContent = msg;
  setTimeout(() => {
    t.classList.add('out');
    setTimeout(() => t.remove(), 320);
  }, ms);
}

export function fmt(v, unit = '', digits = 2) {
  if (typeof v !== 'number' || !isFinite(v)) return '-';
  const a = Math.abs(v);
  let s;
  if (unit === 'ms' && a >= 1000) return (v / 1000).toFixed(2) + ' s';
  if (unit === 'Hz' && a >= 1000) return (v / 1000).toFixed(2) + ' kHz';
  if (a >= 100) s = v.toFixed(0);
  else if (a >= 10) s = v.toFixed(1);
  else s = v.toFixed(digits);
  return unit ? `${s} ${unit}` : s;
}
