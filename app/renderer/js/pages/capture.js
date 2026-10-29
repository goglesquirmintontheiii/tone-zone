// Capture page: turn a preset (or part of its chain) into a NAM model. Steps: render the NAM training signal
// through the preset, train, check the accuracy, add the model to the Library.
import { el, esc, bus, toast } from '../util.js';
import { state, buildGraph } from '../state.js';
import { getDef } from '../catalog/index.js';
import { confirmDlg } from '../menus.js';
import { refreshPacks } from './library.js';

const ARCHS = [
  ['a2', 'A2', 'Full and Lite sizes in one file. Follows your DSP quality setting.', 'Best'],
  ['standard', 'Standard', 'The classic NAM size. Great sound, medium CPU.'],
  ['lite', 'Lite', 'A little lighter on the CPU.'],
  ['feather', 'Feather', 'Light. Good for older computers.'],
  ['nano', 'Nano', 'Very light, with a bit less detail.'],
];
const QUALITY = [
  ['fast', 'Fast', 20, 'A quick try'],
  ['good', 'Good', 100, 'The NAM default'],
  ['best', 'Best', 300, 'Slowest, a little more accurate'],
];
const TONES = [['', 'Not set'], ['clean', 'Clean'], ['crunch', 'Crunch'], ['overdrive', 'Overdrive'], ['hi_gain', 'High gain'], ['fuzz', 'Fuzz']];
const PACK_COLORS = ['#8a5cf6', '#ff7a2f', '#e8473d', '#2ecc71', '#3498db', '#1abc9c', '#f1c40f', '#e84393'];
// effects NAM can't learn: anything that changes over time or adds new pitches
const RISKY_CATS = { Delay: 'delay', Reverb: 'reverb', Modulation: 'modulation', Pitch: 'pitch effect', Looper: 'looper', Synth: 'synth' };
const STEPS = [
  ['render', 'Play the training signal through the preset'],
  ['train', 'Train the model'],
  ['check', 'Check the accuracy'],
  ['library', 'Add to Library'],
];

const S = {
  source: '__board', preset: null, presets: [], part: 'all', from: null, to: null, keepOn: new Set(),
  arch: 'a2', quality: 'good', name: '', nameTouched: false, tone: '',
  status: null, job: null, setup: null, input: null, lastOpts: null, logOpen: false,
};
let root = null, listening = false;

