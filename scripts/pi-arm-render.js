#!/usr/bin/env node
// Renders the same graphs offline with the x86 engine and the aarch64 engine (under qemu-user when the host is not
// ARM) and compares the output. Proves the Pi build (NAM, IRs, all main block types) produces the same sound.
//   node scripts/pi-arm-render.js [x86-engine] [arm-engine]
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const X86 = process.argv[2] || [path.join(ROOT, 'engine/dist/tonezone-engine-v2'), path.join(ROOT, 'engine/build/tonezone-engine')].find((p) => fs.existsSync(p));
const ARM = process.argv[3] || path.join(ROOT, 'engine/dist-pi/tonezone-engine-arm64');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'tz-arm-'));
const onArm = process.arch === 'arm64';
const SYSROOT = process.env.TZ_QEMU_SYSROOT || '/usr/aarch64-linux-gnu';

function writeWav(file, chans, sr = 48000) {
  const n = chans[0].length, ch = chans.length;
  const buf = Buffer.alloc(44 + n * ch * 4);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * ch * 4, 4); buf.write('WAVE', 8); buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(3, 20); buf.writeUInt16LE(ch, 22); buf.writeUInt32LE(sr, 24);
  buf.writeUInt32LE(sr * ch * 4, 28); buf.writeUInt16LE(ch * 4, 32); buf.writeUInt16LE(32, 34); buf.write('data', 36); buf.writeUInt32LE(n * ch * 4, 40);
  let o = 44;
  for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) { buf.writeFloatLE(chans[c][i] || 0, o); o += 4; }
  fs.writeFileSync(file, buf);
}
function readWav(file) {
  const b = fs.readFileSync(file);
  let pos = 12, ch = 1, data = null;
  while (pos + 8 <= b.length) {
    const id = b.toString('ascii', pos, pos + 4), len = b.readUInt32LE(pos + 4);
    if (id === 'fmt ') ch = b.readUInt16LE(pos + 10);
    if (id === 'data') { data = b.subarray(pos + 8, pos + 8 + len); break; }
    pos += 8 + len + (len & 1);
  }
  const n = data.length / 4 / ch, out = [];
  for (let c = 0; c < ch; c++) out.push(new Float32Array(n));
  for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) out[c][i] = data.readFloatLE((i * ch + c) * 4);
  return out;
}

// plucked notes (Karplus-Strong), 4 s
function guitar(sr = 48000) {
  const out = new Float32Array(sr * 4);
  let seed = 1;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff) * 2 - 1;
  [82.41, 110, 146.83, 196, 246.94, 329.63, 110, 82.41].forEach((f, k) => {
    const N = Math.round(sr / f), buf = new Float32Array(N).map(() => rnd() * 0.3);
    const start = Math.round(k * sr * 0.45);
    for (let i = 0, j = 0; start + i < out.length && i < sr * 1.5; i++, j = (j + 1) % N) {
      out[start + i] += buf[j];
      buf[j] = 0.996 * 0.5 * (buf[j] + buf[(j + 1) % N]);
    }
  });
  return out;
}
// a short decaying noise IR (cab-like)
function makeIr(file) {
  const n = 2048, ir = new Float32Array(n);
  let seed = 7;
  for (let i = 0; i < n; i++) { seed = (seed * 69069 + 1) >>> 0; ir[i] = ((seed / 4294967296) * 2 - 1) * Math.exp(-i / 180) * 0.5; }
  ir[0] = 1;
  writeWav(file, [ir]);
}

const chain = (nodes) => {
  const cables = [];
  let prev = '__in';
  for (const n of nodes) { cables.push({ from: { node: prev, port: 0 }, to: { node: n.id, port: 0 } }); prev = n.id; }
  const last = nodes[nodes.length - 1];
  cables.push({ from: { node: prev, port: 0 }, to: { node: '__out', port: 0 } });
  cables.push({ from: { node: prev, port: last.nOut > 1 ? 1 : 0 }, to: { node: '__out', port: 1 } });
  return { nodes: nodes.map((n) => Object.assign({ nIn: 1, nOut: 1, opts: {}, params: {}, bypass: false }, n)), cables };
};

