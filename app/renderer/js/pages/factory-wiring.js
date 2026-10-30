// Pedal Factory: the Circuit tab (templates, signal flow, stages) and the "Controls" section of the inspector
// that wires a control to the circuit. The circuit model lives in factory-circuit.js.
import { el, svg, clamp } from '../util.js';
import { STAGES, STAGE_CATS, CIRCUITS, CLIPS, COMP_TYPES, TAPER_NAMES, makeCircuit, newStage, targetsFor, targetInfo, mapTo, targetLabel, mapValue } from './factory-circuit.js';

const uid = (p) => p + Math.random().toString(36).slice(2, 8);
const fmt = (v, info) => {
  if (info && info.opts && info.i) return info.opts[Math.round(v) - (info.min || 0)] ?? String(Math.round(v));
  if (info && info.i) return String(Math.round(v));
  return Math.abs(v) >= 100 ? String(Math.round(v)) : String(Math.round(v * 100) / 100);
};
const KNOBLIKE = new Set(['knob', 'trim', 'slider', 'pedal']);

// ------------------------------------------------------------------ circuit templates onto a design
/**
 * Loads circuit template `id` into design D and wires matching controls: existing knobs, toggles, footswitches
 * and LEDs are reused in reading order, missing ones are added (place(c) picks a spot), extra knobs go.
 */
