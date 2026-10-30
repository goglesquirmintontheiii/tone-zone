// Raspberry Pi tab: run presets on a Pi as a standalone pedal. The plan is docs/raspberry-pi.md.
// This is the UI only. It uses demo data and does not talk to a real Pi yet.
import { el, bus } from '../util.js';
import { piStore, savePi, resetPi, currentDevice, MODELS, piLog } from './pi-data.js';
import { select } from './pi-ui.js';
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

export async function renderPi() {
  await listPresets();
  const v = document.getElementById('view-pi');
  v.innerHTML = '';
  const s = piStore();
  page = el('div', { class: 'page pi-page' }, v);
  const head = el('div', { class: 'page-head' }, page);
  el('div', {}, head, '<h1>Raspberry Pi <span class="pi-badge">Preview</span></h1><p>Run your presets on a Raspberry Pi and use it as a standalone pedal.</p>');
  const act = el('div', { class: 'actions pi-head-actions' }, head);
  const dev = currentDevice();
  el('span', { class: 'pi-dot ' + (dev && dev.online ? 'on' : 'off') }, act);
  select(act, s.devices.map((d) => [d.id, `${d.name} (${MODELS[d.model].short})`]), s.current, (id) => { s.current = id; savePi(); renderPi(); }, { class: 'pi-devpick', title: 'Device' });
  const rb = el('button', { class: 'btn btn-ghost small', title: 'Put the demo data back the way it started' }, act, 'Reset demo');
  rb.onclick = () => { resetPi(); renderPi(); };
  el('div', { class: 'pi-banner' }, page, '<b>Not connected to real hardware yet.</b> This tab shows how the Pi pedal will work, with demo devices and fake progress. Your presets, blocks and their CPU costs are real. The full plan is in docs/raspberry-pi.md.');

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
      sec[2](main, { store: s, dev: currentDevice(), go, rerender: () => go(id), refreshAll: renderPi });
    } catch (e) {
      console.error(e);
    }
  };
  go(SECTIONS.some((x) => x[0] === s.section) ? s.section : 'devices');
  startLive();
}

// wobble the demo stats while the tab is open
function startLive() {
  if (liveTimer) return;
  liveTimer = setInterval(() => {
    const view = document.getElementById('view-pi');
    if (!view || !view.classList.contains('active')) return;
    for (const d of piStore().devices) {
      if (!d.online) continue;
      const base = d.model === 'pi5' ? 31 : 48;
      d.cpu = Math.max(5, Math.min(95, d.cpu + (Math.random() - 0.5) * 3 + (base - d.cpu) * 0.1));
      d.temp = Math.max(40, Math.min(80, d.temp + (Math.random() - 0.5) * 0.6));
      d.uptime += 1;
      for (const n of view.querySelectorAll(`[data-live^="${d.id}:"]`)) {
        const k = n.dataset.live.split(':')[1];
        if (k === 'cpu') n.textContent = Math.round(d.cpu) + '%';
        if (k === 'cpubar') n.style.width = Math.round(d.cpu) + '%';
        if (k === 'temp') n.textContent = d.temp.toFixed(0) + ' C';
      }
    }
  }, 1000);
}

bus.on('pi:log', () => {
  if (page && page.isConnected && piStore().section === 'logs') page.querySelector('.pi-main')?.dispatchEvent(new Event('pi-log'));
});
export { piLog };
