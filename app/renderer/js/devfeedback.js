// Dev feedback picker (TEMPORARY, development only).
//
// Ctrl+Shift+K: click an element (or drag an area), type a note, OK. A compact string goes to the clipboard for
// pasting into the developer chat; decode it with `node scripts/feedback-decode.js <string or file>`.
//
// To turn it off: set DEV_FEEDBACK to false below. To remove it completely: delete this file,
// css/devfeedback.css, main/devfeedback.js, scripts/feedback-decode.js, scripts/devfeedback-test.js, and the hooks:
// the `import './devfeedback.js'` line at the top of app.js, the require line in main.js and the `devfeedback`
// line in preload.js.
//
// Format: "TZFB1:" + base64url(zlib deflate(JSON)). JSON keys (short on purpose):
//   v format version, n note, app version, t ISO time, win [w,h] css px, dpr, doc 'main' or pop-out title,
//   tab active tab, pre {nm, f file, dirty}, view {x,y,z} board pan/zoom, sel [{id,ty,nm}] selected blocks,
//   insp inspector heading, modal open modal title, m 'el' or 'area'.
//   m 'el':   el = element info (below, with p path and cs styles), th = thumbnail image (picked box drawn in).
//   m 'area': ar {r [x,y,w,h], img}, els [element info, r relative to the area], bl {blockId: block info},
//             cut = how many elements were dropped by the cap.
//   element info: tg tag ('svg:g' for svg), id, cl classes, ro role, al aria-label, ti title, ty type, nm name,
//     ph placeholder, hr href, tx visible text, v value, ck checked, dis disabled, ic icon class, lbl label of a
//     form field, d data-* attributes, r [x,y,w,h], p css-like path, cs computed styles,
//     blk {id,ty,nm,br,byp} (b = id only in area mode), ctl {cid,t,lb,p,val}, jack {key,lb,dir,to},
//     cable {id,from,to}, ins {sec,row} inspector section / row, mod modal title, menu, pan panel, win window.
//   images: {f 'webp'|'jpg', w, h, d base64}.

export const DEV_FEEDBACK = true;

const MAX_ELS = 150;
const AREA_MAX = 900; // longest side of the area screenshot
const THUMB_MAX = 360;
const CSS_HREF = new URL('../css/devfeedback.css', import.meta.url).href;

let mode = null; // null | 'pick' | 'note' | 'busy'
let cur = null; // { doc, win, ui, ... } for the active session
let getDef = null, portsFor = null;
const panels = []; // dockable panels that can pop out into their own window

const tzs = () => window.__tz || {};
const S = () => tzs().state || {};
const trim = (s, n = 120) => {
  s = String(s ?? '').replace(/\s+/g, ' ').trim();
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
};
const rnd = (v) => Math.round(v);
const isMine = (e) => !!(e && e.closest && e.closest('.dfb-ui'));
const isSvg = (e) => e instanceof e.ownerDocument.defaultView.SVGElement;

// ------------------------------------------------------------ keys
function onKey(e) {
  const k = e.code === 'KeyK' || (e.key || '').toLowerCase() === 'k';
  if (k && (e.ctrlKey || e.metaKey) && e.shiftKey && !e.altKey) {
    e.preventDefault();
    e.stopImmediatePropagation();
    if (mode) cancel();
    else start(focusedDoc());
    return;
  }
  if (mode !== 'pick') return;
  e.preventDefault();
  e.stopImmediatePropagation();
  if (e.key === 'Escape') cancel();
  else if (e.key === 'ArrowUp') climb(1);
  else if (e.key === 'ArrowDown') climb(-1);
}

function focusedDoc() {
  for (const p of panels) {
    const d = p.ownerDocument;
    if (d !== document && d.defaultView && d.hasFocus()) return d;
  }
  return document;
}

function init() {
  if (!DEV_FEEDBACK) return;
  window.addEventListener('keydown', onKey, true);
  for (const id of ['inspector', 'browser']) {
    const e = document.getElementById(id);
    if (e) panels.push(e);
  }
}

