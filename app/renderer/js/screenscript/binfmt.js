// bin.pack / bin.unpack: numbers and text to and from byte strings (one character per byte), for custom file
// formats. Formats are a bit like Lua's string.pack:
//   < little endian (the default)   > big endian   = little endian
//   b B  8 bit signed / unsigned    h H  16 bit     i I  32 bit (i1..i4, I1..I4 for other sizes)
//   f  32 bit float                 d  64 bit float
//   s  text with a 32 bit length in front (s1, s2, s4 pick the size of the length)
//   z  text ending with a zero byte   cN  exactly N bytes of text (padded with zeros)   x  one zero byte
// Spaces are ignored. Text with characters above 255 is written as UTF-8.
import { textBytes } from './files.js';

function parse(fmt, what) {
  const out = [];
  let le = true;
  for (let i = 0; i < fmt.length; ) {
    const c = fmt[i++];
    const m = /^\d+/.exec(fmt.slice(i));
    const n = m ? +m[0] : null;
    if (m) i += m[0].length;
    switch (c) {
      case ' ': break;
      case '<': case '=': le = true; break;
      case '>': le = false; break;
      case 'b': case 'B': out.push({ k: 'int', n: 1, signed: c === 'b', le }); break;
      case 'h': case 'H': out.push({ k: 'int', n: 2, signed: c === 'h', le }); break;
      case 'i': case 'I': {
        const sz = n ?? 4;
        if (sz < 1 || sz > 4) throw new Error(`${what}: ${c}${sz} is not a size, use ${c}1 to ${c}4`);
        out.push({ k: 'int', n: sz, signed: c === 'i', le });
        break;
      }
      case 'f': out.push({ k: 'f32', n: 4, le }); break;
      case 'd': out.push({ k: 'f64', n: 8, le }); break;
      case 's': {
        const sz = n ?? 4;
        if (![1, 2, 4].includes(sz)) throw new Error(`${what}: s${sz} is not a size, use s1, s2 or s4`);
        out.push({ k: 's', n: sz, le });
        break;
      }
      case 'z': out.push({ k: 'z' }); break;
      case 'c':
        if (n === null) throw new Error(`${what}: c needs a size, like c4`);
        out.push({ k: 'c', n });
        break;
      case 'x': out.push({ k: 'x', n: 1 }); break;
      default: throw new Error(`${what}: "${c}" is not a format letter (use b B h H i I f d s z c x < >)`);
    }
    if (out.length > 4096) throw new Error(`${what}: the format is too long`);
  }
  return out;
}
const bytesOfText = (s) => {
  for (let i = 0; i < s.length; i++) if (s.charCodeAt(i) > 255) return textBytes(s);
  const u8 = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u8[i] = s.charCodeAt(i);
  return u8;
};
const byteStr = (u8) => {
  let s = '';
  for (let i = 0; i < u8.length; i += 8192) s += String.fromCharCode.apply(null, u8.subarray(i, i + 8192));
  return s;
};

