// Updates: signed bundles (Ed25519, key in release-key.js), installed into the inactive A/B slot, then a
// restart into the new slot and a health check. A new version that fails its check, or crash loops before it
// can check itself (pi/system/boot-check.sh counts the attempts), goes back to the old slot by itself.
//
// Layout: /opt/tonezone/{a,b}  /opt/tonezone/current -> a   /opt/tonezone/update.state (key=value lines)
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const hw = require('./hw');
const log = require('./log');
const PUBKEY = require('./release-key');

const REPO = process.env.TZ_REPO || 'goglesquirmintontheiii/tone-zone';
const STATE = () => path.join(hw.HOME, 'update.state');

function readState() {
  const out = {};
  try {
    for (const l of fs.readFileSync(STATE(), 'utf8').split('\n')) { const m = l.match(/^(\w+)=(.*)$/); if (m) out[m[1]] = m[2]; }
  } catch {}
  return out;
}
function writeState(s) {
  const txt = Object.entries(s).filter(([, v]) => v !== undefined && v !== null && v !== '').map(([k, v]) => `${k}=${v}`).join('\n') + '\n';
  fs.writeFileSync(STATE() + '.tmp', txt);
  fs.renameSync(STATE() + '.tmp', STATE());
}
const slotName = (p) => path.basename(p);
function currentSlot() {
  try { return slotName(fs.realpathSync(path.join(hw.HOME, 'current'))); } catch { return slotName(hw.SLOT); }
}
function version(slotDir = hw.SLOT) {
  try { return fs.readFileSync(path.join(slotDir, 'VERSION'), 'utf8').trim(); } catch {}
  try { return require(path.join(slotDir, 'agent', 'package.json')).version; } catch { return '0.0.0'; }
}
function switchTo(slot) {
  const link = path.join(hw.HOME, 'current');
  const tmp = link + '.new';
  try { fs.rmSync(tmp, { force: true }); } catch {}
  fs.symlinkSync(slot, tmp);
  fs.renameSync(tmp, link);
}

// ---- verification
function verifySignature(buf, sig) {
  if (!sig) return false;
  try { return crypto.verify(null, buf, PUBKEY, Buffer.from(String(sig).trim(), 'base64')); } catch { return false; }
}
const sha256 = (b) => crypto.createHash('sha256').update(b).digest('hex');

// unpack into a fresh directory and check every file against the manifest
function unpack(buf, dest) {
  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(dest, { recursive: true });
  const tgz = dest + '.tar.gz';
  fs.writeFileSync(tgz, buf);
  const r = spawnSync('tar', ['-xzf', tgz, '-C', dest, '--no-same-owner', '--no-same-permissions'], { encoding: 'utf8' });
  fs.rmSync(tgz, { force: true });
  if (r.status !== 0) throw new Error('Could not unpack the bundle: ' + (r.stderr || '').trim());
  const root = path.join(dest, 'tonezone');
  let man;
  try { man = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8')); } catch { throw new Error('Not a Tone Zone Pi bundle (no manifest).'); }
  for (const [rel, want] of Object.entries(man.files || {})) {
    if (rel.includes('..') || path.isAbsolute(rel)) throw new Error('Bad path in bundle: ' + rel);
    let got;
    try { got = sha256(fs.readFileSync(path.join(root, rel))); } catch { throw new Error('Bundle is missing ' + rel); }
    if (got !== want) throw new Error('Bundle file damaged: ' + rel);
  }
  // nothing outside the manifest besides the manifest itself
  const walk = (d, pre = '') => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name), pre + e.name + '/') : [pre + e.name]));
  for (const f of walk(root)) if (f !== 'manifest.json' && !(f in (man.files || {}))) throw new Error('Unlisted file in bundle: ' + f);
  return { root, manifest: man };
}

// check a bundle without installing it: { ok, signed, version, error }
function check(buf, sig, { allowUnsigned } = {}) {
  const signed = verifySignature(buf, sig);
  if (!signed && !allowUnsigned) return { ok: false, signed: false, error: sig ? 'Bad signature: this bundle was not made by Tone Zone, or it was changed.' : 'The bundle is not signed. Turn on "Allow unsigned dev bundles" to install it anyway.' };
  return { ok: true, signed };
}

