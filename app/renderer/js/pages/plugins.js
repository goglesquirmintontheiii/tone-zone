// Plugins tab: one card per plugin. A card opens details and its blocks; a block opens
// a small sandbox to play with that isn't connected to anything.
import { el, esc, bus, toast, svg, clamp } from '../util.js';
import { pluginInfo, setPluginEnabled, reloadPlugins, hooksFor } from '../plugins.js';
import { pluginDefIds, getDef, kindOf, defaultVariant } from '../catalog/index.js';
import { state, uiParams, setParam, markDirty } from '../state.js';
import { screenPointer } from '../screens.js';
import { footCtrl } from '../control.js';
import { MIC_TYPES } from '../gfx/cabgeom.js';
import { confirmDlg } from '../menus.js';
import { thumbImg } from '../gfx/raster.js';
import { NodeView, knobPos, knobValue } from '../nodeview.js';

const V = { q: '', filter: 'All', sort: 'name' };
const KIND_ORDER = ['Pedal', 'Multi-FX', 'Amp', 'Preamp', 'Cab', 'Utility'];
const KIND_WORD = { Pedal: ['pedal', 'pedals'], 'Multi-FX': ['multi-FX', 'multi-FX'], Amp: ['amp', 'amps'], Preamp: ['preamp', 'preamps'], Cab: ['cab', 'cabs'], Utility: ['utility', 'utilities'] };