export function applyCircuit(D, id, place) {
  const { circuit, wants } = makeCircuit(id);
  D.circuit = circuit;
  const order = (a, b) => a.y - b.y || a.x - b.x;
  const add = (c) => {
    D.ctls.push(c);
    if (place) Object.assign(c, place(c));
    return c;
  };
  const knob = (o) => Object.assign({ id: uid('k'), kind: 'knob', x: 0, y: 0, style: 'boss', r: 8, value: 0.5, ticks: false, labelPos: 'below' }, o);
  const W = D.enc.w, H = D.enc.h;
  // knobs: reuse the ones there are (reading order), add or drop the rest
  const knobs = D.ctls.filter((c) => c.kind === 'knob').sort(order);
  const added = wants.knobs.length > knobs.length;
  const used = wants.knobs.map((w, i) => {
    const k = knobs[i] || knob({ r: knobs[0]?.r || 8, style: knobs[0]?.style || 'boss' });
    if (!knobs[i]) D.ctls.push(k);
    const info = targetInfo(circuit, w.to) || {};
    k.label = w.label;
    k.param = '';
    k.map = mapTo(circuit, w.to);
    const dv = circuit.stages.find((s) => w.to.startsWith(s.id + '.'));
    const key = w.to.split('.')[1];
    const cur = dv ? dv.params[key] ?? info.def : info.def;
    if (cur != null && info.max != null) k.value = clamp(info.l && info.min > 0 ? Math.log(cur / info.min) / Math.log(info.max / info.min) : (cur - info.min) / (info.max - info.min || 1), 0, 1);
    return k;
  });
  for (const k of knobs.slice(wants.knobs.length)) D.ctls.splice(D.ctls.indexOf(k), 1);
  // new knobs: lay them all out again in rows across the top, in the template's order
  if (added) {
    const n = used.length;
    const r = n <= 3 && W > 60 ? 8 : n <= 4 ? 6.5 : 5.5;
    const per = Math.max(1, Math.min(n, Math.floor((W - 6) / (r * 2 + 9))));
    let bottom = 0;
    used.forEach((k, i) => {
      const row = Math.floor(i / per), inRow = Math.min(per, n - row * per), j = i - row * per;
      const step = Math.min((W - 6) / inRow, r * 2 + 16);
      k.r = r;
      k.x = Math.round((W / 2 + (j - (inRow - 1) / 2) * step) * 2) / 2;
      k.y = Math.round((r + 7 + row * (r * 2 + 13)) * 2) / 2;
      bottom = Math.max(bottom, k.y + r + 8);
    });
    // keep the printed name clear of the knobs
    for (const t of [D.title, D.sub]) if (t && !t.hidden && t.text && t.y - t.size * 0.6 < bottom) t.y = Math.round(bottom + t.size * 0.8 + (t === D.sub ? D.title.size : 0));
  }
  // toggles and selectors
  const tg = D.ctls.filter((c) => c.kind === 'toggle' || c.kind === 'sel').sort(order);
  wants.toggles.forEach((w, i) => {
    const n = w.opts.length;
    const t = tg[i] || add({ id: uid('t'), kind: n > 3 ? 'sel' : 'toggle', x: 0, y: 0, ways: Math.min(3, n), n, orient: 'v', opts: [], pos: 0, label: '', labelPos: 'none' });
    if (t.kind === 'toggle') t.ways = clamp(n, 2, 3);
    else t.n = n;
    t.opts = w.opts.slice();
    t.pos = 0;
    t.map = mapTo(circuit, w.to, w.vals ? { values: w.vals } : { max: (targetInfo(circuit, w.to)?.min ?? 0) + n - 1 });
    if (!t.label && t.labelPos === 'none') t.label = w.label;
  });
  for (const t of tg.slice(wants.toggles.length)) t.map = { to: '' };
  // footswitches: stage switches if the template has them, else bypass (+ tap on a second one)
  let foots = D.ctls.filter((c) => c.kind === 'foot').sort((a, b) => a.x - b.x || a.y - b.y);
  const fw = wants.foots.length ? wants.foots : [{ label: '', to: 'bypass' }, ...(wants.tap && foots.length > 1 ? [{ label: 'TAP', to: wants.tap.id + '.tap' }] : [])];
  if (fw.length > foots.length) {
    // more needed: add them, then a row along the bottom edge, left to right
    for (let i = foots.length; i < fw.length; i++) D.ctls.push({ id: uid('f'), kind: 'foot', x: 0, y: 0, style: 'stomp', r: 7, label: '', labelPos: 'none' });
    foots = D.ctls.filter((c) => c.kind === 'foot');
    foots.forEach((f, i) => {
      f.x = Math.round(((W * (i + 1)) / (foots.length + 1)) * 2) / 2;
      f.y = Math.round((H - (f.r || 7) - 9) * 2) / 2;
    });
  }
  fw.forEach((w, i) => {
    const f = foots[i];
    f.map = { to: w.to };
    if (w.label && (f.labelPos === 'none' || !f.label)) Object.assign(f, { label: w.label, labelPos: 'below' });
  });
  for (const f of foots.slice(fw.length)) f.map = { to: '' };
  // a treadle for wah style circuits
  if (wants.pedal) {
    const p = D.ctls.find((c) => c.kind === 'pedal') || add({ id: uid('p'), kind: 'pedal', x: 0, y: 0, w: Math.min(44, D.enc.w * 0.6), h: Math.min(64, D.enc.h * 0.5), value: 0.5, color: '#1b1c1f', logo: '', label: '', labelPos: 'none' });
    p.map = mapTo(circuit, wants.pedal.to);
  }
  // LEDs follow the stage switches, or the pedal being on; stage switches get one each
  let leds = D.ctls.filter((c) => c.kind === 'led').sort((a, b) => a.x - b.x || a.y - b.y);
  if (wants.foots.length > 1 && leds.length < foots.length) {
    const col = leds[0]?.color || '#ff2a1a';
    for (const l of leds) D.ctls.splice(D.ctls.indexOf(l), 1);
    leds = foots.map((f) => ({ id: uid('l'), kind: 'led', x: f.x, y: Math.round(f.y - (f.r || 7) - 9), r: 2.5, color: col, on: true, label: '', labelPos: 'none' }));
    D.ctls.push(...leds);
  }
  const sw = D.ctls.filter((c) => c.kind === 'foot' && c.map && c.map.to && c.map.to.endsWith('.on')).sort((a, b) => a.x - b.x);
  leds.forEach((l, i) => (l.bind = sw[i] ? 'ctl:' + sw[i].id : 'on'));
  // DIP switches keep their own wiring if it still points somewhere
  for (const c of D.ctls) if (c.kind === 'dip') c.maps = (c.maps || []).map((m) => (m && targetInfo(circuit, m.to) ? m : null));
  for (const c of D.ctls) if (c.kind === 'button' && (!c.map || !targetInfo(circuit, c.map.to))) c.map = { to: '' };
  return D;
}