// ------------------------------------------------------------------ chain helpers
const isIO = (id) => String(id).startsWith('__');
function audioCables(p) {
  return p.cables.filter((c) => !c.ctrl && typeof c.from.port === 'number');
}
// blocks from input to output when the board is one straight line, else null
function serialChain(p) {
  const cables = audioCables(p);
  const chain = [];
  const seen = new Set();
  let cur = '__in';
  for (let guard = 0; guard < 200; guard++) {
    const next = [...new Set(cables.filter((c) => c.from.node === cur).map((c) => c.to.node))];
    if (next.length !== 1) return null;
    const n = next[0];
    if (n === '__out') return chain.length ? chain : null;
    if (seen.has(n)) return null;
    // a block fed from two places is a merge, not a line
    if (new Set(cables.filter((c) => c.to.node === n).map((c) => c.from.node)).size !== 1) return null;
    seen.add(n);
    chain.push(n);
    cur = n;
  }
  return null;
}
// a copy of the preset with only chain[i..j], wired input -> blocks -> output
function sectionPreset(p, chain, i, j) {
  const keep = new Set(chain.slice(i, j + 1));
  const q = JSON.parse(JSON.stringify(p));
  q.blocks = q.blocks.filter((b) => isIO(b.id) || keep.has(b.id));
  const cables = audioCables(p);
  const first = chain[i], last = chain[j];
  const inPort = (cables.find((c) => c.to.node === first) || { to: { port: 0 } }).to.port;
  const outs = cables.filter((c) => c.from.node === last).sort((a, b) => a.from.port - b.from.port);
  q.cables = cables.filter((c) => keep.has(c.from.node) && keep.has(c.to.node));
  q.cables.push({ id: 'cap-in', from: { node: '__in', port: 0 }, to: { node: first, port: inPort } });
  outs.forEach((c, k) => q.cables.push({ id: 'cap-out' + k, from: { node: last, port: c.from.port }, to: { node: '__out', port: k } }));
  return q;
}
function blockName(b) {
  const d = getDef(b.type);
  return (d && d.name) || b.type;
}
function scopePreset() {
  const p = S.preset;
  if (!p) return null;
  const chain = serialChain(p);
  if (S.part === 'part' && chain) {
    const i = Math.max(0, chain.indexOf(S.from)), j = Math.max(i, chain.indexOf(S.to));
    return sectionPreset(p, chain, i, j);
  }
  return p;
}
function riskyBlocks(p) {
  const out = [];
  for (const b of p.blocks) {
    if (isIO(b.id) || b.bypass) continue;
    const d = getDef(b.type);
    if (!d || !d.algo) continue;
    const txt = `${d.name} ${d.typeName || ''} ${d.id}`;
    let why = RISKY_CATS[d.cat];
    if (!why && /tuner/i.test(txt)) why = 'tuner';
    if (!why && /\bgate\b/i.test(txt) && /Dynamics|Utility/.test(d.cat)) why = 'noise gate';
    if (why) out.push({ id: b.id, name: d.name, why });
  }
  return out;
}
// NAM gear type + library graphic from what is in the chain
function gearOf(p) {
  let amp = false, pre = false, cab = false, pedal = false;
  for (const b of p.blocks) {
    if (isIO(b.id) || b.bypass) continue;
    const d = getDef(b.type);
    if (!d || !d.algo) continue;
    const cat = d.cat === 'NAM' ? d.packCat : d.cat;
    if (/^(Amp|Bass Amp)$/.test(cat)) amp = true;
    else if (cat === 'Preamp') pre = true;
    else if (/Cab|IR/.test(cat)) cab = true;
    else if (!/Utility|Control|Device|Volume/.test(cat)) pedal = true;
  }
  if (amp) return { gearType: cab ? (pedal ? 'amp_pedal_cab' : 'amp_cab') : pedal ? 'pedal_amp' : 'amp', category: 'amp' };
  if (pre) return { gearType: 'preamp', category: 'preamp' };
  if (pedal) return { gearType: cab ? 'amp_pedal_cab' : 'pedal', category: cab ? 'amp' : 'pedal' };
  return { gearType: cab ? 'studio' : '', category: 'amp' };
}
function captureGraph() {
  const p = JSON.parse(JSON.stringify(scopePreset()));
  const risky = new Set(riskyBlocks(p).map((r) => r.id));
  for (const b of p.blocks) if (risky.has(b.id) && !S.keepOn.has(b.id)) b.bypass = true;
  return { graph: buildGraph(p), preset: p };
}
function defaultName() {
  const p = S.preset;
  if (!p) return 'Capture';
  let n = p.name || 'Capture';
  const chain = serialChain(p);
  if (S.part === 'part' && chain) {
    const a = p.blocks.find((b) => b.id === S.from), z = p.blocks.find((b) => b.id === S.to);
    if (a && z) {
      const full = n + (a === z ? ` (${blockName(a)})` : ` (${blockName(a)} to ${blockName(z)})`);
      const count = chain.indexOf(S.to) - chain.indexOf(S.from) + 1;
      n = full.length <= 60 ? full : `${n} (${count} block${count === 1 ? '' : 's'})`;
    }
  }
  return n.slice(0, 60);
}

