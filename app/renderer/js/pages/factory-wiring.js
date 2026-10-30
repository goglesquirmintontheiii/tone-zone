// Pedal Factory: the "Controls" section of the inspector. A control can drive any number of circuit inputs,
// each with its own range, taper, invert and offset; an input driven by several controls adds them up (or takes
// the highest, lowest or average). DIP switches wire each switch on its own, LEDs pick what they show,
// expression jacks move a control or drive circuit inputs. The model lives in factory-circuit.js.
import { el } from '../util.js';
import { isRef, hasChans, ledChans } from './circuit-links.js';
import { CIRCUITS, TAPER_NAMES, COMBINES, targetsFor, targetInfo, mapTo, targetLabel, mapValue, mappingsOf, driversOf, addMapping, removeMapping, instOf, isV3, circuitOutputs, outKey, screenIO, SCREEN_PORTS, jackIsOut, uid } from './factory-circuit.js';
import { hasTap } from './circuit-parts.js';
import { renderCircuitTab, useCircuit } from './factory-circuits.js';
import { circuitRec } from './circuit-library.js';

const fmt = (v, info) => {
  if (info && info.opts && info.i) return info.opts[Math.round(v) - (info.min || 0)] ?? String(Math.round(v));
  if (info && info.i) return String(Math.round(v));
  return Math.abs(v) >= 100 ? String(Math.round(v)) : String(Math.round(v * 100) / 100);
};
const KNOBLIKE = new Set(['knob', 'trim', 'slider', 'pedal']);

/** Older entry point: the classic circuit `id` replaces the pedal's circuits. */
export function applyCircuit(D, id) {
  const rec = circuitRec('b.c-' + id) || circuitRec('b.c-overdrive');
  if (!isV3(D.circuit)) return D;
  D.circuit.insts = [];
  D.circuit.wires = [];
  for (const c of D.ctls) {
    if (c.map && c.map.to !== 'bypass') c.map = c.kind === 'foot' ? { to: 'bypass' } : { to: '' };
    delete c.more;
  }
  useCircuit(rec);
  return D;
}
/** The Circuit tab (the circuit list). */
export const renderCircuitPane = (host, D, H) => renderCircuitTab(host, H);

// switches with options: one target step per position
function stepRange(C, to, c) {
  const info = targetInfo(C, to);
  const n = c.kind === 'toggle' ? c.ways : c.n || 4;
  if (info && info.i && info.max - info.min >= 1) return { max: Math.min(info.max, info.min + n - 1) };
  return {};
}

