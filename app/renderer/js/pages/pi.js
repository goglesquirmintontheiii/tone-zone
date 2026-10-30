// Raspberry Pi tab: run presets on a Pi as a standalone pedal. The plan is docs/raspberry-pi.md.
// Demo data until a real Pi is found (pi-live.js, through window.tz.pi), see the interface in pi-data.js.
import { el, bus, toast } from '../util.js';
import { piStore, savePi, resetPi, currentDevice, MODELS, piLog, orderedDevices, selectDevice, initLive, isLive, liveAvailable, liveFound, setDemo, liveError } from './pi-data.js';
import { select, toggle, paintLoad, paintTemp } from './pi-ui.js';
import { renderDevices } from './pi-devices.js';
import { renderPresetsSection, listPresets } from './pi-presets.js';
import { renderGpio } from './pi-gpio.js';
import { renderDisplay } from './pi-display.js';
import { renderAudio, renderUpdates, renderLogs } from './pi-system.js';

const SECTIONS = [
  ['devices', 'Devices', renderDevices],
  ['presets', 'Presets', renderPresetsSection],
  ['gpio', 'Footswitches', renderGpio],
  ['display', 'Display', renderDisplay],
  ['audio', 'Audio', renderAudio],
  ['updates', 'Updates', renderUpdates],
  ['logs', 'Logs', renderLogs],
];
const ICONS = {
  devices: '<rect x="4" y="6" width="16" height="12" rx="2"/><path d="M8 10h3v4H8zM14 10h2M14 13h2"/>',
  presets: '<path d="M5 6h14M5 12h14M5 18h9"/>',
  gpio: '<circle cx="7" cy="7" r="1.6"/><circle cx="12" cy="7" r="1.6"/><circle cx="17" cy="7" r="1.6"/><circle cx="7" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="17" cy="12" r="1.6"/><rect x="5" y="16" width="14" height="4" rx="1"/>',
  display: '<rect x="3" y="5" width="18" height="12" rx="2"/><path d="M9 20h6"/>',
  audio: '<path d="M4 10v4M8 7v10M12 4v16M16 8v8M20 11v2"/>',
  updates: '<path d="M12 4v10m-4-4 4 4 4-4"/><path d="M5 18h14"/>',
  logs: '<path d="M6 4h9l3 3v13H6z"/><path d="M9 11h6M9 15h6"/>',
};

let page = null;
let liveTimer = 0;
let current = null; // the open section's go()

export async function renderPi() {
  initLive();
  await listPresets();
  const v = document.getElementById('view-pi');
  v.innerHTML = '';
  const s = piStore();
  const live = isLive();
  page = el('div', { class: 'page pi-page' + (live ? ' live' : ' demo') }, v);
  const head = el('div', { class: 'page-head' }, page);
  el('div', {}, head, `<h1>Raspberry Pi <span class="pi-badge">${live ? 'Live' : 'Demo'}</span></h1><p>Run your presets on a Raspberry Pi and use it as a standalone pedal.</p>`);
  const act = el('div', { class: 'actions pi-head-actions' }, head);
  const dev = currentDevice();
  el('span', { class: 'pi-dot ' + (dev && dev.online ? 'on' : 'off') }, act);
  if (s.devices.length) select(act, orderedDevices(s).map((d) => [d.id, `${d.name} (${(MODELS[d.model] || MODELS.pi4).short})`]), dev && dev.id, (id) => { selectDevice(id); renderPi(); }, { class: 'pi-devpick', title: 'Device' });
  if (liveAvailable()) {
    const dl = el('label', { class: 'pi-inline pi-demo-toggle', title: 'Show demo devices instead of real ones' }, act);
    toggle(dl, !live, (on) => setDemo(on), { 'data-ctl': 'demo' });
    el('span', {}, dl).textContent = 'Demo';
  }
  if (!live) {
    const rb = el('button', { class: 'btn btn-ghost small', title: 'Put the demo data back the way it started' }, act, 'Reset demo');
    rb.onclick = () => { resetPi(); renderPi(); };
  }
  const banner = !live
    ? (liveAvailable() && liveFound()
      ? '<b>Demo mode is on.</b> Your real Pis are hidden. Turn Demo off to see them.'
      : liveAvailable()
        ? '<b>Demo mode.</b> No Pi found on your network yet, so this shows demo devices with fake progress. Turn Demo off to add your own Pi.'
        : '<b>Demo mode.</b> This shows how the Pi pedal works, with demo devices and fake progress. Your presets, blocks and their CPU costs are real. The full plan is in docs/raspberry-pi.md.')
    : liveError() ? '<b>Pi connection problem.</b> <span></span>' : '';
  if (banner) {
    const b = el('div', { class: 'pi-banner' }, page, banner);
    if (live && liveError()) b.querySelector('span').textContent = liveError();
  }

  const lay = el('div', { class: 'pi-layout' }, page);
  const nav = el('nav', { class: 'pi-nav' }, lay);
  const main = el('div', { class: 'pi-main' }, lay);
  for (const [id, label] of SECTIONS) {
    const b = el('button', { class: 'pi-navbtn' + (s.section === id ? ' on' : ''), 'data-section': id }, nav, `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[id]}</svg><span>${label}</span>`);
    b.onclick = () => go(id);
  }
  const go = (id) => {
    s.section = id;
    savePi();
    nav.querySelectorAll('.pi-navbtn').forEach((b) => b.classList.toggle('on', b.dataset.section === id));
    main.innerHTML = '';
    main.dataset.section = id;
    const sec = SECTIONS.find((x) => x[0] === id) || SECTIONS[0];
    try {
      sec[2](main, { store: s, dev: currentDevice(), go, rerender: () => go(id), refreshAll: renderPi, live });
    } catch (e) {
      console.error(e);
    }
  };
  current = go;
  go(SECTIONS.some((x) => x[0] === s.section) ? s.section : 'devices');
  startLive();
}

