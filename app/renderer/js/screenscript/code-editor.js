// A small code editor: a textarea with a highlighted copy behind it, line numbers, auto indent, bracket
// matching, error markers, find, and type hints (completion, signature help, hovers, light checks; see hints.js).
// The textarea keeps the native caret, selection and undo.
import { el } from '../util.js';
import { API_NAMES, typeLabel } from './docs.js';
import { completions, signatureAt, hoverAt, lint } from './hints.js';

const KW = new Set(['and', 'break', 'do', 'else', 'elseif', 'end', 'false', 'for', 'function', 'if', 'in', 'local', 'nil', 'not', 'or', 'repeat', 'return', 'then', 'true', 'until', 'while']);
const CALLBACKS = new Set(['draw', 'update', 'setup', 'onPress', 'onMove', 'onRelease', 'onWheel', 'onControl', 'onFoot', 'onKey']);
const escH = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const IND = '  ';

/** Highlighted HTML for the whole source. */
export function highlight(src) {
  let out = '';
  let i = 0;
  const n = src.length;
  const span = (cls, s) => (out += `<span class="ss-t-${cls}">${escH(s)}</span>`);
  while (i < n) {
    const c = src[i];
    if (c === '-' && src[i + 1] === '-') {
      let j;
      const m = /^--\[(=*)\[/.exec(src.slice(i, i + 12));
      if (m) {
        const close = ']' + m[1] + ']';
        j = src.indexOf(close, i + m[0].length);
        j = j < 0 ? n : j + close.length;
      } else {
        j = src.indexOf('\n', i);
        if (j < 0) j = n;
      }
      span('com', src.slice(i, j));
      i = j;
      continue;
    }
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < n && src[j] !== c && src[j] !== '\n') j += src[j] === '\\' ? 2 : 1;
      j = Math.min(n, j + 1);
      span('str', src.slice(i, j));
      i = j;
      continue;
    }
    if (c === '[' && /^\[=*\[/.test(src.slice(i, i + 10))) {
      const m = /^\[(=*)\[/.exec(src.slice(i, i + 10));
      const close = ']' + m[1] + ']';
      let j = src.indexOf(close, i + m[0].length);
      j = j < 0 ? n : j + close.length;
      span('str', src.slice(i, j));
      i = j;
      continue;
    }
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1] || ''))) {
      const m = /^(0x[0-9a-fA-F]+|[0-9]*\.?[0-9]+(?:[eE][+-]?[0-9]+)?)/.exec(src.slice(i, i + 40));
      const s = m ? m[0] : c;
      span('num', s);
      i += s.length;
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      let j = i + 1;
      while (j < n && /[A-Za-z0-9_]/.test(src[j])) j++;
      const w = src.slice(i, j);
      const prev = src[i - 1];
      if (KW.has(w)) span('kw', w);
      else if (prev !== '.' && prev !== ':' && CALLBACKS.has(w)) span('cb', w);
      else if (prev !== '.' && prev !== ':' && API_NAMES.has(w)) span('api', w);
      else out += escH(w);
      i = j;
      continue;
    }
    if ('(){}[]'.includes(c)) span('br', c);
    else if ('+-*/%^#=<>~!.,;:'.includes(c)) span('op', c);
    else out += escH(c);
    i++;
  }
  return out + '\n';
}

