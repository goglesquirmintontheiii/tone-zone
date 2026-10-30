// Pi tab: presets on the device (banks, push, switching) and the Pi compatibility check.
import { el, esc, toast, bus } from '../util.js';
import { state } from '../state.js';
import { MODELS, budgetOf, checkPreset, savePi, piLog, piStore, act, isPi3 } from './pi-data.js';
import { card, meter, toggle, select, demoNote, fakeProgress } from './pi-ui.js';

let presetList = null;
export async function listPresets() {
  if (!presetList) presetList = (await window.tz.presets.list().catch(() => [])) || [];
  // the demo banks only know file names: show the real preset names
  const byFile = new Map(presetList.map((q) => [q.file, q.name]));
  for (const d of piStore().devices) for (const b of d.banks) b.presets.forEach((p) => p && byFile.has(p.file) && (p.name = byFile.get(p.file)));
  return presetList;
}
export async function loadPresetFile(file) {
  if (!file || file === '__current') return state.preset;
  if (state.file === file) return state.preset;
  return window.tz.presets.load(file).catch(() => null);
}
const slotName = (i) => String.fromCharCode(65 + i);
// boards shown in the check: the Pi 3 column follows the selected Pi (3B or 3B+)
const compatModels = (dev) => [dev && dev.model === 'pi3b' ? 'pi3b' : 'pi3bp', 'pi4', 'pi5'];

