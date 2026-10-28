// Block browser sidebar: search, categories, lazily-rendered thumbnails, drag-to-board.
import { el, svg, esc, bus } from './util.js';
import { allDefs, getPackDefs, CATEGORIES, portsFor, defaultVariant } from './catalog/index.js';
import { renderForm } from './gfx/forms.js';

let filterCat = 'All';
let query = '';
let editorRef = null;

export function thumbnail(d, size = 44) {
  const s = svg('svg', { xmlns: 'http://www.w3.org/2000/svg' });
  const g = svg('g', {}, s);
  const rdef = Object.create(d);
  rdef.ports = portsFor(d, defaultVariant(d));
  try {
    const res = renderForm({ g, views: new Map(), flip: false }, rdef);
    s.setAttribute('viewBox', `-14 -14 ${res.w + 28} ${res.h + 28}`);
    const ar = res.w / res.h;
    s.setAttribute('width', ar > 1 ? size : size * ar);
    s.setAttribute('height', ar > 1 ? size / ar : size);
    // drop the heavy node shadow filter in thumbnails
    g.querySelectorAll('[filter="url(#f-node)"]').forEach((n) => n.remove());
  } catch (e) {
    console.warn('thumb', d.id, e);
  }
  return s;
}

function matches(d) {
  if (filterCat !== 'All') {
    if (filterCat === 'Real pedals' && (d.brand === 'Tone Zone' || !d.brand || d.cat === 'Amp' || d.cat === 'Cab')) return false;
    else if (filterCat === 'Imported' && !d.pack) return false;
    else if (!['Real pedals', 'Imported'].includes(filterCat) && d.cat !== filterCat && d.packCat !== filterCat) return false;
  }
  if (query) return query.split(/\s+/).every((w) => d.search.includes(w));
  return true;
}

export function initBrowser(editor) {
  editorRef = editor;
  const chips = document.getElementById('catChips');
  const cats = ['All', 'Real pedals', 'Imported', ...CATEGORIES.filter((c) => c !== 'NAM' && c !== 'IR')];
  for (const c of cats) {
    const b = el('button', { class: 'chip' + (c === filterCat ? ' on' : '') }, chips);
    b.textContent = c;
    b.onclick = () => {
      filterCat = c;
      chips.querySelectorAll('.chip').forEach((x) => x.classList.toggle('on', x === b));
      renderList();
    };
  }
  const inp = document.getElementById('blockSearch');
  inp.addEventListener('input', () => {
    query = inp.value.trim().toLowerCase();
    renderList();
  });
  bus.on('packs', renderList);
  renderList();
}

let observer = null;
export function renderList() {
  const list = document.getElementById('blockList');
  list.innerHTML = '';
  if (observer) observer.disconnect();
  observer = new IntersectionObserver(
    (entries) => {
      for (const en of entries) {
        if (!en.isIntersecting) continue;
        const item = en.target;
        observer.unobserve(item);
        const d = item._def;
        const th = item.querySelector('.thumb');
        th.innerHTML = '';
        th.appendChild(thumbnail(d, 42));
      }
    },
    { root: list, rootMargin: '200px' }
  );
  const defs = [...getPackDefs(), ...allDefs().filter((d) => !d.pack)].filter(matches);
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
    el('div', { class: 'empty-state', style: { margin: '20px 6px', padding: '30px 10px' } }, list, '<p>No blocks match.</p>');
    return;
  }
  for (const k of keys) {
    const grp = el('div', { class: 'bl-group' }, list);
    el('h4', {}, grp).textContent = k;
    for (const d of groups.get(k)) {
      const item = el('div', { class: 'bl-item', draggable: 'true', title: d.desc || d.ref || '' }, grp);
      item._def = d;
      el('div', { class: 'thumb' }, item);
      const meta = el('div', { class: 'meta' }, item);
      el('div', { class: 'name' }, meta).textContent = d.name;
      el('div', { class: 'sub' }, meta).textContent = d.ref && d.ref !== 'Tone Zone original' && d.ref !== 'Utility' ? (d.pack ? d.ref : 'Inspired by ' + d.ref) : d.typeName || d.cat;
      if (d.stereo === 'both' || d.stereo === 'stereo') el('span', { class: 'badge st' }, item).textContent = 'ST';
      else if (d.pack) el('span', { class: 'badge' }, item).textContent = d.algo === 'nam' ? 'NAM' : 'IR';
      item.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('application/x-tz-block', d.id);
        e.dataTransfer.effectAllowed = 'copy';
        const ghost = thumbnail(d, 90);
        ghost.style.position = 'absolute';
        ghost.style.left = '-500px';
        document.body.appendChild(ghost);
        e.dataTransfer.setDragImage(ghost, 45, 45);
        setTimeout(() => ghost.remove(), 0);
      });
      item.addEventListener('dblclick', () => editorRef.addNear(d.id));
      observer.observe(item);
    }
  }
  void esc;
}
