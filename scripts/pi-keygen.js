#!/usr/bin/env node
// Makes a new Ed25519 key pair for signing Pi update bundles. Writes the public key into the agent and the
// installer, and the private key to the file you name (default ./tz-pi-signing-key.pem, mode 600).
// Keep the private key out of the repo: put its contents in the GitHub secret TZ_PI_SIGNING_KEY.
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const out = path.resolve(process.argv[2] || 'tz-pi-signing-key.pem');
const ROOT = path.join(__dirname, '..');
if (out.startsWith(ROOT + path.sep)) { console.error('Refusing to write the private key inside the repo.'); process.exit(1); }
const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
fs.writeFileSync(out, privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
const pub = publicKey.export({ type: 'spki', format: 'pem' });
fs.writeFileSync(path.join(ROOT, 'pi/release-key.pub.pem'), pub);
const js = path.join(ROOT, 'pi/agent/lib/release-key.js');
fs.writeFileSync(js, fs.readFileSync(js, 'utf8').replace(/`-----BEGIN PUBLIC KEY-----[\s\S]*?-----END PUBLIC KEY-----\n`/, '`' + pub + '`'));
const inst = path.join(ROOT, 'pi/install.sh');
fs.writeFileSync(inst, fs.readFileSync(inst, 'utf8').replace(/<<'KEY'\n-----BEGIN PUBLIC KEY-----[\s\S]*?-----END PUBLIC KEY-----\n/, "<<'KEY'\n" + pub));
console.log(`private key: ${out}\npublic key written to pi/release-key.pub.pem, pi/agent/lib/release-key.js and pi/install.sh`);
console.log('Pis installed with the old key will refuse bundles signed with the new one (reinstall them).');
