// Type hints for the code editor: completions, signature help, hovers and light checks. Everything comes from
// a quick, forgiving scan of the source (no full parse, never throws) and the API types in docs.js.
// ctx (optional) describes the pedal: { controls: [{name, kind}], findControl(name, kind), ports: {ins, outs}, signals }.
import { SIGS, API_NAMES, FIELDS, describe, sigText, typeLabel } from './docs.js';
import { PALETTES, NAMED, SIZES, FONT_NAMES } from './runtime.js';
import { ICON_NAMES } from './font.js';

const KW = new Set(['and', 'break', 'do', 'else', 'elseif', 'end', 'false', 'for', 'function', 'if', 'in', 'local', 'nil', 'not', 'or', 'repeat', 'return', 'then', 'true', 'until', 'while']);
const LIBS = new Set(['math', 'string', 'table']);
const STR_METHODS = ['len', 'sub', 'upper', 'lower', 'rep', 'reverse', 'byte', 'format', 'find', 'match', 'gsub', 'split', 'trim', 'startsWith', 'endsWith', 'pad'];
const CONSTS = ['W', 'H', 'colors', 'mouse', 'screen', 'math', 'string', 'table'];
const ALIGNS = ['left', 'center', 'right', 'middle'];
const KINDS = ['knob', 'switch', 'dip', 'foot', 'button'];
const SIGNALS = ['in', 'out', 'inDb', 'outDb', 'env', 'on', 'lfo', 'tempo'];
const lc = (s) => String(s).toLowerCase();