// ------------------------------------------------------------------ formatting
function fmtEta(s) {
  if (s == null || !isFinite(s)) return '';
  if (s < 60) return 'under a minute left';
  const m = Math.round(s / 60);
  if (m < 60) return `about ${m} min left`;
  return `about ${Math.floor(m / 60)} h ${m % 60} min left`;
}
function ratingOf(esr) {
  if (esr == null) return null;
  if (esr < 0.01) return ['Excellent', 'good', 'Sounds the same as the preset.'];
  if (esr < 0.035) return ['Very good', 'good', 'Very close to the preset.'];
  if (esr < 0.1) return ['Good', 'ok', 'Close. A longer training may help.'];
  if (esr < 0.3) return ['Rough', 'warn', 'You will hear a difference. Try Best quality or a bigger model.'];
  return ['Poor', 'bad', 'Something is off. Time-based effects or a noise gate in the chain can cause this.'];
}
const fmtEsr = (v) => (v == null ? '-' : v < 0.001 ? v.toExponential(1) : v.toFixed(4));
function fmtBytes(n) {
  return n > 1e9 ? (n / 1e9).toFixed(1) + ' GB' : (n / 1e6).toFixed(0) + ' MB';
}

// ------------------------------------------------------------------ page
async function refreshStatus() {
  S.status = await window.tz.capture.status();
  S.job = S.status.job;
  S.input = S.status.input;
  if (S.status.setup) S.setup = S.status.setup;
}
function listen() {
  if (listening) return;
  listening = true;
  window.tz.capture.onEvent((ev) => {
    if (ev.kind === 'job') {
      const was = S.job && S.job.running;
      S.job = ev.job;
      drawProgress();
      if (was && S.job && !S.job.running && S.job.result) refreshPacks();
    } else if (ev.kind === 'setup') {
      S.setup = Object.assign({}, S.setup, ev);
      if (ev.done || ev.error || ev.running === false) refreshStatus().then(drawTop).then(drawForm);
      else drawTop();
    } else if (ev.kind === 'input') {
      S.inputDl = ev.done || ev.error ? null : ev;
      drawTop();
    }
  });
}

export async function renderCapture() {
  const v = document.getElementById('view-capture');
  listen();
  if (!root || !v.contains(root)) {
    v.innerHTML = '';
    root = el('div', { class: 'page cap-page' }, v);
    el('div', { class: 'page-head' }, root, '<div><h1>Capture</h1><p>Turn any preset into a Neural Amp Model. Tone Zone plays the NAM training signal through it, trains a model and adds it to your Library.</p></div>');
    el('div', { class: 'cap-top', id: 'capTop' }, root);
    const grid = el('div', { class: 'cap-grid' }, root);
    el('div', { class: 'panel cap-form', id: 'capForm' }, grid);
    el('div', { class: 'panel cap-progress', id: 'capProgress' }, grid);
  }
  await refreshStatus();
  S.presets = await window.tz.presets.list();
  await loadSource(S.source, true);
  drawTop();
  drawForm();
  drawProgress();
}

async function loadSource(src, keep) {
  S.source = src;
  if (src === '__board') S.preset = state.preset;
  else {
    try { S.preset = await window.tz.presets.load(src); } catch { S.preset = null; }
  }
  const chain = S.preset && serialChain(S.preset);
  if (!keep || !chain || !chain.includes(S.from) || !chain.includes(S.to)) {
    S.from = chain ? chain[0] : null;
    S.to = chain ? chain[chain.length - 1] : null;
  }
  if (!chain) S.part = 'all';
  if (!keep) S.keepOn.clear();
  if (!S.nameTouched || !keep) { S.name = defaultName(); S.nameTouched = false; }
}