export function renderPresetsSection(main, ctx) {
  const dev = ctx.dev;
  const top = el('div', { class: 'pi-sechead' }, main);
  el('div', {}, top, `<h2>Presets on ${esc(dev ? dev.name : 'the Pi')}</h2><p>Banks of four presets (A to D), switched with footswitches, the Pi screen or from here.</p>`);
  if (!dev) return el('div', { class: 'pi-empty' }, main).textContent = 'Add a Pi first.';
  const acts = el('div', { class: 'pi-row' }, top);
  const push = el('button', { class: 'btn btn-accent', 'data-act': 'push' }, acts, 'Push current preset');
  const addBank = el('button', { class: 'btn', 'data-act': 'add-bank' }, acts, '+ Bank');
  addBank.onclick = () => { dev.banks.push({ name: 'Bank ' + (dev.banks.length + 1), presets: [null, null, null, null] }); savePi(); ctx.rerender(); };

  const cols = el('div', { class: 'pi-cols' }, main);
  const left = el('div', { class: 'pi-col' }, cols);
  const right = el('div', { class: 'pi-col' }, cols);

  // push progress lives above the banks
  const prog = el('div', { class: 'pi-progress hidden' }, left, '<div class="pi-pbar"><i></i></div><span></span>');
  push.onclick = async () => {
    const p = state.preset;
    if (!p) return;
    let bi = dev.banks.findIndex((b) => b.presets.some((x) => !x));
    if (bi < 0) { dev.banks.push({ name: 'Bank ' + (dev.banks.length + 1), presets: [null, null, null, null] }); bi = dev.banks.length - 1; }
    const si = dev.banks[bi].presets.findIndex((x) => !x);
    const chk = checkPreset(p, budgetOf(dev));
    const est = Math.round(chk.est[dev.model]);
    const nams = chk.rows.filter((r) => r.notes.some((n) => n.startsWith('NAM'))).length;
    prog.classList.remove('hidden');
    push.disabled = true;
    const bar = prog.querySelector('i'), label = prog.querySelector('span');
    let measured = est;
    const live = act('push', { id: dev.id, preset: p, file: state.file || '__current', name: p.name, bank: bi, slot: si });
    if (live) {
      const off = bus.on('pi:progress', (ev) => {
        if (ev.id !== dev.id || ev.job !== 'push') return;
        bar.style.width = (ev.pct || 0) + '%';
        if (ev.text) label.textContent = ev.text;
      });
      label.textContent = `Sending "${p.name}"...`;
      try { const r = await live; if (r && typeof r.dsp === 'number') measured = Math.round(r.dsp); } catch { off(); push.disabled = false; prog.classList.add('hidden'); return; }
      off();
      bar.style.width = '100%';
      label.textContent = `Done. Measured on the Pi: ${measured}% DSP`;
    } else {
      await fakeProgress(bar, label, [
        `Sending "${p.name}"...`, nams ? `Copying ${nams} NAM model${nams > 1 ? 's' : ''}...` : 'Copying IRs and settings...', 'Building it on the Pi...', `Measured on the Pi: ${est}% DSP`, 'Done',
      ], 420);
    }
    push.disabled = false;
    dev.banks[bi].presets[si] = { file: state.file || '__current', name: p.name, dsp: measured };
    // the Pi already stored it: do not send the banks again
    if (!live) savePi();
    piLog(`Received preset "${p.name}" into bank ${bi + 1} ${slotName(si)} (${measured}% DSP)`);
    toast(`"${p.name}" is now ${bi + 1}${slotName(si)} on ${dev.name}${live ? '' : ' (demo)'}`);
    if (measured > budgetOf(dev)) toast(`It uses ${measured}% DSP, over this Pi's ${budgetOf(dev)}% budget. The Pi plays a lighter version.`, 'warn', 6000);
    setTimeout(() => ctx.rerender(), 500);
  };

  const banksEl = el('div', { class: 'pi-banks' }, left);
  dev.banks.forEach((bk, bi) => {
    const c = el('div', { class: 'pi-bank', 'data-bank': bi }, banksEl);
    const h = el('div', { class: 'pi-bank-head' }, c);
    el('span', { class: 'pi-bank-no' }, h).textContent = bi + 1;
    const nm = el('input', { type: 'text', value: bk.name, class: 'pi-bank-name' }, h);
    nm.onchange = () => { bk.name = nm.value.trim() || bk.name; savePi(); };
    const up = el('button', { class: 'icon-btn', title: 'Move up', disabled: bi ? null : '' }, h, '&uarr;');
    const dn = el('button', { class: 'icon-btn', title: 'Move down', disabled: bi < dev.banks.length - 1 ? null : '' }, h, '&darr;');
    const rm = el('button', { class: 'icon-btn', title: 'Delete bank' }, h, '&times;');
    const mv = (d) => { const t = dev.banks.splice(bi, 1)[0]; dev.banks.splice(bi + d, 0, t); savePi(); ctx.rerender(); };
    up.onclick = () => mv(-1);
    dn.onclick = () => mv(1);
    rm.onclick = () => { dev.banks.splice(bi, 1); savePi(); ctx.rerender(); };
    const slots = el('div', { class: 'pi-slots' }, c);
    bk.presets.forEach((p, si) => {
      const live = dev.bank === bi && dev.slot === si;
      const s = el('div', { class: 'pi-slot' + (p ? '' : ' empty') + (live ? ' live' : ''), 'data-slot': si }, slots);
      el('b', {}, s).textContent = slotName(si);
      if (p) {
        el('span', { class: 'pi-slot-name' }, s).textContent = p.name;
        if (live) el('em', {}, s).textContent = 'Playing';
        s.title = 'Click to play this preset on the Pi';
        s.onclick = () => { dev.bank = bi; dev.slot = si; savePi(); piLog(`Switched to ${bi + 1}${slotName(si)} "${p.name}" (preloaded, 1 cycle)`, 'info', 'engine'); ctx.rerender(); };
        const x = el('button', { class: 'pi-slot-x', title: 'Remove from the Pi' }, s, '&times;');
        x.onclick = (e) => { e.stopPropagation(); bk.presets[si] = null; savePi(); ctx.rerender(); };
      } else {
        const add = el('select', { class: 'pi-slot-add' }, s);
        el('option', { value: '' }, add).textContent = '+ Add preset';
        listPresets().then((list) => { for (const q of list) { const o = el('option', { value: q.file }, add); o.textContent = q.name; } });
        add.onchange = () => {
          const q = presetList.find((x) => x.file === add.value);
          if (!q) return;
          bk.presets[si] = { file: q.file, name: q.name };
          savePi();
          piLog(`Added "${q.name}" to bank ${bi + 1} ${slotName(si)}`);
          ctx.rerender();
        };
      }
    });
  });
  if (!dev.banks.length) el('div', { class: 'pi-empty' }, banksEl).textContent = 'No presets on this Pi yet. Push the current preset or add a bank.';

  // switching
  const sw = card(left, 'Switching', 'How the Pi changes presets.');
  const s = ctx.store.switching;
  const opt = (label, hint, key) => {
    const r = el('div', { class: 'pi-opt' }, sw);
    el('div', {}, r, `<b>${label}</b><small>${hint}</small>`);
    toggle(r, s[key], (v) => { s[key] = v; savePi(); });
  };
  opt('Instant switching', 'Keeps the next, previous and current bank presets loaded, so changing presets takes one audio cycle instead of 100 to 400 ms.', 'preload');
  opt('Spillover', 'Delay and reverb tails keep ringing after a switch (only when the CPU allows).', 'spillover');
  opt('MIDI program change', 'Pick presets from a MIDI controller (bank select with CC 0).', 'midi');
  const ways = el('div', { class: 'pi-ways-mini' }, sw);
  for (const [t, d] of [['Footswitches', 'Preset up / down, bank up / down, A to D, hold for bank'], ['Pi screen', 'Preset list and big next / previous buttons'], ['This app', 'Click a preset in a bank above']])
    el('div', {}, ways, `<b>${t}</b><span>${d}</span>`);
  const goG = el('button', { class: 'btn small' }, sw, 'Set up footswitches');
  goG.onclick = () => ctx.go('gpio');

  renderCompat(right, dev);
}

