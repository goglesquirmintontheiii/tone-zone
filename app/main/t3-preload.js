// Injected into the embedded TONE3000 website: adds "Send to Tone Zone" buttons next to download controls
// and a floating Tone Zone toolbar. Downloads themselves are intercepted by the main process.
'use strict';
const { ipcRenderer } = require('electron');

const CSS = `
.tz-pill{all:unset;display:inline-flex;align-items:center;gap:6px;margin-left:8px;padding:6px 11px;border-radius:999px;
  font:600 12px/1 Inter,system-ui,sans-serif;color:#fff;cursor:pointer;
  background:linear-gradient(135deg,#ff7a18,#ff3d6e);box-shadow:0 2px 10px rgba(255,80,60,.35);transition:transform .15s,filter .15s}
.tz-pill:hover{transform:translateY(-1px);filter:brightness(1.1)}
.tz-pill svg{width:13px;height:13px}
#tz-bar{position:fixed;right:18px;bottom:18px;z-index:2147483647;display:flex;align-items:center;gap:10px;padding:10px 14px;
  border-radius:14px;background:rgba(18,20,27,.92);backdrop-filter:blur(10px);color:#e9ecf3;
  font:500 12.5px/1.2 Inter,system-ui,sans-serif;box-shadow:0 8px 30px rgba(0,0,0,.45);border:1px solid rgba(255,255,255,.08)}
#tz-bar b{color:#ff8a3d}
#tz-bar .tz-dot{width:8px;height:8px;border-radius:50%;background:#3ddc84;box-shadow:0 0 8px #3ddc84}
#tz-bar button{all:unset;cursor:pointer;padding:6px 10px;border-radius:8px;background:rgba(255,255,255,.08)}
#tz-bar button:hover{background:rgba(255,255,255,.16)}
`;
const ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></svg>';

function injectStyle() {
  if (document.getElementById('tz-style')) return;
  const s = document.createElement('style');
  s.id = 'tz-style';
  s.textContent = CSS;
  (document.head || document.documentElement).appendChild(s);
}

function isDownloadEl(el) {
  if (!el || el.dataset.tzDone) return false;
  const t = (el.innerText || el.getAttribute('aria-label') || el.title || '').trim().toLowerCase();
  const href = (el.getAttribute && el.getAttribute('href')) || '';
  return (/^(download|download all|download nam|download ir|download model|get)\b/.test(t) && t.length < 40) || /\.(nam|zip|wav)(\?|$)/i.test(href) || el.hasAttribute('download');
}

function decorate() {
  injectStyle();
  const els = document.querySelectorAll('a,button,[role="button"]');
  for (const el of els) {
    if (el.classList.contains('tz-pill') || el.closest('#tz-bar')) continue;
    if (!isDownloadEl(el)) continue;
    el.dataset.tzDone = '1';
    const pill = document.createElement('button');
    pill.className = 'tz-pill';
    pill.type = 'button';
    pill.innerHTML = ICON + 'Send to Tone Zone';
    pill.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      ipcRenderer.sendToHost('tz-intent', { title: document.title, url: location.href });
      el.click();
    });
    el.insertAdjacentElement('afterend', pill);
  }
  if (!document.getElementById('tz-bar') && document.body) {
    const bar = document.createElement('div');
    bar.id = 'tz-bar';
    bar.innerHTML = '<span class="tz-dot"></span><span><b>Tone Zone</b> · downloads go straight to your library</span><button id="tz-lib">Open library</button>';
    document.body.appendChild(bar);
    bar.querySelector('#tz-lib').addEventListener('click', () => ipcRenderer.sendToHost('tz-open-library'));
  }
}

let timer = null;
function schedule() {
  if (timer) return;
  timer = setTimeout(() => {
    timer = null;
    try { decorate(); } catch (_) {}
  }, 400);
}

window.addEventListener('DOMContentLoaded', () => {
  decorate();
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
});