// block counts are remembered so disabled plugins can still show them
function countsCache() {
  try { return JSON.parse(localStorage.getItem('tz.pluginCounts') || '{}'); } catch { return {}; }
}
function saveCounts(c) {
  try { localStorage.setItem('tz.pluginCounts', JSON.stringify(c)); } catch {}
}
function blockIds(id) {
  return pluginDefIds(id).filter((b) => { const d = getDef(b); return d && !d.hidden; });
}
function countsFor(id, cache) {
  const ids = blockIds(id);
  if (!ids.length) return cache[id] || null;
  const by = {};
  for (const b of ids) { const k = kindOf(getDef(b)); by[k] = (by[k] || 0) + 1; }
  const c = { total: ids.length, by };
  cache[id] = c;
  return c;
}
function countText(c) {
  if (!c) return '';
  return KIND_ORDER.filter((k) => c.by[k]).map((k) => `${c.by[k]} ${KIND_WORD[k][c.by[k] === 1 ? 0 : 1]}`).join(' · ');
}
function hue(s) {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}
// a few of the plugin's own blocks make its icon (pedals first, then amps, then anything)
function iconBlocks(id, n = 3) {
  const defs = blockIds(id).map(getDef);
  const pick = [];
  for (const k of KIND_ORDER) for (const d of defs) if (pick.length < n && kindOf(d) === k && !pick.includes(d)) { pick.push(d); break; }
  for (const d of defs) if (pick.length < n && !pick.includes(d)) pick.push(d);
  return pick;
}
function iconBg(p) {
  const m = p.info.manifest, h = hue(m.name || p.info.id);
  return m.color ? `linear-gradient(140deg, ${m.color}, #0f1218 130%)` : `linear-gradient(140deg, hsl(${h},50%,36%), hsl(${(h + 40) % 360},55%,16%))`;
}
function iconFallback(p, box) {
  // nothing to show (disabled or no blocks): a glyph plus initials
  const m = p.info.manifest, id = p.info.id;
  const glyph = m.kind === 'page' ? 'ic-list' : 'ic-plug';
  el('i', { class: 'ic ' + glyph + ' pl-icon-glyph' }, box);
  const initials = (m.short || (m.name || id).replace(/[^A-Za-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean).map((w) => w[0]).join('').slice(0, 3)).toUpperCase();
  el('span', { class: 'pl-icon-txt' }, box, esc(initials));
}
// lazy: images are made when the box scrolls into view (see `lazy`)
function pluginIcon(p, big = false, lazyFill = null) {
  const box = el('div', { class: 'pl-icon' + (big ? ' big' : ''), style: { background: iconBg(p) } });
  const fill = () => {
    const blocks = iconBlocks(p.info.id);
    if (!blocks.length) return iconFallback(p, box);
    blocks.forEach((d, i) => {
      const im = thumbImg(d, big ? 84 : 64, 'pl-icon-im');
      im.style.setProperty('--i', i);
      im.style.setProperty('--n', blocks.length);
      box.appendChild(im);
    });
  };
  if (lazyFill) lazyFill(box, fill);
  else fill();
  return box;
}
// a wide banner with a row of block pictures (medium and large cards)
function pluginBanner(p, n, size, lazyFill) {
  const box = el('div', { class: 'pl-banner', style: { background: iconBg(p) } });
  lazyFill(box, () => {
    const blocks = iconBlocks(p.info.id, n);
    if (!blocks.length) return iconFallback(p, box);
    const row = el('div', { class: 'pl-collage' }, box);
    row.style.setProperty('--n', blocks.length);
    blocks.forEach((d, i) => {
      const im = thumbImg(d, size, 'pl-col-im');
      im.style.setProperty('--i', i);
      im.style.setProperty('--r', ((i * 37) % 9) - 4);
      row.appendChild(im);
    });
  });
  return box;
}

const VIEWS = [['large', 'Large'], ['medium', 'Medium'], ['tile', 'Tile'], ['list', 'List']];
function savedView() {
  try { const v = localStorage.getItem('tz.pluginView'); if (VIEWS.some(([k]) => k === v)) return v; } catch {}
  return 'tile';
}
function saveView(v) {
  try { localStorage.setItem('tz.pluginView', v); } catch {}
}
V.view = savedView();

export async function renderPlugins() {
  const v = document.getElementById('view-plugins');
  v.innerHTML = '';
  const page = el('div', { class: 'page plugins-page' }, v);
  const head = el('div', { class: 'page-head' }, page, '<div><h1>Plugins</h1><p>Each brand is a plugin you can turn off or remove. You can also install your own.</p></div>');
  const acts = el('div', { class: 'page-actions' }, head);
  const seg = el('div', { class: 'seg pl-views', title: 'View' }, acts);
  for (const [k, l] of VIEWS) {
    const b = el('button', { class: V.view === k ? 'on' : '', 'data-view': k }, seg, l);
    b.onclick = () => {
      if (V.view === k) return;
      V.view = k;
      saveView(k);
      seg.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
      draw();
    };
  }
  el('button', { class: 'btn', onclick: () => install('file') }, acts, '<i class="ic ic-import"></i>Install .zip');
  el('button', { class: 'btn', onclick: () => install('folder') }, acts, '<i class="ic ic-folder"></i>Install folder');
  el('button', { class: 'btn', onclick: () => window.tz.plugins.openDir() }, acts, '<i class="ic ic-folder"></i>Plugin folder');
  el('button', { class: 'btn', onclick: async () => { await reloadPlugins(); toast('Plugins reloaded', 'ok', 1400); renderPlugins(); } }, acts, '<i class="ic ic-reload"></i>Reload');
  const removed = await window.tz.plugins.removedBuiltins().catch(() => []);
  if (removed.length)
    el('button', { class: 'btn', title: removed.map((r) => r.name).join(', '), onclick: async () => {
      if (!(await confirmDlg('Restore plugins', `Bring back ${removed.length} removed built-in plugin${removed.length > 1 ? 's' : ''}?`, 'Restore'))) return;
      await window.tz.plugins.restoreBuiltins();
      await reloadPlugins();
      renderPlugins();
    } }, acts, `<i class="ic ic-undo"></i>Restore removed (${removed.length})`);

  const cache = countsCache();
  const all = [...pluginInfo().values()];
  const counts = new Map(all.map((p) => [p.info.id, countsFor(p.info.id, cache)]));
  saveCounts(cache);
  const nOn = all.filter((p) => !p.disabled && !p.error).length;
  const nBlocks = all.reduce((a, p) => a + (p.disabled ? 0 : counts.get(p.info.id)?.total || 0), 0);
  const stats = el('div', { class: 'pl-stats' }, page);
  for (const [n, l] of [[all.length, 'plugins'], [nOn, 'turned on'], [nBlocks, 'blocks from plugins'], [all.filter((p) => !p.info.builtin).length, 'installed by you']])
    el('div', { class: 'pl-stat' }, stats, `<b>${n}</b><span>${l}</span>`);

  const tools = el('div', { class: 'pp-tools' }, page);
  const sr = el('div', { class: 'search' }, tools, '<i class="ic ic-search"></i>');
  const q = el('input', { placeholder: 'Search plugins…', value: V.q, spellcheck: 'false' }, sr);
  q.oninput = () => { V.q = q.value.trim().toLowerCase(); draw(); };
  const chips = el('div', { class: 'filter-row' }, tools);
  for (const f of ['All', 'On', 'Off', 'Built-in', 'Installed', 'Devices']) {
    const b = el('button', { class: 'chip' + (V.filter === f ? ' on' : '') }, chips, f);
    b.onclick = () => { V.filter = f; chips.querySelectorAll('.chip').forEach((x) => x.classList.toggle('on', x === b)); draw(); };
  }
  const sortSel = el('select', { class: 'pp-sort' }, tools, '<option value="name">Name</option><option value="blocks">Most blocks</option>');
  sortSel.value = V.sort;
  sortSel.onchange = () => { V.sort = sortSel.value; draw(); };
  const bulk = el('div', { class: 'pl-bulk' }, tools);
  el('button', { class: 'btn small', onclick: () => bulkSet(true) }, bulk, 'Turn all on');
  el('button', { class: 'btn small', onclick: () => bulkSet(false) }, bulk, 'Turn brands off');
  const grid = el('div', { class: 'plugin-grid' }, page);
  // block pictures are drawn only for cards near the visible part of the page
  let io = null;
  const lazyFill = (box, fill) => {
    if (!('IntersectionObserver' in window)) return fill();
    if (!io)
      io = new IntersectionObserver((ents) => {
        for (const en of ents) if (en.isIntersecting) { io.unobserve(en.target); const f = en.target._fill; en.target._fill = null; f && f(); }
      }, { root: page, rootMargin: '300px 0px' });
    box._fill = fill;
    io.observe(box);
  };
  el('p', { class: 'hint pl-warn' }, page).textContent = 'Plugins run inside Tone Zone with the same access as the app, so only install ones from people you trust. If a plugin is off or removed, its blocks in presets become gray placeholders that pass the sound through.';

  async function bulkSet(on) {
    for (const p of [...pluginInfo().values()]) {
      if (p.error && on) continue;
      if (!on && p.info.manifest.kind !== 'brand') continue;
      if (!!p.disabled === !on) continue;
      await setPluginEnabled(p.info.id, on);
    }
    renderPlugins();
  }

  function draw() {
    if (io) io.disconnect();
    grid.innerHTML = '';
    grid.className = 'plugin-grid v-' + V.view;
    const items = [...pluginInfo().values()].filter((p) => {
      const m = p.info.manifest;
      if (V.filter === 'On' && (p.disabled || p.error)) return false;
      if (V.filter === 'Off' && !p.disabled) return false;
      if (V.filter === 'Built-in' && !p.info.builtin) return false;
      if (V.filter === 'Installed' && p.info.builtin) return false;
      if (V.filter === 'Devices' && m.kind !== 'device') return false;
      if (V.q && ![m.name, m.id, m.description, m.author, m.brand].join(' ').toLowerCase().includes(V.q)) return false;
      return true;
    });
    const total = (p) => counts.get(p.info.id)?.total || 0;
    items.sort((a, b) => (V.sort === 'blocks' ? total(b) - total(a) : 0) || (a.info.manifest.name || '').localeCompare(b.info.manifest.name || ''));
    if (!items.length) el('div', { class: 'empty-state' }, grid, '<p>No plugins match.</p>');
    for (const p of items) (V.view === 'list' ? row : card)(p);
  }
  function onSwitch(p, foot, cls = 'switch') {
    const m = p.info.manifest, id = p.info.id;
    const sw = el('label', { class: cls, title: p.disabled ? 'Turn on' : 'Turn off' }, foot, `<input type="checkbox" ${p.disabled || p.error ? '' : 'checked'} ${p.error && !p.disabled ? 'disabled' : ''}><span></span>`);
    sw.onclick = (e) => e.stopPropagation();
    sw.querySelector('input').onchange = async (e) => {
      await setPluginEnabled(id, e.target.checked);
      toast(`${m.name || id} turned ${e.target.checked ? 'on' : 'off'}`, 'info', 1300);
      renderPlugins();
    };
    return sw;
  }
  function tags(p, box) {
    const m = p.info.manifest;
    el('span', { class: 'pl-tag' + (p.info.builtin ? '' : ' user') }, box, p.info.builtin ? 'built-in' : 'installed');
    if (m.kind && m.kind !== 'brand') el('span', { class: 'pl-tag k' }, box, esc(m.kind));
    el('span', { class: 'pl-ver' }, box, 'v' + esc(m.version || '?'));
  }
  function card(p) {
    const m = p.info.manifest, id = p.info.id, big = V.view === 'large' || V.view === 'medium';
    const c = el('div', { class: 'plugin-card' + (p.disabled ? ' off' : '') + (p.error ? ' err' : '') }, grid);
    c.dataset.plugin = id;
    if (V.view === 'large') c.appendChild(pluginBanner(p, 8, 190, lazyFill));
    else if (V.view === 'medium') c.appendChild(pluginBanner(p, 5, 150, lazyFill));
    else c.appendChild(pluginIcon(p, false, lazyFill));
    const body = el('div', { class: 'pc-body' }, c);
    el('div', { class: 'pc-title' }, body, `${esc(m.name || id)}`);
    if (big) {
      const meta = [m.author ? 'by ' + m.author : null, m.brand && m.brand !== m.name ? m.brand : null].filter(Boolean).join(' · ');
      if (meta) el('div', { class: 'pc-by' }, body).textContent = meta;
    }
    el('div', { class: 'pc-desc' }, body).textContent = p.error ? 'Error: ' + p.error : m.description || '';
    const cnt = counts.get(id);
    if (big && cnt) {
      const k = el('div', { class: 'pc-kinds' }, body);
      el('span', { class: 'pc-kind total' }, k, `<b>${cnt.total}</b> block${cnt.total === 1 ? '' : 's'}`);
      for (const kk of KIND_ORDER) if (cnt.by[kk]) el('span', { class: 'pc-kind' }, k, `<b>${cnt.by[kk]}</b> ${KIND_WORD[kk][cnt.by[kk] === 1 ? 0 : 1]}`);
      if (V.view === 'large' && !p.disabled) {
        const names = blockIds(id).map((b) => getDef(b).name);
        if (names.length) el('div', { class: 'pc-names' }, body).textContent = names.slice(0, 14).join(', ') + (names.length > 14 ? ` and ${names.length - 14} more` : '');
      }
    } else el('div', { class: 'pc-count' }, body, cnt ? `<b>${cnt.total}</b> block${cnt.total === 1 ? '' : 's'}<span>${esc(countText(cnt))}</span>` : '<span>No blocks</span>');
    const foot = el('div', { class: 'pc-foot' }, c);
    tags(p, foot);
    onSwitch(p, foot);
    c.onclick = () => openDetail(p);
  }
  // list view: compact rows, no pictures
  function row(p) {
    const m = p.info.manifest, id = p.info.id;
    const r = el('div', { class: 'pl-lrow' + (p.disabled ? ' off' : '') + (p.error ? ' err' : '') }, grid);
    r.dataset.plugin = id;
    const main = el('div', { class: 'pl-lmain' }, r);
    const nm = el('div', { class: 'pl-lname' }, main, `<b>${esc(m.name || id)}</b>`);
    tags(p, nm);
    el('div', { class: 'pl-ldesc' }, main).textContent = p.error ? 'Error: ' + p.error : m.description || '';
    const cnt = counts.get(id);
    el('div', { class: 'pl-lcount' }, r, cnt ? `<b>${cnt.total}</b> <span>${esc(countText(cnt))}</span>` : '<span>No blocks</span>');
    const acts = el('div', { class: 'pl-lacts' }, r);
    onSwitch(p, acts);
    const rm = el('button', { class: 'icon-btn pl-lrm', title: 'Remove' }, acts, '<i class="ic ic-trash"></i>');
    rm.onclick = (e) => { e.stopPropagation(); removePlugin(p); };
    r.onclick = () => openDetail(p);
  }
  draw();
}

// ------------------------------------------------------------------ remove (built-in or installed)
async function removePlugin(p) {
  const m = p.info.manifest, id = p.info.id;
  const msg = p.info.builtin
    ? `Remove “${m.name || id}”? Its blocks leave the block list and become placeholders in presets. You can bring it back with “Restore removed”.`
    : `Remove “${m.name || id}”? This deletes the plugin's files. Its blocks become placeholders in presets.`;
  if (!(await confirmDlg('Remove plugin', msg, 'Remove', true))) return false;
  if (p.info.builtin) await window.tz.plugins.removeBuiltin(id);
  else await window.tz.plugins.remove(id);
  await reloadPlugins();
  toast(`Removed “${m.name || id}”`, 'ok', 1600);
  renderPlugins();
  return true;
}

// ------------------------------------------------------------------ detail view
function overlay(cls) {
  const o = el('div', { class: 'pl-overlay ' + cls }, document.body);
  const box = el('div', { class: 'pl-panel' }, o);
  const close = () => { o.remove(); document.removeEventListener('keydown', onKey); };
  // Escape closes only the topmost panel
  const onKey = (e) => { if (e.key === 'Escape' && [...document.querySelectorAll('.pl-overlay')].pop() === o) close(); };
  document.addEventListener('keydown', onKey);
  o.addEventListener('mousedown', (e) => { if (e.target === o) close(); });
  el('button', { class: 'icon-btn pl-close', title: 'Close', onclick: close }, box, '<i class="ic ic-x"></i>');
  return { o, box, close };
}

function openDetail(p) {
  const m = p.info.manifest, id = p.info.id;
  const { box, close } = overlay('detail');
  const top = el('div', { class: 'pd-top' }, box);
  top.appendChild(pluginIcon(p, true));
  const info = el('div', { class: 'pd-info' }, top);
  el('h2', {}, info).textContent = m.name || id;
  el('p', { class: 'pd-desc' }, info).textContent = p.error ? 'Error: ' + p.error : m.description || '';
  const meta = [p.info.builtin ? 'Built-in' : 'Installed by you', m.kind ? m.kind[0].toUpperCase() + m.kind.slice(1) : null, m.author ? 'by ' + m.author : null, 'version ' + (m.version || '?'), m.brand && m.brand !== m.name ? 'Brand: ' + m.brand : null].filter(Boolean);
  el('div', { class: 'pd-meta' }, info).textContent = meta.join(' · ');
  const cache = countsCache();
  const cnt = countsFor(id, cache);
  if (cnt) {
    const row = el('div', { class: 'pd-counts' }, info);
    el('div', { class: 'pd-count total' }, row, `<b>${cnt.total}</b><span>blocks</span>`);
    for (const k of KIND_ORDER) if (cnt.by[k]) el('div', { class: 'pd-count' }, row, `<b>${cnt.by[k]}</b><span>${KIND_WORD[k][cnt.by[k] === 1 ? 0 : 1]}</span>`);
  }
  const acts = el('div', { class: 'pd-acts' }, info);
  const tog = el('button', { class: 'btn' + (p.disabled ? ' btn-accent' : '') }, acts, p.disabled ? 'Turn on' : 'Turn off');
  tog.onclick = async () => { await setPluginEnabled(id, !!p.disabled); close(); renderPlugins(); };
  el('button', { class: 'btn btn-danger', onclick: async () => { if (await removePlugin(p)) close(); } }, acts, '<i class="ic ic-trash"></i>Remove');

  const ids = blockIds(id);
  if (!ids.length) {
    el('p', { class: 'hint' }, box).textContent = p.disabled ? 'Turn the plugin on to see its blocks.' : 'This plugin adds no blocks.';
    return;
  }
  el('div', { class: 'pd-hint' }, box).textContent = 'Click a block to try it. Nothing you change here touches your board.';
  // grouped by kind
  for (const k of KIND_ORDER) {
    const defs = ids.map(getDef).filter((d) => kindOf(d) === k);
    if (!defs.length) continue;
    el('h4', { class: 'pd-group' }, box, `${KIND_WORD[k][1][0].toUpperCase() + KIND_WORD[k][1].slice(1)} <em>${defs.length}</em>`);
    const g = el('div', { class: 'pd-blocks' }, box);
    for (const d of defs) {
      const it = el('button', { class: 'pd-block', title: d.ref ? 'Inspired by ' + d.ref : d.name }, g);
      const th = el('div', { class: 'pd-thumb' }, it);
      th.appendChild(thumbImg(d, 112));
      el('div', { class: 'pd-name' }, it).textContent = d.name;
      el('div', { class: 'pd-ref' }, it).textContent = d.ref && d.ref !== 'Tone Zone original' ? d.ref : d.typeName || d.cat;
      it.onclick = () => openSandbox(d);
    }
  }
}

// ------------------------------------------------------------------ sandbox: a block you can play with
// Plugin code (screens, hooks, multi-FX kits) looks blocks up in state.preset.blocks and changes them with
// setParam, so while the sandbox is open its block sits in that array too. It is kept out of saves and undo
// snapshots (toJSON) and out of the engine graph and other for..of loops (iterator), and taken out on close.
const SANDBOX = new Set();
function hideSandbox(arr) {
  if (Object.prototype.hasOwnProperty.call(arr, 'toJSON')) return;
  Object.defineProperty(arr, 'toJSON', { configurable: true, value() { return Array.prototype.filter.call(this, (b) => !SANDBOX.has(b)); } });
  Object.defineProperty(arr, Symbol.iterator, { configurable: true, value: function* () { for (let i = 0; i < this.length; i++) if (!SANDBOX.has(this[i])) yield this[i]; } });
}
function unhideSandbox(arr) {
  if (SANDBOX.size) return;
  delete arr.toJSON;
  delete arr[Symbol.iterator];
}
// keep the block in the current preset (a preset load or undo swaps the array)
function attachSandbox(block) {
  const arr = state.preset && state.preset.blocks;
  if (!arr || arr.includes(block)) return;
  SANDBOX.add(block);
  hideSandbox(arr);
  arr.push(block);
}
function detachSandbox(block) {
  SANDBOX.delete(block);
  const arr = state.preset && state.preset.blocks;
  if (!arr) return;
  const i = arr.indexOf(block);
  if (i >= 0) arr.splice(i, 1);
  unhideSandbox(arr);
  delete state.ui[block.id];
}

function sbAltPos(p, v) {
  if (p === 'amp.level') return clamp(((v ?? 0) + 30) / 42, 0, 1);
  return clamp(v ?? 0.5, 0, 1);
}
function sbAltVal(p, pos) {
  return p === 'amp.level' ? -30 + pos * 42 : pos;
}
function sbSendEvent(b, ev, sui) {
  let arg = ev.arg ?? 0;
  if (arg === 'current') arg = sui.current ?? 0;
  else if (typeof arg === 'string' && arg.startsWith('layer+')) { arg = (sui.layer ?? 0) * 3 + parseInt(arg.slice(6), 10); sui.current = arg; }
  window.tz.engine.send({ cmd: 'event', id: b.id, type: ev.type, value: ev.value ?? 0, arg: arg | 0 });
}

// value tip, the same one the board uses
const tipEl = () => document.getElementById('valueTip');
function tipText(e, s) {
  const t = tipEl();
  if (!t) return;
  t.textContent = s;
  t.style.left = e.clientX + 'px';
  t.style.top = e.clientY + 'px';
  t.classList.add('show');
}
function showTip(e, c, v, alt) {
  const t = tipEl();
  if (!t) return;
  let s;
  if (c.t === 'sel' && !alt) s = c.options[v | 0] ?? '';
  else if (alt) s = (v ?? 0).toFixed(2);
  else if (c.display) s = c.display(v, c);
  else if (c.unit) s = (v >= 1000 && c.unit === 'Hz' ? (v / 1000).toFixed(2) + ' k' : v >= 100 ? v.toFixed(0) : v.toFixed(1)) + ' ' + c.unit;
  else s = (((v - (c.min ?? 0)) / ((c.max ?? 1) - (c.min ?? 0))) * 10).toFixed(1);
  t.innerHTML = `<small>${esc(alt && c.altLabel ? c.altLabel : c.label || c.p || '')}</small>${esc(String(s))}`;
  t.style.left = e.clientX + 'px';
  t.style.top = e.clientY + 'px';
  t.classList.add('show');
}
function hideTip() {
  tipEl()?.classList.remove('show');
}

let sandboxSeq = 0;
export function openSandbox(d) {
  const { o, box, close: closePanel } = overlay('sandbox');
  const head = el('div', { class: 'sb-head' }, box);
  el('h3', {}, head).textContent = d.name;
  el('div', { class: 'sb-sub' }, head).textContent = [d.ref && d.ref !== 'Tone Zone original' ? 'Inspired by ' + d.ref : 'Tone Zone original', d.typeName || d.cat].filter(Boolean).join(' · ');
  if (d.desc) el('p', { class: 'sb-desc' }, box).textContent = d.desc;
  const stage = el('div', { class: 'sb-stage' }, box);
  const root = svg('svg', { class: 'sb-svg' }, stage);
  const layer = svg('g', {}, root);
  const wasDirty = !!state.dirty;
  const fresh = () => ({ id: 'sandbox' + ++sandboxSeq + '-' + Date.now().toString(36), type: d.id, params: Object.assign({}, d.initParams || {}), x: 0, y: 0, bypass: !!d.defaultBypass, variant: defaultVariant(d) });
  let block = fresh();
  attachSandbox(block);
  let nv = new NodeView(block, layer);
  root._sandbox = { get block() { return block; }, get nv() { return nv; } }; // for tests
  const fit = () => {
    const pad = 30, top = d.tubesTop ? 60 : 16;
    root.setAttribute('viewBox', `${-pad} ${-top - 10} ${nv.w + pad * 2} ${nv.h + top + 40}`);
  };
  fit();
  const refresh = () => { nv.updateControls(); nv.setBypassVisual(); };
  refresh();
  el('div', { class: 'sb-hint' }, box).textContent = 'Drag knobs up and down (Shift for fine), scroll over a control, click switches, footswitches and screens.';
  const reset = el('button', { class: 'btn small sb-reset' }, box, 'Reset');
  reset.onclick = () => {
    detachSandbox(block);
    nv.g.remove();
    block = fresh();
    attachSandbox(block);
    nv = new NodeView(block, layer);
    fit();
    refresh();
  };

  // param changes from anywhere (our handlers, screens, plugin hooks) redraw the block
  const offParam = bus.on('param', ({ id, p }) => {
    if (id !== block.id) return;
    if (nv.def.rerenderOn && nv.def.rerenderOn.includes(p)) { nv.render(); fit(); }
    else nv.updateControls();
  });
  const offBypass = bus.on('bypass', ({ id }) => id === block.id && nv.setBypassVisual());

  // our own loop while open, like the board's frame(): status hooks, LEDs and screens
  let drag = null;
  const tick = () => {
    if (!root.isConnected) return close();
    attachSandbox(block);
    const now = performance.now();
    const hk = hooksFor(block.type);
    if (hk && hk.status) try { hk.status(nv, now); } catch (e) { if (!nv._hkErr) { nv._hkErr = 1; console.error('status hook', block.type, e); } }
    nv.updateStatus(now);
  };
  const timer = setInterval(tick, 45);
  tick();
  const close = () => {
    clearInterval(timer);
    offParam();
    offBypass();
    if (drag && drag.holdTimer) clearTimeout(drag.holdTimer);
    sweeping = false;
    hideTip();
    detachSandbox(block);
    if (!wasDirty && state.dirty) markDirty(false);
    if (o.isConnected) closePanel();
  };
  // the overlay's own close (button, Escape, backdrop) removes it; the tick then cleans up
  new MutationObserver((_, mo) => { if (!o.isConnected) { mo.disconnect(); close(); } }).observe(document.body, { childList: true });

  const ui = () => uiParams(block);
  const sui = () => (state.ui[block.id] = state.ui[block.id] || {});
  const set = (p, v, silent = true) => setParam(block.id, p, v, { silent });
  const setBy = (on) => { block.bypass = !!on; window.tz.engine.send({ cmd: 'bypass', id: block.id, on: !!on }); bus.emit('bypass', { id: block.id, on: !!on }); };
  const scale = () => root.getScreenCTM()?.a || 1;
  const local = (e, c) => {
    const m = root.getScreenCTM();
    if (!m) return { x: 0, y: 0 };
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return { x: pt.x - block.x - (c.x - c.w / 2), y: pt.y - block.y - (c.y - c.h / 2) };
  };
  // the fake editor handed to screen pointer handlers
  const ed = { tipText, hideTip, showTip: (e, c, v) => showTip(e, c, v), view: { get z() { return scale(); } } };
  const screenOf = (c) => nv.screens.find((s) => s.ctl === c);
  const hit = (e) => {
    const t = e.target.closest && e.target.closest('[data-ctl]');
    if (!t || !layer.contains(t)) return null;
    return nv.views.get(t.dataset.ctl) || null;
  };

  // ---- footswitches (same rules as the board)
  let sweeping = false, sweepBase;
  const autoSweep = (cfg, on) => {
    if (on) {
      sweepBase = ui()[cfg.p];
      const t0 = performance.now();
      sweeping = true;
      const run = () => {
        if (!sweeping) return;
        const t = ((performance.now() - t0) / cfg.ms) % 2;
        set(cfg.p, cfg.from + (cfg.to - cfg.from) * (t < 1 ? t : 2 - t));
        requestAnimationFrame(run);
      };
      run();
    } else { sweeping = false; set(cfg.p, sweepBase); }
  };
  const selectFoot = (c) => {
    const u = ui();
    if ((u.mode ?? 0) > 0.5) set('mask', ((u.mask ?? 1) ^ (1 << c.idx)) || (1 << c.idx));
    else set('sel', c.idx);
  };
  const footDown = (c, view, dr) => {
    view.press && view.press(true);
    const hk = hooksFor(block.type);
    if (hk && hk.foot && hk.foot(nv, c, true)) return;
    if (c.action === 'ctrl') return footCtrl(block, c.idx ?? 0, true);
    if (c.action === 'select') return selectFoot(c);
    if (c.action === 'toggle' && c.p) return set(c.p, (ui()[c.p] ?? c.def ?? 0) > 0.5 ? 0 : 1);
    const u = ui(), s = sui();
    dr.footT0 = performance.now();
    dr.held = false;
    if (c.action === 'bypass' && d.tapFoot) {
      dr.holdTimer = setTimeout(() => {
        dr.held = true;
        s.tapMode = !s.tapMode;
        toast(s.tapMode ? 'TEMPO mode: tap the pedal (hold again to exit)' : 'TEMPO mode off', 'info', 1800);
      }, 1500);
    } else if (c.hold || c.holdAuto) {
      dr.holdTimer = setTimeout(() => {
        dr.held = true;
        if (c.hold?.event) sbSendEvent(block, c.hold.event, s);
        if (c.hold?.action === 'tapMode') toast('Tap mode', 'info', 900);
        if (c.holdAuto) autoSweep(c.holdAuto, true);
      }, c.hold?.ms ?? 700);
    }
    const momentary = (d.momentaryWhen && d.momentaryWhen(u)) || (d.holdWhen && d.holdWhen(u));
    if (c.action === 'bypass' && momentary) {
      dr.momentary = true;
      dr.wasBypass = block.bypass;
      setBy(!block.bypass);
    }
  };
  const footUp = (c, view, dr) => {
    view.press && view.press(false);
    const hk = hooksFor(block.type);
    if (hk && hk.foot && hk.foot(nv, c, false)) return;
    if (c.action === 'ctrl') return footCtrl(block, c.idx ?? 0, false);
    if (c.action === 'select' || c.action === 'toggle') return;
    clearTimeout(dr.holdTimer);
    const u = ui(), s = sui();
    if (dr.held) {
      if (c.hold?.release) sbSendEvent(block, c.hold.release, s);
      if (c.holdAuto) autoSweep(c.holdAuto, false);
      return;
    }
    if (dr.momentary) return setBy(dr.wasBypass);
    const tapTo = (target, hz, mul) => {
      const now = performance.now(), dt = now - (s.lastTap || 0);
      s.lastTap = now;
      if (dt <= 80 || dt >= 3000) return;
      const dc = d.controls.find((x) => x.p === target);
      if (hz) set(target, dc ? clamp((1000 / dt) * (mul || 1), dc.min ?? 0.05, dc.max ?? 20) : (1000 / dt) * (mul || 1));
      else if (!dc || !dc.virtual) set(target, dc ? clamp(dt, dc.min ?? 10, dc.max ?? 3000) : dt);
    };
    switch (c.action || 'bypass') {
      case 'bypass':
        if (d.tapFoot && s.tapMode) { tapTo('time'); break; }
        setBy(!block.bypass);
        break;
      case 'param': set(c.p, u[c.p] > 0.5 ? 0 : 1); break;
      case 'tap':
        window.tz.engine.send({ cmd: 'event', id: block.id, type: 1, value: 0, arg: (c.tapSub ?? d.tapSub ?? 0) * 100 });
        tapTo(c.tapTarget || d.tapTarget || 'time', c.tapHz || d.tapHz, c.tapMul || d.tapMul);
        break;
      case 'event': sbSendEvent(block, c.event, s); break;
      case 'trackSelect':
        s.current = ((s.current ?? 0) + 1) % (d.loopTracks || 2);
        window.tz.engine.send({ cmd: 'event', id: block.id, type: 6, value: 0, arg: s.current });
        break;
      case 'layerToggle': s.layer = s.layer ? 0 : 1; break;
      case 'favorite': favorite(performance.now() - dr.footT0 > 900); break;
    }
    nv.updateControls();
  };
  const favorite = (save) => {
    const s = sui(), strip = () => JSON.stringify(Object.fromEntries(Object.entries(block.params).filter(([k]) => k !== '_fav')));
    if (save || !block.params._fav) { block.params._fav = strip(); toast('Favorite saved', 'ok', 1200); s.favActive = true; }
    else if (s.favActive) { if (s.favBackup) Object.assign(block.params, JSON.parse(s.favBackup)); s.favActive = false; }
    else { s.favBackup = strip(); Object.assign(block.params, JSON.parse(block.params._fav)); s.favActive = true; }
    nv.updateControls();
  };
  const buttonAction = (c) => {
    const u = ui(), s = sui();
    if (c.toggle && c.p) set(c.p, u[c.p] ? 0 : 1);
    else if (c.event) {
      window.tz.engine.send({ cmd: 'event', id: block.id, type: c.event.type, value: c.event.value ?? 0, arg: (c.event.arg | 0) });
      if (c.event.type === 6) s.current = c.event.arg;
    } else if (c.action === 'alt') {
      s.alt = !s.alt;
      toast(s.alt ? 'ALT: knobs now control the second set of params' : 'ALT off', 'info', 1400);
    } else if (c.action === 'bypass') setBy(!block.bypass);
    else if (c.cycle === 'tunerMode') s.stream = !s.stream;
    else if (c.cycle === 'tunerDisplay') s.display = s.display === 'strobe' ? 'needle' : 'strobe';
    else if (c.cycle) {
      const cyc = { tunerRange: ['range', 3, 2], tuning: ['tuning', 12, 0], pattern: ['pattern', 10, 0] }[c.cycle];
      if (cyc) set(cyc[0], (((u[cyc[0]] ?? cyc[2]) | 0) + 1) % cyc[1]);
    } else if (c.p) set(c.p, u[c.p] ? 0 : 1);
    nv.updateControls();
  };

  // ---- pointer input
  root.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    const entry = hit(e);
    if (!entry) return;
    const c = entry.ctl;
    e.preventDefault();
    root.setPointerCapture(e.pointerId);
    drag = { c, view: entry.view, sx: e.clientX, sy: e.clientY, moved: false };
    if (c.t === 'screen') {
      drag.screen = screenOf(c);
      if (drag.screen) screenPointer(drag.screen, nv, 'down', local(e, c), e, ed);
      return;
    }
    const alt = sui().alt && c.alt;
    drag.alt = alt;
    drag.p = alt ? c.alt : c.p;
    const u = ui();
    if (c.t === 'knob' || c.t === 'slider' || c.t === 'treadle') {
      drag.start = alt ? sbAltPos(drag.p, u[drag.p]) : knobPos(c, u[drag.p] ?? c.def ?? 0);
      showTip(e, c, u[drag.p], alt);
    } else if (c.t === 'sel') {
      drag.start = alt ? sbAltPos(drag.p, u[drag.p]) : u[drag.p] ?? c.def ?? 0;
      showTip(e, c, u[drag.p], alt);
    } else if (c.t === 'mic') drag.start = { x: u[`_m${c.idx}x`] ?? 0.5, y: u[`_m${c.idx}y`] ?? 0.5 };
    else if (c.t === 'foot') footDown(c, entry.view, drag);
    else if (c.t === 'button') entry.view.press && entry.view.press(true);
  });
  root.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const c = drag.c;
    const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
    if (c.t === 'screen') {
      if (Math.abs(dx) + Math.abs(dy) > 2) drag.moved = true;
      if (drag.screen) screenPointer(drag.screen, nv, 'move', local(e, c), e, ed);
      return;
    }
    if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
    const fine = e.shiftKey ? 0.2 : 1, z = scale();
    if (c.t === 'knob' || c.t === 'slider' || c.t === 'treadle' || (c.t === 'sel' && drag.alt)) {
      const range = c.t === 'slider' ? (c.h || 46) * z * 1.6 : c.t === 'treadle' ? (c.h || 220) * z * 0.7 : 170;
      const pos = clamp(drag.start - ((c.t === 'slider' && c.orient === 'h' ? -dx : dy) / range) * fine, 0, 1);
      const val = drag.alt ? sbAltVal(drag.p, pos) : knobValue(c, pos);
      set(drag.p, val);
      showTip(e, c, val, drag.alt);
    } else if (c.t === 'sel') {
      const idx = clamp(Math.round(drag.start - dy / 16), 0, c.options.length - 1);
      if (idx !== (ui()[c.p] ?? c.def)) set(c.p, idx);
      showTip(e, c, idx);
    } else if (c.t === 'mic' && c.geom) {
      set(`_m${c.idx}x`, clamp(drag.start.x + dx / (c.geom.gw * z), 0, 1));
      set(`_m${c.idx}y`, clamp(drag.start.y + dy / (c.geom.gh * z), 0, 1));
    }
  });
  const end = (e) => {
    const dr = drag;
    drag = null;
    hideTip();
    if (!dr) return;
    const c = dr.c;
    if (c.t === 'screen') {
      if (dr.screen) screenPointer(dr.screen, nv, 'up', local(e, c), e, ed);
      return;
    }
    if (c.t === 'foot') return footUp(c, dr.view, dr);
    if (c.t === 'button') dr.view.press && dr.view.press(false);
    if (dr.moved || e.type === 'pointercancel') return;
    const u = ui();
    if (c.t === 'sel' && !dr.alt) {
      const n = c.options.length;
      set(c.p, ((u[c.p] ?? c.def ?? 0) + (e.shiftKey ? n - 1 : 1)) % n);
    } else if (c.t === 'toggle') set(c.p, ((u[c.p] ?? c.def ?? 0) + 1) % c.options.length);
    else if (c.t === 'button') buttonAction(c);
    else if (c.t === 'treadle' && (d.toeSwitch || !d.noBypassClick)) setBy(!block.bypass);
    else if (c.t === 'mic') { sui().selMic = c.idx; if (e.shiftKey) set(`m${c.idx}type`, (((u[`m${c.idx}type`] ?? 0) | 0) + 1) % MIC_TYPES.length); }
    nv.updateControls();
  };
  root.addEventListener('pointerup', end);
  root.addEventListener('pointercancel', end);
  root.addEventListener('wheel', (e) => {
    const entry = hit(e);
    if (!entry) return;
    e.preventDefault();
    const c = entry.ctl, u = ui(), dir = e.deltaY < 0 ? 1 : -1;
    if (c.t === 'screen') {
      const s = screenOf(c);
      if (s) screenPointer(s, nv, 'wheel', local(e, c), e, ed);
      return;
    }
    if (c.t === 'mic') return set(`m${c.idx}dist`, clamp((u[`m${c.idx}dist`] ?? 0.15) - dir * 0.04, 0, 1));
    const alt = sui().alt && c.alt, p = alt ? c.alt : c.p;
    if (!p) return;
    if (c.t === 'knob' || c.t === 'slider' || c.t === 'treadle') {
      const pos = clamp((alt ? sbAltPos(p, u[p]) : knobPos(c, u[p] ?? c.def ?? 0)) + dir * (e.shiftKey ? 0.005 : 0.025), 0, 1);
      const val = alt ? sbAltVal(p, pos) : knobValue(c, pos);
      set(p, val);
      showTip(e, c, val, alt);
    } else if (c.t === 'sel') {
      const v = clamp((u[c.p] ?? c.def ?? 0) + dir, 0, c.options.length - 1);
      set(c.p, v);
      showTip(e, c, v);
    } else return;
    clearTimeout(root._tipT);
    root._tipT = setTimeout(hideTip, 700);
  }, { passive: false });
  root.addEventListener('dblclick', (e) => {
    const entry = hit(e);
    if (!entry) return;
    const c = entry.ctl;
    if (c.t === 'screen') {
      const s = screenOf(c);
      if (s) screenPointer(s, nv, 'dbl', local(e, c), e, ed);
    } else if (c.p && (c.t === 'knob' || c.t === 'slider')) set(c.p, c.def ?? 0.5);
  });
  return close;
}

async function install(kind) {
  try {
    const m = await window.tz.plugins.install(kind);
    if (!m) return;
    await reloadPlugins();
    toast(`Installed “${m.name || m.id}”`, 'ok');
    renderPlugins();
  } catch (e) {
    toast('Could not install plugin: ' + (e.message || e), 'err', 5000);
  }
}

bus.on('catalog', () => {
  const v = document.getElementById('view-plugins');
  if (v && v.classList.contains('active')) renderPlugins();
});