// ------------------------------------------------------------------ the Circuit tab
/** H: inspector helpers from factory.js plus commit / rerender / place / select / testing. */
export function renderCircuitPane(host, D, H) {
  const C = D.circuit;
  host.textContent = '';
  // templates
  const s0 = H.sec(host, 'Start from a circuit');
  el('p', { class: 'fz-note fz-note-top' }, s0).textContent = 'One click sets up the sound and the knobs to match. Undo puts your old circuit back.';
  const grid = el('div', { class: 'fz-ctpls' }, s0);
  for (const t of CIRCUITS) {
    const b = el('button', { class: 'fz-ctpl' + (C.tpl === t.id ? ' on' : ''), 'data-circuit': t.id, title: t.desc }, grid);
    const first = STAGES[t.stages[0][0]];
    b.classList.add('cat-' + (first ? first.cat : 'util'));
    el('b', {}, b).textContent = t.name;
    el('small', {}, b).textContent = t.desc;
    b.onclick = () => {
      applyCircuit(D, t.id, H.place);
      H.commit();
      H.rerender(true);
    };
  }

  // signal flow
  const s1 = H.sec(host, 'Signal flow');
  flowView(s1, D, H);

  // stages
  const s2 = H.sec(host, 'Stages');
  if (!C.stages.length) el('p', { class: 'fz-note' }, s2).textContent = 'No stages: the pedal passes your sound through clean. Add one below.';
  C.stages.forEach((s, i) => stageCard(s2, D, s, i, H));
  const s3 = H.sec(host, 'Add a stage');
  for (const [cat, name] of Object.entries(STAGE_CATS)) {
    const row = el('div', { class: 'fz-addrow' }, s3);
    el('span', { class: 'fz-addcat cat-' + cat }, row).textContent = name;
    const chips = el('div', { class: 'fz-chips' }, row);
    for (const [k, st] of Object.entries(STAGES)) {
      if (st.cat !== cat) continue;
      const b = el('button', { class: `chip sm fz-addblock cat-${cat}`, 'data-stage': k }, chips);
      b.textContent = st.name;
      b.onclick = () => {
        C.stages.push(newStage(k));
        C.tpl = '';
        H.commit();
        H.rerender(true);
      };
    }
  }
  // options
  const s4 = H.sec(host, 'Output');
  H.check(s4, 'Wet / dry mix', C.mix, (v) => (C.mix = v), true);
  if (C.mix) H.slider(s4, 'Mix', C.mixDef ?? 1, 0, 1, 0.01, (v) => (C.mixDef = v));
  el('p', { class: 'fz-note' }, s4).textContent = 'The mix blends your dry signal with the whole chain. Map a knob to "Wet / dry mix" to control it.';

  // wiring overview
  const s5 = H.sec(host, 'Wiring');
  const list = el('div', { class: 'fz-wirelist' }, s5);
  const ctls = D.ctls.filter((c) => c.kind !== 'screen' && c.kind !== 'led');
  if (!ctls.length) el('p', { class: 'fz-note' }, list).textContent = 'Add knobs and switches in the Parts tab, then wire them here.';
  for (const c of ctls) {
    const r = el('div', { class: 'fz-wire' + (H.isSel(c.id) ? ' on' : ''), 'data-wire': c.id }, list);
    const nm = el('button', { class: 'fz-wire-n', title: 'Select' }, r);
    nm.textContent = H.name(c);
    nm.onclick = () => H.select(c.id);
    if (c.kind === 'dip') {
      const n = (c.maps || []).filter((m) => m && m.to).length;
      el('span', { class: 'fz-wire-t' }, r).textContent = `${n} of ${c.n} switches wired`;
      continue;
    }
    const opts = targetsFor(C, c.kind).map((t) => [t[0], t[1]]);
    const s = el('select', { class: 'fz-wire-sel' }, r);
    for (const [v, t] of opts) el('option', { value: v }, s).textContent = t;
    s.value = c.map ? c.map.to || '' : c.kind === 'foot' ? 'bypass' : '';
    s.onchange = () => {
      c.map = mapTo(C, s.value, c.kind === 'toggle' || c.kind === 'sel' ? stepRange(C, s.value, c) : {});
      H.commit();
      H.rerender(false);
    };
  }
}
// switches with options: one target step per position
function stepRange(C, to, c) {
  const info = targetInfo(C, to);
  const n = c.kind === 'toggle' ? c.ways : c.n || 4;
  if (info && info.i && info.max - info.min >= 1) return { max: Math.min(info.max, info.min + n - 1) };
  return {};
}

