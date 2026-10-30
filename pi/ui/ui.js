// Tone Zone on-device UI. Shown on the Pi's own screen (a kiosk browser on 127.0.0.1) and on phones on the same
// network. Picks presets, turns blocks on and off, edits parameters, tuner and levels. It cannot add, move or
// rewire blocks: that stays in the desktop app. Plain JS, redraws only what changed.
'use strict';
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const el = (tag, attrs, parent, text) => {
    const e = document.createElement(tag);
    for (const k in attrs || {}) if (attrs[k] != null) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  };
  const q = new URLSearchParams(location.search);
  if (q.get('rot')) document.body.style.transform = `rotate(${q.get('rot')}deg)`;
  let token = null;
  try { token = localStorage.getItem('tz.token'); } catch {}
  let st = null; // state from the agent
  let view = 'home', editId = null;
  let ws = null, meters = { in: 0, out: 0 };

  async function api(method, path, body) {
    const h = { 'Content-Type': 'application/json' };
    if (token) h.Authorization = 'Bearer ' + token;
    const r = await fetch(path, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (r.status === 401) { showPair(); throw new Error('not paired'); }
    if (!r.ok) throw new Error(j.error || r.status);
    return j;
  }

  // ---- live connection
  function connect() {
    const url = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws${token ? '?token=' + encodeURIComponent(token) : ''}`;
    ws = new WebSocket(url);
    ws.onopen = () => { $('#offline').hidden = true; ws.send(JSON.stringify({ meters: true })); };
    ws.onclose = () => {
      $('#offline').hidden = false;
      // not paired (phone on the network): ask for the code
      fetch('/api/info').then((r) => r.json()).then((i) => { if (!i.authorized) showPair(); else setTimeout(connect, 1500); }).catch(() => setTimeout(connect, 1500));
    };
    ws.onmessage = (m) => {
      let msg;
      try { msg = JSON.parse(m.data); } catch { return; }
      if (msg.t === 'state') { st = msg.state; theme(); render(); }
      else if (msg.t === 'stats') stats(msg.stats);
      else if (msg.t === 'meter') meter(msg);
      else if (msg.t === 'param' && st && st.preset) {
        const b = st.preset.blocks.find((x) => x.id === msg.id);
        const p = b && b.params.find((x) => x.p === msg.name);
        if (p) { p.value = msg.value; if (view === 'edit' && editId === msg.id && !dragging) render(); }
      } else if (msg.t === 'block' && st && st.preset) {
        const b = st.preset.blocks.find((x) => x.id === msg.id);
        if (b) { b.bypass = msg.bypass; render(); }
      }
    };
  }
  function theme() {
    const t = st && st.config && st.config.display && st.config.display.theme;
    document.documentElement.dataset.theme = t === 'light' ? 'light' : t === 'auto' ? '' : 'dark';
  }
  function stats(s) {
    const dsp = $('#s-dsp'), cpu = $('#s-cpu'), t = $('#s-temp');
    const budget = (st && st.device && st.device.budget) || 70;
    dsp.textContent = `DSP ${Math.round(s.dsp)}%`;
    dsp.className = s.dsp > budget ? 'hot' : s.dsp > budget * 0.8 ? 'warm' : '';
    cpu.textContent = `CPU ${Math.round(s.cpu)}%`;
    t.textContent = `${Math.round(s.temp)} C`;
    t.className = s.temp >= 75 ? 'hot' : s.temp >= 65 ? 'warm' : '';
  }
  const dbw = (v) => Math.max(0, Math.min(100, 100 + (20 * Math.log10(Math.max(1e-5, v))) * (100 / 60)));
  function meter(m) {
    for (const k of ['in', 'out']) {
      const b = $('#m-' + k);
      const w = Math.round(dbw(m[k] || 0));
      if (w !== meters[k]) { b.style.width = w + '%'; b.className = (m[k] || 0) > 0.95 ? 'clip' : ''; meters[k] = w; }
    }
    if (view === 'tuner') tuner(m.tuner);
  }

  // ---- views
  function nav() { for (const b of document.querySelectorAll('#top .nav')) b.classList.toggle('on', b.dataset.view === view || (view === 'edit' && b.dataset.view === 'home')); }
  function render() {
    nav();
    const v = $('#view');
    v.innerHTML = '';
    if (!st) return;
    if (view === 'home') home(v);
    else if (view === 'edit') edit(v);
    else if (view === 'presets') presets(v);
    else if (view === 'tuner') tunerView(v);
  }
  const slotName = (b, s) => `${(st.banks[b] && st.banks[b].name) || 'Bank ' + (b + 1)}  ${'ABCD'[s]}`;

  function home(v) {
    const h = el('div', { class: 'head' }, v);
    el('button', { class: 'step', 'aria-label': 'Previous preset' }, h, '<').onclick = () => api('POST', '/api/select', { action: 'preset-' });
    const n = el('div', { class: 'pname' }, h);
    if (st.pendingBank != null) el('div', { class: 'slot pending' }, n, `${st.banks[st.pendingBank].name}: pick A to D`);
    else el('div', { class: 'slot' }, n, slotName(st.bank, st.slot) + (st.bpm ? `   ${st.bpm} BPM` : ''));
    el('h1', {}, n, st.preset ? st.preset.name : 'No presets yet');
    el('button', { class: 'step', 'aria-label': 'Next preset' }, h, '>').onclick = () => api('POST', '/api/select', { action: 'preset+' });
    const blocks = (st.preset && st.preset.blocks) || [];
    if (!blocks.length) { el('div', { class: 'empty' }, v, st.preset ? 'This preset has no blocks.' : 'Push presets from the Pi tab in the Tone Zone desktop app.'); return; }
    const g = el('div', { class: 'blocks' }, v);
    for (const b of blocks) {
      const t = el('div', { class: 'tile ' + (b.bypass ? 'off' : 'on'), 'data-block': b.id }, g);
      if (b.color) t.style.setProperty('--blk', b.color);
      const tog = el('button', { class: 'tog' }, t);
      el('span', { class: 'n' }, tog, b.name);
      el('span', { class: 'c' }, tog, b.bypass ? 'Off' : 'On');
      tog.style.borderLeftColor = b.bypass ? '' : b.color || '';
      tog.onclick = () => b.canBypass !== false && api('POST', '/api/bypass', { block: b.id, on: !b.bypass });
      if (b.params && b.params.length) el('button', { class: 'ed', 'aria-label': 'Edit ' + b.name }, t, '>').onclick = () => { view = 'edit'; editId = b.id; render(); };
    }
  }

  let dragging = false;
  const fmt = (p, v) => {
    if (p.unit === '0-10') return (((v - p.min) / (p.max - p.min)) * 10).toFixed(1);
    if (p.unit === '%') return Math.round(((v - p.min) / (p.max - p.min)) * 100) + '%';
    if (p.unit === 'dB') return (v > 0 ? '+' : '') + v.toFixed(1) + ' dB';
    if (p.unit === 'ms') return v >= 1000 ? (v / 1000).toFixed(2) + ' s' : Math.round(v) + ' ms';
    return Math.abs(p.max - p.min) <= 2 ? v.toFixed(2) : String(Math.round(v * 10) / 10);
  };
  function edit(v) {
    const b = st.preset && st.preset.blocks.find((x) => x.id === editId);
    if (!b) { view = 'home'; return home(v); }
    const h = el('div', { class: 'edhead' }, v);
    el('button', {}, h, 'Back').onclick = () => { view = 'home'; render(); };
    el('h2', {}, h, b.name);
    const by = el('button', { class: 'byp' + (b.bypass ? '' : ' on') }, h, b.bypass ? 'Off' : 'On');
    by.onclick = () => api('POST', '/api/bypass', { block: b.id, on: !b.bypass });
    for (const p of b.params) {
      const box = el('div', { class: 'param' }, v);
      const row = el('div', { class: 'row' }, box);
      el('span', {}, row, p.label);
      const val = el('b', {}, row);
      if (p.kind === 'knob') {
        val.textContent = fmt(p, p.value);
        const r = el('input', { type: 'range', min: p.min, max: p.max, step: (p.max - p.min) / 200, value: p.value }, box);
        let t = 0;
        r.oninput = () => {
          dragging = true;
          const x = Number(r.value);
          p.value = x;
          val.textContent = fmt(p, x);
          // at most ~30 sends a second while dragging
          if (!t) t = setTimeout(() => { t = 0; api('POST', '/api/param', { block: b.id, name: p.p, value: p.value }).catch(() => {}); }, 33);
        };
        r.onchange = () => { dragging = false; };
      } else {
        const opts = el('div', { class: 'opts' }, box);
        const cur = p.options.find((o) => o.value === p.value);
        val.textContent = cur ? cur.label : '';
        for (const o of p.options) {
          const ob = el('button', { class: o.value === p.value ? 'on' : '' }, opts, o.label);
          ob.onclick = () => { p.value = o.value; api('POST', '/api/param', { block: b.id, name: p.p, value: o.value }); render(); };
        }
      }
    }
  }

  function presets(v) {
    st.banks.forEach((bank, bi) => {
      const box = el('div', { class: 'bank' }, v);
      el('h3', {}, box, bank.name);
      const s = el('div', { class: 'slots' }, box);
      bank.presets.forEach((p, k) => {
        const b = el('button', { class: bi === st.bank && k === st.slot ? 'cur' : '', disabled: p ? null : '' }, s, p ? `${'ABCD'[k]}  ${p.name}` : `${'ABCD'[k]}  empty`);
        b.onclick = () => api('POST', '/api/select', { bank: bi, slot: k }).then(() => { view = 'home'; });
      });
    });
  }

  function tunerView(v) {
    const t = el('div', { class: 'tuner' }, v);
    el('div', { class: 'note' }, t, '-');
    el('b', {}, el('div', { class: 'cents' }, t));
    el('div', { class: 'freq' }, t, st.tuner ? 'Play a string' : '');
    const b = el('button', {}, t, st.tuner ? 'Tuner off (sound back on)' : 'Tuner on (mutes the output)');
    b.onclick = () => api('POST', '/api/tuner', { on: !st.tuner });
  }
  function tuner(tz) {
    const n = $('.tuner .note'), c = $('.tuner .cents b'), f = $('.tuner .freq');
    if (!n) return;
    if (!tz || !tz.note) { n.textContent = '-'; n.className = 'note'; c.style.left = '50%'; return; }
    const ok = Math.abs(tz.cents) < 3;
    n.textContent = tz.note;
    n.className = 'note' + (ok ? ' ok' : '');
    c.style.left = 50 + Math.max(-50, Math.min(50, tz.cents)) + '%';
    c.className = ok ? 'ok' : '';
    f.textContent = `${tz.freq.toFixed(1)} Hz, ${tz.cents > 0 ? '+' : ''}${Math.round(tz.cents)} cents`;
  }

  // ---- pairing for phones on the network
  function showPair() {
    if ($('.pair')) return;
    $('#offline').hidden = true;
    const v = $('#view');
    v.innerHTML = '';
    const p = el('div', { class: 'pair' }, v);
    el('h2', {}, p, 'Pair this device');
    el('p', {}, p, 'Enter the 6 digit code. Run "tonezone pair" on the Pi to see it, or look at the Pi screen.');
    const i = el('input', { inputmode: 'numeric', maxlength: 6, autocomplete: 'one-time-code' }, p);
    const err = el('div', { class: 'err' }, p);
    el('button', {}, p, 'Pair').onclick = async () => {
      try {
        const r = await fetch('/api/pair', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: i.value, client: 'phone ' + (navigator.platform || '') }) });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error);
        token = j.token;
        try { localStorage.setItem('tz.token', token); } catch {}
        v.innerHTML = '';
        connect();
      } catch (e) { err.textContent = e.message; }
    };
  }

  for (const b of document.querySelectorAll('#top .nav')) b.onclick = () => { view = b.dataset.view; render(); };
  connect();
})();
