'use strict';
// Circuits from the Pedal Factory circuit editor: one JSON per circuit in <data>/circuits, plus a PNG of it.
const fs = require('fs');
const path = require('path');

const safe = (id) => String(id || '').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);

function setup(ipcMain, dataRoot) {
  const dir = path.join(dataRoot, 'circuits');
  const ensure = () => fs.mkdirSync(dir, { recursive: true });
  ipcMain.handle('circuits:list', () => {
    ensure();
    const out = [];
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith('.json')) continue;
      try {
        const rec = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
        if (rec && rec.id && rec.graph) out.push(rec);
      } catch {
        /* skip broken files */
      }
    }
    return out.sort((a, b) => (a.savedAt || 0) - (b.savedAt || 0));
  });
  ipcMain.handle('circuits:save', (_e, rec) => {
    if (!rec || !safe(rec.id) || !rec.graph) throw new Error('bad circuit');
    ensure();
    const file = path.join(dir, safe(rec.id));
    fs.writeFileSync(file + '.json.tmp', JSON.stringify(rec));
    fs.renameSync(file + '.json.tmp', file + '.json');
    const m = /^data:image\/png;base64,(.+)$/.exec(rec.thumb || '');
    if (m) fs.writeFileSync(file + '.png', Buffer.from(m[1], 'base64'));
    return true;
  });
  ipcMain.handle('circuits:delete', (_e, id) => {
    fs.rmSync(path.join(dir, safe(id) + '.json'), { force: true });
    fs.rmSync(path.join(dir, safe(id) + '.png'), { force: true });
    return true;
  });
}

module.exports = { setup };
