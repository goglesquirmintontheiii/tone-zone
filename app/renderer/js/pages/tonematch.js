// Tone Match tab: bring in a song (file or YouTube), optionally isolate its tracks with an AI model, listen to
// the stems, then let Tone Zone build a rig that reproduces the guitar / bass tone.
import { el, esc, toast, bus } from '../util.js';
import { modal, confirmDlg, prompt } from '../menus.js';
import { allDefs, brandOf, isOriginal, getDef } from '../catalog/index.js';
import { state, loadPreset, markDirty, buildGraph } from '../state.js';
import { DEPTHS, runSearch, rigPreset } from '../tonematch/search.js';

const STEM_INFO = {
  mix: ['Full mix', '#9aa4b8'],
  guitar: ['Guitars', '#ff7a2f'],
  guitar_rhythm: ['Rhythm guitar (est.)', '#ffb02f'],
  guitar_lead: ['Lead guitar (est.)', '#ff3d6e'],
  bass: ['Bass', '#4fc3f7'],
  drums: ['Drums', '#b388ff'],
  vocals: ['Vocals', '#69f0ae'],
  piano: ['Piano / keys', '#ffd54f'],
  other: ['Other', '#90a4ae'],
  centre: ['Centre (no-AI split)', '#80cbc4'],
  sides: ['Sides (no-AI split)', '#f48fb1'],
};
const stemLabel = (n) => (STEM_INFO[n] || [n.replace(/_/g, ' ')])[0];
const stemColor = (n) => (STEM_INFO[n] || [0, '#8a93a6'])[1];

const V = {
  projects: [],
  cur: null, // project meta
  ai: null,
  aiBusy: null, // { p, label, log: [] }
  sepBusy: null,
  ytBusy: null,
  match: null, // { p, stage, cancelled }
  opts: null,
  custom: false,
};
const defaultOpts = () => ({ depth: 'balanced', instrument: 'guitar', character: 'auto', sources: 'all', brands: [], drives: true, eq: true, timefx: true, usePreamps: true, usePacks: false, di: null, diLabel: 'Built-in DI clip' });

// ------------------------------------------------------------------ audio player (Web Audio, stems in sync)
const player = {
  ctx: null, buffers: new Map(), gains: new Map(), srcs: [], t0: 0, offset: 0, playing: false, on: new Set(['mix']), solo: null, vol: new Map(),
  ensure() {
    if (!this.ctx) this.ctx = new AudioContext({ latencyHint: 'playback', sampleRate: 48000 }); // 48 kHz = the engine's render rate
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  },
  async load(name, file) {
    if (this.buffers.has(name)) return this.buffers.get(name);
    const bytes = await window.tz.tm.readFile(file);
    const buf = await this.ensure().decodeAudioData(bytes);
    this.buffers.set(name, buf);
    return buf;
  },
  duration() {
    let d = 0;
    for (const b of this.buffers.values()) d = Math.max(d, b.duration);
    return d;
  },
  position() {
    return this.playing ? this.offset + (this.ctx.currentTime - this.t0) : this.offset;
  },
  audible(n) {
    return this.solo ? this.solo === n : this.on.has(n);
  },
  applyGains() {
    for (const [n, g] of this.gains) g.gain.setTargetAtTime(this.audible(n) ? this.vol.get(n) ?? 1 : 0, this.ctx.currentTime, 0.015);
  },
  play(from = this.offset, range = null) {
    this.stop(true);
    const ctx = this.ensure();
    this.offset = from;
    this.t0 = ctx.currentTime + 0.05;
    this.gains.clear();
    for (const [n, b] of this.buffers) {
      if (n.startsWith('preview:')) continue;
      const s = ctx.createBufferSource();
      s.buffer = b;
      const g = ctx.createGain();
      g.gain.value = this.audible(n) ? this.vol.get(n) ?? 1 : 0;
      s.connect(g).connect(ctx.destination);
      if (range) s.start(this.t0, from, Math.max(0.05, range[1] - from));
      else s.start(this.t0, from);
      this.srcs.push(s);
      this.gains.set(n, g);
    }
    this.playing = true;
    this.range = range;
    const end = (range ? range[1] : this.duration()) - from;
    clearTimeout(this.endT);
    this.endT = setTimeout(() => { this.stop(); this.offset = range ? range[0] : 0; bus.emit('tm:player'); }, end * 1000 + 120);
    bus.emit('tm:player');
  },
  playOne(buf) {
    this.stop();
    const ctx = this.ensure();
    const s = ctx.createBufferSource();
    s.buffer = buf;
    s.connect(ctx.destination);
    s.start();
    this.srcs.push(s);
    this.playing = 'preview';
    this.t0 = ctx.currentTime;
    this.offset = 0;
    clearTimeout(this.endT);
    this.endT = setTimeout(() => { this.stop(); bus.emit('tm:player'); }, buf.duration * 1000 + 100);
    bus.emit('tm:player');
  },
  stop(keep = false) {
    if (this.playing === true && !keep) this.offset = this.position();
    for (const s of this.srcs) try { s.stop(); } catch {}
    this.srcs = [];
    this.playing = false;
    clearTimeout(this.endT);
    bus.emit('tm:player');
  },
  reset() {
    this.stop();
    this.buffers.clear();
    this.offset = 0;
    this.solo = null;
    this.on = new Set(['mix']);
    this.vol.clear();
  },
};

// ------------------------------------------------------------------ page
let root = null, wired = false;
export async function renderToneMatch() {
  root = document.getElementById('view-tonematch');
  if (!wired) {
    wired = true;
    window.tz.tm.onProgress(onProgress);
    window.tz.tm.onLog(onLog);
    bus.on('tm:player', () => drawTransport());
  }
  V.projects = await window.tz.tm.list();
  if (!V.ai) window.tz.tm.aiStatus().then((s) => { V.ai = s; if (V.cur) drawIsolation(); });
  draw();
}

