// Minimal mDNS / DNS-SD for _tonezone._tcp: a responder (used when Avahi is not running, and in tests) and a
// one shot querier (used by the desktop app). Pure JS, no dependencies.
// The same file is app/main/pi-mdns.js in the desktop app: keep the two identical.
'use strict';
const dgram = require('dgram');
const os = require('os');

const GROUP = '224.0.0.251';
const PORT = Number(process.env.TZ_MDNS_PORT || 5353);
const SERVICE = '_tonezone._tcp.local';
const T = { A: 1, PTR: 12, TXT: 16, SRV: 33, ANY: 255 };

function encName(name) {
  const parts = name.replace(/\.$/, '').split('.');
  const bufs = parts.map((p) => { const b = Buffer.from(p, 'utf8'); return Buffer.concat([Buffer.from([b.length]), b]); });
  return Buffer.concat([...bufs, Buffer.from([0])]);
}
function decName(buf, off, depth = 0) {
  const labels = [];
  let end = -1;
  while (off < buf.length && depth < 20) {
    const len = buf[off];
    if (len === 0) { off++; break; }
    if ((len & 0xc0) === 0xc0) {
      const ptr = ((len & 0x3f) << 8) | buf[off + 1];
      if (end < 0) end = off + 2;
      off = ptr;
      depth++;
      continue;
    }
    labels.push(buf.toString('utf8', off + 1, off + 1 + len));
    off += 1 + len;
  }
  return { name: labels.join('.'), off: end >= 0 ? end : off };
}
function rr(name, type, ttl, data, cacheFlush) {
  const h = Buffer.alloc(10);
  h.writeUInt16BE(type, 0);
  h.writeUInt16BE((cacheFlush ? 0x8000 : 0) | 1, 2);
  h.writeUInt32BE(ttl, 4);
  h.writeUInt16BE(data.length, 8);
  return Buffer.concat([encName(name), h, data]);
}
function packet({ id = 0, response, questions = [], answers = [] }) {
  const h = Buffer.alloc(12);
  h.writeUInt16BE(id, 0);
  h.writeUInt16BE(response ? 0x8400 : 0, 2);
  h.writeUInt16BE(questions.length, 4);
  h.writeUInt16BE(answers.length, 6);
  const qs = questions.map((q) => Buffer.concat([encName(q.name), Buffer.from([0, q.type, 0, 1])]));
  return Buffer.concat([h, ...qs, ...answers]);
}
function parse(buf) {
  const id = buf.readUInt16BE(0), flags = buf.readUInt16BE(2);
  const qd = buf.readUInt16BE(4), an = buf.readUInt16BE(6) + buf.readUInt16BE(8) + buf.readUInt16BE(10);
  let off = 12;
  const questions = [], answers = [];
  for (let i = 0; i < qd; i++) {
    const n = decName(buf, off);
    off = n.off;
    questions.push({ name: n.name, type: buf.readUInt16BE(off) });
    off += 4;
  }
  for (let i = 0; i < an && off < buf.length; i++) {
    const n = decName(buf, off);
    off = n.off;
    const type = buf.readUInt16BE(off), len = buf.readUInt16BE(off + 8);
    const d = off + 10;
    const a = { name: n.name, type };
    if (type === T.PTR) a.data = decName(buf, d).name;
    else if (type === T.SRV) a.data = { port: buf.readUInt16BE(d + 4), target: decName(buf, d + 6).name };
    else if (type === T.A) a.data = [...buf.subarray(d, d + 4)].join('.');
    else if (type === T.TXT) {
      const kv = {};
      for (let p = d; p < d + len;) { const l = buf[p]; const s = buf.toString('utf8', p + 1, p + 1 + l); const k = s.indexOf('='); if (k > 0) kv[s.slice(0, k)] = s.slice(k + 1); p += 1 + l; }
      a.data = kv;
    }
    answers.push(a);
    off = d + len;
  }
  return { id, response: !!(flags & 0x8000), questions, answers };
}

function ipv4s() {
  const out = [];
  for (const list of Object.values(os.networkInterfaces())) for (const a of list || []) if (a.family === 'IPv4' && !a.internal) out.push(a.address);
  return out;
}

