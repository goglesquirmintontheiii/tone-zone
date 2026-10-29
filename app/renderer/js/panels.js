// Dockable side panels: drag the inner edge to resize, or pop them out into their own window.
// The live DOM node moves between documents, so state and listeners are kept.
import { el, bus } from './util.js';

const LS = (k, v) => {
  try {
    if (v === undefined) return JSON.parse(localStorage.getItem(k) || 'null');
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    return null;
  }
};

export function makeDockable(panel, { id, side, title, min = 220, max = 640, toolHost }) {
  panel.classList.add('dockable', 'dock-' + side);
  const saved = LS('tz.panel.' + id);
  if (saved && saved.w) panel.style.width = saved.w + 'px';
  // resize handle on the edge facing the board
  const grip = el('div', { class: 'panel-resizer', title: 'Drag to resize, double-click to reset' }, panel);
  grip.addEventListener('pointerdown', (e) => {
    if (panel.classList.contains('popped')) return;
    e.preventDefault();
    grip.setPointerCapture(e.pointerId);
    const sx = e.clientX, sw = panel.getBoundingClientRect().width;
    document.body.classList.add('resizing-panel');
    const move = (ev) => {
      const dx = ev.clientX - sx;
      const w = Math.max(min, Math.min(max, side === 'left' ? sw + dx : sw - dx));
      panel.style.width = w + 'px';
      bus.emit('panelResize', id);
    };
    const up = () => {
      grip.removeEventListener('pointermove', move);
      grip.removeEventListener('pointerup', up);
      document.body.classList.remove('resizing-panel');
      LS('tz.panel.' + id, { w: Math.round(panel.getBoundingClientRect().width) });
    };
    grip.addEventListener('pointermove', move);
    grip.addEventListener('pointerup', up);
  });
  grip.addEventListener('dblclick', () => {
    panel.style.width = '';
    LS('tz.panel.' + id, {});
  });
  // pop out / dock button
  const btn = el('button', { class: 'icon-btn panel-pop', title: 'Pop out into its own window' }, toolHost || panel, '<i class="ic ic-popout"></i>');
  let win = null, placeholder = null;
  const popIn = () => {
    if (!win) return;
    const w = win;
    win = null;
    panel.classList.remove('popped');
    placeholder.replaceWith(document.adoptNode(panel));
    placeholder = null;
    btn.title = 'Pop out into its own window';
    btn.innerHTML = '<i class="ic ic-popout"></i>';
    try { w.close(); } catch {}
    bus.emit('panelDock', { id, popped: false });
  };
  const popOut = () => {
    const r = panel.getBoundingClientRect();
    win = window.open('about:blank', 'tz-panel-' + id, `width=${Math.round(Math.max(340, r.width + 40))},height=${Math.round(Math.max(600, r.height))}`);
    if (!win) return;
    const d = win.document;
    d.open();
    d.write('<!doctype html><html><head><meta charset="utf-8"></head><body class="popout-body"></body></html>');
    d.close();
    d.title = `Tone Zone - ${title}`;
    for (const n of document.querySelectorAll('link[rel=stylesheet], style')) {
      const c = n.cloneNode(true);
      if (n.href) c.href = n.href;
      d.head.appendChild(c);
    }
    placeholder = document.createComment('panel:' + id);
    panel.replaceWith(placeholder);
    panel.classList.add('popped');
    d.body.appendChild(d.adoptNode(panel));
    btn.title = 'Dock back into the main window';
    btn.innerHTML = '<i class="ic ic-dock"></i>';
    win.addEventListener('pagehide', popIn);
    win.addEventListener('beforeunload', popIn);
    // keyboard shortcuts typed in the panel window still reach the app
    d.addEventListener('keydown', (e) => {
      if (e.target.closest && e.target.closest('input, textarea, select')) return;
      window.dispatchEvent(new KeyboardEvent('keydown', e));
    });
    bus.emit('panelDock', { id, popped: true });
  };
  btn.onclick = () => (win ? popIn() : popOut());
  window.addEventListener('beforeunload', () => win && win.close());
  return { popOut, popIn, get popped() { return !!win; } };
}