// install into the inactive slot and switch to it; the caller restarts the agent
function install(buf, sig, { allowUnsigned, arch } = {}) {
  const c = check(buf, sig, { allowUnsigned });
  if (!c.ok) throw new Error(c.error);
  const cur = currentSlot();
  const target = cur === 'a' ? 'b' : 'a';
  const stage = path.join(hw.DATA, 'tmp', 'stage');
  const { root, manifest } = unpack(buf, stage);
  const want = arch || (hw.FAKE ? 'arm64' : process.arch === 'arm' ? 'armhf' : process.arch);
  if (manifest.arch && manifest.arch !== want) throw new Error(`This bundle is for ${manifest.arch}, the Pi needs ${want}.`);
  const dir = path.join(hw.HOME, target);
  fs.rmSync(dir, { recursive: true, force: true });
  try { fs.renameSync(root, dir); } catch { fs.cpSync(root, dir, { recursive: true }); }
  fs.rmSync(stage, { recursive: true, force: true });
  for (const f of ['engine', 'bin']) {
    const d = path.join(dir, f);
    if (fs.existsSync(d)) for (const n of fs.readdirSync(d)) try { fs.chmodSync(path.join(d, n), 0o755); } catch {}
  }
  writeState({ pending: target, previous: cur, attempts: 0, version: manifest.version, from: version() });
  switchTo(path.join(hw.HOME, target));
  log.info(`update ${manifest.version} installed in slot ${target}${c.signed ? '' : ' (UNSIGNED dev bundle)'}, restarting`, 'agent');
  return { version: manifest.version, slot: target, signed: c.signed };
}

// on start: commit or roll back a pending update after the health check
async function afterStart(healthCheck) {
  const s = readState();
  const me = currentSlot();
  if (!s.pending || s.pending !== me) return { pending: false };
  log.info(`checking update ${version()} (slot ${me})`, 'agent');
  let ok = false, err = null;
  try { ok = await healthCheck(); } catch (e) { err = e.message; }
  if (ok) {
    writeState({ previous: s.previous, version: version(), committed: Date.now() });
    log.info(`update ${version()} is healthy`, 'agent');
    return { pending: true, ok: true };
  }
  log.error(`update failed its health check (${err || 'no sound engine'}), going back to slot ${s.previous}`, 'agent');
  writeState({ failed: me, failedVersion: version(), previous: s.previous });
  switchTo(path.join(hw.HOME, s.previous));
  return { pending: true, ok: false, rollback: true };
}

function rollback() {
  const s = readState();
  const prev = s.previous;
  if (!prev || prev === currentSlot() || !fs.existsSync(path.join(hw.HOME, prev, 'agent'))) throw new Error('No earlier version to go back to.');
  writeState({ previous: currentSlot() });
  switchTo(path.join(hw.HOME, prev));
  log.info(`rolling back to slot ${prev} (${version(path.join(hw.HOME, prev))})`, 'agent');
  return { slot: prev, version: version(path.join(hw.HOME, prev)) };
}

function status() {
  const s = readState();
  const prev = s.previous && fs.existsSync(path.join(hw.HOME, s.previous, 'agent')) ? version(path.join(hw.HOME, s.previous)) : null;
  return { version: version(), slot: currentSlot(), previous: prev, failed: s.failed ? { slot: s.failed, version: s.failedVersion } : null };
}

// ---- GitHub releases: pi-latest.json next to the bundle
async function latest(channel = 'stable') {
  const base = process.env.TZ_RELEASES || `https://github.com/${REPO}/releases`;
  let url = `${base}/latest/download/pi-latest.json`;
  if (channel !== 'stable' && !process.env.TZ_RELEASES) {
    const r = await fetch(`https://api.github.com/repos/${REPO}/releases?per_page=10`, { headers: { Accept: 'application/vnd.github+json' } });
    if (!r.ok) throw new Error(`GitHub: ${r.status}`);
    const rel = (await r.json()).find((x) => (x.assets || []).some((a) => a.name === 'pi-latest.json'));
    if (!rel) throw new Error('No Pi release found.');
    url = rel.assets.find((a) => a.name === 'pi-latest.json').browser_download_url;
  }
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Could not check for updates (${r.status}).`);
  const j = await r.json();
  const rel = (u) => (/^https?:/.test(u) ? u : new URL(u, url).toString());
  return Object.assign(j, { bundleUrl: rel(j.bundle), sigUrl: j.sig ? rel(j.sig) : null });
}
async function download(info) {
  const r = await fetch(info.bundleUrl);
  if (!r.ok) throw new Error(`Download failed (${r.status}).`);
  const buf = Buffer.from(await r.arrayBuffer());
  if (info.sha256 && sha256(buf) !== info.sha256) throw new Error('Download damaged (checksum mismatch).');
  let sig = null;
  if (info.sigUrl) { const s = await fetch(info.sigUrl); if (s.ok) sig = (await s.text()).trim(); }
  return { buf, sig };
}
const newer = (a, b) => {
  const pa = String(a).split(/[.-]/).map((x) => parseInt(x, 10) || 0), pb = String(b).split(/[.-]/).map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0);
  return false;
};

module.exports = { check, install, afterStart, rollback, status, latest, download, version, readState, verifySignature, newer, currentSlot };
