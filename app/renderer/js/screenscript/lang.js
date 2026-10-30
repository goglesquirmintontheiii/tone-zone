// ScreenScript: a small Lua-like language for pedal screens. Source is parsed into a tree, then compiled into
// plain JS closures (no eval), so a script can only reach the functions it is given. Every loop pass and call
// spends from a step budget, which stops runaway loops, and errors carry the line they happened on.

export class ScriptError extends Error {
  constructor(msg, line, kind) {
    super(msg);
    this.line = line || 0;
    this.kind = kind || 'runtime'; // syntax | runtime | budget
  }
}

// ------------------------------------------------------------------ values
export class LTable {
  constructor() {
    this.a = []; // keys 1..n
    this.h = null; // every other key
  }
  get(k) {
    if (typeof k === 'number' && k >= 1 && k <= this.a.length && Number.isInteger(k)) return this.a[k - 1];
    return this.h ? this.h.get(k) : undefined;
  }
  set(k, v) {
    if (typeof k === 'number' && Number.isInteger(k) && k >= 1) {
      const a = this.a, n = a.length;
      if (k <= n) {
        a[k - 1] = v;
        if (v === undefined && k === n) while (a.length && a[a.length - 1] === undefined) a.pop();
        return;
      }
      if (k === n + 1) {
        if (v === undefined) {
          if (this.h) this.h.delete(k);
          return;
        }
        a.push(v);
        if (this.h) {
          if (this.h.has(k)) this.h.delete(k);
          while (this.h.size && this.h.has(a.length + 1)) {
            a.push(this.h.get(a.length + 1));
            this.h.delete(a.length);
          }
        }
        return;
      }
    }
    if (k === undefined || k === null) throw new Error('a table key can not be nil');
    if (typeof k === 'number' && Number.isNaN(k)) throw new Error('a table key can not be NaN');
    if (v === undefined) {
      if (this.h) this.h.delete(k);
    } else (this.h || (this.h = new Map())).set(k, v);
  }
  len() {
    return this.a.length;
  }
  keys() {
    const out = [];
    for (let i = 0; i < this.a.length; i++) if (this.a[i] !== undefined) out.push(i + 1);
    if (this.h) for (const k of this.h.keys()) out.push(k);
    return out;
  }
}
// several values from a call (return a, b)
export class Multi {
  constructor(v) {
    this.v = v;
  }
}
class Ret {
  constructor(v) {
    this.v = v;
  }
}
const BREAK = { brk: true };
export const first = (x) => (x instanceof Multi ? x.v[0] : x);
export const truthy = (v) => v !== undefined && v !== null && v !== false;

export function typeOf(v) {
  if (v === undefined || v === null) return 'nil';
  if (v instanceof LTable) return 'table';
  const t = typeof v;
  if (t === 'function') return 'function';
  if (t === 'boolean' || t === 'number' || t === 'string') return t;
  return 'userdata';
}
export function tostr(v) {
  if (v === undefined || v === null) return 'nil';
  if (typeof v === 'number') {
    if (Number.isInteger(v)) return String(v);
    if (v === Infinity) return 'inf';
    if (v === -Infinity) return '-inf';
    if (Number.isNaN(v)) return 'nan';
    return String(+v.toPrecision(14));
  }
  if (typeof v === 'string') return v;
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (v instanceof LTable) return 'table';
  if (typeof v === 'function') return 'function';
  return String(v);
}
export function tonum(v) {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const s = v.trim();
    if (!s) return undefined;
    const n = /^-?0x[0-9a-f]+$/i.test(s) ? parseInt(s, 16) : Number(s);
    return Number.isNaN(n) ? undefined : n;
  }
  return undefined;
}
const MAX_STR = 1 << 20;

// ------------------------------------------------------------------ tokenizer
const KEYWORDS = new Set(['and', 'break', 'do', 'else', 'elseif', 'end', 'false', 'for', 'function', 'if', 'in', 'local', 'nil', 'not', 'or', 'repeat', 'return', 'then', 'true', 'until', 'while']);
const OPS3 = ['...', '..='];
const OPS2 = ['==', '~=', '!=', '<=', '>=', '..', '//', '+=', '-=', '*=', '/=', '::'];
const OPS1 = '+-*/%^#<>=(){}[];:,.';