// ------------------------------------------------------------ pick mode
function ensureCss(doc) {
  if (doc.getElementById('dfb-css')) return;
  const l = doc.createElement('link');
  l.id = 'dfb-css';
  l.rel = 'stylesheet';
  l.href = CSS_HREF;
  doc.head.appendChild(l);
}

function mk(doc, cls, parent, html) {
  const e = doc.createElement('div');
  e.className = cls;
  if (html) e.innerHTML = html;
  parent.appendChild(e);
  return e;
}

const PTR = ['pointerdown', 'pointermove', 'pointerup', 'mousedown', 'mouseup', 'click', 'dblclick', 'auxclick', 'contextmenu', 'wheel'];

function start(doc) {
  if (!getDef) import('./catalog/index.js').then((m) => ((getDef = m.getDef), (portsFor = m.portsFor))).catch(() => {});
  ensureCss(doc);
  const win = doc.defaultView;
  const ui = mk(doc, 'dfb-ui', doc.body);
  const ov = mk(doc, 'dfb-overlay', ui);
  const box = mk(doc, 'dfb-box', ui);
  const label = mk(doc, 'dfb-label', ui);
  mk(doc, 'dfb-hint', ui, 'Click an element, or drag to select an area. Esc to cancel.<em>Up / Down or wheel: parent / child</em>');
  cur = { doc, win, ui, ov, box, label, chain: [], level: 0, down: null, area: null };
  mode = 'pick';
  cur.onPtr = (e) => onPtr(e);
  for (const t of PTR) win.addEventListener(t, cur.onPtr, { capture: true, passive: false });
  if (win !== window) win.addEventListener('keydown', onKey, true);
}

function stopPick() {
  if (!cur) return;
  for (const t of PTR) cur.win.removeEventListener(t, cur.onPtr, { capture: true });
}

function cleanup() {
  if (!cur) return;
  stopPick();
  if (cur.win !== window) cur.win.removeEventListener('keydown', onKey, true);
  cur.ui.remove();
  cur = null;
  mode = null;
}
function cancel() {
  cleanup();
}

// the element worth describing under a point
function meaningful(e) {
  if (!e) return null;
  if (isSvg(e) && e.tagName.toLowerCase() !== 'svg') {
    const m = e.closest('[data-ctl],[data-jack],[data-cable],[data-node]');
    if (m) return m;
    const s = e.closest('svg');
    // a small icon svg stands for itself; on a big canvas keep the shape
    if (s && s.getBoundingClientRect().width < 64) return (s.parentElement && s.parentElement.closest('button,a,label,summary,[role],[data-tab]')) || s;
    return e;
  }
  const m = e.closest('button,a,label,select,input,textarea,summary,option,[role=button],[role=tab],[role=menuitem],[data-tab],.ctx-item');
  if (m) {
    let d = 0;
    for (let x = e; x && x !== m; x = x.parentElement) d++;
    if (d <= 4) return m;
  }
  return e;
}