function flowView(host, D, H) {
  const C = D.circuit;
  const wrap = el('div', { class: 'fz-flow' }, host);
  const node = (txt, cls) => {
    const n = el('div', { class: 'fz-fnode ' + cls }, wrap);
    n.textContent = txt;
    return n;
  };
  node('Guitar in', 'io');
  // group consecutive parallel stages into lanes
  const groups = [];
  C.stages.forEach((s) => {
    if (s.par && groups.length) groups[groups.length - 1].push(s);
    else groups.push([s]);
  });
  for (const g of groups) {
    const row = el('div', { class: 'fz-frow' + (g.length > 1 ? ' par' : '') }, wrap);
    for (const s of g) {
      const st = STAGES[s.type];
      const b = el('button', { class: `fz-fstage cat-${st.cat}` + (s.on === false ? ' off' : ''), 'data-flow': s.id, title: s.on === false ? 'Off: click to turn on' : 'Click to turn off' }, row);
      el('i', {}, b);
      el('span', {}, b).textContent = st.name;
      const n = D.ctls.filter((c) => (c.map && c.map.to && c.map.to.startsWith(s.id + '.')) || (c.maps || []).some((m) => m && m.to && m.to.startsWith(s.id + '.'))).length;
      if (n) el('em', {}, b).textContent = n;
      b.onclick = () => {
        s.on = s.on === false;
        H.commit();
        H.rerender(false);
      };
    }
  }
  if (C.mix) node('Dry / wet mix', 'mix');
  node('Out to amp', 'io');
}

