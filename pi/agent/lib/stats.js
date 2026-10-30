// System numbers for the desktop tab and the screen: CPU (all cores), temperature, memory, throttling.
'use strict';
const os = require('os');
const { spawnSync } = require('child_process');
const hw = require('./hw');

let lastCpu = null;
function cpuTimes() {
  const line = ((hw.FAKE ? require('fs').readFileSync('/proc/stat', 'utf8') : hw.read('/proc/stat', '')) || '').split('\n')[0];
  const v = line.trim().split(/\s+/).slice(1).map(Number);
  if (v.length < 4) return null;
  const idle = v[3] + (v[4] || 0);
  return { idle, total: v.reduce((a, b) => a + b, 0) };
}
function cpuPercent() {
  const now = cpuTimes();
  if (!now) return 0;
  const prev = lastCpu;
  lastCpu = now;
  if (!prev || now.total === prev.total) return 0;
  return Math.max(0, Math.min(100, (100 * (1 - (now.idle - prev.idle) / (now.total - prev.total)))));
}
function tempC() {
  const t = Number(hw.read('/sys/class/thermal/thermal_zone0/temp', '0'));
  return t > 1000 ? t / 1000 : t;
}
function memory() {
  const txt = hw.FAKE ? require('fs').readFileSync('/proc/meminfo', 'utf8') : hw.read('/proc/meminfo', '') || '';
  const k = (n) => Number((txt.match(new RegExp(n + ':\\s+(\\d+)')) || [])[1] || 0) * 1024;
  const total = k('MemTotal') || os.totalmem(), avail = k('MemAvailable') || os.freemem();
  return { total, used: total - avail, pct: total ? (100 * (total - avail)) / total : 0 };
}
// vcgencmd get_throttled: under-voltage and thermal throttling flags (Pi only)
let throttled = { at: 0, v: null };
function throttle() {
  if (hw.FAKE) return { underVoltage: false, throttled: false, raw: '0x0' };
  if (Date.now() - throttled.at > 10000) {
    throttled.at = Date.now();
    const r = spawnSync('vcgencmd', ['get_throttled'], { encoding: 'utf8', timeout: 2000 });
    const m = (r.stdout || '').match(/0x([0-9a-f]+)/i);
    if (m) {
      const n = parseInt(m[1], 16);
      throttled.v = { underVoltage: !!(n & 0x1), throttled: !!(n & 0x4), freqCapped: !!(n & 0x2), past: !!(n & 0x70000), raw: '0x' + m[1] };
    }
  }
  return throttled.v;
}
function governor() {
  return (hw.read('/sys/devices/system/cpu/cpu0/cpufreq/scaling_governor', '') || '').trim() || null;
}

module.exports = { cpuPercent, tempC, memory, throttle, governor };
