// Desktop side of the Raspberry Pi pedal: finds Pis (mDNS, direct cable, manual address), pairs, talks to the
// tz-agent API (HTTP + WebSocket on port 7650), pushes presets with their NAM models and IRs, pushes updates.
// Exposed to the renderer as window.tz.pi (preload.js); pages/pi-live.js turns it into the Pi tab's data.
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { execFile } = require('child_process');
const mdns = require('./pi-mdns');

const PORT = 7650;
const REPO = 'goglesquirmintontheiii/tone-zone';

function createClient({ dataRoot, emit = () => {}, port = Number(process.env.TZ_PI_PORT || PORT) }) {
  const FILE = path.join(dataRoot, 'pi-devices.json');
  let known = [];
  try { known = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { known = []; }
  const save = () => { try { fs.mkdirSync(dataRoot, { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(known, null, 1)); } catch {} };
  const online = new Map(); // id -> { info, addr, at }
  const sockets = new Map(); // id -> { ws, want }

  const hostPort = (h) => (/:\d+$/.test(h) && !/^\[?[0-9a-f:]+\]?$/i.test(h) ? h : `${h}:${port}`);
  const urlOf = (addr, p) => `http://${hostPort(addr)}${p}`;

  async function http(addr, method, p, { body, token, raw, headers = {}, timeout = 8000 } = {}) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), timeout);
    try {
      const h = Object.assign({}, headers);
      if (token) h.Authorization = 'Bearer ' + token;
      let b;
      if (raw) { b = raw; h['Content-Type'] = 'application/octet-stream'; }
      else if (body !== undefined) { b = JSON.stringify(body); h['Content-Type'] = 'application/json'; }
      const r = await fetch(urlOf(addr, p), { method, headers: h, body: b, signal: ctl.signal });
      const txt = await r.text();
      let j = null;
      try { j = txt ? JSON.parse(txt) : null; } catch { j = { raw: txt }; }
      if (!r.ok) throw Object.assign(new Error((j && j.error) || `HTTP ${r.status}`), { status: r.status });
      return j;
    } catch (e) {
      if (e.name === 'AbortError') throw new Error(`The Pi at ${addr} did not answer.`);
      if (e.cause && /ECONNREFUSED|EHOSTUNREACH|ENOTFOUND|ENETUNREACH/.test(e.cause.code || '')) throw new Error(`Cannot reach a Pi at ${addr}.`);
      throw e;
    } finally {
      clearTimeout(t);
    }
  }

  async function probe(addr, timeout = 2500) {
    try {
      const info = await http(addr, 'GET', '/api/info', { timeout });
      return info && info.api ? Object.assign(info, { addr }) : null;
    } catch {
      return null;
    }
  }

  // ---- discovery
  function interfaces() {
    const out = [];
    for (const [name, list] of Object.entries(os.networkInterfaces())) for (const a of list || []) if (a.family === 'IPv4' && !a.internal) out.push({ name, address: a.address, netmask: a.netmask, linkLocal: a.address.startsWith('169.254.'), shared: a.address === '10.42.0.1' });
    return out;
  }
  // a cable straight to the Pi: link-local (169.254) or NetworkManager "shared" (10.42.0.x)
  async function directCandidates() {
    const ifs = interfaces().filter((i) => i.linkLocal || i.shared);
    if (!ifs.length) return [];
    const cands = new Set();
    try {
      for (const l of fs.readFileSync('/proc/net/arp', 'utf8').split('\n').slice(1)) {
        const w = l.trim().split(/\s+/);
        if (w[0] && ifs.some((i) => i.name === w[5]) && w[2] !== '0x0') cands.add(w[0]);
      }
    } catch {}
    if (ifs.some((i) => i.shared)) for (let k = 2; k < 255; k++) cands.add('10.42.0.' + k);
    return [...cands];
  }

  async function scan({ timeout = 1500 } = {}) {
    const found = new Map();
    const add = (info, via) => {
      if (!info || !info.id) return;
      if (!found.has(info.id)) found.set(info.id, Object.assign(info, { via }));
    };
    const mdnsP = mdns.browse({ timeout }).then(async (list) => {
      for (const s of list) {
        const addrs = (s.addresses || []).concat(s.host ? [s.host.replace(/\.$/, '')] : []);
        for (const a of addrs) {
          const info = await probe(s.port && s.port !== port ? `${a}:${s.port}` : a, 1500);
          if (info) { add(info, info.addr.startsWith('169.254.') || info.addr.startsWith('10.42.0.') ? 'direct' : 'mdns'); break; }
        }
      }
    }).catch(() => {});
    const directP = directCandidates().then((c) => Promise.all(c.map((a) => probe(a, 800).then((i) => add(i, 'direct')))));
    const knownP = Promise.all(known.map((k) => (async () => {
      for (const a of [k.addr, ...(k.addrs || [])].filter(Boolean)) { const i = await probe(a, 1500); if (i) return add(i, k.link === 'direct' ? 'direct' : 'known'); }
    })()));
    await Promise.all([mdnsP, directP, knownP]);
    for (const info of found.values()) {
      online.set(info.id, { info, addr: info.addr, at: Date.now() });
      const k = known.find((x) => x.id === info.id);
      if (k) { Object.assign(k, { addr: info.addr, name: info.name, model: info.model, version: info.version, lastSeen: Date.now() }); }
    }
    save();
    return list();
  }

  function list() {
    const out = [];
    const ids = new Set([...known.map((k) => k.id), ...online.keys()]);
    for (const id of ids) {
      const k = known.find((x) => x.id === id);
      const o = online.get(id);
      const info = (o && o.info) || {};
      out.push({
        id, name: info.name || (k && k.name) || 'Tone Zone Pi', model: info.model || (k && k.model), ram: info.ram || (k && k.ram), os: info.os,
        host: info.host || (k && k.host), ip: (o && o.addr) || (k && k.addr), addr: (o && o.addr) || (k && k.addr), link: (k && k.link) || info.link || (o && o.info.via === 'direct' ? 'direct' : 'wifi'),
        online: !!o, paired: !!(k && k.token), lastSeen: (o && o.at) || (k && k.lastSeen) || 0, version: info.version || (k && k.version), prevVersion: info.prevVersion, budget: info.budget, fake: !!info.fake,
      });
    }
    return out;
  }

  async function add(addr) {
    const info = await probe(addr.trim());
    if (!info) throw new Error(`No Tone Zone Pi answered at ${addr}. Check the address and that the Pi is on.`);
    online.set(info.id, { info, addr: info.addr, at: Date.now() });
    return info;
  }

  async function pair(addr, code, link) {
    const info = await add(addr);
    const r = await http(info.addr, 'POST', '/api/pair', { body: { code: String(code).trim(), client: os.hostname() } });
    const rec = { id: info.id, name: info.name, addr: info.addr, addrs: info.ips || [], host: info.host, model: info.model, ram: info.ram, version: info.version, token: r.token, link: link || (info.addr.startsWith('169.254.') ? 'direct' : 'wifi'), lastSeen: Date.now() };
    known = known.filter((k) => k.id !== info.id).concat([rec]);
    save();
    return list().find((d) => d.id === info.id);
  }
  function forget(id) {
    disconnect(id);
    known = known.filter((k) => k.id !== id);
    online.delete(id);
    save();
  }

  // API call to a paired Pi, trying the addresses we know
  async function api(id, method, p, opts = {}) {
    const k = known.find((x) => x.id === id);
    const o = online.get(id);
    if (!k && !o) throw new Error('Unknown Pi');
    const addrs = [...new Set([o && o.addr, k && k.addr, ...((k && k.addrs) || []), k && k.host].filter(Boolean))];
    let last;
    for (const a of addrs) {
      try {
        const r = await http(a, method, p, Object.assign({ token: k && k.token }, opts));
        if (k && k.addr !== a) { k.addr = a; save(); }
        return r;
      } catch (e) {
        last = e;
        if (e.status) throw e; // it answered: a real error
      }
    }
    throw last || new Error('Pi not reachable');
  }

  // ---- live events over WebSocket
  function connect(id) {
    if (sockets.has(id)) return true;
    const k = known.find((x) => x.id === id);
    if (!k || !k.token) return false;
    const rec = { want: true, ws: null, timer: null };
    sockets.set(id, rec);
    const open = () => {
      if (!rec.want) return;
      const o = online.get(id);
      const addr = (o && o.addr) || k.addr;
      let ws;
      try { ws = new WebSocket(`ws://${hostPort(addr)}/ws?token=${encodeURIComponent(k.token)}`); } catch { rec.timer = setTimeout(open, 3000); return; }
      rec.ws = ws;
      ws.onopen = () => emit(id, { t: 'online', online: true });
      ws.onmessage = (m) => { try { emit(id, JSON.parse(typeof m.data === 'string' ? m.data : Buffer.from(m.data).toString())); } catch {} };
      ws.onclose = () => {
        rec.ws = null;
        if (rec.want) { emit(id, { t: 'online', online: false }); rec.timer = setTimeout(open, 3000); }
      };
      ws.onerror = () => {};
    };
    open();
    return true;
  }
  function disconnect(id) {
    const rec = sockets.get(id);
    if (!rec) return;
    rec.want = false;
    clearTimeout(rec.timer);
    try { rec.ws && rec.ws.close(); } catch {}
    sockets.delete(id);
  }
  function wsSend(id, msg) {
    const rec = sockets.get(id);
    if (rec && rec.ws && rec.ws.readyState === 1) rec.ws.send(JSON.stringify(msg));
  }

  // ---- push a preset: { name, graph, blocks, ... } with absolute model / IR paths in graph opts
  async function pushPreset(id, preset, { bank, slot, bench = true } = {}) {
    const progress = (pct, text) => emit(id, { t: 'progress', job: 'push', pct, text });
    progress(5, 'Collecting files');
    const files = new Map(); // abs path -> tzfile name
    const g = JSON.parse(JSON.stringify(preset.graph || { nodes: [], cables: [] }));
    const walk = (v) => {
      if (typeof v === 'string' && path.isAbsolute(v) && /\.(nam|wav|json|aif|aiff|flac)$/i.test(v)) {
        if (!files.has(v)) {
          if (!fs.existsSync(v)) throw new Error(`Missing file: ${path.basename(v)}`);
          const sha = crypto.createHash('sha256').update(fs.readFileSync(v)).digest('hex');
          files.set(v, `${sha}${path.extname(v).toLowerCase()}`);
        }
        return 'tzfile:' + files.get(v);
      }
      if (Array.isArray(v)) return v.map(walk);
      if (v && typeof v === 'object') { const o = {}; for (const key in v) o[key] = walk(v[key]); return o; }
      return v;
    };
    for (const n of g.nodes || []) if (n.opts) n.opts = walk(n.opts);
    const names = [...files.values()];
    const { missing } = names.length ? await api(id, 'POST', '/api/files/check', { body: { files: names } }) : { missing: [] };
    let done = 0;
    for (const [abs, name] of files) {
      if (!missing.includes(name)) continue;
      progress(10 + Math.round((70 * done) / Math.max(1, missing.length)), `Copying ${path.basename(abs)}`);
      await api(id, 'PUT', '/api/files/' + name, { raw: fs.readFileSync(abs), timeout: 120000 });
      done++;
    }
    progress(85, 'Saving the preset and measuring DSP');
    const out = Object.assign({}, preset, { graph: g, format: 'tz-pi-preset', v: 1 });
    const r = await api(id, 'POST', '/api/presets', { body: { preset: out, bank, slot, bench }, timeout: 90000 });
    progress(100, 'Done');
    emit(id, { t: 'progress', job: 'push', pct: 100, done: true });
    return Object.assign(r, { copied: done, files: names.length });
  }

  // ---- updates: a local bundle file, or the latest release downloaded here and pushed (the Pi needs no internet)
  async function latestRelease(channel = 'stable') {
    let url = `https://github.com/${REPO}/releases/latest/download/pi-latest.json`;
    if (process.env.TZ_RELEASES) url = `${process.env.TZ_RELEASES}/latest/download/pi-latest.json`;
    else if (channel !== 'stable') {
      const r = await fetch(`https://api.github.com/repos/${REPO}/releases?per_page=10`);
      const rel = r.ok ? (await r.json()).find((x) => (x.assets || []).some((a) => a.name === 'pi-latest.json')) : null;
      if (!rel) throw new Error('No Pi release found for that channel.');
      url = rel.assets.find((a) => a.name === 'pi-latest.json').browser_download_url;
    }
    const r = await fetch(url);
    if (!r.ok) throw new Error(`Could not check GitHub for updates (${r.status}).`);
    const j = await r.json();
    j.bundleUrl = new URL(j.bundle, url).toString();
    j.sigUrl = j.sig ? new URL(j.sig, url).toString() : null;
    return j;
  }
  async function downloadBundle(channel) {
    const info = await latestRelease(channel);
    const dir = path.join(dataRoot, 'pi-bundles');
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, path.basename(new URL(info.bundleUrl).pathname));
    if (!fs.existsSync(file)) {
      const r = await fetch(info.bundleUrl);
      if (!r.ok) throw new Error(`Download failed (${r.status}).`);
      const buf = Buffer.from(await r.arrayBuffer());
      if (info.sha256 && crypto.createHash('sha256').update(buf).digest('hex') !== info.sha256) throw new Error('Download damaged.');
      fs.writeFileSync(file, buf);
      if (info.sigUrl) { const s = await fetch(info.sigUrl); if (s.ok) fs.writeFileSync(file + '.sig', (await s.text()).trim() + '\n'); }
    }
    return { file, version: info.version, notes: info.notes || [] };
  }
  async function pushUpdate(id, { file, channel, verifyOnly } = {}) {
    if (!file) file = (await downloadBundle(channel)).file;
    const buf = fs.readFileSync(file);
    const sig = fs.existsSync(file + '.sig') ? fs.readFileSync(file + '.sig', 'utf8').trim() : '';
    emit(id, { t: 'progress', job: 'update', pct: 20, text: 'Sending the update to the Pi' });
    const r = await api(id, 'POST', verifyOnly ? '/api/update/verify' : '/api/update', { raw: buf, headers: sig ? { 'X-TZ-Signature': sig } : {}, timeout: 300000 });
    if (!verifyOnly) emit(id, { t: 'progress', job: 'update', pct: 60, text: `Installed ${r.version}, restarting the Pi software` });
    return r;
  }

  // ---- a direct cable on Linux with NetworkManager: a link-local profile for that port
  function setupDirect(iface) {
    return new Promise((resolve, reject) => {
      if (!/^[a-zA-Z0-9_.-]+$/.test(iface || '')) return reject(new Error('Pick the network port the cable is in.'));
      execFile('nmcli', ['connection', 'add', 'type', 'ethernet', 'ifname', iface, 'con-name', 'Tone Zone direct', 'ipv4.method', 'link-local', 'ipv6.method', 'link-local', 'connection.autoconnect-priority', '-10'], (e) => {
        if (e && !/already exists/.test(String(e.message))) return reject(new Error('nmcli failed: ' + e.message));
        execFile('nmcli', ['connection', 'up', 'Tone Zone direct'], () => resolve(true));
      });
    });
  }

  async function saveSupport(id) {
    const j = await api(id, 'GET', '/api/support', { timeout: 15000 });
    const dir = path.join(dataRoot, 'downloads');
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `pi-support-${id}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    fs.writeFileSync(file, JSON.stringify(j, null, 1));
    return { path: file };
  }

  return { scan, list, probe, add, pair, forget, api, connect, disconnect, wsSend, pushPreset, pushUpdate, latestRelease, downloadBundle, interfaces, setupDirect, saveSupport };
}

// Electron wiring
function setup(ipcMain, { dataRoot, send, dialog, getWin }) {
  const c = createClient({ dataRoot, emit: (id, msg) => send('pi:event', { id, msg }) });
  const h = (name, fn) => ipcMain.handle('pi:' + name, (_e, ...a) => fn(...a));
  h('scan', (o) => c.scan(o));
  h('list', () => c.list());
  h('probe', (addr) => c.probe(addr));
  h('add', (addr) => c.add(addr));
  h('pair', (addr, code, link) => c.pair(addr, code, link));
  h('forget', (id) => c.forget(id));
  h('api', (id, method, p, body) => c.api(id, method, p, body === undefined ? {} : { body }));
  h('connect', (id) => c.connect(id));
  h('disconnect', (id) => c.disconnect(id));
  h('wsSend', (id, msg) => c.wsSend(id, msg));
  h('pushPreset', (id, preset, opts) => c.pushPreset(id, preset, opts));
  h('pushUpdate', (id, opts) => c.pushUpdate(id, opts));
  h('latest', (ch) => c.latestRelease(ch));
  h('interfaces', () => c.interfaces());
  h('setupDirect', (iface) => c.setupDirect(iface));
  h('supportBundle', (id) => c.saveSupport(id));
  h('pickBundle', async () => {
    const r = await dialog.showOpenDialog(getWin(), { title: 'Choose a Pi update bundle', properties: ['openFile'], filters: [{ name: 'Tone Zone Pi bundle', extensions: ['gz', 'tgz'] }] });
    return r.canceled || !r.filePaths.length ? null : r.filePaths[0];
  });
  return c;
}

module.exports = { createClient, setup };
