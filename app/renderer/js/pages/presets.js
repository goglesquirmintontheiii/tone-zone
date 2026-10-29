// Presets tab: a searchable grid of preset cards with thumbnails, favourites and tags.
import { el, svg, esc, bus, toast } from '../util.js';
import { state, loadPreset, newPreset, markDirty, serialize } from '../state.js';
import { getDef, portsFor, defaultVariant } from '../catalog/index.js';
import { renderForm } from '../gfx/forms.js';
import { thumbURL, cacheGet, cacheSet } from '../gfx/raster.js';
import { openPreset, savePreset, refreshPresetList, updateTitle } from '../presets.js';
import { prompt, confirmDlg, showMenu, modal } from '../menus.js';

const V = { q: '', sort: 'name', filter: 'All', tags: new Set(), tagMode: 'any', selecting: false, sel: new Set() };
export const GENRE_TAGS = ['rhythm', 'lead', 'clean', 'crunch', 'high-gain', 'ambient', 'simple', 'complex', 'jazz', 'worship', 'contemporary-worship', 'gospel', 'rock', 'classic-rock', 'alt-rock', 'metal', 'heavy-metal', 'classic-metal', 'deathcore', 'metalcore', 'punk', 'pop-punk', 'pop', 'experimental', 'jazz-fusion', 'edm', 'acoustic', 'country', 'country-rock', 'blues', 'funk', 'bass'];

