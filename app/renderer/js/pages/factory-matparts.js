// Pedal Factory: one Material section per selected item. A switcher above the picker lists the parts of the item
// that take a material (cap, skirt, dial, nut, pedal...), so there is one picker instead of several.
import { el } from '../util.js';
import { materialPicker } from '../ui/material-picker.js';
import { JACKS } from './factory-render.js';
import { isStick } from './factory-kinds.js';

const clone = (o) => JSON.parse(JSON.stringify(o));
const isJack = (o) => !!JACKS[o.kind];
export const partKey = (c) => (isJack(c) ? 'jack' : c.part || c.kind);
const NAMES = {
  knob: 'knobs', encoder: 'encoders', trim: 'trim pots', slider: 'sliders', strip: 'touch strips', sel: 'rotary switches', steps: 'step buttons',
  toggle: 'toggles', button: 'buttons', arcade: 'arcade buttons', foot: 'footswitches', pedal: 'foot pedals', xy: 'XY pads', led: 'LEDs',
  meter: 'meters', screen: 'screens', dip: 'DIP switches', jack: 'jacks',
};

/** The parts of a control or jack that take a material: [[field, name]], the main one first. */
export function matParts(c) {
  if (isJack(c)) return c.kind === 'power' ? [] : [['mat', 'Nut']];
  switch (c.part) {
    case 'encoder': return [['mat', 'Cap']];
    case 'meter': return [['mat', c.look === 'round' ? 'Ring' : 'Bezel']];
    case 'strip': return [['mat', 'Surface']];
    case 'arcade': return [['mat', 'Cap'], ['ringMat', 'Bezel']];
    case 'steps': return [['mat', 'Buttons']];
  }
  switch (c.kind) {
    case 'knob': return [['mat', 'Cap'], ['skirtMat', 'Skirt'], ...(c.dial && c.dial !== 'none' ? [['dialMat', 'Dial']] : [])];
    case 'xy': return isStick(c) ? [['mat', c.look === 'thumb' ? 'Cap' : 'Top'], ['plateMat', 'Base']] : [['mat', 'Surface']];
    case 'trim': return [['mat', 'Body']];
    case 'toggle': return [['mat', 'Lever']];
    case 'foot': return c.style === 'rc' || c.style === 'ts' ? [['mat', 'Pad']] : [['mat', 'Cap'], ['nutMat', c.style === 'soft' ? 'Bezel' : 'Nut']];
    case 'pedal': {
      const grip = c.grip === false ? 'none' : c.grip || 'pad';
      return [['mat', 'Pedal'], ...(grip === 'none' ? [] : [['gripMat', grip === 'plate' ? 'Toe plate' : 'Grip']])];
    }
    case 'led': return [['mat', 'LED bezel']];
    case 'screen': return [['mat', 'Bezel']];
    case 'dip': return c.look === 'toggle' ? [['mat', 'Levers'], ['plateMat', 'Plate']] : [['mat', 'Body']];
    case 'slider': case 'sel': case 'button': return [['mat', 'Cap']];
  }
  return [['mat', 'Material']];
}

const current = new Map(); // item id -> the part being edited, so it stays put across inspector redraws

/** The Material section of a control or jack. H: sec, changed. */
export function materialSection(host, D, c, H) {
  const parts = matParts(c);
  if (!parts.length) return null;
  let key = current.get(c.id);
  if (!parts.some((p) => p[0] === key)) key = parts[0][0];
  const s = H.sec(host, 'Material');
  s.classList.add('fz-partmat', 'fz-mat-' + key);
  s.dataset.matpart = key;
  if (parts.length > 1) {
    const sw = el('div', { class: 'seg fz-seg fz-matparts' }, s);
    for (const [k, name] of parts) {
      const b = el('button', { class: k === key ? 'on' : '', 'data-matpart': k, title: 'Pick the material of the ' + name.toLowerCase() }, sw);
      b.textContent = name;
      b.onclick = () => {
        current.set(c.id, k);
        const box = el('div');
        s.replaceWith(box);
        materialSection(box, D, c, H);
        box.replaceWith(...box.childNodes);
      };
    }
  }
  materialPicker(s, {
    key: 'fz-part', value: c[key] || { m: 'stock' }, allowStock: true, wear: true,
    onChange: (spec, live) => {
      c[key] = spec.m === 'stock' ? null : spec;
      if (c.kind === 'knob' && !c.part && c.skirtMat === undefined) c.skirtMat = null;
      H.changed(live);
    },
  });
  const pk = partKey(c);
  const all = (pred, fields = [key]) => {
    for (const o of [...D.ctls, ...D.jacks])
      if (pred(o)) for (const f of fields) o[f] = c[f] ? clone(c[f]) : null;
    H.changed(false);
  };
  const ar = el('div', { class: 'fz-actrow' }, s);
  el('button', { class: 'btn small', 'data-apply': 'kind', onclick: () => all((o) => partKey(o) === pk && o.kind !== 'power' && matParts(o).some((p) => p[0] === key)) }, ar, 'Apply to all ' + (NAMES[pk] || 'of these'));
  if (key === 'mat') el('button', { class: 'btn small', 'data-apply': 'all', onclick: () => all((o) => o.kind !== 'power') }, ar, 'Apply to every part');
  if (pk === 'knob' && key === 'mat')
    el('button', { class: 'btn small', onclick: () => { for (const o of D.ctls) if (o.kind === 'knob' && !o.part) { o.style = c.style; o.mat = c.mat ? clone(c.mat) : null; o.skirtMat = c.skirtMat ? clone(c.skirtMat) : null; } H.changed(false); } }, ar, 'Copy cap and material to all knobs');
  return s;
}