// ---- responder: answers PTR / SRV / TXT / A for one instance
function advertise({ instance, host, port, txt = {}, addresses }) {
  const sock = dgram.createSocket({ type: 'udp4', reuseAddr: true });
  const inst = `${instance}.${SERVICE}`;
  const hostName = `${host}.local`;
  const records = () => {
    const txtBuf = Buffer.concat(Object.entries(txt).map(([k, v]) => { const b = Buffer.from(`${k}=${v}`); return Buffer.concat([Buffer.from([b.length]), b]); }));
    const srv = Buffer.alloc(6);
    srv.writeUInt16BE(0, 0); srv.writeUInt16BE(0, 2); srv.writeUInt16BE(port, 4);
    const ips = addresses ? addresses() : ipv4s();
    return [
      rr(SERVICE, T.PTR, 4500, encName(inst)),
      rr(inst, T.SRV, 120, Buffer.concat([srv, encName(hostName)]), true),
      rr(inst, T.TXT, 4500, txtBuf.length ? txtBuf : Buffer.from([0]), true),
      ...ips.map((ip) => rr(hostName, T.A, 120, Buffer.from(ip.split('.').map(Number)), true)),
    ];
  };
  sock.on('message', (msg, rinfo) => {
    let q;
    try { q = parse(msg); } catch { return; }
    if (q.response) return;
    const hit = q.questions.some((x) => (x.name.toLowerCase() === SERVICE && (x.type === T.PTR || x.type === T.ANY)) || x.name.toLowerCase() === inst.toLowerCase() || (x.name.toLowerCase() === hostName.toLowerCase() && (x.type === T.A || x.type === T.ANY)));
    if (!hit) return;
    const legacy = rinfo.port !== PORT; // one shot query: answer straight back, with its id and question
    const out = packet({ id: legacy ? q.id : 0, response: true, questions: legacy ? q.questions : [], answers: records() });
    if (legacy) sock.send(out, rinfo.port, rinfo.address);
    else sock.send(out, PORT, GROUP);
  });
  sock.on('error', () => {});
  sock.bind(PORT, () => {
    try { sock.addMembership(GROUP); } catch {}
    try { sock.setMulticastLoopback(true); sock.setMulticastTTL(255); } catch {}
    try { sock.send(packet({ response: true, answers: records() }), PORT, GROUP); } catch {}
  });
  return { close: () => { try { sock.close(); } catch {} } };
}

// ---- one shot query: resolves to [{ instance, host, port, addresses, txt }]
function browse({ timeout = 1500, host } = {}) {
  return new Promise((resolve) => {
    const sock = dgram.createSocket({ type: 'udp4', reuseAddr: true });
    const found = {};
    const hosts = {};
    sock.on('message', (msg) => {
      let r;
      try { r = parse(msg); } catch { return; }
      if (!r.response) return;
      for (const a of r.answers) {
        if (a.type === T.PTR && a.name.toLowerCase() === SERVICE) found[a.data] = found[a.data] || { instance: a.data.replace('.' + SERVICE, '') };
        if (a.type === T.SRV) Object.assign((found[a.name] = found[a.name] || { instance: a.name.replace('.' + SERVICE, '') }), { port: a.data.port, host: a.data.target });
        if (a.type === T.TXT) Object.assign((found[a.name] = found[a.name] || { instance: a.name.replace('.' + SERVICE, '') }), { txt: a.data });
        if (a.type === T.A) (hosts[a.name.toLowerCase()] = hosts[a.name.toLowerCase()] || new Set()).add(a.data);
      }
    });
    sock.on('error', () => {});
    const q = host ? packet({ id: 7, questions: [{ name: host, type: T.A }] }) : packet({ id: 7, questions: [{ name: SERVICE, type: T.PTR }] });
    sock.bind(0, () => {
      try { sock.setMulticastLoopback(true); } catch {}
      const sendQ = () => { try { sock.send(q, PORT, GROUP); } catch {} };
      sendQ();
      setTimeout(sendQ, 300);
    });
    setTimeout(() => {
      try { sock.close(); } catch {}
      if (host) return resolve([...(hosts[host.toLowerCase()] || [])]);
      resolve(Object.values(found).filter((f) => f.port).map((f) => Object.assign(f, { addresses: [...(hosts[(f.host || '').toLowerCase()] || [])] })));
    }, timeout);
  });
}

module.exports = { advertise, browse, parse, packet, SERVICE };
