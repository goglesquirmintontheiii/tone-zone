'use strict';
// Pedals saved from the Pedal Factory: one JSON file per design in <data>/custom-blocks.
const fs = require('fs');
const path = require('path');

const safe = (id) => String(id || '').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);

function setup(ipcMain, dataRoot) {
  const dir = path.join(dataRoot, 'custom-blocks');
  const ensure = () => fs.mkdirSync(dir, { recursive: true });
  ipcMain.handle('custom:list', () => {
    ensure();
    const out = [];
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith('.json')) continue;
      try {
        const rec = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
        if (rec && rec.id && rec.design) out.push(rec);
      } catch {
        /* skip broken files */
      }
    }
    return out.sort((a, b) => (a.savedAt || 0) - (b.savedAt || 0));
  });
  ipcMain.handle('custom:save', (_e, rec) => {
    if (!rec || !safe(rec.id) || !rec.design) throw new Error('bad custom block');
    ensure();
    const file = path.join(dir, safe(rec.id) + '.json');
    fs.writeFileSync(file + '.tmp', JSON.stringify(rec));
    fs.renameSync(file + '.tmp', file);
    return true;
  });
  ipcMain.handle('custom:delete', (_e, id) => {
    fs.rmSync(path.join(dir, safe(id) + '.json'), { force: true });
    return true;
  });
}

module.exports = { setup };
