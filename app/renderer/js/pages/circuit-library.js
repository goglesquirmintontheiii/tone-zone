// The circuit library: built-in circuits plus the ones you save from the circuit editor (<data>/circuits, one
// JSON and one PNG each, through window.tz.circuits). Circuits live on their own, so any pedal can use them.
import { bus } from '../util.js';
import { BUILTIN } from './circuit-templates.js';
import { renderThumb } from './circuit-render.js';
import { graphCat, graphNames, clone } from './circuit-parts.js';

const user = new Map();
const thumbs = new Map();
let loading = null;
const api = () => (window.tz && window.tz.circuits) || null;
const LS = 'tz.circuits.v1';

export function loadCircuits() {
  if (loading) return loading;
  loading = (async () => {
    const a = api();
    let list = [];
    try {
      if (a) list = await a.list();
      else list = JSON.parse(localStorage.getItem(LS) || '[]');
    } catch (e) {
      console.warn('circuits', e);
    }
    for (const r of list) if (r && r.id && r.graph) user.set(r.id, r);
    bus.emit('circuits');
  })();
  return loading;
}
export const userCircuits = () => [...user.values()];
export const allCircuits = () => [...[...user.values()].sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0)), ...BUILTIN];
export const circuitRec = (id) => user.get(id) || BUILTIN.find((b) => b.id === id) || null;
/** The PNG picture of a circuit (made once for built-ins). */
export function thumbOf(rec) {
  if (rec.thumb) return rec.thumb;
  if (!thumbs.has(rec.id)) thumbs.set(rec.id, renderThumb(rec.graph));
  return thumbs.get(rec.id);
}
const slug = (s) => String(s || 'circuit').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'circuit';
export const catOf = (rec) => rec.cat || graphCat(rec.graph);
export const tagsOf = (rec) => (rec.tags || []).map((t) => String(t).trim()).filter(Boolean);

/** Save a circuit to the library (new id for built-ins or asNew). Returns the saved record. */
export async function saveCircuit(rec, { asNew = false } = {}) {
  const r = clone(rec);
  const keep = !asNew && r.id && user.has(r.id);
  if (!keep) r.id = 'u.' + slug(r.name) + '-' + Math.random().toString(36).slice(2, 7);
  delete r.builtin;
  r.name = (r.name || '').trim() || 'My circuit';
  r.tags = tagsOf(r);
  r.cat = r.cat || graphCat(r.graph);
  r.ver = (keep ? user.get(r.id).ver || 1 : 0) + 1;
  r.savedAt = Date.now();
  r.thumb = renderThumb(r.graph);
  const a = api();
  if (a) await a.save(r);
  user.set(r.id, r);
  if (!a)
    try {
      localStorage.setItem(LS, JSON.stringify([...user.values()]));
    } catch (_) {
      /* storage may be full */
    }
  thumbs.delete(r.id);
  bus.emit('circuits');
  return r;
}
export async function deleteCircuit(id) {
  if (!user.has(id)) return;
  const a = api();
  if (a) await a.remove(id);
  user.delete(id);
  if (!a)
    try {
      localStorage.setItem(LS, JSON.stringify([...user.values()]));
    } catch (_) {
      /* ignore */
    }
  bus.emit('circuits');
}
/** Every tag in use, most used first. */
export function allTags() {
  const n = new Map();
  for (const r of allCircuits()) for (const t of tagsOf(r)) n.set(t.toLowerCase(), (n.get(t.toLowerCase()) || 0) + 1);
  return [...n.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map((x) => x[0]);
}
export const allCats = () => [...new Set(allCircuits().map(catOf))].sort();
/** Search text matches the name, description, tags or the parts in it. */
export function filterCircuits({ q = '', tags = [], cat = '', mine = false } = {}) {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  return allCircuits().filter((r) => {
    if (mine && r.builtin) return false;
    if (cat && catOf(r) !== cat) return false;
    const tg = tagsOf(r).map((t) => t.toLowerCase());
    if (tags.length && !tags.every((t) => tg.includes(t))) return false;
    if (!words.length) return true;
    const hay = [r.name, r.desc, ...tg, catOf(r), ...graphNames(r.graph)].join(' ').toLowerCase();
    return words.every((w) => hay.includes(w));
  });
}
