// Shared multi-FX helper. Each plugin that uses it keeps its own copy of this file.
//
// A unit is a chain block with engine lanes in a fixed order (gate, comp, wah, drive, amp, cab, eq, mod,
// delay, reverb, looper, output). The user sees slots; derive() puts each used slot on a free lane of its
// model's pool and switches the other lanes off.
//
// Hidden params: _m<i> model of slot i (-1 empty), _o<i> slot on, _p<i>_<k> param k (0..1), _mem<n> patch
// memory (JSON), _cur current memory, _bpm tempo. k1..kN are the knobs under the screen: they edit the
// selected slot on the current page. Menu state lives in state.ui[id].mfx and is not saved.

export function makeKit(tz) {
  const { setA, setText } = tz.gfx;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const P = (label, eng, def = 0.5, o = {}) => Object.assign({ label, eng, def, min: 0, max: 1 }, o);
  const fmtMs = (v) => (v >= 1000 ? (v / 1000).toFixed(2) + 's' : Math.round(v) + 'ms');
  const fmtHz = (v) => (v >= 1000 ? (v / 1000).toFixed(1) + 'k' : Math.round(v) + 'Hz');

  // ---------------------------------------------------------------- param value mapping
  function engVal(p, v) {
    v = clamp(v ?? p.def, 0, 1);
    if (p.opts) {
      const i = Math.round(v * (p.opts.length - 1));
      return p.values ? p.values[i] : i;
    }
    if (p.curve === 'log') return p.min * Math.pow(p.max / p.min, v);
    if (p.curve === 'sq') return p.min + (p.max - p.min) * v * v;
    return p.min + (p.max - p.min) * v;
  }
  function toNorm(p, x) {
    if (p.curve === 'log') return clamp(Math.log(x / p.min) / Math.log(p.max / p.min), 0, 1);
    if (p.curve === 'sq') return clamp(Math.sqrt((x - p.min) / (p.max - p.min)), 0, 1);
    return clamp((x - p.min) / (p.max - p.min), 0, 1);
  }
  function fmt(p, v) {
    if (!p) return '';
    v = clamp(v ?? p.def, 0, 1);
    if (p.opts) return p.opts[Math.round(v * (p.opts.length - 1))];
    const x = engVal(p, v);
    switch (p.fmt) {
      case 'ms': return fmtMs(x);
      case 'hz': return fmtHz(x);
      case 'db': return (x > 0 ? '+' : '') + x.toFixed(1) + 'dB';
      case 'st': return (x > 0 ? '+' : '') + Math.round(x);
      case 'raw': return x.toFixed(1);
      default: return String(Math.round(v * 100));
    }
  }

  // ---------------------------------------------------------------- unit definition
  // spec: { id, slots, knobs, cats: [{key, name, short, color}], models: [...], lanes: [...], slotCats: [[keys]|null],
  //         patch: [[modelName, on, {label: v}] | null] (default), mems: [{name, patch}], extra(ui, o, info) }
  // model: { name, cat, pool, fixed: {engParam: v}, params: [P(...)], fx(o, vals, pre, ui), voice (drive voicing /
  //          amp model / cab model) }
  // lane spec: { pool, algo, n, opts, params }: pools 'drive' / 'amp' / 'cab' collect their models' voices.
  function unit(spec) {
    const models = spec.models;
    models.forEach((m, i) => { m.idx = i; m.params = m.params || []; m.fixed = m.fixed || {}; });
    const chain = [];
    const pools = {};
    const addLane = (pool, algo, opts, params, prefix) => {
      chain.push({ prefix, algo, opts, params, on: false });
      (pools[pool] = pools[pool] || []).push(prefix);
    };
    for (const L of spec.lanes) {
      const mine = models.filter((m) => m.pool === L.pool);
      if (!mine.length && !L.keep && !(spec.keep || []).includes(L.pool)) continue; // no model uses this pool
      if (L.algo === 'drive') {
        // one voicing per model (drive `mode` param, up to 16 per lane)
        const voices = mine.map((m) => m.voice || {});
        mine.forEach((m, i) => (m.fixed.mode = i));
        for (let k = 0; k < (L.n || 1); k++) addLane(L.pool, 'drive', Object.assign({ modes: voices }, L.opts || {}), Object.assign({}, L.params), `${L.prefix || L.pool}${k}`);
      } else if (L.algo === 'amp') {
        // up to 4 channels per amp lane: models are spread over as many lanes as needed (one amp per lane)
        const per = 4;
        const nl = Math.ceil(mine.length / per);
        for (let k = 0; k < nl; k++) {
          const grp = mine.slice(k * per, k * per + per);
          const pre = `${L.prefix || 'amp'}${k}`;
          grp.forEach((m, j) => { m.lane = pre; m.fixed.channel = j; });
          chain.push({ prefix: pre, algo: 'amp', opts: Object.assign({ models: grp.map((m) => m.voice) }, L.opts || {}), params: Object.assign({}, L.params), on: false });
          (pools[`${L.pool}:${pre}`] = []).push(pre);
          grp.forEach((m) => (m.poolKey = `${L.pool}:${pre}`));
        }
      } else if (L.algo === 'cab') {
        const list = L.models || mine.map((m) => m.voice);
        mine.forEach((m) => (m.fixed.model = list.indexOf(m.voice)));
        addLane(L.pool, 'cab', Object.assign({ models: list }, L.opts || {}), Object.assign({}, L.params), L.prefix || L.pool);
      } else {
        for (let k = 0; k < (L.n || 1); k++) addLane(L.pool, L.algo, L.opts || {}, Object.assign({}, L.params), (L.n || 1) > 1 ? `${L.prefix || L.pool}${k}` : L.prefix || L.pool);
      }
    }
    models.forEach((m) => { if (!m.poolKey) m.poolKey = m.pool; });
    const byName = new Map(models.map((m) => [m.name, m]));
    const catOf = new Map(spec.cats.map((c) => [c.key, c]));
    const nSlots = spec.slots;
    const K = spec.knobs || 4;

    // ---- patch <-> params
    function patchParams(patch) {
      const o = {};
      for (let i = 0; i < nSlots; i++) {
        const e = patch[i];
        const m = e && byName.get(e[0]);
        if (e && !m) console.warn('mfx: unknown model', e[0]);
        o[`_m${i}`] = m ? m.idx : -1;
        o[`_o${i}`] = m && e[1] !== false ? 1 : 0;
        const vals = (e && e[2]) || {};
        (m ? m.params : []).forEach((p, k) => (o[`_p${i}_${k}`] = vals[p.label] ?? p.def));
      }
      return o;
    }
    const initParams = patchParams(spec.patch);
    (spec.mems || []).forEach((mm, n) => (initParams[`_mem${n}`] = JSON.stringify({ name: mm.name, vals: mm.patch ? patchParams(mm.patch) : initParams })));
    initParams._cur = 0;
    initParams._bpm = 120;
    for (let k = 1; k <= K; k++) initParams['k' + k] = initParams[`_p0_${k - 1}`] ?? 0.5;

    // ---- lane allocation (slot order); a slot whose pool is full is flagged 'overflow' (DSP FULL)
    function alloc(ui) {
      const used = new Set();
      const lane = [], over = [];
      for (let i = 0; i < nSlots; i++) {
        const m = models[ui[`_m${i}`] ?? -1];
        if (!m) { lane.push(null); over.push(false); continue; }
        const free = (pools[m.poolKey] || []).find((pre) => !used.has(pre));
        if (free) used.add(free);
        lane.push(free || null);
        over.push(!free);
      }
      return { lane, over };
    }
    function derive(ui) {
      const o = {};
      for (const c of chain) o[c.prefix + '.on'] = 0;
      const A = alloc(ui);
      for (let i = 0; i < nSlots; i++) {
        const pre = A.lane[i];
        if (!pre) continue;
        const m = models[ui[`_m${i}`]];
        o[pre + '.on'] = (ui[`_o${i}`] ?? 0) > 0.5 ? 1 : 0;
        for (const k in m.fixed) o[`${pre}.${k}`] = m.fixed[k];
        const vals = m.params.map((p, k) => ui[`_p${i}_${k}`] ?? p.def);
        m.params.forEach((p, k) => { if (p.eng) o[`${pre}.${p.eng}`] = engVal(p, vals[k]); });
        if (m.fx) m.fx(o, vals, pre, ui, i);
      }
      // master output level + built-in expression pedal routing
      let lvl = ui._lvl ?? 0;
      if (spec.exp && ui.exp !== undefined) {
        const t = ui._expT ?? 0; // 0 auto, 1 volume, 2 wah, 3 off
        const find = (kind) => {
          for (let i = 0; i < nSlots; i++) {
            const m = models[ui[`_m${i}`] ?? -1];
            if (m && m.pedal === kind && A.lane[i] && (ui[`_o${i}`] ?? 0) > 0.5) return A.lane[i];
          }
          return null;
        };
        const wah = find('wah'), vol = find('vol');
        if ((t === 0 || t === 2) && wah) o[wah + '.pos'] = ui.exp;
        else if (t === 0 || t === 1) {
          if (vol) o[vol + '.pos'] = ui.exp;
          else lvl += ui.exp < 0.01 ? -60 : 40 * Math.log10(ui.exp);
        }
      }
      if (chain.some((c) => c.prefix === 'lpr')) {
        o['lpr.on'] = 1;
        o['lpr.tempo'] = ui._bpm || 120;
        o['lpr.rhythm'] = (ui._drum ?? 0) > 0.5 ? 1 : 0;
        o['lpr.pattern'] = ui._pat ?? 0;
        o['lpr.rhythmLevel'] = ui._drl ?? 0.5;
      }
      if (chain.some((c) => c.prefix === 'out')) { o['out.on'] = 1; o['out.level'] = Math.max(-60, lvl); }
      if (spec.extra) spec.extra(ui, o, A);
      return o;
    }

    // ---- slot info for screens
    function slot(ui, i, A) {
      const m = models[ui[`_m${i}`] ?? -1] || null;
      return { m, on: (ui[`_o${i}`] ?? 0) > 0.5, cat: m ? catOf.get(m.cat) : null, over: A ? A.over[i] : false, val: (k) => ui[`_p${i}_${k}`] ?? (m && m.params[k] ? m.params[k].def : 0) };
    }
    const allowed = (i) => (spec.slotCats && spec.slotCats[i]) || spec.cats.map((c) => c.key);
    const inCat = (key) => models.filter((m) => m.cat === key);

    return { spec, models, chain, pools, byName, catOf, nSlots, K, initParams, derive, alloc, slot, allowed, inCat, patchParams };
  }

  // ---------------------------------------------------------------- navigation / actions
  const units = new Map(); // block type -> unit
  function nav(id) {
    const ui = (tz.app.state.ui[id] = tz.app.state.ui[id] || {});
    if (!ui.mfx) ui.mfx = { view: 'home', sel: 0, page: 0, cat: 0, li: 0, top: 0, menu: 0, sub: 0, fsBank: 0, t: 0 };
    return ui.mfx;
  }
  const blockOf = (id) => tz.app.state.preset.blocks.find((b) => b.id === id);
  const U = (blk) => units.get(blk.type);
  const uiOf = (blk) => tz.app.ui(blk);
  const set = (blk, p, v) => tz.app.setParam(blk.id, p, v);
  function bump(blk) {
    const n = nav(blk.id);
    n.t = (n.t + 1) | 0; // screens watch this to know when to redraw menus
  }
  // move the physical knobs to the selected slot's values (no undo step, no engine traffic: they are virtual)
  function syncKnobs(blk) {
    const u = U(blk);
    if (!u) return;
    const n = nav(blk.id), ui = uiOf(blk);
    const m = u.models[ui[`_m${n.sel}`] ?? -1];
    for (let k = 0; k < u.K; k++) {
      const pi = n.page * u.K + k;
      const v = m && m.params[pi] ? ui[`_p${n.sel}_${pi}`] ?? m.params[pi].def : 0;
      if (blk.params['k' + (k + 1)] !== v) {
        blk.params['k' + (k + 1)] = v;
        tz.bus.emit('param', { id: blk.id, p: 'k' + (k + 1), v });
      }
    }
  }
  const A = {
    select(blk, i) {
      const u = U(blk), n = nav(blk.id);
      n.sel = clamp(i, 0, u.nSlots - 1);
      n.page = 0;
      syncKnobs(blk);
      bump(blk);
    },
    selMove(blk, d) {
      const u = U(blk), n = nav(blk.id);
      A.select(blk, (n.sel + d + u.nSlots) % u.nSlots);
    },
    pages(blk, i) {
      const u = U(blk), ui = uiOf(blk);
      const m = u.models[ui[`_m${i ?? nav(blk.id).sel}`] ?? -1];
      return m ? Math.max(1, Math.ceil(m.params.length / u.K)) : 1;
    },
    page(blk, d) {
      const n = nav(blk.id);
      const np = A.pages(blk);
      n.page = (n.page + d + np) % np;
      syncKnobs(blk);
      bump(blk);
    },
    view(blk, v) {
      const n = nav(blk.id);
      n.view = v;
      n.li = 0;
      n.top = 0;
      bump(blk);
    },
    toggle(blk, i) {
      const ui = uiOf(blk);
      if ((ui[`_m${i}`] ?? -1) < 0) return;
      set(blk, `_o${i}`, (ui[`_o${i}`] ?? 0) > 0.5 ? 0 : 1);
      bump(blk);
    },
    setModel(blk, i, mi) {
      const u = U(blk);
      const m = u.models[mi];
      const ui = uiOf(blk);
      const same = (ui[`_m${i}`] ?? -1) === mi;
      set(blk, `_m${i}`, m ? mi : -1);
      if (m && !same) m.params.forEach((p, k) => set(blk, `_p${i}_${k}`, p.def));
      set(blk, `_o${i}`, m ? 1 : 0);
      const n = nav(blk.id);
      if (n.sel === i) { n.page = 0; syncKnobs(blk); }
      bump(blk);
    },
    setVal(blk, i, k, v) {
      set(blk, `_p${i}_${k}`, clamp(v, 0, 1));
      const n = nav(blk.id);
      if (n.sel === i) syncKnobs(blk);
      bump(blk);
    },
    nudge(blk, i, k, d) {
      const u = U(blk), ui = uiOf(blk);
      const m = u.models[ui[`_m${i}`] ?? -1];
      const p = m && m.params[k];
      if (!p) return;
      const v = ui[`_p${i}_${k}`] ?? p.def;
      const step = p.opts ? 1 / Math.max(1, p.opts.length - 1) : 0.02;
      A.setVal(blk, i, k, v + d * step);
    },
    // browser: step through the models allowed in a slot (wraps across categories)
    stepModel(blk, i, d) {
      const u = U(blk), ui = uiOf(blk);
      const list = u.models.filter((m) => u.allowed(i).includes(m.cat));
      if (!list.length) return;
      const cur = list.findIndex((m) => m.idx === (ui[`_m${i}`] ?? -1));
      const nx = list[(cur + d + list.length) % list.length];
      A.setModel(blk, i, nx.idx);
    },
    // patch memories
    mem(blk, n) {
      const s = uiOf(blk)[`_mem${n}`];
      try { return s ? JSON.parse(s) : null; } catch (_) { return null; }
    },
    store(blk, n, name) {
      const u = U(blk), ui = uiOf(blk);
      const vals = {};
      for (const k in ui) if (/^_[mop]\d/.test(k)) vals[k] = ui[k];
      const old = A.mem(blk, n);
      set(blk, `_mem${n}`, JSON.stringify({ name: name || (old && old.name) || `${u.spec.memPrefix || 'PATCH'} ${n + 1}`, vals }));
      set(blk, '_cur', n);
      tz.ui.toast(`Stored to ${A.memName(blk, n)}`, 'ok', 1200);
      bump(blk);
    },
    recall(blk, n) {
      const mm = A.mem(blk, n);
      set(blk, '_cur', n);
      if (mm && mm.vals) {
        const u = U(blk);
        // clear slots that the memory doesn't define, then apply it in one engine update
        for (let i = 0; i < u.nSlots; i++) if (mm.vals[`_m${i}`] === undefined) blk.params[`_m${i}`] = -1;
        Object.assign(blk.params, mm.vals);
        set(blk, '_cur', n);
      }
      syncKnobs(blk);
      bump(blk);
    },
    memName(blk, n) {
      const mm = A.mem(blk, n);
      return mm ? mm.name : `${U(blk).spec.memPrefix || 'PATCH'} ${n + 1}`;
    },
    tap(blk) {
      const n = nav(blk.id);
      const now = performance.now();
      const dt = now - (n.lastTap || 0);
      n.lastTap = now;
      if (dt < 120 || dt > 2000) return;
      const u = U(blk), ui = uiOf(blk);
      set(blk, '_bpm', Math.round(60000 / dt));
      // every delay slot's TIME follows the tap
      for (let i = 0; i < u.nSlots; i++) {
        const m = u.models[ui[`_m${i}`] ?? -1];
        if (!m) continue;
        m.params.forEach((p, k) => { if (p.eng === 'time' && p.tap !== false) set(blk, `_p${i}_${k}`, toNorm(p, clamp(dt, p.min, p.max))); });
      }
      syncKnobs(blk);
      bump(blk);
    },
    // set the tempo: quarter-note delay times follow (like tapping)
    setBpm(blk, bpm) {
      bpm = clamp(Math.round(bpm), 40, 250);
      set(blk, '_bpm', bpm);
      const u = U(blk), ui = uiOf(blk), msq = 60000 / bpm;
      for (let i = 0; i < u.nSlots; i++) {
        const m = u.models[ui[`_m${i}`] ?? -1];
        if (m) m.params.forEach((p, k) => { if (p.eng === 'time' && p.tap !== false) set(blk, `_p${i}_${k}`, toNorm(p, clamp(msq, p.min, p.max))); });
      }
      syncKnobs(blk);
      bump(blk);
    },
    // reset to the unit's default patch
    init(blk) {
      const u = U(blk);
      set(blk, '_m0', blk.params._m0 ?? -1);
      Object.assign(blk.params, u.patchParams(u.spec.patch));
      set(blk, '_m0', blk.params._m0);
      syncKnobs(blk);
      bump(blk);
    },
    // looper sub-block events (chain sub index of the looper lane)
    loop(blk, type) {
      const u = U(blk);
      const li = u.chain.findIndex((c) => c.algo === 'looper');
      if (li < 0) return;
      tz.engine.send({ cmd: 'event', id: blk.id, type, value: 0, arg: li * 100 });
    },
  };

  // ---------------------------------------------------------------- footswitch / button hooks
  // Controls with `nav: '<name>'` are handled by the unit's onNav(blk, name, ctl, down, held) function.
  // Footswitch-style navigation buttons are FOOT controls (style 'plate' = invisible hit area over the drawn cap).
  const holds = new Map();
  function hooks(type, onNav) {
    tz.blockHooks(type, {
      foot(view, ctl, down) {
        if (!ctl.nav) return false;
        const blk = view.block;
        const key = blk.id + '|' + ctl.cid;
        if (down) {
          const h = { t: performance.now(), held: false };
          h.timer = setTimeout(() => { h.held = true; onNav(blk, ctl.nav, ctl, 'hold'); }, ctl.holdMs || 800);
          holds.set(key, h);
          onNav(blk, ctl.nav, ctl, 'down');
        } else {
          const h = holds.get(key);
          holds.delete(key);
          if (h) clearTimeout(h.timer);
          if (!h || !h.held) onNav(blk, ctl.nav, ctl, 'press');
          else onNav(blk, ctl.nav, ctl, 'release');
        }
        return true;
      },
    });
  }
  // knobs k1..kN edit the selected slot's current page
  function register(type, u) {
    units.set(type, u);
  }
  tz.bus.on('param', ({ id, p, v }) => {
    if (typeof p !== 'string' || !/^k\d$/.test(p)) return;
    const blk = blockOf(id);
    if (!blk) return;
    const u = units.get(blk.type);
    if (!u) return;
    const n = nav(id), ui = uiOf(blk);
    const k = (p.slice(1) | 0) - 1;
    const m = u.models[ui[`_m${n.sel}`] ?? -1];
    const pi = n.page * u.K + k;
    if (!m || !m.params[pi]) return;
    const key = `_p${n.sel}_${pi}`;
    if (Math.abs((ui[key] ?? -1) - v) < 1e-9) return;
    tz.app.setParam(id, key, v);
    n.lastKnob = { k, t: performance.now() };
    bump(blk);
  });
  // engine-side: a fresh block (no saved params) gets its knobs synced once its view exists
  tz.bus.on('preset:changed', () => {
    setTimeout(() => {
      for (const b of tz.app.blocks()) if (units.has(b.type)) syncKnobs(b);
    }, 60);
  });

  // ---------------------------------------------------------------- tiny SVG helpers for screens
  const svg = tz.gfx.svg;
  const T = (g, x, y, s, o = {}) => svg('text', { x, y, fill: o.fill || '#fff', 'font-family': o.font, 'font-size': o.size || 8, 'font-weight': o.weight || 400, 'text-anchor': o.anchor || 'middle', 'dominant-baseline': 'central', 'letter-spacing': o.ls || 0, style: o.style }, g, s);
  const R = (g, x, y, w, h, o = {}) => svg('rect', Object.assign({ x, y, width: w, height: h }, o), g);
  // cache-aware setters
  const st = (el, txt) => setText(el, txt);
  const sa = (el, k, v) => setA(el, k, v);

  return { P, unit, nav, A, hooks, register, syncKnobs, engVal, toNorm, fmt, clamp, T, R, st, sa, svg, blockOf, uiOf, U: (blk) => units.get(blk.type), bump };
}

