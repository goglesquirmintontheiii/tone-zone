// A block on the board: graphic, control views, jacks, live LEDs and screens.
import { svg, clamp, shade } from './util.js';
import { renderForm } from './gfx/forms.js';
import { getDef } from './catalog/index.js';
import { state, uiParams, nodePorts, engineParamsFor } from './state.js';
import { drawScreen } from './screens.js';
import { drawLed } from './gfx/controls.js';
import { setA, setText } from './gfx/fx.js';

export function knobPos(c, v) {
  const min = c.min ?? 0, max = c.max ?? 1;
  if (c.curve === 'log' && min > 0) return clamp(Math.log(v / min) / Math.log(max / min), 0, 1);
  return clamp((v - min) / (max - min || 1), 0, 1);
}
export function knobValue(c, pos) {
  const min = c.min ?? 0, max = c.max ?? 1;
  pos = clamp(pos, 0, 1);
  let v = c.curve === 'log' && min > 0 ? min * Math.pow(max / min, pos) : min + (max - min) * pos;
  if (c.step) v = Math.round(v / c.step) * c.step;
  return v;
}

const LOOPER_COLORS = { 0: '#2f6bff', 1: '#ff2a1a', 2: '#3ddc84', 3: '#ffd21f', 4: '#ffffff' };

export class NodeView {
  constructor(block, layer) {
    this.block = block;
    this.layer = layer;
    this.def = getDef(block.type);
    this.render();
  }

  render() {
    const old = this.g;
    const d = this.def;
    const rdef = Object.create(d);
    rdef.ports = nodePorts(this.block);
    this.g = svg('g', { class: 'node', transform: `translate(${this.block.x},${this.block.y})` });
    this.g.dataset.node = this.block.id;
    const content = svg('g', {}, this.g);
    const ctx = { g: content, views: new Map(), flip: !!state.settings.flowLeftToRight };
    const res = renderForm(ctx, rdef);
    this.w = res.w;
    this.h = res.h;
    this.jacks = res.jacks;
    this.views = ctx.views;
    this.ioMeters = ctx.ioMeters;
    this.theme = res.theme;
    this.screens = [];
    for (const [cid, v] of this.views) if (v.ctl.t === 'screen') this.screens.push({ ctl: v.ctl, view: v.view, state: {} });
    // Drop-style position LEDs around the selector
    if (d.dropLeds) {
      const sel = d.controls.find((c) => c.p === 'dsel');
      this.dropLeds = sel.options.map((_, i) => {
        const n = sel.options.length, sw = sel.sweep || 270;
        const a = ((-sw / 2 + (sw * i) / (n - 1)) * Math.PI) / 180;
        const rr = (sel.r || 20) + 22;
        return drawLed(content, { x: sel.x + Math.sin(a) * rr, y: sel.y - Math.cos(a) * rr, r: 1.9, color: '#ff2a1a', bezel: '#222' });
      });
    }
    // selection ring + load badge
    svg('rect', { class: 'sel-ring', x: -5, y: -5, width: this.w + 10, height: this.h + 10, rx: 14 }, this.g);
    this.dim = svg('rect', { x: 0, y: 0, width: this.w, height: this.h, rx: 8, fill: '#05070a', opacity: 0, 'pointer-events': 'none' }, this.g);
    this.badge = svg('text', { class: 'load-badge', x: this.w - 2, y: this.h + 14, 'text-anchor': 'end', fill: '#8c94a6' }, this.g);
    if (old && old.parentNode) old.replaceWith(this.g);
    else this.layer.appendChild(this.g);
    this.updateControls();
    this.updateSelection();
    this.setBypassVisual();
  }

  setPosition(x, y) {
    this.block.x = x;
    this.block.y = y;
    setA(this.g, 'transform', `translate(${x},${y})`);
  }

  updateSelection() {
    this.g.classList.toggle('selected', state.selection.has(this.block.id));
  }

  jack(key) {
    return this.jacks.find((j) => j.key === key);
  }
  jackWorld(key) {
    const j = this.jack(key);
    if (!j) return null;
    return { x: this.block.x + j.x, y: this.block.y + j.y, side: j.side };
  }

  // visual state of all controls from block params
  updateControls() {
    const ui = uiParams(this.block);
    const alt = state.ui[this.block.id]?.alt;
    for (const [, { ctl: c, view }] of this.views) {
      const p = alt && c.alt ? c.alt : c.p;
      const v = ui[p];
      switch (c.t) {
        case 'knob':
        case 'slider':
        case 'treadle':
          if (alt && c.alt) view.set(clamp(p === 'amp.level' ? (v + 30) / 42 : v, 0, 1));
          else view.set(knobPos(c, v ?? c.def ?? 0));
          break;
        case 'sel':
          if (alt && c.alt) view.set(Math.round(clamp((v + 30) / 42, 0, 1) * (c.options.length - 1)));
          else view.set(v ?? c.def ?? 0);
          break;
        case 'toggle':
          view.set(v ?? c.def ?? 0);
          break;
        case 'button':
          if (c.action === 'alt') view.set(!!alt);
          else if (c.toggle) view.set(!!ui[c.p]);
          break;
        case 'mic': {
          const micNames = ['57', 'C414', 'R121', '421'];
          view.set({ pos: ui.position ?? 0.3, dist: ui.distance ?? 0.15, name: micNames[(ui.mic ?? this.def.opts.mic ?? 0) | 0] });
          break;
        }
      }
    }
    if (this.dropLeds) {
      const idx = ui.dsel ?? 1;
      this.dropLeds.forEach((l, i) => l.set(i === idx ? '#ff2a1a' : null));
    }
    this.updateLeds();
  }