// Each preset thumbnail is one PNG built from the cached pedal images.
// One <img> per card keeps scrolling and repainting cheap.
const thumbCache = new Map(); // file|mtime -> dataURL
const loadImg = (src) => new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
async function thumbPNG(layout) {
  const W = 300, H = 150, dpr = Math.min(2, window.devicePixelRatio || 1);
  const c = document.createElement('canvas');
  c.width = W * dpr;
  c.height = H * dpr;
  const cx = c.getContext('2d');
  cx.scale(dpr, dpr);
  const bl = layout?.b || [];
  if (!bl.length) {
    cx.fillStyle = '#5b6372';
    cx.font = '12px Inter, sans-serif';
    cx.textAlign = 'center';
    cx.fillText('empty board', W / 2, H / 2);
    return c.toDataURL('image/png');
  }
  const boxes = bl.map(([type, x, y, byp, rot]) => {
    const d = getDef(type);
    const sz = d ? sizeOf(d) : [120, 200];
    const r = (((rot || 0) % 360) + 360) % 360, sw = r === 90 || r === 270;
    return { d, x, y, w: sw ? sz[1] : sz[0], h: sw ? sz[0] : sz[1], fw: sz[0], fh: sz[1], byp, r };
  });
  const minX = Math.min(...boxes.map((b) => b.x)) - 30, minY = Math.min(...boxes.map((b) => b.y)) - 30;
  const maxX = Math.max(...boxes.map((b) => b.x + b.w)) + 30, maxY = Math.max(...boxes.map((b) => b.y + b.h)) + 30;
  const sc = Math.min(W / (maxX - minX), H / (maxY - minY));
  const ox = (W - (maxX - minX) * sc) / 2 - minX * sc, oy = (H - (maxY - minY) * sc) / 2 - minY * sc;
  const X = (v) => ox + v * sc, Y = (v) => oy + v * sc;
  // cables under the pedals
  cx.lineCap = 'round';
  cx.strokeStyle = 'rgba(232, 71, 61, 0.75)';
  cx.lineWidth = Math.max(1, 6 * sc);
  for (const [a, b] of layout.c || []) {
    const A = boxes[a], B = boxes[b];
    if (!A || !B) continue;
    const ax = X(A.x), ay = Y(A.y + A.h * 0.3), bx = X(B.x + B.w), by = Y(B.y + B.h * 0.3);
    cx.beginPath();
    cx.moveTo(ax, ay);
    cx.bezierCurveTo(ax - 40 * sc, ay + 50 * sc, bx + 40 * sc, by + 50 * sc, bx, by);
    cx.stroke();
  }
  const raw = Math.max(...boxes.map((b) => Math.max(b.w, b.h))) * sc * dpr;
  const px = raw < 80 ? 64 : raw < 112 ? 96 : 128; // fixed sizes so presets can share pedal images
  for (const b of boxes) {
    cx.globalAlpha = b.byp ? 0.5 : 1;
    if (!b.d || b.d.missing) {
      cx.setLineDash([4, 3]);
      cx.strokeStyle = '#8a93a6';
      cx.strokeRect(X(b.x), Y(b.y), b.w * sc, b.h * sc);
      cx.setLineDash([]);
      continue;
    }
    const url = await thumbURL(b.d, px);
    const im = url && (await loadImg(url));
    if (im && b.r) {
      // draw around the block's centre, rotated
      cx.save();
      cx.translate(X(b.x + b.w / 2), Y(b.y + b.h / 2));
      cx.rotate((b.r * Math.PI) / 180);
      cx.drawImage(im, (-b.fw / 2 - 10) * sc, (-b.fh / 2 - 10) * sc, (b.fw + 20) * sc, (b.fh + 20) * sc);
      cx.restore();
    } else if (im) cx.drawImage(im, X(b.x - 10), Y(b.y - 10), (b.w + 20) * sc, (b.h + 20) * sc);
    else { cx.fillStyle = b.d.color || '#444'; cx.fillRect(X(b.x), Y(b.y), b.w * sc, b.h * sc); }
  }
  cx.globalAlpha = 1;
  return c.toDataURL('image/png');
}
function thumb(p) {
  const im = document.createElement('img');
  im.className = 'pc-thumb';
  im.alt = '';
  im.draggable = false;
  const key = p.file + '|' + (p.mtime || 0) + '|' + (p.layout?.b || []).length;
  if (thumbCache.has(key)) im.src = thumbCache.get(key);
  else
    cacheGet('preset|' + key)
      .then((hit) => hit || thumbPNG(p.layout).then((u) => (cacheSet('preset|' + key, u), u)))
      .then((u) => { thumbCache.set(key, u); im.src = u; })
      .catch(() => {});
  return im;
}
const sizeCache = new Map();
// a block's real size, measured once by drawing it off-screen (falls back to a guess)
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
  const head = el('div', { class: 'page-head' }, page, '<div><h1>Presets</h1><p>Click a preset to load it. Double-click to load it and go to the board.</p></div>');
  const acts = el('div', { class: 'page-actions' }, head);
  el('button', { class: 'btn', onclick: newPresetAction }, acts, '<i class="ic ic-plus"></i>New');
  el('button', { class: 'btn', onclick: () => savePreset(true).then(renderPresets) }, acts, '<i class="ic ic-save"></i>Save current as…');
  el('button', { class: 'btn', onclick: async () => { const f = await window.tz.presets.importPresets(); if (f && f.length) { toast(`Imported ${f.length} preset(s)`, 'ok'); renderPresets(); } } }, acts, '<i class="ic ic-import"></i>Import');
  el('button', { class: 'btn', onclick: () => window.tz.presets.exportPreset(serialize()) }, acts, '<i class="ic ic-copy"></i>Export current');
  const deleted = await window.tz.presets.deletedFactory().catch(() => []);
  if (deleted.length)
    el('button', { class: 'btn', title: 'Bring back the built-in presets you deleted', onclick: async () => {
      if (!(await confirmDlg('Restore built-in presets', `Restore ${deleted.length} deleted built-in preset${deleted.length > 1 ? 's' : ''}?`, 'Restore'))) return;
      await window.tz.presets.restoreFactory();
      toast(`Restored ${deleted.length} preset${deleted.length > 1 ? 's' : ''}`, 'ok');
      renderPresets();
    } }, acts, `<i class="ic ic-undo"></i>Restore built-in (${deleted.length})`);

  const list = await refreshPresetList();
  for (const f of [...V.sel]) if (!list.some((p) => p.file === f)) V.sel.delete(f);
  const tools = el('div', { class: 'pp-tools' }, page);
  const sr = el('div', { class: 'search' }, tools, '<i class="ic ic-search"></i>');
  const q = el('input', { placeholder: 'Search presets, blocks or tags…', value: V.q, spellcheck: 'false' }, sr);
  const chips = el('div', { class: 'filter-row' }, tools);
  for (const f of ['All', 'Favourites', 'Factory', 'Mine']) {
    const b = el('button', { class: 'chip' + (V.filter === f ? ' on' : '') + (f === 'Favourites' ? ' fav' : '') }, chips, f === 'Favourites' ? '★ Favourites' : esc(f));
    b.onclick = () => { V.filter = f; draw(); chips.querySelectorAll('.chip').forEach((x) => x.classList.toggle('on', x === b)); };
  }
  // tag filter: pick several, match any or all
  const counts = new Map();
  for (const p of list) for (const t of p.tags || []) counts.set(t, (counts.get(t) || 0) + 1);
  const tags = [...counts.keys()].sort((a, b) => counts.get(b) - counts.get(a) || a.localeCompare(b));
  for (const t of [...V.tags]) if (!counts.has(t)) V.tags.delete(t);
  const tagRow = el('div', { class: 'pp-tags' }, page);
  const drawTags = () => {
    tagRow.innerHTML = '';
    if (!tags.length) return;
    el('span', { class: 'pp-tags-l' }, tagRow, '<i class="ic ic-filter"></i>Tags');
    const mode = el('button', { class: 'chip sm', title: 'Show presets with any or all of the selected tags' }, tagRow, V.tagMode === 'any' ? 'match any' : 'match all');
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
  const selBtn = el('button', { class: 'btn' + (V.selecting ? ' on' : ''), title: 'Select several presets (or Ctrl-click a card)' }, tools, '<i class="ic ic-check"></i>Select');
  selBtn.onclick = () => setSelecting(!V.selecting);
  const sortSel = el('select', { class: 'pp-sort' }, tools, '<option value="name">Name</option><option value="recent">Recently saved</option><option value="blocks">Most blocks</option>');
  sortSel.value = V.sort;
  sortSel.onchange = () => { V.sort = sortSel.value; draw(); };
  const grid = el('div', { class: 'preset-grid' }, page);
  q.oninput = () => { V.q = q.value.trim().toLowerCase(); draw(); };
  // selection bar (multi-delete)
  const bar = el('div', { class: 'pp-selbar' }, page);
  let shown = [];
  function setSelecting(on) {
    V.selecting = on;
    if (!on) V.sel.clear();
    selBtn.classList.toggle('on', on);
    draw();
  }
  function drawBar() {
    bar.classList.toggle('show', V.selecting);
    bar.innerHTML = '';
    if (!V.selecting) return;
    el('span', { class: 'pp-selcount' }, bar, `${V.sel.size} selected`);
    el('button', { class: 'btn', onclick: () => { const all = shown.every((p) => V.sel.has(p.file)); for (const p of shown) all ? V.sel.delete(p.file) : V.sel.add(p.file); draw(); } }, bar,
      shown.length && shown.every((p) => V.sel.has(p.file)) ? 'Select none' : `Select all shown (${shown.length})`);
    const del = el('button', { class: 'btn btn-danger' }, bar, '<i class="ic ic-trash"></i>Delete');
    del.disabled = !V.sel.size;
    del.onclick = () => deleteFiles([...V.sel]);
    el('button', { class: 'btn', onclick: () => setSelecting(false) }, bar, 'Cancel');
  }
  async function deleteFiles(files) {
    if (!files.length) return;
    const names = files.map((f) => list.find((p) => p.file === f)?.name || f);
    const fac = files.filter((f) => list.find((p) => p.file === f)?.factory).length;
    const msg = files.length === 1 ? `Delete “${names[0]}”?` : `Delete ${files.length} presets?`;
    const extra = fac ? ' Built-in presets can be brought back later with “Restore built-in”.' : '';
    if (!(await confirmDlg(files.length === 1 ? 'Delete preset' : 'Delete presets', msg + extra, 'Delete', true))) return;
    await window.tz.presets.removeMany(files);
    if (files.includes(state.file)) state.file = null;
    for (const f of files) V.sel.delete(f);
    if (!V.sel.size) V.selecting = false;
    toast(files.length === 1 ? `Deleted “${names[0]}”` : `Deleted ${files.length} presets`, 'ok', 1600);
    renderPresets();
  }

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
      shown = [];
      drawBar();
      return;
    }
    shown = items;
    grid.classList.toggle('selecting', V.selecting);
    for (const p of items) card(p);
    drawBar();
  }
  function card(p) {
    const cur = p.file === state.file;
    const c = el('div', { class: 'preset-card' + (cur ? ' cur' : '') + (V.sel.has(p.file) ? ' sel' : '') }, grid);
    const art = el('div', { class: 'pc-art' }, c);
    art.appendChild(thumb(p));
    if (V.selecting) el('span', { class: 'pc-check' }, art, V.sel.has(p.file) ? '<i class="ic ic-check"></i>' : '');
    else {
      const del = el('button', { class: 'icon-btn pc-del', title: 'Delete preset' }, art, '<i class="ic ic-trash"></i>');
      del.onclick = (e) => { e.stopPropagation(); deleteFiles([p.file]); };
    }
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
    c.onclick = async (e) => {
      if (V.selecting || e.ctrlKey || e.metaKey) {
        V.selecting = true;
        selBtn.classList.add('on');
        V.sel.has(p.file) ? V.sel.delete(p.file) : V.sel.add(p.file);
        draw();
        return;
      }
      if (await openPreset(p.file)) { updateTitle(); draw(); }
    };
    c.ondblclick = async () => {
      if (V.selecting) return; if (state.file === p.file || (await openPreset(p.file))) bus.emit('tab', 'board'); };
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
      { label: 'Select', icon: 'check', onClick: () => { V.selecting = true; V.sel.add(p.file); selBtn.classList.add('on'); draw(); } },
      { label: 'Delete', icon: 'trash', danger: true, onClick: () => deleteFiles([p.file]) },
    ]);
  }
  draw();
}

// tag editor with suggestions (genres plus tags used on other presets)
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
  if (state.dirty && !(await confirmDlg('Unsaved changes', 'Throw away your current changes?', 'Discard', true))) return;
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