function onPtr(e) {
  if (mode !== 'pick') {
    // the note dialog is live: let it work, keep the app out of everything else
    if (mode === 'note' && cur.dlg && cur.dlg.contains(e.target)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    return;
  }
  e.preventDefault();
  e.stopImmediatePropagation();
  const c = cur;
  const x = e.clientX, y = e.clientY;
  if (e.type === 'wheel') return climb(e.deltaY < 0 ? 1 : -1);
  if (e.type === 'pointerdown' && e.button === 0) {
    c.down = { x, y };
    try { c.ov.setPointerCapture(e.pointerId); } catch {}
    return;
  }
  if (e.type === 'pointermove') {
    if (c.down && (Math.abs(x - c.down.x) > 5 || Math.abs(y - c.down.y) > 5)) {
      c.area = { x: Math.min(x, c.down.x), y: Math.min(y, c.down.y), w: Math.abs(x - c.down.x), h: Math.abs(y - c.down.y) };
      showBox(c.area, `area ${rnd(c.area.w)} x ${rnd(c.area.h)}`, 'area');
      return;
    }
    if (c.down) return;
    hover(x, y);
    return;
  }
  if (e.type === 'pointerup' && e.button === 0 && c.down) {
    c.down = null;
    if (c.area && c.area.w > 6 && c.area.h > 6) return openNote({ area: c.area });
    c.area = null;
    hover(x, y);
    const t = c.chain[c.level];
    if (t) openNote({ el: t });
  }
}

function hover(x, y) {
  const c = cur;
  const hit = c.doc.elementsFromPoint(x, y).find((e) => !isMine(e));
  const m = meaningful(hit);
  if (!m) return showBox(null);
  if (c.chain[0] !== m) {
    c.chain = [];
    for (let a = m; a && a !== c.doc.documentElement; a = a.parentElement) c.chain.push(a);
    c.level = 0;
  }
  drawHover();
}
function climb(dir) {
  const c = cur;
  if (!c || !c.chain.length) return;
  c.level = Math.max(0, Math.min(c.chain.length - 1, c.level + dir));
  drawHover();
}
function drawHover() {
  const t = cur.chain[cur.level];
  if (t) showBox(t.getBoundingClientRect(), labelOf(t));
}

function showBox(r, text, cls = '') {
  const { box, label, win } = cur;
  if (!r) {
    box.style.display = label.style.display = 'none';
    return;
  }
  const x = r.x ?? r.left, y = r.y ?? r.top;
  box.className = 'dfb-box ' + cls;
  Object.assign(box.style, { display: 'block', left: x - 2 + 'px', top: y - 2 + 'px' });
  box.style.width = (r.width ?? r.w) + 4 + 'px';
  box.style.height = (r.height ?? r.h) + 4 + 'px';
  label.textContent = text;
  label.style.display = 'block';
  const ly = y - 24 > 4 ? y - 24 : y + (r.height ?? r.h) + 6;
  label.style.left = Math.max(4, Math.min(x, win.innerWidth - 300)) + 'px';
  label.style.top = Math.min(ly, win.innerHeight - 24) + 'px';
}

// short label like: button.btn "Save" / svg:g.node[data-node=b12] knob DRIVE
function labelOf(e) {
  const tag = (isSvg(e) ? 'svg:' : '') + e.tagName.toLowerCase();
  const cls = [...e.classList].slice(0, 2).map((c) => '.' + c).join('');
  let s = tag + (e.id ? '#' + e.id : '') + cls;
  for (const a of ['node', 'ctl', 'jack', 'cable', 'tab']) if (e.dataset && e.dataset[a]) s += `[data-${a}=${e.dataset[a]}]`;
  const c = appCtx(e, true);
  if (c.ctl) s += ` ${c.ctl.t || 'ctl'} ${c.ctl.lb || c.ctl.p || ''}`;
  else if (c.jack) s += ` jack ${c.jack.lb || c.jack.key}`;
  else if (c.blk && e.dataset.node) s += ` ${c.blk.nm || c.blk.ty}`;
  else {
    const t = textOf(e, 40);
    if (t) s += ` "${t}"`;
  }
  return s;
}

// ------------------------------------------------------------ note dialog
function openNote(pick) {
  const c = cur;
  mode = 'note';
  c.pick = pick;
  c.ui.querySelector('.dfb-hint').remove();
  c.label.style.display = 'none';
  const r = pick.area || pick.el.getBoundingClientRect();
  showBox(r, '', pick.area ? 'area' : 'picked');
  c.label.style.display = 'none';
  const doc = c.doc;
  const dlg = (c.dlg = mk(doc, 'dfb-dialog', c.ui));
  const what = mk(doc, 'dfb-what', dlg);
  what.textContent = pick.area ? `Area ${rnd(r.width ?? r.w)} x ${rnd(r.height ?? r.h)}` : labelOf(pick.el);
  const ta = doc.createElement('textarea');
  ta.placeholder = 'What should change? e.g. Make this say xyz instead of abc';
  dlg.appendChild(ta);
  const row = mk(doc, 'dfb-row', dlg, '<span>Ctrl+Enter = OK</span>');
  const cancelB = doc.createElement('button');
  cancelB.className = 'btn';
  cancelB.textContent = 'Cancel';
  const ok = doc.createElement('button');
  ok.className = 'btn btn-accent';
  ok.textContent = 'OK';
  row.append(cancelB, ok);
  // place it below the pick, or above, or at the side
  const W = c.win.innerWidth, H = c.win.innerHeight;
  const rx = r.x ?? r.left, ry = r.y ?? r.top, rw = r.width ?? r.w, rh = r.height ?? r.h;
  const dh = 190, dw = 340;
  let top = ry + rh + 10;
  if (top + dh > H) top = ry - dh - 10;
  if (top < 8) top = Math.max(8, Math.min(H - dh - 8, ry + rh / 2 - dh / 2));
  let left = rx;
  if (top < ry + rh && top + dh > ry) left = rx + rw + 10 + dw < W ? rx + rw + 10 : rx - dw - 10;
  dlg.style.left = Math.max(8, Math.min(W - dw - 8, left)) + 'px';
  dlg.style.top = top + 'px';
  const go = () => submit(ta.value);
  ok.onclick = go;
  cancelB.onclick = cancel;
  dlg.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Escape') cancel();
    else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      go();
    }
  });
  // keep app shortcuts and drags out of the dialog
  for (const t of ['pointerdown', 'mousedown', 'click', 'keyup', 'wheel']) dlg.addEventListener(t, (e) => e.stopPropagation());
  setTimeout(() => ta.focus(), 0);
}