// ------------------------------------------------------------------ inspector: wiring for one control
export function wiringSection(host, D, c, H) {
  const C = D.circuit;
  if (c.kind === 'screen') return screenSection(host, D, c, H);
  if (c.kind === 'led') return ledSection(host, D, c, H);
  if (c.kind === 'dip') return dipSection(host, D, c, H);
  const s = H.sec(host, 'Controls');
  s.classList.add('fz-wiring');
  const isSwitch = c.kind === 'toggle' || c.kind === 'sel' || c.kind === 'button' || c.kind === 'foot';
  const n = c.kind === 'toggle' ? c.ways : c.kind === 'sel' ? c.n || 4 : isSwitch ? 2 : 0;
  const all = targetsFor(C, c.kind).map((t) => [t[0], t[1]]);
  const list = [c.map || (c.kind === 'foot' ? { to: 'bypass' } : { to: '' }), ...(c.more || [])];
  const setAt = (i, m) => {
    if (i === 0) c.map = m;
    else {
      const more = (c.more || []).slice();
      more[i - 1] = m;
      c.more = more;
    }
  };
  list.forEach((m, i) => {
    const box = el('div', { class: 'fz-mapbox', 'data-map': i }, s);
    const cur = m ? m.to || '' : '';
    const opts = i ? all.filter((t) => t[0] !== 'bypass') : all.slice();
    if (cur && !opts.some((o) => o[0] === cur)) opts.push([cur, 'Missing']);
    const sel = H.selectField(box, i ? 'And drives' : 'Drives', opts, cur, (v) => setAt(i, mapTo(C, v, c.kind === 'toggle' || c.kind === 'sel' ? stepRange(C, v, c) : {})), true);
    sel.classList.add('fz-param');
    if (i > 0 || (list.length > 1 && cur)) {
      const x = el('button', { class: 'fz-lbtn fz-maprm', title: 'Stop driving this', 'data-unmap': i }, sel.parentNode, '<i class="ic ic-x"></i>');
      x.onclick = () => {
        removeMapping(c, i);
        H.changed(false);
        H.rerender(false);
      };
    }
    const info = m && targetInfo(C, m.to);
    if (!m || !m.to || !info || info.tap) {
      if (i === 0) el('p', { class: 'fz-note' }, box).textContent = c.kind === 'foot' ? (cur === 'bypass' ? 'Turns the whole pedal on and off.' : cur.endsWith('.tap') ? 'Tap a few times to set the tempo.' : 'Pick what this footswitch does.') : 'Pick a circuit input for this control, or drag a wire to one in the wiring diagram.';
      return;
    }
    const lo = info.min ?? 0, hi = info.max ?? 1;
    const step = info.i ? 1 : (hi - lo) / 200;
    const upd = (k) => (x) => setAt(i, { ...list[i], [k]: x });
    if (n && Array.isArray(m.values)) {
      for (let k = 0; k < n; k++) {
        const lbl = (c.opts && c.opts[k]) || (n === 2 ? (k ? 'On' : 'Off') : 'Pos ' + (k + 1));
        const v = m.values[k] ?? lo;
        const setV = (x) => {
          const vv = m.values.slice();
          vv[k] = x;
          setAt(i, { ...m, values: vv });
        };
        if (info.opts && info.i) H.selectField(box, lbl, info.opts.map((o, j) => [lo + j, o]), v, (x) => setV(+x));
        else H.slider(box, lbl, v, lo, hi, step, setV);
      }
      el('div', { class: 'fz-actrow' }, box).appendChild(el('button', { class: 'btn small', onclick: () => { const mm = { ...m }; delete mm.values; setAt(i, mm); H.changed(false); H.rerender(false); } }, null, 'Use a range instead'));
    } else {
      H.slider(box, n ? 'Off / first' : 'From', m.min ?? lo, lo, hi, step, upd('min'));
      H.slider(box, n ? 'On / last' : 'To', m.max ?? hi, lo, hi, step, upd('max'));
      if (!n) H.seg(box, 'Taper', TAPER_NAMES, m.taper || 'lin', upd('taper'), false);
      H.check(box, 'Invert', m.invert, upd('invert'));
      if (!info.i) H.slider(box, 'Offset', m.offset || 0, -(hi - lo), hi - lo, step, upd('offset'));
      if (n > 1 && (c.kind === 'toggle' || c.kind === 'sel'))
        el('div', { class: 'fz-actrow' }, box).appendChild(el('button', { class: 'btn small', onclick: () => { setAt(i, { ...m, values: [...Array(n)].map((_, k) => mapValue(m, info, k / (n - 1))) }); H.changed(false); H.rerender(false); } }, null, 'Set each position'));
    }
    // several controls on one input
    const drv = isV3(C) ? driversOf(D, m.to) : [];
    if (drv.length > 1) {
      const others = drv.filter((d) => d.c !== c || d.m !== m).map((d) => (d.c ? H.name(d.c) : (d.j.label || 'EXP') + ' jack'));
      H.selectField(box, 'With ' + others.slice(0, 2).join(', ') + (others.length > 2 ? '...' : ''), COMBINES, (C.combine || {})[m.to] || 'avg', (v) => (C.combine = { ...(C.combine || {}), [m.to]: v })).classList.add('fz-combine');
    }
    const t = KNOBLIKE.has(c.kind) ? c.value ?? 0.5 : n ? (c.kind === 'toggle' || c.kind === 'sel' ? (c.pos || 0) / Math.max(1, n - 1) : c.on ? 1 : 0) : 0;
    el('p', { class: 'fz-note' }, box).textContent = `Now: ${targetLabel(C, m.to)} = ${fmt(mapValue(m, info, t), info)}`;
  });
  // one more target
  const free = all.filter((t) => t[0] && t[0] !== 'bypass' && !list.some((m) => m && m.to === t[0]));
  if (list[0] && list[0].to && list[0].to !== 'bypass' && !list[0].to.endsWith('.tap') && free.length) {
    const ar = el('div', { class: 'fz-actrow' }, s);
    const b = el('button', { class: 'btn small', 'data-act': 'addmap', title: 'This control can turn several things at once' }, ar, '<i class="ic ic-plus"></i>Drive something else too');
    b.onclick = () => {
      const pick = free.find((t) => !t[0].endsWith('.on') && !t[0].endsWith('.tap')) || free[0];
      addMapping(D, c, pick[0], c.kind === 'toggle' || c.kind === 'sel' ? stepRange(C, pick[0], c) : {});
      H.changed(false);
      H.rerender(false);
    };
  }
}

