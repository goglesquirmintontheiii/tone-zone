// Library page: imported NAM model packs and IR packs, import flow (multi-file, folders, .zip).
import { el, esc, bus, toast } from '../util.js';
import { modal, confirmDlg } from '../menus.js';
import { setPacks, getPackDefs } from '../catalog/index.js';
import { thumbImg } from '../gfx/raster.js';

const PACK_COLORS = ['#8a5cf6', '#ff7a2f', '#e8473d', '#2ecc71', '#3498db', '#1abc9c', '#f1c40f', '#e84393', '#c9a64e', '#7f8c8d', '#2d3436', '#d35400'];
const CATS = [
  ['amp', 'Amp (head graphic)'],
  ['pedal', 'Pedal'],
  ['preamp', 'Preamp (rack graphic)'],
  ['cab', 'Cab'],
];

export async function refreshPacks() {
  const packs = await window.tz.lib.list();
  setPacks(packs);
  bus.emit('packs');
  renderLibrary();
  return packs;
}

// Show the import dialog for a staged set of files. Returns created packs.
export function importDialog(info, opts = {}) {
  return new Promise((resolve) => {
    if (!info || (!info.items.length && !info.errors.length)) return resolve([]);
    if (!info.items.length) {
      toast('Nothing importable found: ' + info.errors.join('; '), 'err', 6000);
      window.tz.lib.discard(info.stagingId);
      return resolve([]);
    }
    const nams = info.items.filter((i) => i.kind === 'nam');
    const irs = info.items.filter((i) => i.kind === 'ir');
    const wrap = el('div');
    const fg = el('div', { class: 'form-grid' }, wrap);
    el('label', {}, fg).textContent = 'Block name';
    const name = el('input', { type: 'text', value: info.suggestedName || 'Imported' }, fg);
    let category = info.suggestedCategory || 'amp';
    if (nams.length) {
      el('label', {}, fg).textContent = 'Use NAM models as';
      const seg = el('div', { class: 'seg' }, fg);
      for (const [k, l] of CATS) {
        const b = el('button', { class: k === category ? 'on' : '' }, seg, l.split(' ')[0]);
        b.onclick = () => {
          category = k;
          seg.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
        };
      }
    }
    el('label', {}, fg).textContent = 'Colour';
    const cr = el('div', { class: 'color-row' }, fg);
    let color = PACK_COLORS[Math.floor(Math.random() * 4)];
    for (const c of PACK_COLORS) {
      const i = el('i', { style: { background: c }, class: c === color ? 'on' : '' }, cr);
      i.onclick = () => {
        color = c;
        cr.querySelectorAll('i').forEach((x) => x.classList.toggle('on', x === i));
      };
    }
    const summary = el('p', { style: { color: 'var(--muted)', margin: '14px 0 0' } }, wrap);
    summary.textContent = `${nams.length} NAM model${nams.length === 1 ? '' : 's'}${irs.length ? `, ${irs.length} IR${irs.length === 1 ? '' : 's'}` : ''} → ${nams.length > 1 || irs.length > 1 ? 'one block with selectable configurations' : 'one block'}.`;
    const list = el('div', { class: 'model-list' }, wrap);
    for (const it of info.items) {
      const r = el('div', { class: 'mrow' }, list);
      const cb = el('input', { type: 'checkbox', checked: '' }, r);
      cb.onchange = () => (it.include = cb.checked);
      const lab = el('input', { type: 'text', value: it.short || it.name }, r);
      lab.oninput = () => (it.label = lab.value);
      const m = it.meta || {};
      el('span', { class: 'tag' }, r).textContent = it.kind === 'nam' ? [m.architecture, m.gearType, m.toneType].filter(Boolean).join(' · ') || 'NAM' : `IR · ${m.channels || 1}ch · ${m.sampleRate ? m.sampleRate / 1000 + 'k' : ''}`;
      el('span', { class: 'tag' }, r).textContent = it.kind === 'nam' ? (m.slimmable ? 'A2 slimmable' : m.version ? 'v' + m.version : '') : (m.bits || '') + (m.bits ? '-bit' : '');
    }
    if (info.errors.length) el('p', { style: { color: 'var(--warn)', fontSize: '12px' } }, wrap).textContent = 'Skipped: ' + info.errors.join('; ');
    let committed = false;
    modal({
      title: opts.title || 'Import into Tone Zone',
      subtitle: info.origin === 'tone3000' ? 'Downloaded from TONE3000' : 'Multiple models become one block with a model selector',
      body: wrap,
      width: '760px',
      buttons: [
        { label: 'Cancel', value: null },
        {
          label: 'Import',
          cls: 'btn-accent',
          onClick: async () => {
            const packs = await window.tz.lib.commit({ stagingId: info.stagingId, name: name.value.trim() || 'Imported', category, color, items: info.items, origin: info.origin });
            committed = true;
            await refreshPacks();
            toast(`Imported “${name.value.trim()}” – find it under Imported in the block browser`, 'ok', 4000);
            resolve(packs);
          },
        },
      ],
      onClose: () => {
        if (!committed) {
          window.tz.lib.discard(info.stagingId);
          resolve([]);
        }
      },
    });
  });
}

export async function importFiles(kind) {
  const info = await window.tz.lib.pickFiles(kind);
  if (info) return importDialog(info);
}

