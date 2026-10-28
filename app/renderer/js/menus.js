// Context menus and modal dialogs.
import { el, esc } from './util.js';

let current = null;
export function closeMenu() {
  if (current) {
    current.remove();
    current = null;
  }
}
window.addEventListener('pointerdown', (e) => {
  if (current && !current.contains(e.target)) closeMenu();
});
window.addEventListener('keydown', (e) => e.key === 'Escape' && closeMenu());

export function showMenu(x, y, items, opts = {}) {
  closeMenu();
  const layer = document.getElementById('menuLayer');
  const m = el('div', { class: 'ctx ' + (opts.cls || '') }, layer);
  for (const it of items) {
    if (it.sep) el('hr', {}, m);
    else if (it.title) el('div', { class: 'ctx-title' }, m).textContent = it.title;
    else if (it.swatches) {
      const sw = el('div', { class: 'swatches' }, m);
      for (const c of it.swatches) {
        const i = el('i', { style: { background: c }, title: c }, sw);
        i.addEventListener('click', () => {
          it.onPick(c);
          closeMenu();
        });
      }
    } else if (it.node) m.appendChild(it.node);
    else {
      const b = el('button', { disabled: it.disabled ? '' : null }, m, `${it.icon ? `<i class="ic ic-${it.icon}"></i>` : '<i class="ic" style="opacity:0"></i>'}<span>${esc(it.label)}</span>${it.kbd ? `<kbd>${esc(it.kbd)}</kbd>` : ''}`);
      b.addEventListener('click', () => {
        closeMenu();
        it.onClick && it.onClick();
      });
    }
  }
  const r = m.getBoundingClientRect();
  m.style.left = Math.min(x, window.innerWidth - r.width - 8) + 'px';
  m.style.top = Math.min(y, window.innerHeight - r.height - 8) + 'px';
  current = m;
  return m;
}

export function modal({ title, subtitle, body, buttons = [], width, onClose }) {
  const layer = document.getElementById('modalLayer');
  layer.innerHTML = '';
  const m = el('div', { class: 'modal', style: width ? { width } : null }, layer);
  const h = el('header', {}, m);
  const tt = el('div', {}, h);
  el('h2', {}, tt).textContent = title;
  if (subtitle) el('p', {}, tt).textContent = subtitle;
  const x = el('button', { class: 'icon-btn', style: { marginLeft: 'auto' } }, h, '<i class="ic ic-x"></i>');
  const bodyEl = el('div', { class: 'body' }, m);
  if (typeof body === 'string') bodyEl.innerHTML = body;
  else if (body) bodyEl.appendChild(body);
  const f = el('footer', {}, m);
  const close = (v) => {
    layer.classList.remove('show');
    layer.innerHTML = '';
    onClose && onClose(v);
  };
  x.onclick = () => close(null);
  for (const b of buttons) {
    const btn = el('button', { class: 'btn ' + (b.cls || '') }, f, b.label);
    btn.onclick = async () => {
      const r = b.onClick ? await b.onClick() : undefined;
      if (r !== false) close(b.value ?? r);
    };
  }
  layer.classList.add('show');
  layer.onclick = (e) => e.target === layer && close(null);
  return { el: m, body: bodyEl, close };
}

export function prompt(title, value = '', label = 'Name') {
  return new Promise((resolve) => {
    const wrap = el('div', { class: 'form-grid' });
    el('label', {}, wrap).textContent = label;
    const inp = el('input', { type: 'text', value }, wrap);
    const md = modal({
      title,
      body: wrap,
      buttons: [
        { label: 'Cancel', value: null },
        { label: 'OK', cls: 'btn-accent', onClick: () => inp.value.trim() || false },
      ],
      onClose: (v) => resolve(v),
    });
    setTimeout(() => inp.select(), 30);
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && inp.value.trim()) {
        md.close(inp.value.trim());
      }
    });
  });
}

export function confirmDlg(title, text, okLabel = 'OK', danger = false) {
  return new Promise((resolve) => {
    modal({
      title,
      body: `<p style="margin:0;color:var(--text2)">${esc(text)}</p>`,
      buttons: [
        { label: 'Cancel', value: false },
        { label: okLabel, cls: danger ? 'btn-danger' : 'btn-accent', value: true },
      ],
      onClose: (v) => resolve(!!v),
    });
  });
}