export function tokenize(src) {
  const out = [];
  let i = 0, line = 1;
  const n = src.length;
  const err = (m) => {
    throw new ScriptError(m, line, 'syntax');
  };
  const longBracket = () => {
    // at '[' : [[ ... ]] or [==[ ... ]==]
    let j = i + 1, eq = 0;
    while (src[j] === '=') { eq++; j++; }
    if (src[j] !== '[') return null;
    const close = ']' + '='.repeat(eq) + ']';
    const end = src.indexOf(close, j + 1);
    if (end < 0) err('a long string or comment is never closed');
    let body = src.slice(j + 1, end);
    for (const ch of body) if (ch === '\n') line++;
    if (body[0] === '\n') body = body.slice(1);
    i = end + close.length;
    return body;
  };
  while (i < n) {
    const c = src[i];
    if (c === '\n') { line++; i++; continue; }
    if (c === ' ' || c === '\t' || c === '\r') { i++; continue; }
    if (c === '-' && src[i + 1] === '-') {
      i += 2;
      if (src[i] === '[') {
        const save = i;
        if (longBracket() !== null) continue;
        i = save;
      }
      while (i < n && src[i] !== '\n') i++;
      continue;
    }
    const tl = line;
    if (/[A-Za-z_]/.test(c)) {
      let j = i + 1;
      while (j < n && /[A-Za-z0-9_]/.test(src[j])) j++;
      const w = src.slice(i, j);
      out.push({ t: KEYWORDS.has(w) ? w : 'name', v: w, line: tl });
      i = j;
      continue;
    }
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1] || ''))) {
      let j = i, v;
      if (c === '0' && /[xX]/.test(src[i + 1] || '')) {
        j = i + 2;
        while (j < n && /[0-9a-fA-F]/.test(src[j])) j++;
        v = parseInt(src.slice(i + 2, j), 16);
      } else {
        while (j < n && /[0-9]/.test(src[j])) j++;
        if (src[j] === '.' && src[j + 1] !== '.') { j++; while (j < n && /[0-9]/.test(src[j])) j++; }
        if (/[eE]/.test(src[j] || '')) {
          j++;
          if (/[+-]/.test(src[j] || '')) j++;
          while (j < n && /[0-9]/.test(src[j])) j++;
        }
        v = Number(src.slice(i, j));
      }
      if (Number.isNaN(v)) err(`bad number '${src.slice(i, j)}'`);
      out.push({ t: 'num', v, line: tl });
      i = j;
      continue;
    }
    if (c === '"' || c === "'") {
      let j = i + 1, s = '';
      while (true) {
        if (j >= n || src[j] === '\n') err('a string is not closed (missing ' + c + ')');
        const d = src[j];
        if (d === c) break;
        if (d === '\\') {
          const e = src[j + 1];
          j += 2;
          if (e === 'n') s += '\n';
          else if (e === 't') s += '\t';
          else if (e === 'r') s += '\r';
          else if (e === '\\') s += '\\';
          else if (e === '"') s += '"';
          else if (e === "'") s += "'";
          else if (e === '\n') { s += '\n'; line++; }
          else if (/[0-9]/.test(e)) {
            let k = j - 1, num = '';
            while (num.length < 3 && /[0-9]/.test(src[k])) num += src[k++];
            s += String.fromCharCode(+num);
            j = k;
          } else s += e;
          continue;
        }
        s += d;
        j++;
      }
      out.push({ t: 'str', v: s, line: tl });
      i = j + 1;
      continue;
    }
    if (c === '[' && (src[i + 1] === '[' || src[i + 1] === '=')) {
      const body = longBracket();
      if (body !== null) {
        out.push({ t: 'str', v: body, line: tl });
        continue;
      }
    }
    const three = src.substr(i, 3), two = src.substr(i, 2);
    if (OPS3.includes(three)) { out.push({ t: three, line: tl }); i += 3; continue; }
    if (OPS2.includes(two)) { out.push({ t: two === '!=' ? '~=' : two, line: tl }); i += 2; continue; }
    if (OPS1.includes(c)) { out.push({ t: c, line: tl }); i++; continue; }
    if (c === '~') err("'~' on its own is not an operator here (use ~= for 'not equal')");
    if (c === '&' || c === '|' || c === '!') err(`'${c}' is not an operator here (use and, or, not)`);
    err(`unexpected character '${c}'`);
  }
  out.push({ t: 'eof', line });
  return out;
}

// ------------------------------------------------------------------ parser (resolves names as it goes)
class FuncState {
  constructor(parent) {
    this.parent = parent;
    this.blocks = [];
    this.nslots = 0;
    this.upvals = []; // {local: VarInfo} (in the parent) or {up: index in the parent's upvals}
    this.upMap = new Map(); // VarInfo -> index
  }
}

const BIN = {
  or: [1, 1], and: [2, 2],
  '<': [3, 3], '>': [3, 3], '<=': [3, 3], '>=': [3, 3], '~=': [3, 3], '==': [3, 3],
  '..': [9, 8], // right assoc
  '+': [10, 10], '-': [10, 10],
  '*': [11, 11], '/': [11, 11], '//': [11, 11], '%': [11, 11],
  '^': [14, 13], // right assoc, above unary
};
const UNARY_PRI = 12;
const tokName = (tk) => (tk.t === 'name' ? `'${tk.v}'` : tk.t === 'str' ? 'a string' : tk.t === 'num' ? `'${tk.v}'` : tk.t === 'eof' ? 'the end of the script' : `'${tk.t}'`);