export function renderLibrary() {
  const v = document.getElementById('view-library');
  if (!v) return;
  v.innerHTML = '';
  const page = el('div', { class: 'page' }, v);
  const head = el('div', { class: 'page-head' }, page);
  el('div', {}, head, '<h1>Library</h1><p>Your NAM captures and impulse responses. Several models in one pack become a single block with a configuration selector.</p>');
  const act = el('div', { class: 'actions' }, head);
  el('button', { class: 'btn', onclick: () => window.tz.lib.openFolder() }, act, '<i class="ic ic-folder"></i>Open folder');
  el('button', { class: 'btn', onclick: async () => { const i = await window.tz.lib.pickFolder(); if (i) importDialog(i); } }, act, '<i class="ic ic-folder"></i>Import folder');
  el('button', { class: 'btn btn-accent', onclick: () => importFiles() }, act, '<i class="ic ic-import"></i>Import .nam / .wav / .zip');
  const packs = getPackDefs();
  if (!packs.length) {
    el('div', { class: 'empty-state' }, page, '<i class="ic ic-lib big"></i><h3>No models yet</h3><p>Import NAM models (A1, A2 / slimmable, LSTM…) or IRs, drop files anywhere on the window, or grab them from the TONE3000 tab.</p>');
    return;
  }
  for (const kind of ['nam', 'ir']) {
    const ds = packs.filter((d) => d.pack.kind === kind);
    if (!ds.length) continue;
    el('h3', { style: { margin: '26px 0 12px', color: 'var(--text2)' } }, page).textContent = kind === 'nam' ? 'Neural Amp Models' : 'Impulse Responses';
    const cards = el('div', { class: 'cards' }, page);
    for (const d of ds) {
      const p = d.pack;
      const card = el('div', { class: 'card' }, cards);
      const art = el('div', { class: 'card-art' }, card);
      art.appendChild(thumbImg(d, 200));
      el('h3', {}, card).textContent = p.name;
      el('div', { class: 'sub' }, card).textContent = `${p.models.length} ${p.models.length === 1 ? 'model' : 'configurations'} · ${kind === 'nam' ? p.category : 'cab IR'} · ${p.origin === 'tone3000' ? 'TONE3000' : 'imported'}`;
      const tags = el('div', { class: 'row' }, card);
      const archs = [...new Set(p.models.map((m) => m.meta?.architecture).filter(Boolean))];
      for (const a of archs) el('span', { class: 'pill teal' }, tags).textContent = a;
      if (p.models.some((m) => m.meta?.slimmable)) el('span', { class: 'pill orange' }, tags).textContent = 'A2 slimmable';
      const row = el('div', { class: 'row' }, card);
      el('button', { class: 'btn small btn-accent', onclick: () => bus.emit('addToBoard', d.id) }, row, '<i class="ic ic-plus"></i>Add to board');
      el('button', {
        class: 'btn small',
        onclick: () => editPack(p),
      }, row, '<i class="ic ic-edit"></i>Edit');
      el('button', {
        class: 'btn small btn-danger',
        onclick: async () => {
          if (await confirmDlg('Delete pack', `Delete “${p.name}” and its ${p.models.length} file(s) from your library?`, 'Delete', true)) {
            await window.tz.lib.remove(p.id);
            refreshPacks();
          }
        },
      }, row, '<i class="ic ic-trash"></i>');
    }
  }
  void esc;
}

function editPack(p) {
  const wrap = el('div');
  const fg = el('div', { class: 'form-grid' }, wrap);
  el('label', {}, fg).textContent = 'Name';
  const name = el('input', { type: 'text', value: p.name }, fg);
  let category = p.category;
  if (p.kind === 'nam') {
    el('label', {}, fg).textContent = 'Graphic';
    const seg = el('div', { class: 'seg' }, fg);
    for (const [k, l] of CATS) {
      const b = el('button', { class: k === category ? 'on' : '' }, seg, l.split(' ')[0]);
      b.onclick = () => {
        category = k;
        seg.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
      };
    }
  }
  el('label', {}, fg).textContent = 'Colour';
  const cr = el('div', { class: 'color-row' }, fg);
  let color = p.color;
  for (const c of PACK_COLORS) {
    const i = el('i', { style: { background: c }, class: c === color ? 'on' : '' }, cr);
    i.onclick = () => {
      color = c;
      cr.querySelectorAll('i').forEach((x) => x.classList.toggle('on', x === i));
    };
  }
  const list = el('div', { class: 'model-list' }, wrap);
  const names = p.models.map((m) => m.name);
  p.models.forEach((m, i) => {
    const r = el('div', { class: 'mrow', style: { gridTemplateColumns: '24px 1fr 200px' } }, list);
    el('span', {}, r).textContent = i + 1;
    const inp = el('input', { type: 'text', value: m.name }, r);
    inp.oninput = () => (names[i] = inp.value);
    el('span', { class: 'tag' }, r).textContent = m.file;
  });
  modal({
    title: 'Edit pack',
    body: wrap,
    buttons: [
      { label: 'Cancel' },
      { label: 'Save', cls: 'btn-accent', onClick: async () => { await window.tz.lib.update(p.id, { name: name.value, category, color, modelNames: names }); await refreshPacks(); bus.emit('packsEdited'); } },
    ],
  });
}