async function submit(note) {
  const c = cur;
  if (!c || mode !== 'note') return;
  mode = 'busy';
  const doc = c.doc;
  let msg, bad = false;
  try {
    const p = basePayload(doc, note);
    c.ui.style.visibility = 'hidden';
    await frames(c.win);
    if (c.pick.area) await areaPayload(p, c.pick.area, doc);
    else await elementPayload(p, c.pick.el, doc);
    const str = await encode(p);
    await window.tz.devfeedback({ op: 'copy', text: str });
    msg = `Copied feedback (${(str.length / 1024).toFixed(1)} KB). Paste it in the chat.`;
    window.__tzLastFeedback = str.length;
  } catch (e) {
    console.warn('devfeedback', e);
    msg = 'Feedback failed: ' + (e && e.message);
    bad = true;
  }
  cleanup();
  showToast(doc, msg, bad);
}

function frames(win) {
  return new Promise((res) => win.requestAnimationFrame(() => win.requestAnimationFrame(() => setTimeout(res, 40))));
}

function showToast(doc, text, bad) {
  ensureCss(doc);
  const t = doc.createElement('div');
  t.className = 'dfb-ui dfb-toast' + (bad ? ' err' : '');
  t.textContent = text;
  doc.body.appendChild(t);
  setTimeout(() => t.remove(), 4200);
}

// ------------------------------------------------------------ payload
function basePayload(doc, note) {
  const st = S();
  const ed = tzs().editor;
  const p = { v: 1, n: String(note || '').trim(), app: st.appVersion, t: new Date().toISOString() };
  const w = doc.defaultView;
  p.win = [w.innerWidth, w.innerHeight];
  p.dpr = +(w.devicePixelRatio || 1).toFixed(3);
  p.doc = doc === document ? 'main' : doc.title;
  const tab = document.querySelector('#tabs button.active');
  if (tab) p.tab = tab.dataset.tab;
  if (st.preset) p.pre = { nm: st.preset.name, f: st.file || null, dirty: !!st.dirty };
  if (st.settings && st.settings.theme) p.theme = st.settings.theme;
  if (ed && ed.view) p.view = { x: rnd(ed.view.x), y: rnd(ed.view.y), z: +ed.view.z.toFixed(3) };
  if (st.selection && st.selection.size) p.sel = [...st.selection].slice(0, 20).map((id) => blockInfo(id) || { id });
  const ih = (panels.find((x) => x.id === 'inspector') || {}).querySelector?.('.insp-title h3');
  if (ih && ih.textContent) p.insp = trim(ih.textContent, 80);
  const mh = document.querySelector('#modalLayer .modal h2');
  if (mh) p.modal = trim(mh.textContent, 80);
  return p;
}

