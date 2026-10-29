// Preset actions: load, save, save as, rename, delete, import and export.
import { el, esc, bus, toast } from './util.js';
import { state, loadPreset, serialize, newPreset, markDirty } from './state.js';
import { prompt, confirmDlg, showMenu } from './menus.js';

let list = [];

export async function refreshPresetList() {
  list = await window.tz.presets.list();
  return list;
}

export async function openPreset(file) {
  if (state.dirty && !(await confirmDlg('Unsaved changes', `Discard changes to “${state.preset.name}”?`, 'Discard', true))) return false;
  const p = await window.tz.presets.load(file);
  loadPreset(p, file);
  localStorageSafeSet('tz.lastPreset', file);
  updateTitle();
  return true;
}

export async function savePreset(asNew = false) {
  let name = state.preset.name;
  let file = state.file;
  if (asNew || !file) {
    name = await prompt(asNew ? 'Save preset as' : 'Save preset', name === 'New Preset' || asNew ? name + (asNew ? ' copy' : '') : name);
    if (!name) return;
    file = null;
  }
  state.preset.name = name;
  const p = serialize();
  p.saved = Date.now();
  state.file = await window.tz.presets.save(p, file);
  markDirty(false);
  await refreshPresetList();
  localStorageSafeSet('tz.lastPreset', state.file);
  updateTitle();
  toast(`Saved “${name}”`, 'ok', 1600);
}

export async function step(dir) {
  await refreshPresetList();
  if (!list.length) return;
  let i = list.findIndex((x) => x.file === state.file);
  i = (i + dir + list.length) % list.length;
  await openPreset(list[i].file);
}

export function updateTitle() {
  const n = document.querySelector('#presetName .pn-name');
  n.textContent = state.preset?.name || 'Untitled';
  document.getElementById('presetName').classList.toggle('dirty', !!state.dirty);
  document.title = `${state.preset?.name || 'Tone Zone'}${state.dirty ? ' •' : ''} - Tone Zone`;
}

export async function showPresetMenu(anchor) {
  await refreshPresetList();
  const r = anchor.getBoundingClientRect();
  const box = el('div', { class: 'preset-menu' });
  const head = el('div', { style: { display: 'flex', gap: '6px', padding: '4px 4px 8px', flexWrap: 'wrap' } }, box);
  const mk = (label, icon, fn) => el('button', { class: 'btn small', onclick: () => { document.getElementById('menuLayer').innerHTML = ''; fn(); } }, head, `<i class="ic ic-${icon}"></i>${label}`);
  mk('New', 'plus', async () => {
    if (state.dirty && !(await confirmDlg('Unsaved changes', 'Throw away your current changes?', 'Discard', true))) return;
    loadPreset(newPreset(), null);
    updateTitle();
  });
  mk('Save as', 'save', () => savePreset(true));
  mk('Rename', 'edit', async () => {
    const n = await prompt('Rename preset', state.preset.name);
    if (n) { state.preset.name = n; markDirty(); updateTitle(); }
  });
  mk('Import', 'import', async () => { const f = await window.tz.presets.importPresets(); if (f.length) { toast(`Imported ${f.length} preset(s)`, 'ok'); } });
  mk('Export', 'copy', () => window.tz.presets.exportPreset(serialize()));
  const l = el('div', { class: 'pm-list' }, box);
  if (!list.length) el('div', { style: { padding: '14px', color: 'var(--muted)' } }, l).textContent = 'No saved presets yet.';
  for (const p of list) {
    const it = el('div', { class: 'pm-item' + (p.file === state.file ? ' cur' : '') }, l, `<span class="n">${esc(p.name)}</span><span class="c">${p.blocks ?? ''} blocks</span>`);
    const del = el('button', { class: 'icon-btn del', title: 'Delete preset' }, it, '<i class="ic ic-trash"></i>');
    del.onclick = async (e) => {
      e.stopPropagation();
      document.getElementById('menuLayer').innerHTML = '';
      if (await confirmDlg('Delete preset', `Delete “${p.name}”?`, 'Delete', true)) {
        await window.tz.presets.remove(p.file);
        if (state.file === p.file) state.file = null;
        refreshPresetList();
      }
    };
    it.onclick = async () => {
      document.getElementById('menuLayer').innerHTML = '';
      await openPreset(p.file);
    };
  }
  showMenu(r.left, r.bottom + 6, [{ node: box }], { cls: 'preset-pop' });
}

export function localStorageSafeGet(k) {
  try { return localStorage.getItem(k); } catch (_) { return null; }
}
export function localStorageSafeSet(k, v) {
  try { localStorage.setItem(k, v); } catch (_) {}
}

bus.on('dirty', updateTitle);
