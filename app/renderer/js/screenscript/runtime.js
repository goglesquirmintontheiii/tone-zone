// A running screen: one script, one canvas, one host. Draws a frame on request and takes pointer and key input.
// Everything a script can call lives here (drawing, widgets, input, time, controls, circuit signals, storage).
import { VM, ScriptError } from './vm.js';
import { LTable, tostr, truthy } from './lang.js';
import { makeTable, toJS, toScript } from './stdlib.js';
import { PIXEL_FONT, PIXEL_W, PIXEL_H, PIXEL_ADV, SEG7, ICONS } from './font.js';

export const PALETTES = {
  oled: { bg: '#04070a', fg: '#7fe8ff', dim: '#1d4552', accent: '#ffffff', warn: '#ffc24b', good: '#3ddc84', bad: '#ff4d5e', panel: '#0b1820' },
  lcd: { bg: '#9fbf3a', fg: '#1d2a08', dim: '#7e9c2b', accent: '#0b1203', warn: '#4a3300', good: '#1d2a08', bad: '#6a1000', panel: '#8fae32' },
  amber: { bg: '#1c1403', fg: '#ffb020', dim: '#5c3d09', accent: '#ffe2a0', warn: '#ff7a2f', good: '#ffd060', bad: '#ff4a20', panel: '#2a1d05' },
  tft: { bg: '#0d1730', fg: '#ffffff', dim: '#34466e', accent: '#2b9bff', warn: '#ffc24b', good: '#3ddc84', bad: '#ff4d5e', panel: '#172548' },
  phosphor: { bg: '#020a04', fg: '#39ff6a', dim: '#0e4a1c', accent: '#c4ffd2', warn: '#d8ff39', good: '#39ff6a', bad: '#ff6a39', panel: '#05170a' },
  ice: { bg: '#06101c', fg: '#bfe6ff', dim: '#26465f', accent: '#5ad1ff', warn: '#ffd36b', good: '#6bffc4', bad: '#ff6b8a', panel: '#0c1c2e' },
  sunset: { bg: '#1a0b1e', fg: '#ffd6a0', dim: '#55284a', accent: '#ff5e7a', warn: '#ffb347', good: '#7affb0', bad: '#ff3b5c', panel: '#2a1230' },
  paper: { bg: '#e9e4d4', fg: '#222018', dim: '#b3ab92', accent: '#c9302c', warn: '#b06a00', good: '#2f7a3a', bad: '#c9302c', panel: '#dcd6c2' },
  neon: { bg: '#07040f', fg: '#f0e8ff', dim: '#382a5a', accent: '#ff2bd6', warn: '#ffe14b', good: '#2bffd5', bad: '#ff3b5c', panel: '#140c26' },
  mono: { bg: '#000000', fg: '#ffffff', dim: '#4a4a4a', accent: '#ffffff', warn: '#ffffff', good: '#ffffff', bad: '#ffffff', panel: '#141414' },
  amp: { bg: '#0b1a3a', fg: '#e8f0ff', dim: '#30507f', accent: '#ffcc33', warn: '#ff9b33', good: '#66e08a', bad: '#ff5a5a', panel: '#13275a' },
  pico: { bg: '#1d2b53', fg: '#fff1e8', dim: '#5f574f', accent: '#ff004d', warn: '#ffa300', good: '#00e436', bad: '#ff004d', panel: '#7e2553' },
};
export const SCREEN_PALETTE = { oled: 'oled', lcd: 'lcd', amber: 'amber', tft: 'tft' };
const NAMED = {
  black: '#000000', white: '#ffffff', red: '#ff3b30', green: '#3ddc84', blue: '#2b7bd6', cyan: '#37d6c2', yellow: '#ffd21f', orange: '#ff7a2f',
  amber: '#ffb020', pink: '#ff3d6e', purple: '#b45cff', magenta: '#ff2bd6', gray: '#8d99a8', grey: '#8d99a8', dark: '#1a1d24', silver: '#c9ccd1',
  lime: '#a6ff3d', teal: '#1f8a8a', navy: '#0d1730', brown: '#8a5a2b', none: 'rgba(0,0,0,0)', transparent: 'rgba(0,0,0,0)',
};
const FONTS = {
  mono: "'Share Tech Mono', monospace",
  sans: "600 {s}px Inter, sans-serif",
  condensed: "700 {s}px 'Barlow Condensed', sans-serif",
  bold: "700 {s}px Oswald, sans-serif",
};
export const FONT_NAMES = ['pixel', 'mono', 'sans', 'condensed', 'bold', 'digits'];
const SIZES = { tiny: 5, small: 7, normal: 10, medium: 10, big: 16, large: 16, huge: 28 };
const FRAME_STEPS = 150000, FRAME_MS = 10, SETUP_STEPS = 1500000, SETUP_MS = 80, EVENT_STEPS = 60000, EVENT_MS = 8;
const hex2 = (n) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, '0');
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const num = (v, d = 0) => (typeof v === 'number' && !Number.isNaN(v) ? v : typeof v === 'string' && v.trim() !== '' && !Number.isNaN(+v) ? +v : d);

export function parseRGB(c) {
  if (typeof c !== 'string') return [0, 0, 0, 1];
  let m = /^#([0-9a-f]{3,8})$/i.exec(c);
  if (m) {
    let h = m[1];
    if (h.length === 3 || h.length === 4) h = [...h].map((x) => x + x).join('');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), h.length >= 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1];
  }
  m = /^rgba?\(([^)]+)\)$/i.exec(c);
  if (m) {
    const p = m[1].split(',').map((x) => parseFloat(x));
    return [p[0] || 0, p[1] || 0, p[2] || 0, p[3] ?? 1];
  }
  return [0, 0, 0, 1];
}

// Path2D for each pixel glyph (one fill per character)
let glyphPaths = null;
function glyphPath(ch) {
  if (!glyphPaths) glyphPaths = new Map();
  let p = glyphPaths.get(ch);
  if (p) return p;
  const rows = PIXEL_FONT[ch] || PIXEL_FONT[ch.toUpperCase()] || PIXEL_FONT['?'];
  p = new Path2D();
  rows.forEach((bits, y) => {
    for (let x = 0; x < PIXEL_W; x++) if (bits & (1 << (PIXEL_W - 1 - x))) p.rect(x, y, 1, 1);
  });
  glyphPaths.set(ch, p);
  return p;
}
const iconPaths = new Map();
function iconPath(name) {
  let p = iconPaths.get(name);
  if (p) return p;
  const ic = ICONS[name];
  if (!ic) return null;
  p = { f: ic.f ? new Path2D(ic.f) : null, s: ic.s ? new Path2D(ic.s) : null };
  iconPaths.set(name, p);
  return p;
}

const KB_ROWS = ['1234567890', 'QWERTYUIOP', 'ASDFGHJKL-', 'ZXCVBNM.'];