function blockInfo(id) {
  const st = S();
  const b = st.preset && st.preset.blocks.find((x) => x.id === id);
  if (!b) return null;
  const d = getDef && getDef(b.type);
  const o = { id, ty: b.type };
  if (d && d.name) o.nm = d.name;
  if (d && d.brand) o.br = d.brand;
  if (b.name) o.lbl = b.name;
  if (b.bypass) o.byp = 1;
  if (b.variant) o.var = b.variant;
  return o;
}

// app-level context for an element: block, control, jack, cable, inspector, modal, panel
function appCtx(e, short) {
  const o = {};
  const st = S();
  const n = e.closest('[data-node]');
  const b = n && st.preset && st.preset.blocks.find((x) => x.id === n.dataset.node);
  const d = b && getDef ? getDef(b.type) : null;
  if (n) o.blk = blockInfo(n.dataset.node) || { id: n.dataset.node };
  const ce = e.closest('[data-ctl]');
  if (ce) {
    const cid = ce.dataset.ctl;
    const c = d && (d.controls || []).find((x) => x.cid === cid);
    o.ctl = { cid };
    if (c) {
      if (c.t) o.ctl.t = c.t;
      if (c.label) o.ctl.lb = c.label;
      if (c.p) o.ctl.p = c.p;
      if (c.p && b.params && b.params[c.p] !== undefined) o.ctl.val = b.params[c.p];
    }
    if (!o.ctl.t) o.ctl.t = [...ce.classList].find((x) => x !== 'ctl');
  }
  const je = e.closest('[data-jack]');
  if (je) {
    const key = je.dataset.jack;
    o.jack = { key, dir: key[0] === 'o' ? 'out' : 'in' };
    try {
      const ports = d && portsFor(d, b.variant || (d.stereo === 'stereo' ? 'stereo' : 'mono'));
      const list = ports && (key[0] === 'o' ? ports.outs : ports.ins);
      const lb = list && list[+key.slice(1)];
      if (lb) o.jack.lb = lb;
    } catch {}
    if (!short && st.preset) {
      const to = [];
      for (const c of st.preset.cables || []) {
        if (c.from.node === b?.id && String(c.from.port) === key) to.push(c.to.node + ':' + c.to.port);
        if (c.to.node === b?.id && String(c.to.port) === key) to.push(c.from.node + ':' + c.from.port);
      }
      if (to.length) o.jack.to = to;
    }
  }
  const ca = e.closest('[data-cable]');
  if (ca && st.preset) {
    const c = (st.preset.cables || []).find((x) => x.id === ca.dataset.cable);
    o.cable = c ? { id: c.id, from: c.from.node + ':' + c.from.port, to: c.to.node + ':' + c.to.port } : { id: ca.dataset.cable };
  }
  if (short) return o;
  if (e.closest('#inspector')) {
    const sec = e.closest('.insp-section');
    const h = sec && sec.querySelector('h5, summary');
    const row = e.closest('.prow');
    o.ins = {};
    if (h) o.ins.sec = trim(h.textContent, 60);
    if (row) o.ins.row = trim(row.querySelector('label')?.textContent, 60);
    if (!sec && e.closest('.insp-title')) o.ins.sec = 'title';
  }
  const mo = e.closest('.modal');
  if (mo) o.mod = trim(mo.querySelector('h2')?.textContent, 80);
  const mn = e.closest('.ctx');
  if (mn) o.menu = trim(mn.querySelector('.ctx-title')?.textContent || 'context menu', 60);
  const pan = e.closest('#browser, #inspector, #topbar, section.view');
  if (pan) o.pan = pan.id;
  if (e.ownerDocument !== document) o.win = e.ownerDocument.title;
  return o;
}