function onProgress(d) {
  const t = { 'ai-install': 'aiBusy', separate: 'sepBusy', youtube: 'ytBusy', 'ytdlp-install': 'ytBusy' }[d.task];
  if (!t || !V[t]) return;
  Object.assign(V[t], { p: d.p, label: d.label || V[t].label });
  paintBusy(t);
}
function onLog(d) {
  const t = { 'ai-install': 'aiBusy', separate: 'sepBusy' }[d.task];
  if (!t || !V[t]) return;
  V[t].log.push(d.line);
  if (V[t].log.length > 400) V[t].log.splice(0, 100);
  const lg = root.querySelector(`[data-log="${t}"]`);
  if (lg) { lg.textContent = V[t].log.slice(-60).join('\n'); lg.scrollTop = 1e9; }
}
function paintBusy(t) {
  const b = V[t];
  const bar = root.querySelector(`[data-bar="${t}"]`);
  if (bar) bar.style.transform = `scaleX(${Math.max(0.01, Math.min(1, b.p || 0))})`;
  const lb = root.querySelector(`[data-label="${t}"]`);
  if (lb) lb.textContent = `${b.label || ''}${b.p ? ' · ' + Math.round(b.p * 100) + '%' : ''}`;
}
const progressHTML = (t, label) => `<div class="tm-prog"><div class="tm-prog-bar"><i data-bar="${t}"></i></div><div class="tm-prog-label" data-label="${t}">${esc(label || '')}</div></div>`;

function draw() {
  root.innerHTML = '';
  const wrap = el('div', { class: 'tm' }, root);
  const side = el('aside', { class: 'tm-side' }, wrap);
  const main = el('div', { class: 'tm-main page' }, wrap);
  drawSide(side);
  if (!V.cur) drawHome(main);
  else drawProject(main);
}

function drawSide(side) {
  el('div', { class: 'tm-side-h' }, side, '<b>Projects</b>');
  const nb = el('button', { class: 'btn small btn-accent' }, side.firstChild, '<i class="ic ic-plus"></i>New');
  nb.onclick = () => { V.cur = null; player.reset(); draw(); };
  const list = el('div', { class: 'tm-plist' }, side);
  if (!V.projects.length) el('p', { class: 'hint' }, list).textContent = 'Nothing yet – add a song to start.';
  for (const p of V.projects) {
    const it = el('div', { class: 'tm-pitem' + (V.cur && V.cur.id === p.id ? ' on' : '') }, list);
    el('div', { class: 'tm-pico' }, it, `<i class="ic ${p.url ? 'ic-play' : 'ic-wave'}"></i>`);
    const t = el('div', { class: 'tm-pt' }, it);
    el('b', {}, t).textContent = p.title;
    const n = Object.keys(p.stems || {}).length;
    el('span', {}, t).textContent = `${p.duration ? fmtTime(p.duration) : '–'}${n > 1 ? ` · ${n} tracks` : ''}${p.result ? ` · ${p.result.best.score}% match` : ''}`;
    it.onclick = () => openProject(p.id);
    it.oncontextmenu = async (e) => {
      e.preventDefault();
      if (await confirmDlg('Delete project', `Delete “${p.title}” and its tracks?`, 'Delete', true)) {
        await window.tz.tm.remove(p.id);
        if (V.cur && V.cur.id === p.id) { V.cur = null; player.reset(); }
        V.projects = await window.tz.tm.list();
        draw();
      }
    };
  }
}