function dipSection(host, D, c, H) {
  const C = D.circuit;
  const s = H.sec(host, 'Controls');
  s.classList.add('fz-wiring');
  el('p', { class: 'fz-note fz-note-top' }, s).textContent = 'Each switch can drive something different. Off and on pick the two values.';
  const opts = targetsFor(C, 'dip').filter((t) => t[0] !== 'bypass').map((t) => [t[0], t[1]]);
  const n = c.n || 4;
  for (let i = 0; i < n; i++) {
    const m = (c.maps || [])[i] || null;
    const box = el('div', { class: 'fz-dipmap', 'data-dip': i }, s);
    const head = el('div', { class: 'fz-dipmap-h' }, box);
    el('b', {}, head).textContent = String(i + 1);
    const sel = el('select', { class: 'fz-dip-sel' }, head);
    for (const [v, t] of opts) el('option', { value: v }, sel).textContent = t;
    sel.value = m ? m.to : '';
    sel.onchange = () => {
      const maps = (c.maps || []).slice();
      while (maps.length < n) maps.push(null);
      // off keeps the default, on goes to the far end
      const info = sel.value && targetInfo(C, sel.value);
      maps[i] = info ? mapTo(C, sel.value, { min: info.def ?? info.min, max: info.def === info.max ? info.min : info.max, taper: 'lin' }) : null;
      c.maps = maps;
      H.changed(false);
      H.rerender(false);
    };
    const info = m && targetInfo(C, m.to);
    if (info) {
      const lo = info.min ?? 0, hi = info.max ?? 1;
      const step = info.i ? 1 : (hi - lo) / 100;
      const set = (k) => (x) => {
        const maps = c.maps.slice();
        maps[i] = { ...maps[i], [k]: x };
        c.maps = maps;
      };
      H.slider(box, 'Off', m.min ?? lo, lo, hi, step, set('min'));
      H.slider(box, 'On', m.max ?? hi, lo, hi, step, set('max'));
    }
  }
}

function ledSection(host, D, c, H) {
  const s = H.sec(host, 'Lights when');
  const opts = [['on', 'The pedal is on'], ['always', 'Always'], ['off', 'Never']];
  for (const o of D.ctls) if (o.kind !== 'led' && o.kind !== 'screen' && o.kind !== 'dip' && o.kind !== 'xy' && o.id !== c.id) opts.push(['ctl:' + o.id, H.name(o) + ' is on / up']);
  const C = D.circuit;
  if (isV3(C)) for (const i of C.insts) if (hasTap(i.graph)) opts.push(['tap:' + i.id, i.name + ' tempo (blinks)']);
  // circuit outputs: binary lights it, analog sets how bright
  if (isV3(C)) for (const o of circuitOutputs(D)) opts.push(['cv:' + o.key, o.name + (o.sig === 'b' ? ' is on' : ' (brightness)')]);
  if (c.bind === 'src') opts.push(['src', 'What it is wired to in the diagram']);
  if (hasChans(c)) {
    el('p', { class: 'fz-note fz-note-top' }, s).textContent = 'Each colour is wired on its own in the wiring diagram: the LED shows the mix. Take the colour wires off to use this again.';
    return;
  }
  H.selectField(s, 'Shows', opts, c.bind || 'on', (v) => {
    c.bind = v;
    if (v !== 'src') delete c.src;
  });
  if (ledChans(c)) el('p', { class: 'fz-note' }, s).textContent = 'Or wire each colour on its own in the wiring diagram (analog sets how bright, binary on or off).';
  if ((c.bind || '').startsWith('cv:')) el('p', { class: 'fz-note' }, s).textContent = 'Lit by a circuit output, in Test mode and on the board. Wire outputs to LEDs in the wiring diagram too.';
}

