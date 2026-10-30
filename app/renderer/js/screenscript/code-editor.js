// A small code editor: a textarea with a highlighted copy behind it, line numbers, auto indent, bracket
// matching, error markers and find. The textarea keeps the native caret, selection and undo.
import { el } from '../util.js';
import { API_NAMES } from './docs.js';

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
    this.find = { open: false, q: '', hits: [], i: -1 };
    this.buildFind();
    this.ta.addEventListener('input', (e) => this.onInput(e));
    this.ta.addEventListener('keydown', (e) => this.onKey(e));
    this.ta.addEventListener('scroll', () => this.syncScroll());
    for (const ev of ['keyup', 'click', 'select', 'focus']) this.ta.addEventListener(ev, () => this.paintMarks());
    document.addEventListener('selectionchange', (this._sel = () => document.activeElement === this.ta && this.paintMarks()));
    this.render();
  }
  destroy() {
    document.removeEventListener('selectionchange', this._sel);
  }
  get value() {
    return this.ta.value;
  }
  set value(v) {
    this.ta.value = v;
    this.render();
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
    this.hl.innerHTML = highlight(this.ta.value);
    this.renderGutter();
    if (this.find.open) this.runFind(false);
    this.paintMarks();
    this.syncScroll();
  }
  renderGutter() {
    const n = this.ta.value.split('\n').length;
    const bad = new Set(this.errors.map((e) => e.line));
    let h = '';
    for (let i = 1; i <= n; i++) h += `<div class="${bad.has(i) ? 'err' : ''}">${i}</div>`;
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