// ------------------------------------------------------------------ home: add a source
function drawHome(main) {
  const head = el('div', { class: 'page-head' }, main);
  el('div', {}, head, '<h1>Tone Match</h1><p>Give Tone Zone a recording. It can split out the guitar, bass and other parts with an AI model, then build a rig from your amps, cabs and pedals (plugins included) that sounds like it.</p>');
  const grid = el('div', { class: 'tm-src-grid' }, main);
  // drop / file
  const drop = el('div', { class: 'tm-drop' }, grid, '<i class="ic ic-import"></i><b>Drop an audio file</b><span>WAV, MP3, FLAC, OGG, M4A, WebM… or click to browse</span>');
  drop.onclick = async () => {
    const p = await window.tz.tm.pickFile();
    if (p) await afterImport(p);
  };
  drop.ondragover = (e) => { e.preventDefault(); drop.classList.add('over'); };
  drop.ondragleave = () => drop.classList.remove('over');
  drop.ondrop = async (e) => {
    e.preventDefault();
    drop.classList.remove('over');
    const f = e.dataTransfer.files[0];
    if (!f) return;
    const meta = await window.tz.tm.create(f.name.replace(/\.[^.]+$/, ''));
    await decodeAndStore(meta, await f.arrayBuffer());
  };
  // youtube
  const yt = el('div', { class: 'tm-yt' }, grid);
  el('div', { class: 'tm-yt-h' }, yt, '<i class="ic ic-play"></i><b>YouTube or another link</b>');
  el('p', { class: 'hint' }, yt).textContent = 'Downloads the audio with yt-dlp. Only use recordings you have the right to use.';
  const row = el('div', { class: 'tm-yt-row' }, yt);
  const inp = el('input', { type: 'text', placeholder: 'https://www.youtube.com/watch?v=…', spellcheck: 'false' }, row);
  const go = el('button', { class: 'btn btn-accent' }, row, 'Fetch');
  const busy = el('div', {}, yt);
  const fetchIt = async () => {
    const url = inp.value.trim();
    if (!/^https?:\/\//.test(url)) return toast('Paste a full link (https://…)', 'warn');
    if (!(await window.tz.tm.ytdlp())) {
      const ok = await ytdlpDialog();
      if (!ok) return;
    }
    V.ytBusy = { p: 0, label: 'Downloading audio' };
    go.disabled = true;
    busy.innerHTML = progressHTML('ytBusy', 'Downloading audio');
    try {
      const meta = await window.tz.tm.youtube(url);
      V.ytBusy = null;
      await afterImport(meta);
    } catch (e) {
      toast('Download failed: ' + cleanErr(e), 'error', 6000);
    } finally {
      V.ytBusy = null;
      go.disabled = false;
      busy.innerHTML = '';
    }
  };
  go.onclick = fetchIt;
  inp.onkeydown = (e) => e.key === 'Enter' && fetchIt();
  // how it works
  const how = el('div', { class: 'tm-how' }, main);
  [
    ['ic-import', 'Add a song', 'A file from disk or a link. Pick the part of the song you want to match.'],
    ['ic-magic', 'Isolate tracks (optional)', 'A one-time AI download splits rhythm guitar, lead, bass, drums, vocals and piano. Your GPU is used if you have one.'],
    ['ic-wave', 'Listen', 'Play any combination of tracks to check what you are matching.'],
    ['ic-board', 'Match', 'One click tries amps, cabs, drives, EQ and ambience from every enabled plugin and puts the closest rig on your board.'],
  ].forEach(([ic, t, d], i) => el('div', { class: 'tm-step' }, how, `<span>${i + 1}</span><i class="ic ${ic}"></i><b>${t}</b><p>${d}</p>`));
}
function cleanErr(e) {
  return String(e && e.message ? e.message : e).replace(/^Error invoking remote method '[^']+': (Error: )?/, '');
}
function ytdlpDialog() {
  return new Promise((resolve) => {
    const body = el('div', {});
    el('p', { style: 'margin:0 0 10px;color:var(--text2)' }, body).textContent = 'Tone Zone uses yt-dlp to download audio from YouTube and other sites. It is not installed on this computer.';
    el('p', { class: 'hint', style: 'margin:0' }, body).textContent = 'One click downloads the official yt-dlp release (about 35 MB) into Tone Zone’s own folder – nothing is installed system-wide. You can also install it with your package manager instead.';
    const prog = el('div', { style: 'margin-top:12px' }, body);
    let done = false;
    const md = modal({
      title: 'yt-dlp is needed',
      body,
      buttons: [
        { label: 'Cancel', value: false },
        {
          label: '<i class="ic ic-down"></i>Download yt-dlp',
          cls: 'btn-accent',
          onClick: async () => {
            V.ytBusy = { p: 0, label: 'Downloading yt-dlp' };
            prog.innerHTML = progressHTML('ytBusy', 'Downloading yt-dlp');
            try {
              await window.tz.tm.installYtdlp();
              toast('yt-dlp installed', 'ok', 1600);
              done = true;
              return true;
            } catch (e) {
              toast('Could not download yt-dlp: ' + cleanErr(e), 'error', 6000);
              return false;
            } finally {
              V.ytBusy = null;
            }
          },
        },
      ],
      onClose: (v) => resolve(!!v || done),
    });
    return md;
  });
}

export async function afterImport(meta) {
  try {
    const bytes = await window.tz.tm.readFile(meta.original);
    await decodeAndStore(meta, bytes);
  } catch (e) {
    toast('Could not decode that audio: ' + cleanErr(e), 'error', 6000);
  }
}
async function decodeAndStore(meta, bytes) {
  toast('Decoding audio…', 'info', 1200);
  const buf = await player.ensure().decodeAudioData(bytes);
  const chans = [];
  for (let c = 0; c < Math.min(2, buf.numberOfChannels); c++) chans.push(buf.getChannelData(c));
  meta = await window.tz.tm.writeSource(meta.id, chans, buf.sampleRate);
  meta.stems = Object.assign({ mix: meta.source }, meta.stems);
  meta.targets = ['mix'];
  meta = await window.tz.tm.save(meta);
  V.projects = await window.tz.tm.list();
  await openProject(meta.id);
}

async function openProject(id) {
  player.reset();
  V.cur = await window.tz.tm.get(id);
  if (!V.cur) return;
  V.cur.stems = Object.assign({ mix: V.cur.source }, V.cur.stems);
  V.cur.targets = V.cur.targets || [V.cur.stems.guitar ? 'guitar' : 'mix'];
  V.opts = Object.assign(defaultOpts(), V.cur.opts || {});
  draw();
  await loadStems();
}
async function loadStems() {
  const p = V.cur;
  for (const [n, f] of Object.entries(p.stems)) {
    try { await player.load(n, f); } catch (e) { console.warn('stem', n, e); }
  }
  if (V.cur !== p) return;
  drawWave();
  drawTracks();
  drawMatch();
  redrawSide();
}
function redrawSide() {
  const side = root && root.querySelector('.tm-side');
  if (!side) return;
  side.innerHTML = '';
  drawSide(side);
}
const save = async () => { V.cur = await window.tz.tm.save(V.cur); };

// ------------------------------------------------------------------ project view
let wave = null;
function drawProject(main) {
  const p = V.cur;
  const head = el('div', { class: 'page-head' }, main);
  const ht = el('div', {}, head);
  const h1 = el('h1', { class: 'tm-title', title: 'Rename' }, ht);
  h1.textContent = p.title;
  h1.onclick = async () => {
    const n = await prompt('Rename project', p.title);
    if (n) { p.title = n; await save(); V.projects = await window.tz.tm.list(); draw(); }
  };
  el('p', {}, ht).textContent = `${fmtTime(p.duration || 0)} · ${p.sr || 48000} Hz${p.url ? ' · from a link' : ''}`;
  // 1. source + range
  const s1 = section(main, '1', 'Source', 'Drag across the waveform to choose the part to match (a riff or solo works best). Leave it empty to use the whole song.');
  wave = el('div', { class: 'tm-wave' }, s1);
  el('canvas', {}, wave);
  el('div', { class: 'tm-sel' }, wave);
  el('div', { class: 'tm-head' }, wave);
  const tr = el('div', { class: 'tm-transport' }, s1);
  tr.dataset.role = 'transport';
  wireWave();
  drawTransport();
  // 2. isolation
  const s2 = section(main, '2', 'Track isolation', 'Optional. Split the song into parts so the match listens only to the guitar (or bass).');
  s2.dataset.role = 'iso';
  // 3. tracks
  const s3 = section(main, '3', 'Tracks', 'Play any mix of tracks. Tick “Match” on the parts the rig should sound like.');
  s3.dataset.role = 'tracks';
  // 4. match
  const s4 = section(main, '4', 'Match the tone', '');
  s4.dataset.role = 'match';
  drawIsolation();
  drawTracks();
  drawMatch();
}
function section(parent, n, title, sub) {
  const s = el('section', { class: 'tm-sec' }, parent);
  el('header', {}, s, `<span class="tm-n">${n}</span><div><h2>${esc(title)}</h2>${sub ? `<p>${esc(sub)}</p>` : ''}</div>`);
  return el('div', { class: 'tm-sec-body' }, s);
}
const q = (role) => root.querySelector(`[data-role="${role}"]`);

// ---- waveform + selection
function drawWave() {
  if (!wave || !wave.isConnected) return;
  const cv = wave.querySelector('canvas');
  const w = wave.clientWidth, h = wave.clientHeight;
  cv.width = w * devicePixelRatio;
  cv.height = h * devicePixelRatio;
  const g = cv.getContext('2d');
  g.scale(devicePixelRatio, devicePixelRatio);
  g.clearRect(0, 0, w, h);
  const layers = [...player.buffers.entries()].filter(([n]) => !n.startsWith('preview:') && (n === 'mix' || player.audible(n)));
  for (const [n, b] of layers.sort((a) => (a[0] === 'mix' ? -1 : 1))) {
    const d = b.getChannelData(0), step = Math.max(1, Math.floor(d.length / w));
    g.fillStyle = stemColor(n) + (n === 'mix' ? '55' : 'cc');
    for (let x = 0; x < w; x++) {
      let pk = 0;
      for (let i = x * step, e = Math.min(d.length, i + step); i < e; i += 4) pk = Math.max(pk, Math.abs(d[i]));
      const y = Math.min(1, pk) * (h / 2 - 2);
      g.fillRect(x, h / 2 - y, 1, y * 2 || 1);
    }
  }
  drawSel();
}
function drawSel() {
  if (!wave) return;
  const sel = wave.querySelector('.tm-sel');
  const D = V.cur.duration || player.duration() || 1;
  const r = V.cur.range;
  if (!r) sel.style.display = 'none';
  else Object.assign(sel.style, { display: 'block', left: (r[0] / D) * 100 + '%', width: ((r[1] - r[0]) / D) * 100 + '%' });
}
function wireWave() {
  let start = null;
  const tOf = (e) => {
    const rc = wave.getBoundingClientRect();
    return Math.max(0, Math.min(1, (e.clientX - rc.left) / rc.width)) * (V.cur.duration || player.duration());
  };
  wave.onpointerdown = (e) => {
    wave.setPointerCapture(e.pointerId);
    start = tOf(e);
    V.cur.range = null;
    drawSel();
  };
  wave.onpointermove = (e) => {
    if (start === null) return;
    const t = tOf(e);
    if (Math.abs(t - start) > 0.15) V.cur.range = [Math.min(t, start), Math.max(t, start)];
    drawSel();
  };
  wave.onpointerup = (e) => {
    if (start === null) return;
    const t = tOf(e);
    if (!V.cur.range) { player.offset = t; if (player.playing === true) player.play(t); }
    else player.offset = V.cur.range[0];
    start = null;
    save();
    drawTransport();
  };
  new ResizeObserver(() => drawWave()).observe(wave);
}
let headT = null;
function drawTransport() {
  const tr = q('transport');
  if (!tr) return;
  tr.innerHTML = '';
  const r = V.cur.range;
  const pb = el('button', { class: 'btn btn-accent small' }, tr, player.playing === true ? '<i class="ic ic-pause"></i>Pause' : '<i class="ic ic-play"></i>Play');
  pb.onclick = () => {
    if (player.playing === true) player.stop();
    else {
      let from = player.offset;
      if (r && (from < r[0] || from >= r[1])) from = r[0];
      player.play(from, r);
    }
  };
  if (r) {
    const lp = el('button', { class: 'btn small' }, tr, '<i class="ic ic-play"></i>Play selection');
    lp.onclick = () => player.play(r[0], r);
    el('span', { class: 'tm-range' }, tr).textContent = `Selection ${fmtTime(r[0])} – ${fmtTime(r[1])} (${(r[1] - r[0]).toFixed(1)} s)`;
    const cl = el('button', { class: 'btn small btn-ghost' }, tr, '<i class="ic ic-x"></i>Whole song');
    cl.onclick = () => { V.cur.range = null; save(); drawSel(); drawTransport(); };
  } else el('span', { class: 'tm-range' }, tr).textContent = 'Whole song';
  const tm = el('span', { class: 'tm-clock' }, tr);
  clearInterval(headT);
  const tick = () => {
    if (!wave || !wave.isConnected) return clearInterval(headT);
    const pos = player.playing === true ? player.position() : player.offset;
    tm.textContent = `${fmtTime(pos)} / ${fmtTime(V.cur.duration || 0)}`;
    const hd = wave.querySelector('.tm-head');
    hd.style.left = (pos / (V.cur.duration || 1)) * 100 + '%';
  };
  tick();
  if (player.playing === true) headT = setInterval(tick, 50);
}
function fmtTime(s) {
  s = Math.max(0, s || 0);
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}

// ---- 2. isolation
function drawIsolation() {
  const box = q('iso');
  if (!box) return;
  box.innerHTML = '';
  const ai = V.ai;
  const sep = V.cur.separated;
  const cards = el('div', { class: 'tm-iso' }, box);
  const aiCard = el('div', { class: 'tm-card' }, cards);
  el('div', { class: 'tm-card-h' }, aiCard, '<i class="ic ic-magic"></i><b>AI separation</b><span class="tm-tag">Demucs 6-stem</span>');
  if (V.sepBusy) {
    el('p', {}, aiCard).textContent = 'Separating… this takes about a quarter of the song length on an NVIDIA GPU and a few times the song length on a CPU.';
    aiCard.insertAdjacentHTML('beforeend', progressHTML('sepBusy', V.sepBusy.label || 'Starting'));
    const lg = el('pre', { class: 'tm-log', 'data-log': 'sepBusy' }, aiCard);
    lg.textContent = V.sepBusy.log.slice(-60).join('\n');
    const c = el('button', { class: 'btn small btn-danger' }, aiCard, 'Cancel');
    c.onclick = () => window.tz.tm.cancelSeparate();
    paintBusy('sepBusy');
  } else if (V.aiBusy) {
    el('p', {}, aiCard).textContent = 'Setting up the AI model. This is a one-time download.';
    aiCard.insertAdjacentHTML('beforeend', progressHTML('aiBusy', V.aiBusy.label || 'Starting'));
    const lg = el('pre', { class: 'tm-log', 'data-log': 'aiBusy' }, aiCard);
    lg.textContent = V.aiBusy.log.slice(-60).join('\n');
    paintBusy('aiBusy');
  } else if (!ai) {
    el('p', { class: 'hint' }, aiCard).textContent = 'Checking the AI setup…';
  } else if (!ai.ready) {
    el('p', {}, aiCard).textContent = 'Separating tracks needs an AI model (Demucs, about 80 MB) and its runtime (PyTorch). Tone Zone keeps it in a private folder, and you can remove it in one click.';
    if (!ai.python) el('p', { class: 'tm-warn' }, aiCard).textContent = 'Python 3 was not found. Install it with your package manager first (for example: sudo apt install python3 python3-venv).';
    const row = el('div', { class: 'row' }, aiCard);
    const g = el('button', { class: 'btn btn-accent' }, row, '<i class="ic ic-down"></i>Download for NVIDIA GPU (~2.5 GB)');
    const c = el('button', { class: 'btn' }, row, '<i class="ic ic-down"></i>CPU only (~800 MB)');
    g.onclick = () => installAi('cuda');
    c.onclick = () => installAi('cpu');
    if (!ai.python) g.disabled = c.disabled = true;
  } else {
    el('p', {}, aiCard).innerHTML = `Ready – runs on <b>${esc(ai.cuda ? ai.device : 'CPU')}</b>${ai.cuda ? '' : ' (slower; an NVIDIA GPU makes this ~10× faster)'}.` + (sep ? ` Last split: ${new Date(sep.at).toLocaleString()} on ${esc(sep.device)}.` : '');
    const opt = el('div', { class: 'tm-opts' }, aiCard);
    const split = el('label', { class: 'tm-check' }, opt, '<input type="checkbox" checked> Also estimate rhythm vs. lead guitar');
    const hq = el('label', { class: 'tm-check' }, opt, '<input type="checkbox"> Higher quality (slower)');
    const row = el('div', { class: 'row' }, aiCard);
    const b = el('button', { class: 'btn btn-accent' }, row, `<i class="ic ic-magic"></i>${sep ? 'Separate again' : 'Separate tracks'}`);
    b.onclick = () => separate({ splitGuitar: split.querySelector('input').checked, shifts: hq.querySelector('input').checked ? 3 : 1 });
    const rm = el('button', { class: 'btn small btn-ghost' }, row, 'Remove AI model');
    rm.onclick = async () => {
      if (!(await confirmDlg('Remove AI model', 'Delete the downloaded model and runtime? Separated tracks in your projects are kept.', 'Remove', true))) return;
      await window.tz.tm.aiRemove();
      V.ai = await window.tz.tm.aiStatus();
      drawIsolation();
    };
  }
  // no-AI options
  const quick = el('div', { class: 'tm-card' }, cards);
  el('div', { class: 'tm-card-h' }, quick, '<i class="ic ic-wave"></i><b>Without AI</b>');
  el('p', {}, quick).textContent = 'Skip isolation and match against the full mix, or use a quick stereo split: guitars are often panned left / right while vocals, bass and solos sit in the centre.';
  const row = el('div', { class: 'row' }, quick);
  const qs = el('button', { class: 'btn' }, row, 'Quick stereo split');
  qs.onclick = quickSplit;
  const sk = el('button', { class: 'btn btn-ghost' }, row, 'Use the full mix');
  sk.onclick = () => { V.cur.targets = ['mix']; save(); drawTracks(); q('match').scrollIntoView({ behavior: 'smooth' }); };
}
async function installAi(kind) {
  V.aiBusy = { p: 0.01, label: 'Starting', log: [] };
  drawIsolation();
  try {
    V.ai = await window.tz.tm.aiInstall(kind);
    toast('AI model ready', 'ok', 2000);
  } catch (e) {
    toast('AI setup failed: ' + cleanErr(e), 'error', 8000);
    V.ai = await window.tz.tm.aiStatus();
  }
  V.aiBusy = null;
  drawIsolation();
}
async function separate(o) {
  V.sepBusy = { p: 0.01, label: 'Starting', log: [] };
  drawIsolation();
  try {
    const meta = await window.tz.tm.separate(V.cur.id, o);
    V.cur = Object.assign(meta, { stems: Object.assign({ mix: meta.source }, meta.stems) });
    const hasG = V.cur.stems.guitar;
    V.cur.targets = hasG ? ['guitar'] : ['mix'];
    await save();
    for (const n of Object.keys(V.cur.stems)) player.buffers.delete(n);
    player.on = new Set([hasG ? 'guitar' : 'mix']);
    toast('Tracks separated', 'ok', 2000);
  } catch (e) {
    if (!/SIGTERM|exit null/.test(String(e))) toast('Separation failed: ' + cleanErr(e), 'error', 8000);
  }
  V.sepBusy = null;
  V.projects = await window.tz.tm.list();
  redrawSide();
  drawIsolation();
  await loadStems();
}
async function quickSplit() {
  const b = player.buffers.get('mix');
  if (!b) return;
  if (b.numberOfChannels < 2) return toast('This recording is mono – a stereo split is not possible', 'warn');
  const L = b.getChannelData(0), R = b.getChannelData(1);
  const n = L.length;
  const cL = new Float32Array(n), cR = new Float32Array(n), sL = new Float32Array(n), sR = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const m = 0.5 * (L[i] + R[i]), s = 0.5 * (L[i] - R[i]);
    cL[i] = cR[i] = m;
    sL[i] = s;
    sR[i] = -s;
  }
  await window.tz.tm.writeStem(V.cur.id, 'centre', [cL, cR], b.sampleRate);
  const meta = await window.tz.tm.writeStem(V.cur.id, 'sides', [sL, sR], b.sampleRate);
  V.cur = Object.assign(meta, { stems: Object.assign({ mix: meta.source }, meta.stems) });
  V.cur.targets = ['sides'];
  await save();
  player.buffers.delete('centre');
  player.buffers.delete('sides');
  toast('Split into centre and sides', 'ok', 1600);
  await loadStems();
}

