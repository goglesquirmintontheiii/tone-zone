// Block browser sidebar: search, filters (type / category / brand / channels / source / favourites),
// favourites pinned to the top of each group, lazily-rendered thumbnails and pointer-based drag-to-board.
import { el, svg, esc, bus, toast } from './util.js';
import { allDefs, getPackDefs, CATEGORIES, portsFor, defaultVariant, kindOf, KINDS, isOriginal, brandOf } from './catalog/index.js';
import { renderForm } from './gfx/forms.js';
import { thumbImg } from './gfx/raster.js';
import { state } from './state.js';

let editorRef = null;
let listEl = null;
const F = loadFilters();

function loadFilters() {
  const base = { query: '', kind: 'All', cats: [], brands: [], channels: 'Any', source: 'Any', favOnly: false, open: false };
  try {
    return Object.assign(base, JSON.parse(localStorage.getItem('tz.browserFilters') || '{}'), { query: '' });
  } catch {
    return base;
  }
}
function saveFilters() {
  try {
    const { query, ...rest } = F;
    localStorage.setItem('tz.browserFilters', JSON.stringify(rest));
  } catch {}
}

// ------------------------------------------------------------------ favourites
export function favorites() {
  return new Set(state.settings.favorites || []);
}
export function isFavorite(id) {
  return (state.settings.favorites || []).includes(id);
}
export function toggleFavorite(id) {
  const f = favorites();
  if (f.has(id)) f.delete(id);
  else f.add(id);
  state.settings.favorites = [...f];
  window.tz.settings.set({ favorites: state.settings.favorites });
  bus.emit('favorites');
}

export function thumbnail(d, size = 44) {
  const s = svg('svg', { xmlns: 'http://www.w3.org/2000/svg' });
  const g = svg('g', {}, s);
  const rdef = Object.create(d);
  rdef.ports = portsFor(d, defaultVariant(d));
  try {
    const res = renderForm({ g, views: new Map(), flip: false, thumb: true }, rdef);
    s.setAttribute('viewBox', `-14 -14 ${res.w + 28} ${res.h + 28}`);
    const ar = res.w / res.h;
    s.setAttribute('width', ar > 1 ? size : size * ar);
    s.setAttribute('height', ar > 1 ? size / ar : size);
  } catch (e) {
    console.warn('thumb', d.id, e);
  }
  return s;
}

function stereoOf(d) {
  return d.stereo === 'both' ? 'both' : d.stereo === 'stereo' ? 'stereo' : 'mono';
}
function sourceOf(d) {
  if (d.pack) return 'Imported';
  if (isOriginal(d)) return 'Tone Zone original';
  return 'Inspired by';
}

function matches(d, ignore) {
  if (F.favOnly && ignore !== 'fav' && !isFavorite(d.id)) return false;
  if (F.kind !== 'All' && ignore !== 'kind' && kindOf(d) !== F.kind) return false;
  if (F.cats.length && ignore !== 'cats' && !F.cats.includes(d.packCat || d.cat)) return false;
  if (F.brands.length && ignore !== 'brands' && !F.brands.includes(brandOf(d))) return false;
  if (F.channels !== 'Any' && ignore !== 'channels') {
    const s = stereoOf(d);
    if (F.channels === 'Stereo' && s === 'mono') return false;
    if (F.channels === 'Mono' && s === 'stereo') return false;
  }
  if (F.source !== 'Any' && ignore !== 'source' && sourceOf(d) !== F.source) return false;
  if (F.query) return F.query.split(/\s+/).every((w) => d.search.includes(w));
  return true;
}

function sourceDefs() {
  return [...getPackDefs(), ...allDefs().filter((d) => !d.pack)];
}

