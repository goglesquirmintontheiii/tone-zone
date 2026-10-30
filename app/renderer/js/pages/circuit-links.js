// Pedal Factory: direct links, with no circuit in between. Controls, EXP / footswitch IN jacks, screen outputs
// and circuit outputs wired straight to LEDs (or one colour of an RGB or bicolour LED), EXP / footswitch OUT
// jacks, screen inputs and other controls.
//
// A source is a ref:
//   {n, p}        a circuit output (status cv[])         {ctl, sw?}   a control (sw: a DIP switch or XY axis)
//   {jack, ch?}   an EXP or footswitch IN jack (ch 't' tip or 'r' ring)   {scr, o}   output o of a screen
// Each destination takes one ref:
//   led.bind = 'src' with led.src, or led.chans = {r, g, b} (RGB) / {c1, c2} (bicolour)
//   j.from (an EXP / footswitch OUT jack), screen.sio.ins[i].from, c.from (a control moved by the source)
// Rotary encoders (knobs with part 'encoder') turn endlessly; besides their position they send CW and CCW pulses
// ({ctl, sw: 'cw' | 'ccw'}, block params u.<id>.cw / .ccw that the control layer sets to 1 for a moment per detent
// step, makePulser below) and count steps (u.<id>.n). c.encMode: 'wrap' (default, round and round), 'clamp'
// (stops at the ends) or 'relative' (what it drives gets the step count). An encoder's LED ring follows the
// encoder unless something is wired to it: c.ringFrom (analog, the arc or dot position) and c.ringLeds (one input
// per LED, its brightness, or red / green / blue inputs: see factory-ring.js).
// Values: a source reads as t (0..1; binary sources 0 or 1) and raw (circuit and screen outputs as they are).
// A binary destination is on above 0.5; an analog one takes t (LED brightness, heel to toe, knob position).
import { clamp } from '../util.js';
import { ringOut, ringAnyWired } from './factory-ring.js';

export const isRef = (r) => !!r && typeof r === 'object' && !!(r.n || r.ctl || r.jack || r.scr);
/** Port key of a source in the wiring diagram. */
export function refKey(r) {
  if (!isRef(r)) return '';
  if (r.n) return 'co:' + r.n + ':' + r.p;
  if (r.ctl) return 'ctl:' + r.ctl + (r.sw != null ? ':' + r.sw : '');
  if (r.jack) return 'jack:' + r.jack + (r.ch ? ':' + r.ch : '');
  return 'so:' + r.scr + ':' + r.o;
}
export const isEnc = (c) => !!c && c.kind === 'knob' && c.part === 'encoder';
const PULSE = (sw) => sw === 'cw' || sw === 'ccw';
export const sameRef = (a, b) => isRef(a) && isRef(b) && refKey(a) === refKey(b);

// LED colour channels: RGB has three, bicolour two (its colour and its second colour)
export const LED_CHANS = { rgb: [['r', 'R'], ['g', 'G'], ['b', 'B']], bicolour: [['c1', '1'], ['c2', '2']] };
export const ledChans = (c) => (c && c.kind === 'led' && LED_CHANS[c.look]) || null;
/** The single source of an LED from its older bind ('cv:' circuit output, 'ctl:' control) or bind 'src'. */
export function ledRef(c) {
  const b = c.bind || '';
  if (b === 'src') return isRef(c.src) ? c.src : null;
  if (b.startsWith('cv:')) {
    const k = b.slice(3), dot = k.indexOf('.');
    return dot > 0 ? { n: k.slice(0, dot), p: k.slice(dot + 1) } : null;
  }
  if (b.startsWith('ctl:')) return { ctl: b.slice(4) };
  return null;
}
export const hasChans = (c) => !!(ledChans(c) && c.chans && Object.values(c.chans).some(isRef));

// controls a link can move, and what they take
const KNOB = new Set(['knob', 'trim', 'slider', 'pedal']);
export function drivable(c) {
  if (!c || c.hidden) return false;
  if (KNOB.has(c.kind) || c.kind === 'toggle' || c.kind === 'sel') return true;
  return c.kind === 'button' && !(c.map && c.map.to && c.map.to.endsWith('.tap'));
}
const steps = (c) => (c.kind === 'toggle' ? c.ways || 2 : c.kind === 'sel' ? c.n || 4 : 2);
/** What a source sends: 'b' binary or 'n' analog. */
export function ctlSig(c, sw) {
  if (c.kind === 'dip' || PULSE(sw)) return 'b';
  if (c.kind === 'xy') return 'n';
  return c.kind === 'foot' || c.kind === 'button' || (c.kind === 'toggle' && (c.ways || 2) === 2) ? 'b' : 'n';
}

