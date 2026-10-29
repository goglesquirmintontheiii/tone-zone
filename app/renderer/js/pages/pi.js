// Raspberry Pi tab. Placeholder for now: this is where flashing presets onto a Pi-based pedal will live.
import { el } from '../util.js';

export function renderPi() {
  const v = document.getElementById('view-pi');
  v.innerHTML = '';
  const page = el('div', { class: 'page pi-page' }, v);
  el('div', { class: 'page-head' }, page, '<div><h1>Raspberry Pi</h1><p>Put your presets on a Raspberry Pi and use it as a standalone pedal.</p></div>');
  const card = el('div', { class: 'pi-soon' }, page);
  el('div', { class: 'pi-badge' }, card, 'Coming soon');
  el('h2', {}, card, 'Flash presets to a Pi');
  el('p', {}, card, 'This tab will let you pick presets, connect a Raspberry Pi over USB or your network and copy them over. The Pi then runs the Tone Zone engine on its own, no computer needed.');
  const list = el('ul', { class: 'pi-plan' }, card);
  for (const t of ['Find Pis on your network or over USB', 'Choose which presets go on the Pi and in what order', 'Map footswitches and knobs on the Pi to preset changes', 'Check that a preset fits the Pi\'s CPU before flashing', 'Update the Pi\'s Tone Zone engine'])
    el('li', {}, list).textContent = t;
}