// ------------------------------------------------------------------ screens: inputs and outputs for the script
function screenSection(host, D, c, H) {
  const C = D.circuit;
  const sio = screenIO(c);
  const s = H.sec(host, 'Inputs and outputs');
  s.classList.add('fz-wiring');
  el('p', { class: 'fz-note fz-note-top' }, s).textContent = `Up to ${SCREEN_PORTS} inputs and ${SCREEN_PORTS} outputs. The script reads input(1), input("name") and sets output(1, value). Wire them in the wiring diagram.`;
  const outs = isV3(C) ? circuitOutputs(D) : [];
  const SIGS = [['n', 'Analog'], ['b', 'Binary']];
  const portRow = (list, i, dir) => {
    const p = list[i];
    const box = el('div', { class: 'fz-mapbox', ['data-s' + dir]: i }, s);
    const nm = H.textField(box, (dir === 'in' ? 'Input ' : 'Output ') + (i + 1), p.name, (v) => (p.name = v.slice(0, 16)));
    const x = el('button', { class: 'fz-lbtn fz-maprm', title: 'Remove it' }, nm.parentNode, '<i class="ic ic-x"></i>');
    x.onclick = () => {
      list.splice(i, 1);
      H.changed(false);
      H.rerender(false);
    };
    H.selectField(box, 'Signal', SIGS, p.sig === 'b' ? 'b' : 'n', (v) => (p.sig = v));
    if (dir === 'in') {
      const linked = isRef(p.from) && !p.from.n;
      H.selectField(box, 'Reads', [['', 'Nothing'], ...(linked ? [['@link', 'What it is wired to in the diagram']] : []), ...outs.map((o) => [o.key, o.name])], linked ? '@link' : outKey(p.from), (v) => {
        if (v === '@link') return;
        const o = outs.find((x2) => x2.key === v);
        p.from = o ? { n: o.inst.id, p: o.n.id } : null;
      });
    } else {
      const all = targetsFor(C, 'knob').filter((t) => t[0] && t[2] && !t[2].tap && !t[2].extra);
      (p.maps || []).forEach((m, k) => {
        const sel = H.selectField(box, k ? 'And drives' : 'Drives', all.map((t) => [t[0], t[1]]), m.to, (v) => {
          p.maps = p.maps.slice();
          p.maps[k] = { to: v, raw: true };
        });
        const rm = el('button', { class: 'fz-lbtn fz-maprm', title: 'Stop driving this' }, sel.parentNode, '<i class="ic ic-x"></i>');
        rm.onclick = () => {
          p.maps = p.maps.filter((_, q) => q !== k);
          H.changed(false);
          H.rerender(false);
        };
      });
      const free = all.find((t) => !(p.maps || []).some((m) => m.to === t[0]));
      if (free) el('div', { class: 'fz-actrow' }, box).appendChild(el('button', { class: 'btn small', onclick: () => { p.maps = [...(p.maps || []), { to: free[0], raw: true }]; H.changed(false); H.rerender(false); } }, null, '<i class="ic ic-plus"></i>Drive a circuit input'));
    }
  };
  sio.ins.forEach((_, i) => portRow(sio.ins, i, 'in'));
  sio.outs.forEach((_, i) => portRow(sio.outs, i, 'out'));
  const ar = el('div', { class: 'fz-actrow' }, s);
  const add = (dir) => {
    const list = dir === 'in' ? sio.ins : sio.outs;
    if (list.length >= SCREEN_PORTS) return;
    list.push({ id: uid('p'), name: (dir === 'in' ? 'In ' : 'Out ') + (list.length + 1), sig: 'n' });
    H.changed(false);
    H.rerender(false);
  };
  if (sio.ins.length < SCREEN_PORTS) el('button', { class: 'btn small', 'data-act': 'sin', onclick: () => add('in') }, ar, '<i class="ic ic-plus"></i>Input');
  if (sio.outs.length < SCREEN_PORTS) el('button', { class: 'btn small', 'data-act': 'sout', onclick: () => add('out') }, ar, '<i class="ic ic-plus"></i>Output');
}

