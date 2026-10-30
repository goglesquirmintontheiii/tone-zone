#!/usr/bin/env node
// Runs the Pi agent's engine self test (a short offline render) on the aarch64 engine, under qemu-user when the
// host is not ARM. Used in CI.   node scripts/pi-qemu-selftest.js [engine]
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
process.env.TZ_FAKE_HW = '1';
process.env.TZ_DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'tzq-'));
const bin = path.resolve(process.argv[2] || path.join(__dirname, '../engine/dist-pi/tonezone-engine-arm64'));
let run = bin;
if (process.arch !== 'arm64') {
  run = path.join(process.env.TZ_DATA, 'engine.sh');
  fs.writeFileSync(run, `#!/bin/sh\nexec qemu-aarch64 -L ${process.env.TZ_QEMU_SYSROOT || '/usr/aarch64-linux-gnu'} "${bin}" "$@"\n`, { mode: 0o755 });
}
const r = require('../pi/agent/lib/engine.js').selfTest(run);
console.log(`ARM engine self test ok: ${r.ms} ms, peak ${r.peak.toFixed(3)}`);