/** Lookups for reading refs: outs = circuitOutputs(D). */
export function linkCtx(D, outs) {
  return {
    D,
    outs: new Map((outs || []).map((o) => [o.key, o])),
    ctls: new Map((D.ctls || []).map((c) => [c.id, c])),
    jacks: new Map((D.jacks || []).map((j) => [j.id, j])),
  };
}
export function refOk(X, r) {
  if (!isRef(r)) return false;
  if (r.n) return X.outs.has(r.n + '.' + r.p);
  if (r.ctl) {
    const c = X.ctls.get(r.ctl);
    if (!c) return false;
    if (r.sw != null) return PULSE(r.sw) ? isEnc(c) : c.kind === 'dip' ? r.sw < (c.n || 4) : c.kind === 'xy' ? r.sw < 2 : false;
    return c.kind !== 'led' && c.kind !== 'screen' && c.kind !== 'dip' && c.kind !== 'xy';
  }
  if (r.jack) {
    const j = X.jacks.get(r.jack);
    return !!j && (j.kind === 'exp' || j.kind === 'fsw');
  }
  const s = X.ctls.get(r.scr);
  return !!s && s.kind === 'screen' && !!(s.sio && s.sio.outs && s.sio.outs[r.o]);
}
export function refSig(X, r) {
  if (!isRef(r)) return 'n';
  if (r.n) return X.outs.get(r.n + '.' + r.p)?.sig || 'n';
  if (r.ctl) {
    const c = X.ctls.get(r.ctl);
    return c ? ctlSig(c, r.sw) : 'n';
  }
  if (r.jack) return X.jacks.get(r.jack)?.kind === 'fsw' ? 'b' : 'n';
  const p = X.ctls.get(r.scr)?.sio?.outs?.[r.o];
  return p && p.sig === 'b' ? 'b' : 'n';
}
/** The block param a source lives in (null for circuit outputs and the bypass footswitch). */
export function refParam(X, r) {
  if (!isRef(r) || r.n) return null;
  if (r.ctl) {
    const c = X.ctls.get(r.ctl);
    if (!c) return null;
    if (PULSE(r.sw)) return 'u.' + c.id + '.' + r.sw;
    if (c.kind === 'dip') return 'u.' + c.id + '.' + (r.sw || 0);
    if (c.kind === 'xy') return 'u.' + c.id + '.' + (r.sw ? 'y' : 'x');
    if (c.kind === 'foot') return c.map && c.map.to && c.map.to !== 'bypass' && !c.map.to.endsWith('.tap') ? 'u.' + c.id : null;
    return 'u.' + c.id;
  }
  if (r.jack) {
    const j = X.jacks.get(r.jack);
    return j && j.kind === 'fsw' ? 'u.f.' + j.id + (r.ch === 'r' ? '.r' : '') : 'u.x.' + r.jack;
  }
  return 'u.s.' + r.scr + '.' + r.o;
}
/** Read a source: {t, raw} or null when it has nothing to say (an unplugged jack, an engine not running). */
export function readRef(X, r, ui, st, b) {
  if (!isRef(r)) return null;
  ui = ui || {};
  if (r.n) {
    const co = X.outs.get(r.n + '.' + r.p);
    const v = co && st && Array.isArray(st.cv) ? st.cv[co.idx] : undefined;
    if (typeof v !== 'number' || (b && b.bypass)) return null;
    return { t: co.sig === 'b' ? (v > 0.5 ? 1 : 0) : clamp((v - co.min) / ((co.max - co.min) || 1), 0, 1), raw: v };
  }
  if (r.ctl) {
    const c = X.ctls.get(r.ctl);
    if (!c) return null;
    const key = refParam(X, r);
    let t;
    if (PULSE(r.sw)) t = +(ui[key] ?? 0) > 0.5 ? 1 : 0;
    else if (isEnc(c) && c.encMode === 'relative') {
      // the step count, as it is; t is where the knob points
      return { t: clamp(+(ui[key] ?? c.value ?? 0.5), 0, 1), raw: clamp(+(ui[key + '.n'] ?? 0) || 0, -255, 255) };
    } else if (c.kind === 'dip') t = +(ui[key] ?? (c.bits && c.bits[r.sw || 0] ? 1 : 0)) > 0.5 ? 1 : 0;
    else if (c.kind === 'xy') t = clamp(+(ui[key] ?? (r.sw ? c.vy : c.vx) ?? 0.5), 0, 1);
    else if (KNOB.has(c.kind)) t = clamp(+(ui[key] ?? c.value ?? 0.5), 0, 1);
    else if (c.kind === 'toggle' || c.kind === 'sel') t = clamp(+(ui[key] ?? c.pos ?? 0) / Math.max(1, steps(c) - 1), 0, 1);
    else if (c.kind === 'button') t = key && ui[key] != null ? (+ui[key] > 0.5 ? 1 : 0) : c.on ? 1 : 0;
    else if (c.kind === 'foot') t = key ? (+(ui[key] ?? 1) > 0.5 ? 1 : 0) : b ? (b.bypass ? 0 : 1) : 1;
    else return null;
    return { t, raw: t };
  }
  if (r.jack) {
    const v = ui[refParam(X, r)];
    if (v == null) return null; // nothing plugged in
    const t = X.jacks.get(r.jack)?.kind === 'fsw' ? (+v > 0.5 ? 1 : 0) : clamp(+v || 0, 0, 1);
    return { t, raw: t };
  }
  const raw = +(ui[refParam(X, r)] ?? (X.ctls.get(r.scr)?.sio?.outs?.[r.o]?.def ?? 0)) || 0;
  return { t: refSig(X, r) === 'b' ? (raw > 0.5 ? 1 : 0) : clamp(raw, 0, 1), raw };
}
/** The value a control takes when source t moves it. */
export function driveValue(c, t) {
  if (KNOB.has(c.kind)) return clamp(t, 0, 1);
  if (c.kind === 'toggle' || c.kind === 'sel') return Math.round(clamp(t, 0, 1) * (steps(c) - 1));
  return t > 0.5 ? 1 : 0;
}

