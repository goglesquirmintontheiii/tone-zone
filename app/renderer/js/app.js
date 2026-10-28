// Tone Zone renderer bootstrap.
import { bus, toast, el, clamp } from './util.js';
import { Editor } from './editor.js';
import { initBrowser, isFavorite, toggleFavorite } from './browser.js';
import { makeDockable } from './panels.js';
import { loadPlugins } from './plugins.js';
import './screens-eq.js';
import { initInspector } from './inspector.js';
import { buildGraph } from './state.js';
import { state, loadPreset, newPreset, undo, redo, canUndo, canRedo, removeBlocks, duplicateBlocks, setBypass, setVariant, blockById, commitNow, markDirty, CABLE_COLORS } from './state.js';
import { getDef, canSwitchVariant } from './catalog/index.js';
import { showMenu } from './menus.js';
import { refreshPacks, renderLibrary, importDialog } from './pages/library.js';
import { initTone3000, showTone3000 } from './pages/tone3000.js';
import { renderSettings, sendEngineSettings, onPorts } from './pages/settings.js';
import { renderCapture } from './pages/capture.js';
import { renderPresets } from './pages/presets.js';
import { refreshPresetList, openPreset, savePreset, step, updateTitle, showPresetMenu, localStorageSafeGet } from './presets.js';

let editor;

async function boot() {
  state.settings = await window.tz.settings.get();
  const info = await window.tz.app.info();
  state.appVersion = info.version;
  // thumbnail cache key: the app version (packaged) or the session start (development, art changes often)
  window.__tzAppVersion = info.packaged ? info.version : 'dev-' + Date.now();
  await loadPlugins();
  state.cableColor = state.settings.cableColor || CABLE_COLORS[0];
  editor = new Editor();
  editor.onTick = flushMeters;
  window.__tz = { editor, state, removeBlocks, loadPreset, buildGraph };
  initBrowser(editor);
  initInspector(editor);
  makeDockable(document.getElementById('browser'), { id: 'browser', side: 'left', title: 'Blocks', min: 230, max: 560, toolHost: document.querySelector('#browser .search') });
  makeDockable(document.getElementById('inspector'), { id: 'inspector', side: 'right', title: 'Block settings', min: 260, max: 640 });
  initTabs();
  initTopbar();
  initEngineEvents();
  initGlobalKeys();
  initFileDrop();
  initTone3000();
  initNodeMenu();
  // engine param registry (for the inspector's advanced section)
  window.tz.engine.list().then((reg) => (state.engineParams = reg || {}));
  await refreshPacks();
  const presets = await refreshPresetList();
  const last = localStorageSafeGet('tz.lastPreset');
  const pick = presets.find((p) => p.file === last) || presets.find((p) => /^01-|welcome/i.test(p.file)) || presets[0];
  if (pick) {
    const p = await window.tz.presets.load(pick.file);
    loadPreset(p, pick.file);
  } else loadPreset(newPreset(), null);
  updateTitle();
  sendEngineSettings();
  window.__tz.ready = true;
  setTimeout(() => {
    const h = document.getElementById('boardHint');
    h.textContent = 'Drag pedals from the left · drag between 1/4" jacks to patch · scroll to zoom';
    h.classList.add('show');
    setTimeout(() => h.classList.remove('show'), 6000);
  }, 800);
}

// ------------------------------------------------------------ tabs
function initTabs() {
  const tabs = document.getElementById('tabs');
  const ink = tabs.querySelector('.tab-ink');
  const moveInk = (b) => {
    ink.style.left = b.offsetLeft + 'px';
    ink.style.width = b.offsetWidth + 'px';
  };
  const show = (name) => {
    tabs.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
    moveInk(tabs.querySelector('button.active'));
    document.querySelectorAll('.view').forEach((v) => v.classList.toggle('active', v.id === 'view-' + name));
    if (name === 'library') renderLibrary();
    if (name === 'presets') renderPresets();
    if (name === 'tonematch') import('./pages/tonematch.js').then((m) => m.renderToneMatch()).catch((e) => console.error(e));
    if (name === 'plugins') import('./pages/plugins.js').then((m) => m.renderPlugins()).catch((e) => console.error(e));
    if (name === 'settings') renderSettings();
    if (name === 'capture') renderCapture();
    if (name === 'tone3000') showTone3000();
    if (name === 'board') document.getElementById('board').focus({ preventScroll: true });
  };
  tabs.querySelectorAll('button').forEach((b) => (b.onclick = () => show(b.dataset.tab)));
  requestAnimationFrame(() => moveInk(tabs.querySelector('button.active')));
  window.addEventListener('resize', () => moveInk(tabs.querySelector('button.active')));
  bus.on('tab', show);
}

