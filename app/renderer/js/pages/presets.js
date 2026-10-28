// Presets tab: searchable / sortable grid of preset cards with board thumbnails, favourites, tags and actions.
import { el, svg, esc, bus, toast } from '../util.js';
import { state, loadPreset, newPreset, markDirty, serialize } from '../state.js';
import { getDef, portsFor, defaultVariant } from '../catalog/index.js';
import { renderForm } from '../gfx/forms.js';
import { openPreset, savePreset, refreshPresetList, updateTitle } from '../presets.js';
import { prompt, confirmDlg, showMenu, modal } from '../menus.js';

const V = { q: '', sort: 'name', filter: 'All', tags: new Set(), tagMode: 'any' };
export const GENRE_TAGS = ['rhythm', 'lead', 'clean', 'crunch', 'high-gain', 'ambient', 'simple', 'complex', 'jazz', 'worship', 'contemporary-worship', 'gospel', 'rock', 'classic-rock', 'alt-rock', 'metal', 'heavy-metal', 'classic-metal', 'deathcore', 'metalcore', 'punk', 'pop-punk', 'pop', 'experimental', 'jazz-fusion', 'edm', 'acoustic', 'country', 'country-rock', 'blues', 'funk', 'bass'];

function thumb(layout) {
  const s = svg('svg', { class: 'pc-thumb', xmlns: 'http://www.w3.org/2000/svg', preserveAspectRatio: 'xMidYMid meet' });
  const bl = layout?.b || [];
  if (!bl.length) {
    s.setAttribute('viewBox', '0 0 100 60');
    svg('text', { x: 50, y: 32, 'text-anchor': 'middle', fill: '#5b6372', 'font-size': 7 }, s, 'empty board');
    return s;
  }
  const boxes = bl.map(([type, x, y, byp]) => {
    const d = getDef(type);
    const sz = d ? sizeOf(d) : [120, 200];
    return { x, y, w: sz[0], h: sz[1], color: d ? (d.baseForm === 'cab' || d.baseForm === 'amp' ? d.tolex || '#1b1b1d' : d.color) : '#444', byp, missing: !d, form: d?.baseForm, panel: d && d.baseForm === 'amp' ? d.panel || d.color : d && d.baseForm === 'cab' ? '#b9a27a' : null };
  });
  const minX = Math.min(...boxes.map((b) => b.x)) - 40, minY = Math.min(...boxes.map((b) => b.y)) - 40;
  const maxX = Math.max(...boxes.map((b) => b.x + b.w)) + 40, maxY = Math.max(...boxes.map((b) => b.y + b.h)) + 40;
  s.setAttribute('viewBox', `${minX} ${minY} ${maxX - minX} ${maxY - minY}`);
  const sw = Math.max(4, (maxX - minX) / 120);
  for (const [a, b] of layout.c || []) {
    const A = boxes[a], B = boxes[b];
    if (!A || !B) continue;
    const ax = A.x, ay = A.y + A.h * 0.25, bx = B.x + B.w, by = B.y + B.h * 0.25;
    svg('path', { d: `M${ax} ${ay} C ${ax - 80} ${ay + 60} ${bx + 80} ${by + 60} ${bx} ${by}`, stroke: '#e8473d', 'stroke-width': sw, fill: 'none', opacity: 0.7, 'stroke-linecap': 'round' }, s);
  }
  for (const b of boxes) {
    svg('rect', { x: b.x, y: b.y + sw * 1.5, width: b.w, height: b.h, rx: 10, fill: '#000', opacity: 0.4 }, s);
    svg('rect', { x: b.x, y: b.y, width: b.w, height: b.h, rx: 10, fill: b.missing ? '#3a2020' : b.color, opacity: b.byp ? 0.55 : 1, stroke: b.missing ? '#ff4d5e' : '#000', 'stroke-width': sw * 0.4, 'stroke-dasharray': b.missing ? `${sw * 2} ${sw}` : null }, s);
    if (b.form === 'cab') svg('rect', { x: b.x + b.w * 0.06, y: b.y + b.h * 0.06, width: b.w * 0.88, height: b.h * 0.88, rx: 6, fill: '#3a352c', opacity: 0.9 }, s);
    if (b.form === 'amp') svg('rect', { x: b.x + b.w * 0.05, y: b.y + b.h * 0.58, width: b.w * 0.9, height: b.h * 0.28, rx: 4, fill: b.panel && b.panel !== '#555' ? b.panel : '#c9a24a', opacity: 0.9 }, s);
    svg('rect', { x: b.x, y: b.y, width: b.w, height: b.h * 0.45, rx: 10, fill: '#fff', opacity: 0.08 }, s);
  }
  return s;
}
const sizeCache = new Map();
// real rendered size of a block (measured once by drawing its enclosure off-screen), table fallback
export function sizeOf(d) {
  if (!d) return [120, 200];
  if (sizeCache.has(d.id)) return sizeCache.get(d.id);
  let r = null;
  try {
    const g = svg('g');
    const rdef = Object.create(d);
    rdef.ports = portsFor(d, defaultVariant(d));
    const res = renderForm({ g, views: new Map(), flip: false, thumb: true }, rdef);
    if (res && res.w > 0 && res.h > 0) r = [Math.round(res.w), Math.round(res.h)];
  } catch {}
  r = r || sizeGuess(d);
  sizeCache.set(d.id, r);
  return r;
}
function sizeGuess(d) {
  const f = d.form;
  if (f === 'amp') return [440, d.combo ? 330 : 200];
  if (f === 'cab') return [{ '1x12': 250, '2x12': 400, '4x12': 440, '4x10': 300, '8x10': 270, '1x15': 264, '2x10': 300 }[d.cabSize || '4x12'] || 400, { '1x12': 236, '2x12': 262, '4x12': 420, '4x10': 330, '8x10': 480, '1x15': 300, '2x10': 240 }[d.cabSize || '4x12'] || 300];
  if (f === 'rack') return [460, 96];
  if (f === 'strymon' || f === 'pod' || f === 'rc500') return [240, 230];
  if (f === 'rc600' || f === 'multi') return [520, 260];
  if (f === 'treadle') return [130, 250];
  if (f === 'io') return [110, 220];
  return [120, 200];
}