function stageCard(host, D, s, i, H) {
  const C = D.circuit;
  const st = STAGES[s.type];
  const card = el('div', { class: `fz-stage-card cat-${st.cat}` + (s.on === false ? ' off' : ''), 'data-stagecard': s.id }, host);
  const head = el('div', { class: 'fz-stage-head' }, card);
  el('i', { class: 'bar' }, head);
  const m = el('div', { class: 'm' }, head);
  el('b', {}, m).textContent = `${i + 1}. ${st.name}`;
  el('small', {}, m).textContent = STAGE_CATS[st.cat] + (s.par ? ' · parallel' : '');
  const acts = el('div', { class: 'acts' }, head);
  const sw = el('label', { class: 'switch', title: 'Stage on / off' }, acts);
  const cb = el('input', { type: 'checkbox' }, sw);
  cb.checked = s.on !== false;
  el('span', {}, sw);
  cb.onchange = () => {
    s.on = cb.checked;
    H.commit();
    H.rerender(false);
  };
  const mv = (d) => () => {
    const j = i + d;
    if (j < 0 || j >= C.stages.length) return;
    [C.stages[i], C.stages[j]] = [C.stages[j], C.stages[i]];
    H.commit();
    H.rerender(false);
  };
  el('button', { class: 'fz-lbtn', title: 'Move up', onclick: mv(-1) }, acts, '<i class="ic fz-ic-up"></i>');
  el('button', { class: 'fz-lbtn', title: 'Move down', onclick: mv(1) }, acts, '<i class="ic ic-down"></i>');
  el('button', { class: 'fz-lbtn', title: 'Remove', 'data-remove': s.id, onclick: () => { C.stages.splice(i, 1); C.tpl = ''; H.commit(); H.rerender(true); } }, acts, '<i class="ic ic-x"></i>');
  const open = H.openStage === s.id;
  const tg = el('button', { class: 'fz-stage-more' + (open ? ' on' : ''), title: 'Settings' }, head, '<i class="ic ic-down"></i>');
  tg.onclick = () => {
    H.setOpenStage(open ? null : s.id);
    H.rerender(false);
  };
  if (!open) return;
  const body = el('div', { class: 'fz-stage-body' }, card);
  if (st.algo === 'drive') H.selectField(body, 'Clipping', CLIPS, s.voice || st.opts.clip, (v) => (s.voice = v));
  if (st.algo === 'comp') H.seg(body, 'Type', COMP_TYPES, s.voice || 'ota', (v) => (s.voice = v), false);
  if (i > 0) H.check(body, 'Parallel', s.par, (v) => (s.par = v), true);
  if (s.par || C.stages[i + 1]?.par) H.slider(body, 'Blend', s.lvl ?? 1, 0, 2, 0.01, (v) => (s.lvl = v));
  const mapped = new Map();
  for (const c of D.ctls) {
    if (c.map && c.map.to && c.map.to.startsWith(s.id + '.')) mapped.set(c.map.to.split('.')[1], H.name(c));
    (c.maps || []).forEach((mm, k) => mm && mm.to && mm.to.startsWith(s.id + '.') && mapped.set(mm.to.split('.')[1], `${H.name(c)} ${k + 1}`));
  }
  for (const p of st.params) {
    const v = s.params[p.key] ?? p.def;
    if (mapped.has(p.key)) {
      const r = H.row(body, p.label);
      el('span', { class: 'fz-mapped' }, r).textContent = 'Set by ' + mapped.get(p.key);
      continue;
    }
    if (p.opts && p.i) H.selectField(body, p.label, p.opts.map((o, k) => [p.min + k, o]), v, (x) => (s.params[p.key] = +x));
    else H.slider(body, p.label, v, p.min, p.max, p.i ? 1 : (p.max - p.min) / 200, (x) => (s.params[p.key] = x));
  }
  el('p', { class: 'fz-note' }, body).textContent = 'Values here are fixed inside the pedal. Wire a knob to a value to play with it.';
}