function ownText(e) {
  let s = '';
  for (const n of e.childNodes) if (n.nodeType === 3) s += n.textContent + ' ';
  return s;
}
function textOf(e, n = 200) {
  if (isSvg(e)) return trim(e.textContent, n);
  return trim(e.innerText ?? e.textContent, n);
}

function rectOf(e, ox = 0, oy = 0) {
  const r = e.getBoundingClientRect();
  return [rnd(r.left - ox), rnd(r.top - oy), rnd(r.width), rnd(r.height)];
}

const INTERACTIVE = 'button,a,label,select,input,textarea,summary,option,[role],[tabindex],[contenteditable=true]';

function describe(e, full, ox, oy) {
  const o = { tg: (isSvg(e) ? 'svg:' : '') + e.tagName.toLowerCase() };
  if (e.id) o.id = e.id;
  const cls = [...e.classList].slice(0, 6).join(' ');
  if (cls) o.cl = cls;
  for (const [k, a] of [['ro', 'role'], ['al', 'aria-label'], ['ti', 'title'], ['ty', 'type'], ['nm', 'name'], ['ph', 'placeholder'], ['hr', 'href']]) {
    const v = e.getAttribute(a);
    if (v) o[k] = trim(v, 80);
  }
  // text: whole text for the picked element or controls; own text for plain elements in an area
  const t = full ? textOf(e, 300) : e.matches(INTERACTIVE) || e.dataset?.node || e.dataset?.ctl || e.dataset?.jack || e.tagName.toLowerCase() === 'text' ? textOf(e, 80) : trim(ownText(e), 80);
  if (t) o.tx = t;
  const tag = e.tagName.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') {
    if (e.type === 'checkbox' || e.type === 'radio') o.ck = !!e.checked;
    else if (tag === 'select') o.v = trim(e.selectedOptions[0]?.textContent ?? e.value, 80);
    else o.v = trim(e.value, 160);
    const l = (e.labels && e.labels[0]) || e.closest('.prow, .row, .field, label');
    const lt = l && trim(l.querySelector?.('label')?.textContent || l.textContent, 60);
    if (lt) o.lbl = lt;
  }
  if (e.disabled || e.getAttribute('aria-disabled') === 'true') o.dis = 1;
  const icon = e.querySelector && e.querySelector('i.ic');
  if (icon) o.ic = [...icon.classList].find((x) => x.startsWith('ic-'));
  const ds = e.dataset ? Object.entries(e.dataset) : [];
  if (ds.length) {
    o.d = {};
    for (const [k, v] of ds.slice(0, 12)) o.d[k] = trim(v, 60);
  }
  o.r = rectOf(e, ox, oy);
  const c = appCtx(e, false);
  if (!full && c.blk) {
    c.b = c.blk.id;
    delete c.blk;
  }
  Object.assign(o, c);
  if (full) {
    o.p = pathOf(e);
    o.cs = stylesOf(e);
  }
  return o;
}

// short css-like path from a meaningful ancestor
function pathOf(e) {
  const parts = [];
  for (let x = e, i = 0; x && x.tagName && i < 6; x = x.parentElement, i++) {
    let s = x.tagName.toLowerCase();
    if (x.id) s += '#' + x.id;
    else {
      const cl = [...x.classList].slice(0, 2);
      if (cl.length) s += '.' + cl.join('.');
      for (const a of ['node', 'ctl', 'jack', 'tab']) if (x.dataset && x.dataset[a]) s += `[data-${a}=${x.dataset[a]}]`;
      const sib = x.parentElement ? [...x.parentElement.children].filter((y) => y.tagName === x.tagName) : [];
      if (sib.length > 1 && !cl.length) s += `:nth-of-type(${sib.indexOf(x) + 1})`;
    }
    parts.unshift(s);
    if (x.id && x !== e) break;
    if (x.dataset && x.dataset.node && x !== e) break;
  }
  return parts.join(' > ');
}

