// User library: NAM and IR packs, presets and settings, all under ~/.local/share/tone-zone
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { unzipSync } = require('fflate');

function dataRoot() {
  const base = process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share');
  return path.join(base, 'tone-zone');
}

function ensureDirs() {
  const root = dataRoot();
  for (const d of ['', 'presets', 'library', 'library/nam', 'library/ir', 'staging', 'downloads']) {
    fs.mkdirSync(path.join(root, d), { recursive: true });
  }
  return root;
}

function slug(s) {
  return (s || 'item').toString().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'item';
}
function uid() {
  return crypto.randomBytes(5).toString('hex');
}

// --- .nam metadata (header only; weights can be large but JSON.parse is fine) ---
function readNamMeta(file) {
  try {
    const j = JSON.parse(fs.readFileSync(file, 'utf8'));
    const md = j.metadata || {};
    return {
      ok: true,
      version: j.version,
      architecture: j.architecture,
      sampleRate: j.sample_rate || (md.sample_rate) || null,
      name: md.name || null,
      gearMake: md.gear_make || null,
      gearModel: md.gear_model || null,
      gearType: md.gear_type || null,
      toneType: md.tone_type || null,
      modeledBy: md.modeled_by || null,
      loudness: md.loudness || null,
      slimmable: !!(j.config && JSON.stringify(j.config).includes('slimmable')),
    };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

function readWavInfo(file) {
  try {
    const fd = fs.openSync(file, 'r');
    const buf = Buffer.alloc(4096);
    fs.readSync(fd, buf, 0, 4096, 0);
    fs.closeSync(fd);
    if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') return { ok: false, error: 'not a WAV file' };
    let pos = 12;
    while (pos + 8 < buf.length) {
      const id = buf.toString('ascii', pos, pos + 4);
      const len = buf.readUInt32LE(pos + 4);
      if (id === 'fmt ') {
        return { ok: true, channels: buf.readUInt16LE(pos + 10), sampleRate: buf.readUInt32LE(pos + 12), bits: buf.readUInt16LE(pos + 22) };
      }
      pos += 8 + len + (len & 1);
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

function guessCategory(metas) {
  const types = metas.map((m) => (m && m.gearType) || '').join(' ');
  if (/pedal/.test(types) && !/amp/.test(types)) return 'pedal';
  if (/preamp/.test(types)) return 'preamp';
  if (/amp_cab|amp_pedal_cab|full/.test(types)) return 'amp';
  if (/cab/.test(types)) return 'cab';
  if (/amp/.test(types)) return 'amp';
  return 'amp';
}

// strip the shared prefix/suffix from names so models get short labels ("Gain 3", "Gain 7")
function shortNames(names) {
  if (names.length < 2) return names.map((n) => n.slice(0, 28));
  let pre = names[0];
  for (const n of names) while (!n.startsWith(pre)) pre = pre.slice(0, -1);
  let suf = names[0];
  for (const n of names) while (!n.endsWith(suf)) suf = suf.slice(1);
  // only cut at separators
  pre = pre.replace(/[^\s\-_()]*$/, '');
  suf = suf.replace(/^[^\s\-_()]*/, '');
  return names.map((n) => {
    let s = n.slice(pre.length, n.length - suf.length).replace(/^[\s\-_]+|[\s\-_]+$/g, '');
    return (s || n).slice(0, 28);
  });
}

function walk(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

// Stage user files (.nam/.wav/.zip): unpack archives and read metadata. Returns a summary for the UI.
function inspect(paths, origin) {
  const root = ensureDirs();
  const id = uid();
  const stage = path.join(root, 'staging', id);
  fs.mkdirSync(stage, { recursive: true });
  const files = [];
  for (const p of paths) {
    const ext = path.extname(p).toLowerCase();
    if (ext === '.zip') {
      try {
        const data = unzipSync(new Uint8Array(fs.readFileSync(p)));
        for (const [name, bytes] of Object.entries(data)) {
          if (name.endsWith('/') || name.includes('__MACOSX') || path.basename(name).startsWith('._')) continue;
          const e2 = path.extname(name).toLowerCase();
          if (e2 !== '.nam' && e2 !== '.wav') continue;
          const safe = name.replace(/\.\.+/g, '_').replace(/^\/+/, '');
          const dst = path.join(stage, safe);
          fs.mkdirSync(path.dirname(dst), { recursive: true });
          fs.writeFileSync(dst, Buffer.from(bytes));
          files.push(dst);
        }
      } catch (e) {
        files.push({ error: `Could not read ${path.basename(p)}: ${e.message}` });
      }
    } else if (ext === '.nam' || ext === '.wav') {
      const dst = path.join(stage, path.basename(p));
      fs.copyFileSync(p, dst);
      files.push(dst);
    } else if (fs.existsSync(p) && fs.statSync(p).isDirectory()) {
      for (const f of walk(p, [])) {
        const e2 = path.extname(f).toLowerCase();
        if (e2 === '.nam' || e2 === '.wav') {
          const dst = path.join(stage, path.relative(p, f));
          fs.mkdirSync(path.dirname(dst), { recursive: true });
          fs.copyFileSync(f, dst);
          files.push(dst);
        }
      }
    }
  }
  const items = [];
  const errors = [];
  for (const f of files) {
    if (typeof f === 'object') { errors.push(f.error); continue; }
    const ext = path.extname(f).toLowerCase();
    const base = path.basename(f, ext);
    if (ext === '.nam') {
      const meta = readNamMeta(f);
      if (!meta.ok) { errors.push(`${path.basename(f)}: ${meta.error}`); continue; }
      items.push({ file: f, kind: 'nam', name: meta.name || base, base, meta });
    } else {
      const meta = readWavInfo(f);
      if (!meta.ok) { errors.push(`${path.basename(f)}: ${meta.error}`); continue; }
      items.push({ file: f, kind: 'ir', name: base, base, meta });
    }
  }
  items.sort((a, b) => a.base.localeCompare(b.base, undefined, { numeric: true }));
  const nams = items.filter((i) => i.kind === 'nam');
  const short = shortNames(nams.map((n) => n.base));
  nams.forEach((n, i) => (n.short = short[i]));
  const irs = items.filter((i) => i.kind === 'ir');
  const shortIr = shortNames(irs.map((n) => n.base));
  irs.forEach((n, i) => (n.short = shortIr[i]));
  const first = nams[0] && nams[0].meta;
  let suggestedName = '';
  if (first && (first.gearMake || first.gearModel)) suggestedName = [first.gearMake, first.gearModel].filter(Boolean).join(' ');
  else if (paths.length === 1) suggestedName = path.basename(paths[0], path.extname(paths[0]));
  else if (items.length) suggestedName = items[0].base;
  return {
    stagingId: id,
    origin: origin || 'file',
    items,
    errors,
    suggestedName: suggestedName.slice(0, 40),
    suggestedCategory: nams.length ? guessCategory(nams.map((n) => n.meta)) : 'cab',
  };
}

// create the pack(s) from staged files
function commit(req) {
  const root = ensureDirs();
  const stage = path.join(root, 'staging', req.stagingId);
  const out = [];
  for (const kind of ['nam', 'ir']) {
    const sel = (req.items || []).filter((i) => i.kind === kind && i.include !== false);
    if (!sel.length) continue;
    const id = `${kind}-${slug(req.name)}-${uid()}`;
    const dir = path.join(root, 'library', kind, id);
    fs.mkdirSync(dir, { recursive: true });
    const models = [];
    sel.forEach((it, idx) => {
      const src = it.file;
      if (!src.startsWith(stage) || !fs.existsSync(src)) return;
      const fname = `${String(idx + 1).padStart(2, '0')}-${slug(it.base)}${kind === 'nam' ? '.nam' : '.wav'}`;
      fs.copyFileSync(src, path.join(dir, fname));
      models.push({ file: fname, name: it.label || it.short || it.name, meta: it.meta || {} });
    });
    const pack = {
      id,
      kind,
      name: req.name || 'Imported',
      category: kind === 'ir' ? 'cab' : req.category || 'amp',
      form: req.form || null,
      color: req.color || '#8a5cf6',
      origin: req.origin || 'file',
      created: Date.now(),
      models,
    };
    fs.writeFileSync(path.join(dir, 'pack.json'), JSON.stringify(pack, null, 2));
    out.push(withPaths(pack, dir));
  }
  try { fs.rmSync(stage, { recursive: true, force: true }); } catch (_) {}
  return out;
}

function withPaths(pack, dir) {
  return Object.assign({}, pack, { dir, files: pack.models.map((m) => path.join(dir, m.file)) });
}

function list() {
  const root = ensureDirs();
  const packs = [];
  for (const kind of ['nam', 'ir']) {
    const base = path.join(root, 'library', kind);
    for (const d of fs.readdirSync(base)) {
      const pj = path.join(base, d, 'pack.json');
      try {
        packs.push(withPaths(JSON.parse(fs.readFileSync(pj, 'utf8')), path.join(base, d)));
      } catch (_) {}
    }
  }
  packs.sort((a, b) => (a.created || 0) - (b.created || 0));
  return packs;
}

function update(id, fields) {
  const p = list().find((x) => x.id === id);
  if (!p) return null;
  const pj = path.join(p.dir, 'pack.json');
  const cur = JSON.parse(fs.readFileSync(pj, 'utf8'));
  for (const k of ['name', 'category', 'color', 'form']) if (fields[k] !== undefined) cur[k] = fields[k];
  if (Array.isArray(fields.modelNames)) cur.models.forEach((m, i) => fields.modelNames[i] && (m.name = fields.modelNames[i]));
  fs.writeFileSync(pj, JSON.stringify(cur, null, 2));
  return withPaths(cur, p.dir);
}

function remove(id) {
  const p = list().find((x) => x.id === id);
  if (!p) return false;
  fs.rmSync(p.dir, { recursive: true, force: true });
  return true;
}

function discardStaging(id) {
  try { fs.rmSync(path.join(dataRoot(), 'staging', id), { recursive: true, force: true }); } catch (_) {}
}

// ---------------- presets ----------------
function presetDir() {
  return path.join(ensureDirs(), 'presets');
}
function listPresets() {
  const d = presetDir();
  return fs
    .readdirSync(d)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      const p = path.join(d, f);
      let name = f.replace(/\.json$/, '');
      let meta = {};
      try {
        const j = JSON.parse(fs.readFileSync(p, 'utf8'));
        name = j.name || name;
        const bl = (j.blocks || []).filter((b) => !String(b.id).startsWith('__'));
        const idx = new Map(bl.map((b, i) => [b.id, i]));
        meta = {
          tags: j.tags || [],
          blocks: bl.length,
          favorite: !!j.favorite,
          order: j.order || 0,
          factory: !!j.factory,
          saved: j.saved || 0,
          desc: j.desc || '',
          // compact layout for preset thumbnails
          layout: { b: bl.map((b) => [b.type, Math.round(b.x), Math.round(b.y), b.bypass ? 1 : 0, b.rot || 0]), c: (j.cables || []).map((c) => [idx.has(c.from.node) ? idx.get(c.from.node) : -1, idx.has(c.to.node) ? idx.get(c.to.node) : -1]) },
          types: [...new Set(bl.map((b) => b.type))],
        };
      } catch (_) {}
      return Object.assign({ file: f, name, mtime: fs.statSync(p).mtimeMs }, meta);
    })
    .sort((a, b) => (a.order || 0) - (b.order || 0) || a.name.localeCompare(b.name, undefined, { numeric: true }));
}
function loadPreset(file) {
  return JSON.parse(fs.readFileSync(path.join(presetDir(), path.basename(file)), 'utf8'));
}
function savePreset(preset, file) {
  const f = file ? path.basename(file) : `${slug(preset.name)}.json`;
  fs.writeFileSync(path.join(presetDir(), f), JSON.stringify(preset, null, 2));
  return f;
}
function presetMeta(file, patch) {
  const p = path.join(presetDir(), path.basename(file));
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  for (const k of ['name', 'tags', 'favorite', 'desc', 'order']) if (k in patch) j[k] = patch[k];
  fs.writeFileSync(p, JSON.stringify(j, null, 2));
  return true;
}
function duplicatePreset(file) {
  const j = loadPreset(file);
  j.name = j.name + ' copy';
  delete j.factory;
  let f = `${slug(j.name)}.json`;
  for (let i = 2; fs.existsSync(path.join(presetDir(), f)); i++) f = `${slug(j.name)}-${i}.json`;
  fs.writeFileSync(path.join(presetDir(), f), JSON.stringify(j, null, 2));
  return f;
}
function deletePreset(file) {
  fs.rmSync(path.join(presetDir(), path.basename(file)), { force: true });
}
// Factory presets are copied into the user's preset folder. The .factory-installed marker keeps a hash of
// each factory file the user got, so:
//  * new presets from an update get added,
//  * presets the user deleted stay deleted (until "Restore built-in presets"),
//  * presets the user never changed get updated (the favourite star is kept),
//  * presets the user edited (saved, renamed, re-tagged) are left alone.
const FACTORY_MARKER = () => path.join(dataRoot(), '.factory-installed');
// content hash that ignores formatting and the favourite flag
function presetHash(obj) {
  const o = Object.assign({}, obj);
  delete o.favorite;
  return crypto.createHash('sha1').update(JSON.stringify(o)).digest('hex');
}
function readFactoryMarker() {
  try {
    const raw = fs.readFileSync(FACTORY_MARKER(), 'utf8').trim();
    if (raw.startsWith('{')) return JSON.parse(raw).files || {};
    // older versions stored a plain list of file names (no hashes)
    const list = raw.startsWith('[') ? JSON.parse(raw) : ['01-welcome.json', '02-clean-ambient.json', '03-modern-metal.json', '04-bass-rig.json', '05-rig-x.json', '06-looper-jam.json', '07-drop-tune.json', '08-boutique.json', '09-wah-fuzz.json'];
    return Object.fromEntries(list.map((f) => [f, null]));
  } catch (_) {
    return {};
  }
}
function writeFactoryMarker(files) {
  fs.writeFileSync(FACTORY_MARKER(), JSON.stringify({ v: 2, files }));
}
function installFactoryPresets(srcDir, { restore = false } = {}) {
  const d = presetDir();
  const files = readFactoryMarker();
  let added = 0, updated = 0;
  if (fs.existsSync(srcDir))
    for (const f of fs.readdirSync(srcDir)) {
      if (!f.endsWith('.json')) continue;
      let src;
      try { src = JSON.parse(fs.readFileSync(path.join(srcDir, f), 'utf8')); } catch (_) { continue; }
      const srcHash = presetHash(src);
      const dst = path.join(d, f);
      const known = Object.prototype.hasOwnProperty.call(files, f);
      if (!fs.existsSync(dst)) {
        if (known && !restore) continue; // the user deleted it
        fs.writeFileSync(dst, JSON.stringify(src, null, 2));
        files[f] = srcHash;
        added++;
        continue;
      }
      let cur;
      try { cur = JSON.parse(fs.readFileSync(dst, 'utf8')); } catch (_) { continue; }
      const curHash = presetHash(cur);
      if (curHash === srcHash) { files[f] = srcHash; continue; }
      // unchanged since we installed it? (legacy entries have no hash: never saved by the user = unchanged)
      const untouched = known && (files[f] ? curHash === files[f] : !cur.saved && cur.factory && cur.name === src.name);
      if (!untouched) continue;
      if (cur.favorite) src.favorite = true;
      fs.writeFileSync(dst, JSON.stringify(src, null, 2));
      files[f] = srcHash;
      updated++;
    }
  writeFactoryMarker(files);
  return { added, updated };
}
// names of factory presets the user has deleted
function deletedFactoryPresets(srcDir) {
  const files = readFactoryMarker();
  if (!fs.existsSync(srcDir)) return [];
  return fs.readdirSync(srcDir).filter((f) => f.endsWith('.json') && Object.prototype.hasOwnProperty.call(files, f) && !fs.existsSync(path.join(presetDir(), f)));
}

// ---------------- settings ----------------
function loadSettings() {
  try {
    return JSON.parse(fs.readFileSync(path.join(ensureDirs(), 'settings.json'), 'utf8'));
  } catch (_) {
    return {};
  }
}
function saveSettings(s) {
  fs.writeFileSync(path.join(ensureDirs(), 'settings.json'), JSON.stringify(s, null, 2));
}

module.exports = {
  presetMeta,
  duplicatePreset,
  dataRoot, ensureDirs, inspect, commit, list, update, remove, discardStaging,
  listPresets, loadPreset, savePreset, deletePreset, installFactoryPresets, deletedFactoryPresets, loadSettings, saveSettings, readNamMeta,
};