/** Pack values into a byte string. */
export function packBin(fmt, vals) {
  const items = parse(fmt, 'bin.pack');
  const parts = [];
  let total = 0, vi = 0;
  const val = (it) => {
    if (vi >= vals.length) throw new Error(`bin.pack: the format needs more values (${vals.length} given)`);
    return vals[vi++];
  };
  const numVal = (it) => {
    const v = val(it);
    const x = typeof v === 'number' ? v : typeof v === 'boolean' ? (v ? 1 : 0) : typeof v === 'string' && v.trim() !== '' && !Number.isNaN(+v) ? +v : NaN;
    if (Number.isNaN(x)) throw new Error(`bin.pack: value ${vi} should be a number`);
    return x;
  };
  for (const it of items) {
    let u8;
    if (it.k === 'int' || it.k === 'f32' || it.k === 'f64') {
      const x = numVal(it);
      u8 = new Uint8Array(it.n);
      const dv = new DataView(u8.buffer);
      if (it.k === 'f32') dv.setFloat32(0, x, it.le);
      else if (it.k === 'f64') dv.setFloat64(0, x, it.le);
      else {
        const bits = it.n * 8;
        const lo = it.signed ? -(2 ** (bits - 1)) : 0, hi = it.signed ? 2 ** (bits - 1) - 1 : 2 ** bits - 1;
        const v = Math.trunc(x);
        if (v < lo || v > hi) throw new Error(`bin.pack: ${x} does not fit in ${it.signed ? 'signed' : 'unsigned'} ${bits} bits (${lo} to ${hi})`);
        let u = v < 0 ? 2 ** bits + v : v;
        for (let k = 0; k < it.n; k++) {
          u8[it.le ? k : it.n - 1 - k] = u % 256;
          u = Math.floor(u / 256);
        }
      }
    } else if (it.k === 'x') u8 = new Uint8Array(1);
    else {
      const v = val(it);
      if (typeof v !== 'string' && typeof v !== 'number') throw new Error(`bin.pack: value ${vi} should be text`);
      const b = bytesOfText(String(v));
      if (it.k === 'z') {
        if (b.includes(0)) throw new Error(`bin.pack: text for z can not have a zero byte in it`);
        u8 = new Uint8Array(b.length + 1);
        u8.set(b, 0);
      } else if (it.k === 'c') {
        if (b.length > it.n) throw new Error(`bin.pack: the text is ${b.length} bytes, longer than c${it.n}`);
        u8 = new Uint8Array(it.n);
        u8.set(b, 0);
      } else {
        if (b.length >= 2 ** (it.n * 8)) throw new Error(`bin.pack: the text is too long for s${it.n}`);
        u8 = new Uint8Array(it.n + b.length);
        let u = b.length;
        for (let k = 0; k < it.n; k++) {
          u8[it.le ? k : it.n - 1 - k] = u % 256;
          u = Math.floor(u / 256);
        }
        u8.set(b, it.n);
      }
    }
    total += u8.length;
    if (total > 1 << 20) throw new Error('bin.pack: the result would be over 1 MB');
    parts.push(u8);
  }
  const all = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    all.set(p, o);
    o += p.length;
  }
  return byteStr(all);
}

/** Unpack a byte string: [values..., next position] (positions from 1, like Lua). */
export function unpackBin(fmt, s, pos = 1) {
  const items = parse(fmt, 'bin.unpack');
  let i = Math.max(0, Math.floor(pos) - 1);
  const out = [];
  const need = (n) => {
    if (i + n > s.length) throw new Error(`bin.unpack: the data ends at byte ${s.length}, the format needs ${n} more at byte ${i + 1}`);
  };
  const byte = (k) => s.charCodeAt(k) & 255;
  const uint = (n, le) => {
    let u = 0;
    for (let k = 0; k < n; k++) u += byte(i + (le ? k : n - 1 - k)) * 2 ** (8 * k);
    return u;
  };
  for (const it of items) {
    if (it.k === 'int') {
      need(it.n);
      let u = uint(it.n, it.le);
      if (it.signed && u >= 2 ** (it.n * 8 - 1)) u -= 2 ** (it.n * 8);
      out.push(u);
      i += it.n;
    } else if (it.k === 'f32' || it.k === 'f64') {
      need(it.n);
      const dv = new DataView(new ArrayBuffer(it.n));
      for (let k = 0; k < it.n; k++) dv.setUint8(k, byte(i + k));
      out.push(it.k === 'f32' ? dv.getFloat32(0, it.le) : dv.getFloat64(0, it.le));
      i += it.n;
    } else if (it.k === 'x') {
      need(1);
      i += 1;
    } else if (it.k === 'c') {
      need(it.n);
      out.push(s.slice(i, i + it.n));
      i += it.n;
    } else if (it.k === 'z') {
      const e = s.indexOf('\u0000', i);
      if (e < 0) throw new Error(`bin.unpack: no zero byte after byte ${i + 1} to end the text`);
      out.push(s.slice(i, e));
      i = e + 1;
    } else {
      need(it.n);
      const len = uint(it.n, it.le);
      i += it.n;
      need(len);
      out.push(s.slice(i, i + len));
      i += len;
    }
  }
  out.push(i + 1);
  return out;
}

/** Bytes a format takes (text formats s and z have no fixed size). */
export function sizeBin(fmt) {
  let n = 0;
  for (const it of parse(fmt, 'bin.size')) {
    if (it.k === 's' || it.k === 'z') throw new Error('bin.size: s and z have no fixed size');
    n += it.n;
  }
  return n;
}
