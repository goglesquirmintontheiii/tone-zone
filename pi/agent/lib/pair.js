// Pairing: a 6 digit code (shown on the Pi screen, in `tonezone pair`, the journal, and blinked on the status
// LED) is swapped for a random token the desktop keeps. Only a hash of each token is stored on the Pi.
'use strict';
const crypto = require('crypto');
const store = require('./store');
const log = require('./log');

let code = null;
let fails = 0, lockedUntil = 0;
const hash = (t) => crypto.createHash('sha256').update(String(t)).digest('hex');

function newCode() {
  code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  log.info(`pairing code: ${code}`, 'agent');
  return code;
}
const current = () => code || newCode();

function pair(given, client) {
  if (Date.now() < lockedUntil) throw Object.assign(new Error('Too many wrong codes. Wait 30 seconds and try again.'), { status: 429 });
  const want = current();
  const ok = typeof given === 'string' && given.length === want.length && crypto.timingSafeEqual(Buffer.from(given), Buffer.from(want));
  if (!ok) {
    if (++fails >= 5) { fails = 0; lockedUntil = Date.now() + 30000; }
    throw Object.assign(new Error('Wrong pairing code.'), { status: 403 });
  }
  fails = 0;
  const token = crypto.randomBytes(24).toString('base64url');
  const s = store.get();
  s.tokens = (s.tokens || []).filter((t) => t.client !== client).concat([{ hash: hash(token), client: String(client || 'desktop').slice(0, 60), created: Date.now() }]);
  store.save();
  log.info(`paired with "${client || 'desktop'}"`, 'agent');
  newCode(); // a code works once
  return token;
}

function check(req, ctx) {
  // the screen UI and the tonezone command on the Pi itself (tests turn this off to check pairing)
  if (ctx.loopback && process.env.TZ_LOOPBACK_TRUSTED !== '0') return true;
  const h = String(req.headers.authorization || '');
  const t = h.startsWith('Bearer ') ? h.slice(7) : ctx.query && ctx.query.token;
  if (!t) return false;
  const hh = hash(t);
  const rec = (store.get().tokens || []).find((x) => x.hash === hh);
  if (rec) rec.last = Date.now();
  return !!rec;
}
const paired = () => (store.get().tokens || []).length > 0;
function unpairAll() { store.get().tokens = []; store.save(); newCode(); }

module.exports = { current, newCode, pair, check, paired, unpairAll };