/** Expression jack: which control it moves, or which circuit inputs it drives. */
export function expSection(host, D, j, H) {
  const C = D.circuit;
  const fsw = j.kind === 'fsw';
  const s = H.sec(host, fsw ? 'Footswitch jack' : 'Expression');
  // a jack driven by a circuit output is an output: it moves what is plugged in on the board
  const outs = isV3(C) ? circuitOutputs(D) : [];
  H.selectField(s, 'Direction', [['in', fsw ? 'In: a footswitch plugs in here' : 'In: an expression pedal plugs in here'], ['out', 'Out: what is wired to it drives it']], jackIsOut(j) ? 'out' : 'in', (v) => {
    if (v === 'out') {
      const o = outs.find((x) => (fsw ? x.sig === 'b' : x.sig === 'n')) || outs[0];
      j.from = o ? { n: o.inst.id, p: o.n.id } : { n: '', p: '' };
      delete j.maps;
      delete j.drive;
      j.dir = 'out';
    } else {
      delete j.from;
      delete j.dir;
    }
  }, true);
  if (jackIsOut(j)) {
    const linked = isRef(j.from) && !j.from.n;
    H.selectField(s, 'Sends', [['', 'Nothing'], ...(linked ? [['@link', 'What it is wired to in the diagram']] : []), ...outs.map((o) => [o.key, o.name])], linked ? '@link' : outKey(j.from), (v) => {
      if (v === '@link') return;
      const o = outs.find((x) => x.key === v);
      j.from = o ? { n: o.inst.id, p: o.n.id } : { n: '', p: '' };
      j.dir = 'out';
    });
    el('p', { class: 'fz-note' }, s).textContent = fsw ? 'On the board, a control cable from here presses whatever it is plugged into when the output turns on.' : 'On the board, a control cable from here moves whatever it is plugged into, like an expression pedal (the output\'s Lowest to Highest is heel to toe).';
    return;
  }
  const maps = j.maps || [];
  if (fsw) el('p', { class: 'fz-note fz-note-top' }, s).textContent = maps.length ? 'Tip and ring of a footswitch plugged in here drive:' : 'Wire the tip or ring to circuit inputs in the wiring diagram, or pick one here.';
  else if (!maps.length) {
    const opts = [['', 'First treadle or knob'], ['none', 'Nothing']];
    for (const c of D.ctls) if (KNOBLIKE.has(c.kind)) opts.push([c.id, H.name(c)]);
    H.selectField(s, 'Moves', opts, j.drive || '', (v) => (j.drive = v || undefined));
    el('p', { class: 'fz-note' }, s).textContent = 'Plug an expression pedal in on the board and it turns this control. Or wire the jack straight to circuit inputs:';
  } else el('p', { class: 'fz-note fz-note-top' }, s).textContent = 'An expression pedal plugged in here drives:';
  const all = isV3(C) ? targetsFor(C, 'knob').filter((t) => t[0] && t[2] && !t[2].tap).map((t) => [t[0], t[1]]) : [];
  maps.forEach((m, i) => {
    const box = el('div', { class: 'fz-mapbox', 'data-expmap': i }, s);
    const set = (nm) => {
      const mm = (j.maps || []).slice();
      mm[i] = nm;
      j.maps = mm;
    };
    const sel = H.selectField(box, fsw ? ((m.ch || 't') === 'r' ? 'Ring drives' : 'Tip drives') : 'Drives', all, m.to, (v) => set(mapTo(C, v, fsw ? { ch: m.ch || 't' } : {})), true);
    const x = el('button', { class: 'fz-lbtn fz-maprm', title: 'Stop driving this' }, sel.parentNode, '<i class="ic ic-x"></i>');
    x.onclick = () => {
      j.maps = (j.maps || []).filter((_, k) => k !== i);
      H.changed(false);
      H.rerender(false);
    };
    const info = targetInfo(C, m.to);
    if (!info) return;
    if (fsw) H.selectField(box, 'Switch', [['t', 'Tip'], ['r', 'Ring']], m.ch || 't', (v) => set({ ...m, ch: v }));
    const lo = info.min ?? 0, hi = info.max ?? 1, step = info.i ? 1 : (hi - lo) / 200;
    H.slider(box, fsw ? 'Up' : 'Heel', m.min ?? lo, lo, hi, step, (v) => set({ ...m, min: v }));
    H.slider(box, fsw ? 'Pressed' : 'Toe', m.max ?? hi, lo, hi, step, (v) => set({ ...m, max: v }));
  });
  if (all.length) {
    const ar = el('div', { class: 'fz-actrow' }, s);
    el('button', { class: 'btn small', 'data-act': 'expmap', onclick: () => { const t = all.find((x) => !maps.some((m) => m.to === x[0])) || all[0]; j.maps = [...maps, mapTo(C, t[0], fsw ? { ch: 't' } : {})]; H.changed(false); H.rerender(false); } }, ar, '<i class="ic ic-plus"></i>Drive a circuit input');
  }
}
/** Output and input jacks: plain, or the SEND / RETURN of an effects loop (paired by number). */
export function loopSection(host, D, j, H) {
  const s = H.sec(host, 'Effects loop');
  const send = j.kind === 'out';
  H.selectField(s, 'Use', [['', send ? 'Normal output' : 'Normal input'], [send ? 'send' : 'return', send ? 'Loop send' : 'Loop return']], j.loop || '', (v) => {
    if (v) {
      j.loop = v;
      // pair with the first loop number the other side has without a partner
      const other = D.jacks.filter((x) => x !== j && x.loop === (send ? 'return' : 'send'));
      const mine = D.jacks.filter((x) => x !== j && x.loop === v).map((x) => x.loopN || 1);
      j.loopN = (other.map((x) => x.loopN || 1).find((n) => !mine.includes(n))) || Math.max(0, ...mine, ...other.map((x) => x.loopN || 1)) + 1;
    } else {
      delete j.loop;
      delete j.loopN;
    }
  }, true);
  if (!j.loop) {
    el('p', { class: 'fz-note' }, s).textContent = send ? 'Make it a loop send to cable other pedals in the middle of this one.' : 'Make it a loop return to bring other pedals back into this one.';
    return;
  }
  const nums = [...new Set([1, 2, 3, 4, ...D.jacks.filter((x) => x.loop).map((x) => x.loopN || 1)])].sort((a, b) => a - b);
  H.selectField(s, 'Loop', nums.map((n) => [n, 'Loop ' + n]), j.loopN || 1, (v) => (j.loopN = +v));
  const partner = D.jacks.find((x) => x !== j && x.loop === (send ? 'return' : 'send') && (x.loopN || 1) === (j.loopN || 1));
  el('p', { class: 'fz-note' }, s).textContent = (send
    ? 'Wire a signal to this send in the wiring diagram (say after the drive). On the board, cable it through other pedals into the '
    : 'Wire this return into the rest of the circuits in the wiring diagram. On the board it takes what comes back from the ') + (partner ? `${partner.label || (send ? 'RETURN' : 'SEND')} jack` : (send ? 'return' : 'send') + ' of the same loop (add one)') + '. No extra delay: it all runs in the same audio cycle. With nothing plugged in, the return gets the send.';
}
export { targetLabel, CIRCUITS, instOf, mappingsOf };
