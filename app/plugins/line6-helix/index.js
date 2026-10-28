// Line 6 Helix / HX device plugin.
// * Audio: the block's jacks are the unit's USB audio channels (engine `extio` block, auto-connected to the
//   device's PipeWire ports), so Tone Zone blocks can feed the Helix and process what comes back.
// * Control: footswitches / expression / tap / tuner / snapshots / presets are sent over USB MIDI using the
//   Helix factory MIDI map (editable). Every Tone Zone preset can recall a Helix setlist / preset / snapshot.
// * External controllers: TZ Footswitch / TZ Expression blocks patched into the EXP / EXT FS control jacks act
//   like pedals plugged into the real unit's EXP jacks.
// The graphic follows the connected model (Floor, LT, HX Stomp, HX Stomp XL, Rack, HX Effects).

const MODELS = {
  floor: { name: 'Helix Floor', fs: 12, rows: 2, scribble: true, exp: true, w: 660, h: 340, knobs: 6 },
  lt: { name: 'Helix LT', fs: 12, rows: 2, scribble: false, exp: true, w: 640, h: 320, knobs: 6 },
  stomp: { name: 'HX Stomp', fs: 3, rows: 1, scribble: false, exp: false, w: 270, h: 270, knobs: 3 },
  stompxl: { name: 'HX Stomp XL', fs: 8, rows: 2, scribble: true, exp: false, w: 470, h: 290, knobs: 6 },
  effects: { name: 'HX Effects', fs: 6, rows: 2, scribble: true, exp: false, w: 430, h: 270, knobs: 6 },
  rack: { name: 'Helix Rack', fs: 0, rows: 0, scribble: false, exp: false, w: 660, h: 150, knobs: 6 },
};
const MODEL_KEYS = ['auto', 'floor', 'lt', 'stomp', 'stompxl', 'rack', 'effects'];
const PID = { '4242': 'rack', '4244': 'lt', '4246': 'stomp', '4248': 'floor', '424a': 'lt' };
// factory MIDI map (Helix 3.x owner's manual): footswitch emulation, expression, looper, tap, tuner, snapshots
const DEFAULT_MAP = {
  fs: { 1: 49, 2: 50, 3: 51, 4: 52, 5: 53, 7: 54, 8: 55, 9: 56, 10: 57, 11: 58 },
  exp: [1, 2, 3], toe: 59, tap: 64, tuner: 68, snapshot: 69, mode: 71,
  looper: { record: 60, play: 61, once: 62, undo: 63, reverse: 65, half: 66 },
};
// which FS number each graphic footswitch is, per model
const FS_LAYOUT = {
  floor: [1, 2, 3, 4, 5, 'mode', 7, 8, 9, 10, 11, 'tap'],
  lt: [1, 2, 3, 4, 5, 'mode', 7, 8, 9, 10, 11, 'tap'],
  stomp: [1, 2, 3],
  stompxl: [1, 2, 3, 4, 7, 8, 9, 10],
  effects: [1, 2, 3, 7, 8, 9],
  rack: [],
};
const FS_COLORS = ['#ff3b30', '#ff9f0a', '#ffd60a', '#30d158', '#0a84ff', '#bf5af2', '#64d2ff', '#ff375f', '#ffffff', '#ac8e68', '#5e5ce6', '#ff6482'];
const presetName = (n) => `${String(Math.floor(n / 4) + 1).padStart(2, '0')}${'ABCD'[n % 4]}`;