// ------------------------------------------------------------------ LED colours
const hex2 = (n) => Math.round(clamp(n, 0, 255)).toString(16).padStart(2, '0');
const rgbOf = (col) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(col || '');
  const c = m ? m[1] : 'ff2a1a';
  return [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16));
};
const toHex = (a) => '#' + a.map(hex2).join('');
/** col at brightness k, never quite black (a lit LED you can still see). */
export function dimmed(col, k) {
  const f = 0.22 + 0.78 * k;
  return toHex(rgbOf(col).map((v) => v * f));
}
// the colour each channel adds at full brightness
function chanColours(c) {
  if (c.look === 'bicolour') return { c1: rgbOf(c.color || '#ff2a1a'), c2: rgbOf(c.color2 || '#3ddc84') };
  return { r: [255, 0, 0], g: [0, 255, 0], b: [0, 0, 255] };
}
/** Mix of channel brightnesses {ch: 0..1}: a colour, or null when all are dark. */
export function mixColour(c, ks) {
  const cols = chanColours(c);
  const out = [0, 0, 0];
  let any = false;
  for (const [ch, rgb] of Object.entries(cols)) {
    const k = clamp(ks[ch] || 0, 0, 1);
    if (k < 0.02) continue;
    any = true;
    rgb.forEach((v, i) => (out[i] += v * k));
  }
  // bicolour shows its second colour when unlit, so all dark is drawn as a dark lens
  if (!any) return c.look === 'bicolour' ? '#1b1b1b' : null;
  return toHex(out);
}
/** How the factory draws an LED that is on: the mix of its wired channels, at full. */
export function ledPreview(c) {
  if (!hasChans(c)) return null;
  const ks = {};
  for (const [ch] of ledChans(c)) ks[ch] = isRef(c.chans[ch]) ? 1 : 0;
  return mixColour(c, ks);
}
/** ledFn(ui, block, status) for an LED wired straight to a source (bind 'src') or by colour channels. */
export function linkLedFn(X, c) {
  if (hasChans(c)) {
    const list = ledChans(c).map(([ch]) => [ch, c.chans[ch]]).filter(([, r]) => isRef(r));
    return (ui, b, st) => {
      const ks = {};
      for (const [ch, r] of list) {
        const v = readRef(X, r, ui, st, b);
        ks[ch] = v ? v.t : 0;
      }
      return mixColour(c, ks);
    };
  }
  const r = ledRef(c);
  const bin = refSig(X, r) === 'b';
  const color = c.color || '#ff2a1a';
  return (ui, b, st) => {
    const v = readRef(X, r, ui, st, b);
    if (!v) return null;
    if (bin) return v.t > 0.5 ? true : null;
    if (v.t < 0.02) return null;
    return v.t > 0.98 ? true : dimmed(color, v.t);
  };
}