export function parse(src) {
  const toks = tokenize(src);
  let p = 0;
  let fs = new FuncState(null);
  const peek = () => toks[p];
  const next = () => toks[p++];
  const check = (t) => toks[p].t === t;
  const accept = (t) => (toks[p].t === t ? toks[p++] : null);
  const fail = (m, tk = peek()) => {
    throw new ScriptError(m, tk.line, 'syntax');
  };
  const expect = (t, what) => {
    if (toks[p].t === t) return toks[p++];
    fail(`expected '${t}'${what ? ' ' + what : ''} but found ${tokName(peek())}`);
  };
  const expectClose = (t, open, line) => {
    if (toks[p].t === t) return toks[p++];
    fail(`expected '${t}' to close '${open}' from line ${line}, found ${tokName(peek())}`);
  };
  const name = () => {
    const tk = peek();
    if (tk.t !== 'name') fail(`expected a name but found ${tokName(tk)}`);
    p++;
    return tk.v;
  };
  // scopes
  const openBlock = () => fs.blocks.push([]);
  const closeBlock = () => fs.blocks.pop();
  const declare = (nm) => {
    const info = { name: nm, fs, slot: fs.nslots++, captured: false };
    fs.blocks[fs.blocks.length - 1].push(info);
    return info;
  };
  const findLocal = (f, nm) => {
    for (let b = f.blocks.length - 1; b >= 0; b--) {
      const bl = f.blocks[b];
      for (let i = bl.length - 1; i >= 0; i--) if (bl[i].name === nm) return bl[i];
    }
    return null;
  };
  const upIndex = (f, info) => {
    if (f.upMap.has(info)) return f.upMap.get(info);
    const src = info.fs === f.parent ? { local: info } : { up: upIndex(f.parent, info) };
    f.upvals.push(src);
    const idx = f.upvals.length - 1;
    f.upMap.set(info, idx);
    return idx;
  };
  const resolve = (nm, line) => {
    for (let f = fs; f; f = f.parent) {
      const info = findLocal(f, nm);
      if (info) {
        if (f === fs) return { k: 'local', info, name: nm, line };
        info.captured = true;
        return { k: 'up', idx: upIndex(fs, info), name: nm, line };
      }
    }
    return { k: 'global', name: nm, line };
  };

  const blockEnd = () => ['end', 'else', 'elseif', 'until', 'eof'].includes(peek().t);
  function block() {
    const stats = [];
    while (!blockEnd()) {
      if (accept(';')) continue;
      const s = statement();
      if (s) stats.push(s);
    }
    return stats;
  }
  function scopedBlock() {
    openBlock();
    const b = block();
    closeBlock();
    return b;
  }

  function statement() {
    const tk = peek();
    const line = tk.line;
    switch (tk.t) {
      case 'if': {
        next();
        const conds = [], blocks = [];
        conds.push(expr());
        expect('then', 'after the if condition');
        blocks.push(scopedBlock());
        let els = null;
        while (true) {
          if (accept('elseif')) {
            conds.push(expr());
            expect('then', 'after the elseif condition');
            blocks.push(scopedBlock());
          } else if (accept('else')) {
            els = scopedBlock();
            expectClose('end', 'if', line);
            break;
          } else {
            expectClose('end', 'if', line);
            break;
          }
        }
        return { k: 'if', conds, blocks, els, line };
      }
      case 'while': {
        next();
        const cond = expr();
        expect('do', 'after the while condition');
        const body = scopedBlock();
        expectClose('end', 'while', line);
        return { k: 'while', cond, body, line };
      }
      case 'do': {
        next();
        const body = scopedBlock();
        expectClose('end', 'do', line);
        return { k: 'do', body, line };
      }
      case 'repeat': {
        next();
        openBlock();
        const body = block();
        expectClose('until', 'repeat', line);
        const cond = expr();
        closeBlock();
        return { k: 'repeat', body, cond, line };
      }
      case 'for': {
        next();
        const n1 = name();
        if (accept('=')) {
          const start = expr();
          expect(',', 'in the for loop (for i = 1, 10 do)');
          const stop = expr();
          const step = accept(',') ? expr() : null;
          expect('do', 'after the for range');
          openBlock();
          const info = declare(n1);
          const body = block();
          closeBlock();
          expectClose('end', 'for', line);
          return { k: 'fornum', info, start, stop, step, body, line };
        }
        const names = [n1];
        while (accept(',')) names.push(name());
        expect('in', "in the for loop (for k, v in pairs(t) do)");
        const exprs = exprList();
        expect('do', 'after the for list');
        openBlock();
        const infos = names.map(declare);
        const body = block();
        closeBlock();
        expectClose('end', 'for', line);
        return { k: 'forin', infos, exprs, body, line };
      }
      case 'function': {
        next();
        let nm = name();
        let target = resolve(nm, line);
        let method = false;
        let full = nm;
        while (check('.') || check(':')) {
          const colon = next().t === ':';
          const key = name();
          full += (colon ? ':' : '.') + key;
          target = { k: 'index', obj: target, key: { k: 'str', v: key }, line, name: key };
          if (colon) {
            method = true;
            break;
          }
        }
        const fn = funcBody(line, method, full);
        return { k: 'assign', targets: [target], exprs: [fn], line };
      }
      case 'local': {
        next();
        if (accept('function')) {
          const nm = name();
          const info = declare(nm);
          const fn = funcBody(line, false, nm);
          return { k: 'localfunc', info, fn, line };
        }
        const names = [name()];
        while (accept(',')) names.push(name());
        const exprs = accept('=') ? exprList() : [];
        // the new names are only visible after the statement
        const infos = names.map(declare);
        return { k: 'local', infos, exprs, line };
      }
      case 'return': {
        next();
        const exprs = blockEnd() || check(';') ? [] : exprList();
        accept(';');
        return { k: 'return', exprs, line };
      }
      case 'break':
        next();
        return { k: 'break', line };
      case '::':
        fail('labels and goto are not supported');
      // fallthrough
      default:
        return exprStatement();
    }
  }

  function exprStatement() {
    const line = peek().line;
    const e = suffixed();
    if (check('=') || check(',')) {
      const targets = [e];
      while (accept(',')) targets.push(suffixed());
      for (const t of targets) if (!['local', 'up', 'global', 'index'].includes(t.k)) fail('can not assign to this', toks[p - 1]);
      expect('=');
      const exprs = exprList();
      return { k: 'assign', targets, exprs, line };
    }
    for (const op of ['+=', '-=', '*=', '/=', '..=']) {
      if (accept(op)) {
        if (!['local', 'up', 'global', 'index'].includes(e.k)) fail('can not assign to this');
        const rhs = expr();
        return { k: 'assign', targets: [e], exprs: [{ k: 'bin', op: op.slice(0, -1), a: e, b: rhs, line }], line };
      }
    }
    if (e.k !== 'call' && e.k !== 'method') {
      const tk = peek();
      if (e.k === 'global' || e.k === 'local' || e.k === 'up') fail(`'${e.name}' on its own does nothing. Did you mean ${e.name}() or ${e.name} = ...?`, tk.line > line ? toks[p - 1] : tk);
      fail(`unexpected ${tokName(tk)}`);
    }
    return { k: 'callstat', e, line };
  }

  function funcBody(line, method, nm) {
    const parent = fs;
    fs = new FuncState(parent);
    openBlock();
    const params = [];
    if (method) params.push(declare('self'));
    expect('(', 'to start the function parameters');
    if (!check(')')) {
      do {
        if (check('...')) fail('... (variable arguments) is not supported, use a table instead');
        params.push(declare(name()));
      } while (accept(','));
    }
    expect(')', 'after the function parameters');
    const body = block();
    expectClose('end', 'function', line);
    closeBlock();
    const node = { k: 'func', fs, params, body, line, name: nm || 'function' };
    fs = parent;
    return node;
  }

  function exprList() {
    const list = [expr()];
    while (accept(',')) list.push(expr());
    return list;
  }

  function primary() {
    const tk = peek();
    if (tk.t === 'name') {
      p++;
      return resolve(tk.v, tk.line);
    }
    if (tk.t === '(') {
      p++;
      const e = expr();
      expectClose(')', '(', tk.line);
      return { k: 'paren', e, line: tk.line };
    }
    fail(`unexpected ${tokName(tk)}`);
  }
  function callArgs() {
    const tk = peek();
    if (tk.t === 'str') { p++; return [{ k: 'str', v: tk.v }]; }
    if (tk.t === '{') return [tableCons()];
    expect('(');
    if (accept(')')) return [];
    const a = exprList();
    expectClose(')', '(', tk.line);
    return a;
  }
  function suffixed() {
    let e = primary();
    while (true) {
      const tk = peek();
      if (tk.t === '.') {
        p++;
        const key = name();
        e = { k: 'index', obj: e, key: { k: 'str', v: key }, line: tk.line, name: key };
      } else if (tk.t === '[') {
        p++;
        const key = expr();
        expectClose(']', '[', tk.line);
        e = { k: 'index', obj: e, key, line: tk.line };
      } else if (tk.t === ':') {
        p++;
        const nm = name();
        e = { k: 'method', obj: e, name: nm, args: callArgs(), line: tk.line };
      } else if (tk.t === '(' || tk.t === 'str' || tk.t === '{') {
        // a call on the next line is ambiguous in Lua; we allow it only for '(' on the same line
        if (tk.t === '(' && tk.line !== toks[p - 1].line) return e;
        e = { k: 'call', fn: e, args: callArgs(), line: tk.line };
      } else return e;
    }
  }
  function simple() {
    const tk = peek();
    switch (tk.t) {
      case 'num': p++; return { k: 'num', v: tk.v };
      case 'str': p++; return { k: 'str', v: tk.v };
      case 'nil': p++; return { k: 'nil' };
      case 'true': p++; return { k: 'true' };
      case 'false': p++; return { k: 'false' };
      case '{': return tableCons();
      case 'function': p++; return funcBody(tk.line, false, 'function');
      case '...': fail('... (variable arguments) is not supported');
      // fallthrough
      default: return suffixed();
    }
  }
  function tableCons() {
    const open = expect('{');
    const items = [];
    while (!check('}')) {
      if (check('[')) {
        const tk = next();
        const key = expr();
        expectClose(']', '[', tk.line);
        expect('=');
        items.push({ key, v: expr() });
      } else if (peek().t === 'name' && toks[p + 1].t === '=') {
        const key = { k: 'str', v: next().v };
        next();
        items.push({ key, v: expr() });
      } else items.push({ v: expr() });
      if (!accept(',') && !accept(';')) break;
    }
    expectClose('}', '{', open.line);
    return { k: 'table', items, line: open.line };
  }
  function expr(limit = 0) {
    let left;
    const tk = peek();
    if (tk.t === 'not' || tk.t === '-' || tk.t === '#') {
      p++;
      const a = expr(UNARY_PRI);
      left = { k: 'un', op: tk.t, a, line: tk.line };
    } else left = simple();
    while (true) {
      const op = peek().t;
      const pri = BIN[op];
      if (!pri || pri[0] <= limit) break;
      const line = next().line;
      const right = expr(pri[1]);
      left = op === 'and' || op === 'or' ? { k: op, a: left, b: right, line } : { k: 'bin', op, a: left, b: right, line };
    }
    return left;
  }

  openBlock();
  const body = block();
  if (!check('eof')) {
    const tk = peek();
    fail(tk.t === 'end' ? "there is an extra 'end' here" : `unexpected ${tokName(tk)}`);
  }
  closeBlock();
  return { k: 'func', fs, params: [], body, line: 1, name: 'main' };
}