function stylesOf(e) {
  const w = e.ownerDocument.defaultView;
  const cs = w.getComputedStyle(e);
  const o = { fs: cs.fontSize, ff: cs.fontFamily.split(',')[0].replace(/["']/g, '').trim(), fw: cs.fontWeight, c: cs.color };
  // first painted background up the tree
  for (let x = e; x && x.nodeType === 1; x = x.parentElement) {
    const b = w.getComputedStyle(x).backgroundColor;
    if (b && b !== 'transparent' && !/rgba\(.*,\s*0\)$/.test(b)) {
      o.bg = b;
      if (x !== e) o.bgFrom = x.id ? '#' + x.id : x.tagName.toLowerCase();
      break;
    }
  }
  o.d = cs.display;
  if (cs.visibility !== 'visible') o.vis = cs.visibility;
  if (+cs.opacity < 1) o.op = +cs.opacity;
  if (cs.pointerEvents === 'none') o.pe = 'none';
  if (cs.cursor && cs.cursor !== 'auto') o.cur = cs.cursor;
  if (isSvg(e)) {
    o.fill = cs.fill;
    o.stroke = cs.stroke;
  }
  if (!isSvg(e)) {
    o.pad = cs.padding;
    if (cs.borderRadius !== '0px') o.rad = cs.borderRadius;
  }
  return o;
}

async function elementPayload(p, e, doc) {
  p.m = 'el';
  p.el = describe(e, true, 0, 0);
  // a small look around the element, with the pick outlined
  try {
    const r = e.getBoundingClientRect();
    const w = doc.defaultView;
    const pad = 70;
    const a = { x: Math.max(0, r.left - pad), y: Math.max(0, r.top - pad) };
    a.w = Math.min(w.innerWidth, r.right + pad) - a.x;
    a.h = Math.min(w.innerHeight, r.bottom + pad) - a.y;
    if (a.w > 4 && a.h > 4) p.th = await shot(doc, a, THUMB_MAX, 0.6, { x: r.left - a.x, y: r.top - a.y, w: r.width, h: r.height });
    if (p.th) p.th.r = [rnd(a.x), rnd(a.y), rnd(a.w), rnd(a.h)];
  } catch (err) {
    console.warn('devfeedback thumb', err);
  }
}

async function areaPayload(p, area, doc) {
  p.m = 'area';
  const ar = { x: rnd(area.x), y: rnd(area.y), w: rnd(area.w), h: rnd(area.h) };
  p.ar = { r: [ar.x, ar.y, ar.w, ar.h] };
  p.ar.img = await shot(doc, ar, AREA_MAX, 0.82);
  const { els, cut } = collect(doc, ar);
  p.els = els.map((e) => describe(e, false, ar.x, ar.y));
  if (cut) p.cut = cut;
  const bl = {};
  for (const e of p.els) if (e.b && !bl[e.b]) bl[e.b] = blockInfo(e.b) || {};
  if (Object.keys(bl).length) p.bl = bl;
}

// every element inside or partly inside the area, minus pure wrappers, capped by how meaningful they are
function collect(doc, ar) {
  const w = doc.defaultView;
  const clip = new Map();
  const clipOf = (a) => {
    if (clip.has(a)) return clip.get(a);
    const cs = w.getComputedStyle(a);
    const r = cs.overflow !== 'visible' || a.tagName.toLowerCase() === 'svg' ? a.getBoundingClientRect() : null;
    clip.set(a, r);
    return r;
  };
  const cand = [];
  let i = 0;
  for (const e of doc.body.querySelectorAll('*')) {
    i++;
    if (isMine(e)) continue;
    const tag = e.tagName.toLowerCase();
    if (tag === 'script' || tag === 'style' || tag === 'link' || tag === 'defs') continue;
    const svg = isSvg(e) && tag !== 'svg';
    const ds = e.dataset || {};
    if (svg && !(ds.node || ds.ctl || ds.jack || ds.cable || tag === 'text')) continue;
    // score first (cheap), then geometry
    let s = 0;
    if (ds.node) s += 100;
    if (ds.ctl || ds.jack) s += 80;
    if (ds.cable) s += 40;
    if (!svg && e.matches(INTERACTIVE)) s += 70;
    if (Object.keys(ds).length) s += 20;
    if (e.getAttribute('title') || e.getAttribute('aria-label')) s += 20;
    const own = tag === 'text' ? trim(e.textContent, 80) : trim(ownText(e), 80);
    if (own) s += tag === 'text' ? 25 : 30;
    if (e.id) s += 10;
    if (!s) continue;
    const r = e.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) continue;
    let L = Math.max(r.left, ar.x), T = Math.max(r.top, ar.y), R = Math.min(r.right, ar.x + ar.w), B = Math.min(r.bottom, ar.y + ar.h);
    if (R <= L || B <= T) continue;
    // clipped away by a scrolling or clipping parent?
    let hidden = false;
    for (let a = e.parentElement; a && a !== doc.body; a = a.parentElement) {
      const c = clipOf(a);
      if (!c) continue;
      L = Math.max(L, c.left); T = Math.max(T, c.top); R = Math.min(R, c.right); B = Math.min(B, c.bottom);
      if (R <= L || B <= T) { hidden = true; break; }
    }
    if (hidden) continue;
    if (e.checkVisibility && !e.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
    cand.push({ e, s, i, own });
  }
  // drop text pieces already covered by an included control's text
  const keep = new Set(cand.map((c) => c.e));
  const out = cand.filter((c) => {
    if (c.s > 40 || !c.own) return true;
    const a = c.e.parentElement && c.e.parentElement.closest('button,a,label,summary,[role],[data-ctl],[data-jack],[data-tab]');
    return !(a && keep.has(a) && trim(textOf(a, 200)).includes(c.own.replace(/…$/, '')));
  });
  out.sort((a, b) => b.s - a.s || a.i - b.i);
  const top = out.slice(0, MAX_ELS).sort((a, b) => a.i - b.i);
  return { els: top.map((c) => c.e), cut: Math.max(0, out.length - MAX_ELS) };
}

// screenshot of a viewport rect, scaled to max px on its long side; mark = box to outline (css px, in rect)
async function shot(doc, r, max, q, mark) {
  const res = await window.tz.devfeedback({ op: 'capture', rect: r, title: doc === document ? null : doc.title, max, jpeg: Math.round(q * 100) });
  if (!res) return null;
  const bmp = await createImageBitmap(new Blob([res.png], { type: 'image/png' }));
  const cv = new OffscreenCanvas(bmp.width, bmp.height);
  const g = cv.getContext('2d');
  g.drawImage(bmp, 0, 0);
  if (mark) {
    const k = bmp.width / r.w;
    g.strokeStyle = '#ff7a2f';
    g.lineWidth = 2;
    g.strokeRect(mark.x * k - 1, mark.y * k - 1, mark.w * k + 2, mark.h * k + 2);
  }
  let blob = null;
  try { blob = await cv.convertToBlob({ type: 'image/webp', quality: q }); } catch {}
  if (blob && blob.type === 'image/webp') return { f: 'webp', w: bmp.width, h: bmp.height, d: b64(new Uint8Array(await blob.arrayBuffer())) };
  blob = await cv.convertToBlob({ type: 'image/jpeg', quality: q });
  return { f: 'jpg', w: bmp.width, h: bmp.height, d: b64(new Uint8Array(await blob.arrayBuffer())) };
}

function b64(u8) {
  let s = '';
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  return btoa(s);
}

async function encode(p) {
  const json = new TextEncoder().encode(JSON.stringify(p));
  const stream = new Blob([json]).stream().pipeThrough(new CompressionStream('deflate'));
  const z = new Uint8Array(await new Response(stream).arrayBuffer());
  return 'TZFB1:' + b64(z).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

init();