// ------------------------------------------------------------ top bar & meters
function initTopbar() {
  document.getElementById('presetName').onclick = () => bus.emit('tab', 'presets');
  document.getElementById('presetPrev').onclick = () => step(-1);
  document.getElementById('presetNext').onclick = () => step(1);
  document.getElementById('presetSave').onclick = () => savePreset(false);
  document.getElementById('undoBtn').onclick = () => undo();
  document.getElementById('redoBtn').onclick = () => redo();
  const pick = document.getElementById('cableColorPick');
  pick.style.background = state.cableColor;
  pick.onclick = (e) => {
    const r = pick.getBoundingClientRect();
    showMenu(r.left - 60, r.top - 120, [{ title: 'New cable colour' }, { swatches: CABLE_COLORS, onPick: (c) => bus.emit('cableColor', c) }]);
    void e;
  };
  bus.on('cableColor', (c) => {
    state.cableColor = c;
    pick.style.background = c;
    window.tz.settings.set({ cableColor: c });
  });
  document.getElementById('autoLayout').onclick = () => bus.emit('tidy');
  bus.on('history', () => {
    document.getElementById('undoBtn').disabled = !canUndo();
    document.getElementById('redoBtn').disabled = !canRedo();
  });
  bus.on('tidy', tidyLayout);
  bus.on('addToBoard', (id) => {
    bus.emit('tab', 'board');
    setTimeout(() => editor.addNear(id), 60);
  });
  bus.on('rebuildBoard', () => editor.rebuild(true));
  bus.on('packsEdited', () => editor.rebuild(true));
  bus.on('quickAdd', () => document.getElementById('blockSearch').focus());
}