// ------------------------------------------------------------- compatibility check
function renderCompat(parent, dev) {
  const c = card(parent, 'Will it run on a Pi?', 'Checks each block and estimates the DSP load on Pi 3, Pi 4 and Pi 5.', 'pi-compat');
  const row = el('div', { class: 'pi-row' }, c);
  const pick = select(row, [['__current', `Current board: ${state.preset ? state.preset.name : 'none'}`]], '__current', () => {}, { class: 'pi-compat-pick' });
  listPresets().then((list) => { for (const q of list) { const o = el('option', { value: q.file }, pick); o.textContent = q.name; } });
  const run = el('button', { class: 'btn btn-accent', 'data-act': 'check' }, row, 'Check');
  const out = el('div', { class: 'pi-compat-out' }, c);
  run.onclick = async () => {
    out.innerHTML = '<div class="pi-muted"><span class="pi-spin"></span> Checking...</div>';
    const p = await loadPresetFile(pick.value);
    if (!p) return (out.textContent = 'Could not load that preset.');
    showResult(out, p, dev);
  };
  const all = el('button', { class: 'btn', 'data-act': 'check-all' }, row, 'Check all on this Pi');
  all.onclick = async () => {
    out.innerHTML = '';
    const t = el('table', { class: 'pi-table', 'data-checkall': '' }, out);
    const ms = compatModels(dev);
    t.innerHTML = `<thead><tr><th>Slot</th><th>Preset</th>${ms.map((m) => `<th>${MODELS[m].short}</th>`).join('')}</tr></thead>`;
    const tb = el('tbody', {}, t);
    for (const [bi, bk] of dev.banks.entries()) {
      for (const [si, p] of bk.presets.entries()) {
        if (!p) continue;
        const pr = await loadPresetFile(p.file);
        if (!pr) continue;
        const r = checkPreset(pr, budgetOf(dev));
        const tr = el('tr', {}, tb);
        el('td', { class: 'num' }, tr).textContent = bi + 1 + slotName(si);
        el('td', {}, tr).textContent = p.name;
        for (const m of ms) el('td', { class: 'num' }, tr, `<span class="pi-chip ${r.verdict[m]}">${Math.round(r.est[m])}%</span>`);
      }
    }
    if (!tb.children.length) el('div', { class: 'pi-empty' }, out).textContent = 'No presets on this Pi yet.';
  };
  if (state.preset) showResult(out, state.preset, dev);
  demoNote(c, 'Estimates use the catalog block costs and rough Pi factors. A real Pi measures the preset when you push it.');
}