// ------------------------------------------------------------------ lexer
/** Tokens with offsets: { t: name | kw | num | str | op, v, s, e, open (an unclosed string) }. Comments are skipped. */
export function lex(src) {
  const out = [];
  const n = src.length;
  let i = 0;
  while (i < n) {
    const c = src[i];
    if (c === ' ' || c === '\t' || c === '\r' || c === '\n') { i++; continue; }
    if (c === '-' && src[i + 1] === '-') {
      const m = /^--\[(=*)\[/.exec(src.slice(i, i + 12));
      if (m) {
        const j = src.indexOf(']' + m[1] + ']', i);
        i = j < 0 ? n : j + m[1].length + 2;
      } else {
        const j = src.indexOf('\n', i);
        i = j < 0 ? n : j;
      }
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      let j = i + 1;
      while (j < n && /[\w]/.test(src[j])) j++;
      const w = src.slice(i, j);
      out.push({ t: KW.has(w) ? 'kw' : 'name', v: w, s: i, e: j });
      i = j;
      continue;
    }
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1] || ''))) {
      const m = /^(0x[0-9a-fA-F]+|[0-9]*\.?[0-9]+(?:[eE][+-]?[0-9]+)?)/.exec(src.slice(i, i + 40));
      const s = m ? m[0] : c;
      out.push({ t: 'num', v: Number(s), s: i, e: i + s.length });
      i += s.length;
      continue;
    }
    if (c === '"' || c === "'") {
      let j = i + 1, v = '';
      while (j < n && src[j] !== c && src[j] !== '\n') {
        if (src[j] === '\\') { v += src[j + 1] || ''; j += 2; } else v += src[j++];
      }
      const open = !(j < n && src[j] === c);
      out.push({ t: 'str', v, s: i, e: open ? Math.min(j, n) : j + 1, open });
      i = open ? j : j + 1;
      continue;
    }
    if (c === '[' && /^\[=*\[/.test(src.slice(i, i + 10))) {
      const m = /^\[(=*)\[/.exec(src.slice(i, i + 10));
      const j = src.indexOf(']' + m[1] + ']', i);
      const e = j < 0 ? n : j + m[1].length + 2;
      out.push({ t: 'str', v: src.slice(i + m[0].length, j < 0 ? n : j), s: i, e, long: true });
      i = e;
      continue;
    }
    const two = src.substr(i, 2);
    if (['==', '~=', '!=', '<=', '>=', '..', '//', '+=', '-=', '*=', '/='].includes(two)) {
      out.push({ t: 'op', v: two, s: i, e: i + 2 });
      i += 2;
      continue;
    }
    out.push({ t: 'op', v: c, s: i, e: i + 1 });
    i++;
  }
  return out;
}

// ------------------------------------------------------------------ the scan: calls and names
const OPEN = { '(': ')', '{': '}', '[': ']' };
let cache = { src: null, res: null };
/** { toks, calls: [{name, s, e, open, close, args: [{s, e, toks}], member}], defs: Map name -> {kind, s, line, params} } */
export function scan(src) {
  if (cache.src === src) return cache.res;
  const toks = lex(src);
  const calls = [];
  const defs = new Map();
  const lineOf = (pos) => { let k = 1; for (let i = 0; i < pos && i < src.length; i++) if (src.charCodeAt(i) === 10) k++; return k; };
  const def = (name, kind, at, params) => {
    if (!defs.has(name) || (kind === 'function' && defs.get(name).kind !== 'function')) defs.set(name, { kind, s: at, line: 0, params });
  };
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    const prev = toks[i - 1];
    if (t.t === 'kw' && t.v === 'function') {
      // function name(a, b) / function a.b:c(...) / function(a, b)
      let j = i + 1, name = null;
      if (toks[j] && toks[j].t === 'name') {
        name = toks[j].v;
        j++;
        while (toks[j] && (toks[j].v === '.' || toks[j].v === ':') && toks[j + 1] && toks[j + 1].t === 'name') j += 2;
      }
      const params = [];
      if (toks[j] && toks[j].v === '(') {
        for (j++; toks[j] && toks[j].v !== ')'; j++) if (toks[j].t === 'name') { params.push(toks[j].v); def(toks[j].v, 'param', toks[j].s); }
      }
      if (name && toks[i + 2] && toks[i + 2].v === '(') def(name, 'function', toks[i + 1].s, params);
      else if (name) def(name, 'variable', toks[i + 1].s);
      continue;
    }
    if (t.t === 'kw' && (t.v === 'local' || t.v === 'for')) {
      for (let j = i + 1; toks[j] && (toks[j].t === 'name' || toks[j].v === ','); j++) if (toks[j].t === 'name') def(toks[j].v, 'variable', toks[j].s);
      continue;
    }
    if (t.t !== 'name') continue;
    const next = toks[i + 1];
    const afterDot = prev && (prev.v === '.' || prev.v === ':');
    if (!afterDot && next && next.t === 'op' && (next.v === '=' || next.v === ',' || /^[-+*/]=$/.test(next.v) || next.v === '..=')) {
      // a = 1, or a, b = ...
      if (next.v !== ',' || isAssignList(toks, i)) def(t.v, 'variable', t.s);
    }
    if (!next || next.v !== '(') continue;
    if (prev && prev.t === 'kw' && prev.v === 'function') continue;
    let name = t.v, member = false;
    if (afterDot) {
      const obj = toks[i - 2];
      if (prev.v === '.' && obj && obj.t === 'name' && LIBS.has(obj.v) && !(toks[i - 3] && (toks[i - 3].v === '.' || toks[i - 3].v === ':'))) name = obj.v + '.' + t.v;
      else member = true;
    }
    // the arguments, split at top level commas
    const call = { name, s: afterDot && !member ? toks[i - 2].s : t.s, e: t.e, open: next.s, close: -1, args: [], member, nameTok: t };
    const stack = [];
    let cur = { s: next.e, toks: [] };
    let j = i + 2, blocks = 0;
    for (; j < toks.length; j++) {
      const q = toks[j];
      if (q.t === 'kw') {
        // a function written inside the call has its own blocks
        if (['function', 'if', 'do', 'repeat'].includes(q.v)) blocks++;
        else if ((q.v === 'end' || q.v === 'until') && blocks > 0) { blocks--; cur.toks.push(q); continue; }
      }
      if (!stack.length && q.v === ')') {
        call.close = q.s;
        break;
      }
      if (!stack.length && q.v === ',') {
        cur.e = q.s;
        call.args.push(cur);
        cur = { s: q.e, toks: [] };
        continue;
      }
      // a statement keyword at top level means the call was never closed
      if (!stack.length && !blocks && q.t === 'kw' && ['end', 'local', 'then', 'do', 'else', 'elseif', 'return', 'until'].includes(q.v)) break;
      if (q.t === 'op' && OPEN[q.v]) stack.push(OPEN[q.v]);
      else if (q.t === 'op' && (q.v === ')' || q.v === '}' || q.v === ']')) {
        if (stack[stack.length - 1] === q.v) stack.pop();
        else break;
      }
      cur.toks.push(q);
    }
    cur.e = call.close >= 0 ? call.close : toks[j - 1] ? toks[j - 1].e : next.e;
    if (cur.toks.length || call.args.length) call.args.push(cur);
    calls.push(call);
  }
  for (const d of defs.values()) d.line = lineOf(d.s);
  const res = { toks, calls, defs };
  cache = { src, res };
  return res;
}
// "a, b = ..." (and not a call argument list): look ahead for '=' before anything else
function isAssignList(toks, i) {
  for (let j = i + 1; j < toks.length && j < i + 40; j += 2) {
    if (toks[j].v === '=') return true;
    if (toks[j].v !== ',' || !toks[j + 1] || toks[j + 1].t !== 'name') return false;
  }
  return false;
}

// ------------------------------------------------------------------ what a literal argument is
function literal(arg) {
  const tk = arg.toks;
  if (tk.length === 1) {
    const t = tk[0];
    if (t.t === 'str') return { kind: 'str', v: t.v, tok: t };
    if (t.t === 'num') return { kind: 'num', v: t.v, tok: t };
    if (t.t === 'kw' && (t.v === 'true' || t.v === 'false')) return { kind: 'bool', v: t.v === 'true', tok: t };
    if (t.t === 'kw' && t.v === 'nil') return { kind: 'nil', tok: t };
  }
  if (tk.length === 2 && tk[0].v === '-' && tk[1].t === 'num') return { kind: 'num', v: -tk[1].v, tok: tk[1] };
  return null;
}
const isColorText = (v) => FIELDS.colors.includes(v) || NAMED[lc(v)] !== undefined || /^#[0-9a-f]{3,8}$/i.test(v) || /^(rgb|hsl)a?\(/i.test(v);
function portFind(list, v) {
  if (typeof v === 'number') return Math.round(v) >= 1 && Math.round(v) <= list.length;
  const k = lc(String(v).trim());
  return list.some((p, n) => lc(p.name || 'In ' + (n + 1)) === k) || (/^\d+$/.test(k) && +k >= 1 && +k <= list.length);
}
// a value list for a parameter type (for completion inside a string)
function valuesFor(type, ctx) {
  const [base, sub] = type.split('.');
  switch (base) {
    case 'color': return [...FIELDS.colors.map((v) => [v, 'theme colour']), ...Object.keys(NAMED).map((v) => [v, NAMED[v]])];
    case 'font': return FONT_NAMES.map((v) => [v, 'font']);
    case 'theme': return Object.keys(PALETTES).map((v) => [v, 'theme']);
    case 'icon': return ICON_NAMES.map((v) => [v, 'icon']);
    case 'align': return ALIGNS.map((v) => [v, 'align']);
    case 'size': return Object.keys(SIZES).map((v) => [v, SIZES[v] + ' px']);
    case 'kind': return KINDS.map((v) => [v, 'control kind']);
    case 'signal': return [...new Set([...SIGNALS, ...((ctx && ctx.signals) || [])])].map((v) => [v, 'signal']);
    case 'control': {
      const all = (ctx && ctx.controls) || [];
      const pick = sub ? all.filter((c) => c.kind === sub) : all;
      return (pick.length ? pick : all).map((c) => [c.name, c.kind]);
    }
    case 'port': {
      const list = (ctx && ctx.ports && (sub === 'in' ? ctx.ports.ins : ctx.ports.outs)) || [];
      return list.map((p, n) => [p.name || (sub === 'in' ? 'In ' : 'Out ') + (n + 1), (sub === 'in' ? 'input ' : 'output ') + (n + 1) + (p.sig === 'b' ? ', binary' : ', analog')]);
    }
  }
  return null;
}
function pickOverload(spec, n) {
  return spec.overloads.find((o) => n >= minArgs(o) && n <= maxArgs(o)) || spec.overloads[0];
}
const minArgs = (o) => o.params.filter((p) => !p.opt).length;
const maxArgs = (o) => (o.params.some((p) => p.rest) ? Infinity : o.params.length);
const paramAt = (o, i) => o.params[i] || (o.params.length && o.params[o.params.length - 1].rest ? o.params[o.params.length - 1] : null);

// edit distance, for "did you mean"
function dist(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 9;
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
function closest(name, pool) {
  let best = null, bd = 3;
  for (const p of pool) {
    if (lc(p) === lc(name)) return p;
    const dd = dist(lc(name), lc(p));
    if (dd < bd) { bd = dd; best = p; }
  }
  return best;
}

// ------------------------------------------------------------------ checks
/** Light checks: [{ s, e, message }]. Never blocks anything, the script still runs. */
export function lint(src, ctx) {
  const { calls, defs } = scan(src);
  const out = [];
  const warn = (s, e, message) => out.push({ s, e: Math.max(e, s + 1), message });
  const globals = [...SIGS.keys()].filter((k) => !k.includes('.') && !SIGS.get(k).callback);
  for (const c of calls) {
    if (c.member) continue;
    const own = defs.get(c.name.split('.')[0]);
    const spec = SIGS.get(c.name);
    if (!spec) {
      if (c.name.includes('.')) {
        const [lib, fn] = c.name.split('.');
        if (!own) {
          const alt = closest(fn, [...SIGS.keys()].filter((k) => k.startsWith(lib + '.')).map((k) => k.slice(lib.length + 1)));
          warn(c.nameTok.s, c.nameTok.e, `${lib}.${fn} is not a ${lib} function.` + (alt ? ` Did you mean ${lib}.${alt}?` : ''));
        }
      } else if (!own && !API_NAMES.has(c.name) && !KW.has(c.name)) {
        const alt = closest(c.name, [...globals, ...defs.keys()]);
        warn(c.s, c.e, `${c.name} is not a Tone Zone function and is not defined in this script.` + (alt ? ` Did you mean ${alt}?` : ''));
      }
      continue;
    }
    if (spec.callback || (own && own.kind === 'function')) continue; // the script's own function of that name
    if (c.close < 0) continue; // still typing
    const n = c.args.length;
    const lastCall = n && c.args[n - 1].toks.some((t) => t.v === '(' || t.v === '...');
    const fits = spec.overloads.some((o) => n >= minArgs(o) && n <= maxArgs(o));
    if (!fits) {
      const lo = Math.min(...spec.overloads.map(minArgs)), hi = Math.max(...spec.overloads.map(maxArgs));
      const few = n < lo;
      if (!(few && lastCall)) {
        const o = spec.overloads[0];
        const names = o.params.filter((p) => !p.opt).map((p) => p.name).join(', ');
        const msg = few
          ? `${c.name} needs ${lo === hi ? '' : 'at least '}${lo} argument${lo === 1 ? '' : 's'} (${names}), this call has ${n}.`
          : `${c.name} takes ${lo === hi ? '' : 'at most '}${hi} argument${hi === 1 ? '' : 's'}, this call has ${n}.`;
        warn(c.s, c.close + 1, msg);
      }
      continue;
    }
    const o = pickOverload(spec, n);
    c.args.forEach((a, i) => {
      const p = paramAt(o, i);
      const L = p && literal(a);
      if (!L) return;
      const at = [L.tok.s, L.tok.e];
      const [base, sub] = p.type.split('.');
      if (base === 'number' && L.kind === 'str') return warn(...at, `${p.name} should be a number, not text.`);
      if (['string', 'font', 'theme', 'icon', 'align', 'kind', 'signal'].includes(base) && L.kind === 'num') return warn(...at, `${p.name} should be text, not a number.`);
      if (L.kind !== 'str') {
        if (base === 'control' && L.kind === 'num' && ctx && ctx.findControl && ctx.controls && !ctx.findControl(L.v, sub)) warn(...at, `This pedal has no ${sub || 'control'} number ${L.v}.`);
        if (base === 'port' && L.kind === 'num' && ctx && ctx.ports) {
          const list = sub === 'in' ? ctx.ports.ins : ctx.ports.outs;
          if (!portFind(list, L.v)) warn(...at, noPort(sub, L.v, list));
        }
        return;
      }
      const v = L.v;
      if (base === 'color' && !isColorText(v)) warn(...at, `"${v}" is not a colour. Use "#rrggbb", a name like "red" or a theme colour like "fg".`);
      else if (base === 'font' && !FONT_NAMES.includes(v)) warn(...at, `"${v}" is not a font. Fonts: ${FONT_NAMES.join(', ')}.`);
      else if (base === 'theme' && !PALETTES[v]) warn(...at, `"${v}" is not a theme. Themes: ${Object.keys(PALETTES).join(', ')}.`);
      else if (base === 'icon' && !ICON_NAMES.includes(v)) warn(...at, `"${v}" is not an icon.` + (closest(v, ICON_NAMES) ? ` Did you mean "${closest(v, ICON_NAMES)}"?` : ''));
      else if (base === 'align' && ![...ALIGNS, 'centre'].includes(lc(v))) warn(...at, `align is left, center, right or middle.`);
      else if (base === 'size' && SIZES[v] === undefined && !(v.trim() !== '' && !Number.isNaN(+v))) warn(...at, `size is a number or ${Object.keys(SIZES).join(', ')}.`);
      else if (base === 'kind' && !KINDS.includes(v)) warn(...at, `kind is ${KINDS.join(', ')}.`);
      else if (base === 'control' && ctx && ctx.findControl && ctx.controls && !ctx.findControl(v, sub)) {
        const names = ctx.controls.filter((x) => !sub || x.kind === sub).map((x) => x.name);
        const alt = closest(v, names.length ? names : ctx.controls.map((x) => x.name));
        warn(...at, `This pedal has no ${sub || 'control'} called "${v}".` + (alt ? ` Did you mean "${alt}"?` : names.length ? ` ${cap(sub || 'control')}s: ${names.slice(0, 6).join(', ')}.` : ''));
      } else if (base === 'port' && ctx && ctx.ports) {
        const list = sub === 'in' ? ctx.ports.ins : ctx.ports.outs;
        if (!portFind(list, v)) warn(...at, noPort(sub, v, list));
      }
    });
  }
  return out.sort((a, b) => a.s - b.s);
}
const cap = (s) => s[0].toUpperCase() + s.slice(1);
function noPort(sub, v, list) {
  const word = sub === 'in' ? 'input' : 'output';
  if (!list.length) return `This screen has no ${word}s yet. Add them under Inputs and outputs in the screen's inspector.`;
  const names = list.map((p, n) => p.name || (sub === 'in' ? 'In ' : 'Out ') + (n + 1));
  return typeof v === 'number' ? `This screen has ${list.length} ${word}${list.length === 1 ? '' : 's'}, not ${v}.` : `This screen has no ${word} called "${v}". ${cap(word)}s: ${names.join(', ')}.`;
}

// ------------------------------------------------------------------ signature help
/** The call the caret is in: { name, spec, ov, arg, sigs: [text] } or null. */
export function signatureAt(src, pos) {
  const { calls } = scan(src);
  let best = null;
  for (const c of calls) {
    if (c.open >= pos || (c.close >= 0 && pos > c.close)) continue;
    if (!best || c.open > best.open) best = c;
  }
  if (!best || best.member) return null;
  const spec = SIGS.get(best.name);
  if (!spec) return null;
  // the argument the caret is in: how many top level commas come before it
  const arg = best.args.filter((a) => a.e < pos && src[a.e] === ',').length;
  const n = Math.max(best.args.length, arg + 1);
  const ov = spec.overloads.find((o) => maxArgs(o) >= n && minArgs(o) <= n) || spec.overloads.find((o) => maxArgs(o) > arg) || spec.overloads[0];
  return { name: best.name, spec, ov, arg, call: best };
}

// ------------------------------------------------------------------ hover
/** What to show for the word at pos: { s, e, title, body } or null. */
export function hoverAt(src, pos, ctx) {
  const { toks, defs } = scan(src);
  const i = toks.findIndex((t) => t.s <= pos && pos < t.e);
  if (i < 0) return null;
  const t = toks[i];
  if (t.t !== 'name') return null;
  const prev = toks[i - 1];
  let name = t.v, s = t.s;
  if (prev && (prev.v === '.' || prev.v === ':')) {
    const obj = toks[i - 2];
    if (prev.v === '.' && obj && obj.t === 'name' && (LIBS.has(obj.v) || FIELDS[obj.v])) {
      name = obj.v + '.' + t.v;
      s = obj.s;
    } else if (prev.v === ':' && STR_METHODS.includes(t.v)) name = 'string.' + t.v;
    else return null;
  }
  const own = defs.get(name);
  const spec = SIGS.get(name);
  if (spec && !(own && own.kind === 'function' && !spec.callback)) {
    const title = spec.overloads.map((o) => sigText(name, o)).join('\n');
    const ps = spec.overloads[spec.overloads.length - 1].params.filter((p) => p.doc).map((p) => `${p.name}: ${p.doc}`);
    return { s, e: t.e, title, body: spec.desc, params: ps };
  }
  if (own) {
    const what = own.kind === 'function' ? `function ${name}(${(own.params || []).join(', ')})` : own.kind === 'param' ? `${name} (a parameter)` : `${name} (a variable)`;
    return { s, e: t.e, title: what, body: `Defined in this script on line ${own.line}.` };
  }
  const d = describe(name) || (name.includes('.') ? describe(name) : '');
  if (d || API_NAMES.has(name)) return { s, e: t.e, title: name, body: d };
  if (name.includes('.') && FIELDS[name.split('.')[0]]) return { s, e: t.e, title: name, body: describe(name.split('.')[0]) };
  return null;
}

// ------------------------------------------------------------------ completion
/**
 * Completions at pos: { from, to, items: [{ label, kind, detail, insert }] } or null.
 * force = the person asked (Ctrl+Space): show even without a typed prefix.
 */
export function completions(src, pos, ctx, force) {
  const { toks, defs } = scan(src);
  // inside a string: values for the parameter it is passed to
  const st = toks.find((t) => t.t === 'str' && !t.long && t.s < pos && (pos < t.e || (t.open && pos <= t.e)));
  if (st) {
    const sig = signatureAt(src, st.s);
    if (!sig) return null;
    const p = paramAt(sig.ov, sig.arg);
    const vals = p && valuesFor(p.type, ctx);
    if (!vals || !vals.length) return null;
    const prefix = src.slice(st.s + 1, pos);
    const items = rank(vals.map(([v, d]) => ({ label: v, kind: 'value', detail: d, insert: v })), prefix, true);
    return items.length ? { from: st.s + 1, to: pos, items, inString: true } : null;
  }
  const before = src.slice(Math.max(0, pos - 80), pos);
  const m = /[A-Za-z_][\w]*$/.exec(before);
  const prefix = m ? m[0] : '';
  if (prefix && /[0-9]/.test(before[before.length - prefix.length - 1] || '')) return null;
  const from = pos - prefix.length;
  const ch = src[from - 1];
  // inside a comment: nothing
  const lineStart = src.lastIndexOf('\n', from - 1) + 1;
  if (/--/.test(stripStrings(src.slice(lineStart, from)))) return null;
  let items = [];
  if (ch === '.' || ch === ':') {
    const om = /([A-Za-z_][\w]*)$/.exec(src.slice(Math.max(0, from - 41), from - 1));
    const obj = om ? om[1] : '';
    if (ch === '.' && LIBS.has(obj)) {
      for (const [k, sp] of SIGS) if (k.startsWith(obj + '.')) items.push(fnItem(k.slice(obj.length + 1), sp, k));
      if (obj === 'math') for (const k of ['pi', 'huge']) items.push({ label: k, kind: 'const', detail: 'number', insert: k, doc: describe('math.' + k) });
    } else if (ch === '.' && FIELDS[obj]) items = FIELDS[obj].map((f) => ({ label: f, kind: 'field', detail: obj, insert: f }));
    else if (ch === ':') items = STR_METHODS.map((k) => fnItem(k, SIGS.get('string.' + k), 'string.' + k, true));
    else return null;
    items = rank(items, prefix, true);
  } else {
    if (!prefix && !force) return null;
    const prevWord = /(\w+)\s+$/.exec(src.slice(Math.max(0, from - 20), from));
    const afterFunction = prevWord && prevWord[1] === 'function';
    const seen = new Set();
    const add = (it) => { if (!seen.has(it.label)) { seen.add(it.label); items.push(it); } };
    if (afterFunction) {
      for (const [k, sp] of SIGS) if (sp.callback) add({ label: k, kind: 'event', detail: sigText(k, sp.overloads[0]).replace(/ -> .*$/, ''), insert: sigText(k, sp.overloads[0]).replace(/: \w+/g, '').replace(/[[\]]/g, ''), doc: sp.desc });
    } else {
      for (const [d, info] of defs) if (d !== prefix || info.s !== from) add(info.kind === 'function' ? { label: d, kind: 'own', detail: `your function (${(info.params || []).join(', ')})`, insert: d + '(', doc: `Defined on line ${info.line}.` } : { label: d, kind: 'var', detail: info.kind === 'param' ? 'parameter' : 'variable', insert: d });
      for (const [k, sp] of SIGS) if (!k.includes('.') && !sp.callback) add(fnItem(k, sp, k));
      for (const k of CONSTS) add({ label: k, kind: 'const', detail: k === 'W' || k === 'H' ? 'number' : 'table', insert: k, doc: describe(k) });
      for (const k of KW) add({ label: k, kind: 'kw', detail: 'keyword', insert: k });
    }
    items = rank(items, prefix, false);
    if (items.length === 1 && items[0].label === prefix) return null;
  }
  return items.length ? { from, to: pos, items } : null;
}
function fnItem(label, sp, full, method) {
  const ov = sp.overloads[0];
  const params = method ? ov.params.slice(1) : ov.params;
  return { label, kind: 'fn', detail: sigText(full, ov).replace(/^[\w.]+/, '').replace(/^\(/, '(').slice(0, 90), insert: label + (params.length || ov.params.some((p) => p.rest) ? '(' : '()'), doc: sp.desc, full };
}
const stripStrings = (s) => s.replace(/"[^"\n]*"?|'[^'\n]*'?/g, '""');
function rank(items, prefix, keepAll) {
  const p = lc(prefix);
  const scored = [];
  for (const it of items) {
    const l = lc(it.label);
    let sc;
    if (!p) sc = 1;
    else if (it.label.startsWith(prefix)) sc = 4;
    else if (l.startsWith(p)) sc = 3;
    else if (p.length >= 2 && l.includes(p)) sc = 2;
    else continue;
    if (it.kind === 'kw') sc -= 0.5;
    if (it.kind === 'own' || it.kind === 'var') sc += 0.2;
    scored.push([sc, it]);
  }
  scored.sort((a, b) => b[0] - a[0] || a[1].label.length - b[1].label.length || a[1].label.localeCompare(b[1].label));
  return scored.slice(0, keepAll ? 200 : 60).map((x) => x[1]);
}
export { typeLabel };