// ---- trainer + training signal tiles
function drawTop() {
  const top = document.getElementById('capTop');
  if (!top || !S.status) return;
  top.innerHTML = '';
  const tr = S.status.trainer;
  const t1 = el('div', { class: 'panel cap-tile' + (tr.ready ? ' ok' : '') }, top);
  el('div', { class: 'cap-tile-ic' }, t1, `<i class="ic ${tr.ready ? 'ic-check' : 'ic-chip'}"></i>`);
  const b1 = el('div', { class: 'cap-tile-body' }, t1);
  el('b', {}, b1).textContent = 'Trainer';
  const sub1 = el('span', {}, b1);
  const act1 = el('div', { class: 'cap-tile-act' }, t1);
  const su = S.setup;
  if (su && su.running) {
    sub1.textContent = su.label || 'Setting up…';
    const bar = el('div', { class: 'cap-bar' }, b1);
    el('i', { style: { width: Math.round((su.p || 0) * 100) + '%' } }, bar);
    el('button', { class: 'btn small', onclick: () => window.tz.capture.cancelSetup() }, act1, 'Cancel');
    el('button', { class: 'btn small', onclick: () => showSetupLog() }, act1, 'Log');
  } else if (tr.ready) {
    const i = tr.info || {};
    sub1.textContent = i.fake ? 'Ready (test mode)' : `Ready · NAM ${i.nam} · ${i.gpu ? 'GPU: ' + i.device : 'CPU (no NVIDIA GPU found)'}`;
  } else {
    sub1.textContent = su && su.error ? su.error : tr.python ? `Installs the free NAM trainer and PyTorch in a private folder (${tr.nvidia ? 'about 3 GB with NVIDIA GPU support' : 'about 1 GB'}). Needs an internet connection once.` : 'Python 3 was not found. Install it with your package manager first.';
    if (su && su.error) sub1.classList.add('err');
    const b = el('button', { class: 'btn small btn-accent', onclick: () => setupTrainer() }, act1, '<i class="ic ic-import"></i>Set up trainer');
    if (!tr.python) b.disabled = true;
    if (su && su.error) el('button', { class: 'btn small', onclick: () => showSetupLog() }, act1, 'Log');
  }

  const inp = S.input || {};
  const t2 = el('div', { class: 'panel cap-tile' + (inp.ok ? ' ok' : '') }, top);
  el('div', { class: 'cap-tile-ic' }, t2, `<i class="ic ${inp.ok ? 'ic-check' : 'ic-wave'}"></i>`);
  const b2 = el('div', { class: 'cap-tile-body' }, t2);
  el('b', {}, b2).textContent = 'Training signal';
  const sub2 = el('span', {}, b2);
  const act2 = el('div', { class: 'cap-tile-act' }, t2);
  if (S.inputDl) {
    sub2.textContent = S.inputDl.label || 'Downloading…';
    const bar = el('div', { class: 'cap-bar' }, b2);
    el('i', { style: { width: Math.round((S.inputDl.p || 0) * 100) + '%' } }, bar);
  } else if (inp.ok) {
    sub2.textContent = inp.official ? `NAM v3_0_0.wav · ${Math.floor(inp.seconds / 60)}:${String(inp.seconds % 60).padStart(2, '0')}` : `Custom file (${inp.seconds} s). The trainer only accepts the official NAM signal.`;
    if (!inp.official) sub2.classList.add('warn');
    el('button', { class: 'btn small', onclick: () => pickInput() }, act2, 'Change');
  } else {
    sub2.textContent = S.inputError || inp.error || 'The standard NAM test signal (v3_0_0.wav, 3 minutes, about 27 MB).';
    if (S.inputError || inp.error) sub2.classList.add('err');
    el('button', { class: 'btn small btn-accent', onclick: () => downloadInput() }, act2, '<i class="ic ic-import"></i>Download');
    el('button', { class: 'btn small', onclick: () => pickInput() }, act2, '<i class="ic ic-folder"></i>Choose file');
  }
}
async function setupTrainer() {
  S.setup = { running: true, p: 0, label: 'Starting…' };
  drawTop();
  try {
    await window.tz.capture.setup({ device: 'auto' });
    toast('The trainer is ready', 'ok');
  } catch (e) {
    toast(String(e.message || e).replace(/^Error invoking remote method '[^']+': (Error: )?/, ''), 'err', 6000);
  }
  await refreshStatus();
  drawTop();
  drawForm();
}
function showSetupLog() {
  const lines = (S.setup && S.setup.log) || [];
  import('../menus.js').then(({ modal }) => {
    const pre = el('pre', { class: 'cap-log' });
    pre.textContent = lines.slice(-200).join('\n') || 'Nothing yet.';
    modal({ title: 'Trainer setup log', body: pre, width: '760px', buttons: [{ label: 'Close' }] });
  });
}
async function downloadInput() {
  S.inputError = null;
  S.inputDl = { p: 0, label: 'Connecting…' };
  drawTop();
  try {
    S.input = await window.tz.capture.downloadInput();
  } catch (e) {
    S.inputError = String(e.message || e).replace(/^Error invoking remote method '[^']+': (Error: )?/, '');
  }
  S.inputDl = null;
  drawTop();
  drawForm();
}
async function pickInput() {
  try {
    const r = await window.tz.capture.pickInput();
    if (r) { S.input = r; S.inputError = null; }
  } catch (e) {
    S.inputError = String(e.message || e).replace(/^Error invoking remote method '[^']+': (Error: )?/, '');
  }
  drawTop();
  drawForm();
}

// ---- the form
function seg(options, value, onPick, cls = '') {
  const s = el('div', { class: 'seg ' + cls });
  for (const [v, l] of options) {
    const b = el('button', { class: v === value ? 'on' : '' }, s, l);
    b.onclick = () => {
      s.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
      onPick(v);
    };
  }
  return s;
}
function row(parent, label, hint) {
  const r = el('div', { class: 'cap-row' }, parent);
  const l = el('div', { class: 'cap-lbl' }, r);
  el('b', {}, l).textContent = label;
  if (hint) el('small', {}, l).textContent = hint;
  return el('div', { class: 'cap-ctl' }, r);
}
function drawForm() {
  const f = document.getElementById('capForm');
  if (!f) return;
  const busy = !!(S.job && S.job.running);
  f.innerHTML = '';
  f.classList.toggle('busy', busy);
  el('h3', {}, f, '<i class="ic ic-mic"></i>New capture');
  el('p', {}, f).textContent = 'Pick what to capture and how big the model should be.';

  // source
  const src = row(f, 'Preset', 'Current board uses your unsaved changes too.');
  const sel = el('select', { id: 'capSource' }, src);
  el('option', { value: '__board' }, sel).textContent = `Current board (${(state.preset && state.preset.name) || 'untitled'})`;
  for (const p of S.presets) el('option', { value: p.file }, sel).textContent = p.name;
  sel.value = S.source;
  sel.onchange = async () => { await loadSource(sel.value, false); drawForm(); };

  const p = S.preset;
  if (!p) {
    el('div', { class: 'cap-note err' }, f).textContent = 'This preset could not be loaded.';
    return;
  }
  const chain = serialChain(p);
  const byId = new Map(p.blocks.map((b) => [b.id, b]));

  // what to capture
  const what = row(f, 'Capture', chain ? 'The whole rig, or only some blocks of the chain.' : 'This board has parallel paths, so only the whole rig can be captured.');
  what.appendChild(seg([['all', 'Whole rig'], ['part', 'Part of the chain']], S.part, (v) => { S.part = v; if (!S.nameTouched) S.name = defaultName(); drawForm(); }, chain ? '' : 'disabled'));
  if (S.part === 'part' && chain) {
    const rr = el('div', { class: 'cap-range' }, f);
    const mk = (label, val, on) => {
      const w = el('label', {}, rr);
      el('span', {}, w).textContent = label;
      const s = el('select', {}, w);
      chain.forEach((id, i) => { el('option', { value: id }, s).textContent = `${i + 1}. ${blockName(byId.get(id))}`; });
      s.value = val;
      s.onchange = () => on(s.value);
    };
    mk('From', S.from, (v) => { S.from = v; if (chain.indexOf(S.to) < chain.indexOf(v)) S.to = v; if (!S.nameTouched) S.name = defaultName(); drawForm(); });
    mk('To', S.to, (v) => { S.to = v; if (chain.indexOf(S.from) > chain.indexOf(v)) S.from = v; if (!S.nameTouched) S.name = defaultName(); drawForm(); });
  }
  // the chain at a glance
  const scope = scopePreset();
  const inScope = new Set(scope.blocks.map((b) => b.id));
  const risky = riskyBlocks(scope);
  const riskySet = new Set(risky.map((r) => r.id));
  if (chain) {
    const strip = el('div', { class: 'cap-chain' }, f);
    chain.forEach((id) => {
      const b = byId.get(id);
      const off = b.bypass || (riskySet.has(id) && !S.keepOn.has(id));
      el('span', { class: 'cap-chip' + (inScope.has(id) ? ' in' : '') + (off ? ' off' : '') + (riskySet.has(id) ? ' risky' : ''), title: off ? 'Off for this capture' : '' }, strip).textContent = blockName(b);
    });
  }
  if (risky.length) {
    const w = el('div', { class: 'cap-warn' }, f);
    el('b', {}, w).textContent = 'Some effects can\'t be captured';
    el('p', {}, w).textContent = 'NAM learns amps, drives, EQ and cabs very well, but not effects that change over time or add new notes. Turn them off for the capture and keep them as separate blocks on your board.';
    for (const r of risky) {
      const l = el('label', { class: 'cap-check' }, w);
      const cb = el('input', { type: 'checkbox' }, l);
      cb.checked = !S.keepOn.has(r.id);
      cb.onchange = () => { if (cb.checked) S.keepOn.delete(r.id); else S.keepOn.add(r.id); drawForm(); };
      el('span', {}, l, `Turn off <b>${esc(r.name)}</b> <em>(${esc(r.why)})</em>`);
    }
  }

  // model size
  const ms = row(f, 'Model type', 'Bigger models sound closer to the preset and use more CPU.');
  const cards = el('div', { class: 'cap-archs' }, ms);
  for (const [id, label, desc, badge] of ARCHS) {
    const c = el('button', { class: 'cap-arch' + (S.arch === id ? ' on' : '') }, cards);
    el('b', {}, c, `${label}${badge ? ` <em>${badge}</em>` : ''}`);
    el('span', {}, c).textContent = desc;
    c.onclick = () => { S.arch = id; cards.querySelectorAll('.cap-arch').forEach((x) => x.classList.toggle('on', x === c)); };
  }
  // quality
  const tr = S.status && S.status.trainer;
  const qHint = tr && tr.ready && tr.info && !tr.info.gpu && !tr.info.fake ? 'Training runs on the CPU here: Good can take an hour or more.' : 'More training time gives a closer match.';
  const q = row(f, 'Quality', qHint);
  q.appendChild(seg(QUALITY.map(([k, l, n]) => [k, `${l} · ${n} epochs`]), S.quality, (v) => { S.quality = v; }));
  // name + tone
  const nm = row(f, 'Name', 'The Library block gets this name.');
  const inp = el('input', { type: 'text', value: S.name, maxlength: '60', id: 'capName' }, nm);
  inp.oninput = () => { S.name = inp.value; S.nameTouched = true; };
  const tn = row(f, 'Tone', 'Saved in the model file. Optional.');
  const ts = el('select', {}, tn);
  for (const [k, l] of TONES) el('option', { value: k }, ts).textContent = l;
  ts.value = S.tone;
  ts.onchange = () => (S.tone = ts.value);

  // go
  const foot = el('div', { class: 'cap-foot' }, f);
  const ready = tr && tr.ready && S.input && S.input.ok;
  const go = el('button', { class: 'btn btn-accent cap-go', id: 'capStart' }, foot, '<i class="ic ic-play"></i>Create model');
  go.disabled = busy || !ready;
  go.onclick = () => startCapture();
  if (!ready) el('span', { class: 'cap-note' }, foot).textContent = !(tr && tr.ready) ? 'Set up the trainer first (top left).' : 'Get the training signal first (top right).';
}

async function startCapture(extra = {}) {
  const { graph, preset } = captureGraph();
  if (!graph.nodes.length) return toast('There is nothing to capture in this chain.', 'warn');
  const gear = gearOf(preset);
  const name = (S.name || defaultName()).trim() || 'Capture';
  const opts = Object.assign({
    graph, name, arch: S.arch, epochs: QUALITY.find((x) => x[0] === S.quality)[2], toneType: S.tone, gearType: gear.gearType,
    category: gear.category, color: PACK_COLORS[[...name].reduce((s, ch) => s + ch.charCodeAt(0), 0) % PACK_COLORS.length],
  }, extra);
  S.lastOpts = opts;
  S.job = { running: true, steps: {}, history: [] };
  drawForm();
  drawProgress();
  try {
    S.job = await window.tz.capture.start(opts);
  } catch (e) {
    S.job = null;
    toast(String(e.message || e).replace(/^Error invoking remote method '[^']+': (Error: )?/, ''), 'err', 6000);
  }
  drawForm();
  drawProgress();
}

// ---- progress
function sparkline(values) {
  const W = 260, H = 54;
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', `0 0 ${W} ${H}`);
  s.setAttribute('class', 'cap-spark');
  if (values.length < 2) return s;
  const lv = values.map((v) => Math.log10(Math.max(1e-5, v)));
  const lo = Math.min(...lv), hi = Math.max(...lv, lo + 0.3);
  const pts = lv.map((v, i) => `${((i / (lv.length - 1)) * (W - 4) + 2).toFixed(1)},${(2 + ((hi - v) / (hi - lo)) * (H - 4)).toFixed(1)}`);
  const pl = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
  pl.setAttribute('points', pts.join(' '));
  s.appendChild(pl);
  return s;
}
function drawProgress() {
  const box = document.getElementById('capProgress');
  if (!box) return;
  const j = S.job;
  box.innerHTML = '';
  el('h3', {}, box, '<i class="ic ic-wave"></i>Progress');
  if (!j) {
    el('p', {}, box).textContent = 'Your capture runs in four steps. You can keep playing while it trains: the trainer runs at low priority.';
  } else {
    el('p', {}, box).textContent = j.running ? `Creating "${j.name || S.name}"…` : j.result ? 'Done!' : j.steps && Object.values(j.steps).some((s) => s.state === 'cancel') ? 'Cancelled.' : 'Something went wrong.';
  }
  const list = el('div', { class: 'cap-steps' }, box);
  STEPS.forEach(([id, title], i) => {
    const st = (j && j.steps && j.steps[id]) || { state: 'wait' };
    const r = el('div', { class: 'cap-step ' + st.state, 'data-step': id }, list);
    el('div', { class: 'cap-dot' }, r, st.state === 'done' ? '<i class="ic ic-check"></i>' : st.state === 'error' || st.state === 'cancel' ? '<i class="ic ic-x"></i>' : String(i + 1));
    const body = el('div', { class: 'cap-step-body' }, r);
    el('b', {}, body).textContent = title;
    if (st.text) el('span', {}, body).textContent = st.text;
    if (st.state === 'run') {
      const bar = el('div', { class: 'cap-bar' + (id === 'render' || id === 'check' ? ' soft' : '') }, body);
      el('i', { style: { width: Math.round((st.p || 0) * 100) + '%' } }, bar);
    }
    if (id === 'train' && j && (st.state === 'run' || st.state === 'done') && j.history && j.history.length) {
      const info = el('div', { class: 'cap-train' }, body);
      info.appendChild(sparkline(j.history));
      const t = el('div', { class: 'cap-train-txt' }, info);
      el('div', {}, t, `Accuracy (ESR): <b>${fmtEsr(j.esrNow)}</b>`);
      el('div', {}, t).textContent = 'Lower is better';
      if (st.state === 'run' && j.eta != null) el('div', {}, t).textContent = fmtEta(j.eta);
    }
  });
  if (j && j.running && j.steps && j.steps.train) {
    const a = el('div', { class: 'cap-actions' }, box);
    if (j.steps.train.state === 'run') el('button', { class: 'btn small', id: 'capFinish', title: 'Stop training now and keep the best model so far', onclick: () => window.tz.capture.finish() }, a, 'Finish now');
    el('button', { class: 'btn small btn-danger', id: 'capCancel', onclick: async () => { if (await confirmDlg('Cancel capture', 'Stop and throw away this capture?', 'Stop', true)) window.tz.capture.cancel(); } }, a, 'Cancel');
  }
  if (j && !j.running) drawResult(box, j);
  if (j && j.log && j.log.length && !j.running && j.error) {
    const det = el('details', { class: 'cap-logbox' }, box);
    el('summary', {}, det).textContent = 'Show the log';
    el('pre', { class: 'cap-log' }, det).textContent = j.log.slice(-120).join('\n');
  }
}
function drawResult(box, j) {
  if (j.result) {
    const rt = ratingOf(j.esr) || ['Done', 'ok', ''];
    const card = el('div', { class: 'cap-result' }, box);
    const big = el('div', { class: 'cap-score ' + rt[1] }, card);
    el('b', {}, big).textContent = fmtEsr(j.esr);
    el('span', {}, big).textContent = 'ESR';
    const txt = el('div', { class: 'cap-result-txt' }, card);
    el('div', {}, txt, `<span class="cap-rating ${rt[1]}">${esc(rt[0])}</span> ${esc(rt[2])}`);
    const lines = [];
    if (j.esrs && j.esrs.length > 1) lines.push(`Lite size ESR ${fmtEsr(j.esrs[0])}`);
    if (j.engine && j.engine.ok) lines.push(`Plays correctly in the Tone Zone engine (ESR ${fmtEsr(j.engine.esr)})`);
    el('small', {}, txt).textContent = lines.join(' · ');
    const a = el('div', { class: 'cap-actions' }, box);
    el('button', { class: 'btn btn-accent', id: 'capOpen', onclick: () => bus.emit('addToBoard', 'pack:' + j.result.packId) }, a, '<i class="ic ic-plus"></i>Open on board');
    el('button', { class: 'btn', onclick: () => bus.emit('tab', 'library') }, a, '<i class="ic ic-lib"></i>Show in Library');
    el('button', { class: 'btn', onclick: () => { window.tz.capture.clear(); S.job = null; drawProgress(); drawForm(); } }, a, 'New capture');
    return;
  }
  const a = el('div', { class: 'cap-actions' }, box);
  if (j.errorCode === 'checks' && S.lastOpts) {
    el('div', { class: 'cap-note' }, box).textContent = 'You can train anyway, but the model may not sound right.';
    el('button', { class: 'btn btn-accent', onclick: () => startCapture(Object.assign({}, S.lastOpts, { ignoreChecks: true })) }, a, 'Train anyway');
  }
  if (S.lastOpts) el('button', { class: 'btn', onclick: () => startCapture(S.lastOpts) }, a, '<i class="ic ic-reload"></i>Try again');
  el('button', { class: 'btn', onclick: () => { window.tz.capture.clear(); S.job = null; drawProgress(); drawForm(); } }, a, 'Close');
}

// ------------------------------------------------------------------ settings panel
export function captureSettingsPanel(grid) {
  const p = el('div', { class: 'panel' }, grid);
  el('h3', {}, p, '<i class="ic ic-mic"></i>Capture trainer');
  el('p', {}, p).textContent = 'The NAM trainer and PyTorch used by the Capture tab live in their own folder.';
  const r = el('div', { class: 'srow' }, p);
  const lbl = el('div', { class: 'lbl' }, r, '<b>Trainer</b><small>Checking…</small>');
  const ctl = el('div', { class: 'ctrl' }, r);
  const btn = el('button', { class: 'btn small btn-danger', id: 'capRemoveTrainer' }, ctl, '<i class="ic ic-trash"></i>Remove trainer');
  const upd = async () => {
    const st = await window.tz.capture.status();
    const t = st.trainer;
    const size = t.venvExists ? await window.tz.capture.trainerSize() : 0;
    lbl.querySelector('small').textContent = t.venvExists ? `${t.ready ? 'Installed' : 'Partly installed'} · ${fmtBytes(size)} in ${t.dir}` : 'Not installed. Set it up from the Capture tab.';
    btn.disabled = !t.venvExists;
  };
  btn.onclick = async () => {
    if (!(await confirmDlg('Remove trainer', 'Delete the NAM trainer and PyTorch to free disk space? Your models stay in the Library. You can set it up again any time.', 'Remove', true))) return;
    try {
      await window.tz.capture.removeTrainer();
      toast('Trainer removed', 'ok');
    } catch (e) {
      toast(String(e.message || e).replace(/^Error invoking remote method '[^']+': (Error: )?/, ''), 'err');
    }
    S.setup = null;
    upd();
    if (root) refreshStatus().then(() => { drawTop(); drawForm(); });
  };
  upd();
  return p;
}