let peakHoldIn = 0, peakHoldOut = 0;
const meterEls = {};
const meterCache = {};
function mset(key, fn, v) {
  if (meterCache[key] === v) return;
  meterCache[key] = v;
  fn(v);
}
// Top-bar meters are drawn on canvases: canvas updates don't invalidate the page's paint, whereas changing a DOM
// element every frame made Chromium re-layerize the whole page (board included) ~20× a second.
function meterCanvas(host, key) {
  let m = meterEls[key];
  if (!m || !m.c.isConnected) {
    host.querySelectorAll(':scope > *').forEach((x) => (x.style.display = 'none'));
    const c = document.createElement('canvas');
    c.className = 'meter-canvas';
    host.appendChild(c);
    m = meterEls[key] = { c, cx: c.getContext('2d'), w: 0, h: 0, grad: null };
  }
  const r = host.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const W = Math.max(1, Math.round(r.width * dpr)), H = Math.max(1, Math.round(r.height * dpr));
  if (W !== m.w || H !== m.h) {
    m.c.width = m.w = W;
    m.c.height = m.h = H;
    const g = m.cx.createLinearGradient(0, 0, W, 0);
    g.addColorStop(0, '#2bd4b0'); g.addColorStop(0.55, '#93e05a'); g.addColorStop(0.8, '#ffc24b'); g.addColorStop(1, '#ff4d5e');
    m.grad = g;
  }
  return m;
}
function drawBar(m, v, mark, over) {
  const { cx, w, h } = m;
  cx.clearRect(0, 0, w, h);
  cx.fillStyle = over ? '#ff5a52' : m.grad;
  cx.fillRect(0, 0, Math.round(w * clamp(v, 0, 1)), h);
  if (mark != null) { cx.fillStyle = 'rgba(255,255,255,0.75)'; cx.fillRect(Math.round(w * mark) - 1, 0, Math.max(1, Math.round(h / 6)), h); }
}
function updateMeters(st) {
  const $ = (k, sel) => meterEls[k] || (meterEls[k] = document.querySelector(sel));
  const budget = state.settings.budget ?? 0.75;
  const load = st.load || 0;
  const dsp = (Math.round(clamp(load, 0, 1) * 100) / 100).toFixed(2) + '|' + budget;
  mset('dsp', () => drawBar(meterCanvas($('dspHost', '.dsp-meter'), 'dspC'), clamp(load, 0, 1), budget, load > budget), dsp);
  if (Date.now() - (meterCache.txtT || 0) > 250) {
    meterCache.txtT = Date.now();
    mset('dspVal', (v) => ($('dspVal', '#dspVal').textContent = v), Math.round(load * 100) + '%');
    mset('lat', (v) => ($('lat', '#latVal').textContent = v), st.running ? st.latencyMs.toFixed(1) + ' ms' : '–');
  }
  const toW = (p) => clamp((20 * Math.log10(Math.max(p, 1e-6)) + 60) / 60, 0, 1);
  const inP = Math.max(...(st.inPeak || [0]).slice(0, 2)), outP = Math.max(...(st.outPeak || [0]).slice(0, 2));
  peakHoldIn = Math.max(inP, peakHoldIn * 0.85);
  peakHoldOut = Math.max(outP, peakHoldOut * 0.85);
  const vi = Math.round(toW(peakHoldIn) * 60) / 60, vo = Math.round(toW(peakHoldOut) * 60) / 60;
  mset('vin', () => drawBar(meterCanvas($('vinHost', '#vuIn'), 'vinC'), vi, null, false), vi);
  mset('vout', () => drawBar(meterCanvas($('voutHost', '#vuOut'), 'voutC'), vo, null, false), vo);
  const dot = $('dot', '#engineDot');
  mset('dotc', (v) => (dot.className = v), 'engine-dot ' + (st.running ? 'ok' : 'err'));
  if (Date.now() - (meterCache.dotT || 0) > 1000) {
    meterCache.dotT = Date.now();
    dot.title = st.running ? `PipeWire · ${st.sr} Hz · ${st.buffer} frames · xruns ${st.xruns}` : 'Audio engine not connected';
  }
}

// ------------------------------------------------------------ automatic quality scaling (DSP budget)
let overSince = 0;
function autoQuality(st) {
  const s = state.settings;
  if (!s.autoQuality || !st.running) return;
  const over = st.load > (s.budget ?? 0.75);
  if (!over) { overSince = 0; return; }
  if (!overSince) overSince = Date.now();
  if (Date.now() - overSince > 3000 && (s.quality ?? 1) > 0) {
    overSince = 0;
    const q = (s.quality ?? 1) - 1;
    import('./pages/settings.js').then((m) => m.applySettings({ quality: q }));
    toast(`Over DSP budget – quality lowered to ${['Eco', 'Standard', 'High', 'Ultra'][q]}`, 'warn', 4000);
  }
}

