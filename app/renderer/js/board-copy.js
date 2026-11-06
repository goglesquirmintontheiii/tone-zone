// Duplicating, copying and pasting pedalboards: a board comes with the pedals on it and the cables between
// those pedals (cables to blocks off the board stay behind). The copy goes somewhere free, pedals in their slots.
// Selections without a board keep the plain behaviour (state.duplicateBlocks, app.js paste).
import { state, blockById, commitNow, syncGraph, setDuplicateHook } from './state.js';
import { bus } from './util.js';

const ed = () => window.__tz && window.__tz.editor;
const newId = (p) => p + Math.random().toString(36).slice(2, 10);
const clone = (o) => JSON.parse(JSON.stringify(o));

// the selected boards with their pedals, plus the other selected blocks. null when no board is selected.
function gather(ids) {
  const E = ed();
  if (!E) return null;
  const boards = ids.filter((id) => E.views.get(id)?.def.pedalboard);
  if (!boards.length) return null;
  const all = ids.filter((id) => !id.startsWith('__') && blockById(id));
  const groups = new Map(); // block id -> board id it travels with
  for (const b of boards) for (const m of E.boardMembers(b)) { groups.set(m, b); if (!all.includes(m)) all.push(m); }
  for (const b of boards) groups.set(b, b);
  // cables between two pedals on the same copied board
  const cables = state.preset.cables.filter((c) => groups.has(c.from.node) && groups.get(c.from.node) === groups.get(c.to.node));
  const size = (id) => { const v = E.views.get(id); return v ? [v.w, v.h] : [150, 250]; };
  const blocks = all.map((id) => Object.assign(clone(blockById(id)), { _wh: size(id) }));
  return { blocks, cables: cables.map(clone) };
}

// how far to move the copy so its bounding box hits nothing: below the original first, then to the right
function freeOffset(blocks) {
  const E = ed();
  const box = (b) => ({ x0: b.x, y0: b.y, x1: b.x + b._wh[0], y1: b.y + b._wh[1] });
  const bb = blocks.map(box).reduce((a, r) => ({ x0: Math.min(a.x0, r.x0), y0: Math.min(a.y0, r.y0), x1: Math.max(a.x1, r.x1), y1: Math.max(a.y1, r.y1) }));
  const taken = [...E.views.values()].map((v) => ({ x0: v.block.x, y0: v.block.y, x1: v.block.x + v.w, y1: v.block.y + v.h }));
  const free = (dx, dy) => !taken.some((r) => bb.x0 + dx < r.x1 + 40 && bb.x1 + dx > r.x0 - 40 && bb.y0 + dy < r.y1 + 40 && bb.y1 + dy > r.y0 - 40);
  const W = bb.x1 - bb.x0 + 80, H = bb.y1 - bb.y0 + 80;
  for (let k = 1; k < 40; k++) {
    if (free(0, k * H)) return [0, k * H];
    if (free(k * W, 0)) return [k * W, 0];
    if (free(k * W, k * H)) return [k * W, k * H];
  }
  return [0, H];
}

// put a gathered copy on the board under new ids. Returns the new blocks.
function place(copy) {
  commitNow();
  const [dx, dy] = freeOffset(copy.blocks);
  const map = new Map();
  for (const b of copy.blocks) map.set(b.id, newId('b'));
  const out = [];
  for (const b0 of copy.blocks) {
    const b = clone(b0);
    delete b._wh;
    b.id = map.get(b0.id);
    b.x = Math.round(b.x + dx);
    b.y = Math.round(b.y + dy);
    if (b.board) { if (map.has(b.board)) b.board = map.get(b.board); else delete b.board; }
    state.preset.blocks.push(b);
    bus.emit('block:added', b);
    out.push(b);
  }
  // pedals belong to their new board
  const E = ed();
  for (const b of out) {
    if (b.board || !E) continue;
    const v = E.views.get(b.id), bv = v && E.memberBoard(v);
    if (bv && out.some((o) => o.id === bv.block.id)) b.board = bv.block.id;
  }
  for (const c of copy.cables) state.preset.cables.push({ id: newId('c'), from: { node: map.get(c.from.node), port: c.from.port }, to: { node: map.get(c.to.node), port: c.to.port }, color: c.color });
  if (copy.cables.length) bus.emit('cables');
  syncGraph();
  return out;
}

// Ctrl+D and the Duplicate buttons (through state.duplicateBlocks)
setDuplicateHook((ids) => {
  const copy = gather(ids);
  return copy ? place(copy) : null;
});

// Ctrl+C: a clipboard entry that remembers the boards' pedals and cables. null: use the plain copy.
export function copyBoards(ids) {
  const copy = gather(ids);
  return copy ? { boards: true, ...copy } : null;
}
// Ctrl+V of such an entry. Returns the new block ids.
export function pasteBoards(clip) {
  return place(clip).map((b) => b.id);
}
