// The standard library of ScreenScript: the parts of Lua's base, math, string and table libraries that a
// screen needs, plus a few friendly extras (math.clamp, math.lerp, string.split...).
import { LTable, Multi, ScriptError, tostr, tonum, typeOf, truthy, first } from './lang.js';

const MAX_REP = 1 << 18;
const argNum = (v, fn, i) => {
  const n = typeof v === 'number' ? v : tonum(v);
  if (n === undefined) throw new Error(`${fn}: argument ${i} should be a number, got ${typeOf(v)}`);
  return n;
};
const argStr = (v, fn, i) => {
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return tostr(v);
  throw new Error(`${fn}: argument ${i} should be a string, got ${typeOf(v)}`);
};
const argTable = (v, fn, i) => {
  if (!(v instanceof LTable)) throw new Error(`${fn}: argument ${i} should be a table, got ${typeOf(v)}`);
  return v;
};

// Lua style string index: 1 based, negative from the end
const sIdx = (i, n) => (i < 0 ? Math.max(0, n + i) : Math.max(0, i - 1));

function format(fmt, ...args) {
  let ai = 0;
  return argStr(fmt, 'string.format', 1).replace(/%([-+ 0#]*)(\d*)(?:\.(\d+))?([dioxXfFeEgGsqc%])/g, (m, flags, width, prec, conv) => {
    if (conv === '%') return '%';
    const v = args[ai++];
    let s;
    switch (conv) {
      case 'd': case 'i': s = String(Math.trunc(argNum(v, 'string.format', ai + 1))); break;
      case 'o': s = Math.trunc(argNum(v, 'string.format', ai + 1)).toString(8); break;
      case 'x': s = Math.trunc(argNum(v, 'string.format', ai + 1)).toString(16); break;
      case 'X': s = Math.trunc(argNum(v, 'string.format', ai + 1)).toString(16).toUpperCase(); break;
      case 'f': case 'F': s = argNum(v, 'string.format', ai + 1).toFixed(prec !== undefined ? +prec : 6); break;
      case 'e': case 'E': s = argNum(v, 'string.format', ai + 1).toExponential(prec !== undefined ? +prec : 6); if (conv === 'E') s = s.toUpperCase(); break;
      case 'g': case 'G': s = String(+argNum(v, 'string.format', ai + 1).toPrecision(prec !== undefined ? Math.max(1, +prec) : 6)); break;
      case 'c': s = String.fromCharCode(argNum(v, 'string.format', ai + 1)); break;
      case 'q': s = JSON.stringify(tostr(v)); break;
      default: s = tostr(v); if (prec !== undefined) s = s.slice(0, +prec);
    }
    if (flags.includes('+') && /[dif]/i.test(conv) && !s.startsWith('-')) s = '+' + s;
    const w = +width || 0;
    if (s.length < w) {
      if (flags.includes('-')) s = s.padEnd(w);
      else if (flags.includes('0') && /[dioxXfFeEgG]/.test(conv)) s = s.startsWith('-') || s.startsWith('+') ? s[0] + s.slice(1).padStart(w - 1, '0') : s.padStart(w, '0');
      else s = s.padStart(w);
    }
    return s;
  });
}

export function makeTable(o) {
  const t = new LTable();
  if (Array.isArray(o)) o.forEach((v, i) => t.set(i + 1, toScript(v)));
  else if (o) for (const k of Object.keys(o)) t.set(k, toScript(o[k]));
  return t;
}
// JS value -> script value (plain data only)
export function toScript(v) {
  if (v === null || v === undefined) return undefined;
  if (typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean') return v;
  if (v instanceof LTable) return v;
  if (Array.isArray(v) || typeof v === 'object') return makeTable(v);
  return undefined;
}
// script value -> JSON friendly JS value
export function toJS(v, depth = 0) {
  if (v instanceof LTable) {
    if (depth > 12) return null;
    const n = v.len();
    const keys = v.keys();
    if (keys.length === n) return v.a.map((x) => toJS(x, depth + 1));
    const o = {};
    for (const k of keys) {
      const x = v.get(k);
      if (typeof x !== 'function') o[String(k)] = toJS(x, depth + 1);
    }
    return o;
  }
  if (typeof v === 'function') return null;
  return v === undefined ? null : v;
}

function sortTable(t, cmp) {
  const a = t.a.slice();
  let err = null;
  const f = cmp
    ? (x, y) => {
        if (err) return 0;
        try {
          return truthy(first(cmp(x, y))) ? -1 : truthy(first(cmp(y, x))) ? 1 : 0;
        } catch (e) {
          err = e;
          return 0;
        }
      }
    : (x, y) => {
        if (typeof x !== typeof y || (typeof x !== 'number' && typeof x !== 'string')) {
          err = new Error('table.sort: can not compare ' + typeOf(x) + ' with ' + typeOf(y));
          return 0;
        }
        return x < y ? -1 : x > y ? 1 : 0;
      };
  a.sort(f);
  if (err) throw err;
  for (let i = 0; i < a.length; i++) t.a[i] = a[i];
}

/** Install the standard library into a globals Map. R is the run state (for pcall and the budget). */
export function installStdlib(G, R, log) {
  const set = (k, v) => G.set(k, v);
  set('print', (...a) => { log(a.map(tostr).join('  ')); });
  set('type', (v) => typeOf(v));
  set('tostring', (v) => tostr(v));
  set('tonumber', (v, base) => {
    if (base !== undefined && typeof v === 'string') {
      const n = parseInt(v, base);
      return Number.isNaN(n) ? undefined : n;
    }
    return tonum(v);
  });
  const iterPairs = (t) => {
    const keys = t.keys();
    let i = 0;
    return () => {
      while (i < keys.length) {
        const k = keys[i++];
        const v = t.get(k);
        if (v !== undefined) return new Multi([k, v]);
      }
      return undefined;
    };
  };
  set('pairs', (t) => new Multi([iterPairs(argTable(t, 'pairs', 1)), t, undefined]));
  set('ipairs', (t) => {
    argTable(t, 'ipairs', 1);
    let i = 0;
    return new Multi([() => {
      i++;
      const v = t.get(i);
      return v === undefined ? undefined : new Multi([i, v]);
    }, t, 0]);
  });
  set('next', (t, k) => {
    argTable(t, 'next', 1);
    const keys = t.keys();
    const i = k === undefined ? 0 : keys.indexOf(k) + 1;
    if (i <= 0 && k !== undefined) return undefined;
    const nk = keys[i];
    return nk === undefined ? undefined : new Multi([nk, t.get(nk)]);
  });
  set('unpack', (t, i = 1, j) => {
    argTable(t, 'unpack', 1);
    const e = j ?? t.len();
    const out = [];
    for (let k = i; k <= e && out.length < 4096; k++) out.push(t.get(k));
    return new Multi(out);
  });
  set('select', (n, ...a) => {
    if (n === '#') return a.length;
    const i = argNum(n, 'select', 1);
    return new Multi(i < 0 ? a.slice(a.length + i) : a.slice(i - 1));
  });
  set('error', (msg) => {
    throw new ScriptError(tostr(msg));
  });
  set('assert', (v, msg) => {
    if (!truthy(v)) throw new ScriptError(msg !== undefined ? tostr(msg) : 'assertion failed');
    return v;
  });
  set('pcall', (fn, ...a) => {
    const depth = R.depth;
    try {
      const r = typeof fn === 'function' ? fn(...a) : (() => { throw new ScriptError('pcall: not a function'); })();
      return new Multi([true, ...(r instanceof Multi ? r.v : [r])]);
    } catch (e) {
      R.depth = depth;
      if (e instanceof ScriptError && e.kind === 'budget') throw e; // a runaway loop is never caught
      return new Multi([false, e instanceof ScriptError && e.line ? `line ${e.line}: ${e.message}` : String(e.message || e)]);
    }
  });
  set('rawequal', (a, b) => a === b);
  set('rawget', (t, k) => argTable(t, 'rawget', 1).get(k));
  set('rawset', (t, k, v) => { argTable(t, 'rawset', 1).set(k, v); return t; });
  set('rawlen', (t) => (typeof t === 'string' ? t.length : argTable(t, 'rawlen', 1).len()));

  // ---- math
  const M = new LTable();
  const mfn = {
    abs: Math.abs, ceil: Math.ceil, floor: Math.floor, sqrt: Math.sqrt, sin: Math.sin, cos: Math.cos, tan: Math.tan,
    asin: Math.asin, acos: Math.acos, exp: Math.exp,
    atan: (y, x) => (x === undefined ? Math.atan(y) : Math.atan2(y, x)),
    log: (x, b) => (b === undefined ? Math.log(x) : Math.log(x) / Math.log(b)),
    pow: Math.pow,
    min: (...a) => { if (!a.length) throw new Error('math.min needs a number'); return Math.min(...a.map((v, i) => argNum(v, 'math.min', i + 1))); },
    max: (...a) => { if (!a.length) throw new Error('math.max needs a number'); return Math.max(...a.map((v, i) => argNum(v, 'math.max', i + 1))); },
    fmod: (a, b) => a % b,
    modf: (x) => new Multi([Math.trunc(x), x - Math.trunc(x)]),
    random: (m, n) => {
      if (m === undefined) return Math.random();
      if (n === undefined) return 1 + Math.floor(Math.random() * argNum(m, 'math.random', 1));
      return m + Math.floor(Math.random() * (n - m + 1));
    },
    randomseed: () => undefined,
    tointeger: (x) => (Number.isInteger(x) ? x : undefined),
    type: (x) => (typeof x !== 'number' ? undefined : Number.isInteger(x) ? 'integer' : 'float'),
    // extras
    clamp: (v, a = 0, b = 1) => Math.min(b, Math.max(a, argNum(v, 'math.clamp', 1))),
    lerp: (a, b, t) => a + (b - a) * t,
    round: (x, d = 0) => { const k = Math.pow(10, d); return Math.round(x * k) / k; },
    map: (v, a, b, c, d) => c + ((v - a) * (d - c)) / ((b - a) || 1),
    sign: (x) => Math.sign(x),
  };
  for (const k in mfn) {
    const f = mfn[k];
    M.set(k, (...a) => f(...a));
  }
  M.set('pi', Math.PI);
  M.set('huge', Infinity);
  M.set('maxinteger', Number.MAX_SAFE_INTEGER);
  M.set('mininteger', Number.MIN_SAFE_INTEGER);
  set('math', M);

  // ---- string (also reachable as s:method())
  const S = new LTable();
  const sfn = {
    len: (s) => argStr(s, 'string.len', 1).length,
    sub: (s, i = 1, j = -1) => {
      s = argStr(s, 'string.sub', 1);
      const n = s.length;
      const a = sIdx(argNum(i, 'string.sub', 2), n);
      const b = j < 0 ? n + j + 1 : Math.min(n, j);
      return b > a ? s.slice(a, b) : '';
    },
    upper: (s) => argStr(s, 'string.upper', 1).toUpperCase(),
    lower: (s) => argStr(s, 'string.lower', 1).toLowerCase(),
    rep: (s, n, sep = '') => {
      s = argStr(s, 'string.rep', 1);
      n = Math.max(0, Math.floor(argNum(n, 'string.rep', 2)));
      if ((s.length + sep.length) * n > MAX_REP) throw new Error('string.rep: the result would be too long');
      return Array(n).fill(s).join(sep);
    },
    reverse: (s) => [...argStr(s, 'string.reverse', 1)].reverse().join(''),
    byte: (s, i = 1, j) => {
      s = argStr(s, 'string.byte', 1);
      const a = sIdx(i, s.length), b = j === undefined ? a + 1 : j < 0 ? s.length + j + 1 : j;
      const out = [];
      for (let k = a; k < b && k < s.length; k++) out.push(s.charCodeAt(k));
      return new Multi(out);
    },
    char: (...a) => String.fromCharCode(...a.map((v, i) => argNum(v, 'string.char', i + 1))),
    format,
    // plain text search (Lua patterns are not supported: the text is matched as is)
    find: (s, sub, init = 1) => {
      s = argStr(s, 'string.find', 1);
      sub = argStr(sub, 'string.find', 2);
      const i = s.indexOf(sub, sIdx(init, s.length));
      return i < 0 ? undefined : new Multi([i + 1, i + sub.length]);
    },
    match: (s, sub) => {
      s = argStr(s, 'string.match', 1);
      sub = argStr(sub, 'string.match', 2);
      return s.includes(sub) ? sub : undefined;
    },
    gsub: (s, from, to) => {
      s = argStr(s, 'string.gsub', 1);
      from = argStr(from, 'string.gsub', 2);
      if (!from) return new Multi([s, 0]);
      const parts = s.split(from);
      return new Multi([parts.join(argStr(to, 'string.gsub', 3)), parts.length - 1]);
    },
    // extras
    split: (s, sep = ',') => makeTable(argStr(s, 'string.split', 1).split(argStr(sep, 'string.split', 2))),
    trim: (s) => argStr(s, 'string.trim', 1).trim(),
    startsWith: (s, p) => argStr(s, 'string.startsWith', 1).startsWith(argStr(p, 'string.startsWith', 2)),
    endsWith: (s, p) => argStr(s, 'string.endsWith', 1).endsWith(argStr(p, 'string.endsWith', 2)),
    pad: (s, n, ch = ' ') => tostr(s).padStart(n, ch),
  };
  for (const k in sfn) S.set(k, sfn[k]);
  set('string', S);
  R.strlib = new Map(Object.entries(sfn));

  // ---- table
  const T = new LTable();
  T.set('insert', (t, a, b) => {
    argTable(t, 'table.insert', 1);
    if (b === undefined) t.set(t.len() + 1, a);
    else {
      const pos = argNum(a, 'table.insert', 2), n = t.len();
      if (pos < 1 || pos > n + 1) throw new Error('table.insert: position out of range');
      t.a.splice(pos - 1, 0, b);
    }
  });
  T.set('remove', (t, pos) => {
    argTable(t, 'table.remove', 1);
    const n = t.len();
    if (!n) return undefined;
    const p = pos === undefined ? n : argNum(pos, 'table.remove', 2);
    if (p < 1 || p > n) return undefined;
    const v = t.a.splice(p - 1, 1)[0];
    while (t.a.length && t.a[t.a.length - 1] === undefined) t.a.pop();
    return v;
  });
  T.set('concat', (t, sep = '', i = 1, j) => {
    argTable(t, 'table.concat', 1);
    const e = j ?? t.len();
    const out = [];
    for (let k = i; k <= e; k++) out.push(tostr(t.get(k)));
    return out.join(tostr(sep));
  });
  T.set('sort', (t, cmp) => { sortTable(argTable(t, 'table.sort', 1), cmp); });
  T.set('unpack', G.get('unpack'));
  T.set('count', (t) => argTable(t, 'table.count', 1).keys().length);
  T.set('contains', (t, v) => argTable(t, 'table.contains', 1).keys().some((k) => t.get(k) === v));
  set('table', T);
}