// ------------------------------------------------------------ engine events
let overBudgetWarned = 0;
let pendingMeters = null;
export function flushMeters() {
  if (!pendingMeters) return;
  const ev = pendingMeters;
  pendingMeters = null;
  updateMeters(ev);
}
function initEngineEvents() {
  window.tz.engine.onEvent((ev) => {
    switch (ev.ev) {
      case 'status':
        state.status = ev;
        // the top-bar meters are applied in the board's tick so all repaints land in one frame
        pendingMeters = ev;
        autoQuality(ev);
        if (ev.load > (state.settings.budget ?? 0.75) && Date.now() - overBudgetWarned > 20000) {
          overBudgetWarned = Date.now();
          toast(`DSP load ${Math.round(ev.load * 100)}% is over your budget – lower the quality, raise the buffer or remove blocks.`, 'warn', 5000);
        }
        break;
      case 'ready':
        // (re)send the full current board – the engine may have been restarted
        import('./state.js').then((m) => { m.syncGraph(); sendEngineSettings(); });
        if (state.settings.autoConnect !== false && !state._autoConnected) {
          state._autoConnected = true;
          window.tz.engine.send({ cmd: 'autoConnect' });
        }
        toast(`Audio running · ${ev.sr} Hz · ${ev.buffer} frames`, 'ok', 2500);
        break;
      case 'audioError':
        toast(ev.error, 'err', 8000);
        document.getElementById('engineDot').className = 'engine-dot err';
        break;
      case 'engineExit':
        toast('Audio engine stopped – restarting…', 'warn');
        break;
      case 'blockError':
        toast(`${getDef(blockById(ev.id)?.type || '')?.name || 'Block'}: ${ev.error}`, 'err', 7000);
        break;
      case 'blockInfo':
        bus.emit('blockInfo', ev);
        break;
      case 'ports':
        onPorts(ev);
        break;
    }
  });
}

// ------------------------------------------------------------ keyboard
let clipboard = null;
function initGlobalKeys() {
  window.addEventListener('keydown', (e) => {
    const tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
    const k = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && k === 's') {
      e.preventDefault();
      savePreset(e.shiftKey);
    } else if ((e.ctrlKey || e.metaKey) && k === 'z') {
      e.preventDefault();
      e.shiftKey ? redo() : undo();
    } else if ((e.ctrlKey || e.metaKey) && k === 'y') {
      e.preventDefault();
      redo();
    } else if ((e.ctrlKey || e.metaKey) && k === 'c' && state.selection.size) {
      clipboard = [...state.selection].map((id) => blockById(id)).filter((b) => b && !b.id.startsWith('__')).map((b) => JSON.parse(JSON.stringify(b)));
    } else if ((e.ctrlKey || e.metaKey) && k === 'v' && clipboard) {
      paste();
    }
  });
  bus.on('paste', paste);
}
function paste() {
  if (!clipboard || !clipboard.length) return;
  commitNow();
  const ids = [];
  for (const b of clipboard) {
    const nb = JSON.parse(JSON.stringify(b));
    nb.id = 'b' + Math.random().toString(36).slice(2, 9);
    nb.x += 50;
    nb.y += 50;
    state.preset.blocks.push(nb);
    bus.emit('block:added', nb);
    ids.push(nb.id);
  }
  import('./state.js').then((m) => m.syncGraph());
  editor.select(ids);
}

// ------------------------------------------------------------ drag files in from the desktop
function initFileDrop() {
  const ov = document.getElementById('dropOverlay');
  let depth = 0;
  window.addEventListener('dragenter', (e) => {
    if (!e.dataTransfer.types.includes('Files')) return;
    depth++;
    ov.classList.add('show');
  });
  window.addEventListener('dragleave', () => {
    depth = Math.max(0, depth - 1);
    if (!depth) ov.classList.remove('show');
  });
  window.addEventListener('dragover', (e) => e.dataTransfer.types.includes('Files') && e.preventDefault());
  window.addEventListener('drop', async (e) => {
    if (!e.dataTransfer.files.length) return;
    e.preventDefault();
    depth = 0;
    ov.classList.remove('show');
    const paths = [...e.dataTransfer.files].map((f) => window.tz.lib.pathForFile(f)).filter(Boolean);
    const presets = paths.filter((p) => p.endsWith('.json'));
    const media = paths.filter((p) => !p.endsWith('.json'));
    if (media.length) {
      const info = await window.tz.lib.inspectPaths(media, 'file');
      await importDialog(info);
    }
    if (presets.length) toast('Use the preset menu → Import to add presets', 'info');
  });
}

