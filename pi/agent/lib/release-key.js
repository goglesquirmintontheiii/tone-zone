// Public half of the Tone Zone Pi release signing key (Ed25519). Update bundles must be signed with the
// private half, which is never in the repo: CI reads it from the TZ_PI_SIGNING_KEY secret (docs/raspberry-pi.md).
// Same key as pi/release-key.pub.pem (used by install.sh). scripts/pi-keygen.js replaces both.
module.exports = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAkgjrdx+47Z++gSDbDm9BrD/R4djJC4w9JY0fO65TBuo=
-----END PUBLIC KEY-----
`;