function showResult(out, p, dev) {
  const budget = budgetOf(dev);
  const r = checkPreset(p, budget);
  const ms = compatModels(dev);
  out.innerHTML = '';
  out.dataset.result = ms.map((m) => r.verdict[m]).join(',');
  const sum = el('div', { class: 'pi-compat-sum' }, out);
  for (const m of ms) {
    const v = r.est[m];
    const k = r.verdict[m];
    const b = el('div', { class: 'pi-compat-model' + (dev && dev.model === m ? ' mine' : ''), 'data-model': m }, sum);
    el('div', { class: 'pi-cm-head' }, b, `<b>${MODELS[m].short}</b><span class="pi-chip ${k}">${k === 'ok' ? 'Fits' : k === 'heavy' ? 'Tight' : 'Too heavy'}</span>`);
    meter(b, v, k, `${Math.round(v)}% of ${budget}%`);
  }
  el('p', { class: 'pi-muted pi-compat-budget' }, out).textContent = `Budget ${budget}% is the DSP budget of ${dev ? dev.name : 'the Pi'} (change it in Devices).`;
  const t = el('table', { class: 'pi-table' }, out);
  t.innerHTML = `<thead><tr><th>Block</th><th>Type</th>${ms.map((m) => `<th>${MODELS[m].short}</th>`).join('')}<th></th></tr></thead>`;
  const tb = el('tbody', {}, t);
  for (const x of r.rows) {
    const tr = el('tr', { class: x.status }, tb);
    el('td', {}, tr).textContent = x.name;
    el('td', { class: 'pi-muted' }, tr).textContent = x.cat;
    for (const m of ms) el('td', { class: 'num' }, tr).textContent = x.status === 'bad' ? '-' : x.est[m].toFixed(1) + '%';
    const st = el('td', {}, tr);
    el('span', { class: 'pi-chip ' + x.status }, st).textContent = x.status === 'ok' ? 'OK' : x.status === 'heavy' ? 'Heavy' : 'Skipped';
    if (x.notes.length) {
      const nr = el('tr', { class: 'pi-note-row' }, tb);
      el('td', { colspan: ms.length + 3 }, nr).textContent = x.notes.join(' ');
    }
  }
  if (!r.rows.length) el('div', { class: 'pi-empty' }, out).textContent = 'This preset has no blocks.';
  const adv = [];
  const p3 = ms[0];
  if (r.verdict[p3] !== 'ok') adv.push(`On ${MODELS[p3].short}: keep it to amp + cab + a few pedals, use a NAM Feather or Nano model, and a buffer of 128 or 256.`);
  if (r.ramNote && (!dev || isPi3(dev.model) || dev.ram <= 1)) adv.push(r.ramNote);
  if (r.v4 !== 'ok') adv.push('On Pi 4: use a NAM Lite or Feather model, or drop a pedal. The Pi lowers quality first (oversampling, IR length, A2 Lite), and refuses to load it rather than glitch.');
  if (r.v5 === 'bad') adv.push('Too heavy even for Pi 5. Split it into two presets or use lighter blocks.');
  if (adv.length) {
    const a = el('div', { class: 'pi-advice' }, out);
    for (const t2 of adv) el('p', {}, a).textContent = t2;
  }
}
