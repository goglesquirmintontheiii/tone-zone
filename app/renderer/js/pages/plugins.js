// Plugins tab: one card per plugin. A card opens details and its blocks; a block opens
// a small sandbox to play with that isn't connected to anything.
import { el, esc, bus, toast, svg, clamp } from '../util.js';
import { pluginInfo, setPluginEnabled, reloadPlugins } from '../plugins.js';
import { pluginDefIds, getDef, kindOf } from '../catalog/index.js';
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
function pluginIcon(p, big = false) {
  const m = p.info.manifest, id = p.info.id;
  const h = hue(m.name || id);
  const box = el('div', { class: 'pl-icon' + (big ? ' big' : ''), style: { background: m.color ? `linear-gradient(140deg, ${m.color}, #0f1218 130%)` : `linear-gradient(140deg, hsl(${h},50%,36%), hsl(${(h + 40) % 360},55%,16%))` } });
  const blocks = iconBlocks(id);
  if (blocks.length) {
    blocks.forEach((d, i) => {
      const im = thumbImg(d, big ? 84 : 64, 'pl-icon-im');
      im.style.setProperty('--i', i);
      im.style.setProperty('--n', blocks.length);
      box.appendChild(im);
    });
  } else {
    // nothing to show (disabled or no blocks): a glyph for the plugin kind plus initials
    const glyph = m.kind === 'device' ? 'ic-plug' : m.kind === 'page' ? 'ic-list' : 'ic-plug';
    el('i', { class: 'ic ' + glyph + ' pl-icon-glyph' }, box);
    const initials = (m.short || (m.name || id).replace(/[^A-Za-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean).map((w) => w[0]).join('').slice(0, 3)).toUpperCase();
    el('span', { class: 'pl-icon-txt' }, box, esc(initials));
  }
  return box;
}

export async function renderPlugins() {
  const v = document.getElementById('view-plugins');
  v.innerHTML = '';
  const page = el('div', { class: 'page plugins-page' }, v);
  const head = el('div', { class: 'page-head' }, page, '<div><h1>Plugins</h1><p>Each brand is a plugin you can turn off or remove. You can also install your own.</p></div>');
  const acts = el('div', { class: 'page-actions' }, head);
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
    grid.innerHTML = '';
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
    for (const p of items) card(p);
  }
  function card(p) {
    const m = p.info.manifest, id = p.info.id;
    const c = el('div', { class: 'plugin-card' + (p.disabled ? ' off' : '') + (p.error ? ' err' : '') }, grid);
    c.appendChild(pluginIcon(p));
    const body = el('div', { class: 'pc-body' }, c);
    el('div', { class: 'pc-title' }, body, `${esc(m.name || id)}`);
    el('div', { class: 'pc-desc' }, body).textContent = p.error ? 'Error: ' + p.error : m.description || '';
    const cnt = counts.get(id);
    el('div', { class: 'pc-count' }, body, cnt ? `<b>${cnt.total}</b> block${cnt.total === 1 ? '' : 's'}<span>${esc(countText(cnt))}</span>` : '<span>No blocks</span>');
    const foot = el('div', { class: 'pc-foot' }, c);
    el('span', { class: 'pl-tag' + (p.info.builtin ? '' : ' user') }, foot, p.info.builtin ? 'built-in' : 'installed');
    if (m.kind && m.kind !== 'brand') el('span', { class: 'pl-tag k' }, foot, esc(m.kind));
    el('span', { class: 'pl-ver' }, foot, 'v' + esc(m.version || '?'));
    const sw = el('label', { class: 'switch', title: p.disabled ? 'Turn on' : 'Turn off' }, foot, `<input type="checkbox" ${p.disabled || p.error ? '' : 'checked'} ${p.error && !p.disabled ? 'disabled' : ''}><span></span>`);
    sw.onclick = (e) => e.stopPropagation();
    sw.querySelector('input').onchange = async (e) => {
      await setPluginEnabled(id, e.target.checked);
      toast(`${m.name || id} turned ${e.target.checked ? 'on' : 'off'}`, 'info', 1300);
      renderPlugins();
    };
    c.onclick = () => openDetail(p);
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
let sandboxSeq = 0;
function openSandbox(d) {
  const { box, close } = overlay('sandbox');
  const head = el('div', { class: 'sb-head' }, box);
  el('h3', {}, head).textContent = d.name;
  el('div', { class: 'sb-sub' }, head).textContent = [d.ref && d.ref !== 'Tone Zone original' ? 'Inspired by ' + d.ref : 'Tone Zone original', d.typeName || d.cat].filter(Boolean).join(' · ');
  if (d.desc) el('p', { class: 'sb-desc' }, box).textContent = d.desc;
  const stage = el('div', { class: 'sb-stage' }, box);
  const root = svg('svg', { class: 'sb-svg' }, stage);
  const layer = svg('g', {}, root);
  const block = { id: '__sandbox' + ++sandboxSeq, type: d.id, params: {}, x: 0, y: 0, bypass: !!d.defaultBypass };
  const nv = new NodeView(block, layer);
  // fit the block into the stage
  const pad = 30, top = d.tubesTop ? 60 : 16;
  root.setAttribute('viewBox', `${-pad} ${-top - 10} ${nv.w + pad * 2} ${nv.h + top + 40}`);
  el('div', { class: 'sb-hint' }, box).textContent = 'Drag knobs up and down, click switches and footswitches.';
  const reset = el('button', { class: 'btn small sb-reset' }, box, 'Reset');
  reset.onclick = () => { block.params = {}; block.bypass = !!d.defaultBypass; nv.render(); nv.updateControls(); nv.setBypassVisual(); };
  nv.updateControls();
  nv.setBypassVisual();
  // keep LEDs / screens alive while it's open
  const tick = setInterval(() => { if (!root.isConnected) return clearInterval(tick); nv.updateStatus(performance.now()); }, 100);

  let drag = null;
  root.addEventListener('pointerdown', (e) => {
    const t = e.target.closest('[data-ctl]');
    if (!t || !layer.contains(t)) return;
    const entry = nv.views.get(t.dataset.ctl);
    if (!entry) return;
    const c = entry.ctl;
    e.preventDefault();
    const ui = (p) => block.params[p] ?? (d.initParams || {})[p] ?? c.def ?? 0;
    if (c.t === 'knob' || c.t === 'slider' || c.t === 'treadle') {
      drag = { c, y: e.clientY, x: e.clientX, pos: knobPos(c, ui(c.p)) };
      root.setPointerCapture(e.pointerId);
    } else if (c.t === 'sel' || c.t === 'toggle') {
      const n = c.options.length;
      block.params[c.p] = ((ui(c.p) | 0) + 1) % n;
    } else if (c.t === 'foot' || (c.t === 'button' && c.action === 'bypass')) {
      if (c.action === 'bypass' || !c.action) block.bypass = !block.bypass;
      else if (c.p) block.params[c.p] = ui(c.p) ? 0 : 1;
      nv.setBypassVisual();
    } else if (c.t === 'button' && c.p) {
      block.params[c.p] = ui(c.p) ? 0 : 1;
    }
    nv.updateControls();
  });
  root.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const horiz = drag.c.orient === 'h';
    const delta = horiz ? (e.clientX - drag.x) / 160 : (drag.y - e.clientY) / 160;
    block.params[drag.c.p] = knobValue(drag.c, clamp(drag.pos + delta * (e.shiftKey ? 0.25 : 1), 0, 1));
    nv.updateControls();
  });
  const end = () => { drag = null; };
  root.addEventListener('pointerup', end);
  root.addEventListener('pointercancel', end);
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