export async function renderPresets() {
  const v = document.getElementById('view-presets');
  v.innerHTML = '';
  const page = el('div', { class: 'page presets-page' }, v);
  const head = el('div', { class: 'page-head' }, page, '<div><h1>Presets</h1><p>Click a preset to load it · double-click to load and jump to the board.</p></div>');
  const acts = el('div', { class: 'page-actions' }, head);
  el('button', { class: 'btn', onclick: newPresetAction }, acts, '<i class="ic ic-plus"></i>New');
  el('button', { class: 'btn', onclick: () => savePreset(true).then(renderPresets) }, acts, '<i class="ic ic-save"></i>Save current as…');
  el('button', { class: 'btn', onclick: async () => { const f = await window.tz.presets.importPresets(); if (f && f.length) { toast(`Imported ${f.length} preset(s)`, 'ok'); renderPresets(); } } }, acts, '<i class="ic ic-import"></i>Import');
  el('button', { class: 'btn', onclick: () => window.tz.presets.exportPreset(serialize()) }, acts, '<i class="ic ic-copy"></i>Export current');

  const list = await refreshPresetList();
  const tools = el('div', { class: 'pp-tools' }, page);
  const sr = el('div', { class: 'search' }, tools, '<i class="ic ic-search"></i>');
  const q = el('input', { placeholder: 'Search presets, blocks or tags…', value: V.q, spellcheck: 'false' }, sr);
  const chips = el('div', { class: 'filter-row' }, tools);
  for (const f of ['All', 'Favourites', 'Factory', 'Mine']) {
    const b = el('button', { class: 'chip' + (V.filter === f ? ' on' : '') + (f === 'Favourites' ? ' fav' : '') }, chips, f === 'Favourites' ? '★ Favourites' : esc(f));
    b.onclick = () => { V.filter = f; draw(); chips.querySelectorAll('.chip').forEach((x) => x.classList.toggle('on', x === b)); };
  }
  // tag filter: multi-select, match any / all
  const counts = new Map();
  for (const p of list) for (const t of p.tags || []) counts.set(t, (counts.get(t) || 0) + 1);
  const tags = [...counts.keys()].sort((a, b) => counts.get(b) - counts.get(a) || a.localeCompare(b));
  for (const t of [...V.tags]) if (!counts.has(t)) V.tags.delete(t);
  const tagRow = el('div', { class: 'pp-tags' }, page);
  const drawTags = () => {
    tagRow.innerHTML = '';
    if (!tags.length) return;
    el('span', { class: 'pp-tags-l' }, tagRow, '<i class="ic ic-filter"></i>Tags');
    const mode = el('button', { class: 'chip sm', title: 'Show presets with any / all of the selected tags' }, tagRow, V.tagMode === 'any' ? 'match any' : 'match all');
    mode.onclick = () => { V.tagMode = V.tagMode === 'any' ? 'all' : 'any'; drawTags(); draw(); };
    for (const t of tags) {
      const b = el('button', { class: 'chip sm' + (V.tags.has(t) ? ' on' : '') }, tagRow, `#${esc(t)}<em>${counts.get(t)}</em>`);
      b.onclick = () => { V.tags.has(t) ? V.tags.delete(t) : V.tags.add(t); drawTags(); draw(); };
    }
    if (V.tags.size) {
      const c = el('button', { class: 'chip sm' }, tagRow, '<i class="ic ic-x"></i>Clear');
      c.onclick = () => { V.tags.clear(); drawTags(); draw(); };
    }
  };
  drawTags();
  const sortSel = el('select', { class: 'pp-sort' }, tools, '<option value="name">Name</option><option value="recent">Recently saved</option><option value="blocks">Most blocks</option>');
  sortSel.value = V.sort;
  sortSel.onchange = () => { V.sort = sortSel.value; draw(); };
  const grid = el('div', { class: 'preset-grid' }, page);
  q.oninput = () => { V.q = q.value.trim().toLowerCase(); draw(); };

  function draw() {
    grid.innerHTML = '';
    let items = list.filter((p) => {
      if (V.filter === 'Favourites' && !p.favorite) return false;
      if (V.filter === 'Factory' && !p.factory) return false;
      if (V.filter === 'Mine' && p.factory) return false;
      if (V.tags.size) {
        const pt = new Set(p.tags || []);
        const hit = [...V.tags].filter((t) => pt.has(t)).length;
        if (V.tagMode === 'all' ? hit < V.tags.size : !hit) return false;
      }
      if (V.q) {
        const hay = [p.name, p.desc, ...(p.tags || []), ...(p.types || []).map((t) => getDef(t)?.name || t)].join(' ').toLowerCase();
        if (!V.q.split(/\s+/).every((w) => hay.includes(w))) return false;
      }
      return true;
    });
    if (V.sort === 'recent') items.sort((a, b) => (b.saved || b.mtime) - (a.saved || a.mtime));
    else if (V.sort === 'blocks') items.sort((a, b) => (b.blocks || 0) - (a.blocks || 0));
    items.sort((a, b) => (b.favorite ? 1 : 0) - (a.favorite ? 1 : 0));
    if (!items.length) {
      el('div', { class: 'empty-state' }, grid, '<p>No presets match.</p>');
      return;
    }
    for (const p of items) card(p);
  }
  function card(p) {
    const cur = p.file === state.file;
    const c = el('div', { class: 'preset-card' + (cur ? ' cur' : '') }, grid);
    const art = el('div', { class: 'pc-art' }, c);
    art.appendChild(thumb(p.layout));
    if (cur) el('span', { class: 'pc-cur' }, art, state.dirty ? 'LOADED · EDITED' : 'LOADED');
    const star = el('button', { class: 'fav-star pc-star' + (p.favorite ? ' on' : ''), title: 'Favourite' }, art, p.favorite ? '★' : '☆');
    star.onclick = async (e) => { e.stopPropagation(); p.favorite = !p.favorite; await window.tz.presets.meta(p.file, { favorite: p.favorite }); draw(); };
    const meta = el('div', { class: 'pc-meta' }, c);
    el('div', { class: 'pc-name' }, meta).textContent = p.name;
    const names = (p.types || []).map((t) => getDef(t)?.name).filter(Boolean);
    el('div', { class: 'pc-sub' }, meta).textContent = `${p.blocks || 0} blocks${names.length ? ' · ' + names.slice(0, 4).join(', ') + (names.length > 4 ? '…' : '') : ''}`;
    if ((p.tags || []).length || p.factory) {
      const tg = el('div', { class: 'pc-tags' }, meta);
      if (p.factory) el('span', { class: 'pc-tag f' }, tg).textContent = 'factory';
      for (const t of p.tags || []) {
        const x = el('span', { class: 'pc-tag' + (V.tags.has(t) ? ' on' : ''), title: 'Filter by this tag' }, tg);
        x.textContent = '#' + t;
        x.onclick = (e) => { e.stopPropagation(); V.tags.has(t) ? V.tags.delete(t) : V.tags.add(t); drawTags(); draw(); };
      }
    }
    const more = el('button', { class: 'icon-btn pc-more', title: 'More' }, c, '<i class="ic ic-dots"></i>');
    more.onclick = (e) => { e.stopPropagation(); cardMenu(p, more); };
    c.onclick = async () => { if (await openPreset(p.file)) { updateTitle(); draw(); } };
    c.ondblclick = async () => { if (state.file === p.file || (await openPreset(p.file))) bus.emit('tab', 'board'); };
    c.oncontextmenu = (e) => { e.preventDefault(); cardMenu(p, null, e); };
  }
  function cardMenu(p, anchor, e) {
    const r = anchor ? anchor.getBoundingClientRect() : { left: e.clientX, bottom: e.clientY };
    showMenu(r.left, r.bottom + 4, [
      { label: 'Load', icon: 'play', onClick: () => openPreset(p.file).then(draw) },
      { label: 'Rename…', icon: 'edit', onClick: async () => { const n = await prompt('Rename preset', p.name); if (n) { await window.tz.presets.meta(p.file, { name: n }); if (state.file === p.file) { state.preset.name = n; updateTitle(); } renderPresets(); } } },
      { label: 'Edit tags…', icon: 'list', onClick: async () => { const n = await editTags(p.name, p.tags || [], tags); if (n) { await window.tz.presets.meta(p.file, { tags: n }); if (state.file === p.file) state.preset.tags = n; renderPresets(); } } },
      { label: 'Duplicate', icon: 'copy', onClick: async () => { await window.tz.presets.duplicate(p.file); renderPresets(); } },
      { label: 'Export…', icon: 'import', onClick: async () => window.tz.presets.exportPreset(await window.tz.presets.load(p.file)) },
      { sep: true },
      { label: 'Delete', icon: 'trash', danger: true, onClick: async () => { if (await confirmDlg('Delete preset', `Delete “${p.name}”?`, 'Delete', true)) { await window.tz.presets.remove(p.file); if (state.file === p.file) state.file = null; renderPresets(); } } },
    ]);
  }
  draw();
}