// ---- 3. tracks
function drawTracks() {
  const box = q('tracks');
  if (!box) return;
  box.innerHTML = '';
  const order = ['mix', 'guitar', 'guitar_rhythm', 'guitar_lead', 'bass', 'drums', 'vocals', 'piano', 'other', 'centre', 'sides'];
  const names = Object.keys(V.cur.stems).sort((a, b) => (order.indexOf(a) + 99 * (order.indexOf(a) < 0)) - (order.indexOf(b) + 99 * (order.indexOf(b) < 0)));
  const list = el('div', { class: 'tm-tracks' }, box);
  for (const n of names) {
    const loaded = player.buffers.has(n);
    const row = el('div', { class: 'tm-track' + (player.audible(n) ? ' live' : '') }, list);
    row.style.setProperty('--c', stemColor(n));
    const on = el('button', { class: 'tm-ear' + (player.on.has(n) ? ' on' : ''), title: 'Listen' }, row, '<i class="ic ic-play"></i>');
    on.onclick = () => { player.on.has(n) ? player.on.delete(n) : player.on.add(n); player.applyGains(); drawTracks(); drawWave(); };
    const so = el('button', { class: 'tm-solo' + (player.solo === n ? ' on' : ''), title: 'Solo' }, row, 'S');
    so.onclick = () => { player.solo = player.solo === n ? null : n; player.applyGains(); drawTracks(); drawWave(); };
    const nm = el('div', { class: 'tm-tn' }, row);
    el('b', {}, nm).textContent = stemLabel(n);
    el('span', {}, nm).textContent = loaded ? fmtTime(player.buffers.get(n).duration) : 'loading…';
    const vol = el('input', { type: 'range', min: 0, max: 1.5, step: 0.01, value: player.vol.get(n) ?? 1, title: 'Volume' }, row);
    vol.oninput = () => { player.vol.set(n, +vol.value); player.applyGains(); };
    const tg = el('label', { class: 'tm-check tm-tgt' }, row, `<input type="checkbox" ${V.cur.targets.includes(n) ? 'checked' : ''}> Match`);
    tg.querySelector('input').onchange = (e) => {
      const t = new Set(V.cur.targets);
      e.target.checked ? t.add(n) : t.delete(n);
      if (n === 'mix' && e.target.checked) t.clear(), t.add('mix');
      else t.delete('mix');
      V.cur.targets = [...t].length ? [...t] : ['mix'];
      save();
      drawTracks();
      drawMatch();
    };
  }
  const solo = el('div', { class: 'row' }, box);
  const all = el('button', { class: 'btn small btn-ghost' }, solo, 'Listen to all');
  all.onclick = () => { player.solo = null; player.on = new Set(names.filter((x) => x !== 'mix')); if (names.length === 1) player.on.add('mix'); player.applyGains(); drawTracks(); drawWave(); };
  const tg = el('button', { class: 'btn small btn-ghost' }, solo, 'Listen to match targets');
  tg.onclick = () => { player.solo = null; player.on = new Set(V.cur.targets); player.applyGains(); drawTracks(); drawWave(); };
}

