// Plugins tab: built-in brand / device plugins and user-installed plugins, with enable toggles.
import { el, esc, bus, toast } from '../util.js';
import { pluginInfo, setPluginEnabled, reloadPlugins } from '../plugins.js';
import { pluginDefIds, getDef } from '../catalog/index.js';
import { confirmDlg } from '../menus.js';
import { thumbImg } from '../gfx/raster.js';

const V = { q: '', filter: 'All', open: new Set() };

function hue(s) {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}

export function renderPlugins() {
  const v = document.getElementById('view-plugins');
  v.innerHTML = '';
  const page = el('div', { class: 'page plugins-page' }, v);
  const head = el('div', { class: 'page-head' }, page, '<div><h1>Plugins</h1><p>Every “inspired by” brand ships as a built-in plugin you can switch off. Install more from a .zip or a folder.</p></div>');
  const acts = el('div', { class: 'page-actions' }, head);
  el('button', { class: 'btn', onclick: () => install('file') }, acts, '<i class="ic ic-import"></i>Install .zip');
  el('button', { class: 'btn', onclick: () => install('folder') }, acts, '<i class="ic ic-folder"></i>Install folder');
  el('button', { class: 'btn', onclick: () => window.tz.plugins.openDir() }, acts, '<i class="ic ic-folder"></i>Plugin folder');
  el('button', { class: 'btn', onclick: async () => { await reloadPlugins(); toast('Plugins reloaded', 'ok', 1400); renderPlugins(); } }, acts, '<i class="ic ic-reload"></i>Reload');

  const all = [...pluginInfo().values()];
  const nOn = all.filter((p) => !p.disabled && !p.error).length;
  const nBlocks = all.reduce((a, p) => a + (p.count || 0), 0);
  const stats = el('div', { class: 'pl-stats' }, page);
  for (const [n, l] of [[all.length, 'plugins'], [nOn, 'enabled'], [nBlocks, 'blocks from plugins'], [all.filter((p) => !p.info.builtin).length, 'installed by you']])
    el('div', { class: 'pl-stat' }, stats, `<b>${n}</b><span>${l}</span>`);

  const tools = el('div', { class: 'pp-tools' }, page);
  const sr = el('div', { class: 'search' }, tools, '<i class="ic ic-search"></i>');
  const q = el('input', { placeholder: 'Search plugins…', value: V.q, spellcheck: 'false' }, sr);
  q.oninput = () => { V.q = q.value.trim().toLowerCase(); draw(); };
  const chips = el('div', { class: 'filter-row' }, tools);
  for (const f of ['All', 'Enabled', 'Disabled', 'Built-in', 'Installed', 'Devices']) {
    const b = el('button', { class: 'chip' + (V.filter === f ? ' on' : '') }, chips, f);
    b.onclick = () => { V.filter = f; chips.querySelectorAll('.chip').forEach((x) => x.classList.toggle('on', x === b)); draw(); };
  }
  const bulk = el('div', { class: 'pl-bulk' }, tools);
  el('button', { class: 'btn small', onclick: () => bulkSet(true) }, bulk, 'Enable all');
  el('button', { class: 'btn small', onclick: () => bulkSet(false) }, bulk, 'Disable all brands');
  const list = el('div', { class: 'pl-list' }, page);
  el('p', { class: 'hint pl-warn' }, page).textContent = 'Plugins run inside Tone Zone with the same access as the app. Only install plugins from people you trust. Presets keep blocks from disabled plugins as placeholders that pass audio through.';

  async function bulkSet(on) {
    for (const p of [...pluginInfo().values()]) {
      if (p.error && on) continue;
      if (!on && p.info.manifest.kind !== 'brand') continue;
      if (!!p.disabled === !on) continue;
      await setPluginEnabled(p.id || p.info.id, on);
    }
    renderPlugins();
  }

  function draw() {
    list.innerHTML = '';
    const items = [...pluginInfo().values()].filter((p) => {
      const m = p.info.manifest;
      if (V.filter === 'Enabled' && (p.disabled || p.error)) return false;
      if (V.filter === 'Disabled' && !p.disabled) return false;
      if (V.filter === 'Built-in' && !p.info.builtin) return false;
      if (V.filter === 'Installed' && p.info.builtin) return false;
      if (V.filter === 'Devices' && m.kind !== 'device') return false;
      if (V.q && ![m.name, m.id, m.description, m.author, m.brand].join(' ').toLowerCase().includes(V.q)) return false;
      return true;
    });
    items.sort((a, b) => (a.info.manifest.kind === 'device' ? -1 : 0) - (b.info.manifest.kind === 'device' ? -1 : 0) || (a.info.manifest.name || '').localeCompare(b.info.manifest.name || ''));
    if (!items.length) el('div', { class: 'empty-state' }, list, '<p>No plugins match.</p>');
    for (const p of items) row(p);
  }
  function row(p) {
    const m = p.info.manifest;
    const id = p.info.id;
    const r = el('div', { class: 'pl-row' + (p.disabled ? ' off' : '') + (p.error ? ' err' : '') }, list);
    const h = hue(m.name || id);
    const initials = (m.short || (m.name || id).replace(/[^A-Za-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean).map((w) => w[0]).join('').slice(0, 3)).toUpperCase();
    el('div', { class: 'pl-badge', style: { background: m.color || `linear-gradient(135deg, hsl(${h},55%,42%), hsl(${(h + 40) % 360},60%,28%))` } }, r, esc(initials));
    const mid = el('div', { class: 'pl-mid' }, r);
    el('div', { class: 'pl-name' }, mid, `${esc(m.name || id)} <span class="pl-ver">v${esc(m.version || '?')}</span>${p.info.builtin ? '<span class="pl-tag">built-in</span>' : '<span class="pl-tag user">installed</span>'}${m.kind ? `<span class="pl-tag k">${esc(m.kind)}</span>` : ''}`);
    el('div', { class: 'pl-desc' }, mid).textContent = p.error ? 'Error: ' + p.error : m.description || '';
    const ids = pluginDefIds(id);
    el('div', { class: 'pl-meta' }, mid).textContent = `${m.author ? 'by ' + m.author + ' · ' : ''}${p.disabled ? 'disabled' : ids.length + ' block' + (ids.length === 1 ? '' : 's')}`;
    const right = el('div', { class: 'pl-right' }, r);
    if (ids.length) {
      const ex = el('button', { class: 'btn small' }, right, V.open.has(id) ? 'Hide blocks' : 'Show blocks');
      ex.onclick = () => { V.open.has(id) ? V.open.delete(id) : V.open.add(id); draw(); };
    }
    if (!p.info.builtin) {
      const rm = el('button', { class: 'icon-btn', title: 'Remove plugin' }, right, '<i class="ic ic-trash"></i>');
      rm.onclick = async () => {
        if (!(await confirmDlg('Remove plugin', `Remove “${m.name || id}”? Its blocks become placeholders in presets.`, 'Remove', true))) return;
        await window.tz.plugins.remove(id);
        await reloadPlugins();
        renderPlugins();
      };
    }
    const sw = el('label', { class: 'switch', title: p.disabled ? 'Enable' : 'Disable' }, right, `<input type="checkbox" ${p.disabled || p.error ? '' : 'checked'} ${p.error && !p.disabled ? 'disabled' : ''}><span></span>`);
    sw.querySelector('input').onchange = async (e) => {
      await setPluginEnabled(id, e.target.checked);
      toast(`${m.name || id} ${e.target.checked ? 'enabled' : 'disabled'}`, 'info', 1300);
      renderPlugins();
    };
    if (V.open.has(id) && ids.length) {
      const g = el('div', { class: 'pl-blocks' }, list);
      for (const bid of ids) {
        const d = getDef(bid);
        if (!d || d.hidden) continue;
        const it = el('div', { class: 'pl-block', title: d.ref ? 'Inspired by ' + d.ref : d.name }, g);
        const th = el('div', { class: 'thumb' }, it);
        th.appendChild(thumbImg(d, 46));
        el('span', {}, it).textContent = d.name;
      }
    }
  }
  draw();
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