export function initBrowser(editor) {
  editorRef = editor;
  const head = document.querySelector('#browser .browser-head');
  const chips = document.getElementById('catChips');
  listEl = document.getElementById('blockList');
  chips.innerHTML = '';
  chips.className = 'filter-bar';
  // quick row: favourites + filter toggle + kind chips
  const row = el('div', { class: 'filter-row' }, chips);
  const favBtn = el('button', { class: 'chip fav' + (F.favOnly ? ' on' : ''), title: 'Show favourites only' }, row, '<i class="ic ic-star"></i>Favourites');
  favBtn.onclick = () => { F.favOnly = !F.favOnly; favBtn.classList.toggle('on', F.favOnly); changed(); };
  const fBtn = el('button', { class: 'chip' + (F.open ? ' on' : ''), title: 'More filters' }, row, '<i class="ic ic-filter"></i>Filters<span class="fcount"></span>');
  fBtn.onclick = () => { F.open = !F.open; fBtn.classList.toggle('on', F.open); panel.classList.toggle('open', F.open); saveFilters(); };
  const kinds = el('div', { class: 'filter-row kinds' }, chips);
  for (const k of ['All', ...KINDS]) {
    const plural = { All: 'All', Utility: 'Utilities', 'Multi-FX': 'Multi-FX' };
    const b = el('button', { class: 'chip' + (F.kind === k ? ' on' : '') }, kinds, plural[k] || k + 's');
    b.onclick = () => { F.kind = k; kinds.querySelectorAll('.chip').forEach((x) => x.classList.toggle('on', x === b)); changed(); };
  }
  const panel = el('div', { class: 'filter-panel' + (F.open ? ' open' : '') }, chips);
  const active = el('div', { class: 'filter-active' }, chips);

  function section(title) {
    const s = el('div', { class: 'fsec' }, panel);
    el('h5', {}, s).textContent = title;
    return el('div', { class: 'fopts' }, s);
  }
  const segSec = (title, key, opts) => {
    const box = section(title);
    for (const o of opts) {
      const b = el('button', { class: 'chip sm' + (F[key] === o ? ' on' : '') }, box, o);
      b.onclick = () => { F[key] = o; box.querySelectorAll('.chip').forEach((x) => x.classList.toggle('on', x === b)); changed(); };
    }
    return box;
  };
  segSec('Channels', 'channels', ['Any', 'Mono', 'Stereo']);
  segSec('Source', 'source', ['Any', 'Inspired by', 'Tone Zone original', 'Imported']);
  const catBox = section('Effect type');
  const brandSec = section('Inspired by brand');
  const brandSearch = el('input', { placeholder: 'Find brand…', class: 'brand-find', spellcheck: 'false' }, brandSec);
  const brandBox = el('div', { class: 'brand-list' }, brandSec);
  brandSearch.oninput = () => renderBrands();

  function renderCats() {
    catBox.innerHTML = '';
    const counts = new Map();
    for (const d of sourceDefs()) if (matches(d, 'cats')) counts.set(d.packCat || d.cat, (counts.get(d.packCat || d.cat) || 0) + 1);
    for (const c of CATEGORIES) {
      if (!counts.has(c) && !F.cats.includes(c)) continue;
      const b = el('button', { class: 'chip sm' + (F.cats.includes(c) ? ' on' : '') }, catBox, `${esc(c)} <em>${counts.get(c) || 0}</em>`);
      b.onclick = () => { F.cats = F.cats.includes(c) ? F.cats.filter((x) => x !== c) : [...F.cats, c]; changed(); };
    }
  }
  function renderBrands() {
    brandBox.innerHTML = '';
    const counts = new Map();
    for (const d of sourceDefs()) {
      const b = brandOf(d);
      if (!b || isOriginal(d) || d.pack) continue;
      if (matches(d, 'brands')) counts.set(b, (counts.get(b) || 0) + 1);
      else if (!counts.has(b)) counts.set(b, 0);
    }
    const q = brandSearch.value.trim().toLowerCase();
    [...counts.keys()].sort((a, b) => a.localeCompare(b)).filter((b) => !q || b.toLowerCase().includes(q)).forEach((b) => {
      const on = F.brands.includes(b);
      const r = el('label', { class: 'brand-opt' + (on ? ' on' : '') + (counts.get(b) ? '' : ' empty') }, brandBox, `<input type="checkbox" ${on ? 'checked' : ''}><span>${esc(b)}</span><em>${counts.get(b)}</em>`);
      r.querySelector('input').onchange = (e) => { F.brands = e.target.checked ? [...F.brands, b] : F.brands.filter((x) => x !== b); changed(); };
    });
  }
  function renderActive() {
    active.innerHTML = '';
    const tags = [];
    if (F.favOnly) tags.push(['★ Favourites', () => { F.favOnly = false; favBtn.classList.remove('on'); }]);
    if (F.kind !== 'All') tags.push([{ Utility: 'Utilities', 'Multi-FX': 'Multi-FX' }[F.kind] || F.kind + 's', () => { F.kind = 'All'; kinds.querySelectorAll('.chip').forEach((x, i) => x.classList.toggle('on', i === 0)); }]);
    for (const c of F.cats) tags.push([c, () => (F.cats = F.cats.filter((x) => x !== c))]);
    for (const b of F.brands) tags.push([b, () => (F.brands = F.brands.filter((x) => x !== b))]);
    if (F.channels !== 'Any') tags.push([F.channels, () => (F.channels = 'Any')]);
    if (F.source !== 'Any') tags.push([F.source, () => (F.source = 'Any')]);
    const n = tags.length - (F.favOnly ? 1 : 0) - (F.kind !== 'All' ? 1 : 0);
    fBtn.querySelector('.fcount').textContent = n > 0 ? ' · ' + n : '';
    if (!tags.length) return;
    for (const [t, clear] of tags) {
      const x = el('button', { class: 'ftag' }, active, `${esc(t)}<i>×</i>`);
      x.onclick = () => { clear(); changed(true); };
    }
    if (tags.length > 1) {
      const c = el('button', { class: 'ftag clear' }, active, 'Clear all');
      c.onclick = () => {
        Object.assign(F, { kind: 'All', cats: [], brands: [], channels: 'Any', source: 'Any', favOnly: false });
        favBtn.classList.remove('on');
        kinds.querySelectorAll('.chip').forEach((x, i) => x.classList.toggle('on', i === 0));
        changed(true);
      };
    }
  }
  function changed(resync) {
    saveFilters();
    renderCats();
    renderBrands();
    renderActive();
    // keep the segmented sections in sync after "clear"
    panel.querySelectorAll('.fsec').forEach((s) => {
      const title = s.querySelector('h5').textContent;
      const key = title === 'Channels' ? 'channels' : title === 'Source' ? 'source' : null;
      if (key) s.querySelectorAll('.chip').forEach((b) => b.classList.toggle('on', b.textContent === F[key]));
    });
    renderList();
  }
  const inp = document.getElementById('blockSearch');
  inp.addEventListener('input', () => {
    F.query = inp.value.trim().toLowerCase();
    renderCats();
    renderBrands();
    renderList();
  });
  bus.on('packs', () => changed());
  bus.on('catalog', () => changed());
  bus.on('favorites', () => renderList());
  void head;
  changed();
}