// ---- 4. match
function drawMatch() {
  const box = q('match');
  if (!box) return;
  box.innerHTML = '';
  const o = V.opts;
  const tnames = V.cur.targets.map(stemLabel).join(' + ');
  const r = V.cur.range;
  el('p', { class: 'tm-target' }, box).innerHTML = `Matching <b>${esc(tnames)}</b> · ${r ? `${fmtTime(r[0])}–${fmtTime(r[1])}` : 'whole song'} · ${o.instrument === 'bass' ? 'bass' : 'guitar'} rig · ${esc(DEPTHS[o.depth].label)}`;
  if (V.match) {
    box.insertAdjacentHTML('beforeend', `<div class="tm-prog big"><div class="tm-prog-bar"><i data-bar="match" style="transform:scaleX(${V.match.p || 0.01})"></i></div><div class="tm-prog-label" data-label="match">${esc(V.match.stage || 'Analysing the target')}</div></div>`);
    const c = el('button', { class: 'btn small btn-danger' }, box, 'Stop');
    c.onclick = () => (V.match.cancelled = true);
    return;
  }
  const row = el('div', { class: 'tm-go' }, box);
  const go = el('button', { class: 'btn btn-accent tm-big' }, row, '<i class="ic ic-magic"></i>Match this tone');
  go.onclick = () => match();
  const cu = el('button', { class: 'btn' + (V.custom ? ' on' : '') }, row, '<i class="ic ic-gear"></i>Customize');
  cu.onclick = () => { V.custom = !V.custom; drawMatch(); };
  if (V.custom) drawCustom(box);
  if (V.cur.result) drawResult(box, V.cur.result);
}
function drawCustom(box) {
  const o = V.opts;
  const f = el('div', { class: 'tm-custom' }, box);
  const set = (k, v) => { o[k] = v; V.cur.opts = o; save(); drawMatch(); };
  const seg = (label, key, opts) => {
    const g = el('div', { class: 'tm-field' }, f);
    el('label', {}, g).textContent = label;
    const s = el('div', { class: 'filter-row' }, g);
    for (const [v, l] of opts) {
      const b = el('button', { class: 'chip' + (o[key] === v ? ' on' : '') }, s, l);
      b.onclick = () => set(key, v);
    }
  };
  seg('Search depth', 'depth', Object.entries(DEPTHS).map(([k, d]) => [k, d.label]));
  seg('Instrument', 'instrument', [['guitar', 'Guitar'], ['bass', 'Bass']]);
  seg('Character', 'character', [['auto', 'Auto-detect'], ['clean', 'Clean'], ['crunch', 'Crunch'], ['high', 'High gain']]);
  seg('Gear', 'sources', [['all', 'Everything'], ['inspired', 'Inspired-by only'], ['originals', 'Tone Zone originals only']]);
  const tg = el('div', { class: 'tm-field' }, f);
  el('label', {}, tg).textContent = 'Allow';
  const ts = el('div', { class: 'filter-row' }, tg);
  for (const [k, l] of [['drives', 'Drive pedals'], ['eq', 'EQ correction'], ['timefx', 'Reverb / delay'], ['usePreamps', 'Preamps'], ['usePacks', 'NAM / IR packs']]) {
    const b = el('button', { class: 'chip' + (o[k] ? ' on' : '') }, ts, l);
    b.onclick = () => set(k, !o[k]);
  }
  // brands
  const bg = el('div', { class: 'tm-field wide' }, f);
  el('label', {}, bg).innerHTML = `Brands <span class="hint">${o.brands.length ? o.brands.length + ' selected' : 'all enabled plugins'}</span>`;
  const brands = [...new Set(allDefs().filter((d) => !isOriginal(d) && ['Amp', 'Bass Amp', 'Preamp', 'Cab', 'Bass Cab', 'Overdrive', 'Distortion', 'Fuzz', 'Boost'].includes(d.cat)).map(brandOf).filter(Boolean))].sort();
  const bs = el('div', { class: 'filter-row' }, bg);
  for (const b of brands) {
    const c = el('button', { class: 'chip sm' + (o.brands.includes(b) ? ' on' : '') }, bs, esc(b));
    c.onclick = () => set('brands', o.brands.includes(b) ? o.brands.filter((x) => x !== b) : [...o.brands, b]);
  }
  if (o.brands.length) {
    const c = el('button', { class: 'chip sm' }, bs, 'Clear');
    c.onclick = () => set('brands', []);
  }
  // DI
  const dg = el('div', { class: 'tm-field wide' }, f);
  el('label', {}, dg).textContent = 'Test signal (what is played through each candidate rig)';
  const dr = el('div', { class: 'row' }, dg);
  el('span', { class: 'tm-di' }, dr).textContent = o.diLabel;
  const rec = el('button', { class: 'btn small' }, dr, '<i class="ic ic-mic"></i>Record my guitar (12 s)');
  rec.onclick = () => recordDI();
  const fl = el('button', { class: 'btn small' }, dr, '<i class="ic ic-folder"></i>DI file…');
  fl.onclick = () => {
    const i = el('input', { type: 'file', accept: 'audio/*' });
    i.onchange = async () => {
      const file = i.files[0];
      if (!file) return;
      const buf = await player.ensure().decodeAudioData(await file.arrayBuffer());
      o.di = await window.tz.tm.saveRecording([buf.getChannelData(0)], buf.sampleRate);
      set('diLabel', file.name);
    };
    i.click();
  };
  if (o.di) {
    const rs = el('button', { class: 'btn small btn-ghost' }, dr, 'Use built-in');
    rs.onclick = () => { o.di = null; set('diLabel', 'Built-in DI clip'); };
  }
  el('p', { class: 'hint' }, dg).textContent = 'Recording your own guitar (clean, straight into the interface) gives the most accurate match for your pickups.';
}
async function recordDI() {
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
  } catch (e) {
    return toast('Could not open an audio input: ' + cleanErr(e), 'error');
  }
  const rec = new MediaRecorder(stream);
  const chunks = [];
  rec.ondataavailable = (e) => chunks.push(e.data);
  const body = el('div', {}, null, '<p style="margin:0;color:var(--text2)">Play a mix of single notes, chords and palm mutes. Recording…</p>');
  const cd = el('div', { class: 'tm-count' }, body, '12');
  const md = modal({ title: 'Recording your guitar', body, buttons: [{ label: 'Stop', value: true }], onClose: () => rec.state === 'recording' && rec.stop() });
  let left = 12;
  const t = setInterval(() => { left--; cd.textContent = left; if (left <= 0) { clearInterval(t); md.close(true); } }, 1000);
  rec.onstop = async () => {
    clearInterval(t);
    stream.getTracks().forEach((x) => x.stop());
    const blob = new Blob(chunks, { type: rec.mimeType });
    try {
      const buf = await player.ensure().decodeAudioData(await blob.arrayBuffer());
      V.opts.di = await window.tz.tm.saveRecording([buf.getChannelData(0)], buf.sampleRate);
      V.opts.diLabel = `Your recording (${buf.duration.toFixed(1)} s)`;
      V.cur.opts = V.opts;
      save();
      drawMatch();
      toast('Recorded', 'ok', 1200);
    } catch (e) {
      toast('Recording failed: ' + cleanErr(e), 'error');
    }
  };
  rec.start();
}

