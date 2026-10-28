// Generates the factory presets shipped with Tone Zone.
const fs = require('fs');
const path = require('path');
const W = { compact: 146, nine: 150, mxr: 128, mxrw: 196, strymon: 204, strymonS: 128, amp: 440, combo: 440, cab4: 364, cab2: 380, cab1: 250, cab810: 270, rc500: 300, rc600: 620, tz: 150, rat: 150, pod: 184, treadle: 152, poly: 144, drop: 146, rack: 440, io: 150 };
let n = 0;
function chain(name, items, opts = {}) {
  // items: [{type, w, params, variant, stereo:true}], laid out right-to-left like a real pedalboard
  const blocks = [];
  const cables = [];
  let x = 0;
  const y = opts.y || 120;
  const placed = [];
  for (const it of items) {
    const id = 'b' + ++n;
    placed.push({ id, it });
    blocks.push({ id, type: it.type, x: -x - it.w, y: it.y ?? (it.tall ? y - 60 : y), params: it.params || {}, bypass: !!it.bypass, variant: it.variant || (it.stereo ? 'stereo' : 'mono') });
    x += it.w + (it.gap ?? 90);
  }
  blocks.push({ id: '__in', type: '__in', x: 120, y, params: {} });
  blocks.push({ id: '__out', type: '__out', x: -x - 150, y, params: {} });
  const colors = opts.colors || ['#e8473d', '#f39c12', '#f1c40f', '#2ecc71', '#3498db', '#6c5ce7', '#e84393', '#1abc9c'];
  let prev = { node: '__in', ports: 1 };
  let ci = 0;
  for (const p of placed) {
    const ins = p.it.ins ?? (p.it.stereo ? 2 : 1);
    for (let k = 0; k < Math.min(prev.ports, ins); k++) cables.push({ id: 'c' + ++n, from: { node: prev.node, port: k }, to: { node: p.id, port: k }, color: colors[ci % colors.length] });
    ci++;
    prev = { node: p.id, ports: p.it.outs ?? (p.it.stereo ? 2 : 1) };
  }
  for (let k = 0; k < Math.max(1, Math.min(2, prev.ports)); k++) cables.push({ id: 'c' + ++n, from: { node: prev.node, port: k }, to: { node: '__out', port: k }, color: colors[ci % colors.length] });
  if (prev.ports === 1) cables.push({ id: 'c' + ++n, from: { node: prev.node, port: 0 }, to: { node: '__out', port: 1 }, color: colors[(ci + 1) % colors.length] });
  return { version: 1, name, blocks, cables, view: null, factory: true, ...opts.extra };
}
const P = [];
P.push(['01-welcome', chain('Welcome · Brit Crunch', [
  { type: 'bx.tu3', w: W.compact },
  { type: 'ib.ts9', w: W.nine, params: { gain: 0.3, tone: 0.55, level: 0.7 } },
  { type: 'amp.jcm800', w: 440, tall: true, params: { gain: 0.55, master: 0.5 } },
  { type: 'cab.4x12gb', w: W.cab4, tall: true, y: 40 },
  { type: 'bx.rv6', w: W.compact, stereo: true, ins: 1, params: { mix: 0.3, decay: 0.45 } },
])]);
P.push(['02-clean-ambient', chain('Clean Ambient Shimmer', [
  { type: 'bx.cs3', w: W.compact },
  { type: 'amp.deluxe', w: 440, tall: true, y: 0, params: { gain: 0.35 } },
  { type: 'cab.1x12us', w: W.cab1, y: 60 },
  { type: 'bx.ch1', w: W.compact, outs: 2 },
  { type: 'sy.cloudburst', w: W.strymonS, stereo: true, params: { mix: 0.45, decay: 0.7, ens: 1 } },
])]);
P.push(['03-modern-metal', chain('Modern Metal (gated)', [
  { type: 'bx.ns2', w: W.compact },
  { type: 'bx.mt2', w: W.compact, params: { gain: 0.35, level: 0.6 }, bypass: true },
  { type: 'amp.5150', w: 460, tall: true, params: { gain: 0.7, master: 0.45 } },
  { type: 'cab.4x12v30', w: W.cab4, tall: true, y: 40, stereo: true, outs: 2 },
])]);
P.push(['04-bass-rig', chain('Bass · Grind & Fridge', [
  { type: 'bx.tu3', w: W.compact },
  { type: 'mx.m102', w: W.mxr },
  { type: 'pre.sansamp', w: W.tz, params: { gain: 0.35, blend: 0.65 } },
  { type: 'amp.svt', w: 520, tall: true },
  { type: 'cab.8x10svt', w: W.cab810, y: -80 },
])]);
P.push(['05-rig-x', chain('Rig X Express', [{ type: 'l6.podexpress', w: W.pod, outs: 2, params: { dist: 0.4, ampsel: 5, mod: 0.12, dly: 0.35, rev: 0.4 } }])]);
P.push(['06-looper-jam', chain('Looper Jam', [
  { type: 'bx.tu3', w: W.compact },
  { type: 'bx.bd2', w: W.compact, params: { gain: 0.45 } },
  { type: 'amp.plexi', w: 470, tall: true },
  { type: 'cab.2x12cream', w: W.cab2 },
  { type: 'bx.dd8', w: W.compact, stereo: true, ins: 1 },
  { type: 'bx.rc500', w: W.rc500, stereo: true },
])]);
P.push(['07-drop-tune', chain('Drop Tune Chug', [
  { type: 'dt.drop', w: W.drop, params: { dsel: 1 } },
  { type: 'pc.rat2', w: W.rat, params: { gain: 0.55, tone: 0.45, level: 0.55 } },
  { type: 'amp.recto', w: 460, tall: true, params: { channel: 1, gain: 0.6 } },
  { type: 'cab.4x12v30', w: W.cab4, y: 40 },
])]);
P.push(['08-boutique', chain('Boutique Board', [
  { type: 'sy.fairfax', w: W.strymonS },
  { type: 'sy.riverside', w: W.strymon },
  { type: 'amp.ac30', w: 440, tall: true, y: 0 },
  { type: 'cab.2x12blue', w: W.cab2 },
  { type: 'sy.elcap', w: W.strymon, stereo: true, ins: 1 },
  { type: 'sy.bluesky', w: W.strymon, stereo: true },
])]);
P.push(['09-wah-fuzz', chain('Wah into Fuzz', [
  { type: 'dn.gcb95', w: W.treadle, y: 80 },
  { type: 'tz.fuzzface', w: W.tz },
  { type: 'mx.m169', w: W.mxr },
  { type: 'amp.twin', w: 470, tall: true, y: 0, params: { gain: 0.4 } },
  { type: 'cab.2x12twin', w: W.cab2 },
])]);
const dir = path.join(__dirname, '..', 'presets');
fs.mkdirSync(dir, { recursive: true });
for (const [f, p] of P) fs.writeFileSync(path.join(dir, f + '.json'), JSON.stringify(p, null, 2));
console.log('wrote', P.length);
