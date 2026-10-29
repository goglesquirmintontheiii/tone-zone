// A block on the board: graphic, control views, jacks, live LEDs and screens.
import { svg, clamp, shade } from './util.js';
import { renderForm } from './gfx/forms.js';
import { getDef, rememberBlockSize } from './catalog/index.js';
import { state, uiParams, nodePorts, engineParamsFor } from './state.js';
import { drawScreen } from './screens.js';
import { drawLed } from './gfx/controls.js';
import { setA, setText } from './gfx/fx.js';
import { snapshotNode } from './gfx/raster.js';

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

// block rotation in 90 degree steps. The rotated block keeps its top-left corner at block.x / y.
export const rotOf = (b) => ((((b && b.rot) || 0) % 360) + 360) % 360;
export function rotTransform(r, w, h) {
  return r === 90 ? `translate(${h},0) rotate(90)` : r === 180 ? `translate(${w},${h}) rotate(180)` : r === 270 ? `translate(0,${w}) rotate(270)` : '';
}
export function rotPoint(r, w, h, x, y) {
  return r === 90 ? [h - y, x] : r === 180 ? [w - x, h - y] : r === 270 ? [y, w - x] : [x, y];
}
const SIDES = ['left', 'top', 'right', 'bottom'];
export function rotSide(side, r) {
  const i = SIDES.indexOf(side);
  return i < 0 ? side : SIDES[(i + r / 90) % 4];
}
function rotJack(j, r, w, h) {
  const [x, y] = rotPoint(r, w, h, j.x, j.y);
  return { ...j, x, y, side: rotSide(j.side, r) };
}

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
    if (d.missing) {
      // size / jack count saved with the preset so the outline matches the real block
      if (this.block._w) { rdef.missingW = this.block._w; rdef.missingH = this.block._h; }
      if (this.block._ports) rdef.ports = { ins: [...Array(this.block._ports[0])].map((_, i) => 'IN ' + (i + 1)), outs: [...Array(this.block._ports[1])].map((_, i) => 'OUT ' + (i + 1)) };
    }
    if (d.io && state.settings.io && state.settings.io[d.io]) {
      const base = d.io === 'in' ? d.ports.outs : d.ports.ins;
      const labels = base.map((l, i) => state.settings.io[d.io][i]?.label || l);
      rdef.ports = d.io === 'in' ? { ins: [], outs: labels } : { ins: labels, outs: [] };
    }
    this.g = svg('g', { class: 'node', transform: `translate(${this.block.x},${this.block.y})` });
    this.g.dataset.node = this.block.id;
    // rotation lives on an inner group so the outer one is just the position
    this.rg = svg('g', {}, this.g);
    const content = svg('g', {}, this.rg);
    this.content = content;
    // level of detail: show a bitmap of the block instead of the live SVG when zoomed out
    this.lodImg = svg('image', { display: 'none', 'pointer-events': 'none', preserveAspectRatio: 'none' }, this.rg);
    if (this._lodUrl) URL.revokeObjectURL(this._lodUrl);
    this._lodUrl = null;
    this._lodScale = 0;
    this._lodDirty = true;
    this.lodOn = false;
    // jack keys with something plugged in (couplers draw their plug tips only when free)
    const connected = new Set();
    if (d.coupler && state.preset) for (const c of state.preset.cables) { if (c.from.node === this.block.id) connected.add('o' + c.from.port); if (c.to.node === this.block.id) connected.add('i' + c.to.port); }
    const ctx = { g: content, views: new Map(), flip: !!state.settings.flowLeftToRight, block: this.block, connected };
    const res = renderForm(ctx, rdef);
    this.fw = res.w;
    this.fh = res.h;
    this.rot = rotOf(this.block);
    const sw = this.rot === 90 || this.rot === 270;
    this.w = sw ? res.h : res.w;
    this.h = sw ? res.w : res.h;
    if (this.rot) this.rg.setAttribute('transform', rotTransform(this.rot, res.w, res.h));
    if (!d.missing) {
      if (d.plugin) rememberBlockSize(d.id, res.w, res.h);
      this.block._w = Math.round(res.w);
      this.block._h = Math.round(res.h);
      this.block._ports = [rdef.ports.ins.length, rdef.ports.outs.length];
    }
    this.slots = res.slots || null;
    this.jacks = this.rot ? res.jacks.map((j) => rotJack(j, this.rot, res.w, res.h)) : res.jacks;
    this.views = ctx.views;
    this.ioMeters = ctx.ioMeters;
    this.tubeGlows = ctx.tubeGlows;
    this.theme = res.theme;
    this.screens = [];
    for (const [cid, v] of this.views) if (v.ctl.t === 'screen') this.screens.push({ ctl: v.ctl, view: v.view, state: {} });
    // position LEDs around the selector, like on a Drop
    if (d.dropLeds) {
      const sel = d.controls.find((c) => c.p === 'dsel');
      this.dropLeds = sel.options.map((_, i) => {
        const n = sel.options.length, sw = sel.sweep || 270;
        const a = ((-sw / 2 + (sw * i) / (n - 1)) * Math.PI) / 180;
        const rr = (sel.r || 20) + 22;
        return drawLed(content, { x: sel.x + Math.sin(a) * rr, y: sel.y - Math.cos(a) * rr, r: 1.9, color: '#ff2a1a', bezel: '#222' });
      });
    }
    // selection ring and load badge
    svg('rect', { class: 'sel-ring', x: -5, y: -5, width: this.w + 10, height: this.h + 10, rx: 14 }, this.g);
    this.dim = svg('rect', { x: 0, y: 0, width: this.w, height: this.h, rx: 8, fill: '#05070a', opacity: 0, 'pointer-events': 'none' }, this.g);
    this.badge = svg('text', { class: 'load-badge', x: this.w - 2, y: this.h + 14, 'text-anchor': 'end', fill: '#8c94a6' }, this.g);
    if (old && old.parentNode) old.replaceWith(this.g);
    else this.layer.appendChild(this.g);
    this.updateControls();
    this.updateSelection();
    this.setBypassVisual();
  }

  // switch between the live graphic and its bitmap (only if the bitmap exists)
  setLOD(on) {
    on = on && !!this._lodUrl && this._lodShown === this._lodUrl;
    if (on === this.lodOn) return;
    this.lodOn = on;
    this.content.setAttribute('display', on ? 'none' : 'inline');
    this.lodImg.setAttribute('display', on ? 'inline' : 'none');
  }
  lodReady(scale) {
    return !!this._lodUrl && !this._lodDirty && this._lodScale >= scale - 1e-6;
  }
  async makeLOD(scale) {
    if (this._lodBusy) return false;
    this._lodBusy = true;
    const wasOn = this.lodOn;
    try {
      // snapshot the live graphic (it must be displayed to measure it)
      if (wasOn) this.content.setAttribute('display', 'inline');
      this._lodDirty = false;
      const snap = await snapshotNode(this.content, scale).catch(() => null);
      if (wasOn && this.lodOn) this.content.setAttribute('display', 'none');
      if (!snap) return false;
      if (this._lodUrl) URL.revokeObjectURL(this._lodUrl);
      this._lodUrl = snap.url;
      this._lodScale = scale;
      const im = this.lodImg;
      im.setAttribute('x', snap.x); im.setAttribute('y', snap.y); im.setAttribute('width', snap.w); im.setAttribute('height', snap.h);
      // only swap once the bitmap has really loaded, so a block never goes blank
      await new Promise((res) => {
        const done = (ok) => { im.removeEventListener('load', onL); im.removeEventListener('error', onE); if (ok) this._lodShown = snap.url; res(); };
        const onL = () => done(true), onE = () => done(false);
        im.addEventListener('load', onL);
        im.addEventListener('error', onE);
        im.setAttribute('href', snap.url);
        setTimeout(() => done(false), 3000);
      });
      return this._lodShown === snap.url;
    } finally {
      this._lodBusy = false;
    }
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
    return { x: this.block.x + j.x, y: this.block.y + j.y, side: j.side, kind: j.kind, male: !!j.male };
  }

  // visual state of all controls from block params
  updateControls() {
    this._lodDirty = true;
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
          const i = c.idx;
          view.set({ on: (ui[`m${i}on`] ?? 0) > 0.5, x: ui[`_m${i}x`], y: ui[`_m${i}y`], dist: ui[`m${i}dist`] ?? 0.15, type: ui[`m${i}type`] ?? 0, sel: state.ui[this.block.id]?.selMic === i && state.selection.has(this.block.id) });
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
    if (c.sub) st = st?.[c.sub];
    // params are only built when an LED needs them, once per LED pass
    const U = () => this._ledUi || (this._ledUi = uiParams(b));
    const bind = c.bind || 'on';
    const on = !b.bypass || this.def.alwaysOn;
    const parts = bind.split(':');
    switch (parts[0]) {
      case 'on':
        return on && !(this.def.alwaysOn && b.bypass) ? true : null;
      case 'param': {
        // param:x  · param:!x (inverted) · param:x:=2 / param:x:>0.3 / param:x:<0.3 · onparam requires the block on
        const inv = parts[1].startsWith('!');
        const v = U()[inv ? parts[1].slice(1) : parts[1]] ?? 0;
        let hit;
        const cmp = parts[2];
        if (!cmp) hit = v > 0.5;
        else if (cmp[0] === '=') hit = Math.round(v) === +cmp.slice(1);
        else if (cmp[0] === '>') hit = v > +cmp.slice(1);
        else if (cmp[0] === '<') hit = v < +cmp.slice(1);
        else hit = v > 0.5;
        if (inv) hit = !hit;
        return hit ? true : null;
      }
      case 'onparam': {
        const inv = parts[1].startsWith('!');
        const v = (U()[inv ? parts[1].slice(1) : parts[1]] ?? 0) > 0.5;
        return on && v !== inv ? true : null;
      }
      case 'fn': // def-supplied function: c.ledFn(ui, block, status, now) -> true | colour | null
        try {
          return c.ledFn ? c.ledFn(U(), b, st, now) || null : null;
        } catch {
          return null;
        }
      case 'select': {
        const i = +parts[1];
        if ((U().mode ?? 0) > 0.5) return ((U().mask ?? 1) >> i) & 1 ? true : null;
        return (U().sel ?? 0) === i ? true : null;
      }
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
        const enabled = parts[1] === 'on' ? on : U()[parts[1]] > 0.5;
        if (!enabled) return null;
        let hz;
        if (parts[2] === 'speedlex') hz = U().speed > 0.5 ? 6.7 : 0.83;
        else hz = 0.4 * Math.pow(35, U()[parts[2]] ?? 0.5);
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
    this._ledUi = null;
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
    // load badge: 2 Hz is enough (text changes are costly to repaint)
    if (now - (this._badgeT || 0) > 1000) {
      this._badgeT = now;
      setText(this.badge, typeof st.load === 'number' && state.settings.showLoad !== false && this.def.cost !== 0 ? (st.load * 100).toFixed(1) + '%' : '');
    }
    // tube glow: a slow, small flicker that brightens with input level (low rate keeps it cheap)
    if (this.tubeGlows && now - (this._tubeT || 0) > 150) {
      this._tubeT = now;
      const off = this.block.bypass;
      const lvl = Math.min(1, Math.max(...(state.status.inPeak || [0]).slice(0, 2)) * 2.5);
      this.tubeGlows.forEach((el, i) => {
        const v = off ? 0.12 : 0.86 + 0.14 * lvl + 0.07 * Math.sin(now / (380 + i * 57) + i * 1.7) + 0.04 * (Math.random() - 0.5);
        setA(el, 'fill-opacity', Math.min(1, v * (el._k ?? 1)).toFixed(2));
      });
    }
    // panel meters are just for looks, half rate is enough
    if (this.ioMeters && now - (this._ioT || 0) > 85) {
      this._ioT = now;
      const peaks = this.def.io === 'in' ? state.status.inPeak : state.status.outPeak;
      if (peaks)
        this.ioMeters.forEach((segs, i) => {
          // extra jacks (XLR, aux, phones) show the channel(s) they share
          const chs = (this.def.ioMap && this.def.ioMap[(this.def.io === 'in' ? 'o' : 'i') + i]) || [i];
          const db = 20 * Math.log10(Math.max(1e-6, ...chs.map((c) => peaks[c] || 0)));
          const lit = Math.round(clamp((db + 54) / 54, 0, 1) * segs.length);
          segs.forEach((s, k) => {
            const col = k >= 9 ? '#ff4d5e' : k >= 7 ? '#ffc24b' : '#37d6c2';
            setA(s, 'fill', k < lit ? col : '#14181f');
          });
        });
    }
  }

  setBypassVisual() {
    this._lodDirty = true;
    this.updateLeds();
    if (this.dim) setA(this.dim, 'opacity', this.block.bypass && !this.def.alwaysOn && !this.def.tunerBlock ? 0.1 : 0);
  }
}

export { shade };
