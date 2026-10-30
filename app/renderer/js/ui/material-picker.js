// Material picker: material, then type (if any), finish and colour or stain, with small previews.
// materialPicker(parent, { value, onChange(spec, live), title, allowStock, collapsible, key, open, wear })
import { el } from '../util.js';
import { MATERIALS, normalize, finishesFor, paletteFor, colorHex, specLabel, swatchSVG, material, wearFor } from '../gfx/materials.js';

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
    for (const f of fins) tileBtn(gf, { ...spec, f: f.id }, f.name, spec.f === f.id, () => emit({ ...spec, f: f.id }), f.id);
    const pal = paletteFor(spec);
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
      const pick = el('input', { type: 'color', class: 'mtp-pick', title: 'Any colour' }, row);
      pick.value = colorHex(spec) || '#888888';
      pick.oninput = () => emit({ ...spec, c: pick.value }, true);
      pick.onchange = () => emit({ ...spec, c: pick.value });
    }
    if (o.wear) wearSection(body);
    if (o.extra) o.extra(body, spec);
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
      const r = el('input', { type: 'range', min: 0.05, max: 1, step: 0.05, 'data-wear-amt': x.id }, row);
      r.value = w[x.id];
      const paint = () => r.style.setProperty('--p', ((r.value - 0.05) / 0.95) * 100 + '%');
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
