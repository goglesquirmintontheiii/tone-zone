// The screen code panel: a code editor with a live preview of the screen next to it, simulated controls and
// signals to try it with, examples and the API reference.
import { el } from '../util.js';
import { CodeEditor, highlight } from './code-editor.js';
import { ScreenRuntime } from './runtime.js';
import { makeHost, simIO, controlList, findControl } from './host.js';
import { screenPixels, paletteOf } from './surface.js';
import { API } from './docs.js';
import { TEMPLATES, SNIPPETS } from './templates.js';
import { loadCSS, keysTo, optsFor } from './factory-ui.js';

let current = null;
export const editorOpen = () => !!current;
export const editorState = () => current && current.peek();

/**
 * o = { getD, id, onCode(code, final), openGen(id, onUse), paramsFor(D) -> fn(ui) }
 */
export function openScreenEditor(o) {
  if (current) current.close();
  loadCSS();
  const part = () => (o.getD().ctls || []).find((x) => x.id === o.id);
  const c0 = part();
  if (!c0) return null;
  const D = o.getD();
  const { W, H } = screenPixels(c0);
  const list = controlList(D);
  let paramsFor = null;
  try {
    paramsFor = o.paramsFor ? o.paramsFor(D) : null;
  } catch (_) {
    paramsFor = null;
  }

  // ---- layout
  const ov = el('div', { class: 'ss-overlay' }, document.body);
  const win = el('div', { class: 'ss-win', role: 'dialog', 'aria-label': 'Screen code' }, ov);
  const hd = el('header', { class: 'ss-head' }, win);
  const ttl = el('div', { class: 'ss-ttl' }, hd);
  el('h2', {}, ttl).textContent = 'Screen code';
  el('p', {}, ttl).textContent = `${c0.label || 'Screen'} on ${D.name || 'this pedal'}, ${W} x ${H} pixels`;
  const hb = el('div', { class: 'ss-hbtns' }, hd);
  const bFind = el('button', { class: 'btn small', title: 'Find (Ctrl+F)' }, hb);
  bFind.textContent = 'Find';
  const bGen = el('button', { class: 'btn small', 'data-ss': 'gen' }, hb);
  bGen.textContent = 'Generate...';
  const bDone = el('button', { class: 'btn small btn-accent', 'data-ss': 'done' }, hb);
  bDone.textContent = 'Done';

  const main = el('div', { class: 'ss-main' }, win);
  const left = el('div', { class: 'ss-left' }, main);
  // what the type hints know about this pedal: its controls, this screen's ports and the signals
  let hintCtx = null, uiReady = false;
  const hints = () => hintCtx;
  const ed = new CodeEditor(left, { value: c0.script || '', onChange: () => schedule(), hints, onWarnings: () => uiReady && paintWarn() });
  const status = el('div', { class: 'ss-status' }, left);
  // the light checks: a link to the first one (they never stop the script)
  function paintWarn() {
    const old = status.querySelector('.ss-warnlink');
    if (old) old.remove();
    const ws = ed.warnings || [];
    if (!ws.length) return;
    const b = el('button', { class: 'ss-errlink ss-warnlink', 'data-ss': 'warnings', title: ws[0].message }, status);
    b.textContent = ws.length === 1 ? `1 hint on line ${ws[0].line}` : `${ws.length} hints, the first on line ${ws[0].line}`;
    b.onclick = () => ed.gotoLine(ws[0].line);
  }
  uiReady = true;
  const cons = el('div', { class: 'ss-console' }, left);
  const side = el('div', { class: 'ss-side' }, main);

  // preview
  const pv = el('div', { class: 'ss-preview' }, side);
  const frame = el('div', { class: 'ss-pframe ss-type-' + (c0.type || 'oled') }, pv);
  const canvas = el('canvas', { class: 'ss-pcanvas', 'data-ss': 'preview' }, frame);
  const fit = Math.min(392 / W, 230 / H);
  const scale = fit >= 2 ? Math.min(6, Math.floor(fit)) : Math.max(1, fit);
  canvas.style.width = W * scale + 'px';
  canvas.style.height = H * scale + 'px';
  const pbar = el('div', { class: 'ss-pbar' }, pv);
  const bRestart = el('button', { class: 'btn small', title: 'Run the script again from the top' }, pbar);
  bRestart.textContent = 'Restart';
  const pinfo = el('span', { class: 'ss-pinfo' }, pbar);
  pinfo.textContent = 'Click the screen to try it';

  // side tabs
  const tabs = el('div', { class: 'seg ss-tabs' }, side);
  const panes = {};
  const tabBtns = {};
  const showTab = (k) => {
    for (const t in panes) {
      panes[t].hidden = t !== k;
      tabBtns[t].classList.toggle('on', t === k);
    }
  };
  for (const [k, label] of [['test', 'Test'], ['ref', 'Reference'], ['ex', 'Examples']]) {
    tabBtns[k] = el('button', { 'data-tab': k, onclick: () => showTab(k) }, tabs);
    tabBtns[k].textContent = label;
    panes[k] = el('div', { class: 'ss-pane ss-pane-' + k }, side);
  }

  // ---- the simulated pedal
  const { io, sim } = simIO(D, { paramsFor, log: null });
  io.cid = o.id; // the screen's own inputs and outputs
  const host = makeHost(D, io);
  let sigNames = [];
  try {
    sigNames = host.signals();
  } catch (_) {
    sigNames = [];
  }
  hintCtx = { controls: list.map((e) => ({ name: e.name, kind: e.kind })), findControl: (n, kind) => !!findControl(list, n, kind), ports: host.screenPorts(), signals: sigNames };
  ed.runLint();
  const simRows = [];
  const tp = panes.test;
  el('h5', {}, tp).textContent = 'Pedal';
  const rowEl = (label) => {
    const r = el('label', { class: 'ss-simrow' }, tp);
    el('span', {}, r).textContent = label;
    return r;
  };
  {
    const r = rowEl('Pedal on');
    const cb = el('input', { type: 'checkbox' }, r);
    cb.checked = !sim.bypass;
    cb.onchange = () => (sim.bypass = !cb.checked);
    simRows.push(() => (cb.checked = !sim.bypass));
  }
  el('h5', {}, tp).textContent = 'Signals';
  {
    const r = rowEl('Demo guitar');
    const cb = el('input', { type: 'checkbox', 'data-ss': 'demo' }, r);
    cb.checked = sim.demo;
    const ins = [];
    cb.onchange = () => {
      sim.demo = cb.checked;
      ins.forEach((i) => (i.disabled = sim.demo));
    };
    for (const [k, label] of [['inLevel', 'Input level'], ['outLevel', 'Output level']]) {
      const rr = rowEl(label);
      const i = el('input', { type: 'range', min: 0, max: 1, step: 0.01 }, rr);
      i.value = sim[k];
      i.disabled = sim.demo;
      i.oninput = () => (sim[k] = +i.value);
      ins.push(i);
    }
  }
  if (list.length) el('h5', {}, tp).textContent = 'Controls';
  for (const e of list) {
    const r = rowEl(e.name);
    let inp;
    if (e.kind === 'knob') {
      inp = el('input', { type: 'range', min: 0, max: 1, step: 0.005, 'data-ctl': e.id }, r);
      inp.oninput = () => io.set(e.p, +inp.value);
      simRows.push(() => (inp.value = io.get(e.p) ?? e.def));
    } else if (e.kind === 'switch') {
      inp = el('select', { 'data-ctl': e.id }, r);
      e.opts.forEach((t, i) => (el('option', { value: i }, inp).textContent = `${i + 1}: ${t}`));
      inp.onchange = () => io.set(e.p, +inp.value);
      simRows.push(() => (inp.value = io.get(e.p) ?? e.def));
    } else if (e.p) {
      inp = el('input', { type: 'checkbox', 'data-ctl': e.id }, r);
      inp.onchange = () => io.set(e.p, inp.checked ? 1 : 0);
      simRows.push(() => (inp.checked = (io.get(e.p) ?? e.def) > 0.5));
    } else {
      el('em', {}, r).textContent = e.action === 'bypass' ? 'bypass (use Pedal on)' : 'tap';
    }
  }
  if (!list.length) el('p', { class: 'fz-note' }, tp).textContent = 'This pedal has no controls yet.';
  // this screen's own inputs (set by hand here) and outputs (what the script sets)
  const sp = hintCtx.ports;
  const outRows = [];
  if (sp.ins.length || sp.outs.length) el('h5', {}, tp).textContent = 'Screen inputs and outputs';
  sp.ins.forEach((p, i) => {
    const r = rowEl(`In ${i + 1}: ${p.name}`);
    if (p.sig === 'b') {
      const cb = el('input', { type: 'checkbox', 'data-sin': i }, r);
      cb.onchange = () => sim.ports.set(i, cb.checked ? 1 : 0);
      sim.ports.set(i, 0);
    } else {
      const w = el('div', { class: 'ss-simport' }, r);
      const rg = el('input', { type: 'range', min: 0, max: 1, step: 0.01, 'data-sin': i }, w);
      const out = el('span', { class: 'ss-simval' }, w);
      rg.value = 0;
      out.textContent = '0.00';
      rg.oninput = () => {
        sim.ports.set(i, +rg.value);
        out.textContent = (+rg.value).toFixed(2);
      };
      sim.ports.set(i, 0);
    }
  });
  sp.outs.forEach((p, i) => {
    const r = rowEl(`Out ${i + 1}: ${p.name}`);
    const v = el('span', { class: 'ss-simval', 'data-sout': i }, r);
    outRows.push(() => {
      const x = host.screenOutputValue(i + 1);
      v.textContent = p.sig === 'b' ? (x > 0.5 ? 'on (1)' : 'off (0)') : (Math.round(x * 1000) / 1000).toString();
    });
  });
  if (sp.ins.length || sp.outs.length) el('p', { class: 'fz-note' }, tp).textContent = 'Inputs here stand in for what is wired to them. In Test mode and on the board they read the circuit.';
  let simDirty = true;
  sim.onSet = () => (simDirty = true);
  const paintSim = () => simRows.forEach((f) => f());
  const paintOuts = () => outRows.forEach((f) => f());

  // ---- reference
  const rp = panes.ref;
  const rq = el('input', { type: 'text', class: 'ss-refq', placeholder: 'Search the reference' }, rp);
  const rlist = el('div', { class: 'ss-ref' }, rp);
  const paintRef = () => {
    const k = rq.value.trim().toLowerCase();
    rlist.textContent = '';
    for (const g of API) {
      const items = g.items.filter(([n, s, d]) => !k || (n + s + d).toLowerCase().includes(k));
      if (!items.length) continue;
      el('h5', {}, rlist).textContent = g.group;
      if (g.intro && !k) el('p', { class: 'ss-intro' }, rlist).textContent = g.intro;
      if (g.guide && !k) el('p', { class: 'ss-intro' }, rlist).textContent = 'The guide for these is below the list.';
      for (const [, s, d] of items) {
        const it = el('div', { class: 'ss-refitem', title: 'Click to insert' }, rlist);
        el('code', {}, it).textContent = s;
        el('span', {}, it).textContent = d;
        it.onclick = () => {
          if (g.group === 'Running') ed.insert(`function ${s.replace(/^function\s+/, '').replace(/\s*\.\.\.\s*end$/, '')}\n  \nend\n`);
          else ed.insert(s.split(' or ')[0] + '\n');
          ed.focus();
        };
      }
      if (g.guide && (!k || guideText(g.guide).includes(k))) paintGuide(g.guide, rlist);
    }
  };
  const guideText = (blocks) => blocks.map(([, v]) => (Array.isArray(v) ? v.join(' ') : v)).join(' ').toLowerCase();
  const inline = (host, text) => {
    // **bold** only, the rest as plain text
    text.split(/(\*\*[^*]+\*\*)/).forEach((part) => {
      if (/^\*\*.+\*\*$/.test(part)) el('b', {}, host).textContent = part.slice(2, -2);
      else if (part) host.appendChild(document.createTextNode(part));
    });
  };
  function paintGuide(blocks, into) {
    const box = el('div', { class: 'ss-refguide', 'data-guide': 'ports' }, into);
    for (const [kind, v] of blocks) {
      if (kind === 'h') el('h6', {}, box).textContent = v;
      else if (kind === 'p') inline(el('p', {}, box), v);
      else if (kind === 'list') {
        const ul = el('ul', {}, box);
        for (const x of v) inline(el('li', {}, ul), x);
      } else if (kind === 'code') {
        const pre = el('pre', { class: 'ss-refcode', title: 'Click to insert' }, box);
        pre.innerHTML = highlight(v.replace(/\n$/, ''));
        pre.onclick = () => {
          ed.insert(v);
          ed.focus();
        };
      }
    }
  }
  rq.oninput = paintRef;
  paintRef();

  // ---- examples
  const xp = panes.ex;
  el('h5', {}, xp).textContent = 'Start from a template';
  for (const t of TEMPLATES) {
    const it = el('div', { class: 'ss-exitem', 'data-template': t.id }, xp);
    el('b', {}, it).textContent = t.name;
    el('span', {}, it).textContent = t.desc;
    it.onclick = () => {
      ed.replaceAll(t.make(optsFor(o.getD())));
      ed.focus();
    };
  }
  el('p', { class: 'fz-note' }, xp).textContent = 'A template replaces the code. Ctrl+Z in the code brings it back.';
  el('h5', {}, xp).textContent = 'Insert a snippet';
  for (const [name, code] of SNIPPETS) {
    const it = el('div', { class: 'ss-exitem small' }, xp);
    el('b', {}, it).textContent = name;
    it.onclick = () => {
      ed.insert(code);
      ed.focus();
    };
  }
  showTab('test');

  // ---- running the preview
  let rt = null;
  let lastGood = '';
  const logLines = [];
  const log = (m) => {
    logLines.push(m);
    if (logLines.length > 80) logLines.shift();
    cons.textContent = logLines.join('\n');
    cons.scrollTop = cons.scrollHeight;
    cons.classList.toggle('has', logLines.length > 0);
  };
  const showStatus = () => {
    const err = rt && rt.error;
    status.className = 'ss-status ' + (err ? 'bad' : 'ok');
    status.textContent = '';
    if (err) {
      const b = el('button', { class: 'ss-errlink' }, status);
      b.textContent = (err.line ? `Line ${err.line}: ` : '') + err.message;
      b.onclick = () => err.line && ed.gotoLine(err.line);
      if (lastGood && lastGood !== ed.value && err.kind === 'syntax') el('span', { class: 'ss-dim' }, status).textContent = '  (the preview shows the last version that worked)';
    } else status.textContent = 'Running';
    ed.setErrors(err ? [err] : []);
    paintWarn();
  };
  const build = (src, keepOld) => {
    const next = new ScreenRuntime({ src, w: W, h: H, host, canvas: keepOld ? document.createElement('canvas') : canvas, palette: paletteOf(part() || c0), screen: { type: (part() || c0).type, name: c0.label || '' }, onLog: log });
    return next;
  };
  const restart = (src) => {
    logLines.length = 0;
    cons.textContent = '';
    cons.classList.remove('has');
    rt = build(src, false);
    rt.start(performance.now());
    if (!rt.error) lastGood = src;
    showStatus();
  };
  let timer = 0;
  const apply = () => {
    timer = 0;
    const src = ed.value;
    // a syntax error keeps the last working version running
    const probe = build(src, true);
    if (probe.error && probe.error.kind === 'syntax' && rt && !rt.error) {
      ed.setErrors([probe.error]);
      status.className = 'ss-status bad';
      status.textContent = '';
      const b = el('button', { class: 'ss-errlink' }, status);
      b.textContent = `Line ${probe.error.line}: ${probe.error.message}`;
      b.onclick = () => ed.gotoLine(probe.error.line);
      el('span', { class: 'ss-dim' }, status).textContent = '  (the preview shows the last version that worked)';
      paintWarn();
    } else restart(src);
    if (o.onCode) o.onCode(src, false);
  };
  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(apply, 280);
  };
  restart(ed.value);

  // preview input
  const pos = (e) => {
    const r = canvas.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H];
  };
  canvas.addEventListener('pointerdown', (e) => {
    if (!rt) return;
    e.preventDefault();
    try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* fine */ }
    rt.pointer('down', ...pos(e));
    keysTo(rt);
  });
  canvas.addEventListener('pointermove', (e) => rt && rt.pointer('move', ...pos(e)));
  canvas.addEventListener('pointerup', (e) => rt && rt.pointer('up', ...pos(e)));
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (rt) rt.pointer('wheel', ...pos(e), { dy: e.deltaY });
  }, { passive: false });

  let raf = 0, lastT = 0, errShown = null;
  const loopFn = (now) => {
    raf = requestAnimationFrame(loopFn);
    if (now - lastT < 30) return;
    lastT = now;
    if (rt && !rt.error) rt.frame(now);
    if (rt && rt.error !== errShown) {
      errShown = rt.error;
      showStatus();
    }
    if (simDirty) {
      simDirty = false;
      paintSim();
    }
    paintOuts();
  };
  raf = requestAnimationFrame(loopFn);

  // ---- buttons and keys
  bFind.onclick = () => ed.openFind();
  bRestart.onclick = () => restart(ed.value);
  bGen.onclick = () => o.openGen && o.openGen(o.id, (code) => {
    ed.replaceAll(code);
    apply();
  });
  const onKey = (e) => {
    if (e.key === 'Escape' && !ed.find.open && !document.querySelector('.ss-gen-overlay')) {
      e.preventDefault();
      close();
    }
  };
  ov.addEventListener('keydown', onKey);
  function close() {
    if (!current) return;
    cancelAnimationFrame(raf);
    clearTimeout(timer);
    ed.destroy();
    ov.remove();
    current = null;
    if (o.onCode) o.onCode(ed.value, true);
  }
  bDone.onclick = close;
  current = {
    close,
    editor: ed,
    peek: () => ({ code: ed.value, error: rt && rt.error, frames: rt ? rt.frameN : 0, sim: Object.fromEntries(sim.vals), bypass: sim.bypass, logs: logLines.slice(), warnings: ed.warnings.map((w) => ({ line: w.line, message: w.message })) }),
    setSim: (p, v) => { io.set(p, v); simDirty = true; },
    pointer: (type, x, y) => rt && rt.pointer(type, x, y),
  };
  setTimeout(() => ed.focus(), 30);
  return current;
}
export function screenEditor() {
  return current;
}