async function match() {
  const p = V.cur;
  const files = p.targets.map((n) => p.stems[n]).filter(Boolean);
  V.match = { p: 0.01, stage: 'Analysing the target', cancelled: false };
  drawMatch();
  const t0 = performance.now();
  try {
    const r = p.range;
    const target = await window.tz.tm.features(files, r ? r[0] : 0, r ? r[1] : Infinity);
    if (!target) throw new Error('the selected part is silent');
    const opts = Object.assign({}, V.opts);
    if (opts.character === 'auto') opts.character = target.flat > 0.12 || target.crest < 9 ? 'high' : target.crest > 15 ? 'clean' : 'auto';
    const res = await runSearch(target, opts, (pr) => {
      if (!V.match) return;
      Object.assign(V.match, pr);
      const bar = root.querySelector('[data-bar="match"]');
      if (bar) bar.style.transform = `scaleX(${Math.max(0.01, pr.p)})`;
      const lb = root.querySelector('[data-label="match"]');
      if (lb) lb.textContent = `${pr.stage} · ${pr.evals} rigs auditioned`;
    }, () => !V.match || V.match.cancelled);
    res.target = target;
    res.secs = Math.round((performance.now() - t0) / 1000);
    res.at = Date.now();
    p.result = res;
    await save();
    V.projects = await window.tz.tm.list();
    toast(`Best match: ${res.best.score}%`, 'ok', 2400);
  } catch (e) {
    if (cleanErr(e) !== 'cancelled') toast('Matching failed: ' + cleanErr(e), 'error', 6000);
  }
  V.match = null;
  draw();
}