// update the numbers and bars of one device wherever they are shown
export function paintStats(view, d) {
  for (const n of view.querySelectorAll(`[data-live^="${d.id}:"]`)) {
    const k = n.dataset.live.split(':')[1];
    if (k === 'dsp') n.textContent = Math.round(d.dsp) + '%';
    else if (k === 'cpu') n.textContent = Math.round(d.cpu) + '%';
    else if (k === 'dspbar') paintLoad(n, d.dsp, d.budget);
    else if (k === 'cpubar') paintLoad(n, d.cpu);
    else if (k === 'temp') paintTemp(n, d.temp);
    else if (k === 'xruns') n.textContent = String(d.xruns);
  }
}
const viewOpen = () => { const v = document.getElementById('view-pi'); return v && v.classList.contains('active') ? v : null; };

// demo: wobble the stats while the tab is open
function startLive() {
  if (liveTimer) return;
  liveTimer = setInterval(() => {
    const view = viewOpen();
    if (!view || isLive()) return;
    for (const d of piStore().devices) {
      if (!d.online) continue;
      const base = { pi5: 31, pi4: 46, pi3bp: 56, pi3b: 60 }[d.model] || 45;
      d.dsp = Math.max(5, Math.min(97, d.dsp + (Math.random() - 0.5) * 3 + (base - d.dsp) * 0.1));
      d.cpu = Math.max(4, Math.min(99, d.cpu + (Math.random() - 0.5) * 4 + (d.dsp * 1.05 + 4 - d.cpu) * 0.15));
      const tbase = { pi5: 52, pi4: 61, pi3bp: 71, pi3b: 73 }[d.model] || 60;
      d.temp = Math.max(40, Math.min(85, d.temp + (Math.random() - 0.5) * 0.6 + (tbase - d.temp) * 0.05));
      d.uptime += 1;
      paintStats(view, d);
    }
  }, 1000);
}

bus.on('pi:stats', (d) => { const v = viewOpen(); if (v && isLive()) paintStats(v, d); });
bus.on('pi:log', () => {
  if (page && page.isConnected && piStore().section === 'logs') page.querySelector('.pi-main')?.dispatchEvent(new Event('pi-log'));
});
// mode switch or a new device list: draw again, but not while the user is typing in the tab
let again = 0;
const redraw = (full) => {
  clearTimeout(again);
  again = setTimeout(() => {
    if (!page || !page.isConnected) return;
    const f = document.activeElement;
    const typing = f && page.contains(f) && (f.tagName === 'TEXTAREA' || (f.tagName === 'INPUT' && /^(text|number|search)$/.test(f.type)));
    if (typing || page.querySelector('.pi-devgrid.dragging')) return redraw(full);
    if (full || piStore().section === 'devices') renderPi();
    else if (current) current(piStore().section);
  }, 120);
};
bus.on('pi:mode', () => redraw(true));
bus.on('pi:devices', () => redraw(true));
bus.on('pi:config', () => redraw(false));
bus.on('pi:error', (e) => toast(e.message, 'warn'));
export { piLog };
