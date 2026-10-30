// Pedal Factory: "My pedals", every saved custom pedal with a picture. Open one to edit (saving updates the block
// everywhere it is used), test it, duplicate it or delete it.
import { el, toast } from '../util.js';
import { customBlocks, saveCustomBlock, deleteCustomBlock } from '../catalog/custom.js';
import { thumb } from './factory-render.js';
import { getDef } from '../catalog/index.js';
import { state } from '../state.js';

const clone = (o) => JSON.parse(JSON.stringify(o));
let filter = '';

/**
 * layer: the overlay element. api: { migrate(d), current() (block id being edited), edit(design, test), close() }
 */
export function openLibrary(layer, api) {
  layer.textContent = '';
  layer.classList.add('show');
  const box = el('div', { class: 'fz-tpl fz-lib' }, layer);
  const head = el('header', {}, box);
  el('div', {}, head, '<h2>My pedals</h2><p>Every pedal you saved as a block. Saving an opened pedal updates it everywhere it is used.</p>');
  const q = el('input', { type: 'search', class: 'fz-lib-search', placeholder: 'Search', id: 'fzLibSearch' }, head);
  q.value = filter;
  el('button', { class: 'icon-btn', title: 'Close', onclick: api.close }, head, '<i class="ic ic-x"></i>');
  const body = el('div', { class: 'fz-tpl-body' }, box);
  const draw = () => {
    body.textContent = '';
    const all = customBlocks().slice().sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
    const f = filter.trim().toLowerCase();
    const list = f ? all.filter((r) => (r.design.name || '').toLowerCase().includes(f)) : all;
    if (!all.length) {
      el('p', { class: 'fz-lib-empty' }, body).textContent = 'No saved pedals yet. Design one, then press Save as block.';
      return;
    }
    if (!list.length) {
      el('p', { class: 'fz-lib-empty' }, body).textContent = 'Nothing matches.';
      return;
    }
    const grid = el('div', { class: 'fz-tpl-grid' }, body);
    const used = new Map();
    for (const b of state.preset?.blocks || []) used.set(b.type, (used.get(b.type) || 0) + 1);
    for (const rec of list) {
      const d = api.migrate(clone(rec.design));
      d.blockId = rec.id;
      const card = el('div', { class: 'fz-tpl-card mine fz-lib-card' + (api.current() === rec.id ? ' open' : ''), 'data-lib': rec.id }, grid);
      const art = el('div', { class: 'art', title: 'Open to edit' }, card);
      try {
        art.appendChild(thumb(d));
      } catch (e) {
        console.warn('pedal thumbnail', rec.id, e);
      }
      art.onclick = () => api.edit(d, false);
      el('b', {}, card).textContent = d.name || 'Pedal';
      el('small', {}, card).textContent = getDef(rec.id)?.typeName || 'Custom pedal';
      const n = used.get(rec.id) || 0;
      el('small', { class: 'fz-lib-meta' }, card).textContent = `Saved ${new Date(rec.savedAt || 0).toLocaleDateString()}` + (n ? ' · on the board' + (n > 1 ? ` ${n} times` : '') : '') + (api.current() === rec.id ? ' · open now' : '');
      const ar = el('div', { class: 'fz-actrow' }, card);
      el('button', { class: 'btn small btn-accent', 'data-act': 'edit', onclick: () => api.edit(d, false) }, ar, 'Edit');
      el('button', { class: 'btn small', 'data-act': 'test', title: 'Open it and play it with your guitar', onclick: () => api.edit(d, true) }, ar, 'Test');
      el('button', { class: 'btn small', 'data-act': 'dup', onclick: async () => {
        const copy = clone(rec.design);
        delete copy.blockId;
        copy.name = (copy.name || 'Pedal') + ' copy';
        try {
          await saveCustomBlock(copy, { asNew: true });
          toast(`Made "${copy.name}"`, 'ok', 1800);
        } catch (e) {
          toast('Could not copy the pedal: ' + (e.message || e), 'err', 4000);
        }
        draw();
      } }, ar, 'Duplicate');
      const del = el('button', { class: 'btn small', 'data-act': 'del' }, ar, 'Delete');
      del.onclick = async () => {
        if (!del.classList.contains('sure')) {
          del.classList.add('sure');
          del.textContent = n ? 'Delete? It is on the board' : 'Delete for good?';
          return;
        }
        await deleteCustomBlock(rec.id);
        api.deleted && api.deleted(rec.id);
        draw();
      };
    }
  };
  q.oninput = () => {
    filter = q.value;
    draw();
  };
  draw();
  layer.onclick = (e) => {
    if (e.target === layer) api.close();
  };
}
