// Mock of the on-device Pi screen UI: low detail, big touch targets, no moving or rewiring.
// It works on its own copy of a preset so trying it never changes the board.
import { el, esc, clamp } from '../util.js';
import { getDef } from '../catalog/index.js';
import { uiParams } from '../state.js';
import { chainOrder } from './pi-data.js';

const EDITABLE = new Set(['knob', 'slider', 'treadle', 'sel', 'toggle']);
const CAT_HUE = { Overdrive: 28, Distortion: 8, Fuzz: 330, Boost: 45, Amp: 18, 'Bass Amp': 18, Preamp: 36, Cab: 210, 'Bass Cab': 210, Dynamics: 160, EQ: 190, Filter: 280, Modulation: 260, Pitch: 300, Delay: 140, Reverb: 200, Synth: 310, Looper: 120, Volume: 60, Wah: 50, NAM: 265, IR: 220 };

export function fmtCtl(c, v) {
  if (c.t === 'sel' || c.t === 'toggle') return (c.options && c.options[v | 0]) ?? String(v);
  if (c.display) { try { return c.display(v, c); } catch { /* fall through */ } }
  if (c.unit) return (c.unit === 'Hz' && v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v >= 100 ? v.toFixed(0) : v.toFixed(1)) + ' ' + c.unit;
  return (((v - (c.min ?? 0)) / ((c.max ?? 1) - (c.min ?? 0))) * 10).toFixed(1);
}
const logc = (c) => c.curve === 'log' && c.min > 0;
const toPos = (c, v) => (logc(c) ? Math.log(v / c.min) / Math.log(c.max / c.min) : (v - c.min) / (c.max - c.min || 1));
const fromPos = (c, t) => (logc(c) ? c.min * Math.pow(c.max / c.min, t) : c.min + t * (c.max - c.min));