// ---------------------------------------------------------------- shared model building blocks
// Each brand names its own models; these give the engine side (pool, fixed params, param list).
export function stdParts(P) {
  const dly = (mode, extra = []) => ({ pool: 'dly', fixed: { mode, level: 0.5 }, params: [P('TIME', 'time', 0.55, { min: 20, max: 2000, curve: 'log', fmt: 'ms' }), P('F.B', 'feedback', 0.35, { max: 0.95 }), P('MIX', 'mix', 0.3), ...extra] });
  const rev = (mode, extra = []) => ({ pool: 'rev', fixed: { mode, level: 0.5 }, params: [P('DECAY', 'decay', 0.5), P('MIX', 'mix', 0.3), P('TONE', 'tone', 0.55), P('PRE DLY', 'predelay', 0.08, { max: 250, fmt: 'ms' }), ...extra] });
  const drv = (voice, extra = []) => ({ pool: 'drv', voice, params: [P('GAIN', 'gain', 0.5), P('TONE', 'tone', 0.5), P('LEVEL', 'level', 0.5), ...extra] });
  return {
    dly, rev, drv,
    chorus: (mode, o = {}) => ({ pool: 'cho', fixed: { mode, level: 0.5 }, params: [P('RATE', 'rate', o.rate ?? 0.35), P('DEPTH', 'depth', o.depth ?? 0.5), P('MIX', 'mix', o.mix ?? 0.5), P('TONE', 'tone', 0.5)] }),
    flanger: (mode) => ({ pool: 'flg', fixed: { mode }, params: [P('RATE', 'speed', 0.3), P('DEPTH', 'width', 0.6), P('RESO', 'regen', 0.55), P('MANUAL', 'manual', 0.5), P('MIX', 'mix', 0.5)] }),
    phaser: (stages) => ({ pool: 'pha', fixed: { stages }, params: [P('RATE', 'rate', 0.35), P('DEPTH', 'depth', 0.8), P('RESO', 'feedback', 0.4), P('MIX', 'mix', 0.5)] }),
    trem: (mode) => ({ pool: 'trm', fixed: { mode, level: 0.5 }, params: [P('RATE', 'rate', 0.45), P('DEPTH', 'depth', 0.6), P('WAVE', 'wave', 0.3)] }),
    vibe: () => ({ pool: 'vib', fixed: { level: 0.5 }, params: [P('SPEED', 'speed', 0.4), P('DEPTH', 'intensity', 0.7), P('MODE', 'mode', 0, { opts: ['CHORUS', 'VIBRATO'] }), P('TONE', 'tone', 0.6)] }),
    rotary: () => ({ pool: 'rot', fixed: { accel: 0.5, level: 0.5 }, params: [P('SPEED', 'speed', 0, { opts: ['SLOW', 'FAST'] }), P('DRIVE', 'drive', 0.2), P('BAL', 'balance', 0.5), P('MIX', 'mix', 1)] }),
    ring: () => ({ pool: 'rng', params: [P('FREQ', 'freq', 0.4), P('FINE', 'fine', 0.5), P('MIX', 'mix', 0.5)] }),
    pitch: (def = 0.15, o = {}) => ({ pool: 'pit', fixed: Object.assign({ level2: 0, level3: 0, quality: 1, scale: 0 }, o.fixed), params: [P('SHIFT', 'semis1', def, { opts: ['-24', '-12', '-7', '-5', '+5', '+7', '+12', '+24'], values: [-24, -12, -7, -5, 5, 7, 12, 24] }), P('MIX', 'level1', o.mix ?? 0.5), P('DRY', 'dry', 1), P('TONE', 'tone', 1)] }),
    wah: (mode, filter = 1) => ({ pool: 'wah', fixed: { mode, filter, level: 0.5 }, params: mode === 0 ? [P('PEDAL', 'pos', 0.5), P('Q', 'q', 0.55), P('RANGE', 'range', 0.5)] : mode === 1 ? [P('RATE', 'rate', 0.4), P('Q', 'q', 0.6), P('RANGE', 'range', 0.6)] : [P('SENS', 'sens', 0.55), P('Q', 'q', 0.6), P('RANGE', 'range', 0.6), P('DIR', 'direction', 0, { opts: ['UP', 'DOWN'] })] }),
    comp: (pool) => ({ pool, fixed: { blend: 1 }, params: [P('SUSTAIN', 'sustain', 0.5), P('ATTACK', 'attack', 0.3), P('LEVEL', 'level', 0.5), P('TONE', 'tone', 0.5)] }),
    gate: () => ({ pool: 'gte', params: [P('THRESH', 'threshold', 0.3), P('DECAY', 'decay', 0.4)] }),
    eq: () => ({ pool: 'geq', params: ['100', '200', '400', '800', '1.6k', '3.2k', '6.4k', 'LEVEL'].map((l, i) => P(l, i < 7 ? 'b' + i : 'level', 0.5, { min: -12, max: 12, fmt: 'db' })) }),
    peq: () => ({ pool: 'peq', params: [P('LOW', 'lowgain', 0.5, { min: -12, max: 12, fmt: 'db' }), P('MID', 'mid1gain', 0.5, { min: -12, max: 12, fmt: 'db' }), P('MID F', 'mid1freq', 0.5, { min: 200, max: 4000, curve: 'log', fmt: 'hz' }), P('HIGH', 'highgain', 0.5, { min: -12, max: 12, fmt: 'db' }), P('LO CUT', 'lowcut', 0, { min: 20, max: 400, curve: 'log', fmt: 'hz' }), P('HI CUT', 'highcut', 1, { min: 2000, max: 20000, curve: 'log', fmt: 'hz' }), P('LEVEL', 'level', 0.5, { min: -12, max: 12, fmt: 'db' })] }),
    vol: () => ({ pool: 'vol', fixed: { taper: 1 }, params: [P('PEDAL', 'pos', 1), P('MIN', 'min', 0)] }),
    synth: (mode) => ({ pool: 'syn', fixed: { mode }, params: [P('FILTER', 'filter', 0.5), P('RESO', 'reso', 0.4), P('ATTACK', 'attack', 0.2), P('DRY', 'dry', 0.5), P('WET', 'wet', 0.7), P('OCTAVE', 'octave', 0.67, { opts: ['-2', '-1', '0', '+1'], values: [-2, -1, 0, 1] }), P('DECAY', 'decay', 0.6), P('MOD', 'mod', 0.3)] }),
    crusher: () => ({ pool: 'bit', params: [P('BITS', 'bits', 0.5), P('RATE', 'rate', 0.3), P('MIX', 'mix', 1)] }),
    // amp: 6 params; CAB choice (stepped) switches the unit's cab lane when the unit has amp+cab in one slot
    amp: (voice, o = {}) => ({ pool: 'amp', voice, params: [P('GAIN', 'gain', o.gain ?? 0.5), P('BASS', 'bass', 0.5), P('MID', 'mid', 0.5), P('TREBLE', 'treble', 0.55), P('PRES', 'presence', 0.5), P('VOLUME', 'level', o.vol ?? 0.55, { min: -24, max: 6, fmt: 'db' }), ...(o.extra || [])] }),
    cab: (voice) => ({ pool: 'cab', voice, params: [P('LO CUT', 'lowcut', 0.2, { min: 20, max: 300, curve: 'log', fmt: 'hz' }), P('HI CUT', 'highcut', 0.6, { min: 3000, max: 16000, curve: 'log', fmt: 'hz' }), P('MIC POS', 'm1pos', 0.3, { max: 1.3 }), P('LEVEL', 'level', 0.5, { min: -12, max: 12, fmt: 'db' })] }),
  };
}