// ------------------------------------------------------------------ encoders
export const ENC_STEPS = 24; // detent steps over the knob's 0..1
/** Encoder state {last, acc} moved to position v: whole steps turned (CW positive). */
export function encSteps(st, v, wrap, steps = ENC_STEPS) {
  if (st.last == null) {
    st.last = v;
    return 0;
  }
  let d = v - st.last;
  if (wrap) {
    if (d > 0.5) d -= 1;
    else if (d < -0.5) d += 1;
  }
  st.last = v;
  st.acc = (st.acc || 0) + d * steps;
  const n = st.acc > 0 ? Math.floor(st.acc + 1e-6) : Math.ceil(st.acc - 1e-6);
  st.acc -= n;
  return n;
}
export const PULSE_MS = 45, PULSE_GAP = 35;
/** Pulses CW / CCW params one step at a time: set(param, value). Returns turn(key, enc, steps). */
export function makePulser(set) {
  const q = new Map();
  const run = (k, e) => {
    const s = q.get(k);
    if (!s.n) {
      s.busy = false;
      return;
    }
    const dir = s.n > 0 ? 1 : -1;
    s.n -= dir;
    s.busy = true;
    const p = dir > 0 ? e.cw : e.ccw;
    set(p, 1);
    setTimeout(() => {
      set(p, 0);
      setTimeout(() => run(k, e), PULSE_GAP);
    }, PULSE_MS);
  };
  return (k, e, n) => {
    let s = q.get(k);
    if (!s) q.set(k, (s = { n: 0, busy: false }));
    if (s.n && Math.sign(s.n) !== Math.sign(n)) s.n = 0; // turned back: drop what was still to come
    s.n = clamp(s.n + n, -8, 8);
    if (!s.busy) run(k, e);
  };
}
/** ledFn for an encoder's ring wired in the diagram: {v}, {leds} and / or {col} (factory-ring.js), null to follow the knob. */
export function ringFn(X, c) {
  return (ui, b, st) => ringOut(c, (r) => readRef(X, r, ui, st, b), isRef);
}
export const ringWired = (c) => isEnc(c) && !!c.ring && ringAnyWired(c, isRef);

// ------------------------------------------------------------------ where a design uses its sources
/** Every direct link of design D: [{ref, dst: {led, ch} | {jout} | {screen, si} | {cin}}]. */
export function linksOf(D) {
  const out = [];
  for (const c of D.ctls || []) {
    if (c.kind === 'led') {
      if (hasChans(c)) for (const [ch] of ledChans(c)) isRef(c.chans[ch]) && out.push({ ref: c.chans[ch], dst: { led: c.id, ch } });
      else if (ledRef(c)) out.push({ ref: ledRef(c), dst: { led: c.id } });
    }
    if (c.kind === 'screen' && c.sio) (c.sio.ins || []).forEach((p, i) => isRef(p.from) && out.push({ ref: p.from, dst: { screen: c.id, si: i } }));
    if (isRef(c.from)) out.push({ ref: c.from, dst: { cin: c.id } });
    if (isEnc(c)) {
      if (isRef(c.ringFrom)) out.push({ ref: c.ringFrom, dst: { ring: c.id } });
      for (const [i, r] of Object.entries(c.ringLeds || {})) isRef(r) && out.push({ ref: r, dst: { ring: c.id, li: +i } });
    }
  }
  for (const j of D.jacks || []) if (isRef(j.from)) out.push({ ref: j.from, dst: { jout: j.id } });
  return out;
}
/** Is jack j read by a direct link (so it needs its own param on the board)? */
export const jackLinked = (D, jid) => linksOf(D).some((l) => l.ref.jack === jid);
/** Drop links whose source is gone or is jack jid (when that jack becomes an output). */
export function pruneLinks(D, X, jid) {
  const bad = (r) => !refOk(X, r) || (jid && r.jack === jid);
  for (const c of D.ctls || []) {
    if (c.kind === 'led') {
      if (c.bind === 'src' && (!isRef(c.src) || bad(c.src))) {
        c.bind = 'on';
        delete c.src;
      }
      if (c.bind && c.bind.startsWith('ctl:') && bad({ ctl: c.bind.slice(4) })) c.bind = 'on';
      if (c.chans) {
        for (const k of Object.keys(c.chans)) if (!isRef(c.chans[k]) || bad(c.chans[k])) delete c.chans[k];
        if (!Object.keys(c.chans).length) delete c.chans;
      }
    }
    if (c.from && (!isRef(c.from) || bad(c.from) || !drivable(c) || c.from.ctl === c.id)) delete c.from;
    if (c.ringFrom && (!isRef(c.ringFrom) || bad(c.ringFrom))) delete c.ringFrom;
    if (c.ringLeds) {
      for (const k of Object.keys(c.ringLeds)) if (!isRef(c.ringLeds[k]) || bad(c.ringLeds[k])) delete c.ringLeds[k];
      if (!Object.keys(c.ringLeds).length) delete c.ringLeds;
    }
    if (c.sio) for (const p of c.sio.ins || []) if (p.from && !p.from.n && (!isRef(p.from) || bad(p.from))) p.from = null;
  }
  for (const j of D.jacks || []) if (j.from && !j.from.n && isRef(j.from) && bad(j.from)) delete j.from;
}
