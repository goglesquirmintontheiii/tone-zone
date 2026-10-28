// Plugin discovery / install / removal. A plugin is a folder with plugin.json + an ES module (index.js by default)
// whose default export receives the Tone Zone plugin API. Built-in plugins ship inside the app (and can be
// disabled); user plugins live in ~/.local/share/tone-zone/plugins.
'use strict';
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { unzipSync } = require('fflate');

function userDir(dataRoot) {
  const d = path.join(dataRoot, 'plugins');
  fs.mkdirSync(d, { recursive: true });
  return d;
}

function builtinDir(appRoot) {
  // packaged builds unpack plugins next to app.asar so ES-module imports and assets work everywhere
  const unpacked = appRoot.replace(/app\.asar$/, 'app.asar.unpacked');
  const cand = [path.join(unpacked, 'plugins'), path.join(appRoot, 'plugins')];
  return cand.find((d) => fs.existsSync(d)) || cand[1];
}

function readManifest(dir) {
  const m = JSON.parse(fs.readFileSync(path.join(dir, 'plugin.json'), 'utf8'));
  if (!m.id || !/^[a-z0-9][a-z0-9._-]{0,63}$/.test(m.id)) throw new Error('plugin.json needs a lowercase "id"');
  return m;
}

function scan(dir, builtin, enabledMap) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const name of fs.readdirSync(dir).sort()) {
    const p = path.join(dir, name);
    try {
      if (!fs.statSync(p).isDirectory() || !fs.existsSync(path.join(p, 'plugin.json'))) continue;
      const m = readManifest(p);
      const main = m.main || 'index.js';
      out.push({
        id: m.id,
        manifest: m,
        builtin,
        dir: p,
        baseUrl: pathToFileURL(p).href + '/',
        url: pathToFileURL(path.join(p, main)).href,
        enabled: enabledMap[m.id] !== false,
      });
    } catch (e) {
      out.push({ id: name, manifest: { id: name, name }, builtin, dir: p, enabled: false, error: String(e.message || e) });
    }
  }
  return out;
}

function list(appRoot, dataRoot, enabledMap = {}) {
  const b = scan(builtinDir(appRoot), true, enabledMap);
  const u = scan(userDir(dataRoot), false, enabledMap);
  // a user plugin with the same id overrides the built-in one (lets people patch a built-in)
  const ids = new Set(u.map((p) => p.id));
  return [...b.filter((p) => !ids.has(p.id)), ...u];
}

// install from a .zip (plugin folder at the root or one level down) or from a folder
function install(src, dataRoot) {
  const dest = userDir(dataRoot);
  const st = fs.statSync(src);
  if (st.isDirectory()) {
    const m = readManifest(src);
    const target = path.join(dest, m.id);
    fs.rmSync(target, { recursive: true, force: true });
    fs.cpSync(src, target, { recursive: true });
    return m;
  }
  const files = unzipSync(new Uint8Array(fs.readFileSync(src)));
  const names = Object.keys(files);
  const manifestName = names.filter((n) => /(^|\/)plugin\.json$/.test(n)).sort((a, b) => a.split('/').length - b.split('/').length)[0];
  if (!manifestName) throw new Error('No plugin.json in the archive');
  const prefix = manifestName.slice(0, -'plugin.json'.length);
  const m = JSON.parse(Buffer.from(files[manifestName]).toString('utf8'));
  if (!m.id || !/^[a-z0-9][a-z0-9._-]{0,63}$/.test(m.id)) throw new Error('plugin.json needs a lowercase "id"');
  const target = path.join(dest, m.id);
  fs.rmSync(target, { recursive: true, force: true });
  for (const n of names) {
    if (!n.startsWith(prefix) || n.endsWith('/')) continue;
    const rel = n.slice(prefix.length);
    if (rel.includes('..')) continue;
    const out = path.join(target, rel);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, Buffer.from(files[n]));
  }
  return m;
}

function remove(id, dataRoot) {
  const target = path.join(userDir(dataRoot), path.basename(id));
  fs.rmSync(target, { recursive: true, force: true });
}

module.exports = { list, install, remove, userDir, builtinDir };