// opts: { w, h, theme, preset, bankName, slot, banks, onLoad(bank, slot), onEdit(info) }
export function mountScreen(host, opts) {
  const root = el('div', { class: 'pis', 'data-theme': opts.theme || 'dark' }, host);
  root.style.width = opts.w + 'px';
  root.style.height = opts.h + 'px';
  const size = opts.w <= 160 ? 'xs' : Math.min(opts.w, opts.h) <= 260 ? 's' : Math.min(opts.w, opts.h) <= 340 ? 'm' : 'l';
  root.dataset.size = size;
  if (opts.w < opts.h) root.dataset.portrait = '';
  // one unit drives every size so a 320x240 and a 1280x720 screen keep the same layout
  root.style.setProperty('--u', Math.max(4, Math.round(Math.min(opts.h / 24, opts.w / (opts.w < opts.h ? 18 : 34)))) + 'px');
  const ui = { view: 'home', block: null, bank: opts.bankIndex || 0, cpu: opts.cpu || 30, tuneT: 0, timer: 0 };
  let chain = [];
  const setPreset = (p, info = {}) => {
    ui.preset = p;
    Object.assign(opts, info);
    chain = chainOrder(p).map((b) => ({ id: b.id, type: b.type, def: getDef(b.type), params: { ...uiParams(b) }, on: !b.bypass })).filter((b) => b.def && b.def.algo && b.def.cat !== 'Utility');
    if (ui.view === 'edit') ui.view = 'home';
    draw();
  };

  function topBar() {
    const t = el('div', { class: 'pis-top' }, root);
    el('span', { class: 'pis-slot' }, t).textContent = opts.slot < 0 ? '--' : (opts.bankIndex ?? 0) + 1 + String.fromCharCode(65 + (opts.slot ?? 0));
    el('span', { class: 'pis-bank' }, t).textContent = opts.bankName || 'Bank 1';
    el('span', { class: 'pis-sp' }, t);
    const m = el('span', { class: 'pis-meters' }, t, '<i data-m="in"><b></b></i><i data-m="out"><b></b></i>');
    m.title = 'In / out level';
    el('span', { class: 'pis-cpu', 'data-cpu': '' }, t).textContent = 'DSP ' + Math.round(ui.cpu) + '%';
  }
  function navBar() {
    const n = el('div', { class: 'pis-nav' }, root);
    for (const [v, label] of [['home', 'Home'], ['presets', 'Presets'], ['tuner', 'Tuner']]) {
      const b = el('button', { class: 'pis-btn' + (ui.view === v || (v === 'home' && ui.view === 'edit') ? ' on' : ''), 'data-nav': v }, n);
      b.textContent = label;
      b.onclick = () => { ui.view = v; draw(); };
    }
  }

  function home() {
    const body = el('div', { class: 'pis-body pis-home' }, root);
    const row = el('div', { class: 'pis-preset' }, body);
    const prev = el('button', { class: 'pis-btn pis-step', 'data-act': 'prev' }, row, '&lsaquo;');
    el('div', { class: 'pis-pname' }, row).textContent = ui.preset ? ui.preset.name : 'No preset';
    const next = el('button', { class: 'pis-btn pis-step', 'data-act': 'next' }, row, '&rsaquo;');
    prev.onclick = () => opts.onLoad && opts.onLoad(opts.bankIndex ?? 0, (opts.slot ?? 0) - 1);
    next.onclick = () => opts.onLoad && opts.onLoad(opts.bankIndex ?? 0, (opts.slot ?? 0) + 1);
    const tiles = el('div', { class: 'pis-tiles' }, body);
    if (!chain.length) el('div', { class: 'pis-empty' }, tiles).textContent = 'No blocks';
    const max = size === 's' ? 6 : size === 'm' ? 8 : 12;
    chain.slice(0, max).forEach((b) => {
      const tile = el('div', { class: 'pis-tile' + (b.on ? ' on' : ''), 'data-block': b.id }, tiles);
      tile.style.setProperty('--h', CAT_HUE[b.def.cat] ?? 210);
      el('div', { class: 'pis-tname' }, tile).textContent = b.def.code && b.def.code.length < 14 ? b.def.code : b.def.name;
      el('div', { class: 'pis-tcat' }, tile).textContent = b.def.cat;
      const pw = el('button', { class: 'pis-pow', title: 'On / off' }, tile);
      pw.onclick = (e) => { e.stopPropagation(); b.on = !b.on; opts.onEdit && opts.onEdit({ id: b.id, bypass: !b.on }); draw(); };
      tile.onclick = () => { ui.view = 'edit'; ui.block = b.id; draw(); };
    });
    if (chain.length > max) el('div', { class: 'pis-more' }, tiles).textContent = '+' + (chain.length - max);
    // the current bank's four presets, laid out like the footswitches under the screen
    const bk = (opts.banks || [])[opts.bankIndex ?? 0];
    if (bk && size !== 's') {
      const fs = el('div', { class: 'pis-fs' }, body);
      bk.presets.forEach((p, i) => {
        const b = el('button', { class: 'pis-btn' + (i === (opts.slot ?? 0) ? ' on' : '') + (p ? '' : ' empty'), 'data-fs': i }, fs);
        b.innerHTML = `<b>${String.fromCharCode(65 + i)}</b><span>${p ? esc(p.name) : '-'}</span>`;
        if (p) b.onclick = () => opts.onLoad && opts.onLoad(opts.bankIndex ?? 0, i);
      });
    }
  }

  function edit() {
    const b = chain.find((x) => x.id === ui.block);
    if (!b) { ui.view = 'home'; return home(); }
    const body = el('div', { class: 'pis-body pis-edit' }, root);
    const hd = el('div', { class: 'pis-ehead' }, body);
    const back = el('button', { class: 'pis-btn', 'data-act': 'back' }, hd, '&lsaquo; Back');
    back.onclick = () => { ui.view = 'home'; draw(); };
    el('div', { class: 'pis-ename' }, hd).textContent = b.def.name;
    const on = el('button', { class: 'pis-btn pis-onoff' + (b.on ? ' on' : '') }, hd);
    on.textContent = b.on ? 'ON' : 'OFF';
    on.onclick = () => { b.on = !b.on; opts.onEdit && opts.onEdit({ id: b.id, bypass: !b.on }); draw(); };
    const list = el('div', { class: 'pis-params' }, body);
    const ctls = b.def.controls.filter((c) => EDITABLE.has(c.t) && c.p && !c.hidden);
    if (!ctls.length) el('div', { class: 'pis-empty' }, list).textContent = 'Nothing to adjust';
    for (const c of ctls) {
      const r = el('div', { class: 'pis-param', 'data-p': c.p }, list);
      el('div', { class: 'pis-plabel' }, r).textContent = c.label || c.p;
      const val = el('div', { class: 'pis-pval' }, r);
      const v0 = b.params[c.p] ?? c.def ?? c.min ?? 0;
      val.textContent = fmtCtl(c, v0);
      if (c.t === 'sel' || c.t === 'toggle') {
        const opts2 = c.options || [];
        const seg = el('div', { class: 'pis-choice' }, r);
        const pick = (i) => { b.params[c.p] = i; val.textContent = fmtCtl(c, i); opts.onEdit && opts.onEdit({ id: b.id, p: c.p, v: i, label: c.label }); [...seg.children].forEach((x, j) => x.classList.toggle('on', j === i)); };
        if (opts2.length <= 4) opts2.forEach((o, i) => { const x = el('button', { class: 'pis-btn' + ((v0 | 0) === i ? ' on' : '') }, seg); x.textContent = o; x.onclick = () => pick(i); });
        else {
          const m = el('button', { class: 'pis-btn', 'data-act': 'minus' }, seg, '&lsaquo;');
          const p = el('button', { class: 'pis-btn', 'data-act': 'plus' }, seg, '&rsaquo;');
          m.onclick = () => { const i = clamp((b.params[c.p] | 0) - 1, 0, opts2.length - 1); b.params[c.p] = i; val.textContent = fmtCtl(c, i); opts.onEdit && opts.onEdit({ id: b.id, p: c.p, v: i, label: c.label }); };
          p.onclick = () => { const i = clamp((b.params[c.p] | 0) + 1, 0, opts2.length - 1); b.params[c.p] = i; val.textContent = fmtCtl(c, i); opts.onEdit && opts.onEdit({ id: b.id, p: c.p, v: i, label: c.label }); };
        }
      } else {
        const s = el('input', { type: 'range', class: 'pis-slider', min: 0, max: 1000, value: Math.round(clamp(toPos(c, v0), 0, 1) * 1000) }, r);
        const paint = () => s.style.setProperty('--p', s.value / 10 + '%');
        paint();
        s.oninput = () => {
          const v = fromPos(c, s.value / 1000);
          b.params[c.p] = v;
          val.textContent = fmtCtl(c, v);
          paint();
          opts.onEdit && opts.onEdit({ id: b.id, p: c.p, v, label: c.label });
        };
      }
    }
  }

  function presets() {
    const banks = opts.banks || [];
    const body = el('div', { class: 'pis-body pis-presets' }, root);
    const hd = el('div', { class: 'pis-bankrow' }, body);
    const bk = banks[ui.bank];
    const prev = el('button', { class: 'pis-btn', 'data-act': 'bank-' }, hd, '&lsaquo;');
    el('div', { class: 'pis-bname' }, hd).textContent = bk ? `Bank ${ui.bank + 1}: ${bk.name}` : 'No banks';
    const next = el('button', { class: 'pis-btn', 'data-act': 'bank+' }, hd, '&rsaquo;');
    prev.onclick = () => { ui.bank = Math.max(0, ui.bank - 1); draw(); };
    next.onclick = () => { ui.bank = Math.min(banks.length - 1, ui.bank + 1); draw(); };
    const grid = el('div', { class: 'pis-slots' }, body);
    (bk ? bk.presets : []).forEach((p, i) => {
      const cur = ui.bank === (opts.bankIndex ?? 0) && i === (opts.slot ?? 0);
      const s = el('button', { class: 'pis-btn pis-slotbtn' + (cur ? ' on' : '') + (p ? '' : ' empty'), 'data-slot': i }, grid);
      s.innerHTML = `<b>${String.fromCharCode(65 + i)}</b><span>${p ? esc(p.name) : 'Empty'}</span>`;
      if (p) s.onclick = () => { opts.onLoad && opts.onLoad(ui.bank, i); ui.view = 'home'; };
    });
  }

  function tuner() {
    const body = el('div', { class: 'pis-body pis-tuner' }, root);
    el('div', { class: 'pis-note', 'data-note': '' }, body).textContent = 'E';
    const bar = el('div', { class: 'pis-cents' }, body, '<i></i><b></b>');
    bar.title = 'Cents';
    el('div', { class: 'pis-hz', 'data-hz': '' }, body).textContent = '82.4 Hz';
    el('div', { class: 'pis-hint' }, body).textContent = 'Output muted while tuning';
  }

  function oled() {
    root.innerHTML = '';
    const b = el('div', { class: 'pis-oled' }, root);
    el('div', { class: 'o1' }, b).textContent = (opts.slot < 0 ? '--' : ((opts.bankIndex ?? 0) + 1) + String.fromCharCode(65 + (opts.slot ?? 0))) + ' ' + (ui.preset ? ui.preset.name : '').toUpperCase().slice(0, 12);
    el('div', { class: 'o2' }, b).textContent = (opts.bankName || '').slice(0, 16);
    el('div', { class: 'o3', 'data-cpu': '' }, b).textContent = 'DSP ' + Math.round(ui.cpu) + '%  ' + chain.filter((x) => x.on).length + '/' + chain.length + ' ON';
  }

  function draw() {
    root.innerHTML = '';
    if (size === 'xs') return oled();
    topBar();
    ({ home, edit, presets, tuner })[ui.view]();
    navBar();
  }

  // meters, CPU and tuner wobble: a low rate timer, like the real UI (15 fps max)
  let lv = [0.4, 0.35];
  ui.timer = setInterval(() => {
    if (!root.isConnected) return destroy();
    lv = lv.map((x) => clamp(x + (Math.random() - 0.5) * 0.25, 0.08, 0.92));
    root.querySelectorAll('.pis-meters i b').forEach((b, i) => (b.style.width = Math.round(lv[i] * 100) + '%'));
    ui.cpu = clamp(ui.cpu + (Math.random() - 0.5) * 2, (opts.cpu || 30) - 4, (opts.cpu || 30) + 4);
    const c = root.querySelector('[data-cpu]');
    if (c && size !== 'xs') c.textContent = 'DSP ' + Math.round(ui.cpu) + '%';
    if (ui.view === 'tuner') {
      ui.tuneT += 0.12;
      const cents = Math.sin(ui.tuneT) * 18 * Math.exp(-((ui.tuneT % 12) / 6));
      const b = root.querySelector('.pis-cents b');
      if (b) { b.style.left = 50 + cents * 2 + '%'; b.classList.toggle('in', Math.abs(cents) < 3); }
      const hz = root.querySelector('[data-hz]');
      if (hz) hz.textContent = (82.41 * Math.pow(2, cents / 1200)).toFixed(1) + ' Hz';
    }
  }, 120);
  function destroy() { clearInterval(ui.timer); }

  setPreset(opts.preset);
  return { root, setPreset, destroy, get chain() { return chain; }, setView: (v) => { ui.view = v; draw(); } };
}