// ------------------------------------------------------------------ virtualised list
// Only the rows in view exist in the DOM (plus a margin); thumbnails are cached PNGs (gfx/raster.js). With ~1000
// blocks a fully built list of live SVG pedals made every frame of the app expensive.
const ROW_H = 58, HEAD_H = 36, COUNT_H = 24, OVERSCAN = 6;
let rows = []; // { type: 'count' | 'head' | 'item', y, h, d?, k? }
let totalH = 0;
let spacer = null, layer = null;
const live = new Map(); // row index -> element
let vQueued = false;

function makeItem(d, favs) {
  const fav = favs.has(d.id);
  const item = el('div', { class: 'bl-item' + (fav ? ' is-fav' : ''), title: d.desc || d.ref || '' });
  item._def = d;
  const th = el('div', { class: 'thumb' }, item);
  th.appendChild(thumbImg(d, 42));
  const meta = el('div', { class: 'meta' }, item);
  el('div', { class: 'name' }, meta).textContent = d.name;
  const src = sourceOf(d);
  el('div', { class: 'sub' }, meta).textContent = d.pack ? d.ref : src === 'Inspired by' && d.ref ? 'Inspired by ' + d.ref : d.typeName || d.cat;
  const st = stereoOf(d);
  if (st !== 'mono') el('span', { class: 'badge st', title: st === 'both' ? 'Mono or stereo' : 'Stereo' }, item).textContent = st === 'both' ? 'M/S' : 'ST';
  else if (d.pack) el('span', { class: 'badge' }, item).textContent = d.algo === 'nam' ? 'NAM' : 'IR';
  const star = el('button', { class: 'fav-star' + (fav ? ' on' : ''), title: fav ? 'Remove from favourites' : 'Add to favourites' }, item, fav ? '★' : '☆');
  star.addEventListener('pointerdown', (e) => e.stopPropagation());
  star.onclick = (e) => {
    e.stopPropagation();
    toggleFavorite(d.id);
  };
  // docked: pointer drag (instant); popped out into another window: native drag-and-drop across windows
  item.addEventListener('pointerdown', (e) => item.ownerDocument === document && startDrag(e, d, item));
  item.draggable = true;
  item.addEventListener('dragstart', (e) => {
    if (item.ownerDocument === document) return e.preventDefault();
    e.dataTransfer.setData('application/x-tz-block', d.id);
    e.dataTransfer.effectAllowed = 'copy';
  });
  item.addEventListener('dblclick', () => editorRef.addNear(d.id));
  return item;
}

