// The pedal's file store: code files (modules for require) and data files that screen scripts read and write.
// All screens of a pedal share one store, with a budget of 1 MB for everything (the screens' own code, code
// files and data files together).
//
// Where files live:
//   * D.files (the design) holds the files made in the code editor: code files and any starting data. They are
//     saved with the design and with the saved custom block. Code always comes from here.
//   * A board block keeps what its scripts write in block.params._fs (saved with the preset), on top of the
//     design's files. So user presets saved on a pedal stay with that pedal, and a new version of the design
//     still brings its new code. A file a script writes over a design file hides it for that block only.
//   * The factory preview and test mode write to a sandbox kept in memory for the session (the code editor
//     shows those files and can keep them in the design).
// Stored form (D.files and _fs): { "path": "utf-8 text" | { b64: "..." } | null (removed, _fs only), "dir/": true }.

export const FILE_BUDGET = 1024 * 1024;
export const MAX_FILES = 256;
export const MAX_PATH = 160;

const enc = new TextEncoder();
const dec = new TextDecoder('utf-8');
const strict = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }); // keeps a leading BOM, so text round trips
export const textBytes = (s) => enc.encode(String(s));
export const bytesText = (u8) => dec.decode(u8);
/** Bytes as a "byte string": one character (code 0 to 255) per byte, the way Lua strings hold binary data. */
export function bytesBin(u8) {
  let s = '';
  for (let i = 0; i < u8.length; i += 8192) s += String.fromCharCode.apply(null, u8.subarray(i, i + 8192));
  return s;
}
export function binBytes(s, what = 'fs.writeBytes') {
  const u8 = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c > 255) throw new Error(`${what}: that is text, not bytes (character ${i + 1} is "${s[i]}"). Use fs.write for text`);
    u8[i] = c;
  }
  return u8;
}
export function fmtBytes(n) {
  if (n < 1024) return n + ' bytes';
  if (n < 1024 * 1024) return (n < 10240 ? Math.floor(n / 102.4) / 10 : Math.floor(n / 1024)) + ' KB';
  return (Math.floor(n / 10485.76) / 100).toFixed(2) + ' MB';
}

// ------------------------------------------------------------------ paths
const SEG = /^[A-Za-z0-9_\-][A-Za-z0-9_.\- ]*$/;
/** A clean relative path, or throws an Error that says what is wrong. dir: an empty path means the top. */
export function checkPath(p, what = 'fs', dir = false) {
  if (typeof p !== 'string' && typeof p !== 'number') throw new Error(`${what}: the path should be text like "presets/a.txt"`);
  let s = String(p).trim();
  if (dir && (s === '' || s === '/' || s === '.')) return '';
  if (s.includes('\\')) throw new Error(`${what}: use / between folders, not \\ ("${s}")`);
  if (s.startsWith('/')) throw new Error(`${what}: paths start inside the pedal's files: "${s.replace(/^\/+/, '')}", not "${s}"`);
  if (dir) s = s.replace(/\/+$/, '');
  if (!s) throw new Error(`${what}: the path is empty`);
  if (s.length > MAX_PATH) throw new Error(`${what}: the path is too long (more than ${MAX_PATH} characters)`);
  const segs = s.split('/');
  if (segs.length > 6) throw new Error(`${what}: too many folders in "${s}" (6 at most)`);
  for (const g of segs) {
    if (g === '..' || g === '.') throw new Error(`${what}: ".." and "." are not allowed in paths ("${s}"): a script only sees its pedal's own files`);
    if (!g) throw new Error(`${what}: "${s}" has an empty folder name (two / in a row, or one at the end)`);
    if (g.length > 48) throw new Error(`${what}: the name "${g.slice(0, 20)}..." is too long (48 characters at most)`);
    if (!SEG.test(g) || /[. ]$/.test(g)) throw new Error(`${what}: "${g}" is not a good name. Use letters, digits, space, _ - and ., not starting with . or ending with a space or .`);
  }
  return s;
}
export const isCode = (p) => /\.lua$/i.test(p);

// ------------------------------------------------------------------ stored form
function b64(u8) {
  if (typeof btoa === 'function') return btoa(bytesBin(u8));
  return Buffer.from(u8).toString('base64');
}
function unb64(s) {
  if (typeof atob === 'function') return binBytes(atob(s), 'files');
  return new Uint8Array(Buffer.from(s, 'base64'));
}
export function fromStored(v) {
  if (typeof v === 'string') return textBytes(v);
  if (v && typeof v.b64 === 'string') {
    try {
      return unb64(v.b64);
    } catch (_) {
      return new Uint8Array(0);
    }
  }
  return null;
}
/** Text when the bytes are UTF-8 (easy to read in a saved file), else base64. */
export function toStored(u8) {
  try {
    return strict.decode(u8);
  } catch (_) {
    return { b64: b64(u8) };
  }
}
/** The text of a stored file (code files), or null. */
export function storedText(v) {
  if (typeof v === 'string') return v;
  const u8 = fromStored(v);
  return u8 ? bytesText(u8) : null;
}