// ------------------------------------------------------------ node context menu
function initNodeMenu() {
  bus.on('nodeMenu', ({ id, x, y }) => {
    const b = blockById(id);
    const d = b && getDef(b.type);
    if (!d) return;
    const io = id.startsWith('__');
    const items = [{ title: d.name }];
    if (!io) {
      if (!d.alwaysOn) items.push({ label: b.bypass ? 'Enable' : 'Bypass', icon: 'power', kbd: 'B', onClick: () => setBypass(id, !b.bypass) });
      if (canSwitchVariant(d)) items.push({ label: (b.variant || 'mono') === 'stereo' ? 'Switch to mono' : 'Switch to stereo', icon: 'cable', onClick: () => { setVariant(id, (b.variant || 'mono') === 'stereo' ? 'mono' : 'stereo'); editor.rerenderNode(id); } });
      items.push({ label: 'Duplicate', icon: 'copy', kbd: 'Ctrl+D', onClick: () => editor.select(duplicateBlocks([...state.selection]).map((n) => n.id)) });
      items.push({ label: isFavorite(b.type) ? 'Remove from favourites' : 'Add to favourites', icon: 'star', onClick: () => toggleFavorite(b.type) });
      if (d.cabMics) items.push({ label: 'Add microphone', icon: 'mic', onClick: () => { import('./inspector.js').then((m) => { m.addMic(b); editor.select([id]); }); } });
      items.push({ label: 'Unplug all cables', icon: 'cable', onClick: () => { commitNow(); state.preset.cables = state.preset.cables.filter((c) => c.from.node !== id && c.to.node !== id); bus.emit('cables'); import('./state.js').then((m) => m.syncGraph()); } });
      items.push({ sep: true });
      items.push({ label: 'Delete', icon: 'trash', kbd: 'Del', onClick: () => removeBlocks([...state.selection]) });
    } else items.push({ label: 'Unplug all cables', icon: 'cable', onClick: () => { commitNow(); state.preset.cables = state.preset.cables.filter((c) => c.from.node !== id && c.to.node !== id); bus.emit('cables'); import('./state.js').then((m) => m.syncGraph()); } });
    showMenu(x, y, items);
  });
}

// ------------------------------------------------------------ tidy: lay the signal chain out like a pedalboard
function tidyLayout() {
  commitNow();
  const blocks = state.preset.blocks;
  const out = new Map();
  for (const c of state.preset.cables) {
    if (!out.has(c.from.node)) out.set(c.from.node, []);
    out.get(c.from.node).push(c.to.node);
  }
  // BFS depth from the input
  const depth = new Map([['__in', 0]]);
  const q = ['__in'];
  while (q.length) {
    const n = q.shift();
    for (const m of out.get(n) || []) if (!depth.has(m)) { depth.set(m, depth.get(n) + 1); q.push(m); }
  }
  let maxD = 0;
  for (const v of depth.values()) maxD = Math.max(maxD, v);
  const cols = new Map();
  for (const b of blocks) {
    let d = depth.has(b.id) ? depth.get(b.id) : maxD + 1;
    if (b.id === '__out') d = maxD + 1;
    if (!cols.has(d)) cols.set(d, []);
    cols.get(d).push(b);
  }
  const ltr = !!state.settings.flowLeftToRight;
  const keys = [...cols.keys()].sort((a, b) => a - b);
  let x = 0;
  const xs = new Map();
  for (const k of keys) {
    const col = cols.get(k);
    const w = Math.max(...col.map((b) => editor.views.get(b.id)?.w || 150));
    xs.set(k, { x, w });
    x += w + 90;
  }
  const total = x;
  for (const k of keys) {
    let y = 40;
    for (const b of cols.get(k)) {
      const v = editor.views.get(b.id);
      const { x: cx, w } = xs.get(k);
      const px = ltr ? cx : total - cx - w;
      v?.setPosition(px + (w - (v?.w || 150)) / 2, y);
      y += (v?.h || 250) + 70;
    }
  }
  editor.drawCables();
  markDirty();
  setTimeout(() => editor.fit(), 50);
}

boot().catch((e) => {
  console.error(e);
  const pre = el('pre', { style: { position: 'fixed', inset: '60px 20px auto', color: '#f88', whiteSpace: 'pre-wrap', zIndex: 999 } }, document.body);
  pre.textContent = 'Startup error: ' + (e.stack || e);
});
