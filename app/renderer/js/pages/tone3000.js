// TONE3000 tab: the website embedded in a webview, with "Send to Tone Zone" buttons injected next to
// download controls. Any .nam / .wav / .zip downloaded here goes straight into the import flow.
import { el, toast, bus } from '../util.js';
import { importDialog } from './library.js';
import { confirmDlg } from '../menus.js';

const HOME = 'https://www.tone3000.com/';
let built = false;
let wv = null;

export async function initTone3000() {
  window.tz.t3.onDownload(async (d) => {
    const bar = document.querySelector('#view-tone3000 .dl');
    if (bar) {
      const prog = bar.querySelector('.prog i');
      const txt = bar.querySelector('span');
      if (d.state === 'started' || d.state === 'progress') {
        bar.style.display = 'flex';
        txt.textContent = `Downloading ${d.name}`;
        prog.style.width = d.total ? Math.round((100 * (d.received || 0)) / d.total) + '%' : '30%';
      } else if (d.state === 'completed') {
        txt.textContent = `Downloaded ${d.name}`;
        prog.style.width = '100%';
        setTimeout(() => (bar.style.display = 'none'), 2500);
      } else if (d.state === 'failed') {
        txt.textContent = `Download failed: ${d.name}`;
      } else if (d.state === 'ignored') {
        toast(`${d.name} isn't a .nam / .wav / .zip – saved to your downloads folder`, 'warn');
        bar.style.display = 'none';
      }
    }
    if (d.state === 'completed' && d.inspect) {
      await importDialog(d.inspect, { title: 'Import from TONE3000' });
    }
  });
}

export async function showTone3000() {
  if (built) return;
  built = true;
  const info = await window.tz.app.info();
  const v = document.getElementById('view-tone3000');
  v.innerHTML = '';
  const wrap = el('div', { class: 't3-wrap' }, v);
  const bar = el('div', { class: 't3-bar' }, wrap);
  const back = el('button', { class: 'icon-btn', title: 'Back' }, bar, '<i class="ic ic-left"></i>');
  const fwd = el('button', { class: 'icon-btn', title: 'Forward' }, bar, '<i class="ic ic-right"></i>');
  const rel = el('button', { class: 'icon-btn', title: 'Reload' }, bar, '<i class="ic ic-reload"></i>');
  const home = el('button', { class: 'icon-btn', title: 'TONE3000 home' }, bar, '<i class="ic ic-home"></i>');
  const url = el('div', { class: 'url' }, bar);
  const dl = el('div', { class: 'dl', style: { display: 'none' } }, bar, '<span></span><div class="prog"><i></i></div>');
  void dl;
  el('span', { class: 'pill orange', title: 'Downloads from this tab are imported automatically' }, bar, '<i class="ic ic-import" style="width:12px;height:12px"></i>Auto-import on');
  const clr = el('button', { class: 'btn small btn-ghost', title: 'Sign out / clear TONE3000 session' }, bar, 'Clear session');
  const open = el('button', { class: 'btn small btn-ghost', title: 'Open in your browser' }, bar, 'Open externally');
  wv = document.createElement('webview');
  wv.setAttribute('src', HOME);
  wv.setAttribute('partition', info.partition);
  wv.setAttribute('preload', info.t3Preload);
  wv.setAttribute('allowpopups', '');
  wrap.appendChild(wv);
  const loading = el('div', { class: 't3-loading' }, v, '<div><div class="spinner"></div>Loading TONE3000…</div>');
  let failed = false;
  wv.addEventListener('did-start-loading', () => (failed = false));
  wv.addEventListener('did-stop-loading', () => !failed && loading.classList.add('hide'));
  wv.addEventListener('did-fail-load', (e) => {
    if (e.errorCode === -3 || !e.isMainFrame) return;
    failed = true;
    loading.classList.remove('hide');
    loading.innerHTML = `<div style="text-align:center"><p>Couldn't reach TONE3000 (${e.errorDescription || e.errorCode}).</p><button class="btn" id="t3retry">Retry</button></div>`;
    loading.style.pointerEvents = 'auto';
    loading.querySelector('#t3retry').onclick = () => { loading.innerHTML = '<div><div class="spinner"></div>Loading TONE3000…</div>'; wv.reload(); };
  });
  const upd = () => {
    try {
      url.textContent = wv.getURL();
      back.disabled = !wv.canGoBack();
      fwd.disabled = !wv.canGoForward();
    } catch (_) {}
  };
  wv.addEventListener('did-navigate', upd);
  wv.addEventListener('did-navigate-in-page', upd);
  wv.addEventListener('ipc-message', (e) => {
    if (e.channel === 'tz-open-library') bus.emit('tab', 'library');
    if (e.channel === 'tz-intent') toast('Downloading to Tone Zone…', 'info', 1500);
  });
  back.onclick = () => wv.canGoBack() && wv.goBack();
  fwd.onclick = () => wv.canGoForward() && wv.goForward();
  rel.onclick = () => wv.reload();
  home.onclick = () => wv.loadURL(HOME);
  open.onclick = () => window.tz.app.openExternal(wv.getURL());
  clr.onclick = async () => {
    if (await confirmDlg('Clear TONE3000 session', 'Sign out of TONE3000 in Tone Zone and clear its cookies?', 'Clear')) {
      await window.tz.t3.clearSession();
      wv.reload();
    }
  };
}
