#!/usr/bin/env node
// Decode a dev feedback string (Ctrl+Shift+K in the app, see renderer/js/devfeedback.js).
// Usage: node scripts/feedback-decode.js <TZFB1:... string | file with it> [out dir]
// Prints the payload as JSON (images replaced by a note) and writes any screenshots into the out dir
// (default: the system temp dir), printing their paths.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');

function decode(str) {
  const m = String(str).replace(/\s+/g, '').match(/TZFB(\d+):([A-Za-z0-9_-]+)/);
  if (!m) throw new Error('no TZFB string found');
  const raw = Buffer.from(m[2].replace(/-/g, '+').replace(/_/g, '/'), 'base64');
  return JSON.parse(zlib.inflateSync(raw).toString('utf8'));
}

// width / height from webp, jpeg or png bytes
function imageSize(b) {
  if (b.slice(0, 4).toString() === 'RIFF' && b.slice(8, 12).toString() === 'WEBP') {
    const k = b.slice(12, 16).toString();
    if (k === 'VP8 ') return { f: 'webp', w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff };
    if (k === 'VP8L') {
      const v = b.readUInt32LE(21);
      return { f: 'webp', w: (v & 0x3fff) + 1, h: ((v >> 14) & 0x3fff) + 1 };
    }
    if (k === 'VP8X') return { f: 'webp', w: 1 + b.readUIntLE(24, 3), h: 1 + b.readUIntLE(27, 3) };
  }
  if (b[0] === 0x89 && b.slice(1, 4).toString() === 'PNG') return { f: 'png', w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
  if (b[0] === 0xff && b[1] === 0xd8) {
    for (let i = 2; i < b.length - 9; ) {
      if (b[i] !== 0xff) { i++; continue; }
      const t = b[i + 1];
      if (t >= 0xc0 && t <= 0xcf && t !== 0xc4 && t !== 0xc8 && t !== 0xcc) return { f: 'jpg', h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7) };
      i += 2 + b.readUInt16BE(i + 2);
    }
  }
  return null;
}

// pull images out of the payload: returns [{ key, buf, size }] and replaces their data with a short note
function extractImages(p) {
  const out = [];
  const take = (holder, key, name) => {
    const img = holder && holder[key];
    if (!img || !img.d) return;
    const buf = Buffer.from(img.d, 'base64');
    out.push({ name, img, buf, size: imageSize(buf) });
    img.d = `<${img.f} ${img.w}x${img.h}, ${(buf.length / 1024).toFixed(1)} KB>`;
  };
  take(p.ar, 'img', 'area');
  take(p, 'th', 'thumb');
  return out;
}

module.exports = { decode, imageSize, extractImages };

if (require.main === module) {
  const arg = process.argv[2];
  if (!arg) {
    console.error('usage: node scripts/feedback-decode.js <TZFB1:... | file> [out dir]');
    process.exit(1);
  }
  const text = !arg.startsWith('TZFB') && fs.existsSync(arg) ? fs.readFileSync(arg, 'utf8') : arg;
  let p;
  try {
    p = decode(text);
  } catch (e) {
    console.error('could not decode: ' + e.message);
    process.exit(1);
  }
  const imgs = extractImages(p);
  const dir = process.argv[3] || os.tmpdir();
  fs.mkdirSync(dir, { recursive: true });
  const stamp = (p.t || new Date().toISOString()).replace(/[:.]/g, '-');
  // one line per key, one line per element: easy to read, easy to grep
  const { els, ...top } = p;
  console.log('{');
  for (const [k, v] of Object.entries(top)) console.log(`  "${k}": ${JSON.stringify(v)},`);
  if (els) {
    console.log('  "els": [');
    for (const e of els) console.log('    ' + JSON.stringify(e) + ',');
    console.log('  ]');
  }
  console.log('}');
  for (const im of imgs) {
    const f = path.join(dir, `tzfb-${stamp}-${im.name}.${im.img.f === 'jpg' ? 'jpg' : 'webp'}`);
    fs.writeFileSync(f, im.buf);
    console.log(`${im.name} image: ${f} (${im.size ? im.size.w + 'x' + im.size.h : '?'})`);
  }
}
