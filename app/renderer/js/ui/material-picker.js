// Material picker: material, then type (if any), finish, see-through amount (glass and acrylic) and colour or stain,
// with small previews. The colour section only shows when the finish takes a colour.
// materialPicker(parent, { value, onChange(spec, live), title, allowStock, collapsible, key, open, wear })
import { el } from '../util.js';
import { MATERIALS, normalize, finishesFor, paletteFor, colorHex, colorMode, hasOpacity, opacityOf, specLabel, swatchSVG, material, wearFor, MULTI, BURST_PRESETS } from '../gfx/materials.js';

const openState = new Map(); // key -> open, so the picker stays open across inspector redraws

export function materialPicker(parent, o) {
  const root = el('div', { class: 'mtp' + (o.compact ? ' compact' : '') }, parent);
  if (o.key) root.dataset.mtp = o.key;
  let spec = normalize(o.value, o.fallback);
  const isOpen = () => (o.collapsible ? openState.get(o.key) ?? !!o.open : true);

  const emit = (next, live) => {
    spec = next.m === 'stock' ? next : normalize(next);
    o.onChange && o.onChange(spec, !!live);
    if (!live) draw();
    else updateHead();
  };

  let headLabel = null, headSw = null;
  function updateHead() {
    if (!headLabel) return;
    headLabel.textContent = specLabel(spec);
    const sw = swatchSVG(spec, 26);
    headSw.replaceWith(sw);
    headSw = sw;
  }

  function draw() {
    root.textContent = '';
    const head = el('button', { class: 'mtp-head' + (o.collapsible ? '' : ' static'), type: 'button' }, root);
    headSw = swatchSVG(spec, 26);
    head.appendChild(headSw);
    const tt = el('span', { class: 'mtp-tt' }, head);
    if (o.title) el('b', {}, tt).textContent = o.title;
    headLabel = el('small', {}, tt);
    headLabel.textContent = specLabel(spec);
    if (o.collapsible) {
      el('i', { class: 'ic ic-down mtp-caret' + (isOpen() ? ' open' : '') }, head);
      head.onclick = () => {
        openState.set(o.key, !isOpen());
        draw();
      };
    }
    if (!isOpen()) return;
    const body = el('div', { class: 'mtp-body' }, root);

    // materials
    const g = grid(body, 'Material', 'mtp-mats');
    if (o.allowStock) tileBtn(g, { m: 'stock' }, 'Stock', spec.m === 'stock', () => emit({ m: 'stock' }), 'stock');
    for (const M of MATERIALS) {
      const d = normalize({ m: M.id, c: spec.c });
      tileBtn(g, d, M.name, spec.m === M.id, () => {
        if (spec.m === M.id) return;
        // keep the colour when the new material takes one
        emit({ m: M.id, s: M.def.s, f: M.def.f, c: /^#/.test(spec.c || '') ? spec.c : M.def.c, w: spec.w });
      }, M.id);
    }
    if (spec.m === 'stock') {
      el('p', { class: 'mtp-note' }, body).textContent = 'The part keeps its original look.';
      return;
    }
    const M = material(spec.m);
    if (M.subs) {
      const gs = grid(body, spec.m === 'wood' ? 'Wood' : spec.m === 'metal' ? 'Metal' : 'Type', 'mtp-subs');
      for (const sub of M.subs) tileBtn(gs, { ...spec, s: sub.id }, sub.name, spec.s === sub.id, () => emit({ ...spec, s: sub.id }), sub.id);
    }
    const fins = finishesFor(spec.m);
    const gf = grid(body, 'Finish', 'mtp-fins');
    // a new finish starts from its own see-through amount
    for (const f of fins) tileBtn(gf, { ...spec, f: f.id, t: null }, f.name, spec.f === f.id, () => emit({ ...spec, f: f.id, t: null }), f.id);
    if (hasOpacity(spec)) opacitySection(body);
    const mode = colorMode(spec);
    const pal = mode !== 'none' && paletteFor(spec);
    if (pal) {
      const sec = el('div', { class: 'mtp-sec' }, body);
      el('h6', {}, sec).textContent = spec.m === 'wood' ? 'Stain' : 'Colour';
      const row = el('div', { class: 'mtp-cols' }, sec);
      const cur = String(spec.c || '').toLowerCase();
      for (const p of pal) {
        const on = cur === p.id || cur === p.hex.toLowerCase();
        const b = el('button', { class: 'mtp-col' + (on ? ' on' : '') + (/burst/.test(p.id) ? ' burst' : ''), type: 'button', title: p.name, 'data-col': p.id }, row);
        b.style.setProperty('--c', p.hex);
        b.onclick = () => emit({ ...spec, c: spec.m === 'wood' ? p.id : p.hex });
      }
      if (mode === 'free') {
        const pick = el('input', { type: 'color', class: 'mtp-pick', title: 'Any colour' }, row);
        pick.value = colorHex(spec) || '#888888';
        pick.oninput = () => emit({ ...spec, c: pick.value }, true);
        pick.onchange = () => emit({ ...spec, c: pick.value });
      }
    }
    if (o.multi !== false) multiSection(body);
    if (o.wear) wearSection(body);
    if (o.extra) o.extra(body, spec);
  }
  // glass and acrylic: how see-through it is, from clear to solid
  function opacitySection(body) {
    const sec = el('div', { class: 'mtp-sec' }, body);
    el('h6', {}, sec).textContent = 'Transparency';
    const row = el('div', { class: 'mtp-amt mtp-op' }, sec);
    const lab = el('span', {}, row);
    const r = el('input', { type: 'range', min: 0, max: 1, step: 0.01, 'data-opacity': 1, title: 'Clear to solid' }, row);
    r.value = opacityOf(spec);
    const paint = () => {
      r.style.setProperty('--p', r.value * 100 + '%');
      lab.textContent = +r.value <= 0.02 ? 'Fully clear' : +r.value >= 0.98 ? 'Solid' : Math.round((1 - r.value) * 100) + '% clear';
    };
    paint();
    r.oninput = () => { paint(); emit({ ...spec, t: +r.value }, true); };
    r.onchange = () => emit({ ...spec, t: +r.value });
    const ends = el('div', { class: 'mtp-ends' }, sec);
    el('span', {}, ends).textContent = 'Clear';
    el('span', {}, ends).textContent = 'Solid';
  }
  // multicolour: fades, bursts, gradients... over the material
  function multiSection(body) {
    const sec = el('div', { class: 'mtp-sec' }, body);
    el('h6', {}, sec).textContent = 'Multicolour';
    const chips = el('div', { class: 'mtp-wear' }, sec);
    const mc = spec.mc;
    const modes = [{ id: '', name: 'Off' }, ...MULTI];
    for (const m of modes) {
      const b = el('button', { class: 'chip sm' + ((mc ? mc.mode : '') === m.id ? ' on' : ''), type: 'button', 'data-multi': m.id || 'off' }, chips);
      b.textContent = m.name;
      b.onclick = () => {
        if (!m.id) return emit({ ...spec, mc: null });
        const keep = mc && mc.stops.length >= m.min ? mc.stops.slice(0, m.max) : m.def;
        emit({ ...spec, mc: { mode: m.id, stops: m.id === 'burst' && (!mc || mc.mode !== 'burst') ? m.def : keep, angle: mc ? mc.angle : 0 } });
      };
    }
    if (!mc) return;
    const M = MULTI.find((x) => x.id === mc.mode);
    const setMc = (patch, live) => emit({ ...spec, mc: { ...mc, ...patch } }, live);
    if (mc.mode === 'burst') {
      const pr = el('div', { class: 'mtp-wear', style: { marginTop: '6px' } }, sec);
      for (const [name, stops] of BURST_PRESETS) {
        const b = el('button', { class: 'chip sm', type: 'button', 'data-burst': name }, pr);
        b.textContent = name;
        b.onclick = () => setMc({ stops });
      }
    }
    if (M.max) {
      const row = el('div', { class: 'mtp-stops' }, sec);
      const labels = mc.mode === 'burst' ? ['Centre', 'Middle', 'Edge'] : null;
      mc.stops.forEach((c, i) => {
        const w = el('label', { class: 'mtp-stop', title: labels ? labels[i] : 'Colour ' + (i + 1) }, row);
        const inp = el('input', { type: 'color', class: 'mtp-pick', 'data-stop': i }, w);
        inp.value = c;
        const upd = (live) => { const st = [...mc.stops]; st[i] = inp.value; setMc({ stops: st }, live); };
        inp.oninput = () => upd(true);
        inp.onchange = () => upd(false);
        if (labels) el('small', {}, w).textContent = labels[i];
      });
      if (mc.stops.length < M.max) el('button', { class: 'icon-btn sm', type: 'button', title: 'Add a colour', onclick: () => setMc({ stops: [...mc.stops, mc.stops[mc.stops.length - 1]] }) }, row, '<i class="ic ic-plus"></i>');
      if (mc.stops.length > M.min) el('button', { class: 'icon-btn sm', type: 'button', title: 'Remove a colour', onclick: () => setMc({ stops: mc.stops.slice(0, -1) }) }, row, '<i class="ic ic-minus"></i>');
    }
    if (M.angle) {
      const row = el('div', { class: 'mtp-amt' }, sec);
      el('span', {}, row).textContent = 'Angle ' + mc.angle + '°';
      const r = el('input', { type: 'range', min: 0, max: 355, step: 5, 'data-multi-angle': 1 }, row);
      r.value = mc.angle;
      const paint = () => r.style.setProperty('--p', (r.value / 355) * 100 + '%');
      paint();
      r.oninput = () => { paint(); row.firstChild.textContent = 'Angle ' + r.value + '°'; setMc({ angle: +r.value }, true); };
      r.onchange = () => setMc({ angle: +r.value });
    }
  }
  // stackable wear layers, each with an amount
  function wearSection(body) {
    const sec = el('div', { class: 'mtp-sec' }, body);
    el('h6', {}, sec).textContent = 'Wear';
    const chips = el('div', { class: 'mtp-wear' }, sec);
    const w = spec.w || {};
    const set = (id, v, live) => {
      const nw = { ...(spec.w || {}) };
      if (v > 0) nw[id] = v;
      else delete nw[id];
      emit({ ...spec, w: nw }, live);
    };
    for (const x of wearFor(spec.m)) {
      const b = el('button', { class: 'chip sm' + (w[x.id] ? ' on' : ''), type: 'button', 'data-wear': x.id }, chips);
      b.textContent = x.name;
      b.onclick = () => set(x.id, w[x.id] ? 0 : 0.5);
    }
    for (const x of wearFor(spec.m)) {
      if (!w[x.id]) continue;
      const row = el('div', { class: 'mtp-amt' }, sec);
      el('span', {}, row).textContent = x.name;
      // from a few faint marks at the left to heavily worn at the right
      const r = el('input', { type: 'range', min: 0.02, max: 1, step: 0.01, 'data-wear-amt': x.id, title: 'Light to heavy' }, row);
      r.value = w[x.id];
      const paint = () => r.style.setProperty('--p', ((r.value - 0.02) / 0.98) * 100 + '%');
      paint();
      r.oninput = () => { paint(); set(x.id, +r.value, true); };
      r.onchange = () => set(x.id, +r.value);
    }
  }
  function grid(body, title, cls) {
    const sec = el('div', { class: 'mtp-sec' }, body);
    el('h6', {}, sec).textContent = title;
    return el('div', { class: 'mtp-grid ' + cls }, sec);
  }
  function tileBtn(g, s, name, on, click, id) {
    const b = el('button', { class: 'mtp-tile' + (on ? ' on' : ''), type: 'button', title: name, 'data-v': id }, g);
    b.appendChild(swatchSVG(s, 30));
    el('span', {}, b).textContent = name;
    b.onclick = click;
    return b;
  }
  draw();
  return {
    el: root,
    get value() {
      return spec;
    },
    set(v) {
      spec = v && v.m === 'stock' ? v : normalize(v);
      draw();
    },
  };
}