export default function register(tz) {
  const { K, SEL, TOG, FOOT, LED, SCREEN, TREADLE, def } = tz.helpers;
  const { svg, label, formKit, softShadow, noisePattern, shade, haloFill, setA, setText } = tz.gfx;
  const map = Object.assign({}, DEFAULT_MAP, tz.storage.get('midiMap', {}));

  // ------------------------------------------------------------------ device state (detection + MIDI)
  const dev = { model: null, product: null, usb: false, midiIn: null, midiOut: null, lastPc: null, setlist: 0, snapshot: null, bpm: null, tuner: false, gen: 0, lit: {} };
  let access = null;
  let clockTimes = [];
  const listeners = new Set();
  const changed = () => listeners.forEach((f) => f());

  function modelFromName(n) {
    n = (n || '').toLowerCase();
    if (/stomp\s*xl/.test(n)) return 'stompxl';
    if (/stomp/.test(n)) return 'stomp';
    if (/effects/.test(n)) return 'effects';
    if (/rack|control/.test(n)) return 'rack';
    if (/\blt\b/.test(n)) return 'lt';
    if (/helix/.test(n)) return 'floor';
    return null;
  }
  async function detect() {
    let model = null, product = null, usb = false;
    try {
      const list = await tz.sys.usbDevices();
      const d = list.find((x) => x.vendorId === '0e41');
      if (d) {
        usb = true;
        product = d.product || 'Line 6 device';
        model = PID[d.productId] || modelFromName(d.product);
      }
    } catch {}
    if (!model && dev.midiOut) model = modelFromName(dev.midiOut.name);
    const before = `${dev.model}|${dev.usb}`;
    Object.assign(dev, { model, product, usb });
    if (before !== `${dev.model}|${dev.usb}`) {
      dev.gen++;
      // device appeared / changed: re-create the audio blocks so their ports re-connect, and redraw graphics
      for (const b of helixBlocks()) b.opts = Object.assign({}, b.opts, { gen: dev.gen });
      tz.bus.emit('rebuildBoard');
      tz.app.syncGraph();
      if (usb) tz.ui.toast(`${dev.product} detected over USB`, 'ok', 2500);
    }
    changed();
  }
  async function initMidi() {
    try {
      access = await tz.midi({ sysex: false });
    } catch (e) {
      console.info('helix: MIDI unavailable', e?.message || e);
      return;
    }
    const scan = () => {
      const isHx = (p) => /helix|hx\s|hx$|line ?6|pod go/i.test(p.name || '');
      dev.midiOut = [...access.outputs.values()].find(isHx) || null;
      const inp = [...access.inputs.values()].find(isHx) || null;
      if (inp !== dev.midiIn) {
        if (dev.midiIn) dev.midiIn.onmidimessage = null;
        dev.midiIn = inp;
        if (inp) inp.onmidimessage = onMidi;
      }
      detect();
    };
    access.onstatechange = scan;
    scan();
  }
  // ------------------------------------------------------------------ bindings: Helix controls → other pedals
  // Each Helix block keeps `bindings` (saved with the preset): [{ src, msg: {t:'cc'|'note', n, ch}, target: {block, cid},
  // mode: 'momentary' | 'press' }]. Messages are learned from the unit (set the Helix footswitch / EXP pedal to send a
  // MIDI CC or note in Command Center), then drive the target pedal's footswitch or knob / treadle.
  let learning = null; // { blk, binding, onDone }
  const msgText = (m) => (m ? `${m.t === 'note' ? 'Note' : 'CC'} ${m.n} · ch ${m.ch + 1}` : 'not learned');
  function dispatchBinding(t, n, chn, val) {
    if (learning) {
      learning.binding.msg = { t, n, ch: chn };
      const done = learning.onDone;
      learning = null;
      tz.app.markDirty();
      done && done();
      return true;
    }
    let hit = false;
    for (const blk of helixBlocks()) {
      for (const bd of blk.bindings || []) {
        const m = bd.msg;
        if (!m || m.t !== t || m.n !== n || m.ch !== chn || !bd.target) continue;
        hit = true;
        const tgt = tz.app.blocks().find((x) => x.id === bd.target.block);
        const d = tgt && tz.app.getDef(tgt.type);
        const c = d && d.controls.find((x) => x.cid === bd.target.cid);
        if (!c) continue;
        if (c.t === 'foot') {
          if (bd.mode === 'press') {
            if (val > 0 || t === 'cc') { tz.app.pressFoot(tgt.id, c.cid, true); setTimeout(() => tz.app.pressFoot(tgt.id, c.cid, false), 40); }
          } else tz.app.pressFoot(tgt.id, c.cid, val > 63);
        } else tz.app.setControl(tgt.id, c.cid, val / 127);
      }
    }
    return hit;
  }
  function onMidi(ev) {
    const [st, a, b] = ev.data;
    const type = st & 0xf0;
    if (type === 0xb0 && a !== 0 && a !== 32) { if (dispatchBinding('cc', a, st & 15, b)) return; }
    else if (type === 0x90 || type === 0x80) { if (dispatchBinding('note', a, st & 15, type === 0x80 ? 0 : b ? 127 : 0)) return; }
    if (st === 0xf8) {
      // MIDI clock → tempo
      const t = performance.now();
      clockTimes.push(t);
      if (clockTimes.length > 48) clockTimes.shift();
      if (clockTimes.length >= 24) dev.bpm = Math.round(60000 / (((clockTimes[clockTimes.length - 1] - clockTimes[0]) / (clockTimes.length - 1)) * 24));
      return;
    }
    if (type === 0xc0) {
      dev.lastPc = a;
      followHelix(a);
    } else if (type === 0xb0) {
      if (a === 32) dev.setlist = b;
      if (a === map.snapshot) dev.snapshot = b;
      if (a === map.tuner) dev.tuner = b > 63;
    }
    changed();
  }
  const ch = (blk) => Math.max(0, Math.min(15, ((blk && tz.app.ui(blk).hxCh) || 1) - 1));
  function send(bytes) {
    if (!dev.midiOut) return false;
    try { dev.midiOut.send(bytes); return true; } catch { return false; }
  }
  const cc = (blk, n, v) => send([0xb0 | ch(blk), n & 127, Math.max(0, Math.min(127, Math.round(v)))]);
  function recall(blk) {
    const u = tz.app.ui(blk);
    if (!dev.midiOut) return;
    cc(blk, 0, 0);
    cc(blk, 32, u.hxSetlist | 0);
    send([0xc0 | ch(blk), (u.hxPreset | 0) & 127]);
    dev.lastPc = u.hxPreset | 0;
    if ((u.hxSnap | 0) > 0) setTimeout(() => { cc(blk, map.snapshot, (u.hxSnap | 0) - 1); dev.snapshot = (u.hxSnap | 0) - 1; changed(); }, 160);
    changed();
  }
  let following = false;
  async function followHelix(pc) {
    const st = tz.app.state;
    const cur = helixBlocks().find((b) => (tz.app.ui(b).hxFollow ?? 0) > 0.5);
    if (!cur || following) return;
    if ((tz.app.ui(cur).hxPreset | 0) === pc) return;
    following = true;
    try {
      const list = await tz.presets.list();
      for (const p of list) {
        const full = await tz.presets.load(p.file);
        const hb = (full.blocks || []).find((b) => b.type === 'l6x.helix');
        if (hb && (hb.params?.hxPreset | 0) === pc && p.file !== st.file) {
          await tz.presets.open(p.file);
          tz.ui.toast(`Helix preset ${presetName(pc)} → “${p.name}”`, 'info', 1800);
          break;
        }
      }
    } finally {
      following = false;
    }
  }
  function helixBlocks() {
    const st = tz.app.state;
    return st.preset ? st.preset.blocks.filter((b) => b.type === 'l6x.helix') : [];
  }
  const effModel = (blk) => {
    const sel = MODEL_KEYS[(tz.app.ui(blk).hxModel ?? 0) | 0] || 'auto';
    return sel === 'auto' ? dev.model || 'floor' : sel;
  };

  // ------------------------------------------------------------------ block definition
  const fsCtl = [...Array(12)].flatMap((_, i) => [FOOT({ action: 'helix', idx: i, style: 'soft' }), LED({ bind: `param:_fs${i}`, color: FS_COLORS[i] })]);
  tz.addDefs([
    def({
      id: 'l6x.helix', name: 'Line 6 Helix (USB device)', ref: 'Line 6 Helix / HX family – your own unit over USB', brand: 'Line 6', code: 'HELIX',
      cat: 'Device', kind: 'Multi-FX', typeName: 'USB audio + MIDI device', form: 'helix', color: '#141416', algo: 'extio', alwaysOn: true, cost: 0.1,
      opts: { name: 'helix', capture: '(Helix|HX Stomp|HX Effects|Line ?6|POD Go)[^:]*:capture', playback: '(Helix|HX Stomp|HX Effects|Line ?6|POD Go)[^:]*:playback' },
      ports: { ins: ['USB 1', 'USB 2', 'USB 3', 'USB 4', 'USB 5', 'USB 6', 'USB 7', 'USB 8'], outs: ['USB 1 L', 'USB 2 R', 'USB 3', 'USB 4', 'USB 5', 'USB 6', 'USB 7 DI', 'USB 8 DI'] },
      ctrl: { ins: [{ label: 'EXP 2', hook: true, role: 'exp2' }, { label: 'EXP 3', hook: true, role: 'exp3' }, { label: 'EXT FS 1', hook: true, role: 'fs1' }, { label: 'EXT FS 2', hook: true, role: 'fs2' }] },
      initParams: { hxModel: 0, hxPreset: 0, hxSetlist: 0, hxSnap: 0, hxSend: 1, hxFollow: 0, hxCh: 1, exp: 0, expSel: 0 },
      desc: 'Plug your Helix / HX in over USB. The jacks on top are its USB audio channels (USB 1/2 = main out); presets / snapshots set in the inspector are recalled with this Tone Zone preset; click the footswitches to press them on the unit. Patch TZ Footswitch / Expression blocks into EXP / EXT FS.',
      controls: [
        SCREEN('helix', { w: 300, h: 120 }),
        ...fsCtl,
        TREADLE('exp', { virtual: true, def: 0 }),
        SEL('hxModel', 'Graphic', ['Auto-detect', 'Helix Floor', 'Helix LT', 'HX Stomp', 'HX Stomp XL', 'Helix Rack', 'HX Effects'], { virtual: true, hidden: true, noInspector: true }),
        K('hxPreset', 'Helix preset', { min: 0, max: 127, step: 1, def: 0, virtual: true, hidden: true, noInspector: true, display: (v) => presetName(v | 0) + ` (PC ${v | 0})` }),
        SEL('hxSetlist', 'Setlist', ['1', '2', '3', '4', '5', '6', '7', '8'], { virtual: true, hidden: true, noInspector: true }),
        SEL('hxSnap', 'Snapshot', ['—', '1', '2', '3', '4', '5', '6', '7', '8'], { virtual: true, hidden: true, noInspector: true }),
        TOG('hxSend', 'Recall on load', ['OFF', 'ON'], { def: 1, virtual: true, hidden: true, noInspector: true }),
        TOG('hxFollow', 'Follow Helix', ['OFF', 'ON'], { def: 0, virtual: true, hidden: true, noInspector: true }),
        K('hxCh', 'MIDI channel', { min: 1, max: 16, step: 1, def: 1, virtual: true, hidden: true, noInspector: true, display: (v) => String(v | 0) }),
      ],
    }),
  ]);

  // ------------------------------------------------------------------ graphics
  const grain = (() => { const d = document.getElementById('globalDefs'); if (d && !document.getElementById('p-hxgrain')) noisePattern(d, 'p-hxgrain', 60, 96, [255, 255, 255], 0, 0.05, 1); return 'url(#p-hxgrain)'; })();
  tz.addForm('helix', (ctx, def0) => {
    const blk = ctx.block;
    const mk = blk ? effModel(blk) : dev.model || 'floor';
    const M = MODELS[mk];
    const { w, h } = M;
    const g = ctx.g;
    softShadow(g, { w, h, rx: 12, dy: 16, blur: 10, opacity: 0.6 });
    // chassis: matte black die-cast with a darker bevel and grain
    svg('rect', { width: w, height: h, rx: 12, fill: '#141416' }, g);
    svg('rect', { width: w, height: h, rx: 12, fill: grain }, g);
    svg('rect', { width: w, height: h, rx: 12, fill: 'url(#g-shadeV)', opacity: 0.55 }, g);
    svg('rect', { x: 1, y: 1, width: w - 2, height: h - 2, rx: 11, fill: 'none', stroke: '#fff', 'stroke-opacity': 0.08 }, g);
    const theme = { text: '#c9ccd2', knob: 'chrome', labelSize: 5.6, jackText: '#9aa0aa' };
    const name = M.name.toUpperCase();
    const isRack = mk === 'rack';
    // screen position per model
    const scr = def0.controls.find((c) => c.t === 'screen');
    const tre = def0.controls.find((c) => c.t === 'treadle');
    const foots = def0.controls.filter((c) => c.t === 'foot');
    const leds = def0.controls.filter((c) => c.t === 'led');
    const layout = FS_LAYOUT[mk];
    foots.forEach((f, i) => { f.hidden = i >= layout.length; });
    leds.forEach((l, i) => { l.hidden = i >= layout.length; });
    tre.hidden = !M.exp;
    const labels = tz.storage.get('labels_' + mk, {});
    if (isRack) {
      Object.assign(scr, { x: w / 2, y: 70, w: 260, h: 96 });
      for (const x of [16, w - 16]) for (const y of [24, h - 24]) svg('circle', { cx: x, cy: y, r: 5, fill: '#0a0a0b', stroke: '#2a2a2e' }, g);
      label(g, 40, 22, name, { size: 9, fill: '#d8d8dc', weight: 800, anchor: 'start', ls: 2 });
      for (let k = 0; k < 6; k++) knobDeco(g, w / 2 + 170 + (k % 3) * 34, 50 + Math.floor(k / 3) * 40);
    } else if (mk === 'stomp') {
      Object.assign(scr, { x: w / 2, y: 70, w: 210, h: 86 });
      label(g, w / 2, 18, name, { size: 8, fill: '#d8d8dc', weight: 800, ls: 2.4 });
      for (let k = 0; k < 3; k++) knobDeco(g, 62 + k * 73, 140);
    } else {
      const scrW = mk === 'floor' || mk === 'lt' ? 300 : 230;
      Object.assign(scr, { x: w / 2, y: 74, w: scrW, h: mk === 'floor' || mk === 'lt' ? 112 : 92 });
      label(g, 24, 20, name, { size: 9, fill: '#d8d8dc', weight: 800, anchor: 'start', ls: 2.4 });
      // parameter knobs (under the screen on Helix Floor / LT, beside it on the smaller units) + joystick
      const nk = M.knobs;
      if (mk === 'floor' || mk === 'lt') for (let k = 0; k < nk; k++) knobDeco(g, w / 2 - ((nk - 1) * 40) / 2 + k * 40, 150);
      else for (let k = 0; k < nk; k++) knobDeco(g, 40 + (k % 2) * 34 - (k >= 4 ? 0 : 0), 48 + Math.floor(k / 2) * 30);
      svg('circle', { cx: w / 2 + scr.w / 2 + 34, cy: 74, r: 11, fill: '#0c0c0d', stroke: '#3a3a40' }, g);
      svg('circle', { cx: w / 2 + scr.w / 2 + 34, cy: 74, r: 6, fill: 'url(#g-chromeDome)' }, g);
    }
    // footswitches: capacitive caps with LED rings (+ scribble strips)
    const fsAreaW = M.exp ? w - 130 : w;
    const perRow = M.rows === 2 ? Math.ceil(layout.length / 2) : layout.length;
    layout.forEach((fsn, i) => {
      const row = M.rows === 2 ? Math.floor(i / perRow) : 0;
      const col = i - row * perRow;
      const x = 34 + ((fsAreaW - 68) * (col + 0.5)) / perRow;
      const y = M.rows === 2 ? (row === 0 ? h - 112 : h - 40) : h - 46;
      const f = foots[i], l = leds[i];
      Object.assign(f, { x, y, r: 12 });
      Object.assign(l, { x, y: y - 20, r: 2.4 });
      svg('circle', { cx: x, cy: y, r: 17, fill: '#0b0b0c', stroke: '#2b2b30', 'stroke-width': 1 }, g);
      svg('circle', { cx: x, cy: y, r: 15.5, fill: 'none', stroke: FS_COLORS[i], 'stroke-width': 1.6, opacity: 0.55 }, g);
      if (M.scribble) {
        svg('rect', { x: x - 26, y: y - 38, width: 52, height: 12, rx: 2, fill: '#06070a', stroke: '#26262b' }, g);
        const txt = labels[i] || (fsn === 'mode' ? 'MODE' : fsn === 'tap' ? 'TAP / TUNER' : `FS ${fsn}`);
        label(g, x, y - 31.8, txt.slice(0, 12), { size: 5.6, fill: FS_COLORS[i], weight: 700 });
      } else {
        label(g, x, y + 24, labels[i] || (fsn === 'mode' ? 'MODE' : fsn === 'tap' ? 'TAP' : `FS${fsn}`), { size: 5.2, fill: '#8a8f99', weight: 700 });
      }
    });
    if (M.exp) {
      Object.assign(tre, { x: w - 62, y: h / 2 + 32, w: 92, h: h - 120, color: '#18181b', logo: 'EXP', logoColor: '#6b7180', logoFont: "'Oswald', sans-serif", logoSize: 12 });
    }
    formKit.placeControls(ctx, def0.controls, theme);
    // back-panel USB channel jacks along the top edge + control jacks
    const jacks = [];
    const nIn = def0.ports.ins.length, nOut = def0.ports.outs.length;
    const span = w - 60;
    const total = nIn + nOut + 4;
    const step = Math.min(30, span / total);
    let x = ctx.flip ? 30 : w - 30;
    const adv = () => { const v = x; x += ctx.flip ? step : -step; return v; };
    def0.ports.ins.forEach((lab, i) => jacks.push({ key: 'i' + i, dir: 'in', port: i, label: lab, side: 'top', x: adv(), y: -2 }));
    x += ctx.flip ? step * 0.5 : -step * 0.5;
    def0.ports.outs.forEach((lab, i) => jacks.push({ key: 'o' + i, dir: 'out', port: i, label: lab, side: 'top', x: adv(), y: -2 }));
    x += ctx.flip ? step * 0.5 : -step * 0.5;
    def0.ctrl.ins.forEach((c, i) => jacks.push({ key: 'ic' + i, dir: 'in', port: 'c' + i, label: c.label, side: 'top', x: adv(), y: -2, kind: 'ctrl' }));
    label(g, w / 2, h - 8, 'USB AUDIO · MIDI', { size: 4.6, fill: '#5d626c', weight: 700, ls: 1.6 });
    return { w, h, theme, jacks };
  });
  function knobDeco(g, x, y) {
    svg('circle', { cx: x, cy: y + 1.5, r: 11, fill: '#000', opacity: 0.5 }, g);
    svg('circle', { cx: x, cy: y, r: 10, fill: 'url(#g-knobBlack)', stroke: '#2a2a2e' }, g);
    svg('line', { x1: x, y1: y - 9, x2: x, y2: y - 4, stroke: '#ddd', 'stroke-width': 1.2, 'stroke-linecap': 'round' }, g);
  }

  // ------------------------------------------------------------------ screen
  tz.addScreen('helix', {
    build(s, g, w, h) {
      svg('rect', { width: w, height: h, fill: '#05070b' }, g);
      svg('rect', { width: w, height: 14, fill: '#10141c' }, g);
      s.model = svg('text', { x: 6, y: 10, fill: '#e9ecf3', 'font-size': 7, 'font-weight': 700, 'font-family': "'Inter', sans-serif" }, g, '');
      s.stat = svg('text', { x: w - 6, y: 10, 'text-anchor': 'end', fill: '#7d8597', 'font-size': 6.2, 'font-family': "'Share Tech Mono', monospace" }, g, '');
      s.pre = svg('text', { x: w / 2, y: h * 0.55, 'text-anchor': 'middle', fill: '#ffffff', 'font-size': Math.min(30, h * 0.3), 'font-weight': 800, 'font-family': "'Oswald', sans-serif" }, g, '');
      s.sub = svg('text', { x: w / 2, y: h * 0.55 + 14, 'text-anchor': 'middle', fill: '#9aa3b5', 'font-size': 6.6, 'font-family': "'Inter', sans-serif" }, g, '');
      s.snaps = [];
      for (let i = 0; i < 8; i++) {
        const bw = (w - 20) / 8;
        const r = svg('rect', { x: 10 + i * bw + 1, y: h - 18, width: bw - 2, height: 11, rx: 2, fill: '#141922' }, g);
        const t = svg('text', { x: 10 + i * bw + bw / 2, y: h - 10, 'text-anchor': 'middle', 'font-size': 6, fill: '#6b7385', 'font-family': "'Inter', sans-serif", 'font-weight': 700 }, g, String(i + 1));
        s.snaps.push({ r, t });
      }
      s.tuner = svg('text', { x: w - 6, y: 24, 'text-anchor': 'end', fill: '#ffd60a', 'font-size': 6.5, 'font-weight': 800, 'font-family': "'Inter', sans-serif" }, g, '');
    },
    update(s, st, nv) {
      const u = tz.app.ui(nv.block);
      const mk = effModel(nv.block);
      setText(s.model, dev.product || MODELS[mk].name);
      const audioOk = st && st.connected > 0;
      setText(s.stat, `${dev.usb ? 'USB ✓' : 'USB –'}  ${dev.midiOut ? 'MIDI ✓' : 'MIDI –'}  ${audioOk ? 'AUDIO ✓' : 'AUDIO –'}${dev.bpm ? '  ' + dev.bpm + ' BPM' : ''}`);
      setA(s.stat, 'fill', dev.usb && dev.midiOut ? '#3ddc84' : '#ff9f0a');
      const pc = dev.lastPc ?? (u.hxPreset | 0);
      const on = dev.usb || dev.midiOut;
      setText(s.pre, on ? presetName(pc) : 'NOT CONNECTED');
      setA(s.pre, 'font-size', on ? Math.min(30, s.view.h * 0.3) : Math.min(14, s.view.w / 16));
      setText(s.sub, on ? (s.view.w > 240 ? `Setlist ${(dev.setlist | 0) + 1} · preset ${pc} · ${u.hxSend > 0.5 ? 'recalled with this preset' : 'not recalled'}` : `Setlist ${(dev.setlist | 0) + 1} · PC ${pc}`) : 'Connect the unit over USB');
      const snap = dev.snapshot ?? ((u.hxSnap | 0) > 0 ? (u.hxSnap | 0) - 1 : -1);
      s.snaps.forEach((x, i) => {
        setA(x.r, 'fill', i === snap ? '#0a84ff' : '#141922');
        setA(x.t, 'fill', i === snap ? '#fff' : '#6b7385');
      });
      setText(s.tuner, dev.tuner ? 'TUNER' : '');
    },
  });

  // ------------------------------------------------------------------ behaviour
  const fsCC = (blk, fsn) => (typeof fsn === 'number' ? map.fs[fsn] : null);
  tz.blockHooks('l6x.helix', {
    foot(view, ctl, down) {
      if (ctl.action !== 'helix') return false;
      const blk = view.block;
      const fsn = FS_LAYOUT[effModel(blk)][ctl.idx];
      const key = '_fs' + ctl.idx;
      if (fsn === 'tap') {
        if (down) {
          cc(blk, map.tap, 127);
          view._tapHold = setTimeout(() => { cc(blk, map.tuner, dev.tuner ? 0 : 127); dev.tuner = !dev.tuner; changed(); }, 900);
        } else clearTimeout(view._tapHold);
      } else if (fsn === 'mode') {
        if (down) cc(blk, map.mode, 127);
      } else {
        const n = fsCC(blk, fsn);
        if (n != null) cc(blk, n, down ? 127 : 0);
        if (down) tz.app.setParam(blk.id, key, (tz.app.ui(blk)[key] ?? 0) > 0.5 ? 0 : 1);
      }
      if (!dev.midiOut && down) tz.ui.toast('No Helix MIDI port found – plug the unit in over USB', 'warn', 2200);
      return true;
    },
    ctrl(blk, idx, value, kind, inp) {
      if (inp.role === 'exp2' || inp.role === 'exp3') {
        if (kind === 'cont') cc(blk, map.exp[inp.role === 'exp2' ? 1 : 2], value * 127);
        else if (kind === 'press' && value > 0.5) cc(blk, map.toe, 127);
      } else if (inp.role === 'fs1' || inp.role === 'fs2') {
        const n = inp.role === 'fs1' ? map.fs[4] : map.fs[5];
        if (kind === 'press') cc(blk, n, value > 0.5 ? 127 : 0);
        else if (kind === 'cont') cc(blk, n, value > 0.5 ? 127 : 0);
      }
    },
    inspector(sec, blk, api) {
      const { el } = tz.ui;
      el('h5', {}, sec).textContent = 'Helix device';
      el('p', { class: 'hint' }, sec).textContent = dev.usb || dev.midiOut ? `Connected: ${dev.product || dev.midiOut?.name}` : 'No Helix / HX found on USB yet – it appears here automatically when plugged in.';
      for (const p of ['hxModel', 'hxSetlist', 'hxPreset', 'hxSnap', 'hxSend', 'hxFollow', 'hxCh']) {
        const c = def0().controls.find((x) => x.p === p);
        api.rowFor(Object.assign({}, c, { hidden: false, noInspector: false }));
      }
      const row = el('div', { class: 'insp-actions', style: { marginTop: '8px', flexWrap: 'wrap' } }, sec);
      const btn = (t, fn) => { const b = el('button', { class: 'btn small' }, row, t); b.onclick = fn; };
      btn('Recall now', () => recall(blk));
      btn('Tap', () => cc(blk, map.tap, 127));
      btn('Tuner', () => { cc(blk, map.tuner, dev.tuner ? 0 : 127); dev.tuner = !dev.tuner; changed(); });
      const snaps = el('div', { class: 'insp-actions', style: { marginTop: '6px', flexWrap: 'wrap' } }, sec);
      for (let i = 0; i < 8; i++) { const b = el('button', { class: 'btn small' }, snaps, 'Snap ' + (i + 1)); b.onclick = () => { cc(blk, map.snapshot, i); dev.snapshot = i; changed(); }; }
      const lp = el('div', { class: 'insp-actions', style: { marginTop: '6px', flexWrap: 'wrap' } }, sec);
      for (const [t, k, v] of [['Loop rec', 'record', 127], ['Overdub', 'record', 0], ['Play', 'play', 127], ['Stop', 'play', 0], ['Once', 'once', 127], ['Undo', 'undo', 127]]) {
        const b = el('button', { class: 'btn small' }, lp, t);
        b.onclick = () => cc(blk, map.looper[k], v);
      }
      bindingsUI(sec, blk);
      el('h5', { style: { marginTop: '12px' } }, sec).textContent = 'Footswitch labels';
      const mk = effModel(blk);
      const labels = tz.storage.get('labels_' + mk, {});
      FS_LAYOUT[mk].forEach((fsn, i) => {
        const r = el('div', { class: 'io-hdr' }, sec);
        el('span', { class: 'io-idx' }, r).textContent = fsn === 'mode' ? 'MODE' : fsn === 'tap' ? 'TAP' : 'FS ' + fsn;
        const inp = el('input', { class: 'io-label', value: labels[i] || '', placeholder: 'label', maxlength: 12 }, r);
        inp.onchange = () => { labels[i] = inp.value.trim(); tz.storage.set('labels_' + mk, labels); tz.bus.emit('rebuildBoard'); };
      });
      el('p', { class: 'hint' }, sec).textContent = 'MIDI map: Helix factory defaults (FS1–5 = CC49–53, FS7–11 = CC54–58, EXP 1–3 = CC1–3, toe = CC59, tap = CC64, tuner = CC68, snapshot = CC69, looper = CC60–66). The unit\'s MIDI channel must match.';
    },
  });
  const def0 = () => tz.app.getDef('l6x.helix');

  function bindingsUI(sec, blk) {
    const { el, toast } = tz.ui;
    el('h5', { style: { marginTop: '12px' } }, sec).textContent = 'Control other pedals';
    el('p', { class: 'hint' }, sec).textContent = 'Use the Helix footswitches and expression pedal to switch / sweep pedals on this board. On the Helix, set each footswitch (and EXP pedal) to send a MIDI CC in Command Center, then press Learn here and move it.';
    const list = el('div', { class: 'hx-binds' }, sec);
    const mk = effModel(blk);
    const sources = [...FS_LAYOUT[mk].filter((f) => typeof f === 'number').map((f) => 'FS ' + f), 'EXP 1', 'EXP 2', 'EXP 3'];
    const draw = () => {
      list.innerHTML = '';
      const others = tz.app.blocks().filter((b) => b.id !== blk.id);
      (blk.bindings || []).forEach((bd, i) => {
        const row = el('div', { class: 'hx-bind' }, list);
        const src = el('select', {}, row, sources.map((x) => `<option${x === bd.src ? ' selected' : ''}>${x}</option>`).join(''));
        src.onchange = () => { bd.src = src.value; tz.app.markDirty(); };
        const tb = el('select', {}, row, '<option value="">– pedal –</option>' + others.map((b) => `<option value="${b.id}"${bd.target && bd.target.block === b.id ? ' selected' : ''}>${tz.ui.esc((tz.app.getDef(b.type) || {}).name || b.type)}</option>`).join(''));
        const tc = el('select', {}, row);
        const fillCtl = () => {
          const b = others.find((x) => x.id === tb.value);
          const d = b && tz.app.getDef(b.type);
          const ctls = d ? d.controls.filter((c) => c.t === 'foot' || ((c.t === 'knob' || c.t === 'slider' || c.t === 'treadle') && c.p)) : [];
          tc.innerHTML = ctls.map((c, k) => `<option value="${c.cid}"${bd.target && bd.target.cid === c.cid ? ' selected' : ''}>${c.t === 'foot' ? 'Footswitch' + (c.label ? ' ' + tz.ui.esc(c.label) : ' ' + (k + 1)) : (c.t === 'treadle' ? 'Treadle' : tz.ui.esc(c.label || c.p))}</option>`).join('');
          if (b && ctls.length) bd.target = { block: b.id, cid: tc.value };
        };
        tb.onchange = () => { fillCtl(); tz.app.markDirty(); };
        tc.onchange = () => { bd.target = { block: tb.value, cid: tc.value }; tz.app.markDirty(); };
        fillCtl();
        const mode = el('select', { title: 'Momentary: pressed while the Helix switch is held. Press: every message is one click (for latching switches).' }, row, `<option value="press"${bd.mode !== 'momentary' ? ' selected' : ''}>Press</option><option value="momentary"${bd.mode === 'momentary' ? ' selected' : ''}>Momentary</option>`);
        mode.onchange = () => { bd.mode = mode.value; tz.app.markDirty(); };
        const lr = el('div', { class: 'hx-learn' }, row);
        const lab = el('span', {}, lr);
        lab.textContent = msgText(bd.msg);
        const lb = el('button', { class: 'btn small' }, lr, 'Learn');
        lb.onclick = () => {
          if (!dev.midiIn) return toast('No Helix MIDI input found – plug the unit in over USB', 'warn', 2400);
          learning = { blk, binding: bd, onDone: () => { lab.textContent = msgText(bd.msg); lb.textContent = 'Learn'; } };
          lb.textContent = 'Move it…';
        };
        const x = el('button', { class: 'btn small btn-ghost', title: 'Remove' }, lr, '×');
        x.onclick = () => { blk.bindings.splice(i, 1); tz.app.markDirty(); draw(); };
      });
      const add = el('button', { class: 'btn small' }, list, '+ Add binding');
      add.onclick = () => {
        blk.bindings = blk.bindings || [];
        const used = new Set(blk.bindings.map((b) => b.src));
        blk.bindings.push({ src: sources.find((x) => !used.has(x)) || sources[0], msg: null, target: null, mode: 'press' });
        tz.app.markDirty();
        draw();
      };
    };
    draw();
  }
  // tests / debugging: inject a MIDI message as if it came from the Helix
  window.__hxInject = (bytes) => onMidi({ data: bytes });

  // treadle → EXP 1 (toe switch selects EXP 2 like the real pedal)
  tz.bus.on('param', ({ id, p, v }) => {
    if (p !== 'exp') return;
    const blk = helixBlocks().find((b) => b.id === id);
    if (blk) cc(blk, map.exp[(tz.app.ui(blk).expSel | 0) ? 1 : 0], (v ?? 0) * 127);
  });
  // every Tone Zone preset load recalls the Helix preset / snapshot stored in it
  tz.bus.on('preset:changed', ({ keepView } = {}) => {
    if (keepView) return; // undo / redo / board rebuilds don't re-send
    for (const b of helixBlocks()) if ((tz.app.ui(b).hxSend ?? 1) > 0.5) setTimeout(() => recall(b), 50);
  });
  // re-render the screen when device state changes
  listeners.add(() => {});
  initMidi();
  detect();
  const poll = setInterval(detect, 4000);
  tz.addStyles('.hx-bind{display:grid;grid-template-columns:70px 1fr;gap:5px 6px;padding:8px;margin:6px 0;border:1px solid var(--line);border-radius:10px;background:rgba(0,0,0,.15)}.hx-bind select{font-size:11.5px;padding:4px 6px;min-width:0}.hx-learn{grid-column:1/-1;display:flex;gap:6px;align-items:center}.hx-learn span{flex:1;font-size:11px;color:var(--muted)}');
  tz.onUnload(() => { clearInterval(poll); if (dev.midiIn) dev.midiIn.onmidimessage = null; delete window.__hxInject; });
}
