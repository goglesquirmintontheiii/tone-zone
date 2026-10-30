// Tiny HTTP router and WebSocket server (RFC 6455, text frames), no dependencies. Runs on Node 18+.
'use strict';
const http = require('http');
const crypto = require('crypto');
const { URL } = require('url');

class Router {
  constructor() { this.routes = []; }
  add(method, pattern, fn, opts = {}) {
    const keys = [];
    const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => (keys.push(k), '([^/]+)')) + '$');
    this.routes.push({ method, re, keys, fn, opts });
  }
  match(method, pathname) {
    for (const r of this.routes) {
      if (r.method !== method && r.method !== '*') continue;
      const m = pathname.match(r.re);
      if (m) {
        const params = {};
        r.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1])));
        return { route: r, params };
      }
    }
    return null;
  }
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let n = 0;
    req.on('data', (c) => {
      n += c.length;
      if (n > limit) { reject(Object.assign(new Error('Too large'), { status: 413 })); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function send(res, status, body, headers = {}) {
  if (Buffer.isBuffer(body) || typeof body === 'string') {
    res.writeHead(status, Object.assign({ 'Content-Length': Buffer.byteLength(body) }, headers));
    res.end(body);
    return;
  }
  const s = JSON.stringify(body === undefined ? { ok: true } : body);
  res.writeHead(status, Object.assign({ 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(s), 'Cache-Control': 'no-store' }, headers));
  res.end(s);
}

// ---- WebSocket
class WsConn {
  constructor(socket, info) {
    this.socket = socket;
    this.info = info;
    this.open = true;
    this.buf = Buffer.alloc(0);
    this.onmessage = null;
    this.onclose = null;
    socket.on('data', (d) => this.data(d));
    socket.on('close', () => this.closed());
    socket.on('error', () => this.closed());
  }
  closed() {
    if (!this.open) return;
    this.open = false;
    if (this.onclose) this.onclose();
  }
  data(d) {
    this.buf = Buffer.concat([this.buf, d]);
    for (;;) {
      if (this.buf.length < 2) return;
      const b0 = this.buf[0], b1 = this.buf[1];
      const op = b0 & 15, masked = b1 & 128;
      let len = b1 & 127, off = 2;
      if (len === 126) { if (this.buf.length < 4) return; len = this.buf.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (this.buf.length < 10) return; len = Number(this.buf.readBigUInt64BE(2)); off = 10; }
      if (len > 1 << 20) { this.socket.destroy(); return; }
      const need = off + (masked ? 4 : 0) + len;
      if (this.buf.length < need) return;
      let payload = this.buf.subarray(off + (masked ? 4 : 0), need);
      if (masked) {
        const mask = this.buf.subarray(off, off + 4);
        payload = Buffer.from(payload);
        for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i & 3];
      }
      this.buf = this.buf.subarray(need);
      if (op === 8) { this.frame(8, Buffer.alloc(0)); this.socket.end(); this.closed(); return; }
      if (op === 9) { this.frame(10, payload); continue; }
      if ((op === 1 || op === 0) && this.onmessage) {
        try { this.onmessage(payload.toString('utf8')); } catch {}
      }
    }
  }
  frame(op, payload) {
    if (!this.open) return;
    const n = payload.length;
    const head = n < 126 ? Buffer.from([128 | op, n]) : n < 65536 ? Buffer.from([128 | op, 126, n >> 8, n & 255]) : Buffer.concat([Buffer.from([128 | op, 127]), (() => { const b = Buffer.alloc(8); b.writeBigUInt64BE(BigInt(n)); return b; })()]);
    try { this.socket.write(Buffer.concat([head, payload])); } catch {}
  }
  send(obj) { this.frame(1, Buffer.from(typeof obj === 'string' ? obj : JSON.stringify(obj))); }
  close() { this.frame(8, Buffer.alloc(0)); try { this.socket.end(); } catch {} this.closed(); }
}

function upgrade(req, socket, onConn) {
  const key = req.headers['sec-websocket-key'];
  if (!key || String(req.headers.upgrade).toLowerCase() !== 'websocket') { socket.destroy(); return; }
  const accept = crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
  socket.setNoDelay(true);
  onConn(new WsConn(socket, {}));
}

// local, private or link-local addresses only: the agent is never meant to be reached from the internet
function isLocalAddress(a) {
  a = String(a || '').replace(/^::ffff:/, '');
  if (a === '::1' || a.startsWith('127.')) return true;
  if (/^10\./.test(a) || /^192\.168\./.test(a) || /^169\.254\./.test(a)) return true;
  const m = a.match(/^172\.(\d+)\./);
  if (m && +m[1] >= 16 && +m[1] <= 31) return true;
  if (/^f[cd]/i.test(a) || /^fe80:/i.test(a)) return true;
  return false;
}
const isLoopback = (a) => { a = String(a || '').replace(/^::ffff:/, ''); return a === '::1' || a.startsWith('127.'); };

function createServer({ router, auth, onWs, staticFiles, maxBody = 512 << 20 }) {
  const srv = http.createServer(async (req, res) => {
    const remote = req.socket.remoteAddress;
    if (!isLocalAddress(remote)) return send(res, 403, { error: 'Only reachable from the local network.' });
    let url;
    try { url = new URL(req.url, 'http://x'); } catch { return send(res, 400, { error: 'bad url' }); }
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-TZ-Signature, X-TZ-Name, X-TZ-Sha256');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    if (req.method === 'OPTIONS') return send(res, 204, '');
    if (!url.pathname.startsWith('/api/')) {
      const f = staticFiles && staticFiles(url.pathname);
      if (f) return send(res, 200, f.body, { 'Content-Type': f.type, 'Cache-Control': 'no-cache' });
      return send(res, 404, { error: 'not found' });
    }
    const m = router.match(req.method, url.pathname);
    if (!m) return send(res, 404, { error: 'not found' });
    const ctx = { req, res, url, params: m.params, query: Object.fromEntries(url.searchParams), remote, loopback: isLoopback(remote) };
    if (!m.route.opts.public && !auth(req, ctx)) return send(res, 401, { error: 'Not paired. Pair this computer with the code shown on the Pi.' });
    try {
      if (m.route.opts.raw) ctx.body = await readBody(req, m.route.opts.limit || maxBody);
      else {
        const b = await readBody(req, 16 << 20);
        ctx.body = b.length ? JSON.parse(b.toString('utf8')) : {};
      }
      const out = await m.route.fn(ctx);
      if (!res.headersSent) send(res, 200, out);
    } catch (e) {
      if (!res.headersSent) send(res, e.status || 400, { error: e.message || String(e) });
    }
  });
  srv.on('upgrade', (req, socket) => {
    if (!isLocalAddress(socket.remoteAddress)) return socket.destroy();
    let url;
    try { url = new URL(req.url, 'http://x'); } catch { return socket.destroy(); }
    if (url.pathname !== '/ws') return socket.destroy();
    const ctx = { req, url, query: Object.fromEntries(url.searchParams), loopback: isLoopback(socket.remoteAddress) };
    if (!auth(req, ctx)) { socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n'); return socket.destroy(); }
    upgrade(req, socket, (ws) => onWs(ws, ctx));
  });
  return srv;
}

module.exports = { Router, createServer, send, isLocalAddress };
