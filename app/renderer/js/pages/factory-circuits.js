// Pedal Factory: the circuit side of the factory tab. The Circuit tab is a searchable list of circuits (your own
// and the built-in ones) with pictures; "New" and "Edit" open the circuit editor over the canvas; "Use" adds a
// circuit to the pedal. Also mounts the wiring diagram and the circuit test. factory.js calls in here.
import { el, bus, toast, clamp } from '../util.js';
import { PARTS, emptyGraph, clone, newNode, graphCat } from './circuit-parts.js';
import { loadCircuits, allCircuits, circuitRec, thumbOf, saveCircuit, deleteCircuit, filterCircuits, allTags, allCats, catOf, tagsOf } from './circuit-library.js';
import { openCircuitEditor, editorOpen, currentEditor } from './circuit-editor.js';
import { mountDiagram } from './wiring-diagram.js';
import { addInstance, removeInstance, setInstanceGraph, seriesWires, instInputs, instOf, mapTo, targetInfo, mappingsOf, uid, autoMap, isV3, syncStages } from './factory-circuit.js';
import { startSolo, updateSolo, stopSolo, soloRunning } from './factory-play.js';

let api = null; // from factory.js: design, commit, refresh, select, selected, place, name, setTab, stopTest
let diagram = null, mid = null;
const LS = 'tz.circuits.filter.v1';
const F = (() => {
  try {
    return Object.assign({ q: '', tags: [], cat: '', mine: false }, JSON.parse(localStorage.getItem(LS) || '{}'));
  } catch (_) {
    return { q: '', tags: [], cat: '', mine: false };
  }
})();
const saveF = () => {
  try {
    localStorage.setItem(LS, JSON.stringify(F));
  } catch (_) {
    /* ignore */
  }
};
let listHost = null, listH = null;

/** Called once by factory.js after building the tab. */
export function initCircuitUI(midEl, a) {
  api = a;
  mid = midEl;
  loadCircuits();
  diagram = mountDiagram(mid, {
    design: () => api.design(),
    commit: () => api.commit(),
    refresh: () => api.refresh(),
    select: (id) => api.select(id),
    selected: () => api.selected(),
    name: (c) => api.name(c),
    editInst: (id) => editInstance(id),
    removeInst: (id) => {
      removeInstance(api.design(), id);
      api.commit();
      api.refresh();
    },
    showList: () => api.setTab('circuit'),
    wireInRow: () => {
      seriesWires(api.design());
      api.commit();
      api.refresh();
    },
  });
  bus.on('circuits', () => listHost && listHost.isConnected && renderCircuitTab(listHost, listH));
  window.__tzCircuits = {
    list: () => allCircuits().map((r) => ({ id: r.id, name: r.name, builtin: !!r.builtin, tags: tagsOf(r), cat: catOf(r), thumb: !!(r.thumb || r.builtin) })),
    rec: (id) => clone(circuitRec(id)),
    filter: (f) => filterCircuits(f).map((r) => r.id),
    editor: () => currentEditor(),
    editorOpen: () => editorOpen(),
    diagram: () => diagram,
    openNew: () => openNew(),
    edit: (id) => editLibrary(id),
    editInst: (id) => editInstance(id),
    use: (id) => useCircuit(circuitRec(id)),
    save: (rec, o) => saveCircuit(rec, o),
    remove: (id) => deleteCircuit(id),
    solo: () => soloRunning(),
  };
}
export const refreshCircuitUI = () => diagram && diagram.refresh();
/** factory.js asks before handling a key: the editor and the diagram handle their own. */
export function circuitKeysBusy(e) {
  if (editorOpen()) return true;
  const t = e && e.target;
  return !!(t && t.closest && t.closest('.fz-wd, .cz-modal'));
}