function rigName(rig) {
  const a = rig.map((x) => getDef(x.type)).filter(Boolean).find((d) => ['amp', 'nam'].includes(d.algo));
  return a ? a.name : 'Rig';
}
function drawResult(box, res) {
  const wrap = el('div', { class: 'tm-results' }, box);
  const all = [Object.assign({ best: true }, res.best), ...(res.alternatives || [])];
  for (const r of all) {
    const c = el('div', { class: 'tm-res' + (r.best ? ' best' : '') }, wrap);
    const sc = el('div', { class: 'tm-score' }, c);
    sc.style.setProperty('--s', r.score);
    sc.innerHTML = `<b>${r.score}</b><span>% match</span>`;
    const body = el('div', { class: 'tm-res-b' }, c);
    el('h3', {}, body).textContent = (r.best ? 'Best match · ' : 'Alternative · ') + rigName(r.rig);
    const chain = el('div', { class: 'tm-chain' }, body);
    el('span', { class: 'tm-ch io' }, chain).textContent = 'IN';
    for (const x of r.rig) {
      const d = getDef(x.type);
      el('span', { class: 'tm-arrow' }, chain).textContent = '→';
      const ch = el('span', { class: 'tm-ch' }, chain);
      ch.textContent = d ? d.name : x.type + ' (missing)';
      if (d) ch.title = `${d.cat}${d.ref ? ' · inspired by ' + d.ref : ''}`;
    }
    el('span', { class: 'tm-arrow' }, chain).textContent = '→';
    el('span', { class: 'tm-ch io' }, chain).textContent = 'OUT';
    if (r.breakdown) {
      const bd = el('div', { class: 'tm-bd' }, body);
      for (const [k, v] of Object.entries(r.breakdown)) el('div', {}, bd, `<span>${k}</span><i><b style="transform:scaleX(${Math.max(0.02, v / 100)})"></b></i>`);
    }
    const acts = el('div', { class: 'row' }, body);
    const ld = el('button', { class: 'btn small btn-accent' }, acts, '<i class="ic ic-board"></i>Load to board');
    ld.onclick = () => loadRig(r.rig);
    const pv = el('button', { class: 'btn small' }, acts, '<i class="ic ic-play"></i>Hear it');
    pv.onclick = () => previewRig(r.rig, pv);
    const ab = el('button', { class: 'btn small' }, acts, '<i class="ic ic-wave"></i>Hear target');
    ab.onclick = () => { player.on = new Set(V.cur.targets); player.solo = null; const rr = V.cur.range; player.play(rr ? rr[0] : 0, rr); drawTracks(); };
    const sv = el('button', { class: 'btn small btn-ghost' }, acts, '<i class="ic ic-save"></i>Save as preset');
    sv.onclick = () => saveRig(r.rig);
  }
  el('p', { class: 'hint' }, box).textContent = `${res.evals} rigs auditioned in ${res.secs || '?'} s. A match score above ~75% usually sounds close; play with the amp’s gain and the EQ to taste. Your guitar, pickups and playing make a big difference too.`;
}
async function loadRig(rig) {
  if (state.dirty && !(await confirmDlg('Unsaved changes', `Replace “${state.preset.name}” on the board?`, 'Replace', true))) return;
  const p = rigPreset(rig, `${V.cur.title} (Tone Match)`);
  loadPreset(p, null);
  markDirty(true);
  document.querySelector('[data-tab="board"]')?.click();
  setTimeout(() => window.__tz?.editor?.fit(), 80);
  toast('Rig loaded – save it from the preset menu to keep it', 'ok', 2600);
}
async function previewRig(rig, btn) {
  btn.disabled = true;
  try {
    const path = await window.tz.tm.preview(buildGraph(rigPreset(rig)), V.opts.di);
    const bytes = await window.tz.tm.readFile(path);
    const buf = await player.ensure().decodeAudioData(bytes);
    player.playOne(buf);
  } catch (e) {
    toast('Preview failed: ' + cleanErr(e), 'error');
  }
  btn.disabled = false;
}
async function saveRig(rig) {
  const name = await prompt('Save as preset', `${V.cur.title} tone`);
  if (!name) return;
  const p = rigPreset(rig, name);
  p.tags = ['tone-match'];
  p.desc = `Made by Tone Match from “${V.cur.title}”.`;
  p.saved = Date.now();
  await window.tz.presets.save(p, null);
  toast(`Saved “${name}”`, 'ok', 1600);
}