// standard lane order for a unit; pass counts per pool ({ dly: 2 } …)
export function stdLanes(o = {}) {
  const n = (k, d = 1) => o[k] ?? d;
  const L = [];
  const add = (pool, algo, extra = {}) => { if (n(pool) > 0) L.push(Object.assign({ pool, algo, n: n(pool), keep: (o.keep || []).includes(pool) }, extra)); };
  add('gte', 'gate');
  add('cmp', 'comp', { opts: { type: 'vca' } });
  add('cmpO', 'comp', { opts: { type: 'ota' } });
  add('wah', 'wah', { opts: { fLo: 350, fHi: 2400 } });
  add('syn', 'synth');
  add('pit', 'pitch');
  add('drv', 'drive', { opts: { levelMaxDb: 6 } });
  add('amp', 'amp');
  add('cab', 'cab', o.cabList ? { models: o.cabList } : {});
  add('geq', 'geq', { opts: { freqs: [100, 200, 400, 800, 1600, 3200, 6400], q: 1.1 } });
  add('peq', 'peq');
  add('gte2', 'gate');
  add('vol', 'volume');
  add('bit', 'crusher');
  add('cho', 'chorus');
  add('flg', 'flanger');
  add('pha', 'phaser');
  add('vib', 'vibe');
  add('trm', 'tremolo');
  add('rot', 'rotary');
  add('rng', 'ringmod');
  add('dly', 'delay', { opts: { maxMs: 2000 } });
  add('rev', 'reverb');
  if (o.looper) L.push({ pool: 'lpr', algo: 'looper', n: 1, keep: true, opts: { tracks: 1, maxSec: o.looper } });
  if (o.out !== false) L.push({ pool: 'out', algo: 'utility', n: 1, keep: true, prefix: 'out', opts: { kind: 'gain' } });
  return L;
}