/** Bytes taken by the screens' own code (it counts toward the budget too). */
export function mainBytes(D) {
  let n = 0;
  for (const c of (D && D.ctls) || []) if (c && c.kind === 'screen' && c.shows === 'custom' && c.script) n += textBytes(c.script).length;
  return n;
}
/** Code files of a design: [{ path, text }]. */
export function codeFiles(D) {
  const F = (D && D.files) || {};
  return Object.keys(F).filter((p) => isCode(p) && F[p] !== null && F[p] !== true).sort().map((p) => ({ path: p, text: storedText(F[p]) || '' }));
}
/** The code file for require(name): "util", "util.lua", "lib/util" or "lib.util" -> its path, or null. */
export function resolveModule(D, name) {
  const F = (D && D.files) || {};
  const n = String(name).trim();
  const tries = /\.lua$/i.test(n) ? [n] : [n + '.lua', n.replace(/\./g, '/') + '.lua'];
  for (const t of tries) if (typeof F[t] === 'string' || (F[t] && F[t].b64)) return t;
  return null;
}
// a short hash of a design's code files, so running screens restart when one changes
function hash(s, h = 2166136261) {
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
/** What a screen runs: its own code and the design's code files (screens restart when this changes). */
export function codeSig(c, D) {
  const src = (c && c.script) || '';
  const F = D && D.files;
  if (!F) return src;
  let h = 2166136261;
  for (const p of Object.keys(F).sort()) if (isCode(p)) h = hash(p + '\u0001' + (storedText(F[p]) || ''), h);
  return src + '\u0000' + h.toString(36);
}

// ------------------------------------------------------------------ the store
/**
 * o = { base() -> stored files (read only here, may be null), overlay (stored object this store writes),
 *       fixed() -> bytes used elsewhere (the screens' code), save(overlay) (debounced), readOnly, delay (ms) }
 */
export class FileStore {
  constructor(o = {}) {
    this.o = o;
    this.over = o.overlay || {};
    this.cache = new Map(); // path -> { v, u8 }
    this.timer = null;
    this.dirty = false;
    this.serial = 0; // counts changes (the editor repaints its list)
  }
  baseObj() {
    try {
      return (this.o.base && this.o.base()) || {};
    } catch (_) {
      return {};
    }
  }
  /** Swap the overlay (a preset load on the board brings other files). */
  setOverlay(obj) {
    this.over = obj || {};
    this.cache.clear();
    this.serial++;
  }
  stored(p) {
    if (Object.prototype.hasOwnProperty.call(this.over, p)) return this.over[p];
    const B = this.baseObj();
    return Object.prototype.hasOwnProperty.call(B, p) ? B[p] : undefined;
  }
  bytes(p) {
    const v = this.stored(p);
    if (v === undefined || v === null || v === true) return null;
    const c = this.cache.get(p);
    if (c && c.v === v) return c.u8;
    const u8 = fromStored(v);
    if (!u8) return null;
    this.cache.set(p, { v, u8 });
    return u8;
  }
  /** Every file path (no folders), sorted. */
  paths() {
    const all = new Set([...Object.keys(this.baseObj()), ...Object.keys(this.over)]);
    return [...all].filter((p) => !p.endsWith('/') && this.bytes(p) !== null).sort();
  }
  dirs() {
    const out = new Set();
    const all = new Set([...Object.keys(this.baseObj()), ...Object.keys(this.over)]);
    for (const k of all) if (k.endsWith('/') && this.stored(k) === true) out.add(k.slice(0, -1));
    for (const p of this.paths()) {
      const segs = p.split('/');
      for (let i = 1; i < segs.length; i++) out.add(segs.slice(0, i).join('/'));
    }
    return out;
  }
  has(p) {
    return this.bytes(p) !== null;
  }
  isDir(p) {
    return p === '' || this.dirs().has(p);
  }
  size(p) {
    const u8 = this.bytes(p);
    return u8 ? u8.length : null;
  }
  fixed() {
    try {
      return (this.o.fixed && this.o.fixed()) || 0;
    } catch (_) {
      return 0;
    }
  }
  used() {
    let n = this.fixed();
    for (const p of this.paths()) n += this.bytes(p).length;
    return n;
  }
  free() {
    return Math.max(0, FILE_BUDGET - this.used());
  }
  read(p) {
    return this.bytes(p);
  }
  /** Write bytes (a Uint8Array). what names the call in errors. */
  write(p, u8, what = 'fs.write') {
    if (this.o.readOnly) throw new Error(`${what}: files can not be written here`);
    if (this.isDir(p)) throw new Error(`${what}: "${p}" is a folder`);
    const segs = p.split('/');
    for (let i = 1; i < segs.length; i++) if (this.has(segs.slice(0, i).join('/'))) throw new Error(`${what}: "${segs.slice(0, i).join('/')}" is a file, not a folder`);
    const old = this.size(p);
    if (old === null && this.paths().length >= MAX_FILES) throw new Error(`${what}: a pedal can have ${MAX_FILES} files at most`);
    const used = this.used() - (old || 0) + u8.length;
    if (used > FILE_BUDGET) {
      const left = Math.max(0, FILE_BUDGET - (this.used() - (old || 0)));
      throw new Error(`${what}: not enough room for "${p}" (${fmtBytes(u8.length)}). The pedal's files can use 1 MB together and ${fmtBytes(left)} is left. Remove files with fs.remove to make room`);
    }
    const v = toStored(u8);
    this.over[p] = v;
    this.cache.set(p, { v, u8 });
    this.changed();
    return true;
  }
  append(p, u8, what = 'fs.append') {
    const old = this.bytes(p);
    if (!old) return this.write(p, u8, what);
    const n = new Uint8Array(old.length + u8.length);
    n.set(old, 0);
    n.set(u8, old.length);
    return this.write(p, n, what);
  }
  remove(p, what = 'fs.remove') {
    if (this.o.readOnly) throw new Error(`${what}: files can not be changed here`);
    if (this.has(p)) {
      this.drop(p);
      this.changed();
      return true;
    }
    if (p && this.isDir(p)) {
      if (this.paths().some((x) => x.startsWith(p + '/'))) throw new Error(`${what}: the folder "${p}" is not empty`);
      this.drop(p + '/');
      this.changed();
      return true;
    }
    return false;
  }
  drop(k) {
    if (Object.prototype.hasOwnProperty.call(this.baseObj(), k)) this.over[k] = null;
    else delete this.over[k];
    this.cache.delete(k);
  }
  mkdir(p, what = 'fs.mkdir') {
    if (this.o.readOnly) throw new Error(`${what}: files can not be changed here`);
    if (this.has(p)) throw new Error(`${what}: "${p}" is a file`);
    if (this.isDir(p)) return true;
    this.over[p + '/'] = true;
    this.changed();
    return true;
  }
  rename(a, b, what = 'fs.rename') {
    const u8 = this.bytes(a);
    if (!u8) throw new Error(`${what}: there is no file "${a}"`);
    if (a === b) return true;
    if (this.has(b)) throw new Error(`${what}: "${b}" is already there`);
    this.drop(a);
    try {
      this.write(b, u8, what);
    } catch (e) {
      this.over[a] = toStored(u8);
      throw e;
    }
    return true;
  }
  /** Names in a folder: files, then folders with a / at the end. */
  list(dir) {
    const pre = dir ? dir + '/' : '';
    const files = new Set(), folders = new Set();
    for (const p of this.paths()) {
      if (!p.startsWith(pre)) continue;
      const rest = p.slice(pre.length);
      const i = rest.indexOf('/');
      if (i < 0) files.add(rest);
      else folders.add(rest.slice(0, i) + '/');
    }
    for (const d of this.dirs()) {
      if (!d.startsWith(pre) || d === dir) continue;
      const rest = d.slice(pre.length);
      if (rest && !rest.includes('/')) folders.add(rest + '/');
    }
    return [...[...files].sort(), ...[...folders].sort()];
  }
  changed() {
    this.serial++;
    this.dirty = true;
    if (!this.o.save) return;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), this.o.delay ?? 600);
  }
  /** Save now (a debounced save is pending after writes). */
  flush() {
    clearTimeout(this.timer);
    this.timer = null;
    if (!this.dirty) return;
    this.dirty = false;
    try {
      if (this.o.save) this.o.save(this.over);
    } catch (_) {
      /* saving is best effort, the files stay in memory */
    }
  }
}

// one sandbox per design for the factory preview and test mode (memory only)
const sandboxes = new WeakMap();
export function sandboxStore(D) {
  if (!D || typeof D !== 'object') return new FileStore({ base: () => null, fixed: () => 0 });
  let s = sandboxes.get(D);
  if (!s) {
    s = new FileStore({ base: () => D.files || null, fixed: () => mainBytes(D) });
    sandboxes.set(D, s);
  }
  return s;
}
/** A throwaway store over a design's files (stills and thumbnails: writes work and are forgotten). */
export function scratchStore(D) {
  return new FileStore({ base: () => (D && D.files) || null, fixed: () => mainBytes(D) });
}
/** The design's own files, for the code editor (writes go straight into D.files). */
export function designStore(D, onSave) {
  if (!D.files) D.files = {};
  return new FileStore({ base: () => null, overlay: D.files, fixed: () => mainBytes(D), save: onSave, delay: 0 });
}