  ledColor(c, st, now) {
    const b = this.block;
    const ui = uiParams(b);
    const bind = c.bind || 'on';
    const on = !b.bypass || this.def.alwaysOn;
    const parts = bind.split(':');
    switch (parts[0]) {
      case 'on':
        return on && !(this.def.alwaysOn && b.bypass) ? true : null;
      case 'param':
        return ui[parts[1]] > 0.5 ? true : null;
      case 'fav':
        return state.ui[b.id]?.favActive ? true : null;
      case 'tunerOk': {
        const t = st?.tuner;
        if (b.bypass || !t || !t.note) return null;
        return Math.abs(t.cents) < 1.5 ? '#3ddc84' : '#ff2a1a';
      }
      case 'tap': {
        if (!on) return null;
        const msv = st?.timeMs || engineParamsFor(b)[parts[1]] || 400;
        return now % msv < Math.min(70, msv * 0.4) ? true : null;
      }
      case 'rate': {
        const enabled = parts[1] === 'on' ? on : ui[parts[1]] > 0.5;
        if (!enabled) return null;
        let hz;
        if (parts[2] === 'speedlex') hz = ui.speed > 0.5 ? 6.7 : 0.83;
        else hz = 0.4 * Math.pow(35, ui[parts[2]] ?? 0.5);
        return ((now / 1000) * hz) % 1 < 0.5 ? true : null;
      }
      case 'looper': {
        const L = st?.looper;
        if (!L) return null;
        const cur = state.ui[b.id]?.current ?? 0;
        const layer = state.ui[b.id]?.layer ?? 0;
        if (parts[1] === 'rhythm') return L.rhythm ? true : null;
        if (parts[1] === 'any') return L.tracks.some((t) => t.state === 2 || t.state === 3) ? true : null;
        if (parts[1] === 'layer') return layer ? '#ff2a1a' : '#ffffff';
        if (parts[1] === 'undo') return L.tracks.some((t) => t.state !== 0) ? '#3ddc84' : null;
        if (parts[1] === 'current') return cur === 1 ? '#ffffff' : null;
        let ti = cur;
        if (parts[2] && parts[2].startsWith('layer+')) ti = layer * 3 + parseInt(parts[2].slice(6), 10);
        else if (parts[2] && parts[2] !== 'current') ti = parseInt(parts[2], 10);
        const t = L.tracks[ti];
        if (!t) return null;
        if (parts[1] === 'stop') return t.state === 4 ? '#ff2a1a' : null;
        if (t.state === 1 && now % 500 < 250) return null; // recording blinks
        if (t.state === 4) return '#ffffff';
        return LOOPER_COLORS[t.state] || null;
      }
      default:
        return on ? true : null;
    }
  }

  updateLeds(now = performance.now()) {
    const st = state.status.blocks[this.block.id];
    for (const [, { ctl: c, view }] of this.views) {
      if (c.t === 'led') view.set(this.ledColor(c, st, now));
      else if (c.t === 'button' && c.led && c.bind) view.set(!!this.ledColor(c, st, now));
      else if (c.t === 'slider' && view.led) view.led(!this.block.bypass);
    }
  }

  updateStatus(now) {
    const st = state.status.blocks[this.block.id] || {};
    this.updateLeds(now);
    for (const s of this.screens) drawScreen(s, this, st, now);
    // load badge: 2 Hz is plenty (text changes are comparatively expensive to repaint)
    if (now - (this._badgeT || 0) > 500) {
      this._badgeT = now;
      setText(this.badge, typeof st.load === 'number' && state.settings.showLoad !== false ? (st.load * 100).toFixed(1) + '%' : '');
    }
    if (this.ioMeters) {
      const peaks = this.def.io === 'in' ? state.status.inPeak : state.status.outPeak;
      if (peaks)
        this.ioMeters.forEach((segs, i) => {
          const db = 20 * Math.log10(Math.max(1e-6, peaks[i] || 0));
          const lit = Math.round(clamp((db + 54) / 54, 0, 1) * segs.length);
          segs.forEach((s, k) => {
            const col = k >= 9 ? '#ff4d5e' : k >= 7 ? '#ffc24b' : '#37d6c2';
            setA(s, 'fill', k < lit ? col : '#14181f');
          });
        });
    }
  }

  setBypassVisual() {
    this.updateLeds();
    if (this.dim) setA(this.dim, 'opacity', this.block.bypass && !this.def.alwaysOn && !this.def.tunerBlock ? 0.1 : 0);
  }
}

export { shade };