const IR = path.join(TMP, 'ir.wav');
makeIr(IR);
const M = (f) => path.join(ROOT, 'engine/test_models', f);
const GRAPHS = {
  'drive-amp-cab': chain([{ id: 'c', algo: 'comp' }, { id: 'd', algo: 'drive' }, { id: 'a', algo: 'amp' }, { id: 'i', algo: 'ir', opts: { files: [IR] } }]),
  'nam-a1-standard': chain([{ id: 'n', algo: 'nam', opts: { files: [M('wavenet_a1_standard.nam')] } }, { id: 'i', algo: 'ir', opts: { files: [IR] } }]),
  'nam-lstm': chain([{ id: 'n', algo: 'nam', opts: { files: [M('lstm.nam')] } }]),
  'nam-a2': chain([{ id: 'n', algo: 'nam', opts: { files: [M('A2.nam')] } }]),
  'mod-delay-reverb': chain([{ id: 'ch', algo: 'chorus' }, { id: 'ph', algo: 'phaser' }, { id: 'dl', algo: 'delay' }, { id: 'rv', algo: 'reverb', nOut: 2 }]),
  'pitch-wah-eq': chain([{ id: 'w', algo: 'wah' }, { id: 'p', algo: 'pitch' }, { id: 'e', algo: 'peq' }, { id: 't', algo: 'tremolo' }]),
};

function render(bin, graphFile, inWav, outWav) {
  const cmd = onArm || bin === X86 ? bin : 'qemu-aarch64';
  const args = cmd === 'qemu-aarch64' ? ['-L', SYSROOT, bin, '--offline', graphFile, inWav, outWav, '--block', '128'] : ['--offline', graphFile, inWav, outWav, '--block', '128'];
  const t0 = Date.now();
  const r = spawnSync(cmd, args, { encoding: 'utf8', timeout: 600000 });
  if (r.status !== 0) throw new Error(`${path.basename(bin)} failed: ${r.stderr || r.error}`);
  return { ms: Date.now() - t0, log: r.stderr };
}

if (!X86 || !fs.existsSync(X86)) { console.error('no x86 engine; build it first'); process.exit(2); }
if (!fs.existsSync(ARM)) { console.error('no ARM engine; run scripts/build-engine.sh arm64'); process.exit(2); }
const inWav = path.join(TMP, 'in.wav');
writeWav(inWav, [guitar()]);
console.log(`x86: ${X86}\narm: ${ARM}${onArm ? '' : ' (qemu-aarch64)'}`);
let bad = 0;
for (const [name, g] of Object.entries(GRAPHS)) {
  const gf = path.join(TMP, name + '.json');
  fs.writeFileSync(gf, JSON.stringify(g));
  const ox = path.join(TMP, name + '-x86.wav'), oa = path.join(TMP, name + '-arm.wav');
  render(X86, gf, inWav, ox);
  const ra = render(ARM, gf, inWav, oa);
  if (/blockError|error/i.test(ra.log.split('\n').filter((l) => !l.startsWith('status:')).join('\n'))) console.log('  arm log:', ra.log.trim());
  const a = readWav(ox), b = readWav(oa);
  let maxDiff = 0, sx = 0, sd = 0;
  for (let c = 0; c < 2; c++) for (let i = 0; i < a[c].length; i++) { const d = a[c][i] - b[c][i]; maxDiff = Math.max(maxDiff, Math.abs(d)); sx += a[c][i] * a[c][i]; sd += d * d; }
  const rmsOut = Math.sqrt(sx / (2 * a[0].length));
  const snr = sd > 0 ? 10 * Math.log10(sx / sd) : Infinity;
  // floats differ in the last bits (FMA contraction, libm), so judge by signal to difference ratio
  const ok = rmsOut > 1e-4 && snr > 60;
  if (!ok) bad++;
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name.padEnd(18)} out rms ${(20 * Math.log10(rmsOut + 1e-12)).toFixed(1)} dBFS, max diff ${maxDiff.toExponential(2)}, x86 vs ARM ${snr === Infinity ? 'bit identical' : snr.toFixed(1) + ' dB apart'} (arm render ${ra.ms} ms)`);
}
fs.rmSync(TMP, { recursive: true, force: true });
console.log(bad ? `${bad} graph(s) differ` : 'ARM output matches x86');
process.exit(bad ? 1 : 0);