// ------------------------------------------------------------------ editor
const testHooks = () => ({
  start: (g, name) => {
    api.stopTest && api.stopTest();
    startSolo(g, name);
  },
  update: (g, name) => updateSolo(g, name),
  stop: () => stopSolo(),
  running: () => soloRunning(),
});
function openEditor(rec, onSaved, title) {
  // the editor covers the pedal canvas, the wiring diagram and the inspector
  const host = mid.parentNode;
  const ed = openCircuitEditor({
    host,
    rec,
    title,
    test: testHooks(),
    onSave: async (r, o) => {
      const saved = await saveCircuit(r, o);
      if (onSaved) onSaved(saved);
      // pedals using this circuit (the one open) follow the library
      const D = api.design();
      let n = 0;
      for (const inst of D.circuit.insts || [])
        if (inst.ref === saved.id) {
          setInstanceGraph(D, inst, saved.graph, { name: saved.name, ver: saved.ver });
          n++;
        }
      if (n) {
        api.commit();
        api.refresh();
      }
      return saved;
    },
    onClose: () => api.refresh(),
  });
  ed.root.style.left = mid.offsetLeft + 6 + 'px';
  return ed;
}
export function openNew() {
  const g = emptyGraph();
  g.nodes.push(newNode('knob', 40, 240, { name: 'Level', def: 0.5 }));
  return openEditor({ name: '', desc: '', tags: [], graph: g }, null, 'New circuit');
}
export function editLibrary(id) {
  const r = circuitRec(id);
  if (!r) return null;
  return openEditor(clone(r), null, r.builtin ? 'Built-in circuit' : 'Edit circuit');
}
/** Edit the circuit an instance runs: saving updates the library circuit and this pedal. */
export function editInstance(id) {
  const D = api.design();
  const inst = instOf(D.circuit, id);
  if (!inst) return null;
  const lib = inst.ref && circuitRec(inst.ref);
  const rec = { ...(lib ? clone(lib) : { name: inst.name, desc: '', tags: [] }), name: inst.name, graph: clone(inst.graph) };
  if (!lib || lib.builtin) delete rec.id;
  return openEditor(rec, (saved) => {
    const D2 = api.design();
    const i2 = instOf(D2.circuit, id);
    if (i2) {
      setInstanceGraph(D2, i2, saved.graph, { ref: saved.id, ver: saved.ver, name: saved.name });
      api.commit();
      api.refresh();
    }
  }, 'In this pedal: ' + inst.name);
}

// ------------------------------------------------------------------ using a circuit in the pedal
const titleUp = (s) => String(s || '').toUpperCase().slice(0, 10);
/** Add circuit rec to the pedal: wire it in before the outputs and give its inputs controls. */
export function useCircuit(rec, o = {}) {
  if (!rec) return null;
  const D = api.design();
  const C = D.circuit;
  const last = C.insts[C.insts.length - 1];
  const inst = addInstance(D, rec, last ? { x: (last.x || 0) + 250, y: last.y || 0 } : { x: 0, y: 0 });
  // free controls take the new inputs, the rest get new knobs and switches
  autoMap(D);
  const used = new Set();
  for (const c of D.ctls) for (const m of [...mappingsOf(c), ...(c.maps || [])]) if (m && m.to) used.add(m.to);
  const free = (kinds) => D.ctls.find((c) => kinds.includes(c.kind) && !mappingsOf(c).length && !c.hidden);
  if (o.controls !== false)
    for (const k of instInputs(inst)) {
      const to = inst.id + '.' + k.id;
      if (used.has(to)) continue;
      const info = targetInfo(C, to);
      let c = info.i ? free(['toggle', 'sel']) : free(['knob', 'slider', 'trim']);
      if (!c) {
        if (info.i) {
          const n = info.max + 1;
          c = n <= 3 ? { id: uid('t'), kind: 'toggle', ways: Math.max(2, n), orient: 'v', opts: (info.opts || []).map((x) => titleUp(x).slice(0, 5)), pos: info.def | 0, label: '', labelPos: 'none' }
            : { id: uid('r'), kind: 'sel', n, r: 6, style: 'boss', opts: (info.opts || []).map((x) => titleUp(x).slice(0, 5)), pos: info.def | 0, label: titleUp(k.name), labelPos: 'below' };
        } else c = { id: uid('k'), kind: 'knob', style: 'boss', r: 6.5, value: info.def ?? 0.5, ticks: false, label: titleUp(k.name), labelPos: 'below' };
        D.ctls.push(c);
        Object.assign(c, api.place(c));
      }
      const n = c.kind === 'toggle' ? c.ways : c.kind === 'sel' ? c.n || 4 : 0;
      c.map = mapTo(C, to, n && info.i ? { max: Math.min(info.max, n - 1) } : {});
      if (!c.label && c.kind !== 'toggle') c.label = titleUp(k.name);
      used.add(to);
    }
  syncStages(C);
  api.commit();
  api.refresh();
  return inst;
}

