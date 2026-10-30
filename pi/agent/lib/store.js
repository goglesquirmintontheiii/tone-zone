// Preset store on the SD card: presets, model / IR files (by SHA-256), banks of four, the current preset and
// the device config (GPIO, display, audio, updates, switching). Everything is plain JSON under TZ_DATA.
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DATA } = require('./hw');

const dir = (...p) => path.join(DATA, ...p);
const STATE = () => dir('state.json');

function ensure() {
  for (const d of ['', 'presets', 'files', 'tmp']) fs.mkdirSync(dir(d), { recursive: true });
}

function atomicWrite(file, data) {
  const tmp = file + '.tmp' + process.pid;
  fs.writeFileSync(tmp, data);
  fs.renameSync(tmp, file);
}

function defaultState() {
  return {
    v: 1,
    id: crypto.randomBytes(4).toString('hex'),
    name: '',
    banks: [{ name: 'Bank 1', presets: [null, null, null, null] }],
    bank: 0,
    slot: 0,
    pendingBank: null,
    budget: 0,
    config: {
      gpio: {
        // physical header pins (like the desktop tab); BCM numbers are worked out from the header map
        pins: {
          11: { type: 'foot', name: 'FS 1', mode: 'momentary', debounce: 20, press: 'slotA', hold: 'bank-' },
          13: { type: 'foot', name: 'FS 2', mode: 'momentary', debounce: 20, press: 'slotB', hold: 'none' },
          15: { type: 'foot', name: 'FS 3', mode: 'momentary', debounce: 20, press: 'slotC', hold: 'none' },
          16: { type: 'foot', name: 'FS 4', mode: 'momentary', debounce: 20, press: 'slotD', hold: 'bank+' },
          37: { type: 'led', name: 'Status', show: 'status', drive: 'onoff', bright: 60 },
        },
        holdMs: 600,
        adc: 'none',
        expr: [],
        bankWaits: true,
      },
      display: { screen: 'none', rotation: 0, brightness: 80, timeout: 0, theme: 'dark', touch: true },
      audio: { input: '', output: '', rate: 48000, buffer: 128, periods: 3, governor: true, isolate: false, server: 'auto' },
      updates: { channel: 'stable', auto: false, via: 'network', allowUnsigned: false },
      switching: { preload: true, spillover: false, midi: false },
    },
    tokens: [],
  };
}

let state = null;
function load() {
  ensure();
  try {
    state = JSON.parse(fs.readFileSync(STATE(), 'utf8'));
  } catch {
    state = null;
  }
  const def = defaultState();
  if (!state || state.v !== 1) state = def;
  // fill parts added later
  for (const k of Object.keys(def)) if (state[k] === undefined) state[k] = def[k];
  for (const k of Object.keys(def.config)) state.config[k] = Object.assign({}, def.config[k], state.config[k] || {});
  if (!state.banks.length) state.banks = def.banks;
  return state;
}
const get = () => state || load();
function save() {
  atomicWrite(STATE(), JSON.stringify(state, null, 1));
}

// ---- presets
const safeId = (id) => String(id || '').replace(/[^a-zA-Z0-9_.-]/g, '').slice(0, 80);
function listPresets() {
  ensure();
  const out = [];
  for (const f of fs.readdirSync(dir('presets'))) {
    if (!f.endsWith('.json')) continue;
    try {
      const p = JSON.parse(fs.readFileSync(dir('presets', f), 'utf8'));
      out.push({ id: p.id, name: p.name, rev: p.rev, dsp: p.dsp, blocks: (p.blocks || []).length, source: p.source || null });
    } catch {}
  }
  return out;
}
function getPreset(id) {
  try {
    return JSON.parse(fs.readFileSync(dir('presets', safeId(id) + '.json'), 'utf8'));
  } catch {
    return null;
  }
}
function putPreset(p) {
  if (!p || typeof p !== 'object' || !p.graph || !Array.isArray(p.graph.nodes)) throw new Error('Not a Tone Zone Pi preset (no graph).');
  const id = safeId(p.id) || crypto.randomBytes(5).toString('hex');
  const old = getPreset(id);
  const rec = Object.assign({}, p, { id, rev: (old ? old.rev || 0 : 0) + 1, saved: Date.now() });
  const missing = filesOf(rec).filter((h) => !hasFile(h));
  if (missing.length) throw new Error(`Missing ${missing.length} model / IR file(s): upload them first.`);
  atomicWrite(dir('presets', id + '.json'), JSON.stringify(rec));
  return rec;
}
function updatePreset(id, fn) {
  const p = getPreset(id);
  if (!p) return null;
  fn(p);
  atomicWrite(dir('presets', safeId(id) + '.json'), JSON.stringify(p));
  return p;
}
function deletePreset(id) {
  fs.rmSync(dir('presets', safeId(id) + '.json'), { force: true });
  const s = get();
  for (const b of s.banks) b.presets = b.presets.map((x) => (x && x.id === id ? null : x));
  save();
  gcFiles();
}