// chip-based tag editor with suggestions (genres + tags used elsewhere)
export function editTags(name, current, known = []) {
  return new Promise((resolve) => {
    const tags = [...current];
    const body = el('div', { class: 'tag-ed' });
    const box = el('div', { class: 'tag-box' }, body);
    const inp = el('input', { type: 'text', placeholder: 'Type a tag and press Enter…', spellcheck: 'false' });
    const sug = el('div', { class: 'tag-sug' }, body);
    const norm = (t) => t.trim().toLowerCase().replace(/^#/, '').replace(/\s+/g, '-').replace(/[^a-z0-9+\-]/g, '');
    const add = (t) => { t = norm(t); if (t && !tags.includes(t)) tags.push(t); inp.value = ''; paint(); inp.focus(); };
    const paint = () => {
      box.innerHTML = '';
      for (const t of tags) {
        const c = el('span', { class: 'tag-chip' }, box, `#${esc(t)}<button title="Remove">×</button>`);
        c.querySelector('button').onclick = () => { tags.splice(tags.indexOf(t), 1); paint(); };
      }
      box.appendChild(inp);
      paintSug();
    };
    const paintSug = () => {
      sug.innerHTML = '';
      const q = norm(inp.value);
      const pool = [...new Set([...known, ...GENRE_TAGS])].filter((t) => !tags.includes(t) && (!q || t.includes(q)));
      for (const t of pool.slice(0, 40)) {
        const c = el('button', { class: 'chip sm' }, sug, '#' + esc(t));
        c.onclick = () => add(t);
      }
    };
    inp.onkeydown = (e) => {
      if ((e.key === 'Enter' || e.key === ',') && inp.value.trim()) { e.preventDefault(); add(inp.value); }
      else if (e.key === 'Backspace' && !inp.value && tags.length) { tags.pop(); paint(); }
    };
    inp.oninput = paintSug;
    box.onclick = () => inp.focus();
    paint();
    modal({
      title: 'Tags',
      subtitle: name,
      body,
      buttons: [
        { label: 'Cancel', value: null },
        { label: 'Save', cls: 'btn-accent', onClick: () => { if (inp.value.trim()) add(inp.value); return tags.slice(); } },
      ],
      onClose: (v) => resolve(v),
    });
    setTimeout(() => inp.focus(), 30);
  });
}

async function newPresetAction() {
  if (state.dirty && !(await confirmDlg('Unsaved changes', 'Discard current changes?', 'Discard', true))) return;
  loadPreset(newPreset(), null);
  updateTitle();
  markDirty(false);
  bus.emit('tab', 'board');
}

bus.on('dirty', () => {
  const v = document.getElementById('view-presets');
  if (v && v.classList.contains('active')) {
    const b = v.querySelector('.preset-card.cur .pc-cur');
    if (b) b.textContent = state.dirty ? 'LOADED · EDITED' : 'LOADED';
  }
});
