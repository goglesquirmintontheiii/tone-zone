// In-memory log ring (shown in the desktop Logs section) that also goes to stdout, so journald keeps it.
'use strict';
const { EventEmitter } = require('events');

const lines = [];
const bus = new EventEmitter();
const MAX = 1000;

function log(msg, lvl = 'info', src = 'agent') {
  const line = { t: Date.now(), lvl, src, msg: String(msg) };
  lines.push(line);
  if (lines.length > MAX) lines.shift();
  const out = `[${src}] ${lvl === 'info' ? '' : lvl + ': '}${line.msg}\n`;
  (lvl === 'error' ? process.stderr : process.stdout).write(out);
  bus.emit('line', line);
  return line;
}
const since = (t = 0) => lines.filter((l) => l.t > t);

module.exports = { log, since, bus, info: (m, s) => log(m, 'info', s), warn: (m, s) => log(m, 'warn', s), error: (m, s) => log(m, 'error', s) };
