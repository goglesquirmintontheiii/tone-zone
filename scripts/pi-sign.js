#!/usr/bin/env node
// Signs a Pi bundle: writes <bundle>.sig (base64 Ed25519 signature of the file bytes).
//   TZ_PI_SIGNING_KEY="$(cat key.pem)" node scripts/pi-sign.js pi-bundle-0.9.0-arm64.tar.gz
//   node scripts/pi-sign.js bundle.tar.gz --key key.pem
//   node scripts/pi-sign.js bundle.tar.gz --verify     (checks against the public key in the repo)
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const file = process.argv[2];
const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
if (!file) { console.error('usage: pi-sign.js <bundle> [--key file] [--verify]'); process.exit(2); }
const data = fs.readFileSync(file);
if (process.argv.includes('--verify')) {
  const pub = require(path.join(__dirname, '..', 'pi/agent/lib/release-key.js'));
  const ok = crypto.verify(null, data, pub, Buffer.from(fs.readFileSync(file + '.sig', 'utf8').trim(), 'base64'));
  console.log(ok ? 'signature OK' : 'BAD signature');
  process.exit(ok ? 0 : 1);
}
const pem = arg('--key') ? fs.readFileSync(arg('--key'), 'utf8') : process.env.TZ_PI_SIGNING_KEY;
if (!pem) { console.error('no key: set TZ_PI_SIGNING_KEY or pass --key'); process.exit(2); }
const sig = crypto.sign(null, data, crypto.createPrivateKey(pem)).toString('base64');
fs.writeFileSync(file + '.sig', sig + '\n');
console.log('signed ' + path.basename(file));