// ---- files referenced as "tzfile:<sha256>.<ext>" inside a preset graph
const FILE_RE = /^tzfile:([0-9a-f]{64})(\.[a-z0-9]{1,8})?$/;
function filesOf(p) {
  const out = new Set();
  const walk = (v) => {
    if (typeof v === 'string') { const m = v.match(FILE_RE); if (m) out.add(m[1] + (m[2] || '')); }
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  walk(p.graph);
  return [...out];
}
const fileName = (h) => {
  const m = String(h).match(/^([0-9a-f]{64})(\.[a-z0-9]{1,8})?$/);
  return m ? m[1] + (m[2] || '') : null;
};
const hasFile = (h) => { const n = fileName(h); return !!n && fs.existsSync(dir('files', n)); };
function putFile(h, buf) {
  const n = fileName(h);
  if (!n) throw new Error('Bad file name');
  const sha = crypto.createHash('sha256').update(buf).digest('hex');
  if (sha !== n.slice(0, 64)) throw new Error('Checksum mismatch: the file was damaged on the way.');
  atomicWrite(dir('files', n), buf);
  return n;
}
// engine graph with absolute paths
function resolveGraph(graph) {
  const walk = (v) => {
    if (typeof v === 'string') { const m = v.match(FILE_RE); return m ? dir('files', m[1] + (m[2] || '')) : v; }
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object') { const o = {}; for (const k in v) o[k] = walk(v[k]); return o; }
    return v;
  };
  return walk(graph);
}
// drop model / IR files no preset uses any more
function gcFiles() {
  const used = new Set();
  for (const f of fs.readdirSync(dir('presets'))) {
    const p = getPreset(f.replace(/\.json$/, ''));
    if (p) filesOf(p).forEach((h) => used.add(h));
  }
  for (const f of fs.readdirSync(dir('files'))) if (!used.has(f)) fs.rmSync(dir('files', f), { force: true });
}

// ---- banks: [{ name, presets: [ { id, name } | null x4 ] }]
function setBanks(banks) {
  if (!Array.isArray(banks)) throw new Error('banks must be a list');
  const s = get();
  s.banks = banks.slice(0, 128).map((b, i) => ({
    name: String((b && b.name) || `Bank ${i + 1}`).slice(0, 40),
    presets: [0, 1, 2, 3].map((k) => {
      const x = b && b.presets && b.presets[k];
      const id = x && (x.id || x.file);
      return id && getPreset(id) ? { id: safeId(id), name: String(x.name || getPreset(id).name || '').slice(0, 60) } : null;
    }),
  }));
  if (!s.banks.length) s.banks = defaultState().banks;
  s.bank = Math.min(s.bank, s.banks.length - 1);
  save();
  return s.banks;
}
// the flat order presets are stepped through (bank by bank, empty slots skipped)
function order() {
  const out = [];
  get().banks.forEach((b, bi) => b.presets.forEach((p, si) => p && out.push({ bank: bi, slot: si, id: p.id })));
  return out;
}
function placePreset(rec, bank, slot) {
  const s = get();
  if (bank == null || slot == null) {
    // replace where it already is, else the first free slot, else a new bank
    for (const b of s.banks) for (let i = 0; i < 4; i++) if (b.presets[i] && b.presets[i].id === rec.id) { b.presets[i].name = rec.name; save(); return; }
    for (let bi = 0; bi < s.banks.length; bi++) for (let i = 0; i < 4; i++) if (!s.banks[bi].presets[i]) { bank = bi; slot = i; break; }
    if (bank == null) { s.banks.push({ name: `Bank ${s.banks.length + 1}`, presets: [null, null, null, null] }); bank = s.banks.length - 1; slot = 0; }
  }
  while (s.banks.length <= bank) s.banks.push({ name: `Bank ${s.banks.length + 1}`, presets: [null, null, null, null] });
  s.banks[bank].presets[slot] = { id: rec.id, name: rec.name };
  save();
  return { bank, slot };
}

module.exports = { load, get, save, listPresets, getPreset, putPreset, updatePreset, deletePreset, hasFile, putFile, filesOf, resolveGraph, setBanks, order, placePreset, dir, atomicWrite, defaultState };