// ------------------------------------------------------------------ compiler
// R = run state shared by every closure of one program: { steps, out(line), depth, G (Map of globals) }
const desc = (e) => {
  if (!e) return 'value';
  if (e.k === 'global') return `'${e.name}'`;
  if (e.k === 'local' || e.k === 'up') return `local '${e.name}'`;
  if (e.k === 'index' && e.name) return `field '${e.name}'`;
  if (e.k === 'method') return `method '${e.name}'`;
  return 'value';
};
const kindWord = (v) => {
  const t = typeOf(v);
  return t === 'nil' ? 'nil' : t === 'table' ? 'a table' : t === 'function' ? 'a function' : t === 'boolean' ? 'a boolean' : t === 'number' ? 'a number' : 'a string';
};

export function compile(src, R, file) {
  // errors carry the file they happened in (several files share one program through require)
  const E = (m, line, kind) => {
    const e = new ScriptError(m, line, kind);
    if (file) e.file = file;
    return e;
  };
  const out = (line) => {
    try {
      R.out(line);
    } catch (e) {
      if (e instanceof ScriptError && file && !e.file) e.file = file;
      throw e;
    }
  };
  let tree;
  try {
    tree = parse(src);
  } catch (e) {
    if (e instanceof ScriptError && file) e.file = file;
    throw e;
  }
  const strlib = R.strlib || new Map();
  const G = R.G;

  const rterr = (m, line) => {
    throw E(m, line);
  };
  function index(o, k, line, e) {
    if (o instanceof LTable) return o.get(k);
    if (typeof o === 'string') return strlib.get(k);
    rterr(`tried to read ${typeof k === 'string' ? "'" + k + "'" : '[' + tostr(k) + ']'} from ${kindWord(o)}${e ? ' (' + desc(e) + ')' : ''}`, line);
  }
  function setIndex(o, k, v, line, e) {
    if (!(o instanceof LTable)) rterr(`tried to set ${typeof k === 'string' ? "'" + k + "'" : '[' + tostr(k) + ']'} on ${kindWord(o)}${e ? ' (' + desc(e) + ')' : ''}`, line);
    try {
      o.set(k, v);
    } catch (err) {
      rterr(err.message, line);
    }
  }
  function call(fn, args, line, e) {
    if (typeof fn !== 'function') rterr(fn === undefined ? `tried to call ${desc(e)}, which is not defined (nil)` : `tried to call ${desc(e)}, which is ${kindWord(fn)}, not a function`, line);
    if (--R.steps < 0) out(line);
    try {
      return fn(...args);
    } catch (err) {
      if (err instanceof ScriptError) {
        if (!err.line) {
          err.line = line;
          if (file) err.file = file;
        }
        throw err;
      }
      if (err instanceof RangeError) throw E('too many nested calls (endless recursion?)', line);
      throw E(String(err.message || err), line);
    }
  }
  const num = (v, line, what) => {
    if (typeof v === 'number') return v;
    const n = tonum(v);
    if (n === undefined) rterr(`tried to do math (${what}) with ${kindWord(v)}`, line);
    return n;
  };
  function arith(op, x, y, line) {
    const a = num(x, line, op), b = num(y, line, op);
    switch (op) {
      case '+': return a + b;
      case '-': return a - b;
      case '*': return a * b;
      case '/': return a / b;
      case '%': return b === 0 ? NaN : a - Math.floor(a / b) * b;
      case '//': return Math.floor(a / b);
      case '^': return Math.pow(a, b);
    }
  }
  function compare(op, a, b, line) {
    if (!((typeof a === 'number' && typeof b === 'number') || (typeof a === 'string' && typeof b === 'string')))
      rterr(`tried to compare ${kindWord(a)} with ${kindWord(b)}`, line);
    switch (op) {
      case '<': return a < b;
      case '>': return a > b;
      case '<=': return a <= b;
      case '>=': return a >= b;
    }
  }
  function concat(a, b, line) {
    const s = (typeof a === 'string' ? a : tostr(a)) + (typeof b === 'string' ? b : tostr(b));
    if (s.length > MAX_STR) rterr('a string got too long', line);
    return s;
  }
  function len(v, line) {
    if (typeof v === 'string') return v.length;
    if (v instanceof LTable) return v.len();
    rterr(`tried to get the length of ${kindWord(v)}`, line);
  }

  // an expression; multi = may return a Multi (last in a list)
  function cexpr(e, multi) {
    switch (e.k) {
      case 'nil': return () => undefined;
      case 'true': return () => true;
      case 'false': return () => false;
      case 'num': { const v = e.v; return () => v; }
      case 'str': { const v = e.v; return () => v; }
      case 'local': {
        const s = e.info.slot;
        return e.info.captured ? (f) => f[s].v : (f) => f[s];
      }
      case 'up': { const i = e.idx; return (f, u) => u[i].v; }
      case 'global': { const nm = e.name; return () => G.get(nm); }
      case 'paren': { const x = cexpr(e.e, false); return x; }
      case 'index': {
        const o = cexpr(e.obj), line = e.line, oe = e.obj;
        if (e.key.k === 'str') {
          const k = e.key.v;
          return (f, u) => {
            const ov = o(f, u);
            return ov instanceof LTable ? ov.get(k) : index(ov, k, line, oe);
          };
        }
        const k = cexpr(e.key);
        return (f, u) => index(o(f, u), k(f, u), line, oe);
      }
      case 'call': {
        const fn = cexpr(e.fn), args = cargs(e.args), line = e.line, fe = e.fn;
        if (multi) return (f, u) => call(fn(f, u), args(f, u), line, fe);
        return (f, u) => {
          const r = call(fn(f, u), args(f, u), line, fe);
          return r instanceof Multi ? r.v[0] : r;
        };
      }
      case 'method': {
        const o = cexpr(e.obj), args = cargs(e.args), line = e.line, nm = e.name;
        const run = (f, u) => {
          const ov = o(f, u);
          const fn = index(ov, nm, line, e.obj);
          return call(fn, [ov, ...args(f, u)], line, e);
        };
        if (multi) return run;
        return (f, u) => first(run(f, u));
      }
      case 'func': return cfunc(e);
      case 'and': {
        const a = cexpr(e.a), b = cexpr(e.b);
        return (f, u) => {
          const x = a(f, u);
          return truthy(x) ? b(f, u) : x;
        };
      }
      case 'or': {
        const a = cexpr(e.a), b = cexpr(e.b);
        return (f, u) => {
          const x = a(f, u);
          return truthy(x) ? x : b(f, u);
        };
      }
      case 'un': {
        const a = cexpr(e.a), line = e.line;
        if (e.op === 'not') return (f, u) => !truthy(a(f, u));
        if (e.op === '#') return (f, u) => len(a(f, u), line);
        return (f, u) => {
          const x = a(f, u);
          return typeof x === 'number' ? -x : -num(x, line, '-');
        };
      }
      case 'bin': return cbin(e);
      case 'table': {
        const items = e.items.map((it, i) => ({ key: it.key ? cexpr(it.key) : null, v: cexpr(it.v, !it.key && i === e.items.length - 1) }));
        const line = e.line;
        return (f, u) => {
          const t = new LTable();
          let n = 1;
          for (const it of items) {
            if (it.key) {
              const k = it.key(f, u);
              if (k === undefined) rterr('a table key can not be nil', line);
              t.set(k, it.v(f, u));
            } else {
              const v = it.v(f, u);
              if (v instanceof Multi) for (const x of v.v) t.set(n++, x);
              else t.set(n++, v);
            }
          }
          return t;
        };
      }
    }
    throw E('can not compile ' + e.k, e.line);
  }
  function cbin(e) {
    const a = cexpr(e.a), b = cexpr(e.b), line = e.line, op = e.op;
    switch (op) {
      case '+': return (f, u) => { const x = a(f, u), y = b(f, u); return typeof x === 'number' && typeof y === 'number' ? x + y : arith(op, x, y, line); };
      case '-': return (f, u) => { const x = a(f, u), y = b(f, u); return typeof x === 'number' && typeof y === 'number' ? x - y : arith(op, x, y, line); };
      case '*': return (f, u) => { const x = a(f, u), y = b(f, u); return typeof x === 'number' && typeof y === 'number' ? x * y : arith(op, x, y, line); };
      case '/': return (f, u) => { const x = a(f, u), y = b(f, u); return typeof x === 'number' && typeof y === 'number' ? x / y : arith(op, x, y, line); };
      case '%': case '//': case '^': return (f, u) => arith(op, a(f, u), b(f, u), line);
      case '==': return (f, u) => a(f, u) === b(f, u);
      case '~=': return (f, u) => a(f, u) !== b(f, u);
      case '<': return (f, u) => { const x = a(f, u), y = b(f, u); return typeof x === 'number' && typeof y === 'number' ? x < y : compare(op, x, y, line); };
      case '>': return (f, u) => { const x = a(f, u), y = b(f, u); return typeof x === 'number' && typeof y === 'number' ? x > y : compare(op, x, y, line); };
      case '<=': case '>=': return (f, u) => compare(op, a(f, u), b(f, u), line);
      case '..': return (f, u) => concat(a(f, u), b(f, u), line);
    }
    throw E('unknown operator ' + op, line);
  }
  // a list of expressions -> array, the last one expanded
  function cargs(list) {
    const n = list.length;
    if (!n) return () => [];
    const last = list[n - 1];
    const lastMulti = last.k === 'call' || last.k === 'method';
    const cs = list.map((e, i) => cexpr(e, i === n - 1 && lastMulti));
    if (n === 1 && !lastMulti) { const c0 = cs[0]; return (f, u) => [c0(f, u)]; }
    if (n === 2 && !lastMulti) { const c0 = cs[0], c1 = cs[1]; return (f, u) => [c0(f, u), c1(f, u)]; }
    return (f, u) => {
      const out = new Array(n);
      for (let i = 0; i < n - 1; i++) out[i] = cs[i](f, u);
      const v = cs[n - 1](f, u);
      if (v instanceof Multi) {
        out.length = n - 1;
        for (const x of v.v) out.push(x);
      } else out[n - 1] = v;
      return out;
    };
  }
  function store(t) {
    // returns (f, u, v) => void
    switch (t.k) {
      case 'local': {
        const s = t.info.slot;
        return t.info.captured ? (f, u, v) => { f[s].v = v; } : (f, u, v) => { f[s] = v; };
      }
      case 'up': { const i = t.idx; return (f, u, v) => { u[i].v = v; }; }
      case 'global': { const nm = t.name; return (f, u, v) => { if (v === undefined) G.delete(nm); else G.set(nm, v); }; }
      case 'index': {
        const o = cexpr(t.obj), k = cexpr(t.key), line = t.line, oe = t.obj;
        return (f, u, v) => setIndex(o(f, u), k(f, u), v, line, oe);
      }
    }
    throw E('can not assign to this', t.line);
  }
  const declareSet = (info) => {
    const s = info.slot;
    return info.captured ? (f, v) => { f[s] = { v }; } : (f, v) => { f[s] = v; };
  };

  function cblock(stats) {
    const cs = stats.map(cstat);
    const n = cs.length;
    if (n === 0) return () => undefined;
    if (n === 1) return cs[0];
    return (f, u) => {
      for (let i = 0; i < n; i++) {
        const r = cs[i](f, u);
        if (r !== undefined) return r;
      }
      return undefined;
    };
  }
  function cstat(s) {
    const line = s.line;
    switch (s.k) {
      case 'callstat': {
        const e = cexpr(s.e, true);
        return (f, u) => { e(f, u); return undefined; };
      }
      case 'local': {
        const sets = s.infos.map(declareSet);
        if (!s.exprs.length) return (f) => { for (const st of sets) st(f, undefined); return undefined; };
        if (s.infos.length === 1 && s.exprs.length === 1) {
          const e = cexpr(s.exprs[0]), st = sets[0];
          return (f, u) => { st(f, e(f, u)); return undefined; };
        }
        const vals = cargs(s.exprs);
        return (f, u) => {
          const v = vals(f, u);
          for (let i = 0; i < sets.length; i++) sets[i](f, v[i]);
          return undefined;
        };
      }
      case 'localfunc': {
        const st = declareSet(s.info), fn = cfunc(s.fn), slot = s.info.slot, cap = s.info.captured;
        return (f, u) => {
          st(f, undefined);
          const v = fn(f, u);
          if (cap) f[slot].v = v;
          else f[slot] = v;
          return undefined;
        };
      }
      case 'assign': {
        const sts = s.targets.map(store);
        if (sts.length === 1 && s.exprs.length === 1) {
          const e = cexpr(s.exprs[0]), st = sts[0];
          return (f, u) => { st(f, u, e(f, u)); return undefined; };
        }
        const vals = cargs(s.exprs);
        return (f, u) => {
          const v = vals(f, u);
          for (let i = 0; i < sts.length; i++) sts[i](f, u, v[i]);
          return undefined;
        };
      }
      case 'do': return cblock(s.body);
      case 'if': {
        const conds = s.conds.map((c) => cexpr(c)), blocks = s.blocks.map(cblock), els = s.els ? cblock(s.els) : null;
        if (conds.length === 1) {
          const c0 = conds[0], b0 = blocks[0];
          return (f, u) => (truthy(c0(f, u)) ? b0(f, u) : els ? els(f, u) : undefined);
        }
        return (f, u) => {
          for (let i = 0; i < conds.length; i++) if (truthy(conds[i](f, u))) return blocks[i](f, u);
          return els ? els(f, u) : undefined;
        };
      }
      case 'while': {
        const c = cexpr(s.cond), body = cblock(s.body);
        return (f, u) => {
          while (truthy(c(f, u))) {
            if (--R.steps < 0) out(line);
            const r = body(f, u);
            if (r !== undefined) {
              if (r === BREAK) break;
              return r;
            }
          }
          return undefined;
        };
      }
      case 'repeat': {
        const c = cexpr(s.cond), body = cblock(s.body);
        return (f, u) => {
          while (true) {
            if (--R.steps < 0) out(line);
            const r = body(f, u);
            if (r !== undefined) {
              if (r === BREAK) break;
              return r;
            }
            if (truthy(c(f, u))) break;
          }
          return undefined;
        };
      }
      case 'fornum': {
        const a = cexpr(s.start), b = cexpr(s.stop), st = s.step ? cexpr(s.step) : null, body = cblock(s.body);
        const slot = s.info.slot, cap = s.info.captured;
        return (f, u) => {
          const i0 = num(a(f, u), line, 'for start'), i1 = num(b(f, u), line, 'for end'), d = st ? num(st(f, u), line, 'for step') : 1;
          if (d === 0) rterr('a for loop step can not be 0', line);
          for (let i = i0; d > 0 ? i <= i1 : i >= i1; i += d) {
            if (--R.steps < 0) out(line);
            if (cap) f[slot] = { v: i };
            else f[slot] = i;
            const r = body(f, u);
            if (r !== undefined) {
              if (r === BREAK) break;
              return r;
            }
          }
          return undefined;
        };
      }
      case 'forin': {
        const vals = cargs(s.exprs), body = cblock(s.body), sets = s.infos.map(declareSet), n = sets.length;
        return (f, u) => {
          const v = vals(f, u);
          const it = v[0], st = v[1];
          let ctl = v[2];
          if (typeof it !== 'function') rterr(it instanceof LTable ? 'a for ... in loop needs pairs(t) or ipairs(t), not the table itself' : `tried to loop over ${kindWord(it)}`, line);
          while (true) {
            if (--R.steps < 0) out(line);
            const r0 = it(st, ctl);
            let k, rest;
            if (r0 instanceof Multi) { k = r0.v[0]; rest = r0.v; } else { k = r0; rest = null; }
            if (k === undefined || k === null) break;
            ctl = k;
            sets[0](f, k);
            for (let i = 1; i < n; i++) sets[i](f, rest ? rest[i] : undefined);
            const r = body(f, u);
            if (r !== undefined) {
              if (r === BREAK) break;
              return r;
            }
          }
          return undefined;
        };
      }
      case 'return': {
        if (!s.exprs.length) return () => new Ret(undefined);
        if (s.exprs.length === 1) {
          const e = cexpr(s.exprs[0], true);
          return (f, u) => new Ret(e(f, u));
        }
        const vals = cargs(s.exprs);
        return (f, u) => new Ret(new Multi(vals(f, u)));
      }
      case 'break': return () => BREAK;
    }
    throw E('can not compile ' + s.k, line);
  }
  function cfunc(e) {
    const body = cblock(e.body);
    const ups = e.fs.upvals.map((src) => (src.local ? { slot: src.local.slot } : { up: src.up }));
    const nup = ups.length;
    const params = e.params.map((p) => ({ slot: p.slot, cap: p.captured }));
    const np = params.length;
    const nslots = e.fs.nslots;
    const line = e.line;
    return (f, u) => {
      const up = new Array(nup);
      for (let i = 0; i < nup; i++) up[i] = ups[i].slot !== undefined ? f[ups[i].slot] : u[ups[i].up];
      return function script(...args) {
        if (++R.depth > 160) {
          R.depth--;
          throw E('too many nested calls (endless recursion?)', line);
        }
        const nf = new Array(nslots);
        for (let i = 0; i < np; i++) {
          const p = params[i];
          nf[p.slot] = p.cap ? { v: args[i] } : args[i];
        }
        try {
          const r = body(nf, up);
          return r instanceof Ret ? r.v : undefined;
        } finally {
          R.depth--;
        }
      };
    };
  }

  const main = cfunc(tree)([], []);
  return main;
}