export class CodeEditor {
  constructor(host, o = {}) {
    this.o = o;
    this.root = el('div', { class: 'ss-code' }, host);
    this.gutter = el('div', { class: 'ss-gutter' }, this.root);
    this.gin = el('div', { class: 'ss-gutter-in' }, this.gutter);
    this.wrap = el('div', { class: 'ss-codewrap' }, this.root);
    this.layer = el('div', { class: 'ss-layer' }, this.wrap);
    this.marks = el('div', { class: 'ss-marks' }, this.layer);
    this.hl = el('pre', { class: 'ss-hl', 'aria-hidden': 'true' }, this.layer);
    this.ta = el('textarea', { class: 'ss-ta', spellcheck: 'false', autocapitalize: 'off', autocomplete: 'off', wrap: 'off' }, this.wrap);
    this.ta.value = o.value || '';
    this.errors = [];
    this.warnings = [];
    this.find = { open: false, q: '', hits: [], i: -1 };
    this.buildFind();
    this.buildHints();
    this.ta.addEventListener('input', (e) => this.onInput(e));
    this.ta.addEventListener('keydown', (e) => this.onKey(e));
    this.ta.addEventListener('scroll', () => {
      this.syncScroll();
      this.closeAC();
      this.updateSig();
    });
    for (const ev of ['keyup', 'click', 'select', 'focus']) this.ta.addEventListener(ev, () => this.paintMarks());
    this.ta.addEventListener('click', () => {
      this.closeAC();
      this.updateSig();
    });
    this.ta.addEventListener('keyup', (e) => {
      if (['ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown'].includes(e.key) || (!this.ac.open && /^Arrow/.test(e.key))) {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'Home' || e.key === 'End') this.closeAC();
        this.updateSig();
      }
    });
    this.ta.addEventListener('blur', () => setTimeout(() => {
      if (document.activeElement !== this.ta) {
        this.closeAC();
        this.hideSig();
      }
    }, 120));
    this.ta.addEventListener('mousemove', (e) => this.onHoverMove(e));
    this.ta.addEventListener('mouseleave', () => this.hideTip());
    document.addEventListener('selectionchange', (this._sel = () => document.activeElement === this.ta && this.paintMarks()));
    this.render();
  }
  destroy() {
    document.removeEventListener('selectionchange', this._sel);
    clearTimeout(this.lintT);
    clearTimeout(this.hoverT);
  }
  get value() {
    return this.ta.value;
  }
  set value(v) {
    this.ta.value = v;
    this.render();
    this.runLint();
  }
  /** Replace everything, keeping undo (Ctrl+Z brings the old code back). */
  replaceAll(v) {
    this.ta.focus();
    this.ta.select();
    if (!document.execCommand('insertText', false, v)) this.ta.value = v;
    this.ta.setSelectionRange(0, 0);
    this.ta.scrollTop = 0;
    this.render();
    this.changed();
  }
  insert(text) {
    this.ta.focus();
    const s = this.ta.selectionStart;
    const before = this.ta.value.slice(0, s);
    const indent = /([ \t]*)[^\n]*$/.exec(before)[1];
    const lineStart = before.lastIndexOf('\n') + 1;
    const atLineStart = before.slice(lineStart).trim() === '';
    let t = text.replace(/\n(?=.)/g, '\n' + indent);
    if (!atLineStart) t = '\n' + indent + t;
    this.typed(t);
  }
  typed(t) {
    if (!document.execCommand('insertText', false, t)) {
      const s = this.ta.selectionStart, e = this.ta.selectionEnd;
      this.ta.setRangeText(t, s, e, 'end');
    }
    this.render();
    this.changed();
  }
  changed() {
    if (this.o.onChange) this.o.onChange(this.ta.value);
  }
  focus() {
    this.ta.focus();
  }
  gotoLine(n) {
    const lines = this.ta.value.split('\n');
    n = Math.max(1, Math.min(lines.length, n));
    let pos = 0;
    for (let i = 0; i < n - 1; i++) pos += lines[i].length + 1;
    this.ta.focus();
    this.ta.setSelectionRange(pos, pos + lines[n - 1].length);
    const lh = this.lineH();
    const want = (n - 1) * lh - this.ta.clientHeight / 3;
    if ((n - 1) * lh < this.ta.scrollTop || (n - 1) * lh > this.ta.scrollTop + this.ta.clientHeight - lh * 2) this.ta.scrollTop = Math.max(0, want);
    this.paintMarks();
  }
  setErrors(list) {
    this.errors = (list || []).filter((e) => e && e.line > 0);
    this.renderGutter();
    this.paintMarks();
  }
  /** The pedal the hints know about (controls, ports); see hints.js. */
  context() {
    try {
      return this.o.hints ? this.o.hints() : null;
    } catch (_) {
      return null;
    }
  }

  // ---------------------------------------------------------------- painting
  lineH() {
    if (!this._lh) this._lh = parseFloat(getComputedStyle(this.ta).lineHeight) || 18;
    return this._lh;
  }
  charW() {
    if (!this._cw) {
      const probe = el('span', { class: 'ss-probe' }, this.hl.parentNode);
      probe.textContent = 'M'.repeat(50);
      this._cw = probe.getBoundingClientRect().width / 50 || 7.8;
      probe.remove();
    }
    return this._cw;
  }
  pad() {
    if (!this._pad) {
      const cs = getComputedStyle(this.ta);
      this._pad = { l: parseFloat(cs.paddingLeft) || 0, t: parseFloat(cs.paddingTop) || 0 };
    }
    return this._pad;
  }
  render() {
    // plain: a data file (no highlighting or hints)
    this.hl.innerHTML = this.o.plain ? escH(this.ta.value) + '\n' : highlight(this.ta.value);
    this.renderGutter();
    if (this.find.open) this.runFind(false);
    this.paintMarks();
    this.syncScroll();
    this.scheduleLint();
  }
  renderGutter() {
    const n = this.ta.value.split('\n').length;
    const bad = new Set(this.errors.map((e) => e.line));
    const warn = new Set(this.warnings.map((w) => w.line));
    let h = '';
    for (let i = 1; i <= n; i++) h += `<div class="${bad.has(i) ? 'err' : warn.has(i) ? 'warn' : ''}"${warn.has(i) && !bad.has(i) ? ` title="${escH(this.warnings.find((w) => w.line === i).message).replace(/"/g, '&quot;')}"` : ''}>${i}</div>`;
    this.gin.innerHTML = h;
  }
  syncScroll() {
    const x = this.ta.scrollLeft, y = this.ta.scrollTop;
    this.layer.style.transform = `translate(${-x}px, ${-y}px)`;
    this.gin.style.transform = `translateY(${-y}px)`;
  }
  posOf(i) {
    const before = this.ta.value.slice(0, i);
    const line = before.split('\n').length - 1;
    const col = i - (before.lastIndexOf('\n') + 1);
    return { line, col };
  }
  box(i, len, cls) {
    const { line, col } = this.posOf(i);
    const p = this.pad(), lh = this.lineH(), cw = this.charW();
    const b = el('div', { class: cls }, this.marks);
    b.style.cssText = `left:${p.l + col * cw}px;top:${p.t + line * lh}px;width:${Math.max(2, len * cw)}px;height:${lh}px`;
    return b;
  }
  paintMarks() {
    this.marks.textContent = '';
    const p = this.pad(), lh = this.lineH();
    for (const e of this.errors) {
      const b = el('div', { class: 'ss-errline', title: e.message }, this.marks);
      b.style.cssText = `top:${p.t + (e.line - 1) * lh}px;height:${lh}px`;
    }
    // light checks: a dotted underline (only on the first line of a long range)
    const v = this.ta.value;
    for (const w of this.warnings) {
      if (w.s >= v.length) continue;
      const nl = v.indexOf('\n', w.s);
      const e = nl >= 0 && nl < w.e ? nl : Math.min(w.e, v.length);
      this.box(w.s, Math.max(1, e - w.s), 'ss-warn');
    }
    if (this.find.open) this.find.hits.forEach((h, k) => this.box(h, this.find.q.length, k === this.find.i ? 'ss-hit cur' : 'ss-hit'));
    const m = this.matchBracket();
    if (m) {
      this.box(m[0], 1, 'ss-bm');
      this.box(m[1], 1, 'ss-bm');
    }
  }
  matchBracket() {
    const v = this.ta.value;
    const s = this.ta.selectionStart;
    if (s !== this.ta.selectionEnd) return null;
    const pairs = { '(': ')', '[': ']', '{': '}' };
    const back = { ')': '(', ']': '[', '}': '{' };
    for (const i of [s - 1, s]) {
      const c = v[i];
      if (pairs[c]) {
        let d = 0;
        for (let j = i; j < v.length && j < i + 20000; j++) {
          if (v[j] === c) d++;
          else if (v[j] === pairs[c] && --d === 0) return [i, j];
        }
      } else if (back[c]) {
        let d = 0;
        for (let j = i; j >= 0 && j > i - 20000; j--) {
          if (v[j] === c) d++;
          else if (v[j] === back[c] && --d === 0) return [j, i];
        }
      }
    }
    return null;
  }

  // ---------------------------------------------------------------- typing help
  lineBounds(pos) {
    const v = this.ta.value;
    const a = v.lastIndexOf('\n', pos - 1) + 1;
    let b = v.indexOf('\n', pos);
    if (b < 0) b = v.length;
    return [a, b];
  }
  onKey(e) {
    const ta = this.ta;
    if (this.ac.open) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        this.moveAC(e.key === 'ArrowDown' ? 1 : -1);
        return;
      }
      if (e.key === 'PageDown' || e.key === 'PageUp') {
        e.preventDefault();
        this.moveAC(e.key === 'PageDown' ? 8 : -8);
        return;
      }
      if ((e.key === 'Enter' || e.key === 'Tab') && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        this.acceptAC();
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        this.closeAC();
        return;
      }
    }
    if ((e.ctrlKey || e.metaKey) && e.key === ' ') {
      e.preventDefault();
      if (e.shiftKey) this.updateSig(true);
      else this.openAC(true);
      return;
    }
    if (e.key === 'Escape' && (this.sig.open || this.tip.open) && !this.find.open) {
      e.preventDefault();
      e.stopPropagation();
      this.hideSig(true);
      this.hideTip();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'F')) {
      e.preventDefault();
      this.openFind();
      return;
    }
    if (e.key === 'F3' || ((e.ctrlKey || e.metaKey) && e.key === 'g')) {
      e.preventDefault();
      this.findStep(e.shiftKey ? -1 : 1);
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key === '/') {
      e.preventDefault();
      this.toggleComment();
      return;
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      const s = ta.selectionStart, en = ta.selectionEnd;
      const v = ta.value;
      if (s === en && !e.shiftKey) return this.typed(IND);
      // indent or dedent every selected line
      const [a] = this.lineBounds(s);
      const [, b] = this.lineBounds(en > s && v[en - 1] === '\n' ? en - 1 : en);
      const lines = v.slice(a, b).split('\n');
      const out = lines.map((l) => (e.shiftKey ? l.replace(/^ {1,2}/, '') : IND + l)).join('\n');
      ta.setSelectionRange(a, b);
      this.typed(out);
      ta.setSelectionRange(a, a + out.length);
      this.paintMarks();
      return;
    }
    if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      const s = ta.selectionStart;
      const [a] = this.lineBounds(s);
      const line = ta.value.slice(a, s);
      const indent = /^[ \t]*/.exec(line)[0];
      const code = line.replace(/--.*$/, '').trim();
      const opens = /\b(then|do|else|repeat)$/.test(code) || /\bfunction\b[^)]*\)\s*$/.test(code) || /[{(]$/.test(code) || /^(elseif|if)\b.*\bthen$/.test(code);
      const closes = /\bend\b/.test(code) && /\b(function|then|do)\b/.test(code); // a one line block
      this.typed('\n' + indent + (opens && !closes ? IND : ''));
      return;
    }
    if (e.key === 'Escape' && this.find.open) {
      e.preventDefault();
      e.stopPropagation();
      this.closeFind();
    }
  }
  onInput(e) {
    // typing "end", "else", "elseif", "until" or "}" on its own line moves it back one level
    if (e && e.inputType === 'insertText') {
      const ta = this.ta;
      const s = ta.selectionStart;
      const [a, b] = this.lineBounds(s);
      const line = ta.value.slice(a, b);
      const m = /^([ \t]*)(end|else|elseif|until|\})$/.exec(line);
      if (m && m[1].length >= 2 && s === b) {
        const prev = ta.value.slice(0, Math.max(0, a - 1)).split('\n').reverse().find((l) => l.trim() !== '') || '';
        const pin = /^[ \t]*/.exec(prev)[0].length;
        if (m[1].length >= pin) {
          ta.setSelectionRange(a, a + 2);
          document.execCommand('delete');
          ta.setSelectionRange(s - 2, s - 2);
        }
      }
    }
    this.render();
    this.changed();
    // type hints while typing
    if (this.accepting) this.closeAC();
    else if (e && e.inputType === 'insertText' && e.data) {
      if (/[\w."':]/.test(e.data)) this.openAC(false);
      else this.closeAC();
      if (e.data === '(' || e.data === ',') this.sigDismissed = false;
    } else if (e && /^delete/.test(e.inputType || '') && this.ac.open) this.openAC(false);
    else this.closeAC();
    this.updateSig();
  }
  toggleComment() {
    const ta = this.ta;
    const s = ta.selectionStart, en = ta.selectionEnd;
    const [a] = this.lineBounds(s);
    const [, b] = this.lineBounds(en);
    const lines = ta.value.slice(a, b).split('\n');
    const all = lines.every((l) => !l.trim() || /^\s*--/.test(l));
    const out = lines.map((l) => (!l.trim() ? l : all ? l.replace(/^(\s*)-- ?/, '$1') : l.replace(/^(\s*)/, '$1-- '))).join('\n');
    ta.setSelectionRange(a, b);
    this.typed(out);
    ta.setSelectionRange(a, a + out.length);
  }

  // ---------------------------------------------------------------- type hints
  buildHints() {
    this.ac = { open: false, el: el('div', { class: 'ss-ac', role: 'listbox' }, this.root), items: [], i: 0, from: 0, to: 0 };
    this.ac.list = el('div', { class: 'ss-ac-list' }, this.ac.el);
    this.ac.doc = el('div', { class: 'ss-ac-doc' }, this.ac.el);
    this.ac.el.addEventListener('mousedown', (e) => e.preventDefault()); // keep the focus in the code
    this.sig = { open: false, el: el('div', { class: 'ss-sig' }, this.root) };
    this.tip = { open: false, el: el('div', { class: 'ss-tip' }, this.root) };
    this.sigDismissed = false;
    this.runLint();
  }
  scheduleLint() {
    clearTimeout(this.lintT);
    this.lintT = setTimeout(() => this.runLint(), 160);
  }
  runLint() {
    const v = this.ta.value;
    let list = [];
    try {
      list = this.o.plain ? [] : lint(v, this.context());
    } catch (_) {
      list = []; // a check never gets in the way
    }
    this.warnings = list.map((w) => ({ ...w, line: v.slice(0, w.s).split('\n').length }));
    this.renderGutter();
    this.paintMarks();
    if (this.o.onWarnings) this.o.onWarnings(this.warnings);
  }
  // where a text offset is, in pixels inside this.root
  caretXY(i) {
    const { line, col } = this.posOf(i);
    const p = this.pad(), lh = this.lineH(), cw = this.charW();
    return { x: this.wrap.offsetLeft + p.l + col * cw - this.ta.scrollLeft, y: p.t + line * lh - this.ta.scrollTop, lh };
  }
  /** Screen coordinates of a text offset (tests and tools). */
  coordsAt(i) {
    const r = this.root.getBoundingClientRect();
    const c = this.caretXY(i);
    return { x: r.left + c.x + this.charW() / 2, y: r.top + c.y + c.lh / 2 };
  }
  place(box, x, y, lh, above) {
    const W = this.root.clientWidth, Hh = this.root.clientHeight;
    box.style.left = '0px';
    box.style.top = '0px';
    const bw = box.offsetWidth, bh = box.offsetHeight;
    const left = Math.max(4, Math.min(x, W - bw - 4));
    let top = above ? y - bh - 2 : y + lh + 2;
    if (above && top < 2) top = y + lh + 2;
    if (!above && top + bh > Hh - 2) top = Math.max(2, y - bh - 2);
    box.style.left = left + 'px';
    box.style.top = top + 'px';
  }
  openAC(force) {
    const ta = this.ta;
    if (this.o.plain || ta.selectionStart !== ta.selectionEnd) return this.closeAC();
    let r = null;
    try {
      r = completions(ta.value, ta.selectionStart, this.context(), force);
    } catch (_) {
      r = null;
    }
    if (!r) return this.closeAC();
    const keep = this.ac.open && this.ac.items[this.ac.i] && r.items.findIndex((x) => x.label === this.ac.items[this.ac.i].label);
    Object.assign(this.ac, { open: true, items: r.items, from: r.from, to: r.to, i: keep > 0 ? keep : 0, inString: !!r.inString });
    this.ac.list.textContent = '';
    r.items.forEach((it, k) => {
      const row = el('div', { class: 'ss-ac-item k-' + it.kind, role: 'option', 'data-label': it.label }, this.ac.list);
      el('i', { class: 'ss-ac-kind' }, row).textContent = { fn: 'f', own: 'f', var: 'v', const: 'c', kw: 'k', value: '"', event: 'e', field: '.' }[it.kind] || '';
      el('b', {}, row).textContent = it.label;
      el('span', {}, row).textContent = it.detail || '';
      row.onmouseenter = () => this.selAC(k, false);
      row.onclick = () => {
        this.ac.i = k;
        this.acceptAC();
      };
    });
    this.ac.el.classList.add('open');
    this.selAC(this.ac.i, true);
    const c = this.caretXY(r.from);
    this.place(this.ac.el, c.x - 22, c.y, c.lh, false);
    this.hideTip();
  }
  selAC(k, scroll) {
    const rows = this.ac.list.children;
    if (!rows.length) return;
    this.ac.i = Math.max(0, Math.min(rows.length - 1, k));
    for (let q = 0; q < rows.length; q++) rows[q].classList.toggle('on', q === this.ac.i);
    if (scroll) rows[this.ac.i].scrollIntoView({ block: 'nearest' });
    const it = this.ac.items[this.ac.i];
    this.ac.doc.textContent = it.doc || '';
    this.ac.doc.hidden = !it.doc;
  }
  moveAC(d) {
    const n = this.ac.items.length;
    this.selAC(Math.abs(d) > 1 ? Math.max(0, Math.min(n - 1, this.ac.i + d)) : (this.ac.i + d + n) % n, true);
  }
  closeAC() {
    if (!this.ac || !this.ac.open) return;
    this.ac.open = false;
    this.ac.el.classList.remove('open');
  }
  acceptAC() {
    const it = this.ac.items[this.ac.i];
    if (!it) return this.closeAC();
    const ta = this.ta;
    let text = it.insert;
    // a function name before an existing "(" gets no second one
    if (text.endsWith('(') && ta.value[ta.selectionStart] === '(') text = text.slice(0, -1);
    if (text.endsWith('()') && ta.value[ta.selectionStart] === '(') text = text.slice(0, -2);
    ta.setSelectionRange(this.ac.from, ta.selectionStart);
    this.closeAC();
    this.accepting = true;
    try {
      this.typed(text);
    } finally {
      this.accepting = false;
    }
    if (text.endsWith('()')) ta.setSelectionRange(ta.selectionStart - 1, ta.selectionStart - 1);
    this.sigDismissed = false;
    this.updateSig();
  }
  updateSig(force) {
    if (force) this.sigDismissed = false;
    const ta = this.ta;
    let r = null;
    if (!this.o.plain && !this.sigDismissed && ta.selectionStart === ta.selectionEnd && document.activeElement === ta) {
      try {
        r = signatureAt(ta.value, ta.selectionStart);
      } catch (_) {
        r = null;
      }
    }
    if (!r || r.spec.callback) return this.hideSig();
    const key = r.name + '|' + r.spec.overloads.indexOf(r.ov) + '|' + r.arg + '|' + r.call.open;
    const box = this.sig.el;
    if (this.sig.key !== key || !this.sig.open) {
      this.sig.key = key;
      box.textContent = '';
      const head = el('div', { class: 'ss-sig-head' }, box);
      el('span', { class: 'ss-sig-fn' }, head).textContent = r.name + '(';
      const ps = r.ov.params;
      const active = ps[r.arg] ? r.arg : ps.length && ps[ps.length - 1].rest ? ps.length - 1 : -1;
      ps.forEach((p, k) => {
        if (k) head.appendChild(document.createTextNode(', '));
        const s = el('span', { class: 'ss-sig-p' + (k === active ? ' on' : '') + (p.opt ? ' opt' : '') }, head);
        s.textContent = (p.opt && !p.rest ? '[' : '') + p.name + (p.rest ? '...' : '') + ': ' + typeLabel(p.type) + (p.opt && !p.rest ? ']' : '');
      });
      head.appendChild(document.createTextNode(')' + (r.ov.ret ? ' -> ' + r.ov.ret : '')));
      if (r.spec.overloads.length > 1) el('span', { class: 'ss-sig-more' }, head).textContent = ` (${r.spec.overloads.indexOf(r.ov) + 1} of ${r.spec.overloads.length})`;
      const p = ps[active];
      if (p && p.doc) el('div', { class: 'ss-sig-param' }, box).textContent = p.name + ': ' + p.doc;
      if (r.spec.desc) el('div', { class: 'ss-sig-desc' }, box).textContent = r.spec.desc;
      if (active < 0 && r.arg >= ps.length) el('div', { class: 'ss-sig-param bad' }, box).textContent = ps.length ? `${r.name} takes ${ps.length} argument${ps.length === 1 ? '' : 's'}.` : `${r.name} takes no arguments.`;
    }
    this.sig.open = true;
    box.classList.add('open');
    const c = this.caretXY(r.call.s);
    this.place(box, c.x, this.caretXY(ta.selectionStart).y, c.lh, true);
  }
  hideSig(dismiss) {
    if (dismiss) this.sigDismissed = true;
    if (!this.sig || !this.sig.open) return;
    this.sig.open = false;
    this.sig.el.classList.remove('open');
  }
  /** The hover text at a text offset, or null (also used by tests). */
  hoverText(i) {
    let h = null;
    try {
      h = this.o.plain ? null : hoverAt(this.ta.value, i, this.context());
    } catch (_) {
      h = null;
    }
    const w = this.warnings.find((x) => x.s <= i && i < x.e);
    if (!h && !w) return null;
    return { ...(h || { s: w.s, e: w.e, title: '', body: '' }), warn: w ? w.message : '' };
  }
  offsetAt(clientX, clientY) {
    const r = this.ta.getBoundingClientRect();
    const p = this.pad(), lh = this.lineH(), cw = this.charW();
    const line = Math.floor((clientY - r.top + this.ta.scrollTop - p.t) / lh);
    const col = Math.floor((clientX - r.left + this.ta.scrollLeft - p.l) / cw);
    const lines = this.ta.value.split('\n');
    if (line < 0 || line >= lines.length || col < 0 || col >= lines[line].length) return -1;
    let pos = 0;
    for (let k = 0; k < line; k++) pos += lines[k].length + 1;
    return pos + col;
  }
  onHoverMove(e) {
    if (e.buttons) return this.hideTip();
    clearTimeout(this.hoverT);
    const x = e.clientX, y = e.clientY;
    this.hoverT = setTimeout(() => {
      const i = this.offsetAt(x, y);
      const h = i >= 0 ? this.hoverText(i) : null;
      if (!h) return this.hideTip();
      if (this.tip.open && this.tip.at === h.s + ':' + (h.warn || '')) return;
      this.showTip(h);
    }, 260);
  }
  showTip(h) {
    const box = this.tip.el;
    box.textContent = '';
    this.tip.at = h.s + ':' + (h.warn || '');
    if (h.title) el('code', {}, box).textContent = h.title;
    if (h.body) el('div', { class: 'ss-tip-body' }, box).textContent = h.body;
    for (const p of h.params || []) el('div', { class: 'ss-tip-param' }, box).textContent = p;
    if (h.warn) el('div', { class: 'ss-tip-warn' }, box).textContent = h.warn;
    this.tip.open = true;
    box.classList.add('open');
    const c = this.caretXY(h.s);
    this.place(box, c.x, c.y, c.lh, false);
  }
  hideTip() {
    clearTimeout(this.hoverT);
    if (!this.tip || !this.tip.open) return;
    this.tip.open = false;
    this.tip.el.classList.remove('open');
  }

  // ---------------------------------------------------------------- find
  buildFind() {
    const f = el('div', { class: 'ss-find' }, this.root);
    this.findEl = f;
    this.fq = el('input', { type: 'text', placeholder: 'Find', spellcheck: 'false' }, f);
    this.fcount = el('span', { class: 'ss-fcount' }, f);
    el('button', { class: 'btn small', title: 'Previous (Shift+Enter)', onclick: () => this.findStep(-1) }, f).textContent = 'Prev';
    el('button', { class: 'btn small', title: 'Next (Enter)', onclick: () => this.findStep(1) }, f).textContent = 'Next';
    el('button', { class: 'btn small', title: 'Close (Esc)', onclick: () => this.closeFind() }, f).textContent = 'Close';
    this.fq.addEventListener('input', () => this.runFind(true));
    this.fq.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.findStep(e.shiftKey ? -1 : 1);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        this.closeFind();
      }
    });
  }
  openFind() {
    this.find.open = true;
    this.findEl.classList.add('open');
    const sel = this.ta.value.slice(this.ta.selectionStart, this.ta.selectionEnd);
    if (sel && !sel.includes('\n')) this.fq.value = sel;
    this.fq.focus();
    this.fq.select();
    this.runFind(true);
  }
  closeFind() {
    this.find.open = false;
    this.findEl.classList.remove('open');
    this.paintMarks();
    this.ta.focus();
  }
  runFind(jump) {
    const q = this.fq.value;
    this.find.q = q;
    const hits = [];
    if (q) {
      const v = this.ta.value.toLowerCase(), k = q.toLowerCase();
      for (let i = v.indexOf(k); i >= 0 && hits.length < 2000; i = v.indexOf(k, i + k.length)) hits.push(i);
    }
    this.find.hits = hits;
    if (jump) {
      const from = this.ta.selectionStart;
      this.find.i = hits.length ? Math.max(0, hits.findIndex((h) => h >= from)) : -1;
    } else if (this.find.i >= hits.length) this.find.i = hits.length - 1;
    this.fcount.textContent = q ? (hits.length ? `${this.find.i + 1} of ${hits.length}` : 'No match') : '';
    this.paintMarks();
  }
  findStep(d) {
    if (!this.find.open) return this.openFind();
    const hits = this.find.hits;
    if (!hits.length) return;
    this.find.i = (this.find.i + d + hits.length) % hits.length;
    const h = hits[this.find.i];
    this.ta.setSelectionRange(h, h + this.find.q.length);
    const { line } = this.posOf(h);
    const lh = this.lineH();
    if (line * lh < this.ta.scrollTop || line * lh > this.ta.scrollTop + this.ta.clientHeight - lh * 2) this.ta.scrollTop = Math.max(0, line * lh - this.ta.clientHeight / 3);
    this.fcount.textContent = `${this.find.i + 1} of ${hits.length}`;
    this.paintMarks();
  }
}
