// Capture page: groundwork for creating NAM models (re-amping + training) in a future version.
import { el } from '../util.js';

export function renderCapture() {
  const v = document.getElementById('view-capture');
  if (v.childNodes.length) return;
  const page = el('div', { class: 'page' }, v);
  el('div', { class: 'page-head' }, page, '<div><h1>Capture <span class="soon">COMING SOON</span></h1><p>Create your own Neural Amp Models from real amps and pedals, right inside Tone Zone.</p></div>');
  const hero = el('div', { class: 'capture-hero' }, page);
  const left = el('div', { class: 'panel' }, hero);
  el('h3', {}, left).textContent = 'How capturing will work';
  el('p', {}, left).textContent = 'The capture workflow is planned for a future release. The board, NAM engine (A1 + A2 / slimmable) and library are already built so captures you train will drop straight in.';
  const steps = el('div', { class: 'steps' }, left);
  for (const [b, s] of [
    ['Connect your gear', 'Patch Tone Zone’s SEND output into the amp / pedal you want to capture and its output (or a load box / DI) back into RETURN.'],
    ['Calibrate levels', 'Tone Zone plays a test tone and matches input / output levels so the capture is accurate.'],
    ['Re-amp the training signal', 'The standard NAM training signal is played through your gear and recorded sample-accurately.'],
    ['Train', 'Train locally (GPU recommended) with the NAM trainer, choosing A1 or A2 (Full + Lite in one file).'],
    ['Play it', 'The finished .nam lands in your Library as a pedal, amp, preamp or cab – ready for the board.'],
  ]) el('div', { class: 'step' }, steps, `<div><b>${b}</b><span>${s}</span></div>`);
  const right = el('div', { class: 'panel' }, hero);
  el('h3', {}, right).textContent = 'Already available';
  el('p', {}, right).textContent = 'Everything you need to play captures today:';
  const ul = el('div', { class: 'steps' }, right);
  for (const [b, s] of [
    ['Import NAM models', 'Single files, many files at once or whole .zip packs become one block with switchable configurations.'],
    ['TONE3000 browser', 'Browse thousands of captures and IRs and send them straight into your library.'],
    ['A2 slimmable support', 'A2 captures automatically switch between Full and Lite with the DSP quality setting.'],
  ]) el('div', { class: 'step' }, ul, `<div><b>${b}</b><span>${s}</span></div>`);
}