function drawWindow() {
  vQueued = false;
  const list = listEl;
  if (!list || !layer) return;
  const top = list.scrollTop, bot = top + (list.clientHeight || 800);
  // binary search the first visible row
  let lo = 0, hi = rows.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (rows[mid].y + rows[mid].h < top) lo = mid + 1;
    else hi = mid;
  }
  const i0 = Math.max(0, lo - OVERSCAN);
  let i1 = lo;
  while (i1 < rows.length && rows[i1].y < bot) i1++;
  i1 = Math.min(rows.length, i1 + OVERSCAN);
  for (const [i, node] of live) if (i < i0 || i >= i1) { node.remove(); live.delete(i); }
  const favs = favorites();
  for (let i = i0; i < i1; i++) {
    if (live.has(i)) continue;
    const r = rows[i];
    let node;
    if (r.type === 'count') node = el('div', { class: 'bl-count' }, null, r.text);
    else if (r.type === 'head') node = el('h4', { class: 'bl-head' }, null, esc(r.k));
    else node = makeItem(r.d, favs);
    node.classList.add('bl-row');
    node.style.transform = `translateY(${r.y}px)`;
    node.style.height = r.h + 'px';
    layer.appendChild(node);
    live.set(i, node);
  }
}
function queueWindow() {
  if (vQueued) return;
  vQueued = true;
  requestAnimationFrame(drawWindow);
}

export function renderList() {
  const list = listEl;
  if (!list) return;
  const scroll = list.scrollTop;
  list.innerHTML = '';
  live.clear();
  rows = [];
  const favs = favorites();
  const defs = sourceDefs().filter((d) => matches(d));
  const groups = new Map();
  for (const d of defs) {
    const g = d.pack ? 'Imported · ' + (d.packCat || d.cat) : d.cat;
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(d);
  }
  const order = (g) => {
    if (g.startsWith('Imported')) return -1;
    const i = CATEGORIES.indexOf(g);
    return i < 0 ? 99 : i;
  };
  const keys = [...groups.keys()].sort((a, b) => order(a) - order(b));
  if (!defs.length) {
    el('div', { class: 'empty-state', style: { margin: '20px 6px', padding: '30px 10px' } }, list, F.favOnly && !favs.size ? '<p>No favourites yet.<br>Hover a block and click the ☆ to add it.</p>' : '<p>No blocks match these filters.</p>');
    return;
  }
  let y = 0;
  rows.push({ type: 'count', y, h: COUNT_H, text: `${defs.length} block${defs.length === 1 ? '' : 's'}` });
  y += COUNT_H;
  for (const k of keys) {
    rows.push({ type: 'head', y, h: HEAD_H, k });
    y += HEAD_H;
    const items = groups.get(k).slice().sort((a, b) => (favs.has(b.id) ? 1 : 0) - (favs.has(a.id) ? 1 : 0));
    for (const d of items) {
      rows.push({ type: 'item', y, h: ROW_H, d });
      y += ROW_H;
    }
  }
  totalH = y + 12;
  spacer = el('div', { class: 'bl-spacer', style: { height: totalH + 'px' } }, list);
  layer = el('div', { class: 'bl-layer' }, spacer);
  list.scrollTop = scroll;
  if (!list._virt) {
    list._virt = true;
    list.addEventListener('scroll', queueWindow, { passive: true });
    new ResizeObserver(queueWindow).observe(list);
  }
  drawWindow();
}

// ------------------------------------------------------------------ pointer drag (no OS drag-and-drop:
// GTK's DnD adds a noticeable delay between releasing the mouse and the drop event)
function startDrag(e, d, item) {
  if (e.button !== 0) return;
  const sx = e.clientX, sy = e.clientY;
  let ghost = null;
  const board = document.getElementById('board');
  const move = (ev) => {
    if (!ghost) {
      if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < 5) return;
      ghost = el('div', { class: 'drag-ghost' }, document.body);
      ghost.appendChild(thumbImg(d, 96));
      document.body.classList.add('dragging-block');
    }
    ghost.style.transform = `translate(${ev.clientX - 48}px, ${ev.clientY - 48}px)`;
    const r = board.getBoundingClientRect();
    const over = ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom;
    ghost.classList.toggle('over', over);
  };
  const up = (ev) => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    document.body.classList.remove('dragging-block');
    if (!ghost) return;
    ghost.remove();
    const r = board.getBoundingClientRect();
    if (ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom) {
      const w = editorRef.toWorld(ev.clientX, ev.clientY);
      editorRef.addAt(d.id, w.x, w.y, true);
    }
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
  void item;
  void toast;
}