export class ScreenRuntime {
  /**
   * o = { src, w, h (canvas pixels), host, canvas?, palette?, screen? ({type, name}), onError?, onLog?, interactive? }
   */
  constructor(o) {
    this.o = o;
    this.src = o.src || '';
    this.W = Math.max(8, Math.round(o.w));
    this.H = Math.max(8, Math.round(o.h));
    this.host = o.host;
    this.canvas = o.canvas || document.createElement('canvas');
    this.canvas.width = this.W;
    this.canvas.height = this.H;
    this.g = this.canvas.getContext('2d', o.readBack ? { willReadFrequently: true } : undefined);
    this.palName = o.palette || 'oled';
    this.pal = { ...(PALETTES[this.palName] || PALETTES.oled) };
    this.error = null;
    this.logs = [];
    this.t0 = 0;
    this.last = 0;
    this.dtv = 0;
    this.frameN = 0;
    this.started = false;
    this.in = { x: -1, y: -1, down: false, pressed: false, released: false, px: -1, py: -1, rx: -1, ry: -1, wheel: 0, moved: 0 };
    this.active = null; // widget being pressed
    this.focus = null; // text field with the keyboard
    this.wid = new Map();
    this.everyT = [];
    this.everyIdx = 0;
    this.hist = new Map();
    this.prevCtl = null;
    this.lastCtl = { name: '', value: 0, t: -1 };
    this.cur = { color: null, font: 'pixel', size: 7, lw: 1 };
    this.store = null;
    this.storeDirty = 0;
    this.kbShift = false;
    try {
      this.vm = new VM(this.src, { log: (m) => this.log(m) });
      this.install();
    } catch (e) {
      this.fail(e);
    }
  }

  // ---------------------------------------------------------------- lifecycle
  log(m) {
    this.logs.push(String(m));
    if (this.logs.length > 60) this.logs.shift();
    if (this.o.onLog) this.o.onLog(String(m));
    if (this.host && this.host.log) this.host.log(String(m));
  }
  fail(e) {
    const err = e instanceof ScriptError ? e : new ScriptError(String((e && e.message) || e), 0);
    this.error = { message: err.message, line: err.line || 0, kind: err.kind || 'runtime' };
    if (this.o.onError) this.o.onError(this.error);
    this.drawError();
  }
  start(now = performance.now()) {
    if (this.started || this.error) return;
    this.started = true;
    this.t0 = now;
    this.last = now;
    try {
      const s = this.host && this.host.store && this.host.store();
      this.store = s && typeof s === 'object' ? { ...s } : {};
    } catch (_) {
      this.store = {};
    }
    try {
      this.resetDraw();
      this.g.fillStyle = this.pal.bg;
      this.g.fillRect(0, 0, this.W, this.H);
      if (this.host) this.host.beginFrame(now);
      this.vm.start(SETUP_STEPS, SETUP_MS);
      if (this.vm.has('setup')) this.vm.call('setup', [], SETUP_STEPS, SETUP_MS);
    } catch (e) {
      this.fail(e);
    }
  }
  resetDraw() {
    const g = this.g;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = 1;
    g.shadowBlur = 0;
    g.imageSmoothingEnabled = true;
    g.lineCap = 'round';
    g.lineJoin = 'round';
  }
  /** Draw one frame. */
  frame(now = performance.now()) {
    if (!this.started) this.start(now);
    if (this.error) return false;
    const dt = this.frameN ? clamp((now - this.last) / 1000, 0, 0.25) : 0;
    this.last = now;
    this.dtv = dt;
    this.now = now;
    try {
      if (this.host) this.host.beginFrame(now);
      this.controlEvents(now);
      this.syncMouse();
      this.everyIdx = 0;
      this.resetDraw();
      this.g.save();
      if (this.vm.has('update')) this.vm.call('update', [dt], FRAME_STEPS, FRAME_MS);
      if (this.vm.has('draw')) this.vm.call('draw', [dt], FRAME_STEPS, FRAME_MS);
      this.g.restore();
      this.resetDraw();
      if (this.focus) this.drawKeyboard();
      this.endInput();
      this.flushStore(now);
      this.frameN++;
    } catch (e) {
      try { this.g.restore(); } catch (_) { /* nothing saved */ }
      this.fail(e);
      return false;
    }
    return true;
  }
  endInput() {
    const I = this.in;
    if (I.released && !I.down) this.active = null;
    I.pressed = false;
    I.released = false;
    I.wheel = 0;
  }
  syncMouse() {
    const m = this.mouseT;
    if (!m) return;
    const I = this.in;
    m.set('x', I.x);
    m.set('y', I.y);
    m.set('down', I.down);
    m.set('pressed', I.pressed);
    m.set('released', I.released);
    m.set('wheel', I.wheel);
  }
  controlEvents(now) {
    if (!this.host) return;
    const snap = this.host.snapshot();
    const prev = this.prevCtl;
    this.prevCtl = new Map(snap.map(([e, v]) => [e.id, v]));
    if (!prev) return;
    for (const [e, v] of snap) {
      const was = prev.get(e.id);
      if (was === undefined || was === v) continue;
      this.lastCtl = { name: e.name, value: v, t: now };
      this.callEvent('onControl', [e.name, v]);
      if (e.kind === 'foot') this.callEvent('onFoot', [e.name, v]);
      if (this.error) return;
    }
  }
  callEvent(name, args) {
    if (this.error || !this.vm || !this.vm.has(name)) return;
    try {
      this.vm.call(name, args, EVENT_STEPS, EVENT_MS);
    } catch (e) {
      this.fail(e);
    }
  }
  flushStore(now) {
    if (!this.storeDirty || now - this.storeDirty < 800) return;
    this.storeDirty = 0;
    try {
      if (this.host && this.host.saveStore) this.host.saveStore(this.store);
    } catch (_) {
      /* storing is optional */
    }
  }
  /** Pointer input in canvas pixels: type = down | move | up | wheel. */
  pointer(type, x, y, extra = {}) {
    if (this.error) return;
    const I = this.in;
    I.x = x;
    I.y = y;
    if (this.focus && type === 'down') {
      this.keyboardTap(x, y);
      return;
    }
    if (this.focus && (type === 'move' || type === 'up')) return;
    if (type === 'down') {
      I.down = true;
      I.pressed = true;
      I.px = x;
      I.py = y;
      I.moved = 0;
      this.callEvent('onPress', [x, y]);
    } else if (type === 'move') {
      if (I.down) I.moved += 1;
      this.callEvent('onMove', [x, y]);
    } else if (type === 'up') {
      I.down = false;
      I.released = true;
      I.rx = x;
      I.ry = y;
      this.callEvent('onRelease', [x, y]);
    } else if (type === 'wheel') {
      const d = extra.dy > 0 ? -1 : 1;
      I.wheel += d;
      this.callEvent('onWheel', [d, x, y]);
    }
  }
  /** A key from the keyboard; true when the screen used it. */
  key(e) {
    if (this.error) return false;
    const k = e.key;
    if (this.focus) {
      const w = this.wid.get(this.focus);
      if (!w) return false;
      if (k === 'Enter' || k === 'Escape') this.blur(k === 'Enter');
      else if (k === 'Backspace') w.text = w.text.slice(0, -1);
      else if (k.length === 1 && w.text.length < (w.max || 64)) w.text += k;
      else return true;
      return true;
    }
    if (this.vm && this.vm.has('onKey')) {
      this.callEvent('onKey', [k]);
      return true;
    }
    return false;
  }
  wantsKeys() {
    return !this.error && (!!this.focus || (this.vm && this.vm.has('onKey')));
  }
  blur(commit = true) {
    const w = this.wid.get(this.focus);
    if (w) {
      if (!commit) w.text = w.orig;
      w.done = true;
    }
    this.focus = null;
  }
  drawError() {
    const g = this.g;
    if (!g || !this.error) return;
    try {
      this.resetDraw();
      g.fillStyle = '#2a0608';
      g.fillRect(0, 0, this.W, this.H);
      g.fillStyle = '#ff4d5e';
      g.fillRect(0, 0, this.W, 9);
      this.pixelText(this.error.line ? `ERROR LINE ${this.error.line}` : 'SCRIPT ERROR', 2, 1, '#2a0608', 1);
      const words = this.error.message.split(/\s+/);
      const per = Math.max(4, Math.floor((this.W - 4) / PIXEL_ADV));
      const lines = [];
      let ln = '';
      for (const w of words) {
        if ((ln + ' ' + w).trim().length > per) {
          lines.push(ln.trim());
          ln = w;
        } else ln += ' ' + w;
      }
      if (ln.trim()) lines.push(ln.trim());
      lines.slice(0, Math.floor((this.H - 12) / 9)).forEach((l, i) => this.pixelText(l, 2, 12 + i * 9, '#ffb3bb', 1));
    } catch (_) {
      /* nothing more to show */
    }
  }