// ------------------------------------------------------------------ inspector: wiring for one control
export function wiringSection(host, D, c, H) {
  const C = D.circuit;
  if (c.kind === 'screen') return;
  if (c.kind === 'led') return ledSection(host, D, c, H);
  if (c.kind === 'dip') return dipSection(host, D, c, H);
  const s = H.sec(host, 'Controls');
  s.classList.add('fz-wiring');
  const cur = c.map ? c.map.to || '' : c.kind === 'foot' ? 'bypass' : '';
  const opts = targetsFor(C, c.kind).map((t) => [t[0], t[1]]);
  if (cur && !opts.some((o) => o[0] === cur)) opts.push([cur, 'Missing stage']);
  H.selectField(s, 'Drives', opts, cur, (v) => (c.map = mapTo(C, v, c.kind === 'toggle' || c.kind === 'sel' ? stepRange(C, v, c) : {})), true).classList.add('fz-param');
  const m = c.map;
  const info = m && targetInfo(C, m.to);
  if (!m || !m.to || !info || info.tap) {
    el('p', { class: 'fz-note' }, s).textContent = c.kind === 'foot' ? (cur === 'bypass' ? 'Turns the whole pedal on and off.' : cur.endsWith('.tap') ? 'Tap a few times to set the delay time.' : 'Pick what this footswitch does.') : 'Pick a value in the circuit for this control.';
    return;
  }
  const isSwitch = c.kind === 'toggle' || c.kind === 'sel' || c.kind === 'button' || c.kind === 'foot';
  const n = c.kind === 'toggle' ? c.ways : c.kind === 'sel' ? c.n || 4 : isSwitch ? 2 : 0;
  const lo = info.min ?? 0, hi = info.max ?? 1;
  const step = info.i ? 1 : (hi - lo) / 200;
  if (n && Array.isArray(m.values)) {
    // one value per position
    for (let k = 0; k < n; k++) {
      const lbl = (c.opts && c.opts[k]) || (n === 2 ? (k ? 'On' : 'Off') : 'Pos ' + (k + 1));
      const val = m.values[k] ?? lo;
      if (info.opts && info.i) H.selectField(s, lbl, info.opts.map((o, j) => [lo + j, o]), val, (x) => { const vv = m.values.slice(); vv[k] = +x; c.map = { ...m, values: vv }; });
      else H.slider(s, lbl, val, lo, hi, step, (x) => { const vv = m.values.slice(); vv[k] = x; c.map = { ...m, values: vv }; });
    }
    el('div', { class: 'fz-actrow' }, s).appendChild(el('button', { class: 'btn small', onclick: () => { const mm = { ...c.map }; delete mm.values; c.map = mm; H.changed(false); H.rerender(false); } }, null, 'Use a range instead'));
    return;
  }
  H.slider(s, n ? 'Off / first' : 'From', m.min ?? lo, lo, hi, step, (x) => (c.map = { ...c.map, min: x }));
  H.slider(s, n ? 'On / last' : 'To', m.max ?? hi, lo, hi, step, (x) => (c.map = { ...c.map, max: x }));
  if (!n) H.seg(s, 'Taper', TAPER_NAMES, m.taper || 'lin', (v) => (c.map = { ...c.map, taper: v }), false);
  H.check(s, 'Invert', m.invert, (v) => (c.map = { ...c.map, invert: v }));
  if (n > 1 && (c.kind === 'toggle' || c.kind === 'sel'))
    el('div', { class: 'fz-actrow' }, s).appendChild(el('button', { class: 'btn small', onclick: () => { c.map = { ...c.map, values: [...Array(n)].map((_, k) => mapValue(c.map, info, k / (n - 1))) }; H.changed(false); H.rerender(false); } }, null, 'Set each position'));
  // what it does right now
  const t = KNOBLIKE.has(c.kind) ? c.value ?? 0.5 : n ? (c.kind === 'toggle' || c.kind === 'sel' ? (c.pos || 0) / Math.max(1, n - 1) : c.on ? 1 : 0) : 0;
  el('p', { class: 'fz-note' }, s).textContent = `Now: ${info.label || ''} = ${fmt(mapValue(m, info, t), info)}${info.unit ? ' ' + info.unit : ''}`;
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
      // off keeps the circuit's default, on goes to the far end
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
  for (const o of D.ctls) if (o.kind !== 'led' && o.kind !== 'screen' && o.kind !== 'dip' && o.id !== c.id) opts.push(['ctl:' + o.id, H.name(o) + ' is on / up']);
  for (const st of D.circuit.stages) if (STAGES[st.type]?.tap) opts.push(['tap:' + st.id, STAGES[st.type].name + ' tempo (blinks)']);
  H.selectField(s, 'Shows', opts, c.bind || 'on', (v) => (c.bind = v));
}

/** Expression jack: which control it moves. */
export function expSection(host, D, j, H) {
  const s = H.sec(host, 'Expression');
  const opts = [['', 'First treadle or knob']];
  for (const c of D.ctls) if (KNOBLIKE.has(c.kind)) opts.push([c.id, H.name(c)]);
  H.selectField(s, 'Moves', opts, j.drive || '', (v) => (j.drive = v || undefined));
  el('p', { class: 'fz-note' }, s).textContent = 'Plug an expression pedal in on the board and it turns this control.';
}
export { targetLabel };