// ------------------------------------------------------------------ the Circuit tab
export function renderCircuitTab(host, H) {
  listHost = host;
  listH = H;
  const D = api && api.design();
  host.textContent = '';
  host.classList.add('cl-pane');
  const top = el('div', { class: 'cl-top' }, host);
  const q = el('input', { type: 'text', class: 'cl-search', placeholder: 'Search circuits', 'data-cl': 'search' }, top);
  q.value = F.q;
  el('button', { class: 'btn small btn-accent', 'data-cl': 'new', title: 'Make a new circuit in the editor', onclick: () => openNew() }, top, '<i class="ic ic-plus"></i>New');
  const fr = el('div', { class: 'cl-filters' }, host);
  const cs = el('select', { class: 'cl-cat', 'data-cl': 'cat' }, fr);
  el('option', { value: '' }, cs).textContent = 'All kinds';
  for (const c of allCats()) el('option', { value: c }, cs).textContent = c;
  cs.value = F.cat;
  const mine = el('button', { class: 'chip sm' + (F.mine ? ' on' : ''), 'data-cl': 'mine', title: 'Only the circuits you made' }, fr);
  mine.textContent = 'Mine';
  const tagRow = el('div', { class: 'cl-tags' }, host);
  const tags = allTags().slice(0, 16);
  for (const t of new Set([...F.tags, ...tags])) {
    const b = el('button', { class: 'chip sm' + (F.tags.includes(t) ? ' on' : ''), 'data-tag': t }, tagRow);
    b.textContent = t;
    b.onclick = () => {
      F.tags = F.tags.includes(t) ? F.tags.filter((x) => x !== t) : [...F.tags, t];
      saveF();
      renderCircuitTab(host, H);
    };
  }
  // in this pedal
  if (D && isV3(D.circuit) && D.circuit.insts.length) {
    const s = el('div', { class: 'cl-inpedal' }, host);
    el('h6', {}, s).textContent = 'In this pedal';
    for (const inst of D.circuit.insts) {
      const r = el('div', { class: 'cl-inst', 'data-inst': inst.id }, s);
      el('span', {}, r).textContent = inst.name || 'Circuit';
      el('button', { class: 'fz-lbtn', title: 'Edit this circuit', 'data-cl': 'editinst', onclick: () => editInstance(inst.id) }, r, '<i class="ic fz-ic-edit"></i>');
      el('button', { class: 'fz-lbtn', title: 'Take it out of the pedal', 'data-cl': 'rminst', onclick: () => { removeInstance(api.design(), inst.id); api.commit(); api.refresh(); } }, r, '<i class="ic ic-x"></i>');
    }
  }
  const list = el('div', { class: 'cl-list', 'data-cl': 'list' }, host);
  const paint = () => {
    list.textContent = '';
    const res = filterCircuits(F);
    const inUse = new Set(((D && D.circuit && D.circuit.insts) || []).map((i) => i.ref).filter(Boolean));
    if (!res.length) el('p', { class: 'fz-note' }, list).textContent = 'No circuits match. Clear the search or the tags, or make a new one.';
    for (const r of res.slice(0, 200)) {
      const it = el('div', { class: 'cl-item' + (r.builtin ? ' builtin' : ' mine'), 'data-circuit-id': r.id }, list);
      const img = el('img', { class: 'cl-thumb', alt: '', draggable: 'false', loading: 'lazy' }, it);
      img.src = thumbOf(r);
      img.onclick = () => editLibrary(r.id);
      const m = el('div', { class: 'cl-meta' }, it);
      const h = el('div', { class: 'cl-name' }, m);
      el('b', {}, h).textContent = r.name;
      el('span', { class: 'cl-badge' }, h).textContent = r.builtin ? 'Built in' : 'Mine';
      if (inUse.has(r.id)) el('span', { class: 'cl-badge use' }, h).textContent = 'In use';
      if (r.desc) el('p', { class: 'cl-desc' }, m).textContent = r.desc;
      const tg = el('div', { class: 'cl-itags' }, m);
      el('span', { class: 'cl-cat' }, tg).textContent = catOf(r);
      for (const t of tagsOf(r).slice(0, 5)) el('span', {}, tg).textContent = t;
      const ar = el('div', { class: 'cl-acts' }, m);
      el('button', { class: 'btn small btn-accent', 'data-cl': 'use', title: 'Add it to this pedal', onclick: () => { useCircuit(r); toast(`Added "${r.name}" to the pedal`, 'ok', 1600); } }, ar, 'Use');
      el('button', { class: 'btn small', 'data-cl': 'edit', onclick: () => editLibrary(r.id) }, ar, 'Edit');
      el('button', { class: 'btn small', 'data-cl': 'dup', title: 'Make your own copy', onclick: async () => { const c = clone(r); delete c.id; c.name = r.name + ' copy'; await saveCircuit(c, { asNew: true }); } }, ar, 'Duplicate');
      if (!r.builtin) {
        const del = el('button', { class: 'btn small', 'data-cl': 'del' }, ar, 'Delete');
        del.onclick = async () => {
          if (!del.classList.contains('sure')) {
            del.classList.add('sure');
            del.textContent = 'Delete for good?';
            return;
          }
          await deleteCircuit(r.id);
        };
      }
    }
  };
  q.oninput = () => {
    F.q = q.value;
    saveF();
    paint();
  };
  cs.onchange = () => {
    F.cat = cs.value;
    saveF();
    paint();
  };
  mine.onclick = () => {
    F.mine = !F.mine;
    saveF();
    renderCircuitTab(host, H);
  };
  paint();
  el('p', { class: 'fz-note' }, host).textContent = 'Circuits are kept apart from pedals, so every pedal can use them. Wire them up in the diagram under the pedal.';
}