  // ---------------------------------------------------------------- drawing helpers (JS side)
  col(c, fb) {
    if (c === undefined || c === null) return fb !== undefined ? fb : this.cur.color || this.pal.fg;
    if (typeof c === 'number') return '#' + (Math.max(0, Math.floor(c)) & 0xffffff).toString(16).padStart(6, '0');
    if (typeof c === 'string') {
      if (this.pal[c] !== undefined) return this.pal[c];
      const n = NAMED[c.toLowerCase()];
      if (n) return n;
      if (/^#[0-9a-f]{3,8}$/i.test(c) || /^(rgb|hsl)a?\(/i.test(c)) return c;
    }
    return fb !== undefined ? fb : this.pal.fg;
  }
  pixelText(s, x, y, color, scale) {
    const g = this.g;
    g.save();
    g.fillStyle = color;
    g.translate(Math.round(x), Math.round(y));
    if (scale !== 1) g.scale(scale, scale);
    for (const ch of s) {
      if (ch !== ' ') g.fill(glyphPath(ch));
      g.translate(PIXEL_ADV, 0);
    }
    g.restore();
  }
  fontOf(name, size) {
    const f = FONTS[name] || FONTS.mono;
    return f.includes('{s}') ? f.replace('{s}', size) : `${size}px ${f}`;
  }
  sizeOf(size, font) {
    if (typeof size === 'string') return SIZES[size.toLowerCase()] || (font === 'pixel' ? 7 : 10);
    if (typeof size === 'number' && size > 0) return size;
    return this.cur.font === font ? this.cur.size : font === 'pixel' ? 7 : 10;
  }
  measure(s, size, font) {
    s = tostr(s);
    if (font === 'pixel') {
      const k = Math.max(1, Math.round(size / 7));
      return s.length ? (s.length * PIXEL_ADV - 1) * k : 0;
    }
    if (font === 'digits') return s.length * size * 0.62;
    this.g.font = this.fontOf(font, size);
    return this.g.measureText(s).width;
  }
  drawText(s, x, y, c, size, align, font) {
    s = tostr(s);
    font = FONT_NAMES.includes(font) ? font : this.cur.font;
    size = this.sizeOf(size, font);
    const color = this.col(c);
    const w = this.measure(s, size, font);
    const a = typeof align === 'string' ? align.toLowerCase() : 'left';
    const h = font === 'pixel' ? Math.max(1, Math.round(size / 7)) * PIXEL_H : size;
    if (a === 'center' || a === 'centre' || a === 'middle') x -= w / 2;
    else if (a === 'right') x -= w;
    if (a === 'middle') y -= h / 2;
    if (font === 'pixel') this.pixelText(s, x, y, color, Math.max(1, Math.round(size / 7)));
    else if (font === 'digits') this.seg7(s, x, y, size, color, null);
    else {
      const g = this.g;
      g.font = this.fontOf(font, size);
      g.textBaseline = 'top';
      g.textAlign = 'left';
      g.fillStyle = color;
      g.fillText(s, x, y - size * 0.08);
    }
    return w;
  }
  seg7(s, x, y, size, color, ghost) {
    const g = this.g;
    const cw = size * 0.5, gap = size * 0.12, t = Math.max(1, size * 0.11);
    const hh = size / 2;
    const seg = {
      a: [0, 0, cw, 0], b: [cw, 0, cw, hh], c: [cw, hh, cw, size], d: [0, size, cw, size], e: [0, hh, 0, size], f: [0, 0, 0, hh], g: [0, hh, cw, hh],
    };
    g.save();
    g.lineCap = 'round';
    g.lineWidth = t;
    let cx = x + t / 2;
    for (const ch of s) {
      if (ch === '.' || ch === ':') {
        g.fillStyle = color;
        if (ch === '.') g.fillRect(cx - gap * 0.6, y + size - t / 2, t, t);
        else {
          g.fillRect(cx - gap * 0.6, y + size * 0.28, t, t);
          g.fillRect(cx - gap * 0.6, y + size * 0.68, t, t);
        }
        cx += t + gap;
        continue;
      }
      const on = SEG7[ch] ?? SEG7[ch.toUpperCase()] ?? '';
      for (const k of 'abcdefg') {
        const lit = on.includes(k);
        if (!lit && !ghost) continue;
        g.strokeStyle = lit ? color : ghost;
        const [x1, y1, x2, y2] = seg[k];
        const ins = t * 0.9;
        const dx = x2 === x1 ? 0 : ins, dy = y2 === y1 ? 0 : ins;
        g.beginPath();
        g.moveTo(cx + x1 + dx, y + y1 + dy);
        g.lineTo(cx + x2 - dx, y + y2 - dy);
        g.stroke();
      }
      cx += cw + gap + t;
    }
    g.restore();
    return cx - x;
  }
  path(fn, c, fill, lw) {
    const g = this.g;
    g.beginPath();
    fn(g);
    if (fill) {
      g.fillStyle = this.col(c);
      g.fill();
    } else {
      g.strokeStyle = this.col(c);
      g.lineWidth = lw ?? this.cur.lw;
      g.stroke();
    }
  }
  rr(g, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }
  points(t) {
    const out = [];
    if (!(t instanceof LTable)) return out;
    const a = t.a;
    if (a.length && a[0] instanceof LTable) for (const p of a) out.push([num(p.get(1) ?? p.get('x')), num(p.get(2) ?? p.get('y'))]);
    else for (let i = 0; i + 1 < a.length; i += 2) out.push([num(a[i]), num(a[i + 1])]);
    return out;
  }
  hit(x, y, w, h, px, py) {
    return px >= x && py >= y && px < x + w && py < y + h;
  }
  uiFont(h) {
    return h >= 18 ? ['sans', Math.min(14, Math.round(h * 0.5))] : ['pixel', 7];
  }
  label(s, x, y, w, h, c) {
    const [f, sz] = this.uiFont(h);
    const g = this.g;
    g.save();
    g.beginPath();
    g.rect(x, y, w, h);
    g.clip();
    this.drawText(s, x + w / 2, y + h / 2 + (f === 'pixel' ? 0.5 : 0), c, sz, 'middle', f);
    g.restore();
  }

  // ---------------------------------------------------------------- the on-screen keyboard
  kbLayout() {
    const top = Math.min(16, Math.round(this.H * 0.22));
    const rows = KB_ROWS.length + 1;
    const kh = (this.H - top - 1) / rows;
    const keys = [];
    KB_ROWS.forEach((r, ri) => {
      const kw = this.W / 10;
      const x0 = (this.W - kw * r.length) / 2;
      [...r].forEach((ch, i) => keys.push({ k: ch, x: x0 + i * kw, y: top + ri * kh, w: kw, h: kh }));
    });
    const y = top + KB_ROWS.length * kh, u = this.W / 10;
    keys.push({ k: 'SHIFT', label: 'Aa', x: 0, y, w: u * 2, h: kh });
    keys.push({ k: ' ', label: 'SPACE', x: u * 2, y, w: u * 4, h: kh });
    keys.push({ k: 'BACK', label: 'DEL', x: u * 6, y, w: u * 2, h: kh });
    keys.push({ k: 'OK', label: 'OK', x: u * 8, y, w: u * 2, h: kh });
    return { top, keys };
  }
  drawKeyboard() {
    const w = this.wid.get(this.focus);
    if (!w) return;
    const g = this.g, P = this.pal;
    const { top, keys } = this.kbLayout();
    g.fillStyle = P.bg;
    g.fillRect(0, 0, this.W, this.H);
    g.fillStyle = P.panel || P.dim;
    g.fillRect(0, 0, this.W, top - 1);
    const caret = Math.floor(this.now / 450) % 2 ? '_' : ' ';
    const shown = (w.text + caret).slice(-Math.floor((this.W - 4) / PIXEL_ADV));
    this.pixelText(shown, 2, Math.max(1, (top - 8) / 2), P.fg, 1);
    for (const k of keys) {
      g.beginPath();
      this.rr(g, k.x + 0.5, k.y + 0.5, k.w - 1, k.h - 1, 1.5);
      g.fillStyle = k.k === 'OK' ? P.accent : P.panel || P.dim;
      g.fill();
      const lab = k.label || (this.kbShift ? k.k : k.k.toLowerCase());
      this.drawText(lab, k.x + k.w / 2, k.y + k.h / 2 + 0.5, k.k === 'OK' ? P.bg : P.fg, 7, 'middle', 'pixel');
    }
  }
  keyboardTap(x, y) {
    const w = this.wid.get(this.focus);
    if (!w) return;
    const { top, keys } = this.kbLayout();
    if (y < top) return;
    const k = keys.find((q) => this.hit(q.x, q.y, q.w, q.h, x, y));
    if (!k) return;
    if (k.k === 'OK') this.blur(true);
    else if (k.k === 'BACK') w.text = w.text.slice(0, -1);
    else if (k.k === 'SHIFT') this.kbShift = !this.kbShift;
    else if (w.text.length < (w.max || 64)) w.text += this.kbShift ? k.k : k.k.toLowerCase();
  }

  // ---------------------------------------------------------------- the script API
  install() {
    const vm = this.vm, R = vm.R;
    const def = (name, fn, cost = 1) => vm.set(name, cost ? (...a) => { R.steps -= cost; return fn(...a); } : fn);
    const self = this;
    const g = () => this.g;

    vm.set('W', this.W);
    vm.set('H', this.H);
    const scr = makeTable({ w: this.W, h: this.H, type: this.o.screen?.type || 'oled', name: this.o.screen?.name || '' });
    vm.set('screen', scr);
    this.colorsT = new LTable();
    const syncColors = () => {
      for (const k in this.pal) this.colorsT.set(k, this.pal[k]);
    };
    syncColors();
    vm.set('colors', this.colorsT);
    this.mouseT = makeTable({ x: -1, y: -1, down: false, pressed: false, released: false, wheel: 0 });
    vm.set('mouse', this.mouseT);

    // ---- colours and style
    def('color', (c) => { this.cur.color = c === undefined ? null : this.col(c); return this.cur.color || this.pal.fg; });
    def('rgb', (r, gg, b, a) => (a === undefined ? '#' + hex2(num(r)) + hex2(num(gg)) + hex2(num(b)) : `rgba(${Math.round(num(r))},${Math.round(num(gg))},${Math.round(num(b))},${clamp(num(a, 1), 0, 1)})`));
    def('hsv', (h, s = 1, v = 1) => {
      h = ((num(h) % 360) + 360) % 360;
      s = clamp(num(s, 1), 0, 1);
      v = clamp(num(v, 1), 0, 1);
      const f = (n) => {
        const k = (n + h / 60) % 6;
        return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
      };
      return '#' + hex2(f(5) * 255) + hex2(f(3) * 255) + hex2(f(1) * 255);
    });
    def('mix', (a, b, t = 0.5) => {
      const A = parseRGB(this.col(a)), B = parseRGB(this.col(b));
      t = clamp(num(t, 0.5), 0, 1);
      return '#' + hex2(A[0] + (B[0] - A[0]) * t) + hex2(A[1] + (B[1] - A[1]) * t) + hex2(A[2] + (B[2] - A[2]) * t);
    });
    def('fade', (c, a = 0.5) => {
      const A = parseRGB(this.col(c));
      return `rgba(${A[0]},${A[1]},${A[2]},${clamp(num(a, 0.5), 0, 1) * A[3]})`;
    });
    def('palette', (name) => makeTable(PALETTES[tostr(name)] || this.pal));
    def('theme', (name) => {
      if (name instanceof LTable) {
        for (const k of name.keys()) if (typeof k === 'string') this.pal[k] = this.col(name.get(k), this.pal[k]);
      } else if (PALETTES[tostr(name)]) {
        this.palName = tostr(name);
        this.pal = { ...PALETTES[this.palName] };
      }
      syncColors();
      return this.colorsT;
    });
    def('palettes', () => makeTable(Object.keys(PALETTES)));
    def('alpha', (a = 1) => { g().globalAlpha = clamp(num(a, 1), 0, 1); });
    def('lineWidth', (w = 1) => { this.cur.lw = Math.max(0.25, num(w, 1)); });
    def('glow', (r = 0, c) => {
      g().shadowBlur = Math.max(0, num(r));
      g().shadowColor = this.col(c, this.cur.color || this.pal.fg);
    });
    def('smooth', (on = true) => { g().imageSmoothingEnabled = truthy(on); });
    def('clip', (x, y, w, h) => {
      g().save();
      g().beginPath();
      g().rect(num(x), num(y), num(w), num(h));
      g().clip();
    });
    def('unclip', () => { try { g().restore(); } catch (_) { /* nothing to restore */ } });
    def('push', () => g().save());
    def('pop', () => g().restore());
    def('translate', (x, y) => g().translate(num(x), num(y)));
    def('rotate', (deg) => g().rotate((num(deg) * Math.PI) / 180));
    def('scale', (x, y) => g().scale(num(x, 1), num(y ?? x, 1)));

    // ---- shapes
    def('clear', (c) => {
      const gg = g();
      gg.save();
      gg.setTransform(1, 0, 0, 1, 0, 0);
      gg.globalAlpha = 1;
      gg.shadowBlur = 0;
      gg.fillStyle = this.col(c, this.pal.bg);
      gg.fillRect(0, 0, this.W, this.H);
      gg.restore();
    }, 4);
    def('pixel', (x, y, c) => {
      g().fillStyle = this.col(c);
      g().fillRect(Math.floor(num(x)), Math.floor(num(y)), 1, 1);
    });
    def('line', (x1, y1, x2, y2, c, w) => {
      const lw = w === undefined ? this.cur.lw : num(w, 1);
      const o = lw % 2 === 1 ? 0.5 : 0;
      this.path((gg) => { gg.moveTo(num(x1) + o, num(y1) + o); gg.lineTo(num(x2) + o, num(y2) + o); }, c, false, lw);
    }, 2);
    def('rect', (x, y, w, h, c, lw) => {
      const l = lw === undefined ? this.cur.lw : num(lw, 1);
      const o = l / 2;
      g().strokeStyle = this.col(c);
      g().lineWidth = l;
      g().strokeRect(num(x) + o, num(y) + o, Math.max(0, num(w) - l), Math.max(0, num(h) - l));
    }, 2);
    def('fillRect', (x, y, w, h, c) => {
      g().fillStyle = this.col(c);
      g().fillRect(num(x), num(y), num(w), num(h));
    }, 2);
    def('roundRect', (x, y, w, h, r, c, lw) => {
      const l = lw === undefined ? this.cur.lw : num(lw, 1);
      this.path((gg) => this.rr(gg, num(x) + l / 2, num(y) + l / 2, num(w) - l, num(h) - l, num(r, 2)), c, false, l);
    }, 3);
    def('fillRoundRect', (x, y, w, h, r, c) => this.path((gg) => this.rr(gg, num(x), num(y), num(w), num(h), num(r, 2)), c, true), 3);
    def('circle', (x, y, r, c, lw) => this.path((gg) => gg.arc(num(x), num(y), Math.max(0, num(r)), 0, Math.PI * 2), c, false, lw === undefined ? undefined : num(lw, 1)), 3);
    def('fillCircle', (x, y, r, c) => this.path((gg) => gg.arc(num(x), num(y), Math.max(0, num(r)), 0, Math.PI * 2), c, true), 3);
    const rad = (d) => ((num(d) - 90) * Math.PI) / 180;
    def('arc', (x, y, r, a0, a1, c, lw) => this.path((gg) => gg.arc(num(x), num(y), Math.max(0, num(r)), rad(a0), rad(a1), num(a1) < num(a0)), c, false, lw === undefined ? undefined : num(lw, 1)), 3);
    def('pie', (x, y, r, a0, a1, c) => this.path((gg) => { gg.moveTo(num(x), num(y)); gg.arc(num(x), num(y), Math.max(0, num(r)), rad(a0), rad(a1), num(a1) < num(a0)); gg.closePath(); }, c, true), 3);
    def('polygon', (pts, c, filled = true) => {
      const P = this.points(pts);
      if (P.length < 2) return;
      this.path((gg) => { gg.moveTo(P[0][0], P[0][1]); for (let i = 1; i < P.length; i++) gg.lineTo(P[i][0], P[i][1]); if (truthy(filled)) gg.closePath(); }, c, truthy(filled));
    }, 4);
    def('polyline', (pts, c, lw) => {
      const P = this.points(pts);
      if (P.length < 2) return;
      this.path((gg) => { gg.moveTo(P[0][0], P[0][1]); for (let i = 1; i < P.length; i++) gg.lineTo(P[i][0], P[i][1]); }, c, false, lw === undefined ? undefined : num(lw, 1));
    }, 4);
    def('gradient', (x, y, w, h, c1, c2, vertical = true) => {
      const gg = g();
      const gr = truthy(vertical) ? gg.createLinearGradient(0, num(y), 0, num(y) + num(h)) : gg.createLinearGradient(num(x), 0, num(x) + num(w), 0);
      gr.addColorStop(0, this.col(c1));
      gr.addColorStop(1, this.col(c2, this.pal.bg));
      gg.fillStyle = gr;
      gg.fillRect(num(x), num(y), num(w), num(h));
    }, 4);
    def('scanlines', (a = 0.25, step = 2) => {
      const gg = g();
      gg.save();
      gg.globalAlpha = clamp(num(a, 0.25), 0, 1);
      gg.fillStyle = '#000';
      const s = Math.max(2, Math.round(num(step, 2)));
      for (let y = 0; y < this.H; y += s) gg.fillRect(0, y, this.W, 1);
      gg.restore();
    }, 6);
    def('sprite', (rows, x, y, k = 1, cols) => {
      if (!(rows instanceof LTable)) return;
      const gg = g();
      const s = Math.max(1, num(k, 1));
      const cmap = {};
      if (cols instanceof LTable) for (const key of cols.keys()) cmap[tostr(key)] = this.col(cols.get(key));
      const x0 = num(x), y0 = num(y);
      rows.a.forEach((row, ri) => {
        const str = tostr(row);
        for (let i = 0; i < str.length; i++) {
          const ch = str[i];
          if (ch === '.' || ch === ' ') continue;
          gg.fillStyle = cmap[ch] || this.col(cmap['#'] ? undefined : null);
          gg.fillRect(x0 + i * s, y0 + ri * s, s, s);
        }
      });
      R.steps -= rows.a.length * 2;
    }, 2);
    def('icon', (name, x, y, size = 12, c) => {
      const p = iconPath(tostr(name));
      if (!p) return false;
      const gg = g();
      const s = num(size, 12) / 24;
      gg.save();
      gg.translate(num(x), num(y));
      gg.scale(s, s);
      const col = this.col(c);
      if (p.f) { gg.fillStyle = col; gg.fill(p.f); }
      if (p.s) { gg.strokeStyle = col; gg.lineWidth = Math.max(2, 1.4 / s); gg.lineCap = 'round'; gg.lineJoin = 'round'; gg.stroke(p.s); }
      gg.restore();
      return true;
    }, 3);
    def('icons', () => makeTable(Object.keys(ICONS)));

    // ---- text
    def('font', (name, size) => {
      if (name !== undefined && FONT_NAMES.includes(tostr(name))) this.cur.font = tostr(name);
      if (size !== undefined) this.cur.size = this.sizeOf(size, this.cur.font);
      else this.cur.size = this.cur.font === 'pixel' ? 7 : 10;
    });
    def('text', (s, x, y, c, size, align, font) => this.drawText(s, num(x), num(y), c, size, align, font), 3);
    def('textWidth', (s, size, font) => {
      font = FONT_NAMES.includes(font) ? font : this.cur.font;
      return this.measure(s, this.sizeOf(size, font), font);
    });
    def('digits', (s, x, y, size = 16, c, ghost) => this.seg7(tostr(s), num(x), num(y), num(size, 16), this.col(c), ghost === undefined ? null : this.col(ghost)), 4);

    // ---- meters and graphs
    const v01 = (v) => clamp(num(v), 0, 1);
    def('bar', (x, y, w, h, v, c, bg) => {
      x = num(x); y = num(y); w = num(w); h = num(h); v = v01(v);
      const gg = g();
      gg.fillStyle = this.col(bg, this.pal.dim);
      gg.fillRect(x, y, w, h);
      gg.fillStyle = this.col(c, this.pal.accent);
      if (h > w) gg.fillRect(x, y + h * (1 - v), w, h * v);
      else gg.fillRect(x, y, w * v, h);
    }, 3);
    def('meter', (x, y, w, h, v, segs) => {
      x = num(x); y = num(y); w = num(w); h = num(h); v = v01(v);
      const vert = h > w;
      const n = Math.max(2, Math.round(num(segs, vert ? h / 4 : w / 4)));
      const gg = g();
      const lit = Math.round(v * n);
      for (let i = 0; i < n; i++) {
        const f = i / (n - 1);
        const c = f > 0.86 ? this.pal.bad : f > 0.66 ? this.pal.warn : this.pal.good;
        gg.fillStyle = i < lit ? c : this.pal.dim;
        if (vert) {
          const sh = h / n;
          gg.fillRect(x, y + h - (i + 1) * sh + 0.5, w, Math.max(1, sh - 1));
        } else {
          const sw = w / n;
          gg.fillRect(x + i * sw + 0.5, y, Math.max(1, sw - 1), h);
        }
      }
      R.steps -= n;
    }, 3);
    def('graph', (x, y, w, h, vals, c, lo, hi, fill) => {
      if (!(vals instanceof LTable)) return;
      const a = vals.a;
      if (a.length < 2) return;
      x = num(x); y = num(y); w = num(w); h = num(h);
      let mn = lo === undefined ? Infinity : num(lo), mx = hi === undefined ? -Infinity : num(hi);
      if (lo === undefined || hi === undefined) for (const v of a) { const n = num(v); if (lo === undefined) mn = Math.min(mn, n); if (hi === undefined) mx = Math.max(mx, n); }
      if (mx - mn < 1e-9) { mx = mn + 1; }
      const gg = g();
      gg.beginPath();
      a.forEach((v, i) => {
        const px = x + (w * i) / (a.length - 1), py = y + h - ((clamp(num(v), mn, mx) - mn) / (mx - mn)) * h;
        if (i) gg.lineTo(px, py);
        else gg.moveTo(px, py);
      });
      const col = this.col(c, this.pal.fg);
      gg.strokeStyle = col;
      gg.lineWidth = this.cur.lw;
      gg.stroke();
      if (truthy(fill)) {
        gg.lineTo(x + w, y + h);
        gg.lineTo(x, y + h);
        gg.closePath();
        gg.globalAlpha *= 0.3;
        gg.fillStyle = col;
        gg.fill();
        gg.globalAlpha /= 0.3;
      }
      R.steps -= a.length;
    }, 4);
    def('history', (name, v, n) => {
      const key = tostr(name);
      let t = this.hist.get(key);
      if (!t) { t = new LTable(); this.hist.set(key, t); }
      if (v !== undefined) {
        t.a.push(num(v));
        const max = Math.max(2, Math.round(num(n, this.W)));
        while (t.a.length > max) t.a.shift();
      }
      return t;
    }, 2);
    def('ring', (x, y, r, v, c, w, bg) => {
      x = num(x); y = num(y); r = num(r); v = v01(v);
      const lw = num(w, Math.max(2, r * 0.22));
      const gg = g();
      gg.lineCap = 'round';
      gg.lineWidth = lw;
      gg.beginPath();
      gg.arc(x, y, r, rad(-135), rad(135));
      gg.strokeStyle = this.col(bg, this.pal.dim);
      gg.stroke();
      if (v > 0.001) {
        gg.beginPath();
        gg.arc(x, y, r, rad(-135), rad(-135 + 270 * v));
        gg.strokeStyle = this.col(c, this.pal.accent);
        gg.stroke();
      }
    }, 4);
    def('gauge', (x, y, r, v, c, a0 = -60, a1 = 60) => {
      x = num(x); y = num(y); r = num(r); v = v01(v);
      const gg = g();
      const A0 = num(a0, -60), A1 = num(a1, 60);
      gg.lineWidth = 1;
      gg.strokeStyle = this.pal.dim;
      for (let i = 0; i <= 10; i++) {
        const a = rad(A0 + ((A1 - A0) * i) / 10);
        const r0 = r * (i % 5 ? 0.86 : 0.78);
        gg.beginPath();
        gg.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0);
        gg.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
        gg.stroke();
      }
      const a = rad(A0 + (A1 - A0) * v);
      gg.strokeStyle = this.col(c, this.pal.accent);
      gg.lineWidth = Math.max(1, r * 0.04);
      gg.beginPath();
      gg.moveTo(x, y);
      gg.lineTo(x + Math.cos(a) * r * 0.95, y + Math.sin(a) * r * 0.95);
      gg.stroke();
      gg.fillStyle = this.col(c, this.pal.accent);
      gg.beginPath();
      gg.arc(x, y, Math.max(1.5, r * 0.07), 0, Math.PI * 2);
      gg.fill();
    }, 12);

    // ---- widgets (call them from draw(); they return what the user did)
    const W = (id) => {
      let w = this.wid.get(id);
      if (!w) { w = {}; this.wid.set(id, w); }
      return w;
    };
    const I = this.in;
    const press = (id, x, y, w, h) => {
      if (I.pressed && !this.focus && this.hit(x, y, w, h, I.px, I.py)) this.active = id;
      return this.active === id;
    };
    const P = () => this.pal;
    def('button', (label, x, y, w, h, c) => {
      x = num(x); y = num(y); w = num(w, 40); h = num(h, 12);
      const id = 'b:' + tostr(label) + '@' + x + ',' + y;
      const act = press(id, x, y, w, h);
      const held = act && I.down && this.hit(x, y, w, h, I.x, I.y);
      let clicked = false;
      if (act && I.released) clicked = this.hit(x, y, w, h, I.rx, I.ry);
      const gg = g();
      const ac = this.col(c, P().accent);
      gg.beginPath();
      this.rr(gg, x + 0.5, y + 0.5, w - 1, h - 1, Math.min(3, h / 3));
      gg.fillStyle = held ? ac : P().panel;
      gg.fill();
      gg.strokeStyle = ac;
      gg.lineWidth = 1;
      gg.stroke();
      this.label(tostr(label), x, y, w, h, held ? P().bg : P().fg);
      return clicked;
    }, 6);
    def('toggle', (label, x, y, w, h, on) => {
      x = num(x); y = num(y); w = num(w, 50); h = num(h, 12);
      const id = 't:' + tostr(label) + '@' + x + ',' + y;
      const act = press(id, x, y, w, h);
      let v = truthy(on);
      if (act && I.released && this.hit(x, y, w, h, I.rx, I.ry)) v = !v;
      const gg = g();
      const sw = Math.min(w * 0.45, h * 1.8), sh = h - 2;
      const sx = x + w - sw - 1, sy = y + 1;
      gg.beginPath();
      this.rr(gg, sx, sy, sw, sh, sh / 2);
      gg.fillStyle = v ? P().accent : P().dim;
      gg.fill();
      gg.beginPath();
      const kr = sh / 2 - 1.5;
      gg.arc(v ? sx + sw - sh / 2 : sx + sh / 2, sy + sh / 2, Math.max(1, kr), 0, Math.PI * 2);
      gg.fillStyle = v ? P().bg : P().fg;
      gg.fill();
      const [f, sz] = this.uiFont(h);
      gg.save();
      gg.beginPath();
      gg.rect(x, y, Math.max(0, sx - x - 2), h);
      gg.clip();
      this.drawText(tostr(label), x + 1, y + h / 2 + 0.5, P().fg, sz, 'left', f);
      gg.restore();
      return v;
    }, 6);
    def('slider', (label, x, y, w, h, v, lo = 0, hi = 1) => {
      x = num(x); y = num(y); w = num(w, 60); h = num(h, 10);
      lo = num(lo, 0); hi = num(hi, 1);
      const id = 's:' + tostr(label) + '@' + x + ',' + y;
      const vert = h > w * 1.5;
      let t = clamp((num(v, lo) - lo) / ((hi - lo) || 1), 0, 1);
      const act = press(id, x, y, w, h);
      if (act && I.down) t = vert ? clamp(1 - (I.y - y) / h, 0, 1) : clamp((I.x - x) / w, 0, 1);
      if (I.wheel && this.hit(x, y, w, h, I.x, I.y)) t = clamp(t + I.wheel * 0.05, 0, 1);
      const gg = g();
      gg.beginPath();
      this.rr(gg, x + 0.5, y + 0.5, w - 1, h - 1, 2);
      gg.fillStyle = P().panel;
      gg.fill();
      gg.strokeStyle = P().dim;
      gg.lineWidth = 1;
      gg.stroke();
      gg.fillStyle = P().accent;
      if (vert) gg.fillRect(x + 2, y + 2 + (h - 4) * (1 - t), w - 4, (h - 4) * t);
      else gg.fillRect(x + 2, y + 2, (w - 4) * t, h - 4);
      if (!vert && label !== undefined && tostr(label) !== '') {
        const [f, sz] = this.uiFont(h);
        this.drawText(tostr(label), x + 4, y + h / 2 + 0.5, t > 0.3 ? P().bg : P().fg, sz, 'left', f);
        const ty = y + h / 2 + 0.5;
        if (f === 'pixel') this.pixelText(String(Math.round(t * 100)), x + w - 4 - this.measure(String(Math.round(t * 100)), 7, 'pixel'), ty - 3.5, t > 0.92 ? P().bg : P().fg, 1);
      }
      return lo + (hi - lo) * t;
    }, 6);
    def('dial', (label, x, y, r, v) => {
      x = num(x); y = num(y); r = num(r, 10);
      const id = 'd:' + tostr(label) + '@' + x + ',' + y;
      const st = W(id);
      let t = v01(v);
      const act = press(id, x - r, y - r, r * 2, r * 2);
      if (act && I.pressed) { st.y0 = I.y; st.t0 = t; }
      if (act && I.down && st.y0 !== undefined) t = clamp(st.t0 + (st.y0 - I.y) / (r * 4), 0, 1);
      if (I.wheel && this.hit(x - r, y - r, r * 2, r * 2, I.x, I.y)) t = clamp(t + I.wheel * 0.04, 0, 1);
      const gg = g();
      gg.lineCap = 'round';
      gg.lineWidth = Math.max(2, r * 0.25);
      gg.beginPath();
      gg.arc(x, y, r, rad(-135), rad(135));
      gg.strokeStyle = P().dim;
      gg.stroke();
      gg.beginPath();
      gg.arc(x, y, r, rad(-135), rad(-135 + 270 * t));
      gg.strokeStyle = act ? P().fg : P().accent;
      gg.stroke();
      const a = rad(-135 + 270 * t);
      gg.lineWidth = Math.max(1, r * 0.12);
      gg.beginPath();
      gg.moveTo(x + Math.cos(a) * r * 0.2, y + Math.sin(a) * r * 0.2);
      gg.lineTo(x + Math.cos(a) * r * 0.7, y + Math.sin(a) * r * 0.7);
      gg.strokeStyle = P().fg;
      gg.stroke();
      if (label !== undefined && tostr(label) !== '') this.drawText(tostr(label), x, y + r + 2, P().fg, 7, 'center', 'pixel');
      return t;
    }, 8);
    def('list', (items, x, y, w, h, sel) => {
      if (!(items instanceof LTable)) return num(sel, 1);
      x = num(x); y = num(y); w = num(w, 60); h = num(h, 40);
      const id = 'l:@' + x + ',' + y;
      const st = W(id);
      const n = items.len();
      const rh = 9;
      const vis = Math.max(1, Math.floor(h / rh));
      let s = clamp(Math.round(num(sel, 1)), 1, Math.max(1, n));
      st.top = clamp(st.top ?? 0, 0, Math.max(0, n - vis));
      if (st.lastSel !== s) {
        if (s - 1 < st.top) st.top = s - 1;
        if (s - 1 >= st.top + vis) st.top = s - vis;
        st.lastSel = s;
      }
      const act = press(id, x, y, w, h);
      if (act && I.pressed) { st.dy = I.y; st.t0 = st.top; }
      if (act && I.down && Math.abs(I.y - st.dy) > 4) st.top = clamp(Math.round(st.t0 + (st.dy - I.y) / rh), 0, Math.max(0, n - vis));
      if (act && I.released && Math.abs(I.ry - st.dy) <= 4 && this.hit(x, y, w, h, I.rx, I.ry)) {
        const i = st.top + Math.floor((I.ry - y) / rh) + 1;
        if (i >= 1 && i <= n) s = i;
        st.lastSel = s;
      }
      if (I.wheel && this.hit(x, y, w, h, I.x, I.y)) st.top = clamp(st.top - I.wheel, 0, Math.max(0, n - vis));
      const gg = g();
      gg.save();
      gg.beginPath();
      gg.rect(x, y, w, h);
      gg.clip();
      for (let r = 0; r < vis && st.top + r < n; r++) {
        const i = st.top + r + 1;
        const ry = y + r * rh;
        if (i === s) { gg.fillStyle = P().accent; gg.fillRect(x, ry, w, rh); }
        this.pixelText(tostr(items.get(i)), x + 3, ry + 1, i === s ? P().bg : P().fg, 1);
      }
      if (n > vis) {
        gg.fillStyle = P().dim;
        gg.fillRect(x + w - 2, y, 2, h);
        gg.fillStyle = P().fg;
        gg.fillRect(x + w - 2, y + (h * st.top) / n, 2, Math.max(3, (h * vis) / n));
      }
      gg.restore();
      R.steps -= vis * 3;
      return s;
    }, 6);
    def('tabs', (names, x, y, w, h, cur) => {
      if (!(names instanceof LTable)) return num(cur, 1);
      x = num(x); y = num(y); w = num(w, this.W); h = num(h, 10);
      const n = Math.max(1, names.len());
      let c = clamp(Math.round(num(cur, 1)), 1, n);
      const tw = w / n;
      const id = 'tabs@' + x + ',' + y;
      const act = press(id, x, y, w, h);
      if (act && I.released && this.hit(x, y, w, h, I.rx, I.ry)) c = clamp(Math.floor((I.rx - x) / tw) + 1, 1, n);
      const gg = g();
      for (let i = 1; i <= n; i++) {
        const tx = x + (i - 1) * tw;
        gg.fillStyle = i === c ? P().accent : P().panel;
        gg.fillRect(tx + 0.5, y, tw - 1, h);
        this.label(tostr(names.get(i)), tx, y, tw, h, i === c ? P().bg : P().fg);
      }
      return c;
    }, 6);
    def('pager', (count, cur, x, y, w, h) => {
      const n = Math.max(1, Math.round(num(count, 1)));
      x = num(x, 0); w = num(w, this.W); h = num(h, 9); y = num(y, this.H - h);
      let c = clamp(Math.round(num(cur, 1)), 1, n);
      const id = 'pager@' + x + ',' + y;
      const act = press(id, x, y, w, h);
      if (act && I.released && this.hit(x, y, w, h, I.rx, I.ry)) {
        if (I.rx < x + w * 0.3) c = c > 1 ? c - 1 : n;
        else if (I.rx > x + w * 0.7) c = c < n ? c + 1 : 1;
      }
      const gg = g();
      gg.fillStyle = P().fg;
      const my = y + h / 2;
      gg.beginPath(); gg.moveTo(x + 3, my); gg.lineTo(x + 7, my - 3); gg.lineTo(x + 7, my + 3); gg.fill();
      gg.beginPath(); gg.moveTo(x + w - 3, my); gg.lineTo(x + w - 7, my - 3); gg.lineTo(x + w - 7, my + 3); gg.fill();
      const dx = Math.min(7, (w - 24) / n);
      const x0 = x + w / 2 - (dx * (n - 1)) / 2;
      for (let i = 1; i <= n; i++) {
        gg.fillStyle = i === c ? P().accent : P().dim;
        gg.beginPath();
        gg.arc(x0 + (i - 1) * dx, my, i === c ? 2 : 1.5, 0, Math.PI * 2);
        gg.fill();
      }
      return c;
    }, 6);
    def('textfield', (name, x, y, w, h, text, max) => {
      x = num(x); y = num(y); w = num(w, 60); h = num(h, 11);
      const id = 'tf:' + tostr(name);
      const st = W(id);
      const act = press(id, x, y, w, h);
      if (act && I.released && this.hit(x, y, w, h, I.rx, I.ry) && !this.focus) {
        this.focus = id;
        st.text = text === undefined ? '' : tostr(text);
        st.orig = st.text;
        st.max = Math.max(1, Math.round(num(max, 32)));
        st.done = false;
        this.active = null;
      }
      const focused = this.focus === id;
      const val = focused || st.done ? st.text : text === undefined ? '' : tostr(text);
      if (st.done) st.done = false;
      const gg = g();
      gg.beginPath();
      this.rr(gg, x + 0.5, y + 0.5, w - 1, h - 1, 2);
      gg.fillStyle = P().panel;
      gg.fill();
      gg.strokeStyle = focused ? P().accent : P().dim;
      gg.lineWidth = 1;
      gg.stroke();
      gg.save();
      gg.beginPath();
      gg.rect(x + 2, y, w - 4, h);
      gg.clip();
      this.pixelText(val, x + 3, y + (h - 7) / 2, P().fg, 1);
      gg.restore();
      return val;
    }, 6);
    def('focused', () => !!this.focus);
    def('inside', (x, y, w, h) => this.hit(num(x), num(y), num(w), num(h), I.x, I.y));
    def('tapped', (x, y, w, h) => I.released && this.hit(num(x), num(y), num(w), num(h), I.rx, I.ry) && this.hit(num(x), num(y), num(w), num(h), I.px, I.py));

    // ---- time
    def('time', () => (this.now - this.t0) / 1000);
    def('dt', () => this.dtv);
    def('frame', () => this.frameN);
    def('every', (ms) => {
      const i = this.everyIdx++;
      const p = Math.max(10, num(ms, 1000));
      const last = this.everyT[i];
      if (last === undefined || this.now - last >= p) {
        this.everyT[i] = last === undefined ? this.now : last + p * Math.floor((this.now - last) / p);
        return true;
      }
      return false;
    });
    def('blink', (ms = 500) => Math.floor((this.now - this.t0) / Math.max(10, num(ms, 500))) % 2 === 0);

    // ---- controls
    const H = () => this.host;
    const ctlName = (n) => (typeof n === 'number' ? n : tostr(n));
    def('knob', (name) => H() ? H().getControl(ctlName(name), 'knob') ?? 0 : 0);
    def('setKnob', (name, v) => !!(H() && H().setControl(ctlName(name), clamp(num(v), 0, 1), 'knob')), 4);
    def('switch', (name) => H() ? H().getControl(ctlName(name), 'switch') ?? 1 : 1);
    def('setSwitch', (name, v) => !!(H() && H().setControl(ctlName(name), num(v, 1), 'switch')), 4);
    def('dip', (a, b) => {
      if (!H()) return false;
      if (b === undefined) return !!H().getControl(typeof a === 'number' ? a : tostr(a), 'dip');
      const e = H().list.filter((x) => x.kind === 'dip' && (x.src.label || '').toLowerCase() === tostr(a).toLowerCase())[num(b) - 1];
      return e ? !!H().getControl(e.name) : false;
    });
    def('setDip', (a, b, c) => {
      if (!H()) return false;
      if (c === undefined) return !!H().setControl(typeof a === 'number' ? a : tostr(a), truthy(b), 'dip');
      const e = H().list.filter((x) => x.kind === 'dip' && (x.src.label || '').toLowerCase() === tostr(a).toLowerCase())[num(b) - 1];
      return e ? !!H().setControl(e, truthy(c)) : false;
    }, 4);
    def('footswitch', (name = 1) => !!(H() && H().getControl(ctlName(name), 'foot')));
    def('setFootswitch', (name, on) => !!(H() && H().setControl(ctlName(name), truthy(on), 'foot')), 4);
    def('pushbutton', (name = 1) => !!(H() && H().getControl(ctlName(name), 'button')));
    def('setPushbutton', (name, on) => !!(H() && H().setControl(ctlName(name), truthy(on), 'button')), 4);
    def('ctl', (name) => (H() ? H().getControl(ctlName(name)) : undefined));
    def('setCtl', (name, v) => {
      if (!H()) return false;
      const e = H().find(ctlName(name));
      if (!e) return false;
      return !!H().setControl(e, e.kind === 'knob' ? clamp(num(v), 0, 1) : e.kind === 'switch' ? num(v, 1) : truthy(v));
    }, 4);
    def('valueText', (name) => (H() ? H().display(ctlName(name)) : ''));
    def('controls', (kind) => makeTable(H() ? H().list.filter((e) => !kind || e.kind === tostr(kind)).map((e) => e.name) : []));
    def('controlInfo', (name) => {
      const e = H() && H().find(ctlName(name));
      return e ? makeTable({ name: e.name, kind: e.kind, label: e.label, positions: e.ways, options: e.opts || null }) : undefined;
    });
    def('bypassed', () => (H() ? H().bypassed() : false));
    def('pedalOn', () => (H() ? !H().bypassed() : true));
    def('setPedalOn', (on) => { if (H()) H().setBypass(!truthy(on)); });
    def('lastControl', () => (this.lastCtl.t < 0 ? undefined : makeTable({ name: this.lastCtl.name, value: this.lastCtl.value, ago: (this.now - this.lastCtl.t) / 1000 })));
    def('signal', (name) => {
      if (!H()) return 0;
      const v = H().getSignal(tostr(name));
      return typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean' ? v : undefined;
    }, 2);
    def('setInput', (name, v) => !!(H() && H().setInput(tostr(name), v)), 4);
    def('signals', () => makeTable(H() ? H().signals() : []));

    // ---- state that is saved with the preset
    def('save', (key, v) => {
      if (!this.store) this.store = {};
      const js = toJS(v);
      if (JSON.stringify(js ?? null).length > 8000) throw new Error('save: that value is too big to keep');
      this.store[tostr(key)] = js;
      this.storeDirty = this.storeDirty || this.now || 1;
    });
    def('load', (key, d) => {
      const v = this.store ? this.store[tostr(key)] : undefined;
      return v === undefined || v === null ? d : toScript(v);
    });
  }
}
