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
import { parse } from './lang.js';
import { moduleInfo } from './hints.js';
import { FILE_BUDGET, checkPath, isCode, fromStored, toStored, mainBytes, fmtBytes, bytesText, textBytes } from './files.js';
import { audioJacks } from './audio.js';

const strictText = (u8) => {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(u8);
  } catch (_) {
    return null;
  }
};
const NEW_CODE = (name) => `-- ${name}: functions for the screens of this pedal\nlocal M = {}\n\nfunction M.hello(name)\n  return "hello " .. name\nend\n\nreturn M\n`;

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
  const edRow = el('div', { class: 'ss-edrow' }, left);
  const fpane = el('div', { class: 'ss-files', 'data-ss': 'files' }, edRow);
  const codes = el('div', { class: 'ss-codes' }, edRow);
  // what the type hints know about this pedal: its controls, this screen's ports, the signals and the other files
  let hintCtx = null, uiReady = false;
  const MAIN = ''; // this screen's own code
  let curPath = MAIN;
  const modCache = new Map(); // path -> { text, info }
  const DF = () => {
    const d = o.getD();
    if (!d.files) d.files = {};
    return d.files;
  };
  const codeList = () => Object.keys(DF()).filter((p) => isCode(p) && typeof DF()[p] === 'string').sort();
  const hintsFor = (path) => () => {
    if (!hintCtx) return null;
    const modules = codeList().map((p) => {
      const text = DF()[p];
      let c = modCache.get(p);
      if (!c || c.text !== text) modCache.set(p, (c = { text, info: moduleInfo(text) }));
      return { name: p.replace(/\.lua$/i, ''), path: p, info: c.info };
    });
    return { ...hintCtx, file: path, files: allPaths(), modules };
  };
  const eds = new Map(); // path -> { ed, plain, ro }
  const ed = new CodeEditor(codes, { value: c0.script || '', onChange: () => schedule(), hints: hintsFor(MAIN), onWarnings: () => uiReady && paintWarn() });
  eds.set(MAIN, { ed, plain: false });
  const hexView = el('pre', { class: 'ss-hex', 'data-ss': 'hex', hidden: true }, codes);
  const cur = () => (eds.get(curPath) || eds.get(MAIN)).ed;
  const status = el('div', { class: 'ss-status' }, left);
  // the light checks: a link to the first one (they never stop the script)
  function paintWarn() {
    const old = status.querySelector('.ss-warnlink');
    if (old) old.remove();
    const e = cur();
    const ws = e.warnings || [];
    if (!ws.length) return;
    const b = el('button', { class: 'ss-errlink ss-warnlink', 'data-ss': 'warnings', title: ws[0].message }, status);
    b.textContent = ws.length === 1 ? `1 hint on line ${ws[0].line}` : `${ws.length} hints, the first on line ${ws[0].line}`;
    b.onclick = () => e.gotoLine(ws[0].line);
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
  hintCtx = { controls: list.map((e) => ({ name: e.name, kind: e.kind })), findControl: (n, kind) => !!findControl(list, n, kind), ports: host.screenPorts(), signals: sigNames, jacks: audioJacks(D).map((j) => j.name) };
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

  // the sounds the script makes (in the preview they are not played, the analysis hears them)
  el('h5', {}, tp).textContent = 'Audio';
  const audRow = el('div', { class: 'ss-simaudio', 'data-ss': 'audio' }, tp);
  el('p', { class: 'fz-note' }, tp).textContent = 'Jacks: ' + audioJacks(D).map((j) => j.name).join(', ') + '. The input carries the demo guitar here. Sounds from audio.gen are not played out loud in the preview.';
  let audKey = '';
  const paintAudio = () => {
    const gens = sim.audio ? [...sim.audio.gens.entries()] : [];
    const txt = gens.length ? gens.map(([k, g]) => `${k.slice(k.indexOf(':') + 1)}: ${g.p.type}${g.p.type === 'sample' ? '' : ' ' + Math.round(g.p.freq || 0) + ' Hz'}, amp ${(g.p.amp ?? 0.5).toFixed(2)}${g.relT !== null ? ', released' : ''}`).join('\n') : 'No sounds running.';
    if (txt !== audKey) {
      audKey = txt;
      audRow.textContent = txt;
    }
  };

  // ---- the file list: this screen's code, the pedal's code files and data files
  const sandbox = io.files; // what the preview writes (memory only)
  let filesTouched = false;
  const touched = () => {
    filesTouched = true;
    if (o.onFiles) o.onFiles(false);
  };
  const previewOnly = (p) => sandbox && Object.prototype.hasOwnProperty.call(sandbox.over, p);
  function allPaths() {
    const set = new Set(Object.keys(DF()).filter((p) => !p.endsWith('/') && DF()[p] !== null));
    if (sandbox) for (const p of sandbox.paths()) set.add(p);
    return [...set].sort();
  }
  const bytesOf = (p) => (previewOnly(p) ? sandbox.read(p) : DF()[p] !== undefined ? fromStored(DF()[p]) : null);
  const fhead = el('div', { class: 'ss-fhead' }, fpane);
  el('b', {}, fhead).textContent = 'Files';
  const fbtns = el('div', { class: 'ss-fbtns' }, fpane);
  const mkBtn = (label, ss, title, fn) => {
    const b = el('button', { class: 'btn small', 'data-ss': ss, title }, fbtns);
    b.textContent = label;
    b.onclick = fn;
    return b;
  };
  const bNew = mkBtn('New', 'file-new', 'A new file: a name ending in .lua is a code file, others are data', () => askName('New file', 'util.lua', (p) => createFile(p)));
  const bRen = mkBtn('Rename', 'file-rename', 'Rename the selected file', () => curPath && askName('Rename', curPath, (p) => renameFile(curPath, p)));
  const bDup = mkBtn('Copy', 'file-dup', 'Make a copy of the selected file', () => askName('Copy as', copyName(curPath), (p) => dupFile(curPath, p)));
  const bDel = mkBtn('Delete', 'file-del', 'Delete the selected file', () => curPath && askDelete(curPath));
  const fask = el('div', { class: 'ss-fask', hidden: true }, fpane);
  const flist = el('div', { class: 'ss-flist' }, fpane);
  const fprev = el('div', { class: 'ss-fprev', hidden: true }, fpane);
  const usage = el('div', { class: 'ss-usage', 'data-ss': 'usage' }, fpane);
  const ubar = el('div', { class: 'ss-usebar' }, usage);
  const uCode = el('i', { class: 'code' }, ubar);
  const uData = el('i', { class: 'data' }, ubar);
  const utext = el('div', { class: 'ss-usetext' }, usage);
  const copyName = (p) => {
    const base = p ? p.replace(/(\.[^./]+)?$/, '') : 'screen';
    const ext = p ? (/\.[^./]+$/.exec(p) || [''])[0] : '.lua';
    let n = `${base} copy${ext}`, k = 2;
    while (allPaths().includes(n)) n = `${base} copy ${k++}${ext}`;
    return n;
  };
  function fileError(msg) {
    fask.hidden = false;
    fask.textContent = '';
    el('span', { class: 'ss-ferr' }, fask).textContent = msg;
    setTimeout(() => {
      if (fask.querySelector('.ss-ferr')) fask.hidden = true;
    }, 4000);
  }
  function usedBytes() {
    let code = mainBytes(o.getD()), data = 0;
    for (const p of allPaths()) {
      const u8 = sandbox ? sandbox.read(p) : bytesOf(p);
      if (!u8) continue;
      if (isCode(p)) code += u8.length;
      else data += u8.length;
    }
    return { code, data, all: code + data };
  }
  // an inline name box (Enter takes it, Esc cancels)
  function askName(title, value, done) {
    fask.hidden = false;
    fask.textContent = '';
    el('span', {}, fask).textContent = title;
    const inp = el('input', { type: 'text', value, 'data-ss': 'file-name', spellcheck: 'false' }, fask);
    const ok = el('button', { class: 'btn small btn-accent', 'data-ss': 'file-ok' }, fask);
    ok.textContent = 'OK';
    const go = () => {
      let v = inp.value.trim();
      if (!v) return;
      if (!/\.[^./]+$/.test(v)) v += '.lua';
      try {
        v = checkPath(v, 'Name');
      } catch (e) {
        el('span', { class: 'ss-ferr' }, fask).textContent = e.message.replace(/^Name: /, '');
        return;
      }
      fask.hidden = true;
      done(v);
    };
    ok.onclick = go;
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') go();
      if (e.key === 'Escape') {
        e.stopPropagation();
        fask.hidden = true;
      }
    });
    inp.focus();
    const dot = value.lastIndexOf('.');
    inp.setSelectionRange(0, dot > 0 ? dot : value.length);
  }
  function askDelete(p) {
    fask.hidden = false;
    fask.textContent = '';
    el('span', {}, fask).textContent = `Delete ${p}?`;
    const b = el('button', { class: 'btn small btn-danger', 'data-ss': 'file-del-ok' }, fask);
    b.textContent = 'Delete';
    const c = el('button', { class: 'btn small' }, fask);
    c.textContent = 'Cancel';
    c.onclick = () => (fask.hidden = true);
    b.onclick = () => {
      fask.hidden = true;
      deleteFile(p);
    };
  }
  const fits = (extra) => usedBytes().all + extra <= FILE_BUDGET;
  function createFile(p, text) {
    if (allPaths().includes(p)) return fileError(`${p} is already there.`);
    const body = text ?? (isCode(p) ? NEW_CODE(p) : '');
    if (!fits(textBytes(body).length)) return fileError('Not enough room: the pedal\'s files can use 1 MB together.');
    DF()[p] = body;
    touched();
    paintFiles();
    openFile(p);
    if (isCode(p)) schedule();
  }
  function dupFile(from, p) {
    const u8 = from === MAIN ? textBytes(ed.value) : bytesOf(from);
    if (!u8) return;
    if (allPaths().includes(p)) return fileError(`${p} is already there.`);
    if (!fits(u8.length)) return fileError('Not enough room: the pedal\'s files can use 1 MB together.');
    DF()[p] = toStored(u8);
    touched();
    paintFiles();
    openFile(p);
  }
  function renameFile(from, p) {
    if (from === p) return;
    if (allPaths().includes(p)) return fileError(`${p} is already there.`);
    if (previewOnly(from)) return fileError('Keep the file in the design first.');
    const F = DF();
    F[p] = F[from];
    delete F[from];
    const e = eds.get(from);
    if (e) {
      eds.delete(from);
      e.ed.root.remove();
    }
    curPath = MAIN;
    touched();
    openFile(p);
    if (isCode(p) || isCode(from)) schedule();
  }
  function deleteFile(p) {
    const F = DF();
    if (Object.prototype.hasOwnProperty.call(F, p)) delete F[p];
    if (previewOnly(p)) {
      delete sandbox.over[p];
      sandbox.cache.delete(p);
    }
    const e = eds.get(p);
    if (e) {
      eds.delete(p);
      e.ed.root.remove();
    }
    touched();
    openFile(MAIN);
    if (isCode(p)) schedule();
  }
  // a file the preview wrote: copy it into the design
  function keepFile(p) {
    const u8 = sandbox.read(p);
    delete sandbox.over[p];
    sandbox.cache.delete(p);
    if (u8) DF()[p] = toStored(u8);
    const e = eds.get(p);
    if (e) {
      eds.delete(p);
      e.ed.root.remove();
    }
    touched();
    if (curPath === p) openFile(p);
    else paintFiles();
  }
  let listKey = '';
  function paintFiles(force) {
    const paths = allPaths();
    const errFile = rt && rt.error ? rt.error.file || MAIN : null;
    const key = [curPath, errFile === null ? '-' : 'e' + errFile, sandbox ? sandbox.serial : 0, ...paths.map((p) => p + (bytesOf(p) || []).length + (previewOnly(p) ? 'p' : ''))].join('|');
    if (key === listKey && !force) return;
    listKey = key;
    flist.textContent = '';
    const row = (p, label, size, cls, title) => {
      const r = el('div', { class: 'ss-frow ' + cls + (p === curPath ? ' on' : '') + (errFile === p ? ' err' : ''), 'data-file': p || 'main', title: title || p }, flist);
      const depth = p ? p.split('/').length - 1 : 0;
      r.style.paddingLeft = 8 + depth * 10 + 'px';
      el('span', { class: 'ss-fname' }, r).textContent = label;
      el('span', { class: 'ss-fsize' }, r).textContent = size;
      r.onclick = () => openFile(p);
      return r;
    };
    row(MAIN, 'main', fmtBytes(textBytes(ed.value).length), 'main', `This screen's own code (${c0.label || 'Screen'})`);
    const shown = new Set();
    for (const p of paths) {
      // folder names above their files
      const segs = p.split('/');
      for (let i = 1; i < segs.length; i++) {
        const dir = segs.slice(0, i).join('/');
        if (shown.has(dir)) continue;
        shown.add(dir);
        const r = el('div', { class: 'ss-frow dir', 'data-dir': dir }, flist);
        r.style.paddingLeft = 8 + (i - 1) * 10 + 'px';
        el('span', { class: 'ss-fname' }, r).textContent = segs[i - 1] + '/';
      }
      const u8 = bytesOf(p);
      const r = row(p, p.split('/').pop(), fmtBytes(u8 ? u8.length : 0), isCode(p) ? 'code' : 'data');
      if (p.includes('/')) r.title = p;
      if (previewOnly(p)) {
        r.classList.add('prev');
        const k = el('button', { class: 'ss-fkeep', 'data-keep': p, title: 'The preview wrote this file. Keep it in the design' }, r);
        k.textContent = 'Keep';
        k.onclick = (e) => {
          e.stopPropagation();
          keepFile(p);
        };
      }
    }
    // folders shown by their files' indent; the preview sandbox can be reset
    const nPrev = sandbox ? Object.keys(sandbox.over).length : 0;
    fprev.hidden = !nPrev;
    fprev.textContent = '';
    if (nPrev) {
      el('span', {}, fprev).textContent = `The preview changed ${nPrev} file${nPrev === 1 ? '' : 's'}.`;
      const b = el('button', { class: 'btn small', 'data-ss': 'file-reset' }, fprev);
      b.textContent = 'Reset';
      b.title = 'Forget what the preview wrote and run it again';
      b.onclick = () => {
        sandbox.setOverlay({});
        for (const [p, e] of eds) if (p && !Object.prototype.hasOwnProperty.call(DF(), p)) {
          eds.delete(p);
          e.ed.root.remove();
        }
        openFile(curPath && allPaths().includes(curPath) ? curPath : MAIN);
        restart(ed.value);
  paintFiles(true);
      };
    }
    bRen.disabled = bDel.disabled = !curPath;
    const u = usedBytes();
    uCode.style.width = Math.min(100, (u.code / FILE_BUDGET) * 100) + '%';
    uData.style.width = Math.min(100, (u.data / FILE_BUDGET) * 100) + '%';
    usage.classList.toggle('over', u.all > FILE_BUDGET);
    utext.textContent = `${fmtBytes(u.all)} of 1 MB` + (u.all > FILE_BUDGET ? ': too much, remove some files' : `, ${fmtBytes(FILE_BUDGET - u.all)} free`);
    usage.title = `Code ${fmtBytes(u.code)} (all screens and code files), data ${fmtBytes(u.data)}`;
    bNew.disabled = u.all >= FILE_BUDGET;
  }
  function openFile(p) {
    if (p !== MAIN && !allPaths().includes(p)) p = MAIN;
    for (const [k, e] of eds) e.ed.root.hidden = k !== p;
    hexView.hidden = true;
    curPath = p;
    let e = eds.get(p);
    if (!e && p !== MAIN) {
      const u8 = bytesOf(p) || new Uint8Array(0);
      const text = strictText(u8);
      if (text === null) {
        // bytes that are not text: a read only hex view
        hexView.hidden = false;
        const lines = [];
        for (let i = 0; i < Math.min(u8.length, 4096); i += 16) {
          const row = Array.from(u8.subarray(i, i + 16));
          lines.push(i.toString(16).padStart(6, '0') + '  ' + row.map((b) => b.toString(16).padStart(2, '0')).join(' ').padEnd(48) + '  ' + row.map((b) => (b >= 32 && b < 127 ? String.fromCharCode(b) : '.')).join(''));
        }
        hexView.textContent = `${p}: ${fmtBytes(u8.length)} of bytes (made by a script with fs.writeBytes). Read only here.\n\n` + lines.join('\n') + (u8.length > 4096 ? '\n...' : '');
        paintFiles();
        showStatus();
        return;
      }
      const ro = previewOnly(p);
      const fe = new CodeEditor(codes, {
        value: text,
        plain: !isCode(p),
        hints: hintsFor(p),
        onWarnings: () => uiReady && curPath === p && paintWarn(),
        onChange: (v) => {
          if (ro) return;
          DF()[p] = v;
          touched();
          paintFiles();
          if (isCode(p)) schedule();
        },
      });
      if (ro) fe.ta.readOnly = true;
      e = { ed: fe, plain: !isCode(p), ro };
      eds.set(p, e);
      fe.root.dataset.file = p;
    }
    if (e) {
      e.ed.root.hidden = false;
      e.ed.render();
      e.ed.runLint();
    }
    paintFiles();
    showStatus();
  }

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
          if (g.group === 'Running') cur().insert(`function ${s.replace(/^function\s+/, '').replace(/\s*\.\.\.\s*end$/, '')}\n  \nend\n`);
          else cur().insert(s.split(' or ')[0] + '\n');
          cur().focus();
        };
      }
      if (g.guide && (!k || guideText(g.guide).includes(k))) paintGuide(g.guide, rlist, g.group);
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
  function paintGuide(blocks, into, name) {
    const box = el('div', { class: 'ss-refguide', 'data-guide': name }, into);
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
          cur().insert(v);
          cur().focus();
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
      openFile(MAIN);
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
      cur().insert(code);
      cur().focus();
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
  const where = (e) => (e.file ? `${e.file} line ${e.line}: ` : e.line ? `Line ${e.line}: ` : '');
  const goErr = (e) => {
    if (!e || !e.line) return;
    const p = e.file || MAIN;
    if (p !== curPath && (p === MAIN || allPaths().includes(p))) openFile(p);
    cur().gotoLine(e.line);
  };
  const markErrors = (list) => {
    for (const [p, x] of eds) x.ed.setErrors(list.filter((e) => (e.file || MAIN) === p));
  };
  let modErr = null; // a syntax error in a code file being typed (the preview keeps running)
  const showStatus = () => {
    if (!rt) return;
    const err = (rt && rt.error) || null;
    status.className = 'ss-status ' + (err || modErr ? 'bad' : 'ok');
    status.textContent = '';
    if (err) {
      const b = el('button', { class: 'ss-errlink', 'data-ss': 'error' }, status);
      b.textContent = where(err) + err.message;
      b.onclick = () => goErr(err);
      if (lastGood && lastGood !== ed.value && err.kind === 'syntax') el('span', { class: 'ss-dim' }, status).textContent = '  (the preview shows the last version that worked)';
    } else if (modErr) {
      const b = el('button', { class: 'ss-errlink', 'data-ss': 'error' }, status);
      b.textContent = where(modErr) + modErr.message;
      b.onclick = () => goErr(modErr);
      el('span', { class: 'ss-dim' }, status).textContent = '  (the preview shows the last version that worked)';
    } else {
      status.textContent = 'Running';
      // an on() handler failed: the screen keeps running, the handler's line is marked
      const he = rt && rt.handlerError;
      if (he) {
        const b = el('button', { class: 'ss-errlink ss-handlererr', 'data-ss': 'handler-error' }, status);
        b.textContent = (he.line ? (he.file ? `${he.file} line ${he.line}: ` : `Line ${he.line}: `) : '') + he.message;
        b.onclick = () => goErr(he);
      }
    }
    markErrors(err ? [err] : modErr ? [modErr] : rt && rt.handlerError && rt.handlerError.line ? [rt.handlerError] : []);
    paintWarn();
    paintFiles();
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
    // a code file with a syntax error keeps the last working version running too
    modErr = null;
    for (const p of codeList()) {
      try {
        parse(DF()[p]);
      } catch (e) {
        modErr = { message: e.message, line: e.line || 0, kind: 'syntax', file: p };
        break;
      }
    }
    if (modErr && rt && !rt.error) {
      showStatus();
      if (o.onCode) o.onCode(src, false);
      return;
    }
    // a syntax error keeps the last working version running
    const probe = build(src, true);
    if (probe.error && probe.error.kind === 'syntax' && rt && !rt.error) {
      markErrors([probe.error]);
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

  let raf = 0, lastT = 0, errShown = null, hErrShown = null, lastSerial = -1;
  const loopFn = (now) => {
    raf = requestAnimationFrame(loopFn);
    if (now - lastT < 30) return;
    lastT = now;
    if (rt && !rt.error) rt.frame(now);
    if (rt && (rt.error !== errShown || rt.handlerError !== hErrShown)) {
      errShown = rt.error;
      hErrShown = rt.handlerError;
      showStatus();
    }
    if (simDirty) {
      simDirty = false;
      paintSim();
    }
    paintOuts();
    paintAudio();
    if (sandbox && sandbox.serial !== lastSerial) {
      lastSerial = sandbox.serial;
      paintFiles();
    }
  };
  raf = requestAnimationFrame(loopFn);

  // ---- buttons and keys
  bFind.onclick = () => cur().openFind();
  bRestart.onclick = () => restart(ed.value);
  bGen.onclick = () => o.openGen && o.openGen(o.id, (code) => {
    openFile(MAIN);
    ed.replaceAll(code);
    apply();
  });
  const onKey = (e) => {
    if (e.key === 'Escape' && !cur().find.open && !document.querySelector('.ss-gen-overlay')) {
      e.preventDefault();
      close();
    }
  };
  ov.addEventListener('keydown', onKey);
  function close() {
    if (!current) return;
    cancelAnimationFrame(raf);
    clearTimeout(timer);
    for (const x of eds.values()) x.ed.destroy();
    if (rt) rt.stop();
    ov.remove();
    current = null;
    if (o.onCode) o.onCode(ed.value, true);
    if (o.onFiles) o.onFiles(true, filesTouched);
  }
  bDone.onclick = close;
  current = {
    close,
    editor: ed,
    peek: () => ({ code: ed.value, error: rt && rt.error, frames: rt ? rt.frameN : 0, sim: Object.fromEntries(sim.vals), bypass: sim.bypass, logs: logLines.slice(), warnings: cur().warnings.map((w) => ({ line: w.line, message: w.message })), file: curPath, files: allPaths(), preview: sandbox ? Object.keys(sandbox.over) : [], used: usedBytes(), gens: sim.audio ? [...sim.audio.gens.keys()] : [] }),
    openFile,
    fileEditor: (p) => (eds.get(p ?? curPath) || {}).ed || null,
    runtime: () => rt,
    setSim: (p, v) => { io.set(p, v); simDirty = true; },
    pointer: (type, x, y) => rt && rt.pointer(type, x, y),
  };
  setTimeout(() => ed.focus(), 30);
  return current;
}
export function screenEditor() {
  return current;
}
