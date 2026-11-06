// Dev feedback (temporary, development only): screenshots and clipboard for renderer/js/devfeedback.js.
// To remove the feature: delete this file and its require line in main.js (see devfeedback.js for the rest).
'use strict';
const { BrowserWindow, clipboard } = require('electron');

exports.setup = (ipcMain) => {
  // one channel: { op: 'capture', rect, title, max } -> { png, w, h } | { op: 'copy', text }
  ipcMain.handle('devfeedback', async (e, req) => {
    if (req.op === 'copy') return clipboard.writeText(String(req.text || '')), true;
    if (req.op !== 'capture') return null;
    // pop-out panels share the main renderer, so find their window by title
    const w = (req.title && BrowserWindow.getAllWindows().find((x) => x.getTitle() === req.title)) || BrowserWindow.fromWebContents(e.sender);
    const wc = w ? w.webContents : e.sender;
    const zf = wc.getZoomFactor() || 1;
    const r = req.rect;
    const rect = { x: Math.round(r.x * zf), y: Math.round(r.y * zf), width: Math.max(1, Math.round(r.w * zf)), height: Math.max(1, Math.round(r.h * zf)) };
    let img = await wc.capturePage(rect);
    const s = img.getSize();
    const k = Math.min(1, (req.max || 900) / Math.max(s.width, s.height, 1));
    if (k < 1) img = img.resize({ width: Math.max(1, Math.round(s.width * k)), height: Math.max(1, Math.round(s.height * k)), quality: 'best' });
    const z = img.getSize();
    return { png: img.toPNG(), jpg: req.jpeg ? img.toJPEG(req.jpeg) : null, w: z.width, h: z.height };
  });
};
